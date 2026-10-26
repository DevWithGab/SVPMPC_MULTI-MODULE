import test from 'node:test';
import assert from 'node:assert/strict';
import { parseMemberUpload, memberUploadError } from '../src/utils/memberBulkUpload.js';

test('member CSV preserves IDs, escaped quotes, commas and multiline addresses with physical row numbers', () => {
  const result = parseMemberUpload('\uFEFFmemberName,barangay,address,Passbook No.\r\n\r\n"Maria ""May"" Santos",Centro,"Street,\r\nTown",000123\r\nJose Reyes,Centro,Street,000124');
  assert.equal(result.members[0].memberName, 'Maria "May" Santos');
  assert.equal(result.members[0].address, 'Street,\r\nTown');
  assert.equal(result.members[0].passbookNo, '000123');
  assert.deepEqual(result.rowNumbers, [3, 5]);
  assert.equal(result.preview.length, 2);
  assert.equal(result.members[1].gender, 'male');
});

test('member CSV explains empty files, missing and duplicate headers, broken quotes and wrong column counts', () => {
  for (const [csv, reason] of [
    ['', /no member rows/],
    ['memberName\nMaria', /Missing required columns: barangay, address/],
    ['memberName,barangay,address,memberId,Passbook No.\nMaria,B,A,1,2', /duplicate column headers/],
    ['memberName,barangay,address\nMaria,B,"unclosed', /quoted field is not closed/],
    ['memberName,barangay,address\nMaria,B,Street,Town', /Row 2 has 4 values; expected 3/],
  ]) assert.throws(() => parseMemberUpload(csv), reason);
});

test('member upload displays server messages and advises reconciliation after unconfirmed network failures', () => {
  assert.equal(memberUploadError({ response: { data: { message: 'Too many bulk upload attempts. Please try again in 15 minutes.' } } }), 'Too many bulk upload attempts. Please try again in 15 minutes.');
  assert.match(memberUploadError(new Error('Network error')), /refresh the member list before retrying/);
});
