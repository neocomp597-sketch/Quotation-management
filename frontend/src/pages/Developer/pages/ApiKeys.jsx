import React, { useState, useEffect } from 'react';
import { developerService } from '../../../services/api';
import { toast } from 'react-toastify';
import { MdAdd, MdVpnKey, MdBlock, MdContentCopy, MdCheck, MdShield, MdRefresh } from 'react-icons/md';

const ALL_SCOPES = [
    { id: 'customers.read', label: 'Customers Read', desc: 'List and view customer profiles' },
    { id: 'customers.write', label: 'Customers Write', desc: 'Create, update, and delete customers' },
    { id: 'contacts.read', label: 'Contacts Read', desc: 'List and view contact directory' },
    { id: 'contacts.write', label: 'Contacts Write', desc: 'Create, update, and delete contacts' },
    { id: 'leads.read', label: 'Leads Read', desc: 'List and view sales inquiries' },
    { id: 'leads.write', label: 'Leads Write', desc: 'Create, update, and delete leads' },
    { id: 'deals.read', label: 'Deals Read', desc: 'List and view deal pipeline' },
    { id: 'deals.write', label: 'Deals Write', desc: 'Create, update, and delete deals' },
    { id: 'products.read', label: 'Products Read', desc: 'List and view product catalog' },
    { id: 'products.write', label: 'Products Write', desc: 'Create, update, and delete products' },
    { id: 'quotations.read', label: 'Quotations Read', desc: 'List and view quotations' },
    { id: 'quotations.write', label: 'Quotations Write', desc: 'Create, update, and delete quotations' },
    { id: 'vendors.read', label: 'Vendors Read', desc: 'List and view vendor master' },
    { id: 'vendors.write', label: 'Vendors Write', desc: 'Create, update, and delete vendors' },
    { id: 'orders.read', label: 'Orders Read', desc: 'List and view sales orders' },
    { id: 'orders.write', label: 'Orders Write', desc: 'Create, update, and delete sales orders' },
    { id: 'meetings.read', label: 'Meetings Read', desc: 'List and view meetings' },
    { id: 'meetings.write', label: 'Meetings Write', desc: 'Schedule and update meetings' },
    { id: 'branches.read', label: 'Branches Read', desc: 'List and view office branches' },
    { id: 'branches.write', label: 'Branches Write', desc: 'Manage branch records' }
];

const ApiKeys = () => {
    const [keys, setKeys] = useState([]);
    const [loading, setLoading] = useState(true);

    // Modal states
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [keyName, setKeyName] = useState('');
    const [selectedPermissions, setSelectedPermissions] = useState([
        'customers.read', 'contacts.read', 'leads.read', 'deals.read'
    ]);
    const [creating, setCreating] = useState(false);

    // One-time secret display modal
    const [newlyCreatedKey, setNewlyCreatedKey] = useState(null);
    const [copiedSecret, setCopiedSecret] = useState(false);

    useEffect(() => {
        fetchKeys();
    }, []);

    const fetchKeys = async () => {
        try {
            setLoading(true);
            const res = await developerService.getKeys();
            setKeys(res.data?.data || []);
        } catch (error) {
            console.error('Failed to load API keys:', error);
            toast.error('Failed to load API keys');
        } finally {
            setLoading(false);
        }
    };

    const handlePermissionToggle = (scopeId) => {
        if (selectedPermissions.includes(scopeId)) {
            setSelectedPermissions(prev => prev.filter(p => p !== scopeId));
        } else {
            setSelectedPermissions(prev => [...prev, scopeId]);
        }
    };

    const handleCreateKey = async (e) => {
        e.preventDefault();
        if (!keyName.trim()) {
            toast.error('Please enter a descriptive API key name');
            return;
        }

        try {
            setCreating(true);
            const res = await developerService.createKey({
                name: keyName.trim(),
                permissions: selectedPermissions,
                environment: 'production'
            });

            const createdData = res.data?.data;
            setNewlyCreatedKey(createdData);
            setShowCreateModal(false);
            setKeyName('');
            fetchKeys();
            toast.success('API Key generated successfully');
        } catch (error) {
            console.error('Failed to generate API Key:', error);
            toast.error('Failed to generate API Key');
        } finally {
            setCreating(false);
        }
    };

    const handleRevokeKey = async (id, name) => {
        if (!window.confirm(`Are you sure you want to revoke API key "${name}"? This action cannot be undone.`)) {
            return;
        }

        try {
            await developerService.revokeKey(id);
            toast.success(`Revoked API key "${name}"`);
            fetchKeys();
        } catch (error) {
            console.error('Failed to revoke API key:', error);
            toast.error('Failed to revoke API key');
        }
    };

    const copySecretToClipboard = (secretText) => {
        navigator.clipboard.writeText(secretText);
        setCopiedSecret(true);
        setTimeout(() => setCopiedSecret(false), 2500);
        toast.info('API Secret copied to clipboard');
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-300">
            {/* Page Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                        <MdVpnKey className="text-[#006c49]" size={26} />
                        API Keys Manager
                    </h1>
                    <p className="text-slate-500 text-xs font-medium mt-1">
                        Manage company API access keys, scope authorization, and soft revocations.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={fetchKeys}
                        className="p-3 bg-white hover:bg-slate-50 text-slate-600 rounded-xl transition-all border border-slate-200/80 shadow-sm"
                        title="Refresh list"
                    >
                        <MdRefresh size={18} />
                    </button>
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="px-5 py-3 rounded-xl bg-[#006c49] hover:bg-[#005237] text-white font-black text-xs uppercase tracking-wider transition-all shadow-md shadow-[#006c49]/20 flex items-center gap-2 active:scale-95"
                    >
                        <MdAdd size={18} />
                        <span>+ Generate API Key</span>
                    </button>
                </div>
            </div>

            {/* Keys Table Card */}
            <div className="bg-white rounded-3xl border border-slate-200/80 overflow-hidden shadow-sm">
                {loading ? (
                    <div className="p-12 text-center text-slate-400 font-bold text-xs uppercase tracking-widest">
                        Loading API Keys...
                    </div>
                ) : keys.length === 0 ? (
                    <div className="p-12 text-center space-y-4">
                        <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-500 mx-auto flex items-center justify-center font-black">
                            🔑
                        </div>
                        <h3 className="text-base font-black text-slate-900">No API Keys Generated</h3>
                        <p className="text-xs text-slate-500 max-w-sm mx-auto font-medium">
                            Create your first API key to start integrating external applications with ARCRM.
                        </p>
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="px-6 py-2.5 rounded-xl bg-[#006c49] hover:bg-[#005237] text-white font-black text-xs uppercase tracking-wider transition-all inline-flex items-center gap-2 shadow-md"
                        >
                            <MdAdd size={16} />
                            <span>Create API Key</span>
                        </button>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200/80 text-[10px] font-black uppercase tracking-widest text-slate-500">
                                    <th className="py-4 px-6">Name</th>
                                    <th className="py-4 px-6">Prefix / Key</th>
                                    <th className="py-4 px-6">Environment</th>
                                    <th className="py-4 px-6">Permissions</th>
                                    <th className="py-4 px-6">Status</th>
                                    <th className="py-4 px-6">Created / Last Used</th>
                                    <th className="py-4 px-6 text-center">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-xs font-semibold">
                                {keys.map(key => (
                                    <tr key={key.id} className="hover:bg-slate-50/70 transition-colors">
                                        <td className="py-4 px-6 font-bold text-slate-900">
                                            {key.name}
                                        </td>
                                        <td className="py-4 px-6 font-mono text-[#006c49] font-bold">
                                            {key.displayKey}
                                        </td>
                                        <td className="py-4 px-6 uppercase font-bold text-[10px] text-slate-500">
                                            {key.environment}
                                        </td>
                                        <td className="py-4 px-6">
                                            <div className="flex flex-wrap gap-1 max-w-xs">
                                                {(key.permissions || []).map(p => (
                                                    <span key={p} className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-[10px] font-mono text-slate-700">
                                                        {p}
                                                    </span>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="py-4 px-6">
                                            <span className={`px-2.5 py-1 rounded-full font-black text-[10px] uppercase tracking-wider ${
                                                key.status === 'active' 
                                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                                                    : 'bg-rose-100 text-rose-800 border border-rose-200'
                                            }`}>
                                                {key.status}
                                            </span>
                                        </td>
                                        <td className="py-4 px-6 text-slate-500 space-y-0.5">
                                            <div>{new Date(key.createdAt).toLocaleDateString()}</div>
                                            <div className="text-[10px] text-slate-400">
                                                {key.lastUsedAt ? `Used: ${new Date(key.lastUsedAt).toLocaleDateString()}` : 'Never used'}
                                            </div>
                                        </td>
                                        <td className="py-4 px-6 text-center">
                                            {key.status === 'active' && (
                                                <button
                                                    onClick={() => handleRevokeKey(key.id, key.name)}
                                                    className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1 mx-auto"
                                                    title="Revoke key"
                                                >
                                                    <MdBlock size={14} />
                                                    <span>Revoke</span>
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Modal 1: Create Key Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-lg w-full space-y-6 shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                            <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                                <MdShield className="text-[#006c49]" size={22} />
                                Generate New API Key
                            </h3>
                            <button
                                onClick={() => setShowCreateModal(false)}
                                className="text-slate-400 hover:text-slate-700 font-bold"
                            >
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleCreateKey} className="space-y-5">
                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Key Name *</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="e.g. Website Lead Integration"
                                    value={keyName}
                                    onChange={(e) => setKeyName(e.target.value)}
                                    className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 text-slate-900 font-semibold text-sm outline-none focus:ring-2 focus:ring-[#006c49] transition-all"
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Scope Permissions</label>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-56 overflow-y-auto pr-1">
                                    {ALL_SCOPES.map(scope => {
                                        const isChecked = selectedPermissions.includes(scope.id);
                                        return (
                                            <div
                                                key={scope.id}
                                                onClick={() => handlePermissionToggle(scope.id)}
                                                className={`p-3 rounded-xl border cursor-pointer transition-all ${
                                                    isChecked 
                                                        ? 'bg-[#006c49]/10 border-[#006c49]/40 text-[#006c49]' 
                                                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300'
                                                }`}
                                            >
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xs font-black">{scope.label}</span>
                                                    <input
                                                        type="checkbox"
                                                        checked={isChecked}
                                                        onChange={() => {}}
                                                        className="rounded text-[#006c49] focus:ring-0"
                                                    />
                                                </div>
                                                <p className="text-[10px] text-slate-500 font-medium mt-1">{scope.desc}</p>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setShowCreateModal(false)}
                                    className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs uppercase hover:bg-slate-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={creating}
                                    className="px-6 py-2.5 rounded-xl bg-[#006c49] hover:bg-[#005237] text-white font-black text-xs uppercase shadow-md shadow-[#006c49]/20"
                                >
                                    {creating ? 'Generating...' : 'Generate Secret Key'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal 2: One-Time Secret Display Prompt */}
            {newlyCreatedKey && (
                <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-md flex items-center justify-center p-4">
                    <div className="bg-white border border-slate-200 rounded-3xl p-8 max-w-lg w-full space-y-6 shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="text-center space-y-2">
                            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-black mx-auto text-xl border border-amber-500/20">
                                🔑
                            </div>
                            <h3 className="text-xl font-black text-slate-900">Save Your API Key Now</h3>
                            <p className="text-xs text-amber-700 font-bold max-w-sm mx-auto leading-relaxed">
                                ⚠️ Copy this secret key immediately. For security reasons, you will NOT be able to view it again after closing this dialog.
                            </p>
                        </div>

                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                            <div className="text-[10px] font-black uppercase text-slate-400">API Key Secret</div>
                            <div className="flex items-center justify-between gap-2 bg-white p-3 rounded-xl border border-slate-200 font-mono text-sm text-[#006c49] font-bold break-all select-all">
                                <span>{newlyCreatedKey.key}</span>
                                <button
                                    onClick={() => copySecretToClipboard(newlyCreatedKey.key)}
                                    className="px-3 py-1.5 bg-[#006c49] hover:bg-[#005237] text-white rounded-lg text-xs font-bold shrink-0 flex items-center gap-1 transition-all"
                                >
                                    {copiedSecret ? <MdCheck size={16} /> : <MdContentCopy size={16} />}
                                    <span>{copiedSecret ? 'Copied' : 'Copy'}</span>
                                </button>
                            </div>
                        </div>

                        <div className="text-center pt-2">
                            <button
                                onClick={() => setNewlyCreatedKey(null)}
                                className="w-full py-3.5 rounded-2xl bg-[#006c49] hover:bg-[#005237] text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-[#006c49]/20 transition-all"
                            >
                                I Have Copied My API Key
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ApiKeys;
