const test = require('node:test');
const assert = require('node:assert/strict');
const { processMemberBatches } = require('../shared/utils/memberImportBatches');

test('1000 members run concurrently with at most ten active rows and ordered results', async () => {
  let active = 0;
  let peak = 0;
  const members = Array.from({ length: 1000 }, (_, i) => ({ passbookNo: String(i) }));
  const results = await processMemberBatches(members, async (_, index) => {
    peak = Math.max(peak, ++active);
    await new Promise(resolve => setImmediate(resolve));
    active--;
    return index;
  });
  assert.equal(peak, 10);
  assert.deepEqual(results, members.map((_, index) => index));
});

test('matching normalized emails and passbooks wait for earlier rows', async () => {
  const saved = new Set();
  const results = await processMemberBatches([
    { passbookNo: ' 001 ', email: 'first@example.com' },
    { memberId: '001', email: 'second@example.com' },
    { passbookNo: '002', email: ' first@example.com ' },
  ], async member => {
    const keys = [String(member.passbookNo ?? member.memberId).trim(), member.email.trim()];
    const duplicate = keys.some(key => saved.has(key));
    await new Promise(resolve => setImmediate(resolve));
    if (!duplicate) keys.forEach(key => saved.add(key));
    return duplicate;
  });
  assert.deepEqual(results, [false, true, true]);
});
