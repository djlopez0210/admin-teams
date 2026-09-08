import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Users, BarChart3, Calendar, Settings as SettingsIcon, Plus, FileSpreadsheet,
    Download, Upload, Search, Trash2, Edit2, CheckCircle2, AlertCircle, ArrowLeft,
    Shield, MapPin, Check, X, Clock, Award, ChevronRight, UserPlus
} from 'lucide-react';
import { communityService, globalPlayerService } from '../services/api';
import { useNotification } from '../context/NotificationContext';
import { isSessionValid } from '../utils/session';

const CommunityDetail = () => {
    const { communityId } = useParams();
    const navigate = useNavigate();
    const { showNotification } = useNotification();
    const isSuperAdmin = isSessionValid() && localStorage.getItem('adminRole') === 'superadmin';

    const [activeTab, setActiveTab] = useState('players');
    const [community, setCommunity] = useState(null);
    const [loading, setLoading] = useState(true);

    // Players Tab State
    const [players, setPlayers] = useState([]);
    const [playersLoading, setPlayersLoading] = useState(false);
    const [playerSearch, setPlayerSearch] = useState('');
    const [showAddPlayerModal, setShowAddPlayerModal] = useState(false);
    const [addPlayerMode, setAddPlayerMode] = useState('search'); // 'search' or 'create'
    const [globalSearchQuery, setGlobalSearchQuery] = useState('');
    const [globalResults, setGlobalResults] = useState([]);
    const [searchingGlobal, setSearchingGlobal] = useState(false);
    const [newPlayerForm, setNewPlayerForm] = useState({
        document_number: '',
        first_name: '',
        last_name: '',
        full_name: '',
        phone: '',
        email: '',
        position: '',
        jersey_number: '',
        role: 'MEMBER'
    });

    // Excel Mass Upload State
    const [showExcelModal, setShowExcelModal] = useState(false);
    const [excelFile, setExcelFile] = useState(null);
    const [uploadingExcel, setUploadingExcel] = useState(false);
    const [excelResult, setExcelResult] = useState(null);
    const fileInputRef = useRef(null);

    // Polls Tab State
    const [polls, setPolls] = useState([]);
    const [pollsLoading, setPollsLoading] = useState(false);
    const [showCreatePollModal, setShowCreatePollModal] = useState(false);
    const [newPoll, setNewPoll] = useState({
        question: '',
        description: '',
        expires_at: '',
        options: ['', '']
    });
    const [votingId, setVotingId] = useState(null);

    // Matches Tab State
    const [matches, setMatches] = useState([]);
    const [matchesLoading, setMatchesLoading] = useState(false);
    const [showCreateMatchModal, setShowCreateMatchModal] = useState(false);
    const [newMatch, setNewMatch] = useState({
        title: '',
        match_date: '',
        location: '',
        team_a_name: 'Bando Azul',
        team_b_name: 'Bando Rojo',
        notes: ''
    });
    const [selectedMatchForRoster, setSelectedMatchForRoster] = useState(null);

    // Settings Tab State
    const [editCommunityForm, setEditCommunityForm] = useState({
        name: '',
        city: '',
        description: '',
        logo_url: '',
        cover_url: '',
        is_active: true
    });
    const [savingSettings, setSavingSettings] = useState(false);

    useEffect(() => {
        loadCommunityData();
    }, [communityId]);

    useEffect(() => {
        if (activeTab === 'players') loadPlayers();
        if (activeTab === 'polls') loadPolls();
        if (activeTab === 'matches') loadMatches();
    }, [activeTab, communityId]);

    const loadCommunityData = async () => {
        setLoading(true);
        try {
            const res = await communityService.get(communityId);
            setCommunity(res.data);
            setEditCommunityForm({
                name: res.data.name || '',
                city: res.data.city || '',
                description: res.data.description || '',
                logo_url: res.data.logo_url || '',
                cover_url: res.data.cover_url || '',
                is_active: res.data.is_active !== undefined ? res.data.is_active : true
            });
        } catch (err) {
            console.error('Error loading community:', err);
            showNotification('Error al cargar la información de la comunidad', 'error');
        } finally {
            setLoading(false);
        }
    };

    // --- PLAYERS LOGIC ---
    const loadPlayers = async () => {
        setPlayersLoading(true);
        try {
            const res = await communityService.getPlayers(communityId);
            setPlayers(res.data);
        } catch (err) {
            console.error('Error loading players:', err);
        } finally {
            setPlayersLoading(false);
        }
    };

    const handleGlobalSearch = async (val) => {
        setGlobalSearchQuery(val);
        if (val.trim().length >= 2) {
            setSearchingGlobal(true);
            try {
                const res = await globalPlayerService.search(val.trim());
                setGlobalResults(res.data);
            } catch (err) {
                console.error(err);
            } finally {
                setSearchingGlobal(false);
            }
        } else {
            setGlobalResults([]);
        }
    };

    const handleSelectGlobalPlayer = (p) => {
        let fn = p.first_name || '';
        let ln = p.last_name || '';
        if (!fn && !ln && p.full_name) {
            const parts = p.full_name.trim().split(' ');
            fn = parts.shift() || '';
            ln = parts.join(' ');
        }
        setNewPlayerForm({
            document_number: p.document_number,
            first_name: fn,
            last_name: ln,
            full_name: p.full_name || (fn && ln ? `${fn} ${ln}` : ''),
            phone: p.phone || '',
            email: p.email || '',
            position: p.position || '',
            jersey_number: '',
            role: 'MEMBER'
        });
        setAddPlayerMode('create');
    };

    const handleAddPlayerSubmit = async (e) => {
        e.preventDefault();
        const fn = (newPlayerForm.first_name || '').trim();
        const ln = (newPlayerForm.last_name || '').trim();
        const full = fn && ln ? `${fn} ${ln}` : (newPlayerForm.full_name || `${fn} ${ln}`).trim();

        if (!newPlayerForm.document_number.trim() || (!fn && !full)) {
            showNotification('Documento, nombres y apellidos son obligatorios', 'warning');
            return;
        }

        const payload = {
            ...newPlayerForm,
            first_name: fn,
            last_name: ln,
            full_name: full
        };

        try {
            await communityService.addPlayer(communityId, payload);
            showNotification('Jugador inscrito exitosamente en la comunidad', 'success');
            setShowAddPlayerModal(false);
            setNewPlayerForm({
                document_number: '', first_name: '', last_name: '', full_name: '', phone: '',
                email: '', position: '', jersey_number: '', role: 'MEMBER'
            });
            setGlobalSearchQuery('');
            setGlobalResults([]);
            loadPlayers();
            loadCommunityData();
        } catch (err) {
            console.error(err);
            showNotification(err.response?.data?.error || 'Error al inscribir jugador', 'error');
        }
    };

    const handleRemovePlayer = async (cpId, playerName) => {
        if (!window.confirm(`¿Estás seguro de desvincular a ${playerName} de esta comunidad?`)) return;
        try {
            await communityService.removePlayer(communityId, cpId);
            showNotification('Jugador desvinculado de la comunidad', 'success');
            loadPlayers();
            loadCommunityData();
        } catch (err) {
            showNotification('Error al desvincular jugador', 'error');
        }
    };

    // --- EXCEL MASS IMPORT LOGIC ---
    const handleDownloadTemplate = async () => {
        try {
            const res = await communityService.downloadTemplate();
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', 'plantilla_jugadores.xlsx');
            document.body.appendChild(link);
            link.click();
            link.remove();
            showNotification('Plantilla descargada correctamente', 'success');
        } catch (err) {
            showNotification('Error al descargar la plantilla', 'error');
        }
    };

    const handleExcelUpload = async (e) => {
        e.preventDefault();
        if (!excelFile) {
            showNotification('Por favor selecciona un archivo Excel (.xlsx, .xls o .csv)', 'warning');
            return;
        }
        setUploadingExcel(true);
        setExcelResult(null);
        try {
            const res = await communityService.importExcel(communityId, excelFile);
            setExcelResult(res.data);
            showNotification(`Importación completada: ${res.data.imported} nuevos, ${res.data.updated} actualizados`, 'success');
            loadPlayers();
            loadCommunityData();
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

    // --- POLLS LOGIC ---
    const loadPolls = async () => {
        setPollsLoading(true);
        try {
            const res = await communityService.getPolls(communityId);
            setPolls(res.data);
        } catch (err) {
            console.error('Error loading polls:', err);
        } finally {
            setPollsLoading(false);
        }
    };

    const handleVote = async (pollId, optionId) => {
        setVotingId(pollId);
        try {
            await communityService.votePoll(pollId, { option_id: optionId });
            showNotification('¡Voto registrado!', 'success');
            loadPolls();
        } catch (err) {
            showNotification(err.response?.data?.error || 'Error al votar', 'error');
        } finally {
            setVotingId(null);
        }
    };

    const handleTogglePoll = async (pollId) => {
        try {
            const res = await communityService.togglePoll(pollId);
            showNotification(`Encuesta ${res.data.is_active ? 'abierta' : 'cerrada'}`, 'info');
            loadPolls();
        } catch (err) {
            showNotification('Error al cambiar estado de la encuesta', 'error');
        }
    };

    const handleDeletePoll = async (pollId) => {
        if (!window.confirm('¿Eliminar esta encuesta definitivamente?')) return;
        try {
            await communityService.deletePoll(pollId);
            showNotification('Encuesta eliminada', 'success');
            loadPolls();
            loadCommunityData();
        } catch (err) {
            showNotification('Error al eliminar encuesta', 'error');
        }
    };

    const handleAddPollOption = () => {
        setNewPoll({ ...newPoll, options: [...newPoll.options, ''] });
    };

    const handleRemovePollOption = (idx) => {
        if (newPoll.options.length <= 2) return;
        const opts = [...newPoll.options];
        opts.splice(idx, 1);
        setNewPoll({ ...newPoll, options: opts });
    };

    const handlePollOptionChange = (idx, val) => {
        const opts = [...newPoll.options];
        opts[idx] = val;
        setNewPoll({ ...newPoll, options: opts });
    };

    const handleCreatePollSubmit = async (e) => {
        e.preventDefault();
        const validOpts = newPoll.options.map(o => o.trim()).filter(Boolean);
        if (!newPoll.question.trim()) {
            showNotification('La pregunta es obligatoria', 'warning');
            return;
        }
        if (validOpts.length < 2) {
            showNotification('Debes ingresar al menos 2 opciones de respuesta', 'warning');
            return;
        }
        try {
            await communityService.createPoll(communityId, {
                question: newPoll.question,
                description: newPoll.description,
                expires_at: newPoll.expires_at || null,
                options: validOpts
            });
            showNotification('Encuesta creada exitosamente', 'success');
            setShowCreatePollModal(false);
            setNewPoll({ question: '', description: '', expires_at: '', options: ['', ''] });
            loadPolls();
            loadCommunityData();
        } catch (err) {
            showNotification(err.response?.data?.error || 'Error al crear encuesta', 'error');
        }
    };

    // --- MATCHES LOGIC ---
    const loadMatches = async () => {
        setMatchesLoading(true);
        try {
            const res = await communityService.getMatches(communityId);
            setMatches(res.data);
        } catch (err) {
            console.error('Error loading matches:', err);
        } finally {
            setMatchesLoading(false);
        }
    };

    const handleCreateMatchSubmit = async (e) => {
        e.preventDefault();
        if (!newMatch.title.trim()) {
            showNotification('El título o motivo del encuentro es obligatorio', 'warning');
            return;
        }
        try {
            await communityService.createMatch(communityId, newMatch);
            showNotification('Encuentro deportivo programado exitosamente', 'success');
            setShowCreateMatchModal(false);
            setNewMatch({
                title: '', match_date: '', location: '',
                team_a_name: 'Bando Azul', team_b_name: 'Bando Rojo', notes: ''
            });
            loadMatches();
            loadCommunityData();
        } catch (err) {
            showNotification(err.response?.data?.error || 'Error al crear encuentro', 'error');
        }
    };

    const handleUpdateScore = async (matchId, scoreA, scoreB, newStatus) => {
        try {
            await communityService.updateMatch(matchId, {
                team_a_score: scoreA,
                team_b_score: scoreB,
                status: newStatus
            });
            showNotification('Marcador actualizado', 'success');
            loadMatches();
        } catch (err) {
            showNotification('Error al actualizar marcador', 'error');
        }
    };

    const handleDeleteMatch = async (matchId) => {
        if (!window.confirm('¿Eliminar este encuentro deportivo?')) return;
        try {
            await communityService.deleteMatch(matchId);
            showNotification('Encuentro eliminado', 'success');
            loadMatches();
            loadCommunityData();
        } catch (err) {
            showNotification('Error al eliminar encuentro', 'error');
        }
    };

    // --- SETTINGS LOGIC ---
    const handleSettingsSubmit = async (e) => {
        e.preventDefault();
        if (!isSuperAdmin) {
            showNotification('Solo un superadministrador puede modificar la comunidad', 'warning');
            return;
        }
        setSavingSettings(true);
        try {
            await communityService.update(communityId, editCommunityForm);
            showNotification('Información de la comunidad actualizada', 'success');
            loadCommunityData();
        } catch (err) {
            showNotification(err.response?.data?.error || 'Error al guardar cambios', 'error');
        } finally {
            setSavingSettings(false);
        }
    };

    const handleDeleteCommunity = async () => {
        if (!isSuperAdmin) {
            showNotification('Solo un superadministrador puede eliminar la comunidad', 'warning');
            return;
        }
        if (!window.confirm('¡ATENCIÓN! ¿Estás seguro de eliminar esta comunidad y todos sus datos relacionados (jugadores, encuestas, partidos)? Esta acción no se puede deshacer.')) return;
        try {
            await communityService.delete(communityId);
            showNotification('Comunidad eliminada', 'info');
            navigate('/communities');
        } catch (err) {
            showNotification('Error al eliminar comunidad', 'error');
        }
    };

    if (loading) {
        return (
            <div className="container" style={{ textAlign: 'center', padding: '6rem 0' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>⚽</div>
                <p style={{ color: 'var(--text-muted)' }}>Cargando comunidad...</p>
            </div>
        );
    }

    if (!community) {
        return (
            <div className="container" style={{ textAlign: 'center', padding: '6rem 0' }}>
                <h2>Comunidad no encontrada</h2>
                <button className="btn btn-primary" onClick={() => navigate('/communities')} style={{ marginTop: '1rem' }}>
                    <ArrowLeft size={16} /> Volver a Comunidades
                </button>
            </div>
        );
    }

    return (
        <div className="container animate-fade-in" style={{ paddingBottom: '4rem' }}>
            {/* Top Navigation Back */}
            <div style={{ marginBottom: '1.25rem' }}>
                <button
                    onClick={() => navigate('/communities')}
                    className="btn btn-secondary"
                    style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                >
                    <ArrowLeft size={15} /> Todas las Comunidades
                </button>
            </div>

            {/* Banner & Header */}
            <div className="glass" style={{ overflow: 'hidden', marginBottom: '2rem' }}>
                <div style={{
                    height: '140px',
                    background: community.cover_url
                        ? `url(${community.cover_url}) center/cover no-repeat`
                        : 'linear-gradient(135deg, rgba(0, 242, 254, 0.25) 0%, rgba(79, 172, 254, 0.15) 100%)',
                    position: 'relative'
                }} />

                <div style={{ padding: '0 2rem 1.5rem 2rem' }}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'flex-end',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '1rem',
                        marginTop: '-50px',
                        marginBottom: '1rem'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '1.25rem' }}>
                            <div style={{
                                width: '88px',
                                height: '88px',
                                borderRadius: '16px',
                                background: 'var(--surface)',
                                border: '3px solid var(--primary)',
                                overflow: 'hidden',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                boxShadow: '0 6px 20px rgba(0,0,0,0.4)',
                                flexShrink: 0
                            }}>
                                {community.logo_url ? (
                                    <img src={community.logo_url} alt={community.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                    <Shield size={44} color="var(--primary)" />
                                )}
                            </div>
                            <div>
                                <h1 style={{ margin: 0, fontSize: '1.9rem', color: 'var(--text)' }}>
                                    {community.name}
                                </h1>
                                {community.city && (
                                    <p style={{ margin: '0.25rem 0 0 0', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.9rem' }}>
                                        <MapPin size={14} color="var(--primary)" /> {community.city}
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Quick Stats */}
                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                            <div style={{ padding: '0.5rem 1rem', background: 'rgba(255,255,255,0.05)', borderRadius: '10px', textAlign: 'center' }}>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Jugadores</div>
                                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--primary)' }}>{community.total_players || 0}</div>
                            </div>
                            <div style={{ padding: '0.5rem 1rem', background: 'rgba(255,255,255,0.05)', borderRadius: '10px', textAlign: 'center' }}>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Encuestas</div>
                                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#f093fb' }}>{community.total_polls || 0}</div>
                            </div>
                            <div style={{ padding: '0.5rem 1rem', background: 'rgba(255,255,255,0.05)', borderRadius: '10px', textAlign: 'center' }}>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Partidos</div>
                                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--success)' }}>{community.total_matches || 0}</div>
                            </div>
                        </div>
                    </div>

                    {community.description && (
                        <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.95rem', lineHeight: 1.6 }}>
                            {community.description}
                        </p>
                    )}
                </div>
            </div>

            {/* Navigation Tabs */}
            <div style={{
                display: 'flex',
                gap: '0.5rem',
                borderBottom: '1px solid var(--glass-border)',
                marginBottom: '2rem',
                overflowX: 'auto',
                paddingBottom: '0.5rem'
            }}>
                <button
                    onClick={() => setActiveTab('players')}
                    className="btn"
                    style={{
                        background: activeTab === 'players' ? 'var(--primary)' : 'transparent',
                        color: activeTab === 'players' ? '#000' : 'var(--text-muted)',
                        fontWeight: 700,
                        gap: '0.5rem'
                    }}
                >
                    <Users size={18} /> Jugadores ({community.total_players || 0})
                </button>

                <button
                    onClick={() => setActiveTab('polls')}
                    className="btn"
                    style={{
                        background: activeTab === 'polls' ? '#f093fb' : 'transparent',
                        color: activeTab === 'polls' ? '#000' : 'var(--text-muted)',
                        fontWeight: 700,
                        gap: '0.5rem'
                    }}
                >
                    <BarChart3 size={18} /> Encuestas ({community.active_polls || 0})
                </button>

                <button
                    onClick={() => setActiveTab('matches')}
                    className="btn"
                    style={{
                        background: activeTab === 'matches' ? 'var(--success)' : 'transparent',
                        color: activeTab === 'matches' ? '#000' : 'var(--text-muted)',
                        fontWeight: 700,
                        gap: '0.5rem'
                    }}
                >
                    <Calendar size={18} /> Encuentros Deportivos ({community.total_matches || 0})
                </button>

                {isSuperAdmin && (
                    <button
                        onClick={() => setActiveTab('settings')}
                        className="btn"
                        style={{
                            background: activeTab === 'settings' ? 'rgba(255,255,255,0.15)' : 'transparent',
                            color: activeTab === 'settings' ? 'var(--text)' : 'var(--text-muted)',
                            fontWeight: 700,
                            gap: '0.5rem',
                            marginLeft: 'auto'
                        }}
                    >
                        <SettingsIcon size={18} /> Configuración
                    </button>
                )}
            </div>

            {/* TAB 1: PLAYERS */}
            {activeTab === 'players' && (
                <div>
                    {/* Controls */}
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '1rem',
                        marginBottom: '1.5rem'
                    }}>
                        <div className="glass" style={{ padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: '280px' }}>
                            <Search size={18} color="var(--text-muted)" />
                            <input
                                type="text"
                                placeholder="Filtrar por nombre, doc o posición..."
                                value={playerSearch}
                                onChange={(e) => setPlayerSearch(e.target.value)}
                                style={{ background: 'none', border: 'none', color: 'var(--text)', outline: 'none', width: '100%' }}
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                            <button
                                className="btn btn-secondary"
                                onClick={() => { setShowExcelModal(true); setExcelResult(null); setExcelFile(null); }}
                                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                            >
                                <FileSpreadsheet size={18} color="var(--success)" /> Carga Masiva Excel
                            </button>

                            <button
                                className="btn btn-primary"
                                onClick={() => { setShowAddPlayerModal(true); setAddPlayerMode('search'); }}
                                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                            >
                                <UserPlus size={18} /> Inscribir Jugador
                            </button>
                        </div>
                    </div>

                    {/* Players List Grid */}
                    {playersLoading ? (
                        <div style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--text-muted)' }}>
                            Cargando jugadores inscritos...
                        </div>
                    ) : players.length === 0 ? (
                        <div className="glass" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
                            <Users size={48} color="var(--text-muted)" style={{ opacity: 0.5, marginBottom: '1rem' }} />
                            <h3>No hay jugadores inscritos en esta comunidad</h3>
                            <p style={{ color: 'var(--text-muted)', maxWidth: '440px', margin: '0.5rem auto 1.5rem' }}>
                                Inscribe jugadores individualmente desde la base global o realiza una carga masiva subiendo un archivo Excel.
                            </p>
                            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem' }}>
                                <button className="btn btn-primary" onClick={() => setShowAddPlayerModal(true)}>
                                    <Plus size={16} /> Inscribir Jugador
                                </button>
                                <button className="btn btn-secondary" onClick={() => setShowExcelModal(true)}>
                                    <FileSpreadsheet size={16} color="var(--success)" /> Cargar Excel
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                            gap: '1.25rem'
                        }}>
                            {players
                                .filter(p =>
                                    p.full_name.toLowerCase().includes(playerSearch.toLowerCase()) ||
                                    p.document_number.includes(playerSearch) ||
                                    (p.position && p.position.toLowerCase().includes(playerSearch.toLowerCase()))
                                )
                                .map(p => (
                                    <div key={p.id} className="glass" style={{ padding: '1.25rem', position: 'relative', display: 'flex', flexDirection: 'column' }}>
                                        <div style={{ display: 'flex', gap: '0.85rem', alignItems: 'center', marginBottom: '0.75rem' }}>
                                            <div style={{
                                                width: '50px',
                                                height: '50px',
                                                borderRadius: '12px',
                                                background: 'rgba(255,255,255,0.05)',
                                                border: '1px solid rgba(255,255,255,0.1)',
                                                overflow: 'hidden',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                flexShrink: 0
                                            }}>
                                                {p.photo_cutout_url || p.photo_url ? (
                                                    <img src={p.photo_cutout_url || p.photo_url} alt={p.full_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                ) : (
                                                    <span style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--primary)' }}>
                                                        {p.full_name.charAt(0)}
                                                    </span>
                                                )}
                                            </div>

                                            <div style={{ overflow: 'hidden' }}>
                                                <h4 style={{ margin: 0, fontSize: '1.05rem', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                                                    {p.full_name}
                                                </h4>
                                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                                    Doc: {p.document_number}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Details row */}
                                        <div style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            fontSize: '0.8rem',
                                            background: 'rgba(255,255,255,0.03)',
                                            padding: '0.4rem 0.6rem',
                                            borderRadius: '6px',
                                            marginTop: 'auto',
                                            marginBottom: '0.75rem'
                                        }}>
                                            <span style={{ color: 'var(--primary)', fontWeight: 600 }}>
                                                {p.position || 'Posición N/A'}
                                            </span>
                                            {p.jersey_number && (
                                                <span style={{ background: 'rgba(0,242,254,0.15)', color: 'var(--primary)', padding: '0.15rem 0.4rem', borderRadius: '4px', fontWeight: 700 }}>
                                                    #{p.jersey_number}
                                                </span>
                                            )}
                                        </div>

                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{
                                                fontSize: '0.75rem',
                                                color: p.role === 'CAPTAIN' ? 'var(--warning)' : 'var(--text-muted)',
                                                fontWeight: 600
                                            }}>
                                                {p.role === 'CAPTAIN' ? '⭐ Capitán' : p.role === 'ADMIN' ? '🛡️ Admin' : '⚽ Miembro'}
                                            </span>

                                            <button
                                                onClick={() => handleRemovePlayer(p.id, p.full_name)}
                                                style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', padding: '0.2rem' }}
                                                title="Desvincular jugador"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                        </div>
                    )}
                </div>
            )}

            {/* TAB 2: POLLS */}
            {activeTab === 'polls' && (
                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                        <div>
                            <h2 style={{ margin: 0, fontSize: '1.4rem' }}>Encuestas de la Comunidad</h2>
                            <p style={{ margin: '0.25rem 0 0 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                Consulta opiniones, confirma asistencias y vota decisiones de equipo.
                            </p>
                        </div>
                        <button className="btn btn-primary" onClick={() => setShowCreatePollModal(true)}>
                            <Plus size={18} /> Nueva Encuesta
                        </button>
                    </div>

                    {pollsLoading ? (
                        <div style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--text-muted)' }}>
                            Cargando encuestas...
                        </div>
                    ) : polls.length === 0 ? (
                        <div className="glass" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
                            <BarChart3 size={48} color="#f093fb" style={{ opacity: 0.5, marginBottom: '1rem' }} />
                            <h3>No hay encuestas activas</h3>
                            <p style={{ color: 'var(--text-muted)', maxWidth: '400px', margin: '0.5rem auto 1.5rem' }}>
                                Crea la primera encuesta para que los miembros de la comunidad puedan votar.
                            </p>
                            <button className="btn btn-primary" onClick={() => setShowCreatePollModal(true)}>
                                <Plus size={16} /> Crear Encuesta
                            </button>
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '1.5rem' }}>
                            {polls.map(poll => (
                                <div key={poll.id} className="glass" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                                        <span style={{
                                            padding: '0.25rem 0.6rem',
                                            borderRadius: '999px',
                                            fontSize: '0.75rem',
                                            fontWeight: 700,
                                            background: poll.is_active ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                            color: poll.is_active ? 'var(--success)' : 'var(--error)'
                                        }}>
                                            {poll.is_active ? '● Activa' : '○ Cerrada'}
                                        </span>

                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                            <button
                                                onClick={() => handleTogglePoll(poll.id)}
                                                className="btn btn-secondary"
                                                style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                                            >
                                                {poll.is_active ? 'Cerrar' : 'Reabrir'}
                                            </button>
                                            <button
                                                onClick={() => handleDeletePoll(poll.id)}
                                                style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer' }}
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>

                                    <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.2rem', color: 'var(--text)' }}>
                                        {poll.question}
                                    </h3>

                                    {poll.description && (
                                        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>
                                            {poll.description}
                                        </p>
                                    )}

                                    {/* Options */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', margin: '0.5rem 0 1rem 0' }}>
                                        {poll.options.map(opt => {
                                            const isSelected = poll.user_voted_option_id === opt.id;
                                            return (
                                                <div
                                                    key={opt.id}
                                                    onClick={() => poll.is_active && handleVote(poll.id, opt.id)}
                                                    style={{
                                                        position: 'relative',
                                                        padding: '0.75rem 1rem',
                                                        borderRadius: '8px',
                                                        background: 'rgba(255,255,255,0.04)',
                                                        border: isSelected ? '1px solid var(--primary)' : '1px solid rgba(255,255,255,0.08)',
                                                        cursor: poll.is_active ? 'pointer' : 'default',
                                                        overflow: 'hidden',
                                                        transition: 'border-color 0.2s'
                                                    }}
                                                >
                                                    {/* Progress bar background */}
                                                    <div style={{
                                                        position: 'absolute',
                                                        top: 0,
                                                        left: 0,
                                                        bottom: 0,
                                                        width: `${opt.percentage}%`,
                                                        background: isSelected ? 'rgba(0, 242, 254, 0.2)' : 'rgba(240, 147, 251, 0.15)',
                                                        zIndex: 0,
                                                        transition: 'width 0.4s ease'
                                                    }} />

                                                    <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                        <span style={{ fontSize: '0.9rem', fontWeight: isSelected ? 700 : 500, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                            {isSelected && <Check size={16} color="var(--primary)" />} {opt.option_text}
                                                        </span>
                                                        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: isSelected ? 'var(--primary)' : 'var(--text-muted)' }}>
                                                            {opt.percentage}% ({opt.votes_count})
                                                        </span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 'auto', display: 'flex', justifyContent: 'space-between' }}>
                                        <span>Total votos: <strong>{poll.total_votes}</strong></span>
                                        {poll.created_at && <span>{new Date(poll.created_at).toLocaleDateString()}</span>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* TAB 3: MATCHES */}
            {activeTab === 'matches' && (
                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                        <div>
                            <h2 style={{ margin: 0, fontSize: '1.4rem' }}>Encuentros Deportivos de la Comunidad</h2>
                            <p style={{ margin: '0.25rem 0 0 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                Organiza partidos amistosos, retas y desafíos internos entre miembros de la comunidad.
                            </p>
                        </div>
                        <button className="btn btn-primary" onClick={() => setShowCreateMatchModal(true)}>
                            <Plus size={18} /> Programar Encuentro
                        </button>
                    </div>

                    {matchesLoading ? (
                        <div style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--text-muted)' }}>
                            Cargando encuentros deportivos...
                        </div>
                    ) : matches.length === 0 ? (
                        <div className="glass" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
                            <Calendar size={48} color="var(--success)" style={{ opacity: 0.5, marginBottom: '1rem' }} />
                            <h3>No hay encuentros deportivos programados</h3>
                            <p style={{ color: 'var(--text-muted)', maxWidth: '400px', margin: '0.5rem auto 1.5rem' }}>
                                Programa un partido entre dos bandos o equipos de la comunidad y convoca a los jugadores.
                            </p>
                            <button className="btn btn-primary" onClick={() => setShowCreateMatchModal(true)}>
                                <Plus size={16} /> Programar Encuentro
                            </button>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                            {matches.map(m => (
                                <div key={m.id} className="glass" style={{ padding: '1.5rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                                        <div>
                                            <h3 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--text)' }}>{m.title}</h3>
                                            <div style={{ display: 'flex', gap: '1rem', color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                                                {m.match_date && <span>📅 {new Date(m.match_date).toLocaleString()}</span>}
                                                {m.location && <span>📍 {m.location}</span>}
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                            <select
                                                className="select"
                                                value={m.status}
                                                onChange={(e) => handleUpdateScore(m.id, m.team_a_score, m.team_b_score, e.target.value)}
                                                style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}
                                            >
                                                <option value="SCHEDULED">Programado</option>
                                                <option value="IN_PROGRESS">En Juego</option>
                                                <option value="COMPLETED">Finalizado</option>
                                                <option value="CANCELLED">Cancelado</option>
                                            </select>

                                            <button
                                                onClick={() => handleDeleteMatch(m.id)}
                                                style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer' }}
                                                title="Eliminar encuentro"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Versus Scoreboard */}
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '2rem',
                                        padding: '1.25rem',
                                        background: 'rgba(0,0,0,0.25)',
                                        borderRadius: '12px',
                                        marginBottom: '1rem'
                                    }}>
                                        <div style={{ flex: 1, textAlign: 'right' }}>
                                            <div style={{ fontWeight: 800, fontSize: '1.2rem', color: 'var(--primary)' }}>
                                                {m.team_a_name}
                                            </div>
                                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                                {m.team_a_players?.length || 0} jugadores
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                            <input
                                                type="number"
                                                min="0"
                                                value={m.team_a_score}
                                                onChange={(e) => handleUpdateScore(m.id, parseInt(e.target.value) || 0, m.team_b_score, m.status)}
                                                style={{
                                                    width: '52px', height: '52px', fontSize: '1.6rem', fontWeight: 800,
                                                    textAlign: 'center', borderRadius: '10px', background: 'var(--surface)',
                                                    border: '2px solid var(--primary)', color: 'var(--text)'
                                                }}
                                            />
                                            <span style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-muted)' }}>:</span>
                                            <input
                                                type="number"
                                                min="0"
                                                value={m.team_b_score}
                                                onChange={(e) => handleUpdateScore(m.id, m.team_a_score, parseInt(e.target.value) || 0, m.status)}
                                                style={{
                                                    width: '52px', height: '52px', fontSize: '1.6rem', fontWeight: 800,
                                                    textAlign: 'center', borderRadius: '10px', background: 'var(--surface)',
                                                    border: '2px solid var(--secondary)', color: 'var(--text)'
                                                }}
                                            />
                                        </div>

                                        <div style={{ flex: 1, textAlign: 'left' }}>
                                            <div style={{ fontWeight: 800, fontSize: '1.2rem', color: 'var(--secondary)' }}>
                                                {m.team_b_name}
                                            </div>
                                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                                {m.team_b_players?.length || 0} jugadores
                                            </div>
                                        </div>
                                    </div>

                                    {/* Rosters display & convocatory button */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                            {m.notes && <span>Notas: {m.notes}</span>}
                                        </div>

                                        <button
                                            className="btn btn-secondary"
                                            onClick={() => setSelectedMatchForRoster(m)}
                                            style={{ padding: '0.35rem 0.8rem', fontSize: '0.8rem' }}
                                        >
                                            <Users size={15} /> Asignar Nómina / Convocatoria
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* TAB 4: SETTINGS */}
            {isSuperAdmin && activeTab === 'settings' && (
                <div className="glass" style={{ padding: '2rem', maxWidth: '640px' }}>
                    <h2 style={{ margin: '0 0 1.5rem 0', fontSize: '1.4rem' }}>Configuración de la Comunidad</h2>

                    <form onSubmit={handleSettingsSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                        <div className="form-group">
                            <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                Nombre de la Comunidad
                            </label>
                            <input
                                type="text"
                                required
                                className="input"
                                value={editCommunityForm.name}
                                onChange={(e) => setEditCommunityForm({ ...editCommunityForm, name: e.target.value })}
                                style={{ width: '100%' }}
                            />
                        </div>

                        <div className="form-group">
                            <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                Ciudad / Sede
                            </label>
                            <input
                                type="text"
                                className="input"
                                value={editCommunityForm.city}
                                onChange={(e) => setEditCommunityForm({ ...editCommunityForm, city: e.target.value })}
                                style={{ width: '100%' }}
                            />
                        </div>

                        <div className="form-group">
                            <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                Descripción
                            </label>
                            <textarea
                                rows="3"
                                className="input"
                                value={editCommunityForm.description}
                                onChange={(e) => setEditCommunityForm({ ...editCommunityForm, description: e.target.value })}
                                style={{ width: '100%', resize: 'vertical' }}
                            />
                        </div>

                        <div className="form-group">
                            <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                URL Logo
                            </label>
                            <input
                                type="url"
                                className="input"
                                value={editCommunityForm.logo_url}
                                onChange={(e) => setEditCommunityForm({ ...editCommunityForm, logo_url: e.target.value })}
                                style={{ width: '100%' }}
                            />
                        </div>

                        <div className="form-group">
                            <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                URL Foto de Portada
                            </label>
                            <input
                                type="url"
                                className="input"
                                value={editCommunityForm.cover_url}
                                onChange={(e) => setEditCommunityForm({ ...editCommunityForm, cover_url: e.target.value })}
                                style={{ width: '100%' }}
                            />
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--glass-border)' }}>
                            <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={handleDeleteCommunity}
                                style={{ color: 'var(--error)', borderColor: 'rgba(239,68,68,0.3)' }}
                            >
                                <Trash2 size={16} /> Eliminar Comunidad
                            </button>

                            <button
                                type="submit"
                                className="btn btn-primary"
                                disabled={savingSettings}
                            >
                                {savingSettings ? 'Guardando...' : 'Guardar Cambios'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* MODAL 1: INSCRIBIR JUGADOR (Individual / Global Search) */}
            {showAddPlayerModal && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)',
                    zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
                }}>
                    <div className="glass" style={{ width: '100%', maxWidth: '540px', padding: '2rem', position: 'relative', maxHeight: '90vh', overflowY: 'auto' }}>
                        <button
                            onClick={() => setShowAddPlayerModal(false)}
                            style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                        >
                            <X size={20} />
                        </button>

                        <h2 style={{ margin: '0 0 1rem 0', fontSize: '1.4rem' }}>Inscribir Jugador en la Comunidad</h2>

                        {/* Mode Selector */}
                        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', background: 'rgba(255,255,255,0.05)', padding: '0.3rem', borderRadius: '8px' }}>
                            <button
                                type="button"
                                onClick={() => setAddPlayerMode('search')}
                                style={{
                                    flex: 1, padding: '0.5rem', border: 'none', borderRadius: '6px', cursor: 'pointer',
                                    fontWeight: 600, fontSize: '0.85rem',
                                    background: addPlayerMode === 'search' ? 'var(--primary)' : 'transparent',
                                    color: addPlayerMode === 'search' ? '#000' : 'var(--text-muted)'
                                }}
                            >
                                🔍 Buscar en Base Global
                            </button>
                            <button
                                type="button"
                                onClick={() => setAddPlayerMode('create')}
                                style={{
                                    flex: 1, padding: '0.5rem', border: 'none', borderRadius: '6px', cursor: 'pointer',
                                    fontWeight: 600, fontSize: '0.85rem',
                                    background: addPlayerMode === 'create' ? 'var(--primary)' : 'transparent',
                                    color: addPlayerMode === 'create' ? '#000' : 'var(--text-muted)'
                                }}
                            >
                                ✍️ Registro Directo
                            </button>
                        </div>

                        {addPlayerMode === 'search' ? (
                            <div>
                                <div className="form-group" style={{ marginBottom: '1rem' }}>
                                    <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                        Buscar por documento o nombre
                                    </label>
                                    <input
                                        type="text"
                                        className="input"
                                        placeholder="Ej: 102030... o Carlos"
                                        value={globalSearchQuery}
                                        onChange={(e) => handleGlobalSearch(e.target.value)}
                                        style={{ width: '100%' }}
                                    />
                                </div>

                                {searchingGlobal && <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Buscando jugadores...</p>}

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '240px', overflowY: 'auto' }}>
                                    {globalResults.map(p => (
                                        <div
                                            key={p.document_number}
                                            onClick={() => handleSelectGlobalPlayer(p)}
                                            style={{
                                                padding: '0.75rem',
                                                background: 'rgba(255,255,255,0.04)',
                                                borderRadius: '8px',
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                cursor: 'pointer',
                                                border: '1px solid rgba(255,255,255,0.08)'
                                            }}
                                        >
                                            <div>
                                                <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{p.full_name}</div>
                                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                                    Doc: {p.document_number} | {p.position || 'Posición N/A'}
                                                </div>
                                            </div>
                                            <button className="btn btn-primary" style={{ padding: '0.3rem 0.7rem', fontSize: '0.75rem' }}>
                                                Seleccionar
                                            </button>
                                        </div>
                                    ))}
                                    {globalSearchQuery.length >= 2 && !searchingGlobal && globalResults.length === 0 && (
                                        <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                            No se encontró jugador en el sistema con ese criterio.
                                            <div style={{ marginTop: '0.5rem' }}>
                                                <button
                                                    type="button"
                                                    className="btn btn-secondary"
                                                    style={{ padding: '0.3rem 0.8rem', fontSize: '0.8rem' }}
                                                    onClick={() => setAddPlayerMode('create')}
                                                >
                                                    Registrar como nuevo
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <form onSubmit={handleAddPlayerSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <div className="form-group">
                                    <label style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                        Número de Documento *
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        className="input"
                                        placeholder="Cédula / Identificación"
                                        value={newPlayerForm.document_number}
                                        onChange={(e) => setNewPlayerForm({ ...newPlayerForm, document_number: e.target.value })}
                                        style={{ width: '100%' }}
                                    />
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                                    <div className="form-group" style={{ margin: 0 }}>
                                        <label style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                            Nombres *
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            className="input"
                                            placeholder="Ej: Carlos Alberto"
                                            value={newPlayerForm.first_name || ''}
                                            onChange={(e) => {
                                                const fn = e.target.value;
                                                setNewPlayerForm(prev => ({
                                                    ...prev,
                                                    first_name: fn,
                                                    full_name: `${fn} ${prev.last_name || ''}`.trim()
                                                }));
                                            }}
                                            style={{ width: '100%' }}
                                        />
                                    </div>
                                    <div className="form-group" style={{ margin: 0 }}>
                                        <label style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                            Apellidos *
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            className="input"
                                            placeholder="Ej: Valderrama Palacio"
                                            value={newPlayerForm.last_name || ''}
                                            onChange={(e) => {
                                                const ln = e.target.value;
                                                setNewPlayerForm(prev => ({
                                                    ...prev,
                                                    last_name: ln,
                                                    full_name: `${prev.first_name || ''} ${ln}`.trim()
                                                }));
                                            }}
                                            style={{ width: '100%' }}
                                        />
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                                    <div className="form-group">
                                        <label style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                            Posición
                                        </label>
                                        <input
                                            type="text"
                                            className="input"
                                            placeholder="Ej: Delantero, Portero"
                                            value={newPlayerForm.position}
                                            onChange={(e) => setNewPlayerForm({ ...newPlayerForm, position: e.target.value })}
                                            style={{ width: '100%' }}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                            Dorsal / Camiseta
                                        </label>
                                        <input
                                            type="number"
                                            className="input"
                                            placeholder="Ej: 10"
                                            value={newPlayerForm.jersey_number}
                                            onChange={(e) => setNewPlayerForm({ ...newPlayerForm, jersey_number: e.target.value })}
                                            style={{ width: '100%' }}
                                        />
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                                    <div className="form-group">
                                        <label style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                            Teléfono
                                        </label>
                                        <input
                                            type="text"
                                            className="input"
                                            placeholder="300..."
                                            value={newPlayerForm.phone}
                                            onChange={(e) => setNewPlayerForm({ ...newPlayerForm, phone: e.target.value })}
                                            style={{ width: '100%' }}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                            Rol en Comunidad
                                        </label>
                                        <select
                                            className="select"
                                            value={newPlayerForm.role}
                                            onChange={(e) => setNewPlayerForm({ ...newPlayerForm, role: e.target.value })}
                                            style={{ width: '100%' }}
                                        >
                                            <option value="MEMBER">Miembro</option>
                                            <option value="CAPTAIN">Capitán</option>
                                            <option value="ADMIN">Administrador</option>
                                        </select>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                                    <button type="button" className="btn btn-secondary" onClick={() => setShowAddPlayerModal(false)}>
                                        Cancelar
                                    </button>
                                    <button type="submit" className="btn btn-primary">
                                        Inscribir a Comunidad
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            )}

            {/* MODAL 2: CARGA MASIVA EXCEL */}
            {showExcelModal && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)',
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
                                <h2 style={{ margin: 0, fontSize: '1.35rem' }}>Carga Masiva de Jugadores (Excel)</h2>
                                <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                    Inscribe múltiples jugadores a la vez subiendo un archivo .xlsx o .csv
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
                                    1. Descarga la plantilla oficial
                                </div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                    Contiene las columnas estandarizadas requeridas.
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
                                onClick={() => fileInputRef.current?.click()}
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
                                    ref={fileInputRef}
                                    accept=".xlsx,.xls,.csv"
                                    style={{ display: 'none' }}
                                    onChange={(e) => setExcelFile(e.target.files[0] || null)}
                                />
                                <Upload size={32} color={excelFile ? 'var(--success)' : 'var(--text-muted)'} style={{ margin: '0 auto 0.5rem' }} />
                                {excelFile ? (
                                    <div>
                                        <div style={{ fontWeight: 700, color: 'var(--success)' }}>{excelFile.name}</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{(excelFile.size / 1024).toFixed(1)} KB - Haz clic para cambiar archivo</div>
                                    </div>
                                ) : (
                                    <div>
                                        <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>Selecciona o arrastra tu archivo Excel aquí</div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Archivos soportados: .xlsx, .xls, .csv</div>
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
                                        Resultado del procesamiento:
                                    </div>
                                    <div style={{ fontSize: '0.85rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                                        <span>Total filas: <strong>{excelResult.total}</strong></span>
                                        <span style={{ color: 'var(--success)' }}>Nuevos inscritos: <strong>{excelResult.imported}</strong></span>
                                        <span style={{ color: 'var(--primary)' }}>Actualizados: <strong>{excelResult.updated}</strong></span>
                                        {excelResult.errors?.length > 0 && (
                                            <span style={{ color: 'var(--error)' }}>Con errores/advertencias: <strong>{excelResult.errors.length}</strong></span>
                                        )}
                                    </div>

                                    {excelResult.errors?.length > 0 && (
                                        <div style={{ marginTop: '0.75rem', maxHeight: '120px', overflowY: 'auto', fontSize: '0.8rem' }}>
                                            {excelResult.errors.map((err, i) => (
                                                <div key={i} style={{ color: 'var(--error)', marginBottom: '0.25rem' }}>
                                                    • Fila {err.row}: {err.document ? `[${err.document}] ` : ''}{err.error}
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
                                    {uploadingExcel ? 'Procesando archivo...' : 'Procesar e Inscribir'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL 3: CREAR ENCUESTA */}
            {showCreatePollModal && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)',
                    zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
                }}>
                    <div className="glass" style={{ width: '100%', maxWidth: '520px', padding: '2rem', position: 'relative', maxHeight: '90vh', overflowY: 'auto' }}>
                        <button
                            onClick={() => setShowCreatePollModal(false)}
                            style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                        >
                            <X size={20} />
                        </button>

                        <h2 style={{ margin: '0 0 1.25rem 0', fontSize: '1.35rem' }}>Nueva Encuesta</h2>

                        <form onSubmit={handleCreatePollSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div className="form-group">
                                <label style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                    Pregunta de la Encuesta *
                                </label>
                                <input
                                    type="text"
                                    required
                                    className="input"
                                    placeholder="Ej: ¿Quién confirma para jugar este sábado?"
                                    value={newPoll.question}
                                    onChange={(e) => setNewPoll({ ...newPoll, question: e.target.value })}
                                    style={{ width: '100%' }}
                                />
                            </div>

                            <div className="form-group">
                                <label style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                    Descripción o contexto (Opcional)
                                </label>
                                <textarea
                                    rows="2"
                                    className="input"
                                    placeholder="Detalles sobre lugar, costo de cancha o indumentaria..."
                                    value={newPoll.description}
                                    onChange={(e) => setNewPoll({ ...newPoll, description: e.target.value })}
                                    style={{ width: '100%', resize: 'vertical' }}
                                />
                            </div>

                            <div className="form-group">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                    <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                        Opciones de Respuesta * (Mínimo 2)
                                    </label>
                                    <button
                                        type="button"
                                        onClick={handleAddPollOption}
                                        style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}
                                    >
                                        + Agregar Opción
                                    </button>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    {newPoll.options.map((opt, idx) => (
                                        <div key={idx} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                            <input
                                                type="text"
                                                required
                                                className="input"
                                                placeholder={`Opción ${idx + 1}`}
                                                value={opt}
                                                onChange={(e) => handlePollOptionChange(idx, e.target.value)}
                                                style={{ width: '100%' }}
                                            />
                                            {newPoll.options.length > 2 && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemovePollOption(idx)}
                                                    style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer' }}
                                                >
                                                    <X size={16} />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                                <button type="button" className="btn btn-secondary" onClick={() => setShowCreatePollModal(false)}>
                                    Cancelar
                                </button>
                                <button type="submit" className="btn btn-primary">
                                    Publicar Encuesta
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL 4: PROGRAMAR ENCUENTRO */}
            {showCreateMatchModal && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)',
                    zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
                }}>
                    <div className="glass" style={{ width: '100%', maxWidth: '520px', padding: '2rem', position: 'relative', maxHeight: '90vh', overflowY: 'auto' }}>
                        <button
                            onClick={() => setShowCreateMatchModal(false)}
                            style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                        >
                            <X size={20} />
                        </button>

                        <h2 style={{ margin: '0 0 1.25rem 0', fontSize: '1.35rem' }}>Programar Encuentro Deportivo</h2>

                        <form onSubmit={handleCreateMatchSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div className="form-group">
                                <label style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                    Título / Motivo del Partido *
                                </label>
                                <input
                                    type="text"
                                    required
                                    className="input"
                                    placeholder="Ej: Picado del Sábado - Cancha 3"
                                    value={newMatch.title}
                                    onChange={(e) => setNewMatch({ ...newMatch, title: e.target.value })}
                                    style={{ width: '100%' }}
                                />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                                <div className="form-group">
                                    <label style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                        Fecha y Hora
                                    </label>
                                    <input
                                        type="datetime-local"
                                        className="input"
                                        value={newMatch.match_date}
                                        onChange={(e) => setNewMatch({ ...newMatch, match_date: e.target.value })}
                                        style={{ width: '100%' }}
                                    />
                                </div>
                                <div className="form-group">
                                    <label style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                        Lugar / Cancha
                                    </label>
                                    <input
                                        type="text"
                                        className="input"
                                        placeholder="Ej: Sede Central"
                                        value={newMatch.location}
                                        onChange={(e) => setNewMatch({ ...newMatch, location: e.target.value })}
                                        style={{ width: '100%' }}
                                    />
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                                <div className="form-group">
                                    <label style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                        Nombre Bando A
                                    </label>
                                    <input
                                        type="text"
                                        className="input"
                                        placeholder="Ej: Chalecos Azules"
                                        value={newMatch.team_a_name}
                                        onChange={(e) => setNewMatch({ ...newMatch, team_a_name: e.target.value })}
                                        style={{ width: '100%' }}
                                    />
                                </div>
                                <div className="form-group">
                                    <label style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                        Nombre Bando B
                                    </label>
                                    <input
                                        type="text"
                                        className="input"
                                        placeholder="Ej: Chalecos Rojos"
                                        value={newMatch.team_b_name}
                                        onChange={(e) => setNewMatch({ ...newMatch, team_b_name: e.target.value })}
                                        style={{ width: '100%' }}
                                    />
                                </div>
                            </div>

                            <div className="form-group">
                                <label style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                    Notas adicionales
                                </label>
                                <textarea
                                    rows="2"
                                    className="input"
                                    placeholder="Indumentaria requerida, reglas de tiempo, etc."
                                    value={newMatch.notes}
                                    onChange={(e) => setNewMatch({ ...newMatch, notes: e.target.value })}
                                    style={{ width: '100%', resize: 'vertical' }}
                                />
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateMatchModal(false)}>
                                    Cancelar
                                </button>
                                <button type="submit" className="btn btn-primary">
                                    Guardar Encuentro
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL 5: CONVOCATORIA / ASIGNAR NÓMINA A BANDOS */}
            {selectedMatchForRoster && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)',
                    zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
                }}>
                    <div className="glass" style={{ width: '100%', maxWidth: '720px', padding: '2rem', position: 'relative', maxHeight: '90vh', overflowY: 'auto' }}>
                        <button
                            onClick={() => setSelectedMatchForRoster(null)}
                            style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                        >
                            <X size={20} />
                        </button>

                        <h2 style={{ margin: '0 0 0.5rem 0', fontSize: '1.4rem' }}>
                            Convocatoria: {selectedMatchForRoster.title}
                        </h2>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
                            Asigna a los jugadores inscritos en la comunidad al {selectedMatchForRoster.team_a_name} o al {selectedMatchForRoster.team_b_name}.
                        </p>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                            {/* Team A Box */}
                            <div style={{ padding: '1rem', background: 'rgba(0, 242, 254, 0.05)', borderRadius: '10px', border: '1px solid rgba(0, 242, 254, 0.2)' }}>
                                <h4 style={{ margin: '0 0 0.75rem 0', color: 'var(--primary)' }}>
                                    {selectedMatchForRoster.team_a_name} ({selectedMatchForRoster.team_a_players?.length || 0})
                                </h4>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '180px', overflowY: 'auto' }}>
                                    {selectedMatchForRoster.team_a_players?.map(p => (
                                        <div key={p.community_player_id} style={{ fontSize: '0.85rem', display: 'flex', justifyContent: 'space-between', padding: '0.2rem 0' }}>
                                            <span>• {p.full_name}</span>
                                            <span style={{ color: 'var(--text-muted)' }}>{p.position}</span>
                                        </div>
                                    ))}
                                    {(!selectedMatchForRoster.team_a_players || selectedMatchForRoster.team_a_players.length === 0) && (
                                        <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Sin jugadores asignados aún</div>
                                    )}
                                </div>
                            </div>

                            {/* Team B Box */}
                            <div style={{ padding: '1rem', background: 'rgba(79, 172, 254, 0.05)', borderRadius: '10px', border: '1px solid rgba(79, 172, 254, 0.2)' }}>
                                <h4 style={{ margin: '0 0 0.75rem 0', color: 'var(--secondary)' }}>
                                    {selectedMatchForRoster.team_b_name} ({selectedMatchForRoster.team_b_players?.length || 0})
                                </h4>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '180px', overflowY: 'auto' }}>
                                    {selectedMatchForRoster.team_b_players?.map(p => (
                                        <div key={p.community_player_id} style={{ fontSize: '0.85rem', display: 'flex', justifyContent: 'space-between', padding: '0.2rem 0' }}>
                                            <span>• {p.full_name}</span>
                                            <span style={{ color: 'var(--text-muted)' }}>{p.position}</span>
                                        </div>
                                    ))}
                                    {(!selectedMatchForRoster.team_b_players || selectedMatchForRoster.team_b_players.length === 0) && (
                                        <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Sin jugadores asignados aún</div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Assign Player Table */}
                        <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: '1rem' }}>
                            <h4 style={{ margin: '0 0 0.75rem 0' }}>Jugadores de la comunidad disponibles:</h4>
                            <div style={{ maxHeight: '220px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                {players.map(p => {
                                    const currentSideA = selectedMatchForRoster.team_a_players?.some(tp => tp.community_player_id === p.id);
                                    const currentSideB = selectedMatchForRoster.team_b_players?.some(tp => tp.community_player_id === p.id);

                                    return (
                                        <div key={p.id} style={{
                                            padding: '0.5rem 0.75rem', background: 'rgba(255,255,255,0.03)',
                                            borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                                        }}>
                                            <div style={{ fontSize: '0.9rem' }}>
                                                <strong>{p.full_name}</strong> <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>({p.position || 'N/A'})</span>
                                            </div>

                                            <div style={{ display: 'flex', gap: '0.4rem' }}>
                                                <button
                                                    className="btn"
                                                    style={{
                                                        padding: '0.25rem 0.6rem', fontSize: '0.75rem',
                                                        background: currentSideA ? 'var(--primary)' : 'rgba(255,255,255,0.06)',
                                                        color: currentSideA ? '#000' : 'var(--text)'
                                                    }}
                                                    onClick={async () => {
                                                        const currentRoster = [
                                                            ...(selectedMatchForRoster.team_a_players || []).map(x => ({ community_player_id: x.community_player_id, team_side: 'A' })),
                                                            ...(selectedMatchForRoster.team_b_players || []).map(x => ({ community_player_id: x.community_player_id, team_side: 'B' }))
                                                        ].filter(x => x.community_player_id !== p.id);

                                                        if (!currentSideA) {
                                                            currentRoster.push({ community_player_id: p.id, team_side: 'A' });
                                                        }
                                                        await communityService.setMatchRoster(selectedMatchForRoster.id, { players: currentRoster });
                                                        loadMatches();
                                                        // Update local view
                                                        const matchRes = await communityService.getMatches(communityId);
                                                        const updated = matchRes.data.find(m => m.id === selectedMatchForRoster.id);
                                                        setSelectedMatchForRoster(updated);
                                                    }}
                                                >
                                                    {currentSideA ? '✓ En Bando A' : '+ A Bando A'}
                                                </button>

                                                <button
                                                    className="btn"
                                                    style={{
                                                        padding: '0.25rem 0.6rem', fontSize: '0.75rem',
                                                        background: currentSideB ? 'var(--secondary)' : 'rgba(255,255,255,0.06)',
                                                        color: currentSideB ? '#000' : 'var(--text)'
                                                    }}
                                                    onClick={async () => {
                                                        const currentRoster = [
                                                            ...(selectedMatchForRoster.team_a_players || []).map(x => ({ community_player_id: x.community_player_id, team_side: 'A' })),
                                                            ...(selectedMatchForRoster.team_b_players || []).map(x => ({ community_player_id: x.community_player_id, team_side: 'B' }))
                                                        ].filter(x => x.community_player_id !== p.id);

                                                        if (!currentSideB) {
                                                            currentRoster.push({ community_player_id: p.id, team_side: 'B' });
                                                        }
                                                        await communityService.setMatchRoster(selectedMatchForRoster.id, { players: currentRoster });
                                                        loadMatches();
                                                        const matchRes = await communityService.getMatches(communityId);
                                                        const updated = matchRes.data.find(m => m.id === selectedMatchForRoster.id);
                                                        setSelectedMatchForRoster(updated);
                                                    }}
                                                >
                                                    {currentSideB ? '✓ En Bando B' : '+ A Bando B'}
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                            <button className="btn btn-primary" onClick={() => setSelectedMatchForRoster(null)}>
                                Listo
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CommunityDetail;
