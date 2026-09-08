import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
    Trophy,
    ShieldCheck,
    Users,
    Sparkles,
    ChevronRight,
    LogIn,
    Sun,
    Moon,
    Camera,
    Calendar,
    CheckCircle2,
    BarChart3,
    Zap
} from 'lucide-react';
import { isSessionValid, getRoleDashboard } from '../utils/session';
import { updateFavicon } from '../utils/theme';

// Pilares mostrados en el navegador de arco semicircular de la landing.
const PILLARS = [
    {
        icon: Trophy,
        title: 'Gestión de Torneos & Ligas',
        desc: 'Control absoluto de competiciones con calendario automatizado, fases de grupos y llaves de eliminación directa.',
        items: [
            ['Sorteo con Bolillero Virtual:', 'Animación de balotas en vivo para grupos transparentes.'],
            ['Veedor Digital en Cancha:', 'Registro instantáneo de goles, amonestaciones y cronómetro.'],
            ['Tablas Automáticas:', 'Posiciones, goleadores, valla menos vencida y Fair Play al instante.'],
        ],
    },
    {
        icon: ShieldCheck,
        title: 'Administración de Equipos',
        desc: 'Organiza la nómina de tu club, gestiona los uniformes y mantén la tesorería al día sin complicaciones.',
        items: [
            ['Inscripción Inteligente:', 'Búsqueda por cédula para evitar duplicidad de jugadores.'],
            ['Control de Dorsales:', 'Numeración única por plantilla con verificación automática.'],
            ['Finanzas y Cuotas:', 'Seguimiento claro de pagos, inscripciones y uniformes por jugador.'],
        ],
    },
    {
        icon: Camera,
        title: 'Cromos Digitales con IA',
        desc: 'Convierte a cada jugador en una estrella con cromos y carnets digitales de alta calidad visual.',
        items: [
            ['Recorte con Inteligencia Artificial:', 'Eliminación automática del fondo de la foto en 1 clic.'],
            ['Captura Directa:', 'Toma fotos desde la cámara del celular o sube archivos desde la galería.'],
            ['Editor de Plantillas & Exportación:', 'Personaliza escudos, colores y descarga en lote.'],
        ],
    },
    {
        icon: Users,
        title: 'Comunidades & Encuentros',
        desc: 'El espacio perfecto para coordinar partidos amistosos, convocatorias y vida deportiva comunitaria.',
        items: [
            ['Organización de Partidos:', 'Publica encuentros amistosos con fecha, cancha y cupos.'],
            ['Encuestas y Votaciones:', 'Consulta horarios, indumentaria o confirmaciones en tiempo real.'],
            ['Muro de Avisos:', 'Mantén informados a los miembros del club o barrio.'],
        ],
    },
];

// Geometría del arco: un nodo por pilar, distribuido sobre el semicírculo
// `M 60 560 A 440 440 0 0 1 940 560` (viewBox 1000x575) del SVG de abajo.
// CX/CY/RX/RY son ese mismo centro y radio expresados en % del contenedor.
const ARC_DELTA = 51;
const ARC_CX = 50;
const ARC_CY = 97.391;
const ARC_RX = 44;
const ARC_RY = 76.522;

function pillarOffset(index, active, total) {
    const half = total / 2;
    let diff = index - active;
    while (diff > half) diff -= total;
    while (diff <= -half) diff += total;
    return diff;
}

function pillarNodePosition(offset) {
    const angle = 90 - (offset - 0.5) * ARC_DELTA;
    const rad = (angle * Math.PI) / 180;
    return {
        left: `${ARC_CX + ARC_RX * Math.cos(rad)}%`,
        top: `${ARC_CY - ARC_RY * Math.sin(rad)}%`,
    };
}

const LandingPage = () => {
    const navigate = useNavigate();
    const [isDarkTheme, setIsDarkTheme] = useState(() => document.body.classList.contains('theme-dark'));
    const isLoggedIn = isSessionValid();
    const role = localStorage.getItem('adminRole');

    // Pilar activo en el arco (mueve los nodos al instante) vs. pilar mostrado
    // en el panel (se actualiza tras el fade-out, para que el cambio de texto
    // no se sienta abrupto mientras el arco todavía está girando).
    const [activePillar, setActivePillar] = useState(0);
    const [displayedPillar, setDisplayedPillar] = useState(0);
    const [panelFading, setPanelFading] = useState(false);
    const panelFadeTimeout = useRef(null);

    useEffect(() => () => {
        if (panelFadeTimeout.current) clearTimeout(panelFadeTimeout.current);
    }, []);

    const selectPillar = (index) => {
        if (index === activePillar) return;
        setActivePillar(index);
        if (panelFadeTimeout.current) clearTimeout(panelFadeTimeout.current);
        setPanelFading(true);
        panelFadeTimeout.current = setTimeout(() => {
            setDisplayedPillar(index);
            setPanelFading(false);
        }, 150);
    };

    const goToPillar = (index) => {
        selectPillar(index);
        scrollToSection('pilares');
    };

    const toggleTheme = () => {
        const next = !isDarkTheme;
        setIsDarkTheme(next);
        document.body.classList.toggle('theme-dark', next);
        localStorage.setItem('uiTheme', next ? 'dark' : 'light');
        updateFavicon();
    };

    const scrollToSection = (id) => {
        const el = document.getElementById(id);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth' });
        }
    };

    return (
        <div className="landing-page-container" style={{ padding: '20px', margin: '0 auto', maxWidth: '1360px', boxSizing: 'border-box' }}>
            <div className="landing-wrapper animate-fade-in">
                {/* Top Navigation Bar */}
                <header className="landing-header">
                <div className="landing-header-inner">
                    <Link to="/" className="landing-brand">
                        <img 
                            src="/logo-placeholder.png" 
                            alt="Logo ElOncePro" 
                            style={{
                                width: '44px',
                                height: '44px',
                                objectFit: 'contain',
                                filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.15))'
                            }}
                            onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                const fallback = e.currentTarget.nextElementSibling;
                                if (fallback) fallback.style.display = 'flex';
                            }}
                        />
                        <div style={{
                            width: '42px',
                            height: '42px',
                            borderRadius: '12px',
                            background: 'linear-gradient(135deg, var(--secondary), var(--primary))',
                            display: 'none',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#ffffff',
                            boxShadow: '0 4px 12px var(--btn-glow)'
                        }}>
                            <Trophy size={24} />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <span>ElOnce</span>
                            <span className="landing-brand-badge">PRO</span>
                        </div>
                    </Link>

                    <nav className="landing-nav-menu">
                        <a href="#pilares" onClick={(e) => { e.preventDefault(); goToPillar(0); }} className="landing-nav-item">
                            Torneos
                        </a>
                        <a href="#pilares" onClick={(e) => { e.preventDefault(); goToPillar(1); }} className="landing-nav-item">
                            Equipos
                        </a>
                        <a href="#pilares" onClick={(e) => { e.preventDefault(); goToPillar(2); }} className="landing-nav-item">
                            Cromos & IA
                        </a>
                        <a href="#pilares" onClick={(e) => { e.preventDefault(); goToPillar(3); }} className="landing-nav-item">
                            Comunidades
                        </a>
                    </nav>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <button
                            onClick={toggleTheme}
                            className="theme-toggle"
                            title={isDarkTheme ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
                            aria-label="Alternar tema"
                        >
                            {isDarkTheme ? <Sun size={18} /> : <Moon size={18} />}
                        </button>
                        <button 
                            className="btn btn-primary" 
                            style={{ padding: '0.65rem 1.25rem', fontSize: '0.95rem' }} 
                            onClick={() => navigate(isLoggedIn ? getRoleDashboard(role) : '/login')}
                        >
                            <LogIn size={18} /> {isLoggedIn ? 'Mi Panel' : 'Ingresar'}
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="landing-content-container">
                {/* Hero Section */}
                <section className="landing-hero">
                    <div>
                        <div className="landing-badge">
                            <Sparkles size={15} /> Plataforma Integral Deportiva
                        </div>
                        <h1 className="landing-hero-title">
                            Toda tu liga en un solo lugar con <span>ElOncePro</span>
                        </h1>
                        <p className="landing-hero-desc">
                            La suite digital más completa para torneos, clubes y comunidades de fútbol. 
                            Automatiza planillajes en vivo, administración de nóminas con validación de cédulas, sorteos interactivos y creación de cromos oficiales con Inteligencia Artificial.
                        </p>
                        <div className="landing-hero-actions">
                            <button 
                                className="btn btn-primary" 
                                style={{ padding: '0.9rem 1.8rem', fontSize: '1.05rem' }} 
                                onClick={() => navigate(isLoggedIn ? getRoleDashboard(role) : '/login')}
                            >
                                {isLoggedIn ? 'Mi Panel Administrativo' : 'Acceso a la Plataforma'} <ChevronRight size={20} />
                            </button>
                            <button 
                                className="btn btn-secondary" 
                                style={{ padding: '0.9rem 1.8rem', fontSize: '1.05rem' }} 
                                onClick={() => navigate(isLoggedIn ? '/communities' : '/login')}
                            >
                                <Users size={20} /> {isLoggedIn ? 'Ver Comunidades' : 'Ingresar a Comunidades'}
                            </button>
                        </div>
                    </div>

                    <div className="landing-hero-media">
                        <div className="landing-hero-glow"></div>
                        <img 
                            src="/hero.png" 
                            alt="ElOncePro Plataforma Deportiva" 
                            className="landing-hero-img" 
                        />
                        <div className="landing-hero-tag glass">
                            <Zap size={18} color="var(--primary)" />
                            <span>Planillaje Digital en Vivo</span>
                        </div>
                    </div>
                </section>

                {/* Metrics / Highlights Strip */}
                <section className="landing-metrics-grid">
                    <div className="glass landing-metric-card">
                        <div className="landing-metric-value">100%</div>
                        <div className="landing-metric-label">Digital y Sin Papel</div>
                    </div>
                    <div className="glass landing-metric-card">
                        <div className="landing-metric-value">IA Pro</div>
                        <div className="landing-metric-label">Recorte Automático de Fotos</div>
                    </div>
                    <div className="glass landing-metric-card">
                        <div className="landing-metric-value">Multi-Rol</div>
                        <div className="landing-metric-label">Admin, Veedor y Club</div>
                    </div>
                    <div className="glass landing-metric-card">
                        <div className="landing-metric-value">En Vivo</div>
                        <div className="landing-metric-label">Sorteos y Estadísticas</div>
                    </div>
                </section>

                {/* Pillars Section Header */}
                <div className="landing-section-title">
                    <h2>Potencia Cada Nivel de Tu Organización</h2>
                    <p>
                        Herramientas profesionales diseñadas para directores de torneos, administradores de clubes, veedores arbitrales y jugadores.
                    </p>
                </div>

                {/* Pillars Arc Navigator */}
                <section className="landing-pillars-arc-shell" id="pilares">
                    <div className="landing-pillars-arc-visual">
                        <svg className="landing-arc-svg" viewBox="0 0 1000 575" preserveAspectRatio="xMidYMin meet">
                            <defs>
                                <linearGradient id="landingArcGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                                    <stop offset="0%" stopColor="var(--primary)" stopOpacity="0" />
                                    <stop offset="50%" stopColor="var(--primary)" stopOpacity="1" />
                                    <stop offset="100%" stopColor="var(--secondary)" stopOpacity="0" />
                                </linearGradient>
                            </defs>
                            <path className="landing-arc-track" d="M 60 560 A 440 440 0 0 1 940 560" />
                            <path className="landing-arc-glow" d="M 60 560 A 440 440 0 0 1 940 560" />
                            <path className="landing-arc-progress" d="M 60 560 A 440 440 0 0 1 940 560" />
                        </svg>
                        {PILLARS.map((pillar, index) => {
                            const offset = pillarOffset(index, activePillar, PILLARS.length);
                            const pos = pillarNodePosition(offset);
                            const isActive = index === activePillar;
                            return (
                                <button
                                    key={pillar.title}
                                    type="button"
                                    role="tab"
                                    aria-selected={isActive}
                                    aria-label={`Ver ${pillar.title}`}
                                    className={`landing-pillar-node${isActive ? ' active' : ''}`}
                                    style={{ left: pos.left, top: pos.top }}
                                    onClick={() => selectPillar(index)}
                                >
                                    <span className="landing-node-label">Pilar {index + 1}</span>
                                    <span className="landing-node-circle">{index + 1}</span>
                                </button>
                            );
                        })}
                    </div>

                    {(() => {
                        const pillar = PILLARS[displayedPillar];
                        const Icon = pillar.icon;
                        return (
                            <div className="glass landing-pillars-panel">
                                <div className={`landing-panel-body${panelFading ? ' fading' : ''}`}>
                                    <div className="landing-pillar-icon">
                                        <Icon size={28} />
                                    </div>
                                    <h3 className="landing-pillar-title">{pillar.title}</h3>
                                    <p className="landing-pillar-desc">{pillar.desc}</p>
                                    <ul className="landing-pillar-list">
                                        {pillar.items.map(([lead, rest]) => (
                                            <li className="landing-pillar-item" key={lead}>
                                                <CheckCircle2 size={18} />
                                                <span><strong>{lead}</strong> {rest}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        );
                    })()}
                </section>

                {/* Call to Action Banner */}
                <section className="landing-cta">
                    <h2>Únete a la Evolución del Deporte</h2>
                    <p>
                        Moderniza la gestión de tus torneos y equipos con <strong>ElOncePro</strong>. 
                        Ahorra tiempo, profesionaliza la experiencia de tus jugadores y lleva tu organización al siguiente nivel.
                    </p>
                    <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                        <button 
                            className="btn btn-primary" 
                            style={{ padding: '1rem 2.2rem', fontSize: '1.1rem' }} 
                            onClick={() => navigate(isLoggedIn ? getRoleDashboard(role) : '/login')}
                        >
                            {isLoggedIn ? 'Ir a mi Panel' : 'Ingresar a la Plataforma'} <ChevronRight size={20} />
                        </button>
                        <button 
                            className="btn btn-secondary" 
                            style={{ padding: '1rem 2.2rem', fontSize: '1.1rem' }} 
                            onClick={() => navigate(isLoggedIn ? '/communities' : '/login')}
                        >
                            <Users size={20} /> {isLoggedIn ? 'Explorar Comunidades' : 'Ingresar a Comunidades'}
                        </button>
                    </div>
                </section>
            </main>

            {/* Footer */}
            <footer className="landing-footer">
                <div className="landing-footer-inner">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <img 
                            src="/logo-placeholder.png" 
                            alt="Logo ElOncePro" 
                            style={{
                                width: '32px',
                                height: '32px',
                                objectFit: 'contain'
                            }}
                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        />
                        <span style={{ fontWeight: 800, fontSize: '1.15rem' }}>ElOncePro</span>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>— Gestión Deportiva Integral</span>
                    </div>

                    <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.9rem' }}>
                        <a href="#pilares" onClick={(e) => { e.preventDefault(); goToPillar(0); }} className="landing-nav-item">Torneos</a>
                        <a href="#pilares" onClick={(e) => { e.preventDefault(); goToPillar(1); }} className="landing-nav-item">Equipos</a>
                        <a href="#pilares" onClick={(e) => { e.preventDefault(); goToPillar(2); }} className="landing-nav-item">Cromos & IA</a>
                        <a href="#pilares" onClick={(e) => { e.preventDefault(); goToPillar(3); }} className="landing-nav-item">Comunidades</a>
                        <Link to={isLoggedIn ? getRoleDashboard(role) : "/login"} className="landing-nav-item">{isLoggedIn ? "Mi Panel" : "Iniciar Sesión"}</Link>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)', fontSize: '0.85rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                        <span>&copy; {new Date().getFullYear()} TuOnce-pro. Todos los derechos reservados. Desarrollado por</span>
                        <img 
                            src="/devjlopez-logo.png" 
                            alt="DevJLopez" 
                            style={{ 
                                height: '24px', 
                                objectFit: 'contain', 
                                verticalAlign: 'middle',
                                filter: isDarkTheme ? 'brightness(1.5) drop-shadow(0 0 1px rgba(255,255,255,0.4))' : 'none'
                            }} 
                        />
                    </div>
                </div>
            </footer>
        </div>
    </div>
    );
};

export default LandingPage;
