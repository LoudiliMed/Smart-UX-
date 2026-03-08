// ─────────────────────────────────────────────────────────────────────────────
//  Badge — small coloured label used throughout the UI
// ─────────────────────────────────────────────────────────────────────────────

import { ACCENT } from "../../constants/theme";

/**
 * @param {React.ReactNode} children
 * @param {string}  color - Hex colour (default: ACCENT)
 * @param {boolean} small - Smaller variant for inline use
 */
const Badge = ({ children, color = ACCENT, small = false }) => (
  <span style={{
    display:       "inline-block",
    padding:       small ? "2px 7px" : "3px 10px",
    borderRadius:  6,
    fontSize:      small ? 10 : 11,
    fontWeight:    600,
    letterSpacing: 0.3,
    background:    color + "18",
    color,
  }}>
    {children}
  </span>
);

export default Badge;
