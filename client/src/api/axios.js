import axios from 'axios';

// ponytail: always use relative '/api' unless an external production URL is given
const envUrl = import.meta.env.VITE_API_URL;
const baseURL = (envUrl && !envUrl.includes('localhost')) ? envUrl : '/api';

const API = axios.create({
  baseURL,
  withCredentials: true,
});

API.interceptors.request.use(config => {
  const token = localStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  config.headers['ngrok-skip-browser-warning'] = 'true';
  return config;
});

API.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401 && !error.config?.url?.includes('/login')) {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('role');
    }
    return Promise.reject(error);
  }
);

export default API;