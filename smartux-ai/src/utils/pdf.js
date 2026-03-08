// ─────────────────────────────────────────────────────────────────────────────
//  PDF EXPORT  (via jsPDF CDN — loaded lazily on first call)
//  Generates a SILLAGE medical order PDF and triggers a browser download.
// ─────────────────────────────────────────────────────────────────────────────

export function exportPDF(rx) {
  const load = () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const now = new Date().toLocaleString("fr-FR");

    // ── Header banner ───────────────────────────────────────────────────────
    doc.setFillColor(15, 76, 117);
    doc.rect(0, 0, 210, 30, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("SILLAGE — Acte & Ordre Médical", 14, 14);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`Généré le ${now}`, 14, 22);

    // ── Action title ────────────────────────────────────────────────────────
    doc.setTextColor(30, 30, 46);
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text(`Action : ${(rx.action || "prescrire").toUpperCase()}`, 14, 42);

    // ── Allergy alert (red banner) ──────────────────────────────────────────
    if (rx.allergyAlert) {
      doc.setFillColor(239, 68, 68);
      doc.rect(14, 46, 182, 10, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(9);
      doc.text(rx.allergyAlert, 18, 53);
      doc.setTextColor(30, 30, 46);
    }

    // ── Field table ─────────────────────────────────────────────────────────
    const fields = [
      ["Patient",          rx.patient_name_free],
      ["Médicament",       rx.drug_name_free],
      ["Dosage",           rx.dosage],
      ["Forme",            rx.form],
      ["Voie",             rx.route],
      ["Fréquence",        rx.frequency],
      ["Indication",       rx.indication],
      ["Service",          rx.service],
      ["Chambre",          rx.chambre],
      ["Priorité",         rx.priorite],
      ["Allergie",         rx.allergie_signalee],
      ["Examen",           rx.examen],
      ["Notes",            rx.notes],
      ["Confiance NLP",    rx.nlp_confidence],
      ["Phrase originale", rx.nlp_raw_text],
    ].filter(([, v]) => v);

    let y = rx.allergyAlert ? 65 : 52;
    doc.setFontSize(10);
    fields.forEach(([label, val]) => {
      doc.setFont("helvetica", "bold");
      doc.setTextColor(107, 114, 128);
      doc.text(`${label} :`, 14, y);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(30, 30, 46);
      const lines = doc.splitTextToSize(String(val), 130);
      doc.text(lines, 60, y);
      y += lines.length * 7;
      if (y > 270) { doc.addPage(); y = 20; }
    });

    // ── Footer ──────────────────────────────────────────────────────────────
    doc.setFillColor(245, 243, 238);
    doc.rect(0, 280, 210, 17, "F");
    doc.setFontSize(8);
    doc.setTextColor(107, 114, 128);
    doc.text(
      "Document généré automatiquement par SmartUX-AI · Projet CRIStAL × Centrale Lille",
      14, 289
    );
    doc.text(`ID : ${rx.prescription_id}`, 170, 289);

    doc.save(
      `SILLAGE_${rx.action || "acte"}_${rx.patient_name_free || "patient"}_${Date.now()}.pdf`
    );
  };

  // Load jsPDF from CDN if not already available
  if (window.jspdf) { load(); return; }
  const script = document.createElement("script");
  script.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
  script.onload = load;
  document.head.appendChild(script);
}
