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

// Response interceptor for handling auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/';
    }
    return Promise.reject(error);
  }
);

// ============================================
// AUTHENTICATION API
// ============================================
export const authAPI = {
  // Login user
  login: async (username, password) => {
    try {
      const response = await api.post('/auth/login', { username, password });
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Login failed',
        error: error.response?.data
      };
    }
  },

  // Register new user
  register: async (userData) => {
    try {
      const response = await api.post('/auth/register', userData);
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Registration failed',
        error: error.response?.data
      };
    }
  },

  // Change password
  changePassword: async (userId, oldPassword, newPassword) => {
    try {
      const response = await api.put(`/auth/change-password/${userId}`, {
        oldPassword,
        newPassword,
      });
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Password change failed',
        error: error.response?.data
      };
    }
  },

  // Get user profile
  getProfile: async (userId) => {
    try {
      const response = await api.get(`/auth/profile/${userId}`);
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to get profile',
        error: error.response?.data
      };
    }
  },

  // Verify token
  verifyToken: async () => {
    try {
      const response = await api.get('/auth/verify-token');
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Token verification failed',
        error: error.response?.data
      };
    }
  },

  // Get credential history
  getCredentialHistory: async (userId) => {
    try {
      const response = await api.get(`/auth/credential-history/${userId}`);
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to get credential history',
        error: error.response?.data
      };
    }
  },

  // Logout
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    return { success: true };
  }
};

// ============================================
// BULK IMPORT API
// ============================================
export const bulkImportAPI = {
  // Upload CSV file
  uploadCSV: async (file) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('createdBy', 'admin');

      const response = await api.post('/auth/bulk-import/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'CSV upload failed',
        error: error.response?.data
      };
    }
  },

  // Confirm import operation
  confirmImport: async (operationId, sendVia = ['email', 'sms']) => {
    try {
      const response = await api.post('/auth/bulk-import/confirm', {
        operationId,
        sendVia,
      });
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Import confirmation failed',
        error: error.response?.data
      };
    }
  },

  // Get import status
  getImportStatus: async (operationId) => {
    try {
      const response = await api.get(`/auth/bulk-import/status/${operationId}`);
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to get import status',
        error: error.response?.data
      };
    }
  },

  // Get import details
  getImportDetails: async (operationId) => {
    try {
      const response = await api.get(`/auth/bulk-import/details/${operationId}`);
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to get import details',
        error: error.response?.data
      };
    }
  },

  // Get all operations
  getAllOperations: async () => {
    try {
      const response = await api.get('/auth/bulk-import/operations');
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to get operations',
        error: error.response?.data
      };
    }
  },
};

export default api;