import { formatManilaDateISO } from './date.js';

// Match the API's PHT schedule, including legacy events spanning midnight.
export function scannerEventWindow(event) {
  if (!event?.eventDate || !Number.isFinite(new Date(event.eventDate).getTime())) return null;
  const date = formatManilaDateISO(event.eventDate);
  const time = value => {
    const match = /^(\d{1,2}):(\d{2})$/.exec(value);
    return match && Number(match[1]) < 24 && Number(match[2]) < 60
      ? `${match[1].padStart(2, '0')}:${match[2]}` : null;
  };
  const startTime = time(event.startTime || '00:00');
  const endTime = time(event.endTime || '23:59');
  if (!startTime || !endTime) return null;
  const start = new Date(`${date}T${startTime}:00+08:00`).getTime();
  let end = new Date(`${date}T${endTime}:00+08:00`).getTime();
  if (end <= start) end += 24 * 60 * 60 * 1000;
  return { start, end };
}

export function canScanEvent(event, now = Date.now()) {
  if (!event || !['upcoming', 'active'].includes(event.status)) return false;
  const window = scannerEventWindow(event);
  return Boolean(window && now >= window.start && now < window.end);
}
