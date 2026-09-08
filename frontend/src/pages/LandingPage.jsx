import React, { useState } from 'react';
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

const LandingPage = () => {
    const navigate = useNavigate();
    const [isDarkTheme, setIsDarkTheme] = useState(() => document.body.classList.contains('theme-dark'));
    const isLoggedIn = isSessionValid();
    const role = localStorage.getItem('adminRole');

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
                        <a href="#torneos" onClick={(e) => { e.preventDefault(); scrollToSection('torneos'); }} className="landing-nav-item">
                            Torneos
                        </a>
                        <a href="#equipos" onClick={(e) => { e.preventDefault(); scrollToSection('equipos'); }} className="landing-nav-item">
                            Equipos
                        </a>
                        <a href="#cromos" onClick={(e) => { e.preventDefault(); scrollToSection('cromos'); }} className="landing-nav-item">
                            Cromos & IA
                        </a>
                        <a href="#comunidades" onClick={(e) => { e.preventDefault(); scrollToSection('comunidades'); }} className="landing-nav-item">
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

                {/* 4 Pillars Grid */}
                <div className="landing-pillars-grid">
                    {/* Pillar 1: Torneos & Ligas */}
                    <div className="glass landing-pillar-card" id="torneos">
                        <div className="landing-pillar-icon">
                            <Trophy size={28} />
                        </div>
                        <h3 className="landing-pillar-title">Gestión de Torneos & Ligas</h3>
                        <p className="landing-pillar-desc">
                            Control absoluto de competiciones con calendario automatizado, fases de grupos y llaves de eliminación directa.
                        </p>
                        <ul className="landing-pillar-list">
                            <li className="landing-pillar-item">
                                <CheckCircle2 size={18} />
                                <span><strong>Sorteo con Bolillero Virtual:</strong> Animación de balotas en vivo para grupos transparentes.</span>
                            </li>
                            <li className="landing-pillar-item">
                                <CheckCircle2 size={18} />
                                <span><strong>Veedor Digital en Cancha:</strong> Registro instantáneo de goles, amonestaciones y cronómetro.</span>
                            </li>
                            <li className="landing-pillar-item">
                                <CheckCircle2 size={18} />
                                <span><strong>Tablas Automáticas:</strong> Posiciones, goleadores, valla menos vencida y Fair Play al instante.</span>
                            </li>
                        </ul>
                    </div>

                    {/* Pillar 2: Equipos & Jugadores */}
                    <div className="glass landing-pillar-card" id="equipos">
                        <div className="landing-pillar-icon">
                            <ShieldCheck size={28} />
                        </div>
                        <h3 className="landing-pillar-title">Administración de Equipos</h3>
                        <p className="landing-pillar-desc">
                            Organiza la nómina de tu club, gestiona los uniformes y mantén la tesorería al día sin complicaciones.
                        </p>
                        <ul className="landing-pillar-list">
                            <li className="landing-pillar-item">
                                <CheckCircle2 size={18} />
                                <span><strong>Inscripción Inteligente:</strong> Búsqueda por cédula para evitar duplicidad de jugadores.</span>
                            </li>
                            <li className="landing-pillar-item">
                                <CheckCircle2 size={18} />
                                <span><strong>Control de Dorsales:</strong> Numeración única por plantilla con verificación automática.</span>
                            </li>
                            <li className="landing-pillar-item">
                                <CheckCircle2 size={18} />
                                <span><strong>Finanzas y Cuotas:</strong> Seguimiento claro de pagos, inscripciones y uniformes por jugador.</span>
                            </li>
                        </ul>
                    </div>

                    {/* Pillar 3: Cromos & IA */}
                    <div className="glass landing-pillar-card" id="cromos">
                        <div className="landing-pillar-icon">
                            <Camera size={28} />
                        </div>
                        <h3 className="landing-pillar-title">Cromos Digitales con IA</h3>
                        <p className="landing-pillar-desc">
                            Convierte a cada jugador en una estrella con cromos y carnets digitales de alta calidad visual.
                        </p>
                        <ul className="landing-pillar-list">
                            <li className="landing-pillar-item">
                                <CheckCircle2 size={18} />
                                <span><strong>Recorte con Inteligencia Artificial:</strong> Eliminación automática del fondo de la foto en 1 clic.</span>
                            </li>
                            <li className="landing-pillar-item">
                                <CheckCircle2 size={18} />
                                <span><strong>Captura Directa:</strong> Toma fotos desde la cámara del celular o sube archivos desde la galería.</span>
                            </li>
                            <li className="landing-pillar-item">
                                <CheckCircle2 size={18} />
                                <span><strong>Editor de Plantillas & Exportación:</strong> Personaliza escudos, colores y descarga en lote.</span>
                            </li>
                        </ul>
                    </div>

                    {/* Pillar 4: Comunidades Deportivas */}
                    <div className="glass landing-pillar-card" id="comunidades">
                        <div className="landing-pillar-icon">
                            <Users size={28} />
                        </div>
                        <h3 className="landing-pillar-title">Comunidades & Encuentros</h3>
                        <p className="landing-pillar-desc">
                            El espacio perfecto para coordinar partidos amistosos, convocatorias y vida deportiva comunitaria.
                        </p>
                        <ul className="landing-pillar-list">
                            <li className="landing-pillar-item">
                                <CheckCircle2 size={18} />
                                <span><strong>Organización de Partidos:</strong> Publica encuentros amistosos con fecha, cancha y cupos.</span>
                            </li>
                            <li className="landing-pillar-item">
                                <CheckCircle2 size={18} />
                                <span><strong>Encuestas y Votaciones:</strong> Consulta horarios, indumentaria o confirmaciones en tiempo real.</span>
                            </li>
                            <li className="landing-pillar-item">
                                <CheckCircle2 size={18} />
                                <span><strong>Muro de Avisos:</strong> Mantén informados a los miembros del club o barrio.</span>
                            </li>
                        </ul>
                    </div>
                </div>

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
                        <a href="#torneos" onClick={(e) => { e.preventDefault(); scrollToSection('torneos'); }} className="landing-nav-item">Torneos</a>
                        <a href="#equipos" onClick={(e) => { e.preventDefault(); scrollToSection('equipos'); }} className="landing-nav-item">Equipos</a>
                        <a href="#cromos" onClick={(e) => { e.preventDefault(); scrollToSection('cromos'); }} className="landing-nav-item">Cromos & IA</a>
                        <a href="#comunidades" onClick={(e) => { e.preventDefault(); scrollToSection('comunidades'); }} className="landing-nav-item">Comunidades</a>
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
