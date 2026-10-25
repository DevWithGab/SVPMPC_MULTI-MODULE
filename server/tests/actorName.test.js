const test = require('node:test');
const assert = require('node:assert/strict');
const { actorName, displayActorNames, invalidateStaffNames } = require('../shared/utils/actorName');

test('new records store the full name, falling back to the username', () => {
  assert.equal(actorName({ fullName: '  Drexelle Magbual ', username: 'mortuary.treasurer' }), 'Drexelle Magbual');
  assert.equal(actorName({ fullName: '', username: 'attendance.scanner' }), 'attendance.scanner');
  assert.equal(actorName(undefined, 'admin'), 'admin');
});

const staff = [
  { username: 'mortuary.treasurer', fullName: 'Drexelle Magbual' },
  { username: 'mortuary.admin', fullName: 'Monina Guzman' },
];
const User = { find() { return { select: () => ({ lean: async () => staff }) }; } };

const respond = async (body, path = '/mortuary/claims') => {
  invalidateStaffNames();
  let sent;
  const res = { json(value) { sent = value; return this; } };
  await new Promise(resolve => displayActorNames(User)({ path }, res, resolve));
  res.json(body);
  return sent;
};

test('API responses show full names in every actor field, including nested history', async () => {
  const sent = await respond({ data: [{
    claimId: 'CLM-1',
    createdBy: 'mortuary.admin',
    verification: { verifiedBy: 'mortuary.admin' },
    payout: { releasedBy: 'mortuary.treasurer' },
    statusHistory: [{ status: 'released', changedBy: 'mortuary.treasurer' }],
    memberName: 'mortuary.admin',
  }] });
  const claim = sent.data[0];
  assert.equal(claim.createdBy, 'Monina Guzman');
  assert.equal(claim.verification.verifiedBy, 'Monina Guzman');
  assert.equal(claim.payout.releasedBy, 'Drexelle Magbual');
  assert.equal(claim.statusHistory[0].changedBy, 'Drexelle Magbual');
  assert.equal(claim.memberName, 'mortuary.admin', 'non-actor fields are never touched');
});

test('names without a matching account, and the original objects, are left as they are', async () => {
  const original = { recordedBy: 'attendance.scanner', scannedBy: 'Juan Cruz' };
  const sent = await respond(original);
  assert.deepEqual(sent, { recordedBy: 'attendance.scanner', scannedBy: 'Juan Cruz' });
  assert.notEqual(sent, original);
});
