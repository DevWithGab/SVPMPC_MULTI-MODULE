const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { createRequire } = require('node:module');

// Same VM-sandbox require-interception helper as the other controller
// tests in this suite.
function load(path, dependencies, globals = {}) {
  const filename = require.resolve(path);
  const localRequire = createRequire(filename);
  const context = { module: { exports: {} }, process, Buffer, console, setInterval, clearInterval, ...globals,
    require: name => Object.hasOwn(dependencies, name) ? dependencies[name] : localRequire(name) };
  context.exports = context.module.exports;
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), context, { filename });
  return context.module.exports;
}
// Real Express defaults to 200 if .json() is called without an explicit
// .status() first — transitionEvent's success path does exactly that
// (`return res.json({...})` with no .status(200) before it), so the fake
// must match that default rather than leaving .code unset.
const response = () => ({ code: 200, status(code) { this.code = code; return this; }, json(data) { this.data = data; return this; } });

function database(events = []) {
  const state = { events: events.map(e => ({ ...e })), auditLogs: [] };

  class EventDoc {
    constructor(data) { Object.assign(this, data); }
    // Mongoose casts a plain assignment to a Date-typed schema field (e.g.
    // `event.eventDate = "2026-10-20"`, a plain string straight off a JSON
    // request body) to a real Date instance immediately — getPhtParts
    // relies on that, calling Intl.DateTimeFormat directly on
    // event.eventDate. A fake that just stored the raw string would make
    // reopenEvent crash on a perfectly realistic request.
    set eventDate(value) { this._eventDate = value instanceof Date ? value : new Date(value); }
    get eventDate() { return this._eventDate; }
    // eventDate is a getter/setter (see above), so a plain object spread —
    // which only copies own enumerable properties, not prototype accessors
    // — silently drops it. Both persistence and toObject() need it
    // included explicitly.
    toObject() { return { ...this, eventDate: this.eventDate }; }
    async save() {
      const index = state.events.findIndex(e => e.eventId === this.eventId);
      const plain = this.toObject();
      if (index === -1) state.events.push(plain); else state.events[index] = plain;
      return this;
    }
  }

  const Event = {
    findOne: async (query) => {
      const found = state.events.find(e => e.eventId === query.eventId);
      return found ? new EventDoc({ ...found }) : null;
    },
    findOneAndUpdate: async (query, updates) => {
      const index = state.events.findIndex(e => e.eventId === query.eventId);
      if (index === -1) return null;
      state.events[index] = { ...state.events[index], ...updates };
      return new EventDoc({ ...state.events[index] });
    },
    findOneAndDelete: async (query) => {
      const index = state.events.findIndex(e => e.eventId === query.eventId);
      if (index === -1) return null;
      const [removed] = state.events.splice(index, 1);
      return new EventDoc(removed);
    },
  };

  return {
    state,
    deps: {
      '../models/Event': Event,
      '../../../shared/services/auditLoggingService': { createAuditLog: async (log) => { state.auditLogs.push(log); } },
    },
  };
}

function controller(db, globals) {
  return load('../modules/attendance/controllers/eventController', db.deps, globals);
}

const event = (overrides) => ({
  eventId: 'EVT-1', eventName: 'General Assembly', eventDate: new Date(), startTime: '09:00', endTime: '17:00',
  location: 'Hall', status: 'draft', ...overrides,
});

// --- approveEvent ---------------------------------------------------------

test('event approval logs the authenticated admin name and business ID', async () => {
  const db = database([event({ status: 'pending_approval' })]);
  const res = response();
  await controller(db).approveEvent({ params: { eventId: 'EVT-1' },
    user: { userId: 'ADMIN-1', id: 'mongo-id', username: 'attendance.admin', role: 'admin' },
    ip: '', get: () => '',
  }, res);
  assert.equal(res.code, 200);
  assert.equal(db.state.auditLogs[0].userId, 'ADMIN-1');
  assert.equal(db.state.auditLogs[0].userName, 'attendance.admin');
});

test('approveEvent moves a draft or pending_approval event to upcoming', async () => {
  for (const status of ['draft', 'pending_approval']) {
    const db = database([event({ status })]);
    const { approveEvent } = controller(db);
    const res = response();
    await approveEvent({ params: { eventId: 'EVT-1' }, user: { role: 'admin' }, ip: '', get: () => '' }, res);
    assert.equal(res.code, 200, status);
    assert.equal(db.state.events[0].status, 'upcoming', status);
  }
});

test('approveEvent rejects an event that is not draft or pending_approval, and a missing event', async () => {
  for (const status of ['upcoming', 'active', 'closed', 'cancelled', 'rejected']) {
    const db = database([event({ status })]);
    const { approveEvent } = controller(db);
    const res = response();
    await approveEvent({ params: { eventId: 'EVT-1' }, user: {}, ip: '', get: () => '' }, res);
    assert.equal(res.code, 400, status);
    assert.equal(db.state.events[0].status, status, `${status} must be left untouched`);
  }

  const db = database([]);
  const { approveEvent } = controller(db);
  const missing = response();
  await approveEvent({ params: { eventId: 'NOPE' }, user: {}, ip: '', get: () => '' }, missing);
  assert.equal(missing.code, 404);
});

// --- rejectEvent -----------------------------------------------------------

test('rejectEvent requires a non-blank reason and only accepts a pending_approval event', async () => {
  const db = database([event({ status: 'pending_approval' })]);
  const { rejectEvent } = controller(db);

  for (const reason of [undefined, '', '   ']) {
    const res = response();
    await rejectEvent({ params: { eventId: 'EVT-1' }, body: { reason }, user: {}, ip: '', get: () => '' }, res);
    assert.equal(res.code, 400, JSON.stringify(reason));
  }
  assert.equal(db.state.events[0].status, 'pending_approval', 'no reason must leave the event untouched');

  const ok = response();
  await rejectEvent({ params: { eventId: 'EVT-1' }, body: { reason: 'Venue unavailable' }, user: {}, ip: '', get: () => '' }, ok);
  assert.equal(ok.code, 200);
  assert.equal(db.state.events[0].status, 'rejected');
  assert.equal(db.state.events[0].rejectionReason, 'Venue unavailable');

  const wrongStatus = database([event({ status: 'draft' })]);
  const res2 = response();
  await controller(wrongStatus).rejectEvent({ params: { eventId: 'EVT-1' }, body: { reason: 'x' }, user: {}, ip: '', get: () => '' }, res2);
  assert.equal(res2.code, 400, 'a draft event has never been submitted, so it cannot be rejected');
});

// --- submit / cancel / resubmit ---------------------------------------------

test('submitEvent only accepts draft or rejected, and clears any previous rejection reason', async () => {
  const db = database([event({ status: 'rejected', rejectionReason: 'Previously rejected' })]);
  const { submitEvent } = controller(db);
  const res = response();
  await submitEvent({ params: { eventId: 'EVT-1' }, body: {}, user: {}, ip: '', get: () => '' }, res);
  assert.equal(res.code, 200);
  assert.equal(db.state.events[0].status, 'pending_approval');
  assert.equal(db.state.events[0].rejectionReason, undefined, 'resubmitting must clear the stale rejection reason');

  for (const status of ['pending_approval', 'upcoming', 'active', 'closed', 'cancelled']) {
    const other = database([event({ status })]);
    const r = response();
    await controller(other).submitEvent({ params: { eventId: 'EVT-1' }, body: {}, user: {}, ip: '', get: () => '' }, r);
    assert.equal(r.code, 400, status);
  }
});

test('cancelEvent accepts draft, pending_approval, or rejected, but not an already-live or already-closed event', async () => {
  for (const status of ['draft', 'pending_approval', 'rejected']) {
    const db = database([event({ status })]);
    const res = response();
    await controller(db).cancelEvent({ params: { eventId: 'EVT-1' }, body: {}, user: {}, ip: '', get: () => '' }, res);
    assert.equal(res.code, 200, status);
    assert.equal(db.state.events[0].status, 'cancelled', status);
  }
  for (const status of ['upcoming', 'active', 'closed']) {
    const db = database([event({ status })]);
    const res = response();
    await controller(db).cancelEvent({ params: { eventId: 'EVT-1' }, body: {}, user: {}, ip: '', get: () => '' }, res);
    assert.equal(res.code, 400, status);
  }
});

test('resubmitEvent only accepts a rejected event', async () => {
  const db = database([event({ status: 'rejected' })]);
  const res = response();
  await controller(db).resubmitEvent({ params: { eventId: 'EVT-1' }, body: {}, user: {}, ip: '', get: () => '' }, res);
  assert.equal(res.code, 200);
  assert.equal(db.state.events[0].status, 'pending_approval');

  const draft = database([event({ status: 'draft' })]);
  const res2 = response();
  await controller(draft).resubmitEvent({ params: { eventId: 'EVT-1' }, body: {}, user: {}, ip: '', get: () => '' }, res2);
  assert.equal(res2.code, 400, 'a draft was never rejected, so "resubmit" does not apply');
});

// --- reopenEvent -------------------------------------------------------------

// PHT is UTC+8 — build date/time strings directly against that offset so
// the test doesn't depend on the machine's own local timezone.
const phtNow = () => new Date(Date.now() + 8 * 60 * 60 * 1000);
const phtDateString = (date) => date.toISOString().slice(0, 10);
const phtTimeString = (date) => date.toISOString().slice(11, 16);

test('reopenEvent only accepts a closed event, and requires a reason plus a new date/start/end time', async () => {
  const notClosed = database([event({ status: 'upcoming' })]);
  const res = response();
  await controller(notClosed).reopenEvent({ params: { eventId: 'EVT-1' }, body: { reason: 'x', eventDate: '2030-01-01', startTime: '09:00', endTime: '17:00' }, user: {}, ip: '', get: () => '' }, res);
  assert.equal(res.code, 400);

  const closed = () => database([event({ status: 'closed' })]);
  const missingReason = response();
  await controller(closed()).reopenEvent({ params: { eventId: 'EVT-1' }, body: { eventDate: '2030-01-01', startTime: '09:00', endTime: '17:00' }, user: {}, ip: '', get: () => '' }, missingReason);
  assert.equal(missingReason.code, 400);

  const missingSchedule = response();
  await controller(closed()).reopenEvent({ params: { eventId: 'EVT-1' }, body: { reason: 'Rescheduled' }, user: {}, ip: '', get: () => '' }, missingSchedule);
  assert.equal(missingSchedule.code, 400);
});

test('reopenEvent rejects a new schedule that would already be over, and requires it to end in the future', async () => {
  const db = database([event({ status: 'closed' })]);
  const pastDay = new Date(phtNow().getTime() - 24 * 60 * 60 * 1000);
  const res = response();
  await controller(db).reopenEvent({
    params: { eventId: 'EVT-1' },
    body: { reason: 'Rescheduled', eventDate: phtDateString(pastDay), startTime: '09:00', endTime: '17:00' },
    user: {}, ip: '', get: () => '',
  }, res);
  assert.equal(res.code, 400);
  assert.match(res.data.message, /must end in the future/);
  assert.equal(db.state.events[0].status, 'closed', 'a rejected reopen attempt must not change the event at all');
});

test('reopenEvent sets status to upcoming for a fully-future schedule, and to active when the new start time has already begun', async () => {
  // Keep this scenario at noon PHT: subtracting an hour from real midnight
  // wraps to the previous day and accidentally describes a future schedule.
  const fixedNow = new Date('2026-10-20T04:00:00Z');
  class FixedDate extends Date {
    constructor(...args) { super(...(args.length ? args : [fixedNow.getTime()])); }
    static now() { return fixedNow.getTime(); }
  }
  const future = database([event({ status: 'closed' })]);
  const now = new Date(fixedNow.getTime() + 8 * 60 * 60 * 1000);
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const upcomingRes = response();
  await controller(future, { Date: FixedDate }).reopenEvent({
    params: { eventId: 'EVT-1' },
    body: { reason: 'Rescheduled to tomorrow', eventDate: phtDateString(tomorrow), startTime: '09:00', endTime: '17:00' },
    user: {}, ip: '', get: () => '',
  }, upcomingRes);
  assert.equal(upcomingRes.code, 200);
  assert.equal(future.state.events[0].status, 'upcoming');
  assert.equal(future.state.events[0].reopenReason, 'Rescheduled to tomorrow');

  // A schedule that started earlier today (PHT) but doesn't end until
  // later must land as 'active', not 'upcoming' — mirrors refreshEventStatus's
  // own active-window rule, applied here at reopen time.
  const active = database([event({ status: 'closed' })]);
  const startedOneHourAgo = phtTimeString(new Date(now.getTime() - 60 * 60 * 1000));
  const endsInTwoHours = phtTimeString(new Date(now.getTime() + 2 * 60 * 60 * 1000));
  const activeRes = response();
  await controller(active, { Date: FixedDate }).reopenEvent({
    params: { eventId: 'EVT-1' },
    body: { reason: 'Reopened mid-day', eventDate: phtDateString(now), startTime: startedOneHourAgo, endTime: endsInTwoHours },
    user: {}, ip: '', get: () => '',
  }, activeRes);
  assert.equal(activeRes.code, 200);
  assert.equal(active.state.events[0].status, 'active');
});

// --- updateEvent's edit-lock -------------------------------------------------

test('updateEvent blocks a secretary after approval but lets an admin update the location', async () => {
  for (const status of ['upcoming', 'active', 'closed']) {
    const db = database([event({ status })]);
    const secretaryRes = response();
    await controller(db).updateEvent({ params: { eventId: 'EVT-1' }, body: { eventName: 'New Name' }, user: { role: 'secretary' }, ip: '', get: () => '' }, secretaryRes);
    assert.equal(secretaryRes.code, 400, `secretary editing a(n) ${status} event`);

    const adminRes = response();
    await controller(db).updateEvent({ params: { eventId: 'EVT-1' }, body: { location: 'New Hall' }, user: { role: 'admin' }, ip: '', get: () => '' }, adminRes);
    assert.equal(adminRes.code, 200, `admin editing a(n) ${status} event`);
    assert.equal(db.state.events[0].location, 'New Hall');
  }

  for (const status of ['draft', 'pending_approval', 'rejected']) {
    const db = database([event({ status })]);
    const secretaryRes = response();
    await controller(db).updateEvent({ params: { eventId: 'EVT-1' }, body: { eventName: 'Edited' }, user: { role: 'secretary' }, ip: '', get: () => '' }, secretaryRes);
    assert.equal(secretaryRes.code, 200, `secretary editing a(n) ${status} event`);
  }
});

test('approved event name and description cannot be changed by either admin role', async () => {
  for (const status of ['upcoming', 'active']) {
    for (const role of ['admin', 'super_admin']) {
      for (const field of ['eventName', 'description']) {
        const db = database([event({ status, eventName: 'Approved name', description: 'Approved description' })]);
        const res = response();
        await controller(db).updateEvent({ params: { eventId: 'EVT-1' }, body: { [field]: 'Changed', location: 'New Hall' }, user: { role }, ip: '', get: () => '' }, res);
        assert.equal(res.code, 400);
        assert.equal(db.state.events[0][field], field === 'eventName' ? 'Approved name' : 'Approved description');
        assert.notEqual(db.state.events[0].location, 'New Hall');
      }
    }
  }
});

test('unchanged approved details may accompany a schedule or location update', async () => {
  const db = database([event({ status: 'upcoming', eventName: 'Approved name', description: 'Approved description' })]);
  const res = response();
  await controller(db).updateEvent({ params: { eventId: 'EVT-1' }, body: { eventName: 'Approved name', description: 'Approved description', location: 'New Hall', startTime: '10:00' }, user: { role: 'admin' }, ip: '', get: () => '' }, res);
  assert.equal(res.code, 200);
  assert.equal(db.state.events[0].location, 'New Hall');
  assert.equal(db.state.events[0].startTime, '10:00');
});

test('updateEvent preserves a rejected event\'s status across an edit, but does not resurrect it to any other status', async () => {
  const db = database([event({ status: 'rejected', rejectionReason: 'Fix the venue' })]);
  const res = response();
  await controller(db).updateEvent({ params: { eventId: 'EVT-1' }, body: { location: 'New Hall' }, user: { role: 'secretary' }, ip: '', get: () => '' }, res);
  assert.equal(res.code, 200);
  assert.equal(db.state.events[0].status, 'rejected', 'editing a rejected event must not silently re-approve or reset it — resubmitEvent is the only path back to pending_approval');
  assert.equal(db.state.events[0].location, 'New Hall');
});
