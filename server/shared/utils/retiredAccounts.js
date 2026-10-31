// Also recognize the legacy username after earlier logins changed its role.
const isRetiredAttendanceAdmin = (user) =>
  user.username?.trim().toLowerCase() === 'attendance.admin' ||
  (user.role === 'admin' && user.modules?.includes('attendance') && !user.modules.includes('mortuary'));

module.exports = { isRetiredAttendanceAdmin };
