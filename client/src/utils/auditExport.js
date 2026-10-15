import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';

export const AUDIT_HEADERS = ['Timestamp', 'Role', 'Action', 'Entity Name', 'Status', 'Description'];

export function createAuditCsv(rows) {
  const escape = value => {
    let text = String(value ?? '');
    // Keep user-entered audit text from being interpreted as an Excel formula.
    if (/^[\s]*[=+@-]/.test(text)) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
  };
  // Excel needs the BOM to detect UTF-8 when opening a CSV directly.
  return '\uFEFF' + [AUDIT_HEADERS, ...rows].map(row => row.map(escape).join(',')).join('\r\n') + '\r\n';
}

export function downloadAuditCsv(rows, filename) {
  const url = URL.createObjectURL(new Blob([createAuditCsv(rows)], { type: 'text/csv;charset=utf-8;' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

// Standard PDF fonts lack peso and arrow glyphs. Use readable equivalents.
const pdfText = value => String(value ?? '').replace(/₱/g, 'PHP ').replace(/→/g, '->').replace(/[–—]/g, '-');

export function createAuditPdf({ rows, moduleName, filters = {}, generatedAt = new Date() }) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true });
  const title = `${moduleName} audit logs`;
  doc.setProperties({ title, author: 'SVPMPC' });
  doc.setFontSize(16);
  doc.text(title, 12, 17);
  doc.setFontSize(9);
  doc.text('St. Vincent Parish Multi-Purpose Cooperative', 12, 23);
  const scope = `Current page ${filters.page || 1} | ${rows.length} records | Role: ${filters.userRole || 'All'} | Action: ${filters.action || 'All'} | Dates: ${filters.startDate || 'Any'} to ${filters.endDate || 'Any'}`;
  const scopeLines = doc.splitTextToSize(scope, 273);
  doc.text(scopeLines, 12, 30);
  autoTable(doc, {
    startY: 34 + scopeLines.length * 4,
    margin: { top: 16, bottom: 18, left: 12, right: 12 },
    head: [AUDIT_HEADERS], body: rows.map(row => row.map(pdfText)),
    theme: 'grid', rowPageBreak: 'avoid',
    styles: { fontSize: 8, cellPadding: 2.5, overflow: 'linebreak', valign: 'top' },
    headStyles: { fillColor: [30, 90, 65] },
    columnStyles: { 0: { cellWidth: 32 }, 1: { cellWidth: 23 }, 2: { cellWidth: 32 }, 3: { cellWidth: 36 }, 4: { cellWidth: 20 }, 5: { cellWidth: 130 } },
  });
  const count = doc.getNumberOfPages();
  const date = generatedAt.toLocaleString('en-PH', { timeZone: 'Asia/Manila' });
  for (let page = 1; page <= count; page++) {
    doc.setPage(page);
    doc.setFontSize(8);
    doc.text(`Generated ${date} PHT | Amounts in PHP`, 12, 201);
    doc.text(`Page ${page} of ${count}`, 285, 201, { align: 'right' });
  }
  return doc;
}
