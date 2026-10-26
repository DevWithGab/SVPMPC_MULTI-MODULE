import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import { drawCooperativeLetterhead } from './cooperativePdfLetterhead.js';

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

/* Pareho lang ang document na ginagamit ng printing at downloading, kasama
yung repeated member details sa continuation pages at full reference
numbers na walang truncation. */
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
    dateText(entry.date), `${entry.ref_no ?? ''}${entry.correctionKind ? `\nCorrection ${entry.correctionKind}` : entry.corrected ? '\nCorrected (see linked entries)' : ''}`,
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
      drawCooperativeLetterhead(doc, logoDataUrl, left, right);
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
      // This small, opaque logo avoids decoding a 2048px PNG and embedding
      // its transparency mask in every ledger PDF.
      const response = await fetch('/SVPMPC-LOGO-PRINT.png');
      if (!response.ok) throw new Error('Unable to load ledger logo');
      return new Uint8Array(await response.arrayBuffer());
    } catch {
      logoPromise = undefined;
      return null;
    }
  })();
  return logoPromise;
};

export const outputMemberLedgerPdf = async (member, entries, { print = false, filtered = false } = {}) => {
  /* I-open agad habang nasa click event para pag kinuha yung logo, hindi
  na ma-trigger yung popup blocking pagdating ng print document. */
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
