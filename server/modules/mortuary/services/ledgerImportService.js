const { createHash } = require('node:crypto');
const { keyOf, referenceKey, sameEntry } = require('../utils/ledgerCsv');
const { withMemberPaymentLocks } = require('../utils/paymentLock');

const importKeyOf = entry => `LEDGERCSV-${createHash('sha256').update(referenceKey(entry) || keyOf(entry)).digest('hex')}`;
const isPayment = entry => entry.transactionType === 'contribution' && entry.credit > 0;
const normalizedLedger = ledger => ({ ...ledger, transactionDate: new Date(ledger.transactionDate).toISOString().slice(0, 10) });
const summarize = rows => ({
  total: rows.length,
  ready: rows.filter(row => ['ready', 'resume'].includes(row.status)).length,
  duplicates: rows.filter(row => ['duplicate', 'skipped'].includes(row.status)).length,
  invalid: rows.filter(row => row.status === 'error').length,
  imported: rows.filter(row => row.status === 'imported').length,
  failed: rows.filter(row => row.status === 'failed').length,
});

function createLedgerImportService({ Member, Ledger, Contribution, getLatestBalancesByMember }) {
  async function preview(rows) {
    const candidates = rows.filter(row => !row.errors.length);
    const memberIds = [...new Set(candidates.map(row => row.entry.memberId))];
    const references = candidates.map(row => row.entry.referenceId).filter(Boolean);
    const ledgerIds = candidates.map(row => row.entry.ledgerId).filter(Boolean);
    const dates = [...new Set(candidates.map(row => row.entry.transactionDate))].map(date => new Date(date));
    const [members, existing] = candidates.length ? await Promise.all([
      Member.find({ memberId: { $in: memberIds } }),
      Ledger.find({ $or: [
        { memberId: { $in: memberIds }, transactionDate: { $in: dates } },
        { memberId: { $in: memberIds }, referenceId: { $in: references } },
        { ledgerId: { $in: ledgerIds } },
        { importKey: { $in: candidates.map(row => importKeyOf(row.entry)) } },
      ] }),
    ]) : [[], []];
    const memberById = new Map(members.map(member => [member.memberId, member]));
    const exact = new Map(), byReference = new Map(), byId = new Map(), byImportKey = new Map();
    for (const document of existing) {
      const ledger = normalizedLedger(document.toObject ? document.toObject() : document);
      // A correction is not a new CSV payment. Keep original references reserved.
      if (ledger.correction) continue;
      exact.set(keyOf(ledger), ledger);
      const ref = referenceKey(ledger);
      if (ref) byReference.set(ref, ledger);
      byId.set(ledger.ledgerId, ledger);
      if (ledger.importKey) byImportKey.set(ledger.importKey, ledger);
    }
    for (const document of existing.filter(row => row.correction)) {
      const ledger = normalizedLedger(document.toObject ? document.toObject() : document);
      const replacement = { ...ledger, debit: 0, transactionType: ledger.correction.originalType };
      // Also recognize an amended reference-free CSV carrying the corrected amount.
      if (!exact.has(keyOf(replacement))) exact.set(keyOf(replacement), replacement);
    }
    // A failed reporting write can be finished on retry without another ledger credit.
    const paymentIds = existing.filter(ledger => ledger.importKey && isPayment(ledger)).map(ledger => ledger.ledgerId);
    const reported = new Set(paymentIds.length
      ? (await Contribution.find({ contributionId: { $in: paymentIds } })).map(payment => payment.contributionId) : []);
    return rows.map(source => {
      const row = { ...source, errors: [...source.errors] };
      row.memberName = memberById.get(row.entry.memberId)?.memberName || '';
      if (row.errors.length) return row;
      if (!memberById.has(row.entry.memberId)) row.errors.push('Passbook No. was not found.');
      const matches = [exact.get(keyOf(row.entry)), byReference.get(referenceKey(row.entry)), byId.get(row.entry.ledgerId), byImportKey.get(importKeyOf(row.entry))].filter(Boolean);
      if (matches.some(stored => !sameEntry(stored, row.entry))) {
        row.errors.push('This reference or ledgerId is already recorded with different transaction details. Use Edit amount in the member ledger; CSV uploads will not overwrite a payment.');
      }
      if (row.errors.length) return { ...row, status: 'error' };
      if (matches.length) {
        const stored = matches[0];
        row.existingLedgerId = stored.ledgerId;
        if (source.status !== 'duplicate' && stored.importKey && isPayment(stored) && !reported.has(stored.ledgerId)) {
          row.status = 'resume';
          row.message = 'The ledger entry is already saved. Import again to finish its payment history without another credit.';
        } else {
          row.status = 'duplicate';
          row.message = 'Already recorded. This upload will not change its balance.';
        }
      }
      return row;
    });
  }

  async function reportPayment(ledger) {
    if (!isPayment(ledger)) return;
    await Contribution.updateOne({ contributionId: ledger.ledgerId }, { $setOnInsert: {
      contributionId: ledger.ledgerId, memberId: ledger.memberId, amount: ledger.credit,
      paymentDate: ledger.transactionDate, dueDate: ledger.transactionDate,
      status: 'paid', paymentMethod: ledger.paymentMethod,
      referenceNumber: ledger.referenceId || ledger.ledgerId, notes: ledger.description,
    } }, { upsert: true, runValidators: true });
  }

  async function importRows(rows, recordedBy) {
    return withMemberPaymentLocks(rows.filter(row => !row.errors.length).map(row => row.entry.memberId), async () => {
      const checked = await preview(rows);
      if (checked.some(row => row.errors.length)) return { blocked: true, rows: checked };
      const ready = checked.filter(row => ['ready', 'resume'].includes(row.status));
      const balances = ready.length ? await getLatestBalancesByMember([...new Set(ready.map(row => row.entry.memberId))]) : new Map();
      for (const row of checked) {
        if (row.status === 'duplicate') { row.status = 'skipped'; continue; }
        const entry = row.entry;
        try {
          let ledger;
          if (row.status === 'resume') {
            ledger = await Ledger.findOne({ ledgerId: row.existingLedgerId });
            if (!ledger) throw new Error('Saved ledger entry is no longer available.');
          } else {
            const balance = Math.round(((balances.get(entry.memberId) || 0) + entry.credit - entry.debit) * 100) / 100;
            ledger = new Ledger({
              ledgerId: entry.ledgerId || importKeyOf(entry), importKey: importKeyOf(entry),
              memberId: entry.memberId, transactionType: entry.transactionType,
              transactionDate: new Date(entry.transactionDate), description: entry.description,
              credit: entry.credit, debit: entry.debit, balance, referenceId: entry.referenceId,
              paymentMethod: entry.paymentMethod, recordedBy,
            });
            try {
              await ledger.save();
              // Failed saves must not affect the next row's running balance.
              balances.set(entry.memberId, balance);
            } catch (error) {
              if (error.code !== 11000) throw error;
              const stored = await Ledger.findOne({ $or: [{ importKey: importKeyOf(entry) }, { ledgerId: ledger.ledgerId }] });
              if (!stored || !sameEntry(normalizedLedger(stored.toObject ? stored.toObject() : stored), entry)) throw error;
              await reportPayment(stored);
              row.status = 'skipped';
              row.message = 'Already recorded by another upload. No duplicate was saved.';
              const latest = await getLatestBalancesByMember([entry.memberId]);
              balances.set(entry.memberId, latest.get(entry.memberId) || 0);
              continue;
            }
          }
          await reportPayment(ledger);
          row.status = 'imported';
          row.ledgerId = ledger.ledgerId;
          row.balance = ledger.balance;
        } catch (error) {
          console.error('Ledger import row needs retry:', error.message);
          row.status = 'failed';
          row.errors.push('Could not complete this entry. Preview and upload the same CSV again; saved entries will not be recorded twice.');
        }
      }
      return { blocked: false, rows: checked };
    });
  }
  return { preview, importRows };
}

module.exports = { createLedgerImportService, importKeyOf, summarize };
