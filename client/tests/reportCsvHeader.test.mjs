import test from 'node:test';
import assert from 'node:assert/strict';
import { reportCsvHeader } from '../src/utils/reportCsvHeader.js';
import { createAttendanceReportCsv } from '../src/utils/attendanceReport.js';

test('report CSV header mirrors the PDF front matter and precedes the table', () => {
  const header = reportCsvHeader({
    title: 'Attendance Report', program: 'Attendance Management', scope: 'All time',
    highlights: [{ label: 'Event', value: 'General "Assembly"' }, { label: 'Barangay', value: 'Poblacion' }, { label: 'Ignored', value: '' }],
    metadata: ['Report records', '1 attendance records'], generatedAt: new Date('2026-10-25T02:00:00Z'),
  });
  assert.deepEqual(header.split('\r\n'), [
    '"SAINT VINCENT PARISH MULTI-PURPOSE COOPERATIVE"',
    '"Dupax del Sur, Nueva Vizcaya, Philippines"',
    '"Attendance Management"',
    '',
    '"ATTENDANCE REPORT"',
    '"EVENT","General ""Assembly"""',
    '"BARANGAY","Poblacion"',
    '"All time"',
    '"Generated","Oct 25, 2026, 10:00 AM PHT"',
    '"Report records","1 attendance records"',
    '',
    '',
  ]);

  const csv = createAttendanceReportCsv({ header, logs: [{ memberId: '002001', memberName: 'Romeo Domingo', barangay: 'Poblacion', status: 'present' }] });
  const lines = csv.split('\r\n');
  assert.equal(lines[0], '﻿"SAINT VINCENT PARISH MULTI-PURPOSE COOPERATIVE"');
  assert.match(lines[11], /^"Passbook Number","Member Name"/);
  assert.match(lines[12], /^"002001","Romeo Domingo"/);
});
