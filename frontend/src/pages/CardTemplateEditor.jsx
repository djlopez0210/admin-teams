import React, { useState, useEffect, useRef } from 'react';
import { Trash2, Save, Upload, Image as ImageIcon, Type, Shield } from 'lucide-react';
import { cardTemplateService, settingsService, adminService } from '../services/api';
import { useNotification } from '../context/NotificationContext';
import { CARD_FIELDS, getFieldMeta, formatFieldValue, createDefaultElement, createDefaultCustomTextElement } from '../utils/cardFields';

// Placeholder data so the superadmin can design the layout without needing
// a real player loaded (the template is global, not tied to any one team).
const INITIAL_SAMPLE_DATA = {
    full_name: 'Juan Pérez', first_name: 'Juan', last_name: 'Pérez',
    uniform_number: 10, document_number: '123456789',
    primary_position_name: 'Delantero', secondary_position_name: 'Extremo Izquierdo', tertiary_position_name: 'Mediocampista',
    preferred_foot: 'derecha', blood_type: 'O+', eps: 'Sura', nationality: 'Colombiana',
    birth_date: '2000-05-10', phone: '3001234567', email: 'juan@example.com', address: 'Calle 123',
    team_name: 'Alianza F.C.', team_logo: '/logo-placeholder.png',
    matches_played: 12, goals_total: 8, yellow_cards: 2, red_cards: 0, avg_rating: 8.4,
    photo: null, photo_cutout: null,
};

const CardTemplateEditor = () => {
    const { showNotification } = useNotification();
    const [template, setTemplate] = useState(null);
    const [selectedId, setSelectedId] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [uploadingBg, setUploadingBg] = useState(false);
    const [sampleData, setSampleData] = useState(INITIAL_SAMPLE_DATA);
    const [teamsList, setTeamsList] = useState([]);
    const [selectedTeamId, setSelectedTeamId] = useState(null);
    const canvasRef = useRef(null);
    const resizingRef = useRef(null);
    const draggingRef = useRef(null);
    const [guides, setGuides] = useState({ v: null, h: null });
    const SNAP_THRESHOLD = 6;

    useEffect(() => {
        loadTemplate();
    }, []);

    const loadTemplate = async () => {
        try {
            const [res, teamsRes, settingsRes] = await Promise.allSettled([
                cardTemplateService.get(),
                adminService.getTeams(),
                settingsService.get()
            ]);

            if (res.status === 'fulfilled') {
                setTemplate(res.value.data);
            }

            let teams = [];
            if (teamsRes.status === 'fulfilled' && Array.isArray(teamsRes.value.data)) {
                teams = teamsRes.value.data;
                setTeamsList(teams);
            }

            const activeTeamId = localStorage.getItem('adminTeamId') || (teams.length > 0 ? teams[0].id : null);
            if (activeTeamId) {
                setSelectedTeamId(activeTeamId);
                const foundTeam = teams.find(t => String(t.id) === String(activeTeamId));
                const settingsData = settingsRes.status === 'fulfilled' ? settingsRes.value.data : null;

                const resolvedName = foundTeam?.name || settingsData?.team_name || 'Alianza F.C.';
                const resolvedLogo = settingsData?.team_logo_url || foundTeam?.logo_url || '/logo-placeholder.png';

                setSampleData(prev => ({
                    ...prev,
                    team_name: resolvedName,
                    team_logo: resolvedLogo
                }));
            }
        } catch (err) {
            showNotification('Error al cargar la plantilla', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleSelectPreviewTeam = (teamId) => {
        setSelectedTeamId(teamId);
        const team = teamsList.find(t => String(t.id) === String(teamId));
        if (team) {
            setSampleData(prev => ({
                ...prev,
                team_name: team.name,
                team_logo: team.logo_url || '/logo-placeholder.png'
            }));
        }
    };

    const selectedElement = template?.elements.find(el => el.id === selectedId) || null;

    const updateElement = (id, patch) => {
        setTemplate(t => ({
            ...t,
            elements: t.elements.map(el => el.id === id ? { ...el, ...patch } : el)
        }));
    };

    const updateElementStyle = (id, stylePatch) => {
        setTemplate(t => ({
            ...t,
            elements: t.elements.map(el => el.id === id ? { ...el, style: { ...el.style, ...stylePatch } } : el)
        }));
    };

    const addElement = (fieldId) => {
        const el = createDefaultElement(fieldId);
        setTemplate(t => ({ ...t, elements: [...t.elements, el] }));
        setSelectedId(el.id);
    };

    const addCustomTextElement = () => {
        const el = createDefaultCustomTextElement('NUEVO TÍTULO');
        setTemplate(t => ({ ...t, elements: [...t.elements, el] }));
        setSelectedId(el.id);
    };

    const removeElement = (id) => {
        setTemplate(t => ({ ...t, elements: t.elements.filter(el => el.id !== id) }));
        setSelectedId(null);
    };

    const handleBackgroundUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setUploadingBg(true);
        try {
            const res = await settingsService.uploadFile(file);
            setTemplate(t => ({ ...t, background_url: res.data.url }));
        } catch (err) {
            showNotification('Error al subir la imagen de fondo', 'error');
        } finally {
            setUploadingBg(false);
        }
    };

    const startResize = (e, el) => {
        e.stopPropagation();
        e.preventDefault();
        resizingRef.current = { id: el.id, startX: e.clientX, startY: e.clientY, startW: el.width, startH: el.height };
        window.addEventListener('mousemove', onResizeMove);
        window.addEventListener('mouseup', onResizeEnd);
    };

    const onResizeMove = (e) => {
        const r = resizingRef.current;
        if (!r) return;
        const newW = Math.max(20, r.startW + (e.clientX - r.startX));
        const newH = Math.max(20, r.startH + (e.clientY - r.startY));
        updateElement(r.id, { width: newW, height: newH });
    };

    const onResizeEnd = () => {
        resizingRef.current = null;
        window.removeEventListener('mousemove', onResizeMove);
        window.removeEventListener('mouseup', onResizeEnd);
    };

    // Snaps a candidate position to the canvas center or to other elements' edges/centers,
    // so fields can be lined up precisely instead of relying on freehand dragging.
    const computeSnap = (id, rawX, rawY, width, height) => {
        const vTargets = [template.canvas_width / 2];
        const hTargets = [template.canvas_height / 2];
        template.elements.forEach(other => {
            if (other.id === id) return;
            vTargets.push(other.x, other.x + other.width / 2, other.x + other.width);
            hTargets.push(other.y, other.y + other.height / 2, other.y + other.height);
        });

        let x = rawX, y = rawY, guideV = null, guideH = null;
        const xCandidates = [{ pos: rawX, offset: 0 }, { pos: rawX + width / 2, offset: width / 2 }, { pos: rawX + width, offset: width }];
        outerV: for (const target of vTargets) {
            for (const c of xCandidates) {
                if (Math.abs(c.pos - target) < SNAP_THRESHOLD) {
                    x = target - c.offset;
                    guideV = target;
                    break outerV;
                }
            }
        }
        const yCandidates = [{ pos: rawY, offset: 0 }, { pos: rawY + height / 2, offset: height / 2 }, { pos: rawY + height, offset: height }];
        outerH: for (const target of hTargets) {
            for (const c of yCandidates) {
                if (Math.abs(c.pos - target) < SNAP_THRESHOLD) {
                    y = target - c.offset;
                    guideH = target;
                    break outerH;
                }
            }
        }
        return { x, y, guideV, guideH };
    };

    const startDrag = (e, el) => {
        e.stopPropagation();
        e.preventDefault();
        setSelectedId(el.id);
        draggingRef.current = { id: el.id, startX: e.clientX, startY: e.clientY, origX: el.x, origY: el.y, width: el.width, height: el.height };
        window.addEventListener('mousemove', onDragMove);
        window.addEventListener('mouseup', onDragEnd);
    };

    const onDragMove = (e) => {
        const d = draggingRef.current;
        if (!d) return;
        const rawX = d.origX + (e.clientX - d.startX);
        const rawY = d.origY + (e.clientY - d.startY);
        const { x, y, guideV, guideH } = computeSnap(d.id, rawX, rawY, d.width, d.height);
        updateElement(d.id, { x, y });
        setGuides({ v: guideV, h: guideH });
    };

    const onDragEnd = () => {
        draggingRef.current = null;
        setGuides({ v: null, h: null });
        window.removeEventListener('mousemove', onDragMove);
        window.removeEventListener('mouseup', onDragEnd);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await cardTemplateService.update({
                elements: template.elements,
                canvas_width: template.canvas_width,
                canvas_height: template.canvas_height,
                background_url: template.background_url,
            });
            showNotification('Plantilla guardada con éxito', 'success');
        } catch (err) {
            showNotification('Error al guardar la plantilla', 'error');
        } finally {
            setSaving(false);
        }
    };

    if (loading || !template) return <div style={{ padding: '2rem', textAlign: 'center' }}>Cargando editor...</div>;

    return (
        <div className="animate-fade-in">
            <div className="flex-responsive" style={{ marginBottom: '1.5rem', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h1>Diseñador de Tarjeta</h1>
                    <p style={{ color: 'var(--text-muted)' }}>Arrastra los campos sobre la tarjeta para diseñar el layout global. Los cambios aplican a todas las tarjetas del sistema.</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                    {teamsList.length > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(255,255,255,0.05)', padding: '0.4rem 0.75rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
                            <Shield size={16} color="var(--primary)" />
                            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Probar con equipo:</span>
                            <select
                                className="input"
                                style={{ width: 'auto', padding: '0.25rem 0.5rem', fontSize: '0.85rem' }}
                                value={selectedTeamId || ''}
                                onChange={(e) => handleSelectPreviewTeam(e.target.value)}
                            >
                                {teamsList.map(t => (
                                    <option key={t.id} value={t.id}>{t.name}</option>
                                ))}
                            </select>
                        </div>
                    )}
                    <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Save size={18} /> {saving ? 'Guardando...' : 'Guardar Plantilla'}
                    </button>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr 280px', gap: '1.5rem', alignItems: 'flex-start' }}>
                {/* Palette */}
                <div className="glass" style={{ padding: '1rem', maxHeight: '80vh', overflowY: 'auto' }}>
                    {/* Crear Texto Libre / Título */}
                    <div style={{ marginBottom: '1.25rem', paddingBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                        <h4 style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--primary)' }}>
                            <Type size={16} /> Textos y Títulos
                        </h4>
                        <button
                            className="btn btn-primary"
                            style={{ width: '100%', fontSize: '0.85rem', justifyContent: 'center', padding: '0.6rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}
                            onClick={addCustomTextElement}
                        >
                            <Type size={16} /> + Crear Texto / Título
                        </button>
                        <small style={{ color: 'var(--text-muted)', display: 'block', marginTop: '0.35rem', fontSize: '0.75rem' }}>
                            Agrega títulos fijos, nombres de torneo o categorías.
                        </small>
                    </div>

                    <h4 style={{ marginBottom: '0.75rem' }}>Campos del Jugador</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {CARD_FIELDS.map(f => (
                            <button
                                key={f.id}
                                className="btn btn-secondary"
                                style={{ fontSize: '0.8rem', justifyContent: 'flex-start', padding: '0.5rem 0.75rem' }}
                                onClick={() => addElement(f.id)}
                            >
                                + {f.label}
                            </button>
                        ))}
                    </div>

                    <h4 style={{ margin: '1.5rem 0 1rem' }}>Fondo</h4>
                    <label className="btn btn-secondary" style={{ cursor: 'pointer', width: '100%', display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}>
                        <Upload size={16} /> {uploadingBg ? 'Subiendo...' : 'Subir imagen'}
                        <input type="file" hidden accept="image/*" onChange={handleBackgroundUpload} disabled={uploadingBg} />
                    </label>
                    {template.background_url && (
                        <button
                            className="btn btn-secondary"
                            style={{ fontSize: '0.75rem', marginTop: '0.5rem', width: '100%' }}
                            onClick={() => setTemplate(t => ({ ...t, background_url: null }))}
                        >
                            Quitar fondo
                        </button>
                    )}

                    <h4 style={{ margin: '1.5rem 0 1rem' }}>Tamaño del Canvas</h4>
                    <div className="form-group">
                        <label className="label">Ancho (px)</label>
                        <input type="number" className="input" value={template.canvas_width} onChange={(e) => setTemplate(t => ({ ...t, canvas_width: Number(e.target.value) }))} />
                    </div>
                    <div className="form-group">
                        <label className="label">Alto (px)</label>
                        <input type="number" className="input" value={template.canvas_height} onChange={(e) => setTemplate(t => ({ ...t, canvas_height: Number(e.target.value) }))} />
                    </div>
                </div>

                {/* Canvas */}
                <div style={{ display: 'flex', justifyContent: 'center', padding: '1rem', overflow: 'auto' }}>
                    <div
                        ref={canvasRef}
                        onClick={() => setSelectedId(null)}
                        style={{
                            position: 'relative',
                            width: template.canvas_width,
                            height: template.canvas_height,
                            backgroundColor: '#0f172a',
                            backgroundImage: template.background_url ? `url(${template.background_url})` : undefined,
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                            borderRadius: 16,
                            boxShadow: '0 10px 40px rgba(0,0,0,0.4)',
                            flexShrink: 0,
                        }}
                    >
                        {guides.v !== null && (
                            <div style={{ position: 'absolute', left: guides.v, top: 0, width: 0, height: template.canvas_height, borderLeft: '1px dashed #ff4d6d', zIndex: 999, pointerEvents: 'none' }} />
                        )}
                        {guides.h !== null && (
                            <div style={{ position: 'absolute', top: guides.h, left: 0, height: 0, width: template.canvas_width, borderTop: '1px dashed #ff4d6d', zIndex: 999, pointerEvents: 'none' }} />
                        )}
                        {template.elements.map(el => {
                            const fieldType = el.type || getFieldMeta(el.field)?.type || 'text';
                            const style = el.style || {};
                            const isSelected = el.id === selectedId;
                            return (
                                <div
                                    key={el.id}
                                    onMouseDown={(e) => startDrag(e, el)}
                                    onClick={(e) => e.stopPropagation()}
                                    style={{
                                        position: 'absolute', left: el.x, top: el.y, width: el.width, height: el.height,
                                        cursor: 'move', outline: isSelected ? '2px dashed var(--primary)' : 'none',
                                        zIndex: style.zIndex || 1,
                                    }}
                                >
                                    {fieldType === 'photo' || fieldType === 'image' ? (
                                        <div style={{
                                            width: '100%', height: '100%', borderRadius: style.borderRadius || 0,
                                            background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            border: isSelected ? '2px solid var(--primary)' : '1px dashed rgba(255,255,255,0.3)',
                                            overflow: 'hidden', position: 'relative'
                                        }}>
                                            {(sampleData[el.field] || (el.field === 'team_logo' ? '/logo-placeholder.png' : null)) ? (
                                                <img
                                                    src={sampleData[el.field] || (el.field === 'team_logo' ? '/logo-placeholder.png' : '')}
                                                    alt={getFieldMeta(el.field)?.label || ''}
                                                    style={{
                                                        width: '100%',
                                                        height: '100%',
                                                        objectFit: style.objectFit || (el.field === 'team_logo' ? 'contain' : 'cover'),
                                                        borderRadius: style.borderRadius || 0,
                                                        pointerEvents: 'none'
                                                    }}
                                                    onError={(e) => {
                                                        if (el.field === 'team_logo' && !e.currentTarget.src.includes('logo-placeholder.png')) {
                                                            e.currentTarget.src = '/logo-placeholder.png';
                                                        }
                                                    }}
                                                />
                                            ) : (
                                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem', pointerEvents: 'none' }}>
                                                    <ImageIcon size={24} color="rgba(255,255,255,0.5)" />
                                                    <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.6)', textAlign: 'center' }}>
                                                        {getFieldMeta(el.field)?.label || el.field}
                                                    </span>
                                                </div>
                                            )}
                                            {isSelected && (
                                                <div style={{
                                                    position: 'absolute', top: 2, left: 2,
                                                    background: 'rgba(0,0,0,0.75)', color: 'var(--primary)',
                                                    fontSize: '10px', padding: '1px 5px', borderRadius: 4,
                                                    fontWeight: 600, pointerEvents: 'none'
                                                }}>
                                                    {getFieldMeta(el.field)?.label || el.field}
                                                </div>
                                            )}
                                        </div>
                                    ) : (fieldType === 'custom_text' || el.field === 'custom_text') ? (
                                        <div style={{
                                            width: '100%', height: '100%',
                                            fontSize: style.fontSize || 22, color: style.color || '#fff', fontWeight: style.fontWeight || 700,
                                            textTransform: style.textTransform || 'none',
                                            display: 'flex', alignItems: 'center',
                                            justifyContent: style.textAlign === 'center' ? 'center' : style.textAlign === 'right' ? 'flex-end' : 'flex-start',
                                            overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', userSelect: 'none',
                                        }}>
                                            {el.text || 'TÍTULO'}
                                        </div>
                                    ) : (
                                        <div style={{
                                            width: '100%', height: '100%',
                                            fontSize: style.fontSize || 18, color: style.color || '#fff', fontWeight: style.fontWeight || 600,
                                            textTransform: style.textTransform || 'none',
                                            display: 'flex', alignItems: 'center',
                                            justifyContent: style.textAlign === 'center' ? 'center' : style.textAlign === 'right' ? 'flex-end' : 'flex-start',
                                            overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', userSelect: 'none',
                                        }}>
                                            {formatFieldValue(el.field, sampleData, el)}
                                        </div>
                                    )}
                                    {isSelected && (
                                        <div
                                            onMouseDown={(e) => startResize(e, el)}
                                            style={{
                                                position: 'absolute', right: -6, bottom: -6, width: 14, height: 14,
                                                background: 'var(--primary)', borderRadius: '50%', cursor: 'nwse-resize',
                                                border: '2px solid #fff'
                                            }}
                                        />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Properties */}
                <div className="glass" style={{ padding: '1rem' }}>
                    <h4 style={{ marginBottom: '1rem' }}>Propiedades</h4>
                    {!selectedElement ? (
                        <p style={{ fontSize: '0.85rem', opacity: 0.6 }}>Selecciona un elemento en el canvas para editarlo.</p>
                    ) : (
                        <>
                            <p style={{ fontSize: '0.85rem', marginBottom: '1rem' }}>
                                <strong>{getFieldMeta(selectedElement.field)?.label || (selectedElement.type === 'custom_text' ? 'Texto / Título personalizado' : selectedElement.field)}</strong>
                            </p>

                            {(selectedElement.type === 'custom_text' || selectedElement.field === 'custom_text') && (
                                <div className="form-group" style={{ background: 'rgba(56, 189, 248, 0.08)', padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(56, 189, 248, 0.3)', marginBottom: '1rem' }}>
                                    <label className="label" style={{ color: 'var(--primary)', fontWeight: 600, marginBottom: '0.35rem' }}>
                                        Texto o Título
                                    </label>
                                    <input
                                        type="text"
                                        className="input"
                                        placeholder="Ej: TORNEO CLAUSURA 2026"
                                        value={selectedElement.text || ''}
                                        onChange={(e) => updateElement(selectedElement.id, { text: e.target.value })}
                                        style={{ fontSize: '0.95rem', fontWeight: 600 }}
                                    />
                                    <small style={{ color: 'var(--text-muted)', marginTop: '0.25rem', display: 'block', fontSize: '0.75rem' }}>
                                        Este texto aparecerá fijo en las tarjetas.
                                    </small>
                                </div>
                            )}

                            <div className="grid-form" style={{ gridTemplateColumns: '1fr 1fr' }}>
                                <div className="form-group">
                                    <label className="label">X</label>
                                    <input type="number" className="input" value={selectedElement.x} onChange={(e) => updateElement(selectedElement.id, { x: Number(e.target.value) })} />
                                </div>
                                <div className="form-group">
                                    <label className="label">Y</label>
                                    <input type="number" className="input" value={selectedElement.y} onChange={(e) => updateElement(selectedElement.id, { y: Number(e.target.value) })} />
                                </div>
                                <div className="form-group">
                                    <label className="label">Ancho</label>
                                    <input type="number" className="input" value={selectedElement.width} onChange={(e) => updateElement(selectedElement.id, { width: Number(e.target.value) })} />
                                </div>
                                <div className="form-group">
                                    <label className="label">Alto</label>
                                    <input type="number" className="input" value={selectedElement.height} onChange={(e) => updateElement(selectedElement.id, { height: Number(e.target.value) })} />
                                </div>
                            </div>

                            {(selectedElement.type === 'photo' || selectedElement.type === 'image') ? (
                                <>
                                    {selectedElement.field === 'team_logo' && (
                                        <div className="form-group">
                                            <label className="label">Ajuste del Escudo</label>
                                            <select
                                                className="select"
                                                value={selectedElement.style?.objectFit || 'contain'}
                                                onChange={(e) => updateElementStyle(selectedElement.id, { objectFit: e.target.value })}
                                            >
                                                <option value="contain">Contener (Recomendado para escudos, no deforma)</option>
                                                <option value="cover">Cubrir (Llena todo el cuadro)</option>
                                            </select>
                                        </div>
                                    )}
                                    <div className="form-group">
                                        <label className="label">Radio de borde (px, 50% = círculo)</label>
                                        <input
                                            type="text" className="input"
                                            value={selectedElement.style?.borderRadius ?? 0}
                                            onChange={(e) => updateElementStyle(selectedElement.id, { borderRadius: e.target.value })}
                                        />
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="form-group">
                                        <label className="label">Tamaño de fuente (px)</label>
                                        <input
                                            type="number" className="input"
                                            value={selectedElement.style?.fontSize || 18}
                                            onChange={(e) => updateElementStyle(selectedElement.id, { fontSize: Number(e.target.value) })}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="label">Grosor de texto</label>
                                        <select
                                            className="select"
                                            value={selectedElement.style?.fontWeight || 600}
                                            onChange={(e) => updateElementStyle(selectedElement.id, { fontWeight: Number(e.target.value) || e.target.value })}
                                        >
                                            <option value={400}>Normal (400)</option>
                                            <option value={600}>Seminegrita (600)</option>
                                            <option value={700}>Negrita (700)</option>
                                            <option value={800}>Extra Negrita (800)</option>
                                            <option value={900}>Black (900)</option>
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label className="label">Mayúsculas / Minúsculas</label>
                                        <select
                                            className="select"
                                            value={selectedElement.style?.textTransform || 'none'}
                                            onChange={(e) => updateElementStyle(selectedElement.id, { textTransform: e.target.value })}
                                        >
                                            <option value="none">Normal (como se escriba)</option>
                                            <option value="uppercase">TODO MAYÚSCULAS</option>
                                            <option value="capitalize">Primera Letra En Mayúscula</option>
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label className="label">Color</label>
                                        <input
                                            type="color" className="input" style={{ height: '40px', padding: '0.25rem' }}
                                            value={selectedElement.style?.color || '#ffffff'}
                                            onChange={(e) => updateElementStyle(selectedElement.id, { color: e.target.value })}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="label">Alineación</label>
                                        <select
                                            className="select"
                                            value={selectedElement.style?.textAlign || 'left'}
                                            onChange={(e) => updateElementStyle(selectedElement.id, { textAlign: e.target.value })}
                                        >
                                            <option value="left">Izquierda</option>
                                            <option value="center">Centro</option>
                                            <option value="right">Derecha</option>
                                        </select>
                                    </div>
                                </>
                            )}

                            <div className="form-group">
                                <label className="label">Orden (z-index)</label>
                                <input
                                    type="number" className="input"
                                    value={selectedElement.style?.zIndex || 1}
                                    onChange={(e) => updateElementStyle(selectedElement.id, { zIndex: Number(e.target.value) })}
                                />
                            </div>

                            <button className="btn btn-secondary" style={{ width: '100%', color: 'var(--error)' }} onClick={() => removeElement(selectedElement.id)}>
                                <Trash2 size={16} /> Eliminar elemento
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CardTemplateEditor;
