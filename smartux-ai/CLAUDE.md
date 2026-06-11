# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Start both processes (required together)
node server.js        # API backend — port 3001
npm start             # React frontend — port 3000

# Tests
npm test                                           # run all tests in watch mode
npm test -- --watchAll=false                       # run once (CI mode)
npm test -- --testPathPattern=ChatPanel            # run a single test file
npm test -- --testNamePattern="CHAT-01"            # run tests matching a name

# Build
npm run build
```

## Architecture

### Two-process setup

The app requires **both** processes running simultaneously:

- **`server.js`** (Express, port 3001) — handles all AI API calls and SQLite persistence. Routes: `GET/POST/PATCH /api/prescriptions`, `POST /api/claude` (non-streaming), `POST /api/claude-stream` (SSE streaming). Despite being named `/api/claude`, both routes call the **Groq API** (`api.groq.com`) with `llama-3.3-70b-versatile`. The Groq API key is hardcoded in `server.js`.
- **`src/`** (React CRA, port 3000) — single-page app, all UI in one file.

### Frontend: one-file convention

Almost all frontend code lives in `src/SmartUX_AI_Bots.jsx` (~1600+ lines). `App.js` is a one-liner that mounts it. New components go inside this file.

Key exported symbols from `SmartUX_AI_Bots.jsx`:
- `buildDossierContext(patient, prescriptions)` — builds a text context string for a single patient (used in alert system prompt)
- `buildAllPatientsContext(allPrescriptions)` — builds full database context for the Doctor AI chat
- `callClaudeChat(systemPrompt, userMessage, history)` — calls `POST /api/claude`, used only for the alert system
- `ChatPanel` — the Doctor AI chat drawer component (calls `/api/claude-stream` for SSE)
- `CLAUDE_SYSTEM_PROMPT_ALERT` / `CLAUDE_SYSTEM_PROMPT_CHAT` — exported system prompts (tested)
- `parseAlertResponse(raw)` — parses `**CRITIQUE|MODERE|FAIBLE**` lines from alert responses

### Data layer

All data is **static JS arrays** in `src/database.js` — no backend DB reads from the frontend. The SQLite database (`sillage.db`, via `better-sqlite3`) is used only for prescriptions persistence by `server.js`.

Key data exports: `DB_PATIENTS`, `DB_STAFF`, `DB_MEDICAMENTS`, `DB_OBSERVATIONS`, `DB_CONSTANTES`, `DB_IMAGERIE`, `KNOWN_ALLERGIES`, `ACCESS_PERMISSIONS`.

Patient field names: `first_name`, `last_name`, `patient_id`, `ward`, `room`, `date_of_birth`, `blood_type`, `gender`.

### SSE streaming protocol

The chat uses Server-Sent Events. The server writes raw token strings as `data: <token>\n\n`. **Do not `.trim()` tokens** — Groq tokenization includes leading spaces as word separators. Only `.trim()` the `[DONE]` / `[ERROR]` sentinel checks.

### Auth / navigation flow

Login screen → biometric scan (simulated) or password → `SmartUXBots` root component. The root manages: `authenticatedUser`, `activeTab` (nlp | rx | dossier | observations | imagerie | parametres), `selectedPatientId`, `prescriptions` (fetched from SQLite via `/api/prescriptions`), `chatOpen`.

### Alert system

`AlertSystem` lives inside `NLPBot` and fires automatically when a prescription draft contains a drug + a selected patient. It calls `callClaudeChat` with `CLAUDE_SYSTEM_PROMPT_ALERT` + dossier context. Alerts are parsed into `{ severity: CRITIQUE|MODERE|FAIBLE, message }` objects. Race conditions are prevented via `requestIdRef` counter — stale async responses are discarded on patient/drug change.

### Safety constraints

- Every AI response **must** begin with `"Analyse assistée par IA — vérification clinique recommandée"` — enforced as a dual-layer: system prompt instruction + wrapper prepend failsafe in `callClaudeChat`.
- PHI anonymization: patient headers in prompts use `H-{patient_id}` token instead of full name/IPP (RGPD compliance pending DPA confirmation).
- The AI must never diagnose — only propose hypotheses for clinician verification.


## Obsidian Vault as memory

The Obsidian vault at `/Users/neylesso/Documents/Obsidian Vault/` is used as persistent memory across sessions. After each work session, write a summary note in the vault so future Claude instances have context without re-reading the codebase.

### Notes

- **Vault path:** `/Users/neylesso/Documents/Obsidian Vault/UX/` — place project-related notes here
- **Session summaries:** write a dated `.md` file (e.g. `SUMMARY.md` or `2026-03-06-session.md`) after each session covering what changed, why, and any decisions made
- **Use wikilinks** to connect notes: `[[SmartUX-AI]]`, `[[SUMMARY]]`, `[[Groq]]` — Obsidian tracks renames automatically, so prefer wikilinks over plain text references
- **Link to this project:** reference the project as `[[smartux-ai/README]]` or `[[SmartUX-AI]]` from any note in the vault
- **Frontmatter:** always add `date`, `tags`, and `project` properties to new notes so they are searchable in Obsidian
- **Before starting work:** check `UX/SUMMARY.md` in the vault for the latest session notes — it contains decisions, fixes, and context that are not obvious from the code alone
- Every time we change something write it on the summary SUMMARY.md

Example note header:
```yaml
---
title: SmartUX-AI — Session 2026-03-06
date: 2026-03-06
tags:
  - dev/session
  - project/smartux-ai
project: "[[SmartUX-AI]]"
---
```

## Style constraints

- **No emoji** — never use emoji characters in the app UI, in code comments, or in Obsidian session notes (SUMMARY.md). Use plain text and standard Unicode symbols only (e.g. `✓`, `✕` are acceptable as UI symbols, but no emoji like `⚠️`, `🎤`, `🔬`).

## Testing notes

Tests use `@testing-library/react`. `src/__tests__/ChatPanel.test.js` mocks `buildDossierContext` via `jest.mock` while importing the real `ChatPanel`. The `mockStreamResponse` helper creates a `ReadableStream` that emits SSE tokens followed by `[DONE]`.

`TextEncoder`, `TextDecoder`, and `ReadableStream` are polyfilled at the top of the test file for jsdom compatibility.


## Workflow Orchestration

### 1. Plan Node Default
- Enter plan mode for ANY non-trivial task (3+ steps or architectural decisions)
- If something goes sideways, STOP and re-plan immediately — don't keep pushing
- Use plan mode for verification steps, not just building
- Write detailed specs upfront to reduce ambiguity

### 2. Subagent Strategy
- Use subagents liberally to keep main context window clean
- Offload research, exploration, and parallel analysis to subagents
- For complex problems, throw more compute at it via subagents
- One task per subagent for focused execution

### 3. Self-Improvement Loop
- After ANY correction from the user: update `tasks/lessons.md` with the pattern
- Write rules for yourself that prevent the same mistake
- Ruthlessly iterate on these lessons until mistake rate drops
- Review lessons at session start for relevant project

### 4. Verification Before Done
- Never mark a task complete without proving it works
- Diff behavior between main and your changes when relevant
- Ask yourself: "Would a staff engineer approve this?"
- Run tests, check logs, demonstrate correctness

### 5. Demand Elegance (Balanced)
- For non-trivial changes: pause and ask "is there a more elegant way?"
- If a fix feels hacky: "Knowing everything I know now, implement the elegant solution"
- Skip this for simple, obvious fixes — don't over-engineer
- Challenge your own work before presenting it

### 6. Autonomous Bug Fixing
- When given a bug report: just fix it. Don't ask for hand-holding
- Point at logs, errors, failing tests — then resolve them
- Zero context switching required from the user
- Go fix failing CI tests without being told how


## Task Management

1. **Plan First**: Write plan to `tasks/todo.md` with checkable items
2. **Verify Plan**: Check in before starting implementation
3. **Track Progress**: Mark items complete as you go
4. **Explain Changes**: High-level summary at each step
5. **Document Results**: Add review section to `tasks/todo.md`
6. **Capture Lessons**: Update `tasks/lessons.md` after corrections


## Core Principles

- **Simplicity First**: Make every change as simple as possible. Impact minimal code.
- **No Laziness**: Find root causes. No temporary fixes. Senior developer standards.
- **Minimal Impact**: Changes should only touch what's necessary. Avoid introducing bugs.
