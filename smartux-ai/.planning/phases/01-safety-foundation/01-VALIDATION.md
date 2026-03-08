---
phase: 1
slug: safety-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-06
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest 29 (react-scripts 5.0.1 default) |
| **Config file** | None — CRA default configuration |
| **Quick run command** | `npm test -- --testPathPattern="buildDossierContext\|callClaudeChat" --watchAll=false` |
| **Full suite command** | `npm test -- --watchAll=false` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- --testPathPattern="[task-file]" --watchAll=false`
- **After every plan wave:** Run `npm test -- --watchAll=false`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 1 | SAFE-01 | unit | `npm test -- --testPathPattern="buildDossierContext" --watchAll=false` | ❌ W0 | ⬜ pending |
| 01-01-02 | 01 | 1 | SAFE-01 | unit | `npm test -- --testPathPattern="buildDossierContext" --watchAll=false` | ❌ W0 | ⬜ pending |
| 01-01-03 | 01 | 1 | SAFE-01 | unit | `npm test -- --testPathPattern="buildDossierContext" --watchAll=false` | ❌ W0 | ⬜ pending |
| 01-02-01 | 02 | 1 | SAFE-02 | unit | `npm test -- --testPathPattern="callClaudeChat" --watchAll=false` | ❌ W0 | ⬜ pending |
| 01-02-02 | 02 | 1 | SAFE-02 | unit | `npm test -- --testPathPattern="callClaudeChat" --watchAll=false` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/__tests__/buildDossierContext.test.js` — stubs for SAFE-01 (dossier assembly, empty states, French output)
- [ ] `src/__tests__/callClaudeChat.test.js` — stubs for SAFE-02 (disclaimer presence, disclaimer enforcement)
- [ ] Mock for `/api/claude` endpoint in tests (jest-fetch-mock or MSW)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| French language correctness in Claude output | SAFE-01, SAFE-02 | Requires live Claude API call | Run `callClaudeChat()` with sample patient dossier; verify response is French and contains disclaimer |
| Alert fatigue calibration | SAFE-02 | Requires clinical judgment | Test with 20 known DDI pairs; verify Claude suppresses INFO-level and expresses uncertainty appropriately |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending