import { useEffect, useMemo, useState } from 'react';
import { csmService } from '../services/api';
import { useAuth } from '../context/AuthContext';

const analyticsBranchKey = (user) => `csm_analytics_branch:${user?._id || user?.id || ''}`;

const readAnalyticsBranch = (user) => {
    try {
        return sessionStorage.getItem(analyticsBranchKey(user)) || '';
    } catch {
        return '';
    }
};

/**
 * The Branch filter of Customer Service Analytics, kept for this browser tab; '' is All My Branches.
 * The header's branch switcher sets it too: someone who picks a branch at the top sees that branch
 * on Analytics, until they choose otherwise in the filter.
 */
export const rememberAnalyticsBranch = (user, branchId) => {
    try {
        sessionStorage.setItem(analyticsBranchKey(user), branchId ? String(branchId) : '');
    } catch {
        // Storage unavailable (private mode): the filter starts on All My Branches each visit
    }
};

/**
 * Filter state shared by the CSM dashboards. `params` is what the /csm/dashboard and /csm/visits
 * endpoints take, and only changes when a filter does. The branch is the one selected in the header,
 * applied by the server (switching it remounts the page, see Layout), except with `branchAndMgr`
 * (Customer Service Analytics): that page also offers MGR 1 and its own Branch filter, starting on
 * all of the user's branches.
 */
export const useCSMDashboardFilters = ({ branchAndMgr = false } = {}) => {
    const { user, activeBranchId, activeBranch, assignedBranches } = useAuth();
    const [options, setOptions] = useState({ branches: [], mgr1: [] });
    const [selectedBranch, setSelectedBranchState] = useState(() => (branchAndMgr ? readAnalyticsBranch(user) : ''));
    const [selectedMgr1, setSelectedMgr1] = useState('');
    const [quickRange, setQuickRange] = useState('');
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [startDay, setStartDay] = useState('');
    const [endDay, setEndDay] = useState('');
    const [customMode, setCustomMode] = useState(false);

    useEffect(() => {
        if (!branchAndMgr) return undefined;
        let cancelled = false;
        csmService.getDashboardFilters()
            .then((res) => {
                if (cancelled) return;
                const branches = res.data?.branches || [];
                setOptions({ branches, mgr1: res.data?.mgr1 || [] });
                // A remembered branch the user no longer has
                setSelectedBranchState((current) => (current && !branches.some((branch) => String(branch._id) === current) ? '' : current));
            })
            .catch((error) => console.error('Failed to load the dashboard filters:', error));
        return () => { cancelled = true; };
    }, [branchAndMgr]);

    const setSelectedBranch = (branchId) => {
        setSelectedBranchState(branchId);
        rememberAnalyticsBranch(user, branchId);
    };

    const headerBranchName = activeBranch?.name
        || assignedBranches.find((branch) => String(branch?._id || branch?.id) === String(activeBranchId))?.name
        || 'Selected Branch';
    const filterBranchName = selectedBranch
        ? options.branches.find((branch) => String(branch._id) === selectedBranch)?.name || 'Selected Branch'
        : options.branches.length === 1 ? options.branches[0].name : 'All My Branches';
    const branchName = branchAndMgr ? filterBranchName : headerBranchName;
    const mgr1 = options.mgr1.find((value) => String(value._id) === selectedMgr1);
    const mgr1Name = mgr1 ? (mgr1.description && mgr1.description !== mgr1.code ? `${mgr1.code} - ${mgr1.description}` : mgr1.code) : '';

    const params = useMemo(() => {
        const next = {};
        if (branchAndMgr) {
            next.branchView = selectedBranch || 'all';
            if (selectedMgr1) next.mgr1 = selectedMgr1;
        }

        if (quickRange) {
            next.quickRange = quickRange;
        } else if (customMode) {
            next.month = selectedMonth;
            next.year = selectedYear;
            if (startDay) next.startDay = startDay;
            if (endDay) next.endDay = endDay;
        }
        return next;
    }, [branchAndMgr, selectedBranch, selectedMgr1, quickRange, customMode, selectedMonth, selectedYear, startDay, endDay]);

    const reset = () => {
        if (branchAndMgr) setSelectedBranch('');
        setSelectedMgr1('');
        setQuickRange('');
        setCustomMode(false);
        setStartDay('');
        setEndDay('');
        setSelectedMonth(new Date().getMonth() + 1);
        setSelectedYear(new Date().getFullYear());
    };

    return {
        branchAndMgr,
        branchOptions: options.branches,
        mgr1Options: options.mgr1,
        branchName,
        mgr1Name,
        selectedBranch, setSelectedBranch,
        selectedMgr1, setSelectedMgr1,
        quickRange, setQuickRange,
        selectedMonth, setSelectedMonth,
        selectedYear, setSelectedYear,
        startDay, setStartDay,
        endDay, setEndDay,
        customMode, setCustomMode,
        params,
        reset
    };
};
