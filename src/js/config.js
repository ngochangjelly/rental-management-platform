// API Configuration
const API_CONFIG = {
  // Backend API base URL - Update these URLs to point to your backend
  BASE_URL:
    window.location.hostname === "localhost"
      ? "" // Local development - use webpack dev server proxy
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
    UPLOAD_TENANT_DOCUMENT: "/api/upload/tenant-document",

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
    FINANCIAL_REPORT_CLOSE: (propertyId, year, month) => `/api/financial-reports/property/${propertyId}/${year}/${month}/close`,
    FINANCIAL_REPORT_REOPEN: (propertyId, year, month) => `/api/financial-reports/property/${propertyId}/${year}/${month}/reopen`,

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
  console.log('Checking auth token - localStorage:', token ? 'Found' : 'Not found');

  // Check if localStorage token is expired (only if expiration is set)
  if (token) {
    const expiration = localStorage.getItem('authExpiration');
    // Only check expiration if it was explicitly set
    if (expiration && expiration !== 'null' && expiration !== 'undefined') {
      const expirationTime = parseInt(expiration);
      if (!isNaN(expirationTime) && Date.now() > expirationTime) {
        // Token expired, clear it
        console.log('Token expired, clearing auth');
        clearAuth();
        token = null;
      } else {
        const daysRemaining = Math.ceil((expirationTime - Date.now()) / (24 * 60 * 60 * 1000));
        console.log(`Token valid for ${daysRemaining} more days`);
      }
    }
  }

  // If no persistent token, check sessionStorage (temporary storage)
  if (!token) {
    token = sessionStorage.getItem('authToken');
    console.log('Checking sessionStorage:', token ? 'Found' : 'Not found');
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

// Helper function to handle auth failures
const handleAuthResponse = async (response) => {
  if (response.status === 401) {
    // Check if response has JSON content indicating auth failure
    try {
      const data = await response.clone().json();
      if (data.authenticated === false || data.error === 'Invalid token') {
        console.log('Authentication failed - clearing auth and redirecting to login');
        clearAuth();
        // Only redirect if we're not already on login page
        if (!window.location.pathname.includes('login')) {
          window.location.href = '/login.html';
          return response;
        }
      }
    } catch (e) {
      // Response might not be JSON, still handle 401
      console.log('401 response without JSON - clearing auth');
      clearAuth();
      if (!window.location.pathname.includes('login')) {
        window.location.href = '/login.html';
        return response;
      }
    }
  }
  return response;
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
    return handleAuthResponse(response);
  },

  post: async (endpoint, data = null, options = {}) => {
    const response = await fetch(buildApiUrl(endpoint), {
      method: "POST",
      credentials: "include",
      headers: { ...getAuthHeaders(), ...(options.headers || {}) },
      body: data ? JSON.stringify(data) : null,
      ...options,
    });
    return handleAuthResponse(response);
  },

  put: async (endpoint, data = null, options = {}) => {
    const response = await fetch(buildApiUrl(endpoint), {
      method: "PUT",
      credentials: "include",
      headers: { ...getAuthHeaders(), ...(options.headers || {}) },
      body: data ? JSON.stringify(data) : null,
      ...options,
    });
    return handleAuthResponse(response);
  },

  delete: async (endpoint, options = {}) => {
    const response = await fetch(buildApiUrl(endpoint), {
      method: "DELETE",
      credentials: "include",
      headers: { ...getAuthHeaders(), ...(options.headers || {}) },
      ...options,
    });
    return handleAuthResponse(response);
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

// Image utility functions
const ImageUtils = {
  // Normalize image URL to ensure it uses the proxy endpoint
  normalizeImageUrl(url) {
    if (!url) return url;

    // If it's already a full URL (http/https), return as-is
    if (url.startsWith("http://") || url.startsWith("https://")) {
      return url;
    }

    // If it's already a proxy URL, convert to full URL if needed
    if (url.startsWith("/api/upload/image-proxy/")) {
      // In production (not localhost), use the full backend URL
      if (window.location.hostname !== "localhost") {
        const backendUrl = "https://rental-management-backend-mocha.vercel.app";
        return `${backendUrl}${url}`;
      }
      return url; // localhost case
    }

    // Build the proxy URL
    let proxyPath;

    // If it looks like just a Cloudinary filename (e.g., "wdhtnp08ugp4nhshmkpf.jpg")
    // or a path without version (e.g., "tenant-documents/wdhtnp08ugp4nhshmkpf.jpg")
    if (url.match(/^[a-zA-Z0-9\-_\/]+\.(jpg|jpeg|png)$/i)) {
      // Check if it already includes the folder path
      if (url.includes("/")) {
        proxyPath = `/api/upload/image-proxy/${url}`;
      } else {
        // Assume it's a tenant document image
        proxyPath = `/api/upload/image-proxy/tenant-documents/${url}`;
      }
    } else if (url.startsWith("/")) {
      // If it starts with / but not our proxy path, assume it's a relative proxy URL
      proxyPath = url;
    } else {
      // Default: assume it needs the proxy prefix
      proxyPath = `/api/upload/image-proxy/${url}`;
    }

    // In production (not localhost), use the full backend URL
    if (window.location.hostname !== "localhost") {
      const backendUrl = "https://rental-management-backend-mocha.vercel.app";
      return `${backendUrl}${proxyPath}`;
    }
    return proxyPath; // localhost case
  },

  // Get optimized image URL with size transformations
  getOptimizedImageUrl(url, size = "small") {
    if (!url) return url;

    const baseUrl = this.normalizeImageUrl(url);

    // If it's not a Cloudinary URL through our proxy, return as-is
    if (!baseUrl.includes("/api/upload/image-proxy/")) {
      return baseUrl;
    }

    // Define size presets
    const sizePresets = {
      small: "w_80,h_80,c_fill,f_auto,q_auto", // 40px display size, 2x for retina
      medium: "w_160,h_160,c_fill,f_auto,q_auto", // 80px display size, 2x for retina
      large: "w_200,h_200,c_fill,f_auto,q_auto", // Larger preview size
    };

    const transformation = sizePresets[size] || sizePresets.small;

    // Add transformation to Cloudinary URL
    // Replace /image-proxy/ with /image-proxy/w_80,h_80,c_fill,f_auto,q_auto/
    const optimizedUrl = baseUrl.replace(
      "/api/upload/image-proxy/",
      `/api/upload/image-proxy/${transformation}/`
    );

    return optimizedUrl;
  }
};

// Export for use in other files
window.API_CONFIG = API_CONFIG;
window.buildApiUrl = buildApiUrl;
window.API = API;
window.getAuthToken = getAuthToken;
window.getAuthHeaders = getAuthHeaders;
window.clearAuth = clearAuth;
window.ImageUtils = ImageUtils;
