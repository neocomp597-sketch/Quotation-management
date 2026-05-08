import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
    MdLock, MdRefresh, MdTune, MdPeople,
    MdCheckCircle, MdCancel, MdRestartAlt, MdShield, MdWarning,
    MdExpandLess, MdExpandMore, MdAdd, MdDelete, MdSave
} from 'react-icons/md';
import { authorizationService, userService } from '../services/api';
import { ROLE_LABELS as BUILTIN_ROLE_LABELS, MENU_PERMISSION_GROUPS } from '../constants/menuPermissions';
import { useAuth } from '../context/AuthContext';

const childKeysFor = (group) => (group.children || []).map((child) => child.key);

const buildPermissionsFromEnabledSections = (groups, enabledSections = []) => {
    const enabled = new Set(enabledSections);
    return groups.reduce((acc, group) => {
        const childKeys = childKeysFor(group);
        const groupOn = enabled.has(group.key);
        const anyChildOn = childKeys.some((key) => enabled.has(key));

        acc[group.key] = groupOn || anyChildOn;
        childKeys.forEach((key) => {
            acc[key] = groupOn || enabled.has(key);
        });
        return acc;
    }, {});
};

const Authorization = () => {
    const { user: currentUser, isAdmin } = useAuth();

    const [roles, setRoles] = useState([]);
    const [menuGroups, setMenuGroups] = useState([]);
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [usersLoading, setUsersLoading] = useState(true);
    const [savingRoles, setSavingRoles] = useState({});
    const [resettingRoles, setResettingRoles] = useState({});
    const [statusByRole, setStatusByRole] = useState({});
    const [updatingUserId, setUpdatingUserId] = useState('');
    const [expandedGroups, setExpandedGroups] = useState({});

    const [showNewRoleForm, setShowNewRoleForm] = useState(false);
    const [newRoleData, setNewRoleData] = useState({ label: '', description: '' });
    const [creatingRole, setCreatingRole] = useState(false);

    const fetchMatrix = async () => {
        try {
            const res = await authorizationService.getAll();
            setRoles(res.data.roles || []);
            setMenuGroups(res.data.menuGroups || []);
        } catch (err) {
            toast.error('Error loading permissions');
        }
    };

    const fetchUsers = async () => {
        setUsersLoading(true);
        try {
            const res = await userService.getAll();
            setUsers(res.data || []);
        } catch (err) {
            toast.error('Error loading users');
        } finally {
            setUsersLoading(false);
        }
    };

    useEffect(() => {
        if (!isAdmin) return;
        (async () => {
            setLoading(true);
            await authorizationService.initialize().catch(() => null);
            await Promise.all([fetchMatrix(), fetchUsers()]);
            setLoading(false);
        })();
    }, [isAdmin]);

    if (!isAdmin) return <Navigate to="/dashboard" replace />;

    const existingAdmin = users.find((u) => u.role === 'admin');
    const displayGroups = menuGroups.length ? menuGroups : MENU_PERMISSION_GROUPS;
    
    const enabledCount = (perms = {}) => displayGroups.reduce((count, group) => {
        const childKeys = childKeysFor(group);
        if (!childKeys.length) return count + (perms[group.key] ? 1 : 0);
        return count + childKeys.filter((key) => perms[key]).length;
    }, 0);

    const handleRefresh = async () => {
        setLoading(true);
        await Promise.all([fetchMatrix(), fetchUsers()]).finally(() => setLoading(false));
    };

    const toggleExpanded = (roleKey, groupKey) => {
        const key = `${roleKey}-${groupKey}`;
        setExpandedGroups((prev) => ({ ...prev, [key]: !(prev[key] ?? false) }));
    };

    const isExpanded = (roleKey, groupKey) => {
        const key = `${roleKey}-${groupKey}`;
        return expandedGroups[key] ?? false;
    };

    const handleToggle = async (roleKey, permKey, group) => {
        const roleObj = roles.find((r) => r.role === roleKey);
        if (!roleObj || roleObj.locked || savingRoles[roleKey]) return;

        const targetGroup = group || displayGroups.find((item) => item.key === permKey || childKeysFor(item).includes(permKey));
        const childKeys = childKeysFor(targetGroup || {});
        const isParent = targetGroup?.key === permKey;
        const next = { ...roleObj.permissions };

        if (isParent) {
            const currentAllOn = childKeys.length
                ? childKeys.every((key) => roleObj.permissions?.[key])
                : Boolean(roleObj.permissions?.[permKey]);
            const nextValue = !currentAllOn;
            next[permKey] = nextValue;
            childKeys.forEach((key) => {
                next[key] = nextValue;
            });
        } else {
            const nextValue = !roleObj.permissions?.[permKey];
            next[permKey] = nextValue;
            if (targetGroup) {
                next[targetGroup.key] = childKeys.some((key) => key === permKey ? nextValue : Boolean(next[key]));
            }
        }

        setRoles((prev) => prev.map((r) => r.role === roleKey ? { ...r, permissions: next } : r));
        setSavingRoles((prev) => ({ ...prev, [roleKey]: true }));
        setStatusByRole((prev) => ({ ...prev, [roleKey]: 'saving' }));

        try {
            const res = await authorizationService.update(roleKey, next);
            const saved = res.data?.permissions || next;
            setRoles((prev) => prev.map((r) => r.role === roleKey ? { ...r, permissions: saved } : r));
            setStatusByRole((prev) => ({ ...prev, [roleKey]: 'saved' }));
        } catch (err) {
            setRoles((prev) => prev.map((r) => r.role === roleKey ? { ...r, permissions: roleObj.permissions } : r));
            setStatusByRole((prev) => ({ ...prev, [roleKey]: 'error' }));
            toast.error('Failed to save changes');
        } finally {
            setSavingRoles((prev) => ({ ...prev, [roleKey]: false }));
        }
    };

    const handleReset = async (roleKey) => {
        const roleObj = roles.find((r) => r.role === roleKey);
        if (!roleObj || roleObj.locked || resettingRoles[roleKey]) return;

        const defaults = buildPermissionsFromEnabledSections(displayGroups, (roleKey === 'admin' ? MENU_PERMISSION_GROUPS.map(g => g.key) : roleKey === 'manager' ? ['dashboard', 'master', 'enquiry', 'quotation', 'sale', 'purchase', 'planning', 'reports', 'settings'] : ['dashboard', 'enquiry', 'quotation']));
        
        setResettingRoles((prev) => ({ ...prev, [roleKey]: true }));
        setStatusByRole((prev) => ({ ...prev, [roleKey]: 'saving' }));

        try {
            const res = await authorizationService.update(roleKey, defaults);
            setRoles((prev) => prev.map((r) => r.role === roleKey ? { ...r, permissions: res.data?.permissions || defaults } : r));
            setStatusByRole((prev) => ({ ...prev, [roleKey]: 'saved' }));
            toast.success('Permissions reset');
        } catch (err) {
            setStatusByRole((prev) => ({ ...prev, [roleKey]: 'error' }));
            toast.error('Reset failed');
        } finally {
            setResettingRoles((prev) => ({ ...prev, [roleKey]: false }));
        }
    };

    const handleUserRoleChange = async (userId, nextRole) => {
        setUpdatingUserId(userId);
        try {
            const res = await userService.updateRole(userId, nextRole);
            setUsers((prev) => prev.map((u) => u._id === userId ? res.data : u));
            toast.success('User updated');
        } catch (err) {
            toast.error('Update failed');
        } finally {
            setUpdatingUserId('');
        }
    };

    const handleCreateRole = async (e) => {
        e.preventDefault();
        if (!newRoleData.label.trim()) return;
        setCreatingRole(true);
        try {
            const res = await authorizationService.createRole(newRoleData.label, newRoleData.description);
            setRoles((prev) => [...prev, res.data]);
            setNewRoleData({ label: '', description: '' });
            setShowNewRoleForm(false);
            toast.success('Role added');
        } catch (err) {
            toast.error('Could not add role');
        } finally {
            setCreatingRole(false);
        }
    };

    const handleDeleteRole = async (roleKey) => {
        if (!window.confirm('Delete this role?')) return;
        try {
            await authorizationService.deleteRole(roleKey);
            setRoles((prev) => prev.filter((r) => r.role !== roleKey));
            toast.success('Role deleted');
        } catch (err) {
            toast.error('Failed to delete');
        }
    };

    return (
        <div className="max-w-[1400px] mx-auto space-y-12 pb-20">
            {/* Minimal Header */}
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-slate-100 pb-8">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Permissions</h1>
                    <p className="text-sm text-slate-500 mt-1">Manage user roles and section access.</p>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={handleRefresh} className="p-2.5 text-slate-400 hover:text-primary-600 border border-slate-200 rounded-lg hover:bg-primary-50/30 transition-colors">
                        <MdRefresh size={20} />
                    </button>
                    <button 
                        onClick={() => setShowNewRoleForm(!showNewRoleForm)}
                        className="flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-lg font-bold text-sm hover:bg-primary-700 transition-colors shadow-sm"
                    >
                        {showNewRoleForm ? 'Cancel' : <><MdAdd size={18} /> Add Role</>}
                    </button>
                </div>
            </header>

            {/* Simple Add Role Form */}
            {showNewRoleForm && (
                <div className="bg-primary-50/30 border border-primary-100 rounded-xl p-6">
                    <form onSubmit={handleCreateRole} className="flex flex-wrap gap-4 items-end">
                        <div className="flex-1 min-w-[200px]">
                            <label className="block text-xs font-bold text-primary-600 mb-1.5 ml-1">Role Name</label>
                            <input 
                                type="text" 
                                required
                                value={newRoleData.label}
                                onChange={(e) => setNewRoleData({...newRoleData, label: e.target.value})}
                                placeholder="e.g. Accountant"
                                className="w-full px-4 py-2.5 bg-white border border-primary-100 rounded-lg text-sm outline-none focus:border-primary-600 transition-colors"
                            />
                        </div>
                        <div className="flex-[2] min-w-[300px]">
                            <label className="block text-xs font-bold text-primary-600 mb-1.5 ml-1">Description</label>
                            <input 
                                type="text" 
                                value={newRoleData.description}
                                onChange={(e) => setNewRoleData({...newRoleData, description: e.target.value})}
                                placeholder="Optional description..."
                                className="w-full px-4 py-2.5 bg-white border border-primary-100 rounded-lg text-sm outline-none focus:border-primary-600 transition-colors"
                            />
                        </div>
                        <button 
                            type="submit" 
                            disabled={creatingRole || !newRoleData.label.trim()}
                            className="px-6 py-2.5 bg-primary-600 text-white rounded-lg font-bold text-sm hover:bg-primary-700 disabled:opacity-50 transition-colors shadow-sm"
                        >
                            {creatingRole ? 'Saving...' : 'Save Role'}
                        </button>
                    </form>
                </div>
            )}

            {/* Role Cards - Minimal Grid */}
            {loading ? (
                <div className="py-20 text-center">
                    <div className="animate-spin w-8 h-8 border-2 border-slate-200 border-t-primary-600 rounded-full mx-auto" />
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-8">
                    {roles.map((role) => {
                        const busy = savingRoles[role.role] || resettingRoles[role.role];
                        const status = statusByRole[role.role];

                        return (
                            <section key={role.role} className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm flex flex-col hover:border-primary-100 transition-colors">
                                {/* Role Header */}
                                <div className="p-6 border-b border-slate-100 flex items-start justify-between">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h2 className="text-lg font-bold text-slate-900">{role.label}</h2>
                                            {role.locked && <MdLock className="text-slate-300" size={14} title="Locked Role" />}
                                            {busy && <span className="text-[10px] text-primary-500 font-medium animate-pulse ml-1">Saving...</span>}
                                            {status === 'saved' && <span className="text-[10px] text-emerald-500 font-medium ml-1">Saved</span>}
                                        </div>
                                        <p className="text-xs text-slate-500 mt-1">{role.description || 'Permission group.'}</p>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-xs font-bold text-primary-600">{enabledCount(role.permissions)}</span>
                                        <span className="text-xs text-slate-400"> / {displayGroups.length} items</span>
                                    </div>
                                </div>

                                {/* Minimal Permissions List */}
                                <div className="flex-1 p-6 space-y-4">
                                    {displayGroups.map((group) => {
                                        const children = group.children || [];
                                        const childKeys = childKeysFor(group);
                                        const enabledChildrenCount = childKeys.filter((key) => role.permissions?.[key]).length;
                                        const hasPartialAccess = childKeys.length ? enabledChildrenCount > 0 : Boolean(role.permissions?.[group.key]);
                                        const hasFullAccess = childKeys.length ? enabledChildrenCount === childKeys.length : hasPartialAccess;
                                        const expanded = isExpanded(role.role, group.key);

                                        return (
                                            <div key={`${role.role}-${group.key}`} className="space-y-3">
                                                <div className="flex items-center justify-between group">
                                                    <button 
                                                        onClick={() => toggleExpanded(role.role, group.key)}
                                                        className="flex items-center gap-2 text-left"
                                                    >
                                                        <div className={`transition-transform duration-200 ${expanded ? 'rotate-0' : '-rotate-90'}`}>
                                                            <MdExpandMore size={18} className={hasPartialAccess ? "text-primary-400" : "text-slate-300"} />
                                                        </div>
                                                        <span className={`text-sm font-semibold transition-colors ${hasPartialAccess ? 'text-slate-900' : 'text-slate-400'}`}>
                                                            {group.label}
                                                        </span>
                                                        {children.length > 0 && hasPartialAccess && (
                                                            <span className="text-[10px] text-primary-600 bg-primary-50 px-1.5 py-0.5 rounded">
                                                                {enabledChildrenCount}/{children.length}
                                                            </span>
                                                        )}
                                                    </button>
                                                    <div className="flex items-center">
                                                        <label className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${hasFullAccess ? 'bg-primary-600' : 'bg-slate-200'} ${role.locked || busy ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}`}>
                                                            <input type="checkbox" className="sr-only" checked={hasFullAccess} disabled={role.locked || busy} onChange={() => handleToggle(role.role, group.key, group)} />
                                                            <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${hasFullAccess ? 'translate-x-5' : 'translate-x-0.5'}`} />
                                                        </label>
                                                    </div>
                                                </div>

                                                {expanded && children.length > 0 && (
                                                    <div className="ml-6 space-y-2 border-l border-slate-100 pl-4 py-1">
                                                        {children.map((child) => {
                                                            const childOn = Boolean(role.permissions?.[child.key]);
                                                            return (
                                                                <div key={`${role.role}-${child.key}`} className="flex items-center justify-between group/child">
                                                                    <span className={`text-xs font-medium ${childOn ? 'text-primary-700' : 'text-slate-400'}`}>{child.label}</span>
                                                                    <label className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${childOn ? 'bg-primary-600' : 'bg-slate-200'} ${role.locked || busy ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}`}>
                                                                        <input type="checkbox" className="sr-only" checked={childOn} disabled={role.locked || busy} onChange={() => handleToggle(role.role, child.key, group)} />
                                                                        <span className={`inline-block h-2.5 w-2.5 transform rounded-full bg-white transition-transform ${childOn ? 'translate-x-4' : 'translate-x-0.5'}`} />
                                                                    </label>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Card Actions */}
                                <div className="p-4 border-t border-slate-50 bg-slate-50/30 flex gap-2">
                                    {!role.locked && (
                                        <>
                                            <button 
                                                onClick={() => handleReset(role.role)}
                                                className="flex-1 py-2 bg-white border border-slate-200 text-slate-500 rounded-lg text-xs font-bold hover:bg-primary-50 hover:text-primary-600 hover:border-primary-100 transition-colors"
                                            >
                                                Reset
                                            </button>
                                            {role.isCustom && (
                                                <button 
                                                    onClick={() => handleDeleteRole(role.role)}
                                                    className="px-3 py-2 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                                    title="Delete Role"
                                                >
                                                    <MdDelete size={16} />
                                                </button>
                                            )}
                                        </>
                                    )}
                                    {role.locked && (
                                        <div className="flex-1 py-2 text-center text-slate-400 text-xs font-bold">
                                            Standard Role
                                        </div>
                                    )}
                                </div>
                            </section>
                        );
                    })}
                </div>
            )}

            {/* Simple Users Table */}
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:border-primary-50 transition-colors">
                <div className="p-6 border-b border-slate-100">
                    <h2 className="text-lg font-bold text-slate-900">Users</h2>
                    <p className="text-xs text-slate-500 mt-1">Assign roles to each user.</p>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-50 text-[10px] font-bold uppercase tracking-widest text-slate-400 border-b border-slate-100">
                                <th className="px-6 py-4">Name</th>
                                <th className="px-6 py-4">Email</th>
                                <th className="px-6 py-4">Role</th>
                                <th className="px-6 py-4 text-right">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {users.map((user) => {
                                const isMe = currentUser?.id === user._id;
                                const isUpdating = updatingUserId === user._id;

                                return (
                                    <tr key={user._id} className="hover:bg-primary-50/20 transition-colors">
                                        <td className="px-6 py-4">
                                            <span className="text-sm font-bold text-slate-900">{user.name}</span>
                                            {isMe && <span className="ml-2 text-[10px] font-bold bg-primary-100 text-primary-700 px-1.5 py-0.5 rounded">You</span>}
                                        </td>
                                        <td className="px-6 py-4 text-xs text-slate-500">{user.email}</td>
                                        <td className="px-6 py-4">
                                            <select 
                                                value={user.role} 
                                                disabled={isMe || isUpdating}
                                                onChange={(e) => handleUserRoleChange(user._id, e.target.value)}
                                                className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none focus:border-primary-600 disabled:opacity-50 transition-colors"
                                            >
                                                {roles.map(r => (
                                                    <option key={r.role} value={r.role}>{r.label}</option>
                                                ))}
                                            </select>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            {isUpdating ? (
                                                <span className="text-[10px] font-bold text-primary-400 animate-pulse">Updating...</span>
                                            ) : (
                                                <span className="text-[10px] font-bold text-emerald-500">Active</span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );

};

export default Authorization;
