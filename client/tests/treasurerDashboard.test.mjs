import test from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { createServer } from 'vite';

test('dashboard actions keep their destinations and preserve configured totals and unavailable claims states', async () => {
  const vite = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  const previousAct = globalThis.IS_REACT_ACT_ENVIRONMENT;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const navigations = [];
  let refreshes = 0;
  try {
    const { default: Dashboard } = await vite.ssrLoadModule('/src/components/mortuary/treasurer/Dashboard.jsx');
    const props = {
      user: { name: 'Finance Staff' },
      stats: { fundBalance: -1234.56, activeMembers: 10, totalMembers: 12, lowBalanceMembers: 3, minimumBalance: 1500,
        memberStanding: { atRisk: 2, negativeBalance: 1 }, statusComposition: { active: 10, inactive: 1, deceased: 1 }, totalDeductionsCollected: 500 },
      contributions: [], claimsCounts: { pendingDeduction: 4 }, setActiveTab: tab => navigations.push(tab), onRefresh: () => refreshes++,
    };
    const render = overrides => act(async () => root.render(React.createElement(Dashboard, { ...props, ...overrides })));
    const button = text => [...container.querySelectorAll('button')].find(item => item.textContent.trim() === text);
    await render();
    assert.match(container.textContent, /₱-1,234\.56/);
    assert.match(container.textContent, /Balances below ₱1,500/);
    assert.match(container.textContent, /70%/);
    assert.match(container.textContent, /7 of 10 active members/);
    assert.match(container.textContent, /Includes 2 at risk and 1 with negative balances/);
    assert.match(container.querySelector('.td-details').textContent, /Total deductions collected/);
    for (const label of ['Open member ledger', 'Review claims', 'View balances', 'Mortuary reportsReview fund activity and export records.']) {
      await act(async () => button(label).click());
    }
    assert.deepEqual(navigations, ['ledger', 'claims', 'members', 'reports']);
    await act(async () => button('Refresh').click());
    assert.equal(refreshes, 1);
    await render({ refreshing: true });
    assert.equal(button('Refreshing…').disabled, true);
    await render({ claimsCounts: null });
    assert.match(container.querySelector('.td-attention').textContent, /Loading claim counts/);
    await render({ claimsCounts: null, claimsError: 'Unavailable' });
    assert.match(container.querySelector('.td-attention').textContent, /Unable to load claim counts/);
    await render({ claimsCounts: { pendingDeduction: 0 } });
    assert.match(container.querySelector('.td-attention').textContent, /No claims pending deduction/);
  } finally {
    await act(async () => root.unmount());
    globalThis.IS_REACT_ACT_ENVIRONMENT = previousAct;
    container.remove();
    await vite.close();
  }
});
