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

// Function to get auth headers including token
const getAuthHeaders = () => {
  const headers = { "Content-Type": "application/json" };
  const token = localStorage.getItem('authToken');
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
  localStorage.removeItem('authToken');
  localStorage.removeItem('user');
};

// Export for use in other files
window.API_CONFIG = API_CONFIG;
window.buildApiUrl = buildApiUrl;
window.API = API;
window.getAuthHeaders = getAuthHeaders;
window.clearAuth = clearAuth;
