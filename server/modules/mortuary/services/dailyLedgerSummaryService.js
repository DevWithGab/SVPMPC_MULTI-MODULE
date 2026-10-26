const { resolveLedgerPaymentReferences } = require('../utils/ledgerReferences');
const money = value => Math.round(value * 100) / 100;

function dailyRange(date) {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(`${date}T00:00:00Z`)) || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) {
    throw Object.assign(new Error('Choose a valid transaction date in YYYY-MM-DD format.'), { status: 400 });
  }
  const start = new Date(`${date}T00:00:00+08:00`);
  return { start, end: new Date(start.getTime() + 86400000) };
}

function summarizeDay(date, originals, edits, members, references = new Map()) {
  const latest = new Map();
  for (const edit of [...edits].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt) || String(a._id).localeCompare(String(b._id)))) latest.set(edit.correction.rootLedgerId, edit);
  const names = new Map(members.map(member => [member.memberId, member.memberName]));
  const totals = { totalAdded: 0, members: 0, transactions: 0, pendingEdits: 0 };
  const rows = originals.flatMap(entry => {
    const edit = latest.get(entry.ledgerId);
    const credit = edit ? edit.correction.afterAmount : entry.credit || 0;
    if (credit <= 0) return [];
    totals.totalAdded = money(totals.totalAdded + credit);
    if (edit && !edit.correction.completed) totals.pendingEdits++;
    return { id: entry.ledgerId, memberId: entry.memberId, memberName: names.get(entry.memberId) || 'Member record unavailable',
      reference: references.get(entry.ledgerId) || entry.referenceId || entry.ledgerId, transactionType: entry.transactionType,
      amount: money(credit) };
  }).sort((a, b) => a.memberId.localeCompare(b.memberId) || a.reference.localeCompare(b.reference) || a.id.localeCompare(b.id));
  totals.members = new Set(rows.map(row => row.memberId)).size;
  totals.transactions = rows.length;
  return { date, timezone: 'Asia/Manila', totals, rows };
}

function createDailyLedgerSummaryService({ Ledger, Member, Contribution, PaymentImport }) {
  return async date => {
    const { start, end } = dailyRange(date);
    const originals = await Ledger.find({ correction: { $exists: false }, transactionDate: { $gte: start, $lt: end } });
    if (!originals.length) return summarizeDay(date, [], [], []);
    const [edits, members, references] = await Promise.all([
      Ledger.find({ 'correction.rootLedgerId': { $in: originals.map(row => row.ledgerId) } }),
      Member.find({ memberId: { $in: [...new Set(originals.map(row => row.memberId))] } }).select('memberId memberName').lean(),
      resolveLedgerPaymentReferences(originals, { Contribution, PaymentImport }),
    ]);
    return summarizeDay(date, originals, edits, members, references);
  };
}
module.exports = { dailyRange, summarizeDay, createDailyLedgerSummaryService };
