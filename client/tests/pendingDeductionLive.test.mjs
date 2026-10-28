import test from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { useClaimQueue } from '../src/components/mortuary/treasurer/claimWorkflowUtils.js';
import { CLAIMS_UPDATED_KEY, notifyClaimsUpdated } from '../src/utils/claimUpdates.js';

test('pending deductions refresh after approvals and across tabs while preserving rows during background requests', async () => {
  const root = createRoot(document.createElement('div'));
  const original = { interval: window.setInterval, clear: window.clearInterval, hidden: Object.getOwnPropertyDescriptor(document, 'hidden'), act: globalThis.IS_REACT_ACT_ENVIRONMENT };
  let tick, cleared = false, queue, hidden = false;
  let claims = [], calls = 0, failure = false, release, hold = false;
  const fetchClaims = async () => {
    calls++;
    if (failure) throw new Error('Offline');
    const result = { data: [...claims], pagination: { total: claims.length } };
    if (hold) { hold = false; return new Promise(resolve => { release = () => resolve(result); }); }
    return result;
  };
  function Probe() { queue = useClaimQueue(fetchClaims); return null; }
  try {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    Object.defineProperty(document, 'hidden', {configurable: true, get: () => hidden});
    window.setInterval = (callback, delay) => { assert.equal(delay, 5000); tick = callback; return 42; };
    window.clearInterval = id => { assert.equal(id, 42); cleared = true; };
    await act(async () => root.render(React.createElement(Probe)));
    assert.equal(queue.total, 0);
    claims = [{claimId: 'C1', memberName: 'Newly approved member'}];
    await act(async () => notifyClaimsUpdated());
    assert.equal(queue.total, 1);
    hold = true;
    await act(async () => tick());
    assert.equal(queue.loading, false);
    assert.equal(queue.claims[0].memberName, 'Newly approved member');
    claims.push({claimId: 'C2', memberName: 'Second member'});
    await act(async () => notifyClaimsUpdated());
    await act(async () => release());
    assert.equal(queue.total, 2, 'approval during a request triggers another fetch');
    failure = true;
    await act(async () => tick());
    assert.equal(queue.total, 2);
    assert.equal(queue.error, '');
    failure = false;
    claims = [];
    await act(async () => window.dispatchEvent(new window.StorageEvent('storage', {key: CLAIMS_UPDATED_KEY})));
    assert.equal(queue.total, 0);
    hidden = true;
    const before = calls;
    await act(async () => tick());
    assert.equal(calls, before);
    hidden = false;
    claims = [{claimId: 'C3', memberName: 'Approved on another device'}];
    await act(async () => document.dispatchEvent(new window.Event('visibilitychange')));
    assert.equal(queue.total, 1);
    claims.push({claimId: 'C4', memberName: 'Polled approval'});
    await act(async () => tick());
    assert.equal(queue.total, 2);
    await act(async () => root.unmount());
    const after = calls;
    notifyClaimsUpdated();
    assert.equal(calls, after);
    assert.equal(cleared, true);
  } finally {
    await act(async () => root.unmount());
    window.setInterval = original.interval;
    window.clearInterval = original.clear;
    if (original.hidden) Object.defineProperty(document, 'hidden', original.hidden);
    else delete document.hidden;
    globalThis.IS_REACT_ACT_ENVIRONMENT = original.act;
  }
});
