---
phase: 02-alert-system
plan: "01"
subsystem: ui
tags: [react, jest, testing-library, alert-system, groq, proxy]

# Dependency graph
requires:
  - phase: 01-safety-foundation
    provides: buildDossierContext, CLAUDE_SYSTEM_PROMPT_ALERT, callClaudeChat exports used directly by AlertSystem
provides:
  - parseAlertResponse exported function parsing CRITIQUE/MODERE/FAIBLE lines from Claude response
  - AlertBanner atom with data-severity attribute and severity-colored left border
  - AlertSystem component with 1200ms debounce, patient header, dismiss/acknowledge flows
  - server.js proxy fixed to forward full messages array (system role included)
  - AlertSystem test suite: 15 tests covering ALRT-01, ALRT-02, ALRT-03, UX-02
affects:
  - 02-alert-wiring (Plan 02-02 wires AlertSystem into NLPBot/SmartUXBots root)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - TDD RED/GREEN: scaffold failing tests first, then implement to pass
    - Debounced useEffect with requestIdRef for race condition prevention
    - data-severity attribute for CSS-testable severity styling
    - Dual acknowledge/dismiss UX: CRITIQUE requires explicit button, MODERE/FAIBLE single click

key-files:
  created:
    - src/__tests__/AlertSystem.test.js
  modified:
    - src/SmartUX_AI_Bots.jsx
    - server.js

key-decisions:
  - "Proxy fix is surgical: only /api/claude handler changed, no other routes touched"
  - "parseAlertResponse returns empty array for both no-match and explicit 'Aucune interaction' response"
  - "AlertSystem is self-contained in SmartUX_AI_Bots.jsx — not yet wired to root (Plan 02-02 handles wiring)"
  - "Race condition prevention via requestIdRef counter: stale async responses ignored on patient/drug change"
  - "Error fallback renders FAIBLE alert instead of crashing — preserves UX continuity"

patterns-established:
  - "data-severity attribute pattern: enables style testing via container.querySelector('[data-severity=CRITIQUE]')"
  - "debounce + requestIdRef pattern: prevents stale responses when inputs change rapidly"

requirements-completed: [ALRT-01, ALRT-02, ALRT-03, UX-02]

# Metrics
duration: 3min
completed: 2026-03-06
---

# Phase 2 Plan 01: Alert System Summary

**Proxy system prompt bug fixed + parseAlertResponse/AlertBanner/AlertSystem built and tested with 15 green Jest tests covering ALRT-01/02/03 and UX-02**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-06T16:41:30Z
- **Completed:** 2026-03-06T16:44:20Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Fixed server.js proxy that stripped the system role from Groq API calls (critical prerequisite for all AI alerting)
- Implemented parseAlertResponse: regex parser for CRITIQUE/MODERE/FAIBLE lines with unique ID generation
- Implemented AlertBanner atom with data-severity attribute and severity-specific left border (red/orange/grey)
- Implemented AlertSystem component: 1200ms debounced Claude call, patient header, dismiss/acknowledge flows, race condition guard
- 15 tests green (4 parseAlertResponse unit + 11 AlertSystem component), prior 16 tests unaffected (31 total passing)

## Task Commits

Each task was committed atomically:

1. **Task 0: Write AlertSystem test scaffold (TDD RED) and fix proxy** - `f4bcc61` (test)
2. **Task 1: Implement parseAlertResponse, AlertBanner, AlertSystem (TDD GREEN)** - `815d053` (feat)

## Files Created/Modified
- `src/__tests__/AlertSystem.test.js` - 15 tests covering parseAlertResponse unit + AlertSystem component (ALRT-01, ALRT-02, ALRT-03, UX-02)
- `src/SmartUX_AI_Bots.jsx` - Added parseAlertResponse, AlertBanner, AlertSystem after callClaudeChat export (lines 332-561)
- `server.js` - Fixed /api/claude handler: forwards full messages array instead of extracting only first message content

## Decisions Made
- Proxy fix is surgical — only the /api/claude handler body changed, no other routes (prescriptions, patients) touched
- parseAlertResponse returns empty array for both "no matching severity lines" and explicit "Aucune interaction identifiée" response, keeping the API uniform
- AlertSystem is self-contained inside SmartUX_AI_Bots.jsx, not yet wired to NLPBot or SmartUXBots root — that is Plan 02-02
- Race condition prevention via incrementing requestIdRef counter: if patient or drug changes before 1200ms debounce fires, the stale response is silently dropped
- Error fallback degrades gracefully to a FAIBLE alert rather than crashing the component

## Deviations from Plan

None - plan executed exactly as written. Test count is 15 (not 12 as stated in plan) because the plan's test file specification itself contained 15 test cases (4 parseAlertResponse + 11 AlertSystem). The written test file matches the plan's code verbatim.

## Issues Encountered

None - all tests passed GREEN on first implementation attempt. Full suite confirmed: 31 passing, 1 pre-existing failure (App.test.js — unrelated to this plan).

## User Setup Required

None - no external service configuration required. The proxy already had the GROQ_API_KEY hardcoded; no new environment variables were introduced.

## Next Phase Readiness
- AlertSystem is ready to be wired into NLPBot and SmartUXBots root (Plan 02-02)
- parseAlertResponse and AlertSystem are both exported for direct import
- The proxy fix means all existing callClaudeChat calls now correctly forward system prompts to Groq

---
*Phase: 02-alert-system*
*Completed: 2026-03-06*
