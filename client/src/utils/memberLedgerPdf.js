import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';

export const LEDGER_HEADERS = ['Date', 'OR/DV\nNumber', 'Received', 'Withdrawn', 'Balance'];
const money = value => Number(value || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dateText = value => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Manila' });
};
const beneficiaryText = value => Array.isArray(value)
  ? value.map(person => typeof person === 'string' ? person : person.name ?? person.beneficiaryName ?? '').filter(Boolean).join(', ')
  : String(value || '');

// Printing and downloading share this document, including repeated member
// details on continuation pages and full reference numbers without truncation.
export const createMemberLedgerPdf = (member, entries, { logoDataUrl = null, filtered = false } = {}) => {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  doc.setProperties({ title: `Mutual Assistance Fund Ledger - ${member.name}`, author: 'SVPMPC' });
  const left = 36;
  const right = doc.internal.pageSize.getWidth() - left;
  const width = right - left;
  const detailRows = [];
  doc.setFont('helvetica', 'normal'); doc.setFontSize(11);
  let y = 116;
  for (const [label, value] of [['Name:', member.name], ['Address:', member.address], ['Beneficiary:', beneficiaryText(member.beneficiaries)]]) {
    const lines = doc.splitTextToSize(String(value || ''), width - 83);
    detailRows.push({ label, lines, y });
    y += Math.max(1, lines.length) * 13 + 5;
  }
  const titleY = y + 13;
  const tableY = titleY + 12;
  const body = entries.map(entry => [
    dateText(entry.date), String(entry.ref_no ?? ''),
    entry.received ? money(entry.received) : '',
    entry.withdrawn ? money(entry.withdrawn) : '', money(entry.balance),
  ]);
  // Keep the ruled form useful even when there are few or no transactions.
  const minimumRows = Math.max(1, Math.floor((770 - tableY - 32) / 19));
  while (body.length < minimumRows) body.push(['', '', '', '', '']);
  autoTable(doc, {
    startY: tableY,
    margin: { top: tableY, bottom: 42, left, right: left },
    head: [LEDGER_HEADERS], body, theme: 'grid', rowPageBreak: 'avoid',
    styles: { font: 'helvetica', fontSize: 10, cellPadding: 4, minCellHeight: 19, lineColor: [30, 30, 30], lineWidth: 0.5, textColor: [0, 0, 0], valign: 'middle', overflow: 'linebreak' },
    headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontStyle: 'normal', halign: 'center', fontSize: 12 },
    columnStyles: { 0: { cellWidth: 82 }, 1: { cellWidth: 132 }, 2: { cellWidth: 103, halign: 'right' }, 3: { cellWidth: 103, halign: 'right' }, 4: { halign: 'right' } },
    didDrawPage: () => {
      if (logoDataUrl) {
        try { doc.addImage(logoDataUrl, 'PNG', left + 4, 34, 52, 62, 'ledger-logo', 'FAST'); } catch { /* Keep the statement usable without a logo. */ }
      }
      const center = left + 62 + (width - 62) / 2;
      doc.setTextColor(0, 0, 0); doc.setFont('times', 'bold'); doc.setFontSize(20);
      doc.text('SAINT VINCENT PARISH', center, 51, { align: 'center' });
      doc.setFontSize(18); doc.text('MULTI-PURPOSE COOPERATIVE', center, 72, { align: 'center' });
      doc.setFont('helvetica', 'normal'); doc.setFontSize(12);
      doc.text('Dupax del Sur, Nueva Vizcaya, Philippines', center, 90, { align: 'center' });
      for (const row of detailRows) {
        doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.text(row.label, left, row.y);
        doc.setFont('helvetica', 'normal'); doc.text(row.lines, left + 83, row.y, { lineHeightFactor: 1.18 });
      }
      doc.setFont('helvetica', 'bold'); doc.setFontSize(19);
      doc.text('MUTUAL ASSISTANCE FUND', doc.internal.pageSize.getWidth() / 2, titleY, { align: 'center' });
    },
  });
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page); doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
    doc.text(`Amounts in PHP | ${filtered ? 'Filtered transactions' : 'Full transaction history'}`, left, 814);
    doc.text(`Page ${page} of ${pages}`, right, 814, { align: 'right' });
  }
  return doc;
};

let logoPromise;
const loadLogo = () => {
  if (!logoPromise) logoPromise = (async () => {
    try {
      const response = await fetch('/SVPMPC-LOGO(MAIN).png');
      if (!response.ok) return null;
      const blob = await response.blob();
      return await new Promise((resolve, reject) => {
        const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(blob);
      });
    } catch { return null; }
  })();
  return logoPromise;
};

export const outputMemberLedgerPdf = async (member, entries, { print = false, filtered = false } = {}) => {
  // Open immediately during the click so fetching the logo does not trigger
  // popup blocking when the print document is ready.
  const printWindow = print ? window.open('', '_blank') : null;
  if (print && !printWindow) throw new Error('Allow popups to print the ledger.');
  try {
    const doc = createMemberLedgerPdf(member, entries, { logoDataUrl: await loadLogo(), filtered });
    if (print) {
      doc.autoPrint();
      const url = URL.createObjectURL(doc.output('blob'));
      printWindow.location.href = url;
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } else {
      const name = String(member.name || 'Member').replace(/[^\w -]/g, '').trim().replace(/\s+/g, '-');
      doc.save(`${name}-Mortuary-Ledger.pdf`);
    }
  } catch (error) {
    printWindow?.close();
    throw error;
  }
};
