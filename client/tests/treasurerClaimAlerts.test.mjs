import test from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { createServer } from 'vite';

test('batch claim deductions show success and error alerts inside the claim dialog', async () => {
  const vite = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  const originalAct = globalThis.IS_REACT_ACT_ENVIRONMENT;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const dialogPrototype = window.HTMLDialogElement.prototype;
  const originalShowModal = dialogPrototype.showModal;
  const originalClose = dialogPrototype.close;
  dialogPrototype.showModal = function () { this.setAttribute('open', ''); };
  dialogPrototype.close = function () { this.removeAttribute('open'); };
  let api, originalApi, Swal, originalFire;
  const alerts = [];
  try {
    ({ default: Swal } = await import('sweetalert2'));
    originalFire = Swal.fire;
    Swal.fire = async options => {
      assert.equal(options.target, container.querySelector('dialog[open]'), 'alerts must be inside the native modal');
      alerts.push(options);
      return { isConfirmed: true };
    };
    ({ treasurerAPI: api } = await vite.ssrLoadModule('/src/services/api.js'));
    originalApi = { ...api };
    const claims = [
      { claimId: 'CLAIM-1', memberName: 'First Member', beneficiaryName: 'First Beneficiary' },
      { claimId: 'CLAIM-2', memberName: 'Second Member', beneficiaryName: 'Second Beneficiary' },
    ];
    const summary = {
      claimCount: 2, ratePerClaim: 50, amountPerMember: 100, membersCharged: 10, collectedPerClaim: 500, totalCollected: 1000,
      membersGoingNegative: 0, claims,
    };
    api.getPendingDeductionClaims = async () => ({ data: claims });
    api.getDeductionRate = async () => ({ data: { amount: 50 } });
    const previews = [];
    api.previewDeductionBatch = async (claimIds) => { previews.push(claimIds); return { data: summary }; };
    let fail = true;
    const writes = [];
    api.processDeductionBatch = async (claimIds, jvNumber) => {
      if (fail) throw { response: { data: { message: 'Deduction rejected' } } };
      writes.push({ claimIds, jvNumber });
      return { data: { ...summary, jvNumber, batchId: 'BATCH-1' } };
    };
    const button = label => [...container.querySelectorAll('button')].find(el => el.textContent.trim() === label);
    const click = label => act(async () => button(label).click());
    const fill = (selector, value) => act(async () => {
      const input = container.querySelector(selector);
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(input, value);
      input.dispatchEvent(new window.Event('input', { bubbles: true }));
    });
    const submit = selector => act(async () => container.querySelector(selector).dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })));
    const { default: Pending } = await vite.ssrLoadModule('/src/components/mortuary/treasurer/ClaimsPendingDeduction.jsx');
    await act(async () => root.render(React.createElement(Pending, { user: { name: 'Treasurer' } })));
    assert.equal(button('Review deduction').disabled, true, 'nothing can be processed until claims are selected');
    await act(async () => container.querySelector('input[aria-label="Select all claims on this page"]').click());
    await click('Review deduction (2)');
    await fill('#deduction-jv', 'JV-TEST');
    await submit('#deduction-details');
    await click('Confirm deduction');
    assert.equal(alerts.at(-1).title, 'Could not process deduction');
    assert.equal(container.querySelector('[role="alert"]').textContent, 'Deduction rejected');
    fail = false;
    await click('Confirm deduction');
    assert.equal(alerts.at(-1).icon, 'success');
    assert.match(alerts.at(-1).text, /JV-TEST/);
    assert.match(container.textContent, /Deduction summary/);
    assert.ok(button('Print summary'), 'the batch summary can be printed');
    assert.equal(writes.length, 1);
    assert.deepEqual(writes[0], { claimIds: ['CLAIM-1', 'CLAIM-2'], jvNumber: 'JV-TEST' }, 'one JV number for every selected claim');
    assert.deepEqual(previews[0], ['CLAIM-1', 'CLAIM-2']);

  } finally {
    await act(async () => root.unmount());
    if (originalApi) Object.assign(api, originalApi);
    if (originalFire) Swal.fire = originalFire;
    dialogPrototype.showModal = originalShowModal;
    dialogPrototype.close = originalClose;
    globalThis.IS_REACT_ACT_ENVIRONMENT = originalAct;
    container.remove();
    await vite.close();
  }
});
