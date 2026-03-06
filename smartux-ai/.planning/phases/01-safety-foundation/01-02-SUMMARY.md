---
phase: 01-safety-foundation
plan: "02"
subsystem: api
tags: [react, jest, tdd, clinical, safety, disclaimer, french, groq]

# Dependency graph
requires:
  - phase: 01-safety-foundation plan 01
    provides: "buildDossierContext(patient, prescriptions) — pure sync function already inserted in SmartUX_AI_Bots.jsx"
provides:
  - "callClaudeChat(systemPrompt, userMessage, history=[]) — exported async wrapper for all Claude calls with SAFE-02 dual-layer disclaimer enforcement"
  - "CLAUDE_SYSTEM_PROMPT_ALERT — exported French-language alert system prompt requiring disclaimer and classification"
  - "CLAUDE_SYSTEM_PROMPT_CHAT — exported French-language chat system prompt requiring disclaimer and clinical humility"
  - "Unit test suite (6 tests) covering all SAFE-02 disclaimer enforcement and API error scenarios"
affects:
  - "02-alert-system (Phase 2 — will import callClaudeChat + CLAUDE_SYSTEM_PROMPT_ALERT)"
  - "03-chat-panel (Phase 3 — will import callClaudeChat + CLAUDE_SYSTEM_PROMPT_CHAT with history array)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "TDD Red-Green cycle with Jest (react-scripts test)"
    - "global.fetch mock pattern for testing fetch-based wrappers without jest-fetch-mock"
    - "Dual-layer disclaimer enforcement: system prompt (Layer 1) + runtime string check (Layer 2)"
    - "Named export pattern for testability from SmartUX_AI_Bots.jsx"

key-files:
  created:
    - "src/__tests__/callClaudeChat.test.js"
  modified:
    - "src/SmartUX_AI_Bots.jsx"

key-decisions:
  - "Dual-layer disclaimer: system prompt instructs Claude to begin with disclaimer AND wrapper prepends it as failsafe if Claude omits (model drift protection)"
  - "history parameter defaults to [] — Phase 3 passes conversation history, Phase 2 alert calls omit it (single-turn)"
  - "max_tokens: 2000 — double the parseWithClaude value to accommodate longer clinical reasoning responses"
  - "API errors propagate as thrown errors — callers (Phase 2/3) own the error UX, wrapper stays thin"

patterns-established:
  - "callClaudeChat is the single entry point for all Claude API calls in the codebase"
  - "Disclaimer constant defined once (DISCLAIMER const) — single source of truth for string matching"
  - "System prompts as exported named constants — importable by callers without duplicating strings"

requirements-completed: [SAFE-02]

# Metrics
duration: 2min
completed: 2026-03-06
---

# Phase 1 Plan 02: Safety Foundation — callClaudeChat Summary

**Async Claude wrapper with dual-layer SAFE-02 disclaimer enforcement (system prompt mandate + runtime prepend failsafe), two French-language system prompt constants, and 6 green Jest tests.**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-03-06T03:34:28Z
- **Completed:** 2026-03-06T03:36:52Z
- **Tasks:** 2 (Task 1: TDD RED scaffold, Task 2: TDD GREEN implementation)
- **Files modified:** 2 (SmartUX_AI_Bots.jsx, callClaudeChat.test.js)

## Accomplishments

- `callClaudeChat(systemPrompt, userMessage, history=[])` exported from `src/SmartUX_AI_Bots.jsx` — single async gateway for all Claude calls in the codebase
- SAFE-02 dual-layer disclaimer enforcement: system prompt mandates "Analyse assistée par IA — vérification clinique recommandée." at the start of every response, and the wrapper prepends it as a failsafe if the model omits it
- `CLAUDE_SYSTEM_PROMPT_ALERT` and `CLAUDE_SYSTEM_PROMPT_CHAT` exported as named constants in French with explicit "EXCLUSIVEMENT en français" instruction
- 6-test Jest suite passing green, covering all SAFE-02 scenarios: disclaimer present, disclaimer injected when absent, 500 error throws, history ordering, system role placement, default empty history

## Task Commits

Each task was committed atomically:

1. **Task 1: Scaffold test file (TDD RED)** — `4ab7bc9` (test)
2. **Task 2: Implement callClaudeChat and system prompts (TDD GREEN)** — `982d4ff` (feat)

_TDD cycle: RED commit confirmed all 6 tests failing (import error), GREEN commit confirmed all 6 passing._

## Files Created/Modified

- `src/__tests__/callClaudeChat.test.js` — 6 Jest unit tests with global.fetch mock, disclaimer assertion, history ordering check, default [] behavior
- `src/SmartUX_AI_Bots.jsx` — `callClaudeChat` async function + `CLAUDE_SYSTEM_PROMPT_ALERT` + `CLAUDE_SYSTEM_PROMPT_CHAT` + `DISCLAIMER` const inserted after `buildDossierContext` block (line 247+), before `exportPDF()`

## Decisions Made

- **Dual-layer disclaimer:** Both layers are essential. The system prompt (Layer 1) relies on model compliance; the runtime check (Layer 2) protects against model drift or prompt injection that could drop the disclaimer. SAFE-02 requires the disclaimer to never fall through.
- **history defaults to []:** Keeps the function signature clean for Phase 2 single-turn alert calls while supporting Phase 3 multi-turn chat by passing the history array.
- **max_tokens: 2000:** Set higher than the 1000 used in `parseWithClaude` to allow complete clinical reasoning in alert and chat responses.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

- Pre-existing `App.test.js` failure ("renders learn react link") persists — unchanged from Plan 01, out of scope per deviation rules scope boundary.

## User Setup Required

None — no external service configuration required. The existing Groq proxy at `http://localhost:3001/api/claude` is reused with no changes.

## Next Phase Readiness

- `callClaudeChat`, `CLAUDE_SYSTEM_PROMPT_ALERT`, and `CLAUDE_SYSTEM_PROMPT_CHAT` are ready to be imported by Phase 2 (AlertSystem)
- Phase 2 caller pattern: `buildDossierContext(patient, prescriptions)` → pass result as part of `userMessage` to `callClaudeChat(CLAUDE_SYSTEM_PROMPT_ALERT, userMessage)`
- Phase 3 caller pattern: `callClaudeChat(CLAUDE_SYSTEM_PROMPT_CHAT, userMessage, history)` with accumulating history array
- All 16 plan tests passing (10 from Plan 01, 6 from Plan 02); pre-existing App.test.js failure is unrelated

---
*Phase: 01-safety-foundation*
*Completed: 2026-03-06*

## Self-Check: PASSED

- FOUND: src/__tests__/callClaudeChat.test.js
- FOUND: src/SmartUX_AI_Bots.jsx (with `export async function callClaudeChat` at line 293)
- FOUND: src/SmartUX_AI_Bots.jsx (with `export const CLAUDE_SYSTEM_PROMPT_ALERT` at line 250)
- FOUND: src/SmartUX_AI_Bots.jsx (with `export const CLAUDE_SYSTEM_PROMPT_CHAT` at line 276)
- FOUND: .planning/phases/01-safety-foundation/01-02-SUMMARY.md
- FOUND: 4ab7bc9 (test TDD RED commit)
- FOUND: 982d4ff (feat TDD GREEN commit)
- Tests: 6/6 callClaudeChat passing green, 16/17 total (App.test.js pre-existing failure, out of scope)
