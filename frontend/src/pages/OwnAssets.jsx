import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
    MdAdd, MdAssignmentReturn, MdCheck, MdClose, MdConfirmationNumber, MdEdit, MdInfoOutline, MdRefresh, MdSearch, MdVisibility,
} from 'react-icons/md';
import { toast } from 'react-toastify';
import { ownAssetService, invalidateApiCache } from '../services/api';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';
import SearchableSelect from '../components/SearchableSelect';
import DateInput from '../components/DateInput';
import { AssetLogModal } from '../components/EmployeeAssets';
import { MobileCard, MobileCardActions, MobileCardHead, MobileCardList, MobileEmpty, MobileField, MobileFields } from '../components/SerialMobileCards';
import { formatDate } from '../utils/helpers';

/**
 * Own Assets: company items (Invoice Bulk Upload serial numbers such as laptops) held by the user
 * (My Assets), their reporting manager (Manager Assets) and the people who report to them (My Team
 * Assets), as Employee Master's Reporting To says. Each list is its own screen in Authorization:
 * View lists the items and opens their Asset Log, Create is Add asset, Modify is Edit (Asset No,
 * hand over to someone of the user's circle) and Delete is Take back (In Stock with nobody).
 * Raise ticket opens a new Customer Service ticket for the item.
 */
const VIEWS = {
    manager: { key: 'manager', permissionKey: 'own_assets_manager', title: 'Manager Assets', note: 'Company items assigned to your reporting manager.', path: '/own-assets/manager' },
    mine: { key: 'mine', permissionKey: 'own_assets_mine', title: 'My Assets', note: 'Company items assigned to you.', path: '/own-assets/mine' },
    team: { key: 'team', permissionKey: 'own_assets_team', title: 'My Team Assets', note: 'Company items assigned to the people who report to you, directly or further down.', path: '/own-assets/team' },
};
const VIEW_ORDER = ['manager', 'mine', 'team'];

const STATUS_LABELS = { IN_STOCK: 'In Stock', ALLOCATED: 'Allocated', SOLD: 'Sold', RETURN: 'Returned', RETURNED: 'Returned', SCRAPPED: 'Scrapped' };
const RELATION_LABELS = { me: 'You', manager: 'Manager', team: 'Team' };

const today = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};
const newRequestId = () => `own-asset-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
const personLabel = (person) => (person ? `${person.name}${person.employeeId ? ` - ${person.employeeId}` : ''}` : '');
const errorText = (err, fallback) => err.response?.data?.message || fallback;

// After a change, other screens showing these items read them again.
const dropCachedAssets = () => {
    invalidateApiCache('/own-assets');
    invalidateApiCache('/serial-transfers');
    invalidateApiCache('/csm/assets');
};

const labelClass = 'block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1';
const inputClass = 'w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500';
const thClass = 'p-4 text-xs font-black text-slate-400 uppercase tracking-widest whitespace-nowrap';
const iconButton = 'inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition-colors hover:border-primary-400 hover:text-primary-600';
const dangerButton = 'inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition-colors hover:border-rose-400 hover:text-rose-600';

const StatusChip = ({ status }) => (
    <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border bg-slate-50 text-slate-600 border-slate-200 whitespace-nowrap">
        {STATUS_LABELS[status] || status || 'In Stock'}
    </span>
);

const ItemLine = ({ asset }) => (
    <div className="min-w-0">
        <p className="text-sm font-black text-slate-900 font-mono truncate">{asset.serialNumber}{asset.assetNo ? <span className="ml-2 text-[10px] font-bold text-slate-400 font-sans">Asset No {asset.assetNo}</span> : null}</p>
        <p className="text-xs text-slate-500 truncate">{[asset.productName, asset.productCode].filter(Boolean).join(' · ')}{asset.branchName ? ` · ${asset.branchName}` : ''}</p>
    </div>
);

const ModalButtons = ({ onCancel, onSave, saving, saveLabel, savingLabel, danger = false, disabled = false }) => (
    <div className="flex justify-end gap-3 w-full">
        <button type="button" onClick={onCancel} disabled={saving} className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs uppercase">Cancel</button>
        <button
            type="button"
            onClick={onSave}
            disabled={saving || disabled}
            className={`px-5 py-2.5 rounded-xl text-white font-black text-xs uppercase tracking-widest disabled:opacity-60 ${danger ? 'bg-rose-600 hover:bg-rose-700' : 'bg-primary-600 hover:bg-primary-700'}`}
        >
            {saving ? savingLabel : saveLabel}
        </button>
    </div>
);

/** Add asset: free items of the working branch (in stock or allocated to nobody), given to the list's person. */
const AddAssetModal = ({ view, holders, onClose, onAdded }) => {
    const [employeeId, setEmployeeId] = useState(view.key === 'team' ? '' : String(holders[0]?._id || ''));
    const [search, setSearch] = useState('');
    const [results, setResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const [chosen, setChosen] = useState([]);
    const [date, setDate] = useState(today());
    const [remarks, setRemarks] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        let cancelled = false;
        const timer = setTimeout(async () => {
            setSearching(true);
            try {
                const res = await ownAssetService.assignable(view.key, { search: search.trim() || undefined, limit: 20 });
                if (!cancelled) setResults(res.data?.data || []);
            } catch (err) {
                if (!cancelled) {
                    setResults([]);
                    toast.error(errorText(err, 'Could not search the assets'), { toastId: 'own-asset-search' });
                }
            } finally {
                if (!cancelled) setSearching(false);
            }
        }, search.trim() ? 300 : 0);
        return () => { cancelled = true; clearTimeout(timer); };
    }, [search, view.key]);

    const isChosen = (asset) => chosen.some((item) => item._id === asset._id);
    const toggle = (asset) => setChosen((list) => (list.some((item) => item._id === asset._id) ? list.filter((item) => item._id !== asset._id) : [...list, asset]));
    const holder = holders.find((person) => String(person._id) === String(employeeId));

    const save = async () => {
        if (!holder) { toast.error('Select the person to give the assets to.'); return; }
        if (!chosen.length) { toast.error('Add at least one asset.'); return; }
        setSaving(true);
        try {
            const res = await ownAssetService.assign(view.key, { employeeId, assetIds: chosen.map((asset) => asset._id), assignDate: date, remarks });
            dropCachedAssets();
            const count = res.data?.assigned ?? chosen.length;
            toast.success(`${count} ${count === 1 ? 'asset' : 'assets'} assigned to ${res.data?.holder?.name || holder.name}`);
            onAdded();
        } catch (err) {
            toast.error(errorText(err, 'Could not add the assets'));
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal
            isOpen
            onClose={() => (saving ? null : onClose())}
            title="Add asset"
            maxWidth="max-w-2xl"
            footer={<ModalButtons onCancel={onClose} onSave={save} saving={saving} saveLabel={`Save asset${chosen.length > 1 ? 's' : ''}${chosen.length ? ` (${chosen.length})` : ''}`} savingLabel="Saving..." disabled={!chosen.length || !holder} />}
        >
            <div className="space-y-4">
                {view.key === 'team' ? (
                    <div>
                        <label className={labelClass}>Give to *</label>
                        <SearchableSelect
                            options={holders.map((person) => ({ value: String(person._id), label: `${personLabel(person)}${person.designation ? ` (${person.designation})` : ''}` }))}
                            value={employeeId}
                            onChange={(value) => setEmployeeId(value)}
                            placeholder="-- Select a person of your team --"
                            noResultsText="Nobody of your team matches"
                        />
                    </div>
                ) : (
                    <p className="text-sm text-slate-600">Adding to <span className="font-black text-slate-900">{personLabel(holder)}</span>.</p>
                )}

                <div className="space-y-2">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                        Assets to give
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
                            className={`${inputClass} pl-9`}
                        />
                    </div>
                    <ul className="max-h-60 overflow-y-auto divide-y divide-slate-100 border border-slate-100 rounded-xl">
                        {searching && results.length === 0 && <li className="px-3 py-2.5 text-xs text-slate-400">Searching...</li>}
                        {!searching && results.length === 0 && <li className="px-3 py-2.5 text-xs text-slate-500">No assets free to give{search.trim() ? ' match this search' : ' in this branch'}.</li>}
                        {results.map((asset) => {
                            const added = isChosen(asset);
                            return (
                                <li key={asset._id} className="flex items-center justify-between gap-3 px-3 py-2">
                                    <ItemLine asset={asset} />
                                    <div className="flex items-center gap-2 shrink-0">
                                        <StatusChip status={asset.status} />
                                        <button
                                            type="button"
                                            onClick={() => toggle(asset)}
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

                {chosen.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                        {chosen.map((asset) => (
                            <span key={asset._id} className="inline-flex items-center gap-1.5 pl-3 pr-1.5 py-1 rounded-full bg-teal-50 border border-teal-200 text-teal-800 text-xs font-bold">
                                <span className="font-mono">{asset.serialNumber}</span>
                                <button type="button" onClick={() => toggle(asset)} aria-label={`Remove ${asset.serialNumber}`} className="p-0.5 rounded-full hover:bg-teal-100">
                                    <MdClose size={13} />
                                </button>
                            </span>
                        ))}
                    </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                        <label className={labelClass}>Assign Date *</label>
                        <DateInput type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} className={inputClass} />
                    </div>
                    <div>
                        <label className={labelClass}>Remarks</label>
                        <input type="text" value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Optional" className={inputClass} />
                    </div>
                </div>
            </div>
        </Modal>
    );
};

/** Edit: the Asset No, and optionally a new holder from the user's circle (the item's history keeps both). */
const EditAssetModal = ({ view, asset, circle, onClose, onSaved }) => {
    const [assetNo, setAssetNo] = useState(asset.assetNo || '');
    const [toEmployeeId, setToEmployeeId] = useState('');
    const [date, setDate] = useState(today());
    const [remarks, setRemarks] = useState('');
    const [requestId] = useState(newRequestId);
    const [saving, setSaving] = useState(false);

    const targets = circle
        .filter((person) => String(person._id) !== String(asset.holder?._id))
        .map((person) => ({ value: String(person._id), label: `${personLabel(person)} (${RELATION_LABELS[person.relation] || person.relation})` }));
    const handingOver = Boolean(toEmployeeId);

    const save = async () => {
        setSaving(true);
        try {
            const res = await ownAssetService.update(view.key, asset._id, {
                assetNo,
                ...(handingOver ? { toEmployeeId, transferDate: date, remarks, requestId } : {}),
            });
            const changed = res.data?.changed || [];
            if (!changed.length) {
                toast.info('Nothing was changed.');
            } else {
                dropCachedAssets();
                toast.success(res.data?.handedTo ? `${asset.serialNumber} handed over to ${res.data.handedTo.name}` : `${asset.serialNumber} saved`);
            }
            onSaved();
        } catch (err) {
            toast.error(errorText(err, 'Could not save the asset'));
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal
            isOpen
            onClose={() => (saving ? null : onClose())}
            title="Edit asset"
            maxWidth="max-w-lg"
            footer={<ModalButtons onCancel={onClose} onSave={save} saving={saving} saveLabel={handingOver ? 'Save & hand over' : 'Save'} savingLabel="Saving..." />}
        >
            <div className="space-y-4">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <ItemLine asset={asset} />
                    <p className="mt-1 text-xs text-slate-500">Now with <span className="font-bold text-slate-700">{personLabel(asset.holder) || 'this person'}</span></p>
                </div>
                <div>
                    <label className={labelClass}>Asset No</label>
                    <input type="text" value={assetNo} maxLength={100} onChange={(e) => setAssetNo(e.target.value)} placeholder="Your own asset number (optional)" className={inputClass} />
                </div>
                <div>
                    <label className={labelClass}>Hand over to</label>
                    <SearchableSelect
                        options={[{ value: '', label: `Keep with ${asset.holder?.name || 'the current person'}` }, ...targets]}
                        value={toEmployeeId}
                        onChange={(value) => setToEmployeeId(value || '')}
                        placeholder={`Keep with ${asset.holder?.name || 'the current person'}`}
                        noResultsText="Nobody matches"
                    />
                    <p className="mt-1 text-xs text-slate-500">You, your manager or a person of your team.</p>
                </div>
                {handingOver && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className={labelClass}>Hand-over Date *</label>
                            <DateInput type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} className={inputClass} />
                        </div>
                        <div>
                            <label className={labelClass}>Remarks</label>
                            <input type="text" value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Optional" className={inputClass} />
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    );
};

/** Take back: the item leaves its holder and is In Stock with nobody; its history keeps the holder. */
const TakeBackModal = ({ view, asset, onClose, onDone }) => {
    const [date, setDate] = useState(today());
    const [remarks, setRemarks] = useState('');
    const [saving, setSaving] = useState(false);

    const save = async () => {
        setSaving(true);
        try {
            const res = await ownAssetService.takeBack(view.key, asset._id, { returnDate: date, remarks });
            dropCachedAssets();
            toast.success(res.data?.message || `${asset.serialNumber} taken back`);
            onDone();
        } catch (err) {
            toast.error(errorText(err, 'Could not take the asset back'));
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal
            isOpen
            onClose={() => (saving ? null : onClose())}
            title="Take back asset"
            maxWidth="max-w-lg"
            footer={<ModalButtons onCancel={onClose} onSave={save} saving={saving} saveLabel="Take back" savingLabel="Taking back..." danger />}
        >
            <div className="space-y-4">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <ItemLine asset={asset} />
                    <p className="mt-1 text-xs text-slate-500">Now with <span className="font-bold text-slate-700">{personLabel(asset.holder) || 'this person'}</span></p>
                </div>
                <p className="text-sm text-slate-600">
                    The asset leaves {asset.holder?.name || 'this person'} and becomes <span className="font-bold">In Stock</span> with nobody, so it can be given to someone else.
                    Its Asset Log keeps {asset.holder?.name || 'this person'}.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                        <label className={labelClass}>Return Date *</label>
                        <DateInput type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} className={inputClass} />
                    </div>
                    <div>
                        <label className={labelClass}>Remarks</label>
                        <input type="text" value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Optional, e.g. employee left" className={inputClass} />
                    </div>
                </div>
            </div>
        </Modal>
    );
};

const OwnAssets = ({ view: viewKey = 'mine' }) => {
    const view = VIEWS[viewKey] || VIEWS.mine;
    const navigate = useNavigate();
    const { can, hasAccess } = useAuth();
    const canAdd = can(view.permissionKey, 'create');
    const canEdit = can(view.permissionKey, 'modify');
    const canTakeBack = can(view.permissionKey, 'delete');
    const canRaiseTicket = can('csm_tickets', 'create');
    const tabs = VIEW_ORDER.map((key) => VIEWS[key]).filter((item) => hasAccess(item.permissionKey));

    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');
    const [personFilter, setPersonFilter] = useState('');
    const [adding, setAdding] = useState(false);
    const [editFor, setEditFor] = useState(null);
    const [takeBackFor, setTakeBackFor] = useState(null);
    const [logFor, setLogFor] = useState(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const res = await ownAssetService.list(view.key);
            setResult(res.data || null);
        } catch (err) {
            setResult(null);
            setError(errorText(err, 'Could not load the assets'));
        } finally {
            setLoading(false);
        }
    }, [view.key]);

    // Each list is its own route (keyed in App.jsx), so a new list starts with its own search.
    useEffect(() => { load(); }, [load]);

    const holders = useMemo(() => result?.holders || [], [result]);
    const items = useMemo(() => result?.data || [], [result]);
    const shown = useMemo(() => {
        const text = search.trim().toLowerCase();
        return items.filter((asset) => {
            if (personFilter && String(asset.holder?._id) !== personFilter) return false;
            if (!text) return true;
            return [asset.serialNumber, asset.assetNo, asset.productName, asset.productCode, asset.branchName, asset.holder?.name, asset.holder?.employeeId]
                .some((value) => String(value || '').toLowerCase().includes(text));
        });
    }, [items, search, personFilter]);

    const isTeam = view.key === 'team';
    const singleHolder = !isTeam ? holders[0] : null;
    const raiseTicket = (asset) => navigate(`/csm/tickets?raiseFor=${encodeURIComponent(asset.serialNumber)}`);
    const afterChange = () => {
        setAdding(false);
        setEditFor(null);
        setTakeBackFor(null);
        load();
    };

    const actionsOf = (asset) => (
        <div className="flex items-center gap-1.5">
            <button type="button" onClick={() => setLogFor(asset)} className={iconButton} title="View" aria-label={`View ${asset.serialNumber}`}>
                <MdVisibility size={17} />
            </button>
            {canEdit && (
                <button type="button" onClick={() => setEditFor(asset)} className={iconButton} title="Edit" aria-label={`Edit ${asset.serialNumber}`}>
                    <MdEdit size={17} />
                </button>
            )}
            {canTakeBack && (
                <button type="button" onClick={() => setTakeBackFor(asset)} className={dangerButton} title="Take back" aria-label={`Take back ${asset.serialNumber}`}>
                    <MdAssignmentReturn size={17} />
                </button>
            )}
            {canRaiseTicket && (
                <button type="button" onClick={() => raiseTicket(asset)} className={iconButton} title="Raise ticket" aria-label={`Raise ticket for ${asset.serialNumber}`}>
                    <MdConfirmationNumber size={17} />
                </button>
            )}
        </div>
    );

    const emptyText = result?.message
        || (items.length ? 'No assets match this search.' : `No company assets are assigned ${view.key === 'mine' ? 'to you' : view.key === 'manager' ? 'to your manager' : 'to your team'} yet.`);

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div className="min-w-0">
                    <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">{view.title}</h1>
                    <p className="mt-1 text-sm text-slate-500">
                        {view.note}
                        {singleHolder && <> <span className="font-bold text-slate-700">{personLabel(singleHolder)}</span>{singleHolder.designation ? ` · ${singleHolder.designation}` : ''}</>}
                    </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <button type="button" onClick={load} disabled={loading} className="inline-flex items-center gap-2 px-4 py-3 rounded-2xl border border-slate-200 bg-white text-slate-600 font-black uppercase text-[10px] tracking-widest hover:bg-slate-50 disabled:opacity-60" title="Reload">
                        <MdRefresh size={16} /> Reload
                    </button>
                    {canAdd && holders.length > 0 && (
                        <button type="button" onClick={() => setAdding(true)} className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-primary-600 hover:bg-primary-700 text-white font-black uppercase text-[10px] tracking-widest shadow-lg shadow-primary-600/20">
                            <MdAdd size={18} /> Add asset
                        </button>
                    )}
                </div>
            </div>

            <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
                {tabs.length > 1 && (
                    <div className="flex gap-1 overflow-x-auto border-b border-slate-100 px-2 sm:px-4 pt-2 sm:pt-4">
                        {tabs.map((item) => (
                            <NavLink
                                key={item.key}
                                to={item.path}
                                className={`shrink-0 whitespace-nowrap px-3 sm:px-5 py-3 text-xs font-black uppercase tracking-widest border-b-2 transition-all ${item.key === view.key ? 'border-primary-600 text-primary-600' : 'border-transparent text-slate-400 hover:text-slate-700'}`}
                            >
                                {item.title}
                            </NavLink>
                        ))}
                    </div>
                )}

                <div className="p-4 sm:p-6 space-y-4">
                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="relative flex-1">
                            <MdSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder={isTeam ? 'Search serial no, Asset No, product or person...' : 'Search serial no, Asset No or product...'}
                                className={`${inputClass} pl-9`}
                            />
                        </div>
                        {isTeam && holders.length > 1 && (
                            <div className="sm:w-72">
                                <SearchableSelect
                                    options={[{ value: '', label: 'Everyone in my team' }, ...holders.map((person) => ({ value: String(person._id), label: personLabel(person) }))]}
                                    value={personFilter}
                                    onChange={(value) => setPersonFilter(value || '')}
                                    placeholder="Everyone in my team"
                                    noResultsText="Nobody matches"
                                />
                            </div>
                        )}
                    </div>

                    {!loading && !error && (
                        <p className="text-xs font-semibold text-slate-500">
                            {shown.length} {shown.length === 1 ? 'asset' : 'assets'}
                            {isTeam && holders.length ? ` · ${holders.length} ${holders.length === 1 ? 'person' : 'people'} in your team` : ''}
                        </p>
                    )}

                    {error && <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">{error}</p>}
                    {loading && <p className="text-sm text-slate-400">Loading...</p>}

                    {!loading && !error && (
                        <>
                            <div className="serial-desktop-table overflow-x-auto border border-slate-100 rounded-2xl">
                                <table className="w-full text-left">
                                    <thead className="bg-slate-50/60 border-b border-slate-100">
                                        <tr>
                                            <th className={thClass}>Serial No.</th>
                                            <th className={thClass}>Asset</th>
                                            {isTeam && <th className={thClass}>User</th>}
                                            <th className={thClass}>Branch</th>
                                            <th className={thClass}>Status</th>
                                            <th className={thClass}>Since</th>
                                            <th className={thClass}>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {shown.length === 0 && (
                                            <tr>
                                                <td colSpan={isTeam ? 7 : 6} className="p-10 text-center text-sm text-slate-500">
                                                    {result?.message && <MdInfoOutline className="inline mr-1.5 -mt-0.5 text-slate-400" size={16} />}
                                                    {emptyText}
                                                </td>
                                            </tr>
                                        )}
                                        {shown.map((asset) => (
                                            <tr key={asset._id} className="hover:bg-slate-50/60">
                                                <td className="p-4 align-top">
                                                    <p className="text-sm font-black text-slate-900 font-mono whitespace-nowrap">{asset.serialNumber}</p>
                                                    {asset.assetNo && <p className="text-[11px] font-bold text-slate-400">Asset No {asset.assetNo}</p>}
                                                </td>
                                                <td className="p-4 align-top max-w-xs">
                                                    <p className="text-sm font-semibold text-slate-800 break-words">{asset.productName || '-'}</p>
                                                    {asset.productCode && <p className="text-[11px] text-slate-400 font-mono">{asset.productCode}</p>}
                                                </td>
                                                {isTeam && (
                                                    <td className="p-4 align-top">
                                                        <p className="text-sm font-semibold text-slate-800 whitespace-nowrap">{asset.holder?.name || '-'}</p>
                                                        <p className="text-[11px] text-slate-400">
                                                            {[asset.holder?.employeeId, asset.holder?.status && asset.holder.status !== 'Active' ? asset.holder.status : ''].filter(Boolean).join(' · ')}
                                                        </p>
                                                    </td>
                                                )}
                                                <td className="p-4 align-top text-sm text-slate-600 whitespace-nowrap">{asset.branchName || '-'}</td>
                                                <td className="p-4 align-top"><StatusChip status={asset.status} /></td>
                                                <td className="p-4 align-top text-sm text-slate-600 whitespace-nowrap">{formatDate(asset.since)}</td>
                                                <td className="p-4 align-top">{actionsOf(asset)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <MobileCardList>
                                {shown.length === 0 && <MobileEmpty>{emptyText}</MobileEmpty>}
                                {shown.map((asset) => (
                                    <MobileCard key={asset._id}>
                                        <MobileCardHead title={asset.serialNumber} subtitle={asset.assetNo ? `Asset No ${asset.assetNo}` : ''} aside={<StatusChip status={asset.status} />} />
                                        <MobileFields>
                                            <MobileField label="Asset" wide>{[asset.productName, asset.productCode].filter(Boolean).join(' · ') || '-'}</MobileField>
                                            {isTeam && <MobileField label="User" wide>{personLabel(asset.holder) || '-'}</MobileField>}
                                            <MobileField label="Branch">{asset.branchName || '-'}</MobileField>
                                            <MobileField label="Since">{formatDate(asset.since)}</MobileField>
                                        </MobileFields>
                                        <MobileCardActions>{actionsOf(asset)}</MobileCardActions>
                                    </MobileCard>
                                ))}
                            </MobileCardList>
                        </>
                    )}
                </div>
            </div>

            {adding && <AddAssetModal view={view} holders={holders} onClose={() => setAdding(false)} onAdded={afterChange} />}
            {editFor && <EditAssetModal view={view} asset={editFor} circle={result?.circle || []} onClose={() => setEditFor(null)} onSaved={afterChange} />}
            {takeBackFor && <TakeBackModal view={view} asset={takeBackFor} onClose={() => setTakeBackFor(null)} onDone={afterChange} />}
            {logFor && (
                <AssetLogModal
                    employeeId={logFor.holder?._id}
                    asset={logFor}
                    load={() => ownAssetService.log(view.key, logFor._id)}
                    onClose={() => setLogFor(null)}
                />
            )}
        </div>
    );
};

export default OwnAssets;
