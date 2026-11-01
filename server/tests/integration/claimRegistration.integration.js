// Opt-in, isolated DB only. Never loads application .env.
const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { fork } = require('node:child_process');
const path = require('node:path');
const mongoose = require('mongoose');

test('MongoDB enforces claim eligibility across processes and recovers interrupted filing', {
  skip: !process.env.TEST_MONGODB_URI, timeout: 60000,
}, async t => {
  assert.notEqual(process.env.NODE_ENV, 'production');
  const dbName = 'svpmpc_claim_registration_test_' + randomUUID().replaceAll('-', '');
  await mongoose.connect(process.env.TEST_MONGODB_URI, { dbName, autoIndex: false, autoCreate: false });
  const children = [];
  t.after(async () => {
    await Promise.all(children.map(child => new Promise(resolve => {
      if (child.exitCode !== null || child.signalCode) return resolve();
      child.once('exit', resolve); child.kill();
    })));
    assert.equal(mongoose.connection.name, dbName);
    assert.match(dbName, /^svpmpc_claim_registration_test_[a-f0-9]+$/);
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });
  const Member = require('../../shared/models/Member');
  const Claim = require('../../modules/mortuary/models/Claim');
  const Beneficiary = require('../../modules/mortuary/models/Beneficiary');
  const AuditLog = require('../../shared/models/AuditLog');
  await Promise.all([Member, Claim, Beneficiary, AuditLog].map(Model => Model.createIndexes()));
  const payload = memberId => ({ memberId, beneficiaryId: 'BEN-' + memberId, dateOfDeath: '2026-10-01' });
  for (const memberId of ['SAME', 'DIFFERENT', 'BEFORE', 'AFTER', 'INACTIVE']) {
    await Member.create({ memberId, memberName: 'Isolated fixture', status: 'active', barangay: 'Sample', address: 'Sample', qrCodeActive: true });
    await Beneficiary.create({ beneficiaryId: 'BEN-' + memberId, memberId, memberName: 'Isolated fixture',
      beneficiaryName: 'Test Beneficiary', relationship: 'Spouse', contactNumber: '09123456789', isActive: memberId !== 'INACTIVE' });
  }

  function worker(mode, input) {
    const child = fork(path.join(__dirname, '../fixtures/claimRegistrationWorker.js'), [], {
      env: { ...process.env, CLAIM_TEST_DATABASE: dbName, CLAIM_TEST_MODE: mode, CLAIM_TEST_INPUT: JSON.stringify(input || {}) },
      stdio: ['ignore', 'pipe', 'pipe', 'ipc'], windowsHide: true,
    });
    children.push(child);
    let output = '', result;
    child.stdout.on('data', data => { output += data; });
    child.stderr.on('data', data => { output += data; });
    let readyResolve, interruptResolve;
    const ready = new Promise(resolve => { readyResolve = resolve; });
    const interrupted = new Promise(resolve => { interruptResolve = resolve; });
    child.on('message', message => {
      if (message.type === 'ready') readyResolve();
      if (message.type === 'interrupted') interruptResolve();
      if (message.type === 'result') result = message;
    });
    const done = new Promise(resolve => child.once('exit', (code, signal) => resolve({ code, signal, output, result })));
    return { child, ready, interrupted, done };
  }
  const same = Array.from({ length: 4 }, () => worker('register', payload('SAME')));
  const different = Array.from({ length: 4 }, (_, index) => worker('register', { ...payload('DIFFERENT'), remarks: 'Submission ' + index }));
  const competing = [...same, ...different];
  await Promise.all(competing.map(item => item.ready));
  competing.forEach(item => item.child.send('start'));
  const results = await Promise.all(competing.map(item => item.done));
  for (const result of results) assert.equal(result.code, 0, result.output);
  assert.equal(results.slice(0, 4).filter(result => result.result.created).length, 1);
  assert.equal(new Set(results.slice(0, 4).map(result => result.result.claimId)).size, 1);
  assert.equal(results.slice(4).filter(result => result.result.status === 409).length, 3);
  assert.equal(await Claim.countDocuments({ memberId: 'SAME', status: { $ne: 'rejected' } }), 1);
  assert.equal(await Claim.countDocuments({ memberId: 'DIFFERENT', status: { $ne: 'rejected' } }), 1);

  for (const [mode, memberId, expectedStatus] of [
    ['crash-before-member', 'BEFORE', 'active'], ['crash-after-member', 'AFTER', 'deceased'],
  ]) {
    const interrupted = worker(mode, payload(memberId));
    await interrupted.ready; interrupted.child.send('start'); await interrupted.interrupted;
    interrupted.child.kill(); await interrupted.done;
    assert.equal((await Claim.findOne({ memberId })).status, 'filing');
    assert.equal((await Member.findOne({ memberId })).status, expectedStatus);
    const recovery = worker('recover');
    await recovery.ready; recovery.child.send('start');
    const recovered = await recovery.done;
    assert.equal(recovered.code, 0, recovered.output);
    assert.equal((await Claim.findOne({ memberId })).status, 'pending_requirements');
    const member = await Member.findOne({ memberId });
    assert.equal(member.status, 'deceased');
    assert.equal(member.qrCodeActive, false);
    assert.equal(await Claim.countDocuments({ memberId }), 1);
  }
  const inactive = worker('register', payload('INACTIVE'));
  await inactive.ready; inactive.child.send('start');
  assert.equal((await inactive.done).result.status, 404);
  assert.equal(await Claim.countDocuments({ memberId: 'INACTIVE' }), 0);
  assert.equal((await Member.findOne({ memberId: 'INACTIVE' })).status, 'active');
  assert.equal(await AuditLog.countDocuments({ action: 'claim_created' }), 4);

  const existing = await Claim.findOne({ memberId: 'SAME' }).lean();
  const { _id, __v, ...copy } = existing;
  await assert.rejects(Claim.create({ ...copy, claimId: 'FORBIDDEN-DUPLICATE' }), error => error.code === 11000);
  await Claim.updateOne({ claimId: existing.claimId }, { $set: { status: 'rejected' } });
  await Claim.create({ ...copy, claimId: 'ALLOWED-REFILING', status: 'pending_requirements' });
  assert.equal(await Claim.countDocuments({ memberId: 'SAME', status: { $ne: 'rejected' } }), 1);
  t.diagnostic('Verified eight competing processes, hard crashes on both sides of the member write, active-beneficiary enforcement, and rejection/refiling index behavior.');
});
