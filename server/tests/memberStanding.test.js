const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

for (const minimumBalance of [1000, 1500]) test(`dashboard separates negative balances using the ${minimumBalance} maintaining balance`, async () => {
  const balances = [-50, -0.01, 0, 999.99, 1000, 5000, 10000];
  const members = balances.map((balance, index) => ({ memberId: String(index), status: 'active', balance }));
  const dependencies = {
    '../models/Ledger': {},
    '../models/Contribution': { aggregate: async () => [] },
    '../models/Claim': { aggregate: async () => [] },
    '../models/NoticeThresholdSetting': { findOne: () => ({ select: () => ({ lean: async () => ({ targetBalance: minimumBalance }) }) }) },
    '../../../shared/models': { Member: {
      countDocuments: async filter => !filter || filter.status === 'active' ? members.length : 0,
      find: () => ({ select: () => ({ lean: async () => members }) }),
    } },
    '../utils/ledgerBalance': { LATEST_FIRST: {}, getLatestBalancesByMember: async () => new Map(members.map(member => [member.memberId, member.balance])) },
    '../../../middleware/errorHandler': { safeErrorMessage: error => error.message },
  };
  const context = { module: { exports: {} }, console, require: name => {
    assert.ok(Object.hasOwn(dependencies, name), `Unexpected dependency: ${name}`);
    return dependencies[name];
  } };
  vm.runInNewContext(fs.readFileSync(require.resolve('../modules/mortuary/controllers/dashboardController'), 'utf8'), context);
  const response = { status(code) { this.code = code; return this; }, json(value) { this.value = value; } };
  await context.module.exports.getTreasurerDashboard({}, response);
  assert.equal(response.code, 200);
  const data = response.value.data;
  assert.equal(data.memberStanding.negativeBalance, 2);
  assert.equal(data.memberStanding.atRisk, minimumBalance === 1000 ? 2 : 3);
  assert.equal(data.memberStanding.fair, minimumBalance === 1000 ? 1 : 0);
  assert.equal(data.memberStanding.good, 1);
  assert.equal(data.memberStanding.excellent, 1);
  assert.equal(Object.values(data.memberStanding).reduce((sum, count) => sum + count, 0), members.length);
  assert.equal(data.lowBalanceMembers, minimumBalance === 1000 ? 4 : 5);
  assert.equal(data.minimumBalance, minimumBalance);
  assert.equal(data.negativeBalanceMembers, 2);
  assert.equal(data.fundBalance, balances.reduce((sum, balance) => sum + balance, 0));
  assert.equal(data.healthRatio, minimumBalance === 1000 ? 43 : 29);
});
