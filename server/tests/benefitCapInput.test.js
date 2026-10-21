const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { createRequire } = require('node:module');

function harness(kind) {
  const filename = require.resolve(`../modules/mortuary/controllers/${kind}SettingController`);
  const localRequire = createRequire(filename);
  const saved = [];
  const context = {
    module: { exports: {} }, console,
    require(name) {
      if (name === '../models/BenefitCapSetting' || name === '../models/DeductionSetting') return class { constructor(data) { Object.assign(this, data); } };
      if (name.endsWith('/versionedSetting')) return { supersedeAndInsert: async (_model, build) => {
        const row = build(); saved.push(row); return row;
      } };
      return localRequire(name);
    },
  };
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), context, { filename });
  return { saved, async submit(amount) {
    const res = { status(code) { this.code = code; return this; }, json(body) { this.body = body; } };
    await context.module.exports[kind === 'benefitCap' ? 'updateCap' : 'updateRate']({ body: { amount }, user: { username: 'admin' } }, res);
    return res;
  } };
}

for (const kind of ['benefitCap', 'deduction']) {
test(`${kind} preserves the full comma-formatted amount and decimal cents`, async () => {
  const { saved, submit } = harness(kind);
  for (const [input, expected] of [['10,000', 10000], [' 10,000.50 ', 10000.5], ['10000', 10000], [10000.5, 10000.5], ['0.01', 0.01]]) {
    assert.equal((await submit(input)).code, 201);
    assert.equal(saved.at(-1).amount, expected);
  }
});

test(`invalid ${kind} amounts fail before superseding or inserting any setting`, async () => {
  const { saved, submit } = harness(kind);
  for (const input of ['100a', 'a100', '10,000x', '10,00', '1,,000', '10 000', '1.234', '1e4', '', ' ', '0', '-10', 'Infinity', Infinity, NaN, null, true, [], {}]) {
    const res = await submit(input);
    assert.equal(res.code, 400, String(input));
    assert.match(res.body.message, /letters are not allowed/);
  }
  assert.equal(saved.length, 0);
});
}
