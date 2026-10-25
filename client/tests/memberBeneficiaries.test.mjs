import test from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { createServer } from 'vite';

test('member beneficiary action opens only the selected member and returns to the same directory page', async () => {
  const vite = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  const previousAct = globalThis.IS_REACT_ACT_ENVIRONMENT;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  let api, original;
  try {
    const { default: MemberManagement } = await vite.ssrLoadModule('/src/components/mortuary/admin/MemberManagement.jsx');
    ({ beneficiaryAPI: api } = await vite.ssrLoadModule('/src/services/api.js'));
    original = api.getHistory;
    const requests = [], destinations = [];
    let fail = false;
    api.getHistory = async memberId => {
      requests.push(memberId);
      if (fail) throw new Error('Test failure');
      return { data: memberId === '00101' ? [{ beneficiaryId: 'BEN-101', beneficiaryName: 'Selected Beneficiary', relationship: 'Spouse', contactNumber: '09171234567', isActive: true, effectiveFrom: '2026-10-01' }] : [] };
    };
    const members = Array.from({ length: 102 }, (_, i) => ({ id: String(i + 1).padStart(5, '0'), name: `Member ${i + 1}`, status: 'active' }));
    await act(async () => root.render(React.createElement(MemberManagement, {
      members, filteredMembers: members, statusFilter: 'active', searchQuery: 'Member',
      setStatusFilter: () => {}, setSearchQuery: () => {}, setActiveTab: tab => destinations.push(tab),
    })));
    const click = async selector => {
      const button = container.querySelector(selector);
      assert.ok(button, selector);
      await act(async () => button.click());
    };
    await click('[aria-label="Next page"]');
    await click('[aria-label="View beneficiaries for Member 101"]');
    assert.deepEqual(requests, ['00101']);
    assert.deepEqual(destinations, []);
    assert.match(container.textContent, /Selected Beneficiary/);
    assert.match(container.textContent, /Passbook No\. 00101/);
    assert.match(container.textContent, /Mortuary management \/ Members/);
    const back = () => [...container.querySelectorAll('button')].find(button => button.textContent.includes('Back to members'));
    await act(async () => back().click());
    assert.equal(container.querySelector('[aria-current="page"]').getAttribute('aria-label'), 'Page 2');
    assert.equal(container.querySelector('input').value, 'Member');
    assert.equal(container.querySelector('select').value, 'active');
    fail = true;
    await click('[aria-label="View beneficiaries for Member 102"]');
    assert.match(container.querySelector('[role="alert"]').textContent, /Unable to load beneficiary history/);
    fail = false;
    await act(async () => [...container.querySelectorAll('button')].find(button => button.textContent === 'Try again').click());
    assert.match(container.textContent, /No beneficiary records for this member/);
    assert.doesNotMatch(container.textContent, /Selected Beneficiary/);
    assert.deepEqual(requests, ['00101', '00102', '00102']);
    assert.deepEqual(destinations, []);
  } finally {
    await act(async () => root.unmount());
    if (api && original) api.getHistory = original;
    container.remove();
    globalThis.IS_REACT_ACT_ENVIRONMENT = previousAct;
    await vite.close();
  }
});
