import React from 'react';
import { Navigate } from 'react-router-dom';
import { isSessionValid, updateSessionActivity } from '../utils/session';

const ProtectedRoute = ({ children, allowedRoles }) => {
    if (!isSessionValid()) {
        return <Navigate to="/login" replace />;
    }

    updateSessionActivity();
    const userRole = localStorage.getItem('adminRole');

    if (allowedRoles && !allowedRoles.includes(userRole)) {
        // Redirect based on role or to a safe default
        if (userRole === 'veedor') return <Navigate to="/veedor" replace />;
        return <Navigate to="/login" replace />;
    }

    return children;
};

export default ProtectedRoute;
