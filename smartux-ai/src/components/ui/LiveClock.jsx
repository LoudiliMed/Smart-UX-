// ─────────────────────────────────────────────────────────────────────────────
//  LiveClock — ticking HH:MM clock displayed in the header bar
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from "react";

const DAYS   = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
const MONTHS = ["Janv", "Fev", "Mars", "Avr", "Mai", "Juin", "Juil", "Aout", "Sept", "Oct", "Nov", "Dec"];

function LiveClock() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, color: "#fff" }}>
      <div style={{ textAlign: "right", lineHeight: 1.3 }}>
        <div style={{ fontSize: 11, opacity: 0.6, fontWeight: 500 }}>
          {DAYS[now.getDay()]} {now.getDate()} {MONTHS[now.getMonth()]}
        </div>
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "'Space Mono', monospace", letterSpacing: 1 }}>
        {now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
      </div>
    </div>
  );
}

export default LiveClock;
