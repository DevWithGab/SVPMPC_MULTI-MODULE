const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { createRequire } = require('node:module');

function load(name, dependencies) {
  const filename = require.resolve(`../modules/mortuary/controllers/${name}`);
  const localRequire = createRequire(filename);
  const context = { module: { exports: {} }, console, process, Buffer,
    require: name => Object.hasOwn(dependencies, name) ? dependencies[name] : localRequire(name) };
  context.exports = context.module.exports;
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), context, { filename });
  return context.module.exports;
}
const user = { userId: 'STAFF-1', username: 'real.operator', role: 'admin', id: 'mongo-id' };
const request = body => ({ body, user, params: { claimId: 'C-1', memberId: 'M-1' }, ip: '', get: () => '' });
const response = () => ({ status(code) { this.code = code; return this; }, json(data) { this.data = data; return this; } });

function claimHarness() {
  const audits = [];
  let stored;
  class Claim {
    constructor(data) { Object.assign(this, data); }
    async save() { stored = this; }
    toObject() { return { ...this }; }
    static async findOne(query) { return query.claimId ? stored : null; }
  }
  const member = { memberName: 'Member', async save() {} };
  const controller = load('claimController', {
    '../models/Claim': Claim,
    '../models/Beneficiary': { findOne: async () => ({ beneficiaryName: 'Beneficiary', relationship: 'Spouse', contactNumber: '09171234567' }) },
    '../../../shared/models': { Member: { findOne: async () => member } },
    '../../../shared/services/auditLoggingService': { createAuditLog: async row => audits.push(row) },
  });
  const seed = () => { stored = new Claim({ claimId: 'C-1', status: 'pending_requirements', requirements: new Map([['id', { submitted: true }]]), statusHistory: [] }); return stored; };
  return { controller, audits, seed };
}

test('claim creation ignores forged createdBy in claim, history and audit', async () => {
  const { controller, audits } = claimHarness();
  const res = response();
  await controller.createClaim(request({ memberId: 'M-1', beneficiaryId: 'B-1', dateOfDeath: '2026-10-01', createdBy: 'forged.operator' }), res);
  assert.equal(res.code, 201);
  assert.equal(res.data.data.createdBy, user.username);
  assert.equal(res.data.data.statusHistory[0].changedBy, user.username);
  assert.equal(audits[0].userName, user.username);
  assert.equal(audits[0].userId, user.userId);
});

for (const [action, supplied, field, payload] of [
  ['approveClaim', 'approvedBy', 'approval', {}],
  ['rejectClaim', 'rejectedBy', 'rejection', { reason: 'Missing documents' }],
]) {
  test(`${action} ignores forged operator in claim, history and audit`, async () => {
    const { controller, audits, seed } = claimHarness();
    const claim = seed();
    const res = response();
    await controller[action](request({ ...payload, [supplied]: 'forged.operator' }), res);
    assert.equal(res.code, 200);
    assert.equal(claim[field][supplied], user.username);
    assert.ok(claim.statusHistory.every(row => row.changedBy === user.username));
    assert.equal(audits[0].userName, user.username);
    assert.equal(audits[0].userId, user.userId);
  });
}

test('claim verification ignores forged verifiedBy', async () => {
  const { controller, seed } = claimHarness();
  const claim = seed();
  const res = response();
  await controller.updateVerification(request({ verifiedBy: 'forged.operator', remarks: 'Checked' }), res);
  assert.equal(res.code, 200);
  assert.equal(claim.verification.verifiedBy, user.username);
});

for (const [controllerName, modelName, action, payload] of [
  ['benefitCapSettingController', 'BenefitCapSetting', 'updateCap', { amount: 50000 }],
  ['deductionSettingController', 'DeductionSetting', 'updateRate', { amount: 25 }],
  ['noticeThresholdSettingController', 'NoticeThresholdSetting', 'updateThresholds', {
    targetBalance: 500, notice1Min: 201, notice1Max: 499, notice2Min: 0, notice2Max: 200,
    noticeBodyTemplate: 'Notice', finalNoticeBodyTemplate: 'Final notice',
  }],
]) {
  test(`${action} records the signed-in operator despite forged createdBy`, async () => {
    class Setting { constructor(data) { Object.assign(this, data); } }
    const controller = load(controllerName, {
      [`../models/${modelName}`]: Setting,
      '../../../shared/utils/versionedSetting': { supersedeAndInsert: async (Model, build) => build() },
    });
    const res = response();
    await controller[action](request({ ...payload, createdBy: 'forged.operator' }), res);
    assert.equal(res.code, 201);
    assert.equal(res.data.data.createdBy, user.username);
  });
}

test('single and bulk beneficiary updates ignore forged updatedBy', async () => {
  let importedBy;
  class Beneficiary {
    constructor(data) { Object.assign(this, data); }
    async save() {}
    static async findOne() { return null; }
  }
  const controller = load('beneficiaryController', {
    '../models/Beneficiary': Beneficiary,
    '../../../shared/models': { Member: { findOne: async () => ({ memberName: 'Member' }) } },
    '../utils/beneficiaryCsv': { parseBeneficiaryCsv: () => [] },
    '../services/beneficiaryImportService': { createBeneficiaryImportService: () => ({ importRows: async (rows, actor) => { importedBy = actor; return { rows: [] }; } }) },
  });
  const res = response();
  await controller.updateBeneficiary(request({ beneficiaryName: 'Beneficiary', relationship: 'Spouse', contactNumber: '09171234567', updatedBy: 'forged.operator' }), res);
  assert.equal(res.code, 201);
  assert.equal(res.data.data.updatedBy, user.username);
  const bulk = response();
  await controller.bulkUploadBeneficiaries(request({ action: 'import', csv: 'test', updatedBy: 'forged.operator' }), bulk);
  assert.equal(bulk.code, 200);
  assert.equal(importedBy, user.username);
});
