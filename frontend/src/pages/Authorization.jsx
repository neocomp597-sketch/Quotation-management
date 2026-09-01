import React, { useEffect, useState } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
    MdLock, MdRefresh, MdPeople,
    MdShield, MdExpandMore, MdExpandLess, MdAdd, MdDelete, MdSave, MdEdit, MdClose,
    MdBusiness, MdStorefront, MdKey, MdCheckCircle, MdTune, MdVpnKey, MdSearch
} from 'react-icons/md';
import { authorizationService, userService, superAdminService, vendorService } from '../services/api';
import { ROLE_LABELS as BUILTIN_ROLE_LABELS, MENU_PERMISSION_GROUPS } from '../constants/menuPermissions';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';

const childKeysFor = (group) => Array.from(new Set((group.children || []).map((child) => child.key)));

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
    const { user: currentUser, isAdmin, isSuperAdmin, refreshSession } = useAuth();

    const [activeTab, setActiveTab] = useState('roles'); // 'roles' | 'team' | 'vendors'
    const [roles, setRoles] = useState([]);
    const [menuGroups, setMenuGroups] = useState([]);
    const [users, setUsers] = useState([]);
    const [vendors, setVendors] = useState([]);
    const [userSearch, setUserSearch] = useState('');
    
    const [loading, setLoading] = useState(true);
    const [usersLoading, setUsersLoading] = useState(true);
    const [vendorsLoading, setVendorsLoading] = useState(false);

    const [savingRoles, setSavingRoles] = useState({});
    const [resettingRoles, setResettingRoles] = useState({});
    const [statusByRole, setStatusByRole] = useState({});
    const [updatingUserId, setUpdatingUserId] = useState('');
    
    // Accordion state
    const [expandedRoles, setExpandedRoles] = useState({});
    const [expandedGroups, setExpandedGroups] = useState({});
    const [expandedUserCards, setExpandedUserCards] = useState({});

    // New Role Form
    const [showNewRoleForm, setShowNewRoleForm] = useState(false);
    const [newRoleData, setNewRoleData] = useState({ label: '', description: '' });
    const [creatingRole, setCreatingRole] = useState(false);

    // New Team User Form
    const [showNewUserForm, setShowNewUserForm] = useState(false);
    const [newUserData, setNewUserData] = useState({ name: '', email: '', password: '', role: 'sales', reportsTo: '' });
    const [creatingUser, setCreatingUser] = useState(false);

    // New Vendor Login User Form
    const [showNewVendorUserForm, setShowNewVendorUserForm] = useState(false);
    const [newVendorUserData, setNewVendorUserData] = useState({ name: '', email: '', password: '', vendorId: '' });
    const [creatingVendorUser, setCreatingVendorUser] = useState(false);
    
    // Edit User Modal/Row
    const [editingUserId, setEditingUserId] = useState(null);
    const [editingUserData, setEditingUserData] = useState({ name: '', email: '', password: '', role: '', reportsTo: '', vendorId: '' });

    // Password Update Modal
    const [passwordModalUser, setPasswordModalUser] = useState(null);
    const [newPasswordValue, setNewPasswordValue] = useState('');
    const [confirmPasswordValue, setConfirmPasswordValue] = useState('');
    const [updatingPassword, setUpdatingPassword] = useState(false);

    // Super Admin Company Selector
    const [companies, setCompanies] = useState([]);
    const [selectedCompanyId, setSelectedCompanyId] = useState('');
    const [companiesLoading, setCompaniesLoading] = useState(false);

    const fetchMatrix = async (companyId = selectedCompanyId) => {
        try {
            const params = companyId ? { companyId } : {};
            const res = await authorizationService.getAll(params);
            setRoles(res.data.roles || []);
            setMenuGroups(res.data.menuGroups || []);
        } catch (err) {
            toast.error('Error loading permissions');
        }
    };

    const fetchUsers = async (companyId = selectedCompanyId) => {
        setUsersLoading(true);
        try {
            const params = companyId ? { companyId } : {};
            const res = await userService.getAll(params);
            setUsers(res.data || []);
        } catch (err) {
            toast.error('Error loading users');
        } finally {
            setUsersLoading(false);
        }
    };

    const fetchVendors = async () => {
        setVendorsLoading(true);
        try {
            const res = await vendorService.getAll();
            setVendors(res.data?.vendors || res.data || []);
        } catch (err) {
            console.warn("Error fetching vendors list:", err);
        } finally {
            setVendorsLoading(false);
        }
    };

    // Load company list if super admin
    useEffect(() => {
        if (!isSuperAdmin) return;
        (async () => {
            setCompaniesLoading(true);
            try {
                const res = await superAdminService.getCompanies();
                const list = res.data || [];
                setCompanies(list);
                if (list.length > 0) {
                    setSelectedCompanyId(list[0]._id);
                }
            } catch (err) {
                toast.error('Failed to load company list');
            } finally {
                setCompaniesLoading(false);
            }
        })();
    }, [isSuperAdmin]);

    // Load matrix, users, and vendors
    useEffect(() => {
        if (!isAdmin && !isSuperAdmin) return;
        if (isSuperAdmin && !selectedCompanyId) return;

        (async () => {
            setLoading(true);
            const params = selectedCompanyId ? { companyId: selectedCompanyId } : {};
            await authorizationService.initialize(params).catch(() => null);
            await Promise.all([
                fetchMatrix(selectedCompanyId), 
                fetchUsers(selectedCompanyId),
                fetchVendors()
            ]);
            setLoading(false);
        })();
    }, [isAdmin, isSuperAdmin, selectedCompanyId]);

    if (!isAdmin && !isSuperAdmin) return <Navigate to="/dashboard" replace />;

    const displayGroups = MENU_PERMISSION_GROUPS;

    // Filter Team Users (Internal company staff only) vs Vendor Login Users
    const teamUsers = users.filter((u) => u.role !== 'vendor' && !u.vendorId);
    const vendorUsers = users.filter((u) => u.role === 'vendor' || Boolean(u.vendorId));

    const filteredTeamUsers = teamUsers.filter((u) => {
        if (!userSearch.trim()) return true;
        const q = userSearch.toLowerCase().trim();
        return (
            (u.name && u.name.toLowerCase().includes(q)) ||
            (u.email && u.email.toLowerCase().includes(q)) ||
            (u.role && u.role.toLowerCase().includes(q)) ||
            (u.department && u.department.toLowerCase().includes(q)) ||
            (u.designation && u.designation.toLowerCase().includes(q))
        );
    });

    // Calculate total count of granular permission items
    const totalPermissionItemsCount = displayGroups.reduce((count, group) => {
        const childKeys = childKeysFor(group);
        return count + (childKeys.length ? childKeys.length : 1);
    }, 0);

    // Calculate enabled count for a permissions object
    const enabledCount = (perms = {}) => displayGroups.reduce((count, group) => {
        const childKeys = childKeysFor(group);
        if (!childKeys.length) return count + (perms[group.key] ? 1 : 0);
        return count + childKeys.filter((key) => perms[key]).length;
    }, 0);

    // Compute effective permissions for a user (base role perms + custom user perms)
    const getEffectiveUserPermissions = (user) => {
        const roleObj = roles.find((r) => r.role === user.role);
        const rolePerms = roleObj?.permissions || {};
        const userCustom = user.customPermissions || {};
        return { ...rolePerms, ...userCustom };
    };

    const handleRefresh = async () => {
        setLoading(true);
        await Promise.all([
            fetchMatrix(selectedCompanyId), 
            fetchUsers(selectedCompanyId),
            fetchVendors()
        ]).finally(() => setLoading(false));
    };

    // Accordion Toggles
    const toggleRoleAccordion = (roleKey) => {
        setExpandedRoles((prev) => ({ ...prev, [roleKey]: !prev[roleKey] }));
    };

    const toggleUserCardAccordion = (userId) => {
        setExpandedUserCards((prev) => ({ ...prev, [userId]: !prev[userId] }));
    };

    const toggleGroupAccordion = (scopeKey, groupKey) => {
        const key = `${scopeKey}-${groupKey}`;
        setExpandedGroups((prev) => ({ ...prev, [key]: !(prev[key] ?? false) }));
    };

    const isGroupExpanded = (scopeKey, groupKey) => {
        const key = `${scopeKey}-${groupKey}`;
        return expandedGroups[key] ?? false;
    };

    // Toggle Role Permission
    const handleToggleRolePermission = async (roleKey, permKey, group) => {
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
            const params = selectedCompanyId ? { companyId: selectedCompanyId } : {};
            const res = await authorizationService.update(roleKey, next, params);
            const saved = res.data?.permissions || next;
            setRoles((prev) => prev.map((r) => r.role === roleKey ? { ...r, permissions: saved } : r));
            setStatusByRole((prev) => ({ ...prev, [roleKey]: 'saved' }));
            if (roleKey === currentUser?.role || (roleKey === 'admin' && isAdmin)) {
                await refreshSession();
            }
        } catch (err) {
            setRoles((prev) => prev.map((r) => r.role === roleKey ? { ...r, permissions: roleObj.permissions } : r));
            setStatusByRole((prev) => ({ ...prev, [roleKey]: 'error' }));
            toast.error('Failed to save changes');
        } finally {
            setSavingRoles((prev) => ({ ...prev, [roleKey]: false }));
        }
    };

    // Toggle Individual User Permission
    const handleToggleUserPermission = async (userId, permKey, group) => {
        const user = users.find((u) => u._id === userId);
        if (!user || updatingUserId === userId) return;

        const roleObj = roles.find((r) => r.role === user.role);
        const rolePerms = roleObj?.permissions || {};
        const currentEffective = getEffectiveUserPermissions(user);
        
        const targetGroup = group || displayGroups.find((item) => item.key === permKey || childKeysFor(item).includes(permKey));
        const childKeys = childKeysFor(targetGroup || {});
        const isParent = targetGroup?.key === permKey;

        const nextEffective = { ...currentEffective };

        if (isParent) {
            const currentAllOn = childKeys.length
                ? childKeys.every((key) => currentEffective[key])
                : Boolean(currentEffective[permKey]);
            const nextValue = !currentAllOn;
            nextEffective[permKey] = nextValue;
            childKeys.forEach((key) => {
                nextEffective[key] = nextValue;
            });
        } else {
            const nextValue = !currentEffective[permKey];
            nextEffective[permKey] = nextValue;
            if (targetGroup) {
                nextEffective[targetGroup.key] = childKeys.some((key) => key === permKey ? nextValue : Boolean(nextEffective[key]));
            }
        }

        // Store custom overrides that differ from the base role
        const newCustomPerms = {};
        Object.keys(nextEffective).forEach((key) => {
            if (nextEffective[key] !== rolePerms[key]) {
                newCustomPerms[key] = nextEffective[key];
            }
        });

        // Optimistically update local users state
        setUsers((prev) => prev.map((u) => u._id === userId ? { ...u, customPermissions: newCustomPerms } : u));
        setUpdatingUserId(userId);

        try {
            const params = selectedCompanyId ? { companyId: selectedCompanyId } : {};
            await userService.updatePermissions(userId, newCustomPerms, params);
            toast.success(`Updated permissions for ${user.name}`);
        } catch (err) {
            toast.error('Failed to update individual user permissions');
            fetchUsers(selectedCompanyId);
        } finally {
            setUpdatingUserId('');
        }
    };

    // Reset Individual User Permissions back to role defaults
    const handleResetUserPermissions = async (userId) => {
        const user = users.find((u) => u._id === userId);
        if (!user) return;
        setUpdatingUserId(userId);
        try {
            const params = selectedCompanyId ? { companyId: selectedCompanyId } : {};
            await userService.updatePermissions(userId, {}, params);
            setUsers((prev) => prev.map((u) => u._id === userId ? { ...u, customPermissions: {} } : u));
            toast.success(`Reset ${user.name}'s permissions to role default`);
        } catch (err) {
            toast.error('Failed to reset user permissions');
        } finally {
            setUpdatingUserId('');
        }
    };

    const handleResetRole = async (roleKey) => {
        const roleObj = roles.find((r) => r.role === roleKey);
        if (!roleObj || roleObj.locked || resettingRoles[roleKey]) return;

        const defaults = buildPermissionsFromEnabledSections(displayGroups, (roleKey === 'admin' ? MENU_PERMISSION_GROUPS.map(g => g.key) : roleKey === 'manager' ? ['dashboard', 'master', 'enquiry', 'sales_pipeline', 'quotation', 'sale', 'purchase', 'planning', 'reports', 'settings'] : ['dashboard', 'enquiry', 'sales_pipeline', 'quotation']));
        
        setResettingRoles((prev) => ({ ...prev, [roleKey]: true }));
        setStatusByRole((prev) => ({ ...prev, [roleKey]: 'saving' }));

        try {
            const params = selectedCompanyId ? { companyId: selectedCompanyId } : {};
            const res = await authorizationService.update(roleKey, defaults, params);
            setRoles((prev) => prev.map((r) => r.role === roleKey ? { ...r, permissions: res.data?.permissions || defaults } : r));
            setStatusByRole((prev) => ({ ...prev, [roleKey]: 'saved' }));
            if (roleKey === currentUser?.role || (roleKey === 'admin' && isAdmin)) {
                await refreshSession();
            }
            toast.success('Role permissions reset');
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
            const params = selectedCompanyId ? { companyId: selectedCompanyId } : {};
            const res = await userService.updateRole(userId, nextRole, params);
            setUsers((prev) => prev.map((u) => u._id === userId ? { ...u, ...res.data } : u));
            toast.success('User role updated');
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
            const params = selectedCompanyId ? { companyId: selectedCompanyId } : {};
            const res = await authorizationService.createRole(newRoleData.label, newRoleData.description, params);
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
            const params = selectedCompanyId ? { companyId: selectedCompanyId } : {};
            await authorizationService.deleteRole(roleKey, params);
            setRoles((prev) => prev.filter((r) => r.role !== roleKey));
            toast.success('Role deleted');
        } catch (err) {
            toast.error('Failed to delete');
        }
    };

    // Create Internal Team User
    const handleCreateUser = async (e) => {
        e.preventDefault();
        if (!newUserData.name.trim() || !newUserData.email.trim() || !newUserData.password.trim()) return;

        setCreatingUser(true);
        try {
            const payload = {
                name: newUserData.name.trim(),
                email: newUserData.email.trim(),
                password: newUserData.password,
                role: newUserData.role || 'sales',
                reportsTo: newUserData.reportsTo || null,
            };
            if (selectedCompanyId) {
                payload.companyId = selectedCompanyId;
            }
            const res = await userService.create(payload);

            setUsers((prev) => [res.data, ...prev]);
            setNewUserData({ name: '', email: '', password: '', role: 'sales', reportsTo: '' });
            setShowNewUserForm(false);
            toast.success('Team User created successfully');
        } catch (err) {
            toast.error(err.response?.data?.message || 'Could not create user');
        } finally {
            setCreatingUser(false);
        }
    };

    // Create Vendor Login User
    const handleCreateVendorUser = async (e) => {
        e.preventDefault();
        if (!newVendorUserData.name.trim() || !newVendorUserData.email.trim() || !newVendorUserData.password.trim()) return;

        setCreatingVendorUser(true);
        try {
            const payload = {
                name: newVendorUserData.name.trim(),
                email: newVendorUserData.email.trim(),
                password: newVendorUserData.password,
                role: 'vendor',
                vendorId: newVendorUserData.vendorId || null,
            };
            if (selectedCompanyId) {
                payload.companyId = selectedCompanyId;
            }
            const res = await userService.create(payload);

            setUsers((prev) => [res.data, ...prev]);
            setNewVendorUserData({ name: '', email: '', password: '', vendorId: '' });
            setShowNewVendorUserForm(false);
            toast.success('Vendor login account created successfully');
        } catch (err) {
            toast.error(err.response?.data?.message || 'Could not create vendor login');
        } finally {
            setCreatingVendorUser(false);
        }
    };

    const handleStartEditUser = (u) => {
        setEditingUserId(u._id);
        setEditingUserData({
            name: u.name,
            email: u.email,
            password: '',
            role: u.role,
            reportsTo: u.reportsTo?._id || u.reportsTo || '',
            vendorId: u.vendorId?._id || u.vendorId || ''
        });
    };

    const handleCancelEditUser = () => {
        setEditingUserId(null);
        setEditingUserData({ name: '', email: '', password: '', role: '', reportsTo: '', vendorId: '' });
    };

    const handleUpdateUserPassword = async (e) => {
        if (e) e.preventDefault();
        if (!passwordModalUser) return;
        if (!newPasswordValue || newPasswordValue.length < 6) {
            toast.error('Password must be at least 6 characters');
            return;
        }
        if (newPasswordValue !== confirmPasswordValue) {
            toast.error('Passwords do not match');
            return;
        }
        try {
            setUpdatingPassword(true);
            const params = isSuperAdmin && selectedCompanyId ? { companyId: selectedCompanyId } : {};
            await userService.update(passwordModalUser._id, { password: newPasswordValue }, params);
            toast.success(`Password for ${passwordModalUser.name} updated successfully!`);
            setPasswordModalUser(null);
            setNewPasswordValue('');
            setConfirmPasswordValue('');
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to update password');
        } finally {
            setUpdatingPassword(false);
        }
    };

    const handleSaveUser = async () => {
        if (!editingUserData.name.trim() || !editingUserData.email.trim()) return;
        setUpdatingUserId(editingUserId);
        try {
            const data = { ...editingUserData };
            if (!data.password) delete data.password;
            
            const params = selectedCompanyId ? { companyId: selectedCompanyId } : {};
            const res = await userService.update(editingUserId, data, params);
            setUsers((prev) => prev.map((u) => u._id === editingUserId ? { ...u, ...res.data } : u));
            setEditingUserId(null);
            toast.success('User updated successfully');
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
            const params = selectedCompanyId ? { companyId: selectedCompanyId } : {};
            await userService.delete(userId, params);
            setUsers((prev) => prev.filter((u) => u._id !== userId));
            toast.success('User deleted successfully');
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to delete user');
        } finally {
            setUpdatingUserId('');
        }
    };

    const activeCompanyObj = companies.find((c) => c._id === selectedCompanyId);
    const activeCompanyName = activeCompanyObj ? (activeCompanyObj.companyName || activeCompanyObj.name) : '';

    return (
        <div className="max-w-[1400px] mx-auto space-y-8 pb-20">
            {/* Super Admin Company Selector Banner */}
            {isSuperAdmin && (
                <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-primary-600 flex items-center justify-center text-white shrink-0 animate-pulse">
                            <MdShield size={24} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-black uppercase tracking-widest text-primary-400">Platform Control</span>
                                <span className="bg-primary-600/30 text-primary-300 text-[10px] font-bold px-2 py-0.5 rounded-full">Super Admin Scoped</span>
                            </div>
                            <h2 className="text-lg font-black tracking-tight mt-0.5">Platform Scoped View</h2>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                        <span className="text-sm text-slate-400 font-bold flex items-center gap-1.5">
                            <MdBusiness size={18} />
                            Scope Company:
                        </span>
                        {companiesLoading ? (
                            <span className="text-xs text-slate-500">Loading companies...</span>
                        ) : (
                            <select
                                value={selectedCompanyId}
                                onChange={(e) => setSelectedCompanyId(e.target.value)}
                                className="bg-slate-800 text-white border border-slate-700 px-4 py-2.5 rounded-xl text-sm font-bold outline-none focus:border-primary-500 transition-colors cursor-pointer"
                            >
                                {companies.map((c) => (
                                    <option key={c._id} value={c._id}>
                                        {c.companyName || c.name}
                                    </option>
                                ))}
                            </select>
                        )}
                    </div>
                </div>
            )}

            {/* Main Navigation Header & Tab Switcher */}
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-slate-200 dark:border-slate-800 pb-6">
                <div>
                    <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight font-outfit uppercase">Authorization & User Management</h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 font-medium">
                        {isSuperAdmin && activeCompanyName 
                            ? `Configure permissions and managed accounts for ${activeCompanyName}.`
                            : 'Manage default role permissions, team individual user access, and vendor login accounts.'}
                    </p>
                </div>
                
                <div className="flex items-center gap-3">
                    <button onClick={handleRefresh} className="p-2.5 text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-xs">
                        <MdRefresh size={20} />
                    </button>
                    
                    {/* Navigation Tab Pills */}
                    <div className="flex bg-slate-100 dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800">
                        <button
                            onClick={() => setActiveTab('roles')}
                            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${activeTab === 'roles' ? 'bg-white dark:bg-slate-800 text-primary-700 dark:text-primary-300 shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
                        >
                            <MdShield size={16} /> Role Matrix
                        </button>
                        <button
                            onClick={() => setActiveTab('team')}
                            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${activeTab === 'team' ? 'bg-white dark:bg-slate-800 text-primary-700 dark:text-primary-300 shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
                        >
                            <MdPeople size={16} /> Team Users ({teamUsers.length})
                        </button>
                        <button
                            onClick={() => setActiveTab('vendors')}
                            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${activeTab === 'vendors' ? 'bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-400 shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
                        >
                            <MdStorefront size={16} /> Vendor Logins ({vendorUsers.length})
                        </button>
                    </div>
                </div>
            </header>

            {loading ? (
                <div className="py-20 text-center">
                    <div className="animate-spin w-8 h-8 border-2 border-slate-200 dark:border-slate-700 border-t-primary-600 rounded-full mx-auto" />
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-4">Loading Authorization Matrix...</p>
                </div>
            ) : (
                <>
                    {/* ========================================================================= */}
                    {/* TAB 1: ROLE MATRIX (Default Role Permissions with Accordions) */}
                    {/* ========================================================================= */}
                    {activeTab === 'roles' && (
                        <div className="space-y-6 animate-fade-in">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">Default Role Permissions</h2>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">Click any Role card or Permission Group to collapse/expand permission options.</p>
                                </div>
                                <button 
                                    onClick={() => setShowNewRoleForm(!showNewRoleForm)}
                                    className="flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-xl font-bold text-xs hover:bg-primary-700 transition-all shadow-xs"
                                >
                                    {showNewRoleForm ? 'Cancel' : <><MdAdd size={18} /> Add Custom Role</>}
                                </button>
                            </div>

                            {/* Add New Custom Role Form */}
                            {showNewRoleForm && (
                                <div className="bg-primary-50/30 dark:bg-slate-900 border border-primary-100 dark:border-slate-800 rounded-2xl p-6">
                                    <form onSubmit={handleCreateRole} className="flex flex-wrap gap-4 items-end">
                                        <div className="flex-1 min-w-[200px]">
                                            <label className="block text-xs font-bold text-primary-600 dark:text-primary-400 mb-1.5 ml-1">Role Name</label>
                                            <input 
                                                type="text" 
                                                required
                                                value={newRoleData.label}
                                                onChange={(e) => setNewRoleData({...newRoleData, label: e.target.value})}
                                                placeholder="e.g. Regional Manager"
                                                className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-primary-100 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-primary-600 transition-colors"
                                            />
                                        </div>
                                        <div className="flex-[2] min-w-[300px]">
                                            <label className="block text-xs font-bold text-primary-600 dark:text-primary-400 mb-1.5 ml-1">Description</label>
                                            <input 
                                                type="text" 
                                                value={newRoleData.description}
                                                onChange={(e) => setNewRoleData({...newRoleData, description: e.target.value})}
                                                placeholder="Optional description..."
                                                className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-primary-100 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-primary-600 transition-colors"
                                            />
                                        </div>
                                        <button 
                                            type="submit" 
                                            disabled={creatingRole || !newRoleData.label.trim()}
                                            className="px-6 py-2.5 bg-primary-600 text-white rounded-xl font-bold text-sm hover:bg-primary-700 disabled:opacity-50 transition-colors shadow-xs"
                                        >
                                            {creatingRole ? 'Saving...' : 'Save Role'}
                                        </button>
                                    </form>
                                </div>
                            )}

                            {/* Collapsible Role Cards Grid */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-6 items-start">
                                {roles.map((role) => {
                                    const busy = savingRoles[role.role] || resettingRoles[role.role];
                                    const status = statusByRole[role.role];
                                    const isExpanded = expandedRoles[role.role] ?? true; // Default open
                                    const currentEnabled = enabledCount(role.permissions);

                                    return (
                                        <section key={role.role} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs transition-all hover:shadow-md">
                                            {/* Role Header Accordion Switch */}
                                            <div 
                                                onClick={() => toggleRoleAccordion(role.role)}
                                                className={`p-5 flex items-center justify-between cursor-pointer bg-slate-50/50 dark:bg-slate-800/50 hover:bg-slate-100/50 dark:hover:bg-slate-800/80 transition-colors ${isExpanded ? 'border-b border-slate-100 dark:border-slate-800' : ''}`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className={`p-1.5 rounded-lg text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-transform duration-200 ${isExpanded ? 'rotate-0' : '-rotate-90'}`}>
                                                        <MdExpandMore size={20} />
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <h3 className="text-base font-black text-slate-900 dark:text-white">{role.label}</h3>
                                                            {role.locked && <MdLock className="text-slate-400 dark:text-slate-500" size={14} title="Standard System Role" />}
                                                            {busy && <span className="text-[10px] text-primary-600 dark:text-primary-400 font-bold animate-pulse ml-1">Saving...</span>}
                                                            {status === 'saved' && <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold ml-1">Saved</span>}
                                                        </div>
                                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{role.description || 'System permission profile.'}</p>
                                                    </div>
                                                </div>
                                                <div className="text-right shrink-0">
                                                    <span className="text-xs font-black text-primary-600 dark:text-primary-300 bg-primary-50 dark:bg-primary-950/60 px-2 py-1 rounded-lg border border-primary-100 dark:border-primary-800">
                                                        {currentEnabled} / {totalPermissionItemsCount} items
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Role Card Body - Collapsible Accordion */}
                                            {isExpanded && (
                                                <div className="p-6 space-y-4 animate-fade-in">
                                                    {displayGroups.map((group) => {
                                                        const children = group.children || [];
                                                        const childKeys = childKeysFor(group);
                                                        const enabledChildrenCount = childKeys.filter((key) => role.permissions?.[key]).length;
                                                        const hasPartialAccess = childKeys.length ? enabledChildrenCount > 0 : Boolean(role.permissions?.[group.key]);
                                                        const hasFullAccess = childKeys.length ? enabledChildrenCount === childKeys.length : hasPartialAccess;
                                                        const expandedGroup = isGroupExpanded(role.role, group.key);

                                                        return (
                                                            <div key={`${role.role}-${group.key}`} className="space-y-2 border-b border-slate-50 dark:border-slate-800/60 pb-3 last:border-0 last:pb-0">
                                                                <div className="flex items-center justify-between group">
                                                                    <button 
                                                                        type="button"
                                                                        onClick={() => toggleGroupAccordion(role.role, group.key)}
                                                                        className="flex items-center gap-2 text-left hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                                                                    >
                                                                        <div className={`transition-transform duration-200 ${expandedGroup ? 'rotate-0' : '-rotate-90'}`}>
                                                                            <MdExpandMore size={18} className={hasPartialAccess ? "text-primary-600 dark:text-primary-400" : "text-slate-300 dark:text-slate-600"} />
                                                                        </div>
                                                                        <span className={`text-xs font-bold transition-colors ${hasPartialAccess ? 'text-slate-900 dark:text-slate-100' : 'text-slate-400 dark:text-slate-500'}`}>
                                                                            {group.label}
                                                                        </span>
                                                                        {children.length > 0 && (
                                                                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${hasPartialAccess ? 'bg-primary-50 dark:bg-primary-950/60 text-primary-700 dark:text-primary-300' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500'}`}>
                                                                                {enabledChildrenCount} / {children.length}
                                                                            </span>
                                                                        )}
                                                                    </button>

                                                                    {/* Toggle Group Switch */}
                                                                    <div className="flex items-center">
                                                                        <label className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${hasFullAccess ? 'bg-primary-600' : 'bg-slate-200 dark:bg-slate-700'} ${role.locked || busy ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}`}>
                                                                            <input 
                                                                                type="checkbox" 
                                                                                className="sr-only" 
                                                                                checked={hasFullAccess} 
                                                                                disabled={role.locked || busy} 
                                                                                onChange={() => handleToggleRolePermission(role.role, group.key, group)} 
                                                                            />
                                                                            <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${hasFullAccess ? 'translate-x-5' : 'translate-x-0.5'}`} />
                                                                        </label>
                                                                    </div>
                                                                </div>

                                                                {/* Expanded Child Permissions */}
                                                                {expandedGroup && children.length > 0 && (
                                                                    <div className="ml-6 space-y-2 border-l-2 border-slate-100 dark:border-slate-800 pl-4 py-1.5 animate-fade-in">
                                                                        {children.map((child) => {
                                                                            const childOn = Boolean(role.permissions?.[child.key]);
                                                                            return (
                                                                                <div key={`${role.role}-${child.key}`} className="flex items-center justify-between">
                                                                                    <span className={`text-xs font-medium ${childOn ? 'text-slate-800 dark:text-slate-200' : 'text-slate-400 dark:text-slate-500'}`}>
                                                                                        ↳ {child.label}
                                                                                    </span>
                                                                                    <label className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${childOn ? 'bg-primary-600' : 'bg-slate-200 dark:bg-slate-700'} ${role.locked || busy ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}`}>
                                                                                        <input 
                                                                                            type="checkbox" 
                                                                                            className="sr-only" 
                                                                                            checked={childOn} 
                                                                                            disabled={role.locked || busy} 
                                                                                            onChange={() => handleToggleRolePermission(role.role, child.key, group)} 
                                                                                        />
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
                                            )}

                                            {/* Role Footer - Rendered only when expanded */}
                                            {isExpanded && (
                                                <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex gap-2">
                                                    {!role.locked && (
                                                        <>
                                                            <button 
                                                                onClick={() => handleResetRole(role.role)}
                                                                className="flex-1 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold hover:bg-primary-50 dark:hover:bg-slate-700 hover:text-primary-600 dark:hover:text-primary-400 transition-all shadow-xs"
                                                            >
                                                                Reset Role Defaults
                                                            </button>
                                                            {role.isCustom && (
                                                                <button 
                                                                    onClick={() => handleDeleteRole(role.role)}
                                                                    className="px-3 py-2 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-slate-200 dark:border-slate-700 rounded-xl transition-all"
                                                                    title="Delete Role"
                                                                >
                                                                    <MdDelete size={18} />
                                                                </button>
                                                            )}
                                                        </>
                                                    )}
                                                    {role.locked && (
                                                        <div className="flex-1 py-2 text-center text-slate-400 dark:text-slate-500 text-xs font-bold">
                                                            Built-in Standard Role
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </section>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* ========================================================================= */}
                    {/* TAB 2: TEAM USERS & INDIVIDUAL PERMISSIONS (Internal Users Only) */}
                    {/* ========================================================================= */}
                    {activeTab === 'team' && (
                        <div className="space-y-6 animate-fade-in">
                            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
                                <div className="p-6 border-b border-slate-100 dark:border-slate-800">
                                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">Team Users & Custom Permissions</h2>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                        Employees are managed through <Link to="/payroll/employees" className="text-primary-600 font-bold hover:underline">Employee Master</Link>. Search an employee below to view or edit individual authorization permissions.
                                    </p>
                                </div>

                                {/* Employee Search Bar */}
                                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    <div className="relative flex-1">
                                        <MdSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                        <input
                                            type="text"
                                            value={userSearch}
                                            onChange={(e) => setUserSearch(e.target.value)}
                                            placeholder="Search Employee by name, email, role, department or designation..."
                                            className="w-full pl-10 pr-10 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200 outline-none focus:border-primary-600 transition-colors"
                                        />
                                        {userSearch && (
                                            <button
                                                onClick={() => setUserSearch('')}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                            >
                                                <MdClose size={16} />
                                            </button>
                                        )}
                                    </div>
                                    <div className="text-xs font-bold text-slate-500 dark:text-slate-400 shrink-0">
                                        Showing {filteredTeamUsers.length} of {teamUsers.length} employees
                                    </div>
                                </div>

                                {/* Users Table with Expandable Individual Permissions Accordion */}
                                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {filteredTeamUsers.length === 0 ? (
                                        <div className="p-12 text-center text-slate-400 dark:text-slate-500 text-xs font-bold">
                                            {userSearch ? `No employees found matching "${userSearch}".` : 'No team users found. Create employees in Employee Master first.'}
                                        </div>
                                    ) : (
                                        filteredTeamUsers.map((user) => {
                                        const isMe = currentUser?.id === user._id;
                                        const isUpdating = updatingUserId === user._id;
                                        const isEditing = editingUserId === user._id;
                                        const isUserExpanded = expandedUserCards[user._id] ?? false;

                                        const effectivePerms = getEffectiveUserPermissions(user);
                                        const userEnabledCount = enabledCount(effectivePerms);
                                        const hasCustomOverrides = Object.keys(user.customPermissions || {}).length > 0;

                                        if (isEditing) {
                                            return (
                                                <div key={user._id} className="p-6 bg-primary-50/40 dark:bg-slate-800/80 grid grid-cols-1 md:grid-cols-5 gap-4 items-center">
                                                    <div>
                                                        <label className="block text-[10px] font-bold uppercase text-primary-600 dark:text-primary-400 mb-1">Name</label>
                                                        <input
                                                            type="text"
                                                            value={editingUserData.name}
                                                            onChange={(e) => setEditingUserData(prev => ({...prev, name: e.target.value}))}
                                                            className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-primary-200 dark:border-slate-700 rounded-lg text-sm font-bold text-slate-900 dark:text-slate-100 outline-none focus:border-primary-500"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-[10px] font-bold uppercase text-primary-600 dark:text-primary-400 mb-1">Email</label>
                                                        <input
                                                            type="email"
                                                            value={editingUserData.email}
                                                            onChange={(e) => setEditingUserData(prev => ({...prev, email: e.target.value}))}
                                                            className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-primary-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-primary-500"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-[10px] font-bold uppercase text-primary-600 dark:text-primary-400 mb-1">New Password (optional)</label>
                                                        <input
                                                            type="password"
                                                            placeholder="New password..."
                                                            value={editingUserData.password || ''}
                                                            onChange={(e) => setEditingUserData(prev => ({...prev, password: e.target.value}))}
                                                            className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-primary-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-primary-500"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-[10px] font-bold uppercase text-primary-600 dark:text-primary-400 mb-1">Role</label>
                                                        <select 
                                                            value={editingUserData.role} 
                                                            disabled={isMe || isUpdating}
                                                            onChange={(e) => setEditingUserData(prev => ({...prev, role: e.target.value}))}
                                                            className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-primary-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-900 dark:text-slate-100 outline-none focus:border-primary-500 disabled:opacity-50 cursor-pointer"
                                                        >
                                                            {roles.map(r => (
                                                                <option key={r.role} value={r.role}>{r.label}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                    <div className="flex items-center justify-end gap-2 pt-4 md:pt-0">
                                                        <button onClick={handleSaveUser} disabled={isUpdating} className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 hover:bg-emerald-700">
                                                            <MdSave size={16} /> Save
                                                        </button>
                                                        <button onClick={handleCancelEditUser} disabled={isUpdating} className="px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-lg font-bold text-xs hover:bg-slate-50 dark:hover:bg-slate-700">
                                                            Cancel
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        }

                                        return (
                                            <div key={user._id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                                                {/* User Summary Row */}
                                                <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-10 h-10 rounded-2xl bg-primary-100 dark:bg-primary-950/80 text-primary-700 dark:text-primary-300 font-black flex items-center justify-center text-sm shrink-0">
                                                            {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                                                        </div>
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-sm font-bold text-slate-900 dark:text-white">{user.name}</span>
                                                                {isMe && <span className="text-[10px] font-bold bg-primary-100 dark:bg-primary-950 text-primary-700 dark:text-primary-300 px-2 py-0.5 rounded-full">You</span>}
                                                                {hasCustomOverrides && (
                                                                    <span className="text-[10px] font-bold bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 px-2 py-0.5 rounded-full flex items-center gap-1" title="User has custom permission overrides">
                                                                        <MdTune size={12} /> Custom Perms
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <p className="text-xs text-slate-500 dark:text-slate-400">{user.email}</p>
                                                        </div>
                                                    </div>

                                                    <div className="flex flex-wrap items-center gap-4">
                                                        {/* Role Dropdown */}
                                                        <div>
                                                            <select 
                                                                value={user.role} 
                                                                disabled={isMe || isUpdating}
                                                                onChange={(e) => handleUserRoleChange(user._id, e.target.value)}
                                                                className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 outline-none focus:border-primary-600 disabled:opacity-50 transition-colors cursor-pointer"
                                                            >
                                                                {roles.map(r => (
                                                                    <option key={r.role} value={r.role}>{r.label}</option>
                                                                ))}
                                                            </select>
                                                        </div>

                                                        {/* Permissions Count Badge */}
                                                        <div className="text-right">
                                                            <span className="text-xs font-black text-primary-700 dark:text-primary-300 bg-primary-50 dark:bg-primary-950/60 px-2.5 py-1 rounded-xl border border-primary-100 dark:border-primary-800">
                                                                {userEnabledCount} / {totalPermissionItemsCount} items
                                                            </span>
                                                        </div>

                                                        {/* Accordion Expand Button */}
                                                        <button
                                                            onClick={() => toggleUserCardAccordion(user._id)}
                                                            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 ${isUserExpanded ? 'bg-primary-600 text-white border-primary-600 shadow-xs' : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                                                        >
                                                            <span>Individual Permissions</span>
                                                            <div className={`transition-transform duration-200 ${isUserExpanded ? 'rotate-180' : 'rotate-0'}`}>
                                                                <MdExpandMore size={16} />
                                                            </div>
                                                        </button>

                                                        {/* Actions */}
                                                        <div className="flex items-center gap-1">
                                                            <button 
                                                                onClick={() => {
                                                                    setPasswordModalUser(user);
                                                                    setNewPasswordValue('');
                                                                    setConfirmPasswordValue('');
                                                                }}
                                                                disabled={isUpdating}
                                                                className="p-2 text-slate-500 dark:text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-slate-800 rounded-xl transition-colors"
                                                                title="Update Password"
                                                            >
                                                                <MdKey size={18} />
                                                            </button>
                                                            <button 
                                                                onClick={() => handleStartEditUser(user)}
                                                                disabled={isUpdating}
                                                                className="p-2 text-slate-500 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-50 dark:hover:bg-slate-800 rounded-xl transition-colors"
                                                                title="Edit Details"
                                                            >
                                                                <MdEdit size={18} />
                                                            </button>
                                                            {!isMe && (
                                                                <button 
                                                                    onClick={() => handleDeleteUser(user._id)}
                                                                    disabled={isUpdating}
                                                                    className="p-2 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors"
                                                                    title="Delete User"
                                                                >
                                                                    <MdDelete size={18} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Expanded Accordion: Individual User Permissions Group Controls */}
                                                {isUserExpanded && (
                                                    <div className="p-6 bg-slate-50/80 dark:bg-slate-900/80 border-t border-slate-100 dark:border-slate-800 space-y-4 animate-fade-in">
                                                        <div className="flex items-center justify-between pb-3 border-b border-slate-200/60 dark:border-slate-800">
                                                            <div className="flex items-center gap-2">
                                                                <MdTune className="text-primary-600 dark:text-primary-400" size={18} />
                                                                <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                                                                    Custom Permissions for {user.name} ({roles.find(r => r.role === user.role)?.label || user.role})
                                                                </h4>
                                                            </div>
                                                            {hasCustomOverrides && (
                                                                <button
                                                                    onClick={() => handleResetUserPermissions(user._id)}
                                                                    className="text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-950/50 px-3 py-1 rounded-lg transition-colors"
                                                                >
                                                                    Reset to Role Defaults
                                                                </button>
                                                            )}
                                                        </div>

                                                        {/* Permission Groups Accordion for this Individual User */}
                                                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                                            {displayGroups.map((group) => {
                                                                const children = group.children || [];
                                                                const childKeys = childKeysFor(group);
                                                                const enabledChildrenCount = childKeys.filter((key) => effectivePerms[key]).length;
                                                                const hasPartialAccess = childKeys.length ? enabledChildrenCount > 0 : Boolean(effectivePerms[group.key]);
                                                                const hasFullAccess = childKeys.length ? enabledChildrenCount === childKeys.length : hasPartialAccess;
                                                                const userGroupExpanded = isGroupExpanded(`user-${user._id}`, group.key);

                                                                return (
                                                                    <div key={`user-${user._id}-${group.key}`} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-3 shadow-2xs">
                                                                        <div className="flex items-center justify-between">
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => toggleGroupAccordion(`user-${user._id}`, group.key)}
                                                                                className="flex items-center gap-2 text-left hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                                                                            >
                                                                                <div className={`transition-transform duration-200 ${userGroupExpanded ? 'rotate-0' : '-rotate-90'}`}>
                                                                                    <MdExpandMore size={16} className={hasPartialAccess ? "text-primary-600 dark:text-primary-400" : "text-slate-300 dark:text-slate-600"} />
                                                                                </div>
                                                                                <span className={`text-xs font-bold ${hasPartialAccess ? 'text-slate-900 dark:text-slate-100' : 'text-slate-400 dark:text-slate-500'}`}>
                                                                                    {group.label}
                                                                                </span>
                                                                                {children.length > 0 && (
                                                                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${hasPartialAccess ? 'bg-primary-50 dark:bg-primary-950/60 text-primary-700 dark:text-primary-300' : 'bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500'}`}>
                                                                                        {enabledChildrenCount}/{children.length}
                                                                                    </span>
                                                                                )}
                                                                            </button>

                                                                            <label className={`relative inline-flex h-4.5 w-8 items-center rounded-full transition-colors ${hasFullAccess ? 'bg-primary-600' : 'bg-slate-200 dark:bg-slate-700'} cursor-pointer`}>
                                                                                <input 
                                                                                    type="checkbox" 
                                                                                    className="sr-only" 
                                                                                    checked={hasFullAccess} 
                                                                                    onChange={() => handleToggleUserPermission(user._id, group.key, group)} 
                                                                                />
                                                                                <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${hasFullAccess ? 'translate-x-4' : 'translate-x-0.5'}`} />
                                                                            </label>
                                                                        </div>

                                                                        {/* Group Children Checkboxes */}
                                                                        {userGroupExpanded && children.length > 0 && (
                                                                            <div className="ml-4 space-y-2 border-l border-slate-100 dark:border-slate-700 pl-3 pt-2">
                                                                                {children.map((child) => {
                                                                                    const childOn = Boolean(effectivePerms[child.key]);
                                                                                    const isOverridden = user.customPermissions && Object.prototype.hasOwnProperty.call(user.customPermissions, child.key);

                                                                                    return (
                                                                                        <div key={`user-${user._id}-${child.key}`} className="flex items-center justify-between">
                                                                                            <span className={`text-[11px] font-medium ${childOn ? 'text-slate-800 dark:text-slate-200' : 'text-slate-400 dark:text-slate-500'} ${isOverridden ? 'font-bold text-amber-700 dark:text-amber-400' : ''}`}>
                                                                                                ↳ {child.label}
                                                                                            </span>
                                                                                            <label className={`relative inline-flex h-3.5 w-6 items-center rounded-full transition-colors ${childOn ? 'bg-primary-600' : 'bg-slate-200 dark:bg-slate-700'} cursor-pointer`}>
                                                                                                <input 
                                                                                                    type="checkbox" 
                                                                                                    className="sr-only" 
                                                                                                    checked={childOn} 
                                                                                                    onChange={() => handleToggleUserPermission(user._id, child.key, group)} 
                                                                                                />
                                                                                                <span className={`inline-block h-2.5 w-2.5 transform rounded-full bg-white transition-transform ${childOn ? 'translate-x-3' : 'translate-x-0.5'}`} />
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
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    }))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ========================================================================= */}
                    {/* TAB 3: VENDOR LOGINS (Dedicated Vendor Accounts Section) */}
                    {/* ========================================================================= */}
                    {activeTab === 'vendors' && (
                        <div className="space-y-6 animate-fade-in">
                            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
                                <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    <div>
                                        <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                            <MdStorefront className="text-emerald-600 dark:text-emerald-400" size={22} />
                                            Vendor Login Accounts
                                        </h2>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Manage vendor portal logins. Vendors have restricted access to Product Catalog and Invoice Vouchers.</p>
                                    </div>
                                    <button
                                        onClick={() => setShowNewVendorUserForm((prev) => !prev)}
                                        className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl font-bold text-xs hover:bg-emerald-700 transition-all shadow-xs"
                                    >
                                        {showNewVendorUserForm ? 'Cancel' : <><MdAdd size={18} /> Create Vendor Login</>}
                                    </button>
                                </div>

                                {/* Create Vendor User Form */}
                                {showNewVendorUserForm && (
                                    <form onSubmit={handleCreateVendorUser} className="p-6 bg-emerald-50/30 dark:bg-slate-900 border-b border-emerald-100 dark:border-slate-800 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4 items-end">
                                        <div>
                                            <label className="block text-xs font-bold text-emerald-800 dark:text-emerald-400 mb-1.5 ml-1">Contact / Account Name</label>
                                            <input
                                                type="text"
                                                required
                                                value={newVendorUserData.name}
                                                onChange={(e) => setNewVendorUserData((prev) => ({ ...prev, name: e.target.value }))}
                                                className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-emerald-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-emerald-600 transition-colors"
                                                placeholder="e.g. John Dear (Vendor)"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-emerald-800 dark:text-emerald-400 mb-1.5 ml-1">Login Email</label>
                                            <input
                                                type="email"
                                                required
                                                value={newVendorUserData.email}
                                                onChange={(e) => setNewVendorUserData((prev) => ({ ...prev, email: e.target.value }))}
                                                className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-emerald-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-emerald-600 transition-colors"
                                                placeholder="vendor@company.com"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-emerald-800 dark:text-emerald-400 mb-1.5 ml-1">Password</label>
                                            <input
                                                type="password"
                                                required
                                                minLength={6}
                                                value={newVendorUserData.password}
                                                onChange={(e) => setNewVendorUserData((prev) => ({ ...prev, password: e.target.value }))}
                                                className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-emerald-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-emerald-600 transition-colors"
                                                placeholder="Password"
                                                autoComplete="new-password"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-emerald-800 dark:text-emerald-400 mb-1.5 ml-1">Link to Vendor</label>
                                            <select
                                                value={newVendorUserData.vendorId}
                                                onChange={(e) => setNewVendorUserData((prev) => ({ ...prev, vendorId: e.target.value }))}
                                                className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-emerald-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-900 dark:text-slate-100 outline-none focus:border-emerald-600 transition-colors cursor-pointer"
                                            >
                                                <option value="">Select Vendor Company...</option>
                                                {vendors.map((v) => (
                                                    <option key={v._id} value={v._id}>
                                                        {v.name || v.companyName || v.code}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <button
                                            type="submit"
                                            disabled={creatingVendorUser}
                                            className="px-6 py-2.5 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 disabled:opacity-50 transition-colors shadow-xs"
                                        >
                                            {creatingVendorUser ? 'Creating...' : 'Save Vendor Login'}
                                        </button>
                                    </form>
                                )}

                                {/* Vendor Users Table */}
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-slate-50 dark:bg-slate-800/80 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">
                                                <th className="px-6 py-4">Account Name</th>
                                                <th className="px-6 py-4">Login Email</th>
                                                <th className="px-6 py-4">Linked Vendor</th>
                                                <th className="px-6 py-4">Access Profile</th>
                                                <th className="px-6 py-4">Status</th>
                                                <th className="px-6 py-4 text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                            {vendorUsers.length === 0 ? (
                                                <tr>
                                                    <td colSpan="6" className="p-12 text-center text-slate-400 font-bold text-sm">
                                                        No vendor logins created yet. Click "Create Vendor Login" to add one.
                                                    </td>
                                                </tr>
                                            ) : (
                                                vendorUsers.map((user) => {
                                                    const isUpdating = updatingUserId === user._id;
                                                    const isEditing = editingUserId === user._id;
                                                    const linkedVendor = vendors.find(v => v._id === (user.vendorId?._id || user.vendorId));

                                                    if (isEditing) {
                                                        return (
                                                            <tr key={user._id} className="bg-emerald-50/40 dark:bg-slate-800/80">
                                                                <td className="px-6 py-4">
                                                                    <input
                                                                        type="text"
                                                                        value={editingUserData.name}
                                                                        onChange={(e) => setEditingUserData(prev => ({...prev, name: e.target.value}))}
                                                                        className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-emerald-200 dark:border-slate-700 rounded-lg text-sm font-bold text-slate-900 dark:text-slate-100 outline-none"
                                                                    />
                                                                </td>
                                                                <td className="px-6 py-4">
                                                                    <input
                                                                        type="email"
                                                                        value={editingUserData.email}
                                                                        onChange={(e) => setEditingUserData(prev => ({...prev, email: e.target.value}))}
                                                                        className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-emerald-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-slate-100 outline-none"
                                                                    />
                                                                </td>
                                                                <td className="px-6 py-4">
                                                                    <select
                                                                        value={editingUserData.vendorId}
                                                                        onChange={(e) => setEditingUserData(prev => ({...prev, vendorId: e.target.value}))}
                                                                        className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-emerald-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-900 dark:text-slate-100 outline-none cursor-pointer"
                                                                    >
                                                                        <option value="">No linked vendor</option>
                                                                        {vendors.map(v => (
                                                                            <option key={v._id} value={v._id}>{v.name || v.companyName}</option>
                                                                        ))}
                                                                    </select>
                                                                </td>
                                                                <td className="px-6 py-4 text-xs font-bold text-emerald-700 dark:text-emerald-400">Vendor Portal</td>
                                                                <td className="px-6 py-4 text-xs font-bold text-emerald-600 dark:text-emerald-400">Active</td>
                                                                <td className="px-6 py-4 text-right">
                                                                    <div className="flex items-center justify-end gap-2">
                                                                        <button onClick={handleSaveUser} disabled={isUpdating} className="p-1.5 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-950/60 rounded-lg">
                                                                            <MdSave size={18} />
                                                                        </button>
                                                                        <button onClick={handleCancelEditUser} disabled={isUpdating} className="p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">
                                                                            <MdClose size={18} />
                                                                        </button>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        );
                                                    }

                                                    return (
                                                        <tr key={user._id} className="hover:bg-emerald-50/20 dark:hover:bg-slate-800/40 transition-colors">
                                                            <td className="px-6 py-4">
                                                                <span className="text-sm font-bold text-slate-900 dark:text-white">{user.name}</span>
                                                            </td>
                                                            <td className="px-6 py-4 text-xs font-semibold text-slate-600 dark:text-slate-300">{user.email}</td>
                                                            <td className="px-6 py-4">
                                                                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg">
                                                                    {user.vendorId?.name || user.vendorId?.companyName || linkedVendor?.name || linkedVendor?.companyName || 'Standard Vendor'}
                                                                </span>
                                                            </td>
                                                            <td className="px-6 py-4">
                                                                <span className="text-xs font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 px-2.5 py-1 rounded-lg border border-emerald-100 dark:border-emerald-800">
                                                                    Vendor Role
                                                                </span>
                                                            </td>
                                                            <td className="px-6 py-4">
                                                                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full">
                                                                    Active
                                                                </span>
                                                            </td>
                                                            <td className="px-6 py-4 text-right">
                                                                <div className="flex items-center justify-end gap-1">
                                                                    <button 
                                                                        onClick={() => {
                                                                            setPasswordModalUser(user);
                                                                            setNewPasswordValue('');
                                                                            setConfirmPasswordValue('');
                                                                        }}
                                                                        disabled={isUpdating}
                                                                        className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-slate-800 rounded-lg transition-colors"
                                                                        title="Update Password"
                                                                    >
                                                                        <MdKey size={16} />
                                                                    </button>
                                                                    <button 
                                                                        onClick={() => handleStartEditUser(user)}
                                                                        disabled={isUpdating}
                                                                        className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-slate-800 rounded-lg transition-colors"
                                                                        title="Edit Vendor Login"
                                                                    >
                                                                        <MdEdit size={16} />
                                                                    </button>
                                                                    <button 
                                                                        onClick={() => handleDeleteUser(user._id)}
                                                                        disabled={isUpdating}
                                                                        className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
                                                                        title="Delete Vendor Login"
                                                                    >
                                                                        <MdDelete size={16} />
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                })
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}
            {/* Password Update Modal */}
            <Modal
                isOpen={!!passwordModalUser}
                onClose={() => setPasswordModalUser(null)}
                title={`Update Password - ${passwordModalUser?.name || ''}`}
            >
                <form onSubmit={handleUpdateUserPassword} className="space-y-4">
                    <div className="p-3 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 rounded-xl border border-amber-200 dark:border-amber-800 text-xs font-bold flex items-center gap-2">
                        <MdKey size={18} className="text-amber-600 shrink-0" />
                        <span>Update login password for <strong className="font-extrabold">{passwordModalUser?.name}</strong> ({passwordModalUser?.email})</span>
                    </div>
                    <div>
                        <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">New Password *</label>
                        <input
                            type="password"
                            required
                            minLength={6}
                            value={newPasswordValue}
                            onChange={(e) => setNewPasswordValue(e.target.value)}
                            placeholder="Enter new password (min 6 chars)"
                            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-900 dark:text-white outline-none focus:border-primary-500"
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">Confirm Password *</label>
                        <input
                            type="password"
                            required
                            minLength={6}
                            value={confirmPasswordValue}
                            onChange={(e) => setConfirmPasswordValue(e.target.value)}
                            placeholder="Confirm new password"
                            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-900 dark:text-white outline-none focus:border-primary-500"
                        />
                    </div>
                    <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                        <button
                            type="button"
                            onClick={() => setPasswordModalUser(null)}
                            className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={updatingPassword}
                            className="px-6 py-2.5 bg-primary-600 text-white rounded-xl text-xs font-black uppercase tracking-wider hover:bg-primary-700 disabled:opacity-50 shadow-md flex items-center gap-1.5"
                        >
                            <MdKey size={16} />
                            {updatingPassword ? 'Updating...' : 'Update Password'}
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default Authorization;

