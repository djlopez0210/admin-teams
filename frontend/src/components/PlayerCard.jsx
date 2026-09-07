import React from 'react';
import { getFieldMeta, formatFieldValue } from '../utils/cardFields';

// Renders a player card from a saved template + resolved player card-data.
// Used, unchanged, by: the template editor's live preview, the single-player
// "Ver tarjeta" view, the team ZIP export loop, and the player's own profile.
const PlayerCard = React.forwardRef(({ template, data }, ref) => {
    if (!template) return null;
    const { canvas_width = 613, canvas_height = 860, background_url, elements = [] } = template;

    return (
        <div
            ref={ref}
            style={{
                position: 'relative',
                width: canvas_width,
                height: canvas_height,
                backgroundColor: '#0f172a',
                backgroundImage: background_url ? `url(${background_url})` : undefined,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                overflow: 'hidden',
                borderRadius: 16,
                flexShrink: 0,
            }}
        >
            {elements.map(el => {
                const fieldType = el.type || getFieldMeta(el.field)?.type || 'text';
                const style = el.style || {};
                const commonStyle = {
                    position: 'absolute',
                    left: el.x, top: el.y, width: el.width, height: el.height,
                    zIndex: style.zIndex || 1,
                };

                if (fieldType === 'photo' || fieldType === 'image') {
                    const src = data?.[el.field];
                    return (
                        <div key={el.id} style={commonStyle}>
                            {src ? (
                                <img
                                    src={src}
                                    alt=""
                                    crossOrigin="anonymous"
                                    style={{
                                        width: '100%', height: '100%',
                                        objectFit: style.objectFit || 'cover',
                                        borderRadius: style.borderRadius || 0,
                                    }}
                                />
                            ) : (
                                <div style={{ width: '100%', height: '100%', borderRadius: style.borderRadius || 0, background: 'rgba(255,255,255,0.12)' }} />
                            )}
                        </div>
                    );
                }

                return (
                    <div
                        key={el.id}
                        style={{
                            ...commonStyle,
                            fontSize: style.fontSize || 18,
                            color: style.color || '#ffffff',
                            fontWeight: style.fontWeight || 600,
                            fontFamily: style.fontFamily || 'inherit',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: style.textAlign === 'center' ? 'center' : style.textAlign === 'right' ? 'flex-end' : 'flex-start',
                            textAlign: style.textAlign || 'left',
                            overflow: 'hidden',
                            whiteSpace: 'nowrap',
                            textOverflow: 'ellipsis',
                        }}
                    >
                        {formatFieldValue(el.field, data)}
                    </div>
                );
            })}
        </div>
    );
});

export default PlayerCard;
