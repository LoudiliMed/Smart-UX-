# Phase 1: Safety Foundation - Research

**Researched:** 2026-03-06
**Domain:** Clinical decision support infrastructure - patient dossier context builder and Claude API wrapper
**Confidence:** HIGH

## Summary

Phase 1 builds the foundational infrastructure that all subsequent safety features depend on: `buildDossierContext(patient)` assembles patient data into a French-language narrative string for Claude's context, and `callClaudeChat()` provides a thin async wrapper around the existing Groq proxy endpoint. The phase also ensures every AI response carries the mandatory disclaimer "Analyse assistée par IA - verification clinique recommandee" per SAFE-02.

The architecture is deliberately simple: a pure function for dossier construction and a thin async wrapper for Claude calls. No new dependencies are needed. The primary risk is prompt calibration for alert fatigue prevention (96% override rates documented in CDSS research), which must be addressed in the system prompt design before any UI is built in Phase 2.

**Primary recommendation:** Implement `buildDossierContext()` as a pure function following the exact string format specified in CONTEXT.md, implement `callClaudeChat()` wrapping the existing `/api/claude` endpoint, and embed the disclaimer enforcement in the system prompt instruction (Claude's discretion resolved by planner).

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Current medications source
- Pull from `/api/prescriptions` (the existing Express backend endpoint)
- Filter client-side by `patient_id` - no backend changes needed, reuses existing fetch pattern
- Include all prescriptions (full history, no date cutoff) - Claude reasons about recency from dates
- Format per entry: drug name + dose + route (e.g. "Amoxicilline 1g per os")
- Empty state: include explicit "Aucun traitement en cours" so Claude knows absence is confirmed, not unknown

#### Dossier string format
- Clinical narrative prose in French - not labeled sections, not JSON
- Header line: full name + IPP + computed age + ward + room (e.g. "Patient : Jean Dupont (IPP-000001), 70 ans, Cardiologie Conventionnelle, chambre 102")
- Vitals: most recent DB_CONSTANTES entry only (TA, FC, temp, SpO2, poids) - current state, no trend history
- Clinical notes: most recent DB_OBSERVATIONS entry only - current picture without full admission history
- Allergies inline from KNOWN_ALLERGIES (omit section or note "Aucune allergie connue" if empty)
- Current meds inline using the format decided above

### Claude's Discretion

- Alert response structure - how `callClaudeChat()` formats severity-tiered output (JSON array vs structured text) left to planner
- Disclaimer placement - whether SAFE-02 text is enforced via system prompt instruction, appended by the JS wrapper, or rendered by the UI left to planner
- System prompt wording for alert-mode and chat-mode
- Order of sections within the narrative

### Deferred Ideas (OUT OF SCOPE)

None - discussion stayed within phase scope.

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SAFE-01 | System assembles patient dossier context (allergies, current medications, vitals, diagnoses) into a structured prompt-ready string via `buildDossierContext()` function | Direct implementation using existing `DB_PATIENTS`, `DB_CONSTANTES`, `DB_OBSERVATIONS`, `KNOWN_ALLERGIES` databases; prescriptions from `/api/prescriptions` endpoint; pure function pattern established in SUMMARY.md |
| SAFE-02 | Every AI-generated alert displays the disclaimer "Analyse assistee par IA - verification clinique recommandee" | System prompt instruction pattern established in SUMMARY.md pitfall research; French-only mandate confirmed in codebase inspection |

</phase_requirements>

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19.2.4 | UI framework | Existing codebase (package.json verified) |
| Express | 5.2.1 | Backend proxy | Existing proxy at `/api/claude` (server.js verified) |
| better-sqlite3 | 12.6.2 | Prescription persistence | Existing prescriptions table (server.js verified) |

### Supporting (No new installs needed)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Native `fetch` | Browser API | API calls | Wrapping existing proxy |
| `useState`, `useEffect`, `useCallback` | React 19 hooks | Component state | Already imported in SmartUX_AI_Bots.jsx |

### Existing Proxy Pattern

| Endpoint | Model | Purpose |
|----------|-------|---------|
| `/api/claude` | `llama-3.3-70b-versatile` via Groq | Claude-compatible response format |

**No installation needed** - all infrastructure exists.

---

## Architecture Patterns

### Recommended Implementation Location

All code within `SmartUX_AI_Bots.jsx` following the existing single-file convention:

```
src/SmartUX_AI_Bots.jsx
├── (lines 1-47)     # Imports, constants, detectAllergyConflict()
├── (lines 48-126)  # mapNLPToPrescription()
├── (lines 127-182) # parseWithClaude() ← EXISTING PATTERN TO FOLLOW
├── (NEW)           # buildDossierContext(patient, prescriptions) ← ADD HERE
├── (NEW)           # callClaudeChat(systemPrompt, userMessage, history?) ← ADD HERE
├── (lines 183+)    # UI components...
```

### Pattern 1: Pure Function for Dossier Construction

**What:** `buildDossierContext(patient, prescriptions)` assembles patient data into French narrative string for Claude context.

**When to use:** Called by both AlertSystem (Phase 2) and ChatPanel (Phase 3) before any Claude API call.

**Example:**

```javascript
// Source: CONTEXT.md + database.js structure analysis
function buildDossierContext(patient, prescriptions) {
  // 1. Compute age from date_of_birth
  const age = new Date().getFullYear() - new Date(patient.date_of_birth).getFullYear();

  // 2. Header line (LOCKED DECISION)
  const header = `Patient : ${patient.first_name} ${patient.last_name} (${patient.ipp}), ${age} ans, ${patient.ward}, chambre ${patient.room}`;

  // 3. Most recent vitals (LOCKED DECISION: single entry, sort by date desc)
  const vitals = DB_CONSTANTES
    .filter(c => c.patient_id === patient.patient_id)
    .sort((a, b) => new Date(b.date) - new Date(a.date))[0];

  const vitalsStr = vitals
    ? `Constantes : TA ${vitals.ta}, FC ${vitals.fc}/min, Temp ${vitals.temp}C, SpO2 ${vitals.spo2}%, Poids ${vitals.poids}kg`
    : "Constantes : Non disponibles";

  // 4. Most recent clinical note (LOCKED DECISION: single entry)
  const note = DB_OBSERVATIONS
    .filter(o => o.patient_id === patient.patient_id)
    .sort((a, b) => new Date(b.date) - new Date(a.date))[0];

  const noteStr = note
    ? `Derniere note (${new Date(note.date).toLocaleDateString('fr-FR')}) : ${note.text}`
    : "Aucune note clinique recente";

  // 5. Allergies inline (LOCKED DECISION: from KNOWN_ALLERGIES map)
  const allergies = KNOWN_ALLERGIES[patient.patient_id] || [];
  const allergiesStr = allergies.length > 0
    ? `Allergies connues : ${allergies.join(', ')}`
    : "Aucune allergie connue";

  // 6. Current medications (LOCKED DECISION: full history, Claude reasons about dates)
  const medsStr = prescriptions && prescriptions.length > 0
    ? "Traitements en cours : " + prescriptions
        .map(rx => `${rx.drug_name_free || rx.medicament_id} ${rx.dosage || ''} ${rx.route || ''}`.trim())
        .join('; ')
    : "Aucun traitement en cours";

  // 7. Assemble as narrative prose (LOCKED DECISION: not JSON, not labeled sections)
  return `${header}\n\n${vitalsStr}\n\n${noteStr}\n\n${allergiesStr}\n\n${medsStr}`;
}
```

### Pattern 2: Claude API Wrapper

**What:** `callClaudeChat()` wraps the existing `/api/claude` endpoint with consistent response handling.

**When to use:** Called by AlertSystem (Phase 2) for prescription safety checks and ChatPanel (Phase 3) for free-form Q&A.

**Example:**

```javascript
// Source: Existing parseWithClaude() pattern at SmartUX_AI_Bots.jsx:149-182
async function callClaudeChat(systemPrompt, userMessage, history = []) {
  try {
    const messages = [
      { role: "system", content: systemPrompt },
      ...history,
      { role: "user", content: userMessage }
    ];

    const res = await fetch("http://localhost:3001/api/claude", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-5", // Existing model convention
        max_tokens: 2000,
        messages: messages.map(m => ({ role: m.role, content: m.content })),
      }),
    });

    if (!res.ok) {
      throw new Error(`API error: ${res.status}`);
    }

    const data = await res.json();
    const text = data.content?.[0]?.text || "";

    // SAFE-02: Disclaimer enforcement (PLANNER DECIDES: prompt instruction vs wrapper append vs UI render)
    return text;
  } catch (e) {
    console.error("callClaudeChat error:", e);
    throw e; // Let caller handle error state
  }
}
```

### Anti-Patterns to Avoid

- **Do NOT serialize full DB records** - CONTEXT.md specifies most recent entries only, not full history
- **Do NOT use JSON structure** - CONTEXT.md explicitly requires "clinical narrative prose in French - not labeled sections, not JSON"
- **Do NOT make `buildDossierContext` async** - Pure function operating on in-memory data (DB_CONSTANTES, DB_OBSERVATIONS, KNOWN_ALLERGIES are imported constants)
- **Do NOT fetch prescriptions inside `buildDossierContext`** - CONTEXT.md specifies "caller decides async boundary" - pass prescriptions as parameter

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Claude API response parsing | Custom JSON extraction | Existing `data.content[0].text` pattern | Proven in `parseWithClaude()` at line 176 |
| Error handling | Try-catch per call | Unified error boundary in wrapper | Consistent error propagation for AlertSystem |
| Age computation | Custom date math | `new Date().getFullYear() - new Date(p.date_of_birth).getFullYear()` | Already used in DossierPanel line 509 |

---

## Common Pitfalls

### Pitfall 1: Missing Empty State Handling

**What goes wrong:** Claude interprets missing data as "unknown" rather than "confirmed absence", leading to unnecessary clarification questions.

**Why it happens:** Developer assumes optional fields can simply be omitted from the string.

**How to avoid:** CONTEXT.md explicitly requires:
- Prescriptions empty: "Aucun traitement en cours"
- Allergies empty: "Aucune allergie connue"
- Vitals missing: "Constantes : Non disponibles"

**Warning signs:** Claude asks clarification questions like "Le patient a-t-il des allergies?" instead of reasoning from provided context.

### Pitfall 2: Alert Fatigue from Over-Detailed Prompts

**What goes wrong:** Claude generates INFO-level findings that flood the UI, leading to 96%+ override rates documented in JAMIA research.

**Why it happens:** Including full medication history, full observation history, or verbose clinical notes overwhelms Claude's reasoning and produces low-signal alerts.

**How to avoid:**
- Limit to MOST RECENT vitals entry (already locked in CONTEXT.md)
- Limit to MOST RECENT clinical note (already locked)
- Exclude historical medications from dossier (Claude gets prescription list separately in Phase 2)
- System prompt MUST instruct Claude to suppress INFO-level and express uncertainty

**Warning signs:** Claude produces alerts for "potential interaction" without severity classification, or generates >3 alerts per prescription.

### Pitfall 3: Inconsistent French Language

**What goes wrong:** Claude responds in English or mixed language, breaking clinical user trust and French regulatory compliance.

**Why it happens:** System prompt doesn't explicitly mandate French output.

**How to avoid:** System prompt MUST include explicit French instruction: "Tu es un assistant medical francophone. Reponds EXCLUSIVEMENT en francais."

**Warning signs:** Claude uses English terms like "drug interaction" or "contraindication" instead of French equivalents.

### Pitfall 4: Disclaimer Omission

**What goes wrong:** AI responses appear without the mandatory disclaimer, violating SAFE-02.

**Why it happens:** Planner defers implementation decision but code doesn't enforce at any layer.

**How to avoid:** Three enforcement points (planner chooses one):
1. System prompt instruction: "Chaque reponse DOIT commencer par: '[AVERTISSEMENT] Analyse assistee par IA - verification clinique recommandee.'"
2. JS wrapper post-processing: `return "[AVERTISSEMENT] Analyse assistee par IA - verification clinique recommandee.\n\n" + text;`
3. UI render layer: Component prepends disclaimer before displaying

**Warning signs:** Claude output reaches UI without visible disclaimer.

### Pitfall 5: PHI in Claude Context (RGPD Risk)

**What goes wrong:** Patient name and DOB sent to Claude API without anonymization, creating RGPD compliance risk.

**Why it happens:** CONTEXT.md header line includes full name and IPP, but STATE.md flags this as a blocker.

**How to avoid:** Phase 1 MUST implement tokenization OR confirm DPA status before sending patient data:
- Tokenize: "Patient H-4821, 70 ans" instead of "Jean Dupont (IPP-000001)"
- Or: Confirm Anthropic DPA with hospital legal before Phase 1 code ships

**Warning signs:** Real patient names appear in Claude API requests during testing.

---

## Code Examples

### Dossier Context Builder (Complete Implementation)

```javascript
// Source: CONTEXT.md decisions + database.js structure analysis
function buildDossierContext(patient, prescriptions) {
  // Guard: patient must exist
  if (!patient) return null;

  // Age computation (existing pattern at line 509)
  const age = new Date().getFullYear() - new Date(patient.date_of_birth).getFullYear();

  // Header (LOCKED: full name + IPP + age + ward + room)
  const header = `Patient : ${patient.first_name} ${patient.last_name} (${patient.ipp}), ${age} ans, ${patient.ward}, chambre ${patient.room}`;

  // Vitals: most recent entry only (LOCKED)
  const vitals = DB_CONSTANTES
    .filter(c => c.patient_id === patient.patient_id)
    .sort((a, b) => new Date(b.date) - new Date(a.date))[0];

  const vitalsStr = vitals
    ? `Constantes (le ${new Date(vitals.date).toLocaleDateString('fr-FR')}) : TA ${vitals.ta}, FC ${vitals.fc}/min, Temperature ${vitals.temp}C, SpO2 ${vitals.spo2}%, Poids ${vitals.poids}kg`
    : "Constantes : Non disponibles";

  // Clinical note: most recent entry only (LOCKED)
  const note = DB_OBSERVATIONS
    .filter(o => o.patient_id === patient.patient_id)
    .sort((a, b) => new Date(b.date) - new Date(a.date))[0];

  const noteStr = note
    ? `Derniere note clinique (${new Date(note.date).toLocaleDateString('fr-FR')} - ${note.category}) : ${note.text}`
    : "Aucune note clinique recente";

  // Allergies (LOCKED: inline from KNOWN_ALLERGIES)
  const allergies = KNOWN_ALLERGIES[patient.patient_id] || [];
  const allergiesStr = allergies.length > 0
    ? `Allergies connues : ${allergies.join(', ')}`
    : "Aucune allergie connue";

  // Current medications (LOCKED: full history from prescriptions, Claude reasons about recency)
  const medsStr = prescriptions && prescriptions.length > 0
    ? "Traitements en cours : " + prescriptions
        .map(rx => {
          const drug = rx.drug_name_free || DB_MEDICAMENTS.find(m => m.id === rx.medicament_id)?.brand || "Medicament inconnu";
          return `${drug}${rx.dosage ? ' ' + rx.dosage : ''}${rx.route ? ' ' + rx.route : ''}`;
        })
        .join('; ')
    : "Aucun traitement en cours";

  // Assemble as narrative prose (LOCKED: not JSON, not labeled sections)
  return `${header}\n\n${vitalsStr}\n\n${noteStr}\n\n${allergiesStr}\n\n${medsStr}`;
}
```

### Claude Wrapper with Disclaimer (Prompt-Based Enforcement)

```javascript
// Source: Existing parseWithClaude() pattern + CONTEXT.md decisions
const CLAUDE_SYSTEM_PROMPT_ALERT = `Tu es un assistant de verification des prescriptions medicales dans un hopital francais.

Tu analyses le dossier patient et les prescriptions pour identifier:
- Conflits d'allergies (CRITIQUE)
- Interactions medicamenteuses graves (CRITIQUE/MODERE)
- Contre-indications (CRITIQUE/MODERE)
- Ajustements posologiques necessaires (MODERE/FAIBLE)

REGLES IMPERATIVES:
1. Reponds EXCLUSIVEMENT en francais
2. Classe chaque alerte: CRITIQUE / MODERE / FAIBLE
3. Supprime les alertes FAIBLE si le risque est theorique ou negligeable
4. Exprime l'incertitude: "Peut-etre" si le signal est faible
5. Chaque reponse DOIT commencer par: "[AVERTISSEMENT] Analyse assistee par IA - verification clinique recommandee."

FORMAT DE REPONSE:
[AVERTISSEMENT] Analyse assistee par IA - verification clinique recommandee.

[S'il y a des alertes:]
**CRITIQUE** : [description du risque + mecanisme + alternative suggeree]
**MODERE** : [description du risque + recommandation]

[S'il n'y a pas d'alerte:]
Aucune interaction identifiee dans les donnees disponibles - le jugement clinique du prescripteur reste requis.`;

const CLAUDE_SYSTEM_PROMPT_CHAT = `Tu es un assistant medical clinique dans un hopital francais.

Tu reponds aux questions du personnel medical sur les patients.

REGLES IMPERATIVES:
1. Reponds EXCLUSIVEMENT en francais
2. Base tes reponses sur le dossier patient fourni
3. Indique clairement quand tu n'es pas certain
4. Chaque reponse DOIT commencer par: "[AVERTISSEMENT] Analyse assistee par IA - verification clinique recommandee."
5. Ne fais JAMAIS de diagnostic - propose des hypotheses a verifier`;

async function callClaudeChat(systemPrompt, userMessage, history = []) {
  try {
    const messages = history.length > 0
      ? [...history, { role: "user", content: userMessage }]
      : [{ role: "user", content: userMessage }];

    const res = await fetch("http://localhost:3001/api/claude", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-5",
        max_tokens: 2000,
        messages: [
          { role: "system", content: systemPrompt },
          ...messages
        ],
      }),
    });

    if (!res.ok) {
      throw new Error(`Claude API error: ${res.status}`);
    }

    const data = await res.json();
    return data.content?.[0]?.text || "";
  } catch (error) {
    console.error("callClaudeChat error:", error);
    throw error;
  }
}
```

### Data Flow for Phase 1

```
Patient Selection (Phase 2)
         │
         ▼
┌─────────────────────────────────┐
│  fetch('/api/prescriptions')   │
│  .then(r => r.json())          │
│  .then(rx => rx.filter(        │
│    r => r.patient_id === id))  │
└─────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│  buildDossierContext(          │
│    patient,                     │
│    prescriptions                │
│  )                              │
│  → Returns French narrative     │
└─────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│  callClaudeChat(               │
│    CLAUDE_SYSTEM_PROMPT_ALERT,  │
│    dossier + drug query         │
│  )                              │
│  → Returns analyzed response    │
│    with disclaimer              │
└─────────────────────────────────┘
         │
         ▼
AlertSystem Component (Phase 2)
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Rule-based CDSS with static interaction DB | LLM contextual reasoning over patient dossier | SUMMARY.md recommendation | Patient-specific reasoning, captures subtle interactions rule engines miss |
| JSON-structured clinical data | Narrative prose format | CONTEXT.md locked decision | Claude processes natural language better than structured data |
| All historical data in context | Most recent entries only | CONTEXT.md locked decision | Reduces token usage, focuses Claude on current state |
| Single prompt type | Separate system prompts for alert-mode and chat-mode | CONTEXT.md Claude's discretion | Enables mode-specific calibration for alert fatigue prevention |

**Deprecated/outdated:**
- Full dossier serialization (all vitals history, all notes): Creates context window bloat and noise
- External drug interaction API: SUMMARY.md explicitly excludes; Claude handles reasoning
- Numerical confidence scores: SUMMARY.md anti-feature (causes both overreliance and dismissal)

---

## Open Questions

1. **PHI Tokenization Strategy (BLOCKER)**
   - What we know: STATE.md flags RGPD/PHI compliance as pre-development blocker; patient name and DOB in dossier violates RGPD if sent to Claude without DPA
   - What's unclear: Whether hospital has signed Anthropic DPA, or whether tokenization is required
   - Recommendation: Planner MUST decide: (a) confirm DPA with legal before code ships, OR (b) implement tokenization in `buildDossierContext` (replace name with "Patient H-{id}", compute age locally, omit DOB entirely)

2. **Disclaimer Enforcement Layer (Claude's Discretion)**
   - What we know: Three valid implementation options - system prompt instruction, JS wrapper append, UI render
   - What's unclear: Which layer is most robust against Claude forgetting the instruction
   - Recommendation: Planner should choose based on maintainability - prompt instruction is clearest but requires testing; wrapper append is failsafe but duplicates disclaimer in chat history

3. **Prescription Fetch Timing**
   - What we know: CONTEXT.md says "caller decides async boundary" for prescriptions
   - What's unclear: Whether Phase 2 AlertSystem fetches on mount, on patient change, or on draft change
   - Recommendation: Defer to Phase 2 planner; `buildDossierContext` is pure and accepts prescriptions as parameter, so timing is caller's responsibility

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Jest 29 (react-scripts 5.0.1 default) |
| Config file | None - CRA default configuration |
| Quick run command | `npm test -- --testPathPattern="buildDossierContext|callClaudeChat" --watchAll=false` |
| Full suite command | `npm test -- --watchAll=false` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SAFE-01 | `buildDossierContext()` assembles correct dossier string | unit | `npm test -- --testPathPattern="buildDossierContext" --watchAll=false` | Wave 0 |
| SAFE-01 | Correct handling of empty prescriptions | unit | `npm test -- --testPathPattern="buildDossierContext" --watchAll=false` | Wave 0 |
| SAFE-01 | Correct handling of missing vitals | unit | `npm test -- --testPathPattern="buildDossierContext" --watchAll=false` | Wave 0 |
| SAFE-01 | French language output verified | unit | `npm test -- --testPathPattern="buildDossierContext" --watchAll=false` | Wave 0 |
| SAFE-02 | Disclaimer present in Claude response | unit | `npm test -- --testPathPattern="callClaudeChat" --watchAll=false` | Wave 0 |
| SAFE-02 | Disclaimer enforcement when Claude omits | unit | `npm test -- --testPathPattern="callClaudeChat" --watchAll=false` | Wave 0 |

### Sampling Rate

- **Per task commit:** `npm test -- --testPathPattern="[relevant-test]" --watchAll=false`
- **Per wave merge:** `npm test -- --watchAll=false`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `src/__tests__/buildDossierContext.test.js` - unit tests for SAFE-01
- [ ] `src/__tests__/callClaudeChat.test.js` - unit tests for SAFE-02 with mocked fetch
- [ ] Mock for `/api/claude` endpoint in tests (MSW or jest-fetch-mock)

*(If no gaps: "None - existing test infrastructure covers all phase requirements")*

---

## Sources

### Primary (HIGH confidence)

- **Direct codebase inspection:** `src/SmartUX_AI_Bots.jsx`, `src/database.js`, `server.js`, `package.json` - all stack constraints, existing patterns, data structures
- **CONTEXT.md locked decisions:** User-verified requirements for dossier format, data sources, implementation constraints
- **CONTEXT.md code_context:** Existing `parseWithClaude()` pattern (line 149-182), database structures, fetch patterns

### Secondary (MEDIUM confidence)

- **SUMMARY.md research findings:** Alert fatigue statistics (JAMIA), RGPD/PHI compliance requirements, architecture patterns
- **Claude prompting best practices:** `https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices` - system prompt structure, output formatting

### Tertiary (LOW confidence - validation recommended)

- None - all findings verified against primary or secondary sources

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Direct codebase inspection of package.json and server.js
- Architecture: HIGH - Locked decisions in CONTEXT.md and proven patterns in existing code
- Pitfalls: HIGH - Cross-referenced with JAMIA research in SUMMARY.md and CONTEXT.md constraints

**Research date:** 2026-03-06
**Valid until:** 60 days (stable React/Express patterns, Groq API may evolve)