import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { MdAdd, MdDelete, MdEdit, MdSearch, MdContactPhone, MdFileDownload, MdArrowBack } from 'react-icons/md';
import { toast } from 'react-toastify';
import * as XLSX from 'xlsx';
import Modal from '../components/Modal';
import ImportModal from '../components/ImportModal';
import PaginationControls from '../components/PaginationControls';
import { contactService, customerService, csmService, importService } from '../services/api';
import SearchableSelect from '../components/SearchableSelect';

const LIST_PAGE_SIZE = 20;

const CUSTOMER_TYPES = ['Customer', 'Prospect', 'Vendor', 'Partner'];

const defaultForm = {
    contactName: '',
    firstName: '',
    lastName: '',
    company: '',
    department: '',
    designation: '',
    industry: '',
    gstin: '',
    website: '',
    phone: '',
    alternatePhone: '',
    whatsappNumber: '',
    email: '',
    alternateEmail: '',
    officePhone: '',
    customerType: '',
    dob: '',
    anniversaryDate: '',
    bloodGroup: '',
    gender: '',
    maritalStatus: '',
    country: 'India',
    state: '',
    city: '',
    pincode: '',
    addressLine1: '',
    addressLine2: '',
    lastInteractionDate: '',
    notes: ''
};

const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    if (isNaN(d)) return dateStr;
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const customerTypeBadge = (type) => {
    const styles = {
        Customer: 'bg-emerald-50 text-emerald-600 border-emerald-100',
        Prospect: 'bg-amber-50 text-amber-600 border-amber-100',
        Vendor: 'bg-blue-50 text-blue-600 border-blue-100',
        Partner: 'bg-purple-50 text-purple-600 border-purple-100',
    };
    if (!type) return null;
    return (
        <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-[0.1em] border ${styles[type] || 'bg-slate-100 text-slate-400 border-slate-200'}`}>
            {type}
        </span>
    );
};

const Contacts = ({ isCreatePage, isEditPage }) => {
    const navigate = useNavigate();
    const { id: routeId } = useParams();
    const [contacts, setContacts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [filterType, setFilterType] = useState('');
    const [page, setPage] = useState(1);
    const [pagination, setPagination] = useState({ page: 1, limit: LIST_PAGE_SIZE, total: 0, pages: 1 });
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [editingContact, setEditingContact] = useState(null);
    const [formData, setFormData] = useState(defaultForm);

    // Masters lists
    const [customers, setCustomers] = useState([]);
    const [designations, setDesignations] = useState([]);
    const [customCompanies, setCustomCompanies] = useState([]);

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

    // Load customer and designation master data
    const loadMasterData = async () => {
        try {
            const [custRes, desRes] = await Promise.allSettled([
                customerService.getAll({ limit: 1000 }),
                csmService.getDesignations()
            ]);
            if (custRes.status === 'fulfilled') {
                setCustomers(custRes.value.data?.data || custRes.value.data || []);
            }
            if (desRes.status === 'fulfilled') {
                setDesignations(desRes.value.data || []);
            }
        } catch (error) {
            console.error('Failed to load master data for contacts:', error);
        }
    };

    useEffect(() => {
        loadMasterData();
    }, []);

    const customerOptions = useMemo(() => {
        const list = [];
        customers.forEach(c => {
            const name = c.companyName || c.customerName;
            if (name && !list.includes(name)) {
                list.push(name);
            }
        });
        customCompanies.forEach(c => {
            if (c && !list.includes(c)) {
                list.push(c);
            }
        });
        if (formData.company && !list.includes(formData.company)) {
            list.push(formData.company);
        }
        return list.map(name => ({ value: name, label: name }));
    }, [customers, customCompanies, formData.company]);

    const handleAddCompany = (name) => {
        setCustomCompanies(prev => [...prev, name]);
        setFormData(prev => ({ ...prev, company: name }));
        toast.success(`Custom company "${name}" added`);
    };

    // Mini Master Handlers
    const handleOpenMiniMaster = (type) => {
        setActiveMiniMaster(type);
        setMiniMasterFormData({
            name: '',
            description: '',
            responseSlaHours: '1',
            resolutionSlaHours: '4',
            color: '#3b82f6'
        });
        setMiniMasterSearch('');
        setEditingItemId(null);
    };

    const handleDeleteMiniMaster = async (id) => {
        if (!window.confirm('Are you sure you want to delete this item?')) return;
        try {
            if (activeMiniMaster === 'designation') {
                const deletedItem = designations.find(d => d._id === id);
                await csmService.deleteDesignation(id);
                toast.success('Designation deleted');
                const res = await csmService.getDesignations();
                setDesignations(res.data || []);
                if (deletedItem && formData.designation === deletedItem.name) {
                    setFormData(prev => ({ ...prev, designation: '' }));
                }
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
            if (activeMiniMaster === 'designation') {
                const oldItem = designations.find(d => d._id === id);
                await csmService.updateDesignation(id, {
                    name: editingItemFormData.name,
                    description: editingItemFormData.description
                });
                toast.success('Designation updated');
                const res = await csmService.getDesignations();
                setDesignations(res.data || []);
                if (oldItem && formData.designation === oldItem.name) {
                    setFormData(prev => ({ ...prev, designation: editingItemFormData.name }));
                }
            }
            setEditingItemId(null);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to update');
        }
    };

    const handleSelectMiniMasterItem = (item) => {
        if (activeMiniMaster === 'designation') {
            setFormData(prev => ({
                ...prev,
                designation: item.name
            }));
        }
        setActiveMiniMaster(null);
    };

    const handleCreateMiniMaster = async (e) => {
        e.preventDefault();
        try {
            if (activeMiniMaster === 'designation') {
                const res = await csmService.createDesignation({
                    name: miniMasterFormData.name,
                    description: miniMasterFormData.description
                });
                toast.success('Designation added!');
                const desRes = await csmService.getDesignations();
                setDesignations(desRes.data || []);
                setFormData(prev => ({
                    ...prev,
                    designation: res.data.name
                }));
            }
            setActiveMiniMaster(null);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to add item');
        }
    };

    const fetchContacts = async () => {
        setLoading(true);
        try {
            const params = {
                page,
                limit: LIST_PAGE_SIZE,
            };
            if (debouncedSearch) params.search = debouncedSearch;
            if (filterType) params.customerType = filterType;

            const res = await contactService.getAll(params);
            const payload = res.data;
            setContacts(Array.isArray(payload) ? payload : payload.data || []);
            setPagination(payload.pagination || {
                page: 1,
                limit: LIST_PAGE_SIZE,
                total: Array.isArray(payload) ? payload.length : 0,
                pages: 1
            });
        } catch (err) {
            console.error('Error fetching contacts:', err);
            toast.error('Failed to fetch contacts');
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
        fetchContacts();
    }, [page, debouncedSearch, filterType]);

    const filteredContacts = useMemo(() => contacts, [contacts]);

    const validateContactForm = (data) => {
        if (!data.contactName || !data.contactName.trim()) {
            return 'Contact Name is mandatory';
        }
        if (data.contactName.trim().length < 2) {
            return 'Contact Name must be at least 2 characters long';
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (data.email && data.email.trim() && !emailRegex.test(data.email.trim())) {
            return 'Please enter a valid primary Email address';
        }
        if (data.alternateEmail && data.alternateEmail.trim() && !emailRegex.test(data.alternateEmail.trim())) {
            return 'Please enter a valid alternate Email address';
        }

        if (data.phone && data.phone.trim()) {
            const cleanPhone = data.phone.replace(/[\s\-\(\)\+]/g, '');
            if (cleanPhone.length < 10 || cleanPhone.length > 13) {
                return 'Primary Mobile number must be a valid 10-digit phone number';
            }
        }
        if (data.alternatePhone && data.alternatePhone.trim()) {
            const cleanAlt = data.alternatePhone.replace(/[\s\-\(\)\+]/g, '');
            if (cleanAlt.length < 10 || cleanAlt.length > 13) {
                return 'Alternate Mobile number must be a valid 10-digit phone number';
            }
        }
        if (data.whatsappNumber && data.whatsappNumber.trim()) {
            const cleanWA = data.whatsappNumber.replace(/[\s\-\(\)\+]/g, '');
            if (cleanWA.length < 10 || cleanWA.length > 13) {
                return 'WhatsApp number must be a valid 10-digit phone number';
            }
        }

        if (data.gstin && data.gstin.trim()) {
            const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
            if (!gstRegex.test(data.gstin.trim().toUpperCase())) {
                return 'Invalid GSTIN format. Expected format: 27AAAAA0000A1Z5';
            }
        }

        if (data.pincode && data.pincode.trim()) {
            if (!/^\d{6}$/.test(data.pincode.trim())) {
                return 'PIN Code must be exactly 6 numeric digits';
            }
        }

        const today = new Date();
        today.setHours(23, 59, 59, 999);

        if (data.dob) {
            const dobDate = new Date(data.dob);
            if (dobDate > today) {
                return 'Date of Birth (DOB) cannot be in the future';
            }
        }

        if (data.anniversaryDate) {
            const annivDate = new Date(data.anniversaryDate);
            if (annivDate > today) {
                return 'Anniversary Date cannot be in the future';
            }
            if (data.dob) {
                const dobDate = new Date(data.dob);
                if (annivDate < dobDate) {
                    return 'Anniversary Date cannot be prior to Date of Birth';
                }
            }
        }

        return null;
    };

    const populateForm = (item) => ({
        contactName: item.contactName || '',
        firstName: item.firstName || '',
        lastName: item.lastName || '',
        company: item.company || '',
        department: item.department || '',
        designation: item.designation || '',
        industry: item.industry || '',
        gstin: item.gstin || '',
        website: item.website || '',
        phone: item.phone || '',
        alternatePhone: item.alternatePhone || '',
        whatsappNumber: item.whatsappNumber || '',
        email: item.email || '',
        alternateEmail: item.alternateEmail || '',
        officePhone: item.officePhone || '',
        customerType: item.customerType || '',
        dob: item.dob ? item.dob.substring(0, 10) : '',
        anniversaryDate: item.anniversaryDate ? item.anniversaryDate.substring(0, 10) : '',
        bloodGroup: item.bloodGroup || '',
        gender: item.gender || '',
        maritalStatus: item.maritalStatus || '',
        country: item.country || 'India',
        state: item.state || '',
        city: item.city || '',
        pincode: item.pincode || '',
        addressLine1: item.addressLine1 || '',
        addressLine2: item.addressLine2 || '',
        lastInteractionDate: item.lastInteractionDate ? item.lastInteractionDate.substring(0, 10) : '',
        notes: item.notes || ''
    });

    useEffect(() => {
        if (isCreatePage) {
            setEditingContact(null);
            setFormData(defaultForm);
            setIsModalOpen(true);
        } else if (isEditPage && routeId) {
            setIsModalOpen(true);
            const found = contacts.find(c => c._id === routeId);
            if (found) {
                setEditingContact(found);
                setFormData(populateForm(found));
            } else {
                contactService.getAll({ limit: 1000 }).then(res => {
                    const list = Array.isArray(res.data) ? res.data : res.data?.data || [];
                    const item = list.find(c => c._id === routeId);
                    if (item) {
                        setEditingContact(item);
                        setFormData(populateForm(item));
                    }
                }).catch(err => console.error("Failed to load contact", err));
            }
        }
    }, [isCreatePage, isEditPage, routeId]);

    const openModal = (contact = null) => {
        if (contact) {
            navigate(`/contacts/edit/${contact._id}`);
        } else {
            navigate('/contacts/new');
        }
    };

    const onChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const onSubmit = async (e) => {
        e.preventDefault();
        
        const validationError = validateContactForm(formData);
        if (validationError) {
            toast.error(validationError);
            return;
        }

        try {
            if (editingContact) {
                await contactService.update(editingContact._id, formData);
                toast.success('Contact updated successfully');
            } else {
                await contactService.create(formData);
                toast.success('Contact created successfully');
            }
            setIsModalOpen(false);
            fetchContacts();
            navigate('/contacts');
        } catch (err) {
            console.error('Error saving contact:', err);
            toast.error(err.response?.data?.message || 'Error saving contact');
        }
    };

    const onDelete = async (contactId) => {
        if (!window.confirm('Are you sure you want to delete this contact?')) return;
        try {
            await contactService.delete(contactId);
            toast.success('Contact deleted');
            fetchContacts();
        } catch (err) {
            console.error('Error deleting contact:', err);
            toast.error(err.response?.data?.message || 'Error deleting contact');
        }
    };

    const exportToExcel = () => {
        if (!contacts.length) {
            toast.info('No contacts to export');
            return;
        }

        const exportData = contacts.map((c) => ({
            'Contact ID': c.contactId || '',
            'Contact Name': c.contactName || '',
            'Company': c.company || '',
            'Email': c.email || '',
            'Phone': c.phone || '',
            'Designation': c.designation || '',
            'Customer Type': c.customerType || '',
            'Last Interaction': c.lastInteractionDate ? formatDate(c.lastInteractionDate) : '',
            'Notes': c.notes || ''
        }));

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Contacts');
        XLSX.writeFile(wb, `Contacts_${new Date().toISOString().slice(0, 10)}.xlsx`);
        toast.success('Exported successfully');
    };

    return (
        <div className="space-y-6">
            {!(isModalOpen || isCreatePage || isEditPage) ? (
                <>
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">Contacts</h1>
                    <p className="text-slate-500 font-medium">Manage your contacts — customers, prospects, vendors &amp; partners.</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={exportToExcel}
                        className="flex items-center justify-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-5 py-3 rounded-2xl font-bold transition-all shadow-sm uppercase text-xs tracking-widest active:scale-95"
                    >
                        <MdFileDownload size={18} />
                        <span>Export</span>
                    </button>
                    <button
                        onClick={() => setIsImportModalOpen(true)}
                        className="flex items-center justify-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-5 py-3 rounded-2xl font-bold transition-all shadow-sm uppercase text-xs tracking-widest active:scale-95"
                    >
                        <MdFileDownload className="rotate-180" size={18} />
                        <span>Import</span>
                    </button>
                    <button
                        onClick={() => openModal()}
                        className="flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-2xl font-bold transition-all shadow-xl shadow-primary-600/20 uppercase text-xs tracking-widest active:scale-95"
                    >
                        <MdAdd size={20} />
                        <span>Add Contact</span>
                    </button>
                </div>
            </div>

            <div className="mobile-master-shell bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
                <div className="mobile-master-toolbar p-6 border-b border-slate-50 flex flex-col md:flex-row gap-4 items-center bg-slate-50/30">
                    <div className="relative flex-1 w-full text-slate-400 focus-within:text-primary-600 transition-colors">
                        <MdSearch className="absolute left-4 top-1/2 -translate-y-1/2" size={20} />
                        <input
                            type="text"
                            placeholder="Search by name, company, email or phone..."
                            className="w-full pl-12 pr-4 py-3.5 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 outline-none text-sm text-slate-900 transition-all font-medium"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <select
                        value={filterType}
                        onChange={(e) => { setFilterType(e.target.value); setPage(1); }}
                        className="px-4 py-3.5 bg-white border border-slate-200 rounded-2xl text-sm font-medium text-slate-700 outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all min-w-[160px]"
                    >
                        <option value="">All Types</option>
                        {CUSTOMER_TYPES.map((t) => (
                            <option key={t} value={t}>{t}</option>
                        ))}
                    </select>
                </div>

                {loading ? (
                    <div className="p-20 text-center text-slate-400 font-medium">
                        <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-primary-500 border-t-transparent mb-4"></div>
                        <p className="text-xs uppercase font-black tracking-widest">Loading Contacts...</p>
                    </div>
                ) : (
                    <>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 text-slate-400 text-[10px] uppercase font-black tracking-widest border-b border-slate-100">
                                <tr>
                                    <th className="px-6 py-5">Contact ID</th>
                                    <th className="px-6 py-5">Contact Name</th>
                                    <th className="px-6 py-5">Company</th>
                                    <th className="px-6 py-5">Email</th>
                                    <th className="px-6 py-5">Phone</th>
                                    <th className="px-6 py-5">Designation</th>
                                    <th className="px-6 py-5 text-center">Type</th>
                                    <th className="px-6 py-5">Last Interaction</th>
                                    <th className="px-6 py-5">Notes</th>
                                    <th className="px-6 py-5 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {filteredContacts.map((contact) => (
                                    <tr key={contact._id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-6 py-5">
                                            <span className="text-xs font-black text-slate-500">{contact.contactId || '-'}</span>
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="flex items-center gap-3">
                                                <div className="h-9 w-9 rounded-xl bg-primary-50 flex items-center justify-center text-primary-600 shrink-0">
                                                    <MdContactPhone size={18} />
                                                </div>
                                                <div
                                                     className="font-black text-primary-600 hover:text-primary-800 cursor-pointer hover:underline text-sm"
                                                     onClick={() => navigate(`/contacts/${contact._id}/360`)}
                                                 >
                                                     {contact.contactName}
                                                 </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="text-sm font-bold text-slate-700">{contact.company || '-'}</div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="text-sm text-slate-600">{contact.email || '-'}</div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="text-sm font-bold text-slate-700">{contact.phone || '-'}</div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="text-sm text-slate-600">{contact.designation || '-'}</div>
                                        </td>
                                        <td className="px-6 py-5 text-center">
                                            {customerTypeBadge(contact.customerType)}
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="text-sm text-slate-600">{formatDate(contact.lastInteractionDate)}</div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="text-xs text-slate-500 max-w-[150px] truncate" title={contact.notes}>{contact.notes || '-'}</div>
                                        </td>
                                        <td className="px-6 py-5 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => openModal(contact)}
                                                    className="p-2.5 text-primary-600 hover:bg-primary-50 rounded-xl transition-all shadow-sm bg-white border border-slate-100"
                                                    title="Edit Contact"
                                                >
                                                    <MdEdit size={18} />
                                                </button>
                                                <button
                                                    onClick={() => onDelete(contact._id)}
                                                    className="p-2.5 text-rose-500 hover:bg-rose-50 rounded-xl transition-all shadow-sm bg-white border border-slate-100"
                                                    title="Delete Contact"
                                                >
                                                    <MdDelete size={18} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {!filteredContacts.length && (
                                    <tr>
                                        <td colSpan={10} className="py-16 text-center text-slate-400 text-sm font-bold">
                                            No contacts found.
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
                                    onClick={() => { setIsModalOpen(false); navigate('/contacts'); }}
                                    className="p-3 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-2xl transition-all border border-slate-200"
                                >
                                    <MdArrowBack size={20} />
                                </button>
                                <div>
                                    <h1 className="text-xl font-black text-slate-900">
                                        {editingContact ? 'Edit Contact' : 'Create Contact'}
                                    </h1>
                                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                                        {editingContact ? `Update contact details for ${editingContact.contactName}` : 'Add a new contact to directory'}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    type="button"
                                    onClick={() => { setIsModalOpen(false); navigate('/contacts'); }}
                                    className="px-6 py-3 rounded-2xl border border-slate-200 text-slate-600 font-black uppercase text-xs tracking-widest hover:bg-slate-50 transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={onSubmit}
                                    className="bg-primary-600 hover:bg-primary-700 text-white px-8 py-3 rounded-2xl font-black transition-all shadow-xl shadow-primary-600/20 uppercase text-xs tracking-widest active:scale-95"
                                >
                                    {editingContact ? 'Update Contact' : 'Save Contact'}
                                </button>
                            </div>
                        </div>

                        {/* Form Card Body */}
                        <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
                            <form onSubmit={onSubmit} className="space-y-8">
                                
                                {/* SECTION 1: BASIC INFORMATION */}
                                <div className="space-y-4">
                                    <h3 className="font-outfit font-black text-sm text-primary-600 uppercase tracking-widest border-b border-slate-100 pb-2 flex items-center gap-2">
                                        <span>👤</span> Basic Information
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                        <div className="md:col-span-3 space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Contact Name *</label>
                                            <input
                                                type="text"
                                                name="contactName"
                                                value={formData.contactName}
                                                onChange={onChange}
                                                className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all"
                                                placeholder="Enter full contact name"
                                                required
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Gender</label>
                                            <select
                                                name="gender"
                                                value={formData.gender || ''}
                                                onChange={onChange}
                                                className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all"
                                            >
                                                <option value="">Select Gender</option>
                                                <option value="Male">Male</option>
                                                <option value="Female">Female</option>
                                                <option value="Other">Other</option>
                                            </select>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Date of Birth (DOB)</label>
                                            <input
                                                type="date"
                                                name="dob"
                                                value={formData.dob ? formData.dob.split('T')[0] : ''}
                                                onChange={onChange}
                                                className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Anniversary Date</label>
                                            <input
                                                type="date"
                                                name="anniversaryDate"
                                                value={formData.anniversaryDate ? formData.anniversaryDate.split('T')[0] : ''}
                                                onChange={onChange}
                                                className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Blood Group</label>
                                            <input
                                                type="text"
                                                name="bloodGroup"
                                                value={formData.bloodGroup}
                                                onChange={onChange}
                                                className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none"
                                                placeholder="e.g. O+, A+, B+"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Marital Status</label>
                                            <select
                                                name="maritalStatus"
                                                value={formData.maritalStatus || ''}
                                                onChange={onChange}
                                                className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all"
                                            >
                                                <option value="">Select Status</option>
                                                <option value="Single">Single</option>
                                                <option value="Married">Married</option>
                                                <option value="Divorced">Divorced</option>
                                                <option value="Widowed">Widowed</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                {/* SECTION 2: COMPANY INFORMATION */}
                                <div className="space-y-4">
                                    <h3 className="font-outfit font-black text-sm text-primary-600 uppercase tracking-widest border-b border-slate-100 pb-2 flex items-center gap-2">
                                        <span>🏢</span> Company Information
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Company Name</label>
                                            <SearchableSelect
                                                options={customerOptions}
                                                value={formData.company}
                                                onChange={(val) => setFormData(prev => ({ ...prev, company: val }))}
                                                placeholder="Search & Select Company..."
                                                onAddOption={handleAddCompany}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Department</label>
                                            <input
                                                type="text"
                                                name="department"
                                                value={formData.department}
                                                onChange={onChange}
                                                className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none"
                                                placeholder="e.g. Purchase, Sales, IT"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <div className="flex justify-between items-center mb-1">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Designation</label>
                                                <button 
                                                    type="button" 
                                                    onClick={() => handleOpenMiniMaster('designation')}
                                                    className="text-[10px] font-black uppercase text-primary-600 hover:text-primary-700 tracking-wider flex items-center gap-0.5"
                                                >
                                                    + Quick Add
                                                </button>
                                            </div>
                                            <select
                                                name="designation"
                                                value={formData.designation}
                                                onChange={onChange}
                                                className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all"
                                            >
                                                <option value="">Select Designation</option>
                                                {designations.map(d => (
                                                    <option key={d._id} value={d.name}>{d.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Industry</label>
                                            <input
                                                type="text"
                                                name="industry"
                                                value={formData.industry}
                                                onChange={onChange}
                                                className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none"
                                                placeholder="e.g. Manufacturing, Retail"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">GST Number</label>
                                            <input
                                                type="text"
                                                name="gstin"
                                                value={formData.gstin}
                                                onChange={onChange}
                                                className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none uppercase font-mono"
                                                placeholder="27AAAAA0000A1Z5"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Website</label>
                                            <input
                                                type="url"
                                                name="website"
                                                value={formData.website}
                                                onChange={onChange}
                                                className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none"
                                                placeholder="https://company.com"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* SECTION 3: COMMUNICATION */}
                                <div className="space-y-4">
                                    <h3 className="font-outfit font-black text-sm text-primary-600 uppercase tracking-widest border-b border-slate-100 pb-2 flex items-center gap-2">
                                        <span>📞</span> Communication Details
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Primary Mobile</label>
                                            <input
                                                type="text"
                                                name="phone"
                                                value={formData.phone}
                                                onChange={onChange}
                                                className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none"
                                                placeholder="+91 9876543210"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Alternate Mobile</label>
                                            <input
                                                type="text"
                                                name="alternatePhone"
                                                value={formData.alternatePhone}
                                                onChange={onChange}
                                                className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none"
                                                placeholder="Alternate mobile"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">WhatsApp Number</label>
                                            <input
                                                type="text"
                                                name="whatsappNumber"
                                                value={formData.whatsappNumber}
                                                onChange={onChange}
                                                className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none"
                                                placeholder="WhatsApp number"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Email</label>
                                            <input
                                                type="email"
                                                name="email"
                                                value={formData.email}
                                                onChange={onChange}
                                                className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none"
                                                placeholder="contact@company.com"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Alternate Email</label>
                                            <input
                                                type="email"
                                                name="alternateEmail"
                                                value={formData.alternateEmail}
                                                onChange={onChange}
                                                className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none"
                                                placeholder="alternate@company.com"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Office Phone</label>
                                            <input
                                                type="text"
                                                name="officePhone"
                                                value={formData.officePhone}
                                                onChange={onChange}
                                                className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none"
                                                placeholder="020-12345678"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* SECTION 4: ADDRESS INFORMATION */}
                                <div className="space-y-4">
                                    <h3 className="font-outfit font-black text-sm text-primary-600 uppercase tracking-widest border-b border-slate-100 pb-2 flex items-center gap-2">
                                        <span>📍</span> Address Information
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Country</label>
                                            <input
                                                type="text"
                                                name="country"
                                                value={formData.country}
                                                onChange={onChange}
                                                className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none"
                                                placeholder="India"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">State</label>
                                            <input
                                                type="text"
                                                name="state"
                                                value={formData.state}
                                                onChange={onChange}
                                                className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none"
                                                placeholder="Maharashtra"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">City</label>
                                            <input
                                                type="text"
                                                name="city"
                                                value={formData.city}
                                                onChange={onChange}
                                                className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none"
                                                placeholder="Pune"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">PIN Code</label>
                                            <input
                                                type="text"
                                                name="pincode"
                                                value={formData.pincode}
                                                onChange={onChange}
                                                className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none"
                                                placeholder="411001"
                                            />
                                        </div>
                                        <div className="md:col-span-2 space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Address Line 1</label>
                                            <input
                                                type="text"
                                                name="addressLine1"
                                                value={formData.addressLine1}
                                                onChange={onChange}
                                                className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none"
                                                placeholder="Building, Street, Landmark"
                                            />
                                        </div>
                                        <div className="md:col-span-2 space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Address Line 2</label>
                                            <input
                                                type="text"
                                                name="addressLine2"
                                                value={formData.addressLine2}
                                                onChange={onChange}
                                                className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none"
                                                placeholder="Area, Locality"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* SECTION 5: CLASSIFICATION & NOTES */}
                                <div className="space-y-4">
                                    <h3 className="font-outfit font-black text-sm text-primary-600 uppercase tracking-widest border-b border-slate-100 pb-2 flex items-center gap-2">
                                        <span>📝</span> Classification & Notes
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Customer Type</label>
                                            <select
                                                name="customerType"
                                                value={formData.customerType}
                                                onChange={onChange}
                                                className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all"
                                            >
                                                <option value="">Select Type</option>
                                                {CUSTOMER_TYPES.map((t) => (
                                                    <option key={t} value={t}>{t}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Last Interaction Date</label>
                                            <input
                                                type="date"
                                                name="lastInteractionDate"
                                                value={formData.lastInteractionDate ? formData.lastInteractionDate.split('T')[0] : ''}
                                                onChange={onChange}
                                                className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Remarks / Notes</label>
                                        <textarea
                                            name="notes"
                                            value={formData.notes}
                                            onChange={onChange}
                                            className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none min-h-24"
                                            placeholder="Enter any notes, background context, or remarks..."
                                        />
                                    </div>
                                </div>
                            </form>
                        </div>
                </div>
            )}
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
                            if (activeMiniMaster === 'designation') itemsList = designations;

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
                                                    </div>
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

            {/* Import Modal */}
            <ImportModal
                isOpen={isImportModalOpen}
                onClose={() => setIsImportModalOpen(false)}
                title="Import Contacts"
                type="contacts"
                onImport={async (file) => {
                    const result = await importService.importContacts(file);
                    fetchContacts(); // Refresh contacts after import
                    return result;
                }}
                onDownloadTemplate={importService.getContactTemplate}
            />
        </div>
    );
};

export default Contacts;
