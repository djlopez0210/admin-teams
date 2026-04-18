import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, Trophy, Users, FileText, Settings, UserCheck, LogOut, ChevronRight, Download } from 'lucide-react';
import { tournamentService, refereeService, adminService, settingsService } from '../services/api';
import { useNotification } from '../context/NotificationContext';

const TournamentAdminPanel = () => {
    const navigate = useNavigate();
    const { showNotification } = useNotification();
    const [activeTab, setActiveTab] = useState('teams');
    const [loading, setLoading] = useState(true);
    const [tournament, setTournament] = useState(null);
    const [teams, setTeams] = useState([]);
    const [referees, setReferees] = useState([]);
    const [newTeam, setNewTeam] = useState({ name: '', admin_username: '', admin_password: '', delegate_document: '', delegate_name: '', delegate_email: '', registration_pin: '' });
    const [editingTeamId, setEditingTeamId] = useState(null);
    const [newReferee, setNewReferee] = useState({ document_number: '', full_name: '', age: '', phone: '', address: '' });
    const [uploading, setUploading] = useState(false);

    const tournamentId = localStorage.getItem('adminTournamentId');

    const loadData = async () => {
        setLoading(true);
        try {
            // Since we don't have a direct "get current tournament" by ID easily without slug, 
            // we'll assume the list call or a direct fetch if we had the slug.
            // For now, let's fetch teams and referees which use the X-Tournament-ID header.
            const [teamsRes, refereesRes] = await Promise.all([
                tournamentService.getTeams(localStorage.getItem('tournamentSlug') || 'current'), // Adjusted backend to support X-Tournament-ID
                refereeService.getAll()
            ]);
            setTeams(teamsRes.data);
            setReferees(refereesRes.data);
            
            // Get tournament details (we store slug in localStorage during login)
            const slug = localStorage.getItem('adminTournamentSlug');
            if (slug) {
                const tourRes = await tournamentService.get(slug);
                setTournament(tourRes.data);
            }
        } catch (err) {
            showNotification('Error al cargar datos del torneo', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!tournamentId) {
            navigate('/login');
            return;
        }
        loadData();
    }, []);

    const handleCreateTeam = async (e) => {
        e.preventDefault();
        try {
            const teamData = { ...newTeam, tournament_id: tournamentId };
            if (editingTeamId) {
                await adminService.updateTeam(editingTeamId, teamData);
                showNotification('Equipo actualizado', 'success');
            } else {
                await adminService.createTeam(teamData);
                showNotification('Equipo creado exitosamente', 'success');
            }
            
            setNewTeam({ name: '', admin_username: '', admin_password: '', delegate_document: '', delegate_name: '', delegate_email: '', registration_pin: '' });
            setEditingTeamId(null);
            loadData();
        } catch (err) {
            showNotification(editingTeamId ? 'Error al actualizar equipo' : 'Error al crear equipo', 'error');
        }
    };

    const handleEditTeam = (t) => {
        setEditingTeamId(t.id);
        setNewTeam({
            name: t.name || '', admin_username: t.admin_username || '', admin_password: '',
            delegate_document: t.delegate_document || '', delegate_name: t.delegate_name || '',
            delegate_email: t.delegate_email || '', registration_pin: t.registration_pin || '', slug: t.slug || ''
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleCancelEditTeam = () => {
        setEditingTeamId(null);
        setNewTeam({ name: '', admin_username: '', admin_password: '', delegate_document: '', delegate_name: '', delegate_email: '', registration_pin: '' });
    };

    const handleCreateReferee = async (e) => {
        e.preventDefault();
        try {
            await refereeService.create(newReferee);
            setNewReferee({ document_number: '', full_name: '', age: '', phone: '', address: '' });
            showNotification('Árbitro registrado', 'success');
            loadData();
        } catch (err) {
            showNotification('Error al registrar árbitro', 'error');
        }
    };

    const handleDeleteReferee = async (id) => {
        if (!window.confirm('¿Eliminar este árbitro?')) return;
        try {
            await refereeService.delete(id);
            showNotification('Árbitro eliminado', 'success');
            loadData();
        } catch (err) {
            showNotification('Error al eliminar', 'error');
        }
    };

    const handleUpdateTournament = async (e) => {
        e.preventDefault();
        // Placeholder for updateTournament endpoint if needed
        showNotification('Configuración guardada (Simulado)', 'success');
    };

    const handleLogout = () => {
        localStorage.clear();
        navigate('/login');
    };

    if (loading) return <div className="loading">Cargando panel de torneo...</div>;

    return (
        <div className="admin-container">
            <aside className="admin-sidebar">
                <div className="admin-logo">
                    <Trophy size={28} color="var(--primary)" />
                    <span>Admin Torneo</span>
                </div>
                <nav className="admin-nav">
                    <button className={`nav-item ${activeTab === 'teams' ? 'active' : ''}`} onClick={() => setActiveTab('teams')}>
                        <Users size={20} /> Equipos
                    </button>
                    <button className={`nav-item ${activeTab === 'referees' ? 'active' : ''}`} onClick={() => setActiveTab('referees')}>
                        <UserCheck size={20} /> Árbitros
                    </button>
                    <button className={`nav-item ${activeTab === 'config' ? 'active' : ''}`} onClick={() => setActiveTab('config')}>
                        <Settings size={20} /> Configuración
                    </button>
                    <button className="nav-item" style={{ marginTop: 'auto', color: 'var(--error)' }} onClick={handleLogout}>
                        <LogOut size={20} /> Cerrar Sesión
                    </button>
                </nav>
            </aside>

            <main className="admin-main">
                <header className="admin-header">
                    <div>
                        <h1>{tournament?.name || 'Mi Torneo'}</h1>
                        <p style={{ opacity: 0.7 }}>{tournament?.city || 'Sede por definir'}</p>
                    </div>
                </header>

                <div className="admin-content">
                    {activeTab === 'teams' && (
                        <div className="animate-fade-in">
                            <div className="grid" style={{ gridTemplateColumns: '1fr 2fr', gap: '2rem' }}>
                                <div className="glass" style={{ padding: '1.5rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <h3>{editingTeamId ? '📝 Editar Equipo' : 'Inscribir Nuevo Equipo'}</h3>
                                        {editingTeamId && (
                                            <button type="button" className="btn btn-secondary" onClick={handleCancelEditTeam} style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}>
                                                Cancelar
                                            </button>
                                        )}
                                    </div>
                                    <form onSubmit={handleCreateTeam} style={{ marginTop: '1.5rem' }}>
                                        <div className="form-group">
                                            <label className="label">Nombre del Equipo</label>
                                            <input 
                                                type="text" className="input" required
                                                value={newTeam.name}
                                                onChange={(e) => setNewTeam({...newTeam, name: e.target.value})}
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label className="label">Usuario Admin Equipo</label>
                                            <input 
                                                type="text" className="input" required
                                                value={newTeam.admin_username}
                                                onChange={(e) => setNewTeam({...newTeam, admin_username: e.target.value})}
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label className="label">Contraseña Admin</label>
                                            <input 
                                                type="password" className="input" required={!editingTeamId}
                                                value={newTeam.admin_password}
                                                onChange={(e) => setNewTeam({...newTeam, admin_password: e.target.value})}
                                            />
                                        </div>
                                        <hr style={{ margin: '1rem 0', opacity: 0.1 }} />
                                        <h4 style={{ marginBottom: '1rem', color: 'var(--primary)', fontSize: '0.9rem' }}>Delegado / Representante</h4>
                                        <div className="form-group">
                                            <label className="label">Documento</label>
                                            <input 
                                                type="text" className="input" placeholder="Ej: 1100223"
                                                value={newTeam.delegate_document}
                                                onChange={(e) => setNewTeam({...newTeam, delegate_document: e.target.value})}
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label className="label">Nombre Completo</label>
                                            <input 
                                                type="text" className="input"
                                                value={newTeam.delegate_name}
                                                onChange={(e) => setNewTeam({...newTeam, delegate_name: e.target.value})}
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label className="label">Correo Electrónico</label>
                                            <input 
                                                type="email" className="input" placeholder="admin@equipo.com"
                                                value={newTeam.delegate_email}
                                                onChange={(e) => setNewTeam({...newTeam, delegate_email: e.target.value})}
                                            />
                                        </div>
                                        <hr style={{ margin: '1rem 0', opacity: 0.1 }} />
                                        <div className="form-group">
                                            <label className="label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                PIN de Registro Jugadores <span>(Opcional)</span>
                                            </label>
                                            <input 
                                                type="text" className="input" placeholder="Ej: 1234" maxLength="4"
                                                value={newTeam.registration_pin}
                                                onChange={(e) => setNewTeam({...newTeam, registration_pin: e.target.value.replace(/\D/g, '').slice(0, 4)})}
                                            />
                                            <small style={{ color: 'var(--text-muted)' }}>Si lo defines, los jugadores necesitarán este PIN para inscribirse en su formulario público.</small>
                                        </div>
                                        
                                        <div style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(56, 189, 248, 0.1)', borderRadius: '8px', borderLeft: '4px solid var(--primary)', fontSize: '0.85rem' }}>
                                            <strong style={{ color: 'var(--primary)', display: 'block', marginBottom: '0.2rem' }}>🔗 Link de Inscripción:</strong>
                                            <code>http://localhost:3000/{editingTeamId && newTeam.slug ? newTeam.slug : '{se-generará-automáticamente}'}/registro</code>
                                        </div>

                                        <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }}>
                                            {editingTeamId ? 'Guardar Cambios' : 'Crear Equipo'}
                                        </button>
                                    </form>
                                </div>
                                <div>
                                    <h3 style={{ marginBottom: '1rem' }}>Equipos en Competencia</h3>
                                    <div className="glass table-container">
                                        <table>
                                            <thead>
                                                <tr>
                                                    <th>Equipo</th>
                                                    <th>Admin</th>
                                                    <th>Acciones</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {teams.map(t => (
                                                    <tr key={t.id}>
                                                        <td style={{ fontWeight: 600 }}>{t.name}</td>
                                                        <td><code>{t.admin_username || 'n/a'}</code></td>
                                                        <td style={{ display: 'flex', gap: '0.5rem' }}>
                                                            <button className="btn btn-primary" style={{ padding: '0.4rem', fontSize: '0.8rem' }} onClick={() => handleEditTeam(t)}>
                                                                Editar
                                                            </button>
                                                            <button className="btn btn-secondary" style={{ padding: '0.4rem', fontSize: '0.8rem' }} onClick={() => navigate(`/${t.slug}/registro`)}>
                                                                Ver Link Registro
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'referees' && (
                        <div className="animate-fade-in">
                             <div className="grid" style={{ gridTemplateColumns: '1fr 2fr', gap: '2rem' }}>
                                <div className="glass" style={{ padding: '1.5rem' }}>
                                    <h3>Registrar Árbitro</h3>
                                    <form onSubmit={handleCreateReferee} style={{ marginTop: '1.5rem' }}>
                                        <div className="form-group">
                                            <label className="label">Documento</label>
                                            <input 
                                                type="text" className="input" required
                                                value={newReferee.document_number}
                                                onChange={(e) => setNewReferee({...newReferee, document_number: e.target.value})}
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label className="label">Nombre Completo</label>
                                            <input 
                                                type="text" className="input" required
                                                value={newReferee.full_name}
                                                onChange={(e) => setNewReferee({...newReferee, full_name: e.target.value})}
                                            />
                                        </div>
                                        <div className="grid-form" style={{ gridTemplateColumns: '1fr 2fr' }}>
                                            <div className="form-group">
                                                <label className="label">Edad</label>
                                                <input 
                                                    type="number" className="input"
                                                    value={newReferee.age}
                                                    onChange={(e) => setNewReferee({...newReferee, age: e.target.value})}
                                                />
                                            </div>
                                            <div className="form-group">
                                                <label className="label">Teléfono</label>
                                                <input 
                                                    type="text" className="input"
                                                    value={newReferee.phone}
                                                    onChange={(e) => setNewReferee({...newReferee, phone: e.target.value})}
                                                />
                                            </div>
                                        </div>
                                        <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }}>
                                            <Plus size={18} /> Guardar Árbitro
                                        </button>
                                    </form>
                                </div>
                                <div className="glass table-container">
                                    <table>
                                        <thead>
                                            <tr>
                                                <th>Nombre</th>
                                                <th>Documento</th>
                                                <th>Teléfono</th>
                                                <th>Acciones</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {referees.map(r => (
                                                <tr key={r.id}>
                                                    <td style={{ fontWeight: 600 }}>{r.full_name}</td>
                                                    <td>{r.document_number}</td>
                                                    <td>{r.phone}</td>
                                                    <td>
                                                        <button className="btn btn-secondary" onClick={() => handleDeleteReferee(r.id)}>
                                                            <Trash2 size={16} color="var(--error)" />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                             </div>
                        </div>
                    )}

                    {activeTab === 'config' && (
                        <div className="animate-fade-in glass" style={{ padding: '2rem' }}>
                            <h3>Configuración de {tournament?.name}</h3>
                            <form onSubmit={handleUpdateTournament} style={{ marginTop: '2rem' }}>
                                {/* Shared with SuperAdmin creation logic but for updates */}
                                <div className="grid-form">
                                    <div className="form-group">
                                        <label className="label">Nombre</label>
                                        <input type="text" className="input" value={tournament?.name || ''} readOnly />
                                    </div>
                                    <div className="form-group">
                                        <label className="label">Ciudad</label>
                                        <input type="text" className="input" value={tournament?.city || ''} readOnly />
                                    </div>
                                </div>
                                <div className="form-group" style={{ marginTop: '1rem' }}>
                                    <label className="label">Reglamento Actual</label>
                                    {tournament?.rules_pdf_url ? (
                                        <a href={tournament.rules_pdf_url} target="_blank" rel="noreferrer" className="btn btn-secondary" style={{ display: 'inline-flex', gap: '0.5rem' }}>
                                            <Download size={18} /> Ver PDF Reglamento
                                        </a>
                                    ) : <p style={{ fontSize: '0.9rem', opacity: 0.6 }}>No se ha cargado reglamento.</p>}
                                </div>
                                <div style={{ marginTop: '2rem', paddingTop: '2rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                                    <p style={{ fontSize: '0.85rem', opacity: 0.6 }}>* Para cambios estructurales de nombre o ciudad, contacte al Super Administrador.</p>
                                </div>
                            </form>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};

export default TournamentAdminPanel;
