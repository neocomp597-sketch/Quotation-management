import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { MdBusiness, MdSave, MdWarningAmber } from 'react-icons/md';
import { userService } from '../services/api';
import { userBranchIds } from '../utils/userBranches';

const sameIds = (a, b) => a.length === b.length && a.every((id) => b.includes(id));

/**
 * Branch Access of one user (Authorization > Team Users): the branches they may switch between from
 * the top bar. Staff with none cannot log in, so at least one must stay ticked. Admins work in every
 * branch and never see this panel. `options` is every branch of the company.
 */
const UserBranchAccess = ({ user, options, params, disabled, onSaved }) => {
    const { assignedBranches, branchId } = user;
    const saved = useMemo(() => userBranchIds({ assignedBranches, branchId }), [assignedBranches, branchId]);

    const [selected, setSelected] = useState(saved);
    const [saving, setSaving] = useState(false);
    useEffect(() => setSelected(saved), [saved]);

    // An inactive branch is only offered to the users who already have it.
    const shown = options.filter((branch) => branch.status !== 'Inactive' || saved.includes(String(branch._id)));
    const dirty = !sameIds(selected, saved);
    const locked = disabled || saving;

    const toggle = (id) => setSelected((prev) => (prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id]));

    const save = async () => {
        setSaving(true);
        try {
            const res = await userService.updateBranches(user._id, selected, params);
            onSaved({ branchId: res.data?.branchId, assignedBranches: res.data?.assignedBranches || selected });
            toast.success(`Branch access of ${user.name} saved`);
        } catch (err) {
            toast.error(err?.response?.data?.message || 'Failed to save branch access');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="min-w-0">
                    <div className="flex items-center gap-2">
                        <MdBusiness className="text-primary-600 dark:text-primary-400" size={16} />
                        <h5 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">Branch Access</h5>
                    </div>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                        Can switch between the ticked branches from the top bar and sees only the data of the selected one. Also updates their Employee Master record, if they have one.
                    </p>
                </div>
                {dirty && (
                    <div className="flex shrink-0 gap-2">
                        <button
                            type="button"
                            onClick={() => setSelected(saved)}
                            disabled={saving}
                            className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 transition-colors"
                        >
                            Discard
                        </button>
                        <button
                            type="button"
                            onClick={save}
                            disabled={locked || selected.length === 0}
                            title={selected.length === 0 ? 'Tick at least one branch' : undefined}
                            className="px-3 py-1.5 bg-primary-600 text-white rounded-xl text-xs font-bold hover:bg-primary-700 disabled:opacity-60 transition-colors flex items-center gap-1.5"
                        >
                            <MdSave size={14} /> {saving ? 'Saving...' : 'Save Branch Access'}
                        </button>
                    </div>
                )}
            </div>

            {saved.length === 0 && (
                <div className="flex items-start gap-2 p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-[11px] font-semibold text-amber-800 dark:text-amber-300">
                    <MdWarningAmber size={16} className="shrink-0 mt-px" />
                    <span>No branch is assigned, so this user cannot log in. Tick at least one branch and save.</span>
                </div>
            )}

            {shown.length ? (
                <div className="flex flex-wrap gap-2 max-h-56 overflow-y-auto">
                    {shown.map((branch) => {
                        const id = String(branch._id);
                        const checked = selected.includes(id);
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
                                {branch.name}
                                {branch.status === 'Inactive' && <span className="text-[10px] font-semibold text-slate-400">(inactive)</span>}
                            </label>
                        );
                    })}
                </div>
            ) : (
                <p className="text-xs text-slate-400">No branches found.</p>
            )}
        </div>
    );
};

export default UserBranchAccess;
