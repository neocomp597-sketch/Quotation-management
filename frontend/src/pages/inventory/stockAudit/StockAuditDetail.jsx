import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
    MdArrowBack, MdDashboard, MdPlaylistAddCheck, MdReportProblem, MdInventory2, MdGroup, MdHistory,
    MdEdit, MdDownload, MdPlayArrow, MdSend, MdTaskAlt, MdReplay, MdBlock, MdDelete
} from 'react-icons/md';
import { toast } from 'react-toastify';
import { stockAuditService } from '../../../services/api';
import { formatDate, formatDateTime } from '../../../utils/helpers';
import Modal from '../../../components/Modal';
import usePermission from '../../../hooks/usePermission';
import BatchFields from './BatchFields';
import DashboardTab from './DashboardTab';
import CountTab from './CountTab';
import MismatchTab from './MismatchTab';
import ScopeTab from './ScopeTab';
import AccessTab from './AccessTab';
import ActivityTab from './ActivityTab';
import { PRIMARY, SECONDARY, DANGER, INPUT, LABEL, ROLE_LABEL, fmtMoney, fmtMoneyShort, fmtSigned, varianceTone, errorMessage, downloadBlob, batchFormFrom, batchPayload } from './shared';
import { Badge, ProgressBar } from './ui';

const TABS = [
    { key: 'overview', label: 'Dashboard', icon: MdDashboard },
    { key: 'count', label: 'Count', icon: MdPlaylistAddCheck },
    { key: 'mismatches', label: 'Mismatches', icon: MdReportProblem },
    { key: 'scope', label: 'Scope', icon: MdInventory2 },
    { key: 'access', label: 'Access', icon: MdGroup },
    { key: 'activity', label: 'Audit trail', icon: MdHistory }
];

// Owner actions by batch status. `reason` actions ask why before going ahead.
const ACTIONS = {
    Draft: [{ action: 'start', label: 'Start audit', icon: MdPlayArrow, primary: true }, { action: 'cancel', label: 'Cancel', icon: MdBlock, reason: true }],
    'In Progress': [{ action: 'submit', label: 'Submit for review', icon: MdSend, primary: true }, { action: 'cancel', label: 'Cancel audit', icon: MdBlock, reason: true }],
    'Under Review': [
        { action: 'complete', label: 'Complete audit', icon: MdTaskAlt, primary: true },
        { action: 'reopen', label: 'Reopen counting', icon: MdReplay, reason: true },
        { action: 'cancel', label: 'Cancel audit', icon: MdBlock, reason: true }
    ],
    Completed: [{ action: 'reopen', label: 'Reopen', icon: MdReplay, reason: true }],
    Cancelled: []
};
const CONFIRM = {
    start: 'Start the audit? Auditors can then record counts.',
    submit: 'Submit for review? Every line is counted; mismatches can still be followed up and recounted.',
    complete: 'Complete the audit? The batch becomes read-only.'
};

// First tab for a batch opened without ?tab=: the owner sets up a draft's scope, auditors count.
const defaultTabFor = (batch) => {
    if (batch.status === 'Draft' && batch.access?.canEditScope) return 'scope';
    if (batch.access?.canCount && batch.summary?.pending) return 'count';
    return 'overview';
};

const Kpi = ({ label, value, title, className = 'text-slate-900' }) => (
    <div className="min-w-0" title={title}>
        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest truncate">{label}</div>
        <div className={`text-base sm:text-lg font-black tabular-nums whitespace-nowrap ${className}`}>{value}</div>
    </div>
);

const StockAuditDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { canDelete } = usePermission('inventory_sap_audit');
    const [params, setParams] = useSearchParams();
    const [batch, setBatch] = useState(null);
    const [notFound, setNotFound] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);
    const [openLine, setOpenLine] = useState(null);
    const [editing, setEditing] = useState(null);
    const [nameState, setNameState] = useState('idle');
    const [reasonFor, setReasonFor] = useState(null);
    const [reason, setReason] = useState('');
    const [busy, setBusy] = useState(false);

    const load = useCallback(async () => {
        try {
            const res = await stockAuditService.getById(id);
            setBatch(res.data);
        } catch (error) {
            if (error.response?.status === 404) setNotFound(true);
            else toast.error(errorMessage(error, 'Failed to load the audit batch'));
        }
    }, [id]);

    useEffect(() => { load(); }, [load]);

    const changed = useCallback(() => {
        load();
        setRefreshKey(k => k + 1);
    }, [load]);

    const tabParam = params.get('tab');
    const tab = TABS.some(t => t.key === tabParam) ? tabParam : batch ? defaultTabFor(batch) : 'overview';
    const setTab = useCallback((key) => setParams(prev => {
        const next = new URLSearchParams(prev);
        next.set('tab', key);
        return next;
    }, { replace: true }), [setParams]);

    // Pin the default tab in the URL once the batch is known, so it does not change under the
    // user as counts come in.
    useEffect(() => {
        if (batch && !TABS.some(t => t.key === tabParam)) setTab(defaultTabFor(batch));
    }, [batch, tabParam, setTab]);

    const runAction = async (item, why = '') => {
        if (!item.reason && CONFIRM[item.action] && !window.confirm(CONFIRM[item.action])) return;
        setBusy(true);
        try {
            const res = await stockAuditService.changeStatus(batch._id, item.action, why);
            setBatch(res.data);
            setRefreshKey(k => k + 1);
            setReasonFor(null);
            setReason('');
            toast.success(`Batch is now ${res.data.status}`);
            if (item.action === 'start') setTab('count');
        } catch (error) {
            toast.error(errorMessage(error, 'Could not change the status'));
        } finally {
            setBusy(false);
        }
    };

    const saveDetails = async () => {
        if (nameState === 'invalid') {
            toast.error('Choose another batch name.');
            return;
        }
        setBusy(true);
        try {
            const res = await stockAuditService.update(batch._id, batchPayload(editing));
            setBatch(res.data);
            setEditing(null);
            setRefreshKey(k => k + 1);
            toast.success('Batch details saved');
        } catch (error) {
            toast.error(errorMessage(error, 'Failed to save the batch'));
        } finally {
            setBusy(false);
        }
    };

    const exportBatch = async () => {
        try {
            const res = await stockAuditService.exportBatch(batch._id);
            downloadBlob(res.data, `${batch.name.replace(/[^A-Za-z0-9_.-]+/g, '_')}.xlsx`);
        } catch {
            toast.error('Export failed');
        }
    };

    const deleteBatch = async () => {
        if (!window.confirm(`Delete the draft batch "${batch.name}" and its lines? This cannot be undone.`)) return;
        try {
            await stockAuditService.delete(batch._id);
            toast.success('Batch deleted');
            navigate('/inventory/stock-audit', { replace: true });
        } catch (error) {
            toast.error(errorMessage(error, 'Failed to delete the batch'));
        }
    };

    const onNameStatus = useCallback((state) => setNameState(state), []);

    if (notFound) {
        return (
            <div className="py-20 text-center space-y-3">
                <p className="text-slate-600 font-bold">This audit batch does not exist or you do not have access to it.</p>
                <button type="button" onClick={() => navigate('/inventory/stock-audit')} className={`${SECONDARY} mx-auto`}>Back to audit batches</button>
            </div>
        );
    }
    if (!batch) return <div className="py-20 text-center text-sm text-slate-500">Loading audit batch...</div>;

    const s = batch.summary || {};
    const access = batch.access || {};
    const actions = access.canChangeStatus ? ACTIONS[batch.status] || [] : [];

    return (
        <div className="space-y-4 min-w-0">
            <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-4">
                <div className="flex items-start gap-2 min-w-0">
                    <button type="button" onClick={() => navigate('/inventory/stock-audit')} className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 flex-shrink-0" aria-label="Back">
                        <MdArrowBack size={22} />
                    </button>
                    <div className="min-w-0">
                        <h1 className="font-mono text-xl sm:text-2xl font-black text-slate-900 tracking-tight break-all">{batch.name}</h1>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                            <Badge value={batch.status} />
                            <Badge tone="slate">{batch.auditType}</Badge>
                            <Badge value={access.role}>{ROLE_LABEL[access.role]}</Badge>
                            {batch.scopeSource && <Badge tone="sky">Scope: {batch.scopeSource}</Badge>}
                        </div>
                        <div className="text-xs font-semibold text-slate-500 mt-1.5 space-y-0.5">
                            <div>
                                Created by {batch.createdBy?.name || '—'} · {formatDateTime(batch.createdAt)}
                                {batch.sapReference && ` · SAP: ${batch.sapReference}`}
                                {batch.sapSnapshotAt && ` · stock as of ${formatDateTime(batch.sapSnapshotAt)}`}
                            </div>
                            {(batch.plannedStart || batch.plannedEnd) && <div>Planned {formatDate(batch.plannedStart, '…')} – {formatDate(batch.plannedEnd, '…')}</div>}
                            {batch.completedAt && <div>Completed by {batch.completedBy?.name} · {formatDateTime(batch.completedAt)}</div>}
                            {batch.statusReason && ['Cancelled', 'In Progress'].includes(batch.status) && <div>Reason: {batch.statusReason}</div>}
                            {batch.description && <div className="text-slate-600 whitespace-pre-line">{batch.description}</div>}
                        </div>
                    </div>
                </div>
                <div className="flex flex-wrap gap-2 xl:justify-end">
                    {actions.map(a => (
                        <button key={a.action} type="button" disabled={busy}
                            onClick={() => (a.reason ? setReasonFor(a) : runAction(a))}
                            className={a.primary ? PRIMARY : a.action === 'cancel' ? DANGER : SECONDARY}>
                            <a.icon size={18} /> {a.label}
                        </button>
                    ))}
                    {access.canManage && (
                        <button type="button" onClick={() => setEditing(batchFormFrom(batch))} className={SECONDARY}><MdEdit size={18} /> Edit</button>
                    )}
                    {access.role === 'owner' && batch.status === 'Draft' && canDelete && (
                        <button type="button" onClick={deleteBatch} className={DANGER}><MdDelete size={18} /> Delete</button>
                    )}
                    <button type="button" onClick={exportBatch} className={SECONDARY}><MdDownload size={18} /> Export</button>
                </div>
            </div>

            <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
                <div className="flex justify-between text-xs font-bold text-slate-500 mb-1.5">
                    <span>{s.counted || 0} of {s.lines || 0} lines counted</span><span>{s.progressPct || 0}%</span>
                </div>
                <ProgressBar value={s.progressPct} />
                <div className="mt-3 grid grid-cols-3 sm:grid-cols-6 gap-3">
                    <Kpi label="Pending" value={s.pending || 0} />
                    <Kpi label="Matched" value={s.matched || 0} className="text-emerald-600" />
                    <Kpi label="Short" value={s.short || 0} className="text-rose-600" />
                    <Kpi label="Excess" value={s.excess || 0} className="text-violet-600" />
                    <Kpi label="Open issues" value={s.openMismatches || 0} className={s.openMismatches ? 'text-rose-600' : 'text-slate-900'} />
                    <Kpi label="Net variance" value={fmtSigned(s.varianceValue, fmtMoneyShort)} title={fmtSigned(s.varianceValue, fmtMoney)} className={varianceTone(s.varianceValue)} />
                </div>
            </div>

            <div className="flex border-b border-slate-200 gap-1 overflow-x-auto" role="tablist">
                {TABS.map(t => (
                    <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)}
                        className={`flex items-center gap-1.5 px-4 py-3 border-b-2 text-sm whitespace-nowrap transition ${tab === t.key ? 'border-teal-600 text-teal-700 font-black' : 'border-transparent text-slate-500 font-bold hover:text-slate-700'}`}>
                        <t.icon size={18} /> {t.label}
                        {t.key === 'mismatches' && s.openMismatches > 0 && <span className="ml-0.5 rounded-full bg-rose-100 text-rose-700 text-[10px] font-black px-1.5">{s.openMismatches}</span>}
                    </button>
                ))}
            </div>

            <div className="min-w-0">
                {tab === 'overview' && <DashboardTab batchId={batch._id} refreshKey={refreshKey} onOpenLine={(line) => { setOpenLine(line); setTab('mismatches'); }} />}
                {tab === 'count' && <CountTab batch={batch} onChanged={changed} />}
                {tab === 'mismatches' && <MismatchTab batch={batch} onChanged={changed} openLine={openLine} onLineClosed={() => setOpenLine(null)} />}
                {tab === 'scope' && <ScopeTab batch={batch} onChanged={changed} />}
                {tab === 'access' && <AccessTab batch={batch} onChanged={changed} />}
                {tab === 'activity' && <ActivityTab batchId={batch._id} refreshKey={refreshKey} />}
            </div>

            <Modal isOpen={Boolean(editing)} onClose={() => setEditing(null)} title="Edit batch details" maxWidth="max-w-3xl"
                footer={<>
                    <button type="button" onClick={() => setEditing(null)} className={SECONDARY}>Cancel</button>
                    <button type="button" onClick={saveDetails} disabled={busy || nameState === 'checking'} className={PRIMARY}>Save</button>
                </>}>
                {editing && <BatchFields form={editing} setForm={setEditing} batchId={batch._id} onNameStatus={onNameStatus} />}
            </Modal>

            <Modal isOpen={Boolean(reasonFor)} onClose={() => setReasonFor(null)} title={reasonFor?.label || ''} maxWidth="max-w-lg"
                footer={<>
                    <button type="button" onClick={() => setReasonFor(null)} className={SECONDARY}>Back</button>
                    <button type="button" onClick={() => runAction(reasonFor, reason)} disabled={busy || !reason.trim()} className={reasonFor?.action === 'cancel' ? DANGER : PRIMARY}>
                        {reasonFor?.label}
                    </button>
                </>}>
                <label htmlFor="status-reason" className={LABEL}>Reason *</label>
                <textarea id="status-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={3} className={INPUT}
                    placeholder={reasonFor?.action === 'cancel' ? 'Why is this audit cancelled?' : 'What needs to be counted or checked again?'} />
            </Modal>
        </div>
    );
};

export default StockAuditDetail;
