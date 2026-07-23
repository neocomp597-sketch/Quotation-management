import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getFallbackRoute } from '../constants/menuPermissions';

const PermissionRoute = ({ permissionKey, adminOnly, superAdminOnly, children }) => {
    const { user, isAdmin, isSuperAdmin, permissions, loading, hasAccess } = useAuth();
    const location = useLocation();

    if (loading) {
        return <div className="p-10 text-center">Loading...</div>;
    }

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    if (adminOnly && !isAdmin && !isSuperAdmin) {
        const fallback = getFallbackRoute(permissions, user);
        if (fallback === location.pathname) {
            return <div className="p-10 text-center text-slate-500 font-bold">Access Denied</div>;
        }
        return <Navigate to={fallback} replace />;
    }

    if (superAdminOnly && !isSuperAdmin) {
        const fallback = getFallbackRoute(permissions, user);
        if (fallback === location.pathname) {
            return <div className="p-10 text-center text-slate-500 font-bold">Access Denied</div>;
        }
        return <Navigate to={fallback} replace />;
    }

    if (permissionKey && !hasAccess(permissionKey)) {
        const fallback = getFallbackRoute(permissions, user);
        if (fallback === location.pathname) {
            return <div className="p-10 text-center text-slate-500 font-bold">Access Denied</div>;
        }
        return <Navigate to={fallback} replace />;
    }

    return children;
};

export default PermissionRoute;
