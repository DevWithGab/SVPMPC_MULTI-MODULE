import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';

const ink = [30, 30, 30];
const muted = [100, 100, 100];
const line = [210, 210, 210];
const margin = 17;

export const reportAmount = value => Number(value || 0).toLocaleString('en-PH', {
  minimumFractionDigits: 2, maximumFractionDigits: 2,
});

export function negativeBalanceMembers(members) {
  return members.map(member => ({
    id: member.id ?? member.memberId,
    name: member.name || member.memberName || 'Unnamed member',
    barangay: member.barangay || 'Not recorded',
    status: member.status || 'Not recorded',
    balance: Number(member.currentBalance ?? member.balance ?? 0),
  })).filter(member => Number.isFinite(member.balance) && member.balance < 0)
    .sort((a, b) => a.balance - b.balance || String(a.id).localeCompare(String(b.id)));
}

let logoPromise;
export function loadReportLogo() {
  if (!logoPromise) {
    logoPromise = fetch('/SVPMPC-LOGO(MAIN).png').then(async response => {
      if (!response.ok) throw new Error('Unable to load the cooperative logo. Please retry the export.');
      return new Uint8Array(await response.arrayBuffer());
    }).catch(error => { logoPromise = undefined; throw error; });
  }
  return logoPromise;
}

// Text and vector tables stay selectable and crisp when printed. PHP is used
// explicitly because the built-in PDF fonts do not contain the peso glyph.
export function createMortuaryReportPdf({ title, scope, sections, logo, generatedAt = new Date(), program = 'Mortuary Aid Fund Program', metadataLabel = 'CURRENCY', metadataValue = 'Philippine pesos (PHP)' }) {
  if (!logo) throw new Error('The cooperative logo is required for this report.');
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  doc.setProperties({ title, author: 'St. Vincent Parish Multi-Purpose Cooperative', subject: program });
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  const right = width - margin;
  const date = new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila', day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  }).format(generatedAt);
  // Measure the front matter so longer titles and scope notes cannot collide
  // with the first table. Continuation pages use a compact letterhead.
  doc.setFont('times', 'bold'); doc.setFontSize(23);
  const titleLines = doc.splitTextToSize(title, right - margin);
  const titleBottom = 49 + (titleLines.length - 1) * 9;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
  const scopeLines = doc.splitTextToSize(scope || 'All recorded transactions.', right - margin);
  const scopeY = titleBottom + 9;
  const metaY = scopeY + scopeLines.length * 4.5 + 7;
  let y = metaY + 17;

  for (const section of sections) {
    if (y > height - 60) { doc.addPage(); y = 42; }
    if (section.title) {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.setTextColor(...ink);
      doc.text(section.title, margin, y);
      y += 5;
    }
    const columns = Object.fromEntries((section.widths || []).map((cellWidth, index) => [index, { cellWidth }]));
    for (const index of section.numberColumns || []) columns[index] = { ...columns[index], halign: 'right' };
    autoTable(doc, {
      startY: y, margin: { top: 39, bottom: 23, left: margin, right: margin },
      head: [section.head],
      body: section.body.length ? section.body : [[{ content: section.emptyMessage || 'No records available.', colSpan: section.head.length, styles: { halign: 'center', textColor: muted, cellPadding: 8 } }]],
      foot: section.total ? [section.total] : undefined,
      showFoot: 'lastPage', theme: 'plain', rowPageBreak: 'avoid',
      styles: { font: 'helvetica', fontSize: 8.5, textColor: ink, cellPadding: { top: 3.2, bottom: 3.2, left: 2.5, right: 2.5 }, overflow: 'linebreak', lineColor: line, lineWidth: { bottom: 0.15 }, valign: 'middle' },
      headStyles: { fillColor: [240, 240, 240], textColor: ink, fontStyle: 'bold', fontSize: 8, lineWidth: { top: 0.3, bottom: 0.3 } },
      footStyles: { fillColor: [247, 247, 247], textColor: ink, fontStyle: 'bold', lineWidth: { top: 0.4, bottom: 0.3 } },
      columnStyles: columns,
      didParseCell: data => {
        if ((section.numberColumns || []).includes(data.column.index)) data.cell.styles.halign = 'right';
      },
    });
    y = doc.lastAutoTable.finalY + 12;
  }

  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page++) {
    doc.setPage(page);
    const first = page === 1;
    const size = first ? 21 : 11;
    const image = doc.getImageProperties(logo);
    const scale = Math.min(size / image.width, size / image.height);
    doc.addImage(logo, 'PNG', margin + (size - image.width * scale) / 2, first ? 12 : 12,
      image.width * scale, image.height * scale, 'svpmpc-logo', 'FAST');
    const x = margin + size + 5;
    doc.setFont('times', 'bold'); doc.setFontSize(first ? 14 : 11); doc.setTextColor(...ink);
    doc.text('St. Vincent Parish Multi-Purpose Cooperative', x, first ? 20 : 16);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...muted);
    doc.text(program, x, first ? 26 : 21);
    doc.setDrawColor(...ink); doc.setLineWidth(0.4);
    doc.line(margin, first ? 36 : 32, right, first ? 36 : 32);
    if (first) {
      doc.setTextColor(...ink); doc.setFont('times', 'bold'); doc.setFontSize(23);
      doc.text(titleLines, margin, 49, { lineHeightFactor: 1.11 });
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...muted);
      doc.text(scopeLines, margin, scopeY, { lineHeightFactor: 1.4 });
      doc.setFontSize(7); doc.setFont('helvetica', 'bold');
      doc.text('GENERATED', margin, metaY);
      doc.text(metadataLabel, right, metaY, { align: 'right' });
      doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(...ink);
      doc.text(`${date} PHT`, margin, metaY + 5);
      doc.text(metadataValue, right, metaY + 5, { align: 'right' });
    } else {
      doc.setFontSize(8); doc.text(doc.splitTextToSize(`${title} / continued`, right - margin)[0], margin, 28);
    }
    doc.setDrawColor(...line); doc.setLineWidth(0.2);
    doc.line(margin, height - 18, right, height - 18);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...muted);
    doc.text(`SVPMPC  |  ${program}`, margin, height - 12);
    doc.text(`Page ${page} of ${pageCount}`, right, height - 12, { align: 'right' });
  }
  return doc;
}
