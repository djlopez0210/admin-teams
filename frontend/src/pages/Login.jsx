import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, User, LogIn, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { adminService } from '../services/api';
import { useNotification } from '../context/NotificationContext';

const Login = () => {
    const [credentials, setCredentials] = useState({ username: '', password: '' });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const navigate = useNavigate();
    const { showNotification } = useNotification();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const res = await adminService.login(credentials);
            if (res.data.role) {
                localStorage.setItem('adminAuthenticated', 'true');
                localStorage.setItem('adminTeamId', res.data.team_id || '');
                localStorage.setItem('adminTeamSlug', res.data.team_slug || '');
                localStorage.setItem('adminTournamentId', res.data.tournament_id || '');
                localStorage.setItem('adminTournamentSlug', res.data.tournament_slug || '');
                localStorage.setItem('adminRole', res.data.role);
                localStorage.setItem('adminUserId', res.data.user_id || '');
                localStorage.setItem('adminUsername', credentials.username);
                
                showNotification('Bienvenido, ' + credentials.username, 'success');
                
                // Redirect based on role
                if (res.data.role === 'superadmin') {
                    navigate('/admin');
                } else if (res.data.role === 'tournament_admin') {
                    navigate('/tournament-admin');
                } else if (res.data.role === 'veedor') {
                    navigate('/veedor');
                } else {
                    navigate('/players'); // Default for team admins
                }
            }
        } catch (err) {
            setError('Credenciales incorrectas. Por favor, intente de nuevo.');
            showNotification('Credenciales incorrectas', 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
            <div className="glass animate-fade-in" style={{ width: '100%', maxWidth: '400px', padding: '2.5rem' }}>
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    <div style={{ background: 'var(--glass)', width: '64px', height: '64px', borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', margin: '0 auto 1rem' }}>
                        <Lock size={32} color="var(--primary)" />
                    </div>
                    <h2>Área Restringida</h2>
                    <p style={{ color: 'var(--text-muted)' }}>Inicia sesión para acceder al panel de admin.</p>
                </div>

                {error && (
                    <div className="alert alert-error" style={{ marginBottom: '1.5rem', fontSize: '0.875rem' }}>
                        <AlertCircle size={18} /> {error}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label className="label">Usuario</label>
                        <div style={{ position: 'relative' }}>
                            <User size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '1rem', top: '0.85rem' }} />
                            <input 
                                type="text" 
                                className="input" 
                                style={{ paddingLeft: '3rem' }}
                                value={credentials.username}
                                onChange={(e) => setCredentials({ ...credentials, username: e.target.value })}
                                required
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="label">Contraseña</label>
                        <div style={{ position: 'relative' }}>
                            <Lock size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '1rem', top: '0.85rem' }} />
                            <input 
                                type={showPassword ? "text" : "password"} 
                                className="input" 
                                style={{ paddingLeft: '3rem', paddingRight: '3rem' }}
                                value={credentials.password}
                                onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
                                required
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                style={{ 
                                    position: 'absolute', 
                                    right: '1rem', 
                                    top: '0.85rem', 
                                    background: 'none', 
                                    border: 'none', 
                                    color: 'var(--text-muted)', 
                                    cursor: 'pointer' 
                                }}
                            >
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>

                    <button 
                        type="submit" 
                        className="btn btn-primary" 
                        style={{ width: '100%', marginTop: '1rem' }}
                        disabled={loading}
                    >
                        {loading ? 'Verificando...' : (
                            <>
                                <LogIn size={18} /> Entrar al Panel
                            </>
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default Login;
