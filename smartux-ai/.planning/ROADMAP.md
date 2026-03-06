# Roadmap: SmartUX-AI — Clinical Drug Safety Chatbot (SILLAGE)

## Overview

Three phases build the clinical chatbot from its foundation up. Phase 1 constructs the patient dossier context builder and prompt infrastructure that every safety feature depends on. Phase 2 adds the proactive alert system that fires when a doctor enters a drug — surfacing allergy conflicts, interactions, contraindications, and dosage warnings before the prescription is validated. Phase 3 adds the free-form clinical chat panel where doctors can ask follow-up questions about the selected patient. Each phase is independently verifiable; nothing is built on an unproven layer.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Safety Foundation** - Build the patient dossier context builder and Claude wrapper that power all safety checks
- [ ] **Phase 2: Alert System** - Add proactive drug safety alerts that fire when a prescription draft changes
- [ ] **Phase 3: Chat Panel** - Add the dismissible free-form clinical Q&A drawer with streaming responses

## Phase Details

### Phase 1: Safety Foundation
**Goal**: The shared infrastructure exists that any clinical safety check can use — patient context assembled correctly, Claude callable with the right prompts, and every AI response carrying the required disclaimer
**Depends on**: Nothing (first phase)
**Requirements**: SAFE-01, SAFE-02
**Success Criteria** (what must be TRUE):
  1. Given any patient in DB_PATIENTS, `buildDossierContext(patient)` returns a structured French-language string containing allergies, active medications, diagnoses, and vitals from all relevant DB tables
  2. A Claude call made via `callClaudeChat()` returns a structured severity-tiered response (CRITIQUE / MODERE / FAIBLE) in French when given a patient dossier and a drug name
  3. Every AI-generated clinical output includes the text "Analyse assistée par IA — vérification clinique recommandée" regardless of the calling component
**Plans**: 2 plans

Plans:
- [x] 01-01-PLAN.md — Implement `buildDossierContext(patient, prescriptions)` with test scaffold (SAFE-01)
- [x] 01-02-PLAN.md — Implement `callClaudeChat()` with dual-layer disclaimer and French system prompts (SAFE-02)

### Phase 2: Alert System
**Goal**: A doctor entering a drug into the prescription form sees proactive safety alerts — severity-tiered, patient-identified, dismissible — without being blocked from prescribing
**Depends on**: Phase 1
**Requirements**: ALRT-01, ALRT-02, ALRT-03, UX-02
**Success Criteria** (what must be TRUE):
  1. When a drug is typed into the prescription draft, an automatic safety check fires (debounced) and any detected risks appear as severity-tiered alerts — red for CRITIQUE, orange for MODERE, grey for FAIBLE — without the doctor doing anything
  2. Every alert displays the full patient name and ID so there is no ambiguity about which patient the warning applies to
  3. A MODERE or FAIBLE alert can be dismissed with a single click and disappears without requiring any justification from the doctor
  4. A CRITIQUE alert requires explicit acknowledgment before it can be cleared
**Plans**: 2 plans

Plans:
- [ ] 02-01-PLAN.md — Fix proxy system prompt forwarding, build `parseAlertResponse`, `AlertBanner`, `AlertSystem` with 12-test TDD suite (ALRT-01, ALRT-02, ALRT-03, UX-02)
- [ ] 02-02-PLAN.md — Wire `selectedPatientId` to root state, connect `AlertSystem` inside `NLPBot` with patient/prescriptions props, human verify (ALRT-01, ALRT-02, ALRT-03, UX-02)

### Phase 3: Chat Panel
**Goal**: A doctor can open a chat drawer, ask free-form clinical questions about the selected patient, receive streaming AI answers, and have the conversation clear automatically when they switch patients
**Depends on**: Phase 2
**Requirements**: CHAT-01, CHAT-02, CHAT-03, UX-01
**Success Criteria** (what must be TRUE):
  1. The doctor can click to open a chat drawer that slides in alongside the prescription form without covering it, and close it again with a single action
  2. The doctor can type a clinical question about the selected patient, submit it, and receive an AI response that streams in word-by-word rather than appearing all at once
  3. When the doctor selects a different patient, all previous chat messages disappear and the conversation starts fresh for the new patient
  4. If no patient is selected, the chat panel shows a guard state ("Aucun patient sélectionné") and does not allow questions to be sent
**Plans**: TBD

Plans:
- [ ] 03-01: Build `/api/claude-stream` SSE route on the Express server using Groq SDK streaming
- [ ] 03-02: Build `ChatPanel` component with `useReducer` state, streaming consumption, auto-scroll, patient-switch reset, and drawer open/close UX

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Safety Foundation | 2/2 | Complete | 2026-03-06 |
| 2. Alert System | 1/2 | In Progress|  |
| 3. Chat Panel | 0/2 | Not started | - |
