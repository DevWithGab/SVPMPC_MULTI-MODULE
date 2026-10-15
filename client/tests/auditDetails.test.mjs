import test from 'node:test';
import assert from 'node:assert/strict';
import { auditChanges, auditRows, auditValue, outcomeLabel } from '../src/utils/auditDetails.js';

test('nested claim changes show only the fields that changed', () => {
  const result = auditChanges({ before: { payout: { amount: 1000, paymentMethod: 'cash' }, status: 'approved' }, after: { payout: { amount: 1500, paymentMethod: 'cash' }, status: 'approved' } }, 'mortuary');
  assert.equal(result.kind, 'diff');
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].label, 'Payout / Amount');
  assert.match(result.rows[0].before, /1,000.00/);
  assert.match(result.rows[0].after, /1,500.00/);
});
test('attendance preserves false, zero, added and removed fields', () => {
  const result = auditChanges({ before: { status: 'pending_approval', location: 'Hall' }, after: { status: 'closed', count: 0, verified: false } }, 'attendance');
  assert.equal(result.rows.find(r => r.key === 'status').before, 'Pending Approval');
  assert.equal(result.rows.find(r => r.key === 'status').after, 'Closed');
  assert.equal(result.rows.find(r => r.key === 'location').after, 'Not recorded');
  assert.equal(result.rows.find(r => r.key === 'count').after, '0');
  assert.equal(result.rows.find(r => r.key === 'verified').after, 'No');
});
test('nested metadata and arrays stay readable and exclude database plumbing', () => {
  const rows = auditRows({ members: { created: 2, errors: ['Missing passbook'] }, _id: 'internal', approval: { _id: 'hidden', approvedBy: 'Ana' } }, 'mortuary');
  assert.ok(rows.some(r => r.value === 'Missing passbook'));
  assert.ok(rows.some(r => r.label === 'Approval / Approved By'));
  assert.ok(rows.every(r => !r.key.includes('_id') && r.value !== '[object Object]'));
});
test('create, delete and missing snapshots are handled', () => {
  assert.equal(auditChanges({ after: { memberName: 'Ana' } }, 'attendance').kind, 'added');
  assert.equal(auditChanges({ before: { memberName: 'Ana' } }, 'attendance').kind, 'removed');
  assert.deepEqual(auditChanges(null, 'attendance').rows, []);
  assert.equal(auditValue('eventDate', 'invalid date'), 'invalid date');
  assert.equal(outcomeLabel('partial'), 'Partly completed');
});
