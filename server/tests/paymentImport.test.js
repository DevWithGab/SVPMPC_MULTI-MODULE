const test = require('node:test');
const assert = require('node:assert/strict');
const { parsePaymentCsv } = require('../modules/mortuary/utils/paymentCsv');
const { createPaymentImportService, paymentId } = require('../modules/mortuary/services/paymentImportService');

const header = 'member_id,amount,payment_date,reference_number,payment_method,notes';
const parse = (...lines) => parsePaymentCsv([header, ...lines].join('\n'));
const payment = (member = '001', amount = '100.25', reference = 'OR-1') => `${member},${amount},2026-10-05,${reference},cash,Daily payment`;

function database() {
  const state = {
    members: [{ memberId: '001', memberName: 'Member One', phoneNumber: 'test' }, { memberId: '002', memberName: 'Member Two' }],
    contributions: [], ledgers: [], reservations: [], notifications: [], failContribution: false,
  };
  const matches = (item, query) => Object.entries(query).every(([key, value]) =>
    value && typeof value === 'object' && '$in' in value ? value.$in.includes(item[key]) : item[key] === value);
  const model = name => ({
    find: query => ({ lean: async () => state[name].filter(item => matches(item, query)) }),
    findOne: async query => state[name].find(item => matches(item, query)),
    findById: async id => state[name].find(item => item._id === id),
    findOneAndUpdate: async (query, update) => {
      let item = state[name].find(item => matches(item, query));
      if (!item) { item = { ...query, ...update.$setOnInsert }; state[name].push(item); }
      return item;
    },
    updateOne: async (query, update) => {
      if (state.failContribution) throw new Error('Simulated contribution write failure');
      if (!state[name].some(item => matches(item, query))) state[name].push({ ...query, ...update.$setOnInsert });
    },
  });
  const dependencies = {
    Member: model('members'), Contribution: model('contributions'), Ledger: model('ledgers'), PaymentImport: model('reservations'),
    getLatestBalance: async memberId => state.ledgers.filter(row => row.memberId === memberId).at(-1)?.balance || 0,
    checkAndNotify: async (...args) => { state.notifications.push(args); },
  };
  return { state, service: createPaymentImportService(dependencies), dependencies };
}

test('CSV preserves leading-zero IDs and handles BOM, CRLF, quoted commas, escaped quotes and multiline notes', () => {
  const [row] = parsePaymentCsv('\uFEFFMemberId,Amount,PaymentDate,ReferenceNumber,Notes\r\n001,100.25,2026-10-05,OR-1,"Daily, ""cash""\r\npayment"\r\n');
  assert.deepEqual(row.errors, []);
  assert.equal(row.entry.memberId, '001');
  assert.equal(row.entry.amount, 100.25);
  assert.equal(row.entry.paymentMethod, 'cash');
  assert.equal(row.entry.notes, 'Daily, "cash"\r\npayment');
  assert.equal(parsePaymentCsv(`${header}\n\n${payment()}`)[0].row, 3);
});

test('CSV rejects malformed structure, missing headers, duplicate headers, empty and oversized uploads', () => {
  for (const csv of ['', header, 'member_id,amount\n001,10', `${header}\n"unclosed`, `${header}\n"001"bad,10,2026-10-05,OR-1,cash,`, 'member_id,member_id,amount,payment_date,reference_number\n001,001,1,2026-10-05,OR-1']) {
    assert.throws(() => parsePaymentCsv(csv));
  }
  assert.throws(() => parsePaymentCsv('x'.repeat(1024 * 1024 + 1)), /1 MB/);
  assert.throws(() => parse(...Array.from({ length: 501 }, (_, i) => payment('001', '10', `OR-${i}`))), /500/);
});

test('CSV validates each amount, real date, reference, method, and repeated receipt', () => {
  for (const amount of ['0', '-1', '1.001', 'NaN', 'Infinity', '1e3', '', '9007199254740992']) {
    assert.ok(parse(payment('001', amount))[0].errors.some(error => error.includes('Amount')));
  }
  assert.ok(parse(payment().replace('2026-10-05', '2026-02-30'))[0].errors.some(error => error.includes('date')));
  assert.ok(parse(payment('001', '1', ''))[0].errors.some(error => error.includes('reference')));
  assert.ok(parse(payment().replace(',cash,', ',bank,'))[0].errors.some(error => error.includes('cash')));
  assert.ok(parse(payment(), payment())[1].errors.some(error => error.includes('Repeated')));
});

test('preview resolves members and makes no writes; one unknown member blocks the entire import', async () => {
  const { state, service } = database();
  const rows = parse(payment(), payment('MISSING', '50', 'OR-2'));
  const preview = await service.preview(rows);
  assert.equal(preview[0].memberName, 'Member One');
  assert.equal(preview[1].status, 'error');
  assert.equal(state.ledgers.length, 0);
  const result = await service.importRows(rows, 'treasurer-1');
  assert.equal(result.blocked, true);
  assert.equal(state.ledgers.length, 0);
  assert.equal(state.reservations.length, 0);
});

test('daily payments update both records, accumulate repeat-member credits, preserve payment dates and actor', async () => {
  const { state, service } = database();
  state.ledgers.push({ ledgerId: 'opening', memberId: '001', balance: 500, transactionDate: new Date('2030-01-01') });
  const rows = parse(payment(), payment('002', '50', 'OR-1'), payment('001', '25.50', 'OR-2'));
  const result = await service.importRows(rows, 'treasurer-1');
  assert.deepEqual(result.rows.map(row => row.status), ['imported', 'imported', 'imported']);
  assert.equal(state.contributions.length, 3);
  assert.equal(state.ledgers.at(-1).balance, 625.75);
  assert.equal(state.ledgers[2].balance, 50);
  assert.equal(state.ledgers.at(-1).recordedBy, 'treasurer-1');
  assert.equal(state.contributions[0].paymentDate.toISOString().slice(0, 10), '2026-10-05');
  assert.equal(state.ledgers[1].referenceId, state.contributions[0].contributionId);
  assert.equal(state.notifications.length, 3);
});

test('reordered re-upload skips duplicates and rejects a changed payment using an existing reference', async () => {
  const { state, service } = database();
  const rows = parse(payment(), payment('002', '50', 'OR-2'));
  await service.importRows(rows, 'treasurer-1');
  const retry = await service.importRows([...rows].reverse(), 'treasurer-2');
  assert.deepEqual(retry.rows.map(row => row.status), ['skipped', 'skipped']);
  assert.equal(state.contributions.length, 2);
  assert.equal(state.ledgers.length, 2);
  const conflict = await service.importRows(parse(payment('001', '200')), 'treasurer-2');
  assert.equal(conflict.blocked, true);
  assert.match(conflict.rows[0].errors.join(), /different amount/);
});

test('existing manual payments are recognized by member and receipt', async () => {
  const { state, service } = database();
  state.contributions.push({ ...parse(payment())[0].entry, contributionId: 'manual-payment' });
  assert.equal((await service.preview(parse(payment())))[0].status, 'duplicate');
  await service.importRows(parse(payment()), 'treasurer-1');
  assert.equal(state.ledgers.length, 0);
});

test('retry after contribution write failure and service restart repairs history without another ledger credit', async () => {
  const { state, service, dependencies } = database();
  state.failContribution = true;
  const rows = parse(payment());
  const failed = await service.importRows(rows, 'treasurer-1');
  assert.equal(failed.rows[0].status, 'failed');
  assert.equal(state.ledgers.length, 1);
  assert.equal(state.contributions.length, 0);
  state.failContribution = false;
  const restarted = createPaymentImportService(dependencies);
  assert.equal((await restarted.preview(rows))[0].status, 'resume');
  await restarted.importRows(parse(payment('001', '50', 'OR-2')), 'treasurer-2');
  const repaired = await restarted.importRows(rows, 'treasurer-2');
  assert.equal(repaired.rows[0].status, 'imported');
  assert.equal(state.ledgers.length, 2);
  assert.equal(state.ledgers.at(-1).balance, 150.25);
  assert.equal(state.ledgers[0].recordedBy, 'treasurer-1');
  assert.equal(state.contributions.length, 2);
  assert.equal(state.contributions.find(row => row.contributionId === paymentId(rows[0].entry)).amount, 100.25);
});

test('simultaneous uploads serialize payments for the same member and skip the same receipt', async () => {
  const { state, service } = database();
  await Promise.all([
    service.importRows(parse(payment()), 'treasurer-1'),
    service.importRows(parse(payment()), 'treasurer-2'),
    service.importRows(parse(payment('001', '10', 'OR-2')), 'treasurer-2'),
  ]);
  assert.equal(state.ledgers.length, 2);
  assert.equal(state.contributions.length, 2);
  assert.equal(state.ledgers.at(-1).balance, 110.25);
});
