const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const { parseLedgerCsv } = require('../modules/mortuary/utils/ledgerCsv');
const header = 'Passbook No.,transactionDate,credit,debit,description,transactionType,referenceId,paymentMethod';
const valid = '000123,2026-10-21,100.00,0,"Member, contribution",contribution,OR-1,cash';

test('ledger CSV preserves passbook zeros, quoted fields, BOM, and source row numbers', () => {
  const [row] = parseLedgerCsv(`\uFEFF${header}\r\n${valid}\r\n`);
  assert.equal(row.entry.memberId, '000123');
  assert.equal(row.entry.description, 'Member, contribution');
  assert.equal(row.row, 2);
  assert.deepEqual(row.errors, []);
});

test('rejects wrong headers, empty files, and malformed CSV', () => {
  for (const csv of ['', header, 'name,amount\nJoe,10', `${header}\n"unclosed`, `${header},credit\n${valid},5`]) {
    assert.throws(() => parseLedgerCsv(csv));
  }
});

test('validates all rows, including errors beyond the first five', () => {
  const rows = parseLedgerCsv(`${header}\n${Array.from({ length: 6 }, (_, i) => valid.replace('OR-1', `OR-${i}`)).join('\n')}\n000123,2026-02-30,-10,5,Invalid,wrong,OR-7,bank`);
  assert.equal(rows[6].row, 8);
  assert.ok(rows[6].errors.length >= 4);
  assert.equal(rows[0].errors.length, 0);
});

test('rejects duplicate rows and partial numeric values instead of silently truncating them', () => {
  const rows = parseLedgerCsv(`${header}\n${valid}\n${valid}\n${valid.replace('100.00', '100abc')}`);
  assert.match(rows[1].errors.join(' '), /Duplicate/);
  assert.match(rows[2].errors.join(' '), /credit/);
});

function controller() {
  const saved = [];
  class Ledger {
    constructor(entry) { Object.assign(this, entry); }
    async save() { saved.push(this); }
    static async findOne(query) { return query.referenceId === 'EXISTING' ? { ledgerId: 'existing' } : null; }
  }
  const filename = require.resolve('../modules/mortuary/controllers/ledgerController');
  const localRequire = createRequire(filename);
  const dependencies = {
    '../models/Ledger': Ledger,
    '../../../shared/models': { Member: { findOne: async query => query.memberId === '000123' ? { memberName: 'Member One' } : null } },
    '../utils/ledgerBalance': { getLatestBalance: async () => 0 },
  };
  const context = { module: { exports: {} }, console, require: name => dependencies[name] || localRequire(name) };
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), context, { filename });
  return { saved, upload: context.module.exports.bulkUploadLedger };
}
const response = () => ({ code: 200, status(code) { this.code = code; return this; }, json(data) { this.data = data; return this; } });

test('preview checks database members and existing entries without writing', async () => {
  const { saved, upload } = controller();
  const res = response();
  await upload({ body: { action: 'preview', csv: `${header}\n${valid}\n${valid.replace('000123', 'UNKNOWN')}\n${valid.replace('OR-1', 'EXISTING')}` } }, res);
  assert.equal(res.data.summary.ready, 1);
  assert.equal(res.data.summary.invalid, 2);
  assert.equal(saved.length, 0);
});

test('import revalidates the entire file and blocks all writes if any row is invalid', async () => {
  const { saved, upload } = controller();
  const res = response();
  await upload({ body: { action: 'import', csv: `${header}\n${valid}\n${valid.replace('000123', 'UNKNOWN')}` } }, res);
  assert.equal(res.code, 400);
  assert.equal(saved.length, 0);
});

test('valid import saves all rows and reports recorded status', async () => {
  const { saved, upload } = controller();
  const res = response();
  await upload({ body: { action: 'import', csv: `${header}\n${valid}` } }, res);
  assert.equal(res.code, 200);
  assert.equal(saved.length, 1);
  assert.equal(saved[0].balance, 100);
  assert.equal(res.data.rows[0].status, 'imported');
});
