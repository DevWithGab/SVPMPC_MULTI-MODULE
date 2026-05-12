import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001/api';

const api = axios.create({
  baseURL: `${API_BASE_URL}/attendance/secretary`,
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

// Response interceptor for consistent error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/';
    }
    return Promise.reject(error);
  }
);

// ============================================
// ATTENDANCE SECRETARY API
// ============================================

// Dashboard APIs
export const dashboardAPI = {
  // Get secretary dashboard data
  getDashboardData: async () => {
    try {
      const response = await api.get('/dashboard');
      return {
        success: true,
        data: response.data.data
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to get dashboard data',
        error: error.response?.data
      };
    }
  },

  // Get event statistics
  getEventStats: async (params = {}) => {
    try {
      const response = await api.get('/stats', { params });
      return {
        success: true,
        data: response.data.data
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to get event stats',
        error: error.response?.data
      };
    }
  }
};

// Event Management APIs
export const eventAPI = {
  // Get all events with pagination
  getEvents: async (params = {}) => {
    try {
      const response = await api.get('/events', { params });
      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to get events',
        error: error.response?.data
      };
    }
  },

  // Create new event
  createEvent: async (eventData) => {
    try {
      const response = await api.post('/events', eventData);
      return {
        success: true,
        data: response.data,
        message: response.data.message
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to create event',
        error: error.response?.data
      };
    }
  },

  // Get event details
  getEventDetails: async (eventId) => {
    try {
      const response = await api.get(`/events/${eventId}`);
      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to get event details',
        error: error.response?.data
      };
    }
  },

  // Update event
  updateEvent: async (eventId, eventData) => {
    try {
      const response = await api.put(`/events/${eventId}`, eventData);
      return {
        success: true,
        data: response.data,
        message: response.data.message
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to update event',
        error: error.response?.data
      };
    }
  },

  // Delete event
  deleteEvent: async (eventId) => {
    try {
      const response = await api.delete(`/events/${eventId}`);
      return {
        success: true,
        message: response.data.message
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to delete event',
        error: error.response?.data
      };
    }
  },

  // Regenerate QR code for event
  regenerateQRCode: async (eventId) => {
    try {
      const response = await api.post(`/events/${eventId}/regenerate-qr`);
      return {
        success: true,
        data: response.data.data,
        message: response.data.message
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to regenerate QR code',
        error: error.response?.data
      };
    }
  },

  // Duplicate event
  duplicateEvent: async (eventId, duplicateData) => {
    try {
      const response = await api.post(`/events/${eventId}/duplicate`, duplicateData);
      return {
        success: true,
        data: response.data.data,
        message: response.data.message
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to duplicate event',
        error: error.response?.data
      };
    }
  }
};

// Attendance Management APIs
export const attendanceAPI = {
  // Get attendance records with pagination and filters
  getAttendanceRecords: async (params = {}) => {
    try {
      const response = await api.get('/attendance', { params });
      return {
        success: true,
        data: response.data.data
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to get attendance records',
        error: error.response?.data
      };
    }
  },

  // Manually mark attendance
  markAttendance: async (attendanceData) => {
    try {
      const response = await api.post('/attendance/mark', attendanceData);
      return {
        success: true,
        data: response.data.data,
        message: response.data.message
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to mark attendance',
        error: error.response?.data
      };
    }
  },

  // Update attendance record
  updateAttendance: async (attendanceId, attendanceData) => {
    try {
      const response = await api.put(`/attendance/${attendanceId}`, attendanceData);
      return {
        success: true,
        data: response.data.data,
        message: response.data.message
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to update attendance',
        error: error.response?.data
      };
    }
  },

  // Delete attendance record
  deleteAttendance: async (attendanceId) => {
    try {
      const response = await api.delete(`/attendance/${attendanceId}`);
      return {
        success: true,
        message: response.data.message
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to delete attendance',
        error: error.response?.data
      };
    }
  },

  // Get attendance summary for an event
  getEventAttendanceSummary: async (eventId) => {
    try {
      const response = await api.get(`/attendance/event/${eventId}`);
      return {
        success: true,
        data: response.data.data
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to get event attendance summary',
        error: error.response?.data
      };
    }
  },

  // Bulk mark attendance
  bulkMarkAttendance: async (bulkData) => {
    try {
      const response = await api.post('/attendance/bulk-mark', bulkData);
      return {
        success: true,
        data: response.data.data,
        message: response.data.message
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to bulk mark attendance',
        error: error.response?.data
      };
    }
  }
};

// Member Management APIs
export const memberAPI = {
  // Get all members with pagination and search
  getMembers: async (params = {}) => {
    try {
      const response = await api.get('/members', { params });
      return {
        success: true,
        data: response.data.data
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to get members',
        error: error.response?.data
      };
    }
  },

  // Get member details with attendance history
  getMemberDetails: async (memberId) => {
    try {
      const response = await api.get(`/members/${memberId}`);
      return {
        success: true,
        data: response.data.data
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to get member details',
        error: error.response?.data
      };
    }
  },

  // Generate QR code for member
  generateMemberQRCode: async (memberId) => {
    try {
      const response = await api.post(`/members/${memberId}/generate-qr`);
      return {
        success: true,
        data: response.data.data,
        message: response.data.message
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to generate member QR code',
        error: error.response?.data
      };
    }
  },

  // Get member directory (simplified view for selection)
  getMemberDirectory: async (params = {}) => {
    try {
      const response = await api.get('/members/directory', { params });
      return {
        success: true,
        data: response.data.data
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to get member directory',
        error: error.response?.data
      };
    }
  },

  // Update member status
  updateMemberStatus: async (memberId, status) => {
    try {
      const response = await api.put(`/members/${memberId}/status`, { status });
      return {
        success: true,
        data: response.data.data,
        message: response.data.message
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to update member status',
        error: error.response?.data
      };
    }
  },

  // Get member attendance summary
  getMemberAttendanceSummary: async (params = {}) => {
    try {
      const response = await api.get('/members/attendance-summary', { params });
      return {
        success: true,
        data: response.data.data
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to get member attendance summary',
        error: error.response?.data
      };
    }
  }
};

// Report Generation APIs
export const reportAPI = {
  // Generate attendance report for events
  generateAttendanceReport: async (params = {}) => {
    try {
      const response = await api.get('/reports/attendance', { params });
      return {
        success: true,
        data: response.data.data
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to generate attendance report',
        error: error.response?.data
      };
    }
  },

  // Generate member attendance report
  generateMemberAttendanceReport: async (params = {}) => {
    try {
      const response = await api.get('/reports/member-attendance', { params });
      return {
        success: true,
        data: response.data.data
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to generate member attendance report',
        error: error.response?.data
      };
    }
  },

  // Generate event summary report
  generateEventSummaryReport: async (params = {}) => {
    try {
      const response = await api.get('/reports/event-summary', { params });
      return {
        success: true,
        data: response.data.data
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to generate event summary report',
        error: error.response?.data
      };
    }
  },

  // Export attendance data
  exportAttendanceData: async (params = {}) => {
    try {
      const response = await api.get('/reports/export', { params });
      return {
        success: true,
        data: response.data.data
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to export attendance data',
        error: error.response?.data
      };
    }
  }
};

// Export all APIs
export const attendanceSecretaryAPI = {
  dashboard: dashboardAPI,
  events: eventAPI,
  attendance: attendanceAPI,
  members: memberAPI,
  reports: reportAPI
};

export default attendanceSecretaryAPI;