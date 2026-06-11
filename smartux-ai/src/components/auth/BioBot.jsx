// ─────────────────────────────────────────────────────────────────────────────
//  BioBot — multi-method authentication gate
//
//  Three authentication methods:
//    1. Biométrie  — webcam + real face recognition (face-api.js)
//    2. Badge RFID — simulated card tap
//    3. Mot de passe — username + password (server-side hashed)
//
//  On success, calls onAuth(staffRecord) to pass the authenticated user
//  up to the root component.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { DB_STAFF, ACCESS_PERMISSIONS, PERM_LABELS } from "../../database";
import { ACCENT, ACCENT2, MUTED, GREEN, RED, AMBER, CARD, BORDER } from "../../constants/theme";
import { loadModels, computeDescriptor, matchDescriptor, MATCH_THRESHOLD } from "../../utils/faceRecognition";
import { fetchFaceDescriptors, saveFaceDescriptor, deleteFaceDescriptor, authLogin } from "../../api/client";
import Btn from "../ui/Btn";

// ── Canvas overlay — face detection frame drawn on top of webcam feed ─────────
function drawFaceBox(canvas, video) {
  const ctx = canvas.getContext("2d");
  canvas.width  = video.videoWidth;
  canvas.height = video.videoHeight;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const cx = canvas.width / 2;
  const cy = canvas.height / 2 - 20;
  ctx.strokeStyle = ACCENT2;
  ctx.lineWidth   = 2.5;
  ctx.setLineDash([8, 6]);
  ctx.beginPath();
  ctx.ellipse(cx, cy, 90, 120, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = "rgba(255,255,255,.7)";
  ctx.font      = "13px 'DM Sans', sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Positionnez votre visage ici", cx, cy + 144);
}

// ─────────────────────────────────────────────────────────────────────────────
//  BioBot component
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {Function} onAuth - Called with the authenticated DB_STAFF record on success
 */
function BioBot({ onAuth }) {
  const videoRef  = useRef(null);
  const canvasRef = useRef(null);
  const animRef   = useRef(null);

  const [camActive,     setCamActive]     = useState(false);
  const [step,          setStep]          = useState("idle");
  const [selectedUser,  setSelectedUser]  = useState(null);
  const [camError,      setCamError]      = useState(false);
  const [searchStaff,   setSearchStaff]   = useState("");  // reserved for future staff picker UI

  // Auth method: "bio" | "badge" | "password"
  const [authMethod,  setAuthMethod]  = useState("bio");

  // Password method state
  const [pwdLogin,    setPwdLogin]    = useState("");
  const [pwdPass,     setPwdPass]     = useState("");
  const [pwdError,    setPwdError]    = useState("");
  const [pwdShowPass, setPwdShowPass] = useState(false);

  // Filtered staff list (reserved for future staff-selector feature)
  // eslint-disable-next-line no-unused-vars
  const filteredStaff = useMemo(() => {
    if (!searchStaff.trim()) return DB_STAFF.slice(0, 8);
    const q = searchStaff.toLowerCase();
    return DB_STAFF.filter(s =>
      s.last_name.toLowerCase().includes(q) ||
      s.first_name.toLowerCase().includes(q) ||
      s.role_label.toLowerCase().includes(q) ||
      (s.dept || "").toLowerCase().includes(q)
    ).slice(0, 8);
  }, [searchStaff]);

  // eslint-disable-next-line no-unused-vars
  const levelColor = (l) => l >= 4 ? RED : l === 3 ? AMBER : l === 2 ? ACCENT : MUTED;

  // ── Real face-recognition state ─────────────────────────────────────────────
  const [modelStatus,   setModelStatus]   = useState("loading"); // loading | ready | error
  const [enrolledFaces, setEnrolledFaces] = useState([]);        // [{staff_id, descriptor, ...}]
  const [bioMode,       setBioMode]       = useState("login");   // login | enroll
  const [recogMsg,      setRecogMsg]      = useState("");        // extra feedback under the status pill

  // Enrolment requires the person to prove their identity by password first,
  // so a face can only be bound to the account it actually belongs to.
  const [enrollAuthedStaff, setEnrollAuthedStaff] = useState(null); // staff validated by pwd
  const [enrollLogin, setEnrollLogin] = useState("");
  const [enrollPass,  setEnrollPass]  = useState("");
  const [enrollError, setEnrollError] = useState("");

  // Load TF.js models + enrolled descriptors once on mount
  useEffect(() => {
    let alive = true;
    loadModels()
      .then(() => alive && setModelStatus("ready"))
      .catch(() => alive && setModelStatus("error"));
    fetchFaceDescriptors()
      .then(list => alive && setEnrolledFaces(list))
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  // ── Camera helpers ────────────────────────────────────────────────────────
  const startCam = useCallback(async () => {
    setCamError(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 400, height: 300 },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCamActive(true);
      setStep("scanning");
    } catch {
      setCamError(true);
      setCamActive(true);
      setStep("scanning");
    }
  }, []);

  const stopCam = useCallback(() => {
    videoRef.current?.srcObject?.getTracks().forEach(t => t.stop());
    setCamActive(false);
    setStep("idle");
    cancelAnimationFrame(animRef.current);
  }, []);

  // ── Animation loop (live camera overlay or simulated scan lines) ──────────
  useEffect(() => {
    if (!camActive) return;

    const loop = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");

      if (!camError && videoRef.current?.videoWidth > 0) {
        drawFaceBox(canvas, videoRef.current);
      } else {
        // Fallback: animated scan lines (no camera permission)
        canvas.width = 400; canvas.height = 300;
        ctx.fillStyle = "#1a1f2e";
        ctx.fillRect(0, 0, 400, 300);
        const t = Date.now() / 1000;
        for (let i = 0; i < 8; i++) {
          const y = ((t * 40 + i * 40) % 320) - 10;
          ctx.strokeStyle = `rgba(233,30,140,${0.08 + Math.sin(t + i) * 0.04})`;
          ctx.lineWidth   = 1;
          ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(400, y); ctx.stroke();
        }
        const [cx, cy] = [200, 130];
        const pulse    = (Math.sin(t * 3) + 1) / 2;
        ctx.strokeStyle = ACCENT2; ctx.lineWidth = 2; ctx.setLineDash([8, 6]);
        ctx.beginPath(); ctx.ellipse(cx, cy, 70, 95, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);
        ctx.strokeStyle = `rgba(233,30,140,${0.3 * pulse})`; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.ellipse(cx, cy, 70 + pulse * 12, 95 + pulse * 12, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = "rgba(255,255,255,.5)";
        ctx.font      = "12px 'DM Sans', sans-serif"; ctx.textAlign = "center";
        ctx.fillText("Simulation — Positionnez votre visage", cx, cy + 120);
      }
      animRef.current = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(animRef.current);
  }, [camActive, camError]);

  // ── Auth flows ────────────────────────────────────────────────────────────

  // Real face recognition: detect a face in the live video, compute its 128-D
  // descriptor, and match it against the enrolled-faces database.
  const runRecognition = useCallback(async () => {
    if (modelStatus !== "ready") return;
    if (camError) {
      setStep("denied");
      setRecogMsg("Caméra indisponible — la reconnaissance faciale nécessite un accès caméra.");
      return;
    }
    setStep("verifying");
    setRecogMsg("");
    try {
      const probe = await computeDescriptor(videoRef.current);
      if (!probe) {
        setStep("denied");
        setRecogMsg("Aucun visage détecté — placez-vous face à la caméra, bien éclairé.");
        return;
      }
      const result = matchDescriptor(probe, enrolledFaces);
      if (result?.match) {
        const user = DB_STAFF.find(u => u.staff_id === result.staff_id);
        if (!user) {
          setStep("denied");
          setRecogMsg("Visage reconnu mais employé introuvable dans la base.");
          return;
        }
        setSelectedUser(user);
        setStep("granted");
        setRecogMsg(`Correspondance — distance ${result.distance.toFixed(3)} (seuil ${MATCH_THRESHOLD})`);
        setTimeout(() => onAuth && onAuth(user), 1200);
      } else {
        setStep("denied");
        setRecogMsg(
          enrolledFaces.length === 0
            ? "Aucun visage enrôlé. Passez en mode « Enrôlement » pour ajouter votre visage."
            : `Visage non reconnu${result ? ` (distance ${result.distance.toFixed(3)} > ${MATCH_THRESHOLD})` : ""}.`
        );
      }
    } catch (e) {
      setStep("denied");
      setRecogMsg("Erreur de reconnaissance : " + e.message);
    }
  }, [modelStatus, camError, enrolledFaces, onAuth]);

  // Enrolment: capture the authenticated staff member's face → store descriptor.
  const runEnroll = useCallback(async () => {
    if (modelStatus !== "ready" || !enrollAuthedStaff) return;
    if (camError) { setRecogMsg("Caméra indisponible — impossible d'enrôler."); return; }
    setStep("verifying");
    setRecogMsg("");
    try {
      const descriptor = await computeDescriptor(videoRef.current);
      if (!descriptor) {
        setStep("scanning");
        setRecogMsg("Aucun visage détecté — réessayez, bien centré et éclairé.");
        return;
      }
      const staff = enrollAuthedStaff;
      await saveFaceDescriptor({
        staff_id: staff.staff_id,
        employee_number: staff.employee_number,
        descriptor,
      });
      const fresh = await fetchFaceDescriptors();
      setEnrolledFaces(fresh);
      setStep("scanning");
      setRecogMsg(`✓ Visage de ${staff.first_name} ${staff.last_name} enrôlé.`);
    } catch (e) {
      setStep("scanning");
      setRecogMsg("Erreur d'enrôlement : " + e.message);
    }
  }, [modelStatus, enrollAuthedStaff, camError]);

  // Validate identity by password before allowing face enrolment.
  const handleEnrollAuth = useCallback(() => {
    setEnrollError("");
    const login = enrollLogin.trim().toLowerCase();
    const match = DB_STAFF.find(u =>
      u.last_name.toLowerCase()       === login ||
      u.employee_number.toLowerCase() === login ||
      u.first_name.toLowerCase()      === login
    );
    if (!match)                        { setEnrollError("Identifiant inconnu.");      return; }
    if (match.password !== enrollPass) { setEnrollError("Mot de passe incorrect."); return; }
    setEnrollAuthedStaff(match);
    setRecogMsg("");
  }, [enrollLogin, enrollPass]);

  const removeEnrollment = useCallback(async (staffId) => {
    await deleteFaceDescriptor(staffId);
    const fresh = await fetchFaceDescriptors();
    setEnrolledFaces(fresh);
  }, []);

  // End the current enrolment session (sign the enroller back out).
  const endEnrollSession = useCallback(() => {
    stopCam();
    setEnrollAuthedStaff(null);
    setEnrollLogin(""); setEnrollPass(""); setEnrollError("");
    setStep("idle");
    setRecogMsg("");
  }, [stopCam]);

  const reset = useCallback(() => {
    stopCam();
    setSelectedUser(null);
    setStep("idle");
    setCamError(false);
    setRecogMsg("");
    setEnrollAuthedStaff(null);
    setEnrollLogin(""); setEnrollPass(""); setEnrollError("");
    setPwdLogin(""); setPwdPass(""); setPwdError("");
  }, [stopCam]);

  const handlePasswordAuth = useCallback(async () => {
    setPwdError("");
    setStep("verifying");
    try {
      const { user, error } = await authLogin(pwdLogin.trim(), pwdPass);
      if (error) {
        setStep("idle");
        setPwdError(error);
        return;
      }
      setSelectedUser(user);
      setStep("granted");
      setTimeout(() => onAuth && onAuth(user), 900);
    } catch {
      setStep("idle");
      setPwdError("Serveur inaccessible.");
    }
  }, [pwdLogin, pwdPass, onAuth]);

  const switchMethod = useCallback((m) => {
    setAuthMethod(m);
    if (camActive) stopCam();
    setStep("idle");
    setSelectedUser(null);
    setPwdLogin(""); setPwdPass(""); setPwdError("");
  }, [camActive, stopCam]);

  // ── Step labels & colours ─────────────────────────────────────────────────
  const stepColors = { idle: MUTED, scanning: AMBER, verifying: ACCENT, granted: GREEN, denied: RED };
  const stepLabels = {
    idle:      "En attente",
    scanning:  bioMode === "enroll" ? "Caméra active — Cadrez le visage à enrôler" : "Caméra active — Positionnez votre visage",
    verifying: bioMode === "enroll" ? "Capture du visage en cours…" : "Analyse faciale en cours…",
    granted:   "Identité confirmée — Accès autorisé",
    denied:    "Identité non reconnue — Accès refusé",
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div>
      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        <div style={{ background: CARD, borderRadius: 16, border: `1px solid ${BORDER}`, padding: 20, boxShadow: "0 2px 10px rgba(0,0,0,.04)" }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14, textAlign: "center", color: ACCENT }}>
            Méthode d'authentification
          </div>

          {/* Method tabs */}
          <div style={{ display: "flex", borderRadius: 10, overflow: "hidden", border: "1.5px solid #E5E7EB", marginBottom: 18 }}>
            {[
              {
                id:   "bio",
                label: "Biométrie",
                icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
              },
              {
                id:   "badge",
                label: "Badge RFID",
                icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>,
              },
              {
                id:   "password",
                label: "Mot de passe",
                icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
              },
            ].map(m => (
              <button
                key={m.id}
                onClick={() => switchMethod(m.id)}
                style={{
                  flex: 1, padding: "9px 6px", border: "none", cursor: "pointer",
                  fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: 12,
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                  background:  authMethod === m.id ? ACCENT2 : "#fff",
                  color:       authMethod === m.id ? "#fff"  : MUTED,
                  transition:  "all .2s",
                  borderRight: m.id !== "password" ? "1px solid #E5E7EB" : "none",
                }}
              >
                {m.icon} {m.label}
              </button>
            ))}
          </div>

          {/* ── Method 1: Biometrics (real face recognition) ───────────────── */}
          {authMethod === "bio" && (
            <div style={{ textAlign: "center" }}>

              {/* Model loading / error banner */}
              <div style={{
                marginBottom: 12, padding: "7px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                background: modelStatus === "ready" ? GREEN + "12" : modelStatus === "error" ? RED + "12" : AMBER + "12",
                color:      modelStatus === "ready" ? GREEN        : modelStatus === "error" ? RED        : AMBER,
              }}>
                {modelStatus === "loading" && "Chargement des modèles de reconnaissance faciale…"}
                {modelStatus === "ready"   && `Modèles prêts · ${enrolledFaces.length} visage(s) enrôlé(s)`}
                {modelStatus === "error"   && "Échec du chargement des modèles (/models manquant ?)"}
              </div>

              {/* Login / Enroll mode toggle */}
              <div style={{ display: "flex", borderRadius: 8, overflow: "hidden", border: "1.5px solid #E5E7EB", marginBottom: 14, maxWidth: 400, marginLeft: "auto", marginRight: "auto" }}>
                {[{ id: "login", label: "Connexion" }, { id: "enroll", label: "Enrôlement" }].map(m => (
                  <button
                    key={m.id}
                    onClick={() => {
                      if (camActive) stopCam();
                      setBioMode(m.id);
                      setStep("idle");
                      setRecogMsg("");
                      setSelectedUser(null);
                      setEnrollAuthedStaff(null);
                      setEnrollLogin(""); setEnrollPass(""); setEnrollError("");
                    }}
                    style={{
                      flex: 1, padding: "7px 6px", border: "none", cursor: "pointer",
                      fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: 12,
                      background: bioMode === m.id ? ACCENT : "#fff",
                      color:      bioMode === m.id ? "#fff"  : MUTED,
                      borderRight: m.id === "login" ? "1px solid #E5E7EB" : "none",
                    }}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              {/* Enrolment — step 1: prove identity by password */}
              {bioMode === "enroll" && !enrollAuthedStaff && (
                <div style={{ maxWidth: 380, margin: "0 auto", textAlign: "left" }}>
                  <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 12, padding: 24, display: "flex", flexDirection: "column", gap: 13 }}>
                    <div style={{ textAlign: "center", fontSize: 12, color: MUTED, marginBottom: 2 }}>
                      Identifiez-vous avec votre mot de passe pour enregistrer votre visage.
                    </div>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: MUTED, display: "block", marginBottom: 5 }}>Identifiant</label>
                      <input
                        value={enrollLogin}
                        onChange={e => { setEnrollLogin(e.target.value); setEnrollError(""); }}
                        onKeyDown={e => e.key === "Enter" && handleEnrollAuth()}
                        placeholder="Ex : martin, EMP-001, sophie…"
                        style={{ width: "100%", boxSizing: "border-box", padding: "10px 14px", borderRadius: 8, border: `1.5px solid ${enrollError ? RED : "#D1D5DB"}`, fontFamily: "'DM Sans', sans-serif", fontSize: 13, outline: "none" }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: MUTED, display: "block", marginBottom: 5 }}>Mot de passe</label>
                      <input
                        type="password"
                        value={enrollPass}
                        onChange={e => { setEnrollPass(e.target.value); setEnrollError(""); }}
                        onKeyDown={e => e.key === "Enter" && handleEnrollAuth()}
                        placeholder="Mot de passe"
                        style={{ width: "100%", boxSizing: "border-box", padding: "10px 14px", borderRadius: 8, border: `1.5px solid ${enrollError ? RED : "#D1D5DB"}`, fontFamily: "'DM Sans', sans-serif", fontSize: 13, outline: "none" }}
                      />
                    </div>
                    {enrollError && (
                      <div style={{ padding: "8px 12px", borderRadius: 8, background: RED + "10", color: RED, fontSize: 13, fontWeight: 600, textAlign: "center" }}>
                        {enrollError}
                      </div>
                    )}
                    <Btn variant="accent" onClick={handleEnrollAuth} disabled={!enrollLogin || !enrollPass} style={{ width: "100%" }}>
                      Vérifier l'identité
                    </Btn>
                  </div>
                </div>
              )}

              {/* Enrolment — confirmation banner once authenticated */}
              {bioMode === "enroll" && enrollAuthedStaff && (
                <div style={{ marginBottom: 12, maxWidth: 400, marginLeft: "auto", marginRight: "auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "8px 12px", borderRadius: 8, background: ACCENT + "10", fontSize: 12, color: ACCENT }}>
                  <span style={{ fontWeight: 600, textAlign: "left" }}>
                    Identité vérifiée — enregistrement du visage de {enrollAuthedStaff.title} {enrollAuthedStaff.first_name} {enrollAuthedStaff.last_name}
                  </span>
                  <button onClick={endEnrollSession} style={{ background: "none", border: "none", color: MUTED, cursor: "pointer", fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" }}>
                    Changer
                  </button>
                </div>
              )}

              {/* Camera block — shown for login, or for enrol once identity proven */}
              {(bioMode === "login" || enrollAuthedStaff) && (
              <>
              <div style={{ position: "relative", width: "100%", maxWidth: 400, margin: "0 auto", aspectRatio: "4/3", background: "#111827", borderRadius: 12, overflow: "hidden" }}>
                <video
                  ref={videoRef} autoPlay playsInline muted
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: camActive && !camError ? "block" : "none", transform: "scaleX(-1)" }}
                />
                <canvas
                  ref={canvasRef}
                  style={{ position: camError ? "relative" : "absolute", top: 0, left: 0, width: "100%", height: "100%", display: camActive ? "block" : "none", transform: camError ? "none" : "scaleX(-1)" }}
                />
                {!camActive && (
                  <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "#6B7280", fontSize: 14 }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="1.5"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                    <div style={{ marginTop: 8 }}>Caméra inactive</div>
                  </div>
                )}
                {step === "verifying" && (
                  <div style={{ position: "absolute", inset: 0, background: "rgba(15,76,117,0.3)", display: "grid", placeItems: "center" }}>
                    <div style={{ width: 60, height: 60, border: "3px solid #fff", borderTopColor: "transparent", borderRadius: "50%", animation: "spin .8s linear infinite" }} />
                    <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
                  </div>
                )}
                {step === "granted" && (
                  <div style={{ position: "absolute", inset: 0, background: "rgba(16,185,129,0.25)", display: "grid", placeItems: "center" }}>
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                  </div>
                )}
              </div>

              <div style={{ marginTop: 14, padding: "8px 16px", borderRadius: 8, background: stepColors[step] + "12", color: stepColors[step], fontWeight: 600, fontSize: 13, display: "inline-block" }}>
                {stepLabels[step]}
              </div>

              {/* Recognition / enrolment feedback */}
              {recogMsg && (
                <div style={{ marginTop: 8, fontSize: 12, color: step === "granted" ? GREEN : step === "denied" ? RED : MUTED, maxWidth: 400, marginLeft: "auto", marginRight: "auto" }}>
                  {recogMsg}
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "center", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
                {step === "idle" && <Btn variant="accent" onClick={startCam}>Activer la caméra</Btn>}

                {/* Login mode */}
                {bioMode === "login" && step === "scanning" && (
                  <Btn variant="accent" onClick={runRecognition} disabled={modelStatus !== "ready"}>
                    {modelStatus === "ready" ? "Lancer la reconnaissance" : "Chargement…"}
                  </Btn>
                )}
                {bioMode === "login" && step === "denied" && (
                  <Btn variant="accent" onClick={runRecognition} disabled={modelStatus !== "ready"}>Réessayer</Btn>
                )}

                {/* Enroll mode */}
                {bioMode === "enroll" && (step === "scanning" || step === "denied") && (
                  <Btn variant="accent" onClick={runEnroll} disabled={modelStatus !== "ready" || !enrollAuthedStaff}>
                    Capturer & enrôler le visage
                  </Btn>
                )}

                {(step === "granted" || step === "denied") && bioMode === "login" && <Btn variant="ghost" onClick={reset}>Réinitialiser</Btn>}
                {camActive && step !== "granted" && <Btn variant="ghost" onClick={stopCam}>Annuler</Btn>}
              </div>

              {/* Enrolled faces management (visible only to an authenticated enroller) */}
              {bioMode === "enroll" && enrollAuthedStaff && enrolledFaces.length > 0 && (
                <div style={{ marginTop: 18, textAlign: "left", maxWidth: 400, marginLeft: "auto", marginRight: "auto", borderTop: "1px solid #E5E7EB", paddingTop: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: MUTED, marginBottom: 8 }}>Visages enrôlés</div>
                  {enrolledFaces.map(f => {
                    const s = DB_STAFF.find(u => u.staff_id === f.staff_id);
                    return (
                      <div key={f.staff_id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12, padding: "5px 0" }}>
                        <span>{s ? `${s.title} ${s.first_name} ${s.last_name}` : `Staff #${f.staff_id}`} <span style={{ color: MUTED }}>· {f.employee_number}</span></span>
                        <button onClick={() => removeEnrollment(f.staff_id)} style={{ background: "none", border: "none", color: RED, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>Retirer</button>
                      </div>
                    );
                  })}
                </div>
              )}
              </>
              )}
            </div>
          )}

          {/* ── Method 2: RFID Badge ───────────────────────────────────────── */}
          {authMethod === "badge" && (
            <div style={{ textAlign: "center" }}>
              <div style={{ width: "100%", maxWidth: 400, margin: "0 auto", aspectRatio: "4/3", background: "#111827", borderRadius: 12, overflow: "hidden", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke={step === "granted" ? GREEN : ACCENT2} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: step === "verifying" ? 0.5 : 1, transition: "all .3s" }}>
                  <rect x="2" y="5" width="20" height="14" rx="2"/>
                  <line x1="2" y1="10" x2="22" y2="10"/>
                  <line x1="6" y1="15" x2="10" y2="15"/>
                  <line x1="14" y1="15" x2="16" y2="15"/>
                </svg>
                {step === "verifying" && (
                  <div style={{ width: 40, height: 40, border: "3px solid #fff", borderTopColor: "transparent", borderRadius: "50%", animation: "spin .8s linear infinite" }} />
                )}
                {step !== "granted" && step !== "verifying" && (
                  <div style={{ color: "rgba(255,255,255,.5)", fontSize: 13 }}>Approchez votre badge</div>
                )}
                {step === "granted" && (
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke={GREEN} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                )}
              </div>

              <div style={{ marginTop: 14, padding: "8px 16px", borderRadius: 8, background: stepColors[step] + "12", color: stepColors[step], fontWeight: 600, fontSize: 13, display: "inline-block" }}>
                {stepLabels[step]}
              </div>

              <div style={{ display: "flex", justifyContent: "center", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
                {step === "idle" && (
                  <Btn variant="accent" onClick={() => {
                    const user = DB_STAFF.find(u => u.biometric_enrolled) || DB_STAFF[0];
                    setSelectedUser(user);
                    setStep("verifying");
                    setTimeout(() => { setStep("granted"); setTimeout(() => onAuth && onAuth(user), 900); }, 1800);
                  }}>
                    Simuler lecture badge
                  </Btn>
                )}
                {(step === "granted" || step === "denied") && <Btn variant="ghost" onClick={reset}>Réinitialiser</Btn>}
              </div>
            </div>
          )}

          {/* ── Method 3: Password ─────────────────────────────────────────── */}
          {authMethod === "password" && (
            <div>
              {step !== "granted" ? (
                <div style={{ maxWidth: 380, margin: "0 auto" }}>
                  <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 12, padding: 28, display: "flex", flexDirection: "column", gap: 14 }}>
                    <div style={{ textAlign: "center", marginBottom: 4 }}>
                      <div style={{ width: 52, height: 52, borderRadius: "50%", background: ACCENT2 + "18", display: "grid", placeItems: "center", margin: "0 auto 10px" }}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={ACCENT2} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                      </div>
                      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Connexion par mot de passe</div>
                      <div style={{ fontSize: 12, color: MUTED }}>Entrez votre identifiant (nom ou N° employé) et votre mot de passe</div>
                    </div>

                    {/* Login field */}
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: MUTED, display: "block", marginBottom: 5 }}>Identifiant</label>
                      <input
                        value={pwdLogin}
                        onChange={e => { setPwdLogin(e.target.value); setPwdError(""); }}
                        onKeyDown={e => e.key === "Enter" && handlePasswordAuth()}
                        placeholder="Ex : martin, EMP-001, sophie…"
                        style={{ width: "100%", boxSizing: "border-box", padding: "10px 14px", borderRadius: 8, border: `1.5px solid ${pwdError ? RED : "#D1D5DB"}`, fontFamily: "'DM Sans', sans-serif", fontSize: 13, outline: "none" }}
                      />
                    </div>

                    {/* Password field */}
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: MUTED, display: "block", marginBottom: 5 }}>Mot de passe</label>
                      <div style={{ position: "relative" }}>
                        <input
                          type={pwdShowPass ? "text" : "password"}
                          value={pwdPass}
                          onChange={e => { setPwdPass(e.target.value); setPwdError(""); }}
                          onKeyDown={e => e.key === "Enter" && handlePasswordAuth()}
                          placeholder="Mot de passe"
                          style={{ width: "100%", boxSizing: "border-box", padding: "10px 40px 10px 14px", borderRadius: 8, border: `1.5px solid ${pwdError ? RED : "#D1D5DB"}`, fontFamily: "'DM Sans', sans-serif", fontSize: 13, outline: "none" }}
                        />
                        <button
                          onClick={() => setPwdShowPass(s => !s)}
                          style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: MUTED, fontSize: 12 }}
                        >
                          {pwdShowPass ? "Cacher" : "Voir"}
                        </button>
                      </div>
                    </div>

                    {/* Error message */}
                    {pwdError && (
                      <div style={{ padding: "8px 12px", borderRadius: 8, background: RED + "10", color: RED, fontSize: 13, fontWeight: 600, textAlign: "center" }}>
                        {pwdError}
                      </div>
                    )}

                    {/* Submit */}
                    {step === "verifying" ? (
                      <div style={{ textAlign: "center", padding: "12px 0" }}>
                        <div style={{ width: 36, height: 36, border: "3px solid #E5E7EB", borderTopColor: ACCENT2, borderRadius: "50%", animation: "spin .8s linear infinite", margin: "0 auto" }} />
                        <div style={{ marginTop: 10, fontSize: 13, color: MUTED }}>Vérification en cours…</div>
                      </div>
                    ) : (
                      <Btn variant="accent" onClick={handlePasswordAuth} disabled={!pwdLogin || !pwdPass} style={{ width: "100%" }}>
                        Se connecter
                      </Btn>
                    )}

                    {/* Demo hint */}
                    <div style={{ fontSize: 11, color: MUTED, textAlign: "center", borderTop: "1px solid #E5E7EB", paddingTop: 10 }}>
                      Compte admin : identifiant <strong>admin</strong> · mot de passe <strong>admin</strong>
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: "center" }}>
                  <div style={{ width: "100%", maxWidth: 400, margin: "0 auto 14px", aspectRatio: "4/3", background: "#111827", borderRadius: 12, display: "grid", placeItems: "center" }}>
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke={GREEN} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                  </div>
                  <div style={{ padding: "8px 16px", borderRadius: 8, background: GREEN + "12", color: GREEN, fontWeight: 600, fontSize: 13, display: "inline-block", marginBottom: 14 }}>
                    Authentification réussie
                  </div>
                  <br/>
                  <Btn variant="ghost" onClick={reset}>Réinitialiser</Btn>
                </div>
              )}
            </div>
          )}

          {/* Access granted card (all methods) */}
          {step === "granted" && selectedUser && (
            <div style={{ marginTop: 18, padding: 18, borderRadius: 12, background: "#ECFDF5", border: "1px solid #A7F3D0", textAlign: "left" }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: "#065F46", marginBottom: 10 }}>
                Accès autorisé — Droits attribués
              </div>
              <table style={{ fontSize: 13, lineHeight: 1.8, width: "100%" }}>
                <tbody>
                  {[
                    ["Identité",     `${selectedUser.title} ${selectedUser.first_name} ${selectedUser.last_name}`.trim()],
                    ["N° employé",   selectedUser.employee_number],
                    ["Rôle",         selectedUser.role_label],
                    ["Service",      selectedUser.dept],
                    ["Spécialité",   selectedUser.specialty || "—"],
                    ["Niveau accès", selectedUser.access_level + " / 5"],
                    ["Méthode auth", authMethod === "bio" ? "Reconnaissance faciale" : authMethod === "badge" ? "Badge RFID" : "Mot de passe"],
                    ["Biométrie",    selectedUser.biometric_enrolled ? "Enrolée" : "Non enrolée"],
                    ["Horodatage",   new Date().toLocaleString("fr-FR")],
                  ].map(([k, v]) => (
                    <tr key={k}>
                      <td style={{ fontWeight: 600, paddingRight: 14, color: "#065F46", whiteSpace: "nowrap" }}>{k}</td>
                      <td>{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Permissions list */}
              <div style={{ marginTop: 12 }}>
                <div style={{ fontWeight: 700, fontSize: 12, color: "#065F46", marginBottom: 6 }}>Permissions accordées :</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {(ACCESS_PERMISSIONS[selectedUser.access_level] || []).map(p => (
                    <span key={p} style={{ fontSize: 11, padding: "2px 8px", borderRadius: 5, background: "#D1FAE5", color: "#065F46", fontWeight: 600 }}>
                      {PERM_LABELS[p] || p}
                    </span>
                  ))}
                </div>
              </div>

              <div style={{ marginTop: 10, fontSize: 11, color: "#065F46", opacity: 0.7 }}>
                Log AUD enregistré · Session SILLAGE activée · staff_access_log ↩
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default BioBot;
