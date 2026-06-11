// ─── Adaptateur Local ─────────────────────────────────────────────────────────
//
// Expose les donnees statiques de src/database.js via l'interface SIH.
// Utilise dynamic import() pour charger le module ES depuis du CommonJS.
//
// Aucune configuration requise — fonctionne directement avec les tableaux
// existants (DB_PATIENTS, DB_MEDICAMENTS, DB_OBSERVATIONS, etc.).
// ─────────────────────────────────────────────────────────────────────────────

const path = require("path");

class LocalAdapter {
  constructor() {
    this._cache = null;
  }

  // Charge database.js une seule fois (ES module via dynamic import)
  async _load() {
    if (this._cache) return this._cache;

    const dbPath = path.resolve(__dirname, "../../src/database.js");
    const mod = await import(dbPath);

    this._cache = {
      patients:     mod.DB_PATIENTS,
      medicaments:  mod.DB_MEDICAMENTS,
      observations: mod.DB_OBSERVATIONS,
      constantes:   mod.DB_CONSTANTES,
      imagerie:     mod.DB_IMAGERIE,
      allergies:    mod.KNOWN_ALLERGIES,
    };
    return this._cache;
  }

  async getPatients() {
    const { patients, allergies } = await this._load();
    return patients.map(p => ({
      ...p,
      allergies: allergies[p.patient_id] || [],
    }));
  }

  async getPatient(id) {
    const all = await this.getPatients();
    return all.find(p => String(p.patient_id) === String(id)) || null;
  }

  async getMedicaments() {
    const { medicaments } = await this._load();
    return medicaments;
  }

  async getObservations(patientId) {
    const { observations } = await this._load();
    return observations.filter(o => String(o.patient_id) === String(patientId));
  }

  async getConstantes(patientId) {
    const { constantes } = await this._load();
    return constantes.filter(c => String(c.patient_id) === String(patientId));
  }

  async getImagerie(patientId) {
    const { imagerie } = await this._load();
    return imagerie.filter(i => String(i.patient_id) === String(patientId));
  }
}

module.exports = LocalAdapter;
