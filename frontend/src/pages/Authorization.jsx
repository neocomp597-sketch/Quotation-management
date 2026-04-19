import React, { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { MdLock, MdRefresh, MdTune, MdPeople } from 'react-icons/md';
import { authorizationService, userService } from '../services/api';
import { ROLE_LABELS } from '../constants/menuPermissions';
import { useAuth } from '../context/AuthContext';

const Authorization = () => {
    const { user: currentUser } = useAuth();
    const [roles, setRoles] = useState([]);
    const [menuGroups, setMenuGroups] = useState([]);
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [usersLoading, setUsersLoading] = useState(true);
    const [savingRoles, setSavingRoles] = useState({});
    const [statusByRole, setStatusByRole] = useState({});
    const [updatingUserId, setUpdatingUserId] = useState('');
    const existingAdmin = users.find((user) => user.role === 'admin');

    const fetchAuthorizationMatrix = async () => {
        try {
            const res = await authorizationService.getAll();
            setRoles(res.data.roles || []);
            setMenuGroups(res.data.menuGroups || []);
        } catch (error) {
            console.error('Failed to load authorization matrix:', error);
            toast.error('Failed to load authorization settings');
        }
    };

    const fetchUsers = async () => {
        setUsersLoading(true);
        try {
            const res = await userService.getAll();
            setUsers(res.data || []);
        } catch (error) {
            console.error('Failed to load users:', error);
            toast.error('Failed to load users');
        } finally {
            setUsersLoading(false);
        }
    };

    useEffect(() => {
        const loadAdminData = async () => {
            setLoading(true);
            await Promise.all([fetchAuthorizationMatrix(), fetchUsers()]);
            setLoading(false);
        };

        loadAdminData();
    }, []);

    const handleToggle = async (roleKey, permissionKey) => {
        const roleToSave = roles.find((role) => role.role === roleKey);

        if (!roleToSave || roleToSave.locked || savingRoles[roleKey]) {
            return;
        }

        const nextPermissions = {
            ...roleToSave.permissions,
            [permissionKey]: !roleToSave.permissions?.[permissionKey]
        };

        setRoles((prevRoles) =>
            prevRoles.map((role) =>
                role.role === roleKey
                    ? { ...role, permissions: nextPermissions }
                    : role
            )
        );
        setSavingRoles((prev) => ({ ...prev, [roleKey]: true }));
        setStatusByRole((prev) => ({ ...prev, [roleKey]: 'saving' }));

        try {
            const res = await authorizationService.update(roleKey, nextPermissions);
            const savedPermissions = res.data?.permissions || nextPermissions;
            setRoles((prevRoles) =>
                prevRoles.map((role) =>
                    role.role === roleKey
                        ? { ...role, ...res.data, permissions: savedPermissions }
                        : role
                )
            );
            setStatusByRole((prev) => ({ ...prev, [roleKey]: 'saved' }));
            toast.success(`${ROLE_LABELS[roleKey] || roleKey} permissions updated`);
        } catch (error) {
            console.error('Failed to update permissions:', error);
            setRoles((prevRoles) =>
                prevRoles.map((role) =>
                    role.role === roleKey
                        ? { ...role, permissions: roleToSave.permissions }
                        : role
                )
            );
            setStatusByRole((prev) => ({ ...prev, [roleKey]: 'error' }));
            toast.error(error.response?.data?.message || 'Failed to update permissions');
        } finally {
            setSavingRoles((prev) => ({ ...prev, [roleKey]: false }));
        }
    };

    const handleUserRoleChange = async (userId, nextRole) => {
        setUpdatingUserId(userId);

        try {
            const res = await userService.updateRole(userId, nextRole);
            setUsers((prevUsers) =>
                prevUsers.map((user) =>
                    user._id === userId ? res.data : user
                )
            );
            toast.success(`${res.data.name}'s role updated to ${ROLE_LABELS[nextRole] || nextRole}`);
        } catch (error) {
            console.error('Failed to update user role:', error);
            toast.error(error.response?.data?.message || 'Failed to update user role');
        } finally {
            setUpdatingUserId('');
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                        <MdLock className="text-primary-600" />
                        Authorization
                    </h1>
                    <p className="text-slate-500 font-medium mt-1">
                        Control which sidebar groups are visible for each role.
                    </p>
                    <p className="text-sm text-slate-400 font-semibold mt-2">
                        Changes save immediately when you toggle a permission.
                    </p>
                </div>

                <button
                    onClick={() => {
                        setLoading(true);
                        void Promise.all([fetchAuthorizationMatrix(), fetchUsers()]).finally(() => setLoading(false));
                    }}
                    className="inline-flex items-center justify-center gap-2 px-4 py-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                >
                    <MdRefresh size={18} />
                    Refresh
                </button>
            </div>

            {loading ? (
                <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 p-12 text-center">
                    <div className="animate-spin border-4 border-slate-200 border-t-primary-600 rounded-full h-10 w-10 mx-auto"></div>
                </div>
            ) : (
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                    {roles.map((role) => (
                        <section key={role.role} className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
                            <div className="p-6 border-b border-slate-100 bg-slate-50/70">
                                <div className="flex items-center justify-between gap-3">
                                    <div>
                                        <h2 className="text-xl font-black text-slate-900">{ROLE_LABELS[role.role] || role.label}</h2>
                                        <p className="text-sm text-slate-500 font-medium mt-1">
                                            {role.locked ? 'Full system access is enforced for admins.' : 'Toggle menu groups for this role. Changes save automatically.'}
                                        </p>
                                    </div>
                                    <span className={`px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-widest ${role.locked ? 'bg-slate-900 text-white' : savingRoles[role.role] ? 'bg-amber-50 text-amber-700' : statusByRole[role.role] === 'saved' ? 'bg-emerald-50 text-emerald-700' : 'bg-primary-50 text-primary-700'}`}>
                                        {role.locked ? 'Locked' : savingRoles[role.role] ? 'Saving' : statusByRole[role.role] === 'saved' ? 'Saved' : 'Auto Save'}
                                    </span>
                                </div>
                            </div>

                            <div className="p-6 space-y-3">
                                {menuGroups.map((group) => {
                                    const enabled = Boolean(role.permissions?.[group.key]);

                                    return (
                                        <div
                                            key={`${role.role}-${group.key}`}
                                            className={`flex items-start justify-between gap-4 p-4 rounded-2xl border transition-colors ${enabled ? 'border-primary-100 bg-primary-50/40' : 'border-slate-100 bg-white'}`}
                                        >
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-slate-900">{group.label}</span>
                                                    {group.key === 'admin' && (
                                                        <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[10px] font-black uppercase tracking-widest">
                                                            Admin
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-sm text-slate-500 mt-1">{group.description}</p>
                                            </div>

                                            <label className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${enabled ? 'bg-primary-600' : 'bg-slate-200'} ${role.locked || savingRoles[role.role] ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}>
                                                <input
                                                    type="checkbox"
                                                    className="sr-only"
                                                    checked={enabled}
                                                    disabled={role.locked || savingRoles[role.role]}
                                                    onChange={() => {
                                                        void handleToggle(role.role, group.key);
                                                    }}
                                                />
                                                <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                                            </label>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="px-6 pb-6">
                                {role.locked ? (
                                    <div className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-slate-50 text-slate-500 text-sm font-semibold">
                                        <MdTune size={18} />
                                        Admin access remains fully enabled.
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-slate-50 text-slate-500 text-sm font-semibold">
                                        <MdTune size={18} />
                                        {savingRoles[role.role]
                                            ? 'Saving updated permissions...'
                                            : statusByRole[role.role] === 'saved'
                                                ? 'Latest permission change saved.'
                                                : 'Toggle any switch to save instantly.'}
                                    </div>
                                )}
                            </div>
                        </section>
                    ))}
                </div>
            )}

            <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
                <div className="p-6 border-b border-slate-100 bg-slate-50/70">
                    <div className="flex items-center gap-3">
                        <MdPeople className="text-primary-600" size={24} />
                        <div>
                            <h2 className="text-2xl font-black text-slate-900">User Role Assignment</h2>
                            <p className="text-slate-500 font-medium mt-1">
                                Assign application roles to users from the admin section.
                            </p>
                            <p className="text-sm text-slate-400 font-semibold mt-2">
                                Only one admin is allowed per organization.
                            </p>
                        </div>
                    </div>
                </div>

                {usersLoading ? (
                    <div className="p-10 text-center text-slate-400 font-bold">Loading users...</div>
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
                                    const isCurrentUser = currentUser?.id === user._id;
                                    const isUpdatingThisUser = updatingUserId === user._id;

                                    return (
                                        <tr key={user._id} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="px-6 py-4">
                                                <div>
                                                    <p className="font-bold text-slate-900">{user.name}</p>
                                                    {isCurrentUser && (
                                                        <span className="inline-flex mt-2 px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[10px] font-black uppercase tracking-widest">
                                                            Current User
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-slate-600 font-medium">{user.email}</td>
                                            <td className="px-6 py-4">
                                                <span className={`px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-widest ${user.role === 'admin' ? 'bg-slate-900 text-white' : user.role === 'manager' ? 'bg-amber-50 text-amber-700' : 'bg-primary-50 text-primary-700'}`}>
                                                    {ROLE_LABELS[user.role] || user.role}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <select
                                                    value={user.role}
                                                    disabled={isCurrentUser || isUpdatingThisUser}
                                                    onChange={(e) => {
                                                        void handleUserRoleChange(user._id, e.target.value);
                                                    }}
                                                    className="px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-primary-500 bg-white disabled:opacity-60 disabled:cursor-not-allowed"
                                                >
                                                    <option
                                                        value="admin"
                                                        disabled={Boolean(existingAdmin && existingAdmin._id !== user._id)}
                                                    >
                                                        Admin
                                                    </option>
                                                    <option value="manager">Manager</option>
                                                    <option value="sales">Sales</option>
                                                </select>
                                            </td>
                                            <td className="px-6 py-4 text-sm font-semibold text-slate-500">
                                                {isCurrentUser
                                                    ? 'Self role change disabled'
                                                    : isUpdatingThisUser
                                                        ? 'Updating role...'
                                                        : 'Ready'}
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
