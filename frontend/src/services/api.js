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
    const role = localStorage.getItem('adminRole');
    if (teamId) config.headers['X-Team-ID'] = teamId;
    if (tournamentId) config.headers['X-Tournament-ID'] = tournamentId;
    if (userId) config.headers['X-User-ID'] = userId;
    if (role) config.headers['X-User-Role'] = role;
    return config;
});

// Optional per-request team override — used by the superadmin cross-team players view,
// where there's no adminTeamId in localStorage for the interceptor to inject.
const teamOverride = (teamId) => teamId ? { headers: { 'X-Team-ID': teamId } } : undefined;

export const playerService = {
    checkDocument: (teamSlug, docNumber) => api.post(`/${teamSlug}/players/check-document`, { document_number: docNumber }),
    register: (teamSlug, playerData) => api.post(`/${teamSlug}/players`, playerData),
    getAll: (teamId) => api.get('/players', teamOverride(teamId)),
    delete: (id) => api.delete(`/players/${id}`),
    getHistory: (id) => api.get(`/players/${id}/history`),
    updatePayment: (id, data) => api.patch(`/players/${id}/payment`, data),
    getEps: (teamSlug) => api.get(`/${teamSlug}/eps`),
    update: (id, data) => api.put(`/players/${id}`, data),
    uploadPhoto: (id, file, teamId) => {
        const formData = new FormData();
        formData.append('file', file);
        return api.post(`/players/${id}/photo`, formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
                ...(teamId ? { 'X-Team-ID': teamId } : {})
            }
        });
    },
    uploadPhotoPublic: (teamSlug, playerId, file) => {
        const formData = new FormData();
        formData.append('file', file);
        return api.post(`/${teamSlug}/players/${playerId}/photo`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
    },
    getCardData: (id, teamId) => api.get(`/players/${id}/card-data`, teamOverride(teamId)),
    getTeamCardData: (teamId) => api.get(`/teams/${teamId}/players/card-data`, teamOverride(teamId)),
};

export const cardTemplateService = {
    get: () => api.get('/card-template'),
    update: (data) => api.put('/card-template', data),
};

export const playerAuthService = {
    me: () => api.get('/me/player'),
    changePassword: (data) => api.put('/me/password', data),
};

export const positionService = {
    getAllByTeam: (teamSlug) => api.get(`/${teamSlug}/positions`),
    getAll: (teamId) => api.get('/positions', teamOverride(teamId)),
    create: (data) => api.post('/positions', data),
    update: (id, data) => api.put(`/positions/${id}`, data),
    delete: (id) => api.delete(`/positions/${id}`),
};

export const uniformService = {
    getAvailable: (teamSlug) => api.get(`/${teamSlug}/uniform-numbers/available`),
    getAll: (teamId) => api.get('/uniform-numbers', teamOverride(teamId)),
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
    saveWizardConfig: (tournamentId, config) => api.post(`/tournaments/${tournamentId}/wizard-config`, config),
    getMatchRatings: (matchId) => api.get(`/matches/${matchId}/ratings`),
    saveMatchRatings: (matchId, ratings) => api.post(`/matches/${matchId}/ratings`, { ratings }),
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

export const communityService = {
    getAll: () => api.get('/communities'),
    get: (id) => api.get(`/communities/${id}`),
    create: (data) => api.post('/communities', data),
    update: (id, data) => api.put(`/communities/${id}`, data),
    delete: (id) => api.delete(`/communities/${id}`),

    // Players
    getPlayers: (commId) => api.get(`/communities/${commId}/players`),
    addPlayer: (commId, data) => api.post(`/communities/${commId}/players`, data),
    importExcel: (commId, file) => {
        const formData = new FormData();
        formData.append('file', file);
        return api.post(`/communities/${commId}/players/import-excel`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
    },
    updatePlayer: (commId, cpId, data) => api.put(`/communities/${commId}/players/${cpId}`, data),
    removePlayer: (commId, cpId) => api.delete(`/communities/${commId}/players/${cpId}`),
    downloadTemplate: () => api.get('/excel-template/players', { responseType: 'blob' }),

    // Polls
    getPolls: (commId) => api.get(`/communities/${commId}/polls`),
    createPoll: (commId, data) => api.post(`/communities/${commId}/polls`, data),
    votePoll: (pollId, data) => api.post(`/communities/polls/${pollId}/vote`, data),
    togglePoll: (pollId) => api.patch(`/communities/polls/${pollId}/toggle`),
    deletePoll: (pollId) => api.delete(`/communities/polls/${pollId}`),

    // Matches
    getMatches: (commId) => api.get(`/communities/${commId}/matches`),
    createMatch: (commId, data) => api.post(`/communities/${commId}/matches`, data),
    updateMatch: (matchId, data) => api.put(`/communities/matches/${matchId}`, data),
    setMatchRoster: (matchId, data) => api.post(`/communities/matches/${matchId}/roster`, data),
    deleteMatch: (matchId) => api.delete(`/communities/matches/${matchId}`),
};

export const globalPlayerService = {
    search: (query, limit = 30) => api.get('/players/global-search', { params: { q: query, limit } }),
    enrollInTeam: (teamId, data) => api.post(`/teams/${teamId}/enroll-player`, data),
    importTeamExcel: (teamId, file) => {
        const formData = new FormData();
        formData.append('file', file);
        return api.post(`/teams/${teamId}/players/import-excel`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
    },
    downloadTemplate: () => api.get('/excel-template/players', { responseType: 'blob' }),
};

export default api;
