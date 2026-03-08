// ─────────────────────────────────────────────────────────────────────────────
//  ObservationsPanel
//  Accordion of clinical notes and vital-sign time-series per patient.
//  Notes are grouped by category; the latest vitals row is highlighted.
//  Reads DB_OBSERVATIONS, DB_CONSTANTES, DB_PATIENTS from the static database.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import { DB_PATIENTS, DB_OBSERVATIONS, DB_CONSTANTES, KNOWN_ALLERGIES } from "../../database";
import { ACCENT, CARD, BORDER, MUTED, RED, GREEN } from "../../constants/theme";

/** Blood-type → accent colour. */
const BLOOD_COLORS = {
  "A+":  "#E53E3E", "A-":  "#FC8181",
  "B+":  "#DD6B20", "B-":  "#F6AD55",
  "AB+": "#805AD5", "AB-": "#B794F4",
  "O+":  "#2B6CB0", "O-":  "#63B3ED",
};

/** Clinical note category → badge colour. */
const CAT_COLOR = { "Entrée": ACCENT, "Évolution": MUTED, "Urgence": RED, "Sortie": GREEN };

function ObservationsPanel() {
  const [expanded, setExpanded] = useState(() =>
    Object.fromEntries(DB_PATIENTS.map(p => [p.patient_id, true]))
  );

  const toggle = (id) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {DB_PATIENTS.map(p => {
        const notes      = DB_OBSERVATIONS.filter(o => o.patient_id === p.patient_id);
        const constantes = DB_CONSTANTES
          .filter(c => c.patient_id === p.patient_id)
          .sort((a, b) => new Date(b.date) - new Date(a.date));
        const allergies  = KNOWN_ALLERGIES[p.patient_id] || [];
        const age        = new Date().getFullYear() - new Date(p.date_of_birth).getFullYear();
        const isOpen     = !!expanded[p.patient_id];

        return (
          <div key={p.patient_id} style={{
            background: CARD, borderRadius: 14,
            border: `1px solid ${isOpen ? ACCENT + "30" : BORDER}`,
            boxShadow: isOpen ? "0 4px 16px rgba(15,76,117,.08)" : "0 1px 4px rgba(0,0,0,.04)",
            overflow: "hidden", transition: "box-shadow .2s, border-color .2s",
          }}>

            {/* ── Header ── */}
            <button onClick={() => toggle(p.patient_id)} style={{
              width: "100%", display: "flex", alignItems: "center", gap: 14,
              padding: "16px 20px", background: "none", border: "none",
              cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
              borderBottom: isOpen ? `1px solid ${BORDER}` : "none",
            }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                background: (BLOOD_COLORS[p.blood_type] || ACCENT) + "18",
                display: "grid", placeItems: "center" }}>
                <span style={{ fontWeight: 800, fontSize: 12, fontFamily: "'Space Mono', monospace",
                  color: BLOOD_COLORS[p.blood_type] || ACCENT }}>
                  {p.blood_type}
                </span>
              </div>
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
                      background: RED + "18", color: RED }}>ALLERGIE</span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>
                  {p.ward} · Chambre {p.room} · {age} ans
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

            {/* ── Body: notes + constantes side-by-side ── */}
            {isOpen && (
              <div style={{ display: "flex", gap: 0, flexWrap: "wrap" }}>

                {/* Left: clinical notes */}
                <div style={{ flex: "1 1 300px", padding: "16px 20px",
                  borderRight: `1px solid ${BORDER}` }}>
                  <div style={{ fontWeight: 700, fontSize: 11, color: MUTED, textTransform: "uppercase",
                    letterSpacing: .5, marginBottom: 12 }}>Notes cliniques</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {notes.map(n => {
                      const cc = CAT_COLOR[n.category] || MUTED;
                      return (
                        <div key={n.id} style={{ padding: "10px 12px", borderRadius: 9,
                          border: `1px solid ${BORDER}`, background: "#FAFBFC" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8,
                            marginBottom: 6, flexWrap: "wrap" }}>
                            <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px",
                              borderRadius: 5, background: cc + "18", color: cc }}>
                              {n.category}
                            </span>
                            <span style={{ fontSize: 11, color: MUTED }}>
                              {new Date(n.date).toLocaleDateString("fr-FR", {
                                day: "numeric", month: "short", year: "numeric",
                                hour: "2-digit", minute: "2-digit",
                              })}
                            </span>
                            <span style={{ fontSize: 11, fontWeight: 600, color: ACCENT }}>
                              {n.author}
                            </span>
                          </div>
                          <p style={{ fontSize: 13, color: "#2D3748", margin: 0, lineHeight: 1.6 }}>
                            {n.text}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Right: vital signs table */}
                <div style={{ flex: "0 0 340px", padding: "16px 20px" }}>
                  <div style={{ fontWeight: 700, fontSize: 11, color: MUTED, textTransform: "uppercase",
                    letterSpacing: .5, marginBottom: 12 }}>Constantes vitales</div>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ fontSize: 12, width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr>
                          {["Date", "TA", "FC", "Temp", "SpO2", "Poids"].map(h => (
                            <th key={h} style={{ fontWeight: 700, fontSize: 11, color: MUTED,
                              textAlign: "left", padding: "4px 8px 8px",
                              borderBottom: `1px solid ${BORDER}`, whiteSpace: "nowrap" }}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {constantes.map((c, i) => (
                          <tr key={c.id} style={{ background: i === 0 ? ACCENT + "08" : "transparent" }}>
                            <td style={{ padding: "5px 8px", fontSize: 11, color: MUTED, whiteSpace: "nowrap" }}>
                              {new Date(c.date).toLocaleDateString("fr-FR", {
                                day: "2-digit", month: "2-digit",
                                hour: "2-digit", minute: "2-digit",
                              })}
                            </td>
                            {[
                              `${c.ta} mmHg`, `${c.fc} bpm`,
                              `${c.temp} °C`, `${c.spo2}%`, `${c.poids} kg`,
                            ].map((v, j) => (
                              <td key={j} style={{ padding: "5px 8px", whiteSpace: "nowrap",
                                fontWeight: i === 0 ? 700 : 400,
                                color:      i === 0 ? "#1A1A2E" : "#2D3748" }}>
                                {v}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default ObservationsPanel;
