import React, { useCallback, useEffect, useRef, useState } from 'react';
import { MdSearch, MdSave, MdHistory, MdExpandMore, MdInfoOutline } from 'react-icons/md';
import { toast } from 'react-toastify';
import { stockAuditService } from '../../../services/api';
import { formatDateTime } from '../../../utils/helpers';
import Modal from '../../../components/Modal';
import LineHistory from './LineHistory';
import { INPUT, NOTICE, SMALL, fmtQty, fmtSigned, fmtMoney, varianceTone, locationText, errorMessage } from './shared';
import { Badge } from './ui';

const CONDITIONS = ['Good', 'Damaged', 'Expired', 'Obsolete', 'Not Found'];
const FILTERS = [
    { key: 'pending', label: 'To count' },
    { key: 'recount', label: 'Recount requested' },
    { key: 'counted', label: 'Counted' },
    { key: 'mismatched', label: 'Mismatched' },
    { key: '', label: 'All lines' }
];
const SORTS = [
    { key: 'location', label: 'Warehouse / bin' },
    { key: 'line', label: 'Line no.' },
    { key: 'code', label: 'Item code' },
    { key: 'recent', label: 'Recently counted' },
    { key: 'variance', label: 'Largest variance' }
];
const PAGE_SIZE = 50;

const draftOf = (line) => ({
    countedQty: line.countedQty === null || line.countedQty === undefined ? '' : String(line.countedQty),
    condition: line.condition || '',
    foundLocation: line.foundLocation || '',
    remarks: line.remarks || ''
});
const isDirty = (line, draft) => {
    if (!draft) return false;
    const base = draftOf(line);
    return Object.keys(base).some(k => String(draft[k]).trim() !== String(base[k]).trim());
};

const CountLine = ({ line, draft, onDraft, onSave, saving, canCount, registerInput, onHistory }) => {
    const [open, setOpen] = useState(false);
    const value = draft || draftOf(line);
    const dirty = isDirty(line, draft);
    const set = (field) => (e) => onDraft(line._id, { ...value, [field]: e.target.value });
    const counted = line.result !== 'Pending';
    const showDetails = open || Boolean(line.foundLocation || line.remarks);

    return (
        <div className={`rounded-2xl border bg-white p-3 sm:p-4 transition ${dirty ? 'border-amber-300 shadow-md' : 'border-slate-100 shadow-sm'}`}>
            <div className="flex flex-col lg:flex-row lg:items-start gap-3">
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-mono text-sm font-black text-slate-900 break-all">{line.itemCode}</span>
                        <span className="text-[11px] font-semibold text-slate-400">#{line.lineNo}</span>
                        <Badge value={line.result} />
                        {line.mismatch?.status && <Badge value={line.mismatch.status} />}
                    </div>
                    <div className="text-sm font-semibold text-slate-700 break-words">{line.itemName || '—'}</div>
                    <div className="text-xs font-semibold text-slate-400 break-words">
                        {[locationText(line) || 'No warehouse', line.uom, line.itemGroup].filter(Boolean).join(' · ')}
                    </div>
                </div>

                <div className="grid grid-cols-3 gap-2 lg:w-[380px] flex-shrink-0">
                    <div>
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">SAP qty</div>
                        <div className="text-lg font-black text-slate-800 tabular-nums">{fmtQty(line.sapQty)}</div>
                    </div>
                    <div>
                        <label htmlFor={`qty-${line._id}`} className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Counted</label>
                        <input
                            id={`qty-${line._id}`}
                            ref={(el) => registerInput(line._id, el)}
                            type="text"
                            inputMode="decimal"
                            enterKeyHint="next"
                            autoComplete="off"
                            value={value.countedQty}
                            onChange={set('countedQty')}
                            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onSave(line, { next: true }); } }}
                            disabled={!canCount || saving}
                            placeholder="—"
                            className={`${INPUT} !text-base !py-1.5 tabular-nums`}
                        />
                    </div>
                    <div>
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Variance</div>
                        <div className={`text-lg font-black tabular-nums ${counted ? varianceTone(line.varianceQty) : 'text-slate-300'}`}>
                            {counted ? fmtSigned(line.varianceQty) : '—'}
                        </div>
                        {counted && line.varianceValue ? <div className={`text-[11px] font-bold ${varianceTone(line.varianceValue)}`}>{fmtSigned(line.varianceValue, fmtMoney)}</div> : null}
                    </div>
                </div>

                <div className="flex gap-2 lg:w-[230px] flex-shrink-0">
                    <select
                        value={value.condition}
                        onChange={set('condition')}
                        disabled={!canCount || saving}
                        className={`${INPUT} !text-base sm:!text-sm !py-1.5`}
                        aria-label="Condition"
                    >
                        <option value="">Condition</option>
                        {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    {canCount && (
                        <button
                            type="button"
                            onClick={() => onSave(line)}
                            disabled={!dirty || saving}
                            className="flex-shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-sm font-black transition"
                        >
                            <MdSave size={16} /> {saving ? '…' : 'Save'}
                        </button>
                    )}
                </div>
            </div>

            {showDetails && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
                    <input value={value.foundLocation} onChange={set('foundLocation')} disabled={!canCount || saving} placeholder="Found at (bin / rack, if different)" className={`${INPUT} !text-base sm:!text-sm`} aria-label="Found at" />
                    <input value={value.remarks} onChange={set('remarks')} disabled={!canCount || saving} placeholder="Remarks" className={`${INPUT} !text-base sm:!text-sm`} aria-label="Remarks" />
                </div>
            )}

            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] font-semibold text-slate-400">
                <span>
                    {counted ? `Counted by ${line.countedBy?.name || '—'} · ${formatDateTime(line.countedAt)}${line.countRounds > 1 ? ` · round ${line.countRounds}` : ''}` : 'Not counted yet'}
                </span>
                <span className="flex gap-3">
                    {!showDetails && canCount && (
                        <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-0.5 text-teal-700 hover:underline">
                            <MdExpandMore size={14} /> Location / remarks
                        </button>
                    )}
                    <button type="button" onClick={() => onHistory(line)} className="inline-flex items-center gap-0.5 text-teal-700 hover:underline">
                        <MdHistory size={14} /> History
                    </button>
                </span>
            </div>
        </div>
    );
};

// Count entry: the lines of the batch with their SAP quantity, a field for the physical count
// and the condition / location / remarks found. Works the same on a phone.
const CountTab = ({ batch, onChanged }) => {
    const canCount = batch.access?.canCount;
    const [filter, setFilter] = useState(canCount ? 'pending' : '');
    const [warehouse, setWarehouse] = useState('');
    const [sort, setSort] = useState('location');
    const [search, setSearch] = useState('');
    const [term, setTerm] = useState('');
    const [page, setPage] = useState(1);
    // Lines of the last finished request, tagged with that request's query.
    const [loaded, setLoaded] = useState({ key: null, data: { items: [], total: 0, pages: 1, warehouses: [] } });
    const [drafts, setDrafts] = useState({});
    const [saving, setSaving] = useState({});
    const [historyLine, setHistoryLine] = useState(null);
    const inputs = useRef({});
    const requestKey = JSON.stringify({ filter: filter || undefined, warehouse: warehouse || undefined, sort, search: term || undefined, page, limit: PAGE_SIZE });
    const loading = loaded.key !== requestKey;
    const data = loaded.data;

    useEffect(() => {
        const t = setTimeout(() => { setTerm(search.trim()); setPage(1); }, 300);
        return () => clearTimeout(t);
    }, [search]);

    useEffect(() => {
        let cancelled = false;
        stockAuditService.getItems(batch._id, JSON.parse(requestKey))
            .then(res => {
                if (cancelled) return;
                setLoaded({ key: requestKey, data: res.data });
                // A scanned or typed code that finds exactly one line goes straight to its count field.
                if (term && res.data.items.length === 1 && canCount) {
                    setTimeout(() => inputs.current[res.data.items[0]._id]?.focus(), 50);
                }
            })
            .catch(err => {
                if (cancelled) return;
                setLoaded(prev => ({ ...prev, key: requestKey }));
                toast.error(errorMessage(err, 'Failed to load lines'));
            });
        return () => { cancelled = true; };
    }, [batch._id, requestKey, term, canCount]);

    const registerInput = useCallback((id, el) => { inputs.current[id] = el; }, []);
    const onDraft = useCallback((id, draft) => setDrafts(prev => ({ ...prev, [id]: draft })), []);

    const replaceLine = (line) => setLoaded(prev => ({ ...prev, data: { ...prev.data, items: prev.data.items.map(i => (i._id === line._id ? line : i)) } }));

    const save = async (line, { next = false } = {}) => {
        const draft = drafts[line._id];
        const focusNext = () => {
            if (!next) return;
            const ids = data.items.map(i => i._id);
            const nextId = ids[ids.indexOf(line._id) + 1];
            if (nextId) inputs.current[nextId]?.focus();
        };
        if (!isDirty(line, draft)) {
            focusNext();
            return;
        }
        setSaving(prev => ({ ...prev, [line._id]: true }));
        try {
            const res = await stockAuditService.recordCount(batch._id, line._id, {
                countedQty: draft.countedQty.trim() === '' ? null : draft.countedQty.trim(),
                condition: draft.condition,
                foundLocation: draft.foundLocation,
                remarks: draft.remarks,
                version: line.version
            });
            replaceLine(res.data);
            setDrafts(prev => {
                const copy = { ...prev };
                delete copy[line._id];
                return copy;
            });
            if (res.data.result === 'Short' || res.data.result === 'Excess') {
                toast.warn(`${line.itemCode}: ${res.data.result.toLowerCase()} by ${fmtQty(Math.abs(res.data.varianceQty))} ${line.uom || ''}`.trim(), { autoClose: 2500 });
            }
            onChanged?.();
            focusNext();
        } catch (error) {
            const latest = error.response?.status === 409 ? error.response.data?.item : null;
            if (latest) {
                // Keep what the user typed; the line now carries the latest version, so saving again overwrites knowingly.
                replaceLine(latest);
                toast.warn(errorMessage(error, 'This line was changed meanwhile.'));
            } else {
                toast.error(errorMessage(error, 'Failed to save the count'));
            }
        } finally {
            setSaving(prev => ({ ...prev, [line._id]: false }));
        }
    };

    const unsaved = Object.keys(drafts).filter(id => {
        const line = data.items.find(i => i._id === id);
        return line && isDirty(line, drafts[id]);
    }).length;

    return (
        <div className="space-y-3">
            {!canCount && (
                <div className={NOTICE}>
                    <MdInfoOutline size={18} className="flex-shrink-0 mt-0.5" />
                    <span>
                        {batch.status === 'Draft' ? 'Counting opens when the owner starts the audit.'
                            : ['Completed', 'Cancelled'].includes(batch.status) ? `This batch is ${batch.status.toLowerCase()}; counts are read-only.`
                                : 'You have view-only access to this batch.'}
                    </span>
                </div>
            )}
            <div className="flex flex-col xl:flex-row gap-2 xl:items-center">
                <div className="relative xl:w-80">
                    <MdSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Scan or type item code, name, bin, batch"
                        className={`${INPUT} pl-9 !text-base sm:!text-sm`}
                        enterKeyHint="search"
                        autoComplete="off"
                    />
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1">
                    {FILTERS.map(f => (
                        <button
                            key={f.key || 'all'}
                            type="button"
                            onClick={() => { setFilter(f.key); setPage(1); }}
                            className={`whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-bold border transition ${filter === f.key ? 'bg-teal-600 border-teal-600 text-white' : 'bg-white border-slate-200 text-slate-600 hover:bg-teal-50'}`}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>
                <div className="flex gap-2 xl:ml-auto">
                    <select value={warehouse} onChange={(e) => { setWarehouse(e.target.value); setPage(1); }} className={`${INPUT} !py-1.5`} aria-label="Warehouse">
                        <option value="">All warehouses</option>
                        {data.warehouses.map(w => <option key={w} value={w}>{w}</option>)}
                    </select>
                    <select value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }} className={`${INPUT} !py-1.5`} aria-label="Sort">
                        {SORTS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                    </select>
                </div>
            </div>

            <div className="flex justify-between items-center text-xs font-bold text-slate-500">
                <span>{loading ? 'Loading…' : `${data.total} line${data.total === 1 ? '' : 's'}`}</span>
                {unsaved > 0 && <span className="text-amber-600">{unsaved} unsaved change{unsaved > 1 ? 's' : ''}</span>}
            </div>

            {!loading && data.items.length === 0 ? (
                <div className="py-12 text-center text-sm font-semibold text-slate-400">
                    {filter === 'pending' && !term && !warehouse ? 'Every line is counted.' : 'No lines match.'}
                </div>
            ) : (
                <div className={`space-y-2 ${loading ? 'opacity-60' : ''}`}>
                    {data.items.map(line => (
                        <CountLine
                            key={line._id}
                            line={line}
                            draft={drafts[line._id]}
                            onDraft={onDraft}
                            onSave={save}
                            saving={Boolean(saving[line._id])}
                            canCount={canCount}
                            registerInput={registerInput}
                            onHistory={setHistoryLine}
                        />
                    ))}
                </div>
            )}

            {data.pages > 1 && (
                <div className="flex items-center justify-center gap-3 pt-2">
                    <button type="button" className={SMALL} disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</button>
                    <span className="text-xs font-bold text-slate-500">Page {page} of {data.pages}</span>
                    <button type="button" className={SMALL} disabled={page >= data.pages} onClick={() => setPage(p => p + 1)}>Next</button>
                </div>
            )}

            <Modal isOpen={Boolean(historyLine)} onClose={() => setHistoryLine(null)} title={historyLine ? `History · ${historyLine.itemCode}` : ''} maxWidth="max-w-xl">
                {historyLine && <LineHistory batchId={batch._id} itemId={historyLine._id} />}
            </Modal>
        </div>
    );
};

export default CountTab;
