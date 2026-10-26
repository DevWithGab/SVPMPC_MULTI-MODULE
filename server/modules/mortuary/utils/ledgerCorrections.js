const { isCorrectable } = require('../services/ledgerCorrectionService');
const money = value => Math.round(value * 100) / 100;

// Immutable audit postings are folded into one current transaction per statement.
function decorateLedgerEntries(formatted, documents, allEntries) {
  const ordered = [...allEntries].sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0) || String(a._id).localeCompare(String(b._id)));
  const latest = new Map();
  for (const row of ordered) if (row.correction) latest.set(row.correction.rootLedgerId, row);
  const firstByMember = new Map(), balances = new Map(), projected = new Map();
  for (const row of ordered) {
    if (row.correction) continue;
    if (!firstByMember.has(row.memberId)) firstByMember.set(row.memberId, row.ledgerId);
    const edit = latest.get(row.ledgerId);
    const credit = edit ? edit.correction.afterAmount : row.credit || 0;
    const balance = money((balances.get(row.memberId) || 0) + credit - (row.debit || 0));
    balances.set(row.memberId, balance);
    projected.set(row.ledgerId, { edit, credit, balance });
  }
  return formatted.flatMap((entry, index) => {
    const doc = documents[index];
    if (doc.correction) return [];
    const { edit, credit, balance } = projected.get(doc.ledgerId);
    const source = edit || doc;
    const pending = edit && !edit.correction.completed;
    return [{ ...entry, received: credit, balance, sourceLedgerId: source.ledgerId,
      canCorrect: Boolean(isCorrectable(source, firstByMember.get(doc.memberId))),
      correctionPending: Boolean(pending),
      pendingCorrection: pending ? { sourceLedgerId: edit.correctionOf, amount: edit.correction.afterAmount,
        expectedAmount: edit.correction.beforeAmount, reason: edit.correction.reason || '' } : null }];
  });
}
module.exports = { decorateLedgerEntries };
