import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001/api';

const api = axios.create({
  baseURL: `${API_BASE_URL}/attendance/member`,
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
// ATTENDANCE MEMBER API
// ============================================

// Dashboard APIs
export const dashboardAPI = {
  // Get member dashboard data
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

  // Generate member QR code
  generateMemberQRCode: async () => {
    try {
      const response = await api.get('/qr-code');
      return {
        success: true,
        data: response.data.data,
        message: response.data.message
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to generate QR code',
        error: error.response?.data
      };
    }
  },

  // Get member profile
  getProfile: async () => {
    try {
      const response = await api.get('/profile');
      return {
        success: true,
        data: response.data.data
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to get profile',
        error: error.response?.data
      };
    }
  }
};

// Attendance APIs
export const attendanceAPI = {
  // Get member's attendance history
  getAttendanceHistory: async (params = {}) => {
    try {
      const response = await api.get('/attendance/history', { params });
      return {
        success: true,
        data: response.data.data
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to get attendance history',
        error: error.response?.data
      };
    }
  },

  // Record attendance via QR scan
  recordAttendance: async (attendanceData) => {
    try {
      const response = await api.post('/attendance/record', attendanceData);
      return {
        success: true,
        data: response.data.data,
        message: response.data.message
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to record attendance',
        error: error.response?.data
      };
    }
  },

  // Get attendance statistics
  getAttendanceStats: async (params = {}) => {
    try {
      const response = await api.get('/attendance/stats', { params });
      return {
        success: true,
        data: response.data.data
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to get attendance stats',
        error: error.response?.data
      };
    }
  },

  // Get attendance certificate/proof
  getAttendanceCertificate: async (eventId) => {
    try {
      const response = await api.get(`/attendance/certificate/${eventId}`);
      return {
        success: true,
        data: response.data.data,
        message: response.data.message
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to get attendance certificate',
        error: error.response?.data
      };
    }
  }
};

// Event APIs
export const eventAPI = {
  // Get upcoming events for member
  getUpcomingEvents: async (params = {}) => {
    try {
      const response = await api.get('/events/upcoming', { params });
      return {
        success: true,
        data: response.data.data
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to get upcoming events',
        error: error.response?.data
      };
    }
  },

  // Get past events for member
  getPastEvents: async (params = {}) => {
    try {
      const response = await api.get('/events/past', { params });
      return {
        success: true,
        data: response.data.data
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to get past events',
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
        data: response.data.data
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to get event details',
        error: error.response?.data
      };
    }
  },

  // Search events
  searchEvents: async (params = {}) => {
    try {
      const response = await api.get('/events/search', { params });
      return {
        success: true,
        data: response.data.data
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to search events',
        error: error.response?.data
      };
    }
  }
};

// Export all APIs
export const attendanceMemberAPI = {
  dashboard: dashboardAPI,
  attendance: attendanceAPI,
  events: eventAPI
};

export default attendanceMemberAPI;