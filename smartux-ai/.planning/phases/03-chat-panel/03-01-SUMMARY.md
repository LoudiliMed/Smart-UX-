---
phase: 03-chat-panel
plan: 01
subsystem: api
tags: [sse, streaming, groq, jest, react-testing-library, tdd]

# Dependency graph
requires:
  - phase: 02-alert-system
    provides: server.js Express structure and GROQ_API_KEY for route insertion
provides:
  - POST /api/claude-stream SSE route proxying Groq streaming to browser
  - src/__tests__/ChatPanel.test.js Wave 0 scaffold with mockStreamResponse helper and 5 test stubs (RED state)
affects: [03-02-chat-panel-component, 03-03-chat-panel-ux]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - SSE streaming: set SSE headers + res.flushHeaders() before async fetch; line accumulation buffer handles TCP chunk boundaries
    - TDD Wave 0: test scaffold created before implementation so RED state is verified before GREEN

key-files:
  created:
    - src/__tests__/ChatPanel.test.js
  modified:
    - server.js

key-decisions:
  - "Line accumulation buffer (buffer = lines.pop()) guards against TCP chunk boundary splits — tokens may arrive mid-line across separate read() calls"
  - "temperature: 0.3 for chat route (more natural) vs 0.1 for /api/claude NLP route (strict JSON extraction) — routes intentionally differ"
  - "TextEncoder, TextDecoder, ReadableStream polyfills added inline in test file (not setupTests.js) to keep polyfill scope minimal and explicit"
  - "ChatPanel stub returns null in jest.mock — tests B-E fail at the UI query level, confirming RED state without import errors"

patterns-established:
  - "SSE pattern: flushHeaders before fetch, line buffer, data: token\\n\\n events, data: [DONE]\\n\\n terminator"
  - "Stream mock pattern: mockStreamResponse(tokens) helper builds ReadableStream and assigns to global.fetch"

requirements-completed: [CHAT-03]

# Metrics
duration: 8min
completed: 2026-03-06
---

# Phase 3 Plan 01: ChatPanel SSE Route and Test Scaffold Summary

**POST /api/claude-stream SSE route added to Express with Groq streaming proxy, plus Wave 0 test scaffold (5 stubs, 1 passing, 4 RED) for all Phase 3 ChatPanel requirements**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-06T17:48:05Z
- **Completed:** 2026-03-06T17:56:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Added `POST /api/claude-stream` SSE route to server.js with `res.flushHeaders()`, line accumulation buffer, and `data: [DONE]` termination
- Created `src/__tests__/ChatPanel.test.js` with `mockStreamResponse` helper and 5 test stubs covering CHAT-01, CHAT-02, CHAT-03, UX-01
- Test A (mock infrastructure / CHAT-03) passes immediately — ReadableStream emits tokens then `[DONE]`
- Tests B-E are in RED state — ChatPanel stub returns null, confirming no false positives before implementation

## Task Commits

Each task was committed atomically:

1. **Task 1: Wave 0 test scaffold** - `e20db07` (test)
2. **Task 2: POST /api/claude-stream SSE route** - `028d188` (feat)

**Plan metadata:** (docs commit — see below)

_Note: TDD tasks — Task 1 is the RED phase (no GREEN yet, implementation deferred to 03-02)_

## Files Created/Modified
- `src/__tests__/ChatPanel.test.js` - Wave 0 scaffold: mockStreamResponse helper + 5 test stubs for CHAT-01, CHAT-02, CHAT-03, UX-01
- `server.js` - New POST /api/claude-stream SSE route inserted after /api/claude, before app.listen

## Decisions Made
- Line accumulation buffer (`buffer = lines.pop()`) guards against TCP chunk boundary splits (Pitfall 4 from RESEARCH.md) — essential for tokens that arrive mid-line across separate reader.read() calls
- temperature: 0.3 for the chat streaming route (more natural conversational answers) while /api/claude retains 0.1 (strict JSON extraction for NLP) — routes intentionally use different temperatures
- TextEncoder, TextDecoder, ReadableStream polyfills added inline in ChatPanel.test.js (not setupTests.js) — keeps polyfill scope minimal and explicit, avoids affecting other test files
- ChatPanel mock stub returns null so jsdom body shows `<div />` — tests B-E fail at the UI query level with "Unable to find element" errors, which is the correct RED state

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added TextEncoder and ReadableStream polyfills to test file**
- **Found during:** Task 1 (Wave 0 test scaffold)
- **Issue:** jsdom test environment lacks `TextEncoder`, `TextDecoder`, and `ReadableStream` globals — `mockStreamResponse` helper crashed with `ReferenceError: TextEncoder is not defined` then `ReferenceError: ReadableStream is not defined`
- **Fix:** Added inline polyfills using Node's `require("util")` for TextEncoder/TextDecoder and `require("stream/web")` for ReadableStream at the top of ChatPanel.test.js
- **Files modified:** src/__tests__/ChatPanel.test.js
- **Verification:** Test A passes after polyfills added; ReadableStream streams tokens correctly
- **Committed in:** e20db07 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking — missing jsdom polyfills)
**Impact on plan:** Fix is essential for test infrastructure to function. No scope creep — polyfills are test-only, not shipped code.

## Issues Encountered
- jsdom (used by react-scripts/Jest) does not include Web Streams API globals — required Node 16+ polyfills from `stream/web` and `util` modules. Fixed inline in test file.
- App.test.js was already failing before this plan (CRA default "learn react" test, never updated for the actual app) — pre-existing out-of-scope failure, not caused by our changes.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `/api/claude-stream` route is live — ChatPanel component in 03-02 can POST to it immediately
- Test scaffold (03-01) is in RED — all 4 ChatPanel tests will turn GREEN progressively as 03-02 and 03-03 implement the component
- GROQ_API_KEY is already set in server.js — no environment variable setup needed for streaming

---
*Phase: 03-chat-panel*
*Completed: 2026-03-06*
