# Phase 3: Chat Panel — Research

**Researched:** 2026-03-06
**Domain:** SSE streaming (Express/Groq), React drawer UX, `useReducer` chat state
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CHAT-01 | Doctor can type free-form clinical questions about the selected patient and receive AI answers | Groq streaming API + `callClaudeChat` wrapper reuse; ChatPanel component with prompt built from `buildDossierContext` |
| CHAT-02 | Chat context clears automatically when a different patient is selected | `useEffect` keyed on `selectedPatientId` dispatches `RESET` action; `key={selectedPatientId}` on component unmounts/remounts state entirely |
| CHAT-03 | AI responses stream word-by-word via `/api/claude-stream` SSE route | New Express route: `stream: true` to Groq, pipes OpenAI-compatible SSE chunks back; frontend reads `res.body.getReader()` + `TextDecoder` |
| UX-01 | Chat panel opens/closes as dismissible drawer that does not cover the prescription form | CSS `position: fixed`, right-side slide-in, layout does not shift; toggle button in header; `chatOpen` boolean in root state |
</phase_requirements>

---

## Summary

Phase 3 adds a streaming clinical chat drawer to the existing SmartUX-AI prescription screen. The backend work is a single new Express route (`/api/claude-stream`) that forwards the chat request to the Groq API with `stream: true`, then pipes the OpenAI-compatible SSE token stream back to the browser. The frontend work is a `ChatPanel` React component that manages its own chat state with `useReducer`, reads the streaming response chunk-by-chunk with the Fetch `ReadableStream` API, and auto-resets when the active patient changes.

The project already uses `callClaudeChat` (a `fetch`-based wrapper to `localhost:3001/api/claude`) and `buildDossierContext` (a pure function that produces a structured patient summary string). Both are directly reusable by Phase 3: the system prompt for the chat panel should be built from `buildDossierContext`, and the streaming route mirrors the existing `/api/claude` route with `stream: true` added.

The primary architectural risk is browser streaming support: `fetch` + `ReadableStream` requires Chrome 93+, Firefox 102+, Safari 14.1+. The STATE.md already flags this concern. The drawer must be `position: fixed` on the right side so that when it opens it does not reflow the existing prescription layout (UX-01 is explicit that it must not cover the form).

**Primary recommendation:** Add one Express route (`/api/claude-stream`) that sets SSE headers and pipes Groq token chunks as `data: <token>\n\n`. In the React component, consume the stream with `res.body.getReader()` and `TextDecoder`, dispatching each decoded token into `useReducer`. Reset state on patient change via `useEffect` or by rendering the panel with `key={selectedPatientId}`.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Express (existing) | 5.2.1 | Add `/api/claude-stream` route | Already in use; no new dependency |
| Groq API (existing) | REST via `fetch` | LLM provider (llama-3.3-70b-versatile) | Already in use at `/api/claude`; `stream: true` is the only addition |
| React (existing) | 19.2.4 | `ChatPanel` component, `useReducer`, `useEffect` | Already in use; no new dependency |
| Fetch + ReadableStream | Browser native | Consume SSE stream from `/api/claude-stream` | Native API; no library needed; already used throughout codebase |
| TextDecoder | Browser native | Decode binary chunks to string | Native; no library needed |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `useRef` (existing) | React built-in | Auto-scroll `bottomRef` to latest message | Used in NLPBot already; same pattern for ChatPanel |
| `useCallback` (existing) | React built-in | Stable `sendMessage` handler | Prevents re-renders inside the chat form |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `fetch` + `ReadableStream` for SSE | `EventSource` | EventSource only supports GET requests; chat needs POST to send patient context + message. Use fetch. |
| `useReducer` for chat state | Multiple `useState` calls | Multi-field state (messages, streaming text, isLoading, isOpen) is a natural fit for reducer; avoids stale-closure bugs on concurrent state updates |
| `position: fixed` drawer | Flex sidebar column | Fixed drawer does not cause layout reflow; NLPBot/prescription form stays at full width. Fixed is correct for UX-01. |
| Groq SDK npm package | Direct `fetch` | Project constraint: no new packages unless absolutely necessary. Direct `fetch` already established at `/api/claude`. |

**Installation:** None — no new packages required. All functionality uses existing Express, Groq REST API, and React built-ins.

---

## Architecture Patterns

### Recommended Project Structure

```
server.js                         # Add /api/claude-stream route here (Plan 03-01)
src/SmartUX_AI_Bots.jsx           # Add ChatPanel component here (Plan 03-02)
  └─ SmartUXBots (root)           # Add chatOpen state + toggle button here
      └─ ChatPanel                 # New sub-component (same file, same convention)
```

No new files. All code stays in the two existing files, matching the project constraint ("All new code within SmartUX_AI_Bots.jsx") and the single-file server convention.

### Pattern 1: Express SSE Route (Plan 03-01)

**What:** A POST route that forwards the request body to Groq with `stream: true`, then reads the Groq response body as a `ReadableStream` and writes each token as a `data:` SSE event.

**When to use:** Any time a non-GET request needs to stream LLM tokens back to the browser. EventSource cannot POST, so fetch + ReadableStream is mandatory.

**Example:**
```javascript
// Source: Groq API docs + Express SSE pattern
app.post("/api/claude-stream", async (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders(); // Send headers immediately so browser begins reading

  const { messages, max_tokens = 1000 } = req.body;

  try {
    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages,
        max_tokens,
        temperature: 0.3,
        stream: true,           // KEY DIFFERENCE from /api/claude
      }),
    });

    const reader = groqRes.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      // Groq streams OpenAI-compatible SSE lines: "data: {...}\n\n"
      // Each line may contain multiple tokens or a "data: [DONE]" terminator
      const lines = chunk.split("\n").filter(l => l.startsWith("data: "));
      for (const line of lines) {
        const payload = line.slice(6).trim();
        if (payload === "[DONE]") {
          res.write("data: [DONE]\n\n");
          res.end();
          return;
        }
        try {
          const json = JSON.parse(payload);
          const token = json.choices?.[0]?.delta?.content;
          if (token) {
            res.write(`data: ${token}\n\n`); // Forward token as SSE event
          }
        } catch (_) {
          // Skip malformed lines
        }
      }
    }
    res.end();
  } catch (e) {
    res.write(`data: [ERROR] ${e.message}\n\n`);
    res.end();
  }
});
```

**Critical detail:** Call `res.flushHeaders()` immediately after setting headers. Without this, Express buffers and the browser does not start reading until the buffer fills or the request completes — defeating the purpose of streaming.

### Pattern 2: ChatPanel `useReducer` State (Plan 03-02)

**What:** A reducer managing all chat state in one place to avoid stale-closure bugs when reading/writing multiple fields during an async stream.

**When to use:** Any component with interrelated async state (messages array, streaming buffer, loading flag).

**Example:**
```javascript
// Source: React docs useReducer pattern
const initialState = { messages: [], streamingText: "", isLoading: false };

function chatReducer(state, action) {
  switch (action.type) {
    case "SEND":
      return {
        ...state,
        messages: [...state.messages, { role: "user", text: action.text }],
        isLoading: true,
        streamingText: "",
      };
    case "TOKEN":
      return { ...state, streamingText: state.streamingText + action.token };
    case "DONE":
      return {
        ...state,
        messages: [
          ...state.messages,
          { role: "assistant", text: state.streamingText },
        ],
        streamingText: "",
        isLoading: false,
      };
    case "ERROR":
      return { ...state, isLoading: false, streamingText: "" };
    case "RESET":
      return initialState;
    default:
      return state;
  }
}

function ChatPanel({ patient, selectedPatientId }) {
  const [state, dispatch] = useReducer(chatReducer, initialState);
  const bottomRef = useRef(null);

  // CHAT-02: Reset on patient switch
  useEffect(() => {
    dispatch({ type: "RESET" });
  }, [selectedPatientId]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [state.messages, state.streamingText]);

  const sendMessage = useCallback(async (text) => {
    if (!text.trim() || !patient) return;
    dispatch({ type: "SEND", text });

    const dossier = buildDossierContext(patient, []);
    const systemPrompt = `${CLAUDE_SYSTEM_PROMPT_CHAT}\n\n=== DOSSIER PATIENT ===\n${dossier}`;

    const res = await fetch("http://localhost:3001/api/claude-stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [
          { role: "system", content: systemPrompt },
          ...state.messages.map(m => ({
            role: m.role === "user" ? "user" : "assistant",
            content: m.text,
          })),
          { role: "user", content: text },
        ],
      }),
    });

    const reader = res.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      for (const line of chunk.split("\n")) {
        if (!line.startsWith("data: ")) continue;
        const payload = line.slice(6).trim();
        if (payload === "[DONE]") { dispatch({ type: "DONE" }); return; }
        if (payload.startsWith("[ERROR]")) { dispatch({ type: "ERROR" }); return; }
        dispatch({ type: "TOKEN", token: payload });
      }
    }
    dispatch({ type: "DONE" });
  }, [patient, state.messages]);
```

### Pattern 3: Drawer UX — `position: fixed` (Plan 03-02)

**What:** The chat drawer is rendered as a `position: fixed` panel on the right edge of the viewport, so opening/closing it does not shift the prescription form layout.

**When to use:** Any panel that must coexist alongside existing content without reflowing it (UX-01 requirement).

**Example:**
```javascript
// chatOpen boolean lives in SmartUXBots root state
// Toggle button placed in the header bar (already exists)

// Drawer overlay — rendered at root level, after main content
{chatOpen && (
  <div style={{
    position: "fixed",
    top: 0,
    right: 0,
    width: 380,
    height: "100vh",
    background: CARD,
    borderLeft: `1px solid ${BORDER}`,
    boxShadow: "-4px 0 24px rgba(0,0,0,0.12)",
    display: "flex",
    flexDirection: "column",
    zIndex: 200,
    animation: "slideInRight .22s ease both",
  }}>
    <ChatPanel
      patient={selectedPatient}
      selectedPatientId={selectedPatientId}
      onClose={() => setChatOpen(false)}
    />
  </div>
)}
```

CSS animation for the slide: `@keyframes slideInRight { from { transform: translateX(100%) } to { transform: translateX(0) } }` — this can be added inline in the same pattern as the existing `.loader` spin animation.

### Pattern 4: Guard State (CHAT-01)

When no patient is selected, the ChatPanel renders a non-interactive guard state and disables the input.

```javascript
if (!patient) {
  return (
    <div style={{ flex: 1, display: "grid", placeItems: "center", color: MUTED }}>
      Aucun patient sélectionné
    </div>
  );
}
```

The send button is also disabled: `disabled={!patient || !input.trim() || state.isLoading}`.

### Pattern 5: System Prompt for Chat (Plan 03-02)

The chat system prompt is separate from `CLAUDE_SYSTEM_PROMPT_ALERT`. It should instruct the model to answer clinical questions about the patient in French, remind it of the dossier context, and mandate the disclaimer. Example constant to add in SmartUX_AI_Bots.jsx:

```javascript
const CLAUDE_SYSTEM_PROMPT_CHAT = `Tu es un assistant médical clinique pour médecins hospitaliers.
Tu réponds en français à des questions cliniques sur le patient décrit dans le dossier ci-dessous.
Commence toujours ta réponse par "${DISCLAIMER}".
Sois précis, concis, et signale explicitement toute incertitude clinique.
Tu ne poses pas de diagnostic définitif — tu fournis une aide décisionnelle.`;
```

### Anti-Patterns to Avoid

- **Using `EventSource` for the streaming fetch:** EventSource is GET-only. The chat route needs POST to send messages and patient context. Use `fetch` + `ReadableStream`.
- **Splitting state across many `useState` calls during streaming:** Updating `messages`, `streamingText`, and `isLoading` separately causes race conditions. Use `useReducer`.
- **Rendering ChatPanel as an inline flex column:** This pushes the prescription form sideways (violates UX-01). Use `position: fixed`.
- **Resetting chat state on every render:** The `useEffect` for CHAT-02 must have `[selectedPatientId]` as its dependency, not `[patient]` (to avoid resetting on unrelated re-renders).
- **Directly writing `res.write(json_string)` without `res.flushHeaders()`:** Express buffers by default. Without `flushHeaders()`, the browser sees nothing until the stream ends.
- **Applying the SAFE-02 dual-layer disclaimer to alert text only:** The chat response should also carry the disclaimer. The system prompt mandates it at layer 1; a wrapper check at layer 2 should prepend it if absent (same pattern as `callClaudeChat`).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SSE parsing on client | Custom SSE parser | `fetch` + `ReadableStream` + `TextDecoder` line-by-line split | Browser native; handles chunked transfer encoding automatically |
| Streaming token accumulation | Custom ring buffer | `useReducer` `TOKEN` action appending to string | Reducer prevents stale-closure bugs during rapid token dispatch |
| Drawer animation | CSS transforms from scratch | Inline `@keyframes slideInRight` matching existing `.loader` pattern | Already established inline-style convention; keeps no external dep |
| Patient context assembly | Inline string concatenation in ChatPanel | `buildDossierContext(patient, prescriptions)` — already exported | Phase 1 already built and tested this function |
| Patient dossier fetching | New fetch inside ChatPanel | Pass `patient` prop from root (already has `selectedPatient`) | Avoid re-fetching data already in root state |

**Key insight:** The entire server-side streaming problem reduces to two changes: add `stream: true` to the existing Groq fetch body, and pipe the response through SSE headers instead of `res.json()`.

---

## Common Pitfalls

### Pitfall 1: Express 5.x and `res.flushHeaders()`

**What goes wrong:** The browser receives no data until the entire response is complete, making streaming appear identical to non-streaming.
**Why it happens:** Express (and Node's http module) buffers write calls by default. SSE requires the response headers to be sent immediately so the browser opens the event stream.
**How to avoid:** Call `res.flushHeaders()` immediately after `res.setHeader(...)` calls, before the async Groq fetch begins.
**Warning signs:** Browser DevTools Network tab shows the request as "pending" for the full LLM latency then arrives all at once.

### Pitfall 2: Stale `state.messages` in `sendMessage` Closure

**What goes wrong:** When the user sends a second message, the messages array in the closure is stale from the first render, dropping history.
**Why it happens:** `useCallback` captures `state.messages` at the time of creation. If the dependency array is wrong, the old value is used.
**How to avoid:** Include `state.messages` in `useCallback`'s dependency array. With `useReducer`, the reducer itself always has the latest state — so pass messages explicitly when dispatching `SEND`, rather than reading from a closure.
**Warning signs:** Each new message appears to be sent without conversation history; responses ignore prior context.

### Pitfall 3: CHAT-02 Reset Triggers on Wrong Dependency

**What goes wrong:** Chat resets on every re-render, or never resets on patient switch.
**Why it happens:** Using `patient` (an object reference) as the dependency causes resets whenever the parent re-renders (object identity changes). Using `selectedPatientId` (a primitive) is stable.
**How to avoid:** `useEffect(() => { dispatch({ type: "RESET" }); }, [selectedPatientId])` — use the ID, not the object.
**Warning signs:** Chat clears unexpectedly (too often) or persists when switching patients (ID not in deps).

### Pitfall 4: Groq SSE Chunk Boundaries Don't Align with JSON Lines

**What goes wrong:** JSON parse errors on partial lines because a single `reader.read()` call can return a buffer that cuts across SSE line boundaries.
**Why it happens:** TCP delivers data in arbitrary chunks; one `read()` may deliver half a `data: {...}` line.
**How to avoid:** Accumulate a text buffer across `read()` calls. Split on `\n`, keep the trailing partial line for the next iteration.
**Warning signs:** Intermittent JSON parse errors in the server console; streaming stops mid-response.

**Mitigation pattern:**
```javascript
let buffer = "";
while (true) {
  const { value, done } = await reader.read();
  if (done) break;
  buffer += decoder.decode(value, { stream: true });
  const lines = buffer.split("\n");
  buffer = lines.pop(); // Keep incomplete last line
  for (const line of lines) {
    if (!line.startsWith("data: ")) continue;
    // ... parse and forward
  }
}
```

### Pitfall 5: Drawer `z-index` Conflict with Existing Header

**What goes wrong:** The chat drawer appears behind the sticky header (which already uses `position: sticky`).
**Why it happens:** The sticky header is in a stacking context; `z-index: 200` on the drawer may not be high enough depending on other stacking contexts.
**How to avoid:** The existing header at lines ~1390–1484 uses `position: sticky; top: 0; zIndex: 100` (verify exact value). Set the drawer to `zIndex: 200` (one level above). Since the drawer is rendered at the root component level (SmartUXBots return), it is in the root stacking context.
**Warning signs:** Drawer slides in but the header renders on top of it.

### Pitfall 6: Browser Compatibility (Flagged in STATE.md)

**What goes wrong:** SSE via `fetch` + `ReadableStream` fails on older hospital workstation browsers.
**Why it happens:** `ReadableStream` from `fetch` requires Chrome 93+, Firefox 102+, Safari 14.1+. STATE.md explicitly flags this risk.
**How to avoid:** Confirm browser versions before shipping. If the hospital uses browsers older than these versions, a fallback to polling or a non-streaming version may be required.
**Warning signs:** `res.body` is null or `getReader` is undefined at runtime.

---

## Code Examples

### SSE Route: Groq Streaming Proxy (Plan 03-01 reference)

```javascript
// Source: Groq API docs (console.groq.com/docs/text-chat) + Express SSE pattern
// File: server.js — add after existing /api/claude route

app.post("/api/claude-stream", async (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const { messages, max_tokens = 1000 } = req.body;
  let buffer = "";

  try {
    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages,
        max_tokens,
        temperature: 0.3,
        stream: true,
      }),
    });

    const reader = groqRes.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop(); // Retain incomplete trailing line
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const payload = line.slice(6).trim();
        if (payload === "[DONE]") {
          res.write("data: [DONE]\n\n");
          res.end();
          return;
        }
        try {
          const json = JSON.parse(payload);
          const token = json.choices?.[0]?.delta?.content;
          if (token) res.write(`data: ${token}\n\n`);
        } catch (_) { /* skip partial lines */ }
      }
    }
    res.write("data: [DONE]\n\n");
    res.end();
  } catch (e) {
    res.write(`data: [ERROR] ${e.message}\n\n`);
    res.end();
  }
});
```

### Frontend: Stream Consumption (Plan 03-02 reference)

```javascript
// Source: fetch ReadableStream pattern — tpiros.dev/blog/streaming-llm-responses-a-deep-dive/
// Inside ChatPanel.sendMessage()

const res = await fetch("http://localhost:3001/api/claude-stream", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ messages }),
});

if (!res.ok) { dispatch({ type: "ERROR" }); return; }

const reader = res.body.getReader();
const decoder = new TextDecoder();
let lineBuffer = "";

while (true) {
  const { value, done } = await reader.read();
  if (done) break;
  lineBuffer += decoder.decode(value, { stream: true });
  const lines = lineBuffer.split("\n");
  lineBuffer = lines.pop();
  for (const line of lines) {
    if (!line.startsWith("data: ")) continue;
    const payload = line.slice(6).trim();
    if (payload === "[DONE]") { dispatch({ type: "DONE" }); return; }
    if (payload.startsWith("[ERROR]")) { dispatch({ type: "ERROR" }); return; }
    dispatch({ type: "TOKEN", token: payload });
  }
}
dispatch({ type: "DONE" });
```

### Drawer Toggle in Root Component

```javascript
// In SmartUXBots root (SmartUX_AI_Bots.jsx)
const [chatOpen, setChatOpen] = useState(false);

// Toggle button — add to existing header bar
<button onClick={() => setChatOpen(o => !o)} style={{
  padding: "6px 12px", borderRadius: 8, border: "none",
  background: chatOpen ? ACCENT : "rgba(255,255,255,.15)",
  color: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 600,
  fontFamily: "'DM Sans', sans-serif",
}}>
  {chatOpen ? "Fermer chat" : "Chat clinique"}
</button>

// Drawer — rendered after <main>, at root level
{chatOpen && (
  <div style={{
    position: "fixed", top: 0, right: 0,
    width: 380, height: "100vh",
    background: CARD, borderLeft: `1px solid ${BORDER}`,
    boxShadow: "-4px 0 24px rgba(0,0,0,.12)",
    display: "flex", flexDirection: "column", zIndex: 200,
  }}>
    <ChatPanel
      patient={selectedPatient}
      selectedPatientId={selectedPatientId}
      onClose={() => setChatOpen(false)}
    />
  </div>
)}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `EventSource` for AI streaming | `fetch` + `ReadableStream` for POST-based SSE | Widely adopted ~2022–2023 with LLM boom | EventSource is GET-only; POST required for sending chat messages |
| Wait for full response (`res.json()`) | Stream tokens as they arrive (`stream: true`) | N/A — route-specific choice | Perceived responsiveness; user sees output in <1s vs 3–5s wait |
| Multiple `useState` for async state | `useReducer` for correlated state | React hooks convention; 2018+ | Eliminates stale closure bugs in async token loop |

**Deprecated/outdated for this project:**
- `callClaudeChat()` wrapper: Still valid for the alert system (non-streaming). Chat panel does NOT reuse it because it waits for a full response. The streaming route is a parallel path.

---

## Open Questions

1. **Buffer accumulation across large SSE chunks**
   - What we know: Groq (via LPU hardware) is extremely fast — tokens may arrive in large batches, potentially exceeding the line-buffer pattern's safety margin.
   - What's unclear: Whether a single `read()` can deliver dozens of complete SSE lines at once or just a few tokens.
   - Recommendation: The line-accumulation buffer pattern handles this correctly regardless of chunk size. No special handling needed.

2. **`res.flushHeaders()` in Express 5.x**
   - What we know: The project uses Express 5.2.1. `res.flushHeaders()` is standard in Node `http.ServerResponse` since Node 12.
   - What's unclear: Whether Express 5's response wrapper changes anything about flush behavior.
   - Recommendation: Test at implementation time. If flush is absent, use `res.socket?.setNoDelay(true)` as a fallback.

3. **Hospital browser version confirmation (from STATE.md)**
   - What we know: `ReadableStream` from fetch requires Chrome 93+, Firefox 102+, Safari 14.1+ (March 2026 — all current versions satisfy this).
   - What's unclear: Hospital workstation browser update policy.
   - Recommendation: If browser version cannot be confirmed before shipping, wrap the streaming logic in a feature-detect: `if (!res.body?.getReader)` and fall back to `callClaudeChat` (non-streaming).

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Jest (react-scripts 5.0.1 — Jest 27 built-in) + React Testing Library 16.3.2 |
| Config file | None — Jest config embedded in react-scripts |
| Quick run command | `npx react-scripts test --watchAll=false --testPathPattern="ChatPanel"` |
| Full suite command | `npx react-scripts test --watchAll=false` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CHAT-01 | ChatPanel sends message and renders streaming response | unit (RTL) | `npx react-scripts test --watchAll=false --testPathPattern="ChatPanel"` | Wave 0 |
| CHAT-01 | Guard state: no patient → shows "Aucun patient sélectionné", submit disabled | unit (RTL) | `npx react-scripts test --watchAll=false --testPathPattern="ChatPanel"` | Wave 0 |
| CHAT-02 | Switching `selectedPatientId` clears messages | unit (RTL) | `npx react-scripts test --watchAll=false --testPathPattern="ChatPanel"` | Wave 0 |
| CHAT-03 | `/api/claude-stream` route returns SSE tokens and `[DONE]` | unit (Jest mock fetch) | `npx react-scripts test --watchAll=false --testPathPattern="ChatPanel"` | Wave 0 |
| UX-01 | Drawer renders with `position: fixed`, does not affect main layout | unit (RTL + style check) | `npx react-scripts test --watchAll=false --testPathPattern="ChatPanel"` | Wave 0 |

All tests for Phase 3 are in Wave 0 (none exist yet). The test file must mock `global.fetch` to return a streaming `ReadableStream` — the same pattern already established in `callClaudeChat.test.js` and `AlertSystem.test.js`, but with a `ReadableStream` body instead of `json()`.

### Mock Pattern for Streaming Fetch (Wave 0 test infrastructure)

```javascript
// Adapted from existing callClaudeChat.test.js pattern
function mockStreamResponse(tokens) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      for (const token of tokens) {
        controller.enqueue(encoder.encode(`data: ${token}\n\n`));
      }
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });
  global.fetch = jest.fn().mockResolvedValue({ ok: true, body: stream });
}
```

### Sampling Rate

- **Per task commit:** `npx react-scripts test --watchAll=false --testPathPattern="ChatPanel"`
- **Per wave merge:** `npx react-scripts test --watchAll=false`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `src/__tests__/ChatPanel.test.js` — covers CHAT-01, CHAT-02, CHAT-03, UX-01
- [ ] `ReadableStream` mock helper (add to `ChatPanel.test.js` or shared `setupTests.js`)

---

## Sources

### Primary (HIGH confidence)

- Groq API docs (console.groq.com/docs/text-chat) — streaming with `stream: true`, chunk format `choices[0].delta.content`, `[DONE]` terminator
- Project source: `server.js` — existing `/api/claude` route structure, `GROQ_API_KEY`, `llama-3.3-70b-versatile` model
- Project source: `src/SmartUX_AI_Bots.jsx` — `buildDossierContext`, `callClaudeChat`, `DISCLAIMER`, `NLPBot`, `AlertSystem`, root state (`selectedPatientId`, `selectedPatient`)
- Project source: `src/__tests__/callClaudeChat.test.js` — established test pattern (mock fetch, jest.fn())
- Project source: `src/__tests__/AlertSystem.test.js` — established RTL test pattern with database mock

### Secondary (MEDIUM confidence)

- tpiros.dev/blog/streaming-llm-responses-a-deep-dive/ — `fetch` + `ReadableStream` + `TextDecoder` consumption pattern; verified against browser MDN spec
- console.groq.com/docs/openai — confirms Groq uses OpenAI-compatible SSE format (`ChatCompletionStreamOptions`, `data: [DONE]`)

### Tertiary (LOW confidence)

- STATE.md blocker note on browser streaming support (Chrome 93+, Firefox 102+, Safari 14.1+) — noted as unconfirmed for hospital workstations; needs operational verification

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all components are existing project dependencies; no new libraries
- Architecture: HIGH — SSE route pattern is a minimal diff on existing `/api/claude` route; drawer pattern is established React
- Pitfalls: HIGH for server-side (res.flushHeaders, buffer accumulation); MEDIUM for browser compat (flagged, not confirmed)

**Research date:** 2026-03-06
**Valid until:** 2026-04-06 (Groq API is stable; React 19 is stable; Express 5 is stable)
