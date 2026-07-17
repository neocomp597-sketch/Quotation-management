import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MdAdd, MdSearch, MdEdit, MdDelete, MdPerson, MdEmail, MdPhone, MdLocationOn, MdBusiness, MdCloudUpload, MdVisibility, MdFileUpload, MdCheckBox, MdCheckBoxOutlineBlank, MdDeleteSweep, MdFileDownload } from 'react-icons/md';
import { toast } from 'react-toastify';
import * as XLSX from 'xlsx';
import { customerService, uploadService, importService, territoryService, userService, csmService } from '../services/api';
import Modal from '../components/Modal';
import ImportModal from '../components/ImportModal';
import PaginationControls from '../components/PaginationControls';
import { resolveImageUrl } from '../utils/helpers';
import CustomerPricingDashboard from './CustomerPricingDashboard';
import { useSubmitGuard } from '../hooks/useSubmitGuard';

const LIST_PAGE_SIZE = 20;

const Customers = () => {
    const navigate = useNavigate();
    const [customers, setCustomers] = useState([]);
    const [activeProfileTab, setActiveProfileTab] = useState('details');
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [page, setPage] = useState(1);
    const [pagination, setPagination] = useState({ page: 1, limit: LIST_PAGE_SIZE, total: 0, pages: 1 });
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCustomer, setEditingCustomer] = useState(null);
    const [isUploading, setIsUploading] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [territories, setTerritories] = useState([]);
    const [selectedTerritory, setSelectedTerritory] = useState('');

    // Bulk selection state
    const [selectedIds, setSelectedIds] = useState([]);
    const [isBulkActionLoading, setIsBulkActionLoading] = useState(false);

    // For full-screen image viewing
    const [viewCustomer, setViewCustomer] = useState(null);
    const [users, setUsers] = useState([]);
    const [customerAssets, setCustomerAssets] = useState([]);
    const [assetsLoading, setAssetsLoading] = useState(false);

    const [formData, setFormData] = useState({
        customerName: '',
        companyName: '',
        mobile: '',
        email: '',
        gstin: '',
        billingAddress: {
            line1: '',
            city: '',
            state: '',
            pincode: ''
        },
        defaultDiscount: 0,
        logoUrl: '',
        territory: '',
        pan: '',
        outstanding: 0,
        industry: 'Other',
        status: 'Prospect',
        segment: 'Retail',
        owner: '',
        notes: ''
    });

    useEffect(() => {
        const fetchTerritories = async () => {
            try {
                const res = await territoryService.getAll();
                setTerritories(res.data || []);
            } catch (err) {
                console.error("Error fetching territories:", err);
            }
        };
        const fetchUsers = async () => {
            try {
                const res = await userService.getAll();
                setUsers(Array.isArray(res.data) ? res.data : res.data?.data || []);
            } catch (err) {
                console.error("Error fetching users:", err);
            }
        };
        fetchTerritories();
        fetchUsers();
    }, []);

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchTerm.trim());
            setPage(1);
        }, 300);

        return () => clearTimeout(timer);
    }, [searchTerm]);

    useEffect(() => {
        fetchCustomers();
    }, [page, debouncedSearch, selectedTerritory]);

    const fetchCustomers = async () => {
        setLoading(true);
        try {
            const res = await customerService.getAll({
                page,
                limit: LIST_PAGE_SIZE,
                search: debouncedSearch || undefined,
                territory: selectedTerritory || undefined,
            });
            const payload = res.data;
            setCustomers(Array.isArray(payload) ? payload : payload.data || []);
            setPagination(payload.pagination || {
                page: 1,
                limit: LIST_PAGE_SIZE,
                total: Array.isArray(payload) ? payload.length : 0,
                pages: 1,
            });
        } catch (err) {
            console.error("Error fetching customers:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (customer = null) => {
        if (customer) {
            setEditingCustomer(customer);
            setFormData({
                ...customer,
                billingAddress: { ...customer.billingAddress },
                territory: customer.territory?._id || customer.territory || '',
                owner: customer.owner?._id || customer.owner || '',
                pan: customer.pan || '',
                outstanding: customer.outstanding || 0,
                industry: customer.industry || 'Other',
                status: customer.status || 'Prospect',
                segment: customer.segment || 'Retail'
            });
        } else {
            setEditingCustomer(null);
            setFormData({
                customerName: '',
                companyName: '',
                mobile: '',
                email: '',
                gstin: '',
                billingAddress: {
                    line1: '',
                    city: '',
                    state: '',
                    pincode: ''
                },
                defaultDiscount: 0,
                logoUrl: '',
                territory: '',
                pan: '',
                outstanding: 0,
                industry: 'Other',
                status: 'Prospect',
                segment: 'Retail',
                owner: '',
                notes: ''
            });
        }
        setIsModalOpen(true);
    };

    const handleFormChange = (e) => {
        const { name, value } = e.target;
        if (name.includes('.')) {
            const [parent, child] = name.split('.');
            setFormData(prev => ({
                ...prev,
                [parent]: {
                    ...prev[parent],
                    [child]: value
                }
            }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setIsUploading(true);
        try {
            const res = await uploadService.uploadImage(file);
            setFormData(prev => ({ ...prev, logoUrl: res.data.imageUrl }));
            toast.success('Image uploaded successfully!');
        } catch (err) {
            console.error("Upload error:", err);
            toast.error('Failed to upload image');
        } finally {
            setIsUploading(false);
        }
    };

    const { isSubmitting: isSaving, execute: handleSubmit } = useSubmitGuard(async (e) => {
        e?.preventDefault?.();

        // Validate required fields
        if (!formData.companyName?.trim()) {
            toast.error('Company Trade Name is required');
            return;
        }
        if (!formData.customerName?.trim()) {
            toast.error('Customer Code is required');
            return;
        }

        try {
            const payload = {
                ...formData,
                territory: formData.territory || undefined
            };
            if (editingCustomer) {
                await customerService.update(editingCustomer._id, payload);
                toast.success('Customer updated successfully!');
            } else {
                await customerService.create(payload);
                toast.success('Customer created successfully!');
            }
            fetchCustomers();
            setIsModalOpen(false);
        } catch (err) {
            console.error("Error saving customer:", err);
            toast.error(err.response?.data?.message || 'Error saving customer data');
        }
    });

    const handleDelete = async (id) => {
        if (window.confirm("Are you sure you want to delete this customer?")) {
            try {
                await customerService.delete(id);
                toast.success('Customer deleted successfully!');
                fetchCustomers();
            } catch (err) {
                console.error("Error deleting customer:", err);
                toast.error('Failed to delete customer');
            }
        }
    };

    // Bulk selection handlers
    const toggleSelectAll = () => {
        if (selectedIds.length === filteredCustomers.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(filteredCustomers.map(c => c._id));
        }
    };

    const toggleSelectOne = (id) => {
        setSelectedIds(prev =>
            prev.includes(id)
                ? prev.filter(i => i !== id)
                : [...prev, id]
        );
    };

    const handleBulkDelete = async () => {
        if (selectedIds.length === 0) return;

        if (window.confirm(`Are you sure you want to delete ${selectedIds.length} customers? This cannot be undone.`)) {
            setIsBulkActionLoading(true);
            try {
                await customerService.bulkDelete(selectedIds);
                setSelectedIds([]);
                fetchCustomers();
                toast.success(`${selectedIds.length} customers deleted successfully`);
            } catch (err) {
                console.error("Error bulk deleting:", err);
                toast.error('Failed to delete customers');
            } finally {
                setIsBulkActionLoading(false);
            }
        }
    };

    const exportToExcel = async () => {
        setLoading(true);
        try {
            const res = await customerService.getAll({
                limit: 10000,
                search: debouncedSearch || undefined,
                territory: selectedTerritory || undefined,
            });
            const exportCustomers = Array.isArray(res.data) ? res.data : res.data?.data || [];
            if (!exportCustomers.length) {
                toast.info('No customers found to export');
                return;
            }

            const exportData = exportCustomers.map((c) => ({
                'Company Trade Name': c.companyName || '',
                'Customer Code': c.customerName || '',
                'Mobile': c.mobile || '',
                'Email': c.email || '',
                'GSTIN': c.gstin || '',
                'Billing Address': c.billingAddress?.line1 || '',
                'City': c.billingAddress?.city || '',
                'State': c.billingAddress?.state || '',
                'Pincode': c.billingAddress?.pincode || '',
                'Default Discount (%)': c.defaultDiscount || 0,
                'Territory': c.territory?.name || 'Unassigned',
                'Notes': c.notes || ''
            }));

            const ws = XLSX.utils.json_to_sheet(exportData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Customers');
            XLSX.writeFile(wb, `Customers_Master_${new Date().toISOString().slice(0, 10)}.xlsx`);
            toast.success('Export completed successfully');
        } catch (err) {
            console.error('Export customers error:', err);
            toast.error('Failed to export customers');
        } finally {
            setLoading(false);
        }
    };

    const filteredCustomers = customers;

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight font-outfit uppercase">Customer Master</h1>
                    <p className="text-slate-500 font-medium">Manage your distributor and retail partners.</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={exportToExcel}
                        className="flex items-center justify-center gap-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-5 py-3 rounded-2xl font-bold transition-all shadow-sm uppercase text-xs tracking-widest active:scale-95"
                    >
                        <MdFileDownload size={20} />
                        <span>Export</span>
                    </button>
                    <button
                        onClick={() => setIsImportModalOpen(true)}
                        className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-3 rounded-2xl font-bold transition-all shadow-xl shadow-emerald-600/20 uppercase text-xs tracking-widest active:scale-95"
                    >
                        <MdFileUpload size={20} />
                        <span>Import</span>
                    </button>
                    <button
                        onClick={() => handleOpenModal()}
                        className="flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-2xl font-bold transition-all shadow-xl shadow-primary-600/20 uppercase text-xs tracking-widest active:scale-95"
                    >
                        <MdAdd size={20} />
                        <span>Add New Customer</span>
                    </button>
                </div>
            </div>

            {/* Bulk Action Toolbar */}
            {selectedIds.length > 0 && (
                <div className="bg-slate-900 rounded-2xl p-4 flex items-center justify-between gap-4 shadow-xl">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center">
                            <MdCheckBox size={24} className="text-primary-400" />
                        </div>
                        <div>
                            <div className="text-white font-black text-sm">{selectedIds.length} Selected</div>
                            <div className="text-slate-400 text-xs">Choose an action below</div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleBulkDelete}
                            disabled={isBulkActionLoading}
                            className="flex items-center gap-2 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-xs uppercase tracking-widest transition-all disabled:opacity-50"
                        >
                            <MdDeleteSweep size={16} />
                            Delete All
                        </button>
                        <button
                            onClick={() => setSelectedIds([])}
                            className="px-4 py-2.5 text-slate-400 hover:text-white transition-colors font-bold text-xs uppercase tracking-widest"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            <div className="mobile-master-shell bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
                <div className="mobile-master-toolbar p-6 border-b border-slate-50 flex flex-col md:flex-row gap-4 items-center bg-slate-50/30 sticky top-0 z-10 w-full">
                    <div className="relative flex-1 w-full text-slate-400 focus-within:text-primary-600 transition-colors">
                        <MdSearch className="absolute left-4 top-1/2 -translate-y-1/2" size={20} />
                        <input
                            type="text"
                            placeholder="Search by Name, Company or GSTIN..."
                            className="w-full pl-12 pr-4 py-3.5 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 outline-none text-sm text-slate-900 transition-all font-medium"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="w-full md:w-64">
                        <select
                            value={selectedTerritory}
                            onChange={(e) => {
                                setSelectedTerritory(e.target.value);
                                setPage(1);
                            }}
                            className="w-full px-4 py-3.5 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 outline-none text-sm text-slate-900 font-medium transition-all"
                        >
                            <option value="">All Territories</option>
                            {territories.map(t => (
                                <option key={t._id} value={t._id}>{t.name} ({t.type})</option>
                            ))}
                        </select>
                    </div>
                </div>

                {loading ? (
                    <div className="p-20 text-center">
                        <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-primary-500 border-t-transparent mb-4"></div>
                        <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Syncing Customer Data...</p>
                    </div>
                ) : (
                    <>
                        {/* Mobile Card View */}
                        <div className="md:hidden p-4 space-y-4 bg-slate-50/50">
                            {filteredCustomers.map((c) => (
                                <div key={c._id} className={`mobile-master-card bg-white p-5 rounded-2xl border shadow-sm transition-all ${selectedIds.includes(c._id) ? 'border-primary-500 ring-1 ring-primary-500' : 'border-slate-100'}`}>
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="flex items-center gap-3">
                                            <div
                                                className="h-10 w-10 rounded-xl bg-slate-50 border border-slate-100 p-1 flex-shrink-0"
                                                onClick={() => setViewCustomer(c)}
                                            >
                                                {c.logoUrl ? (
                                                    <img src={resolveImageUrl(c.logoUrl)} alt="" className="h-full w-full object-contain" />
                                                ) : (
                                                    <div className="h-full w-full flex items-center justify-center text-primary-600 font-black text-xs">
                                                        {c.companyName?.substring(0, 1)}
                                                    </div>
                                                )}
                                            </div>
                                            <div>
                                                <div 
                                                    className="font-bold text-primary-600 hover:text-primary-800 cursor-pointer hover:underline text-sm"
                                                    onClick={() => navigate(`/customers/${c._id}/360`)}
                                                >
                                                    {c.companyName}
                                                </div>
                                                <div className="text-xs text-slate-500">{c.customerName}</div>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => toggleSelectOne(c._id)}
                                            className="p-1"
                                        >
                                            {selectedIds.includes(c._id) ? (
                                                <MdCheckBox size={24} className="text-primary-600" />
                                            ) : (
                                                <MdCheckBoxOutlineBlank size={24} className="text-slate-300" />
                                            )}
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-xs mb-4">
                                        <div className="flex items-center gap-2 text-slate-600 font-medium">
                                            <MdPhone size={14} className="text-slate-400" /> {c.mobile}
                                        </div>
                                        <div className="flex items-center gap-2 text-slate-600 font-medium overflow-hidden">
                                            <MdEmail size={14} className="text-slate-400 flex-shrink-0" /> <span className="truncate">{c.email}</span>
                                        </div>
                                        <div className="col-span-2 flex items-center gap-2 text-slate-600 font-medium justify-between">
                                            <div className="flex items-center gap-2">
                                                <MdLocationOn size={14} className="text-slate-400" /> {c.billingAddress?.city}, {c.billingAddress?.state}
                                            </div>
                                            {c.territory && (
                                                <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100/50">
                                                    {c.territory.name}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                                        <span className="font-mono text-[10px] bg-slate-100 px-2 py-1 rounded-md text-slate-500 font-bold uppercase tracking-wider">
                                            {c.gstin || 'N/A'}
                                        </span>
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={() => setViewCustomer(c)}
                                                className="p-2 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-all"
                                            >
                                                <MdVisibility size={18} />
                                            </button>
                                            <button
                                                onClick={() => handleOpenModal(c)}
                                                className="p-2 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-all"
                                            >
                                                <MdEdit size={18} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(c._id)}
                                                className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                                            >
                                                <MdDelete size={18} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {filteredCustomers.length === 0 && (
                                <div className="text-center p-8 text-slate-400 text-sm">No customers found</div>
                            )}
                        </div>

                        {/* Desktop Table View */}
                        <div className="hidden md:block overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50/50 text-slate-400 text-[10px] uppercase font-black tracking-widest border-b border-slate-100">
                                    <tr>
                                        <th className="px-4 py-5 w-12">
                                            <button
                                                onClick={toggleSelectAll}
                                                className="p-1 hover:bg-slate-200 rounded-lg transition-colors"
                                            >
                                                {selectedIds.length === filteredCustomers.length && filteredCustomers.length > 0 ? (
                                                    <MdCheckBox size={20} className="text-primary-600" />
                                                ) : (
                                                    <MdCheckBoxOutlineBlank size={20} />
                                                )}
                                            </button>
                                        </th>
                                        <th className="px-4 py-5">Company & Info</th>
                                        <th className="px-8 py-5">GSTIN</th>
                                        <th className="px-8 py-5">Location</th>
                                        <th className="px-8 py-5">Territory</th>
                                        <th className="px-8 py-5 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {filteredCustomers.map((c) => (
                                        <tr key={c._id} className={`hover:bg-slate-50/50 transition-colors group ${selectedIds.includes(c._id) ? 'bg-primary-50/50' : ''}`}>
                                            <td className="px-4 py-5">
                                                <button
                                                    onClick={() => toggleSelectOne(c._id)}
                                                    className="p-1 hover:bg-slate-200 rounded-lg transition-colors"
                                                >
                                                    {selectedIds.includes(c._id) ? (
                                                        <MdCheckBox size={20} className="text-primary-600" />
                                                    ) : (
                                                        <MdCheckBoxOutlineBlank size={20} className="text-slate-300" />
                                                    )}
                                                </button>
                                            </td>
                                            <td className="px-4 py-5">
                                                <div className="flex items-center gap-4">
                                                    <div
                                                        className="h-10 w-10 rounded-xl bg-white border border-slate-100 p-1.5 flex-shrink-0 cursor-pointer hover:border-primary-500 transition-all"
                                                        onClick={() => setViewCustomer(c)}
                                                    >
                                                        {c.logoUrl ? (
                                                            <img src={resolveImageUrl(c.logoUrl)} alt="" className="h-full w-full object-contain" />
                                                        ) : (
                                                            <div className="h-full w-full flex items-center justify-center text-primary-600 bg-primary-50 rounded-lg font-black text-xs">
                                                                {c.companyName?.substring(0, 1)}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div>
                                                        <div 
                                                            className="font-bold text-primary-600 hover:text-primary-800 cursor-pointer hover:underline"
                                                            onClick={() => navigate(`/customers/${c._id}/360`)}
                                                        >
                                                            {c.companyName}
                                                        </div>
                                                        <div className="text-xs text-slate-400 font-medium">{c.customerName}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-8 py-5">
                                                <span className="font-mono text-[11px] bg-primary-50 px-3 py-1.5 rounded-lg text-primary-700 font-bold uppercase tracking-wider border border-primary-100">
                                                    {c.gstin}
                                                </span>
                                            </td>
                                            <td className="px-8 py-5">
                                                <div className="text-sm font-bold text-slate-700">{c.billingAddress?.city}</div>
                                                <div className="text-[10px] text-slate-400 font-black uppercase tracking-tighter">{c.billingAddress?.state}</div>
                                            </td>
                                            <td className="px-8 py-5">
                                                {c.territory ? (
                                                    <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-100/50">
                                                        {c.territory.name}
                                                    </span>
                                                ) : (
                                                    <span className="text-xs font-bold text-slate-400">Unassigned</span>
                                                )}
                                            </td>
                                            <td className="px-8 py-5 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        onClick={() => setViewCustomer(c)}
                                                        className="p-2.5 text-slate-500 hover:bg-slate-50 rounded-xl transition-all shadow-sm bg-white border border-slate-100"
                                                        title="View Details"
                                                    >
                                                        <MdVisibility size={18} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleOpenModal(c)}
                                                        className="p-2.5 text-primary-600 hover:bg-primary-50 rounded-xl transition-all shadow-sm bg-white border border-slate-100"
                                                        title="Edit Customer"
                                                    >
                                                        <MdEdit size={18} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(c._id)}
                                                        className="p-2.5 text-rose-500 hover:bg-rose-50 rounded-xl transition-all shadow-sm bg-white border border-slate-100"
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
                        <PaginationControls pagination={pagination} onPageChange={setPage} />
                    </>
                )}
            </div>

            {/* Form Modal */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={editingCustomer ? "Update Records" : "New Customer"}
                maxWidth="max-w-4xl"
                footer={
                    <>
                        <button
                            onClick={() => setIsModalOpen(false)}
                            className="px-6 py-2.5 text-slate-500 font-black hover:text-slate-900 transition-all uppercase text-[10px] tracking-widest"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={isSaving}
                            className="bg-primary-600 hover:bg-primary-700 text-white px-10 py-3.5 rounded-2xl font-black transition-all shadow-xl shadow-primary-600/20 uppercase text-[10px] tracking-widest active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100"
                        >
                            {isSaving ? "Saving..." : editingCustomer ? "Commit Changes" : "Register Customer"}
                        </button>
                    </>
                }
            >
                <form className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8 py-2">
                    <div className="space-y-8">
                        <div>
                            <h4 className="text-[10px] font-black text-primary-600 uppercase tracking-[0.2em] mb-6 flex items-center gap-3">
                                <span className="h-px flex-1 bg-primary-100"></span>
                                Identity & Branding
                                <span className="h-px flex-1 bg-primary-100"></span>
                            </h4>
                            <div className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Company Trade Name <span className="text-rose-500">*</span></label>
                                    <div className="relative">
                                        <MdBusiness className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                                        <input
                                            type="text"
                                            name="companyName"
                                            value={formData.companyName}
                                            onChange={handleFormChange}
                                            className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all outline-none text-sm font-bold placeholder:font-normal placeholder:text-slate-300"
                                            placeholder="Enter registered company name"
                                            required
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Customer Code <span className="text-rose-500">*</span></label>
                                    <div className="relative">
                                        <MdPerson className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                                        <input
                                            type="text"
                                            name="customerName"
                                            value={formData.customerName}
                                            onChange={handleFormChange}
                                            className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all outline-none text-sm font-bold placeholder:font-normal placeholder:text-slate-300"
                                            placeholder="Enter customer code"
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Brand Logo (Upload or URL)</label>
                                    <div className="flex flex-col gap-4">
                                        <div className="flex gap-4">
                                            <label className="flex-1 flex items-center justify-center gap-2 px-4 py-3.5 bg-primary-50 border-2 border-dashed border-primary-200 rounded-2xl cursor-pointer hover:bg-primary-100 transition-all group">
                                                <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} disabled={isUploading} />
                                                <MdCloudUpload className={`text-primary-600 ${isUploading ? 'animate-bounce' : 'group-hover:scale-110 transition-transform'}`} size={20} />
                                                <span className="text-xs font-black text-primary-700 uppercase tracking-widest">
                                                    {isUploading ? 'Uploading...' : 'Upload Image'}
                                                </span>
                                            </label>

                                            {formData.logoUrl && (
                                                <div className="relative group/img h-[52px] w-[52px]">
                                                    <div className="h-full w-full rounded-2xl bg-white border border-slate-200 p-1.5 shadow-sm overflow-hidden">
                                                        <img src={resolveImageUrl(formData.logoUrl)} alt="" className="h-full w-full object-contain" />
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => setViewCustomer(formData)} // Just for previewing logo
                                                        className="absolute inset-0 bg-primary-600/60 rounded-2xl flex items-center justify-center text-white opacity-0 group-hover/img:opacity-100 transition-opacity"
                                                    >
                                                        <MdVisibility size={20} />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                        <input
                                            type="text"
                                            name="logoUrl"
                                            value={formData.logoUrl || ''}
                                            onChange={handleFormChange}
                                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium focus:ring-2 focus:ring-primary-500/10 outline-none"
                                            placeholder="Or paste external image URL..."
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div>
                            <h4 className="text-[10px] font-black text-primary-600 uppercase tracking-[0.2em] mb-6 flex items-center gap-3">
                                <span className="h-px flex-1 bg-primary-100"></span>
                                Contact Protocols
                                <span className="h-px flex-1 bg-primary-100"></span>
                            </h4>
                            <div className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Secure Mobile Number</label>
                                    <div className="relative">
                                        <MdPhone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                                        <input
                                            type="text"
                                            name="mobile"
                                            value={formData.mobile}
                                            onChange={handleFormChange}
                                            className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 outline-none text-sm font-bold"
                                            placeholder="+91"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Primary Email Address</label>
                                    <div className="relative">
                                        <MdEmail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                                        <input
                                            type="email"
                                            name="email"
                                            value={formData.email}
                                            onChange={handleFormChange}
                                            className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 outline-none text-sm font-bold"
                                            placeholder="operations@company.com"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-8">
                        <div>
                            <h4 className="text-[10px] font-black text-primary-600 uppercase tracking-[0.2em] mb-6 flex items-center gap-3">
                                <span className="h-px flex-1 bg-primary-100"></span>
                                Statutory Compliance
                                <span className="h-px flex-1 bg-primary-100"></span>
                            </h4>
                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">GSTIN (Optional)</label>
                                    <input
                                        type="text"
                                        name="gstin"
                                        value={formData.gstin || ''}
                                        onChange={handleFormChange}
                                        className="w-full px-4 py-3.5 bg-primary-50/50 border border-primary-100 rounded-2xl focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 outline-none text-sm font-mono font-black text-primary-700 uppercase"
                                        placeholder="15-Digit Code"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Default Discount</label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            name="defaultDiscount"
                                            value={formData.defaultDiscount}
                                            onChange={handleFormChange}
                                            className="w-full pr-10 pl-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 outline-none text-sm font-bold"
                                            placeholder="0"
                                        />
                                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">%</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div>
                            <h4 className="text-[10px] font-black text-primary-600 uppercase tracking-[0.2em] mb-6 flex items-center gap-3">
                                <span className="h-px flex-1 bg-primary-100"></span>
                                Registered Premises
                                <span className="h-px flex-1 bg-primary-100"></span>
                            </h4>
                            <div className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Street / Block Details</label>
                                    <div className="relative">
                                        <MdLocationOn className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                                        <input
                                            type="text"
                                            name="billingAddress.line1"
                                            value={formData.billingAddress.line1}
                                            onChange={handleFormChange}
                                            className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 outline-none text-sm font-medium"
                                            placeholder="Unit/Plot Number"
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">City</label>
                                        <input
                                            type="text"
                                            name="billingAddress.city"
                                            value={formData.billingAddress.city}
                                            onChange={handleFormChange}
                                            className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none text-sm font-bold"
                                            placeholder="City"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">State Jurisidiction</label>
                                        <select
                                            name="billingAddress.state"
                                            value={formData.billingAddress.state}
                                            onChange={handleFormChange}
                                            className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none text-sm font-bold appearance-none"
                                        >
                                            <option value="">Select State</option>
                                            <option value="Maharashtra">Maharashtra</option>
                                            <option value="Gujarat">Gujarat</option>
                                            <option value="Karnataka">Karnataka</option>
                                            <option value="Delhi">Delhi</option>
                                            <option value="Tamil Nadu">Tamil Nadu</option>
                                            <option value="Uttar Pradesh">Uttar Pradesh</option>
                                            <option value="Telangana">Telangana</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Billing Pincode</label>
                                        <input
                                            type="text"
                                            name="billingAddress.pincode"
                                            value={formData.billingAddress?.pincode || ''}
                                            onChange={handleFormChange}
                                            className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none text-sm font-bold"
                                            placeholder="Pincode"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Territory Override</label>
                                        <select
                                            name="territory"
                                            value={formData.territory?._id || formData.territory || ''}
                                            onChange={handleFormChange}
                                            className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none text-sm font-bold"
                                        >
                                            <option value="">Auto-Assign (Based on Rules)</option>
                                            {territories.map(t => (
                                                <option key={t._id} value={t._id}>{t.name} ({t.type})</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="pt-6 border-t border-slate-100">
                            <h4 className="text-[10px] font-black text-primary-600 uppercase tracking-[0.2em] mb-6 flex items-center gap-3">
                                <span className="h-px flex-1 bg-primary-100"></span>
                                CRM & Ownership
                                <span className="h-px flex-1 bg-primary-100"></span>
                            </h4>
                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">PAN Number</label>
                                    <input
                                        type="text"
                                        name="pan"
                                        value={formData.pan || ''}
                                        onChange={handleFormChange}
                                        className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none text-sm font-mono font-bold uppercase"
                                        placeholder="10-Digit PAN"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Account Owner</label>
                                    <select
                                        name="owner"
                                        value={formData.owner || ''}
                                        onChange={handleFormChange}
                                        className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none text-sm font-bold"
                                    >
                                        <option value="">Select Owner</option>
                                        {users.map(u => (
                                            <option key={u._id} value={u._id}>{u.name} ({u.role})</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-4 mt-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Industry</label>
                                    <select
                                        name="industry"
                                        value={formData.industry || 'Other'}
                                        onChange={handleFormChange}
                                        className="w-full px-3 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none text-xs font-bold"
                                    >
                                        <option value="Manufacturing">Manufacturing</option>
                                        <option value="Healthcare">Healthcare</option>
                                        <option value="Retail">Retail</option>
                                        <option value="Education">Education</option>
                                        <option value="Government">Government</option>
                                        <option value="Other">Other</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Segment</label>
                                    <select
                                        name="segment"
                                        value={formData.segment || 'Retail'}
                                        onChange={handleFormChange}
                                        className="w-full px-3 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none text-xs font-bold"
                                    >
                                        <option value="VIP Customers">VIP Customers</option>
                                        <option value="High Value">High Value</option>
                                        <option value="Medium Value">Medium Value</option>
                                        <option value="Low Value">Low Value</option>
                                        <option value="Retail">Retail</option>
                                        <option value="Wholesale">Wholesale</option>
                                        <option value="Corporate">Corporate</option>
                                        <option value="Government">Government</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Status</label>
                                    <select
                                        name="status"
                                        value={formData.status || 'Prospect'}
                                        onChange={handleFormChange}
                                        className="w-full px-3 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none text-xs font-bold"
                                    >
                                        <option value="Active">Active</option>
                                        <option value="New">New</option>
                                        <option value="VIP">VIP</option>
                                        <option value="Inactive">Inactive</option>
                                        <option value="High Value">High Value</option>
                                        <option value="Lost">Lost</option>
                                        <option value="Prospect">Prospect</option>
                                    </select>
                                </div>
                            </div>
                            <div className="space-y-2 mt-6">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Outstanding Balance</label>
                                <input
                                    type="number"
                                    name="outstanding"
                                    value={formData.outstanding || 0}
                                    onChange={handleFormChange}
                                    className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none text-sm font-bold"
                                    placeholder="0"
                                />
                            </div>
                        </div>
                    </div>
                </form>
            </Modal>

            {/* View Customer Details Modal */}
            <Modal
                isOpen={!!viewCustomer}
                onClose={() => { setViewCustomer(null); setActiveProfileTab('details'); setCustomerAssets([]); }}
                title="Customer Profile"
                maxWidth={activeProfileTab === 'pricing' || activeProfileTab === 'products' ? 'max-w-4xl' : 'max-w-2xl'}
            >
                {viewCustomer && (
                    <div className="p-6 space-y-6">
                        {/* Header Profile */}
                        <div className="flex flex-col items-center justify-center text-center space-y-3 pb-6 border-b border-slate-100">
                            <div className="h-20 w-20 bg-white rounded-2xl border border-slate-100 p-2 shadow-sm">
                                {viewCustomer.logoUrl ? (
                                    <img src={resolveImageUrl(viewCustomer.logoUrl)} alt="Logo" className="w-full h-full object-contain" />
                                ) : (
                                    <div className="w-full h-full bg-primary-50 rounded-xl flex items-center justify-center text-primary-600 font-black text-2xl">
                                        {viewCustomer.companyName?.substring(0, 1)}
                                    </div>
                                )}
                            </div>
                            <div>
                                <h3 className="text-lg font-black text-slate-900">{viewCustomer.companyName}</h3>
                                <p className="text-xs font-bold text-slate-400">{viewCustomer.customerName}</p>
                            </div>
                            <div className="flex gap-2">
                                <span className="px-3 py-1 bg-primary-50 text-primary-700 text-[10px] font-black uppercase tracking-widest rounded-lg border border-primary-100">
                                    {viewCustomer.gstin || 'Unregistered'}
                                </span>
                            </div>
                        </div>

                        {/* Tab Switcher */}
                        <div className="flex border-b border-slate-100">
                            <button
                                onClick={() => setActiveProfileTab('details')}
                                className={`flex-1 py-3 text-xs font-black uppercase tracking-widest transition-all border-b-2 ${
                                    activeProfileTab === 'details'
                                        ? 'border-primary-600 text-primary-600'
                                        : 'border-transparent text-slate-400 hover:text-slate-600'
                                }`}
                            >
                                Contact & Premises
                            </button>
                            <button
                                onClick={() => setActiveProfileTab('pricing')}
                                className={`flex-1 py-3 text-xs font-black uppercase tracking-widest transition-all border-b-2 ${
                                    activeProfileTab === 'pricing'
                                        ? 'border-primary-600 text-primary-600'
                                        : 'border-transparent text-slate-400 hover:text-slate-600'
                                }`}
                            >
                                Pricing & Agreements
                            </button>
                            <button
                                onClick={() => {
                                    setActiveProfileTab('products');
                                    if (viewCustomer?._id && customerAssets.length === 0) {
                                        setAssetsLoading(true);
                                        csmService.getAssets({ customerId: viewCustomer._id })
                                            .then(res => setCustomerAssets(res.data || []))
                                            .catch(() => setCustomerAssets([]))
                                            .finally(() => setAssetsLoading(false));
                                    }
                                }}
                                className={`flex-1 py-3 text-xs font-black uppercase tracking-widest transition-all border-b-2 ${
                                    activeProfileTab === 'products'
                                        ? 'border-primary-600 text-primary-600'
                                        : 'border-transparent text-slate-400 hover:text-slate-600'
                                }`}
                            >
                                Product Details
                            </button>
                        </div>

                        {activeProfileTab === 'details' ? (
                            <div className="space-y-6 pt-2">
                                {/* Details Grid */}
                                <div className="grid grid-cols-2 gap-8 text-left">
                                    <div>
                                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Contact Information</h4>
                                        <div className="space-y-4">
                                            <div className="flex items-start gap-3">
                                                <div className="p-2 bg-slate-50 text-slate-400 rounded-lg"><MdPhone /></div>
                                                <div>
                                                    <div className="text-xs font-bold text-slate-400">Mobile</div>
                                                    <div className="text-sm font-bold text-slate-900">{viewCustomer.mobile || '-'}</div>
                                                </div>
                                            </div>
                                            <div className="flex items-start gap-3">
                                                <div className="p-2 bg-slate-50 text-slate-400 rounded-lg"><MdEmail /></div>
                                                <div>
                                                    <div className="text-xs font-bold text-slate-400">Email</div>
                                                    <div className="text-sm font-bold text-slate-900">{viewCustomer.email || '-'}</div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Billing Address</h4>
                                        <div className="flex items-start gap-3">
                                            <div className="p-2 bg-slate-50 text-slate-400 rounded-lg"><MdLocationOn /></div>
                                            <div>
                                                <div className="text-sm font-bold text-slate-900 leading-relaxed">
                                                    {viewCustomer.billingAddress?.line1} <br />
                                                    {viewCustomer.billingAddress?.city}, {viewCustomer.billingAddress?.state} <br />
                                                    {viewCustomer.billingAddress?.pincode}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Footer Extras */}
                                <div className="pt-6 border-t border-slate-100 grid grid-cols-2 gap-4 text-left">
                                    <div>
                                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Default Discount</div>
                                        <div className="text-lg font-black text-slate-900">{viewCustomer.defaultDiscount}%</div>
                                    </div>
                                    <div>
                                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Credit Limit</div>
                                        <div className="text-lg font-black text-slate-900">₹{viewCustomer.creditLimit?.toLocaleString() || '0'}</div>
                                    </div>
                                </div>
                            </div>
                        ) : activeProfileTab === 'pricing' ? (
                            <div className="pt-2">
                                <CustomerPricingDashboard customerId={viewCustomer._id} inlineMode={true} />
                            </div>
                        ) : (
                            <div className="pt-2">
                                {assetsLoading ? (
                                    <div className="flex flex-col items-center justify-center py-12 space-y-3">
                                        <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin"></div>
                                        <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Loading Products...</p>
                                    </div>
                                ) : customerAssets.length === 0 ? (
                                    <div className="text-center py-12">
                                        <p className="text-slate-400 font-bold text-sm">No products registered for this customer yet.</p>
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto rounded-2xl border border-slate-100">
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100">
                                                    <th className="px-4 py-3">Product</th>
                                                    <th className="px-4 py-3">Serial No.</th>
                                                    <th className="px-4 py-3">Status</th>
                                                    <th className="px-4 py-3">Install Date</th>
                                                    <th className="px-4 py-3">Warranty Until</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-50 text-sm font-semibold text-slate-700">
                                                {customerAssets.map((asset) => (
                                                    <tr key={asset._id} className="hover:bg-slate-50/50 transition-colors">
                                                        <td className="px-4 py-3 font-black text-slate-900">
                                                            {asset.productId?.productName || asset.customProductName || '-'}
                                                        </td>
                                                        <td className="px-4 py-3 text-xs font-mono">
                                                            {asset.serialNumber || '-'}
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <span className={`inline-block px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                                                                asset.status === 'Active' ? 'bg-teal-50 text-teal-700 border border-teal-100' :
                                                                asset.status === 'Under Repair' ? 'bg-amber-50 text-amber-700 border border-amber-100' :
                                                                'bg-slate-100 text-slate-500'
                                                            }`}>
                                                                {asset.status || 'Active'}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3 text-xs">
                                                            {asset.installationDate ? new Date(asset.installationDate).toLocaleDateString('en-IN') : '-'}
                                                        </td>
                                                        <td className="px-4 py-3 text-xs">
                                                            {asset.warrantyEndDate ? (
                                                                <span className={new Date(asset.warrantyEndDate) > new Date() ? 'text-teal-600 font-bold' : 'text-rose-500 font-bold'}>
                                                                    {new Date(asset.warrantyEndDate).toLocaleDateString('en-IN')}
                                                                    {new Date(asset.warrantyEndDate) > new Date() ? ' ✓' : ' (Expired)'}
                                                                </span>
                                                            ) : '-'}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </Modal>

            {/* Import Modal */}
            <ImportModal
                isOpen={isImportModalOpen}
                onClose={() => setIsImportModalOpen(false)}
                title="Import Customers"
                type="customers"
                onImport={async (file) => {
                    const result = await importService.importCustomers(file);
                    fetchCustomers(); // Refresh customers after import
                    return result;
                }}
                onDownloadTemplate={importService.getCustomerTemplate}
            />
        </div>
    );
};

export default Customers;
