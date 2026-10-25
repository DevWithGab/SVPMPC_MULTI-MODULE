const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const harness = () => {
  let options;
  class Setting { constructor(values) { Object.assign(this, values); } }
  const dependencies = {
    '../models/NoticeThresholdSetting': Setting,
    uuid: { v4: () => 'NEW-SETTING' },
    '../../../shared/utils/pagination': {},
    '../../../shared/utils/versionedSetting': { supersedeAndInsert: async (Model, build, config) => { options = config; return build(); } },
    '../../../middleware/errorHandler': { safeErrorMessage: error => error.message },
    '../../../shared/utils/actorName': require('../shared/utils/actorName'),
  };
  const context = { module: { exports: {} }, console, require: name => dependencies[name] };
  vm.runInNewContext(fs.readFileSync(require.resolve('../modules/mortuary/controllers/noticeThresholdSettingController'), 'utf8'), context);
  const response = { status(code) { this.code = code; return this; }, json(data) { this.data = data; return this; } };
  return { controller: context.module.exports, response, options: () => options };
};
const settings = { targetBalance: 1000, notice1Min: 700, notice1Max: 900, notice2Min: 300, notice2Max: 699, noticeBodyTemplate: 'Legacy first notice', finalNoticeBodyTemplate: 'Legacy final notice' };

test('saving a manager trims the name and enables preservation on later edits', async () => {
  const { controller, response, options } = harness();
  await controller.updateThresholds({ body: { ...settings, noticeManagerName: '  MARIA C. SANTOS  ' }, user: { username: 'admin' } }, response);
  assert.equal(response.code, 201);
  assert.equal(response.data.data.noticeManagerName, 'MARIA C. SANTOS');
  assert.ok(options().preserveFields.includes('noticeManagerName'));
});

for (const invalid of ['', '   ', 'A'.repeat(101), 'NAME\nSECOND LINE', 42]) {
  test(`rejects invalid manager name ${JSON.stringify(invalid).slice(0, 35)}`, async () => {
    const { controller, response } = harness();
    await controller.updateThresholds({ body: { ...settings, noticeManagerName: invalid }, user: {} }, response);
    assert.equal(response.code, 400);
  });
}
