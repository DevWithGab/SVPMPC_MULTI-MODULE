const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const QRCode = require('qrcode');
const fs = require('node:fs');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const { generateQRCode, renderQRCodePng } = require('../modules/attendance/services/qrCodeService');

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
