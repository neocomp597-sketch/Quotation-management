import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    MdCloudUpload, MdDownload, MdDescription, MdErrorOutline, MdHistory, MdClose, MdUploadFile, MdFactCheck
} from 'react-icons/md';
import { toast } from 'react-toastify';
import Modal from '../Modal';
import { importJobService } from '../../services/api';
import ImportPreviewStep from './ImportPreviewStep';
import ImportResultStep from './ImportResultStep';
import ImportFixRows from './ImportFixRows';
import { ACCEPTED_FILE, apiError, buttonClass, formatCount, plural, saveBlob } from './importHelpers';
import { ActionBar } from './ImportParts';

/* -----------------------------------------------------------------------
 * ImportWizard – staged bulk import (backend/services/importEngine).
 *
 *   upload -> preview (columns, every row checked) -> importing -> result
 *                         \-> fix rows <-----------------/
 *
 * Valid rows are imported even when others need attention; those can be
 * fixed on screen or in a downloaded file and imported on their own later.
 *
 * Props:
 *   isOpen, onClose
 *   module               – import module key on the server ('customers')
 *   title                – modal heading
 *   onDownloadTemplate() – async, returns a blob response (the module's template)
 *   onImported()         – called after a run saved records (refresh the list)
 *   params               – optional settings of the screen sent with the file, e.g.
 *                          { financialYear } or { priceBookId }; recent imports are per setting
 *   templateName         – optional file name of the downloaded template
 * --------------------------------------------------------------------- */

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const POLL_MS = 1200;
const WAIT_LIMIT_MS = 15 * 60 * 1000;

const STEPS = [
    { key: 'upload', label: 'Upload file' },
    { key: 'preview', label: 'Check rows' },
    { key: 'importing', label: 'Import' },
    { key: 'result', label: 'Review' }
];

const Stepper = ({ step }) => {
    const current = STEPS.findIndex((item) => item.key === (step === 'fix' ? 'result' : step));
    return (
        <ol className="flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-widest mb-5" aria-label="Import steps">
            {STEPS.map((item, index) => (
                <li key={item.key} className="flex items-center gap-2" aria-current={index === current ? 'step' : undefined}>
                    <span className={`flex items-center justify-center w-5 h-5 rounded-full text-[10px] ${index < current ? 'bg-emerald-500 text-white' : index === current ? 'bg-primary-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                        {index + 1}
                    </span>
                    <span className={index === current ? 'text-slate-900' : 'text-slate-400'}>{item.label}</span>
                    {index < STEPS.length - 1 && <span className="w-6 h-px bg-slate-200" />}
                </li>
            ))}
        </ol>
    );
};

const recentSummary = (job) => {
    const counts = job.counts || {};
    if (job.status === 'importing') return 'Importing now…';
    if (!job.runCount) return `Checked, not imported yet · ${plural(counts.ready, 'row', 'rows')} ready`;
    const needs = (counts.attention || 0) + (counts.failed || 0);
    return `${formatCount(counts.imported)} of ${formatCount(counts.total)} imported${needs ? ` · ${plural(needs, 'row needs', 'rows need')} attention` : ''}`;
};

const ImportWizard = ({ isOpen, onClose, module, title, onDownloadTemplate, onImported, params, templateName }) => {
    // Pages pass a new object on every render; the text keeps effects and callbacks stable.
    const paramsKey = JSON.stringify(params || {});
    const [step, setStep] = useState('upload');
    const [job, setJob] = useState(null);
    const [run, setRun] = useState(null);
    const [warning, setWarning] = useState(null);
    const [notice, setNotice] = useState(null);
    const [error, setError] = useState(null);
    const [busy, setBusy] = useState(false);
    const [upload, setUpload] = useState(null); // { name, percent }
    const [recent, setRecent] = useState([]);
    const [dragActive, setDragActive] = useState(false);
    const [downloadingTemplate, setDownloadingTemplate] = useState(false);
    const [connectionLost, setConnectionLost] = useState(false);
    const fileRef = useRef(null);
    const correctionFileRef = useRef(null);
    const abortRef = useRef(null);
    // Bumped on reset: answers that arrive for an abandoned import are ignored.
    const sessionRef = useRef(0);

    const loadRecent = useCallback(async () => {
        try {
            const response = await importJobService.listJobs(module, JSON.parse(paramsKey));
            setRecent(response.data || []);
        } catch {
            setRecent([]);
        }
    }, [module, paramsKey]);

    useEffect(() => {
        if (isOpen && step === 'upload') loadRecent();
    }, [isOpen, step, loadRecent]);

    const reset = () => {
        sessionRef.current += 1;
        abortRef.current?.abort();
        setStep('upload');
        setJob(null);
        setRun(null);
        setWarning(null);
        setNotice(null);
        setError(null);
        setBusy(false);
        setUpload(null);
        setConnectionLost(false);
        setRecent([]);
    };

    const handleClose = () => {
        // A running import carries on on the server; it is listed under recent imports.
        reset();
        onClose();
    };

    // ---------- step 1: upload and check ----------
    const startPreview = async (file) => {
        if (!ACCEPTED_FILE.test(file.name)) {
            setError({ message: 'This type of file cannot be imported.', hint: 'Choose an Excel (.xlsx, .xls) or CSV file.' });
            return;
        }
        if (file.size > MAX_FILE_BYTES) {
            setError({ message: 'This file is larger than 10 MB.', hint: 'Split it into smaller files and import them one at a time.' });
            return;
        }
        const session = sessionRef.current;
        abortRef.current = new AbortController();
        setError(null);
        setUpload({ name: file.name, percent: 0 });
        try {
            const response = await importJobService.preview(module, file, {
                params: JSON.parse(paramsKey),
                signal: abortRef.current.signal,
                onUploadProgress: (event) => {
                    if (event.total) setUpload((current) => current && { ...current, percent: Math.round((event.loaded / event.total) * 100) });
                }
            });
            if (session !== sessionRef.current) return;
            setJob(response.data.job);
            setStep('preview');
        } catch (err) {
            if (err?.name === 'CanceledError' || err?.name === 'AbortError' || session !== sessionRef.current) return;
            setError(apiError(err, 'The file could not be read.'));
        } finally {
            if (session === sessionRef.current) setUpload(null);
        }
    };

    const cancelUpload = () => {
        abortRef.current?.abort();
        setUpload(null);
    };

    const onFileInput = (event) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (file) startPreview(file);
    };

    const onDrop = (event) => {
        event.preventDefault();
        setDragActive(false);
        const file = event.dataTransfer.files?.[0];
        if (file && !upload) startPreview(file);
    };

    const downloadTemplate = async () => {
        setDownloadingTemplate(true);
        try {
            const response = await onDownloadTemplate();
            saveBlob(response.data, templateName || `${module}_import_template.xlsx`);
        } catch {
            toast.error('Could not download the template.');
        } finally {
            setDownloadingTemplate(false);
        }
    };

    // ---------- step 2: settings ----------
    const updateJob = async (changes) => {
        setBusy(true);
        try {
            const response = await importJobService.updateJob(job.id, changes);
            setJob(response.data.job);
        } catch (err) {
            const { message, hint } = apiError(err, 'Could not update the import.');
            toast.error(`${message}${hint ? ` ${hint}` : ''}`);
        } finally {
            setBusy(false);
        }
    };

    // ---------- step 3: import ----------
    /** Polls the job until no run is in flight; null if the server stays unreachable. */
    const waitForJob = async (jobId, session) => {
        const started = Date.now();
        let failures = 0;
        while (Date.now() - started < WAIT_LIMIT_MS) {
            await new Promise((resolve) => setTimeout(resolve, POLL_MS));
            if (session !== sessionRef.current) return null;
            try {
                const response = await importJobService.getJob(jobId);
                failures = 0;
                setConnectionLost(false);
                setJob(response.data.job);
                if (response.data.job.status !== 'importing') return response.data.job;
            } catch {
                failures += 1;
                if (failures >= 5) setConnectionLost(true);
            }
        }
        return null;
    };

    const finish = (finishedJob, finishedRun, finishedWarning) => {
        setJob(finishedJob);
        setRun(finishedRun);
        setWarning(finishedWarning);
        setStep('result');
        if (!finishedRun || finishedRun.created + finishedRun.updated > 0) onImported?.();
    };

    const startImport = async () => {
        if (!job) return;
        const session = sessionRef.current;
        const jobId = job.id;
        setStep('importing');
        setRun(null);
        setWarning(null);
        setNotice(null);
        setConnectionLost(false);

        // Progress for the bar while the import request is open.
        let polling = true;
        const poll = async () => {
            while (polling && session === sessionRef.current) {
                await new Promise((resolve) => setTimeout(resolve, POLL_MS));
                if (!polling) return;
                try {
                    const response = await importJobService.getJob(jobId);
                    if (polling && session === sessionRef.current) setJob(response.data.job);
                } catch {
                    // the import request itself reports problems
                }
            }
        };
        poll();

        try {
            const response = await importJobService.execute(jobId);
            polling = false;
            if (session !== sessionRef.current) return;
            finish(response.data.job, response.data.run, response.data.warning);
        } catch (err) {
            polling = false;
            if (session !== sessionRef.current) return;
            const failure = apiError(err, 'The import could not be started.');
            const outcomeUnknown = failure.code === 'ALREADY_RUNNING' || failure.code === 'NETWORK' || (err?.response?.status || 0) >= 500;
            if (!outcomeUnknown) {
                toast.error(failure.message);
                setStep('preview');
                return;
            }
            // The server keeps going without us: wait for its own record of the result.
            const finalJob = await waitForJob(jobId, session);
            if (session !== sessionRef.current) return;
            if (finalJob) {
                finish(finalJob, null, failure.code === 'ALREADY_RUNNING'
                    ? null
                    : 'The connection dropped during the import. The numbers below are what the server saved.');
            } else {
                setConnectionLost(true);
            }
        }
    };

    const checkAgain = async () => {
        const session = sessionRef.current;
        setConnectionLost(false);
        const finalJob = await waitForJob(job.id, session);
        if (finalJob && session === sessionRef.current) finish(finalJob, null, null);
        else if (session === sessionRef.current) setConnectionLost(true);
    };

    // ---------- recovery ----------
    const downloadRowsToFix = async () => {
        try {
            const response = await importJobService.exportRows(job.id, 'attention,failed');
            const base = String(job.file?.name || module).replace(/\.(xlsx|xls|csv)$/i, '');
            saveBlob(response.data, `${base}_rows_to_fix.xlsx`);
        } catch {
            toast.error('Could not download the rows.');
        }
    };

    const uploadCorrections = async (file) => {
        if (!ACCEPTED_FILE.test(file.name)) {
            toast.error('Choose the corrected Excel file you downloaded.');
            return;
        }
        setBusy(true);
        setNotice(null);
        try {
            const response = await importJobService.uploadCorrections(job.id, file);
            const { job: updated, applied, skipped = [] } = response.data;
            setJob(updated);
            const still = (updated.counts.attention || 0) + (updated.counts.failed || 0);
            const alreadyIn = skipped.filter((item) => item.reason === 'already_imported').length;
            setNotice([
                applied ? `${plural(applied, 'row was', 'rows were')} corrected from your file.` : 'No changes were found in this file.',
                updated.counts.ready ? `${plural(updated.counts.ready, 'row is', 'rows are')} ready to import.` : '',
                still ? `${plural(still, 'row still needs', 'rows still need')} attention.` : '',
                alreadyIn ? `${plural(alreadyIn, 'row was', 'rows were')} already imported and left as ${alreadyIn === 1 ? 'it was' : 'they were'}.` : ''
            ].filter(Boolean).join(' '));
        } catch (err) {
            const { message, hint } = apiError(err, 'Could not read the corrected file.');
            toast.error(`${message}${hint ? ` ${hint}` : ''}`);
        } finally {
            setBusy(false);
        }
    };

    const openRecent = async (recentJob) => {
        const session = sessionRef.current;
        setError(null);
        try {
            const response = await importJobService.getJob(recentJob.id);
            if (session !== sessionRef.current) return;
            const opened = response.data.job;
            setJob(opened);
            setRun(opened.lastRun);
            if (opened.status === 'importing') {
                setStep('importing');
                const finalJob = await waitForJob(opened.id, session);
                if (finalJob && session === sessionRef.current) finish(finalJob, null, null);
                return;
            }
            setStep(opened.runCount ? 'result' : 'preview');
        } catch (err) {
            setError(apiError(err, 'Could not open this import.'));
            loadRecent();
        }
    };

    // ---------- render ----------
    const counts = job?.counts || {};
    const needs = (counts.attention || 0) + (counts.failed || 0);
    const wide = step === 'preview' || step === 'fix';
    const progress = job?.progress || {};
    const progressPercent = progress.total ? Math.min(100, Math.round((progress.processed / progress.total) * 100)) : 0;

    return (
        <Modal isOpen={isOpen} onClose={handleClose} title={title} maxWidth={wide ? 'max-w-6xl' : 'max-w-3xl'}>
            <Stepper step={step} />

            {step === 'upload' && (
                <div className="space-y-5">
                    <div className="bg-gradient-to-br from-primary-50 to-primary-100/50 rounded-2xl p-5 border border-primary-100 flex flex-col sm:flex-row sm:items-start gap-4">
                        <div className="p-3 bg-white rounded-xl shadow-sm shrink-0 self-start"><MdDescription className="text-primary-600" size={24} /></div>
                        <div className="flex-1">
                            <h4 className="font-bold text-slate-900 mb-1">What the file needs</h4>
                            <ul className="text-sm text-slate-600 space-y-0.5 list-disc pl-4">
                                <li>An Excel (.xlsx, .xls) or CSV file, up to 10 MB and 5,000 rows.</li>
                                <li>The data on the first sheet, with column headings in the first row.</li>
                                <li>Blank optional cells are fine. You will see every row before anything is saved.</li>
                            </ul>
                            <button
                                type="button"
                                onClick={downloadTemplate}
                                disabled={downloadingTemplate || Boolean(upload)}
                                className="mt-3 flex items-center gap-2 px-4 py-2 bg-white border border-primary-200 rounded-xl text-primary-600 font-bold text-xs uppercase tracking-widest hover:bg-primary-50 transition-all disabled:opacity-50"
                            >
                                <MdDownload size={16} /> {downloadingTemplate ? 'Downloading…' : 'Download template'}
                            </button>
                        </div>
                    </div>

                    <div
                        onDragEnter={(event) => { event.preventDefault(); setDragActive(true); }}
                        onDragOver={(event) => { event.preventDefault(); setDragActive(true); }}
                        onDragLeave={(event) => { event.preventDefault(); setDragActive(false); }}
                        onDrop={onDrop}
                        onClick={() => !upload && fileRef.current?.click()}
                        onKeyDown={(event) => { if (!upload && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); fileRef.current?.click(); } }}
                        role="button"
                        tabIndex={0}
                        aria-label="Choose a file to import"
                        className={`relative border-2 border-dashed rounded-2xl p-8 text-center transition-all ${upload ? 'cursor-default border-primary-200 bg-primary-50/40' : dragActive ? 'cursor-pointer border-primary-500 bg-primary-50' : 'cursor-pointer border-slate-200 bg-slate-50 hover:border-primary-300 hover:bg-primary-50/30'}`}
                    >
                        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={onFileInput} className="hidden" />
                        {upload ? (
                            <div className="max-w-sm mx-auto">
                                <p className="font-bold text-slate-900 truncate">{upload.name}</p>
                                <p className="text-sm text-slate-500 mt-1">
                                    {upload.percent < 100 ? `Uploading… ${upload.percent}%` : 'Reading the file and checking every row…'}
                                </p>
                                <div className="mt-3 h-2 rounded-full bg-primary-100 overflow-hidden">
                                    <div className={`h-full bg-primary-600 transition-all duration-300 ${upload.percent >= 100 ? 'animate-pulse' : ''}`} style={{ width: `${Math.max(upload.percent, 5)}%` }} />
                                </div>
                                <button type="button" onClick={(event) => { event.stopPropagation(); cancelUpload(); }} className="mt-3 text-xs font-bold uppercase tracking-widest text-rose-500 hover:text-rose-700 inline-flex items-center gap-1">
                                    <MdClose size={12} /> Cancel
                                </button>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center">
                                <div className={`p-4 rounded-full mb-3 ${dragActive ? 'bg-primary-100' : 'bg-slate-100'}`}>
                                    <MdCloudUpload className={dragActive ? 'text-primary-600' : 'text-slate-400'} size={32} />
                                </div>
                                <p className="font-bold text-slate-900 mb-1">{dragActive ? 'Drop your file here' : 'Drag & drop your file here'}</p>
                                <p className="text-sm text-slate-500">or click to choose it — nothing is saved until you confirm</p>
                            </div>
                        )}
                    </div>

                    {error && (
                        <div className="flex items-start gap-3 bg-rose-50 border border-rose-200 rounded-2xl p-4" role="alert">
                            <MdErrorOutline className="text-rose-600 shrink-0 mt-0.5" size={20} />
                            <div>
                                <p className="font-bold text-rose-900 text-sm">{error.message}</p>
                                {error.hint && <p className="text-xs text-rose-700 mt-1">{error.hint}</p>}
                            </div>
                        </div>
                    )}

                    {recent.length > 0 && (
                        <div className="border border-slate-200 rounded-2xl overflow-hidden">
                            <p className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                                <MdHistory size={15} className="text-slate-500" /> Your recent imports
                            </p>
                            <ul className="divide-y divide-slate-100">
                                {recent.map((item) => (
                                    <li key={item.id} className="px-4 py-2.5 flex items-center justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="text-sm font-semibold text-slate-800 truncate">{item.file?.name}</p>
                                            <p className="text-xs text-slate-500">
                                                {new Date(item.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })} · {recentSummary(item)}
                                            </p>
                                        </div>
                                        <button type="button" onClick={() => openRecent(item)} disabled={Boolean(upload)} className="shrink-0 text-xs font-bold text-primary-600 hover:text-primary-700 disabled:opacity-50">
                                            Open
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    <ActionBar note="">
                        <button type="button" onClick={handleClose} className={buttonClass.secondary}>Close</button>
                    </ActionBar>
                </div>
            )}

            {step === 'preview' && job && (
                <>
                    <ImportPreviewStep
                        job={job}
                        busy={busy}
                        onApplyMapping={(mapping) => updateJob({ mapping })}
                        onModeChange={(mode) => updateJob({ mode })}
                        onReplaceFile={() => { setJob(null); setStep('upload'); }}
                    />
                    <ActionBar note={needs && counts.ready ? `${plural(needs, 'row that needs', 'rows that need')} attention will be left out.` : ''}>
                        <button type="button" onClick={handleClose} disabled={busy} className={buttonClass.quiet}>Cancel</button>
                        {needs > 0 && (
                            <button type="button" onClick={() => setStep('fix')} disabled={busy} className={buttonClass.secondary}>
                                <MdFactCheck size={15} /> Review {plural(needs, 'issue', 'issues')}
                            </button>
                        )}
                        <button type="button" onClick={startImport} disabled={busy || !counts.ready} className={buttonClass.primary}>
                            <MdCloudUpload size={15} />
                            {counts.ready
                                ? `Import ${formatCount(counts.ready)} ${needs ? 'valid ' : ''}${counts.ready === 1 ? 'row' : 'rows'}`
                                : 'Nothing to import yet'}
                        </button>
                    </ActionBar>
                </>
            )}

            {step === 'importing' && job && (
                <div className="space-y-5">
                    <div className="rounded-2xl p-6 bg-blue-50 border border-blue-100">
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-sm font-bold text-blue-900">
                                {connectionLost ? 'Waiting for the server…' : `Importing ${job.module.recordLabelPlural}…`}
                            </p>
                            <span className="text-xs font-bold text-blue-700 tabular-nums">{progressPercent}%</span>
                        </div>
                        <div className="w-full bg-blue-200 rounded-full h-2.5 overflow-hidden">
                            <div className="bg-gradient-to-r from-blue-500 to-blue-600 h-full transition-all duration-500" style={{ width: `${Math.max(progressPercent, 3)}%` }} />
                        </div>
                        <p className="text-xs text-blue-700 mt-2 font-medium tabular-nums">
                            {progress.total ? `${formatCount(progress.processed)} of ${formatCount(progress.total)} rows processed` : 'Checking the rows one last time…'}
                        </p>
                    </div>
                    {connectionLost ? (
                        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                            <p className="font-bold">The connection to the server was lost.</p>
                            <p className="mt-1">The import carries on by itself. Nothing will be imported twice. Check again in a moment, or open it later from “Your recent imports”.</p>
                            <button type="button" onClick={checkAgain} className={`${buttonClass.secondary} mt-3`}>Check again</button>
                        </div>
                    ) : (
                        <p className="text-xs text-slate-500">
                            You can close this window. The import keeps running, and you can open it again from “Your recent imports”.
                        </p>
                    )}
                    <ActionBar note="">
                        <button type="button" onClick={handleClose} className={buttonClass.secondary}>Close and continue in the background</button>
                    </ActionBar>
                </div>
            )}

            {step === 'result' && job && (
                <>
                    <ImportResultStep job={job} run={run} warning={warning} notice={notice} />
                    <ActionBar note="">
                        <input ref={correctionFileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; if (file) uploadCorrections(file); }} />
                        {(needs > 0 || counts.ready > 0) && (
                            <button type="button" onClick={handleClose} disabled={busy} className={buttonClass.quiet}>Done for now</button>
                        )}
                        {needs > 0 && (
                            <>
                                <button type="button" onClick={downloadRowsToFix} disabled={busy} className={buttonClass.secondary}>
                                    <MdDownload size={15} /> Download rows to fix
                                </button>
                                <button type="button" onClick={() => correctionFileRef.current?.click()} disabled={busy} className={buttonClass.secondary}>
                                    <MdUploadFile size={15} /> {busy ? 'Reading…' : 'Upload corrected file'}
                                </button>
                                <button type="button" onClick={() => { setNotice(null); setStep('fix'); }} disabled={busy} className={counts.ready ? buttonClass.secondary : buttonClass.primary}>
                                    <MdFactCheck size={15} /> Review {plural(needs, 'row', 'rows')}
                                </button>
                            </>
                        )}
                        {counts.ready > 0 && (
                            <button type="button" onClick={startImport} disabled={busy} className={buttonClass.primary}>
                                <MdCloudUpload size={15} /> Import {formatCount(counts.ready)} ready {counts.ready === 1 ? 'row' : 'rows'}
                            </button>
                        )}
                        {!needs && !counts.ready && (
                            <button type="button" onClick={handleClose} className={buttonClass.primary}>Done</button>
                        )}
                    </ActionBar>
                </>
            )}

            {step === 'fix' && job && (
                <ImportFixRows
                    job={job}
                    busy={busy}
                    onJobChange={setJob}
                    onBack={() => setStep(job.runCount ? 'result' : 'preview')}
                    onImport={startImport}
                    onDownload={downloadRowsToFix}
                    onUploadCorrections={uploadCorrections}
                />
            )}
        </Modal>
    );
};

export default ImportWizard;
