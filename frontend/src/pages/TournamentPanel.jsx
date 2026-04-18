import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Trophy, Calendar, Table as TableIcon, ArrowLeft, Loader2, Info } from 'lucide-react';
import { tournamentService } from '../services/api';
import { useNotification } from '../context/NotificationContext';

const TournamentPanel = () => {
    const { teamSlug: tournamentSlug } = useParams();
    const navigate = useNavigate();
    const { showNotification } = useNotification();
    const [tournament, setTournament] = useState(null);
    const [standings, setStandings] = useState([]);
    const [fixtures, setFixtures] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('standings');

    useEffect(() => {
        if (tournamentSlug) {
            loadTournamentData();
        }
    }, [tournamentSlug]);

    const loadTournamentData = async () => {
        setLoading(true);
        try {
            const [tRes, sRes, fRes] = await Promise.all([
                tournamentService.get(tournamentSlug),
                tournamentService.getStandings(tournamentSlug),
                tournamentService.getFixtures(tournamentSlug)
            ]);
            setTournament(tRes.data);
            setStandings(sRes.data);
            setFixtures(fRes.data);
        } catch (err) {
            console.error('Error loading tournament data', err);
            showNotification('Error al cargar datos del torneo. Verifica que el demo esté activo.', 'error');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '1rem' }}>
                <Loader2 className="animate-spin" size={48} color="var(--primary)" />
                <p>Cargando motor de competencia...</p>
            </div>
        );
    }

    if (!tournament) {
        return (
            <div className="glass" style={{ textAlign: 'center', padding: '4rem' }}>
                <Info size={48} style={{ marginBottom: '1rem', opacity: 0.5 }} />
                <h2>Torneo no encontrado</h2>
                <p>Asegúrate de haber ejecutado los scripts de migración y seed.</p>
                <button className="btn btn-primary" onClick={() => navigate('/')} style={{ marginTop: '2rem' }}>
                    Ir al Inicio
                </button>
            </div>
        );
    }

    return (
        <div className="animate-fade-in">
            {/* Hero Header */}
            <div className="glass" style={{ 
                padding: '3rem 2rem', 
                marginBottom: '2rem', 
                borderRadius: '1.5rem',
                background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.9), rgba(30, 41, 59, 0.8))',
                border: '1px solid rgba(0, 242, 254, 0.3)',
                position: 'relative',
                overflow: 'hidden'
            }}>
                <div style={{ position: 'absolute', top: '-50px', right: '-50px', opacity: 0.1 }}>
                    <Trophy size={200} color="var(--primary)" />
                </div>
                
                <button 
                    className="btn btn-secondary" 
                    onClick={() => navigate('/')}
                    style={{ marginBottom: '1.5rem', padding: '0.5rem 1rem', fontSize: '0.85rem' }}
                >
                    <ArrowLeft size={16} /> Volver
                </button>
                
                <h1 style={{ fontSize: '2.5rem', marginBottom: '0.5rem', background: 'linear-gradient(to right, #fff, var(--primary))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                    {tournament.name}
                </h1>
                <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }}>
                    Competencia Oficial • {tournament.format_type === 'liga' ? 'Todos contra Todos' : 'Fase de Grupos'}
                </p>
            </div>

            {/* Navigation Tabs */}
            <div className="tabs-container" style={{ marginBottom: '2rem', display: 'flex', gap: '1rem' }}>
                <button 
                    className={`tab ${activeTab === 'standings' ? 'active' : ''}`}
                    onClick={() => setActiveTab('standings')}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.5rem', borderRadius: '12px', border: 'none', cursor: 'pointer', background: activeTab === 'standings' ? 'var(--primary)' : 'var(--glass)', color: activeTab === 'standings' ? '#000' : '#fff', fontWeight: 600, transition: 'all 0.3s' }}
                >
                    <TableIcon size={18} /> Tabla de Posiciones
                </button>
                <button 
                    className={`tab ${activeTab === 'fixtures' ? 'active' : ''}`}
                    onClick={() => setActiveTab('fixtures')}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.5rem', borderRadius: '12px', border: 'none', cursor: 'pointer', background: activeTab === 'fixtures' ? 'var(--primary)' : 'var(--glass)', color: activeTab === 'fixtures' ? '#000' : '#fff', fontWeight: 600, transition: 'all 0.3s' }}
                >
                    <Calendar size={18} /> Calendario de Juegos
                </button>
            </div>

            {/* Content Area */}
            {activeTab === 'standings' ? (
                <div className="glass table-container animate-fade-in" style={{ padding: '0' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: 'rgba(255,255,255,0.05)' }}>
                                <th style={{ padding: '1.2rem', textAlign: 'center', width: '60px' }}>#</th>
                                <th style={{ padding: '1.2rem', textAlign: 'left' }}>Equipo</th>
                                <th style={{ padding: '1.2rem', textAlign: 'center' }}>PJ</th>
                                <th style={{ padding: '1.2rem', textAlign: 'center' }}>PG</th>
                                <th style={{ padding: '1.2rem', textAlign: 'center' }}>PE</th>
                                <th style={{ padding: '1.2rem', textAlign: 'center' }}>PP</th>
                                <th style={{ padding: '1.2rem', textAlign: 'center' }}>GF</th>
                                <th style={{ padding: '1.2rem', textAlign: 'center' }}>GC</th>
                                <th style={{ padding: '1.2rem', textAlign: 'center' }}>DG</th>
                                <th style={{ padding: '1.2rem', textAlign: 'center', background: 'rgba(0, 242, 254, 0.1)', color: 'var(--primary)', fontWeight: 800 }}>PTS</th>
                            </tr>
                        </thead>
                        <tbody>
                            {standings.map((team, index) => (
                                <tr key={team.id} style={{ borderTop: '1px solid rgba(255,255,255,0.05)', transition: 'background 0.2s' }} className="hover-row">
                                    <td style={{ padding: '1rem', textAlign: 'center', fontWeight: 700, color: index < 3 ? 'var(--primary)' : 'inherit' }}>
                                        {index + 1}
                                    </td>
                                    <td style={{ padding: '1rem', fontWeight: 600 }}>{team.name}</td>
                                    <td style={{ padding: '1rem', textAlign: 'center' }}>{team.pj}</td>
                                    <td style={{ padding: '1rem', textAlign: 'center' }}>{team.pg}</td>
                                    <td style={{ padding: '1rem', textAlign: 'center' }}>{team.pe}</td>
                                    <td style={{ padding: '1rem', textAlign: 'center' }}>{team.pp}</td>
                                    <td style={{ padding: '1rem', textAlign: 'center' }}>{team.gf}</td>
                                    <td style={{ padding: '1rem', textAlign: 'center' }}>{team.gc}</td>
                                    <td style={{ padding: '1rem', textAlign: 'center', color: team.gd > 0 ? 'var(--success)' : team.gd < 0 ? 'var(--error)' : 'inherit' }}>
                                        {team.gd > 0 ? `+${team.gd}` : team.gd}
                                    </td>
                                    <td style={{ padding: '1rem', textAlign: 'center', fontWeight: 800, fontSize: '1.1rem', background: 'rgba(0, 242, 254, 0.05)', color: 'var(--primary)' }}>
                                        {team.pts}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="fixtures-grid animate-fade-in" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '1.5rem' }}>
                    {fixtures.length === 0 ? (
                        <div className="glass" style={{ gridColumn: '1/-1', textAlign: 'center', padding: '3rem' }}>
                            <p>No hay partidos programados todavía.</p>
                        </div>
                    ) : fixtures.map(match => (
                        <div key={match.id} className="glass match-card" style={{ padding: '1.5rem', position: 'relative', borderLeft: match.status === 'jugado' ? '4px solid var(--primary)' : '4px solid var(--text-muted)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                                <span>Fecha {match.round}</span>
                                <span style={{ 
                                    color: match.status === 'jugado' ? 'var(--primary)' : 'inherit',
                                    fontWeight: match.status === 'jugado' ? 700 : 400
                                }}>
                                    {match.status === 'jugado' ? 'Finalizado' : 'Programado'}
                                </span>
                            </div>
                            
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                                <div style={{ flex: 1, textAlign: 'right', fontWeight: 600, fontSize: '1.1rem' }}>{match.home}</div>
                                
                                <div style={{ 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    gap: '0.5rem', 
                                    padding: '0.5rem 1rem', 
                                    background: 'rgba(0,0,0,0.3)', 
                                    borderRadius: '8px',
                                    fontSize: '1.5rem',
                                    fontWeight: 800,
                                    minWidth: '100px',
                                    justifyContent: 'center',
                                    border: '1px solid rgba(255,255,255,0.1)'
                                }}>
                                    {match.status === 'jugado' ? (
                                        <>
                                            <span>{match.home_score}</span>
                                            <span style={{ opacity: 0.3 }}>-</span>
                                            <span>{match.away_score}</span>
                                        </>
                                    ) : (
                                        <span style={{ fontSize: '0.9rem', opacity: 0.5 }}>VS</span>
                                    )}
                                </div>
                                
                                <div style={{ flex: 1, textAlign: 'left', fontWeight: 600, fontSize: '1.1rem' }}>{match.away}</div>
                            </div>
                            
                            {match.date && (
                                <div style={{ marginTop: '1rem', textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                    {new Date(match.date).toLocaleString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default TournamentPanel;
