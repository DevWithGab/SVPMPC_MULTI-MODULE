const { createHash } = require('node:crypto');
const { withMemberPaymentLock } = require('../utils/paymentLock');

const paymentId = entry => `CSV-${createHash('sha256').update(JSON.stringify([entry.memberId, entry.referenceNumber])).digest('hex')}`;
const samePayment = (stored, entry) =>
  Number(stored.amount) === entry.amount &&
  new Date(stored.paymentDate).toISOString().slice(0, 10) === entry.paymentDate &&
  stored.paymentMethod === entry.paymentMethod;

function createPaymentImportService({ Member, Contribution, Ledger, PaymentImport, getLatestBalance, checkAndNotify }) {
  async function preview(rows) {
    const valid = rows.filter(row => !row.errors.length);
    const memberIds = [...new Set(valid.map(row => row.entry.memberId))];
    const ids = valid.map(row => paymentId(row.entry));
    const [members, contributions, reservations, ledgers] = valid.length ? await Promise.all([
      Member.find({ memberId: { $in: memberIds } }).lean(),
      Contribution.find({ memberId: { $in: memberIds }, referenceNumber: { $in: valid.map(row => row.entry.referenceNumber) } }).lean(),
      PaymentImport.find({ _id: { $in: ids } }).lean(),
      Ledger.find({ ledgerId: { $in: ids } }).lean(),
    ]) : [[], [], [], []];
    return rows.map(row => {
      const errors = [...row.errors];
      const member = members.find(item => item.memberId === row.entry.memberId);
      let status = 'ready';
      if (!errors.length) {
        if (!member) errors.push('Member ID was not found');
        const id = paymentId(row.entry);
        const reservation = reservations.find(item => item._id === id);
        const existing = contributions.filter(item => item.memberId === row.entry.memberId && item.referenceNumber === row.entry.referenceNumber);
        if ((reservation && !samePayment(reservation, row.entry)) || existing.some(item => !samePayment(item, row.entry))) {
          errors.push('This reference already belongs to a payment with a different amount, date, or method');
        } else if (existing.length && (!reservation || ledgers.some(item => item.ledgerId === id))) {
          status = 'duplicate';
        } else if (reservation) status = 'resume';
      }
      return { ...row, memberName: member?.memberName || '', errors, status: errors.length ? 'error' : status };
    });
  }

  async function record(row, recordedBy) {
    return withMemberPaymentLock(row.entry.memberId, async () => {
      const [checked] = await preview([row]);
      if (checked.errors.length) throw new Error(checked.errors.join('; '));
      if (checked.status === 'duplicate') return { ...checked, status: 'skipped' };
      const id = paymentId(row.entry);
      // The reservation is immutable, so even retries after process restart use
      // the original payment and actor. MongoDB's _id index enforces uniqueness.
      let reservation;
      try {
        reservation = await PaymentImport.findOneAndUpdate(
          { _id: id }, { $setOnInsert: { ...row.entry, recordedBy } },
          { upsert: true, new: true, runValidators: true },
        );
      } catch (error) {
        if (error.code !== 11000) throw error;
        reservation = await PaymentImport.findById(id);
      }
      if (!samePayment(reservation, row.entry)) throw new Error('This reference was just used for a different payment. Preview again.');
      let ledger = await Ledger.findOne({ ledgerId: id });
      if (!ledger) {
        const balance = await getLatestBalance(reservation.memberId);
        const newBalance = Math.round((balance + reservation.amount) * 100) / 100;
        ledger = await Ledger.findOneAndUpdate({ ledgerId: id }, { $setOnInsert: {
          ledgerId: id, memberId: reservation.memberId,
          transactionType: 'contribution', description: `Contribution payment - cash (CSV: ${reservation.referenceNumber})`,
          credit: reservation.amount, debit: 0, balance: newBalance,
          referenceId: id, paymentMethod: 'cash', recordedBy: reservation.recordedBy,
          transactionDate: new Date(),
        } }, { upsert: true, new: true, runValidators: true });
      }
      // Ledger first: if this write fails, re-uploading finishes the contribution
      // record using the same IDs and leaves the existing credit untouched.
      await Contribution.updateOne({ contributionId: id }, { $setOnInsert: {
        contributionId: id, memberId: reservation.memberId, amount: reservation.amount,
        paymentDate: new Date(reservation.paymentDate), dueDate: new Date(reservation.paymentDate),
        status: 'paid', paymentMethod: 'cash', referenceNumber: reservation.referenceNumber,
        notes: reservation.notes,
      } }, { upsert: true, runValidators: true });
      try {
        const member = await Member.findOne({ memberId: reservation.memberId });
        await checkAndNotify(reservation.memberId, member.memberName, member.phoneNumber,
          Math.round((ledger.balance - reservation.amount) * 100) / 100, ledger.balance, 'contribution', id);
      } catch (error) {
        console.error('Bulk payment notification failed:', error.message);
      }
      return { ...checked, status: 'imported', contributionId: id, balance: ledger.balance };
    });
  }

  async function importRows(rows, recordedBy) {
    const checked = await preview(rows);
    if (checked.some(row => row.errors.length)) return { blocked: true, rows: checked };
    const results = [];
    for (const row of rows) {
      try { results.push(await record(row, recordedBy)); }
      catch (error) {
        console.error('Bulk payment row needs retry:', error.message);
        results.push({ ...row, status: 'failed', errors: ['Could not complete this payment. Re-upload the same CSV to retry safely.'] });
      }
    }
    return { blocked: false, rows: results };
  }
  return { preview, importRows };
}

module.exports = { createPaymentImportService, paymentId };
