// Registry of data fields that can be placed on a player card.
// Shared by the template editor (palette + resize/property panel) and the
// PlayerCard renderer, so both always agree on what a field means.
export const CARD_FIELDS = [
    { id: 'photo_cutout', label: 'Foto (sin fondo)', type: 'photo' },
    { id: 'photo', label: 'Foto (original)', type: 'photo' },
    { id: 'full_name', label: 'Nombre completo', type: 'text' },
    { id: 'first_name', label: 'Nombres', type: 'text' },
    { id: 'last_name', label: 'Apellidos', type: 'text' },
    { id: 'uniform_number', label: 'Número de camiseta', type: 'text' },
    { id: 'document_number', label: 'Documento', type: 'text' },
    { id: 'primary_position_name', label: 'Posición principal', type: 'text' },
    { id: 'secondary_position_name', label: 'Posición secundaria', type: 'text' },
    { id: 'tertiary_position_name', label: 'Posición terciaria', type: 'text' },
    { id: 'preferred_foot', label: 'Pie hábil', type: 'text' },
    { id: 'blood_type', label: 'Tipo de sangre', type: 'text' },
    { id: 'eps', label: 'EPS', type: 'text' },
    { id: 'nationality', label: 'Nacionalidad', type: 'text' },
    { id: 'birth_date', label: 'Fecha de nacimiento', type: 'text' },
    { id: 'phone', label: 'Teléfono', type: 'text' },
    { id: 'email', label: 'Email', type: 'text' },
    { id: 'address', label: 'Dirección', type: 'text' },
    { id: 'team_name', label: 'Nombre del equipo', type: 'text' },
    { id: 'team_logo', label: 'Escudo del equipo', type: 'image' },
    { id: 'matches_played', label: 'Partidos jugados', type: 'text' },
    { id: 'goals_total', label: 'Goles totales', type: 'text' },
    { id: 'yellow_cards', label: 'Tarjetas amarillas', type: 'text' },
    { id: 'red_cards', label: 'Tarjetas rojas', type: 'text' },
    { id: 'avg_rating', label: 'Calificación promedio', type: 'text' },
];

export const getFieldMeta = (fieldId) => CARD_FIELDS.find(f => f.id === fieldId);

export const formatFieldValue = (fieldId, data) => {
    if (!data) return '';
    const value = data[fieldId];
    if (fieldId === 'birth_date') {
        if (!value) return '';
        const d = new Date(value);
        return isNaN(d.getTime()) ? '' : d.toLocaleDateString();
    }
    if (fieldId === 'avg_rating') {
        return value === null || value === undefined ? '-' : Number(value).toFixed(1);
    }
    if (fieldId === 'uniform_number' && value !== null && value !== undefined) {
        return `#${value}`;
    }
    if (value === null || value === undefined) return '';
    return String(value);
};

export const createDefaultElement = (fieldId) => {
    const meta = getFieldMeta(fieldId);
    const isVisual = meta?.type === 'photo' || meta?.type === 'image';
    return {
        id: `${fieldId}_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        field: fieldId,
        type: meta?.type || 'text',
        x: 40,
        y: 40,
        width: isVisual ? 160 : 220,
        height: isVisual ? 160 : 36,
        style: isVisual
            ? { borderRadius: meta?.type === 'photo' ? '50%' : 8, objectFit: 'cover', zIndex: 1 }
            : { fontSize: 18, color: '#ffffff', fontWeight: 600, textAlign: 'left', zIndex: 1 },
    };
};
