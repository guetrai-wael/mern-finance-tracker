// API configuration and axios instance with secure cookie-based auth
import axios from "axios";
import API_BASE_URL from "../config";

const safeBaseUrl = API_BASE_URL || "http://localhost:4000";
const API_URL = safeBaseUrl.endsWith('/api/v1') 
  ? safeBaseUrl 
  : `${safeBaseUrl}/api/v1`;

// Create axios instance with credentials for cookies
export const api = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true, // Enable cookies
  timeout: 10000, // 10 second timeout
});

// Auth status management (no token storage needed with httpOnly cookies)
export const authStorage = {
  // Check if user is authenticated by attempting a protected route
  checkAuth: async (): Promise<boolean> => {
    try {
      await api.get("/auth/me");
      return true;
    } catch {
      return false;
    }
  },
  // Clear auth state (cookies are cleared by server)
  clearAuth: async (): Promise<void> => {
    try {
      await api.post("/auth/logout");
    } catch (error) {
      console.warn("Logout request failed:", error);
    }
  },
};

// Flag to prevent multiple refresh attempts
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

const processQueue = (error: Error | null) => {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error);
    } else {
      resolve();
    }
  });

  failedQueue = [];
};

// Response interceptor for automatic token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Don't retry refresh requests or if already retried
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url?.includes("/auth/refresh")
    ) {
      if (isRefreshing) {
        // If already refreshing, queue this request
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(() => {
            return api(originalRequest);
          })
          .catch((err) => {
            return Promise.reject(err);
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Attempt to refresh token (cookies are sent automatically)
        await api.post("/auth/refresh");

        isRefreshing = false;
        processQueue(null);

        // Retry original request with refreshed token
        return api(originalRequest);
      } catch (refreshError) {
        // Refresh failed, clear auth state and redirect
        isRefreshing = false;
        processQueue(
          refreshError instanceof Error
            ? refreshError
            : new Error("Token refresh failed")
        );

        // Clear any auth cookies/state
        document.cookie =
          "accessToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
        document.cookie =
          "refreshToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";

        // Only redirect if not already on login page
        if (!window.location.pathname.includes("/login")) {
          window.location.href = "/login";
        }

        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
