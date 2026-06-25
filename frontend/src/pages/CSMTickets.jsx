import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { csmService, customerService, productService, voucherService, userService } from '../services/api';
import { toast } from 'react-toastify';
import { MdAdd, MdSearch, MdFilterList, MdArrowForward, MdEdit, MdDelete } from 'react-icons/md';
import PaginationControls from '../components/PaginationControls';
import PortalDropdown from '../components/PortalDropdown';
import Modal from '../components/Modal';

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
    const [sources, setSources] = useState([]);
    const [designations, setDesignations] = useState([]);
    const [customerContacts, setCustomerContacts] = useState([]);
    
    // Modal & Form State
    const [showModal, setShowModal] = useState(false);
    const [showContactModal, setShowContactModal] = useState(false);
    const [contactFormData, setContactFormData] = useState({
        contactName: '',
        designationId: '',
        mobileNo: '',
        email: '',
        isPrimary: false
    });

    // Mini Master Modal State
    const [activeMiniMaster, setActiveMiniMaster] = useState(null);
    const [miniMasterFormData, setMiniMasterFormData] = useState({
        name: '',
        description: '',
        responseSlaHours: '1',
        resolutionSlaHours: '4',
        color: '#3b82f6'
    });
    const [miniMasterSearch, setMiniMasterSearch] = useState('');
    const [editingItemId, setEditingItemId] = useState(null);
    const [editingItemFormData, setEditingItemFormData] = useState({
        name: '',
        description: '',
        responseSlaHours: '1',
        resolutionSlaHours: '4',
        color: '#3b82f6'
    });
    const [formData, setFormData] = useState({
        customerId: '',
        contactId: '',
        contactName: '',
        contactDesignationId: '',
        contactDesignation: '',
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
            const [custRes, priRes, catRes, typRes, prodRes, srcRes, desRes] = await Promise.allSettled([
                customerService.getAll({ limit: 500 }),
                csmService.getPriorities(),
                csmService.getCategories(),
                csmService.getTypes(),
                productService.getAll({ limit: 500 }),
                csmService.getSources(),
                csmService.getDesignations()
            ]);

            const valueOf = (result) => result.status === 'fulfilled' ? result.value : null;
            const customersRes = valueOf(custRes);
            const prioritiesRes = valueOf(priRes);
            const categoriesRes = valueOf(catRes);
            const typesRes = valueOf(typRes);
            const productsRes = valueOf(prodRes);
            const sourcesRes = valueOf(srcRes);
            const designationsRes = valueOf(desRes);

            setCustomers(customersRes?.data?.data || customersRes?.data || []);
            setPriorities(prioritiesRes?.data || []);
            setCategories(categoriesRes?.data || []);
            setTypes(typesRes?.data || []);
            setProducts(productsRes?.data?.data || productsRes?.data || []);
            setSources(sourcesRes?.data || []);
            setDesignations(designationsRes?.data || []);

            const failed = [custRes, priRes, catRes, typRes, prodRes, srcRes, desRes].some(result => result.status === 'rejected');
            if (failed) {
                console.error('One or more ticket form dropdowns failed to load', {
                    customers: custRes.status,
                    priorities: priRes.status,
                    categories: catRes.status,
                    types: typRes.status,
                    products: prodRes.status,
                    sources: srcRes.status,
                    designations: desRes.status
                });
            }
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
            csmService.getCustomerContacts({ customerId: formData.customerId })
                .then(res => setCustomerContacts(res.data || []))
                .catch(err => {
                    console.error('Error fetching customer contacts:', err);
                    setCustomerContacts([]);
                });
        } else {
            setInvoices([]);
            setCustomerContacts([]);
        }
    }, [formData.customerId]);

    const handleCustomerChange = (customerId) => {
        setFormData(prev => ({
            ...prev,
            customerId,
            contactId: '',
            contactName: '',
            contactDesignationId: '',
            contactDesignation: '',
            contactPhone: '',
            contactEmail: '',
            invoiceId: ''
        }));
    };

    const handleContactSelect = (contactId) => {
        const contact = customerContacts.find(c => c._id === contactId);
        setFormData(prev => ({
            ...prev,
            contactId,
            contactName: contact?.contactName || '',
            contactDesignationId: contact?.designationId?._id || '',
            contactDesignation: contact?.designationId?.name || '',
            contactPhone: contact?.mobileNo || '',
            contactEmail: contact?.email || ''
        }));
    };

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

    const handleOpenMiniMaster = (type) => {
        setMiniMasterFormData({
            name: '',
            description: '',
            responseSlaHours: '1',
            resolutionSlaHours: '4',
            color: '#3b82f6'
        });
        setMiniMasterSearch('');
        setEditingItemId(null);
        setActiveMiniMaster(type);
    };

    const handleDeleteMiniMaster = async (id) => {
        if (!window.confirm('Are you sure you want to delete this item?')) return;
        try {
            if (activeMiniMaster === 'source') {
                await csmService.deleteSource(id);
                toast.success('Source deleted');
                const res = await csmService.getSources();
                setSources(res.data || []);
                setFormData(prev => ({ ...prev, source: prev.source === id ? '' : prev.source }));
            } else if (activeMiniMaster === 'category') {
                await csmService.deleteCategory(id);
                toast.success('Category deleted');
                const res = await csmService.getCategories();
                setCategories(res.data || []);
                setFormData(prev => ({ ...prev, categoryId: prev.categoryId === id ? '' : prev.categoryId }));
            } else if (activeMiniMaster === 'type') {
                await csmService.deleteType(id);
                toast.success('Ticket type deleted');
                const res = await csmService.getTypes();
                setTypes(res.data || []);
                setFormData(prev => ({ ...prev, typeId: prev.typeId === id ? '' : prev.typeId }));
            } else if (activeMiniMaster === 'priority') {
                await csmService.deletePriority(id);
                toast.success('Priority deleted');
                const res = await csmService.getPriorities();
                setPriorities(res.data || []);
                setFormData(prev => ({ ...prev, priorityId: prev.priorityId === id ? '' : prev.priorityId }));
            } else if (activeMiniMaster === 'designation') {
                await csmService.deleteDesignation(id);
                toast.success('Designation deleted');
                const res = await csmService.getDesignations();
                setDesignations(res.data || []);
                setFormData(prev => ({
                    ...prev,
                    contactDesignationId: prev.contactDesignationId === id ? '' : prev.contactDesignationId,
                    contactDesignation: prev.contactDesignationId === id ? '' : prev.contactDesignation
                }));
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to delete');
        }
    };

    const handleStartEditMiniMaster = (item) => {
        setEditingItemId(item._id);
        setEditingItemFormData({
            name: item.name || '',
            description: item.description || '',
            responseSlaHours: item.responseSlaHours || '1',
            resolutionSlaHours: item.resolutionSlaHours || '4',
            color: item.color || '#3b82f6'
        });
    };

    const handleSaveEditMiniMaster = async (e, id) => {
        e.preventDefault();
        try {
            if (activeMiniMaster === 'source') {
                await csmService.updateSource(id, { name: editingItemFormData.name });
                toast.success('Source updated');
                const res = await csmService.getSources();
                setSources(res.data || []);
            } else if (activeMiniMaster === 'category') {
                await csmService.updateCategory(id, {
                    name: editingItemFormData.name,
                    description: editingItemFormData.description
                });
                toast.success('Category updated');
                const res = await csmService.getCategories();
                setCategories(res.data || []);
            } else if (activeMiniMaster === 'type') {
                await csmService.updateType(id, {
                    name: editingItemFormData.name,
                    description: editingItemFormData.description
                });
                toast.success('Ticket type updated');
                const res = await csmService.getTypes();
                setTypes(res.data || []);
            } else if (activeMiniMaster === 'priority') {
                await csmService.updatePriority(id, {
                    name: editingItemFormData.name,
                    responseSlaHours: Number(editingItemFormData.responseSlaHours),
                    resolutionSlaHours: Number(editingItemFormData.resolutionSlaHours),
                    color: editingItemFormData.color
                });
                toast.success('Priority updated');
                const res = await csmService.getPriorities();
                setPriorities(res.data || []);
            } else if (activeMiniMaster === 'designation') {
                await csmService.updateDesignation(id, {
                    name: editingItemFormData.name,
                    description: editingItemFormData.description
                });
                toast.success('Designation updated');
                const res = await csmService.getDesignations();
                setDesignations(res.data || []);
            }
            setEditingItemId(null);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to update');
        }
    };

    const handleSelectMiniMasterItem = (item) => {
        if (activeMiniMaster === 'source') {
            setFormData(prev => ({ ...prev, source: item.name }));
        } else if (activeMiniMaster === 'category') {
            setFormData(prev => ({ ...prev, categoryId: item._id }));
        } else if (activeMiniMaster === 'type') {
            setFormData(prev => ({ ...prev, typeId: item._id }));
        } else if (activeMiniMaster === 'priority') {
            setFormData(prev => ({ ...prev, priorityId: item._id }));
        } else if (activeMiniMaster === 'designation') {
            setFormData(prev => ({
                ...prev,
                contactDesignationId: item._id,
                contactDesignation: item.name
            }));
        }
        setActiveMiniMaster(null);
    };

    const handleCreateCustomerContact = async (e) => {
        e.preventDefault();
        if (!formData.customerId) {
            toast.error('Select a customer first');
            return;
        }

        try {
            const res = await csmService.createCustomerContact({
                customerId: formData.customerId,
                ...contactFormData
            });
            const contactsRes = await csmService.getCustomerContacts({ customerId: formData.customerId });
            setCustomerContacts(contactsRes.data || []);
            setFormData(prev => ({
                ...prev,
                contactId: res.data._id,
                contactName: res.data.contactName || '',
                contactDesignationId: res.data.designationId?._id || '',
                contactDesignation: res.data.designationId?.name || '',
                contactPhone: res.data.mobileNo || '',
                contactEmail: res.data.email || ''
            }));
            setShowContactModal(false);
            setContactFormData({
                contactName: '',
                designationId: '',
                mobileNo: '',
                email: '',
                isPrimary: false
            });
            toast.success('Customer contact added');
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to add customer contact');
        }
    };

    const handleCreateMiniMaster = async (e) => {
        e.preventDefault();
        try {
            let res;
            if (activeMiniMaster === 'source') {
                res = await csmService.createSource({ name: miniMasterFormData.name });
                toast.success('Ticket source added!');
                const srcRes = await csmService.getSources();
                setSources(srcRes.data || []);
                setFormData(prev => ({ ...prev, source: miniMasterFormData.name }));
            } else if (activeMiniMaster === 'category') {
                res = await csmService.createCategory({
                    name: miniMasterFormData.name,
                    description: miniMasterFormData.description
                });
                toast.success('Category added!');
                const catRes = await csmService.getCategories();
                setCategories(catRes.data || []);
                setFormData(prev => ({ ...prev, categoryId: res.data._id }));
            } else if (activeMiniMaster === 'type') {
                res = await csmService.createType({
                    name: miniMasterFormData.name,
                    description: miniMasterFormData.description
                });
                toast.success('Ticket type added!');
                const typRes = await csmService.getTypes();
                setTypes(typRes.data || []);
                setFormData(prev => ({ ...prev, typeId: res.data._id }));
            } else if (activeMiniMaster === 'priority') {
                res = await csmService.createPriority({
                    name: miniMasterFormData.name,
                    responseSlaHours: Number(miniMasterFormData.responseSlaHours),
                    resolutionSlaHours: Number(miniMasterFormData.resolutionSlaHours),
                    color: miniMasterFormData.color
                });
                toast.success('Priority tier added!');
                const priRes = await csmService.getPriorities();
                setPriorities(priRes.data || []);
                setFormData(prev => ({ ...prev, priorityId: res.data._id }));
            } else if (activeMiniMaster === 'designation') {
                res = await csmService.createDesignation({
                    name: miniMasterFormData.name,
                    description: miniMasterFormData.description
                });
                toast.success('Designation added!');
                const desRes = await csmService.getDesignations();
                setDesignations(desRes.data || []);
                setFormData(prev => ({
                    ...prev,
                    contactDesignationId: res.data._id,
                    contactDesignation: res.data.name
                }));
            }
            setActiveMiniMaster(null);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to add item');
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
                            contactId: '',
                            contactName: '',
                            contactDesignationId: '',
                            contactDesignation: '',
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
                        setCustomerContacts([]);
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
            <Modal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                title="Raise Support Ticket"
                maxWidth="max-w-2xl"
                footer={
                    <>
                        <button
                            type="button"
                            onClick={() => setShowModal(false)}
                            className="w-full md:w-auto px-6 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            form="create-ticket-form"
                            className="w-full md:w-auto px-6 py-3.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-primary-600/10"
                        >
                            Raise Ticket
                        </button>
                    </>
                }
            >
                <form id="create-ticket-form" onSubmit={handleCreateTicket} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Customer *</label>
                            <select
                                required
                                value={formData.customerId}
                                onChange={(e) => handleCustomerChange(e.target.value)}
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
                            <div className="flex justify-between items-center mb-1">
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Ticket Source</label>
                                <button 
                                    type="button" 
                                    onClick={() => handleOpenMiniMaster('source')}
                                    className="text-[10px] font-black uppercase text-primary-600 hover:text-primary-700 tracking-wider flex items-center gap-0.5"
                                >
                                    + Quick Add
                                </button>
                            </div>
                            <select
                                value={formData.source}
                                onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold"
                            >
                                <option value="">Select Source</option>
                                {sources.map(s => <option key={s._id} value={s.name}>{s.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <div className="flex justify-between items-center mb-1">
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Contact Person Name</label>
                                <button
                                    type="button"
                                    onClick={() => setShowContactModal(true)}
                                    disabled={!formData.customerId}
                                    className="text-[10px] font-black uppercase text-primary-600 hover:text-primary-700 tracking-wider flex items-center gap-0.5 disabled:text-slate-300"
                                >
                                    + Quick Add
                                </button>
                            </div>
                            <select
                                value={formData.contactId}
                                onChange={(e) => handleContactSelect(e.target.value)}
                                disabled={!formData.customerId}
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold"
                            >
                                <option value="">{formData.customerId ? 'Select Contact Person' : 'Select Customer First'}</option>
                                {customerContacts.map(c => (
                                    <option key={c._id} value={c._id}>
                                        {c.contactName}{c.isPrimary ? ' (Primary)' : ''}
                                    </option>
                                ))}
                            </select>
                            {formData.customerId && customerContacts.length === 0 && (
                                <p className="text-[10px] font-bold text-amber-600 mt-1">No contacts saved for this customer yet.</p>
                            )}
                        </div>
                        <div>
                            <div className="flex justify-between items-center mb-1">
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Designation</label>
                                <button 
                                    type="button" 
                                    onClick={() => handleOpenMiniMaster('designation')}
                                    className="text-[10px] font-black uppercase text-primary-600 hover:text-primary-700 tracking-wider flex items-center gap-0.5"
                                >
                                    + Quick Add
                                </button>
                            </div>
                            <select
                                value={formData.contactDesignationId}
                                onChange={(e) => {
                                    const designation = designations.find(d => d._id === e.target.value);
                                    setFormData({
                                        ...formData,
                                        contactDesignationId: e.target.value,
                                        contactDesignation: designation?.name || ''
                                    });
                                }}
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold"
                            >
                                <option value="">Select Designation</option>
                                {designations.map(d => <option key={d._id} value={d._id}>{d.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Contact Phone</label>
                            <input
                                type="text"
                                value={formData.contactPhone}
                                onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold bg-slate-50"
                                readOnly={Boolean(formData.contactId)}
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Contact Email</label>
                            <input
                                type="email"
                                value={formData.contactEmail}
                                onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold bg-slate-50"
                                readOnly={Boolean(formData.contactId)}
                            />
                        </div>
                        <div>
                            <div className="flex justify-between items-center mb-1">
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Priority *</label>
                                <button 
                                    type="button" 
                                    onClick={() => handleOpenMiniMaster('priority')}
                                    className="text-[10px] font-black uppercase text-primary-600 hover:text-primary-700 tracking-wider flex items-center gap-0.5"
                                >
                                    + Quick Add
                                </button>
                            </div>
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
                            <div className="flex justify-between items-center mb-1">
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Category *</label>
                                <button 
                                    type="button" 
                                    onClick={() => handleOpenMiniMaster('category')}
                                    className="text-[10px] font-black uppercase text-primary-600 hover:text-primary-700 tracking-wider flex items-center gap-0.5"
                                >
                                    + Quick Add
                                </button>
                            </div>
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
                        <div className="md:col-span-2">
                            <div className="flex justify-between items-center mb-1">
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Ticket Type *</label>
                                <button 
                                    type="button" 
                                    onClick={() => handleOpenMiniMaster('type')}
                                    className="text-[10px] font-black uppercase text-primary-600 hover:text-primary-700 tracking-wider flex items-center gap-0.5"
                                >
                                    + Quick Add
                                </button>
                            </div>
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
                </form>
            </Modal>

            <Modal
                isOpen={showContactModal}
                onClose={() => setShowContactModal(false)}
                title="Add Customer Contact"
                maxWidth="max-w-md"
                footer={
                    <>
                        <button
                            type="button"
                            onClick={() => setShowContactModal(false)}
                            className="w-full md:w-auto px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            form="customer-contact-form"
                            className="w-full md:w-auto px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-primary-600/20"
                        >
                            Save Contact
                        </button>
                    </>
                }
            >
                <form id="customer-contact-form" onSubmit={handleCreateCustomerContact} className="space-y-4">
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Contact Person Name *</label>
                        <input
                            type="text"
                            required
                            value={contactFormData.contactName}
                            onChange={(e) => setContactFormData({ ...contactFormData, contactName: e.target.value })}
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold"
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Designation</label>
                        <select
                            value={contactFormData.designationId}
                            onChange={(e) => setContactFormData({ ...contactFormData, designationId: e.target.value })}
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold"
                        >
                            <option value="">Select Designation</option>
                            {designations.map(d => <option key={d._id} value={d._id}>{d.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Mobile Number</label>
                        <input
                            type="text"
                            value={contactFormData.mobileNo}
                            onChange={(e) => setContactFormData({ ...contactFormData, mobileNo: e.target.value })}
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold"
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Email Address</label>
                        <input
                            type="email"
                            value={contactFormData.email}
                            onChange={(e) => setContactFormData({ ...contactFormData, email: e.target.value })}
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold"
                        />
                    </div>
                    <label className="flex items-center gap-2 text-xs font-bold text-slate-600">
                        <input
                            type="checkbox"
                            checked={contactFormData.isPrimary}
                            onChange={(e) => setContactFormData({ ...contactFormData, isPrimary: e.target.checked })}
                            className="h-4 w-4 rounded border-slate-300 text-primary-600"
                        />
                        Mark as primary contact
                    </label>
                </form>
            </Modal>

            {/* Mini Master Modal */}
            <Modal
                isOpen={activeMiniMaster !== null}
                onClose={() => setActiveMiniMaster(null)}
                title={`Manage ${activeMiniMaster ? activeMiniMaster.charAt(0).toUpperCase() + activeMiniMaster.slice(1) + 's' : ''}`}
                maxWidth="max-w-md"
                footer={
                    <button
                        type="button"
                        onClick={() => setActiveMiniMaster(null)}
                        className="w-full md:w-auto px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                    >
                        Close
                    </button>
                }
            >
                <div className="space-y-4">
                    {/* Search Field */}
                    <div>
                        <input
                            type="text"
                            placeholder="Search existing..."
                            value={miniMasterSearch}
                            onChange={(e) => setMiniMasterSearch(e.target.value)}
                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                    </div>

                    {/* Add New Form inline */}
                    <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl space-y-3">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Add New Entry</p>
                        <div className="grid grid-cols-1 gap-3">
                            <input
                                type="text"
                                placeholder="Name/Value *"
                                required
                                value={miniMasterFormData.name}
                                onChange={(e) => setMiniMasterFormData({ ...miniMasterFormData, name: e.target.value })}
                                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold bg-white"
                            />
                            {(activeMiniMaster === 'category' || activeMiniMaster === 'type' || activeMiniMaster === 'designation') && (
                                <input
                                    type="text"
                                    placeholder="Description"
                                    value={miniMasterFormData.description}
                                    onChange={(e) => setMiniMasterFormData({ ...miniMasterFormData, description: e.target.value })}
                                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold bg-white"
                                />
                            )}
                            {activeMiniMaster === 'priority' && (
                                <>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Response SLA (Hrs)</label>
                                            <input
                                                type="number"
                                                required
                                                min="1"
                                                value={miniMasterFormData.responseSlaHours}
                                                onChange={(e) => setMiniMasterFormData({ ...miniMasterFormData, responseSlaHours: e.target.value })}
                                                className="w-full px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold bg-white"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Resolution SLA (Hrs)</label>
                                            <input
                                                type="number"
                                                required
                                                min="1"
                                                value={miniMasterFormData.resolutionSlaHours}
                                                onChange={(e) => setMiniMasterFormData({ ...miniMasterFormData, resolutionSlaHours: e.target.value })}
                                                className="w-full px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold bg-white"
                                            />
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-slate-500 font-bold">Color Tag:</span>
                                        <input
                                            type="color"
                                            value={miniMasterFormData.color}
                                            onChange={(e) => setMiniMasterFormData({ ...miniMasterFormData, color: e.target.value })}
                                            className="h-8 w-16 p-0 rounded border border-slate-200 cursor-pointer bg-white"
                                        />
                                    </div>
                                </>
                            )}
                            <button
                                type="button"
                                onClick={handleCreateMiniMaster}
                                disabled={!miniMasterFormData.name.trim()}
                                className="py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-md disabled:bg-slate-300 disabled:shadow-none"
                            >
                                + Create & Select
                            </button>
                        </div>
                    </div>

                    {/* Existing Items List */}
                    <div className="space-y-2.5 max-h-[30vh] overflow-y-auto pr-1 custom-scrollbar">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Existing Entries</p>
                        {(() => {
                            let itemsList = [];
                            if (activeMiniMaster === 'source') itemsList = sources;
                            else if (activeMiniMaster === 'category') itemsList = categories;
                            else if (activeMiniMaster === 'type') itemsList = types;
                            else if (activeMiniMaster === 'priority') itemsList = priorities;
                            else if (activeMiniMaster === 'designation') itemsList = designations;

                            const filtered = miniMasterSearch.trim() 
                                ? itemsList.filter(item => item.name?.toLowerCase().includes(miniMasterSearch.toLowerCase()))
                                : itemsList;

                            if (filtered.length === 0) {
                                return <p className="text-xs text-slate-400 font-bold italic py-2">No matching items found.</p>;
                            }

                            return filtered.map(item => {
                                const isEditing = editingItemId === item._id;
                                return (
                                    <div key={item._id} className="p-3 border border-slate-100 hover:border-slate-200 rounded-2xl flex flex-col gap-2 transition-all bg-white shadow-sm">
                                        {isEditing ? (
                                            <form onSubmit={(e) => handleSaveEditMiniMaster(e, item._id)} className="space-y-3 w-full">
                                                <input
                                                    type="text"
                                                    required
                                                    value={editingItemFormData.name}
                                                    onChange={(e) => setEditingItemFormData({ ...editingItemFormData, name: e.target.value })}
                                                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold"
                                                />
                                                {(activeMiniMaster === 'category' || activeMiniMaster === 'type' || activeMiniMaster === 'designation') && (
                                                    <input
                                                        type="text"
                                                        value={editingItemFormData.description}
                                                        onChange={(e) => setEditingItemFormData({ ...editingItemFormData, description: e.target.value })}
                                                        className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold"
                                                        placeholder="Description"
                                                    />
                                                )}
                                                {activeMiniMaster === 'priority' && (
                                                    <>
                                                        <div className="grid grid-cols-2 gap-2">
                                                            <input
                                                                type="number"
                                                                required
                                                                min="1"
                                                                value={editingItemFormData.responseSlaHours}
                                                                onChange={(e) => setEditingItemFormData({ ...editingItemFormData, responseSlaHours: e.target.value })}
                                                                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold"
                                                                placeholder="Response SLA"
                                                            />
                                                            <input
                                                                type="number"
                                                                required
                                                                min="1"
                                                                value={editingItemFormData.resolutionSlaHours}
                                                                onChange={(e) => setEditingItemFormData({ ...editingItemFormData, resolutionSlaHours: e.target.value })}
                                                                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold"
                                                                placeholder="Resolution SLA"
                                                            />
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-[10px] text-slate-500 font-bold">Color Tag:</span>
                                                            <input
                                                                type="color"
                                                                value={editingItemFormData.color}
                                                                onChange={(e) => setEditingItemFormData({ ...editingItemFormData, color: e.target.value })}
                                                                className="h-6 w-12 p-0 rounded border border-slate-200 cursor-pointer"
                                                            />
                                                        </div>
                                                    </>
                                                )}
                                                <div className="flex justify-end gap-2 text-[10px] font-black uppercase tracking-wider">
                                                    <button type="button" onClick={() => setEditingItemId(null)} className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg">Cancel</button>
                                                    <button type="submit" className="px-3 py-1 bg-teal-600 hover:bg-teal-700 text-white rounded-lg">Save</button>
                                                </div>
                                            </form>
                                        ) : (
                                            <div className="flex items-center justify-between gap-3 w-full">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <p className="font-bold text-sm text-slate-900 truncate">{item.name}</p>
                                                        {activeMiniMaster === 'priority' && (
                                                            <span 
                                                                className="h-3 w-3 rounded-full border border-black/10 shadow-sm"
                                                                style={{ backgroundColor: item.color }}
                                                            />
                                                        )}
                                                    </div>
                                                    {activeMiniMaster === 'priority' && (
                                                        <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">Response: {item.responseSlaHours}h | Resolution: {item.resolutionSlaHours}h</p>
                                                    )}
                                                    {(activeMiniMaster === 'category' || activeMiniMaster === 'type' || activeMiniMaster === 'designation') && item.description && (
                                                        <p className="text-[11px] text-slate-400 font-semibold truncate mt-0.5">{item.description}</p>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleSelectMiniMasterItem(item)}
                                                        className="px-2.5 py-1.5 bg-primary-50 hover:bg-primary-100 text-primary-700 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all"
                                                    >
                                                        Select
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleStartEditMiniMaster(item)}
                                                        className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-slate-700 rounded-lg transition-all"
                                                        title="Edit"
                                                    >
                                                        <MdEdit size={16} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDeleteMiniMaster(item._id)}
                                                        className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition-all"
                                                        title="Delete"
                                                    >
                                                        <MdDelete size={16} />
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            });
                        })()}
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default CSMTickets;
