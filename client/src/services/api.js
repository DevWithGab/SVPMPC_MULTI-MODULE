import axios from 'axios';
import { notifyAttendanceUpdated } from '../utils/attendanceUpdates';
import { notifyClaimsUpdated } from '../utils/claimUpdates';
import { clearAuthSession } from '../utils/authSession';

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
  if (config.url === '/auth/login' || config.url === '/auth/community-stats') {
    return config;
  }
  
  const token = window.sessionStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/* Hinahandle dito yung 401 errors by clearing yung invalid session at
pinapabalik yung user sa login - tugma sa interceptor ng
services/attendance/secretary.js (yun lang yung ibang service module na
ginagamit pa; tignan yung sariling axios instance nito). Kung walang
redirect, yung missing/expired token iniiwan yung portal na half-working
lang: nagrender pa rin yung read-only screens (ilan pa rin dumadaan sa
legacy unauthenticated endpoints) pero yung bawat authenticated action,
tulad ng Approve/Reject, nagfail lang ng bare "Access token required" na
walang indication na ang ayos lang pala ay mag-login ulit. */
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && error.config?.url !== '/auth/login') {
      clearAuthSession();
      window.location.href = '/';
    }
    return Promise.reject(error);
  }
);

// ============================================
// AUTHENTICATION API
// ============================================
export const authAPI = {
  getCommunityStats: async (signal) => {
    const response = await api.get('/auth/community-stats', { signal });
    return response.data;
  },

  login: async (username, password) => {
    const response = await api.post('/auth/login', { username, password });
    return response.data;
  },

  changePassword: async (userId, oldPassword, newPassword) => {
    const response = await api.put(`/auth/change-password/${userId}`, {
      currentPassword: oldPassword,
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

  confirmImport: async (operationId) => {
    const response = await api.post('/auth/bulk-import/confirm', {
      operationId,
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
  /* Ngayon may cap na sa /attendance/members na 100 per request yung server
  (dati buong, lumalaking collection lang talaga binabalik nito sa isang
  unbounded query) - gusto pa rin ng bawat screen dito yung full roster
  para sa client-side search/filter, kaya pinaged through dito yung capped
  endpoint at pinagsama-sama. Nakikita pa rin ng callers yung parehong
  { count, members } shape gaya ng dati; walang kailangan baguhin sa
  downstream. */
  getAllMembers: async () => {
    let page = 1;
    let members = [];
    let pagination;
    do {
      const response = await api.get('/attendance/members', { params: { page, limit: 100 } });
      members = members.concat(response.data.members);
      pagination = response.data.pagination;
      page += 1;
    } while (pagination?.hasNextPage);
    return { count: members.length, members };
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

  /* Admin-only, authenticated (/attendance/admin/members/...) - ito yung
  single-member QR lifecycle actions. Iniwan na separate functions imbes
  na baguhin yung calls sa taas, kasi yung getAllMembers/generateQRCodes
  sa taas ay shared ng Secretary at Scanner screens na walang admin auth. */
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

/* Babalik yung qrCodeUrl bilang server-relative path (hal. "/uploads/qrcodes/x.png")
dahil static file ito, hindi API route - resolve ito against yung origin
ng API (hindi yung Vite dev origin kung saan naka-serve yung app mismo)
para sa <img>, download, at print. */
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

/* Yung GET /attendance/events ay nagbabalik ng shared paginated-list shape
{ success, data: [...events], pagination } (server/shared/utils/pagination.js),
pero halos lahat ng caller ng getAllEvents()/getEvents() sa baba ay ginawa
noong panahon ng lumang { events: [...] } shape at binabasa yung
response.events. Dahil sa mismatch, laging undefined yung response.events,
kaya yung bawat isa sa mga screens na ito ay tahimik na nagbabalik sa
empty list - pinaka-kitang-kita, nawawala agad yung bagong-create na event
sa sandaling mag-re-fetch ulit yung ibang parte ng app (hal. refreshData
ng useAttendance) gamit yung parehong sirang check. Dito na lang i-normalize
nang isang beses, kasama yung raw fields, para gumana pa rin yung bawat
existing `response.events` read kahit hindi na galawin yung bawat call site. */
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

  /* Admin-only, at kabaligtaran ng updateEvent sa taas gumagana ito kahit
  anuman yung status ng event (kasama yung closed/time-exceeded) -
  pinapayagan ito ng server specifically para sa requests na authenticated
  bilang 'admin' sa route na ito. */
  updateEventAsAdmin: async (eventId, eventData) => {
    const response = await api.put(`/attendance/admin/events/${eventId}`, eventData);
    return response.data;
  },

  /* Admin-only, at pag Closed na lang yung event - ang server ang nag-enforce
  sa dalawa (auth + status), ito lang yung tumuturo sa authenticated admin
  route imbes sa unauthenticated legacy na isa. */
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

/* Parehong mismatch gaya ng normalizeEventsResponse sa taas: nagbabalik yung
GET /attendance ng shared paginated-list shape { success, data: [...records], pagination },
pero halos lahat ng caller ng getAllAttendance() sa baba ay ginawa noong
panahon ng lumang { attendance: [...] } shape at binabasa yung
response.attendance - na laging undefined, kaya yung bawat isa sa mga
screens na ito (kasama yung Live Attendance tab ng Scanner Portal, via
useAttendance.js) ay tahimik na nakikita ang empty list at permanenteng
"Absent" yung bawat member kahit gaano karaming scans ang nagtagumpay.
Dito na lang i-normalize nang isang beses para maayos yung lahat ng
consumer. */
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
      qrId: options.qrId,
      justification: options.justification,
    };

    const response = await api.post('/attendance/attendance/record', payload);
    if (response.data?.success !== false) notifyAttendanceUpdated();
    return response.data;
  },

  /* Suportado ng params yung { page, limit } - parehong paginated-list shape
  gaya ng getAllAttendance, capped sa 100 rows per page server-side, kaya
  yung callers na kailangan ng bawat record para sa event ay dapat
  mag-page through dito (tignan yung fetchEventAttendance ng
  LiveAttendanceList para sa loop). */
  getAttendanceByEvent: async (eventId, params = {}) => {
    const response = await api.get(`/attendance/attendance/event/${eventId}`, { params });
    return normalizeAttendanceResponse(response.data);
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

  /* Suportado ng params yung { page, limit, scannedBy } - parehong
  paginated-list shape gaya ng getAttendanceByEvent, capped sa 100 rows
  per page server-side. */
  getAllAttendance: async (params = {}) => {
    const response = await api.get('/attendance/attendance', { params });
    return normalizeAttendanceResponse(response.data);
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

  /* Parehong registration ng Super Admin - naka-enroll ang member sa Mortuary
  at Attendance (shared Member record). */
  createMember: async (memberData) => {
    const response = await api.post('/mortuary/admin/members/create', memberData);
    return response.data;
  },
};

// ============================================
// MORTUARY - DASHBOARD API
// ============================================
export const mortuaryDashboardAPI = {
  getFundOverview: async () => (await api.get('/mortuary/admin/fund-overview')).data,
  getBalances: async () => (await api.get('/mortuary/admin/balances')).data,
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

  addRequirement: async (claimId, label) => {
    const response = await api.post(`/mortuary/admin/claims/${claimId}/requirements`, { label });
    return response.data;
  },

  removeRequirement: async (claimId, requirementKey) => {
    const response = await api.delete(`/mortuary/admin/claims/${claimId}/requirements/${encodeURIComponent(requirementKey)}`);
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
    if (response.data.success !== false) notifyClaimsUpdated();
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

  bulkUploadBeneficiaries: async (csv, action = 'preview') => {
    const response = await api.post('/mortuary/admin/beneficiaries/bulk-upload', { csv, action });
    return response.data;
  },
};

// ============================================
// MORTUARY - DEDUCTION SETTINGS API (Treasurer)
// ============================================
export const deductionSettingAPI = {
  getCurrentRate: async () => {
    const response = await api.get('/mortuary/treasurer/settings/deduction-rate/current');
    return response.data;
  },

  getRateHistory: async (params = {}) => {
    const response = await api.get('/mortuary/treasurer/settings/deduction-rate', { params });
    return response.data;
  },

  updateRate: async (rateData) => {
    const response = await api.post('/mortuary/treasurer/settings/deduction-rate', rateData);
    return response.data;
  },
};

// ============================================
// MORTUARY - NOTICE THRESHOLD SETTINGS API (Treasurer)
// ============================================
export const noticeThresholdSettingAPI = {
  getCurrentThresholds: async () => {
    const response = await api.get('/mortuary/treasurer/settings/notice-thresholds/current');
    return response.data;
  },

  getThresholdHistory: async (params = {}) => {
    const response = await api.get('/mortuary/treasurer/settings/notice-thresholds', { params });
    return response.data;
  },

  updateThresholds: async (thresholdData) => {
    const response = await api.post('/mortuary/treasurer/settings/notice-thresholds', thresholdData);
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
// MORTUARY - BALANCE REMINDERS
// ============================================
// Balance reminders use printed/PDF notices; SMS APIs have been removed.

// ============================================
// ADMIN - MEMBER MANAGEMENT API
// ============================================
export const staffAPI = {
  remove: id => api.delete('/admin/staff/' + id).then(r => r.data),
  list: () => api.get('/admin/staff').then(r => r.data),
  create: data => api.post('/admin/staff', data).then(r => r.data),
  update: (id, data) => api.put('/admin/staff/' + id, data).then(r => r.data),
  resetPassword: id => api.post('/admin/staff/' + id + '/reset-password').then(r => r.data),
};
export const adminAPI = {
  login: async (username, password) => {
    const response = await api.post('/auth/login', { username, password, expectedRole: 'super_admin' });
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

  toggleMemberStatus: async (memberId) => {
    const response = await api.post(`/admin/members/${memberId}/toggle-status`);
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

  bulkUploadLedger: async (csv, action = 'preview', dateOrder = 'auto') => {
    const response = await api.post('/mortuary/treasurer/ledger/bulk-upload', { csv, action, dateOrder });
    return response.data;
  },

  bulkUploadPayments: async (csv, action = 'preview', dateOrder = 'auto') => {
    const response = await api.post('/mortuary/treasurer/contributions/bulk-upload', { csv, action, dateOrder });
    return response.data;
  },

  // Balance reminders use printed/PDF notices; SMS APIs have been removed.

  /* Lahat ng claim kahit anong status - ginagamit ng Reports screen (Claims
  Report / Claim Deductions), na kailangan ng full list imbes isang
  lifecycle stage sa isang pagkakataon lang gaya ng mga method sa baba. */
  getAllClaims: async (params = {}) => {
    const response = await api.get('/mortuary/treasurer/claims', { params });
    return response.data;
  },

  /* Claims processing - yung claim na nasa "pending_deduction" ay siya na
  mismo yung notification (walang separate notification model). */
  getPendingDeductionClaims: async (params = {}) => {
    const response = await api.get('/mortuary/treasurer/claims/pending-deduction', { params });
    return response.data;
  },

  getClaimById: async (claimId) => {
    const response = await api.get(`/mortuary/treasurer/claims/${claimId}`);
    return response.data;
  },

  /* Batch deduction - isang JV number para sa lahat ng piniling claim; isang beses
  lang sisingilin ang bawat member (rate x bilang ng claims). */
  processDeductionBatch: async (claimIds) => {
    const response = await api.post('/mortuary/treasurer/claims/deduction-batch', { claimIds });
    if (response.data.success !== false) notifyClaimsUpdated();
    return response.data;
  },

  /* Read-only dry run - ipinapakita bilang confirm-step summary bago mag-commit
  (ilang claim, ilang member, magkano bawat member, total). Yung rate ay laging
  galing sa configured rate sa server. */
  previewDeductionBatch: async (claimIds) => {
    const response = await api.post('/mortuary/treasurer/claims/deduction-batch/preview', { claimIds });
    return response.data;
  },

  /* Yung active deduction rate, read-only. Parehong underlying setting na
  in-edit sa Treasurer -> Settings -> Deduction rate - ipinapakita dito para
  makita ng Process Deduction screen ng Treasurer yung rate na sisingilin. */
  getDeductionRate: async () => {
    const response = await api.get('/mortuary/treasurer/deduction-rate');
    return response.data;
  },

  /* Yung active balance notice thresholds, read-only - pinapayagan
  ng Member Ledger / Member Balances na i-classify yung members (Notice
  1/2/Final) sa parehong paraan na ikinonfigure sa Settings, pero hindi
  mababago dito. */
  getNoticeThresholds: async () => {
    const response = await api.get('/mortuary/treasurer/notice-thresholds');
    return response.data;
  },

  /* Background PDF generation para sa notice batch na masyadong laki para
  komportableng buuin sa browser - sinisimulan yung job (agad sumasagot
  yung server) at may separate status poll para tignan kung ready na
  i-download yung file. */
  startNoticeBatch: async (level, barangay) => {
    const response = await api.post(`/mortuary/treasurer/notices/${level}/batch`, barangay ? { barangay } : {});
    return response.data;
  },

  getNoticeBatchStatus: async (jobId) => {
    const response = await api.get(`/mortuary/treasurer/notices/batch/${jobId}`);
    return response.data;
  },

  /* Yung PDF mismo ay naka-behind auth na ngayon (wala na yung public
  /uploads/notice-batches/ path) - kukunin ito gamit yung authenticated
  client at magbabalik ng blob URL na pwedeng itukoy ng <a download> link.
  Responsibilidad ng caller yung URL.revokeObjectURL pag hindi na kailangan. */
  downloadNoticeBatchPdf: async (jobId) => {
    const response = await api.get(`/mortuary/treasurer/notices/batch/${jobId}/download`, { responseType: 'blob' });
    return URL.createObjectURL(response.data);
  },

  /* Deduction Summary - isang month-end record per buwan, kasama ang bawat
  claim na na-deduct sa buwan na iyon, at `totals` across sa lahat ng matching. */
  getDeductionSummary: async (params = {}) => {
    const response = await api.get('/mortuary/treasurer/claims/deduction-summary', { params });
    return response.data;
  },
};

// ============================================
// ATTENDANCE - DATABASE BACKUP/RESTORE API
// ============================================
export const backupAPI = {
  /* Admin-only (hindi super_admin - parehong stricter gate gaya ng QR
  lifecycle actions). Tinatanggap yung parehong shape na dina-download ng
  "Complete System Backup" button: { members, events, attendanceLogs },
  kahit anong subset ng tatlo. */
  restore: async (backupData) => {
    const response = await api.post('/attendance/admin/backup/restore', backupData);
    return response.data;
  },

  // Mortuary's equivalent — accepts { members, contributions, ledgers }, any subset.
  restoreMortuary: async (backupData) => {
    const response = await api.post('/mortuary/admin/backup/restore', backupData);
    return response.data;
  },

  // Complete backups, built by the server: every collection the module owns.
  exportAttendance: async () => {
    const response = await api.get('/attendance/admin/backup/export');
    return response.data;
  },
  exportMortuary: async () => {
    const response = await api.get('/mortuary/admin/backup/export');
    return response.data?.data;
  },

  /* Raw, unpaginated Ledger export para sa "Complete System Backup" button -
  ito talaga yung may dala ng balance history ng bawat member, dahil walang
  balance field ang Member mismo. */
  getMortuaryLedgerExport: async () => {
    const response = await api.get('/mortuary/admin/backup/ledger');
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
  getStats: async (startDate, endDate, module) => {
    const params = new URLSearchParams({ startDate, endDate });
    if (module) params.append('module', module);
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
