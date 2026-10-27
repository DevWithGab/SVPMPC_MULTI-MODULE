import test from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { createServer } from 'vite';

test('Deduction Report includes deductions and filters by the month a claim was filed', async () => {
  const vite = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  const previousAct = globalThis.IS_REACT_ACT_ENVIRONMENT;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const originalCreate = URL.createObjectURL, originalRevoke = URL.revokeObjectURL;
  const originalClick = window.HTMLAnchorElement.prototype.click;
  let api, original;
  try {
    ({ treasurerAPI: api } = await vite.ssrLoadModule('/src/services/api.js'));
    original = api.getAllClaims;
    const claims = [
      { claimId: 'OCT-CLAIM-1', memberId: '001', memberName: 'October Member', beneficiaryName: 'Oct Beneficiary', dateFiled: '2026-10-06T10:00:00+08:00',
        status: 'deduction_processed', deduction: { jvNumber: 'JV-10-31', processedAt: '2026-10-31T10:00:00+08:00', totalCollected: 13800 } },
      { claimId: 'OCT-CLAIM-2', memberId: '002', memberName: 'Pending Member', beneficiaryName: 'Pending Beneficiary', dateFiled: '2026-10-20T10:00:00+08:00',
        status: 'pending_deduction' },
      { claimId: 'SEP-CLAIM-1', memberId: '003', memberName: 'September Member', beneficiaryName: 'Sep Beneficiary', dateFiled: '2026-09-15T10:00:00+08:00',
        status: 'deduction_processed', deduction: { jvNumber: 'JV-09-30', processedAt: '2026-09-30T10:00:00+08:00', totalCollected: 5300 } },
    ];
    api.getAllClaims = async () => ({ success: true, data: claims, pagination: { total: claims.length, page: 1, limit: 100 } });
    let downloaded;
    URL.createObjectURL = blob => { downloaded = blob; return 'blob:report'; };
    URL.revokeObjectURL = () => {};
    window.HTMLAnchorElement.prototype.click = () => {};

    const { default: Reports } = await vite.ssrLoadModule('/src/components/mortuary/treasurer/Reports.jsx');
    await act(async () => root.render(React.createElement(Reports, { contributions: [], members: [], stats: {} })));
    const button = label => [...container.querySelectorAll('button')].find(el => el.textContent.trim() === label);
    assert.equal(button('Claim Deductions'), undefined, 'the separate deductions report is gone');
    await act(async () => {
      const select = container.querySelector('#mortuary-report-type');
      assert.equal(select.options.length, 6);
      select.value = 'claims';
      select.dispatchEvent(new window.Event('change', { bubbles: true }));
    });

    const text = () => container.querySelector('.reports-content').textContent;
    const headers = [...container.querySelectorAll('.reports-content thead th')].map(th => th.textContent.trim());
    assert.deepEqual(headers, ['Member', 'Beneficiary', 'Deducted On', 'Deducted']);
    const fields = container.querySelector('.reports-filter-fields');
    assert.deepEqual([...fields.querySelectorAll('label')].map(l => l.firstChild.textContent), ['Barangay', 'Month filed'], 'month filter sits beside barangay');
    assert.doesNotMatch(text(), /JV-10-31/, 'reference numbers are not part of this table');
    assert.match(text(), /₱13,800\.00/);
    assert.match(text(), /September Member/);
    assert.match(container.querySelector('tfoot').textContent, /₱19,100\.00/);

    const monthSelect = [...container.querySelectorAll('label')].find(label => label.textContent.startsWith('Month filed')).querySelector('select');
    assert.deepEqual([...monthSelect.options].map(o => o.textContent), ['All months', 'October 2026', 'September 2026']);
    await act(async () => {
      monthSelect.value = '2026-10';
      monthSelect.dispatchEvent(new window.Event('change', { bubbles: true }));
    });
    assert.match(text(), /October Member/);
    assert.match(text(), /Pending Member/, 'claims not yet deducted still appear in the month they were filed');
    assert.doesNotMatch(text(), /September Member/);
    assert.match(container.querySelector('tfoot').textContent, /2 claims/);
    assert.match(container.querySelector('tfoot').textContent, /₱13,800\.00/);

    await act(async () => button('Export CSV').click());
    const csv = await downloaded.text();
    assert.match(csv, /"MONTH FILED","October 2026"/);
    assert.match(csv, /"Member","Beneficiary","Deducted On","Deducted \(PHP\)"/);
    assert.match(csv, /"October Member","Oct Beneficiary",".*","13800"/);
    assert.doesNotMatch(csv, /September Member/);
    assert.match(csv, /"Total deducted","","","13800"/);
  } finally {
    await act(async () => root.unmount());
    if (original) api.getAllClaims = original;
    URL.createObjectURL = originalCreate; URL.revokeObjectURL = originalRevoke;
    window.HTMLAnchorElement.prototype.click = originalClick;
    globalThis.IS_REACT_ACT_ENVIRONMENT = previousAct;
    container.remove();
    await vite.close();
  }
});
