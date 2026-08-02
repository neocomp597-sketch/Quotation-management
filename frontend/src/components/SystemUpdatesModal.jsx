import React, { useState, useEffect, useMemo } from 'react';
import Modal from './Modal';
import { MdFilterList, MdSearch, MdInfoOutline, MdRefresh, MdChevronRight, MdExpandMore, MdExpandLess, MdLaunch, MdCheckCircle, MdLayers } from 'react-icons/md';
import { useNavigate } from 'react-router-dom';
import { systemUpdateService } from '../services/api';

const modulePathMap = {
    'Reports': '/reports',
    'Dashboard': '/dashboard',
    'CRM Core': '/enquiries',
    'Sales': '/sales/dashboard',
    'Enquiry': '/enquiries',
    'Customers': '/customers',
    'Quotation': '/quotations',
    'Payroll': '/payroll/dashboard',
    'Employee Master': '/payroll/employees',
    'State Master': '/state-master',
    'Master Management': '/state-master',
    'CSM': '/csm/dashboard',
    'Tenders': '/tenders'
};

const SystemUpdatesModal = ({ isOpen, onClose }) => {
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
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            fetchUpdates();
        }
    }, [isOpen]);

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
        onClose();
        navigate(targetPath);
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Daily crm changes update"
            maxWidth="max-w-4xl"
        >
            <div className="space-y-6">
                {/* Yellow Highlight Banner as per Mockup */}
                <div className="bg-amber-100 border border-amber-300 text-amber-900 px-4 py-2.5 rounded-xl text-center font-black text-sm tracking-wide shadow-sm flex items-center justify-between">
                    <span className="w-full text-center">Daily crm changes update</span>
                </div>

                {/* Filter Controls Bar */}
                <div className="bg-slate-50 dark:bg-slate-800/80 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
                    <div className="flex items-center gap-2 text-xs font-black uppercase text-slate-500 dark:text-slate-400">
                        <MdFilterList size={18} className="text-primary-600 dark:text-primary-400" />
                        <span>Filters</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {/* Module Dropdown */}
                        <div>
                            <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">Module</label>
                            <select
                                value={selectedModule}
                                onChange={(e) => setSelectedModule(e.target.value)}
                                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-primary-500 outline-none"
                            >
                                {availableModules.map(mod => (
                                    <option key={mod} value={mod}>{mod}</option>
                                ))}
                            </select>
                        </div>

                        {/* Submodule Filter */}
                        <div>
                            <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">Sub Module</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder="Filter by submodule..."
                                    value={submoduleSearch}
                                    onChange={(e) => setSubmoduleSearch(e.target.value)}
                                    className="w-full pl-8 pr-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-primary-500 outline-none"
                                />
                                <MdSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                            </div>
                        </div>

                        {/* Date Filter */}
                        <div>
                            <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">Date</label>
                            <input
                                type="text"
                                placeholder="Search date (e.g. 17.07.2026)..."
                                value={dateSearch}
                                onChange={(e) => setDateSearch(e.target.value)}
                                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-primary-500 outline-none"
                            />
                        </div>
                    </div>
                </div>

                {/* Main Table */}
                <div className="border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden shadow-sm">
                    {loading ? (
                        <div className="p-8 text-center text-slate-400 font-bold text-sm">
                            <MdRefresh className="animate-spin inline-block mr-2" size={20} />
                            Fetching system updates...
                        </div>
                    ) : filteredChanges.length === 0 ? (
                        <div className="p-10 text-center space-y-2">
                            <MdInfoOutline className="mx-auto text-slate-400" size={32} />
                            <p className="text-slate-600 dark:text-slate-300 font-bold text-sm">No related records found</p>
                            <p className="text-slate-400 text-xs">Try adjusting your module or date filters.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead className="bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 uppercase tracking-wider font-black">
                                    <tr>
                                        <th className="w-8 px-2 py-3"></th>
                                        <th className="px-4 py-3 whitespace-nowrap">Date</th>
                                        <th className="px-4 py-3 whitespace-nowrap">Module</th>
                                        <th className="px-4 py-3 whitespace-nowrap">Submodule</th>
                                        <th className="px-4 py-3">Changes / Minute Detail</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                                    {filteredChanges.map((row) => {
                                        const isExpanded = expandedRow === row.id;
                                        return (
                                            <React.Fragment key={row.id}>
                                                <tr
                                                    onClick={() => toggleRowExpand(row.id)}
                                                    className="hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors group"
                                                >
                                                    <td className="px-2 py-3 text-slate-400 group-hover:text-primary-600">
                                                        {isExpanded ? <MdExpandLess size={18} /> : <MdExpandMore size={18} />}
                                                    </td>
                                                    <td className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap">{row.date}</td>
                                                    <td className="px-4 py-3 font-black text-slate-900 dark:text-slate-100">{row.module}</td>
                                                    <td className="px-4 py-3">
                                                        <span className="inline-flex items-center gap-1 font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800/50 hover:bg-emerald-100 transition-colors">
                                                            {row.submodule}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 font-medium text-slate-700 dark:text-slate-300">{row.changes}</td>
                                                </tr>

                                                {/* Expanded Details Sub-View */}
                                                {isExpanded && (
                                                    <tr className="bg-slate-50/80 dark:bg-slate-800/40">
                                                        <td colSpan="5" className="p-4 border-l-4 border-primary-600">
                                                            <div className="space-y-3">
                                                                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-700 pb-2">
                                                                    <div className="flex items-center gap-2 text-xs font-black text-slate-900 dark:text-slate-100">
                                                                        <MdLayers className="text-primary-600" size={16} />
                                                                        <span>Minute Detail Breakdown - {row.module} &gt; {row.submodule}</span>
                                                                    </div>
                                                                    <button
                                                                        type="button"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            handleNavigateSubmodule(row.module);
                                                                        }}
                                                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary-600 text-white font-bold text-xs hover:bg-primary-700 transition-all shadow-sm"
                                                                    >
                                                                        <span>Go to Submodule</span>
                                                                        <MdLaunch size={14} />
                                                                    </button>
                                                                </div>

                                                                <div className="text-xs text-slate-600 dark:text-slate-300 font-medium space-y-1.5">
                                                                    <p><strong className="font-bold text-slate-800 dark:text-slate-200">Change Detail:</strong> {row.changes}</p>
                                                                    <p><strong className="font-bold text-slate-800 dark:text-slate-200">Deployment Date:</strong> {row.date}</p>
                                                                    <p><strong className="font-bold text-slate-800 dark:text-slate-200">Deployed By:</strong> {row.deployedBy}</p>
                                                                </div>

                                                                {row.releaseNotes && row.releaseNotes.length > 0 && (
                                                                    <div className="pt-2">
                                                                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Release Notes</span>
                                                                        <ul className="mt-1 space-y-1 text-xs text-slate-700 dark:text-slate-300">
                                                                            {row.releaseNotes.map((note, nIdx) => (
                                                                                <li key={nIdx} className="flex items-start gap-1.5">
                                                                                    <MdCheckCircle className="text-emerald-500 mt-0.5 shrink-0" size={14} />
                                                                                    <span>{note}</span>
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

                <div className="flex justify-between items-center text-[11px] font-bold text-slate-400 px-1">
                    <span>Click any row to view minute details & direct submodule link</span>
                    <span>Showing {filteredChanges.length} of {allChanges.length} updates</span>
                </div>
            </div>
        </Modal>
    );
};

export default SystemUpdatesModal;
