import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { 
    MdAdd, MdSearch, MdEdit, MdDelete, MdBusiness, 
    MdLocationOn, MdPhone, MdEmail, MdReceipt, MdPerson, MdImage, MdCheckCircle, MdCancel, MdArrowBack 
} from 'react-icons/md';
import { toast } from 'react-toastify';
import { branchService, stateMasterService } from '../services/api';
import Modal from '../components/Modal';
import CascadingLocationSelector from '../components/CascadingLocationSelector';
import { isValidGSTIN, isValidMobile, isValidPincode } from '../utils/validation';

const BranchMaster = ({ isCreatePage, isEditPage }) => {
    const navigate = useNavigate();
    const { id: routeId } = useParams();
    const [branches, setBranches] = useState([]);
    const [stateList, setStateList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    
    // Modal states
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingBranch, setEditingBranch] = useState(null);
    const [submitting, setSubmitting] = useState(false);

    const initialFormState = {
        name: '',
        code: '',
        branchPrefix: '',
        startEmployeeSeq: 1001,
        address: '',
        country: 'India',
        city: '',
        state: '',
        stateShortCode: '',
        countryDialCode: '+91',
        pincode: '',
        contactNo: '',
        email: '',
        gstNo: '',
        logoUrl: '',
        managerName: '',
        status: 'Active'
    };

    const [formData, setFormData] = useState(initialFormState);

    const fetchBranches = async () => {
        setLoading(true);
        try {
            const [branchRes, stateRes] = await Promise.all([
                branchService.getAll(),
                stateMasterService.getAll()
            ]);
            setBranches(branchRes.data || []);
            setStateList(stateRes.data?.data || []);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to load branches');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchBranches();
    }, []);

    useEffect(() => {
        if (isCreatePage) {
            setEditingBranch(null);
            setFormData(initialFormState);
            setIsModalOpen(true);
        } else if (isEditPage && routeId) {
            setIsModalOpen(true);
            const found = branches.find(b => b._id === routeId);
            if (found) {
                setEditingBranch(found);
                setFormData({
                    name: found.name || '',
                    code: found.code || '',
                    branchPrefix: found.branchPrefix || '',
                    startEmployeeSeq: found.startEmployeeSeq || 1001,
                    address: found.address || '',
                    country: found.country || 'India',
                    city: found.city || '',
                    state: found.state || '',
                    stateShortCode: found.stateShortCode || '',
                    countryDialCode: found.countryDialCode || '+91',
                    pincode: found.pincode || '',
                    contactNo: found.contactNo || '',
                    email: found.email || '',
                    gstNo: found.gstNo || '',
                    logoUrl: found.logoUrl || '',
                    managerName: found.managerName || '',
                    status: found.status || 'Active'
                });
            } else {
                branchService.getAll().then(res => {
                    const list = res.data || [];
                    const item = list.find(b => b._id === routeId);
                    if (item) {
                        setEditingBranch(item);
                        setFormData({
                            name: item.name || '',
                            code: item.code || '',
                            branchPrefix: item.branchPrefix || '',
                            address: item.address || '',
                            country: item.country || 'India',
                            city: item.city || '',
                            state: item.state || '',
                            stateShortCode: item.stateShortCode || '',
                            countryDialCode: item.countryDialCode || '+91',
                            pincode: item.pincode || '',
                            contactNo: item.contactNo || '',
                            email: item.email || '',
                            gstNo: item.gstNo || '',
                            logoUrl: item.logoUrl || '',
                            managerName: item.managerName || '',
                            status: item.status || 'Active'
                        });
                    }
                }).catch(err => console.error(err));
            }
        }
    }, [isCreatePage, isEditPage, routeId, branches]);

    const handleOpenModal = (branch = null) => {
        if (branch) {
            navigate(`/branches/edit/${branch._id}`);
        } else {
            navigate('/branches/new');
        }
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingBranch(null);
        setFormData(initialFormState);
        navigate('/branches');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!formData.name || !formData.code || !formData.branchPrefix) {
            toast.error('Branch Name, Code, and Prefix are required!');
            return;
        }

        if (formData.pincode && !isValidPincode(formData.pincode)) {
            toast.error('Invalid Pincode (must be exactly 6 numeric digits)');
            return;
        }
        if (formData.contactNo && !isValidMobile(formData.contactNo)) {
            toast.error('Invalid Contact Phone (must be 10 digits)');
            return;
        }
        if (formData.gstNo && !isValidGSTIN(formData.gstNo)) {
            toast.error('Invalid GSTIN format (must be 15 characters, e.g. 27AAAAA0000A1Z5)');
            return;
        }

        setSubmitting(true);
        try {
            if (editingBranch) {
                await branchService.update(editingBranch._id, formData);
                toast.success('Branch updated successfully!');
            } else {
                await branchService.create(formData);
                toast.success('Branch created successfully!');
            }
            handleCloseModal();
            fetchBranches();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Error saving branch');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id, name) => {
        if (!window.confirm(`Are you sure you want to delete branch "${name}"?`)) return;
        try {
            await branchService.delete(id);
            toast.success('Branch deleted successfully!');
            fetchBranches();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to delete branch');
        }
    };

    const filteredBranches = branches.filter(b => {
        const query = searchQuery.toLowerCase();
        return (
            b.name.toLowerCase().includes(query) ||
            b.code.toLowerCase().includes(query) ||
            (b.branchPrefix && b.branchPrefix.toLowerCase().includes(query)) ||
            (b.city && b.city.toLowerCase().includes(query)) ||
            (b.managerName && b.managerName.toLowerCase().includes(query))
        );
    });

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            {!(isModalOpen || isCreatePage || isEditPage) ? (
                <>
                    {/* Header section */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm">
                <div>
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-primary-50 dark:bg-primary-950/40 text-primary-600 rounded-2xl">
                            <MdBusiness size={28} />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100">Branch Master</h1>
                            <p className="text-xs font-semibold text-slate-500 mt-0.5">
                                Manage multiple company branches, data access control, and auto branding
                            </p>
                        </div>
                    </div>
                </div>

                <button
                    onClick={() => handleOpenModal()}
                    className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-2xl shadow-lg shadow-primary-600/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                    <MdAdd size={20} />
                    <span>Add New Branch</span>
                </button>
            </div>

            {/* Search and Filters Bar */}
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center gap-4">
                <div className="relative flex-1">
                    <MdSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                    <input
                        type="text"
                        placeholder="Search by branch name, code, prefix (NSK, PN...), city, or manager..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-12 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl border-none text-sm font-semibold text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                    />
                </div>
                <div className="text-xs font-bold text-slate-500 px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl">
                    Total Branches: <span className="text-primary-600">{filteredBranches.length}</span>
                </div>
            </div>

            {/* Branches List Table / Grid */}
            {loading ? (
                <div className="py-20 text-center text-slate-400 font-semibold animate-pulse">
                    Loading Branch Master records...
                </div>
            ) : filteredBranches.length === 0 ? (
                <div className="py-16 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800">
                    <MdBusiness size={48} className="mx-auto text-slate-300 dark:text-slate-700 mb-3" />
                    <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">No Branches Found</h3>
                    <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                        Get started by clicking "Add New Branch" above to setup your office branches.
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredBranches.map((branch) => (
                        <div 
                            key={branch._id} 
                            className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group"
                        >
                            <div className="space-y-4">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-center gap-3">
                                        {branch.logoUrl ? (
                                            <img 
                                                src={branch.logoUrl} 
                                                alt={branch.name} 
                                                className="w-12 h-12 rounded-2xl object-cover border border-slate-200 dark:border-slate-700" 
                                            />
                                        ) : (
                                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary-500 to-indigo-600 text-white flex items-center justify-center font-black text-lg">
                                                {branch.branchPrefix || branch.code?.substring(0, 3) || 'BR'}
                                            </div>
                                        )}
                                        <div>
                                            <h3 className="font-black text-slate-900 dark:text-slate-100 text-lg leading-snug">
                                                {branch.name}
                                            </h3>
                                            <div className="flex flex-wrap items-center gap-2 mt-1">
                                                <span className="px-2 py-0.5 bg-primary-50 dark:bg-primary-950/60 text-primary-700 dark:text-primary-300 font-bold text-[11px] rounded-lg">
                                                    Code: {branch.code}
                                                </span>
                                                <span className="px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold text-[11px] rounded-lg">
                                                    Prefix: {branch.branchPrefix}
                                                </span>
                                                {branch.stateShortCode && (
                                                    <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-mono font-bold text-[11px] rounded-lg">
                                                        State Code: {branch.stateShortCode}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                        branch.status === 'Active' 
                                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400' 
                                            : 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400'
                                    }`}>
                                        {branch.status}
                                    </span>
                                </div>

                                <div className="space-y-2 text-xs font-semibold text-slate-600 dark:text-slate-300 pt-2 border-t border-slate-100 dark:border-slate-800">
                                    {(branch.city || branch.state || branch.address || branch.country) && (
                                        <div className="flex items-start gap-2">
                                            <MdLocationOn className="text-slate-400 shrink-0 mt-0.5" size={15} />
                                            <span>
                                                {[
                                                    branch.address,
                                                    branch.city,
                                                    branch.state ? `${branch.state}${branch.stateShortCode ? ` (${branch.stateShortCode})` : ''}` : '',
                                                    branch.country ? `${branch.country} (${branch.countryDialCode || '+91'})` : '',
                                                    branch.pincode
                                                ].filter(Boolean).join(', ')}
                                            </span>
                                        </div>
                                    )}

                                    {branch.contactNo && (
                                        <div className="flex items-center gap-2">
                                            <MdPhone className="text-slate-400 shrink-0" size={15} />
                                            <span>{branch.contactNo}</span>
                                        </div>
                                    )}

                                    {branch.email && (
                                        <div className="flex items-center gap-2">
                                            <MdEmail className="text-slate-400 shrink-0" size={15} />
                                            <span>{branch.email}</span>
                                        </div>
                                    )}

                                    {branch.gstNo && (
                                        <div className="flex items-center gap-2">
                                            <MdReceipt className="text-slate-400 shrink-0" size={15} />
                                            <span>GST: <span className="font-bold text-slate-800 dark:text-slate-200">{branch.gstNo}</span></span>
                                        </div>
                                    )}

                                    {branch.managerName && (
                                        <div className="flex items-center gap-2">
                                            <MdPerson className="text-slate-400 shrink-0" size={15} />
                                            <span>Manager: <span className="font-bold text-slate-800 dark:text-slate-200">{branch.managerName}</span></span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
                                <button
                                    onClick={() => handleOpenModal(branch)}
                                    className="p-2 text-slate-600 hover:text-primary-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                                    title="Edit Branch"
                                >
                                    <MdEdit size={18} />
                                </button>
                                <button
                                    onClick={() => handleDelete(branch._id, branch.name)}
                                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors"
                                    title="Delete Branch"
                                >
                                    <MdDelete size={18} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            </>
            ) : (
                <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-200">
                        {/* Header bar */}
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                            <div className="flex items-center gap-4">
                                <button
                                    type="button"
                                    onClick={() => handleCloseModal()}
                                    className="p-3 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-2xl transition-all border border-slate-200"
                                >
                                    <MdArrowBack size={20} />
                                </button>
                                <div>
                                    <h1 className="text-xl font-black text-slate-900">
                                        {editingBranch ? 'Edit Branch Master' : 'Create New Branch'}
                                    </h1>
                                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                                        {editingBranch ? `Update branch parameters for ${editingBranch.name}` : 'Add a new office branch location'}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    type="button"
                                    onClick={() => handleCloseModal()}
                                    className="px-6 py-3 rounded-2xl border border-slate-200 text-slate-600 font-black uppercase text-xs tracking-widest hover:bg-slate-50 transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    form="branch-master-form"
                                    disabled={submitting}
                                    className="bg-primary-600 hover:bg-primary-700 text-white px-8 py-3 rounded-2xl font-black transition-all shadow-xl shadow-primary-600/20 uppercase text-xs tracking-widest active:scale-95 disabled:opacity-50"
                                >
                                    {submitting ? 'Saving...' : editingBranch ? 'Update Branch' : 'Create Branch'}
                                </button>
                            </div>
                        </div>

                        {/* Form Card Body */}
                        <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
                            <form id="branch-master-form" onSubmit={handleSubmit} className="space-y-6">
                                <div className="grid grid-cols-1 sm:grid-cols-4 gap-6">
                                    <div className="sm:col-span-1">
                                        <label className="block text-xs font-bold text-slate-700 mb-1">
                                            Branch Name <span className="text-rose-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            placeholder="e.g. Nashik Office"
                                            value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                            className="w-full px-3.5 py-3 bg-slate-50 rounded-xl border border-slate-200 text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-primary-500/20 outline-none"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 mb-1">
                                            Branch Code <span className="text-rose-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            placeholder="e.g. NSK-01"
                                            value={formData.code}
                                            onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                                            className="w-full px-3.5 py-3 bg-slate-50 rounded-xl border border-slate-200 text-sm font-semibold uppercase text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-primary-500/20 outline-none"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 mb-1">
                                            Branch Prefix <span className="text-rose-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            maxLength={5}
                                            placeholder="e.g. NSK, PN, MUM"
                                            value={formData.branchPrefix}
                                            onChange={(e) => setFormData({ ...formData, branchPrefix: e.target.value.toUpperCase() })}
                                            className="w-full px-3.5 py-3 bg-slate-50 rounded-xl border border-slate-200 text-sm font-black uppercase tracking-wider text-primary-600 placeholder:text-slate-400 focus:ring-2 focus:ring-primary-500/20 outline-none"
                                        />
                                        <span className="text-[10px] font-semibold text-slate-400">Prefix for Auto IDs (e.g. MUM)</span>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 mb-1">
                                            Emp ID Starting Number
                                        </label>
                                        <input
                                            type="number"
                                            min="1"
                                            placeholder="e.g. 5001, 6001"
                                            value={formData.startEmployeeSeq || 1001}
                                            onChange={(e) => setFormData({ ...formData, startEmployeeSeq: e.target.value })}
                                            className="w-full px-3.5 py-3 bg-slate-50 rounded-xl border border-slate-200 text-sm font-bold text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-primary-500/20 outline-none"
                                        />
                                        <span className="text-[10px] font-semibold text-slate-400">Sequence start (e.g. 5001 ➔ MUM5001)</span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 mb-1">
                                            Address
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="Office Street Address"
                                            value={formData.address}
                                            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                            className="w-full px-3.5 py-3 bg-slate-50 rounded-xl border border-slate-200 text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-primary-500/20 outline-none"
                                        />
                                    </div>
                                    <CascadingLocationSelector
                                        country={formData.country || 'India'}
                                        state={formData.state || ''}
                                        city={formData.city || ''}
                                        dialCode={formData.countryDialCode || '+91'}
                                        masterStateList={stateList}
                                        onChange={({ country, state, city, dialCode, shortCode, gstCode }) => {
                                            setFormData(prev => {
                                                let nextGstNo = prev.gstNo || '';
                                                if (gstCode) {
                                                    const cleanCode = String(gstCode).padStart(2, '0');
                                                    if (!nextGstNo) {
                                                        nextGstNo = cleanCode;
                                                    } else if (/^\d{2}/.test(nextGstNo)) {
                                                        nextGstNo = cleanCode + nextGstNo.slice(2);
                                                    }
                                                }
                                                return {
                                                    ...prev,
                                                    country,
                                                    state,
                                                    city,
                                                    countryDialCode: dialCode,
                                                    stateShortCode: shortCode || prev.stateShortCode,
                                                    gstNo: nextGstNo
                                                };
                                            });
                                        }}
                                    />
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-4 gap-6">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 mb-1">
                                            Pincode
                                        </label>
                                        <input
                                            type="text"
                                            maxLength={6}
                                            placeholder="400001"
                                            value={formData.pincode}
                                            onChange={(e) => setFormData({ ...formData, pincode: e.target.value.replace(/[^\d]/g, '').slice(0, 6) })}
                                            className="w-full px-3.5 py-3 bg-slate-50 rounded-xl border border-slate-200 text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-primary-500/20 outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 mb-1">
                                            Contact Phone
                                        </label>
                                        <input
                                            type="text"
                                            maxLength={10}
                                            placeholder="10-digit contact phone"
                                            value={formData.contactNo}
                                            onChange={(e) => setFormData({ ...formData, contactNo: e.target.value.replace(/[^\d]/g, '').slice(0, 10) })}
                                            className="w-full px-3.5 py-3 bg-slate-50 rounded-xl border border-slate-200 text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-primary-500/20 outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 mb-1">
                                            Email Address
                                        </label>
                                        <input
                                            type="email"
                                            placeholder="branch@company.com"
                                            value={formData.email}
                                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                            className="w-full px-3.5 py-3 bg-slate-50 rounded-xl border border-slate-200 text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-primary-500/20 outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 mb-1">
                                            GST Number
                                        </label>
                                        <input
                                            type="text"
                                            maxLength={15}
                                            placeholder="27AAAAA0000A1Z5"
                                            value={formData.gstNo}
                                            onChange={(e) => setFormData({ ...formData, gstNo: e.target.value.toUpperCase().slice(0, 15) })}
                                            className="w-full px-3.5 py-3 bg-slate-50 rounded-xl border border-slate-200 text-sm font-semibold uppercase text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-primary-500/20 outline-none font-mono"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                                    <div className="sm:col-span-2">
                                        <label className="block text-xs font-bold text-slate-700 mb-1">
                                            Branch Logo URL (For Invoices/Quotes Branding)
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="https://example.com/logo.png"
                                            value={formData.logoUrl}
                                            onChange={(e) => setFormData({ ...formData, logoUrl: e.target.value })}
                                            className="w-full px-3.5 py-3 bg-slate-50 rounded-xl border border-slate-200 text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-primary-500/20 outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 mb-1">
                                            Branch Manager
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="Manager Name"
                                            value={formData.managerName}
                                            onChange={(e) => setFormData({ ...formData, managerName: e.target.value })}
                                            className="w-full px-3.5 py-3 bg-slate-50 rounded-xl border border-slate-200 text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-primary-500/20 outline-none"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">
                                        Status
                                    </label>
                                    <select
                                        value={formData.status}
                                        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                        className="w-full px-3.5 py-3 bg-slate-50 rounded-xl border border-slate-200 text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-primary-500/20 outline-none"
                                    >
                                        <option value="Active">Active</option>
                                        <option value="Inactive">Inactive</option>
                                    </select>
                                </div>
                            </form>
                        </div>
                </div>
            )}
        </div>
    );
};

export default BranchMaster;
