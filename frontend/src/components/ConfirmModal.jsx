import React, { useState } from 'react';
import { AlertTriangle, Info, CheckCircle, HelpCircle, Trophy } from 'lucide-react';

const ConfirmModal = ({ 
    isOpen, 
    title, 
    message, 
    onConfirm, 
    onCancel, 
    type = 'info', 
    confirmText = '', 
    confirmButtonText = 'Confirmar',
    cancelButtonText = 'Cancelar'
}) => {
    const [inputValue, setInputValue] = useState('');

    if (!isOpen) return null;

    const iconMap = {
        warning: <AlertTriangle size={32} className="text-warning" />,
        error: <AlertTriangle size={32} className="text-error" />,
        success: <CheckCircle size={32} className="text-success" />,
        gold: <Trophy size={32} style={{ color: '#fbbf24' }} />,
        info: <HelpCircle size={32} className="text-primary" />
    };

    const isConfirmDisabled = confirmText && inputValue !== confirmText;

    return (
        <div className="confirm-modal-overlay animate-fade-in">
            <div className={`confirm-modal ${type} animate-slide-up`}>
                <h3>
                    {iconMap[type] || iconMap.info}
                    {title}
                </h3>
                <p>{message}</p>

                {confirmText && (
                    <div className="form-group">
                        <label className="label" style={{ marginBottom: '0.5rem', opacity: 0.8 }}>
                            Escribe <strong style={{ color: 'white' }}>{confirmText}</strong> para continuar:
                        </label>
                        <input 
                            type="text" 
                            className="confirm-input"
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            placeholder={confirmText}
                            autoFocus
                        />
                    </div>
                )}

                <div className="confirm-actions">
                    <button 
                        className="btn btn-secondary" 
                        onClick={onCancel}
                        style={{ flex: 1 }}
                    >
                        {cancelButtonText}
                    </button>
                    <button 
                        className={`btn ${type === 'error' || type === 'warning' ? 'btn-danger' : 'btn-primary'}`} 
                        onClick={onConfirm}
                        disabled={isConfirmDisabled}
                        style={{ 
                            flex: 1.5,
                            background: type === 'gold' ? 'linear-gradient(90deg, #fbbf24, #d97706)' : undefined,
                            borderColor: type === 'gold' ? '#fbbf24' : undefined,
                            color: type === 'gold' ? 'black' : undefined,
                            opacity: isConfirmDisabled ? 0.5 : 1
                        }}
                    >
                        {confirmButtonText}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmModal;
