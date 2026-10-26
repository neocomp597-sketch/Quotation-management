import React, { useEffect, useState } from 'react';
import { stockAuditService } from '../../../services/api';
import { formatDateTime } from '../../../utils/helpers';

const FIELD_LABELS = {
    countedQty: 'Counted qty', condition: 'Condition', foundLocation: 'Found at', remarks: 'Remarks', result: 'Result',
    mismatch: 'Mismatch', status: 'Status', 'mismatch.status': 'Mismatch status', 'mismatch.rootCause': 'Root cause',
    'mismatch.ownerEmail': 'Follow-up owner', 'mismatch.resolution': 'Resolution', 'mismatch.resolutionNote': 'Resolution note',
    'mismatch.sapDocRef': 'SAP document', auditor: 'Auditor', viewer: 'Viewer', name: 'Name', auditType: 'Type',
    description: 'Description', sapReference: 'SAP reference', sapSnapshotAt: 'SAP stock as of', plannedStart: 'Planned start', plannedEnd: 'Planned end'
};

const show = (v) => {
    if (v === null || v === undefined || v === '') return '—';
    if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v)) return formatDateTime(v);
    return String(v);
};

export const ChangeList = ({ changes }) => (
    <ul className="mt-1 space-y-0.5">
        {changes.map((c, i) => (
            <li key={i} className="text-xs text-slate-600 break-words">
                <span className="font-bold">{FIELD_LABELS[c.field] || c.field}:</span>{' '}
                {c.from === null || c.from === undefined || c.from === ''
                    ? <span className="text-emerald-700">{show(c.to)}{['auditor', 'viewer'].includes(c.field) ? ' added' : ''}</span>
                    : c.to === null || c.to === undefined || c.to === ''
                        ? <span className="text-rose-600">{show(c.from)}{['auditor', 'viewer'].includes(c.field) ? ' removed' : ' cleared'}</span>
                        : <>{show(c.from)} → <b>{show(c.to)}</b></>}
            </li>
        ))}
    </ul>
);

export const LogEntry = ({ log, showItem = false }) => (
    <div className="relative">
        <span className="absolute -left-[17px] top-1.5 w-2.5 h-2.5 rounded-full bg-teal-500 ring-2 ring-white" />
        <div className="flex flex-wrap justify-between gap-x-2 text-[11px] font-semibold text-slate-400">
            <span>{log.user?.name || 'System'}{log.user?.email ? ` · ${log.user.email}` : ''}</span>
            <span>{formatDateTime(log.at)}</span>
        </div>
        <div className="text-sm font-bold text-slate-800">
            {log.action}{showItem && log.itemCode ? <span className="font-mono text-teal-700"> · {log.itemCode}</span> : ''}
        </div>
        {log.changes?.length > 0 && <ChangeList changes={log.changes} />}
        {log.note && <div className="text-xs text-slate-500 whitespace-pre-line mt-0.5">{log.note}</div>}
    </div>
);

// Every change recorded on one line of a batch, newest first.
const LineHistory = ({ batchId, itemId }) => {
    const [logs, setLogs] = useState(null);
    useEffect(() => {
        let cancelled = false;
        stockAuditService.getLogs(batchId, { itemId, limit: 200 })
            .then(res => { if (!cancelled) setLogs(res.data.logs || []); })
            .catch(() => { if (!cancelled) setLogs([]); });
        return () => { cancelled = true; };
    }, [batchId, itemId]);

    if (!logs) return <p className="text-sm text-slate-500">Loading history...</p>;
    if (!logs.length) return <p className="text-sm text-slate-400">No changes recorded for this line.</p>;
    return (
        <div className="space-y-3 pl-4 border-l-2 border-teal-100">
            {logs.map(l => <LogEntry key={l._id} log={l} />)}
        </div>
    );
};

export default LineHistory;
