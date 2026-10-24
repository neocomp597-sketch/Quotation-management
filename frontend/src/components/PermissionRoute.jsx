import React from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { MdLock } from 'react-icons/md';
import { useAuth } from '../context/AuthContext';
import { getFallbackRoute } from '../constants/menuPermissions';

const ACTION_TEXT = {
    create: 'add new records',
    modify: 'edit records',
    delete: 'delete records',
};

/** Shown when the screen may be viewed but the requested action (a new/edit form) may not. */
const ActionDenied = ({ action }) => {
    const navigate = useNavigate();
    return (
        <div className="max-w-md mx-auto mt-20 p-8 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <MdLock size={22} />
            </div>
            <h2 className="mt-4 text-base font-black text-slate-900 dark:text-white">Permission required</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                You do not have permission to {ACTION_TEXT[action] || action} on this screen. Ask your administrator if you need it.
            </p>
            <button
                type="button"
                onClick={() => navigate(-1)}
                className="mt-6 px-4 py-2 bg-primary-600 text-white rounded-xl text-xs font-bold hover:bg-primary-700 transition-colors"
            >
                Go back
            </button>
        </div>
    );
};

/**
 * Guards a route by screen permission. `action` ('create' or 'modify') is for new
 * and edit form URLs, so typing them in cannot get past a missing permission.
 */
const PermissionRoute = ({ permissionKey, action, adminOnly, superAdminOnly, children }) => {
    const { user, isAdmin, isSuperAdmin, permissions, loading, hasAccess, can } = useAuth();
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

    if (permissionKey && action && !can(permissionKey, action)) {
        // children is the page inside <Layout>; keep the layout, replace the page
        return React.isValidElement(children)
            ? React.cloneElement(children, undefined, <ActionDenied action={action} />)
            : <ActionDenied action={action} />;
    }

    return children;
};

export default PermissionRoute;
