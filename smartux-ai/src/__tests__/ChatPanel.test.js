import React from "react";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";

// Polyfill TextEncoder / TextDecoder for jsdom (Node provides them via `util`)
const { TextEncoder: NodeTextEncoder, TextDecoder: NodeTextDecoder } = require("util");
if (typeof global.TextEncoder === "undefined") {
  global.TextEncoder = NodeTextEncoder;
}
if (typeof global.TextDecoder === "undefined") {
  global.TextDecoder = NodeTextDecoder;
}
// Polyfill ReadableStream for jsdom (Node 16+ provides it via `stream/web`)
if (typeof global.ReadableStream === "undefined") {
  const { ReadableStream: NodeReadableStream } = require("stream/web");
  global.ReadableStream = NodeReadableStream;
}

// Plan 03-02: Use real ChatPanel component.
// buildDossierContext is mocked so tests don't depend on DB_PATIENTS data.
jest.mock("../SmartUX_AI_Bots", () => {
  const real = jest.requireActual("../SmartUX_AI_Bots");
  return {
    ...real,
    buildDossierContext: jest.fn(() => "Dossier patient mock"),
  };
});

import { ChatPanel, buildDossierContext } from "../SmartUX_AI_Bots";

// ─── mockStreamResponse helper ────────────────────────────────────────────────
// Creates a ReadableStream that emits `data: <token>\n\n` lines for each token
// then `data: [DONE]\n\n` to terminate. Assigns it to global.fetch.
function mockStreamResponse(tokens) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      for (const token of tokens) {
        controller.enqueue(encoder.encode(`data: ${token}\n\n`));
      }
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });
  global.fetch = jest.fn().mockResolvedValue({ ok: true, body: stream });
}

afterEach(() => {
  jest.clearAllMocks();
});

// ─── Test A (CHAT-03): Mock infrastructure ────────────────────────────────────
describe("CHAT-03: mockStreamResponse helper", () => {
  test("builds a valid ReadableStream that emits tokens then [DONE]", async () => {
    mockStreamResponse(["Bonjour", " monde"]);
    const response = await global.fetch("/api/claude-stream", {});
    expect(response.ok).toBe(true);
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    const chunks = [];
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      chunks.push(decoder.decode(value));
    }
    const joined = chunks.join("");
    expect(joined).toContain("data: Bonjour\n\n");
    expect(joined).toContain("data:  monde\n\n");
    expect(joined).toContain("data: [DONE]\n\n");
  });
});

// ─── Test B (CHAT-01): Send and stream ───────────────────────────────────────
// Renders ChatPanel with a patient prop, types a question, submits, and asserts
// streaming tokens accumulate in the message bubble.
// FAILS: ChatPanel stub returns null — "Aucun patient sélectionné" not found.
describe("CHAT-01: send message and stream response", () => {
  test("renders ChatPanel, types a question, submits, and streaming tokens accumulate", async () => {
    const patient = {
      patient_id: "P001",
      first_name: "Marie",
      last_name: "Dupont",
      age: 65,
      allergies: ["pénicilline"],
    };
    mockStreamResponse(["Bonjour", " Marie"]);
    render(<ChatPanel patient={patient} selectedPatientId="P001" />);
    const input = screen.getByRole("textbox");
    await userEvent.type(input, "Quelle est la posologie ?");
    const submitBtn = screen.getByRole("button", { name: /envoyer|send/i });
    await userEvent.click(submitBtn);
    await waitFor(() => {
      expect(screen.getByText(/Bonjour/)).toBeInTheDocument();
    });
  });
});

// ─── Test C (CHAT-01): Guard state — no patient ───────────────────────────────
// Renders ChatPanel with patient=null, asserts general chatbot mode:
// input is enabled and no patient identity bar is shown.
describe("CHAT-01: general chatbot — no patient selected", () => {
  test("shows general placeholder and enables input when patient is null", () => {
    render(<ChatPanel patient={null} selectedPatientId={null} />);
    expect(screen.queryByText(/Aucun patient sélectionné/i)).not.toBeInTheDocument();
    const input = screen.getByPlaceholderText(/Question générale ou clinique/i);
    expect(input).not.toBeDisabled();
  });
});

// ─── Test D (CHAT-02): Patient switch reset ──────────────────────────────────
// Renders ChatPanel, sends a message, then re-renders with a different
// selectedPatientId, asserts messages list is empty.
// FAILS: ChatPanel stub returns null.
describe("CHAT-02: switching patient clears message history", () => {
  test("messages list empties when selectedPatientId changes", async () => {
    const patientA = { patient_id: "P001", first_name: "Marie", last_name: "Dupont" };
    const patientB = { patient_id: "P002", first_name: "Jean", last_name: "Martin" };
    mockStreamResponse(["Réponse"]);
    const { rerender } = render(
      <ChatPanel patient={patientA} selectedPatientId="P001" />
    );
    // Send a message with patient A
    const input = screen.getByRole("textbox");
    await userEvent.type(input, "Question ?");
    const submitBtn = screen.getByRole("button", { name: /envoyer|send/i });
    await userEvent.click(submitBtn);
    await waitFor(() => {
      expect(screen.getByText(/Question/i)).toBeInTheDocument();
    });
    // Switch to patient B — history should clear
    rerender(<ChatPanel patient={patientB} selectedPatientId="P002" />);
    expect(screen.queryByText(/Question/i)).not.toBeInTheDocument();
  });
});

// ─── Test E (UX-01): Drawer style ────────────────────────────────────────────
// Renders the drawer wrapper with chatOpen=true and asserts position: fixed and
// right-side placement.
// FAILS: ChatPanel stub returns null — no wrapper element found.
describe("UX-01: drawer wrapper has correct positioning style", () => {
  test("container has position fixed and is aligned to the right", () => {
    render(<ChatPanel patient={null} selectedPatientId={null} chatOpen={true} />);
    // The drawer wrapper should exist and have fixed positioning on the right side
    const drawer = screen.getByTestId("chat-drawer");
    expect(drawer).toHaveStyle("position: fixed");
    // Right alignment: either right: 0 or right: 16px or similar non-left positioning
    const style = window.getComputedStyle(drawer);
    const rightVal = style.getPropertyValue("right");
    expect(rightVal).not.toBe("");
  });
});
