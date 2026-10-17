import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { typeTestService, productService, userService, uploadService } from '../services/api';
import { formatDate, formatDateTime, resolveImageUrl } from '../utils/helpers';
import {
    MdFactCheck, MdAdd, MdEdit, MdDelete, MdSearch, MdClose, MdInfo, MdDownload,
    MdCloudUpload, MdPictureAsPdf, MdAutorenew, MdNotes, MdBlock, MdRestore, MdNotificationsActive
} from 'react-icons/md';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';
import DateInput from '../components/DateInput';
import * as XLSX from 'xlsx';

const STATUS_CLASSES = {
    'Not Started': 'bg-slate-50 text-slate-600 border-slate-200',
    'In Progress': 'bg-blue-50 text-blue-700 border-blue-100',
    'Valid': 'bg-emerald-50 text-emerald-700 border-emerald-100',
    'Expired': 'bg-rose-50 text-rose-700 border-rose-100',
    'Renewal In Progress': 'bg-amber-50 text-amber-700 border-amber-100'
};

const RENEWAL_STATUSES = ['Not Due', 'Due', 'Initiated', 'Testing Scheduled', 'Testing In Progress', 'Awaiting Certificate', 'Completed'];
const LEAD_DAY_PRESETS = [180, 90, 60, 30, 15, 7];

const INPUT = 'w-full px-3 py-2 bg-slate-50 border border-slate-200 text-sm text-slate-700 font-semibold rounded-xl focus:outline-none focus:border-teal-500';
const FILTER = 'px-3 py-2 bg-slate-50 border border-slate-200 text-sm text-slate-700 font-semibold rounded-xl focus:outline-none focus:border-teal-500';
const LABEL = 'block text-xs font-bold text-slate-500 mb-1 uppercase';

const toInputDate = (d) => (d ? new Date(d).toISOString().split('T')[0] : '');
const productText = (p) => (p ? `${p.productName || ''}${p.productCode ? ` (${p.productCode})` : ''}` : '-');

const EMPTY_FORM = {
    productId: '', productLabel: '', modelName: '', testName: 'Type Test', testStandard: '', testingAgency: '',
    ownerId: '', backupOwnerId: '', reminderLeadDays: [180, 90, 30], status: 'Not Started',
    nextAction: '', nextActionDate: '', remarks: '',
    certificateNo: '', documentUrl: '', testCompletionDate: '', validUntil: ''
};

const EMPTY_CERT = { certificateNo: '', testingAgency: '', testCompletionDate: '', validUntil: '', documentUrl: '', remarks: '' };
const EMPTY_PROGRESS = { renewalStatus: '', nextAction: '', nextActionDate: '', note: '' };

const ExpiryBadge = ({ record }) => {
    const days = record.daysToExpiry;
    if (days === null || days === undefined) return <span className="text-slate-400">-</span>;
    let cls = 'bg-emerald-50 text-emerald-700 border-emerald-100';
    let text = `${days} days left`;
    if (days < 0) { cls = 'bg-rose-50 text-rose-700 border-rose-100'; text = `Expired ${Math.abs(days)}d ago`; }
    else if (days <= 30) cls = 'bg-rose-50 text-rose-700 border-rose-100';
    else if (days <= 90) cls = 'bg-orange-50 text-orange-700 border-orange-100';
    else if (days <= 180) cls = 'bg-amber-50 text-amber-700 border-amber-100';
    return <span className={`inline-flex px-2 py-0.5 rounded-full border text-[11px] font-bold whitespace-nowrap ${cls}`}>{text}</span>;
};

const DocumentLink = ({ url, label = 'View' }) => {
    if (!url) return null;
    return (
        <a
            href={resolveImageUrl(url)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-[10px] font-black uppercase rounded border border-rose-200"
        >
            <MdPictureAsPdf size={12} /> {label}
        </a>
    );
};

// Server-side product search, since the catalog is too large for a plain dropdown.
// The parent owns the text (label) so it can prefill it when editing.
const ProductPicker = ({ label, onChange }) => {
    const query = label || '';
    const [results, setResults] = useState([]);
    const [open, setOpen] = useState(false);
    const boxRef = useRef(null);

    useEffect(() => {
        if (!open) return undefined;
        const timer = setTimeout(async () => {
            try {
                const res = await productService.getAll({ search: query, limit: 20, page: 1 });
                setResults(res.data?.data || res.data || []);
            } catch (err) {
                console.error('Product search failed:', err);
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [query, open]);

    useEffect(() => {
        const close = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', close);
        return () => document.removeEventListener('mousedown', close);
    }, []);

    return (
        <div className="relative" ref={boxRef}>
            <input
                type="text"
                value={query}
                onFocus={() => setOpen(true)}
                onChange={e => { setOpen(true); onChange('', e.target.value); }}
                placeholder="Search product by name or code"
                className={INPUT}
            />
            {open && (
                <div className="absolute z-50 mt-1 w-full max-h-60 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-lg">
                    {results.length === 0 ? (
                        <div className="px-3 py-2 text-xs font-semibold text-slate-400">No products found</div>
                    ) : results.map(p => (
                        <button
                            type="button"
                            key={p._id}
                            onClick={() => { onChange(p._id, productText(p)); setOpen(false); }}
                            className="block w-full text-left px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-teal-50"
                        >
                            {productText(p)}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

const LeadDaysInput = ({ value, onChange }) => {
    const [custom, setCustom] = useState('');
    const toggle = (d) => {
        const next = value.includes(d) ? value.filter(v => v !== d) : [...value, d];
        onChange(next.sort((a, b) => b - a));
    };
    const addCustom = () => {
        const d = Math.round(Number(custom));
        if (d > 0 && !value.includes(d)) onChange([...value, d].sort((a, b) => b - a));
        setCustom('');
    };
    const options = [...new Set([...LEAD_DAY_PRESETS, ...value])].sort((a, b) => b - a);
    return (
        <div className="flex flex-wrap items-center gap-2">
            {options.map(d => (
                <button
                    type="button"
                    key={d}
                    onClick={() => toggle(d)}
                    className={`px-2.5 py-1 rounded-lg border text-xs font-bold transition ${value.includes(d) ? 'bg-teal-600 border-teal-600 text-white' : 'bg-white border-slate-200 text-slate-500 hover:border-teal-400'}`}
                >
                    {d} days
                </button>
            ))}
            <input
                type="number"
                min="1"
                value={custom}
                onChange={e => setCustom(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustom(); } }}
                placeholder="Other"
                className="w-20 px-2 py-1 bg-slate-50 border border-slate-200 text-xs font-semibold rounded-lg focus:outline-none focus:border-teal-500"
            />
        </div>
    );
};

const PdfUploadField = ({ value, onChange }) => {
    const [uploading, setUploading] = useState(false);
    const handleFile = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 10 * 1024 * 1024) {
            toast.error('Certificate PDF must be 10 MB or smaller.');
            e.target.value = '';
            return;
        }
        setUploading(true);
        try {
            const res = await uploadService.uploadPdf(file);
            const url = res.data?.url || res.data?.fileUrl || res.data?.imageUrl;
            if (!url) throw new Error('Upload did not return a file URL');
            onChange(url);
            toast.success('Certificate uploaded.');
        } catch (err) {
            console.error('Certificate upload failed:', err);
            toast.error(err.response?.data?.message || 'Failed to upload certificate.');
        } finally {
            setUploading(false);
            e.target.value = '';
        }
    };
    return (
        <div className="flex items-center gap-3 flex-wrap">
            <label className={`inline-flex items-center gap-1.5 px-3 py-2 border border-dashed border-teal-300 bg-teal-50 text-teal-700 text-xs font-bold rounded-xl cursor-pointer hover:bg-teal-100 ${uploading ? 'opacity-60 pointer-events-none' : ''}`}>
                <MdCloudUpload size={16} />
                {uploading ? 'Uploading...' : value ? 'Replace PDF' : 'Upload Certificate PDF'}
                <input type="file" accept="application/pdf,.pdf" className="hidden" onChange={handleFile} />
            </label>
            {value && (
                <>
                    <DocumentLink url={value} label="Uploaded" />
                    <button type="button" onClick={() => onChange('')} className="text-xs font-bold text-rose-500 hover:text-rose-700">Remove</button>
                </>
            )}
        </div>
    );
};

const TypeTestRegister = () => {
    const { user: currentUser } = useAuth();
    const [searchParams, setSearchParams] = useSearchParams();

    const [records, setRecords] = useState([]);
    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(true);
    const [users, setUsers] = useState([]);

    // Filters
    const [search, setSearch] = useState('');
    const [status, setStatus] = useState('');
    const [ownerId, setOwnerId] = useState('');
    const [active, setActive] = useState('true');
    const [expiringWithin, setExpiringWithin] = useState('');

    // Create / edit
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [formData, setFormData] = useState(EMPTY_FORM);
    const [submitting, setSubmitting] = useState(false);

    // Detail and workflow modals
    const [selected, setSelected] = useState(null);
    const [certModal, setCertModal] = useState(false);
    const [certData, setCertData] = useState(EMPTY_CERT);
    const [progressModal, setProgressModal] = useState(false);
    const [progressData, setProgressData] = useState(EMPTY_PROGRESS);

    const setField = (field, value) => setFormData(prev => ({ ...prev, [field]: value }));

    const loadUsers = async () => {
        try {
            const res = await userService.getAll({ limit: 1000 });
            setUsers(res.data?.data || res.data?.docs || res.data || []);
        } catch (err) {
            console.error('Failed to load users:', err);
        }
    };

    const loadSummary = async () => {
        try {
            const res = await typeTestService.getSummary();
            setSummary(res.data);
        } catch (err) {
            console.error('Failed to load type test summary:', err);
        }
    };

    const loadRecords = async (showSpinner = true) => {
        if (showSpinner) setLoading(true);
        try {
            const res = await typeTestService.getAll({
                search: search || undefined,
                status: status || undefined,
                ownerId: ownerId || undefined,
                active: active || undefined,
                expiringWithin: expiringWithin || undefined
            });
            setRecords(res.data || []);
        } catch (err) {
            console.error('Failed to fetch type tests:', err);
            toast.error('Failed to load type test register.');
        } finally {
            if (showSpinner) setLoading(false);
        }
    };

    const refresh = () => { loadRecords(false); loadSummary(); };

    const openDetail = async (id) => {
        try {
            const res = await typeTestService.getById(id);
            setSelected(res.data);
        } catch (err) {
            console.error('Failed to load type test:', err);
            toast.error('Failed to load type test details.');
        }
    };

    // Keep the open detail view and the list in step after a workflow action.
    const afterAction = (record, message) => {
        toast.success(message);
        if (selected && record?._id === selected._id) openDetail(record._id);
        refresh();
    };

    useEffect(() => { loadUsers(); loadSummary(); }, []);

    useEffect(() => {
        const timer = setTimeout(() => loadRecords(true), search ? 300 : 0);
        return () => clearTimeout(timer);
    }, [search, status, ownerId, active, expiringWithin]);

    // Notification links open a record directly: /type-tests?open=<id>
    useEffect(() => {
        const openId = searchParams.get('open');
        if (openId) {
            openDetail(openId);
            setSearchParams({}, { replace: true });
        }
    }, [searchParams]);

    const applyQuickFilter = (next) => {
        setStatus(next.status || '');
        setExpiringWithin(next.expiringWithin || '');
        setActive(next.active ?? 'true');
    };

    const clearFilters = () => {
        setSearch('');
        setStatus('');
        setOwnerId('');
        setActive('true');
        setExpiringWithin('');
    };

    const openCreate = () => {
        setEditingId(null);
        setFormData({ ...EMPTY_FORM, ownerId: currentUser?.id || '' });
        setShowForm(true);
    };

    const openEdit = (r) => {
        setEditingId(r._id);
        setFormData({
            ...EMPTY_FORM,
            productId: r.productId?._id || r.productId || '',
            productLabel: productText(r.productId),
            modelName: r.modelName || '',
            testName: r.testName || '',
            testStandard: r.testStandard || '',
            testingAgency: r.testingAgency || '',
            ownerId: r.ownerId?._id || r.ownerId || '',
            backupOwnerId: r.backupOwnerId?._id || r.backupOwnerId || '',
            reminderLeadDays: r.reminderLeadDays?.length ? r.reminderLeadDays : [180, 90, 30],
            status: r.status,
            nextAction: r.nextAction || '',
            nextActionDate: toInputDate(r.nextActionDate),
            remarks: r.remarks || ''
        });
        setShowForm(true);
    };

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        if (!formData.productId) return toast.warning('Select a product.');
        if (!formData.ownerId) return toast.warning('Select the owner responsible for renewal.');
        if (formData.backupOwnerId && formData.backupOwnerId === formData.ownerId) {
            return toast.warning('Backup owner must be different from the owner.');
        }
        if (!editingId && (formData.certificateNo || formData.validUntil)
            && !(formData.certificateNo && formData.testCompletionDate && formData.validUntil)) {
            return toast.warning('To record a certificate now, fill certificate number, completion date and valid until date.');
        }

        const { productLabel: _productLabel, ...payload } = formData;
        setSubmitting(true);
        try {
            if (editingId) {
                const res = await typeTestService.update(editingId, payload);
                afterAction(res.data, 'Type test record updated.');
            } else {
                await typeTestService.create(payload);
                toast.success('Type test record created.');
                refresh();
            }
            setShowForm(false);
        } catch (err) {
            console.error('Save type test error:', err);
            toast.error(err.response?.data?.message || 'Error saving type test record.');
        } finally {
            setSubmitting(false);
        }
    };

    const openCertificate = () => {
        setCertData({ ...EMPTY_CERT, testingAgency: selected?.testingAgency || '' });
        setCertModal(true);
    };

    const submitCertificate = async (e) => {
        e.preventDefault();
        if (!certData.certificateNo || !certData.testCompletionDate || !certData.validUntil) {
            return toast.warning('Certificate number, completion date and valid until date are required.');
        }
        if (!certData.documentUrl && !window.confirm('No certificate PDF uploaded. Save without the document?')) return;
        setSubmitting(true);
        try {
            const res = await typeTestService.recordCertificate(selected._id, certData);
            setCertModal(false);
            afterAction(res.data, 'Certificate recorded. Reminder dates recalculated.');
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to record certificate.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleStartRenewal = async () => {
        const note = window.prompt('Renewal note (optional), e.g. "Requested quotation from testing agency":', '');
        if (note === null) return;
        try {
            const res = await typeTestService.startRenewal(selected._id, { note });
            afterAction(res.data, selected.currentCertificate?.validUntil ? 'Renewal started.' : 'Testing started.');
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to start renewal.');
        }
    };

    const openProgress = () => {
        setProgressData({
            renewalStatus: selected?.renewalStatus || '',
            nextAction: selected?.nextAction || '',
            nextActionDate: toInputDate(selected?.nextActionDate),
            note: ''
        });
        setProgressModal(true);
    };

    const submitProgress = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const res = await typeTestService.recordProgress(selected._id, progressData);
            setProgressModal(false);
            afterAction(res.data, 'Progress recorded.');
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to record progress.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleToggleActive = async () => {
        const deactivate = selected.isActive;
        const reason = window.prompt(
            deactivate ? 'Reason for marking inactive (e.g. product discontinued):' : 'Reason for reactivating (optional):',
            deactivate ? 'Product discontinued' : ''
        );
        if (reason === null) return;
        try {
            const res = await typeTestService.setActive(selected._id, !deactivate, reason);
            afterAction(res.data, deactivate ? 'Marked inactive. Reminders stopped.' : 'Record reactivated.');
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to update record.');
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Delete this type test record and its certificate history? This cannot be undone.')) return;
        try {
            await typeTestService.delete(id);
            toast.success('Type test record deleted.');
            if (selected?._id === id) setSelected(null);
            refresh();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to delete record.');
        }
    };

    const handleExport = () => {
        if (records.length === 0) return toast.warning('No records to export.');
        const rows = records.map((r, i) => ({
            'Sr. No.': i + 1,
            'Product Code': r.productId?.productCode || '-',
            'Product': r.productId?.productName || '-',
            'Model': r.modelName || '-',
            'Test': r.testName || '-',
            'Standard': r.testStandard || '-',
            'Testing Agency': r.currentCertificate?.testingAgency || r.testingAgency || '-',
            'Status': r.status,
            'Certificate No': r.currentCertificate?.certificateNo || '-',
            'Test Completion Date': formatDate(r.currentCertificate?.testCompletionDate),
            'Valid Until': formatDate(r.currentCertificate?.validUntil),
            'Days To Expiry': r.daysToExpiry ?? '-',
            'Owner': r.ownerId?.name || '-',
            'Backup Owner': r.backupOwnerId?.name || '-',
            'Renewal Lead Days': (r.reminderLeadDays || []).join(' / '),
            'Next Reminder': formatDate(r.nextReminderOn),
            'Renewal Status': r.renewalStatus,
            'Next Action': r.nextAction || '-',
            'Next Action Date': formatDate(r.nextActionDate),
            'Active': r.isActive ? 'Yes' : 'No'
        }));
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Type Tests');
        XLSX.writeFile(wb, `Type_Test_Register_${new Date().toISOString().slice(0, 10)}.xlsx`);
    };

    const kpis = summary ? [
        { label: 'Valid', value: summary.byStatus?.Valid || 0, cls: 'text-emerald-600', filter: { status: 'Valid' } },
        { label: 'Expiring ≤ 30d', value: summary.expiringIn30, cls: 'text-rose-600', filter: { expiringWithin: '30' } },
        { label: 'Expiring ≤ 90d', value: summary.expiringIn90, cls: 'text-orange-600', filter: { expiringWithin: '90' } },
        { label: 'Expiring ≤ 180d', value: summary.expiringIn180, cls: 'text-amber-600', filter: { expiringWithin: '180' } },
        { label: 'Expired', value: summary.byStatus?.Expired || 0, cls: 'text-rose-700', filter: { status: 'Expired' } },
        { label: 'Renewal In Progress', value: summary.byStatus?.['Renewal In Progress'] || 0, cls: 'text-amber-700', filter: { status: 'Renewal In Progress' } },
        { label: 'Not Started', value: (summary.byStatus?.['Not Started'] || 0) + (summary.byStatus?.['In Progress'] || 0), cls: 'text-slate-700', filter: { status: 'Not Started' }, hint: `${summary.byStatus?.['In Progress'] || 0} in progress` },
        { label: 'Inactive', value: summary.inactive, cls: 'text-slate-400', filter: { active: 'false' } }
    ] : [];

    const hasFilters = search || status || ownerId || active !== 'true' || expiringWithin;
    const cert = selected?.currentCertificate;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-teal-500 to-teal-700 flex items-center justify-center text-white shadow-md">
                        <MdFactCheck size={24} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Type Test Register</h1>
                        <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Certificates, Validity &amp; Renewal Tracking</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <button onClick={handleExport} className="flex items-center gap-1.5 px-4 py-2.5 bg-teal-50 hover:bg-teal-100 border border-teal-200 text-teal-700 text-sm font-black rounded-xl transition-all">
                        <MdDownload size={18} /> Export
                    </button>
                    <button onClick={openCreate} className="flex items-center gap-1.5 px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white text-sm font-black rounded-xl shadow-lg transition-all">
                        <MdAdd size={20} /> New Type Test
                    </button>
                </div>
            </div>

            {/* KPI cards double as quick filters */}
            {summary && (
                <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-3">
                    {kpis.map(k => (
                        <button
                            key={k.label}
                            onClick={() => applyQuickFilter(k.filter)}
                            className="text-left bg-white rounded-2xl border border-slate-100 p-4 shadow-sm hover:border-teal-300 hover:shadow transition"
                        >
                            <span className="block text-[10px] font-bold text-slate-400 uppercase">{k.label}</span>
                            <span className={`block text-2xl font-black ${k.cls}`}>{k.value}</span>
                            {k.hint && <span className="block text-[10px] font-semibold text-slate-400">{k.hint}</span>}
                        </button>
                    ))}
                </div>
            )}

            {/* Filters */}
            <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
                <div className="flex flex-wrap gap-4 items-center">
                    <div className="flex-1 min-w-[200px] relative">
                        <input
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Search product, model, certificate no, agency..."
                            className={`${FILTER} w-full pl-10`}
                        />
                        <MdSearch size={20} className="absolute left-3.5 top-2.5 text-slate-400" />
                    </div>
                    <select value={status} onChange={e => setStatus(e.target.value)} className={FILTER}>
                        <option value="">All Statuses</option>
                        {Object.keys(STATUS_CLASSES).map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <select value={expiringWithin} onChange={e => setExpiringWithin(e.target.value)} className={FILTER}>
                        <option value="">Any Validity</option>
                        <option value="30">Expiring in 30 days</option>
                        <option value="90">Expiring in 90 days</option>
                        <option value="180">Expiring in 180 days</option>
                    </select>
                    <select value={ownerId} onChange={e => setOwnerId(e.target.value)} className={FILTER}>
                        <option value="">All Owners</option>
                        {users.map(u => <option key={u._id} value={u._id}>{u.name}</option>)}
                    </select>
                    <select value={active} onChange={e => setActive(e.target.value)} className={FILTER}>
                        <option value="true">Active Only</option>
                        <option value="false">Inactive Only</option>
                        <option value="">Active &amp; Inactive</option>
                    </select>
                    {hasFilters && (
                        <button onClick={clearFilters} className="flex items-center gap-1 text-xs font-bold text-rose-500 hover:text-rose-700 px-2">
                            <MdClose size={16} /> Clear Filters
                        </button>
                    )}
                </div>
            </div>

            {/* Register table */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 space-y-3">
                        <div className="w-12 h-12 border-4 border-teal-200 border-t-teal-600 rounded-full animate-spin"></div>
                        <p className="text-slate-400 font-bold uppercase text-[10px] tracking-wider animate-pulse">Loading Register...</p>
                    </div>
                ) : records.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50/50 border-b border-slate-100 text-xs font-bold text-slate-400 uppercase">
                                    <th className="py-3.5 px-4">Product / Model</th>
                                    <th className="py-3.5 px-4">Status</th>
                                    <th className="py-3.5 px-4">Certificate</th>
                                    <th className="py-3.5 px-4">Tested On</th>
                                    <th className="py-3.5 px-4">Valid Until</th>
                                    <th className="py-3.5 px-4">Owner</th>
                                    <th className="py-3.5 px-4">Renewal / Next Action</th>
                                    <th className="py-3.5 px-4 text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 text-sm font-semibold text-slate-600">
                                {records.map(r => (
                                    <tr key={r._id} className={`hover:bg-slate-50/40 transition ${r.isActive ? '' : 'opacity-60'}`}>
                                        <td className="py-3 px-4">
                                            <div className="text-slate-900 font-bold">{r.productId?.productName || '-'}</div>
                                            <div className="text-xs text-slate-400">
                                                {r.productId?.productCode}{r.modelName ? ` · ${r.modelName}` : ''}{r.testStandard ? ` · ${r.testStandard}` : ''}
                                            </div>
                                        </td>
                                        <td className="py-3 px-4">
                                            <span className={`inline-flex px-2 py-0.5 rounded-full border text-xs font-bold whitespace-nowrap ${STATUS_CLASSES[r.status]}`}>{r.status}</span>
                                            {!r.isActive && <div className="text-[10px] font-bold text-slate-400 uppercase mt-1">Inactive</div>}
                                        </td>
                                        <td className="py-3 px-4">
                                            <div className="flex items-center gap-2">
                                                <span className="text-teal-700 font-bold">{r.currentCertificate?.certificateNo || '-'}</span>
                                                <DocumentLink url={r.currentCertificate?.documentUrl} label="PDF" />
                                            </div>
                                        </td>
                                        <td className="py-3 px-4 whitespace-nowrap">{formatDate(r.currentCertificate?.testCompletionDate)}</td>
                                        <td className="py-3 px-4">
                                            <div className="whitespace-nowrap">{formatDate(r.currentCertificate?.validUntil)}</div>
                                            {r.isActive && <ExpiryBadge record={r} />}
                                        </td>
                                        <td className="py-3 px-4">
                                            <div>{r.ownerId?.name || '-'}</div>
                                            {r.backupOwnerId && <div className="text-xs text-slate-400">Backup: {r.backupOwnerId.name}</div>}
                                        </td>
                                        <td className="py-3 px-4 max-w-[220px]">
                                            <div className="text-xs font-bold text-slate-700">{r.renewalStatus}</div>
                                            {r.nextAction && <div className="text-xs text-slate-500 truncate" title={r.nextAction}>{r.nextAction}{r.nextActionDate ? ` (${formatDate(r.nextActionDate)})` : ''}</div>}
                                        </td>
                                        <td className="py-3 px-4">
                                            <div className="flex items-center justify-center gap-2">
                                                <button onClick={() => openDetail(r._id)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500" title="View / Manage">
                                                    <MdInfo size={18} />
                                                </button>
                                                <button onClick={() => openEdit(r)} className="p-1.5 rounded-lg hover:bg-teal-50 text-teal-600" title="Edit">
                                                    <MdEdit size={18} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="py-20 text-center text-slate-400 font-bold text-sm">No type test records found.</div>
                )}
            </div>

            {/* Create / Edit */}
            <Modal
                isOpen={showForm}
                onClose={() => setShowForm(false)}
                title={editingId ? 'Edit Type Test' : 'New Type Test Record'}
                footer={
                    <>
                        <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 border border-slate-200 text-slate-500 text-sm font-bold rounded-xl hover:bg-slate-50">Cancel</button>
                        <button type="submit" form="type-test-form" disabled={submitting} className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 disabled:bg-teal-400 text-white text-sm font-black rounded-xl shadow-md">
                            {submitting ? 'Saving...' : 'Save'}
                        </button>
                    </>
                }
            >
                <form id="type-test-form" onSubmit={handleFormSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-2">
                            <label className={LABEL}>Product <span className="text-rose-500">*</span></label>
                            <ProductPicker
                                label={formData.productLabel}
                                onChange={(id, label) => setFormData(prev => ({ ...prev, productId: id, productLabel: label }))}
                            />
                        </div>
                        <div>
                            <label className={LABEL}>Model / Variant</label>
                            <input type="text" value={formData.modelName} onChange={e => setField('modelName', e.target.value)} placeholder="Leave blank if the whole product" className={INPUT} />
                        </div>
                        <div>
                            <label className={LABEL}>Test Name</label>
                            <input type="text" value={formData.testName} onChange={e => setField('testName', e.target.value)} placeholder="e.g. Type Test, Short Circuit Test" className={INPUT} />
                        </div>
                        <div>
                            <label className={LABEL}>Test Standard</label>
                            <input type="text" value={formData.testStandard} onChange={e => setField('testStandard', e.target.value)} placeholder="e.g. IEC 61439-1" className={INPUT} />
                        </div>
                        <div>
                            <label className={LABEL}>Testing Agency</label>
                            <input type="text" value={formData.testingAgency} onChange={e => setField('testingAgency', e.target.value)} placeholder="External testing company" className={INPUT} />
                        </div>
                        <div>
                            <label className={LABEL}>Owner (Renewal) <span className="text-rose-500">*</span></label>
                            <select value={formData.ownerId} onChange={e => setField('ownerId', e.target.value)} className={INPUT}>
                                <option value="">Select Owner</option>
                                {users.map(u => <option key={u._id} value={u._id}>{u.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className={LABEL}>Backup Owner</label>
                            <select value={formData.backupOwnerId} onChange={e => setField('backupOwnerId', e.target.value)} className={INPUT}>
                                <option value="">None</option>
                                {users.map(u => <option key={u._id} value={u._id}>{u.name}</option>)}
                            </select>
                        </div>
                        <div className="md:col-span-2">
                            <label className={LABEL}>Renewal Reminder Lead Times</label>
                            <LeadDaysInput value={formData.reminderLeadDays} onChange={v => setField('reminderLeadDays', v)} />
                            <p className="text-[11px] text-slate-400 font-semibold mt-1">Owner and backup are notified this many days before the certificate expires.</p>
                        </div>
                        {editingId && (
                            <div>
                                <label className={LABEL}>Type Test Status</label>
                                <select value={formData.status} onChange={e => setField('status', e.target.value)} className={INPUT}>
                                    {Object.keys(STATUS_CLASSES).map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                        )}
                        <div>
                            <label className={LABEL}>Next Action</label>
                            <input type="text" value={formData.nextAction} onChange={e => setField('nextAction', e.target.value)} placeholder="e.g. Send samples to lab" className={INPUT} />
                        </div>
                        <div>
                            <label className={LABEL}>Next Action Date</label>
                            <DateInput type="date" value={formData.nextActionDate} onChange={e => setField('nextActionDate', e.target.value)} className={INPUT} />
                        </div>
                    </div>

                    {!editingId && (
                        <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4 space-y-3">
                            <div>
                                <h4 className="text-xs font-black text-slate-700 uppercase">Already tested? Record the certificate (optional)</h4>
                                <p className="text-[11px] text-slate-400 font-semibold">Leave blank if testing has not been done yet. You can add it later from the record.</p>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <div>
                                    <label className={LABEL}>Certificate No</label>
                                    <input type="text" value={formData.certificateNo} onChange={e => setField('certificateNo', e.target.value)} className={INPUT} />
                                </div>
                                <div>
                                    <label className={LABEL}>Test Completion Date</label>
                                    <DateInput type="date" value={formData.testCompletionDate} onChange={e => setField('testCompletionDate', e.target.value)} className={INPUT} />
                                </div>
                                <div>
                                    <label className={LABEL}>Valid Until</label>
                                    <DateInput type="date" value={formData.validUntil} onChange={e => setField('validUntil', e.target.value)} className={INPUT} />
                                </div>
                            </div>
                            <PdfUploadField value={formData.documentUrl} onChange={url => setField('documentUrl', url)} />
                        </div>
                    )}

                    <div>
                        <label className={LABEL}>Remarks</label>
                        <textarea rows="2" value={formData.remarks} onChange={e => setField('remarks', e.target.value)} className={INPUT}></textarea>
                    </div>
                </form>
            </Modal>

            {/* Detail / manage */}
            <Modal
                isOpen={!!selected}
                onClose={() => setSelected(null)}
                title={selected ? `Type Test - ${selected.productId?.productName || ''}` : ''}
                maxWidth="max-w-3xl"
                footer={selected && (
                    <div className="flex flex-wrap gap-2 w-full justify-end">
                        {selected.isActive && (
                            <>
                                <button onClick={openCertificate} className="flex items-center gap-1.5 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-bold rounded-xl">
                                    <MdCloudUpload size={18} /> {cert?.validUntil ? 'Upload Renewed Certificate' : 'Record Certificate'}
                                </button>
                                {!['Renewal In Progress', 'In Progress'].includes(selected.status) && (
                                    <button onClick={handleStartRenewal} className="flex items-center gap-1.5 px-4 py-2 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-700 text-sm font-bold rounded-xl">
                                        <MdAutorenew size={18} /> {cert?.validUntil ? 'Start Renewal' : 'Start Testing'}
                                    </button>
                                )}
                                <button onClick={openProgress} className="flex items-center gap-1.5 px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-bold rounded-xl">
                                    <MdNotes size={18} /> Record Progress
                                </button>
                            </>
                        )}
                        <button onClick={() => { const r = selected; setSelected(null); openEdit(r); }} className="flex items-center gap-1.5 px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-bold rounded-xl">
                            <MdEdit size={18} /> Edit
                        </button>
                        <button onClick={handleToggleActive} className="flex items-center gap-1.5 px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 text-sm font-bold rounded-xl">
                            {selected.isActive ? <><MdBlock size={18} /> Mark Inactive</> : <><MdRestore size={18} /> Reactivate</>}
                        </button>
                        <button onClick={() => handleDelete(selected._id)} className="flex items-center gap-1.5 px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 text-sm font-bold rounded-xl">
                            <MdDelete size={18} /> Delete
                        </button>
                    </div>
                )}
            >
                {selected && (
                    <div className="space-y-6">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                                <h3 className="text-xl font-black text-slate-900 leading-tight">{productText(selected.productId)}</h3>
                                <p className="text-sm font-semibold text-slate-500">
                                    {[selected.modelName, selected.testName, selected.testStandard, selected.testingAgency].filter(Boolean).join(' · ') || 'No model / standard specified'}
                                </p>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                                <span className={`inline-flex px-2.5 py-0.5 rounded-full border text-xs font-bold ${STATUS_CLASSES[selected.status]}`}>{selected.status}</span>
                                {selected.isActive ? <ExpiryBadge record={selected} /> : (
                                    <span className="text-[11px] font-bold text-slate-500 uppercase">Inactive{selected.inactiveReason ? ` - ${selected.inactiveReason}` : ''}</span>
                                )}
                            </div>
                        </div>

                        {/* Current certificate */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50 rounded-2xl p-4 border border-slate-100">
                            <div>
                                <span className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">Certificate No</span>
                                <span className="text-sm font-black text-slate-800">{cert?.certificateNo || 'Not recorded'}</span>
                                <div className="mt-1"><DocumentLink url={cert?.documentUrl} label="Open PDF" /></div>
                            </div>
                            <div>
                                <span className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">Test Completed</span>
                                <span className="text-sm font-black text-slate-800">{formatDate(cert?.testCompletionDate)}</span>
                            </div>
                            <div>
                                <span className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">Valid Until</span>
                                <span className="text-sm font-black text-slate-800">{formatDate(cert?.validUntil)}</span>
                            </div>
                            <div>
                                <span className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">Renewal Status</span>
                                <span className="text-sm font-black text-slate-800">{selected.renewalStatus}</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm font-semibold text-slate-700">
                            <div className="space-y-2">
                                <div className="flex justify-between py-1.5 border-b border-slate-100">
                                    <span className="text-slate-400 font-bold text-xs uppercase">Owner</span>
                                    <span>{selected.ownerId?.name || '-'}</span>
                                </div>
                                <div className="flex justify-between py-1.5 border-b border-slate-100">
                                    <span className="text-slate-400 font-bold text-xs uppercase">Backup Owner</span>
                                    <span>{selected.backupOwnerId?.name || '-'}</span>
                                </div>
                                <div className="flex justify-between py-1.5 border-b border-slate-100">
                                    <span className="text-slate-400 font-bold text-xs uppercase">Next Action</span>
                                    <span className="text-right">{selected.nextAction || '-'}{selected.nextActionDate ? ` (${formatDate(selected.nextActionDate)})` : ''}</span>
                                </div>
                            </div>
                            <div>
                                <h4 className="text-xs font-bold text-slate-400 uppercase mb-2 flex items-center gap-1">
                                    <MdNotificationsActive size={14} /> Renewal Reminders ({(selected.reminderLeadDays || []).join(' / ')} days)
                                </h4>
                                {selected.reminders?.length ? (
                                    <ul className="space-y-1">
                                        {selected.reminders.map(rem => (
                                            <li key={rem.leadDays} className="flex justify-between text-xs">
                                                <span>{rem.leadDays} days before · {formatDate(rem.remindOn)}</span>
                                                <span className={rem.sentAt ? 'text-emerald-600' : 'text-slate-400'}>
                                                    {rem.sentAt ? `Sent ${formatDate(rem.sentAt)}` : selected.isActive ? 'Scheduled' : 'Paused'}
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="text-xs text-slate-400">Reminders are scheduled once a certificate with a valid-until date is recorded.</p>
                                )}
                            </div>
                        </div>

                        {/* Certificate history */}
                        {selected.certificateHistory?.length > 0 && (
                            <div className="space-y-2">
                                <h4 className="text-xs font-bold text-slate-400 uppercase">Closed Certificates</h4>
                                <div className="overflow-x-auto border border-slate-100 rounded-xl">
                                    <table className="w-full text-xs">
                                        <thead>
                                            <tr className="bg-slate-50 text-slate-400 uppercase font-bold text-left">
                                                <th className="py-2 px-3">Certificate</th>
                                                <th className="py-2 px-3">Tested</th>
                                                <th className="py-2 px-3">Valid Until</th>
                                                <th className="py-2 px-3">Closed</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50 font-semibold text-slate-600">
                                            {[...selected.certificateHistory].reverse().map(h => (
                                                <tr key={h._id}>
                                                    <td className="py-2 px-3"><span className="mr-2">{h.certificateNo || '-'}</span><DocumentLink url={h.documentUrl} label="PDF" /></td>
                                                    <td className="py-2 px-3">{formatDate(h.testCompletionDate)}</td>
                                                    <td className="py-2 px-3">{formatDate(h.validUntil)}</td>
                                                    <td className="py-2 px-3">{formatDate(h.closedAt)}{h.closedBy?.name ? ` by ${h.closedBy.name}` : ''}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* Activity log */}
                        <div className="space-y-3">
                            <h4 className="text-xs font-bold text-slate-400 uppercase">Progress Log</h4>
                            <div className="space-y-4 pl-3 border-l-2 border-teal-100 max-h-72 overflow-y-auto">
                                {[...(selected.activities || [])].reverse().map((act, i) => (
                                    <div key={i} className="relative space-y-0.5">
                                        <div className="absolute -left-[18px] top-1.5 w-2 h-2 rounded-full bg-teal-500 border border-white"></div>
                                        <div className="flex items-center justify-between text-[11px] font-bold text-slate-400">
                                            <span>{act.userName}</span>
                                            <span>{formatDateTime(act.timestamp)}</span>
                                        </div>
                                        <p className="text-xs font-semibold text-slate-700 leading-snug">{act.action}</p>
                                        {act.note && <p className="text-xs text-slate-500 whitespace-pre-line">{act.note}</p>}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </Modal>

            {/* Record / renew certificate */}
            <Modal
                isOpen={certModal}
                onClose={() => setCertModal(false)}
                title={cert?.validUntil ? 'Upload Renewed Certificate' : 'Record Test Certificate'}
                maxWidth="max-w-xl"
                footer={
                    <>
                        <button type="button" onClick={() => setCertModal(false)} className="px-4 py-2 border border-slate-200 text-slate-500 text-sm font-bold rounded-xl hover:bg-slate-50">Cancel</button>
                        <button type="submit" form="type-test-cert-form" disabled={submitting} className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 disabled:bg-teal-400 text-white text-sm font-black rounded-xl shadow-md">
                            {submitting ? 'Saving...' : 'Save Certificate'}
                        </button>
                    </>
                }
            >
                <form id="type-test-cert-form" onSubmit={submitCertificate} className="space-y-4">
                    {cert?.validUntil && (
                        <p className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-100 rounded-xl p-3">
                            Current certificate {cert.certificateNo} (valid until {formatDate(cert.validUntil)}) will be closed and moved to history.
                        </p>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className={LABEL}>Certificate No <span className="text-rose-500">*</span></label>
                            <input type="text" value={certData.certificateNo} onChange={e => setCertData({ ...certData, certificateNo: e.target.value })} className={INPUT} />
                        </div>
                        <div>
                            <label className={LABEL}>Testing Agency</label>
                            <input type="text" value={certData.testingAgency} onChange={e => setCertData({ ...certData, testingAgency: e.target.value })} className={INPUT} />
                        </div>
                        <div>
                            <label className={LABEL}>Test Completion Date <span className="text-rose-500">*</span></label>
                            <DateInput type="date" value={certData.testCompletionDate} onChange={e => setCertData({ ...certData, testCompletionDate: e.target.value })} className={INPUT} />
                        </div>
                        <div>
                            <label className={LABEL}>Valid Until <span className="text-rose-500">*</span></label>
                            <DateInput type="date" value={certData.validUntil} onChange={e => setCertData({ ...certData, validUntil: e.target.value })} className={INPUT} />
                        </div>
                    </div>
                    <div>
                        <label className={LABEL}>Certificate Document</label>
                        <PdfUploadField value={certData.documentUrl} onChange={url => setCertData(prev => ({ ...prev, documentUrl: url }))} />
                    </div>
                    <div>
                        <label className={LABEL}>Remarks</label>
                        <textarea rows="2" value={certData.remarks} onChange={e => setCertData({ ...certData, remarks: e.target.value })} className={INPUT}></textarea>
                    </div>
                </form>
            </Modal>

            {/* Progress */}
            <Modal
                isOpen={progressModal}
                onClose={() => setProgressModal(false)}
                title="Record Renewal Progress"
                maxWidth="max-w-xl"
                footer={
                    <>
                        <button type="button" onClick={() => setProgressModal(false)} className="px-4 py-2 border border-slate-200 text-slate-500 text-sm font-bold rounded-xl hover:bg-slate-50">Cancel</button>
                        <button type="submit" form="type-test-progress-form" disabled={submitting} className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 disabled:bg-teal-400 text-white text-sm font-black rounded-xl shadow-md">
                            {submitting ? 'Saving...' : 'Save Progress'}
                        </button>
                    </>
                }
            >
                <form id="type-test-progress-form" onSubmit={submitProgress} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className={LABEL}>Renewal Status</label>
                            <select value={progressData.renewalStatus} onChange={e => setProgressData({ ...progressData, renewalStatus: e.target.value })} className={INPUT}>
                                {RENEWAL_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className={LABEL}>Next Action Date</label>
                            <DateInput type="date" value={progressData.nextActionDate} onChange={e => setProgressData({ ...progressData, nextActionDate: e.target.value })} className={INPUT} />
                        </div>
                        <div className="md:col-span-2">
                            <label className={LABEL}>Next Action</label>
                            <input type="text" value={progressData.nextAction} onChange={e => setProgressData({ ...progressData, nextAction: e.target.value })} placeholder="e.g. Await lab slot confirmation" className={INPUT} />
                        </div>
                    </div>
                    <div>
                        <label className={LABEL}>Progress Note</label>
                        <textarea rows="3" value={progressData.note} onChange={e => setProgressData({ ...progressData, note: e.target.value })} placeholder="What happened?" className={INPUT}></textarea>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default TypeTestRegister;
