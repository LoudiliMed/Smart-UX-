// ─── Adaptateur SIH — Fabrique ───────────────────────────────────────────────
//
// Selectionne l'adaptateur de donnees en fonction de SIH_ADAPTER dans .env.
//
//   SIH_ADAPTER=local  → donnees statiques (database.js) — defaut prototype
//   SIH_ADAPTER=fhir   → serveur HL7 FHIR R4 (FHIR_BASE_URL + FHIR_AUTH_TOKEN)
//
// Chaque adaptateur expose la meme interface asynchrone :
//   getPatients()               → Patient[]
//   getPatient(id)              → Patient | null
//   getMedicaments()            → Medicament[]
//   getObservations(patientId)  → Observation[]
//   getConstantes(patientId)    → Constante[]
//   getImagerie(patientId)      → Imagerie[]
// ─────────────────────────────────────────────────────────────────────────────

const LocalAdapter = require("./local-adapter");
const FhirAdapter  = require("./fhir-adapter");

function createAdapter() {
  const type = (process.env.SIH_ADAPTER || "local").toLowerCase();

  switch (type) {
    case "fhir": {
      const baseUrl    = process.env.FHIR_BASE_URL;
      const authToken  = process.env.FHIR_AUTH_TOKEN;
      if (!baseUrl) {
        console.error("[SIH] SIH_ADAPTER=fhir mais FHIR_BASE_URL est absente dans .env");
        process.exit(1);
      }
      console.log(`[SIH] Adaptateur FHIR R4 — ${baseUrl}`);
      return new FhirAdapter({ baseUrl, authToken });
    }

    case "local":
    default:
      console.log("[SIH] Adaptateur local (donnees statiques database.js)");
      return new LocalAdapter();
  }
}

module.exports = { createAdapter };
