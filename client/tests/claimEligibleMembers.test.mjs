import test from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { createServer } from 'vite';
import { membersEligibleForClaim } from '../src/components/mortuary/shared/claimMeta.js';

const member = (id, name) => ({ id, name, status: 'deceased' });

test('only members without a claim in progress or processed can have a new claim filed', () => {
  const members = [member('002099', 'Processed'), member('002100', 'Pending'), member('002101', 'Rejected only'), member('002102', 'No claim')];
  const claims = [
    { memberId: '002099', status: 'deduction_processed' },
    { memberId: '002100', status: 'filing' },
    { memberId: '002101', status: 'rejected' },
  ];
  assert.deepEqual(membersEligibleForClaim(members, claims).map(m => m.id), ['002101', '002102']);
  // Every non-rejected status blocks, matching the server's unique claim index.
  for (const status of ['filing', 'pending_requirements', 'approved', 'pending_deduction', 'deduction_processing', 'deduction_processed', 'releasing', 'released']) {
    assert.deepEqual(membersEligibleForClaim([member('1', 'A')], [{ memberId: '1', status }]), [], status);
  }
  // A rejected claim alongside an active one still blocks.
  assert.deepEqual(membersEligibleForClaim([member('1', 'A')], [{ memberId: '1', status: 'rejected' }, { memberId: '1', status: 'released' }]), []);
});

test('the register-claim dropdown leaves out members whose claim was already processed', async () => {
  const vite = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  const previousAct = globalThis.IS_REACT_ACT_ENVIRONMENT;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  let api, originals;
  try {
    api = await vite.ssrLoadModule('/src/services/api.js');
    originals = [api.claimAPI.getAllClaims, api.mortuaryMemberAPI.getAllMembers, api.mortuaryDashboardAPI.getAdminDashboard];
    const page = data => ({ success: true, data, pagination: { total: data.length, page: 1, limit: 100, totalPages: 1 } });
    api.mortuaryMemberAPI.getAllMembers = async () => page([
      { id: '002099', name: 'Jericho Santos', status: 'deceased' },
      { id: '002200', name: 'Refile Candidate', status: 'deceased' },
      { id: '002300', name: 'Living Member', status: 'active' },
    ]);
    api.claimAPI.getAllClaims = async () => page([
      { claimId: 'C-1', memberId: '002099', memberName: 'Jericho Santos', status: 'deduction_processed', dateFiled: '2026-10-26' },
      { claimId: 'C-2', memberId: '002200', memberName: 'Refile Candidate', status: 'rejected', dateFiled: '2026-10-20' },
    ]);
    api.mortuaryDashboardAPI.getAdminDashboard = async () => ({ data: { claims: { deduction_processed: 16, released: 5 } } });

    const { default: Claims } = await vite.ssrLoadModule('/src/components/mortuary/claims_officer/Claims.jsx');
    await act(async () => root.render(React.createElement(MemoryRouter, null, React.createElement(Claims, { user: { username: 'claims.officer' } }))));
    // Deduction is the final claim step, so its tile replaces the legacy Released one.
    const tiles = [...container.querySelectorAll('.ac-metric')].map(tile => [tile.dataset.status, tile.querySelector('strong').textContent]);
    assert.deepEqual(tiles.map(([status]) => status), ['pending_requirements', 'pending_deduction', 'deduction_processed', 'rejected']);
    assert.equal(Object.fromEntries(tiles).deduction_processed, '16');
    await act(async () => [...container.querySelectorAll('button')].find(b => b.textContent.includes('Register new claim')).click());
    await act(async () => document.querySelector('[aria-label="Deceased member"]').click());
    const options = document.body.textContent;
    assert.match(options, /Refile Candidate/);
    assert.match(options, /Living Member/);
    assert.doesNotMatch(options.split('Deceased member')[1] || '', /Jericho Santos/);
  } finally {
    if (originals) [api.claimAPI.getAllClaims, api.mortuaryMemberAPI.getAllMembers, api.mortuaryDashboardAPI.getAdminDashboard] = originals;
    await act(async () => root.unmount());
    container.remove();
    globalThis.IS_REACT_ACT_ENVIRONMENT = previousAct;
    await vite.close();
  }
});
