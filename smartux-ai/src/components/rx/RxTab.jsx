// ─────────────────────────────────────────────────────────────────────────────
//  RxTab  —  Actes & Ordres
//  Kanban-style view of prescriptions / medical orders, sorted into four
//  deadline-aware sections:
//    0. Expirent < 30 min    (orange — most urgent)
//    1. Tâches urgentes       (URGENTE / STAT priority)
//    2. Tâches à faire        (normal / unset priority)
//    3. Historique            (validated or cancelled)
//       └─ sub-sections: délai dépassé / dans les délais
//
//  Props:
//    prescriptions  Array    — shared store from root state
//    onUpdate       (id, changes) => Promise<void>
// ─────────────────────────────────────────────────────────────────────────────

import { useMemo } from "react";

import { exportPDF } from "../../utils/pdf";
import { ACCENT, CARD, BORDER, MUTED, RED, AMBER, GREEN } from "../../constants/theme";
import Badge from "../ui/Badge";

/**
 * @param {{
 *   prescriptions: Array,
 *   onUpdate:      (id: number, changes: object) => Promise<void>,
 * }} props
 */
function RxTab({ prescriptions, onUpdate }) {
  const now        = new Date();
  const THIRTY_MIN = 30 * 60 * 1000;

  // ── Deadline helpers ────────────────────────────────────────────────────────
  const isOverdue   = (rx) => rx.echeance && new Date(rx.echeance) < now;
  const expiresSoon = (rx) => rx.echeance && !isOverdue(rx)
    && (new Date(rx.echeance) - now) <= THIRTY_MIN;

  const formatDeadline = (iso) => {
    const d    = new Date(iso);
    const diff = d - now;
    if (diff < 0) {
      const mins = Math.round(-diff / 60000);
      return mins < 60
        ? `Dépassé depuis ${mins} min`
        : `Dépassé depuis ${Math.round(mins / 60)} h`;
    }
    const mins = Math.round(diff / 60000);
    if (mins < 60)   return `${mins} min restantes`;
    if (mins < 1440) return `${Math.round(mins / 60)} h restantes`;
    return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  };

  // ── Derived sections ────────────────────────────────────────────────────────
  const active = prescriptions.filter(r => !r.is_validated && !r.is_cancelled);

  const expiring = useMemo(
    () => active.filter(r => expiresSoon(r)),
    [prescriptions, now] // eslint-disable-line react-hooks/exhaustive-deps
  );
  const urgent = useMemo(
    () => active.filter(r => !expiresSoon(r) && (r.priorite === "URGENTE" || r.priorite === "STAT")),
    [prescriptions] // eslint-disable-line react-hooks/exhaustive-deps
  );
  const todo = useMemo(
    () => active.filter(r => !expiresSoon(r) && r.priorite !== "URGENTE" && r.priorite !== "STAT"),
    [prescriptions] // eslint-disable-line react-hooks/exhaustive-deps
  );
  const done = useMemo(
    () => prescriptions.filter(r => r.is_validated || r.is_cancelled),
    [prescriptions]
  );
  const doneOverdue = useMemo(
    () => done.filter(r => r.echeance && new Date(r.echeance) < new Date(r.validated_at || r.created_at)),
    [done]
  );
  const doneOnTime = useMemo(
    () => done.filter(r => !r.echeance || new Date(r.echeance) >= new Date(r.validated_at || r.created_at)),
    [done]
  );

  // Priority badge colour
  const prioBadgeColor = (p) => p === "STAT" ? RED : p === "URGENTE" ? AMBER : ACCENT;

  // ── RxCard ──────────────────────────────────────────────────────────────────
  const RxCard = ({ rx, isUrgent, isExpiring }) => {
    const overdue = isOverdue(rx);
    const soon    = expiresSoon(rx);

    const borderColor = isExpiring || soon ? "#F59E0B66"
      : isUrgent || overdue              ? RED + "44"
      : rx.is_validated                  ? GREEN + "40"
      : "#E5E7EB";

    const headBg = isExpiring || soon ? AMBER + "10"
      : isUrgent || overdue           ? RED + "07"
      : "transparent";

    return (
      <div className="rx-card" style={{
        background: CARD, borderRadius: 16,
        border: `1px solid ${rx.allergyAlert ? RED + "60" : borderColor}`,
        overflow: "hidden",
      }}>
        {/* Allergy alert banner */}
        {rx.allergyAlert && (
          <div style={{ background: RED, padding: "6px 18px", color: "#fff",
            fontSize: 12, fontWeight: 700 }}>
            {rx.allergyAlert}
          </div>
        )}

        {/* Card header */}
        <div style={{ padding: "11px 18px", display: "flex", alignItems: "center",
          gap: 10, flexWrap: "wrap", borderBottom: "1px solid #F1F5F9", background: headBg }}>
          <div style={{ fontWeight: 700, fontSize: 14, flex: 1 }}>
            {rx.drug_name_free || rx.examen || rx.action || "Acte non précisé"}
          </div>
          {rx.priorite && (
            <Badge color={prioBadgeColor(rx.priorite)} small>{rx.priorite}</Badge>
          )}
          {overdue && !rx.is_validated && !rx.is_cancelled && (
            <Badge color={RED} small>Délai dépassé</Badge>
          )}
          {soon && !overdue && (
            <Badge color={AMBER} small>Expire bientôt</Badge>
          )}
          {rx.is_validated  ? <Badge color={GREEN} small>Validé</Badge>
            : rx.is_cancelled ? <Badge color={MUTED} small>Annulé</Badge>
            : <Badge color={AMBER} small>En attente</Badge>
          }
          <span style={{ fontSize: 11, color: MUTED }}>
            {new Date(rx.created_at).toLocaleString("fr-FR")}
          </span>
        </div>

        {/* Fields grid */}
        <div style={{ padding: "12px 18px", display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "6px 20px" }}>
          {[
            ["Patient",    rx.patient_name_free],
            ["Dosage",     rx.dosage],
            ["Forme",      rx.form],
            ["Voie",       rx.route],
            ["Fréquence",  rx.frequency],
            ["Indication", rx.indication],
            ["Service",    rx.service],
            ["Chambre",    rx.chambre],
            ["Action",     rx.action],
            ["Allergie",   rx.allergie_signalee],
          ].filter(([, v]) => v).map(([label, val]) => (
            <div key={label} style={{ fontSize: 13 }}>
              <span style={{ fontWeight: 600, color: MUTED }}>{label} : </span>
              <span style={{ color: "#334155" }}>{val}</span>
            </div>
          ))}
          {rx.echeance && (
            <div style={{ fontSize: 13 }}>
              <span style={{ fontWeight: 600, color: MUTED }}>Délai : </span>
              <span style={{ color: overdue ? RED : soon ? AMBER : GREEN, fontWeight: 600 }}>
                {formatDeadline(rx.echeance)}
              </span>
            </div>
          )}
        </div>

        {/* Raw NLP phrase + action buttons */}
        <div style={{ padding: "8px 18px 12px", borderTop: "1px solid #F8FAFC",
          display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          {rx.nlp_raw_text && (
            <div style={{ flex: 1, fontSize: 12, color: MUTED, fontStyle: "italic" }}>
              « {rx.nlp_raw_text} »
            </div>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => exportPDF(rx)} style={{
              padding: "6px 14px", borderRadius: 8, border: `1px solid ${ACCENT}`,
              background: "#fff", color: ACCENT, fontSize: 12, fontWeight: 600,
              cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
            }}>Exporter PDF</button>
            {!rx.is_validated && !rx.is_cancelled && (
              <>
                <button
                  onClick={() => onUpdate(rx.prescription_id, {
                    is_validated: true, validated_at: new Date().toISOString(),
                  })}
                  style={{ padding: "6px 14px", borderRadius: 8, border: "none",
                    background: GREEN, color: "#fff", fontSize: 12, fontWeight: 600,
                    cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
                  Valider
                </button>
                <button
                  onClick={() => onUpdate(rx.prescription_id, { is_cancelled: true })}
                  style={{ padding: "6px 14px", borderRadius: 8,
                    border: "1px solid #E5E7EB", background: "#fff",
                    color: RED, fontSize: 12, fontWeight: 600,
                    cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
                  Annuler
                </button>
              </>
            )}
            {rx.is_cancelled && (
              <span style={{ fontSize: 12, color: RED, fontWeight: 600 }}>Annulée</span>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ── Section header ──────────────────────────────────────────────────────────
  const SectionHeader = ({ label, count, color }) => (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
      <span style={{ fontWeight: 700, fontSize: 15, color }}>{label}</span>
      <span style={{
        minWidth: 22, height: 22, borderRadius: 11, padding: "0 6px",
        background: color, color: "#fff", fontSize: 12, fontWeight: 700,
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        boxSizing: "border-box",
      }}>{count}</span>
    </div>
  );

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Page summary bar */}
      <div style={{ background: CARD, borderRadius: 16, padding: "18px 24px",
        marginBottom: 24, border: `1px solid ${BORDER}`,
        display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap",
        boxShadow: "0 2px 12px rgba(0,0,0,.04)" }}>
        <div style={{ width: 42, height: 42, borderRadius: 10, background: ACCENT + "15",
          display: "grid", placeItems: "center", flexShrink: 0 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={ACCENT}
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
          </svg>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 2 }}>
            Actes &amp; Ordres — SILLAGE
          </div>
          <div style={{ color: MUTED, fontSize: 13 }}>
            {prescriptions.length} acte(s) · {active.length} en attente · {done.length} traité(s)
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {expiring.length > 0 && (
            <div style={{ padding: "6px 14px", borderRadius: 20, background: AMBER + "25",
              color: AMBER, fontSize: 13, fontWeight: 700, border: `1px solid ${AMBER}55` }}>
              {expiring.length} expirent &lt;30 min
            </div>
          )}
          <div style={{ padding: "6px 14px", borderRadius: 20, background: AMBER + "18",
            color: AMBER, fontSize: 13, fontWeight: 700 }}>
            {todo.length} à faire
          </div>
          <div style={{ padding: "6px 14px", borderRadius: 20, background: RED + "18",
            color: RED, fontSize: 13, fontWeight: 700 }}>
            {urgent.length} urgentes
          </div>
        </div>
      </div>

      {/* Empty state */}
      {prescriptions.length === 0 ? (
        <div style={{ background: CARD, borderRadius: 14, border: "1px solid #E5E7EB",
          padding: 48, textAlign: "center", color: "#CBD5E1", fontSize: 14 }}>
          Aucun acte enregistré. Utilisez le bot NLP pour en créer.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>

          {/* Section 0 — Expire within 30 min */}
          {expiring.length > 0 && (
            <div>
              <SectionHeader label="Expirent dans moins de 30 min" count={expiring.length} color={AMBER} />
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {expiring.map(rx => <RxCard key={rx.prescription_id} rx={rx} isExpiring={true} />)}
              </div>
            </div>
          )}

          {/* Section 1 — Urgent tasks */}
          {urgent.length > 0 && (
            <div>
              <SectionHeader label="Tâches urgentes" count={urgent.length} color={RED} />
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {urgent.map(rx => <RxCard key={rx.prescription_id} rx={rx} isUrgent={true} />)}
              </div>
            </div>
          )}

          {/* Section 2 — To-do tasks */}
          {todo.length > 0 && (
            <div>
              <SectionHeader label="Tâches à faire" count={todo.length} color={AMBER} />
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {todo.map(rx => <RxCard key={rx.prescription_id} rx={rx} isUrgent={false} />)}
              </div>
            </div>
          )}

          {/* Section 3 — History */}
          {done.length > 0 && (
            <div>
              <SectionHeader label="Historique" count={done.length} color={MUTED} />
              {doneOverdue.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: RED,
                    marginBottom: 8, paddingLeft: 2 }}>
                    Délai dépassé — {doneOverdue.length} acte(s)
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {doneOverdue.map(rx => <RxCard key={rx.prescription_id} rx={rx} isUrgent={false} />)}
                  </div>
                </div>
              )}
              {doneOnTime.length > 0 && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: GREEN,
                    marginBottom: 8, paddingLeft: 2 }}>
                    Dans les délais — {doneOnTime.length} acte(s)
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {doneOnTime.map(rx => <RxCard key={rx.prescription_id} rx={rx} isUrgent={false} />)}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default RxTab;
