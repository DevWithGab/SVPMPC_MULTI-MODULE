import { createMortuaryReportPdf } from './mortuaryReportPdf.js';
import { formatDate, formatTime } from './date.js';

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
export function createAttendanceReportPdf({ logs, scope, logo, generatedAt }) {
  const members = new Set(logs.map(log => String(log.memberId || log.memberName))).size;
  const events = new Set(logs.map(log => String(log.eventId || log.eventName))).size;
  const valid = value => value && Number.isFinite(new Date(value).getTime());
  return createMortuaryReportPdf({ logo, generatedAt, title: 'Attendance Report', scope,
    program: 'Attendance Management', metadataLabel: 'REPORT RECORDS', metadataValue: `${logs.length} attendance records`,
    sections: [
      { title: 'Report overview', head: ['Attendance records', 'Unique attendees', 'Events represented'], body: [[String(logs.length), String(members), String(events)]] },
      { title: 'Attendance register', head: ['Passbook no.', 'Member / Barangay', 'Event', 'Date / Time (PHT)', 'Status'], widths: [25, 47, 43, 37, 24],
        body: logs.map(log => [String(log.memberId || 'Not recorded'), `${log.memberName}\n${log.barangay || 'Not recorded'}`, log.eventName || 'Not recorded', valid(log.scanTime) ? `${formatDate(log.scanTime)}\n${formatTime(log.scanTime)}` : 'Not recorded', log.status || 'present']),
        emptyMessage: 'No attendance records match this report scope.' },
    ],
  });
}
