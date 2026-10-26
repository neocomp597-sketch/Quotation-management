import React, { useEffect, useState } from 'react';
import { MdSearch, MdInfoOutline, MdRateReview } from 'react-icons/md';
import { toast } from 'react-toastify';
import { stockAuditService } from '../../../services/api';
import { formatDateTime } from '../../../utils/helpers';
import Modal from '../../../components/Modal';
import LineHistory from './LineHistory';
import { INPUT, LABEL, NOTICE, SMALL, PRIMARY, fmtQty, fmtSigned, fmtMoney, varianceTone, locationText, errorMessage } from './shared';
import { Badge } from './ui';

const FILTERS = [
    { key: 'open', label: 'Open' },
    { key: 'recount', label: 'Recount requested' },
    { key: 'resolved', label: 'Resolved' },
    { key: 'review', label: 'All mismatches' }
];
const STATUSES = ['Open', 'Under Review', 'Recount Requested', 'Resolved'];
const RESOLUTIONS = ['Recount Matched', 'SAP Adjustment Posted', 'Write-off Approved', 'Data Entry Error', 'Located Elsewhere', 'Pending Inward / Outward', 'Accepted As Is', 'Other'];
const NOTE_REQUIRED = ['Other', 'Accepted As Is', 'Write-off Approved'];
const ROOT_CAUSES = ['Counting error', 'Goods receipt not posted in SAP', 'Issue / delivery not posted in SAP', 'Wrong bin / location', 'Wrong item code or UoM', 'Damage / scrap not recorded', 'Loss / pilferage', 'SAP master data error'];

const Fact = ({ label, children, className = '' }) => (
    <div className="min-w-0">
        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</div>
        <div className={`text-sm font-bold text-slate-700 break-words ${className}`}>{children ?? '—'}</div>
    </div>
);

const formFrom = (line) => ({
    status: line.mismatch?.status || 'Open',
    rootCause: line.mismatch?.rootCause || '',
    ownerEmail: line.mismatch?.ownerEmail || '',
    resolution: line.mismatch?.resolution || '',
    resolutionNote: line.mismatch?.resolutionNote || '',
    sapDocRef: line.mismatch?.sapDocRef || '',
    note: ''
});

// One discrepancy: what was found, what has been done about it, and the next step.
export const MismatchPanel = ({ batch, line, onSaved }) => {
    const [current, setCurrent] = useState(line);
    const [form, setForm] = useState(() => formFrom(line));
    const [saving, setSaving] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const access = batch.access || {};
    const m = current.mismatch || {};
    const members = [...new Set([batch.createdBy?.email, ...(batch.auditorEmails || []), ...(batch.viewerEmails || [])].filter(Boolean))];
    const statusOptions = STATUSES.filter(s => s !== 'Resolved' || access.canResolve || m.status === 'Resolved');
    const lockedResolved = m.status === 'Resolved' && !access.canResolve;
    const set = (field) => (e) => setForm(prev => ({ ...prev, [field]: e.target.value }));

    const save = async (e) => {
        e.preventDefault();
        if (form.status === 'Resolved' && !form.resolution) {
            toast.error('Choose how the mismatch was resolved.');
            return;
        }
        if (form.status === 'Resolved' && NOTE_REQUIRED.includes(form.resolution) && !form.resolutionNote.trim()) {
            toast.error('Add a resolution note.');
            return;
        }
        setSaving(true);
        try {
            const payload = lockedResolved ? { note: form.note } : form;
            const res = await stockAuditService.updateMismatch(batch._id, current._id, { ...payload, version: current.version });
            setCurrent(res.data);
            setForm(formFrom(res.data));
            toast.success('Mismatch updated');
            onSaved?.(res.data);
        } catch (error) {
            const latest = error.response?.status === 409 ? error.response.data?.item : null;
            if (latest) setCurrent(latest);
            toast.error(errorMessage(error, 'Failed to update the mismatch'));
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-5">
            <div>
                <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-mono text-base font-black text-slate-900">{current.itemCode}</span>
                    <Badge value={current.result} />
                    {m.status && <Badge value={m.status} />}
                </div>
                <div className="text-sm font-semibold text-slate-600">{current.itemName}</div>
                <div className="text-xs text-slate-400">{locationText(current) || 'No warehouse'}{current.uom ? ` · ${current.uom}` : ''}</div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 rounded-xl bg-slate-50">
                <Fact label="SAP qty">{fmtQty(current.sapQty)}</Fact>
                <Fact label="Counted">{fmtQty(current.countedQty)}</Fact>
                <Fact label="Variance" className={varianceTone(current.varianceQty)}>{fmtSigned(current.varianceQty)}</Fact>
                <Fact label="Value" className={varianceTone(current.varianceValue)}>{fmtSigned(current.varianceValue, fmtMoney)}</Fact>
                <Fact label="Unit price">{fmtMoney(current.unitPrice)}</Fact>
                <Fact label="Condition">{current.condition || '—'}</Fact>
                <Fact label="Counted by">{current.countedBy?.name}{current.countRounds > 1 ? ` (round ${current.countRounds})` : ''}</Fact>
                <Fact label="Counted on">{formatDateTime(current.countedAt)}</Fact>
                {(current.foundLocation || current.remarks) && (
                    <div className="col-span-2 sm:col-span-4 text-xs text-slate-600">
                        {current.foundLocation && <div><b>Found at:</b> {current.foundLocation}</div>}
                        {current.remarks && <div><b>Remarks:</b> {current.remarks}</div>}
                    </div>
                )}
            </div>

            {m.status === 'Resolved' && (
                <div className="p-3 rounded-xl border border-emerald-100 bg-emerald-50 text-sm text-emerald-900">
                    <b>Resolved:</b> {m.resolution}{m.sapDocRef ? ` · SAP doc ${m.sapDocRef}` : ''}
                    {m.resolutionNote && <div className="text-emerald-800">{m.resolutionNote}</div>}
                    <div className="text-xs text-emerald-700 mt-0.5">{m.resolvedBy?.name} · {formatDateTime(m.resolvedAt)}</div>
                </div>
            )}

            <div>
                <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Follow-up ({m.followUps?.length || 0})</h3>
                {!m.followUps?.length ? <p className="text-sm text-slate-400">No follow-up yet.</p> : (
                    <ol className="space-y-2 pl-4 border-l-2 border-teal-100">
                        {[...m.followUps].reverse().map(f => (
                            <li key={f._id || f.at} className="text-sm">
                                <div className="flex flex-wrap justify-between gap-x-2 text-[11px] font-semibold text-slate-400">
                                    <span>{f.by?.name || '—'}{f.status ? ` · ${f.status}` : ''}</span><span>{formatDateTime(f.at)}</span>
                                </div>
                                <div className="text-slate-700 whitespace-pre-line">{f.note}</div>
                            </li>
                        ))}
                    </ol>
                )}
            </div>

            {access.canReview ? (
                <form onSubmit={save} className="space-y-3 border-t border-slate-100 pt-4">
                    {!lockedResolved && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label className={LABEL} htmlFor="mm-status">Status</label>
                                <select id="mm-status" value={form.status} onChange={set('status')} className={INPUT}>
                                    {statusOptions.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className={LABEL} htmlFor="mm-owner">Follow-up owner</label>
                                <input id="mm-owner" list="mm-members" value={form.ownerEmail} onChange={set('ownerEmail')} className={INPUT} placeholder="email" />
                                <datalist id="mm-members">{members.map(e => <option key={e} value={e} />)}</datalist>
                            </div>
                            <div className="sm:col-span-2">
                                <label className={LABEL} htmlFor="mm-cause">Root cause</label>
                                <input id="mm-cause" list="mm-causes" value={form.rootCause} onChange={set('rootCause')} className={INPUT} placeholder="Why does the count differ from SAP?" />
                                <datalist id="mm-causes">{ROOT_CAUSES.map(c => <option key={c} value={c} />)}</datalist>
                            </div>
                            {form.status === 'Resolved' && (
                                <>
                                    <div>
                                        <label className={LABEL} htmlFor="mm-resolution">Resolution *</label>
                                        <select id="mm-resolution" value={form.resolution} onChange={set('resolution')} className={INPUT}>
                                            <option value="">Choose…</option>
                                            {RESOLUTIONS.map(r => <option key={r} value={r} disabled={r === 'Recount Matched' && current.result !== 'Matched'}>{r}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className={LABEL} htmlFor="mm-doc">SAP document no.</label>
                                        <input id="mm-doc" value={form.sapDocRef} onChange={set('sapDocRef')} className={INPUT} placeholder="Goods receipt / issue / journal no." />
                                    </div>
                                    <div className="sm:col-span-2">
                                        <label className={LABEL} htmlFor="mm-rnote">Resolution note{NOTE_REQUIRED.includes(form.resolution) ? ' *' : ''}</label>
                                        <input id="mm-rnote" value={form.resolutionNote} onChange={set('resolutionNote')} className={INPUT} />
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                    {form.status === 'Recount Requested' && m.status !== 'Recount Requested' && (
                        <p className="text-xs font-semibold text-amber-700">The line shows under “Recount requested” on the Count tab until someone records a new count.</p>
                    )}
                    <div>
                        <label className={LABEL} htmlFor="mm-note">Follow-up note</label>
                        <textarea id="mm-note" value={form.note} onChange={set('note')} rows={2} className={INPUT} placeholder="What was checked, who was contacted, what happens next" />
                    </div>
                    <div className="flex justify-end">
                        <button type="submit" disabled={saving} className={PRIMARY}>{saving ? 'Saving…' : 'Save follow-up'}</button>
                    </div>
                </form>
            ) : (
                <div className={NOTICE}><MdInfoOutline size={18} className="flex-shrink-0 mt-0.5" /><span>
                    {['Completed', 'Cancelled'].includes(batch.status) ? `The batch is ${batch.status.toLowerCase()}; follow-up is closed.` : batch.status === 'Draft' ? 'Follow-up opens when the audit starts.' : 'You have view-only access to this batch.'}
                </span></div>
            )}

            <div>
                <button type="button" onClick={() => setShowHistory(v => !v)} className="text-xs font-bold text-teal-700 hover:underline">
                    {showHistory ? 'Hide line history' : 'Show line history'}
                </button>
                {showHistory && <div className="mt-3"><LineHistory batchId={batch._id} itemId={current._id} /></div>}
            </div>
        </div>
    );
};

// Discrepancies between the SAP quantity and the physical count, and their follow-up.
const MismatchTab = ({ batch, onChanged, openLine, onLineClosed }) => {
    const [filter, setFilter] = useState('open');
    const [search, setSearch] = useState('');
    const [term, setTerm] = useState('');
    const [page, setPage] = useState(1);
    // Lines of the last finished request, tagged with that request's query.
    const [loaded, setLoaded] = useState({ key: null, data: { items: [], total: 0, pages: 1 } });
    const [picked, setPicked] = useState(null);
    const [reloadKey, setReloadKey] = useState(0);
    // A line opened from the dashboard shows until it is closed.
    const selected = picked || openLine;
    const query = { filter, search: term || undefined, sort: 'variance', page, limit: 50 };
    const requestKey = JSON.stringify({ ...query, reloadKey });
    const loading = loaded.key !== requestKey;
    const data = loaded.data;

    useEffect(() => {
        const t = setTimeout(() => { setTerm(search.trim()); setPage(1); }, 300);
        return () => clearTimeout(t);
    }, [search]);

    useEffect(() => {
        let cancelled = false;
        const { reloadKey: _reload, ...params } = JSON.parse(requestKey);
        stockAuditService.getItems(batch._id, params)
            .then(res => { if (!cancelled) setLoaded({ key: requestKey, data: res.data }); })
            .catch(err => {
                if (cancelled) return;
                setLoaded(prev => ({ ...prev, key: requestKey }));
                toast.error(errorMessage(err, 'Failed to load mismatches'));
            });
        return () => { cancelled = true; };
    }, [batch._id, requestKey]);

    const s = batch.summary || {};
    const close = () => {
        setPicked(null);
        onLineClosed?.();
    };

    return (
        <div className="space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                    ['Mismatched lines', s.mismatched, 'text-slate-900'],
                    ['Open', s.openMismatches, s.openMismatches ? 'text-rose-600' : 'text-slate-900'],
                    ['Recount requested', s.recountRequested, 'text-amber-600'],
                    ['Resolved', s.resolvedMismatches, 'text-emerald-600']
                ].map(([label, value, tone]) => (
                    <div key={label} className="bg-white border border-slate-100 rounded-xl p-3 shadow-sm">
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</div>
                        <div className={`text-xl font-black tabular-nums ${tone}`}>{value || 0}</div>
                    </div>
                ))}
            </div>

            <div className="flex flex-col lg:flex-row gap-2 lg:items-center">
                <div className="relative lg:w-80">
                    <MdSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Item code, name, bin, batch" className={`${INPUT} pl-9 !text-base sm:!text-sm`} />
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1">
                    {FILTERS.map(f => (
                        <button key={f.key} type="button" onClick={() => { setFilter(f.key); setPage(1); }}
                            className={`whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-bold border transition ${filter === f.key ? 'bg-teal-600 border-teal-600 text-white' : 'bg-white border-slate-200 text-slate-600 hover:bg-teal-50'}`}>
                            {f.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="text-xs font-bold text-slate-500">{loading ? 'Loading…' : `${data.total} line${data.total === 1 ? '' : 's'} · largest value first`}</div>

            {!loading && !data.items.length ? (
                <div className="py-12 text-center text-sm font-semibold text-slate-400">
                    {filter === 'open' ? 'No open mismatches.' : 'Nothing here.'}
                </div>
            ) : (
                <div className={`space-y-2 ${loading ? 'opacity-60' : ''}`}>
                    {data.items.map(l => {
                        const last = l.mismatch?.followUps?.[l.mismatch.followUps.length - 1];
                        return (
                            <button key={l._id} type="button" onClick={() => setPicked(l)}
                                className="w-full text-left rounded-2xl border border-slate-100 bg-white p-3 sm:p-4 shadow-sm hover:border-teal-200 hover:shadow-md transition">
                                <div className="flex flex-col md:flex-row md:items-start gap-3">
                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-1.5">
                                            <span className="font-mono text-sm font-black text-slate-900 break-all">{l.itemCode}</span>
                                            <Badge value={l.result} />
                                            {l.mismatch?.status && <Badge value={l.mismatch.status} />}
                                        </div>
                                        <div className="text-sm font-semibold text-slate-700 break-words">{l.itemName || '—'}</div>
                                        <div className="text-xs text-slate-400">{locationText(l) || 'No warehouse'}</div>
                                        {(l.mismatch?.rootCause || l.mismatch?.ownerEmail) && (
                                            <div className="text-xs font-semibold text-slate-500 mt-1">
                                                {[l.mismatch.rootCause && `Cause: ${l.mismatch.rootCause}`, l.mismatch.ownerEmail && `Owner: ${l.mismatch.ownerEmail}`].filter(Boolean).join(' · ')}
                                            </div>
                                        )}
                                        {last && <div className="text-xs text-slate-400 mt-1 truncate">Last: {last.note} — {last.by?.name}, {formatDateTime(last.at)}</div>}
                                    </div>
                                    <div className="grid grid-cols-4 gap-3 md:w-[360px] flex-shrink-0 text-right">
                                        <div><div className="text-[10px] font-black text-slate-400 uppercase">SAP</div><div className="font-black tabular-nums">{fmtQty(l.sapQty)}</div></div>
                                        <div><div className="text-[10px] font-black text-slate-400 uppercase">Counted</div><div className="font-black tabular-nums">{fmtQty(l.countedQty)}</div></div>
                                        <div><div className="text-[10px] font-black text-slate-400 uppercase">Var.</div><div className={`font-black tabular-nums ${varianceTone(l.varianceQty)}`}>{fmtSigned(l.varianceQty)}</div></div>
                                        <div><div className="text-[10px] font-black text-slate-400 uppercase">Value</div><div className={`font-black tabular-nums ${varianceTone(l.varianceValue)}`}>{fmtSigned(l.varianceValue, fmtMoney)}</div></div>
                                    </div>
                                </div>
                                <div className="mt-2 flex justify-end">
                                    <span className="inline-flex items-center gap-1 text-xs font-bold text-teal-700"><MdRateReview size={14} /> Review & follow up</span>
                                </div>
                            </button>
                        );
                    })}
                </div>
            )}

            {data.pages > 1 && (
                <div className="flex items-center justify-center gap-3 pt-2">
                    <button type="button" className={SMALL} disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</button>
                    <span className="text-xs font-bold text-slate-500">Page {page} of {data.pages}</span>
                    <button type="button" className={SMALL} disabled={page >= data.pages} onClick={() => setPage(p => p + 1)}>Next</button>
                </div>
            )}

            <Modal isOpen={Boolean(selected)} onClose={close} title="Mismatch review" maxWidth="max-w-3xl">
                {selected && (
                    <MismatchPanel
                        key={selected._id}
                        batch={batch}
                        line={selected}
                        onSaved={() => {
                            setReloadKey(k => k + 1);
                            onChanged?.();
                        }}
                    />
                )}
            </Modal>
        </div>
    );
};

export default MismatchTab;
