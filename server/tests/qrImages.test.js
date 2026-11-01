const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const QRCode = require('qrcode');
const fs = require('node:fs');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const { generateQRCode, renderQRCodePng, buildQRCodeMatrix } = require('../modules/attendance/services/qrCodeService');

test('issued QR images load without local files and replaced URLs cannot reveal current QR IDs', async () => {
  const member = {
    memberId: 'TEST_001', memberName: 'Test Member', barangay: 'Test Barangay',
    qrCode: '13a5651b-680b-426a-8eae-3d7be3636545', qrCodeGenerated: true,
  };
  const originalId = member.qrCode;
  const filename = `${member.memberId}_${originalId}.png`;
  let queryCount = 0;
  let unavailable = false;
  const filenameRoute = require.resolve('../modules/attendance/routes/qrImageRoutes');
  const localRequire = createRequire(filenameRoute);
  const fakeMember = { findOne(query) {
    queryCount++;
    assert.equal(typeof query.qrCode, 'string');
    assert.equal(query.qrCodeGenerated, true);
    return { select(fields) {
      assert.equal(fields, 'memberId memberName barangay qrCode');
      return { async lean() {
        if (unavailable) throw new Error('synthetic database outage');
        return query.qrCode === member.qrCode && member.qrCodeGenerated ? { ...member } : null;
      } };
    } };
  } };
  const context = { module: { exports: {} },
    require: name => name === '../../../shared/models' ? { Member: fakeMember } : localRequire(name) };
  vm.runInNewContext(fs.readFileSync(filenameRoute, 'utf8'), context, { filename: filenameRoute });

  const app = express();
  app.use('/uploads/qrcodes', context.module.exports);
  app.use((err, req, res, next) => res.status(500).json({ message: 'Image unavailable' }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  try {
    const get = name => fetch(`http://127.0.0.1:${server.address().port}/uploads/qrcodes/${name}`);
    const first = await get(filename);
    assert.equal(first.status, 200);
    assert.match(first.headers.get('content-type'), /^image\/png/);
    assert.equal(first.headers.get('cache-control'), 'no-store');
    const png = Buffer.from(await first.arrayBuffer());
    assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    // Independently construct the scanner payload to prove that rendering
    // retains the existing issued ID, member identity, and QR contract.
    const expected = await QRCode.toBuffer(JSON.stringify({
      type: 'member', memberId: 'TEST_001', name: 'Test Member',
      barangay: 'Test Barangay', qrId: originalId,
    }), { errorCorrectionLevel: 'H', type: 'image/png', width: 300, margin: 1,
      color: { dark: '#000000', light: '#FFFFFF' } });
    assert.deepEqual(png, expected);
    const second = await get(filename);
    assert.deepEqual(Buffer.from(await second.arrayBuffer()), png, 'a new request must not rotate the issued QR');
    assert.equal(member.qrCode, originalId);
    assert.equal((await get(`WRONG_${originalId}.png`)).status, 404);

    const beforeInvalid = queryCount;
    assert.equal((await get('guess.png')).status, 404);
    assert.equal((await get('TEST_001_%7B%22%24ne%22:null%7D.png')).status, 404);
    assert.equal(queryCount, beforeInvalid, 'malformed filenames must not query MongoDB');
    member.qrCodeGenerated = false;
    assert.equal((await get(filename)).status, 404);
    member.qrCodeGenerated = true;
    member.qrCode = '83c27c1b-a17d-47ee-98fa-86a682c2e6f9';
    assert.equal((await get(filename)).status, 404, 'the previous URL must not expose a replacement QR');
    unavailable = true;
    const failure = await get(`${member.memberId}_${member.qrCode}.png`);
    assert.equal(failure.status, 500);
    assert.deepEqual(await failure.json(), { message: 'Image unavailable' });
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test('new issuance returns a compatible URL and renders the same scanner payload without storing a file', async () => {
  const member = { memberId: 'TEST-NEW', memberName: 'New Member', barangay: '' };
  const issued = await generateQRCode(member);
  assert.equal(issued.success, true);
  assert.match(issued.qrCode, /^[a-f0-9-]{36}$/);
  assert.equal(issued.qrCodeUrl, `/uploads/qrcodes/TEST-NEW_${issued.qrCode}.png`);
  assert.equal(member.qrCode, undefined, 'issuing service leaves database mutation to the controller');
  const png = await renderQRCodePng({ ...member, qrCode: issued.qrCode });
  assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
});

test('batch matrix encodes exactly the issued PNG payload and error correction', () => {
  const member = { memberId: '000123', memberName: 'Ana Santos', barangay: 'San Vicente', qrCode: 'issued-id' };
  const expected = QRCode.create(JSON.stringify({ type: 'member', memberId: member.memberId,
    name: member.memberName, barangay: member.barangay, qrId: member.qrCode }), { errorCorrectionLevel: 'H' });
  const rows = buildQRCodeMatrix(member);
  assert.equal(rows.length, expected.modules.size);
  rows.forEach((row, y) => Array.from(row).forEach((cell, x) =>
    assert.equal(cell, expected.modules.get(y, x) ? '1' : '0')));
});

function controllerWith(Member, service = require('../modules/attendance/services/qrCodeService')) {
  const filename = require.resolve('../modules/attendance/controllers/memberController');
  const localRequire = createRequire(filename);
  const context = { module: { exports: {} }, console, require: name => {
    if (name === '../../../shared/models') return { Member };
    if (name === '../services/qrCodeService') return service;
    if (name === '../../../shared/services/auditLoggingService') return { createAuditLog: async () => {} };
    return localRequire(name);
  } };
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), context, { filename });
  return context.module.exports;
}
const response = () => ({ code: 200, status(code) { this.code = code; return this; },
  set() {}, json(data) { this.data = data; return this; } });

test('batch cards use one lookup and reject invalid requests and newly revoked codes', async () => {
  const member = { memberId: '001', memberName: 'Ana', status: 'active', qrCode: 'current-issued-id', qrCodeGenerated: true, qrCodeActive: true };
  let queries = 0;
  const controller = controllerWith({ find() {
    queries++;
    return { select: () => ({ lean: async () => [member] }) };
  } });
  for (const memberIds of [[], [{ $ne: null }], Array(101).fill('001')]) {
    const res = response();
    await controller.getQRCodeCards({ body: { memberIds } }, res);
    assert.equal(res.code, 400);
  }
  assert.equal(queries, 0);
  const res = response();
  await controller.getQRCodeCards({ body: { memberIds: ['001'] } }, res);
  assert.equal(queries, 1);
  assert.equal(res.data.cards[0].memberId, '001');
  assert.deepEqual(res.data.cards[0].rows, buildQRCodeMatrix(member));
  for (const changed of [{ qrCodeActive: false }, { status: 'inactive' }, { status: 'deceased' }, { qrCodeGenerated: false }]) {
    const original = { ...member };
    Object.assign(member, changed);
    const denied = response();
    await controller.getQRCodeCards({ body: { memberIds: ['001'] } }, denied);
    assert.equal(denied.code, 409);
    Object.assign(member, original);
  }
});

test('bulk QR issuance overlaps saves with a limit of ten, preserving results and per-member failures', async () => {
  let active = 0;
  let peak = 0;
  const members = Array.from({ length: 60 }, (_, index) => ({
    memberId: String(index), status: index === 1 ? 'inactive' : 'active',
    async save() {
      peak = Math.max(peak, ++active);
      await new Promise(resolve => setImmediate(resolve));
      active--;
      if (index === 10) throw new Error('Synthetic save failure');
    },
  }));
  const controller = controllerWith({ find: async () => members }, {
    generateQRCode: async member => ({ success: true, qrCode: `issued-${member.memberId}`, qrCodeUrl: `/${member.memberId}.png` }),
  });
  const res = response();
  await controller.generateAllQRCodes({ body: {} }, res);
  assert.equal(peak, 10);
  assert.equal(res.data.generatedCount, 58);
  assert.equal(res.data.errorCount, 2);
  assert.deepEqual(Array.from(res.data.results, row => row.memberId), members.filter((_, i) => ![1, 10].includes(i)).map(row => row.memberId));
});
