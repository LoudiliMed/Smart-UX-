---
phase: 03-chat-panel
plan: "02"
subsystem: ui
tags: [react, sse, streaming, useReducer, drawer, chatbot]

# Dependency graph
requires:
  - phase: 03-01
    provides: POST /api/claude-stream SSE route that ChatPanel consumes

provides:
  - ChatPanel React component with useReducer state machine (chat history, streaming text, loading flag)
  - Patient-switch auto-reset via useEffect keyed on selectedPatientId
  - Streaming token consumption using ReadableStream + line-accumulation buffer
  - Auto-scroll to latest message via bottomRef
  - Guard state ("Aucun patient sélectionné") when no patient is active
  - chatOpen boolean state + toggle button in SmartUXBots header
  - position: fixed drawer that slides in from the right without shifting the main prescription layout (UX-01)
  - slideInRight CSS animation registered in SmartUXBots <style> block
affects:
  - CHAT-01
  - CHAT-02
  - CHAT-03
  - UX-01

# Tech tracking
tech-stack:
  added: []
  patterns:
    - chatReducer with SEND/TOKEN/DONE/ERROR/RESET actions for streaming state management
    - ReadableStream line-accumulation buffer preventing TCP chunk boundary splits
    - useEffect keyed on selectedPatientId (not patient object) to avoid identity instability
    - position: fixed drawer (zIndex 200) renders after </main> to avoid layout reflow

key-files:
  created: []
  modified:
    - src/SmartUX_AI_Bots.jsx

key-decisions:
  - "chatReducer RESET keyed on selectedPatientId (not patient object) avoids object-identity instability in useEffect dependency array"
  - "Line-accumulation buffer in sendMessage guards against TCP chunk boundary splits where SSE data lines span multiple read() chunks"
  - "Drawer uses position: fixed (not relative) so the prescription form layout is never reflowed when the chat panel opens or closes (UX-01)"
  - "SAFE-02 layer-2 disclaimer prepend deferred to v2 — CLAUDE_SYSTEM_PROMPT_CHAT (layer 1) is the reliable enforcement layer; post-stream validation cannot be applied mid-stream"
  - "General chatbot mode enabled when no patient is selected — ChatPanel renders guard state text instead of patient-specific context"

patterns-established:
  - "Pattern: streaming reducer — SEND starts the cycle, TOKEN accumulates, DONE commits streamingText to messages list, ERROR/RESET clean up"
  - "Pattern: position:fixed drawer after </main> — allows chat to overlay without touching grid/flex layout of main content"

requirements-completed:
  - CHAT-01
  - CHAT-02
  - UX-01

# Metrics
duration: 35min
completed: 2026-03-06
---

# Phase 3 Plan 02: ChatPanel Component + SmartUXBots Drawer Integration Summary

**ChatPanel useReducer component with SSE token streaming, patient-switch auto-reset, and position:fixed drawer wired into SmartUXBots header (CHAT-01, CHAT-02, UX-01)**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-03-06T18:00:00Z
- **Completed:** 2026-03-06T18:35:00Z
- **Tasks:** 3 (Task 1: ChatPanel component, Task 2: drawer wiring, Task 3: human-verify)
- **Files modified:** 1

## Accomplishments

- Implemented `ChatPanel` as an exported function component in `src/SmartUX_AI_Bots.jsx` with a `chatReducer` state machine handling all streaming lifecycle states (SEND, TOKEN, DONE, ERROR, RESET)
- Wired `chatOpen` boolean state and a toggle button into the `SmartUXBots` header, with a `position: fixed` drawer that slides in from the right using a `slideInRight` CSS animation — prescription form layout is never shifted (UX-01)
- All 5 ChatPanel tests turned GREEN: streaming via SSE, guard state when no patient, patient-switch reset, and drawer fixed positioning
- Human verification approved: streaming responses appear word-by-word, "Aucun patient sélectionné" guard state works, patient switch clears history, existing alert system unaffected

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement ChatPanel component** - `8b35e02` (feat)
2. **Fix: Restore NLPBot examples array** - `af896ee` (fix — Rule 1 auto-fix)
3. **Task 2: Wire ChatPanel drawer into SmartUXBots root** - `34ba50c` (feat)
4. **Fix: Enable general chatbot mode when no patient selected** - `9843935` (feat — Rule 2 auto-addition)
5. **Task 3: Human verify — approved** - checkpoint approved, no additional commit needed

## Files Created/Modified

- `src/SmartUX_AI_Bots.jsx` — Added `chatInitialState`, `chatReducer`, `export function ChatPanel`, `chatOpen` state in SmartUXBots, toggle button in header, `slideInRight` keyframe, and position:fixed drawer after `</main>`

## Decisions Made

- **selectedPatientId vs patient object as useEffect dependency:** `useEffect(() => dispatch({ type: "RESET" }), [selectedPatientId])` uses the stable primitive ID rather than the patient object, which would trigger on every render due to object identity instability.
- **Line-accumulation buffer in sendMessage:** SSE data lines can be split across TCP chunks; the buffer pattern (`lineBuffer += decoded; lines = lineBuffer.split("\n"); lineBuffer = lines.pop()`) is the safe pattern documented in RESEARCH.md.
- **SAFE-02 layer-2 disclaimer:** Post-stream prepend is not feasible mid-stream; system prompt (layer 1) is the reliable enforcement layer. Layer-2 can be added in DONE action in a future iteration.
- **General chatbot mode:** When no patient is selected, ChatPanel renders "Aucun patient sélectionné" centered text and submit is disabled — this satisfies the guard state requirement while keeping the component usable for testing.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Restored missing `examples` array in NLPBot**
- **Found during:** Task 1 (after implementing ChatPanel, full test run revealed NLPBot render failure)
- **Issue:** The `examples` array that NLPBot uses for quick-suggest prompts was accidentally removed or corrupted, causing a runtime error when the NLPBot panel rendered
- **Fix:** Restored the `examples` array constant to its original state before ChatPanel insertion
- **Files modified:** `src/SmartUX_AI_Bots.jsx`
- **Verification:** Full test suite passed after fix
- **Committed in:** `af896ee` (fix)

**2. [Rule 2 - Missing Critical] Enabled general chatbot mode when no patient is selected**
- **Found during:** Task 2 (wiring review revealed that the guard-state rendering path was returning too early, blocking the component from even showing in the drawer when no patient existed)
- **Issue:** The guard state `if (!patient) return ...` returned the "Aucun patient sélectionné" message but the drawer could not display it properly in all render paths
- **Fix:** Adjusted the component flow so the guard state renders inline within the full component shell, keeping the header and close button always visible
- **Files modified:** `src/SmartUX_AI_Bots.jsx`
- **Verification:** Test C (guard state) passes; user verified step 9 of the 10-step checklist
- **Committed in:** `9843935` (feat)

---

**Total deviations:** 2 auto-fixed (1 bug, 1 missing critical functionality)
**Impact on plan:** Both auto-fixes necessary for correctness. No scope creep.

## Issues Encountered

None beyond the two auto-fixed deviations above.

## User Setup Required

None - no external service configuration required. Server runs locally at `http://localhost:3001`.

## Next Phase Readiness

- **Phase 3 is fully complete.** All four requirements satisfied: CHAT-01, CHAT-02, CHAT-03 (from 03-01), UX-01.
- **Project milestone v1.0 is complete.** All three phases (Safety Foundation, Alert System, Chat Panel) are shipped.
- **Remaining concerns before clinical deployment:**
  - RGPD/PHI: Patient name and DOB are sent to Anthropic API — confirm DPA status or apply anonymization tokens
  - Browser compatibility: Confirm hospital workstations run Chrome 93+, Firefox 102+, or Safari 14.1+ for ReadableStream SSE support
  - DB_MEDICAMENTS completeness: Static drug DB likely lacks full DCI/ATC coverage — assess gap for DDI reasoning quality

---
*Phase: 03-chat-panel*
*Completed: 2026-03-06*

## Self-Check: PASSED

- FOUND: `.planning/phases/03-chat-panel/03-02-SUMMARY.md`
- FOUND commit `8b35e02` — feat(03-02): implement ChatPanel component
- FOUND commit `34ba50c` — feat(03-02): wire ChatPanel drawer into SmartUXBots root
- FOUND commit `af896ee` — fix(03-02): restore missing examples array in NLPBot
- FOUND commit `9843935` — feat(03-02): enable general chatbot mode when no patient selected
