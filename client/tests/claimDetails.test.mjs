import test from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { createServer } from 'vite';

test('claim review renders a new empty checklist and can mark a requirement submitted and verified', async () => {
  // Load the actual JSX and its imports, then render through React so an
  // undefined identifier in the loaded review screen fails this test.
  const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  const previousActEnvironment = globalThis.IS_REACT_ACT_ENVIRONMENT;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  let api;
  let original;
  try {
    const { default: ClaimDetails } = await vite.ssrLoadModule('/src/components/mortuary/admin/ClaimDetails.jsx');
    ({ claimAPI: api } = await vite.ssrLoadModule('/src/services/api.js'));
    original = { getClaimById: api.getClaimById, updateRequirements: api.updateRequirements };
    let claim = {
      claimId: 'CLAIM-TEST', memberId: 'MEM-TEST', memberName: 'Test Member',
      beneficiaryName: 'Test Beneficiary', beneficiaryRelationship: 'Spouse',
      dateOfDeath: '2026-10-01', dateFiled: '2026-10-20',
      status: 'pending_requirements', requirements: {}, statusHistory: [],
    };
    let saved;
    api.getClaimById = async () => ({ data: { claim } });
    api.updateRequirements = async (claimId, changes) => {
      saved = { claimId, changes };
      claim = { ...claim, requirements: { deathCertificate: { label: 'Death Certificate', ...changes.deathCertificate } } };
      return { data: claim };
    };
    const user = { username: 'test.admin' };
    const render = key => act(async () => root.render(React.createElement(ClaimDetails, { key, claimId: claim.claimId, user })));
    await render('empty');
    assert.match(container.textContent, /Submitted & Verified/);
    assert.match(container.textContent, /No requirements added yet/);
    assert.equal([...container.querySelectorAll('button')].find(button => button.textContent.trim() === 'Approve').disabled, true);

    claim = { ...claim, requirements: { deathCertificate: { label: 'Death Certificate', submitted: false, verified: false } } };
    await render('with-requirement');
    assert.match(container.querySelector('tbody').textContent, /Death Certificate/);
    const checkbox = container.querySelector('input[type="checkbox"]');
    assert.ok(checkbox);
    await act(async () => checkbox.click());
    assert.deepEqual(saved, { claimId: 'CLAIM-TEST', changes: { deathCertificate: { submitted: true, verified: true } } });
    assert.equal(container.querySelector('input[type="checkbox"]').checked, true);
    assert.equal([...container.querySelectorAll('button')].find(button => button.textContent.trim() === 'Approve').disabled, false);
  } finally {
    await act(async () => root.unmount());
    if (original) Object.assign(api, original);
    container.remove();
    globalThis.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
    await vite.close();
  }
});
