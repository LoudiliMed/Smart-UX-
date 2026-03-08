// ─────────────────────────────────────────────────────────────────────────────
//  Btn — generic button with variant system
//  Variants: "primary" | "accent" | "ghost" | "green" | "red"
// ─────────────────────────────────────────────────────────────────────────────

import { ACCENT, ACCENT2, GREEN, RED } from "../../constants/theme";

/**
 * @param {React.ReactNode} children
 * @param {Function}  onClick
 * @param {boolean}   disabled
 * @param {"primary"|"accent"|"ghost"|"green"|"red"} variant
 * @param {object}    style - Extra inline styles (merged last)
 */
const Btn = ({ children, onClick, disabled, variant = "primary", style: s }) => {
  const base = {
    padding:     "10px 22px",
    borderRadius: 10,
    border:      "none",
    fontFamily:  "'DM Sans', sans-serif",
    fontWeight:  600,
    fontSize:    14,
    cursor:      disabled ? "not-allowed" : "pointer",
    transition:  "all .2s",
    opacity:     disabled ? 0.5 : 1,
  };

  const variants = {
    primary: { background: ACCENT,  color: "#fff" },
    accent:  { background: ACCENT2, color: "#fff" },
    ghost:   { background: "transparent", color: ACCENT, border: `1.5px solid ${ACCENT}` },
    green:   { background: GREEN,   color: "#fff" },
    red:     { background: RED,     color: "#fff" },
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{ ...base, ...variants[variant], ...s }}
    >
      {children}
    </button>
  );
};

export default Btn;
