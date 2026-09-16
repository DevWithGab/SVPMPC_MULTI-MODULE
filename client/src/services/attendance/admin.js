import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001/api';

const api = axios.create({
  baseURL: `${API_BASE_URL}/attendance/admin`,
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
// ATTENDANCE ADMIN API
// ============================================

// Dashboard APIs
export const dashboardAPI = {
  // Get admin dashboard data
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

  // Get system statistics
  getSystemStats: async (params = {}) => {
    try {
      const response = await api.get('/stats', { params });
      return {
        success: true,
        data: response.data.data
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to get system stats',
        error: error.response?.data
      };
    }
  }
};

// Event Management APIs
export const eventAPI = {
  // Get all events with advanced filters
  getEvents: async (params = {}) => {
    try {
      const response = await api.get('/events', { params });
      return {
        success: true,
        data: response.data.data
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
        data: response.data.data,
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

  // Update event
  updateEvent: async (eventId, eventData) => {
    try {
      const response = await api.put(`/events/${eventId}`, eventData);
      return {
        success: true,
        data: response.data.data,
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

  approveEvent: async (eventId) => {
    const response = await api.post(`/events/${eventId}/approve`);
    return response.data;
  },

  rejectEvent: async (eventId, reason) => {
    const response = await api.post(`/events/${eventId}/reject`, { reason });
    return response.data;
  },

  // Bulk delete events
  bulkDeleteEvents: async (eventIds) => {
    try {
      const response = await api.delete('/events/bulk', { data: { eventIds } });
      return {
        success: true,
        message: response.data.message
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to bulk delete events',
        error: error.response?.data
      };
    }
  },

  // Archive event
  archiveEvent: async (eventId) => {
    try {
      const response = await api.put(`/events/${eventId}/archive`);
      return {
        success: true,
        data: response.data.data,
        message: response.data.message
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to archive event',
        error: error.response?.data
      };
    }
  }
};

// Member Management APIs
export const memberAPI = {
  // Get all members with advanced filters
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

  // Create new member
  createMember: async (memberData) => {
    try {
      const response = await api.post('/members', memberData);
      return {
        success: true,
        data: response.data.data,
        message: response.data.message
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to create member',
        error: error.response?.data
      };
    }
  },

  // Update member
  updateMember: async (memberId, memberData) => {
    try {
      const response = await api.put(`/members/${memberId}`, memberData);
      return {
        success: true,
        data: response.data.data,
        message: response.data.message
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to update member',
        error: error.response?.data
      };
    }
  },

  // Delete member
  deleteMember: async (memberId) => {
    try {
      const response = await api.delete(`/members/${memberId}`);
      return {
        success: true,
        message: response.data.message
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to delete member',
        error: error.response?.data
      };
    }
  },

  // Bulk import members
  bulkImportMembers: async (file) => {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await api.post('/members/bulk-import', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return {
        success: true,
        data: response.data.data,
        message: response.data.message
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to bulk import members',
        error: error.response?.data
      };
    }
  },

  // Export members
  exportMembers: async (params = {}) => {
    try {
      const response = await api.get('/members/export', { params });
      return {
        success: true,
        data: response.data.data
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to export members',
        error: error.response?.data
      };
    }
  },

  // Generate bulk QR codes
  generateBulkQRCodes: async (memberIds) => {
    try {
      const response = await api.post('/members/generate-bulk-qr', { memberIds });
      return {
        success: true,
        data: response.data.data,
        message: response.data.message
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to generate bulk QR codes',
        error: error.response?.data
      };
    }
  }
};

// Report Generation APIs
export const reportAPI = {
  // Generate comprehensive attendance report
  generateComprehensiveReport: async (params = {}) => {
    try {
      const response = await api.get('/reports/comprehensive', { params });
      return {
        success: true,
        data: response.data.data
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to generate comprehensive report',
        error: error.response?.data
      };
    }
  },

  // Generate member analytics report
  generateMemberAnalytics: async (params = {}) => {
    try {
      const response = await api.get('/reports/member-analytics', { params });
      return {
        success: true,
        data: response.data.data
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to generate member analytics',
        error: error.response?.data
      };
    }
  },

  // Generate event performance report
  generateEventPerformance: async (params = {}) => {
    try {
      const response = await api.get('/reports/event-performance', { params });
      return {
        success: true,
        data: response.data.data
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to generate event performance report',
        error: error.response?.data
      };
    }
  },

  // Export system data
  exportSystemData: async (params = {}) => {
    try {
      const response = await api.get('/reports/export-system', { params });
      return {
        success: true,
        data: response.data.data
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to export system data',
        error: error.response?.data
      };
    }
  }
};

// System Configuration APIs
export const configAPI = {
  // Get system configuration
  getSystemConfig: async () => {
    try {
      const response = await api.get('/config');
      return {
        success: true,
        data: response.data.data
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to get system config',
        error: error.response?.data
      };
    }
  },

  // Update system configuration
  updateSystemConfig: async (configData) => {
    try {
      const response = await api.put('/config', configData);
      return {
        success: true,
        data: response.data.data,
        message: response.data.message
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to update system config',
        error: error.response?.data
      };
    }
  },

  // Get audit logs
  getAuditLogs: async (params = {}) => {
    try {
      const response = await api.get('/audit-logs', { params });
      return {
        success: true,
        data: response.data.data
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to get audit logs',
        error: error.response?.data
      };
    }
  }
};

// Export all APIs
export const attendanceAdminAPI = {
  dashboard: dashboardAPI,
  events: eventAPI,
  members: memberAPI,
  reports: reportAPI,
  config: configAPI
};

export default attendanceAdminAPI;