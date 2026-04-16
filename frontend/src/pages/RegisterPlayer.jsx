import React, { useState, useEffect } from 'react';
import { Search, Save, XCircle, CheckCircle, Info } from 'lucide-react';
import { playerService, positionService, uniformService, settingsService } from '../services/api';

const RegisterPlayer = () => {
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
    const [fees, setFees] = useState({ uniform: 0, registration: 0 });

    useEffect(() => {
        loadInitialData();
    }, []);

    const loadInitialData = async () => {
        try {
            const [posRes, numRes, settingsRes] = await Promise.all([
                positionService.getAll(),
                uniformService.getAvailable(),
                settingsService.get()
            ]);
            setPositions(posRes.data);
            setAvailableNumbers(numRes.data);
            setFees({ 
                uniform: settingsRes.data.uniform_fee, 
                registration: settingsRes.data.registration_fee 
            });
        } catch (err) {
            console.error('Error loading data', err);
            setError('Error al cargar datos del servidor');
        }
    };

    const handleDocCheck = async (e) => {
        const val = e.target.value;
        setFormData({ ...formData, document_number: val });
        
        if (val.length >= 5) {
            try {
                const res = await playerService.checkDocument(val);
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
            await playerService.register(formData);
            setSuccess('¡Jugador registrado exitosamente!');
            setFormData(initialFormState);
            setDocStatus(null);
            loadInitialData(); // Refresh available numbers
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch (err) {
            const detailMsg = err.response?.data?.details ? ` (${err.response.data.details})` : '';
            setError((err.response?.data?.error || 'Error al registrar jugador') + detailMsg);
            console.error('Registration error full data:', err.response?.data);
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
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                    
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
                    <div className="form-group" style={{ gridColumn: 'span 2' }}>
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
                        />
                    </div>

                    <div className="form-group">
                        <label className="label">Barrio</label>
                        <input 
                            type="text"
                            className="input"
                            value={formData.neighborhood}
                            onChange={(e) => setFormData({...formData, neighborhood: e.target.value})}
                        />
                    </div>

                    <div className="form-group">
                        <label className="label">Teléfono</label>
                        <input 
                            type="tel"
                            className="input"
                            value={formData.phone}
                            onChange={(e) => setFormData({...formData, phone: e.target.value})}
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label className="label">EPS</label>
                        <input 
                            type="text"
                            className="input"
                            value={formData.eps}
                            onChange={(e) => setFormData({...formData, eps: e.target.value})}
                        />
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
        </div>
    );
};

export default RegisterPlayer;
