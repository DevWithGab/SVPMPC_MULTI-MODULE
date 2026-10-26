import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';

export const dailyHeaders = ['Passbook No.', 'Member', 'Reference', 'Type', 'Contributions', 'Deductions / withdrawals', 'Adjustment credits', 'Adjustment debits'];
export const dailyTypeLabel = type => ({ contribution: 'Contribution', adjustment: 'Opening balance / adjustment', automatic_deduction: 'Automatic deduction', penalty: 'Penalty', payout: 'Payout', claim_payout: 'Claim payout' })[type] || type;
export const dailyRows = rows => rows.map(row => [row.memberId, row.memberName, row.reference, dailyTypeLabel(row.transactionType), row.contribution, row.deduction, row.adjustmentCredit, row.adjustmentDebit]);
export const todayManila = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const money = value => Number(value).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function dailySummaryCsv(summary) {
  const t = summary.totals;
  const rows = [['Daily transaction summary', summary.date, summary.timezone],
    ['Contributions recorded', t.contributions], ['Deductions / withdrawals recorded', t.deductions],
    ['Opening balances / adjustment credits', t.adjustmentCredits], ['Adjustment debits', t.adjustmentDebits],
    ['Net ledger change', t.netChange], ['Members with transactions', t.members], ['Transactions', t.transactions],
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

export function dailySummaryPdf(summary) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const t = summary.totals;
  doc.setFontSize(14); doc.text('St. Vincent Parish Multi-Purpose Cooperative', 12, 15);
  doc.setFontSize(12); doc.text(`Member ledger - Daily transaction summary: ${summary.date}`, 12, 23);
  doc.setFontSize(9);
  doc.text('Transaction date in Asia/Manila | Latest recorded amounts | All transactions for this date', 12, 30);
  doc.text(`Contributions: PHP ${money(t.contributions)}    Deductions / withdrawals: PHP ${money(t.deductions)}    Net ledger change: PHP ${money(t.netChange)}`, 12, 37);
  doc.text(`Adjustment credits: PHP ${money(t.adjustmentCredits)}    Adjustment debits: PHP ${money(t.adjustmentDebits)}    Members: ${t.members}    Transactions: ${t.transactions}`, 12, 44);
  if (t.pendingEdits) doc.text(`${t.pendingEdits} saved edit(s) still need payment reporting / audit completion.`, 12, 51);
  autoTable(doc, { startY: t.pendingEdits ? 57 : 50, margin: { top: 15, bottom: 15, left: 12, right: 12 },
    head: [dailyHeaders], body: dailyRows(summary.rows).map(row => row.map((value, index) => index >= 4 ? money(value) : value)),
    theme: 'grid', rowPageBreak: 'avoid', styles: { fontSize: 8, cellPadding: 2.5, overflow: 'linebreak' },
    headStyles: { fillColor: [36, 94, 50] }, columnStyles: { 4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right' }, 7: { halign: 'right' } } });
  if (!summary.rows.length) doc.text('No transactions recorded for this date.', 12, 68);
  for (let page = 1; page <= doc.getNumberOfPages(); page++) {
    doc.setPage(page); doc.setFontSize(8); doc.text(`${summary.date} | Amounts in PHP | Page ${page} of ${doc.getNumberOfPages()}`, 12, 203);
  }
  return doc;
}

export function printDailySummary(summary) {
  const popup = window.open('', '_blank');
  if (!popup) throw new Error('Allow popups to print the daily summary.');
  try {
    const doc = dailySummaryPdf(summary); doc.autoPrint();
    const url = URL.createObjectURL(doc.output('blob')); popup.location.href = url;
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (error) { popup.close(); throw error; }
}
