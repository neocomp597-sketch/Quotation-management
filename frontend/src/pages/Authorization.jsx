import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
    MdLock, MdRefresh, MdTune, MdPeople,
    MdCheckCircle, MdCancel, MdRestartAlt, MdShield, MdWarning
} from 'react-icons/md';
import { authorizationService, userService } from '../services/api';
import { ROLE_LABELS, MENU_PERMISSION_GROUPS } from '../constants/menuPermissions';
import { useAuth } from '../context/AuthContext';

const ROLE_META = {
    admin:   { color: 'bg-slate-900 text-white',   border: 'border-slate-200',  badge: 'bg-white/20 text-white',  desc: 'Full system access. All permissions are permanently enabled and cannot be toggled.' },
    manager: { color: 'bg-primary-600 text-white',  border: 'border-primary-100', badge: 'bg-white/20 text-white', desc: 'Operational access: master data, enquiries, quotations, planning and reports.' },
    sales:   { color: 'bg-emerald-600 text-white',  border: 'border-emerald-100', badge: 'bg-white/20 text-white', desc: 'Lightweight access: dashboard, enquiries and quotations only.' }
};

const ROLE_DEFAULTS = {
    admin:   MENU_PERMISSION_GROUPS.map((g) => g.key),
    manager: ['dashboard','master','enquiry','quotation','sale','purchase','planning','reports','settings'],
    sales:   ['dashboard','enquiry','quotation']
};

const Authorization = () => {
    const { user: currentUser, isAdmin } = useAuth();

    const [roles,          setRoles]          = useState([]);
    const [menuGroups,     setMenuGroups]     = useState([]);
    const [users,          setUsers]          = useState([]);
    const [loading,        setLoading]        = useState(true);
    const [usersLoading,   setUsersLoading]   = useState(true);
    const [savingRoles,    setSavingRoles]    = useState({});
    const [resettingRoles, setResettingRoles] = useState({});
    const [statusByRole,   setStatusByRole]   = useState({});
    const [updatingUserId, setUpdatingUserId] = useState('');

    // ── Fetch helpers ────────────────────────────────────────────────────
    const fetchMatrix = async () => {
        try {
            const res = await authorizationService.getAll();
            setRoles(res.data.roles || []);
            setMenuGroups(res.data.menuGroups || []);
        } catch {
            toast.error('Failed to load authorization settings');
        }
    };

    const fetchUsers = async () => {
        setUsersLoading(true);
        try {
            const res = await userService.getAll();
            setUsers(res.data || []);
        } catch {
            toast.error('Failed to load users');
        } finally {
            setUsersLoading(false);
        }
    };

    // ── Init: seed DB defaults, then load data ───────────────────────────
    useEffect(() => {
        if (!isAdmin) return;
        (async () => {
            setLoading(true);
            await authorizationService.initialize().catch(() => null); // idempotent
            await Promise.all([fetchMatrix(), fetchUsers()]);
            setLoading(false);
        })();
    }, [isAdmin]);

    // ── Admin guard — AFTER all hooks ────────────────────────────────────
    if (!isAdmin) return <Navigate to="/dashboard" replace />;

    const existingAdmin    = users.find((u) => u.role === 'admin');
    const displayGroups    = menuGroups.length ? menuGroups : MENU_PERMISSION_GROUPS;
    const enabledCount     = (perms = {}) => Object.values(perms).filter(Boolean).length;

    const handleRefresh = async () => {
        setLoading(true);
        await Promise.all([fetchMatrix(), fetchUsers()]).finally(() => setLoading(false));
    };

    // ── Toggle one permission ────────────────────────────────────────────
    const handleToggle = async (roleKey, permKey) => {
        const roleObj = roles.find((r) => r.role === roleKey);
        if (!roleObj || roleObj.locked || savingRoles[roleKey]) return;

        const next = { ...roleObj.permissions, [permKey]: !roleObj.permissions?.[permKey] };

        setRoles((prev) => prev.map((r) => r.role === roleKey ? { ...r, permissions: next } : r));
        setSavingRoles((prev) => ({ ...prev, [roleKey]: true }));
        setStatusByRole((prev) => ({ ...prev, [roleKey]: 'saving' }));

        try {
            const res = await authorizationService.update(roleKey, next);
            const saved = res.data?.permissions || next;
            setRoles((prev) => prev.map((r) => r.role === roleKey ? { ...r, permissions: saved } : r));
            setStatusByRole((prev) => ({ ...prev, [roleKey]: 'saved' }));
            toast.success(`${ROLE_LABELS[roleKey] || roleKey} permissions updated`);
        } catch (err) {
            setRoles((prev) => prev.map((r) => r.role === roleKey ? { ...r, permissions: roleObj.permissions } : r));
            setStatusByRole((prev) => ({ ...prev, [roleKey]: 'error' }));
            toast.error(err.response?.data?.message || 'Failed to update permissions');
        } finally {
            setSavingRoles((prev) => ({ ...prev, [roleKey]: false }));
        }
    };

    // ── Reset role to defaults ───────────────────────────────────────────
    const handleReset = async (roleKey) => {
        const roleObj = roles.find((r) => r.role === roleKey);
        if (!roleObj || roleObj.locked || resettingRoles[roleKey]) return;

        const enabled = new Set(ROLE_DEFAULTS[roleKey] || []);
        const defaults = displayGroups.reduce((acc, g) => ({ ...acc, [g.key]: enabled.has(g.key) }), {});

        setResettingRoles((prev) => ({ ...prev, [roleKey]: true }));
        setStatusByRole((prev) => ({ ...prev, [roleKey]: 'saving' }));

        try {
            const res = await authorizationService.update(roleKey, defaults);
            setRoles((prev) => prev.map((r) => r.role === roleKey ? { ...r, permissions: res.data?.permissions || defaults } : r));
            setStatusByRole((prev) => ({ ...prev, [roleKey]: 'saved' }));
            toast.success(`${ROLE_LABELS[roleKey] || roleKey} reset to defaults`);
        } catch (err) {
            setStatusByRole((prev) => ({ ...prev, [roleKey]: 'error' }));
            toast.error(err.response?.data?.message || 'Failed to reset');
        } finally {
            setResettingRoles((prev) => ({ ...prev, [roleKey]: false }));
        }
    };

    // ── Change user role ─────────────────────────────────────────────────
    const handleUserRoleChange = async (userId, nextRole) => {
        setUpdatingUserId(userId);
        try {
            const res = await userService.updateRole(userId, nextRole);
            setUsers((prev) => prev.map((u) => u._id === userId ? res.data : u));
            toast.success(`${res.data.name}'s role updated to ${ROLE_LABELS[nextRole] || nextRole}`);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to update user role');
        } finally {
            setUpdatingUserId('');
        }
    };

    // ── JSX ──────────────────────────────────────────────────────────────
    return (
        <div className="space-y-8">
            {/* Page header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                        <MdShield className="text-primary-600" size={30} />
                        Authorization
                    </h1>
                    <p className="text-slate-500 font-medium mt-1">Control which sections each role can access. Toggles save instantly.</p>
                    <div className="flex items-center gap-2 mt-2 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-xl w-fit">
                        <MdWarning className="text-amber-500" size={14} />
                        <span className="text-xs font-bold text-amber-700">Changes take effect on the user's next page load.</span>
                    </div>
                </div>
                <button onClick={handleRefresh} className="inline-flex items-center gap-2 px-4 py-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-50 transition-colors">
                    <MdRefresh size={18} /> Refresh
                </button>
            </div>

            {/* Permission matrix */}
            {loading ? (
                <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 p-16 text-center">
                    <div className="animate-spin border-4 border-slate-200 border-t-primary-600 rounded-full h-12 w-12 mx-auto mb-4" />
                    <p className="text-slate-400 font-semibold text-sm">Loading permissions…</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                    {roles.map((role) => {
                        const meta    = ROLE_META[role.role] || ROLE_META.sales;
                        const busy    = savingRoles[role.role] || resettingRoles[role.role];
                        const status  = statusByRole[role.role];
                        const badgeLabel = role.locked ? 'Locked' : busy ? 'Saving…' : status === 'saved' ? 'Saved ✓' : status === 'error' ? 'Error' : 'Auto-save';

                        return (
                            <section key={role.role} className={`bg-white rounded-[2rem] shadow-sm border overflow-hidden ${meta.border}`}>
                                {/* Header */}
                                <div className={`p-6 ${meta.color}`}>
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <h2 className="text-xl font-black">{ROLE_LABELS[role.role] || role.label}</h2>
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest ${meta.badge}`}>{badgeLabel}</span>
                                            </div>
                                            <p className="text-sm opacity-75 font-medium mt-1 leading-relaxed">{meta.desc}</p>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <p className="text-2xl font-black">{enabledCount(role.permissions)}</p>
                                            <p className="text-xs opacity-60 font-bold uppercase tracking-widest">/ {displayGroups.length}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Toggles */}
                                <div className="p-5 space-y-2">
                                    {displayGroups.map((group) => {
                                        const on = Boolean(role.permissions?.[group.key]);
                                        return (
                                            <div key={`${role.role}-${group.key}`}
                                                className={`flex items-center justify-between gap-3 px-4 py-3 rounded-2xl border transition-colors ${on ? 'border-primary-100 bg-primary-50/40' : 'border-slate-100 bg-slate-50/50'}`}
                                            >
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-2">
                                                        {on ? <MdCheckCircle className="text-primary-500 shrink-0" size={14} /> : <MdCancel className="text-slate-300 shrink-0" size={14} />}
                                                        <span className={`font-bold text-sm ${on ? 'text-slate-900' : 'text-slate-400'}`}>{group.label}</span>
                                                        {group.key === 'admin' && (
                                                            <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 text-[9px] font-black uppercase tracking-widest">Admin only</span>
                                                        )}
                                                    </div>
                                                    <p className="text-xs text-slate-400 mt-0.5 ml-5 leading-snug">{group.description}</p>
                                                </div>
                                                <label className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${on ? 'bg-primary-600' : 'bg-slate-200'} ${role.locked || busy ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                                                    <input type="checkbox" className="sr-only" checked={on} disabled={role.locked || busy} onChange={() => handleToggle(role.role, group.key)} />
                                                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${on ? 'translate-x-6' : 'translate-x-1'}`} />
                                                </label>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Footer */}
                                <div className="px-5 pb-5 flex gap-2">
                                    {role.locked ? (
                                        <div className="flex-1 flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-slate-50 text-slate-500 text-xs font-semibold">
                                            <MdTune size={16} /> Admin access is always fully enabled.
                                        </div>
                                    ) : (
                                        <>
                                            <div className="flex-1 flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-slate-50 text-slate-500 text-xs font-semibold">
                                                <MdTune size={16} />
                                                {busy ? 'Saving…' : status === 'saved' ? 'Last change saved.' : status === 'error' ? 'Save failed — try again.' : 'Toggle to update instantly.'}
                                            </div>
                                            <button type="button" disabled={busy} onClick={() => handleReset(role.role)}
                                                className="flex items-center gap-1.5 px-3 py-2.5 bg-white border border-slate-200 rounded-2xl text-xs font-black text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                                                <MdRestartAlt size={16} /> Reset
                                            </button>
                                        </>
                                    )}
                                </div>
                            </section>
                        );
                    })}
                </div>
            )}

            {/* User role assignment table */}
            <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
                <div className="p-6 border-b border-slate-100 bg-slate-50/70">
                    <div className="flex items-center gap-3">
                        <MdPeople className="text-primary-600" size={24} />
                        <div>
                            <h2 className="text-2xl font-black text-slate-900">User Role Assignment</h2>
                            <p className="text-slate-500 font-medium mt-1">Assign application roles to registered users.</p>
                            <p className="text-sm text-slate-400 font-semibold mt-1">Only one admin allowed. You cannot change your own role.</p>
                        </div>
                    </div>
                </div>

                {usersLoading ? (
                    <div className="p-10 text-center text-slate-400 font-bold">Loading users…</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50/70 border-b border-slate-100 text-slate-400 text-[11px] uppercase tracking-widest font-black">
                                <tr>
                                    <th className="px-6 py-4">User</th>
                                    <th className="px-6 py-4">Email</th>
                                    <th className="px-6 py-4">Current Role</th>
                                    <th className="px-6 py-4">Assign Role</th>
                                    <th className="px-6 py-4">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {users.map((user) => {
                                    const isMe      = currentUser?.id === user._id;
                                    const isUpdating = updatingUserId === user._id;
                                    return (
                                        <tr key={user._id} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="px-6 py-4">
                                                <p className="font-bold text-slate-900">{user.name}</p>
                                                {isMe && <span className="inline-flex mt-1 px-2 py-0.5 rounded-full bg-primary-50 text-primary-600 text-[10px] font-black uppercase tracking-widest">You</span>}
                                            </td>
                                            <td className="px-6 py-4 text-slate-600 font-medium text-sm">{user.email}</td>
                                            <td className="px-6 py-4">
                                                <span className={`px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-widest ${user.role === 'admin' ? 'bg-slate-900 text-white' : user.role === 'manager' ? 'bg-primary-50 text-primary-700' : 'bg-emerald-50 text-emerald-700'}`}>
                                                    {ROLE_LABELS[user.role] || user.role}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <select value={user.role} disabled={isMe || isUpdating}
                                                    onChange={(e) => handleUserRoleChange(user._id, e.target.value)}
                                                    className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-primary-500 bg-white disabled:opacity-60 disabled:cursor-not-allowed"
                                                >
                                                    <option value="admin" disabled={Boolean(existingAdmin && existingAdmin._id !== user._id)}>Admin</option>
                                                    <option value="manager">Manager</option>
                                                    <option value="sales">Sales</option>
                                                </select>
                                            </td>
                                            <td className="px-6 py-4 text-sm font-semibold">
                                                {isMe ? <span className="text-slate-400">Self — cannot change</span>
                                                    : isUpdating ? <span className="text-amber-600">Updating…</span>
                                                        : <span className="text-emerald-600">Ready</span>}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Authorization;
