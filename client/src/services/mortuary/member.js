import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001/api';

const api = axios.create({
  baseURL: `${API_BASE_URL}/mortuary/member`,
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
// MORTUARY MEMBER API
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

// Contribution APIs
export const contributionAPI = {
  // Get member contributions with pagination
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

  // Get contribution details
  getContributionDetails: async (contributionId) => {
    try {
      const response = await api.get(`/contributions/${contributionId}`);
      return {
        success: true,
        data: response.data.data
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to get contribution details',
        error: error.response?.data
      };
    }
  }
};

// Claim APIs
export const claimAPI = {
  // Get member claims
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

  // Submit new claim
  submitClaim: async (claimData) => {
    try {
      const response = await api.post('/claims', claimData);
      return {
        success: true,
        data: response.data.data,
        message: response.data.message
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to submit claim',
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

  // Update claim (only if pending)
  updateClaim: async (claimId, claimData) => {
    try {
      const response = await api.put(`/claims/${claimId}`, claimData);
      return {
        success: true,
        data: response.data.data,
        message: response.data.message
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to update claim',
        error: error.response?.data
      };
    }
  }
};

// Export all APIs
export const mortuaryMemberAPI = {
  dashboard: dashboardAPI,
  contributions: contributionAPI,
  claims: claimAPI
};

export default mortuaryMemberAPI;