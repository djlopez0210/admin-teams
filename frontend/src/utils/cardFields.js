// Helper to translate any football position into FIFA/EA Sports FC standard abbreviation
export const toFifaPosition = (positionName) => {
    if (!positionName) return '';
    const clean = String(positionName)
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");

    // 1. Portero / Arquero
    if (/\b(portero|arquero|guardameta|golero|atajador|goalkeeper|gk|po|por)\b/.test(clean)) {
        return 'PO';
    }
    // 2. Delantero Izquierdo / Extremo Izquierdo
    if (/\b(delantero\s+izq(uierdo)?|extremo\s+izq(uierdo)?|punta\s+izq(uierda)?|ala\s+izq(uierda)?|lw|di|ei)\b/.test(clean)) {
        return 'DI';
    }
    // 3. Delantero Derecho / Extremo Derecho
    if (/\b(delantero\s+der(echo)?|extremo\s+der(echo)?|punta\s+der(echa)?|ala\s+der(echa)?|rw|dd|ed)\b/.test(clean)) {
        return 'DD';
    }
    // 4. Segundo Delantero / Mediapunta
    if (/\b(segundo\s+delantero|mediapunta|media\s+punta|cf|sd)\b/.test(clean)) {
        return 'SD';
    }
    // 5. Delantero Centro / Delantero general
    if (/\b(delantero\s+centro|centrodelantero|centro\s+delantero|delantero|ariete|punta|atacante|st|dc)\b/.test(clean)) {
        return 'DC';
    }
    // 6. Carrilero Izquierdo / Derecho
    if (/\b(carrilero\s+izq(uierdo)?|cai|lwb)\b/.test(clean)) {
        return 'CAI';
    }
    if (/\b(carrilero\s+der(echo)?|cad|rwb)\b/.test(clean)) {
        return 'CAD';
    }
    // 7. Lateral Izquierdo / Marcador Izquierdo
    if (/\b(lateral\s+izq(uierdo)?|defensa\s+izq(uierdo)?|defensor\s+izq(uierdo)?|marcador\s+izq(uierdo)?|marcapunta\s+izq(uierdo)?|lb|li|dfi)\b/.test(clean)) {
        return 'LI';
    }
    // 8. Lateral Derecho / Marcador Derecho
    if (/\b(lateral\s+der(echo)?|defensa\s+der(echo)?|defensor\s+der(echo)?|marcador\s+der(echo)?|marcapunta\s+der(echo)?|rb|ld|dfd)\b/.test(clean)) {
        return 'LD';
    }
    // 9. Defensa Central / Zaguero / Defensa general
    if (/\b(defensa\s+central|central|zaguero|defensor\s+central|back\s+central|cb|dfc)\b/.test(clean)) {
        return 'DFC';
    }
    if (/\b(defensa|defensor|zaga|df)\b/.test(clean)) {
        return 'DFC';
    }
    // 10. Mediocentro Defensivo / Volante de Marca / Contención
    if (/\b(medio(campista)?\s+defensivo|volante\s+defensivo|volante\s+de\s+marca|contencion|pivote|recuperador|cdm|mcd)\b/.test(clean)) {
        return 'MCD';
    }
    // 11. Mediocentro Ofensivo / Volante Ofensivo / Enganche
    if (/\b(medio(campista)?\s+ofensivo|volante\s+ofensivo|volante\s+de\s+creacion|volante\s+creativo|enganche|diez|cam|mco)\b/.test(clean)) {
        return 'MCO';
    }
    // 12. Medio Izquierdo / Derecho
    if (/\b(medio(campista)?\s+izq(uierdo)?|volante\s+izq(uierdo)?|lm|mi)\b/.test(clean)) {
        return 'MI';
    }
    if (/\b(medio(campista)?\s+der(echo)?|volante\s+der(echo)?|rm|md)\b/.test(clean)) {
        return 'MD';
    }
    // 13. Mediocentro / Volante general
    if (/\b(medio(campista)?|centrocampista|volante|volante\s+mixto|cm|mc)\b/.test(clean)) {
        return 'MC';
    }

    const tokens = clean.split(/\s+/).filter(Boolean);
    if (tokens.length === 1 && tokens[0].length <= 3) {
        return tokens[0].toUpperCase();
    }
    const initials = tokens.map(t => t[0]).join('').slice(0, 3).toUpperCase();
    return initials || clean.slice(0, 3).toUpperCase();
};

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
    { id: 'primary_position_abbr', label: 'Posición FIFA (Sigla: PO, DC...)', type: 'text' },
    { id: 'primary_position_name', label: 'Posición principal (Texto)', type: 'text' },
    { id: 'secondary_position_abbr', label: 'Posición secundaria (Sigla)', type: 'text' },
    { id: 'secondary_position_name', label: 'Posición secundaria (Texto)', type: 'text' },
    { id: 'tertiary_position_abbr', label: 'Posición terciaria (Sigla)', type: 'text' },
    { id: 'tertiary_position_name', label: 'Posición terciaria (Texto)', type: 'text' },
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

export const getFieldMeta = (fieldId) => {
    if (fieldId === 'custom_text') {
        return { id: 'custom_text', label: 'Texto / Título personalizado', type: 'custom_text' };
    }
    return CARD_FIELDS.find(f => f.id === fieldId);
};

export const formatFieldValue = (fieldId, data, element) => {
    if (fieldId === 'custom_text' || element?.type === 'custom_text') {
        return element?.text ?? 'TÍTULO';
    }
    if (!data) return '';

    if (fieldId === 'primary_position_abbr') {
        return toFifaPosition(data.primary_position_abbr || data.primary_position_name);
    }
    if (fieldId === 'secondary_position_abbr') {
        return toFifaPosition(data.secondary_position_abbr || data.secondary_position_name);
    }
    if (fieldId === 'tertiary_position_abbr') {
        return toFifaPosition(data.tertiary_position_abbr || data.tertiary_position_name);
    }

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

export const createDefaultCustomTextElement = (defaultText = 'TÍTULO') => ({
    id: `custom_text_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    field: 'custom_text',
    type: 'custom_text',
    text: defaultText,
    x: 40,
    y: 40,
    width: 260,
    height: 42,
    style: {
        fontSize: 22,
        color: '#ffffff',
        fontWeight: 700,
        textAlign: 'center',
        textTransform: 'uppercase',
        zIndex: 2,
    },
});

export const createDefaultElement = (fieldId) => {
    if (fieldId === 'custom_text') {
        return createDefaultCustomTextElement();
    }
    const meta = getFieldMeta(fieldId);
    const isVisual = meta?.type === 'photo' || meta?.type === 'image';
    return {
        id: `${fieldId}_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        field: fieldId,
        type: meta?.type || 'text',
        x: 40,
        y: 40,
        width: isVisual ? 140 : (fieldId.endsWith('_position_abbr') ? 75 : 220),
        height: isVisual ? 140 : (fieldId.endsWith('_position_abbr') ? 40 : 36),
        style: isVisual
            ? {
                borderRadius: meta?.type === 'photo' ? '50%' : 8,
                objectFit: fieldId === 'team_logo' ? 'contain' : 'cover',
                zIndex: 1
            }
            : {
                fontSize: fieldId.endsWith('_position_abbr') ? 26 : 18,
                color: '#ffffff',
                fontWeight: fieldId.endsWith('_position_abbr') ? 800 : 600,
                textAlign: fieldId.endsWith('_position_abbr') ? 'center' : 'left',
                zIndex: 1
            },
    };
};
