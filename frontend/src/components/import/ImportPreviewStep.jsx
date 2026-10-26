import React, { useEffect, useMemo, useState } from 'react';
import {
    MdInsertDriveFile, MdSwapHoriz, MdTune, MdExpandMore, MdExpandLess, MdClose, MdWarning, MdCheckCircle, MdInfoOutline
} from 'react-icons/md';
import { importJobService } from '../../services/api';
import { formatCount, plural, modeOptions, fileSize, apiError } from './importHelpers';
import { StatusBadge } from './ImportParts';

const PAGE_SIZE = 25;

/* -----------------------------------------------------------------------
 * Step 2 + 3 of an import: how the file was read, which columns feed which
 * field, and every row with its status - before anything is saved.
 * --------------------------------------------------------------------- */

const SummaryCard = ({ label, value, note, tone }) => {
    const tones = {
        ready: 'bg-emerald-50/70 border-emerald-100 text-emerald-700',
        attention: 'bg-amber-50/80 border-amber-100 text-amber-800',
        muted: 'bg-slate-50 border-slate-200 text-slate-600'
    };
    return (
        <div className={`rounded-2xl border p-4 ${tones[tone]}`}>
            <p className="text-[10px] font-bold uppercase tracking-widest opacity-80">{label}</p>
            <p className="text-3xl font-black mt-1 tabular-nums">{formatCount(value)}</p>
            {note && <p className="text-xs font-medium mt-1 opacity-90">{note}</p>}
        </div>
    );
};

const ColumnMatching = ({ job, onApply, busy }) => {
    const { fields } = job.module;
    const mappingKey = JSON.stringify(job.mapping);
    const [draft, setDraft] = useState(job.mapping);
    // A new mapping from the server (applied, or another job) replaces the draft.
    const [draftOf, setDraftOf] = useState(mappingKey);
    if (draftOf !== mappingKey) {
        setDraftOf(mappingKey);
        setDraft(job.mapping);
    }

    const headers = useMemo(() => job.headers.filter((header) => !header.blank), [job.headers]);
    const headerByKey = useMemo(() => Object.fromEntries(job.headers.map((header) => [header.key, header])), [job.headers]);
    const dirty = JSON.stringify(draft) !== mappingKey;
    const locked = (job.counts?.imported || 0) > 0;
    const missingRequired = fields.filter((field) => field.required && !draft[field.key]?.length);
    const matched = fields.filter((field) => draft[field.key]?.length).length;
    const used = new Set(Object.values(draft).flat());
    const unused = headers.filter((header) => !used.has(header.key));
    const [open, setOpen] = useState(missingRequired.length > 0);
    const [showUnused, setShowUnused] = useState(false);

    const setPrimary = (fieldKey, column) => {
        setDraft((current) => {
            const rest = (current[fieldKey] || []).slice(1).filter((key) => key !== column);
            return { ...current, [fieldKey]: column ? [column, ...rest] : [] };
        });
    };
    const removeFallback = (fieldKey, column) => {
        setDraft((current) => ({ ...current, [fieldKey]: (current[fieldKey] || []).filter((key, index) => index === 0 || key !== column) }));
    };

    return (
        <div className="border border-slate-200 rounded-2xl bg-white overflow-hidden">
            <button
                type="button"
                onClick={() => setOpen((value) => !value)}
                className="w-full px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-3 text-left"
            >
                <span className="flex items-center gap-2 min-w-0">
                    <MdTune className="text-slate-500 shrink-0" size={18} />
                    <span className="font-bold text-sm text-slate-800">Column matching</span>
                    <span className="text-xs text-slate-500 truncate">
                        {matched} of {fields.length} fields matched
                        {unused.length > 0 && ` · ${plural(unused.length, 'column', 'columns')} in your file not used`}
                    </span>
                </span>
                <span className="flex items-center gap-2 shrink-0">
                    {missingRequired.length > 0 && (
                        <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">
                            {missingRequired.length} required not matched
                        </span>
                    )}
                    {open ? <MdExpandLess size={20} className="text-slate-500" /> : <MdExpandMore size={20} className="text-slate-500" />}
                </span>
            </button>

            {open && (
                <div className="p-4 space-y-3">
                    <p className="text-xs text-slate-500">
                        Columns were matched by their headings. Pick a different column if one is wrong. When the chosen column is
                        blank in a row, the backup columns listed next to it are used instead.
                    </p>
                    {locked && (
                        <p className="text-xs font-semibold text-slate-600 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                            Rows of this file are already imported, so the columns can no longer be changed. Upload the file again to start over.
                        </p>
                    )}
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                            <thead>
                                <tr className="text-left text-slate-500 border-b border-slate-100">
                                    <th className="py-2 pr-3 font-bold">Field</th>
                                    <th className="py-2 pr-3 font-bold">Column in your file</th>
                                    <th className="py-2 pr-3 font-bold">Example from your file</th>
                                    <th className="py-2 font-bold">Backup columns</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {fields.map((field) => {
                                    const columns = draft[field.key] || [];
                                    const primary = columns[0] || '';
                                    return (
                                        <tr key={field.key} className={field.required && !primary ? 'bg-rose-50/50' : ''}>
                                            <td className="py-2 pr-3 align-top">
                                                <span className="font-semibold text-slate-800">{field.label}</span>
                                                <span className={`ml-2 text-[10px] font-bold uppercase tracking-wide ${field.required ? 'text-rose-600' : 'text-slate-400'}`}>
                                                    {field.required ? 'Required' : 'Optional'}
                                                </span>
                                            </td>
                                            <td className="py-2 pr-3 align-top">
                                                <select
                                                    value={primary}
                                                    disabled={locked || busy}
                                                    onChange={(event) => setPrimary(field.key, event.target.value)}
                                                    aria-label={`Column for ${field.label}`}
                                                    className="w-56 max-w-full px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 disabled:bg-slate-50"
                                                >
                                                    <option value="">— Not in my file —</option>
                                                    {headers.map((header) => (
                                                        <option key={header.key} value={header.key}>{header.label} (col {header.key})</option>
                                                    ))}
                                                </select>
                                            </td>
                                            <td className="py-2 pr-3 align-top text-slate-500 max-w-[14rem] truncate" title={headerByKey[primary]?.sample || ''}>
                                                {headerByKey[primary]?.sample || <span className="text-slate-300">—</span>}
                                            </td>
                                            <td className="py-2 align-top">
                                                <div className="flex flex-wrap gap-1">
                                                    {columns.slice(1).map((column) => (
                                                        <span key={column} className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full bg-slate-100 text-slate-600">
                                                            {headerByKey[column]?.label || column}
                                                            {!locked && (
                                                                <button type="button" onClick={() => removeFallback(field.key, column)} className="p-0.5 rounded-full hover:bg-slate-200" aria-label={`Stop using ${headerByKey[column]?.label || column}`}>
                                                                    <MdClose size={11} />
                                                                </button>
                                                            )}
                                                        </span>
                                                    ))}
                                                    {columns.length < 2 && <span className="text-slate-300">—</span>}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {unused.length > 0 && (
                        <div className="text-xs text-slate-500">
                            <button type="button" onClick={() => setShowUnused((value) => !value)} className="font-semibold text-primary-600 hover:underline">
                                {showUnused ? 'Hide' : 'Show'} the {plural(unused.length, 'column', 'columns')} that will not be imported
                            </button>
                            {showUnused && (
                                <p className="mt-2 leading-relaxed">{unused.map((header) => header.label).join(' · ')}</p>
                            )}
                        </div>
                    )}

                    {dirty && !locked && (
                        <div className="flex items-center justify-end gap-2 pt-1">
                            <button type="button" onClick={() => setDraft(JSON.parse(mappingKey))} disabled={busy} className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100">
                                Undo changes
                            </button>
                            <button
                                type="button"
                                onClick={() => onApply(draft)}
                                disabled={busy}
                                className="px-4 py-2 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold disabled:opacity-60"
                            >
                                {busy ? 'Checking rows…' : 'Apply and check rows again'}
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

const FILTERS = [
    { key: 'all', label: 'All rows', count: (counts) => counts.total },
    { key: 'ready', label: 'Ready', count: (counts) => counts.ready },
    { key: 'attention', label: 'Needs attention', count: (counts) => counts.attention + counts.failed },
    { key: 'imported', label: 'Imported', count: (counts) => counts.imported, hideWhenZero: true },
    { key: 'excluded', label: 'Skipped by you', count: (counts) => counts.excluded, hideWhenZero: true }
];

export const RowsTable = ({ job, initialFilter = 'all' }) => {
    const { fields } = job.module;
    const counts = job.counts || {};
    const [filter, setFilter] = useState(initialFilter);
    const [page, setPage] = useState(1);
    const [hideOptional, setHideOptional] = useState(false);
    const [data, setData] = useState({ rows: [], total: 0, key: '' });
    const [error, setError] = useState(null);
    // Rows change whenever the job is checked again (columns, import type, corrections).
    const version = `${job.id}|${job.mode}|${JSON.stringify(job.mapping)}|${JSON.stringify(counts)}`;
    const [pageOf, setPageOf] = useState(version);
    if (pageOf !== version) {
        setPageOf(version);
        setPage(1);
    }
    const requestKey = `${version}|${filter}|${page}`;
    const loading = data.key !== requestKey;

    useEffect(() => {
        let active = true;
        importJobService.getRows(job.id, { status: filter, page, limit: PAGE_SIZE })
            .then((response) => { if (active) { setData({ ...response.data, key: requestKey }); setError(null); } })
            .catch((err) => {
                if (!active) return;
                setError(apiError(err, 'Could not load the rows.'));
                setData({ rows: [], total: 0, key: requestKey });
            });
        return () => { active = false; };
    }, [job.id, filter, page, requestKey]);

    // Optional fields with no column in the file are always empty, so they are never shown.
    const columns = fields.filter((field) => field.required || (!hideOptional && job.mapping[field.key]?.length));
    const pages = Math.max(1, Math.ceil((data.total || 0) / PAGE_SIZE));

    return (
        <div className="border border-slate-200 rounded-2xl bg-white overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-1.5" role="tablist">
                    {FILTERS.filter((item) => !item.hideWhenZero || item.count(counts) > 0).map((item) => (
                        <button
                            key={item.key}
                            type="button"
                            role="tab"
                            aria-selected={filter === item.key}
                            onClick={() => { setFilter(item.key); setPage(1); }}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${filter === item.key ? 'bg-white text-slate-900 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-800'}`}
                        >
                            {item.label} <span className="tabular-nums opacity-70">{formatCount(item.count(counts))}</span>
                        </button>
                    ))}
                </div>
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 cursor-pointer select-none">
                    <input type="checkbox" checked={hideOptional} onChange={(event) => setHideOptional(event.target.checked)} className="rounded border-slate-300" />
                    Hide optional columns
                </label>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-xs">
                    <thead>
                        <tr className="bg-white border-b border-slate-200 text-left">
                            <th className="px-3 py-2 font-bold text-slate-600 w-14">Row</th>
                            {columns.map((field) => (
                                <th key={field.key} className="px-3 py-2 font-bold text-slate-600 whitespace-nowrap">
                                    {field.label}{field.required ? <span className="text-rose-500"> *</span> : ''}
                                </th>
                            ))}
                            <th className="px-3 py-2 font-bold text-slate-600 whitespace-nowrap">Row status</th>
                            <th className="px-3 py-2 font-bold text-slate-600 min-w-[16rem]">What needs attention</th>
                        </tr>
                    </thead>
                    <tbody className={`divide-y divide-slate-100 ${loading ? 'opacity-60' : ''}`}>
                        {data.rows.map((row) => {
                            const issueFields = new Set((row.issues || []).map((issue) => issue.field));
                            return (
                                <tr key={row.rowNumber} className="align-top hover:bg-slate-50/60">
                                    <td className="px-3 py-2 font-mono text-slate-500">{row.rowNumber}</td>
                                    {columns.map((field) => (
                                        <td
                                            key={field.key}
                                            title={row.values[field.key] || ''}
                                            className={`px-3 py-2 max-w-[12rem] truncate ${issueFields.has(field.key) ? 'bg-amber-50 text-amber-900 font-semibold' : 'text-slate-700'}`}
                                        >
                                            {row.values[field.key] || <span className="text-slate-300">—</span>}
                                        </td>
                                    ))}
                                    <td className="px-3 py-2">
                                        <StatusBadge row={row} />
                                        {row.matchLabel && (row.status === 'ready' || row.status === 'imported') && (
                                            <p className="mt-1 text-[11px] text-slate-500 max-w-[14rem]">Updates {row.matchLabel}</p>
                                        )}
                                    </td>
                                    <td className="px-3 py-2 text-slate-600">
                                        {(row.issues || []).map((issue, index) => (
                                            <p key={index} className="mb-1 last:mb-0">
                                                <span className="font-semibold text-slate-800">{issue.message}</span>
                                                {issue.hint && <span className="text-slate-500"> {issue.hint}</span>}
                                            </p>
                                        ))}
                                        {row.error && <p className="font-semibold text-rose-700">{row.error}</p>}
                                        {!row.issues?.length && !row.error && <span className="text-slate-300">—</span>}
                                    </td>
                                </tr>
                            );
                        })}
                        {!loading && !data.rows.length && (
                            <tr>
                                <td colSpan={columns.length + 3} className="px-3 py-8 text-center text-slate-400 font-medium">
                                    {error ? error.message : 'No rows here.'}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {pages > 1 && (
                <div className="px-4 py-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                    <span>
                        Rows {formatCount((page - 1) * PAGE_SIZE + 1)}–{formatCount(Math.min(page * PAGE_SIZE, data.total))} of {formatCount(data.total)}
                    </span>
                    <span className="flex items-center gap-1">
                        <button type="button" disabled={page <= 1 || loading} onClick={() => setPage((value) => value - 1)} className="px-3 py-1 rounded-lg border border-slate-200 font-semibold disabled:opacity-40">Previous</button>
                        <span className="px-2 tabular-nums">{page} / {pages}</span>
                        <button type="button" disabled={page >= pages || loading} onClick={() => setPage((value) => value + 1)} className="px-3 py-1 rounded-lg border border-slate-200 font-semibold disabled:opacity-40">Next</button>
                    </span>
                </div>
            )}
        </div>
    );
};

const ImportPreviewStep = ({ job, busy, onApplyMapping, onModeChange, onReplaceFile }) => {
    const counts = job.counts || {};
    const { label } = job.module;
    const allowed = job.module.modes || ['upsert', 'create', 'update'];
    const modes = modeOptions(job.module).filter((mode) => allowed.includes(mode.value));
    const currentMode = modes.find((mode) => mode.value === job.mode) || modes[0];
    const needsAttention = (counts.attention || 0) + (counts.failed || 0);
    const locked = (counts.imported || 0) > 0;

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2.5 rounded-xl bg-primary-50 text-primary-600 shrink-0"><MdInsertDriveFile size={22} /></div>
                    <div className="min-w-0">
                        <p className="font-bold text-slate-900 truncate">{job.file?.name}</p>
                        <p className="text-xs text-slate-500">
                            {label}{job.paramsLabel ? ` · ${job.paramsLabel}` : ''} · {plural(counts.total, 'row', 'rows')} · sheet “{job.file?.sheetName}”{job.file?.size ? ` · ${fileSize(job.file.size)}` : ''}
                            {job.file?.sheetCount > 1 && ' · only the first sheet is read'}
                        </p>
                    </div>
                </div>
                {!locked && (
                    <button type="button" onClick={onReplaceFile} disabled={busy} className="flex items-center gap-1.5 text-xs font-bold text-primary-600 hover:text-primary-700 disabled:opacity-50">
                        <MdSwapHoriz size={16} /> Replace file
                    </button>
                )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <SummaryCard
                    tone="ready"
                    label="Ready to import"
                    value={counts.ready}
                    note={!counts.ready
                        ? 'Nothing is ready yet'
                        : modes.length === 1 && modes[0].value === 'create'
                            ? `${formatCount(counts.readyCreate)} new`
                            : `${formatCount(counts.readyCreate)} new · ${formatCount(counts.readyUpdate)} updates`}
                />
                <SummaryCard
                    tone="attention"
                    label="Needs attention"
                    value={needsAttention}
                    note={needsAttention
                        ? `Not imported until fixed${counts.duplicates ? ` · ${plural(counts.duplicates, 'duplicate', 'duplicates')}` : ''}`
                        : 'No issues found'}
                />
                <SummaryCard
                    tone="muted"
                    label="Ignored"
                    value={(counts.blank || 0) + (counts.excluded || 0)}
                    note={[
                        counts.blank ? plural(counts.blank, 'blank row', 'blank rows') : '',
                        counts.excluded ? `${formatCount(counts.excluded)} skipped by you` : ''
                    ].filter(Boolean).join(' · ') || 'Blank rows are skipped automatically'}
                />
            </div>

            {needsAttention > 0 && counts.ready > 0 && (
                <p className="flex items-start gap-2 text-xs text-slate-600 bg-amber-50/60 border border-amber-100 rounded-xl px-3 py-2">
                    <MdInfoOutline className="text-amber-600 mt-0.5 shrink-0" size={15} />
                    The rows that need attention will not be imported. You can fix them now, or import the ready rows first and fix the rest afterwards.
                </p>
            )}
            {needsAttention === 0 && counts.ready > 0 && (
                <p className="flex items-center gap-2 text-xs font-semibold text-emerald-700">
                    <MdCheckCircle size={15} /> Every row passed the checks.
                </p>
            )}
            {counts.ready === 0 && needsAttention > 0 && (
                <p className="flex items-start gap-2 text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
                    <MdWarning className="mt-0.5 shrink-0" size={15} />
                    No row can be imported yet. Check the column matching below, or review the rows that need attention.
                </p>
            )}

            {/* Imports that can only add records (tickets...) have no choice to make. */}
            {modes.length > 1 && (
                <div className="flex flex-wrap items-center gap-3">
                    <label htmlFor="import-mode" className="text-xs font-bold text-slate-700">Import type</label>
                    <select
                        id="import-mode"
                        value={job.mode}
                        disabled={busy}
                        onChange={(event) => onModeChange(event.target.value)}
                        className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700"
                    >
                        {modes.map((mode) => <option key={mode.value} value={mode.value}>{mode.label}</option>)}
                    </select>
                    <span className="text-xs text-slate-500">{currentMode.hint}</span>
                </div>
            )}

            <ColumnMatching job={job} onApply={onApplyMapping} busy={busy} />
            <RowsTable job={job} initialFilter={needsAttention && !counts.ready ? 'attention' : 'all'} />
        </div>
    );
};

export default ImportPreviewStep;
