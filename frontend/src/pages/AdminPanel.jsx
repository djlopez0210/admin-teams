import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, PieChart, Activity, RefreshCcw, LogOut, Edit2, Save, X, DollarSign, Palette, Settings, Users, Trophy } from 'lucide-react';
import { adminService, positionService, settingsService, costService } from '../services/api';
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
    const [newTeam, setNewTeam] = useState({ name: '', slug: '', admin_username: '', admin_password: '' });
    const [settings, setSettings] = useState({
        team_name: '',
        team_logo_url: '',
        favicon_url: ''
    });
    const [costs, setCosts] = useState([]);
    const [newCost, setNewCost] = useState({ item_name: '', amount: '', is_mandatory: true });
    const [editingCostId, setEditingCostId] = useState(null);
    const [editingCostName, setEditingCostName] = useState('');
    const [editingCostAmount, setEditingCostAmount] = useState('');

    const loadData = async () => {
        setLoading(true);
        try {
            if (adminRole === 'superadmin') {
                const teamsRes = await adminService.getTeams();
                setTeams(teamsRes.data);
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
        if (window.confirm('¿Eliminar esta posición? Solo funcionará si no hay jugadores asignados.')) {
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
                favicon_url: settings.favicon_url
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
            await adminService.createTeam(newTeam);
            showNotification('Equipo y administrador creados con éxito', 'success');
            setNewTeam({ name: '', slug: '', admin_username: '', admin_password: '' });
            loadData();
        } catch (err) {
            showNotification(err.response?.data?.error || 'Error al crear equipo', 'error');
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

    const handleDeleteCost = async (id) => {
        if (!window.confirm('¿Eliminar este costo?')) return;
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
                            <button
                                className={`btn ${activeTab === 'teams' ? 'btn-primary' : 'btn-secondary'}`}
                                onClick={() => setActiveTab('teams')}
                                style={{ whiteSpace: 'nowrap' }}
                            >
                                <Trophy size={18} /> Equipos
                            </button>
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
                                    <h3 style={{ marginBottom: '1.5rem' }}>Crear Nuevo Equipo</h3>
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
                                            <small style={{ color: 'var(--text-muted)' }}>URL: localhost:3000/{newTeam.slug || '...'}</small>
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
                                                required
                                            />
                                        </div>
                                        <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }}>
                                            <Plus size={18} /> Crear Equipo e Inicializar
                                        </button>
                                    </form>
                                </div>
                                <div>
                                    <h3 style={{ marginBottom: '1.5rem' }}>Equipos Existentes</h3>
                                    <div className="glass table-container">
                                        <table>
                                            <thead>
                                                <tr>
                                                    <th>ID</th>
                                                    <th>Nombre</th>
                                                    <th>Link de Registro</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {teams.map(team => (
                                                    <tr key={team.id}>
                                                        <td>{team.id}</td>
                                                        <td style={{ fontWeight: 600 }}>{team.name}</td>
                                                        <td style={{ fontSize: '0.85rem' }}>
                                                            <a href={`/${team.slug}`} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)' }}>
                                                                /{team.slug}
                                                            </a>
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
                                        <h3 style={{ marginBottom: '1.5rem' }}>Identidad del Equipo</h3>
                                        <div className="form-group">
                                            <label className="label">Nombre del Equipo</label>
                                            <input
                                                type="text"
                                                className="input"
                                                value={settings.team_name}
                                                onChange={(e) => setSettings({ ...settings, team_name: e.target.value })}
                                            />
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
        </div>
    );
};

export default AdminPanel;
