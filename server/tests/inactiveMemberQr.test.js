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
const memberRow = overrides => ({
  memberId: '002001', memberName: 'Test Member', status: 'active',
  qrCode: 'qr-1', qrCodeGenerated: true, qrCodeActive: true,
  async save() { this.saved = true; },
  ...overrides,
});

test('superadmin deactivating a member switches their QR off, and reactivating leaves it off', async () => {
  const member = memberRow();
  const controller = load('../shared/controllers/adminController', {
    '../models': { Member: { findOne: async () => member } },
  });
  const res = response();
  await controller.toggleMemberStatus({ params: { memberId: member.memberId } }, res);
  assert.equal(res.code, 200);
  assert.equal(member.status, 'inactive');
  assert.equal(member.qrCodeActive, false);

  await controller.toggleMemberStatus({ params: { memberId: member.memberId } }, response());
  assert.equal(member.status, 'active');
  assert.equal(member.qrCodeActive, false);
});

test('QR codes cannot be reactivated, regenerated or generated for an inactive member', async () => {
  const member = memberRow({ status: 'inactive', qrCodeActive: false });
  let generated = 0;
  const controller = load('../modules/attendance/controllers/memberController', {
    '../../../shared/models': { Member: { findOne: async () => member, find: async () => [member] } },
    '../services/qrCodeService': { generateQRCode: async () => { generated++; return { success: true, qrCode: 'qr-2', qrCodeUrl: '/qr/2.png' }; } },
    '../../../shared/services/auditLoggingService': { createAuditLog: async () => {} },
  });

  for (const action of ['reactivateQRCode', 'regenerateQRCode']) {
    const res = response();
    await controller[action]({ params: { memberId: member.memberId }, get: () => '' }, res);
    assert.equal(res.code, 400, action);
    assert.match(res.data.message, /inactive/);
  }

  const res = response();
  await controller.generateQRCodes({ body: { memberIds: [member.memberId] }, get: () => '' }, res);
  assert.equal(generated, 0);
  assert.equal(member.qrCodeActive, false);
  assert.equal(member.qrCode, 'qr-1');
});
