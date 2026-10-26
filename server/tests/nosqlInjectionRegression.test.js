const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { createRequire } = require('node:module');

// Same VM-sandbox require-interception helper as staffAccess.test.js/
// automaticDeduction.test.js. Each of the endpoints
// below had the same root cause: a raw req.body field (an object, not a
// string, when a crafted payload like {"$ne": null} is sent) used directly
// as a Mongoose query value. A plain truthiness check (`!field`) doesn't
// catch this — a non-empty object is truthy — so the object sails through
// into findOne() and is interpreted as a real query operator. Every case
// here proves both directions: the operator-shaped payload is rejected
// with a clean 400 (not a 500, and not a match against the wrong record),
// and an ordinary string still passes the same check (reaches the
// endpoint's real "not found" logic), so the fix doesn't also break
// legitimate requests.
function load(path, dependencies) {
  const filename = require.resolve(path);
  const localRequire = createRequire(filename);
  const context = { module: { exports: {} }, process, Buffer, console,
    require: name => Object.hasOwn(dependencies, name) ? dependencies[name] : localRequire(name) };
  context.exports = context.module.exports;
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), context, { filename });
  return context.module.exports;
}
const response = () => ({ status(code) { this.code = code; return this; }, json(data) { this.data = data; return this; } });
const injected = { $ne: null };

test('login rejects an operator-shaped username/password and still processes a real one', async () => {
  const { login } = load('../shared/controllers/authController', {
    '../models/User': { findOne: async () => null },
    '../models/CredentialLog': { },
    jsonwebtoken: {},
  });

  const bad = response();
  await login({ body: { username: injected, password: injected } }, bad);
  assert.equal(bad.code, 400);
  assert.equal(bad.data.message, 'Username and password required');

  // A real (but unknown) username must reach the real auth failure, not be
  // rejected by the type guard.
  const unknown = response();
  await login({ body: { username: 'nobody', password: 'whatever' } }, unknown);
  assert.equal(unknown.code, 401);
});

test('recordAttendance rejects an operator-shaped memberId/eventId and still processes real ones', async () => {
  const { recordAttendance } = load('../modules/attendance/controllers/attendanceController', {
    '../models': { Member: { findOne: async () => null } },
    '../models/Attendance': {},
    '../models/Event': { findOne: async () => null },
    '../models/AttendanceReport': {},
    '../../../shared/services/auditLoggingService': { createAuditLog: async () => {} },
  });

  const bad = response();
  await recordAttendance({ user: { userId: 'scanner-id', username: 'scanner.one', role: 'scanner_operator' }, body: { memberId: injected, eventId: injected } }, bad);
  assert.equal(bad.code, 400);
  assert.equal(bad.data.message, 'Missing required fields');

  const unknown = response();
  await recordAttendance({ user: { userId: 'scanner-id', username: 'scanner.one', role: 'scanner_operator' }, body: { memberId: 'MEM-1', eventId: 'EVT-1' } }, unknown);
  assert.equal(unknown.code, 404, 'a real string memberId must reach the "Member not found" check, not be blocked by the type guard');
});

test('generateReport rejects an operator-shaped eventId and still processes a real one', async () => {
  const { generateReport } = load('../modules/attendance/controllers/attendanceController', {
    '../models': { Member: {} },
    '../models/Attendance': {},
    '../models/Event': { findOne: async () => null },
    '../models/AttendanceReport': {},
    '../../../shared/services/auditLoggingService': { createAuditLog: async () => {} },
  });

  const bad = response();
  await generateReport({ body: { eventId: injected, generatedBy: 'secretary.jane' } }, bad);
  assert.equal(bad.code, 400);

  const unknown = response();
  await generateReport({ body: { eventId: 'EVT-1', generatedBy: 'secretary.jane' } }, unknown);
  assert.equal(unknown.code, 404);
});

test('createClaim rejects operator-shaped memberId/beneficiaryId and still processes real ones', async () => {
  const { createClaim } = load('../modules/mortuary/controllers/claimController', {
    '../models/Claim': {},
    '../models/Beneficiary': {},
    '../../../shared/models': { Member: { findOne: async () => null } },
    '../../../shared/services/auditLoggingService': { createAuditLog: async () => {} },
  });

  const bad = response();
  await createClaim({ body: { memberId: injected, beneficiaryId: injected, dateOfDeath: '2026-01-01' } }, bad);
  assert.equal(bad.code, 400);
  assert.equal(bad.data.success, false);

  const unknown = response();
  await createClaim({ body: { memberId: 'MEM-1', beneficiaryId: 'BEN-1', dateOfDeath: '2026-01-01' } }, unknown);
  assert.equal(unknown.code, 404, 'a real string memberId must reach the "Member not found" check');
});

test('recordContribution rejects an operator-shaped memberId and still processes a real one', async () => {
  const { recordContribution } = load('../modules/mortuary/controllers/contributionController', {
    '../models/Contribution': {},
    '../models/Ledger': {},
    '../../../shared/models': { Member: { findOne: async () => null } },
    '../utils/ledgerBalance': { getLatestBalance: async () => 0 },
  });

  const bad = response();
  await recordContribution({ body: { memberId: injected, amount: 100, referenceNumber: 'OR-1' } }, bad);
  assert.equal(bad.code, 400);

  const unknown = response();
  await recordContribution({ body: { memberId: 'MEM-1', amount: 100, referenceNumber: 'OR-1' } }, unknown);
  assert.equal(unknown.code, 404, 'a real string memberId must reach the "Member not found" check');
});

test('confirmAndStartImport rejects an operator-shaped operationId and still processes a real one', async () => {
  const { confirmAndStartImport } = load('../shared/controllers/bulkImportController', {
    '../models/ImportOperation': { findOne: async () => null },
    '../../modules/attendance/services/csvParserService': {},
    '../services/bulkImportService': {},
    fs: {},
  });

  const bad = response();
  await confirmAndStartImport({ body: { operationId: injected } }, bad);
  assert.equal(bad.code, 400);
  assert.equal(bad.data.message, 'Operation ID required');

  const unknown = response();
  await confirmAndStartImport({ body: { operationId: 'OP-1' } }, unknown);
  assert.equal(unknown.code, 404, 'a real string operationId must reach the "Import operation not found" check');
});

test('getAllAttendance rejects an operator-shaped scannedBy query param and still processes a real one', async () => {
  // Unlike the others above, scannedBy comes from req.query, not req.body —
  // Express's query-string parser turns ?scannedBy[$ne]=x into an object
  // the exact same way a crafted JSON body would, so this is the same
  // injection class reached through a different input channel.
  const AttendanceFake = {
    countDocuments: async () => 0,
    find: () => ({ sort: () => ({ skip: () => ({ limit: async () => [] }) }) }),
  };
  const { getAllAttendance } = load('../modules/attendance/controllers/attendanceController', {
    '../models': { Member: {} },
    '../models/Attendance': AttendanceFake,
    '../models/Event': {},
    '../models/AttendanceReport': {},
    '../../../shared/services/auditLoggingService': { createAuditLog: async () => {} },
  });

  const bad = response();
  await getAllAttendance({ query: { scannedBy: injected }, user: {} }, bad);
  assert.equal(bad.code, 400);
  assert.equal(bad.data.message, 'Invalid scannedBy filter');

  const ok = response();
  await getAllAttendance({ query: { scannedBy: 'scanner.one' }, user: {} }, ok);
  assert.equal(ok.code, 200, 'a real string scannedBy must reach the real query, not be blocked by the type guard');

  const absent = response();
  await getAllAttendance({ query: {}, user: {} }, absent);
  assert.equal(absent.code, 200, 'omitting scannedBy entirely must still work — it is optional');
});

// Not operator injection like the cases above ($in matches array elements
// by equality, not as operators) — but the same underlying problem:
// unvalidated req.body input reaching a Mongoose query. A plain
// `!memberIds || memberIds.length === 0` check passes for anything with a
// .length (a bare string, for instance), and never validated individual
// elements before they reached {$in: memberIds}.
test('generateQRCodes rejects a non-array or non-string-element memberIds, and still processes a real array', async () => {
  const { generateQRCodes } = load('../modules/attendance/controllers/memberController', {
    '../../../shared/models': { Member: { find: async () => [] } },
    '../services/csvParserService': {},
    '../services/qrCodeService': { generateQRCode: async () => ({ success: false }) },
    '../../../shared/services/auditLoggingService': { createAuditLog: async () => {} },
  });

  for (const bad of ['MEM-1', { $ne: null }, ['MEM-1', { $ne: null }], ['MEM-1', 42]]) {
    const res = response();
    await generateQRCodes({ body: { memberIds: bad } }, res);
    assert.equal(res.code, 400, JSON.stringify(bad));
    assert.equal(res.data.message, 'No passbook numbers provided');
  }

  const ok = response();
  await generateQRCodes({ body: { memberIds: ['MEM-1', 'MEM-2'] } }, ok);
  assert.equal(ok.code, 404, 'a real array of strings must reach the real "No members found" check, not be blocked by the shape guard');
});
