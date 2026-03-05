# Stack Research

**Domain:** Clinical AI chatbot panel — embedded in an existing React hospital prescription system
**Researched:** 2026-03-05
**Confidence:** HIGH (existing codebase inspected directly; Claude API docs verified; Groq streaming docs verified)

---

## Context: What We Are Building Into

Before recommending anything, these are the hard constraints discovered by reading the codebase:

| Fact | Implication |
|------|-------------|
| React 19.2.4 via CRA (react-scripts 5.0.1) | Hooks-first. No framework migration. |
| Single large component: `SmartUX_AI_Bots.jsx` (~37KB) | New chatbot is a sub-component in the same file |
| Inline styles only — no CSS files, no Tailwind, no component lib | All UI built with style objects |
| `localhost:3001/api/claude` POST returns `{ content: [{ text }] }` — wraps Groq `llama-3.3-70b-versatile` | Backend is Express + better-sqlite3 |
| The proxy does NOT currently stream — it awaits the full response | Streaming requires a new proxy route |
| Static JS data in `database.js`: DB_PATIENTS, DB_MEDICAMENTS, KNOWN_ALLERGIES, DB_CONSTANTES, DB_OBSERVATIONS, DB_IMAGERIE | All patient context is available in-memory on the frontend |
| No new packages unless absolutely necessary | Build the chat UI with pure React hooks |
| All UI strings in French | Prompts and responses must be in French |

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| React hooks (useState, useRef, useEffect, useCallback, useMemo) | 19.2.4 (already installed) | Chat message state, scroll management, streaming buffer, memoized context builder | Already in use throughout the file; no new install; covers 100% of chat UI needs |
| Inline style objects | — (pattern, not a library) | All chat panel styling | Matches existing code convention; avoids any build-tool changes |
| Native `fetch` with `ReadableStream` | Browser-native | Consuming SSE stream from the new proxy streaming endpoint | Already used in `parseWithClaude()`; no polyfill needed for Chrome/Firefox/Safari 2024+ |
| Express `res.write()` SSE pattern | express ^5.2.1 (already installed) | New `/api/claude-stream` route that proxies Groq streaming | Express already installed; just add a new route to `server.js` |
| Groq SDK `stream: true` | groq-sdk (add to server only) | Enable token-by-token streaming from `llama-3.3-70b-versatile` | Same model already used; streaming available via `stream: true` parameter |

**Install decision:** Add `groq-sdk` to the server (`npm install groq-sdk` — server-side only, not bundled into React app). Everything else is already present.

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `groq-sdk` | ^0.9+ | Official Groq Node.js client with first-class async iterator streaming | Only on the Express server side; replaces the raw `fetch` call in server.js |

No other libraries are needed. Do not add `react-query`, `zustand`, `@ai-sdk/react`, or any chat UI library — they all conflict with the "no new heavy deps" constraint and would require refactoring the entire component.

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| React DevTools (already available) | Inspect chat message state, re-render frequency | Use to verify message array updates don't cause full-component re-renders |
| Node.js `console.log` in server.js | Debug SSE chunk delivery timing | Add temporary logging to `/api/claude-stream` during development |

---

## Installation

```bash
# Server only — do NOT add to the React app bundle
npm install groq-sdk
```

No React-side installs required.

---

## Chat UI Architecture (Pure React, No Library)

### State Shape for the Chatbot Sub-Component

```javascript
// Inside ClinicalChatbot component (or inline in SmartUX_AI_Bots.jsx)
const [messages, setMessages] = useState([]);
// messages: Array<{ id, role: "user"|"assistant"|"alert", content, timestamp, isStreaming }>

const [input, setInput] = useState("");
const [isLoading, setIsLoading] = useState(false);
const [streamBuffer, setStreamBuffer] = useState(""); // accumulates tokens during stream
const messagesEndRef = useRef(null); // for auto-scroll
const abortRef = useRef(null);       // AbortController for cancelling in-flight stream
```

### Auto-Scroll Pattern

```javascript
// Scroll to bottom whenever messages or streamBuffer changes
useEffect(() => {
  messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
}, [messages, streamBuffer]);
```

**Why `scrollIntoView` not `scrollTop`:** `scrollIntoView` is one line, no ResizeObserver, works when messages wrap to multiple lines. This is the standard pattern (HIGH confidence — React docs, multiple production examples).

### Streaming Fetch Pattern (Client Side)

The existing proxy returns a complete JSON response. A new route `/api/claude-stream` will return SSE. Client-side pattern:

```javascript
async function streamChatMessage(systemPrompt, conversationMessages, onToken, onDone, onError) {
  const controller = new AbortController();
  abortRef.current = controller;

  try {
    const res = await fetch("http://localhost:3001/api/claude-stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        system: systemPrompt,
        messages: conversationMessages,
        max_tokens: 1024,
      }),
    });

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) { onDone(); break; }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop(); // keep incomplete last line

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6).trim();
          if (data === "[DONE]") { onDone(); return; }
          try {
            const parsed = JSON.parse(data);
            const token = parsed.choices?.[0]?.delta?.content;
            if (token) onToken(token);
          } catch (_) { /* ignore parse errors on partial chunks */ }
        }
      }
    }
  } catch (err) {
    if (err.name !== "AbortError") onError(err);
  }
}
```

**Why this pattern and not EventSource:** `EventSource` does not support POST requests or custom headers. We need POST to send the full patient context payload. `fetch` + `ReadableStream` is the correct approach for POST SSE in browsers (HIGH confidence — MDN, Claude API docs).

### Server-Side SSE Route (Add to server.js)

```javascript
const Groq = require("groq-sdk");
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

app.post("/api/claude-stream", async (req, res) => {
  const { system, messages, max_tokens = 1024 } = req.body;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // disable nginx buffering if applicable

  try {
    const stream = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: system },
        ...messages,
      ],
      max_tokens,
      temperature: 0.1,
      stream: true,
    });

    for await (const chunk of stream) {
      const token = chunk.choices[0]?.delta?.content || "";
      if (token) {
        res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: token } }] })}\n\n`);
      }
    }
    res.write("data: [DONE]\n\n");
    res.end();
  } catch (e) {
    res.write(`data: ${JSON.stringify({ error: e.message })}\n\n`);
    res.end();
  }
});
```

**Note:** Move `GROQ_API_KEY` to an environment variable (`.env` file, `process.env.GROQ_API_KEY`). The hardcoded key in server.js is a security issue independent of this milestone.

---

## Patient Dossier Context: Token Budget

### What Data Is Available Per Patient

From `database.js`, for any given `patient_id`, you can assemble:

| Data Source | Fields | Approx Token Cost |
|-------------|--------|-------------------|
| `DB_PATIENTS` record | name, DOB, gender, blood type, room, ward | ~50 tokens |
| `KNOWN_ALLERGIES[patient_id]` | allergy list | ~20-40 tokens |
| `DB_MEDICAMENTS` (current prescriptions) | drug name, INN, form, dose, route, category | ~100-200 tokens (depends on count) |
| `DB_CONSTANTES` (last 3 vitals) | TA, FC, temp, SpO2, weight | ~150 tokens |
| `DB_OBSERVATIONS` (last 2 clinical notes) | full text narratives | ~300-600 tokens |
| `DB_IMAGERIE` (last 2 imaging) | type, date, description | ~150 tokens |
| Active prescriptions from session | drug + dose + route | ~50-100 tokens |

**Total patient context: ~800-1200 tokens** — well within budget. The system prompt + context + conversation history + response should stay comfortably under 8,000 tokens, leaving massive headroom in Groq's 32k/128k context window for `llama-3.3-70b-versatile`.

### Truncation Strategy

For the clinical chatbot, use only the **most recent** data:
- Vitals: last measurement only (not all 3 — the doctor needs the current state)
- Observations: last 2 notes only
- Imaging: last 2 exams only
- Prescriptions: all active ones (crucial for interaction detection)

This keeps context under ~600 tokens for the dossier section, leaving room for a 10-turn conversation history without ever approaching token limits.

### Context Serialization Function

```javascript
function buildPatientContext(patient, currentPrescriptions) {
  const age = new Date().getFullYear() - new Date(patient.date_of_birth).getFullYear();
  const allergies = KNOWN_ALLERGIES[patient.patient_id] || [];
  const vitals = DB_CONSTANTES
    .filter(c => c.patient_id === patient.patient_id)
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 1)[0]; // most recent only
  const observations = DB_OBSERVATIONS
    .filter(o => o.patient_id === patient.patient_id)
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 2);
  const imagerie = DB_IMAGERIE
    .filter(i => i.patient_id === patient.patient_id)
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 2);

  return `
PATIENT: ${patient.first_name} ${patient.last_name} (${patient.gender}, ${age} ans)
IPP: ${patient.ipp} | Groupe sanguin: ${patient.blood_type}
Service: ${patient.ward} | Chambre: ${patient.room}

ALLERGIES CONNUES: ${allergies.length > 0 ? allergies.join(", ") : "Aucune allergie enregistrée"}

PRESCRIPTIONS EN COURS:
${currentPrescriptions.length > 0
  ? currentPrescriptions.map(rx =>
      `- ${rx.drug_name_free || rx.medicament_id} ${rx.dosage || ""} ${rx.route || ""} ${rx.frequency || ""}`.trim()
    ).join("\n")
  : "Aucune prescription active"}

DERNIÈRES CONSTANTES (${vitals ? new Date(vitals.date).toLocaleDateString("fr-FR") : "N/A"}):
${vitals ? `TA: ${vitals.ta} | FC: ${vitals.fc} bpm | Temp: ${vitals.temp}°C | SpO2: ${vitals.spo2}% | Poids: ${vitals.poids} kg` : "Non disponibles"}

OBSERVATIONS CLINIQUES RÉCENTES:
${observations.map(o => `[${new Date(o.date).toLocaleDateString("fr-FR")} - ${o.category}] ${o.text}`).join("\n")}

IMAGERIE:
${imagerie.map(i => `[${i.type} - ${i.date} - ${i.status}] ${i.description}`).join("\n")}
`.trim();
}
```

---

## Claude/Groq Prompt Engineering for Drug Safety

### System Prompt Structure

```text
Tu es SILLAGE-IA, l'assistant clinique du système SILLAGE, conçu pour aider les professionnels de santé à prescrire en toute sécurité.

<role>
Tu es un expert en pharmacologie clinique et en sécurité médicamenteuse. Tu travailles en support du médecin prescripteur — tu ne poses pas de diagnostic, tu signales des risques.
</role>

<dossier_patient>
{PATIENT_CONTEXT_STRING}
</dossier_patient>

<prescription_en_cours>
Médicament proposé: {NEW_DRUG_NAME}
Dose: {DOSE}
Voie: {ROUTE}
Indication: {INDICATION}
</prescription_en_cours>

<regles>
1. PRIORITÉ ABSOLUE : Signale toute allergie connue impliquant le médicament proposé.
2. Vérifie les interactions avec TOUTES les prescriptions en cours listées dans le dossier.
3. Évalue la pertinence de la dose selon l'âge, le poids, et les constantes vitales.
4. Identifie les contre-indications liées aux antécédents cliniques (observations).
5. Sois concis, direct, structuré. Pas d'explication générique — uniquement ce qui concerne CE patient.
6. Si aucun risque identifié : confirme explicitement que la prescription semble sûre.
7. Réponds toujours en français.
8. Ne génère jamais de prescriptions toi-même. Tu conseilles, le médecin décide.
</regles>

<format_reponse>
Structure ta réponse ainsi (utilise uniquement les sections pertinentes) :
🔴 ALERTE ALLERGIE : [si applicable]
🟠 INTERACTION MÉDICAMENTEUSE : [si applicable]
🟡 AVERTISSEMENT DOSAGE : [si applicable]
🟡 CONTRE-INDICATION : [si applicable]
✅ BILAN : [synthèse en 1-2 phrases — sûr ou préoccupant]
</format_reponse>
```

**Why this structure (HIGH confidence — Anthropic official prompting best practices):**
- XML tags (`<role>`, `<dossier_patient>`, `<regles>`) reduce misinterpretation when mixing instructions and variable data
- Explicit role reduces hallucination of diagnoses
- Numbered rules are more reliably followed than prose paragraphs
- Format section constrains output to scannable, decision-relevant structure
- "Réponds en français" is explicit — Groq llama-3.3-70b follows this reliably

### Two-Mode Prompt Strategy

**Mode 1: Auto-alert** — triggered when a prescription draft is created. System prompt includes full dossier + the specific drug being prescribed. Temperature 0.1 (minimal creativity, maximum reliability).

**Mode 2: Free-form Q&A** — doctor types a question. System prompt includes full dossier but no specific drug. Question goes as the user message. Temperature 0.2 (slightly more conversational).

Both modes share the same patient context string (built by `buildPatientContext()`). The only difference is what's in `<prescription_en_cours>` (populated for mode 1, absent for mode 2).

### Multi-Turn Conversation Management

Keep the conversation `messages` array as `useState` in the component. Pass the full array to the proxy on each turn. Do NOT summarize or truncate the history — at ~100 tokens per turn and a 32k context window in Groq, a 20-turn conversation costs ~2,000 tokens of history. This is negligible.

```javascript
// On send:
const newMessages = [
  ...messages.filter(m => m.role !== "alert"), // strip alert-only messages (no role in API)
  { role: "user", content: userInput }
];
// Pass newMessages to the streaming call, then append assistant response
```

Alert messages (mode 1 proactive warnings) should NOT be added to the API conversation history — they are UI-only display items. Only `user` and `assistant` roles go to the API.

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `@ai-sdk/react` (`useChat` hook) | Adds Vercel AI SDK as a dependency; requires restructuring the entire fetch layer; overkill for one chat panel | Native `fetch` + `ReadableStream` as shown above |
| `react-query` or `swr` | Unnecessary abstraction for a single streaming endpoint | `useState` + `useEffect` + `useCallback` |
| `EventSource` API | Does not support POST requests — cannot send the patient context payload | `fetch` with `ReadableStream` (see pattern above) |
| Chat UI component libraries (`react-chatbotify`, `react-chat-elements`, `chatscope`) | All require npm install; all add opinionated DOM structure that conflicts with inline-style approach | Pure React div/button/input with inline styles |
| Markdown renderers (`react-markdown`) | Adds dependency; the clinical response format uses emoji-prefixed text lines, not markdown | Parse the response as plain text; split on `\n` for rendering |
| Real-time drug interaction APIs (DrugBank, OpenFDA) | Out of scope per PROJECT.md; adds auth/cost/latency complexity | Claude/Groq for all interaction reasoning using static `DB_MEDICAMENTS` |
| `WebSocket` | Stateful connection complexity not needed for request-response pattern | POST + SSE is simpler and matches existing proxy architecture |
| Separate React component file | PROJECT.md explicitly: "new chatbot should be added as a sub-component within this file" | Define `function ClinicalChatbot(...)` inside `SmartUX_AI_Bots.jsx` |

---

## Stack Patterns by Variant

**If the doctor has no patient selected:**
- Chatbot shows "Veuillez sélectionner un patient" — disable input
- No patient context is passed to the system prompt
- Because: `buildPatientContext()` requires a patient object; null patient = null context

**If the auto-alert is triggered (prescription draft created):**
- Use Mode 1 prompt with `<prescription_en_cours>` populated
- Add the response as a UI-only `{ role: "alert" }` message (styled differently — amber/red badge)
- Do NOT add it to the API conversation history

**If streaming is not yet implemented (Phase 1 fallback):**
- Fall back to existing `fetch("http://localhost:3001/api/claude", ...)` pattern
- Simpler to implement; add streaming in a later iteration
- The existing non-streaming endpoint already works and returns `data.content[0].text`

**If token length becomes a concern (future: many prescriptions):**
- Filter `currentPrescriptions` to active-only (already done if `is_validated && !is_cancelled`)
- Cap observations at 2 most recent
- Hard limit: `buildPatientContext()` output should never exceed 1,500 tokens (~6,000 characters) — well achievable with this data set

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| `react@19.2.4` | `react-dom@19.2.4` | Already matched |
| `express@^5.2.1` | `cors@^2.8.6`, `better-sqlite3@^12.6.2` | All already installed |
| `groq-sdk@^0.9+` | Node.js 18+ | Server-only; not bundled |
| `react-scripts@5.0.1` | React 18 officially, but works with React 19 in this project | Do not eject or upgrade |
| `fetch` + `ReadableStream` | Chrome 93+, Firefox 102+, Safari 14.1+ | Hospital workstations likely Chrome — confirm browser target |

---

## Concrete Component Skeleton

This is the structure to implement inside `SmartUX_AI_Bots.jsx`:

```javascript
function ClinicalChatbot({ patient, prescriptions, currentDraft }) {
  // patient: DB_PATIENTS record | null
  // prescriptions: active prescriptions for this patient
  // currentDraft: the prescription being composed | null

  const [messages, setMessages] = useState([]); // { id, role, content, timestamp, isStreaming }
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const messagesEndRef = useRef(null);
  const abortRef = useRef(null);

  // Build patient context once, memoized
  const patientContext = useMemo(() =>
    patient ? buildPatientContext(patient, prescriptions) : null,
    [patient, prescriptions]
  );

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  // Auto-alert: fires when currentDraft changes and patient is selected
  useEffect(() => {
    if (!currentDraft?.drug_name_free || !patientContext) return;
    triggerAutoAlert(currentDraft);
  }, [currentDraft?.drug_name_free, patientContext]);

  // ... send(), triggerAutoAlert(), render
}
```

---

## Sources

- Claude API streaming docs — `https://platform.claude.com/docs/en/build-with-claude/streaming` — SSE event format, ReadableStream pattern (HIGH confidence)
- Claude prompting best practices — `https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices` — XML tags, role, format control (HIGH confidence)
- Groq Community FAQ — `https://community.groq.com/t/how-do-i-enable-streaming-for-real-time-responses/480` — `stream: true` parameter, SSE headers (MEDIUM confidence — official forum)
- Groq Text Generation docs — `https://console.groq.com/docs/text-chat` — streaming parameter confirmation (MEDIUM confidence)
- Direct codebase inspection — `/Users/neylesso/UX/smartux-ai/src/SmartUX_AI_Bots.jsx`, `server.js`, `database.js`, `package.json` — all stack facts (HIGH confidence — primary source)
- Anthropic healthcare announcement — `https://www.anthropic.com/news/healthcare-life-sciences` — Claude healthcare applicability (MEDIUM confidence)

---

*Stack research for: Clinical AI chatbot panel — SILLAGE hospital prescription system*
*Researched: 2026-03-05*
