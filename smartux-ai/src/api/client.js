// ─────────────────────────────────────────────────────────────────────────────
//  API CLIENT
//  All HTTP calls to the local Express backend (server.js on port 3001).
//  Centralising them here makes it easy to swap the base URL or auth headers.
// ─────────────────────────────────────────────────────────────────────────────

const API_BASE = "http://localhost:3001";

// ── Safety disclaimer injected/verified on every AI response ─────────────────
//  SAFE-02: dual-layer enforcement — layer 1 is the system prompt,
//  layer 2 (below) prepends the disclaimer if the model omits it.
export const DISCLAIMER = "Analyse assistée par IA — vérification clinique recommandée";

// ── NLP parsing  (non-streaming) ─────────────────────────────────────────────
//  Sends raw medical text → Groq LLM → returns structured JSON object.
export async function parseWithClaude(text) {
  try {
    const res = await fetch(`${API_BASE}/api/claude`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-5",
        max_tokens: 1000,
        messages: [
          {
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
          },
        ],
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      return { erreur: data.error || `Serveur ${res.status}` };
    }

    const raw   = data.content?.[0]?.text || "{}";
    const clean = raw.replace(/```json|```/g, "").trim();
    return JSON.parse(clean);
  } catch (e) {
    return { erreur: "Impossible de parser la réponse IA", raw: e.message };
  }
}

// ── Clinical AI chat  (non-streaming, used by the alert system) ───────────────
//  Sends a system prompt + conversation history → returns full assistant reply.
//  SAFE-02: prepends DISCLAIMER if the model forgets it (model-drift protection).
export async function callAIChat(systemPrompt, userMessage, history = []) {
  try {
    const messages = [
      { role: "system", content: systemPrompt },
      ...history,
      { role: "user", content: userMessage },
    ];

    const res = await fetch(`${API_BASE}/api/claude`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-5",
        max_tokens: 2000,
        messages,
      }),
    });

    if (!res.ok) throw new Error(`AI API error: ${res.status}`);

    const data = await res.json();
    const text = data.content?.[0]?.text || "";

    // Layer 2 failsafe: prepend disclaimer if the model omits it
    if (!text.includes(DISCLAIMER)) return `${DISCLAIMER}\n\n${text}`;
    return text;
  } catch (error) {
    console.error("callAIChat error:", error);
    throw error;
  }
}

// ── Prescription REST helpers ─────────────────────────────────────────────────

export async function fetchPrescriptions() {
  const res = await fetch(`${API_BASE}/api/prescriptions`);
  return res.json();
}

export async function savePrescription(rx) {
  await fetch(`${API_BASE}/api/prescriptions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(rx),
  });
}

export async function patchPrescription(id, changes) {
  await fetch(`${API_BASE}/api/prescriptions/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(changes),
  });
}
