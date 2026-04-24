import axios, { type InternalAxiosRequestConfig } from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
});

const redirectToBillingOrCheckout = (error: unknown) => {
  const response = (error as { response?: { data?: { detail?: unknown } } }).response;
  const detail = response?.data?.detail;
  if (typeof detail === 'object' && detail !== null) {
    const checkoutUrl = (detail as { checkout_url?: unknown }).checkout_url;
    if (typeof checkoutUrl === 'string' && checkoutUrl) {
      window.location.href = checkoutUrl;
      return;
    }
  }
  if (window.location.pathname !== '/billing') {
    window.location.href = '/billing';
  }
};

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  // Add this to bypass ngrok browser warning page
  config.headers['ngrok-skip-browser-warning'] = 'true';
  return config;
});

api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      // Token expired or invalid - clear storage
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    } else if (error.response?.status === 402) {
      redirectToBillingOrCheckout(error);
    }
    return Promise.reject(error);
  }
);

export default api;
