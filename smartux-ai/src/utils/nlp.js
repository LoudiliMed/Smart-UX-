// ─────────────────────────────────────────────────────────────────────────────
//  NLP UTILITIES
//  Pure functions that sit between the raw text input and the AI/DB layer.
//  No React, no side effects — easy to unit-test independently.
// ─────────────────────────────────────────────────────────────────────────────

import {
  DB_PATIENTS,
  DB_MEDICAMENTS,
  KNOWN_ALLERGIES,
  TYPO_CORRECTIONS,
} from "../database";

// ── Auto-correct common medical typos ────────────────────────────────────────
export function autoCorrect(text) {
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

// ── Detect allergy conflicts between a prescription drug and known allergies ─
export function detectAllergyConflict(nlpData, patientMatch) {
  if (!patientMatch || !nlpData.medicament) return null;
  const allergies = KNOWN_ALLERGIES[patientMatch.patient_id] || [];
  const drug = nlpData.medicament.toLowerCase();
  const conflict = allergies.find(a => drug.includes(a) || a.includes(drug));
  if (conflict)
    return `ALERTE ALLERGIE : ${patientMatch.first_name} ${patientMatch.last_name} est allergique à ${conflict}`;
  return null;
}

// ── Map raw NLP-extracted JSON to the prescriptions table schema ──────────────
export function mapNLPToPrescription(nlpData, rawText) {
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
  if (patientMatch)       autoFilled.push("patient_id");
  if (drugMatch)          autoFilled.push("medicament_id", "form", "route");
  if (nlpData.dose)       autoFilled.push("dosage");
  if (nlpData.voie)       autoFilled.push("route");
  if (nlpData.frequence)  autoFilled.push("frequency");
  if (nlpData.diagnostic) autoFilled.push("diagnostic", "indication");
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
    nlp_confidence:
      Object.keys(nlpData).length > 3 ? "HIGH"
      : Object.keys(nlpData).length > 1 ? "MEDIUM"
      : "LOW",
    nlp_fields_auto:     JSON.stringify(autoFilled),
    is_validated:        false,
    source:              "NLP",
    created_at:          new Date().toISOString(),
    _matched_patient:    patientMatch,
    _matched_drug:       drugMatch,
  };
}

// ── Parse delay strings → ISO timestamp or "immediate" ───────────────────────
//  Examples: "2h" → +2 hrs · "3 jours" → +3 days · "aucun" → "immediate"
export function parseDelay(str) {
  if (!str) return null;
  if (/^(aucun|non|sans|no|-|immédiat|immediat|maintenant|now|direct|dès que possible|dqp|tout de suite|asap)$/i.test(str.trim()))
    return "immediate";
  const match = str.match(
    /(\d+)\s*(h(?:eure(?:s)?)?|j(?:our(?:s)?)?|min(?:ute(?:s)?)?|sem(?:aine(?:s)?)?)/i
  );
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

// ── Extract a positive integer from free text ("3", "2 fois", "14 jours") ────
export function parsePositiveInt(str) {
  const match = str.match(/(\d+)/);
  return match ? parseInt(match[1]) : null;
}

// ── Convert a duration string to a number of days ────────────────────────────
//  "7 jours" → 7 · "2 semaines" → 14
export function parseNbJours(str) {
  const weekMatch = str.match(/(\d+)\s*sem/i);
  if (weekMatch) return parseInt(weekMatch[1]) * 7;
  const match = str.match(/(\d+)/);
  return match ? parseInt(match[1]) : null;
}
