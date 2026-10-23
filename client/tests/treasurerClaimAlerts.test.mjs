import test from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { createServer } from 'vite';

test('claim deductions and releases show success and error alerts inside the claim dialog', async () => {
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
    const claim = {
      claimId: 'CLAIM-TEST', memberName: 'Test Member', beneficiaryName: 'Test Beneficiary',
      payoutAmount: 500, maxBenefitAmount: 500, deduction: { totalCollected: 500 },
    };
    api.getPendingDeductionClaims = api.getAwaitingReleaseClaims = async () => ({ data: [claim] });
    api.getDeductionRate = async () => ({ data: { amount: 50 } });
    api.previewClaimDeduction = async () => ({ data: { amountPerMember: 50, totalCollected: 500, membersCharged: 10 } });
    let fail = true;
    const writes = [];
    api.processClaimDeduction = async (id, payload) => {
      if (fail) throw { response: { data: { message: 'Deduction rejected' } } };
      writes.push({ id, payload });
      return { data: claim };
    };
    api.releaseClaim = async (id, payload) => {
      if (fail) throw { response: { data: { message: 'Release rejected' } } };
      writes.push({ id, payload });
      return { data: { ...claim, payout: { amount: payload.amount, dvNumber: payload.dvNumber } } };
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
    await click('Review deduction');
    await fill('#deduction-jv', 'JV-TEST');
    await submit('#deduction-details');
    await click('Confirm deduction');
    assert.equal(alerts.at(-1).title, 'Could not process deduction');
    assert.equal(container.querySelector('[role="alert"]').textContent, 'Deduction rejected');
    fail = false;
    await click('Confirm deduction');
    assert.equal(alerts.at(-1).icon, 'success');
    assert.match(alerts.at(-1).text, /JV-TEST/);
    assert.match(container.textContent, /Deduction recorded/);
    assert.equal(writes.length, 1);

    fail = true;
    const { default: Release } = await vite.ssrLoadModule('/src/components/mortuary/treasurer/ClaimsAwaitingRelease.jsx');
    await act(async () => root.render(React.createElement(Release, { user: { name: 'Treasurer' } })));
    await click('Prepare release');
    assert.equal(container.querySelector('#release-amount').readOnly, true, 'the calculated payout cannot be edited');
    assert.match(container.querySelector('#release-amount').value, /500\.00/);
    await fill('#release-dv', 'DV-TEST');
    await submit('#release-details');
    await click('Confirm release');
    assert.equal(alerts.at(-1).title, 'Could not record release');
    assert.equal(container.querySelector('[role="alert"]').textContent, 'Release rejected');
    fail = false;
    await click('Confirm release');
    assert.equal(alerts.at(-1).title, 'Claim released successfully');
    assert.match(alerts.at(-1).text, /DV-TEST/);
    assert.ok(button('Print receipt'), 'receipt printing remains available after the alert');
    assert.equal(writes.length, 2);
    assert.equal(writes[1].payload.amount, 500);
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
