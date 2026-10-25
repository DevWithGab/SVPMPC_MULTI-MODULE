const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const harness = (active = null) => {
  let saved = false;
  class Setting {
    constructor(values) { Object.assign(this, values); }
    static findOne() { return { lean: async () => active }; }
  }
  const dependencies = {
    '../models/NoticeThresholdSetting': Setting,
    uuid: { v4: () => 'NEW-SETTING' },
    '../../../shared/utils/pagination': {},
    '../../../shared/utils/versionedSetting': { supersedeAndInsert: async (Model, build) => { saved = true; return build(); } },
    '../../../middleware/errorHandler': { safeErrorMessage: error => error.message },
    '../../../shared/utils/actorName': require('../shared/utils/actorName'),
  };
  const context = { module: { exports: {} }, console, require: name => dependencies[name] };
  vm.runInNewContext(fs.readFileSync(require.resolve('../modules/mortuary/controllers/noticeThresholdSettingController'), 'utf8'), context);
  const response = { status(code) { this.code = code; return this; }, json(data) { this.data = data; return this; } };
  return { controller: context.module.exports, response, saved: () => saved };
};
const settings = { targetBalance: 1000, notice1Min: 700, notice1Max: 900, notice2Min: 300, notice2Max: 699, noticeBodyTemplate: 'Legacy first notice', finalNoticeBodyTemplate: 'Legacy final notice' };

test('saving a notice letter without {balance} is blocked and names the placeholder', async () => {
  const { controller, response, saved } = harness();
  await controller.updateThresholds({ body: { ...settings, noticeMessageTemplate: 'Please deposit {amountNeeded} to reach {targetBalance}.' }, user: {} }, response);
  assert.equal(response.code, 400);
  assert.equal(saved(), false);
  assert.match(response.data.message, /\{balance\} placeholder must remain in the First & Second Notice letter/);
  assert.deepEqual([...response.data.missingPlaceholders], ['balance']);
});

test('the final notice lists every missing placeholder', async () => {
  const { controller, response } = harness();
  await controller.updateThresholds({ body: { ...settings, finalNoticeMessageTemplate: 'Your account is overdue.' }, user: {} }, response);
  assert.equal(response.code, 400);
  assert.match(response.data.message, /\{balance\} and \{amountNeeded\} placeholders must remain in the Final Notice letter/);
});

test('reworded letters that keep the required placeholders save normally', async () => {
  const { controller, response, saved } = harness();
  await controller.updateThresholds({ body: { ...settings,
    noticeMessageTemplate: 'Balance: {balance}. Deposit {amountNeeded} to keep {targetBalance}.',
    finalNoticeMessageTemplate: 'You have {balance}. Deposit {amountNeeded} within 30 days.' }, user: {} }, response);
  assert.equal(response.code, 201);
  assert.equal(saved(), true);
});

test('saves that do not touch the letters (e.g. thresholds only) are not affected', async () => {
  const { controller, response } = harness();
  await controller.updateThresholds({ body: { ...settings }, user: {} }, response);
  assert.equal(response.code, 201);
});

test('a placeholder the admin added earlier (e.g. {name}) cannot be deleted either', async () => {
  const { controller, response, saved } = harness({ noticeMessageTemplate: 'Dear {name}, your balance is {balance}. Deposit {amountNeeded} to keep {targetBalance} by {date}.' });
  await controller.updateThresholds({ body: { ...settings, noticeMessageTemplate: 'Your balance is {balance}. Deposit {amountNeeded} to keep {targetBalance}.' }, user: {} }, response);
  assert.equal(response.code, 400);
  assert.equal(saved(), false);
  assert.match(response.data.message, /\{name\} and \{date\} placeholders must remain/);
});
