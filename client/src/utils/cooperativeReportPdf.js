import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import { drawCooperativeLetterhead } from './cooperativePdfLetterhead.js';

// Mortuary reports follow the cooperative's ledger form: the same letterhead,
// centered report title, black ruled tables, and numbered continuation pages.
export const createCooperativeReportPdf = ({ title, scope, sections, logo, generatedAt, metadataLabel, metadataValue }) => {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  doc.setProperties({ title, author: 'St. Vincent Parish Multi-Purpose Cooperative', subject: 'Mutual Assistance Fund' });
  const left = 17;
  const right = doc.internal.pageSize.getWidth() - left;
  const height = doc.internal.pageSize.getHeight();
  const width = right - left;
  const date = new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila', day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  }).format(generatedAt);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(14);
  const titleLines = doc.splitTextToSize(title, width);
  const titleY = 42;
  const scopeY = titleY + (titleLines.length - 1) * 6 + 9;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
  const scopeLines = doc.splitTextToSize(scope || 'All recorded transactions.', width);
  const dateY = scopeY + scopeLines.length * 4.5 + 3;
  const metadataLines = doc.splitTextToSize(`${metadataLabel}: ${metadataValue}`, width);
  const metadataY = dateY + 5;
  const tableTop = metadataY + metadataLines.length * 4.5 + 6;
  let y = tableTop;
  for (const section of sections) {
    if (y > height - 45) { doc.addPage(); y = tableTop; }
    const hasTitle = !!section.title;
    if (hasTitle) {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(0, 0, 0);
      doc.text(section.title, left, y); y += 6;
    }
    const columnStyles = Object.fromEntries((section.widths || []).map((cellWidth, index) => [index, { cellWidth }]));
    for (const index of section.numberColumns || []) columnStyles[index] = { ...columnStyles[index], halign: 'right' };
    autoTable(doc, {
      startY: y, margin: { top: tableTop + (hasTitle ? 6 : 0), bottom: 17, left, right: left },
      head: [section.head],
      body: section.body.length ? section.body : [[{ content: section.emptyMessage || 'No records available.', colSpan: section.head.length, styles: { halign: 'center', cellPadding: 5 } }]],
      foot: section.total ? [section.total] : undefined, showFoot: 'lastPage',
      theme: 'grid', rowPageBreak: 'avoid',
      styles: { font: 'helvetica', fontSize: 10, textColor: [0, 0, 0], cellPadding: 2, minCellHeight: 7,
        lineColor: [30, 30, 30], lineWidth: 0.18, overflow: 'linebreak', valign: 'middle' },
      headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontStyle: 'normal', fontSize: 11, halign: 'center' },
      footStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontStyle: 'bold' },
      columnStyles,
      willDrawPage: data => {
        if (hasTitle && data.pageNumber > 1) {
          doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(0, 0, 0);
          doc.text(section.title, left, tableTop);
        }
      },
    });
    y = doc.lastAutoTable.finalY + 11;
  }
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page);
    drawCooperativeLetterhead(doc, logo, left, right);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(14);
    doc.text(titleLines, doc.internal.pageSize.getWidth() / 2, titleY, { align: 'center', lineHeightFactor: 1.21 });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
    doc.text(scopeLines, left, scopeY, { lineHeightFactor: 1.42 });
    doc.text(`Generated: ${date} PHT`, left, dateY);
    doc.text(metadataLines, left, metadataY, { lineHeightFactor: 1.42 });
    doc.setFontSize(8);
    doc.text('Amounts in PHP | SVPMPC', left, height - 9);
    doc.text(`Page ${page} of ${pages}`, right, height - 9, { align: 'right' });
  }
  return doc;
};
