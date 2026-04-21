import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, Trophy, Users, FileText, Settings, UserCheck, LogOut, ChevronRight, Download, Network, Edit2, Upload, Calendar, Zap, AlertTriangle, Palette, Save, Copy, Check, Info } from 'lucide-react';
import { tournamentService, refereeService, adminService, settingsService, api } from '../services/api';
import { useNotification } from '../context/NotificationContext';
import TournamentPhases from './TournamentPhases';

const TournamentAdminPanel = () => {
    const navigate = useNavigate();
    const { showNotification, showConfirm } = useNotification();
    const [activeTab, setActiveTab] = useState('teams');
    const [loading, setLoading] = useState(true);
    const [tournament, setTournament] = useState(null);
    const [teams, setTeams] = useState([]);
    const [selectedTeamPlayers, setSelectedTeamPlayers] = useState([]);
    const [showPlayersModal, setShowPlayersModal] = useState(false);
    const [viewingTeamName, setViewingTeamName] = useState('');
    const [referees, setReferees] = useState([]);
    const [newTeam, setNewTeam] = useState({ 
        name: '', 
        delegate_document: '', 
        delegate_name: '', 
        delegate_email: '', 
        delegate_phone: '',
        delegate_address: '',
        delegate_city: '',
        registration_pin: '' 
    });
    const [generatedCredentials, setGeneratedCredentials] = useState(null);
    const [showCredentialsModal, setShowCredentialsModal] = useState(false);
    const [editingTeamId, setEditingTeamId] = useState(null);
    const [newReferee, setNewReferee] = useState({ document_number: '', full_name: '', age: '', phone: '', address: '' });
    const [showTeamForm, setShowTeamForm] = useState(false);
    const [showRefereeForm, setShowRefereeForm] = useState(false);
    const [showFieldForm, setShowFieldForm] = useState(false);
    const [editingFieldId, setEditingFieldId] = useState(null);
    const [fields, setFields] = useState([]);
    const [newField, setNewField] = useState({ name: '', address: '' });
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true); 
    const [matches, setMatches] = useState([]);
    const [veedores, setVeedores] = useState([]);
    const [showVeedorForm, setShowVeedorForm] = useState(false);
    const [newVeedor, setNewVeedor] = useState({ username: '', password: '' });
    const [statsSummary, setStatsSummary] = useState({ total_teams: 0, total_goals: 0, total_cards: 0, finished_matches: 0 });
    const [standings, setStandings] = useState([]);
    const [config, setConfig] = useState({
        name: '', identification: '', representative_name: '', representative_phone: '', representative_address: '',
        city: '', description: '', image_url: '', rules_pdf_url: '',
        win_points: 3, draw_points: 1, loss_points: 0,
        start_date: '', end_date: '',
        primary_color: '#38bdf8', secondary_color: '#0ea5e9'
    });
    const [uploading, setUploading] = useState(false);

    const tournamentId = localStorage.getItem('adminTournamentId');

    const loadData = async () => {
        setLoading(true);
        try {
            const leagueSlug = localStorage.getItem('adminTournamentSlug') || 'current';
            const [teamsRes, refereesRes, fieldsRes, matchesRes, veedoresRes, statsRes, standingsRes] = await Promise.all([
                tournamentService.getTeams(leagueSlug),
                refereeService.getAll(),
                api.get('/fields'),
                tournamentService.getFixtures(leagueSlug),
                tournamentService.getVeedores(tournamentId),
                tournamentService.getStats(leagueSlug),
                tournamentService.getStandings(leagueSlug)
            ]);
            setTeams(teamsRes.data);
            setReferees(refereesRes.data);
            setFields(fieldsRes.data);
            setMatches(matchesRes.data || []);
            setVeedores(veedoresRes.data || []);
            setStatsSummary(statsRes.data || { total_teams: 0, total_goals: 0, total_cards: 0, finished_matches: 0 });
            setStandings(standingsRes.data || []);
            
            console.log('Veedores cargados:', veedoresRes.data);
            if (!veedoresRes.data || veedoresRes.data.length === 0) {
                console.warn('No se encontraron veedores para el torneo ID:', tournamentId);
            }
            
            if (leagueSlug) {
                const tourRes = await tournamentService.get(leagueSlug);
                setTournament(tourRes.data);
                setConfig({
                    name: tourRes.data.name || '',
                    identification: tourRes.data.identification || '',
                    representative_name: tourRes.data.representative_name || '',
                    representative_phone: tourRes.data.representative_phone || '',
                    representative_address: tourRes.data.representative_address || '',
                    city: tourRes.data.city || '',
                    description: tourRes.data.description || '',
                    image_url: tourRes.data.image_url || '',
                    rules_pdf_url: tourRes.data.rules_pdf_url || '',
                    win_points: tourRes.data.win_points || 3,
                    draw_points: tourRes.data.draw_points || 1,
                    loss_points: tourRes.data.loss_points || 0,
                    start_date: tourRes.data.start_date || '',
                    end_date: tourRes.data.end_date || '',
                    primary_color: tourRes.data.primary_color || '#38bdf8',
                    secondary_color: tourRes.data.secondary_color || '#0ea5e9'
                });
            }
        } catch (err) {
            console.error('Data loading error', err);
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
                setEditingTeamId(null);
                setShowTeamForm(false);
            } else {
                const res = await adminService.createTeam(teamData);
                showNotification('Equipo creado exitosamente', 'success');
                if (res.data.credentials) {
                    setGeneratedCredentials(res.data.credentials);
                    setShowCredentialsModal(true);
                }
                setShowTeamForm(false);
            }
            
            setNewTeam({ 
                name: '', 
                delegate_document: '', 
                delegate_name: '', 
                delegate_email: '', 
                delegate_phone: '',
                delegate_address: '',
                delegate_city: '',
                registration_pin: '' 
            });
            loadData();
        } catch (err) {
            showNotification(err.response?.data?.error || 'Error al procesar equipo', 'error');
        }
    };

    const handleEditTeam = (t) => {
        setEditingTeamId(t.id);
        setNewTeam({
            name: t.name || '',
            delegate_document: t.delegate_document || '',
            delegate_name: t.delegate_name || '',
            delegate_email: t.delegate_email || '',
            delegate_phone: t.delegate_phone || '',
            delegate_address: t.delegate_address || '',
            delegate_city: t.delegate_city || '',
            registration_pin: t.registration_pin || '',
            slug: t.slug || ''
        });
        setShowTeamForm(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleCancelEditTeam = () => {
        setEditingTeamId(null);
        setNewTeam({ name: '', admin_username: '', admin_password: '', delegate_document: '', delegate_name: '', delegate_email: '', registration_pin: '' });
        setShowTeamForm(false);
    };

    const handleCreateReferee = async (e) => {
        e.preventDefault();
        try {
            await refereeService.create(newReferee);
            setNewReferee({ document_number: '', full_name: '', age: '', phone: '', address: '' });
            setShowRefereeForm(false);
            showNotification('Árbitro registrado', 'success');
            loadData();
        } catch (err) {
            showNotification('Error al registrar árbitro', 'error');
        }
    };

    const handleDeleteReferee = async (id) => {
        const confirmed = await showConfirm({
            title: 'Eliminar Árbitro',
            message: '¿Estás seguro de eliminar a este árbitro? Esta acción no se puede deshacer.',
            type: 'warning'
        });
        if (!confirmed) return;
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
        try {
            await tournamentService.update(tournament.id, config);
            showNotification('Configuración de torneo actualizada con éxito', 'success');
            const leagueSlug = localStorage.getItem('adminTournamentSlug') || 'current';
            const tourRes = await tournamentService.get(leagueSlug);
            setTournament(tourRes.data);
        } catch (err) {
            showNotification('Error al actualizar la configuración', 'error');
            console.error(err);
        }
    };

    const handleAssetUpload = async (e, field) => {
        const file = e.target.files[0];
        if (!file) return;
        setUploading(true);
        try {
            const res = await settingsService.uploadFile(file);
            setConfig({ ...config, [field]: res.data.url });
            showNotification('Archivo cargado exitosamente', 'success');
        } catch (err) {
            showNotification('Error al cargar archivo', 'error');
        } finally {
            setUploading(false);
        }
    };

    const handleViewPlayers = async (team) => {
        try {
            setViewingTeamName(team.name);
            const res = await tournamentService.getTeamPlayers(team.id);
            setSelectedTeamPlayers(res.data);
            setShowPlayersModal(true);
            localStorage.setItem('viewingTeamId', team.id); // Guardamos para refrescar
        } catch (err) {
            showNotification('Error al cargar jugadores', 'error');
        }
    };

    const handleDeletePlayer = async (id) => {
        const confirmed = await showConfirm({
            title: 'Eliminar Jugador',
            message: '¿Estás seguro de eliminar a este jugador del equipo?',
            type: 'warning'
        });
        if (!confirmed) return;
        try {
            await tournamentService.deletePlayer(id);
            showNotification('Jugador eliminado', 'success');
            // Refrescar lista
            const teamId = localStorage.getItem('viewingTeamId');
            if (teamId) {
                const res = await tournamentService.getTeamPlayers(teamId);
                setSelectedTeamPlayers(res.data);
            }
        } catch (err) {
            showNotification('Error al eliminar jugador', 'error');
        }
    };

    const handleAssignVeedor = async (matchId, veedorId) => {
        try {
            await tournamentService.assignVeedor(matchId, veedorId);
            showNotification('Veedor asignado correctamente', 'success');
            loadData();
        } catch (err) {
            showNotification('Error al asignar veedor', 'error');
        }
    };

    const handleCreateVeedor = async (e) => {
        e.preventDefault();
        try {
            await tournamentService.createVeedor(tournamentId, newVeedor);
            showNotification('Veedor creado exitosamente', 'success');
            setNewVeedor({ username: '', password: '' });
            setShowVeedorForm(false);
            loadData();
        } catch (err) {
            showNotification(err.response?.data?.error || 'Error al crear veedor', 'error');
        }
    };

    const handleDeleteVeedor = async (id) => {
        const confirmed = await showConfirm({
            title: 'Eliminar Veedor',
            message: '¿Deseas eliminar permanentemente esta cuenta de veedor?',
            type: 'warning'
        });
        if (!confirmed) return;
        try {
            await tournamentService.deleteUser(id);
            showNotification('Veedor eliminado', 'success');
            loadData();
        } catch (err) {
            showNotification('Error al eliminar veedor', 'error');
        }
    };

    const handleResetTournament = async () => {
        const confirmed = await showConfirm({
            title: '💥 REINICIO TOTAL DEL TORNEO',
            message: '¡ADVERTENCIA CRÍTICA! Esta acción eliminará TODOS los partidos, grupos, fases y resultados del torneo. Los equipos se mantienen, pero todo el progreso se perderá para SIEMPRE.',
            type: 'error',
            confirmText: 'REINICIAR',
            confirmButtonText: 'REINICIAR TODO EL TORNEO',
            cancelButtonText: 'No, mantener datos'
        });

        if (!confirmed) return;

        try {
            const leagueSlug = localStorage.getItem('adminTournamentSlug') || 'current';
            await api.post(`/tournaments/${leagueSlug}/reset`);
            showNotification('Torneo reiniciado exitosamente. Puedes comenzar de nuevo.', 'success');
            setActiveTab('teams');
            loadData();
        } catch (err) {
            showNotification(err.response?.data?.error || 'No se pudo reiniciar el torneo', 'error');
        }
    };

    const handleLogout = () => {
        localStorage.clear();
        navigate('/login');
    };

    const [importing, setImporting] = useState(false);
    const handleImportMatches = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);
        setImporting(true);

        try {
            const res = await api.post(`/tournaments/${tournamentId}/import-matches`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            showNotification(res.data.message, 'success');
            if (res.data.errors && res.data.errors.length > 0) {
                console.warn('Import errors:', res.data.errors);
                showNotification(`Hubo ${res.data.errors.length} advertencias. Revisa la consola.`, 'warning');
            }
            loadData();
        } catch (err) {
            showNotification(err.response?.data?.error || 'Error al importar partidos', 'error');
        } finally {
            setImporting(false);
            e.target.value = null;
        }
    };

    if (loading) return <div className="loading">Cargando panel de torneo...</div>;

    return (
        <div className="admin-container">
            <aside className={`admin-sidebar ${isSidebarCollapsed ? 'collapsed' : ''}`}>
                <div className="admin-logo">
                    <Trophy size={28} color="var(--primary)" />
                    {!isSidebarCollapsed && <span>Admin Torneo</span>}
                </div>
                <nav className="admin-nav">
                    <button className={`nav-item ${activeTab === 'teams' ? 'active' : ''}`} onClick={() => setActiveTab('teams')} title="Equipos">
                        <Users size={20} /> {!isSidebarCollapsed && <span>Equipos</span>}
                    </button>
                    <button className={`nav-item ${activeTab === 'referees' ? 'active' : ''}`} onClick={() => setActiveTab('referees')} title="Árbitros">
                        <UserCheck size={20} /> {!isSidebarCollapsed && <span>Árbitros</span>}
                    </button>
                    <button className={`nav-item ${activeTab === 'fields' ? 'active' : ''}`} onClick={() => setActiveTab('fields')} title="Canchas y Sedes">
                        <Trophy size={20} style={{ color: 'var(--success)' }} /> {!isSidebarCollapsed && <span>Canchas / Sedes</span>}
                    </button>
                    <button className={`nav-item ${activeTab === 'stats' ? 'active' : ''}`} onClick={() => setActiveTab('stats')} title="Estadísticas">
                        <FileText size={20} style={{ color: 'var(--primary)' }} /> {!isSidebarCollapsed && <span>Estadísticas</span>}
                    </button>
                    <button className={`nav-item ${activeTab === 'posiciones' ? 'active' : ''}`} onClick={() => setActiveTab('posiciones')} title="Tabla de Posiciones">
                        <Trophy size={20} style={{ color: 'var(--primary)' }} /> {!isSidebarCollapsed && <span>Posiciones</span>}
                    </button>
                    <button className={`nav-item ${activeTab === 'phases' ? 'active' : ''}`} onClick={() => setActiveTab('phases')} title="Fases y Grupos">
                        <Network size={20} style={{ color: 'var(--primary)' }} /> {!isSidebarCollapsed && <span>Fases y Grupos</span>}
                    </button>
                    <button className={`nav-item ${activeTab === 'matches' ? 'active' : ''}`} onClick={() => setActiveTab('matches')} title="Partidos / Programación">
                        <Calendar size={20} style={{ color: 'var(--primary)' }} /> {!isSidebarCollapsed && <span>Partidos / Fixture</span>}
                    </button>
                    <button className={`nav-item ${activeTab === 'veedores' ? 'active' : ''}`} onClick={() => setActiveTab('veedores')} title="Veedores / Personal">
                        <UserCheck size={20} /> {!isSidebarCollapsed && <span>Veedores</span>}
                    </button>
                    <button className={`nav-item ${activeTab === 'config' ? 'active' : ''}`} onClick={() => setActiveTab('config')} title="Configuración">
                        <Settings size={20} /> {!isSidebarCollapsed && <span>Configuración</span>}
                    </button>
                    
                    <button className="nav-item collapse-toggle" onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} title={isSidebarCollapsed ? "Expandir" : "Contraer"}>
                        <ChevronRight size={20} style={{ transform: isSidebarCollapsed ? 'none' : 'rotate(180deg)', transition: '0.3s' }} />
                        {!isSidebarCollapsed && <span>Contraer</span>}
                    </button>

                    <button className="nav-item logout-btn" style={{ marginTop: 'auto', color: 'var(--error)' }} onClick={handleLogout} title="Cerrar Sesión">
                        <LogOut size={20} /> {!isSidebarCollapsed && <span>Cerrar Sesión</span>}
                    </button>
                </nav>
            </aside>

            <main className="admin-main">
                <header className="admin-header">
                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                        <div>
                            <h1>{tournament?.name || 'Mi Torneo'}</h1>
                            <p style={{ opacity: 0.7 }}>{tournament?.city || 'Sede por definir'}</p>
                        </div>
                        {tournament && (
                            <div className={`status-badge ${tournament.registration_open ? 'status-open' : 'status-closed'}`} style={{ padding: '0.5rem 1rem', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 'bold' }}>
                                {tournament.registration_open ? '● REGISTRO ABIERTO' : '● REGISTRO CERRADO'}
                            </div>
                        )}
                    </div>
                </header>

                <div className="admin-content">
                    {activeTab === 'teams' && (
                        <div className="animate-fade-in">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                                <h3>Gestión de Equipos ({teams.length})</h3>
                                <button className="btn btn-primary" onClick={() => setShowTeamForm(!showTeamForm)}>
                                    {showTeamForm ? 'Cerrar Formulario' : <><Plus size={18} /> Inscribir Equipo</>}
                                </button>
                            </div>

                            <div className="grid" style={{ gridTemplateColumns: showTeamForm ? '1fr 2fr' : '1fr', gap: '2rem' }}>
                                {showTeamForm && (
                                    <div className="glass" style={{ padding: '1.5rem' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <h4>{editingTeamId ? '📝 Editar Equipo' : 'Nuevo Equipo'}</h4>
                                        </div>
                                        <form onSubmit={handleCreateTeam} style={{ marginTop: '1.5rem' }}>
                                            <div className="form-group">
                                                <label className="label">Nombre del Equipo</label>
                                                <input 
                                                    type="text" className="input" required
                                                    value={newTeam.name}
                                                    onChange={(e) => setNewTeam({...newTeam, name: e.target.value})}
                                                    placeholder="Ej: Los Leones FC"
                                                />
                                            </div>

                                            <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', marginBottom: '1rem' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', color: 'var(--primary)' }}>
                                                    <UserCheck size={16} /> <h5 style={{ margin: 0 }}>Datos del Delegado</h5>
                                                </div>
                                                
                                                <div className="form-group">
                                                    <label className="label">Identificación (DNI/Cédula)</label>
                                                    <input 
                                                        type="text" className="input" required
                                                        value={newTeam.delegate_document}
                                                        onChange={(e) => setNewTeam({...newTeam, delegate_document: e.target.value})}
                                                    />
                                                </div>
                                                <div className="form-group">
                                                    <label className="label">Nombre Completo</label>
                                                    <input 
                                                        type="text" className="input" required
                                                        value={newTeam.delegate_name}
                                                        onChange={(e) => setNewTeam({...newTeam, delegate_name: e.target.value})}
                                                    />
                                                </div>
                                                <div className="form-group">
                                                    <label className="label">Teléfono de Contacto</label>
                                                    <input 
                                                        type="text" className="input" required
                                                        value={newTeam.delegate_phone}
                                                        onChange={(e) => setNewTeam({...newTeam, delegate_phone: e.target.value})}
                                                    />
                                                </div>
                                                <div className="form-group">
                                                    <label className="label">Correo Electrónico</label>
                                                    <input 
                                                        type="email" className="input" required
                                                        value={newTeam.delegate_email}
                                                        onChange={(e) => setNewTeam({...newTeam, delegate_email: e.target.value})}
                                                        placeholder="Sera el nombre de usuario"
                                                    />
                                                </div>
                                                <div className="form-group">
                                                    <label className="label">Ciudad</label>
                                                    <input 
                                                        type="text" className="input" required
                                                        value={newTeam.delegate_city}
                                                        onChange={(e) => setNewTeam({...newTeam, delegate_city: e.target.value})}
                                                    />
                                                </div>
                                                <div className="form-group">
                                                    <label className="label">Dirección / Dirección de residencia</label>
                                                    <input 
                                                        type="text" className="input" required
                                                        value={newTeam.delegate_address}
                                                        onChange={(e) => setNewTeam({...newTeam, delegate_address: e.target.value})}
                                                    />
                                                </div>
                                            </div>

                                            <div className="form-group">
                                                <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                                                    {editingTeamId ? 'Guardar Cambios' : 'Registrar Equipo y Generar Acceso'}
                                                </button>
                                                {editingTeamId && (
                                                    <button type="button" className="btn btn-secondary" onClick={handleCancelEditTeam} style={{ width: '100%', marginTop: '0.5rem' }}>
                                                        Cancelar
                                                    </button>
                                                )}
                                            </div>
                                        </form>
                                    </div>
                                )}
                                
                                <div className="glass table-container" style={{ padding: '0' }}>
                                    <table style={{ margin: '0' }}>
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
                                                    <td onClick={() => handleViewPlayers(t)} style={{ fontWeight: 600, cursor: 'pointer', color: 'var(--primary)' }} title="Click para ver jugadores">{t.name}</td>
                                                    <td><code>{t.admin_username || 'n/a'}</code></td>
                                                    <td style={{ display: 'flex', gap: '0.4rem' }}>
                                                        <button className="btn" title="Editar Equipo" style={{ padding: '0.4rem', background: 'rgba(56, 189, 248, 0.1)', color: 'var(--primary)' }} onClick={() => handleEditTeam(t)}>
                                                            <Edit2 size={16} />
                                                        </button>
                                                        <button className="btn" title="Ver Link de Registro" style={{ padding: '0.4rem', background: 'rgba(255,255,255,0.05)', color: 'white' }} onClick={() => navigate(`/${t.slug}/registro`)}>
                                                            <FileText size={16} />
                                                        </button>
                                                        <button className="btn" title="Eliminar Equipo" style={{ padding: '0.4rem', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--error)' }} onClick={async () => { 
                                                             const confirmed = await showConfirm({ title: 'Eliminar Equipo', message: `¿Estás seguro de eliminar a ${t.name}?`, type: 'warning' });
                                                             if (confirmed) { adminService.deleteTeam(t.id).then(loadData); }
                                                         }}>
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                            {teams.length === 0 && <tr><td colSpan="3" style={{ textAlign: 'center', padding: '2rem', opacity: 0.5 }}>No hay equipos registrados.</td></tr>}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'referees' && (
                        <div className="animate-fade-in">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                                <h3>Listado de Árbitros</h3>
                                <button className="btn btn-primary" onClick={() => setShowRefereeForm(!showRefereeForm)}>
                                    {showRefereeForm ? 'Cerrar Formulario' : <><Plus size={18} /> Registrar Árbitro</>}
                                </button>
                            </div>

                             <div className="grid" style={{ gridTemplateColumns: showRefereeForm ? '1fr 2fr' : '1fr', gap: '2rem' }}>
                                {showRefereeForm && (
                                    <div className="glass" style={{ padding: '1.5rem' }}>
                                        <h4>Nuevo Árbitro</h4>
                                        <form onSubmit={handleCreateReferee} style={{ marginTop: '1.5rem' }}>
                                            <div className="form-group">
                                                <label className="label">Número de Cédula</label>
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
                                            <div className="form-group">
                                                <label className="label">Teléfono</label>
                                                <input 
                                                    type="text" className="input"
                                                    value={newReferee.phone}
                                                    onChange={(e) => setNewReferee({...newReferee, phone: e.target.value})}
                                                />
                                            </div>
                                            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }}>
                                                Guardar Árbitro
                                            </button>
                                        </form>
                                    </div>
                                )}
                                <div className="glass table-container" style={{ padding: '0' }}>
                                    <table style={{ margin: '0' }}>
                                        <thead>
                                            <tr>
                                                <th>Cédula</th>
                                                <th>Nombre</th>
                                                <th>Teléfono</th>
                                                <th>Acciones</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {referees.map(r => (
                                                <tr key={r.id}>
                                                    <td><code>{r.document_number}</code></td>
                                                    <td style={{ fontWeight: 600 }}>{r.full_name}</td>
                                                    <td>{r.phone}</td>
                                                    <td style={{ display: 'flex', gap: '0.4rem' }}>
                                                        <button className="btn" title="Eliminar Árbitro" style={{ padding: '0.4rem', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--error)' }} onClick={() => handleDeleteReferee(r.id)}>
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                            {referees.length === 0 && <tr><td colSpan="4" style={{ textAlign: 'center', padding: '2rem', opacity: 0.5 }}>No hay árbitros registrados.</td></tr>}
                                        </tbody>
                                    </table>
                                </div>
                             </div>
                        </div>
                    )}

                    {activeTab === 'fields' && (
                        <div className="animate-fade-in">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                                <h3>Canchas y Sedes Globales</h3>
                                <button className="btn btn-primary" onClick={() => { setEditingFieldId(null); setNewField({name:'', address:''}); setShowFieldForm(!showFieldForm); }}>
                                    {showFieldForm ? 'Cerrar Formulario' : <><Plus size={18} /> Nueva Cancha</>}
                                </button>
                            </div>

                            <div className="grid" style={{ gridTemplateColumns: showFieldForm ? '1fr 2fr' : '1fr', gap: '2rem' }}>
                                {showFieldForm && (
                                    <div className="glass" style={{ padding: '1.5rem' }}>
                                        <h4>{editingFieldId ? 'Editar Sede' : 'Registrar Sede'}</h4>
                                        <form onSubmit={async (e) => {
                                            e.preventDefault();
                                            if (editingFieldId) {
                                                await api.put(`/fields/${editingFieldId}`, newField);
                                                showNotification('Sede actualizada', 'success');
                                            } else {
                                                await api.post('/fields', newField);
                                                showNotification('Sede creada', 'success');
                                            }
                                            setNewField({ name: '', address: '' });
                                            setEditingFieldId(null);
                                            setShowFieldForm(false);
                                            loadData();
                                        }} style={{ marginTop: '1.5rem' }}>
                                            <div className="form-group">
                                                <label className="label">Nombre de la Sede</label>
                                                <input type="text" className="input" required value={newField.name} onChange={e => setNewField({...newField, name: e.target.value})} />
                                            </div>
                                            <div className="form-group">
                                                <label className="label">Dirección / Ubicación</label>
                                                <input type="text" className="input" value={newField.address} onChange={e => setNewField({...newField, address: e.target.value})} />
                                            </div>
                                            <div style={{ display: 'flex', gap: '1rem' }}>
                                                <button type="submit" className="btn btn-success" style={{ flex: 1, marginTop: '1rem' }}>{editingFieldId ? 'Actualizar' : 'Guardar'}</button>
                                                {editingFieldId && <button type="button" className="btn btn-secondary" style={{ flex: 1, marginTop: '1rem' }} onClick={() => { setEditingFieldId(null); setShowFieldForm(false); }}>Cancelar</button>}
                                            </div>
                                        </form>
                                    </div>
                                )}
                                <div className="glass table-container" style={{ padding: '0' }}>
                                    <table style={{ margin: '0' }}>
                                        <thead>
                                            <tr>
                                                <th>Nombre</th>
                                                <th>Dirección</th>
                                                <th>Acciones</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {fields.map(f => (
                                                <tr key={f.id}>
                                                    <td style={{ fontWeight: 600 }}>{f.name}</td>
                                                    <td>
                                                        <div style={{ maxWidth: '300px', fontSize: '0.8rem', opacity: 0.7, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                            {f.address}
                                                        </div>
                                                    </td>
                                                    <td style={{ display: 'flex', gap: '0.5rem' }}>
                                                        <button className="btn" style={{ padding: '0.4rem', color: 'var(--primary)' }} onClick={() => { setEditingFieldId(f.id); setNewField({name: f.name, address: f.address}); setShowFieldForm(true); window.scrollTo({top:0, behavior:'smooth'}); }}>
                                                            <Edit2 size={16} />
                                                        </button>
                                                        <button className="btn" style={{ padding: '0.4rem', color: 'var(--error)' }} onClick={async () => { 
                                                             const confirmed = await showConfirm({ title: 'Eliminar Cancha', message: `¿Eliminar la sede ${f.name}?`, type: 'warning' });
                                                             if (confirmed) { await api.delete(`/fields/${f.id}`); loadData(); } 
                                                         }}>
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                            {fields.length === 0 && <tr><td colSpan="3" style={{ textAlign: 'center', padding: '2rem', opacity: 0.5 }}>No hay canchas registradas.</td></tr>}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'stats' && (
                        <div className="animate-fade-in">
                            <div style={{ marginBottom: '2rem' }}>
                                <h3>Centro de Estadísticas: {tournament?.name}</h3>
                                <p style={{ opacity: 0.6 }}>Resumen de rendimiento y disciplina.</p>
                            </div>

                            <div className="grid-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem' }}>
                                <div className="glass" style={{ padding: '2rem', textAlign: 'center', background: 'rgba(52, 211, 153, 0.1)' }}>
                                    <Users size={32} color="var(--success)" style={{ marginBottom: '1rem' }} />
                                    <h2 style={{ fontSize: '2.5rem' }}>{statsSummary.total_teams}</h2>
                                    <p style={{ opacity: 0.7, fontWeight: 600 }}>Equipos Inscritos</p>
                                </div>
                                <div className="glass" style={{ padding: '2rem', textAlign: 'center', background: 'rgba(59, 130, 246, 0.1)' }}>
                                    <Trophy size={32} color="var(--primary)" style={{ marginBottom: '1rem' }} />
                                    <h2 style={{ fontSize: '2.5rem' }}>{statsSummary.total_goals}</h2>
                                    <p style={{ opacity: 0.7, fontWeight: 600 }}>Goles Anotados</p>
                                </div>
                                <div className="glass" style={{ padding: '2rem', textAlign: 'center', background: 'rgba(239, 68, 68, 0.1)' }}>
                                    <Zap size={32} color="var(--error)" style={{ marginBottom: '1rem' }} />
                                    <h2 style={{ fontSize: '2.5rem' }}>{statsSummary.total_cards}</h2>
                                    <p style={{ opacity: 0.7, fontWeight: 600 }}>Tarjetas (A/R)</p>
                                </div>
                                <div className="glass" style={{ padding: '2rem', textAlign: 'center', background: 'rgba(139, 92, 246, 0.1)' }}>
                                    <Calendar size={32} color="#8b5cf6" style={{ marginBottom: '1rem' }} />
                                    <h2 style={{ fontSize: '2.5rem' }}>{statsSummary.finished_matches}</h2>
                                    <p style={{ opacity: 0.7, fontWeight: 600 }}>Juegos Terminados</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'posiciones' && (
                        <div className="animate-fade-in">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                                <div>
                                    <h3>Tablas de Posiciones Oficiales</h3>
                                    <p style={{ opacity: 0.6 }}>Actualización automática cada vez que se publica un resultado.</p>
                                </div>
                                <button className="btn btn-secondary" onClick={loadData}>Re-calcular</button>
                            </div>

                            {standings.map(group => (
                                <div key={group.id} className="glass" style={{ marginBottom: '2.5rem', padding: '1.5rem' }}>
                                    <div style={{ borderLeft: '4px solid var(--primary)', paddingLeft: '1rem', marginBottom: '1.5rem' }}>
                                        <h4 style={{ margin: 0 }}>{group.name}</h4>
                                    </div>
                                    <div className="table-container" style={{ margin: 0 }}>
                                        <table style={{ margin: 0 }}>
                                            <thead>
                                                <tr>
                                                    <th style={{ width: '40px' }}>#</th>
                                                    <th>Equipo</th>
                                                    <th style={{ textAlign: 'center' }}>PJ</th>
                                                    <th style={{ textAlign: 'center' }}>PG</th>
                                                    <th style={{ textAlign: 'center' }}>PE</th>
                                                    <th style={{ textAlign: 'center' }}>PP</th>
                                                    <th style={{ textAlign: 'center' }}>GF</th>
                                                    <th style={{ textAlign: 'center' }}>GC</th>
                                                    <th style={{ textAlign: 'center' }}>DIF</th>
                                                    <th style={{ textAlign: 'center', background: 'rgba(255,255,255,0.05)', color: 'var(--primary)', fontWeight: 800 }}>PTS</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {group.teams.map((team, idx) => (
                                                    <tr key={team.id}>
                                                        <td style={{ opacity: 0.5 }}>{idx + 1}</td>
                                                        <td style={{ fontWeight: 600 }}>{team.name}</td>
                                                        <td style={{ textAlign: 'center' }}>{team.pj}</td>
                                                        <td style={{ textAlign: 'center' }}>{team.pg}</td>
                                                        <td style={{ textAlign: 'center' }}>{team.pe}</td>
                                                        <td style={{ textAlign: 'center' }}>{team.pp}</td>
                                                        <td style={{ textAlign: 'center' }}>{team.gf}</td>
                                                        <td style={{ textAlign: 'center' }}>{team.gc}</td>
                                                        <td style={{ textAlign: 'center' }}>{team.dif}</td>
                                                        <td style={{ textAlign: 'center', background: 'rgba(255,255,255,0.05)', fontWeight: 800, color: 'var(--primary)' }}>{team.pts}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            ))}
                            {standings.length === 0 && (
                                <div className="glass" style={{ padding: '4rem', textAlign: 'center', opacity: 0.5 }}>
                                    No hay datos de posiciones disponibles todavía hay que organizar grupos.
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'matches' && (
                        <div className="animate-fade-in">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                                <h3>Programación de Partidos ({matches.length})</h3>
                                <div style={{ display: 'flex', gap: '1rem' }}>
                                    <a href="/api/uploads/plantilla_partidos.csv" download className="btn btn-secondary">
                                        <Download size={18} /> Plantilla
                                    </a>
                                    <label className="btn btn-primary" style={{ cursor: 'pointer' }}>
                                        <Upload size={18} /> {importing ? 'Importando...' : 'Importar Excel/CSV'}
                                        <input type="file" hidden accept=".csv,.xlsx,.xls" onChange={handleImportMatches} disabled={importing} />
                                    </label>
                                </div>
                            </div>

                            <div className="glass" style={{ overflow: 'hidden' }}>
                                <table className="admin-table">
                                    <thead>
                                        <tr>
                                            <th>Fecha</th>
                                            <th>Local</th>
                                            <th></th>
                                            <th>Visitante</th>
                                            <th>Campo</th>
                                            <th>Árbitro</th>
                                            <th>Veedor</th>
                                            <th>Estado</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {matches.map(m => (
                                            <tr key={m.id}>
                                                <td style={{ fontSize: '0.85rem' }}>{new Date(m.match_date).toLocaleString()}</td>
                                                <td style={{ fontWeight: 600 }}>{m.home_team}</td>
                                                <td style={{ textAlign: 'center', opacity: 0.5 }}>vs</td>
                                                <td style={{ fontWeight: 600 }}>{m.away_team}</td>
                                                <td style={{ fontSize: '0.85rem' }}>{m.location}</td>
                                                <td style={{ fontSize: '0.85rem' }}>{m.referee_name || 'Sin asignar'}</td>
                                                <td>
                                                    <select 
                                                        className="input" 
                                                        style={{ fontSize: '0.75rem', padding: '0.2rem', margin: 0 }}
                                                        value={m.veedor_id || ''}
                                                        onChange={(e) => {
                                                            console.log('Assigning veedor:', e.target.value, 'to match:', m.id);
                                                            handleAssignVeedor(m.id, e.target.value);
                                                        }}
                                                    >
                                                        <option value="">Sin asignar</option>
                                                        {veedores.map(v => (
                                                            <option key={v.id} value={v.id}>{v.username}</option>
                                                        ))}
                                                    </select>
                                                </td>
                                                <td>
                                                    <span className={`status-badge ${m.status === 'COMPLETED' ? 'status-closed' : 'status-open'}`} style={{ fontSize: '0.7rem' }}>
                                                        {m.status}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                        {matches.length === 0 && (
                                            <tr>
                                                <td colSpan="7" style={{ textAlign: 'center', padding: '3rem', opacity: 0.5 }}>
                                                    No hay partidos programados. ¡Usa la importación para cargar el fixture!
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {activeTab === 'veedores' && (
                        <div className="animate-fade-in">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                                <h3>Gestión de Veedores / Personal de Campo</h3>
                                <button className="btn btn-primary" onClick={() => setShowVeedorForm(!showVeedorForm)}>
                                    <Plus size={18} /> {showVeedorForm ? 'Cancelar' : 'Nuevo Veedor'}
                                </button>
                            </div>

                            {showVeedorForm && (
                                <div className="glass" style={{ padding: '1.5rem', marginBottom: '2rem', maxWidth: '500px' }}>
                                    <h4>Crear Cuenta de Veedor</h4>
                                    <p style={{ fontSize: '0.8rem', opacity: 0.6, marginBottom: '1rem' }}>
                                        El usuario tendrá el prefijo automático <strong>vdr_</strong>
                                    </p>
                                    <form onSubmit={handleCreateVeedor}>
                                        <div className="form-group">
                                            <label className="label">Nombre de Usuario (sin vdr_)</label>
                                            <input 
                                                type="text" className="input" placeholder="ej: juan_perez"
                                                value={newVeedor.username}
                                                onChange={e => setNewVeedor({...newVeedor, username: e.target.value})}
                                                required
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label className="label">Contraseña</label>
                                            <input 
                                                type="password" className="input" placeholder="Min 6 caracteres"
                                                value={newVeedor.password}
                                                onChange={e => setNewVeedor({...newVeedor, password: e.target.value})}
                                                required
                                            />
                                        </div>
                                        <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }}>
                                            Registrar Veedor
                                        </button>
                                    </form>
                                </div>
                            )}

                            <div className="glass" style={{ overflow: 'hidden' }}>
                                <table className="admin-table">
                                    <thead>
                                        <tr>
                                            <th>ID</th>
                                            <th>Usuario</th>
                                            <th style={{ textAlign: 'right' }}>Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {veedores.map(v => (
                                            <tr key={v.id}>
                                                <td>{v.id}</td>
                                                <td style={{ fontWeight: 600 }}>{v.username}</td>
                                                <td style={{ textAlign: 'right' }}>
                                                    <button 
                                                        onClick={() => handleDeleteVeedor(v.id)}
                                                        className="btn" 
                                                        style={{ color: 'var(--error)', background: 'none' }}
                                                        title="Eliminar Veedor"
                                                    >
                                                        <Trash2 size={18} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                        {veedores.length === 0 && (
                                            <tr>
                                                <td colSpan="3" style={{ textAlign: 'center', padding: '3rem', opacity: 0.5 }}>
                                                    No hay veedores registrados para este torneo.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {activeTab === 'config' && (
                        <div className="animate-fade-in">
                            <div style={{ marginBottom: '2rem' }}>
                                <h3>Configuración Avanzada del Torneo</h3>
                                <p style={{ opacity: 0.6 }}>Personaliza las reglas, identidad y cronograma de tu torneo.</p>
                            </div>

                            <form onSubmit={handleUpdateTournament}>
                                <div className="grid" style={{ gridTemplateColumns: '2fr 1fr', gap: '2rem' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                                        
                                        {/* Bloque 1: Reglas y Puntuación */}
                                        <div className="glass" style={{ padding: '2rem' }}>
                                            <h4 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary)' }}>
                                                <Zap size={20} /> Reglas y Puntuación
                                            </h4>
                                            <div className="grid-form" style={{ gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                                                <div className="form-group">
                                                    <label className="label">Puntos Victoria</label>
                                                    <input type="number" className="input" value={config.win_points} onChange={e => setConfig({...config, win_points: parseInt(e.target.value)})} />
                                                </div>
                                                <div className="form-group">
                                                    <label className="label">Puntos Empate</label>
                                                    <input type="number" className="input" value={config.draw_points} onChange={e => setConfig({...config, draw_points: parseInt(e.target.value)})} />
                                                </div>
                                                <div className="form-group">
                                                    <label className="label">Puntos Derrota</label>
                                                    <input type="number" className="input" value={config.loss_points} onChange={e => setConfig({...config, loss_points: parseInt(e.target.value)})} />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Bloque 2: Identidad y Branding */}
                                        <div className="glass" style={{ padding: '2rem' }}>
                                            <h4 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary)' }}>
                                                <Palette size={20} /> Identidad y Branding
                                            </h4>
                                            <div className="grid-form" style={{ gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
                                                <div className="form-group">
                                                    <label className="label">Color Primario</label>
                                                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                                        <input type="color" className="input" style={{ width: '60px', height: '45px', padding: '2px' }} value={config.primary_color} onChange={e => setConfig({...config, primary_color: e.target.value})} />
                                                        <input type="text" className="input" value={config.primary_color} onChange={e => setConfig({...config, primary_color: e.target.value})} placeholder="#000000" />
                                                    </div>
                                                </div>
                                                <div className="form-group">
                                                    <label className="label">Color Secundario</label>
                                                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                                        <input type="color" className="input" style={{ width: '60px', height: '45px', padding: '2px' }} value={config.secondary_color} onChange={e => setConfig({...config, secondary_color: e.target.value})} />
                                                        <input type="text" className="input" value={config.secondary_color} onChange={e => setConfig({...config, secondary_color: e.target.value})} placeholder="#000000" />
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="form-group">
                                                <label className="label">Descripción Pública del Torneo</label>
                                                <textarea 
                                                    className="input" style={{ minHeight: '120px' }}
                                                    placeholder="Describe de qué trata tu torneo, premios, etc."
                                                    value={config.description}
                                                    onChange={e => setConfig({...config, description: e.target.value})}
                                                ></textarea>
                                            </div>
                                        </div>

                                        {/* Bloque 3: Datos del Organizador */}
                                        <div className="glass" style={{ padding: '2rem' }}>
                                            <h4 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary)' }}>
                                                <Users size={20} /> Datos del Organizador / Representante
                                            </h4>
                                            <div className="grid-form" style={{ gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                                                <div className="form-group">
                                                    <label className="label">Identificación (NIT / ID)</label>
                                                    <input type="text" className="input" value={config.identification} onChange={e => setConfig({...config, identification: e.target.value})} />
                                                </div>
                                                <div className="form-group">
                                                    <label className="label">Nombre Representante</label>
                                                    <input type="text" className="input" value={config.representative_name} onChange={e => setConfig({...config, representative_name: e.target.value})} />
                                                </div>
                                                <div className="form-group">
                                                    <label className="label">Teléfono</label>
                                                    <input type="text" className="input" value={config.representative_phone} onChange={e => setConfig({...config, representative_phone: e.target.value})} />
                                                </div>
                                                <div className="form-group">
                                                    <label className="label">Dirección / Sede</label>
                                                    <input type="text" className="input" value={config.representative_address} onChange={e => setConfig({...config, representative_address: e.target.value})} />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Bloque 3: Fechas y Ubicación */}
                                        <div className="glass" style={{ padding: '2rem' }}>
                                            <h4 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary)' }}>
                                                <Calendar size={20} /> Cronograma y Ubicación
                                            </h4>
                                            <div className="grid-form" style={{ gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                                                <div className="form-group">
                                                    <label className="label">Ciudad Principal</label>
                                                    <input type="text" className="input" value={config.city} onChange={e => setConfig({...config, city: e.target.value})} />
                                                </div>
                                                <div className="form-group">
                                                    <label className="label">Nombre del Torneo (Visible)</label>
                                                    <input type="text" className="input" value={config.name} onChange={e => setConfig({...config, name: e.target.value})} />
                                                </div>
                                                <div className="form-group">
                                                    <label className="label">Fecha Inicio</label>
                                                    <input type="date" className="input" value={config.start_date} onChange={e => setConfig({...config, start_date: e.target.value})} />
                                                </div>
                                                <div className="form-group">
                                                    <label className="label">Fecha Finalización</label>
                                                    <input type="date" className="input" value={config.end_date} onChange={e => setConfig({...config, end_date: e.target.value})} />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                                        {/* Bloque 4: Recursos Visuales */}
                                        <div className="glass" style={{ padding: '2rem' }}>
                                            <h4 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary)' }}>
                                                <Upload size={20} /> Recursos
                                            </h4>
                                            <div className="form-group">
                                                <label className="label">Imagen de Portada</label>
                                                <input type="file" className="input" accept="image/*" onChange={e => handleAssetUpload(e, 'image_url')} />
                                                {config.image_url && <div style={{ marginTop: '1rem', borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
                                                    <img src={config.image_url} alt="Cover" style={{ width: '100%', height: '80px', objectFit: 'cover' }} />
                                                </div>}
                                            </div>
                                            <div className="form-group" style={{ marginTop: '1.5rem' }}>
                                                <label className="label">Reglamento PDF</label>
                                                <input type="file" className="input" accept=".pdf" onChange={e => handleAssetUpload(e, 'rules_pdf_url')} />
                                                {config.rules_pdf_url && <p style={{ fontSize: '0.75rem', color: 'var(--success)', marginTop: '0.5rem' }}>✓ PDF cargado correctamente</p>}
                                            </div>

                                            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '2rem', padding: '1rem' }} disabled={uploading}>
                                                <Save size={18} /> Guardar Configuración
                                            </button>
                                        </div>

                                        {/* Zona de Peligro */}
                                        <div style={{ border: '1px solid rgba(239, 68, 68, 0.2)', padding: '2rem', borderRadius: '16px', background: 'rgba(239, 68, 68, 0.05)' }}>
                                            <h4 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--error)' }}>
                                                <AlertTriangle size={20} /> Zona de Peligro
                                            </h4>
                                            <p style={{ fontSize: '0.85rem', opacity: 0.7, marginBottom: '1.5rem' }}>
                                                Estas acciones son irreversibles. Ten precaución.
                                            </p>
                                            <button 
                                                type="button"
                                                className="btn" 
                                                onClick={handleResetTournament}
                                                style={{ width: '100%', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--error)', border: '1px solid rgba(239, 68, 68, 0.2)' }}
                                            >
                                                Reiniciar Torneo
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </form>
                        </div>
                    )}

                    {activeTab === 'phases' && (
                        <TournamentPhases />
                    )}
                    {/* Modal de Jugadores */}
                    {/* Modal: Credenciales Generadas */}
                    {showCredentialsModal && generatedCredentials && (
                        <div className="modal-overlay">
                            <div className="modal-content glass animate-fade-in" style={{ maxWidth: '400px', textAlign: 'center' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
                                    <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(56, 189, 248, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <UserCheck size={32} color="var(--primary)" />
                                    </div>
                                    <h2 style={{ margin: 0 }}>¡Equipo Creado!</h2>
                                    <p style={{ opacity: 0.8, fontSize: '0.9rem' }}>Entrega estas credenciales al delegado para que pueda gestionar su equipo.</p>
                                </div>
                                
                                <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1.5rem', borderRadius: '12px', textAlign: 'left', marginBottom: '2rem', border: '1px solid rgba(255,255,255,0.1)' }}>
                                    <div style={{ marginBottom: '1rem' }}>
                                        <label style={{ fontSize: '0.75rem', opacity: 0.5, textTransform: 'uppercase', letterSpacing: '1px' }}>Nombre de Usuario</label>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.25rem' }}>
                                            <code style={{ fontSize: '1.1rem', color: 'var(--primary)' }}>{generatedCredentials.username}</code>
                                            <button 
                                                onClick={() => { navigator.clipboard.writeText(generatedCredentials.username); showNotification('Usuario copiado', 'success'); }}
                                                className="btn" style={{ padding: '0.4rem' }}
                                                type="button"
                                            >
                                                <Copy size={16} />
                                            </button>
                                        </div>
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '0.75rem', opacity: 0.5, textTransform: 'uppercase', letterSpacing: '1px' }}>Contraseña Temporal</label>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.25rem' }}>
                                            <code style={{ fontSize: '1.1rem', color: '#fbbf24' }}>{generatedCredentials.password}</code>
                                            <button 
                                                onClick={() => { navigator.clipboard.writeText(generatedCredentials.password); showNotification('Contraseña copiada', 'success'); }}
                                                className="btn" style={{ padding: '0.4rem' }}
                                                type="button"
                                            >
                                                <Copy size={16} />
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => setShowCredentialsModal(false)} type="button">
                                    Entendido, cerrar
                                </button>
                            </div>
                        </div>
                    )}

                    {showPlayersModal && (
                        <div className="modal-overlay" onClick={() => setShowPlayersModal(false)}>
                            <div className="glass modal-content animate-scale-up" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px', width: '90%' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                                    <h3>Jugadores de {viewingTeamName}</h3>
                                    <button className="btn-icon" onClick={() => setShowPlayersModal(false)}>✕</button>
                                </div>
                                <div className="players-list-scroll" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                                    {selectedTeamPlayers.length > 0 ? (
                                        <table className="admin-table">
                                            <thead>
                                                <tr>
                                                    <th>Dorsal</th>
                                                    <th>Nombre</th>
                                                    <th>Posición</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {selectedTeamPlayers.map(p => (
                                                    <tr key={p.id}>
                                                        <td><span className="badge-id">{p.uniform_number}</span></td>
                                                        <td>{p.full_name}</td>
                                                        <td>{p.position}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    ) : (
                                        <div style={{ textAlign: 'center', padding: '2rem', opacity: 0.6 }}>
                                            No hay jugadores inscritos en este equipo aún.
                                        </div>
                                    )}
                                </div>
                                <div style={{ marginTop: '1.5rem', textAlign: 'right' }}>
                                    <button className="btn btn-secondary" onClick={() => setShowPlayersModal(false)}>Cerrar</button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};

export default TournamentAdminPanel;
