-- =============================================================================
-- SILLAGE Hospital Information System — Database Schema
-- Project : SmartUX-AI · CRIStAL × Centrale Lille
-- Date    : 2026-03-04
-- Dialect : SQLite 3 (compatible with PostgreSQL with minor type adjustments)
-- =============================================================================

PRAGMA foreign_keys = ON;   -- SQLite: enforce FK constraints


-- =============================================================================
-- SECTION 1 — REFERENCE TABLES
-- =============================================================================

-- ----------------------------------------------------------------------------
-- 1.1  ROLES — defines every job category in the hospital
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS roles (
    role_id         INTEGER PRIMARY KEY AUTOINCREMENT,
    role_code       TEXT    NOT NULL UNIQUE,          -- e.g. 'DOCTOR', 'NURSE'
    role_label      TEXT    NOT NULL,                 -- display name (French)
    access_level    INTEGER NOT NULL                  -- 1 (read-only) → 5 (full admin)
                            CHECK (access_level BETWEEN 1 AND 5),
    description     TEXT
);

-- ----------------------------------------------------------------------------
-- 1.2  PERMISSIONS — atomic actions that can be granted per role
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS permissions (
    perm_id         INTEGER PRIMARY KEY AUTOINCREMENT,
    perm_code       TEXT    NOT NULL UNIQUE,
    perm_label      TEXT    NOT NULL,
    perm_category   TEXT    NOT NULL                  -- 'PATIENT', 'STAFF', 'SYSTEM', 'BILLING'
);

-- ----------------------------------------------------------------------------
-- 1.3  ROLE_PERMISSIONS — many-to-many: which role gets which permission
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS role_permissions (
    role_id         INTEGER NOT NULL REFERENCES roles(role_id)       ON DELETE CASCADE,
    perm_id         INTEGER NOT NULL REFERENCES permissions(perm_id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, perm_id)
);

-- ----------------------------------------------------------------------------
-- 1.4  DEPARTMENTS — hospital organisational units
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS departments (
    dept_id         INTEGER PRIMARY KEY AUTOINCREMENT,
    dept_code       TEXT    NOT NULL UNIQUE,
    dept_name       TEXT    NOT NULL,
    floor           TEXT,
    chief_staff_id  INTEGER                           -- FK added after staff table
);

-- ----------------------------------------------------------------------------
-- 1.5  WARDS — physical wards/units within a department
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS wards (
    ward_id         INTEGER PRIMARY KEY AUTOINCREMENT,
    dept_id         INTEGER NOT NULL REFERENCES departments(dept_id),
    ward_name       TEXT    NOT NULL,
    capacity        INTEGER NOT NULL DEFAULT 20,
    ward_type       TEXT    NOT NULL                  -- 'GENERAL', 'ICU', 'SURGICAL', 'MATERNITY', etc.
);


-- =============================================================================
-- SECTION 2 — STAFF DATABASE
-- =============================================================================

CREATE TABLE IF NOT EXISTS staff (
    -- Identity
    staff_id            INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_number     TEXT    NOT NULL UNIQUE,      -- internal badge / payroll ID
    last_name           TEXT    NOT NULL,
    first_name          TEXT    NOT NULL,
    date_of_birth       DATE,
    gender              TEXT    CHECK (gender IN ('M','F','Autre')),
    national_id         TEXT    UNIQUE,               -- Numéro de sécurité sociale

    -- Contact
    email_pro           TEXT    NOT NULL UNIQUE,
    phone_pro           TEXT,
    phone_personal      TEXT,
    address             TEXT,

    -- Professional
    role_id             INTEGER NOT NULL REFERENCES roles(role_id),
    dept_id             INTEGER NOT NULL REFERENCES departments(dept_id),
    specialty           TEXT,                         -- e.g. 'Cardiologie', 'Anesthésie'
    title               TEXT,                         -- e.g. 'Dr', 'Pr', 'IDE', 'AS'

    -- Employment
    hire_date           DATE    NOT NULL,
    contract_type       TEXT    NOT NULL DEFAULT 'CDI'
                                CHECK (contract_type IN ('CDI','CDD','Intérim','Stagiaire','Vacation')),
    is_active           INTEGER NOT NULL DEFAULT 1    CHECK (is_active IN (0,1)),
    end_date            DATE,                         -- filled when contract ends

    -- System / Security
    sillage_username    TEXT    UNIQUE,               -- login for SILLAGE system
    last_login          DATETIME,
    biometric_enrolled  INTEGER NOT NULL DEFAULT 0    CHECK (biometric_enrolled IN (0,1)),
    mfa_enabled         INTEGER NOT NULL DEFAULT 1    CHECK (mfa_enabled IN (0,1)),
    account_locked      INTEGER NOT NULL DEFAULT 0    CHECK (account_locked IN (0,1)),

    -- Audit
    created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Link department chief back to staff (deferred because staff table didn't exist yet)
-- (In PostgreSQL use a deferred FK constraint; in SQLite we add it as a separate step)

-- Staff schedule / shifts (optional extension)
CREATE TABLE IF NOT EXISTS staff_shifts (
    shift_id        INTEGER PRIMARY KEY AUTOINCREMENT,
    staff_id        INTEGER NOT NULL REFERENCES staff(staff_id) ON DELETE CASCADE,
    shift_date      DATE    NOT NULL,
    shift_start     TIME    NOT NULL,
    shift_end       TIME    NOT NULL,
    ward_id         INTEGER REFERENCES wards(ward_id),
    notes           TEXT
);

-- Audit log for staff access actions
CREATE TABLE IF NOT EXISTS staff_access_log (
    log_id          INTEGER PRIMARY KEY AUTOINCREMENT,
    staff_id        INTEGER NOT NULL REFERENCES staff(staff_id),
    action          TEXT    NOT NULL,                 -- 'LOGIN', 'LOGOUT', 'VIEW_PATIENT', etc.
    target_id       TEXT,                             -- e.g. patient_id accessed
    ip_address      TEXT,
    device_info     TEXT,
    biometric_used  INTEGER NOT NULL DEFAULT 0,
    success         INTEGER NOT NULL DEFAULT 1,
    logged_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);


-- =============================================================================
-- SECTION 3 — PATIENT DATABASE
-- =============================================================================

-- ----------------------------------------------------------------------------
-- 3.1  PATIENTS — core identity and administrative record
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS patients (
    -- Identity
    patient_id          INTEGER PRIMARY KEY AUTOINCREMENT,
    ipp                 TEXT    NOT NULL UNIQUE,      -- Identifiant Permanent du Patient (hospital)
    last_name           TEXT    NOT NULL,
    first_name          TEXT    NOT NULL,
    birth_name          TEXT,                         -- nom de naissance / maiden name
    date_of_birth       DATE    NOT NULL,
    place_of_birth      TEXT,
    gender              TEXT    NOT NULL CHECK (gender IN ('M','F','Autre','Inconnu')),
    nationality         TEXT    DEFAULT 'Française',
    native_language     TEXT    DEFAULT 'Français',

    -- National identifiers
    nir                 TEXT    UNIQUE,               -- Numéro d'Inscription au Répertoire (INSEE)
    ins_code            TEXT    UNIQUE,               -- Identité Nationale de Santé

    -- Contact
    address             TEXT,
    city                TEXT,
    postal_code         TEXT,
    country             TEXT    DEFAULT 'France',
    phone_home          TEXT,
    phone_mobile        TEXT,
    email               TEXT,

    -- Emergency contact
    emergency_contact_name          TEXT,
    emergency_contact_relationship  TEXT,
    emergency_contact_phone         TEXT,

    -- Insurance / Social
    insurance_type      TEXT,                         -- 'CPAM', 'MSA', 'MGEN', 'Mutuelle', etc.
    insurance_number    TEXT,
    mutual_fund         TEXT,
    social_situation    TEXT,                         -- 'Employed', 'Student', 'Retired', etc.

    -- Medical administration
    blood_type          TEXT    CHECK (blood_type IN
                                    ('A+','A-','B+','B-','AB+','AB-','O+','O-','Inconnu')),
    rhesus              TEXT    CHECK (rhesus IN ('+','-','Inconnu')),
    organ_donor         INTEGER NOT NULL DEFAULT 0    CHECK (organ_donor IN (0,1)),
    advance_directive   TEXT,                         -- 'Oui', 'Non', 'En cours'

    -- Consent
    consent_data_use    INTEGER NOT NULL DEFAULT 0,   -- RGPD consent
    consent_research    INTEGER NOT NULL DEFAULT 0,
    consent_date        DATE,

    -- Referring physician (outside hospital)
    referring_doctor    TEXT,
    referring_doctor_id TEXT,                         -- RPPS number

    -- Status
    is_deceased         INTEGER NOT NULL DEFAULT 0    CHECK (is_deceased IN (0,1)),
    date_of_death       DATE,
    cause_of_death      TEXT,

    -- Audit
    created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------------------------------------------------------
-- 3.2  HOSPITALIZATIONS — each admission/stay episode
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS hospitalizations (
    stay_id             INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id          INTEGER NOT NULL REFERENCES patients(patient_id) ON DELETE RESTRICT,
    ward_id             INTEGER REFERENCES wards(ward_id),
    room_number         TEXT,
    bed_number          TEXT,

    -- Dates
    admission_date      DATETIME NOT NULL,
    expected_discharge  DATE,
    actual_discharge    DATETIME,

    -- Clinical context
    admission_type      TEXT    NOT NULL              -- 'URGENCE', 'PROGRAMME', 'TRANSFERT'
                                CHECK (admission_type IN ('URGENCE','PROGRAMME','TRANSFERT','MATERNITE')),
    admission_reason    TEXT,                         -- chief complaint / motif
    admission_source    TEXT,                         -- 'Domicile', 'Urgences', 'Autre hôpital'
    discharge_mode      TEXT,                         -- 'Domicile', 'Transfert', 'Décès', etc.
    discharge_destination TEXT,

    -- Care team
    attending_staff_id  INTEGER REFERENCES staff(staff_id),  -- médecin référent
    surgeon_staff_id    INTEGER REFERENCES staff(staff_id),  -- if surgical stay

    notes               TEXT,
    created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------------------------------------------------------
-- 3.3  DIAGNOSES — ICD-10 coded diagnoses per stay
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS diagnoses (
    diagnosis_id        INTEGER PRIMARY KEY AUTOINCREMENT,
    stay_id             INTEGER NOT NULL REFERENCES hospitalizations(stay_id) ON DELETE CASCADE,
    patient_id          INTEGER NOT NULL REFERENCES patients(patient_id),
    icd10_code          TEXT    NOT NULL,             -- e.g. 'I21.0', 'J18.9'
    icd10_label         TEXT    NOT NULL,
    diagnosis_type      TEXT    NOT NULL              -- 'PRINCIPAL', 'ASSOCIE', 'COMPLICATION'
                                CHECK (diagnosis_type IN ('PRINCIPAL','ASSOCIE','COMPLICATION','ANTECEDENT')),
    diagnosis_date      DATE    NOT NULL,
    confirmed           INTEGER NOT NULL DEFAULT 1,
    staff_id            INTEGER REFERENCES staff(staff_id),   -- who recorded it
    notes               TEXT
);

-- ----------------------------------------------------------------------------
-- 3.4  ALLERGIES — patient allergy & intolerance record
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS allergies (
    allergy_id          INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id          INTEGER NOT NULL REFERENCES patients(patient_id) ON DELETE CASCADE,
    substance           TEXT    NOT NULL,             -- e.g. 'Pénicilline', 'Latex', 'Iode'
    allergy_type        TEXT    NOT NULL              -- 'MEDICAMENT', 'ALIMENTAIRE', 'ENVIRONNEMENT', 'AUTRE'
                                CHECK (allergy_type IN ('MEDICAMENT','ALIMENTAIRE','ENVIRONNEMENT','AUTRE')),
    reaction            TEXT,                         -- e.g. 'Choc anaphylactique', 'Urticaire'
    severity            TEXT    CHECK (severity IN ('LEGERE','MODEREE','SEVERE','INCONNUE')),
    onset_date          DATE,
    confirmed           INTEGER NOT NULL DEFAULT 1,
    recorded_by         INTEGER REFERENCES staff(staff_id),
    recorded_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------------------------------------------------------
-- 3.5  MEDICATIONS — current and past prescriptions
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS medications (
    med_id              INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id          INTEGER NOT NULL REFERENCES patients(patient_id) ON DELETE CASCADE,
    stay_id             INTEGER REFERENCES hospitalizations(stay_id),

    drug_name           TEXT    NOT NULL,
    inn_name            TEXT,                         -- International Non-proprietary Name (DCI)
    dosage              TEXT    NOT NULL,             -- e.g. '500 mg'
    form                TEXT,                         -- 'Comprimé', 'Injectable', 'Sirop'
    route               TEXT,                         -- 'Per os', 'IV', 'IM', 'SC', 'Topique'
    frequency           TEXT    NOT NULL,             -- e.g. '3x/jour', '1x matin'
    start_date          DATE    NOT NULL,
    end_date            DATE,                         -- NULL = ongoing
    indication          TEXT,
    prescribing_staff   INTEGER REFERENCES staff(staff_id),
    is_active           INTEGER NOT NULL DEFAULT 1    CHECK (is_active IN (0,1)),
    notes               TEXT,
    created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------------------------------------------------------
-- 3.6  VITALS — repeated vital sign measurements
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS vitals (
    vital_id            INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id          INTEGER NOT NULL REFERENCES patients(patient_id) ON DELETE CASCADE,
    stay_id             INTEGER REFERENCES hospitalizations(stay_id),
    recorded_by         INTEGER REFERENCES staff(staff_id),
    recorded_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Measurements (NULL if not measured at this time)
    heart_rate          INTEGER,                      -- bpm
    systolic_bp         INTEGER,                      -- mmHg
    diastolic_bp        INTEGER,                      -- mmHg
    temperature         REAL,                         -- °C
    spo2                REAL,                         -- % oxygen saturation
    respiratory_rate    INTEGER,                      -- breaths/min
    weight_kg           REAL,
    height_cm           REAL,
    bmi                 REAL                          -- computed or measured
                        GENERATED ALWAYS AS
                            (CASE WHEN height_cm > 0 THEN ROUND(weight_kg / ((height_cm/100.0)*(height_cm/100.0)),1) END)
                        VIRTUAL,
    pain_score          INTEGER CHECK (pain_score BETWEEN 0 AND 10),  -- EVA 0-10
    glycemia_mmol       REAL,                         -- blood glucose mmol/L
    notes               TEXT
);

-- ----------------------------------------------------------------------------
-- 3.7  LAB RESULTS — biological / laboratory exams
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS lab_results (
    result_id           INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id          INTEGER NOT NULL REFERENCES patients(patient_id) ON DELETE CASCADE,
    stay_id             INTEGER REFERENCES hospitalizations(stay_id),
    ordered_by          INTEGER REFERENCES staff(staff_id),
    validated_by        INTEGER REFERENCES staff(staff_id),

    exam_code           TEXT    NOT NULL,             -- LOINC or internal code
    exam_label          TEXT    NOT NULL,
    sample_type         TEXT,                         -- 'Sang', 'Urine', 'LCR', 'Biopsie'
    sample_date         DATETIME NOT NULL,
    result_date         DATETIME,
    value               TEXT,                         -- stored as text to handle numeric + text results
    unit                TEXT,
    reference_low       REAL,
    reference_high      REAL,
    is_abnormal         INTEGER NOT NULL DEFAULT 0    CHECK (is_abnormal IN (0,1)),
    status              TEXT    NOT NULL DEFAULT 'EN_ATTENTE'
                                CHECK (status IN ('EN_ATTENTE','VALIDE','ANNULE')),
    notes               TEXT
);

-- ----------------------------------------------------------------------------
-- 3.8  MEDICAL NOTES — free-text clinical notes / observations
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS medical_notes (
    note_id             INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id          INTEGER NOT NULL REFERENCES patients(patient_id) ON DELETE CASCADE,
    stay_id             INTEGER REFERENCES hospitalizations(stay_id),
    authored_by         INTEGER NOT NULL REFERENCES staff(staff_id),
    note_type           TEXT    NOT NULL              -- 'OBSERVATION', 'COMPTE_RENDU', 'ORDONNANCE', 'COURRIER', 'URGENCE'
                                CHECK (note_type IN ('OBSERVATION','COMPTE_RENDU','ORDONNANCE','COURRIER','URGENCE','NLP_EXTRACT')),
    title               TEXT,
    content             TEXT    NOT NULL,
    is_signed           INTEGER NOT NULL DEFAULT 0,
    signed_at           DATETIME,
    created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------------------------------------------------------
-- 3.9  IMAGING — radiology / imaging exams
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS imaging (
    imaging_id          INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id          INTEGER NOT NULL REFERENCES patients(patient_id) ON DELETE CASCADE,
    stay_id             INTEGER REFERENCES hospitalizations(stay_id),
    ordered_by          INTEGER REFERENCES staff(staff_id),
    radiologist_id      INTEGER REFERENCES staff(staff_id),

    modality            TEXT    NOT NULL              -- 'RX', 'SCANNER', 'IRM', 'ECHO', 'PET', 'SCINTIGRAPHIE'
                                CHECK (modality IN ('RX','SCANNER','IRM','ECHO','PET','SCINTIGRAPHIE','AUTRE')),
    region              TEXT    NOT NULL,             -- e.g. 'Thorax', 'Abdomen', 'Crâne'
    exam_date           DATETIME NOT NULL,
    report_date         DATETIME,
    findings            TEXT,                         -- compte-rendu radiologique
    conclusion          TEXT,
    pacs_reference      TEXT,                         -- link to PACS system
    is_urgent           INTEGER NOT NULL DEFAULT 0
);

-- ----------------------------------------------------------------------------
-- 3.10  SURGICAL ACTS — procedures and interventions
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS surgical_acts (
    act_id              INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id          INTEGER NOT NULL REFERENCES patients(patient_id),
    stay_id             INTEGER REFERENCES hospitalizations(stay_id),
    surgeon_id          INTEGER REFERENCES staff(staff_id),
    anesthesiologist_id INTEGER REFERENCES staff(staff_id),

    ccam_code           TEXT,                         -- French procedure classification code
    act_label           TEXT    NOT NULL,
    act_date            DATETIME NOT NULL,
    duration_min        INTEGER,
    anesthesia_type     TEXT,                         -- 'AG', 'ALR', 'Locale', 'Sédation'
    operating_room      TEXT,
    complications       TEXT,
    report              TEXT,
    created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);


-- =============================================================================
-- SECTION 4 — INDEXES (performance)
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_patients_name      ON patients(last_name, first_name);
CREATE INDEX IF NOT EXISTS idx_patients_dob       ON patients(date_of_birth);
CREATE INDEX IF NOT EXISTS idx_patients_nir       ON patients(nir);
CREATE INDEX IF NOT EXISTS idx_staff_role         ON staff(role_id);
CREATE INDEX IF NOT EXISTS idx_staff_dept         ON staff(dept_id);
CREATE INDEX IF NOT EXISTS idx_staff_name         ON staff(last_name, first_name);
CREATE INDEX IF NOT EXISTS idx_hosp_patient       ON hospitalizations(patient_id);
CREATE INDEX IF NOT EXISTS idx_hosp_admission     ON hospitalizations(admission_date);
CREATE INDEX IF NOT EXISTS idx_diag_stay          ON diagnoses(stay_id);
CREATE INDEX IF NOT EXISTS idx_diag_icd10         ON diagnoses(icd10_code);
CREATE INDEX IF NOT EXISTS idx_meds_patient       ON medications(patient_id);
CREATE INDEX IF NOT EXISTS idx_vitals_patient     ON vitals(patient_id, recorded_at);
CREATE INDEX IF NOT EXISTS idx_lab_patient        ON lab_results(patient_id);
CREATE INDEX IF NOT EXISTS idx_notes_patient      ON medical_notes(patient_id);
CREATE INDEX IF NOT EXISTS idx_log_staff          ON staff_access_log(staff_id, logged_at);


-- =============================================================================
-- SECTION 5 — SEED DATA
-- =============================================================================

-- ---- 5.1  Roles ---------------------------------------------------------------
INSERT INTO roles (role_code, role_label, access_level, description) VALUES
('ADMIN_SYS',     'Administrateur Système',        5, 'Accès complet : gestion utilisateurs, config système, tous les dossiers'),
('MEDECIN',       'Médecin',                       4, 'Lecture/écriture dossiers patients, prescriptions, comptes rendus'),
('CHIRURGIEN',    'Chirurgien',                    4, 'Identique Médecin + accès bloc opératoire et actes chirurgicaux'),
('ANESTHESISTE',  'Anesthésiste-Réanimateur',      4, 'Dossiers anesthésiques, prescriptions réa, actes'),
('CADRE_SANTE',   'Cadre de Santé',                3, 'Supervision soins, accès aux dossiers de son service, plannings'),
('IDE',           'Infirmier(e) Diplômé(e) d''État', 3, 'Lecture dossier patient, saisie constantes et soins, exécution prescriptions'),
('AIDE_SOIGNANT', 'Aide-Soignant(e)',              2, 'Lecture résumé patient, saisie constantes uniquement'),
('SAGE_FEMME',    'Sage-Femme',                    4, 'Dossiers obstétriques, accouchements, prescriptions maternité'),
('KINESITHERAPEUTE','Kinésithérapeute',            3, 'Lecture dossier, saisie bilans kiné'),
('BIOLOGISTE',    'Biologiste Médical',             4, 'Validation résultats biologiques, accès labo'),
('RADIOLOGUE',    'Radiologue',                    4, 'Comptes rendus imagerie, accès PACS'),
('PHARMACIEN',    'Pharmacien',                    3, 'Validation prescriptions, gestion médicaments'),
('SECRETAIRE',    'Secrétaire Médicale',           2, 'Gestion administrative, prise de RDV, identité patient — pas de données cliniques'),
('ACCUEIL',       'Agent d''Accueil',              1, 'Consultation identité et numéro de chambre uniquement'),
('STAGIAIRE',     'Stagiaire / Interne',           2, 'Lecture dossier sous supervision, aucune écriture sans validation');

-- ---- 5.2  Permissions ----------------------------------------------------------
INSERT INTO permissions (perm_code, perm_label, perm_category) VALUES
-- Patient data
('PAT_VIEW_ID',       'Voir identité patient',                       'PATIENT'),
('PAT_VIEW_CLINICAL', 'Voir données cliniques (dossier médical)',     'PATIENT'),
('PAT_EDIT_CLINICAL', 'Modifier données cliniques',                  'PATIENT'),
('PAT_VIEW_LABS',     'Voir résultats biologiques',                  'PATIENT'),
('PAT_VALIDATE_LABS', 'Valider résultats biologiques',               'PATIENT'),
('PAT_VIEW_IMAGING',  'Voir imagerie (PACS)',                        'PATIENT'),
('PAT_WRITE_IMAGING', 'Rédiger compte rendu imagerie',               'PATIENT'),
('PAT_PRESCRIBE',     'Créer/modifier prescriptions',                'PATIENT'),
('PAT_VIEW_MEDS',     'Voir prescriptions en cours',                 'PATIENT'),
('PAT_ADMIT',         'Gérer admissions / sorties',                  'PATIENT'),
('PAT_DELETE',        'Anonymiser / supprimer dossier (RGPD)',        'PATIENT'),
-- Staff management
('STAFF_VIEW',        'Voir liste et profils du personnel',          'STAFF'),
('STAFF_EDIT',        'Modifier profils du personnel',               'STAFF'),
('STAFF_CREATE',      'Créer un compte utilisateur',                 'STAFF'),
('STAFF_DELETE',      'Désactiver / supprimer un compte',            'STAFF'),
-- System
('SYS_CONFIG',        'Modifier la configuration système',           'SYSTEM'),
('SYS_AUDIT',         'Consulter les journaux d''audit',             'SYSTEM'),
('SYS_BACKUP',        'Lancer les sauvegardes',                      'SYSTEM'),
-- Billing
('BILL_VIEW',         'Voir facturation patient',                    'BILLING'),
('BILL_EDIT',         'Modifier / valider facturation',              'BILLING');

-- ---- 5.3  Role → Permission mapping -------------------------------------------
-- Helper: role_id reference  1=ADMIN_SYS, 2=MEDECIN, 3=CHIRURGIEN, 4=ANESTHESISTE,
--         5=CADRE_SANTE, 6=IDE, 7=AIDE_SOIGNANT, 8=SAGE_FEMME, 9=KINESITHERAPEUTE,
--         10=BIOLOGISTE, 11=RADIOLOGUE, 12=PHARMACIEN, 13=SECRETAIRE, 14=ACCUEIL, 15=STAGIAIRE

-- ADMIN_SYS — everything
INSERT INTO role_permissions (role_id, perm_id) SELECT 1, perm_id FROM permissions;

-- MEDECIN
INSERT INTO role_permissions (role_id, perm_id)
SELECT 2, perm_id FROM permissions
WHERE perm_code IN ('PAT_VIEW_ID','PAT_VIEW_CLINICAL','PAT_EDIT_CLINICAL','PAT_VIEW_LABS',
                    'PAT_VIEW_IMAGING','PAT_PRESCRIBE','PAT_VIEW_MEDS','PAT_ADMIT',
                    'STAFF_VIEW','BILL_VIEW');

-- CHIRURGIEN
INSERT INTO role_permissions (role_id, perm_id)
SELECT 3, perm_id FROM permissions
WHERE perm_code IN ('PAT_VIEW_ID','PAT_VIEW_CLINICAL','PAT_EDIT_CLINICAL','PAT_VIEW_LABS',
                    'PAT_VIEW_IMAGING','PAT_PRESCRIBE','PAT_VIEW_MEDS','PAT_ADMIT',
                    'STAFF_VIEW','BILL_VIEW');

-- ANESTHESISTE
INSERT INTO role_permissions (role_id, perm_id)
SELECT 4, perm_id FROM permissions
WHERE perm_code IN ('PAT_VIEW_ID','PAT_VIEW_CLINICAL','PAT_EDIT_CLINICAL','PAT_VIEW_LABS',
                    'PAT_VIEW_IMAGING','PAT_PRESCRIBE','PAT_VIEW_MEDS','STAFF_VIEW');

-- CADRE_SANTE
INSERT INTO role_permissions (role_id, perm_id)
SELECT 5, perm_id FROM permissions
WHERE perm_code IN ('PAT_VIEW_ID','PAT_VIEW_CLINICAL','PAT_VIEW_LABS','PAT_VIEW_MEDS',
                    'STAFF_VIEW','STAFF_EDIT','SYS_AUDIT','BILL_VIEW');

-- IDE
INSERT INTO role_permissions (role_id, perm_id)
SELECT 6, perm_id FROM permissions
WHERE perm_code IN ('PAT_VIEW_ID','PAT_VIEW_CLINICAL','PAT_EDIT_CLINICAL',
                    'PAT_VIEW_LABS','PAT_VIEW_MEDS','PAT_VIEW_IMAGING');

-- AIDE_SOIGNANT
INSERT INTO role_permissions (role_id, perm_id)
SELECT 7, perm_id FROM permissions
WHERE perm_code IN ('PAT_VIEW_ID','PAT_VIEW_CLINICAL','PAT_VIEW_MEDS');

-- SAGE_FEMME
INSERT INTO role_permissions (role_id, perm_id)
SELECT 8, perm_id FROM permissions
WHERE perm_code IN ('PAT_VIEW_ID','PAT_VIEW_CLINICAL','PAT_EDIT_CLINICAL','PAT_VIEW_LABS',
                    'PAT_VIEW_IMAGING','PAT_PRESCRIBE','PAT_VIEW_MEDS','PAT_ADMIT');

-- KINESITHERAPEUTE
INSERT INTO role_permissions (role_id, perm_id)
SELECT 9, perm_id FROM permissions
WHERE perm_code IN ('PAT_VIEW_ID','PAT_VIEW_CLINICAL','PAT_EDIT_CLINICAL','PAT_VIEW_LABS');

-- BIOLOGISTE
INSERT INTO role_permissions (role_id, perm_id)
SELECT 10, perm_id FROM permissions
WHERE perm_code IN ('PAT_VIEW_ID','PAT_VIEW_LABS','PAT_VALIDATE_LABS');

-- RADIOLOGUE
INSERT INTO role_permissions (role_id, perm_id)
SELECT 11, perm_id FROM permissions
WHERE perm_code IN ('PAT_VIEW_ID','PAT_VIEW_CLINICAL','PAT_VIEW_LABS',
                    'PAT_VIEW_IMAGING','PAT_WRITE_IMAGING');

-- PHARMACIEN
INSERT INTO role_permissions (role_id, perm_id)
SELECT 12, perm_id FROM permissions
WHERE perm_code IN ('PAT_VIEW_ID','PAT_VIEW_MEDS','PAT_PRESCRIBE','PAT_VIEW_LABS');

-- SECRETAIRE
INSERT INTO role_permissions (role_id, perm_id)
SELECT 13, perm_id FROM permissions
WHERE perm_code IN ('PAT_VIEW_ID','PAT_ADMIT','BILL_VIEW','BILL_EDIT');

-- ACCUEIL
INSERT INTO role_permissions (role_id, perm_id)
SELECT 14, perm_id FROM permissions WHERE perm_code IN ('PAT_VIEW_ID');

-- STAGIAIRE
INSERT INTO role_permissions (role_id, perm_id)
SELECT 15, perm_id FROM permissions
WHERE perm_code IN ('PAT_VIEW_ID','PAT_VIEW_CLINICAL','PAT_VIEW_LABS','PAT_VIEW_MEDS');

-- ---- 5.4  Departments ----------------------------------------------------------
INSERT INTO departments (dept_code, dept_name, floor) VALUES
('CARDIO',   'Cardiologie',                   '3'),
('NEURO',    'Neurologie',                    '4'),
('CHIR_ORT', 'Chirurgie Orthopédique',        '2'),
('CHIR_GEN', 'Chirurgie Générale',            '2'),
('URGENCES', 'Urgences',                      '0'),
('REANIMATION','Réanimation Polyvalente',     '1'),
('MATERNITE','Maternité / Obstétrique',       '5'),
('PEDIATRIE','Pédiatrie',                     '5'),
('RADIO',    'Radiologie / Imagerie Médicale','1'),
('LABO',     'Laboratoire de Biologie',       '-1'),
('PHARMA',   'Pharmacie Hospitalière',        '-1'),
('ADMIN',    'Direction / Administration',    '6');

-- ---- 5.5  Wards ----------------------------------------------------------------
INSERT INTO wards (dept_id, ward_name, capacity, ward_type) VALUES
(1,  'Soins Intensifs Cardio',      8,  'ICU'),
(1,  'Cardiologie Conventionnelle', 24, 'GENERAL'),
(2,  'Neurologie Conventionnelle',  20, 'GENERAL'),
(3,  'Ortho Programmé',             18, 'SURGICAL'),
(4,  'Chirurgie Digestive',         20, 'SURGICAL'),
(5,  'Zone Tri Urgences',           10, 'GENERAL'),
(6,  'Réanimation Adulte',          12, 'ICU'),
(7,  'Salle Accouchement',          6,  'MATERNITY'),
(7,  'Suites de Couches',           24, 'MATERNITY'),
(8,  'Pédiatrie Générale',          20, 'GENERAL');

-- ---- 5.6  Staff seed data -------------------------------------------------------
INSERT INTO staff (employee_number, last_name, first_name, date_of_birth, gender,
                   email_pro, phone_pro, role_id, dept_id, specialty, title,
                   hire_date, contract_type, sillage_username, biometric_enrolled) VALUES
('EMP-001', 'Martin',    'Sophie',   '1975-04-12', 'F', 'sophie.martin@sillage-hopital.fr',    '0312000001', 2,  1,  'Cardiologie',               'Dr',  '2005-09-01', 'CDI', 's.martin',    1),
('EMP-002', 'Dubois',    'Laurent',  '1968-11-30', 'M', 'laurent.dubois@sillage-hopital.fr',   '0312000002', 2,  2,  'Neurologie',                'Pr',  '1999-01-15', 'CDI', 'l.dubois',    1),
('EMP-003', 'Bernard',   'Isabelle', '1980-07-22', 'F', 'isabelle.bernard@sillage-hopital.fr', '0312000003', 3,  4,  'Chirurgie Digestive',       'Dr',  '2010-03-01', 'CDI', 'i.bernard',   1),
('EMP-004', 'Leroy',     'Karim',    '1985-02-14', 'M', 'karim.leroy@sillage-hopital.fr',      '0312000004', 4,  6,  'Anesthésie-Réanimation',    'Dr',  '2014-07-01', 'CDI', 'k.leroy',     1),
('EMP-005', 'Moreau',    'Céline',   '1978-09-05', 'F', 'celine.moreau@sillage-hopital.fr',    '0312000005', 5,  1,  NULL,                        'IDE', '2003-11-01', 'CDI', 'c.moreau',    1),
('EMP-006', 'Simon',     'Pierre',   '1992-03-18', 'M', 'pierre.simon@sillage-hopital.fr',     '0312000006', 6,  5,  NULL,                        'IDE', '2018-06-01', 'CDI', 'p.simon',     0),
('EMP-007', 'Laurent',   'Nadia',    '1995-12-01', 'F', 'nadia.laurent@sillage-hopital.fr',    '0312000007', 7,  3,  NULL,                        'AS',  '2020-09-01', 'CDI', 'n.laurent',   0),
('EMP-008', 'Rousseau',  'Marc',     '1970-06-25', 'M', 'marc.rousseau@sillage-hopital.fr',    '0312000008', 10, 10, 'Biologie Médicale',         'Dr',  '2000-01-01', 'CDI', 'm.rousseau',  1),
('EMP-009', 'Petit',     'Amina',    '1988-08-10', 'F', 'amina.petit@sillage-hopital.fr',      '0312000009', 11, 9,  'Radiologie',                'Dr',  '2015-04-01', 'CDI', 'a.petit',     1),
('EMP-010', 'Garcia',    'Julien',   '2000-05-17', 'M', 'julien.garcia@sillage-hopital.fr',    '0312000010', 15, 2,  'Interne Neurologie',        NULL,  '2025-11-01', 'CDD', 'j.garcia',    0),
('EMP-011', 'Fontaine',  'Léa',      '1983-01-29', 'F', 'lea.fontaine@sillage-hopital.fr',     '0312000011', 8,  7,  'Obstétrique',               NULL,  '2009-05-01', 'CDI', 'l.fontaine',  1),
('EMP-012', 'Renard',    'Thomas',   '1990-10-08', 'M', 'thomas.renard@sillage-hopital.fr',    '0312000012', 12, 11, 'Pharmacie Clinique',        NULL,  '2016-09-01', 'CDI', 't.renard',    0),
('EMP-013', 'Chevalier', 'Marie',    '1987-04-03', 'F', 'marie.chevalier@sillage-hopital.fr',  '0312000013', 13, 12, NULL,                        NULL,  '2012-02-01', 'CDI', 'm.chevalier', 0),
('EMP-014', 'Bonnet',    'Paul',     '2001-09-14', 'M', 'paul.bonnet@sillage-hopital.fr',      '0312000014', 14, 12, NULL,                        NULL,  '2025-01-01', 'CDI', 'p.bonnet',    0),
('EMP-015', 'Dupont',    'Hélène',   '1965-03-30', 'F', 'helene.dupont@sillage-hopital.fr',    '0312000015', 1,  12, NULL,                        NULL,  '1995-06-01', 'CDI', 'h.dupont',    1);

-- ---- 5.7  Patient seed data ----------------------------------------------------
INSERT INTO patients (ipp, last_name, first_name, date_of_birth, gender, nir,
                      address, city, postal_code, phone_mobile, email,
                      blood_type, rhesus, organ_donor,
                      emergency_contact_name, emergency_contact_relationship, emergency_contact_phone,
                      insurance_type, consent_data_use, consent_date,
                      referring_doctor) VALUES
('IPP-000001', 'Dupont',    'Jean',       '1955-06-14', 'M', '1550659123456 89',
 '12 rue des Lilas, Apt 3',    'Lille',       '59000', '0611111111', 'jean.dupont@mail.fr',
 'A+', '+', 1, 'Marie Dupont', 'Épouse', '0622222222', 'CPAM', 1, '2024-01-10', 'Dr. Lecomte'),

('IPP-000002', 'Lefevre',   'Martine',    '1942-11-28', 'F', '2421159234567 45',
 '8 allée des Roses',          'Roubaix',     '59100', '0633333333', NULL,
 'O-', '-', 0, 'Paul Lefevre', 'Fils', '0644444444', 'MGEN', 1, '2023-09-22', 'Dr. Mercer'),

('IPP-000003', 'Hakimi',    'Youssef',    '1989-03-05', 'M', '1890359345678 78',
 '45 bd Montebello',           'Lille',       '59000', '0655555555', 'y.hakimi@mail.fr',
 'B+', '+', 1, 'Fatima Hakimi', 'Mère', '0666666666', 'CPAM', 1, '2025-03-01', 'Dr. Nguyen'),

('IPP-000004', 'Morin',     'Claire',     '1998-07-20', 'F', '2980759456789 12',
 '3 impasse du Moulin',        'Villeneuve-d''Ascq', '59491', '0677777777', 'claire.morin@mail.fr',
 'AB+', '+', 1, 'Luc Morin', 'Père', '0688888888', 'CPAM', 1, '2025-11-15', 'Dr. Lefebvre'),

('IPP-000005', 'Tremblay',  'René',       '1960-01-19', 'M', '1600159567890 34',
 '17 rue de Flandre',          'Dunkerque',   '59140', '0699999999', NULL,
 'O+', '+', 0, 'Sylvie Tremblay', 'Épouse', '0611000000', 'MSA', 1, '2023-06-30', 'Dr. Picard'),

('IPP-000006', 'Nguyen',    'Thi Lan',    '1975-09-12', 'F', '2750959678901 56',
 '22 rue Solferino',           'Lille',       '59000', '0612121212', 'thilan@mail.fr',
 'A-', '-', 1, 'Hung Nguyen', 'Époux', '0623232323', 'CPAM', 1, '2024-08-05', 'Dr. Martin');

-- ---- 5.8  Hospitalizations seed data -------------------------------------------
INSERT INTO hospitalizations (patient_id, ward_id, room_number, bed_number,
                               admission_date, expected_discharge,
                               admission_type, admission_reason, admission_source,
                               attending_staff_id) VALUES
(1, 1, '101', 'A', '2026-02-20 10:30:00', '2026-03-10', 'URGENCE',     'Douleur thoracique aiguë, suspicion SCA', 'Urgences', 1),
(2, 3, '301', 'B', '2026-02-25 14:00:00', '2026-03-07', 'PROGRAMME',   'Bilan AVC ischémique, rééducation', 'Domicile', 2),
(3, 6, '201', 'A', '2026-03-01 08:00:00', '2026-03-15', 'PROGRAMME',   'Appendicectomie laparoscopique', 'Domicile', 3),
(4, 8, '501', 'C', '2026-03-03 23:45:00', '2026-03-05', 'MATERNITE',   'Accouchement physiologique — grossesse 39 SA', 'Domicile', 11),
(5, 2, '102', 'A', '2026-02-10 09:00:00', '2026-03-05', 'PROGRAMME',   'Pose de stent coronarien — angioplastie', 'Domicile', 1),
(6, 4, '202', 'B', '2026-03-02 11:00:00', '2026-03-09', 'PROGRAMME',   'Prothèse totale de hanche droite', 'Domicile', 3);

-- ---- 5.9  Allergies ------------------------------------------------------------
INSERT INTO allergies (patient_id, substance, allergy_type, reaction, severity, onset_date, recorded_by) VALUES
(1, 'Pénicilline',    'MEDICAMENT',    'Urticaire généralisée',        'MODEREE', '1990-01-01', 1),
(1, 'Latex',          'ENVIRONNEMENT', 'Dermatite de contact',         'LEGERE',  '2005-06-01', 1),
(5, 'Metformine',     'MEDICAMENT',    'Intolerance digestive sévère', 'MODEREE', '2018-01-01', 1);

-- Patient 2 (Lefevre Martine) — pénicillines & AINS (source : KNOWN_ALLERGIES)
INSERT INTO allergies (patient_id, substance, allergy_type, reaction, severity, onset_date, recorded_by) VALUES
(2, 'Aspirine',       'MEDICAMENT',    'Bronchospasme',                          'SEVERE',  '2010-03-15', 2),
(2, 'Pénicilline',    'MEDICAMENT',    'Choc anaphylactique',                    'SEVERE',  '2008-05-20', 2),
(2, 'Amoxicilline',   'MEDICAMENT',    'Urticaire — classe pénicilline',         'SEVERE',  '2008-05-20', 2),
(2, 'Augmentin',      'MEDICAMENT',    'Urticaire — amoxicilline/clavulanate',   'MODEREE', '2012-11-10', 2),
(2, 'Clamoxyl',       'MEDICAMENT',    'Urticaire — amoxicilline injectable',    'MODEREE', '2012-11-10', 2);

-- Patient 3 (Hakimi Youssef) — iode & AINS (source : KNOWN_ALLERGIES)
INSERT INTO allergies (patient_id, substance, allergy_type, reaction, severity, onset_date, recorded_by) VALUES
(3, 'Iode (iodure)',  'MEDICAMENT',    'Réaction anaphylactique',                'SEVERE',  '2020-08-10', 4),
(3, 'Ibuprofène',     'MEDICAMENT',    'Bronchospasme — hypersensibilité AINS',  'SEVERE',  '2018-04-03', 3),
(3, 'Advil',          'MEDICAMENT',    'Bronchospasme — ibuprofène',             'SEVERE',  '2018-04-03', 3),
(3, 'Kétoprofène',    'MEDICAMENT',    'Urticaire — AINS topique/IV',            'MODEREE', '2019-09-15', 3),
(3, 'Profenid',       'MEDICAMENT',    'Urticaire — kétoprofène injectable',     'MODEREE', '2019-09-15', 3);

-- ---- 5.10  Medications ---------------------------------------------------------
INSERT INTO medications (patient_id, stay_id, drug_name, inn_name, dosage, form, route,
                          frequency, start_date, prescribing_staff) VALUES
(1, 1, 'Kardégic',     'Acide Acétylsalicylique', '75 mg',  'Comprimé', 'Per os', '1x/jour matin',  '2026-02-20', 1),
(1, 1, 'Clopidogrel',  'Clopidogrel',             '75 mg',  'Comprimé', 'Per os', '1x/jour matin',  '2026-02-20', 1),
(1, 1, 'Bisoprolol',   'Bisoprolol',              '5 mg',   'Comprimé', 'Per os', '1x/jour matin',  '2026-02-20', 1),
(2, 2, 'Plavix',       'Clopidogrel',             '75 mg',  'Comprimé', 'Per os', '1x/jour',        '2026-02-25', 2),
(3, 3, 'Paracétamol',  'Paracétamol',             '1000 mg','Injectable','IV',    '4x/jour (6h)',   '2026-03-01', 3),
(5, 5, 'Héparine HBPM','Enoxaparine',             '4000 UI','Injectable','SC',    '1x/jour soir',   '2026-02-10', 1);

-- ---- 5.11  Vitals --------------------------------------------------------------
INSERT INTO vitals (patient_id, stay_id, recorded_by, recorded_at,
                    heart_rate, systolic_bp, diastolic_bp, temperature, spo2,
                    respiratory_rate, weight_kg, height_cm, pain_score) VALUES
(1, 1, 6, '2026-02-20 11:00:00', 95, 155, 92, 37.2, 97.0, 18, 82.0, 175.0, 7),
(1, 1, 6, '2026-02-21 07:00:00', 78, 138, 82, 36.9, 98.0, 16, 82.0, 175.0, 3),
(2, 2, 6, '2026-02-25 15:00:00', 68, 145, 88, 36.8, 96.0, 15, 71.0, 162.0, 2),
(3, 3, 6, '2026-03-01 09:00:00', 82, 122, 78, 36.6, 99.0, 14, 78.0, 180.0, 4),
(4, 4, 11,'2026-03-04 00:30:00', 90, 118, 72, 36.7, 99.0, 16, 68.0, 167.0, 5),
(5, 5, 6, '2026-02-10 10:00:00', 64, 142, 86, 36.5, 97.0, 15, 95.0, 172.0, 1);

-- ---- 5.12  Diagnoses -----------------------------------------------------------
INSERT INTO diagnoses (stay_id, patient_id, icd10_code, icd10_label, diagnosis_type,
                       diagnosis_date, staff_id) VALUES
(1, 1, 'I21.9', 'Infarctus aigu du myocarde, sans précision',     'PRINCIPAL',  '2026-02-20', 1),
(1, 1, 'I10',   'Hypertension artérielle essentielle',            'ASSOCIE',    '2026-02-20', 1),
(2, 2, 'I63.9', 'Infarctus cérébral, sans précision',             'PRINCIPAL',  '2026-02-25', 2),
(2, 2, 'E11.9', 'Diabète de type 2 sans complication',            'ASSOCIE',    '2026-02-25', 2),
(3, 3, 'K37',   'Appendicite aiguë, sans précision',              'PRINCIPAL',  '2026-03-01', 3),
(4, 4, 'Z37.0', 'Accouchement unique, né vivant',                 'PRINCIPAL',  '2026-03-04', 11),
(5, 5, 'I25.10','Cardiopathie ischémique chronique — coronaropathie','PRINCIPAL','2026-02-10', 1),
(6, 6, 'M16.11','Coxarthrose unilatérale, primaire, hanche droite','PRINCIPAL', '2026-03-02', 3);

-- ---- 5.13  Medical notes (NLP extract example) ---------------------------------
INSERT INTO medical_notes (patient_id, stay_id, authored_by, note_type, title, content, is_signed, signed_at) VALUES
(1, 1, 1, 'OBSERVATION',
 'Observation initiale — J1 hospitalisation',
 'Patient de 70 ans admis aux urgences pour douleur thoracique oppressive irradiant dans le bras gauche depuis 3h. ECG : sus-décalage ST en V1-V4. Troponine T élevée à 2,8 ng/mL. Diagnostic d''IDM antérieur confirmé. Patient sous double antiagrégation et héparine. Coronarographie programmée demain matin.',
 1, '2026-02-20 14:00:00'),
(1, 1, 1, 'NLP_EXTRACT',
 'Extraction NLP — SmartUX-AI',
 '{"patient_age":70,"motif":"Douleur thoracique","duree":"3h","symptomes":["douleur oppressive","irradiation bras gauche"],"ecg":"sus-décalage ST V1-V4","troponine":"2.8 ng/mL","diagnostic":"IDM antérieur","traitement":["double antiagrégation","héparine"],"acte_prevu":"coronarographie"}',
 0, NULL);

-- =============================================================================
-- SECTION 6 — USEFUL VIEWS
-- =============================================================================

-- Active patients currently hospitalised
CREATE VIEW IF NOT EXISTS v_active_patients AS
SELECT
    p.patient_id, p.ipp, p.last_name, p.first_name, p.date_of_birth, p.blood_type,
    h.stay_id, h.admission_date, h.admission_type, h.room_number, h.bed_number,
    w.ward_name, d.dept_name,
    s.first_name || ' ' || s.last_name AS attending_physician
FROM patients p
JOIN hospitalizations h ON h.patient_id = p.patient_id AND h.actual_discharge IS NULL
LEFT JOIN wards w ON w.ward_id = h.ward_id
LEFT JOIN departments d ON d.dept_id = w.dept_id
LEFT JOIN staff s ON s.staff_id = h.attending_staff_id
WHERE p.is_deceased = 0;

-- Staff with their role and department summary
CREATE VIEW IF NOT EXISTS v_staff_summary AS
SELECT
    st.staff_id, st.employee_number,
    st.title || ' ' || st.first_name || ' ' || st.last_name AS full_name,
    r.role_label, r.access_level,
    d.dept_name, st.specialty,
    st.sillage_username, st.biometric_enrolled, st.is_active,
    st.last_login
FROM staff st
JOIN roles r ON r.role_id = st.role_id
JOIN departments d ON d.dept_id = st.dept_id;

-- Permissions per staff member (flattened)
CREATE VIEW IF NOT EXISTS v_staff_permissions AS
SELECT
    st.staff_id, st.sillage_username,
    r.role_code, r.access_level,
    GROUP_CONCAT(p.perm_code, ', ') AS permissions
FROM staff st
JOIN roles r ON r.role_id = st.role_id
JOIN role_permissions rp ON rp.role_id = r.role_id
JOIN permissions p ON p.perm_id = rp.perm_id
WHERE st.is_active = 1
GROUP BY st.staff_id;

-- =============================================================================
-- END OF FILE
-- =============================================================================


-- =============================================================================
-- SECTION 7 — MÉDICAMENTS REFERENCE DATABASE (real French hospital drugs)
-- =============================================================================

CREATE TABLE IF NOT EXISTS medicaments (
    med_ref_id      INTEGER PRIMARY KEY AUTOINCREMENT,
    brand_name      TEXT    NOT NULL,                 -- Nom de spécialité (ex: Doliprane)
    inn_name        TEXT    NOT NULL,                 -- DCI / INN (ex: Paracétamol)
    form            TEXT    NOT NULL,                 -- Comprimé, Injectable, Sirop, etc.
    dosage_std      TEXT    NOT NULL,                 -- Dosage standard (ex: 500mg, 1g)
    route           TEXT    NOT NULL,                 -- Per os, IV, IM, SC, Topique, Inhalé
    category        TEXT    NOT NULL,                 -- ATC category / therapeutic class
    atc_code        TEXT,                             -- ATC classification code
    prescription_required INTEGER NOT NULL DEFAULT 1 CHECK (prescription_required IN (0,1)),
    controlled_drug INTEGER NOT NULL DEFAULT 0        CHECK (controlled_drug IN (0,1)),
    max_dose_day    TEXT,                             -- Ex: '4g/jour', '3 prises max'
    contraindications TEXT,
    pregnancy_cat   TEXT,                             -- 'Autorisé', 'Déconseillé', 'Contre-indiqué', 'Inconnu'
    storage         TEXT    DEFAULT 'T° ambiante',
    notes           TEXT,
    is_active       INTEGER NOT NULL DEFAULT 1
);

-- Real French hospital medications (based on Vidal / HAS reference list)
INSERT INTO medicaments (brand_name, inn_name, form, dosage_std, route, category, atc_code, prescription_required, controlled_drug, max_dose_day, contraindications, pregnancy_cat) VALUES
-- Analgésiques / Antipyrétiques
('Doliprane',         'Paracétamol',             'Comprimé',     '500mg / 1g',   'Per os',  'Analgésique - Antipyrétique', 'N02BE01', 0, 0, '4g/jour (3g si insuffisance hépatique)', 'Insuffisance hépatocellulaire sévère', 'Autorisé'),
('Perfalgan',         'Paracétamol',             'Injectable',   '10mg/mL',      'IV',      'Analgésique - Antipyrétique', 'N02BE01', 1, 0, '4g/jour', 'Insuffisance hépatique sévère', 'Autorisé'),
('Advil',             'Ibuprofène',              'Comprimé',     '200mg / 400mg','Per os',  'AINS - Analgésique',          'M01AE01', 0, 0, '2400mg/jour', 'IU sévère, ulcère actif, grossesse >24SA', 'Déconseillé T3'),
('Profenid',          'Kétoprofène',             'Injectable',   '50mg / 100mg', 'IV/IM',   'AINS',                        'M01AE03', 1, 0, '200mg/jour', 'IU sévère, allergie AINS', 'Contre-indiqué T3'),
('Actiskenan',        'Morphine',                'Gélule LP',    '5mg / 10mg',   'Per os',  'Opioïde fort',                'N02AA01', 1, 1, 'Selon prescription', 'Dépression respiratoire, iléus paralytique', 'Déconseillé'),
('Morphine Aguettant','Morphine',                'Injectable',   '10mg/mL',      'IV/SC',   'Opioïde fort',                'N02AA01', 1, 1, 'Selon prescription', 'Dépression respiratoire sévère', 'Déconseillé'),
('Topalgic',          'Tramadol',                'Comprimé LP',  '50mg / 100mg', 'Per os',  'Opioïde faible',              'N02AX02', 1, 0, '400mg/jour', 'Épilepsie non contrôlée, IMAO', 'Contre-indiqué'),
-- Antibiotiques
('Amoxicilline Sandoz','Amoxicilline',           'Comprimé',     '500mg / 1g',   'Per os',  'Antibiotique - Pénicilline',  'J01CA04', 1, 0, '3g/jour',  'Allergie pénicillines', 'Autorisé'),
('Augmentin',         'Amoxicilline/Clavulanate','Comprimé',     '875mg/125mg',  'Per os',  'Antibiotique - Pénicilline',  'J01CR02', 1, 0, '3g amoxi/jour', 'Allergie pénicillines, ictère cholestatique antérieur', 'Autorisé'),
('Augmentin IV',      'Amoxicilline/Clavulanate','Injectable',   '1g/200mg',     'IV',      'Antibiotique - Pénicilline',  'J01CR02', 1, 0, '6g amoxi/jour', 'Allergie pénicillines', 'Autorisé'),
('Clamoxyl',          'Amoxicilline',            'Injectable',   '1g / 2g',      'IV/IM',   'Antibiotique - Pénicilline',  'J01CA04', 1, 0, '12g/jour IV', 'Allergie pénicillines', 'Autorisé'),
('Zithromax',         'Azithromycine',           'Comprimé',     '250mg / 500mg','Per os',  'Antibiotique - Macrolide',    'J01FA10', 1, 0, '500mg/jour (3j)', 'Allergie macrolides, allongement QT', 'Déconseillé'),
('Flagyl',            'Métronidazole',           'Comprimé',     '250mg / 500mg','Per os',  'Antibiotique - Imidazolé',    'J01XD01', 1, 0, '1500mg/jour', 'Grossesse T1, alcool', 'Déconseillé T1'),
('Flagyl IV',         'Métronidazole',           'Injectable',   '5mg/mL',       'IV',      'Antibiotique - Imidazolé',    'J01XD01', 1, 0, '1500mg/jour', 'Grossesse T1', 'Déconseillé T1'),
('Ciflox',            'Ciprofloxacine',          'Comprimé',     '250mg / 500mg','Per os',  'Antibiotique - Fluoroquinolone','J01MA02',1, 0, '1500mg/jour', 'Grossesse, enfant, tendinopathie antérieure', 'Contre-indiqué'),
('Oflocet',           'Ofloxacine',              'Comprimé',     '200mg',        'Per os',  'Antibiotique - Fluoroquinolone','J01MA01',1, 0, '800mg/jour', 'Grossesse, épilepsie', 'Contre-indiqué'),
('Keforal',           'Céfalexine',              'Comprimé',     '500mg',        'Per os',  'Antibiotique - Céphalosporine','J01DB01', 1, 0, '4g/jour', 'Allergie céphalosporines', 'Autorisé'),
('Rocéphine',         'Ceftriaxone',             'Injectable',   '1g / 2g',      'IV/IM',   'Antibiotique - Céphalosporine','J01DD04', 1, 0, '4g/jour', 'Hyperbilirubinémie chez NN', 'Autorisé'),
('Tienam',            'Imipénem/Cilastatine',    'Injectable',   '500mg/500mg',  'IV',      'Antibiotique - Carbapénème',  'J01DH51', 1, 0, '4g/jour', 'Allergie carbapénèmes', 'Déconseillé'),
('Vancomycine Mylan', 'Vancomycine',             'Injectable',   '500mg / 1g',   'IV',      'Antibiotique - Glycopeptide', 'J01XA01', 1, 0, 'Selon CMI et dosage', 'IU (adaptation posologie)', 'Déconseillé'),
-- Cardiovasculaires
('Kardégic',          'Acide Acétylsalicylique', 'Poudre/sachet','75mg / 160mg', 'Per os',  'Antiagrégant plaquettaire',   'B01AC06', 1, 0, '160mg/jour (antiagrégeant)', 'Ulcère actif, hémophilie, grossesse T3', 'Contre-indiqué T3'),
('Plavix',            'Clopidogrel',             'Comprimé',     '75mg',         'Per os',  'Antiagrégant plaquettaire',   'B01AC04', 1, 0, '75mg/jour (150mg dose charge)', 'Lésion hémorragique active', 'Déconseillé'),
('Xarelto',           'Rivaroxaban',             'Comprimé',     '10mg / 20mg',  'Per os',  'Anticoagulant oral - AOD',    'B01AF01', 1, 0, '20mg/jour', 'Grossesse, allaitement, hémorragie active', 'Contre-indiqué'),
('Eliquis',           'Apixaban',                'Comprimé',     '2.5mg / 5mg',  'Per os',  'Anticoagulant oral - AOD',    'B01AF02', 1, 0, '10mg/jour', 'Hémorragie active, grossesse', 'Contre-indiqué'),
('Lovenox',           'Énoxaparine',             'Injectable',   '4000UI/0.4mL / 6000UI','SC', 'Héparinothérapie - HBPM', 'B01AB05', 1, 0, 'Selon indication (préventif/curatif)', 'TIH antérieure, hémorragie active', 'Autorisé'),
('Héparine sodique',  'Héparine',                'Injectable',   '5000UI/mL',    'IV/SC',   'Héparinothérapie - HNF',      'B01AB01', 1, 0, 'Selon TCA cible', 'TIH, hémorragie active', 'Autorisé'),
('Coumadine',         'Warfarine',               'Comprimé',     '2mg / 5mg',    'Per os',  'Anticoagulant oral - AVK',    'B01AA03', 1, 0, 'Selon INR cible', 'Grossesse, hémorragie active, HTA non contrôlée', 'Contre-indiqué'),
('Lisinopril Teva',   'Lisinopril',              'Comprimé',     '5mg / 10mg',   'Per os',  'IEC - Antihypertenseur',      'C09AA03', 1, 0, '40mg/jour', 'Grossesse, ATCD angiœdème IEC, hyperkaliémie sévère', 'Contre-indiqué'),
('Triatec',           'Ramipril',                'Comprimé',     '2.5mg / 5mg',  'Per os',  'IEC - Antihypertenseur',      'C09AA05', 1, 0, '10mg/jour', 'Grossesse, sténose artère rénale bilatérale', 'Contre-indiqué'),
('Amlor',             'Amlodipine',              'Comprimé',     '5mg / 10mg',   'Per os',  'Inhibiteur calcique',         'C08CA01', 1, 0, '10mg/jour', 'Hypotension sévère, choc cardiogénique', 'Déconseillé'),
('Bisoprolol Teva',   'Bisoprolol',              'Comprimé',     '2.5mg / 5mg',  'Per os',  'Bêtabloquant',                'C07AB07', 1, 0, '20mg/jour', 'Asthme, BAV > 1er degré, bradycardie sévère', 'Déconseillé'),
('Lasilix',           'Furosémide',              'Comprimé',     '40mg',         'Per os',  'Diurétique de l''anse',       'C03CA01', 1, 0, '600mg/jour', 'Anurie, hypokaliémie sévère', 'Déconseillé'),
('Lasilix',           'Furosémide',              'Injectable',   '10mg/mL',      'IV',      'Diurétique de l''anse',       'C03CA01', 1, 0, '1g/jour IV', 'Anurie', 'Déconseillé'),
('Tahor',             'Atorvastatine',           'Comprimé',     '10mg / 40mg',  'Per os',  'Hypolipémiant - Statine',     'C10AA05', 1, 0, '80mg/jour', 'Hépatopathie active, grossesse', 'Contre-indiqué'),
('Zocor',             'Simvastatine',            'Comprimé',     '10mg / 40mg',  'Per os',  'Hypolipémiant - Statine',     'C10AA01', 1, 0, '40mg/jour', 'Hépatopathie, grossesse, interactions CYP3A4', 'Contre-indiqué'),
-- Diabète
('Glucophage',        'Metformine',              'Comprimé',     '500mg / 850mg','Per os',  'Antidiabétique - Biguanide',  'A10BA02', 1, 0, '3g/jour', 'IU, IH, alcool, produit iodé (arrêt 48h)', 'Déconseillé'),
('Lantus',            'Insuline Glargine',       'Injectable',   '100UI/mL',     'SC',      'Insuline basale',             'A10AE04', 1, 0, 'Selon glycémie cible', 'Hypoglycémie', 'Autorisé'),
('Novorapid',         'Insuline Asparte',        'Injectable',   '100UI/mL',     'SC',      'Insuline rapide',             'A10AB05', 1, 0, 'Selon glycémie', 'Hypoglycémie', 'Autorisé'),
-- Respiratoire
('Ventoline',         'Salbutamol',              'Aérosol',      '100µg/dose',   'Inhalé',  'Bronchodilatateur B2',        'R03AC02', 1, 0, '4 bouffées / 4h', 'Hypokaliémie non corrigée', 'Autorisé'),
('Atrovent',          'Ipratropium',             'Aérosol',      '20µg/dose',    'Inhalé',  'Bronchodilatateur anticholinergique','R03BB01',1,0,'8 bouffées/jour','Glaucome angle fermé, adénome prostate', 'Déconseillé'),
('Solupred',          'Prednisolone',            'Comprimé',     '5mg / 20mg',   'Per os',  'Corticostéroïde',             'H02AB06', 1, 0, 'Selon indication', 'Infection non traitée, vaccin vivant', 'Déconseillé'),
('Solu-Médrol',       'Méthylprednisolone',      'Injectable',   '40mg / 120mg', 'IV/IM',   'Corticostéroïde',             'H02AB04', 1, 0, 'Selon indication', 'Infection systémique non traitée', 'Déconseillé'),
-- Digestif
('Mopral',            'Oméprazole',              'Gélule',       '10mg / 20mg',  'Per os',  'IPP - Antiulcéreux',          'A02BC01', 0, 0, '40mg/jour', 'Associations à éviter avec atazanavir', 'Déconseillé T1'),
('Inexium',           'Ésoméprazole',            'Comprimé',     '20mg / 40mg',  'Per os',  'IPP - Antiulcéreux',          'A02BC05', 0, 0, '40mg/jour', 'Idem oméprazole', 'Déconseillé'),
('Motilium',          'Dompéridone',             'Comprimé',     '10mg',         'Per os',  'Prokinétique - Antiémétique', 'A03FA03', 1, 0, '30mg/jour', 'Allongement QT, obstruction gastro-intestinale', 'Déconseillé'),
('Zophren',           'Ondansétron',             'Comprimé/Injectable','4mg / 8mg','Per os/IV','Antiémétique - sétron',   'A04AA01', 1, 0, '32mg/jour', 'Allongement QT congénital', 'Déconseillé'),
-- Neurologie / Psychiatrie
('Zyprexa',           'Olanzapine',              'Comprimé',     '5mg / 10mg',   'Per os',  'Antipsychotique',             'N05AH03', 1, 0, '20mg/jour', 'Glaucome angle fermé', 'Déconseillé'),
('Rivotril',          'Clonazépam',              'Comprimé/Injectable','2mg',    'Per os/IV','Antiépileptique - Benzodiazépine','N03AE01',1,1,'Selon indication','Insuffisance respiratoire, dépendance','Contre-indiqué'),
('Dépakine',          'Valproate de sodium',     'Comprimé LP',  '200mg / 500mg','Per os',  'Antiépileptique',             'N03AG01', 1, 0, '60mg/kg/jour', 'Grossesse (tératogène), hépatite', 'Contre-indiqué'),
('Keppra',            'Lévétiracétam',           'Comprimé',     '250mg / 500mg','Per os',  'Antiépileptique',             'N03AX14', 1, 0, '3g/jour', 'Hypersensibilité', 'Déconseillé'),
-- Anesthésie / Réanimation
('Propofol Lipuro',   'Propofol',                'Injectable',   '10mg/mL',      'IV',      'Anesthésique général',        'N01AX10', 1, 0, 'Selon protocole', 'Allergie oeuf-soja (relative)', 'Contre-indiqué'),
('Esketamine Panpharma','Eskétamine',            'Injectable',   '5mg/mL',       'IV',      'Anesthésique dissociatif',    'N01AX14', 1, 1, 'Selon protocole', 'HTA non contrôlée, schizophrénie', 'Contre-indiqué'),
('Nimbex',            'Cisatracurium',           'Injectable',   '2mg/mL',       'IV',      'Curare non dépolarisant',     'M03AC11', 1, 0, 'Selon protocole', 'Hypersensibilité', 'Déconseillé'),
-- Divers
('Zyrtec',            'Cétirizine',              'Comprimé',     '10mg',         'Per os',  'Antihistaminique H1',         'R06AE07', 0, 0, '10mg/jour', 'Insuffisance rénale sévère (adapter dose)', 'Déconseillé T1'),
('Cortancyl',         'Prednisone',              'Comprimé',     '1mg / 5mg / 20mg','Per os','Corticostéroïde oral',       'H02AB07', 1, 0, 'Selon indication', 'Infection non traitée', 'Déconseillé'),
('NaCl 0.9%',         'Chlorure de sodium',      'Injectable',   '0.9% - 500mL / 1L','IV',  'Soluté de remplissage',      'B05BB01', 1, 0, 'Selon état clinique', 'Hypernatrémie, hyperchlorémie', 'Autorisé'),
('Ringer Lactate',    'Ringer Lactate',          'Injectable',   '500mL / 1L',   'IV',      'Soluté de remplissage',      'B05BB01', 1, 0, 'Selon état clinique', 'Insuffisance hépatique sévère', 'Autorisé'),
('Vitamine C Mylan',  'Acide Ascorbique',        'Injectable',   '500mg/5mL',    'IV',      'Vitamine',                   'A11GA01', 1, 0, '2g/jour', 'Lithiase oxalique antérieure', 'Autorisé'),
('Calcium Sandoz',    'Gluconate de Calcium',    'Injectable',   '10% - 10mL',   'IV',      'Électrolyte - Calcium',      'A12AA03', 1, 0, 'Selon calcémie cible', 'Hypercalcémie, digitalisation', 'Autorisé'),
('KCl Lavoisier',     'Chlorure de Potassium',   'Injectable',   '10%',          'IV',      'Électrolyte - Potassium',    'A12BA01', 1, 0, 'Selon kaliémie', 'Hyperkaliémie (CI absolue en IV direct)', 'Autorisé'),
('Insuline humaine',  'Insuline Humaine',        'Injectable',   'Actrapid 100UI/mL','IV/SC','Insuline rapide humaine',   'A10AB01', 1, 0, 'Selon glycémie', 'Hypoglycémie', 'Autorisé');


-- =============================================================================
-- SECTION 8 — PRESCRIPTIONS TABLE (detailed, NLP-enriched)
-- =============================================================================

CREATE TABLE IF NOT EXISTS prescriptions (
    prescription_id     INTEGER PRIMARY KEY AUTOINCREMENT,

    -- Patient link (one or both may be set)
    patient_id          INTEGER REFERENCES patients(patient_id),
    patient_name_free   TEXT,                         -- free-text if patient not found in DB

    -- Prescriber
    prescriber_staff_id INTEGER REFERENCES staff(staff_id),
    prescriber_name_free TEXT,                        -- free-text fallback

    -- Drug (one or both may be set)
    medicament_id       INTEGER REFERENCES medicaments(med_ref_id),
    drug_name_free      TEXT,                         -- free-text if not in medicaments table

    -- Prescription details (mapped from NLP or filled manually)
    dosage              TEXT,                         -- ex: '500mg', '1g'
    form                TEXT,                         -- ex: 'Comprimé', 'Injectable'
    route               TEXT,                         -- ex: 'Per os', 'IV', 'IM', 'SC'
    frequency           TEXT,                         -- ex: '3x/jour', '1x matin', 'toutes les 6h'
    start_date          DATE,
    end_date            DATE,
    duration_days       INTEGER,                      -- nb of days if specified

    -- Clinical context
    indication          TEXT,                         -- pourquoi ce médicament
    diagnostic          TEXT,                         -- diagnostic associé
    service             TEXT,                         -- service / department
    chambre             TEXT,                         -- numéro de chambre
    priorite            TEXT    CHECK (priorite IN ('NORMALE','URGENTE','STAT') OR priorite IS NULL),
    allergie_signalee   TEXT,                         -- allergie signalée dans la phrase NLP
    action              TEXT,                         -- ex: 'prescrire', 'stopper', 'modifier'
    examen              TEXT,                         -- examen associé si mentionné
    notes               TEXT,                         -- note libre

    -- NLP metadata — filled automatically when saved via NLP bot
    nlp_raw_text        TEXT,                         -- phrase originale saisie
    nlp_extracted_json  TEXT,                         -- JSON complet extrait par Claude
    nlp_confidence      TEXT    CHECK (nlp_confidence IN ('HIGH','MEDIUM','LOW') OR nlp_confidence IS NULL),
    nlp_fields_auto     TEXT,                         -- JSON list of fields auto-filled from NLP

    -- Workflow
    is_validated        INTEGER NOT NULL DEFAULT 0   CHECK (is_validated IN (0,1)),
    validated_by        INTEGER REFERENCES staff(staff_id),
    validated_at        DATETIME,
    is_cancelled        INTEGER NOT NULL DEFAULT 0   CHECK (is_cancelled IN (0,1)),
    cancelled_reason    TEXT,
    source              TEXT    NOT NULL DEFAULT 'NLP'
                                CHECK (source IN ('NLP','MANUAL','IMPORT','API')),

    -- Audit
    created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_prescriptions_patient  ON prescriptions(patient_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_staff    ON prescriptions(prescriber_staff_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_drug     ON prescriptions(medicament_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_date     ON prescriptions(created_at);

-- View: prescriptions enriched with patient and drug names
CREATE VIEW IF NOT EXISTS v_prescriptions AS
SELECT
    pr.prescription_id,
    pr.created_at,
    COALESCE(p.first_name || ' ' || p.last_name, pr.patient_name_free, 'Patient inconnu') AS patient_name,
    COALESCE(m.brand_name || ' (' || m.inn_name || ')', pr.drug_name_free, 'Médicament non précisé') AS drug_full_name,
    m.category       AS drug_category,
    pr.dosage, pr.form, pr.route, pr.frequency,
    pr.start_date, pr.end_date, pr.indication,
    pr.diagnostic, pr.service, pr.chambre, pr.priorite,
    pr.allergie_signalee, pr.action, pr.notes,
    pr.nlp_raw_text,
    pr.is_validated, pr.is_cancelled,
    COALESCE(sv.title || ' ' || sv.first_name || ' ' || sv.last_name, pr.prescriber_name_free, 'Prescripteur inconnu') AS prescriber_name,
    pr.source
FROM prescriptions pr
LEFT JOIN patients p      ON p.patient_id = pr.patient_id
LEFT JOIN medicaments m   ON m.med_ref_id = pr.medicament_id
LEFT JOIN staff sv        ON sv.staff_id = pr.prescriber_staff_id;

-- =============================================================================
-- END OF ADDITIONS
-- =============================================================================
