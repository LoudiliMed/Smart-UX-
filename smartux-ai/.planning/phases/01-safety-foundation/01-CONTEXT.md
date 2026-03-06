# Phase 1: Safety Foundation - Context

**Gathered:** 2026-03-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Build `buildDossierContext(patient)` and `callClaudeChat()` — the shared infrastructure that all clinical safety checks in Phases 2 and 3 depend on. Patient context assembled correctly, Claude callable with the right prompts, every AI response carrying the required disclaimer.

</domain>

<decisions>
## Implementation Decisions

### Current medications source
- Pull from `/api/prescriptions` (the existing Express backend endpoint)
- Filter client-side by `patient_id` — no backend changes needed, reuses existing fetch pattern
- Include all prescriptions (full history, no date cutoff) — Claude reasons about recency from dates
- Format per entry: drug name + dose + route (e.g. "Amoxicilline 1g per os")
- Empty state: include explicit "Aucun traitement en cours" so Claude knows absence is confirmed, not unknown

### Dossier string format
- Clinical narrative prose in French — not labeled sections, not JSON
- Header line: **DEPARTURE FROM ORIGINAL DECISION** — tokenized H-{id} format confirmed in Task 0 checkpoint (option-b), DPA not yet confirmed for this hospital. Original locked decision was full name + IPP ("Patient : Jean Dupont (IPP-000001), 70 ans, ..."); that decision is overridden pending DPA. Actual format: `Patient H-${patient_id}, ${age} ans, ${ward}, chambre ${room}`. To restore full name once DPA is signed, update the `buildDossierContext` header line in SmartUX_AI_Bots.jsx (see PHI NOTE comment in that function).
- Vitals: most recent DB_CONSTANTES entry only (TA, FC, temp, SpO2, poids) — current state, no trend history
- Clinical notes: most recent DB_OBSERVATIONS entry only — current picture without full admission history
- Allergies inline from KNOWN_ALLERGIES (omit section or note "Aucune allergie connue" if empty)
- Current meds inline using the format decided above

### Claude's Discretion
- Alert response structure — how `callClaudeChat()` formats severity-tiered output (JSON array vs structured text) left to planner
- Disclaimer placement — whether SAFE-02 text is enforced via system prompt instruction, appended by the JS wrapper, or rendered by the UI left to planner
- System prompt wording for alert-mode and chat-mode
- Order of sections within the narrative

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches for disclaimer and alert formatting.

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `parseWithClaude()` (SmartUX_AI_Bots.jsx:151): existing pattern for POST to `/api/claude` with `{ model, max_tokens, messages }` — `callClaudeChat()` should follow the same fetch shape
- `KNOWN_ALLERGIES` (database.js:106): sparse map `{ patient_id: [string] }` — only patients 2 and 3 have entries; others return `[]`
- `DB_CONSTANTES` (database.js:162): 3 entries per patient; sort by `date` descending and take index 0 for most recent
- `DB_OBSERVATIONS` (database.js:138): same pattern — most recent by date
- `DB_PATIENTS` (database.js:5): has `date_of_birth` — compute age with `new Date()` diff

### Established Patterns
- Claude model in use: `claude-sonnet-4-5` (matches existing codebase)
- Claude API format: POST `/api/claude` → `data.content[0].text`
- All user-facing strings in French (fr-FR)
- Prescriptions endpoint: `fetch("http://localhost:3001/api/prescriptions")` — already used at line 998

### Integration Points
- `buildDossierContext(patient)` will need the prescriptions array passed in (or fetched inside) — caller decides async boundary
- `callClaudeChat()` sits between the dossier builder and Phases 2/3 consumers — must accept a dossier string + a drug name (alert-mode) or a free-form question (chat-mode)
- All new code within `SmartUX_AI_Bots.jsx` per project convention

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 01-safety-foundation*
*Context gathered: 2026-03-06*
