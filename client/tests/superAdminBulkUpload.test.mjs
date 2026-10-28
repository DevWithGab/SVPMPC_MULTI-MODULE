import test from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { createServer } from 'vite';
import Swal from 'sweetalert2';

test('Super Admin keeps failed rows visible and shows request errors inside the upload window', async () => {
  const vite = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  let api, original;
  const originalFire = Swal.fire;
  const alerts = [];
  Swal.fire = async options => { alerts.push(options); return { isConfirmed: true }; };
  try {
    const { default: SuperAdmin } = await vite.ssrLoadModule('/src/pages/SuperAdmin.jsx');
    ({ adminAPI: api } = await vite.ssrLoadModule('/src/services/api.js'));
    original = { getAllMembers: api.getAllMembers, bulkCreateMembers: api.bulkCreateMembers };
    api.getAllMembers = async () => ({ members: [], pagination: { total: 0 } });
    let calls = 0;
    api.bulkCreateMembers = async () => {
      calls++;
      return { summary: { successful: 1, failed: 1 }, results: { success: [{}], failed: [{ row: 3, memberName: 'Jose Reyes', reason: 'Passbook No. 000124 already exists' }] } };
    };
    window.sessionStorage.setItem('token', 'test');
    window.sessionStorage.setItem('user', JSON.stringify({ role: 'super_admin' }));
    await act(async () => root.render(React.createElement(MemoryRouter, null, React.createElement(SuperAdmin))));
    const button = text => [...container.querySelectorAll('button')].find(node => node.textContent.trim() === text);
    await act(async () => button('Bulk Upload').click());
    const choose = async text => {
      const input = container.querySelector('input[type="file"]');
      Object.defineProperty(input, 'files', { configurable: true, value: [{ name: 'members.csv', text: async () => text }] });
      await act(async () => input.dispatchEvent(new window.Event('change', { bubbles: true })));
    };
    const csv = 'memberName,barangay,address\nMaria Santos,Centro,Street\nJose Reyes,Centro,Street';
    await choose(csv);
    await act(async () => button('Upload Members').click());
    assert.match(container.textContent, /1 members created. 1 members could not be created/);
    assert.match(container.textContent, /Passbook No. 000124 already exists/);
    assert.match(container.textContent, /only those failed members/);
    assert.equal(button('Choose a new file to upload again').disabled, true);
    assert.equal(calls, 1);
    assert.equal(alerts.at(-1).icon, 'warning');
    assert.match(alerts.at(-1).text, /only the failed members/);
    assert.ok(alerts.at(-1).target.contains(container.querySelector('input[type="file"]')));
    api.bulkCreateMembers = async () => { throw { response: { data: { message: 'Too many uploads. Try again in 15 minutes.' } } }; };
    await choose(csv);
    await act(async () => button('Upload Members').click());
    assert.match(container.querySelector('[role="alert"]').textContent, /Too many uploads/);
    assert.ok(button('Upload Members'));
    assert.equal(alerts.at(-1).icon, 'error');
    assert.match(alerts.at(-1).text, /Too many uploads/);
    await choose('memberName\nMaria');
    assert.match(container.querySelector('[role="alert"]').textContent, /Missing required columns/);
    assert.equal(button('Upload Members').disabled, true);
    await choose('memberName,barangay,address,dateOfBirth\nMaria,Centro,Street,03/04/1970');
    assert.match(container.querySelector('[role="alert"]').textContent, /Ambiguous/);
    assert.equal(button('Upload Members').disabled, true);
    const dateOrder = [...container.querySelectorAll('select')].find(node => node.querySelector('option[value="dmy"]'));
    await act(async () => { dateOrder.value = 'dmy'; dateOrder.dispatchEvent(new window.Event('change', { bubbles: true })); });
    assert.match(container.textContent, /1970-04-03/);
    assert.equal(container.querySelector('[role="alert"]'), null);
    assert.equal(button('Upload Members').disabled, false);

  } finally {
    Swal.fire = originalFire;
    if (original) Object.assign(api, original);
    await act(async () => root.unmount());
    container.remove();
    window.sessionStorage.clear();
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
    await vite.close();
  }
});
