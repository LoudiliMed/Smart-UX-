# Project Research Summary

**Project:** SmartUX-AI — Clinical Drug Safety Chatbot (SILLAGE)
**Domain:** LLM-powered clinical decision support embedded in hospital prescription workflow
**Researched:** 2026-03-05
**Confidence:** HIGH

## Executive Summary

SmartUX-AI is a clinical decision support (CDS) chatbot added as a sub-component to an existing React-based hospital prescription interface (SILLAGE). The product's core value is preventing prescribing errors by surfacing drug-allergy conflicts, drug-drug interactions (DDI), contraindications, and dosage warnings at the exact moment a doctor drafts a prescription — without interrupting their workflow. The recommended approach is LLM-based contextual reasoning (Groq `llama-3.3-70b-versatile` via the existing proxy) over a structured patient dossier built from the application's static in-memory data (`DB_PATIENTS`, `KNOWN_ALLERGIES`, `DB_MEDICAMENTS`, `DB_CONSTANTES`, `DB_OBSERVATIONS`). No external drug databases are needed; patient-specific reasoning from Claude/Groq over structured data is more contextually accurate and already within scope. All new code lives inside the existing `SmartUX_AI_Bots.jsx` monolith, using inline styles and no new frontend dependencies.

The highest-value architectural decision is the `buildDossierContext()` pure function: a single, centralized patient context builder that feeds both the `AlertSystem` (proactive prescription-time checks) and the `ChatPanel` (free-form clinical Q&A). Two distinct interaction modes — auto-alert on prescription change and on-demand chat — must be kept visually separate and architecturally decoupled. State management follows the existing React hooks pattern: `selectedPatientId` lifts to root, `useReducer` inside `ChatPanel` for complex message state, and `useState` pairs inside `AlertSystem`. A new `/api/claude-stream` Express route with Groq SDK streaming is the path to sub-second perceived latency but is optional for v1.

The single greatest risk to this product is alert fatigue: if Claude generates too many low-relevance warnings, doctors will dismiss every alert reflexively — including critical ones. Research documents override rates up to 96% in rule-based CDSS systems; LLM-based systems amplify this risk if prompts are not calibrated to suppress low-severity findings. The RGPD/PHI compliance risk is a pre-development blocker: patient-identifying data (name, DOB, diagnoses) cannot be sent to the Claude API until a Data Processing Agreement is confirmed with Anthropic and a prompt-level anonymization layer is in place. These two risks must be addressed before any UI is built.

---

## Key Findings

### Recommended Stack

The existing codebase dictates the stack: React 19 (CRA), Express 5, better-sqlite3, and the existing Claude-wrapping proxy at `localhost:3001`. No frontend dependencies should be added. The only new install is `groq-sdk` on the server side to enable streaming. Everything else — `fetch` + `ReadableStream` for SSE consumption, `useState`/`useReducer`/`useRef`/`useMemo` for chat UI — is already available.

**Core technologies:**
- React hooks (`useState`, `useReducer`, `useRef`, `useMemo`, `useEffect`): chat UI state and streaming buffer — already in use throughout the file; zero install cost
- Native `fetch` + `ReadableStream`: SSE streaming consumption from the new proxy route — browser-native, no polyfill needed; supports POST (required to send patient payload)
- Express `res.write()` SSE pattern: new `/api/claude-stream` route — Express already installed; adds one route to `server.js`
- `groq-sdk` (server-only): Groq streaming via `stream: true` — only new install; not bundled into the React app
- Inline style objects: all chat panel styling — matches existing code convention; no build tool changes

**What NOT to use:** `@ai-sdk/react`, `react-query`, `EventSource`, any chat UI library, `react-markdown`, `WebSocket`, or separate React component files. All of these either conflict with the no-new-deps constraint or require architectural changes the project explicitly rules out.

### Expected Features

The feature research distinguishes clearly between table stakes (safety value proposition depends on these), differentiators (what makes this better than rule-based CDSS), and anti-features (sound good, make safety worse).

**Must have (table stakes — v1):**
- Patient dossier context injection — foundation of every safety feature; without it all checks are generic and clinically useless
- Proactive auto-alert at prescription draft time — fires when drug is added/changed; checks allergy + DDI + contraindication + dosage in one call
- Alert severity tier display (CRITIQUE / MODERE / FAIBLE) — non-negotiable; identical-looking alerts create fatigue that inverts safety
- French-language clinical explanations with mechanism + alternative suggestion — doctors read these; terse rule codes do not get read
- Free-form clinical Q&A chat panel — doctors ask follow-up questions; this is what differentiates from a rule engine
- Alert dismissal without forced justification (CRITIQUE tier excepted) — mandatory justification on every alert is documented to destroy adoption
- Patient identity header on every alert — trust collapses if context is ever ambiguous

**Should have (differentiators — v1.x after validation):**
- Patient-specific dose calculation reasoning (using actual weight, CrCl from `DB_CONSTANTES`)
- Silent dismissal logging (prerequisite for any audit trail)
- Refined alternative drug suggestions (extends `DB_MEDICAMENTS` with therapeutic class data)

**Defer to v2+:**
- Temporal medication reasoning (washout periods, recently stopped drugs)
- Override audit dashboard (non-trivial persistence, out of scope for v1)
- Multi-turn memory across sessions (RGPD complexity, not needed for safety)

**Documented anti-features to avoid:**
- Mandatory override justification on all alerts (proven to invert safety; use only for CRITIQUE)
- Autonomous prescription blocking (regulatory risk; doctor must retain decision authority)
- External drug interaction API (runtime dependency, latency, not patient-specific)
- Numerical confidence scores on alerts (research shows they cause both overreliance and dismissal)
- Cross-patient chat context (RGPD violation vector, wrong-patient error risk)

### Architecture Approach

All new code is added within `SmartUX_AI_Bots.jsx` following the existing single-file convention. Three new elements are introduced: a `buildDossierContext(patient)` pure utility function (placed alongside existing `parseWithClaude()`), an `AlertSystem` component (rendered inside `NLPBot`, watches `currentDraft` via `useEffect` with 1500ms debounce), and a `ChatPanel` component (receives only the `patient` prop from root, owns all its state via `useReducer`). A single new state atom, `selectedPatientId`, lifts to the root `SmartUXBots` component and is the shared pivot for both new components.

**Major components:**
1. `buildDossierContext(patient)` — pure function: assembles allergies, active meds, vitals, diagnoses into a structured French-language string for Claude's system prompt; used by both `AlertSystem` and `ChatPanel`; single source of truth for what Claude sees about any patient
2. `AlertSystem` — watches `currentDraft` prop, fires debounced Claude safety check on drug/dose change, renders severity-tiered alert badges inline in the prescription form; no message history
3. `ChatPanel` — doctor-initiated free-form Q&A; owns `useReducer` state for messages/loading/error; receives `patient` prop only; clears on patient switch; isolated from root re-renders
4. `callClaudeChat(systemPrompt, userMsg, history?)` — thin async wrapper around the existing proxy endpoint; shared by both components
5. `/api/claude-stream` (server.js) — new Express SSE route using `groq-sdk` with `stream: true`; optional for v1 but required for acceptable latency UX

**Build order mandated by dependencies:** `buildDossierContext` → `callClaudeChat` → `AlertSystem` → patient selection wiring → `ChatPanel`

### Critical Pitfalls

1. **Alert fatigue (override rates up to 96% documented)** — Constrain Claude prompts to surface only CRITICAL and MODERATE findings; suppress INFO-level by default; cap auto-alerts at 2-3 per prescription attempt; track override rates during testing and reclassify any alert dismissed >70% of the time. This must be addressed in Phase 1 prompt design, not retrofitted post-launch.

2. **RGPD/PHI compliance — pre-development blocker** — Verify Anthropic DPA before writing any code that sends patient data to the API. Apply data minimization: replace patient name and DOB with anonymized tokens in prompts (e.g., "Patient H-4821, âge 67 ans"). Add a sanitization layer in the proxy. Log what is sent for CNIL auditability. A RGPD violation discovered in production requires immediate feature halt and 72-hour CNIL notification.

3. **AI hallucination of drug interactions (15-40% hallucination rate on clinical tasks)** — Never present Claude's output as definitive. Require every AI-generated warning to display "Analyse assistée par IA — vérification clinique recommandée." Run deterministic `detectAllergyConflict()` first; use Claude only as the deep reasoning layer. Instruct Claude to express uncertainty rather than estimate. Test with 20 known interaction pairs and 20 known non-interactions before integration.

4. **Automation bias — doctor follows wrong AI recommendation** — Frame the AI as "assistant de vérification" not "système de validation." Never show a green checkmark or "Prescription validée par IA." Use neutral language: "Aucune interaction identifiée dans les données disponibles — le jugement clinique du prescripteur reste requis." Require explicit acknowledgment (not just dismiss) for CRITIQUE-level warnings.

5. **Cognitive interruption of prescription flow** — Alert checks must be non-blocking and passive. Fire the Claude call on a 1500ms debounce after draft change (not on every keystroke). The alert panel should be invisible when no results exist, not an open pane. Chat panel must be a dismissible drawer, not a persistent open UI during prescription editing. `AlertSystem` and `ChatPanel` must be wrapped in `React.memo` and use `useCallback` on handlers to prevent re-renders from parent state changes.

---

## Implications for Roadmap

Based on combined research findings, four phases are recommended:

### Phase 0: Legal and Infrastructure Checkpoint
**Rationale:** RGPD/PHI compliance is a hard blocker identified in PITFALLS.md. No patient data can flow to the Claude API without a confirmed DPA and prompt-level anonymization. This phase has zero UI deliverables but gates all subsequent phases. Skipping or deferring this creates CNIL exposure and potential production halt.
**Delivers:** Confirmed Anthropic DPA status; prompt anonymization layer (name/DOB replaced with tokens) in the Express proxy; GROQ_API_KEY moved to `.env`; security audit of what PHI is currently sent by the existing NLP call; session context clear on patient switch implemented in state lifecycle
**Addresses:** Pitfall 3 (RGPD/PHI), Pitfall 7 (prompt injection via proxy sanitization), security mistake 1 and 2 from PITFALLS.md
**Note:** This phase may be a rapid checklist if the hospital already has a DPA and the legal basis is established. It should not block development for weeks — but it must produce a documented answer before patient data is sent to any new route.

### Phase 1: Core Safety Foundation (Prompt + Context Builder)
**Rationale:** Every safety feature depends on `buildDossierContext()` and a correctly calibrated Claude prompt. The severity classification schema (CRITIQUE / MODERE / FAIBLE), the forced uncertainty expression, the French-language mandate, and the structured output format must be designed and tested in isolation before any UI is built. Retrofitting prompt design post-UI is architecturally expensive.
**Delivers:** `buildDossierContext(patient)` pure function (verified against all 6 patients in `DB_PATIENTS`); `callClaudeChat()` wrapper; system prompt for the alert mode (Mode 1); system prompt for the chat mode (Mode 2); test suite of 20 known DDI pairs and 20 non-interactions validating severity output; confirmation that responses are in French and structured correctly
**Features addressed (from FEATURES.md):** Patient dossier context injection (P1), severity classification schema (P1), French-language output (P1), disclaimer text embedded in prompt output schema
**Pitfalls avoided:** Alert fatigue (severity calibration), hallucination (uncertainty expression mandated in prompt), context window overload (context builder selects fields rather than serializing full dossier)
**Research flag:** Standard patterns — prompt engineering for medical AI is well-documented; no additional phase research needed, but the 20-interaction test suite must be run to validate output quality

### Phase 2: AlertSystem Component (Proactive Safety Checks)
**Rationale:** `AlertSystem` is simpler than `ChatPanel` (no message history, no useReducer, no scrolling) and proves the core dossier + Claude integration end-to-end. It is the component that directly addresses the primary safety value proposition — proactive warnings at prescription time. It must work before the conversational layer is built.
**Delivers:** `AlertSystem` component rendered inside `NLPBot`; `selectedPatientId` state wired to root `SmartUXBots`; `onPatientResolved` callback from NLP; debounced alert check (1500ms) on `currentDraft` change; severity-tiered alert badges (red/CRITIQUE, orange/MODERE, grey/FAIBLE); dismiss without justification for MODERE/FAIBLE; explicit acknowledgment modal for CRITIQUE; "Analyse assistée par IA" disclaimer on every alert; patient name + ID header on every alert
**Stack used:** React `useState`, `useEffect`, `useCallback`, `React.memo`; existing proxy endpoint (non-streaming acceptable for Phase 2); `buildDossierContext()` and `callClaudeChat()` from Phase 1
**Architecture component implemented:** `AlertSystem`, `buildDossierContext()` integration, `selectedPatientId` in root
**Pitfalls avoided:** Cognitive interruption (debounce + passive panel), alert fatigue (severity classification in UI), automation bias (neutral language, mandatory CRITIQUE acknowledgment)
**Research flag:** Standard patterns — React useEffect debounce and inline conditional rendering are well-documented

### Phase 3: ChatPanel Component (Free-Form Clinical Q&A)
**Rationale:** `ChatPanel` is the most complex component (useReducer, scrolling, multi-turn history, system prompt management). Building it after `AlertSystem` means the context builder and Claude wrapper are already proven in production. The chat panel is a differentiator feature, not a safety table stake — it should be validated after the alert system is trusted by doctors.
**Delivers:** `ChatPanel` component (dismissible drawer, not persistent pane); `useReducer` state (messages, isLoading, error); auto-scroll to latest message; session-scoped multi-turn history (20 message cap); clear on patient switch; Mode 2 prompt (dossier context, no `<prescription_en_cours>`); streaming from `/api/claude-stream` (requires adding `groq-sdk` to server and new Express route); structured response display (one-line summary + expand for detail); "Aucun patient sélectionné" guard state
**Stack used:** `useReducer`, `useRef` (scroll), `useMemo` (context builder), native `fetch` + `ReadableStream` (SSE); `groq-sdk` on server; new `/api/claude-stream` route
**Architecture component implemented:** `ChatPanel`, streaming proxy route, `AbortController` for in-flight request cancellation on patient switch
**Features addressed (from FEATURES.md):** Free-form clinical Q&A (P1), session chat history (P1), contextual follow-up / multi-turn (differentiator)
**Pitfalls avoided:** Context bleed between patients (reset on patient switch), performance re-renders (React.memo + isolated state), prompt injection (proxy input filter)
**Research flag:** Streaming SSE implementation needs validation — the existing proxy does not stream; the new route and client-side `ReadableStream` parsing should be prototyped early in this phase before building the full ChatPanel UI around it

### Phase 4: UX Polish and v1.x Features
**Rationale:** After both core components are functional and doctors have used them, invest in refinements informed by real usage patterns. This phase should not be planned in detail until Phase 3 is complete and feedback is collected.
**Delivers:** Silent dismissal logging (sessionStorage or component state log); patient-specific dose calculation improvements (extend context builder with CrCl, weight reasoning); `DB_MEDICAMENTS` enrichment with active ingredient / DCI mapping; visual polish (response latency UX, loading states); UX review with a clinician or compliance officer; regression test suite for known interactions
**Features addressed (from FEATURES.md):** Patient-specific dose calculation (P2), alternative drug suggestion refinement (P2), silent dismissal logging (P2)
**Research flag:** DB_MEDICAMENTS enrichment strategy (DCI mapping, therapeutic class data) may need research — depends on what data is available and how it can be structured for Claude's reasoning

### Phase Ordering Rationale

- **Phase 0 before any code:** RGPD is a legal blocker, not a feature. Confirmed DPA status and prompt anonymization are prerequisites for sending any patient data to Claude in a hospital context.
- **Prompt design before UI (Phase 1 before Phase 2):** Severity calibration cannot be retrofitted. Alert fatigue is the central failure mode of CDSS; if the prompt produces too many alerts, the entire system is clinically counterproductive. Getting the prompt right first makes every subsequent phase faster and safer.
- **AlertSystem before ChatPanel (Phase 2 before Phase 3):** `AlertSystem` is simpler (no message history), proves the shared infrastructure (`buildDossierContext`, `callClaudeChat`), and delivers the primary safety value proposition. It also gives doctors something to react to before the more complex chat UI is built.
- **Polish after validation (Phase 4 last):** The v1.x features (dose calculation, DCI mapping, dismissal logging) are improvements on a working foundation, not prerequisites for the safety value proposition.

### Research Flags

Phases needing deeper research during planning:
- **Phase 0:** Anthropic DPA/BAA availability for French hospitals — this is a factual question that requires direct inquiry to Anthropic sales/legal, not internet research. Block this out as a task, not a research sprint.
- **Phase 3:** SSE streaming implementation validation — the new `/api/claude-stream` route and client-side `ReadableStream` parsing should be prototyped in isolation (a minimal test file) before building the full `ChatPanel` around it. Streaming behavior with the Groq SDK may have edge cases (chunk boundaries, error recovery) that are best discovered early.

Phases with standard patterns (skip research-phase):
- **Phase 1:** Prompt engineering for medical AI is well-documented. The SILLAGE-IA system prompt structure (XML tags, role, rules, output schema) follows Anthropic's official best practices exactly. No additional research needed — execute and test.
- **Phase 2:** React `useEffect` debounce patterns, severity-tiered inline alert UI, and `React.memo` optimization are all standard. Well-documented community patterns apply directly.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Direct codebase inspection; all constraints verified against package.json, server.js, and SmartUX_AI_Bots.jsx; Groq and Claude API docs consulted directly |
| Features | HIGH (table stakes), MEDIUM (differentiators) | Table stakes grounded in peer-reviewed CDSS literature (JAMIA, PMC); differentiator quality depends on Claude reasoning quality, which varies by prompt calibration |
| Architecture | HIGH | Based on direct codebase analysis; build order and state management decisions grounded in verified React patterns and Nature/JAMIA clinical chatbot architecture references |
| Pitfalls | HIGH | All critical pitfalls cross-referenced against multiple peer-reviewed sources (medRxiv 2025, JAMIA systematic reviews, CNIL official guidance, OWASP LLM01) |

**Overall confidence:** HIGH

### Gaps to Address

- **Anthropic DPA status:** Whether Anthropic has signed a DPA with the hospital (or offers one compatible with French health law) is unknown. This must be answered before Phase 1 begins. If no DPA exists, the architecture must be redesigned to send only anonymized tokens — or the backend must be self-hosted.
- **`DB_MEDICAMENTS` pharmacological completeness:** The static JS drug database almost certainly lacks molecule-level data (ATC code, pharmacokinetic class, active ingredient / DCI). Claude's DDI reasoning quality is directly proportional to how much pharmacological context it receives. A DCI mapping of the current `DB_MEDICAMENTS` entries should be done early in Phase 1 to assess the gap.
- **Browser target for streaming:** SSE via `fetch` + `ReadableStream` requires Chrome 93+, Firefox 102+, or Safari 14.1+. Hospital workstation browser versions should be confirmed — hospital environments sometimes run outdated browsers.
- **Alert gate strategy (submit vs. draft change):** PITFALLS.md recommends gating the check to the submit/validate step to avoid cognitive interruption; ARCHITECTURE.md recommends a 1500ms debounce on draft change. These are in tension. The final decision should be made in Phase 2 based on a brief usability test with a doctor in the loop, not resolved purely from research.

---

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection: `/Users/neylesso/UX/smartux-ai/src/SmartUX_AI_Bots.jsx`, `server.js`, `database.js`, `package.json` — all stack constraints and architecture decisions
- Claude API streaming docs — `https://platform.claude.com/docs/en/build-with-claude/streaming`
- Claude prompting best practices — `https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices`
- CNIL official RGPD guidance for AI — `https://www.cnil.fr/fr/intelligence-artificielle/ia-comment-etre-en-conformite-avec-le-rgpd`
- JAMIA Scoping Review — AI-based medication alert optimization (PMC11105146) — alert fatigue and override rates

### Secondary (MEDIUM confidence)
- Groq Community FAQ — streaming parameter and SSE headers — `https://community.groq.com/t/how-do-i-enable-streaming-for-real-time-responses/480`
- Groq Text Generation docs — `https://console.groq.com/docs/text-chat`
- LLM as CDSS — medication safety in 16 specialties (Cell Reports Medicine 2025)
- ChatGPT vs CDSS in DDI analysis — Clinical Pharmacology & Therapeutics 2025
- Nature Scientific Reports: ChatGPT for clinical decision support 2025 — confirms system-prompt patient context injection as standard CDS pattern
- Automation Bias in LLM-Assisted Diagnostic Reasoning — medRxiv 2025
- Medical Hallucination in Foundation Models — medRxiv 2025 (15-40% hallucination rate on clinical tasks)
- FDA 2026 revised CDS guidance — Covington analysis

### Tertiary (MEDIUM-LOW confidence)
- Anthropic healthcare announcement — `https://www.anthropic.com/news/healthcare-life-sciences` — general applicability to clinical contexts
- OWASP LLM01:2025 — Prompt Injection — `https://genai.owasp.org/llmrisk/llm01-prompt-injection/`

---
*Research completed: 2026-03-05*
*Synthesized: 2026-03-06*
*Ready for roadmap: yes*
