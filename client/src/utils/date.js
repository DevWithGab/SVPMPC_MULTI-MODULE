const PH_TIMEZONE = 'Asia/Manila';

/* Hindi dapat umasa yung machine-readable dates sa display order o
separators ng locale. Gamitin yung calendar date ng Manila, kahit pa
malapit sa UTC midnight. */
export function formatManilaDateISO(value = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: PH_TIMEZONE, calendar: 'gregory', numberingSystem: 'latn',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(toDate(value));
  const fields = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${fields.year}-${fields.month}-${fields.day}`;
}

function toDate(value) {
  if (!value) return new Date();
  return value instanceof Date ? value : new Date(value);
}

export function formatDate(value) {
  const date = toDate(value);
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: PH_TIMEZONE,
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  }).format(date);
}

export function formatTime(value) {
  const date = toDate(value);
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: PH_TIMEZONE,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }).format(date);
}

export function formatDateTime(value) {
  return `${formatDate(value)} ${formatTime(value)}`;
}

/* Para sa raw "HH:mm" wall-clock strings (Event.startTime/endTime etc.) -
naka-store na ito bilang plain time-of-day text na in-enter/interpreted
na bilang PHT, hindi UTC instant, kaya walang kailangang iconvert across
timezones. Dito lang ni-reformat yung 24-hour "HH:mm" papunta sa 12-hour
"h:mm AM/PM" para sa display. */
export function formatTimeString(value) {
  if (!value) return '';
  const match = /^(\d{1,2}):(\d{2})/.exec(String(value).trim());
  if (!match) return String(value);
  const hours = Number(match[1]);
  const minutes = match[2];
  if (Number.isNaN(hours)) return String(value);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHour = hours % 12 || 12;
  return `${displayHour}:${minutes} ${period}`;
}

// Formats a "startTime - endTime" pair (both "HH:mm" strings) in one call.
export function formatTimeRange(startTime, endTime) {
  const start = formatTimeString(startTime);
  const end = formatTimeString(endTime);
  if (start && end) return `${start} - ${end}`;
  return start || end || '';
}

export function formatForFilename(value) {
  const date = toDate(value);
  return date.toISOString().split('T')[0];
}

/* Long-form date ("Thursday, September 4, 2026") para sa banner/greeting-
style headers - gaya ng formatDate, laging nasa calendar date ng Manila. */
export function formatLongDate(value) {
  const date = toDate(value);
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: PH_TIMEZONE,
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  }).format(date);
}

/* Yung current hour (0-23) sa Manila - para sa anumang time-of-day-dependent
(hal. "Good morning/afternoon/evening" greeting) na dapat sumasalamin sa
PHT imbes sa device timezone ng viewer mismo. */
export function getManilaHour(value = new Date()) {
  const date = toDate(value);
  const hourPart = new Intl.DateTimeFormat('en-US', {
    timeZone: PH_TIMEZONE,
    hour: 'numeric',
    hour12: false
  }).formatToParts(date).find((part) => part.type === 'hour')?.value;
  const hour = Number(hourPart);
  // en-US/hour12:false can format midnight as "24" rather than "0".
  return hour === 24 ? 0 : hour;
}

export default {
  formatDate,
  formatTime,
  formatDateTime,
  formatTimeString,
  formatTimeRange,
  formatLongDate,
  getManilaHour,
  formatForFilename
};
