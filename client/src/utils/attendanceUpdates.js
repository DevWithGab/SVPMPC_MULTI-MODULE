export const ATTENDANCE_UPDATED_EVENT = 'svpmpc:attendance-updated';
export const ATTENDANCE_UPDATED_KEY = 'svpmpc:attendance-updated-at';

// Notify this page and other tabs after the API confirms a saved check-in.
// Store only an invalidation marker, never member or attendance data.
export function notifyAttendanceUpdated() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new window.Event(ATTENDANCE_UPDATED_EVENT));
  try {
    window.localStorage.setItem(ATTENDANCE_UPDATED_KEY, `${Date.now()}:${Math.random()}`);
  } catch {
    // Storage may be unavailable; cross-device polling still updates the list.
  }
}
