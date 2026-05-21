import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
    MdLock, MdRefresh, MdTune, MdPeople,
    MdCheckCircle, MdCancel, MdRestartAlt, MdShield, MdWarning,
    MdExpandLess, MdExpandMore, MdAdd, MdDelete, MdSave, MdEdit, MdClose
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
    const [showNewUserForm, setShowNewUserForm] = useState(false);
    const [newUserData, setNewUserData] = useState({ name: '', email: '', password: '', role: 'sales' });
    const [creatingUser, setCreatingUser] = useState(false);
    
    const [editingUserId, setEditingUserId] = useState(null);
    const [editingUserData, setEditingUserData] = useState({ name: '', email: '', password: '', role: '' });


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
            toast.error(err.response?.data?.message || 'Update failed');
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

    const handleCreateUser = async (e) => {
        e.preventDefault();
        if (!newUserData.name.trim() || !newUserData.email.trim() || !newUserData.password.trim()) return;

        setCreatingUser(true);
        try {
            const res = await userService.create({
                name: newUserData.name.trim(),
                email: newUserData.email.trim(),
                password: newUserData.password,
                role: newUserData.role || 'sales',
            });

            setUsers((prev) => [res.data, ...prev]);
            setNewUserData({ name: '', email: '', password: '', role: 'sales' });
            setShowNewUserForm(false);
            toast.success('User created');
        } catch (err) {
            toast.error(err.response?.data?.message || 'Could not create user');
        } finally {
            setCreatingUser(false);
        }
    };

    const handleStartEditUser = (user) => {
        setEditingUserId(user._id);
        setEditingUserData({ name: user.name, email: user.email, password: '', role: user.role });
    };

    const handleCancelEditUser = () => {
        setEditingUserId(null);
        setEditingUserData({ name: '', email: '', password: '', role: '' });
    };

    const handleSaveUser = async () => {
        if (!editingUserData.name.trim() || !editingUserData.email.trim()) return;
        setUpdatingUserId(editingUserId);
        try {
            const data = { ...editingUserData };
            if (!data.password) delete data.password;
            
            const res = await userService.update(editingUserId, data);
            setUsers((prev) => prev.map((u) => u._id === editingUserId ? res.data : u));
            setEditingUserId(null);
            toast.success('User updated');
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to update user');
        } finally {
            setUpdatingUserId('');
        }
    };

    const handleDeleteUser = async (userId) => {
        if (!window.confirm('Are you sure you want to delete this user?')) return;
        setUpdatingUserId(userId);
        try {
            await userService.delete(userId);
            setUsers((prev) => prev.filter((u) => u._id !== userId));
            toast.success('User deleted');
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to delete user');
        } finally {
            setUpdatingUserId('');
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
                <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h2 className="text-lg font-bold text-slate-900">Team Users</h2>
                        <p className="text-xs text-slate-500 mt-1">Create company users and assign their roles.</p>
                    </div>
                    <button
                        onClick={() => setShowNewUserForm((prev) => !prev)}
                        className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-lg font-bold text-sm hover:bg-primary-700 transition-colors shadow-sm"
                    >
                        {showNewUserForm ? 'Cancel' : <><MdAdd size={18} /> Add User</>}
                    </button>
                </div>
                {showNewUserForm && (
                    <form onSubmit={handleCreateUser} className="p-6 bg-primary-50/20 border-b border-primary-100 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4 items-end">
                        <div>
                            <label className="block text-xs font-bold text-primary-600 mb-1.5 ml-1">Name</label>
                            <input
                                type="text"
                                required
                                value={newUserData.name}
                                onChange={(e) => setNewUserData((prev) => ({ ...prev, name: e.target.value }))}
                                className="w-full px-4 py-2.5 bg-white border border-primary-100 rounded-lg text-sm outline-none focus:border-primary-600 transition-colors"
                                placeholder="Full name"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-primary-600 mb-1.5 ml-1">Email</label>
                            <input
                                type="email"
                                required
                                value={newUserData.email}
                                onChange={(e) => setNewUserData((prev) => ({ ...prev, email: e.target.value }))}
                                className="w-full px-4 py-2.5 bg-white border border-primary-100 rounded-lg text-sm outline-none focus:border-primary-600 transition-colors"
                                placeholder="name@company.com"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-primary-600 mb-1.5 ml-1">Password</label>
                            <input
                                type="password"
                                required
                                minLength={6}
                                value={newUserData.password}
                                onChange={(e) => setNewUserData((prev) => ({ ...prev, password: e.target.value }))}
                                className="w-full px-4 py-2.5 bg-white border border-primary-100 rounded-lg text-sm outline-none focus:border-primary-600 transition-colors"
                                placeholder="Temporary password"
                                autoComplete="new-password"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-primary-600 mb-1.5 ml-1">Role</label>
                            <select
                                value={newUserData.role}
                                onChange={(e) => setNewUserData((prev) => ({ ...prev, role: e.target.value }))}
                                className="w-full px-4 py-2.5 bg-white border border-primary-100 rounded-lg text-sm font-bold outline-none focus:border-primary-600 transition-colors"
                            >
                                {roles.map((role) => (
                                    <option key={role.role} value={role.role}>{role.label}</option>
                                ))}
                            </select>
                        </div>
                        <button
                            type="submit"
                            disabled={creatingUser}
                            className="px-6 py-2.5 bg-primary-600 text-white rounded-lg font-bold text-sm hover:bg-primary-700 disabled:opacity-50 transition-colors shadow-sm"
                        >
                            {creatingUser ? 'Creating...' : 'Create User'}
                        </button>
                    </form>
                )}
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-50 text-[10px] font-bold uppercase tracking-widest text-slate-400 border-b border-slate-100">
                                <th className="px-6 py-4">Name</th>
                                <th className="px-6 py-4">Email</th>
                                <th className="px-6 py-4">Role</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {users.map((user) => {
                                const isMe = currentUser?.id === user._id;
                                const isUpdating = updatingUserId === user._id;
                                const isEditing = editingUserId === user._id;

                                if (isEditing) {
                                    return (
                                        <tr key={user._id} className="bg-primary-50/40 transition-colors">
                                            <td className="px-6 py-4">
                                                <input
                                                    type="text"
                                                    value={editingUserData.name}
                                                    onChange={(e) => setEditingUserData(prev => ({...prev, name: e.target.value}))}
                                                    className="w-full px-3 py-1.5 bg-white border border-primary-200 rounded-lg text-sm font-bold outline-none focus:border-primary-500"
                                                />
                                            </td>
                                            <td className="px-6 py-4">
                                                <input
                                                    type="email"
                                                    value={editingUserData.email}
                                                    onChange={(e) => setEditingUserData(prev => ({...prev, email: e.target.value}))}
                                                    className="w-full px-3 py-1.5 bg-white border border-primary-200 rounded-lg text-sm outline-none focus:border-primary-500"
                                                />
                                            </td>
                                            <td className="px-6 py-4">
                                                <select 
                                                    value={editingUserData.role} 
                                                    disabled={isMe || isUpdating}
                                                    onChange={(e) => setEditingUserData(prev => ({...prev, role: e.target.value}))}
                                                    className="w-full px-3 py-1.5 bg-white border border-primary-200 rounded-lg text-xs font-bold outline-none focus:border-primary-500 disabled:opacity-50"
                                                >
                                                    {roles.map(r => (
                                                        <option key={r.role} value={r.role}>{r.label}</option>
                                                    ))}
                                                </select>
                                                <div className="mt-2">
                                                    <input
                                                        type="password"
                                                        placeholder="New password (optional)"
                                                        value={editingUserData.password}
                                                        onChange={(e) => setEditingUserData(prev => ({...prev, password: e.target.value}))}
                                                        className="w-full px-3 py-1.5 bg-white border border-primary-200 rounded-lg text-xs outline-none focus:border-primary-500"
                                                    />
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                {isUpdating ? (
                                                    <span className="text-[10px] font-bold text-primary-400 animate-pulse">Saving...</span>
                                                ) : (
                                                    <span className="text-[10px] font-bold text-emerald-500">Active</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button onClick={handleSaveUser} disabled={isUpdating} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors">
                                                        <MdSave size={18} />
                                                    </button>
                                                    <button onClick={handleCancelEditUser} disabled={isUpdating} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                                                        <MdClose size={18} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                }

                                return (
                                    <tr key={user._id} className="hover:bg-primary-50/20 transition-colors group">
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
                                        <td className="px-6 py-4">
                                            {isUpdating ? (
                                                <span className="text-[10px] font-bold text-primary-400 animate-pulse">Updating...</span>
                                            ) : (
                                                <span className="text-[10px] font-bold text-emerald-500">Active</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button 
                                                    onClick={() => handleStartEditUser(user)}
                                                    disabled={isUpdating}
                                                    className="p-1.5 text-primary-600 hover:bg-primary-50 rounded-lg disabled:opacity-50 transition-colors"
                                                    title="Edit User"
                                                >
                                                    <MdEdit size={16} />
                                                </button>
                                                {!isMe && (
                                                    <button 
                                                        onClick={() => handleDeleteUser(user._id)}
                                                        disabled={isUpdating}
                                                        className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg disabled:opacity-50 transition-colors"
                                                        title="Delete User"
                                                    >
                                                        <MdDelete size={16} />
                                                    </button>
                                                )}
                                            </div>
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
