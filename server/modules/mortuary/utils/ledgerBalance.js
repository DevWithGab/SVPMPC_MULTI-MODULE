const Ledger = require('../models/Ledger');

// A ledger row's `balance` column is a RUNNING TOTAL, written in the order rows
// are posted. So "what is this member's balance right now" means "the balance
// carried on the most recently POSTED row" — ordered by createdAt, never by
// transactionDate.
//
// transactionDate is the human-entered *effective* date. It can be back-dated
// (importing historical statements) or land in the future: a date-only value
// like "2026-09-17" parses to UTC midnight, which is 08:00 that morning in PHT.
// Ordering the running balance by it lets one such row out-sort every deduction
// posted after it, so each new deduction re-reads the same stale balance, writes
// the same result, and the member's balance appears frozen. That was a real bug:
// 50 members sat at exactly ₱1,000 through four ₱900 assessments because a
// bulk-uploaded contribution dated "tomorrow" masked every one of them.
//
// _id breaks ties — it is monotonic, so two rows created in the same
// millisecond still resolve in insertion order.
const POSTING_ORDER = { createdAt: 1, _id: 1 };
const LATEST_FIRST = { createdAt: -1, _id: -1 };

// The most recent posted balance for a member, or 0 if they have no rows.
const getLatestBalance = async (memberId) => {
  const latest = await Ledger.findOne({ memberId }).sort(LATEST_FIRST);
  return latest ? latest.balance : 0;
};

// Rewrites every `balance` for a member as the running total in posting order.
// Returns what would change so callers can dry-run before committing; pass
// { apply: true } to actually write. Used to repair rows saved while the old
// transactionDate ordering was in force.
const recomputeMemberBalances = async (memberId, { apply = false } = {}) => {
  const rows = await Ledger.find({ memberId }).sort(POSTING_ORDER);
  let running = 0;
  const changes = [];

  for (const row of rows) {
    running = Math.round((running + (row.credit || 0) - (row.debit || 0)) * 100) / 100;
    if (row.balance !== running) {
      changes.push({ ledgerId: row.ledgerId, from: row.balance, to: running });
      if (apply) {
        await Ledger.updateOne({ _id: row._id }, { $set: { balance: running } });
      }
    }
  }

  return { memberId, rows: rows.length, finalBalance: running, changes };
};

module.exports = { POSTING_ORDER, LATEST_FIRST, getLatestBalance, recomputeMemberBalances };
