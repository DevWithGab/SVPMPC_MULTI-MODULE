import test from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { createServer } from 'vite';
import { MemoryRouter, useLocation } from 'react-router-dom';

test('Deduction Summary shows month-end records with each deceased member', async () => {
  const vite = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  const originalAct = globalThis.IS_REACT_ACT_ENVIRONMENT;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  let api, original;
  const claim = (claimId, memberName, beneficiaryName) => ({
    claimId, memberName, beneficiaryName, dateOfDeath: '2026-10-05T00:00:00Z', jvNumber: 'JV-OCT-2026',
    processedAt: '2026-10-31T01:00:00Z', processedBy: 'Treasurer', ratePerClaim: 100, membersCharged: 138, totalCollected: 13800,
  });
  try {
    ({ treasurerAPI: api } = await vite.ssrLoadModule('/src/services/api.js'));
    original = api.getDeductionSummary;
    const calls = [];
    api.getDeductionSummary = async (params = {}) => (calls.push(params), params.month ? {
      data: [{ month: '2026-10', batchCount: 1, claimCount: 2, totalCollected: 27600,
        claims: [{ ...claim('C1', 'Jennifer Salvador', 'Marilyn Salvador'), batchId: 'B1', beneficiaryRelationship: 'Daughter', dateFiled: '2026-10-06T00:00:00Z' },
          { ...claim('C2', 'Zenaida Lacson', 'Lourdes Lacson'), batchId: 'B1' }] }],
      totals: { totalCollected: 27600, claimCount: 2, batchCount: 1 },
    } : {
      data: [
        { month: '2026-10', batchCount: 1, claimCount: 2, totalCollected: 27600,
          claims: [claim('C1', 'Jennifer Salvador', 'Marilyn Salvador'), claim('C2', 'Zenaida Lacson', 'Lourdes Lacson')] },
        { month: '2026-09', batchCount: 1, claimCount: 1, totalCollected: 5300,
          claims: [{ ...claim('C3', 'Maricel Gonzales', 'Dominador Gonzales'), jvNumber: 'JV-SEP', totalCollected: 5300 }] },
      ],
      totals: { totalCollected: 32900, claimCount: 3, batchCount: 2 },
    });
    let location;
    const Spy = () => { location = useLocation(); return null; };
    const { default: DeductionSummary } = await vite.ssrLoadModule('/src/components/mortuary/treasurer/DeductionSummary.jsx');
    await act(async () => root.render(React.createElement(MemoryRouter, { initialEntries: ['/treasurer?tab=claims&claimsView=deduction-summary'] },
      React.createElement(DeductionSummary), React.createElement(Spy))));
    await act(async () => new Promise(resolve => setTimeout(resolve, 350)));

    const text = () => container.textContent;
    assert.match(text(), /October 2026/);
    assert.match(text(), /September 2026/);
    // The list shows only month totals; claims open on their own page.
    assert.doesNotMatch(text(), /Jennifer Salvador/);
    assert.ok(![...container.querySelectorAll('button')].some(el => /print/i.test(el.textContent)), 'no print buttons');
    assert.match(container.querySelector('tfoot').textContent, /₱32,900\.00/);
    const button = label => [...container.querySelectorAll('button')].find(el => el.textContent.trim() === label);

    // "View claims" opens the month on its own page, with each claim's details.
    await act(async () => container.querySelector('button[aria-label="View claims for October 2026"]').click());
    await act(async () => new Promise(resolve => setTimeout(resolve, 0)));
    assert.equal(new URLSearchParams(location.search).get('month'), '2026-10');
    assert.deepEqual(calls.at(-1), { month: '2026-10' });
    assert.match(text(), /Claims deducted this month/);
    const rows = [...container.querySelectorAll('[aria-label="Claims deducted in October 2026"] tbody tr')];
    assert.equal(rows.length, 2);
    assert.match(rows[0].textContent, /Jennifer Salvador/);
    assert.match(rows[0].textContent, /Marilyn Salvador/);
    assert.match(rows[0].textContent, /JV-OCT-2026/);
    assert.match(rows[0].textContent, /138 × ₱100\.00/);
    assert.match(container.querySelector('tfoot').textContent, /₱27,600\.00/);

    await act(async () => button('Deduction Summary').click());
    assert.equal(new URLSearchParams(location.search).get('month'), null);
    await act(async () => new Promise(resolve => setTimeout(resolve, 350)));
    assert.match(text(), /September 2026/);
  } finally {
    await act(async () => root.unmount());
    if (original) api.getDeductionSummary = original;
    globalThis.IS_REACT_ACT_ENVIRONMENT = originalAct;
    container.remove();
    await vite.close();
  }
});
