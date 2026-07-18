import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { tenderService, customerService, userService, payrollService, importService } from '../services/api';
import { 
    MdAssignment, MdAdd, MdEdit, MdDelete, MdSearch,
    MdFilterList, MdRefresh, MdClose, MdInfo, MdOutlineAccessTime,
    MdCloudUpload, MdDownload
} from 'react-icons/md';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';
import ImportModal from '../components/ImportModal';
import * as XLSX from 'xlsx';

const STATUS_CLASSES = {
    'Active': 'bg-blue-50 text-blue-700 border-blue-100',
    'Submitted': 'bg-amber-50 text-amber-700 border-amber-100',
    'Won': 'bg-emerald-50 text-emerald-700 border-emerald-100',
    'Lost': 'bg-rose-50 text-rose-700 border-rose-100',
    'Pending Approval': 'bg-purple-50 text-purple-700 border-purple-100'
};

const formatCurrency = (val) => {
    if (!val && val !== 0) return '₹0';
    return `₹${val.toLocaleString('en-IN')}`;
};

const TenderRegister = () => {
    const { user: currentUser } = useAuth();
    const [searchParams, setSearchParams] = useSearchParams();

    // Tenders data
    const [tenders, setTenders] = useState([]);
    const [loading, setLoading] = useState(true);

    // Dropdowns data
    const [customers, setCustomers] = useState([]);
    const [owners, setOwners] = useState([]);
    const [departments, setDepartments] = useState([]);

    // Filters State
    const [search, setSearch] = useState(searchParams.get('search') || '');
    const [status, setStatus] = useState(searchParams.get('status') || '');
    const [customerId, setCustomerId] = useState(searchParams.get('customerId') || '');
    const [ownerId, setOwnerId] = useState(searchParams.get('ownerId') || '');
    const [departmentId, setDepartmentId] = useState(searchParams.get('departmentId') || '');

    // Form Modal State
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [formData, setFormData] = useState({
        tenderNo: '',
        title: '',
        customerId: '',
        value: '',
        deadlineDate: '',
        submissionDate: '',
        departmentId: '',
        ownerId: '',
        status: 'Active',
        description: ''
    });
    const [submitting, setSubmitting] = useState(false);

    // Detail Modal State
    const [selectedTender, setSelectedTender] = useState(null);

    // Import State
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);

    const handleExportTenders = () => {
        if (tenders.length === 0) {
            toast.warning('No tenders available to export.');
            return;
        }

        const exportData = tenders.map((t, idx) => ({
            'Sr. No.': idx + 1,
            'Tender Number': t.tenderNo || '-',
            'Tender Title': t.title || '-',
            'Client': t.customerId?.companyName || t.customerId?.customerName || '-',
            'Value (₹)': t.value || 0,
            'Deadline Date': t.deadlineDate ? new Date(t.deadlineDate).toLocaleDateString('en-IN') : '-',
            'Submission Date': t.submissionDate ? new Date(t.submissionDate).toLocaleDateString('en-IN') : '-',
            'Department': t.departmentId?.name || '-',
            'Owner': t.ownerId?.name || '-',
            'Status': t.status || 'Active',
            'Description': t.description || ''
        }));

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Tenders Register');
        XLSX.writeFile(wb, `Tenders_Register_${new Date().toISOString().slice(0, 10)}.xlsx`);
        toast.success('Successfully exported Tenders Register to Excel.');
    };

    const loadFiltersData = async () => {
        try {
            const [custRes, ownerRes, deptRes] = await Promise.all([
                customerService.getAll({ limit: 1000 }),
                userService.getAll({ limit: 1000 }),
                payrollService.getDepartments().catch(() => ({ data: [] }))
            ]);
            setCustomers(custRes.data?.data || custRes.data?.docs || custRes.data || []);
            setOwners(ownerRes.data?.data || ownerRes.data?.docs || ownerRes.data || []);
            setDepartments(deptRes.data?.data || deptRes.data?.docs || deptRes.data || []);
        } catch (err) {
            console.error('Failed to load filter options:', err);
        }
    };

    const loadTenders = async (showSpinner = true) => {
        if (showSpinner) setLoading(true);
        try {
            const params = {
                search: search || undefined,
                status: status || undefined,
                customerId: customerId || undefined,
                ownerId: ownerId || undefined,
                departmentId: departmentId || undefined
            };
            const res = await tenderService.getTenders(params);
            setTenders(res.data || []);
        } catch (err) {
            console.error('Failed to fetch tenders:', err);
            toast.error('Failed to load tenders register.');
        } finally {
            if (showSpinner) setLoading(false);
        }
    };

    // Load URL params if any change
    useEffect(() => {
        setSearch(searchParams.get('search') || '');
        setStatus(searchParams.get('status') || '');
        setCustomerId(searchParams.get('customerId') || '');
        setOwnerId(searchParams.get('ownerId') || '');
        setDepartmentId(searchParams.get('departmentId') || '');
    }, [searchParams]);

    useEffect(() => {
        loadFiltersData();
    }, []);

    useEffect(() => {
        loadTenders(true);
    }, [search, status, customerId, ownerId, departmentId]);

    const handleClearFilters = () => {
        setSearch('');
        setStatus('');
        setCustomerId('');
        setOwnerId('');
        setDepartmentId('');
        setSearchParams({});
    };

    const handleOpenCreateModal = () => {
        setEditingId(null);
        setFormData({
            tenderNo: '',
            title: '',
            customerId: '',
            value: '',
            deadlineDate: '',
            submissionDate: '',
            departmentId: '',
            ownerId: currentUser?.id || '',
            status: 'Active',
            description: ''
        });
        setShowModal(true);
    };

    const handleOpenEditModal = (t) => {
        setEditingId(t._id);
        setFormData({
            tenderNo: t.tenderNo || '',
            title: t.title || '',
            customerId: t.customerId?._id || t.customerId || '',
            value: t.value || 0,
            deadlineDate: t.deadlineDate ? new Date(t.deadlineDate).toISOString().split('T')[0] : '',
            submissionDate: t.submissionDate ? new Date(t.submissionDate).toISOString().split('T')[0] : '',
            departmentId: t.departmentId?._id || t.departmentId || '',
            ownerId: t.ownerId?._id || t.ownerId || '',
            status: t.status || 'Active',
            description: t.description || ''
        });
        setShowModal(true);
    };

    const handleDeleteTender = async (id) => {
        if (!window.confirm('Are you sure you want to delete this tender? This action cannot be undone.')) return;
        try {
            await tenderService.deleteTender(id);
            toast.success('Tender deleted successfully.');
            loadTenders(false);
            if (selectedTender?._id === id) setSelectedTender(null);
        } catch (err) {
            console.error('Delete tender error:', err);
            toast.error('Failed to delete tender.');
        }
    };

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        if (!formData.title || !formData.customerId || !formData.deadlineDate) {
            toast.warning('Tender Title, Customer, and Deadline Date are required.');
            return;
        }

        setSubmitting(true);
        try {
            if (editingId) {
                await tenderService.updateTender(editingId, formData);
                toast.success('Tender updated successfully.');
            } else {
                await tenderService.createTender(formData);
                toast.success('Tender created successfully.');
            }
            setShowModal(false);
            loadTenders(false);
        } catch (err) {
            console.error('Save tender error:', err);
            toast.error(err.response?.data?.message || 'Error saving tender details.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-teal-500 to-teal-700 flex items-center justify-center text-white shadow-md">
                        <MdAssignment size={24} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Tenders Register</h1>
                        <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Manage, Search, and Progression Log</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <button
                        onClick={handleExportTenders}
                        className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-teal-50 hover:bg-teal-100 border border-teal-200 text-teal-700 text-sm font-black rounded-xl transition-all"
                    >
                        <MdDownload size={18} />
                        Export
                    </button>
                    <button
                        onClick={() => setIsImportModalOpen(true)}
                        className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-sm font-black rounded-xl transition-all"
                    >
                        <MdCloudUpload size={18} />
                        Import
                    </button>
                    <button
                        onClick={handleOpenCreateModal}
                        className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white text-sm font-black rounded-xl shadow-lg hover:shadow-xl transition-all"
                    >
                        <MdAdd size={20} />
                        Create Tender
                    </button>
                </div>
            </div>

            {/* Filter Section */}
            <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm space-y-4">
                <div className="flex flex-wrap gap-4">
                    {/* Search */}
                    <div className="flex-1 min-w-[200px] relative">
                        <input
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Search by tender no, title..."
                            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 text-sm text-slate-700 font-semibold rounded-xl focus:outline-none focus:border-teal-500"
                        />
                        <MdSearch size={20} className="absolute left-3.5 top-2.5 text-slate-400" />
                    </div>

                    {/* Status */}
                    <select
                        value={status}
                        onChange={e => setStatus(e.target.value)}
                        className="px-3 py-2 bg-slate-50 border border-slate-200 text-sm text-slate-700 font-semibold rounded-xl focus:outline-none focus:border-teal-500"
                    >
                        <option value="">All Statuses</option>
                        {Object.keys(STATUS_CLASSES).map(s => (
                            <option key={s} value={s}>{s}</option>
                        ))}
                    </select>

                    {/* Client */}
                    <select
                        value={customerId}
                        onChange={e => setCustomerId(e.target.value)}
                        className="px-3 py-2 bg-slate-50 border border-slate-200 text-sm text-slate-700 font-semibold rounded-xl focus:outline-none focus:border-teal-500 max-w-[200px]"
                    >
                        <option value="">All Clients</option>
                        {customers.map(c => (
                            <option key={c._id} value={c._id}>{c.companyName || c.customerName}</option>
                        ))}
                    </select>

                    {/* Department */}
                    <select
                        value={departmentId}
                        onChange={e => setDepartmentId(e.target.value)}
                        className="px-3 py-2 bg-slate-50 border border-slate-200 text-sm text-slate-700 font-semibold rounded-xl focus:outline-none focus:border-teal-500"
                    >
                        <option value="">All Departments</option>
                        {departments.map(d => (
                            <option key={d._id} value={d._id}>{d.name}</option>
                        ))}
                    </select>

                    {/* Owner */}
                    <select
                        value={ownerId}
                        onChange={e => setOwnerId(e.target.value)}
                        className="px-3 py-2 bg-slate-50 border border-slate-200 text-sm text-slate-700 font-semibold rounded-xl focus:outline-none focus:border-teal-500"
                    >
                        <option value="">All Owners</option>
                        {owners.map(o => (
                            <option key={o._id} value={o._id}>{o.name}</option>
                        ))}
                    </select>

                    {/* Clear Button */}
                    {(search || status || customerId || ownerId || departmentId) && (
                        <button
                            onClick={handleClearFilters}
                            className="flex items-center gap-1 text-xs font-bold text-rose-500 hover:text-rose-700 px-2 transition"
                        >
                            <MdClose size={16} />
                            Clear Filters
                        </button>
                    )}
                </div>
            </div>

            {/* List Register Table */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 space-y-3">
                        <div className="w-12 h-12 border-4 border-teal-200 border-t-teal-600 rounded-full animate-spin"></div>
                        <p className="text-slate-400 font-bold uppercase text-[10px] tracking-wider animate-pulse">Loading Register...</p>
                    </div>
                ) : tenders.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50/50 border-b border-slate-100 text-xs font-bold text-slate-400 uppercase">
                                    <th className="py-3.5 px-6">Tender No</th>
                                    <th className="py-3.5 px-6">Title</th>
                                    <th className="py-3.5 px-6">Client</th>
                                    <th className="py-3.5 px-6">Department</th>
                                    <th className="py-3.5 px-6">Status</th>
                                    <th className="py-3.5 px-6 text-right">Value</th>
                                    <th className="py-3.5 px-6">Deadline Date</th>
                                    <th className="py-3.5 px-6 text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 text-sm font-semibold text-slate-600">
                                {tenders.map((t) => (
                                    <tr key={t._id} className="hover:bg-slate-50/40 transition">
                                        <td className="py-3 px-6 text-teal-600 font-bold">{t.tenderNo}</td>
                                        <td className="py-3 px-6 text-slate-900 font-bold max-w-xs truncate">{t.title}</td>
                                        <td className="py-3 px-6">{t.customerId?.companyName || t.customerId?.customerName || '-'}</td>
                                        <td className="py-3 px-6">{t.departmentId?.name || '-'}</td>
                                        <td className="py-3 px-6">
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-bold ${STATUS_CLASSES[t.status] || 'bg-slate-50 border-slate-100 text-slate-600'}`}>
                                                {t.status}
                                            </span>
                                        </td>
                                        <td className="py-3 px-6 text-right text-slate-900 font-bold">{formatCurrency(t.value)}</td>
                                        <td className="py-3 px-6">
                                            {t.deadlineDate ? new Date(t.deadlineDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}
                                        </td>
                                        <td className="py-3 px-6">
                                            <div className="flex items-center justify-center gap-2">
                                                <button
                                                    onClick={() => setSelectedTender(t)}
                                                    className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition"
                                                    title="View Details"
                                                >
                                                    <MdInfo size={18} />
                                                </button>
                                                <button
                                                    onClick={() => handleOpenEditModal(t)}
                                                    className="p-1.5 rounded-lg hover:bg-teal-50 text-teal-600 hover:text-teal-800 transition"
                                                    title="Edit"
                                                >
                                                    <MdEdit size={18} />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteTender(t._id)}
                                                    className="p-1.5 rounded-lg hover:bg-rose-50 text-rose-600 hover:text-rose-800 transition"
                                                    title="Delete"
                                                >
                                                    <MdDelete size={18} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="py-20 text-center text-slate-400 font-bold text-sm">No tenders found matching filters.</div>
                )}
            </div>

            {/* Create/Edit Modal */}
            <Modal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                title={editingId ? 'Edit Tender Details' : 'Create New Tender'}
                footer={
                    <>
                        <button
                            type="button"
                            onClick={() => setShowModal(false)}
                            className="px-4 py-2 border border-slate-200 text-slate-500 text-sm font-bold rounded-xl hover:bg-slate-50 transition"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            form="tender-form"
                            disabled={submitting}
                            className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 disabled:bg-teal-400 text-white text-sm font-black rounded-xl shadow-md transition"
                        >
                            {submitting ? 'Saving...' : 'Save Tender'}
                        </button>
                    </>
                }
            >
                <form id="tender-form" onSubmit={handleFormSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Tender No */}
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Tender Number</label>
                            <input
                                type="text"
                                value={formData.tenderNo}
                                onChange={e => setFormData({ ...formData, tenderNo: e.target.value })}
                                placeholder="Auto-generated if left empty"
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 text-sm text-slate-700 font-semibold rounded-xl focus:outline-none focus:border-teal-500"
                            />
                        </div>

                        {/* Title */}
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Tender Title <span className="text-rose-500">*</span></label>
                            <input
                                type="text"
                                value={formData.title}
                                onChange={e => setFormData({ ...formData, title: e.target.value })}
                                placeholder="Enter tender title"
                                required
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 text-sm text-slate-700 font-semibold rounded-xl focus:outline-none focus:border-teal-500"
                            />
                        </div>

                        {/* Customer */}
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Client / Customer <span className="text-rose-500">*</span></label>
                            <select
                                value={formData.customerId}
                                onChange={e => setFormData({ ...formData, customerId: e.target.value })}
                                required
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 text-sm text-slate-700 font-semibold rounded-xl focus:outline-none focus:border-teal-500"
                            >
                                <option value="">Select Client</option>
                                {customers.map(c => (
                                    <option key={c._id} value={c._id}>{c.companyName || c.customerName}</option>
                                ))}
                            </select>
                        </div>

                        {/* Value */}
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Tender Value (₹) <span className="text-rose-500">*</span></label>
                            <input
                                type="number"
                                value={formData.value}
                                onChange={e => setFormData({ ...formData, value: e.target.value })}
                                placeholder="e.g. 500000"
                                required
                                min="0"
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 text-sm text-slate-700 font-semibold rounded-xl focus:outline-none focus:border-teal-500"
                            />
                        </div>

                        {/* Deadline Date */}
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Deadline Date <span className="text-rose-500">*</span></label>
                            <input
                                type="date"
                                value={formData.deadlineDate}
                                onChange={e => setFormData({ ...formData, deadlineDate: e.target.value })}
                                required
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 text-sm text-slate-700 font-semibold rounded-xl focus:outline-none focus:border-teal-500"
                            />
                        </div>

                        {/* Submission Date */}
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Submission Date</label>
                            <input
                                type="date"
                                value={formData.submissionDate}
                                onChange={e => setFormData({ ...formData, submissionDate: e.target.value })}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 text-sm text-slate-700 font-semibold rounded-xl focus:outline-none focus:border-teal-500"
                            />
                        </div>

                        {/* Department */}
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Department</label>
                            <select
                                value={formData.departmentId}
                                onChange={e => setFormData({ ...formData, departmentId: e.target.value })}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 text-sm text-slate-700 font-semibold rounded-xl focus:outline-none focus:border-teal-500"
                            >
                                <option value="">Select Department</option>
                                {departments.map(d => (
                                    <option key={d._id} value={d._id}>{d.name}</option>
                                ))}
                            </select>
                        </div>

                        {/* Owner */}
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Owner / Assignee</label>
                            <select
                                value={formData.ownerId}
                                onChange={e => setFormData({ ...formData, ownerId: e.target.value })}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 text-sm text-slate-700 font-semibold rounded-xl focus:outline-none focus:border-teal-500"
                            >
                                <option value="">Select Owner</option>
                                {owners.map(u => (
                                    <option key={u._id} value={u._id}>{u.name}</option>
                                ))}
                            </select>
                        </div>

                        {/* Status */}
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Status</label>
                            <select
                                value={formData.status}
                                onChange={e => setFormData({ ...formData, status: e.target.value })}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 text-sm text-slate-700 font-semibold rounded-xl focus:outline-none focus:border-teal-500"
                            >
                                {Object.keys(STATUS_CLASSES).map(s => (
                                    <option key={s} value={s}>{s}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Description */}
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Description / Scope</label>
                        <textarea
                            value={formData.description}
                            onChange={e => setFormData({ ...formData, description: e.target.value })}
                            rows="3"
                            placeholder="Enter additional details..."
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 text-sm text-slate-700 font-semibold rounded-xl focus:outline-none focus:border-teal-500"
                        ></textarea>
                    </div>
                </form>
            </Modal>

            {/* View Details Modal */}
            <Modal
                isOpen={!!selectedTender}
                onClose={() => setSelectedTender(null)}
                title={`Tender Details - ${selectedTender?.tenderNo || ''}`}
                maxWidth="max-w-xl"
                footer={
                    <>
                        <button
                            onClick={() => {
                                if (selectedTender) {
                                    handleOpenEditModal(selectedTender);
                                    setSelectedTender(null);
                                }
                            }}
                            className="flex-1 md:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-bold rounded-xl transition"
                        >
                            <MdEdit size={18} />
                            Edit Tender
                        </button>
                        <button
                            onClick={() => {
                                if (selectedTender) {
                                    handleDeleteTender(selectedTender._id);
                                }
                            }}
                            className="flex-1 md:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 text-sm font-bold rounded-xl transition"
                        >
                            <MdDelete size={18} />
                            Delete Tender
                        </button>
                    </>
                }
            >
                {selectedTender && (
                    <div className="space-y-6">
                        {/* Summary Box */}
                        <div className="space-y-1">
                            <h3 className="text-xl font-black text-slate-900 leading-tight">{selectedTender.title}</h3>
                            <p className="text-sm font-semibold text-slate-500">{selectedTender.customerId?.companyName || selectedTender.customerId?.customerName || 'No Client Specified'}</p>
                        </div>

                        {/* Highlights Grid */}
                        <div className="grid grid-cols-2 gap-4 bg-slate-50 rounded-2xl p-4 border border-slate-100">
                            <div>
                                <span className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">Value</span>
                                <span className="text-lg font-black text-slate-800">{formatCurrency(selectedTender.value)}</span>
                            </div>
                            <div>
                                <span className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">Status</span>
                                <span className={`inline-flex px-2.5 py-0.5 rounded-full border text-xs font-bold ${STATUS_CLASSES[selectedTender.status]}`}>
                                    {selectedTender.status}
                                </span>
                            </div>
                        </div>

                        {/* Information Fields */}
                        <div className="space-y-4 text-sm font-semibold text-slate-700">
                            <div className="flex justify-between py-2 border-b border-slate-100">
                                <span className="text-slate-400 font-bold text-xs uppercase">Department</span>
                                <span>{selectedTender.departmentId?.name || 'Unassigned'}</span>
                            </div>
                            <div className="flex justify-between py-2 border-b border-slate-100">
                                <span className="text-slate-400 font-bold text-xs uppercase">Owner</span>
                                <span>{selectedTender.ownerId?.name || 'Unassigned'}</span>
                            </div>
                            <div className="flex justify-between py-2 border-b border-slate-100">
                                <span className="text-slate-400 font-bold text-xs uppercase">Deadline Date</span>
                                <span className="flex items-center gap-1">
                                    <MdOutlineAccessTime size={16} className="text-slate-400" />
                                    {selectedTender.deadlineDate ? new Date(selectedTender.deadlineDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}
                                </span>
                            </div>
                            <div className="flex justify-between py-2 border-b border-slate-100">
                                <span className="text-slate-400 font-bold text-xs uppercase">Submission Date</span>
                                <span>{selectedTender.submissionDate ? new Date(selectedTender.submissionDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Not Submitted'}</span>
                            </div>
                        </div>

                        {/* Description */}
                        {selectedTender.description && (
                            <div className="space-y-1.5">
                                <h4 className="text-xs font-bold text-slate-400 uppercase">Scope & Description</h4>
                                <p className="text-sm text-slate-600 bg-slate-50 rounded-xl p-3 border border-slate-100 leading-relaxed whitespace-pre-line">{selectedTender.description}</p>
                            </div>
                        )}

                        {/* Activity Log */}
                        <div className="space-y-3">
                            <h4 className="text-xs font-bold text-slate-400 uppercase">Progression Log / History</h4>
                            <div className="space-y-4 pl-3 border-l-2 border-teal-100">
                                {selectedTender.activities && selectedTender.activities.map((act, i) => (
                                    <div key={i} className="relative space-y-1">
                                        <div className="absolute -left-[18px] top-1.5 w-2 h-2 rounded-full bg-teal-500 border border-white"></div>
                                        <div className="flex items-center justify-between text-xxs font-bold text-slate-400">
                                            <span>{act.userName}</span>
                                            <span>{new Date(act.timestamp).toLocaleString()}</span>
                                        </div>
                                        <p className="text-xs font-semibold text-slate-700 leading-snug">{act.action}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </Modal>

            {/* Import Modal */}
            <ImportModal
                isOpen={isImportModalOpen}
                onClose={() => setIsImportModalOpen(false)}
                title="Import Tenders Database"
                onImport={async (file) => {
                    const result = await importService.importTenders(file);
                    loadTenders(false);
                    return result;
                }}
                onDownloadTemplate={importService.getTenderTemplate}
            />
        </div>
    );
};

export default TenderRegister;
