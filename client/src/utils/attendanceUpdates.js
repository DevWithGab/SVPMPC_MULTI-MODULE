export const ATTENDANCE_UPDATED_EVENT = 'svpmpc:attendance-updated';
export const ATTENDANCE_UPDATED_KEY = 'svpmpc:attendance-updated-at';

/* Notify dito sa page na ito at sa ibang tabs pagkatapos kumpirmahin ng
API yung saved check-in. Isang invalidation marker lang ang isto-store,
hindi yung member or attendance data. */
export function notifyAttendanceUpdated() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new window.Event(ATTENDANCE_UPDATED_EVENT));
  try {
    window.localStorage.setItem(ATTENDANCE_UPDATED_KEY, `${Date.now()}:${Math.random()}`);
  } catch {
    // Storage may be unavailable; cross-device polling still updates the list.
  }
}
