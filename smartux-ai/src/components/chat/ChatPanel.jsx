// ─────────────────────────────────────────────────────────────────────────────
//  ChatPanel  (CHAT-01, CHAT-02, UX-01)
//
//  Full-screen SSE streaming chat panel — "Doctor AI" assistant.
//  Exported as a named component that can be used inline or in a fixed drawer.
//
//  Two internal sub-components:
//    • ChatPanel      — stateful wrapper (handles SSE stream + reducer)
//    • ChatPanelInner — pure presentation (header, message list, input form)
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useReducer, useRef, useCallback, useEffect } from "react";
import { ACCENT, ACCENT2, MUTED, RED, BORDER, CARD } from "../../constants/theme";
import { buildAllPatientsContext, buildChatSystemPrompt } from "../../ai/prompts";

const API_STREAM = "http://localhost:3001/api/claude-stream";

// ── Chat state reducer ────────────────────────────────────────────────────────

const chatInitialState = { messages: [], streamingText: "", isLoading: false };

function chatReducer(state, action) {
  switch (action.type) {
    case "SEND":
      return {
        ...state,
        messages: [...state.messages, { role: "user", text: action.text }],
        isLoading: true,
        streamingText: "",
      };
    case "TOKEN":
      return { ...state, streamingText: state.streamingText + action.token };
    case "DONE":
      return {
        ...state,
        messages: [...state.messages, { role: "assistant", text: state.streamingText }],
        streamingText: "",
        isLoading: false,
      };
    case "ERROR":
      return {
        ...state,
        messages: [
          ...state.messages,
          {
            role: "assistant",
            text: "Impossible de contacter le serveur. Vérifiez que le serveur est bien démarré (`node server.js`).",
            isError: true,
          },
        ],
        streamingText: "",
        isLoading: false,
      };
    case "RESET":
      return chatInitialState;
    default:
      return state;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  ChatPanel — stateful container
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {object}   patient           - Currently selected patient (or null)
 * @param {number}   selectedPatientId - Patient ID (used to detect switches)
 * @param {Array}    prescriptions     - All prescriptions (for AI context)
 * @param {Function} onClose           - Callback to close the drawer
 * @param {boolean}  chatOpen          - When passed, wraps content in a fixed drawer
 * @param {object}   user              - Authenticated staff record
 */
export function ChatPanel({ patient, selectedPatientId, prescriptions = [], onClose, chatOpen, user }) {
  const [state, dispatch] = useReducer(chatReducer, chatInitialState);
  const [input, setInput] = useState("");
  const bottomRef         = useRef(null);

  // CHAT-02: reset conversation when switching patients
  useEffect(() => { dispatch({ type: "RESET" }); }, [selectedPatientId]);

  // Auto-scroll to newest message
  useEffect(() => {
    if (bottomRef.current && typeof bottomRef.current.scrollIntoView === "function") {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [state.messages, state.streamingText]);

  // ── SSE streaming send ──────────────────────────────────────────────────
  const sendMessage = useCallback(async (text) => {
    if (!text.trim() || state.isLoading) return;
    dispatch({ type: "SEND", text });
    setInput("");

    const allPatientsCtx = buildAllPatientsContext(prescriptions);
    const focusLine = patient
      ? `Le personnel a actuellement sélectionné le patient : H-${patient.patient_id}.`
      : "Aucun patient sélectionné — réponds aux questions sur n'importe quel patient de la base.";

    const systemPrompt =
      `${buildChatSystemPrompt(user)}\n\n=== BASE DE DONNÉES PATIENTS ===\n${allPatientsCtx}\n\n${focusLine}`;

    const historyMessages = state.messages.map(m => ({
      role:    m.role === "user" ? "user" : "assistant",
      content: m.text,
    }));

    try {
      const res = await fetch(API_STREAM, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            { role: "system", content: systemPrompt },
            ...historyMessages,
            { role: "user", content: text },
          ],
        }),
      });

      if (!res.ok) { dispatch({ type: "ERROR" }); return; }

      const reader     = res.body.getReader();
      const decoder    = new TextDecoder();
      let lineBuffer   = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        lineBuffer += decoder.decode(value, { stream: true });
        const lines = lineBuffer.split("\n");
        lineBuffer  = lines.pop(); // retain incomplete trailing line
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6);
          if (payload.trim() === "[DONE]")    { dispatch({ type: "DONE" });  return; }
          if (payload.trim().startsWith("[ERROR]")) { dispatch({ type: "ERROR" }); return; }
          dispatch({ type: "TOKEN", token: payload });
        }
      }
      dispatch({ type: "DONE" });
    } catch {
      dispatch({ type: "ERROR" });
    }
  }, [patient, prescriptions, user, state.messages, state.isLoading]);

  // UX-01: when `chatOpen` prop is present, wrap in fixed side drawer
  if (chatOpen !== undefined) {
    return (
      <div
        data-testid="chat-drawer"
        style={{
          position: "fixed", top: 0, right: 0,
          width: 380, height: "100vh",
          background: CARD, borderLeft: `1px solid ${BORDER}`,
          boxShadow: "-4px 0 24px rgba(0,0,0,.12)",
          display: "flex", flexDirection: "column",
          zIndex: 200, animation: "slideInRight .22s ease both",
        }}
      >
        <ChatPanelInner
          patient={patient} state={state}
          input={input} setInput={setInput}
          bottomRef={bottomRef} sendMessage={sendMessage} onClose={onClose}
        />
      </div>
    );
  }

  return (
    <ChatPanelInner
      patient={patient} state={state}
      input={input} setInput={setInput}
      bottomRef={bottomRef} sendMessage={sendMessage} onClose={onClose}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  ChatPanelInner — pure presentation
// ─────────────────────────────────────────────────────────────────────────────

function ChatPanelInner({ patient, state, input, setInput, bottomRef, sendMessage, onClose }) {
  const [listening,    setListening]    = useState(false);
  const recognitionRef = useRef(null);
  const hasSpeech      = !!(window.SpeechRecognition || window.webkitSpeechRecognition);

  // Keep sendMessage ref stable for the speech callback
  const sendRef = useRef(sendMessage);
  useEffect(() => { sendRef.current = sendMessage; }, [sendMessage]);

  // ── Voice recognition setup ─────────────────────────────────────────────
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    const rec          = new SpeechRecognition();
    rec.lang           = "fr-FR";
    rec.continuous     = false;
    rec.interimResults = false;
    rec.onresult = (e) => {
      const t = e.results[0][0].transcript;
      setInput(t);
      setListening(false);
      sendRef.current(t);
    };
    rec.onend = () => setListening(false);
    recognitionRef.current = rec;
  }, [setInput]);

  const toggleVoice = () => {
    if (!recognitionRef.current) return;
    if (listening) { recognitionRef.current.stop(); setListening(false); }
    else           { recognitionRef.current.start(); setListening(true); }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>

      {/* Header */}
      <div style={{
        padding: "14px 18px", borderBottom: `1px solid ${BORDER}`,
        display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0,
      }}>
        <span style={{ fontWeight: 700, fontSize: 14, color: ACCENT }}>Doctor AI</span>
        <button
          onClick={onClose}
          style={{ background: "none", border: "none", cursor: "pointer", color: MUTED, fontSize: 18, lineHeight: 1, padding: "0 4px" }}
          title="Fermer"
        >✕</button>
      </div>

      {/* Patient identity bar */}
      {patient && (
        <div style={{
          padding: "8px 18px", background: "#EEF4F9",
          borderBottom: `1px solid ${BORDER}`,
          fontSize: 12, color: ACCENT, fontWeight: 600, flexShrink: 0,
        }}>
          {patient.first_name} {patient.last_name}
        </div>
      )}

      {/* Message list */}
      <div style={{
        flex: 1, overflowY: "auto", padding: "16px 18px",
        display: "flex", flexDirection: "column", gap: 12,
      }}>
        {state.messages.map((m, i) => (
          <div key={i} style={{ alignSelf: m.role === "user" ? "flex-end" : "flex-start", maxWidth: "88%" }}>
            <div style={{
              background:   m.isError ? "#FEF2F2" : m.role === "user" ? ACCENT : "#F0F4F8",
              color:        m.isError ? RED : m.role === "user" ? "#fff" : "#1A1A2E",
              borderRadius: m.role === "user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
              padding:      "10px 14px", fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap",
              border:       m.isError ? `1px solid ${RED}` : "none",
            }}>
              {m.text}
            </div>
          </div>
        ))}

        {/* Streaming bubble */}
        {state.streamingText && (
          <div style={{ alignSelf: "flex-start", maxWidth: "88%" }}>
            <div style={{
              background: "#F0F4F8", color: "#1A1A2E",
              borderRadius: "14px 14px 14px 4px",
              padding: "10px 14px", fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap",
            }}>
              {state.streamingText}
              <span style={{
                display: "inline-block", width: 6, height: 6, borderRadius: "50%",
                background: ACCENT, marginLeft: 4, animation: "voicePulse 1s infinite",
              }} />
            </div>
          </div>
        )}

        {/* Loading dots */}
        {state.isLoading && !state.streamingText && (
          <div style={{ alignSelf: "flex-start" }}>
            <div style={{
              background: "#F0F4F8", borderRadius: "14px 14px 14px 4px",
              padding: "10px 16px", display: "flex", gap: 5, alignItems: "center",
            }}>
              {[0, 1, 2].map(i => (
                <span key={i} style={{
                  display: "inline-block", width: 7, height: 7, borderRadius: "50%",
                  background: MUTED, animation: `voicePulse 1.2s ${i * 0.2}s infinite`,
                }} />
              ))}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input form */}
      <form
        onSubmit={e => { e.preventDefault(); sendMessage(input); }}
        style={{ padding: "12px 18px", borderTop: `1px solid ${BORDER}`, display: "flex", gap: 8, flexShrink: 0 }}
      >
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder={patient ? "Question clinique..." : "Question générale ou clinique..."}
          disabled={state.isLoading}
          style={{
            flex: 1, padding: "9px 12px", borderRadius: 8,
            border: `1px solid ${listening ? RED : BORDER}`,
            fontSize: 13, fontFamily: "'DM Sans', sans-serif",
            outline: "none", transition: "border-color .2s",
          }}
        />

        {/* Voice button */}
        {hasSpeech && (
          <button
            type="button"
            onClick={toggleVoice}
            title={listening ? "Arrêter la dictée" : "Dicter"}
            style={{
              width: 38, height: 38, borderRadius: 8, border: "none", flexShrink: 0,
              background: listening ? RED : ACCENT + "15",
              color:      listening ? "#fff" : ACCENT,
              cursor: "pointer", display: "grid", placeItems: "center",
              animation: listening ? "voicePulse 1s infinite" : "none",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
              <line x1="12" y1="19" x2="12" y2="23"/>
              <line x1="8"  y1="23" x2="16" y2="23"/>
            </svg>
          </button>
        )}

        <button
          type="submit"
          disabled={!input.trim() || state.isLoading}
          style={{
            padding: "9px 16px", borderRadius: 8, border: "none",
            background: ACCENT, color: "#fff",
            fontSize: 13, fontWeight: 600, cursor: "pointer",
            fontFamily: "'DM Sans', sans-serif",
            opacity: (!input.trim() || state.isLoading) ? 0.5 : 1,
          }}
        >
          Envoyer
        </button>
      </form>

      <style>{`@keyframes voicePulse{0%,100%{opacity:1;box-shadow:0 0 0 0 rgba(239,68,68,.4)}50%{opacity:.7;box-shadow:0 0 0 6px rgba(239,68,68,0)}}`}</style>
    </div>
  );
}
