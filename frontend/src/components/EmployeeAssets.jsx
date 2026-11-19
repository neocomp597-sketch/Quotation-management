import React, { useCallback, useEffect, useState } from 'react';
import { MdSearch, MdAdd, MdClose, MdSwapHoriz, MdLaptop, MdCheck, MdWarning, MdHistory, MdInventory2, MdPerson, MdHome } from 'react-icons/md';
import { toast } from 'react-toastify';
import { serialTransferService, invalidateApiCache } from '../services/api';
import { useAuth } from '../context/AuthContext';
import Modal from './Modal';
import SearchableSelect from './SearchableSelect';
import DateInput from './DateInput';
import { formatDate, formatDateTime } from '../utils/helpers';

const today = () => new Date().toISOString().slice(0, 10);
const newRequestId = () => `emp-asset-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const STATUS_LABELS = { IN_STOCK: 'In Stock', ALLOCATED: 'Allocated', SOLD: 'Sold', RETURN: 'Returned', RETURNED: 'Returned', SCRAPPED: 'Scrapped' };
const StatusChip = ({ status }) => (
    <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border bg-slate-50 text-slate-600 border-slate-200">
        {STATUS_LABELS[status] || status}
    </span>
);

const AssetLine = ({ asset }) => (
    <div className="min-w-0">
        <p className="text-sm font-black text-slate-900 font-mono truncate">{asset.serialNumber}{asset.assetNo ? <span className="ml-2 text-[10px] font-bold text-slate-400 font-sans">Asset No {asset.assetNo}</span> : null}</p>
        <p className="text-xs text-slate-500 truncate">
            {[asset.productName, asset.productCode].filter(Boolean).join(' · ')}{asset.branchName ? ` · ${asset.branchName}` : ''}
        </p>
    </div>
);

const LOG_ICONS = { added: MdInventory2, holder: MdPerson, branch: MdSwapHoriz };

/**
 * Asset Log of one item (client, 2026-11-19): added in Invoice Bulk Upload, each person it was
 * given to with the branch it was in then (flagged when that was not the employee's own branch),
 * and each branch move, such as Move to <branch>. Oldest first.
 */
const AssetLogModal = ({ employeeId, asset, onClose }) => {
    const [log, setLog] = useState(null);
    const [error, setError] = useState('');

    useEffect(() => {
        let cancelled = false;
        serialTransferService.employeeAssetLog(employeeId, asset._id)
            .then((res) => { if (!cancelled) setLog(res.data); })
            .catch((err) => { if (!cancelled) setError(err.response?.data?.message || 'Could not load the asset log.'); });
        return () => { cancelled = true; };
    }, [employeeId, asset._id]);

    const home = log?.homeBranch?.name;
    const employeeName = log?.employee?.name || 'the employee';

    return (
        <Modal
            isOpen
            onClose={onClose}
            title="Asset Log"
            maxWidth="max-w-2xl"
            footer={(
                <div className="flex justify-end w-full">
                    <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs uppercase">Close</button>
                </div>
            )}
        >
            <div className="space-y-4">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                    <AssetLine asset={log?.asset || asset} />
                    {log && (
                        <p className="text-xs text-slate-500">
                            Now in <span className="font-bold text-slate-700">{log.asset.branchName || 'no branch'}</span>
                            {home ? <> · {employeeName}&apos;s branch: <span className="font-bold text-slate-700">{home}</span></> : null}
                        </p>
                    )}
                    {log?.asset?.awayFromHome && (
                        <p className="flex items-start gap-1.5 text-xs font-semibold text-amber-700">
                            <MdWarning className="shrink-0 mt-0.5" size={14} />
                            Not in {home} yet. Use &quot;Move to {home}&quot; on the employee&apos;s page; the move is added to this log.
                        </p>
                    )}
                </div>

                {error && <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">{error}</p>}
                {!log && !error && <p className="text-xs text-slate-400">Loading...</p>}

                {log && (
                    <ol className="relative space-y-3">
                        {log.events.map((event, index) => {
                            const Icon = LOG_ICONS[event.kind] || MdHistory;
                            const flagged = event.fromOtherBranch;
                            const reachedHome = event.toHomeBranch;
                            return (
                                <li key={index} className="flex gap-3">
                                    <div className="flex flex-col items-center">
                                        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${flagged ? 'border-amber-300 bg-amber-50 text-amber-700' : reachedHome ? 'border-teal-300 bg-teal-50 text-teal-700' : 'border-slate-200 bg-white text-slate-500'}`}>
                                            <Icon size={16} />
                                        </span>
                                        {index < log.events.length - 1 && <span className="mt-1 w-px flex-1 bg-slate-200" />}
                                    </div>
                                    <div className="min-w-0 flex-1 pb-1">
                                        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                                            <p className="text-sm font-black text-slate-800">
                                                {event.title}
                                                {event.current && <span className="ml-2 align-middle inline-block px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border bg-teal-50 text-teal-700 border-teal-200">Current</span>}
                                            </p>
                                            <p className="text-xs font-bold text-slate-500 whitespace-nowrap">
                                                {event.kind === 'holder' ? formatDate(event.date) : formatDateTime(event.date)}
                                            </p>
                                        </div>
                                        {event.holder?.subtitle && <p className="text-xs text-slate-500 break-all">{event.holder.subtitle}</p>}
                                        {event.kind !== 'branch' && event.branchName && (
                                            <p className="text-xs text-slate-600">
                                                {event.kind === 'added' ? 'Branch' : 'Asset was in'}: <span className="font-bold">{event.branchName}</span>
                                            </p>
                                        )}
                                        {flagged && (
                                            <p className="mt-1 inline-flex items-start gap-1.5 rounded-lg bg-amber-50 border border-amber-200 px-2 py-1 text-xs font-semibold text-amber-800">
                                                <MdWarning className="shrink-0 mt-0.5" size={14} />
                                                Given from {event.branchName}, another branch than {home}, {employeeName}&apos;s branch.
                                            </p>
                                        )}
                                        {reachedHome && (
                                            <p className="mt-1 inline-flex items-start gap-1.5 rounded-lg bg-teal-50 border border-teal-200 px-2 py-1 text-xs font-semibold text-teal-800">
                                                <MdHome className="shrink-0 mt-0.5" size={14} />
                                                Now in {employeeName}&apos;s own branch.
                                            </p>
                                        )}
                                        <p className="text-xs text-slate-500">
                                            {[
                                                event.transferNo && `Branch Transfer ${event.transferNo}`,
                                                event.invoiceNumber && event.kind !== 'branch' && `Invoice ${event.invoiceNumber}`,
                                                event.remarks,
                                                event.by && `by ${event.by}`
                                            ].filter(Boolean).join(' · ')}
                                        </p>
                                    </div>
                                </li>
                            );
                        })}
                    </ol>
                )}
            </div>
        </Modal>
    );
};

/**
 * Employee Master, section "Assign Asset": company items (Invoice Bulk Upload serial numbers such
 * as laptops) given to an employee, and Asset Transfer of an item to another employee. The server
 * records each change in the item's history, as Serial No Transfer does, and an in-stock item
 * becomes Allocated.
 *
 * New employee (no `employeeId`): the chosen items are kept in `pending` (`onPendingChange`) and the
 * page assigns them right after the employee is saved. Existing employee: the items they hold are
 * listed with Transfer, and chosen items are assigned with "Assign selected".
 */
// reloadKey: changing it reloads the items held (e.g. after a Branch Transfer moved them)
const EmployeeAssets = ({ employeeId = null, employeeName = '', employees = [], pending = [], onPendingChange, reloadKey = 0 }) => {
    const { can } = useAuth();
    const allowed = can('master_serial_transfer', 'modify');
    const isNew = !employeeId;

    const [held, setHeld] = useState([]);
    const [homeBranch, setHomeBranch] = useState(null); // { _id, name }: the employee's own branch
    const [movingHome, setMovingHome] = useState(false);
    const [loadingHeld, setLoadingHeld] = useState(false);
    const [search, setSearch] = useState('');
    const [results, setResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const [chosen, setChosen] = useState([]);
    const [assigning, setAssigning] = useState(false);
    const [transfer, setTransfer] = useState(null); // { asset, toEmployeeId, date, remarks, requestId }
    const [savingTransfer, setSavingTransfer] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);
    const [logFor, setLogFor] = useState(null); // the item whose Asset Log is open

    const picked = isNew ? pending : chosen;
    const setPicked = isNew ? (onPendingChange || (() => {})) : setChosen;

    const loadHeld = useCallback(async () => {
        if (!employeeId || !allowed) return;
        setLoadingHeld(true);
        try {
            const res = await serialTransferService.employeeAssets(employeeId);
            setHeld(res.data?.data || []);
            setHomeBranch(res.data?.homeBranch || null);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Could not load the employee\'s assets');
        } finally {
            setLoadingHeld(false);
        }
    }, [employeeId, allowed]);
    useEffect(() => { loadHeld(); }, [loadHeld, reloadKey]);

    // Items that can be given: searched as typed (in stock or allocated to nobody, in the working branch).
    useEffect(() => {
        if (!allowed) return undefined;
        let cancelled = false;
        const timer = setTimeout(async () => {
            setSearching(true);
            try {
                const res = await serialTransferService.assignableAssets({ search: search.trim() || undefined, limit: 20 });
                if (!cancelled) setResults(res.data?.data || []);
            } catch {
                if (!cancelled) setResults([]);
            } finally {
                if (!cancelled) setSearching(false);
            }
        }, search.trim() ? 300 : 0);
        return () => { cancelled = true; clearTimeout(timer); };
    }, [search, allowed, refreshKey]);

    const isPicked = (asset) => picked.some((item) => item._id === asset._id);
    const pick = (asset) => { if (!isPicked(asset)) setPicked([...picked, asset]); };
    const unpick = (asset) => setPicked(picked.filter((item) => item._id !== asset._id));

    const assignChosen = async () => {
        if (!chosen.length || assigning) return;
        setAssigning(true);
        try {
            const res = await serialTransferService.assignEmployeeAssets(employeeId, { assetIds: chosen.map((asset) => asset._id) });
            setHeld(res.data?.data || []);
            setChosen([]);
            setRefreshKey((key) => key + 1);
            toast.success(`${res.data?.assigned ?? chosen.length} ${chosen.length === 1 ? 'asset' : 'assets'} assigned to ${employeeName || 'the employee'}`);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Could not assign the assets');
        } finally {
            setAssigning(false);
        }
    };

    // Items booked in another branch than the employee's own (e.g. moved there before a Branch
    // Transfer took the assets along): that branch's screens, such as Invoice Bulk Upload, miss them.
    const away = homeBranch ? held.filter((asset) => asset.branchId && String(asset.branchId) !== String(homeBranch._id)) : [];
    const moveHome = async () => {
        if (!away.length || movingHome) return;
        const what = away.length === 1 ? away[0].serialNumber : `${away.length} assets`;
        if (!window.confirm(`Move ${what} to ${homeBranch.name}, ${employeeName || 'the employee'}'s branch?\n\nIt is saved as a Branch Transfer in Serial No Transfer.`)) return;
        setMovingHome(true);
        try {
            const res = await serialTransferService.moveEmployeeAssetsHome(employeeId);
            invalidateApiCache('/serial-transfers');
            invalidateApiCache('/csm/assets');
            const notify = res.data?.error ? (text) => toast.warn(text, { autoClose: 10000 }) : toast.success;
            notify(res.data?.message || `Moved to ${homeBranch.name}`);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Could not move the assets');
        } finally {
            setMovingHome(false);
            loadHeld();
        }
    };

    const openTransfer = (asset) => setTransfer({ asset, toEmployeeId: '', date: today(), remarks: '', requestId: newRequestId() });
    const saveTransfer = async () => {
        if (!transfer?.toEmployeeId) { toast.error('Select the employee to transfer the asset to.'); return; }
        setSavingTransfer(true);
        try {
            const res = await serialTransferService.transferEmployeeAsset(employeeId, transfer.asset._id, {
                toEmployeeId: transfer.toEmployeeId,
                transferDate: transfer.date,
                remarks: transfer.remarks,
                requestId: transfer.requestId
            });
            setHeld(res.data?.data || []);
            toast.success(`${transfer.asset.serialNumber} transferred to ${res.data?.transferredTo?.name || 'the employee'}`);
            setTransfer(null);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Could not transfer the asset');
        } finally {
            setSavingTransfer(false);
        }
    };

    const targetOptions = employees
        .filter((emp) => String(emp._id) !== String(employeeId) && !emp.isVacant && emp.status !== 'Vacant' && (emp.status === 'Active' || !emp.status))
        .map((emp) => ({ value: emp._id, label: `${emp.name}${emp.employeeId ? ` - ID: ${emp.employeeId}` : ''}${emp.designation ? ` (${emp.designation})` : ''}` }));

    return (
        <div className="border border-slate-200 rounded-2xl p-4 sm:p-5 bg-white space-y-4">
            <h4 className="text-xs font-black text-teal-600 uppercase tracking-widest border-b border-slate-50 pb-1.5 flex items-center gap-2">
                <MdLaptop size={16} /> 5. Assign Asset
            </h4>

            {!allowed ? (
                <p className="text-xs font-semibold text-slate-500">Giving company assets to employees needs Modify access to Serial No Transfer in Authorization.</p>
            ) : (
                <>
                    {!isNew && (
                        <div className="space-y-2">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Assets with {employeeName || 'this employee'}</p>
                            {loadingHeld ? (
                                <p className="text-xs text-slate-400">Loading...</p>
                            ) : held.length === 0 ? (
                                <p className="text-xs font-semibold text-slate-500">No company assets are assigned to this employee yet.</p>
                            ) : (
                                <ul className="divide-y divide-slate-100 border border-slate-100 rounded-xl">
                                    {held.map((asset) => (
                                        <li key={asset._id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3 px-3 py-2.5">
                                            <AssetLine asset={asset} />
                                            <div className="flex items-center gap-2 shrink-0">
                                                <StatusChip status={asset.status} />
                                                <button
                                                    type="button"
                                                    onClick={() => setLogFor(asset)}
                                                    aria-label={`Asset Log of ${asset.serialNumber}`}
                                                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 font-black uppercase text-[10px] tracking-widest"
                                                >
                                                    <MdHistory size={15} /> Log
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => openTransfer(asset)}
                                                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-primary-600 hover:bg-primary-50 font-black uppercase text-[10px] tracking-widest"
                                                >
                                                    <MdSwapHoriz size={15} /> Transfer
                                                </button>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            )}
                            {away.length > 0 && (
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-3 py-2.5 rounded-xl border border-amber-200 bg-amber-50">
                                    <p className="flex items-start gap-2 text-xs font-semibold text-amber-800">
                                        <MdWarning className="shrink-0 mt-0.5" size={16} />
                                        <span>
                                            {away.length === 1 ? `${away[0].serialNumber} is` : `${away.length} of these assets are`} in another branch than {homeBranch.name},
                                            {' '}{employeeName || 'the employee'}&apos;s branch, so {homeBranch.name} (e.g. Invoice Bulk Upload) does not find {away.length === 1 ? 'it' : 'them'}.
                                        </span>
                                    </p>
                                    <button
                                        type="button"
                                        onClick={moveHome}
                                        disabled={movingHome}
                                        className="shrink-0 inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white font-black uppercase text-[10px] tracking-widest"
                                    >
                                        <MdSwapHoriz size={15} /> {movingHome ? 'Moving...' : `Move to ${homeBranch.name}`}
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="space-y-2">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                            {isNew ? 'Assets to give this employee' : 'Give more assets'}
                            <span className="normal-case tracking-normal font-semibold"> · in stock or allocated to nobody, in the branch at the top of the screen</span>
                        </p>
                        <div className="relative">
                            <MdSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
                                placeholder="Search serial no, Asset No or product..."
                                className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                            />
                        </div>
                        <ul className="max-h-56 overflow-y-auto divide-y divide-slate-100 border border-slate-100 rounded-xl">
                            {searching && results.length === 0 && <li className="px-3 py-2.5 text-xs text-slate-400">Searching...</li>}
                            {!searching && results.length === 0 && <li className="px-3 py-2.5 text-xs text-slate-500">No assets free to assign{search.trim() ? ' match this search' : ' in this branch'}.</li>}
                            {results.map((asset) => {
                                const added = isPicked(asset);
                                return (
                                    <li key={asset._id} className="flex items-center justify-between gap-3 px-3 py-2">
                                        <AssetLine asset={asset} />
                                        <div className="flex items-center gap-2 shrink-0">
                                            <StatusChip status={asset.status} />
                                            <button
                                                type="button"
                                                onClick={() => (added ? unpick(asset) : pick(asset))}
                                                className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border font-black uppercase text-[10px] tracking-widest ${added ? 'border-teal-500 bg-teal-50 text-teal-700' : 'border-slate-200 bg-white text-slate-700 hover:border-teal-400'}`}
                                            >
                                                {added ? <><MdCheck size={14} /> Added</> : <><MdAdd size={14} /> Add</>}
                                            </button>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>

                    {picked.length > 0 && (
                        <div className="space-y-2">
                            <div className="flex flex-wrap gap-2">
                                {picked.map((asset) => (
                                    <span key={asset._id} className="inline-flex items-center gap-1.5 pl-3 pr-1.5 py-1 rounded-full bg-teal-50 border border-teal-200 text-teal-800 text-xs font-bold">
                                        <span className="font-mono">{asset.serialNumber}</span>
                                        <button type="button" onClick={() => unpick(asset)} aria-label={`Remove ${asset.serialNumber}`} className="p-0.5 rounded-full hover:bg-teal-100">
                                            <MdClose size={13} />
                                        </button>
                                    </span>
                                ))}
                            </div>
                            {isNew ? (
                                <p className="text-xs font-semibold text-slate-500">
                                    {picked.length} {picked.length === 1 ? 'asset is' : 'assets are'} assigned to this employee when you save the profile.
                                </p>
                            ) : (
                                <button
                                    type="button"
                                    onClick={assignChosen}
                                    disabled={assigning}
                                    className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-black uppercase tracking-widest disabled:opacity-60"
                                >
                                    <MdCheck size={16} /> {assigning ? 'Assigning...' : `Assign selected (${picked.length})`}
                                </button>
                            )}
                        </div>
                    )}
                </>
            )}

            {logFor && <AssetLogModal employeeId={employeeId} asset={logFor} onClose={() => setLogFor(null)} />}

            {transfer && (
                <Modal
                    isOpen
                    onClose={() => (savingTransfer ? null : setTransfer(null))}
                    title="Asset Transfer"
                    maxWidth="max-w-lg"
                    footer={(
                        <div className="flex justify-end gap-3 w-full">
                            <button type="button" onClick={() => setTransfer(null)} disabled={savingTransfer} className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs uppercase">Cancel</button>
                            <button type="button" onClick={saveTransfer} disabled={savingTransfer} className="px-5 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-black text-xs uppercase tracking-widest disabled:opacity-60">
                                {savingTransfer ? 'Transferring...' : 'Transfer Asset'}
                            </button>
                        </div>
                    )}
                >
                    <div className="space-y-4">
                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                            <AssetLine asset={transfer.asset} />
                            <p className="mt-1 text-xs text-slate-500">Now with <span className="font-bold text-slate-700">{employeeName || 'this employee'}</span></p>
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Transfer To Employee *</label>
                            <SearchableSelect
                                options={targetOptions}
                                value={transfer.toEmployeeId}
                                onChange={(value) => setTransfer((prev) => ({ ...prev, toEmployeeId: value }))}
                                placeholder="-- Select employee --"
                                noResultsText="No active employee found"
                            />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Transfer Date *</label>
                                <DateInput
                                    type="date"
                                    value={transfer.date}
                                    max={today()}
                                    onChange={(e) => setTransfer((prev) => ({ ...prev, date: e.target.value }))}
                                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Remarks</label>
                                <input
                                    type="text"
                                    value={transfer.remarks}
                                    onChange={(e) => setTransfer((prev) => ({ ...prev, remarks: e.target.value }))}
                                    placeholder="Optional"
                                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold"
                                />
                            </div>
                        </div>
                        <p className="text-xs text-slate-500">The asset's history keeps both employees; it stays Allocated, with the new employee as its holder.</p>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default EmployeeAssets;
