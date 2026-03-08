// ─────────────────────────────────────────────────────────────────────────────
//  DossierPanel
//  Accordion list of all patients with their demographics, allergy tags, and
//  a summary of prescriptions / orders already recorded in SILLAGE.
//  Props: prescriptions — shared store from the root state
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import { DB_PATIENTS, KNOWN_ALLERGIES } from "../../database";
import { ACCENT, CARD, BORDER, MUTED, RED, AMBER } from "../../constants/theme";

/** Blood-type → accent colour (matches SILLAGE palette). */
const BLOOD_COLORS = {
  "A+":  "#E53E3E", "A-":  "#FC8181",
  "B+":  "#DD6B20", "B-":  "#F6AD55",
  "AB+": "#805AD5", "AB-": "#B794F4",
  "O+":  "#2B6CB0", "O-":  "#63B3ED",
};

/**
 * @param {{ prescriptions: Array }} props
 */
function DossierPanel({ prescriptions }) {
  const [expanded, setExpanded] = useState(() =>
    Object.fromEntries(
      DB_PATIENTS.map(p => [
        p.patient_id,
        prescriptions.filter(r => r.patient_id === p.patient_id).length > 0,
      ])
    )
  );

  const toggle = (id) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {DB_PATIENTS.map(p => {
        const rxList    = prescriptions.filter(r => r.patient_id === p.patient_id);
        const allergies = KNOWN_ALLERGIES[p.patient_id] || [];
        const age       = new Date().getFullYear() - new Date(p.date_of_birth).getFullYear();
        const urgentRx  = rxList.filter(r => r.priorite === "URGENTE" || r.priorite === "STAT");
        const isOpen    = !!expanded[p.patient_id];

        return (
          <div key={p.patient_id} style={{
            background:  CARD,
            borderRadius: 14,
            border: `1px solid ${isOpen ? ACCENT + "30" : BORDER}`,
            boxShadow:   isOpen ? "0 4px 16px rgba(15,76,117,.08)" : "0 1px 4px rgba(0,0,0,.04)",
            overflow: "hidden",
            transition: "box-shadow .2s, border-color .2s",
          }}>

            {/* ── Patient header (toggle) ── */}
            <button onClick={() => toggle(p.patient_id)} style={{
              width: "100%", display: "flex", alignItems: "center", gap: 14,
              padding: "16px 20px", background: "none", border: "none", cursor: "pointer",
              fontFamily: "'DM Sans', sans-serif",
              borderBottom: isOpen ? `1px solid ${BORDER}` : "none",
            }}>
              {/* Blood-type badge */}
              <div style={{
                width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                background: (BLOOD_COLORS[p.blood_type] || ACCENT) + "18",
                display: "grid", placeItems: "center",
              }}>
                <span style={{ fontWeight: 800, fontSize: 12, fontFamily: "'Space Mono', monospace",
                  color: BLOOD_COLORS[p.blood_type] || ACCENT }}>
                  {p.blood_type}
                </span>
              </div>

              {/* Name + meta */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 700, fontSize: 15, color: "#1A1A2E" }}>
                    {p.gender === "F" ? "Mme" : "M."} {p.first_name} {p.last_name}
                  </span>
                  <span style={{ fontSize: 11, color: MUTED, fontFamily: "'Space Mono', monospace" }}>
                    {p.ipp}
                  </span>
                  {allergies.length > 0 && (
                    <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 5,
                      background: RED + "18", color: RED }}>
                      ALLERGIE
                    </span>
                  )}
                  {urgentRx.length > 0 && (
                    <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 5,
                      background: AMBER + "18", color: AMBER }}>
                      {urgentRx.length} URGENT
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>
                  {p.ward} · Chambre {p.room} · {age} ans · {p.gender === "F" ? "Femme" : "Homme"}
                </div>
              </div>

              {/* Chevron */}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={MUTED}
                strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                style={{ flexShrink: 0, transition: "transform .2s",
                  transform: isOpen ? "rotate(180deg)" : "none" }}>
                <path d="M6 9l6 6 6-6"/>
              </svg>
            </button>

            {/* ── Expanded body: demographics + prescriptions side-by-side ── */}
            {isOpen && (
              <div style={{ display: "flex", gap: 0, flexWrap: "wrap" }}>

                {/* Left: patient info */}
                <div style={{ flex: "0 0 260px", padding: "16px 20px", borderRight: `1px solid ${BORDER}` }}>
                  <div style={{ fontWeight: 700, fontSize: 11, color: MUTED, textTransform: "uppercase",
                    letterSpacing: .5, marginBottom: 10 }}>Informations</div>
                  <table style={{ fontSize: 13, lineHeight: 1.9, width: "100%" }}>
                    <tbody>
                      {[
                        ["Naissance", new Date(p.date_of_birth).toLocaleDateString("fr-FR")],
                        ["Âge",       age + " ans"],
                        ["Sexe",      p.gender === "F" ? "Féminin" : "Masculin"],
                        ["Groupe",    p.blood_type],
                        ["Service",   p.ward],
                        ["Chambre",   p.room],
                      ].map(([k, v]) => (
                        <tr key={k}>
                          <td style={{ color: MUTED, fontWeight: 600, paddingRight: 10,
                            whiteSpace: "nowrap", fontSize: 12 }}>{k}</td>
                          <td style={{ fontWeight: 500 }}>{v}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Allergy tags */}
                  {allergies.length > 0 && (
                    <div style={{ marginTop: 12 }}>
                      <div style={{ fontWeight: 700, fontSize: 11, color: RED, textTransform: "uppercase",
                        letterSpacing: .5, marginBottom: 6 }}>Allergies</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                        {allergies.map(a => (
                          <span key={a} style={{ fontSize: 11, fontWeight: 600, padding: "3px 8px",
                            borderRadius: 5, background: RED + "12", color: RED,
                            textTransform: "capitalize" }}>
                            {a}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Right: orders & prescriptions */}
                <div style={{ flex: "1 1 300px", padding: "16px 20px" }}>
                  <div style={{ fontWeight: 700, fontSize: 11, color: MUTED, textTransform: "uppercase",
                    letterSpacing: .5, marginBottom: 10 }}>
                    Actes &amp; Ordres{" "}
                    {rxList.length > 0 && (
                      <span style={{ color: ACCENT }}>({rxList.length})</span>
                    )}
                  </div>

                  {rxList.length > 0 ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {rxList.map(rx => {
                        const prioColor =
                          rx.priorite === "URGENTE" || rx.priorite === "STAT" ? RED
                          : rx.priorite === "NORMALE" ? AMBER : MUTED;
                        return (
                          <div key={rx.prescription_id} style={{
                            display: "flex", alignItems: "flex-start", gap: 10,
                            padding: "10px 14px", borderRadius: 10,
                            border: `1px solid ${BORDER}`, background: "#FAFBFC",
                          }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: 600, fontSize: 13 }}>
                                {rx.drug_name_free || rx.examen || rx.action || "—"}
                              </div>
                              {(rx.dosage || rx.route || rx.frequency) && (
                                <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>
                                  {[rx.dosage, rx.route, rx.frequency].filter(Boolean).join(" · ")}
                                </div>
                              )}
                              {rx.indication && (
                                <div style={{ fontSize: 11, color: MUTED }}>
                                  Indication : {rx.indication}
                                </div>
                              )}
                              {rx.allergyAlert && (
                                <div style={{ fontSize: 11, fontWeight: 700, color: RED, marginTop: 3 }}>
                                  Allergie : {rx.allergyAlert}
                                </div>
                              )}
                            </div>
                            <div style={{ display: "flex", flexDirection: "column",
                              alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
                              {rx.priorite && (
                                <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px",
                                  borderRadius: 5, background: prioColor + "18", color: prioColor }}>
                                  {rx.priorite}
                                </span>
                              )}
                              <span style={{ fontSize: 10, color: MUTED }}>
                                {rx.is_validated ? "✓ Validé" : rx.is_cancelled ? "Annulé" : "En attente"}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div style={{ fontSize: 13, color: MUTED, fontStyle: "italic", paddingTop: 4 }}>
                      Aucun acte ou ordre enregistré.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default DossierPanel;
