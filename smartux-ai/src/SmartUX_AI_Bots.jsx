import { useState, useRef, useCallback, useEffect, useMemo } from "react";

const ACCENT  = "#0F4C75";
const ACCENT2 = "#E91E8C";
const BG      = "#F5F3EE";
const CARD    = "#FFFFFF";
const MUTED   = "#6B7280";
const GREEN   = "#10B981";
const AMBER   = "#F59E0B";
const RED     = "#EF4444";

// ─────────────────────────────────────────────────────────────────────────────
//  DATABASE CONSTANTS  (seeded from sillage_database.sql)
// ─────────────────────────────────────────────────────────────────────────────

const DB_PATIENTS = [
  { patient_id:1, ipp:"IPP-000001", last_name:"Dupont",   first_name:"Jean",    date_of_birth:"1955-06-14", gender:"M", blood_type:"A+",  room:"102", ward:"Cardiologie Conventionnelle" },
  { patient_id:2, ipp:"IPP-000002", last_name:"Lefevre",  first_name:"Martine", date_of_birth:"1942-11-28", gender:"F", blood_type:"O-",  room:"301", ward:"Neurologie Conventionnelle" },
  { patient_id:3, ipp:"IPP-000003", last_name:"Hakimi",   first_name:"Youssef", date_of_birth:"1989-03-05", gender:"M", blood_type:"B+",  room:"201", ward:"Chirurgie Digestive" },
  { patient_id:4, ipp:"IPP-000004", last_name:"Morin",    first_name:"Claire",  date_of_birth:"1998-07-20", gender:"F", blood_type:"AB+", room:"501", ward:"Maternité" },
  { patient_id:5, ipp:"IPP-000005", last_name:"Tremblay", first_name:"René",    date_of_birth:"1960-01-19", gender:"M", blood_type:"O+",  room:"102", ward:"Cardiologie Conventionnelle" },
  { patient_id:6, ipp:"IPP-000006", last_name:"Nguyen",   first_name:"Thi Lan", date_of_birth:"1975-09-12", gender:"F", blood_type:"A-",  room:"202", ward:"Chirurgie Orthopédique" },
];

const DB_STAFF = [
  { staff_id:1,  employee_number:"EMP-001", title:"Dr",   last_name:"Martin",    first_name:"Sophie",   role_label:"Médecin",             access_level:4, dept:"Cardiologie",          specialty:"Cardiologie",            biometric_enrolled:1, password:"sophie2024"  },
  { staff_id:2,  employee_number:"EMP-002", title:"Pr",   last_name:"Dubois",    first_name:"Laurent",  role_label:"Médecin",             access_level:4, dept:"Neurologie",           specialty:"Neurologie",             biometric_enrolled:1, password:"laurent2024" },
  { staff_id:3,  employee_number:"EMP-003", title:"Dr",   last_name:"Bernard",   first_name:"Isabelle", role_label:"Chirurgien",          access_level:4, dept:"Chirurgie Générale",   specialty:"Chirurgie Digestive",    biometric_enrolled:1, password:"isa2024"     },
  { staff_id:4,  employee_number:"EMP-004", title:"Dr",   last_name:"Leroy",     first_name:"Karim",    role_label:"Anesthésiste-Réanimateur", access_level:4, dept:"Réanimation",     specialty:"Anesthésie-Réanimation", biometric_enrolled:1, password:"karim2024"   },
  { staff_id:5,  employee_number:"EMP-005", title:"",     last_name:"Moreau",    first_name:"Céline",   role_label:"Cadre de Santé",      access_level:3, dept:"Cardiologie",          specialty:null,                     biometric_enrolled:1, password:"celine2024"  },
  { staff_id:6,  employee_number:"EMP-006", title:"IDE",  last_name:"Simon",     first_name:"Pierre",   role_label:"Infirmier(e) Diplômé(e) d'État", access_level:3, dept:"Urgences", specialty:null,                biometric_enrolled:0, password:"pierre2024"  },
  { staff_id:7,  employee_number:"EMP-007", title:"AS",   last_name:"Laurent",   first_name:"Nadia",    role_label:"Aide-Soignant(e)",    access_level:2, dept:"Chirurgie Orthopédique",specialty:null,                   biometric_enrolled:0, password:"nadia2024"   },
  { staff_id:8,  employee_number:"EMP-008", title:"Dr",   last_name:"Rousseau",  first_name:"Marc",     role_label:"Biologiste Médical",  access_level:4, dept:"Laboratoire",          specialty:"Biologie Médicale",      biometric_enrolled:1, password:"marc2024"    },
  { staff_id:9,  employee_number:"EMP-009", title:"Dr",   last_name:"Petit",     first_name:"Amina",    role_label:"Radiologue",          access_level:4, dept:"Radiologie",           specialty:"Radiologie",             biometric_enrolled:1, password:"amina2024"   },
  { staff_id:10, employee_number:"EMP-010", title:"",     last_name:"Garcia",    first_name:"Julien",   role_label:"Stagiaire / Interne", access_level:2, dept:"Neurologie",           specialty:"Interne Neurologie",     biometric_enrolled:0, password:"julien2024"  },
  { staff_id:11, employee_number:"EMP-011", title:"",     last_name:"Fontaine",  first_name:"Léa",      role_label:"Sage-Femme",          access_level:4, dept:"Maternité",            specialty:"Obstétrique",            biometric_enrolled:1, password:"lea2024"     },
  { staff_id:12, employee_number:"EMP-012", title:"",     last_name:"Renard",    first_name:"Thomas",   role_label:"Pharmacien",          access_level:3, dept:"Pharmacie",            specialty:"Pharmacie Clinique",     biometric_enrolled:0, password:"thomas2024"  },
  { staff_id:13, employee_number:"EMP-013", title:"",     last_name:"Chevalier", first_name:"Marie",    role_label:"Secrétaire Médicale", access_level:2, dept:"Administration",       specialty:null,                     biometric_enrolled:0, password:"marie2024"   },
  { staff_id:14, employee_number:"EMP-014", title:"",     last_name:"Bonnet",    first_name:"Paul",     role_label:"Agent d'Accueil",     access_level:1, dept:"Administration",       specialty:null,                     biometric_enrolled:0, password:"paul2024"    },
  { staff_id:15, employee_number:"EMP-015", title:"",     last_name:"Dupont",    first_name:"Hélène",   role_label:"Administrateur Système", access_level:5, dept:"Administration",    specialty:null,                     biometric_enrolled:1, password:"helene2024"  },
  // ── Compte administrateur ──────────────────────────────────────────────────
  { staff_id:16, employee_number:"EMP-ADM", title:"",     last_name:"",          first_name:"Admin",    role_label:"Super Administrateur",access_level:5, dept:"Administration Système",specialty:"Gestion des accès",      biometric_enrolled:1, password:"admin"       },
];

// Permissions per access level (simplified from role_permissions table)
const ACCESS_PERMISSIONS = {
  1: ["PAT_VIEW_ID"],
  2: ["PAT_VIEW_ID","PAT_VIEW_CLINICAL","PAT_VIEW_MEDS"],
  3: ["PAT_VIEW_ID","PAT_VIEW_CLINICAL","PAT_EDIT_CLINICAL","PAT_VIEW_LABS","PAT_VIEW_MEDS","PAT_VIEW_IMAGING","STAFF_VIEW"],
  4: ["PAT_VIEW_ID","PAT_VIEW_CLINICAL","PAT_EDIT_CLINICAL","PAT_VIEW_LABS","PAT_VIEW_IMAGING","PAT_PRESCRIBE","PAT_VIEW_MEDS","PAT_ADMIT","STAFF_VIEW","BILL_VIEW"],
  5: ["ALL_PERMISSIONS"],
};
const PERM_LABELS = {
  "PAT_VIEW_ID":       "Voir identité patient",
  "PAT_VIEW_CLINICAL": "Voir dossier clinique",
  "PAT_EDIT_CLINICAL": "Modifier dossier clinique",
  "PAT_VIEW_LABS":     "Voir résultats biologiques",
  "PAT_VIEW_IMAGING":  "Voir imagerie (PACS)",
  "PAT_PRESCRIBE":     "Créer / modifier prescriptions",
  "PAT_VIEW_MEDS":     "Voir prescriptions en cours",
  "PAT_ADMIT":         "Gérer admissions / sorties",
  "STAFF_VIEW":        "Voir profils du personnel",
  "BILL_VIEW":         "Voir facturation",
  "ALL_PERMISSIONS":   "Toutes les permissions (admin)",
};

const DB_MEDICAMENTS = [
  { id:1,  brand:"Doliprane",         inn:"Paracétamol",             form:"Comprimé",     dosage:"500mg / 1g",     route:"Per os",   category:"Analgésique - Antipyrétique" },
  { id:2,  brand:"Perfalgan",         inn:"Paracétamol",             form:"Injectable",   dosage:"10mg/mL",        route:"IV",       category:"Analgésique - Antipyrétique" },
  { id:3,  brand:"Advil",             inn:"Ibuprofène",              form:"Comprimé",     dosage:"200mg / 400mg",  route:"Per os",   category:"AINS - Analgésique" },
  { id:4,  brand:"Profenid",          inn:"Kétoprofène",             form:"Injectable",   dosage:"50mg / 100mg",   route:"IV/IM",    category:"AINS" },
  { id:5,  brand:"Actiskenan",        inn:"Morphine",                form:"Gélule LP",    dosage:"5mg / 10mg",     route:"Per os",   category:"Opioïde fort" },
  { id:6,  brand:"Morphine Aguettant",inn:"Morphine",                form:"Injectable",   dosage:"10mg/mL",        route:"IV/SC",    category:"Opioïde fort" },
  { id:7,  brand:"Topalgic",          inn:"Tramadol",                form:"Comprimé LP",  dosage:"50mg / 100mg",   route:"Per os",   category:"Opioïde faible" },
  { id:8,  brand:"Amoxicilline",      inn:"Amoxicilline",            form:"Comprimé",     dosage:"500mg / 1g",     route:"Per os",   category:"Antibiotique - Pénicilline" },
  { id:9,  brand:"Augmentin",         inn:"Amoxicilline/Clavulanate",form:"Comprimé",     dosage:"875mg/125mg",    route:"Per os",   category:"Antibiotique - Pénicilline" },
  { id:10, brand:"Augmentin IV",      inn:"Amoxicilline/Clavulanate",form:"Injectable",   dosage:"1g/200mg",       route:"IV",       category:"Antibiotique - Pénicilline" },
  { id:11, brand:"Clamoxyl",          inn:"Amoxicilline",            form:"Injectable",   dosage:"1g / 2g",        route:"IV/IM",    category:"Antibiotique - Pénicilline" },
  { id:12, brand:"Zithromax",         inn:"Azithromycine",           form:"Comprimé",     dosage:"250mg / 500mg",  route:"Per os",   category:"Antibiotique - Macrolide" },
  { id:13, brand:"Flagyl",            inn:"Métronidazole",           form:"Comprimé",     dosage:"250mg / 500mg",  route:"Per os",   category:"Antibiotique - Imidazolé" },
  { id:14, brand:"Flagyl IV",         inn:"Métronidazole",           form:"Injectable",   dosage:"5mg/mL",         route:"IV",       category:"Antibiotique - Imidazolé" },
  { id:15, brand:"Ciflox",            inn:"Ciprofloxacine",          form:"Comprimé",     dosage:"250mg / 500mg",  route:"Per os",   category:"Antibiotique - Fluoroquinolone" },
  { id:16, brand:"Rocéphine",         inn:"Ceftriaxone",             form:"Injectable",   dosage:"1g / 2g",        route:"IV/IM",    category:"Antibiotique - Céphalosporine" },
  { id:17, brand:"Vancomycine",       inn:"Vancomycine",             form:"Injectable",   dosage:"500mg / 1g",     route:"IV",       category:"Antibiotique - Glycopeptide" },
  { id:18, brand:"Kardégic",          inn:"Acide Acétylsalicylique", form:"Sachet",       dosage:"75mg / 160mg",   route:"Per os",   category:"Antiagrégant plaquettaire" },
  { id:19, brand:"Plavix",            inn:"Clopidogrel",             form:"Comprimé",     dosage:"75mg",           route:"Per os",   category:"Antiagrégant plaquettaire" },
  { id:20, brand:"Xarelto",           inn:"Rivaroxaban",             form:"Comprimé",     dosage:"10mg / 20mg",    route:"Per os",   category:"Anticoagulant - AOD" },
  { id:21, brand:"Eliquis",           inn:"Apixaban",                form:"Comprimé",     dosage:"2.5mg / 5mg",    route:"Per os",   category:"Anticoagulant - AOD" },
  { id:22, brand:"Lovenox",           inn:"Énoxaparine",             form:"Injectable",   dosage:"4000UI / 6000UI",route:"SC",       category:"Héparinothérapie - HBPM" },
  { id:23, brand:"Héparine sodique",  inn:"Héparine",                form:"Injectable",   dosage:"5000UI/mL",      route:"IV/SC",    category:"Héparinothérapie - HNF" },
  { id:24, brand:"Coumadine",         inn:"Warfarine",               form:"Comprimé",     dosage:"2mg / 5mg",      route:"Per os",   category:"Anticoagulant - AVK" },
  { id:25, brand:"Lisinopril",        inn:"Lisinopril",              form:"Comprimé",     dosage:"5mg / 10mg",     route:"Per os",   category:"IEC - Antihypertenseur" },
  { id:26, brand:"Triatec",           inn:"Ramipril",                form:"Comprimé",     dosage:"2.5mg / 5mg",    route:"Per os",   category:"IEC - Antihypertenseur" },
  { id:27, brand:"Amlor",             inn:"Amlodipine",              form:"Comprimé",     dosage:"5mg / 10mg",     route:"Per os",   category:"Inhibiteur calcique" },
  { id:28, brand:"Bisoprolol",        inn:"Bisoprolol",              form:"Comprimé",     dosage:"2.5mg / 5mg",    route:"Per os",   category:"Bêtabloquant" },
  { id:29, brand:"Lasilix",           inn:"Furosémide",              form:"Comprimé",     dosage:"40mg",           route:"Per os",   category:"Diurétique" },
  { id:30, brand:"Tahor",             inn:"Atorvastatine",           form:"Comprimé",     dosage:"10mg / 40mg",    route:"Per os",   category:"Hypolipémiant - Statine" },
  { id:31, brand:"Glucophage",        inn:"Metformine",              form:"Comprimé",     dosage:"500mg / 850mg",  route:"Per os",   category:"Antidiabétique - Biguanide" },
  { id:32, brand:"Lantus",            inn:"Insuline Glargine",       form:"Injectable",   dosage:"100UI/mL",       route:"SC",       category:"Insuline basale" },
  { id:33, brand:"Novorapid",         inn:"Insuline Asparte",        form:"Injectable",   dosage:"100UI/mL",       route:"SC",       category:"Insuline rapide" },
  { id:34, brand:"Ventoline",         inn:"Salbutamol",              form:"Aérosol",      dosage:"100µg/dose",     route:"Inhalé",   category:"Bronchodilatateur B2" },
  { id:35, brand:"Solupred",          inn:"Prednisolone",            form:"Comprimé",     dosage:"5mg / 20mg",     route:"Per os",   category:"Corticostéroïde" },
  { id:36, brand:"Solu-Médrol",       inn:"Méthylprednisolone",      form:"Injectable",   dosage:"40mg / 120mg",   route:"IV/IM",    category:"Corticostéroïde" },
  { id:37, brand:"Mopral",            inn:"Oméprazole",              form:"Gélule",       dosage:"20mg / 40mg",    route:"Per os",   category:"IPP - Antiulcéreux" },
  { id:38, brand:"Inexium",           inn:"Ésoméprazole",            form:"Comprimé",     dosage:"20mg / 40mg",    route:"Per os",   category:"IPP - Antiulcéreux" },
  { id:39, brand:"Zophren",           inn:"Ondansétron",             form:"Comprimé",     dosage:"4mg / 8mg",      route:"Per os/IV",category:"Antiémétique" },
  { id:40, brand:"Rivotril",          inn:"Clonazépam",              form:"Comprimé",     dosage:"2mg",            route:"Per os",   category:"Antiépileptique" },
  { id:41, brand:"Dépakine",          inn:"Valproate",               form:"Comprimé LP",  dosage:"200mg / 500mg",  route:"Per os",   category:"Antiépileptique" },
  { id:42, brand:"Keppra",            inn:"Lévétiracétam",           form:"Comprimé",     dosage:"250mg / 500mg",  route:"Per os",   category:"Antiépileptique" },
  { id:43, brand:"Propofol",          inn:"Propofol",                form:"Injectable",   dosage:"10mg/mL",        route:"IV",       category:"Anesthésique général" },
  { id:44, brand:"NaCl 0.9%",         inn:"Chlorure de sodium",      form:"Injectable",   dosage:"500mL / 1L",     route:"IV",       category:"Soluté de remplissage" },
  { id:45, brand:"Ringer Lactate",    inn:"Ringer Lactate",          form:"Injectable",   dosage:"500mL / 1L",     route:"IV",       category:"Soluté de remplissage" },
];

// Allergies connues par patient (pour détection de conflits)
const KNOWN_ALLERGIES = {
  2: ["pénicilline", "amoxicilline", "augmentin", "clamoxyl"],
  3: ["ibuprofène", "advil", "kétoprofène", "profenid"],
};

// Correction automatique des fautes de frappe courantes
const TYPO_CORRECTIONS = {
  "dolipran":    "Doliprane", "dolipranr":    "Doliprane", "dolipranne": "Doliprane",
  "amoxiciline": "Amoxicilline",
  "paracetamol": "Paracétamol",
  "ibuprofene":  "Ibuprofène",
  "morphyne":    "Morphine",   "morfine":      "Morphine",
  "dupond":      "Dupont",     "dupon":        "Dupont",
  "lefevre":     "Lefevre",    "lefèvre":      "Lefevre",
  "hakimy":      "Hakimi",
};

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

// NLP autocomplete: patient names, drug names, common phrases, medical terms
const AUTOCOMPLETE_CORPUS = [
  // Patient names
  ...DB_PATIENTS.map(p => `patient ${p.last_name}`),
  ...DB_PATIENTS.map(p => `M. ${p.last_name}`),
  ...DB_PATIENTS.map(p => `Mme ${p.last_name}`),
  // Drug names
  ...DB_MEDICAMENTS.map(m => `${m.brand}`),
  ...DB_MEDICAMENTS.map(m => `${m.inn}`),
  // Common phrase templates
  "Patient [nom] a besoin de [dose] de [médicament] par voie orale",
  "Prescrire [médicament] [dose] par voie [IV/Per os/SC] [fréquence]",
  "Allergie à [substance] chez le patient [nom]",
  "Transfert du patient [nom] vers le service de [cardiologie/neurologie/urgences]",
  "Radiographie thoracique pour le patient chambre [N°]",
  "Bilan sanguin complet pour [patient]",
  "Injection de [médicament] [dose] en IV toutes les [N]h",
  "Renouveler ordonnance de [médicament] pour [patient]",
  "Stopper [médicament] chez [patient] — allergie suspectée",
  "Augmenter dose [médicament] à [dose] — indication [diagnostic]",
  "Prise de sang NFS CRP pour le patient [nom]",
  "Scanner thoracique abdominal en urgence pour [patient]",
  "ECG 12 dérivations en urgence chambre [N°]",
  "Glycémie capillaire [valeur] chez [patient] — adapter insuline",
  "TA [valeur] FC [valeur] chez [patient] — noter dans dossier",
  "Pose de perfusion NaCl 0.9% 500mL sur [N]h pour [patient]",
  "Transfert en réanimation priorité haute — patient [nom]",
  "Sortie prévue demain pour [patient] — ordonnance de sortie",
  "Signaler allergie pénicilline pour [patient]",
  "Douleur EVA [score] chez [patient] — antalgique palier [N]",
  // Routes
  "par voie orale", "par voie intraveineuse", "par voie intramusculaire",
  "par voie sous-cutanée", "par voie inhalée",
  // Frequencies
  "toutes les 6 heures", "toutes les 8 heures", "toutes les 12 heures",
  "1 fois par jour", "2 fois par jour", "3 fois par jour",
  "le matin à jeun", "au coucher", "en urgence STAT",
  // Services
  "service cardiologie", "service neurologie", "service urgences",
  "service réanimation", "service chirurgie", "service maternité",
];

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
      <style>{`@keyframes voicePulse{0%,100%{opacity:1}50%{opacity:0.55}}`}</style>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  TABS
// ─────────────────────────────────────────────────────────────────────────────
const tabs = [
  { id:"nlp", label:"NLP Contextuel" },
  { id:"bio", label:"Sécurité Biométrique" },
  { id:"rx",  label:"Actes & Ordres" },
];

// ─────────────────────────────────────────────────────────────────────────────
//  ROOT COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function SmartUXBots() {
  const [activeTab, setActiveTab]       = useState("nlp");
  // Shared prescriptions store (written by NLPBot, read by RxTab)
  const [prescriptions, setPrescriptions] = useState([]);

  useEffect(() => {
    fetch("http://localhost:3001/api/prescriptions")
      .then(r => r.json())
      .then(data => setPrescriptions(data));
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

  return (
    <div style={{ minHeight:"100vh", background:BG, fontFamily:"'DM Sans', sans-serif", color:"#1A1A2E" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet" />

      {/* Header */}
      <header style={{ background:ACCENT, padding:"28px 32px 22px", display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:16 }}>
        <div style={{ display:"flex", alignItems:"center", gap:14 }}>
          <div style={{ width:42, height:42, borderRadius:10, background:ACCENT2, display:"grid", placeItems:"center", fontWeight:700, color:"#fff", fontSize:18, fontFamily:"'Space Mono', monospace" }}>S</div>
          <div>
            <div style={{ color:"#fff", fontWeight:700, fontSize:20, letterSpacing:-0.3 }}>SmartUX-AI</div>
            <div style={{ color:"rgba(255,255,255,.6)", fontSize:12, marginTop:2 }}>Prototype — Projet CRIStAL × Centrale Lille</div>
          </div>
        </div>
        <div style={{ display:"flex", gap:6 }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
              padding:"8px 18px", borderRadius:8, border:"none",
              fontFamily:"'DM Sans', sans-serif", fontWeight:600, fontSize:13, cursor:"pointer",
              background: activeTab === t.id ? "#fff" : "rgba(255,255,255,.12)",
              color: activeTab === t.id ? ACCENT : "rgba(255,255,255,.8)",
              transition:"all .2s",
              position:"relative",
            }}>
              {t.label}
              {t.id === "rx" && (() => {
                const now30   = new Date(Date.now() + 30*60*1000);
                const urgent  = prescriptions.filter(r => !r.is_validated && !r.is_cancelled && (r.priorite === "URGENTE" || r.priorite === "STAT")).length;
                // Orange badge = only non-urgent pending tasks (urgent ones are already shown in red badge)
                const pending = prescriptions.filter(r => !r.is_validated && !r.is_cancelled && r.priorite !== "URGENTE" && r.priorite !== "STAT").length;
                const expiring30 = prescriptions.filter(r => !r.is_validated && !r.is_cancelled && r.echeance && new Date(r.echeance) > new Date() && new Date(r.echeance) <= now30).length;
                return (
                  <>
                    {expiring30 > 0 && (
                      <span title={`${expiring30} acte(s) expirant dans moins de 30 min`} style={{
                        position:"absolute", top:-7, right: urgent > 0 ? (pending > 0 ? 28 : 14) : pending > 0 ? 14 : -7,
                        minWidth:18, height:18, borderRadius:9, padding:"0 4px",
                        background:"#F97316", color:"#fff", fontSize:10, fontWeight:700,
                        display:"grid", placeItems:"center", boxSizing:"border-box",
                        border:"2px solid #F97316",
                      }}>{expiring30}</span>
                    )}
                    {pending > 0 && (
                      <span title={`${pending} acte(s) non-urgent(s) à faire`} style={{
                        position:"absolute", top:-7, right: urgent > 0 ? 14 : -7,
                        minWidth:18, height:18, borderRadius:9, padding:"0 4px",
                        background:AMBER, color:"#fff", fontSize:10, fontWeight:700,
                        display:"grid", placeItems:"center", boxSizing:"border-box",
                        border:"2px solid #F59E0B",
                      }}>
                        {pending}
                      </span>
                    )}
                    {urgent > 0 && (
                      <span title={`${urgent} tâche(s) urgente(s)`} style={{
                        position:"absolute", top:-7, right:-7,
                        minWidth:18, height:18, borderRadius:9, padding:"0 4px",
                        background:RED, color:"#fff", fontSize:10, fontWeight:700,
                        display:"grid", placeItems:"center", boxSizing:"border-box",
                        border:"2px solid #EF4444",
                      }}>
                        {urgent}
                      </span>
                    )}
                  </>
                );
              })()}
            </button>
          ))}
        </div>
      </header>

      <main style={{ maxWidth:980, margin:"0 auto", padding:"28px 20px 60px" }}>
        {activeTab === "nlp" && <NLPBot onPrescription={addPrescription} />}
        {activeTab === "bio" && <BioBot />}
        {activeTab === "rx"  && <RxTab prescriptions={prescriptions} onUpdate={updatePrescription} />}
      </main>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  NLP BOT
// ─────────────────────────────────────────────────────────────────────────────
function NLPBot({ onPrescription }) {
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
    <div>
      {/* Info banner */}
      <div style={{ background:CARD, borderRadius:14, padding:"20px 24px", marginBottom:20, border:"1px solid #E5E7EB", display:"flex", gap:14, alignItems:"flex-start" }}>
        <div style={{ width:42, height:42, borderRadius:10, background:ACCENT+"15", display:"grid", placeItems:"center", flexShrink:0 }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        </div>
        <div>
          <div style={{ fontWeight:700, fontSize:16, marginBottom:4 }}>Bot NLP Contextuel — Saisie en langage naturel</div>
          <div style={{ color:MUTED, fontSize:13, lineHeight:1.5 }}>
            Saisissez une phrase médicale. L'IA extrait automatiquement les données (patient, médicament, dose, voie, fréquence…) et propose de les enregistrer dans la table <strong>prescriptions</strong> de SILLAGE.
          </div>
        </div>
      </div>

      {/* Examples */}
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

      {/* Chat area */}
      <div style={{ background:CARD, borderRadius:14, border:"1px solid #E5E7EB", minHeight:340, maxHeight:520, overflowY:"auto", padding:"18px 20px", display:"flex", flexDirection:"column", gap:14 }}>
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
      <div style={{ display:"flex", gap:10, marginTop:14, alignItems:"flex-start" }}>
        <AutocompleteInput
          value={input}
          onChange={setInput}
          onSubmit={send}
          loading={loading}
          placeholder={pendingDelay ? "Saisissez le délai imparti (ex : 2h, 24h, 3 jours, aucun)…" : undefined}
        />
        <Btn onClick={() => send(input)} disabled={loading || !input.trim()}>
          {pendingDelay ? "Confirmer" : "Analyser"}
        </Btn>
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
    <div style={{
      background: CARD,
      borderRadius: 14,
      border: `1px solid ${rx.allergyAlert ? RED+"60" : borderColor}`,
      overflow: "hidden",
      transition: "border-color .2s",
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
      <div style={{ background: CARD, borderRadius: 14, padding: "18px 24px", marginBottom: 24, border: "1px solid #E5E7EB", display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
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

function BioBot() {
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

  const simulateVerify = useCallback(() => { setStep("verifying"); setTimeout(() => setStep("granted"), 2200); }, []);
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
    setTimeout(() => setStep("granted"), 1600);
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
      {/* Info banner */}
      <div style={{ background:CARD, borderRadius:14, padding:"20px 24px", marginBottom:20, border:"1px solid #E5E7EB", display:"flex", gap:14, alignItems:"flex-start" }}>
        <div style={{ width:42, height:42, borderRadius:10, background:ACCENT2+"15", display:"grid", placeItems:"center", flexShrink:0 }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={ACCENT2} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        </div>
        <div>
          <div style={{ fontWeight:700, fontSize:16, marginBottom:4 }}>Bot Sécurité Biométrique — Base personnel SILLAGE</div>
          <div style={{ color:MUTED, fontSize:13, lineHeight:1.5 }}>
            Sélectionnez un membre du personnel hospitalier (issu de la base de données) pour simuler la vérification biométrique. Les droits accordés sont ceux définis dans la table <strong>roles</strong> et <strong>role_permissions</strong>.
          </div>
        </div>
      </div>

      <div style={{ display:"flex", gap:20, flexWrap:"wrap" }}>
        {/* Left: staff selector */}
        <div style={{ flex:"1 1 300px" }}>
          <div style={{ background:CARD, borderRadius:14, border:"1px solid #E5E7EB", padding:20, marginBottom:16 }}>
            <div style={{ fontWeight:700, fontSize:14, marginBottom:12 }}>1 — Sélection du personnel (base SILLAGE)</div>
            {/* Search */}
            <input
              value={searchStaff}
              onChange={e => setSearchStaff(e.target.value)}
              placeholder="Rechercher par nom, rôle, service…"
              style={{ width:"100%", boxSizing:"border-box", padding:"8px 12px", borderRadius:8, border:"1.5px solid #E5E7EB", fontFamily:"'DM Sans', sans-serif", fontSize:13, outline:"none", marginBottom:10 }}
            />
            <div style={{ display:"flex", flexDirection:"column", gap:6, maxHeight:340, overflowY:"auto" }}>
              {filteredStaff.map(u => (
                <button key={u.staff_id} onClick={() => setSelectedUser(u)} style={{
                  display:"flex", alignItems:"center", gap:10, padding:"10px 14px",
                  borderRadius:10, cursor:"pointer", fontFamily:"'DM Sans', sans-serif", textAlign:"left",
                  border: selectedUser?.staff_id === u.staff_id ? `2px solid ${ACCENT2}` : "1.5px solid #E5E7EB",
                  background: selectedUser?.staff_id === u.staff_id ? ACCENT2+"0A" : "#fff",
                  transition:"all .15s",
                }}>
                  {/* Access level circle */}
                  <div style={{ width:34, height:34, borderRadius:"50%", background:levelColor(u.access_level)+"20", display:"grid", placeItems:"center", flexShrink:0 }}>
                    <span style={{ fontWeight:800, fontSize:13, color:levelColor(u.access_level) }}>{u.access_level}</span>
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontWeight:600, fontSize:13 }}>{u.title && u.title + " "}{u.first_name} {u.last_name}</div>
                    <div style={{ fontSize:11, color:MUTED, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                      {u.role_label} · {u.dept}
                    </div>
                  </div>
                  <span title={u.biometric_enrolled ? "Biométrie enrolée" : "Non enrolée"} style={{
                    width:8, height:8, borderRadius:"50%", flexShrink:0,
                    background: u.biometric_enrolled ? GREEN : "#D1D5DB",
                    display:"inline-block",
                  }} />
                </button>
              ))}
            </div>
          </div>

          {/* Auth flow diagram */}
          <div style={{ background:CARD, borderRadius:14, border:"1px solid #E5E7EB", padding:20 }}>
            <div style={{ fontWeight:700, fontSize:14, marginBottom:12 }}>Flux d'authentification</div>
            {[
              { n:"1", t:"Clic sur option sensible",     done:!!selectedUser },
              { n:"2", t:"Redirection portail SSC",      done:!!selectedUser },
              { n:"3", t:"Demande d'auth biométrique",   done:camActive },
              { n:"4", t:"Vérification annuaire",        done:step==="verifying"||step==="granted" },
              { n:"5", t:"Reconnaissance faciale",       done:step==="granted" },
              { n:"6", t:"Droits accordés — Accès",      done:step==="granted" },
            ].map((s,i) => (
              <div key={i} style={{ display:"flex", gap:10, alignItems:"center", padding:"5px 0", opacity:s.done ? 1 : 0.35, transition:"opacity .3s" }}>
                <div style={{ width:22, height:22, borderRadius:"50%", background:s.done ? GREEN : "#E5E7EB", color:s.done?"#fff":MUTED, display:"grid", placeItems:"center", fontSize:10, fontWeight:700, flexShrink:0 }}>
                  {s.done ? "✓" : s.n}
                </div>
                <span style={{ fontSize:13 }}>{s.t}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right: auth panel */}
        <div style={{ flex:"1 1 380px" }}>
          <div style={{ background:CARD, borderRadius:14, border:"1px solid #E5E7EB", padding:20 }}>
            <div style={{ fontWeight:700, fontSize:14, marginBottom:14, textAlign:"center" }}>2 — Méthode d'authentification</div>

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
                  {step === "idle"    && <Btn variant="accent" onClick={startCam} disabled={!selectedUser}>{selectedUser ? "Activer la caméra" : "Sélectionnez un utilisateur"}</Btn>}
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
                    <div style={{ color:"rgba(255,255,255,.5)", fontSize:13 }}>
                      {selectedUser ? `Badge : ${selectedUser.employee_number}` : "Sélectionnez un utilisateur, puis approchez votre badge"}
                    </div>
                  )}
                  {step === "granted" && (
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke={GREEN} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                  )}
                </div>
                <div style={{ marginTop:14, padding:"8px 16px", borderRadius:8, background:stepColors[step]+"12", color:stepColors[step], fontWeight:600, fontSize:13, display:"inline-block" }}>
                  {stepLabels[step]}
                </div>
                <div style={{ display:"flex", justifyContent:"center", gap:10, marginTop:16, flexWrap:"wrap" }}>
                  {step === "idle" && <Btn variant="accent" onClick={() => { setStep("verifying"); setTimeout(() => setStep("granted"), 1800); }} disabled={!selectedUser}>{selectedUser ? "Simuler lecture badge" : "Sélectionnez un utilisateur"}</Btn>}
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
    </div>
  );
}
