import React, { useState, useEffect } from 'react'
import { NotificationProvider } from './context/NotificationContext'
import { BrowserRouter as Router, Routes, Route, NavLink, Link } from 'react-router-dom'
import { UserPlus, Settings as SettingsIcon, Trophy, Image, Calendar, Sun, Moon, Users } from 'lucide-react'
import RegisterPlayer from './pages/RegisterPlayer'
import PlayersList from './pages/PlayersList'
import AdminPanel from './pages/AdminPanel'
import Login from './pages/Login'
import LandingPage from './pages/LandingPage'
import TournamentLanding from './pages/TournamentLanding'
import TournamentAdminPanel from './pages/TournamentAdminPanel'
import VeedorPanel from './pages/VeedorPanel'
import CardTemplateEditor from './pages/CardTemplateEditor'
import PlayerProfile from './pages/PlayerProfile'
import CommunitiesList from './pages/CommunitiesList'
import CommunityDetail from './pages/CommunityDetail'
import ProtectedRoute from './components/ProtectedRoute'
import { settingsService } from './services/api'
import { useParams, useLocation } from 'react-router-dom'
import { initActivityTracker, clearSession, getRoleDashboard } from './utils/session'

// Applied once when the app loads, before the first paint, to avoid a flash of the wrong theme.
if (localStorage.getItem('uiTheme') === 'dark') {
  document.body.classList.add('theme-dark');
}

function TeamLayout({ children, isPublic = true }) {
  const { teamSlug } = useParams();
  const [isDarkTheme, setIsDarkTheme] = useState(() => document.body.classList.contains('theme-dark'));

  const toggleTheme = () => {
    const next = !isDarkTheme;
    setIsDarkTheme(next);
    document.body.classList.toggle('theme-dark', next);
    localStorage.setItem('uiTheme', next ? 'dark' : 'light');
  };

  const [settings, setSettings] = useState({
    team_name: 'TeamManager',
    team_logo_url: '',
    favicon_url: ''
  });

  useEffect(() => {
    if (isPublic && teamSlug) {
      loadPublicSettings(teamSlug);
    } else if (!isPublic) {
      loadAdminSettings();
    }
  }, [teamSlug, isPublic]);

  const loadPublicSettings = async (slug) => {
    try {
      const res = await settingsService.getPublic(slug);
      applySettings(res.data);
    } catch (err) {
      console.error('Error loading public settings', err);
    }
  };

  const loadAdminSettings = async () => {
    const role = localStorage.getItem('adminRole');
    if (role === 'superadmin') {
      applySettings({
        team_name: 'Gestión Global',
        team_logo_url: '/logo-placeholder.png', // Or just empty
        favicon_url: ''
      });
      return;
    }
    
    if (role === 'tournament_admin') {
      applySettings({
        team_name: 'Panel de Torneo',
        team_logo_url: '',
        favicon_url: ''
      });
      return;
    }

    if (role === 'veedor') {
      applySettings({
        team_name: 'Panel de Veeduría',
        team_logo_url: '',
        favicon_url: ''
      });
      return;
    }
    
    try {
      const res = await settingsService.get();
      applySettings(res.data);
    } catch (err) {
      console.error('Error loading admin settings', err);
    }
  };

  const applySettings = (data) => {
    setSettings(data);
    if (data.team_name) document.title = data.team_name;
    if (data.favicon_url) {
      let link = document.querySelector("link[rel~='icon']") || document.createElement('link');
      link.rel = 'icon';
      link.href = data.favicon_url;
      document.getElementsByTagName('head')[0].appendChild(link);
    }
  };

  const role = localStorage.getItem('adminRole');

  const getLogoDestination = () => {
    if (isPublic) {
      return teamSlug ? `/${teamSlug}` : '/';
    }
    return getRoleDashboard(role);
  };

  return (
    <>
      <header className="navbar glass">
        <Link 
          to={getLogoDestination()} 
          className="logo" 
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '0.75rem', 
            textDecoration: 'none', 
            color: 'inherit',
            cursor: 'pointer'
          }}
        >
          {settings.team_logo_url ? (
            <img src={settings.team_logo_url} alt="Logo" style={{ height: '40px', width: '40px', objectFit: 'contain', borderRadius: '8px' }} />
          ) : (
            <Trophy size={32} color="var(--primary)" />
          )}
          <h2 style={{ margin: 0 }}>{settings.team_name}</h2>
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
        <nav className="nav-links">
          {isPublic ? (
            <NavLink to={`/${teamSlug}`} className="nav-link">
              <UserPlus size={18} inline /> Registro
            </NavLink>
          ) : (
            <>
              {role !== 'veedor' && role !== 'tournament_admin' && role !== 'player' && (
                <>
                  <NavLink to="/admin" className="nav-link" end>
                    <SettingsIcon size={18} inline /> Dashboard
                  </NavLink>
                  <NavLink to="/players" className="nav-link">
                    <UserPlus size={18} inline /> Jugadores
                  </NavLink>
                </>
              )}
              {role !== 'veedor' && role !== 'player' && (
                <NavLink to="/communities" className="nav-link">
                  <Users size={18} inline /> Comunidades
                </NavLink>
              )}
              {role === 'tournament_admin' && (
                <NavLink to="/tournament-admin" className="nav-link">
                  <Trophy size={18} inline /> Torneos
                </NavLink>
              )}
              {role === 'superadmin' && (
                <NavLink to="/card-template" className="nav-link">
                  <Image size={18} inline /> Diseño de Tarjeta
                </NavLink>
              )}
              {role === 'veedor' && (
                <NavLink to="/veedor" className="nav-link">
                  <Calendar size={18} inline /> Partidos
                </NavLink>
              )}
              {role === 'player' && (
                <NavLink to="/player" className="nav-link">
                  <UserPlus size={18} inline /> Mi Perfil
                </NavLink>
              )}
              <button 
                onClick={() => { clearSession(); window.location.href = '/login'; }}
                className="nav-link" 
                style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--error)' }}
              >
                Salir
              </button>
            </>
          )}
        </nav>
        <button
          onClick={toggleTheme}
          className="theme-toggle"
          title={isDarkTheme ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
        >
          {isDarkTheme ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        </div>
      </header>
      <main className="container animate-fade-in">
        {children}
      </main>
      <footer style={{ marginTop: 'auto', padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
        &copy; {new Date().getFullYear()} {settings.team_name}. Todos los derechos reservados.
      </footer>
    </>
  );
}

function App() {
  useEffect(() => {
    return initActivityTracker();
  }, []);

  return (
    <NotificationProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />

          {/* Admin routes (Prioritized over dynamic slugs) */}
          <Route 
            path="/players" 
            element={
              <ProtectedRoute>
                <TeamLayout isPublic={false}><PlayersList /></TeamLayout>
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/admin" 
            element={
              <ProtectedRoute allowedRoles={['superadmin', 'admin']}>
                <TeamLayout isPublic={false}><AdminPanel onSettingsUpdate={() => window.location.reload()} /></TeamLayout>
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/tournament-admin" 
            element={
              <ProtectedRoute allowedRoles={['superadmin', 'tournament_admin']}>
                <TeamLayout isPublic={false}><TournamentAdminPanel /></TeamLayout>
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/team-admin" 
            element={
              <ProtectedRoute>
                <TeamLayout isPublic={false}><AdminPanel /></TeamLayout>
              </ProtectedRoute>
            } 
          />
          <Route
            path="/veedor"
            element={
              <ProtectedRoute allowedRoles={['superadmin', 'veedor']}>
                <TeamLayout isPublic={false}><VeedorPanel /></TeamLayout>
              </ProtectedRoute>
            }
          />
          <Route 
            path="/card-template" 
            element={
              <ProtectedRoute allowedRoles={['superadmin']}>
                <TeamLayout isPublic={false}><CardTemplateEditor /></TeamLayout>
              </ProtectedRoute>
            } 
          />
          {/* Communities Module (accessible with /communities and /comunidades) */}
          <Route 
            path="/communities" 
            element={<TeamLayout isPublic={false}><CommunitiesList /></TeamLayout>} 
          />
          <Route 
            path="/comunidades" 
            element={<TeamLayout isPublic={false}><CommunitiesList /></TeamLayout>} 
          />
          <Route 
            path="/communities/:communityId" 
            element={<TeamLayout isPublic={false}><CommunityDetail /></TeamLayout>} 
          />
          <Route 
            path="/comunidades/:communityId" 
            element={<TeamLayout isPublic={false}><CommunityDetail /></TeamLayout>} 
          />
          <Route 
            path="/player"
            element={
              <ProtectedRoute allowedRoles={['player']}>
                <TeamLayout isPublic={false}><PlayerProfile /></TeamLayout>
              </ProtectedRoute>
            }
          />

          {/* Public Tournament routes */}
          <Route path="/:tournamentSlug">
            <Route index element={<TournamentLanding />} />
            <Route path="stats" element={<TournamentLanding />} />
          </Route>

          {/* Direct Team Registration Route */}
          <Route path="/:teamSlug/registro" element={<TeamLayout isPublic={true}><RegisterPlayer /></TeamLayout>} />

          {/* Landing Page (Root) */}
          <Route path="/" element={<LandingPage />} />
        </Routes>
      </Router>
    </NotificationProvider>
  )
}

export default App
