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

test('caps uploads at 1000 entries, matching the other bulk-upload importers', () => {
  const row = (i) => valid.replace('OR-1', `OR-${i}`);
  assert.throws(() => parseLedgerCsv(`${header}\n${Array.from({ length: 1001 }, (_, i) => row(i)).join('\n')}`), /Maximum 1000/);
  assert.doesNotThrow(() => parseLedgerCsv(`${header}\n${Array.from({ length: 1000 }, (_, i) => row(i)).join('\n')}`));
});

test('marks exact duplicate rows for skipping and rejects partial numeric values', () => {
  const rows = parseLedgerCsv(`${header}\n${valid}\n${valid}\n${valid.replace('100.00', '100abc')}`);
  assert.equal(rows[1].status, 'duplicate');
  assert.deepEqual(rows[1].errors, []);
  assert.match(rows[2].errors.join(' '), /credit/);
});

function controller() {
  const saved = [], payments = [];
  const failSaves = new Set(), failReports = new Set();
  const existing = [{ ledgerId: 'OLD-1', memberId: '000123', transactionType: 'contribution', transactionDate: new Date('2026-10-21T00:00:00.000Z'), credit: 100, debit: 0, balance: 100, referenceId: 'EXISTING', paymentMethod: 'cash' }];
  function matches(doc, query) {
    return Object.entries(query).every(([field, value]) => {
      if (field === '$or') return value.some(branch => matches(doc, branch));
      const comparable = item => item instanceof Date ? item.toISOString() : item;
      return value && typeof value === 'object' && '$in' in value
        ? value.$in.some(item => comparable(item) === comparable(doc[field]))
        : comparable(doc[field]) === comparable(value);
    });
  }
  class Ledger {
    constructor(entry) { Object.assign(this, entry); }
    async save() {
      if (failSaves.delete(this.referenceId)) throw new Error('Synthetic save failure');
      if ([...existing, ...saved].some(row => row.ledgerId === this.ledgerId || (this.importKey && row.importKey === this.importKey))) {
        const error = new Error('Duplicate key'); error.code = 11000; throw error;
      }
      saved.push(this);
    }
    static async find(query) { return [...existing, ...saved].filter(row => matches(row, query)); }
    static async findOne(query) { return (await this.find(query))[0] || null; }
  }
  const Contribution = {
    find: async query => payments.filter(row => matches(row, query)),
    updateOne: async (query, update) => {
      if (failReports.delete(update.$setOnInsert.referenceNumber)) throw new Error('Synthetic reporting failure');
      if (!payments.some(row => matches(row, query))) payments.push(update.$setOnInsert);
    },
  };
  const filename = require.resolve('../modules/mortuary/controllers/ledgerController');
  const localRequire = createRequire(filename);
  const dependencies = {
    '../models/Ledger': Ledger, '../models/Contribution': Contribution,
    '../../../shared/models': { Member: { find: async query => query.memberId.$in.includes('000123') ? [{ memberId: '000123', memberName: 'Member One' }] : [] } },
    '../utils/ledgerBalance': {
      getLatestBalance: async () => 0,
      getLatestBalancesByMember: async ids => new Map(ids.map(id => [id, [...existing, ...saved].filter(row => row.memberId === id).at(-1)?.balance || 0])),
    },
  };
  const context = { module: { exports: {} }, console, require: name => dependencies[name] || localRequire(name) };
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), context, { filename });
  return { saved, payments, failSaves, failReports, upload: context.module.exports.bulkUploadLedger };
}
const response = () => ({ code: 200, status(code) { this.code = code; return this; }, json(data) { this.data = data; return this; } });

test('preview checks database members and existing entries without writing', async () => {
  const { saved, upload } = controller();
  const res = response();
  await upload({ body: { action: 'preview', csv: `${header}\n${valid}\n${valid.replace('000123', 'UNKNOWN')}\n${valid.replace('OR-1', 'EXISTING')}` } }, res);
  assert.equal(res.data.summary.ready, 1);
  assert.equal(res.data.summary.invalid, 1);
  assert.equal(res.data.summary.duplicates, 1);
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
  assert.equal(saved[0].balance, 200);
  assert.equal(res.data.rows[0].status, 'imported');
});

const runUpload = async (db, lines, action = 'import') => {
  const res = response();
  await db.upload({ body: { action, csv: `${header}\n${lines.join('\n')}` }, user: { username: 'treasurer.test' } }, res);
  return res;
};

test('imports new rows alongside stored and in-file duplicates, then skips a full re-upload', async () => {
  const db = controller();
  const lines = [valid.replace('OR-1', 'EXISTING'), valid, valid];
  const first = await runUpload(db, lines);
  assert.equal(first.code, 200);
  assert.equal(first.data.summary.imported, 1);
  assert.equal(first.data.summary.duplicates, 2);
  assert.equal(db.saved.length, 1);
  assert.equal(db.saved[0].balance, 200);
  assert.equal(db.saved[0].recordedBy, 'treasurer.test');
  assert.equal(db.payments.length, 1);
  assert.equal(db.payments[0].amount, 100);
  assert.equal(db.payments[0].paymentDate.toISOString().slice(0, 10), '2026-10-21');
  const second = await runUpload(db, lines);
  assert.equal(second.data.summary.imported, 0);
  assert.equal(second.data.summary.duplicates, 3);
  assert.equal(second.data.results.skipped.length, 3);
  assert.equal(db.saved.length, 1);
  assert.equal(db.payments.length, 1);
});

test('appending the next daily transaction imports just the new row', async () => {
  const db = controller();
  await runUpload(db, [valid]);
  const next = valid.replace('OR-1', 'OR-2').replace('2026-10-21', '2026-10-22').replace('100.00', '150.00');
  const result = await runUpload(db, [valid, next]);
  assert.equal(result.data.summary.imported, 1);
  assert.equal(result.data.summary.duplicates, 1);
  assert.equal(db.saved.at(-1).balance, 350);
  assert.equal(db.payments.length, 2);
});

test('same-day payments with different references are both recorded', async () => {
  const db = controller();
  const result = await runUpload(db, [valid, valid.replace('OR-1', 'OR-2')]);
  assert.equal(result.data.summary.imported, 2);
  assert.equal(db.saved.at(-1).balance, 300);
});

test('changed amounts or dates on an existing reference are errors, never extra credits or overwrites', async () => {
  const db = controller();
  await runUpload(db, [valid]);
  for (const changed of [valid.replace('100.00', '200.00'), valid.replace('2026-10-21', '2026-10-22')]) {
    const result = await runUpload(db, [changed]);
    assert.equal(result.code, 400);
    assert.match(result.data.rows[0].errors.join(' '), /different transaction details/);
  }
  assert.equal(db.saved.length, 1);
  assert.equal(db.saved[0].credit, 100);
});

test('conflicting references or ledger IDs within one file block imports', async () => {
  const conflict = parseLedgerCsv(`${header}\n${valid}\n${valid.replace('100.00', '200.00')}`);
  assert.equal(conflict[1].status, 'error');
  const idConflict = parseLedgerCsv(`${header},ledgerId\n${valid},ID-1\n${valid.replace('OR-1', 'OR-2')},ID-1`);
  assert.equal(idConflict[1].status, 'error');
});

test('failed ledger saves do not inflate later running balances', async () => {
  const db = controller();
  db.failSaves.add('OR-1');
  const second = valid.replace('OR-1', 'OR-2').replace('100.00', '50.00');
  const result = await runUpload(db, [valid, second]);
  assert.equal(result.data.summary.failed, 1);
  assert.equal(result.data.summary.imported, 1);
  assert.equal(db.saved[0].balance, 150);
  const retry = await runUpload(db, [valid, second]);
  assert.equal(retry.data.summary.imported, 1);
  assert.equal(retry.data.summary.duplicates, 1);
  assert.equal(db.saved.at(-1).balance, 250);
});

test('payment history failure resumes without writing another ledger credit', async () => {
  const db = controller();
  db.failReports.add('OR-1');
  const first = await runUpload(db, [valid]);
  assert.equal(first.data.summary.failed, 1);
  assert.equal(db.saved.length, 1);
  assert.equal(db.payments.length, 0);
  const preview = await runUpload(db, [valid], 'preview');
  assert.equal(preview.data.rows[0].status, 'resume');
  const retry = await runUpload(db, [valid]);
  assert.equal(retry.data.summary.imported, 1);
  assert.equal(db.saved.length, 1);
  assert.equal(db.saved[0].balance, 200);
  assert.equal(db.payments.length, 1);
});

test('concurrent copies of the same upload record one credit and one payment', async () => {
  const db = controller();
  const results = await Promise.all([runUpload(db, [valid]), runUpload(db, [valid])]);
  assert.equal(results.reduce((sum, result) => sum + result.data.summary.imported, 0), 1);
  assert.equal(results.reduce((sum, result) => sum + result.data.summary.duplicates, 0), 1);
  assert.equal(db.saved.length, 1);
  assert.equal(db.payments.length, 1);
});

test('opening adjustments remain ledger-only and legacy reference-free duplicates are skipped', async () => {
  const db = controller();
  const adjustment = valid.replace(',contribution,OR-1,', ',adjustment,,');
  await runUpload(db, [adjustment]);
  const result = await runUpload(db, [adjustment]);
  assert.equal(result.data.summary.duplicates, 1);
  assert.equal(db.saved.length, 1);
  assert.equal(db.payments.length, 0);
});
