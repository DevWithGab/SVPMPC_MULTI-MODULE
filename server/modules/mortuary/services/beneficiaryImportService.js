const { v4: uuidv4 } = require('uuid');

/* Hindi ito parang payments na may double-credit risk - pag na-re-run ulit
ang same row, supersede lang ulit ang current active record, tulad din ng
ginagawa ng "Update Beneficiary" endpoint sa second submission. Kaya wala
nang reservation/idempotency-key machinery dito, member-existence checks
lang up front (preview) at yung same supersede-then-insert write na
ginagamit ni beneficiaryController.updateBeneficiary. */
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
    /* Sequential, hindi parallel - puwede pa ring magkaroon ng race ang dalawang
    row sa parehong upload (kahit pumasa na sa CSV's duplicate-Passbook-No.
    check) kung may concurrent edit mula sa Update Beneficiary screen; kaya
    isa-isang row ang pinoproseso para atomic yung supersede-then-insert ng
    bawat row kumpara sa iba pang row sa batch na ito. */
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
