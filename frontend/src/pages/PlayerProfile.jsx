import React, { useState, useEffect, useRef } from 'react';
import { toPng } from 'html-to-image';
import { Download, Lock, Save } from 'lucide-react';
import { playerAuthService, cardTemplateService } from '../services/api';
import { useNotification } from '../context/NotificationContext';
import PlayerCard from '../components/PlayerCard';

const PlayerProfile = () => {
    const { showNotification } = useNotification();
    const [profile, setProfile] = useState(null);
    const [template, setTemplate] = useState(null);
    const [loading, setLoading] = useState(true);
    const [downloading, setDownloading] = useState(false);
    const [mustChangePassword, setMustChangePassword] = useState(localStorage.getItem('mustChangePassword') === 'true');
    const [passwordForm, setPasswordForm] = useState({ current_password: '', new_password: '', confirm_password: '' });
    const [changingPassword, setChangingPassword] = useState(false);
    const cardRef = useRef(null);

    useEffect(() => {
        loadProfile();
    }, []);

    const loadProfile = async () => {
        try {
            const [profileRes, templateRes] = await Promise.all([
                playerAuthService.me(),
                cardTemplateService.get()
            ]);
            setProfile(profileRes.data);
            setTemplate(templateRes.data);
        } catch (err) {
            showNotification('Error al cargar tu perfil', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleDownload = async () => {
        if (!cardRef.current) return;
        setDownloading(true);
        try {
            const dataUrl = await toPng(cardRef.current, { pixelRatio: 2 });
            const link = document.createElement('a');
            link.download = 'mi_tarjeta.png';
            link.href = dataUrl;
            link.click();
        } catch (err) {
            showNotification('Error al generar la imagen', 'error');
        } finally {
            setDownloading(false);
        }
    };

    const handleChangePassword = async (e) => {
        e.preventDefault();
        if (passwordForm.new_password !== passwordForm.confirm_password) {
            showNotification('Las contraseñas nuevas no coinciden', 'error');
            return;
        }
        setChangingPassword(true);
        try {
            await playerAuthService.changePassword({
                current_password: passwordForm.current_password,
                new_password: passwordForm.new_password
            });
            localStorage.setItem('mustChangePassword', 'false');
            setMustChangePassword(false);
            showNotification('Contraseña actualizada con éxito', 'success');
        } catch (err) {
            showNotification(err.response?.data?.error || 'Error al cambiar la contraseña', 'error');
        } finally {
            setChangingPassword(false);
        }
    };

    if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Cargando tu perfil...</div>;
    if (!profile) return <div style={{ padding: '2rem', textAlign: 'center' }}>No se pudo cargar tu perfil.</div>;

    return (
        <div className="animate-fade-in">
            <h1>Mi Perfil</h1>
            <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>Aquí puedes ver tus datos y descargar tu tarjeta de jugador.</p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', alignItems: 'start' }}>
                <div className="glass" style={{ padding: '1.5rem' }}>
                    <h3 style={{ marginBottom: '1rem' }}>{profile.full_name}</h3>
                    <div style={{ display: 'grid', gap: '0.6rem', fontSize: '0.9rem' }}>
                        <div><strong>Equipo:</strong> {profile.team_name || '-'}</div>
                        <div><strong>Número:</strong> #{profile.uniform_number}</div>
                        <div><strong>Posición principal:</strong> {profile.primary_position_name || '-'}</div>
                        <div><strong>Posición secundaria:</strong> {profile.secondary_position_name || '-'}</div>
                        <div><strong>Posición terciaria:</strong> {profile.tertiary_position_name || '-'}</div>
                        <div><strong>Pie hábil:</strong> {profile.preferred_foot || '-'}</div>
                        <div><strong>Nacionalidad:</strong> {profile.nationality || '-'}</div>
                        <div><strong>Tipo de sangre:</strong> {profile.blood_type || '-'}</div>
                        <div><strong>EPS:</strong> {profile.eps || '-'}</div>
                        <div><strong>Teléfono:</strong> {profile.phone || '-'}</div>
                        <div><strong>Email:</strong> {profile.email || '-'}</div>
                        <hr style={{ border: 'none', borderTop: '1px solid var(--glass-border)', margin: '0.5rem 0' }} />
                        <div><strong>Partidos jugados:</strong> {profile.matches_played}</div>
                        <div><strong>Goles:</strong> {profile.goals_total}</div>
                        <div><strong>Tarjetas amarillas:</strong> {profile.yellow_cards}</div>
                        <div><strong>Tarjetas rojas:</strong> {profile.red_cards}</div>
                        <div><strong>Calificación promedio:</strong> {profile.avg_rating ?? '-'}</div>
                    </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem' }}>
                    {template && <PlayerCard ref={cardRef} template={template} data={profile} />}
                    <button className="btn btn-primary" style={{ width: '100%', maxWidth: '400px' }} onClick={handleDownload} disabled={downloading}>
                        <Download size={18} /> {downloading ? 'Generando...' : 'Descargar Mi Tarjeta'}
                    </button>
                </div>
            </div>

            {/* Blocking forced password change */}
            {mustChangePassword && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
                    background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)',
                    display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000
                }}>
                    <div className="glass" style={{ width: '90%', maxWidth: '420px', padding: '2rem' }}>
                        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                            <Lock size={32} color="var(--primary)" />
                            <h2 style={{ marginTop: '0.5rem' }}>Cambia tu contraseña</h2>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Por seguridad, debes definir una nueva contraseña antes de continuar.</p>
                        </div>
                        <form onSubmit={handleChangePassword}>
                            <div className="form-group">
                                <label className="label">Contraseña actual (tu documento)</label>
                                <input
                                    type="password" className="input" required
                                    value={passwordForm.current_password}
                                    onChange={(e) => setPasswordForm({ ...passwordForm, current_password: e.target.value })}
                                />
                            </div>
                            <div className="form-group">
                                <label className="label">Nueva contraseña</label>
                                <input
                                    type="password" className="input" required minLength={6}
                                    value={passwordForm.new_password}
                                    onChange={(e) => setPasswordForm({ ...passwordForm, new_password: e.target.value })}
                                />
                            </div>
                            <div className="form-group">
                                <label className="label">Confirmar nueva contraseña</label>
                                <input
                                    type="password" className="input" required minLength={6}
                                    value={passwordForm.confirm_password}
                                    onChange={(e) => setPasswordForm({ ...passwordForm, confirm_password: e.target.value })}
                                />
                            </div>
                            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }} disabled={changingPassword}>
                                <Save size={18} /> {changingPassword ? 'Guardando...' : 'Guardar Contraseña'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PlayerProfile;
