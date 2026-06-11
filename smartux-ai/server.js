require("dotenv").config();
const express = require("express");
const cors = require("cors");
const Database = require("better-sqlite3");
const path = require("path");
const crypto = require("crypto");
const { createAdapter } = require("./server/adapters");

// ─── Staff lookup (no passwords — source of truth for auth responses) ─────────
const STAFF_LOOKUP = [
  { staff_id:1,  employee_number:"EMP-001", title:"Dr",  last_name:"Martin",    first_name:"Sophie",   role_label:"Médecin",                         access_level:4, dept:"Cardiologie",           specialty:"Cardiologie",            biometric_enrolled:1 },
  { staff_id:2,  employee_number:"EMP-002", title:"Pr",  last_name:"Dubois",    first_name:"Laurent",  role_label:"Médecin",                         access_level:4, dept:"Neurologie",            specialty:"Neurologie",             biometric_enrolled:1 },
  { staff_id:3,  employee_number:"EMP-003", title:"Dr",  last_name:"Bernard",   first_name:"Isabelle", role_label:"Chirurgien",                      access_level:4, dept:"Chirurgie Générale",    specialty:"Chirurgie Digestive",    biometric_enrolled:1 },
  { staff_id:4,  employee_number:"EMP-004", title:"Dr",  last_name:"Leroy",     first_name:"Karim",    role_label:"Anesthésiste-Réanimateur",        access_level:4, dept:"Réanimation",           specialty:"Anesthésie-Réanimation", biometric_enrolled:1 },
  { staff_id:5,  employee_number:"EMP-005", title:"",    last_name:"Moreau",    first_name:"Céline",   role_label:"Cadre de Santé",                  access_level:3, dept:"Cardiologie",           specialty:null,                     biometric_enrolled:1 },
  { staff_id:6,  employee_number:"EMP-006", title:"IDE", last_name:"Simon",     first_name:"Pierre",   role_label:"Infirmier(e) Diplômé(e) d'État",  access_level:3, dept:"Urgences",              specialty:null,                     biometric_enrolled:0 },
  { staff_id:7,  employee_number:"EMP-007", title:"AS",  last_name:"Laurent",   first_name:"Nadia",    role_label:"Aide-Soignant(e)",                access_level:2, dept:"Chirurgie Orthopédique",specialty:null,                     biometric_enrolled:0 },
  { staff_id:8,  employee_number:"EMP-008", title:"Dr",  last_name:"Rousseau",  first_name:"Marc",     role_label:"Biologiste Médical",              access_level:4, dept:"Laboratoire",           specialty:"Biologie Médicale",      biometric_enrolled:1 },
  { staff_id:9,  employee_number:"EMP-009", title:"Dr",  last_name:"Petit",     first_name:"Amina",    role_label:"Radiologue",                      access_level:4, dept:"Radiologie",            specialty:"Radiologie",             biometric_enrolled:1 },
  { staff_id:10, employee_number:"EMP-010", title:"",    last_name:"Garcia",    first_name:"Julien",   role_label:"Stagiaire / Interne",             access_level:2, dept:"Neurologie",            specialty:"Interne Neurologie",     biometric_enrolled:0 },
  { staff_id:11, employee_number:"EMP-011", title:"",    last_name:"Fontaine",  first_name:"Léa",      role_label:"Sage-Femme",                      access_level:4, dept:"Maternité",             specialty:"Obstétrique",            biometric_enrolled:1 },
  { staff_id:12, employee_number:"EMP-012", title:"",    last_name:"Renard",    first_name:"Thomas",   role_label:"Pharmacien",                      access_level:3, dept:"Pharmacie",             specialty:"Pharmacie Clinique",     biometric_enrolled:0 },
  { staff_id:13, employee_number:"EMP-013", title:"",    last_name:"Chevalier", first_name:"Marie",    role_label:"Secrétaire Médicale",             access_level:2, dept:"Administration",        specialty:null,                     biometric_enrolled:0 },
  { staff_id:14, employee_number:"EMP-014", title:"",    last_name:"Bonnet",    first_name:"Paul",     role_label:"Agent d'Accueil",                 access_level:1, dept:"Administration",        specialty:null,                     biometric_enrolled:0 },
  { staff_id:15, employee_number:"EMP-015", title:"",    last_name:"Dupont",    first_name:"Hélène",   role_label:"Administrateur Système",          access_level:5, dept:"Administration",        specialty:null,                     biometric_enrolled:1 },
  { staff_id:16, employee_number:"EMP-ADM", title:"",    last_name:"",          first_name:"Admin",    role_label:"Super Administrateur",            access_level:5, dept:"Administration Système",specialty:"Gestion des accès",      biometric_enrolled:1 },
];

// Default credentials hashed on first startup (plaintext only used once, then stored as scrypt hash)
const DEFAULT_CREDENTIALS = [
  { staff_id:1,  password:"sophie2024"  },
  { staff_id:2,  password:"laurent2024" },
  { staff_id:3,  password:"isa2024"     },
  { staff_id:4,  password:"karim2024"   },
  { staff_id:5,  password:"celine2024"  },
  { staff_id:6,  password:"pierre2024"  },
  { staff_id:7,  password:"nadia2024"   },
  { staff_id:8,  password:"marc2024"    },
  { staff_id:9,  password:"amina2024"   },
  { staff_id:10, password:"julien2024"  },
  { staff_id:11, password:"lea2024"     },
  { staff_id:12, password:"thomas2024"  },
  { staff_id:13, password:"marie2024"   },
  { staff_id:14, password:"paul2024"    },
  { staff_id:15, password:"helene2024"  },
  { staff_id:16, password:"admin"       },
];

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(":");
  const computed = crypto.scryptSync(password, salt, 64).toString("hex");
  return computed === hash;
}

const sihAdapter = createAdapter();

const PORT = Number(process.env.PORT) || 3001;
const DB_PATH = process.env.DB_PATH || path.join(__dirname, "sillage.db");

if (!process.env.GROQ_API_KEY) {
  console.error("GROQ_API_KEY manquante — ajoutez-la dans .env");
  process.exit(1);
}

const app = express();
app.use(cors());
app.use(express.json());

// ─── Base de données SQLite ───────────────────────────────────────────────────
const db = new Database(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS prescriptions (
    prescription_id   INTEGER PRIMARY KEY,
    patient_id        INTEGER,
    patient_name_free TEXT,
    medicament_id     INTEGER,
    drug_name_free    TEXT,
    dosage            TEXT,
    form              TEXT,
    route             TEXT,
    frequency         TEXT,
    indication        TEXT,
    diagnostic        TEXT,
    service           TEXT,
    chambre           TEXT,
    priorite          TEXT,
    allergie_signalee TEXT,
    action            TEXT,
    examen            TEXT,
    notes             TEXT,
    nlp_raw_text      TEXT,
    nlp_extracted_json TEXT,
    nlp_confidence    TEXT,
    nlp_fields_auto   TEXT,
    is_validated      INTEGER DEFAULT 0,
    is_cancelled      INTEGER DEFAULT 0,
    validated_at      TEXT,
    source            TEXT,
    created_at        TEXT,
    fois_par_jour     INTEGER,
    nb_jours          INTEGER,
    echeance          TEXT,
    indication_clinique TEXT,
    urgence           TEXT
  )
`);

// Migration: add new columns to existing prescriptions tables
for (const col of [
  ["fois_par_jour", "INTEGER"],
  ["nb_jours", "INTEGER"],
  ["echeance", "TEXT"],
  ["indication_clinique", "TEXT"],
  ["urgence", "TEXT"],
]) {
  try { db.exec(`ALTER TABLE prescriptions ADD COLUMN ${col[0]} ${col[1]}`); }
  catch (_) { /* column already exists */ }
}

db.exec(`
  CREATE TABLE IF NOT EXISTS staff_credentials (
    staff_id      INTEGER PRIMARY KEY,
    password_hash TEXT NOT NULL
  )
`);

// Seed hashed passwords on first run — plaintext never leaves the server
const credCount = db.prepare("SELECT COUNT(*) as n FROM staff_credentials").get().n;
if (credCount === 0) {
  const insertCred = db.prepare("INSERT INTO staff_credentials (staff_id, password_hash) VALUES (?, ?)");
  for (const { staff_id, password } of DEFAULT_CREDENTIALS) {
    insertCred.run(staff_id, hashPassword(password));
  }
  console.log("staff_credentials: mots de passe hachés initialisés.");
}

// ─── Empreintes faciales (reconnaissance biométrique) ─────────────────────────
//  Un descripteur = embedding 128-float calculé par face-api.js côté navigateur.
//  Aucune image n'est stockée — uniquement le vecteur, sérialisé en JSON.
db.exec(`
  CREATE TABLE IF NOT EXISTS face_descriptors (
    staff_id        INTEGER PRIMARY KEY,
    employee_number TEXT,
    descriptor_json TEXT NOT NULL,
    enrolled_at     TEXT
  )
`);

// GET tous les visages enrôlés
app.get("/api/faces", (req, res) => {
  const rows = db.prepare("SELECT * FROM face_descriptors").all();
  const parsed = rows.map(r => ({
    staff_id: r.staff_id,
    employee_number: r.employee_number,
    descriptor: JSON.parse(r.descriptor_json),
    enrolled_at: r.enrolled_at,
  }));
  res.json(parsed);
});

// POST enrôler / mettre à jour le visage d'un membre du personnel
app.post("/api/faces", (req, res) => {
  const { staff_id, employee_number, descriptor } = req.body;
  if (!Number.isInteger(staff_id) || !Array.isArray(descriptor) || descriptor.length !== 128) {
    return res.status(400).json({ error: "staff_id (int) et descriptor (128 floats) requis" });
  }
  db.prepare(`
    INSERT OR REPLACE INTO face_descriptors (staff_id, employee_number, descriptor_json, enrolled_at)
    VALUES (@staff_id, @employee_number, @descriptor_json, @enrolled_at)
  `).run({
    staff_id,
    employee_number: employee_number || null,
    descriptor_json: JSON.stringify(descriptor),
    enrolled_at: new Date().toISOString(),
  });
  res.json({ success: true });
});

// DELETE supprimer l'enrôlement d'un membre
app.delete("/api/faces/:staffId", (req, res) => {
  db.prepare("DELETE FROM face_descriptors WHERE staff_id = ?").run(Number(req.params.staffId));
  res.json({ success: true });
});

// POST authentification
app.post("/api/auth", (req, res) => {
  const { login, password } = req.body;
  if (!login || !password) return res.status(400).json({ error: "Identifiants manquants." });

  const q = login.trim().toLowerCase();
  const staff = STAFF_LOOKUP.find(u =>
    u.last_name.toLowerCase() === q ||
    u.employee_number.toLowerCase() === q ||
    u.first_name.toLowerCase() === q
  );
  if (!staff) return res.status(401).json({ error: "Identifiant inconnu." });

  const cred = db.prepare("SELECT password_hash FROM staff_credentials WHERE staff_id = ?").get(staff.staff_id);
  if (!cred || !verifyPassword(password, cred.password_hash)) {
    return res.status(401).json({ error: "Mot de passe incorrect." });
  }

  res.json({ user: staff });
});

// GET toutes les prescriptions
app.get("/api/prescriptions", (req, res) => {
  const rows = db.prepare("SELECT * FROM prescriptions ORDER BY created_at DESC").all();
  const parsed = rows.map(r => ({
    ...r,
    is_validated: !!r.is_validated,
    is_cancelled: !!r.is_cancelled,
  }));
  res.json(parsed);
});

// POST enregistrer une prescription
app.post("/api/prescriptions", (req, res) => {
  const rx = req.body;
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO prescriptions (
      prescription_id, patient_id, patient_name_free, medicament_id, drug_name_free,
      dosage, form, route, frequency, indication, diagnostic, service, chambre,
      priorite, allergie_signalee, action, examen, notes, nlp_raw_text,
      nlp_extracted_json, nlp_confidence, nlp_fields_auto, is_validated,
      is_cancelled, validated_at, source, created_at,
      fois_par_jour, nb_jours, echeance, indication_clinique, urgence
    ) VALUES (
      @prescription_id, @patient_id, @patient_name_free, @medicament_id, @drug_name_free,
      @dosage, @form, @route, @frequency, @indication, @diagnostic, @service, @chambre,
      @priorite, @allergie_signalee, @action, @examen, @notes, @nlp_raw_text,
      @nlp_extracted_json, @nlp_confidence, @nlp_fields_auto, @is_validated,
      @is_cancelled, @validated_at, @source, @created_at,
      @fois_par_jour, @nb_jours, @echeance, @indication_clinique, @urgence
    )
  `);
  stmt.run({
    ...rx,
    is_validated: rx.is_validated ? 1 : 0,
    is_cancelled: rx.is_cancelled ? 1 : 0,
    fois_par_jour: rx.fois_par_jour ?? null,
    nb_jours: rx.nb_jours ?? null,
    echeance: rx.echeance ?? null,
    indication_clinique: rx.indication_clinique ?? null,
    urgence: rx.urgence ?? null,
  });
  res.json({ success: true });
});

// PATCH mettre à jour une prescription
app.patch("/api/prescriptions/:id", (req, res) => {
  const { id } = req.params;
  const changes = req.body;
  const fields = Object.keys(changes).map(k => `${k} = @${k}`).join(", ");
  const stmt = db.prepare(`UPDATE prescriptions SET ${fields} WHERE prescription_id = @id`);
  stmt.run({
    ...changes,
    id: Number(id),
    is_validated: changes.is_validated !== undefined ? (changes.is_validated ? 1 : 0) : undefined,
    is_cancelled: changes.is_cancelled !== undefined ? (changes.is_cancelled ? 1 : 0) : undefined,
  });
  res.json({ success: true });
});

// ─── Routes SIH — Adaptateur (local | FHIR R4) ───────────────────────────────

// GET /api/patients — liste de tous les patients
app.get("/api/patients", async (req, res) => {
  try {
    const patients = await sihAdapter.getPatients();
    res.json(patients);
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

// GET /api/patients/:id — dossier complet d'un patient
app.get("/api/patients/:id", async (req, res) => {
  try {
    const patient = await sihAdapter.getPatient(req.params.id);
    if (!patient) return res.status(404).json({ error: "Patient introuvable." });
    const [observations, constantes, imagerie] = await Promise.all([
      sihAdapter.getObservations(req.params.id),
      sihAdapter.getConstantes(req.params.id),
      sihAdapter.getImagerie(req.params.id),
    ]);
    res.json({ patient, observations, constantes, imagerie });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

// GET /api/patients/:id/observations
app.get("/api/patients/:id/observations", async (req, res) => {
  try {
    res.json(await sihAdapter.getObservations(req.params.id));
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

// GET /api/patients/:id/constantes
app.get("/api/patients/:id/constantes", async (req, res) => {
  try {
    res.json(await sihAdapter.getConstantes(req.params.id));
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

// GET /api/patients/:id/imagerie
app.get("/api/patients/:id/imagerie", async (req, res) => {
  try {
    res.json(await sihAdapter.getImagerie(req.params.id));
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

// GET /api/medicaments — formulaire medicamenteux de l'etablissement
app.get("/api/medicaments", async (req, res) => {
  try {
    res.json(await sihAdapter.getMedicaments());
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

// Route Groq NLP
const GROQ_API_KEY = process.env.GROQ_API_KEY;

app.post("/api/claude", async (req, res) => {
  try {
    const { messages, max_tokens = 1000 } = req.body;
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages,
        max_tokens,
        temperature: 0.1,
      }),
    });
    const data = await response.json();
    if (!response.ok || !data.choices?.[0]) {
      const msg = data.error?.message || `Groq HTTP ${response.status}`;
      return res.status(502).json({ error: msg });
    }
    res.json({ content: [{ text: data.choices[0].message.content }] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Route Groq SSE streaming (CHAT-03)
app.post("/api/claude-stream", async (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders(); // Send headers immediately — without this Express buffers and stream appears non-streaming

  const { messages, max_tokens = 1000 } = req.body;
  let buffer = "";

  try {
    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages,
        max_tokens,
        temperature: 0.3,
        stream: true,
      }),
    });

    const reader = groqRes.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop(); // Retain incomplete trailing line (Pitfall 4 mitigation)
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const payload = line.slice(6).trim();
        if (payload === "[DONE]") {
          res.write("data: [DONE]\n\n");
          res.end();
          return;
        }
        try {
          const json = JSON.parse(payload);
          const token = json.choices?.[0]?.delta?.content;
          if (token) res.write(`data: ${token}\n\n`);
        } catch (_) { /* skip partial/malformed lines */ }
      }
    }
    res.write("data: [DONE]\n\n");
    res.end();
  } catch (e) {
    res.write(`data: [ERROR] ${e.message}\n\n`);
    res.end();
  }
});

app.listen(PORT, () => console.log(`Serveur SILLAGE sur http://localhost:${PORT}`));
