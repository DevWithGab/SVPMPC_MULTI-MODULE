const { isCorrectable } = require('../services/ledgerCorrectionService');

// Expand each atomic correction posting into the two statement lines it represents.
function decorateLedgerEntries(formatted, documents, allEntries) {
  const first = [...allEntries].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt) || String(a._id).localeCompare(String(b._id)))[0];
  const successors = new Map(allEntries.filter(row => row.correctionOf).map(row => [row.correctionOf, row]));
  const histories = new Map();
  for (const row of allEntries.filter(row => row.correction)) {
    const c = row.correction;
    const history = histories.get(c.rootLedgerId) || [];
    history.push({ ledgerId: row.ledgerId, sourceLedgerId: row.correctionOf, beforeAmount: c.beforeAmount, afterAmount: c.afterAmount,
      reason: c.reason, userName: c.userName, createdAt: row.createdAt, completed: c.completed });
    histories.set(c.rootLedgerId, history);
  }
  return formatted.flatMap((entry, index) => {
    const doc = documents[index];
    const history = (histories.get(doc.correction?.rootLedgerId || doc.ledgerId) || []).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    const common = { ...entry, sourceLedgerId: doc.ledgerId, corrected: successors.has(doc.ledgerId), correctionHistory: history,
      canCorrect: !successors.has(doc.ledgerId) && Boolean(isCorrectable(doc, first?.ledgerId)) };
    if (!doc.correction) return [common];
    const c = doc.correction;
    const correction = { ...common, correctionKind: 'replacement', received: doc.credit, withdrawn: 0, correctionSequence: 1,
      description: `Corrected payment / opening balance: ${c.reason}`, correctionPending: !c.completed,
      pendingCorrection: !c.completed ? { sourceLedgerId: doc.correctionOf, amount: c.afterAmount, reason: c.reason, expectedAmount: c.beforeAmount } : null };
    return [correction, { ...common, id: `${entry.id}-reversal`, canCorrect: false, corrected: false, correctionKind: 'reversal', correctionSequence: 0,
      received: 0, withdrawn: doc.debit, balance: Math.round((doc.balance - doc.credit) * 100) / 100,
      description: `Reversal for correction: ${c.reason}` }];
  });
}
module.exports = { decorateLedgerEntries };
