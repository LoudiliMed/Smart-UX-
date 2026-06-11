// ─────────────────────────────────────────────────────────────────────────────
//  NLPBot
//  Primary input interface for medical orders.  The user types (or dictates)
//  a free-text clinical phrase; the AI parses it into a structured JSON record
//  that is previewed in a chat-style feed before being saved to SILLAGE.
//
//  Multi-step dialogue flow:
//    1. User submits phrase → AI returns structured JSON
//    2. Bot asks: "Quel est le délai imparti ?"          (parseDelay)
//    3. Bot asks: "Combien de fois par jour ?"           (parsePositiveInt)
//    4. Bot asks: "Pour combien de jours ?"              (parseNbJours)
//    5. Confirmation message with "Save to SILLAGE" and "Export PDF" buttons.
//
//  Props:
//    onPrescription    (rx) => void   — add completed Rx to shared store
//    onPatientResolved (id) => void   — update selected patient in root
//    patient           object|null   — currently selected patient (for AlertSystem)
//    prescriptions     Array         — patient's existing prescriptions
//    compact           boolean       — compact rendering for sidebar use
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useCallback, useRef, useEffect } from "react";

import { parseWithClaude, savePrescription } from "../../api/client";
import { autoCorrect, mapNLPToPrescription, parseDelay, parsePositiveInt, parseFrequencyToTimesPerDay, parseNbJours } from "../../utils/nlp";
import { exportPDF } from "../../utils/pdf";
import { ACCENT, ACCENT2, CARD, BORDER, MUTED, RED, AMBER, GREEN } from "../../constants/theme";

import { AlertSystem } from "../alerts/AlertSystem";
import AutocompleteInput from "../ui/AutocompleteInput";
import Btn from "../ui/Btn";
import Badge from "../ui/Badge";

/** Example phrases shown as quick-fill chips above the chat area. */
const EXAMPLES = [
  "Prescrire 500mg de Doliprane per os toutes les 6h pour le patient Dupont",
  "Mme Lefevre signale une allergie à la pénicilline — mettre en dossier urgent",
  "Radiographie thoracique en urgence pour le patient Hakimi chambre 201",
  "Transfert du patient Tremblay de cardiologie vers réanimation, priorité haute",
  "Injecter 4000UI de Lovenox en SC pour Morin — indication TVP",
];

/**
 * @param {{
 *   onPrescription:    (rx: object) => void,
 *   onPatientResolved: (id: number) => void,
 *   patient:           object|null,
 *   prescriptions:     Array,
 *   compact:           boolean,
 * }} props
 */
function NLPBot({
  onPrescription,
  onPatientResolved,
  patient    = null,
  prescriptions = [],
  compact    = false,
}) {
  const [input,        setInput]        = useState("");
  const [history,      setHistory]      = useState([]);
  const [loading,      setLoading]      = useState(false);
  const [saved,        setSaved]        = useState({});   // prescription_id → true
  const [pendingDelay, setPendingDelay] = useState(null); // { rx, type, step, collected }

  const bottomRef = useRef(null);

  // ── Determine order type from parsed rx ──────────────────────────────────
  function getOrderType(rx) {
    if (rx.examen || rx.action === "planifier") return "imaging";
    if (rx.action === "prescrire" && !rx.examen) return "medication";
    return "other"; // transfert, signaler, stopper, modifier
  }

  // ── Get the first dialogue step for an order type, skipping pre-filled ──
  function getFirstStep(rx, type) {
    if (type === "medication") {
      if (!rx.frequency && !rx.fois_par_jour) return "fois_par_jour";
      return "nb_jours";
    }
    if (type === "imaging") {
      if (!rx.priorite) return "urgence";
      return "delay";
    }
    return "delay"; // other
  }

  // ── Get the question text for the first step ────────────────────────────
  function getStepQuestion(step) {
    switch (step) {
      case "fois_par_jour": return "Combien de fois par jour ? (ex : 1, 2, 3)";
      case "nb_jours":      return "Pour combien de jours ? (ex : 5, 7, 2 semaines)";
      case "urgence":       return "Quelle est la priorité ? (STAT / URGENTE / NORMALE)";
      case "delay":         return "Quel est le délai imparti ? (ex : 2h, 24h, 3 jours, aucun)";
      case "indication":    return "Indication clinique ? (motif de l'examen)";
      default:              return "Quel est le délai imparti ?";
    }
  }

  // ── Finalize the dialogue: build summary and show save button ───────────
  function finalizeDialogue(rx, type, collected) {
    const echeance = collected.echeance;
    const echeanceLabel = !echeance || echeance === "immediate"
      ? "Immédiat"
      : new Date(echeance).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

    const updatedRx = {
      ...rx,
      echeance: echeance === "immediate" ? null : (echeance || null),
      fois_par_jour: collected.fois_par_jour || rx.fois_par_jour || null,
      nb_jours: collected.nb_jours || rx.nb_jours || null,
      urgence: collected.urgence || rx.priorite || null,
      indication_clinique: collected.indication_clinique || rx.indication || null,
    };

    // Patch the most recent bot-message with the updated Rx
    setHistory(h => h.map((m, i) =>
      (m.role === "bot" && i === h.length - 2) ? { ...m, rx: updatedRx } : m
    ));

    let summary;
    if (type === "medication") {
      const fpj = updatedRx.fois_par_jour;
      const nbj = updatedRx.nb_jours;
      summary = `${fpj}x/jour -- ${nbj} jour${nbj > 1 ? "s" : ""}`;
    } else if (type === "imaging") {
      const urg = updatedRx.urgence || "NORMALE";
      const ind = updatedRx.indication_clinique || "-";
      summary = `Priorité : ${urg} -- Délai : ${echeanceLabel} -- Indication : ${ind}`;
    } else {
      summary = `Délai : ${echeanceLabel}`;
    }

    setHistory(h => [...h, { role: "bot-info", text: summary, rx: updatedRx }]);
    setPendingDelay(null);
  }

  // Auto-scroll to the latest message
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [history]);

  // ── Submit handler ──────────────────────────────────────────────────────────
  const send = useCallback(async (text) => {
    if (!text.trim()) return;

    // ── Multi-step order-type-aware dialogue ────────────────────────────────
    if (pendingDelay) {
      const userText = text.trim();
      setHistory(h => [...h, { role: "user", text: userText }]);
      setInput("");

      const { rx, type, step, collected } = pendingDelay;

      // --- Step handlers (shared across flows) ---

      // Frequency (medication only)
      if (step === "fois_par_jour") {
        const foisParJour = parsePositiveInt(userText);
        if (!foisParJour) {
          setHistory(h => [...h, { role: "bot-question", text: "Valeur non reconnue. Indiquez un nombre entier (ex : 1, 2, 3)." }]);
          return;
        }
        const next = { ...pendingDelay, collected: { ...collected, fois_par_jour: foisParJour } };
        next.step = "nb_jours";
        setPendingDelay(next);
        setHistory(h => [...h, { role: "bot-question", text: "Pour combien de jours ? (ex : 5, 7, 2 semaines)" }]);
        return;
      }

      // Duration in days (medication only) → finalize directly, no delay question
      if (step === "nb_jours") {
        const nbJours = parseNbJours(userText);
        if (!nbJours) {
          setHistory(h => [...h, { role: "bot-question", text: "Valeur non reconnue. Indiquez un nombre de jours (ex : 5, 7) ou de semaines (ex : 2 semaines)." }]);
          return;
        }
        finalizeDialogue(rx, type, { ...collected, nb_jours: nbJours });
        return;
      }

      // Urgency (imaging only)
      if (step === "urgence") {
        const normalized = userText.toUpperCase();
        const urgence = normalized.includes("STAT") ? "STAT"
          : (normalized.includes("URGENT") || normalized.includes("HAUTE")) ? "URGENTE"
          : "NORMALE";
        const next = { ...pendingDelay, collected: { ...collected, urgence } };
        next.step = "delay";
        setPendingDelay(next);
        setHistory(h => [...h, { role: "bot-question", text: "Quel est le délai souhaité ? (ex : 2h, 24h, aucun)" }]);
        return;
      }

      // Indication clinique (imaging only)
      if (step === "indication") {
        const next = { ...pendingDelay, collected: { ...collected, indication_clinique: userText } };
        // Finalize imaging flow
        finalizeDialogue(rx, type, next.collected);
        return;
      }

      // Delay (all flows)
      if (step === "delay") {
        const echeance = parseDelay(userText);
        if (!echeance) {
          setHistory(h => [...h, { role: "bot-question", text: "Délai non reconnu. Indiquez un délai valide (ex : 2h, 24h, 3 jours) ou « aucun »." }]);
          return;
        }
        const newCollected = { ...collected, echeance };

        // What comes after delay depends on flow type
        if (type === "imaging") {
          // After delay → indication (if not already extracted)
          if (!rx.indication && !rx.diagnostic) {
            setPendingDelay({ ...pendingDelay, step: "indication", collected: newCollected });
            setHistory(h => [...h, { role: "bot-question", text: "Indication clinique ? (motif de l'examen)" }]);
            return;
          }
          newCollected.indication_clinique = rx.indication || rx.diagnostic;
          finalizeDialogue(rx, type, newCollected);
          return;
        }
        // medication & other → finalize
        finalizeDialogue(rx, type, newCollected);
        return;
      }
    }

    // ── Normal NLP flow ────────────────────────────────────────────────────
    const { corrected, corrections } = autoCorrect(text.trim());
    setHistory(h => [...h, {
      role: "user", text: corrected,
      corrections: corrections.length > 0 ? corrections : null,
    }]);
    setInput("");
    setLoading(true);

    const structured = await parseWithClaude(corrected);
    if (structured.erreur) {
      setHistory(h => [...h, {
        role: "bot-error",
        text: `Erreur serveur IA : ${structured.erreur}. Vérifiez que le serveur tourne (node server.js) et que la clé Groq est valide.`,
      }]);
      setLoading(false);
      return;
    }

    const rx = mapNLPToPrescription(structured, corrected);
    setHistory(h => [...h, { role: "bot", text: structured, rx }]);
    if (rx._matched_patient && onPatientResolved) {
      onPatientResolved(rx._matched_patient.patient_id);
    }
    // Begin the order-type-aware dialogue
    const type = getOrderType(rx);
    const firstStep = getFirstStep(rx, type);
    const collected = {};
    // Smart-skip: pre-fill collected with fields already extracted by NLP
    if (type === "medication" && rx.frequency) collected.fois_par_jour = parseFrequencyToTimesPerDay(rx.frequency);
    if (type === "imaging" && rx.priorite) collected.urgence = rx.priorite;

    setHistory(h => [...h, {
      role: "bot-question",
      text: getStepQuestion(firstStep),
    }]);
    setPendingDelay({ rx, type, step: firstStep, collected });
    setLoading(false);
  }, [pendingDelay, onPatientResolved]);

  // ── Save to SILLAGE ────────────────────────────────────────────────────────
  const handleSave = async (rx) => {
    await savePrescription(rx);
    onPrescription(rx);
    setSaved(s => ({ ...s, [rx.prescription_id]: true }));
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={compact ? {
      background: CARD, borderRadius: 14, border: `1px solid ${BORDER}`,
      boxShadow: "0 4px 20px rgba(15,76,117,.09)",
      display: "flex", flexDirection: "column", overflow: "hidden",
    } : {}}>

      {/* Compact mode header */}
      {compact && (
        <div style={{ padding: "13px 16px", borderBottom: `1px solid ${BORDER}`,
          background: ACCENT + "08", display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, background: ACCENT2 + "18",
            display: "grid", placeItems: "center", flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={ACCENT2}
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, color: ACCENT }}>Assistant IA</div>
            <div style={{ fontSize: 11, color: MUTED }}>Aide clinique contextuelle</div>
          </div>
        </div>
      )}

      {/* Example phrase chips — hidden in compact mode */}
      {!compact && (
        <div style={{ marginBottom: 16, display: "flex", flexWrap: "wrap", gap: 6 }}>
          <span style={{ fontSize: 12, color: MUTED, marginRight: 4, paddingTop: 4 }}>Exemples :</span>
          {EXAMPLES.map((ex, i) => (
            <button key={i} onClick={() => setInput(ex)} style={{
              padding: "5px 12px", borderRadius: 20, border: "1px solid #D1D5DB",
              background: "#fff", fontSize: 12, color: "#374151", cursor: "pointer",
              fontFamily: "'DM Sans', sans-serif",
              maxWidth: 300, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            }}>{ex}</button>
          ))}
        </div>
      )}

      {/* ── Chat feed ── */}
      <div style={{
        background: CARD,
        borderRadius:  compact ? 0 : 16,
        border:        compact ? "none" : `1px solid ${BORDER}`,
        minHeight:     compact ? 220 : 340,
        maxHeight:     compact ? 420 : 520,
        overflowY: "auto", padding: "16px 18px",
        display: "flex", flexDirection: "column", gap: 14,
        boxShadow: compact ? "none" : "0 2px 12px rgba(0,0,0,.04)",
      }}>
        {/* Empty state */}
        {history.length === 0 && (
          <div style={{ flex: 1, display: "grid", placeItems: "center",
            color: "#CBD5E1", fontSize: 14 }}>
            Commencez à saisir une phrase pour voir l'extraction NLP et l'enregistrement en base…
          </div>
        )}

        {history.map((m, i) => {
          if (m.role === "user") return (
            <div key={i} style={{ alignSelf: "flex-end", maxWidth: "80%" }}>
              <div style={{ background: ACCENT, color: "#fff", padding: "10px 16px",
                borderRadius: "14px 14px 4px 14px", fontSize: 14, lineHeight: 1.5 }}>
                {m.text}
              </div>
              {m.corrections && (
                <div style={{ fontSize: 11, color: AMBER, marginTop: 3, textAlign: "right" }}>
                  Corrigé : {m.corrections.map(c => `"${c.from}" → "${c.to}"`).join(", ")}
                </div>
              )}
            </div>
          );

          if (m.role === "bot-error") return (
            <div key={i} style={{ alignSelf: "flex-start", background: RED + "10",
              border: `1.5px solid ${RED}44`, borderRadius: "14px 14px 14px 4px",
              padding: "12px 18px", maxWidth: "85%", fontSize: 13, color: RED }}>
              <span style={{ fontWeight: 700, marginRight: 8 }}>Erreur</span>{m.text}
            </div>
          );

          if (m.role === "bot-question") return (
            <div key={i} style={{ alignSelf: "flex-start", background: AMBER + "18",
              border: `1.5px solid ${AMBER}44`, borderRadius: "14px 14px 14px 4px",
              padding: "12px 18px", maxWidth: "80%", fontSize: 14, color: "#334155" }}>
              <span style={{ fontWeight: 700, color: AMBER, marginRight: 8 }}>Question</span>
              {m.text}
            </div>
          );

          if (m.role === "bot-info") return (
            <div key={i} style={{ alignSelf: "flex-start", background: GREEN + "12",
              border: `1px solid ${GREEN}44`, borderRadius: "14px 14px 14px 4px",
              padding: "10px 16px", maxWidth: "80%", fontSize: 13, color: "#334155" }}>
              {m.text}
              {/* Save + PDF buttons — appear only when delay has been set */}
              {m.rx && !saved[m.rx.prescription_id] && (
                <div style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <Btn variant="green" style={{ padding: "7px 16px", fontSize: 12 }}
                    onClick={() => handleSave(m.rx)}>
                    Enregistrer dans SILLAGE
                  </Btn>
                  <button onClick={() => exportPDF(m.rx)} style={{
                    padding: "7px 14px", borderRadius: 8, border: `1px solid ${ACCENT}`,
                    background: "#fff", color: ACCENT, fontSize: 12, fontWeight: 600,
                    cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                  }}>📄 PDF</button>
                  <span style={{ fontSize: 11, color: MUTED }}>
                    {JSON.parse(m.rx.nlp_fields_auto || "[]").length} champs auto-remplis
                  </span>
                </div>
              )}
              {m.rx && saved[m.rx.prescription_id] && (
                <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ fontSize: 12, color: GREEN, fontWeight: 600 }}>
                    ✓ Enregistré dans SILLAGE
                  </span>
                  <button onClick={() => exportPDF(m.rx)} style={{
                    padding: "5px 12px", borderRadius: 7, border: `1px solid ${ACCENT}`,
                    background: "#fff", color: ACCENT, fontSize: 11, fontWeight: 600,
                    cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                  }}>📄 Exporter PDF</button>
                </div>
              )}
            </div>
          );

          // role === "bot" — structured extraction result
          return (
            <div key={i} style={{ alignSelf: "flex-start", maxWidth: "96%" }}>
              {/* Badge row */}
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8, flexWrap: "wrap" }}>
                <Badge color={ACCENT2}>Données structurées extraites</Badge>
                {m.rx?._matched_patient && (
                  <Badge color={GREEN} small>
                    {m.rx._matched_patient.first_name} {m.rx._matched_patient.last_name}
                  </Badge>
                )}
                {m.rx?._matched_drug && (
                  <Badge color={ACCENT} small>{m.rx._matched_drug.brand}</Badge>
                )}
                {m.rx?.nlp_confidence && (
                  <Badge color={
                    m.rx.nlp_confidence === "HIGH" ? GREEN
                    : m.rx.nlp_confidence === "MEDIUM" ? AMBER : RED
                  } small>
                    Conf. {m.rx.nlp_confidence}
                  </Badge>
                )}
              </div>

              {/* Allergy alert */}
              {m.rx?.allergyAlert && (
                <div style={{ background: RED + "15", border: `1px solid ${RED}40`,
                  borderRadius: 8, padding: "8px 14px", marginBottom: 8,
                  color: RED, fontWeight: 700, fontSize: 13 }}>
                  {m.rx.allergyAlert}
                </div>
              )}

              {/* Extracted JSON table */}
              <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 10,
                padding: 14, fontFamily: "'Space Mono', monospace", fontSize: 12,
                lineHeight: 1.6, overflowX: "auto" }}>
                {typeof m.text === "object" ? (
                  <table style={{ borderCollapse: "collapse", width: "100%" }}>
                    <tbody>
                      {Object.entries(m.text).map(([k, v]) => (
                        <tr key={k}>
                          <td style={{ padding: "4px 12px 4px 0", fontWeight: 700,
                            color: ACCENT, whiteSpace: "nowrap", verticalAlign: "top" }}>{k}</td>
                          <td style={{ padding: "4px 0", color: "#334155" }}>
                            {typeof v === "object" ? JSON.stringify(v) : String(v)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <pre style={{ margin: 0 }}>{JSON.stringify(m.text, null, 2)}</pre>
                )}
              </div>

              {/* Prescription row preview — save is disabled until delay is answered */}
              {m.rx && !m.text.erreur && (
                <div style={{ marginTop: 10, border: "1px solid #E2E8F0",
                  borderRadius: 10, overflow: "hidden" }}>
                  <div style={{ background: ACCENT + "08", padding: "10px 14px",
                    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: ACCENT }}>
                      Aperçu — Ligne de prescription générée
                    </span>
                    <span style={{ fontSize: 11, color: MUTED }}>→ table prescriptions</span>
                  </div>
                  <div style={{ padding: "10px 14px", display: "flex", flexWrap: "wrap", gap: "6px 16px" }}>
                    {[
                      ["Patient",    m.rx.patient_name_free],
                      ["Médicament", m.rx.drug_name_free],
                      ["Dose",       m.rx.dosage],
                      ["Forme",      m.rx.form],
                      ["Voie",       m.rx.route],
                      ["Fréquence",  m.rx.frequency],
                      ["Diagnostic", m.rx.diagnostic],
                      ["Service",    m.rx.service],
                      ["Chambre",    m.rx.chambre],
                      ["Priorité",   m.rx.priorite],
                      ["Allergie",   m.rx.allergie_signalee],
                      ["Action",     m.rx.action],
                      ["Examen",     m.rx.examen],
                      ["Fois/jour",  m.rx.fois_par_jour],
                      ["Nb jours",   m.rx.nb_jours],
                      ["Urgence",    m.rx.urgence],
                    ].filter(([, v]) => v).map(([label, val]) => (
                      <span key={label} style={{ fontSize: 12, color: "#334155" }}>
                        <span style={{ fontWeight: 600, color: MUTED }}>{label} : </span>{val}
                      </span>
                    ))}
                  </div>
                  <div style={{ padding: "8px 14px 12px", borderTop: "1px solid #F1F5F9",
                    display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={{ fontSize: 12, color: AMBER, fontStyle: "italic", flex: 1 }}>
                      En attente de complétion…
                    </span>
                    <button onClick={() => exportPDF(m.rx)} style={{
                      padding: "5px 12px", borderRadius: 7, border: `1px solid ${ACCENT}`,
                      background: "#fff", color: ACCENT, fontSize: 11, fontWeight: 600,
                      cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                    }}>📄 PDF</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Typing indicator */}
        {loading && (
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <div style={{ width: 18, height: 18, border: `2.5px solid #E5E7EB`,
              borderTopColor: ACCENT2, borderRadius: "50%",
              animation: "spin .7s linear infinite" }} />
            <span style={{ fontSize: 13, color: MUTED }}>Analyse NLP en cours…</span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* AlertSystem — drug interaction / allergy checker */}
      <AlertSystem
        patient={patient}
        currentDraft={
          history.findLast
            ? history.findLast(m => m.role === "bot")?.rx || null
            : (history.slice().reverse().find(m => m.role === "bot")?.rx || null)
        }
        prescriptions={prescriptions}
      />

      {/* ── Input bar ── */}
      <div style={{
        display: "flex", gap: 8, alignItems: "flex-start",
        marginTop:  compact ? 0 : 14,
        padding:    compact ? "12px 16px" : 0,
        borderTop:  compact ? `1px solid ${BORDER}` : "none",
        background: compact ? CARD : "transparent",
        flexShrink: 0,
      }}>
        <AutocompleteInput
          value={input}
          onChange={setInput}
          onSubmit={send}
          loading={loading}
          placeholder={
            pendingDelay ? "Répondez à la question ci-dessus…"
            : compact    ? "Posez votre question…"
            : undefined
          }
        />
        {compact ? (
          <button onClick={() => send(input)}
            disabled={loading || !input.trim()} style={{
              width: 38, height: 38, borderRadius: 10, border: "none", flexShrink: 0,
              background: (loading || !input.trim()) ? BORDER : ACCENT,
              color: "#fff",
              cursor: (loading || !input.trim()) ? "not-allowed" : "pointer",
              display: "grid", placeItems: "center", transition: "background .15s",
            }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"/>
              <polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
        ) : (
          <Btn onClick={() => send(input)} disabled={loading || !input.trim()}>
            {pendingDelay ? "Confirmer" : "Analyser"}
          </Btn>
        )}
      </div>
    </div>
  );
}

export default NLPBot;
