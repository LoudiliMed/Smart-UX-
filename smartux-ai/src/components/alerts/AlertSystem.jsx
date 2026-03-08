// ─────────────────────────────────────────────────────────────────────────────
//  AlertSystem  (ALRT-01, ALRT-02, ALRT-03, UX-02)
//
//  Two exported components:
//    • AlertBanner  — renders a single alert card with dismiss/acknowledge
//    • AlertSystem  — orchestrates debounced AI checks and alert state
//
//  Flow: draft changes → 1.2 s debounce → callAIChat → parseAlertResponse →
//        display severity-sorted banners.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef, useCallback } from "react";
import { MUTED, RED, AMBER } from "../../constants/theme";
import {
  buildDossierContext,
  SYSTEM_PROMPT_ALERT,
  parseAlertResponse,
} from "../../ai/prompts";
import { callAIChat } from "../../api/client";

// ── Severity → colour mapping ─────────────────────────────────────────────────
const SEVERITY_COLORS = { CRITIQUE: RED, MODERE: AMBER, FAIBLE: MUTED };

// ─────────────────────────────────────────────────────────────────────────────
//  AlertBanner — single alert card
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Renders one alert with a coloured left border.
 * - CRITIQUE:  requires explicit acknowledgement (cannot be silently dismissed)
 * - MODERE/FAIBLE: can be dismissed with the × button
 *
 * @param {object}   alert          - { id, severity, message }
 * @param {Function} onDismiss      - (id) => void
 * @param {Function} onAcknowledge  - (id) => void
 */
export function AlertBanner({ alert, onDismiss, onAcknowledge }) {
  const color = SEVERITY_COLORS[alert.severity] || MUTED;

  return (
    <div
      data-severity={alert.severity}
      style={{
        background:   `${color}10`,
        border:       `1px solid ${color}44`,
        borderLeft:   `4px solid ${color}`,
        borderRadius: 8,
        padding:      "10px 14px",
      }}
    >
      {/* AI disclaimer — always visible */}
      <div style={{ fontSize: 10, color: MUTED, marginBottom: 4, fontStyle: "italic" }}>
        Analyse assistée par IA — vérification clinique recommandée
      </div>

      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <div style={{ flex: 1 }}>
          <span style={{ fontWeight: 700, color, fontSize: 11, textTransform: "uppercase", marginRight: 6 }}>
            {alert.severity}
          </span>
          <span style={{ fontSize: 13, color: "#334155", lineHeight: 1.5 }}>
            {alert.message}
          </span>
        </div>

        {/* Non-critical alerts can be dismissed */}
        {alert.severity !== "CRITIQUE" && onDismiss && (
          <button
            onClick={() => onDismiss(alert.id)}
            title="Ignorer cette alerte"
            style={{
              background: "none", border: "none", cursor: "pointer",
              color: MUTED, fontSize: 18, lineHeight: 1, padding: "0 4px",
              fontFamily: "'DM Sans', sans-serif", flexShrink: 0,
            }}
          >×</button>
        )}

        {/* CRITIQUE alerts require explicit acknowledgement */}
        {alert.severity === "CRITIQUE" && onAcknowledge && (
          <button
            onClick={() => onAcknowledge(alert.id)}
            style={{
              padding: "5px 12px", borderRadius: 7,
              border: `1px solid ${RED}`, background: RED, color: "#fff",
              fontSize: 11, fontWeight: 600, cursor: "pointer",
              fontFamily: "'DM Sans', sans-serif", flexShrink: 0,
            }}
          >J'ai pris connaissance</button>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  AlertSystem — orchestrates debounced AI checks
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Watches `currentDraft` and `patient`; fires a debounced AI verification
 * whenever the draft drug name changes.
 *
 * @param {object} patient      - Selected patient from DB_PATIENTS (or null)
 * @param {object} currentDraft - Latest prescription draft (or null)
 * @param {Array}  prescriptions - Active prescriptions for this patient
 */
export function AlertSystem({ patient, currentDraft, prescriptions }) {
  const [alerts,         setAlerts]         = useState([]);
  const [isChecking,     setIsChecking]     = useState(false);
  const [acknowledgedIds, setAcknowledgedIds] = useState(new Set());

  const timerRef    = useRef(null);
  const requestIdRef = useRef(0);

  // Reset alerts when the selected patient changes
  useEffect(() => {
    setAlerts([]);
    setIsChecking(false);
  }, [patient?.patient_id]);

  // Debounced alert check — triggers 1.2 s after the draft drug name changes
  useEffect(() => {
    if (!patient || !currentDraft?.drug_name_free) {
      setAlerts([]);
      return;
    }

    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      const reqId = ++requestIdRef.current;
      setIsChecking(true);

      try {
        const dossier         = buildDossierContext(patient, prescriptions || []);
        const systemWithDossier =
          `${SYSTEM_PROMPT_ALERT}\n\n=== DOSSIER PATIENT ===\n${dossier}`;
        const userMessage     =
          `Médicament proposé : ${currentDraft.drug_name_free}` +
          (currentDraft.dosage ? ` — Dose : ${currentDraft.dosage}` : "") +
          (currentDraft.route  ? ` — Voie : ${currentDraft.route}`  : "");

        const raw = await callAIChat(systemWithDossier, userMessage);
        if (reqId !== requestIdRef.current) return; // stale response
        setAlerts(parseAlertResponse(raw));
      } catch {
        if (reqId !== requestIdRef.current) return;
        setAlerts([{
          id:       `error-${Date.now()}`,
          severity: "FAIBLE",
          message:  "Vérification indisponible — contactez le support si le problème persiste.",
        }]);
      } finally {
        if (reqId === requestIdRef.current) setIsChecking(false);
      }
    }, 1200);

    return () => clearTimeout(timerRef.current);
  }, [patient?.patient_id, currentDraft?.drug_name_free, currentDraft?.dosage]);

  const handleDismiss = useCallback((id) => {
    setAlerts(prev => prev.filter(a => !(a.id === id && a.severity !== "CRITIQUE")));
  }, []);

  const handleAcknowledge = useCallback((id) => {
    setAcknowledgedIds(prev => new Set([...prev, id]));
    setAlerts(prev => prev.filter(a => a.id !== id));
  }, []);

  if (!patient) return null;

  const visibleAlerts = alerts.filter(a => !acknowledgedIds.has(a.id));
  const showHeader    = isChecking || visibleAlerts.length > 0;

  return (
    <div style={{ marginTop: 12 }}>
      {showHeader && (
        <div style={{ fontSize: 11, color: MUTED, marginBottom: 6, fontWeight: 600 }}>
          Vérification pour : {patient.first_name} {patient.last_name} (ID {patient.patient_id})
        </div>
      )}

      {isChecking && (
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "8px 12px", background: "#F8FAFC", borderRadius: 8, marginBottom: 6,
        }}>
          <span style={{ fontSize: 12, color: MUTED }}>Vérification en cours…</span>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {visibleAlerts.map(alert => (
          <AlertBanner
            key={alert.id}
            alert={alert}
            onDismiss={alert.severity !== "CRITIQUE" ? handleDismiss : undefined}
            onAcknowledge={alert.severity === "CRITIQUE" ? handleAcknowledge : undefined}
          />
        ))}
      </div>
    </div>
  );
}
