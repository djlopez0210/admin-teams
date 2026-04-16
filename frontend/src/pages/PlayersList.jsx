import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Edit2, Trash2, History, X, ArrowLeft, DollarSign, Save } from 'lucide-react';
import { playerService } from '../services/api';

const PlayersList = () => {
    const navigate = useNavigate();
    const [players, setPlayers] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [historyPlayer, setHistoryPlayer] = useState(null);
    const [historyData, setHistoryData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedPlayer, setSelectedPlayer] = useState(null);
    const [paymentForm, setPaymentForm] = useState({ status: '', amount: 0 });
    const [showPaymentModal, setShowPaymentModal] = useState(false);

    useEffect(() => {
        loadPlayers();
    }, []);

    const loadPlayers = async () => {
        try {
            const res = await playerService.getAll();
            setPlayers(res.data);
        } catch (err) {
            console.error('Error fetching players', err);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('¿Estás seguro de que deseas eliminar este jugador? Su número de uniforme volverá a estar disponible.')) {
            try {
                await playerService.delete(id);
                loadPlayers();
            } catch (err) {
                alert('Error al eliminar');
            }
        }
    };

    const viewHistory = async (player) => {
        try {
            const res = await playerService.getHistory(player.id);
            setHistoryData(res.data);
            setHistoryPlayer(player);
        } catch (err) {
            console.error('Error loading history', err);
        }
    };

    const handleOpenPayment = (player) => {
        setSelectedPlayer(player);
        setPaymentForm({
            status: player.payment_status,
            amount: player.payment_amount
        });
        setShowPaymentModal(true);
    };

    const handleSavePayment = async (e) => {
        e.preventDefault();
        try {
            await playerService.updatePayment(selectedPlayer.id, {
                payment_status: paymentForm.status,
                payment_amount: paymentForm.amount
            });
            setShowPaymentModal(false);
            loadPlayers();
        } catch (err) {
            alert('Error al actualizar pago');
        }
    };

    const filteredPlayers = players.filter(p => 
        p.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.document_number.includes(searchTerm)
    );

    return (
        <div className="animate-fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '2rem' }}>
                <div>
                    <button 
                        className="btn btn-secondary" 
                        style={{ marginBottom: '1rem', padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                        onClick={() => navigate('/admin')}
                    >
                        <ArrowLeft size={14} /> Volver al Panel
                    </button>
                    <h1>Nómina del Equipo</h1>
                    <p style={{ color: 'var(--text-muted)' }}>Listado oficial de jugadores registrados y activos.</p>
                </div>
                <div style={{ position: 'relative', width: '300px' }}>
                    <Search size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '1rem', top: '0.85rem' }} />
                    <input 
                        type="text" 
                        className="input" 
                        placeholder="Buscar por nombre o documento..." 
                        style={{ paddingLeft: '3rem' }}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            <div className="glass table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Documento</th>
                            <th>Nombre Completo</th>
                            <th>Teléfono</th>
                            <th>Uniforme</th>
                            <th>Posición</th>
                            <th>Pago</th>
                            <th>Registro</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan="7" style={{ textAlign: 'center', padding: '3rem' }}>Cargando jugadores...</td></tr>
                        ) : filteredPlayers.length === 0 ? (
                            <tr><td colSpan="7" style={{ textAlign: 'center', padding: '3rem' }}>No se encontraron jugadores.</td></tr>
                        ) : filteredPlayers.map(p => (
                            <tr key={p.id}>
                                <td>
                                    <code style={{ 
                                        background: p.payment_status === 'Pagó' ? 'var(--success-bg, #dcfce7)' : 'var(--glass)', 
                                        color: p.payment_status === 'Pagó' ? 'var(--success, #16a34a)' : 'var(--text)',
                                        padding: '0.2rem 0.5rem', 
                                        borderRadius: '4px',
                                        fontWeight: p.payment_status === 'Pagó' ? 700 : 400,
                                        border: p.payment_status === 'Pagó' ? '1px solid var(--success)' : 'none'
                                    }}>
                                        {p.document_number}
                                    </code>
                                </td>
                                <td style={{ fontWeight: 600 }}>{p.full_name}</td>
                                <td>{p.phone}</td>
                                <td>
                                    <span style={{ 
                                        background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
                                        color: '#000',
                                        padding: '0.25rem 0.75rem',
                                        borderRadius: '2rem',
                                        fontWeight: 800,
                                        fontSize: '0.85rem'
                                    }}>
                                        #{p.uniform_number} <span style={{ opacity: 0.7, fontWeight: 400 }}>({p.uniform_size})</span>
                                    </span>
                                </td>
                                <td>
                                    <div>{p.primary_pos_name}</div>
                                    {p.secondary_pos_name && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{p.secondary_pos_name}</div>}
                                </td>
                                <td>
                                    <div style={{ fontSize: '0.85rem' }}>
                                        {p.payment_status === 'Pagó' && <span style={{ color: 'var(--success)' }}>✅ Pagó</span>}
                                        {p.payment_status === 'Abonó' && <span style={{ color: 'var(--primary)' }}>💰 Abonó (${p.payment_amount})</span>}
                                        {p.payment_status === 'Pendiente' && <span style={{ opacity: 0.5 }}>⏳ Pendiente</span>}
                                    </div>
                                </td>
                                <td style={{ fontSize: '0.85rem' }}>{new Date(p.last_registration_date).toLocaleDateString()}</td>
                                <td>
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        <button className="btn btn-primary" style={{ padding: '0.5rem' }} title="Editar Pago" onClick={() => handleOpenPayment(p)}>
                                            <DollarSign size={16} />
                                        </button>
                                        <button className="btn btn-secondary" style={{ padding: '0.5rem' }} title="Ver Historial" onClick={() => viewHistory(p)}>
                                            <History size={16} />
                                        </button>
                                        <button className="btn btn-secondary" style={{ padding: '0.5rem' }} title="Eliminar" onClick={() => handleDelete(p.id)}>
                                            <Trash2 size={16} color="var(--error)" />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* History Modal */}
            {historyPlayer && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
                    background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)',
                    display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
                }}>
                    <div className="glass" style={{ width: '90%', maxWidth: '800px', maxHeight: '80vh', overflowY: 'auto', padding: '2rem', position: 'relative' }}>
                        <button 
                            onClick={() => setHistoryPlayer(null)}
                            style={{ position: 'absolute', right: '1.5rem', top: '1.5rem', background: 'none', border: 'none', color: 'var(--text)' }}
                        >
                            <X size={24} />
                        </button>
                        
                        <h2 style={{ marginBottom: '1.5rem' }}>Historial de Registros</h2>
                        <div style={{ marginBottom: '2rem' }}>
                            <p><strong>Jugador:</strong> {historyPlayer.full_name}</p>
                            <p><strong>Documento:</strong> {historyPlayer.document_number}</p>
                        </div>

                        <div className="table-container">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Fecha Registro</th>
                                        <th>Número</th>
                                        <th>Posición Princ.</th>
                                        <th>Posición Sec.</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {historyData.length === 0 ? (
                                        <tr><td colSpan="4" style={{ textAlign: 'center', padding: '2rem' }}>No hay registros históricos previos.</td></tr>
                                    ) : historyData.map(h => (
                                        <tr key={h.id}>
                                            <td>{new Date(h.registered_date).toLocaleString()}</td>
                                            <td>#{h.uniform_number}</td>
                                            <td>{h.primary_position_id}</td> {/* In a real app we'd map ID to Name here too */}
                                            <td>{h.secondary_position_id || '-'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* Payment Modal */}
            {showPaymentModal && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
                    background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)',
                    display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
                }}>
                    <div className="glass" style={{ width: '400px', padding: '2rem', position: 'relative' }}>
                        <button 
                            onClick={() => setShowPaymentModal(false)}
                            style={{ position: 'absolute', right: '1.5rem', top: '1.5rem', background: 'none', border: 'none', color: 'var(--text)' }}
                        >
                            <X size={24} />
                        </button>
                        
                        <h2 style={{ marginBottom: '1.5rem' }}>Actualizar Pago</h2>
                        <p style={{ marginBottom: '1.5rem', fontSize: '0.9rem' }}>Jugador: <strong>{selectedPlayer.full_name}</strong></p>

                        <form onSubmit={handleSavePayment}>
                            <div className="form-group">
                                <label className="label">Estado de Pago</label>
                                <select 
                                    className="select"
                                    value={paymentForm.status}
                                    onChange={(e) => setPaymentForm({...paymentForm, status: e.target.value})}
                                    required
                                >
                                    <option value="Pendiente">Pendiente</option>
                                    <option value="Pagó">Pagó</option>
                                    <option value="Abonó">Abonó</option>
                                </select>
                            </div>

                            {paymentForm.status === 'Abonó' && (
                                <div className="form-group animate-fade-in">
                                    <label className="label">Monto Abonado ($)</label>
                                    <input 
                                        type="number"
                                        className="input"
                                        value={paymentForm.amount}
                                        onChange={(e) => setPaymentForm({...paymentForm, amount: e.target.value})}
                                        required
                                    />
                                </div>
                            )}

                            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }}>
                                <Save size={18} /> Guardar Cambios
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PlayersList;
