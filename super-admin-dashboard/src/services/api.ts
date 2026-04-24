import axios, { type InternalAxiosRequestConfig } from 'axios';

export interface PaymentRequiredDetail {
  message?: string;
  subscription_status?: string;
  checkout_url?: string;
  razorpay_subscription_id?: string;
  razorpay_key_id?: string;
}

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = localStorage.getItem('super_admin_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      localStorage.removeItem('super_admin_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
