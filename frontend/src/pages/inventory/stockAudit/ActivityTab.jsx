import React, { useEffect, useState } from 'react';
import { stockAuditService } from '../../../services/api';
import { LogEntry } from './LineHistory';
import { PANEL, H2, SMALL } from './shared';

// Audit trail of the whole batch, newest first: creation, imports, access changes, every count
// and correction, mismatch follow-up and status changes.
const ActivityTab = ({ batchId, refreshKey }) => {
    const [page, setPage] = useState(1);
    const [data, setData] = useState(null);

    useEffect(() => {
        let cancelled = false;
        stockAuditService.getLogs(batchId, { page, limit: 50 })
            .then(res => { if (!cancelled) setData(res.data); })
            .catch(() => { if (!cancelled) setData({ logs: [], total: 0, pages: 1 }); });
        return () => { cancelled = true; };
    }, [batchId, page, refreshKey]);

    if (!data) return <div className="py-16 text-center text-sm text-slate-500">Loading audit trail...</div>;

    return (
        <div className={PANEL}>
            <h2 className={`${H2} mb-4`}>Audit trail ({data.total})</h2>
            {!data.logs.length ? <p className="text-sm text-slate-400">Nothing recorded yet.</p> : (
                <div className="space-y-4 pl-4 border-l-2 border-teal-100">
                    {data.logs.map(l => <LogEntry key={l._id} log={l} showItem />)}
                </div>
            )}
            {data.pages > 1 && (
                <div className="flex items-center justify-center gap-3 pt-4">
                    <button type="button" className={SMALL} disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Newer</button>
                    <span className="text-xs font-bold text-slate-500">Page {page} of {data.pages}</span>
                    <button type="button" className={SMALL} disabled={page >= data.pages} onClick={() => setPage(p => p + 1)}>Older</button>
                </div>
            )}
        </div>
    );
};

export default ActivityTab;
