import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { MdSync, MdWarningAmber } from 'react-icons/md';
import Modal from './Modal';
import { productService } from '../services/api';

const MGR_KEYS = ['mgr1', 'mgr2', 'mgr3', 'mgr4', 'mgr5'];
const mgrLine = (mgr) => MGR_KEYS.map((key) => mgr?.[key] || '-').join(' / ');

const ACTIONS = {
    move: { label: 'Move into Product Master', tone: 'text-primary-700 dark:text-primary-300' },
    copy: { label: 'Copy into Product Master', tone: 'text-primary-700 dark:text-primary-300' },
    link: { label: 'Use your product', tone: 'text-primary-700 dark:text-primary-300' },
    blocked: { label: 'Cannot move', tone: 'text-rose-600 dark:text-rose-400' }
};

const explain = (row) => {
    if (row.action === 'move') return 'Becomes your product as it is; everything that uses it stays linked.';
    if (row.action === 'copy') return 'It is also used outside your company, so you get your own copy and your serial numbers move to it.';
    if (row.action === 'link') return `You already have code ${row.target?.productCode} (${row.target?.productName}); your serial numbers move to it.`;
    return row.reason;
};

/**
 * Product Master > Pre-company Products (administrators): products saved before companies existed
 * that this company's serial numbers use. Product Master does not list them, so their MGR could not
 * be set. Shows what would happen to each and brings the selected ones into Product Master
 * (backend/services/preCompanyProducts.js).
 */
const PreCompanyProducts = ({ isOpen, onClose, onChanged }) => {
    const [rows, setRows] = useState(null);
    const [selected, setSelected] = useState([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [results, setResults] = useState(null);

    const load = async () => {
        setLoading(true);
        try {
            const res = await productService.getPreCompany();
            const data = res.data?.data || [];
            setRows(data);
            setSelected(data.filter((row) => row.action !== 'blocked').map((row) => row._id));
        } catch (err) {
            toast.error(err?.response?.data?.message || 'Could not load the pre-company products');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            setResults(null);
            load();
        }
    }, [isOpen]);

    const actionable = useMemo(() => (rows || []).filter((row) => row.action !== 'blocked'), [rows]);
    const toggle = (id) => setSelected((prev) => (prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id]));
    const gainsMgr = (rows || []).some((row) => selected.includes(row._id) && MGR_KEYS.some((key) => row.mgrAfter?.[key]));

    const adopt = async () => {
        if (!selected.length) return;
        if (!window.confirm(`Bring ${selected.length} product${selected.length === 1 ? '' : 's'} into your Product Master?`)) return;
        setSaving(true);
        try {
            const res = await productService.adoptPreCompany(selected);
            setResults(res.data?.results || []);
            toast.success(res.data?.message || 'Done');
            onChanged?.();
            await load();
        } catch (err) {
            toast.error(err?.response?.data?.message || 'Could not move the products');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Pre-company Products" maxWidth="max-w-6xl">
            <div className="space-y-4 text-xs text-slate-700 dark:text-slate-200">
                <p className="text-slate-500 dark:text-slate-400 font-semibold">
                    Products saved before companies existed that your serial numbers in Invoice Bulk Upload still use. Product Master does not list them, so their MGR cannot be set.
                    Bring them into your Product Master, then set their MGR there as usual.
                </p>

                {results && results.length > 0 && (
                    <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 space-y-1">
                        {results.map((row) => (
                            <p key={row.productCode} className={row.done ? 'text-primary-700 dark:text-primary-300 font-semibold' : 'text-rose-600 dark:text-rose-400 font-semibold'}>
                                <span className="font-black">{row.productCode}</span>: {row.message}
                            </p>
                        ))}
                    </div>
                )}

                {loading && !rows && <p className="text-slate-400 font-semibold">Loading...</p>}
                {rows && rows.length === 0 && (
                    <p className="p-3 rounded-xl bg-primary-50 dark:bg-primary-950/40 text-primary-700 dark:text-primary-300 font-bold">
                        None left: every product your serial numbers use is in your Product Master.
                    </p>
                )}

                {rows && rows.length > 0 && (
                    <>
                        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 max-h-[50vh] overflow-y-auto">
                            <table className="w-full">
                                <thead className="bg-slate-50 dark:bg-slate-800 text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 sticky top-0">
                                    <tr>
                                        <th className="px-3 py-2 text-left">
                                            <input
                                                type="checkbox"
                                                aria-label="Select all"
                                                className="accent-primary-600"
                                                checked={actionable.length > 0 && selected.length === actionable.length}
                                                onChange={(e) => setSelected(e.target.checked ? actionable.map((row) => row._id) : [])}
                                            />
                                        </th>
                                        <th className="px-3 py-2 text-left font-black">Product</th>
                                        <th className="px-3 py-2 text-right font-black">Serials</th>
                                        <th className="px-3 py-2 text-left font-black">MGR 1-5 now</th>
                                        <th className="px-3 py-2 text-left font-black">MGR 1-5 after</th>
                                        <th className="px-3 py-2 text-left font-black">What happens</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {rows.map((row) => (
                                        <tr key={row._id} className={row.action === 'blocked' ? 'opacity-70' : ''}>
                                            <td className="px-3 py-2 align-top">
                                                <input
                                                    type="checkbox"
                                                    aria-label={`Select ${row.productCode}`}
                                                    className="accent-primary-600"
                                                    disabled={row.action === 'blocked' || saving}
                                                    checked={selected.includes(row._id)}
                                                    onChange={() => toggle(row._id)}
                                                />
                                            </td>
                                            <td className="px-3 py-2 align-top">
                                                <span className="font-black">{row.productCode}</span>
                                                {row.productName && row.productName !== row.productCode && <span className="block font-semibold text-slate-400">{row.productName}</span>}
                                            </td>
                                            <td className="px-3 py-2 align-top text-right font-black">{row.serials}</td>
                                            <td className="px-3 py-2 align-top whitespace-nowrap">{mgrLine(row.mgrNow)}</td>
                                            <td className="px-3 py-2 align-top whitespace-nowrap font-semibold">{mgrLine(row.mgrAfter)}</td>
                                            <td className="px-3 py-2 align-top min-w-[16rem]">
                                                <span className={`font-black ${ACTIONS[row.action]?.tone || ''}`}>{ACTIONS[row.action]?.label || row.action}</span>
                                                <span className="block text-slate-500 dark:text-slate-400 font-semibold">{explain(row)}</span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {gainsMgr && (
                            <div className="flex items-start gap-2 p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 font-semibold text-amber-800 dark:text-amber-300">
                                <MdWarningAmber size={16} className="shrink-0 mt-px" />
                                <span>
                                    Products that get an MGR follow MGR Access from then on: users limited to other MGR values stop seeing their serial numbers.
                                    Check the "MGR 1-5 after" column, or use Check hidden serials in a user's MGR Access afterwards.
                                </span>
                            </div>
                        )}

                        <div className="flex flex-wrap items-center justify-end gap-2">
                            <button
                                type="button"
                                onClick={load}
                                disabled={loading || saving}
                                className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 font-bold hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
                            >
                                <MdSync size={14} className={loading ? 'animate-spin' : ''} /> Refresh
                            </button>
                            <button
                                type="button"
                                onClick={adopt}
                                disabled={!selected.length || saving}
                                className="px-4 py-2 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-black disabled:opacity-50"
                            >
                                {saving ? 'Working...' : `Bring ${selected.length} into Product Master`}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </Modal>
    );
};

export default PreCompanyProducts;
