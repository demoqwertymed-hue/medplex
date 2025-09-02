/* src/index.js */
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.js';

// Lightweight backend provider here mirrors the app.js approach but expects globals
function createBackend(){
  const axios = window.axios;
  const API_BASE_URL = window.REACT_APP_API_URL || 'http://localhost:8000';
  const api = axios.create({ baseURL: API_BASE_URL, headers: { 'Content-Type': 'application/json' } });
  api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  });
  return {
    health: () => api.get('/health'),
    register: (payload, isManu=false) => api.post(isManu ? '/register/manufacturer' : '/register', payload),
    login: (formData, isManu=false) => axios.post(`${API_BASE_URL}${isManu ? '/login/manufacturer' : '/login'}`, formData, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }),
    devices: () => api.get('/devices'),
    deviceById: (id) => api.get(`/devices/${encodeURIComponent(id)}`),
    predict: (payload) => api.post('/predict', payload),
    feedback: (device_id, payload) => api.post(`/feedback/${encodeURIComponent(device_id)}`, payload),
    modelInfo: () => api.get('/model_info')
  };
}

function bootstrap(){
  const backend = createBackend();
  const root = createRoot(document.getElementById('root'));
  root.render(<App backend={backend} />);
}

bootstrap();
