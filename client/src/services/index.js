// Centralized API Services
// Simple organized structure by module and role

// Authentication services
export { authAPI, bulkImportAPI } from './auth.js';

// Module services
export { mortuaryAPI } from './mortuary/index.js';
export { attendanceAPI } from './attendance/index.js';

// Individual role services for direct import
export { default as mortuaryMemberAPI } from './mortuary/member.js';
export { default as mortuaryTreasurerAPI } from './mortuary/treasurer.js';
export { default as mortuaryAdminAPI } from './mortuary/admin.js';

export { default as attendanceMemberAPI } from './attendance/member.js';
export { default as attendanceSecretaryAPI } from './attendance/secretary.js';
export { default as attendanceAdminAPI } from './attendance/admin.js';

// Main API instance
export { default as api } from './api.js';

// ============================================
// USAGE EXAMPLES
// ============================================

/*
// 1. Using module APIs (RECOMMENDED)
import { mortuaryAPI, attendanceAPI } from '@/services';

// Member operations
const memberData = await mortuaryAPI.member.dashboard.getDashboardData();
const contributions = await mortuaryAPI.member.contributions.getContributions();

// Treasurer operations
const claims = await mortuaryAPI.treasurer.claims.getClaims();
const notifications = await mortuaryAPI.treasurer.notifications.sendSMSNotification(data);

// Secretary operations
const events = await attendanceAPI.secretary.events.getEvents();
const attendance = await attendanceAPI.secretary.attendance.getAttendanceRecords();

// 2. Using individual role APIs
import { mortuaryMemberAPI, attendanceSecretaryAPI } from '@/services';

const dashboardData = await mortuaryMemberAPI.dashboard.getDashboardData();
const eventData = await attendanceSecretaryAPI.events.createEvent(eventData);

// 3. Using authentication APIs
import { authAPI } from '@/services';

const loginResult = await authAPI.login(username, password);
const profile = await authAPI.getProfile(userId);
*/