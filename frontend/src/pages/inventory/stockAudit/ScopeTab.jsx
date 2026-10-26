import React, { useEffect, useRef, useState } from 'react';
import { MdCloudUpload, MdDownload, MdAdd, MdDelete, MdInfoOutline, MdCheckCircle } from 'react-icons/md';
import { toast } from 'react-toastify';
import { stockAuditService } from '../../../services/api';
import { PANEL, H2, INPUT, LABEL, NOTICE, PRIMARY, SECONDARY, SMALL, TH, TD, TDN, TDR, fmtQty, fmtMoney, errorMessage, downloadTemplate, readScopeWorkbook } from './shared';
import { Badge } from './ui';

const FIELD_LABELS = {
    itemCode: 'Item code', itemName: 'Item name', itemGroup: 'Item group', uom: 'UoM', warehouseCode: 'Warehouse',
    warehouseName: 'Warehouse name', binLocation: 'Bin', batchNumber: 'Batch / serial', sapQty: 'SAP qty', unitPrice: 'Unit price', sapValue: 'Stock value'
};
const MODES = [
    { key: 'append', label: 'Add new lines', hint: 'Lines already in the batch are skipped.' },
    { key: 'update', label: 'Add new + refresh SAP qty', hint: 'Also updates SAP quantity / price on lines not counted yet.' },
    { key: 'replace', label: 'Replace all lines', hint: 'Removes the current lines first. Only while nothing is counted.' }
];
const emptyLine = { itemCode: '', itemName: '', uom: '', warehouseCode: '', binLocation: '', batchNumber: '', sapQty: '', unitPrice: '' };

// Import of SAP B1 stock (Excel export or our template) with a server-side preview,
// manual lines, and removal of lines that are not counted yet. Owner only.
const ScopeImport = ({ batch, onImported }) => {
    const [file, setFile] = useState(null);
    const [rows, setRows] = useState(null);
    const [mode, setMode] = useState('append');
    const [preview, setPreview] = useState(null);
    const [busy, setBusy] = useState(false);
    const [result, setResult] = useState(null);
    const fileInput = useRef(null);

    const runPreview = async (parsedRows, nextMode) => {
        setBusy(true);
        setPreview(null);
        try {
            const res = await stockAuditService.importItems(batch._id, { rows: parsedRows, mode: nextMode, dryRun: true });
            setPreview(res.data);
        } catch (error) {
            setPreview({ failed: true, message: errorMessage(error, 'The file could not be read.'), errors: error.response?.data?.errors || [], columns: error.response?.data?.columns || [] });
        } finally {
            setBusy(false);
        }
    };

    const pick = async (e) => {
        const chosen = e.target.files?.[0];
        e.target.value = '';
        if (!chosen) return;
        setResult(null);
        try {
            const parsed = await readScopeWorkbook(chosen);
            if (!parsed.rows.length) throw new Error('The sheet has a header but no rows.');
            setFile(chosen);
            setRows(parsed.rows);
            runPreview(parsed.rows, mode);
        } catch (error) {
            setFile(null);
            setRows(null);
            setPreview(null);
            toast.error(error.message || 'Could not read the file');
        }
    };

    const changeMode = (next) => {
        setMode(next);
        if (rows) runPreview(rows, next);
    };

    const doImport = async () => {
        if (mode === 'replace' && !window.confirm(`Remove the ${preview?.replaces || 0} current lines and import ${preview?.added || 0} lines from ${file?.name}?`)) return;
        setBusy(true);
        try {
            const res = await stockAuditService.importItems(batch._id, { rows, mode, fileName: file?.name });
            setResult(res.data);
            setRows(null);
            setFile(null);
            setPreview(null);
            toast.success(`${res.data.added} lines added${res.data.updated ? `, ${res.data.updated} updated` : ''}`);
            onImported?.();
        } catch (error) {
            toast.error(errorMessage(error, 'Import failed'));
        } finally {
            setBusy(false);
        }
    };

    const reset = () => { setRows(null); setFile(null); setPreview(null); };
    const report = preview || result;

    return (
        <div className={PANEL}>
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-3">
                <div>
                    <h2 className={H2}>Import SAP B1 stock</h2>
                    <p className="text-xs font-semibold text-slate-500 mt-1 max-w-2xl">
                        Export the stock from SAP Business One (Inventory Status / Inventory in Warehouse report, or a query on OITW / OIBQ) to Excel and upload it as is.
                        Recognised columns include ItemCode, ItemName, WhsCode, BinCode, DistNumber / Batch, OnHand / In Stock and AvgPrice / Item Cost.
                    </p>
                </div>
                <button type="button" onClick={downloadTemplate} className={`${SECONDARY} flex-shrink-0`}><MdDownload size={18} /> Template</button>
            </div>

            <div className="flex flex-col md:flex-row gap-3 md:items-end">
                <div className="flex-1">
                    <span className={LABEL}>Import mode</span>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {MODES.map(m => (
                            <label key={m.key} className={`cursor-pointer rounded-xl border p-2.5 text-xs ${mode === m.key ? 'border-teal-500 bg-teal-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
                                <input type="radio" name="scope-mode" value={m.key} checked={mode === m.key} onChange={() => changeMode(m.key)} className="sr-only" />
                                <span className="block font-black text-slate-800">{m.label}</span>
                                <span className="block font-semibold text-slate-500">{m.hint}</span>
                            </label>
                        ))}
                    </div>
                </div>
                <div className="flex gap-2">
                    <input ref={fileInput} type="file" accept=".xlsx,.xls,.csv" onChange={pick} className="hidden" />
                    <button type="button" onClick={() => fileInput.current?.click()} disabled={busy} className={PRIMARY}>
                        <MdCloudUpload size={18} /> {file ? 'Choose another file' : 'Choose Excel file'}
                    </button>
                </div>
            </div>

            {busy && <p className="mt-3 text-sm font-semibold text-slate-500">Working…</p>}

            {report && !busy && (
                <div className="mt-4 space-y-3">
                    {preview && file && <div className="text-sm font-bold text-slate-700">Preview of <span className="font-mono">{file.name}</span> ({rows?.length} rows)</div>}
                    {result && <div className="text-sm font-bold text-emerald-700 inline-flex items-center gap-1"><MdCheckCircle /> Import finished</div>}
                    {report.failed ? (
                        <div className="p-3 rounded-xl bg-rose-50 border border-rose-100 text-sm font-semibold text-rose-700">{report.message}</div>
                    ) : (
                        <div className="flex flex-wrap gap-2">
                            <Badge tone="green">{report.added} to add</Badge>
                            {report.updated > 0 && <Badge tone="sky">{report.updated} to update</Badge>}
                            {report.skipped > 0 && <Badge tone="slate">{report.skipped} skipped</Badge>}
                            {report.rejected > 0 && <Badge tone="red">{report.rejected} rejected</Badge>}
                            {report.replaces > 0 && <Badge tone="amber">{report.replaces} current lines removed</Badge>}
                        </div>
                    )}
                    {report.columns?.length > 0 && (
                        <div className="text-xs font-semibold text-slate-500">
                            Columns recognised: {report.columns.map(c => FIELD_LABELS[c] || c).join(', ')}
                            {!report.columns.includes('unitPrice') && !report.columns.includes('sapValue') && (
                                <span className="text-amber-700"> · no price or value column, so mismatches will show quantities only</span>
                            )}
                        </div>
                    )}
                    {preview?.sample?.length > 0 && (
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[720px] border-collapse">
                                <thead><tr>
                                    <th className={TH}>Row</th><th className={TH}>Item</th><th className={TH}>Warehouse</th><th className={TH}>Bin</th>
                                    <th className={TH}>Batch</th><th className={`${TH} text-right`}>SAP qty</th><th className={`${TH} text-right`}>Price</th><th className={`${TH} text-right`}>Value</th>
                                </tr></thead>
                                <tbody>
                                    {preview.sample.map(l => (
                                        <tr key={l.row}>
                                            <td className={TDN}>{l.row}</td>
                                            <td className={TD}><b className="font-mono">{l.itemCode}</b><div className="text-xs text-slate-500">{l.itemName}</div></td>
                                            <td className={TDN}>{l.warehouseCode || '—'}</td><td className={TDN}>{l.binLocation || '—'}</td><td className={TDN}>{l.batchNumber || '—'}</td>
                                            <td className={TDR}>{fmtQty(l.sapQty)} {l.uom}</td><td className={TDR}>{fmtMoney(l.unitPrice)}</td><td className={TDR}>{fmtMoney(l.sapValue)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                    {report.errors?.length > 0 && (
                        <details className="rounded-xl border border-slate-200" open={report.rejected > 0 && report.errors.length <= 20}>
                            <summary className="cursor-pointer px-3 py-2 text-xs font-bold text-slate-600">Row messages ({report.errors.length}{report.errors.length >= 500 ? '+' : ''})</summary>
                            <ul className="max-h-56 overflow-y-auto px-3 pb-2 text-xs space-y-0.5">
                                {report.errors.map((e, i) => (
                                    <li key={i} className={e.skipped ? 'text-slate-500' : 'text-rose-700'}>Row {e.row}: {e.message}</li>
                                ))}
                            </ul>
                        </details>
                    )}
                    {preview && !report.failed && rows && (
                        <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
                            <button type="button" onClick={reset} className={SECONDARY}>Cancel</button>
                            <button type="button" onClick={doImport} disabled={busy || (!report.added && !report.updated)} className={PRIMARY}>
                                Import {report.added + (report.updated || 0)} lines
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

const AddLine = ({ batch, onAdded }) => {
    const [form, setForm] = useState(emptyLine);
    const [saving, setSaving] = useState(false);
    const set = (field) => (e) => setForm(prev => ({ ...prev, [field]: e.target.value }));

    const save = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            await stockAuditService.addItem(batch._id, form);
            toast.success(`${form.itemCode} added`);
            setForm(emptyLine);
            onAdded?.();
        } catch (error) {
            toast.error(errorMessage(error, 'Failed to add the line'));
        } finally {
            setSaving(false);
        }
    };

    return (
        <form onSubmit={save} className={PANEL}>
            <h2 className={`${H2} mb-3`}>Add a line manually</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-2">
                <input required value={form.itemCode} onChange={set('itemCode')} placeholder="Item code *" className={`${INPUT} col-span-2 md:col-span-1`} aria-label="Item code" />
                <input value={form.itemName} onChange={set('itemName')} placeholder="Item name" className={`${INPUT} col-span-2`} aria-label="Item name" />
                <input value={form.uom} onChange={set('uom')} placeholder="UoM" className={INPUT} aria-label="UoM" />
                <input value={form.warehouseCode} onChange={set('warehouseCode')} placeholder="Warehouse" className={INPUT} aria-label="Warehouse" />
                <input value={form.binLocation} onChange={set('binLocation')} placeholder="Bin" className={INPUT} aria-label="Bin" />
                <input required inputMode="decimal" value={form.sapQty} onChange={set('sapQty')} placeholder="SAP qty *" className={INPUT} aria-label="SAP quantity" />
                <input inputMode="decimal" value={form.unitPrice} onChange={set('unitPrice')} placeholder="Unit price" className={INPUT} aria-label="Unit price" />
            </div>
            <div className="mt-2 flex flex-col sm:flex-row gap-2 sm:items-center">
                <input value={form.batchNumber} onChange={set('batchNumber')} placeholder="Batch / serial (optional)" className={`${INPUT} sm:w-64`} aria-label="Batch or serial" />
                <button type="submit" disabled={saving} className={`${PRIMARY} sm:ml-auto`}><MdAdd size={18} /> {saving ? 'Adding…' : 'Add line'}</button>
            </div>
        </form>
    );
};

const ScopeLines = ({ batch, refreshKey, onRemoved }) => {
    const [page, setPage] = useState(1);
    const [data, setData] = useState({ items: [], total: 0, pages: 1 });
    const [removing, setRemoving] = useState(null);
    const editable = batch.access?.canEditScope;

    useEffect(() => {
        let cancelled = false;
        stockAuditService.getItems(batch._id, { sort: 'line', page, limit: 50 })
            .then(res => { if (!cancelled) setData(res.data); })
            .catch(() => {});
        return () => { cancelled = true; };
    }, [batch._id, page, refreshKey]);

    const remove = async (line) => {
        if (!window.confirm(`Remove ${line.itemCode} (line ${line.lineNo}) from this batch?`)) return;
        setRemoving(line._id);
        try {
            await stockAuditService.deleteItem(batch._id, line._id);
            setData(prev => ({ ...prev, items: prev.items.filter(i => i._id !== line._id), total: prev.total - 1 }));
            onRemoved?.();
        } catch (error) {
            toast.error(errorMessage(error, 'Failed to remove the line'));
        } finally {
            setRemoving(null);
        }
    };

    return (
        <div className={PANEL}>
            <h2 className={`${H2} mb-3`}>Lines in scope ({data.total})</h2>
            {!data.items.length ? <p className="text-sm text-slate-400">No lines yet.</p> : (
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[760px] border-collapse">
                        <thead><tr>
                            <th className={TH}>#</th><th className={TH}>Item</th><th className={TH}>Warehouse</th><th className={TH}>Bin</th><th className={TH}>Batch</th>
                            <th className={`${TH} text-right`}>SAP qty</th><th className={`${TH} text-right`}>Unit price</th><th className={`${TH} text-right`}>SAP value</th><th className={TH}>Result</th>{editable && <th className={TH} />}
                        </tr></thead>
                        <tbody>
                            {data.items.map(l => (
                                <tr key={l._id}>
                                    <td className={TDN}>{l.lineNo}</td>
                                    <td className={TD}><b className="font-mono">{l.itemCode}</b><div className="text-xs text-slate-500">{l.itemName}</div></td>
                                    <td className={TDN}>{l.warehouseCode || '—'}</td><td className={TDN}>{l.binLocation || '—'}</td><td className={TDN}>{l.batchNumber || '—'}</td>
                                    <td className={TDR}>{fmtQty(l.sapQty)} {l.uom}</td><td className={TDR}>{fmtMoney(l.unitPrice)}</td><td className={TDR}>{fmtMoney(l.sapValue)}</td>
                                    <td className={TDN}><Badge value={l.result} /></td>
                                    {editable && (
                                        <td className={TDN}>
                                            {l.result === 'Pending' && (
                                                <button type="button" onClick={() => remove(l)} disabled={removing === l._id} className={`${SMALL} hover:!bg-rose-50 hover:!text-rose-700 hover:!border-rose-200`} aria-label={`Remove ${l.itemCode}`}>
                                                    <MdDelete size={14} />
                                                </button>
                                            )}
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            {data.pages > 1 && (
                <div className="flex items-center justify-center gap-3 pt-3">
                    <button type="button" className={SMALL} disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</button>
                    <span className="text-xs font-bold text-slate-500">Page {page} of {data.pages}</span>
                    <button type="button" className={SMALL} disabled={page >= data.pages} onClick={() => setPage(p => p + 1)}>Next</button>
                </div>
            )}
        </div>
    );
};

const ScopeTab = ({ batch, onChanged }) => {
    const [refreshKey, setRefreshKey] = useState(0);
    const changed = () => {
        setRefreshKey(k => k + 1);
        onChanged?.();
    };
    const editable = batch.access?.canEditScope;

    return (
        <div className="space-y-4">
            {!editable && (
                <div className={NOTICE}>
                    <MdInfoOutline size={18} className="flex-shrink-0 mt-0.5" />
                    <span>{batch.access?.role !== 'owner' ? 'Only the batch owner can change the scope.' : `The scope is fixed while the batch is ${batch.status}.`}</span>
                </div>
            )}
            {editable && <ScopeImport batch={batch} onImported={changed} />}
            {editable && <AddLine batch={batch} onAdded={changed} />}
            <ScopeLines batch={batch} refreshKey={refreshKey} onRemoved={changed} />
        </div>
    );
};

export default ScopeTab;
