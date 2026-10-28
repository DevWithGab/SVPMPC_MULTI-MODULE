import test from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { createServer } from 'vite';

test('event management View shows scheduled and closed event details without editable controls', async () => {
  const vite = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  const container = document.createElement('div'); document.body.append(container);
  const root = createRoot(container);
  const previousAct = globalThis.IS_REACT_ACT_ENVIRONMENT;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  try {
    const { default: Events } = await vite.ssrLoadModule('/src/components/attendance/secretary/EventManagement.jsx');
    for (const status of ['upcoming', 'closed']) {
      const event = { eventId: `VIEW-${status}`, eventName: 'General assembly', type: 'General Assembly', description: 'First line\nSecond line', location: 'Parish Hall', eventDate: status === 'closed' ? '2020-01-01' : '2035-01-01', startTime: '09:00', endTime: '12:00', status, rejectionReason: 'Please revise the schedule.' };
      await act(async () => root.render(React.createElement(Events, { key: status, events: [event], user: { username: 'secretary' } })));
      if (status === 'closed') await act(async () => [...container.querySelectorAll('.aae-groups button')].find(button => button.textContent.startsWith('Closed')).click());
      await act(async () => container.querySelector('[aria-label="View details for General assembly"]').click());
      const details = container.querySelector('.event-details');
      assert.ok(details);
      assert.match(details.textContent, new RegExp(event.eventId));
      assert.match(details.textContent, /Parish Hall/);
      assert.match(details.textContent, /First line\nSecond line/);
      assert.match(details.textContent, /Time \(PHT\)/);
      const dialog = details.closest('[role="dialog"]');
      assert.equal(Boolean(dialog.querySelector('input, textarea, select')), false, `${status}: view contains no editable controls`);
      assert.deepEqual([...dialog.querySelectorAll('[data-ui-modal-actions] button')].map(button => button.textContent.trim()), status === 'closed' ? ['Close', 'Reopen event'] : ['Close', 'Edit event']);
      if (status === 'closed') {
        assert.match(dialog.querySelector('.ui-dialog-header').textContent, /Closed event details/);
        assert.match(details.querySelector('.event-details-note').textContent, /Reopen event/);
      }
      await act(async () => dialog.querySelector('[data-ui-modal-actions] button').click());
    }
  } finally {
    await act(async () => root.unmount());
    container.remove(); globalThis.IS_REACT_ACT_ENVIRONMENT = previousAct; await vite.close();
  }
});
