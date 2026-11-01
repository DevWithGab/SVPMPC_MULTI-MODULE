// Only launched by ledgerPosting.integration.js against its isolated database.
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const databaseName = process.env.POSTING_TEST_DATABASE;
if (!process.send || !/^svpmpc_posting_test_[a-f0-9]+$/.test(databaseName || '') || !process.env.TEST_MONGODB_URI) {
  throw new Error('This worker requires the isolated posting integration test.');
}
let start, release;
const started = new Promise(resolve => { start = resolve; });
const released = new Promise(resolve => { release = resolve; });
process.on('message', message => {
  if (message === 'start') start();
  if (message === 'release-heads') release();
});
const response = () => ({ status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } });
const user = { userId: 'TEST-FINANCE', username: 'test.finance', fullName: 'Test Finance', role: 'finance_officer' };
const request = body => ({ body, user, get: () => '', ip: '127.0.0.1' });

(async () => {
  await mongoose.connect(process.env.TEST_MONGODB_URI, { dbName: databaseName, autoIndex: false, autoCreate: false });
  const Ledger = require('../../modules/mortuary/models/Ledger');
  const Member = require('../../shared/models/Member');
  const Contribution = require('../../modules/mortuary/models/Contribution');
  const PaymentImport = require('../../modules/mortuary/models/PaymentImport');
  let blocked = false, conflicts = 0;
  const findOne = Ledger.findOne;
  Ledger.findOne = function (filter, ...args) {
    const query = findOne.call(this, filter, ...args);
    if (filter.memberId === 'TEST-MEMBER-1' && Object.keys(filter).length === 1) {
      const exec = query.exec.bind(query);
      query.exec = async () => {
        const head = await exec();
        if (!blocked) {
          blocked = true;
          process.send({ type: 'head' });
          await released;
        }
        return head;
      };
    }
    return query;
  };
  const save = Ledger.prototype.save;
  Ledger.prototype.save = async function (...args) {
    try { return await save.apply(this, args); }
    catch (error) { if (error.code === 11000 && error.keyPattern?.postingParent) conflicts++; throw error; }
  };
  process.send({ type: 'ready' });
  await started;
  switch (process.env.POSTING_TEST_ROLE) {
    case 'manual': {
      const { recordContribution } = require('../../modules/mortuary/controllers/contributionController');
      for (let i = 0; i < 12; i++) {
        const res = response();
        await recordContribution(request({ memberId: 'TEST-MEMBER-1', amount: 10, referenceNumber: `MANUAL-${i}`, paymentDate: '2026-10-01' }), res);
        assert.equal(res.code, 201, JSON.stringify(res.body));
      }
      break;
    }
    case 'payments': {
      const { createPaymentImportService } = require('../../modules/mortuary/services/paymentImportService');
      const { parsePaymentCsv } = require('../../modules/mortuary/utils/paymentCsv');
      const service = createPaymentImportService({ Member, Ledger, Contribution, PaymentImport });
      const csv = 'member_id,amount,payment_date,reference_number\n' +
        Array.from({ length: 12 }, (_, i) => `TEST-MEMBER-1,7,2026-10-01,CSV-${i}`).join('\n');
      const result = await service.importRows(parsePaymentCsv(csv), 'Test Finance');
      assert.ok(result.rows.every(row => row.status === 'imported'), JSON.stringify(result));
      break;
    }
    case 'ledger': {
      const { createLedgerImportService } = require('../../modules/mortuary/services/ledgerImportService');
      const { validateLedgerEntries } = require('../../modules/mortuary/utils/ledgerCsv');
      const service = createLedgerImportService({ Member, Ledger, Contribution });
      const rows = validateLedgerEntries(Array.from({ length: 12 }, (_, i) => ({
        memberId: 'TEST-MEMBER-1', transactionDate: '2026-10-01', credit: 3, debit: 0,
        transactionType: 'adjustment', description: 'Integration credit', referenceId: `LEDGER-${i}`, paymentMethod: 'cash',
      })));
      const result = await service.importRows(rows, 'Test Finance');
      assert.ok(result.rows.every(row => row.status === 'imported'), JSON.stringify(result));
      break;
    }
    case 'blanket': {
      const res = response();
      await require('../../modules/mortuary/controllers/deductionController').processAutomaticDeduction(request({ deceasedMemberName: 'Integration death' }), res);
      assert.equal(res.code, 200);
      assert.ok(res.body.data.deductionResults.every(row => !row.error), JSON.stringify(res.body));
      break;
    }
    case 'claim1':
    case 'claim2': {
      const res = response();
      await require('../../modules/mortuary/controllers/treasurerClaimController').processDeductionBatch(
        request({ claimIds: [process.env.POSTING_TEST_ROLE === 'claim1' ? 'TEST-CLAIM-1' : 'TEST-CLAIM-2'] }), res);
      assert.equal(res.code, 200, JSON.stringify(res.body));
      break;
    }
    case 'correction': {
      const { createLedgerCorrectionService } = require('../../modules/mortuary/services/ledgerCorrectionService');
      const service = createLedgerCorrectionService({ Ledger, Contribution, AuditLog: require('../../shared/models/AuditLog') });
      let corrected = false;
      for (let attempt = 0; attempt < 50 && !corrected; attempt++) {
        const latest = await Ledger.findOne({ memberId: 'TEST-MEMBER-1' }).sort({ createdAt: -1, _id: -1 });
        try {
          await service.correct('TEST-MEMBER-1', 'OPEN-1', { amount: 900, expectedAmount: 1000, expectedBalance: latest.balance }, user);
          corrected = true;
        } catch (error) {
          if (error.status !== 409) throw error;
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      }
      assert.ok(corrected, 'correction should succeed after refreshing its expected balance');
      break;
    }
    default: throw new Error('Unknown integration worker');
  }
  process.send({ type: 'done', conflicts });
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  await mongoose.disconnect();
  process.disconnect();
});
