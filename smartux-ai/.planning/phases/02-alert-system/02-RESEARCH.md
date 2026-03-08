# Phase 2: Alert System — Research

**Researched:** 2026-03-06
**Domain:** React alert component with debounced Claude safety check, severity-tiered UI, dismiss/acknowledge logic, and patient selection wiring
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ALRT-01 | System automatically checks the prescription draft against the patient's dossier when a drug is entered (allergy conflict, drug-drug interaction, contraindication, dosage warning) | `callClaudeChat` + `CLAUDE_SYSTEM_PROMPT_ALERT` are exported and ready; debounced `useEffect` on `currentDraft.drug_name_free` is the trigger pattern; `buildDossierContext` provides the patient context |
| ALRT-02 | Every alert displays a patient identity header showing which patient the warning applies to | Phase 1 built the dossier context with patient token header; the alert UI must extract and display `patient.first_name + patient.last_name + patient.patient_id` from the full patient object received as a prop |
| ALRT-03 | MODERE and FAIBLE alerts can be dismissed silently without justification | Single-click dismiss via `setAlerts(prev => prev.filter(a => a.id !== id))` on MODERE/FAIBLE; CRITIQUE requires explicit acknowledgment before removal |
| UX-02 | Alert severity is visually distinct: Red for CRITIQUE, Orange for MODERE, Grey for FAIBLE | Color constants already defined in file: `RED = "#EF4444"`, `AMBER = "#F59E0B"`, `MUTED = "#6B7280"`; inline style objects consistent with existing file convention |
</phase_requirements>

---

## Summary

Phase 2 builds on a complete Phase 1 foundation. `buildDossierContext(patient, prescriptions)`, `callClaudeChat(systemPrompt, userMessage, history)`, and `CLAUDE_SYSTEM_PROMPT_ALERT` are all exported and passing tests. The proxy at `http://localhost:3001/api/claude` is wired and working.

The two plans in Phase 2 are: (1) build the `AlertSystem` component with debounced draft watcher, Claude safety check, severity-tiered badges, and dismiss/acknowledge logic; (2) wire `selectedPatientId` state to the root `SmartUXBots` component and connect `AlertSystem` inside `NLPBot` with a real patient object.

The biggest implementation challenge is not technical — it is the proxy mismatch. The existing `/api/claude` proxy on `server.js` line 102–117 ignores the `messages` array structure sent by `callClaudeChat` and uses only `req.body.messages[0].content`. This discards the system prompt. Phase 2 must fix this so `CLAUDE_SYSTEM_PROMPT_ALERT` actually reaches the model. This is a one-time server.js patch, not a new route.

**Primary recommendation:** Fix the proxy first (Task 0 in Plan 02-01), then build AlertSystem against the corrected proxy. Do not build the component against a proxy that silently drops the system prompt — alerts will be generic and useless.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React `useState` | 19.2.4 (installed) | `alerts[]` array state and `isChecking` boolean | Existing pattern; two independent fields don't need `useReducer` |
| React `useEffect` | 19.2.4 (installed) | Watch `currentDraft.drug_name_free` and trigger debounced Claude call | Standard React side-effect trigger for derived async operations |
| React `useCallback` | 19.2.4 (installed) | Memoize the dismiss handler passed down as prop to avoid re-renders | Existing pattern throughout the file |
| React `useRef` | 19.2.4 (installed) | Store the debounce timer ref and the most recent request ID for stale-response guard | Existing pattern; `useRef` persists across renders without triggering re-renders |
| `callClaudeChat` (Phase 1) | — | Async gateway to the Claude proxy | Already exported from `SmartUX_AI_Bots.jsx`; Phase 2 imports directly |
| `CLAUDE_SYSTEM_PROMPT_ALERT` (Phase 1) | — | French-language system prompt with CRITIQUE/MODERE/FAIBLE classification format | Already exported; contains the severity output schema Claude follows |
| `buildDossierContext` (Phase 1) | — | Assembles patient dossier into French narrative for Claude | Already exported and tested (10 green tests) |

### No New Dependencies

No new npm packages are required for Phase 2. The alert UI uses inline styles matching the existing file convention. All React hooks are already imported at line 1 of `SmartUX_AI_Bots.jsx`.

```bash
# No install needed
```

---

## Architecture Patterns

### Recommended Component Structure

```
SmartUX_AI_Bots.jsx (existing file)
├── [existing utilities]
├── buildDossierContext()         ← Phase 1 — done
├── CLAUDE_SYSTEM_PROMPT_ALERT    ← Phase 1 — done
├── callClaudeChat()              ← Phase 1 — done
├── [existing UI atoms]
├── AlertSystem()                 ← Phase 2 Plan 01 — NEW
├── [existing sub-components]
└── SmartUXBots() root            ← Phase 2 Plan 02 — add selectedPatientId
        └── NLPBot()              ← Phase 2 Plan 02 — add AlertSystem inside
```

### Pattern 1: Debounced useEffect on Drug Change

**What:** `AlertSystem` watches `currentDraft.drug_name_free` (and optionally `currentDraft.dosage`) via `useEffect`. Inside the effect, a `setTimeout` fires the Claude call after 1000–1500ms. If the dependency changes before the timer fires, `clearTimeout` cancels the previous call.

**When to use:** Whenever an async side effect should not fire on every state update but should fire a fixed delay after the last update.

**Stale response guard:** A `requestIdRef` counter increments before each call. The response only updates state if its captured request ID matches the current ref. This prevents a slow earlier response from overwriting a faster later response.

```javascript
// Source: React docs "You Might Not Need an Effect" + standard debounce pattern
function AlertSystem({ patient, currentDraft, prescriptions }) {
  const [alerts, setAlerts] = useState([]);
  const [isChecking, setIsChecking] = useState(false);
  const timerRef = useRef(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (!patient || !currentDraft?.drug_name_free) {
      setAlerts([]);
      return;
    }
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      const reqId = ++requestIdRef.current;
      setIsChecking(true);
      try {
        const dossier = buildDossierContext(patient, prescriptions);
        const userMessage = `Médicament proposé : ${currentDraft.drug_name_free}${currentDraft.dosage ? ` — Dose : ${currentDraft.dosage}` : ''}`;
        const raw = await callClaudeChat(CLAUDE_SYSTEM_PROMPT_ALERT, userMessage);
        if (reqId !== requestIdRef.current) return; // stale response — discard
        setAlerts(parseAlertResponse(raw));
      } catch (err) {
        if (reqId !== requestIdRef.current) return;
        setAlerts([{ id: 'err', severity: 'FAIBLE', message: 'Vérification indisponible — réessayez.' }]);
      } finally {
        if (reqId === requestIdRef.current) setIsChecking(false);
      }
    }, 1200);
    return () => clearTimeout(timerRef.current);
  }, [patient?.patient_id, currentDraft?.drug_name_free, currentDraft?.dosage]);
  // ...
}
```

### Pattern 2: Claude Response Parser (parseAlertResponse)

**What:** `callClaudeChat` returns a string. `CLAUDE_SYSTEM_PROMPT_ALERT` instructs Claude to produce `**CRITIQUE**`, `**MODERE**`, and `**FAIBLE**` prefixed lines. A parser splits the response into structured alert objects.

**Critical insight:** The proxy currently strips the `messages` array structure and uses only `messages[0].content` — the system prompt is silently discarded. The system prompt must be injected into the user message as part of the payload, OR the proxy must be patched to forward `messages` as-is. The Phase 1 `callClaudeChat` builds a proper messages array but the proxy ignores it. **Plan 02-01 must patch `server.js` before testing alert quality.**

```javascript
// Parses CLAUDE_SYSTEM_PROMPT_ALERT formatted response into alert objects
function parseAlertResponse(raw) {
  const alerts = [];
  const lines = raw.split('\n');
  const severityMap = { 'CRITIQUE': 'CRITIQUE', 'MODERE': 'MODERE', 'FAIBLE': 'FAIBLE' };

  lines.forEach(line => {
    const match = line.match(/\*\*(CRITIQUE|MODERE|FAIBLE)\*\*\s*:?\s*(.+)/);
    if (match) {
      alerts.push({
        id: `${match[1]}-${Date.now()}-${Math.random()}`,
        severity: severityMap[match[1]],
        message: match[2].trim(),
      });
    }
  });
  // If "Aucune interaction" appears and no alerts found, return empty array
  if (alerts.length === 0 && raw.includes('Aucune interaction identifi')) {
    return [];
  }
  return alerts;
}
```

### Pattern 3: Severity-Tiered Alert Badges (UX-02)

**What:** Each alert renders as an inline banner with a left border or background color indicating severity. Colors use the existing file constants: `RED = "#EF4444"`, `AMBER = "#F59E0B"`, `MUTED = "#6B7280"`. Inline styles only — no new CSS files.

**CRITIQUE alert** has an explicit acknowledgment button ("J'ai pris connaissance de cet avertissement") instead of a dismiss button. The CRITIQUE alert cannot be removed until this button is clicked (state tracks `acknowledgedIds` Set).

```javascript
// Source: existing file style patterns (Badge, Btn atoms at lines 408-431)
const SEVERITY_COLORS = {
  CRITIQUE: RED,      // "#EF4444"
  MODERE:   AMBER,    // "#F59E0B"
  FAIBLE:   MUTED,    // "#6B7280"
};

// Alert banner — MODERE/FAIBLE
function AlertBanner({ alert, onDismiss }) {
  const color = SEVERITY_COLORS[alert.severity];
  return (
    <div style={{
      background: `${color}12`,
      border: `1px solid ${color}44`,
      borderLeft: `3px solid ${color}`,
      borderRadius: 8,
      padding: '10px 14px',
      display: 'flex',
      alignItems: 'flex-start',
      gap: 10,
    }}>
      <div style={{ flex: 1 }}>
        <span style={{ fontWeight: 700, color, fontSize: 11, textTransform: 'uppercase', marginRight: 6 }}>
          {alert.severity}
        </span>
        <span style={{ fontSize: 13, color: '#334155' }}>{alert.message}</span>
      </div>
      <button onClick={() => onDismiss(alert.id)} style={{
        background: 'none', border: 'none', cursor: 'pointer',
        color: MUTED, fontSize: 16, lineHeight: 1, padding: '0 4px',
        fontFamily: "'DM Sans', sans-serif",
      }}>×</button>
    </div>
  );
}
```

### Pattern 4: selectedPatientId in Root (Plan 02-02)

**What:** `SmartUXBots` root gains a new `useState` atom: `selectedPatientId`. The NLPBot, after `mapNLPToPrescription` resolves a patient from the NLP text, calls an `onPatientResolved(patientId)` callback upward. The `AlertSystem` receives the full derived patient object as a prop.

**Key insight about the current codebase:** `NLPBot` currently receives only `onPrescription` as a prop. To wire patient selection, Plan 02-02 adds `onPatientResolved` as a second callback prop to `NLPBot`, called inside the existing `send()` function when `rx._matched_patient` is non-null.

```javascript
// In SmartUXBots root — Plan 02-02
const [selectedPatientId, setSelectedPatientId] = useState(null);
const selectedPatient = DB_PATIENTS.find(p => p.patient_id === selectedPatientId) || null;

// NLPBot receives new callback
<NLPBot onPrescription={addPrescription} onPatientResolved={setSelectedPatientId} />

// Inside NLPBot.send() — add after setHistory for the rx card:
if (rx._matched_patient) onPatientResolved(rx._matched_patient.patient_id);
```

**AlertSystem placement:** `AlertSystem` renders inside `NLPBot`, receiving `patient={selectedPatient from root}` and `currentDraft={last rx from NLPBot local history}`. Since `NLPBot` owns its `history[]` state, the last bot-role item's `rx` is the current draft — this is already available as `history.findLast(m => m.role === 'bot')?.rx || null`.

### Anti-Patterns to Avoid

- **Firing Claude on every keystroke without debounce:** The NLPBot already calls `parseWithClaude()` on submit. If AlertSystem fires immediately on every `currentDraft` change, two API calls race for the same prescription. Always debounce AlertSystem.
- **Storing `isChecking` and `alerts` at root:** Root state re-renders the entire tree. Alert state belongs inside `AlertSystem`, not `SmartUXBots`.
- **Using the FULL dossier in the user message:** `callClaudeChat` receives `systemPrompt` and `userMessage`. The dossier string goes in `systemPrompt` (or prepended to it as context). The `userMessage` should be the specific drug being checked — short and focused. Do not paste the full dossier in `userMessage`.
- **Treating CRITIQUE alerts as auto-dismissible:** CRITIQUE alerts must require explicit acknowledgment. The dismiss handler should check `alert.severity !== 'CRITIQUE'` before removing.
- **Displaying raw Claude response text as the alert message:** Claude's response is a multi-paragraph formatted string. Always parse it into structured alert objects before rendering.

---

## Critical Fix: Proxy System Prompt Forwarding

**This is the single most important implementation detail for Phase 2.**

The current `server.js` proxy (lines 100–121) only uses `req.body.messages[0].content` and builds its own messages array with a single user role. It discards the system prompt from `callClaudeChat`.

```javascript
// Current server.js — BROKEN for callClaudeChat's structured messages
const userMessage = req.body.messages[0].content; // Only reads first message
const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
  body: JSON.stringify({
    messages: [{ role: "user", content: userMessage }], // Discards system prompt
  }),
});
```

The fix passes `req.body.messages` (and `req.body.max_tokens`) directly to Groq:

```javascript
// Fixed server.js — forwards structured messages array
app.post("/api/claude", async (req, res) => {
  try {
    const { messages, max_tokens = 1000 } = req.body;
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages,          // Forward as-is — includes system role
        max_tokens,
        temperature: 0.1,
      }),
    });
    const data = await response.json();
    res.json({ content: [{ text: data.choices[0].message.content }] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
```

**Why this is safe:** The existing `parseWithClaude()` call at line 149 sends `messages: [{ role: "user", content: ... }]` — a single-message array with no system prompt. After the fix, the proxy forwards this unchanged. Behavior of the existing NLP call is identical. Only calls from `callClaudeChat` gain the system prompt, because `callClaudeChat` builds a multi-message array with `{ role: "system", content: systemPrompt }` first.

**Impact on existing callClaudeChat tests:** The existing 6 tests in `callClaudeChat.test.js` mock `global.fetch` directly — they bypass the proxy entirely. They remain green after the proxy fix.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Debouncing async side effects | Custom debounce hook or class | `setTimeout`/`clearTimeout` in `useEffect` | Standard React pattern; zero deps; cleanup return handles unmount and re-fire |
| Stale API response rejection | Complex cancellation state machine | `useRef` request ID counter | Simple, reliable, no AbortController needed for non-streaming calls |
| Severity color lookup | `if/else` chain per severity | `SEVERITY_COLORS` const object keyed by severity string | Extensible; single source of truth; already used for `prioBadgeColor` pattern at line 1703 |
| Patient display name | Inline `${first} ${last}` everywhere | `patient.first_name + ' ' + patient.last_name` via the patient object prop | Patient object is already resolved and available as prop; no re-lookup needed |
| Alert ID generation | Database sequence or UUID | `Date.now() + Math.random()` string | Sufficient for session-scoped ephemeral UI state; no persistence needed |

**Key insight:** The existing codebase already uses `Badge`, `Btn`, and inline style patterns for all alert-like UI (allergy alert banner at line 1552, rx priority badges at line 1703). AlertSystem should follow these exact patterns — do not introduce new design primitives.

---

## Common Pitfalls

### Pitfall 1: Proxy Silently Drops System Prompt
**What goes wrong:** AlertSystem fires a Claude call, but alerts come back generic or in English — no CRITIQUE/MODERE/FAIBLE classification, no patient context.
**Why it happens:** `server.js` uses only `messages[0].content` — the system prompt sent by `callClaudeChat` is the first message but is assembled into the full `messages` array; without the proxy forwarding it, it never reaches Groq.
**How to avoid:** Fix the proxy in the first task of Plan 02-01 before any other AlertSystem work. Verify by logging the outgoing Groq payload in development.
**Warning signs:** Alerts appear without severity markers; response is a generic drug information paragraph rather than a structured safety check.

### Pitfall 2: currentDraft Available Too Late
**What goes wrong:** AlertSystem receives `null` for `currentDraft` even after the NLP bot has resolved a prescription.
**Why it happens:** `NLPBot` stores the parsed rx in its local `history[]` state. AlertSystem is a child component of NLPBot that needs to read the latest rx. If the prop is derived from `history.findLast()` at render time, it works. If AlertSystem is placed outside NLPBot and relies on root state, the data flow is broken.
**How to avoid:** AlertSystem renders inside NLPBot. NLPBot passes `currentDraft={history.findLast(m => m.role === 'bot')?.rx || null}` as a prop to AlertSystem. This is already inside NLPBot's render scope.
**Warning signs:** `currentDraft` is always null or always one prescription behind.

### Pitfall 3: CRITIQUE Alert Dismissible Without Acknowledgment
**What goes wrong:** The dismiss button is wired to the same handler for all severity levels. A CRITIQUE interaction warning disappears on a single click.
**Why it happens:** Simple `onDismiss(id)` handler doesn't check severity before removing.
**How to avoid:** Two separate handlers: `handleDismiss(id)` only removes MODERE/FAIBLE; `handleAcknowledge(id)` removes CRITIQUE after explicit acknowledgment. Or: one handler that checks `alerts.find(a => a.id === id).severity !== 'CRITIQUE'` before removing.
**Warning signs:** CRITIQUE badge vanishes immediately on click without any confirmation UI.

### Pitfall 4: selectedPatientId State Causes Full-Tree Re-Renders
**What goes wrong:** Every time `selectedPatientId` changes, `AlertSystem`, `NLPBot`, `RxTab`, `DossierPanel`, and all panels re-render.
**Why it happens:** `selectedPatientId` is in root state; any root state change triggers re-render of all children.
**How to avoid:** This is acceptable for patient selection events (infrequent, intentional). The real concern is alert state updates. Alert state must stay inside `AlertSystem`, not root. Wrap `AlertSystem` in `React.memo` if profiling reveals unnecessary re-renders.
**Warning signs:** React DevTools shows NLPBot chat messages flashing on every alert update.

### Pitfall 5: Alert Persists After Patient Change
**What goes wrong:** Doctor checks drug for patient A, then navigates to patient B. Old CRITIQUE alert for patient A is still visible.
**Why it happens:** `alerts` state is not cleared when `patient.patient_id` changes.
**How to avoid:** Add a `useEffect(() => { setAlerts([]); setIsChecking(false); }, [patient?.patient_id])` to reset alert state when the patient changes.
**Warning signs:** Alert header shows patient name that no longer matches the active patient.

### Pitfall 6: Alert Message Contains Raw Disclaimer Text
**What goes wrong:** The first alert in the list shows the full disclaimer paragraph "Analyse assistée par IA — vérification clinique recommandée" as a FAIBLE item.
**Why it happens:** `parseAlertResponse` treats the disclaimer line as an alert if it matches `\*\*(.*)\*\*`.
**How to avoid:** The disclaimer line begins with "Analyse assistée par IA..." — it has no `**SEVERITY**` prefix, so the regex won't match it. But the parser should also guard against false matches on the format example line in the response.
**Warning signs:** An alert appears with the message "Analyse assistée par IA" and severity FAIBLE.

---

## Code Examples

### AlertSystem Component Skeleton

```javascript
// Source: ARCHITECTURE.md Pattern 4 + Phase 1 established patterns
// Place after callClaudeChat() in SmartUX_AI_Bots.jsx (before EXPORT PDF section)
function AlertSystem({ patient, currentDraft, prescriptions }) {
  const [alerts, setAlerts] = useState([]);
  const [isChecking, setIsChecking] = useState(false);
  const [acknowledgedIds, setAcknowledgedIds] = useState(new Set());
  const timerRef = useRef(null);
  const requestIdRef = useRef(0);

  // Reset when patient changes
  useEffect(() => {
    setAlerts([]);
    setIsChecking(false);
  }, [patient?.patient_id]);

  // Debounced alert check on draft change
  useEffect(() => {
    if (!patient || !currentDraft?.drug_name_free) {
      setAlerts([]);
      return;
    }
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      const reqId = ++requestIdRef.current;
      setIsChecking(true);
      try {
        const dossier = buildDossierContext(patient, prescriptions || []);
        const systemWithDossier = `${CLAUDE_SYSTEM_PROMPT_ALERT}\n\n=== DOSSIER PATIENT ===\n${dossier}`;
        const userMessage = `Médicament proposé : ${currentDraft.drug_name_free}${currentDraft.dosage ? ` — Dose : ${currentDraft.dosage}` : ''}${currentDraft.route ? ` — Voie : ${currentDraft.route}` : ''}`;
        const raw = await callClaudeChat(systemWithDossier, userMessage);
        if (reqId !== requestIdRef.current) return;
        setAlerts(parseAlertResponse(raw));
      } catch (_err) {
        if (reqId !== requestIdRef.current) return;
        setAlerts([{
          id: 'error', severity: 'FAIBLE',
          message: 'Vérification indisponible — contactez le support si le problème persiste.',
        }]);
      } finally {
        if (reqId === requestIdRef.current) setIsChecking(false);
      }
    }, 1200);
    return () => clearTimeout(timerRef.current);
  }, [patient?.patient_id, currentDraft?.drug_name_free, currentDraft?.dosage]);

  const handleDismiss = useCallback((id) => {
    setAlerts(prev => prev.filter(a => a.id !== id || a.severity === 'CRITIQUE'));
  }, []);

  const handleAcknowledge = useCallback((id) => {
    setAcknowledgedIds(prev => new Set([...prev, id]));
    setAlerts(prev => prev.filter(a => a.id !== id));
  }, []);

  if (!patient) return null;

  const visibleAlerts = alerts.filter(a => a.severity !== 'CRITIQUE' || !acknowledgedIds.has(a.id));

  return (
    <div style={{ marginTop: 12 }}>
      {/* Patient identity header (ALRT-02) */}
      {(isChecking || visibleAlerts.length > 0) && (
        <div style={{ fontSize: 11, color: MUTED, marginBottom: 6, fontWeight: 600 }}>
          Vérification pour : {patient.first_name} {patient.last_name} (ID {patient.patient_id})
        </div>
      )}
      {/* Loading indicator */}
      {isChecking && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: '#F8FAFC', borderRadius: 8, marginBottom: 6 }}>
          <div className="loader" />
          <span style={{ fontSize: 12, color: MUTED }}>Vérification en cours…</span>
        </div>
      )}
      {/* Alert banners */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {visibleAlerts.map(alert => (
          <AlertBanner
            key={alert.id}
            alert={alert}
            onDismiss={alert.severity !== 'CRITIQUE' ? handleDismiss : undefined}
            onAcknowledge={alert.severity === 'CRITIQUE' ? handleAcknowledge : undefined}
          />
        ))}
      </div>
    </div>
  );
}
```

### AlertBanner Atom

```javascript
// Source: existing file Badge/Btn patterns at lines 408-431
const SEVERITY_COLORS = { CRITIQUE: RED, MODERE: AMBER, FAIBLE: MUTED };
const SEVERITY_LABELS = { CRITIQUE: 'CRITIQUE', MODERE: 'MODERE', FAIBLE: 'FAIBLE' };

function AlertBanner({ alert, onDismiss, onAcknowledge }) {
  const color = SEVERITY_COLORS[alert.severity];
  return (
    <div style={{
      background: `${color}10`,
      border: `1px solid ${color}44`,
      borderLeft: `4px solid ${color}`,
      borderRadius: 8,
      padding: '10px 14px',
    }}>
      {/* Disclaimer (SAFE-02 — always visible on AI alerts) */}
      <div style={{ fontSize: 10, color: MUTED, marginBottom: 4, fontStyle: 'italic' }}>
        Analyse assistée par IA — vérification clinique recommandée
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ flex: 1 }}>
          <span style={{ fontWeight: 700, color, fontSize: 11, textTransform: 'uppercase', marginRight: 6 }}>
            {SEVERITY_LABELS[alert.severity]}
          </span>
          <span style={{ fontSize: 13, color: '#334155', lineHeight: 1.5 }}>{alert.message}</span>
        </div>
        {alert.severity !== 'CRITIQUE' && onDismiss && (
          <button onClick={() => onDismiss(alert.id)} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: MUTED, fontSize: 18, lineHeight: 1, padding: '0 4px',
            fontFamily: "'DM Sans', sans-serif", flexShrink: 0,
          }} title="Ignorer cette alerte">×</button>
        )}
        {alert.severity === 'CRITIQUE' && onAcknowledge && (
          <button onClick={() => onAcknowledge(alert.id)} style={{
            padding: '5px 12px', borderRadius: 7, border: `1px solid ${RED}`,
            background: RED, color: '#fff', fontSize: 11, fontWeight: 600,
            cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", flexShrink: 0,
          }}>J'ai pris connaissance</button>
        )}
      </div>
    </div>
  );
}
```

### Proxy Fix (server.js)

```javascript
// Replace lines 100-121 in server.js — forward full messages array to Groq
app.post("/api/claude", async (req, res) => {
  try {
    const { messages, max_tokens = 1000 } = req.body;
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages,
        max_tokens,
        temperature: 0.1,
      }),
    });
    const data = await response.json();
    res.json({ content: [{ text: data.choices[0].message.content }] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
```

### NLPBot Wiring Additions (Plan 02-02)

```javascript
// NLPBot signature — add onPatientResolved prop
function NLPBot({ onPrescription, onPatientResolved, compact = false }) {
  // ... existing state ...

  const send = useCallback(async (text) => {
    // ... existing code ...
    const rx = mapNLPToPrescription(structured, corrected);
    setHistory(h => [...h, { role: 'bot', text: structured, rx }]);

    // NEW: surface resolved patient to root
    if (rx._matched_patient && onPatientResolved) {
      onPatientResolved(rx._matched_patient.patient_id);
    }
    // ... rest of existing send logic ...
  }, [pendingDelay, onPatientResolved]);

  // Inside NLPBot's return, after the chat area:
  const currentDraft = history.findLast?.(m => m.role === 'bot')?.rx || null;
  // Render AlertSystem if selectedPatient is available (passed down or derived)
  // <AlertSystem patient={patient} currentDraft={currentDraft} prescriptions={prescriptions} />
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `detectAllergyConflict()` — synchronous, substring-only allergy check | `AlertSystem` — async LLM-based check covering DDI, contraindications, dosage + fallback to deterministic check | Phase 2 | LLM check is richer but slower; keep both: deterministic runs first (zero latency), LLM runs in parallel (1-3s) |
| Proxy uses only `messages[0].content` | Proxy forwards full `messages` array including system role | Phase 2 Plan 01-01 fix | `CLAUDE_SYSTEM_PROMPT_ALERT` actually reaches the model |
| No patient selection concept in root | `selectedPatientId` state in `SmartUXBots` root | Phase 2 Plan 02-02 | Required by AlertSystem (Phase 2) and ChatPanel (Phase 3) |

**Deprecated/outdated:**
- `detectAllergyConflict()` remains in use but is now the fast pre-check layer, not the primary safety gate. Do not remove it — it has zero latency and catches obvious conflicts before the Claude call completes.

---

## Open Questions

1. **System prompt injection strategy for `callClaudeChat`**
   - What we know: `callClaudeChat(systemPrompt, userMessage)` sends `[{ role: "system", content: systemPrompt }, { role: "user", content: userMessage }]`. The proxy currently discards the system message.
   - What's unclear: After the proxy fix, Groq's `llama-3.3-70b-versatile` should honor the `system` role. But the model might treat it differently than the Anthropic Claude model. Test with a known drug-allergy case after the fix.
   - Recommendation: If the `system` role is not respected, prepend the dossier inline into `systemPrompt` using `\n\n=== DOSSIER PATIENT ===\n${dossier}` as a combined string passed as `systemPrompt`. The model will see it as a highly-weighted user instruction in context position.

2. **Alert trigger timing — draft change vs. save button**
   - What we know: ARCHITECTURE.md recommends 1500ms debounce on draft change. PITFALLS.md recommends gating to the validation step to avoid cognitive interruption during typing.
   - What's unclear: In the current NLPBot flow, the "draft" only exists after the NLP parse completes (the user sends a full phrase, not types a drug name character by character). This makes debounce less critical — the trigger is a parse result, not a keystroke stream.
   - Recommendation: Debounce at 1200ms on `currentDraft.drug_name_free` change. This fires once after the NLP result is displayed, while the doctor reviews the extracted data. Non-blocking.

3. **AlertSystem prop chain — NLPBot vs. root**
   - What we know: `AlertSystem` needs `patient`, `currentDraft`, and `prescriptions`. `patient` comes from root (`selectedPatientId` → `DB_PATIENTS.find()`). `currentDraft` comes from NLPBot's local `history` state. `prescriptions` comes from root.
   - What's unclear: `AlertSystem` rendered inside `NLPBot` means NLPBot must receive `patient` and `prescriptions` as props from root. NLPBot currently receives only `onPrescription`. This adds two new props to NLPBot's interface.
   - Recommendation: Add `patient` and `prescriptions` props to NLPBot. Pass them through from root where NLPBot is rendered (lines 1343 and 1368).

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Jest (via react-scripts test, CRA built-in) |
| Config file | None — CRA default Jest config |
| Quick run command | `CI=true react-scripts test --testPathPattern=AlertSystem --watchAll=false` |
| Full suite command | `CI=true react-scripts test --watchAll=false` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ALRT-01 | Debounced Claude call fires when `currentDraft.drug_name_free` changes | unit | `CI=true react-scripts test --testPathPattern=AlertSystem --watchAll=false` | Wave 0 |
| ALRT-01 | Claude call does NOT fire when `patient` is null | unit | same | Wave 0 |
| ALRT-01 | Stale response is discarded (reqId mismatch) | unit | same | Wave 0 |
| ALRT-01 | Error state sets FAIBLE fallback alert | unit | same | Wave 0 |
| ALRT-02 | Alert panel displays patient first + last name | unit | same | Wave 0 |
| ALRT-02 | Alert panel displays patient ID | unit | same | Wave 0 |
| ALRT-03 | MODERE alert removes from list on dismiss click | unit | same | Wave 0 |
| ALRT-03 | FAIBLE alert removes from list on dismiss click | unit | same | Wave 0 |
| ALRT-03 | CRITIQUE alert does NOT remove on dismiss; requires acknowledge | unit | same | Wave 0 |
| UX-02 | CRITIQUE alert renders with RED color (`#EF4444`) | unit | same | Wave 0 |
| UX-02 | MODERE alert renders with AMBER color (`#F59E0B`) | unit | same | Wave 0 |
| UX-02 | FAIBLE alert renders with MUTED color (`#6B7280`) | unit | same | Wave 0 |

### Sampling Rate

- **Per task commit:** `CI=true react-scripts test --testPathPattern="AlertSystem|buildDossierContext|callClaudeChat" --watchAll=false`
- **Per wave merge:** `CI=true react-scripts test --watchAll=false`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `src/__tests__/AlertSystem.test.js` — covers all ALRT-01, ALRT-02, ALRT-03, UX-02 behaviors above; uses `@testing-library/react` for component rendering + `jest.mock('../database')` for DB isolation + `global.fetch` mock for `callClaudeChat` isolation
- [ ] `src/__tests__/AlertSystem.test.js` needs the `parseAlertResponse` function exported from `SmartUX_AI_Bots.jsx` to test parsing directly (or test it indirectly via the component)

Note: No new testing framework install needed. `@testing-library/react` is already in `dependencies` at version `^16.3.2`. `@testing-library/jest-dom` is at `^6.9.1`. Both work with the existing CRA Jest setup.

---

## Sources

### Primary (HIGH confidence)

- Direct codebase inspection: `SmartUX_AI_Bots.jsx` lines 1–330 — Phase 1 exports, existing NLPBot structure, root state shape, existing allergy alert UI patterns
- Direct codebase inspection: `server.js` lines 97–121 — proxy message handling, confirmed system prompt stripping
- `.planning/phases/01-safety-foundation/01-VERIFICATION.md` — confirms all 13 Phase 1 truths; exact line numbers for `buildDossierContext` (191), `callClaudeChat` (293), `CLAUDE_SYSTEM_PROMPT_ALERT` (250)
- `.planning/phases/01-safety-foundation/01-02-SUMMARY.md` — confirms proxy caller pattern: `callClaudeChat(CLAUDE_SYSTEM_PROMPT_ALERT, userMessage)` for Phase 2
- `.planning/research/ARCHITECTURE.md` — Pattern 4 (AlertSystem debounce), Pattern 1 (selectedPatientId), Component Responsibilities table
- `.planning/research/PITFALLS.md` — Pitfall 1 (alert fatigue), Pitfall 4 (cognitive interruption), Pitfall 5 (automation bias), UX Pitfalls section

### Secondary (MEDIUM confidence)

- `.planning/research/STACK.md` — React hooks usage, no-new-deps constraint confirmed, inline styles pattern
- `.planning/research/FEATURES.md` — ALRT-01/02/03/UX-02 feature requirements validated against clinical CDSS literature
- `.planning/research/SUMMARY.md` — Phase 2 deliverables, proxy concern, build order confirmation

### Tertiary (LOW confidence — from prior research, not re-verified)

- JAMIA scoping review PMC11105146 — alert override rates up to 96%; severity tiering rationale
- medRxiv 2025 automation bias study — CRITIQUE acknowledgment requirement rationale

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — direct codebase inspection confirms all React hooks already imported; no new deps needed
- Architecture: HIGH — Phase 1 exports verified at exact line numbers; NLPBot render structure read directly
- Proxy fix: HIGH — server.js read directly; message stripping confirmed at lines 102–117
- Pitfalls: HIGH — prior research cross-referenced against actual code; pitfalls are code-level, not theoretical
- Test infrastructure: HIGH — package.json confirms @testing-library/react 16.3.2 installed; CRA Jest confirmed working (16/17 tests green in Phase 1)

**Research date:** 2026-03-06
**Valid until:** 2026-04-06 (stable stack; expires only if major React or Groq API changes)
