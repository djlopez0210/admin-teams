import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Trophy, Calendar, Table as TableIcon, ArrowLeft, Loader2, Info, Download, MapPin, Users, Target } from 'lucide-react';
import { tournamentService } from '../services/api';
import { useNotification } from '../context/NotificationContext';

const TournamentLanding = () => {
    const { tournamentSlug } = useParams();
    const navigate = useNavigate();
    const { showNotification } = useNotification();
    const [tournament, setTournament] = useState(null);
    const [standings, setStandings] = useState([]);
    const [fixtures, setFixtures] = useState([]);
    const [scorers, setScorers] = useState([]);
    const [teams, setTeams] = useState([]);
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
            const [tRes, sRes, fRes, scRes, tmRes] = await Promise.all([
                tournamentService.get(tournamentSlug),
                tournamentService.getStandings(tournamentSlug),
                tournamentService.getFixtures(tournamentSlug),
                tournamentService.getScorers(tournamentSlug),
                tournamentService.getTeams(tournamentSlug)
            ]);
            setTournament(tRes.data);
            setStandings(sRes.data);
            setFixtures(fRes.data);
            setScorers(scRes.data);
            setTeams(tmRes.data);

            // Apply dynamic branding
            if (tRes.data.primary_color || tRes.data.secondary_color) {
                const styleId = 'dynamic-tournament-theme';
                let styleElement = document.getElementById(styleId);
                if (!styleElement) {
                    styleElement = document.createElement('style');
                    styleElement.id = styleId;
                    document.head.appendChild(styleElement);
                }
                styleElement.innerHTML = `
                    :root {
                        ${tRes.data.primary_color ? `--primary: ${tRes.data.primary_color} !important;` : ''}
                        ${tRes.data.secondary_color ? `--secondary: ${tRes.data.secondary_color} !important;` : ''}
                    }
                    .btn-primary { background-color: var(--primary) !important; color: #000 !important; }
                    .tab.active { border-bottom-color: var(--primary) !important; color: var(--primary) !important; }
                    .badge { background-color: var(--primary) !important; color: #000 !important; }
                `;
            }
        } catch (err) {
            console.error('Error loading tournament data', err);
            showNotification('Error al cargar datos del torneo.', 'error');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '1rem' }}>
                <Loader2 className="animate-spin" size={48} color="var(--primary)" />
                <p>Cargando ecosistema de competencia...</p>
            </div>
        );
    }

    if (!tournament) {
        return (
            <div className="glass" style={{ textAlign: 'center', padding: '4rem' }}>
                <Info size={48} style={{ marginBottom: '1rem', opacity: 0.5 }} />
                <h2>Torneo no encontrado</h2>
                <button className="btn btn-primary" onClick={() => navigate('/')} style={{ marginTop: '2rem' }}>
                    Ir al Inicio
                </button>
            </div>
        );
    }

    return (
        <div className="animate-fade-in">
            {/* Hero Section */}
            <div className="glass" style={{ 
                position: 'relative',
                marginBottom: '2rem', 
                borderRadius: '1.5rem',
                overflow: 'hidden',
                minHeight: '400px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'flex-end',
                padding: '3rem'
            }}>
                {tournament.image_url ? (
                    <img 
                        src={tournament.image_url} 
                        alt={tournament.name}
                        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.4 }}
                    />
                ) : (
                    <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'linear-gradient(135deg, #0f172a, #1e293b)', opacity: 0.8 }} />
                )}
                
                <div style={{ position: 'relative', zIndex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                        <span className="badge" style={{ background: 'var(--primary)', color: '#000' }}>Torneo Oficial</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.9rem' }}>
                            <MapPin size={16} /> {tournament.city}
                        </span>
                    </div>
                    <h1 style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>{tournament.name}</h1>
                    <p style={{ maxWidth: '600px', fontSize: '1.1rem', opacity: 0.8, marginBottom: '2rem' }}>
                        {tournament.description || 'Bienvenido a la competencia oficial. Aquí puedes seguir los resultados y estadísticas en tiempo real.'}
                    </p>
                    
                    <div style={{ display: 'flex', gap: '1rem' }}>
                        {tournament.rules_pdf_url && (
                            <a href={tournament.rules_pdf_url} target="_blank" rel="noreferrer" className="btn btn-primary">
                                <Download size={18} /> Reglamento (PDF)
                            </a>
                        )}
                        <button className="btn btn-secondary" onClick={() => setActiveTab('teams')}>
                            <Users size={18} /> Ver Equipos
                        </button>
                    </div>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="tabs-container" style={{ marginBottom: '2rem' }}>
                <button className={`tab ${activeTab === 'standings' ? 'active' : ''}`} onClick={() => setActiveTab('standings')}>
                    <TableIcon size={18} /> Posiciones
                </button>
                <button className={`tab ${activeTab === 'fixtures' ? 'active' : ''}`} onClick={() => setActiveTab('fixtures')}>
                    <Calendar size={18} /> Calendario
                </button>
                <button className={`tab ${activeTab === 'scorers' ? 'active' : ''}`} onClick={() => setActiveTab('scorers')}>
                    <Target size={18} /> Goleadores
                </button>
                <button className={`tab ${activeTab === 'teams' ? 'active' : ''}`} onClick={() => setActiveTab('teams')}>
                    <Users size={18} /> Equipos
                </button>
            </div>

            {/* Content Area */}
            {activeTab === 'standings' && (
                <div className="glass table-container animate-fade-in" style={{ padding: '0' }}>
                    <table>
                        <thead>
                            <tr>
                                <th style={{ width: '60px', textAlign: 'center' }}>#</th>
                                <th>Equipo</th>
                                <th>PJ</th>
                                <th>DG</th>
                                <th style={{ background: 'rgba(0, 242, 254, 0.1)', color: 'var(--primary)' }}>PTS</th>
                            </tr>
                        </thead>
                        <tbody>
                            {standings.map((team, index) => (
                                <tr key={team.id}>
                                    <td style={{ textAlign: 'center', fontWeight: 700 }}>{index + 1}</td>
                                    <td style={{ fontWeight: 600 }}>{team.name}</td>
                                    <td>{team.pj}</td>
                                    <td style={{ color: team.gd > 0 ? 'var(--success)' : team.gd < 0 ? 'var(--error)' : 'inherit' }}>{team.gd}</td>
                                    <td style={{ fontWeight: 800, color: 'var(--primary)' }}>{team.pts}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {activeTab === 'scorers' && (
                <div className="glass animate-fade-in" style={{ padding: '1.5rem' }}>
                    <h3 style={{ marginBottom: '1.5rem' }}>Tabla de Artilleros</h3>
                    {scorers.length === 0 ? <p>No se han registrado goles todavía.</p> : (
                        <div className="table-container">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Jugador</th>
                                        <th>Equipo</th>
                                        <th style={{ textAlign: 'center' }}>Goles</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {scorers.map((s, idx) => (
                                        <tr key={idx}>
                                            <td style={{ fontWeight: 600 }}>{s.name}</td>
                                            <td>{s.team}</td>
                                            <td style={{ textAlign: 'center', fontWeight: 800, fontSize: '1.2rem', color: 'var(--primary)' }}>{s.goals}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'teams' && (
                <div className="grid animate-fade-in" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
                    {teams.map(t => (
                        <div key={t.id} className="glass card hover-row" style={{ padding: '2rem', textAlign: 'center', cursor: 'pointer' }} onClick={() => navigate(`/${tournamentSlug}/${t.slug}/register-player`)}>
                            <div style={{ background: 'var(--glass)', width: '80px', height: '80px', borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', margin: '0 auto 1rem' }}>
                                <Trophy size={32} color="var(--primary)" />
                            </div>
                            <h3 style={{ marginBottom: '0.5rem' }}>{t.name}</h3>
                            <p style={{ fontSize: '0.85rem', opacity: 0.6 }}>Inscribirse en este Equipo</p>
                        </div>
                    ))}
                </div>
            )}

            {activeTab === 'fixtures' && (
                <div className="fixtures-grid animate-fade-in" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '1.5rem' }}>
                    {fixtures.length === 0 ? <p className="glass" style={{ padding: '2rem', textAlign: 'center' }}>No hay partidos programados.</p> : fixtures.map(match => (
                        <div key={match.id} className="glass match-card" style={{ padding: '1.5rem', borderLeft: match.status === 'jugado' ? '4px solid var(--primary)' : '4px solid var(--text-muted)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.8rem', opacity: 0.6 }}>
                                <span>Fecha {match.round}</span>
                                <span>{match.status === 'jugado' ? 'Finalizado' : 'Programado'}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '2rem' }}>
                                <span style={{ flex: 1, textAlign: 'right', fontWeight: 600 }}>{match.home}</span>
                                <div style={{ background: 'rgba(0,0,0,0.3)', padding: '0.4rem 1rem', borderRadius: '12px', fontSize: '1.2rem', fontWeight: 800 }}>
                                    {match.status === 'jugado' ? `${match.home_score} - ${match.away_score}` : 'VS'}
                                </div>
                                <span style={{ flex: 1, textAlign: 'left', fontWeight: 600 }}>{match.away}</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default TournamentLanding;
