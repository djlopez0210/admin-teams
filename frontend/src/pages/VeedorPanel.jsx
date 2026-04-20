import React, { useState, useEffect } from 'react';
import { Calendar, Users, CheckSquare, Trophy, Clock, MapPin, ChevronLeft, Save, Plus, Activity, UserPlus, AlertTriangle } from 'lucide-react';
import { tournamentService, api } from '../services/api';
import { useNotification } from '../context/NotificationContext';

const VeedorPanel = () => {
    const { showNotification } = useNotification();
    const [matches, setMatches] = useState([]);
    const [selectedMatch, setSelectedMatch] = useState(null);
    const [step, setStep] = useState('list'); // 'list', 'lineup', 'live', 'result'
    const [loading, setLoading] = useState(true);
    const [lineup, setLineup] = useState([]); // List of player IDs
    const [homePlayers, setHomePlayers] = useState([]);
    const [awayPlayers, setAwayPlayers] = useState([]);
    const [score, setScore] = useState({ home: 0, away: 0 });
    const [matchEvents, setMatchEvents] = useState([]);
    const [showEventModal, setShowEventModal] = useState(false);
    const [eventData, setEventData] = useState({ type: 'GOAL', team_id: null, player_id: '', related_player_id: '' });
    const [matchMinute, setMatchMinute] = useState(0);

    useEffect(() => {
        loadMatches();
    }, []);

    const loadMatches = async () => {
        try {
            const res = await api.get('/veedor/matches');
            setMatches(res.data);
            setLoading(false);
        } catch (err) {
            showNotification('Error al cargar partidos', 'error');
            setLoading(false);
        }
    };

    const handleSelectMatch = async (match) => {
        console.log('Manejando selección de partido:', match.id);
        setSelectedMatch(match);
        setLoading(true);
        try {
            // Load players for both teams
            const [homeRes, awayRes] = await Promise.all([
                api.get(`/teams/${match.home_id}/players`), 
                api.get(`/teams/${match.away_id}/players`)
            ]);
            console.log('Jugadores locales cargados:', homeRes.data.length);
            console.log('Jugadores visitantes cargados:', awayRes.data.length);
            setHomePlayers(homeRes.data);
            setAwayPlayers(awayRes.data);
            
            if (match.status === 'IN_PROGRESS' || match.status === 'COMPLETED') {
                const [lineupRes, eventsRes] = await Promise.all([
                    tournamentService.getMatchLineup(match.id),
                    tournamentService.getMatchEvents(match.id)
                ]);
                console.log('Planilla recuperada:', lineupRes.data);
                console.log('Eventos recuperados:', eventsRes.data.length);
                setLineup(lineupRes.data || []);
                setMatchEvents(eventsRes.data);
                setScore({ home: match.home_score || 0, away: match.away_score || 0 });
                setStep(match.status === 'IN_PROGRESS' ? 'live' : 'result');
            } else {
                setStep('lineup');
            }
        } catch (err) {
            console.error('Error en handleSelectMatch:', err);
            showNotification('Error al cargar datos del partido', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        let interval;
        if (step === 'live' && selectedMatch?.actual_start) {
            const updateMinute = () => {
                const start = new Date(selectedMatch.actual_start);
                const now = new Date();
                const diff = Math.floor((now - start) / 60000);
                setMatchMinute(diff >= 0 ? diff : 0);
            };
            updateMinute();
            interval = setInterval(updateMinute, 30000); // Update every 30s
        }
        return () => clearInterval(interval);
    }, [step, selectedMatch]);

    const togglePlayer = (id) => {
        setLineup(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);
    };

    const saveLineup = async () => {
        try {
            await api.post(`/matches/${selectedMatch.id}/lineup`, { player_ids: lineup });
            showNotification('Planilla de juego guardada', 'success');
            setStep('ready_to_start');
        } catch (err) {
            showNotification('Error al guardar planilla', 'error');
        }
    };

    const handleStartMatch = async () => {
        try {
            const res = await tournamentService.startMatch(selectedMatch.id);
            setSelectedMatch({ ...selectedMatch, status: 'IN_PROGRESS', actual_start: res.data.actual_start });
            setStep('live');
            showNotification('¡Juego Iniciado!', 'success');
        } catch (err) {
            showNotification('Error al iniciar el juego', 'error');
        }
    };

    const handleAddEvent = async () => {
        if (!eventData.player_id) {
            showNotification('Selecciona un jugador', 'warning');
            return;
        }
        try {
            await tournamentService.addMatchEvent(selectedMatch.id, eventData);
            showNotification('Evento registrado', 'success');
            
            // Refresh events and score
            const eventsRes = await tournamentService.getMatchEvents(selectedMatch.id);
            setMatchEvents(eventsRes.data);
            
            // Check for double yellow expulsions
            if (eventData.type === 'YELLOW_CARD') {
                const yellowCount = eventsRes.data.filter(e => e.type === 'YELLOW_CARD' && Number(e.player_id) === Number(eventData.player_id)).length;
                if (yellowCount >= 2) {
                    showNotification('¡Expulsión por doble amarilla!', 'warning');
                }
            } else if (eventData.type === 'RED_CARD') {
                showNotification('¡Expulsión directa!', 'error');
            }
            
            if (eventData.type === 'GOAL') {
                if (parseInt(eventData.team_id) === selectedMatch.home_id) {
                    setScore(s => ({ ...s, home: s.home + 1 }));
                } else {
                    setScore(s => ({ ...s, away: s.away + 1 }));
                }
            }
            
            setShowEventModal(false);
            setEventData({ type: 'GOAL', team_id: null, player_id: '', related_player_id: '' });
        } catch (err) {
            showNotification('Error al registrar evento', 'error');
        }
    };

    const submitResults = async () => {
        try {
            await api.put(`/matches/${selectedMatch.id}`, {
                home_score: score.home,
                away_score: score.away,
                status: 'COMPLETED'
            });
            // Save events (goals) logic...
            showNotification('Resultado oficial publicado', 'success');
            setStep('list');
            setSelectedMatch(null);
            loadMatches();
        } catch (err) {
            showNotification('Error al publicar resultado', 'error');
        }
    };

    if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Cargando...</div>;

    return (
        <div className="mobile-veedor-container" style={{ maxWidth: '600px', margin: '0 auto', padding: '1rem' }}>
            <div className="glass" style={{ padding: '1.5rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <Trophy size={24} color="var(--primary)" />
                    <h2 style={{ fontSize: '1.25rem' }}>Mi Veeduría</h2>
                </div>
                <button 
                    onClick={() => { localStorage.clear(); window.location.href = '/login'; }}
                    style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--error)', border: 'none', padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}
                >
                    Cerrar Sesión
                </button>
            </div>

            {step === 'list' && (
                <div className="animate-fade-in">
                    <h3>Próximos Partidos</h3>
                    <div className="grid" style={{ gridTemplateColumns: '1fr', gap: '1rem' }}>
                        {matches
                            .filter(m => m.status !== 'COMPLETED')
                            .map(match => (
                            <div key={match.id} className="glass card animate-fade-in" style={{ padding: '1.2rem', cursor: 'pointer' }} onClick={() => handleSelectMatch(match)}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                                    <span className={`badge ${match.status === 'SCHEDULED' ? 'badge-primary' : 'badge-warning'}`} style={{ fontSize: '0.7rem' }}>
                                        {match.status === 'SCHEDULED' ? 'Programado' : 'En Vivo'}
                                    </span>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', opacity: 0.6, fontSize: '0.8rem' }}>
                                        <Clock size={14} /> Fecha {match.day}
                                    </div>
                                </div>
                                <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
                                    <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{match.home} VS {match.away}</div>
                                    <div style={{ fontSize: '0.8rem', opacity: 0.6, marginTop: '0.4rem' }}>
                                        <MapPin size={12} inline /> {match.location || 'Sin cancha'}
                                    </div>
                                </div>
                                <button className="btn btn-primary" style={{ width: '100%', padding: '0.6rem' }}>
                                    Gestionar Encuentro <ChevronLeft size={16} />
                                </button>
                            </div>
                        ))}
                        {matches.filter(m => m.status !== 'COMPLETED').length === 0 && (
                            <div className="glass" style={{ padding: '2rem', textAlign: 'center', opacity: 0.5 }}>
                                No tienes partidos asignados para gestionar hoy.
                            </div>
                        )}
                    </div>
                </div>
            )}

            {step === 'lineup' && (
                <div className="animate-fade-in">
                    <button className="btn btn-secondary" style={{ marginBottom: '1rem' }} onClick={() => setStep('list')}><ChevronLeft size={16}/> Volver</button>
                    <h3>Planilla de Jugadores</h3>
                    <p style={{ fontSize: '0.8rem', opacity: 0.6, marginBottom: '1.5rem' }}>Selecciona los jugadores que están presentes para este encuentro.</p>
                    
                    <div className="glass" style={{ padding: '1rem', marginBottom: '1rem' }}>
                        <h4 style={{ color: 'var(--primary)', marginBottom: '1rem' }}>{selectedMatch.home}</h4>
                        {homePlayers.map(p => (
                            <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.8rem', borderBottom: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer' }}>
                                <input type="checkbox" checked={lineup.includes(p.id)} onChange={() => togglePlayer(p.id)} />
                                <span>#{p.uniform_number} - {p.full_name}</span>
                            </label>
                        ))}
                    </div>

                    <div className="glass" style={{ padding: '1rem', marginBottom: '1rem' }}>
                        <h4 style={{ color: 'var(--primary)', marginBottom: '1rem' }}>{selectedMatch.away}</h4>
                        {awayPlayers.map(p => (
                            <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.8rem', borderBottom: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer' }}>
                                <input type="checkbox" checked={lineup.includes(p.id)} onChange={() => togglePlayer(p.id)} />
                                <span>#{p.uniform_number} - {p.full_name}</span>
                            </label>
                        ))}
                    </div>

                    <button className="btn btn-success" style={{ width: '100%', marginTop: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }} onClick={saveLineup}>
                        <Save size={18}/> Confirmar Planilla
                    </button>
                </div>
            )}

            {step === 'ready_to_start' && (
                <div className="animate-fade-in glass" style={{ padding: '2rem', textAlign: 'center' }}>
                    <Activity size={48} color="var(--primary)" style={{ marginBottom: '1rem' }} />
                    <h3>Planilla Lista</h3>
                    <p style={{ opacity: 0.6, marginBottom: '2rem' }}>Los jugadores han sido registrados. ¿Listo para dar inicio al encuentro?</p>
                    <button className="btn btn-primary" style={{ width: '100%', padding: '1rem' }} onClick={handleStartMatch}>
                        INICIAR JUEGO (Cronómetro)
                    </button>
                </div>
            )}

            {step === 'live' && (
                <div className="animate-fade-in">
                    <div className="glass" style={{ padding: '1.25rem', textAlign: 'center', marginBottom: '1rem', position: 'sticky', top: '1rem', zIndex: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '2rem' }}>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontSize: '2.5rem', fontWeight: 900 }}>{score.home}</div>
                                <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>{selectedMatch.home}</div>
                            </div>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: '1.25rem', color: 'var(--primary)', fontWeight: 800 }}>{matchMinute}'</div>
                                <div style={{ fontSize: '0.6rem', opacity: 0.6 }}>EN VIVO</div>
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontSize: '2.5rem', fontWeight: 900 }}>{score.away}</div>
                                <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>{selectedMatch.away}</div>
                            </div>
                        </div>
                    </div>

                    <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '2rem' }}>
                        <button className="btn btn-primary" onClick={() => { setEventData({...eventData, team_id: selectedMatch.home_id}); setShowEventModal(true); }}>
                            <Plus size={16}/> Evento {selectedMatch.home}
                        </button>
                        <button className="btn btn-primary" onClick={() => { setEventData({...eventData, team_id: selectedMatch.away_id}); setShowEventModal(true); }}>
                            <Plus size={16}/> Evento {selectedMatch.away}
                        </button>
                    </div>

                    <h3>Línea de Tiempo</h3>
                    <div className="glass" style={{ padding: '1rem', maxHeight: '200px', overflowY: 'auto' }}>
                        {matchEvents.length === 0 && <p style={{ opacity: 0.5, textAlign: 'center' }}>No hay eventos registrados</p>}
                        {matchEvents.map(e => (
                            <div key={e.id} style={{ display: 'flex', gap: '1rem', padding: '0.5rem 0', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.9rem' }}>
                                <span style={{ color: 'var(--primary)', fontWeight: 700 }}>{e.minute}'</span>
                                <strong>{e.type}</strong>
                                <span>{e.player_name}</span>
                                {e.type === 'SUBSTITUTION' && <span style={{ opacity: 0.6 }}>por {e.related_player_name}</span>}
                            </div>
                        ))}
                    </div>

                    <button className="btn btn-secondary" style={{ width: '100%', marginTop: '2rem', opacity: 0.7 }} onClick={() => setStep('result')}>
                        Finalizar Encuentro
                    </button>
                </div>
            )}

            {/* Modal de Eventos */}
            {showEventModal && (
                <div className="modal-overlay" onClick={() => setShowEventModal(false)}>
                    <div className="glass modal-content animate-scale-up" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
                        <h3>Registrar Evento - {Number(eventData.team_id) === Number(selectedMatch.home_id) ? selectedMatch.home : selectedMatch.away}</h3>
                        
                        <div className="form-group" style={{ marginTop: '1.5rem' }}>
                            <label className="label">Tipo de Evento</label>
                            <select className="input" value={eventData.type} onChange={e => setEventData({...eventData, type: e.target.value})}>
                                <option value="GOAL">⚽ GOL</option>
                                <option value="YELLOW_CARD">🟨 Tarjeta Amarilla</option>
                                <option value="BLUE_CARD">🟦 Tarjeta Azul</option>
                                <option value="RED_CARD">🟥 Tarjeta Roja</option>
                                <option value="SUBSTITUTION">🔄 Sustitución</option>
                            </select>
                        </div>

                        <div className="form-group">
                            <label className="label">
                                {eventData.type === 'SUBSTITUTION' ? 'Sale del campo' : 'Jugador'}
                            </label>
                            <select className="input" value={eventData.player_id} onChange={e => setEventData({...eventData, player_id: e.target.value})}>
                                <option value="">Seleccionar jugador...</option>
                                {(Number(eventData.team_id) === Number(selectedMatch.home_id) ? homePlayers : awayPlayers)
                                    .filter(p => {
                                        const pId = Number(p.id);
                                        // Must be in initial lineup OR have entered via substitution
                                        const inLineup = lineup.map(id => Number(id)).includes(pId);
                                        const enteredViaSub = matchEvents.some(e => e.type === 'SUBSTITUTION' && Number(e.related_player_id) === pId);
                                        
                                        if (!inLineup && !enteredViaSub) return false;

                                        // Must NOT have left via substitution
                                        const leftViaSub = matchEvents.some(e => e.type === 'SUBSTITUTION' && Number(e.player_id) === pId);
                                        if (leftViaSub) return false;

                                        // Must NOT have received a red card
                                        const hasRed = matchEvents.some(e => e.type === 'RED_CARD' && Number(e.player_id) === pId);
                                        if (hasRed) return false;

                                        // Must NOT have received 2 yellow cards
                                        const yellowCount = matchEvents.filter(e => e.type === 'YELLOW_CARD' && Number(e.player_id) === pId).length;
                                        if (yellowCount >= 2) return false;

                                        return true;
                                    })
                                    .map(p => (
                                        <option key={p.id} value={p.id}>#{p.uniform_number} - {p.full_name}</option>
                                    ))
                                }
                            </select>
                        </div>

                        {eventData.type === 'SUBSTITUTION' && (
                            <div className="form-group">
                                <label className="label">Entra al campo (Banca)</label>
                                <select className="input" value={eventData.related_player_id} onChange={e => setEventData({...eventData, related_player_id: e.target.value})}>
                                    <option value="">Seleccionar jugador...</option>
                                    {(Number(eventData.team_id) === Number(selectedMatch.home_id) ? homePlayers : awayPlayers)
                                        .filter(p => {
                                            const pId = Number(p.id);
                                            // Must NOT be in initial lineup
                                            const inLineup = lineup.map(id => Number(id)).includes(pId);
                                            // Must NOT have entered already
                                            const hasEntered = matchEvents.some(e => e.type === 'SUBSTITUTION' && Number(e.related_player_id) === pId);
                                            
                                            return !inLineup && !hasEntered;
                                        })
                                        .map(p => (
                                            <option key={p.id} value={p.id}>#{p.uniform_number} - {p.full_name}</option>
                                        ))
                                    }
                                </select>
                            </div>
                        )}

                        <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowEventModal(false)}>Cancelar</button>
                            <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleAddEvent}>Confirmar</button>
                        </div>
                    </div>
                </div>
            )}

            {step === 'result' && (
                <div className="animate-fade-in">
                    <div className="glass" style={{ padding: '1.5rem', textAlign: 'center', marginBottom: '1.5rem' }}>
                        <h3 style={{ marginBottom: '1rem' }}>Resumen Final</h3>
                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '2rem', marginBottom: '1rem' }}>
                            <div>
                                <div style={{ fontSize: '2.5rem', fontWeight: 900 }}>{score.home}</div>
                                <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>{selectedMatch.home}</div>
                            </div>
                            <div style={{ fontSize: '1.5rem', opacity: 0.3 }}>-</div>
                            <div>
                                <div style={{ fontSize: '2.5rem', fontWeight: 900 }}>{score.away}</div>
                                <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>{selectedMatch.away}</div>
                            </div>
                        </div>
                        <div className="badge-matches" style={{ display: 'inline-block', background: 'rgba(255,255,255,0.05)', padding: '0.4rem 1rem' }}>
                            Partido Finalizado
                        </div>
                    </div>
 
                    <h3>Eventos del Encuentro</h3>
                    <div className="glass" style={{ padding: '1rem', marginBottom: '1.5rem' }}>
                        {matchEvents.length === 0 ? (
                            <p style={{ opacity: 0.5, textAlign: 'center' }}>No se registraron eventos.</p>
                        ) : (
                            <div style={{ display: 'grid', gap: '0.8rem' }}>
                                {matchEvents.sort((a,b) => a.minute - b.minute).map((e, index, array) => {
                                    // Logic to determine icon
                                    let icon = '⚽';
                                    if (e.type === 'GOAL') icon = '⚽';
                                    else if (e.type === 'RED_CARD') icon = '🟥';
                                    else if (e.type === 'YELLOW_CARD') {
                                        // Check if it's the 2nd yellow for this player in the sorted timeline
                                        const yellowsPrior = array.slice(0, index + 1).filter(prev => prev.type === 'YELLOW_CARD' && prev.player_id === e.player_id).length;
                                        icon = yellowsPrior >= 2 ? '🟥' : '🟨';
                                    } else if (e.type === 'SUBSTITUTION') icon = '🔄';

                                    return (
                                        <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.9rem' }}>
                                            <div style={{ display: 'flex', gap: '0.8rem' }}>
                                                <span style={{ color: 'var(--primary)', fontWeight: 700 }}>{e.minute}'</span>
                                                <span>{icon} {e.player_name || 'Jugador'}</span>
                                            </div>
                                            {e.related_player_name && <span style={{ opacity: 0.6 }}>x {e.related_player_name}</span>}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
 
                    <button className="btn btn-primary" style={{ width: '100%', padding: '1rem', fontWeight: 800 }} onClick={submitResults}>
                        PUBLICAR RESULTADO OFICIAL
                    </button>
                    <button className="btn btn-secondary" style={{ width: '100%', marginTop: '1rem' }} onClick={() => setStep('live')}>
                        <ChevronLeft size={16}/> Corregir Eventos
                    </button>
                </div>
            )}
        </div>
    );
};

export default VeedorPanel;
