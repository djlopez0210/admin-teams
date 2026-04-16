import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5001/api',
});

export const playerService = {
  checkDocument: (document_number) => api.post('/players/check-document', { document_number }),
  register: (playerData) => api.post('/players', playerData),
  getAll: () => api.get('/players'),
  getById: (id) => api.get(`/players/${id}`),
  delete: (id) => api.delete(`/players/${id}`),
  getHistory: (id) => api.get(`/players/${id}/history`),
  updatePayment: (id, data) => api.patch(`/players/${id}/payment`, data),
};

export const positionService = {
  getAll: () => api.get('/positions'),
  create: (name) => api.post('/positions', { name }),
  update: (id, name) => api.put(`/positions/${id}`, { name }),
  delete: (id) => api.delete(`/positions/${id}`),
};

export const uniformService = {
  getAvailable: () => api.get('/uniform-numbers/available'),
  getAll: () => api.get('/uniform-numbers'),
};

export const adminService = {
  getStats: () => api.get('/stats'),
  getLogs: () => api.get('/logs'),
  login: (credentials) => api.post('/login', credentials),
};

export const settingsService = {
  get: () => api.get('/settings'),
  update: (data) => api.put('/settings', data),
  uploadLogo: (file) => {
    const formData = new FormData();
    formData.append('logo', file);
    return api.post('/upload-logo', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  }
};

// Fixed logs endpoint inconsistency in my app.py (it was /api/logs)
// I will re-check my app.py later to ensure logs is under /api
export default api;
