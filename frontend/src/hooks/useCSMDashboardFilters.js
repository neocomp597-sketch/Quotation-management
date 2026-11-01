import { useEffect, useMemo, useState } from 'react';
import { branchService } from '../services/api';
import { useAuth } from '../context/AuthContext';

/**
 * Branch and date filter state shared by the CSM dashboards. `params` is what the
 * /csm/dashboard and /csm/visits endpoints take, and only changes when a filter does.
 * The branch starts on the one selected in the header (switching it remounts the page, see
 * Layout); '' is "All My Branches", every branch the user is authorized for.
 */
export const useCSMDashboardFilters = () => {
    const { activeBranchId, activeBranch } = useAuth();
    const defaultBranch = activeBranchId || '';
    const [branches, setBranches] = useState([]);
    const [selectedBranch, setSelectedBranch] = useState(defaultBranch);
    const [quickRange, setQuickRange] = useState('');
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [startDay, setStartDay] = useState('');
    const [endDay, setEndDay] = useState('');
    const [customMode, setCustomMode] = useState(false);

    useEffect(() => {
        branchService.getAll()
            .then((res) => {
                const branchList = res.data?.data || res.data || [];
                setBranches(Array.isArray(branchList) ? branchList : []);
            })
            .catch((err) => console.error('Failed to load branches for filter:', err));
    }, []);

    const params = useMemo(() => {
        const next = {};
        if (selectedBranch) next.branchId = selectedBranch;
        else next.myBranches = 'true';

        if (quickRange) {
            next.quickRange = quickRange;
        } else if (customMode) {
            next.month = selectedMonth;
            next.year = selectedYear;
            if (startDay) next.startDay = startDay;
            if (endDay) next.endDay = endDay;
        }
        return next;
    }, [selectedBranch, quickRange, customMode, selectedMonth, selectedYear, startDay, endDay]);

    const reset = () => {
        setSelectedBranch(defaultBranch);
        setQuickRange('');
        setCustomMode(false);
        setStartDay('');
        setEndDay('');
        setSelectedMonth(new Date().getMonth() + 1);
        setSelectedYear(new Date().getFullYear());
    };

    return {
        branches,
        defaultBranch,
        activeBranchName: activeBranch?.name || '',
        selectedBranch, setSelectedBranch,
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
