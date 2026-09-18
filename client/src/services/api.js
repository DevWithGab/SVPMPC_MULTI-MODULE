import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests if it exists (except for login)
api.interceptors.request.use((config) => {
  // Don't add token to login requests
  if (config.url === '/auth/login') {
    return config;
  }
  
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 errors by clearing the invalid session and sending the user
// back to login — matching services/attendance/admin.js and secretary.js.
// Without the redirect, a missing/expired token left the portal silently
// half-working: read-only screens kept rendering (several still go through
// legacy unauthenticated endpoints) while every authenticated action, like
// Approve/Reject, failed with a bare "Access token required" and no
// indication that the fix was simply to log back in.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && error.config?.url !== '/auth/login') {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('currentView');
      localStorage.removeItem('selectedModule');
      window.location.href = '/';
    }
    return Promise.reject(error);
  }
);

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

  // Admin-only, authenticated (/attendance/admin/members/...) — the single-
  // member QR lifecycle actions. Kept as separate functions rather than
  // repointing the calls above, since getAllMembers/generateQRCodes above
  // are shared by Secretary and Scanner screens that don't have admin auth.
  generateMemberQR: async (memberId) => {
    const response = await api.post('/attendance/admin/members/generate-qr', {
      memberIds: [memberId],
    });
    return response.data;
  },

  generateAllMissingQR: async () => {
    const response = await api.post('/attendance/admin/members/generate-all-qr');
    return response.data;
  },

  regenerateMemberQR: async (memberId) => {
    const response = await api.post(`/attendance/admin/members/${memberId}/regenerate-qr`);
    return response.data;
  },

  deactivateMemberQR: async (memberId) => {
    const response = await api.post(`/attendance/admin/members/${memberId}/deactivate-qr`);
    return response.data;
  },

  reactivateMemberQR: async (memberId) => {
    const response = await api.post(`/attendance/admin/members/${memberId}/reactivate-qr`);
    return response.data;
  },

  getMemberQRStatus: async (memberId) => {
    const response = await api.get(`/attendance/admin/members/${memberId}/qr-status`);
    return response.data;
  },
};

// qrCodeUrl comes back as a server-relative path (e.g. "/uploads/qrcodes/x.png")
// since it's a static file, not an API route — resolve it against the API's
// origin (not the Vite dev origin the app itself is served from) for <img>,
// download, and print.
export const resolveQrAssetUrl = (qrCodeUrl) => {
  if (!qrCodeUrl) return null;
  if (/^https?:\/\//i.test(qrCodeUrl)) return qrCodeUrl;
  const origin = API_BASE_URL.replace(/\/api\/?$/, '');
  return `${origin}${qrCodeUrl.startsWith('/') ? '' : '/'}${qrCodeUrl}`;
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
// ATTENDANCE - EVENT API
// ============================================

// GET /attendance/events returns the shared paginated-list shape
// { success, data: [...events], pagination } (server/shared/utils/pagination.js),
// but nearly every caller of getAllEvents()/getEvents() below was written
// against an older { events: [...] } shape and reads response.events. That
// mismatch meant response.events was always undefined, so every one of
// those screens silently fell back to an empty list — most visibly, a
// freshly-created event vanishing the instant any other part of the app
// (e.g. useAttendance's refreshData) re-fetched with the same broken check.
// Normalizing once here, alongside the raw fields, keeps every existing
// `response.events` read working without having to touch each call site.
const normalizeEventsResponse = (payload) => {
  const events = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.data)
      ? payload.data
      : Array.isArray(payload?.events)
        ? payload.events
        : [];
  return { ...payload, events };
};

export const eventAPI = {
  createEvent: async (eventData) => {
    const response = await api.post('/attendance/events', eventData);
    return response.data;
  },

  getAllEvents: async () => {
    const response = await api.get('/attendance/events');
    return normalizeEventsResponse(response.data);
  },

  // Get events with query params (search, location, status, etc.)
  getEvents: async (params = {}) => {
    const response = await api.get('/attendance/events', { params });
    return normalizeEventsResponse(response.data);
  },

  getEventById: async (eventId) => {
    const response = await api.get(`/attendance/events/${eventId}`);
    return response.data;
  },

  updateEvent: async (eventId, eventData) => {
    const response = await api.put(`/attendance/events/${eventId}`, eventData);
    return response.data;
  },

  // Admin-only, and only once an event is Closed — the server enforces both
  // (auth + status), this just targets the authenticated admin route rather
  // than the unauthenticated legacy one.
  deleteEvent: async (eventId) => {
    const response = await api.delete(`/attendance/admin/events/${eventId}`);
    return response.data;
  },

  approveEvent: async (eventId) => {
    const response = await api.post(`/attendance/admin/events/${eventId}/approve`);
    return response.data;
  },

  rejectEvent: async (eventId, reason) => {
    const response = await api.post(`/attendance/admin/events/${eventId}/reject`, { reason });
    return response.data;
  },

  reopenEvent: async (eventId, { eventDate, startTime, endTime, reason }) => {
    const response = await api.post(`/attendance/admin/events/${eventId}/reopen`, {
      eventDate,
      startTime,
      endTime,
      reason,
    });
    return response.data;
  },
};


// ============================================
// ATTENDANCE - ATTENDANCE RECORDS API
// ============================================

// Same mismatch as normalizeEventsResponse above: GET /attendance returns
// the shared paginated-list shape { success, data: [...records], pagination },
// but most callers of getAllAttendance() below were written against an
// older { attendance: [...] } shape and read response.attendance — which is
// always undefined, so every one of those screens (including the Scanner
// Portal's Live Attendance tab, via useAttendance.js) silently saw an empty
// list and every member showed as permanently "Absent" no matter how many
// scans actually succeeded. Normalizing once here fixes every consumer.
const normalizeAttendanceResponse = (payload) => {
  const attendance = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.data)
      ? payload.data
      : Array.isArray(payload?.attendance)
        ? payload.attendance
        : [];
  return { ...payload, attendance, data: attendance };
};

export const attendanceAPI = {
  recordAttendance: async (memberId, eventId, scanTime, scannedBy, options = {}) => {
    const payload = {
      memberId,
      eventId,
      scanTime,
      scannedBy,
      entrySource: options.entrySource,
      justification: options.justification,
    };

    const endpoints = ['/attendance/record', '/attendance/attendance/record'];

    let lastError = null;
    for (const endpoint of endpoints) {
      try {
        const response = await api.post(endpoint, payload);
        return response.data;
      } catch (error) {
        lastError = error;
        if (error.response?.status !== 404) {
          throw error;
        }
      }
    }

    throw lastError;
  },

  // params supports { page, limit } — same paginated-list shape as
  // getAllAttendance, capped at 100 rows per page server-side, so callers
  // that need every record for the event should page through it (see
  // LiveAttendanceList's fetchEventAttendance for the loop).
  getAttendanceByEvent: async (eventId, params = {}) => {
    try {
      const response = await api.get(`/attendance/event/${eventId}`, { params });
      return normalizeAttendanceResponse(response.data);
    } catch (error) {
      if (error.response?.status !== 404) {
        throw error;
      }

      const response = await api.get(`/attendance/attendance/event/${eventId}`, { params });
      return normalizeAttendanceResponse(response.data);
    }
  },

  getAttendanceStats: async (eventId) => {
    try {
      const response = await api.get(`/attendance/stats/${eventId}`);
      return response.data;
    } catch (error) {
      if (error.response?.status !== 404) {
        throw error;
      }

      const response = await api.get(`/attendance/attendance/stats/${eventId}`);
      return response.data;
    }
  },

  generateReport: async (eventId, format = 'pdf') => {
    try {
      const response = await api.post('/attendance/report', {
        eventId,
        format,
      });
      return response.data;
    } catch (error) {
      if (error.response?.status !== 404) {
        throw error;
      }

      const response = await api.post('/attendance/attendance/report', {
        eventId,
        format,
      });
      return response.data;
    }
  },

  getAllAttendance: async () => {
    try {
      const response = await api.get('/attendance');
      return normalizeAttendanceResponse(response.data);
    } catch (error) {
      if (error.response?.status !== 404) {
        throw error;
      }

      const response = await api.get('/attendance/attendance');
      return normalizeAttendanceResponse(response.data);
    }
  },
};

// ============================================
// MORTUARY - MEMBER API
// ============================================
export const mortuaryMemberAPI = {
  getAllMembers: async (params = {}) => {
    const response = await api.get('/mortuary/admin/members', { params });
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

  getAdminDashboard: async () => {
    const response = await api.get('/mortuary/admin/dashboard');
    return response.data;
  },
};

// ============================================
// MORTUARY - CLAIMS API (Admin)
// ============================================
export const claimAPI = {
  createClaim: async (claimData) => {
    const response = await api.post('/mortuary/admin/claims', claimData);
    return response.data;
  },

  getAllClaims: async (params = {}) => {
    const response = await api.get('/mortuary/admin/claims', { params });
    return response.data;
  },

  getClaimById: async (claimId) => {
    const response = await api.get(`/mortuary/admin/claims/${claimId}`);
    return response.data;
  },

  updateRequirements: async (claimId, requirements) => {
    const response = await api.put(`/mortuary/admin/claims/${claimId}/requirements`, { requirements });
    return response.data;
  },

  updateVerification: async (claimId, verificationData) => {
    const response = await api.put(`/mortuary/admin/claims/${claimId}/verification`, verificationData);
    return response.data;
  },

  approveClaim: async (claimId, approvalData = {}) => {
    const response = await api.put(`/mortuary/admin/claims/${claimId}/approve`, approvalData);
    return response.data;
  },

  rejectClaim: async (claimId, rejectionData) => {
    const response = await api.put(`/mortuary/admin/claims/${claimId}/reject`, rejectionData);
    return response.data;
  },
};

// ============================================
// MORTUARY - BENEFICIARIES API (Admin)
// ============================================
export const beneficiaryAPI = {
  getAllBeneficiaries: async (params = {}) => {
    const response = await api.get('/mortuary/admin/beneficiaries', { params });
    return response.data;
  },

  getHistory: async (memberId) => {
    const response = await api.get(`/mortuary/admin/beneficiaries/${memberId}/history`);
    return response.data;
  },

  updateBeneficiary: async (memberId, beneficiaryData) => {
    const response = await api.put(`/mortuary/admin/beneficiaries/${memberId}`, beneficiaryData);
    return response.data;
  },
};

// ============================================
// MORTUARY - DEDUCTION SETTINGS API (Admin)
// ============================================
export const deductionSettingAPI = {
  getCurrentRate: async () => {
    const response = await api.get('/mortuary/admin/deduction-settings/current');
    return response.data;
  },

  getRateHistory: async (params = {}) => {
    const response = await api.get('/mortuary/admin/deduction-settings', { params });
    return response.data;
  },

  updateRate: async (rateData) => {
    const response = await api.post('/mortuary/admin/deduction-settings', rateData);
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
// MORTUARY - NOTIFICATIONS API (Removed - Now Automated)
// ============================================
// Manual notification methods removed - system now uses automatic threshold notifications

// ============================================
// ADMIN - MEMBER MANAGEMENT API
// ============================================
export const adminAPI = {
  login: async (username, password) => {
    const response = await api.post('/auth/login', { username, password });
    return response.data;
  },

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

  toggleMemberStatus: async (memberId) => {
    const response = await api.post(`/admin/members/${memberId}/toggle-status`);
    return response.data;
  },
};

// ============================================
// ADMIN - PAYOUT MANAGEMENT API
// ============================================
export const payoutAPI = {
  getAllPayouts: async () => {
    const response = await api.get('/mortuary/admin/payouts');
    return response.data;
  },

  recordPayout: async (payoutData) => {
    const response = await api.post('/mortuary/admin/payouts', payoutData);
    return response.data;
  },

  getPayoutById: async (payoutId) => {
    const response = await api.get(`/mortuary/admin/payouts/${payoutId}`);
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

  // Ledger Management
  getMemberLedger: async (memberId, limit = 100) => {
    const response = await api.get(`/mortuary/treasurer/ledger/${memberId}?limit=${limit}`);
    return response.data;
  },

  getAllLedger: async (transactionType = null, limit = 100) => {
    const params = new URLSearchParams({ limit });
    if (transactionType) params.append('transactionType', transactionType);
    const response = await api.get(`/mortuary/treasurer/ledger?${params}`);
    return response.data;
  },

  getMemberBalance: async (memberId) => {
    const response = await api.get(`/mortuary/treasurer/balance/${memberId}`);
    return response.data;
  },

  bulkUploadLedger: async (ledgerEntries) => {
    const response = await api.post('/mortuary/treasurer/ledger/bulk-upload', { ledgerEntries });
    return response.data;
  },

  // Notifications (Removed - Now Automated via Threshold System)
  // Manual notification methods removed

  // Claims processing — a claim sitting in "pending_deduction" is itself
  // the notification (no separate notification model exists).
  getPendingDeductionClaims: async (params = {}) => {
    const response = await api.get('/mortuary/treasurer/claims/pending-deduction', { params });
    return response.data;
  },

  getAwaitingReleaseClaims: async (params = {}) => {
    const response = await api.get('/mortuary/treasurer/claims/awaiting-release', { params });
    return response.data;
  },

  getClaimById: async (claimId) => {
    const response = await api.get(`/mortuary/treasurer/claims/${claimId}`);
    return response.data;
  },

  processClaimDeduction: async (claimId, data = {}) => {
    const response = await api.post(`/mortuary/treasurer/claims/${claimId}/process-deduction`, data);
    return response.data;
  },

  // Read-only dry run — shown as the confirm-step preview before committing
  // to a deduction (how many members, per-member amount, total collected).
  // The per-member amount always comes from the Admin-set rate on the server;
  // the Treasurer has no say in it, so nothing is passed in here.
  previewClaimDeduction: async (claimId) => {
    const response = await api.get(`/mortuary/treasurer/claims/${claimId}/deduction-preview`);
    return response.data;
  },

  // The active Admin-set deduction rate, read-only. Same underlying setting the
  // Admin edits in Deduction Settings — surfaced here so the Treasurer's
  // Process Deduction screen can display the rate it is about to charge.
  getDeductionRate: async () => {
    const response = await api.get('/mortuary/treasurer/deduction-rate');
    return response.data;
  },

  releaseClaim: async (claimId, data = {}) => {
    const response = await api.post(`/mortuary/treasurer/claims/${claimId}/release`, data);
    return response.data;
  },

  // Claim Disbursement Report — every claim already released, for
  // record-keeping (DV number, released by/when, amount).
  getDisbursementReport: async (params = {}) => {
    const response = await api.get('/mortuary/treasurer/claims/disbursement-report', { params });
    return response.data;
  },

  // Claims Income Report — one row per claim that reached the deduction stage:
  // collected from members, released to the beneficiary, retained as income.
  // The response also carries `totals` across every matching claim (not just
  // the page) and the active `maxBenefitAmount`.
  getClaimIncomeReport: async (params = {}) => {
    const response = await api.get('/mortuary/treasurer/claims/income-report', { params });
    return response.data;
  },
};

// ============================================
// ATTENDANCE - DATABASE BACKUP/RESTORE API
// ============================================
export const backupAPI = {
  // Admin-only (not super_admin — same stricter gate as the QR lifecycle
  // actions). Accepts the same shape the "Complete System Backup" button
  // downloads: { members, events, attendanceLogs }, any subset of the three.
  restore: async (backupData) => {
    const response = await api.post('/attendance/admin/backup/restore', backupData);
    return response.data;
  },

  // Mortuary's equivalent — accepts { members, contributions }, any subset.
  restoreMortuary: async (backupData) => {
    const response = await api.post('/mortuary/admin/backup/restore', backupData);
    return response.data;
  },
};

// ============================================
// AUDIT LOGGING API
// ============================================
export const auditAPI = {
  // Get all audit logs with filtering
  getLogs: async (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.userId) params.append('userId', filters.userId);
    if (filters.action) params.append('action', filters.action);
    if (filters.module) params.append('module', filters.module);
    if (filters.userRole) params.append('userRole', filters.userRole);
    if (filters.entityType) params.append('entityType', filters.entityType);
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);
    if (filters.page) params.append('page', filters.page);
    if (filters.limit) params.append('limit', filters.limit);

    const response = await api.get(`/audit/logs?${params}`);
    return response.data;
  },

  // Get audit trail for specific entity
  getEntityAuditTrail: async (entityType, entityId, limit = 20) => {
    const response = await api.get(`/audit/trail/${entityType}/${entityId}?limit=${limit}`);
    return response.data;
  },

  // Get audit logs summary statistics
  getStats: async (startDate, endDate) => {
    const params = new URLSearchParams({ startDate, endDate });
    const response = await api.get(`/audit/stats?${params}`);
    return response.data;
  },

  // Get activity by user
  getUserActivity: async (userId, page = 1, limit = 30) => {
    const response = await api.get(`/audit/user/${userId}?page=${page}&limit=${limit}`);
    return response.data;
  },

  // Get activity by role
  getRoleActivity: async (role, page = 1, limit = 50) => {
    const response = await api.get(`/audit/role/${role}?page=${page}&limit=${limit}`);
    return response.data;
  },
};

export default api;
