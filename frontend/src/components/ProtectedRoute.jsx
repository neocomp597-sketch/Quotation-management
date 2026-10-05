import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const BRANCH_SELECT_PATH = '/select-branch';

const ProtectedRoute = () => {
    const { user, loading, needsBranchSelection } = useAuth();
    const location = useLocation();

    if (loading) {
        return <div className="p-10 text-center">Loading...</div>; // Or spinner
    }

    if (!user) {
        const returnTo = `${location.pathname}${location.search}${location.hash}`;
        if (returnTo && returnTo !== '/login') {
            sessionStorage.setItem('arcrm:returnTo', returnTo);
        }

        return <Navigate to="/login" replace state={{ from: location }} />;
    }

    // Every branch-dependent screen needs an active branch. Until the user has
    // picked one of their branches they only get the selection screen.
    if (needsBranchSelection && location.pathname !== BRANCH_SELECT_PATH) {
        const returnTo = `${location.pathname}${location.search}${location.hash}`;
        return <Navigate to={BRANCH_SELECT_PATH} replace state={{ returnTo }} />;
    }

    return <Outlet />;
};

export default ProtectedRoute;
