# Architecture Research

**Domain:** Clinical chatbot embedded in single-component React prescription interface
**Researched:** 2026-03-05
**Confidence:** HIGH (based on direct codebase analysis + verified React patterns)

---

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SmartUXBots (root component)                        │
│   State: authenticatedUser, activeTab, activeSubTab, prescriptions[]        │
├──────────────┬──────────────────────────────────┬───────────────────────────┤
│   Top Bar /  │        Main Content Area          │   (future) Chat overlay   │
│   Nav Tabs   │                                   │                           │
│              │  ┌──────────────┐  ┌───────────┐  │  ┌─────────────────────┐ │
│              │  │   NLPBot     │  │  RxTab    │  │  │    ChatPanel        │ │
│              │  │  (NLP +      │  │ (rx list, │  │  │  (free-form Q&A     │ │
│              │  │   voice)     │  │  validate)│  │  │   + history)        │ │
│              │  └──────┬───────┘  └─────┬─────┘  │  └─────────┬───────────┘ │
│              │         │                │        │            │             │
│              │  ┌──────▼───────────────▼──────┐  │  ┌─────────▼───────────┐ │
│              │  │    AlertSystem              │  │  │  buildDossierCtx()  │ │
│              │  │  (watches drafting state,   │  │  │  (pure fn: patient  │ │
│              │  │   fires on drug change)     │  │  │   → structured str) │ │
│              │  └──────────────┬──────────────┘  │  └─────────┬───────────┘ │
│              └─────────────────┼─────────────────┘            │             │
├─────────────────────────────────┼──────────────────────────────┼─────────────┤
│                   Claude API (localhost:3001/api/claude)        │             │
│              POST { model, max_tokens, messages: [{system}, …]} │             │
│              Response: data.content[0].text                    │             │
└────────────────────────────────────────────────────────────────┘─────────────┘
```

### Component Responsibilities

| Component | Responsibility | Implementation |
|-----------|---------------|----------------|
| `SmartUXBots` | Root shell; owns global state: `authenticatedUser`, `prescriptions[]`, active tab | Existing root component — do not restructure |
| `NLPBot` | NLP prescription drafting; existing `history[]` state; calls Claude for parsing | Existing — receives `onPrescription` callback |
| `AlertSystem` | Watches `currentDraft` (drug being typed), fires Claude for interaction/allergy/dosage analysis | New — receives `patient` and `draft` as props; returns alert objects |
| `ChatPanel` | Free-form clinical Q&A; owns its own `chatMessages[]` and `chatInput`; calls Claude with dossier system prompt | New — receives `patient` as prop |
| `buildDossierContext()` | Pure function — assembles patient dossier (allergies, meds, obs, vitals, imagerie) into a structured string suitable for Claude system prompt | New utility function — no React hooks |
| `DossierPanel` | Existing patient record viewer — unchanged | Existing |
| `RxTab` | Existing prescription list with validate/cancel — unchanged | Existing |

---

## Recommended Project Structure

All new code stays within or alongside `SmartUX_AI_Bots.jsx` to match the project constraint (no new files unless necessary). The logical grouping within the single file should follow this order:

```
SmartUX_AI_Bots.jsx
├── CONSTANTS & COLORS          (existing)
├── PURE UTILITY FUNCTIONS      (existing + new)
│   ├── autoCorrect()
│   ├── detectAllergyConflict()
│   ├── mapNLPToPrescription()
│   ├── parseDelay()
│   ├── parseWithClaude()        ← existing NLP call
│   ├── buildDossierContext()    ← NEW: patient → prompt string
│   └── callClaudeChat()         ← NEW: wrapper for chat/alert Claude calls
├── SHARED UI ATOMS             (existing: Badge, Btn, Icon, LiveClock)
├── SUB-COMPONENTS              (existing + new)
│   ├── AutocompleteInput        (existing)
│   ├── AlertSystem              ← NEW
│   ├── ChatPanel                ← NEW
│   ├── DossierPanel             (existing)
│   ├── ImageriePanel            (existing)
│   ├── ObservationsPanel        (existing)
│   └── ParametresPanel          (existing)
├── TAB CONFIG                  (existing)
└── ROOT COMPONENT: SmartUXBots (existing — add selectedPatientId state here)
        └── NLPBot               (existing — add AlertSystem + ChatPanel inside)
```

### Structure Rationale

- **Single-file approach:** The project constraint requires keeping new code in `SmartUX_AI_Bots.jsx`. Splitting into separate files is architecturally sound but would require CRA import wiring — defer until explicitly requested.
- **New functions before new components:** `buildDossierContext()` and `callClaudeChat()` are pure/async utilities with no JSX — place them in the utility section alongside existing `parseWithClaude()` for consistency.
- **AlertSystem before ChatPanel:** AlertSystem is simpler (no message history) and shares the `buildDossierContext()` dependency, so build it first.

---

## Architectural Patterns

### Pattern 1: Selected Patient as Shared Pivot State

**What:** The root `SmartUXBots` component adds a `selectedPatientId` state. When the doctor selects a patient (either from the DossierPanel or via NLP resolution), this ID propagates as a prop to `AlertSystem` and `ChatPanel`. Both components derive the full patient object by looking up `DB_PATIENTS`, `KNOWN_ALLERGIES`, `DB_CONSTANTES`, `DB_OBSERVATIONS`, and `DB_MEDICAMENTS` at call time.

**When to use:** Any time two or more components need to act on the same patient record simultaneously. Lifting to root avoids prop drilling through NLPBot.

**Trade-offs:** Adds one `useState` to root. The alternative (each component tracking its own selected patient) creates desync bugs where AlertSystem and ChatPanel could show different patients.

**Example:**
```jsx
// In SmartUXBots root
const [selectedPatientId, setSelectedPatientId] = useState(null);

// NLPBot resolves patient from NLP, calls this
// DossierPanel patient-click button calls this
// ChatPanel and AlertSystem receive the derived patient object
const selectedPatient = DB_PATIENTS.find(p => p.patient_id === selectedPatientId) || null;
```

---

### Pattern 2: useReducer for ChatPanel Message State

**What:** `ChatPanel` uses `useReducer` instead of `useState` for its message list. The reducer handles actions: `ADD_USER_MSG`, `ADD_BOT_MSG`, `SET_LOADING`, `CLEAR`.

**When to use:** When state has 3+ interdependent fields that change together. Chat state has `messages[]`, `isLoading`, and `error` — all change as a coordinated unit on each send/receive cycle.

**Trade-offs:** Slightly more boilerplate than `useState`. Pays off immediately because you can dispatch `SET_LOADING` and `ADD_BOT_MSG` atomically without stale-closure bugs that bite `useState` in async callbacks.

**Do not use useReducer for AlertSystem** — it only has `alerts[]` and `isChecking` which can stay as two `useState` calls. The chat is the only place with enough state transitions to warrant a reducer.

**Example:**
```jsx
const chatReducer = (state, action) => {
  switch (action.type) {
    case 'ADD_USER_MSG':
      return { ...state, messages: [...state.messages, { role: 'user', content: action.text, ts: Date.now() }] };
    case 'SET_LOADING':
      return { ...state, isLoading: action.value };
    case 'ADD_BOT_MSG':
      return { ...state, messages: [...state.messages, { role: 'assistant', content: action.text, ts: Date.now() }], isLoading: false };
    case 'CLEAR':
      return { messages: [], isLoading: false, error: null };
    default:
      return state;
  }
};

function ChatPanel({ patient }) {
  const [state, dispatch] = useReducer(chatReducer, { messages: [], isLoading: false, error: null });
  // ...
}
```

---

### Pattern 3: Pure Function Dossier Context Builder

**What:** `buildDossierContext(patient)` is a plain JavaScript function (no hooks, no JSX) that receives a patient object and returns a formatted string. It looks up `KNOWN_ALLERGIES`, `DB_CONSTANTES`, `DB_OBSERVATIONS`, and `DB_MEDICAMENTS` directly from `database.js` imports. The output is injected as the `system` message in every Claude call from `ChatPanel` and `AlertSystem`.

**When to use:** Every time you call Claude with patient context. Centralising this in one function means both ChatPanel and AlertSystem produce consistent prompts, and the format can be changed in one place.

**Trade-offs:** None meaningful. The alternative — building the prompt string inline inside each component — leads to drift between the chat prompt and the alert prompt over time.

**Example:**
```jsx
function buildDossierContext(patient) {
  if (!patient) return "Aucun patient sélectionné.";

  const age = new Date().getFullYear() - new Date(patient.date_of_birth).getFullYear();
  const allergies = KNOWN_ALLERGIES[patient.patient_id] || [];
  const constantes = DB_CONSTANTES
    .filter(c => c.patient_id === patient.patient_id)
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 3);
  const observations = DB_OBSERVATIONS
    .filter(o => o.patient_id === patient.patient_id)
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 3);

  return `
PATIENT : ${patient.first_name} ${patient.last_name}, ${age} ans, ${patient.gender === 'F' ? 'Femme' : 'Homme'}, Groupe ${patient.blood_type}
SERVICE : ${patient.ward}, Chambre ${patient.room}
ALLERGIES CONNUES : ${allergies.length > 0 ? allergies.join(', ') : 'Aucune connue'}
CONSTANTES RÉCENTES :
${constantes.map(c => `  [${new Date(c.date).toLocaleDateString('fr-FR')}] TA:${c.ta} FC:${c.fc}bpm Temp:${c.temp}°C SpO2:${c.spo2}% Poids:${c.poids}kg`).join('\n')}
NOTES CLINIQUES :
${observations.map(o => `  [${o.category}] ${o.author}: ${o.text.slice(0, 200)}`).join('\n')}
  `.trim();
}
```

---

### Pattern 4: AlertSystem Triggered by useEffect on Draft Change

**What:** `AlertSystem` is a component rendered inside `NLPBot` that watches a `currentDraft` prop (the drug/dose/patient being assembled by NLP). When `currentDraft` changes and a patient is selected, a `useEffect` fires a debounced Claude call to analyse the draft for allergy conflicts, drug interactions, and dosage concerns.

**When to use:** Whenever the prescription draft state changes in a way that might introduce a safety concern. The alert check runs automatically — no doctor action needed.

**Trade-offs:** Every draft change triggers an LLM call after the debounce window. Set debounce at 1500ms to avoid hammering the proxy during fast typing. On slow networks, alerts may arrive after the doctor has already clicked validate — this is acceptable (defence in depth, not sole gate).

**Debounce is required** — do not fire on every keystroke. The existing `parseWithClaude()` call already blocks typing while loading; AlertSystem must be non-blocking and fire independently.

**Example:**
```jsx
function AlertSystem({ patient, currentDraft }) {
  const [alerts, setAlerts] = useState([]);
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    if (!patient || !currentDraft?.drug_name_free) return;
    const timer = setTimeout(async () => {
      setIsChecking(true);
      const systemPrompt = `Tu es un système d'alerte médicale. Analyse si ce médicament est sûr pour ce patient.
${buildDossierContext(patient)}
Réponds avec un JSON : { alerts: [{ severity: 'critical|warning|info', message: string }] }`;
      const result = await callClaudeChat(systemPrompt, `Médicament prescrit : ${currentDraft.drug_name_free} ${currentDraft.dosage || ''}`);
      // parse result.alerts and setAlerts
      setIsChecking(false);
    }, 1500);
    return () => clearTimeout(timer);
  }, [patient, currentDraft?.drug_name_free, currentDraft?.dosage]);
  // ...
}
```

---

## Data Flow

### Patient Selection → Dossier Context → Claude Prompt

```
Doctor selects patient (DossierPanel click OR NLP resolves patient name)
    │
    ▼
setSelectedPatientId(id)     [in SmartUXBots root]
    │
    ▼
selectedPatient = DB_PATIENTS.find(p => p.patient_id === id)
    │
    ├──► passed as prop to ChatPanel
    │         │
    │         ▼
    │    buildDossierContext(selectedPatient)
    │         │  → string with allergies, constantes, obs
    │         ▼
    │    Claude API call
    │    messages: [
    │      { role: 'system', content: dossierString },
    │      ...chatHistory,
    │      { role: 'user', content: doctorQuestion }
    │    ]
    │
    └──► passed as prop to AlertSystem
              │
              ▼
         useEffect watches currentDraft
              │  (debounced 1500ms)
              ▼
         buildDossierContext(selectedPatient)
              │
              ▼
         Claude API call (alert check)
              │
              ▼
         setAlerts([{ severity, message }])
              │
              ▼
         Alert badges rendered inline in NLPBot prescription draft view
```

### Free-Form Chat Data Flow

```
Doctor types question in ChatPanel
    │
    ▼
dispatch({ type: 'ADD_USER_MSG', text: question })
dispatch({ type: 'SET_LOADING', value: true })
    │
    ▼
callClaudeChat(
  system: buildDossierContext(patient),
  messages: [...state.messages, { role:'user', content: question }]
)
    │
    ▼
Claude response arrives
    │
    ▼
dispatch({ type: 'ADD_BOT_MSG', text: response })
    │
    ▼
ChatPanel renders new message bubble
```

### NLP Prescription Draft State (existing, extended for alerts)

```
Doctor types NLP phrase → NLPBot.send()
    │
    ▼
parseWithClaude(text) → structured JSON
    │
    ▼
mapNLPToPrescription(json, text) → rx object    ← THIS IS currentDraft
    │
    ├──► AlertSystem receives rx as currentDraft prop
    │         └──► debounced alert check fires
    │
    └──► NLPBot history[] updated with rx card
              └──► existing allergy badge (detectAllergyConflict) still shown
```

### State Management Decision Summary

| State | Location | Hook | Rationale |
|-------|----------|------|-----------|
| `authenticatedUser` | `SmartUXBots` root | `useState` | Single boolean-like object, rarely changes |
| `prescriptions[]` | `SmartUXBots` root | `useState` | Shared between NLPBot and RxTab — must live at root |
| `selectedPatientId` | `SmartUXBots` root | `useState` | Shared between AlertSystem and ChatPanel — must lift to root |
| `chatMessages[]`, `isLoading`, `error` | `ChatPanel` | `useReducer` | Interdependent fields that change as a unit |
| `alerts[]`, `isChecking` | `AlertSystem` | `useState` (×2) | Two independent fields, simple transitions |
| `history[]` (NLP) | `NLPBot` | `useState` | Existing — do not change |

---

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| Current (demo, 6 patients, 1 user) | Single file, inline styles, static DB arrays — perfectly adequate |
| Small hospital pilot (10–50 users, real patient data) | Extract `buildDossierContext()` and Claude call wrappers into a `services/` folder; replace static DB with REST API calls; add AbortController to cancel in-flight Claude requests on patient switch |
| Production (real-time data, concurrent users) | Move Claude calls server-side (avoid exposing proxy to browser); add response streaming; consider Zustand or React Context for shared patient state if component tree deepens |

### Scaling Priorities

1. **First bottleneck — proxy call latency:** AlertSystem fires on every draft change. At demo scale this is fine. At pilot scale, cache the alert result keyed on `(patientId, drugName, dosage)` in `useMemo` or a `useRef` Map to avoid re-checking the same drug for the same patient in the same session.
2. **Second bottleneck — single file size:** The file is already ~37KB. Adding ChatPanel and AlertSystem will push it to ~55KB. This is still manageable for CRA (compiled, not raw). Split into separate files when the team grows or linting becomes a pain.

---

## Anti-Patterns

### Anti-Pattern 1: Building Dossier Context Inline in Each Component

**What people do:** Write the `buildDossierContext` string ad-hoc inside `ChatPanel` and again inside `AlertSystem`, tailored to each component's immediate need.

**Why it's wrong:** The two prompts diverge. AlertSystem starts seeing different patient data than ChatPanel. When you add a new database (e.g., `DB_MEDICAMENTS` for current medications), you update it in one place and forget the other. Security review becomes harder — you cannot audit "what does Claude see about the patient" in a single place.

**Do this instead:** Single `buildDossierContext(patient)` pure function used by both. Extend it once when new data sources are added.

---

### Anti-Pattern 2: Firing Alert Checks on Every Keystroke Without Debounce

**What people do:** Put `callClaudeChat()` directly in the `useEffect` with `currentDraft` as dependency, no debounce.

**Why it's wrong:** A doctor typing "Amoxicilline 500mg" fires 15 Claude API calls before finishing the word. The proxy gets hammered, the UI flickers with stale alerts, and the last alert to arrive (not the last fired) wins due to race conditions.

**Do this instead:** Debounce with `setTimeout`/`clearTimeout` inside `useEffect` (1000–1500ms). Cancel the previous timer on every dependency change. Optionally track a request ID to discard stale responses.

---

### Anti-Pattern 3: Placing ChatPanel State in the Root Component

**What people do:** Add `chatMessages`, `chatInput`, and `chatLoading` to `SmartUXBots` root state alongside `prescriptions` and `authenticatedUser`.

**Why it's wrong:** Root state re-renders the entire tree on every chat message. The prescription list, dossier panel, and top bar all re-render every time the doctor types in the chat. This causes visible lag and makes the component unmanageable.

**Do this instead:** `ChatPanel` owns its own state entirely. The only prop it receives from root is `patient` (the derived patient object from `selectedPatientId`). Chat history is local to ChatPanel and resets when the patient changes — which is the correct clinical behaviour (per-patient-per-session).

---

### Anti-Pattern 4: Treating the Existing `detectAllergyConflict()` as Sufficient

**What people do:** Assume the existing basic allergy check in `mapNLPToPrescription` covers the safety requirement and skip `AlertSystem`.

**Why it's wrong:** `detectAllergyConflict()` only checks the drug name string against `KNOWN_ALLERGIES` using substring matching. It cannot detect: (a) cross-reactivity between drug classes (e.g., cephalosporin allergy in a penicillin-allergic patient), (b) interactions with the patient's current medications from prescriptions list, (c) contraindications based on diagnosis or vitals. Claude's reasoning covers all three given the dossier context.

**Do this instead:** Keep `detectAllergyConflict()` as a fast synchronous pre-check that flags immediately (zero latency). Run AlertSystem's Claude-based check in parallel as the authoritative deep check. Both results render — one immediately, one after the LLM responds.

---

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Claude via localhost:3001 | POST `{ model, max_tokens, messages }` — existing `parseWithClaude()` pattern | New `callClaudeChat(systemPrompt, userMsg, history)` function wraps the same endpoint. Add `system` as first message with role `user` and `\n\nHuman:` prefix, or use the `system` top-level parameter if the proxy supports Anthropic Messages API format |
| DB_CONSTANTES, DB_OBSERVATIONS, DB_IMAGERIE | Direct import from `./database` — already imported in the file | `buildDossierContext()` uses these directly — no new imports needed |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `SmartUXBots` → `ChatPanel` | Props: `patient` (object) | ChatPanel must receive the full patient object, not just the ID, to avoid re-lookup |
| `SmartUXBots` → `AlertSystem` | Props: `patient` (object), `currentDraft` (rx object or null) | AlertSystem is controlled entirely by props; no callbacks up to root |
| `NLPBot` → `AlertSystem` | `currentDraft` prop — the most recently parsed rx from NLP | AlertSystem renders inside NLPBot, receiving the rx from NLPBot's local state |
| `NLPBot` → `SmartUXBots` | Existing `onPrescription` callback — unchanged | Add `onPatientResolved(patientId)` callback to surface the resolved patient upward when NLP maps a prescription to a known patient |

---

## Suggested Build Order

Based on dependency analysis, build in this sequence:

1. **`buildDossierContext(patient)`** — Pure function, zero risk, no UI. Validates that all the required data from `database.js` is accessible and formats cleanly. Required by steps 2 and 3.

2. **`callClaudeChat(systemPrompt, userMessage, history?)`** — Thin async wrapper around the existing `localhost:3001/api/claude` endpoint. Validates the proxy supports a `system`-like prompt pattern. Required by steps 3 and 4.

3. **`AlertSystem` component** — Simplest interactive component (no message history). Proves the dossier context builder and Claude call wrapper work end to end. Builds doctor confidence in real-time safety feedback before free-form chat is available.

4. **Patient selection wiring** — Add `selectedPatientId` to root, wire `onPatientResolved` callback from `NLPBot`, and add a "Sélectionner" button in `DossierPanel`. This unlocks both AlertSystem and ChatPanel.

5. **`ChatPanel` component** — Most complex (useReducer, scrolling, history, system prompt). Build last so the dossier context and Claude wrapper are already proven.

---

## Sources

- Direct codebase analysis: `/Users/neylesso/UX/smartux-ai/src/SmartUX_AI_Bots.jsx` (root state, NLPBot, tab routing, existing Claude call pattern)
- Direct data analysis: `/Users/neylesso/UX/smartux-ai/src/database.js` (DB_PATIENTS, DB_CONSTANTES, DB_OBSERVATIONS, KNOWN_ALLERGIES, DB_MEDICAMENTS schemas)
- React official docs — [You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect) — guidance on when useEffect is correct for derived async side effects
- useReducer vs useState — [Robin Wieruch](https://www.robinwieruch.de/react-usereducer-vs-usestate/) and [Kent C. Dodds](https://kentcdodds.com/blog/should-i-usestate-or-usereducer) — arrays with interdependent transitions favour useReducer
- Clinical chatbot architecture — [Nature Scientific Reports: ChatGPT for clinical decision support](https://www.nature.com/articles/s41598-025-22784-8) — confirms system-prompt-level patient context injection as standard pattern for LLM-based CDS

---

*Architecture research for: SmartUX-AI (SILLAGE) — clinical chatbot integration*
*Researched: 2026-03-05*
