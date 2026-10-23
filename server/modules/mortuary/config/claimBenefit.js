/* Dito nilagay yung death benefit rule kasi both yung Treasurer controller
(nagbabayad ng claims) at yung dashboard controller (nagreport ng income) ay
dapat magkasundo dito nang eksakto - kung magkaiba sila, hindi na magtutugma
yung pera na na-release sa pera na reported as retained kumpara sa kinolekta.

Kapag namatay yung isang member, every other active member ay na-assess ng
fixed amount (Flow A sa treasurerClaimController). Yung beneficiary ang
tumatanggap ng pool na yun, capped sa Admin-configured benefit cap
(BenefitCapSetting - Fund Settings → Benefit Cap); kung ano man yung
nakolekta above the cap, yun na yung income ng cooperative.

  collected ₱205,000, cap ₱50,000  ->  released ₱50,000, income ₱155,000
  collected ₱500,     cap ₱50,000  ->  released ₱500,    income ₱0

Yung cap bumibind lang pag lumagpas sa ceiling, kaya inert lang siya sa
maliit na test dataset at hindi na kailangan ng test-mode switch.

Yung DEFAULT_MAX_BENEFIT_AMOUNT ay fallback lang na ginagamit para
auto-seed yung first BenefitCapSetting row (at kung sakaling empty yung
collection na yun) - galing talaga sa database yung live value. Yung mga
caller ang nagre-resolve ng current cap (tingnan yung treasurerClaimController's
resolveBenefitCap) at ipinapasa nila ito explicitly; wala namang DB dependency
yung dalawang functions na ito kaya madali silang i-test. */
const DEFAULT_MAX_BENEFIT_AMOUNT = 50000;

// What the beneficiary receives for a claim that collected this much.
const benefitPayoutFor = (totalCollected = 0, cap = DEFAULT_MAX_BENEFIT_AMOUNT) =>
  Math.min(totalCollected || 0, cap);

/* Ito yung naiiwan sa cooperative. Kinikita yung income pag COLLECTED na yung
assessment, hindi pag nacut na yung cheque - kaya hindi ito dependent kung
na-release na yung claim o hindi. */
const benefitSurplusFor = (totalCollected = 0, cap = DEFAULT_MAX_BENEFIT_AMOUNT) =>
  Math.round(((totalCollected || 0) - benefitPayoutFor(totalCollected, cap)) * 100) / 100;

module.exports = { DEFAULT_MAX_BENEFIT_AMOUNT, benefitPayoutFor, benefitSurplusFor };
