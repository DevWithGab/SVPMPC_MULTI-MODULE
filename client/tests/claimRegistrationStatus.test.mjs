import test from 'node:test';
import assert from 'node:assert/strict';
import { getClaimStatusMeta, getClaimAction, CLAIM_STATUS_ORDER } from '../src/components/mortuary/shared/claimMeta.js';

test('an unfinished registration has its own visible status and no approval action', () => {
  assert.equal(getClaimStatusMeta('filing').label, 'Registration Pending');
  assert.notEqual(getClaimStatusMeta('filing').label, getClaimStatusMeta('pending_requirements').label);
  assert.ok(CLAIM_STATUS_ORDER.includes('filing'));
  assert.equal(getClaimAction('filing').actor, null);
});
