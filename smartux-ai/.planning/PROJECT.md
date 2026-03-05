# SmartUX-AI — SILLAGE Medical Assistant

## What This Is

SmartUX-AI (SILLAGE) is a hospital-grade medical interface for French healthcare staff that combines facial recognition authentication, NLP-powered prescription creation, and an AI assistant. It enables doctors and nurses to write prescriptions by dictating or typing natural language, with automatic patient matching, drug lookup, and allergy detection — all running in a React frontend backed by a Claude AI proxy.

The next milestone adds a clinical chatbot that checks the full patient dossier (allergies, current medications, diagnoses, vitals/labs) and proactively warns the prescribing doctor of allergy conflicts, drug interactions, dosage risks, and contraindications — plus a free-form chat panel for on-demand clinical Q&A.

## Core Value

The doctor never unknowingly prescribes something that could harm the patient: every prescription is checked against the patient's full dossier in real time, with warnings surfaced before the order is validated.

## Requirements

### Validated

- ✓ Facial recognition authentication (biometric login for enrolled staff) — existing
- ✓ NLP prescription creation via Claude API (localhost:3001 proxy) — existing
- ✓ Voice dictation input (SpeechRecognition API, fr-FR) — existing
- ✓ Autocomplete corpus for medical terms — existing
- ✓ Basic allergy conflict detection (drug vs KNOWN_ALLERGIES) — existing
- ✓ Patient/drug database matching (DB_PATIENTS, DB_MEDICAMENTS) — existing
- ✓ PDF prescription export (jsPDF) — existing
- ✓ Role-based access control (access_level 1–5) — existing

### Active

- [ ] Clinical chatbot panel — embedded chat UI in the prescription screen
- [ ] Auto-alerts on prescription draft — proactive warnings for allergy, interaction, dosage, contraindication
- [ ] Drug interaction detection — cross-check new drug vs patient's current medications
- [ ] Dosage warnings — flag abnormal doses given patient profile (age, weight, condition)
- [ ] Contraindication detection — flag drug contraindicated given patient diagnoses
- [ ] Patient dossier context in Claude prompts — pass allergies + current meds + diagnoses + vitals to AI
- [ ] On-demand chat — doctor asks free-form clinical questions about the selected patient
- [ ] Chat history persistence — conversation stays alive for the duration of the session

### Out of Scope

- Patient-facing chatbot — focus is on prescribing staff only
- Real-time medication database sync — use existing DB_MEDICAMENTS static data
- Multi-patient chat sessions — chatbot context is per-patient per-session
- External drug interaction API integration — Claude handles interaction reasoning

## Context

- **Stack**: React (CRA), inline styles, Claude Sonnet via localhost:3001 Express proxy
- **Language**: UI is French (fr-FR), clinical content French/medical
- **Database**: Static JS arrays in `database.js` — DB_PATIENTS, DB_STAFF, DB_MEDICAMENTS, KNOWN_ALLERGIES, DB_CONSTANTES, DB_OBSERVATIONS, DB_IMAGERIE
- **Auth**: Biometric (simulated face scan) + password fallback — staff enrolled via `biometric_enrolled` flag
- **All UI is one large component**: `SmartUX_AI_Bots.jsx` (~37KB) — new chatbot should be added as a sub-component within this file
- **Claude API format**: POST to `/api/claude` with `{ model, max_tokens, messages }` — returns `data.content[0].text`

## Constraints

- **Tech stack**: React only, no new packages unless absolutely necessary
- **Single file**: Keep chatbot within or alongside `SmartUX_AI_Bots.jsx` to match existing project structure
- **Language**: All user-facing strings in French
- **No external drug DB API**: Clinical reasoning done by Claude using patient dossier context passed in the prompt
- **Claude model**: claude-sonnet-4-5 (matches existing codebase)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Claude for all clinical reasoning | Existing proxy already working; avoids new drug DB API | — Pending |
| Chatbot embedded in prescription screen | Doctor needs warnings in context while prescribing | — Pending |
| Auto-alerts + free-form chat (dual mode) | Covers both passive safety and active Q&A | — Pending |
| French language throughout | Hospital staff work in French | — Pending |

---
*Last updated: 2026-03-05 after initialization*
