---
phase: 01-safety-foundation
plan: "01"
subsystem: api
tags: [react, jest, clinical, tdd, phi, rgpd, french]

# Dependency graph
requires: []
provides:
  - "buildDossierContext(patient, prescriptions) — pure synchronous function that assembles patient clinical dossier into French narrative string for Claude API consumption"
  - "Unit test suite (10 tests) covering all SAFE-01 edge cases including PHI tokenization, empty-state sentinels, and most-recent-only data selection"
affects:
  - "02-safety-foundation (AlertSystem — will call buildDossierContext before each Claude alert check)"
  - "03-chat-panel (ChatPanel — will call buildDossierContext before each chat message)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "TDD Red-Green cycle with Jest (react-scripts test)"
    - "jest.mock('../database') for isolating pure functions from static DB imports"
    - "Named export pattern for testability from SmartUX_AI_Bots.jsx"
    - "PHI tokenization: H-{patient_id} header replaces real name/IPP pending DPA"

key-files:
  created:
    - "src/__tests__/buildDossierContext.test.js"
  modified:
    - "src/SmartUX_AI_Bots.jsx"
    - ".planning/phases/01-safety-foundation/01-CONTEXT.md"

key-decisions:
  - "PHI tokenization (option-b): header uses H-{patient_id} token instead of full name/IPP — no real PHI sent to Groq API, RGPD-safe pending DPA confirmation"
  - "buildDossierContext is a pure synchronous function (no fetch, no async) — async boundary owned by the caller"
  - "prescriptions passed in as argument (not fetched internally) — lets callers reuse existing fetch result"
  - "Most-recent-only vitals and observations — sort by date desc, take index 0"
  - "All empty states use explicit French sentinel strings (never undefined/empty)"

patterns-established:
  - "jest.mock('../database') pattern: mock the entire database module to test pure functions in isolation"
  - "PHI NOTE comment: documents restore path for full name once DPA is signed"
  - "French sentinel strings: 'Aucun traitement en cours', 'Aucune allergie connue', 'Constantes : Non disponibles', 'Aucune note clinique récente'"

requirements-completed: [SAFE-01]

# Metrics
duration: 12min
completed: 2026-03-06
---

# Phase 1 Plan 01: Safety Foundation — buildDossierContext Summary

**Pure synchronous French-language dossier builder with H-{id} PHI tokenization, 10 green Jest tests, and explicit empty-state sentinels for all SAFE-01 scenarios.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-03-06T03:25:24Z
- **Completed:** 2026-03-06T03:37:00Z
- **Tasks:** 2 (Task 1: TDD RED scaffold, Task 2: TDD GREEN implementation)
- **Files modified:** 3 (SmartUX_AI_Bots.jsx, buildDossierContext.test.js, 01-CONTEXT.md)

## Accomplishments

- `buildDossierContext(patient, prescriptions)` exported from `src/SmartUX_AI_Bots.jsx` — single source of truth for patient context sent to Claude in Phases 2 and 3
- PHI tokenization implemented: header uses `Patient H-${patient_id}` instead of real name/IPP, unblocking development while DPA is pending
- 10-test Jest suite passing green, covering all SAFE-01 scenarios: tokenization, age computation, vitals (most-recent-only), allergies, medications, and null/undefined guard
- CONTEXT.md updated to record the departure from the original locked header decision (full name → H-{id} token)

## Task Commits

Each task was committed atomically:

1. **Task 1: Scaffold test file (TDD RED)** — `be6c32d` (test)
2. **Task 2: Implement buildDossierContext (TDD GREEN)** — `43f654c` (feat)

_TDD cycle: RED commit confirmed all 10 tests failing (import error), GREEN commit confirmed all 10 passing._

## Files Created/Modified

- `src/__tests__/buildDossierContext.test.js` — 10 Jest unit tests with jest.mock('../database'), option-b PHI checks, empty-state sentinels, most-recent vitals check, null guard
- `src/SmartUX_AI_Bots.jsx` — `buildDossierContext` function inserted after `parseWithClaude()` block (line 184), exported for testability, PHI NOTE comment included
- `.planning/phases/01-safety-foundation/01-CONTEXT.md` — Dossier string format section updated to record H-{id} tokenization departure from original locked decision

## Decisions Made

- **PHI tokenization chosen (option-b):** The original CONTEXT.md locked decision used full name + IPP in the header. This was overridden in the Task 0 checkpoint because sending real patient name/IPP to the Groq API without a confirmed DPA violates RGPD. The header now uses `Patient H-${patient_id}` — a reversible change. Restore path documented in code comment.
- **prescriptions passed as argument:** The function signature takes `prescriptions` rather than fetching internally, preserving the pure/synchronous constraint and letting callers reuse existing fetch results.
- **All DB access via already-imported globals:** No new imports needed — `DB_CONSTANTES`, `DB_OBSERVATIONS`, `KNOWN_ALLERGIES`, `DB_MEDICAMENTS` are already imported at the top of the file.

## Deviations from Plan

### Scope Note: Pre-existing App.test.js failure

The existing `src/App.test.js` test (tests for "learn react" link text) fails in the full suite — this is a pre-existing issue unrelated to this plan's changes. Per deviation rules scope boundary, this was logged but not fixed.

No auto-fix deviations were required for this plan's own tasks.

---

**Total deviations:** 0 auto-fixed (pre-existing App.test.js failure logged, out of scope)
**Impact on plan:** None — plan executed as specified with confirmed option-b.

## Issues Encountered

- `.planning/` directory is in `.gitignore` — CONTEXT.md update committed via force-add in the final metadata commit. Planning files are intentionally excluded from the main code history per project setup.

## User Setup Required

None — no external service configuration required. The existing Groq proxy at `/api/claude` is reused with no changes.

## Next Phase Readiness

- `buildDossierContext` is ready to be called by Phase 2 (AlertSystem) and Phase 3 (ChatPanel)
- Callers need to fetch prescriptions from `http://localhost:3001/api/prescriptions` and filter by `patient_id` before passing to `buildDossierContext`
- When hospital DPA with AI provider is confirmed, restore full name header by editing the one line in `buildDossierContext` (PHI NOTE comment marks the exact location)
- Pre-existing `App.test.js` failure should be addressed before shipping but is out of scope for this plan

---
*Phase: 01-safety-foundation*
*Completed: 2026-03-06*

## Self-Check: PASSED

- FOUND: src/__tests__/buildDossierContext.test.js
- FOUND: src/SmartUX_AI_Bots.jsx (with `export function buildDossierContext` at line 191)
- FOUND: .planning/phases/01-safety-foundation/01-01-SUMMARY.md
- FOUND: be6c32d (test TDD RED commit)
- FOUND: 43f654c (feat TDD GREEN commit)
- FOUND: 8e0d6d8 (docs final metadata commit)
- Tests: 10/10 passing green
