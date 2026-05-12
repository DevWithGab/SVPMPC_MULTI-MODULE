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

export function formatForFilename(value) {
  const date = toDate(value);
  return date.toISOString().split('T')[0];
}

export default {
  formatDate,
  formatTime,
  formatDateTime,
  formatForFilename
};
