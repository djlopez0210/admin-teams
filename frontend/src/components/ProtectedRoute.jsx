import React from 'react';
import { Navigate } from 'react-router-dom';

const ProtectedRoute = ({ children, allowedRoles }) => {
    const isAuthenticated = localStorage.getItem('adminAuthenticated') === 'true';
    const userRole = localStorage.getItem('adminRole');

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    if (allowedRoles && !allowedRoles.includes(userRole)) {
        // Redirect based on role or to a safe default
        if (userRole === 'veedor') return <Navigate to="/veedor" replace />;
        return <Navigate to="/login" replace />;
    }

    return children;
};

export default ProtectedRoute;
