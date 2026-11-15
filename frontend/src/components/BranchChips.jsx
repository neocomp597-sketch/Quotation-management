import React, { useEffect, useState } from 'react';
import { MdHome, MdCheck } from 'react-icons/md';
import { toast } from 'react-toastify';
import { authService } from '../services/api';
import { useAuth } from '../context/AuthContext';

const idOf = (value) => String(value?._id || value || '');

const chipClass = (isSelected, isBusy) => `flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold border transition-all ${
    isSelected
        ? 'bg-teal-50 text-teal-700 border-teal-500 shadow-sm'
        : 'bg-white text-slate-700 border-slate-200 shadow-sm hover:border-teal-400 hover:text-teal-700 cursor-pointer'
} ${isBusy ? 'opacity-60 animate-pulse' : ''} disabled:cursor-wait`;

/**
 * The branches this user was given, home branch first, as buttons (Invoice Bulk Upload, Serial No
 * Transfer). Shows nothing until the branches are loaded, or when the user has none.
 *
 * Default: picking a branch makes it the working branch, as the header switcher does; it is checked
 * and saved on the server, and the page then reloads in that branch (see Layout).
 *
 * `multiple`: the buttons choose which branches the screen shows, several at a time, without
 * changing the working branch. `selected` holds their ids and `onChange` receives the new list; at
 * least one stays chosen. "All branches" chooses every one, and pressed again goes back to the
 * working branch. `onLoaded` receives the user's branches once loaded.
 */
const BranchChips = ({ className = 'flex flex-wrap items-center gap-2', multiple = false, selected = [], onChange, onLoaded }) => {
    const { activeBranchId, setActiveBranch } = useAuth();
    const [branches, setBranches] = useState([]);
    const [primaryBranchId, setPrimaryBranchId] = useState(null);
    const [switchingBranchId, setSwitchingBranchId] = useState(null);

    useEffect(() => {
        let cancelled = false;
        authService.getMyBranches()
            .then((res) => {
                if (cancelled) return;
                const list = Array.isArray(res.data?.branches) ? res.data.branches : [];
                setBranches(list);
                setPrimaryBranchId(res.data?.primaryBranchId ? String(res.data.primaryBranchId) : null);
                if (onLoaded) onLoaded(list);
            })
            .catch((err) => console.warn('Could not load your branches:', err));
        return () => { cancelled = true; };
        // Loaded once per screen; onLoaded is read at that moment.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const switchTo = async (branch) => {
        const id = idOf(branch);
        if (!id || id === String(activeBranchId || '') || switchingBranchId) return;
        setSwitchingBranchId(id);
        try {
            await setActiveBranch(branch);
            toast.info(`Showing ${branch.name} branch data`);
        } catch (err) {
            toast.error(err.response?.data?.message || `Could not switch to ${branch.name}`);
        } finally {
            setSwitchingBranchId(null);
        }
    };

    const toggle = (branch) => {
        const id = idOf(branch);
        const chosen = selected.map(String);
        if (chosen.includes(id)) {
            if (chosen.length > 1) onChange(chosen.filter((value) => value !== id));
        } else {
            // Kept in the order of the buttons.
            onChange(branches.map(idOf).filter((value) => value === id || chosen.includes(value)));
        }
    };

    if (!branches.length) return null;
    const chosen = new Set(selected.map(String));
    const allChosen = multiple && branches.every((branch) => chosen.has(idOf(branch)));
    return (
        <div className={className} role="group" aria-label="Branches">
            {multiple && branches.length > 1 && (
                <button
                    type="button"
                    onClick={() => onChange(allChosen ? [String(activeBranchId || idOf(branches[0]))] : branches.map(idOf))}
                    aria-pressed={allChosen}
                    title={allChosen ? 'Show only the branch at the top of the screen' : 'Show all your branches together'}
                    className={chipClass(allChosen, false)}
                >
                    {allChosen && <MdCheck size={15} className="shrink-0" aria-hidden="true" />}
                    <span>All branches</span>
                </button>
            )}
            {branches.map((branch) => {
                const id = idOf(branch);
                const isSelected = multiple ? chosen.has(id) : id === String(activeBranchId || '');
                const isPrimary = id === primaryBranchId;
                return (
                    <button
                        key={id}
                        type="button"
                        onClick={() => (multiple ? toggle(branch) : switchTo(branch))}
                        disabled={!multiple && Boolean(switchingBranchId)}
                        aria-pressed={isSelected}
                        title={`${isPrimary ? 'Primary branch: ' : ''}${branch.name}${isSelected ? (multiple ? ' (shown; press to leave out)' : ' (showing)') : (multiple ? ' (press to show too)' : '')}`}
                        className={`${chipClass(isSelected, id === switchingBranchId)} ${!multiple && isSelected ? 'cursor-default' : ''}`}
                    >
                        {multiple && isSelected && <MdCheck size={15} className="shrink-0" aria-hidden="true" />}
                        {isPrimary && <MdHome size={15} className="shrink-0" aria-label="Primary branch" />}
                        <span>{branch.name}</span>
                    </button>
                );
            })}
        </div>
    );
};

export default BranchChips;
