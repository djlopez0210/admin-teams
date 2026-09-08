import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toPng, toBlob } from 'html-to-image';
import JSZip from 'jszip';
import { Search, Edit2, Trash2, History, X, ArrowLeft, DollarSign, Save, Upload, CreditCard, Download, Package, MoreVertical, FileSpreadsheet, UserPlus, CheckCircle, AlertCircle, Camera, UserCheck, RefreshCw } from 'lucide-react';
import { playerService, costService, positionService, uniformService, cardTemplateService, adminService, globalPlayerService } from '../services/api';
import PlayerCard from '../components/PlayerCard';
import CameraModal from '../components/CameraModal';
import { compressImage } from '../utils/imageCompressor';

const BLOOD_TYPES = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'];

const toDateInputValue = (value) => {
    if (!value) return '';
    const d = new Date(value);
    if (isNaN(d.getTime())) return '';
    return d.toISOString().split('T')[0];
};

const slugify = (text) => (text || 'jugador').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-');

const waitForImages = (node) => {
    const imgs = Array.from(node.querySelectorAll('img'));
    return Promise.all(imgs.map(img => img.complete ? Promise.resolve() : new Promise(res => { img.onload = res; img.onerror = res; })));
};

const waitForNextPaint = () => new Promise(res => requestAnimationFrame(() => requestAnimationFrame(res)));

const PlayersList = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
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
    const [uploadingPhoto, setUploadingPhoto] = useState(false);
    const [photoWarning, setPhotoWarning] = useState('');
    const [cardTemplate, setCardTemplate] = useState(null);
    const [viewingCardData, setViewingCardData] = useState(null);
    const [downloadingCard, setDownloadingCard] = useState(false);
    const [exportProgress, setExportProgress] = useState(null);
    const [exportPlayerData, setExportPlayerData] = useState(null);
    const [cardScale, setCardScale] = useState(1);
    const [openMenuId, setOpenMenuId] = useState(null);
    const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
    const [teams, setTeams] = useState([]);
    const [selectedTeamId, setSelectedTeamId] = useState('');
    const cardRef = useRef(null);
    const exportCardRef = useRef(null);
    const excelInputRef = useRef(null);

    // Global Player Enrollment & Excel Import State
    const [showGlobalEnrollModal, setShowGlobalEnrollModal] = useState(false);
    const [globalSearchTerm, setGlobalSearchTerm] = useState('');
    const [globalSearchResults, setGlobalSearchResults] = useState([]);
    const [searchingGlobal, setSearchingGlobal] = useState(false);
    const [selectedGlobalPlayer, setSelectedGlobalPlayer] = useState(null);
    const [enrollUniformNumber, setEnrollUniformNumber] = useState('');
    const [enrollPositionId, setEnrollPositionId] = useState('');
    const [enrolling, setEnrolling] = useState(false);

    const [showExcelModal, setShowExcelModal] = useState(false);
    const [excelFile, setExcelFile] = useState(null);
    const [uploadingExcel, setUploadingExcel] = useState(false);
    const [excelResult, setExcelResult] = useState(null);

    const role = localStorage.getItem('adminRole');
    const isSuperAdmin = role === 'superadmin';

    const getActiveTeamId = () => {
        return isSuperAdmin ? selectedTeamId : localStorage.getItem('adminTeamId');
    };

    const getActiveTeamSlugOrId = () => {
        return isSuperAdmin ? selectedTeamId : (localStorage.getItem('adminTeamSlug') || localStorage.getItem('adminTeamId'));
    };

    // Inscribir Jugador Directo (Cédula -> BD / Nuevo con foto)
    const [showEnrollModal, setShowEnrollModal] = useState(false);
    const [enrollDocNumber, setEnrollDocNumber] = useState('');
    const [checkingDoc, setCheckingDoc] = useState(false);
    const [docCheckResult, setDocCheckResult] = useState(null);
    const [enrollForm, setEnrollForm] = useState({
        document_type: 'Cédula de Ciudadanía',
        document_number: '',
        first_name: '',
        last_name: '',
        phone: '',
        email: '',
        address: '',
        neighborhood: '',
        eps: '',
        birth_date: '',
        preferred_foot: '',
        blood_type: '',
        nationality: 'Colombiana',
        uniform_size: 'M',
        uniform_number: '',
        primary_position_id: '',
        secondary_position_id: '',
    });
    const [enrollPhotoFile, setEnrollPhotoFile] = useState(null);
    const [enrollPhotoPreview, setEnrollPhotoPreview] = useState('');
    const [savingEnroll, setSavingEnroll] = useState(false);
    const [epsList, setEpsList] = useState([]);
    const [showCameraModal, setShowCameraModal] = useState(false);
    const [cameraTarget, setCameraTarget] = useState('enroll'); // 'enroll' | 'edit'
    const enrollPhotoInputRef = useRef(null);

    const handleOpenEnrollModal = async () => {
        const teamId = getActiveTeamId();
        if (!teamId) {
            showNotification('Selecciona un equipo primero', 'warning');
            return;
        }
        const teamSlugOrId = getActiveTeamSlugOrId();
        setShowEnrollModal(true);
        setEnrollDocNumber('');
        setDocCheckResult(null);
        setEnrollPhotoFile(null);
        setEnrollPhotoPreview('');
        setEnrollForm({
            document_type: 'Cédula de Ciudadanía',
            document_number: '',
            first_name: '',
            last_name: '',
            phone: '',
            email: '',
            address: '',
            neighborhood: '',
            eps: '',
            birth_date: '',
            preferred_foot: '',
            blood_type: '',
            nationality: 'Colombiana',
            uniform_size: 'M',
            uniform_number: '',
            primary_position_id: '',
            secondary_position_id: '',
        });

        try {
            const [posRes, numRes, epsRes] = await Promise.all([
                positionService.getAllByTeam(teamSlugOrId),
                uniformService.getAvailable(teamSlugOrId),
                playerService.getEps(teamSlugOrId).catch(() => ({ data: [] }))
            ]);
            setPositions(posRes.data || []);
            setAvailableNumbers(numRes.data || []);
            setEpsList(epsRes.data || []);
        } catch (err) {
            console.error('Error preloading team data for enroll', err);
        }
    };

    const handleCheckDoc = async (overrideVal) => {
        const docToTest = (overrideVal !== undefined ? overrideVal : enrollDocNumber).toString().replace(/\D/g, '').trim();
        if (!docToTest || docToTest.length < 5) {
            showNotification('Ingresa al menos 5 dígitos de cédula', 'warning');
            return;
        }
        const teamSlugOrId = getActiveTeamSlugOrId();
        setCheckingDoc(true);
        setDocCheckResult(null);
        try {
            const res = await playerService.checkDocument(teamSlugOrId, docToTest);
            setDocCheckResult(res.data);

            if (res.data.status === 'disponible_global' && res.data.player_data) {
                const pd = res.data.player_data;
                let fn = pd.first_name || '';
                let ln = pd.last_name || '';
                if (!fn && !ln && pd.full_name) {
                    const parts = pd.full_name.trim().split(' ');
                    fn = parts.shift() || '';
                    ln = parts.join(' ');
                }
                setEnrollForm(prev => ({
                    ...prev,
                    document_number: docToTest,
                    document_type: pd.document_type || 'Cédula de Ciudadanía',
                    first_name: fn,
                    last_name: ln,
                    phone: pd.phone || '',
                    email: pd.email || '',
                    address: pd.address || '',
                    neighborhood: pd.neighborhood || '',
                    eps: pd.eps || '',
                    birth_date: pd.birth_date ? toDateInputValue(pd.birth_date) : '',
                    preferred_foot: pd.preferred_foot || '',
                    blood_type: pd.blood_type || '',
                    nationality: pd.nationality || 'Colombiana',
                    primary_position_id: pd.primary_position_id || prev.primary_position_id || '',
                }));
                if (pd.photo_cutout_url || pd.photo_url) {
                    setEnrollPhotoPreview(pd.photo_cutout_url || pd.photo_url);
                } else {
                    setEnrollPhotoPreview('');
                }
            } else if (res.data.status === 'disponible') {
                setEnrollForm(prev => ({
                    ...prev,
                    document_number: docToTest,
                    first_name: '',
                    last_name: '',
                    phone: '',
                    email: '',
                    address: '',
                    neighborhood: '',
                    eps: '',
                    birth_date: '',
                    preferred_foot: '',
                    blood_type: '',
                    nationality: 'Colombiana',
                    uniform_size: 'M',
                    uniform_number: '',
                    primary_position_id: '',
                    secondary_position_id: '',
                }));
                setEnrollPhotoPreview('');
                setEnrollPhotoFile(null);
            }
        } catch (err) {
            console.error('Error checking document', err);
            showNotification(err.response?.data?.error || 'Error al verificar documento', 'error');
        } finally {
            setCheckingDoc(false);
        }
    };

    const handleEnrollPhotoSelect = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setEnrollPhotoFile(file);
        setEnrollPhotoPreview(URL.createObjectURL(file));
    };

    const handleSaveEnrollPlayer = async (e) => {
        e.preventDefault();
        const teamId = getActiveTeamId();
        const teamSlugOrId = getActiveTeamSlugOrId();
        if (!teamId) {
            showNotification('Selecciona un equipo primero', 'warning');
            return;
        }
        if (!enrollForm.document_number) {
            showNotification('Ingresa el número de documento', 'warning');
            return;
        }
        if (!enrollForm.first_name || !enrollForm.last_name) {
            showNotification('Nombres y apellidos son requeridos', 'warning');
            return;
        }
        if (!enrollForm.uniform_number) {
            showNotification('Selecciona un número de uniforme (dorsal)', 'warning');
            return;
        }
        if (!enrollForm.primary_position_id) {
            showNotification('Selecciona la posición principal', 'warning');
            return;
        }

        setSavingEnroll(true);
        try {
            const fn = enrollForm.first_name.trim();
            const ln = enrollForm.last_name.trim();
            const full = `${fn} ${ln}`.trim();
            const payload = {
                ...enrollForm,
                first_name: fn,
                last_name: ln,
                full_name: full,
                uniform_number: parseInt(enrollForm.uniform_number),
                primary_position_id: parseInt(enrollForm.primary_position_id),
                secondary_position_id: enrollForm.secondary_position_id ? parseInt(enrollForm.secondary_position_id) : null,
            };

            const res = await playerService.register(teamSlugOrId, payload);
            const playerId = res.data.player_id;

            if (enrollPhotoFile && playerId) {
                try {
                    const finalPhoto = await compressImage(enrollPhotoFile);
                    await playerService.uploadPhoto(playerId, finalPhoto, teamId);
                } catch (pErr) {
                    console.warn('Foto no se pudo procesar:', pErr);
                    showNotification('Jugador inscrito, pero hubo un detalle al procesar la foto', 'warning');
                }
            }

            showNotification('¡Jugador inscrito exitosamente!', 'success');
            setShowEnrollModal(false);
            setEnrollPhotoFile(null);
            setEnrollPhotoPreview('');
            loadPlayers(teamId);
        } catch (err) {
            console.error('Error enrolling player:', err);
            showNotification(err.response?.data?.error || 'Error al inscribir jugador', 'error');
        } finally {
            setSavingEnroll(false);
        }
    };

    const handleSearchGlobal = async (val) => {
        setGlobalSearchTerm(val);
        if (val.trim().length >= 2) {
            setSearchingGlobal(true);
            try {
                const res = await globalPlayerService.search(val.trim());
                setGlobalSearchResults(res.data);
            } catch (err) {
                console.error('Error searching global players:', err);
            } finally {
                setSearchingGlobal(false);
            }
        } else {
            setGlobalSearchResults([]);
        }
    };

    const handleEnrollGlobalPlayer = async (e) => {
        e.preventDefault();
        const teamId = getActiveTeamId();
        if (!teamId) {
            showNotification('Selecciona un equipo primero', 'warning');
            return;
        }
        if (!selectedGlobalPlayer) {
            showNotification('Selecciona un jugador para inscribir', 'warning');
            return;
        }
        setEnrolling(true);
        try {
            await globalPlayerService.enrollInTeam(teamId, {
                document_number: selectedGlobalPlayer.document_number,
                full_name: selectedGlobalPlayer.full_name,
                uniform_number: enrollUniformNumber ? parseInt(enrollUniformNumber) : null,
                primary_position_id: enrollPositionId ? parseInt(enrollPositionId) : null
            });
            showNotification('¡Jugador inscrito exitosamente!', 'success');
            setShowGlobalEnrollModal(false);
            setSelectedGlobalPlayer(null);
            setEnrollUniformNumber('');
            setEnrollPositionId('');
            setGlobalSearchTerm('');
            setGlobalSearchResults([]);
            loadPlayers(teamId);
        } catch (err) {
            console.error(err);
            showNotification(err.response?.data?.error || 'Error al inscribir jugador', 'error');
        } finally {
            setEnrolling(false);
        }
    };

    const handleDownloadTemplate = async () => {
        try {
            const res = await globalPlayerService.downloadTemplate();
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', 'plantilla_jugadores.xlsx');
            document.body.appendChild(link);
            link.click();
            link.remove();
            showNotification('Plantilla descargada', 'success');
        } catch (err) {
            showNotification('Error al descargar la plantilla', 'error');
        }
    };

    const handleExcelUpload = async (e) => {
        e.preventDefault();
        const teamId = getActiveTeamId();
        if (!teamId) {
            showNotification('Selecciona un equipo primero', 'warning');
            return;
        }
        if (!excelFile) {
            showNotification('Selecciona un archivo Excel', 'warning');
            return;
        }
        setUploadingExcel(true);
        setExcelResult(null);
        try {
            const res = await globalPlayerService.importTeamExcel(teamId, excelFile);
            setExcelResult(res.data);
            showNotification(`Importación finalizada: ${res.data.imported} nuevos, ${res.data.updated} actualizados`, 'success');
            loadPlayers(teamId);
        } catch (err) {
            console.error(err);
            const errData = err.response?.data;
            if (errData && errData.errors) {
                setExcelResult(errData);
            }
            showNotification(errData?.error || 'Error al procesar el archivo Excel', 'error');
        } finally {
            setUploadingExcel(false);
        }
    };

    useEffect(() => {
        const teamParam = searchParams.get('teamId');
        const actionParam = searchParams.get('action');

        if (isSuperAdmin) {
            setLoading(false);
            adminService.getTeams().then(res => {
                setTeams(res.data);
                if (teamParam) {
                    setSelectedTeamId(teamParam);
                }
                if (actionParam === 'excel') {
                    setShowExcelModal(true);
                    setExcelResult(null);
                    setExcelFile(null);
                }
            }).catch(() => showNotification('Error al cargar equipos', 'error'));
        } else {
            loadPlayers();
            loadCosts();
            if (actionParam === 'excel') {
                setShowExcelModal(true);
                setExcelResult(null);
                setExcelFile(null);
            }
        }
    }, [searchParams]);

    useEffect(() => {
        if (!isSuperAdmin || !selectedTeamId) return;
        loadPlayers(selectedTeamId);
    }, [selectedTeamId]);

    useEffect(() => {
        if (!viewingCardData || !cardTemplate) return;
        const computeScale = () => {
            const maxWidth = window.innerWidth * 0.85;
            const maxHeight = window.innerHeight * 0.9 - 220; // reserve space for title, padding and download button
            const scale = Math.min(1, maxWidth / cardTemplate.canvas_width, maxHeight / cardTemplate.canvas_height);
            setCardScale(scale);
        };
        computeScale();
        window.addEventListener('resize', computeScale);
        return () => window.removeEventListener('resize', computeScale);
    }, [viewingCardData, cardTemplate]);

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

    const loadPlayers = async (teamId) => {
        setLoading(true);
        try {
            const res = await playerService.getAll(teamId);
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
        const prefilled = { ...player };
        if (!prefilled.first_name && !prefilled.last_name && prefilled.full_name) {
            const parts = prefilled.full_name.trim().split(' ');
            prefilled.first_name = parts.shift() || '';
            prefilled.last_name = parts.join(' ');
        }
        setEditForm(prefilled);
        setPhotoWarning('');
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

    const processEditPhotoFile = async (file) => {
        if (!file) return;
        setUploadingPhoto(true);
        setPhotoWarning('');
        try {
            const compressed = await compressImage(file);
            const res = await playerService.uploadPhoto(editForm.id, compressed, getActiveTeamId());
            setEditForm({ ...editForm, photo_url: res.data.photo_url, photo_cutout_url: res.data.photo_cutout_url });
            if (res.data.warning) {
                setPhotoWarning(res.data.warning);
            } else {
                showNotification('Foto cargada y fondo removido con éxito', 'success');
            }
        } catch (err) {
            showNotification(err.response?.data?.error || 'Error al subir la foto', 'error');
        } finally {
            setUploadingPhoto(false);
        }
    };

    const handlePhotoChange = async (e) => {
        const file = e.target.files[0];
        if (file) await processEditPhotoFile(file);
    };

    const handleCameraCapture = (file) => {
        if (cameraTarget === 'enroll') {
            setEnrollPhotoFile(file);
            setEnrollPhotoPreview(URL.createObjectURL(file));
            showNotification('Foto capturada con éxito', 'success');
        } else if (cameraTarget === 'edit') {
            processEditPhotoFile(file);
        }
    };

    const ensureTemplate = async () => {
        if (cardTemplate) return cardTemplate;
        const res = await cardTemplateService.get();
        setCardTemplate(res.data);
        return res.data;
    };

    const handleViewCard = async (player) => {
        try {
            const [template, cardRes] = await Promise.all([ensureTemplate(), playerService.getCardData(player.id, isSuperAdmin ? selectedTeamId : undefined)]);
            setViewingCardData(cardRes.data);
        } catch (err) {
            showNotification('Error al cargar la tarjeta', 'error');
        }
    };

    const handleDownloadCard = async () => {
        if (!cardRef.current) return;
        setDownloadingCard(true);
        try {
            await waitForImages(cardRef.current);
            const dataUrl = await toPng(cardRef.current, {
                pixelRatio: 2,
                width: cardTemplate.canvas_width,
                height: cardTemplate.canvas_height,
            });
            const link = document.createElement('a');
            link.download = `${slugify(viewingCardData.full_name)}_tarjeta.png`;
            link.href = dataUrl;
            link.click();
        } catch (err) {
            showNotification('Error al generar la imagen de la tarjeta', 'error');
        } finally {
            setDownloadingCard(false);
        }
    };

    const handleExportTeamZip = async () => {
        try {
            const teamId = localStorage.getItem('adminTeamId');
            const template = await ensureTemplate();
            const res = await playerService.getTeamCardData(teamId);
            const teamPlayers = res.data;
            if (teamPlayers.length === 0) {
                showNotification('No hay jugadores para exportar', 'warning');
                return;
            }

            const zip = new JSZip();
            for (let i = 0; i < teamPlayers.length; i++) {
                const player = teamPlayers[i];
                setExportProgress({ current: i + 1, total: teamPlayers.length });
                setExportPlayerData(player);
                await waitForNextPaint();
                if (exportCardRef.current) {
                    await waitForImages(exportCardRef.current);
                    const blob = await toBlob(exportCardRef.current, { pixelRatio: 2 });
                    zip.file(`${player.uniform_number}_${slugify(player.full_name)}.png`, blob);
                }
            }

            const zipBlob = await zip.generateAsync({ type: 'blob' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(zipBlob);
            link.download = `equipo_tarjetas.zip`;
            link.click();
            showNotification('Tarjetas exportadas con éxito', 'success');
        } catch (err) {
            showNotification('Error al exportar las tarjetas del equipo', 'error');
        } finally {
            setExportProgress(null);
            setExportPlayerData(null);
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
                    <h1>{isSuperAdmin ? 'Ver Jugadores' : 'Nómina del Equipo'}</h1>
                    <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>
                        {isSuperAdmin ? 'Vista de solo lectura: elegí un equipo para ver sus jugadores y tarjetas.' : 'Listado oficial de jugadores registrados y activos.'}
                    </p>
                    {isSuperAdmin ? (
                        <select
                            className="select"
                            style={{ minWidth: '260px' }}
                            value={selectedTeamId}
                            onChange={(e) => setSelectedTeamId(e.target.value)}
                        >
                            <option value="">Selecciona un equipo...</option>
                            {teams.map(t => (
                                <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                        </select>
                    ) : (
                        <div style={{ display: 'inline-block', padding: '0.5rem 1rem', background: 'rgba(56, 189, 248, 0.1)', borderRadius: '8px', borderLeft: '4px solid var(--primary)' }}>
                            <span style={{ fontSize: '0.85rem', color: 'var(--primary)', fontWeight: 600, display: 'block' }}>🔗 Enlace de inscripción para jugadores:</span>
                            <code style={{ fontSize: '0.85rem' }}>http://localhost:3000/{localStorage.getItem('adminTeamSlug') || '...'}/registro</code>
                        </div>
                    )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', alignItems: 'flex-end' }}>
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
                    {(!isSuperAdmin || selectedTeamId) && (
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        <button
                            className="btn btn-primary"
                            onClick={handleOpenEnrollModal}
                            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', fontWeight: 600 }}
                        >
                            <UserPlus size={15} /> Inscribir Jugador
                        </button>
                        <button
                            className="btn btn-secondary"
                            onClick={() => { setShowExcelModal(true); setExcelResult(null); setExcelFile(null); }}
                            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}
                        >
                            <FileSpreadsheet size={15} color="var(--success)" /> Carga Masiva Excel
                        </button>
                        <button
                            className="btn btn-secondary"
                            onClick={() => { setShowGlobalEnrollModal(true); setSelectedGlobalPlayer(null); setGlobalSearchTerm(''); setGlobalSearchResults([]); }}
                            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}
                            title="Buscar jugador en la base global por nombre"
                        >
                            <Search size={15} /> Buscar en Base Global
                        </button>
                        <button className="btn btn-secondary" onClick={handleExportTeamZip} disabled={!!exportProgress} style={{ fontSize: '0.85rem' }}>
                            <Package size={15} /> {exportProgress ? `Generando ${exportProgress.current}/${exportProgress.total}...` : 'Exportar Tarjetas (ZIP)'}
                        </button>
                    </div>
                    )}
                </div>
            </div>

            {isSuperAdmin && !selectedTeamId ? (
                <div className="glass" style={{ padding: '3rem', textAlign: 'center', opacity: 0.7 }}>
                    Selecciona un equipo arriba para ver sus jugadores.
                </div>
            ) : (
            <div className="glass table-container" onClick={() => setOpenMenuId(null)}>
                <table>
                    <thead>
                        <tr>
                            <th>Nro.</th>
                            <th>Nombre</th>
                            <th>Posición</th>
                            <th>Uniforme</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan="5" style={{ textAlign: 'center', padding: '3rem' }}>Cargando jugadores...</td></tr>
                        ) : filteredPlayers.length === 0 ? (
                            <tr><td colSpan="5" style={{ textAlign: 'center', padding: '3rem' }}>No se encontraron jugadores.</td></tr>
                        ) : filteredPlayers.map((p, idx) => (
                            <tr key={p.id}>
                                <td>{idx + 1}</td>
                                <td style={{ fontWeight: 600 }}>{p.full_name}</td>
                                <td>
                                    <div>{p.primary_pos_name}</div>
                                    {p.secondary_pos_name && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{p.secondary_pos_name}</div>}
                                </td>
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
                                <td style={{ position: 'relative' }}>
                                    <button
                                        className="btn btn-secondary"
                                        style={{ padding: '0.4rem' }}
                                        title="Acciones"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (openMenuId === p.id) { setOpenMenuId(null); return; }
                                            const rect = e.currentTarget.getBoundingClientRect();
                                            setMenuPos({ top: rect.bottom + 4, left: Math.max(8, rect.right - 190) });
                                            setOpenMenuId(p.id);
                                        }}
                                    >
                                        <MoreVertical size={16} />
                                    </button>
                                    {openMenuId === p.id && createPortal(
                                        <>
                                            <div onClick={() => setOpenMenuId(null)} style={{ position: 'fixed', inset: 0, zIndex: 999 }} />
                                            <div
                                                className="glass"
                                                style={{
                                                    position: 'fixed', top: menuPos.top, left: menuPos.left, zIndex: 1000,
                                                    minWidth: '190px', padding: '0.4rem', display: 'flex', flexDirection: 'column', gap: '0.2rem',
                                                    boxShadow: '0 10px 30px rgba(0,0,0,0.4)',
                                                }}
                                            >
                                                {isSuperAdmin ? (
                                                    <button className="btn btn-secondary" style={{ justifyContent: 'flex-start' }} onClick={() => { setOpenMenuId(null); handleViewCard(p); }}>
                                                        <CreditCard size={14} /> Ver Tarjeta
                                                    </button>
                                                ) : (
                                                    <>
                                                        <button className="btn btn-secondary" style={{ justifyContent: 'flex-start' }} onClick={() => { setOpenMenuId(null); handleOpenEdit(p); }}>
                                                            <Edit2 size={14} /> Editar Datos
                                                        </button>
                                                        <button className="btn btn-secondary" style={{ justifyContent: 'flex-start' }} onClick={() => { setOpenMenuId(null); handleOpenPayment(p); }}>
                                                            <DollarSign size={14} /> Editar Pago
                                                        </button>
                                                        <button className="btn btn-secondary" style={{ justifyContent: 'flex-start' }} onClick={() => { setOpenMenuId(null); viewHistory(p); }}>
                                                            <History size={14} /> Ver Historial
                                                        </button>
                                                        <button className="btn btn-secondary" style={{ justifyContent: 'flex-start' }} onClick={() => { setOpenMenuId(null); handleViewCard(p); }}>
                                                            <CreditCard size={14} /> Ver Tarjeta
                                                        </button>
                                                        <button className="btn btn-secondary" style={{ justifyContent: 'flex-start', color: 'var(--error)' }} onClick={() => { setOpenMenuId(null); handleDelete(p.id); }}>
                                                            <Trash2 size={14} /> Eliminar
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </>,
                                        document.body
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            )}

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
                                    <label className="label">Nombres</label>
                                    <input
                                        type="text" className="input" required
                                        value={editForm.first_name || ''}
                                        onChange={(e) => setEditForm({...editForm, first_name: e.target.value})}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="label">Apellidos</label>
                                    <input
                                        type="text" className="input" required
                                        value={editForm.last_name || ''}
                                        onChange={(e) => setEditForm({...editForm, last_name: e.target.value})}
                                    />
                                </div>
                            </div>

                            <div className="grid-form">
                                <div className="form-group">
                                    <label className="label">Teléfono</label>
                                    <input
                                        type="text" className="input" required
                                        value={editForm.phone}
                                        onChange={(e) => setEditForm({...editForm, phone: e.target.value})}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="label">Email</label>
                                    <input
                                        type="email" className="input"
                                        value={editForm.email || ''}
                                        onChange={(e) => setEditForm({...editForm, email: e.target.value})}
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

                            <div className="form-group">
                                <label className="label">Dirección</label>
                                <input
                                    type="text" className="input"
                                    value={editForm.address || ''}
                                    onChange={(e) => setEditForm({...editForm, address: e.target.value})}
                                />
                            </div>

                            <div className="grid-form" style={{ gridTemplateColumns: '1fr 1fr' }}>
                                <div className="form-group">
                                    <label className="label">Fecha de Nacimiento</label>
                                    <input
                                        type="date" className="input"
                                        value={toDateInputValue(editForm.birth_date)}
                                        onChange={(e) => setEditForm({...editForm, birth_date: e.target.value})}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="label">Nacionalidad</label>
                                    <input
                                        type="text" className="input"
                                        value={editForm.nationality || ''}
                                        onChange={(e) => setEditForm({...editForm, nationality: e.target.value})}
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

                            <div className="grid-form" style={{ gridTemplateColumns: '1fr 1fr' }}>
                                <div className="form-group">
                                    <label className="label">Posición Secundaria</label>
                                    <select
                                        className="select"
                                        value={editForm.secondary_position_id || ''}
                                        onChange={(e) => setEditForm({...editForm, secondary_position_id: e.target.value})}
                                    >
                                        <option value="">Ninguna</option>
                                        {positions.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="label">Posición Terciaria</label>
                                    <select
                                        className="select"
                                        value={editForm.tertiary_position_id || ''}
                                        onChange={(e) => setEditForm({...editForm, tertiary_position_id: e.target.value})}
                                    >
                                        <option value="">Ninguna</option>
                                        {positions.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="grid-form" style={{ gridTemplateColumns: '1fr 1fr' }}>
                                <div className="form-group">
                                    <label className="label">Pie Hábil</label>
                                    <select
                                        className="select"
                                        value={editForm.preferred_foot || ''}
                                        onChange={(e) => setEditForm({...editForm, preferred_foot: e.target.value})}
                                    >
                                        <option value="">Selecciona...</option>
                                        <option value="derecha">Derecha</option>
                                        <option value="izquierda">Izquierda</option>
                                        <option value="ambas">Ambas</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="label">Tipo de Sangre</label>
                                    <select
                                        className="select"
                                        value={editForm.blood_type || ''}
                                        onChange={(e) => setEditForm({...editForm, blood_type: e.target.value})}
                                    >
                                        <option value="">Selecciona...</option>
                                        {BLOOD_TYPES.map(bt => <option key={bt} value={bt}>{bt}</option>)}
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

                            <div className="form-group">
                                <label className="label">Foto (se le quita el fondo automáticamente)</label>
                                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                    {editForm.photo_url && (
                                        <img src={editForm.photo_url} alt="Original" title="Original" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--glass-border)' }} />
                                    )}
                                    {editForm.photo_cutout_url && (
                                        <img
                                            src={editForm.photo_cutout_url} alt="Sin fondo" title="Sin fondo"
                                            style={{
                                                width: 64, height: 64, objectFit: 'cover', borderRadius: 8,
                                                border: '1px solid var(--glass-border)',
                                                backgroundImage: 'linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)',
                                                backgroundSize: '10px 10px',
                                                backgroundPosition: '0 0, 0 5px, 5px -5px, -5px 0px'
                                            }}
                                        />
                                    )}
                                    <button
                                        type="button"
                                        className="btn btn-secondary"
                                        style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                                        onClick={() => { setCameraTarget('edit'); setShowCameraModal(true); }}
                                        disabled={uploadingPhoto}
                                    >
                                        <Camera size={16} /> Tomar foto
                                    </button>
                                    <label className="btn btn-secondary" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <Upload size={16} /> {uploadingPhoto ? 'Quitando fondo...' : 'Subir archivo'}
                                        <input type="file" hidden accept="image/*" onChange={handlePhotoChange} disabled={uploadingPhoto} />
                                    </label>
                                </div>
                                {photoWarning && <p style={{ color: 'var(--warning)', fontSize: '0.8rem', marginTop: '0.5rem' }}>{photoWarning}</p>}
                            </div>

                            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }} disabled={saving}>
                                <Save size={18} /> {saving ? 'Guardando...' : 'Guardar Cambios'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* View Card Modal */}
            {viewingCardData && cardTemplate && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
                    background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)',
                    display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
                }}>
                    <div className="glass" style={{ padding: '2rem', position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem', maxHeight: '90vh', overflowY: 'auto' }}>
                        <button
                            onClick={() => setViewingCardData(null)}
                            style={{ position: 'absolute', right: '1.5rem', top: '1.5rem', background: 'none', border: 'none', color: 'var(--text)' }}
                        >
                            <X size={24} />
                        </button>
                        <h2>Tarjeta del Jugador</h2>
                        <div style={{ width: cardTemplate.canvas_width * cardScale, height: cardTemplate.canvas_height * cardScale, overflow: 'hidden' }}>
                            <div style={{ width: cardTemplate.canvas_width, height: cardTemplate.canvas_height, transform: `scale(${cardScale})`, transformOrigin: 'top left' }}>
                                <PlayerCard ref={cardRef} template={cardTemplate} data={viewingCardData} />
                            </div>
                        </div>
                        <button className="btn btn-primary" style={{ width: '100%' }} onClick={handleDownloadCard} disabled={downloadingCard}>
                            <Download size={18} /> {downloadingCard ? 'Generando...' : 'Descargar PNG'}
                        </button>
                    </div>
                </div>
            )}

            {/* Modal: Inscribir Jugador (Cédula -> BD / Nuevo con foto) */}
            {showEnrollModal && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)',
                    zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
                }}>
                    <div className="glass" style={{ width: '100%', maxWidth: '640px', padding: '2rem', position: 'relative', maxHeight: '92vh', overflowY: 'auto' }}>
                        <button
                            onClick={() => setShowEnrollModal(false)}
                            style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                        >
                            <X size={20} />
                        </button>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
                            <div style={{ padding: '0.6rem', background: 'rgba(56, 189, 248, 0.15)', borderRadius: '12px', color: 'var(--primary)' }}>
                                <UserPlus size={26} />
                            </div>
                            <div>
                                <h2 style={{ margin: 0, fontSize: '1.35rem' }}>Inscribir Jugador al Equipo</h2>
                                <p style={{ margin: '0.2rem 0 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                    Ingresa el documento para verificar si ya existe en la base o registrarlo nuevo con su foto.
                                </p>
                            </div>
                        </div>

                        {/* Paso 1: Digitar Cédula */}
                        <div style={{
                            padding: '1.25rem', background: 'rgba(255, 255, 255, 0.03)',
                            borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.08)',
                            marginBottom: '1.5rem'
                        }}>
                            <label style={{ display: 'block', fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.5rem', color: 'var(--text)' }}>
                                1. Cédula o Documento de Identidad
                            </label>
                            <div style={{ display: 'flex', gap: '0.6rem' }}>
                                <input
                                    type="text"
                                    className="input"
                                    placeholder="Digita el número de documento..."
                                    value={enrollDocNumber}
                                    onChange={(e) => {
                                        const val = e.target.value.replace(/\D/g, '');
                                        setEnrollDocNumber(val);
                                        if (docCheckResult) setDocCheckResult(null);
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            handleCheckDoc();
                                        }
                                    }}
                                    style={{ flex: 1, fontSize: '1.05rem', fontWeight: 600, letterSpacing: '0.5px' }}
                                />
                                <button
                                    type="button"
                                    className="btn btn-primary"
                                    onClick={() => handleCheckDoc()}
                                    disabled={checkingDoc || enrollDocNumber.length < 5}
                                    style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', whiteSpace: 'nowrap', padding: '0.6rem 1.2rem' }}
                                >
                                    {checkingDoc ? <RefreshCw size={16} className="animate-spin" /> : <Search size={16} />}
                                    {checkingDoc ? 'Verificando...' : 'Verificar'}
                                </button>
                            </div>
                        </div>

                        {/* Estado: Conflicto de Torneo / Bloqueado */}
                        {docCheckResult && (docCheckResult.status === 'bloqueado_torneo' || docCheckResult.status === 'bloqueado') && (
                            <div style={{
                                padding: '1rem', borderRadius: '10px',
                                background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.35)',
                                display: 'flex', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '1.5rem'
                            }}>
                                <AlertCircle size={22} color="var(--error)" style={{ flexShrink: 0, marginTop: '2px' }} />
                                <div>
                                    <div style={{ fontWeight: 700, color: 'var(--error)', fontSize: '0.95rem' }}>
                                        {docCheckResult.status === 'bloqueado_torneo' ? 'Conflicto de Torneo' : 'Inscripción No Permitida'}
                                    </div>
                                    <div style={{ fontSize: '0.85rem', color: 'var(--text)', marginTop: '0.25rem' }}>
                                        {docCheckResult.message}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Estado: Jugador Encontrado en Base de Datos (Global o Re-registro) */}
                        {docCheckResult && (docCheckResult.status === 'disponible_global' || docCheckResult.status === 'puede_re_registrar') && (
                            <form onSubmit={handleSaveEnrollPlayer}>
                                <div style={{
                                    padding: '0.75rem 1rem', borderRadius: '8px',
                                    background: 'rgba(34, 197, 94, 0.12)', border: '1px solid rgba(34, 197, 94, 0.3)',
                                    display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem'
                                }}>
                                    <CheckCircle size={18} color="var(--success)" />
                                    <span style={{ fontSize: '0.85rem', color: 'var(--success)', fontWeight: 600 }}>
                                        {docCheckResult.message || 'Jugador encontrado en la base de datos.'}
                                    </span>
                                </div>

                                {/* Ficha de resumen del jugador */}
                                <div style={{
                                    display: 'flex', gap: '1.25rem', padding: '1.25rem',
                                    background: 'rgba(255, 255, 255, 0.03)', borderRadius: '12px',
                                    border: '1px solid rgba(255, 255, 255, 0.08)', marginBottom: '1.5rem',
                                    alignItems: 'center'
                                }}>
                                    {/* Avatar Foto con opción de cambiar */}
                                    <div style={{ position: 'relative', textAlign: 'center', flexShrink: 0 }}>
                                        <div style={{
                                            width: '80px', height: '80px', borderRadius: '50%',
                                            overflow: 'hidden', border: '2px solid var(--primary)',
                                            background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center'
                                        }}>
                                            {enrollPhotoPreview ? (
                                                <img src={enrollPhotoPreview} alt="Foto jugador" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                            ) : (
                                                <UserPlus size={36} color="var(--text-muted)" />
                                            )}
                                        </div>
                                        <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.4rem', justifyContent: 'center' }}>
                                            <button
                                                type="button"
                                                onClick={() => { setCameraTarget('enroll'); setShowCameraModal(true); }}
                                                style={{
                                                    background: 'none', border: 'none', color: 'var(--primary)',
                                                    fontSize: '0.75rem', cursor: 'pointer', textDecoration: 'underline'
                                                }}
                                            >
                                                📷 Tomar
                                            </button>
                                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>|</span>
                                            <button
                                                type="button"
                                                onClick={() => enrollPhotoInputRef.current?.click()}
                                                style={{
                                                    background: 'none', border: 'none', color: 'var(--primary)',
                                                    fontSize: '0.75rem', cursor: 'pointer', textDecoration: 'underline'
                                                }}
                                            >
                                                📁 Subir
                                            </button>
                                        </div>
                                        <input
                                            type="file"
                                            ref={enrollPhotoInputRef}
                                            accept="image/*"
                                            style={{ display: 'none' }}
                                            onChange={handleEnrollPhotoSelect}
                                        />
                                    </div>

                                    {/* Info básica */}
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontWeight: 700, fontSize: '1.15rem', color: 'var(--text)' }}>
                                            {enrollForm.first_name} {enrollForm.last_name}
                                        </div>
                                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                                            {enrollForm.document_type}: <strong>{enrollForm.document_number}</strong>
                                        </div>
                                        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '0.4rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                            {enrollForm.phone && <span>📞 {enrollForm.phone}</span>}
                                            {enrollForm.eps && <span>🏥 EPS: {enrollForm.eps}</span>}
                                            {enrollForm.birth_date && <span>🎂 {enrollForm.birth_date}</span>}
                                        </div>
                                    </div>
                                </div>

                                {/* Asignación para el equipo */}
                                <div style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: '0.75rem', color: 'var(--primary)' }}>
                                    2. Asignación en el Equipo
                                </div>

                                <div className="grid-form" style={{ gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                                    <div className="form-group">
                                        <label className="label">Número de Uniforme (Dorsal) *</label>
                                        <select
                                            className="select"
                                            required
                                            value={enrollForm.uniform_number}
                                            onChange={(e) => setEnrollForm({ ...enrollForm, uniform_number: e.target.value })}
                                        >
                                            <option value="">Selecciona dorsal...</option>
                                            {availableNumbers.map(n => (
                                                <option key={n} value={n}>Dorsal #{n}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="form-group">
                                        <label className="label">Talla de Uniforme</label>
                                        <select
                                            className="select"
                                            value={enrollForm.uniform_size}
                                            onChange={(e) => setEnrollForm({ ...enrollForm, uniform_size: e.target.value })}
                                        >
                                            <option value="XS">XS</option>
                                            <option value="S">S</option>
                                            <option value="M">M</option>
                                            <option value="L">L</option>
                                            <option value="XL">XL</option>
                                            <option value="XXL">XXL</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="grid-form" style={{ gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                                    <div className="form-group">
                                        <label className="label">Posición Principal *</label>
                                        <select
                                            className="select"
                                            required
                                            value={enrollForm.primary_position_id}
                                            onChange={(e) => setEnrollForm({ ...enrollForm, primary_position_id: e.target.value })}
                                        >
                                            <option value="">Seleccionar posición...</option>
                                            {positions.map(p => (
                                                <option key={p.id} value={p.id}>{p.name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="form-group">
                                        <label className="label">Posición Secundaria (Opcional)</label>
                                        <select
                                            className="select"
                                            value={enrollForm.secondary_position_id}
                                            onChange={(e) => setEnrollForm({ ...enrollForm, secondary_position_id: e.target.value })}
                                        >
                                            <option value="">Ninguna</option>
                                            {positions.map(p => (
                                                <option key={p.id} value={p.id}>{p.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                                    <button type="button" className="btn btn-secondary" onClick={() => setShowEnrollModal(false)}>
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        className="btn btn-primary"
                                        disabled={savingEnroll || !enrollForm.uniform_number || !enrollForm.primary_position_id}
                                        style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                                    >
                                        <Save size={16} />
                                        {savingEnroll ? 'Guardando e Inscribiendo...' : 'Guardar e Inscribir'}
                                    </button>
                                </div>
                            </form>
                        )}

                        {/* Estado: Jugador Nuevo (No existe en la DB) */}
                        {docCheckResult && docCheckResult.status === 'disponible' && (
                            <form onSubmit={handleSaveEnrollPlayer}>
                                <div style={{
                                    padding: '0.75rem 1rem', borderRadius: '8px',
                                    background: 'rgba(0, 242, 254, 0.08)', border: '1px solid rgba(0, 242, 254, 0.25)',
                                    display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem'
                                }}>
                                    <UserCheck size={18} color="var(--primary)" />
                                    <span style={{ fontSize: '0.85rem', color: 'var(--primary)', fontWeight: 600 }}>
                                        Jugador Nuevo: Completa sus datos personales, equipo y foto.
                                    </span>
                                </div>

                                {/* Nombres y Apellidos */}
                                <div className="grid-form" style={{ gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '0.85rem' }}>
                                    <div className="form-group">
                                        <label className="label">Nombres *</label>
                                        <input
                                            type="text"
                                            className="input"
                                            required
                                            placeholder="Ej: Carlos Andrés"
                                            value={enrollForm.first_name}
                                            onChange={(e) => setEnrollForm({ ...enrollForm, first_name: e.target.value })}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="label">Apellidos *</label>
                                        <input
                                            type="text"
                                            className="input"
                                            required
                                            placeholder="Ej: Rodríguez Gómez"
                                            value={enrollForm.last_name}
                                            onChange={(e) => setEnrollForm({ ...enrollForm, last_name: e.target.value })}
                                        />
                                    </div>
                                </div>

                                {/* Contacto */}
                                <div className="grid-form" style={{ gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '0.85rem' }}>
                                    <div className="form-group">
                                        <label className="label">Teléfono (10 dígitos) *</label>
                                        <input
                                            type="tel"
                                            className="input"
                                            required
                                            placeholder="Ej: 3001234567"
                                            value={enrollForm.phone}
                                            onChange={(e) => setEnrollForm({ ...enrollForm, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="label">Correo Electrónico</label>
                                        <input
                                            type="email"
                                            className="input"
                                            placeholder="ejemplo@correo.com"
                                            value={enrollForm.email}
                                            onChange={(e) => setEnrollForm({ ...enrollForm, email: e.target.value })}
                                        />
                                    </div>
                                </div>

                                {/* Dirección y Barrio */}
                                <div className="grid-form" style={{ gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '0.85rem' }}>
                                    <div className="form-group">
                                        <label className="label">Dirección</label>
                                        <input
                                            type="text"
                                            className="input"
                                            placeholder="Ej: Calle 45 # 12-34"
                                            value={enrollForm.address}
                                            onChange={(e) => setEnrollForm({ ...enrollForm, address: e.target.value })}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="label">Barrio</label>
                                        <input
                                            type="text"
                                            className="input"
                                            placeholder="Ej: El Poblado"
                                            value={enrollForm.neighborhood}
                                            onChange={(e) => setEnrollForm({ ...enrollForm, neighborhood: e.target.value })}
                                        />
                                    </div>
                                </div>

                                {/* Salud y Nacimiento */}
                                <div className="grid-form" style={{ gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '0.85rem' }}>
                                    <div className="form-group">
                                        <label className="label">EPS</label>
                                        <input
                                            type="text"
                                            className="input"
                                            list="enroll-eps-options"
                                            placeholder="Ej: Sura, Sanitas..."
                                            value={enrollForm.eps}
                                            onChange={(e) => setEnrollForm({ ...enrollForm, eps: e.target.value })}
                                        />
                                        <datalist id="enroll-eps-options">
                                            {epsList.map((eps, i) => (
                                                <option key={i} value={eps} />
                                            ))}
                                        </datalist>
                                    </div>
                                    <div className="form-group">
                                        <label className="label">Fecha de Nacimiento</label>
                                        <input
                                            type="date"
                                            className="input"
                                            value={enrollForm.birth_date}
                                            onChange={(e) => setEnrollForm({ ...enrollForm, birth_date: e.target.value })}
                                        />
                                    </div>
                                </div>

                                {/* Físico */}
                                <div className="grid-form" style={{ gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '0.85rem' }}>
                                    <div className="form-group">
                                        <label className="label">Tipo de Sangre</label>
                                        <select
                                            className="select"
                                            value={enrollForm.blood_type}
                                            onChange={(e) => setEnrollForm({ ...enrollForm, blood_type: e.target.value })}
                                        >
                                            <option value="">Selecciona...</option>
                                            {BLOOD_TYPES.map(b => (
                                                <option key={b} value={b}>{b}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label className="label">Pie Hábil</label>
                                        <select
                                            className="select"
                                            value={enrollForm.preferred_foot}
                                            onChange={(e) => setEnrollForm({ ...enrollForm, preferred_foot: e.target.value })}
                                        >
                                            <option value="">Selecciona...</option>
                                            <option value="Derecho">Derecho</option>
                                            <option value="Izquierdo">Izquierdo</option>
                                            <option value="Ambidiestro">Ambidiestro</option>
                                        </select>
                                    </div>
                                </div>

                                {/* Equipo y Posición */}
                                <div style={{ fontWeight: 600, fontSize: '0.95rem', margin: '1.2rem 0 0.6rem', color: 'var(--primary)' }}>
                                    Asignación en el Equipo
                                </div>

                                <div className="grid-form" style={{ gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '0.85rem' }}>
                                    <div className="form-group">
                                        <label className="label">Número de Uniforme (Dorsal) *</label>
                                        <select
                                            className="select"
                                            required
                                            value={enrollForm.uniform_number}
                                            onChange={(e) => setEnrollForm({ ...enrollForm, uniform_number: e.target.value })}
                                        >
                                            <option value="">Selecciona dorsal...</option>
                                            {availableNumbers.map(n => (
                                                <option key={n} value={n}>Dorsal #{n}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label className="label">Talla de Uniforme</label>
                                        <select
                                            className="select"
                                            value={enrollForm.uniform_size}
                                            onChange={(e) => setEnrollForm({ ...enrollForm, uniform_size: e.target.value })}
                                        >
                                            <option value="XS">XS</option>
                                            <option value="S">S</option>
                                            <option value="M">M</option>
                                            <option value="L">L</option>
                                            <option value="XL">XL</option>
                                            <option value="XXL">XXL</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="grid-form" style={{ gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.2rem' }}>
                                    <div className="form-group">
                                        <label className="label">Posición Principal *</label>
                                        <select
                                            className="select"
                                            required
                                            value={enrollForm.primary_position_id}
                                            onChange={(e) => setEnrollForm({ ...enrollForm, primary_position_id: e.target.value })}
                                        >
                                            <option value="">Seleccionar posición...</option>
                                            {positions.map(p => (
                                                <option key={p.id} value={p.id}>{p.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label className="label">Posición Secundaria (Opcional)</label>
                                        <select
                                            className="select"
                                            value={enrollForm.secondary_position_id}
                                            onChange={(e) => setEnrollForm({ ...enrollForm, secondary_position_id: e.target.value })}
                                        >
                                            <option value="">Ninguna</option>
                                            {positions.map(p => (
                                                <option key={p.id} value={p.id}>{p.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                {/* Foto del Jugador */}
                                <div style={{
                                    padding: '1.25rem', background: 'rgba(255, 255, 255, 0.02)',
                                    borderRadius: '12px', border: '1px dashed rgba(255, 255, 255, 0.15)',
                                    marginBottom: '1.5rem', textAlign: 'center'
                                }}>
                                    <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.25rem' }}>
                                        Fotografía del Jugador
                                    </div>
                                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.8rem' }}>
                                        ✨ El sistema removerá el fondo automáticamente con Inteligencia Artificial para la tarjeta oficial.
                                    </div>

                                    <input
                                        type="file"
                                        ref={enrollPhotoInputRef}
                                        accept="image/*"
                                        style={{ display: 'none' }}
                                        onChange={handleEnrollPhotoSelect}
                                    />

                                    {enrollPhotoPreview ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.6rem' }}>
                                            <div style={{
                                                width: '100px', height: '100px', borderRadius: '50%',
                                                overflow: 'hidden', border: '3px solid var(--primary)',
                                                boxShadow: '0 4px 14px rgba(0, 242, 254, 0.25)'
                                            }}>
                                                <img src={enrollPhotoPreview} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                            </div>
                                            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                                                <button
                                                    type="button"
                                                    className="btn btn-secondary"
                                                    style={{ padding: '0.35rem 0.8rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                                                    onClick={() => { setCameraTarget('enroll'); setShowCameraModal(true); }}
                                                >
                                                    <Camera size={14} /> Tomar de nuevo
                                                </button>
                                                <button
                                                    type="button"
                                                    className="btn btn-secondary"
                                                    style={{ padding: '0.35rem 0.8rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                                                    onClick={() => enrollPhotoInputRef.current?.click()}
                                                >
                                                    <Upload size={14} /> Cambiar archivo
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                                            <button
                                                type="button"
                                                className="btn btn-primary"
                                                onClick={() => { setCameraTarget('enroll'); setShowCameraModal(true); }}
                                                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', padding: '0.6rem 1.2rem' }}
                                            >
                                                <Camera size={16} /> Tomar Foto
                                            </button>
                                            <button
                                                type="button"
                                                className="btn btn-secondary"
                                                onClick={() => enrollPhotoInputRef.current?.click()}
                                                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', padding: '0.6rem 1.2rem' }}
                                            >
                                                <Upload size={16} /> Subir Archivo
                                            </button>
                                        </div>
                                    )}
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                                    <button type="button" className="btn btn-secondary" onClick={() => setShowEnrollModal(false)}>
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        className="btn btn-primary"
                                        disabled={savingEnroll || !enrollForm.first_name || !enrollForm.last_name || !enrollForm.uniform_number || !enrollForm.primary_position_id}
                                        style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                                    >
                                        <Save size={16} />
                                        {savingEnroll ? 'Guardando e Inscribiendo...' : 'Guardar e Inscribir Jugador'}
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            )}

            {/* Modal: Inscribir de Base Global */}
            {showGlobalEnrollModal && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)',
                    zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
                }}>
                    <div className="glass" style={{ width: '100%', maxWidth: '560px', padding: '2rem', position: 'relative', maxHeight: '90vh', overflowY: 'auto' }}>
                        <button
                            onClick={() => setShowGlobalEnrollModal(false)}
                            style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                        >
                            <X size={20} />
                        </button>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
                            <div style={{ padding: '0.5rem', background: 'rgba(0, 242, 254, 0.1)', borderRadius: '10px', color: 'var(--primary)' }}>
                                <UserPlus size={22} />
                            </div>
                            <div>
                                <h2 style={{ margin: 0, fontSize: '1.3rem' }}>Inscribir Jugador de la Base Global</h2>
                                <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                    Busca un jugador registrado en la plataforma para incorporarlo a este equipo.
                                </p>
                            </div>
                        </div>

                        {!selectedGlobalPlayer ? (
                            <div>
                                <div className="form-group" style={{ marginBottom: '1rem' }}>
                                    <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                        Buscar por documento o nombre
                                    </label>
                                    <input
                                        type="text"
                                        className="input"
                                        placeholder="Ej: 102030... o Carlos"
                                        value={globalSearchTerm}
                                        onChange={(e) => handleSearchGlobal(e.target.value)}
                                        style={{ width: '100%' }}
                                        autoFocus
                                    />
                                </div>

                                {searchingGlobal && <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Buscando...</p>}

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '280px', overflowY: 'auto' }}>
                                    {globalSearchResults.map(p => (
                                        <div
                                            key={p.document_number}
                                            onClick={() => setSelectedGlobalPlayer(p)}
                                            style={{
                                                padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.04)',
                                                borderRadius: '8px', display: 'flex', justifyContent: 'space-between',
                                                alignItems: 'center', cursor: 'pointer', border: '1px solid rgba(255,255,255,0.08)'
                                            }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                <div style={{
                                                    width: '40px', height: '40px', borderRadius: '8px',
                                                    background: 'rgba(255,255,255,0.05)', overflow: 'hidden',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                                                }}>
                                                    {p.photo_cutout_url || p.photo_url ? (
                                                        <img src={p.photo_cutout_url || p.photo_url} alt={p.full_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                    ) : (
                                                        <span style={{ fontWeight: 800, color: 'var(--primary)' }}>{p.full_name?.charAt(0)}</span>
                                                    )}
                                                </div>
                                                <div>
                                                    <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{p.full_name}</div>
                                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                                        Doc: {p.document_number} {p.position ? `| ${p.position}` : ''}
                                                    </div>
                                                    {p.teams?.length > 0 && (
                                                        <div style={{ fontSize: '0.75rem', color: 'var(--primary)' }}>
                                                            Equipos actuales: {p.teams.map(t => `${t.team_name} (${t.tournament_name || 'Sin torneo'})`).join(', ')}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            <button className="btn btn-primary" style={{ padding: '0.3rem 0.75rem', fontSize: '0.75rem' }}>
                                                Seleccionar
                                            </button>
                                        </div>
                                    ))}
                                    {globalSearchTerm.length >= 2 && !searchingGlobal && globalSearchResults.length === 0 && (
                                        <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                            No se encontraron jugadores con ese término en la base global.
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <form onSubmit={handleEnrollGlobalPlayer} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <div style={{
                                    padding: '0.75rem 1rem', background: 'rgba(0, 242, 254, 0.05)',
                                    borderRadius: '8px', border: '1px solid rgba(0, 242, 254, 0.2)',
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                                }}>
                                    <div>
                                        <div style={{ fontWeight: 700, fontSize: '1rem' }}>{selectedGlobalPlayer.full_name}</div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Doc: {selectedGlobalPlayer.document_number}</div>
                                    </div>
                                    <button
                                        type="button"
                                        className="btn btn-secondary"
                                        style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                                        onClick={() => setSelectedGlobalPlayer(null)}
                                    >
                                        Cambiar
                                    </button>
                                </div>

                                <div className="form-group">
                                    <label style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                        Dorsal / Número de Camiseta en este equipo
                                    </label>
                                    <input
                                        type="number"
                                        className="input"
                                        placeholder="Ej: 7"
                                        value={enrollUniformNumber}
                                        onChange={(e) => setEnrollUniformNumber(e.target.value)}
                                        style={{ width: '100%' }}
                                    />
                                </div>

                                <div className="form-group">
                                    <label style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                        Posición Principal
                                    </label>
                                    <select
                                        className="select"
                                        value={enrollPositionId}
                                        onChange={(e) => setEnrollPositionId(e.target.value)}
                                        style={{ width: '100%' }}
                                    >
                                        <option value="">Seleccionar posición...</option>
                                        {positions.map(pos => (
                                            <option key={pos.id} value={pos.id}>{pos.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                                    <button type="button" className="btn btn-secondary" onClick={() => setSelectedGlobalPlayer(null)}>
                                        Atrás
                                    </button>
                                    <button type="submit" className="btn btn-primary" disabled={enrolling}>
                                        {enrolling ? 'Validando e Inscribiendo...' : 'Confirmar Inscripción'}
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            )}

            {/* Modal: Carga Masiva Excel */}
            {showExcelModal && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)',
                    zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
                }}>
                    <div className="glass" style={{ width: '100%', maxWidth: '580px', padding: '2rem', position: 'relative', maxHeight: '90vh', overflowY: 'auto' }}>
                        <button
                            onClick={() => setShowExcelModal(false)}
                            style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                        >
                            <X size={20} />
                        </button>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                            <div style={{ padding: '0.5rem', background: 'rgba(34, 197, 94, 0.15)', borderRadius: '10px', color: 'var(--success)' }}>
                                <FileSpreadsheet size={24} />
                            </div>
                            <div>
                                <h2 style={{ margin: 0, fontSize: '1.35rem' }}>Carga Masiva de Jugadores al Equipo</h2>
                                <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                    Inscribe jugadores masivamente desde un archivo Excel (.xlsx / .csv).
                                </p>
                            </div>
                        </div>

                        {/* Step 1: Download Template */}
                        <div style={{
                            padding: '1rem', background: 'rgba(0, 242, 254, 0.05)', borderRadius: '10px',
                            border: '1px solid rgba(0, 242, 254, 0.2)', marginBottom: '1.5rem',
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                        }}>
                            <div>
                                <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--primary)' }}>
                                    1. Plantilla oficial de jugadores
                                </div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                    Descarga la estructura con las columnas necesarias.
                                </div>
                            </div>
                            <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={handleDownloadTemplate}
                                style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                            >
                                <Download size={15} /> Descargar .xlsx
                            </button>
                        </div>

                        {/* Step 2: Upload File */}
                        <form onSubmit={handleExcelUpload}>
                            <div
                                onClick={() => excelInputRef.current?.click()}
                                style={{
                                    border: '2px dashed rgba(255,255,255,0.2)',
                                    borderRadius: '12px',
                                    padding: '2rem 1rem',
                                    textAlign: 'center',
                                    cursor: 'pointer',
                                    background: excelFile ? 'rgba(34, 197, 94, 0.05)' : 'rgba(255,255,255,0.02)',
                                    marginBottom: '1.5rem'
                                }}
                            >
                                <input
                                    type="file"
                                    ref={excelInputRef}
                                    accept=".xlsx,.xls,.csv"
                                    style={{ display: 'none' }}
                                    onChange={(e) => setExcelFile(e.target.files[0] || null)}
                                />
                                <Upload size={32} color={excelFile ? 'var(--success)' : 'var(--text-muted)'} style={{ margin: '0 auto 0.5rem' }} />
                                {excelFile ? (
                                    <div>
                                        <div style={{ fontWeight: 700, color: 'var(--success)' }}>{excelFile.name}</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{(excelFile.size / 1024).toFixed(1)} KB - Clic para cambiar</div>
                                    </div>
                                ) : (
                                    <div>
                                        <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>Selecciona tu archivo Excel diligenciado</div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Formatos: .xlsx, .xls, .csv</div>
                                    </div>
                                )}
                            </div>

                            {/* Result Report */}
                            {excelResult && (
                                <div style={{
                                    padding: '1rem',
                                    borderRadius: '8px',
                                    background: excelResult.errors?.length > 0 ? 'rgba(239, 68, 68, 0.1)' : 'rgba(34, 197, 94, 0.1)',
                                    border: excelResult.errors?.length > 0 ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(34, 197, 94, 0.3)',
                                    marginBottom: '1.5rem'
                                }}>
                                    <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '0.4rem', color: excelResult.errors?.length > 0 ? 'var(--warning)' : 'var(--success)' }}>
                                        Resultado de la importación:
                                    </div>
                                    <div style={{ fontSize: '0.85rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                                        <span>Total filas: <strong>{excelResult.total}</strong></span>
                                        <span style={{ color: 'var(--success)' }}>Inscritos: <strong>{excelResult.imported}</strong></span>
                                        <span style={{ color: 'var(--primary)' }}>Actualizados: <strong>{excelResult.updated}</strong></span>
                                        {excelResult.errors?.length > 0 && (
                                            <span style={{ color: 'var(--error)' }}>Rechazados / Errores: <strong>{excelResult.errors.length}</strong></span>
                                        )}
                                    </div>

                                    {excelResult.errors?.length > 0 && (
                                        <div style={{ marginTop: '0.75rem', maxHeight: '140px', overflowY: 'auto', fontSize: '0.8rem' }}>
                                            {excelResult.errors.map((err, i) => (
                                                <div key={i} style={{ color: 'var(--error)', marginBottom: '0.25rem' }}>
                                                    • Fila {err.row}: {err.document ? `[Doc: ${err.document}] ` : ''}{err.name ? `${err.name} - ` : ''}{err.error}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                                <button type="button" className="btn btn-secondary" onClick={() => setShowExcelModal(false)}>
                                    Cerrar
                                </button>
                                <button
                                    type="submit"
                                    className="btn btn-primary"
                                    disabled={!excelFile || uploadingExcel}
                                    style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                                >
                                    <FileSpreadsheet size={16} />
                                    {uploadingExcel ? 'Validando y Cargando...' : 'Procesar e Inscribir'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Off-screen render target for batch ZIP export — same PlayerCard component, one player at a time */}
            {cardTemplate && exportPlayerData && (
                <div style={{ position: 'fixed', left: '-9999px', top: 0 }}>
                    <PlayerCard ref={exportCardRef} template={cardTemplate} data={exportPlayerData} />
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

export default PlayersList;
