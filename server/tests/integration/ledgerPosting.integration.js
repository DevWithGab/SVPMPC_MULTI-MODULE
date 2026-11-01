// Opt-in: TEST_MONGODB_URI=... node --test tests/integration/ledgerPosting.integration.js
// Always uses and removes a newly named database; never loads application .env.
const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { fork } = require('node:child_process');
const path = require('node:path');
const mongoose = require('mongoose');

test('seven API processes post mixed transactions without losing any member balance', {
  skip: !process.env.TEST_MONGODB_URI, timeout: 60000,
}, async t => {
  assert.notEqual(process.env.NODE_ENV, 'production', 'integration tests must not run in production mode');
  const dbName = 'svpmpc_posting_test_' + randomUUID().replaceAll('-', '');
  await mongoose.connect(process.env.TEST_MONGODB_URI, { dbName, autoIndex: false, autoCreate: false });
  const children = [];
  t.after(async () => {
    await Promise.all(children.map(child => new Promise(resolve => {
      if (child.exitCode !== null || child.signalCode) return resolve();
      child.once('exit', resolve);
      child.kill();
    })));
    assert.equal(mongoose.connection.name, dbName);
    assert.match(dbName, /^svpmpc_posting_test_[a-f0-9]+$/);
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });
  const Member = require('../../shared/models/Member');
  const Ledger = require('../../modules/mortuary/models/Ledger');
  const Claim = require('../../modules/mortuary/models/Claim');
  const Contribution = require('../../modules/mortuary/models/Contribution');
  const PaymentImport = require('../../modules/mortuary/models/PaymentImport');
  const AuditLog = require('../../shared/models/AuditLog');
  await Promise.all([Member, Ledger, Claim, Contribution, PaymentImport, AuditLog].map(Model => Model.createIndexes()));
  for (let i = 1; i <= 2; i++) {
    await Member.create({ memberId: `TEST-MEMBER-${i}`, memberName: 'Integration fixture', barangay: 'Sample', address: 'Sample' });
    // Legacy rows deliberately have no postingParent, proving upgrades start
    // from existing financial history without a balance migration.
    await Ledger.create({ ledgerId: `OPEN-${i}`, memberId: `TEST-MEMBER-${i}`, transactionType: 'adjustment',
      description: 'Opening balance', credit: 1000, debit: 0, balance: 1000, createdAt: new Date('2020-01-01') });
    await Claim.create({ claimId: `TEST-CLAIM-${i}`, memberId: `DECEASED-${i}`, memberName: `Deceased fixture ${i}`,
      beneficiaryId: `BEN-${i}`, beneficiaryName: 'Test beneficiary', beneficiaryRelationship: 'Spouse',
      beneficiaryContact: '09123456789', dateOfDeath: new Date('2026-10-01'), referenceNumber: `CLAIM-REF-${i}`, status: 'pending_deduction' });
  }
  const roles = ['manual', 'payments', 'ledger', 'blanket', 'claim1', 'claim2', 'correction'];
  const heads = new Set();
  let conflicts = 0;
  const ready = [], done = [];
  for (const role of roles) {
    const child = fork(path.join(__dirname, '../fixtures/ledgerPostingWorker.js'), [], {
      env: { ...process.env, POSTING_TEST_DATABASE: dbName, POSTING_TEST_ROLE: role },
      stdio: ['ignore', 'pipe', 'pipe', 'ipc'], windowsHide: true,
    });
    children.push(child);
    let output = '';
    child.stdout.on('data', data => { output += data; });
    child.stderr.on('data', data => { output += data; });
    ready.push(new Promise((resolve, reject) => {
      child.on('message', message => {
        if (message.type === 'ready') resolve();
        if (message.type === 'head') {
          heads.add(role);
          if (heads.size === roles.length) children.forEach(worker => worker.send('release-heads'));
        }
        if (message.type === 'done') conflicts += message.conflicts;
      });
      child.once('error', reject);
      child.once('exit', code => { if (code !== 0) reject(new Error(role + ': ' + output)); });
    }));
    done.push(new Promise(resolve => child.once('exit', code => resolve({ role, code, output }))));
  }
  await Promise.all(ready);
  children.forEach(child => child.send('start'));
  const results = await Promise.all(done);
  for (const result of results) assert.equal(result.code, 0, result.role + ': ' + result.output);
  assert.ok(conflicts > 0, 'the test must actually produce database parent conflicts');
  const rows = await Ledger.find({}).sort({ createdAt: 1, _id: 1 }).lean();
  assert.equal(rows.length, 45);
  for (const [memberId, finalBalance] of [['TEST-MEMBER-1', 1065], ['TEST-MEMBER-2', 925]]) {
    const memberRows = rows.filter(row => row.memberId === memberId);
    let balance = 0;
    for (const [index, row] of memberRows.entries()) {
      balance = Math.round((balance + row.credit - row.debit) * 100) / 100;
      assert.equal(row.balance, balance, `${memberId}: running balance for ${row.ledgerId}`);
      if (index) assert.equal(row.postingParent, 'ledger:' + memberRows[index - 1].ledgerId);
    }
    assert.equal(balance, finalBalance);
  }
  assert.equal(await Contribution.countDocuments(), 24);
  assert.equal(await Claim.countDocuments({ status: 'deduction_processed' }), 2);
  assert.equal(await AuditLog.countDocuments({ action: 'ledger_corrected' }), 1);
  t.diagnostic(`Verified 45 ledger rows across seven processes, including ${conflicts} competing-parent retries.`);
});
