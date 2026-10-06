/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useCallback, useContext, useEffect, useState, useMemo, useRef } from "react";
import { useDispatch } from "react-redux";
import { authService, authorizationService, setAccessToken, clearApiCache } from "../services/api";
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

/** Id of a branch given as an object or as a bare id. */
const branchIdOf = (branch) => {
    if (!branch) return null;
    if (typeof branch === "object") return branch._id || branch.id || null;
    return String(branch);
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

const readStoredActiveBranch = () => {
    try {
        const raw = localStorage.getItem("activeBranch");
        return raw ? JSON.parse(raw) : null;
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

    const [activeBranchId, setActiveBranchIdState] = useState(() => localStorage.getItem("activeBranchId") || null);
    const [activeBranch, setActiveBranchState] = useState(() => readStoredActiveBranch());
    const autoSelectingBranch = useRef(false);

    /**
     * Local half of the active branch: state + storage. The storage value is what
     * the API client sends as x-active-branch on every request, so this and the
     * header can never disagree.
     */
    const storeActiveBranch = useCallback((branchOrId) => {
        const id = branchIdOf(branchOrId);
        if (!id) {
            setActiveBranchIdState(null);
            setActiveBranchState(null);
            localStorage.removeItem("activeBranchId");
            localStorage.removeItem("activeBranch");
            localStorage.removeItem("activeBranchName");
            return;
        }

        setActiveBranchIdState(id);
        localStorage.setItem("activeBranchId", id);

        if (typeof branchOrId === "object") {
            setActiveBranchState(branchOrId);
            localStorage.setItem("activeBranch", JSON.stringify(branchOrId));
            if (branchOrId.name) {
                localStorage.setItem("activeBranchName", branchOrId.name);
            }
        } else {
            setActiveBranchState((prev) => (branchIdOf(prev) === id ? prev : null));
            if (branchIdOf(readStoredActiveBranch()) !== id) {
                localStorage.removeItem("activeBranch");
                localStorage.removeItem("activeBranchName");
            }
        }
    }, []);

    /**
     * Switches the branch the user works in. The branch is persisted on the server
     * first (which also validates it), so the backend operates in the same branch
     * the header shows. Cached lists are dropped and branch-dependent screens are
     * notified so they reload. Throws when the server rejects the branch.
     */
    const setActiveBranch = useCallback(async (branchOrId, { persist = true } = {}) => {
        const id = branchIdOf(branchOrId);
        if (!id) {
            storeActiveBranch(null);
            clearApiCache();
            return null;
        }

        let branch = typeof branchOrId === "object" ? branchOrId : null;
        if (persist) {
            const res = await authService.setActiveBranch(id);
            branch = res.data?.activeBranch || branch;
        }

        storeActiveBranch(branch || id);
        clearApiCache(); // lists cached for the previous branch must not survive the switch

        window.dispatchEvent(new CustomEvent('onActiveBranchChange', { detail: { branchId: id, branch } }));
        window.dispatchEvent(new CustomEvent('onCrmSocketUpdate', { detail: { entity: 'BRANCH', action: 'BRANCH_SWITCH' } }));
        return branch || id;
    }, [storeActiveBranch]);

    /**
     * Adopts the branch the server has persisted for the user when this browser has
     * none yet (new device, cleared storage). When storage already holds a branch it
     * wins: it is what the header shows and what every request has been sent with.
     */
    const syncActiveBranchFromSession = useCallback((sessionUser) => {
        if (!sessionUser) return;
        const serverBranchId = sessionUser.activeBranchId ? String(sessionUser.activeBranchId) : null;
        const localBranchId = localStorage.getItem("activeBranchId");
        if (!localBranchId && serverBranchId) {
            storeActiveBranch(sessionUser.activeBranch || serverBranchId);
        }
    }, [storeActiveBranch]);

    /**
     * Re-reads the branches this user may work in from the server and stores them on
     * the session user. A session opened before a branch was added, or before the
     * user's role changed, would otherwise keep its stale list until the next login.
     */
    const syncBranchOptions = useCallback(async () => {
        try {
            const res = await authService.getBranchOptions();
            const branches = Array.isArray(res.data?.branches) ? res.data.branches : null;
            if (!branches) return;
            const serverActiveId = res.data?.activeBranchId ? String(res.data.activeBranchId) : null;

            setUser((prev) => {
                if (!prev) return prev;
                const next = { ...prev, assignedBranches: branches, activeBranchId: serverActiveId || prev.activeBranchId || null };
                localStorage.setItem("user", JSON.stringify(next));
                return next;
            });

            if (!localStorage.getItem("activeBranchId") && serverActiveId) {
                storeActiveBranch(branches.find((b) => String(branchIdOf(b)) === serverActiveId) || serverActiveId);
            }
        } catch (err) {
            // An unusable stored branch answers 403; the API client then clears it and
            // returns to the selection screen. Anything else keeps the stored list.
            console.warn("Could not refresh branch options:", err);
        }
    }, [storeActiveBranch]);

    const clearSession = useCallback(() => {
        clearApiCache(); // never let the next user see this session's cached data
        setAccessToken(null);
        localStorage.removeItem("user");
        storeActiveBranch(null);
        setUser(null);
        setPermissions({});
        dispatch(clearCredentials());
    }, [dispatch, storeActiveBranch]);

    const refreshSession = useCallback(async () => {
        setLoading(true);

        try {
            const session = await authService.refresh();
            const nextUser = normalizeUser(session.user);

            setAccessToken(session.accessToken);
            localStorage.setItem("user", JSON.stringify(nextUser));
            setUser(nextUser);
            syncActiveBranchFromSession(nextUser);

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
        } catch {
            if (!readStoredUser()) {
                clearSession();
            }
            return null;
        } finally {
            setLoading(false);
        }
    }, [clearSession, dispatch, syncActiveBranchFromSession]);

    const bootstrapFromStoredSession = useCallback(async () => {
        const storedUser = readStoredUser();
        const storedToken = readStoredAccessToken();

        if (storedUser && storedToken && isTokenValidForBoot(storedToken)) {
            setAccessToken(storedToken);
            setUser(storedUser);
            syncActiveBranchFromSession(storedUser);
            // The branch list saved with the session may be stale; the server's answer wins.
            await syncBranchOptions();

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
    }, [dispatch, refreshSession, syncActiveBranchFromSession, syncBranchOptions]);

    useEffect(() => {
        bootstrapFromStoredSession();
    }, [bootstrapFromStoredSession]);

    const login = useCallback(async (sessionOrToken, maybeUserData) => {
        const session = typeof sessionOrToken === "string"
            ? { accessToken: sessionOrToken, user: maybeUserData }
            : sessionOrToken;
        const normalizedUser = normalizeUser(session?.user);

        // A branch left behind by a previous session belongs to that session. Every
        // login starts without one; the login flow then selects (or asks for) it.
        clearApiCache();
        storeActiveBranch(null);

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
    }, [dispatch, storeActiveBranch]);

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

    /**
     * Branches the user may work in. The server fills this with the user's
     * assignment, or with every company branch for admins without one.
     */
    const assignedBranches = useMemo(() => {
        if (!user) return [];
        if (Array.isArray(user.assignedBranches) && user.assignedBranches.length > 0) {
            return user.assignedBranches;
        }
        if (user.branchId) {
            return [user.branchId];
        }
        return [];
    }, [user]);

    /**
     * True while a logged-in user who has branches to choose from has not picked one
     * (or holds a branch that is no longer in their list). ProtectedRoute sends them
     * to the selection screen before any branch-dependent page renders.
     */
    const needsBranchSelection = useMemo(() => {
        if (!user || assignedBranches.length === 0) return false;
        if (!activeBranchId) return true;
        const allowedIds = assignedBranches.map(branchIdOf).filter(Boolean).map(String);
        return allowedIds.length > 0 && !allowedIds.includes(String(activeBranchId));
    }, [user, assignedBranches, activeBranchId]);

    // A user with exactly one branch has nothing to choose: apply it without a screen.
    useEffect(() => {
        if (loading || !needsBranchSelection || assignedBranches.length !== 1 || autoSelectingBranch.current) return;
        autoSelectingBranch.current = true;
        setActiveBranch(assignedBranches[0])
            .catch((err) => console.warn("Could not apply the user's only branch:", err))
            .finally(() => { autoSelectingBranch.current = false; });
    }, [loading, needsBranchSelection, assignedBranches, setActiveBranch]);

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
                activeBranch,
                activeBranchId,
                setActiveBranch,
                assignedBranches,
                needsBranchSelection,
                isAdmin: user?.role === "admin" || user?.role === "Admin",
                isSuperAdmin: user?.role === "SUPER_ADMIN" || user?.role === "super_admin",
            }}
        >
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
