// Older CSV payments stored the internal import ID in referenceId. Resolve
// their receipt for display without rewriting ledger history or its balances.
async function resolveLedgerPaymentReferences(entries, { Contribution, PaymentImport }) {
  const legacy = entries.filter(entry => entry.transactionType === 'contribution' &&
    /^CSV-[a-f\d]{64}$/i.test(entry.ledgerId) && entry.referenceId === entry.ledgerId);
  const references = new Map();
  if (!legacy.length) return references;
  const ids = legacy.map(entry => entry.ledgerId);
  const [reservations, contributions] = await Promise.all([
    PaymentImport.find({ _id: { $in: ids } }).select('memberId referenceNumber').lean(),
    Contribution.find({ contributionId: { $in: ids } }).select('contributionId memberId referenceNumber').lean(),
  ]);
  const payments = new Map(contributions.map(payment => [payment.contributionId, payment]));
  // The immutable reservation also covers imports interrupted before the
  // contribution record was saved. Prefer its original receipt when present.
  for (const reservation of reservations) payments.set(String(reservation._id), reservation);
  for (const entry of legacy) {
    const payment = payments.get(entry.ledgerId);
    if (payment?.memberId === entry.memberId && payment.referenceNumber) {
      references.set(entry.ledgerId, payment.referenceNumber);
    }
  }
  return references;
}

module.exports = { resolveLedgerPaymentReferences };
