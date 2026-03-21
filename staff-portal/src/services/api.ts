import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('staff_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  // Add this to bypass ngrok browser warning page
  config.headers['ngrok-skip-browser-warning'] = 'true';
  return config;
});

export default api;
