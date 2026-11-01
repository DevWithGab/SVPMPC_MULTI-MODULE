import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import jsQR from 'jsqr';
import { prepareQrCards } from '../src/utils/qrCardBatch.js';
import { buildQrCardsPdf } from '../src/utils/qrCardsPdf.js';
const require = createRequire(import.meta.url);
const { buildQRCodeMatrix } = require('../../server/modules/attendance/services/qrCodeService');

test('batch card matrices still scan as the current issued code, and PDF needs no image requests', async () => {
  const member = { memberId: '000123', memberName: 'Ana Santos', barangay: 'Sample', qrCode: 'current-issued-id' };
  const rows = buildQRCodeMatrix(member);
  const [entry] = await prepareQrCards([{ memberId: member.memberId, name: 'Old Name' }], async () => ({ cards: [{ ...member, status: 'active', rows }] }));
  assert.equal(entry.member.name, 'Ana Santos');
  assert.match(entry.qrUrl, /^data:image\/svg\+xml/);
  const scale = 4, margin = 4, size = (rows.length + margin * 2) * scale;
  const pixels = new Uint8ClampedArray(size * size * 4).fill(255);
  entry.qr.rows.forEach((row, y) => row.forEach((dark, x) => {
    if (!dark) return;
    for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++) {
      const index = (((y + margin) * scale + dy) * size + (x + margin) * scale + dx) * 4;
      pixels[index] = pixels[index + 1] = pixels[index + 2] = 0;
    }
  }));
  const decoded = JSON.parse(jsQR(pixels, size, size).data);
  assert.equal(decoded.qrId, member.qrCode);
  assert.equal(decoded.memberId, '000123');
  const pdf = await buildQrCardsPdf([entry]);
  assert.equal(pdf.getNumberOfPages(), 1);
  assert.match(pdf.output(), /^%PDF/);
});

test('201 cards use three bounded requests and preserve input order', async () => {
  const members = Array.from({ length: 201 }, (_, index) => ({ memberId: String(index) }));
  const requests = [];
  const rows = Array(21).fill('0'.repeat(21));
  const entries = await prepareQrCards(members, async ids => {
    requests.push(ids.length);
    return { cards: ids.toReversed().map(memberId => ({ memberId, rows, memberName: memberId })) };
  });
  assert.deepEqual(requests, [100, 100, 1]);
  assert.deepEqual(entries.map(entry => entry.member.memberId), members.map(member => member.memberId));
});

test('incomplete or invalid card data fails rather than producing blank cards', async () => {
  await assert.rejects(prepareQrCards([{ memberId: '001' }], async () => ({ cards: [] })), /unavailable/);
  await assert.rejects(prepareQrCards([{ memberId: '001' }], async () => ({ cards: [{ memberId: '001', rows: ['bad'] }] })), /Invalid QR/);
});
