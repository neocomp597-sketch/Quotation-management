import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
    MdCloudUpload, MdDownload, MdDescription, MdCheckCircle,
    MdError, MdWarning, MdTableChart, MdClose
} from 'react-icons/md';
import Modal from './Modal';
import api, { importService, setNextImportId } from '../services/api';
import { useSubmitGuard } from '../hooks/useSubmitGuard';

// Rows of the error table shown at a time; a 5,000-row file can return thousands of errors.
const ERROR_PAGE_SIZE = 50;
// How often the server is asked how far the import has got while it saves the rows.
const PROGRESS_POLL_MS = 1500;

/* -----------------------------------------------------------------------
 * ImportModal – shared upload UI for every master module.
 *
 * Props:
 *   isOpen               – controls modal visibility
 *   onClose              – called when user closes the modal
 *   title                – modal heading (e.g. "Import Invoice Bulk Upload")
 *   onImport(file,prog)  – async function that posts the file; must return axios response
 *   onDownloadTemplate() – async function that returns a blob response
 *   type                 – used for template filename (default: 'products')
 *   onSuccess()          – optional callback fired after a successful (or partial) import
 * --------------------------------------------------------------------- */

// Download an array of {row, serialNo, reason} errors as an xlsx report.
function downloadErrorReport(errors, filename = 'import_errors.xlsx') {
    // Build a tab-separated text that can be opened in Excel as a fallback,
    // or use the browser's native Blob+download mechanism.
    // We don't import SheetJS in the frontend, so we build a simple CSV.
    const headers = ['Row', 'Serial No / Identifier', 'Status', 'Reason'];
    const rows = errors.map(e => {
        const isObj = e && typeof e === 'object';
        const row = isObj ? e.row ?? '' : '';
        const sn = isObj ? e.serialNo ?? '' : '';
        const reason = isObj ? e.reason ?? String(e) : String(e);
        const status = reason.toLowerCase().includes('duplicate') || reason.toLowerCase().includes('already') ? 'Duplicate' : 'Failed';
        return [row, sn, status, reason].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
    });
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename.replace(/\.xlsx$/, '.csv');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Normalise one error entry into { row, serialNo, reason }.
function normaliseError(e) {
    if (e && typeof e === 'object') return { row: e.row ?? '', serialNo: e.serialNo ?? '', reason: e.reason ?? JSON.stringify(e) };
    // Legacy plain-string format: "Row 3: some reason"
    const m = String(e).match(/^Row\s+(\d+):\s+(.+)$/i);
    if (m) return { row: Number(m[1]), serialNo: '', reason: m[2] };
    return { row: '', serialNo: '', reason: String(e) };
}

const STATUS_COLOR = {
    completed: 'emerald',
    partial:   'amber',
    failed:    'rose',
};

const ImportModal = ({ isOpen, onClose, title, onImport, onDownloadTemplate, type = 'products', onSuccess }) => {
    const [file, setFile]                       = useState(null);
    const [isImporting, setIsImporting]         = useState(false);
    const [isDownloading, setIsDownloading]     = useState(false);
    const [result, setResult]                   = useState(null);
    const [dragActive, setDragActive]           = useState(false);
    const [importProgress, setImportProgress]   = useState({ processed: 0, total: 0 });
    const [importStage, setImportStage]         = useState('idle'); // idle | uploading | processing
    const [errorPage, setErrorPage]             = useState(0);
    // Counts the server reports while it saves the rows: { stage, total, processed, created, ... }
    const [liveProgress, setLiveProgress]       = useState(null);
    const fileInputRef  = useRef(null);
    const abortCtrlRef  = useRef(null);          // AbortController for in-flight request
    const inFlightRef   = useRef(false);         // a second click never starts a second import
    const importIdRef   = useRef(null);          // the name this upload carries (X-Import-Id)

    // While the upload request is open, ask the server how many rows it has saved so far: by
    // the upload's own name, or - if the name did not reach the server - the screen's latest one.
    useEffect(() => {
        if (!isImporting) return undefined;
        let stopped = false;
        let timer;
        const poll = async () => {
            let data = null;
            try {
                data = (await importService.getProgressById(importIdRef.current)).data;
            } catch {
                try {
                    data = (await importService.getProgress(type)).data;
                    // A finished entry there is an earlier import of this screen.
                    if (data?.stage === 'finished') data = null;
                } catch { /* another server instance, or not started yet: keep the plain progress bar */ }
            }
            if (!stopped && data) setLiveProgress(data);
            if (!stopped) timer = setTimeout(poll, PROGRESS_POLL_MS);
        };
        timer = setTimeout(poll, PROGRESS_POLL_MS);
        return () => { stopped = true; clearTimeout(timer); };
    }, [isImporting, type]);

    // ---------- drag-and-drop ----------
    const handleDrag = (e) => {
        e.preventDefault(); e.stopPropagation();
        setDragActive(e.type === 'dragenter' || e.type === 'dragover');
    };
    const handleDrop = (e) => {
        e.preventDefault(); e.stopPropagation();
        setDragActive(false);
        const f = e.dataTransfer.files?.[0];
        if (f) handleFileSelect(f);
    };

    // ---------- file validation ----------
    const handleFileSelect = (selectedFile) => {
        const ok = ['.xlsx', '.xls', '.csv'].some(ext => selectedFile.name.toLowerCase().endsWith(ext)) ||
            ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
             'application/vnd.ms-excel', 'text/csv', 'application/csv'].includes(selectedFile.type);
        if (!ok) { alert('Please upload an Excel (.xlsx, .xls) or CSV file'); return; }
        setFile(selectedFile);
        setResult(null);
        setErrorPage(0);
    };
    const handleFileChange = (e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); };

    // ---------- upload ----------
    const { execute: handleImport } = useSubmitGuard(async () => {
        if (!file || inFlightRef.current) return;
        inFlightRef.current = true;

        // Cancel any previous in-flight request.
        abortCtrlRef.current?.abort();
        abortCtrlRef.current = new AbortController();

        setIsImporting(true);
        setResult(null);
        setErrorPage(0);
        setLiveProgress(null);
        setImportProgress({ processed: 0, total: 0 });
        setImportStage('uploading');
        importIdRef.current = `imp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
        setNextImportId(importIdRef.current);

        try {
            const response = await onImport(file, (event) => {
                const total  = event.total  || file.size || 0;
                const loaded = Math.min(event.loaded || 0, total || event.loaded || 0);
                if (total > 0 && loaded >= total) setImportStage('processing');
                setImportProgress({ processed: loaded, total });
            }, abortCtrlRef.current.signal);

            const d = response.data;
            const successCount  = d.success ?? (d.created ?? 0) + (d.updated ?? 0);
            const failedCount   = d.failed  ?? 0;
            const skippedCount  = d.skipped ?? 0;
            const total         = successCount + failedCount;

            setImportProgress({ processed: total, total });
            const errors = (d.errors || []).map(normaliseError);

            setResult({
                status:        d.status || (failedCount === 0 ? 'completed' : successCount > 0 ? 'partial' : 'failed'),
                message:       d.message,
                successCount,
                failedCount,
                skippedCount,
                createdCount:  d.created,
                updatedCount:  d.updated,
                errors,
                missingCustomerCodes: d.missingCustomerCodes || [],
                missingProductCodes:  d.missingProductCodes  || [],
                missingMgr1Codes:     d.missingMgr1Codes     || [],
                missingMgr2Codes:     d.missingMgr2Codes     || [],
            });
            setFile(null);
            if (successCount > 0 && onSuccess) onSuccess();
        } catch (err) {
            if (err.name === 'CanceledError' || err.name === 'AbortError') return; // user cancelled
            const ed = err.response?.data || {};
            const errors = (ed.errors || []).map(normaliseError);
            setResult({
                status:  'failed',
                message: ed.message || 'Import failed. Please check the file and try again.',
                errors,
                successCount: 0,
                failedCount:  errors.length || 1,
                missingCustomerCodes: ed.missingCustomerCodes || [],
                missingProductCodes:  ed.missingProductCodes  || [],
                missingMgr1Codes:     ed.missingMgr1Codes     || [],
                missingMgr2Codes:     ed.missingMgr2Codes     || [],
            });
        } finally {
            setNextImportId(null);
            inFlightRef.current = false;
            setIsImporting(false);
            setImportStage('idle');
            setLiveProgress(null);
        }
    });

    // ---------- cancel in-flight ----------
    // Once the file has reached the server, cancelling only stops waiting: the server finishes
    // saving the rows, so the message says so instead of claiming nothing was imported.
    const handleCancel = useCallback(() => {
        abortCtrlRef.current?.abort();
        const serverHasFile = importStage === 'processing' || Boolean(liveProgress);
        inFlightRef.current = false;
        setIsImporting(false);
        setImportStage('idle');
        setLiveProgress(null);
        setResult({
            status: 'failed',
            message: serverHasFile
                ? 'Stopped waiting for the import. The server keeps saving the rows it received; refresh the list in a minute to see them. Importing the same file again updates them, it does not duplicate them.'
                : 'Upload cancelled by user.',
            errors: [], successCount: 0, failedCount: 0
        });
    }, [importStage, liveProgress]);

    // ---------- download missing codes ----------
    const handleDownloadMissingCodes = async (filename) => {
        try {
            const response = await api.get(`/import/missing-codes/${filename}`, { responseType: 'blob' });
            const url = URL.createObjectURL(new Blob([response.data], { type: 'text/plain' }));
            const a = document.createElement('a'); a.href = url; a.download = filename;
            document.body.appendChild(a); a.click(); document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch { alert('Failed to download file'); }
    };

    // ---------- download template ----------
    const handleDownloadTemplate = async () => {
        setIsDownloading(true);
        try {
            const response = await onDownloadTemplate();
            const url = URL.createObjectURL(new Blob([response.data], {
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            }));
            const a = document.createElement('a'); a.href = url;
            a.download = `${type}_import_template.xlsx`;
            document.body.appendChild(a); a.click(); document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch { alert('Failed to download template'); }
        finally { setIsDownloading(false); }
    };

    // ---------- close ----------
    const handleClose = () => {
        if (isImporting) { handleCancel(); return; }
        setFile(null); setResult(null);
        setImportProgress({ processed: 0, total: 0 });
        setImportStage('idle'); setErrorPage(0);
        onClose();
    };

    // ---------- derived values ----------
    const normErrors   = result?.errors || [];
    const errorPageCount = Math.max(1, Math.ceil(normErrors.length / ERROR_PAGE_SIZE));
    const shownErrorPage = Math.min(errorPage, errorPageCount - 1);
    const visibleErrors = normErrors.slice(shownErrorPage * ERROR_PAGE_SIZE, (shownErrorPage + 1) * ERROR_PAGE_SIZE);
    const statusColor  = STATUS_COLOR[result?.status] || 'rose';
    const serverCounting = liveProgress && liveProgress.total > 0;

    const progressPct = serverCounting
        ? Math.min(Math.round((liveProgress.processed / liveProgress.total) * 100), 100)
        : importProgress.total > 0
            ? Math.min(Math.round((importProgress.processed / importProgress.total) * 100), 100)
            : (importStage === 'processing' ? 99 : 20);

    return (
        <Modal isOpen={isOpen} onClose={handleClose} title={title} maxWidth="max-w-2xl">
            <div className="space-y-5">

                {/* ── Template download ── */}
                <div className="bg-gradient-to-br from-primary-50 to-primary-100/50 rounded-2xl p-5 border border-primary-100">
                    <div className="flex items-start gap-4">
                        <div className="p-3 bg-white rounded-xl shadow-sm shrink-0">
                            <MdDescription className="text-primary-600" size={24} />
                        </div>
                        <div className="flex-1">
                            <h4 className="font-bold text-slate-900 mb-1">Download Template</h4>
                            <p className="text-sm text-slate-500 mb-3">
                                Download the Excel template with the correct format and sample data.
                            </p>
                            <button
                                onClick={handleDownloadTemplate}
                                disabled={isDownloading || isImporting}
                                className="flex items-center gap-2 px-4 py-2 bg-white border border-primary-200 rounded-xl text-primary-600 font-bold text-xs uppercase tracking-widest hover:bg-primary-50 transition-all disabled:opacity-50"
                            >
                                <MdDownload size={16} />
                                {isDownloading ? 'Downloading…' : 'Download Template'}
                            </button>
                        </div>
                    </div>
                    <p className="mt-3 text-xs font-semibold text-slate-600">
                        For safe import, upload a maximum of 5,000 rows per file. Split larger files into separate uploads.
                    </p>
                </div>

                {/* ── Drop zone ── */}
                <div
                    onDragEnter={handleDrag} onDragLeave={handleDrag}
                    onDragOver={handleDrag}  onDrop={handleDrop}
                    onClick={() => !isImporting && fileInputRef.current?.click()}
                    className={`relative border-2 border-dashed rounded-2xl p-6 text-center transition-all
                        ${isImporting ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}
                        ${dragActive      ? 'border-primary-500 bg-primary-50'
                        : file           ? 'border-emerald-300 bg-emerald-50'
                        : 'border-slate-200 bg-slate-50 hover:border-primary-300 hover:bg-primary-50/30'}`}
                >
                    <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFileChange} className="hidden" />
                    {file ? (
                        <div className="flex flex-col items-center">
                            <div className="p-4 bg-emerald-100 rounded-full mb-3">
                                <MdCheckCircle className="text-emerald-600" size={32} />
                            </div>
                            <p className="font-bold text-slate-900 mb-1">{file.name}</p>
                            <p className="text-sm text-slate-500">{(file.size / 1024).toFixed(1)} KB</p>
                            <button
                                onClick={(e) => { e.stopPropagation(); setFile(null); setResult(null); }}
                                disabled={isImporting}
                                className="mt-3 text-xs text-rose-500 hover:text-rose-700 font-bold uppercase tracking-widest disabled:opacity-50"
                            >Remove File</button>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center">
                            <div className={`p-4 rounded-full mb-3 ${dragActive ? 'bg-primary-100' : 'bg-slate-100'}`}>
                                <MdCloudUpload className={dragActive ? 'text-primary-600' : 'text-slate-400'} size={32} />
                            </div>
                            <p className="font-bold text-slate-900 mb-1">
                                {dragActive ? 'Drop your file here' : 'Drag & drop your file here'}
                            </p>
                            <p className="text-sm text-slate-500">or click to browse</p>
                            <p className="text-xs text-slate-400 mt-2">Supports: .xlsx, .xls, .csv (max 10 MB)</p>
                        </div>
                    )}
                </div>

                {/* ── Progress bar ── */}
                {isImporting && (
                    <div className="rounded-2xl p-4 bg-blue-50 border border-blue-100">
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-sm font-bold text-blue-900">
                                {liveProgress?.stage === 'queued'
                                    ? 'Waiting for another import to finish…'
                                    : liveProgress || importStage === 'processing' ? 'Saving rows…' : 'Uploading file…'}
                            </p>
                            <div className="flex items-center gap-3">
                                <span className="text-xs font-bold text-blue-600">{progressPct}%</span>
                                <button
                                    onClick={handleCancel}
                                    className="text-xs text-rose-500 hover:text-rose-700 font-bold uppercase tracking-widest flex items-center gap-1"
                                >
                                    <MdClose size={12} /> Cancel
                                </button>
                            </div>
                        </div>
                        <div className="w-full bg-blue-200 rounded-full h-2 overflow-hidden">
                            <div
                                className="bg-gradient-to-r from-blue-500 to-blue-600 h-full transition-all duration-300"
                                style={{ width: `${progressPct}%` }}
                            />
                        </div>
                        {serverCounting ? (
                            <p className="text-xs text-blue-600 mt-2 font-medium">
                                {`${liveProgress.processed.toLocaleString()} of ${liveProgress.total.toLocaleString()} rows processed`}
                                {` · ${liveProgress.created.toLocaleString()} created · ${liveProgress.updated.toLocaleString()} updated`}
                                {` · ${liveProgress.skipped.toLocaleString()} skipped · ${liveProgress.failed.toLocaleString()} failed`}
                            </p>
                        ) : importProgress.total > 0 && (
                            <p className="text-xs text-blue-600 mt-2 font-medium">
                                {importStage === 'uploading'
                                    ? `${Math.round(importProgress.processed / 1024)} KB / ${Math.round(importProgress.total / 1024)} KB uploaded`
                                    : `${importProgress.processed} / ${importProgress.total} entries`}
                            </p>
                        )}
                        {isImporting && (
                            <p className="text-[11px] text-blue-500 mt-1">
                                You can keep working in other tabs; large files can take a minute.
                            </p>
                        )}
                    </div>
                )}

                {/* ── Result panel ── */}
                {result && (
                    <div className="space-y-4">

                        {/* Status banner */}
                        {result.status === 'completed' && (
                            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-start gap-3">
                                <MdCheckCircle className="text-emerald-600 shrink-0 mt-0.5" size={20} />
                                <div>
                                    <p className="font-bold text-emerald-900 text-sm">Import Successful</p>
                                    <p className="text-xs text-emerald-700 mt-1">
                                        {result.message || `Successfully imported ${result.successCount} records.`}
                                    </p>
                                </div>
                            </div>
                        )}

                        {result.status === 'partial' && (
                            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
                                <MdWarning className="text-amber-600 shrink-0 mt-0.5" size={20} />
                                <div>
                                    <p className="font-bold text-amber-900 text-sm">Partially Imported</p>
                                    <p className="text-xs text-amber-700 mt-1">
                                        {result.successCount} records imported successfully. {result.failedCount} records failed.
                                        {result.skippedCount > 0 && ` ${result.skippedCount} skipped (duplicates within file).`}
                                    </p>
                                </div>
                            </div>
                        )}

                        {result.status === 'failed' && (
                            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-start gap-3">
                                <MdError className="text-rose-600 shrink-0 mt-0.5" size={20} />
                                <div>
                                    <p className="font-bold text-rose-900 text-sm">Import Failed</p>
                                    <p className="text-xs text-rose-700 mt-1">
                                        {result.message || 'The import encountered errors and could not be completed.'}
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Summary pills */}
                        {result.status !== 'failed' && (
                            <div className="grid grid-cols-4 gap-2">
                                {[
                                    { label: 'Created',  val: result.createdCount,  color: 'emerald' },
                                    { label: 'Updated',  val: result.updatedCount,  color: 'blue'    },
                                    { label: 'Skipped',  val: result.skippedCount,  color: 'slate'   },
                                    { label: 'Failed',   val: result.failedCount,   color: 'rose'    },
                                ].filter(p => p.val !== undefined && p.val !== null).map(({ label, val, color }) => (
                                    <div key={label} className={`bg-${color}-50/60 border border-${color}-100 rounded-2xl p-3 text-center shadow-sm`}>
                                        <span className={`block text-[10px] font-bold text-${color}-500 uppercase tracking-widest mb-0.5`}>{label}</span>
                                        <span className={`text-xl font-black text-${color}-700`}>{val ?? 0}</span>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Row-level error table */}
                        {normErrors.length > 0 && (
                            <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
                                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <MdTableChart className="text-slate-500" size={16} />
                                        <span className="font-bold text-xs text-slate-700 uppercase tracking-wider">
                                            Error Details ({normErrors.length})
                                        </span>
                                    </div>
                                    <button
                                        onClick={() => downloadErrorReport(normErrors, `${type}_import_errors.csv`)}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 font-semibold hover:bg-slate-50 shadow-sm transition-all"
                                    >
                                        <MdDownload size={13} />
                                        Download Error Report
                                    </button>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-xs">
                                        <thead>
                                            <tr className="bg-slate-50 border-b border-slate-200">
                                                <th className="px-3 py-2 text-left font-bold text-slate-600 w-14">Row</th>
                                                <th className="px-3 py-2 text-left font-bold text-slate-600 w-32">Serial No</th>
                                                <th className="px-3 py-2 text-left font-bold text-slate-600 w-20">Status</th>
                                                <th className="px-3 py-2 text-left font-bold text-slate-600">Reason</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {visibleErrors.map((e, idx) => {
                                                const isDup = e.reason?.toLowerCase().includes('duplicate') || e.reason?.toLowerCase().includes('already');
                                                return (
                                                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                                        <td className="px-3 py-2 font-mono text-slate-500">{e.row || '—'}</td>
                                                        <td className="px-3 py-2 font-mono text-slate-700 font-semibold">{e.serialNo || '—'}</td>
                                                        <td className="px-3 py-2">
                                                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide
                                                                ${isDup ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'}`}>
                                                                {isDup ? 'Duplicate' : 'Failed'}
                                                            </span>
                                                        </td>
                                                        <td className="px-3 py-2 text-slate-600">{e.reason}</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                                {normErrors.length > ERROR_PAGE_SIZE && (
                                    <div className="px-4 py-2 border-t border-slate-100 flex items-center justify-between text-xs">
                                        <span className="text-slate-500">
                                            {`Rows ${(shownErrorPage * ERROR_PAGE_SIZE + 1).toLocaleString()}–${Math.min((shownErrorPage + 1) * ERROR_PAGE_SIZE, normErrors.length).toLocaleString()} of ${normErrors.length.toLocaleString()}`}
                                        </span>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => setErrorPage(shownErrorPage - 1)}
                                                disabled={shownErrorPage === 0}
                                                className="px-3 py-1 rounded-lg border border-slate-200 font-bold text-primary-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                                            >Previous</button>
                                            <button
                                                onClick={() => setErrorPage(shownErrorPage + 1)}
                                                disabled={shownErrorPage >= errorPageCount - 1}
                                                className="px-3 py-1 rounded-lg border border-slate-200 font-bold text-primary-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                                            >Next</button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Missing codes download */}
                        {((result.missingCustomerCodes?.length > 0) || (result.missingProductCodes?.length > 0) ||
                          (result.missingMgr1Codes?.length > 0) || (result.missingMgr2Codes?.length > 0)) && (
                            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                                <p className="font-bold text-slate-800 text-xs uppercase tracking-wider">Missing Master Records</p>
                                <p className="text-xs text-slate-500">
                                    These records don't exist yet. Download and create them before importing again:
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    {result.missingCustomerCodes?.length > 0 && (
                                        <button onClick={() => handleDownloadMissingCodes('missing_customer_codes.txt')}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 font-semibold hover:bg-slate-50 shadow-sm">
                                            <MdDownload size={14} /> Missing Customer Codes ({result.missingCustomerCodes.length})
                                        </button>
                                    )}
                                    {result.missingProductCodes?.length > 0 && (
                                        <button onClick={() => handleDownloadMissingCodes('missing_product_codes.txt')}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 font-semibold hover:bg-slate-50 shadow-sm">
                                            <MdDownload size={14} /> Missing Product Codes ({result.missingProductCodes.length})
                                        </button>
                                    )}
                                    {result.missingMgr1Codes?.length > 0 && (
                                        <button onClick={() => handleDownloadMissingCodes('missing_mgr1_codes.txt')}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 font-semibold hover:bg-slate-50 shadow-sm">
                                            <MdDownload size={14} /> Missing MGR 1 Codes ({result.missingMgr1Codes.length})
                                        </button>
                                    )}
                                    {result.missingMgr2Codes?.length > 0 && (
                                        <button onClick={() => handleDownloadMissingCodes('missing_mgr2_codes.txt')}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 font-semibold hover:bg-slate-50 shadow-sm">
                                            <MdDownload size={14} /> Missing MGR 2 Codes ({result.missingMgr2Codes.length})
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ── Actions ── */}
                <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                    <button
                        onClick={handleClose}
                        className="border border-slate-200 text-slate-500 hover:bg-slate-50 px-8 py-3 rounded-2xl font-black transition-all uppercase text-[10px] tracking-widest active:scale-95"
                    >
                        {isImporting ? 'Cancel Upload' : 'Close'}
                    </button>
                    {!isImporting && (
                        <button
                            onClick={handleImport}
                            disabled={!file}
                            className="bg-primary-600 hover:bg-primary-700 text-white px-8 py-3 rounded-2xl font-black transition-all shadow-xl shadow-primary-600/20 uppercase text-[10px] tracking-widest active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            <MdCloudUpload size={16} />
                            Import Data
                        </button>
                    )}
                    {isImporting && (
                        <button
                            disabled
                            className="bg-blue-500 text-white px-8 py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest opacity-80 cursor-not-allowed flex items-center gap-2"
                        >
                            <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                            </svg>
                            Importing…
                        </button>
                    )}
                </div>

            </div>
        </Modal>
    );
};

export default ImportModal;
