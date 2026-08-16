// Attendance module API services
import attendanceSecretaryAPI from './secretary.js';
import attendanceAdminAPI from './admin.js';

// Export organized APIs
export const attendanceAPI = {
  secretary: attendanceSecretaryAPI,
  admin: attendanceAdminAPI
};

export default attendanceAPI;