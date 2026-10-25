import React, { useCallback, useEffect, useRef, useState } from 'react';
import { MdArrowBack, MdCheckCircle, MdDownload, MdUploadFile, MdCloudUpload, MdUndo } from 'react-icons/md';
import { importJobService } from '../../services/api';
import { apiError, buttonClass, formatCount, plural } from './importHelpers';
import { ActionBar, StatusBadge } from './ImportParts';

const PAGE_SIZE = 20;

/* -----------------------------------------------------------------------
 * Fix the rows that need attention, in place. Only the fields with an issue
 * are shown (every field on request); corrected rows are checked by the
 * server and imported on their own - rows already imported are never touched.
 * --------------------------------------------------------------------- */

const RowCard = ({ row, fields, mapping, headerLabels, edits, skip, showAll, onEdit, onSkip, onToggleAll }) => {
    const issuesByField = {};
    (row.issues || []).forEach((issue) => {
        if (issue.field) (issuesByField[issue.field] = issuesByField[issue.field] || []).push(issue);
    });
    const rowIssues = (row.issues || []).filter((issue) => !issue.field);
    const shown = showAll ? fields : fields.filter((field) => issuesByField[field.key] || edits?.[field.key] !== undefined);
    const fixed = row.status === 'ready';

    // Fields that read the same cell of the file (billing and shipping pincode both read
    // "Pincode") get one input: the server corrects the cell, so both change together.
    const groups = [];
    shown.forEach((field) => {
        const column = mapping?.[field.key]?.[0];
        const group = column && groups.find((candidate) => candidate.column === column && row.raw[candidate.fields[0].key] === row.raw[field.key]);
        if (group) group.fields.push(field);
        else groups.push({ column, fields: [field] });
    });

    return (
        <div className={`rounded-2xl border p-4 transition-colors ${fixed ? 'border-emerald-200 bg-emerald-50/40' : skip ? 'border-slate-200 bg-slate-50 opacity-80' : 'border-slate-200 bg-white'}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                    <span className="font-black text-slate-900">Excel row {row.rowNumber}</span>
                    <StatusBadge row={row} />
                    {fixed && <span className="flex items-center gap-1 text-xs font-semibold text-emerald-700"><MdCheckCircle size={14} /> Fixed — ready to import</span>}
                </div>
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 cursor-pointer select-none">
                    <input type="checkbox" checked={skip} onChange={(event) => onSkip(event.target.checked)} className="rounded border-slate-300" />
                    Skip this row
                </label>
            </div>

            {row.error && <p className="mt-2 text-sm font-semibold text-rose-700">{row.error}</p>}
            {rowIssues.map((issue, index) => (
                <p key={index} className="mt-2 text-sm">
                    <span className="font-semibold text-slate-800">{issue.message}</span>
                    {issue.hint && <span className="text-slate-500"> {issue.hint}</span>}
                </p>
            ))}

            {!skip && (
                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                    {groups.map(({ column, fields: groupFields }) => {
                        const [field] = groupFields;
                        const required = groupFields.some((item) => item.required);
                        const fieldIssues = groupFields.flatMap((item) => issuesByField[item.key] || []);
                        const value = edits?.[field.key] ?? row.raw[field.key] ?? '';
                        const inputId = `fix-${row.rowNumber}-${field.key}`;
                        const label = groupFields.map((item) => item.label).join(' and ');
                        return (
                            <div key={field.key}>
                                <label htmlFor={inputId} className="block text-xs font-bold text-slate-700 mb-1">
                                    {label}{required && <span className="text-rose-500"> *</span>}
                                    {!required && <span className="font-medium text-slate-400"> (optional)</span>}
                                </label>
                                <input
                                    id={inputId}
                                    value={value}
                                    inputMode={field.type === 'number' ? 'decimal' : undefined}
                                    onChange={(event) => onEdit(field.key, event.target.value)}
                                    placeholder={required ? `Enter ${field.label.toLowerCase()}` : 'Leave blank if not known'}
                                    className={`w-full px-3 py-2 rounded-xl border text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-200 ${fieldIssues.length && edits?.[field.key] === undefined ? 'border-amber-300' : 'border-slate-200'}`}
                                />
                                {groupFields.length > 1 && (
                                    <p className="mt-1 text-[11px] text-slate-400">Both come from the “{headerLabels[column] || column}” column of your file.</p>
                                )}
                                {fieldIssues.map((issue, index) => (
                                    <p key={index} className="mt-1 text-xs">
                                        <span className="font-semibold text-amber-800">{issue.message}</span>
                                        {issue.hint && <span className="text-slate-500"> {issue.hint}</span>}
                                    </p>
                                ))}
                            </div>
                        );
                    })}
                </div>
            )}
            {!skip && (
                <button type="button" onClick={onToggleAll} className="mt-3 text-xs font-semibold text-primary-600 hover:underline">
                    {showAll ? 'Show only the fields that need attention' : 'Edit other fields of this row'}
                </button>
            )}
        </div>
    );
};

const ImportFixRows = ({ job, busy, onJobChange, onBack, onImport, onDownload, onUploadCorrections }) => {
    const { fields } = job.module;
    const counts = job.counts || {};
    const headerLabels = Object.fromEntries((job.headers || []).map((header) => [header.key, header.label]));
    const [filter, setFilter] = useState('attention');
    const [page, setPage] = useState(1);
    const [list, setList] = useState({ rows: [], total: 0 });
    const [loading, setLoading] = useState(false);
    const [edits, setEdits] = useState({});
    const [skips, setSkips] = useState({});
    const [showAll, setShowAll] = useState({});
    const [checking, setChecking] = useState(false);
    const [message, setMessage] = useState(null);
    const fileRef = useRef(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const response = await importJobService.getRows(job.id, { status: filter, page, limit: PAGE_SIZE });
            setList(response.data);
        } catch (error) {
            setMessage({ tone: 'error', ...apiError(error, 'Could not load the rows.') });
        } finally {
            setLoading(false);
        }
    }, [job.id, filter, page]);

    // Reloaded on page/filter changes only, so rows fixed on this page stay visible as "fixed".
    useEffect(() => { load(); }, [load]);

    const pendingRows = new Set([...Object.keys(edits), ...Object.keys(skips)].map(Number));
    const dirty = pendingRows.size > 0;
    const pages = Math.max(1, Math.ceil((list.total || 0) / PAGE_SIZE));

    const setEdit = (rowNumber, field, value) => setEdits((current) => ({ ...current, [rowNumber]: { ...(current[rowNumber] || {}), [field]: value } }));
    const setSkip = (row, value) => setSkips((current) => {
        const next = { ...current };
        const wasSkipped = row.status === 'excluded';
        if (value === wasSkipped) delete next[row.rowNumber];
        else next[row.rowNumber] = value;
        return next;
    });

    const checkCorrections = async () => {
        const payload = [...pendingRows].map((rowNumber) => ({
            rowNumber,
            ...(edits[rowNumber] ? { values: edits[rowNumber] } : {}),
            ...(skips[rowNumber] !== undefined ? { exclude: skips[rowNumber] } : {})
        }));
        setChecking(true);
        setMessage(null);
        try {
            const response = await importJobService.correctRows(job.id, payload);
            const updated = new Map(response.data.rows.map((row) => [row.rowNumber, row]));
            setList((current) => ({ ...current, rows: current.rows.map((row) => updated.get(row.rowNumber) || row) }));
            setEdits({});
            setSkips({});
            onJobChange(response.data.job);
            const nowReady = response.data.rows.filter((row) => row.status === 'ready').length;
            const stillOpen = response.data.rows.filter((row) => row.status === 'attention' || row.status === 'failed').length;
            const unchanged = payload.length - response.data.rows.length;
            setMessage({
                tone: stillOpen ? 'warning' : 'success',
                message: [
                    nowReady ? `${plural(nowReady, 'row is', 'rows are')} ready to import.` : '',
                    stillOpen ? `${plural(stillOpen, 'row still needs', 'rows still need')} attention.` : '',
                    unchanged > 0 ? `${plural(unchanged, 'row was', 'rows were')} not changed.` : ''
                ].filter(Boolean).join(' ') || 'Saved.'
            });
        } catch (error) {
            setMessage({ tone: 'error', ...apiError(error, 'Could not check the corrections.') });
        } finally {
            setChecking(false);
        }
    };

    const handleUpload = async (event) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) return;
        await onUploadCorrections(file);
        setEdits({});
        setSkips({});
        setPage(1);
        await load();
    };

    const toneClass = {
        success: 'text-emerald-800 bg-emerald-50 border-emerald-200',
        warning: 'text-amber-900 bg-amber-50 border-amber-200',
        error: 'text-rose-800 bg-rose-50 border-rose-200'
    };

    return (
        <div className="space-y-4">
            <div>
                <h4 className="text-lg font-black text-slate-900 tracking-tight">Fix the rows that need attention</h4>
                <p className="text-sm text-slate-500 mt-0.5">
                    Correct the information below and choose “Check corrections”. Only these rows are checked and imported again;
                    rows already imported are not touched.
                </p>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex gap-1.5">
                    {[
                        { key: 'attention', label: 'Needs attention', count: (counts.attention || 0) + (counts.failed || 0) },
                        { key: 'excluded', label: 'Skipped by you', count: counts.excluded || 0 }
                    ].map((item) => (
                        <button
                            key={item.key}
                            type="button"
                            disabled={dirty}
                            onClick={() => { setFilter(item.key); setPage(1); }}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold ${filter === item.key ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'} disabled:opacity-50`}
                        >
                            {item.label} <span className="tabular-nums opacity-70">{formatCount(item.count)}</span>
                        </button>
                    ))}
                </div>
                <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={onDownload} disabled={busy || !((counts.attention || 0) + (counts.failed || 0))} className={buttonClass.secondary}>
                        <MdDownload size={15} /> Download rows to fix
                    </button>
                    <button type="button" onClick={() => fileRef.current?.click()} disabled={busy || dirty} className={buttonClass.secondary}>
                        <MdUploadFile size={15} /> Upload corrected file
                    </button>
                    <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleUpload} className="hidden" />
                </div>
            </div>

            {message && (
                <p className={`text-sm font-semibold border rounded-xl px-3 py-2 ${toneClass[message.tone]}`}>
                    {message.message}{message.hint ? ` ${message.hint}` : ''}
                </p>
            )}

            <div className={`space-y-3 ${loading ? 'opacity-60' : ''}`}>
                {list.rows.map((row) => (
                    <RowCard
                        key={row.rowNumber}
                        row={row}
                        fields={fields}
                        mapping={job.mapping}
                        headerLabels={headerLabels}
                        edits={edits[row.rowNumber]}
                        skip={skips[row.rowNumber] ?? row.status === 'excluded'}
                        showAll={Boolean(showAll[row.rowNumber])}
                        onEdit={(field, value) => setEdit(row.rowNumber, field, value)}
                        onSkip={(value) => setSkip(row, value)}
                        onToggleAll={() => setShowAll((current) => ({ ...current, [row.rowNumber]: !current[row.rowNumber] }))}
                    />
                ))}
                {!loading && !list.rows.length && (
                    <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center">
                        <MdCheckCircle className="mx-auto text-emerald-500" size={32} />
                        <p className="mt-2 font-bold text-slate-800">{filter === 'excluded' ? 'No skipped rows.' : 'Nothing left to fix.'}</p>
                    </div>
                )}
            </div>

            {pages > 1 && (
                <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>Page {page} of {pages}</span>
                    <span className="flex gap-1">
                        <button type="button" disabled={page <= 1 || dirty || loading} onClick={() => setPage((value) => value - 1)} className="px-3 py-1 rounded-lg border border-slate-200 font-semibold disabled:opacity-40">Previous</button>
                        <button type="button" disabled={page >= pages || dirty || loading} onClick={() => setPage((value) => value + 1)} className="px-3 py-1 rounded-lg border border-slate-200 font-semibold disabled:opacity-40">Next</button>
                    </span>
                </div>
            )}

            <ActionBar
                note={dirty
                    ? `${plural(pendingRows.size, 'row has', 'rows have')} unchecked changes.`
                    : counts.ready ? `${plural(counts.ready, 'row is', 'rows are')} ready to import.` : 'Correct a row, then check it.'}
            >
                <button type="button" onClick={onBack} disabled={checking || busy} className={buttonClass.quiet}>
                    <MdArrowBack size={15} /> Back
                </button>
                {dirty && (
                    <button type="button" onClick={() => { setEdits({}); setSkips({}); }} disabled={checking} className={buttonClass.quiet}>
                        <MdUndo size={15} /> Discard changes
                    </button>
                )}
                <button type="button" onClick={checkCorrections} disabled={!dirty || checking || busy} className={buttonClass.secondary}>
                    {checking ? 'Checking…' : 'Check corrections'}
                </button>
                <button type="button" onClick={onImport} disabled={dirty || checking || busy || !counts.ready} className={buttonClass.primary}>
                    <MdCloudUpload size={15} /> Import {formatCount(counts.ready)} ready {counts.ready === 1 ? 'row' : 'rows'}
                </button>
            </ActionBar>
        </div>
    );
};

export default ImportFixRows;
