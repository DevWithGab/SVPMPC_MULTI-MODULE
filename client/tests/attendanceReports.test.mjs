import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { matchesAttendancePeriod, createAttendanceReportPdf } from '../src/utils/attendanceReport.js';

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
  const logs = Array.from({ length: 205 }, (_, index) => ({ memberId: `MEM-${index + 1}`, memberName: 'Maria Lourdes de la Cruz Santos', barangay: 'San Vicente', eventId: 'EVT-1', eventName: 'Annual General Assembly and Cooperative Membership Orientation', scanTime: '2026-10-08T02:00:00Z', status: index === 204 ? 'late' : 'present' }));
  const doc = createAttendanceReportPdf({ logo, logs, scope: 'This month · Annual General Assembly and Cooperative Membership Orientation · San Vicente', generatedAt: new Date('2026-10-08T03:00:00Z') });
  assert.ok(doc.getNumberOfPages() > 1);
  assert.equal(doc.lastAutoTable.body.length, 205);
  assert.deepEqual(doc.lastAutoTable.body.at(-1).cells[0].text, ['MEM-205']);
  assert.deepEqual(doc.lastAutoTable.body.at(-1).cells[4].text, ['late']);
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
