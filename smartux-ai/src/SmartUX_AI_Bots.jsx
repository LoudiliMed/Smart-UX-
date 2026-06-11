// ─────────────────────────────────────────────────────────────────────────────
//  SmartUX_AI_Bots  —  Root component
//
//  Responsibilities:
//    • Authentication gate (delegates to BioBot)
//    • Top-bar with brand, tab navigation, clock, user chip, "Doctor AI" toggle
//    • Sub-tab navigation (Dossier / Observations / Imagerie / Paramètres)
//    • Shared prescriptions store (loaded from SQLite via REST, written by NLPBot)
//    • User display preferences (font-size / density, persisted to localStorage)
//    • Routing between NLPBot, RxTab, and the four panel components
//    • Chat drawer (ChatPanel in a fixed side-panel)
//
//  All heavy logic lives in the imported child modules.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useCallback, useEffect } from "react";

// ── Database & theme ─────────────────────────────────────────────────────────
import { DB_PATIENTS }                         from "./database";
import { ACCENT, ACCENT2, BG, CARD, BORDER, MUTED, GREEN } from "./constants/theme";

// ── API helpers ───────────────────────────────────────────────────────────────
import { fetchPrescriptions, patchPrescription } from "./api/client";

// ── UI atoms ──────────────────────────────────────────────────────────────────
import Icon     from "./components/ui/Icon";
import LiveClock from "./components/ui/LiveClock";

// ── Feature components ────────────────────────────────────────────────────────
import BioBot           from "./components/auth/BioBot";
import NLPBot           from "./components/nlp/NLPBot";
import RxTab            from "./components/rx/RxTab";
import { ChatPanel }    from "./components/chat/ChatPanel";
import DossierPanel     from "./components/panels/DossierPanel";
import ObservationsPanel from "./components/panels/ObservationsPanel";
import ImageriePanel    from "./components/panels/ImageriePanel";
import ParametresPanel  from "./components/panels/ParametresPanel";

// ─────────────────────────────────────────────────────────────────────────────
//  Tab definitions
// ─────────────────────────────────────────────────────────────────────────────

/** Main navigation tabs (top-bar, left-side). */
const tabs = [
  { id: "nlp", label: "Write out",      iconType: "chat" },
  { id: "rx",  label: "Actes & Ordres", iconType: "file" },
];

/** Secondary sub-tabs (Sillage-style grey tab bar). */
const subTabs = [
  { id: "dossier",      label: "Dossier",      iconType: "folder"   },
  { id: "observations", label: "Observations", iconType: "eye"      },
  { id: "imagerie",     label: "Imagerie",     iconType: "image"    },
  { id: "parametres",   label: "Paramètres",   iconType: "settings" },
];

/** Sub-tabs that render full-width (no side-by-side NLP layout). */
const FULL_WIDTH_PANELS = ["dossier", "observations", "imagerie", "parametres"];

// ─────────────────────────────────────────────────────────────────────────────
//  Global CSS injected once on mount
// ─────────────────────────────────────────────────────────────────────────────
const GLOBAL_STYLES = `
  * { box-sizing: border-box; }
  body { margin: 0; }
  @keyframes spin        { to   { transform: rotate(360deg); } }
  @keyframes fadeIn      { from { opacity: 0; transform: translateY(6px); }  to { opacity: 1; transform: translateY(0); } }
  @keyframes tabIn       { from { opacity: 0; transform: translateY(8px); }  to { opacity: 1; transform: translateY(0); } }
  @keyframes voicePulse  { 0%,100% { opacity:1; box-shadow: 0 0 0 0 rgba(239,68,68,.4); }
                           50%     { opacity:.7; box-shadow: 0 0 0 6px rgba(239,68,68,0); } }
  @keyframes slideInRight { from { transform: translateX(100%); } to { transform: translateX(0); } }
  .tab-content      { animation: tabIn .22s ease both; }
  .rx-card          { transition: box-shadow .2s, transform .15s; }
  .rx-card:hover    { box-shadow: 0 6px 28px rgba(15,76,117,.10); transform: translateY(-1px); }
  .sillage-tab:hover    { background: rgba(255,255,255,.12) !important; }
  .sillage-subtab:hover { background: #E8EDF2 !important; }
`;

// ─────────────────────────────────────────────────────────────────────────────
//  Root component
// ─────────────────────────────────────────────────────────────────────────────
export default function SmartUXBots() {
  const [authenticatedUser, setAuthenticatedUser] = useState(() => {
    try {
      const saved = sessionStorage.getItem("sillage_user");
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });
  const [activeTab,    setActiveTab]    = useState("nlp");
  const [activeSubTab, setActiveSubTab] = useState(null);
  const [chatOpen,     setChatOpen]     = useState(false);

  // Shared prescriptions store — written by NLPBot, read by RxTab & DossierPanel
  const [prescriptions, setPrescriptions] = useState([]);

  // Selected patient context — updated when NLPBot resolves a patient name
  const [selectedPatientId, setSelectedPatientId] = useState(null);
  const selectedPatient = DB_PATIENTS.find(p => p.patient_id === selectedPatientId) || null;

  // Display preferences — persisted to localStorage
  const [fontSize, setFontSizeState] = useState(
    () => parseInt(localStorage.getItem("pref_fontSize") || "14")
  );
  const [density, setDensityState] = useState(
    () => localStorage.getItem("pref_density") || "Normal"
  );

  const setFontSize = useCallback((val) => {
    setFontSizeState(val);
    localStorage.setItem("pref_fontSize", val);
    document.body.style.fontSize = val + "px";
  }, []);

  const setDensity = useCallback((val) => {
    setDensityState(val);
    localStorage.setItem("pref_density", val);
  }, []);

  // Apply persisted font-size on mount
  useEffect(() => {
    document.body.style.fontSize = fontSize + "px";
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load prescriptions from SQLite on mount
  useEffect(() => {
    fetchPrescriptions()
      .then(data => setPrescriptions(data))
      .catch(() => {}); // server may not be running yet — fail silently
  }, []);

  // Called by NLPBot when a prescription is confirmed and saved
  const addPrescription = useCallback((rx) => {
    setPrescriptions(prev => [rx, ...prev]);
  }, []);

  // Called by RxTab when validate / cancel is clicked
  const updatePrescription = useCallback(async (id, changes) => {
    await patchPrescription(id, changes);
    setPrescriptions(prev =>
      prev.map(rx => rx.prescription_id === id ? { ...rx, ...changes } : rx)
    );
  }, []);

  // ── Auth helpers ─────────────────────────────────────────────────────────────
  const handleAuth = useCallback((user) => {
    sessionStorage.setItem("sillage_user", JSON.stringify(user));
    setAuthenticatedUser(user);
  }, []);

  const handleLogout = useCallback(() => {
    sessionStorage.removeItem("sillage_user");
    setAuthenticatedUser(null);
  }, []);

  // 15-min inactivity timeout — resets on any mouse/keyboard/click activity
  useEffect(() => {
    if (!authenticatedUser) return;
    let timerId = setTimeout(handleLogout, 15 * 60 * 1000);
    const reset = () => { clearTimeout(timerId); timerId = setTimeout(handleLogout, 15 * 60 * 1000); };
    window.addEventListener("mousemove", reset);
    window.addEventListener("keydown", reset);
    window.addEventListener("click", reset);
    return () => {
      clearTimeout(timerId);
      window.removeEventListener("mousemove", reset);
      window.removeEventListener("keydown", reset);
      window.removeEventListener("click", reset);
    };
  }, [authenticatedUser, handleLogout]);

  // ── Badge counts for the Rx tab icon ────────────────────────────────────────
  const rxActive   = prescriptions.filter(r => !r.is_validated && !r.is_cancelled);
  const rxUrgent   = rxActive.filter(r => r.priorite === "URGENTE" || r.priorite === "STAT").length;
  const rxPending  = rxActive.filter(r => r.priorite !== "URGENTE" && r.priorite !== "STAT").length;
  const now30      = new Date(Date.now() + 30 * 60 * 1000);
  const rxExpiring = rxActive.filter(r =>
    r.echeance && new Date(r.echeance) > new Date() && new Date(r.echeance) <= now30
  ).length;

  // ── Auth gate ────────────────────────────────────────────────────────────────
  if (!authenticatedUser) {
    return (
      <div style={{ minHeight: "100vh", background: BG,
        fontFamily: "'DM Sans', sans-serif", color: "#1A1A2E",
        display: "flex", flexDirection: "column" }}>
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;0,9..40,800&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet" />
        <style>{GLOBAL_STYLES}</style>
        {/* Auth gate header */}
        <div style={{ background: "#1B3A54", padding: "14px 24px", display: "flex",
          alignItems: "center", gap: 8, borderBottom: "2px solid #0F2B40" }}>
          <span style={{ color: "#fff",    fontWeight: 800, fontSize: 17 }}>Smart</span>
          <span style={{ color: ACCENT2,  fontWeight: 800, fontSize: 17 }}>UX</span>
          <span style={{ color: "rgba(255,255,255,.35)", fontWeight: 500, fontSize: 12, marginLeft: 2 }}>AI</span>
          <span style={{ marginLeft: 16, fontSize: 12, color: "rgba(255,255,255,.5)", fontWeight: 500 }}>
            — Authentification requise
          </span>
        </div>
        <div style={{ flex: 1, display: "flex", alignItems: "flex-start",
          justifyContent: "center", padding: "32px 16px" }}>
          <div style={{ width: "100%", maxWidth: 900, animation: "fadeIn .3s ease both" }}>
            <BioBot onAuth={handleAuth} />
          </div>
        </div>
      </div>
    );
  }

  // ── Main app ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: BG,
      fontFamily: "'DM Sans', sans-serif", color: "#1A1A2E" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;0,9..40,800&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet" />
      <style>{GLOBAL_STYLES}</style>

      {/* ══════════════════════════════════════════════════════════════════════
          TOP BAR  (Sillage-style dark blue, sticky)
      ══════════════════════════════════════════════════════════════════════ */}
      <header style={{ background: "#1B3A54", position: "sticky", top: 0, zIndex: 200,
        borderBottom: "2px solid #0F2B40" }}>

        {/* Row 1: brand + main tabs + clock + user chip */}
        <div style={{ display: "flex", alignItems: "center", padding: "0 16px",
          minHeight: 52, gap: 0 }}>

          {/* Left: brand + tab buttons */}
          <div style={{ display: "flex", alignItems: "center", gap: 14, flex: 1 }}>
            {/* App name */}
            <div style={{ display: "flex", alignItems: "baseline", gap: 5, marginRight: 16 }}>
              <span style={{ color: "#fff",   fontWeight: 800, fontSize: 17, letterSpacing: -0.3 }}>Smart</span>
              <span style={{ color: ACCENT2, fontWeight: 800, fontSize: 17, letterSpacing: -0.3 }}>UX</span>
              <span style={{ color: "rgba(255,255,255,.35)", fontWeight: 500, fontSize: 12, marginLeft: 2 }}>AI</span>
            </div>

            {/* Main tabs */}
            <div style={{ display: "flex", gap: 2 }}>
              {tabs.map(t => {
                const active     = activeTab === t.id;
                const badgeCount = t.id === "rx" ? (rxUrgent + rxPending) : 0;
                return (
                  <button key={t.id} className="sillage-tab"
                    onClick={() => { setActiveTab(t.id); setActiveSubTab(null); }}
                    style={{ display: "flex", alignItems: "center", gap: 6,
                      padding: "7px 14px", borderRadius: 4, border: "none",
                      fontFamily: "'DM Sans', sans-serif",
                      fontWeight: active ? 700 : 500, fontSize: 12,
                      cursor: "pointer", position: "relative",
                      background: active ? "rgba(255,255,255,.18)" : "transparent",
                      color:      active ? "#fff" : "rgba(255,255,255,.6)",
                      transition: "all .15s",
                    }}>
                    <Icon type={t.iconType} size={14} color={active ? "#fff" : "rgba(255,255,255,.55)"} />
                    {t.label}
                    {/* Urgency / pending count badge */}
                    {badgeCount > 0 && (
                      <span style={{ position: "absolute", top: -3, right: -3,
                        minWidth: 16, height: 16, borderRadius: 8, padding: "0 4px",
                        background: rxUrgent > 0 ? "#EF4444" : "#F59E0B",
                        color: "#fff", fontSize: 9, fontWeight: 700,
                        display: "grid", placeItems: "center",
                        boxShadow: "0 1px 3px rgba(0,0,0,.3)",
                      }}>{badgeCount}</span>
                    )}
                    {/* Expiring-soon badge */}
                    {rxExpiring > 0 && t.id === "rx" && (
                      <span style={{ position: "absolute", top: -3,
                        right: badgeCount > 0 ? 12 : -3,
                        minWidth: 16, height: 16, borderRadius: 8, padding: "0 4px",
                        background: "#F97316", color: "#fff", fontSize: 9, fontWeight: 700,
                        display: "grid", placeItems: "center",
                        boxShadow: "0 1px 3px rgba(0,0,0,.3)",
                      }}>{rxExpiring}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right: status dot + clock + Doctor AI toggle + user chip */}
          <div style={{ display: "flex", alignItems: "center", gap: 16, flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 7, height: 7, borderRadius: "50%",
                background: GREEN, boxShadow: `0 0 6px ${GREEN}` }} />
              <span style={{ fontSize: 11, color: "rgba(255,255,255,.5)", fontWeight: 500 }}>En ligne</span>
            </div>
            <div style={{ width: 1, height: 24, background: "rgba(255,255,255,.12)" }} />
            <LiveClock />
            <div style={{ width: 1, height: 24, background: "rgba(255,255,255,.12)", marginLeft: 8 }} />

            {/* Doctor AI (chat) toggle */}
            <button onClick={() => setChatOpen(o => !o)} style={{
              padding: "6px 12px", borderRadius: 8, border: "none",
              background: chatOpen ? ACCENT2 : "rgba(255,255,255,.15)",
              color: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 600,
              fontFamily: "'DM Sans', sans-serif", transition: "background .15s",
            }}>
              {chatOpen ? "Fermer Doctor AI" : "Doctor AI"}
            </button>

            {/* Logged-in user chip */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: 4 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6,
                padding: "4px 10px", borderRadius: 20, background: "rgba(255,255,255,.12)" }}>
                <div style={{ width: 22, height: 22, borderRadius: "50%",
                  background: GREEN, display: "grid", placeItems: "center" }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff"
                    strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                    <circle cx="12" cy="7" r="4"/>
                  </svg>
                </div>
                <span style={{ fontSize: 12, fontWeight: 600, color: "#fff" }}>
                  {authenticatedUser.title ? `${authenticatedUser.title} ` : ""}
                  {authenticatedUser.first_name} {authenticatedUser.last_name}
                </span>
                <span style={{ fontSize: 10, color: "rgba(255,255,255,.5)", fontWeight: 500 }}>
                  Niv.{authenticatedUser.access_level}
                </span>
              </div>
              {/* Logout */}
              <button onClick={handleLogout} style={{
                background: "none", border: "none", cursor: "pointer",
                padding: "4px 8px", borderRadius: 6,
                color: "rgba(255,255,255,.5)", fontSize: 11, fontWeight: 600,
                fontFamily: "'DM Sans', sans-serif",
              }} title="Se déconnecter">✕</button>
            </div>
          </div>
        </div>

        {/* Row 2: sub-tab bar (Sillage grey strip) */}
        <div style={{ background: "#D6DDE4", borderTop: "1px solid #B8C4CF",
          display: "flex", alignItems: "center", padding: "0 16px",
          gap: 1, overflowX: "auto" }}>
          {subTabs.map(st => {
            const active = activeSubTab === st.id;
            return (
              <button key={st.id} className="sillage-subtab"
                onClick={() => setActiveSubTab(active ? null : st.id)}
                style={{ display: "flex", alignItems: "center", gap: 5,
                  padding: "7px 13px", border: "none",
                  borderBottom: active ? "2px solid #1B3A54" : "2px solid transparent",
                  fontFamily: "'DM Sans', sans-serif",
                  fontWeight: active ? 700 : 500, fontSize: 12, cursor: "pointer",
                  background: active ? "#F0F4F8" : "transparent",
                  color: active ? "#1B3A54" : "#556677",
                  transition: "all .12s", borderRadius: "4px 4px 0 0", whiteSpace: "nowrap",
                }}>
                <Icon type={st.iconType} size={13} color={active ? "#1B3A54" : "#7A8A99"} />
                {st.label}
              </button>
            );
          })}
        </div>
      </header>

      {/* ══════════════════════════════════════════════════════════════════════
          MAIN CONTENT AREA
      ══════════════════════════════════════════════════════════════════════ */}
      <main style={{
        maxWidth: FULL_WIDTH_PANELS.includes(activeSubTab) ? 1200 : 1000,
        margin: "0 auto",
        padding: density === "Compact" ? "16px 24px 60px" : "32px 24px 80px",
      }}>
        {FULL_WIDTH_PANELS.includes(activeSubTab) ? (
          /* ── Full-width panel — no NLP sidebar ── */
          <div style={{ animation: "tabIn .22s ease both" }}>
            {activeSubTab === "dossier"      && <DossierPanel prescriptions={prescriptions} />}
            {activeSubTab === "observations" && <ObservationsPanel />}
            {activeSubTab === "imagerie"     && <ImageriePanel />}
            {activeSubTab === "parametres"   && (
              <ParametresPanel
                user={authenticatedUser}
                fontSize={fontSize}  setFontSize={setFontSize}
                density={density}    setDensity={setDensity}
              />
            )}
          </div>
        ) : (
          /* ── Normal layout — main tab content + optional sub-tab stub ── */
          <>
            {activeSubTab && (
              <div style={{ background: CARD, borderRadius: 12, border: `1px solid ${BORDER}`,
                padding: "24px 28px", marginBottom: 24,
                boxShadow: "0 2px 10px rgba(0,0,0,.04)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <Icon type={subTabs.find(s => s.id === activeSubTab)?.iconType || "folder"}
                    size={18} color={ACCENT} />
                  <span style={{ fontWeight: 700, fontSize: 16, color: ACCENT }}>
                    {subTabs.find(s => s.id === activeSubTab)?.label}
                  </span>
                </div>
                <div style={{ color: MUTED, fontSize: 13, lineHeight: 1.6 }}>
                  Module en cours de développement — Ce panneau sera connecté au système SILLAGE
                  pour afficher les données de {subTabs.find(s => s.id === activeSubTab)?.label.toLowerCase()}.
                </div>
              </div>
            )}
            <div className="tab-content" key={activeTab}>
              {activeTab === "nlp" && (
                <NLPBot
                  onPrescription={addPrescription}
                  onPatientResolved={setSelectedPatientId}
                  patient={selectedPatient}
                  prescriptions={prescriptions.filter(r => r.patient_id === selectedPatientId)}
                />
              )}
              {activeTab === "rx" && (
                <RxTab prescriptions={prescriptions} onUpdate={updatePrescription} />
              )}
            </div>
          </>
        )}
      </main>

      {/* ══════════════════════════════════════════════════════════════════════
          CHAT DRAWER  (fixed — does not reflow the main layout)
      ══════════════════════════════════════════════════════════════════════ */}
      {chatOpen && (
        <div style={{ position: "fixed", top: 0, right: 0, width: 380, height: "100vh",
          background: CARD, borderLeft: `1px solid ${BORDER}`,
          boxShadow: "-4px 0 24px rgba(0,0,0,.12)",
          display: "flex", flexDirection: "column",
          zIndex: 300, animation: "slideInRight .22s ease both" }}>
          <ChatPanel
            patient={selectedPatient}
            selectedPatientId={selectedPatientId}
            prescriptions={prescriptions}
            onClose={() => setChatOpen(false)}
            user={authenticatedUser}
          />
        </div>
      )}
    </div>
  );
}

