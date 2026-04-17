import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Zap, BarChart3, Users, ChevronRight, PlayCircle } from 'lucide-react';

const LandingPage = () => {
    const navigate = useNavigate();

    useEffect(() => {
        document.body.classList.add('theme-football');
        return () => document.body.classList.remove('theme-football');
    }, []);

    return (
        <div className="theme-football">
            <div className="landing-container animate-fade-in" style={{ paddingBottom: '5rem' }}>
            {/* Hero Section */}
            <section style={{ 
                display: 'grid', 
                gridTemplateColumns: '1fr 1fr', 
                gap: '4rem', 
                alignItems: 'center', 
                padding: '4rem 0',
                minHeight: '70vh'
            }}>
                <div>
                    <span style={{ 
                        background: 'rgba(34, 197, 94, 0.1)', 
                        color: 'var(--neon-green)', 
                        padding: '0.5rem 1rem', 
                        borderRadius: '2rem', 
                        fontSize: '0.875rem', 
                        fontWeight: 600,
                        border: '1px solid rgba(74, 222, 128, 0.2)',
                        marginBottom: '1.5rem',
                        display: 'inline-block'
                    }}>
                        LA EVOLUCIÓN DE LA GESTIÓN DEPORTIVA
                    </span>
                    <h1 style={{ fontSize: '4rem', lineHeight: 1.1, marginBottom: '1.5rem', background: 'linear-gradient(to right, #fff, #4ade80)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                        Toda tu liga en un solo lugar.
                    </h1>
                    <p style={{ fontSize: '1.25rem', color: 'var(--text-muted)', marginBottom: '2.5rem', maxWidth: '500px', lineHeight: 1.6 }}>
                        Una plataforma multi-equipo diseñada para simplificar el registro, las finanzas y el seguimiento de tus jugadores con tecnología de punta.
                    </p>
                    <div style={{ display: 'flex', gap: '1.5rem' }}>
                        <button className="btn btn-primary" style={{ padding: '1rem 2rem', fontSize: '1.125rem' }} onClick={() => navigate('/login')}>
                            Acceso Administrativo <ChevronRight size={20} />
                        </button>
                        <button className="btn btn-secondary" style={{ padding: '1rem 2rem', fontSize: '1.125rem' }}>
                            <PlayCircle size={20} /> Ver Demo
                        </button>
                    </div>
                </div>
                <div style={{ position: 'relative' }}>
                    <div style={{ 
                        position: 'absolute', 
                        top: '50%', 
                        left: '50%', 
                        transform: 'translate(-50%, -50%)', 
                        width: '120%', 
                        height: '120%', 
                        background: 'radial-gradient(circle, rgba(34, 197, 94, 0.15) 0%, transparent 70%)',
                        zIndex: -1
                    }}></div>
                    <img 
                        src="/hero.png" 
                        alt="Football Hero" 
                        className="glass"
                        style={{ 
                            width: '100%', 
                            borderRadius: '2rem', 
                            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                            border: '1px solid rgba(255, 255, 255, 0.1)'
                        }} 
                    />
                </div>
            </section>

            {/* Features Grid */}
            <section style={{ marginTop: '6rem' }}>
                <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
                    <h2 style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>Potencia tu Club</h2>
                    <p style={{ color: 'var(--text-muted)' }}>Herramientas profesionales para administradores deportivos de alto rendimiento.</p>
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '2rem' }}>
                    <div className="glass" style={{ padding: '2.5rem', transition: 'transform 0.3s ease' }}>
                        <div style={{ color: 'var(--neon-green)', marginBottom: '1.5rem' }}>
                            <ShieldCheck size={40} />
                        </div>
                        <h3 style={{ marginBottom: '1rem', background: 'none', WebkitTextFillColor: 'currentColor', color: '#fff' }}>Multi-Inquilino</h3>
                        <p style={{ color: 'var(--text-muted)', lineHeight: 1.6 }}>
                            Cada equipo vive en su propio universo digital con configuraciones, logos y bases de datos independientes.
                        </p>
                    </div>

                    <div className="glass" style={{ padding: '2.5rem' }}>
                        <div style={{ color: 'var(--neon-green)', marginBottom: '1.5rem' }}>
                            <Users size={40} />
                        </div>
                        <h3 style={{ marginBottom: '1rem', background: 'none', WebkitTextFillColor: 'currentColor', color: '#fff' }}>Gestión de Jugadores</h3>
                        <p style={{ color: 'var(--text-muted)', lineHeight: 1.6 }}>
                            Registro digital completo, asignación de posiciones y control de uniformes con numeración automatizada.
                        </p>
                    </div>

                    <div className="glass" style={{ padding: '2.5rem' }}>
                        <div style={{ color: 'var(--neon-green)', marginBottom: '1.5rem' }}>
                            <BarChart3 size={40} />
                        </div>
                        <h3 style={{ marginBottom: '1rem', background: 'none', WebkitTextFillColor: 'currentColor', color: '#fff' }}>Control Financiero</h3>
                        <p style={{ color: 'var(--text-muted)', lineHeight: 1.6 }}>
                            Seguimiento en tiempo real de pagos, inscripciones y uniformes. Proyecta tus ingresos con precisión.
                        </p>
                    </div>

                    <div className="glass" style={{ padding: '2.5rem' }}>
                        <div style={{ color: 'var(--neon-green)', marginBottom: '1.5rem' }}>
                            <Zap size={40} />
                        </div>
                        <h3 style={{ marginBottom: '1rem', background: 'none', WebkitTextFillColor: 'currentColor', color: '#fff' }}>Dashboard Pro</h3>
                        <p style={{ color: 'var(--text-muted)', lineHeight: 1.6 }}>
                            Analítica visual y auditoría de cambios para que nunca pierdas el hilo de lo que sucede en tu club.
                        </p>
                    </div>
                </div>
            </section>
        </div>
    </div>
    );
};

export default LandingPage;
