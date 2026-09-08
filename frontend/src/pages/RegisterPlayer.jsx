import React, { useState, useEffect } from 'react';
import { Search, Save, XCircle, CheckCircle, Info, Upload, Camera } from 'lucide-react';
import { playerService, positionService, uniformService, settingsService, costService } from '../services/api';
import { useParams } from 'react-router-dom';
import { useNotification } from '../context/NotificationContext';
import CameraModal from '../components/CameraModal';
import { compressImage } from '../utils/imageCompressor';

const RegisterPlayer = () => {
    const { teamSlug } = useParams();
    const { showNotification } = useNotification();
    const initialFormState = {
        document_type: 'Cédula de Ciudadanía',
        document_number: '',
        first_name: '',
        last_name: '',
        full_name: '',
        address: '',
        neighborhood: '',
        phone: '',
        email: '',
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
    const [photoFile, setPhotoFile] = useState(null);
    const [photoPreview, setPhotoPreview] = useState('');
    const [uploadingPhoto, setUploadingPhoto] = useState(false);
    const [photoWarning, setPhotoWarning] = useState('');
    const [cutoutPreview, setCutoutPreview] = useState('');
    const [showCameraModal, setShowCameraModal] = useState(false);

    const handleCameraCapture = async (file) => {
        try {
            const compressed = await compressImage(file);
            setPhotoFile(compressed);
            setPhotoPreview(URL.createObjectURL(compressed));
        } catch (_) {
            setPhotoFile(file);
            setPhotoPreview(URL.createObjectURL(file));
        }
        setCutoutPreview('');
        setPhotoWarning('');
    };

    // PIN Validation State
    const [hasPin, setHasPin] = useState(false);
    const [pinValidated, setPinValidated] = useState(false);
    const [pinInput, setPinInput] = useState('');
    const [pinError, setPinError] = useState('');
    const [validatingPin, setValidatingPin] = useState(false);

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
            setHasPin(settingsRes.data.has_pin || false);
            setCosts(costsRes.data);
            setEpsList(epsRes.data);
        } catch (err) {
            showNotification('Error al cargar datos del equipo', 'error');
            console.error('Error loading data', err);
            setError('Error al cargar datos del servidor');
        }
    };

    const handlePinSubmit = async (e) => {
        e.preventDefault();
        setValidatingPin(true);
        setPinError('');
        try {
            await settingsService.validatePin(teamSlug, pinInput);
            setPinValidated(true);
        } catch (err) {
            const backendError = err.response?.data?.error;
            setPinError(backendError || 'PIN incorrecto. Intenta de nuevo.');
        } finally {
            setValidatingPin(false);
        }
    };

    const handleDocCheck = async (e) => {
        const val = e.target.value.replace(/\D/g, ''); // Strip non-digits
        setFormData({ ...formData, document_number: val });
        
        if (val.length >= 5) {
            try {
                const res = await playerService.checkDocument(teamSlug, val);
                setDocStatus(res.data);
                if (res.data.status === 'bloqueado' || res.data.status === 'bloqueado_torneo') {
                    setError(res.data.message);
                    setSuccess('');
                } else if (res.data.status === 'disponible_global' && res.data.player_data) {
                    const pd = res.data.player_data;
                    let fn = pd.first_name || '';
                    let ln = pd.last_name || '';
                    if (!fn && !ln && pd.full_name) {
                        const parts = pd.full_name.trim().split(' ');
                        fn = parts.shift() || '';
                        ln = parts.join(' ');
                    }
                    const full = (fn && ln ? `${fn} ${ln}` : (pd.full_name || '')).trim();
                    setFormData(prev => ({
                        ...prev,
                        first_name: fn || prev.first_name,
                        last_name: ln || prev.last_name,
                        full_name: full || prev.full_name,
                        phone: pd.phone || prev.phone,
                        email: pd.email || prev.email,
                        address: pd.address || prev.address,
                        neighborhood: pd.neighborhood || prev.neighborhood,
                        eps: pd.eps || prev.eps,
                        document_type: pd.document_type || prev.document_type,
                        primary_position_id: pd.primary_position_id || prev.primary_position_id
                    }));
                    if (pd.photo_url) {
                        setPhotoPreview(pd.photo_url);
                    }
                    if (pd.photo_cutout_url) {
                        setCutoutPreview(pd.photo_cutout_url);
                    }
                    setError('');
                    setSuccess(res.data.message);
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

    const handlePhotoSelect = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
            const compressed = await compressImage(file);
            setPhotoFile(compressed);
            setPhotoPreview(URL.createObjectURL(compressed));
        } catch (_) {
            setPhotoFile(file);
            setPhotoPreview(URL.createObjectURL(file));
        }
        setCutoutPreview('');
        setPhotoWarning('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setSuccess('');

        if (docStatus?.status === 'bloqueado' || docStatus?.status === 'bloqueado_torneo') {
            setError(docStatus.message);
            setLoading(false);
            return;
        }

        const fn = (formData.first_name || '').trim();
        const ln = (formData.last_name || '').trim();
        const full = fn && ln ? `${fn} ${ln}` : (formData.full_name || `${fn} ${ln}`).trim();
        const payload = {
            ...formData,
            first_name: fn,
            last_name: ln,
            full_name: full
        };

        try {
            const res = await playerService.register(teamSlug, payload);
            const playerId = res.data.player_id;

            if (photoFile && playerId) {
                setUploadingPhoto(true);
                try {
                    const finalPhoto = await compressImage(photoFile);
                    const photoRes = await playerService.uploadPhotoPublic(teamSlug, playerId, finalPhoto);
                    setCutoutPreview(photoRes.data.photo_cutout_url || '');
                    if (photoRes.data.warning) {
                        setPhotoWarning(photoRes.data.warning);
                    }
                } catch (photoErr) {
                    showNotification('El jugador se registró, pero la foto no se pudo subir', 'error');
                } finally {
                    setUploadingPhoto(false);
                }
            }

            setSuccess('¡Jugador registrado exitosamente!');
            setShowModal(true);
            setFormData(initialFormState);
            setDocStatus(null);
            setPhotoFile(null);
            setPhotoPreview('');
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
        setPhotoFile(null);
        setPhotoPreview('');
        setCutoutPreview('');
        setPhotoWarning('');
    };

    if (hasPin && !pinValidated) {
        return (
            <div className="animate-fade-in" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
                <div className="glass" style={{ padding: '3rem', maxWidth: '400px', width: '100%', textAlign: 'center' }}>
                    <h2 style={{ marginBottom: '1rem' }}>🛡️ Acceso Restringido</h2>
                    <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>Ingresa el PIN proporcionado por el delegado del equipo para continuar con la inscripción.</p>
                    
                    <form onSubmit={handlePinSubmit}>
                        <div className="form-group">
                            <input 
                                type="text"
                                className="input" 
                                placeholder="PIN de 4 dígitos" 
                                maxLength="4"
                                style={{ textAlign: 'center', fontSize: '1.5rem', letterSpacing: '0.5rem', WebkitTextSecurity: 'disc' }}
                                autoComplete="off"
                                data-1pignore="true"
                                data-lpignore="true"
                                value={pinInput}
                                onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ''))}
                                required
                            />
                        </div>
                        {pinError && <p style={{ color: 'var(--error)', fontSize: '0.85rem', marginTop: '0.5rem' }}>{pinError}</p>}
                        <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1.5rem' }} disabled={validatingPin || pinInput.length < 4}>
                            {validatingPin ? 'Verificando...' : 'Acceder al Formulario'}
                        </button>
                    </form>
                </div>
            </div>
        );
    }

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
                    <div className="form-group">
                        <label className="label">Nombres</label>
                        <input 
                            type="text"
                            className="input"
                            placeholder="Ej: Carlos Alberto"
                            value={formData.first_name}
                            onChange={(e) => {
                                const fn = e.target.value;
                                setFormData(prev => ({
                                    ...prev,
                                    first_name: fn,
                                    full_name: `${fn} ${prev.last_name || ''}`.trim()
                                }));
                            }}
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label className="label">Apellidos</label>
                        <input 
                            type="text"
                            className="input"
                            placeholder="Ej: Valderrama Palacio"
                            value={formData.last_name}
                            onChange={(e) => {
                                const ln = e.target.value;
                                setFormData(prev => ({
                                    ...prev,
                                    last_name: ln,
                                    full_name: `${prev.first_name || ''} ${ln}`.trim()
                                }));
                            }}
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

                    <div className="form-group">
                        <label className="label">Correo Electrónico (Email)</label>
                        <input 
                            type="email"
                            className="input"
                            value={formData.email || ''}
                            onChange={(e) => setFormData({...formData, email: e.target.value})}
                            placeholder="Ej: jugador@ejemplo.com"
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

                    <div className="form-group grid-full-width">
                        <label className="label">Foto (opcional, se le quita el fondo automáticamente)</label>
                        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                            {photoPreview && (
                                <img src={photoPreview} alt="Vista previa" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--glass-border)' }} />
                            )}
                            <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={() => setShowCameraModal(true)}
                                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                            >
                                <Camera size={16} /> Tomar foto
                            </button>
                            <label className="btn btn-secondary" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Upload size={16} /> {photoFile ? 'Cambiar archivo' : 'Subir archivo'}
                                <input type="file" hidden accept="image/*" onChange={handlePhotoSelect} />
                            </label>
                        </div>
                    </div>

                </div>

                <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                    <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={loading || uploadingPhoto || docStatus?.status === 'bloqueado'}
                    >
                        <Save size={18} /> {uploadingPhoto ? 'Quitando fondo de la foto...' : loading ? 'Registrando...' : 'Registrar Jugador'}
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
                        <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>Tu registro ha sido procesado correctamente.</p>

                        {cutoutPreview && (
                            <div style={{ marginBottom: '1.5rem' }}>
                                <img
                                    src={cutoutPreview} alt="Foto sin fondo"
                                    style={{
                                        width: 100, height: 100, objectFit: 'cover', borderRadius: 12,
                                        border: '1px solid var(--glass-border)', margin: '0 auto',
                                        backgroundImage: 'linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)',
                                        backgroundSize: '10px 10px',
                                        backgroundPosition: '0 0, 0 5px, 5px -5px, -5px 0px'
                                    }}
                                />
                                {photoWarning && <p style={{ color: 'var(--warning)', fontSize: '0.8rem', marginTop: '0.5rem' }}>{photoWarning}</p>}
                            </div>
                        )}

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

            {/* Camera Capture Modal */}
            <CameraModal
                isOpen={showCameraModal}
                onClose={() => setShowCameraModal(false)}
                onCapture={handleCameraCapture}
            />
        </div>
    );
};

export default RegisterPlayer;
