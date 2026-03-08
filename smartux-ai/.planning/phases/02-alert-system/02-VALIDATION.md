---
phase: 2
slug: alert-system
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-06
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest (via react-scripts test, CRA built-in) |
| **Config file** | None — CRA default Jest config |
| **Quick run command** | `CI=true react-scripts test --testPathPattern=AlertSystem --watchAll=false` |
| **Full suite command** | `CI=true react-scripts test --watchAll=false` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `CI=true react-scripts test --testPathPattern="AlertSystem|buildDossierContext|callClaudeChat" --watchAll=false`
- **After every plan wave:** Run `CI=true react-scripts test --watchAll=false`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 02-01-T0 | 01 | 0 | ALRT-01,02,03,UX-02 | unit scaffold | `CI=true react-scripts test --testPathPattern=AlertSystem --watchAll=false` | ❌ W0 | ⬜ pending |
| 02-01-T1 | 01 | 1 | ALRT-01 | unit | `CI=true react-scripts test --testPathPattern=AlertSystem --watchAll=false` | ✅ after T0 | ⬜ pending |
| 02-01-T2 | 01 | 1 | ALRT-02,ALRT-03,UX-02 | unit | `CI=true react-scripts test --testPathPattern=AlertSystem --watchAll=false` | ✅ after T0 | ⬜ pending |
| 02-02-T1 | 02 | 2 | ALRT-01 | unit | `CI=true react-scripts test --watchAll=false` | ✅ | ⬜ pending |
| 02-02-T2 | 02 | 2 | UX-02 | unit | `CI=true react-scripts test --watchAll=false` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/__tests__/AlertSystem.test.js` — stubs for ALRT-01, ALRT-02, ALRT-03, UX-02; uses `@testing-library/react` + `jest.mock('../database')` + `global.fetch` mock

*Note: No new framework install needed. `@testing-library/react` 16.3.2 and `@testing-library/jest-dom` 6.9.1 already installed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Alert panel appears visually alongside prescription form without covering it | UX-02 | Visual layout requires browser inspection | Open app, select patient, type drug name, verify alert panel position |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
