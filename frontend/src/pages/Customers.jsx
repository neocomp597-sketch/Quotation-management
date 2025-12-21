import React, { useState, useEffect } from 'react';
import { MdAdd, MdSearch, MdEdit, MdDelete, MdPerson, MdEmail, MdPhone, MdLocationOn, MdBusiness, MdCloudUpload, MdVisibility } from 'react-icons/md';
import { customerService, uploadService } from '../services/api';
import Modal from '../components/Modal';
import { resolveImageUrl } from '../utils/helpers';

const Customers = () => {
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCustomer, setEditingCustomer] = useState(null);
    const [isUploading, setIsUploading] = useState(false);

    // For full-screen image viewing
    const [viewCustomer, setViewCustomer] = useState(null);

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
        notes: ''
    });

    useEffect(() => {
        fetchCustomers();
    }, []);

    const fetchCustomers = async () => {
        try {
            const res = await customerService.getAll();
            setCustomers(res.data);
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
                billingAddress: { ...customer.billingAddress }
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
        } catch (err) {
            console.error("Upload error:", err);
            alert("Failed to upload image");
        } finally {
            setIsUploading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingCustomer) {
                await customerService.update(editingCustomer._id, formData);
            } else {
                await customerService.create(formData);
            }
            fetchCustomers();
            setIsModalOpen(false);
        } catch (err) {
            console.error("Error saving customer:", err);
            alert("Error saving customer data");
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm("Are you sure you want to delete this customer?")) {
            try {
                await customerService.delete(id);
                fetchCustomers();
            } catch (err) {
                console.error("Error deleting customer:", err);
            }
        }
    };

    const filteredCustomers = customers.filter(c =>
        c.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.companyName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.gstin?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">Customer Master</h1>
                    <p className="text-slate-500 font-medium">Manage your distributor and retail partners.</p>
                </div>
                <button
                    onClick={() => handleOpenModal()}
                    className="flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-2xl font-bold transition-all shadow-xl shadow-primary-600/20 uppercase text-xs tracking-widest active:scale-95"
                >
                    <MdAdd size={20} />
                    <span>Add New Customer</span>
                </button>
            </div>

            <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
                <div className="p-6 border-b border-slate-50 flex flex-col md:flex-row gap-4 items-center bg-slate-50/30">
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
                </div>

                <div className="overflow-x-auto">
                    {loading ? (
                        <div className="p-20 text-center">
                            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-primary-500 border-t-transparent mb-4"></div>
                            <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Syncing Customer Data...</p>
                        </div>
                    ) : (
                        <table className="w-full text-left">
                            <thead className="bg-slate-50/50 text-slate-400 text-[10px] uppercase font-black tracking-widest border-b border-slate-100">
                                <tr>
                                    <th className="px-8 py-5">Company & Info</th>
                                    <th className="px-8 py-5">Contact</th>
                                    <th className="px-8 py-5">GSTIN</th>
                                    <th className="px-8 py-5">Location</th>
                                    <th className="px-8 py-5 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {filteredCustomers.map((c) => (
                                    <tr key={c._id} className="hover:bg-slate-50/50 transition-colors group">
                                        <td className="px-8 py-5">
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
                                                    <div className="font-bold text-slate-900">{c.companyName}</div>
                                                    <div className="text-xs text-slate-400 font-medium">{c.customerName}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-8 py-5">
                                            <div className="text-sm text-slate-700 font-bold flex items-center gap-1.5 mb-1">
                                                <MdPhone className="text-slate-300" size={16} /> {c.mobile}
                                            </div>
                                            <div className="text-xs text-slate-400 flex items-center gap-1.5">
                                                <MdEmail className="text-slate-300" size={14} /> {c.email}
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
                                        <td className="px-8 py-5 text-right">
                                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
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
                    )}
                </div>
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
                            className="bg-primary-600 hover:bg-primary-700 text-white px-10 py-3.5 rounded-2xl font-black transition-all shadow-xl shadow-primary-600/20 uppercase text-[10px] tracking-widest active:scale-95"
                        >
                            {editingCustomer ? "Commit Changes" : "Register Customer"}
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
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Company Trade Name</label>
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
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Contact Representative</label>
                                    <div className="relative">
                                        <MdPerson className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                                        <input
                                            type="text"
                                            name="customerName"
                                            value={formData.customerName}
                                            onChange={handleFormChange}
                                            className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all outline-none text-sm font-bold placeholder:font-normal placeholder:text-slate-300"
                                            placeholder="Full name of person"
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
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">GSTIN (Verified)</label>
                                    <input
                                        type="text"
                                        name="gstin"
                                        value={formData.gstin}
                                        onChange={handleFormChange}
                                        className="w-full px-4 py-3.5 bg-primary-50/50 border border-primary-100 rounded-2xl focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 outline-none text-sm font-mono font-black text-primary-700 uppercase"
                                        placeholder="15-Digit Code"
                                        required
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
                            </div>
                        </div>
                    </div>
                </form>
            </Modal>

            {/* View Customer Details Modal */}
            <Modal
                isOpen={!!viewCustomer}
                onClose={() => setViewCustomer(null)}
                title="Customer Profile"
                maxWidth="max-w-2xl"
            >
                {viewCustomer && (
                    <div className="p-6 space-y-8">
                        {/* Header Profile */}
                        <div className="flex flex-col items-center justify-center text-center space-y-3 pb-8 border-b border-slate-100">
                            <div className="h-24 w-24 bg-white rounded-2xl border border-slate-100 p-2 shadow-sm">
                                {viewCustomer.logoUrl ? (
                                    <img src={resolveImageUrl(viewCustomer.logoUrl)} alt="Logo" className="w-full h-full object-contain" />
                                ) : (
                                    <div className="w-full h-full bg-primary-50 rounded-xl flex items-center justify-center text-primary-600 font-black text-3xl">
                                        {viewCustomer.companyName?.substring(0, 1)}
                                    </div>
                                )}
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-slate-900">{viewCustomer.companyName}</h3>
                                <p className="text-sm font-bold text-slate-400">{viewCustomer.customerName}</p>
                            </div>
                            <div className="flex gap-2">
                                <span className="px-3 py-1 bg-primary-50 text-primary-700 text-[10px] font-black uppercase tracking-widest rounded-lg border border-primary-100">
                                    {viewCustomer.gstin || 'Unregistered'}
                                </span>
                            </div>
                        </div>

                        {/* Details Grid */}
                        <div className="grid grid-cols-2 gap-8">
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
                        <div className="pt-6 border-t border-slate-100 grid grid-cols-2 gap-4">
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
                )}
            </Modal>
        </div>
    );
};

export default Customers;
