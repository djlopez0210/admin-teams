import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

export const api = axios.create({
    baseURL: API_URL
});

// Interceptor to add Team ID or Tournament ID to headers
api.interceptors.request.use(config => {
    const teamId = localStorage.getItem('adminTeamId');
    const tournamentId = localStorage.getItem('adminTournamentId');
    const userId = localStorage.getItem('adminUserId');
    if (teamId) config.headers['X-Team-ID'] = teamId;
    if (tournamentId) config.headers['X-Tournament-ID'] = tournamentId;
    if (userId) config.headers['X-User-ID'] = userId;
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
    update: (id, data) => api.put(`/players/${id}`, data),
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

export const tournamentService = {
    getAll: () => api.get('/tournaments'),
    create: (data) => api.post('/tournaments', data),
    update: (id, data) => api.put(`/tournaments/${id}`, data),
    get: (slug) => api.get(`/tournaments/${slug}`),
    getStandings: (slug) => api.get(`/tournaments/${slug}/standings`),
    getFixtures: (slug) => api.get(`/tournaments/${slug}/fixtures`),
    getScorers: (slug) => api.get(`/tournaments/${slug}/scorers`),
    getStats: (slug) => api.get(`/tournaments/${slug}/stats`),
    getTeams: (slug) => api.get(`/tournaments/${slug}/teams`),
    getTeamPlayers: (teamId) => api.get(`/teams/${teamId}/players`),
    assignTeam: (teamId, tournamentId) => api.put(`/teams/${teamId}/tournament`, { tournament_id: tournamentId }),
    getVeedores: (tournamentId) => api.get(`/tournaments/${tournamentId}/veedores`),
    createVeedor: (tournamentId, data) => api.post(`/tournaments/${tournamentId}/veedores`, data),
    deleteUser: (userId) => api.delete(`/users/${userId}`),
    startMatch: (matchId) => api.post(`/matches/${matchId}/start`),
    getMatchLineup: (matchId) => api.get(`/matches/${matchId}/lineup`),
    getMatchEvents: (matchId) => api.get(`/matches/${matchId}/events`),
    addMatchEvent: (matchId, data) => api.post(`/matches/${matchId}/events`, data),
    assignVeedor: (matchId, veedorId) => api.post(`/matches/${matchId}/assign-veedor`, { veedor_id: veedorId }),
    lookup: (identification) => api.get(`/tournaments/lookup/${identification}`),
};

export const refereeService = {
    getAll: () => api.get('/referees'),
    create: (data) => api.post('/referees', data),
    delete: (id) => api.delete(`/referees/${id}`),
};

export const adminService = {
    getStats: () => api.get('/stats'),
    getLogs: () => api.get('/logs'),
    login: (credentials) => api.post('/login', credentials),
    getTeams: () => api.get('/teams'),
    createTeam: (data) => api.post('/teams', data),
    updateTeam: (id, data) => api.put(`/teams/${id}`, data),
    deleteTeam: (id) => api.delete(`/teams/${id}`),
};

export const settingsService = {
    getPublic: (teamSlug) => api.get(`/${teamSlug}/settings`),
    validatePin: (teamSlug, pin) => api.post(`/${teamSlug}/validate-pin`, { pin }),
    get: () => api.get('/settings'),
    update: (data) => api.put('/settings', data),
    uploadFile: (file) => {
        const formData = new FormData();
        formData.append('file', file);
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
