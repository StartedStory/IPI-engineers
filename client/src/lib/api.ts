import axios from 'axios';

// In dev, leave VITE_API_URL unset and Vite proxies "/api" → localhost:4000.
// In production (split hosting), set VITE_API_URL to the backend origin,
// e.g. https://ipi-api.onrender.com — requests then go to that origin's /api.
const apiBase = import.meta.env.VITE_API_URL
  ? `${String(import.meta.env.VITE_API_URL).replace(/\/$/, '')}/api`
  : '/api';

export const api = axios.create({
  baseURL: apiBase,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('ipi_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err?.response?.status === 401) {
      localStorage.removeItem('ipi_token');
      localStorage.removeItem('ipi_user');
      window.dispatchEvent(new Event('ipi:logout'));
      if (!window.location.pathname.startsWith('/login')) {
        window.location.replace('/login');
      }
    }
    return Promise.reject(err);
  }
);
