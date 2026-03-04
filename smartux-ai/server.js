const express = require("express");
const cors = require("cors");
const Database = require("better-sqlite3");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());

// ─── Base de données SQLite ───────────────────────────────────────────────────
const db = new Database(path.join(__dirname, "sillage.db"));

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
    created_at        TEXT
  )
`);

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
      is_cancelled, validated_at, source, created_at
    ) VALUES (
      @prescription_id, @patient_id, @patient_name_free, @medicament_id, @drug_name_free,
      @dosage, @form, @route, @frequency, @indication, @diagnostic, @service, @chambre,
      @priorite, @allergie_signalee, @action, @examen, @notes, @nlp_raw_text,
      @nlp_extracted_json, @nlp_confidence, @nlp_fields_auto, @is_validated,
      @is_cancelled, @validated_at, @source, @created_at
    )
  `);
  stmt.run({
    ...rx,
    is_validated: rx.is_validated ? 1 : 0,
    is_cancelled: rx.is_cancelled ? 1 : 0,
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

// Route Groq NLP
const GROQ_API_KEY = "Mets ta clé API ici pour faire le marcher";

app.post("/api/claude", async (req, res) => {
  try {
    const userMessage = req.body.messages[0].content;
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: userMessage }],
        max_tokens: 1000,
        temperature: 0.1,
      }),
    });
    const data = await response.json();
    res.json({ content: [{ text: data.choices[0].message.content }] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(3001, () => console.log("✅ Serveur SILLAGE sur http://localhost:3001"));
