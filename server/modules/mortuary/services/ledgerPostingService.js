const LATEST_FIRST = { createdAt: -1, _id: -1 };
const POSTING_INDEX_NAME = 'member_posting_parent_unique';
const POSTING_INDEX = { memberId: 1, postingParent: 1 };
const POSTING_INDEX_OPTIONS = {
  name: POSTING_INDEX_NAME, unique: true,
  partialFilterExpression: { postingParent: { $type: 'string' } },
};
const POSTING_HEAD_INDEX = { memberId: 1, ...LATEST_FIRST };
const POSTING_HEAD_INDEX_OPTIONS = { name: 'member_posting_head' };
const money = value => Math.round(value * 100) / 100;
const fail = (status, message) => Object.assign(new Error(message), { status });

// The unique parent index is a database compare-and-set: exactly one posting
// can follow a member's current head. A losing writer rereads the head and
// recalculates its balance. No lease can expire while a stale writer is alive,
// and no separate balance document can get ahead of a failed ledger insert.
function createLedgerPostingService({ Ledger, maxAttempts = 50, wait = ms => new Promise(resolve => setTimeout(resolve, ms)) }) {
  const samePosting = (stored, entry) =>
    ['memberId', 'transactionType', 'referenceId', 'importKey', 'correctionOf'].every(key =>
      (stored[key] ?? '') === (entry[key] ?? '')) &&
    Number(stored.credit || 0) === entry.credit && Number(stored.debit || 0) === entry.debit;

  async function postLedgerEntry(input, { expectedBalance } = {}) {
    if (typeof input.ledgerId !== 'string' || !input.ledgerId || typeof input.memberId !== 'string' || !input.memberId) {
      throw fail(400, 'A ledger ID and member ID are required.');
    }
    const entry = { ...input, credit: Number(input.credit ?? 0), debit: Number(input.debit ?? 0) };
    if (!Number.isFinite(entry.credit) || !Number.isFinite(entry.debit)) throw fail(400, 'Invalid ledger amount.');
    const replay = stored => {
      if (!samePosting(stored, entry)) throw fail(409, 'This ledger ID already belongs to a different transaction.');
      return { ledger: stored, created: false };
    };
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const existing = await Ledger.findOne({ ledgerId: entry.ledgerId });
      if (existing) return replay(existing);
      const head = await Ledger.findOne({ memberId: entry.memberId }).sort(LATEST_FIRST);
      const currentBalance = head ? Number(head.balance) : 0;
      if (!Number.isFinite(currentBalance) || head && (typeof head.ledgerId !== 'string' || !head.ledgerId)) {
        throw fail(503, 'The member ledger head needs review before another transaction can be posted.');
      }
      if (expectedBalance !== undefined && (!Number.isFinite(expectedBalance) || currentBalance !== expectedBalance)) {
        throw fail(409, 'The member balance changed. Refresh the ledger and review the correction again.');
      }
      const balance = money(currentBalance + entry.credit - entry.debit);
      if (!Number.isSafeInteger(Math.round(balance * 100))) throw fail(400, 'The resulting balance is too large.');
      // Strictly increasing timestamps keep existing posting-order readers
      // correct across instances, clock differences, and same-millisecond saves.
      const createdAt = new Date(Math.max(Date.now(), (new Date(head?.createdAt || 0).getTime() || 0) + 1));
      const ledger = new Ledger({ ...entry, balance,
        postingParent: head ? `ledger:${head.ledgerId}` : 'root', createdAt });
      try {
        await ledger.save();
        return { ledger, created: true };
      } catch (error) {
        if (error.code !== 11000) throw error;
        const stored = await Ledger.findOne({ ledgerId: entry.ledgerId });
        if (stored) return replay(stored);
        if (!error.keyPattern?.postingParent && !error.message?.includes(POSTING_INDEX_NAME)) throw error;
        await wait(Math.min(40, (attempt + 1) * 2) + Math.floor(Math.random() * 10));
      }
    }
    throw fail(503, 'This member has concurrent transactions. Retry the same request; completed postings will not be repeated.');
  }
  return { postLedgerEntry };
}

module.exports = { createLedgerPostingService, POSTING_INDEX, POSTING_INDEX_OPTIONS,
  POSTING_HEAD_INDEX, POSTING_HEAD_INDEX_OPTIONS };
