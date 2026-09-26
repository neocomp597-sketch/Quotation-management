import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { MdAdd, MdArrowBack, MdDelete } from 'react-icons/md';
import { toast } from 'react-toastify';
import { bomService } from '../services/api';
import MaterialSearchInput from '../components/bom/MaterialSearchInput';
import SerialSearchInput from '../components/bom/SerialSearchInput';

const MGR_KEYS = ['mgr1', 'mgr2', 'mgr3', 'mgr4', 'mgr5'];
const inputClass = 'w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 outline-none text-sm font-medium transition-all disabled:text-slate-500';
const cellClass = 'w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none text-sm';
const labelClass = 'text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1';

let rowSeq = 0;
const emptyRow = () => ({
    key: `row-${Date.now()}-${rowSeq++}`,
    itemCode: '',
    itemDescription: '',
    qty: 1,
    componentSerialNumber: '',
    batchNumber: '',
    // Set when the item code was picked from Product Master; its description and MGRs then come from there.
    fromMaster: false,
    mgrs: {}
});

const rowFromSaved = (item) => ({
    ...emptyRow(),
    itemCode: item.itemCode,
    itemDescription: item.itemDescription,
    qty: item.qty,
    componentSerialNumber: item.componentSerialNumber || '',
    batchNumber: item.batchNumber || '',
    fromMaster: Boolean(item.inProductMaster),
    mgrs: Object.fromEntries(MGR_KEYS.map((key) => [key, item[key]]))
});

const BOMForm = () => {
    const navigate = useNavigate();
    const { id } = useParams();
    const isEdit = Boolean(id);

    const [loadedId, setLoadedId] = useState(isEdit ? null : 'new');
    const [fg, setFg] = useState({ fgItemCode: '', fgItemDescription: '', fgSerialNumber: '' });
    const [rows, setRows] = useState(() => [emptyRow()]);
    const [errors, setErrors] = useState([]);
    const [saving, setSaving] = useState(false);
    const loading = loadedId !== (isEdit ? id : 'new');

    useEffect(() => {
        if (!isEdit) return undefined;
        let cancelled = false;
        bomService.getById(id)
            .then((res) => {
                if (cancelled) return;
                const bom = res.data;
                setFg({ fgItemCode: bom.fgItemCode, fgItemDescription: bom.fgItemDescription || '', fgSerialNumber: bom.fgSerialNumber });
                setRows(bom.items?.length ? bom.items.map(rowFromSaved) : [emptyRow()]);
                setLoadedId(id);
            })
            .catch((err) => {
                if (cancelled) return;
                toast.error(err.response?.data?.message || 'Failed to load BOM');
                navigate('/bom-master');
            });
        return () => { cancelled = true; };
    }, [id, isEdit, navigate]);

    const updateRow = (index, patch) => setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
    const removeRow = (index) => setRows((prev) => (prev.length === 1 ? [emptyRow()] : prev.filter((_, i) => i !== index)));

    const handleSave = async () => {
        setErrors([]);
        setSaving(true);
        const payload = {
            fgItemCode: fg.fgItemCode,
            fgSerialNumber: fg.fgSerialNumber,
            items: rows.map(({ itemCode, itemDescription, qty, componentSerialNumber, batchNumber }) => ({
                itemCode, itemDescription, qty, componentSerialNumber, batchNumber
            }))
        };
        try {
            const res = isEdit ? await bomService.update(id, payload) : await bomService.create(payload);
            toast.success(`BOM saved for FG serial ${res.data.fgSerialNumber}`);
            navigate(`/bom-master/${res.data._id}`);
        } catch (err) {
            const data = err.response?.data;
            setErrors(data?.errors?.length ? data.errors : [data?.message || 'Could not save the BOM']);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="py-20 text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-primary-500 border-t-transparent"></div>
            </div>
        );
    }

    const backTo = isEdit ? `/bom-master/${id}` : '/bom-master';

    return (
        <div className="space-y-6 animate-in fade-in duration-200">
            {/* Header bar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                <div className="flex items-center gap-4">
                    <button
                        type="button"
                        onClick={() => navigate(backTo)}
                        className="p-3 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-2xl transition-all border border-slate-200"
                    >
                        <MdArrowBack size={20} />
                    </button>
                    <div>
                        <h1 className="text-xl font-black text-slate-900">{isEdit ? 'Edit BOM' : 'New BOM'}</h1>
                        <p className="text-xs text-slate-500 font-medium mt-0.5">
                            {isEdit ? `FG serial ${fg.fgSerialNumber}` : 'Components for one finished-good serial number'}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={() => navigate(backTo)}
                        className="px-6 py-3 rounded-2xl border border-slate-200 text-slate-600 font-black uppercase text-xs tracking-widest hover:bg-slate-50 transition-all"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={saving}
                        className="bg-primary-600 hover:bg-primary-700 text-white px-8 py-3 rounded-2xl font-black transition-all shadow-xl shadow-primary-600/20 uppercase text-xs tracking-widest active:scale-95 disabled:opacity-50"
                    >
                        {saving ? 'Saving...' : 'Save'}
                    </button>
                </div>
            </div>

            {errors.length > 0 && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">
                    <p className="font-bold">Please correct the following:</p>
                    <ul className="mt-1 list-disc pl-5">
                        {errors.map((error) => <li key={error}>{error}</li>)}
                    </ul>
                </div>
            )}

            {/* FG details */}
            <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <div className="space-y-2">
                        <label className={labelClass}>FG Item Code <span className="text-rose-500">*</span></label>
                        <MaterialSearchInput
                            value={fg.fgItemCode}
                            placeholder="Search FG item code"
                            className={inputClass}
                            onChange={(value) => setFg((prev) => ({ ...prev, fgItemCode: value, fgItemDescription: '' }))}
                            onSelect={(material) => setFg((prev) => ({ ...prev, fgItemCode: material.code, fgItemDescription: material.description }))}
                        />
                        {fg.fgItemDescription && <p className="ml-1 text-xs font-medium text-slate-500">{fg.fgItemDescription}</p>}
                    </div>
                    <div className="space-y-2">
                        <label className={labelClass}>FG Serial Number <span className="text-rose-500">*</span></label>
                        <SerialSearchInput
                            value={fg.fgSerialNumber}
                            className={inputClass}
                            placeholder="Search the serial number (e.g. SR454213)"
                            onChange={(value) => setFg((prev) => ({ ...prev, fgSerialNumber: value, serialMatched: false, serialCustomer: '' }))}
                            onSelect={(asset) => setFg((prev) => ({
                                ...prev,
                                fgSerialNumber: asset.serialNumber || prev.fgSerialNumber,
                                // Take the finished good from the registered serial so the BOM
                                // is attached to the product that was actually sold.
                                fgItemCode: asset.productId?.productCode || prev.fgItemCode,
                                fgItemDescription: asset.productId?.productName || prev.fgItemDescription,
                                serialMatched: true,
                                serialCustomer: asset.customerId?.customerName || asset.customerId?.companyName || ''
                            }))}
                        />
                        {fg.serialMatched ? (
                            <p className="ml-1 text-xs font-medium text-emerald-600">
                                Registered serial{fg.serialCustomer ? ` · ${fg.serialCustomer}` : ''}
                            </p>
                        ) : (
                            <p className="ml-1 text-xs font-medium text-slate-400">
                                Pick a serial from Invoice Bulk Upload so the BOM can be found from a complaint.
                            </p>
                        )}
                    </div>
                </div>
            </div>

            {/* Components */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
                    <div>
                        <h2 className="text-xs font-black uppercase tracking-widest text-slate-500">BOM Components</h2>
                        <p className="mt-1 text-xs text-slate-400">Pick the item code from Product Master to fill the description and MGR1–MGR5. For items not in Product Master, type the description.</p>
                    </div>
                    <button
                        type="button"
                        onClick={() => setRows((prev) => [...prev, emptyRow()])}
                        className="flex items-center gap-1.5 rounded-xl bg-primary-50 px-4 py-2 text-xs font-black uppercase tracking-widest text-primary-700 hover:bg-primary-100"
                    >
                        <MdAdd size={18} /> Add Component
                    </button>
                </div>
                <div className="overflow-x-auto p-4">
                    <table className="w-full min-w-[1100px] text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50">
                                {['#', 'Item Code *', 'Description', 'Qty *', 'Batch', 'Serial No', 'MGR1', 'MGR2', 'MGR3', 'MGR4', 'MGR5', ''].map((label) => (
                                    <th key={label} className="px-3 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">{label}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((row, index) => (
                                <tr key={row.key} className="border-b last:border-0 border-slate-50 align-top">
                                    <td className="px-3 py-2 pt-4 text-sm font-bold text-slate-400">{index + 1}</td>
                                    <td className="px-2 py-2 min-w-[10rem]">
                                        <MaterialSearchInput
                                            value={row.itemCode}
                                            placeholder="Item code"
                                            className={cellClass}
                                            onChange={(value) => updateRow(index, { itemCode: value, fromMaster: false, mgrs: {} })}
                                            onSelect={(material) => updateRow(index, {
                                                itemCode: material.code,
                                                itemDescription: material.description,
                                                fromMaster: true,
                                                mgrs: Object.fromEntries(MGR_KEYS.map((key) => [key, material[key]]))
                                            })}
                                        />
                                    </td>
                                    <td className="px-2 py-2 min-w-[12rem]">
                                        <input
                                            className={cellClass}
                                            value={row.itemDescription}
                                            readOnly={row.fromMaster}
                                            title={row.fromMaster ? 'Taken from Product Master' : ''}
                                            onChange={(e) => updateRow(index, { itemDescription: e.target.value })}
                                            placeholder="Description"
                                        />
                                    </td>
                                    <td className="px-2 py-2 w-24">
                                        <input className={cellClass} type="number" min="0" step="any" value={row.qty} onChange={(e) => updateRow(index, { qty: e.target.value })} />
                                    </td>
                                    <td className="px-2 py-2 min-w-[7rem]">
                                        <input className={cellClass} value={row.batchNumber} onChange={(e) => updateRow(index, { batchNumber: e.target.value })} placeholder="Optional" />
                                    </td>
                                    <td className="px-2 py-2 min-w-[8rem]">
                                        <input className={cellClass} value={row.componentSerialNumber} onChange={(e) => updateRow(index, { componentSerialNumber: e.target.value })} placeholder="Optional" />
                                    </td>
                                    {MGR_KEYS.map((key) => (
                                        <td key={key} className="px-3 py-2 pt-4 text-xs text-slate-500 whitespace-nowrap">
                                            {row.mgrs[key] ? <span title={row.mgrs[key].code}>{row.mgrs[key].description || row.mgrs[key].code}</span> : <span className="text-slate-300">-</span>}
                                        </td>
                                    ))}
                                    <td className="px-2 py-2 text-right">
                                        <button type="button" onClick={() => removeRow(index)} className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-all" title="Remove component">
                                            <MdDelete size={18} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default BOMForm;
