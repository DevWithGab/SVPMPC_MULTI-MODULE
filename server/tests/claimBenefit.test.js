const test = require('node:test');
const assert = require('node:assert/strict');
const { benefitPayoutFor, benefitSurplusFor, DEFAULT_MAX_BENEFIT_AMOUNT } = require('../modules/mortuary/config/claimBenefit');

test('benefitPayoutFor releases the full amount collected when it is under the cap', () => {
  assert.equal(benefitPayoutFor(500, 50000), 500);
  assert.equal(benefitPayoutFor(0, 50000), 0);
});

test('benefitPayoutFor caps the payout at the benefit cap when collections exceed it', () => {
  assert.equal(benefitPayoutFor(205000, 50000), 50000);
});

test('benefitPayoutFor falls back to the default cap when none is supplied', () => {
  assert.equal(benefitPayoutFor(999999), DEFAULT_MAX_BENEFIT_AMOUNT);
});

test('benefitSurplusFor is zero when collections are at or under the cap', () => {
  assert.equal(benefitSurplusFor(500, 50000), 0);
  assert.equal(benefitSurplusFor(50000, 50000), 0);
});

test('benefitSurplusFor is the amount collected above the cap', () => {
  assert.equal(benefitSurplusFor(205000, 50000), 155000);
});

test('payout plus surplus always reconstructs the total collected, to the cent', () => {
  for (const [collected, cap] of [[0, 50000], [500, 50000], [50000, 50000], [205000.5, 50000], [12345.67, 10000]]) {
    const payout = benefitPayoutFor(collected, cap);
    const surplus = benefitSurplusFor(collected, cap);
    assert.equal(Math.round((payout + surplus) * 100) / 100, Math.round(collected * 100) / 100);
  }
});
