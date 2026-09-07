// Session and Activity Management Utility
export const SESSION_TIMEOUT_MINUTES = 60;
export const SESSION_TIMEOUT_MS = SESSION_TIMEOUT_MINUTES * 60 * 1000;

/**
 * Updates the timestamp of the last detected user interaction.
 */
export const updateSessionActivity = () => {
    if (localStorage.getItem('adminAuthenticated') === 'true') {
        localStorage.setItem('adminLastActivity', Date.now().toString());
    }
};

/**
 * Checks whether the current session is authenticated and still within the active window.
 */
export const isSessionValid = () => {
    const isAuthenticated = localStorage.getItem('adminAuthenticated') === 'true';
    if (!isAuthenticated) return false;

    const lastActivity = localStorage.getItem('adminLastActivity');
    if (!lastActivity) {
        // Initialize if not present yet
        localStorage.setItem('adminLastActivity', Date.now().toString());
        return true;
    }

    const elapsed = Date.now() - parseInt(lastActivity, 10);
    if (elapsed > SESSION_TIMEOUT_MS) {
        clearSession();
        return false;
    }

    return true;
};

/**
 * Clears all admin auth tokens from localStorage while preserving UI theme preference.
 */
export const clearSession = () => {
    const theme = localStorage.getItem('uiTheme');
    const keysToRemove = [
        'adminAuthenticated',
        'adminRole',
        'adminUserId',
        'adminUsername',
        'adminTeamId',
        'adminTeamSlug',
        'adminTournamentId',
        'adminTournamentSlug',
        'adminPlayerId',
        'adminLastActivity',
        'mustChangePassword'
    ];
    keysToRemove.forEach(k => localStorage.removeItem(k));
    if (theme) {
        localStorage.setItem('uiTheme', theme);
    }
};

/**
 * Resolves the primary dashboard route for a given user role.
 */
export const getRoleDashboard = (role) => {
    switch (role) {
        case 'superadmin':
            return '/admin';
        case 'tournament_admin':
            return '/tournament-admin';
        case 'veedor':
            return '/veedor';
        case 'player':
            return '/player';
        default:
            return '/players';
    }
};

/**
 * Attaches user interaction listeners to keep the session alive while the user is actively working.
 * Throttled to at most once every 30 seconds to minimize localStorage writes.
 */
export const initActivityTracker = () => {
    let lastRecorded = 0;
    const THROTTLE_MS = 30 * 1000; // 30 seconds

    const handleUserActivity = () => {
        const now = Date.now();
        if (now - lastRecorded > THROTTLE_MS) {
            lastRecorded = now;
            updateSessionActivity();
        }
    };

    const events = ['click', 'keydown', 'mousemove', 'scroll', 'touchstart'];
    events.forEach(ev => window.addEventListener(ev, handleUserActivity, { passive: true }));

    // Return cleanup function
    return () => {
        events.forEach(ev => window.removeEventListener(ev, handleUserActivity));
    };
};
