// The death benefit rule, in one place because both the Treasurer controller
// (which pays claims out) and the dashboard controller (which reports income)
// have to agree on it exactly — if they drift, the money released and the money
// reported as retained stop adding up to what was collected.
//
// When a member dies, every other active member is assessed a fixed amount
// (Flow A in treasurerClaimController). The beneficiary receives that pool
// capped at the Admin-configured benefit cap (BenefitCapSetting — Fund
// Settings → Benefit Cap); whatever was collected above the cap is the
// cooperative's income.
//
//   collected ₱205,000, cap ₱50,000  ->  released ₱50,000, income ₱155,000
//   collected ₱500,     cap ₱50,000  ->  released ₱500,    income ₱0
//
// The cap only binds above the ceiling, so it is inert on a small test dataset
// and needs no test-mode switch.
//
// DEFAULT_MAX_BENEFIT_AMOUNT is only the fallback used to auto-seed the
// first BenefitCapSetting row (and if that collection is ever empty) — the
// live value always comes from the database. Callers resolve the current
// cap (see treasurerClaimController's resolveBenefitCap) and pass it in
// explicitly; these two functions take no DB dependency of their own so
// they stay easy to test.
const DEFAULT_MAX_BENEFIT_AMOUNT = 50000;

// What the beneficiary receives for a claim that collected this much.
const benefitPayoutFor = (totalCollected = 0, cap = DEFAULT_MAX_BENEFIT_AMOUNT) =>
  Math.min(totalCollected || 0, cap);

// What the cooperative retains. Income is earned when the assessment is
// COLLECTED, not when the cheque is cut — so this never depends on whether the
// claim has been released yet.
const benefitSurplusFor = (totalCollected = 0, cap = DEFAULT_MAX_BENEFIT_AMOUNT) =>
  Math.round(((totalCollected || 0) - benefitPayoutFor(totalCollected, cap)) * 100) / 100;

module.exports = { DEFAULT_MAX_BENEFIT_AMOUNT, benefitPayoutFor, benefitSurplusFor };
