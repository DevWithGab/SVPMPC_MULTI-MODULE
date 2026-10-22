const test = require('node:test');
const assert = require('node:assert/strict');
const { supersedeAndInsert } = require('../shared/utils/versionedSetting');

// supersedeAndInsert backs DeductionSetting/BenefitCapSetting/
// NoticeThresholdSetting: at most one row is ever 'active', enforced by
// each model's own partial unique index. Confirmed live: 6 concurrent
// updates produced 5 successes and 1 raw 500 before the retry loop existed
// — two requests can both read the same active row before either
// supersedes it, and only the unique index (not application logic) stops
// both new rows ending up active.
//
// The fake Model below enforces that same uniqueness constraint against
// one shared, canonical store (`state.docs`), while findOne hands out a
// fresh copy on every call — mutating a copy in memory must not be visible
// to another in-flight caller until .save() actually commits it, exactly
// like two independent Mongoose documents hydrated from two separate
// findOne() calls against a real database. Getting this "fresh copy per
// read" detail right is what makes the race actually happen in this test
// instead of being accidentally serialized away by shared object identity.
function fakeModel(seed = []) {
  const state = { docs: seed.map(d => ({ ...d })) };

  class Doc {
    constructor(data) { Object.assign(this, data); }
    async save(options) {
      this._lastSaveOptions = options;
      const conflictsWithAnotherActive = this.status === 'active' &&
        state.docs.some(d => d.settingId !== this.settingId && d.status === 'active');
      if (conflictsWithAnotherActive) {
        const error = new Error('E11000 duplicate key error'); error.code = 11000; throw error;
      }
      const index = state.docs.findIndex(d => d.settingId === this.settingId);
      const plain = { ...this }; delete plain._lastSaveOptions;
      if (index === -1) state.docs.push(plain);
      else state.docs[index] = plain;
      return this;
    }
  }

  const Model = { findOne: async (query) => {
    const found = state.docs.find(d => d.status === query.status);
    return found ? new Doc({ ...found }) : null;
  } };

  return { state, Model, Doc };
}

let seq = 0;
const nextId = (prefix) => `${prefix}-${++seq}`;

test('updating thresholds preserves omitted message fields and accepts explicitly edited messages', async () => {
  const { Model, Doc } = fakeModel([{ settingId: 'MESSAGES', status: 'active', noticeMessageTemplate: 'First message', finalNoticeMessageTemplate: 'Last message' }]);
  const preserved = await supersedeAndInsert(Model, () => new Doc({ settingId: nextId('S'), status: 'active', targetBalance: 1500 }), { preserveFields: ['noticeMessageTemplate', 'finalNoticeMessageTemplate'] });
  assert.equal(preserved.noticeMessageTemplate, 'First message');
  assert.equal(preserved.finalNoticeMessageTemplate, 'Last message');
  const edited = await supersedeAndInsert(Model, () => new Doc({ settingId: nextId('S'), status: 'active', noticeMessageTemplate: 'Edited message' }), { preserveFields: ['noticeMessageTemplate', 'finalNoticeMessageTemplate'] });
  assert.equal(edited.noticeMessageTemplate, 'Edited message');
  assert.equal(edited.finalNoticeMessageTemplate, 'Last message');
});

test('inserts the first row with nothing to supersede', async () => {
  const { state, Model, Doc } = fakeModel();
  const doc = await supersedeAndInsert(Model, () => new Doc({ settingId: nextId('S'), status: 'active', amount: 25 }));
  assert.equal(state.docs.length, 1);
  assert.equal(state.docs[0].settingId, doc.settingId);
  assert.equal(state.docs[0].status, 'active');
});

test('supersedes the current active row and inserts a new one', async () => {
  const original = { settingId: 'ORIGINAL', status: 'active', amount: 25 };
  const { state, Model, Doc } = fakeModel([original]);
  const newId = nextId('S');
  const doc = await supersedeAndInsert(Model, () => new Doc({ settingId: newId, status: 'active', amount: 50 }));

  assert.equal(doc.settingId, newId);
  const stored = Object.fromEntries(state.docs.map(d => [d.settingId, d]));
  assert.equal(stored.ORIGINAL.status, 'superseded');
  assert.equal(stored.ORIGINAL.supersededBy, newId);
  assert.ok(stored.ORIGINAL.supersededAt instanceof Date);
  assert.equal(stored[newId].status, 'active');
  assert.equal(stored[newId].amount, 50);
});

test('a non-conflict error is not retried and propagates immediately', async () => {
  const { Model } = fakeModel([{ settingId: 'ORIGINAL', status: 'active' }]);
  let attempts = 0;
  const buildNewDoc = () => { attempts += 1; return { save: async () => { throw new Error('validation failed: amount is required'); } }; };
  await assert.rejects(() => supersedeAndInsert(Model, buildNewDoc), /validation failed/);
  assert.equal(attempts, 1, 'a genuine (non-11000) error must not be retried');
});

test('exhausting every retry on a persistent conflict re-throws the last E11000, not an infinite loop', async () => {
  const { Model } = fakeModel([{ settingId: 'ORIGINAL', status: 'active' }]);
  let attempts = 0;
  const buildNewDoc = () => {
    attempts += 1;
    return { save: async () => { const e = new Error('E11000 duplicate key error'); e.code = 11000; throw e; } };
  };
  await assert.rejects(() => supersedeAndInsert(Model, buildNewDoc), (error) => error.code === 11000);
  assert.equal(attempts, 10, 'must stop after exactly MAX_RACE_RETRIES attempts');
});

test('passes validateModifiedOnly through to the superseded row\'s save() only when requested, and never to the new row\'s save()', async () => {
  const runWith = async (validateModifiedOnly) => {
    const { Model, Doc } = fakeModel([{ settingId: 'ORIGINAL', status: 'active' }]);
    const savedOptionsBySettingId = {};
    const originalSave = Doc.prototype.save;
    Doc.prototype.save = async function (options) { savedOptionsBySettingId[this.settingId] = options; return originalSave.call(this, options); };
    const newId = nextId('S');
    await supersedeAndInsert(Model, () => new Doc({ settingId: newId, status: 'active' }), validateModifiedOnly !== undefined ? { validateModifiedOnly } : undefined);
    return { originalOptions: savedOptionsBySettingId.ORIGINAL, newOptions: savedOptionsBySettingId[newId] };
  };

  const withTrue = await runWith(true);
  assert.deepEqual(withTrue.originalOptions, { validateModifiedOnly: true });
  assert.equal(withTrue.newOptions, undefined, 'the brand-new row is always saved with no options, regardless of the flag');

  const withDefault = await runWith(undefined);
  assert.equal(withDefault.originalOptions, undefined, 'the superseded row gets no options unless validateModifiedOnly was explicitly requested');
});

test('6 truly concurrent updates against the same setting all succeed and exactly one row ends up active', async () => {
  const original = { settingId: 'ORIGINAL', status: 'active', amount: 10 };
  const { state, Model, Doc } = fakeModel([original]);

  const CONCURRENT_REQUESTS = 6;
  const newIds = Array.from({ length: CONCURRENT_REQUESTS }, (_, i) => `RACE-${i}`);
  const results = await Promise.all(
    newIds.map(id => supersedeAndInsert(Model, () => new Doc({ settingId: id, status: 'active', amount: 10 + Number(id.split('-')[1]) })))
  );

  assert.equal(results.length, CONCURRENT_REQUESTS, 'every concurrent caller must eventually succeed, not crash with a raw duplicate-key error');

  const activeRows = state.docs.filter(d => d.status === 'active');
  assert.equal(activeRows.length, 1, 'exactly one row must end up active no matter how many requests raced for it');
  assert.equal(state.docs.length, 1 + CONCURRENT_REQUESTS, 'the original row plus all 6 new rows must each exist exactly once — none lost, none duplicated');

  // Every superseded row's supersededBy must point to a row that actually
  // exists — a dangling pointer would mean a retry corrupted a previous
  // write. (This does NOT assert the chain is a single unbroken line with
  // no forks: a retry's failed first attempt can leave a stale-but-valid
  // supersededBy pointer on whatever was active at that moment, from
  // before that same attempt's own insert lost the race and had to retry
  // against a newer row. The function's actual guarantee — see the file
  // comment — is "no crash, exactly one active row," not a perfectly
  // accurate historical breadcrumb trail under concurrent retries.)
  const bySettingId = Object.fromEntries(state.docs.map(d => [d.settingId, d]));
  for (const doc of state.docs) {
    if (doc.status === 'superseded') {
      assert.ok(bySettingId[doc.supersededBy], `${doc.settingId}.supersededBy ("${doc.supersededBy}") must point to a row that exists`);
    }
  }
});
