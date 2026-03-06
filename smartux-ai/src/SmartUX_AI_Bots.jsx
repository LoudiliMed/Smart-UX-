import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import {
  DB_PATIENTS,
  DB_STAFF,
  DB_MEDICAMENTS,
  KNOWN_ALLERGIES,
  TYPO_CORRECTIONS,
  AUTOCOMPLETE_CORPUS,
  ACCESS_PERMISSIONS,
  PERM_LABELS,
  DB_IMAGERIE,
  DB_OBSERVATIONS,
  DB_CONSTANTES,
} from "./database";

const ACCENT  = "#0F4C75";
const ACCENT2 = "#E91E8C";
const BG      = "#F0F4F8";
const CARD    = "#FFFFFF";
const MUTED   = "#6B7280";
const GREEN   = "#10B981";
const AMBER   = "#F59E0B";
const RED     = "#EF4444";
const BORDER  = "#E2E8F0";

function autoCorrect(text) {
  let corrected = text;
  const corrections = [];
  Object.entries(TYPO_CORRECTIONS).forEach(([typo, correct]) => {
    const regex = new RegExp(typo, "gi");
    if (regex.test(corrected)) {
      corrected = corrected.replace(regex, correct);
      corrections.push({ from: typo, to: correct });
    }
  });
  return { corrected, corrections };
}

// Détection de conflits allergie/médicament
function detectAllergyConflict(nlpData, patientMatch) {
  if (!patientMatch || !nlpData.medicament) return null;
  const allergies = KNOWN_ALLERGIES[patientMatch.patient_id] || [];
  const drug = nlpData.medicament.toLowerCase();
  const conflict = allergies.find(a => drug.includes(a) || a.includes(drug));
  if (conflict) return `ALERTE ALLERGIE : ${patientMatch.first_name} ${patientMatch.last_name} est allergique à ${conflict}`;
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
//  NLP → PRESCRIPTION MAPPER
// ─────────────────────────────────────────────────────────────────────────────
function mapNLPToPrescription(nlpData, rawText) {
  const patientMatch = DB_PATIENTS.find(p =>
    nlpData.patient &&
    (p.last_name.toLowerCase().includes(nlpData.patient.toLowerCase()) ||
     nlpData.patient.toLowerCase().includes(p.last_name.toLowerCase()))
  );

  const drugQuery = (nlpData.medicament || "").toLowerCase();
  const drugMatch = DB_MEDICAMENTS.find(m =>
    drugQuery && (
      m.brand.toLowerCase().includes(drugQuery) ||
      m.inn.toLowerCase().includes(drugQuery) ||
      drugQuery.includes(m.brand.toLowerCase()) ||
      drugQuery.includes(m.inn.toLowerCase())
    )
  );

  const autoFilled = [];
  if (patientMatch) autoFilled.push("patient_id");
  if (drugMatch)    autoFilled.push("medicament_id","form","route");
  if (nlpData.dose)       autoFilled.push("dosage");
  if (nlpData.voie)       autoFilled.push("route");
  if (nlpData.frequence)  autoFilled.push("frequency");
  if (nlpData.diagnostic) autoFilled.push("diagnostic","indication");
  if (nlpData.service)    autoFilled.push("service");
  if (nlpData.priorite)   autoFilled.push("priorite");
  if (nlpData.allergie)   autoFilled.push("allergie_signalee");
  if (nlpData.chambre)    autoFilled.push("chambre");

  const prioRaw = (nlpData.priorite || "").toLowerCase();
  const priorite = prioRaw.includes("urgente") || prioRaw.includes("haute")
    ? "URGENTE"
    : prioRaw.includes("stat")
    ? "STAT"
    : nlpData.priorite
    ? "NORMALE"
    : null;

  const allergyAlert = detectAllergyConflict(nlpData, patientMatch);

  return {
    prescription_id:     Date.now(),
    patient_id:          patientMatch?.patient_id  || null,
    patient_name_free:   patientMatch
      ? `${patientMatch.first_name} ${patientMatch.last_name}`
      : (nlpData.patient || null),
    medicament_id:       drugMatch?.id || null,
    drug_name_free:      drugMatch
      ? `${drugMatch.brand} (${drugMatch.inn})`
      : (nlpData.medicament || null),
    dosage:              nlpData.dose       || (drugMatch?.dosage || null),
    form:                drugMatch?.form    || null,
    route:               nlpData.voie       || (drugMatch?.route || null),
    frequency:           nlpData.frequence  || null,
    indication:          nlpData.diagnostic || null,
    diagnostic:          nlpData.diagnostic || null,
    service:             nlpData.service    || null,
    chambre:             nlpData.chambre    || null,
    priorite,
    allergie_signalee:   nlpData.allergie   || null,
    allergyAlert,
    action:              nlpData.action     || "prescrire",
    examen:              nlpData.examen     || null,
    notes:               nlpData.note       || null,
    nlp_raw_text:        rawText,
    nlp_extracted_json:  JSON.stringify(nlpData),
    nlp_confidence:      Object.keys(nlpData).length > 3 ? "HIGH" : Object.keys(nlpData).length > 1 ? "MEDIUM" : "LOW",
    nlp_fields_auto:     JSON.stringify(autoFilled),
    is_validated:        false,
    source:              "NLP",
    created_at:          new Date().toISOString(),
    _matched_patient:    patientMatch,
    _matched_drug:       drugMatch,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
//  PARSE DELAY  — converts "2h", "24h", "3 jours", "30min" → ISO timestamp
// ─────────────────────────────────────────────────────────────────────────────
function parseDelay(str) {
  if (!str) return null;
  if (/^(aucun|non|sans|no|-)$/i.test(str.trim())) return null;
  const match = str.match(/(\d+)\s*(h(?:eure(?:s)?)?|j(?:our(?:s)?)?|min(?:ute(?:s)?)?|sem(?:aine(?:s)?)?)/i);
  if (!match) return null;
  const val  = parseInt(match[1]);
  const unit = match[2].toLowerCase();
  const d    = new Date();
  if      (unit.startsWith("h"))   d.setHours(d.getHours() + val);
  else if (unit.startsWith("j"))   d.setDate(d.getDate() + val);
  else if (unit.startsWith("min")) d.setMinutes(d.getMinutes() + val);
  else if (unit.startsWith("sem")) d.setDate(d.getDate() + val * 7);
  return d.toISOString();
}

// ─────────────────────────────────────────────────────────────────────────────
//  CLAUDE API CALL
// ─────────────────────────────────────────────────────────────────────────────
async function parseWithClaude(text) {
  try {
    const res = await fetch("http://localhost:3001/api/claude", {
      method: "POST",
      headers: { "Content-Type": "application/json"},

      body: JSON.stringify({
        model: "claude-sonnet-4-5",
        max_tokens: 1000,
        messages: [{
          role: "user",
          content: `Tu es un assistant NLP médical pour le système SILLAGE. Analyse la phrase suivante saisie par un personnel hospitalier et extrais les données structurées en JSON.

Le JSON doit contenir uniquement les champs pertinents parmi :
patient, action, medicament, dose, voie, frequence, diagnostic, examen, allergie, note, service, priorite, chambre.

Règles :
- "voie" : Per os | IV | IM | SC | Inhalé | Topique
- "priorite" : normale | urgente | STAT
- "action" : prescrire | stopper | modifier | transfert | signaler | planifier
- Ne renvoie QUE le JSON, sans backticks ni explication.

Phrase : "${text}"`,
        }],
      }),
    });
    const data = await res.json();
    const raw = data.content?.[0]?.text || "{}";
    const clean = raw.replace(/```json|```/g, "").trim();
    return JSON.parse(clean);
  } catch (e) {
    return { erreur: "Impossible de parser la réponse IA", raw: e.message };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  PATIENT DOSSIER CONTEXT BUILDER (SAFE-01)
// ─────────────────────────────────────────────────────────────────────────────
// PHI NOTE: Patient name replaced with token (H-{id}) per RGPD — confirmed in
// Task 0 checkpoint (option-b). DPA not yet confirmed for this hospital.
// To restore full name once DPA is signed, replace the header line with:
//   `Patient : ${patient.first_name} ${patient.last_name} (${patient.ipp}), ${age} ans, ${patient.ward}, chambre ${patient.room}`
export function buildDossierContext(patient, prescriptions) {
  if (!patient) return null;

  // Age computation (existing pattern from DossierPanel)
  const age =
    new Date().getFullYear() - new Date(patient.date_of_birth).getFullYear();

  // Header — anonymized token (H-{id}) instead of full name per RGPD / DPA-pending
  const header = `Patient H-${patient.patient_id}, ${age} ans, ${patient.ward}, chambre ${patient.room}`;

  // Vitals: most recent entry only (LOCKED DECISION)
  const vitals = DB_CONSTANTES
    .filter((c) => c.patient_id === patient.patient_id)
    .sort((a, b) => new Date(b.date) - new Date(a.date))[0];

  const vitalsStr = vitals
    ? `Constantes (le ${new Date(vitals.date).toLocaleDateString("fr-FR")}) : TA ${vitals.ta}, FC ${vitals.fc}/min, Température ${vitals.temp}°C, SpO2 ${vitals.spo2}%, Poids ${vitals.poids}kg`
    : "Constantes : Non disponibles";

  // Clinical note: most recent entry only (LOCKED DECISION)
  const note = DB_OBSERVATIONS
    .filter((o) => o.patient_id === patient.patient_id)
    .sort((a, b) => new Date(b.date) - new Date(a.date))[0];

  const noteStr = note
    ? `Dernière note clinique (${new Date(note.date).toLocaleDateString("fr-FR")} — ${note.category}) : ${note.text}`
    : "Aucune note clinique récente";

  // Allergies inline (LOCKED DECISION)
  const allergies = KNOWN_ALLERGIES[patient.patient_id] || [];
  const allergiesStr =
    allergies.length > 0
      ? `Allergies connues : ${allergies.join(", ")}`
      : "Aucune allergie connue";

  // Current medications (LOCKED DECISION: passed by caller, full history)
  const medsStr =
    prescriptions && prescriptions.length > 0
      ? "Traitements en cours : " +
        prescriptions
          .map((rx) => {
            const drugName =
              rx.drug_name_free ||
              DB_MEDICAMENTS.find((m) => m.id === rx.medicament_id)?.brand ||
              "Médicament inconnu";
            return [drugName, rx.dosage, rx.route]
              .filter(Boolean)
              .join(" ");
          })
          .join("; ")
      : "Aucun traitement en cours";

  // Assemble as narrative prose (LOCKED DECISION: not JSON, not labeled sections)
  return `${header}\n\n${vitalsStr}\n\n${noteStr}\n\n${allergiesStr}\n\n${medsStr}`;
}

// ─────────────────────────────────────────────────────────────────────────────
//  SYSTEM PROMPTS (SAFE-02 — disclaimer mandated in both prompts)
// ─────────────────────────────────────────────────────────────────────────────
export const CLAUDE_SYSTEM_PROMPT_ALERT = `Tu es un assistant de vérification des prescriptions médicales dans un hôpital français.

Tu analyses le dossier patient et les prescriptions pour identifier :
- Conflits d'allergies (CRITIQUE)
- Interactions médicamenteuses graves (CRITIQUE/MODERE)
- Contre-indications (CRITIQUE/MODERE)
- Ajustements posologiques nécessaires (MODERE/FAIBLE)

RÈGLES IMPÉRATIVES :
1. Réponds EXCLUSIVEMENT en français
2. Classe chaque alerte : CRITIQUE / MODERE / FAIBLE
3. Supprime les alertes si le risque est théorique ou négligeable
4. Exprime l'incertitude avec "Peut-être" si le signal est faible
5. Chaque réponse DOIT commencer par : "Analyse assistée par IA — vérification clinique recommandée."

FORMAT DE RÉPONSE :
Analyse assistée par IA — vérification clinique recommandée.

[S'il y a des alertes :]
**CRITIQUE** : [description du risque + mécanisme + alternative suggérée]
**MODERE** : [description du risque + recommandation]
**FAIBLE** : [information utile sans urgence]

[S'il n'y a pas d'alerte :]
Aucune interaction identifiée dans les données disponibles — le jugement clinique du prescripteur reste requis.`;

export const CLAUDE_SYSTEM_PROMPT_CHAT = `Tu es un assistant médical clinique dans un hôpital français.

Tu réponds aux questions du personnel médical sur les patients.

RÈGLES IMPÉRATIVES :
1. Réponds EXCLUSIVEMENT en français
2. Base tes réponses sur le dossier patient fourni dans le contexte
3. Indique clairement quand tu n'es pas certain
4. Chaque réponse DOIT commencer par : "Analyse assistée par IA — vérification clinique recommandée."
5. Ne fais JAMAIS de diagnostic — propose des hypothèses à vérifier par le clinicien
6. Ne réponds qu'aux questions concernant le patient fourni dans le dossier`;

// ─────────────────────────────────────────────────────────────────────────────
//  CLAUDE CHAT WRAPPER (SAFE-02)
// ─────────────────────────────────────────────────────────────────────────────
const DISCLAIMER = "Analyse assistée par IA — vérification clinique recommandée";

export async function callClaudeChat(systemPrompt, userMessage, history = []) {
  try {
    const messages = [
      { role: "system", content: systemPrompt },
      ...history,
      { role: "user", content: userMessage },
    ];

    const res = await fetch("http://localhost:3001/api/claude", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-5",
        max_tokens: 2000,
        messages,
      }),
    });

    if (!res.ok) {
      throw new Error(`Claude API error: ${res.status}`);
    }

    const data = await res.json();
    const text = data.content?.[0]?.text || "";

    // SAFE-02: Dual-layer disclaimer enforcement.
    // Layer 1: system prompt instructs Claude to begin with disclaimer.
    // Layer 2 (this): if Claude omits it (model drift), prepend here as failsafe.
    if (!text.includes(DISCLAIMER)) {
      return `${DISCLAIMER}\n\n${text}`;
    }
    return text;
  } catch (error) {
    console.error("callClaudeChat error:", error);
    throw error; // Let Phase 2 / Phase 3 caller handle error state
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  EXPORT PDF (via jsPDF CDN)
// ─────────────────────────────────────────────────────────────────────────────
function exportPDF(rx) {
  const load = () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const now = new Date().toLocaleString("fr-FR");
    doc.setFillColor(15, 76, 117);
    doc.rect(0, 0, 210, 30, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("SILLAGE — Acte & Ordre Médical", 14, 14);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`Généré le ${now}`, 14, 22);
    doc.setTextColor(30, 30, 46);
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text(`Action : ${(rx.action || "prescrire").toUpperCase()}`, 14, 42);
    if (rx.allergyAlert) {
      doc.setFillColor(239, 68, 68);
      doc.rect(14, 46, 182, 10, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(9);
      doc.text(rx.allergyAlert, 18, 53);
      doc.setTextColor(30, 30, 46);
    }
    const fields = [
      ["Patient",          rx.patient_name_free],
      ["Médicament",       rx.drug_name_free],
      ["Dosage",           rx.dosage],
      ["Forme",            rx.form],
      ["Voie",             rx.route],
      ["Fréquence",        rx.frequency],
      ["Indication",       rx.indication],
      ["Service",          rx.service],
      ["Chambre",          rx.chambre],
      ["Priorité",         rx.priorite],
      ["Allergie",         rx.allergie_signalee],
      ["Examen",           rx.examen],
      ["Notes",            rx.notes],
      ["Confiance NLP",    rx.nlp_confidence],
      ["Phrase originale", rx.nlp_raw_text],
    ].filter(([, v]) => v);
    let y = rx.allergyAlert ? 65 : 52;
    doc.setFontSize(10);
    fields.forEach(([label, val]) => {
      doc.setFont("helvetica", "bold");
      doc.setTextColor(107, 114, 128);
      doc.text(`${label} :`, 14, y);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(30, 30, 46);
      const lines = doc.splitTextToSize(String(val), 130);
      doc.text(lines, 60, y);
      y += lines.length * 7;
      if (y > 270) { doc.addPage(); y = 20; }
    });
    doc.setFillColor(245, 243, 238);
    doc.rect(0, 280, 210, 17, "F");
    doc.setFontSize(8);
    doc.setTextColor(107, 114, 128);
    doc.text("Document généré automatiquement par SmartUX-AI · Projet CRIStAL × Centrale Lille", 14, 289);
    doc.text(`ID : ${rx.prescription_id}`, 170, 289);
    doc.save(`SILLAGE_${rx.action || "acte"}_${rx.patient_name_free || "patient"}_${Date.now()}.pdf`);
  };
  if (window.jspdf) { load(); return; }
  const script = document.createElement("script");
  script.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
  script.onload = load;
  document.head.appendChild(script);
}

// ─────────────────────────────────────────────────────────────────────────────
//  SHARED UI ATOMS
// ─────────────────────────────────────────────────────────────────────────────
const Badge = ({ children, color = ACCENT, small = false }) => (
  <span style={{
    display:"inline-block", padding: small ? "2px 7px" : "3px 10px",
    borderRadius:6, fontSize: small ? 10 : 11, fontWeight:600, letterSpacing:0.3,
    background:color+"18", color,
  }}>{children}</span>
);

const Btn = ({ children, onClick, disabled, variant="primary", style:s }) => {
  const base = {
    padding:"10px 22px", borderRadius:10, border:"none",
    fontFamily:"'DM Sans', sans-serif", fontWeight:600, fontSize:14,
    cursor:disabled?"not-allowed":"pointer", transition:"all .2s",
    opacity:disabled ? 0.5 : 1,
  };
  const variants = {
    primary: { background:ACCENT, color:"#fff" },
    accent:  { background:ACCENT2, color:"#fff" },
    ghost:   { background:"transparent", color:ACCENT, border:`1.5px solid ${ACCENT}` },
    green:   { background:GREEN, color:"#fff" },
    red:     { background:RED, color:"#fff" },
  };
  return <button onClick={onClick} disabled={disabled} style={{...base,...variants[variant],...s}}>{children}</button>;
};

// ─────────────────────────────────────────────────────────────────────────────
//  AUTOCOMPLETE INPUT  (with voice recognition + command history)
// ─────────────────────────────────────────────────────────────────────────────
function AutocompleteInput({ value, onChange, onSubmit, loading, placeholder }) {
  const [suggestions, setSuggestions] = useState([]);
  const [showSugg, setShowSugg]       = useState(false);
  const [selIdx, setSelIdx]           = useState(-1);
  const [listening, setListening]     = useState(false);
  const [cmdHistory, setCmdHistory]   = useState([]);
  const [histIdx, setHistIdx]         = useState(-1);
  const inputRef      = useRef(null);
  const recognitionRef = useRef(null);

  // Voice recognition setup
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    const rec = new SpeechRecognition();
    rec.lang = "fr-FR";
    rec.continuous = false;
    rec.interimResults = false;
    rec.onresult = (e) => { onChange(e.results[0][0].transcript); setListening(false); };
    rec.onend = () => setListening(false);
    recognitionRef.current = rec;
  }, [onChange]);

  const toggleVoice = () => {
    if (!recognitionRef.current) return;
    if (listening) { recognitionRef.current.stop(); setListening(false); }
    else           { recognitionRef.current.start(); setListening(true); }
  };

  // Autocomplete suggestions
  useEffect(() => {
    if (!value.trim()) { setSuggestions([]); return; }
    const lastWord = value.split(" ").slice(-1)[0].toLowerCase();
    if (lastWord.length < 2) { setSuggestions([]); return; }
    const matches = AUTOCOMPLETE_CORPUS.filter(s => s.toLowerCase().includes(lastWord)).slice(0, 6);
    setSuggestions(matches);
    setSelIdx(-1);
  }, [value]);

  const applySuggestion = (s) => {
    const words = value.split(" ");
    if (s.includes("[")) { onChange(s); }
    else { words[words.length - 1] = s; onChange(words.join(" ")); }
    setSuggestions([]);
    setShowSugg(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e) => {
    // Navigate command history with ↑↓ when input is empty
    if (!value.trim()) {
      if (e.key === "ArrowUp") {
        e.preventDefault();
        const ni = Math.min(histIdx + 1, cmdHistory.length - 1);
        setHistIdx(ni);
        if (cmdHistory[ni]) onChange(cmdHistory[ni]);
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        const ni = Math.max(histIdx - 1, -1);
        setHistIdx(ni);
        onChange(ni >= 0 ? cmdHistory[ni] : "");
        return;
      }
    }
    if (showSugg && suggestions.length > 0) {
      if (e.key === "ArrowDown") { e.preventDefault(); setSelIdx(i => Math.min(i+1, suggestions.length-1)); return; }
      if (e.key === "ArrowUp")   { e.preventDefault(); setSelIdx(i => Math.max(i-1, -1)); return; }
      if (e.key === "Tab") {
        e.preventDefault();
        applySuggestion(suggestions[selIdx >= 0 ? selIdx : 0]);
        return;
      }
    }
    if (e.key === "Enter" && !loading) {
      if (value.trim()) setCmdHistory(h => [value.trim(), ...h.slice(0, 19)]);
      setHistIdx(-1);
      setSuggestions([]);
      setShowSugg(false);
      onSubmit(value);
    }
    if (e.key === "Escape") { setSuggestions([]); setShowSugg(false); }
  };

  const hasSpeech = !!(window.SpeechRecognition || window.webkitSpeechRecognition);

  return (
    <div style={{ flex:1, position:"relative" }}>
      <div style={{ display:"flex", gap:8 }}>
        <input
          ref={inputRef}
          value={value}
          onChange={e => { onChange(e.target.value); setShowSugg(true); setHistIdx(-1); }}
          onKeyDown={handleKeyDown}
          onFocus={() => setShowSugg(true)}
          onBlur={() => setTimeout(() => setShowSugg(false), 150)}
          placeholder={placeholder || "Ex : Prescrire 500mg de Doliprane per os 3x/jour pour le patient Dupont…"}
          style={{
            flex:1, boxSizing:"border-box",
            padding:"12px 18px", borderRadius:10,
            border:`1.5px solid ${showSugg && suggestions.length ? ACCENT : "#D1D5DB"}`,
            fontFamily:"'DM Sans', sans-serif", fontSize:14, outline:"none",
            transition:"border-color .2s",
          }}
        />
        {/* Voice button — only shown if SpeechRecognition is available */}
        {hasSpeech && (
          <button onClick={toggleVoice} title={listening ? "Arrêter la dictée" : "Dicter"} style={{
            width:44, height:44, borderRadius:10, border:"none", flexShrink:0,
            background: listening ? RED : ACCENT + "15",
            color: listening ? "#fff" : ACCENT,
            cursor:"pointer", display:"grid", placeItems:"center",
            animation: listening ? "voicePulse 1s infinite" : "none",
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
              <line x1="12" y1="19" x2="12" y2="23"/>
              <line x1="8" y1="23" x2="16" y2="23"/>
            </svg>
          </button>
        )}
      </div>
      {/* Hint bar */}
      <div style={{ fontSize:11, color:MUTED, marginTop:3, paddingLeft:4 }}>
        ↹ Tab pour compléter · ↑↓ historique · Entrée pour analyser
        {listening && <span style={{ color:RED, marginLeft:8 }}>● Écoute en cours…</span>}
      </div>
      {/* Dropdown */}
      {showSugg && suggestions.length > 0 && (
        <div style={{
          position:"absolute", top:"calc(100% - 4px)", left:0, right:0,
          background:CARD, border:"1.5px solid #E2E8F0", borderRadius:10,
          boxShadow:"0 8px 24px rgba(0,0,0,.10)", zIndex:100,
          overflow:"hidden",
        }}>
          {suggestions.map((s, i) => (
            <div key={i} onMouseDown={() => applySuggestion(s)} style={{
              padding:"9px 16px", fontSize:13, cursor:"pointer",
              fontFamily:"'DM Sans', sans-serif",
              background: i === selIdx ? ACCENT+"12" : "transparent",
              borderBottom: i < suggestions.length-1 ? "1px solid #F1F5F9" : "none",
              color: s.includes("[") ? MUTED : "#1A1A2E",
              fontStyle: s.includes("[") ? "italic" : "normal",
            }}>
              {s}
            </div>
          ))}
        </div>
      )}
      <style>{`@keyframes voicePulse{0%,100%{opacity:1;box-shadow:0 0 0 0 rgba(239,68,68,.4)}50%{opacity:.7;box-shadow:0 0 0 6px rgba(239,68,68,0)}}`}</style>
    </div>
  );
}

// (Logo removed per user request)

// ─────────────────────────────────────────────────────────────────────────────
//  ICONS (professional 2D SVG — no emojis)
// ─────────────────────────────────────────────────────────────────────────────
const Icon = ({ type, size = 15, color = "currentColor" }) => {
  const props = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: color, strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" };
  switch (type) {
    case "chat": return <svg {...props}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><circle cx="9" cy="10" r="1" fill={color} stroke="none"/><circle cx="12" cy="10" r="1" fill={color} stroke="none"/><circle cx="15" cy="10" r="1" fill={color} stroke="none"/></svg>;
    case "shield": return <svg {...props}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>;
    case "file": return <svg {...props}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>;
    case "folder": return <svg {...props}><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>;
    case "eye": return <svg {...props}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>;
    case "clipboard": return <svg {...props}><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg>;
    case "activity": return <svg {...props}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>;
    case "flask": return <svg {...props}><path d="M9 3h6v7l5 8a2 2 0 0 1-1.7 3H5.7a2 2 0 0 1-1.7-3l5-8V3z"/><line x1="9" y1="3" x2="15" y2="3"/></svg>;
    case "image": return <svg {...props}><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>;
    case "settings": return <svg {...props}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.32 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>;
    case "clock": return <svg {...props}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>;
    case "user": return <svg {...props}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>;
    case "pill": return <svg {...props}><path d="M10.5 1.5L3 9a4.24 4.24 0 0 0 6 6l7.5-7.5a4.24 4.24 0 0 0-6-6z"/><line x1="8.5" y1="8.5" x2="15.5" y2="1.5"/></svg>;
    default: return null;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
//  LIVE CLOCK
// ─────────────────────────────────────────────────────────────────────────────
function LiveClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const days = ["Dim","Lun","Mar","Mer","Jeu","Ven","Sam"];
  const months = ["Janv","Fev","Mars","Avr","Mai","Juin","Juil","Aout","Sept","Oct","Nov","Dec"];
  return (
    <div style={{ display:"flex", alignItems:"center", gap:12, color:"#fff" }}>
      <div style={{ textAlign:"right", lineHeight:1.3 }}>
        <div style={{ fontSize:11, opacity:0.6, fontWeight:500 }}>{days[now.getDay()]} {now.getDate()} {months[now.getMonth()]}</div>
      </div>
      <div style={{ fontSize:22, fontWeight:700, fontFamily:"'Space Mono', monospace", letterSpacing:1 }}>
        {now.toLocaleTimeString("fr-FR", { hour:"2-digit", minute:"2-digit" })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  DOSSIER PANEL
// ─────────────────────────────────────────────────────────────────────────────
const BLOOD_COLORS = { "A+":"#E53E3E","A-":"#FC8181","B+":"#DD6B20","B-":"#F6AD55","AB+":"#805AD5","AB-":"#B794F4","O+":"#2B6CB0","O-":"#63B3ED" };

function DossierPanel({ prescriptions }) {
  const [expanded, setExpanded] = useState(() =>
    Object.fromEntries(DB_PATIENTS.map(p => [p.patient_id, prescriptions.filter(r => r.patient_id === p.patient_id).length > 0]))
  );
  const toggle = (id) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
      {DB_PATIENTS.map(p => {
        const rxList = prescriptions.filter(r => r.patient_id === p.patient_id);
        const allergies = KNOWN_ALLERGIES[p.patient_id] || [];
        const age = new Date().getFullYear() - new Date(p.date_of_birth).getFullYear();
        const urgentRx = rxList.filter(r => r.priorite === "URGENTE" || r.priorite === "STAT");
        const isOpen = !!expanded[p.patient_id];
        

        return (
          <div key={p.patient_id} style={{
            background:CARD, borderRadius:14, border:`1px solid ${isOpen ? ACCENT+"30" : BORDER}`,
            boxShadow: isOpen ? "0 4px 16px rgba(15,76,117,.08)" : "0 1px 4px rgba(0,0,0,.04)",
            overflow:"hidden", transition:"box-shadow .2s, border-color .2s",
          }}>
            {/* ── Patient header ── */}
            <button onClick={() => toggle(p.patient_id)} style={{
              width:"100%", display:"flex", alignItems:"center", gap:14, padding:"16px 20px",
              background:"none", border:"none", cursor:"pointer", fontFamily:"'DM Sans', sans-serif",
              borderBottom: isOpen ? `1px solid ${BORDER}` : "none",
            }}>
              <div style={{
                width:44, height:44, borderRadius:12, flexShrink:0,
                background:(BLOOD_COLORS[p.blood_type] || ACCENT)+"18",
                display:"grid", placeItems:"center",
              }}>
                <span style={{ fontWeight:800, fontSize:12, color:BLOOD_COLORS[p.blood_type] || ACCENT, fontFamily:"'Space Mono', monospace" }}>
                  {p.blood_type}
                </span>
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                  <span style={{ fontWeight:700, fontSize:15, color:"#1A1A2E" }}>
                    {p.gender === "F" ? "Mme" : "M."} {p.first_name} {p.last_name}
                  </span>
                  <span style={{ fontSize:11, color:MUTED, fontFamily:"'Space Mono', monospace" }}>{p.ipp}</span>
                  {allergies.length > 0 && (
                    <span style={{ fontSize:10, fontWeight:700, padding:"2px 7px", borderRadius:5, background:RED+"18", color:RED }}>ALLERGIE</span>
                  )}
                  {urgentRx.length > 0 && (
                    <span style={{ fontSize:10, fontWeight:700, padding:"2px 7px", borderRadius:5, background:AMBER+"18", color:AMBER }}>{urgentRx.length} URGENT</span>
                  )}
                </div>
                <div style={{ fontSize:12, color:MUTED, marginTop:2 }}>
                  {p.ward} · Chambre {p.room} · {age} ans · {p.gender === "F" ? "Femme" : "Homme"}
                </div>
              </div>

              {/* Arrow */}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={MUTED} strokeWidth="2.5"
                strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink:0, transition:"transform .2s", transform: isOpen ? "rotate(180deg)" : "none" }}>
                <path d="M6 9l6 6 6-6"/>
              </svg>
            </button>

            {/* ── Body: info + actes side by side ── */}
            {isOpen && <div style={{ display:"flex", gap:0, flexWrap:"wrap" }}>
              {/* Left: patient details */}
              <div style={{ flex:"0 0 260px", padding:"16px 20px", borderRight:`1px solid ${BORDER}` }}>
                <div style={{ fontWeight:700, fontSize:11, color:MUTED, textTransform:"uppercase", letterSpacing:.5, marginBottom:10 }}>Informations</div>
                <table style={{ fontSize:13, lineHeight:1.9, width:"100%" }}>
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
                        <td style={{ color:MUTED, fontWeight:600, paddingRight:10, whiteSpace:"nowrap", fontSize:12 }}>{k}</td>
                        <td style={{ fontWeight:500 }}>{v}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {allergies.length > 0 && (
                  <div style={{ marginTop:12 }}>
                    <div style={{ fontWeight:700, fontSize:11, color:RED, textTransform:"uppercase", letterSpacing:.5, marginBottom:6 }}>Allergies</div>
                    <div style={{ display:"flex", flexWrap:"wrap", gap:4 }}>
                      {allergies.map(a => (
                        <span key={a} style={{ fontSize:11, fontWeight:600, padding:"3px 8px", borderRadius:5, background:RED+"12", color:RED, textTransform:"capitalize" }}>{a}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Right: actes & ordres */}
              <div style={{ flex:"1 1 300px", padding:"16px 20px" }}>
                <div style={{ fontWeight:700, fontSize:11, color:MUTED, textTransform:"uppercase", letterSpacing:.5, marginBottom:10 }}>
                  Actes & Ordres {rxList.length > 0 && <span style={{ color:ACCENT }}>({rxList.length})</span>}
                </div>
                {rxList.length > 0 ? (
                <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                    {rxList.map(rx => {
                      const prioColor = rx.priorite === "URGENTE" || rx.priorite === "STAT" ? RED : rx.priorite === "NORMALE" ? AMBER : MUTED;
                      return (
                        <div key={rx.prescription_id} style={{
                          display:"flex", alignItems:"flex-start", gap:10, padding:"10px 14px",
                          borderRadius:10, border:`1px solid ${BORDER}`, background:"#FAFBFC",
                        }}>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontWeight:600, fontSize:13 }}>
                              {rx.drug_name_free || rx.examen || rx.action || "—"}
                            </div>
                            {(rx.dosage || rx.route || rx.frequency) && (
                              <div style={{ fontSize:11, color:MUTED, marginTop:2 }}>
                                {[rx.dosage, rx.route, rx.frequency].filter(Boolean).join(" · ")}
                              </div>
                            )}
                            {rx.indication && (
                              <div style={{ fontSize:11, color:MUTED }}>Indication : {rx.indication}</div>
                            )}
                            {rx.allergyAlert && (
                              <div style={{ fontSize:11, fontWeight:700, color:RED, marginTop:3 }}>⚠ {rx.allergyAlert}</div>
                            )}
                          </div>
                          <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:4, flexShrink:0 }}>
                            {rx.priorite && (
                              <span style={{ fontSize:10, fontWeight:700, padding:"2px 7px", borderRadius:5, background:prioColor+"18", color:prioColor }}>{rx.priorite}</span>
                            )}
                            <span style={{ fontSize:10, color:MUTED }}>
                              {rx.is_validated ? "✓ Validé" : rx.is_cancelled ? "Annulé" : "En attente"}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ fontSize:13, color:MUTED, fontStyle:"italic", paddingTop:4 }}>Aucun acte ou ordre enregistré.</div>
                )}
              </div>
            </div>}
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  IMAGERIE PANEL
// ─────────────────────────────────────────────────────────────────────────────
function ImageriePanel() {
  const [filter, setFilter] = useState("Tout");
  const filters = ["Tout", "En attente", "Disponible", "Réalisé"];

  const statusColor = { "En attente": AMBER, "Disponible": GREEN, "Réalisé": MUTED };

  const examIcon = (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={MUTED} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="3"/>
      <circle cx="12" cy="12" r="4"/>
      <path d="M16.5 7.5l.5-.5"/>
    </svg>
  );

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
      {/* Filter bar */}
      <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
        {filters.map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding:"5px 14px", borderRadius:20, border:`1px solid ${filter === f ? ACCENT : BORDER}`,
            background: filter === f ? ACCENT : CARD, color: filter === f ? "#fff" : MUTED,
            fontWeight: filter === f ? 700 : 500, fontSize:12,
            cursor:"pointer", fontFamily:"'DM Sans', sans-serif", transition:"all .15s",
          }}>{f}</button>
        ))}
      </div>

      {DB_PATIENTS.map(p => {
        const examens = DB_IMAGERIE.filter(e =>
          e.patient_id === p.patient_id &&
          (filter === "Tout" || e.status === filter)
        );
        if (examens.length === 0) return null;
        const age = new Date().getFullYear() - new Date(p.date_of_birth).getFullYear();
        const allergies = KNOWN_ALLERGIES[p.patient_id] || [];

        return (
          <div key={p.patient_id} style={{ background:CARD, borderRadius:14, border:`1px solid ${BORDER}`, overflow:"hidden", boxShadow:"0 1px 4px rgba(0,0,0,.04)" }}>
            {/* Patient header */}
            <div style={{ display:"flex", alignItems:"center", gap:14, padding:"14px 20px", borderBottom:`1px solid ${BORDER}` }}>
              <div style={{ width:40, height:40, borderRadius:10, flexShrink:0, background:(BLOOD_COLORS[p.blood_type] || ACCENT)+"18", display:"grid", placeItems:"center" }}>
                <span style={{ fontWeight:800, fontSize:11, color:BLOOD_COLORS[p.blood_type] || ACCENT, fontFamily:"'Space Mono', monospace" }}>{p.blood_type}</span>
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                  <span style={{ fontWeight:700, fontSize:14, color:"#1A1A2E" }}>{p.gender === "F" ? "Mme" : "M."} {p.first_name} {p.last_name}</span>
                  <span style={{ fontSize:11, color:MUTED, fontFamily:"'Space Mono', monospace" }}>{p.ipp}</span>
                  {allergies.length > 0 && <span style={{ fontSize:10, fontWeight:700, padding:"2px 7px", borderRadius:5, background:RED+"18", color:RED }}>ALLERGIE</span>}
                </div>
                <div style={{ fontSize:12, color:MUTED, marginTop:1 }}>{p.ward} · Chambre {p.room} · {age} ans</div>
              </div>
              <span style={{ fontSize:12, color:MUTED, fontWeight:600 }}>{examens.length} examen{examens.length > 1 ? "s" : ""}</span>
            </div>

            {/* Exam grid */}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(280px, 1fr))", gap:12, padding:"14px 20px" }}>
              {examens.map(e => {
                const sColor = statusColor[e.status] || MUTED;
                return (
                  <div key={e.id} style={{ borderRadius:10, border:`1px solid ${BORDER}`, padding:"14px 16px", background:"#FAFBFC", display:"flex", flexDirection:"column", gap:6 }}>
                    <div style={{ display:"flex", alignItems:"flex-start", gap:10 }}>
                      <div style={{ flexShrink:0, marginTop:1 }}>{examIcon}</div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontWeight:700, fontSize:13, color:"#1A1A2E", lineHeight:1.3 }}>{e.type}</div>
                        <div style={{ fontSize:11, color:MUTED, marginTop:2 }}>{new Date(e.date).toLocaleDateString("fr-FR", { day:"numeric", month:"long", year:"numeric" })}</div>
                      </div>
                    </div>
                    <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                      <span style={{ fontSize:10, fontWeight:700, padding:"2px 8px", borderRadius:5, background:sColor+"18", color:sColor }}>{e.status}</span>
                      {e.priority === "URGENTE" && <span style={{ fontSize:10, fontWeight:700, padding:"2px 8px", borderRadius:5, background:RED+"18", color:RED }}>URGENTE</span>}
                    </div>
                    <p style={{ fontSize:12, color:MUTED, margin:0, lineHeight:1.5 }}>{e.description}</p>
                    <div style={{ fontSize:11, color: e.reader ? ACCENT : MUTED, fontWeight: e.reader ? 600 : 400, marginTop:2 }}>
                      {e.reader ? `🔬 ${e.reader}` : "En attente de lecture"}
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

// ─────────────────────────────────────────────────────────────────────────────
//  OBSERVATIONS PANEL
// ─────────────────────────────────────────────────────────────────────────────
function ObservationsPanel() {
  const [expanded, setExpanded] = useState(() =>
    Object.fromEntries(DB_PATIENTS.map(p => [p.patient_id, true]))
  );
  const toggle = (id) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

  const catColor = { "Entrée": ACCENT, "Évolution": MUTED, "Urgence": RED, "Sortie": GREEN };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
      {DB_PATIENTS.map(p => {
        const notes = DB_OBSERVATIONS.filter(o => o.patient_id === p.patient_id);
        const constantes = DB_CONSTANTES.filter(c => c.patient_id === p.patient_id)
          .sort((a, b) => new Date(b.date) - new Date(a.date));
        const allergies = KNOWN_ALLERGIES[p.patient_id] || [];
        const age = new Date().getFullYear() - new Date(p.date_of_birth).getFullYear();
        const isOpen = !!expanded[p.patient_id];

        return (
          <div key={p.patient_id} style={{
            background:CARD, borderRadius:14, border:`1px solid ${isOpen ? ACCENT+"30" : BORDER}`,
            boxShadow: isOpen ? "0 4px 16px rgba(15,76,117,.08)" : "0 1px 4px rgba(0,0,0,.04)",
            overflow:"hidden", transition:"box-shadow .2s, border-color .2s",
          }}>
            {/* Header */}
            <button onClick={() => toggle(p.patient_id)} style={{
              width:"100%", display:"flex", alignItems:"center", gap:14, padding:"16px 20px",
              background:"none", border:"none", cursor:"pointer", fontFamily:"'DM Sans', sans-serif",
              borderBottom: isOpen ? `1px solid ${BORDER}` : "none",
            }}>
              <div style={{ width:44, height:44, borderRadius:12, flexShrink:0, background:(BLOOD_COLORS[p.blood_type] || ACCENT)+"18", display:"grid", placeItems:"center" }}>
                <span style={{ fontWeight:800, fontSize:12, color:BLOOD_COLORS[p.blood_type] || ACCENT, fontFamily:"'Space Mono', monospace" }}>{p.blood_type}</span>
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                  <span style={{ fontWeight:700, fontSize:15, color:"#1A1A2E" }}>{p.gender === "F" ? "Mme" : "M."} {p.first_name} {p.last_name}</span>
                  <span style={{ fontSize:11, color:MUTED, fontFamily:"'Space Mono', monospace" }}>{p.ipp}</span>
                  {allergies.length > 0 && <span style={{ fontSize:10, fontWeight:700, padding:"2px 7px", borderRadius:5, background:RED+"18", color:RED }}>ALLERGIE</span>}
                </div>
                <div style={{ fontSize:12, color:MUTED, marginTop:2 }}>{p.ward} · Chambre {p.room} · {age} ans</div>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={MUTED} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                style={{ flexShrink:0, transition:"transform .2s", transform: isOpen ? "rotate(180deg)" : "none" }}>
                <path d="M6 9l6 6 6-6"/>
              </svg>
            </button>

            {isOpen && (
              <div style={{ display:"flex", gap:0, flexWrap:"wrap" }}>
                {/* Left: Notes cliniques */}
                <div style={{ flex:"1 1 300px", padding:"16px 20px", borderRight:`1px solid ${BORDER}` }}>
                  <div style={{ fontWeight:700, fontSize:11, color:MUTED, textTransform:"uppercase", letterSpacing:.5, marginBottom:12 }}>Notes cliniques</div>
                  <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                    {notes.map(n => {
                      const cc = catColor[n.category] || MUTED;
                      return (
                        <div key={n.id} style={{ padding:"10px 12px", borderRadius:9, border:`1px solid ${BORDER}`, background:"#FAFBFC" }}>
                          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6, flexWrap:"wrap" }}>
                            <span style={{ fontSize:10, fontWeight:700, padding:"2px 8px", borderRadius:5, background:cc+"18", color:cc }}>{n.category}</span>
                            <span style={{ fontSize:11, color:MUTED }}>{new Date(n.date).toLocaleDateString("fr-FR", { day:"numeric", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" })}</span>
                            <span style={{ fontSize:11, fontWeight:600, color:ACCENT }}>{n.author}</span>
                          </div>
                          <p style={{ fontSize:13, color:"#2D3748", margin:0, lineHeight:1.6 }}>{n.text}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Right: Constantes */}
                <div style={{ flex:"0 0 340px", padding:"16px 20px" }}>
                  <div style={{ fontWeight:700, fontSize:11, color:MUTED, textTransform:"uppercase", letterSpacing:.5, marginBottom:12 }}>Constantes vitales</div>
                  <div style={{ overflowX:"auto" }}>
                    <table style={{ fontSize:12, width:"100%", borderCollapse:"collapse" }}>
                      <thead>
                        <tr>
                          {["Date", "TA", "FC", "Temp", "SpO2", "Poids"].map(h => (
                            <th key={h} style={{ fontWeight:700, fontSize:11, color:MUTED, textAlign:"left", padding:"4px 8px 8px", borderBottom:`1px solid ${BORDER}`, whiteSpace:"nowrap" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {constantes.map((c, i) => (
                          <tr key={c.id} style={{ background: i === 0 ? ACCENT+"08" : "transparent" }}>
                            <td style={{ padding:"5px 8px", fontSize:11, color:MUTED, whiteSpace:"nowrap" }}>
                              {new Date(c.date).toLocaleDateString("fr-FR", { day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit" })}
                            </td>
                            {[`${c.ta} mmHg`, `${c.fc} bpm`, `${c.temp} °C`, `${c.spo2}%`, `${c.poids} kg`].map((v, j) => (
                              <td key={j} style={{ padding:"5px 8px", fontWeight: i === 0 ? 700 : 400, color: i === 0 ? "#1A1A2E" : "#2D3748", whiteSpace:"nowrap" }}>{v}</td>
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

// ─────────────────────────────────────────────────────────────────────────────
//  PARAMETRES PANEL
// ─────────────────────────────────────────────────────────────────────────────
function ParametresPanel({ user }) {
  const [fontSize, setFontSize] = useState(14);
  const [density, setDensity]   = useState("Normal");

  if (!user) return null;

  const perms = ACCESS_PERMISSIONS[user.access_level] || [];

  const sectionTitle = (label) => (
    <div style={{ fontWeight:700, fontSize:13, color:ACCENT, textTransform:"uppercase", letterSpacing:.8, padding:"18px 0 10px", borderBottom:`2px solid ${ACCENT}22`, marginBottom:14 }}>
      {label}
    </div>
  );

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:0, maxWidth:760 }}>

      {/* ── 1. Profil utilisateur ── */}
      {sectionTitle("Profil utilisateur")}
      <div style={{ background:CARD, borderRadius:12, border:`1px solid ${BORDER}`, padding:"20px 24px", marginBottom:20 }}>
        <table style={{ fontSize:13, lineHeight:2.1, width:"100%" }}>
          <tbody>
            {[
              ["Nom complet",     `${user.title ? user.title + " " : ""}${user.first_name} ${user.last_name}`.trim() || "—"],
              ["N° employé",      user.employee_number],
              ["Rôle",            user.role_label],
              ["Service",         user.dept],
              ["Spécialité",      user.specialty || "—"],
              ["Niveau d'accès",  `Niveau ${user.access_level}`],
            ].map(([k, v]) => (
              <tr key={k}>
                <td style={{ color:MUTED, fontWeight:600, paddingRight:20, whiteSpace:"nowrap", fontSize:12, width:160 }}>{k}</td>
                <td style={{ fontWeight:500, color:"#1A1A2E" }}>{v}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Biométrie */}
        <div style={{ marginTop:14, display:"flex", alignItems:"center", gap:8 }}>
          <span style={{ fontSize:12, color:MUTED, fontWeight:600 }}>Biométrie :</span>
          <span style={{ fontSize:11, fontWeight:700, padding:"3px 10px", borderRadius:20, background: user.biometric_enrolled ? GREEN+"18" : MUTED+"18", color: user.biometric_enrolled ? GREEN : MUTED }}>
            {user.biometric_enrolled ? "✓ Enrôlée" : "Non enrôlée"}
          </span>
        </div>

        {/* Permissions */}
        <div style={{ marginTop:16 }}>
          <div style={{ fontWeight:700, fontSize:11, color:MUTED, textTransform:"uppercase", letterSpacing:.5, marginBottom:8 }}>Permissions accordées</div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
            {perms.map(perm => (
              <span key={perm} style={{ fontSize:11, fontWeight:600, padding:"4px 10px", borderRadius:6, background:GREEN+"15", color:GREEN, border:`1px solid ${GREEN}30` }}>
                {PERM_LABELS[perm] || perm}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── 2. Préférences d'affichage ── */}
      {sectionTitle("Préférences d'affichage")}
      <div style={{ background:CARD, borderRadius:12, border:`1px solid ${BORDER}`, padding:"20px 24px", marginBottom:20 }}>
        <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
          {/* Font size */}
          <div style={{ display:"flex", alignItems:"center", gap:16, flexWrap:"wrap" }}>
            <span style={{ fontSize:13, fontWeight:600, color:"#1A1A2E", minWidth:160 }}>Taille de texte</span>
            <div style={{ display:"flex", gap:4 }}>
              {[{ label:"S", val:13 }, { label:"M", val:14 }, { label:"L", val:15 }].map(({ label, val }) => (
                <button key={val} onClick={() => setFontSize(val)} style={{
                  width:36, height:36, borderRadius:8, border:`1px solid ${fontSize === val ? ACCENT : BORDER}`,
                  background: fontSize === val ? ACCENT : "transparent",
                  color: fontSize === val ? "#fff" : MUTED,
                  fontWeight:700, fontSize: label === "S" ? 11 : label === "M" ? 13 : 15,
                  cursor:"pointer", fontFamily:"'DM Sans', sans-serif",
                }}>{label}</button>
              ))}
            </div>
          </div>
          {/* Density */}
          <div style={{ display:"flex", alignItems:"center", gap:16, flexWrap:"wrap" }}>
            <span style={{ fontSize:13, fontWeight:600, color:"#1A1A2E", minWidth:160 }}>Densité d'affichage</span>
            <div style={{ display:"flex", gap:4 }}>
              {["Compact", "Normal"].map(d => (
                <button key={d} onClick={() => setDensity(d)} style={{
                  padding:"6px 18px", borderRadius:8, border:`1px solid ${density === d ? ACCENT : BORDER}`,
                  background: density === d ? ACCENT : "transparent",
                  color: density === d ? "#fff" : MUTED,
                  fontWeight: density === d ? 700 : 500, fontSize:12,
                  cursor:"pointer", fontFamily:"'DM Sans', sans-serif",
                }}>{d}</button>
              ))}
            </div>
          </div>
        </div>
        <div style={{ marginTop:14, fontSize:11, color:MUTED, fontStyle:"italic" }}>
          Les préférences sont réinitialisées à la déconnexion.
        </div>
      </div>

      {/* ── 3. Configuration système ── */}
      {sectionTitle("Configuration système")}
      <div style={{ background:CARD, borderRadius:12, border:`1px solid ${BORDER}`, padding:"20px 24px" }}>
        <table style={{ fontSize:13, lineHeight:2.1, width:"100%" }}>
          <tbody>
            {[
              ["URL API",       "http://localhost:3001"],
              ["Modèle LLM",    "llama-3.3-70b-versatile (Groq)"],
              ["Projet",        "SILLAGE — CRIStAL × Centrale Lille"],
              ["Version",       "1.0.0"],
              ["Environnement", "Développement"],
            ].map(([k, v]) => (
              <tr key={k}>
                <td style={{ color:MUTED, fontWeight:600, paddingRight:20, whiteSpace:"nowrap", fontSize:12, width:160 }}>{k}</td>
                <td style={{ fontWeight:500, color:"#1A1A2E", fontFamily: k === "URL API" || k === "Modèle LLM" ? "'Space Mono', monospace" : "inherit", fontSize: k === "URL API" || k === "Modèle LLM" ? 12 : 13 }}>{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  TABS
// ─────────────────────────────────────────────────────────────────────────────
const tabs = [
  { id:"nlp", label:"NLP Contextuel", iconType:"chat" },
  { id:"rx",  label:"Actes & Ordres", iconType:"file" },
];

const subTabs = [
  { id:"dossier",      label:"Dossier",      iconType:"folder"   },
  { id:"observations", label:"Observations", iconType:"eye"      },
  { id:"imagerie",     label:"Imagerie",     iconType:"image"    },
  { id:"parametres",   label:"Paramètres",   iconType:"settings" },
];

// ─────────────────────────────────────────────────────────────────────────────
//  ROOT COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function SmartUXBots() {
  const [authenticatedUser, setAuthenticatedUser] = useState(null);
  const [activeTab, setActiveTab]       = useState("nlp");
  const [activeSubTab, setActiveSubTab] = useState(null);
  // Shared prescriptions store (written by NLPBot, read by RxTab)
  const [prescriptions, setPrescriptions] = useState([]);

  useEffect(() => {
    fetch("http://localhost:3001/api/prescriptions")
      .then(r => r.json())
      .then(data => setPrescriptions(data))
      .catch(() => {});
  }, []);

  const addPrescription = useCallback((rx) => {
    setPrescriptions(prev => [rx, ...prev]);
  }, []);

  const updatePrescription = useCallback(async (id, changes) => {
    await fetch(`http://localhost:3001/api/prescriptions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(changes),
    });
    setPrescriptions(prev => prev.map(rx => rx.prescription_id === id ? {...rx,...changes} : rx));
  }, []);

  // Badge counts for Rx tab
  const rxActive = prescriptions.filter(r => !r.is_validated && !r.is_cancelled);
  const rxUrgent = rxActive.filter(r => r.priorite === "URGENTE" || r.priorite === "STAT").length;
  const rxPending = rxActive.filter(r => r.priorite !== "URGENTE" && r.priorite !== "STAT").length;
  const now30 = new Date(Date.now() + 30*60*1000);
  const rxExpiring = rxActive.filter(r => r.echeance && new Date(r.echeance) > new Date() && new Date(r.echeance) <= now30).length;

  if (!authenticatedUser) {
    return (
      <div style={{ minHeight:"100vh", background:BG, fontFamily:"'DM Sans', sans-serif", color:"#1A1A2E", display:"flex", flexDirection:"column" }}>
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;0,9..40,800&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet" />
        <style>{`*{box-sizing:border-box}body{margin:0}@keyframes spin{to{transform:rotate(360deg)}}@keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}`}</style>
        {/* Auth gate header */}
        <div style={{ background:"#1B3A54", padding:"14px 24px", display:"flex", alignItems:"center", gap:8, borderBottom:"2px solid #0F2B40" }}>
          <span style={{ color:"#fff", fontWeight:800, fontSize:17 }}>Smart</span>
          <span style={{ color:ACCENT2, fontWeight:800, fontSize:17 }}>UX</span>
          <span style={{ color:"rgba(255,255,255,.35)", fontWeight:500, fontSize:12, marginLeft:2 }}>AI</span>
          <span style={{ marginLeft:16, fontSize:12, color:"rgba(255,255,255,.5)", fontWeight:500 }}>— Authentification requise</span>
        </div>
        <div style={{ flex:1, display:"flex", alignItems:"flex-start", justifyContent:"center", padding:"32px 16px" }}>
          <div style={{ width:"100%", maxWidth:900, animation:"fadeIn .3s ease both" }}>
            <BioBot onAuth={setAuthenticatedUser} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight:"100vh", background:BG, fontFamily:"'DM Sans', sans-serif", color:"#1A1A2E" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;0,9..40,800&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet" />

      <style>{`
        *{box-sizing:border-box}
        body{margin:0}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        @keyframes tabIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes voicePulse{0%,100%{opacity:1;box-shadow:0 0 0 0 rgba(239,68,68,.4)}50%{opacity:.7;box-shadow:0 0 0 6px rgba(239,68,68,0)}}
        .tab-content{animation:tabIn .22s ease both}
        .rx-card{transition:box-shadow .2s,transform .15s}
        .rx-card:hover{box-shadow:0 6px 28px rgba(15,76,117,.10);transform:translateY(-1px)}
        .sillage-tab:hover{background:rgba(255,255,255,.12) !important}
        .sillage-subtab:hover{background:#E8EDF2 !important}
      `}</style>

      {/* ── TOP BAR (Sillage-style dark blue) ──────────────────────────────── */}
      <header style={{
        background:"#1B3A54",
        position:"sticky", top:0, zIndex:200,
        borderBottom:"2px solid #0F2B40",
      }}>
        {/* Row 1: Brand left + Icons left-center + Clock right */}
        <div style={{ display:"flex", alignItems:"center", padding:"0 16px", minHeight:52, gap:0 }}>

          {/* Left: Title + icons */}
          <div style={{ display:"flex", alignItems:"center", gap:14, flex:1 }}>
            {/* App name */}
            <div style={{ display:"flex", alignItems:"baseline", gap:5, marginRight:16 }}>
              <span style={{ color:"#fff", fontWeight:800, fontSize:17, letterSpacing:-0.3 }}>Smart</span>
              <span style={{ color:ACCENT2, fontWeight:800, fontSize:17, letterSpacing:-0.3 }}>UX</span>
              <span style={{ color:"rgba(255,255,255,.35)", fontWeight:500, fontSize:12, marginLeft:2 }}>AI</span>
            </div>

            {/* 3 main module icons — left-aligned */}
            <div style={{ display:"flex", gap:2 }}>
              {tabs.map(t => {
                const active = activeTab === t.id;
                const badgeCount = t.id === "rx" ? (rxUrgent + rxPending) : 0;
                return (
                  <button key={t.id} className="sillage-tab" onClick={() => { setActiveTab(t.id); setActiveSubTab(null); }} style={{
                    display:"flex", alignItems:"center", gap:6,
                    padding:"7px 14px", borderRadius:4, border:"none",
                    fontFamily:"'DM Sans', sans-serif", fontWeight: active ? 700 : 500, fontSize:12,
                    cursor:"pointer", position:"relative",
                    background: active ? "rgba(255,255,255,.18)" : "transparent",
                    color: active ? "#fff" : "rgba(255,255,255,.6)",
                    transition:"all .15s",
                  }}>
                    <Icon type={t.iconType} size={14} color={active ? "#fff" : "rgba(255,255,255,.55)"} />
                    {t.label}
                    {badgeCount > 0 && (
                      <span style={{
                        position:"absolute", top:-3, right:-3,
                        minWidth:16, height:16, borderRadius:8, padding:"0 4px",
                        background: rxUrgent > 0 ? RED : AMBER, color:"#fff", fontSize:9, fontWeight:700,
                        display:"grid", placeItems:"center",
                        boxShadow:"0 1px 3px rgba(0,0,0,.3)",
                      }}>{badgeCount}</span>
                    )}
                    {rxExpiring > 0 && t.id === "rx" && (
                      <span style={{
                        position:"absolute", top:-3, right: badgeCount > 0 ? 12 : -3,
                        minWidth:16, height:16, borderRadius:8, padding:"0 4px",
                        background:"#F97316", color:"#fff", fontSize:9, fontWeight:700,
                        display:"grid", placeItems:"center",
                        boxShadow:"0 1px 3px rgba(0,0,0,.3)",
                      }}>{rxExpiring}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right: Clock + status */}
          <div style={{ display:"flex", alignItems:"center", gap:16, flexShrink:0 }}>
            <div style={{ display:"flex", alignItems:"center", gap:6 }}>
              <div style={{ width:7, height:7, borderRadius:"50%", background:GREEN, boxShadow:`0 0 6px ${GREEN}` }} />
              <span style={{ fontSize:11, color:"rgba(255,255,255,.5)", fontWeight:500 }}>En ligne</span>
            </div>
            <div style={{ width:1, height:24, background:"rgba(255,255,255,.12)" }} />
            <LiveClock />
            <div style={{ width:1, height:24, background:"rgba(255,255,255,.12)", marginLeft:8 }} />
            {/* Logged-in user chip */}
            <div style={{ display:"flex", alignItems:"center", gap:8, marginLeft:4 }}>
              <div style={{ display:"flex", alignItems:"center", gap:6, padding:"4px 10px", borderRadius:20, background:"rgba(255,255,255,.12)" }}>
                <div style={{ width:22, height:22, borderRadius:"50%", background:GREEN, display:"grid", placeItems:"center" }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                </div>
                <span style={{ fontSize:12, fontWeight:600, color:"#fff" }}>
                  {authenticatedUser.title ? `${authenticatedUser.title} ` : ""}{authenticatedUser.first_name} {authenticatedUser.last_name}
                </span>
                <span style={{ fontSize:10, color:"rgba(255,255,255,.5)", fontWeight:500 }}>Niv.{authenticatedUser.access_level}</span>
              </div>
              <button onClick={() => setAuthenticatedUser(null)} style={{ background:"none", border:"none", cursor:"pointer", padding:"4px 8px", borderRadius:6, color:"rgba(255,255,255,.5)", fontSize:11, fontWeight:600, fontFamily:"'DM Sans', sans-serif" }}
                title="Se déconnecter">
                ✕
              </button>
            </div>
          </div>
        </div>

        {/* Row 2: Sub-tabs (Sillage-style tab bar) */}
        <div style={{
          background:"#D6DDE4",
          borderTop:"1px solid #B8C4CF",
          display:"flex", alignItems:"center", padding:"0 16px",
          gap:1, overflowX:"auto",
        }}>
          {subTabs.map(st => {
            const active = activeSubTab === st.id;
            return (
              <button key={st.id} className="sillage-subtab" onClick={() => setActiveSubTab(active ? null : st.id)} style={{
                display:"flex", alignItems:"center", gap:5,
                padding:"7px 13px", border:"none", borderBottom: active ? "2px solid #1B3A54" : "2px solid transparent",
                fontFamily:"'DM Sans', sans-serif", fontWeight: active ? 700 : 500, fontSize:12,
                cursor:"pointer",
                background: active ? "#F0F4F8" : "transparent",
                color: active ? "#1B3A54" : "#556677",
                transition:"all .12s",
                borderRadius:"4px 4px 0 0",
                whiteSpace:"nowrap",
              }}>
                <Icon type={st.iconType} size={13} color={active ? "#1B3A54" : "#7A8A99"} />
                {st.label}
              </button>
            );
          })}
        </div>
      </header>

      {/* ── MAIN ───────────────────────────────────────────────────────────── */}
      <main style={{ maxWidth:["dossier","observations","imagerie","parametres"].includes(activeSubTab) ? 1380 : 1000, margin:"0 auto", padding:"32px 24px 80px" }}>

        {["dossier","observations","imagerie","parametres"].includes(activeSubTab) ? (
          /* ── Two-column: panel + NLP sidebar ── */
          <div style={{ display:"flex", gap:20, alignItems:"flex-start" }}>

            {/* Panel */}
            <div style={{ flex:1, minWidth:0, animation:"tabIn .22s ease both" }}>
              {activeSubTab === "dossier"      && <DossierPanel prescriptions={prescriptions} />}
              {activeSubTab === "observations" && <ObservationsPanel />}
              {activeSubTab === "imagerie"     && <ImageriePanel />}
              {activeSubTab === "parametres"   && <ParametresPanel user={authenticatedUser} />}
            </div>

            {/* NLP assistant sidebar */}
            <div style={{ width:360, flexShrink:0, position:"sticky", top:110 }}>
              <NLPBot onPrescription={addPrescription} compact />
            </div>
          </div>

        ) : (
          /* ── Normal layout ── */
          <>
            {activeSubTab && (
              <div style={{
                background:CARD, borderRadius:12, border:`1px solid ${BORDER}`,
                padding:"24px 28px", marginBottom:24,
                boxShadow:"0 2px 10px rgba(0,0,0,.04)",
              }}>
                <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
                  <Icon type={subTabs.find(s => s.id === activeSubTab)?.iconType || "folder"} size={18} color={ACCENT} />
                  <span style={{ fontWeight:700, fontSize:16, color:ACCENT }}>
                    {subTabs.find(s => s.id === activeSubTab)?.label}
                  </span>
                </div>
                <div style={{ color:MUTED, fontSize:13, lineHeight:1.6 }}>
                  Module en cours de développement — Ce panneau sera connecté au système SILLAGE pour afficher les données de {subTabs.find(s => s.id === activeSubTab)?.label.toLowerCase()}.
                </div>
              </div>
            )}
            <div className="tab-content" key={activeTab}>
              {activeTab === "nlp" && <NLPBot onPrescription={addPrescription} />}
              {activeTab === "rx"  && <RxTab prescriptions={prescriptions} onUpdate={updatePrescription} />}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  NLP BOT
// ─────────────────────────────────────────────────────────────────────────────
function NLPBot({ onPrescription, compact = false }) {
  const [input, setInput]         = useState("");
  const [history, setHistory]     = useState([]);
  const [loading, setLoading]     = useState(false);
  const [saved, setSaved]         = useState({}); // prescription_id → true
  const [pendingDelay, setPendingDelay] = useState(null); // { rx } — waiting for delay answer
  const bottomRef = useRef(null);

  const examples = [
    "Prescrire 500mg de Doliprane per os toutes les 6h pour le patient Dupont",
    "Mme Lefevre signale une allergie à la pénicilline — mettre en dossier urgent",
    "Radiographie thoracique en urgence pour le patient Hakimi chambre 201",
    "Transfert du patient Tremblay de cardiologie vers réanimation, priorité haute",
    "Injecter 4000UI de Lovenox en SC pour Morin — indication TVP",
  ];

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:"smooth" }); }, [history]);

  const send = useCallback(async (text) => {
    if (!text.trim()) return;

    // ── Handle delay answer ──────────────────────────────────────────────────
    if (pendingDelay) {
      const userText = text.trim();
      setHistory(h => [...h, { role:"user", text:userText }]);
      setInput("");
      const echeance = parseDelay(userText);
      const updatedRx = { ...pendingDelay.rx, echeance };
      // Update the last bot message's rx with the echeance
      setHistory(h => h.map((m, i) =>
        (m.role === "bot" && i === h.length - 2) ? { ...m, rx: updatedRx } : m
      ));
      const delayLabel = echeance
        ? `Délai enregistré : ${userText} — échéance le ${new Date(echeance).toLocaleString("fr-FR", { day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit" })}`
        : "Aucun délai défini pour cet acte.";
      setHistory(h => [...h, { role:"bot-info", text:delayLabel, rx:updatedRx }]);
      setPendingDelay(null);
      return;
    }

    // ── Normal NLP flow ──────────────────────────────────────────────────────
    const { corrected, corrections } = autoCorrect(text.trim());
    setHistory(h => [...h, {
      role:"user", text:corrected,
      corrections: corrections.length > 0 ? corrections : null,
    }]);
    setInput("");
    setLoading(true);
    const structured = await parseWithClaude(corrected);
    const rx = mapNLPToPrescription(structured, corrected);
    setHistory(h => [...h, { role:"bot", text:structured, rx }]);
    // Ask for delay
    setHistory(h => [...h, { role:"bot-question", text:"Quel est le délai imparti pour cet acte ? (ex : 2h, 24h, 3 jours, ou « aucun »)" }]);
    setPendingDelay({ rx });
    setLoading(false);
  }, [pendingDelay]);

  const handleSave = async (rx) => {
    await fetch("http://localhost:3001/api/prescriptions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(rx),
    });
    onPrescription(rx);
    setSaved(s => ({ ...s, [rx.prescription_id]: true }));
  };
  return (
    <div style={compact ? {
      background:CARD, borderRadius:14, border:`1px solid ${BORDER}`,
      boxShadow:"0 4px 20px rgba(15,76,117,.09)", display:"flex", flexDirection:"column", overflow:"hidden",
    } : {}}>

      {/* Compact header */}
      {compact && (
        <div style={{ padding:"13px 16px", borderBottom:`1px solid ${BORDER}`, background:ACCENT+"08", display:"flex", alignItems:"center", gap:10, flexShrink:0 }}>
          <div style={{ width:32, height:32, borderRadius:9, background:ACCENT2+"18", display:"grid", placeItems:"center", flexShrink:0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={ACCENT2} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
          </div>
          <div>
            <div style={{ fontWeight:700, fontSize:13, color:ACCENT }}>Assistant IA</div>
            <div style={{ fontSize:11, color:MUTED }}>Aide clinique contextuelle</div>
          </div>
        </div>
      )}

      {/* Examples — hidden in compact mode */}
      {!compact && (
        <div style={{ marginBottom:16, display:"flex", flexWrap:"wrap", gap:6 }}>
          <span style={{ fontSize:12, color:MUTED, marginRight:4, paddingTop:4 }}>Exemples :</span>
          {examples.map((ex,i) => (
            <button key={i} onClick={() => setInput(ex)} style={{
              padding:"5px 12px", borderRadius:20, border:"1px solid #D1D5DB",
              background:"#fff", fontSize:12, color:"#374151", cursor:"pointer",
              fontFamily:"'DM Sans', sans-serif",
              maxWidth:300, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis",
            }}>{ex}</button>
          ))}
        </div>
      )}

      {/* Chat area */}
      <div style={{
        background:CARD,
        borderRadius: compact ? 0 : 16,
        border: compact ? "none" : `1px solid ${BORDER}`,
        minHeight: compact ? 220 : 340,
        maxHeight: compact ? 420 : 520,
        overflowY:"auto", padding:"16px 18px", display:"flex", flexDirection:"column", gap:14,
        boxShadow: compact ? "none" : "0 2px 12px rgba(0,0,0,.04)",
      }}>
        {history.length === 0 && (
          <div style={{ flex:1, display:"grid", placeItems:"center", color:"#CBD5E1", fontSize:14 }}>
            Commencez à saisir une phrase pour voir l'extraction NLP et l'enregistrement en base…
          </div>
        )}
        {history.map((m, i) => m.role === "user" ? (
          <div key={i} style={{ alignSelf:"flex-end", maxWidth:"80%" }}>
            <div style={{ background:ACCENT, color:"#fff", padding:"10px 16px", borderRadius:"14px 14px 4px 14px", fontSize:14, lineHeight:1.5 }}>
              {m.text}
            </div>
            {m.corrections && (
              <div style={{ fontSize:11, color:AMBER, marginTop:3, textAlign:"right" }}>
                Corrigé : {m.corrections.map(c => `"${c.from}" → "${c.to}"`).join(", ")}
              </div>
            )}
          </div>
        ) : m.role === "bot-question" ? (
          /* ── Question délai ── */
          <div key={i} style={{ alignSelf:"flex-start", background:AMBER+"18", border:`1.5px solid ${AMBER}44`, borderRadius:"14px 14px 14px 4px", padding:"12px 18px", maxWidth:"80%", fontSize:14, color:"#334155" }}>
            <span style={{ fontWeight:700, color:AMBER, marginRight:8 }}>Délai imparti</span>
            {m.text}
          </div>
        ) : m.role === "bot-info" ? (
          /* ── Confirmation délai ── */
          <div key={i} style={{ alignSelf:"flex-start", background:GREEN+"12", border:`1px solid ${GREEN}44`, borderRadius:"14px 14px 14px 4px", padding:"10px 16px", maxWidth:"80%", fontSize:13, color:"#334155" }}>
            {m.text}
            {/* Show save button after delay is set */}
            {m.rx && !saved[m.rx.prescription_id] && (
              <div style={{ marginTop:10, display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
                <Btn variant="green" style={{ padding:"7px 16px", fontSize:12 }} onClick={() => handleSave(m.rx)}>
                  Enregistrer dans SILLAGE
                </Btn>
                <button onClick={() => exportPDF(m.rx)} style={{ padding:"7px 14px", borderRadius:8, border:`1px solid ${ACCENT}`, background:"#fff", color:ACCENT, fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:"'DM Sans', sans-serif" }}>
                   PDF
                </button>
                <span style={{ fontSize:11, color:MUTED }}>
                  {JSON.parse(m.rx.nlp_fields_auto || "[]").length} champs auto-remplis
                </span>
              </div>
            )}
            {m.rx && saved[m.rx.prescription_id] && (
              <div style={{ marginTop:8, display:"flex", gap:8, alignItems:"center" }}>
                <span style={{ fontSize:12, color:GREEN, fontWeight:600 }}>✓ Enregistré dans SILLAGE</span>
                <button onClick={() => exportPDF(m.rx)} style={{ padding:"5px 12px", borderRadius:7, border:`1px solid ${ACCENT}`, background:"#fff", color:ACCENT, fontSize:11, fontWeight:600, cursor:"pointer", fontFamily:"'DM Sans', sans-serif" }}>
                   Exporter PDF
                </button>
              </div>
            )}
          </div>
        ) : (
          <div key={i} style={{ alignSelf:"flex-start", maxWidth:"96%" }}>
            <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:8, flexWrap:"wrap" }}>
              <Badge color={ACCENT2}>Données structurées extraites</Badge>
              {m.rx?._matched_patient && <Badge color={GREEN} small>{m.rx._matched_patient.first_name} {m.rx._matched_patient.last_name}</Badge>}
              {m.rx?._matched_drug    && <Badge color={ACCENT} small>{m.rx._matched_drug.brand}</Badge>}
              {m.rx?.nlp_confidence   && <Badge color={m.rx.nlp_confidence==="HIGH" ? GREEN : m.rx.nlp_confidence==="MEDIUM" ? AMBER : RED} small>Conf. {m.rx.nlp_confidence}</Badge>}
            </div>

            {/* Allergy alert */}
            {m.rx?.allergyAlert && (
              <div style={{ background:RED+"15", border:`1px solid ${RED}40`, borderRadius:8, padding:"8px 14px", marginBottom:8, color:RED, fontWeight:700, fontSize:13 }}>
                {m.rx.allergyAlert}
              </div>
            )}

            {/* Extracted data table */}
            <div style={{ background:"#F8FAFC", border:"1px solid #E2E8F0", borderRadius:10, padding:14, fontFamily:"'Space Mono', monospace", fontSize:12, lineHeight:1.6, overflowX:"auto" }}>
              {typeof m.text === "object" ? (
                <table style={{ borderCollapse:"collapse", width:"100%" }}>
                  <tbody>
                    {Object.entries(m.text).map(([k,v]) => (
                      <tr key={k}>
                        <td style={{ padding:"4px 12px 4px 0", fontWeight:700, color:ACCENT, whiteSpace:"nowrap", verticalAlign:"top" }}>{k}</td>
                        <td style={{ padding:"4px 0", color:"#334155" }}>{typeof v === "object" ? JSON.stringify(v) : String(v)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : <pre style={{ margin:0 }}>{JSON.stringify(m.text, null, 2)}</pre>}
            </div>

            {/* Prescription preview — shown but save disabled until delay is answered */}
            {m.rx && !m.text.erreur && (
              <div style={{ marginTop:10, border:"1px solid #E2E8F0", borderRadius:10, overflow:"hidden" }}>
                <div style={{ background:ACCENT+"08", padding:"10px 14px", display:"flex", alignItems:"center", justifyContent:"space-between", gap:8 }}>
                  <span style={{ fontSize:12, fontWeight:700, color:ACCENT }}>Aperçu — Ligne de prescription générée</span>
                  <span style={{ fontSize:11, color:MUTED }}>→ table prescriptions</span>
                </div>
                <div style={{ padding:"10px 14px", display:"flex", flexWrap:"wrap", gap:"6px 16px" }}>
                  {[
                    ["Patient",   m.rx.patient_name_free],
                    ["Médicament",m.rx.drug_name_free],
                    ["Dose",      m.rx.dosage],
                    ["Forme",     m.rx.form],
                    ["Voie",      m.rx.route],
                    ["Fréquence", m.rx.frequency],
                    ["Diagnostic",m.rx.diagnostic],
                    ["Service",   m.rx.service],
                    ["Chambre",   m.rx.chambre],
                    ["Priorité",  m.rx.priorite],
                    ["Allergie",  m.rx.allergie_signalee],
                    ["Action",    m.rx.action],
                  ].filter(([,v]) => v).map(([label, val]) => (
                    <span key={label} style={{ fontSize:12, color:"#334155" }}>
                      <span style={{ fontWeight:600, color:MUTED }}>{label} : </span>{val}
                    </span>
                  ))}
                </div>
                <div style={{ padding:"8px 14px 12px", borderTop:"1px solid #F1F5F9", display:"flex", gap:8, alignItems:"center" }}>
                  <span style={{ fontSize:12, color:AMBER, fontStyle:"italic", flex:1 }}>En attente du délai imparti…</span>
                  <button onClick={() => exportPDF(m.rx)} style={{ padding:"5px 12px", borderRadius:7, border:`1px solid ${ACCENT}`, background:"#fff", color:ACCENT, fontSize:11, fontWeight:600, cursor:"pointer", fontFamily:"'DM Sans', sans-serif" }}>
                     PDF
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div style={{ display:"flex", gap:8, alignItems:"center" }}>
            <div className="loader" />
            <span style={{ fontSize:13, color:MUTED }}>Analyse NLP en cours…</span>
            <style>{`.loader{width:18px;height:18px;border:2.5px solid #E5E7EB;border-top-color:${ACCENT2};border-radius:50%;animation:spin .7s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input bar with autocomplete */}
      <div style={{
        display:"flex", gap:8, alignItems:"flex-start",
        marginTop: compact ? 0 : 14,
        padding: compact ? "12px 16px" : 0,
        borderTop: compact ? `1px solid ${BORDER}` : "none",
        background: compact ? CARD : "transparent",
        flexShrink: 0,
      }}>
        <AutocompleteInput
          value={input}
          onChange={setInput}
          onSubmit={send}
          loading={loading}
          placeholder={pendingDelay ? "Saisissez le délai imparti…" : compact ? "Posez votre question…" : undefined}
        />
        {compact ? (
          <button onClick={() => send(input)} disabled={loading || !input.trim()} style={{
            width:38, height:38, borderRadius:10, border:"none", flexShrink:0,
            background: (loading || !input.trim()) ? BORDER : ACCENT,
            color:"#fff", cursor: (loading || !input.trim()) ? "not-allowed" : "pointer",
            display:"grid", placeItems:"center", transition:"background .15s",
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
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

// ─────────────────────────────────────────────────────────────────────────────
//  ACTES & ORDRES TAB
// ─────────────────────────────────────────────────────────────────────────────
function RxTab({ prescriptions, onUpdate }) {
  const now = new Date();
  const THIRTY_MIN = 30 * 60 * 1000;

  // Deadline helpers
  const isOverdue      = (rx) => rx.echeance && new Date(rx.echeance) < now;
  const expiresSoon    = (rx) => rx.echeance && !isOverdue(rx) &&
    (new Date(rx.echeance) - now) <= THIRTY_MIN;
  const formatDeadline = (iso) => {
    const d = new Date(iso);
    const diff = d - now;
    if (diff < 0) {
      const mins = Math.round(-diff / 60000);
      return mins < 60 ? `Dépassé depuis ${mins} min` : `Dépassé depuis ${Math.round(mins/60)} h`;
    }
    const mins = Math.round(diff / 60000);
    if (mins < 60) return `${mins} min restantes`;
    if (mins < 1440) return `${Math.round(mins/60)} h restantes`;
    return d.toLocaleDateString("fr-FR", { day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit" });
  };

  const active = prescriptions.filter(r => !r.is_validated && !r.is_cancelled);

  const expiring = useMemo(() =>
    active.filter(r => expiresSoon(r)),
    [prescriptions, now]);

  const urgent = useMemo(() =>
    active.filter(r => !expiresSoon(r) && (r.priorite === "URGENTE" || r.priorite === "STAT")),
    [prescriptions]);

  const todo = useMemo(() =>
    active.filter(r => !expiresSoon(r) && r.priorite !== "URGENTE" && r.priorite !== "STAT"),
    [prescriptions]);

  const done = useMemo(() =>
    prescriptions.filter(r => r.is_validated || r.is_cancelled),
    [prescriptions]);

  const doneOverdue  = useMemo(() => done.filter(r => r.echeance && new Date(r.echeance) < new Date(r.validated_at || r.created_at)), [done]);
  const doneOnTime   = useMemo(() => done.filter(r => !r.echeance || new Date(r.echeance) >= new Date(r.validated_at || r.created_at)), [done]);

  const prioBadgeColor = (p) => p === "STAT" ? RED : p === "URGENTE" ? AMBER : ACCENT;

  // ── Reusable card ──────────────────────────────────────────────────────────
  const RxCard = ({ rx, isUrgent, isExpiring }) => {
    const overdue  = isOverdue(rx);
    const soon     = expiresSoon(rx);
    const borderColor = isExpiring || soon ? "#F59E0B66"
                      : isUrgent || overdue ? RED + "44"
                      : rx.is_validated ? GREEN + "40" : "#E5E7EB";
    const headBg   = isExpiring || soon ? AMBER + "10"
                   : isUrgent || overdue ? RED + "07" : "transparent";
    return (
    <div className="rx-card" style={{
      background: CARD,
      borderRadius: 16,
      border: `1px solid ${rx.allergyAlert ? RED+"60" : borderColor}`,
      overflow: "hidden",
    }}>
      {/* Allergy alert banner */}
      {rx.allergyAlert && (
        <div style={{ background:RED, padding:"6px 18px", color:"#fff", fontSize:12, fontWeight:700 }}>
          {rx.allergyAlert}
        </div>
      )}
      {/* Header */}
      <div style={{
        padding: "11px 18px",
        display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
        borderBottom: "1px solid #F1F5F9",
        background: headBg,
      }}>
        <div style={{ fontWeight: 700, fontSize: 14, flex: 1 }}>
          {rx.drug_name_free || rx.examen || rx.action || "Acte non précisé"}
        </div>
        {rx.priorite && <Badge color={prioBadgeColor(rx.priorite)} small>{rx.priorite}</Badge>}
        {overdue && !rx.is_validated && !rx.is_cancelled && <Badge color={RED} small>Délai dépassé</Badge>}
        {(soon && !overdue) && <Badge color={AMBER} small>Expire bientôt</Badge>}
        {rx.is_validated
          ? <Badge color={GREEN} small>Validé</Badge>
          : rx.is_cancelled
          ? <Badge color={MUTED} small>Annulé</Badge>
          : <Badge color={AMBER} small>En attente</Badge>
        }
        <span style={{ fontSize: 11, color: MUTED }}>
          {new Date(rx.created_at).toLocaleString("fr-FR")}
        </span>
      </div>

      {/* Fields */}
      <div style={{ padding: "12px 18px", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "6px 20px" }}>
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

      {/* NLP phrase + actions */}
      <div style={{ padding: "8px 18px 12px", borderTop: "1px solid #F8FAFC", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        {rx.nlp_raw_text && (
          <div style={{ flex: 1, fontSize: 12, color: MUTED, fontStyle: "italic" }}>
            « {rx.nlp_raw_text} »
          </div>
        )}
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => exportPDF(rx)} style={{ padding: "6px 14px", borderRadius: 8, border: `1px solid ${ACCENT}`, background: "#fff", color: ACCENT, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
            Exporter PDF
          </button>
          {!rx.is_validated && !rx.is_cancelled && (
            <>
              <button
                onClick={() => onUpdate(rx.prescription_id, { is_validated: true, validated_at: new Date().toISOString() })}
                style={{ padding: "6px 14px", borderRadius: 8, border: "none", background: GREEN, color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
                Valider
              </button>
              <button
                onClick={() => onUpdate(rx.prescription_id, { is_cancelled: true })}
                style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid #E5E7EB", background: "#fff", color: RED, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
                Annuler
              </button>
            </>
          )}
          {rx.is_cancelled && <span style={{ fontSize: 12, color: RED, fontWeight: 600 }}>Annulée</span>}
        </div>
      </div>
    </div>
    );
  };

  // ── Section header helper ──────────────────────────────────────────────────
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

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Page header summary */}
      <div style={{ background: CARD, borderRadius: 16, padding: "18px 24px", marginBottom: 24, border: `1px solid ${BORDER}`, display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap", boxShadow:"0 2px 12px rgba(0,0,0,.04)" }}>
        <div style={{ width: 42, height: 42, borderRadius: 10, background: ACCENT + "15", display: "grid", placeItems: "center", flexShrink: 0 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
          </svg>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 2 }}>Actes & Ordres — SILLAGE</div>
          <div style={{ color: MUTED, fontSize: 13 }}>
            {prescriptions.length} acte(s) · {active.length} en attente · {done.length} traité(s)
          </div>
        </div>
        {/* Summary chips */}
        <div style={{ display: "flex", gap: 8, flexWrap:"wrap" }}>
          {expiring.length > 0 && (
            <div style={{ padding: "6px 14px", borderRadius: 20, background: AMBER + "25", color: AMBER, fontSize: 13, fontWeight: 700, border:`1px solid ${AMBER}55` }}>
              {expiring.length} expirent &lt;30 min
            </div>
          )}
          <div style={{ padding: "6px 14px", borderRadius: 20, background: AMBER + "18", color: AMBER, fontSize: 13, fontWeight: 700 }}>
            {todo.length} à faire
          </div>
          <div style={{ padding: "6px 14px", borderRadius: 20, background: RED + "18", color: RED, fontSize: 13, fontWeight: 700 }}>
            {urgent.length} urgentes
          </div>
        </div>
      </div>

      {prescriptions.length === 0 ? (
        <div style={{ background: CARD, borderRadius: 14, border: "1px solid #E5E7EB", padding: 48, textAlign: "center", color: "#CBD5E1", fontSize: 14 }}>
          Aucun acte enregistré. Utilisez le bot NLP pour en créer.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>

          {/* ── SECTION 0 : EXPIRE BIENTÔT (< 30 min) ───────────────────── */}
          {expiring.length > 0 && (
            <div>
              <SectionHeader
                label="Expirent dans moins de 30 min"
                count={expiring.length}
                color={AMBER}
              />
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {expiring.map(rx => <RxCard key={rx.prescription_id} rx={rx} isExpiring={true} />)}
              </div>
            </div>
          )}

          {/* ── SECTION 1 : TÂCHES URGENTES ─────────────────────────────── */}
          {urgent.length > 0 && (
            <div>
              <SectionHeader
                label="Tâches urgentes"
                count={urgent.length}
                color={RED}
              />
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {urgent.map(rx => <RxCard key={rx.prescription_id} rx={rx} isUrgent={true} />)}
              </div>
            </div>
          )}

          {/* ── SECTION 2 : TÂCHES À FAIRE ──────────────────────────────── */}
          {todo.length > 0 && (
            <div>
              <SectionHeader
                label="Tâches à faire"
                count={todo.length}
                color={AMBER}
              />
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {todo.map(rx => <RxCard key={rx.prescription_id} rx={rx} isUrgent={false} />)}
              </div>
            </div>
          )}

          {/* ── SECTION 3 : HISTORIQUE ───────────────────────────────────── */}
          {done.length > 0 && (
            <div>
              <SectionHeader
                label="Historique"
                count={done.length}
                color={MUTED}
              />
              {/* Sub-section: délai dépassé */}
              {doneOverdue.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: RED, marginBottom: 8, paddingLeft: 2 }}>
                    Délai dépassé — {doneOverdue.length} acte(s)
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {doneOverdue.map(rx => <RxCard key={rx.prescription_id} rx={rx} isUrgent={false} />)}
                  </div>
                </div>
              )}
              {/* Sub-section: dans les délais */}
              {doneOnTime.length > 0 && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: GREEN, marginBottom: 8, paddingLeft: 2 }}>
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

// ─────────────────────────────────────────────────────────────────────────────
//  BIOMETRIC SECURITY BOT  (now using DB_STAFF)
// ─────────────────────────────────────────────────────────────────────────────
function drawFaceBox(canvas, video) {
  const ctx = canvas.getContext("2d");
  canvas.width = video.videoWidth; canvas.height = video.videoHeight;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const cx = canvas.width/2, cy = canvas.height/2 - 20;
  ctx.strokeStyle = ACCENT2; ctx.lineWidth = 2.5; ctx.setLineDash([8,6]);
  ctx.beginPath(); ctx.ellipse(cx, cy, 90, 120, 0, 0, Math.PI*2); ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = "rgba(255,255,255,.7)";
  ctx.font = "13px 'DM Sans', sans-serif"; ctx.textAlign = "center";
  ctx.fillText("Positionnez votre visage ici", cx, cy+144);
}

function BioBot({ onAuth }) {
  const videoRef     = useRef(null);
  const canvasRef    = useRef(null);
  const animRef      = useRef(null);
  const [camActive, setCamActive]       = useState(false);
  const [step, setStep]                 = useState("idle");
  const [selectedUser, setSelectedUser] = useState(null);
  const [camError, setCamError]         = useState(false);
  const [searchStaff, setSearchStaff]   = useState("");
  // ── Auth method ────────────────────────────────────────────────────────────
  const [authMethod, setAuthMethod]     = useState("bio"); // "bio" | "badge" | "password"
  // ── Password method states ─────────────────────────────────────────────────
  const [pwdLogin, setPwdLogin]         = useState("");
  const [pwdPass, setPwdPass]           = useState("");
  const [pwdError, setPwdError]         = useState("");
  const [pwdShowPass, setPwdShowPass]   = useState(false);

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

  const levelColor = (l) => l >= 4 ? RED : l === 3 ? AMBER : l === 2 ? ACCENT : MUTED;

  const startCam = useCallback(async () => {
    setCamError(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video:{ facingMode:"user", width:400, height:300 } });
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
      setCamActive(true); setStep("scanning");
    } catch {
      setCamError(true); setCamActive(true); setStep("scanning");
    }
  }, []);

  const stopCam = useCallback(() => {
    videoRef.current?.srcObject?.getTracks().forEach(t => t.stop());
    setCamActive(false); setStep("idle");
    cancelAnimationFrame(animRef.current);
  }, []);

  useEffect(() => {
    if (!camActive) return;
    const loop = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!camError && videoRef.current?.videoWidth > 0) {
        drawFaceBox(canvas, videoRef.current);
      } else {
        canvas.width = 400; canvas.height = 300;
        ctx.fillStyle = "#1a1f2e"; ctx.fillRect(0,0,400,300);
        const t = Date.now()/1000;
        for (let i=0; i<8; i++) {
          const y = ((t*40 + i*40) % 320) - 10;
          ctx.strokeStyle = `rgba(233,30,140,${0.08+Math.sin(t+i)*0.04})`;
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(400,y); ctx.stroke();
        }
        const [cx,cy] = [200,130];
        const pulse = (Math.sin(t*3)+1)/2;
        ctx.strokeStyle = ACCENT2; ctx.lineWidth = 2; ctx.setLineDash([8,6]);
        ctx.beginPath(); ctx.ellipse(cx,cy,70,95,0,0,Math.PI*2); ctx.stroke();
        ctx.setLineDash([]);
        ctx.strokeStyle = `rgba(233,30,140,${0.3*pulse})`; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.ellipse(cx,cy,70+pulse*12,95+pulse*12,0,0,Math.PI*2); ctx.stroke();
        ctx.fillStyle = "rgba(255,255,255,.5)";
        ctx.font = "12px 'DM Sans', sans-serif"; ctx.textAlign = "center";
        ctx.fillText("Simulation — Positionnez votre visage", cx, cy+120);
      }
      animRef.current = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(animRef.current);
  }, [camActive, camError]);

  const simulateVerify = useCallback(() => {
    const user = selectedUser || DB_STAFF.find(u => u.biometric_enrolled) || DB_STAFF[0];
    setSelectedUser(user);
    setStep("verifying");
    setTimeout(() => { setStep("granted"); setTimeout(() => onAuth && onAuth(user), 900); }, 2200);
  }, [selectedUser, onAuth]);
  const reset = useCallback(() => {
    stopCam();
    setSelectedUser(null);
    setStep("idle");
    setCamError(false);
    setPwdLogin(""); setPwdPass(""); setPwdError("");
  }, [stopCam]);

  const handlePasswordAuth = useCallback(() => {
    setPwdError("");
    const login = pwdLogin.trim().toLowerCase();
    const match = DB_STAFF.find(u =>
      u.last_name.toLowerCase() === login ||
      u.employee_number.toLowerCase() === login ||
      u.first_name.toLowerCase() === login
    );
    if (!match) { setPwdError("Identifiant inconnu."); return; }
    if (match.password !== pwdPass) { setPwdError("Mot de passe incorrect."); return; }
    setSelectedUser(match);
    setStep("verifying");
    setTimeout(() => { setStep("granted"); setTimeout(() => onAuth && onAuth(match), 900); }, 1600);
  }, [pwdLogin, pwdPass]);

  const switchMethod = useCallback((m) => {
    setAuthMethod(m);
    if (camActive) stopCam();
    setStep("idle");
    setSelectedUser(null);
    setPwdLogin(""); setPwdPass(""); setPwdError("");
  }, [camActive, stopCam]);

  const stepColors = { idle:MUTED, scanning:AMBER, verifying:ACCENT, granted:GREEN, denied:RED };
  const stepLabels = { idle:"En attente", scanning:"Caméra active — Positionnez votre visage", verifying:"Vérification biométrique en cours…", granted:"Identité confirmée — Accès autorisé", denied:"Identité non reconnue — Accès refusé" };

  return (
    <div>
      <div style={{ maxWidth:480, margin:"0 auto" }}>
          <div style={{ background:CARD, borderRadius:16, border:`1px solid ${BORDER}`, padding:20, boxShadow:"0 2px 10px rgba(0,0,0,.04)" }}>
            <div style={{ fontWeight:700, fontSize:14, marginBottom:14, textAlign:"center", color:ACCENT }}>Méthode d'authentification</div>

            {/* ── Method tabs ───────────────────────────────────────────────── */}
            <div style={{ display:"flex", borderRadius:10, overflow:"hidden", border:"1.5px solid #E5E7EB", marginBottom:18 }}>
              {[
                { id:"bio",      label:"Biométrie",    icon:<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> },
                { id:"badge",    label:"Badge RFID",   icon:<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg> },
                { id:"password", label:"Mot de passe", icon:<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> },
              ].map(m => (
                <button key={m.id} onClick={() => switchMethod(m.id)} style={{
                  flex:1, padding:"9px 6px", border:"none", cursor:"pointer",
                  fontFamily:"'DM Sans', sans-serif", fontWeight:600, fontSize:12,
                  display:"flex", alignItems:"center", justifyContent:"center", gap:5,
                  background: authMethod === m.id ? ACCENT2 : "#fff",
                  color: authMethod === m.id ? "#fff" : MUTED,
                  transition:"all .2s",
                  borderRight: m.id !== "password" ? "1px solid #E5E7EB" : "none",
                }}>
                  {m.icon} {m.label}
                </button>
              ))}
            </div>

            {/* ── MÉTHODE 1 : Biométrie ─────────────────────────────────────── */}
            {authMethod === "bio" && (
              <div style={{ textAlign:"center" }}>
                {/* Camera view */}
                <div style={{ position:"relative", width:"100%", maxWidth:400, margin:"0 auto", aspectRatio:"4/3", background:"#111827", borderRadius:12, overflow:"hidden" }}>
                  <video ref={videoRef} autoPlay playsInline muted style={{ width:"100%", height:"100%", objectFit:"cover", display:camActive&&!camError?"block":"none", transform:"scaleX(-1)" }} />
                  <canvas ref={canvasRef} style={{ position:camError?"relative":"absolute", top:0, left:0, width:"100%", height:"100%", display:camActive?"block":"none", transform:camError?"none":"scaleX(-1)" }} />
                  {!camActive && (
                    <div style={{ position:"absolute", inset:0, display:"grid", placeItems:"center", color:"#6B7280", fontSize:14 }}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="1.5"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                      <div style={{ marginTop:8 }}>Caméra inactive</div>
                    </div>
                  )}
                  {step === "verifying" && (
                    <div style={{ position:"absolute", inset:0, background:"rgba(15,76,117,0.3)", display:"grid", placeItems:"center" }}>
                      <div style={{ width:60, height:60, border:"3px solid #fff", borderTopColor:"transparent", borderRadius:"50%", animation:"spin .8s linear infinite" }} />
                      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
                    </div>
                  )}
                  {step === "granted" && (
                    <div style={{ position:"absolute", inset:0, background:"rgba(16,185,129,0.25)", display:"grid", placeItems:"center" }}>
                      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                    </div>
                  )}
                </div>
                <div style={{ marginTop:14, padding:"8px 16px", borderRadius:8, background:stepColors[step]+"12", color:stepColors[step], fontWeight:600, fontSize:13, display:"inline-block" }}>
                  {stepLabels[step]}
                </div>
                <div style={{ display:"flex", justifyContent:"center", gap:10, marginTop:16, flexWrap:"wrap" }}>
                  {step === "idle"    && <Btn variant="accent" onClick={startCam}>Activer la caméra</Btn>}
                  {step === "scanning" && <Btn variant="accent" onClick={simulateVerify}>Lancer la vérification</Btn>}
                  {(step === "granted" || step === "denied") && <Btn variant="ghost" onClick={reset}>Réinitialiser</Btn>}
                  {camActive && step !== "granted" && step !== "denied" && <Btn variant="ghost" onClick={stopCam}>Annuler</Btn>}
                </div>
              </div>
            )}

            {/* ── MÉTHODE 2 : Badge RFID ────────────────────────────────────── */}
            {authMethod === "badge" && (
              <div style={{ textAlign:"center" }}>
                <div style={{ width:"100%", maxWidth:400, margin:"0 auto", aspectRatio:"4/3", background:"#111827", borderRadius:12, overflow:"hidden", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:16 }}>
                  <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke={step === "granted" ? GREEN : ACCENT2} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: step === "verifying" ? 0.5 : 1, transition:"all .3s" }}>
                    <rect x="2" y="5" width="20" height="14" rx="2"/>
                    <line x1="2" y1="10" x2="22" y2="10"/>
                    <line x1="6" y1="15" x2="10" y2="15"/>
                    <line x1="14" y1="15" x2="16" y2="15"/>
                  </svg>
                  {step === "verifying" && (
                    <div style={{ width:40, height:40, border:"3px solid #fff", borderTopColor:"transparent", borderRadius:"50%", animation:"spin .8s linear infinite" }} />
                  )}
                  {step !== "granted" && step !== "verifying" && (
                    <div style={{ color:"rgba(255,255,255,.5)", fontSize:13 }}>Approchez votre badge</div>
                  )}
                  {step === "granted" && (
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke={GREEN} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                  )}
                </div>
                <div style={{ marginTop:14, padding:"8px 16px", borderRadius:8, background:stepColors[step]+"12", color:stepColors[step], fontWeight:600, fontSize:13, display:"inline-block" }}>
                  {stepLabels[step]}
                </div>
                <div style={{ display:"flex", justifyContent:"center", gap:10, marginTop:16, flexWrap:"wrap" }}>
                  {step === "idle" && <Btn variant="accent" onClick={() => {
                    const user = DB_STAFF.find(u => u.biometric_enrolled) || DB_STAFF[0];
                    setSelectedUser(user);
                    setStep("verifying");
                    setTimeout(() => { setStep("granted"); setTimeout(() => onAuth && onAuth(user), 900); }, 1800);
                  }}>Simuler lecture badge</Btn>}
                  {(step === "granted" || step === "denied") && <Btn variant="ghost" onClick={reset}>Réinitialiser</Btn>}
                </div>
              </div>
            )}

            {/* ── MÉTHODE 3 : Mot de passe ──────────────────────────────────── */}
            {authMethod === "password" && (
              <div>
                {step !== "granted" ? (
                  <div style={{ maxWidth:380, margin:"0 auto" }}>
                    <div style={{ background:"#F8FAFC", border:"1px solid #E2E8F0", borderRadius:12, padding:28, display:"flex", flexDirection:"column", gap:14 }}>
                      <div style={{ textAlign:"center", marginBottom:4 }}>
                        <div style={{ width:52, height:52, borderRadius:"50%", background:ACCENT2+"18", display:"grid", placeItems:"center", margin:"0 auto 10px" }}>
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={ACCENT2} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                        </div>
                        <div style={{ fontWeight:700, fontSize:15, marginBottom:4 }}>Connexion par mot de passe</div>
                        <div style={{ fontSize:12, color:MUTED }}>Entrez votre identifiant (nom ou N° employé) et votre mot de passe</div>
                      </div>

                      {/* Login field */}
                      <div>
                        <label style={{ fontSize:12, fontWeight:600, color:MUTED, display:"block", marginBottom:5 }}>Identifiant</label>
                        <input
                          value={pwdLogin}
                          onChange={e => { setPwdLogin(e.target.value); setPwdError(""); }}
                          onKeyDown={e => e.key === "Enter" && handlePasswordAuth()}
                          placeholder="Ex : martin, EMP-001, sophie…"
                          style={{ width:"100%", boxSizing:"border-box", padding:"10px 14px", borderRadius:8, border:`1.5px solid ${pwdError ? RED : "#D1D5DB"}`, fontFamily:"'DM Sans', sans-serif", fontSize:13, outline:"none" }}
                        />
                      </div>

                      {/* Password field */}
                      <div>
                        <label style={{ fontSize:12, fontWeight:600, color:MUTED, display:"block", marginBottom:5 }}>Mot de passe</label>
                        <div style={{ position:"relative" }}>
                          <input
                            type={pwdShowPass ? "text" : "password"}
                            value={pwdPass}
                            onChange={e => { setPwdPass(e.target.value); setPwdError(""); }}
                            onKeyDown={e => e.key === "Enter" && handlePasswordAuth()}
                            placeholder="Mot de passe"
                            style={{ width:"100%", boxSizing:"border-box", padding:"10px 40px 10px 14px", borderRadius:8, border:`1.5px solid ${pwdError ? RED : "#D1D5DB"}`, fontFamily:"'DM Sans', sans-serif", fontSize:13, outline:"none" }}
                          />
                          <button onClick={() => setPwdShowPass(s => !s)} style={{ position:"absolute", right:10, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", color:MUTED, fontSize:12 }}>
                            {pwdShowPass ? "Cacher" : "Voir"}
                          </button>
                        </div>
                      </div>

                      {/* Error */}
                      {pwdError && (
                        <div style={{ padding:"8px 12px", borderRadius:8, background:RED+"10", color:RED, fontSize:13, fontWeight:600, textAlign:"center" }}>
                          {pwdError}
                        </div>
                      )}

                      {/* Submit */}
                      {step === "verifying" ? (
                        <div style={{ textAlign:"center", padding:"12px 0" }}>
                          <div style={{ width:36, height:36, border:"3px solid #E5E7EB", borderTopColor:ACCENT2, borderRadius:"50%", animation:"spin .8s linear infinite", margin:"0 auto" }} />
                          <div style={{ marginTop:10, fontSize:13, color:MUTED }}>Vérification en cours…</div>
                        </div>
                      ) : (
                        <Btn variant="accent" onClick={handlePasswordAuth} disabled={!pwdLogin || !pwdPass} style={{ width:"100%" }}>
                          Se connecter
                        </Btn>
                      )}

                      {/* Hint */}
                      <div style={{ fontSize:11, color:MUTED, textAlign:"center", borderTop:"1px solid #E5E7EB", paddingTop:10 }}>
                        Compte admin : identifiant <strong>admin</strong> · mot de passe <strong>admin</strong>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ textAlign:"center" }}>
                    <div style={{ width:"100%", maxWidth:400, margin:"0 auto 14px", aspectRatio:"4/3", background:"#111827", borderRadius:12, display:"grid", placeItems:"center" }}>
                      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke={GREEN} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                    </div>
                    <div style={{ padding:"8px 16px", borderRadius:8, background:GREEN+"12", color:GREEN, fontWeight:600, fontSize:13, display:"inline-block", marginBottom:14 }}>
                      Authentification réussie
                    </div>
                    <br/>
                    <Btn variant="ghost" onClick={reset}>Réinitialiser</Btn>
                  </div>
                )}
              </div>
            )}

            {/* Access granted card */}
            {step === "granted" && selectedUser && (
              <div style={{ marginTop:18, padding:18, borderRadius:12, background:"#ECFDF5", border:"1px solid #A7F3D0", textAlign:"left" }}>
                <div style={{ fontWeight:700, fontSize:14, color:"#065F46", marginBottom:10 }}>Accès autorisé — Droits attribués</div>
                <table style={{ fontSize:13, lineHeight:1.8, width:"100%" }}>
                  <tbody>
                    {[
                      ["Identité",      `${selectedUser.title} ${selectedUser.first_name} ${selectedUser.last_name}`.trim()],
                      ["N° employé",    selectedUser.employee_number],
                      ["Rôle",          selectedUser.role_label],
                      ["Service",       selectedUser.dept],
                      ["Spécialité",    selectedUser.specialty || "—"],
                      ["Niveau accès",  selectedUser.access_level + " / 5"],
                      ["Méthode auth",  authMethod === "bio" ? "Reconnaissance faciale" : authMethod === "badge" ? "Badge RFID" : "Mot de passe"],
                      ["Biométrie",     selectedUser.biometric_enrolled ? "Enrolée" : "Non enrolée"],
                      ["Horodatage",    new Date().toLocaleString("fr-FR")],
                    ].map(([k,v]) => (
                      <tr key={k}>
                        <td style={{ fontWeight:600, paddingRight:14, color:"#065F46", whiteSpace:"nowrap" }}>{k}</td>
                        <td>{v}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {/* Permissions */}
                <div style={{ marginTop:12 }}>
                  <div style={{ fontWeight:700, fontSize:12, color:"#065F46", marginBottom:6 }}>Permissions accordées :</div>
                  <div style={{ display:"flex", flexWrap:"wrap", gap:4 }}>
                    {(ACCESS_PERMISSIONS[selectedUser.access_level] || []).map(p => (
                      <span key={p} style={{ fontSize:11, padding:"2px 8px", borderRadius:5, background:"#D1FAE5", color:"#065F46", fontWeight:600 }}>
                        {PERM_LABELS[p] || p}
                      </span>
                    ))}
                  </div>
                </div>
                <div style={{ marginTop:10, fontSize:11, color:"#065F46", opacity:0.7 }}>
                  Log AUD enregistré · Session SILLAGE activée · staff_access_log ↩
                </div>
              </div>
            )}
          </div>
      </div>
    </div>
  );
}