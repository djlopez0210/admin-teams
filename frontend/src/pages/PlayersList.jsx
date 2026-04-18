import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Edit2, Trash2, History, X, ArrowLeft, DollarSign, Save } from 'lucide-react';
import { playerService, costService } from '../services/api';
import { useNotification } from '../context/NotificationContext';

const PlayersList = () => {
    const navigate = useNavigate();
    const { showNotification } = useNotification();
    const [players, setPlayers] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [historyPlayer, setHistoryPlayer] = useState(null);
    const [historyData, setHistoryData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedPlayer, setSelectedPlayer] = useState(null);
    const [paymentForm, setPaymentForm] = useState({ status: '', amount: 0 });
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [totalMandatory, setTotalMandatory] = useState(0);
    const [editForm, setEditForm] = useState(null);
    const [positions, setPositions] = useState([]);
    const [availableNumbers, setAvailableNumbers] = useState([]);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        loadPlayers();
        loadCosts();
    }, []);

    const loadCosts = async () => {
        try {
            const res = await costService.getAll();
            const mandatory = res.data
                .filter(c => c.is_mandatory)
                .reduce((acc, current) => acc + current.amount, 0);
            setTotalMandatory(mandatory);
        } catch (err) {
            console.error('Error loading costs', err);
        }
    };

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
                showNotification('Jugador eliminado con éxito', 'success');
                loadPlayers();
            } catch (err) {
                showNotification('Error al eliminar jugador', 'error');
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
            amount: player.payment_status === 'Pagó' ? totalMandatory : player.payment_amount
        });
        setShowPaymentModal(true);
    };

    const handleStatusChange = (newStatus) => {
        let newAmount = paymentForm.amount;
        if (newStatus === 'Pagó') {
            newAmount = totalMandatory;
        } else if (newStatus === 'Pendiente') {
            newAmount = 0;
        }
        setPaymentForm({ ...paymentForm, status: newStatus, amount: newAmount });
    };

    const handleSavePayment = async (e) => {
        e.preventDefault();
        try {
            await playerService.updatePayment(selectedPlayer.id, {
                payment_status: paymentForm.status,
                payment_amount: paymentForm.amount
            });
            showNotification('Pago actualizado correctamente', 'success');
            setShowPaymentModal(false);
            loadPlayers();
        } catch (err) {
            showNotification('Error al actualizar pago', 'error');
        }
    };

    const handleOpenEdit = async (player) => {
        setEditForm({ ...player });
        setShowEditModal(true);
        try {
            const [posRes, numRes] = await Promise.all([
                positionService.getAll(),
                uniformService.getAll()
            ]);
            setPositions(posRes.data);
            
            // Numbers available + current player number
            const available = numRes.data.filter(n => n.is_available).map(n => n.number);
            if (!available.includes(player.uniform_number)) {
                available.push(player.uniform_number);
            }
            setAvailableNumbers(available.sort((a, b) => a - b));
        } catch (err) {
            console.error('Error loading edit data', err);
        }
    };

    const handleSaveEditPlayer = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            await playerService.update(editForm.id, editForm);
            showNotification('Jugador actualizado con éxito', 'success');
            setShowEditModal(false);
            loadPlayers();
        } catch (err) {
            showNotification(err.response?.data?.error || 'Error al actualizar jugador', 'error');
        } finally {
            setSaving(false);
        }
    };

    const filteredPlayers = players.filter(p =>
        p.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.document_number.includes(searchTerm)
    );

    return (
        <div className="animate-fade-in">
            <div className="flex-responsive" style={{ marginBottom: '2rem', alignItems: 'flex-end' }}>
                <div>
                    <button
                        className="btn btn-secondary"
                        style={{ marginBottom: '1rem', padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                        onClick={() => navigate('/admin')}
                    >
                        <ArrowLeft size={14} /> Volver al Panel
                    </button>
                    <h1>Nómina del Equipo</h1>
                    <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>Listado oficial de jugadores registrados y activos.</p>
                    <div style={{ display: 'inline-block', padding: '0.5rem 1rem', background: 'rgba(56, 189, 248, 0.1)', borderRadius: '8px', borderLeft: '4px solid var(--primary)' }}>
                        <span style={{ fontSize: '0.85rem', color: 'var(--primary)', fontWeight: 600, display: 'block' }}>🔗 Enlace de inscripción para jugadores:</span>
                        <code style={{ fontSize: '0.85rem' }}>http://localhost:3000/{localStorage.getItem('adminTeamSlug') || '...'}/registro</code>
                    </div>
                </div>
                <div style={{ position: 'relative', width: '100%', maxWidth: '300px' }}>
                    <Search size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '1rem', top: '0.85rem' }} />
                    <input
                        type="text"
                        className="input"
                        placeholder="Buscar por nombre..."
                        style={{ paddingLeft: '3rem', width: '100%' }}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            <div className="glass table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Nro. Documento</th>
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
                                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                                        <button className="btn btn-primary" style={{ padding: '0.4rem' }} title="Editar Datos" onClick={() => handleOpenEdit(p)}>
                                            <Edit2 size={14} />
                                        </button>
                                        <button className="btn btn-primary" style={{ padding: '0.4rem', background: 'var(--success)' }} title="Editar Pago" onClick={() => handleOpenPayment(p)}>
                                            <DollarSign size={14} />
                                        </button>
                                        <button className="btn btn-secondary" style={{ padding: '0.4rem' }} title="Ver Historial" onClick={() => viewHistory(p)}>
                                            <History size={14} />
                                        </button>
                                        <button className="btn btn-secondary" style={{ padding: '0.4rem' }} title="Eliminar" onClick={() => handleDelete(p.id)}>
                                            <Trash2 size={14} color="var(--error)" />
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
                                    onChange={(e) => handleStatusChange(e.target.value)}
                                    required
                                >
                                    <option value="Pendiente">Pendiente</option>
                                    <option value="Pagó">Pagó</option>
                                    <option value="Abonó">Abonó</option>
                                </select>
                            </div>

                            {paymentForm.status === 'Pagó' && (
                                <div style={{ marginBottom: '1.5rem', padding: '1rem', background: 'rgba(34, 197, 94, 0.1)', borderRadius: '0.75rem', border: '1px solid var(--success)' }}>
                                    <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--success)' }}>
                                        Monto total obligatorio: <strong>${totalMandatory.toLocaleString()}</strong>
                                    </p>
                                </div>
                            )}

                            {paymentForm.status === 'Abonó' && (
                                <div className="form-group animate-fade-in">
                                    <label className="label">Monto Abonado ($)</label>
                                    <input
                                        type="number"
                                        className="input"
                                        value={paymentForm.amount}
                                        onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
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

            {/* Edit Player Modal */}
            {showEditModal && editForm && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
                    background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)',
                    display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
                }}>
                    <div className="glass" style={{ width: '90%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto', padding: '2rem', position: 'relative' }}>
                        <button
                            onClick={() => setShowEditModal(false)}
                            style={{ position: 'absolute', right: '1.5rem', top: '1.5rem', background: 'none', border: 'none', color: 'var(--text)' }}
                        >
                            <X size={24} />
                        </button>

                        <h2 style={{ marginBottom: '1.5rem' }}>Editar Jugador</h2>
                        
                        <form onSubmit={handleSaveEditPlayer}>
                            <div className="grid-form">
                                <div className="form-group">
                                    <label className="label">Nombre Completo</label>
                                    <input 
                                        type="text" className="input" required
                                        value={editForm.full_name}
                                        onChange={(e) => setEditForm({...editForm, full_name: e.target.value})}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="label">Teléfono</label>
                                    <input 
                                        type="text" className="input" required
                                        value={editForm.phone}
                                        onChange={(e) => setEditForm({...editForm, phone: e.target.value})}
                                    />
                                </div>
                            </div>

                            <div className="grid-form" style={{ gridTemplateColumns: '1fr 1fr' }}>
                                <div className="form-group">
                                    <label className="label">Tipo Docto.</label>
                                    <select 
                                        className="select"
                                        value={editForm.document_type}
                                        onChange={(e) => setEditForm({...editForm, document_type: e.target.value})}
                                    >
                                        <option value="Cédula de Ciudadanía">Cédula de Ciudadanía</option>
                                        <option value="Tarjeta de Identidad">Tarjeta de Identidad</option>
                                        <option value="Registro Civil">Registro Civil</option>
                                        <option value="Cédula de Extranjería">Cédula de Extranjería</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="label">Número Docto.</label>
                                    <input 
                                        type="text" className="input" required
                                        value={editForm.document_number}
                                        onChange={(e) => setEditForm({...editForm, document_number: e.target.value})}
                                    />
                                </div>
                            </div>

                            <div className="grid-form" style={{ gridTemplateColumns: '1fr 1fr' }}>
                                <div className="form-group">
                                    <label className="label">Posición Principal</label>
                                    <select 
                                        className="select" required
                                        value={editForm.primary_position_id}
                                        onChange={(e) => setEditForm({...editForm, primary_position_id: e.target.value})}
                                    >
                                        <option value="">Selecciona...</option>
                                        {positions.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="label">Número de Uniforme</label>
                                    <select 
                                        className="select" required
                                        value={editForm.uniform_number}
                                        onChange={(e) => setEditForm({...editForm, uniform_number: e.target.value})}
                                    >
                                        {availableNumbers.map(n => <option key={n} value={n}>#{n}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="label">Talla de Uniforme</label>
                                <select 
                                    className="select"
                                    value={editForm.uniform_size}
                                    onChange={(e) => setEditForm({...editForm, uniform_size: e.target.value})}
                                >
                                    {['6', '8', '10', '12', '14', '16', 'S', 'M', 'L', 'XL'].map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>

                            <div className="form-group">
                                <label className="label">EPS</label>
                                <input 
                                    type="text" className="input" 
                                    value={editForm.eps || ''}
                                    onChange={(e) => setEditForm({...editForm, eps: e.target.value})}
                                />
                            </div>

                            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }} disabled={saving}>
                                <Save size={18} /> {saving ? 'Guardando...' : 'Guardar Cambios'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PlayersList;
