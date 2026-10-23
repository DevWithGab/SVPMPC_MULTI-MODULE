/* Yung mga mas lumang CSV payments, nakasave sa referenceId ang internal
import ID. Ire-resolve dito ang receipt nila para sa display nang hindi
na-rewrite yung ledger history o mga balances nito. */
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
  /* Sakop din ng immutable reservation yung mga imports na na-interrupt bago
  pa ma-save ang contribution record. Piliin ang original receipt nito kung
  available. */
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
