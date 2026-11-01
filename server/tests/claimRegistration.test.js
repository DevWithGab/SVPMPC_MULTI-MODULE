const test = require('node:test');
const assert = require('node:assert/strict');
const ClaimSchema = require('../modules/mortuary/models/Claim');
const { createClaimRegistrationService } = require('../modules/mortuary/services/claimRegistrationService');
const pause = () => new Promise(resolve => setImmediate(resolve));
const input = { memberId: 'M-1', beneficiaryId: 'B-1', dateOfDeath: '2026-10-01' };
const actor = { userId: 'STAFF-1', userName: 'Actual Officer', userRole: 'claims_officer' };

function database() {
  const state = {
    members: [{ memberId: 'M-1', memberName: 'Original Name', status: 'active', qrCodeActive: true }],
    beneficiaries: [{ beneficiaryId: 'B-1', memberId: 'M-1', isActive: true,
      beneficiaryName: 'Beneficiary', relationship: 'Spouse', contactNumber: '09123456789' }],
    claims: [], audits: [], memberWrites: 0, queries: 0,
  };
  const valueAt = (row, path) => path.split('.').reduce((value, key) => value?.[key], row);
  const matches = (row, query) => Object.entries(query).every(([key, value]) => {
    if (key === '$or') return value.some(branch => matches(row, branch));
    const stored = valueAt(row, key);
    if (value?.$ne !== undefined) return stored !== value.$ne;
    if (value?.$type) return typeof stored === value.$type;
    return value == null ? stored == null : stored === value;
  });
  const update = (row, changes) => {
    for (const [path, value] of Object.entries(changes.$set || {})) {
      const parts = path.split('.'), last = parts.pop();
      let target = row;
      for (const part of parts) target = target[part] ||= {};
      target[last] = value;
    }
    if (changes.$push?.statusHistory) row.statusHistory.push(changes.$push.statusHistory);
  };
  class Claim {
    constructor(data) { Object.assign(this, structuredClone(data)); }
    toObject() { return structuredClone(Object.fromEntries(Object.entries(this))); }
    async save() {
      await new ClaimSchema(this).validate();
      await pause();
      if (state.failInsert) { state.failInsert = false; throw new Error('Claim insert failed'); }
      if (state.claims.some(row => row.memberId === this.memberId && row.status !== 'rejected')) {
        throw Object.assign(new Error('Duplicate active claim'), { code: 11000, keyPattern: { memberId: 1 } });
      }
      state.claims.push(this.toObject());
      if (state.loseInsertAck) { state.loseInsertAck = false; throw new Error('Lost claim insert acknowledgement'); }
    }
    static async findOne(query) {
      const row = state.claims.find(row => matches(row, query));
      return row ? new Claim(row) : null;
    }
    static async updateOne(query, changes) {
      const row = state.claims.find(row => matches(row, query));
      if (row) update(row, changes);
      return { matchedCount: row ? 1 : 0 };
    }
    static async findOneAndUpdate(query, changes) {
      if (state.failReady) { state.failReady = false; throw new Error('Ready save failed'); }
      const row = state.claims.find(row => matches(row, query));
      if (!row) return null;
      update(row, changes);
      if (state.loseReadyAck) { state.loseReadyAck = false; throw new Error('Lost ready acknowledgement'); }
      return new Claim(row);
    }
    static find(query) { return { sort: () => ({ limit: async count => state.claims.filter(row => matches(row, query)).slice(0, count).map(row => new Claim(row)) }) }; }
  }
  const Member = {
    findOne: async query => { state.queries++; return structuredClone(state.members.find(row => matches(row, query)) || null); },
    updateOne: async (query, changes) => {
      await pause();
      if (state.failMember) { state.failMember = false; throw new Error('Member update failed'); }
      const member = state.members.find(row => matches(row, query));
      if (member) { update(member, changes); state.memberWrites++; }
      if (state.loseMemberAck) { state.loseMemberAck = false; throw new Error('Lost member acknowledgement'); }
      return { matchedCount: member ? 1 : 0 };
    },
  };
  const Beneficiary = { findOne: async query => structuredClone(state.beneficiaries.find(row => matches(row, query)) || null) };
  const AuditLog = { updateOne: async (query, changes) => {
    await pause();
    if (state.failAudit) throw new Error('Audit unavailable');
    if (!state.audits.some(row => row.logId === query.logId)) state.audits.push(changes.$setOnInsert);
  } };
  const service = () => createClaimRegistrationService({ Claim, Member, Beneficiary, AuditLog,
    now: () => new Date('2026-11-01T04:00:00Z'), logger: { error() {} } });
  return { state, service };
}

test('concurrent identical submissions reserve one claim, complete once, and write one creation audit', async () => {
  const db = database();
  const results = await Promise.all([db.service().register(input, actor), db.service().register(input, actor)]);
  assert.equal(db.state.claims.length, 1);
  assert.equal(results.filter(result => result.created).length, 1);
  assert.equal(results[0].claim.claimId, results[1].claim.claimId);
  assert.equal(db.state.claims[0].status, 'pending_requirements');
  assert.equal(db.state.members[0].status, 'deceased');
  assert.equal(db.state.members[0].qrCodeActive, false);
  assert.equal(db.state.claims[0].statusHistory.filter(row => row.status === 'pending_requirements').length, 1);
  assert.equal(db.state.audits.length, 1);
});

test('concurrent different filings for one member produce one reservation and one conflict', async () => {
  const db = database();
  const results = await Promise.allSettled([
    db.service().register(input, actor), db.service().register({ ...input, remarks: 'Different submission' }, actor),
  ]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(results.find(result => result.status === 'rejected').reason.status, 409);
  assert.equal(db.state.claims.length, 1);
});

test('a member write failure never exposes a ready claim and retry finishes the reserved claim', async () => {
  const db = database(); db.state.failMember = true;
  await assert.rejects(db.service().register(input, actor), /Member update failed/);
  const claimId = db.state.claims[0].claimId;
  assert.equal(db.state.claims[0].status, 'filing');
  assert.equal(db.state.members[0].status, 'active');
  const result = await db.service().register(input, actor);
  assert.equal(result.claim.claimId, claimId);
  assert.equal(db.state.claims.length, 1);
  assert.equal(db.state.members[0].status, 'deceased');
  assert.equal(db.state.claims[0].status, 'pending_requirements');
});

test('failure after member update is recovered without reverting the member or filing another claim', async () => {
  const db = database(); db.state.failReady = true;
  await assert.rejects(db.service().register(input, actor), /Ready save failed/);
  assert.equal(db.state.members[0].status, 'deceased');
  assert.equal(db.state.claims[0].status, 'filing');
  db.state.members[0].memberName = 'Updated Profile';
  await db.service().recover();
  assert.equal(db.state.claims.length, 1);
  assert.equal(db.state.claims[0].status, 'pending_requirements');
  assert.equal(db.state.members[0].memberName, 'Updated Profile');
  assert.equal(db.state.claims[0].memberName, 'Original Name');
});

for (const flag of ['loseInsertAck', 'loseMemberAck', 'loseReadyAck']) {
  test(`${flag}: an ambiguous write can be retried without another claim`, async () => {
    const db = database(); db.state[flag] = true;
    await assert.rejects(db.service().register(input, actor), /acknowledgement/);
    const result = await db.service().register(input, actor);
    assert.equal(db.state.claims.length, 1);
    assert.equal(result.claim.status, 'pending_requirements');
    assert.equal(db.state.members[0].status, 'deceased');
    assert.equal(db.state.audits.length, 1);
  });
}

test('an insert failing before commit leaves the member untouched', async () => {
  const db = database(); db.state.failInsert = true;
  await assert.rejects(db.service().register(input, actor), /insert failed/);
  assert.equal(db.state.claims.length, 0);
  assert.equal(db.state.members[0].status, 'active');
  assert.equal(db.state.memberWrites, 0);
});

test('inactive and other-member beneficiaries cannot create or reserve a claim', async () => {
  for (const changes of [{ isActive: false }, { memberId: 'OTHER' }]) {
    const db = database(); Object.assign(db.state.beneficiaries[0], changes);
    await assert.rejects(db.service().register(input, actor), { status: 404 });
    assert.equal(db.state.claims.length, 0);
    assert.equal(db.state.memberWrites, 0);
  }
});

test('invalid dates and operator-shaped identifiers are rejected before database access', async () => {
  for (const changes of [{ memberId: { $ne: null } }, { beneficiaryId: { $ne: null } },
    { dateOfDeath: '2026-02-30' }, { dateOfDeath: '2100-01-01' }, { dateOfDeath: 'bad date' }]) {
    const db = database();
    await assert.rejects(db.service().register({ ...input, ...changes }, actor), { status: 400 });
    assert.equal(db.state.queries, 0);
    assert.equal(db.state.claims.length, 0);
  }
});

test('a rejected claim releases eligibility for a new filing', async () => {
  const db = database();
  const first = await db.service().register(input, actor);
  db.state.claims[0].status = 'rejected';
  const second = await db.service().register(input, actor);
  assert.notEqual(second.claim.claimId, first.claim.claimId);
  assert.equal(db.state.claims.filter(row => row.status !== 'rejected').length, 1);
});

test('completed retries are read-idempotent and audit failures are repaired independently', async () => {
  const db = database(); db.state.failAudit = true;
  await db.service().register(input, actor);
  assert.equal(db.state.claims[0].status, 'pending_requirements');
  assert.equal(db.state.audits.length, 0);
  db.state.failAudit = false;
  await db.service().recover();
  const writes = db.state.memberWrites;
  const replay = await db.service().register(input, actor);
  assert.equal(replay.created, false);
  assert.equal(db.state.memberWrites, writes);
  assert.equal(db.state.audits.length, 1);
  assert.ok(db.state.claims[0].registration.auditedAt);
});
