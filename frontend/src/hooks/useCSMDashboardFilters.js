import { useEffect, useMemo, useState } from 'react';
import { branchService } from '../services/api';

/**
 * Branch and date filter state shared by the CSM dashboards. `params` is what the
 * /csm/dashboard and /csm/visits endpoints take, and only changes when a filter does.
 */
export const useCSMDashboardFilters = () => {
    const [branches, setBranches] = useState([]);
    const [selectedBranch, setSelectedBranch] = useState('');
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
        setSelectedBranch('');
        setQuickRange('');
        setCustomMode(false);
        setStartDay('');
        setEndDay('');
        setSelectedMonth(new Date().getMonth() + 1);
        setSelectedYear(new Date().getFullYear());
    };

    return {
        branches,
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
