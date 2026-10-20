import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { typeTestService, productService, userService, uploadService } from '../services/api';
import { formatDate, formatDateTime, resolveImageUrl } from '../utils/helpers';
import {
    MdDashboard, MdListAlt, MdInventory2, MdSchedule, MdFactCheck, MdAdd, MdDownload,
    MdCloudUpload, MdAssignment, MdVerified, MdUpdate, MdErrorOutline, MdInfoOutline, MdArrowBack, MdPendingActions
} from 'react-icons/md';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';
import DateInput from '../components/DateInput';
import * as XLSX from 'xlsx';

const TEST_STATUSES = ['Not Started', 'In Progress', 'Valid', 'Expired', 'Renewal In Progress'];
const TEST_RESULTS = ['Pending', 'Pass', 'Fail', 'Not Applicable'];
const RENEWAL_STATUSES = ['Not Due', 'Upcoming', 'In Progress', 'Submitted', 'Renewed', 'Overdue'];

const PAGES = [
    { key: 'dashboard', label: 'Dashboard', icon: MdDashboard },
    { key: 'tests', label: 'Type Test Records', icon: MdListAlt },
    { key: 'products', label: 'Product & Model Master', icon: MdInventory2 },
    { key: 'renewals', label: 'Renewal Worklist', icon: MdSchedule },
    { key: 'pending', label: 'Pending Records', icon: MdPendingActions }
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
const mgr4Text = (p) => {
    const m = p?.mgr4;
    if (!m || typeof m !== 'object') return 'Not set';
    return [m.code, m.description].filter(Boolean).join(' - ') || 'Not set';
};
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
    productId: '', productLabel: '', productMgr4: '', modelName: '', testName: '', testStandard: '', testingAgency: '',
    status: 'Not Started', testResult: 'Pending', testStartDate: '', testCompletionDate: '',
    certificateNo: '', issueDate: '', validUntil: '', documentUrl: '',
    ownerId: '', backupOwnerId: '', reminderLeadDays: '180', renewalStatus: 'Not Due',
    nextAction: '', nextActionDate: '', remarks: ''
};
// One reminder lead time is chosen per record. Records saved with several lead times
// (the old 180,90,30 default) open with the earliest of them that is still an option.
const LEAD_DAY_OPTIONS = ['180', '90', '30'];
const leadDayOption = (days) => (
    LEAD_DAY_OPTIONS.find(o => (days || []).map(String).includes(o)) || LEAD_DAY_OPTIONS[0]
);

// Single choice shown as buttons; the chosen one is filled teal.
const ChoiceGroup = ({ name, options, value, onChange }) => (
    <div role="radiogroup" className="flex gap-2">
        {options.map(o => {
            const selected = value === o.value;
            return (
                <label
                    key={o.value}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border text-sm font-black cursor-pointer transition-all focus-within:ring-2 focus-within:ring-teal-500/40 ${selected ? 'bg-teal-600 border-teal-600 text-white shadow-md' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-teal-50 hover:border-teal-200'}`}
                >
                    <input type="radio" name={name} value={o.value} checked={selected} onChange={() => onChange(o.value)} className="sr-only" />
                    {o.label}
                </label>
            );
        })}
    </div>
);

const EMPTY_RENEWAL = { renewalStatus: 'Not Due', nextAction: '', nextActionDate: '', certificateNo: '', validUntil: '', documentUrl: '', note: '' };

// Styled hover/focus tooltip. Rendered into <body> with fixed positioning so it is not
// clipped by the scrolling product dropdown; it flips below the target near the screen top.
const Tooltip = ({ content, children, className = '' }) => {
    const [pos, setPos] = useState(null);
    const show = (e) => {
        const r = e.currentTarget.getBoundingClientRect();
        const below = r.top < 80;
        setPos({ left: r.left + r.width / 2, top: below ? r.bottom + 8 : r.top - 8, below });
    };
    const hide = () => setPos(null);
    return (
        <span className={className} onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide}>
            {children}
            {pos && content && createPortal(
                <div
                    role="tooltip"
                    style={{ position: 'fixed', left: pos.left, top: pos.top, transform: `translate(-50%, ${pos.below ? '0' : '-100%'})` }}
                    className="z-[10000] pointer-events-none max-w-xs px-3 py-2 rounded-lg bg-slate-900 text-white shadow-xl"
                >
                    {content}
                    <span
                        className={`absolute left-1/2 -translate-x-1/2 border-[6px] border-transparent ${pos.below ? 'bottom-full border-b-slate-900' : 'top-full border-t-slate-900'}`}
                    />
                </div>,
                document.body
            )}
        </span>
    );
};

const Mgr4Tip = ({ value }) => (
    <>
        <div className="text-[10px] font-black uppercase tracking-wider text-teal-300">MGR4 FG</div>
        <div className="text-xs font-semibold">{value || 'Not set'}</div>
    </>
);

// Server-side product search, since the catalog is too large for a plain dropdown.
// The parent owns the text (label) so it can prefill it when editing.
// Lists only products marked "Applicable for Test Type" in Product Master.
const ProductPicker = ({ label, tooltip, onChange }) => {
    const query = label || '';
    const [results, setResults] = useState([]);
    const [open, setOpen] = useState(false);
    const boxRef = useRef(null);

    useEffect(() => {
        if (!open) return undefined;
        const timer = setTimeout(async () => {
            try {
                const res = await productService.getAll({ search: query, limit: 20, page: 1, typeTest: 'true' });
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
            <Tooltip content={!open && tooltip ? <Mgr4Tip value={tooltip} /> : null} className="block">
                <input
                    type="text"
                    value={query}
                    onFocus={() => setOpen(true)}
                    onChange={e => { setOpen(true); onChange('', e.target.value, ''); }}
                    placeholder="Search product code or name"
                    className={INPUT}
                />
            </Tooltip>
            {open && (
                <div className="absolute z-50 mt-1 w-full max-h-60 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-lg">
                    {results.length === 0 ? (
                        <div className="px-3 py-2 text-xs text-slate-400">No products found. Set "Applicable for Test Type" to Yes in Product Master.</div>
                    ) : results.map(p => (
                        <Tooltip key={p._id} content={<Mgr4Tip value={mgr4Text(p)} />} className="block">
                            <button
                                type="button"
                                onClick={() => { onChange(p._id, productText(p), mgr4Text(p)); setOpen(false); }}
                                className="block w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-teal-50"
                            >
                                {productText(p)}
                            </button>
                        </Tooltip>
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
    // Dashboard card or pipeline row the user clicked; '' shows upcoming renewals.
    const [dashFilter, setDashFilter] = useState('');
    // Products marked "Applicable for Test Type" with no tested record yet.
    const [pending, setPending] = useState([]);
    const [pendingSearch, setPendingSearch] = useState('');

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

    const loadPending = () => typeTestService.getPending()
        .then(res => setPending(res.data || []))
        .catch(err => console.error('Failed to load pending products:', err));

    const loadRecords = async () => {
        loadPending();
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
        setSearchParams({ tab: 'renewals', history: openId }, { replace: true });
    }, [searchParams]);

    const activeRecords = useMemo(() => records.filter(r => r.isActive), [records]);

    const replaceRecord = (updated) => {
        setRecords(prev => prev.map(r => (r._id === updated._id ? updated : r)));
        loadPending();
        if (historyRecord?._id === updated._id) {
            typeTestService.getById(updated._id).then(res => setHistoryRecord(res.data)).catch(() => {});
        }
    };

    /* ---------------- Create / edit ---------------- */

    // The form is a full screen of its own, addressed as ?form=new or ?form=<record id>,
    // so the browser Back button and a page refresh behave like any other screen.
    const formParam = searchParams.get('form');

    const fillForm = (record = null, preset = {}) => {
        if (record) {
            const c = record.currentCertificate || {};
            setEditingId(record._id);
            setForm({
                productId: record.productId?._id || record.productId || '',
                productLabel: productText(record.productId),
                productMgr4: mgr4Text(record.productId),
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
                reminderLeadDays: leadDayOption(record.reminderLeadDays),
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
        window.scrollTo(0, 0);
    };

    const openTestPage = (record = null, preset = {}) => {
        fillForm(record, preset);
        setSearchParams({ tab: page, form: record?._id || 'new' });
    };

    const closeForm = () => {
        setFormOpen(false);
        setSearchParams({ tab: page }, { replace: true });
    };

    useEffect(() => {
        if (!formParam) {
            if (formOpen) setFormOpen(false);
            return;
        }
        if (formOpen || loading) return;
        if (formParam === 'new') {
            fillForm();
        } else {
            const record = records.find(r => r._id === formParam);
            if (record) fillForm(record);
            else setSearchParams({ tab: page }, { replace: true });
        }
    }, [formParam, loading]);

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

        const { productLabel: _productLabel, productMgr4: _productMgr4, ...payload } = form;
        setSaving(true);
        try {
            if (editingId) {
                const res = await typeTestService.update(editingId, payload);
                replaceRecord(res.data);
                toast.success('Type test record updated.');
            } else {
                const res = await typeTestService.create(payload);
                setRecords(prev => [res.data, ...prev]);
                loadPending();
                toast.success('Type test record created.');
            }
            closeForm();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Could not save the record.');
        } finally {
            setSaving(false);
        }
    };

    /* ---------------- Renewal & history screens ---------------- */

    // Like the form, these are full screens addressed as ?renewal=<id> and ?history=<id>.
    const renewalParam = searchParams.get('renewal');
    const historyParam = searchParams.get('history');

    const fillRenewal = (record) => {
        setRenewalRecord(record);
        setRenewal({
            ...EMPTY_RENEWAL,
            renewalStatus: record.renewalState === 'Overdue' ? 'Overdue' : (record.renewalStatus || 'Not Due'),
            nextAction: record.nextAction || '',
            nextActionDate: toInputDate(record.nextActionDate)
        });
        window.scrollTo(0, 0);
    };

    const openRenewalPage = (record) => {
        fillRenewal(record);
        setSearchParams({ tab: page, renewal: record._id });
    };

    const closeRenewal = () => {
        setRenewalRecord(null);
        setSearchParams({ tab: page }, { replace: true });
    };

    // The list copy shows at once; the full record adds who closed each old certificate.
    const loadHistory = (id) => typeTestService.getById(id)
        .then(res => setHistoryRecord(res.data))
        .catch(() => {
            toast.error('Could not open that type test record.');
            setSearchParams({ tab: page }, { replace: true });
        });

    const openHistoryPage = (record) => {
        setHistoryRecord(record);
        window.scrollTo(0, 0);
        setSearchParams({ tab: page, history: record._id });
        loadHistory(record._id);
    };

    const closeHistory = () => {
        setHistoryRecord(null);
        setSearchParams({ tab: page }, { replace: true });
    };

    // Keep the screens in step with the address bar (Back / Forward / refresh).
    useEffect(() => {
        if (!renewalParam) {
            if (renewalRecord) setRenewalRecord(null);
        } else if (!renewalRecord && !loading) {
            const record = records.find(r => r._id === renewalParam);
            if (record) fillRenewal(record);
            else setSearchParams({ tab: page }, { replace: true });
        }
    }, [renewalParam, loading]);

    useEffect(() => {
        if (!historyParam) {
            if (historyRecord) setHistoryRecord(null);
        } else if (historyRecord?._id !== historyParam) {
            window.scrollTo(0, 0);
            loadHistory(historyParam);
        }
    }, [historyParam]);

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
            closeRenewal();
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
            loadPending();
            closeHistory();
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

    // Each card's count is the length of its rows, so clicking a card lists exactly what it counts.
    const hasExpiry = (r) => r.daysToExpiry !== null && r.daysToExpiry !== undefined;
    const dashboardCards = [
        { key: 'total', label: 'Total Test Records', hint: 'All recorded tests', icon: <MdAssignment size={20} />, color: 'from-teal-500 to-emerald-600', rows: records },
        { key: 'valid', label: 'Valid Certificates', hint: 'Currently within validity', icon: <MdVerified size={20} />, color: 'from-sky-500 to-cyan-600', rows: activeRecords.filter(r => r.displayStatus === 'Valid') },
        { key: 'due', label: 'Renewals Due ≤ 90 Days', hint: 'Including already overdue', icon: <MdUpdate size={20} />, color: 'from-amber-400 to-orange-500', rows: activeRecords.filter(r => hasExpiry(r) && r.daysToExpiry <= 90) },
        { key: 'expired', label: 'Expired Certificates', hint: 'Requires review', icon: <MdErrorOutline size={20} />, color: 'from-rose-500 to-red-600', rows: activeRecords.filter(r => r.displayStatus === 'Expired') },
        // Products, not test records, so it opens its own tab instead of filtering the table below.
        { key: 'pending', label: 'Pending Records', hint: 'Applicable, not yet tested', icon: <MdPendingActions size={20} />, color: 'from-violet-500 to-purple-600', rows: pending, go: () => showPage('pending') }
    ];
    const pipeline = TEST_STATUSES.map(s => ({ key: `status:${s}`, label: s, rows: activeRecords.filter(r => r.displayStatus === s) }));
    const dashSelection = [...dashboardCards.filter(c => !c.go), ...pipeline].find(c => c.key === dashFilter);
    const toggleDashFilter = (key) => setDashFilter(prev => (prev === key ? '' : key));
    const upcoming = activeRecords.filter(r => hasExpiry(r) && r.daysToExpiry <= 180).sort(byExpiry).slice(0, 8);
    const dashRows = dashSelection ? [...dashSelection.rows].sort(byExpiry) : upcoming;

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
        <td className={TD}><Tooltip content={<Mgr4Tip value={mgr4Text(r.productId)} />}><b className="text-slate-900 cursor-help">{productName(r)}</b></Tooltip><br /><span className={muted}>{sub}</span></td>
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

    // Other test records already kept for the chosen product, shown under the form so the
    // earlier test can be read while the next one is entered.
    const previousRecords = form.productId
        ? records
            .filter(r => String(r.productId?._id || r.productId) === String(form.productId) && r._id !== editingId)
            .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
        : [];

    const Detail = ({ label, children }) => (
        <div className="min-w-0">
            <div className="text-[11px] font-bold text-slate-400 uppercase">{label}</div>
            <div className="text-sm font-semibold text-slate-700 break-words">{children || '—'}</div>
        </div>
    );

    if (formOpen) {
        return (
            <div className="space-y-6 min-w-0">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <button type="button" onClick={closeForm} aria-label="Back to type test register" className="w-10 h-10 flex items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-teal-50 hover:text-teal-700 transition">
                            <MdArrowBack size={20} />
                        </button>
                        <div>
                            <h1 className="text-2xl font-black text-slate-900 tracking-tight">{editingId ? 'Edit Type Test Record' : 'New Type Test Record'}</h1>
                            <p className="text-xs text-slate-500 font-semibold">Fields marked * are required.</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button type="button" className={SECONDARY} onClick={closeForm}>Cancel</button>
                        <button type="submit" form="type-test-form" disabled={saving} className={PRIMARY}>{saving ? 'Saving...' : 'Save record'}</button>
                    </div>
                </div>

                <div className={PANEL}>
                    <form id="type-test-form" onSubmit={saveTest}>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                            <Field label="Product *">
                                <ProductPicker label={form.productLabel} tooltip={form.productId ? (form.productMgr4 || 'Not set') : ''} onChange={(id, label, mgr4) => setForm(prev => ({ ...prev, productId: id, productLabel: label, productMgr4: mgr4 }))} />
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
                            <Field label="Reminder lead time (days before expiry)">
                                <ChoiceGroup
                                    name="reminderLeadDays"
                                    options={LEAD_DAY_OPTIONS.map(d => ({ value: d, label: `${d} days` }))}
                                    value={form.reminderLeadDays}
                                    onChange={v => setField('reminderLeadDays', v)}
                                />
                            </Field>
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
                </div>

                {form.productId && (
                    <div className={PANEL}>
                        <h2 className="text-sm font-black text-slate-800 uppercase tracking-wide mb-1">
                            Previous test records for this product ({previousRecords.length})
                        </h2>
                        <p className={`${muted} mb-4`}>{form.productLabel}</p>
                        {previousRecords.length ? (
                            <div className="space-y-4">
                                {previousRecords.map(r => {
                                    const c = r.currentCertificate || {};
                                    return (
                                        <div key={r._id} className="border border-slate-100 rounded-xl p-4 bg-slate-50/50">
                                            <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
                                                <div>
                                                    <div className="text-base font-bold text-slate-900">{r.testName}</div>
                                                    <div className={muted}>Recorded {fmt(r.createdAt)}{r.isActive ? '' : ' · Inactive'}</div>
                                                </div>
                                                <div className="flex gap-1.5"><Badge value={r.displayStatus} /><Badge value={r.testResult} /></div>
                                            </div>
                                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                                                <Detail label="Model">{r.modelName}</Detail>
                                                <Detail label="Applicable standard">{r.testStandard}</Detail>
                                                <Detail label="Testing laboratory">{r.testingAgency}</Detail>
                                                <Detail label="Test start date">{r.testStartDate && fmt(r.testStartDate)}</Detail>
                                                <Detail label="Test completion date">{c.testCompletionDate && fmt(c.testCompletionDate)}</Detail>
                                                <Detail label="Certificate number">{c.certificateNo}</Detail>
                                                <Detail label="Certificate issue date">{c.issueDate && fmt(c.issueDate)}</Detail>
                                                <Detail label="Valid until">{c.validUntil && fmt(c.validUntil)}</Detail>
                                                <Detail label="Renewal owner">{r.ownerId?.name}</Detail>
                                                <Detail label="Backup owner">{r.backupOwnerId?.name}</Detail>
                                                <Detail label="Renewal status">{r.renewalState}</Detail>
                                                <Detail label="Next action">{r.nextAction ? `${r.nextAction}${r.nextActionDate ? ` (${fmt(r.nextActionDate)})` : ''}` : ''}</Detail>
                                                <Detail label="Certificate document">
                                                    {c.documentUrl && <a href={resolveImageUrl(c.documentUrl)} target="_blank" rel="noopener noreferrer" className="text-teal-700 font-bold hover:underline">View certificate</a>}
                                                </Detail>
                                                <Detail label="Earlier certificates">{r.certificateHistory?.length ? `${r.certificateHistory.length} closed` : 'None'}</Detail>
                                            </div>
                                            {r.remarks && <div className="mt-3"><Detail label="Remarks"><span className="whitespace-pre-line">{r.remarks}</span></Detail></div>}
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <p className={muted}>No earlier test records for this product. This will be its first.</p>
                        )}
                    </div>
                )}
            </div>
        );
    }

    const screenHeader = (title, subtitle, onBack, actions) => (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
                <button type="button" onClick={onBack} aria-label="Back to type test register" className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-teal-50 hover:text-teal-700 transition">
                    <MdArrowBack size={20} />
                </button>
                <div className="min-w-0">
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight">{title}</h1>
                    <p className="text-xs text-slate-500 font-semibold">{subtitle}</p>
                </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">{actions}</div>
        </div>
    );

    if (renewalRecord) {
        const c = renewalRecord.currentCertificate || {};
        return (
            <div className="space-y-6 min-w-0">
                {screenHeader(
                    'Update Renewal Progress',
                    `${productName(renewalRecord)} · ${renewalRecord.modelName || '—'} · ${renewalRecord.testName}`,
                    closeRenewal,
                    <>
                        <button type="button" className={SECONDARY} onClick={closeRenewal}>Cancel</button>
                        <button type="submit" form="type-test-renewal-form" disabled={saving} className={PRIMARY}>{saving ? 'Saving...' : 'Save renewal'}</button>
                    </>
                )}

                <div className={PANEL}>
                    <div className="flex flex-wrap items-start justify-between gap-2 mb-4">
                        <h2 className="text-sm font-black text-slate-800 uppercase tracking-wide">Current certificate</h2>
                        <div className="flex gap-1.5"><Badge value={renewalRecord.displayStatus} /><Badge value={renewalRecord.renewalState} /></div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                        <Detail label="Product">
                            <Tooltip content={<Mgr4Tip value={mgr4Text(renewalRecord.productId)} />}><span className="cursor-help">{productName(renewalRecord)}</span></Tooltip>
                        </Detail>
                        <Detail label="Certificate number">{c.certificateNo || 'None'}</Detail>
                        <Detail label="Valid until">{c.validUntil ? `${fmt(c.validUntil)} (${expiryNote(renewalRecord)})` : ''}</Detail>
                        <Detail label="Owner / backup">{`${renewalRecord.ownerId?.name || '—'} / ${renewalRecord.backupOwnerId?.name || '—'}`}</Detail>
                        <Detail label="Next action">{renewalRecord.nextAction ? `${renewalRecord.nextAction}${renewalRecord.nextActionDate ? ` (${fmt(renewalRecord.nextActionDate)})` : ''}` : ''}</Detail>
                    </div>
                </div>

                <div className={PANEL}>
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
                </div>
            </div>
        );
    }

    if (historyRecord) {
        const h = historyRecord;
        return (
            <div className="space-y-6 min-w-0">
                {screenHeader(
                    'Type Test History',
                    `${h.productId?.productCode || ''} / ${h.modelName || '—'} · ${h.testName}${h.testStandard ? ` · ${h.testStandard}` : ''}`,
                    closeHistory,
                    <>
                        <button className={SECONDARY} onClick={() => toggleRecordActive(h)}>{h.isActive ? 'Mark inactive' : 'Reactivate'}</button>
                        <button className="px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 text-sm font-black rounded-xl" onClick={() => deleteRecord(h)}>Delete</button>
                        <button className={SECONDARY} onClick={() => openTestPage(h)}>Edit record</button>
                        <button className={PRIMARY} onClick={() => openRenewalPage(h)}>Update renewal</button>
                    </>
                )}

                <div className={PANEL}>
                    <div className="flex flex-wrap justify-between gap-2">
                        <Tooltip content={<Mgr4Tip value={mgr4Text(h.productId)} />}>
                            <span className="text-base font-bold text-slate-900 cursor-help">{productName(h)}</span>
                        </Tooltip>
                        <div className="flex gap-1.5 items-start"><Badge value={h.displayStatus} /><Badge value={h.renewalState} /></div>
                    </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-[1fr_1.4fr] gap-4">
                    <div className={PANEL}>
                        <h2 className="text-sm font-black text-slate-800 uppercase tracking-wide mb-3">Reminders ({(h.reminderLeadDays || []).join(', ')} days before expiry)</h2>
                        {h.reminders?.length ? h.reminders.map(rem => (
                            <div key={rem.leadDays} className="flex justify-between py-1.5 border-b border-slate-100 text-sm">
                                <span>{rem.leadDays} day milestone · {fmt(rem.remindOn)}</span>
                                <span className={rem.sentAt ? 'text-green-700' : 'text-slate-500'}>{rem.sentAt ? `Sent ${fmt(rem.sentAt)}` : h.isActive ? 'Scheduled' : 'Paused'}</span>
                            </div>
                        )) : <p className={muted}>Reminders start once a certificate with a valid until date is recorded.</p>}
                    </div>

                    <div className={PANEL}>
                        <h2 className="text-sm font-black text-slate-800 uppercase tracking-wide mb-3">Certificates</h2>
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[520px] border-collapse">
                                <thead><tr><th className={TH}>Certificate</th><th className={TH}>Issued</th><th className={TH}>Valid until</th><th className={TH}>State</th></tr></thead>
                                <tbody>
                                    {h.currentCertificate?.certificateNo && (
                                        <tr>
                                            <td className={TD}>{h.currentCertificate.certificateNo}{h.currentCertificate.documentUrl && <> · <a href={resolveImageUrl(h.currentCertificate.documentUrl)} target="_blank" rel="noopener noreferrer" className="text-teal-700 font-bold hover:underline">View file</a></>}</td>
                                            <td className={TD}>{fmt(h.currentCertificate.issueDate || h.currentCertificate.testCompletionDate)}</td>
                                            <td className={TD}>{fmt(h.currentCertificate.validUntil)}</td>
                                            <td className={TD}><Badge value="Active" /></td>
                                        </tr>
                                    )}
                                    {[...(h.certificateHistory || [])].reverse().map(old => (
                                        <tr key={old._id}>
                                            <td className={TD}>{old.certificateNo || '—'}{old.documentUrl && <> · <a href={resolveImageUrl(old.documentUrl)} target="_blank" rel="noopener noreferrer" className="text-teal-700 font-bold hover:underline">View file</a></>}</td>
                                            <td className={TD}>{fmt(old.issueDate || old.testCompletionDate)}</td>
                                            <td className={TD}>{fmt(old.validUntil)}</td>
                                            <td className={TD}><span className="text-slate-500">Closed {fmt(old.closedAt)}{old.closedBy?.name ? ` by ${old.closedBy.name}` : ''}</span></td>
                                        </tr>
                                    ))}
                                    {!h.currentCertificate?.certificateNo && !h.certificateHistory?.length && <Empty cols={4}>No certificates recorded yet.</Empty>}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <div className={PANEL}>
                    <h2 className="text-sm font-black text-slate-800 uppercase tracking-wide mb-3">Progress log</h2>
                    <div className="space-y-3 pl-3 border-l-2 border-teal-100 text-sm">
                        {[...(h.activities || [])].reverse().map((a, i) => (
                            <div key={i}>
                                <div className="flex justify-between text-[11px] font-semibold text-slate-400"><span>{a.userName}</span><span>{formatDateTime(a.timestamp)}</span></div>
                                <div className="text-slate-800">{a.action}</div>
                                {a.note && <div className="text-slate-500 whitespace-pre-line">{a.note}</div>}
                            </div>
                        ))}
                        {!h.activities?.length && <p className={muted}>No activity recorded yet.</p>}
                    </div>
                </div>
            </div>
        );
    }

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
                    <button className={PRIMARY} onClick={() => openTestPage()}><MdAdd size={20} /> New Test Record</button>
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
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-6">
                                        {dashboardCards.map(m => (
                                            <button
                                                key={m.key}
                                                type="button"
                                                aria-pressed={m.go ? undefined : dashFilter === m.key}
                                                onClick={() => (m.go ? m.go() : toggleDashFilter(m.key))}
                                                className={`relative overflow-hidden text-left bg-white border rounded-2xl px-4 py-3.5 shadow-sm flex items-center justify-between gap-3 hover:-translate-y-0.5 hover:shadow-md transition-all active:scale-[0.98] group ${dashFilter === m.key ? 'border-teal-500 ring-2 ring-teal-500/30' : 'border-slate-200/80'}`}
                                            >
                                                <span className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${m.color}`} />
                                                <div className="min-w-0">
                                                    <span className="block whitespace-nowrap truncate text-[11px] font-black uppercase text-slate-500 tracking-wider group-hover:text-slate-700">{m.label}</span>
                                                    <span className="block text-3xl font-black text-slate-900 leading-tight tabular-nums">{m.rows.length}</span>
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
                                            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                                                <h2 className="text-sm font-black text-slate-800 uppercase tracking-wide">
                                                    {dashSelection ? `${dashSelection.label} (${dashSelection.rows.length})` : 'Upcoming renewals'}
                                                </h2>
                                                {dashSelection && <button type="button" className={SMALL} onClick={() => setDashFilter('')}>Show all</button>}
                                            </div>
                                            <div className="overflow-x-auto">
                                                <table className="w-full min-w-[640px] border-collapse">
                                                    <thead><tr><th className={TH}>Product / Model</th><th className={TH}>Certificate</th><th className={TH}>Valid until</th><th className={TH}>Owner</th><th className={TH}>Test status</th><th className={TH}>Renewal</th><th className={TH}></th></tr></thead>
                                                    <tbody>
                                                        {dashRows.length ? dashRows.map(r => (
                                                            <tr key={r._id}>
                                                                <ProductCell r={r} sub={`${r.modelName || '—'} · ${r.testName}`} />
                                                                <td className={TDN}>{r.currentCertificate?.certificateNo || '—'}</td>
                                                                <td className={TDN}>{fmt(r.currentCertificate?.validUntil)}{hasExpiry(r) && <><br /><span className={muted}>{expiryNote(r)}</span></>}</td>
                                                                <td className={TDN}>{r.ownerId?.name || '—'}</td>
                                                                <td className={TDN}><Badge value={r.displayStatus} /></td>
                                                                <td className={TDN}><Badge value={r.renewalState} /></td>
                                                                <td className={TD}><button className={SMALL} onClick={() => openHistoryPage(r)}>History</button></td>
                                                            </tr>
                                                        )) : <Empty cols={7}>{dashSelection ? 'No records in this category.' : 'No upcoming renewals.'}</Empty>}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                        <div className={PANEL}>
                                            <h2 className="text-sm font-black text-slate-800 uppercase tracking-wide mb-2">Testing pipeline</h2>
                                            {pipeline.map(({ key, label: s, rows }) => {
                                                const n = rows.length;
                                                const width = activeRecords.length ? Math.min(100, (n / activeRecords.length) * 100) : 0;
                                                const color = s === 'Valid' ? 'bg-emerald-500' : s === 'Expired' ? 'bg-rose-500' : s === 'In Progress' ? 'bg-sky-500' : s === 'Not Started' ? 'bg-slate-400' : 'bg-amber-500';
                                                return (
                                                    <button
                                                        key={key}
                                                        type="button"
                                                        aria-pressed={dashFilter === key}
                                                        onClick={() => toggleDashFilter(key)}
                                                        className={`block w-full text-left my-1.5 px-2 py-2 rounded-lg transition ${dashFilter === key ? 'bg-teal-50 ring-1 ring-teal-200' : 'hover:bg-slate-50'}`}
                                                    >
                                                        <div className="flex justify-between text-[13px] mb-1.5"><span>{s}</span><b>{n}</b></div>
                                                        <div className="h-[7px] bg-slate-100 rounded-full overflow-hidden"><div className={`h-full ${color}`} style={{ width: `${width}%` }} /></div>
                                                    </button>
                                                );
                                            })}
                                            <p className={muted}>Counts exclude inactive products.</p>
                                        </div>
                                    </div>

                                    <div className={`${PANEL} mt-4`}>
                                        <h2 className="text-sm font-black text-slate-800 uppercase tracking-wide mb-4">Quick actions</h2>
                                        <div className="flex flex-wrap gap-2">
                                            <button className={PRIMARY} onClick={() => openTestPage()}>Create test record</button>
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
                                                                    <button className={SMALL} onClick={() => openTestPage(r)}>Edit</button>
                                                                    <button className={SMALL} onClick={() => openRenewalPage(r)}>Renewal</button>
                                                                    <button className={SMALL} onClick={() => openHistoryPage(r)}>History</button>
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
                                                            <td className={TD}><Tooltip content={<Mgr4Tip value={mgr4Text(g.product)} />}><b className="cursor-help">{g.product.productName || 'Unknown product'}</b></Tooltip></td>
                                                            <td className={TDN}>{g.modelName || '—'}</td>
                                                            <td className={TD}>{g.records.map(r => r.testName).join(', ')}</td>
                                                            <td className={TDN}>{g.owners || '—'}</td>
                                                            <td className={TDN}><Badge value={g.status} /></td>
                                                            <td className={TD}>
                                                                <div className="flex flex-nowrap gap-1.5">
                                                                    <button
                                                                        className={SMALL}
                                                                        onClick={() => openTestPage(null, { productId: g.product._id, productLabel: productText(g.product), productMgr4: mgr4Text(g.product), modelName: g.modelName })}
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

                            {page === 'pending' && (
                                <section>
                                    {headingRow(
                                        'Pending Records',
                                        'Products marked "Applicable for Test Type" in Product Master that have not been tested yet. A product leaves this list once its testing is completed.',
                                        <button className={SECONDARY} onClick={loadPending}>Refresh</button>
                                    )}
                                    <div className={PANEL}>
                                        <div className="flex flex-wrap gap-2.5 mb-4">
                                            <input value={pendingSearch} onChange={e => setPendingSearch(e.target.value)} placeholder="Search product code or name..." className={`${INPUT} flex-1 min-w-[160px]`} />
                                        </div>
                                        <div className="overflow-x-auto">
                                            <table className="w-full min-w-[720px] border-collapse">
                                                <thead><tr><th className={TH}>Product code</th><th className={TH}>Product name</th><th className={TH}>MGR4 FG</th><th className={TH}>Stage</th><th className={TH}>Open test records</th><th className={TH}>Action</th></tr></thead>
                                                <tbody>
                                                    {(() => {
                                                        const q = pendingSearch.toLowerCase();
                                                        const rows = pending.filter(item => [item.product.productCode, item.product.productName].join(' ').toLowerCase().includes(q));
                                                        if (!rows.length) return <Empty cols={6}>{pending.length ? 'No matching products.' : 'No pending products. Every applicable product has been tested.'}</Empty>;
                                                        return rows.map(item => (
                                                            <tr key={item.product._id}>
                                                                <td className={TDN}>{item.product.productCode || '—'}</td>
                                                                <td className={TD}><Tooltip content={<Mgr4Tip value={mgr4Text(item.product)} />}><b className="text-slate-900 cursor-help">{item.product.productName}</b></Tooltip></td>
                                                                <td className={TD}>{mgr4Text(item.product)}</td>
                                                                <td className={TDN}><Badge value={item.stage} /></td>
                                                                <td className={TD}>{item.records.length ? item.records.map(r => `${r.testName} (${r.status})`).join(', ') : <span className={muted}>None</span>}</td>
                                                                <td className={TD}>
                                                                    <button
                                                                        className={SMALL}
                                                                        onClick={() => openTestPage(null, { productId: item.product._id, productLabel: productText(item.product), productMgr4: mgr4Text(item.product) })}
                                                                    >Add test</button>
                                                                </td>
                                                            </tr>
                                                        ));
                                                    })()}
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
                                                            <td className={TD}><button className={SMALL} onClick={() => openRenewalPage(r)}>Update</button></td>
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

        </div>
    );
};

export default TypeTestRegister;
