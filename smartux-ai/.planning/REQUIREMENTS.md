# Requirements: SmartUX-AI — Clinical Drug Safety Chatbot (SILLAGE)

**Defined:** 2026-03-06
**Core Value:** The doctor never unknowingly prescribes something that could harm the patient — every prescription is checked against the patient's full dossier in real time.

## v1 Requirements

### Safety Foundation

- [x] **SAFE-01**: System assembles patient dossier context (allergies, current medications, vitals, diagnoses) into a structured prompt-ready string via `buildDossierContext()` function
- [x] **SAFE-02**: Every AI-generated alert displays the disclaimer "Analyse assistée par IA — vérification clinique recommandée"

### Alert System

- [x] **ALRT-01**: System automatically checks the prescription draft against the patient's dossier when a drug is entered (allergy conflict, drug-drug interaction, contraindication, dosage warning)
- [x] **ALRT-02**: Every alert displays a patient identity header showing which patient the warning applies to
- [x] **ALRT-03**: MODERE and FAIBLE alerts can be dismissed silently without justification

### ChatPanel

- [ ] **CHAT-01**: Doctor can type free-form clinical questions about the selected patient and receive AI answers
- [ ] **CHAT-02**: Chat context clears automatically when a different patient is selected
- [x] **CHAT-03**: AI responses stream word-by-word via a new `/api/claude-stream` server-sent events route

### UX

- [ ] **UX-01**: Chat panel opens and closes as a dismissible drawer that does not cover the prescription form
- [x] **UX-02**: Alert severity is visually distinct: Red for CRITIQUE, Orange for MODERE, Grey for FAIBLE

## v2 Requirements

### Safety Enhancements

- **SAFE-03**: PHI anonymization — patient name and date of birth replaced with tokens before sending to API (RGPD compliance)
- **SAFE-04**: Prompt-level severity calibration — Claude instructed to suppress INFO-level findings and express uncertainty on weak signals
- **SAFE-05**: Mandatory acknowledgment gate for CRITIQUE-level warnings before prescription can be validated

### ChatPanel Enhancements

- **CHAT-04**: Multi-turn conversation history — context preserved across messages within a session (capped at 20 exchanges)

### UX Enhancements

- **UX-03**: Non-blocking alert panel — hidden entirely when no active warnings, no persistent empty pane
- **UX-04**: Patient-specific dose calculation reasoning using actual weight and CrCl from DB_CONSTANTES

## Out of Scope

| Feature | Reason |
|---------|--------|
| Patient-facing chatbot | Focus is on prescribing staff only |
| External drug interaction API | Runtime dependency and latency; Claude handles reasoning |
| Autonomous prescription blocking | Regulatory risk — doctor retains decision authority |
| Numerical confidence scores on alerts | Research shows these cause both overreliance and dismissal |
| Cross-patient chat context | RGPD violation vector and wrong-patient error risk |
| Override audit dashboard | Non-trivial persistence, out of scope for v1 |
| Multi-session chat memory | RGPD complexity, not needed for safety |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| SAFE-01 | Phase 1 | Complete |
| SAFE-02 | Phase 1 | Complete |
| ALRT-01 | Phase 2 | Complete |
| ALRT-02 | Phase 2 | Complete |
| ALRT-03 | Phase 2 | Complete |
| UX-02 | Phase 2 | Complete |
| CHAT-01 | Phase 3 | Pending |
| CHAT-02 | Phase 3 | Pending |
| CHAT-03 | Phase 3 | Complete |
| UX-01 | Phase 3 | Pending |

**Coverage:**
- v1 requirements: 10 total
- Mapped to phases: 10
- Unmapped: 0

---
*Requirements defined: 2026-03-06*
*Last updated: 2026-03-06 — SAFE-02 marked complete after 01-02 execution*
