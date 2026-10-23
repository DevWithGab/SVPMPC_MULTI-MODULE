// Use the same letterhead in ledger and report PDFs, in either pt or mm.
export const drawCooperativeLetterhead = (doc, logo, left, right) => {
  const unit = doc.internal.scaleFactor;
  if (logo) {
    // The cooperative logo is square; keep its proportions in the letterhead.
    try { doc.addImage(logo, 'PNG', left + 4 / unit, 39 / unit, 52 / unit, 52 / unit, 'cooperative-logo', 'FAST'); } catch { /* The document remains readable if the image cannot load. */ }
  }
  const center = left + 62 / unit + (right - left - 62 / unit) / 2;
  doc.setTextColor(0, 0, 0); doc.setFont('times', 'bold'); doc.setFontSize(20);
  doc.text('SAINT VINCENT PARISH', center, 51 / unit, { align: 'center' });
  doc.setFontSize(18); doc.text('MULTI-PURPOSE COOPERATIVE', center, 72 / unit, { align: 'center' });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(12);
  doc.text('Dupax del Sur, Nueva Vizcaya, Philippines', center, 90 / unit, { align: 'center' });
};
