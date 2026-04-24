// Attendance module API services
import attendanceMemberAPI from './member.js';
import attendanceSecretaryAPI from './secretary.js';
import attendanceAdminAPI from './admin.js';

// Export organized APIs
export const attendanceAPI = {
  member: attendanceMemberAPI,
  secretary: attendanceSecretaryAPI,
  admin: attendanceAdminAPI
};

export default attendanceAPI;