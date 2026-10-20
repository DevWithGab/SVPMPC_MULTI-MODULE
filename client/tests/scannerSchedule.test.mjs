import test from 'node:test';
import assert from 'node:assert/strict';
import { canScanEvent, scannerEventWindow } from '../src/utils/scannerSchedule.js';

const event = {
  status: 'upcoming', eventDate: '2026-10-20T16:00:00Z',
  startTime: '09:50', endTime: '10:20',
};

test('approved events enable at the PHT start and disable exactly at the end, even with stale server status', () => {
  assert.equal(canScanEvent(event, Date.parse('2026-10-21T09:49:59+08:00')), false);
  assert.equal(canScanEvent(event, Date.parse('2026-10-21T09:50:00+08:00')), true);
  assert.equal(canScanEvent(event, Date.parse('2026-10-21T10:19:59+08:00')), true);
  assert.equal(canScanEvent({ ...event, status: 'active' }, Date.parse('2026-10-21T10:20:00+08:00')), false);
  assert.equal(canScanEvent({ ...event, status: 'active' }, Date.parse('2026-10-20T09:50:00+08:00')), false);
});

test('schedule never activates pending, rejected, cancelled, or manually closed events', () => {
  for (const status of ['draft', 'pending_approval', 'rejected', 'cancelled', 'closed']) {
    assert.equal(canScanEvent({ ...event, status }, Date.parse('2026-10-21T10:00:00+08:00')), false);
  }
  assert.equal(canScanEvent({ ...event, eventDate: 'invalid' }), false);
  assert.equal(canScanEvent({ ...event, endTime: '25:00' }), false);
});

test('legacy overnight events follow the API next-day end rule', () => {
  const overnight = { ...event, startTime: '23:00', endTime: '01:00' };
  assert.deepEqual(scannerEventWindow(overnight), {
    start: Date.parse('2026-10-21T23:00:00+08:00'),
    end: Date.parse('2026-10-22T01:00:00+08:00'),
  });
  assert.equal(canScanEvent(overnight, Date.parse('2026-10-22T00:59:59+08:00')), true);
  assert.equal(canScanEvent(overnight, Date.parse('2026-10-22T01:00:00+08:00')), false);
});
