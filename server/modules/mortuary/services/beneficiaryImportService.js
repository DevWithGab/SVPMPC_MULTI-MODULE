const { v4: uuidv4 } = require('uuid');

// Unlike payments, registering a beneficiary has nothing to double-credit —
// re-running the same row just supersedes the current active record again,
// exactly what the single "Update Beneficiary" endpoint already does on a
// second submission. So there's no reservation/idempotency-key machinery
// here, only member-existence checks up front (preview) and the same
// supersede-then-insert write beneficiaryController.updateBeneficiary uses.
function createBeneficiaryImportService({ Member, Beneficiary }) {
  async function preview(rows) {
    const valid = rows.filter(row => !row.errors.length);
    const memberIds = [...new Set(valid.map(row => row.entry.memberId))];
    const members = memberIds.length
      ? await Member.find({ memberId: { $in: memberIds } }).lean()
      : [];
    return rows.map(row => {
      const errors = [...row.errors];
      const member = members.find(item => item.memberId === row.entry.memberId);
      if (!errors.length && !member) errors.push('Passbook No. was not found');
      return { ...row, memberName: member?.memberName || '', errors, status: errors.length ? 'error' : 'ready' };
    });
  }

  async function record(row, updatedBy) {
    const member = await Member.findOne({ memberId: row.entry.memberId });
    if (!member) throw new Error('Passbook No. was not found');

    const currentActive = await Beneficiary.findOne({ memberId: row.entry.memberId, isActive: true });
    if (currentActive) {
      currentActive.isActive = false;
      currentActive.effectiveTo = new Date();
      await currentActive.save();
    }

    const beneficiary = await new Beneficiary({
      beneficiaryId: uuidv4(),
      memberId: row.entry.memberId,
      memberName: member.memberName,
      beneficiaryName: row.entry.beneficiaryName,
      relationship: row.entry.relationship,
      contactNumber: row.entry.contactNumber,
      address: row.entry.address,
      notes: row.entry.notes,
      isActive: true,
      effectiveFrom: new Date(),
      updatedBy,
    }).save();

    return { ...row, memberName: member.memberName, errors: [], status: 'imported', beneficiaryId: beneficiary.beneficiaryId };
  }

  async function importRows(rows, updatedBy) {
    const checked = await preview(rows);
    if (checked.some(row => row.errors.length)) return { blocked: true, rows: checked };
    const results = [];
    // Sequential, not parallel — two rows in the same upload could (after the
    // CSV's own duplicate-Passbook-No. check) still race the same member via
    // a concurrent edit from the single Update Beneficiary screen; running
    // one row at a time keeps each row's own supersede-then-insert atomic
    // relative to the others in this batch.
    for (const row of rows) {
      try { results.push(await record(row, updatedBy)); }
      catch (error) {
        console.error('Bulk beneficiary row failed:', error.message);
        results.push({ ...row, status: 'failed', errors: ['Could not register this beneficiary. Re-upload the same CSV to retry.'] });
      }
    }
    return { blocked: false, rows: results };
  }

  return { preview, importRows };
}

module.exports = { createBeneficiaryImportService };
