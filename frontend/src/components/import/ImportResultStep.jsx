import React from 'react';
import { MdCheckCircle, MdWarning, MdInfoOutline, MdErrorOutline } from 'react-icons/md';
import { formatCount, plural } from './importHelpers';

/* -----------------------------------------------------------------------
 * Step 5: what happened. Never green when nothing was imported, never
 * "failed" when most of the file is safely in.
 * --------------------------------------------------------------------- */

const Stat = ({ label, value, tone }) => {
    const tones = {
        ready: 'text-emerald-700',
        attention: 'text-amber-700',
        muted: 'text-slate-700'
    };
    return (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 text-center">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{label}</p>
            <p className={`text-3xl font-black mt-1 tabular-nums ${tones[tone]}`}>{formatCount(value)}</p>
        </div>
    );
};

const ImportResultStep = ({ job, run, warning, notice }) => {
    const counts = job.counts || {};
    const { recordLabel, recordLabelPlural } = job.module;
    const imported = counts.imported || 0;
    const needs = (counts.attention || 0) + (counts.failed || 0);
    const skipped = counts.excluded || 0;
    const total = counts.total || 0;
    const percent = total ? Math.round((imported / total) * 100) : 0;
    const outcome = imported === 0 ? 'none' : needs === 0 ? 'all' : 'partial';

    const headline = {
        all: 'Your import is complete',
        partial: 'Your import is complete',
        none: `No ${recordLabelPlural} were imported yet`
    }[outcome];
    const summary = {
        all: skipped
            ? `${plural(imported, recordLabel, recordLabelPlural)} imported successfully. The ${plural(skipped, 'row', 'rows')} you chose to skip ${skipped === 1 ? 'was' : 'were'} left out.`
            : imported === 1
                ? `The ${recordLabel} was imported successfully.`
                : `All ${plural(imported, recordLabel, recordLabelPlural)} were imported successfully.`,
        partial: `${plural(imported, recordLabel, recordLabelPlural)} imported. ${plural(needs, 'row needs', 'rows need')} your attention.`,
        none: 'Review the highlighted rows and try again.'
    }[outcome];

    return (
        <div className="space-y-5">
            <div className={`rounded-2xl border p-5 flex items-start gap-4 ${outcome === 'all' ? 'bg-emerald-50 border-emerald-200' : outcome === 'partial' ? 'bg-amber-50/70 border-amber-200' : 'bg-slate-50 border-slate-200'}`}>
                {outcome === 'all' && <MdCheckCircle className="text-emerald-600 shrink-0" size={30} />}
                {outcome === 'partial' && <MdCheckCircle className="text-amber-600 shrink-0" size={30} />}
                {outcome === 'none' && <MdInfoOutline className="text-slate-500 shrink-0" size={30} />}
                <div>
                    <h4 className="text-xl font-black text-slate-900 tracking-tight">{headline}</h4>
                    <p className="text-sm text-slate-600 mt-1">{summary}</p>
                    {run && run.attempted > 0 && (
                        <p className="text-xs text-slate-500 mt-2">
                            This time: {formatCount(run.created)} added, {formatCount(run.updated)} updated
                            {run.failed ? `, ${formatCount(run.failed)} not saved` : ''}.
                        </p>
                    )}
                </div>
            </div>

            {warning && (
                <p className="flex items-start gap-2 text-sm font-semibold text-rose-800 bg-rose-50 border border-rose-200 rounded-2xl px-4 py-3">
                    <MdErrorOutline className="mt-0.5 shrink-0" size={18} /> {warning}
                </p>
            )}
            {run?.held > 0 && (
                <p className="flex items-start gap-2 text-xs text-amber-900 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
                    <MdWarning className="mt-0.5 shrink-0" size={15} />
                    {plural(run.held, 'row', 'rows')} changed since the preview (for example, the same {recordLabel} was added in the meantime) and now {run.held === 1 ? 'needs' : 'need'} attention instead.
                </p>
            )}
            {notice && (
                <p className="flex items-start gap-2 text-xs font-semibold text-primary-800 bg-primary-50 border border-primary-100 rounded-xl px-3 py-2">
                    <MdInfoOutline className="mt-0.5 shrink-0" size={15} /> {notice}
                </p>
            )}

            <div className={`grid gap-3 ${skipped ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3'}`}>
                <Stat label="Imported" value={imported} tone="ready" />
                <Stat label="Need attention" value={needs} tone={needs ? 'attention' : 'muted'} />
                {skipped > 0 && <Stat label="Skipped by you" value={skipped} tone="muted" />}
                <Stat label="Total rows" value={total} tone="muted" />
            </div>

            <div>
                <div className="flex items-center justify-between text-xs font-bold text-slate-600 mb-1.5">
                    <span>Imported</span>
                    <span className="tabular-nums">{percent}%</span>
                </div>
                <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
                    <div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-600 transition-all duration-500" style={{ width: `${percent}%` }} />
                </div>
            </div>

            {needs > 0 && (
                <div className="rounded-2xl border border-amber-200 bg-white p-4">
                    <p className="font-bold text-slate-900">{plural(needs, 'row needs', 'rows need')} a little attention</p>
                    <p className="text-sm text-slate-600 mt-1">
                        Some information is missing or not in the right format.
                        {imported > 0 && ` Your ${plural(imported, `imported ${recordLabel}`, `imported ${recordLabelPlural}`)} ${imported === 1 ? 'is' : 'are'} safe and will not be imported twice.`}
                    </p>
                    <p className="text-xs text-slate-500 mt-2">
                        Fix the rows here, or download them, correct them in Excel and upload that file. Only those rows are checked and imported again.
                    </p>
                </div>
            )}
        </div>
    );
};

export default ImportResultStep;
