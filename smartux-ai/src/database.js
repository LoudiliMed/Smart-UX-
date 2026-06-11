// ─────────────────────────────────────────────────────────────────────────────
//  DATABASE CONSTANTS  (seeded from sillage_database.sql)
// ─────────────────────────────────────────────────────────────────────────────

export const DB_PATIENTS = [
  { patient_id:1, ipp:"IPP-000001", last_name:"Dupont",   first_name:"Jean",    date_of_birth:"1955-06-14", gender:"M", blood_type:"A+",  room:"102", ward:"Cardiologie Conventionnelle" },
  { patient_id:2, ipp:"IPP-000002", last_name:"Lefevre",  first_name:"Martine", date_of_birth:"1942-11-28", gender:"F", blood_type:"O-",  room:"301", ward:"Neurologie Conventionnelle" },
  { patient_id:3, ipp:"IPP-000003", last_name:"Hakimi",   first_name:"Youssef", date_of_birth:"1989-03-05", gender:"M", blood_type:"B+",  room:"201", ward:"Chirurgie Digestive" },
  { patient_id:4, ipp:"IPP-000004", last_name:"Morin",    first_name:"Claire",  date_of_birth:"1998-07-20", gender:"F", blood_type:"AB+", room:"501", ward:"Maternité" },
  { patient_id:5, ipp:"IPP-000005", last_name:"Tremblay", first_name:"René",    date_of_birth:"1960-01-19", gender:"M", blood_type:"O+",  room:"102", ward:"Cardiologie Conventionnelle" },
  { patient_id:6, ipp:"IPP-000006", last_name:"Nguyen",   first_name:"Thi Lan", date_of_birth:"1975-09-12", gender:"F", blood_type:"A-",  room:"202", ward:"Chirurgie Orthopédique" },
];

export const DB_STAFF = [
  { staff_id:1,  employee_number:"EMP-001", title:"Dr",   last_name:"Martin",    first_name:"Sophie",   role_label:"Médecin",             access_level:4, dept:"Cardiologie",          specialty:"Cardiologie",            biometric_enrolled:1 },
  { staff_id:2,  employee_number:"EMP-002", title:"Pr",   last_name:"Dubois",    first_name:"Laurent",  role_label:"Médecin",             access_level:4, dept:"Neurologie",           specialty:"Neurologie",             biometric_enrolled:1 },
  { staff_id:3,  employee_number:"EMP-003", title:"Dr",   last_name:"Bernard",   first_name:"Isabelle", role_label:"Chirurgien",          access_level:4, dept:"Chirurgie Générale",   specialty:"Chirurgie Digestive",    biometric_enrolled:1 },
  { staff_id:4,  employee_number:"EMP-004", title:"Dr",   last_name:"Leroy",     first_name:"Karim",    role_label:"Anesthésiste-Réanimateur", access_level:4, dept:"Réanimation",     specialty:"Anesthésie-Réanimation", biometric_enrolled:1 },
  { staff_id:5,  employee_number:"EMP-005", title:"",     last_name:"Moreau",    first_name:"Céline",   role_label:"Cadre de Santé",      access_level:3, dept:"Cardiologie",          specialty:null,                     biometric_enrolled:1 },
  { staff_id:6,  employee_number:"EMP-006", title:"IDE",  last_name:"Simon",     first_name:"Pierre",   role_label:"Infirmier(e) Diplômé(e) d'État", access_level:3, dept:"Urgences", specialty:null,                biometric_enrolled:0 },
  { staff_id:7,  employee_number:"EMP-007", title:"AS",   last_name:"Laurent",   first_name:"Nadia",    role_label:"Aide-Soignant(e)",    access_level:2, dept:"Chirurgie Orthopédique",specialty:null,                   biometric_enrolled:0 },
  { staff_id:8,  employee_number:"EMP-008", title:"Dr",   last_name:"Rousseau",  first_name:"Marc",     role_label:"Biologiste Médical",  access_level:4, dept:"Laboratoire",          specialty:"Biologie Médicale",      biometric_enrolled:1 },
  { staff_id:9,  employee_number:"EMP-009", title:"Dr",   last_name:"Petit",     first_name:"Amina",    role_label:"Radiologue",          access_level:4, dept:"Radiologie",           specialty:"Radiologie",             biometric_enrolled:1 },
  { staff_id:10, employee_number:"EMP-010", title:"",     last_name:"Garcia",    first_name:"Julien",   role_label:"Stagiaire / Interne", access_level:2, dept:"Neurologie",           specialty:"Interne Neurologie",     biometric_enrolled:0 },
  { staff_id:11, employee_number:"EMP-011", title:"",     last_name:"Fontaine",  first_name:"Léa",      role_label:"Sage-Femme",          access_level:4, dept:"Maternité",            specialty:"Obstétrique",            biometric_enrolled:1 },
  { staff_id:12, employee_number:"EMP-012", title:"",     last_name:"Renard",    first_name:"Thomas",   role_label:"Pharmacien",          access_level:3, dept:"Pharmacie",            specialty:"Pharmacie Clinique",     biometric_enrolled:0 },
  { staff_id:13, employee_number:"EMP-013", title:"",     last_name:"Chevalier", first_name:"Marie",    role_label:"Secrétaire Médicale", access_level:2, dept:"Administration",       specialty:null,                     biometric_enrolled:0 },
  { staff_id:14, employee_number:"EMP-014", title:"",     last_name:"Bonnet",    first_name:"Paul",     role_label:"Agent d'Accueil",     access_level:1, dept:"Administration",       specialty:null,                     biometric_enrolled:0 },
  { staff_id:15, employee_number:"EMP-015", title:"",     last_name:"Dupont",    first_name:"Hélène",   role_label:"Administrateur Système", access_level:5, dept:"Administration",    specialty:null,                     biometric_enrolled:1 },
  // ── Compte administrateur ──────────────────────────────────────────────────
  { staff_id:16, employee_number:"EMP-ADM", title:"",     last_name:"",          first_name:"Admin",    role_label:"Super Administrateur",access_level:5, dept:"Administration Système",specialty:"Gestion des accès",      biometric_enrolled:1 },
];

// Permissions per access level (simplified from role_permissions table)
export const ACCESS_PERMISSIONS = {
  1: ["PAT_VIEW_ID"],
  2: ["PAT_VIEW_ID","PAT_VIEW_CLINICAL","PAT_VIEW_MEDS"],
  3: ["PAT_VIEW_ID","PAT_VIEW_CLINICAL","PAT_EDIT_CLINICAL","PAT_VIEW_LABS","PAT_VIEW_MEDS","PAT_VIEW_IMAGING","STAFF_VIEW"],
  4: ["PAT_VIEW_ID","PAT_VIEW_CLINICAL","PAT_EDIT_CLINICAL","PAT_VIEW_LABS","PAT_VIEW_IMAGING","PAT_PRESCRIBE","PAT_VIEW_MEDS","PAT_ADMIT","STAFF_VIEW","BILL_VIEW"],
  5: ["ALL_PERMISSIONS"],
};

export const PERM_LABELS = {
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

export const DB_MEDICAMENTS = [
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
export const KNOWN_ALLERGIES = {
  2: ["pénicilline", "amoxicilline", "augmentin", "clamoxyl"],
  3: ["ibuprofène", "advil", "kétoprofène", "profenid"],
};

// ─────────────────────────────────────────────────────────────────────────────
//  IMAGERIE — 2 examens par patient (12 total)
// ─────────────────────────────────────────────────────────────────────────────
export const DB_IMAGERIE = [
  // Patient 1 — Dupont Jean (Cardiologie)
  { id:1,  patient_id:1, type:"Radiographie thoracique",  date:"2026-02-28", status:"Disponible",  description:"Contrôle post-pose pace-maker. Résultat normal, positionnement correct.", reader:"Dr Petit (Amina)", priority:"NORMALE" },
  { id:2,  patient_id:1, type:"Échographie cardiaque",    date:"2026-03-01", status:"Réalisé",     description:"FEVG évaluée à 45%. Dilatation légère du ventricule gauche.",           reader:"Dr Petit (Amina)", priority:"NORMALE" },
  // Patient 2 — Lefevre Martine (Neurologie)
  { id:3,  patient_id:2, type:"IRM cérébrale",            date:"2026-03-04", status:"En attente",  description:"Bilan AVC ischémique. Territoire ACM gauche. Attente lecture urgente.", reader:null,              priority:"URGENTE" },
  { id:4,  patient_id:2, type:"Scanner cérébral",         date:"2026-02-27", status:"Disponible",  description:"Hématome sous-dural chronique droit. Pas d'engagement.",                reader:"Dr Petit (Amina)", priority:"NORMALE" },
  // Patient 3 — Hakimi Youssef (Chirurgie Digestive)
  { id:5,  patient_id:3, type:"Scanner abdominal",        date:"2026-02-25", status:"Réalisé",     description:"Appendicite aiguë non compliquée confirmée. Chirurgie programmée J+1.", reader:"Dr Petit (Amina)", priority:"NORMALE" },
  { id:6,  patient_id:3, type:"Radiographie abdomen",     date:"2026-02-24", status:"Disponible",  description:"ASP de débrouillage. Niveaux hydroaériques minimes. Pas de pneumopéritoine.", reader:"Dr Petit (Amina)", priority:"NORMALE" },
  // Patient 4 — Morin Claire (Maternité)
  { id:7,  patient_id:4, type:"Échographie obstétricale", date:"2026-03-02", status:"Réalisé",     description:"Grossesse 32SA. Biométrie normale. Position céphalique. Placenta antérieur.", reader:"Dr Petit (Amina)", priority:"NORMALE" },
  { id:8,  patient_id:4, type:"Radiographie bassin",      date:"2026-03-03", status:"En attente",  description:"Évaluation filière pelvienne avant accouchement.",                        reader:null,              priority:"NORMALE" },
  // Patient 5 — Tremblay René (Cardiologie)
  { id:9,  patient_id:5, type:"Angiographie coronaire",   date:"2026-03-04", status:"En attente",  description:"Bilan syndrome coronarien aigu. Sténose suspectée IVA. Procédure urgente.", reader:null,            priority:"URGENTE" },
  { id:10, patient_id:5, type:"Scintigraphie cardiaque",  date:"2026-02-20", status:"Disponible",  description:"Ischémie d'effort territoire antérieur. Indice de perfusion 74%.",        reader:"Dr Petit (Amina)", priority:"NORMALE" },
  // Patient 6 — Nguyen Thi Lan (Chirurgie Orthopédique)
  { id:11, patient_id:6, type:"Radiographie genou droit", date:"2026-03-01", status:"Disponible",  description:"Gonarthrose stade III. Pincement fémorotibial interne marqué.",            reader:"Dr Petit (Amina)", priority:"NORMALE" },
  { id:12, patient_id:6, type:"IRM genou droit",          date:"2026-03-04", status:"En attente",  description:"Bilan ménisque interne. Préparation chirurgie prothèse totale genou.",     reader:null,              priority:"NORMALE" },
];

// ─────────────────────────────────────────────────────────────────────────────
//  OBSERVATIONS — 2 notes cliniques par patient (12 total)
// ─────────────────────────────────────────────────────────────────────────────
export const DB_OBSERVATIONS = [
  // Patient 1 — Dupont Jean
  { id:1,  patient_id:1, date:"2026-02-26T08:15:00", author:"Dr Martin Sophie",   category:"Entrée",    text:"Patient admis pour insuffisance cardiaque décompensée. Dyspnée stade III NYHA. Œdèmes des membres inférieurs bilatéraux. Mise en route traitement diurétique IV." },
  { id:2,  patient_id:1, date:"2026-03-01T14:30:00", author:"Dr Martin Sophie",   category:"Évolution", text:"Amélioration clinique notable. Perte de 3,5 kg depuis l'admission. Dyspnée réduite stade II. Relai per os du furosémide. Échocardiographie programmée." },
  // Patient 2 — Lefevre Martine
  { id:3,  patient_id:2, date:"2026-02-27T03:40:00", author:"Dr Dubois Laurent",  category:"Urgence",   text:"Admission aux urgences neurologique pour déficit moteur brutal hémicorps droit et aphasie. Score NIHSS : 14. Thrombolyse IV débutée H+2h45. IRM en cours." },
  { id:4,  patient_id:2, date:"2026-03-02T10:00:00", author:"Dr Dubois Laurent",  category:"Évolution", text:"Récupération partielle. NIHSS à 8. Aphasie résiduelle modérée. Reprise déglutition surveillée. Rééducation orthophonie initiée. Anticoagulation relai Xarelto." },
  // Patient 3 — Hakimi Youssef
  { id:5,  patient_id:3, date:"2026-02-24T22:10:00", author:"Dr Bernard Isabelle",category:"Entrée",    text:"Patient admis aux urgences chirurgicales pour douleurs FID. Défense abdominale localisée. Score de Alvarado : 9/10. Appendicite aiguë très probable. Bilan préopératoire en cours." },
  { id:6,  patient_id:3, date:"2026-02-26T09:00:00", author:"Dr Bernard Isabelle",category:"Évolution", text:"Appendicectomie cœlioscopique réalisée sans complication. Suites opératoires simples. Reprise alimentaire possible. Sortie prévue demain si afébrile." },
  // Patient 4 — Morin Claire
  { id:7,  patient_id:4, date:"2026-02-28T11:20:00", author:"Fontaine Léa (SF)",  category:"Entrée",    text:"Patiente admise en maternité pour surveillance contractions prématurées à 31SA+4J. CTG satisfaisante. Tocoly se mise en route. Corticothérapie de maturation pulmonaire débutée." },
  { id:8,  patient_id:4, date:"2026-03-03T08:45:00", author:"Fontaine Léa (SF)",  category:"Évolution", text:"Contractions espacées. CTG normale. Traitements bien tolérés. Patiente stabilisée. Poursuite surveillance hospitalière. Échographie contrôle prévue demain." },
  // Patient 5 — Tremblay René
  { id:9,  patient_id:5, date:"2026-03-03T23:55:00", author:"Dr Martin Sophie",   category:"Urgence",   text:"Admission USIC pour douleur thoracique rétrosternale depuis 3h, typique. Sus-décalage ST V1-V4. IDM antérieur étendu STEMI. Double antiagrégation chargée. Coronarographie en urgence planifiée." },
  { id:10, patient_id:5, date:"2026-03-04T07:00:00", author:"Dr Leroy Karim",     category:"Évolution", text:"Nuit en USIC sous surveillance continue. Hémodynamique stable. FEVG estimée à 40%. Coronarographie programmée ce matin. Patient informé et consentement signé." },
  // Patient 6 — Nguyen Thi Lan
  { id:11, patient_id:6, date:"2026-02-20T10:30:00", author:"Dr Bernard Isabelle",category:"Entrée",    text:"Patiente admise pour bilan préopératoire prothèse totale genou droit. Gonarthrose évoluée, douleurs rebelles aux traitements médicaux. Invalidité fonctionnelle majeure. Chirurgie programmée J+7." },
  { id:12, patient_id:6, date:"2026-03-02T15:00:00", author:"Dr Bernard Isabelle",category:"Évolution", text:"PTG droite posée sans complication. Prothèse cimentée à plateau fixe. Saignement peropératoire 350mL. Réveil salle de réveil sans incident. Kiné débutée J+1 post-op." },
];

// ─────────────────────────────────────────────────────────────────────────────
//  CONSTANTES — 3 mesures par patient (18 total)
// ─────────────────────────────────────────────────────────────────────────────
export const DB_CONSTANTES = [
  // Patient 1 — Dupont Jean (Cardiologie)
  { id:1,  patient_id:1, date:"2026-02-26T08:00:00", ta:"158/92", fc:88,  temp:37.1, spo2:94, poids:83 },
  { id:2,  patient_id:1, date:"2026-03-01T08:00:00", ta:"142/85", fc:76,  temp:36.9, spo2:96, poids:81 },
  { id:3,  patient_id:1, date:"2026-03-04T08:00:00", ta:"130/78", fc:72,  temp:36.8, spo2:97, poids:79.5 },
  // Patient 2 — Lefevre Martine (Neurologie)
  { id:4,  patient_id:2, date:"2026-02-27T04:00:00", ta:"185/110",fc:96,  temp:37.4, spo2:96, poids:62 },
  { id:5,  patient_id:2, date:"2026-03-01T08:00:00", ta:"160/95", fc:84,  temp:37.2, spo2:97, poids:62 },
  { id:6,  patient_id:2, date:"2026-03-04T08:00:00", ta:"145/88", fc:78,  temp:37.0, spo2:98, poids:62 },
  // Patient 3 — Hakimi Youssef (Chirurgie Digestive)
  { id:7,  patient_id:3, date:"2026-02-24T22:00:00", ta:"122/78", fc:102, temp:38.4, spo2:99, poids:74 },
  { id:8,  patient_id:3, date:"2026-02-26T08:00:00", ta:"118/74", fc:88,  temp:37.8, spo2:99, poids:73 },
  { id:9,  patient_id:3, date:"2026-03-04T08:00:00", ta:"120/76", fc:80,  temp:37.1, spo2:99, poids:73.5 },
  // Patient 4 — Morin Claire (Maternité)
  { id:10, patient_id:4, date:"2026-02-28T11:00:00", ta:"118/72", fc:90,  temp:37.0, spo2:99, poids:68 },
  { id:11, patient_id:4, date:"2026-03-01T08:00:00", ta:"120/74", fc:86,  temp:36.9, spo2:99, poids:68 },
  { id:12, patient_id:4, date:"2026-03-04T08:00:00", ta:"116/70", fc:82,  temp:37.0, spo2:99, poids:67.5 },
  // Patient 5 — Tremblay René (Cardiologie)
  { id:13, patient_id:5, date:"2026-03-04T00:00:00", ta:"100/65", fc:112, temp:37.6, spo2:93, poids:90 },
  { id:14, patient_id:5, date:"2026-03-04T04:00:00", ta:"108/70", fc:98,  temp:37.3, spo2:95, poids:90 },
  { id:15, patient_id:5, date:"2026-03-04T08:00:00", ta:"115/72", fc:88,  temp:37.1, spo2:96, poids:90 },
  // Patient 6 — Nguyen Thi Lan (Chirurgie Orthopédique)
  { id:16, patient_id:6, date:"2026-02-20T10:00:00", ta:"132/80", fc:74,  temp:36.8, spo2:98, poids:58 },
  { id:17, patient_id:6, date:"2026-03-02T08:00:00", ta:"128/76", fc:86,  temp:37.9, spo2:97, poids:57.5 },
  { id:18, patient_id:6, date:"2026-03-04T08:00:00", ta:"124/78", fc:80,  temp:37.2, spo2:98, poids:57.5 },
];

// Correction automatique des fautes de frappe courantes
export const TYPO_CORRECTIONS = {
  "dolipran":    "Doliprane", "dolipranr":    "Doliprane", "dolipranne": "Doliprane",
  "amoxiciline": "Amoxicilline",
  "paracetamol": "Paracétamol",
  "ibuprofene":  "Ibuprofène",
  "morphyne":    "Morphine",   "morfine":      "Morphine",
  "dupond":      "Dupont",     "dupon":        "Dupont",
  "lefevre":     "Lefevre",    "lefèvre":      "Lefevre",
  "hakimy":      "Hakimi",
};

// NLP autocomplete: patient names, drug names, common phrases, medical terms
export const AUTOCOMPLETE_CORPUS = [
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
