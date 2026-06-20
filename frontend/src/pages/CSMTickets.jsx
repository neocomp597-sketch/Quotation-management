import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { csmService, customerService, productService, voucherService, userService } from '../services/api';
import { toast } from 'react-toastify';
import { MdAdd, MdSearch, MdFilterList, MdArrowForward } from 'react-icons/md';
import PaginationControls from '../components/PaginationControls';
import PortalDropdown from '../components/PortalDropdown';

const statusStyles = {
    'Open': 'bg-emerald-50 text-emerald-600 border-emerald-200',
    'Assigned': 'bg-blue-50 text-blue-600 border-blue-200',
    'In Progress': 'bg-indigo-50 text-indigo-600 border-indigo-200',
    'Pending Customer': 'bg-amber-50 text-amber-600 border-amber-200',
    'Resolved': 'bg-teal-50 text-teal-600 border-teal-200',
    'Closed': 'bg-slate-50 text-slate-500 border-slate-200',
    'Escalated': 'bg-rose-50 text-rose-600 border-rose-200',
    'Cancelled': 'bg-rose-50/50 text-rose-400 border-rose-100'
};

const CSMTickets = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [tickets, setTickets] = useState([]);
    
    // Pagination & Filter States
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [search, setSearch] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [filterPriority, setFilterPriority] = useState('');

    // Masters lists for creation
    const [customers, setCustomers] = useState([]);
    const [priorities, setPriorities] = useState([]);
    const [categories, setCategories] = useState([]);
    const [types, setTypes] = useState([]);
    const [products, setProducts] = useState([]);
    const [invoices, setInvoices] = useState([]);
    
    // Modal & Form State
    const [showModal, setShowModal] = useState(false);
    const [formData, setFormData] = useState({
        customerId: '',
        contactName: '',
        contactPhone: '',
        contactEmail: '',
        priorityId: '',
        categoryId: '',
        typeId: '',
        productId: '',
        invoiceId: '',
        issueTitle: '',
        description: '',
        source: 'Web Portal'
    });

    const fetchTickets = async () => {
        setLoading(true);
        try {
            const res = await csmService.getTickets({
                page,
                limit: 10,
                search,
                status: filterStatus,
                priorityId: filterPriority
            });
            setTickets(res.data?.data || []);
            setTotalPages(res.data?.pagination?.pages || 1);
        } catch (error) {
            toast.error('Failed to load tickets');
        } finally {
            setLoading(false);
        }
    };

    const loadCreationData = async () => {
        try {
            const [custRes, priRes, catRes, typRes, prodRes] = await Promise.all([
                customerService.getAll({ limit: 500 }),
                csmService.getPriorities(),
                csmService.getCategories(),
                csmService.getTypes(),
                productService.getAll({ limit: 500 })
            ]);
            setCustomers(custRes.data?.data || custRes.data || []);
            setPriorities(priRes.data || []);
            setCategories(catRes.data || []);
            setTypes(typRes.data || []);
            setProducts(prodRes.data?.data || prodRes.data || []);
        } catch (error) {
            console.error('Error preloading ticket forms:', error);
        }
    };

    useEffect(() => {
        fetchTickets();
    }, [page, filterStatus, filterPriority]);

    useEffect(() => {
        if (showModal) {
            loadCreationData();
        }
    }, [showModal]);

    // Fetch customer invoices when customer is selected in creation form
    useEffect(() => {
        if (formData.customerId) {
            voucherService.getAll({ customerId: formData.customerId, voucherType: 'Invoice' })
                .then(res => setInvoices(res.data?.data || res.data || []))
                .catch(err => console.error('Error fetching customer invoices:', err));
        } else {
            setInvoices([]);
        }
    }, [formData.customerId]);

    const handleSearchSubmit = (e) => {
        e.preventDefault();
        setPage(1);
        fetchTickets();
    };

    const handleCreateTicket = async (e) => {
        e.preventDefault();
        try {
            await csmService.createTicket(formData);
            toast.success('Support ticket generated successfully!');
            setShowModal(false);
            fetchTickets();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Error generating ticket');
        }
    };

    const selectedPriorityInfo = priorities.find(p => p._id === formData.priorityId);

    return (
        <div className="p-6 space-y-6 max-w-7xl mx-auto animate-fade-in-up">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-slate-900 font-outfit uppercase">
                        Support Tickets Register
                    </h1>
                    <p className="text-slate-500 font-semibold text-sm">
                        Create, track, and manage customer service cases.
                    </p>
                </div>
                <button
                    onClick={() => {
                        setFormData({
                            customerId: '',
                            contactName: '',
                            contactPhone: '',
                            contactEmail: '',
                            priorityId: '',
                            categoryId: '',
                            typeId: '',
                            productId: '',
                            invoiceId: '',
                            issueTitle: '',
                            description: '',
                            source: 'Web Portal'
                        });
                        setShowModal(true);
                    }}
                    className="flex items-center gap-2 px-6 py-4 bg-primary-600 hover:bg-primary-700 text-white font-black uppercase text-[10px] tracking-widest rounded-2xl transition-all shadow-lg shadow-primary-600/20 active:scale-95 self-start md:self-auto"
                >
                    <MdAdd size={18} />
                    New Ticket
                </button>
            </div>

            {/* Filters Toolbar */}
            <div className="glass shadow-premium rounded-[2rem] p-6 bg-white border border-slate-100 flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
                <form onSubmit={handleSearchSubmit} className="flex-1 max-w-md relative">
                    <input
                        type="text"
                        placeholder="Search ticket no, title, contact..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm font-semibold"
                    />
                    <MdSearch className="absolute left-4 top-3.5 text-slate-400" size={20} />
                </form>
                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2 bg-slate-50 border border-slate-100 rounded-2xl px-4 py-1.5">
                        <MdFilterList className="text-slate-400" />
                        <span className="text-xs font-black uppercase tracking-wider text-slate-400">Status</span>
                        <select
                            value={filterStatus}
                            onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
                            className="bg-transparent border-none focus:outline-none text-xs font-bold text-slate-700 cursor-pointer"
                        >
                            <option value="">All Statuses</option>
                            <option value="Open">Open</option>
                            <option value="Assigned">Assigned</option>
                            <option value="In Progress">In Progress</option>
                            <option value="Pending Customer">Pending Customer</option>
                            <option value="Resolved">Resolved</option>
                            <option value="Closed">Closed</option>
                            <option value="Escalated">Escalated</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Table Card */}
            <div className="glass shadow-premium rounded-[2rem] p-6 bg-white border border-slate-100">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 space-y-3">
                        <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin"></div>
                        <p className="text-slate-400 font-bold uppercase text-xs tracking-widest">Fetching Tickets...</p>
                    </div>
                ) : tickets.length === 0 ? (
                    <div className="text-center py-20 text-slate-400">
                        <p className="text-lg font-bold">No support tickets found.</p>
                        <p className="text-sm">Refine your search parameters or raise a new ticket.</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100">
                                        <th className="px-6 py-4">Ticket No</th>
                                        <th className="px-6 py-4">Customer & Contact</th>
                                        <th className="px-6 py-4">Subject</th>
                                        <th className="px-6 py-4">Priority</th>
                                        <th className="px-6 py-4">Status</th>
                                        <th className="px-6 py-4">Engineer</th>
                                        <th className="px-6 py-4 text-center">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50 text-sm font-semibold text-slate-700">
                                    {tickets.map((t) => (
                                        <tr key={t._id} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="px-6 py-4 font-black text-slate-900">{t.ticketNo}</td>
                                            <td className="px-6 py-4">
                                                <p className="font-bold text-slate-900">{t.customerId?.customerName || 'N/A'}</p>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">{t.contactName || t.contactPhone || 'No Contact'}</p>
                                            </td>
                                            <td className="px-6 py-4 max-w-xs truncate">{t.issueTitle}</td>
                                            <td className="px-6 py-4">
                                                <span 
                                                    className="px-3 py-1 rounded-full text-xs font-bold text-white shadow-sm"
                                                    style={{ backgroundColor: t.priorityId?.color || '#64748b' }}
                                                >
                                                    {t.priorityId?.name || 'Medium'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-3 py-1 rounded-full text-[10px] font-black border uppercase tracking-wider ${statusStyles[t.status] || 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                                                    {t.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-slate-500">{t.assignedEngineerId?.name || 'Unassigned'}</td>
                                            <td className="px-6 py-4">
                                                <div className="flex justify-center">
                                                    <button
                                                        onClick={() => navigate(`/csm/tickets/${t._id}`)}
                                                        className="flex items-center gap-1.5 px-4 py-2 hover:bg-primary-50 text-primary-600 rounded-xl transition-all hover:scale-105 active:scale-95"
                                                    >
                                                        Details
                                                        <MdArrowForward />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <PaginationControls
                            page={page}
                            totalPages={totalPages}
                            onPageChange={(p) => setPage(p)}
                        />
                    </div>
                )}
            </div>

            {/* Creation Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
                    <div className="bg-white rounded-[2rem] shadow-2xl border border-slate-100 max-w-2xl w-full overflow-hidden my-8 animate-scale-in">
                        <div className="px-6 py-5 border-b border-slate-50 bg-slate-50 flex items-center justify-between">
                            <h3 className="font-outfit font-black text-lg text-slate-900 uppercase">
                                Raise Support Ticket
                            </h3>
                            <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
                        </div>
                        <form onSubmit={handleCreateTicket} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto custom-scrollbar">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Customer *</label>
                                    <select
                                        required
                                        value={formData.customerId}
                                        onChange={(e) => setFormData({ ...formData, customerId: e.target.value })}
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold"
                                    >
                                        <option value="">Select Customer</option>
                                        {customers.map(c => <option key={c._id} value={c._id}>{c.customerName}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Link Product</label>
                                    <select
                                        value={formData.productId}
                                        onChange={(e) => setFormData({ ...formData, productId: e.target.value })}
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold"
                                    >
                                        <option value="">No Product Linked</option>
                                        {products.map(p => <option key={p._id} value={p._id}>{p.productName} ({p.productCode})</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Link Invoice</label>
                                    <select
                                        value={formData.invoiceId}
                                        disabled={!formData.customerId}
                                        onChange={(e) => setFormData({ ...formData, invoiceId: e.target.value })}
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold disabled:bg-slate-50 disabled:text-slate-400"
                                    >
                                        <option value="">{formData.customerId ? 'Select Invoice' : 'Select Customer First'}</option>
                                        {invoices.map(i => <option key={i._id} value={i._id}>{i.voucherNumber} ({new Date(i.date).toLocaleDateString()})</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Ticket Source</label>
                                    <select
                                        value={formData.source}
                                        onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold"
                                    >
                                        <option value="Web Portal">Customer Self-Service</option>
                                        <option value="WhatsApp">WhatsApp Gateway</option>
                                        <option value="Email">Email Parser</option>
                                        <option value="Phone Call">VoIP Phone Call</option>
                                        <option value="Sales Team">Internal Sales Rep</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Contact Person Name</label>
                                    <input
                                        type="text"
                                        value={formData.contactName}
                                        onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Contact Phone</label>
                                    <input
                                        type="text"
                                        value={formData.contactPhone}
                                        onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Contact Email</label>
                                    <input
                                        type="email"
                                        value={formData.contactEmail}
                                        onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Priority *</label>
                                        <select
                                            required
                                            value={formData.priorityId}
                                            onChange={(e) => setFormData({ ...formData, priorityId: e.target.value })}
                                            className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold"
                                        >
                                            <option value="">Select Priority</option>
                                            {priorities.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Category *</label>
                                        <select
                                            required
                                            value={formData.categoryId}
                                            onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                                            className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold"
                                        >
                                            <option value="">Select Category</option>
                                            {categories.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Ticket Type *</label>
                                    <select
                                        required
                                        value={formData.typeId}
                                        onChange={(e) => setFormData({ ...formData, typeId: e.target.value })}
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold"
                                    >
                                        <option value="">Select Type</option>
                                        {types.map(t => <option key={t._id} value={t._id}>{t.name}</option>)}
                                    </select>
                                </div>
                                
                                {/* SLA Preview box */}
                                {selectedPriorityInfo && (
                                    <div className="md:col-span-2 p-4 bg-teal-50 border border-teal-200 rounded-2xl flex items-center justify-between text-xs text-teal-800 font-bold">
                                        <span>⏰ SLA Configuration Applied:</span>
                                        <span>First Response: {selectedPriorityInfo.responseSlaHours} hrs</span>
                                        <span>Resolution: {selectedPriorityInfo.resolutionSlaHours} hrs</span>
                                    </div>
                                )}

                                <div className="md:col-span-2">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Subject *</label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.issueTitle}
                                        onChange={(e) => setFormData({ ...formData, issueTitle: e.target.value })}
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold"
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Description / Notes</label>
                                    <textarea
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold h-24"
                                    />
                                </div>
                            </div>
                            <div className="flex gap-3 pt-4 border-t border-slate-50">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 py-3.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-primary-600/10"
                                >
                                    Raise Ticket
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CSMTickets;
