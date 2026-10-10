import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { MdSearch, MdSwapHoriz, MdVisibility, MdArrowBack, MdPersonAdd, MdHistory, MdCheckCircle } from 'react-icons/md';
import { toast } from 'react-toastify';
import { serialTransferService, customerService, csmService } from '../services/api';
import AssetActivityLog from '../components/AssetActivityLog';
import PaginationControls from '../components/PaginationControls';
import Customers from './Customers';

const PAGE_SIZE = 20;
const TABS = [
    { key: 'serials', label: 'Serial No List' },
    { key: 'history', label: 'Transfer History' },
];

const formatDate = (value) => (value ? new Date(value).toLocaleDateString('en-IN') : '-');
const todayInput = () => {
    const now = new Date();
    return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};
const customerTitle = (customer) => customer?.companyName || customer?.customerName || '';

const inputClass = 'w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 outline-none text-sm font-medium';
const thClass = 'p-4 text-xs font-black text-slate-400 uppercase tracking-widest whitespace-nowrap';

const FlagBadge = ({ active }) => (
    <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${active ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
        {active ? 'Active' : 'Inactive'}
    </span>
);

const TYPE_STYLES = { Transferred: 'bg-amber-50 text-amber-600', 'Past Entry': 'bg-violet-50 text-violet-600' };

const TypeBadge = ({ type }) => (
    <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest whitespace-nowrap ${TYPE_STYLES[type] || 'bg-sky-50 text-sky-600'}`}>
        {type}
    </span>
);

const CustomerCell = ({ entry }) => (
    <div>
        <p className="font-bold text-slate-800">{entry.companyName || entry.customerName || '-'}</p>
        <p className="text-xs text-slate-500">
            {[entry.customerCode, entry.customerMobile, [entry.customerCity, entry.customerState].filter(Boolean).join(', ')].filter(Boolean).join(' · ')}
        </p>
    </div>
);

// Debounced list loader shared by both tabs: rows are "loading" until they belong to the current request.
const useList = (load, params) => {
    const requestKey = JSON.stringify(params);
    const [state, setState] = useState({ key: null, rows: [], pagination: { page: 1, limit: PAGE_SIZE, total: 0, pages: 1 } });

    useEffect(() => {
        let cancelled = false;
        load(JSON.parse(requestKey))
            .then((res) => {
                if (!cancelled) setState({ key: requestKey, rows: res.data?.data || [], pagination: res.data?.pagination || state.pagination });
            })
            .catch((err) => {
                if (cancelled) return;
                toast.error(err.response?.data?.message || 'Failed to load');
                setState((prev) => ({ ...prev, key: requestKey }));
            });
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [requestKey]);

    return { ...state, loading: state.key !== requestKey };
};

// Search and filters survive opening a serial and coming back (per browser tab only).
const useStoredState = (key, initial) => {
    const [value, setValue] = useState(() => {
        try {
            const stored = sessionStorage.getItem(`serialTransfer.${key}`);
            return stored === null ? initial : JSON.parse(stored);
        } catch {
            return initial;
        }
    });
    const update = (next) => {
        setValue(next);
        try { sessionStorage.setItem(`serialTransfer.${key}`, JSON.stringify(next)); } catch { /* storage unavailable */ }
    };
    return [value, update];
};

const useDebounced = (value, delay = 300) => {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const timer = setTimeout(() => setDebounced(value), delay);
        return () => clearTimeout(timer);
    }, [value, delay]);
    return debounced;
};

const SerialListTab = ({ onOpen, onTransfer }) => {
    const [search, setSearch] = useStoredState('list.search', '');
    const [field, setField] = useStoredState('list.field', '');
    const [status, setStatus] = useStoredState('list.status', '');
    const [page, setPage] = useStoredState('list.page', 1);
    const debouncedSearch = useDebounced(search.trim());

    const { rows, pagination, loading } = useList(serialTransferService.listSerials, {
        page, limit: PAGE_SIZE, search: debouncedSearch || undefined, field: field || undefined, status: status || undefined,
    });
    const offset = (pagination.page - 1) * pagination.limit;

    return (
        <>
            <div className="p-4 border-b border-slate-100 bg-slate-50 flex flex-wrap items-center gap-3">
                <div className="relative w-full max-w-md">
                    <MdSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                        placeholder={field === 'serial' ? 'Search serial number' : field === 'product' ? 'Search product code or name' : field === 'customer' ? 'Search customer name or code' : 'Search serial no, product or customer'}
                        className={`${inputClass} pl-11`}
                    />
                </div>
                <select value={field} onChange={(e) => { setField(e.target.value); setPage(1); }} className={`${inputClass} w-auto font-semibold`}>
                    <option value="">All fields</option>
                    <option value="serial">Serial No</option>
                    <option value="product">Product</option>
                    <option value="customer">Customer</option>
                </select>
                <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className={`${inputClass} w-auto font-semibold`}>
                    <option value="">All statuses</option>
                    <option value="Sold">Sold (with first customer)</option>
                    <option value="Transferred">Transferred</option>
                </select>
            </div>
            <div className="p-6">
                {loading ? <Spinner /> : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50">
                                        {['Sr No', 'Serial No', 'Product', 'Current Customer', 'Sale Date', 'Transfers', 'Status'].map((label) => (
                                            <th key={label} className={thClass}>{label}</th>
                                        ))}
                                        <th className={`${thClass} text-right`}>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map((row, index) => (
                                        <tr key={row._id} onClick={() => onOpen(row._id)} className="cursor-pointer border-b last:border-0 border-slate-50 hover:bg-slate-50/50 transition-colors text-sm">
                                            <td className="p-4 font-bold text-slate-400">{offset + index + 1}</td>
                                            <td className="p-4 font-bold text-slate-800 whitespace-nowrap">{row.serialNumber}</td>
                                            <td className="p-4 text-slate-600">
                                                <span className="font-bold text-slate-700">{row.productCode}</span>
                                                {row.productName && <span className="block text-xs text-slate-500">{row.productName}</span>}
                                            </td>
                                            <td className="p-4">
                                                <span className="font-bold text-slate-700">{row.customerName || '-'}</span>
                                                {row.customerCode && <span className="block text-xs text-slate-500">{row.customerCode}</span>}
                                            </td>
                                            <td className="p-4 text-slate-500 whitespace-nowrap">{formatDate(row.saleDate)}</td>
                                            <td className="p-4 font-bold text-slate-700">{row.transfers}</td>
                                            <td className="p-4"><TypeBadge type={row.status} /></td>
                                            <td className="p-4 text-right whitespace-nowrap">
                                                <button type="button" title="View history" onClick={(e) => { e.stopPropagation(); onOpen(row._id); }} className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg transition-all">
                                                    <MdVisibility size={18} />
                                                </button>
                                                <button type="button" onClick={(e) => { e.stopPropagation(); onTransfer(row._id); }} className="ml-1 inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-slate-200 text-slate-600 font-black uppercase text-[10px] tracking-widest hover:bg-slate-50 transition-all">
                                                    <MdSwapHoriz size={16} /> Transfer
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {!rows.length && (
                                        <tr><td colSpan={8} className="p-8 text-center text-slate-400 text-sm font-medium">No sold serial numbers match.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                        <PaginationControls pagination={pagination} onPageChange={setPage} />
                    </>
                )}
            </div>
        </>
    );
};

const HistoryTab = ({ onOpen }) => {
    const [search, setSearch] = useStoredState('history.search', '');
    const [flag, setFlag] = useStoredState('history.flag', '');
    const [entryType, setEntryType] = useStoredState('history.entryType', '');
    const [page, setPage] = useStoredState('history.page', 1);
    const debouncedSearch = useDebounced(search.trim());

    const { rows, pagination, loading } = useList(serialTransferService.listHistory, {
        page, limit: PAGE_SIZE, search: debouncedSearch || undefined, flag: flag || undefined, entryType: entryType || undefined,
    });

    return (
        <>
            <div className="p-4 border-b border-slate-100 bg-slate-50 flex flex-wrap items-center gap-3">
                <div className="relative w-full max-w-md">
                    <MdSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                        placeholder="Search serial no, product or customer"
                        className={`${inputClass} pl-11`}
                    />
                </div>
                <select value={entryType} onChange={(e) => { setEntryType(e.target.value); setPage(1); }} className={`${inputClass} w-auto font-semibold`}>
                    <option value="">All entries</option>
                    <option value="Sold">Sold</option>
                    <option value="Transferred">Transferred</option>
                    <option value="Past Entry">Past Entry</option>
                </select>
                <select value={flag} onChange={(e) => { setFlag(e.target.value); setPage(1); }} className={`${inputClass} w-auto font-semibold`}>
                    <option value="">Active and inactive</option>
                    <option value="Active">Active (current customer)</option>
                    <option value="Inactive">Inactive (previous customers)</option>
                </select>
            </div>
            <div className="p-6">
                {loading ? <Spinner /> : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50">
                                        {['Date', 'Serial No', 'Product', 'Customer', 'Status', 'Flag', 'Remarks', 'Recorded By'].map((label) => (
                                            <th key={label} className={thClass}>{label}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map((entry) => (
                                        <tr key={entry._id} onClick={() => onOpen(entry.assetId)} className="cursor-pointer border-b last:border-0 border-slate-50 hover:bg-slate-50/50 transition-colors text-sm">
                                            <td className="p-4 text-slate-500 whitespace-nowrap">{formatDate(entry.transferDate)}</td>
                                            <td className="p-4 font-bold text-slate-800 whitespace-nowrap">{entry.serialNumber}</td>
                                            <td className="p-4 text-slate-600">
                                                <span className="font-bold text-slate-700">{entry.productCode}</span>
                                                {entry.productName && <span className="block text-xs text-slate-500">{entry.productName}</span>}
                                            </td>
                                            <td className="p-4"><CustomerCell entry={entry} /></td>
                                            <td className="p-4"><TypeBadge type={entry.entryType} /></td>
                                            <td className="p-4"><FlagBadge active={entry.isActive} /></td>
                                            <td className="p-4 text-slate-500 min-w-[10rem]">{entry.remarks || (entry.entryType === 'Sold' && entry.invoiceNumber ? `Invoice ${entry.invoiceNumber}` : '-')}</td>
                                            <td className="p-4 text-slate-500 whitespace-nowrap">
                                                {entry.createdByName || '-'}
                                                <span className="block text-xs">{formatDate(entry.createdAt)}</span>
                                            </td>
                                        </tr>
                                    ))}
                                    {!rows.length && (
                                        <tr>
                                            <td colSpan={8} className="p-8 text-center text-slate-400 text-sm font-medium">
                                                {debouncedSearch || flag || entryType ? 'No history records match.' : 'No transfers recorded yet. Transfer a serial number from the Serial No List.'}
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
    );
};

const Spinner = () => (
    <div className="py-20 text-center text-slate-400 font-medium">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-primary-500 border-t-transparent mb-4"></div>
        <p className="text-xs uppercase font-black tracking-widest">Loading...</p>
    </div>
);

// One serial number as a page (/serial-no-transfer/:assetId, or .../transfer to open the form):
// the current customer, the transfer form in place, the date-wise sale history and the customer
// activity log. After a save the page stays put and both tables reload.
export const SerialNoDetails = ({ transfer = false }) => {
    const { assetId } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const [result, setResult] = useState({ id: null, data: null, error: '' });
    // Open form: 'transfer' (new current customer) or 'past' (an earlier customer, inactive).
    const [formMode, setFormMode] = useState(transfer ? 'transfer' : null);
    const [refreshCount, setRefreshCount] = useState(0);
    // Back returns to wherever the page was opened from (list filters, history tab), else the list.
    const goBack = () => (location.key !== 'default' ? navigate(-1) : navigate('/serial-no-transfer'));

    useEffect(() => {
        let cancelled = false;
        serialTransferService.getSerial(assetId)
            .then((res) => { if (!cancelled) setResult({ id: assetId, data: res.data, error: '' }); })
            .catch((err) => { if (!cancelled) setResult({ id: assetId, data: null, error: err.response?.data?.message || 'Failed to load the serial number' }); });
        return () => { cancelled = true; };
    }, [assetId]);

    const loading = result.id !== assetId;
    const { data, error } = result;

    // Customer entries of the serial's common activity log (the same records Asset Lifecycle Detail shows).
    const serialNumber = data?.asset?.serialNumber || '';
    const activityKey = `${serialNumber}|${refreshCount}`;
    const [activity, setActivity] = useState({ key: null, rows: [] });
    useEffect(() => {
        if (!serialNumber) return undefined;
        let cancelled = false;
        csmService.getAssetActivity(serialNumber)
            .then((res) => { if (!cancelled) setActivity({ key: activityKey, rows: res.data?.activity || [] }); })
            .catch(() => { if (!cancelled) setActivity({ key: activityKey, rows: [] }); });
        return () => { cancelled = true; };
    }, [serialNumber, activityKey]);

    const handleSaved = (updated) => {
        setResult({ id: assetId, data: updated, error: '' });
        setFormMode(null);
        setRefreshCount((count) => count + 1);
        if (transfer) navigate(`/serial-no-transfer/${assetId}`, { replace: true });
    };

    const history = data ? [...data.history].reverse() : [];
    const current = history.find((entry) => entry.isActive);
    const label = 'block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1';

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-4 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                <button
                    type="button"
                    onClick={goBack}
                    className="p-3 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-2xl transition-all border border-slate-200"
                >
                    <MdArrowBack size={20} />
                </button>
                <div className="min-w-0 flex-1">
                    <h1 className="text-xl font-black text-slate-900">
                        Serial No Transfer
                        {data && <span className="ml-2 text-primary-600">{data.asset.serialNumber}</span>}
                    </h1>
                    {data && (
                        <p className="mt-0.5 text-xs font-medium text-slate-500">
                            {data.asset.productCode}{data.asset.productName ? ` · ${data.asset.productName}` : ''}
                        </p>
                    )}
                </div>
                {data && !formMode && (
                    <div className="flex flex-wrap gap-3">
                        <button
                            type="button"
                            onClick={() => setFormMode('past')}
                            className="flex items-center gap-2 px-5 py-3 rounded-2xl border border-slate-200 bg-white text-slate-600 font-black uppercase text-xs tracking-widest hover:bg-slate-50 transition-all"
                        >
                            <MdHistory size={18} /> Add Past Entry
                        </button>
                        <button
                            type="button"
                            onClick={() => setFormMode('transfer')}
                            className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-2xl font-black transition-all shadow-xl shadow-primary-600/20 uppercase text-xs tracking-widest active:scale-95"
                        >
                            <MdSwapHoriz size={18} /> Transfer Serial No
                        </button>
                    </div>
                )}
            </div>

            {loading ? <Spinner /> : error ? (
                <p className="rounded-3xl bg-white p-8 text-center text-sm font-medium text-rose-500">{error}</p>
            ) : (
                <>
                    <div className="rounded-3xl border border-slate-100 bg-white shadow-sm">
                        {formMode ? (
                            <TransferForm
                                key={formMode}
                                mode={formMode}
                                data={data}
                                currentSince={current?.transferDate || data.asset.saleDate}
                                onCancel={() => (transfer ? goBack() : setFormMode(null))}
                                onSaved={handleSaved}
                            />
                        ) : (
                            <div className="grid grid-cols-1 gap-6 p-6 md:grid-cols-4">
                                <div><span className={label}>Serial Number</span><p className="text-sm font-bold text-slate-800">{data.asset.serialNumber}</p></div>
                                <div><span className={label}>Product</span><p className="text-sm font-bold text-slate-800">{data.asset.productCode}</p><p className="text-xs text-slate-500">{data.asset.productName}</p></div>
                                <div>
                                    <span className={label}>Current Customer</span>
                                    <p className="text-sm font-bold text-slate-800">{current?.companyName || data.asset.customerName || '-'}</p>
                                    <p className="text-xs text-slate-500">{[current?.customerCode || data.asset.customerCode, current?.customerMobile, current?.customerCity].filter(Boolean).join(' · ')}</p>
                                </div>
                                <div><span className={label}>Since</span><p className="text-sm font-bold text-slate-800">{formatDate(current?.transferDate || data.asset.saleDate)}</p></div>
                            </div>
                        )}
                    </div>

                    <div className="rounded-3xl border border-slate-100 bg-white shadow-sm">
                        <h3 className="flex items-center gap-2 border-b border-slate-100 px-6 py-4 text-xs font-black uppercase tracking-widest text-slate-500">
                            <MdHistory size={16} /> Serial Number Sale History ({history.length})
                        </h3>
                        <div className="overflow-x-auto p-4">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50">
                                        {['Product', 'Date', 'Customer', 'Status', 'Flag', 'Remarks', 'Recorded By'].map((text) => (
                                            <th key={text} className={thClass}>{text}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {history.map((entry) => (
                                        <tr key={entry._id || 'sale'} className={`border-b last:border-0 border-slate-50 text-sm ${entry.isActive ? 'bg-emerald-50/40' : ''}`}>
                                            <td className="p-4 text-slate-600">
                                                <span className="font-bold text-slate-700">{entry.productCode}</span>
                                                {entry.productName && <span className="block text-xs text-slate-500">{entry.productName}</span>}
                                            </td>
                                            <td className="p-4 text-slate-600 whitespace-nowrap">{formatDate(entry.transferDate)}</td>
                                            <td className="p-4"><CustomerCell entry={entry} /></td>
                                            <td className="p-4"><TypeBadge type={entry.entryType} /></td>
                                            <td className="p-4"><FlagBadge active={entry.isActive} /></td>
                                            <td className="p-4 text-slate-500">{entry.remarks || (entry.invoiceNumber && entry.entryType === 'Sold' ? `Invoice ${entry.invoiceNumber}` : '-')}</td>
                                            <td className="p-4 text-slate-500 whitespace-nowrap">{entry.pending ? 'Invoice Bulk Upload' : (entry.createdByName || '-')}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <AssetActivityLog
                        variant="customer"
                        title="Customer Activity Log"
                        activity={activity.rows}
                        loading={activity.key !== activityKey}
                    />
                </>
            )}
        </div>
    );
};

const newRequestId = () => (globalThis.crypto?.randomUUID
    ? globalThis.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

// mode "transfer": the new current customer. mode "past": an earlier customer, saved as inactive
// history and dated on or before the current customer's date.
const toDateInput = (value) => {
    const date = new Date(value);
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

const TransferForm = ({ mode = 'transfer', data, currentSince, onCancel, onSaved }) => {
    const past = mode === 'past';
    const latestPastDate = currentSince ? toDateInput(currentSince) : todayInput();
    const [customerMode, setCustomerMode] = useState('existing');
    const [query, setQuery] = useState('');
    const debouncedQuery = useDebounced(query.trim());
    const [matches, setMatches] = useState({ key: null, rows: [] });
    const [customer, setCustomer] = useState(null);
    const [addingCustomer, setAddingCustomer] = useState(false);
    const [transferDate, setTransferDate] = useState(past ? '' : todayInput());
    const [remarks, setRemarks] = useState('');
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState('');
    const [requestId] = useState(newRequestId);

    useEffect(() => {
        if (!debouncedQuery) return undefined;
        let cancelled = false;
        customerService.getAll({ search: debouncedQuery, limit: 10 })
            .then((res) => {
                const payload = res.data;
                if (!cancelled) setMatches({ key: debouncedQuery, rows: Array.isArray(payload) ? payload : payload?.data || [] });
            })
            .catch(() => { if (!cancelled) setMatches({ key: debouncedQuery, rows: [] }); });
        return () => { cancelled = true; };
    }, [debouncedQuery]);

    const searching = Boolean(debouncedQuery) && matches.key !== debouncedQuery;
    const currentId = data.asset.customerId;

    const save = async (event) => {
        event.preventDefault();
        if (!customer) {
            toast.error('Select or add the new customer.');
            return;
        }
        setSaving(true);
        setSaveError('');
        try {
            const res = past
                ? await serialTransferService.addPastEntry(data.asset._id, { customerId: customer._id, entryDate: transferDate, remarks: remarks.trim(), requestId })
                : await serialTransferService.transfer(data.asset._id, { customerId: customer._id, transferDate, remarks: remarks.trim(), requestId });
            toast.success(past
                ? `Past entry for ${customerTitle(customer)} added to ${data.asset.serialNumber}`
                : `${data.asset.serialNumber} assigned to ${customerTitle(customer)}`);
            onSaved(res.data);
        } catch (err) {
            // Kept on the form so the reason stays visible.
            const message = err.response?.data?.message || (err.response ? 'Could not save the transfer.' : 'The server could not be reached. Check that the backend is running and try again.');
            setSaveError(message);
            toast.error(message);
        } finally {
            setSaving(false);
        }
    };

    // The same New Customer form as Customer Master, shown in place of the transfer form; the
    // transfer details entered so far are kept and the saved customer is selected.
    if (addingCustomer) {
        return (
            <div className="bg-slate-50 p-4 md:p-6 rounded-3xl">
                <Customers
                    isCreatePage
                    embedded
                    onCancel={() => { setAddingCustomer(false); setCustomerMode('existing'); }}
                    onSaved={(saved) => { setCustomer(saved); setAddingCustomer(false); setCustomerMode('existing'); }}
                />
            </div>
        );
    }

    const label = 'block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2';
    const readOnly = 'rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700';

    return (
        <>
        <form onSubmit={save} className="p-6 space-y-5">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div><span className={label}>Serial Number</span><p className={readOnly}>{data.asset.serialNumber}</p></div>
                <div><span className={label}>Product</span><p className={readOnly}>{data.asset.productCode}{data.asset.productName ? ` · ${data.asset.productName}` : ''}</p></div>
                <div><span className={label}>{past ? 'Current Customer (stays active)' : 'Previous Customer'}</span><p className={readOnly}>{data.asset.customerName || '-'}{data.asset.customerCode ? ` (${data.asset.customerCode})` : ''}</p></div>
            </div>

            <div>
                <span className={label}>{past ? 'Earlier Customer' : 'New Customer'} <span className="text-rose-500">*</span></span>
                {customer ? (
                    <div className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/50 px-4 py-3">
                        <div className="flex items-center gap-3">
                            <MdCheckCircle className="text-emerald-500" size={20} />
                            <div>
                                <p className="text-sm font-black text-slate-800">{customerTitle(customer)}</p>
                                <p className="text-xs text-slate-500">
                                    {[customer.externalCode, customer.mobile, customer.billingAddress?.city].filter(Boolean).join(' · ')}
                                </p>
                            </div>
                        </div>
                        <button type="button" onClick={() => setCustomer(null)} className="text-xs font-black uppercase tracking-widest text-slate-400 hover:text-slate-700">Change</button>
                    </div>
                ) : (
                    <>
                        <div className="mb-3 inline-flex rounded-2xl border border-slate-200 p-1">
                            {[['existing', 'Select Existing Customer'], ['new', 'Add New Customer']].map(([value, text]) => (
                                <button
                                    key={value}
                                    type="button"
                                    onClick={() => { setCustomerMode(value); if (value === 'new') setAddingCustomer(true); }}
                                    className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${customerMode === value ? 'bg-primary-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
                                >
                                    {text}
                                </button>
                            ))}
                        </div>
                        {customerMode === 'existing' ? (
                            <div className="relative">
                                <MdSearch className="absolute left-4 top-[1.4rem] -translate-y-1/2 text-slate-400" size={20} />
                                <input
                                    autoFocus
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    placeholder="Search Customer Master by name, code, mobile or GSTIN"
                                    className={`${inputClass} pl-11`}
                                />
                                {debouncedQuery && (
                                    <ul className="mt-2 max-h-64 overflow-auto rounded-2xl border border-slate-100 bg-white shadow-sm">
                                        {searching && <li className="px-4 py-3 text-sm text-slate-400">Searching…</li>}
                                        {!searching && matches.rows.map((c) => {
                                            // A transfer cannot go to the current customer; a past entry may name them.
                                            const isCurrent = !past && currentId && String(c._id) === String(currentId);
                                            return (
                                                <li key={c._id}>
                                                    <button
                                                        type="button"
                                                        disabled={isCurrent}
                                                        onClick={() => setCustomer(c)}
                                                        className="w-full px-4 py-3 text-left hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                                    >
                                                        <span className="block text-sm font-bold text-slate-800">{customerTitle(c)}{isCurrent ? ' (current customer)' : ''}</span>
                                                        <span className="block text-xs text-slate-500">
                                                            {[c.externalCode, c.customerName !== c.companyName ? c.customerName : '', c.mobile, c.gstin, c.billingAddress?.city].filter(Boolean).join(' · ')}
                                                        </span>
                                                    </button>
                                                </li>
                                            );
                                        })}
                                        {!searching && !matches.rows.length && (
                                            <li className="px-4 py-3 text-sm text-slate-500">
                                                No customer found.{' '}
                                                <button type="button" onClick={() => { setCustomerMode('new'); setAddingCustomer(true); }} className="font-black text-primary-600 hover:underline">Add a new customer</button>
                                            </li>
                                        )}
                                    </ul>
                                )}
                            </div>
                        ) : (
                            <button type="button" onClick={() => setAddingCustomer(true)} className="flex items-center gap-2 rounded-2xl border border-dashed border-slate-300 px-4 py-4 text-sm font-semibold text-slate-600 hover:bg-slate-50">
                                <MdPersonAdd size={20} className="text-slate-400" /> Open the New Customer form
                            </button>
                        )}
                    </>
                )}
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                    <label className={label} htmlFor="transferDate">{past ? 'Date With This Customer' : 'Transfer Date'} <span className="text-rose-500">*</span></label>
                    <input id="transferDate" type="date" required max={past ? latestPastDate : todayInput()} value={transferDate} onChange={(e) => setTransferDate(e.target.value)} className={inputClass} />
                </div>
                <div className="md:col-span-2">
                    <label className={label} htmlFor="remarks">Remarks</label>
                    <input id="remarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Optional" className={inputClass} />
                </div>
            </div>

            <p className="text-xs font-medium text-slate-500">
                {past
                    ? `A past entry records an earlier customer as Inactive history, dated on or before ${formatDate(currentSince)} (when the current customer received it). The current customer stays Active.`
                    : 'Saving keeps every earlier customer in the history as Inactive and makes the new customer the only Active one.'}
            </p>

            {saveError && (
                <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{saveError}</p>
            )}

            <div className="flex justify-end gap-3">
                <button type="button" onClick={onCancel} disabled={saving} className="px-5 py-3 rounded-2xl border border-slate-200 text-slate-600 font-black uppercase text-xs tracking-widest hover:bg-slate-50 transition-all disabled:opacity-60">
                    Cancel
                </button>
                <button type="submit" disabled={saving || !customer} className="px-6 py-3 rounded-2xl bg-primary-600 hover:bg-primary-700 text-white font-black uppercase text-xs tracking-widest transition-all disabled:opacity-60">
                    {saving ? 'Saving…' : past ? 'Save Past Entry' : 'Save Transfer'}
                </button>
            </div>
        </form>

        </>
    );
};

const SerialNoTransfer = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const tab = searchParams.get('tab') === 'history' ? 'history' : 'serials';
    const navigate = useNavigate();
    const openSerial = (assetId) => navigate(`/serial-no-transfer/${assetId}`);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-black text-slate-900 tracking-tight">Serial No Transfer</h1>
                <p className="text-slate-500 font-medium">Customer-wise ownership history of sold serial numbers. Only the latest customer of a serial is active.</p>
            </div>

            <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
                <div className="flex gap-1 border-b border-slate-100 px-4 pt-4">
                    {TABS.map((item) => (
                        <button
                            key={item.key}
                            type="button"
                            onClick={() => setSearchParams(item.key === 'history' ? { tab: 'history' } : {})}
                            className={`px-5 py-3 text-xs font-black uppercase tracking-widest border-b-2 transition-all ${tab === item.key ? 'border-primary-600 text-primary-600' : 'border-transparent text-slate-400 hover:text-slate-700'}`}
                        >
                            {item.label}
                        </button>
                    ))}
                </div>
                {tab === 'serials' ? (
                    <SerialListTab onOpen={openSerial} onTransfer={(assetId) => navigate(`/serial-no-transfer/${assetId}/transfer`)} />
                ) : (
                    <HistoryTab onOpen={openSerial} />
                )}
            </div>
        </div>
    );
};

export default SerialNoTransfer;
