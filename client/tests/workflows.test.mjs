import test from 'node:test';
import assert from 'node:assert/strict';
import { contributionTrend, contributionGrowth, memberBalanceCoverage } from '../src/utils/dashboardMetrics.js';
import { readSession, portalPath, readUrlValue, updateUrlValue } from '../src/utils/navigation.js';
import { loadAllPages } from '../src/utils/loadAllPages.js';

test('coverage uses active members and does not invent a percentage for an empty membership', () => {
  assert.equal(memberBalanceCoverage({ activeMembers: 10, totalMembers: 100, lowBalanceMembers: 3 }), 70);
  assert.equal(memberBalanceCoverage({ activeMembers: 0 }), null);
  assert.equal(memberBalanceCoverage({ activeMembers: 10, lowBalanceMembers: 12 }), 0);
});

test('contribution totals include zero months, paid amounts only, and a six-month cumulative total', () => {
  const rows = contributionTrend([
    { payment_date: '2026-05-01', amount: '100', status: 'paid' },
    { payment_date: '2026-09-01', amount: 50, status: 'paid' },
    { payment_date: '2026-09-01', amount: 200, status: 'pending' },
    { payment_date: '2026-01-01', amount: 500, status: 'paid' },
  ], new Date('2026-09-22T00:00:00Z'));
  assert.equal(rows.length, 6);
  assert.deepEqual(rows.map(row => row.contributions), [0, 100, 0, 0, 0, 50]);
  assert.equal(rows.at(-1).cumulative, 150);
  assert.equal(rows.reduce((sum, row) => sum + row.count, 0), 2);
  assert.equal(contributionGrowth(rows), null);
});

test('reporting month uses Manila time at the year boundary', () => {
  const rows = contributionTrend([], new Date('2025-12-31T16:30:00Z'));
  assert.equal(rows.at(-1).fullKey, '2026-01');
  assert.equal(rows[0].fullKey, '2025-08');
  assert.equal(rows.at(-1).cumulative, 0);
  assert.equal(contributionGrowth([{ contributions: 100 }, { contributions: 0 }]), -100);
});

test('session recovery tolerates malformed storage and rejects a mismatched role', () => {
  const storage = values => ({ getItem: key => values[key] ?? null });
  assert.equal(readSession(storage({ user: '{broken' })), null);
  const values = { token: 'test', user: JSON.stringify({ role: 'treasurer' }), selectedModule: JSON.stringify({ module: 'mortuary', role: 'treasurer' }) };
  assert.equal(readSession(storage(values)).role, 'treasurer');
  assert.equal(readSession(storage({ ...values, user: JSON.stringify({ role: 'secretary' }) })), null);
  assert.equal(portalPath('attendance', 'treasurer'), '/');
});

test('URLs restore tabs and details, clear unrelated selections, and encode member IDs', () => {
  const ledger = updateUrlValue('?tab=claims&claim=CL-1', 'tab', 'ledger', 'dashboard', { member: 'M 1/2' });
  assert.equal(readUrlValue(ledger, 'tab', 'dashboard', ['dashboard', 'ledger']), 'ledger');
  assert.equal(readUrlValue(ledger, 'member', null), 'M 1/2');
  assert.equal(readUrlValue(ledger, 'claim', null), null);
  assert.equal(updateUrlValue(ledger, 'tab', 'dashboard', 'dashboard'), '');
  assert.equal(readUrlValue('?tab=unknown', 'tab', 'dashboard', ['dashboard']), 'dashboard');
});

test('all pages contribute to totals; a failed later page never returns partial records', async () => {
  const pages = [];
  const records = await loadAllPages(async page => {
    pages.push(page);
    return { success: true, data: [{ amount: page * 10 }], pagination: { totalPages: 3 } };
  });
  assert.deepEqual(pages, [1, 2, 3]);
  assert.equal(records.reduce((sum, row) => sum + row.amount, 0), 60);
  await assert.rejects(loadAllPages(async page => page === 1
    ? { success: true, data: [1], pagination: { totalPages: 2 } }
    : { success: false }), /complete records/);
});
