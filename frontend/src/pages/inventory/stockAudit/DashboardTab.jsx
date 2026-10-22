import React, { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { stockAuditService } from '../../../services/api';
import { formatDate, formatDateTime } from '../../../utils/helpers';
import { PANEL, H2, TH, TD, TDN, TDR, fmtQty, fmtMoney, fmtSigned, varianceTone, pct, locationText, errorMessage } from './shared';
import { Badge, ProgressBar } from './ui';

const Tile = ({ label, value, hint, valueClass = 'text-slate-900' }) => (
    <div className="min-w-0 bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
        <div className="text-[11px] font-black uppercase text-slate-500 tracking-wider leading-tight">{label}</div>
        <div className={`text-xl sm:text-2xl font-black leading-tight tabular-nums whitespace-nowrap ${valueClass}`}>{value}</div>
        {hint && <div className="text-[11px] font-semibold text-slate-400 break-words">{hint}</div>}
    </div>
);

// Horizontal share bars for a small breakdown (label, count, share of total).
const Breakdown = ({ title, rows, empty }) => {
    const total = rows.reduce((sum, r) => sum + r.value, 0);
    return (
        <div className={PANEL}>
            <h2 className={`${H2} mb-3`}>{title}</h2>
            {!rows.length ? <p className="text-sm text-slate-400">{empty}</p> : (
                <div className="space-y-2.5">
                    {rows.map(r => (
                        <div key={r.label} title={`${r.label}: ${r.value} (${total ? Math.round((r.value / total) * 100) : 0}%)`}>
                            <div className="flex justify-between text-[13px] font-semibold text-slate-600 mb-1"><span>{r.label}</span><b className="tabular-nums">{r.value}</b></div>
                            <ProgressBar value={total ? (r.value / total) * 100 : 0} className="bg-teal-500 rounded-full" />
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// Lines counted per day: one series, so one hue and no legend; hover shows the exact value.
const DailyBars = ({ days }) => {
    const max = Math.max(1, ...days.map(d => d.lines));
    return (
        <div className={PANEL}>
            <h2 className={`${H2} mb-3`}>Lines counted per day</h2>
            {!days.length ? <p className="text-sm text-slate-400">No counts recorded yet.</p> : (
                <div className="overflow-x-auto">
                    <div className="flex items-end gap-[2px] h-36" style={{ minWidth: days.length * 24 }}>
                        {days.map(d => (
                            <div key={d.day} className="group flex-1 min-w-[22px] max-w-[48px] h-full flex flex-col justify-end items-center" title={`${formatDate(d.day)}: ${d.lines} lines`}>
                                <span className="text-[10px] font-bold text-slate-500 tabular-nums opacity-0 group-hover:opacity-100">{d.lines}</span>
                                <div className="w-full rounded-t bg-teal-500 group-hover:bg-teal-600" style={{ height: `${(d.lines / max) * 85}%`, minHeight: 2 }} />
                            </div>
                        ))}
                    </div>
                    <div className="flex gap-[2px] mt-1" style={{ minWidth: days.length * 24 }}>
                        {days.map((d, i) => (
                            <span key={d.day} className="flex-1 min-w-[22px] max-w-[48px] text-center text-[9px] font-semibold text-slate-400 whitespace-nowrap">
                                {i === 0 || i === days.length - 1 || days.length <= 10 ? formatDate(d.day).slice(0, 6) : ''}
                            </span>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

// Progress and results of the whole batch: counting progress, SAP vs physical quantities
// and values, per-warehouse and per-auditor breakdowns, and the largest discrepancies.
const DashboardTab = ({ batchId, refreshKey, onOpenLine }) => {
    const [data, setData] = useState(null);
    const [error, setError] = useState(false);

    useEffect(() => {
        let cancelled = false;
        stockAuditService.getDashboard(batchId)
            .then(res => { if (!cancelled) { setData(res.data); setError(false); } })
            .catch(err => {
                if (cancelled) return;
                setError(true);
                toast.error(errorMessage(err, 'Failed to load the audit dashboard'));
            });
        return () => { cancelled = true; };
    }, [batchId, refreshKey]);

    if (error && !data) return <div className="py-16 text-center text-sm text-rose-600">Could not load the dashboard.</div>;
    if (!data) return <div className="py-16 text-center text-sm text-slate-500">Loading dashboard...</div>;

    const s = data.summary;
    if (!s.lines) {
        return <div className="py-16 text-center text-sm font-semibold text-slate-500">No lines in this batch yet. Import the SAP stock on the Scope tab.</div>;
    }

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
                <Tile label="Lines in scope" value={fmtQty(s.lines)} hint={`${fmtQty(s.sapQty)} units in SAP`} />
                <Tile label="Counted" value={pct(s.progressPct)} hint={`${s.counted} counted · ${s.pending} pending`} valueClass="text-teal-700" />
                <Tile label="Matched" value={fmtQty(s.matched)} hint={`Accuracy ${pct(s.accuracyPct)}`} valueClass="text-emerald-600" />
                <Tile label="Short" value={fmtQty(s.short)} hint={`${fmtQty(s.shortQty)} units · ${fmtMoney(s.shortValue)}`} valueClass="text-rose-600" />
                <Tile label="Excess" value={fmtQty(s.excess)} hint={`+${fmtQty(s.excessQty)} units · ${fmtMoney(s.excessValue)}`} valueClass="text-violet-600" />
                <Tile label="Open mismatches" value={fmtQty(s.openMismatches)} hint={`${s.resolvedMismatches} resolved · ${s.recountRequested} recount`} valueClass={s.openMismatches ? 'text-rose-600' : 'text-slate-900'} />
            </div>

            <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
                <Tile label="SAP value (all lines)" value={fmtMoney(s.sapValue)} />
                <Tile label="SAP value (counted lines)" value={fmtMoney(s.countedSapValue)} />
                <Tile label="Physical value (counted)" value={fmtMoney(s.countedValue)} />
                <Tile label="Net variance value" value={fmtSigned(s.varianceValue, fmtMoney)} hint={`Gross ${fmtMoney(s.grossVarianceValue)}`} valueClass={varianceTone(s.varianceValue)} />
            </div>

            <div className={PANEL}>
                <h2 className={`${H2} mb-3`}>By warehouse</h2>
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[820px] border-collapse">
                        <thead><tr>
                            <th className={TH}>Warehouse</th><th className={TH}>Progress</th>
                            <th className={`${TH} text-right`}>Lines</th><th className={`${TH} text-right`}>Pending</th>
                            <th className={`${TH} text-right`}>Matched</th><th className={`${TH} text-right`}>Short</th>
                            <th className={`${TH} text-right`}>Excess</th><th className={`${TH} text-right`}>Open</th>
                            <th className={`${TH} text-right`}>SAP value</th><th className={`${TH} text-right`}>Net variance</th>
                        </tr></thead>
                        <tbody>
                            {data.byWarehouse.map(w => (
                                <tr key={w.warehouseCode || '-'}>
                                    <td className={TD}><b className="text-slate-800">{w.warehouseCode || 'Not set'}</b>{w.warehouseName && <div className="text-xs text-slate-400">{w.warehouseName}</div>}</td>
                                    <td className={`${TD} min-w-[120px]`}><ProgressBar value={w.progressPct} /><div className="text-[11px] text-slate-400 mt-1">{w.progressPct}%</div></td>
                                    <td className={TDR}>{w.lines}</td><td className={TDR}>{w.pending}</td>
                                    <td className={`${TDR} text-emerald-600`}>{w.matched}</td><td className={`${TDR} text-rose-600`}>{w.short}</td>
                                    <td className={`${TDR} text-violet-600`}>{w.excess}</td><td className={TDR}>{w.openMismatches}</td>
                                    <td className={TDR}>{fmtMoney(w.sapValue)}</td>
                                    <td className={`${TDR} ${varianceTone(w.varianceValue)}`}>{fmtSigned(w.varianceValue, fmtMoney)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className={PANEL}>
                <h2 className={`${H2} mb-3`}>Largest discrepancies</h2>
                {!data.topVariances.length ? <p className="text-sm text-slate-400">No discrepancies so far.</p> : (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[760px] border-collapse">
                            <thead><tr>
                                <th className={TH}>Item</th><th className={TH}>Location</th>
                                <th className={`${TH} text-right`}>SAP</th><th className={`${TH} text-right`}>Counted</th>
                                <th className={`${TH} text-right`}>Variance</th><th className={`${TH} text-right`}>Value</th><th className={TH}>Status</th>
                            </tr></thead>
                            <tbody>
                                {data.topVariances.map(l => (
                                    <tr key={l._id} className="hover:bg-slate-50 cursor-pointer" onClick={() => onOpenLine?.(l)}>
                                        <td className={TD}><b className="font-mono text-slate-800">{l.itemCode}</b><div className="text-xs text-slate-500">{l.itemName}</div></td>
                                        <td className={`${TD} text-xs`}>{locationText(l) || '—'}</td>
                                        <td className={TDR}>{fmtQty(l.sapQty)}</td><td className={TDR}>{fmtQty(l.countedQty)}</td>
                                        <td className={`${TDR} ${varianceTone(l.varianceQty)}`}>{fmtSigned(l.varianceQty)} {l.uom}</td>
                                        <td className={`${TDR} ${varianceTone(l.varianceValue)}`}>{fmtSigned(l.varianceValue, fmtMoney)}</td>
                                        <td className={TDN}><Badge value={l.result} /> {l.mismatch?.status && <Badge value={l.mismatch.status} />}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <div className={PANEL}>
                    <h2 className={`${H2} mb-3`}>Counted by</h2>
                    {!data.byAuditor.length ? <p className="text-sm text-slate-400">No counts recorded yet.</p> : (
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[420px] border-collapse">
                                <thead><tr>
                                    <th className={TH}>Auditor</th><th className={`${TH} text-right`}>Lines</th>
                                    <th className={`${TH} text-right`}>Matched</th><th className={TH}>Last count</th>
                                </tr></thead>
                                <tbody>
                                    {data.byAuditor.map(a => (
                                        <tr key={a.email || a.name}>
                                            <td className={TD}><b className="text-slate-800">{a.name}</b><div className="text-xs text-slate-400">{a.email}</div></td>
                                            <td className={TDR}>{a.lines}</td>
                                            <td className={TDR}>{a.matched} <span className="text-xs text-slate-400">({pct(a.accuracyPct)})</span></td>
                                            <td className={`${TDN} text-xs`}>{formatDateTime(a.lastCountAt)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
                <DailyBars days={data.daily} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Breakdown title="Mismatch follow-up" rows={data.byMismatchStatus.map(m => ({ label: m.status, value: m.lines }))} empty="No mismatches." />
                <Breakdown title="How mismatches were resolved" rows={data.byResolution.map(r => ({ label: r.resolution, value: r.lines }))} empty="None resolved yet." />
                <Breakdown title="Condition found" rows={data.byCondition.map(c => ({ label: c.condition, value: c.lines }))} empty="No conditions recorded." />
            </div>
        </div>
    );
};

export default DashboardTab;
