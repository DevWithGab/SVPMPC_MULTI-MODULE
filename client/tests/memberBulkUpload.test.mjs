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

test('beginning balances support credits, debits, zero, and older CSV templates', () => {
  const header = 'memberName,barangay,address,beginningBalance\n';
  const { members } = parseMemberUpload(header + 'Positive,B,A,1000.25\nNegative,B,A,-250.50\nZero,B,A,0\nBlank,B,A,');
  assert.deepEqual(members.map(row => row.beginningBalance), [1000.25, -250.5, 0, '']);
  assert.equal(parseMemberUpload('memberName,barangay,address\nOld,B,A').members[0].beginningBalance, undefined);
  for (const amount of ['abc', 'NaN', 'Infinity', '1e3', '12.345', '₱100', '9007199254740992']) {
    assert.throws(() => parseMemberUpload(header + `Invalid,B,A,${amount}`), /Row 2, beginningBalance/);
  }
});
