import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { systemUpdateService } from '../services/api';
import { toast } from 'react-toastify';
import { 
    MdFilterList, 
    MdSearch, 
    MdInfoOutline, 
    MdRefresh, 
    MdExpandMore, 
    MdExpandLess, 
    MdLaunch, 
    MdCheckCircle, 
    MdLayers,
    MdNewReleases as IconReleases 
} from 'react-icons/md';

const modulePathMap = {
    'Reports': '/reports',
    'Dashboard': '/dashboard',
    'CRM Core': '/enquiries',
    'Sales': '/sales/dashboard',
    'Enquiry': '/enquiries',
    'Customers': '/customers',
    'Quotation': '/quotations',
    'Payroll': '/payroll/dashboard',
    'Payroll & HR': '/payroll/employees',
    'Employee Master': '/payroll/employees',
    'Org Chart': '/payroll/org-chart',
    'Master Management': '/state-master',
    'State Master': '/state-master',
    'Branch Master': '/master/branches',
    'CSM': '/csm/dashboard',
    'CSM Support': '/csm/tickets',
    'Authentication': '/settings',
    'Tenders': '/tenders',
    'Inventory Management': '/inventory/dashboard',
    'Warehouse Master': '/inventory/warehouses',
    'Stock Matrix': '/inventory/stock',
    'Stock Transfers': '/inventory/transfers',
    'Stock Adjustments': '/inventory/adjustments',
    'Physical Audits': '/inventory/counts'
};

const SearchableSelect = ({ label, options, value, onChange, placeholder = "Type module name..." }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const containerRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const filteredOptions = options.filter(opt =>
        opt.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="relative" ref={containerRef}>
            {label && (
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                    {label}
                </label>
            )}
            <div 
                onClick={() => setIsOpen(!isOpen)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus-within:ring-2 focus-within:ring-primary-500 focus-within:bg-white flex items-center justify-between cursor-pointer transition-all shadow-sm hover:border-slate-300"
            >
                <span className="truncate">{value || 'All'}</span>
                <MdExpandMore size={16} className={`text-slate-400 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </div>

            {isOpen && (
                <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white border border-slate-200 rounded-2xl shadow-xl p-2.5 space-y-2 max-h-64 overflow-hidden animate-fade-in">
                    <div className="relative">
                        <input
                            type="text"
                            autoFocus
                            placeholder={placeholder}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white"
                        />
                        <MdSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    </div>

                    <div className="space-y-0.5 max-h-40 overflow-y-auto custom-scrollbar pr-1">
                        {filteredOptions.length === 0 ? (
                            <div className="px-3 py-2 text-xs text-slate-400 font-semibold">No matching modules</div>
                        ) : (
                            filteredOptions.map((opt) => (
                                <button
                                    key={opt}
                                    type="button"
                                    onClick={() => {
                                        onChange(opt);
                                        setIsOpen(false);
                                        setSearchQuery('');
                                    }}
                                    className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-between ${
                                        value === opt
                                            ? 'bg-primary-600 text-white shadow-sm'
                                            : 'text-slate-700 hover:bg-slate-100'
                                    }`}
                                >
                                    <span>{opt}</span>
                                    {value === opt && <MdCheckCircle size={14} />}
                                </button>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

const SystemUpdates = () => {
    const navigate = useNavigate();
    const [updates, setUpdates] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedModule, setSelectedModule] = useState('All');
    const [submoduleSearch, setSubmoduleSearch] = useState('');
    const [dateSearch, setDateSearch] = useState('');
    const [expandedRow, setExpandedRow] = useState(null);

    const fetchUpdates = async () => {
        setLoading(true);
        try {
            const res = await systemUpdateService.getAll();
            setUpdates(res.data || []);
        } catch (err) {
            console.error('Failed to load system updates history', err);
            toast.error('Failed to load system updates history');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUpdates();
    }, []);

    // Flatten all detailed changes across update packages
    const allChanges = useMemo(() => {
        const list = [];
        updates.forEach(u => {
            if (u.detailedChanges && Array.isArray(u.detailedChanges)) {
                u.detailedChanges.forEach((item, idx) => {
                    list.push({
                        id: `${u._id || 'upd'}-${idx}`,
                        date: item.date || new Date(u.deployedAt || Date.now()).toLocaleDateString('en-GB'),
                        module: item.module || 'System',
                        submodule: item.submodule || 'Release',
                        changes: item.changes || u.message,
                        version: u.version,
                        deployedBy: u.deployedBy || 'System Admin',
                        releaseNotes: u.releaseNotes || []
                    });
                });
            } else if (u.releaseNotes && Array.isArray(u.releaseNotes)) {
                u.releaseNotes.forEach((note, idx) => {
                    list.push({
                        id: `${u._id || 'upd'}-${idx}`,
                        date: new Date(u.deployedAt || Date.now()).toLocaleDateString('en-GB'),
                        module: 'System',
                        submodule: 'Release',
                        changes: note,
                        version: u.version,
                        deployedBy: u.deployedBy || 'System Admin',
                        releaseNotes: u.releaseNotes || []
                    });
                });
            }
        });

        // Sample fallback updates if none in DB yet
        if (list.length === 0) {
            return [
                { id: 'rep_daily1', date: '24.08.2026', module: 'Reports', submodule: 'Daily HR & Manpower Summary', changes: 'Integrated Daily HR Report tab with exact Excel spreadsheet structure from Test (1).xlsx including Staff, Permanent & Contractual Workers, Department breakdown, and side metrics dashboard.', version: 'v5.1.0', deployedBy: 'Super Admin' },
                { id: 'rep1', date: '23.08.2026', module: 'Reports', submodule: 'Dark Mode Standardization', changes: 'Applied dark: Tailwind classes across all tab renderers, container cards, stats cards, and table hover states.', version: 'v5.0.0', deployedBy: 'Super Admin' },
                { id: 'rep2', date: '23.08.2026', module: 'Reports', submodule: 'Recharts Visualizations', changes: 'Configured theme-aware CartesianGrid, XAxis, YAxis, and #0f172a Tooltip popups across all charts.', version: 'v5.0.0', deployedBy: 'Super Admin' },
                { id: 'rep3', date: '23.08.2026', module: 'Reports', submodule: 'Revenue Plan Spreadsheet', changes: 'Implemented REVENUE_PLAN_DARK_COLORS and dynamic dark mode cell fill logic for financial tables and Excel export parity.', version: 'v5.0.0', deployedBy: 'Super Admin' },
                { id: 'enq_auth1', date: '22.08.2026', module: 'CRM Core', submodule: 'Sales Executive Deduplication', changes: 'Deduplicated Sales Executive list entries in Enquiry creation, filtering, and assignment dropdowns.', version: 'v4.9.0', deployedBy: 'Super Admin' },
                { id: 'enq_auth2', date: '22.08.2026', module: 'Authentication', submodule: 'Password Management', changes: 'Restored user password update modal and password reset workflow inside Authorization management panel.', version: 'v4.9.0', deployedBy: 'Super Admin' },
                { id: 'enq_auth3', date: '22.08.2026', module: 'Master Management', submodule: 'GSTIN Validation Standard', changes: 'Expanded GSTIN regex pattern to support all Indian state codes (01-37, 38, 97, 99) across Branch, Contact, Customer, Vendor, and Enquiry forms.', version: 'v4.9.0', deployedBy: 'Super Admin' },
                { id: 'auth1', date: '20.08.2026', module: 'Authentication', submodule: 'Permission Overrides & Dark Mode', changes: 'Added per-user permission overrides, accordion permission UI, Vendor Logins tab, and dark mode audit.', version: 'v4.8.0', deployedBy: 'Super Admin' },
                { id: 'inv2', date: '21.08.2026', module: 'Warehouse Master', submodule: 'Full-Page Form & API Fix', changes: 'Added standalone WarehouseForm component with bin/rack layout editor and resolved API endpoint base URL integration.', version: 'v5.2.0', deployedBy: 'Super Admin' },
                { id: 'inv3', date: '21.08.2026', module: 'Stock Matrix', submodule: 'Product Stock Detail Page', changes: 'Replaced modal popup with full-page ProductStockDetail view showing location-wise and bin-wise breakdowns.', version: 'v5.2.0', deployedBy: 'Super Admin' },
                { id: 'enq1', date: '16.08.2026', module: 'CRM Core', submodule: 'Manual Product Entry', changes: 'Added custom product option and free-text code/description entry for non-mastered items.', version: 'v4.7.0', deployedBy: 'Super Admin' },
                { id: 'enq2', date: '16.08.2026', module: 'CRM Core', submodule: 'Role Filtering', changes: 'Filtered assigned executive selection exclusively to users with Sales Executive role.', version: 'v4.7.0', deployedBy: 'Super Admin' },
                { id: 'enq3', date: '16.08.2026', module: 'CRM Core', submodule: 'Enquiry Status Workflow', changes: 'Standardized status dropdown with Open, Assigned, In Progress, Pending Customer, Resolved, Closed, Cancelled enums.', version: 'v4.7.0', deployedBy: 'Super Admin' },
                { id: 'enq4', date: '16.08.2026', module: 'CRM Core', submodule: 'Product Value Calculation', changes: 'Automated line item values and header summary totals (Subtotal, Freight, Other Charges, Grand Total).', version: 'v4.7.0', deployedBy: 'Super Admin' },
                { id: 'u1', date: '01.08.2026', module: 'State Master', submodule: 'Field Sequence & Layout', changes: 'Rearranged field order to Country -> Country Dial Code -> State / UT -> Short Code -> GST Code -> City Name with balanced 2-column grid layout.', version: 'v2.5.0', deployedBy: 'GitHub main (569278f)' },
                { id: 'u2', date: '01.08.2026', module: 'State Master', submodule: 'Dependent City Dropdown', changes: 'Implemented state-wise dependent City dropdown with auto-reset on State change and disabled state validation.', version: 'v2.5.0', deployedBy: 'GitHub main (569278f)' },
                { id: 'u3', date: '01.08.2026', module: 'State Master', submodule: 'Auto-Fill Logic', changes: 'Added auto-fill for Country Dial Code (+91, +1, etc.), State Short Code (MH, GJ, etc.) and GST Code (27, 24, etc.).', version: 'v2.5.0', deployedBy: 'GitHub main (569278f)' },
                { id: 'u4', date: '01.08.2026', module: 'Employee Master', submodule: 'Family Information', changes: 'Added Aadhaar Number field in Family Information with numeric-only input and 12-digit validation.', version: 'v2.5.0', deployedBy: 'GitHub main (569278f)' },
                { id: 'u5', date: '01.08.2026', module: 'Employee Master', submodule: 'Accordion Panel', changes: 'Converted Family Information section into a collapsible/expandable accordion panel with independent per-entry toggle.', version: 'v2.5.0', deployedBy: 'GitHub main (569278f)' },
                { id: 'u6', date: '01.08.2026', module: 'Employee Master', submodule: 'Backend Schema', changes: 'Updated Mongoose FamilyMemberSchema in EmployeeProfile model to persist family member Aadhaar numbers.', version: 'v2.5.0', deployedBy: 'GitHub main (569278f)' },
                { id: 's1', date: '17.07.2026', module: 'Reports', submodule: 'Sales target', changes: 'Alignment modified', version: 'v2.1.0', deployedBy: 'System Admin' },
                { id: 's2', date: '18.07.2026', module: 'Reports', submodule: 'added new report', changes: 'Added new report', version: 'v2.1.0', deployedBy: 'System Admin' },
                { id: 's3', date: '19.07.2026', module: 'Reports', submodule: 'design', changes: 'redesign', version: 'v2.2.0', deployedBy: 'System Admin' },
                { id: 's4', date: '19.07.2026', module: 'Dashboard', submodule: 'Theme Management', changes: 'Added dark/light mode toggle', version: 'v2.2.0', deployedBy: 'System Admin' },
                { id: 's5', date: '19.07.2026', module: 'Dashboard', submodule: 'Global Search', changes: 'Enquiry submodule hierarchy search', version: 'v2.2.0', deployedBy: 'System Admin' },
                { id: 's6', date: '19.07.2026', module: 'CRM Core', submodule: 'Real-Time', changes: 'Socket.io live data synchronization', version: 'v2.2.0', deployedBy: 'System Admin' }
            ];
        }

        return list;
    }, [updates]);

    // Unique modules for filter dropdown
    const availableModules = useMemo(() => {
        const set = new Set(['All']);
        allChanges.forEach(item => {
            if (item.module) set.add(item.module);
        });
        return Array.from(set);
    }, [allChanges]);

    // Filtered rows
    const filteredChanges = useMemo(() => {
        return allChanges.filter(item => {
            const matchModule = selectedModule === 'All' || item.module?.toLowerCase() === selectedModule.toLowerCase();
            const matchSub = !submoduleSearch || item.submodule?.toLowerCase().includes(submoduleSearch.toLowerCase());
            const matchDate = !dateSearch || item.date?.toLowerCase().includes(dateSearch.toLowerCase());
            return matchModule && matchSub && matchDate;
        });
    }, [allChanges, selectedModule, submoduleSearch, dateSearch]);

    const toggleRowExpand = (id) => {
        setExpandedRow(prev => (prev === id ? null : id));
    };

    const handleNavigateSubmodule = (moduleName) => {
        const targetPath = modulePathMap[moduleName] || '/dashboard';
        navigate(targetPath);
    };

    return (
        <div className="space-y-6 max-w-6xl mx-auto animate-fade-in-up">
            {/* Header section */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <div className="flex items-center gap-2 text-primary-600 font-black uppercase tracking-widest text-xs">
                        <IconReleases size={18} />
                        Release History
                    </div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight font-outfit uppercase">
                        Daily CRM Changes Update
                    </h1>
                    <p className="text-slate-500 font-semibold text-sm">
                        View minute-by-minute system enhancements, submodule updates, and feature rollouts.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={fetchUpdates}
                    disabled={loading}
                    className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 disabled:opacity-60 transition-all shadow-sm active:scale-95"
                >
                    <MdRefresh size={18} className={loading ? 'animate-spin' : ''} />
                    Refresh Logs
                </button>
            </div>

            {/* Yellow Highlight Banner as per Mockup */}
            <div className="bg-amber-100/90 dark:bg-amber-950/40 border border-amber-300/80 dark:border-amber-800/60 text-amber-900 dark:text-amber-300 px-6 py-3 rounded-2xl text-center font-black text-sm tracking-wide shadow-sm">
                Daily crm changes update
            </div>

            {/* Filter Controls Bar (On Page) */}
            <div className="bg-white dark:bg-slate-800/80 p-5 rounded-[2rem] border border-slate-100 dark:border-slate-700 shadow-sm space-y-3">
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    <MdFilterList size={18} className="text-primary-600 dark:text-primary-400" />
                    <span>FILTERS</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {/* Searchable Module Dropdown */}
                    <SearchableSelect
                        label="MODULE"
                        options={availableModules}
                        value={selectedModule}
                        onChange={(mod) => setSelectedModule(mod)}
                        placeholder="Search module name..."
                    />

                    {/* Submodule Filter */}
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                            SUB MODULE
                        </label>
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="Filter by submodule..."
                                value={submoduleSearch}
                                onChange={(e) => setSubmoduleSearch(e.target.value)}
                                className="w-full pl-9 pr-3 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary-500 focus:bg-white dark:focus:bg-slate-900 transition-all outline-none"
                            />
                            <MdSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        </div>
                    </div>

                    {/* Date Filter */}
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                            DATE
                        </label>
                        <input
                            type="text"
                            placeholder="Search date (e.g. 17.07.2026)..."
                            value={dateSearch}
                            onChange={(e) => setDateSearch(e.target.value)}
                            className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary-500 focus:bg-white dark:focus:bg-slate-900 transition-all outline-none"
                        />
                    </div>
                </div>
            </div>

            {/* Main Table */}
            <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm">
                {loading ? (
                    <div className="p-12 text-center text-slate-400 font-bold text-sm">
                        <MdRefresh className="animate-spin inline-block mr-2" size={20} />
                        Fetching system update logs...
                    </div>
                ) : filteredChanges.length === 0 ? (
                    <div className="p-12 text-center space-y-2">
                        <MdInfoOutline className="mx-auto text-slate-300 dark:text-slate-600" size={36} />
                        <p className="text-slate-700 dark:text-slate-300 font-bold text-sm">No update logs found</p>
                        <p className="text-slate-400 text-xs">Try clearing search inputs or date filters.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                            <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 uppercase tracking-widest font-black text-[10px]">
                                <tr>
                                    <th className="w-10 px-3 py-4"></th>
                                    <th className="px-5 py-4 whitespace-nowrap">DATE</th>
                                    <th className="px-5 py-4 whitespace-nowrap">MODULE</th>
                                    <th className="px-5 py-4 whitespace-nowrap">SUBMODULE</th>
                                    <th className="px-5 py-4">CHANGES / MINUTE DETAIL</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                                {filteredChanges.map((row) => {
                                    const isExpanded = expandedRow === row.id;
                                    return (
                                        <React.Fragment key={row.id}>
                                            <tr
                                                onClick={() => toggleRowExpand(row.id)}
                                                className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 cursor-pointer transition-colors group"
                                            >
                                                <td className="px-3 py-4 text-slate-400 group-hover:text-primary-600">
                                                    {isExpanded ? <MdExpandLess size={18} /> : <MdExpandMore size={18} />}
                                                </td>
                                                <td className="px-5 py-4 font-bold text-slate-600 dark:text-slate-300 whitespace-nowrap">{row.date}</td>
                                                <td className="px-5 py-4 font-black text-slate-900 dark:text-slate-100">{row.module}</td>
                                                <td className="px-5 py-4">
                                                    <span className="inline-flex items-center gap-1 font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 px-3 py-1 rounded-full border border-emerald-200/80 dark:border-emerald-800/60 hover:bg-emerald-100 transition-colors">
                                                        {row.submodule}
                                                    </span>
                                                </td>
                                                <td className="px-5 py-4 font-semibold text-slate-800 dark:text-slate-200">{row.changes}</td>
                                            </tr>

                                            {/* Expanded Details Sub-View */}
                                            {isExpanded && (
                                                <tr className="bg-slate-50/70 dark:bg-slate-800/40">
                                                    <td colSpan="5" className="p-6 border-l-4 border-primary-600">
                                                        <div className="space-y-4">
                                                            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/80 dark:border-slate-700 pb-3">
                                                                <div className="flex items-center gap-2 text-xs font-black text-slate-900 dark:text-slate-100">
                                                                    <MdLayers className="text-primary-600 dark:text-primary-400" size={18} />
                                                                    <span>Minute Detail Breakdown - {row.module} &gt; {row.submodule}</span>
                                                                </div>
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleNavigateSubmodule(row.module);
                                                                    }}
                                                                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary-600 text-white font-bold text-xs hover:bg-primary-700 transition-all shadow-sm active:scale-95"
                                                                >
                                                                    <span>Go to Submodule</span>
                                                                    <MdLaunch size={14} />
                                                                </button>
                                                            </div>

                                                            <div className="text-xs text-slate-700 dark:text-slate-300 font-medium space-y-1.5">
                                                                <p><strong className="font-bold text-slate-900 dark:text-slate-100">Change Detail:</strong> {row.changes}</p>
                                                                <p><strong className="font-bold text-slate-900 dark:text-slate-100">Deployment Date:</strong> {row.date}</p>
                                                                <p><strong className="font-bold text-slate-900 dark:text-slate-100">Deployed By:</strong> {row.deployedBy}</p>
                                                            </div>

                                                            {row.releaseNotes && row.releaseNotes.length > 0 && (
                                                                <div className="pt-2">
                                                                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Release Notes</span>
                                                                    <ul className="mt-2 space-y-1.5 text-xs text-slate-800 dark:text-slate-200">
                                                                        {row.releaseNotes.map((note, nIdx) => (
                                                                            <li key={nIdx} className="flex items-start gap-2">
                                                                                <MdCheckCircle className="text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" size={15} />
                                                                                <span className="font-semibold">{note}</span>
                                                                            </li>
                                                                        ))}
                                                                    </ul>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <div className="flex flex-col sm:flex-row justify-between items-center text-xs font-bold text-slate-400 px-2 gap-2">
                <span>Click any row to view minute details & direct submodule link</span>
                <span>Showing {filteredChanges.length} of {allChanges.length} updates</span>
            </div>
        </div>
    );
};

export default SystemUpdates;
