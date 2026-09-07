import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Plus, Search, MapPin, BarChart3, Calendar, Shield, ArrowRight, X } from 'lucide-react';
import { communityService } from '../services/api';
import { useNotification } from '../context/NotificationContext';

const CommunitiesList = () => {
    const navigate = useNavigate();
    const { showNotification } = useNotification();
    const [communities, setCommunities] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [newComm, setNewComm] = useState({
        name: '',
        city: '',
        description: '',
        logo_url: '',
        cover_url: ''
    });

    useEffect(() => {
        loadCommunities();
    }, []);

    const loadCommunities = async () => {
        setLoading(true);
        try {
            const res = await communityService.getAll();
            setCommunities(res.data);
        } catch (err) {
            console.error('Error al cargar comunidades:', err);
            showNotification('Error al cargar las comunidades', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleCreateSubmit = async (e) => {
        e.preventDefault();
        if (!newComm.name.trim()) {
            showNotification('El nombre de la comunidad es obligatorio', 'warning');
            return;
        }
        setSubmitting(true);
        try {
            const res = await communityService.create(newComm);
            showNotification('Comunidad creada exitosamente', 'success');
            setShowCreateModal(false);
            setNewComm({ name: '', city: '', description: '', logo_url: '', cover_url: '' });
            await loadCommunities();
            if (res.data?.id) {
                navigate(`/communities/${res.data.id}`);
            }
        } catch (err) {
            console.error('Error al crear comunidad:', err);
            showNotification(err.response?.data?.error || 'Error al crear comunidad', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    const filtered = communities.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.city && c.city.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return (
        <div className="container animate-fade-in" style={{ paddingBottom: '4rem' }}>
            {/* Header */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '1rem',
                marginBottom: '2rem'
            }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{
                            padding: '0.6rem',
                            background: 'rgba(0, 242, 254, 0.1)',
                            borderRadius: '12px',
                            border: '1px solid rgba(0, 242, 254, 0.3)',
                            color: 'var(--primary)'
                        }}>
                            <Users size={28} />
                        </div>
                        <h1 style={{ margin: 0, fontSize: '2rem' }}>Comunidades de Fútbol</h1>
                    </div>
                    <p style={{ color: 'var(--text-muted)', margin: '0.5rem 0 0 0', fontSize: '0.95rem' }}>
                        Crea comunidades, inscribe jugadores, realiza encuestas y organiza encuentros deportivos entre sí.
                    </p>
                </div>

                <button
                    className="btn btn-primary"
                    onClick={() => setShowCreateModal(true)}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                >
                    <Plus size={18} /> Nueva Comunidad
                </button>
            </div>

            {/* Search Bar */}
            <div className="glass" style={{ padding: '0.85rem 1.25rem', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <Search size={20} color="var(--text-muted)" />
                <input
                    type="text"
                    placeholder="Buscar por nombre o ciudad..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text)',
                        width: '100%',
                        fontSize: '1rem',
                        outline: 'none'
                    }}
                />
                {searchTerm && (
                    <button
                        onClick={() => setSearchTerm('')}
                        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                    >
                        <X size={18} />
                    </button>
                )}
            </div>

            {/* Content / Grid */}
            {loading ? (
                <div style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--text-muted)' }}>
                    <div className="animate-spin" style={{ display: 'inline-block', marginBottom: '1rem' }}>⚽</div>
                    <p>Cargando comunidades...</p>
                </div>
            ) : filtered.length === 0 ? (
                <div className="glass" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
                    <Shield size={48} color="var(--text-muted)" style={{ marginBottom: '1rem', opacity: 0.5 }} />
                    <h3 style={{ color: 'var(--text)', marginBottom: '0.5rem' }}>No se encontraron comunidades</h3>
                    <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', maxWidth: '400px', margin: '0 auto 1.5rem' }}>
                        {searchTerm ? 'Intenta con otro término de búsqueda.' : 'Crea tu primera comunidad de fútbol para comenzar a organizar jugadores, encuestas y partidos.'}
                    </p>
                    <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
                        <Plus size={18} /> Crear Comunidad
                    </button>
                </div>
            ) : (
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                    gap: '1.5rem'
                }}>
                    {filtered.map(c => (
                        <div
                            key={c.id}
                            className="glass animate-fade-in"
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                overflow: 'hidden',
                                transition: 'transform 0.2s ease, border-color 0.2s ease',
                                cursor: 'pointer'
                            }}
                            onClick={() => navigate(`/communities/${c.id}`)}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'translateY(-4px)';
                                e.currentTarget.style.borderColor = 'rgba(0, 242, 254, 0.4)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.borderColor = 'var(--glass-border)';
                            }}
                        >
                            {/* Cover banner or decorative gradient */}
                            <div style={{
                                height: '110px',
                                background: c.cover_url
                                    ? `url(${c.cover_url}) center/cover no-repeat`
                                    : 'linear-gradient(135deg, rgba(79, 172, 254, 0.3) 0%, rgba(0, 242, 254, 0.1) 100%)',
                                position: 'relative'
                            }}>
                                {c.city && (
                                    <span style={{
                                        position: 'absolute',
                                        top: '12px',
                                        right: '12px',
                                        background: 'rgba(15, 23, 42, 0.75)',
                                        backdropFilter: 'blur(8px)',
                                        padding: '0.25rem 0.6rem',
                                        borderRadius: '999px',
                                        fontSize: '0.75rem',
                                        color: 'var(--text)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.3rem',
                                        border: '1px solid rgba(255,255,255,0.1)'
                                    }}>
                                        <MapPin size={12} color="var(--primary)" /> {c.city}
                                    </span>
                                )}
                            </div>

                            {/* Info */}
                            <div style={{ padding: '1.25rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '-35px', marginBottom: '0.75rem' }}>
                                    <div style={{
                                        width: '54px',
                                        height: '54px',
                                        borderRadius: '12px',
                                        background: 'var(--surface)',
                                        border: '2px solid var(--primary)',
                                        overflow: 'hidden',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                                        flexShrink: 0
                                    }}>
                                        {c.logo_url ? (
                                            <img src={c.logo_url} alt={c.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        ) : (
                                            <Shield size={26} color="var(--primary)" />
                                        )}
                                    </div>
                                    <h3 style={{ margin: 0, fontSize: '1.2rem', lineHeight: 1.2, color: 'var(--text)' }}>
                                        {c.name}
                                    </h3>
                                </div>

                                <p style={{
                                    color: 'var(--text-muted)',
                                    fontSize: '0.875rem',
                                    lineHeight: 1.5,
                                    margin: '0.25rem 0 1rem 0',
                                    display: '-webkit-box',
                                    WebkitLineClamp: 2,
                                    WebkitBoxOrient: 'vertical',
                                    overflow: 'hidden'
                                }}>
                                    {c.description || 'Sin descripción disponible.'}
                                </p>

                                {/* Stat pills */}
                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(3, 1fr)',
                                    gap: '0.5rem',
                                    marginTop: 'auto',
                                    paddingTop: '0.75rem',
                                    borderTop: '1px solid rgba(255, 255, 255, 0.05)'
                                }}>
                                    <div style={{ textAlign: 'center', padding: '0.4rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.2rem' }}>
                                            <Users size={12} /> Jugadores
                                        </div>
                                        <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--primary)' }}>
                                            {c.total_players || 0}
                                        </div>
                                    </div>

                                    <div style={{ textAlign: 'center', padding: '0.4rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.2rem' }}>
                                            <BarChart3 size={12} /> Encuestas
                                        </div>
                                        <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f093fb' }}>
                                            {c.active_polls || 0}
                                        </div>
                                    </div>

                                    <div style={{ textAlign: 'center', padding: '0.4rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.2rem' }}>
                                            <Calendar size={12} /> Partidos
                                        </div>
                                        <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--success)' }}>
                                            {c.total_matches || 0}
                                        </div>
                                    </div>
                                </div>

                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'flex-end',
                                    gap: '0.3rem',
                                    marginTop: '0.85rem',
                                    fontSize: '0.85rem',
                                    color: 'var(--primary)',
                                    fontWeight: 600
                                }}>
                                    Entrar a la comunidad <ArrowRight size={15} />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal Crear Comunidad */}
            {showCreateModal && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0,0,0,0.7)',
                    backdropFilter: 'blur(8px)',
                    zIndex: 1000,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '1rem'
                }}>
                    <div className="glass" style={{ width: '100%', maxWidth: '520px', padding: '2rem', position: 'relative' }}>
                        <button
                            onClick={() => setShowCreateModal(false)}
                            style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                        >
                            <X size={20} />
                        </button>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                            <div style={{ padding: '0.5rem', background: 'rgba(0, 242, 254, 0.1)', borderRadius: '10px', color: 'var(--primary)' }}>
                                <Users size={22} />
                            </div>
                            <h2 style={{ margin: 0, fontSize: '1.4rem' }}>Crear Comunidad</h2>
                        </div>

                        <form onSubmit={handleCreateSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div className="form-group">
                                <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                    Nombre de la Comunidad *
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Ej: Comunidad Fútbol y Amigos"
                                    className="input"
                                    value={newComm.name}
                                    onChange={(e) => setNewComm({ ...newComm, name: e.target.value })}
                                    style={{ width: '100%' }}
                                />
                            </div>

                            <div className="form-group">
                                <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                    Ciudad / Ubicación
                                </label>
                                <input
                                    type="text"
                                    placeholder="Ej: Bogotá, Colombia"
                                    className="input"
                                    value={newComm.city}
                                    onChange={(e) => setNewComm({ ...newComm, city: e.target.value })}
                                    style={{ width: '100%' }}
                                />
                            </div>

                            <div className="form-group">
                                <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                    Descripción / Propósito
                                </label>
                                <textarea
                                    rows="3"
                                    placeholder="Describe las actividades, horarios de juego y reglas de convivencia..."
                                    className="input"
                                    value={newComm.description}
                                    onChange={(e) => setNewComm({ ...newComm, description: e.target.value })}
                                    style={{ width: '100%', resize: 'vertical' }}
                                />
                            </div>

                            <div className="form-group">
                                <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                    URL del Logo (Opcional)
                                </label>
                                <input
                                    type="url"
                                    placeholder="https://..."
                                    className="input"
                                    value={newComm.logo_url}
                                    onChange={(e) => setNewComm({ ...newComm, logo_url: e.target.value })}
                                    style={{ width: '100%' }}
                                />
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={() => setShowCreateModal(false)}
                                    disabled={submitting}
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="btn btn-primary"
                                    disabled={submitting}
                                >
                                    {submitting ? 'Creando...' : 'Crear Comunidad'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CommunitiesList;
