import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getMemberStanding, getStandingLabel } from '../src/utils/memberStanding.js';

test('negative balances have their own standing and zero remains at risk', () => {
  for (const balance of [-5000, -0.01, '-200']) {
    assert.equal(getMemberStanding(balance), 'negativeBalance');
    assert.equal(getStandingLabel(balance), 'Negative Balance');
  }
  for (const balance of [0, 0.01, 999.99, undefined]) assert.equal(getStandingLabel(balance), 'At Risk');
});

test('positive standing boundaries and the configured maintaining balance are preserved', () => {
  assert.equal(getStandingLabel(1000), 'Fair');
  assert.equal(getStandingLabel(4999.99), 'Fair');
  assert.equal(getStandingLabel(5000), 'Good');
  assert.equal(getStandingLabel(10000), 'Excellent');
  assert.equal(getStandingLabel(1200, 1500), 'At Risk');
  assert.equal(getStandingLabel(1500, 1500), 'Fair');
  assert.equal(getStandingLabel(-0.01, 1500), 'Negative Balance');
});
