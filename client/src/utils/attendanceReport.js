import { createMortuaryReportPdf } from './mortuaryReportPdf.js';
import { formatDate, formatTime } from './date.js';
import { attendanceScannedBy } from './attendanceScannedBy.js';

export const attendancePeriods = { all: 'All time', today: 'Today', week: 'Last 7 days', month: 'This month', year: 'This year' };
const dayKey = value => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value));
export function matchesAttendancePeriod(value, period, now = new Date()) {
  if (period === 'all') return true;
  if (!value || !Number.isFinite(new Date(value).getTime())) return false;
  const day = dayKey(value), today = dayKey(now);
  if (day > today) return false;
  if (period === 'today') return day === today;
  if (period === 'month') return day.slice(0, 7) === today.slice(0, 7);
  if (period === 'year') return day.slice(0, 4) === today.slice(0, 4);
  const start = new Date(`${today}T00:00:00+08:00`);
  start.setTime(start.getTime() - 6 * 86400000);
  return day >= dayKey(start);
}
// `header` is the report front matter from reportCsvHeader(), placed above the table.
export function createAttendanceReportCsv({ logs, includeEvent = true, header = '' }) {
  const excelText = value => `="${String(value ?? '').replace(/"/g, '""')}"`;
  const cell = value => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const rows = [
    ['Passbook Number', 'Member Name', 'Barangay', ...(includeEvent ? ['Event'] : []), 'Date (PHT)', 'Time (PHT)', 'Status', 'Scanned by'],
    ...logs.map(log => [log.memberId, log.memberName, log.barangay,
      ...(includeEvent ? [log.eventName] : []),
      log.scanTime ? excelText(formatDate(log.scanTime)) : 'Not recorded',
      log.scanTime ? excelText(formatTime(log.scanTime)) : 'Not recorded', log.status, attendanceScannedBy(log)]),
  ];
  return '\uFEFF' + header + rows.map(row => row.map(cell).join(',')).join('\r\n');
}

/* Columns for the PDF register. A column the report is already filtered to
(one event, one barangay) is dropped from the table and shown in the header
instead. Each layout fills the same 176 mm table width. */
const registerWidths = (includeEvent, includeBarangay) => {
  if (includeEvent && includeBarangay) return [22, 39, 34, 31, 20, 30];
  if (includeEvent) return [22, 40, 36, 30, 18, 30];
  if (includeBarangay) return [23, 60, 36, 24, 33];
  return [26, 62, 34, 22, 32];
};

export function createAttendanceReportPdf({ logs, scope, logo, generatedAt, includeEvent = true, includeBarangay = true, highlights = [] }) {
  const members = new Set(logs.map(log => String(log.memberId || log.memberName))).size;
  const events = new Set(logs.map(log => String(log.eventId || log.eventName))).size;
  const valid = value => value && Number.isFinite(new Date(value).getTime());
  return createMortuaryReportPdf({ logo, generatedAt, title: 'Attendance Report', scope, highlights, template: 'standard',
    program: 'Attendance Management', metadataLabel: 'REPORT RECORDS', metadataValue: `${logs.length} attendance records`,
    sections: [
      { title: 'Report overview', head: ['Attendance records', 'Members who attended', 'Events represented'], body: [[String(logs.length), String(members), String(events)]] },
      { title: 'Attendance register', head: ['Passbook no.', includeBarangay ? 'Member / Barangay' : 'Member', ...(includeEvent ? ['Event'] : []), 'Date / Time (PHT)', 'Status', 'Scanned by'], widths: registerWidths(includeEvent, includeBarangay),
        body: logs.map(log => [String(log.memberId || 'Not recorded'), includeBarangay ? `${log.memberName}
${log.barangay || 'Not recorded'}` : String(log.memberName || 'Not recorded'), ...(includeEvent ? [log.eventName || 'Not recorded'] : []), valid(log.scanTime) ? `${formatDate(log.scanTime)}
${formatTime(log.scanTime)}` : 'Not recorded', log.status || 'present', attendanceScannedBy(log)]),
        emptyMessage: 'No attendance records match this report scope.' },
    ],
  });
}
