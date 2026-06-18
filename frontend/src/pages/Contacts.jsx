import React, { useEffect, useMemo, useState } from 'react';
import { MdAdd, MdDelete, MdEdit, MdSearch, MdContactPhone, MdFileDownload } from 'react-icons/md';
import { toast } from 'react-toastify';
import * as XLSX from 'xlsx';
import Modal from '../components/Modal';
import PaginationControls from '../components/PaginationControls';
import { contactService } from '../services/api';

const LIST_PAGE_SIZE = 20;

const CUSTOMER_TYPES = ['Customer', 'Prospect', 'Vendor', 'Partner'];

const defaultForm = {
    contactName: '',
    company: '',
    email: '',
    phone: '',
    designation: '',
    customerType: '',
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

const Contacts = () => {
    const [contacts, setContacts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [filterType, setFilterType] = useState('');
    const [page, setPage] = useState(1);
    const [pagination, setPagination] = useState({ page: 1, limit: LIST_PAGE_SIZE, total: 0, pages: 1 });
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingContact, setEditingContact] = useState(null);
    const [formData, setFormData] = useState(defaultForm);

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

    const openModal = (contact = null) => {
        setEditingContact(contact);
        setFormData(contact ? {
            contactName: contact.contactName || '',
            company: contact.company || '',
            email: contact.email || '',
            phone: contact.phone || '',
            designation: contact.designation || '',
            customerType: contact.customerType || '',
            lastInteractionDate: contact.lastInteractionDate ? contact.lastInteractionDate.substring(0, 10) : '',
            notes: contact.notes || ''
        } : defaultForm);
        setIsModalOpen(true);
    };

    const onChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const onSubmit = async (e) => {
        e.preventDefault();
        if (!formData.contactName?.trim()) {
            toast.error('Contact Name is required');
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
                                                <div className="font-black text-slate-900 text-sm">{contact.contactName}</div>
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

            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={editingContact ? 'Edit Contact' : 'Create Contact'}
                maxWidth="max-w-2xl"
                footer={(
                    <>
                        <button
                            onClick={() => setIsModalOpen(false)}
                            className="px-6 py-2.5 text-slate-500 font-black hover:text-slate-900 transition-all uppercase text-[10px] tracking-widest"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={onSubmit}
                            className="bg-primary-600 hover:bg-primary-700 text-white px-10 py-3.5 rounded-2xl font-black transition-all shadow-xl shadow-primary-600/20 uppercase text-[10px] tracking-widest active:scale-95"
                        >
                            {editingContact ? 'Update Contact' : 'Save Contact'}
                        </button>
                    </>
                )}
            >
                <form onSubmit={onSubmit} className="space-y-5">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Contact Name *</label>
                        <input
                            type="text"
                            name="contactName"
                            value={formData.contactName}
                            onChange={onChange}
                            className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all"
                            placeholder="Enter contact name"
                            required
                        />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Company Name</label>
                            <input
                                type="text"
                                name="company"
                                value={formData.company}
                                onChange={onChange}
                                className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none"
                                placeholder="Company name"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Designation</label>
                            <input
                                type="text"
                                name="designation"
                                value={formData.designation}
                                onChange={onChange}
                                className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none"
                                placeholder="e.g. Manager, Director"
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Phone Number</label>
                            <input
                                type="text"
                                name="phone"
                                value={formData.phone}
                                onChange={onChange}
                                className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none"
                                placeholder="+91"
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                                value={formData.lastInteractionDate}
                                onChange={onChange}
                                className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none"
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Notes</label>
                        <textarea
                            name="notes"
                            value={formData.notes}
                            onChange={onChange}
                            className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none min-h-24"
                            placeholder="Any notes or remarks"
                        />
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default Contacts;
