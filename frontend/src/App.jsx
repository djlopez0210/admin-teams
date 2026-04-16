import React, { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, NavLink } from 'react-router-dom'
import { UserPlus, Settings as SettingsIcon, Trophy, Image } from 'lucide-react'
import RegisterPlayer from './pages/RegisterPlayer'
import PlayersList from './pages/PlayersList'
import AdminPanel from './pages/AdminPanel'
import Login from './pages/Login'
import ProtectedRoute from './components/ProtectedRoute'
import { settingsService } from './services/api'

function App() {
  const [settings, setSettings] = useState({
    team_name: 'TeamManager',
    team_logo_url: '',
    favicon_url: ''
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const res = await settingsService.get();
      setSettings(res.data);
      if (res.data.team_name) {
        document.title = res.data.team_name;
      }
      if (res.data.favicon_url) {
        let link = document.querySelector("link[rel~='icon']");
        if (!link) {
          link = document.createElement('link');
          link.rel = 'icon';
          document.getElementsByTagName('head')[0].appendChild(link);
        }
        link.href = res.data.favicon_url;
      }
    } catch (err) {
      console.error('Error loading settings', err);
    }
  };

  return (
    <Router>
      <header className="navbar glass">
        <div className="logo" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {settings.team_logo_url ? (
            <img src={settings.team_logo_url} alt="Logo" style={{ height: '40px', width: '40px', objectFit: 'contain', borderRadius: '8px' }} />
          ) : (
            <Trophy size={32} color="var(--primary)" />
          )}
          <h2 style={{ margin: 0 }}>{settings.team_name}</h2>
        </div>
        <nav className="nav-links">
          <NavLink to="/" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} end>
            <UserPlus size={18} inline /> Registro
          </NavLink>
          <NavLink to="/admin" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <SettingsIcon size={18} inline /> Admin
          </NavLink>
        </nav>
      </header>

      <main className="container animate-fade-in">
        <Routes>
          <Route path="/" element={<RegisterPlayer />} />
          <Route 
            path="/players" 
            element={
              <ProtectedRoute>
                <PlayersList />
              </ProtectedRoute>
            } 
          />
          <Route path="/login" element={<Login />} />
          <Route 
            path="/admin" 
            element={
              <ProtectedRoute>
                <AdminPanel onSettingsUpdate={loadSettings} />
              </ProtectedRoute>
            } 
          />
        </Routes>
      </main>

      <footer style={{ marginTop: 'auto', padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
        &copy; {new Date().getFullYear()} {settings.team_name}. Todos los derechos reservados.
      </footer>
    </Router>
  )
}

export default App
