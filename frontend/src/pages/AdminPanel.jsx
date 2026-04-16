import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, PieChart, Activity, RefreshCcw, LogOut, Edit2, Save, X, DollarSign, Palette, Settings, Users } from 'lucide-react';
import { adminService, positionService, settingsService } from '../services/api';

const AdminPanel = () => {
    const navigate = useNavigate();
    const [stats, setStats] = useState(null);
    const [logs, setLogs] = useState([]);
    const [positions, setPositions] = useState([]);
    const [newPosition, setNewPosition] = useState('');
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [activeTab, setActiveTab] = useState('stats'); // 'stats', 'finances', 'branding'
    const [settings, setSettings] = useState({
        team_name: '',
        team_logo_url: '',
        favicon_url: '',
        uniform_fee: 0,
        registration_fee: 0
    });

    const loadData = async () => {
        setLoading(true);
        try {
            const [statsRes, logsRes, posRes, settingsRes] = await Promise.all([
                adminService.getStats(),
                adminService.getLogs(),
                positionService.getAll(),
                settingsService.get()
            ]);
            setStats(statsRes.data);
            setLogs(logsRes.data);
            setPositions(posRes.data);
            setSettings(settingsRes.data);
        } catch (err) {
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
            loadData();
        } catch (err) {
            alert('Error al crear posición');
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
            loadData();
        } catch (err) {
            alert('Error al actualizar posición');
        }
    };

    const handleDeletePosition = async (id) => {
        if (window.confirm('¿Eliminar esta posición? Solo funcionará si no hay jugadores asignados.')) {
            try {
                await positionService.delete(id);
                loadData();
            } catch (err) {
                alert('No se puede eliminar: Probablemente hay jugadores asignados a esta posición.');
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
            await settingsService.update(settings);
            alert('Configuración actualizada con éxito');
            loadData();
            if (window.onSettingsUpdate) window.onSettingsUpdate(); // Trigger global refresh
            // Since we're in a separate component, let's just refresh the page or rely on global state
            window.location.reload(); 
        } catch (err) {
            alert('Error al guardar ajustes');
        }
    };

    const handleLogoUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        setUploading(true);
        try {
            const res = await settingsService.uploadLogo(file);
            setSettings({ ...settings, team_logo_url: res.data.url });
            alert('Logo cargado con éxito. Recuerda guardar los cambios.');
        } catch (err) {
            alert('Error al subir el logo');
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="animate-fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
                <div>
                    <h1>Panel de Administración</h1>
                    <p style={{ color: 'var(--text-muted)' }}>Gestión de configuraciones, estadísticas y auditoría.</p>
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <button className="btn btn-primary" onClick={() => navigate('/players')}>
                        <Users size={18} /> Gestionar Jugadores
                    </button>
                    <button className="btn btn-secondary" onClick={loadData}>
                        <RefreshCcw size={18} /> Actualizar
                    </button>
                    <button className="btn btn-secondary" style={{ color: 'var(--error)' }} onClick={handleLogout}>
                        <LogOut size={18} /> Salir
                    </button>
                </div>
            </div>

            {/* Tabs Navigation */}
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '1rem' }}>
                <button 
                    className={`btn ${activeTab === 'stats' ? 'btn-primary' : 'btn-secondary'}`} 
                    onClick={() => setActiveTab('stats')}
                >
                    <Activity size={18} /> Estadísticas y Logs
                </button>
                <button 
                    className={`btn ${activeTab === 'finances' ? 'btn-primary' : 'btn-secondary'}`} 
                    onClick={() => setActiveTab('finances')}
                >
                    <DollarSign size={18} /> Tablero de Recaudo
                </button>
                <button 
                    className={`btn ${activeTab === 'branding' ? 'btn-primary' : 'btn-secondary'}`} 
                    onClick={() => setActiveTab('branding')}
                >
                    <Palette size={18} /> Personalización y Precios
                </button>
            </div>

            {activeTab === 'stats' && (
                <>
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
                    {/* ... (Existing Grid with positions and logs) ... */}
                </>
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
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Basado en inscripción y uniformes</div>
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
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                            <div>
                                <h3 style={{ marginBottom: '1.5rem' }}>Identidad del Equipo</h3>
                                <div className="form-group">
                                    <label className="label">Nombre del Equipo</label>
                                    <input 
                                        type="text" 
                                        className="input" 
                                        value={settings.team_name}
                                        onChange={(e) => setSettings({...settings, team_name: e.target.value})}
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
                                                onChange={(e) => setSettings({...settings, team_logo_url: e.target.value})}
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
                                    <input 
                                        type="text" 
                                        className="input" 
                                        value={settings.favicon_url}
                                        onChange={(e) => setSettings({...settings, favicon_url: e.target.value})}
                                    />
                                </div>
                            </div>
                            <div>
                                <h3 style={{ marginBottom: '1.5rem' }}>Tarifas y Precios</h3>
                                <div className="form-group">
                                    <label className="label">Valor Uniforme ($)</label>
                                    <input 
                                        type="number" 
                                        className="input" 
                                        value={settings.uniform_fee}
                                        onChange={(e) => setSettings({...settings, uniform_fee: e.target.value})}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="label">Valor Inscripción ($)</label>
                                    <input 
                                        type="number" 
                                        className="input" 
                                        value={settings.registration_fee}
                                        onChange={(e) => setSettings({...settings, registration_fee: e.target.value})}
                                    />
                                </div>
                            </div>
                        </div>
                        <button type="submit" className="btn btn-primary" style={{ marginTop: '1rem', width: '200px' }}>
                            <Save size={18} /> Guardar Cambios
                        </button>
                    </form>
                </div>
            )}

            {activeTab === 'stats' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '2rem' }}>
                
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
        )}
    </div>
);
};

export default AdminPanel;
