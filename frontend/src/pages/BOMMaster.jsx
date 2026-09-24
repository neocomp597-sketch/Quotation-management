import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MdCloudUpload, MdDownload, MdSearch, MdVisibility } from 'react-icons/md';
import { toast } from 'react-toastify';
import * as XLSX from 'xlsx';
import { bomService } from '../services/api';
import Modal from '../components/Modal';
import PaginationControls from '../components/PaginationControls';

const LIST_PAGE_SIZE = 20;

const saveBlob = (blob, filename) => {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
};

// Error rows keep the uploaded values in template column order, so the file can be fixed and re-uploaded.
const downloadErrorWorkbook = (errors) => {
    const rows = errors.map((e) => ({
        'Item code_FG': e.fgItemCode,
        'FG Serial number': e.fgSerialNumber,
        'Item code': e.itemCode,
        'Item description': e.itemDescription,
        Qty: e.qty,
        'Component serial number': e.componentSerialNumber,
        'Batch number': e.batchNumber,
        'Source row': e.row,
        Error: e.error
    }));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), 'Errors');
    XLSX.writeFile(workbook, 'bom_import_errors.xlsx');
};

const SummaryStat = ({ label, value, tone = 'text-slate-800' }) => (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
        <p className={`text-2xl font-black ${tone}`}>{value}</p>
    </div>
);

const BOMUploadModal = ({ isOpen, onClose, onImported }) => {
    const fileInput = useRef(null);
    const [file, setFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [result, setResult] = useState(null);

    const reset = () => {
        setFile(null);
        setResult(null);
        setProgress(0);
        if (fileInput.current) fileInput.current.value = '';
    };

    const handleClose = () => {
        if (uploading) return;
        reset();
        onClose();
    };

    const handleTemplate = async () => {
        try {
            const res = await bomService.getTemplate();
            saveBlob(new Blob([res.data]), 'bom_import_template.xlsx');
        } catch {
            toast.error('Could not download the template');
        }
    };

    const handleUpload = async () => {
        if (!file) return;
        setUploading(true);
        setProgress(0);
        try {
            const res = await bomService.upload(file, (event) => {
                if (event.total) setProgress(Math.round((event.loaded / event.total) * 100));
            });
            setResult(res.data);
            onImported();
        } catch (err) {
            const data = err.response?.data;
            if (data?.summary) {
                setResult(data);
            } else {
                toast.error(data?.message || 'BOM upload failed');
            }
        } finally {
            setUploading(false);
        }
    };

    const summary = result?.summary;
    const errors = result?.errors || [];

    return (
        <Modal isOpen={isOpen} onClose={handleClose} title={result ? 'BOM Import Result' : 'Upload BOM'} maxWidth="max-w-4xl">
            {!result ? (
                <div className="space-y-5">
                    <p className="text-sm text-slate-500">
                        One BOM is kept per FG serial number. Uploading a serial that already has a BOM replaces its components.
                        If any row for a serial has an error, none of that serial's rows are imported.
                    </p>
                    <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-slate-200 bg-slate-50 p-10 text-center hover:border-primary-400">
                        <MdCloudUpload size={36} className="text-primary-500" />
                        <span className="text-sm font-bold text-slate-700">{file ? file.name : 'Choose an Excel file (.xlsx, .xls, .csv)'}</span>
                        <input
                            ref={fileInput}
                            type="file"
                            accept=".xlsx,.xls,.csv"
                            className="hidden"
                            onChange={(e) => setFile(e.target.files?.[0] || null)}
                        />
                    </label>
                    {uploading && (
                        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                            <div className="h-full bg-primary-500 transition-all" style={{ width: `${progress}%` }} />
                        </div>
                    )}
                    <div className="flex flex-wrap justify-between gap-3">
                        <button
                            type="button"
                            onClick={handleTemplate}
                            className="flex items-center gap-2 rounded-2xl border border-slate-200 px-5 py-3 text-xs font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50"
                        >
                            <MdDownload size={18} /> Template
                        </button>
                        <button
                            type="button"
                            disabled={!file || uploading}
                            onClick={handleUpload}
                            className="rounded-2xl bg-primary-600 px-8 py-3 text-xs font-black uppercase tracking-widest text-white shadow-xl shadow-primary-600/20 hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {uploading ? (progress < 100 ? `Uploading ${progress}%` : 'Processing...') : 'Upload'}
                        </button>
                    </div>
                </div>
            ) : (
                <div className="space-y-5">
                    <p className="text-sm font-bold text-slate-700">{result.message}</p>
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                        <SummaryStat label="Total Rows" value={summary.totalRows} />
                        <SummaryStat label="Successful Rows" value={summary.successRows} tone="text-emerald-600" />
                        <SummaryStat label="Failed Rows" value={summary.failedRows} tone={summary.failedRows ? 'text-rose-600' : 'text-slate-800'} />
                        <SummaryStat label="FG Serial Numbers" value={summary.fgSerialCount} />
                        <SummaryStat label="New BOMs" value={summary.bomsCreated} />
                        <SummaryStat label="Replaced BOMs" value={summary.bomsReplaced} />
                        <SummaryStat label="BOM Items Created" value={summary.itemsCreated} />
                        <SummaryStat label="Items Not In Master" value={summary.itemsNotInProductMaster} tone={summary.itemsNotInProductMaster ? 'text-amber-600' : 'text-slate-800'} />
                    </div>

                    {result.unmatchedItemCodes?.length > 0 && (
                        <p className="rounded-2xl bg-amber-50 px-4 py-3 text-xs font-medium text-amber-700">
                            These item codes are not in Product Master, so their uploaded description was used and MGR1-MGR5 are blank:{' '}
                            <span className="font-bold">{result.unmatchedItemCodes.join(', ')}</span>
                        </p>
                    )}

                    {errors.length > 0 && (
                        <div className="rounded-2xl border border-slate-100">
                            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                                <p className="text-xs font-black uppercase tracking-widest text-slate-500">Errors ({errors.length})</p>
                                <button
                                    type="button"
                                    onClick={() => downloadErrorWorkbook(errors)}
                                    className="flex items-center gap-2 rounded-xl bg-rose-50 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-rose-600 hover:bg-rose-100"
                                >
                                    <MdDownload size={16} /> Download Error Excel
                                </button>
                            </div>
                            <div className="max-h-72 overflow-auto">
                                <table className="w-full text-left text-sm">
                                    <thead className="sticky top-0 bg-slate-50">
                                        <tr>
                                            {['Row', 'FG Serial', 'Item Code', 'Error'].map((label) => (
                                                <th key={label} className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {errors.map((e) => (
                                            <tr key={e.row} className="border-b border-slate-50 last:border-0">
                                                <td className="px-4 py-2 font-bold text-slate-500">{e.row}</td>
                                                <td className="px-4 py-2 text-slate-700">{e.fgSerialNumber || '-'}</td>
                                                <td className="px-4 py-2 text-slate-700">{e.itemCode || '-'}</td>
                                                <td className="px-4 py-2 text-rose-600">{e.error}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    <div className="flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={reset}
                            className="rounded-2xl border border-slate-200 px-6 py-3 text-xs font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50"
                        >
                            Upload Another
                        </button>
                        <button
                            type="button"
                            onClick={handleClose}
                            className="rounded-2xl bg-primary-600 px-8 py-3 text-xs font-black uppercase tracking-widest text-white hover:bg-primary-700"
                        >
                            Done
                        </button>
                    </div>
                </div>
            )}
        </Modal>
    );
};

const BOMMaster = () => {
    const navigate = useNavigate();
    const [boms, setBoms] = useState([]);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [pagination, setPagination] = useState({ page: 1, limit: LIST_PAGE_SIZE, total: 0, pages: 1 });
    const [isUploadOpen, setIsUploadOpen] = useState(false);
    const [reloadKey, setReloadKey] = useState(0);

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(search.trim());
            setPage(1);
        }, 300);
        return () => clearTimeout(timer);
    }, [search]);

    // The list is loading whenever the rows on screen belong to a different request.
    const requestKey = `${page}|${debouncedSearch}|${reloadKey}`;
    const [loadedKey, setLoadedKey] = useState(null);
    const loading = loadedKey !== requestKey;

    useEffect(() => {
        let cancelled = false;
        bomService.getAll({ page, limit: LIST_PAGE_SIZE, search: debouncedSearch || undefined })
            .then((res) => {
                if (cancelled) return;
                setBoms(res.data?.data || []);
                setPagination(res.data?.pagination || { page: 1, limit: LIST_PAGE_SIZE, total: 0, pages: 1 });
            })
            .catch((err) => {
                if (!cancelled) toast.error(err.response?.data?.message || 'Failed to load BOMs');
            })
            .finally(() => {
                if (!cancelled) setLoadedKey(requestKey);
            });
        return () => { cancelled = true; };
    }, [page, debouncedSearch, reloadKey, requestKey]);

    const offset = (pagination.page - 1) * pagination.limit;

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">BOM Master</h1>
                    <p className="text-slate-500 font-medium">Bill of materials for each finished-good serial number.</p>
                </div>
                <button
                    onClick={() => setIsUploadOpen(true)}
                    className="flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-2xl font-bold transition-all shadow-xl shadow-primary-600/20 uppercase text-xs tracking-widest active:scale-95"
                >
                    <MdCloudUpload size={20} />
                    <span>Upload BOM</span>
                </button>
            </div>

            <div className="mobile-master-shell bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
                <div className="mobile-master-toolbar p-4 border-b border-slate-100 bg-slate-50">
                    <div className="relative max-w-md">
                        <MdSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search FG serial number or item code"
                            className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 outline-none text-sm font-medium"
                        />
                    </div>
                </div>

                <div className="p-6">
                    {loading ? (
                        <div className="py-20 text-center text-slate-400 font-medium">
                            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-primary-500 border-t-transparent mb-4"></div>
                            <p className="text-xs uppercase font-black tracking-widest">Loading...</p>
                        </div>
                    ) : (
                        <>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50">
                                            {['Sr No', 'FG Item Code', 'FG Serial Number', 'Components', 'Status', 'Last Uploaded'].map((label) => (
                                                <th key={label} className="p-4 text-xs font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">{label}</th>
                                            ))}
                                            <th className="p-4 text-xs font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {boms.map((bom, index) => (
                                            <tr
                                                key={bom._id}
                                                onClick={() => navigate(`/bom-master/${bom._id}`)}
                                                className="cursor-pointer border-b last:border-0 border-slate-50 hover:bg-slate-50/50 transition-colors"
                                            >
                                                <td className="p-4 text-sm font-bold text-slate-400">{offset + index + 1}</td>
                                                <td className="p-4 text-sm">
                                                    <span className="font-bold text-slate-800">{bom.fgItemCode}</span>
                                                    {bom.fgItemDescription && <span className="block text-xs text-slate-500">{bom.fgItemDescription}</span>}
                                                </td>
                                                <td className="p-4 text-sm font-bold text-slate-700">{bom.fgSerialNumber}</td>
                                                <td className="p-4 text-sm font-bold text-slate-700">{bom.componentCount}</td>
                                                <td className="p-4">
                                                    <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${bom.status === 'Active' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                                                        {bom.status}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-sm text-slate-500 whitespace-nowrap">
                                                    {bom.updatedAt ? new Date(bom.updatedAt).toLocaleDateString('en-IN') : '-'}
                                                </td>
                                                <td className="p-4 text-right">
                                                    <button
                                                        type="button"
                                                        onClick={(e) => { e.stopPropagation(); navigate(`/bom-master/${bom._id}`); }}
                                                        className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg transition-all"
                                                        title="View"
                                                    >
                                                        <MdVisibility size={18} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                        {boms.length === 0 && (
                                            <tr>
                                                <td colSpan={7} className="p-8 text-center text-slate-400 text-sm font-medium">
                                                    {debouncedSearch ? 'No BOMs match your search.' : 'No BOMs uploaded yet. Use Upload BOM to import one.'}
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                            <PaginationControls pagination={pagination} onPageChange={setPage} />
                        </>
                    )}
                </div>
            </div>

            <BOMUploadModal
                isOpen={isUploadOpen}
                onClose={() => setIsUploadOpen(false)}
                onImported={() => setReloadKey((key) => key + 1)}
            />
        </div>
    );
};

export default BOMMaster;
