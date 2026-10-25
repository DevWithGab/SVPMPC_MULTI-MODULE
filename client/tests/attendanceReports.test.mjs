import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { matchesAttendancePeriod, createAttendanceReportPdf, createAttendanceReportCsv } from '../src/utils/attendanceReport.js';

test('attendance CSV omits the event column only for event-scoped exports', () => {
  const logs = [{ memberId: '000123', memberName: 'Maria Santos', barangay: 'San Vicente', eventName: 'Assembly', scanTime: '2026-10-08T02:00:00Z', status: 'present', scannedBy: 'scanner.one' }];
  const allEvents = createAttendanceReportCsv({ logs });
  const singleEvent = createAttendanceReportCsv({ logs, includeEvent: false });
  assert.match(allEvents.split('\r\n')[0], /"Event"/);
  assert.match(allEvents, /"Assembly"/);
  assert.equal(singleEvent.split('\r\n')[0], '\uFEFF"Passbook Number","Member Name","Barangay","Date (PHT)","Time (PHT)","Status","Scanned by"');
  assert.doesNotMatch(singleEvent, /Assembly/);
  assert.match(singleEvent, /"000123","Maria Santos","San Vicente"/);
  assert.match(singleEvent, /"present","scanner.one"$/);
  assert.match(allEvents, /"present","scanner.one"$/);
});

test('single-event PDF omits the event column and keeps the remaining data', () => {
  const logo = new Uint8Array(readFileSync(new URL('../public/SVPMPC-LOGO(MAIN).png', import.meta.url)));
  const doc = createAttendanceReportPdf({ logo, scope: 'Assembly', includeEvent: false,
    logs: [{ memberId: '000123', memberName: 'Maria Santos', barangay: 'San Vicente', eventName: 'Assembly', status: 'late', scannedBy: 'scanner.two' }] });
  assert.deepEqual(Object.values(doc.lastAutoTable.head[0].cells).map(cell => cell.text.join(' ')), ['Passbook no.', 'Member / Barangay', 'Date / Time (PHT)', 'Status', 'Scanned by']);
  assert.equal(Object.keys(doc.lastAutoTable.body[0].cells).length, 5);
  assert.deepEqual(doc.lastAutoTable.body[0].cells[3].text, ['late']);
  assert.deepEqual(doc.lastAutoTable.body[0].cells[4].text, ['scanner.two']);
});

test('barangay-filtered PDF drops the barangay from the table and emphasises it in the header', () => {
  const logo = new Uint8Array(readFileSync(new URL('../public/SVPMPC-LOGO(MAIN).png', import.meta.url)));
  const doc = createAttendanceReportPdf({ logo, scope: 'All time', includeEvent: false, includeBarangay: false,
    highlights: [{ label: 'Event', value: 'Assembly' }, { label: 'Barangay', value: 'San Vicente' }],
    logs: [{ memberId: '000123', memberName: 'Maria Santos', barangay: 'San Vicente', eventName: 'Assembly', status: 'present', scannedBy: 'scanner.one' }] });
  assert.deepEqual(Object.values(doc.lastAutoTable.head[0].cells).map(cell => cell.text.join(' ')), ['Passbook no.', 'Member', 'Date / Time (PHT)', 'Status', 'Scanned by']);
  assert.deepEqual(doc.lastAutoTable.body[0].cells[1].text, ['Maria Santos']);
  const page = doc.internal.pages[1].join('\n');
  for (const text of ['EVENT', 'Assembly', 'BARANGAY', 'San Vicente']) assert.ok(page.includes(`(${text})`), `header shows ${text}`);
});

test('older records without a scanner name are explicitly marked as not recorded', () => {
  const logs = [{ memberId: '000123', memberName: 'Legacy Member', status: 'present' }];
  assert.match(createAttendanceReportCsv({ logs }), /"present","Not recorded"$/);
  const logo = new Uint8Array(readFileSync(new URL('../public/SVPMPC-LOGO(MAIN).png', import.meta.url)));
  const doc = createAttendanceReportPdf({ logs, logo, scope: 'All events' });
  assert.equal(doc.lastAutoTable.body[0].cells[5].text.join(' '), 'Not recorded');
});

test('report periods use Manila calendar dates, include seven days, and exclude future dates', () => {
  const now = new Date('2026-10-08T02:00:00Z');
  assert.equal(matchesAttendancePeriod('2026-10-07T16:00:00Z', 'today', now), true);
  assert.equal(matchesAttendancePeriod('2026-10-07T15:59:59Z', 'today', now), false);
  assert.equal(matchesAttendancePeriod('2026-10-01T16:00:00Z', 'week', now), true);
  assert.equal(matchesAttendancePeriod('2026-10-01T15:59:59Z', 'week', now), false);
  assert.equal(matchesAttendancePeriod('2026-10-09', 'month', now), false);
  assert.equal(matchesAttendancePeriod(null, 'today', now), false);
  assert.equal(matchesAttendancePeriod('invalid', 'month', now), false);
  assert.equal(matchesAttendancePeriod(null, 'all', now), true);
});

test('attendance PDF preserves every record, actual statuses, logo, and page-safe tables', () => {
  const logo = new Uint8Array(readFileSync(new URL('../public/SVPMPC-LOGO(MAIN).png', import.meta.url)));
  const logs = Array.from({ length: 205 }, (_, index) => ({ memberId: `MEM-${index + 1}`, memberName: 'Maria Lourdes de la Cruz Santos', barangay: 'San Vicente', eventId: 'EVT-1', eventName: 'Annual General Assembly and Cooperative Membership Orientation', scanTime: '2026-10-08T02:00:00Z', status: index === 204 ? 'late' : 'present', scannedBy: index % 2 ? 'scanner.one' : 'scanner.two' }));
  const doc = createAttendanceReportPdf({ logo, logs, scope: 'This month · Annual General Assembly and Cooperative Membership Orientation · San Vicente', generatedAt: new Date('2026-10-08T03:00:00Z') });
  assert.ok(doc.getNumberOfPages() > 1);
  assert.equal(doc.lastAutoTable.body.length, 205);
  assert.deepEqual(doc.lastAutoTable.body.at(-1).cells[0].text, ['MEM-205']);
  assert.deepEqual(doc.lastAutoTable.body.at(-1).cells[4].text, ['late']);
  assert.equal(doc.lastAutoTable.body.at(-1).cells[5].text.join(' '), 'scanner.two');
  assert.ok(Object.keys(doc.internal.collections.addImage_images).length);
  for (const row of doc.lastAutoTable.body) {
    for (const cell of Object.values(row.cells)) {
      assert.ok(cell.y >= 39 && cell.y + cell.height < 275, 'Rows stay inside header and footer margins');
    }
  }
  if (process.env.REPORT_QA_DIR) {
    mkdirSync(process.env.REPORT_QA_DIR, { recursive: true });
    writeFileSync(resolve(process.env.REPORT_QA_DIR, 'attendance.pdf'), Buffer.from(doc.output('arraybuffer')));
  }
});
