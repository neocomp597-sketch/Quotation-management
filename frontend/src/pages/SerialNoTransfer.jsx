import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { MdSearch, MdSwapHoriz, MdVisibility, MdArrowBack, MdPersonAdd, MdHistory, MdCheckCircle, MdFileDownload, MdAdd, MdClose, MdArrowForward, MdStore } from 'react-icons/md';
import { toast } from 'react-toastify';
import { serialTransferService, customerService, csmService, mgrService } from '../services/api';
import AssetActivityLog from '../components/AssetActivityLog';
import PaginationControls from '../components/PaginationControls';
import Modal from '../components/Modal';
import Customers from './Customers';
import { formatDate, formatDateTime } from '../utils/helpers';
import DateInput from '../components/DateInput';
import usePermission from '../hooks/usePermission';
import { useAuth } from '../context/AuthContext';
import { MobileCard, MobileCardActions, MobileCardHead, MobileCardList, MobileEmpty, MobileField, MobileFields } from '../components/SerialMobileCards';

const PAGE_SIZE = 20;
const TABS = [
    { key: 'serials', label: 'Serial No List' },
    { key: 'history', label: 'Transfer History' },
    { key: 'activity', label: 'Customer Activity Log' },
    { key: 'branch', label: 'Branch Transfer' },
];

// Invoice Bulk Upload statuses, as its own list shows them. The Return filter also finds RETURNED.
const SERIAL_STATUSES = [
    { value: 'SOLD', label: 'Sold' },
    { value: 'IN_STOCK', label: 'In Stock' },
    { value: 'ALLOCATED', label: 'Allocated' },
    { value: 'RETURN', label: 'Return' },
    { value: 'SCRAPPED', label: 'Scrapped' },
];

const STATUS_STYLES = {
    SOLD: 'bg-blue-50 text-blue-600 border-blue-200',
    IN_STOCK: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    RETURN: 'bg-amber-50 text-amber-600 border-amber-200',
    RETURNED: 'bg-amber-50 text-amber-600 border-amber-200',
};

const StatusBadge = ({ status }) => (
    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border whitespace-nowrap ${STATUS_STYLES[status] || 'bg-slate-50 text-slate-600 border-slate-200'}`}>
        {status || 'IN_STOCK'}
    </span>
);

const StatusFilter = ({ value, onChange }) => (
    <select value={value} onChange={(e) => onChange(e.target.value)} aria-label="Filter by status" className={selectClass}>
        <option value="">All statuses</option>
        {SERIAL_STATUSES.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
    </select>
);

const todayInput = () => {
    const now = new Date();
    return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};
const customerTitle = (customer) => customer?.companyName || customer?.customerName || '';

// Field look without a width; inputs take the full width, filter dropdowns only their content's.
const fieldClass = 'px-4 py-3 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 outline-none text-sm font-medium';
const inputClass = `w-full ${fieldClass}`;
const selectClass = `w-auto max-w-[16rem] ${fieldClass} font-semibold`;
const thClass = 'p-4 text-xs font-black text-slate-400 uppercase tracking-widest whitespace-nowrap';

const FlagBadge = ({ active }) => (
    <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${active ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
        {active ? 'Active' : 'Inactive'}
    </span>
);

const TYPE_STYLES = { Transferred: 'bg-amber-50 text-amber-600', 'Past Entry': 'bg-violet-50 text-violet-600' };
// How a customer came to hold the serial. "Sold" is the invoice sale; the ownership status itself
// is the Active/Inactive flag.
const TYPE_LABELS = { Sold: 'Original Sale' };

const TypeBadge = ({ type }) => (
    <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest whitespace-nowrap ${TYPE_STYLES[type] || 'bg-sky-50 text-sky-600'}`}>
        {TYPE_LABELS[type] || type}
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

// The invoice of a history record; a transfer carries the invoice over from the sale.
const InvoiceCell = ({ entry }) => (
    entry.invoiceNumber ? (
        <div>
            <p className="font-bold text-slate-700 whitespace-nowrap">{entry.invoiceNumber}</p>
            {entry.invoiceDate && <p className="text-xs text-slate-500">{formatDate(entry.invoiceDate)}</p>}
        </div>
    ) : '-'
);

const EMPTY_PAGINATION = { page: 1, limit: PAGE_SIZE, total: 0, pages: 1 };

// Debounced list loader shared by the tabs: rows are "loading" until they belong to the current
// request. Nothing is requested while `enabled` is false (e.g. an invalid date range).
const useList = (load, params, enabled = true) => {
    const requestKey = JSON.stringify(params);
    const [state, setState] = useState({ key: null, rows: [], pagination: EMPTY_PAGINATION });

    useEffect(() => {
        if (!enabled) return undefined;
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
    }, [requestKey, enabled]);

    if (!enabled) return { rows: [], pagination: EMPTY_PAGINATION, loading: false };
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

// From Date / To Date filter of one tab (both inclusive, either may be left empty). `params` is
// what the request sends; an inverted range is reported and not sent.
const useDateRange = (prefix) => {
    const [fromDate, setFromDate] = useStoredState(`${prefix}.fromDate`, '');
    const [toDate, setToDate] = useStoredState(`${prefix}.toDate`, '');
    const invalid = Boolean(fromDate && toDate && fromDate > toDate);
    return {
        fromDate, toDate, setFromDate, setToDate, invalid,
        params: { fromDate: fromDate || undefined, toDate: toDate || undefined },
    };
};

// MGR 4 values from MGR Master, loaded once per page visit and shared by the tabs.
let mgr4Request = null;
const useMgr4Options = () => {
    const [options, setOptions] = useState([]);
    useEffect(() => {
        let cancelled = false;
        mgr4Request = mgr4Request || mgrService.getAll('MGR4')
            .then((res) => {
                const list = Array.isArray(res.data) ? res.data : res.data?.data || [];
                return list.sort((a, b) => String(a.code).localeCompare(String(b.code)));
            })
            .catch(() => { mgr4Request = null; return []; });
        mgr4Request.then((list) => { if (!cancelled) setOptions(list); });
        return () => { cancelled = true; };
    }, []);
    return options;
};

const mgrLabel = (mgr) => (mgr.description && mgr.description !== mgr.code ? `${mgr.code} - ${mgr.description}` : mgr.code);

// MGR 4 filter (Product Master MGR 4 of the serial's product); value is the MGR id.
const Mgr4Filter = ({ value, onChange }) => {
    const options = useMgr4Options();
    return (
        <select value={value} onChange={(e) => onChange(e.target.value)} aria-label="Filter by MGR 4" className={selectClass}>
            <option value="">All MGR 4</option>
            {options.map((mgr) => <option key={mgr._id} value={mgr._id}>{mgrLabel(mgr)}</option>)}
        </select>
    );
};

const DateRangeFilter = ({ range, field, onChange }) => {
    const set = (setter) => (e) => { setter(e.target.value); onChange(); };
    const dateClass = `${fieldClass} w-auto py-2.5 serial-date-input`;
    return (
        <div className="serial-date-range flex flex-wrap items-end gap-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                From Date <span className="normal-case tracking-normal font-semibold">({field})</span>
                <DateInput type="date" value={range.fromDate} onChange={set(range.setFromDate)} className={`${dateClass} mt-1 block`} />
            </label>
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                To Date
                <DateInput type="date" value={range.toDate} min={range.fromDate || undefined} onChange={set(range.setToDate)} className={`${dateClass} mt-1 block`} />
            </label>
            {(range.fromDate || range.toDate) && (
                <button
                    type="button"
                    onClick={() => { range.setFromDate(''); range.setToDate(''); onChange(); }}
                    className="px-4 py-2.5 rounded-2xl border border-slate-200 bg-white text-slate-500 font-black uppercase text-[10px] tracking-widest hover:bg-slate-50"
                >
                    Clear Dates
                </button>
            )}
            {range.invalid && (
                <p className="w-full text-xs font-semibold text-rose-600">From Date cannot be later than To Date.</p>
            )}
        </div>
    );
};

const SerialListTab = ({ onOpen, onTransfer }) => {
    const { canModify } = usePermission('master_serials');
    const [search, setSearch] = useStoredState('list.search', '');
    const [field, setField] = useStoredState('list.field', '');
    const [status, setStatus] = useStoredState('list.assetStatus', '');
    const [ownership, setOwnership] = useStoredState('list.ownership', '');
    const [page, setPage] = useStoredState('list.page', 1);
    const [mgr4, setMgr4] = useStoredState('list.mgr4', '');
    const range = useDateRange('list');
    const debouncedSearch = useDebounced(search.trim());

    const { rows, pagination, loading } = useList(serialTransferService.listSerials, {
        page, limit: PAGE_SIZE, search: debouncedSearch || undefined, field: field || undefined, status: status || undefined,
        ownership: ownership || undefined, mgr4: mgr4 || undefined, ...range.params,
    }, !range.invalid);
    const offset = (pagination.page - 1) * pagination.limit;
    // The row whose Download Customer Activity Log dialog is open.
    const [downloadFor, setDownloadFor] = useState(null);

    return (
        <>
            {downloadFor && <SerialActivityDownloadDialog serial={downloadFor} onClose={() => setDownloadFor(null)} />}
            <div className="serial-filter-bar p-4 border-b border-slate-100 bg-slate-50 flex flex-wrap items-center gap-3">
                <div className="serial-filter-wide relative w-full max-w-md">
                    <MdSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                        placeholder={field === 'serial' ? 'Search serial number' : field === 'product' ? 'Search product code or name' : field === 'customer' ? 'Search customer name or code' : 'Search serial no, product or customer'}
                        className={`${inputClass} pl-11`}
                    />
                </div>
                <select value={field} onChange={(e) => { setField(e.target.value); setPage(1); }} className={selectClass}>
                    <option value="">All fields</option>
                    <option value="serial">Serial No</option>
                    <option value="product">Product</option>
                    <option value="customer">Customer</option>
                </select>
                <StatusFilter value={status} onChange={(value) => { setStatus(value); setPage(1); }} />
                <select value={ownership} onChange={(e) => { setOwnership(e.target.value); setPage(1); }} aria-label="Filter by customer transfers" className={selectClass}>
                    <option value="">All customers</option>
                    <option value="Sold">With original customer</option>
                    <option value="Transferred">Transferred to another customer</option>
                </select>
                <Mgr4Filter value={mgr4} onChange={(value) => { setMgr4(value); setPage(1); }} />
                <DateRangeFilter range={range} field="Invoice Date" onChange={() => setPage(1)} />
            </div>
            <div className="p-3 md:p-6">
                {loading ? <Spinner /> : (
                    <>
                        <MobileCardList>
                            {rows.map((row, index) => (
                                <MobileCard key={row._id} onClick={() => onOpen(row._id)}>
                                    <MobileCardHead
                                        title={<><span className="text-slate-400 font-bold">{offset + index + 1}.</span> {row.serialNumber}</>}
                                        subtitle={[row.productCode, row.productName].filter(Boolean).join(' · ')}
                                        aside={<StatusBadge status={row.status} />}
                                    />
                                    <MobileFields>
                                        <MobileField label="Branch">{row.branchName || '-'}</MobileField>
                                        <MobileField label="Transfers">{row.transfers}</MobileField>
                                        <MobileField label="Current Customer" wide>
                                            {row.customerName || '-'}
                                            {row.customerCode && <span className="block text-xs text-slate-500">{row.customerCode}</span>}
                                        </MobileField>
                                        <MobileField label="Invoice Number">{row.invoiceNumber || '-'}</MobileField>
                                        <MobileField label="Invoice Date">{formatDate(row.saleDate)}</MobileField>
                                    </MobileFields>
                                    <MobileCardActions>
                                        <button type="button" onClick={() => onOpen(row._id)} className="inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-slate-200 bg-white text-primary-600 font-black uppercase text-[10px] tracking-widest">
                                            <MdVisibility size={16} /> View
                                        </button>
                                        <button type="button" onClick={() => setDownloadFor(row)} aria-label={`Download customer activity log of ${row.serialNumber}`} className="inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-slate-200 bg-white text-emerald-600 font-black uppercase text-[10px] tracking-widest">
                                            <MdFileDownload size={16} /> Log
                                        </button>
                                        {canModify && row.status === 'SOLD' && (
                                            <button type="button" onClick={() => onTransfer(row._id)} className="inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-600 font-black uppercase text-[10px] tracking-widest">
                                                <MdSwapHoriz size={16} /> Transfer
                                            </button>
                                        )}
                                    </MobileCardActions>
                                </MobileCard>
                            ))}
                            {!rows.length && <MobileEmpty>{range.invalid ? 'Correct the date range to see results.' : 'No serial numbers match.'}</MobileEmpty>}
                        </MobileCardList>
                        <div className="serial-desktop-table overflow-x-auto">
                            <table className="serial-list-compact w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50">
                                        {['Sr No', 'Serial No', 'Product', 'Branch', 'Current Customer', 'Invoice Number', 'Invoice Date', 'Transfers', 'Status'].map((label) => (
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
                                            <td className="p-4 font-bold text-slate-700 whitespace-nowrap">{row.branchName || '-'}</td>
                                            <td className="p-4">
                                                <span className="font-bold text-slate-700">{row.customerName || '-'}</span>
                                                {row.customerCode && <span className="block text-xs text-slate-500">{row.customerCode}</span>}
                                            </td>
                                            <td className="p-4 text-slate-600 whitespace-nowrap">{row.invoiceNumber || '-'}</td>
                                            <td className="p-4 text-slate-500 whitespace-nowrap">{formatDate(row.saleDate)}</td>
                                            <td className="p-4 font-bold text-slate-700">{row.transfers}</td>
                                            <td className="p-4"><StatusBadge status={row.status} /></td>
                                            <td className="p-4 text-right whitespace-nowrap">
                                                <button type="button" title="View history" onClick={(e) => { e.stopPropagation(); onOpen(row._id); }} className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg transition-all">
                                                    <MdVisibility size={18} />
                                                </button>
                                                <button type="button" title="Download Customer Activity Log" aria-label={`Download customer activity log of ${row.serialNumber}`} onClick={(e) => { e.stopPropagation(); setDownloadFor(row); }} className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all">
                                                    <MdFileDownload size={18} />
                                                </button>
                                                {canModify && (
                                                    <button type="button" title="Transfer to another customer" onClick={(e) => { e.stopPropagation(); onTransfer(row._id); }} className="ml-1 inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-slate-200 text-slate-600 font-black uppercase text-[10px] tracking-widest hover:bg-slate-50 transition-all">
                                                        <MdSwapHoriz size={16} /> Transfer
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                    {!rows.length && (
                                        <tr><td colSpan={10} className="p-8 text-center text-slate-400 text-sm font-medium">{range.invalid ? 'Correct the date range to see results.' : 'No serial numbers match.'}</td></tr>
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
    const [mgr4, setMgr4] = useStoredState('history.mgr4', '');
    const range = useDateRange('history');
    const debouncedSearch = useDebounced(search.trim());

    const { rows, pagination, loading } = useList(serialTransferService.listHistory, {
        page, limit: PAGE_SIZE, search: debouncedSearch || undefined, flag: flag || undefined, entryType: entryType || undefined, mgr4: mgr4 || undefined, ...range.params,
    }, !range.invalid);

    const emptyText = range.invalid ? 'Correct the date range to see results.'
        : debouncedSearch || flag || entryType || mgr4 || range.fromDate || range.toDate ? 'No history records match.'
            : 'No transfers recorded yet. Transfer a serial number from the Serial No List.';

    return (
        <>
            <div className="serial-filter-bar p-4 border-b border-slate-100 bg-slate-50 flex flex-wrap items-center gap-3">
                <div className="serial-filter-wide relative w-full max-w-md">
                    <MdSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                        placeholder="Search serial no, product or customer"
                        className={`${inputClass} pl-11`}
                    />
                </div>
                <select value={entryType} onChange={(e) => { setEntryType(e.target.value); setPage(1); }} className={selectClass}>
                    <option value="">All entries</option>
                    <option value="Sold">Original Sale</option>
                    <option value="Transferred">Transferred</option>
                    <option value="Past Entry">Past Entry</option>
                </select>
                <select value={flag} onChange={(e) => { setFlag(e.target.value); setPage(1); }} className={selectClass}>
                    <option value="">Active and inactive</option>
                    <option value="Active">Active (current customer)</option>
                    <option value="Inactive">Inactive (previous customers)</option>
                </select>
                <Mgr4Filter value={mgr4} onChange={(value) => { setMgr4(value); setPage(1); }} />
                <DateRangeFilter range={range} field="Transfer Date" onChange={() => setPage(1)} />
            </div>
            <div className="p-3 md:p-6">
                {loading ? <Spinner /> : (
                    <>
                        <MobileCardList>
                            {rows.map((entry) => (
                                <MobileCard key={entry._id} onClick={() => onOpen(entry.assetId)}>
                                    <MobileCardHead
                                        title={entry.serialNumber}
                                        subtitle={[entry.productCode, entry.productName].filter(Boolean).join(' · ')}
                                        aside={<TypeBadge type={entry.entryType} />}
                                    />
                                    <MobileFields>
                                        <MobileField label="Date">{formatDate(entry.transferDate)}</MobileField>
                                        <MobileField label="Status"><FlagBadge active={entry.isActive} /></MobileField>
                                        <MobileField label="Customer" wide><CustomerCell entry={entry} /></MobileField>
                                        <MobileField label="Invoice" wide><InvoiceCell entry={entry} /></MobileField>
                                        <MobileField label="Remarks" wide>{entry.remarks || '-'}</MobileField>
                                        <MobileField label="Recorded By" wide>{entry.createdByName || '-'} · {formatDate(entry.createdAt)}</MobileField>
                                    </MobileFields>
                                </MobileCard>
                            ))}
                            {!rows.length && <MobileEmpty>{emptyText}</MobileEmpty>}
                        </MobileCardList>
                        <div className="serial-desktop-table overflow-x-auto">
                            <table className="serial-list-compact w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50">
                                        {['Date', 'Serial No', 'Product', 'Customer', 'Status', 'Entry', 'Invoice', 'Remarks', 'Recorded By'].map((label) => (
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
                                            <td className="p-4"><FlagBadge active={entry.isActive} /></td>
                                            <td className="p-4"><TypeBadge type={entry.entryType} /></td>
                                            <td className="p-4 text-slate-500"><InvoiceCell entry={entry} /></td>
                                            <td className="p-4 text-slate-500 min-w-[10rem]">{entry.remarks || '-'}</td>
                                            <td className="p-4 text-slate-500 whitespace-nowrap">
                                                {entry.createdByName || '-'}
                                                <span className="block text-xs">{formatDate(entry.createdAt)}</span>
                                            </td>
                                        </tr>
                                    ))}
                                    {!rows.length && (
                                        <tr>
                                            <td colSpan={9} className="p-8 text-center text-slate-400 text-sm font-medium">{emptyText}</td>
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

const OWNERSHIP_OPTIONS = [
    { value: 'Active', label: 'Active Customer Log', hint: 'Current customer of each serial number' },
    { value: 'Inactive', label: 'Inactive Customer Log', hint: 'Earlier customers, before a transfer' },
];

const saveBlob = (blob, fileName) => {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
};

// A failed blob request carries its JSON error message inside the blob.
const blobErrorMessage = async (err, fallback) => {
    const data = err.response?.data;
    if (data instanceof Blob) {
        try { return JSON.parse(await data.text()).message || fallback; } catch { return fallback; }
    }
    return err.response ? (data?.message || fallback) : 'The server could not be reached. Check that the backend is running and try again.';
};

const SERIAL_OWNERSHIP_HINTS = { Active: 'Current customer of this serial number', Inactive: 'Earlier customers of this serial number' };

// Downloads the Customer Activity Log Excel for the given filters (ownership, assetId or search/dates).
const downloadActivityExcel = async (filters) => {
    const res = await serialTransferService.exportActivity(filters);
    const fileName = /filename="([^"]+)"/.exec(res.headers?.['content-disposition'] || '')?.[1]
        || `Customer_Activity_${filters.ownership}_${todayInput().replace(/-/g, '')}.xlsx`;
    saveBlob(res.data, fileName);
    const count = res.headers?.['x-total-count'];
    toast.success(`${fileName} downloaded${count ? ` (${count} records)` : ''}`);
};

// Serial No List row action: choose Active or Inactive, then download that serial's log only.
const SerialActivityDownloadDialog = ({ serial, onClose }) => {
    const [ownership, setOwnership] = useState('Active');
    const [downloading, setDownloading] = useState(false);
    const [message, setMessage] = useState('');

    const download = async () => {
        setDownloading(true);
        setMessage('');
        try {
            const filters = { ownership, assetId: serial._id };
            // Checked first so an empty selection gets a message instead of an empty file.
            const { data } = await serialTransferService.listActivity({ ...filters, limit: 1 });
            if (!data?.pagination?.total) {
                setMessage(ownership === 'Inactive'
                    ? 'No inactive customer records found for this serial number.'
                    : 'No active customer record found for this serial number.');
                return;
            }
            await downloadActivityExcel(filters);
            onClose();
        } catch (err) {
            setMessage(await blobErrorMessage(err, 'Could not download the Excel file.'));
        } finally {
            setDownloading(false);
        }
    };

    return (
        <Modal
            isOpen
            onClose={onClose}
            title="Download Customer Activity Log"
            maxWidth="max-w-lg"
            footer={
                <>
                    <button type="button" onClick={onClose} disabled={downloading} className="flex-1 w-full py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-60">
                        Cancel
                    </button>
                    <button type="button" onClick={download} disabled={downloading} className="flex-1 w-full flex items-center justify-center gap-2 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg disabled:opacity-60">
                        <MdFileDownload size={16} /> {downloading ? 'Preparing…' : 'Download Excel'}
                    </button>
                </>
            }
        >
            <div className="space-y-4">
                <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                    <p className="text-sm font-black text-slate-800">{serial.serialNumber}</p>
                    <p className="text-xs text-slate-500">{[serial.productCode, serial.productName].filter(Boolean).join(' · ')}</p>
                </div>
                <div className="space-y-2" role="radiogroup" aria-label="Customer activity log">
                    {OWNERSHIP_OPTIONS.map((option) => (
                        <label
                            key={option.value}
                            className={`flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 transition-all ${ownership === option.value ? 'border-primary-500 bg-primary-50/60' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
                        >
                            <input
                                type="radio"
                                name={`serialDownload-${serial._id}`}
                                value={option.value}
                                checked={ownership === option.value}
                                onChange={() => { setOwnership(option.value); setMessage(''); }}
                                className="h-4 w-4 accent-primary-600"
                            />
                            <span>
                                <span className="block text-xs font-black uppercase tracking-widest text-slate-700">{option.value === 'Active' ? 'Active Customer' : 'Inactive Customer'}</span>
                                <span className="block text-xs text-slate-500">{SERIAL_OWNERSHIP_HINTS[option.value]}</span>
                            </span>
                        </label>
                    ))}
                </div>
                {message && (
                    <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">{message}</p>
                )}
            </div>
        </Modal>
    );
};

// Customer Activity Log: Active (current owners) or Inactive (earlier owners) of serials,
// with search and a Customer Since date range; Download Excel exports every matching row.
// With `assetId` it is the log of that one serial number (its details page): the server filters
// by the serial, and search and dates are not shown.
const ActivityTab = ({ onOpen, assetId }) => {
    const prefix = assetId ? `activity.${assetId}` : 'activity';
    const [ownership, setOwnership] = useStoredState(`${prefix}.ownership`, 'Active');
    const [search, setSearch] = useStoredState(`${prefix}.search`, '');
    const [page, setPage] = useStoredState(`${prefix}.page`, 1);
    const [mgr4, setMgr4] = useStoredState(`${prefix}.mgr4`, '');
    const range = useDateRange(prefix);
    const debouncedSearch = useDebounced(search.trim());
    const [downloading, setDownloading] = useState(false);

    const filters = assetId
        ? { ownership, assetId }
        : { ownership, search: debouncedSearch || undefined, mgr4: mgr4 || undefined, ...range.params };
    const { rows, pagination, loading } = useList(serialTransferService.listActivity, { ...filters, page, limit: PAGE_SIZE }, !range.invalid);
    const offset = (pagination.page - 1) * pagination.limit;
    const inactive = ownership === 'Inactive';
    const emptyText = assetId
        ? (inactive ? 'This serial number has never been transferred, so it has no inactive (earlier) customers to download.' : 'No current customer found for this serial number.')
        : range.invalid ? 'Correct the date range to see results.'
            : inactive && !debouncedSearch && !mgr4 && !range.fromDate && !range.toDate ? 'No earlier customers yet. A customer becomes inactive when the serial is transferred.'
                : 'No customer records match.';

    const download = async () => {
        setDownloading(true);
        try {
            await downloadActivityExcel(filters);
        } catch (err) {
            toast.error(await blobErrorMessage(err, 'Could not download the Excel file.'));
        } finally {
            setDownloading(false);
        }
    };

    return (
        <>
            <div className="p-4 border-b border-slate-100 bg-slate-50 space-y-3">
                <div className="flex flex-wrap items-center gap-3" role="radiogroup" aria-label="Customer activity log">
                    {OWNERSHIP_OPTIONS.map((option) => (
                        <label
                            key={option.value}
                            className={`flex w-full sm:w-auto cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 transition-all ${ownership === option.value ? 'border-primary-500 bg-primary-50/60' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
                        >
                            <input
                                type="radio"
                                name={`activityOwnership-${assetId || 'all'}`}
                                value={option.value}
                                checked={ownership === option.value}
                                onChange={() => { setOwnership(option.value); setPage(1); }}
                                className="h-4 w-4 accent-primary-600"
                            />
                            <span>
                                <span className="block text-xs font-black uppercase tracking-widest text-slate-700">{option.label}</span>
                                <span className="block text-xs text-slate-500">{assetId ? SERIAL_OWNERSHIP_HINTS[option.value] : option.hint}</span>
                            </span>
                        </label>
                    ))}
                    <button
                        type="button"
                        onClick={download}
                        disabled={downloading || loading || range.invalid || !pagination.total}
                        className="w-full sm:w-auto sm:ml-auto flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-xs tracking-widest transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <MdFileDownload size={18} /> {downloading ? 'Preparing…' : 'Download Excel'}
                    </button>
                </div>
                {!assetId && (
                    <div className="serial-filter-bar flex flex-wrap items-end gap-3">
                        <div className="serial-filter-wide relative w-full max-w-md">
                            <MdSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                                placeholder="Search serial no, product or customer"
                                className={`${inputClass} pl-11`}
                            />
                        </div>
                        <Mgr4Filter value={mgr4} onChange={(value) => { setMgr4(value); setPage(1); }} />
                        <DateRangeFilter range={range} field="Customer Since" onChange={() => setPage(1)} />
                    </div>
                )}
            </div>
            <div className="p-3 md:p-6">
                {loading ? <Spinner /> : (
                    <>
                        <p className="mb-3 text-xs font-bold text-slate-500">
                            {pagination.total} {inactive ? 'inactive (earlier)' : 'active (current)'} customer record{pagination.total === 1 ? '' : 's'}
                        </p>
                        <MobileCardList>
                            {rows.map((row, index) => (
                                <MobileCard key={row._id} onClick={onOpen ? () => onOpen(row.assetId) : undefined}>
                                    <MobileCardHead
                                        title={<><span className="text-slate-400 font-bold">{offset + index + 1}.</span> {row.serialNumber}</>}
                                        subtitle={[row.productCode, row.productName].filter(Boolean).join(' · ')}
                                        aside={<FlagBadge active={row.ownership === 'Active'} />}
                                    />
                                    {row.mgr1 && <p className="mt-1 text-[10px] font-semibold text-emerald-600">{[row.mgr1, row.mgr2, row.mgr3, row.mgr4, row.mgr5].filter(Boolean).join(' · ')}</p>}
                                    <MobileFields>
                                        <MobileField label="Customer" wide>
                                            {row.customerName || '-'}
                                            {row.customerCode && <span className="block text-xs text-slate-500">{row.customerCode}</span>}
                                        </MobileField>
                                        <MobileField label="Email" wide>{row.email || '-'}</MobileField>
                                        <MobileField label="Pincode">{row.pincode || '-'}</MobileField>
                                        <MobileField label="Invoice">
                                            {row.invoiceNumber || '-'}
                                            {row.invoiceDate && <span className="block text-xs text-slate-500">{formatDate(row.invoiceDate)}</span>}
                                        </MobileField>
                                        <MobileField label={inactive ? 'Customer Period' : 'Customer Since'} wide>
                                            {formatDate(row.ownerSince)}{inactive && row.ownerUntil ? ` to ${formatDate(row.ownerUntil)}` : ''}
                                        </MobileField>
                                    </MobileFields>
                                </MobileCard>
                            ))}
                            {!rows.length && <MobileEmpty>{emptyText}</MobileEmpty>}
                        </MobileCardList>
                        <div className="serial-desktop-table overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50">
                                        {['Sr No', 'Serial No', 'Product', 'Customer', 'Email', 'Pincode', 'Invoice', inactive ? 'Customer Period' : 'Customer Since', 'Status'].map((label) => (
                                            <th key={label} className={thClass}>{label}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map((row, index) => (
                                        <tr key={row._id} onClick={onOpen ? () => onOpen(row.assetId) : undefined} className={`${onOpen ? 'cursor-pointer ' : ''}border-b last:border-0 border-slate-50 hover:bg-slate-50/50 transition-colors text-sm`}>
                                            <td className="p-4 font-bold text-slate-400">{offset + index + 1}</td>
                                            <td className="p-4 font-bold text-slate-800 whitespace-nowrap">{row.serialNumber}</td>
                                            <td className="p-4 text-slate-600 min-w-[14rem]">
                                                <span className="font-bold text-slate-700">{row.productCode}</span>
                                                {row.productName && <span className="block text-xs text-slate-500">{row.productName}</span>}
                                                {row.mgr1 && <span className="block text-[10px] font-semibold text-emerald-600">{[row.mgr1, row.mgr2, row.mgr3, row.mgr4, row.mgr5].filter(Boolean).join(' · ')}</span>}
                                            </td>
                                            <td className="p-4">
                                                <span className="font-bold text-slate-700">{row.customerName || '-'}</span>
                                                {row.customerCode && <span className="block text-xs text-slate-500">{row.customerCode}</span>}
                                            </td>
                                            <td className="p-4 text-slate-500">{row.email || '-'}</td>
                                            <td className="p-4 text-slate-500">{row.pincode || '-'}</td>
                                            <td className="p-4 text-slate-600 whitespace-nowrap">
                                                {row.invoiceNumber || '-'}
                                                {row.invoiceDate && <span className="block text-xs text-slate-500">{formatDate(row.invoiceDate)}</span>}
                                            </td>
                                            <td className="p-4 text-slate-500 whitespace-nowrap">
                                                {formatDate(row.ownerSince)}
                                                {inactive && row.ownerUntil && <span className="block text-xs">to {formatDate(row.ownerUntil)}</span>}
                                            </td>
                                            <td className="p-4"><FlagBadge active={row.ownership === 'Active'} /></td>
                                        </tr>
                                    ))}
                                    {!rows.length && (
                                        <tr>
                                            <td colSpan={9} className="p-8 text-center text-slate-400 text-sm font-medium">{emptyText}</td>
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
    const { canModify } = usePermission('master_serials');
    const [result, setResult] = useState({ id: null, data: null, error: '' });
    // Open form: 'transfer' (new current customer) or 'past' (an earlier customer, inactive).
    const [formMode, setFormMode] = useState(transfer && canModify ? 'transfer' : null);
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
    // A serial of any status can be transferred; `current` is its customer now, if it has one.
    const current = history.find((entry) => entry.isActive);
    const label = 'block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1';

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-4 bg-white p-4 md:p-6 rounded-3xl border border-slate-100 shadow-sm">
                <button
                    type="button"
                    onClick={goBack}
                    className="p-3 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-2xl transition-all border border-slate-200"
                >
                    <MdArrowBack size={20} />
                </button>
<<<<<<< HEAD
                {/* Serial number and product are shown once, in the details card or form below. */}
                <h1 className="min-w-0 flex-1 text-xl font-black text-slate-900">Serial No Transfer</h1>
                {data && !formMode && canModify && (
                    <div className="flex flex-wrap gap-3">
=======
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
                {data && sold && !formMode && canModify && (
                    <div className="flex w-full sm:w-auto flex-wrap gap-3">
>>>>>>> f06da8202d682688814cc0c79f79cc6b501d3d21
                        <button
                            type="button"
                            onClick={() => setFormMode('past')}
                            className="flex flex-1 sm:flex-none items-center justify-center gap-2 px-5 py-3 rounded-2xl border border-slate-200 bg-white text-slate-600 font-black uppercase text-xs tracking-widest hover:bg-slate-50 transition-all"
                        >
                            <MdHistory size={18} /> Add Past Entry
                        </button>
                        <button
                            type="button"
                            onClick={() => setFormMode('transfer')}
                            className="flex flex-1 sm:flex-none items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-2xl font-black transition-all shadow-xl shadow-primary-600/20 uppercase text-xs tracking-widest active:scale-95"
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
                                currentSince={current?.transferDate}
                                onCancel={() => (transfer ? goBack() : setFormMode(null))}
                                onSaved={handleSaved}
                            />
                        ) : (
                            <div className="grid grid-cols-1 gap-6 p-4 md:p-6 sm:grid-cols-2 lg:grid-cols-6">
                                <div><span className={label}>Serial Number</span><p className="text-sm font-bold text-slate-800">{data.asset.serialNumber}</p></div>
                                <div className="lg:col-span-2"><span className={label}>Product</span><p className="text-sm font-bold text-slate-800">{data.asset.productCode}</p><p className="text-xs text-slate-500">{data.asset.productName}</p></div>
                                <div><span className={label}>Status</span><StatusBadge status={data.asset.status} /></div>
                                <div><span className={label}>Branch</span><p className="text-sm font-bold text-slate-800">{data.asset.branchName || '-'}</p></div>
                                <div>
                                    <span className={label}>Current Customer</span>
                                    <p className="text-sm font-bold text-slate-800">{current?.companyName || data.asset.customerName || '-'}</p>
                                    <p className="text-xs text-slate-500">{[current?.customerCode || data.asset.customerCode, current?.customerMobile, current?.customerCity].filter(Boolean).join(' · ')}</p>
                                    {current && <p className="text-xs text-slate-500">Since {formatDate(current.transferDate)}</p>}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="rounded-3xl border border-slate-100 bg-white shadow-sm">
                        <h3 className="flex items-center gap-2 border-b border-slate-100 px-6 py-4 text-xs font-black uppercase tracking-widest text-slate-500">
                            <MdHistory size={16} /> Serial Number Sale History ({history.length})
                        </h3>
                        <div className="p-3 md:hidden">
                            <MobileCardList>
                                {history.map((entry) => (
                                    <MobileCard key={entry._id || 'sale'} tone={entry.isActive ? 'active' : 'default'}>
                                        <MobileCardHead
                                            title={entry.companyName || entry.customerName || '-'}
                                            subtitle={[entry.customerCode, entry.customerMobile, [entry.customerCity, entry.customerState].filter(Boolean).join(', ')].filter(Boolean).join(' · ')}
                                            aside={<TypeBadge type={entry.entryType} />}
                                        />
                                        <MobileFields>
                                            <MobileField label="Date">{formatDate(entry.transferDate)}</MobileField>
                                            <MobileField label="Status"><FlagBadge active={entry.isActive} /></MobileField>
                                            <MobileField label="Product" wide>{[entry.productCode, entry.productName].filter(Boolean).join(' · ') || '-'}</MobileField>
                                            <MobileField label="Invoice" wide><InvoiceCell entry={entry} /></MobileField>
                                            <MobileField label="Remarks" wide>{entry.remarks || '-'}</MobileField>
                                            <MobileField label="Recorded By" wide>{entry.pending ? 'Invoice Bulk Upload' : (entry.createdByName || '-')}</MobileField>
                                        </MobileFields>
                                    </MobileCard>
                                ))}
                                {!history.length && <MobileEmpty>No customer history recorded for this serial number.</MobileEmpty>}
                            </MobileCardList>
                        </div>
                        <div className="serial-desktop-table overflow-x-auto p-4">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50">
                                        {['Product', 'Date', 'Customer', 'Status', 'Entry', 'Invoice', 'Remarks', 'Recorded By'].map((text) => (
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
                                            <td className="p-4"><FlagBadge active={entry.isActive} /></td>
                                            <td className="p-4"><TypeBadge type={entry.entryType} /></td>
                                            <td className="p-4 text-slate-500"><InvoiceCell entry={entry} /></td>
                                            <td className="p-4 text-slate-500">{entry.remarks || '-'}</td>
                                            <td className="p-4 text-slate-500 whitespace-nowrap">{entry.pending ? 'Invoice Bulk Upload' : (entry.createdByName || '-')}</td>
                                        </tr>
                                    ))}
                                    {!history.length && (
                                        <tr><td colSpan={8} className="p-8 text-center text-slate-400 text-sm font-medium">No customer history recorded for this serial number.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {history.length > 0 && (
                        <div className="rounded-3xl border border-slate-100 bg-white shadow-sm overflow-hidden">
                            <h3 className="flex items-center gap-2 border-b border-slate-100 px-6 py-4 text-xs font-black uppercase tracking-widest text-slate-500">
                                <MdFileDownload size={16} /> Customer Activity Log Download — {data.asset.serialNumber}
                            </h3>
                            {/* Remounted after a transfer so the Active/Inactive lists reload. */}
                            <ActivityTab key={`${assetId}-${refreshCount}`} assetId={assetId} />
                        </div>
                    )}

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
    const { can } = useAuth();
    const canAddCustomer = can('master_customers', 'create');
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
    // The invoice the API carries over to the new customer: the current record's, else the serial's.
    const invoice = data.history.find((entry) => entry.isActive) || data.asset;

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
        <form onSubmit={save} className="p-4 md:p-6 space-y-5">
            <div className={`grid grid-cols-1 gap-4 ${past ? 'md:grid-cols-3' : 'md:grid-cols-2 lg:grid-cols-4'}`}>
                <div><span className={label}>Serial Number</span><p className={readOnly}>{data.asset.serialNumber}</p></div>
                <div><span className={label}>Product</span><p className={readOnly}>{data.asset.productCode}{data.asset.productName ? ` · ${data.asset.productName}` : ''}</p></div>
                <div><span className={label}>{past ? 'Current Customer (stays active)' : 'Previous Customer'}</span><p className={readOnly}>{data.asset.customerName || '-'}{data.asset.customerCode ? ` (${data.asset.customerCode})` : ''}</p></div>
                {!past && (
                    <div>
                        <span className={label}>Invoice (moves to new customer)</span>
                        <p className={readOnly}>{invoice.invoiceNumber || '-'}{invoice.invoiceDate ? ` · ${formatDate(invoice.invoiceDate)}` : ''}</p>
                    </div>
                )}
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
                        {canAddCustomer && (
                        <div className="mb-3 flex w-full sm:inline-flex sm:w-auto rounded-2xl border border-slate-200 p-1">
                            {[['existing', 'Select Existing Customer'], ['new', 'Add New Customer']].map(([value, text]) => (
                                <button
                                    key={value}
                                    type="button"
                                    onClick={() => { setCustomerMode(value); if (value === 'new') setAddingCustomer(true); }}
                                    className={`flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${customerMode === value ? 'bg-primary-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
                                >
                                    {text}
                                </button>
                            ))}
                        </div>
                        )}
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
                                                {canAddCustomer && <button type="button" onClick={() => { setCustomerMode('new'); setAddingCustomer(true); }} className="font-black text-primary-600 hover:underline">Add a new customer</button>}
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
                    <DateInput id="transferDate" type="date" required max={past ? latestPastDate : todayInput()} value={transferDate} onChange={(e) => setTransferDate(e.target.value)} className={inputClass} />
                </div>
                <div className="md:col-span-2">
                    <label className={label} htmlFor="remarks">Remarks</label>
                    <input id="remarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Optional" className={inputClass} />
                </div>
            </div>

            <p className="text-xs font-medium text-slate-500">
                {past
                    ? (currentSince
                        ? `A past entry records an earlier customer as Inactive history, dated on or before ${formatDate(currentSince)} (when the current customer received it). The current customer stays Active.`
                        : 'A past entry records an earlier customer as Inactive history.')
                    : 'Saving keeps every earlier customer in the history as Inactive and makes the new customer the only Active one.'}
            </p>

            {saveError && (
                <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{saveError}</p>
            )}

            <div className="flex justify-end gap-3">
                <button type="button" onClick={onCancel} disabled={saving} className="flex-1 sm:flex-none px-5 py-3 rounded-2xl border border-slate-200 text-slate-600 font-black uppercase text-xs tracking-widest hover:bg-slate-50 transition-all disabled:opacity-60">
                    Cancel
                </button>
                <button type="submit" disabled={saving || !customer} className="flex-1 sm:flex-none px-6 py-3 rounded-2xl bg-primary-600 hover:bg-primary-700 text-white font-black uppercase text-xs tracking-widest transition-all disabled:opacity-60">
                    {saving ? 'Saving…' : past ? 'Save Past Entry' : 'Save Transfer'}
                </button>
            </div>
        </form>

        </>
    );
};

// ---- Branch Transfer: moving serial numbers to another branch ----

const MAX_SERIALS_PER_BRANCH_TRANSFER = 200;
const sameId = (a, b) => String(a || '') === String(b || '');
const branchNameOf = (branches, id) => branches.find((branch) => sameId(branch._id, id))?.name || '';

// Branches for the form and filters; `canMoveFrom` marks those serials may be moved out of.
const useTransferBranches = () => {
    const [state, setState] = useState({ branches: [], activeBranchId: null, loaded: false });
    useEffect(() => {
        let cancelled = false;
        serialTransferService.getTransferBranches()
            .then((res) => { if (!cancelled) setState({ branches: res.data?.branches || [], activeBranchId: res.data?.activeBranchId || null, loaded: true }); })
            .catch((err) => {
                if (cancelled) return;
                toast.error(err.response?.data?.message || 'Failed to load branches');
                setState((prev) => ({ ...prev, loaded: true }));
            });
        return () => { cancelled = true; };
    }, []);
    return state;
};

const BranchRoute = ({ from, to }) => (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap font-bold text-slate-700">
        {from || '-'} <MdArrowForward className="text-primary-500" size={14} /> {to || '-'}
    </span>
);

const SerialSummary = ({ serial }) => (
    <>
        <span className="font-bold text-slate-700">{serial.productCode}</span>
        {serial.productName && <span className="block text-xs text-slate-500">{serial.productName}</span>}
    </>
);

const BranchTransferList = ({ params, enabled, hasFilters, onPageChange, onOpen }) => {
    const { rows, pagination, loading } = useList(serialTransferService.listBranchTransfers, params, enabled);

    if (loading) return <Spinner />;
    const emptyText = !enabled ? 'Correct the date range to see results.'
        : hasFilters ? 'No branch transfers match.'
            : 'No serial numbers have been moved to another branch yet.';
    return (
        <>
            <MobileCardList>
                {rows.map((row) => (
                    <MobileCard key={row._id} onClick={() => onOpen(row)}>
                        <MobileCardHead
                            title={<span className="inline-flex items-center gap-1 text-primary-600">{row.transferNo} <MdVisibility size={14} /></span>}
                            subtitle={formatDate(row.transferDate)}
                            aside={<StatusBadge status={row.status} />}
                        />
                        <MobileFields>
                            <MobileField label="Serial No">{row.serialNumber}</MobileField>
                            <MobileField label="Product"><SerialSummary serial={row} /></MobileField>
                            <MobileField label="From / To Branch" wide>
                                <BranchRoute from={row.fromBranchName} to={row.toBranchName} />
                                {row.currentBranchId && !sameId(row.currentBranchId, row.toBranchId) && (
                                    <span className="block text-[10px] font-black uppercase tracking-widest text-amber-600">Moved again, now in {row.currentBranchName}</span>
                                )}
                            </MobileField>
                            {(row.reference || row.remarks) && (
                                <MobileField label="Reference / Remarks" wide>
                                    {row.reference && <span className="block font-bold text-slate-700">{row.reference}</span>}
                                    {row.remarks}
                                </MobileField>
                            )}
                            <MobileField label="Transferred By" wide>{row.createdByName || '-'}</MobileField>
                        </MobileFields>
                    </MobileCard>
                ))}
                {!rows.length && <MobileEmpty>{emptyText}</MobileEmpty>}
            </MobileCardList>
            <div className="serial-desktop-table overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50">
                            {['Transfer', 'Serial No', 'Product', 'From / To Branch', 'Status', 'Reference / Remarks', 'Transferred By'].map((label) => (
                                <th key={label} className={thClass}>{label}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row) => (
                            <tr key={row._id} onClick={() => onOpen(row)} className="cursor-pointer border-b last:border-0 border-slate-50 hover:bg-slate-50/50 transition-colors text-sm">
                                <td className="p-4 whitespace-nowrap">
                                    <button
                                        type="button"
                                        title="View transfer details"
                                        onClick={(e) => { e.stopPropagation(); onOpen(row); }}
                                        className="inline-flex items-center gap-1 font-bold text-primary-600 hover:underline"
                                    >
                                        {row.transferNo} <MdVisibility size={14} />
                                    </button>
                                    <span className="block text-xs text-slate-500">{formatDate(row.transferDate)}</span>
                                </td>
                                <td className="p-4 font-bold text-slate-800 whitespace-nowrap">{row.serialNumber}</td>
                                <td className="p-4 text-slate-600 min-w-[12rem]"><SerialSummary serial={row} /></td>
                                <td className="p-4">
                                    <BranchRoute from={row.fromBranchName} to={row.toBranchName} />
                                    {row.currentBranchId && !sameId(row.currentBranchId, row.toBranchId) && (
                                        <span className="block text-[10px] font-black uppercase tracking-widest text-amber-600 whitespace-nowrap">Moved again, now in {row.currentBranchName}</span>
                                    )}
                                </td>
                                <td className="p-4"><StatusBadge status={row.status} /></td>
                                <td className="p-4 text-slate-500 min-w-[10rem]">
                                    {row.reference && <span className="block font-bold text-slate-700">{row.reference}</span>}
                                    {row.remarks || (!row.reference ? '-' : '')}
                                </td>
                                <td className="p-4 text-slate-500 whitespace-nowrap">{row.createdByName || '-'}</td>
                            </tr>
                        ))}
                        {!rows.length && (
                            <tr>
                                <td colSpan={7} className="p-8 text-center text-slate-400 text-sm font-medium">{emptyText}</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
            <PaginationControls pagination={pagination} onPageChange={onPageChange} />
        </>
    );
};

// Branch Transfer tab: every serial moved to another branch, with search, branch, status and date
// filters; Create Branch Transfer opens the form and a row opens the serial's branch history.
const BranchTransferTab = () => {
    const { canModify } = usePermission('master_serials');
    const { branches, activeBranchId, loaded } = useTransferBranches();
    const [search, setSearch] = useStoredState('branch.search', '');
    const [fromBranchId, setFromBranchId] = useStoredState('branch.from', '');
    const [toBranchId, setToBranchId] = useStoredState('branch.to', '');
    const [status, setStatus] = useStoredState('branch.status', '');
    const [page, setPage] = useStoredState('branch.page', 1);
    const range = useDateRange('branch');
    const debouncedSearch = useDebounced(search.trim());
    const [creating, setCreating] = useState(false);
    const [details, setDetails] = useState(null);
    // Bumped after a save so the list remounts and reloads.
    const [savedCount, setSavedCount] = useState(0);

    const params = {
        page, limit: PAGE_SIZE, search: debouncedSearch || undefined, fromBranchId: fromBranchId || undefined,
        toBranchId: toBranchId || undefined, status: status || undefined, ...range.params,
    };
    const hasFilters = Boolean(debouncedSearch || fromBranchId || toBranchId || status || range.fromDate || range.toDate);
    const branchSelect = (value, setValue, allLabel, ariaLabel) => (
        <select value={value} onChange={(e) => { setValue(e.target.value); setPage(1); }} aria-label={ariaLabel} className={selectClass}>
            <option value="">{allLabel}</option>
            {branches.map((branch) => <option key={branch._id} value={branch._id}>{branch.name}</option>)}
        </select>
    );

    return (
        <>
            {creating && (
                <BranchTransferForm
                    branches={branches}
                    activeBranchId={activeBranchId}
                    onClose={() => setCreating(false)}
                    onSaved={() => { setCreating(false); setPage(1); setSavedCount((count) => count + 1); }}
                />
            )}
            {details && <BranchTransferDetails transfer={details} onClose={() => setDetails(null)} />}
            <div className="p-4 border-b border-slate-100 bg-slate-50 space-y-3">
                <div className="serial-filter-bar flex flex-wrap items-center gap-3">
                    <div className="serial-filter-wide relative w-full max-w-md">
                        <MdSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                            placeholder="Search serial no, product, transfer no or reference"
                            className={`${inputClass} pl-11`}
                        />
                    </div>
                    {canModify && (
                        <button
                            type="button"
                            onClick={() => setCreating(true)}
                            disabled={!loaded || branches.length < 2}
                            title={loaded && branches.length < 2 ? 'At least two branches are needed for a branch transfer' : undefined}
                            className="serial-filter-wide ml-auto flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-5 py-3 rounded-2xl font-black transition-all shadow-xl shadow-primary-600/20 uppercase text-xs tracking-widest active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <MdAdd size={18} /> Create Branch Transfer
                        </button>
                    )}
                </div>
                <div className="serial-filter-bar flex flex-wrap items-end gap-3">
                    {branchSelect(fromBranchId, setFromBranchId, 'All source branches', 'Filter by source branch')}
                    {branchSelect(toBranchId, setToBranchId, 'All destination branches', 'Filter by destination branch')}
                    <StatusFilter value={status} onChange={(value) => { setStatus(value); setPage(1); }} />
                    <DateRangeFilter range={range} field="Transfer Date" onChange={() => setPage(1)} />
                </div>
            </div>
            <div className="p-3 md:p-6">
                <BranchTransferList
                    key={savedCount}
                    params={params}
                    enabled={!range.invalid}
                    hasFilters={hasFilters}
                    onPageChange={setPage}
                    onOpen={setDetails}
                />
            </div>
        </>
    );
};

// Create Branch Transfer: source and destination branch, the serials of the source branch to
// move, an optional reference and remarks, then a confirmation step before anything is saved.
const BranchTransferForm = ({ branches, activeBranchId, onClose, onSaved }) => {
    const sources = branches.filter((branch) => branch.canMoveFrom);
    const [fromBranchId, setFromBranchId] = useState(() => (sources.some((branch) => sameId(branch._id, activeBranchId)) ? String(activeBranchId) : ''));
    const [toBranchId, setToBranchId] = useState('');
    const [query, setQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const debouncedQuery = useDebounced(query.trim());
    const [results, setResults] = useState({ key: null, rows: [], total: 0 });
    const [selected, setSelected] = useState([]);
    const [reference, setReference] = useState('');
    const [remarks, setRemarks] = useState('');
    const [confirming, setConfirming] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState('');
    const [requestId] = useState(newRequestId);

    const searchKey = JSON.stringify({ fromBranchId, search: debouncedQuery, status: statusFilter });
    useEffect(() => {
        if (!fromBranchId) return undefined;
        let cancelled = false;
        serialTransferService.searchBranchSerials({ fromBranchId, search: debouncedQuery || undefined, status: statusFilter || undefined, limit: 20 })
            .then((res) => { if (!cancelled) setResults({ key: searchKey, rows: res.data?.data || [], total: res.data?.total || 0 }); })
            .catch((err) => {
                if (cancelled) return;
                toast.error(err.response?.data?.message || 'Failed to load serial numbers');
                setResults({ key: searchKey, rows: [], total: 0 });
            });
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchKey]);
    const searching = Boolean(fromBranchId) && results.key !== searchKey;

    const fromName = branchNameOf(branches, fromBranchId);
    const toName = branchNameOf(branches, toBranchId);
    const sameBranch = Boolean(fromBranchId) && sameId(fromBranchId, toBranchId);
    const selectedIds = new Set(selected.map((serial) => serial._id));
    const tooMany = selected.length > MAX_SERIALS_PER_BRANCH_TRANSFER;
    const canReview = Boolean(fromBranchId && toBranchId) && !sameBranch && selected.length > 0 && !tooMany;
    const notSelected = results.rows.filter((row) => !selectedIds.has(row._id));

    // The selected serials belong to the source branch, so a new source starts a new selection.
    const changeSource = (value) => {
        setFromBranchId(value);
        setSelected([]);
        setSaveError('');
        if (sameId(value, toBranchId)) setToBranchId('');
    };
    const add = (rows) => { setSelected((prev) => [...prev, ...rows.filter((row) => !prev.some((serial) => serial._id === row._id))]); setSaveError(''); };
    const remove = (id) => { setSelected((prev) => prev.filter((serial) => serial._id !== id)); setSaveError(''); };

    const save = async () => {
        setSaving(true);
        setSaveError('');
        try {
            const res = await serialTransferService.createBranchTransfer({
                fromBranchId, toBranchId, assetIds: selected.map((serial) => serial._id),
                reference: reference.trim(), remarks: remarks.trim(), requestId,
            });
            const count = res.data?.serials?.length || selected.length;
            toast.success(`${res.data?.transferNo || 'Branch transfer'}: ${count} serial number${count === 1 ? '' : 's'} moved from ${fromName} to ${toName}`);
            onSaved(res.data);
        } catch (err) {
            const message = err.response?.data?.message || (err.response ? 'Could not save the branch transfer.' : 'The server could not be reached. Check that the backend is running and try again.');
            setSaveError(message);
            toast.error(message);
        } finally {
            setSaving(false);
        }
    };

    const label = 'block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2';
    const buttonBase = 'flex-1 md:flex-none w-full md:w-auto px-6 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-60';
    const footer = confirming ? (
        <>
            <button type="button" onClick={() => setConfirming(false)} disabled={saving} className={`${buttonBase} bg-slate-100 hover:bg-slate-200 text-slate-600`}>Back</button>
            <button type="button" onClick={save} disabled={saving} className={`${buttonBase} bg-primary-600 hover:bg-primary-700 text-white shadow-lg`}>
                {saving ? 'Transferring…' : 'Confirm Transfer'}
            </button>
        </>
    ) : (
        <>
            <button type="button" onClick={onClose} className={`${buttonBase} bg-slate-100 hover:bg-slate-200 text-slate-600`}>Cancel</button>
            <button type="button" onClick={() => setConfirming(true)} disabled={!canReview} className={`${buttonBase} bg-primary-600 hover:bg-primary-700 text-white shadow-lg`}>
                Review Transfer ({selected.length})
            </button>
        </>
    );

    const selectedTable = (removable) => (
        <>
        <MobileCardList>
            {selected.map((serial) => (
                <MobileCard key={serial._id}>
                    <MobileCardHead
                        title={serial.serialNumber}
                        subtitle={[serial.productCode, serial.productName].filter(Boolean).join(' · ')}
                        aside={(
                            <>
                                <StatusBadge status={serial.status} />
                                {removable && (
                                    <button type="button" onClick={() => remove(serial._id)} aria-label={`Remove ${serial.serialNumber}`} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all">
                                        <MdClose size={16} />
                                    </button>
                                )}
                            </>
                        )}
                    />
                    <MobileFields>
                        <MobileField label="Current Branch" wide>{serial.branchName}</MobileField>
                    </MobileFields>
                </MobileCard>
            ))}
        </MobileCardList>
        <div className="serial-desktop-table overflow-x-auto rounded-2xl border border-slate-100">
            <table className="w-full text-left border-collapse">
                <thead>
                    <tr className="bg-slate-50">
                        {['Serial No', 'Product', 'Current Branch', 'Status'].map((text) => <th key={text} className={thClass}>{text}</th>)}
                        {removable && <th className={thClass}><span className="sr-only">Remove</span></th>}
                    </tr>
                </thead>
                <tbody>
                    {selected.map((serial) => (
                        <tr key={serial._id} className="border-b last:border-0 border-slate-50 text-sm">
                            <td className="p-4 font-bold text-slate-800 whitespace-nowrap">{serial.serialNumber}</td>
                            <td className="p-4 text-slate-600"><SerialSummary serial={serial} /></td>
                            <td className="p-4 font-bold text-slate-700 whitespace-nowrap">{serial.branchName}</td>
                            <td className="p-4"><StatusBadge status={serial.status} /></td>
                            {removable && (
                                <td className="p-4 text-right">
                                    <button type="button" onClick={() => remove(serial._id)} aria-label={`Remove ${serial.serialNumber}`} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all">
                                        <MdClose size={16} />
                                    </button>
                                </td>
                            )}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
        </>
    );

    return (
        <Modal isOpen onClose={saving ? () => {} : onClose} title={confirming ? 'Confirm Branch Transfer' : 'Create Branch Transfer'} maxWidth="max-w-5xl" footer={footer}>
            {confirming ? (
                <div className="space-y-5">
                    <div className="rounded-2xl border border-primary-100 bg-primary-50/50 px-5 py-4">
                        <p className="text-sm font-black text-slate-800">
                            Move {selected.length} serial number{selected.length === 1 ? '' : 's'} from {fromName} to {toName}?
                        </p>
                        <p className="mt-1 text-xs font-medium text-slate-500">
                            {toName} becomes their current branch: Invoice Bulk Upload and the Serial No List show them there from now on. Their status, customer and invoice details stay as they are, and the move is kept in the branch transfer history.
                        </p>
                    </div>
                    {selectedTable(false)}
                    {(reference.trim() || remarks.trim()) && (
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 text-sm">
                            <div><span className={label}>Reference</span><p className="font-bold text-slate-700">{reference.trim() || '-'}</p></div>
                            <div><span className={label}>Remarks</span><p className="font-bold text-slate-700">{remarks.trim() || '-'}</p></div>
                        </div>
                    )}
                    {saveError && <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{saveError}</p>}
                </div>
            ) : (
                <div className="space-y-5">
                    <div className="grid grid-cols-1 items-end gap-4 md:grid-cols-[1fr_auto_1fr]">
                        <div>
                            <label className={label} htmlFor="branchTransferFrom">Source Branch <span className="text-rose-500">*</span></label>
                            <select id="branchTransferFrom" value={fromBranchId} onChange={(e) => changeSource(e.target.value)} className={inputClass}>
                                <option value="">Select source branch</option>
                                {sources.map((branch) => <option key={branch._id} value={branch._id}>{branch.name}</option>)}
                            </select>
                        </div>
                        <MdArrowForward className="hidden md:block mb-3.5 text-primary-500" size={22} />
                        <div>
                            <label className={label} htmlFor="branchTransferTo">Destination Branch <span className="text-rose-500">*</span></label>
                            <select id="branchTransferTo" value={toBranchId} onChange={(e) => { setToBranchId(e.target.value); setSaveError(''); }} className={inputClass}>
                                <option value="">Select destination branch</option>
                                {branches.map((branch) => (
                                    <option key={branch._id} value={branch._id} disabled={!branch.active || sameId(branch._id, fromBranchId)}>
                                        {branch.name}{!branch.active ? ' (inactive)' : sameId(branch._id, fromBranchId) ? ' (source branch)' : ''}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                    {sameBranch && <p className="text-xs font-semibold text-rose-600">Source and destination branches must be different.</p>}

                    <div>
                        <span className={label}>Serial Numbers to Transfer <span className="text-rose-500">*</span></span>
                        {!fromBranchId ? (
                            <p className="flex items-center gap-2 rounded-2xl border border-dashed border-slate-300 px-4 py-4 text-sm font-semibold text-slate-500">
                                <MdStore size={20} className="text-slate-400" /> Select the source branch to find its serial numbers.
                            </p>
                        ) : (
                            <>
                                <div className="flex flex-wrap gap-3">
                                    <div className="relative min-w-[14rem] flex-1">
                                        <MdSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                                        <input
                                            autoFocus
                                            value={query}
                                            onChange={(e) => setQuery(e.target.value)}
                                            placeholder={`Search ${fromName} serials by serial no, product, invoice or customer`}
                                            className={`${inputClass} pl-11`}
                                        />
                                    </div>
                                    <StatusFilter value={statusFilter} onChange={setStatusFilter} />
                                </div>
                                <div className="mt-2 rounded-2xl border border-slate-100 bg-white">
                                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-2 text-xs font-semibold text-slate-500">
                                        <span>
                                            {searching ? 'Searching…'
                                                : results.total > results.rows.length ? `Showing ${results.rows.length} of ${results.total} serial numbers in ${fromName}. Search to narrow down.`
                                                    : `${results.total} serial number${results.total === 1 ? '' : 's'} in ${fromName}${debouncedQuery || statusFilter ? ' match' : ''}`}
                                        </span>
                                        {!searching && notSelected.length > 1 && (
                                            <button type="button" onClick={() => add(notSelected)} className="font-black uppercase tracking-widest text-[10px] text-primary-600 hover:underline">
                                                Add all shown ({notSelected.length})
                                            </button>
                                        )}
                                    </div>
                                    <ul className="max-h-64 overflow-auto divide-y divide-slate-50">
                                        {!searching && results.rows.map((row) => {
                                            const added = selectedIds.has(row._id);
                                            return (
                                                <li key={row._id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                                                    <div className="min-w-0">
                                                        <p className="flex flex-wrap items-center gap-2 text-sm font-bold text-slate-800">{row.serialNumber} <StatusBadge status={row.status} /></p>
                                                        <p className="truncate text-xs text-slate-500">
                                                            {[row.productCode, row.productName, row.customerName, row.invoiceNumber].filter(Boolean).join(' · ')}
                                                        </p>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        disabled={added}
                                                        onClick={() => add([row])}
                                                        className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 text-[10px] font-black uppercase tracking-widest text-primary-600 hover:bg-primary-50 disabled:text-emerald-600 disabled:border-emerald-200 disabled:bg-emerald-50 disabled:cursor-default"
                                                    >
                                                        {added ? <><MdCheckCircle size={14} /> Added</> : <><MdAdd size={14} /> Add</>}
                                                    </button>
                                                </li>
                                            );
                                        })}
                                        {!searching && !results.rows.length && (
                                            <li className="px-4 py-3 text-sm text-slate-500">No serial numbers found in {fromName}.</li>
                                        )}
                                    </ul>
                                </div>
                            </>
                        )}
                    </div>

                    {selected.length > 0 && (
                        <div>
                            <span className={label}>Selected ({selected.length})</span>
                            {selectedTable(true)}
                            {tooMany && (
                                <p className="mt-2 text-xs font-semibold text-rose-600">
                                    A branch transfer can move up to {MAX_SERIALS_PER_BRANCH_TRANSFER} serial numbers at a time. Remove {selected.length - MAX_SERIALS_PER_BRANCH_TRANSFER} to continue.
                                </p>
                            )}
                        </div>
                    )}

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                        <div>
                            <label className={label} htmlFor="branchTransferReference">Transfer Reference</label>
                            <input id="branchTransferReference" value={reference} maxLength={100} onChange={(e) => setReference(e.target.value)} placeholder="Optional, e.g. delivery challan no." className={inputClass} />
                        </div>
                        <div className="md:col-span-2">
                            <label className={label} htmlFor="branchTransferRemarks">Remarks</label>
                            <input id="branchTransferRemarks" value={remarks} maxLength={500} onChange={(e) => setRemarks(e.target.value)} placeholder="Optional" className={inputClass} />
                        </div>
                    </div>
                    {saveError && <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{saveError}</p>}
                </div>
            )}
        </Modal>
    );
};

// Details of one branch transfer row: the serial as it is now and its complete branch history.
const BranchTransferDetails = ({ transfer, onClose }) => {
    const [result, setResult] = useState({ id: null, data: null, error: '' });
    useEffect(() => {
        let cancelled = false;
        serialTransferService.getSerialBranchHistory(transfer.assetId)
            .then((res) => { if (!cancelled) setResult({ id: transfer.assetId, data: res.data, error: '' }); })
            .catch((err) => { if (!cancelled) setResult({ id: transfer.assetId, data: null, error: err.response?.data?.message || 'Failed to load the branch history' }); });
        return () => { cancelled = true; };
    }, [transfer.assetId]);

    const { data, error } = result;
    const label = 'block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1';

    return (
        <Modal
            isOpen
            onClose={onClose}
            title={`Branch Transfer ${transfer.transferNo}`}
            maxWidth="max-w-5xl"
            footer={<button type="button" onClick={onClose} className="w-full md:w-auto px-6 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">Close</button>}
        >
            <div className="space-y-5">
                <div className="grid grid-cols-1 gap-4 rounded-2xl border border-slate-100 bg-slate-50 p-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div><span className={label}>Transfer No / Date</span><p className="text-sm font-bold text-slate-800">{transfer.transferNo}</p><p className="text-xs text-slate-500">{formatDateTime(transfer.transferDate)}</p></div>
                    <div><span className={label}>Branches</span><BranchRoute from={transfer.fromBranchName} to={transfer.toBranchName} /></div>
                    <div><span className={label}>Status When Moved</span><StatusBadge status={transfer.statusAtTransfer} /></div>
                    <div><span className={label}>Transferred By</span><p className="text-sm font-bold text-slate-800">{transfer.createdByName || '-'}</p></div>
                    <div className="sm:col-span-2"><span className={label}>Reference</span><p className="text-sm font-bold text-slate-800">{transfer.reference || '-'}</p></div>
                    <div className="sm:col-span-2"><span className={label}>Remarks</span><p className="text-sm font-medium text-slate-700">{transfer.remarks || '-'}</p></div>
                </div>

                {result.id !== transfer.assetId ? <Spinner /> : error ? (
                    <p className="rounded-2xl bg-rose-50 p-4 text-center text-sm font-medium text-rose-600">{error}</p>
                ) : (
                    <>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                            <div><span className={label}>Serial Number</span><p className="text-sm font-bold text-slate-800">{data.asset.serialNumber}</p></div>
                            <div><span className={label}>Product</span><p className="text-sm text-slate-600"><SerialSummary serial={data.asset} /></p></div>
                            <div><span className={label}>Current Branch</span><p className="text-sm font-bold text-slate-800">{data.asset.branchName || '-'}</p></div>
                            <div><span className={label}>Current Status</span><StatusBadge status={data.asset.status} /></div>
                        </div>
                        <div className="rounded-2xl border border-slate-100">
                            <h4 className="flex items-center gap-2 border-b border-slate-100 px-4 py-3 text-xs font-black uppercase tracking-widest text-slate-500">
                                <MdHistory size={16} /> Complete Branch History ({data.transfers.length})
                            </h4>
                            <div className="p-3 md:hidden">
                                <MobileCardList>
                                    {data.transfers.map((entry) => (
                                        <MobileCard key={entry._id} tone={sameId(entry._id, transfer._id) ? 'selected' : 'default'}>
                                            <MobileCardHead
                                                title={entry.transferNo}
                                                subtitle={formatDateTime(entry.transferDate)}
                                                aside={<StatusBadge status={entry.status} />}
                                            />
                                            <MobileFields>
                                                <MobileField label="From / To Branch" wide><BranchRoute from={entry.fromBranchName} to={entry.toBranchName} /></MobileField>
                                                {(entry.reference || entry.remarks) && (
                                                    <MobileField label="Reference / Remarks" wide>
                                                        {entry.reference && <span className="block font-bold text-slate-700">{entry.reference}</span>}
                                                        {entry.remarks}
                                                    </MobileField>
                                                )}
                                                <MobileField label="Transferred By" wide>{entry.createdByName || '-'}</MobileField>
                                            </MobileFields>
                                        </MobileCard>
                                    ))}
                                </MobileCardList>
                            </div>
                            <div className="serial-desktop-table overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50">
                                            {['Transfer No / Date', 'From / To Branch', 'Status When Moved', 'Reference / Remarks', 'Transferred By'].map((text) => <th key={text} className={thClass}>{text}</th>)}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.transfers.map((entry) => (
                                            <tr key={entry._id} className={`border-b last:border-0 border-slate-50 text-sm ${sameId(entry._id, transfer._id) ? 'bg-primary-50/50' : ''}`}>
                                                <td className="p-4 whitespace-nowrap">
                                                    <span className="font-bold text-slate-800">{entry.transferNo}</span>
                                                    <span className="block text-xs text-slate-500">{formatDateTime(entry.transferDate)}</span>
                                                </td>
                                                <td className="p-4"><BranchRoute from={entry.fromBranchName} to={entry.toBranchName} /></td>
                                                <td className="p-4"><StatusBadge status={entry.status} /></td>
                                                <td className="p-4 text-slate-500 min-w-[10rem]">
                                                    {entry.reference && <span className="block font-bold text-slate-700">{entry.reference}</span>}
                                                    {entry.remarks || (!entry.reference ? '-' : '')}
                                                </td>
                                                <td className="p-4 text-slate-500 whitespace-nowrap">{entry.createdByName || '-'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </Modal>
    );
};

const SerialNoTransfer = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const tab = TABS.some((item) => item.key === searchParams.get('tab')) ? searchParams.get('tab') : 'serials';
    const navigate = useNavigate();
    const openSerial = (assetId) => navigate(`/serial-no-transfer/${assetId}`);

    return (
        <div className="space-y-6">
            <div>
<<<<<<< HEAD
                <h1 className="text-3xl font-black text-slate-900 tracking-tight">Serial No Transfer</h1>
                <p className="text-slate-500 font-medium">Every Invoice Bulk Upload serial number with its branch and status. Move any serial to another customer or to another branch.</p>
=======
                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Serial No Transfer</h1>
                <p className="text-sm sm:text-base text-slate-500 font-medium">Every Invoice Bulk Upload serial number with its branch and status. Move sold serials to another customer, or any serial to another branch.</p>
>>>>>>> f06da8202d682688814cc0c79f79cc6b501d3d21
            </div>

            <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
                <div className="flex gap-1 overflow-x-auto border-b border-slate-100 px-2 sm:px-4 pt-2 sm:pt-4">
                    {TABS.map((item) => (
                        <button
                            key={item.key}
                            type="button"
                            onClick={() => setSearchParams(item.key === 'serials' ? {} : { tab: item.key })}
                            className={`shrink-0 whitespace-nowrap px-3 sm:px-5 py-3 text-xs font-black uppercase tracking-widest border-b-2 transition-all ${tab === item.key ? 'border-primary-600 text-primary-600' : 'border-transparent text-slate-400 hover:text-slate-700'}`}
                        >
                            {item.label}
                        </button>
                    ))}
                </div>
                {tab === 'serials' && (
                    <SerialListTab onOpen={openSerial} onTransfer={(assetId) => navigate(`/serial-no-transfer/${assetId}/transfer`)} />
                )}
                {tab === 'history' && <HistoryTab onOpen={openSerial} />}
                {tab === 'activity' && <ActivityTab onOpen={openSerial} />}
                {tab === 'branch' && <BranchTransferTab />}
            </div>
        </div>
    );
};

export default SerialNoTransfer;
