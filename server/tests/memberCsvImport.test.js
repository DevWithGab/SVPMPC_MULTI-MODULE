const test = require('node:test');
const assert = require('node:assert/strict');
const { validateMemberData, MAX_ROWS } = require('../modules/attendance/services/csvParserService');

const member = (i) => ({ memberId: `MEM-${i}`, memberName: `Member ${i}`, barangay: 'Sample', address: 'Sample address' });

// Regression test: this was the one bulk-upload path in the app with no
// row-count cap at all (only a file-size limit on the upload itself), so an
// oversized CSV ran full per-row validation, and then one member-creation
// write per row, over however many rows were in the file.
test('validateMemberData caps uploads at 1000 members, matching the other bulk-upload importers', () => {
  const tooMany = Array.from({ length: MAX_ROWS + 1 }, (_, i) => member(i));
  const atLimit = Array.from({ length: MAX_ROWS }, (_, i) => member(i));

  const over = validateMemberData(tooMany);
  assert.equal(over.isValid, false);
  assert.match(over.errors.join(' '), /Maximum 1000 members/);

  const ok = validateMemberData(atLimit);
  assert.equal(ok.isValid, true);
  assert.deepEqual(ok.errors, []);
});

test('validateMemberData still reports missing-field errors for an ordinary, under-cap upload', () => {
  const result = validateMemberData([member(1), { memberId: 'MEM-2', memberName: '', barangay: 'Sample', address: 'Sample address' }]);
  assert.equal(result.isValid, false);
  assert.match(result.errors.join(' '), /memberName/);
});
