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
const GROQ_API_KEY = "REDACTED_GROQ_API_KEY";

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

app.listen(3001, () => console.log("✅ Serveur SILLAGE sur http://localhost:3001"));
