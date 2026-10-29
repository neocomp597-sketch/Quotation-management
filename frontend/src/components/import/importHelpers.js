// Shared bits of the staged import screens (ImportWizard and its steps).

export const formatCount = (value) => Number(value || 0).toLocaleString('en-IN');

export const plural = (count, one, many) => `${formatCount(count)} ${Number(count) === 1 ? one : many}`;

/** The message and hint the server sent, or a fallback. */
export const apiError = (error, fallback) => {
    const data = error?.response?.data || {};
    if (!error?.response) {
        return { code: 'NETWORK', message: 'The server could not be reached.', hint: 'Check your internet connection and try again.' };
    }
    return { code: data.code || '', message: data.message || fallback, hint: data.hint || '' };
};

export const saveBlob = (data, filename, type = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') => {
    const url = URL.createObjectURL(data instanceof Blob ? data : new Blob([data], { type }));
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};

export const ACCEPTED_FILE = /\.(xlsx|xls|csv)$/i;

export const modeOptions = ({ recordLabel, recordLabelPlural }) => [
    { value: 'upsert', label: 'Add new and update existing', hint: `Rows that match an existing ${recordLabel} update it; the others are added.` },
    { value: 'create', label: `Only add new ${recordLabelPlural}`, hint: `Rows that match an existing ${recordLabel} are left out.` },
    { value: 'update', label: `Only update existing ${recordLabelPlural}`, hint: 'Rows that match nothing are left out.' }
];

export const ROW_STATUS = {
    ready: { label: 'Ready', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    attention: { label: 'Needs attention', className: 'bg-amber-50 text-amber-800 border-amber-200' },
    failed: { label: 'Not saved', className: 'bg-rose-50 text-rose-700 border-rose-200' },
    excluded: { label: 'Skipped by you', className: 'bg-slate-100 text-slate-600 border-slate-200' },
    importing: { label: 'Saving…', className: 'bg-primary-50 text-primary-700 border-primary-200' },
    imported: { label: 'Imported', className: 'bg-primary-50 text-primary-700 border-primary-200' },
    blank: { label: 'Blank', className: 'bg-slate-50 text-slate-400 border-slate-200' }
};

export const rowStatusLabel = (row) => {
    if (row.status === 'ready') return row.action === 'update' ? 'Ready · update' : 'Ready · new';
    if (row.status === 'imported') return row.action === 'update' ? 'Updated' : 'Added';
    if (row.status === 'attention' && row.issues?.some((issue) => issue.code === 'DUPLICATE_IN_FILE')) return 'Duplicate';
    return ROW_STATUS[row.status]?.label || row.status;
};

export const buttonClass = {
    primary: 'inline-flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-primary-600/20 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none',
    secondary: 'inline-flex items-center justify-center gap-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 px-5 py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed',
    quiet: 'inline-flex items-center justify-center gap-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 px-4 py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all disabled:opacity-50'
};

export const fileSize = (bytes = 0) => (bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);
