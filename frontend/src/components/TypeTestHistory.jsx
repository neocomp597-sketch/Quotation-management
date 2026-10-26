import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MdExpandMore } from 'react-icons/md';
import { typeTestService } from '../services/api';
import { formatDate, formatDateTime } from '../utils/helpers';
import { useAuth } from '../context/AuthContext';
import { testDateOf, byLatestTest } from '../utils/typeTests';

const badgeTone = (s) => {
    if (s === 'Valid') return 'bg-emerald-50 text-emerald-700 border-emerald-100';
    if (['Expired', 'Inactive'].includes(s)) return 'bg-rose-50 text-rose-700 border-rose-100';
    if (['In Progress', 'Renewal In Progress'].includes(s)) return 'bg-amber-50 text-amber-700 border-amber-100';
    return 'bg-slate-50 text-slate-600 border-slate-200';
};
const resultTone = (s) => (s === 'Pass' ? 'text-emerald-700' : s === 'Fail' ? 'text-rose-700' : '');

const Item = ({ label, className = '', children }) => (
    <div className="min-w-0">
        <dt className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</dt>
        <dd className={`text-xs font-bold text-slate-700 break-words ${className}`}>{children || '—'}</dd>
    </div>
);

const Chevron = ({ open }) => (
    <MdExpandMore size={18} className={`flex-shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
);

// Type test records kept for one product, latest test first. Reloads when the product changes.
// The section starts collapsed, and each record opens on its own from a one-line summary.
const TypeTestHistory = ({ productId }) => {
    const { hasAccess } = useAuth();
    const canOpenRegister = hasAccess('master_type_tests');
    // Tagged with the product it belongs to, so switching products shows "loading" at once.
    const [loaded, setLoaded] = useState({ productId: null, records: [], error: false });
    const [open, setOpen] = useState(false);
    const [expandedIds, setExpandedIds] = useState(() => new Set());
    const state = loaded.productId !== productId ? 'loading' : loaded.error ? 'error' : 'ready';
    const records = state === 'ready' ? loaded.records : [];
    const latest = records[0];

    useEffect(() => {
        if (!productId) return undefined;
        let cancelled = false;
        typeTestService.getAll({ productId })
            .then(res => {
                if (!cancelled) setLoaded({ productId, records: [...(res.data || [])].sort(byLatestTest), error: false });
            })
            .catch(err => {
                console.error('Failed to load type test history:', err);
                if (!cancelled) setLoaded({ productId, records: [], error: true });
            });
        return () => { cancelled = true; };
    }, [productId]);

    const toggleRecord = (id) => setExpandedIds(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
    });

    return (
        <div className="mt-6">
            <button
                type="button"
                onClick={() => setOpen(o => !o)}
                aria-expanded={open}
                className="w-full flex items-center justify-between gap-2 mb-2 text-left"
            >
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Test Type History{state === 'ready' && records.length ? ` (${records.length})` : ''}
                </span>
                <span className="flex items-center gap-1 text-[10px] font-black text-primary-600 uppercase tracking-widest">
                    {open ? 'Hide' : 'Show'}
                    <Chevron open={open} />
                </span>
            </button>
            {!open && state === 'ready' && latest && (
                <p className="text-xs font-medium text-slate-500 truncate">
                    Latest: <span className="font-bold text-slate-700">{latest.testName}</span>
                    {testDateOf(latest) ? ` · ${formatDate(testDateOf(latest))}` : ''}
                    {latest.displayStatus ? ` · ${latest.displayStatus}` : ''}
                </p>
            )}
            {open && state === 'loading' && <p className="text-xs font-medium text-slate-500">Loading test history...</p>}
            {open && state === 'error' && <p className="text-xs font-medium text-rose-600">Could not load the test history.</p>}
            {open && state === 'ready' && !records.length && (
                <p className="px-4 py-3 rounded-2xl border border-dashed border-slate-200 text-xs font-bold text-slate-500 text-center">
                    No test history available for this product.
                </p>
            )}
            {open && state === 'ready' && records.length > 0 && (
                <ol className="space-y-2">
                    {records.map(r => {
                        const c = r.currentCertificate || {};
                        const testDate = testDateOf(r);
                        const expanded = expandedIds.has(r._id);
                        return (
                            <li key={r._id} className="rounded-2xl border border-slate-200 bg-white">
                                <button
                                    type="button"
                                    onClick={() => toggleRecord(r._id)}
                                    aria-expanded={expanded}
                                    className="w-full p-4 flex items-start justify-between gap-2 text-left"
                                >
                                    <div className="min-w-0">
                                        <div className="text-sm font-black text-slate-800 break-words">{r.testName}</div>
                                        <div className="text-[11px] font-semibold text-slate-400">
                                            {testDate ? `Tested ${formatDate(testDate)}` : `Recorded ${formatDateTime(r.createdAt)}`}
                                            {r.testResult && <> · <span className={resultTone(r.testResult)}>{r.testResult}</span></>}
                                        </div>
                                    </div>
                                    <span className="flex flex-shrink-0 items-center gap-1.5">
                                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-black whitespace-nowrap ${badgeTone(r.displayStatus)}`}>
                                            {r.displayStatus}
                                        </span>
                                        <Chevron open={expanded} />
                                    </span>
                                </button>
                                {expanded && (
                                    <div className="px-4 pb-4">
                                        <div className="text-[11px] font-semibold text-slate-400">Recorded {formatDateTime(r.createdAt)}</div>
                                        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2">
                                            <Item label="Test date">{testDate && formatDate(testDate)}</Item>
                                            <Item label="Test result" className={resultTone(r.testResult)}>{r.testResult}</Item>
                                            <Item label="Model">{r.modelName}</Item>
                                            <Item label="Standard">{r.testStandard}</Item>
                                            <Item label="Laboratory">{r.testingAgency}</Item>
                                            <Item label="Owner">{r.ownerId?.name}</Item>
                                            <Item label="Certificate">{c.certificateNo}</Item>
                                            <Item label="Valid until">{c.validUntil && formatDate(c.validUntil)}</Item>
                                        </dl>
                                        {(r.certificateHistory?.length > 0 || canOpenRegister) && (
                                            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] font-bold text-slate-500">
                                                <span>{r.certificateHistory?.length ? `${r.certificateHistory.length} earlier certificate${r.certificateHistory.length > 1 ? 's' : ''}` : ''}</span>
                                                {canOpenRegister && (
                                                    <Link to={`/type-tests?tab=tests&history=${r._id}`} className="text-primary-600 hover:underline">
                                                        Open full history
                                                    </Link>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </li>
                        );
                    })}
                </ol>
            )}
        </div>
    );
};

export default TypeTestHistory;
