import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { MdAdd, MdDelete, MdEdit, MdSearch, MdStorefront, MdFileDownload, MdFileUpload, MdArrowBack } from 'react-icons/md';
import { toast } from 'react-toastify';
import * as XLSX from 'xlsx';
import Modal from '../components/Modal';
import ImportModal from '../components/ImportModal';
import PaginationControls from '../components/PaginationControls';
import { vendorService, importService } from '../services/api';
import { isValidGSTIN, isValidMobile } from '../utils/validation';

const LIST_PAGE_SIZE = 20;

const defaultForm = {
    name: '',
    contactPerson: '',
    phone: '',
    email: '',
    address: '',
    gstin: '',
    isActive: true,
    loginEnabled: true,
    username: '',
    password: ''
};

const Vendors = ({ isCreatePage, isEditPage }) => {
    const navigate = useNavigate();
    const { id: routeId } = useParams();
    const [vendors, setVendors] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [page, setPage] = useState(1);
    const [pagination, setPagination] = useState({ page: 1, limit: LIST_PAGE_SIZE, total: 0, pages: 1 });
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [editingVendor, setEditingVendor] = useState(null);
    const [formData, setFormData] = useState(defaultForm);

    const exportToExcel = async () => {
        setLoading(true);
        try {
            const res = await vendorService.getAll(false, {
                limit: 10000,
                search: debouncedSearch || undefined,
            });
            const exportVendors = Array.isArray(res.data) ? res.data : res.data?.data || [];
            if (!exportVendors.length) {
                toast.info('No vendors found to export');
                return;
            }

            const exportData = exportVendors.map((v) => ({
                'Vendor Name': v.name || '',
                'Contact Person': v.contactPerson || '',
                'Phone': v.phone || '',
                'Email': v.email || '',
                'Address': v.address || '',
                'GSTIN': v.gstin || '',
                'Active': v.isActive !== false ? 'TRUE' : 'FALSE'
            }));

            const ws = XLSX.utils.json_to_sheet(exportData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Vendors');
            XLSX.writeFile(wb, `Vendors_Master_${new Date().toISOString().slice(0, 10)}.xlsx`);
            toast.success('Export completed successfully');
        } catch (err) {
            console.error('Export vendors error:', err);
            toast.error('Failed to export vendors');
        } finally {
            setLoading(false);
        }
    };

    const fetchVendors = async () => {
        setLoading(true);
        try {
            const res = await vendorService.getAll(false, {
                page,
                limit: LIST_PAGE_SIZE,
                search: debouncedSearch || undefined
            });
            const payload = res.data;
            setVendors(Array.isArray(payload) ? payload : payload.data || []);
            setPagination(payload.pagination || {
                page: 1,
                limit: LIST_PAGE_SIZE,
                total: Array.isArray(payload) ? payload.length : 0,
                pages: 1
            });
        } catch (err) {
            console.error('Error fetching vendors:', err);
            toast.error('Failed to fetch vendors');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchTerm.trim());
            setPage(1);
        }, 300);

        return () => clearTimeout(timer);
    }, [searchTerm]);

    useEffect(() => {
        fetchVendors();
    }, [page, debouncedSearch]);

    const filteredVendors = useMemo(() => vendors, [vendors]);
    const pagedVendors = filteredVendors;

    useEffect(() => {
        if (isCreatePage) {
            setEditingVendor(null);
            setFormData(defaultForm);
            setIsModalOpen(true);
        } else if (isEditPage && routeId) {
            setIsModalOpen(true);
            const found = vendors.find(v => v._id === routeId);
            if (found) {
                setEditingVendor(found);
                setFormData({
                    name: found.name || '',
                    contactPerson: found.contactPerson || '',
                    phone: found.phone || '',
                    email: found.email || '',
                    address: found.address || '',
                    gstin: found.gstin || '',
                    isActive: found.isActive !== false,
                    loginEnabled: Boolean(found.loginEnabled),
                    username: found.username || found.email || '',
                    password: ''
                });
            } else {
                vendorService.getAll(false, { limit: 1000 }).then(res => {
                    const list = Array.isArray(res.data) ? res.data : res.data?.data || [];
                    const item = list.find(v => v._id === routeId);
                    if (item) {
                        setEditingVendor(item);
                        setFormData({
                            name: item.name || '',
                            contactPerson: item.contactPerson || '',
                            phone: item.phone || '',
                            email: item.email || '',
                            address: item.address || '',
                            gstin: item.gstin || '',
                            isActive: item.isActive !== false,
                            loginEnabled: Boolean(item.loginEnabled),
                            username: item.username || item.email || '',
                            password: ''
                        });
                    }
                }).catch(err => console.error("Failed to load vendor", err));
            }
        }
    }, [isCreatePage, isEditPage, routeId]);

    const openModal = (vendor = null) => {
        if (vendor) {
            navigate(`/vendors/edit/${vendor._id}`);
        } else {
            navigate('/vendors/new');
        }
    };

    const onChange = (e) => {
        const { name, value, type, checked } = e.target;
        let val = value;
        if (name === 'gstin') {
            val = value.toUpperCase().slice(0, 15);
        } else if (name === 'phone') {
            val = value.replace(/[^\d]/g, '').slice(0, 10);
        }
        setFormData((prev) => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : val
        }));
    };

    const onSubmit = async (e) => {
        e.preventDefault();
        if (!formData.name?.trim()) {
            toast.error('Vendor name is required');
            return;
        }
        if (formData.phone && !isValidMobile(formData.phone)) {
            toast.error('Invalid Phone Number (must be 10 digits)');
            return;
        }
        if (formData.gstin && !isValidGSTIN(formData.gstin)) {
            toast.error('Invalid GSTIN format (must be 15 characters with state code 01-37, e.g. 27AAAAA0000A1Z5 or 09AAAAA0000A1Z5)');
            return;
        }

        try {
            if (editingVendor) {
                await vendorService.update(editingVendor._id, formData);
                toast.success('Vendor updated successfully');
            } else {
                await vendorService.create(formData);
                toast.success('Vendor created successfully');
            }
            setIsModalOpen(false);
            fetchVendors();
            navigate('/vendors');
        } catch (err) {
            console.error('Error saving vendor:', err);
            toast.error(err.response?.data?.message || 'Error saving vendor');
        }
    };

    const onDelete = async (vendorId) => {
        if (!window.confirm('Are you sure you want to delete this vendor?')) return;
        try {
            await vendorService.delete(vendorId);
            toast.success('Vendor deleted');
            fetchVendors();
        } catch (err) {
            console.error('Error deleting vendor:', err);
            toast.error(err.response?.data?.message || 'Error deleting vendor');
        }
    };

    return (
        <div className="space-y-6">
            {!(isModalOpen || isCreatePage || isEditPage) ? (
                <>
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">Vendors</h1>
                    <p className="text-slate-500 font-medium">Manage supplier master and activation status.</p>
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
                        onClick={() => openModal()}
                        className="flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-2xl font-bold transition-all shadow-xl shadow-primary-600/20 uppercase text-xs tracking-widest active:scale-95"
                    >
                        <MdAdd size={20} />
                        <span>Add Vendor</span>
                    </button>
                </div>
            </div>

            <div className="mobile-master-shell bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
                <div className="mobile-master-toolbar p-6 border-b border-slate-50 flex flex-col md:flex-row gap-4 items-center bg-slate-50/30">
                    <div className="relative flex-1 w-full text-slate-400 focus-within:text-primary-600 transition-colors">
                        <MdSearch className="absolute left-4 top-1/2 -translate-y-1/2" size={20} />
                        <input
                            type="text"
                            placeholder="Search by vendor name, person, phone or email..."
                            className="w-full pl-12 pr-4 py-3.5 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 outline-none text-sm text-slate-900 transition-all font-medium"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                {loading ? (
                    <div className="p-20 text-center text-slate-400 font-medium">
                        <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-primary-500 border-t-transparent mb-4"></div>
                        <p className="text-xs uppercase font-black tracking-widest">Loading Vendors...</p>
                    </div>
                ) : (
                    <>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 text-slate-400 text-[10px] uppercase font-black tracking-widest border-b border-slate-100">
                                <tr>
                                    <th className="px-8 py-5">Vendor</th>
                                    <th className="px-8 py-5">Contact</th>
                                    <th className="px-8 py-5">GSTIN</th>
                                    <th className="px-8 py-5 text-center">Status</th>
                                    <th className="px-8 py-5 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {pagedVendors.map((vendor) => (
                                    <tr key={vendor._id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-8 py-5">
                                            <div className="flex items-center gap-3">
                                                <div className="h-10 w-10 rounded-xl bg-primary-50 flex items-center justify-center text-primary-600">
                                                    <MdStorefront size={20} />
                                                </div>
                                                <div>
                                                    <div
                                                        className="font-black text-primary-600 hover:text-primary-800 cursor-pointer hover:underline text-sm"
                                                        onClick={() => navigate(`/vendors/${vendor._id}/360`)}
                                                    >
                                                        {vendor.name}
                                                    </div>
                                                    <div className="text-[10px] text-slate-400 uppercase font-bold mt-1">{vendor.contactPerson || 'No contact person'}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-8 py-5">
                                            <div className="text-sm font-bold text-slate-700">{vendor.phone || '-'}</div>
                                            <div className="text-[11px] text-slate-500">{vendor.email || '-'}</div>
                                        </td>
                                        <td className="px-8 py-5">
                                            <div className="text-sm text-slate-900 font-black">{vendor.gstin || '-'}</div>
                                            <div className="text-[10px] text-slate-400 font-medium truncate max-w-[200px]">{vendor.address || 'No address'}</div>
                                        </td>
                                        <td className="px-8 py-5 text-center">
                                            <div className="flex flex-col items-center gap-1">
                                                <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-[0.1em] ${vendor.isActive ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-slate-100 text-slate-400 border border-slate-200'}`}>
                                                    {vendor.isActive ? 'Active' : 'Inactive'}
                                                </span>
                                                {vendor.loginEnabled && (
                                                    <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-blue-50 text-blue-600 border border-blue-100">
                                                        Login Enabled
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-8 py-5 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => openModal(vendor)}
                                                    className="p-2.5 text-primary-600 hover:bg-primary-50 rounded-xl transition-all shadow-sm bg-white border border-slate-100"
                                                    title="Edit Vendor"
                                                >
                                                    <MdEdit size={18} />
                                                </button>
                                                <button
                                                    onClick={() => onDelete(vendor._id)}
                                                    className="p-2.5 text-rose-500 hover:bg-rose-50 rounded-xl transition-all shadow-sm bg-white border border-slate-100"
                                                    title="Delete Vendor"
                                                >
                                                    <MdDelete size={18} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {!filteredVendors.length && (
                                    <tr>
                                        <td colSpan={5} className="py-16 text-center text-slate-400 text-sm font-bold">
                                            No vendors found.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    <PaginationControls pagination={pagination} onPageChange={setPage} />
                    </>
                )}
            </div>
            </>
            ) : (
                <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-200">
                        {/* Header bar */}
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                            <div className="flex items-center gap-4">
                                <button
                                    type="button"
                                    onClick={() => { setIsModalOpen(false); navigate('/vendors'); }}
                                    className="p-3 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-2xl transition-all border border-slate-200"
                                >
                                    <MdArrowBack size={20} />
                                </button>
                                <div>
                                    <h1 className="text-xl font-black text-slate-900">
                                        {editingVendor ? 'Edit Vendor' : 'Create Vendor'}
                                    </h1>
                                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                                        {editingVendor ? `Update information for ${editingVendor.name}` : 'Add a new supplier to master data'}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    type="button"
                                    onClick={() => { setIsModalOpen(false); navigate('/vendors'); }}
                                    className="px-6 py-3 rounded-2xl border border-slate-200 text-slate-600 font-black uppercase text-xs tracking-widest hover:bg-slate-50 transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={onSubmit}
                                    className="bg-primary-600 hover:bg-primary-700 text-white px-8 py-3 rounded-2xl font-black transition-all shadow-xl shadow-primary-600/20 uppercase text-xs tracking-widest active:scale-95"
                                >
                                    {editingVendor ? 'Update Vendor' : 'Save Vendor'}
                                </button>
                            </div>
                        </div>

                        {/* Form Card Body */}
                        <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
                            <form onSubmit={onSubmit} className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Vendor Name *</label>
                                    <input
                                        type="text"
                                        name="name"
                                        value={formData.name}
                                        onChange={onChange}
                                        className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all"
                                        placeholder="Enter vendor name"
                                        required
                                    />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Contact Person</label>
                                        <input
                                            type="text"
                                            name="contactPerson"
                                            value={formData.contactPerson}
                                            onChange={onChange}
                                            className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none"
                                            placeholder="Contact person"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Phone</label>
                                        <input
                                            type="text"
                                            name="phone"
                                            maxLength={10}
                                            value={formData.phone}
                                            onChange={onChange}
                                            className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none"
                                            placeholder="10-digit phone number"
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Email</label>
                                        <input
                                            type="email"
                                            name="email"
                                            value={formData.email}
                                            onChange={onChange}
                                            className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none"
                                            placeholder="vendor@company.com"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">GSTIN</label>
                                        <input
                                            type="text"
                                            name="gstin"
                                            maxLength={15}
                                            value={formData.gstin}
                                            onChange={onChange}
                                            className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none uppercase font-mono"
                                            placeholder="15-Digit GSTIN Code"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Address</label>
                                    <textarea
                                        name="address"
                                        value={formData.address}
                                        onChange={onChange}
                                        className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none min-h-24"
                                        placeholder="Address"
                                    />
                                </div>
                                <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-4">
                                    <label className="flex items-center gap-3 text-sm font-black text-slate-800 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            name="loginEnabled"
                                            checked={formData.loginEnabled}
                                            onChange={onChange}
                                            className="w-5 h-5 text-primary-600 rounded focus:ring-primary-500"
                                        />
                                        <span>Provide Vendor Portal Login Access</span>
                                    </label>
                                    <p className="text-xs text-slate-500 font-medium ml-8">
                                        Enabling login allows this vendor to access their product catalog and view their invoice vouchers.
                                    </p>

                                    {formData.loginEnabled && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-200/60 mt-3">
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Login Email / Username *</label>
                                                <input
                                                    type="email"
                                                    name="username"
                                                    value={formData.username}
                                                    onChange={onChange}
                                                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold outline-none"
                                                    placeholder="vendor@company.com"
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">
                                                    {editingVendor ? 'New Password (leave empty to keep current)' : 'Password *'}
                                                </label>
                                                <input
                                                    type="password"
                                                    name="password"
                                                    value={formData.password}
                                                    onChange={onChange}
                                                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold outline-none"
                                                    placeholder="••••••••"
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <label className="flex items-center gap-2 text-xs font-bold text-slate-600 pt-2">
                                    <input
                                        type="checkbox"
                                        name="isActive"
                                        checked={formData.isActive}
                                        onChange={onChange}
                                        className="w-4 h-4 text-primary-600 rounded"
                                    />
                                    Vendor is active
                                </label>
                            </form>
                        </div>
                </div>
            )}

            {/* Import Modal */}
            <ImportModal
                isOpen={isImportModalOpen}
                onClose={() => setIsImportModalOpen(false)}
                title="Import Vendors"
                onImport={async (file) => {
                    const result = await importService.importVendors(file);
                    fetchVendors();
                    return result;
                }}
                onDownloadTemplate={importService.getVendorTemplate}
            />
        </div>
    );
};

export default Vendors;
