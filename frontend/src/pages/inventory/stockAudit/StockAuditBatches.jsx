import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MdAdd, MdFactCheck, MdSearch, MdInfoOutline } from 'react-icons/md';
import { toast } from 'react-toastify';
import { stockAuditService } from '../../../services/api';
import { formatDate } from '../../../utils/helpers';
import usePermission from '../../../hooks/usePermission';
import { PRIMARY, INPUT, NOTICE, ROLE_LABEL, fmtMoney, fmtMoneyShort, fmtSigned, varianceTone, errorMessage } from './shared';
import { Badge, ProgressBar } from './ui';

const STATUS_FILTERS = ['', 'Draft', 'In Progress', 'Under Review', 'Completed', 'Cancelled'];

const Stat = ({ label, value, title, className = 'text-slate-800' }) => (
    <div className="min-w-0" title={title}>
        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest truncate">{label}</div>
        <div className={`text-sm font-black tabular-nums whitespace-nowrap ${className}`}>{value}</div>
    </div>
);

// Stock audit batches the user can open: their own, the ones shared with them, or all (admins).
const StockAuditBatches = () => {
    const navigate = useNavigate();
    // Batches of the last finished request, tagged with that request's filters.
    const [loaded, setLoaded] = useState({ key: null, batches: [] });
    const [canCreate, setCanCreate] = useState(false);
    const { canCreate: canCreateBatch } = usePermission('inventory_sap_audit');
    const [status, setStatus] = useState('');
    const [search, setSearch] = useState('');
    const [term, setTerm] = useState('');

    useEffect(() => {
        stockAuditService.getMeta().then(res => setCanCreate(Boolean(res.data?.canCreate))).catch(() => setCanCreate(false));
    }, []);

    useEffect(() => {
        const t = setTimeout(() => setTerm(search.trim()), 300);
        return () => clearTimeout(t);
    }, [search]);

    const requestKey = `${status}|${term}`;
    const loading = loaded.key !== requestKey;
    const batches = loaded.batches;

    useEffect(() => {
        let cancelled = false;
        stockAuditService.getAll({ status: status || undefined, search: term || undefined })
            .then(res => { if (!cancelled) setLoaded({ key: requestKey, batches: res.data || [] }); })
            .catch(err => {
                if (cancelled) return;
                setLoaded({ key: requestKey, batches: [] });
                toast.error(errorMessage(err, 'Failed to load audit batches'));
            });
        return () => { cancelled = true; };
    }, [status, term, requestKey]);

    return (
        <div className="space-y-5 min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="w-12 h-12 flex-shrink-0 rounded-2xl bg-gradient-to-br from-teal-500 to-teal-700 flex items-center justify-center text-white shadow-md">
                        <MdFactCheck size={26} />
                    </div>
                    <div className="min-w-0">
                        <h1 className="text-2xl font-black text-slate-900 tracking-tight">SAP Stock Audit</h1>
                        <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">SAP B1 book stock · Physical count · Mismatch follow-up</p>
                    </div>
                </div>
                {canCreate && canCreateBatch && (
                    <button type="button" onClick={() => navigate('/inventory/stock-audit/new')} className={PRIMARY}>
                        <MdAdd size={18} /> New audit batch
                    </button>
                )}
            </div>

            <div className="flex flex-col md:flex-row gap-3 md:items-center">
                <div className="relative md:w-80">
                    <MdSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search batch, SAP reference, owner..." className={`${INPUT} pl-9`} />
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1">
                    {STATUS_FILTERS.map(s => (
                        <button
                            key={s || 'all'}
                            type="button"
                            onClick={() => setStatus(s)}
                            className={`whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-bold border transition ${status === s ? 'bg-teal-600 border-teal-600 text-white' : 'bg-white border-slate-200 text-slate-600 hover:bg-teal-50'}`}
                        >
                            {s || 'All'}
                        </button>
                    ))}
                </div>
            </div>

            {loading ? (
                <div className="py-20 text-center text-sm text-slate-500">Loading audit batches...</div>
            ) : batches.length === 0 ? (
                <div className="py-16 text-center space-y-3">
                    <p className="text-slate-500 font-bold">No audit batches{status || term ? ' match these filters' : ' yet'}.</p>
                    {!(canCreate && canCreateBatch) && !status && !term && (
                        <div className={`${NOTICE} max-w-xl mx-auto text-left`}>
                            <MdInfoOutline size={18} className="flex-shrink-0 mt-0.5" />
                            <span>Batches appear here when their owner adds your email as an auditor or viewer.</span>
                        </div>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-4">
                    {batches.map(b => {
                        const s = b.summary || {};
                        return (
                            <button
                                key={b._id}
                                type="button"
                                onClick={() => navigate(`/inventory/stock-audit/${b._id}`)}
                                className="text-left bg-white border border-slate-100 rounded-2xl p-4 sm:p-5 shadow-sm hover:shadow-md hover:border-teal-200 transition-all min-w-0"
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                        <div className="font-mono text-sm font-black text-slate-900 break-all">{b.name}</div>
                                        <div className="text-[11px] font-semibold text-slate-400 mt-0.5">
                                            {b.auditType} · by {b.createdBy?.name || '—'} · {formatDate(b.createdAt)}
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                        <Badge value={b.status} />
                                        {b.access?.role && <Badge value={b.access.role}>{ROLE_LABEL[b.access.role]}</Badge>}
                                    </div>
                                </div>
                                <div className="mt-4">
                                    <div className="flex justify-between text-[11px] font-bold text-slate-500 mb-1">
                                        <span>{s.counted || 0} of {s.lines || 0} lines counted</span>
                                        <span>{s.progressPct || 0}%</span>
                                    </div>
                                    <ProgressBar value={s.progressPct} />
                                </div>
                                <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
                                    <Stat label="Pending" value={s.pending || 0} />
                                    <Stat label="Matched" value={s.matched || 0} className="text-emerald-600" />
                                    <Stat label="Open issues" value={s.openMismatches || 0} className={s.openMismatches ? 'text-rose-600' : 'text-slate-800'} />
                                    <Stat label="Net variance" value={fmtSigned(s.varianceValue, fmtMoneyShort)} title={fmtSigned(s.varianceValue, fmtMoney)} className={varianceTone(s.varianceValue)} />
                                </div>
                                {(b.plannedStart || b.plannedEnd || b.sapReference) && (
                                    <div className="mt-3 text-[11px] font-semibold text-slate-400 truncate">
                                        {[b.sapReference && `SAP: ${b.sapReference}`, (b.plannedStart || b.plannedEnd) && `Planned ${formatDate(b.plannedStart, '…')} – ${formatDate(b.plannedEnd, '…')}`].filter(Boolean).join(' · ')}
                                    </div>
                                )}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default StockAuditBatches;
