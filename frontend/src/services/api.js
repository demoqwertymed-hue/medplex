// src/services/api.js
// Axios setup for API calls with JWT and base URL from window.REACT_APP_API_URL
/* global window */
export const API_BASE_URL = window.REACT_APP_API_URL || 'http://localhost:8000';

export function createApiInstance(axios) {
  const api = axios.create({
    baseURL: API_BASE_URL,
    headers: { 'Content-Type': 'application/json' }
  });
  api.interceptors.request.use((config) => {
    try {
      const token = localStorage.getItem('token');
      if (token) config.headers.Authorization = `Bearer ${token}`;
    } catch {}
    return config;
  });
  api.interceptors.response.use(
    (r) => r,
    (error) => {
      const status = error?.response?.status;
      if (status === 401) {
        try { localStorage.removeItem('token'); localStorage.removeItem('user'); } catch {}
        if (window?.toast) window.toast.error?.('Session expired. Please login again.');
        window.location.hash = '#/login';
      } else if (status === 403) {
        if (window?.toast) window.toast.error?.('You do not have permission to perform this action.');
      }
      return Promise.reject(error);
    }
  );
  return api;
}

export default createApiInstance;
