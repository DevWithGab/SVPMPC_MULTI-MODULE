import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests if it exists
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ============================================
// AUTHENTICATION API
// ============================================
export const authAPI = {
  login: async (username, password) => {
    const response = await api.post('/auth/login', { username, password });
    return response.data;
  },

  changePassword: async (userId, oldPassword, newPassword) => {
    const response = await api.put(`/auth/change-password/${userId}`, {
      oldPassword,
      newPassword,
    });
    return response.data;
  },

  getProfile: async (userId) => {
    const response = await api.get(`/auth/profile/${userId}`);
    return response.data;
  },

  getCredentialHistory: async (userId) => {
    const response = await api.get(`/auth/credential-history/${userId}`);
    return response.data;
  },

  verifyToken: async () => {
    const response = await api.get('/auth/verify-token');
    return response.data;
  },
};

// ============================================
// BULK IMPORT API
// ============================================
export const bulkImportAPI = {
  uploadCSV: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('createdBy', 'admin');

    const response = await api.post('/auth/bulk-import/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  confirmImport: async (operationId, sendVia = ['email', 'sms']) => {
    const response = await api.post('/auth/bulk-import/confirm', {
      operationId,
      sendVia,
    });
    return response.data;
  },

  getImportStatus: async (operationId) => {
    const response = await api.get(`/auth/bulk-import/status/${operationId}`);
    return response.data;
  },

  getImportDetails: async (operationId) => {
    const response = await api.get(`/auth/bulk-import/details/${operationId}`);
    return response.data;
  },

  getAllOperations: async () => {
    const response = await api.get('/auth/bulk-import/operations');
    return response.data;
  },
};

// ============================================
// ATTENDANCE - MEMBER API
// ============================================
export const memberAPI = {
  getAllMembers: async () => {
    const response = await api.get('/attendance/members');
    return response.data;
  },

  getMemberById: async (memberId) => {
    const response = await api.get(`/attendance/members/${memberId}`);
    return response.data;
  },

  uploadMembers: async (file) => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await api.post('/attendance/members/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  generateQRCodes: async (memberIds) => {
    const response = await api.post('/attendance/members/generate-qr', {
      memberIds,
    });
    return response.data;
  },

  generateAllQRCodes: async () => {
    const response = await api.post('/attendance/members/generate-all-qr');
    return response.data;
  },
};

// ============================================
// ATTENDANCE - EVENT API
// ============================================
export const eventAPI = {
  createEvent: async (eventData) => {
    const response = await api.post('/attendance/events', eventData);
    return response.data;
  },

  getAllEvents: async () => {
    const response = await api.get('/attendance/events');
    return response.data;
  },

  getEventById: async (eventId) => {
    const response = await api.get(`/attendance/events/${eventId}`);
    return response.data;
  },

  updateEvent: async (eventId, eventData) => {
    const response = await api.put(`/attendance/events/${eventId}`, eventData);
    return response.data;
  },

  deleteEvent: async (eventId) => {
    const response = await api.delete(`/attendance/events/${eventId}`);
    return response.data;
  },
};

// ============================================
// ATTENDANCE - SCANNER API
// ============================================
export const scannerAPI = {
  registerScanner: async (scannerData) => {
    const response = await api.post('/attendance/scanner/register', scannerData);
    return response.data;
  },

  sendHeartbeat: async (stationId) => {
    const response = await api.post('/attendance/scanner/heartbeat', {
      stationId,
    });
    return response.data;
  },

  processScan: async (stationId, qrCodeData, eventId) => {
    const response = await api.post('/attendance/scanner/scan', {
      stationId,
      qrCodeData,
      eventId,
    });
    return response.data;
  },

  getAllScanners: async () => {
    const response = await api.get('/attendance/scanner');
    return response.data;
  },

  getScannerById: async (stationId) => {
    const response = await api.get(`/attendance/scanner/${stationId}`);
    return response.data;
  },

  getScanLogs: async (stationId) => {
    const response = await api.get(`/attendance/scanner/${stationId}/logs`);
    return response.data;
  },

  updateScannerStatus: async (stationId, status) => {
    const response = await api.put(`/attendance/scanner/${stationId}/status`, {
      status,
    });
    return response.data;
  },
};

// ============================================
// ATTENDANCE - MEMBER PORTAL API
// ============================================
export const memberPortalAPI = {
  getMemberProfile: async (memberId) => {
    const response = await api.get(
      `/attendance/member-portal/${memberId}/profile`
    );
    return response.data;
  },

  getAttendanceHistory: async (memberId) => {
    const response = await api.get(
      `/attendance/member-portal/${memberId}/attendance-history`
    );
    return response.data;
  },
};

// ============================================
// ATTENDANCE - ATTENDANCE RECORDS API
// ============================================
export const attendanceAPI = {
  recordAttendance: async (memberId, eventId, scanTime) => {
    const response = await api.post('/attendance/attendance/record', {
      memberId,
      eventId,
      scanTime,
    });
    return response.data;
  },

  getAttendanceByEvent: async (eventId) => {
    const response = await api.get(`/attendance/attendance/event/${eventId}`);
    return response.data;
  },

  getAttendanceStats: async (eventId) => {
    const response = await api.get(`/attendance/attendance/stats/${eventId}`);
    return response.data;
  },

  generateReport: async (eventId, format = 'pdf') => {
    const response = await api.post('/attendance/attendance/report', {
      eventId,
      format,
    });
    return response.data;
  },

  getAllAttendance: async () => {
    const response = await api.get('/attendance/attendance');
    return response.data;
  },
};

// ============================================
// MORTUARY - DASHBOARD API
// ============================================
export const mortuaryDashboardAPI = {
  getDashboard: async (memberId) => {
    const response = await api.get(`/mortuary/dashboard/${memberId}`);
    return response.data;
  },
};

// ============================================
// MORTUARY - CLAIMS API
// ============================================
export const claimAPI = {
  fileNewClaim: async (claimData) => {
    const response = await api.post('/mortuary/claims/file', claimData);
    return response.data;
  },

  getClaimHistory: async (memberId) => {
    const response = await api.get(`/mortuary/claims/${memberId}`);
    return response.data;
  },

  getClaimById: async (claimId) => {
    const response = await api.get(`/mortuary/claims/detail/${claimId}`);
    return response.data;
  },

  approveClaim: async (claimId, approvalData) => {
    const response = await api.put(
      `/mortuary/claims/${claimId}/approve`,
      approvalData
    );
    return response.data;
  },

  rejectClaim: async (claimId, rejectionData) => {
    const response = await api.put(
      `/mortuary/claims/${claimId}/reject`,
      rejectionData
    );
    return response.data;
  },

  payClaim: async (claimId, paymentData) => {
    const response = await api.put(
      `/mortuary/claims/${claimId}/pay`,
      paymentData
    );
    return response.data;
  },
};

// ============================================
// MORTUARY - CONTRIBUTIONS API
// ============================================
export const contributionAPI = {
  recordContribution: async (contributionData) => {
    const response = await api.post(
      '/mortuary/contributions/record',
      contributionData
    );
    return response.data;
  },

  getContributionHistory: async (memberId) => {
    const response = await api.get(`/mortuary/contributions/${memberId}`);
    return response.data;
  },

  getAllContributions: async () => {
    const response = await api.get('/mortuary/contributions');
    return response.data;
  },
};

// ============================================
// MORTUARY - LEDGER API
// ============================================
export const ledgerAPI = {
  getMemberLedger: async (memberId) => {
    const response = await api.get(`/mortuary/ledger/${memberId}`);
    return response.data;
  },

  getAllLedger: async () => {
    const response = await api.get('/mortuary/ledger');
    return response.data;
  },

  getMemberBalance: async (memberId) => {
    const response = await api.get(`/mortuary/balance/${memberId}`);
    return response.data;
  },
};

// ============================================
// MORTUARY - PAYMENT SCHEDULE API
// ============================================
export const paymentScheduleAPI = {
  createPaymentSchedule: async (scheduleData) => {
    const response = await api.post('/mortuary/schedule/create', scheduleData);
    return response.data;
  },

  getPaymentSchedule: async (memberId) => {
    const response = await api.get(`/mortuary/schedule/${memberId}`);
    return response.data;
  },

  getAllPaymentSchedules: async () => {
    const response = await api.get('/mortuary/schedule');
    return response.data;
  },

  getOverduePayments: async () => {
    const response = await api.get('/mortuary/schedule/overdue');
    return response.data;
  },

  updateNextDueDate: async (scheduleId, nextDueDate) => {
    const response = await api.put(
      `/mortuary/schedule/${scheduleId}/update-due`,
      { nextDueDate }
    );
    return response.data;
  },

  markReminderSent: async (scheduleId, reminderData) => {
    const response = await api.put(
      `/mortuary/schedule/${scheduleId}/reminder-sent`,
      reminderData
    );
    return response.data;
  },
};

// ============================================
// MORTUARY - NOTIFICATIONS API
// ============================================
export const notificationAPI = {
  sendReminderToMember: async (memberId, reminderData) => {
    const response = await api.post(
      '/mortuary/notifications/send-reminder',
      { memberId, ...reminderData }
    );
    return response.data;
  },

  sendBulkRemindersToOverdue: async (reminderData) => {
    const response = await api.post(
      '/mortuary/notifications/send-bulk-overdue',
      reminderData
    );
    return response.data;
  },

  sendRemindersToMembers: async (memberIds, reminderData) => {
    const response = await api.post(
      '/mortuary/notifications/send-to-members',
      { memberIds, ...reminderData }
    );
    return response.data;
  },

  getReminderHistory: async (memberId) => {
    const response = await api.get(
      `/mortuary/notifications/history/${memberId}`
    );
    return response.data;
  },
};

// ============================================
// ADMIN - MEMBER MANAGEMENT API
// ============================================
export const adminAPI = {
  createMember: async (memberData) => {
    const response = await api.post('/admin/members/create', memberData);
    return response.data;
  },

  bulkCreateMembers: async (members) => {
    const response = await api.post('/admin/members/bulk-create', { members });
    return response.data;
  },

  getAllMembers: async (params = {}) => {
    const response = await api.get('/admin/members', { params });
    return response.data;
  },

  updateMember: async (memberId, updateData) => {
    const response = await api.put(`/admin/members/${memberId}`, updateData);
    return response.data;
  },

  deleteMember: async (memberId) => {
    const response = await api.delete(`/admin/members/${memberId}`);
    return response.data;
  },

  resetMemberPassword: async (memberId) => {
    const response = await api.post(`/admin/members/${memberId}/reset-password`);
    return response.data;
  },
};

// ============================================
// MORTUARY - TREASURER API
// ============================================
export const treasurerAPI = {
  // Dashboard
  getDashboard: async () => {
    const response = await api.get('/mortuary/treasurer/dashboard');
    return response.data;
  },

  // Balance Management
  getAllMemberBalances: async () => {
    const response = await api.get('/mortuary/treasurer/balances/all');
    return response.data;
  },

  processAutomaticDeduction: async (deductionData) => {
    const response = await api.post('/mortuary/treasurer/balances/automatic-deduction', deductionData);
    return response.data;
  },

  checkLowBalanceMembers: async () => {
    const response = await api.get('/mortuary/treasurer/balances/low-balance-check');
    return response.data;
  },

  sendLowBalanceNotifications: async (memberIds = []) => {
    const response = await api.post('/mortuary/treasurer/balances/send-low-balance-notifications', { memberIds });
    return response.data;
  },

  // Contributions
  recordContribution: async (contributionData) => {
    const response = await api.post('/mortuary/treasurer/contributions/record', contributionData);
    return response.data;
  },

  getAllContributions: async () => {
    const response = await api.get('/mortuary/treasurer/contributions');
    return response.data;
  },

  // Notifications
  sendReminderToMember: async (reminderData) => {
    const response = await api.post('/mortuary/treasurer/notifications/send-reminder', reminderData);
    return response.data;
  },

  sendBulkReminders: async (reminderData) => {
    const response = await api.post('/mortuary/treasurer/notifications/send-bulk-overdue', reminderData);
    return response.data;
  },

  sendRemindersToMembers: async (memberIds, reminderData) => {
    const response = await api.post('/mortuary/treasurer/notifications/send-to-members', { memberIds, ...reminderData });
    return response.data;
  },

  getReminderHistory: async (memberId) => {
    const response = await api.get(`/mortuary/treasurer/notifications/history/${memberId}`);
    return response.data;
  },
};

export default api;
