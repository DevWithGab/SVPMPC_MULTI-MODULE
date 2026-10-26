import test from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { createServer } from 'vite';

test('Mortuary Members uses the Super Admin create-member form against the Mortuary endpoint', async () => {
  const vite = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  const previousAct = globalThis.IS_REACT_ACT_ENVIRONMENT;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  let api, original;
  try {
    ({ mortuaryMemberAPI: api } = await vite.ssrLoadModule('/src/services/api.js'));
    original = api.createMember;
    const sent = [];
    api.createMember = async (data) => {
      sent.push(data);
      if (sent.length === 1) throw { response: { data: { message: 'Passbook No. already exists' } } };
      return { member: { memberId: '000777', memberName: data.memberName } };
    };
    let added = 0;
    const members = [{ id: '000001', name: 'Existing Member', barangay: 'Poblacion', status: 'active', currentBalance: 0 }];
    const { default: MemberManagement } = await vite.ssrLoadModule('/src/components/mortuary/admin/MemberManagement.jsx');
    await act(async () => root.render(React.createElement(MemberManagement, {
      filteredMembers: members, members, statusFilter: 'all', setStatusFilter() {}, searchQuery: '', setSearchQuery() {},
      onMemberAdded: () => { added += 1; },
    })));

    const button = label => [...document.querySelectorAll('button')].find(el => el.textContent.trim() === label);
    const fill = (id, value) => act(async () => {
      const input = document.getElementById(id);
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(input, value);
      input.dispatchEvent(new window.Event('input', { bubbles: true }));
    });
    const submit = () => act(async () => document.querySelector('form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })));

    await act(async () => button('Add member').click());
    assert.match(document.body.textContent, /Create New Member/);
    assert.deepEqual([...document.querySelectorAll('#barangay-options option')].map(o => o.value), ['Poblacion']);

    // Same inline validation as the Super Admin form: errors under each required field.
    await submit();
    assert.match(document.getElementById('memberName-error').textContent, /Full name is required/);
    assert.match(document.getElementById('barangay-error').textContent, /Barangay is required/);
    assert.match(document.getElementById('address-error').textContent, /Address is required/);
    assert.equal(sent.length, 0, 'nothing is sent until the required fields are filled');

    await fill('memberName', 'Juan Dela Cruz');
    await fill('barangay', 'Poblacion');
    await fill('address', '123 Sample Street');
    await fill('passbookNo', '000001');
    await submit();
    assert.match(document.getElementById('passbookNo-error').textContent, /Passbook No\. already exists/);

    await fill('passbookNo', '');
    await submit();
    assert.equal(sent[1].memberName, 'Juan Dela Cruz');
    assert.deepEqual(sent[1].modules, ['attendance', 'mortuary']);
    assert.match(document.body.textContent, /Member Created/);
    assert.match(document.body.textContent, /Passbook No\.: 000777/);
    assert.match(document.body.textContent, /ready for attendance and mortuary management/);
    assert.equal(added, 1, 'the members list is refreshed');
  } finally {
    await act(async () => root.unmount());
    if (original) api.createMember = original;
    globalThis.IS_REACT_ACT_ENVIRONMENT = previousAct;
    container.remove();
    await vite.close();
  }
});
