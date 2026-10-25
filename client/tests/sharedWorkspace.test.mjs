import test from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { createServer } from 'vite';

test('shared fields associate labels and errors, and legacy controls retain validation and password toggling', async () => {
  const vite = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  const container = document.createElement('div'); document.body.append(container);
  const root = createRoot(container);
  const previousAct = globalThis.IS_REACT_ACT_ENVIRONMENT;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  try {
    const { FormField } = await vite.ssrLoadModule('/src/components/ui/workspace.jsx');
    const { Input } = await vite.ssrLoadModule('/src/components/ui/input.jsx');
    const { default: LegacyInput } = await vite.ssrLoadModule('/src/components/shared/ui/Input.jsx');
    const { default: LegacyButton } = await vite.ssrLoadModule('/src/components/shared/ui/Button.jsx');
    await act(async () => root.render(React.createElement('div', null,
      React.createElement(FormField, { label: 'Reference', error: 'Enter a reference', hint: 'Use the receipt number', required: true }, React.createElement(Input, { defaultValue: '', maxLength: 20 })),
      React.createElement(LegacyInput, { label: 'Password', type: 'password', showPasswordToggle: true, required: true, defaultValue: 'example password' }),
      React.createElement(LegacyButton, { loading: true }, 'Save'),
    )));
    const [reference, password] = container.querySelectorAll('input');
    const label = [...container.querySelectorAll('label')].find(item => item.textContent.startsWith('Reference'));
    assert.equal(label.htmlFor, reference.id);
    assert.equal(reference.required, true);
    assert.equal(reference.maxLength, 20);
    assert.equal(reference.getAttribute('aria-invalid'), 'true');
    const described = reference.getAttribute('aria-describedby').split(' ').map(id => document.getElementById(id).textContent);
    assert.deepEqual(described, ['Use the receipt number', 'Enter a reference']);
    assert.equal(password.type, 'password');
    await act(async () => container.querySelector('[aria-label="Show password"]').click());
    assert.equal(password.type, 'text');
    assert.equal(password.value, 'example password');
    assert.ok(container.querySelector('[aria-label="Hide password"]'));
    const save = [...container.querySelectorAll('button')].find(button => button.textContent === 'Loading...');
    assert.equal(save.disabled, true);
    assert.equal(save.getAttribute('aria-busy'), 'true');
  } finally {
    await act(async () => root.unmount()); container.remove();
    globalThis.IS_REACT_ACT_ENVIRONMENT = previousAct; await vite.close();
  }
});

test('modal adapters share focus trapping, Escape handling, scroll locking and focus restoration', async () => {
  const vite = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  const container = document.createElement('div'); document.body.append(container);
  const opener = document.createElement('button'); document.body.append(opener); opener.focus();
  const root = createRoot(container);
  const previousAct = globalThis.IS_REACT_ACT_ENVIRONMENT;
  const overflow = document.body.style.overflow;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  let topCloses = 0, bottomCloses = 0;
  try {
    const { Modal } = await vite.ssrLoadModule('/src/components/ui/modal.jsx');
    const { default: MortuaryModal } = await vite.ssrLoadModule('/src/components/mortuary/shared/Modal.jsx');
    const render = (bottom, top) => act(async () => root.render(React.createElement(React.Fragment, null,
      React.createElement(Modal, { isOpen: bottom, title: 'Attendance dialog', onClose: () => bottomCloses++ }, React.createElement('button', null, 'Last action')),
      React.createElement(MortuaryModal, { isOpen: top, title: 'Mortuary dialog', onClose: () => topCloses++ }, React.createElement('button', null, 'Last action')),
    )));
    await render(true, true);
    assert.equal(document.body.style.overflow, 'hidden');
    const dialogs = container.querySelectorAll('[role="dialog"]');
    assert.equal(dialogs.length, 2);
    assert.ok([...dialogs].every(dialog => dialog.classList.contains('ui-dialog') && dialog.getAttribute('aria-modal') === 'true'));
    const top = dialogs[1];
    const buttons = top.querySelectorAll('button');
    buttons[buttons.length - 1].focus();
    await act(async () => document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })));
    assert.equal(document.activeElement, buttons[0]);
    await act(async () => document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })));
    assert.equal(topCloses, 1); assert.equal(bottomCloses, 0);
    await render(true, false);
    assert.equal(document.body.style.overflow, 'hidden');
    await act(async () => document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })));
    assert.equal(bottomCloses, 1);
    await render(false, false);
    assert.equal(document.body.style.overflow, overflow);
    assert.equal(document.activeElement, opener);
  } finally {
    await act(async () => root.unmount()); container.remove(); opener.remove();
    document.body.style.overflow = overflow; globalThis.IS_REACT_ACT_ENVIRONMENT = previousAct; await vite.close();
  }
});
