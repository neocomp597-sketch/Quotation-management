import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getFallbackRoute } from '../constants/menuPermissions';

const PermissionRoute = ({ permissionKey, adminOnly, superAdminOnly, children }) => {
    const { user, isAdmin, isSuperAdmin, permissions, loading, hasAccess } = useAuth();

    if (loading) {
        return <div className="p-10 text-center">Loading...</div>;
    }

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    if (adminOnly && !isAdmin && !isSuperAdmin) {
        return <Navigate to={getFallbackRoute(permissions)} replace />;
    }

    if (superAdminOnly && !isSuperAdmin) {
        return <Navigate to={getFallbackRoute(permissions)} replace />;
    }

    if (permissionKey && !hasAccess(permissionKey)) {
        return <Navigate to={getFallbackRoute(permissions)} replace />;
    }

    return children;
};

export default PermissionRoute;
