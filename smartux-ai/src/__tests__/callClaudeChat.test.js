/**
 * callClaudeChat.test.js
 *
 * Unit tests for the callClaudeChat wrapper and SAFE-02 disclaimer enforcement.
 *
 * Tests cover:
 * 1. Response starts with the disclaimer text
 * 2. Disclaimer is appended even when API response omits it (failsafe layer)
 * 3. Throws when fetch returns a non-ok status (500)
 * 4. History messages are passed in correct order (before user message)
 * 5. systemPrompt is passed as first message with role "system"
 * 6. Called without history argument — defaults to [] (no extra messages)
 */

import { callClaudeChat } from "../SmartUX_AI_Bots";

// Mock global fetch for all tests
global.fetch = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
});

// Helper: mock a successful Claude response
function mockClaudeResponse(text) {
  global.fetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ content: [{ text }] }),
  });
}

// Helper: mock a non-ok response
function mockClaudeError(status) {
  global.fetch.mockResolvedValueOnce({
    ok: false,
    status,
    json: async () => ({}),
  });
}

const DISCLAIMER = "Analyse assistée par IA — vérification clinique recommandée";

// Test 1: Response from callClaudeChat() starts with the disclaimer text
test("Test 1: response starts with disclaimer when Claude includes it", async () => {
  const apiText = `${DISCLAIMER}\n\nAucune interaction identifiée.`;
  mockClaudeResponse(apiText);

  const result = await callClaudeChat("system prompt", "user message");

  expect(result).toContain(DISCLAIMER);
  expect(result.indexOf(DISCLAIMER)).toBe(0);
});

// Test 2: Disclaimer is present even when API returns a response without it (wrapper appends it)
test("Test 2: wrapper prepends disclaimer when Claude omits it", async () => {
  const apiText = "CRITIQUE : conflit allergie détecté.";
  mockClaudeResponse(apiText);

  const result = await callClaudeChat("system prompt", "user message");

  expect(result).toContain(DISCLAIMER);
  expect(result).toContain(apiText);
  // Wrapper should have prepended it
  expect(result.startsWith(DISCLAIMER)).toBe(true);
});

// Test 3: Throws when fetch returns a non-ok status (500)
test("Test 3: throws Error when fetch returns non-ok status", async () => {
  mockClaudeError(500);

  await expect(
    callClaudeChat("system prompt", "user message")
  ).rejects.toThrow("Claude API error: 500");
});

// Test 4: Passes history messages in correct order (history before user message)
test("Test 4: history messages are placed before user message in the request body", async () => {
  const apiText = `${DISCLAIMER}\n\nRéponse test.`;
  mockClaudeResponse(apiText);

  const history = [
    { role: "user", content: "Première question" },
    { role: "assistant", content: "Première réponse" },
  ];

  await callClaudeChat("system prompt", "nouvelle question", history);

  const fetchCall = global.fetch.mock.calls[0];
  const body = JSON.parse(fetchCall[1].body);
  const messages = body.messages;

  // Find history message positions and user message position
  const firstHistoryIdx = messages.findIndex(
    (m) => m.content === "Première question"
  );
  const secondHistoryIdx = messages.findIndex(
    (m) => m.content === "Première réponse"
  );
  const userMsgIdx = messages.findIndex((m) => m.content === "nouvelle question");

  expect(firstHistoryIdx).toBeGreaterThanOrEqual(0);
  expect(secondHistoryIdx).toBeGreaterThanOrEqual(0);
  expect(userMsgIdx).toBeGreaterThan(secondHistoryIdx);
});

// Test 5: Passes systemPrompt as first message with role "system"
test("Test 5: systemPrompt is passed as first message with role system", async () => {
  const apiText = `${DISCLAIMER}\n\nRéponse.`;
  mockClaudeResponse(apiText);

  const systemPrompt = "Mon system prompt de test";

  await callClaudeChat(systemPrompt, "user message");

  const fetchCall = global.fetch.mock.calls[0];
  const body = JSON.parse(fetchCall[1].body);
  const messages = body.messages;

  expect(messages[0].role).toBe("system");
  expect(messages[0].content).toBe(systemPrompt);
});

// Test 6: Called without history argument — defaults to [] (no extra messages in body beyond system + user)
test("Test 6: called without history defaults to empty array — only system + user messages sent", async () => {
  const apiText = `${DISCLAIMER}\n\nRéponse sans historique.`;
  mockClaudeResponse(apiText);

  await callClaudeChat("system prompt", "user message");

  const fetchCall = global.fetch.mock.calls[0];
  const body = JSON.parse(fetchCall[1].body);
  const messages = body.messages;

  // Should have exactly 2 messages: system + user (no history)
  expect(messages).toHaveLength(2);
  expect(messages[0].role).toBe("system");
  expect(messages[1].role).toBe("user");
});
