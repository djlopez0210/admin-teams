import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle, XCircle, Info, AlertTriangle, Trophy } from 'lucide-react';
import ConfirmModal from '../components/ConfirmModal';

const NotificationContext = createContext();

export const NotificationProvider = ({ children }) => {
    const [notifications, setNotifications] = useState([]);
    const [confirmState, setConfirmState] = useState({ 
        isOpen: false, 
        title: '', 
        message: '', 
        type: 'info', 
        confirmText: '', 
        onConfirm: () => {}, 
        onCancel: () => {} 
    });

    const removeNotification = useCallback((id) => {
        setNotifications((prev) => prev.map(notif => 
            notif.id === id ? { ...notif, removing: true } : notif
        ));
        
        setTimeout(() => {
            setNotifications((prev) => prev.filter((n) => n.id !== id));
        }, 300);
    }, []);

    const showNotification = useCallback((message, type = 'info') => {
        const id = Math.random().toString(36).substr(2, 9);
        const iconMap = {
            success: <CheckCircle className="toast-icon" size={20} />,
            error: <XCircle className="toast-icon" size={20} />,
            warning: <AlertTriangle className="toast-icon" size={20} />,
            info: <Info className="toast-icon" size={20} />,
            gold: <Trophy className="toast-icon" size={20} />
        };

        const newNotification = {
            id,
            message,
            type,
            icon: iconMap[type] || iconMap.info,
            removing: false
        };

        setNotifications((prev) => [...prev, newNotification]);

        setTimeout(() => {
            removeNotification(id);
        }, 4000);
    }, [removeNotification]);

    const showConfirm = useCallback(({ title, message, type = 'info', confirmText = '', onConfirm, onCancel }) => {
        return new Promise((resolve) => {
            const handleConfirm = () => {
                setConfirmState(prev => ({ ...prev, isOpen: false }));
                if (onConfirm) onConfirm();
                resolve(true);
            };
            
            const handleCancel = () => {
                setConfirmState(prev => ({ ...prev, isOpen: false }));
                if (onCancel) onCancel();
                resolve(false);
            };

            setConfirmState({
                isOpen: true,
                title,
                message,
                type,
                confirmText,
                onConfirm: handleConfirm,
                onCancel: handleCancel
            });
        });
    }, []);

    return (
        <NotificationContext.Provider value={{ showNotification, showConfirm }}>
            {children}
            
            <ConfirmModal 
                {...confirmState}
            />

            <div className="notification-container">
                {notifications.map((n) => (
                    <div 
                        key={n.id} 
                        className={`toast toast-${n.type} ${n.removing ? 'removing' : ''}`}
                    >
                        <div className="toast-icon-wrapper">{n.icon}</div>
                        <div className="toast-content">{n.message}</div>
                        <div className="toast-progress">
                            <div className="toast-progress-bar"></div>
                        </div>
                    </div>
                ))}
            </div>
        </NotificationContext.Provider>
    );
};

export const useNotification = () => {
    const context = useContext(NotificationContext);
    if (!context) {
        throw new Error('useNotification must be used within a NotificationProvider');
    }
    return context;
};
