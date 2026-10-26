import { createMortuaryReportPdf, loadReportLogo } from './mortuaryReportPdf.js';

export const dailyHeaders = ['Passbook No.', 'Member', 'Reference', 'Type', 'Amount added'];
export const dailyTypeLabel = type => ({ contribution: 'Contribution', adjustment: 'Opening balance / adjustment', automatic_deduction: 'Automatic deduction', penalty: 'Penalty', payout: 'Payout', claim_payout: 'Claim payout' })[type] || type;
export const dailyRows = rows => rows.map(row => [row.memberId, row.memberName, row.reference, dailyTypeLabel(row.transactionType), row.amount]);
export const todayManila = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const money = value => Number(value).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function dailySummaryCsv(summary) {
  const t = summary.totals;
  const rows = [['Daily amounts added', summary.date, summary.timezone],
    ['Total added', t.totalAdded], ['Members', t.members], ['Entries', t.transactions],
    ['Edits awaiting reporting completion', t.pendingEdits], [], dailyHeaders, ...dailyRows(summary.rows)];
  const escape = value => {
    let text = String(value ?? '');
    if (typeof value === 'string' && /^[\s]*[=+@-]/.test(text)) text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
  };
  return '\uFEFF' + rows.map(row => row.map(escape).join(',')).join('\r\n') + '\r\n';
}

export function downloadDailySummary(summary) {
  const url = URL.createObjectURL(new Blob([dailySummaryCsv(summary)], { type: 'text/csv;charset=utf-8;' }));
  const link = document.createElement('a'); link.href = url; link.download = `Member-ledger-daily-summary-${summary.date}.csv`; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function dailySummaryPdf(summary, logo) {
  const t = summary.totals;
  const date = new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', month: 'long', day: 'numeric', year: 'numeric' }).format(new Date(summary.date + 'T00:00:00+08:00'));
  const pendingNote = t.pendingEdits ? ` ${t.pendingEdits} saved edit(s) await reporting / audit completion.` : '';
  return createMortuaryReportPdf({
    title: 'Daily Member Ledger Summary',
    logo,
    highlights: [{ label: 'Transaction date', value: date }],
    scope: 'Amounts added to member ledgers, including contributions and opening balance credits. Latest saved amounts in Philippine time.' + pendingNote,
    metadataLabel: 'SUMMARY',
    metadataValue: `Total added: PHP ${money(t.totalAdded)} | Members: ${t.members} | Entries: ${t.transactions}`,
    sections: [{
      head: dailyHeaders,
      body: dailyRows(summary.rows).map(row => row.map((value, index) => index === 4 ? money(value) : value)),
      widths: [25, 47, 34, 39, 31],
      numberColumns: [4],
      emptyMessage: 'No amounts added on this date.',
      total: [{ content: 'Total added (PHP)', colSpan: 4 }, money(t.totalAdded)],
    }],
  });
}

export async function printDailySummary(summary) {
  const popup = window.open('', '_blank');
  if (!popup) throw new Error('Allow popups to print the daily summary.');
  try {
    const doc = dailySummaryPdf(summary, await loadReportLogo()); doc.autoPrint();
    const url = URL.createObjectURL(doc.output('blob')); popup.location.href = url;
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (error) { popup.close(); throw error; }
}

export async function downloadDailySummaryPdf(summary) {
  dailySummaryPdf(summary, await loadReportLogo()).save(`Member-ledger-daily-summary-${summary.date}.pdf`);
}
