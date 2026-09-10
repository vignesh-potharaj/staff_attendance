import axios from 'axios';

export const getBaseUrl = (): string => {
  if (typeof window !== 'undefined') {
    const custom = localStorage.getItem('custom_api_url');
    if (custom && custom.trim()) return custom.trim();
  }
  return import.meta.env.VITE_API_URL || 'https://ncc-app-j78p.onrender.com';
};

const api = axios.create({
  baseURL: getBaseUrl(),
});

api.interceptors.request.use((config) => {
  config.baseURL = getBaseUrl();
  const token = localStorage.getItem('staff_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  // Add this to bypass ngrok browser warning page
  config.headers['ngrok-skip-browser-warning'] = 'true';
  return config;
});

export const getApiErrorMessage = (err: unknown, fallback: string): string => {
  if (
    typeof err === 'object' &&
    err !== null &&
    'response' in err
  ) {
    const response = (err as { response?: { data?: { detail?: unknown } } }).response;
    const detail = response?.data?.detail;
    if (typeof detail === 'string') return detail;
    if (typeof detail === 'object' && detail !== null) {
      const message = (detail as { message?: unknown }).message;
      if (typeof message === 'string') return message;
    }
  }
  if (err instanceof Error && typeof err.message === 'string') {
    return err.message;
  }
  return fallback;
};

export default api;
