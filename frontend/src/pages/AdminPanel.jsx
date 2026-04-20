import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, PieChart, Activity, RefreshCcw, LogOut, Edit2, Save, X, DollarSign, Palette, Settings, Users, Trophy } from 'lucide-react';
import { adminService, positionService, settingsService, costService, tournamentService } from '../services/api';
import { useNotification } from '../context/NotificationContext';

const AdminPanel = () => {
    const navigate = useNavigate();
    const { showNotification } = useNotification();
    const [stats, setStats] = useState(null);
    const [logs, setLogs] = useState([]);
    const [positions, setPositions] = useState([]);
    const [newPosition, setNewPosition] = useState('');
    const [editingId, setEditingId] = useState(null);
    const [editingName, setEditingName] = useState('');
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [adminRole, setAdminRole] = useState(localStorage.getItem('adminRole') || 'admin');
    const [activeTab, setActiveTab] = useState(localStorage.getItem('adminRole') === 'superadmin' ? 'teams' : 'stats');
    const [teams, setTeams] = useState([]);
    const [newTeam, setNewTeam] = useState({ name: '', slug: '', admin_username: '', admin_password: '', delegate_document: '', delegate_name: '', delegate_email: '', registration_pin: '' });
    const [editingTeamId, setEditingTeamId] = useState(null);
    const [selectedTeamPlayers, setSelectedTeamPlayers] = useState([]);
    const [showPlayersModal, setShowPlayersModal] = useState(false);
    const [viewingTeamName, setViewingTeamName] = useState('');
    const [settings, setSettings] = useState({
        team_name: '',
        team_logo_url: '',
        favicon_url: '',
        registration_pin: ''
    });
    const [costs, setCosts] = useState([]);
    const [newCost, setNewCost] = useState({ item_name: '', amount: '', is_mandatory: true });
    const [editingCostId, setEditingCostId] = useState(null);
    const [editingCostName, setEditingCostName] = useState('');
    const [editingCostAmount, setEditingCostAmount] = useState('');
    const [tournaments, setTournaments] = useState([]);
    const [newTournament, setNewTournament] = useState({ 
        name: '', 
        identification: '',
        representative_name: '',
        representative_phone: '',
        representative_address: '',
        city: '', 
        description: '', 
        image_url: '', 
        rules_pdf_url: '',
        admin_username: '', 
        admin_password: '',
        win_points: 3, draw_points: 1, loss_points: 0,
        start_date: '',
        end_date: ''
    });
    const [lookupLoading, setLookupLoading] = useState(false);
    const [editingTournamentId, setEditingTournamentId] = useState(null);

    const loadData = async () => {
        setLoading(true);
        try {
            if (adminRole === 'superadmin') {
                const [teamsRes, tournamentsRes] = await Promise.all([
                    adminService.getTeams(),
                    tournamentService.getAll()
                ]);
                setTeams(teamsRes.data);
                setTournaments(tournamentsRes.data);
            }

            // Only load team-specific data if there is a team associated
            const teamId = localStorage.getItem('adminTeamId');
            if (teamId) {
                const [statsRes, logsRes, posRes, settingsRes, costsRes] = await Promise.all([
                    adminService.getStats(),
                    adminService.getLogs(),
                    positionService.getAll(),
                    settingsService.get(),
                    costService.getAll()
                ]);
                setStats(statsRes.data);
                setLogs(logsRes.data);
                setPositions(posRes.data);
                setSettings(settingsRes.data);
                setCosts(costsRes.data);
            }
        } catch (err) {
            showNotification('Error al cargar datos del panel', 'error');
            console.error('Error loading admin data', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleAddPosition = async (e) => {
        e.preventDefault();
        if (!newPosition) return;
        try {
            await positionService.create(newPosition);
            setNewPosition('');
            showNotification('Posición creada con éxito', 'success');
            loadData();
        } catch (err) {
            showNotification('Error al crear posición', 'error');
        }
    };

    const handleStartEdit = (pos) => {
        setEditingId(pos.id);
        setEditingName(pos.name);
    };

    const handleCancelEdit = () => {
        setEditingId(null);
        setEditingName('');
    };

    const handleSaveEdit = async (id) => {
        if (!editingName) return;
        try {
            await positionService.update(id, editingName);
            setEditingId(null);
            setEditingName('');
            showNotification('Posición actualizada', 'success');
            loadData();
        } catch (err) {
            showNotification('Error al actualizar posición', 'error');
        }
    };

    const handleDeletePosition = async (id) => {
        const confirmed = await showConfirm({
            title: 'Eliminar Posición',
            message: '¿Estás seguro de eliminar esta posición? Solo funcionará si no hay jugadores asignados.',
            type: 'warning'
        });
        if (confirmed) {
            try {
                await positionService.delete(id);
                showNotification('Posición eliminada', 'success');
                loadData();
            } catch (err) {
                showNotification('No se puede eliminar: Probablemente hay jugadores asignados a esta posición.', 'warning');
            }
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('adminAuthenticated');
        navigate('/login');
    };

    const handleUpdateSettings = async (e) => {
        e.preventDefault();
        try {
            await settingsService.update({
                team_name: settings.team_name,
                team_logo_url: settings.team_logo_url,
                favicon_url: settings.favicon_url,
                registration_pin: settings.registration_pin
            });
            showNotification('Identidad del equipo actualizada con éxito', 'success');
            loadData();
        } catch (err) {
            showNotification('Error al actualizar la configuración', 'error');
            console.error('Error updating settings', err);
        }
    };

    const handleCreateTeam = async (e) => {
        e.preventDefault();
        try {
            if (editingTeamId) {
                await adminService.updateTeam(editingTeamId, newTeam);
                showNotification('Equipo actualizado con éxito', 'success');
            } else {
                await adminService.createTeam(newTeam);
                showNotification('Equipo y administrador creados con éxito', 'success');
            }
            setNewTeam({ name: '', slug: '', admin_username: '', admin_password: '', delegate_document: '', delegate_name: '', delegate_email: '', registration_pin: '' });
            setEditingTeamId(null);
            loadData();
        } catch (err) {
            showNotification(err.response?.data?.error || 'Error al guardar equipo', 'error');
        }
    };

    const handleEditTeam = (t) => {
        setEditingTeamId(t.id);
        setNewTeam({
            name: t.name || '', slug: t.slug || '', admin_username: t.admin_username || '', admin_password: '',
            delegate_document: t.delegate_document || '', delegate_name: t.delegate_name || '',
            delegate_email: t.delegate_email || '', registration_pin: t.registration_pin || ''
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleCancelEditTeam = () => {
        setEditingTeamId(null);
        setNewTeam({ name: '', slug: '', admin_username: '', admin_password: '', delegate_document: '', delegate_name: '', delegate_email: '', registration_pin: '' });
    };

    const handleLookupIdentification = async () => {
        if (!newTournament.identification) return;
        setLookupLoading(true);
        try {
            const res = await tournamentService.lookup(newTournament.identification);
            if (res.data) {
                setNewTournament(prev => ({
                    ...prev,
                    representative_name: res.data.representative_name || prev.representative_name,
                    representative_phone: res.data.representative_phone || prev.representative_phone,
                    representative_address: res.data.representative_address || prev.representative_address,
                    city: res.data.city || prev.city
                }));
                showNotification('Datos de representante precargados', 'success');
            }
        } catch (err) {
            // Silently fail if not found, it's expected for new IDs
            console.log("No previous data found for this ID");
        } finally {
            setLookupLoading(false);
        }
    };

    const handleCreateTournament = async (e) => {
        e.preventDefault();
        try {
            if (editingTournamentId) {
                await tournamentService.update(editingTournamentId, newTournament);
                showNotification('Torneo actualizado exitosamente', 'success');
            } else {
                await tournamentService.create(newTournament);
                showNotification('Torneo creado exitosamente', 'success');
            }
            
            setNewTournament({ 
                name: '', 
                identification: '',
                representative_name: '',
                representative_phone: '',
                representative_address: '',
                city: '', 
                description: '', 
                image_url: '', 
                rules_pdf_url: '',
                admin_username: '', 
                admin_password: '',
                win_points: 3, 
                draw_points: 1, 
                loss_points: 0,
                start_date: '',
                end_date: ''
            });
            setEditingTournamentId(null);
            loadData();
        } catch (err) {
            showNotification(editingTournamentId ? 'Error al actualizar torneo' : 'Error al crear torneo', 'error');
        }
    };

    const handleEditTournament = (t) => {
        setEditingTournamentId(t.id);
        setNewTournament({
            name: t.name || '', city: t.city || '', description: t.description || '',
            image_url: t.image_url || '', rules_pdf_url: t.rules_pdf_url || '',
            admin_username: t.admin_username || '', admin_password: '', // blank for security, update only if filled
            win_points: t.win_points || 3, draw_points: t.draw_points || 1, loss_points: t.loss_points || 0
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleCancelEditTournament = () => {
        setEditingTournamentId(null);
        setNewTournament({ 
            name: '', 
            identification: '',
            representative_name: '',
            representative_phone: '',
            representative_address: '',
            city: '', 
            description: '', 
            image_url: '', 
            rules_pdf_url: '',
            admin_username: '', 
            admin_password: '',
            win_points: 3, 
            draw_points: 1, 
            loss_points: 0,
            start_date: '',
            end_date: ''
        });
    };

    const handleTournamentAssetUpload = async (e, field) => {
        const file = e.target.files[0];
        if (!file) return;
        setUploading(true);
        try {
            const res = await settingsService.uploadFile(file);
            setNewTournament({ ...newTournament, [field]: res.data.url });
            showNotification('Archivo cargado', 'success');
        } catch (err) {
            showNotification('Error al cargar archivo', 'error');
        } finally {
            setUploading(false);
        }
    };

    const handleAssignTournament = async (teamId, tournamentId) => {
        try {
            await tournamentService.assignTeam(teamId, tournamentId);
            showNotification('Equipo asignado correctamente', 'success');
            loadData();
        } catch (err) {
            showNotification('Error al asignar equipo', 'error');
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
        if (!window.confirm('¿Estás seguro de eliminar a este jugador?')) return;
        try {
            await playerService.delete(id);
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

    const handleLogoUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setUploading(true);
        try {
            const res = await settingsService.uploadLogo(file);
            setSettings({ ...settings, team_logo_url: res.data.url });
            showNotification('Logo cargado con éxito. Recuerda guardar los cambios.', 'info');
        } catch (err) {
            showNotification('Error al subir el logo', 'error');
        } finally {
            setUploading(false);
        }
    };

    const handleFaviconUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setUploading(true);
        try {
            const res = await settingsService.uploadLogo(file);
            setSettings({ ...settings, favicon_url: res.data.url });
            showNotification('Favicon cargado con éxito. Recuerda guardar los cambios.', 'info');
        } catch (err) {
            showNotification('Error al subir el favicon', 'error');
        } finally {
            setUploading(false);
        }
    };

    const handleAddCost = async () => {
        if (!newCost.item_name || !newCost.amount) return;
        try {
            await costService.create(newCost);
            const res = await costService.getAll();
            setCosts(res.data);
            setNewCost({ item_name: '', amount: '', is_mandatory: true });
            showNotification('Costo añadido correctamente', 'success');
        } catch (err) {
            showNotification('Error al añadir costo', 'error');
            console.error('Error adding cost', err);
        }
    };

    const handleDeleteTournament = async (id) => {
        const confirmed = await showConfirm({
            title: 'Eliminar Torneo',
            message: '¿ESTÁS SEGURO? Se eliminarán todos los datos asociados.',
            type: 'error',
            confirmButtonText: 'Eliminar Permanente'
        });
        if (!confirmed) return;
        try {
            await tournamentService.delete(id);
            showNotification('Torneo eliminado', 'success');
            loadData();
        } catch (err) {
            showNotification('Error al eliminar torneo', 'error');
        }
    };

    const handleDeleteCost = async (id) => {
        const confirmed = await showConfirm({
            title: 'Eliminar Costo',
            message: '¿Eliminar este costo?',
            type: 'error',
            confirmButtonText: 'Eliminar'
        });
        if (!confirmed) return;
        try {
            await costService.delete(id);
            setCosts(costs.filter(c => c.id !== id));
            showNotification('Costo eliminado', 'success');
        } catch (err) {
            showNotification('Error al eliminar costo', 'error');
            console.error('Error deleting cost', err);
        }
    };

    const handleStartEditCost = (cost) => {
        setEditingCostId(cost.id);
        setEditingCostName(cost.name);
        setEditingCostAmount(cost.amount);
    };

    const handleCancelEditCost = () => {
        setEditingCostId(null);
        setEditingCostName('');
        setEditingCostAmount('');
    };

    const handleSaveEditCost = async (id) => {
        if (!editingCostName || !editingCostAmount) return;
        try {
            await costService.update(id, { item_name: editingCostName, amount: editingCostAmount });
            setEditingCostId(null);
            showNotification('Costo actualizado correctamente', 'success');
            loadData();
        } catch (err) {
            showNotification('Error al actualizar costo', 'error');
            console.error('Error updating cost', err);
        }
    };

    return (
        <div className="animate-fade-in">
            <div className="flex-responsive" style={{ marginBottom: '2rem' }}>
                <div>
                    <h1>Panel de Administración</h1>
                    <p style={{ color: 'var(--text-muted)' }}>Gestión de configuraciones, estadísticas y auditoría.</p>
                </div>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                    <button className="btn btn-primary" onClick={() => navigate('/players')}>
                        <Users size={18} /> Gestionar Jugadores
                    </button>
                    <button className="btn btn-secondary" onClick={loadData}>
                        <RefreshCcw size={18} /> Actualizar
                    </button>
                    <button className="btn btn-secondary" style={{ color: 'var(--error)' }} onClick={handleLogout} title="Cerrar Sesión">
                        <LogOut size={18} />
                    </button>
                </div>
            </div>

            {loading ? (
                <div style={{ padding: '4rem', textAlign: 'center' }}>
                    <RefreshCcw size={48} className="animate-spin" style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
                    <p>Cargando información del sistema...</p>
                </div>
            ) : (
                <>
                    {/* Tabs Navigation */}
                    <div className="tabs-container">
                            {adminRole === 'superadmin' && (
                                <>
                                    <button 
                                        className={`tab ${activeTab === 'teams' ? 'active' : ''}`}
                                        onClick={() => setActiveTab('teams')}
                                    >
                                        <Users size={18} /> Equipos
                                    </button>
                                    <button 
                                        className={`tab ${activeTab === 'tournaments' ? 'active' : ''}`}
                                        onClick={() => setActiveTab('tournaments')}
                                    >
                                        <Trophy size={18} /> Torneos
                                    </button>
                                </>
                            )}
                        {localStorage.getItem('adminTeamId') && (
                            <>
                                <button
                                    className={`btn ${activeTab === 'stats' ? 'btn-primary' : 'btn-secondary'}`}
                                    onClick={() => setActiveTab('stats')}
                                    style={{ whiteSpace: 'nowrap' }}
                                >
                                    <Activity size={18} /> Estadísticas
                                </button>
                                <button
                                    className={`btn ${activeTab === 'finances' ? 'btn-primary' : 'btn-secondary'}`}
                                    onClick={() => setActiveTab('finances')}
                                    style={{ whiteSpace: 'nowrap' }}
                                >
                                    <DollarSign size={18} /> Recaudo
                                </button>
                                <button
                                    className={`btn ${activeTab === 'branding' ? 'btn-primary' : 'btn-secondary'}`}
                                    onClick={() => setActiveTab('branding')}
                                    style={{ whiteSpace: 'nowrap' }}
                                >
                                    <Palette size={18} /> Personalización
                                </button>
                            </>
                        )}
                    </div>

                    {activeTab === 'teams' && adminRole === 'superadmin' && (
                        <div className="animate-fade-in">
                            <div className="grid-form" style={{ gap: '2rem' }}>
                                <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                                        <h3>{editingTeamId ? '📝 Editar Equipo' : 'Crear Nuevo Equipo'}</h3>
                                        {editingTeamId && (
                                            <button type="button" className="btn btn-secondary" onClick={handleCancelEditTeam} style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}>
                                                Cancelar
                                            </button>
                                        )}
                                    </div>
                                    <form onSubmit={handleCreateTeam} className="glass" style={{ padding: '2rem' }}>
                                        <div className="form-group">
                                            <label className="label">Nombre del Equipo</label>
                                            <input
                                                type="text"
                                                className="input"
                                                placeholder="Ej: Junior FC"
                                                value={newTeam.name}
                                                onChange={(e) => setNewTeam({ ...newTeam, name: e.target.value })}
                                                required
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label className="label">Slug (URL)</label>
                                            <input
                                                type="text"
                                                className="input"
                                                placeholder="Ej: junior"
                                                value={newTeam.slug}
                                                onChange={(e) => setNewTeam({ ...newTeam, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
                                                required
                                            />
                                            <small style={{ color: 'var(--text-muted)' }}>Manda a los jugadores aquí: localhost:3000/{newTeam.slug || '...'}/registro</small>
                                        </div>
                                        <hr style={{ margin: '1.5rem 0', opacity: 0.1 }} />
                                        <div className="form-group">
                                            <label className="label">Usuario Administrador</label>
                                            <input
                                                type="text"
                                                className="input"
                                                placeholder="Username"
                                                value={newTeam.admin_username}
                                                onChange={(e) => setNewTeam({ ...newTeam, admin_username: e.target.value })}
                                                required
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label className="label">Contraseña Administrador</label>
                                            <input
                                                type="password"
                                                className="input"
                                                placeholder="Password"
                                                value={newTeam.admin_password}
                                                onChange={(e) => setNewTeam({ ...newTeam, admin_password: e.target.value })}
                                                required={!editingTeamId}
                                            />
                                        </div>
                                        <hr style={{ margin: '1.5rem 0', opacity: 0.1 }} />
                                        <h4 style={{ marginBottom: '1rem', color: 'var(--primary)' }}>Datos del Representante</h4>
                                        <div className="form-group">
                                            <label className="label">Documento Identidad</label>
                                            <input
                                                type="text" className="input" placeholder="Ej: 1100223344"
                                                value={newTeam.delegate_document || ''}
                                                onChange={(e) => setNewTeam({ ...newTeam, delegate_document: e.target.value })}
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label className="label">Nombre del Representante</label>
                                            <input
                                                type="text" className="input" placeholder="Ej: Carlos Valderrama"
                                                value={newTeam.delegate_name || ''}
                                                onChange={(e) => setNewTeam({ ...newTeam, delegate_name: e.target.value })}
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label className="label">Correo Válido (Email)</label>
                                            <input
                                                type="email" className="input" placeholder="Ej: admin@equipo.com"
                                                value={newTeam.delegate_email || ''}
                                                onChange={(e) => setNewTeam({ ...newTeam, delegate_email: e.target.value })}
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label className="label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                PIN de Registro Jugadores <span>(Opcional)</span>
                                            </label>
                                            <input 
                                                type="text" className="input" placeholder="Ej: 1234" maxLength="4"
                                                value={newTeam.registration_pin || ''}
                                                onChange={(e) => setNewTeam({...newTeam, registration_pin: e.target.value.replace(/\D/g, '').slice(0, 4)})}
                                            />
                                        </div>
                                        <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }}>
                                            {editingTeamId ? 'Guardar Cambios' : <><Plus size={18} /> Crear Equipo e Inicializar</>}
                                        </button>
                                    </form>
                                </div>
                                <div>
                                    <h3 style={{ marginBottom: '1.5rem' }}>Equipos Existentes</h3>
                                    <div className="glass table-container">
                                        <table>
                                            <thead>
                                                <tr>
                                                    <th>Nombre</th>
                                                    <th>Link de Registro</th>
                                                    <th>Admin Usuario</th>
                                                    <th>Torneo Asignado</th>
                                                    <th>Acciones</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {teams.map(team => (
                                                    <tr key={team.id}>
                                                        <td 
                                                            onClick={() => handleViewPlayers(team)}
                                                            style={{ fontWeight: 600, cursor: 'pointer', color: 'var(--primary)' }}
                                                            title="Ver jugadores"
                                                        >
                                                            {team.name}
                                                        </td>
                                                        <td><code>/{team.slug}</code></td>
                                                        <td>{team.admin_username}</td>
                                                        <td>
                                                            <select 
                                                                className="select"
                                                                style={{ padding: '0.25rem', fontSize: '0.85rem' }}
                                                                value={team.tournament_id || ''}
                                                                onChange={(e) => handleAssignTournament(team.id, e.target.value)}
                                                            >
                                                                <option value="">Sin Torneo</option>
                                                                {tournaments.map(t => (
                                                                    <option key={t.id} value={t.id}>{t.name}</option>
                                                                ))}
                                                            </select>
                                                        </td>
                                                        <td style={{ display: 'flex', gap: '0.5rem' }}>
                                                            <button className="btn btn-primary" style={{ padding: '0.4rem', fontSize: '0.8rem' }} onClick={() => handleEditTeam(team)}>
                                                                Editar
                                                            </button>
                                                            <button className="btn btn-secondary" style={{ padding: '0.4rem', fontSize: '0.8rem' }} onClick={() => navigate(`/${team.slug}/registro`)}>
                                                                Ver Link Registro
                                                            </button>
                                                            <button className="btn btn-secondary" style={{ padding: '0.4rem' }} onClick={() => handleDeleteTeam(team.id)}>
                                                                <Trash2 size={14} color="var(--error)" />
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

                    {activeTab === 'tournaments' && adminRole === 'superadmin' && (
                        <div className="animate-fade-in">
                            <h2 style={{ marginBottom: '1.5rem' }}>🏆 Gestión de Torneos</h2>
                            <div className="glass" style={{ padding: '2rem', marginBottom: '2rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                                    <h3 style={{ margin: 0 }}>{editingTournamentId ? '📝 Editar Torneo' : 'Crear Nuevo Torneo Profesional'}</h3>
                                    {editingTournamentId && (
                                        <button type="button" className="btn btn-secondary" onClick={handleCancelEditTournament} style={{ padding: '0.5rem 1rem' }}>
                                            Cancelar Edición
                                        </button>
                                    )}
                                </div>
                                <form onSubmit={handleCreateTournament}>
                                    {/* Sección Identidad del Cliente */}
                                    <h4 style={{ marginBottom: '1.5rem', color: 'var(--primary)', opacity: 0.8, fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '1px', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <Users size={18} /> Datos de la Entidad / Organizador
                                    </h4>
                                    <div className="grid-form" style={{ gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
                                        <div className="form-group" style={{ position: 'relative' }}>
                                            <label className="label">Identificación (ID / NIT)</label>
                                            <input 
                                                type="text" className="input" placeholder="Ingresa ID para autocompletar..." required
                                                value={newTournament.identification}
                                                onChange={(e) => setNewTournament({...newTournament, identification: e.target.value})}
                                                onBlur={handleLookupIdentification}
                                                disabled={lookupLoading}
                                            />
                                            {lookupLoading && (
                                                <div style={{ position: 'absolute', right: '10px', top: '38px' }}>
                                                    <RefreshCcw size={18} color="var(--primary)" className="animate-spin" />
                                                </div>
                                            )}
                                        </div>
                                        <div className="form-group">
                                            <label className="label">Nombre del Representante</label>
                                            <input 
                                                type="text" className="input" placeholder="Representante Legal" required
                                                value={newTournament.representative_name}
                                                onChange={(e) => setNewTournament({...newTournament, representative_name: e.target.value})}
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label className="label">Teléfono de Contacto</label>
                                            <input 
                                                type="text" className="input" placeholder="+57 3..." required
                                                value={newTournament.representative_phone}
                                                onChange={(e) => setNewTournament({...newTournament, representative_phone: e.target.value})}
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label className="label">Dirección / Sede principal</label>
                                            <input 
                                                type="text" className="input" placeholder="Av. Principal #123" required
                                                value={newTournament.representative_address}
                                                onChange={(e) => setNewTournament({...newTournament, representative_address: e.target.value})}
                                            />
                                        </div>
                                    </div>

                                    {/* Sección Datos del Torneo */}
                                    <h4 style={{ marginBottom: '1.5rem', color: 'var(--primary)', opacity: 0.8, fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '1px', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <Trophy size={18} /> Especificaciones del Torneo 
                                    </h4>
                                    <div className="grid-form" style={{ gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
                                        <div className="form-group">
                                            <label className="label">Nombre del Torneo</label>
                                            <input 
                                                type="text" className="input" placeholder="Ej: Copa Master 2026" required
                                                value={newTournament.name}
                                                onChange={(e) => setNewTournament({...newTournament, name: e.target.value})}
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label className="label">Ciudad de ejecución</label>
                                            <input 
                                                type="text" className="input" placeholder="Ej: Santiago de Cali" required
                                                value={newTournament.city}
                                                onChange={(e) => setNewTournament({...newTournament, city: e.target.value})}
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label className="label">Fecha Inicio</label>
                                            <input 
                                                type="date" className="input" required
                                                value={newTournament.start_date}
                                                onChange={(e) => setNewTournament({...newTournament, start_date: e.target.value})}
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label className="label">Fecha Finalización</label>
                                            <input 
                                                type="date" className="input" required
                                                value={newTournament.end_date}
                                                onChange={(e) => setNewTournament({...newTournament, end_date: e.target.value})}
                                            />
                                        </div>
                                    </div>

                                    {/* Acceso Administrativo */}
                                    <h4 style={{ marginBottom: '1.5rem', color: 'var(--primary)', opacity: 0.8, fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '1px', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <Settings size={18} /> Acceso del Administrador
                                    </h4>
                                    <div className="grid-form" style={{ gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
                                        <div className="form-group">
                                            <label className="label">Usuario Administrador</label>
                                            <input 
                                                type="text" className="input" placeholder="admin.copa2026" required
                                                value={newTournament.admin_username}
                                                onChange={(e) => setNewTournament({...newTournament, admin_username: e.target.value})}
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label className="label">Contraseña inicial</label>
                                            <input 
                                                type="password" className="input" required={!editingTournamentId}
                                                placeholder={editingTournamentId ? "En blanco para mantener" : "Mínimo 6 caracteres"}
                                                value={newTournament.admin_password}
                                                onChange={(e) => setNewTournament({...newTournament, admin_password: e.target.value})}
                                            />
                                        </div>
                                    </div>

                                    <div style={{ textAlign: 'right' }}>
                                        <button type="submit" className="btn btn-primary" style={{ padding: '1rem 3rem' }} disabled={uploading}>
                                            <Plus size={20} /> {editingTournamentId ? 'Actualizar Torneo' : 'Crear Torneo Profesional'}
                                        </button>
                                    </div>
                                </form>
                            </div>

                            <div className="glass table-container">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Nombre</th>
                                            <th>Admin</th>
                                            <th>Slug (URL)</th>
                                            <th>Puntos (V/E/D)</th>
                                            <th>Fecha Creación</th>
                                            <th>Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {tournaments.length === 0 ? (
                                            <tr><td colSpan="6" style={{ textAlign: 'center', padding: '2rem' }}>No hay torneos creados.</td></tr>
                                        ) : tournaments.map(t => (
                                            <tr key={t.id}>
                                                <td style={{ fontWeight: 600 }}>{t.name}</td>
                                                <td style={{ fontSize: '0.85rem', color: 'var(--primary)' }}>{t.admin_username || '---'}</td>
                                                <td><code>/{t.slug}</code></td>
                                                <td>{t.win_points}/{t.draw_points}/{t.loss_points}</td>
                                                <td style={{ fontSize: '0.85rem' }}>{new Date(t.created_at).toLocaleDateString()}</td>
                                                <td>
                                                    <button className="btn btn-primary" style={{ padding: '0.4rem', fontSize: '0.8rem' }} onClick={() => handleEditTournament(t)}>
                                                        Editar
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {activeTab === 'stats' && (
                        <div className="animate-fade-in">
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginBottom: '3rem' }}>
                                <div className="glass" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                    <div style={{ background: 'rgba(79, 172, 254, 0.2)', padding: '1rem', borderRadius: '1rem' }}>
                                        <PieChart size={32} color="var(--primary)" />
                                    </div>
                                    <div>
                                        <div className="label">Total Jugadores</div>
                                        <div style={{ fontSize: '2rem', fontWeight: 800 }}>{stats?.total_players || 0}</div>
                                    </div>
                                </div>
                                <div className="glass" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                    <div style={{ background: 'rgba(34, 197, 94, 0.2)', padding: '1rem', borderRadius: '1rem' }}>
                                        <Activity size={32} color="var(--success)" />
                                    </div>
                                    <div>
                                        <div className="label">Números Disponibles</div>
                                        <div style={{ fontSize: '2rem', fontWeight: 800 }}>{stats?.available_numbers || 0}</div>
                                    </div>
                                </div>
                            </div>

                            <div className="grid-form" style={{ gap: '2rem' }}>
                                {/* Positions Management */}
                                <div>
                                    <h3 style={{ marginBottom: '1.5rem' }}>Gestionar Posiciones</h3>
                                    <form onSubmit={handleAddPosition} className="glass" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
                                        <div className="form-group">
                                            <label className="label">Nueva Posición</label>
                                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                <input
                                                    type="text"
                                                    className="input"
                                                    placeholder="Ej: Volante mixto"
                                                    value={newPosition}
                                                    onChange={(e) => setNewPosition(e.target.value)}
                                                />
                                                <button type="submit" className="btn btn-primary" style={{ padding: '0.75rem' }}>
                                                    <Plus size={20} />
                                                </button>
                                            </div>
                                        </div>
                                    </form>

                                    <div className="glass" style={{ padding: '1rem' }}>
                                        <ul style={{ listStyle: 'none' }}>
                                            {positions.map(pos => (
                                                <li key={pos.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', borderBottom: '1px solid var(--glass-border)' }}>
                                                    {editingId === pos.id ? (
                                                        <div style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
                                                            <input
                                                                type="text"
                                                                className="input"
                                                                style={{ padding: '0.5rem' }}
                                                                value={editingName}
                                                                onChange={(e) => setEditingName(e.target.value)}
                                                                autoFocus
                                                            />
                                                            <button className="btn btn-primary" style={{ padding: '0.5rem' }} onClick={() => handleSaveEdit(pos.id)}>
                                                                <Save size={16} />
                                                            </button>
                                                            <button className="btn btn-secondary" style={{ padding: '0.5rem' }} onClick={handleCancelEdit}>
                                                                <X size={16} />
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <span>{pos.name}</span>
                                                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                                <button
                                                                    onClick={() => handleStartEdit(pos)}
                                                                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                                                                    title="Editar"
                                                                >
                                                                    <Edit2 size={16} />
                                                                </button>
                                                                <button
                                                                    onClick={() => handleDeletePosition(pos.id)}
                                                                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                                                                    title="Eliminar"
                                                                >
                                                                    <Trash2 size={16} />
                                                                </button>
                                                            </div>
                                                        </>
                                                    )}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>

                                {/* Audit Logs */}
                                <div>
                                    <h3 style={{ marginBottom: '1.5rem' }}>Logs de Actividad</h3>
                                    <div className="glass table-container" style={{ maxHeight: '500px', overflowY: 'auto' }}>
                                        <table>
                                            <thead>
                                                <tr>
                                                    <th>Acción</th>
                                                    <th>Detalles</th>
                                                    <th>Fecha</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {logs.map(log => (
                                                    <tr key={log.id}>
                                                        <td style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                                                            <span style={{
                                                                color: log.action.includes('DELETE') ? 'var(--error)' : 'var(--primary)'
                                                            }}>
                                                                {log.action}
                                                            </span>
                                                        </td>
                                                        <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{log.details}</td>
                                                        <td style={{ fontSize: '0.75rem', whiteSpace: 'nowrap' }}>{new Date(log.created_at).toLocaleString()}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'finances' && (
                        <div className="animate-fade-in">
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                                <div className="glass" style={{ padding: '2rem', textAlign: 'center' }}>
                                    <div className="label">Total Recaudado</div>
                                    <div style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--success)', margin: '0.5rem 0' }}>
                                        ${stats?.total_revenue?.toLocaleString()}
                                    </div>
                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Ingresos reales en caja</div>
                                </div>
                                <div className="glass" style={{ padding: '2rem', textAlign: 'center' }}>
                                    <div className="label">Pendiente por Cobrar</div>
                                    <div style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--error)', margin: '0.5rem 0' }}>
                                        ${stats?.total_pending?.toLocaleString()}
                                    </div>
                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Basado en cargos obligatorios</div>
                                </div>
                                <div className="glass" style={{ padding: '2rem', textAlign: 'center' }}>
                                    <div className="label">Proyección Total</div>
                                    <div style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--primary)', margin: '0.5rem 0' }}>
                                        ${stats?.total_expected?.toLocaleString()}
                                    </div>
                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Meta final de recaudo</div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'branding' && (
                        <div className="animate-fade-in glass" style={{ padding: '2rem' }}>
                            <form onSubmit={handleUpdateSettings}>
                                <div className="grid-form" style={{ gap: '2rem' }}>
                                    <div>
                                        <h3 style={{ marginBottom: '0.5rem' }}>Identidad del Equipo</h3>
                                        <div style={{ padding: '1rem', background: 'rgba(56, 189, 248, 0.1)', borderRadius: '8px', borderLeft: '4px solid var(--primary)', marginBottom: '1.5rem' }}>
                                            <strong style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--primary)' }}>🔗 Link de Inscripción de Jugadores:</strong>
                                            <code style={{ fontSize: '1rem' }}>
                                                http://localhost:3000/{localStorage.getItem('adminTeamSlug') || '...'}/registro
                                            </code>
                                        </div>
                                        <div className="form-group">
                                            <label className="label">Nombre del Equipo</label>
                                            <input
                                                type="text"
                                                className="input"
                                                value={settings.team_name || ''}
                                                onChange={(e) => setSettings({ ...settings, team_name: e.target.value })}
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label className="label">PIN de Registro de Jugadores</label>
                                            <input
                                                type="text"
                                                className="input"
                                                placeholder="Ej: 1234"
                                                maxLength="4"
                                                value={settings.registration_pin || ''}
                                                onChange={(e) => setSettings({ ...settings, registration_pin: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                                            />
                                            <small style={{ color: 'var(--text-muted)' }}>Déjalo vacío si no quieres exigir PIN para la inscripción.</small>
                                        </div>
                                        <div className="form-group">
                                            <label className="label">Logo del Equipo</label>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                                {settings.team_logo_url && (
                                                    <div className="glass" style={{ padding: '1rem', textAlign: 'center' }}>
                                                        <img src={settings.team_logo_url} alt="Preview" style={{ maxHeight: '100px', maxWidth: '100%', borderRadius: '8px' }} />
                                                    </div>
                                                )}
                                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                    <input
                                                        type="text"
                                                        className="input"
                                                        placeholder="URL del logo"
                                                        value={settings.team_logo_url}
                                                        onChange={(e) => setSettings({ ...settings, team_logo_url: e.target.value })}
                                                    />
                                                    <label className="btn btn-secondary" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', whiteSpace: 'nowrap' }}>
                                                        <Settings size={16} /> {uploading ? 'Subiendo...' : 'Subir Imagen'}
                                                        <input type="file" hidden accept="image/*" onChange={handleLogoUpload} disabled={uploading} />
                                                    </label>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="form-group">
                                            <label className="label">URL del Favicon (.ico)</label>
                                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                <input
                                                    type="text"
                                                    className="input"
                                                    placeholder="URL del favicon"
                                                    value={settings.favicon_url}
                                                    onChange={(e) => setSettings({ ...settings, favicon_url: e.target.value })}
                                                />
                                                <label className="btn btn-secondary" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', whiteSpace: 'nowrap' }}>
                                                    <Settings size={16} /> {uploading ? 'Subiendo...' : 'Subir Favicon'}
                                                    <input type="file" hidden accept="image/x-icon,image/png,image/jpeg" onChange={handleFaviconUpload} disabled={uploading} />
                                                </label>
                                            </div>
                                        </div>
                                    </div>
                                    <div>
                                        <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <DollarSign size={20} /> Costos y Tarifas Dinámicas
                                        </h3>

                                        {/* Add Cost Form */}
                                        <div className="glass" style={{ padding: '1rem', marginBottom: '1.5rem', border: '1px dashed var(--glass-border)' }}>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '0.5rem' }}>
                                                <div className="form-group" style={{ marginBottom: 0 }}>
                                                    <input
                                                        type="text"
                                                        className="input"
                                                        placeholder="Concepto (ej: Mensualidad)"
                                                        value={newCost.item_name}
                                                        onChange={(e) => setNewCost({ ...newCost, item_name: e.target.value })}
                                                    />
                                                </div>
                                                <div className="form-group" style={{ marginBottom: 0 }}>
                                                    <input
                                                        type="number"
                                                        className="input"
                                                        placeholder="Valor ($)"
                                                        value={newCost.amount}
                                                        onChange={(e) => setNewCost({ ...newCost, amount: e.target.value })}
                                                    />
                                                </div>
                                                <button type="button" className="btn btn-primary" onClick={handleAddCost} style={{ padding: '0.75rem' }}>
                                                    <Plus size={20} />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Costs List */}
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                            {costs.length === 0 ? (
                                                <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1rem' }}>No hay costos configurados.</p>
                                            ) : (
                                                costs.map(cost => (
                                                    <div key={cost.id} className="glass" style={{ padding: '1rem', border: editingCostId === cost.id ? '1px solid var(--primary)' : 'none' }}>
                                                        {editingCostId === cost.id ? (
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                                                <input
                                                                    type="text"
                                                                    className="input"
                                                                    value={editingCostName}
                                                                    onChange={(e) => setEditingCostName(e.target.value)}
                                                                    placeholder="Concepto"
                                                                />
                                                                <input
                                                                    type="number"
                                                                    className="input"
                                                                    value={editingCostAmount}
                                                                    onChange={(e) => setEditingCostAmount(e.target.value)}
                                                                    placeholder="Valor"
                                                                />
                                                                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                                                                    <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => handleSaveEditCost(cost.id)}>
                                                                        <Save size={16} /> Guardar
                                                                    </button>
                                                                    <button className="btn btn-secondary" style={{ flex: 1 }} onClick={handleCancelEditCost}>
                                                                        <X size={16} /> Cancelar
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                <div>
                                                                    <div style={{ fontWeight: 600 }}>{cost.name}</div>
                                                                    <div style={{ color: 'var(--primary)', fontWeight: 800 }}>${new Intl.NumberFormat().format(cost.amount)}</div>
                                                                </div>
                                                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleStartEditCost(cost)}
                                                                        className="btn btn-secondary"
                                                                        style={{ padding: '0.5rem' }}
                                                                        title="Editar"
                                                                    >
                                                                        <Edit2 size={16} />
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleDeleteCost(cost.id)}
                                                                        className="btn btn-secondary"
                                                                        style={{ padding: '0.5rem', color: 'var(--error)' }}
                                                                        title="Eliminar"
                                                                    >
                                                                        <Trash2 size={16} />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <button type="submit" className="btn btn-primary" style={{ marginTop: '2rem', width: '200px' }}>
                                    <Save size={18} /> Guardar Identidad
                                </button>
                            </form>
                        </div>
                    )}
                </>
            )}

            {/* Modal de Jugadores */}
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
                                            <th>#</th>
                                            <th>Nombre</th>
                                            <th>Posición</th>
                                            <th style={{ textAlign: 'right' }}>Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {selectedTeamPlayers.map(p => (
                                            <tr key={p.id}>
                                                <td><span className="badge-id">{p.uniform_number}</span></td>
                                                <td>{p.full_name}</td>
                                                <td>{p.position}</td>
                                                <td style={{ textAlign: 'right' }}>
                                                    <button 
                                                        className="btn-icon" 
                                                        style={{ color: 'var(--error)' }} 
                                                        onClick={() => handleDeletePlayer(p.id)}
                                                        title="Eliminar Jugador"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <div style={{ textAlign: 'center', padding: '2rem', opacity: 0.6 }}>
                                    Este equipo no tiene jugadores aún.
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
    );
};

export default AdminPanel;
