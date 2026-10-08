import test from 'node:test';
import assert from 'node:assert/strict';
import { getQrUnavailableReason, normalizeDirectoryMembers, filterDirectoryMembers, directoryCsv, directoryPrintHtml } from '../src/utils/memberDirectory.js';

test('QR controls only expose issued, active image assets for living members', () => {
  const available = { status: 'active', qrCodeGenerated: true, qrCodeActive: true, qrCodeUrl: '/qr/member.png' };
  assert.equal(getQrUnavailableReason(available), null);
  assert.equal(getQrUnavailableReason({ ...available, status: 'deceased' }), 'Unavailable for deceased member');
  assert.equal(getQrUnavailableReason({ ...available, qrCodeActive: false }), 'Deactivated');
  assert.equal(getQrUnavailableReason({ ...available, qrCodeGenerated: false }), 'Not issued');
  assert.equal(getQrUnavailableReason({ ...available, qrCodeUrl: null }), 'Image unavailable');
});

test('latest attendance resolves member aliases and retains the newest valid date', () => {
  const members = normalizeDirectoryMembers([{ memberId: '001', memberName: 'Santos, Ana', barangay: 'San Vicente', lastAttendance: '2026-10-01' }], [
    { member_id: '001', timestamp: '2026-10-08T02:00:00Z' },
    { memberId: '001', scanTime: 'invalid' },
    { memberId: '001', scanTime: '2026-09-01' },
  ]);
  assert.equal(members[0].lastAttendance, '2026-10-08T02:00:00Z');
  assert.equal(members[0].memberId, '001');
  assert.equal(filterDirectoryMembers(members, { search: '  ANA ', barangay: 'San Vicente' }).length, 1);
  assert.equal(filterDirectoryMembers(members, { status: 'deceased' }).length, 0);
});

test('CSV quotes punctuation, keeps zero-prefixed IDs in the file, and neutralizes formula cells', () => {
  const [member] = normalizeDirectoryMembers([{ memberId: '001', memberName: 'Santos, "Ana"', email: '=HYPERLINK("x")', phone: '+639001234567' }], []);
  const csv = directoryCsv([member]);
  assert.ok(csv.startsWith('\uFEFF'));
  assert.ok(csv.includes('"Santos, ""Ana"""'));
  assert.ok(csv.includes('"001"'));
  assert.ok(csv.includes('"\'=HYPERLINK(""x"")"'));
  assert.ok(csv.includes('"\'+639001234567"'));
});

test('print card escapes member fields and image attributes', () => {
  const [member] = normalizeDirectoryMembers([{ memberId: '001', memberName: '<script>alert(1)</script>', barangay: 'San & Vicente' }], []);
  const html = directoryPrintHtml(member, '/qr.png?value="', '/logo.png');
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(html.includes('San &amp; Vicente'));
  assert.ok(html.includes('/qr.png?value=&quot;'));
  assert.ok(!html.includes('<script>'));
});
