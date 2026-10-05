import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';

const ink = [32, 38, 35];
const muted = [100, 108, 103];
const green = [45, 92, 57];
const line = [210, 216, 212];
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
export function createMortuaryReportPdf({ title, scope, sections, logo, generatedAt = new Date() }) {
  if (!logo) throw new Error('The cooperative logo is required for this report.');
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  doc.setProperties({ title, author: 'St. Vincent Parish Multi-Purpose Cooperative', subject: 'Mortuary Aid Fund Program' });
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  const right = width - margin;
  const date = new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila', day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  }).format(generatedAt);
  let y = 82;

  for (const section of sections) {
    if (y > height - 55) { doc.addPage(); y = 42; }
    if (section.title) {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...ink);
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
      headStyles: { fillColor: [239, 242, 239], textColor: ink, fontStyle: 'bold', fontSize: 8, lineWidth: { top: 0.3, bottom: 0.3 } },
      footStyles: { fillColor: [246, 248, 246], textColor: ink, fontStyle: 'bold', lineWidth: { top: 0.3, bottom: 0.3 } },
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
    const size = first ? 20 : 11;
    doc.addImage(logo, 'PNG', margin, first ? 13 : 12, size, size, 'svpmpc-logo', 'FAST');
    const x = margin + size + 5;
    doc.setFont('times', 'bold'); doc.setFontSize(first ? 14 : 11); doc.setTextColor(...ink);
    doc.text('St. Vincent Parish Multi-Purpose Cooperative', x, first ? 20 : 16);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...muted);
    doc.text('Mortuary Aid Fund Program', x, first ? 26 : 21);
    doc.setDrawColor(...green); doc.setLineWidth(0.5);
    doc.line(margin, first ? 38 : 32, right, first ? 38 : 32);
    if (first) {
      doc.setTextColor(...ink); doc.setFont('times', 'bold'); doc.setFontSize(22);
      doc.text(title, margin, 51);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...muted);
      doc.text(`Prepared ${date} PHT`, margin, 59);
      doc.text(doc.splitTextToSize(scope, width - margin * 2), margin, 65);
      doc.setFontSize(8); doc.text('Amounts in Philippine pesos (PHP).', margin, 75);
    } else {
      doc.setFontSize(8); doc.text(`${title} / continued`, margin, 28);
    }
    doc.setDrawColor(...line); doc.setLineWidth(0.2);
    doc.line(margin, height - 18, right, height - 18);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...muted);
    doc.text('SVPMPC | Mortuary Fund', margin, height - 12);
    doc.text(`Page ${page} of ${pageCount}`, right, height - 12, { align: 'right' });
  }
  return doc;
}
