/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import { authService, authorizationService, setAccessToken } from "../services/api";
import { MENU_PERMISSION_GROUPS } from "../constants/menuPermissions";
import { clearCredentials, setCredentials, setPermissions as setReduxPermissions } from "../store/authSlice";

const AuthContext = createContext(null);

const normalizeUser = (userData) => {
    if (!userData) {
        return null;
    }

    return {
        ...userData,
        id: userData.id || userData._id || null,
    };
};

export const AuthProvider = ({ children }) => {
    const dispatch = useDispatch();
    const [user, setUser] = useState(null);
    const [permissions, setPermissions] = useState({});
    const [loading, setLoading] = useState(true);

    const clearSession = useCallback(() => {
        setAccessToken(null);
        localStorage.removeItem("user");
        setUser(null);
        setPermissions({});
        dispatch(clearCredentials());
    }, [dispatch]);

    const refreshSession = useCallback(async () => {
        setLoading(true);

        try {
            const session = await authService.refresh();
            const nextUser = normalizeUser(session.user);

            localStorage.setItem("user", JSON.stringify(nextUser));
            setUser(nextUser);

            // Fetch permissions separately so a failure here
            // doesn't wipe the authenticated session.
            let nextPermissions = {};
            try {
                const permissionsRes = await authorizationService.getMy();
                nextPermissions = permissionsRes.data?.permissions || {};
            } catch (permErr) {
                console.warn("Failed to load permissions after refresh:", permErr);
            }

            setPermissions(nextPermissions);
            dispatch(setCredentials({ user: nextUser, permissions: nextPermissions }));

            return {
                user: nextUser,
                permissions: nextPermissions,
            };
        } catch (error) {
            clearSession();
            return null;
        } finally {
            setLoading(false);
        }
    }, [clearSession, dispatch]);

    useEffect(() => {
        refreshSession();
    }, [refreshSession]);

    const login = useCallback(async (sessionOrToken, maybeUserData) => {
        const session = typeof sessionOrToken === "string"
            ? { accessToken: sessionOrToken, user: maybeUserData }
            : sessionOrToken;
        const normalizedUser = normalizeUser(session?.user);

        setAccessToken(session?.accessToken);
        localStorage.setItem("user", JSON.stringify(normalizedUser));
        setUser(normalizedUser);

        const permissionsRes = await authorizationService.getMy();
        const nextPermissions = permissionsRes.data?.permissions || {};
        setPermissions(nextPermissions);
        dispatch(setCredentials({ user: normalizedUser, permissions: nextPermissions }));
        dispatch(setReduxPermissions(nextPermissions));

        return { user: normalizedUser, permissions: nextPermissions };
    }, [dispatch]);

    const logout = useCallback(async () => {
        try {
            await authService.logout();
        } catch {
            // Local cleanup still happens if the network request fails.
        }
        clearSession();
    }, [clearSession]);

    const hasAccess = useCallback((permissionKey) => {
        if (!user) {
            return false;
        }

        if (user.role === "SUPER_ADMIN" || user.role === "super_admin") {
            return true;
        }

        if (user.role === "admin" || user.role === "Admin") {
            return true;
        }

        if (!permissionKey) {
            return true;
        }

        if (Object.prototype.hasOwnProperty.call(permissions || {}, permissionKey)) {
            return Boolean(permissions?.[permissionKey]);
        }

        const group = MENU_PERMISSION_GROUPS.find((item) =>
            item.key === permissionKey || (item.children || []).some((child) => child.key === permissionKey)
        );

        if (!group) {
            return false;
        }

        if (group.key === permissionKey) {
            return Boolean(permissions?.[group.key]) || (group.children || []).some((child) => Boolean(permissions?.[child.key]));
        }

        return Boolean(permissions?.[group.key]);
    }, [permissions, user]);

    return (
        <AuthContext.Provider
            value={{
                user,
                permissions,
                loading,
                login,
                logout,
                refreshSession,
                hasAccess,
                isAdmin: user?.role === "admin" || user?.role === "Admin",
                isSuperAdmin: user?.role === "SUPER_ADMIN" || user?.role === "super_admin",
            }}
        >
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
