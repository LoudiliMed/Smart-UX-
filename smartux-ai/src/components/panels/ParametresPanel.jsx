// ─────────────────────────────────────────────────────────────────────────────
//  ParametresPanel
//  Three sections: user profile, display preferences (font-size / density),
//  and read-only system configuration.
//  Props forwarded from the root component via localStorage-backed callbacks.
// ─────────────────────────────────────────────────────────────────────────────

import { ACCESS_PERMISSIONS, PERM_LABELS } from "../../database";
import { ACCENT, CARD, BORDER, MUTED, GREEN } from "../../constants/theme";

/**
 * @param {{
 *   user:         object,
 *   fontSize:     number,
 *   setFontSize:  (v: number) => void,
 *   density:      string,
 *   setDensity:   (v: string) => void,
 * }} props
 */
function ParametresPanel({ user, fontSize, setFontSize, density, setDensity }) {
  if (!user) return null;

  const perms = ACCESS_PERMISSIONS[user.access_level] || [];

  /** Reusable styled section title. */
  const SectionTitle = ({ label }) => (
    <div style={{
      fontWeight: 700, fontSize: 13, color: ACCENT, textTransform: "uppercase",
      letterSpacing: .8, padding: "18px 0 10px",
      borderBottom: `2px solid ${ACCENT}22`, marginBottom: 14,
    }}>
      {label}
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0, maxWidth: 760 }}>

      {/* ── 1. User profile ── */}
      <SectionTitle label="Profil utilisateur" />
      <div style={{ background: CARD, borderRadius: 12, border: `1px solid ${BORDER}`,
        padding: "20px 24px", marginBottom: 20 }}>
        <table style={{ fontSize: 13, lineHeight: 2.1, width: "100%" }}>
          <tbody>
            {[
              ["Nom complet",    `${user.title ? user.title + " " : ""}${user.first_name} ${user.last_name}`.trim() || "—"],
              ["N° employé",     user.employee_number],
              ["Rôle",           user.role_label],
              ["Service",        user.dept],
              ["Spécialité",     user.specialty || "—"],
              ["Niveau d'accès", `Niveau ${user.access_level}`],
            ].map(([k, v]) => (
              <tr key={k}>
                <td style={{ color: MUTED, fontWeight: 600, paddingRight: 20,
                  whiteSpace: "nowrap", fontSize: 12, width: 160 }}>{k}</td>
                <td style={{ fontWeight: 500, color: "#1A1A2E" }}>{v}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Biometry status */}
        <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12, color: MUTED, fontWeight: 600 }}>Biométrie :</span>
          <span style={{
            fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20,
            background: user.biometric_enrolled ? GREEN + "18" : MUTED + "18",
            color:      user.biometric_enrolled ? GREEN : MUTED,
          }}>
            {user.biometric_enrolled ? "✓ Enrôlée" : "Non enrôlée"}
          </span>
        </div>

        {/* Permissions */}
        <div style={{ marginTop: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 11, color: MUTED, textTransform: "uppercase",
            letterSpacing: .5, marginBottom: 8 }}>Permissions accordées</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {perms.map(perm => (
              <span key={perm} style={{
                fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 6,
                background: GREEN + "15", color: GREEN, border: `1px solid ${GREEN}30`,
              }}>
                {PERM_LABELS[perm] || perm}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── 2. Display preferences ── */}
      <SectionTitle label="Préférences d'affichage" />
      <div style={{ background: CARD, borderRadius: 12, border: `1px solid ${BORDER}`,
        padding: "20px 24px", marginBottom: 20 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Font size */}
          <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#1A1A2E", minWidth: 160 }}>
              Taille de texte
            </span>
            <div style={{ display: "flex", gap: 4 }}>
              {[{ label: "S", val: 13 }, { label: "M", val: 14 }, { label: "L", val: 15 }].map(
                ({ label, val }) => (
                  <button key={val} onClick={() => setFontSize(val)} style={{
                    width: 36, height: 36, borderRadius: 8,
                    border: `1px solid ${fontSize === val ? ACCENT : BORDER}`,
                    background: fontSize === val ? ACCENT : "transparent",
                    color:      fontSize === val ? "#fff" : MUTED,
                    fontWeight: 700,
                    fontSize: label === "S" ? 11 : label === "M" ? 13 : 15,
                    cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                  }}>
                    {label}
                  </button>
                )
              )}
            </div>
          </div>

          {/* Density */}
          <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#1A1A2E", minWidth: 160 }}>
              Densité d'affichage
            </span>
            <div style={{ display: "flex", gap: 4 }}>
              {["Compact", "Normal"].map(d => (
                <button key={d} onClick={() => setDensity(d)} style={{
                  padding: "6px 18px", borderRadius: 8,
                  border: `1px solid ${density === d ? ACCENT : BORDER}`,
                  background: density === d ? ACCENT : "transparent",
                  color:      density === d ? "#fff" : MUTED,
                  fontWeight: density === d ? 700 : 500,
                  fontSize: 12, cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                }}>
                  {d}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div style={{ marginTop: 14, fontSize: 11, color: MUTED, fontStyle: "italic" }}>
          Les préférences sont sauvegardées automatiquement dans le navigateur.
        </div>
      </div>

      {/* ── 3. System configuration (read-only) ── */}
      <SectionTitle label="Configuration système" />
      <div style={{ background: CARD, borderRadius: 12, border: `1px solid ${BORDER}`,
        padding: "20px 24px" }}>
        <table style={{ fontSize: 13, lineHeight: 2.1, width: "100%" }}>
          <tbody>
            {[
              ["URL API",       "http://localhost:3001"],
              ["Modèle LLM",    "llama-3.3-70b-versatile (Groq)"],
              ["Projet",        "SILLAGE — CRIStAL × Centrale Lille"],
              ["Version",       "1.0.0"],
              ["Environnement", "Développement"],
            ].map(([k, v]) => (
              <tr key={k}>
                <td style={{ color: MUTED, fontWeight: 600, paddingRight: 20,
                  whiteSpace: "nowrap", fontSize: 12, width: 160 }}>{k}</td>
                <td style={{
                  fontWeight: 500, color: "#1A1A2E",
                  fontFamily: (k === "URL API" || k === "Modèle LLM")
                    ? "'Space Mono', monospace" : "inherit",
                  fontSize: (k === "URL API" || k === "Modèle LLM") ? 12 : 13,
                }}>
                  {v}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default ParametresPanel;
