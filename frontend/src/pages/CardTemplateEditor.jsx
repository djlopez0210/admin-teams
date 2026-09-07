import React, { useState, useEffect, useRef } from 'react';
import { Trash2, Save, Upload, Image as ImageIcon } from 'lucide-react';
import { cardTemplateService, settingsService } from '../services/api';
import { useNotification } from '../context/NotificationContext';
import { CARD_FIELDS, getFieldMeta, formatFieldValue, createDefaultElement } from '../utils/cardFields';

// Placeholder data so the superadmin can design the layout without needing
// a real player loaded (the template is global, not tied to any one team).
const SAMPLE_DATA = {
    full_name: 'Juan Pérez', first_name: 'Juan', last_name: 'Pérez',
    uniform_number: 10, document_number: '123456789',
    primary_position_name: 'Delantero', secondary_position_name: 'Extremo Izquierdo', tertiary_position_name: 'Mediocampista',
    preferred_foot: 'derecha', blood_type: 'O+', eps: 'Sura', nationality: 'Colombiana',
    birth_date: '2000-05-10', phone: '3001234567', email: 'juan@example.com', address: 'Calle 123',
    team_name: 'Alianza F.C.', team_logo: null,
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
            const res = await cardTemplateService.get();
            setTemplate(res.data);
        } catch (err) {
            showNotification('Error al cargar la plantilla', 'error');
        } finally {
            setLoading(false);
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
            <div className="flex-responsive" style={{ marginBottom: '1.5rem', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                    <h1>Diseñador de Tarjeta</h1>
                    <p style={{ color: 'var(--text-muted)' }}>Arrastra los campos sobre la tarjeta para diseñar el layout global. Los datos de ejemplo son ficticios.</p>
                </div>
                <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                    <Save size={18} /> {saving ? 'Guardando...' : 'Guardar Plantilla'}
                </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr 280px', gap: '1.5rem', alignItems: 'flex-start' }}>
                {/* Palette */}
                <div className="glass" style={{ padding: '1rem', maxHeight: '80vh', overflowY: 'auto' }}>
                    <h4 style={{ marginBottom: '1rem' }}>Campos</h4>
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
                                            background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            border: '1px dashed rgba(255,255,255,0.4)', overflow: 'hidden'
                                        }}>
                                            <ImageIcon size={24} color="rgba(255,255,255,0.5)" />
                                        </div>
                                    ) : (
                                        <div style={{
                                            width: '100%', height: '100%',
                                            fontSize: style.fontSize || 18, color: style.color || '#fff', fontWeight: style.fontWeight || 600,
                                            display: 'flex', alignItems: 'center',
                                            justifyContent: style.textAlign === 'center' ? 'center' : style.textAlign === 'right' ? 'flex-end' : 'flex-start',
                                            overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', userSelect: 'none',
                                        }}>
                                            {formatFieldValue(el.field, SAMPLE_DATA)}
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
                                <strong>{getFieldMeta(selectedElement.field)?.label || selectedElement.field}</strong>
                            </p>

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
                                <div className="form-group">
                                    <label className="label">Radio de borde (px, 50% = círculo)</label>
                                    <input
                                        type="text" className="input"
                                        value={selectedElement.style?.borderRadius ?? 0}
                                        onChange={(e) => updateElementStyle(selectedElement.id, { borderRadius: e.target.value })}
                                    />
                                </div>
                            ) : (
                                <>
                                    <div className="form-group">
                                        <label className="label">Tamaño de fuente</label>
                                        <input
                                            type="number" className="input"
                                            value={selectedElement.style?.fontSize || 18}
                                            onChange={(e) => updateElementStyle(selectedElement.id, { fontSize: Number(e.target.value) })}
                                        />
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
