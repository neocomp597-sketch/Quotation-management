import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = () => {
    const { user, loading, needsActiveBranch } = useAuth();
    const location = useLocation();

    // Every branch-dependent screen needs an active branch; a session is given its default
    // branch straight after login (AuthContext), so this only lasts a moment.
    if (loading || (user && needsActiveBranch)) {
        return <div className="p-10 text-center">Loading...</div>; // Or spinner
    }

    if (!user) {
        const returnTo = `${location.pathname}${location.search}${location.hash}`;
        if (returnTo && returnTo !== '/login') {
            sessionStorage.setItem('arcrm:returnTo', returnTo);
        }

        return <Navigate to="/login" replace state={{ from: location }} />;
    }

    return <Outlet />;
};

export default ProtectedRoute;
