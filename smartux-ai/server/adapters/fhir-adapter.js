// ─── Adaptateur HL7 FHIR R4 ──────────────────────────────────────────────────
//
// Connecte SmartUX-AI a un serveur DPI/SIH exposant l'API HL7 FHIR R4.
// Compatible avec : Crossway, Dx Care, Easily, Hopital Manager, Hapi FHIR...
//
// Configuration requise dans .env :
//   FHIR_BASE_URL   → ex. https://fhir.mon-hopital.fr/fhir/R4
//   FHIR_AUTH_TOKEN → ex. Bearer eyJ... (optionnel si serveur ouvert)
//
// Ressources FHIR consommees :
//   Patient             → getPatient() / getPatients()
//   AllergyIntolerance  → enrichissement des Patient (champ allergies)
//   Medication          → getMedicaments()
//   Observation         → getConstantes() (vital-signs) + getObservations() (survey)
//   ImagingStudy        → getImagerie()
//
// Standard de reference : HL7 FHIR R4 (https://hl7.org/fhir/R4/)
// Impose par le SEGUR du numerique en sante (ANS, France)
// ─────────────────────────────────────────────────────────────────────────────

class FhirAdapter {
  /**
   * @param {object} options
   * @param {string} options.baseUrl    - URL racine FHIR (sans slash final)
   * @param {string} [options.authToken]- Authorization header complet
   */
  constructor({ baseUrl, authToken }) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.headers = {
      Accept: "application/fhir+json",
      "Content-Type": "application/fhir+json",
      ...(authToken ? { Authorization: authToken } : {}),
    };
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  async _fetch(path) {
    const url = `${this.baseUrl}${path}`;
    const res = await fetch(url, { headers: this.headers });
    if (!res.ok) {
      throw new Error(`[FHIR] HTTP ${res.status} — ${url}`);
    }
    return res.json();
  }

  /** Extrait toutes les Resource d'un Bundle FHIR */
  _entries(bundle) {
    return (bundle.entry || []).map(e => e.resource).filter(Boolean);
  }

  /** FHIR gender → M / F */
  _gender(g) {
    return g === "male" ? "M" : g === "female" ? "F" : (g || "N/A");
  }

  /** Cherche un identifier par type code */
  _identifier(resource, typeCode) {
    return resource.identifier?.find(i =>
      i.type?.coding?.some(c => c.code === typeCode)
    )?.value || null;
  }

  /** Cherche une extension par URL */
  _ext(resource, url) {
    return resource.extension?.find(e => e.url === url) || null;
  }

  // ── Mappings FHIR → format interne ────────────────────────────────────────

  /**
   * Patient FHIR R4 → { patient_id, ipp, last_name, first_name,
   *                      date_of_birth, gender, blood_type, room, ward }
   */
  _mapPatient(r) {
    const name = r.name?.[0] || {};
    const ipp  = this._identifier(r, "MR") || r.id;

    // Groupe sanguin : extension standard HL7 FHIR
    const bgExt = this._ext(r,
      "http://hl7.org/fhir/StructureDefinition/patient-bloodGroup"
    );
    const bloodType = bgExt?.valueCodeableConcept?.coding?.[0]?.display || "N/A";

    // Chambre et service : extensions proprietaires SmartUX (ou extension Encounter)
    const room = this._ext(r, "http://fhir.smartux.ai/extension/room")?.valueString || "N/A";
    const ward = this._ext(r, "http://fhir.smartux.ai/extension/ward")?.valueString || "N/A";

    return {
      patient_id:    r.id,
      ipp,
      last_name:     name.family || "",
      first_name:    (name.given || []).join(" "),
      date_of_birth: r.birthDate || "",
      gender:        this._gender(r.gender),
      blood_type:    bloodType,
      room,
      ward,
      allergies:     [], // enrichi par getPatients() / getPatient()
    };
  }

  /**
   * Medication FHIR R4 → { id, brand, inn, form, dosage, route, category }
   *
   * Conventions de coding attendues :
   *   - code.coding[system=ATC]  → DCI (INN)
   *   - code.text                → nom commercial (brand)
   *   - form.coding              → forme galénique
   *   - ingredient[0].strength   → dosage
   *   - route.coding             → voie d'administration
   */
  _mapMedication(r) {
    const codings = r.code?.coding || [];
    const atc     = codings.find(c => c.system?.includes("atc") || c.system?.includes("ATC"));
    const inn     = atc?.display || r.code?.text || codings[0]?.display || "N/A";
    const brand   = r.code?.text || inn;

    const strength = r.ingredient?.[0]?.strength?.numerator;
    const dosage   = strength
      ? `${strength.value}${strength.unit || "mg"}`
      : "N/A";

    const routeCoding = r.route?.coding?.[0];
    const route = routeCoding?.display || r.route?.text || "N/A";

    const category =
      codings.find(c => c.system?.includes("snomed"))?.display ||
      r.code?.coding?.find(c => c.system?.includes("ndc"))?.display ||
      r.code?.text || "N/A";

    return {
      id:       r.id,
      brand,
      inn,
      form:     r.form?.coding?.[0]?.display || r.form?.text || "N/A",
      dosage,
      route,
      category,
    };
  }

  /**
   * Observations vital-signs → [ { id, patient_id, date, ta, fc, temp, spo2, poids } ]
   *
   * Codes LOINC utilises :
   *   8480-6  Pression arterielle systolique
   *   8462-4  Pression arterielle diastolique
   *   8867-4  Frequence cardiaque
   *   8310-5  Temperature corporelle
   *   59408-5 Saturation en oxygene (SpO2)
   *   29463-7 Poids corporel
   */
  _mapVitalSigns(resources) {
    // Regroupe par date/heure pour reconstituer les constantes d'une mesure
    const byDate = {};
    for (const obs of resources) {
      const date = obs.effectiveDateTime || obs.effectivePeriod?.start || obs.issued || "";
      if (!byDate[date]) byDate[date] = { date, _sys: null, _dia: null };

      const code  = obs.code?.coding?.[0]?.code;
      const val   = obs.valueQuantity?.value;
      const patId = obs.subject?.reference?.split("/").pop();
      if (patId) byDate[date].patient_id = patId;

      switch (code) {
        case "8480-6":  byDate[date]._sys  = val; break;
        case "8462-4":  byDate[date]._dia  = val; break;
        case "8867-4":  byDate[date].fc    = val; break;
        case "8310-5":  byDate[date].temp  = val; break;
        case "59408-5": byDate[date].spo2  = val; break;
        case "29463-7": byDate[date].poids = val; break;
      }

      // Certains SIH encodent la TA comme composant (component)
      if (obs.component) {
        for (const comp of obs.component) {
          const cc = comp.code?.coding?.[0]?.code;
          const cv = comp.valueQuantity?.value;
          if (cc === "8480-6") byDate[date]._sys = cv;
          if (cc === "8462-4") byDate[date]._dia = cv;
        }
      }
    }

    return Object.values(byDate).map((c, idx) => ({
      id:         idx + 1,
      patient_id: c.patient_id ? Number(c.patient_id) : 0,
      date:       c.date,
      ta:         (c._sys != null && c._dia != null) ? `${c._sys}/${c._dia}` : "N/A",
      fc:         c.fc    ?? 0,
      temp:       c.temp  ?? 0,
      spo2:       c.spo2  ?? 0,
      poids:      c.poids ?? 0,
    }));
  }

  /**
   * Observation (survey/note) FHIR R4 → { id, patient_id, date, author, category, text }
   */
  _mapClinicalNote(r, idx) {
    return {
      id:         idx + 1,
      patient_id: r.subject?.reference?.split("/").pop() || "",
      date:       r.effectiveDateTime || r.issued || "",
      author:     r.performer?.[0]?.display || "N/A",
      category:   r.category?.[0]?.coding?.[0]?.display || "Note clinique",
      text:       r.valueString || r.note?.[0]?.text || "",
    };
  }

  /**
   * ImagingStudy FHIR R4 → { id, patient_id, type, date, status, description, reader, priority }
   *
   * Status FHIR → libelle francais :
   *   available  → Disponible
   *   registered → En attente
   *   *          → Realise
   */
  _mapImagingStudy(r, idx) {
    const modality = r.series?.[0]?.modality?.code;
    const typeStr  = modality
      ? `${modality}${r.description ? " — " + r.description : ""}`
      : (r.description || "Examen imagerie");

    const statusMap = { available: "Disponible", registered: "En attente" };
    const status    = statusMap[r.status] || "Realise";

    const priority = this._ext(r, "http://fhir.smartux.ai/extension/priority")
      ?.valueString || "NORMALE";

    return {
      id:          idx + 1,
      patient_id:  r.subject?.reference?.split("/").pop() || "",
      type:        typeStr,
      date:        r.started?.slice(0, 10) || "",
      status,
      description: r.description || "",
      reader:      r.interpreter?.[0]?.display || null,
      priority,
    };
  }

  // ── Interface publique ─────────────────────────────────────────────────────

  async getPatients() {
    const bundle   = await this._fetch("/Patient?_count=100");
    const patients = this._entries(bundle).map(r => this._mapPatient(r));

    // Enrichissement allergies (en parallele par patient)
    await Promise.all(patients.map(async p => {
      try {
        const ab = await this._fetch(`/AllergyIntolerance?patient=${p.patient_id}`);
        p.allergies = this._entries(ab)
          .map(r => r.substance?.coding?.[0]?.display?.toLowerCase() || "")
          .filter(Boolean);
      } catch (_) { /* allergies non disponibles — pas bloquant */ }
    }));

    return patients;
  }

  async getPatient(id) {
    const resource = await this._fetch(`/Patient/${id}`);
    const patient  = this._mapPatient(resource);

    try {
      const ab = await this._fetch(`/AllergyIntolerance?patient=${id}`);
      patient.allergies = this._entries(ab)
        .map(r => r.substance?.coding?.[0]?.display?.toLowerCase() || "")
        .filter(Boolean);
    } catch (_) {}

    return patient;
  }

  async getMedicaments() {
    const bundle = await this._fetch("/Medication?_count=200");
    return this._entries(bundle).map(r => this._mapMedication(r));
  }

  /** Notes cliniques — Observation category=survey (ou DiagnosticReport selon SIH) */
  async getObservations(patientId) {
    const bundle = await this._fetch(
      `/Observation?patient=${patientId}&category=survey&_count=50`
    );
    return this._entries(bundle).map((r, i) => this._mapClinicalNote(r, i));
  }

  /** Constantes vitales — Observation category=vital-signs */
  async getConstantes(patientId) {
    const bundle = await this._fetch(
      `/Observation?patient=${patientId}&category=vital-signs&_count=100`
    );
    return this._mapVitalSigns(this._entries(bundle));
  }

  /** Imagerie — ImagingStudy */
  async getImagerie(patientId) {
    const bundle = await this._fetch(`/ImagingStudy?patient=${patientId}&_count=50`);
    return this._entries(bundle).map((r, i) => this._mapImagingStudy(r, i));
  }
}

module.exports = FhirAdapter;
