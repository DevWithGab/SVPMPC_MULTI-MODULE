import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001/api';

const api = axios.create({
  baseURL: `${API_BASE_URL}/mortuary/treasurer`,
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
// MORTUARY TREASURER API
// ============================================

// Dashboard APIs
export const dashboardAPI = {
  // Get treasurer dashboard data
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

  // Get fund balance summary
  getFundBalance: async () => {
    try {
      const response = await api.get('/fund-balance');
      return {
        success: true,
        data: response.data.data
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to get fund balance',
        error: error.response?.data
      };
    }
  }
};

// Contribution Management APIs
export const contributionAPI = {
  // Get all contributions with pagination and filters
  getContributions: async (params = {}) => {
    try {
      const response = await api.get('/contributions', { params });
      return {
        success: true,
        data: response.data.data
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to get contributions',
        error: error.response?.data
      };
    }
  },

  // Record new contribution
  recordContribution: async (contributionData) => {
    try {
      const response = await api.post('/contributions', contributionData);
      return {
        success: true,
        data: response.data.data,
        message: response.data.message
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to record contribution',
        error: error.response?.data
      };
    }
  },

  // Update contribution
  updateContribution: async (contributionId, contributionData) => {
    try {
      const response = await api.put(`/contributions/${contributionId}`, contributionData);
      return {
        success: true,
        data: response.data.data,
        message: response.data.message
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to update contribution',
        error: error.response?.data
      };
    }
  },

  // Delete contribution
  deleteContribution: async (contributionId) => {
    try {
      const response = await api.delete(`/contributions/${contributionId}`);
      return {
        success: true,
        message: response.data.message
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to delete contribution',
        error: error.response?.data
      };
    }
  },

  // Get contribution statistics
  getContributionStats: async () => {
    try {
      const response = await api.get('/contributions/stats');
      return {
        success: true,
        data: response.data.data
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to get contribution stats',
        error: error.response?.data
      };
    }
  }
};

// Claim Processing APIs
export const claimAPI = {
  // Get all claims with pagination and filters
  getClaims: async (params = {}) => {
    try {
      const response = await api.get('/claims', { params });
      return {
        success: true,
        data: response.data.data
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to get claims',
        error: error.response?.data
      };
    }
  },

  // Process claim (approve/reject)
  processClaim: async (claimId, processData) => {
    try {
      const response = await api.put(`/claims/${claimId}/process`, processData);
      return {
        success: true,
        data: response.data.data,
        message: response.data.message
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to process claim',
        error: error.response?.data
      };
    }
  },

  // Get claim details
  getClaimDetails: async (claimId) => {
    try {
      const response = await api.get(`/claims/${claimId}`);
      return {
        success: true,
        data: response.data.data
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to get claim details',
        error: error.response?.data
      };
    }
  },

  // Update processing notes
  updateProcessingNotes: async (claimId, notes) => {
    try {
      const response = await api.put(`/claims/${claimId}/notes`, { processingNotes: notes });
      return {
        success: true,
        data: response.data.data,
        message: response.data.message
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to update processing notes',
        error: error.response?.data
      };
    }
  },

  // Get claim statistics
  getClaimStats: async () => {
    try {
      const response = await api.get('/claims/stats');
      return {
        success: true,
        data: response.data.data
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to get claim stats',
        error: error.response?.data
      };
    }
  }
};

// SMS Notification APIs
export const notificationAPI = {
  // Send SMS notification
  sendSMSNotification: async (notificationData) => {
    try {
      const response = await api.post('/notifications/sms', notificationData);
      return {
        success: true,
        data: response.data.data,
        message: response.data.message
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to send SMS notification',
        error: error.response?.data
      };
    }
  },

  // Get notification history
  getNotificationHistory: async (params = {}) => {
    try {
      const response = await api.get('/notifications/history', { params });
      return {
        success: true,
        data: response.data.data
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to get notification history',
        error: error.response?.data
      };
    }
  },

  // Get available recipients
  getAvailableRecipients: async () => {
    try {
      const response = await api.get('/notifications/recipients');
      return {
        success: true,
        data: response.data.data
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to get available recipients',
        error: error.response?.data
      };
    }
  },

  // Send contribution reminder
  sendContributionReminder: async (customMessage) => {
    try {
      const response = await api.post('/notifications/contribution-reminder', { customMessage });
      return {
        success: true,
        data: response.data.data,
        message: response.data.message
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to send contribution reminder',
        error: error.response?.data
      };
    }
  }
};

// Report Generation APIs
export const reportAPI = {
  // Generate financial summary report
  generateFinancialSummary: async (params = {}) => {
    try {
      const response = await api.get('/reports/financial-summary', { params });
      return {
        success: true,
        data: response.data.data
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to generate financial summary',
        error: error.response?.data
      };
    }
  },

  // Generate contribution report
  generateContributionReport: async (params = {}) => {
    try {
      const response = await api.get('/reports/contributions', { params });
      return {
        success: true,
        data: response.data.data
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to generate contribution report',
        error: error.response?.data
      };
    }
  },

  // Generate claim report
  generateClaimReport: async (params = {}) => {
    try {
      const response = await api.get('/reports/claims', { params });
      return {
        success: true,
        data: response.data.data
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to generate claim report',
        error: error.response?.data
      };
    }
  },

  // Generate member balance report
  generateMemberBalanceReport: async () => {
    try {
      const response = await api.get('/reports/member-balances');
      return {
        success: true,
        data: response.data.data
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to generate member balance report',
        error: error.response?.data
      };
    }
  },

  // Export report data
  exportReportData: async (params = {}) => {
    try {
      const response = await api.get('/reports/export', { params });
      return {
        success: true,
        data: response.data.data
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to export report data',
        error: error.response?.data
      };
    }
  }
};

// Export all APIs
export const mortuaryTreasurerAPI = {
  dashboard: dashboardAPI,
  contributions: contributionAPI,
  claims: claimAPI,
  notifications: notificationAPI,
  reports: reportAPI
};

export default mortuaryTreasurerAPI;