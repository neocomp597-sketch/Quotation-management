import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
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

// Type test records kept for one product, latest test first. Reloads when the product changes.
const TypeTestHistory = ({ productId }) => {
    const { hasAccess } = useAuth();
    const canOpenRegister = hasAccess('master_type_tests');
    // Tagged with the product it belongs to, so switching products shows "loading" at once.
    const [loaded, setLoaded] = useState({ productId: null, records: [], error: false });
    const state = loaded.productId !== productId ? 'loading' : loaded.error ? 'error' : 'ready';
    const records = state === 'ready' ? loaded.records : [];

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

    return (
        <div className="mt-6">
            <div className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                Test Type History{state === 'ready' && records.length ? ` (${records.length})` : ''}
            </div>
            {state === 'loading' && <p className="text-xs font-medium text-slate-500">Loading test history...</p>}
            {state === 'error' && <p className="text-xs font-medium text-rose-600">Could not load the test history.</p>}
            {state === 'ready' && !records.length && (
                <p className="px-4 py-3 rounded-2xl border border-dashed border-slate-200 text-xs font-bold text-slate-500 text-center">
                    No test history available for this product.
                </p>
            )}
            {state === 'ready' && records.length > 0 && (
                <ol className="space-y-3">
                    {records.map(r => {
                        const c = r.currentCertificate || {};
                        const testDate = testDateOf(r);
                        return (
                            <li key={r._id} className="p-4 rounded-2xl border border-slate-200 bg-white">
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                        <div className="text-sm font-black text-slate-800 break-words">{r.testName}</div>
                                        <div className="text-[11px] font-semibold text-slate-400">Recorded {formatDateTime(r.createdAt)}</div>
                                    </div>
                                    <span className={`flex-shrink-0 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-black whitespace-nowrap ${badgeTone(r.displayStatus)}`}>
                                        {r.displayStatus}
                                    </span>
                                </div>
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
                            </li>
                        );
                    })}
                </ol>
            )}
        </div>
    );
};

export default TypeTestHistory;
