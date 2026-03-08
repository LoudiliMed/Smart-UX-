// ─────────────────────────────────────────────────────────────────────────────
//  AutocompleteInput
//  Text input with:
//    • Autocomplete dropdown (fuzzy match against AUTOCOMPLETE_CORPUS)
//    • Voice recognition (Web Speech API — French)
//    • Command history navigation (↑ / ↓)
//  Used by NLPBot for the main prescription input bar.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef } from "react";
import { AUTOCOMPLETE_CORPUS } from "../../database";
import { ACCENT, MUTED, BORDER, RED, CARD } from "../../constants/theme";

/**
 * @param {string}   value
 * @param {Function} onChange   - (newValue: string) => void
 * @param {Function} onSubmit   - (value: string) => void
 * @param {boolean}  loading    - Disables submission while loading
 * @param {string}   placeholder
 */
function AutocompleteInput({ value, onChange, onSubmit, loading, placeholder }) {
  const [suggestions, setSuggestions] = useState([]);
  const [showSugg,    setShowSugg]    = useState(false);
  const [selIdx,      setSelIdx]      = useState(-1);
  const [listening,   setListening]   = useState(false);
  const [cmdHistory,  setCmdHistory]  = useState([]);
  const [histIdx,     setHistIdx]     = useState(-1);

  const inputRef       = useRef(null);
  const recognitionRef = useRef(null);

  // ── Voice recognition setup ─────────────────────────────────────────────
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    const rec         = new SpeechRecognition();
    rec.lang          = "fr-FR";
    rec.continuous    = false;
    rec.interimResults = false;
    rec.onresult = (e) => { onChange(e.results[0][0].transcript); setListening(false); };
    rec.onend    = () => setListening(false);
    recognitionRef.current = rec;
  }, [onChange]);

  const toggleVoice = () => {
    if (!recognitionRef.current) return;
    if (listening) { recognitionRef.current.stop(); setListening(false); }
    else           { recognitionRef.current.start(); setListening(true); }
  };

  // ── Autocomplete suggestions ────────────────────────────────────────────
  useEffect(() => {
    if (!value.trim()) { setSuggestions([]); return; }
    const lastWord = value.split(" ").slice(-1)[0].toLowerCase();
    if (lastWord.length < 2) { setSuggestions([]); return; }
    const matches = AUTOCOMPLETE_CORPUS.filter(s =>
      s.toLowerCase().includes(lastWord)
    ).slice(0, 6);
    setSuggestions(matches);
    setSelIdx(-1);
  }, [value]);

  const applySuggestion = (s) => {
    const words = value.split(" ");
    // Template suggestions (contain "[") replace the whole input
    if (s.includes("[")) { onChange(s); }
    else { words[words.length - 1] = s; onChange(words.join(" ")); }
    setSuggestions([]);
    setShowSugg(false);
    inputRef.current?.focus();
  };

  // ── Keyboard navigation ─────────────────────────────────────────────────
  const handleKeyDown = (e) => {
    // History navigation when input is empty
    if (!value.trim()) {
      if (e.key === "ArrowUp") {
        e.preventDefault();
        const ni = Math.min(histIdx + 1, cmdHistory.length - 1);
        setHistIdx(ni);
        if (cmdHistory[ni]) onChange(cmdHistory[ni]);
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        const ni = Math.max(histIdx - 1, -1);
        setHistIdx(ni);
        onChange(ni >= 0 ? cmdHistory[ni] : "");
        return;
      }
    }

    // Suggestion navigation
    if (showSugg && suggestions.length > 0) {
      if (e.key === "ArrowDown") { e.preventDefault(); setSelIdx(i => Math.min(i + 1, suggestions.length - 1)); return; }
      if (e.key === "ArrowUp")   { e.preventDefault(); setSelIdx(i => Math.max(i - 1, -1)); return; }
      if (e.key === "Tab") {
        e.preventDefault();
        applySuggestion(suggestions[selIdx >= 0 ? selIdx : 0]);
        return;
      }
    }

    if (e.key === "Enter" && !loading) {
      if (value.trim()) setCmdHistory(h => [value.trim(), ...h.slice(0, 19)]);
      setHistIdx(-1);
      setSuggestions([]);
      setShowSugg(false);
      onSubmit(value);
    }
    if (e.key === "Escape") { setSuggestions([]); setShowSugg(false); }
  };

  const hasSpeech = !!(window.SpeechRecognition || window.webkitSpeechRecognition);

  return (
    <div style={{ flex: 1, position: "relative" }}>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          ref={inputRef}
          value={value}
          onChange={e => { onChange(e.target.value); setShowSugg(true); setHistIdx(-1); }}
          onKeyDown={handleKeyDown}
          onFocus={() => setShowSugg(true)}
          onBlur={() => setTimeout(() => setShowSugg(false), 150)}
          placeholder={placeholder || "Ex : Prescrire 500mg de Doliprane per os 3x/jour pour le patient Dupont…"}
          style={{
            flex: 1, boxSizing: "border-box",
            padding: "12px 18px", borderRadius: 10,
            border: `1.5px solid ${showSugg && suggestions.length ? ACCENT : "#D1D5DB"}`,
            fontFamily: "'DM Sans', sans-serif", fontSize: 14, outline: "none",
            transition: "border-color .2s",
          }}
        />

        {/* Voice button — only shown if browser supports SpeechRecognition */}
        {hasSpeech && (
          <button
            onClick={toggleVoice}
            title={listening ? "Arrêter la dictée" : "Dicter"}
            style={{
              width: 44, height: 44, borderRadius: 10, border: "none", flexShrink: 0,
              background: listening ? RED : ACCENT + "15",
              color: listening ? "#fff" : ACCENT,
              cursor: "pointer", display: "grid", placeItems: "center",
              animation: listening ? "voicePulse 1s infinite" : "none",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
              <line x1="12" y1="19" x2="12" y2="23"/>
              <line x1="8"  y1="23" x2="16" y2="23"/>
            </svg>
          </button>
        )}
      </div>

      {/* Hint bar */}
      <div style={{ fontSize: 11, color: MUTED, marginTop: 3, paddingLeft: 4 }}>
        ↹ Tab pour compléter · ↑↓ historique · Entrée pour analyser
        {listening && <span style={{ color: RED, marginLeft: 8 }}>● Écoute en cours…</span>}
      </div>

      {/* Autocomplete dropdown */}
      {showSugg && suggestions.length > 0 && (
        <div style={{
          position: "absolute", top: "calc(100% - 4px)", left: 0, right: 0,
          background: CARD, border: "1.5px solid #E2E8F0", borderRadius: 10,
          boxShadow: "0 8px 24px rgba(0,0,0,.10)", zIndex: 100, overflow: "hidden",
        }}>
          {suggestions.map((s, i) => (
            <div
              key={i}
              onMouseDown={() => applySuggestion(s)}
              style={{
                padding: "9px 16px", fontSize: 13, cursor: "pointer",
                fontFamily: "'DM Sans', sans-serif",
                background:   i === selIdx ? ACCENT + "12" : "transparent",
                borderBottom: i < suggestions.length - 1 ? "1px solid #F1F5F9" : "none",
                color:        s.includes("[") ? MUTED : "#1A1A2E",
                fontStyle:    s.includes("[") ? "italic" : "normal",
              }}
            >
              {s}
            </div>
          ))}
        </div>
      )}

      <style>{`@keyframes voicePulse{0%,100%{opacity:1;box-shadow:0 0 0 0 rgba(239,68,68,.4)}50%{opacity:.7;box-shadow:0 0 0 6px rgba(239,68,68,0)}}`}</style>
    </div>
  );
}

export default AutocompleteInput;
