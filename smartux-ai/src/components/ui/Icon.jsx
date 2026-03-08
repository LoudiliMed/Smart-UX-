// ─────────────────────────────────────────────────────────────────────────────
//  Icon — professional 2-D SVG icon set (no emoji, no external library)
//
//  Supported types:
//    chat | shield | file | folder | eye | clipboard | activity |
//    flask | image | settings | clock | user | pill
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {"chat"|"shield"|"file"|"folder"|"eye"|"clipboard"|"activity"|"flask"|"image"|"settings"|"clock"|"user"|"pill"} type
 * @param {number} size  - Width & height in px (default 15)
 * @param {string} color - Stroke colour (default "currentColor")
 */
const Icon = ({ type, size = 15, color = "currentColor" }) => {
  const props = {
    width:          size,
    height:         size,
    viewBox:        "0 0 24 24",
    fill:           "none",
    stroke:         color,
    strokeWidth:    "2",
    strokeLinecap:  "round",
    strokeLinejoin: "round",
  };

  switch (type) {
    case "chat":
      return (
        <svg {...props}>
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          <circle cx="9"  cy="10" r="1" fill={color} stroke="none"/>
          <circle cx="12" cy="10" r="1" fill={color} stroke="none"/>
          <circle cx="15" cy="10" r="1" fill={color} stroke="none"/>
        </svg>
      );
    case "shield":
      return (
        <svg {...props}>
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
        </svg>
      );
    case "file":
      return (
        <svg {...props}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="16" y1="13" x2="8" y2="13"/>
          <line x1="16" y1="17" x2="8" y2="17"/>
        </svg>
      );
    case "folder":
      return (
        <svg {...props}>
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
        </svg>
      );
    case "eye":
      return (
        <svg {...props}>
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>
      );
    case "clipboard":
      return (
        <svg {...props}>
          <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
          <rect x="8" y="2" width="8" height="4" rx="1"/>
        </svg>
      );
    case "activity":
      return (
        <svg {...props}>
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
        </svg>
      );
    case "flask":
      return (
        <svg {...props}>
          <path d="M9 3h6v7l5 8a2 2 0 0 1-1.7 3H5.7a2 2 0 0 1-1.7-3l5-8V3z"/>
          <line x1="9" y1="3" x2="15" y2="3"/>
        </svg>
      );
    case "image":
      return (
        <svg {...props}>
          <rect x="3" y="3" width="18" height="18" rx="2"/>
          <circle cx="8.5" cy="8.5" r="1.5"/>
          <polyline points="21 15 16 10 5 21"/>
        </svg>
      );
    case "settings":
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="3"/>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.32 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
        </svg>
      );
    case "clock":
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="10"/>
          <polyline points="12 6 12 12 16 14"/>
        </svg>
      );
    case "user":
      return (
        <svg {...props}>
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
          <circle cx="12" cy="7" r="4"/>
        </svg>
      );
    case "pill":
      return (
        <svg {...props}>
          <path d="M10.5 1.5L3 9a4.24 4.24 0 0 0 6 6l7.5-7.5a4.24 4.24 0 0 0-6-6z"/>
          <line x1="8.5" y1="8.5" x2="15.5" y2="1.5"/>
        </svg>
      );
    default:
      return null;
  }
};

export default Icon;
