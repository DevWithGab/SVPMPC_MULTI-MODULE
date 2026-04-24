import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001/api';

const api = axios.create({
  baseURL: `${API_BASE_URL}/mortuary/admin`,
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
// MORTUARY ADMIN API
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

  // Get fund overview
  getFundOverview: async () => {
    try {
      const response = await api.get('/fund-overview');
      return {
        success: true,
        data: response.data.data
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to get fund overview',
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

  // Suspend member
  suspendMember: async (memberId, suspensionData) => {
    try {
      const response = await api.put(`/members/${memberId}/suspend`, suspensionData);
      return {
        success: true,
        data: response.data.data,
        message: response.data.message
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to suspend member',
        error: error.response?.data
      };
    }
  },

  // Reactivate member
  reactivateMember: async (memberId) => {
    try {
      const response = await api.put(`/members/${memberId}/reactivate`);
      return {
        success: true,
        data: response.data.data,
        message: response.data.message
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to reactivate member',
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
  }
};

// Claim Processing APIs
export const claimAPI = {
  // Get all claims with advanced filters
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

  // Process claim (final approval/rejection)
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

  // Override claim decision
  overrideClaim: async (claimId, overrideData) => {
    try {
      const response = await api.put(`/claims/${claimId}/override`, overrideData);
      return {
        success: true,
        data: response.data.data,
        message: response.data.message
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to override claim',
        error: error.response?.data
      };
    }
  },

  // Get claim audit trail
  getClaimAuditTrail: async (claimId) => {
    try {
      const response = await api.get(`/claims/${claimId}/audit-trail`);
      return {
        success: true,
        data: response.data.data
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to get claim audit trail',
        error: error.response?.data
      };
    }
  },

  // Get claim statistics
  getClaimStatistics: async (params = {}) => {
    try {
      const response = await api.get('/claims/statistics', { params });
      return {
        success: true,
        data: response.data.data
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to get claim statistics',
        error: error.response?.data
      };
    }
  }
};

// Fund Management APIs
export const fundAPI = {
  // Get fund balance details
  getFundBalance: async () => {
    try {
      const response = await api.get('/fund/balance');
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
  },

  // Adjust fund balance
  adjustFundBalance: async (adjustmentData) => {
    try {
      const response = await api.post('/fund/adjust', adjustmentData);
      return {
        success: true,
        data: response.data.data,
        message: response.data.message
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to adjust fund balance',
        error: error.response?.data
      };
    }
  },

  // Get fund transactions
  getFundTransactions: async (params = {}) => {
    try {
      const response = await api.get('/fund/transactions', { params });
      return {
        success: true,
        data: response.data.data
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to get fund transactions',
        error: error.response?.data
      };
    }
  },

  // Generate fund reconciliation report
  generateReconciliationReport: async (params = {}) => {
    try {
      const response = await api.get('/fund/reconciliation', { params });
      return {
        success: true,
        data: response.data.data
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to generate reconciliation report',
        error: error.response?.data
      };
    }
  }
};

// Report Generation APIs
export const reportAPI = {
  // Generate comprehensive financial report
  generateFinancialReport: async (params = {}) => {
    try {
      const response = await api.get('/reports/financial', { params });
      return {
        success: true,
        data: response.data.data
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to generate financial report',
        error: error.response?.data
      };
    }
  },

  // Generate member activity report
  generateMemberActivityReport: async (params = {}) => {
    try {
      const response = await api.get('/reports/member-activity', { params });
      return {
        success: true,
        data: response.data.data
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to generate member activity report',
        error: error.response?.data
      };
    }
  },

  // Generate claim analysis report
  generateClaimAnalysisReport: async (params = {}) => {
    try {
      const response = await api.get('/reports/claim-analysis', { params });
      return {
        success: true,
        data: response.data.data
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to generate claim analysis report',
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
  },

  // Backup system data
  backupSystemData: async () => {
    try {
      const response = await api.post('/backup');
      return {
        success: true,
        data: response.data.data,
        message: response.data.message
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to backup system data',
        error: error.response?.data
      };
    }
  },

  // Restore system data
  restoreSystemData: async (backupFile) => {
    try {
      const formData = new FormData();
      formData.append('backup', backupFile);

      const response = await api.post('/restore', formData, {
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
        message: error.response?.data?.message || 'Failed to restore system data',
        error: error.response?.data
      };
    }
  }
};

// Export all APIs
export const mortuaryAdminAPI = {
  dashboard: dashboardAPI,
  members: memberAPI,
  claims: claimAPI,
  fund: fundAPI,
  reports: reportAPI,
  config: configAPI
};

export default mortuaryAdminAPI;