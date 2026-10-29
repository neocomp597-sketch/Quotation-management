import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { MdSave, MdFilterAlt, MdSearch, MdWarningAmber } from 'react-icons/md';
import { userService } from '../services/api';

const MGR_LEVELS = [
    { type: 'MGR1', label: 'MGR 1' },
    { type: 'MGR2', label: 'MGR 2' },
    { type: 'MGR3', label: 'MGR 3' },
    { type: 'MGR4', label: 'MGR 4' },
    { type: 'MGR5', label: 'MGR 5' }
];

// A level with more values than this gets a search box.
const SEARCH_FROM = 12;

const mgrLabel = (mgr) => [mgr.code, mgr.description].filter(Boolean).join(' - ');

const sameIds = (a, b) => a.length === b.length && a.every((id) => b.includes(id));

const isMgrUnrestrictedRole = (role) => ['admin', 'super_admin', 'superadmin'].includes(String(role || '').toLowerCase());

/**
 * MGR Access of one user (Authorization > Team Users): the MGR values their Invoice Bulk Upload
 * data is limited to, on any of MGR 1-5. None ticked = every value. Within one MGR any ticked
 * value is enough; ticks on two MGRs must both match. Admins always see everything; the server
 * applies the limit (backend/utils/mgrAccess.js), so it holds for exports and direct API calls too.
 *
 * `options` is every value of the Product MGR Master (all five types).
 */
const UserMgrAccess = ({ user, options, params, disabled, onSaved }) => {
    const optionIds = useMemo(() => new Set(options.map((mgr) => String(mgr._id))), [options]);
    const savedAll = useMemo(() => (user.mgrAccess || []).map(String), [user.mgrAccess]);
    // Saved values deleted from the MGR Master since cannot be shown; they are dropped on the next save.
    const saved = useMemo(() => savedAll.filter((id) => optionIds.has(id)), [savedAll, optionIds]);
    const removedCount = options.length ? savedAll.length - saved.length : 0;

    const [selected, setSelected] = useState(saved);
    const [level, setLevel] = useState('MGR1');
    const [search, setSearch] = useState('');
    const [saving, setSaving] = useState(false);
    useEffect(() => setSelected(saved), [saved]);

    const byLevel = useMemo(() => Object.fromEntries(MGR_LEVELS.map(({ type }) => [
        type,
        options.filter((mgr) => mgr.mgrType === type)
    ])), [options]);
    const levelOf = useMemo(() => Object.fromEntries(options.map((mgr) => [String(mgr._id), mgr.mgrType])), [options]);
    const tickedOn = (type) => selected.filter((id) => levelOf[id] === type).length;

    const isAdminUser = isMgrUnrestrictedRole(user.role);
    const changed = !sameIds(selected, saved);
    const dirty = changed || removedCount > 0;
    const locked = disabled || saving || isAdminUser;

    const term = search.trim().toLowerCase();
    const levelValues = byLevel[level] || [];
    const shown = term ? levelValues.filter((mgr) => mgrLabel(mgr).toLowerCase().includes(term)) : levelValues;

    const toggle = (id) => setSelected((prev) => (prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id]));

    const save = async () => {
        setSaving(true);
        try {
            const res = await userService.updateMgrAccess(user._id, selected, params);
            onSaved(res.data?.mgrAccess || selected);
            toast.success(`MGR access of ${user.name} saved`);
        } catch (err) {
            toast.error(err?.response?.data?.message || 'Failed to save MGR access');
        } finally {
            setSaving(false);
        }
    };

    // "MGR 1: IND, IT · MGR 2: OTH" of the ticked values, for the summary line.
    const summary = MGR_LEVELS
        .map(({ type, label }) => {
            const codes = (byLevel[type] || []).filter((mgr) => selected.includes(String(mgr._id))).map((mgr) => mgr.code);
            return codes.length ? `${label}: ${codes.join(', ')}` : '';
        })
        .filter(Boolean)
        .join(' · ');

    const hint = isAdminUser
        ? 'Admins see every MGR value; MGR access does not apply to them.'
        : selected.length
            ? `Sees only the serial numbers whose product has ${summary} in the list, cards, search, filters, export, return history and details. Within one MGR any ticked value counts; ticks on two MGRs must both match.`
            : 'Nothing ticked: sees every MGR value. Tick values to limit what this user sees.';

    return (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="min-w-0">
                    <div className="flex items-center gap-2">
                        <MdFilterAlt className="text-primary-600 dark:text-primary-400" size={16} />
                        <h5 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                            MGR Access · Invoice Bulk Upload
                        </h5>
                    </div>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">{hint}</p>
                </div>
                {dirty && !isAdminUser && (
                    <div className="flex shrink-0 gap-2">
                        {changed && (
                            <button
                                type="button"
                                onClick={() => setSelected(saved)}
                                disabled={saving}
                                className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 transition-colors"
                            >
                                Discard
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={save}
                            disabled={locked}
                            className="px-3 py-1.5 bg-primary-600 text-white rounded-xl text-xs font-bold hover:bg-primary-700 disabled:opacity-60 transition-colors flex items-center gap-1.5"
                        >
                            <MdSave size={14} /> {saving ? 'Saving...' : 'Save MGR Access'}
                        </button>
                    </div>
                )}
            </div>

            {removedCount > 0 && !isAdminUser && (
                <div className="flex items-start gap-2 p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-[11px] font-semibold text-amber-800 dark:text-amber-300">
                    <MdWarningAmber size={16} className="shrink-0 mt-px" />
                    <span>
                        {removedCount === 1 ? '1 MGR value' : `${removedCount} MGR values`} of this user {removedCount === 1 ? 'was' : 'were'} deleted from the Product MGR Master.
                        {saved.length
                            ? ' Save to drop it from the access.'
                            : ' Until you save, this user sees no Invoice Bulk Upload data. Tick values and save, or save with nothing ticked to give access to every value.'}
                    </span>
                </div>
            )}

            {options.length ? (
                <>
                    <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="MGR level">
                        {MGR_LEVELS.map(({ type, label }) => {
                            const count = tickedOn(type);
                            const active = level === type;
                            return (
                                <button
                                    key={type}
                                    type="button"
                                    role="tab"
                                    aria-selected={active}
                                    onClick={() => { setLevel(type); setSearch(''); }}
                                    className={`px-3 py-1 rounded-lg text-[11px] font-black uppercase tracking-wider border transition-colors flex items-center gap-1.5 ${active
                                        ? 'bg-primary-600 border-primary-600 text-white'
                                        : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-primary-300'}`}
                                >
                                    {label}
                                    {count > 0 && (
                                        <span className={`px-1.5 rounded-full text-[10px] ${active ? 'bg-white/25 text-white' : 'bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300'}`}>{count}</span>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {levelValues.length > SEARCH_FROM && (
                        <div className="relative max-w-xs">
                            <MdSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder={`Search ${MGR_LEVELS.find((item) => item.type === level)?.label} values...`}
                                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 outline-none focus:border-primary-500"
                            />
                        </div>
                    )}

                    {shown.length ? (
                        <div className="flex flex-wrap gap-2 max-h-56 overflow-y-auto">
                            {shown.map((mgr) => {
                                const id = String(mgr._id);
                                const checked = !isAdminUser && selected.includes(id);
                                return (
                                    <label
                                        key={id}
                                        className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold transition-colors ${locked ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'} ${checked
                                            ? 'bg-primary-50 dark:bg-primary-950/60 border-primary-300 dark:border-primary-700 text-primary-700 dark:text-primary-300'
                                            : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'}`}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={checked}
                                            disabled={locked}
                                            onChange={() => toggle(id)}
                                            className="accent-primary-600"
                                        />
                                        {mgrLabel(mgr)}
                                        {mgr.status === 'Inactive' && <span className="text-[10px] font-semibold text-slate-400">(inactive)</span>}
                                    </label>
                                );
                            })}
                        </div>
                    ) : (
                        <p className="text-xs text-slate-400">
                            {levelValues.length ? 'No value matches the search.' : `No ${MGR_LEVELS.find((item) => item.type === level)?.label} values in the Product MGR Master yet.`}
                        </p>
                    )}
                </>
            ) : (
                <p className="text-xs text-slate-400">No values in the Product MGR Master yet.</p>
            )}
        </div>
    );
};

export default UserMgrAccess;
