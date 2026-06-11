import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import {
    MdBusiness,
    MdCheckCircle,
    MdBlock,
    MdRefresh,
    MdAdminPanelSettings,
    MdPeople,
    MdNewReleases,
} from 'react-icons/md';
import { superAdminService, systemUpdateService } from '../services/api';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';

const StatCard = ({ label, value, icon, tone }) => (
    <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between gap-4">
            <div>
                <p className="text-xs font-black uppercase tracking-widest text-slate-400">{label}</p>
                <p className="mt-2 text-3xl font-black text-slate-900">{value}</p>
            </div>
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${tone}`}>
                {icon}
            </div>
        </div>
    </div>
);

const SuperAdmin = () => {
    const { isSuperAdmin } = useAuth();
    const [stats, setStats] = useState({ totalCompanies: 0, activeCompanies: 0, inactiveCompanies: 0 });
    const [companies, setCompanies] = useState([]);
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [updatingCompanyId, setUpdatingCompanyId] = useState('');
    const [updatingUserId, setUpdatingUserId] = useState('');
    const [confirmAction, setConfirmAction] = useState(null);

    // Announcement creation states
    const [version, setVersion] = useState('');
    const [title, setTitle] = useState('');
    const [message, setMessage] = useState('');
    const [releaseNotesText, setReleaseNotesText] = useState('');
    const [submittingAnnouncement, setSubmittingAnnouncement] = useState(false);

    const handlePublishAnnouncement = async (e) => {
        e.preventDefault();
        if (!version || !title || !message) {
            toast.error('Version, title, and message are required.');
            return;
        }

        setSubmittingAnnouncement(true);
        try {
            const releaseNotes = releaseNotesText
                .split('\n')
                .map(note => note.trim())
                .filter(note => note.length > 0);

            await systemUpdateService.create({
                version,
                title,
                message,
                releaseNotes
            });

            toast.success('System update announcement published successfully!');
            setVersion('');
            setTitle('');
            setMessage('');
            setReleaseNotesText('');
        } catch (error) {
            console.error("Failed to publish system update", error);
            toast.error(error.response?.data?.message || 'Failed to publish system update');
        } finally {
            setSubmittingAnnouncement(false);
        }
    };

    const activeCompanies = useMemo(
        () => companies.filter((company) => company.isActive && company.status !== 'DISABLED').length,
        [companies]
    );

    const loadData = async () => {
        setLoading(true);
        try {
            const [statsRes, companiesRes] = await Promise.all([
                superAdminService.getCompanyStats(),
                superAdminService.getCompanies(),
            ]);
            const usersRes = await superAdminService.getUsers({ limit: 100 });
            setStats(statsRes.data || {});
            setCompanies(companiesRes.data || []);
            setUsers(usersRes.data || []);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to load super admin data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isSuperAdmin) loadData();
    }, [isSuperAdmin]);

    const updateCompanyStatus = async (company, nextActive, nextStatus) => {
        setUpdatingCompanyId(company._id);
        try {
            await superAdminService.updateCompanyStatus(company._id, {
                isActive: nextActive,
                status: nextStatus,
            });
            toast.success(nextActive ? 'Company reactivated' : 'Company suspended');
            await loadData();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Could not update company');
        } finally {
            setUpdatingCompanyId('');
        }
    };

    const handleCompanyStatus = (company) => {
        const nextActive = !(company.isActive && company.status === 'ACTIVE');
        const nextStatus = nextActive ? 'ACTIVE' : 'SUSPENDED';

        setConfirmAction({
            title: nextActive ? 'Reactivate Company' : 'Suspend Company',
            message: nextActive
                ? `Reactivate ${company.companyName || company.name}? Users stay inactive until enabled separately.`
                : `Suspend ${company.companyName || company.name}? This blocks login and revokes sessions for all users.`,
            confirmLabel: nextActive ? 'Reactivate' : 'Suspend',
            tone: nextActive ? 'success' : 'danger',
            icon: nextActive ? <MdCheckCircle size={28} /> : <MdBlock size={28} />,
            onConfirm: () => updateCompanyStatus(company, nextActive, nextStatus),
        });
    };

    const updateUserStatus = async (user, nextActive) => {
        setUpdatingUserId(user._id);
        try {
            await superAdminService.updateUserStatus(user._id, { isActive: nextActive });
            toast.success(nextActive ? 'User reactivated' : 'User deactivated');
            await loadData();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Could not update user');
        } finally {
            setUpdatingUserId('');
        }
    };

    const handleUserStatus = (user) => {
        const enabled = user.status !== false && user.isActive !== false;
        const nextActive = !enabled;

        setConfirmAction({
            title: nextActive ? 'Reactivate User' : 'Deactivate User',
            message: nextActive
                ? `Reactivate ${user.name || user.email}?`
                : `Deactivate ${user.name || user.email}? This revokes sessions and blocks login.`,
            confirmLabel: nextActive ? 'Reactivate' : 'Deactivate',
            tone: nextActive ? 'success' : 'danger',
            icon: nextActive ? <MdCheckCircle size={28} /> : <MdBlock size={28} />,
            onConfirm: () => updateUserStatus(user, nextActive),
        });
    };

    const handleConfirm = async () => {
        const action = confirmAction;
        setConfirmAction(null);
        await action?.onConfirm?.();
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <div className="flex items-center gap-2 text-primary-600 font-black uppercase tracking-widest text-xs">
                        <MdAdminPanelSettings size={18} />
                        Platform Control
                    </div>
                    <h1 className="mt-2 text-3xl font-black text-slate-900 tracking-tight">Super Admin</h1>
                    <p className="text-slate-500 font-medium">Company visibility, tenant suspension, and platform metrics.</p>
                </div>
                <button
                    type="button"
                    onClick={loadData}
                    disabled={loading}
                    className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-slate-900 text-white font-bold hover:bg-slate-800 disabled:opacity-60"
                >
                    <MdRefresh size={18} />
                    Refresh
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <StatCard label="Total Companies" value={stats.totalCompanies ?? companies.length} icon={<MdBusiness size={24} />} tone="bg-primary-50 text-primary-700" />
                <StatCard label="Active Companies" value={stats.activeCompanies ?? activeCompanies} icon={<MdCheckCircle size={24} />} tone="bg-emerald-50 text-emerald-700" />
                <StatCard label="Active Users" value={stats.activeUsers ?? 0} icon={<MdPeople size={24} />} tone="bg-sky-50 text-sky-700" />
            </div>

            <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
                <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-black text-slate-900">Registered Companies</h2>
                        <p className="text-sm text-slate-500 font-medium">User counts are aggregated on the backend.</p>
                    </div>
                    <span className="hidden sm:inline-flex items-center gap-2 text-sm font-bold text-slate-500">
                        <MdPeople size={18} />
                        {companies.reduce((sum, company) => sum + (company.userCount || 0), 0)} users
                    </span>
                </div>

                {loading ? (
                    <div className="p-10 text-center text-slate-400">Loading...</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                            <thead className="bg-slate-50 text-slate-500 uppercase tracking-widest text-xs">
                                <tr>
                                    <th className="px-6 py-4 text-left">Company</th>
                                    <th className="px-6 py-4 text-left">Status</th>
                                    <th className="px-6 py-4 text-right">Users</th>
                                    <th className="px-6 py-4 text-right">Active Users</th>
                                    <th className="px-6 py-4 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {companies.map((company) => {
                                    const enabled = company.isActive && company.status === 'ACTIVE';
                                    return (
                                        <tr key={company._id} className="hover:bg-slate-50/70">
                                            <td className="px-6 py-4 font-bold text-slate-900">{company.companyName || company.name}</td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex px-2.5 py-1 rounded-lg text-xs font-black uppercase ${enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                                                    {company.status || (enabled ? 'ACTIVE' : 'SUSPENDED')}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right font-bold text-slate-700">{company.userCount || 0}</td>
                                            <td className="px-6 py-4 text-right font-bold text-slate-700">{company.activeUserCount || 0}</td>
                                            <td className="px-6 py-4 text-right">
                                                <button
                                                    type="button"
                                                    onClick={() => handleCompanyStatus(company)}
                                                    disabled={updatingCompanyId === company._id}
                                                    className={`inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl font-bold disabled:opacity-60 ${enabled ? 'bg-rose-50 text-rose-700 hover:bg-rose-100' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'}`}
                                                >
                                                    {enabled ? <MdBlock size={18} /> : <MdCheckCircle size={18} />}
                                                    {enabled ? 'Suspend' : 'Activate'}
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {!companies.length && (
                                    <tr>
                                        <td colSpan="5" className="px-6 py-10 text-center text-slate-400">No companies found.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
                <div className="px-6 py-5 border-b border-slate-100">
                    <h2 className="text-xl font-black text-slate-900">Platform Users</h2>
                    <p className="text-sm text-slate-500 font-medium">Deactivate or reactivate users across tenants.</p>
                </div>

                {loading ? (
                    <div className="p-10 text-center text-slate-400">Loading...</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                            <thead className="bg-slate-50 text-slate-500 uppercase tracking-widest text-xs">
                                <tr>
                                    <th className="px-6 py-4 text-left">User</th>
                                    <th className="px-6 py-4 text-left">Company</th>
                                    <th className="px-6 py-4 text-left">Role</th>
                                    <th className="px-6 py-4 text-left">Status</th>
                                    <th className="px-6 py-4 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {users.map((user) => {
                                    const enabled = user.status !== false && user.isActive !== false;
                                    return (
                                        <tr key={user._id} className="hover:bg-slate-50/70">
                                            <td className="px-6 py-4">
                                                <div className="font-bold text-slate-900">{user.name || 'Unnamed User'}</div>
                                                <div className="text-xs text-slate-500">{user.email}</div>
                                            </td>
                                            <td className="px-6 py-4 font-semibold text-slate-600">{user.companyId?.name || 'Platform'}</td>
                                            <td className="px-6 py-4 font-bold text-slate-700">{user.role}</td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex px-2.5 py-1 rounded-lg text-xs font-black uppercase ${enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                                                    {enabled ? 'ACTIVE' : 'INACTIVE'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button
                                                    type="button"
                                                    onClick={() => handleUserStatus(user)}
                                                    disabled={updatingUserId === user._id}
                                                    className={`inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl font-bold disabled:opacity-60 ${enabled ? 'bg-rose-50 text-rose-700 hover:bg-rose-100' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'}`}
                                                >
                                                    {enabled ? <MdBlock size={18} /> : <MdCheckCircle size={18} />}
                                                    {enabled ? 'Deactivate' : 'Activate'}
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {!users.length && (
                                    <tr>
                                        <td colSpan="5" className="px-6 py-10 text-center text-slate-400">No users found.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Publish System Update Card */}
            <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden p-6 md:p-8">
                <div className="border-b border-slate-100 pb-5 mb-6">
                    <div className="flex items-center gap-2 text-primary-600 font-black uppercase tracking-widest text-xs">
                        <MdNewReleases size={18} />
                        Platform Announcements
                    </div>
                    <h2 className="mt-2 text-xl font-black text-slate-900 tracking-tight">Publish System Update</h2>
                    <p className="text-slate-500 text-sm font-medium">Notify all users across the platform of new features, bug fixes, or system upgrades.</p>
                </div>

                <form onSubmit={handlePublishAnnouncement} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="space-y-2">
                            <label className="text-xs font-black uppercase tracking-wider text-slate-400">Version Tag</label>
                            <input
                                type="text"
                                value={version}
                                onChange={(e) => setVersion(e.target.value)}
                                placeholder="e.g. v2.8.2"
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-600/20 focus:border-primary-600 focus:bg-white transition-all outline-none text-sm font-semibold text-slate-950"
                                required
                            />
                        </div>
                        <div className="md:col-span-2 space-y-2">
                            <label className="text-xs font-black uppercase tracking-wider text-slate-400">Update Title</label>
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="e.g. Invoicing Engine & Customer Export Improvements"
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-600/20 focus:border-primary-600 focus:bg-white transition-all outline-none text-sm font-semibold text-slate-950"
                                required
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-black uppercase tracking-wider text-slate-400">Summary Message</label>
                        <textarea
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            placeholder="Briefly describe what this system update achieves..."
                            rows={3}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-600/20 focus:border-primary-600 focus:bg-white transition-all outline-none text-sm font-semibold text-slate-950 resize-none"
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-black uppercase tracking-wider text-slate-400">What's New / Bullet Points (One change per line)</label>
                        <textarea
                            value={releaseNotesText}
                            onChange={(e) => setReleaseNotesText(e.target.value)}
                            placeholder="e.g.&#10;✓ Optimised planning dashboard loading speeds&#10;✓ Fixed customer billing state reset bug&#10;✓ Added Territory Master export buttons"
                            rows={4}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-600/20 focus:border-primary-600 focus:bg-white transition-all outline-none text-sm font-semibold text-slate-950 font-mono"
                        />
                    </div>

                    <div className="flex justify-end">
                        <button
                            type="submit"
                            disabled={submittingAnnouncement}
                            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-bold transition-all disabled:opacity-60 shadow-lg shadow-primary-600/20"
                        >
                            {submittingAnnouncement ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                    Publishing...
                                </>
                            ) : (
                                'Publish Release Updates'
                            )}
                        </button>
                    </div>
                </form>
            </div>

            <Modal
                isOpen={Boolean(confirmAction)}
                onClose={() => setConfirmAction(null)}
                title={confirmAction?.title || 'Confirm Action'}
                maxWidth="max-w-md"
                footer={(
                    <>
                        <button
                            type="button"
                            onClick={() => setConfirmAction(null)}
                            className="w-full md:w-auto px-5 py-3 rounded-xl bg-white border border-slate-200 text-slate-600 font-black uppercase text-[10px] tracking-widest hover:bg-slate-50 transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleConfirm}
                            className={`w-full md:w-auto px-5 py-3 rounded-xl text-white font-black uppercase text-[10px] tracking-widest transition-all shadow-lg ${
                                confirmAction?.tone === 'danger'
                                    ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20'
                                    : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
                            }`}
                        >
                            {confirmAction?.confirmLabel || 'Confirm'}
                        </button>
                    </>
                )}
            >
                <div className="flex items-start gap-4">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${
                        confirmAction?.tone === 'danger'
                            ? 'bg-rose-50 text-rose-600'
                            : 'bg-emerald-50 text-emerald-600'
                    }`}>
                        {confirmAction?.icon}
                    </div>
                    <div>
                        <p className="text-base font-bold text-slate-900 leading-relaxed">
                            {confirmAction?.message}
                        </p>
                        <p className="mt-3 text-sm font-medium text-slate-500">
                            This action is recorded in the platform audit log.
                        </p>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default SuperAdmin;
