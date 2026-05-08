/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { authService, authorizationService } from "../services/api";
import { MENU_PERMISSION_GROUPS } from "../constants/menuPermissions";

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
    const [user, setUser] = useState(null);
    const [permissions, setPermissions] = useState({});
    const [loading, setLoading] = useState(true);

    const clearSession = useCallback(() => {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        setUser(null);
        setPermissions({});
    }, []);

    const refreshSession = useCallback(async () => {
        const token = localStorage.getItem("token");

        if (!token) {
            setUser(null);
            setPermissions({});
            setLoading(false);
            return null;
        }

        setLoading(true);

        try {
            const [userRes, permissionsRes] = await Promise.all([
                authService.getMe(),
                authorizationService.getMy(),
            ]);

            const nextUser = normalizeUser(userRes.data);
            localStorage.setItem("user", JSON.stringify(nextUser));
            setUser(nextUser);
            setPermissions(permissionsRes.data?.permissions || {});

            return {
                user: nextUser,
                permissions: permissionsRes.data?.permissions || {},
            };
        } catch (error) {
            console.error("Failed to refresh session:", error);
            clearSession();
            return null;
        } finally {
            setLoading(false);
        }
    }, [clearSession]);

    useEffect(() => {
        refreshSession();
    }, [refreshSession]);

    const login = useCallback(async (token, userData) => {
        const normalizedUser = normalizeUser(userData);

        localStorage.setItem("token", token);
        localStorage.setItem("user", JSON.stringify(normalizedUser));
        setUser(normalizedUser);

        return refreshSession();
    }, [refreshSession]);

    const logout = useCallback(() => {
        clearSession();
    }, [clearSession]);

    const hasAccess = useCallback((permissionKey) => {
        if (!user) {
            return false;
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
                isAdmin: user?.role === "admin",
            }}
        >
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
