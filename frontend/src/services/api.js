import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

const api = axios.create({
    baseURL: API_URL
});

// Interceptor to add Team ID to headers if available (for admin calls)
api.interceptors.request.use(config => {
    const teamId = localStorage.getItem('adminTeamId');
    if (teamId) {
        config.headers['X-Team-ID'] = teamId;
    }
    return config;
});

export const playerService = {
    checkDocument: (teamSlug, docNumber) => api.post(`/${teamSlug}/players/check-document`, { document_number: docNumber }),
    register: (teamSlug, playerData) => api.post(`/${teamSlug}/players`, playerData),
    getAll: () => api.get('/players'),
    delete: (id) => api.delete(`/players/${id}`),
    getHistory: (id) => api.get(`/players/${id}/history`),
    updatePayment: (id, data) => api.patch(`/players/${id}/payment`, data),
    getEps: (teamSlug) => api.get(`/${teamSlug}/eps`),
};

export const positionService = {
    getAllByTeam: (teamSlug) => api.get(`/${teamSlug}/positions`),
    getAll: () => api.get('/positions'),
    create: (data) => api.post('/positions', data),
    update: (id, data) => api.put(`/positions/${id}`, data),
    delete: (id) => api.delete(`/positions/${id}`),
};

export const uniformService = {
    getAvailable: (teamSlug) => api.get(`/${teamSlug}/uniform-numbers/available`),
    getAll: () => api.get('/uniform-numbers'),
};

export const adminService = {
    getStats: () => api.get('/stats'),
    getLogs: () => api.get('/logs'),
    login: (credentials) => api.post('/login', credentials),
    getTeams: () => api.get('/teams'),
    createTeam: (data) => api.post('/teams', data),
};

export const settingsService = {
    getPublic: (teamSlug) => api.get(`/${teamSlug}/settings`),
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

export const costService = {
    getPublic: (teamSlug) => api.get(`/${teamSlug}/costs`),
    getAll: () => api.get('/costs'),
    create: (data) => api.post('/costs', data),
    update: (id, data) => api.put(`/costs/${id}`, data),
    delete: (id) => api.delete(`/costs/${id}`),
};

export default api;
