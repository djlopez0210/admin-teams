import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Network, Plus, Trash2, Shuffle, Users, Play, Trophy, Calendar, Edit2, ChevronDown, ChevronUp, RotateCcw, MapPin, UserCheck, Clock, Repeat } from 'lucide-react';
import { useNotification } from '../context/NotificationContext';
import { api } from '../services/api';

const TournamentPhases = () => {
    const slug = localStorage.getItem('adminTournamentSlug');
    const { showNotification, showConfirm } = useNotification();
    const [phases, setPhases] = useState([]);
    const [loading, setLoading] = useState(true);
    const [expandedGroups, setExpandedGroups] = useState({});
    const [groupMatches, setGroupMatches] = useState({});
    const [groupTeams, setGroupTeams] = useState({});
    const [modalTeams, setModalTeams] = useState([]); // State for the current open modal
    const [referees, setReferees] = useState([]);
    const [fields, setFields] = useState([]); // New state for fields
    const [veedores, setVeedores] = useState([]); // Add veedores state
    const [showRefereeModal, setShowRefereeModal] = useState(false);
    const [showFieldModal, setShowFieldModal] = useState(false); // New modal
    const [newReferee, setNewReferee] = useState({ full_name: '', phone: '', document_number: '' });
    const [newField, setNewField] = useState({ name: '', address: '' });
    
    // New Phase State
    const [showPhaseModal, setShowPhaseModal] = useState(false);
    const [newPhase, setNewPhase] = useState({ name: '', order: 1, type: 'ROUND_ROBIN', is_double_round: false });
    
    // Edit Phase State
    const [showEditPhaseModal, setShowEditPhaseModal] = useState(false);
    const [editingPhase, setEditingPhase] = useState({ id: null, name: '', order: 1, type: 'ROUND_ROBIN', is_double_round: false });
    
    // Edit Group State
    const [showEditGroupModal, setShowEditGroupModal] = useState(false);
    const [editingGroup, setEditingGroup] = useState({ id: null, name: '' });

    // New Group State
    const [showGroupModal, setShowGroupModal] = useState(false);
    const [activePhaseId, setActivePhaseId] = useState(null);
    const [newGroup, setNewGroup] = useState({ name: '' });

    // Manual Assign State
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [activeGroupId, setActiveGroupId] = useState(null);
    const [unassignedTeams, setUnassignedTeams] = useState([]);

    // Match State
    const [showMatchModal, setShowMatchModal] = useState(false);
    const [editingMatch, setEditingMatch] = useState(null);
    const [matchData, setMatchData] = useState({ home_team_id: '', away_team_id: '', match_date: '', match_day: 1, group_id: '', location: '', referee: '', veedor_id: '' });

    // Lottery Animation State
    const [lottery, setLottery] = useState({ active: false, currentBall: null, title: '', subtitle: '' });
    const [regOpen, setRegOpen] = useState(true);

    useEffect(() => {
        loadPhases();
        loadTournamentStatus();
    }, [slug]);

    const loadTournamentStatus = async () => {
        try {
            const leagueSlug = slug || localStorage.getItem('adminTournamentSlug');
            const res = await api.get(`/tournaments/${leagueSlug}/status`);
            setRegOpen(res.data.registration_open);
        } catch (err) {
            console.error('Error loading status');
        }
    };

    const handleToggleTournament = async () => {
        const action = regOpen ? 'INICIAR' : 'DETENER';
        const confirmed = await showConfirm({
            title: `${action} Torneo`,
            message: regOpen 
                ? '¿Deseas INICIAR el torneo? Esto cerrará el registro de nuevos equipos.' 
                : '¿Deseas DETENER el torneo? Esto permitirá registrar nuevos equipos de nuevo.',
            type: 'warning'
        });
            
        if (!confirmed) return;

        try {
            const leagueSlug = slug || localStorage.getItem('adminTournamentSlug');
            const res = await api.post(`/tournaments/${leagueSlug}/toggle-registration`);
            setRegOpen(res.data.registration_open);
            showNotification(res.data.message, 'success');
            // Force reload parent if needed, but the badge in header will update on next load
        } catch (err) {
            showNotification('Error al cambiar estatus del torneo', 'error');
        }
    };

    const runLotteryAnimation = (sequence, title, onComplete) => {
        setLottery({ active: true, currentBall: null, title: title, subtitle: 'Iniciando sorteo...' });
        
        let index = 0;
        const interval = setInterval(() => {
            if (index >= sequence.length) {
                clearInterval(interval);
                setTimeout(() => {
                    setLottery({ active: false, currentBall: null, title: '', subtitle: '' });
                    onComplete();
                }, 1500);
                return;
            }
            
            const item = sequence[index];
            const ballData = item.team ? {
                teamName: item.team,
                logo: item.logo,
                description: `➜ ${item.group}`
            } : {
                teamName: `${item.home} vs ${item.away}`,
                logo: item.home_logo, // Just use home logo for match ball or both? Let's use home for simplicity
                description: `(Jornada ${item.day})`
            };

            setLottery(prev => ({ ...prev, currentBall: ballData, subtitle: `Asignación ${index + 1} de ${sequence.length}` }));
            index++;
        }, 2200);
    };

    const loadPhases = async () => {
        // ... load phases ...
        try {
            const safeSlug = slug && slug !== 'undefined' ? slug : 'current';
            const res = await api.get(`/tournaments/${safeSlug}/phases`);
            setPhases(res.data);
            setLoading(false);
        } catch (err) {
            console.error('Error loading phases', err);
            showNotification('Error al cargar fases del torneo', 'error');
            setLoading(false);
        }
    };

    const handleDeletePhase = async (phaseId) => {
        const confirm = await showConfirm({
            title: 'Eliminar Fase Completa',
            message: '¿Está seguro de eliminar esta fase? Se borrarán TODOS los grupos, equipos y partidos asociados. Esta acción es irreversible.',
            type: 'error',
            confirmButtonText: 'Eliminar definitivamente'
        });

        if (confirm) {
            try {
                await api.delete(`/phases/${phaseId}`);
                showNotification('Fase eliminada correctamente', 'success');
                loadPhases();
            } catch (err) {
                showNotification('Error al eliminar la fase', 'error');
            }
        }
    };

    const handleUpdatePhase = async (e) => {
        e.preventDefault();
        try {
            await api.put(`/phases/${editingPhase.id}`, editingPhase);
            showNotification('Fase actualizada', 'success');
            setShowEditPhaseModal(false);
            loadPhases();
        } catch (err) {
            showNotification('Error al actualizar la fase', 'error');
        }
    };

    const handleDeleteGroup = async (groupId) => {
        const confirm = await showConfirm({
            title: 'Eliminar Grupo',
            message: '¿Está seguro de eliminar este grupo? Se borrarán todos los encuentros y posiciones asociadas.',
            type: 'error',
            confirmButtonText: 'Eliminar definitivamente'
        });

        if (confirm) {
            try {
                await api.delete(`/groups/${groupId}`);
                showNotification('Grupo eliminado correctamente', 'success');
                loadPhases();
            } catch (err) {
                showNotification('Error al eliminar el grupo', 'error');
            }
        }
    };

    const handleUpdateGroup = async (e) => {
        e.preventDefault();
        try {
            await api.put(`/groups/${editingGroup.id}`, { name: editingGroup.name });
            showNotification('Grupo actualizado', 'success');
            setShowEditGroupModal(false);
            loadPhases();
        } catch (err) {
            showNotification('Error al actualizar el grupo', 'error');
        }
    };

    const toggleGroup = async (groupId) => {
        const isExpanding = !expandedGroups[groupId];
        setExpandedGroups(prev => ({ ...prev, [groupId]: isExpanding }));
        
        if (isExpanding) {
            loadGroupMatches(groupId);
            loadGroupTeams(groupId);
        }
    };

    const loadGroupTeams = async (groupId) => {
        try {
            const res = await api.get(`/groups/${groupId}/teams`);
            setGroupTeams(prev => ({ ...prev, [groupId]: res.data }));
        } catch (err) {
            showNotification('Error al cargar equipos del grupo', 'error');
        }
    };

    const loadReferees = async () => {
        try {
            const res = await api.get('/referees');
            setReferees(res.data);
        } catch (err) {
            console.error('Error loading referees');
        }
    };

    const loadFields = async () => {
        try {
            const res = await api.get('/fields');
            setFields(res.data);
        } catch (err) {
            console.error('Error loading fields');
        }
    };

    const loadVeedores = async () => {
        try {
            const tournamentId = localStorage.getItem('adminTournamentId');
            const res = await api.get(`/tournaments/${tournamentId}/veedores`);
            setVeedores(res.data || []);
        } catch (err) {
            console.error('Error loading veedores');
        }
    };

    useEffect(() => {
        loadReferees();
        loadFields();
        loadVeedores();
    }, []);

    const loadGroupMatches = async (groupId) => {
        try {
            const res = await api.get(`/groups/${groupId}/matches`);
            setGroupMatches(prev => ({ ...prev, [groupId]: res.data }));
        } catch (err) {
            showNotification('Error al cargar partidos', 'error');
        }
    };

    const handleCreateRefereeFromModal = async (e) => {
        e.preventDefault();
        try {
            const res = await api.post('/referees', newReferee);
            showNotification('Árbitro registrado con cédula', 'success');
            setMatchData(prev => ({ ...prev, referee: newReferee.full_name }));
            setNewReferee({ full_name: '', phone: '', document_number: '' });
            setShowRefereeModal(false);
            loadReferees(); 
        } catch (err) {
            showNotification('Error al crear árbitro', 'error');
        }
    };

    const handleCreateFieldFromModal = async (e) => {
        e.preventDefault();
        try {
            await api.post('/fields', newField);
            showNotification('Cancha guardada', 'success');
            setMatchData(prev => ({ ...prev, location: newField.name }));
            setNewField({ name: '', address: '' });
            setShowFieldModal(false);
            loadFields();
        } catch (err) {
            showNotification('Error al crear cancha', 'error');
        }
    };

    const handleGenerateFixtures = async (groupId) => {
        const confirmed = await showConfirm({
            title: 'Generar Calendario',
            message: '¿Está seguro de hacer el sorteo automático? (Aceptar para ejecutar)',
            type: 'info',
            confirmButtonText: 'Generar'
        });
        if (!confirmed) return;

        try {
            const res = await api.post(`/groups/${groupId}/generate-fixtures`);
            if (res.data.sequence && res.data.sequence.length > 0) {
                runLotteryAnimation(res.data.sequence, 'Sorteo de Calendario', () => {
                    loadGroupMatches(groupId);
                    showNotification('¡Calendario de grupo generado exitosamente!', 'gold');
                });
            } else {
                showNotification('Calendario generado', 'success');
                loadGroupMatches(groupId);
            }
        } catch (err) {
            showNotification(err.response?.data?.error || 'Error al generar calendario', 'error');
        }
    };

    const handleResetFixtures = async (groupId) => {
        const confirmed = await showConfirm({
            title: '⚠️ Acción Crítica',
            message: 'Se eliminará TODO el calendario de este grupo. Esta acción es irreversible.',
            type: 'error',
            confirmButtonText: 'Borrar Calendario'
        });
        if (!confirmed) return;

        try {
            await api.delete(`/groups/${groupId}/matches`);
            showNotification('Calendario reinventariado correctamente', 'success');
            loadGroupMatches(groupId);
        } catch (err) {
            showNotification(err.response?.data?.error || 'No se pudo reiniciar el calendario', 'error');
        }
    };

    const handleMatchSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingMatch) {
                await api.put(`/matches/${editingMatch.id}`, matchData);
                showNotification('Partido actualizado con éxito', 'success');
            } else {
                await api.post(`/phases/${activePhaseId}/matches`, { ...matchData, group_id: activeGroupId });
                showNotification('Partido creado correctamente', 'success');
            }
            setShowMatchModal(false);
            setEditingMatch(null);
            loadGroupMatches(activeGroupId);
        } catch (err) {
            showNotification(err.response?.data?.error || 'Error al guardar el partido', 'error');
        }
    };

    const handleDeleteMatch = async (groupId, matchId) => {
        if (!window.confirm('¿Eliminar este encuentro?')) return;
        try {
            await api.delete(`/matches/${matchId}`);
            showNotification('Partido eliminado', 'success');
            loadGroupMatches(groupId);
        } catch (err) {
            showNotification('Error al eliminar partido', 'error');
        }
    };

    const handleCreatePhase = async (e) => {
        e.preventDefault();
        try {
            const safeSlug = slug && slug !== 'undefined' ? slug : 'current';
            await api.post(`/tournaments/${safeSlug}/phases`, newPhase);
            showNotification('Fase creada correctamente', 'success');
            setShowPhaseModal(false);
            setNewPhase({ name: '', order: phases.length + 1, type: 'ROUND_ROBIN', is_double_round: false });
            loadPhases();
        } catch (err) {
            showNotification('Error al crear fase', 'error');
        }
    };

    const handleCreateGroup = async (e) => {
        e.preventDefault();
        try {
            await api.post(`/phases/${activePhaseId}/groups`, newGroup);
            showNotification('Grupo creado exitosamente', 'success');
            setShowGroupModal(false);
            setNewGroup({ name: '' });
            loadPhases();
        } catch (err) {
            showNotification('Error al crear grupo', 'error');
        }
    };

    const handleRunDraw = async (phaseId) => {
        const confirmed = await showConfirm({
            title: 'Sorteo Automático',
            message: '¿Está seguro de hacer el sorteo automático? (Aceptar para ejecutar)',
            type: 'gold',
            confirmButtonText: '¡Comenzar Sorteo!'
        });
        if (!confirmed) return;

        try {
            const res = await api.post(`/phases/${phaseId}/draw`);
            if (res.data.sequence && res.data.sequence.length > 0) {
                runLotteryAnimation(res.data.sequence, 'Sorteo de Grupos', () => {
                    loadPhases();
                    showNotification('¡Sorteo de grupos completado con éxito!', 'gold');
                });
            } else {
                showNotification('Sorteo completado', 'success');
                loadPhases();
            }
        } catch (err) {
            showNotification(err.response?.data?.error || 'Error al ejecutar sorteo', 'error');
        }
    };

    const openAssignModal = async (phaseId, groupId) => {
        try {
            const safeSlug = slug && slug !== 'undefined' ? slug : 'current';
            const res = await api.get(`/tournaments/${safeSlug}/phases/${phaseId}/unassigned-teams`);
            setUnassignedTeams(res.data);
            setActiveGroupId(groupId);
            setShowAssignModal(true);
        } catch (err) {
            showNotification('Error al cargar equipos disponibles', 'error');
        }
    };

    const handleAssignTeam = async (teamId) => {
        try {
            await api.post(`/groups/${activeGroupId}/teams`, { team_id: teamId });
            showNotification('Equipo asignado', 'success');
            setShowAssignModal(false);
            loadPhases();
        } catch (err) {
            showNotification('Error al asignar equipo', 'error');
        }
    };

    const handleRemoveTeamFromGroup = async (groupId, teamId) => {
        const confirmed = await showConfirm({
            title: 'Remover Equipo',
            message: '¿Estás seguro de remover este equipo del grupo?',
            type: 'warning'
        });
        if (!confirmed) return;

        try {
            await api.delete(`/groups/${groupId}/teams/${teamId}`);
            showNotification('Equipo removido', 'success');
            loadPhases(); // Refresh the list
        } catch (err) {
            showNotification(err.response?.data?.error || 'Error al remover equipo', 'error');
        }
    };

    if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Cargando Fases...</div>;

    return (
        <div className="animate-fade-in" style={{ padding: '2rem 0' }}>
            {/* Máster Control de Torneo */}
            <div className="glass" style={{ marginBottom: '2.5rem', padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderLeft: regOpen ? '6px solid #10b981' : '6px solid #f59e0b' }}>
                <div>
                    <h2 style={{ fontSize: '1.2rem', marginBottom: '0.2rem', color: regOpen ? '#10b981' : '#f59e0b' }}>
                        {regOpen ? '● Fase de Inscripciones Activa' : '🏆 Torneo en Curso / Cerrado'}
                    </h2>
                    <p style={{ fontSize: '0.85rem', opacity: 0.6 }}>
                        {regOpen 
                            ? 'Los equipos pueden registrarse públicamente. Inicia el torneo para cerrar el proceso.' 
                            : 'El registro público está bloqueado. Detén el torneo si necesitas inscribir a alguien más.'}
                    </p>
                </div>
                <button 
                    className="btn" 
                    onClick={handleToggleTournament}
                    style={{ background: regOpen ? '#10b981' : '#f59e0b', color: 'white', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                >
                    {regOpen ? <><Play size={18} fill="white" /> Iniciar Torneo</> : <><Network size={18} /> Detener Torneo</>}
                </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                    <h2>Motor de Competencia</h2>
                    <p style={{ color: 'var(--text-muted)' }}>Construye el formato del torneo fase por fase y ejecuta el sorteo.</p>
                </div>
                <button className="btn btn-primary" onClick={() => setShowPhaseModal(true)}>
                    <Plus size={18} /> Añadir Fase
                </button>
            </div>

            {phases.length === 0 ? (
                <div className="glass" style={{ padding: '4rem', textAlign: 'center' }}>
                    <Network size={48} style={{ opacity: 0.3, margin: '0 auto 1rem' }} />
                    <h3>Lienzo en Blanco</h3>
                    <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>No has diseñado ninguna fase para este torneo aún.</p>
                    <button className="btn btn-secondary" onClick={() => setShowPhaseModal(true)}>Comenzar con la Fase 1</button>
                </div>
            ) : (
                phases.map((phase) => (
                    <div key={phase.id} className="glass" style={{ marginBottom: '2rem', padding: '0', overflow: 'hidden' }}>
                        {/* Phase Header */}
                        <div style={{ background: 'rgba(255,255,255,0.05)', padding: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <Trophy size={20} color="var(--primary)" />Fase {phase.order}: {phase.name}
                                    <div style={{ display: 'flex', gap: '0.2rem', marginLeft: '0.8rem' }}>
                                        <button 
                                            onClick={() => { setEditingPhase({ id: phase.id, name: phase.name, order: phase.order, type: phase.type, is_double_round: phase.is_double_round }); setShowEditPhaseModal(true); }}
                                            style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', padding: '4px', display: 'flex', opacity: 0.8 }}
                                            title="Editar fase"
                                        >
                                            <Edit2 size={14} />
                                        </button>
                                        <button 
                                            onClick={() => handleDeletePhase(phase.id)}
                                            style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', padding: '4px', display: 'flex', opacity: 0.8 }}
                                            title="Eliminar fase completa"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </h3>
                                <span className="label" style={{ display: 'inline-block', marginTop: '0.5rem', background: 'rgba(255,255,255,0.1)' }}>{phase.type}</span>
                                {phase.is_double_round && (
                                    <span className="label" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', marginTop: '0.5rem', marginLeft: '0.5rem', background: 'rgba(212, 175, 55, 0.2)', color: '#d4af37' }}>
                                        <Repeat size={12} /> Ida y Vuelta
                                    </span>
                                )}
                            </div>
                            <div style={{ display: 'flex', gap: '1rem' }}>
                                <button className="btn btn-secondary" onClick={() => { setActivePhaseId(phase.id); setShowGroupModal(true); }}>
                                    <Plus size={16} /> Añadir Grupo
                                </button>
                                <button className="btn btn-primary" onClick={() => handleRunDraw(phase.id)} style={{ display: 'flex', gap: '0.5rem', background: 'var(--success)' }}>
                                    <Shuffle size={16} /> ¡Sortear Equipos!
                                </button>
                            </div>
                        </div>

                        {/* Groups Area */}
                        <div style={{ padding: '1.5rem' }}>
                            {phase.groups.length === 0 ? (
                                <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>No hay grupos creados en esta fase.</p>
                            ) : (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
                                    {phase.groups.map(group => (
                                        <div key={group.id} style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '8px', padding: '1rem', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>
                                                <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                    {group.name} 
                                                    <span style={{ fontSize: '0.75rem', opacity: 0.5 }}>({group.teams.length} equipos)</span>
                                                    <div style={{ display: 'flex', gap: '0.2rem', marginLeft: '0.5rem' }}>
                                                        <button 
                                                            onClick={() => { setEditingGroup({ id: group.id, name: group.name }); setShowEditGroupModal(true); }}
                                                            style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', padding: '2px', display: 'flex', opacity: 0.7 }}
                                                            title="Editar nombre"
                                                        >
                                                            <Edit2 size={12} />
                                                        </button>
                                                        <button 
                                                            onClick={() => handleDeleteGroup(group.id)}
                                                            style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', padding: '2px', display: 'flex', opacity: 0.7 }}
                                                            title="Eliminar grupo"
                                                        >
                                                            <Trash2 size={12} />
                                                        </button>
                                                    </div>
                                                </h4>
                                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                    <button 
                                                        onClick={() => openAssignModal(phase.id, group.id)}
                                                        className="btn btn-secondary" style={{ padding: '0.2rem 0.6rem', fontSize: '0.75rem' }}
                                                    >
                                                        <Plus size={12} /> Equipos
                                                    </button>
                                                    <button 
                                                        onClick={() => toggleGroup(group.id)}
                                                        className="btn btn-secondary" style={{ padding: '0.2rem 0.6rem', fontSize: '0.75rem' }}
                                                    >
                                                        {expandedGroups[group.id] ? <ChevronUp size={12} /> : <ChevronDown size={12} />} Partidos
                                                    </button>
                                                </div>
                                            </div>
                                            
                                            {/* Teams List (Condensed) */}
                                            {!expandedGroups[group.id] && (
                                                <div style={{ fontSize: '0.85rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                                    {group.teams.map(t => (
                                                        <span key={t.id} style={{ 
                                                            background: 'rgba(255,255,255,0.05)', 
                                                            padding: '0.2rem 0.6rem', 
                                                            borderRadius: '6px', 
                                                            border: '1px solid rgba(255,255,255,0.1)',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '0.5rem'
                                                        }}>
                                                            {t.name}
                                                            <button 
                                                                onClick={(e) => { e.stopPropagation(); handleRemoveTeamFromGroup(group.id, t.id); }}
                                                                style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', display: 'flex', padding: 0 }}
                                                                title="Remover equipo"
                                                            >
                                                                <Trash2 size={12} />
                                                            </button>
                                                        </span>
                                                    ))}
                                                    {group.teams.length === 0 && <span style={{ opacity: 0.3 }}>Sin equipos</span>}
                                                </div>
                                            )}

                                            {/* Matches Section! */}
                                            {expandedGroups[group.id] && (
                                                <div className="animate-fade-in" style={{ marginTop: '0.5rem' }}>
                                                    <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1rem' }}>
                                                        <button 
                                                            className="btn btn-primary" 
                                                            title="Generar Calendario Automático" 
                                                            style={{ flex: 1, background: 'var(--success)', color: 'white' }} 
                                                            onClick={() => handleGenerateFixtures(group.id)}
                                                        >
                                                            <Shuffle size={14} /> Generar Calendario
                                                        </button>
                                                        <button 
                                                            className="btn btn-primary" 
                                                            style={{ flex: 1, background: 'rgba(56, 189, 248, 0.2)', color: 'var(--primary)' }} 
                                                            onClick={() => { 
                                                                setActiveGroupId(group.id); 
                                                                setActivePhaseId(phase.id); 
                                                                setEditingMatch(null); 
                                                                setMatchData({ home_team_id: '', away_team_id: '', match_date: '', match_day: 1, group_id: group.id, location: '', referee: '' }); 
                                                                setModalTeams(group.teams || []); // Pass teams directly
                                                                setShowMatchModal(true); 
                                                            }}
                                                            title="Crear Partido Manual"
                                                        >
                                                            <Plus size={16} />
                                                        </button>
                                                        <button className="btn" title="Restaurar / Limpiar Calendario" style={{ flex: 1, background: 'rgba(239, 68, 68, 0.1)', color: 'var(--error)' }} onClick={() => handleResetFixtures(group.id)}>
                                                            <RotateCcw size={16} />
                                                        </button>
                                                    </div>

                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '300px', overflowY: 'auto', paddingRight: '5px' }}>
                                                        {groupMatches[group.id]?.map(match => (
                                                            <div key={match.id} style={{ background: 'rgba(255,255,255,0.03)', padding: '0.75rem', borderRadius: '6px', fontSize: '0.85rem' }}>
                                                                <div style={{ display: 'flex', justifyContent: 'space-between', opacity: 0.6, fontSize: '0.75rem', marginBottom: '0.3rem' }}>
                                                                    <span>Fecha {match.day}</span>
                                                                    <span>{match.date ? new Date(match.date).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : 'Pendiente'}</span>
                                                                </div>
                                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                    <div style={{ display: 'flex', flex: 1, justifyContent: 'center', gap: '1rem' }}>
                                                                        <span style={{ flex: 1, textAlign: 'right' }}>{match.home}</span>
                                                                        <span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>vs</span>
                                                                        <span style={{ flex: 1 }}>{match.away}</span>
                                                                    </div>
                                                                    <div style={{ display: 'flex', gap: '0.4rem', marginLeft: '0.5rem' }}>
                                                                        <button onClick={() => { 
                                                                            setEditingMatch(match); 
                                                                            setMatchData({ 
                                                                                home_team_id: match.home_id, 
                                                                                away_team_id: match.away_id, 
                                                                                match_date: match.date?.slice(0,16) || '', 
                                                                                match_day: match.day, 
                                                                                group_id: group.id, 
                                                                                location: match.location || '', 
                                                                                referee: match.referee || '',
                                                                                veedor_id: match.veedor_id || ''
                                                                            }); 
                                                                            setActiveGroupId(group.id);
                                                                            setActivePhaseId(phase.id);
                                                                            setModalTeams(group.teams || []); // Pass teams directly
                                                                            setShowMatchModal(true); 
                                                                        }} style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer' }}>
                                                                            <Edit2 size={12} />
                                                                        </button>
                                                                        <button onClick={() => handleDeleteMatch(group.id, match.id)} style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer' }}>
                                                                            <Trash2 size={12} />
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                                {(match.location || match.referee) && (
                                                                    <div style={{ marginTop: '0.3rem', fontSize: '0.7rem', opacity: 0.4, display: 'flex', gap: '0.8rem' }}>
                                                                        {match.location && <span><MapPin size={10} /> {match.location}</span>}
                                                                        {match.referee && <span><UserCheck size={10} /> {match.referee}</span>}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ))}
                                                        {(!groupMatches[group.id] || groupMatches[group.id].length === 0) && (
                                                            <p style={{ textAlign: 'center', opacity: 0.4, padding: '1rem' }}>No hay partidos.</p>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                ))
            )}

            {/* Modal: Editar Fase */}
            {showEditPhaseModal && (
                <div className="modal-overlay">
                    <div className="modal-content glass animate-fade-in" style={{ maxWidth: '450px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
                            <Edit2 size={24} color="var(--primary)" />
                            <h2 style={{ margin: 0 }}>Editar Fase</h2>
                        </div>
                        <form onSubmit={handleUpdatePhase}>
                            <div className="form-group">
                                <label className="label">Nombre de la Fase</label>
                                <input 
                                    type="text" 
                                    className="input" 
                                    value={editingPhase.name} 
                                    onChange={e => setEditingPhase({...editingPhase, name: e.target.value})}
                                    placeholder="Ej: Fase de Grupos, Octavos, etc."
                                    required 
                                />
                            </div>
                            <div className="form-group">
                                <label className="label">Tipo de Competencia</label>
                                <select className="select" value={editingPhase.type} onChange={e => setEditingPhase({...editingPhase, type: e.target.value})}>
                                    <option value="ROUND_ROBIN">Grupos (Todos contra Todos)</option>
                                </select>
                            </div>

                            <div className="form-group" style={{ marginTop: '1rem' }}>
                                <label className="label" style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', cursor: 'pointer' }}>
                                    <div 
                                        onClick={() => setEditingPhase({...editingPhase, is_double_round: !editingPhase.is_double_round})}
                                        style={{ 
                                            width: '40px', 
                                            height: '20px', 
                                            background: editingPhase.is_double_round ? 'var(--primary)' : 'rgba(255,255,255,0.1)', 
                                            borderRadius: '20px', 
                                            position: 'relative',
                                            transition: 'all 0.3s'
                                        }}
                                    >
                                        <div style={{ 
                                            position: 'absolute', 
                                            top: '2px', 
                                            left: editingPhase.is_double_round ? '22px' : '2px', 
                                            width: '16px', 
                                            height: '16px', 
                                            background: 'white', 
                                            borderRadius: '50%',
                                            transition: 'all 0.3s'
                                        }} />
                                    </div>
                                    <span>Partidos de Ida y Vuelta</span>
                                </label>
                            </div>
                            <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                                <button type="button" className="btn btn-secondary" onClick={() => setShowEditPhaseModal(false)}>Cancelar</button>
                                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Guardar Cambios</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal: Fase */}
            {showPhaseModal && (
                <div className="modal-overlay">
                    <div className="modal-content glass animate-fade-in" style={{ maxWidth: '400px' }}>
                        <h3>Crear Nueva Fase</h3>
                        <form onSubmit={handleCreatePhase}>
                            {/* ... (Existing form) */}
                            <div className="form-group" style={{ marginTop: '1rem' }}>
                                <label className="label">Nombre de la Fase</label>
                                <input type="text" className="input" placeholder="Ej: Fase de Grupos" value={newPhase.name} onChange={e => setNewPhase({...newPhase, name: e.target.value})} required />
                            </div>
                            <div className="form-group">
                                <label className="label">Tipo de Competencia</label>
                                <select className="select" value={newPhase.type} onChange={e => setNewPhase({...newPhase, type: e.target.value})}>
                                </select>
                            </div>

                            <div className="form-group" style={{ marginTop: '1rem' }}>
                                <label className="label" style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', cursor: 'pointer' }}>
                                    <div 
                                        onClick={() => setNewPhase({...newPhase, is_double_round: !newPhase.is_double_round})}
                                        style={{ 
                                            width: '40px', 
                                            height: '20px', 
                                            background: newPhase.is_double_round ? 'var(--primary)' : 'rgba(255,255,255,0.1)', 
                                            borderRadius: '20px', 
                                            position: 'relative',
                                            transition: 'all 0.3s'
                                        }}
                                    >
                                        <div style={{ 
                                            position: 'absolute', 
                                            top: '2px', 
                                            left: newPhase.is_double_round ? '22px' : '2px', 
                                            width: '16px', 
                                            height: '16px', 
                                            background: 'white', 
                                            borderRadius: '50%',
                                            transition: 'all 0.3s'
                                        }} />
                                    </div>
                                    <span>Partidos de Ida y Vuelta</span>
                                </label>
                                <p style={{ fontSize: '0.75rem', opacity: 0.5, marginTop: '0.4rem' }}>
                                    Si se activa, los equipos se enfrentarán dos veces (intercambiando localía).
                                </p>
                            </div>
                            <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                                <button type="button" className="btn btn-secondary" onClick={() => setShowPhaseModal(false)}>Cancelar</button>
                                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Crear Fase</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal: Editar Grupo */}
            {showEditGroupModal && (
                <div className="modal-overlay">
                    <div className="modal-content glass animate-fade-in" style={{ maxWidth: '400px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
                            <Edit2 size={24} color="var(--primary)" />
                            <h2 style={{ margin: 0 }}>Editar Grupo</h2>
                        </div>
                        <form onSubmit={handleUpdateGroup}>
                            <div className="form-group">
                                <label className="label">Nombre del Grupo</label>
                                <input 
                                    type="text" 
                                    className="input" 
                                    value={editingGroup.name} 
                                    onChange={e => setEditingGroup({...editingGroup, name: e.target.value})}
                                    required 
                                    autoFocus
                                />
                            </div>
                            <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                                <button type="button" className="btn btn-secondary" onClick={() => setShowEditGroupModal(false)}>Cancelar</button>
                                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Guardar Cambios</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal: Fase */}
            {showGroupModal && (
                <div className="modal-overlay">
                    <div className="modal-content glass animate-fade-in" style={{ maxWidth: '400px' }}>
                        <h3>Añadir Grupo</h3>
                        <form onSubmit={handleCreateGroup}>
                            <div className="form-group" style={{ marginTop: '1rem' }}>
                                <label className="label">Nombre del Grupo</label>
                                <input type="text" className="input" placeholder="Ej: Grupo A" value={newGroup.name} onChange={e => setNewGroup({...newGroup, name: e.target.value})} required />
                            </div>
                            <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                                <button type="button" className="btn btn-secondary" onClick={() => setShowGroupModal(false)}>Cancelar</button>
                                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Guardar Grupo</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal: Assign Team */}
            {showAssignModal && (
                <div className="modal-overlay">
                    <div className="modal-content glass animate-fade-in" style={{ maxWidth: '400px' }}>
                        <h3>Asignar Equipo al Grupo</h3>
                        <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>Selecciona un equipo de los inscritos que aún no tiene grupo en esta fase.</p>
                        
                        {unassignedTeams.length === 0 ? (
                            <p style={{ textAlign: 'center', padding: '1rem' }}>No hay más equipos disponibles.</p>
                        ) : (
                            <div style={{ maxHeight: '300px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                {unassignedTeams.map(team => (
                                    <button 
                                        key={team.id}
                                        onClick={() => handleAssignTeam(team.id)}
                                        className="btn btn-secondary"
                                        style={{ justifyContent: 'space-between', padding: '0.8rem 1rem' }}
                                    >
                                        <span>{team.name}</span>
                                        <Plus size={16} />
                                    </button>
                                ))}
                            </div>
                        )}
                        <button className="btn btn-primary" onClick={() => setShowAssignModal(false)} style={{ width: '100%', marginTop: '1.5rem' }}>Cerrar</button>
                    </div>
                </div>
            )}
            {/* Modal: Manual Match / Edit */}
            {showMatchModal && (
                <div className="modal-overlay">
                    <div className="modal-content glass animate-fade-in" style={{ maxWidth: '450px' }}>
                        <h3>{editingMatch ? 'Editar Encuentro' : 'Nuevo Encuentro Manual'}</h3>
                        <form onSubmit={handleMatchSubmit} style={{ marginTop: '1.5rem' }}>
                            <div className="grid-form" style={{ gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                                <div className="form-group">
                                    <label className="label">Equipo Local</label>
                                    <select 
                                        className="select" required
                                        value={matchData.home_team_id}
                                        onChange={e => setMatchData({...matchData, home_team_id: e.target.value})}
                                    >
                                        <option value="">Seleccionar...</option>
                                        {modalTeams.map(t => (
                                            <option key={t.id} value={t.id}>{t.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="label">Equipo Visitante</label>
                                    <select 
                                        className="select" required
                                        value={matchData.away_team_id}
                                        onChange={e => setMatchData({...matchData, away_team_id: e.target.value})}
                                    >
                                        <option value="">Seleccionar...</option>
                                        {modalTeams.map(t => (
                                            <option key={t.id} value={t.id}>{t.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="grid-form" style={{ gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div className="form-group">
                                    <label className="label">Lugar / Cancha</label>
                                    <select 
                                        className="select"
                                        value={matchData.location}
                                        onChange={e => {
                                            if (e.target.value === "CREATE_NEW_FIELD") {
                                                setShowFieldModal(true);
                                            } else {
                                                setMatchData({...matchData, location: e.target.value});
                                            }
                                        }}
                                    >
                                        <option value="">Seleccionar...</option>
                                        {fields.map(f => (
                                            <option key={f.id} value={f.name}>{f.name}</option>
                                        ))}
                                        <option value="CREATE_NEW_FIELD" style={{ color: 'var(--primary)', fontWeight: 'bold' }}>+ Nueva Cancha...</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="label">Árbitro</label>
                                    <select 
                                        className="select"
                                        value={matchData.referee}
                                        onChange={e => {
                                            if (e.target.value === "CREATE_NEW") {
                                                setShowRefereeModal(true);
                                                setMatchData({...matchData, referee: ''});
                                            } else {
                                                setMatchData({...matchData, referee: e.target.value});
                                            }
                                        }}
                                    >
                                        <option value="">Sin asignar / Pendiente</option>
                                        {referees.map(r => (
                                            <option key={r.id} value={r.full_name}>{r.full_name} ({r.document_number || 'CC n/a'})</option>
                                        ))}
                                        <option value="CREATE_NEW" style={{ color: 'var(--primary)', fontWeight: 'bold' }}>+ Crear Nuevo Árbitro...</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="label">Veedor</label>
                                    <select 
                                        className="select"
                                        value={matchData.veedor_id}
                                        onChange={e => setMatchData({...matchData, veedor_id: e.target.value})}
                                    >
                                        <option value="">Sin asignar</option>
                                        {veedores.map(v => (
                                            <option key={v.id} value={v.id}>{v.username}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="label">Fecha y Hora</label>
                                <input 
                                    type="datetime-local" 
                                    className="input" 
                                    value={matchData.match_date} 
                                    onChange={e => setMatchData({...matchData, match_date: e.target.value})} 
                                />
                            </div>

                            <div className="form-group">
                                <label className="label">Jornada / Fecha #</label>
                                <input 
                                    type="number" 
                                    className="input" 
                                    value={matchData.match_day} 
                                    onChange={e => setMatchData({...matchData, match_day: e.target.value})} 
                                    min="1"
                                    required
                                />
                            </div>

                            <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                                <button type="button" className="btn btn-secondary" onClick={() => setShowMatchModal(false)}>Cancelar</button>
                                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                                    {editingMatch ? 'Actualizar' : 'Crear Partido'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {/* Lottery Overlay */}
            {lottery.active && (
                <div className="lottery-overlay animate-fade-in">
                    <h1 style={{ color: 'var(--primary)', marginBottom: '0.5rem' }}>{lottery.title}</h1>
                    <p style={{ color: 'var(--text-muted)', marginBottom: '3rem' }}>{lottery.subtitle}</p>
                    
                    <div className="lottery-cage">
                        {lottery.currentBall && (
                            <div key={lottery.subtitle} className="balota">
                                {lottery.currentBall.logo ? (
                                    <img src={lottery.currentBall.logo} className="balota-logo" alt="Logo" />
                                ) : (
                                    <span className="balota-initial">{lottery.currentBall.teamName.charAt(0).toUpperCase()}</span>
                                )}
                                <span className="balota-name">{lottery.currentBall.teamName}</span>
                                <span style={{ fontSize: '0.7rem', opacity: 0.6 }}>{lottery.currentBall.description}</span>
                            </div>
                        )}
                        {!lottery.currentBall && (
                            <Shuffle size={64} color="var(--primary)" style={{ opacity: 0.5 }} />
                        )}
                    </div>
                    
                    <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                        <div className="animate-pulse" style={{ color: 'var(--primary)' }}>
                            Extrayendo balota...
                        </div>
                    </div>
                </div>
            )}
            {/* Modal: Crear Árbitro Rápido */}
            {showRefereeModal && (
                <div className="modal-overlay" style={{ zindex: 11000 }}>
                    <div className="modal-content glass animate-fade-in" style={{ maxWidth: '350px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                            <h3>👨‍⚖️ Nuevo Árbitro</h3>
                            <button className="btn-icon" onClick={() => setShowRefereeModal(false)}><Plus size={20} style={{ transform: 'rotate(45deg)' }} /></button>
                        </div>
                        <form onSubmit={handleCreateRefereeFromModal}>
                            <div className="form-group">
                                <label className="label">Número de Cédula / Doc</label>
                                <input 
                                    type="text" className="input" required
                                    value={newReferee.document_number} 
                                    onChange={e => setNewReferee({...newReferee, document_number: e.target.value})} 
                                />
                            </div>
                            <div className="form-group">
                                <label className="label">Nombre Completo</label>
                                <input 
                                    type="text" className="input" required
                                    value={newReferee.full_name} 
                                    onChange={e => setNewReferee({...newReferee, full_name: e.target.value})} 
                                />
                            </div>
                            <div className="form-group">
                                <label className="label">Teléfono</label>
                                <input 
                                    type="text" className="input" 
                                    value={newReferee.phone} 
                                    onChange={e => setNewReferee({...newReferee, phone: e.target.value})} 
                                />
                            </div>
                            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowRefereeModal(false)}>Cancelar</button>
                                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Crear</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {/* Modal: Crear Cancha Rápida */}
            {showFieldModal && (
                <div className="modal-overlay" style={{ zIndex: 11000 }}>
                    <div className="modal-content glass animate-fade-in" style={{ maxWidth: '350px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                            <h3>🏟️ Nueva Cancha / Sede</h3>
                            <button className="btn-icon" onClick={() => setShowFieldModal(false)}><Plus size={20} style={{ transform: 'rotate(45deg)' }} /></button>
                        </div>
                        <form onSubmit={handleCreateFieldFromModal}>
                            <div className="form-group">
                                <label className="label">Nombre de la Cancha</label>
                                <input 
                                    type="text" className="input" required
                                    placeholder="Ej: Cancha Central, Estadio Municipal..."
                                    value={newField.name} 
                                    onChange={e => setNewField({...newField, name: e.target.value})} 
                                />
                            </div>
                            <div className="form-group">
                                <label className="label">Ubicación / Dirección</label>
                                <input 
                                    type="text" className="input" 
                                    placeholder="Opcional"
                                    value={newField.address} 
                                    onChange={e => setNewField({...newField, address: e.target.value})} 
                                />
                            </div>
                            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowFieldModal(false)}>Cancelar</button>
                                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Guardar</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TournamentPhases;

