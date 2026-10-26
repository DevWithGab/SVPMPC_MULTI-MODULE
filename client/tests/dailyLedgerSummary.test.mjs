import test from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { createServer } from 'vite';
import { MemoryRouter } from 'react-router-dom';
import { dailySummaryCsv, dailySummaryPdf } from '../src/utils/dailyLedgerSummary.js';

const data = (date, count = 65) => ({ date, timezone: 'Asia/Manila', totals: { totalAdded: count * 100, members: count, transactions: count, pendingEdits: 0 }, rows: Array.from({ length: count }, (_, index) => ({ id: `L${index}`, memberId: String(index).padStart(6, '0'), memberName: `Member ${index}`, reference: `OR-${index}`, transactionType: 'contribution', amount: 100 })) });

test('daily CSV and printed summary include all pages, exact totals and safe text without audit reasons', () => {
  const summary = data('2026-10-27', 130);
  summary.rows[0].memberName = '=FORMULA("test")';
  summary.rows[0].reason = 'Private edit reason';
  const csv = dailySummaryCsv(summary);
  assert.ok(csv.startsWith('\uFEFF'));
  assert.ok(csv.includes('"000000"'));
  assert.ok(csv.includes("'=FORMULA"));
  assert.ok(csv.includes('OR-129'));
  assert.ok(csv.includes('"Total added","13000"'));
  assert.equal(csv.includes('Private edit reason'), false);
  const doc = dailySummaryPdf(summary);
  assert.equal(doc.lastAutoTable.body.length, 130);
  assert.ok(doc.getNumberOfPages() > 1);
  const text = doc.internal.pages.flat().join('\n');
  assert.ok(text.includes('OR-129'));
  assert.equal(text.includes('Private edit reason'), false);
  assert.doesNotMatch(text, /Deductions|withdrawals|Net ledger change|Adjustment debits/);
  assert.doesNotMatch(csv, /Deductions|withdrawals|Net ledger change|Adjustment debits/);
  assert.ok(text.includes('13,000.00'));
  assert.equal(doc.lastAutoTable.columns.length, 5);
});

test('daily screen paginates, changes dates, hides failed results and retries without stale totals', async () => {
  const vite = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  const container = document.createElement('div'); document.body.append(container);
  const root = createRoot(container);
  const originalAct = globalThis.IS_REACT_ACT_ENVIRONMENT;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  let api, originalGet;
  try {
    ({ default: api } = await vite.ssrLoadModule('/src/services/api.js')); originalGet = api.get;
    let fail = false;
    const dates = [];
    api.get = async (url, options) => {
      assert.equal(url, '/mortuary/treasurer/ledger/daily-summary');
      dates.push(options.params.date);
      if (fail) throw new Error('Summary unavailable');
      return { data: { success: true, data: data(options.params.date, options.params.date === '2026-10-27' ? 65 : 0) } };
    };
    const { default: DailyLedgerSummary } = await vite.ssrLoadModule('/src/components/mortuary/treasurer/DailyLedgerSummary.jsx');
    await act(async () => root.render(React.createElement(MemoryRouter, { initialEntries: ['/?dailyDate=2026-10-27'] }, React.createElement(DailyLedgerSummary))));
    assert.equal(container.querySelectorAll('tbody tr').length, 50);
    assert.match(container.textContent, /6,500\.00/);
    assert.doesNotMatch(container.textContent, /Deductions|withdrawals|Net ledger change/);
    assert.equal(container.querySelectorAll('thead th').length, 5);
    await act(async () => container.querySelector('button[aria-label="Next page"]').click());
    assert.equal(container.querySelectorAll('tbody tr').length, 15);
    assert.match(container.textContent, /OR-64/);
    const input = container.querySelector('input[type="date"]');
    await act(async () => {
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(input, '2026-10-28');
      input.dispatchEvent(new window.Event('input', { bubbles: true }));
    });
    assert.equal(dates.at(-1), '2026-10-28');
    assert.match(container.textContent, /No amounts added/);
    const button = label => [...container.querySelectorAll('button')].find(node => node.textContent === label);
    fail = true;
    await act(async () => button('Refresh summary').click());
    assert.match(container.querySelector('[role="alert"]').textContent, /Summary unavailable/);
    assert.equal(button('Print summary').disabled, true);
    assert.equal(button('Download PDF').disabled, true);
    assert.equal(button('Download CSV').disabled, true);
    assert.equal(container.querySelector('table'), null);
    fail = false;
    await act(async () => button('Refresh summary').click());
    assert.match(container.textContent, /No amounts added/);
    assert.equal(button('Download CSV').disabled, false);
    assert.equal(button('Download PDF').disabled, false);
  } finally {
    await act(async () => root.unmount()); if (api) api.get = originalGet;
    globalThis.IS_REACT_ACT_ENVIRONMENT = originalAct; container.remove(); await vite.close();
  }
});
