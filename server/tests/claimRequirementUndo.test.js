const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { createRequire } = require('node:module');

function load(relativePath, dependencies) {
  const filename = require.resolve(relativePath);
  const localRequire = createRequire(filename);
  const context = {
    module: { exports: {} }, process, Buffer, console: { log() {}, error() {} },
    require: name => Object.hasOwn(dependencies, name) ? dependencies[name] : localRequire(name),
  };
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), context, { filename });
  return context.module.exports;
}
const response = () => ({ status(code) { this.code = code; return this; }, json(data) { this.data = data; return this; } });

const loadWithClaim = (claim) => load('../modules/mortuary/controllers/claimController', {
  '../models/Claim': { findOne: async () => claim },
  '../models/Beneficiary': {},
  '../../../shared/services/auditLoggingService': { createAuditLog: async () => {} },
});

const claimWith = (status) => ({
  claimId: 'CLM-1', status,
  requirements: new Map([['deathCertificate', { label: 'Death Certificate' }], ['barangayCertificate', { label: 'Barangay Certificate' }]]),
  markModified() {}, async save() { this.saved = true; },
});

test('an accidentally added requirement can be removed while the claim is pending requirements', async () => {
  const claim = claimWith('pending_requirements');
  const res = response();
  await loadWithClaim(claim).removeRequirement({ params: { claimId: 'CLM-1', requirementKey: 'barangayCertificate' } }, res);
  assert.equal(res.code, 200);
  assert.equal(claim.saved, true);
  assert.deepEqual([...claim.requirements.keys()], ['deathCertificate']);
});

test('requirements cannot be removed after a decision, and unknown keys are rejected', async () => {
  const approved = claimWith('approved');
  const res = response();
  await loadWithClaim(approved).removeRequirement({ params: { claimId: 'CLM-1', requirementKey: 'barangayCertificate' } }, res);
  assert.equal(res.code, 400);
  assert.equal(approved.requirements.size, 2);

  const pending = claimWith('pending_requirements');
  const missing = response();
  await loadWithClaim(pending).removeRequirement({ params: { claimId: 'CLM-1', requirementKey: 'notThere' } }, missing);
  assert.equal(missing.code, 404);
  assert.equal(pending.requirements.size, 2);
});
