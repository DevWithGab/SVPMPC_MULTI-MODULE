const PH_TIMEZONE = 'Asia/Manila';

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

// For raw "HH:mm" wall-clock strings (Event.startTime/endTime etc.) — these
// are stored as plain time-of-day text already entered/interpreted as PHT,
// not a UTC instant, so there's nothing to convert across timezones. This
// only reformats 24-hour "HH:mm" into 12-hour "h:mm AM/PM" for display.
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

// Long-form date ("Thursday, September 4, 2026") for banner/greeting-style
// headers — like formatDate, always in Manila's calendar date.
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

// The current hour (0-23) in Manila — for anything time-of-day-dependent
// (a "Good morning/afternoon/evening" greeting, say) that should reflect
// PHT rather than the viewer's own device timezone.
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
