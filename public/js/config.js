// API Configuration
const API_CONFIG = {
  // Backend API base URL - Update these URLs to point to your backend
  BASE_URL:
    window.location.hostname === "localhost"
      ? "http://localhost:3001" // Local development - start your rental-management-backend here
      : "https://rental-management-backend-mocha.vercel.app", // Production backend URL - Vercel deployment

  // API endpoints
  ENDPOINTS: {
    // Authentication
    LOGIN: "/api/auth/login",
    LOGOUT: "/api/auth/logout",
    STATUS: "/api/auth/status",
    ME: "/api/auth/me",

    // Properties
    PROPERTIES: "/api/properties",
    PROPERTY_BY_ID: (id) => `/api/properties/${id}`,
    PROPERTY_TENANTS: (id) => `/api/properties/${id}/tenants`,
    PROPERTY_STATS: "/api/properties/stats/summary",

    // Tenants
    TENANTS: "/api/tenants",
    TENANT_BY_ID: (id) => `/api/tenants/${id}`,
    TENANT_BY_FIN: (fin) => `/api/tenants/fin/${fin}`,
    TENANT_STATS: "/api/tenants/stats/summary",
    TENANT_ADD_PROPERTY: (id) => `/api/tenants/${id}/properties`,
    TENANT_REMOVE_PROPERTY: (id, propertyId) =>
      `/api/tenants/${id}/properties/${propertyId}`,

    // File Upload
    UPLOAD: "/api/upload",
    UPLOAD_MULTIPLE: "/api/upload/multiple",

    // Analytics
    DASHBOARD_ANALYTICS: "/api/analysis/dashboard",
    PROPERTY_PERFORMANCE: "/api/analysis/property-performance",
    TENANT_INSIGHTS: "/api/analysis/tenant-insights",

    // Investors
    INVESTORS: "/api/investors",
    INVESTOR_BY_ID: (id) => `/api/investors/${id}`,
    INVESTORS_BY_PROPERTY: (propertyId) => `/api/investors/property/${propertyId}`,
    INVESTOR_ADD_PROPERTY: (investorId) => `/api/investors/${investorId}/properties`,
    INVESTOR_REMOVE_PROPERTY: (investorId, propertyId) => `/api/investors/${investorId}/properties/${propertyId}`,

    // Financial Reports
    FINANCIAL_REPORTS_BY_PROPERTY: (propertyId) => `/api/financial-reports/property/${propertyId}`,
    FINANCIAL_REPORT: (propertyId, year, month) => `/api/financial-reports/property/${propertyId}/${year}/${month}`,
    FINANCIAL_REPORT_INCOME: (propertyId, year, month) => `/api/financial-reports/property/${propertyId}/${year}/${month}/income`,
    FINANCIAL_REPORT_EXPENSES: (propertyId, year, month) => `/api/financial-reports/property/${propertyId}/${year}/${month}/expenses`,

    // Health Check
    HEALTH: "/health",
  },
};

// Helper function to build full API URL
const buildApiUrl = (endpoint) => {
  return `${API_CONFIG.BASE_URL}${endpoint}`;
};

// Default fetch options with credentials for cookies and auth token
const defaultFetchOptions = {
  credentials: "include",
  headers: {
    "Content-Type": "application/json",
  },
};

// Function to get auth token from storage (checks both localStorage and sessionStorage)
const getAuthToken = () => {
  // First check localStorage (persistent storage)
  let token = localStorage.getItem('authToken');
  
  // Check if localStorage token is expired
  if (token) {
    const expiration = localStorage.getItem('authExpiration');
    if (expiration && Date.now() > parseInt(expiration)) {
      // Token expired, clear it
      clearAuth();
      token = null;
    }
  }
  
  // If no persistent token, check sessionStorage (temporary storage)
  if (!token) {
    token = sessionStorage.getItem('authToken');
  }
  
  return token;
};

// Function to get auth headers including token
const getAuthHeaders = () => {
  const headers = { "Content-Type": "application/json" };
  const token = getAuthToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

// API helper functions
const API = {
  get: async (endpoint, options = {}) => {
    const response = await fetch(buildApiUrl(endpoint), {
      method: "GET",
      credentials: "include",
      headers: { ...getAuthHeaders(), ...(options.headers || {}) },
      ...options,
    });
    return response;
  },

  post: async (endpoint, data = null, options = {}) => {
    const response = await fetch(buildApiUrl(endpoint), {
      method: "POST",
      credentials: "include",
      headers: { ...getAuthHeaders(), ...(options.headers || {}) },
      body: data ? JSON.stringify(data) : null,
      ...options,
    });
    return response;
  },

  put: async (endpoint, data = null, options = {}) => {
    const response = await fetch(buildApiUrl(endpoint), {
      method: "PUT",
      credentials: "include",
      headers: { ...getAuthHeaders(), ...(options.headers || {}) },
      body: data ? JSON.stringify(data) : null,
      ...options,
    });
    return response;
  },

  delete: async (endpoint, options = {}) => {
    const response = await fetch(buildApiUrl(endpoint), {
      method: "DELETE",
      credentials: "include",
      headers: { ...getAuthHeaders(), ...(options.headers || {}) },
      ...options,
    });
    return response;
  },
};

// Helper function to clear authentication
const clearAuth = () => {
  // Clear localStorage
  localStorage.removeItem('authToken');
  localStorage.removeItem('user');
  localStorage.removeItem('rememberMe');
  localStorage.removeItem('loginTime');
  localStorage.removeItem('authExpiration');
  
  // Clear sessionStorage
  sessionStorage.removeItem('authToken');
  sessionStorage.removeItem('user');
  sessionStorage.removeItem('rememberMe');
};

// Export for use in other files
window.API_CONFIG = API_CONFIG;
window.buildApiUrl = buildApiUrl;
window.API = API;
window.getAuthToken = getAuthToken;
window.getAuthHeaders = getAuthHeaders;
window.clearAuth = clearAuth;
