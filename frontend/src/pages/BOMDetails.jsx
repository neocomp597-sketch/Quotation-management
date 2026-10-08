import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { MdArrowBack, MdEdit, MdFileDownload, MdPictureAsPdf, MdToggleOff, MdToggleOn, MdHistory, MdUploadFile } from 'react-icons/md';
import { toast } from 'react-toastify';
import { bomService } from '../services/api';
import BOMComponentsTable from '../components/bom/BOMComponentsTable';

const Field = ({ label, children }) => (
    <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
        <p className="text-sm font-bold text-slate-800">{children || '-'}</p>
    </div>
);

const formatDateTime = (value) => (value ? new Date(value).toLocaleString('en-IN') : '');
const mgrLabel = (mgr) => (mgr ? (mgr.description || mgr.code || '') : '');
const sameKey = (a, b) => String(a || '').trim().toUpperCase() === String(b || '').trim().toUpperCase();

// A BOM is identified by its Parent Item Code; one tied to a real FG serial also names the serial.
const bomName = (bom) => (bom && !sameKey(bom.fgSerialNumber, bom.fgItemCode)
    ? `parent item ${bom.fgItemCode}, serial ${bom.fgSerialNumber}`
    : `parent item ${bom?.fgItemCode || ''}`);
const fileName = (bom) => String(bom.fgSerialNumber || bom.fgItemCode || bom._id).replace(/[^A-Za-z0-9._-]+/g, '-');

const BOMDetails = () => {
    const navigate = useNavigate();
    const { id } = useParams();
    const [result, setResult] = useState({ id: null, bom: null, error: '' });
    const loading = result.id !== id;
    const { bom, error } = result;

    useEffect(() => {
        let cancelled = false;
        bomService.getById(id)
            .then((res) => { if (!cancelled) setResult({ id, bom: res.data, error: '' }); })
            .catch((err) => {
                if (!cancelled) setResult({ id, bom: null, error: err.response?.data?.message || 'Failed to load BOM' });
            });
        return () => { cancelled = true; };
    }, [id]);

    // The PDF carries the BOM and any sub-BOM underneath it, so it needs the print payload.
    const [printing, setPrinting] = useState(false);
    const handleExportPdf = async () => {
        setPrinting(true);
        try {
            const [{ data }, { buildBOMPdf }] = await Promise.all([
                bomService.getForPrint(bom._id),
                import('../utils/bomPdf'),
            ]);
            const doc = await buildBOMPdf(data);
            doc.save(`BOM_${fileName(bom)}.pdf`);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Could not export the BOM as PDF.');
        } finally {
            setPrinting(false);
        }
    };

    const handleExport = async () => {
        try {
            const res = await bomService.exportToExcel(bom._id);
            const url = URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.download = `BOM_${fileName(bom)}.xlsx`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(url);
        } catch {
            toast.error('Could not export the BOM.');
        }
    };

    // BOMs are never removed from this screen. Switching one off keeps it and its components
    // in the register, stops it being offered on complaints, and records who did it.
    const [saving, setSaving] = useState(false);
    const [confirming, setConfirming] = useState(false);
    const [reason, setReason] = useState('');
    const nextStatus = bom?.status === 'Active' ? 'Inactive' : 'Active';

    const applyStatus = async () => {
        setSaving(true);
        try {
            const res = await bomService.setStatus(bom._id, nextStatus, reason.trim());
            setResult({ id, bom: res.data, error: '' });
            setConfirming(false);
            setReason('');
            toast.success(nextStatus === 'Active' ? 'BOM activated' : 'BOM deactivated');
        } catch (err) {
            toast.error(err.response?.data?.message || 'Could not change the BOM status');
        } finally {
            setSaving(false);
        }
    };

    // Import Components: load component lines for this BOM from a workbook.
    const [importing, setImporting] = useState(false);
    const [importOpen, setImportOpen] = useState(false);
    const [importMode, setImportMode] = useState('replace');
    const [importFile, setImportFile] = useState(null);
    const [importSummary, setImportSummary] = useState(null);

    const closeImport = () => { setImportOpen(false); setImportFile(null); setImportMode('replace'); };

    const handleComponentTemplate = async () => {
        try {
            const res = await bomService.downloadComponentTemplate();
            const url = URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.download = 'bom_components_template.xlsx';
            document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(url);
        } catch {
            toast.error('Could not download the template.');
        }
    };

    const handleImportComponents = async () => {
        if (!importFile) return;
        setImporting(true);
        try {
            const res = await bomService.importComponents(bom._id, importFile, importMode);
            const { bom: updated, ...summary } = res.data || {};
            if (updated) setResult({ id, bom: updated, error: '' });
            setImportSummary(summary);
            closeImport();
            toast.success(`${summary.imported || 0} component(s) imported`);
            if (summary.skippedLines) toast.info(`${summary.skippedLines} line(s) skipped; see the import summary.`);
        } catch (err) {
            const data = err.response?.data;
            toast.error(data?.message || 'Could not import the components.');
            if (data?.warnings?.length) setImportSummary({ fileName: importFile.name, failed: data.message, warnings: data.warnings });
        } finally {
            setImporting(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-4 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                <button
                    type="button"
                    onClick={() => navigate('/bom-master')}
                    className="p-3 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-2xl transition-all border border-slate-200"
                >
                    <MdArrowBack size={20} />
                </button>
                <div>
                    <h1 className="text-xl font-black text-slate-900">BOM Details</h1>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                        {bom ? `Parent Item Code ${bom.fgItemCode}` : 'Bill of materials'}
                    </p>
                </div>
                {bom && (
                    <div className="ml-auto flex gap-3">
                        <button
                            type="button"
                            onClick={handleExport}
                            className="flex items-center gap-2 px-5 py-3 rounded-2xl border border-slate-200 text-slate-600 font-black uppercase text-xs tracking-widest hover:bg-slate-50 transition-all"
                        >
                            <MdFileDownload size={18} /> Export to Excel
                        </button>
                        <button
                            type="button"
                            onClick={handleExportPdf}
                            disabled={printing}
                            className="flex items-center gap-2 px-5 py-3 rounded-2xl border border-slate-200 text-slate-600 font-black uppercase text-xs tracking-widest hover:bg-slate-50 transition-all disabled:opacity-60"
                        >
                            <MdPictureAsPdf size={18} /> {printing ? 'Preparing…' : 'Export to PDF'}
                        </button>
                        <button
                            type="button"
                            onClick={() => setConfirming(true)}
                            disabled={saving}
                            className={`flex items-center gap-2 px-5 py-3 rounded-2xl border font-black uppercase text-xs tracking-widest transition-all disabled:opacity-60 ${bom.status === 'Active'
                                ? 'border-amber-200 text-amber-600 hover:bg-amber-50'
                                : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50'}`}
                        >
                            {bom.status === 'Active' ? <MdToggleOff size={18} /> : <MdToggleOn size={18} />}
                            {bom.status === 'Active' ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                            type="button"
                            onClick={() => navigate(`/bom-master/${bom._id}/edit`)}
                            className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-2xl font-black transition-all shadow-xl shadow-primary-600/20 uppercase text-xs tracking-widest active:scale-95"
                        >
                            <MdEdit size={18} /> Edit
                        </button>
                    </div>
                )}
            </div>

            {confirming && bom && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
                    <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
                        <h2 className="text-lg font-black text-slate-900">
                            {nextStatus === 'Inactive' ? 'Deactivate this BOM?' : 'Activate this BOM?'}
                        </h2>
                        <p className="mt-2 text-sm font-medium text-slate-500">
                            {nextStatus === 'Inactive'
                                ? `The BOM of ${bomName(bom)} stays in the register with its components, but is no longer shown on complaints. You can switch it back on at any time.`
                                : `The BOM of ${bomName(bom)} will be shown on complaints again.`}
                        </p>
                        <label className="mt-5 block text-[10px] font-black uppercase tracking-widest text-slate-400">Reason (optional)</label>
                        <input
                            autoFocus
                            name="statusReason"
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="Kept with the log entry"
                            className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10"
                        />
                        <div className="mt-6 flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => { setConfirming(false); setReason(''); }}
                                className="px-5 py-3 rounded-2xl border border-slate-200 text-slate-600 font-black uppercase text-xs tracking-widest hover:bg-slate-50 transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={applyStatus}
                                disabled={saving}
                                className={`px-6 py-3 rounded-2xl text-white font-black uppercase text-xs tracking-widest transition-all disabled:opacity-60 ${nextStatus === 'Inactive' ? 'bg-amber-500 hover:bg-amber-600' : 'bg-emerald-600 hover:bg-emerald-700'}`}
                            >
                                {saving ? 'Saving…' : nextStatus === 'Inactive' ? 'Deactivate' : 'Activate'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {importOpen && bom && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
                    <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
                        <h2 className="text-lg font-black text-slate-900">Import components</h2>
                        <p className="mt-2 text-sm font-medium text-slate-500">
                            Upload an Excel or CSV file with Item Code, Item Name, UOM and Quantity for parent item {bom.fgItemCode}.
                            Lines for other parent items in the file are skipped.
                        </p>
                        <div className="mt-5 grid grid-cols-2 gap-3">
                            {[
                                ['replace', 'Replace components', 'The file becomes the full component list.'],
                                ['append', 'Add to components', 'File lines are added after the current ones.'],
                            ].map(([value, title, hint]) => (
                                <label
                                    key={value}
                                    className={`cursor-pointer rounded-2xl border p-4 transition-all ${importMode === value ? 'border-primary-500 bg-primary-50/50 ring-4 ring-primary-500/10' : 'border-slate-200 hover:bg-slate-50'}`}
                                >
                                    <input type="radio" name="importMode" value={value} checked={importMode === value} onChange={() => setImportMode(value)} className="sr-only" />
                                    <p className="text-xs font-black uppercase tracking-widest text-slate-700">{title}</p>
                                    <p className="mt-1 text-xs font-medium text-slate-500">{hint}</p>
                                </label>
                            ))}
                        </div>
                        <label className="mt-5 flex cursor-pointer items-center gap-3 rounded-2xl border border-dashed border-slate-300 px-4 py-4 text-sm font-semibold text-slate-600 hover:bg-slate-50">
                            <MdUploadFile size={22} className="text-slate-400" />
                            <span className="truncate">{importFile ? importFile.name : 'Choose .xlsx, .xls or .csv file'}</span>
                            <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => setImportFile(e.target.files?.[0] || null)} />
                        </label>
                        <button
                            type="button"
                            onClick={handleComponentTemplate}
                            className="mt-3 flex items-center gap-1 text-xs font-black uppercase tracking-widest text-primary-600 hover:text-primary-700"
                        >
                            <MdFileDownload size={16} /> Download template
                        </button>
                        <div className="mt-6 flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={closeImport}
                                disabled={importing}
                                className="px-5 py-3 rounded-2xl border border-slate-200 text-slate-600 font-black uppercase text-xs tracking-widest hover:bg-slate-50 transition-all disabled:opacity-60"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleImportComponents}
                                disabled={!importFile || importing}
                                className="px-6 py-3 rounded-2xl bg-primary-600 hover:bg-primary-700 text-white font-black uppercase text-xs tracking-widest transition-all disabled:opacity-60"
                            >
                                {importing ? 'Importing…' : 'Import'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {loading ? (
                <div className="py-20 text-center">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-primary-500 border-t-transparent"></div>
                </div>
            ) : error ? (
                <p className="rounded-3xl bg-white p-8 text-center text-sm font-medium text-rose-500">{error}</p>
            ) : (
                <>
                    <div className="grid grid-cols-2 gap-6 rounded-3xl border border-slate-100 bg-white p-6 shadow-sm md:grid-cols-4">
                        <Field label="Parent Item Code">{bom.fgItemCode}</Field>
                        <Field label="Item Name">{bom.fgItemDescription}</Field>
                        <Field label="Components">{String(bom.items?.length || 0)}</Field>
                        <Field label="Status">
                            <span className={`inline-block rounded-lg px-3 py-1 text-[10px] font-black uppercase tracking-widest ${bom.status === 'Active' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                                {bom.status}
                            </span>
                        </Field>
                        {!sameKey(bom.fgSerialNumber, bom.fgItemCode) && (
                            <Field label="FG Serial Number">{bom.fgSerialNumber}</Field>
                        )}
                        {[1, 2, 3, 4, 5].map((n) => (
                            <Field key={n} label={`MGR${n}`}>{mgrLabel(bom.fgMgr?.[`mgr${n}`])}</Field>
                        ))}
                    </div>

                    <div className="rounded-3xl border border-slate-100 bg-white shadow-sm">
                        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-6 py-4">
                            <h2 className="text-xs font-black uppercase tracking-widest text-slate-500">BOM Components</h2>
                            <button
                                type="button"
                                onClick={() => setImportOpen(true)}
                                className="ml-auto flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-black uppercase text-[10px] tracking-widest hover:bg-slate-50 transition-all"
                            >
                                <MdUploadFile size={16} /> Import Components
                            </button>
                        </div>
                        {importSummary && (
                            <div className="border-b border-slate-100 bg-slate-50/60 px-6 py-4">
                                <div className="flex items-start justify-between gap-4">
                                    <p className="text-sm font-semibold text-slate-600">
                                        {importSummary.fileName ? `${importSummary.fileName} — ` : ''}
                                        {importSummary.failed
                                            ? importSummary.failed
                                            : `${importSummary.imported || 0} component(s) ${importSummary.mode === 'append' ? 'added' : 'imported'}, ${importSummary.components || 0} in BOM`}
                                        {importSummary.skippedLines ? `, ${importSummary.skippedLines} line(s) skipped` : ''}
                                    </p>
                                    <button type="button" onClick={() => setImportSummary(null)} className="text-xs font-black uppercase tracking-widest text-slate-400 hover:text-slate-700">Close</button>
                                </div>
                                {importSummary.warnings?.length > 0 && (
                                    <ul className="mt-2 max-h-40 space-y-1 overflow-auto text-xs font-semibold text-amber-600">
                                        {importSummary.warnings.map((warning, index) => (
                                            <li key={index}>{warning.row ? `Row ${warning.row}: ` : ''}{warning.message}</li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        )}
                        <BOMComponentsTable items={bom.items || []} />
                    </div>

                    {bom.statusHistory?.length > 0 && (
                        <div className="rounded-3xl border border-slate-100 bg-white shadow-sm">
                            <div className="flex items-center gap-2 border-b border-slate-100 px-6 py-4">
                                <MdHistory className="text-slate-400" size={16} />
                                <h2 className="text-xs font-black uppercase tracking-widest text-slate-500">Status Log</h2>
                            </div>
                            <ul className="divide-y divide-slate-50">
                                {[...bom.statusHistory].reverse().map((entry, index) => (
                                    <li key={index} className="flex flex-wrap items-center gap-3 px-6 py-3 text-sm">
                                        <span className={`rounded-lg px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${entry.status === 'Active' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                                            {entry.status}
                                        </span>
                                        <span className="font-bold text-slate-700">{entry.changedByName || 'Unknown user'}</span>
                                        <span className="text-slate-500">{formatDateTime(entry.changedAt)}</span>
                                        {entry.reason && <span className="text-slate-500">— {entry.reason}</span>}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default BOMDetails;
