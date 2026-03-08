// ─────────────────────────────────────────────────────────────────────────────
//  AI PROMPTS & CONTEXT BUILDERS
//  System prompts, patient-context assembly, and alert-response parsing.
//  All exports are pure functions or string constants — no React, no side effects.
// ─────────────────────────────────────────────────────────────────────────────

import {
  DB_PATIENTS,
  DB_MEDICAMENTS,
  DB_CONSTANTES,
  DB_OBSERVATIONS,
  DB_IMAGERIE,
  KNOWN_ALLERGIES,
} from "../database";

// ─────────────────────────────────────────────────────────────────────────────
//  SYSTEM PROMPTS  (SAFE-02 — disclaimer mandated in both)
// ─────────────────────────────────────────────────────────────────────────────

/** Used by AlertSystem: drug-interaction / allergy verification. */
export const SYSTEM_PROMPT_ALERT = `Tu es un assistant de vérification des prescriptions médicales dans un hôpital français.

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

/** Used by ChatPanel: general clinical Q&A for hospital staff. */
export const SYSTEM_PROMPT_CHAT = `Tu es un assistant médical clinique dans un hôpital français.

Tu réponds aux questions du personnel médical sur les patients.

RÈGLES IMPÉRATIVES :
1. Réponds EXCLUSIVEMENT en français
2. Base tes réponses sur le dossier patient fourni dans le contexte
3. Indique clairement quand tu n'es pas certain
4. Ne fais JAMAIS de diagnostic — propose uniquement des hypothèses à vérifier par le clinicien
5. Ne réponds qu'aux questions concernant les données fournies dans le contexte
6. Ne cite JAMAIS le nom d'un patient — réfère-toi uniquement à son identifiant (ex : H-12345)
7. Adapte le niveau de détail et le vocabulaire au rôle du professionnel indiqué dans le profil utilisateur`;

// ─────────────────────────────────────────────────────────────────────────────
//  ROLE-AWARE SYSTEM PROMPT BUILDER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Appends role-specific instructions to SYSTEM_PROMPT_CHAT based on the
 * authenticated user's access level (1–5).
 *
 * @param {object} user - Authenticated staff record from DB_STAFF
 * @returns {string} Full system prompt string
 */
export function buildChatSystemPrompt(user) {
  const level = user?.access_level ?? 1;
  const role  = user?.role_label   ?? "Personnel";

  let roleInstructions;
  if (level >= 4) {
    roleInstructions =
      `Tu t'adresses à un(e) ${role}. Fournis un niveau de détail clinique complet : hypothèses diagnostiques, traitements, interactions médicamenteuses, résultats biologiques et d'imagerie, pronostic. Utilise la terminologie médicale appropriée.`;
  } else if (level === 3) {
    roleInstructions =
      `Tu t'adresses à un(e) ${role}. Fournis les informations cliniques opérationnelles : médicaments, posologies, protocoles de soins, constantes, surveillance. Ne formule pas d'hypothèse diagnostique.`;
  } else if (level === 2) {
    roleInstructions =
      `Tu t'adresses à un(e) ${role}. Fournis uniquement les informations de soin de base : état général, instructions de soins immédiates. Omets les diagnostics, les ordonnances détaillées et les résultats biologiques.`;
  } else {
    roleInstructions =
      `Tu t'adresses à un(e) ${role}. Fournis uniquement les informations administratives : service, numéro de chambre, rendez-vous. N'accède à aucune donnée clinique.`;
  }

  return `${SYSTEM_PROMPT_CHAT}\n\n=== PROFIL UTILISATEUR ===\nRôle : ${role} (niveau d'accès ${level})\n${roleInstructions}`;
}

// ─────────────────────────────────────────────────────────────────────────────
//  PATIENT DOSSIER CONTEXT BUILDERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Builds a text-format dossier for a single patient, injected as context
 * into the alert and chat system prompts.
 *
 * PHI NOTE: Patient name replaced with token (H-{id}) per RGPD — DPA pending.
 * To restore full name once DPA is signed, replace the header line with:
 *   `Patient : ${patient.first_name} ${patient.last_name} (${patient.ipp}), ${age} ans, ...`
 *
 * @param {object} patient       - Patient record from DB_PATIENTS
 * @param {Array}  prescriptions - Active prescriptions for this patient
 * @returns {string|null}
 */
export function buildDossierContext(patient, prescriptions) {
  if (!patient) return null;

  const age =
    new Date().getFullYear() - new Date(patient.date_of_birth).getFullYear();

  // Anonymised header (H-{id}) per RGPD / DPA-pending
  const header = `Patient H-${patient.patient_id}, ${age} ans, ${patient.ward}, chambre ${patient.room}`;

  // Most recent vital signs only (LOCKED DECISION)
  const vitals = DB_CONSTANTES
    .filter(c => c.patient_id === patient.patient_id)
    .sort((a, b) => new Date(b.date) - new Date(a.date))[0];

  const vitalsStr = vitals
    ? `Constantes (le ${new Date(vitals.date).toLocaleDateString("fr-FR")}) : TA ${vitals.ta}, FC ${vitals.fc}/min, Température ${vitals.temp}°C, SpO2 ${vitals.spo2}%, Poids ${vitals.poids}kg`
    : "Constantes : Non disponibles";

  // Most recent clinical note only (LOCKED DECISION)
  const note = DB_OBSERVATIONS
    .filter(o => o.patient_id === patient.patient_id)
    .sort((a, b) => new Date(b.date) - new Date(a.date))[0];

  const noteStr = note
    ? `Dernière note clinique (${new Date(note.date).toLocaleDateString("fr-FR")} — ${note.category}) : ${note.text}`
    : "Aucune note clinique récente";

  const allergies    = KNOWN_ALLERGIES[patient.patient_id] || [];
  const allergiesStr = allergies.length > 0
    ? `Allergies connues : ${allergies.join(", ")}`
    : "Aucune allergie connue";

  const medsStr = prescriptions && prescriptions.length > 0
    ? "Traitements en cours : " +
      prescriptions
        .map(rx => {
          const drugName =
            rx.drug_name_free ||
            DB_MEDICAMENTS.find(m => m.id === rx.medicament_id)?.brand ||
            "Médicament inconnu";
          return [drugName, rx.dosage, rx.route].filter(Boolean).join(" ");
        })
        .join("; ")
    : "Aucun traitement en cours";

  // Assembled as prose (LOCKED DECISION: not JSON, not labelled sections)
  return `${header}\n\n${vitalsStr}\n\n${noteStr}\n\n${allergiesStr}\n\n${medsStr}`;
}

/**
 * Builds a multi-patient context block used by ChatPanel when no specific
 * patient is selected — lets the AI answer questions about the whole ward.
 *
 * @param {Array} allPrescriptions - All prescriptions from the shared store
 * @returns {string}
 */
export function buildAllPatientsContext(allPrescriptions = []) {
  return DB_PATIENTS.map(p => {
    const age = new Date().getFullYear() - new Date(p.date_of_birth).getFullYear();

    const vitals = DB_CONSTANTES
      .filter(c => c.patient_id === p.patient_id)
      .sort((a, b) => new Date(b.date) - new Date(a.date))[0];

    const note = DB_OBSERVATIONS
      .filter(o => o.patient_id === p.patient_id)
      .sort((a, b) => new Date(b.date) - new Date(a.date))[0];

    const allergies = KNOWN_ALLERGIES[p.patient_id] || [];
    const rxs       = allPrescriptions.filter(rx => rx.patient_id === p.patient_id);
    const imgs      = DB_IMAGERIE.filter(i => i.patient_id === p.patient_id);

    const lines = [];
    lines.push(`## Patient H-${p.patient_id}`);
    lines.push(
      `${age} ans — ${p.gender === "M" ? "Homme" : "Femme"} — Groupe ${p.blood_type} — ${p.ward}, chambre ${p.room}`
    );
    if (vitals)
      lines.push(
        `Constantes (${new Date(vitals.date).toLocaleDateString("fr-FR")}): TA ${vitals.ta}, FC ${vitals.fc}/min, T° ${vitals.temp}°C, SpO2 ${vitals.spo2}%, Poids ${vitals.poids}kg`
      );
    lines.push(
      allergies.length > 0
        ? `Allergies: ${allergies.join(", ")}`
        : "Allergies: aucune connue"
    );
    if (note)
      lines.push(
        `Dernière note (${new Date(note.date).toLocaleDateString("fr-FR")} — ${note.category} par ${note.author}): ${note.text}`
      );
    if (imgs.length > 0)
      lines.push(
        `Imagerie: ${imgs.map(i => `${i.type} [${i.status}] — ${i.description}`).join(" | ")}`
      );
    if (rxs.length > 0)
      lines.push(
        `Prescriptions: ${rxs.map(rx => [rx.drug_name_free, rx.dosage, rx.route].filter(Boolean).join(" ")).join("; ")}`
      );
    else lines.push("Prescriptions: aucune enregistrée");

    return lines.join("\n");
  }).join("\n\n");
}

// ─────────────────────────────────────────────────────────────────────────────
//  ALERT RESPONSE PARSER  (ALRT-01, ALRT-02, ALRT-03, UX-02)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parses the raw AI text response from the alert system into structured alert objects.
 * Looks for **CRITIQUE**, **MODERE**, **FAIBLE** markdown lines.
 *
 * @param {string} raw - Raw AI response text
 * @returns {Array<{id: string, severity: string, message: string}>}
 */
export function parseAlertResponse(raw) {
  const alerts = [];
  const lines  = (raw || "").split("\n");

  lines.forEach(line => {
    const match = line.match(/\*\*(CRITIQUE|MODERE|FAIBLE)\*\*\s*:?\s*(.+)/);
    if (match) {
      alerts.push({
        id:       `${match[1]}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        severity: match[1],
        message:  match[2].trim(),
      });
    }
  });

  // If the AI explicitly says "no interactions found", return empty array
  if (alerts.length === 0 && raw && raw.includes("Aucune interaction identifi")) {
    return [];
  }
  return alerts;
}
