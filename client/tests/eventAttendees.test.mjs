import test from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { createServer } from 'vite';

test('event attendees shows 75 members per page and resets pagination when filtering', async () => {
  const vite = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  const previousAct = globalThis.IS_REACT_ACT_ENVIRONMENT;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  try {
    const { default: Panel } = await vite.ssrLoadModule('/src/components/attendance/shared/EventAttendeesPanel.jsx');
    const members = Array.from({ length: 80 }, (_, index) => ({ memberId: `TEST-${index + 1}`, memberName: `Member ${index + 1}`, barangay: 'San Vicente', status: 'active' }));
    await act(async () => root.render(React.createElement(Panel, { event: { name: 'Test assembly', date: '2026-10-20' }, allMembers: members, presentLogs: members.slice(0, 5) })));
    const rows = () => container.querySelectorAll('[role="listitem"]');
    assert.equal(rows().length, 75);
    assert.equal(container.querySelectorAll('[aria-label="Next page"]').length, 2);
    await act(async () => container.querySelector('[aria-label="Next page"]').click());
    assert.equal(rows().length, 5);
    assert.match(rows()[0].textContent, /Member 76/);
    const present = [...container.querySelectorAll('button')].find(button => button.textContent.startsWith('Present'));
    await act(async () => present.click());
    assert.equal(rows().length, 5);
    assert.match(rows()[0].textContent, /Member 1/);
    assert.equal(present.getAttribute('aria-pressed'), 'true');
    const absent = [...container.querySelectorAll('button')].find(button => button.textContent.startsWith('Absent'));
    await act(async () => absent.click());
    assert.equal(rows().length, 75);
    assert.match(rows()[0].textContent, /Member 6/);
  } finally {
    await act(async () => root.unmount());
    container.remove();
    globalThis.IS_REACT_ACT_ENVIRONMENT = previousAct;
    await vite.close();
  }
});
