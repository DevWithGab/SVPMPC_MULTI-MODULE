import test from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { createServer } from 'vite';
import { deductionTrend } from '../src/utils/dashboardMetrics.js';

test('claims dashboard renders fund cards and member graph while retaining claim actions', async () => {
  const vite = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  const previousAct = globalThis.IS_REACT_ACT_ENVIRONMENT;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  let api, original;
  try {
    ({ mortuaryDashboardAPI: api } = await vite.ssrLoadModule('/src/services/api.js'));
    original = api.getAdminDashboard;
    api.getAdminDashboard = async () => ({ data: { claims: { pending_requirements: 2, pending_deduction: 1 }, recentClaimActivities: [{ claimId: 'CLM-001', memberName: 'Sample Member', status: 'pending_deduction', changedBy: 'Claims Officer', changedAt: '2026-10-27T14:06:00Z' }], claimsNeedingAttention: [], monthlyDeductions: [{ month: deductionTrend([]).at(-1).fullKey, totalCollected: 2500, claimCount: 2 }] } });
    const { default: Dashboard } = await vite.ssrLoadModule('/src/components/mortuary/admin/Dashboard.jsx');
    const destinations = [];
    const props = { stats: { fundBalance: -100, totalCollected: 500, activeMembers: 1 }, contributions: [],
      members: [{ id: 1, name: 'Sample', status: 'active', currentBalance: -100 }, { id: 2, status: 'deceased' }],
      setActiveTab: tab => destinations.push(tab) };
    await act(async () => root.render(React.createElement(Dashboard, props)));
    assert.equal(container.querySelector('h1').textContent, 'Dashboard');
    assert.match(container.querySelector('.td-chart-panel').textContent, /Monthly deductions/);
    assert.match(container.querySelector('.td-chart-footer').textContent, /2,500\.00/);
    assert.equal(container.querySelectorAll('.td-stat-card').length, 3);
    assert.equal(container.querySelector('.td-stat-card-2 dd').textContent, '1');
    assert.match(container.querySelector('.td-stat-card-2').textContent, /Pending deductions/);
    assert.equal(container.querySelector('.td-stat-card-0 dd').getAttribute('data-negative'), 'true');
    assert.equal(container.querySelector('.td-member-graph').getAttribute('aria-label'), 'Member status distribution: 1 active, 0 inactive, 1 deceased');
    assert.equal(container.querySelector('.td-donut-value').textContent, '2');
    const activity = container.querySelector('.mad-recent-table tbody tr');
    assert.match(activity.textContent, /Sample Member/);
    assert.match(activity.textContent, /CLM-001/);
    assert.match(activity.textContent, /Pending Deduction/);
    assert.match(activity.textContent, /Claims Officer/);
    assert.equal(activity.querySelector('time').dateTime, '2026-10-27T14:06:00Z');
    const manage = [...container.querySelectorAll('button')].find(button => button.textContent.includes('Manage claims'));
    await act(async () => manage.click());
    const pending = [...container.querySelectorAll('.mad-claim-list button')].find(button => button.textContent.includes('Pending requirements'));
    assert.match(pending.textContent, /2/);
    await act(async () => pending.click());
    assert.deepEqual(destinations, ['claims', 'claims']);
    await act(async () => root.render(React.createElement(Dashboard, { ...props, members: [] })));
    assert.match(container.querySelector('[aria-labelledby="mad-members-title"]').textContent, /No member data available yet/);
    assert.doesNotMatch(container.querySelector('.td-member-graph').innerHTML, /NaN|Infinity/);
  } finally {
    await act(async () => root.unmount());
    if (api) api.getAdminDashboard = original;
    globalThis.IS_REACT_ACT_ENVIRONMENT = previousAct;
    container.remove();
    await vite.close();
  }
});
