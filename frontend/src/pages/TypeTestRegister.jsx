import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { typeTestService, productService, userService, uploadService } from '../services/api';
import { formatDate, formatDateTime, resolveImageUrl } from '../utils/helpers';
import {
    MdDashboard, MdListAlt, MdInventory2, MdSchedule, MdFactCheck, MdAdd, MdDownload,
    MdCloudUpload, MdAssignment, MdVerified, MdUpdate, MdErrorOutline, MdInfoOutline
} from 'react-icons/md';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';
import DateInput from '../components/DateInput';
import * as XLSX from 'xlsx';

const TEST_STATUSES = ['Not Started', 'In Progress', 'Valid', 'Expired', 'Renewal In Progress'];
const TEST_RESULTS = ['Pending', 'Pass', 'Fail', 'Not Applicable'];
const RENEWAL_STATUSES = ['Not Due', 'Upcoming', 'In Progress', 'Submitted', 'Renewed', 'Overdue'];

const PAGES = [
    { key: 'dashboard', label: 'Dashboard', icon: MdDashboard },
    { key: 'tests', label: 'Type Test Records', icon: MdListAlt },
    { key: 'products', label: 'Product & Model Master', icon: MdInventory2 },
    { key: 'renewals', label: 'Renewal Worklist', icon: MdSchedule }
];

const INPUT = 'w-full px-3 py-2 bg-slate-50 border border-slate-200 text-sm text-slate-700 font-semibold rounded-xl focus:outline-none focus:border-teal-500 focus:bg-white';
const LABEL = 'block text-xs font-bold text-slate-500 mb-1 uppercase';
const PANEL = 'min-w-0 bg-white border border-slate-100 rounded-2xl p-5 shadow-sm';
const TH = 'py-3.5 px-4 text-left text-xs font-bold text-slate-400 uppercase bg-slate-50/50 border-b border-slate-100 whitespace-nowrap';
const TD = 'py-3 px-4 align-top border-b border-slate-50 text-sm font-semibold text-slate-600';
const TDN = `${TD} whitespace-nowrap`;
const PRIMARY = 'flex items-center justify-center gap-1.5 px-4 py-2.5 bg-teal-600 hover:bg-teal-700 disabled:bg-teal-400 text-white text-sm font-black rounded-xl shadow-md hover:shadow-lg transition-all';
const SECONDARY = 'flex items-center justify-center gap-1.5 px-4 py-2.5 bg-teal-50 hover:bg-teal-100 border border-teal-200 text-teal-700 text-sm font-black rounded-xl transition-all';
const SMALL = 'whitespace-nowrap px-2.5 py-1.5 border border-slate-200 bg-white hover:bg-teal-50 hover:border-teal-200 hover:text-teal-700 rounded-lg text-xs font-bold text-slate-600 transition';
const NOTICE = 'flex items-start gap-2 px-4 py-3 rounded-xl bg-teal-50 border border-teal-100 text-teal-800 text-[13px] font-semibold';

const badgeTone = (s) => {
    if (['Valid', 'Renewed', 'Active'].includes(s)) return 'bg-emerald-50 text-emerald-700 border-emerald-100';
    if (['Expired', 'Overdue', 'Inactive'].includes(s)) return 'bg-rose-50 text-rose-700 border-rose-100';
    if (['Upcoming', 'In Progress', 'Renewal In Progress', 'Submitted'].includes(s)) return 'bg-amber-50 text-amber-700 border-amber-100';
    if (s === 'Not Started') return 'bg-slate-50 text-slate-600 border-slate-200';
    return 'bg-sky-50 text-sky-700 border-sky-100';
};
const Badge = ({ value }) => (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-bold whitespace-nowrap ${badgeTone(value)}`}>{value || 'Not set'}</span>
);

const toInputDate = (d) => (d ? new Date(d).toISOString().split('T')[0] : '');
const productText = (p) => (p ? `${p.productCode ? `${p.productCode} — ` : ''}${p.productName || ''}` : '');
const fmt = (d) => (d ? formatDate(d) : '—');
const muted = 'text-xs text-slate-500';
const expiryNote = (r) => {
    if (r.daysToExpiry === null || r.daysToExpiry === undefined) return 'No expiry';
    return r.daysToExpiry < 0 ? `${Math.abs(r.daysToExpiry)} days overdue` : `${r.daysToExpiry} days left`;
};
const nextReminderText = (r) => {
    if (!r.currentCertificate?.validUntil) return 'No expiry date';
    if (!r.nextReminder) return 'All reminders sent';
    // A milestone already reached is picked up by the next scheduler run (every 15 minutes).
    if (new Date(r.nextReminder.remindOn) <= new Date()) return `${r.nextReminder.leadDays} day milestone (sending now)`;
    return `${r.nextReminder.leadDays} day milestone (${fmt(r.nextReminder.remindOn)})`;
};

const EMPTY_FORM = {
    productId: '', productLabel: '', modelName: '', testName: '', testStandard: '', testingAgency: '',
    status: 'Not Started', testResult: 'Pending', testStartDate: '', testCompletionDate: '',
    certificateNo: '', issueDate: '', validUntil: '', documentUrl: '',
    ownerId: '', backupOwnerId: '', reminderLeadDays: '180,90,30', renewalStatus: 'Not Due',
    nextAction: '', nextActionDate: '', remarks: ''
};
const EMPTY_RENEWAL = { renewalStatus: 'Not Due', nextAction: '', nextActionDate: '', certificateNo: '', validUntil: '', documentUrl: '', note: '' };

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
                placeholder="Search product code or name"
                className={INPUT}
            />
            {open && (
                <div className="absolute z-50 mt-1 w-full max-h-60 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-lg">
                    {results.length === 0 ? (
                        <div className="px-3 py-2 text-xs text-slate-400">No products found</div>
                    ) : results.map(p => (
                        <button
                            type="button"
                            key={p._id}
                            onClick={() => { onChange(p._id, productText(p)); setOpen(false); }}
                            className="block w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-teal-50"
                        >
                            {productText(p)}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

const FileField = ({ id, value, onChange }) => {
    const [uploading, setUploading] = useState(false);
    const handleFile = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 10 * 1024 * 1024) {
            toast.error('Certificate file must be 10 MB or smaller.');
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
        <div>
            <label htmlFor={id} className={`inline-flex items-center gap-1.5 px-3 py-2 border border-dashed border-teal-300 bg-teal-50 text-teal-700 text-xs font-bold rounded-xl cursor-pointer hover:bg-teal-100 ${uploading ? 'opacity-60 pointer-events-none' : ''}`}>
                <MdCloudUpload size={16} /> {uploading ? 'Uploading...' : value ? 'Replace certificate PDF' : 'Upload certificate PDF'}
            </label>
            <input id={id} type="file" accept=".pdf,application/pdf" onChange={handleFile} disabled={uploading} className="hidden" />
            <div className={`${muted} mt-1.5`}>
                {uploading ? 'Uploading...' : value ? (
                    <>Current file: <a href={resolveImageUrl(value)} target="_blank" rel="noopener noreferrer" className="text-teal-700 font-bold hover:underline">View certificate</a>
                        {' '}<button type="button" onClick={() => onChange('')} className="text-red-600 font-semibold ml-1">Remove</button></>
                ) : 'No certificate file uploaded. PDF, up to 10 MB.'}
            </div>
        </div>
    );
};

const Field = ({ label, htmlFor, full, children }) => (
    <div className={`min-w-0 ${full ? 'sm:col-span-2 lg:col-span-3' : ''}`}>
        <label htmlFor={htmlFor} className={LABEL}>{label}</label>
        {children}
    </div>
);

const TypeTestRegister = () => {
    const { user: currentUser } = useAuth();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const page = PAGES.some(p => p.key === searchParams.get('tab')) ? searchParams.get('tab') : 'dashboard';

    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [users, setUsers] = useState([]);

    // Filters per section
    const [testSearch, setTestSearch] = useState('');
    const [testStatus, setTestStatus] = useState('');
    const [activeFilter, setActiveFilter] = useState('active');
    const [productSearch, setProductSearch] = useState('');
    const [productStatus, setProductStatus] = useState('');
    const [renewalSearch, setRenewalSearch] = useState('');
    const [renewalFilter, setRenewalFilter] = useState('');

    // Dialogs
    const [formOpen, setFormOpen] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [form, setForm] = useState(EMPTY_FORM);
    const [renewalRecord, setRenewalRecord] = useState(null);
    const [renewal, setRenewal] = useState(EMPTY_RENEWAL);
    const [historyRecord, setHistoryRecord] = useState(null);
    const [saving, setSaving] = useState(false);

    const showPage = (key) => setSearchParams({ tab: key });
    const setField = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

    const loadRecords = async () => {
        try {
            const res = await typeTestService.getAll();
            setRecords(res.data || []);
        } catch (err) {
            console.error('Failed to load type tests:', err);
            toast.error('Failed to load type test records.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadRecords();
        userService.getAll({ limit: 1000 })
            .then(res => setUsers(res.data?.data || res.data?.docs || res.data || []))
            .catch(err => console.error('Failed to load users:', err));
    }, []);

    // Notification links open a record's history: /type-tests?open=<id>
    useEffect(() => {
        const openId = searchParams.get('open');
        if (!openId) return;
        typeTestService.getById(openId)
            .then(res => setHistoryRecord(res.data))
            .catch(() => toast.error('Could not open that type test record.'));
        setSearchParams({ tab: 'renewals' }, { replace: true });
    }, [searchParams]);

    const activeRecords = useMemo(() => records.filter(r => r.isActive), [records]);

    const replaceRecord = (updated) => {
        setRecords(prev => prev.map(r => (r._id === updated._id ? updated : r)));
        if (historyRecord?._id === updated._id) {
            typeTestService.getById(updated._id).then(res => setHistoryRecord(res.data)).catch(() => {});
        }
    };

    /* ---------------- Create / edit ---------------- */

    const openTestModal = (record = null, preset = {}) => {
        if (record) {
            const c = record.currentCertificate || {};
            setEditingId(record._id);
            setForm({
                productId: record.productId?._id || record.productId || '',
                productLabel: productText(record.productId),
                modelName: record.modelName || '',
                testName: record.testName || '',
                testStandard: record.testStandard || '',
                testingAgency: record.testingAgency || '',
                status: record.status,
                testResult: record.testResult || 'Pending',
                testStartDate: toInputDate(record.testStartDate),
                testCompletionDate: toInputDate(c.testCompletionDate),
                certificateNo: c.certificateNo || '',
                issueDate: toInputDate(c.issueDate),
                validUntil: toInputDate(c.validUntil),
                documentUrl: c.documentUrl || '',
                ownerId: record.ownerId?._id || record.ownerId || '',
                backupOwnerId: record.backupOwnerId?._id || record.backupOwnerId || '',
                reminderLeadDays: (record.reminderLeadDays || [180, 90, 30]).join(','),
                renewalStatus: record.renewalStatus || 'Not Due',
                nextAction: record.nextAction || '',
                nextActionDate: toInputDate(record.nextActionDate),
                remarks: record.remarks || ''
            });
        } else {
            setEditingId(null);
            setForm({ ...EMPTY_FORM, ownerId: currentUser?.id || '', ...preset });
        }
        setFormOpen(true);
    };

    const saveTest = async (e) => {
        e.preventDefault();
        if (!form.productId) return toast.warning('Select a product.');
        if (!form.testName.trim()) return toast.warning('Enter the test name.');
        if (!form.ownerId) return toast.warning('Select the renewal owner.');
        if (form.backupOwnerId && form.backupOwnerId === form.ownerId) return toast.warning('Backup owner must be a different person.');
        if ((form.certificateNo || form.validUntil) && !(form.certificateNo && form.validUntil)) {
            return toast.warning('Enter both the certificate number and the valid until date.');
        }
        if (form.status === 'Valid' && !form.validUntil) return toast.warning('A Valid test needs a certificate and valid until date.');

        const { productLabel: _productLabel, ...payload } = form;
        setSaving(true);
        try {
            if (editingId) {
                const res = await typeTestService.update(editingId, payload);
                replaceRecord(res.data);
                toast.success('Type test record updated.');
            } else {
                const res = await typeTestService.create(payload);
                setRecords(prev => [res.data, ...prev]);
                toast.success('Type test record created.');
            }
            setFormOpen(false);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Could not save the record.');
        } finally {
            setSaving(false);
        }
    };

    /* ---------------- Renewal ---------------- */

    const openRenewalModal = (record) => {
        setRenewalRecord(record);
        setRenewal({
            ...EMPTY_RENEWAL,
            renewalStatus: record.renewalState === 'Overdue' ? 'Overdue' : (record.renewalStatus || 'Not Due'),
            nextAction: record.nextAction || '',
            nextActionDate: toInputDate(record.nextActionDate)
        });
    };

    const saveRenewal = async (e) => {
        e.preventDefault();
        const id = renewalRecord._id;
        setSaving(true);
        try {
            let res;
            if (renewal.renewalStatus === 'Renewed') {
                if (!renewal.certificateNo || !renewal.validUntil) {
                    setSaving(false);
                    return toast.warning('Enter the new certificate number and valid-until date to mark the renewal complete.');
                }
                res = await typeTestService.recordCertificate(id, {
                    certificateNo: renewal.certificateNo,
                    validUntil: renewal.validUntil,
                    issueDate: toInputDate(new Date()),
                    documentUrl: renewal.documentUrl,
                    testingAgency: renewalRecord.testingAgency,
                    remarks: renewal.note
                });
            } else {
                res = await typeTestService.recordProgress(id, {
                    renewalStatus: renewal.renewalStatus,
                    nextAction: renewal.nextAction,
                    nextActionDate: renewal.nextActionDate,
                    documentUrl: renewal.documentUrl || undefined,
                    note: renewal.note
                });
            }
            replaceRecord(res.data);
            setRenewalRecord(null);
            toast.success(renewal.renewalStatus === 'Renewed' ? 'Renewal recorded. Old certificate closed.' : 'Renewal progress saved.');
        } catch (err) {
            toast.error(err.response?.data?.message || 'Could not save the renewal.');
        } finally {
            setSaving(false);
        }
    };

    /* ---------------- Active / delete ---------------- */

    const setGroupActive = async (group, isActive) => {
        if (!isActive && !window.confirm('Mark this product inactive? Its history will be retained and future renewal reminders will be excluded.')) return;
        try {
            const results = await Promise.all(group.records
                .filter(r => r.isActive !== isActive)
                .map(r => typeTestService.setActive(r._id, isActive, isActive ? '' : 'Product discontinued')));
            results.forEach(res => replaceRecord(res.data));
            toast.success(isActive ? 'Product reactivated.' : 'Product marked inactive. Reminders stopped.');
        } catch (err) {
            toast.error(err.response?.data?.message || 'Could not update the product.');
        }
    };

    const toggleRecordActive = async (record) => {
        if (record.isActive && !window.confirm('Mark this test record inactive? Reminders will stop.')) return;
        try {
            const res = await typeTestService.setActive(record._id, !record.isActive, record.isActive ? 'Product discontinued' : '');
            replaceRecord(res.data);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Could not update the record.');
        }
    };

    const deleteRecord = async (record) => {
        if (!window.confirm('Delete this type test record and its certificate history? This cannot be undone.')) return;
        try {
            await typeTestService.delete(record._id);
            setRecords(prev => prev.filter(r => r._id !== record._id));
            setHistoryRecord(null);
            toast.success('Type test record deleted.');
        } catch (err) {
            toast.error(err.response?.data?.message || 'Could not delete the record.');
        }
    };

    /* ---------------- Export ---------------- */

    const exportCSV = () => {
        const rows = records.map(r => ({
            'Product Code': r.productId?.productCode || '',
            'Product Name': r.productId?.productName || '',
            'Model': r.modelName || '',
            'Test Name': r.testName || '',
            'Standard': r.testStandard || '',
            'Testing Laboratory': r.testingAgency || '',
            'Test Status': r.displayStatus,
            'Test Result': r.testResult || '',
            'Certificate Number': r.currentCertificate?.certificateNo || '',
            'Issue Date': toInputDate(r.currentCertificate?.issueDate),
            'Completion Date': toInputDate(r.currentCertificate?.testCompletionDate),
            'Valid Until': toInputDate(r.currentCertificate?.validUntil),
            'Owner': r.ownerId?.name || '',
            'Backup': r.backupOwnerId?.name || '',
            'Renewal Status': r.renewalState,
            'Next Action': r.nextAction || '',
            'Action Due Date': toInputDate(r.nextActionDate),
            'Document': r.currentCertificate?.documentUrl ? resolveImageUrl(r.currentCertificate.documentUrl) : ''
        }));
        if (!rows.length) return toast.warning('No records to export.');
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Type Tests');
        XLSX.writeFile(wb, 'type-test-records.csv', { bookType: 'csv' });
    };

    /* ---------------- Derived lists ---------------- */

    const productName = (r) => r.productId?.productName || 'Unknown product';
    const byExpiry = (a, b) => (toInputDate(a.currentCertificate?.validUntil) || '9999').localeCompare(toInputDate(b.currentCertificate?.validUntil) || '9999');

    const metrics = {
        total: records.length,
        valid: activeRecords.filter(r => r.displayStatus === 'Valid').length,
        due: activeRecords.filter(r => r.daysToExpiry !== null && r.daysToExpiry <= 90).length,
        expired: activeRecords.filter(r => r.displayStatus === 'Expired').length
    };
    const upcoming = activeRecords.filter(r => r.daysToExpiry !== null && r.daysToExpiry <= 180).sort(byExpiry).slice(0, 8);

    const testList = records.filter(r => {
        const hay = [r.productId?.productCode, r.productId?.productName, r.modelName, r.testName, r.testStandard, r.currentCertificate?.certificateNo, r.ownerId?.name].join(' ').toLowerCase();
        return hay.includes(testSearch.toLowerCase())
            && (!testStatus || r.displayStatus === testStatus)
            && (activeFilter === 'all' || (activeFilter === 'active' ? r.isActive : !r.isActive));
    }).sort(byExpiry);

    const productGroups = useMemo(() => {
        const map = new Map();
        records.forEach(r => {
            const key = `${r.productId?._id || r.productId}|${r.modelName || ''}`;
            if (!map.has(key)) map.set(key, { key, product: r.productId || {}, modelName: r.modelName || '', records: [] });
            map.get(key).records.push(r);
        });
        return [...map.values()].map(g => ({
            ...g,
            status: g.records.some(r => r.isActive) ? 'Active' : 'Inactive',
            owners: [...new Set(g.records.map(r => r.ownerId?.name).filter(Boolean))].join(', ')
        }));
    }, [records]);
    const productList = productGroups.filter(g => {
        const hay = [g.product.productCode, g.product.productName, g.modelName, g.owners].join(' ').toLowerCase();
        return hay.includes(productSearch.toLowerCase()) && (!productStatus || g.status === productStatus);
    });

    const renewalList = activeRecords.filter(r => {
        const hay = [r.productId?.productName, r.productId?.productCode, r.modelName, r.ownerId?.name, r.backupOwnerId?.name, r.currentCertificate?.certificateNo, r.testName].join(' ').toLowerCase();
        return hay.includes(renewalSearch.toLowerCase()) && (!renewalFilter || r.renewalState === renewalFilter);
    }).sort(byExpiry);

    const Empty = ({ cols, children }) => <tr><td colSpan={cols} className="text-center py-6 text-sm text-slate-500">{children}</td></tr>;
    const ProductCell = ({ r, sub }) => (
        <td className={TD}><b className="text-slate-900">{productName(r)}</b><br /><span className={muted}>{sub}</span></td>
    );

    const headingRow = (title, subtitle, action) => (
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
            <div>
                <h2 className="text-lg font-black text-slate-900 tracking-tight">{title}</h2>
                <div className="text-xs text-slate-500 font-semibold">{subtitle}</div>
            </div>
            {action}
        </div>
    );

    return (
        <div className="space-y-6 min-w-0">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-teal-500 to-teal-700 flex items-center justify-center text-white shadow-md">
                        <MdFactCheck size={24} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Type Test Management</h1>
                        <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Product compliance · Certificate control · Renewal tracking</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <button className={SECONDARY} onClick={exportCSV}><MdDownload size={18} /> Export CSV</button>
                    <button className={PRIMARY} onClick={() => openTestModal()}><MdAdd size={20} /> New Test Record</button>
                </div>
            </div>

            {/* Section tabs */}
            <div className="flex border-b border-slate-200 gap-2 overflow-x-auto" role="tablist">
                {PAGES.map(p => (
                    <button
                        key={p.key}
                        role="tab"
                        aria-selected={page === p.key}
                        onClick={() => showPage(p.key)}
                        className={`flex items-center gap-2 px-5 py-3.5 border-b-2 text-sm whitespace-nowrap transition-all ${page === p.key ? 'border-teal-600 text-teal-700 font-black' : 'border-transparent text-slate-500 font-bold hover:text-slate-700'}`}
                    >
                        <p.icon size={18} /> {p.label}
                    </button>
                ))}
            </div>

                <div className="min-w-0">
                    {loading ? (
                        <div className="py-20 text-center text-sm text-slate-500">Loading type test records...</div>
                    ) : (
                        <>
                            {page === 'dashboard' && (
                                <section>
                                    {headingRow('Overview', 'Product testing and certificate validity at a glance')}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
                                        {[
                                            { label: 'Total Test Records', value: metrics.total, hint: 'All recorded tests', icon: <MdAssignment size={20} />, color: 'from-teal-500 to-emerald-600', go: () => { setTestStatus(''); setActiveFilter('all'); showPage('tests'); } },
                                            { label: 'Valid Certificates', value: metrics.valid, hint: 'Currently within validity', icon: <MdVerified size={20} />, color: 'from-sky-500 to-cyan-600', go: () => { setTestStatus('Valid'); setActiveFilter('active'); showPage('tests'); } },
                                            { label: 'Renewals Due ≤ 90 Days', value: metrics.due, hint: 'Including already overdue', icon: <MdUpdate size={20} />, color: 'from-amber-400 to-orange-500', go: () => { setRenewalFilter(''); showPage('renewals'); } },
                                            { label: 'Expired Certificates', value: metrics.expired, hint: 'Requires review', icon: <MdErrorOutline size={20} />, color: 'from-rose-500 to-red-600', go: () => { setTestStatus('Expired'); setActiveFilter('active'); showPage('tests'); } }
                                        ].map(m => (
                                            <button
                                                key={m.label}
                                                type="button"
                                                onClick={m.go}
                                                className="relative overflow-hidden text-left bg-white border border-slate-200/80 rounded-2xl px-4 py-3.5 shadow-sm flex items-center justify-between gap-3 hover:-translate-y-0.5 hover:shadow-md transition-all active:scale-[0.98] group"
                                            >
                                                <span className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${m.color}`} />
                                                <div className="min-w-0">
                                                    <span className="block whitespace-nowrap truncate text-[11px] font-black uppercase text-slate-500 tracking-wider group-hover:text-slate-700">{m.label}</span>
                                                    <span className="block text-3xl font-black text-slate-900 leading-tight tabular-nums">{m.value}</span>
                                                    <span className="block text-[11px] font-semibold text-slate-400">{m.hint}</span>
                                                </div>
                                                <div className={`flex-shrink-0 w-10 h-10 bg-gradient-to-br ${m.color} rounded-xl flex items-center justify-center text-white shadow-sm group-hover:scale-110 transition-transform`}>
                                                    {m.icon}
                                                </div>
                                            </button>
                                        ))}
                                    </div>

                                    <div className="grid grid-cols-1 xl:grid-cols-[1.35fr_1fr] gap-4">
                                        <div className={PANEL}>
                                            <h2 className="text-sm font-black text-slate-800 uppercase tracking-wide mb-4">Upcoming renewals</h2>
                                            <div className="overflow-x-auto">
                                                <table className="w-full min-w-[640px] border-collapse">
                                                    <thead><tr><th className={TH}>Product / Model</th><th className={TH}>Certificate</th><th className={TH}>Valid until</th><th className={TH}>Owner</th><th className={TH}>Status</th></tr></thead>
                                                    <tbody>
                                                        {upcoming.length ? upcoming.map(r => (
                                                            <tr key={r._id}>
                                                                <ProductCell r={r} sub={`${r.modelName || '—'} · ${r.testName}`} />
                                                                <td className={TDN}>{r.currentCertificate?.certificateNo || '—'}</td>
                                                                <td className={TDN}>{fmt(r.currentCertificate?.validUntil)}</td>
                                                                <td className={TDN}>{r.ownerId?.name || '—'}</td>
                                                                <td className={TDN}><Badge value={r.renewalState} /></td>
                                                            </tr>
                                                        )) : <Empty cols={5}>No upcoming renewals.</Empty>}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                        <div className={PANEL}>
                                            <h2 className="text-sm font-black text-slate-800 uppercase tracking-wide mb-2">Testing pipeline</h2>
                                            {TEST_STATUSES.map(s => {
                                                const n = activeRecords.filter(r => r.displayStatus === s).length;
                                                const width = activeRecords.length ? Math.min(100, (n / activeRecords.length) * 100) : 0;
                                                const color = s === 'Valid' ? 'bg-emerald-500' : s === 'Expired' ? 'bg-rose-500' : s === 'In Progress' ? 'bg-sky-500' : s === 'Not Started' ? 'bg-slate-400' : 'bg-amber-500';
                                                return (
                                                    <div key={s} className="my-3.5">
                                                        <div className="flex justify-between text-[13px] mb-1.5"><span>{s}</span><b>{n}</b></div>
                                                        <div className="h-[7px] bg-slate-100 rounded-full overflow-hidden"><div className={`h-full ${color}`} style={{ width: `${width}%` }} /></div>
                                                    </div>
                                                );
                                            })}
                                            <p className={muted}>Counts exclude inactive products.</p>
                                        </div>
                                    </div>

                                    <div className={`${PANEL} mt-4`}>
                                        <h2 className="text-sm font-black text-slate-800 uppercase tracking-wide mb-4">Quick actions</h2>
                                        <div className="flex flex-wrap gap-2">
                                            <button className={PRIMARY} onClick={() => openTestModal()}>Create test record</button>
                                            <button className={SECONDARY} onClick={() => showPage('renewals')}>Review renewal worklist</button>
                                            <button className={SECONDARY} onClick={exportCSV}>Export records (CSV)</button>
                                        </div>
                                    </div>
                                </section>
                            )}

                            {page === 'tests' && (
                                <section>
                                    {headingRow('Type Test Records', 'Maintain testing status, test results and certificates')}
                                    <div className={PANEL}>
                                        <div className="flex flex-wrap gap-2.5 mb-4">
                                            <input value={testSearch} onChange={e => setTestSearch(e.target.value)} placeholder="Search product, model, test or certificate..." className={`${INPUT} flex-1 min-w-[160px]`} />
                                            <select value={testStatus} onChange={e => setTestStatus(e.target.value)} className={`${INPUT} flex-1 min-w-[160px]`}>
                                                <option value="">All statuses</option>
                                                {TEST_STATUSES.map(s => <option key={s}>{s}</option>)}
                                            </select>
                                            <select value={activeFilter} onChange={e => setActiveFilter(e.target.value)} className={`${INPUT} flex-1 min-w-[160px]`}>
                                                <option value="active">Active products</option>
                                                <option value="all">All products</option>
                                                <option value="inactive">Inactive products</option>
                                            </select>
                                        </div>
                                        <div className="overflow-x-auto">
                                            <table className="w-full min-w-[720px] border-collapse">
                                                <thead><tr><th className={TH}>Product / Model</th><th className={TH}>Test / Standard</th><th className={TH}>Test status</th><th className={TH}>Certificate</th><th className={TH}>Valid until</th><th className={TH}>Owner</th><th className={TH}>Actions</th></tr></thead>
                                                <tbody>
                                                    {testList.length ? testList.map(r => (
                                                        <tr key={r._id}>
                                                            <ProductCell r={r} sub={`${r.productId?.productCode || ''} / ${r.modelName || '—'}`} />
                                                            <td className={TD}>{r.testName}<br /><span className={muted}>{r.testStandard || 'No standard'}</span></td>
                                                            <td className={TDN}><Badge value={r.displayStatus} /></td>
                                                            <td className={TD}>
                                                                {r.currentCertificate?.certificateNo || '—'}<br />
                                                                {r.currentCertificate?.documentUrl
                                                                    ? <a href={resolveImageUrl(r.currentCertificate.documentUrl)} target="_blank" rel="noopener noreferrer" className="text-teal-700 font-bold hover:underline">View file</a>
                                                                    : <span className={muted}>No document</span>}
                                                            </td>
                                                            <td className={TDN}>{fmt(r.currentCertificate?.validUntil)}</td>
                                                            <td className={TDN}>{r.ownerId?.name || '—'}<br /><span className={muted}>Backup: {r.backupOwnerId?.name || '—'}</span></td>
                                                            <td className={TD}>
                                                                <div className="flex flex-nowrap gap-1.5">
                                                                    <button className={SMALL} onClick={() => openTestModal(r)}>Edit</button>
                                                                    <button className={SMALL} onClick={() => openRenewalModal(r)}>Renewal</button>
                                                                    <button className={SMALL} onClick={() => setHistoryRecord(r)}>History</button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    )) : <Empty cols={7}>No matching test records.</Empty>}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </section>
                            )}

                            {page === 'products' && (
                                <section>
                                    {headingRow(
                                        'Product & Model Master',
                                        'Products and models with type tests. Mark discontinued products inactive to stop their reminders.',
                                        <button className={SECONDARY} onClick={() => navigate('/products/new')}><MdAdd size={18} /> Add Product</button>
                                    )}
                                    <div className={`${NOTICE} mb-4`}><MdInfoOutline size={18} className="flex-shrink-0 mt-0.5" />
                                        Products are created in Product Master. Use "Add test" to record a type test against an existing product and model.
                                    </div>
                                    <div className={PANEL}>
                                        <div className="flex flex-wrap gap-2.5 mb-4">
                                            <input value={productSearch} onChange={e => setProductSearch(e.target.value)} placeholder="Search product code, name or model..." className={`${INPUT} flex-1 min-w-[160px]`} />
                                            <select value={productStatus} onChange={e => setProductStatus(e.target.value)} className={`${INPUT} flex-1 min-w-[160px]`}>
                                                <option value="">All products</option>
                                                <option value="Active">Active</option>
                                                <option value="Inactive">Inactive</option>
                                            </select>
                                        </div>
                                        <div className="overflow-x-auto">
                                            <table className="w-full min-w-[720px] border-collapse">
                                                <thead><tr><th className={TH}>Product code</th><th className={TH}>Product name</th><th className={TH}>Model</th><th className={TH}>Type tests</th><th className={TH}>Owner</th><th className={TH}>Status</th><th className={TH}>Actions</th></tr></thead>
                                                <tbody>
                                                    {productList.length ? productList.map(g => (
                                                        <tr key={g.key}>
                                                            <td className={TDN}>{g.product.productCode || '—'}</td>
                                                            <td className={TD}><b>{g.product.productName || 'Unknown product'}</b></td>
                                                            <td className={TDN}>{g.modelName || '—'}</td>
                                                            <td className={TD}>{g.records.map(r => r.testName).join(', ')}</td>
                                                            <td className={TDN}>{g.owners || '—'}</td>
                                                            <td className={TDN}><Badge value={g.status} /></td>
                                                            <td className={TD}>
                                                                <div className="flex flex-nowrap gap-1.5">
                                                                    <button
                                                                        className={SMALL}
                                                                        onClick={() => openTestModal(null, { productId: g.product._id, productLabel: productText(g.product), modelName: g.modelName })}
                                                                    >Add test</button>
                                                                    <button className={SMALL} onClick={() => setGroupActive(g, g.status !== 'Active')}>
                                                                        {g.status === 'Active' ? 'Mark inactive' : 'Reactivate'}
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    )) : <Empty cols={7}>No products found.</Empty>}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </section>
                            )}

                            {page === 'renewals' && (
                                <section>
                                    {headingRow('Renewal Worklist', 'Track upcoming, in-progress and overdue certificate renewals')}
                                    <div className={`${NOTICE} mb-4`}><MdInfoOutline size={18} className="flex-shrink-0 mt-0.5" />
                                        Reminder dates are calculated from the certificate expiry date. The owner and backup receive a portal notification at each reminder milestone.
                                    </div>
                                    <div className={PANEL}>
                                        <div className="flex flex-wrap gap-2.5 mb-4">
                                            <input value={renewalSearch} onChange={e => setRenewalSearch(e.target.value)} placeholder="Search product, model or owner..." className={`${INPUT} flex-1 min-w-[160px]`} />
                                            <select value={renewalFilter} onChange={e => setRenewalFilter(e.target.value)} className={`${INPUT} flex-1 min-w-[160px]`}>
                                                <option value="">All renewal states</option>
                                                {RENEWAL_STATUSES.map(s => <option key={s}>{s}</option>)}
                                            </select>
                                        </div>
                                        <div className="overflow-x-auto">
                                            <table className="w-full min-w-[900px] border-collapse">
                                                <thead><tr><th className={TH}>Product / Model</th><th className={TH}>Certificate</th><th className={TH}>Expiry</th><th className={TH}>Next reminder</th><th className={TH}>Owner / Backup</th><th className={TH}>Renewal status</th><th className={TH}>Next action / due date</th><th className={TH}>Update</th></tr></thead>
                                                <tbody>
                                                    {renewalList.length ? renewalList.map(r => (
                                                        <tr key={r._id}>
                                                            <ProductCell r={r} sub={`${r.modelName || '—'} · ${r.testName}`} />
                                                            <td className={TDN}>{r.currentCertificate?.certificateNo || '—'}</td>
                                                            <td className={TDN}>{fmt(r.currentCertificate?.validUntil)}<br /><span className={muted}>{expiryNote(r)}</span></td>
                                                            <td className={TD}>{nextReminderText(r)}</td>
                                                            <td className={TDN}>{r.ownerId?.name || '—'}<br /><span className={muted}>Backup: {r.backupOwnerId?.name || '—'}</span></td>
                                                            <td className={TDN}><Badge value={r.renewalState} /></td>
                                                            <td className={TD}>{r.nextAction || 'No action set'}<br /><span className={muted}>{fmt(r.nextActionDate)}</span></td>
                                                            <td className={TD}><button className={SMALL} onClick={() => openRenewalModal(r)}>Update</button></td>
                                                        </tr>
                                                    )) : <Empty cols={8}>No renewal records match this filter.</Empty>}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </section>
                            )}
                        </>
                    )}
                </div>

            {/* New / edit test record */}
            <Modal
                isOpen={formOpen}
                onClose={() => setFormOpen(false)}
                title={editingId ? 'Edit Type Test Record' : 'New Type Test Record'}
                maxWidth="max-w-4xl"
                footer={
                    <>
                        <button type="button" className={SECONDARY} onClick={() => setFormOpen(false)}>Cancel</button>
                        <button type="submit" form="type-test-form" disabled={saving} className={PRIMARY}>{saving ? 'Saving...' : 'Save record'}</button>
                    </>
                }
            >
                <p className={`${muted} mb-4`}>Fields marked * are required.</p>
                <form id="type-test-form" onSubmit={saveTest}>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                        <Field label="Product *">
                            <ProductPicker label={form.productLabel} onChange={(id, label) => setForm(prev => ({ ...prev, productId: id, productLabel: label }))} />
                        </Field>
                        <Field label="Model" htmlFor="tModel"><input id="tModel" className={INPUT} value={form.modelName} onChange={e => setField('modelName', e.target.value)} placeholder="Model number" /></Field>
                        <Field label="Test name *" htmlFor="tTestName"><input id="tTestName" className={INPUT} value={form.testName} onChange={e => setField('testName', e.target.value)} placeholder="e.g. Temperature rise test" /></Field>
                        <Field label="Applicable standard" htmlFor="tStandard"><input id="tStandard" className={INPUT} value={form.testStandard} onChange={e => setField('testStandard', e.target.value)} placeholder="Standard and revision" /></Field>
                        <Field label="Testing laboratory" htmlFor="tLab"><input id="tLab" className={INPUT} value={form.testingAgency} onChange={e => setField('testingAgency', e.target.value)} placeholder="Laboratory name" /></Field>
                        <Field label="Test status *" htmlFor="tStatus">
                            <select id="tStatus" className={INPUT} value={form.status} onChange={e => setField('status', e.target.value)}>
                                {TEST_STATUSES.map(s => <option key={s}>{s}</option>)}
                            </select>
                        </Field>
                        <Field label="Test result" htmlFor="tResult">
                            <select id="tResult" className={INPUT} value={form.testResult} onChange={e => setField('testResult', e.target.value)}>
                                {TEST_RESULTS.map(s => <option key={s}>{s}</option>)}
                            </select>
                        </Field>
                        <Field label="Test start date"><DateInput type="date" className={INPUT} value={form.testStartDate} onChange={e => setField('testStartDate', e.target.value)} /></Field>
                        <Field label="Test completion date"><DateInput type="date" className={INPUT} value={form.testCompletionDate} onChange={e => setField('testCompletionDate', e.target.value)} /></Field>
                        <Field label="Certificate number" htmlFor="tCert"><input id="tCert" className={INPUT} value={form.certificateNo} onChange={e => setField('certificateNo', e.target.value)} placeholder="Certificate reference" /></Field>
                        <Field label="Certificate issue date"><DateInput type="date" className={INPUT} value={form.issueDate} onChange={e => setField('issueDate', e.target.value)} /></Field>
                        <Field label="Valid until date"><DateInput type="date" className={INPUT} value={form.validUntil} onChange={e => setField('validUntil', e.target.value)} /></Field>
                        <Field label="Renewal owner *" htmlFor="tOwner">
                            <select id="tOwner" className={INPUT} value={form.ownerId} onChange={e => setField('ownerId', e.target.value)}>
                                <option value="">Responsible person</option>
                                {users.map(u => <option key={u._id} value={u._id}>{u.name}</option>)}
                            </select>
                        </Field>
                        <Field label="Backup owner" htmlFor="tBackup">
                            <select id="tBackup" className={INPUT} value={form.backupOwnerId} onChange={e => setField('backupOwnerId', e.target.value)}>
                                <option value="">Backup person</option>
                                {users.map(u => <option key={u._id} value={u._id}>{u.name}</option>)}
                            </select>
                        </Field>
                        <Field label="Reminder lead times (days)" htmlFor="tLead"><input id="tLead" className={INPUT} value={form.reminderLeadDays} onChange={e => setField('reminderLeadDays', e.target.value)} placeholder="180,90,30" /></Field>
                        <Field label="Renewal status" htmlFor="tRenewal">
                            <select id="tRenewal" className={INPUT} value={form.renewalStatus} onChange={e => setField('renewalStatus', e.target.value)}>
                                {RENEWAL_STATUSES.map(s => <option key={s}>{s}</option>)}
                            </select>
                        </Field>
                        <Field label="Next action" htmlFor="tNextAction"><input id="tNextAction" className={INPUT} value={form.nextAction} onChange={e => setField('nextAction', e.target.value)} placeholder="e.g. Contact laboratory" /></Field>
                        <Field label="Next action due date"><DateInput type="date" className={INPUT} value={form.nextActionDate} onChange={e => setField('nextActionDate', e.target.value)} /></Field>
                        <Field label="Remarks" htmlFor="tNotes" full><textarea id="tNotes" rows="2" className={INPUT} value={form.remarks} onChange={e => setField('remarks', e.target.value)} placeholder="Notes and follow-up details" /></Field>
                        <Field label="Certificate document (PDF)" htmlFor="tFile" full><FileField id="tFile" value={form.documentUrl} onChange={url => setField('documentUrl', url)} /></Field>
                    </div>
                </form>
            </Modal>

            {/* Renewal progress */}
            <Modal
                isOpen={!!renewalRecord}
                onClose={() => setRenewalRecord(null)}
                title="Update Renewal Progress"
                maxWidth="max-w-4xl"
                footer={
                    <>
                        <button type="button" className={SECONDARY} onClick={() => setRenewalRecord(null)}>Cancel</button>
                        <button type="submit" form="type-test-renewal-form" disabled={saving} className={PRIMARY}>{saving ? 'Saving...' : 'Save renewal'}</button>
                    </>
                }
            >
                {renewalRecord && (
                    <p className={`${muted} mb-4`}>
                        {productName(renewalRecord)} · {renewalRecord.modelName || '—'} · {renewalRecord.testName} — current certificate {renewalRecord.currentCertificate?.certificateNo || 'none'}, valid until {fmt(renewalRecord.currentCertificate?.validUntil)}
                    </p>
                )}
                <form id="type-test-renewal-form" onSubmit={saveRenewal}>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                        <Field label="Renewal status" htmlFor="rStatus">
                            <select id="rStatus" className={INPUT} value={renewal.renewalStatus} onChange={e => setRenewal({ ...renewal, renewalStatus: e.target.value })}>
                                {RENEWAL_STATUSES.map(s => <option key={s}>{s}</option>)}
                            </select>
                        </Field>
                        <Field label="Next action" htmlFor="rAction"><input id="rAction" className={INPUT} value={renewal.nextAction} onChange={e => setRenewal({ ...renewal, nextAction: e.target.value })} /></Field>
                        <Field label="Next action due date"><DateInput type="date" className={INPUT} value={renewal.nextActionDate} onChange={e => setRenewal({ ...renewal, nextActionDate: e.target.value })} /></Field>
                        <Field label="New certificate number" htmlFor="rNewCert"><input id="rNewCert" className={INPUT} value={renewal.certificateNo} onChange={e => setRenewal({ ...renewal, certificateNo: e.target.value })} /></Field>
                        <Field label="New valid until date"><DateInput type="date" className={INPUT} value={renewal.validUntil} onChange={e => setRenewal({ ...renewal, validUntil: e.target.value })} /></Field>
                        <Field label="New certificate document" htmlFor="rNewFile"><FileField id="rNewFile" value={renewal.documentUrl} onChange={url => setRenewal(prev => ({ ...prev, documentUrl: url }))} /></Field>
                        <Field label="Progress notes" htmlFor="rNotes" full><textarea id="rNotes" rows="3" className={INPUT} value={renewal.note} onChange={e => setRenewal({ ...renewal, note: e.target.value })} /></Field>
                    </div>
                    <p className={`${muted} mt-3`}>Choose "Renewed" with the new certificate number and valid until date to close the old certificate and restart reminders.</p>
                </form>
            </Modal>

            {/* History */}
            <Modal
                isOpen={!!historyRecord}
                onClose={() => setHistoryRecord(null)}
                title="Type Test History"
                maxWidth="max-w-3xl"
                footer={historyRecord && (
                    <>
                        <button className={SECONDARY} onClick={() => toggleRecordActive(historyRecord)}>{historyRecord.isActive ? 'Mark inactive' : 'Reactivate'}</button>
                        <button className="px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 text-sm font-black rounded-xl" onClick={() => deleteRecord(historyRecord)}>Delete</button>
                        <button className={PRIMARY} onClick={() => { const r = historyRecord; setHistoryRecord(null); openRenewalModal(r); }}>Update renewal</button>
                    </>
                )}
            >
                {historyRecord && (
                    <div className="space-y-5 text-sm">
                        <div className="flex flex-wrap justify-between gap-2">
                            <div>
                                <div className="text-base font-bold text-slate-900">{productName(historyRecord)}</div>
                                <div className={muted}>{historyRecord.productId?.productCode} / {historyRecord.modelName || '—'} · {historyRecord.testName}{historyRecord.testStandard ? ` · ${historyRecord.testStandard}` : ''}</div>
                            </div>
                            <div className="flex gap-1.5 items-start"><Badge value={historyRecord.displayStatus} /><Badge value={historyRecord.renewalState} /></div>
                        </div>

                        <div>
                            <h3 className="text-xs font-bold uppercase text-slate-500 mb-2">Reminders ({(historyRecord.reminderLeadDays || []).join(', ')} days before expiry)</h3>
                            {historyRecord.reminders?.length ? historyRecord.reminders.map(rem => (
                                <div key={rem.leadDays} className="flex justify-between py-1 border-b border-slate-100">
                                    <span>{rem.leadDays} day milestone · {fmt(rem.remindOn)}</span>
                                    <span className={rem.sentAt ? 'text-green-700' : 'text-slate-500'}>{rem.sentAt ? `Sent ${fmt(rem.sentAt)}` : historyRecord.isActive ? 'Scheduled' : 'Paused'}</span>
                                </div>
                            )) : <p className={muted}>Reminders start once a certificate with a valid until date is recorded.</p>}
                        </div>

                        <div>
                            <h3 className="text-xs font-bold uppercase text-slate-500 mb-2">Certificates</h3>
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[520px] border-collapse">
                                    <thead><tr><th className={TH}>Certificate</th><th className={TH}>Issued</th><th className={TH}>Valid until</th><th className={TH}>State</th></tr></thead>
                                    <tbody>
                                        {historyRecord.currentCertificate?.certificateNo && (
                                            <tr>
                                                <td className={TD}>{historyRecord.currentCertificate.certificateNo}{historyRecord.currentCertificate.documentUrl && <> · <a href={resolveImageUrl(historyRecord.currentCertificate.documentUrl)} target="_blank" rel="noopener noreferrer" className="text-teal-700 font-bold hover:underline">View file</a></>}</td>
                                                <td className={TD}>{fmt(historyRecord.currentCertificate.issueDate || historyRecord.currentCertificate.testCompletionDate)}</td>
                                                <td className={TD}>{fmt(historyRecord.currentCertificate.validUntil)}</td>
                                                <td className={TD}><Badge value="Active" /></td>
                                            </tr>
                                        )}
                                        {[...(historyRecord.certificateHistory || [])].reverse().map(h => (
                                            <tr key={h._id}>
                                                <td className={TD}>{h.certificateNo || '—'}{h.documentUrl && <> · <a href={resolveImageUrl(h.documentUrl)} target="_blank" rel="noopener noreferrer" className="text-teal-700 font-bold hover:underline">View file</a></>}</td>
                                                <td className={TD}>{fmt(h.issueDate || h.testCompletionDate)}</td>
                                                <td className={TD}>{fmt(h.validUntil)}</td>
                                                <td className={TD}><span className="text-slate-500">Closed {fmt(h.closedAt)}{h.closedBy?.name ? ` by ${h.closedBy.name}` : ''}</span></td>
                                            </tr>
                                        ))}
                                        {!historyRecord.currentCertificate?.certificateNo && !historyRecord.certificateHistory?.length && <Empty cols={4}>No certificates recorded yet.</Empty>}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div>
                            <h3 className="text-xs font-bold uppercase text-slate-500 mb-2">Progress log</h3>
                            <div className="space-y-3 pl-3 border-l-2 border-teal-100 max-h-64 overflow-y-auto">
                                {[...(historyRecord.activities || [])].reverse().map((a, i) => (
                                    <div key={i}>
                                        <div className="flex justify-between text-[11px] font-semibold text-slate-400"><span>{a.userName}</span><span>{formatDateTime(a.timestamp)}</span></div>
                                        <div className="text-slate-800">{a.action}</div>
                                        {a.note && <div className="text-slate-500 whitespace-pre-line">{a.note}</div>}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </Modal>

        </div>
    );
};

export default TypeTestRegister;
