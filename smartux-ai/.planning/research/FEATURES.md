# Feature Research

**Domain:** Clinical drug safety chatbot embedded in hospital prescription workflow (SILLAGE)
**Researched:** 2026-03-05
**Confidence:** HIGH (table stakes and architecture), MEDIUM (differentiators), HIGH (anti-features)

---

## Feature Landscape

### Table Stakes (Users Expect These)

These are non-negotiable. A prescribing doctor using this system will immediately distrust or abandon it if any of these are missing. They do not generate goodwill when present — they only generate loss when absent.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Allergy conflict detection** | Every CDSS since the 1980s checks allergies. Missing this = broken tool | LOW | Already partially exists (KNOWN_ALLERGIES). Chatbot must extend it to full dossier context and surface it proactively at prescription time |
| **Drug-drug interaction (DDI) warning** | The single most studied CDSS feature. Override rates hit 96% when irrelevant — but 0% relevance means no safety net | MEDIUM | Pass current meds list + new drug to Claude with explicit DDI instruction. The patient's DB_MEDICAMENTS current prescriptions are the corpus |
| **Contraindication detection** | Doctors expect the system to flag obvious contraindications (e.g., beta-blocker in asthmatic, NSAID in renal failure) | MEDIUM | Requires diagnoses (DB_OBSERVATIONS) + drug data passed to Claude in structured prompt |
| **Dosage warning** | Abnormal doses (pediatric weight, renal impairment, elderly) are a leading cause of ADEs. This is expected in any prescribing tool | MEDIUM | Requires patient age, weight, lab values (DB_CONSTANTES) in the Claude context. Claude reasons from these |
| **Proactive alert at prescription time** | Warning must fire when the doctor drafts the prescription, not when they ask for it. Reactive-only = useless for safety | LOW | Auto-trigger analysis when prescription state changes (drug selected, dose entered) |
| **Warning severity distinction** | Doctors cannot process all alerts equally. High/moderate/low tiers are standard in all CDSS | LOW | Claude response must include severity classification; UI renders differently per level |
| **French-language output** | Staff work entirely in French. English outputs would not be read | LOW | System prompt must enforce French responses. Already the project language |
| **Alert dismissal without forced justification** | Doctors override 90%+ of alerts. Forced justification on every alert destroys workflow and creates the exact alert fatigue that kills safety | LOW | Allow dismiss with single click for moderate/low severity. Reserve mandatory reason for critical-only |
| **Patient identity clearly tied to each alert** | If context is ever ambiguous (wrong patient), trust collapses permanently | LOW | Every alert panel/chat response must display patient name + ID before the clinical content |
| **Session-scoped chat history** | Doctors ask follow-up questions. Losing context mid-consultation is disorienting | LOW | Keep messages in component state for duration of session; no persistence across sessions needed in v1 |
| **Free-form clinical Q&A** | Doctors don't just need alerts — they ask open questions ("What's the max dose for this renal patient?"). Not having this makes it just a rule engine | MEDIUM | This is the chatbot panel. Claude receives patient dossier + doctor's question |

---

### Differentiators (Competitive Advantage)

These are features that distinguish this chatbot from a simple rule-based alert system. They align with the core value: "the doctor never unknowingly prescribes something harmful."

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Full dossier context reasoning** | Most rule-based CDSSs match against one variable at a time. Claude can reason across allergies + active meds + diagnoses + labs simultaneously, catching emergent risks that rule engines miss | MEDIUM | Structured context block in every system prompt: allergies, current meds, diagnoses, vitals, labs. This is the primary differentiator |
| **Plain-language clinical explanation** | Rule engines say "DDI detected: warfarin + ibuprofen — severity 3." Claude can say "Ibuprofen inhibits warfarin metabolism, increasing bleeding risk — consider paracetamol instead." Doctors actually read these | LOW | Claude naturally produces this. System prompt should instruct explanation format: risk + mechanism + alternative |
| **Alternative suggestion** | Proposing a safer alternative in the same therapeutic class is rare in basic CDSSs and extremely valuable to the prescribing workflow | MEDIUM | Instruct Claude to always propose an alternative when flagging a risk. Quality depends on DB_MEDICAMENTS corpus coverage |
| **Dual-mode interface (proactive + on-demand)** | Proactive auto-alerts cover passive safety; free-form chat covers active clinical reasoning. This combination is absent from most hospital tools | MEDIUM | Two distinct UX states: auto-alert panel (fires on prescription change) + chat panel (doctor-initiated) |
| **Patient-specific dose calculation reasoning** | Rather than generic dose ranges, Claude can reason: "for a 72-year-old with CrCl 35 mL/min, standard amoxicillin dose should be halved" using the actual patient's DB_CONSTANTES data | HIGH | Requires structured weight + renal function + age in the context. High value; pursue after core alerts work |
| **Temporal reasoning on medications** | Checking if a recently stopped drug still poses interaction risk (e.g., MAOI washout periods) — this is beyond simple "currently prescribed" matching | HIGH | Requires prescription history dates in context. Depends on data model; v2 feature |
| **Contextual follow-up in chat** | Doctor asks "Is this safe?" then follows up "What about at half dose?" — the system should retain context for multi-turn reasoning within the patient session | LOW | Managed via messages array in component state. Critical for chat to be useful, not just command-response |

---

### Anti-Features (Commonly Requested, Often Problematic)

These are features that sound obviously good but systematically make clinical decision support worse. Document them explicitly to prevent scope creep.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Mandatory override justification on all alerts** | Regulatory traceability, liability coverage | Documented override rates hit 96% when alerts are not perfectly tuned. Mandatory justification on every alert creates friction that trains doctors to click through without reading. This is worse safety, not better. One hospital saw acceptance rates drop from 100% to 8.4% after increasing alert burden | Require justification only for CRITICAL severity (life-threatening DDI, known lethal allergy). Log all dismissals silently. Surface patterns in a future audit dashboard |
| **External drug interaction API integration** | Databases like DrugBank or Micromedex are "authoritative" | This project constraint excludes it, but more importantly: integration adds a runtime dependency that can fail, adds latency, requires maintenance, and still produces alert fatigue because the databases are not patient-specific. Claude reasoning on the patient dossier is more contextually accurate | Claude + structured patient context is the correct approach here. If the static DB_MEDICAMENTS is too sparse, enrich it — do not add an external API |
| **Autonomous prescription blocking** | "If there's a known lethal interaction, the system should prevent it" | This is not a decision support system at that point — it's autonomous prescribing. FDA 2026 CDS guidance explicitly does not cover how to regulate this. More practically: doctors override blockers by design (patient may have a legitimate clinical reason), creating worse outcomes than warnings | Surface the warning clearly; the doctor decides. The system is a co-pilot, not a gatekeeper |
| **Patient-facing version of the chatbot** | "Can we expose this to patients for medication questions?" | Explicitly out of scope per PROJECT.md, but the reason matters: patient-facing AI without clinical oversight creates liability. A 2025 BMJ study warned patients not to rely on AI chatbots for drug information. Patient-facing systems have different safety requirements, regulatory status, and UX constraints entirely | Focus on prescriber-facing tool. If patient Q&A is needed in the future, build it as a separate product with a pharmacist-review layer |
| **Multi-patient chat context** | "Carry context from patient A to patient B so the doctor can compare" | Cross-patient context is a HIPAA/RGPD violation vector and a patient safety risk (wrong-patient errors). The chatbot must be scoped to exactly one patient per session | Per-session, per-patient context. Hard reset on patient change |
| **Real-time interaction database sync** | "The drug database should update from a live source" | Introduces a runtime dependency that can fail mid-prescription. A static, medically-reviewed database is safer and more auditable than a live sync during clinical use | Use DB_MEDICAMENTS as-is. Plan a manual, versioned update process for the database as a maintenance task |
| **Confidence percentages on safety alerts** | "Show 87% confidence that this is a real interaction" | Research shows that displaying numerical confidence scores causes overreliance when high and dismissal when low — in both cases degrading clinical judgment (JAMIA 2025 study on confidence and diagnostic accuracy). LLMs also show minimal variation in expressed confidence between correct and incorrect answers | Express certainty as a severity tier (CRITIQUE / MODERE / FAIBLE) with a brief rationale. Never show raw confidence numbers |
| **Chat-based prescription creation** | "Why not let the doctor dictate prescriptions through the chat interface?" | The NLP prescription system already exists and works. Merging prescription creation with safety checking in one chat interface creates ambiguity about what is a draft vs. a warning vs. a confirmed order | Keep prescription creation (existing NLP flow) and safety checking (new chatbot) as separate, clearly delimited UI areas |

---

## Feature Dependencies

```
[Patient dossier context injection]
    └──required by──> [Allergy conflict detection]
    └──required by──> [Drug-drug interaction warning]
    └──required by──> [Contraindication detection]
    └──required by──> [Dosage warning]
    └──required by──> [Full dossier reasoning (differentiator)]
    └──required by──> [Free-form clinical Q&A]

[Proactive alert trigger]
    └──required by──> [Auto-alert panel at prescription time]
    └──depends on──>  [Prescription state change event in existing component]

[Severity classification in Claude response]
    └──required by──> [Alert severity display]
    └──required by──> [Selective mandatory override justification]

[Session chat history (messages array)]
    └──required by──> [Contextual follow-up in chat]
    └──enables──>     [Free-form clinical Q&A (multi-turn)]

[Alternative suggestion in Claude response]
    └──enhances──>    [DDI warning]
    └──enhances──>    [Contraindication detection]
```

### Dependency Notes

- **Patient dossier context injection is the foundation of everything.** Every safety feature depends on Claude receiving structured allergies + active meds + diagnoses + vitals. This must be built first and correctly.
- **Severity classification must be designed into the Claude prompt** from the start, not retrofitted. The response format (CRITIQUE / MODERE / FAIBLE + explanation + alternative) should be part of the system prompt's output schema.
- **Proactive trigger depends on hooking into the existing prescription state** in `SmartUX_AI_Bots.jsx`. The chatbot component needs to observe when a drug is selected or a dose is entered.
- **Session chat history is trivially cheap** (React state, no persistence) but must be initialized correctly to support multi-turn follow-ups.

---

## MVP Definition

### Launch With (v1)

Minimum viable product — everything needed for the safety value proposition to be real and trustworthy.

- [ ] **Patient dossier context builder** — structured block passed to every Claude call: allergies, active prescriptions, diagnoses, age, weight, key labs. Without this, all safety features are generic and clinically useless
- [ ] **Proactive auto-alert on prescription draft** — fires when doctor adds a drug to the prescription. Checks allergy + DDI + contraindication + dosage in one Claude call. Returns severity-tiered response
- [ ] **Alert panel UI** — displays warnings inline in the prescription screen. CRITIQUE = red/blocking visual. MODERE = orange/notable. FAIBLE = grey/informational. Dismiss without justification except CRITIQUE
- [ ] **French-language clinical explanations** — Claude explains the risk, the mechanism, and proposes an alternative if one exists
- [ ] **Free-form chat panel** — doctor can ask any question about the current patient. Full dossier context passed in system prompt. Conversation history maintained in session
- [ ] **Patient identity header on all alerts** — patient name + ID displayed before any clinical content

### Add After Validation (v1.x)

Add when v1 is working and doctors are using it regularly.

- [ ] **Patient-specific dose calculation reasoning** — extend the context to include renal function + weight + age for dosage adjustment suggestions. Trigger: first reported doctor feedback about dose guidance
- [ ] **Alternative drug suggestions refined** — extend DB_MEDICAMENTS with therapeutic class data to improve the quality of alternatives proposed by Claude
- [ ] **Silent dismissal logging** — log every alert dismissal (drug, severity, timestamp, staff ID) in component state or sessionStorage. Prerequisite for any future audit trail

### Future Consideration (v2+)

Defer until the v1 safety loop is validated by clinical staff.

- [ ] **Temporal medication reasoning** — washout periods, recently stopped drugs, drug interactions with discontinued medications. Requires prescription history dates in the data model
- [ ] **Override audit dashboard** — surface patterns (which doctors dismiss which alerts most) for pharmacy review. Non-trivial persistence requirement, out of scope for v1
- [ ] **Multi-turn reasoning memory across sessions** — allowing a doctor to reference a prior session conversation. RGPD complexity, session management overhead; not needed for safety

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Patient dossier context injection | HIGH | LOW | P1 |
| Proactive allergy conflict detection | HIGH | LOW | P1 |
| Drug-drug interaction warning | HIGH | MEDIUM | P1 |
| Contraindication detection | HIGH | MEDIUM | P1 |
| Dosage warning (age/weight/renal) | HIGH | MEDIUM | P1 |
| Alert severity tier display (CRITIQUE/MODERE/FAIBLE) | HIGH | LOW | P1 |
| Free-form clinical Q&A panel | HIGH | LOW | P1 |
| French-language explanation + alternative | HIGH | LOW | P1 |
| Session chat history (multi-turn) | MEDIUM | LOW | P1 |
| Patient identity header on alerts | HIGH | LOW | P1 |
| Alert dismissal without forced justification | HIGH | LOW | P1 |
| Patient-specific dose calculation reasoning | HIGH | MEDIUM | P2 |
| Therapeutic alternative suggestions (refined) | MEDIUM | MEDIUM | P2 |
| Silent dismissal logging | MEDIUM | LOW | P2 |
| Temporal medication reasoning | MEDIUM | HIGH | P3 |
| Override audit dashboard | LOW | HIGH | P3 |

**Priority key:**
- P1: Must have for launch — safety value proposition depends on these
- P2: Should have, add when core is validated
- P3: Nice to have, future consideration

---

## Competitor Feature Analysis

| Feature | Rule-based CDSS (Epic, Cerner) | LLM chatbots (ChatGPT, Gemini) | SILLAGE Approach |
|---------|-------------------------------|-------------------------------|------------------|
| Drug-allergy check | Yes, via static rules | Generic (no patient data) | Patient-specific via Claude + dossier |
| DDI detection | Yes, via database matching | Partially (no real-time patient context) | Patient-specific current meds passed to Claude |
| Contraindication detection | Yes, rule-based | Generic | Patient diagnoses passed in structured context |
| Dosage guidance | Rule-based thresholds | Generic population norms | Patient-specific (age, weight, labs in context) |
| Free-form Q&A | No | Yes (no patient context) | Yes + full patient context |
| Alert fatigue mitigation | Poor (96% override rates documented) | N/A | Severity tiering + non-interruptive design |
| Plain-language explanation | No — codes and terse messages | Yes | Yes — mandated in system prompt |
| Alternative suggestion | Rarely | Inconsistently | Yes — mandated in system prompt output schema |
| French-language output | Vendor-dependent | Yes | Yes — enforced in system prompt |

---

## Drug Safety Feature Completeness

The four core safety categories that clinical decision support must cover, mapped against this project:

| Safety Category | Coverage | Source | Gap |
|-----------------|----------|--------|-----|
| Drug-allergy (DAI) | Full | KNOWN_ALLERGIES + patient allergies field | None in scope |
| Drug-drug interaction (DDI) | Full (LLM-reasoned) | DB_MEDICAMENTS active prescriptions | LLM reasoning quality depends on prompt quality |
| Drug-disease contraindication | Full (LLM-reasoned) | DB_OBSERVATIONS diagnoses | DB_OBSERVATIONS coverage determines quality |
| Drug-dose check | Partial (LLM-reasoned) | DB_CONSTANTES vitals + age/weight | Renal function data availability depends on DB_CONSTANTES completeness |
| Duplicate therapy detection | Not in v1 scope | — | Nice-to-have v2 |
| Drug-lab interaction | Not in v1 scope | — | Would require lab result parsing from DB_IMAGERIE |

---

## Clinical UX Considerations

These are not features — they are design constraints that determine whether any feature works in practice.

**Alert positioning:** Alerts must appear in the prescription screen, adjacent to the drug being prescribed, not in a separate panel the doctor has to navigate to. The doctor's eye is on the prescription form; the warning must be there.

**Non-interruptive by default:** Research consistently shows that interruptive (modal/popup) alerts generate the worst override rates (96% in multiple studies). Inline severity-tiered banners that don't interrupt the prescribing flow are preferred. Reserve modal interruption for CRITIQUE-level only.

**Response latency:** Claude API calls take 1-3 seconds. For auto-alerts, trigger the call when the drug is selected (not when the order is submitted) to hide the latency behind the doctor's natural pause to review the prescription. Never block the UI waiting for a safety check response.

**Trust calibration:** Avoid numerical confidence scores. Research (2025) shows they cause overreliance when high and dismissal when low, both degrading clinical judgment. Use severity tiers with a clear written rationale instead.

**Override design:** Every alert that can be dismissed must be dismissable with one click. The CRITIQUE tier should require a brief reason (free text, not a dropdown — forced-choice override reasons are gamed immediately). Log silently.

**Chat panel as tool, not interface:** The chat must not try to be conversational-friendly. Doctors are busy. Responses should be structured, scannable, and under 150 words for standard queries. Only expand to full explanation if the doctor explicitly asks.

---

## Sources

- [AI use for optimizing medication alerts — JAMIA scoping review (PMC)](https://pmc.ncbi.nlm.nih.gov/articles/PMC11105146/)
- [Computerized CDSS to prevent medication errors — NCBI Bookshelf](https://www.ncbi.nlm.nih.gov/books/NBK600580/)
- [Alert fatigue and interaction design — JAMIA systematic review](https://academic.oup.com/jamia/article/26/10/1141/5519579)
- [Replacing interruptive alert with passive CDS — PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC10830237/)
- [LLM as CDSS — medication safety in 16 specialties (Cell Reports Medicine)](https://www.cell.com/cell-reports-medicine/fulltext/S2666-3791(25)00396-9)
- [Explainability and AI confidence in CDSS — IJHCI 2025](https://www.tandfonline.com/doi/full/10.1080/10447318.2025.2539458)
- [Reduced effectiveness of interruptive DDI alerts after EHR conversion — JGIM](https://link.springer.com/article/10.1007/s11606-018-4415-9)
- [FDA 2026 revised Clinical Decision Support guidance — Covington](https://www.cov.com/en/news-and-insights/insights/2026/01/5-key-takeaways-from-fdas-revised-clinical-decision-support-cds-software-guidance)
- [AI-driven CDSS for medication selection — ScienceDirect 2025](https://www.sciencedirect.com/science/article/abs/pii/S2212958825000886)
- [ChatGPT vs CDSS in DDI analysis — Clinical Pharmacology & Therapeutics 2025](https://ascpt.onlinelibrary.wiley.com/doi/full/10.1002/cpt.3585)
- [AI chatbot in French hospital (pharmacy Q&A) — JMIR Human Factors](https://humanfactors.jmir.org/2022/4/e39102/)
- [Don't rely on AI chatbots for drug info — BMJ Group](https://bmjgroup.com/dont-rely-on-ai-chatbots-for-accurate-safe-drug-information-patients-warned/)
- [LLM confidence benchmarking in clinical questions — JMIR Medical Informatics 2025](https://medinform.jmir.org/2025/1/e66917)
- [Clinical-pharmaceutical CDSS alert appropriateness — Frontiers Pharmacology 2025](https://www.frontiersin.org/journals/pharmacology/articles/10.3389/fphar.2025.1510425/full)

---

*Feature research for: Clinical drug safety chatbot — SILLAGE hospital prescription system*
*Researched: 2026-03-05*
