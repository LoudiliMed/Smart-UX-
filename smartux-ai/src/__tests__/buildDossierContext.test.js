// buildDossierContext.test.js
// Unit tests for the patient dossier context builder (SAFE-01)
// PHI strategy: option-b (tokenized H-{id} header) — DPA pending

jest.mock('../database', () => ({
  DB_CONSTANTES: [
    { patient_id: 1, date: '2024-01-15', ta: '120/80', fc: 72, temp: 37.1, spo2: 98, poids: 75 },
    { patient_id: 1, date: '2024-01-10', ta: '130/85', fc: 80, temp: 37.5, spo2: 97, poids: 75 },
  ],
  DB_OBSERVATIONS: [
    { patient_id: 1, date: '2024-01-15', category: 'Cardiologie', text: 'Etat stable.' },
  ],
  KNOWN_ALLERGIES: { 2: ['pénicilline'], 3: ['aspirine', 'codéine'] },
  DB_MEDICAMENTS: [
    { id: 10, brand: 'Amoxicilline', inn: 'amoxicillin' }
  ],
  DB_PATIENTS: [],
  DB_STAFF: [],
  DB_MEDICAMENTS_EXTRA: [],
  TYPO_CORRECTIONS: {},
  AUTOCOMPLETE_CORPUS: [],
  ACCESS_PERMISSIONS: {},
  PERM_LABELS: {},
  DB_IMAGERIE: [],
}));

import { buildDossierContext } from '../SmartUX_AI_Bots';

const patient1 = {
  patient_id: 1,
  first_name: 'Jean',
  last_name: 'Dupont',
  ipp: 'IPP-000001',
  date_of_birth: '1954-03-12',
  ward: 'Cardiologie Conventionnelle',
  room: '102',
};

describe('buildDossierContext', () => {
  // Test 1 (option-b): Header uses anonymized token H-{id}, NOT real name
  test('returns a string containing the anonymized patient token H-1 (not the real name)', () => {
    const result = buildDossierContext(patient1, []);
    expect(result).toContain('H-1');
  });

  // Test 2 (option-b): Real name and IPP must NOT appear in output
  test('does NOT contain the real patient name or IPP in output', () => {
    const result = buildDossierContext(patient1, []);
    expect(result).not.toContain('Jean Dupont');
    expect(result).not.toContain('IPP-000001');
    expect(result).not.toMatch(/Patient H-\d+.*IPP/);
  });

  // Test 3: Age computed from date_of_birth, not the raw DOB string
  test('returns a string containing computed age (not the raw date_of_birth)', () => {
    const result = buildDossierContext(patient1, []);
    const expectedAge = new Date().getFullYear() - new Date(patient1.date_of_birth).getFullYear();
    expect(result).toContain(`${expectedAge} ans`);
    expect(result).not.toContain('1954-03-12');
  });

  // Test 4: Empty prescriptions → French sentinel string
  test('returns "Aucun traitement en cours" when prescriptions array is empty', () => {
    const result = buildDossierContext(patient1, []);
    expect(result).toContain('Aucun traitement en cours');
  });

  // Test 5: No KNOWN_ALLERGIES entry for patient_id=1 → French sentinel
  test('returns "Aucune allergie connue" when patient has no KNOWN_ALLERGIES entry', () => {
    const result = buildDossierContext(patient1, []);
    expect(result).toContain('Aucune allergie connue');
  });

  // Test 6: No DB_CONSTANTES entry for patient → "Non disponibles" sentinel
  test('returns "Constantes : Non disponibles" when no DB_CONSTANTES entry exists for patient', () => {
    const patientNoVitals = { ...patient1, patient_id: 99 };
    const result = buildDossierContext(patientNoVitals, []);
    expect(result).toContain('Constantes : Non disponibles');
  });

  // Test 7: Non-empty prescriptions → drug name + dosage + route appear
  test('medication line includes drug name, dosage, and route for non-empty prescriptions', () => {
    const prescriptions = [
      {
        patient_id: 1,
        drug_name_free: 'Paracétamol',
        medicament_id: null,
        dosage: '1g',
        route: 'Per os',
      },
    ];
    const result = buildDossierContext(patient1, prescriptions);
    expect(result).toContain('Paracétamol');
    expect(result).toContain('1g');
    expect(result).toContain('Per os');
  });

  // Test 8: Only the most recent DB_CONSTANTES entry appears (2024-01-15, NOT 2024-01-10)
  test('shows only the most recent vitals entry (2024-01-15), not older entries', () => {
    const result = buildDossierContext(patient1, []);
    // Most recent TA is 120/80 (2024-01-15); older entry has 130/85 (2024-01-10)
    expect(result).toContain('120/80');
    expect(result).not.toContain('130/85');
  });

  // Test 9: Returns null when patient argument is null or undefined
  test('returns null when patient argument is null', () => {
    expect(buildDossierContext(null, [])).toBeNull();
  });

  test('returns null when patient argument is undefined', () => {
    expect(buildDossierContext(undefined, [])).toBeNull();
  });
});
