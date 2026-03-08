// ─────────────────────────────────────────────────────────────────────────────
//  ImageriePanel
//  Grid of imaging exams grouped by patient, filterable by status.
//  Reads DB_IMAGERIE and DB_PATIENTS from the static database.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import { DB_PATIENTS, DB_IMAGERIE, KNOWN_ALLERGIES } from "../../database";
import { ACCENT, CARD, BORDER, MUTED, RED, AMBER, GREEN } from "../../constants/theme";

/** Blood-type → accent colour. */
const BLOOD_COLORS = {
  "A+":  "#E53E3E", "A-":  "#FC8181",
  "B+":  "#DD6B20", "B-":  "#F6AD55",
  "AB+": "#805AD5", "AB-": "#B794F4",
  "O+":  "#2B6CB0", "O-":  "#63B3ED",
};

/** Exam status → highlight colour. */
const STATUS_COLOR = { "En attente": AMBER, "Disponible": GREEN, "Réalisé": MUTED };

/** Generic imaging icon (reused for every exam card). */
const ExamIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={MUTED}
    strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="3"/>
    <circle cx="12" cy="12" r="4"/>
    <path d="M16.5 7.5l.5-.5"/>
  </svg>
);

/** Status filter button pills. */
const FILTERS = ["Tout", "En attente", "Disponible", "Réalisé"];

function ImageriePanel() {
  const [filter, setFilter] = useState("Tout");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

      {/* ── Filter bar ── */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {FILTERS.map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: "5px 14px", borderRadius: 20,
            border: `1px solid ${filter === f ? ACCENT : BORDER}`,
            background: filter === f ? ACCENT : CARD,
            color:      filter === f ? "#fff" : MUTED,
            fontWeight: filter === f ? 700 : 500,
            fontSize: 12, cursor: "pointer",
            fontFamily: "'DM Sans', sans-serif", transition: "all .15s",
          }}>{f}</button>
        ))}
      </div>

      {/* ── Patient sections ── */}
      {DB_PATIENTS.map(p => {
        const examens = DB_IMAGERIE.filter(e =>
          e.patient_id === p.patient_id && (filter === "Tout" || e.status === filter)
        );
        if (examens.length === 0) return null;

        const age       = new Date().getFullYear() - new Date(p.date_of_birth).getFullYear();
        const allergies = KNOWN_ALLERGIES[p.patient_id] || [];

        return (
          <div key={p.patient_id} style={{
            background: CARD, borderRadius: 14, border: `1px solid ${BORDER}`,
            overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,.04)",
          }}>
            {/* Patient header */}
            <div style={{ display: "flex", alignItems: "center", gap: 14,
              padding: "14px 20px", borderBottom: `1px solid ${BORDER}` }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                background: (BLOOD_COLORS[p.blood_type] || ACCENT) + "18",
                display: "grid", placeItems: "center" }}>
                <span style={{ fontWeight: 800, fontSize: 11, fontFamily: "'Space Mono', monospace",
                  color: BLOOD_COLORS[p.blood_type] || ACCENT }}>
                  {p.blood_type}
                </span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 700, fontSize: 14, color: "#1A1A2E" }}>
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
                <div style={{ fontSize: 12, color: MUTED, marginTop: 1 }}>
                  {p.ward} · Chambre {p.room} · {age} ans
                </div>
              </div>
              <span style={{ fontSize: 12, color: MUTED, fontWeight: 600 }}>
                {examens.length} examen{examens.length > 1 ? "s" : ""}
              </span>
            </div>

            {/* Exam grid */}
            <div style={{ display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: 12, padding: "14px 20px" }}>
              {examens.map(e => {
                const sColor = STATUS_COLOR[e.status] || MUTED;
                return (
                  <div key={e.id} style={{ borderRadius: 10, border: `1px solid ${BORDER}`,
                    padding: "14px 16px", background: "#FAFBFC",
                    display: "flex", flexDirection: "column", gap: 6 }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                      <div style={{ flexShrink: 0, marginTop: 1 }}><ExamIcon /></div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 13, color: "#1A1A2E", lineHeight: 1.3 }}>
                          {e.type}
                        </div>
                        <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>
                          {new Date(e.date).toLocaleDateString("fr-FR", {
                            day: "numeric", month: "long", year: "numeric",
                          })}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 5,
                        background: sColor + "18", color: sColor }}>
                        {e.status}
                      </span>
                      {e.priority === "URGENTE" && (
                        <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 5,
                          background: RED + "18", color: RED }}>URGENTE</span>
                      )}
                    </div>
                    <p style={{ fontSize: 12, color: MUTED, margin: 0, lineHeight: 1.5 }}>
                      {e.description}
                    </p>
                    <div style={{ fontSize: 11, fontWeight: e.reader ? 600 : 400,
                      color: e.reader ? ACCENT : MUTED, marginTop: 2 }}>
                      {e.reader || "En attente de lecture"}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default ImageriePanel;
