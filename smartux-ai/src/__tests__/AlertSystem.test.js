import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AlertSystem, parseAlertResponse } from '../SmartUX_AI_Bots';

jest.mock('../database', () => ({
  DB_PATIENTS: [],
  DB_CONSTANTES: [],
  DB_OBSERVATIONS: [],
  KNOWN_ALLERGIES: [],
  DB_MEDICAMENTS: [],
}));

const mockPatient = {
  patient_id: 'P001',
  first_name: 'Marie',
  last_name: 'Dupont',
  age: 65,
  allergies: ['pénicilline'],
};

const mockDraft = { drug_name_free: 'Amoxicilline', dosage: '500mg', route: 'oral' };

function mockFetchWith(responseText) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ content: [{ text: responseText }] }),
  });
}

afterEach(() => { jest.clearAllMocks(); });

// parseAlertResponse unit tests
describe('parseAlertResponse', () => {
  test('parses CRITIQUE line', () => {
    const result = parseAlertResponse('**CRITIQUE** : Allergie pénicilline confirmée');
    expect(result).toHaveLength(1);
    expect(result[0].severity).toBe('CRITIQUE');
    expect(result[0].message).toBe('Allergie pénicilline confirmée');
  });
  test('parses MODERE line', () => {
    const result = parseAlertResponse('**MODERE** : Interaction possible');
    expect(result[0].severity).toBe('MODERE');
  });
  test('parses FAIBLE line', () => {
    const result = parseAlertResponse('**FAIBLE** : Surveiller la tension');
    expect(result[0].severity).toBe('FAIBLE');
  });
  test('returns empty array for "Aucune interaction identifi" response', () => {
    const result = parseAlertResponse('Aucune interaction identifiée');
    expect(result).toHaveLength(0);
  });
});

// AlertSystem component tests
describe('AlertSystem', () => {
  test('ALRT-01: does not fire Claude when patient is null', async () => {
    mockFetchWith('**CRITIQUE** : test');
    render(<AlertSystem patient={null} currentDraft={mockDraft} prescriptions={[]} />);
    await act(async () => { await new Promise(r => setTimeout(r, 1500)); });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('ALRT-01: does not fire Claude when drug_name_free is empty', async () => {
    mockFetchWith('**CRITIQUE** : test');
    render(<AlertSystem patient={mockPatient} currentDraft={{ drug_name_free: '' }} prescriptions={[]} />);
    await act(async () => { await new Promise(r => setTimeout(r, 1500)); });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('ALRT-01: fires Claude call after debounce when drug is set', async () => {
    mockFetchWith('Aucune interaction identifiée');
    render(<AlertSystem patient={mockPatient} currentDraft={mockDraft} prescriptions={[]} />);
    await act(async () => { await new Promise(r => setTimeout(r, 1500)); });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test('ALRT-02: displays patient name and ID in header when checking', async () => {
    mockFetchWith('**CRITIQUE** : Allergie confirmée');
    render(<AlertSystem patient={mockPatient} currentDraft={mockDraft} prescriptions={[]} />);
    await act(async () => { await new Promise(r => setTimeout(r, 1500)); });
    expect(screen.getByText(/Marie Dupont/)).toBeInTheDocument();
    expect(screen.getByText(/P001/)).toBeInTheDocument();
  });

  test('ALRT-03: MODERE alert dismisses on click', async () => {
    mockFetchWith('**MODERE** : Interaction possible avec warfarine');
    render(<AlertSystem patient={mockPatient} currentDraft={mockDraft} prescriptions={[]} />);
    await act(async () => { await new Promise(r => setTimeout(r, 1500)); });
    const dismissBtn = screen.getByTitle('Ignorer cette alerte');
    fireEvent.click(dismissBtn);
    expect(screen.queryByText(/Interaction possible/)).not.toBeInTheDocument();
  });

  test('ALRT-03: FAIBLE alert dismisses on click', async () => {
    mockFetchWith('**FAIBLE** : Surveiller tension');
    render(<AlertSystem patient={mockPatient} currentDraft={mockDraft} prescriptions={[]} />);
    await act(async () => { await new Promise(r => setTimeout(r, 1500)); });
    const dismissBtn = screen.getByTitle('Ignorer cette alerte');
    fireEvent.click(dismissBtn);
    expect(screen.queryByText(/Surveiller tension/)).not.toBeInTheDocument();
  });

  test('ALRT-03: CRITIQUE alert does NOT dismiss — requires acknowledge button', async () => {
    mockFetchWith('**CRITIQUE** : Contre-indication absolue');
    render(<AlertSystem patient={mockPatient} currentDraft={mockDraft} prescriptions={[]} />);
    await act(async () => { await new Promise(r => setTimeout(r, 1500)); });
    expect(screen.queryByTitle('Ignorer cette alerte')).not.toBeInTheDocument();
    expect(screen.getByText(/pris connaissance/i)).toBeInTheDocument();
  });

  test('ALRT-03: CRITIQUE alert disappears after acknowledge click', async () => {
    mockFetchWith('**CRITIQUE** : Contre-indication absolue');
    render(<AlertSystem patient={mockPatient} currentDraft={mockDraft} prescriptions={[]} />);
    await act(async () => { await new Promise(r => setTimeout(r, 1500)); });
    fireEvent.click(screen.getByText(/pris connaissance/i));
    expect(screen.queryByText(/Contre-indication absolue/)).not.toBeInTheDocument();
  });

  test('UX-02: CRITIQUE alert has red left border', async () => {
    mockFetchWith('**CRITIQUE** : Allergie confirmée');
    const { container } = render(<AlertSystem patient={mockPatient} currentDraft={mockDraft} prescriptions={[]} />);
    await act(async () => { await new Promise(r => setTimeout(r, 1500)); });
    const banner = container.querySelector('[data-severity="CRITIQUE"]');
    expect(banner).toHaveStyle('border-left: 4px solid #EF4444');
  });

  test('UX-02: MODERE alert has orange left border', async () => {
    mockFetchWith('**MODERE** : Interaction possible');
    const { container } = render(<AlertSystem patient={mockPatient} currentDraft={mockDraft} prescriptions={[]} />);
    await act(async () => { await new Promise(r => setTimeout(r, 1500)); });
    const banner = container.querySelector('[data-severity="MODERE"]');
    expect(banner).toHaveStyle('border-left: 4px solid #F59E0B');
  });

  test('UX-02: FAIBLE alert has grey left border', async () => {
    mockFetchWith('**FAIBLE** : Information mineure');
    const { container } = render(<AlertSystem patient={mockPatient} currentDraft={mockDraft} prescriptions={[]} />);
    await act(async () => { await new Promise(r => setTimeout(r, 1500)); });
    const banner = container.querySelector('[data-severity="FAIBLE"]');
    expect(banner).toHaveStyle('border-left: 4px solid #6B7280');
  });
});
