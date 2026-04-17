import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle, XCircle, Info, AlertTriangle } from 'lucide-react';

const NotificationContext = createContext();

export const NotificationProvider = ({ children }) => {
    const [notifications, setNotifications] = useState([]);

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
            info: <Info className="toast-icon" size={20} />
        };

        const newNotification = {
            id,
            message,
            type,
            icon: iconMap[type] || iconMap.info,
            removing: false
        };

        setNotifications((prev) => [...prev, newNotification]);

        // Auto remove after 4 seconds
        setTimeout(() => {
            removeNotification(id);
        }, 4000);
    }, [removeNotification]);

    return (
        <NotificationContext.Provider value={{ showNotification }}>
            {children}
            <div className="notification-container">
                {notifications.map((n) => (
                    <div 
                        key={n.id} 
                        className={`toast toast-${n.type} ${n.removing ? 'removing' : ''}`}
                    >
                        <div className="toast-icon-wrapper">{n.icon}</div>
                        <div className="toast-content">{n.message}</div>
                        <button 
                            onClick={() => removeNotification(n.id)}
                            style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', padding: '0.25rem' }}
                        >
                            <XCircle size={14} />
                        </button>
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
