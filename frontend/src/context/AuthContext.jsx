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

const readStoredUser = () => {
    try {
        const raw = localStorage.getItem("user");
        return raw ? normalizeUser(JSON.parse(raw)) : null;
    } catch {
        return null;
    }
};

const readStoredAccessToken = () => {
    try {
        return localStorage.getItem("accessToken") || null;
    } catch {
        return null;
    }
};

const decodeJwtPayload = (token) => {
    if (!token || typeof token !== "string") {
        return null;
    }

    const parts = token.split(".");
    if (parts.length < 2) {
        return null;
    }

    try {
        const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
        const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
        return JSON.parse(atob(padded));
    } catch {
        return null;
    }
};

const isTokenValidForBoot = (token, skewSeconds = 60) => {
    const payload = decodeJwtPayload(token);
    if (!payload?.exp) {
        return false;
    }

    return payload.exp * 1000 > Date.now() + (skewSeconds * 1000);
};

export const AuthProvider = ({ children }) => {
    const dispatch = useDispatch();
    const [user, setUser] = useState(() => readStoredUser());
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

            setAccessToken(session.accessToken);
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
            if (!readStoredUser()) {
                clearSession();
            }
            return null;
        } finally {
            setLoading(false);
        }
    }, [clearSession, dispatch]);

    const bootstrapFromStoredSession = useCallback(async () => {
        const storedUser = readStoredUser();
        const storedToken = readStoredAccessToken();

        if (storedUser && storedToken && isTokenValidForBoot(storedToken)) {
            setAccessToken(storedToken);
            setUser(storedUser);

            let nextPermissions = {};
            try {
                const permissionsRes = await authorizationService.getMy();
                nextPermissions = permissionsRes.data?.permissions || {};
            } catch (permErr) {
                console.warn("Failed to load permissions from stored session:", permErr);
            }

            setPermissions(nextPermissions);
            dispatch(setCredentials({ user: storedUser, permissions: nextPermissions }));
            setLoading(false);
            return;
        }

        await refreshSession();
    }, [dispatch, refreshSession]);

    useEffect(() => {
        bootstrapFromStoredSession();
    }, [bootstrapFromStoredSession]);

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

        // Dispatch events to trigger WebSocket reconnect and realtime data refresh
        window.dispatchEvent(new CustomEvent('onAuthLogin', { detail: { user: normalizedUser } }));
        window.dispatchEvent(new CustomEvent('onCrmSocketUpdate', { detail: { entity: 'SYSTEM', action: 'LOGIN_REFRESH' } }));

        return { user: normalizedUser, permissions: nextPermissions };
    }, [dispatch]);

    const logout = useCallback(async () => {
        try {
            await authService.logout();
        } catch {
            // Local cleanup still happens if the network request fails.
        }
        clearSession();
        window.dispatchEvent(new Event('onAuthSessionChange'));
    }, [clearSession]);

    const hasAccess = useCallback((permissionKey) => {
        if (!user) {
            return false;
        }

        if (user.role === "SUPER_ADMIN" || user.role === "super_admin") {
            return true;
        }

        if (!permissionKey) {
            return true;
        }

        const isAdminUser = user.role === "admin" || user.role === "Admin";
        if (isAdminUser) {
            // Always allow authorization matrix and core settings so admin is never locked out of administrative control
            if (['admin_authorization', 'admin', 'settings', 'settings_profile'].includes(permissionKey)) {
                return true;
            }
            if (permissions && Object.keys(permissions).length > 0) {
                if (Object.prototype.hasOwnProperty.call(permissions, permissionKey)) {
                    return Boolean(permissions[permissionKey]);
                }
                const group = MENU_PERMISSION_GROUPS.find((item) =>
                    item.key === permissionKey || (item.children || []).some((child) => child.key === permissionKey)
                );
                if (group && Object.prototype.hasOwnProperty.call(permissions, group.key)) {
                    return Boolean(permissions[group.key]);
                }
            }
            return true;
        }

        const roleStr = String(user.role || '').toLowerCase();
        if (roleStr === 'employee') {
            if (['dashboard', 'dashboard_overview', 'payroll', 'payroll_payslips', 'payroll_org_chart', 'csm', 'csm_tickets', 'csm_kb', 'settings', 'settings_profile'].includes(permissionKey)) {
                return true;
            }
        }

        if (roleStr === 'vendor') {
            return ['master_products', 'sales_catalog', 'voucher_list', 'vouchers', 'purchase_grn', 'settings', 'settings_profile'].includes(permissionKey);
        }

        if (permissionKey === 'payroll_org_chart' || permissionKey === 'master_org_chart') {
            if (permissions?.payroll_org_chart || permissions?.master_org_chart || permissions?.master) {
                return true;
            }
        }

        if (Object.prototype.hasOwnProperty.call(permissions || {}, permissionKey)) {
            return Boolean(permissions?.[permissionKey]);
        }

        const group = MENU_PERMISSION_GROUPS.find((item) =>
            item.key === permissionKey || (item.children || []).some((child) => child.key === permissionKey)
        );

        if (!group) {
            if (['manager', 'sales'].includes(roleStr)) return true;
            return false;
        }

        if (group.key === permissionKey) {
            return Boolean(permissions?.[group.key]) || (group.children || []).some((child) => Boolean(permissions?.[child.key]));
        }

        if (Object.prototype.hasOwnProperty.call(permissions || {}, group.key)) {
            return Boolean(permissions?.[group.key]);
        }

        if (permissionKey.startsWith('inventory')) {
            if (['manager', 'sales', 'admin'].includes(roleStr)) return true;
        }

        return false;
    }, [permissions, user]);

    const updateUser = useCallback((updatedUserData) => {
        if (!updatedUserData) return;
        setUser((prev) => {
            const next = { ...(prev || {}), ...updatedUserData };
            localStorage.setItem("user", JSON.stringify(next));
            return next;
        });
    }, []);

    return (
        <AuthContext.Provider
            value={{
                user,
                permissions,
                loading,
                login,
                logout,
                refreshSession,
                updateUser,
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
