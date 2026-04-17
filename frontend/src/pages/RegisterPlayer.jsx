import React, { useState, useEffect } from 'react';
import { Search, Save, XCircle, CheckCircle, Info } from 'lucide-react';
import { playerService, positionService, uniformService, settingsService, costService } from '../services/api';
import { useParams } from 'react-router-dom';
import { useNotification } from '../context/NotificationContext';

const RegisterPlayer = () => {
    const { teamSlug } = useParams();
    const { showNotification } = useNotification();
    const initialFormState = {
        document_type: 'Cédula de Ciudadanía',
        document_number: '',
        full_name: '',
        address: '',
        neighborhood: '',
        phone: '',
        eps: '',
        uniform_size: 'M',
        uniform_number: '',
        primary_position_id: '',
        secondary_position_id: '',
        payment_status: 'Pendiente',
        payment_amount: 0
    };

    const [formData, setFormData] = useState(initialFormState);
    const [docStatus, setDocStatus] = useState(null); // 'disponible', 'bloqueado', 'puede_re_registrar'
    const [positions, setPositions] = useState([]);
    const [availableNumbers, setAvailableNumbers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [costs, setCosts] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [teamName, setTeamName] = useState('');
    const [teamLogo, setTeamLogo] = useState('');
    const [epsList, setEpsList] = useState([]);

    useEffect(() => {
        loadInitialData();
    }, []);

    const loadInitialData = async () => {
        if (!teamSlug) return;
        try {
            const [posRes, numRes, settingsRes, costsRes, epsRes] = await Promise.all([
                positionService.getAllByTeam(teamSlug),
                uniformService.getAvailable(teamSlug),
                settingsService.getPublic(teamSlug),
                costService.getPublic(teamSlug),
                playerService.getEps(teamSlug)
            ]);
            setPositions(posRes.data);
            setAvailableNumbers(numRes.data);
            setTeamName(settingsRes.data.team_name);
            setTeamLogo(settingsRes.data.team_logo_url);
            setCosts(costsRes.data);
            setEpsList(epsRes.data);
        } catch (err) {
            showNotification('Error al cargar datos del equipo', 'error');
            console.error('Error loading data', err);
            setError('Error al cargar datos del servidor');
        }
    };

    const handleDocCheck = async (e) => {
        const val = e.target.value.replace(/\D/g, ''); // Strip non-digits
        setFormData({ ...formData, document_number: val });
        
        if (val.length >= 5) {
            try {
                const res = await playerService.checkDocument(teamSlug, val);
                setDocStatus(res.data);
                if (res.data.status === 'bloqueado') {
                    setError(res.data.message);
                } else {
                    setError('');
                }
            } catch (err) {
                console.error('Check failed', err);
            }
        } else {
            setDocStatus(null);
            setError('');
        }
    };

    const handlePhoneChange = (e) => {
        const val = e.target.value.replace(/\D/g, '').slice(0, 10);
        setFormData({ ...formData, phone: val });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setSuccess('');

        if (docStatus?.status === 'bloqueado') {
            setError(docStatus.message);
            setLoading(false);
            return;
        }

        try {
            await playerService.register(teamSlug, formData);
            setSuccess('¡Jugador registrado exitosamente!');
            setShowModal(true);
            setFormData(initialFormState);
            setDocStatus(null);
            loadInitialData(); // Refresh available numbers
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch (err) {
            const detailMsg = err.response?.data?.details ? ` (${err.response.data.details})` : '';
            const msg = (err.response?.data?.error || 'Error al registrar jugador') + detailMsg;
            setError(msg);
            showNotification(msg, 'error');
        } finally {
            setLoading(false);
        }
    };

    const clearForm = () => {
        setFormData(initialFormState);
        setDocStatus(null);
        setError('');
        setSuccess('');
    };

    return (
        <div className="animate-fade-in">
            <div style={{ marginBottom: '2rem' }}>
                <h1>Registro de Jugador</h1>
                <p style={{ color: 'var(--text-muted)' }}>Ingresa los datos para inscribir al jugador en el equipo oficial.</p>
            </div>

            {error && <div className="alert alert-error"><XCircle size={20} /> {error}</div>}
            {success && <div className="alert alert-success"><CheckCircle size={20} /> {success}</div>}
            
            {docStatus?.status === 'puede_re_registrar' && (
                <div className="alert alert-info">
                    <Info size={20} /> El documento ya está registrado, pero puede actualizar sus datos.
                </div>
            )}

            <form onSubmit={handleSubmit} className="glass" style={{ padding: '2rem' }}>
                <div className="grid-form">
                    
                    {/* Identification */}
                    <div className="form-group">
                        <label className="label">Tipo de Documento</label>
                        <select 
                            className="select"
                            value={formData.document_type}
                            onChange={(e) => setFormData({...formData, document_type: e.target.value})}
                            required
                        >
                            <option>Cédula de Ciudadanía</option>
                            <option>Pasaporte</option>
                            <option>Cédula de Extranjería</option>
                            <option>Otro</option>
                        </select>
                    </div>

                    <div className="form-group">
                        <label className="label">Número de Documento</label>
                        <div style={{ position: 'relative' }}>
                            <input 
                                type="text"
                                className={`input ${docStatus?.status === 'bloqueado' ? 'error' : ''}`}
                                value={formData.document_number}
                                onChange={handleDocCheck}
                                placeholder="Ej: 1098..."
                                required
                            />
                            {docStatus?.status === 'bloqueado' && <XCircle size={18} color="var(--error)" style={{ position: 'absolute', right: '1rem', top: '0.85rem' }} />}
                            {docStatus?.status === 'disponible' && <CheckCircle size={18} color="var(--success)" style={{ position: 'absolute', right: '1rem', top: '0.85rem' }} />}
                        </div>
                    </div>

                    {/* Basic Info */}
                    <div className="form-group grid-full-width">
                        <label className="label">Nombre Completo</label>
                        <input 
                            type="text"
                            className="input"
                            value={formData.full_name}
                            onChange={(e) => setFormData({...formData, full_name: e.target.value})}
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label className="label">Dirección</label>
                        <input 
                            type="text"
                            className="input"
                            value={formData.address}
                            onChange={(e) => setFormData({...formData, address: e.target.value})}
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label className="label">Barrio</label>
                        <input 
                            type="text"
                            className="input"
                            value={formData.neighborhood}
                            onChange={(e) => setFormData({...formData, neighborhood: e.target.value})}
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label className="label">Teléfono (10 dígitos)</label>
                        <input 
                            type="tel"
                            className="input"
                            value={formData.phone}
                            onChange={handlePhoneChange}
                            required
                            pattern="[0-9]{10}"
                            minLength={10}
                            maxLength={10}
                            placeholder="Ej: 310..."
                        />
                    </div>

                    <div className="form-group">
                        <label className="label">EPS</label>
                        <input 
                            type="text"
                            className="input"
                            value={formData.eps}
                            onChange={(e) => setFormData({...formData, eps: e.target.value})}
                            required
                            list="eps-list"
                            placeholder="Selecciona o escribe..."
                        />
                        <datalist id="eps-list">
                            {epsList.map((eps, idx) => (
                                <option key={idx} value={eps} />
                            ))}
                        </datalist>
                    </div>

                    {/* Uniform */}
                    <div className="form-group">
                        <label className="label">Talla de Uniforme</label>
                        <select 
                            className="select"
                            value={formData.uniform_size}
                            onChange={(e) => setFormData({...formData, uniform_size: e.target.value})}
                            required
                        >
                            <option>S</option>
                            <option>M</option>
                            <option>L</option>
                            <option>XL</option>
                            <option>XXL</option>
                        </select>
                    </div>

                    <div className="form-group">
                        <label className="label">Número de Uniforme</label>
                        <select 
                            className="select"
                            value={formData.uniform_number}
                            onChange={(e) => setFormData({...formData, uniform_number: e.target.value})}
                            required
                        >
                            <option value="">Selecciona un número</option>
                            {availableNumbers.map(num => (
                                <option key={num} value={num}>{num}</option>
                            ))}
                        </select>
                    </div>

                    {/* Positions */}
                    <div className="form-group">
                        <label className="label">Posición Principal</label>
                        <select 
                            className="select"
                            value={formData.primary_position_id}
                            onChange={(e) => setFormData({...formData, primary_position_id: e.target.value})}
                            required
                        >
                            <option value="">Selecciona posición</option>
                            {positions.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="form-group">
                        <label className="label">Posición Secundaria (Opcional)</label>
                        <select 
                            className="select"
                            value={formData.secondary_position_id}
                            onChange={(e) => setFormData({...formData, secondary_position_id: e.target.value})}
                        >
                            <option value="">Ninguna</option>
                            {positions.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                    </div>

                </div>

                <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                    <button 
                        type="submit" 
                        className="btn btn-primary"
                        disabled={loading || docStatus?.status === 'bloqueado'}
                    >
                        <Save size={18} /> {loading ? 'Registrando...' : 'Registrar Jugador'}
                    </button>
                    <button 
                        type="button" 
                        className="btn btn-secondary"
                        onClick={clearForm}
                    >
                        Limpiar Formulario
                    </button>
                </div>
            </form>

            {/* Success Modal */}
            {showModal && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    backgroundColor: 'rgba(0,0,0,0.85)',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    zIndex: 1000,
                    backdropFilter: 'blur(8px)'
                }}>
                    <div className="glass animate-fade-in" style={{ 
                        maxWidth: '500px', 
                        width: '90%', 
                        padding: '2.5rem', 
                        textAlign: 'center',
                        border: '1px solid var(--primary)'
                    }}>
                        <div style={{ 
                            width: '80px', 
                            height: '80px', 
                            borderRadius: '50%', 
                            display: 'flex', 
                            justifyContent: 'center', 
                            alignItems: 'center', 
                            margin: '0 auto 1.5rem',
                            padding: teamLogo ? '0.5rem' : '0',
                            background: teamLogo ? 'rgba(255,255,255,0.05)' : 'var(--success)',
                            border: teamLogo ? '2px solid var(--primary)' : 'none',
                            boxShadow: `0 0 20px ${teamLogo ? 'var(--primary-glow)' : 'var(--success)'}`
                        }}>
                            {teamLogo ? (
                                <img src={teamLogo} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '50%' }} />
                            ) : (
                                <CheckCircle size={40} color="#fff" />
                            )}
                        </div>
                        
                        <h2 style={{ marginBottom: '0.5rem' }}>¡Bienvenido a {teamName}!</h2>
                        <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>Tu registro ha sido procesado correctamente.</p>
                        
                        <div style={{ 
                            textAlign: 'left', 
                            background: 'rgba(0,0,0,0.2)', 
                            padding: '1.5rem', 
                            borderRadius: '1rem',
                            marginBottom: '2rem',
                            border: '1px solid var(--glass-border)'
                        }}>
                            <h4 style={{ marginBottom: '1rem', color: 'var(--primary)' }}>Resumen de Costos:</h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                {costs.map(cost => (
                                    <div key={cost.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1rem' }}>
                                        <span>{cost.name}</span>
                                        <span style={{ fontWeight: 700 }}>${new Intl.NumberFormat().format(cost.amount)}</span>
                                    </div>
                                ))}
                                <div style={{ 
                                    marginTop: '0.5rem', 
                                    paddingTop: '0.5rem', 
                                    borderTop: '1px solid var(--glass-border)',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    fontSize: '1.1rem',
                                    fontWeight: 800,
                                    color: 'var(--primary)'
                                }}>
                                    <span>Total a Pagar</span>
                                    <span>${new Intl.NumberFormat().format(costs.reduce((sum, c) => sum + c.amount, 0))}</span>
                                </div>
                            </div>
                        </div>

                        <div className="alert alert-info" style={{ textAlign: 'left', fontSize: '0.9rem', marginBottom: '2rem' }}>
                            <Info size={18} />
                            <span>Recuerda entregar el comprobante con el responsable del equipo.</span>
                        </div>

                        <button 
                            className="btn btn-primary" 
                            style={{ width: '100%', padding: '1rem' }}
                            onClick={() => setShowModal(false)}
                        >
                            Entendido
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default RegisterPlayer;
