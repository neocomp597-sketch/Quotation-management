import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { MdAdd, MdArrowBack, MdDelete } from 'react-icons/md';
import { toast } from 'react-toastify';
import { bomService } from '../services/api';
import MaterialSearchInput from '../components/bom/MaterialSearchInput';

const MGR_KEYS = ['mgr1', 'mgr2', 'mgr3', 'mgr4', 'mgr5'];
const inputClass = 'w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 outline-none text-sm font-medium transition-all disabled:text-slate-500';
const cellClass = 'w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none text-sm';
const labelClass = 'text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1';

let rowSeq = 0;
// Component lines follow the BOM relationship sheet: Item Code, Item Name, UOM, Quantity.
const emptyRow = () => ({
    key: `row-${Date.now()}-${rowSeq++}`,
    itemCode: '',
    itemDescription: '',
    uom: '',
    qty: 1,
    // Set when the item code was picked from Product Master; its description and MGRs then come from there.
    fromMaster: false,
    mgrs: {}
});

const rowFromSaved = (item) => ({
    ...emptyRow(),
    itemCode: item.itemCode,
    itemDescription: item.itemDescription,
    uom: item.uom || '',
    qty: item.qty,
    drawingNo: item.drawingNo || '',
    revisionNo: item.revisionNo || '',
    fromMaster: Boolean(item.inProductMaster),
    mgrs: Object.fromEntries(MGR_KEYS.map((key) => [key, item[key]]))
});

const BOMForm = () => {
    const navigate = useNavigate();
    const { id } = useParams();
    const isEdit = Boolean(id);

    const [loadedId, setLoadedId] = useState(isEdit ? null : 'new');
    const [fg, setFg] = useState({ fgItemCode: '', fgItemDescription: '', fgSerialNumber: '' });
    // Product the BOM was opened with; editing it never clashes with itself.
    const [savedCode, setSavedCode] = useState('');
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
                // An item-level BOM stores its parent item code as the serial; the form shows it blank.
                const sameAsCode = String(bom.fgSerialNumber || '').toUpperCase() === String(bom.fgItemCode || '').toUpperCase();
                setFg({ fgItemCode: bom.fgItemCode, fgItemDescription: bom.fgItemDescription || '', fgSerialNumber: sameAsCode ? '' : bom.fgSerialNumber });
                setSavedCode(bom.fgItemCode);
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

    // One BOM per product: as soon as a product is chosen, say so if it already has a BOM.
    const productCode = fg.fgItemCode.trim();
    const needsCheck = Boolean(productCode) && productCode.toUpperCase() !== savedCode.toUpperCase();
    const [productCheck, setProductCheck] = useState({ code: '', bom: null });
    useEffect(() => {
        if (!needsCheck) return undefined;
        let cancelled = false;
        const timer = setTimeout(() => {
            bomService.checkProduct(productCode, isEdit ? id : undefined)
                .then((res) => { if (!cancelled) setProductCheck({ code: productCode, bom: res.data?.bom || null }); })
                .catch(() => { if (!cancelled) setProductCheck({ code: productCode, bom: null }); });
        }, 300);
        return () => { cancelled = true; clearTimeout(timer); };
    }, [productCode, needsCheck, isEdit, id]);
    const existingBom = needsCheck && productCheck.code === productCode ? productCheck.bom : null;

    const updateRow = (index, patch) => setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
    const removeRow = (index) => setRows((prev) => (prev.length === 1 ? [emptyRow()] : prev.filter((_, i) => i !== index)));

    const handleSave = async () => {
        if (existingBom) {
            setErrors(['A BOM already exists for this product.']);
            return;
        }
        setErrors([]);
        setSaving(true);
        const payload = {
            fgItemCode: fg.fgItemCode,
            fgSerialNumber: fg.fgSerialNumber,
            items: rows.map(({ itemCode, itemDescription, uom, qty, drawingNo, revisionNo }) => ({ itemCode, itemDescription, uom, qty, drawingNo, revisionNo }))
        };
        try {
            const res = isEdit ? await bomService.update(id, payload) : await bomService.create(payload);
            toast.success(`BOM saved for parent item ${res.data.fgItemCode}`);
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
                            {isEdit ? `Parent Item Code ${fg.fgItemCode}` : 'Components of one parent item'}
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
                        disabled={saving || Boolean(existingBom)}
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
                        <label className={labelClass}>Parent Item Code <span className="text-rose-500">*</span></label>
                        <MaterialSearchInput
                            value={fg.fgItemCode}
                            placeholder="Search parent item code"
                            className={inputClass}
                            onChange={(value) => setFg((prev) => ({ ...prev, fgItemCode: value, fgItemDescription: '' }))}
                            onSelect={(material) => setFg((prev) => ({ ...prev, fgItemCode: material.code, fgItemDescription: material.description }))}
                        />
                        {fg.fgItemDescription && <p className="ml-1 text-xs font-medium text-slate-500">{fg.fgItemDescription}</p>}
                        {existingBom && (
                            <p className="ml-1 text-xs font-bold text-rose-600">
                                A BOM already exists for this product.{' '}
                                <button type="button" onClick={() => navigate(`/bom-master/${existingBom._id}`)} className="underline hover:text-rose-700">
                                    Open it
                                </button>
                            </p>
                        )}
                    </div>
                    {isEdit && fg.fgSerialNumber && (
                        <div className="space-y-2">
                            <label className={labelClass}>FG Serial Number</label>
                            <p className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3.5 text-sm font-bold text-slate-700">{fg.fgSerialNumber}</p>
                            <p className="ml-1 text-xs font-medium text-slate-400">This BOM was saved for one serial; the serial is kept as it is.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Components */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
                    <div>
                        <h2 className="text-xs font-black uppercase tracking-widest text-slate-500">BOM Components</h2>
                        <p className="mt-1 text-xs text-slate-400">Pick the item code from Product Master to fill the item name and MGR1–MGR5. For items not in Product Master, type the item name.</p>
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
                    <table className="w-full min-w-[960px] text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50">
                                {['#', 'Item Code *', 'Item Name', 'UOM', 'Quantity *', 'MGR1', 'MGR2', 'MGR3', 'MGR4', 'MGR5', ''].map((label) => (
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
                                                uom: row.uom || material.uom || '',
                                                fromMaster: true,
                                                mgrs: Object.fromEntries(MGR_KEYS.map((key) => [key, material[key]]))
                                            })}
                                        />
                                    </td>
                                    <td className="px-2 py-2 min-w-[16rem]">
                                        <input
                                            className={cellClass}
                                            value={row.itemDescription}
                                            readOnly={row.fromMaster}
                                            title={row.fromMaster ? 'Taken from Product Master' : ''}
                                            onChange={(e) => updateRow(index, { itemDescription: e.target.value })}
                                            placeholder="Item name"
                                        />
                                    </td>
                                    <td className="px-2 py-2 w-28">
                                        <input className={cellClass} value={row.uom} onChange={(e) => updateRow(index, { uom: e.target.value })} placeholder="NOS" />
                                    </td>
                                    <td className="px-2 py-2 w-28">
                                        <input className={cellClass} type="number" min="0" step="any" value={row.qty} onChange={(e) => updateRow(index, { qty: e.target.value })} />
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
