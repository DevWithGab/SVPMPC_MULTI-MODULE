const test = require('node:test');
const assert = require('node:assert/strict');
const { dailyRange, summarizeDay, createDailyLedgerSummaryService } = require('../modules/mortuary/services/dailyLedgerSummaryService');

test('date ranges use Philippine midnight and reject invalid dates and query operators', () => {
  const range = dailyRange('2026-10-27');
  assert.equal(range.start.toISOString(), '2026-10-26T16:00:00.000Z');
  assert.equal(range.end.toISOString(), '2026-10-27T16:00:00.000Z');
  for (const value of [undefined, {}, ['2026-10-27'], '2026-02-30', '2026-2-3', 'bad']) assert.throws(() => dailyRange(value), error => error.status === 400);
});

const entry = (id, type, credit, debit, memberId = '0001') => ({ ledgerId: id, memberId, transactionType: type, credit, debit, referenceId: `REF-${id}` });
test('totals separate contributions and adjustments, count members once, and apply latest edits without extra transactions', () => {
  const originals = [entry('A', 'contribution', 1000, 0), entry('B', 'contribution', 200, 0, '0002'), entry('C', 'automatic_deduction', 0, 50), entry('D', 'adjustment', 1000, 0), entry('E', 'adjustment', 0, 25)];
  const edits = [
    { _id: '2', createdAt: new Date('2026-10-28'), correction: { rootLedgerId: 'A', afterAmount: 150, completed: false } },
    { _id: '1', createdAt: new Date('2026-10-27'), correction: { rootLedgerId: 'A', afterAmount: 100, completed: true } },
    { _id: '3', createdAt: new Date('2026-10-29'), correction: { rootLedgerId: 'D', afterAmount: 500, completed: true } },
  ];
  const result = summarizeDay('2026-10-26', originals, edits, [{ memberId: '0001', memberName: 'Member One' }], new Map([['A', 'OR-001']]));
  assert.deepEqual(result.totals, { contributions: 350, deductions: 50, adjustmentCredits: 500, adjustmentDebits: 25, netChange: 775, members: 2, transactions: 5, pendingEdits: 1 });
  assert.equal(result.rows.find(row => row.id === 'A').reference, 'OR-001');
  assert.equal(result.rows.find(row => row.id === 'B').memberName, 'Member record unavailable');
  assert.equal(JSON.stringify(result).includes('reason'), false);
  assert.equal(summarizeDay('2026-10-27', [], [], []).totals.netChange, 0);
});

test('service selects transaction date rather than upload date, excludes correction postings, and fetches later edits', async () => {
  const range = dailyRange('2026-10-27');
  const all = [
    { ...entry('before', 'contribution', 100, 0), transactionDate: new Date(range.start - 1) },
    { ...entry('start', 'contribution', 100, 0), transactionDate: range.start, createdAt: new Date('2026-11-02') },
    { ...entry('csv', 'contribution', 200, 0), transactionDate: new Date('2026-10-27T00:00:00Z') },
    { ...entry('end', 'contribution', 300, 0), transactionDate: range.end },
    { ...entry('edit', 'adjustment', 50, 100), transactionDate: range.start, correction: { rootLedgerId: 'start', afterAmount: 50, completed: true }, createdAt: new Date('2026-11-03') },
  ];
  const queries = [];
  const service = createDailyLedgerSummaryService({
    Ledger: { find: async query => {
      queries.push(query);
      return query.transactionDate ? all.filter(row => !row.correction && row.transactionDate >= query.transactionDate.$gte && row.transactionDate < query.transactionDate.$lt) : all.filter(row => query['correction.rootLedgerId'].$in.includes(row.correction?.rootLedgerId));
    } },
    Member: { find: () => ({ select: () => ({ lean: async () => [{ memberId: '0001', memberName: 'Member One' }] }) }) },
  });
  const result = await service('2026-10-27');
  assert.deepEqual(result.rows.map(row => row.id).sort(), ['csv', 'start']);
  assert.equal(result.totals.contributions, 250);
  assert.deepEqual(queries[0].correction, { $exists: false });
  assert.equal(queries.length, 2);
});
