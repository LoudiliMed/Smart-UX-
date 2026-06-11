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

// ── Authentication ────────────────────────────────────────────────────────────
export async function authLogin(login, password) {
  const res = await fetch(`${API_BASE}/api/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ login, password }),
  });
  const data = await res.json();
  if (!res.ok) return { error: data.error || "Erreur d'authentification." };
  return { user: data.user };
}

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

// ── Face-descriptor "database" ────────────────────────────────────────────────
//  Descriptors are synced to the server (face_descriptors table) and mirrored
//  to localStorage so biometrics keep working offline.
//  A descriptor is a 128-float embedding — never an image.
const FACE_LS_KEY = "smartux_face_descriptors";

function lsReadFaces() {
  try { return JSON.parse(localStorage.getItem(FACE_LS_KEY) || "[]"); }
  catch { return []; }
}
function lsWriteFaces(list) {
  localStorage.setItem(FACE_LS_KEY, JSON.stringify(list));
}

/** Returns [{ staff_id, employee_number, descriptor:number[], enrolled_at }]. */
export async function fetchFaceDescriptors() {
  try {
    const res = await fetch(`${API_BASE}/api/faces`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    lsWriteFaces(data); // keep local copy in sync
    return data;
  } catch {
    return lsReadFaces();
  }
}

/** Enrol (or re-enrol) a staff member's face. Mirrors to localStorage. */
export async function saveFaceDescriptor({ staff_id, employee_number, descriptor }) {
  const record = { staff_id, employee_number, descriptor, enrolled_at: new Date().toISOString() };
  const list = lsReadFaces().filter(f => f.staff_id !== staff_id);
  lsWriteFaces([...list, record]);
  try {
    await fetch(`${API_BASE}/api/faces`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ staff_id, employee_number, descriptor }),
    });
  } catch { /* server unreachable — localStorage already updated */ }
}

/** Remove a staff member's enrolled face from both stores. */
export async function deleteFaceDescriptor(staff_id) {
  lsWriteFaces(lsReadFaces().filter(f => f.staff_id !== staff_id));
  try {
    await fetch(`${API_BASE}/api/faces/${staff_id}`, { method: "DELETE" });
  } catch { /* server unreachable */ }
}

// ── localStorage helpers for offline persistence ─────────────────────────────
const LS_KEY = "smartux_prescriptions";

function getLocalPrescriptions() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || "[]");
  } catch { return []; }
}

function setLocalPrescriptions(rxList) {
  localStorage.setItem(LS_KEY, JSON.stringify(rxList));
}

// ── Prescription REST helpers ─────────────────────────────────────────────────

export async function fetchPrescriptions() {
  try {
    const res = await fetch(`${API_BASE}/api/prescriptions`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    setLocalPrescriptions(data);  // sync local cache on success
    return data;
  } catch {
    // Server unreachable — fall back to localStorage
    return getLocalPrescriptions();
  }
}

export async function savePrescription(rx) {
  // Always persist locally first (survives server downtime)
  const local = getLocalPrescriptions();
  const idx = local.findIndex(r => r.prescription_id === rx.prescription_id);
  if (idx >= 0) local[idx] = rx; else local.unshift(rx);
  setLocalPrescriptions(local);

  // Then try server
  await fetch(`${API_BASE}/api/prescriptions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(rx),
  });
}

export async function patchPrescription(id, changes) {
  // Update local cache
  const local = getLocalPrescriptions();
  const idx = local.findIndex(r => r.prescription_id === id);
  if (idx >= 0) {
    local[idx] = { ...local[idx], ...changes };
    setLocalPrescriptions(local);
  }

  await fetch(`${API_BASE}/api/prescriptions/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(changes),
  });
}
