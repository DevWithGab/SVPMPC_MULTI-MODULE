const Ledger = require('../models/Ledger');

/* Ang `balance` column ng ledger row ay RUNNING TOTAL, isinusulat base sa
pagkaka-post ng rows. Kaya ang "ano ang balance ng member ngayon" ay
nangangahulugang "yung balance na dala ng pinaka-huling POSTED row" -
naka-order by createdAt, hindi sa transactionDate.

Ang transactionDate ay yung human-entered *effective* date. Puwede itong
i-back-date (pag-import ng historical statements) o mapunta sa future:
isang date-only value tulad ng "2026-09-17" ay pumapasok bilang UTC
midnight, na 08:00 ng umaga sa PHT. Kung i-order ang running balance base
dito, puwedeng ma-out-sort ng isang row ang lahat ng deduction na
na-post after nito, kaya bawat bagong deduction ay babasa ulit ng
parehong stale balance, isusulat ang parehong result, at magmumukhang
frozen ang balance ng member. Totoong bug ito dati: 50 members ay
naka-stuck sa eksaktong ₱1,000 kahit apat na ₱900 assessments na, dahil
sa isang bulk-uploaded contribution na "tomorrow" ang date, na nagtago
sa lahat sa kanila.

Ang _id ang pumuputol ng tie - monotonic ito, kaya dalawang rows na
nagawa sa parehong millisecond ay naresolba pa rin base sa insertion
order. */
const POSTING_ORDER = { createdAt: 1, _id: 1 };
const LATEST_FIRST = { createdAt: -1, _id: -1 };

// The most recent posted balance for a member, or 0 if they have no rows.
const getLatestBalance = async (memberId) => {
  const latest = await Ledger.findOne({ memberId }).sort(LATEST_FIRST);
  return latest ? latest.balance : 0;
};

/* Batch version ito ng getLatestBalance - isang aggregation lang imbes na
isang findOne() per member, para sa hot paths (hal. treasurer dashboard) na
kailangan ng current balance ng lahat ng member nang sabay-sabay. $sort
muna bago $group para yung $first ng bawat group ay yung
most-recently-posted row ng member, parehong ordering na binibigay ng
LATEST_FIRST sa findOne(). Yung mga member na walang ledger rows ay wala
lang sa returned map - itinuturing ng callers na 0 ang missing entry,
kagaya din ng fallback ng getLatestBalance mismo. */
const getLatestBalancesByMember = async (memberIds) => {
  const rows = await Ledger.aggregate([
    { $match: { memberId: { $in: memberIds } } },
    { $sort: { memberId: 1, createdAt: -1, _id: -1 } },
    { $group: { _id: '$memberId', balance: { $first: '$balance' } } },
  ]);
  return new Map(rows.map((row) => [row._id, row.balance]));
};

/* Isinusulat ulit ang bawat `balance` ng member bilang running total base sa
posting order. Ibinabalik kung ano ang magbabago para makapag-dry-run muna
ang callers bago mag-commit; i-pass ang { apply: true } para talagang
isulat. Ginagamit ito para ayusin yung rows na na-save noong gamit pa ang
lumang transactionDate ordering. */
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

module.exports = { POSTING_ORDER, LATEST_FIRST, getLatestBalance, getLatestBalancesByMember, recomputeMemberBalances };
