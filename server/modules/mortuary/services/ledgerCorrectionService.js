const { createHash } = require('node:crypto');
const { withMemberPaymentLock } = require('../utils/paymentLock');
const { actorName } = require('../../../shared/utils/actorName');
const { LATEST_FIRST, POSTING_ORDER } = require('../utils/ledgerBalance');
const money = value => Math.round(value * 100) / 100;
const fail = (status, message) => Object.assign(new Error(message), { status });
const correctionId = id => `CORR-${createHash('sha256').update(id).digest('hex')}`;
const isCorrectable = (entry, firstId) => entry.correction
  ? entry.correction.completed
  : entry.credit > 0 && !entry.debit && (entry.transactionType === 'contribution' || entry.transactionType === 'adjustment' && entry.ledgerId === firstId);

function validateCorrection({ amount, reason }) {
  if (!['number', 'string'].includes(typeof amount) || !/^\d+(\.\d{1,2})?$/.test(String(amount)) || !Number.isSafeInteger(Math.round(Number(amount) * 100)) || Number(amount) <= 0) {
    throw fail(400, 'Enter a corrected amount greater than zero, with at most 2 decimal places.');
  }
  if (reason != null && (typeof reason !== 'string' || reason.trim().length > 500)) throw fail(400, 'An optional note must be at most 500 characters.');
  return { amount: Number(amount), reason: reason?.trim() || '' };
}

function createLedgerCorrectionService({ Ledger, Contribution, AuditLog }) {
  async function finish(posting) {
    const correction = posting.correction;
    if (correction.completed) return;
    if (correction.contributionId) {
      // Preserve the reporting date and identity; update the one original payment.
      const result = await Contribution.updateOne({ contributionId: correction.contributionId, memberId: posting.memberId, amount: correction.beforeAmount }, { $set: { amount: correction.afterAmount } }, { runValidators: true });
      if (!result.matchedCount) {
        const payment = await Contribution.findOne({ contributionId: correction.contributionId, memberId: posting.memberId });
        if (!payment || payment.amount !== correction.afterAmount) throw fail(409, 'Payment history changed unexpectedly. The saved correction needs review before it can be completed.');
      }
    }
    await AuditLog.updateOne({ logId: posting.ledgerId }, { $setOnInsert: {
      logId: posting.ledgerId, userId: correction.userId, userName: correction.userName, userRole: correction.userRole,
      action: 'ledger_corrected', module: 'mortuary', entityType: 'ledger', entityId: correction.rootLedgerId,
      description: correction.reason ? `Ledger amount edited: ${correction.reason}` : 'Ledger amount edited',
      changes: { before: { ledgerId: posting.correctionOf, amount: correction.beforeAmount }, after: { ledgerId: posting.ledgerId, amount: correction.afterAmount } },
      metadata: { memberId: posting.memberId, reason: correction.reason, correctionOf: posting.correctionOf },
      timestamp: posting.createdAt,
    } }, { upsert: true, runValidators: true });
    await Ledger.updateOne({ ledgerId: posting.ledgerId }, { $set: { 'correction.completed': true } });
    correction.completed = true;
  }

  async function correct(memberId, ledgerId, body, user) {
    const values = validateCorrection(body);
    if (typeof memberId !== 'string' || typeof ledgerId !== 'string') throw fail(400, 'Choose a member and ledger entry.');
    return withMemberPaymentLock(memberId, async () => {
      const source = await Ledger.findOne({ memberId, ledgerId });
      if (!source) throw fail(404, 'Ledger entry not found for this member.');
      let posting = await Ledger.findOne({ correctionOf: ledgerId });
      if (posting && (posting.correction.afterAmount !== values.amount || (posting.correction.reason || '') !== values.reason)) throw fail(409, 'This entry has already been corrected. Refresh the ledger and edit the current amount again.');
      if (!posting) {
        const first = await Ledger.findOne({ memberId }).sort(POSTING_ORDER);
        if (!isCorrectable(source, first?.ledgerId)) throw fail(400, 'Only payments and the opening credit balance can be corrected here. Finish any pending correction first.');
        if (source.credit === values.amount) throw fail(400, 'The corrected amount must differ from the current amount.');
        if (Number(body.expectedAmount) !== source.credit) throw fail(409, 'The entry has changed. Refresh the ledger before correcting it.');
        const originalType = source.correction?.originalType || source.transactionType;
        let contributionId = source.correction?.contributionId;
        if (originalType === 'contribution' && !contributionId) {
          const byId = await Contribution.findOne({ memberId, contributionId: ledgerId });
          const candidates = byId ? [byId] : source.referenceId ? await Contribution.find({ memberId, $or: [{ contributionId: source.referenceId }, { referenceNumber: source.referenceId }] }) : [];
          if (candidates.length !== 1 || candidates[0].amount !== source.credit || candidates[0].status !== 'paid') throw fail(409, 'Cannot safely link this ledger entry to one paid contribution. Complete its original upload or review its payment history first.');
          contributionId = candidates[0].contributionId;
        }
        const latest = await Ledger.findOne({ memberId }).sort(LATEST_FIRST);
        const currentBalance = latest?.balance || 0;
        if (!Number.isFinite(body.expectedBalance) || body.expectedBalance !== currentBalance) throw fail(409, 'The member balance changed. Refresh the ledger and review the correction again.');
        const balance = money(currentBalance - source.credit + values.amount);
        if (!Number.isSafeInteger(Math.round(balance * 100))) throw fail(400, 'The resulting balance is too large.');
        posting = new Ledger({
          ledgerId: correctionId(ledgerId), correctionOf: ledgerId, memberId,
          transactionType: 'adjustment', description: values.reason ? `Amount edit: ${values.reason}` : 'Ledger amount edit',
          // Single-document posting: debit reverses the old value; credit replaces it.
          debit: source.credit, credit: values.amount, balance,
          referenceId: source.referenceId, transactionDate: source.transactionDate,
          paymentMethod: source.paymentMethod, recordedBy: actorName(user),
          correction: { rootLedgerId: source.correction?.rootLedgerId || ledgerId, originalType,
            beforeAmount: source.credit, afterAmount: values.amount, reason: values.reason,
            userId: user.userId, userName: actorName(user), userRole: user.role, contributionId, completed: false },
        });
        try { await posting.save(); }
        catch (error) {
          if (error.code !== 11000) throw error;
          posting = await Ledger.findOne({ correctionOf: ledgerId });
          if (!posting || posting.correction.afterAmount !== values.amount || posting.correction.reason !== values.reason) throw fail(409, 'Another correction was saved. Refresh the ledger.');
        }
      }
      try { await finish(posting); }
      catch (error) {
        throw Object.assign(fail(503, 'The balance correction is saved, but payment history or the audit log still needs to finish. Retry this same correction; the balance will not change twice.'), { saved: true });
      }
      return posting;
    });
  }
  return { correct };
}
module.exports = { createLedgerCorrectionService, validateCorrection, isCorrectable };
