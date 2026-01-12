import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:8000/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add logging interceptor for debugging
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token');
    console.log(`Making request to ${config.url}`);
    if (token) {
      config.headers.Authorization = `Token ${token}`;
    }
  }
  return config;
});

export default api;
