import test from 'node:test';
import assert from 'node:assert/strict';
import { loadSecretaryEvents, validateEventForm, scheduledSecretaryEvent } from '../src/utils/eventManagement.js';

test('secretary event status changes at PHT start and end without waiting for a server refresh', () => {
  const event = { eventDate: '2026-10-21', startTime: '09:00', endTime: '10:00', status: 'upcoming' };
  const at = time => Date.parse(`2026-10-21T${time}+08:00`);
  assert.equal(scheduledSecretaryEvent(event, at('08:59:59')).status, 'upcoming');
  assert.equal(scheduledSecretaryEvent(event, at('09:00:00')).status, 'active');
  assert.equal(scheduledSecretaryEvent(event, at('09:59:59')).status, 'active');
  assert.equal(scheduledSecretaryEvent(event, at('10:00:00')).status, 'closed');
  for (const status of ['rejected', 'cancelled', 'closed']) {
    assert.equal(scheduledSecretaryEvent({ ...event, status }, at('11:00:00')).status, status);
  }
  assert.equal(event.status, 'upcoming', 'the server snapshot is not mutated');
});

test('secretary closing handles overnight schedules and leaves invalid schedules unchanged', () => {
  const overnight = { eventDate: '2026-10-21', startTime: '23:00', endTime: '01:00', status: 'active' };
  assert.equal(scheduledSecretaryEvent(overnight, Date.parse('2026-10-22T00:59:59+08:00')).status, 'active');
  assert.equal(scheduledSecretaryEvent(overnight, Date.parse('2026-10-22T01:00:00+08:00')).status, 'closed');
  assert.equal(scheduledSecretaryEvent({ ...overnight, endTime: 'invalid' }).status, 'active');
});

test('event register loads every page before presenting complete totals', async () => {
  const requested = [];
  const events = await loadSecretaryEvents(async ({ page, limit }) => {
    requested.push([page, limit]);
    return { success: true, data: { events: [{ eventId: `event-${page}` }] }, pagination: { totalPages: 3 } };
  });
  assert.deepEqual(requested, [[1, 100], [2, 100], [3, 100]]);
  assert.deepEqual(events.map(event => event.eventId), ['event-1', 'event-2', 'event-3']);
});

test('an API failure cannot be mistaken for an empty successful event list', async () => {
  await assert.rejects(loadSecretaryEvents(async ({ page }) => page === 1
    ? { success: true, data: [{ eventId: 'one' }], pagination: { totalPages: 2 } }
    : { success: false, message: 'Connection lost' }), /Connection lost/);
});

test('event forms require meaningful details and a valid same-day schedule', () => {
  const valid = { name: 'General Assembly', location: 'Main Hall', date: '2026-10-20', startTime: '09:00', endTime: '11:00' };
  assert.equal(validateEventForm(valid), '');
  assert.match(validateEventForm({ ...valid, name: '   ' }), /name/);
  assert.match(validateEventForm({ ...valid, location: '   ' }), /location/);
  assert.match(validateEventForm({ ...valid, endTime: '' }), /end time/);
  assert.match(validateEventForm({ ...valid, endTime: '09:00' }), /later/);
  assert.match(validateEventForm({ ...valid, endTime: '08:00' }), /later/);
});
