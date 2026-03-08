---
phase: 3
slug: chat-panel
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-06
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest 27 (react-scripts 5.0.1 built-in) + React Testing Library 16.3.2 |
| **Config file** | none — Jest config embedded in react-scripts |
| **Quick run command** | `npx react-scripts test --watchAll=false --testPathPattern="ChatPanel"` |
| **Full suite command** | `npx react-scripts test --watchAll=false` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx react-scripts test --watchAll=false --testPathPattern="ChatPanel"`
- **After every plan wave:** Run `npx react-scripts test --watchAll=false`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 3-01-01 | 03-01 | 1 | CHAT-03 | unit (Jest mock fetch) | `npx react-scripts test --watchAll=false --testPathPattern="ChatPanel"` | ❌ W0 | ⬜ pending |
| 3-02-01 | 03-02 | 2 | CHAT-01 | unit (RTL) | `npx react-scripts test --watchAll=false --testPathPattern="ChatPanel"` | ❌ W0 | ⬜ pending |
| 3-02-02 | 03-02 | 2 | CHAT-01 | unit (RTL) | `npx react-scripts test --watchAll=false --testPathPattern="ChatPanel"` | ❌ W0 | ⬜ pending |
| 3-02-03 | 03-02 | 2 | CHAT-02 | unit (RTL) | `npx react-scripts test --watchAll=false --testPathPattern="ChatPanel"` | ❌ W0 | ⬜ pending |
| 3-02-04 | 03-02 | 2 | UX-01 | unit (RTL + style check) | `npx react-scripts test --watchAll=false --testPathPattern="ChatPanel"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/__tests__/ChatPanel.test.js` — stubs covering CHAT-01, CHAT-02, CHAT-03, UX-01

Mock pattern for streaming fetch (matches existing project pattern in `callClaudeChat.test.js`):

```javascript
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

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Drawer slides in without covering prescription form | UX-01 | Visual layout check | Open app, select patient, click chat toggle — verify drawer is fixed right and prescription form remains fully visible |
| Streaming tokens appear word-by-word | CHAT-01 | Visual timing check | Ask a question, verify tokens appear progressively rather than all at once |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
