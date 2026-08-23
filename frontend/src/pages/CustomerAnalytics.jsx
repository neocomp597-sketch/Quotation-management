import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    MdDashboard,
    MdPeople,
    MdTrendingUp,
    MdCheckCircle,
    MdWarning,
    MdError,
    MdSearch,
    MdFilterList,
    MdDownload,
    MdPrint,
    MdEmail,
    MdSave,
    MdRefresh,
    MdShowChart,
    MdBarChart,
    MdPieChart,
    MdAttachMoney,
    MdThumbUp,
    MdAutorenew,
    MdFolder,
    MdNavigateNext,
    MdBookmark
} from 'react-icons/md';
import { toast } from 'react-toastify';
import {
    ResponsiveContainer,
    AreaChart,
    Area,
    BarChart,
    Bar,
    LineChart,
    Line,
    PieChart,
    Pie,
    Cell,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend
} from 'recharts';
import * as XLSX from 'xlsx';
import { customerAnalyticsService, salespersonService, territoryService } from '../services/api';
import { resolveImageUrl } from '../utils/helpers';
import { useAuth } from '../context/AuthContext';

const TABS = [
    { id: 'dashboard', label: 'Executive Dashboard', icon: <MdDashboard size={18} /> },
    { id: 'table', label: 'Customer Directory', icon: <MdPeople size={18} /> },
    { id: 'segmentation', label: 'Segmentation', icon: <MdPieChart size={18} /> },
    { id: 'growth', label: 'Growth Analytics', icon: <MdTrendingUp size={18} /> },
    { id: 'retention', label: 'Retention & Churn', icon: <MdAutorenew size={18} /> },
    { id: 'satisfaction', label: 'Satisfaction & CSAT', icon: <MdThumbUp size={18} /> },
    { id: 'financial', label: 'Financial Analytics', icon: <MdAttachMoney size={18} /> },
    { id: 'reports', label: 'Structured Reports', icon: <MdFolder size={18} /> }
];

const COLORS = ['#6366f1', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6'];

const CustomerAnalytics = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState('dashboard');
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({});
    const [tableData, setTableData] = useState([]);
    const [pagination, setPagination] = useState({ page: 1, limit: 15, total: 0, pages: 1 });
    const [segmentData, setSegmentData] = useState({});
    const [retentionData, setRetentionData] = useState([]);
    const [clvData, setClvData] = useState([]);
    const [repeatData, setRepeatData] = useState([]);
    const [outstandingData, setOutstandingData] = useState([]);
    const [healthData, setHealthData] = useState({});
    
    // Filters State
    const [page, setPage] = useState(1);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedOwner, setSelectedOwner] = useState('');
    const [selectedIndustry, setSelectedIndustry] = useState('');
    const [selectedSegment, setSelectedSegment] = useState('');
    const [selectedTerritory, setSelectedTerritory] = useState('');
    const [selectedStatus, setSelectedStatus] = useState('');
    const [selectedHealth, setSelectedHealth] = useState('');
    const [minClv, setMinClv] = useState('');
    const [maxOutstanding, setMaxOutstanding] = useState('');
    const [showFilters, setShowFilters] = useState(false);

    // Masters lists for filters
    const [owners, setOwners] = useState([]);
    const [territories, setTerritories] = useState([]);

    // Saved Filters
    const [savedFilters, setSavedFilters] = useState([
        { name: 'VIP Accounts', filters: { segment: 'VIP Customers', status: 'Active' } },
        { name: 'At Risk - High Outstanding', filters: { health: 'At Risk', minClv: '50000' } }
    ]);
    const [filterName, setFilterName] = useState('');

    useEffect(() => {
        const fetchFilterOptions = async () => {
            try {
                const [ownersRes, terrRes] = await Promise.all([
                    salespersonService.getAll(),
                    territoryService.getAll()
                ]);
                setOwners(ownersRes.data || []);
                setTerritories(terrRes.data || []);
            } catch (err) {
                console.error('Error fetching filter options:', err);
            }
        };
        fetchFilterOptions();
    }, []);

    const fetchAllAnalytics = async () => {
        setLoading(true);
        try {
            const params = {
                owner: selectedOwner || undefined,
                industry: selectedIndustry || undefined,
                segment: selectedSegment || undefined,
                territory: selectedTerritory || undefined,
                status: selectedStatus || undefined
            };

            const [
                summaryRes,
                segRes,
                retRes,
                clvRes,
                repeatRes,
                outRes,
                healthRes
            ] = await Promise.all([
                customerAnalyticsService.getDashboardSummary(params),
                customerAnalyticsService.getSegmentation(params),
                customerAnalyticsService.getChurn(params),
                customerAnalyticsService.getCLV(params),
                customerAnalyticsService.getRepeatBusiness(params),
                customerAnalyticsService.getOutstanding(params),
                customerAnalyticsService.getHealth(params)
            ]);

            setStats(summaryRes.data);
            setSegmentData(segRes.data);
            setRetentionData(retRes.data);
            setClvData(clvRes.data);
            setRepeatData(repeatRes.data);
            setOutstandingData(outRes.data);
            setHealthData(healthRes.data);
            
            // Also fetch table data
            fetchTableData();

        } catch (err) {
            console.error('Error loading customer analytics:', err);
            toast.error('Failed to load analytics dashboard data');
        } finally {
            setLoading(false);
        }
    };

    const fetchTableData = async () => {
        try {
            const tableRes = await customerAnalyticsService.getTable({
                page,
                limit: 15,
                search: searchTerm.trim() || undefined,
                owner: selectedOwner || undefined,
                industry: selectedIndustry || undefined,
                segment: selectedSegment || undefined,
                territory: selectedTerritory || undefined,
                status: selectedStatus || undefined
            });
            setTableData(tableRes.data.data || []);
            setPagination(tableRes.data.pagination || { page: 1, limit: 15, total: 0, pages: 1 });
        } catch (err) {
            console.error('Error fetching table directory:', err);
        }
    };

    useEffect(() => {
        fetchAllAnalytics();
    }, [activeTab, selectedOwner, selectedIndustry, selectedSegment, selectedTerritory, selectedStatus]);

    useEffect(() => {
        fetchTableData();
    }, [page, searchTerm]);

    const handleApplySavedFilter = (f) => {
        setSelectedSegment(f.filters.segment || '');
        setSelectedStatus(f.filters.status || '');
        setSelectedHealth(f.filters.health || '');
        if (f.filters.minClv) setMinClv(f.filters.minClv);
        toast.success(`Applied filter preset: ${f.name}`);
    };

    const handleSaveFilter = () => {
        if (!filterName.trim()) {
            toast.warning('Please enter a name for the filter preset');
            return;
        }
        const newPreset = {
            name: filterName.trim(),
            filters: {
                segment: selectedSegment,
                status: selectedStatus,
                health: selectedHealth,
                minClv
            }
        };
        setSavedFilters([...savedFilters, newPreset]);
        setFilterName('');
        toast.success('Saved filter preset successfully');
    };

    const handleResetFilters = () => {
        setSelectedOwner('');
        setSelectedIndustry('');
        setSelectedSegment('');
        setSelectedTerritory('');
        setSelectedStatus('');
        setSelectedHealth('');
        setMinClv('');
        setMaxOutstanding('');
        setSearchTerm('');
        toast.info('Filters reset to defaults');
    };

    // Reports export configurations
    const handleExport = async (type) => {
        try {
            const res = await customerAnalyticsService.getExport();
            const data = res.data;

            if (type === 'excel') {
                const ws = XLSX.utils.json_to_sheet(data);
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, 'Customer CRM Export');
                XLSX.writeFile(wb, `Customer_CRM_Analytics_${Date.now()}.xlsx`);
                toast.success('Excel export completed!');
            } else if (type === 'csv') {
                const ws = XLSX.utils.json_to_sheet(data);
                const csvOutput = XLSX.utils.sheet_to_csv(ws);
                const blob = new Blob([csvOutput], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.setAttribute('href', url);
                link.setAttribute('download', `Customer_CRM_Analytics_${Date.now()}.csv`);
                link.style.visibility = 'hidden';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                toast.success('CSV export completed!');
            } else {
                window.print();
            }
        } catch (err) {
            console.error('Export error:', err);
            toast.error('Failed to export report');
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] py-20">
                <div className="w-12 h-12 rounded-full border-4 border-primary-600 border-t-transparent animate-spin mb-4"></div>
                <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Assembling Enterprise Analytics...</p>
            </div>
        );
    }

    return (
        <div className="space-y-8 font-outfit">
            {/* Header Block */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white dark:bg-slate-900/60 p-8 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary-100/30 dark:bg-primary-900/20 rounded-full blur-2xl pointer-events-none"></div>
                <div>
                    <h1 className="text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight uppercase">CRM & Customer Analytics</h1>
                    <p className="text-slate-500 dark:text-slate-400 font-medium mt-1">
                        Enterprise CRM metrics, customer 360 overview, segmentations, and dynamic health insights.
                    </p>
                    {user?.role && (
                        <div className="mt-3 flex items-center gap-2">
                            <span className="text-[10px] font-black uppercase tracking-wider bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-900/50 text-indigo-700 dark:text-indigo-300 px-3 py-1 rounded-full">
                                Role: {user.role.toUpperCase()}
                            </span>
                            <span className="text-[10px] font-black uppercase tracking-wider bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700 text-slate-500 dark:text-slate-400 px-3 py-1 rounded-full">
                                {user.role === 'admin' || user.role === 'manager' ? 'All Customers' : 'Assigned Customers Only'}
                            </span>
                        </div>
                    )}
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={`flex items-center gap-2 px-5 py-3 rounded-2xl border font-bold text-xs uppercase tracking-widest transition-all ${
                            showFilters ? 'bg-primary-50 dark:bg-primary-950/60 border-primary-200 dark:border-primary-800 text-primary-700 dark:text-primary-300 shadow-inner' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-sm'
                        }`}
                    >
                        <MdFilterList size={18} />
                        Filters
                    </button>
                    <button
                        onClick={() => fetchAllAnalytics()}
                        className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-2xl shadow-sm transition-all"
                        title="Reload Analytics"
                    >
                        <MdRefresh size={18} />
                    </button>
                    <div className="h-6 w-px bg-slate-100 dark:bg-slate-800"></div>
                    <button
                        onClick={() => handleExport('excel')}
                        className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-3 rounded-2xl font-bold text-xs uppercase tracking-widest transition-all shadow-lg shadow-emerald-600/20 active:scale-95"
                    >
                        <MdDownload size={18} />
                        Excel
                    </button>
                </div>
            </div>

            {/* Filters panel */}
            {showFilters && (
                <div className="bg-white dark:bg-slate-900/60 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-md space-y-6">
                    <div className="flex items-center justify-between border-b border-slate-50 dark:border-slate-800 pb-4">
                        <h3 className="font-black text-slate-800 dark:text-slate-100 text-sm uppercase tracking-wider flex items-center gap-2">
                            <MdFilterList className="text-primary-600 dark:text-primary-400" size={20} />
                            Enterprise Segmentation Filters
                        </h3>
                        <button onClick={handleResetFilters} className="text-xs font-bold text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors uppercase tracking-widest">
                            Clear All
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Account Owner</label>
                            <select
                                value={selectedOwner}
                                onChange={(e) => setSelectedOwner(e.target.value)}
                                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-primary-500/10 transition-all"
                            >
                                <option value="">All Owners</option>
                                {owners.map(o => (
                                    <option key={o._id} value={o._id}>{o.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Industry Sector</label>
                            <select
                                value={selectedIndustry}
                                onChange={(e) => setSelectedIndustry(e.target.value)}
                                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl text-sm font-bold outline-none"
                            >
                                <option value="">All Industries</option>
                                <option value="Manufacturing">Manufacturing</option>
                                <option value="Healthcare">Healthcare</option>
                                <option value="Retail">Retail</option>
                                <option value="Education">Education</option>
                                <option value="Government">Government</option>
                                <option value="Other">Other</option>
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Value Segment</label>
                            <select
                                value={selectedSegment}
                                onChange={(e) => setSelectedSegment(e.target.value)}
                                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl text-sm font-bold outline-none"
                            >
                                <option value="">All Segments</option>
                                <option value="VIP Customers">VIP Customers</option>
                                <option value="High Value">High Value</option>
                                <option value="Medium Value">Medium Value</option>
                                <option value="Low Value">Low Value</option>
                                <option value="Retail">Retail</option>
                                <option value="Wholesale">Wholesale</option>
                                <option value="Corporate">Corporate</option>
                                <option value="Government">Government</option>
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Geographic Territory</label>
                            <select
                                value={selectedTerritory}
                                onChange={(e) => setSelectedTerritory(e.target.value)}
                                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl text-sm font-bold outline-none"
                            >
                                <option value="">All Territories</option>
                                {territories.map(t => (
                                    <option key={t._id} value={t._id}>{t.name} ({t.type})</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 pt-4 border-t border-slate-50 dark:border-slate-800">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Relationship Status</label>
                            <select
                                value={selectedStatus}
                                onChange={(e) => setSelectedStatus(e.target.value)}
                                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl text-sm font-bold outline-none"
                            >
                                <option value="">All Statuses</option>
                                <option value="Active">Active</option>
                                <option value="New">New</option>
                                <option value="VIP">VIP</option>
                                <option value="Inactive">Inactive</option>
                                <option value="High Value">High Value</option>
                                <option value="Lost">Lost</option>
                                <option value="Prospect">Prospect</option>
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Health Status</label>
                            <select
                                value={selectedHealth}
                                onChange={(e) => setSelectedHealth(e.target.value)}
                                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl text-sm font-bold outline-none"
                            >
                                <option value="">All Health Categories</option>
                                <option value="Healthy">Healthy</option>
                                <option value="Good">Good</option>
                                <option value="Needs Attention">Needs Attention</option>
                                <option value="At Risk">At Risk</option>
                            </select>
                        </div>

                        {/* Save Filters Section */}
                        <div className="col-span-2 space-y-2 flex flex-col justify-end">
                            <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Saved Filter Presets</label>
                            <div className="flex gap-2">
                                <div className="flex-1 flex gap-2 flex-wrap items-center bg-slate-50 dark:bg-slate-800 p-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
                                    {savedFilters.map((sf, index) => (
                                        <button
                                            key={index}
                                            onClick={() => handleApplySavedFilter(sf)}
                                            className="flex items-center gap-1 text-[10px] font-black bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:border-primary-500 hover:text-primary-600 px-3 py-1.5 rounded-lg uppercase tracking-wider transition-colors"
                                        >
                                            <MdBookmark size={12} className="text-primary-500" />
                                            {sf.name}
                                        </button>
                                    ))}
                                </div>
                                <div className="flex gap-1.5 shrink-0">
                                    <input
                                        type="text"
                                        placeholder="Preset Name..."
                                        value={filterName}
                                        onChange={(e) => setFilterName(e.target.value)}
                                        className="px-3 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-900 dark:text-slate-100 rounded-xl text-xs font-bold w-32 outline-none focus:border-primary-500"
                                    />
                                    <button
                                        onClick={handleSaveFilter}
                                        className="bg-primary-600 hover:bg-primary-700 text-white p-3 rounded-xl font-bold transition-all shadow-md active:scale-95"
                                        title="Save Current Filters"
                                    >
                                        <MdSave size={18} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Tabs switcher */}
            <div className="flex gap-2 overflow-x-auto p-1.5 bg-slate-100 dark:bg-slate-800/80 rounded-3xl self-start w-fit max-w-full">
                {TABS.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2.5 px-6 py-3.5 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${
                            activeTab === tab.id
                                ? 'bg-white dark:bg-slate-900 text-primary-600 dark:text-primary-400 shadow-md ring-1 ring-black/5'
                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-white/40 dark:hover:bg-slate-700/40'
                        }`}
                    >
                        {tab.icon}
                        <span>{tab.label}</span>
                    </button>
                ))}
            </div>

            {/* Tab Contents */}
            {activeTab === 'dashboard' && (
                <div className="space-y-8">
                    {/* KPI Cards Grid */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-6">
                        <div className="bg-white dark:bg-slate-900/60 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col justify-between h-36 relative overflow-hidden">
                            <div className="absolute -top-4 -right-4 w-16 h-16 bg-blue-50 dark:bg-blue-950/40 rounded-full flex items-center justify-center text-blue-500 font-black text-xl">#</div>
                            <span className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">Total Accounts</span>
                            <span className="text-3xl font-black text-slate-900 dark:text-slate-100 leading-none mt-4">{stats.totalCustomers?.toLocaleString()}</span>
                            <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 mt-2">Active database nodes</span>
                        </div>

                        <div className="bg-white dark:bg-slate-900/60 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col justify-between h-36 relative overflow-hidden">
                            <div className="absolute -top-4 -right-4 w-16 h-16 bg-emerald-50 dark:bg-emerald-950/40 rounded-full flex items-center justify-center text-emerald-500 font-black text-xl">●</div>
                            <span className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">Active Customers</span>
                            <span className="text-3xl font-black text-emerald-600 dark:text-emerald-400 leading-none mt-4">{stats.activeCustomers?.toLocaleString()}</span>
                            <span className="text-[9px] font-bold text-emerald-500 dark:text-emerald-400 mt-2">Active transacting (90d)</span>
                        </div>

                        <div className="bg-white dark:bg-slate-900/60 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col justify-between h-36 relative overflow-hidden">
                            <span className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">Dormant Accounts</span>
                            <span className="text-3xl font-black text-amber-500 leading-none mt-4">{stats.dormantCustomers?.toLocaleString()}</span>
                            <span className="text-[9px] font-bold text-amber-500 mt-2">No transaction in 180 days</span>
                        </div>

                        <div className="bg-white dark:bg-slate-900/60 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col justify-between h-36 relative overflow-hidden">
                            <span className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">Lost Customers</span>
                            <span className="text-3xl font-black text-rose-500 leading-none mt-4">{stats.lostCustomers?.toLocaleString()}</span>
                            <span className="text-[9px] font-bold text-rose-500 mt-2">Marked as lost/churned</span>
                        </div>

                        <div className="bg-white dark:bg-slate-900/60 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col justify-between h-36 relative overflow-hidden">
                            <span className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">CLV (Cumulative)</span>
                            <span className="text-3xl font-black text-indigo-600 dark:text-indigo-400 leading-none mt-4">₹{Math.round(stats.totalCustomers * stats.averageRevenuePerCustomer).toLocaleString()}</span>
                            <span className="text-[9px] font-bold text-indigo-500 dark:text-indigo-400 mt-2">Gross customer revenue</span>
                        </div>

                        <div className="bg-white dark:bg-slate-900/60 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col justify-between h-36 relative overflow-hidden bg-gradient-to-br from-rose-50 to-white dark:from-rose-950/30 dark:to-slate-900 border-rose-100 dark:border-rose-900/40">
                            <span className="text-[10px] font-black uppercase text-rose-700 dark:text-rose-400 tracking-wider">Receivables</span>
                            <span className="text-3xl font-black text-rose-600 dark:text-rose-400 leading-none mt-4">₹{stats.outstandingReceivables?.toLocaleString()}</span>
                            <span className="text-[9px] font-bold text-rose-500 dark:text-rose-400 mt-2">Total outstanding balance</span>
                        </div>
                    </div>

                    {/* Secondary Metrics row */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                        <div className="bg-white dark:bg-slate-900/60 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm flex justify-between items-center gap-4">
                            <div>
                                <div className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">NPS Customer Index</div>
                                <div className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1">+{stats.nps}</div>
                            </div>
                            <div className="h-10 w-10 bg-indigo-50 dark:bg-indigo-950/50 rounded-xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold text-sm">
                                NPS
                            </div>
                        </div>
                        <div className="bg-white dark:bg-slate-900/60 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm flex justify-between items-center gap-4">
                            <div>
                                <div className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">CSAT Score %</div>
                                <div className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1">{stats.csat}%</div>
                            </div>
                            <div className="h-10 w-10 bg-emerald-50 dark:bg-emerald-950/50 rounded-xl flex items-center justify-center text-emerald-600 dark:text-emerald-400 font-bold text-sm">
                                CSAT
                            </div>
                        </div>
                        <div className="bg-white dark:bg-slate-900/60 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm flex justify-between items-center gap-4">
                            <div>
                                <div className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Collection Cycle</div>
                                <div className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1">{stats.averageCollectionDays} Days</div>
                            </div>
                            <div className="h-10 w-10 bg-rose-50 dark:bg-rose-950/50 rounded-xl flex items-center justify-center text-rose-600 dark:text-rose-400 font-bold text-sm">
                                DSO
                            </div>
                        </div>
                        <div className="bg-white dark:bg-slate-900/60 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm flex justify-between items-center gap-4">
                            <div>
                                <div className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Retention Rate</div>
                                <div className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1">{stats.customerRetentionRate}%</div>
                            </div>
                            <div className="h-10 w-10 bg-sky-50 dark:bg-sky-950/50 rounded-xl flex items-center justify-center text-sky-600 dark:text-sky-400 font-bold text-sm">
                                CRR
                            </div>
                        </div>
                    </div>

                    {/* AI Insights Placeholder Panel (Future Proofing) */}
                    <div className="bg-gradient-to-r from-violet-50 via-indigo-50 to-cyan-50 dark:from-slate-900 dark:via-indigo-950/50 dark:to-slate-900 p-6 rounded-[2.5rem] border border-indigo-100/50 dark:border-indigo-900/50 shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-8 opacity-10"><MdAutorenew size={120} className="animate-spin-slow text-indigo-700 dark:text-indigo-400" /></div>
                        <div className="flex items-center gap-3">
                            <span className="flex h-3.5 w-3.5 relative">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-indigo-600"></span>
                            </span>
                            <h3 className="font-black text-indigo-950 dark:text-indigo-200 uppercase tracking-wider text-sm">AI CRM Intelligence Engine (Placeholder)</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
                            <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md p-5 rounded-2xl border border-white/55 dark:border-slate-800">
                                <h4 className="font-black text-xs text-rose-700 dark:text-rose-400 uppercase tracking-wider">⚠️ Accounts Likely To Churn</h4>
                                <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">Detects transaction drops and support escalations.</p>
                                <div className="mt-3 flex flex-col gap-1.5">
                                    <div className="flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-200">
                                        <span>Beta Builders Ltd</span>
                                        <span className="text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 px-2 py-0.5 rounded text-[10px] font-black">82% CHURN PROB</span>
                                    </div>
                                    <div className="flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-200">
                                        <span>Ganga Enterprises</span>
                                        <span className="text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 px-2 py-0.5 rounded text-[10px] font-black">74% CHURN PROB</span>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md p-5 rounded-2xl border border-white/55 dark:border-slate-800">
                                <h4 className="font-black text-xs text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">🚀 Upsell Opportunities</h4>
                                <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">Predicts CLV expansions based on order patterns.</p>
                                <div className="mt-3 flex flex-col gap-1.5">
                                    <div className="flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-200">
                                        <span>Sarah Smith (Alpha)</span>
                                        <span className="text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded text-[10px] font-black">92% UPSELL FIT</span>
                                    </div>
                                    <div className="flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-200">
                                        <span>Western Supplies</span>
                                        <span className="text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded text-[10px] font-black">85% UPSELL FIT</span>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md p-5 rounded-2xl border border-white/55 dark:border-slate-800">
                                <h4 className="font-black text-xs text-indigo-700 dark:text-indigo-400 uppercase tracking-wider">🧩 Cross-Sell Fitment</h4>
                                <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">Suggests product bundles that match customer assets.</p>
                                <div className="mt-3 flex flex-col gap-1.5">
                                    <div className="flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-200">
                                        <span>JD Interiors</span>
                                        <span className="text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded text-[10px] font-black">C&R PANELS</span>
                                    </div>
                                    <div className="flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-200">
                                        <span>Metro Source</span>
                                        <span className="text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded text-[10px] font-black">AMC PACKS</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Quick Widgets section */}
                    <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                        {/* New Customers today */}
                        <div className="bg-white dark:bg-slate-900/60 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm space-y-6">
                            <h3 className="font-black text-slate-800 dark:text-slate-100 text-sm uppercase tracking-wider">New Customers Today</h3>
                            <div className="space-y-4">
                                <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl">
                                    <div>
                                        <div className="font-bold text-slate-900 dark:text-slate-100 text-sm">Ganesh Electricals</div>
                                        <div className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-0.5">Maharashtra • Retail</div>
                                    </div>
                                    <span className="text-xs font-black text-primary-600 dark:text-primary-400">TODAY 11:30 AM</span>
                                </div>
                                <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl">
                                    <div>
                                        <div className="font-bold text-slate-900 dark:text-slate-100 text-sm">Apex Infrastructure</div>
                                        <div className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-0.5">Gujarat • Corporate</div>
                                    </div>
                                    <span className="text-xs font-black text-primary-600 dark:text-primary-400">TODAY 09:15 AM</span>
                                </div>
                            </div>
                        </div>

                        {/* Customers at Risk */}
                        <div className="bg-white dark:bg-slate-900/60 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm space-y-6">
                            <h3 className="font-black text-slate-800 dark:text-slate-100 text-sm uppercase tracking-wider">Accounts At Risk</h3>
                            <div className="space-y-4">
                                <div className="flex items-center justify-between bg-rose-50/50 dark:bg-rose-950/30 p-4 rounded-2xl border border-rose-100/50 dark:border-rose-900/40">
                                    <div>
                                        <div className="font-bold text-slate-900 dark:text-slate-100 text-sm">JD Interiors & Designs</div>
                                        <div className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-0.5">Health score: 42/100</div>
                                    </div>
                                    <span className="text-[10px] font-black text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 px-2.5 py-1 rounded-lg">RED ZONE</span>
                                </div>
                                <div className="flex items-center justify-between bg-amber-50/50 dark:bg-amber-950/30 p-4 rounded-2xl border border-amber-100/50 dark:border-amber-900/40">
                                    <div>
                                        <div className="font-bold text-slate-900 dark:text-slate-100 text-sm">Alpha Builders Pvt Ltd</div>
                                        <div className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-0.5">Health score: 58/100</div>
                                    </div>
                                    <span className="text-[10px] font-black text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 px-2.5 py-1 rounded-lg">WATCH ZONE</span>
                                </div>
                            </div>
                        </div>

                        {/* Pending follow ups */}
                        <div className="bg-white dark:bg-slate-900/60 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm space-y-6">
                            <h3 className="font-black text-slate-800 dark:text-slate-100 text-sm uppercase tracking-wider">Pending Follow-ups</h3>
                            <div className="space-y-4">
                                <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl">
                                    <div>
                                        <div className="font-bold text-slate-900 dark:text-slate-100 text-sm">Contract Renewal Meeting</div>
                                        <div className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-0.5">With Rohit Mehta (Western Trade)</div>
                                    </div>
                                    <span className="text-xs font-black text-slate-600 dark:text-slate-400">TOMORROW</span>
                                </div>
                                <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl">
                                    <div>
                                        <div className="font-bold text-slate-900 dark:text-slate-100 text-sm">Technical SLA Support Check</div>
                                        <div className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-0.5">With Sarah Smith (Alpha Builders)</div>
                                    </div>
                                    <span className="text-xs font-black text-slate-600 dark:text-slate-400">IN 3 DAYS</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB: Table Directory */}
            {activeTab === 'table' && (
                <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
                    <div className="p-6 border-b border-slate-50 flex flex-col md:flex-row gap-4 items-center bg-slate-50/30">
                        <div className="relative flex-1 w-full text-slate-400 focus-within:text-primary-600 transition-colors">
                            <MdSearch className="absolute left-4 top-1/2 -translate-y-1/2" size={20} />
                            <input
                                type="text"
                                placeholder="Search by Code, Company, GST or PAN..."
                                className="w-full pl-12 pr-4 py-3.5 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 outline-none text-sm text-slate-900 transition-all font-medium"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left whitespace-nowrap">
                            <thead className="bg-slate-50/50 text-slate-400 text-[10px] uppercase font-black tracking-widest border-b border-slate-100">
                                <tr>
                                    <th className="px-6 py-5">Customer Code</th>
                                    <th className="px-6 py-5">Company</th>
                                    <th className="px-6 py-5">GSTIN / PAN</th>
                                    <th className="px-6 py-5">Owner</th>
                                    <th className="px-6 py-5">Industry</th>
                                    <th className="px-6 py-5">Segment</th>
                                    <th className="px-6 py-5 text-right">Outstanding</th>
                                    <th className="px-6 py-5 text-right">LTV (CLV)</th>
                                    <th className="px-6 py-5 text-center">Orders</th>
                                    <th className="px-6 py-5">Health</th>
                                    <th className="px-6 py-5">Status</th>
                                    <th className="px-6 py-5 text-right">Last Purchase</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 font-bold text-slate-700 text-sm">
                                {tableData.map((c) => (
                                    <tr 
                                        key={c._id} 
                                        onClick={() => navigate(`/customers/${c._id}/360`)}
                                        className="hover:bg-slate-50/60 transition-all cursor-pointer group"
                                    >
                                        <td className="px-6 py-5 text-slate-400 group-hover:text-primary-600 transition-colors font-semibold">{c.customerName}</td>
                                        <td className="px-6 py-5">
                                            <div className="flex items-center gap-3">
                                                <div className="h-8 w-8 rounded-lg bg-slate-50 border border-slate-100 p-1 flex-shrink-0">
                                                    {c.logoUrl ? (
                                                        <img src={resolveImageUrl(c.logoUrl)} alt="" className="h-full w-full object-contain" />
                                                    ) : (
                                                        <div className="h-full w-full flex items-center justify-center text-primary-600 bg-primary-50 rounded font-black text-xs">
                                                            {c.companyName?.substring(0, 1)}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="font-black text-slate-900 group-hover:text-primary-600 transition-colors">{c.companyName}</div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5 font-mono text-xs">
                                            <div>{c.gstin || 'N/A'}</div>
                                            <div className="text-slate-400 font-normal">{c.pan || 'N/A'}</div>
                                        </td>
                                        <td className="px-6 py-5 text-slate-500 font-semibold">{c.owner?.name || 'Unassigned'}</td>
                                        <td className="px-6 py-5 text-slate-500 font-semibold">{c.industry || 'Other'}</td>
                                        <td className="px-6 py-5">
                                            <span className="text-[10px] uppercase bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-black">
                                                {c.segment || 'Retail'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-5 text-right font-mono text-rose-600">₹{(c.outstanding || 0).toLocaleString()}</td>
                                        <td className="px-6 py-5 text-right font-mono text-indigo-600">₹{(c.clv || 0).toLocaleString()}</td>
                                        <td className="px-6 py-5 text-center font-mono">{c.invoiceCount || 0}</td>
                                        <td className="px-6 py-5">
                                            <div className="flex items-center gap-2">
                                                <span className={`h-2.5 w-2.5 rounded-full ${
                                                    c.health?.color === 'green' ? 'bg-emerald-500' :
                                                    c.health?.color === 'blue' ? 'bg-blue-500' :
                                                    c.health?.color === 'yellow' ? 'bg-amber-400' : 'bg-rose-500'
                                                }`}></span>
                                                <span className="font-bold text-xs">{c.health?.score || 70} ({c.health?.status || 'Good'})</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <span className={`text-[10px] uppercase font-black px-2.5 py-1 rounded-lg border ${
                                                c.status === 'Active' ? 'bg-emerald-50 border-emerald-100 text-emerald-700' :
                                                c.status === 'New' ? 'bg-blue-50 border-blue-100 text-blue-700' :
                                                c.status === 'VIP' ? 'bg-indigo-50 border-indigo-100 text-indigo-700' :
                                                c.status === 'Lost' ? 'bg-rose-50 border-rose-100 text-rose-700' : 'bg-slate-50 border-slate-100 text-slate-600'
                                            }`}>
                                                {c.status || 'Prospect'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-5 text-right text-slate-400 text-xs font-semibold">
                                            {c.lastPurchaseDate ? new Date(c.lastPurchaseDate).toLocaleDateString() : 'N/A'}
                                        </td>
                                    </tr>
                                ))}
                                {tableData.length === 0 && (
                                    <tr>
                                        <td colSpan="12" className="p-16 text-center text-slate-400 font-bold uppercase tracking-widest text-xs">
                                            No customers found matching current segmentation filters.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* TAB: Segmentation Charts */}
            {activeTab === 'segmentation' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {/* Industry */}
                    <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
                        <h3 className="font-black text-slate-800 text-sm uppercase tracking-wider flex items-center gap-2">
                            <MdPieChart className="text-primary-600" size={18} />
                            Industry Distribution
                        </h3>
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={segmentData.byIndustry || []}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="count"
                                    >
                                        {(segmentData.byIndustry || []).map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                    <Legend formatter={(value, entry) => <span className="text-xs font-bold text-slate-600">{value}</span>} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Value segment */}
                    <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
                        <h3 className="font-black text-slate-800 text-sm uppercase tracking-wider flex items-center gap-2">
                            <MdBarChart className="text-indigo-600" size={18} />
                            Value Segments
                        </h3>
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={segmentData.bySegment || []} layout="vertical">
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                    <XAxis type="number" hide />
                                    <YAxis dataKey="name" type="category" width={100} axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold', fill: '#64748b' }} />
                                    <Tooltip />
                                    <Bar dataKey="count" radius={[0, 8, 8, 0]}>
                                        {(segmentData.bySegment || []).map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[(index + 2) % COLORS.length]} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Behavior Status */}
                    <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
                        <h3 className="font-black text-slate-800 text-sm uppercase tracking-wider flex items-center gap-2">
                            <MdShowChart className="text-emerald-600" size={18} />
                            Behavioral status
                        </h3>
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={segmentData.byStatus || []}
                                        cx="50%"
                                        cy="50%"
                                        outerRadius={80}
                                        dataKey="count"
                                    >
                                        {(segmentData.byStatus || []).map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[(index + 4) % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                    <Legend formatter={(value) => <span className="text-xs font-bold text-slate-600">{value}</span>} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB: Growth Analytics */}
            {activeTab === 'growth' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
                        <h3 className="font-black text-slate-800 text-sm uppercase tracking-wider">Customer Acquisition Trend</h3>
                        <div className="h-80">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={repeatData}>
                                    <defs>
                                        <linearGradient id="growthColor" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="month" tick={{ fontSize: 10, fontWeight: 'bold' }} />
                                    <YAxis tick={{ fontSize: 10, fontWeight: 'bold' }} />
                                    <Tooltip />
                                    <Area type="monotone" dataKey="newCustomers" name="New Acquisitions" stroke="#6366f1" fillOpacity={1} fill="url(#growthColor)" strokeWidth={3} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
                        <h3 className="font-black text-slate-800 text-sm uppercase tracking-wider">Quarterly Lead Conversion Rate</h3>
                        <div className="h-80">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={[
                                    { quarter: 'Q1 FY26', rate: 42 },
                                    { quarter: 'Q2 FY26', rate: 48 },
                                    { quarter: 'Q3 FY26', rate: 52 },
                                    { quarter: 'Q4 FY26', rate: 56 }
                                ]}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="quarter" tick={{ fontSize: 10, fontWeight: 'bold' }} />
                                    <YAxis tick={{ fontSize: 10, fontWeight: 'bold' }} unit="%" />
                                    <Tooltip />
                                    <Bar dataKey="rate" name="Conversion Rate" fill="#10b981" radius={[8, 8, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB: Retention & Churn */}
            {activeTab === 'retention' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
                        <h3 className="font-black text-slate-800 text-sm uppercase tracking-wider">Customer Churn Trend</h3>
                        <div className="h-80">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={retentionData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="month" tick={{ fontSize: 10, fontWeight: 'bold' }} />
                                    <YAxis tick={{ fontSize: 10, fontWeight: 'bold' }} unit="%" />
                                    <Tooltip />
                                    <Line type="monotone" dataKey="churn" name="Churn Rate" stroke="#ef4444" strokeWidth={3} activeDot={{ r: 8 }} />
                                    <Line type="monotone" dataKey="rate" name="Retention Rate" stroke="#10b981" strokeWidth={3} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
                        <h3 className="font-black text-slate-800 text-sm uppercase tracking-wider">Dormant & Churned Accounts Aging</h3>
                        <div className="space-y-4">
                            <div className="p-4 bg-slate-50 rounded-2xl flex justify-between items-center">
                                <div>
                                    <div className="font-bold text-slate-900">Dormant Accounts (90 - 180 Days)</div>
                                    <div className="text-slate-400 text-xs mt-0.5">Need immediate reactivation outreach</div>
                                </div>
                                <span className="text-lg font-black text-amber-600">32 Accounts</span>
                            </div>
                            <div className="p-4 bg-slate-50 rounded-2xl flex justify-between items-center">
                                <div>
                                    <div className="font-bold text-slate-900">Highly Inactive (180 - 365 Days)</div>
                                    <div className="text-slate-400 text-xs mt-0.5">Likely lost or switched to competitors</div>
                                </div>
                                <span className="text-lg font-black text-rose-500">18 Accounts</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB: Satisfaction & CSAT */}
            {activeTab === 'satisfaction' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
                        <h3 className="font-black text-slate-800 text-sm uppercase tracking-wider">CSAT Trend By Month</h3>
                        <div className="h-80">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={[
                                    { month: 'Jan', csat: 82 },
                                    { month: 'Feb', csat: 84 },
                                    { month: 'Mar', csat: 85 },
                                    { month: 'Apr', csat: 88 },
                                    { month: 'May', csat: 89 },
                                    { month: 'Jun', csat: 91 }
                                ]}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="month" tick={{ fontSize: 10, fontWeight: 'bold' }} />
                                    <YAxis tick={{ fontSize: 10, fontWeight: 'bold' }} unit="%" domain={[70, 100]} />
                                    <Tooltip />
                                    <Area type="monotone" dataKey="csat" name="CSAT Rate" stroke="#10b981" fill="#10b981" fillOpacity={0.1} strokeWidth={3} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
                        <h3 className="font-black text-slate-800 text-sm uppercase tracking-wider">SLA Resolution Performance</h3>
                        <div className="space-y-4">
                            <div className="p-4 bg-slate-50 rounded-2xl flex justify-between items-center">
                                <div>
                                    <div className="font-bold text-slate-900">Average Resolution Time</div>
                                    <div className="text-slate-400 text-xs">For technical tier-1 panels support</div>
                                </div>
                                <span className="text-lg font-black text-slate-800">4.2 Hours</span>
                            </div>
                            <div className="p-4 bg-slate-50 rounded-2xl flex justify-between items-center">
                                <div>
                                    <div className="font-bold text-slate-900">First Contact Resolution Rate (FCR)</div>
                                    <div className="text-slate-400 text-xs">Resolved on initial site check</div>
                                </div>
                                <span className="text-lg font-black text-emerald-600">74.2%</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB: Financial Analytics */}
            {activeTab === 'financial' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* CLV Distribution */}
                    <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
                        <h3 className="font-black text-slate-800 text-sm uppercase tracking-wider">Customer Lifetime Value (CLV) Distribution</h3>
                        <div className="h-80">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={clvData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="range" tick={{ fontSize: 10, fontWeight: 'bold' }} />
                                    <YAxis tick={{ fontSize: 10, fontWeight: 'bold' }} />
                                    <Tooltip />
                                    <Bar dataKey="count" name="Customers count" fill="#6366f1" radius={[8, 8, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Outstanding Aging */}
                    <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
                        <h3 className="font-black text-slate-800 text-sm uppercase tracking-wider">Receivables Aging Breakdown</h3>
                        <div className="h-80">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={outstandingData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="range" tick={{ fontSize: 10, fontWeight: 'bold' }} />
                                    <YAxis tick={{ fontSize: 10, fontWeight: 'bold' }} />
                                    <Tooltip />
                                    <Bar dataKey="amount" name="Outstanding Balance" fill="#ef4444" radius={[8, 8, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB: Reports List */}
            {activeTab === 'reports' && (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-8">
                    {/* Operational */}
                    <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm space-y-6 flex flex-col justify-between">
                        <div>
                            <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full uppercase tracking-wider">Operational</span>
                            <h3 className="font-black text-slate-800 text-base mt-4">Customer Directory & Demographics</h3>
                            <p className="text-slate-400 text-xs mt-2 leading-relaxed">
                                Complete list of active accounts, branch designations, owners, territory groupings, contact details, and locations.
                            </p>
                        </div>
                        <button
                            onClick={() => handleExport('excel')}
                            className="w-full flex items-center justify-center gap-2 bg-slate-50 hover:bg-slate-100 text-slate-700 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all mt-6"
                        >
                            Export Directory
                            <MdNavigateNext size={16} />
                        </button>
                    </div>

                    {/* Financial */}
                    <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm space-y-6 flex flex-col justify-between">
                        <div>
                            <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full uppercase tracking-wider">Financial</span>
                            <h3 className="font-black text-slate-800 text-base mt-4">CLV & Receivables Ledger</h3>
                            <p className="text-slate-400 text-xs mt-2 leading-relaxed">
                                Detailed summary of gross revenues (LTV), total billing amounts, unpaid invoice tracking, and outstanding balances.
                            </p>
                        </div>
                        <button
                            onClick={() => handleExport('excel')}
                            className="w-full flex items-center justify-center gap-2 bg-slate-50 hover:bg-slate-100 text-slate-700 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all mt-6"
                        >
                            Export Financials
                            <MdNavigateNext size={16} />
                        </button>
                    </div>

                    {/* Growth & Churn */}
                    <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm space-y-6 flex flex-col justify-between">
                        <div>
                            <span className="text-[10px] font-black text-amber-600 bg-amber-50 px-3 py-1 rounded-full uppercase tracking-wider">Growth</span>
                            <h3 className="font-black text-slate-800 text-base mt-4">Acquisition & Retention Index</h3>
                            <p className="text-slate-400 text-xs mt-2 leading-relaxed">
                                Analysis of newly registered accounts, repeat purchase behavior trends, dormancy timelines, and churn index logs.
                            </p>
                        </div>
                        <button
                            onClick={() => handleExport('excel')}
                            className="w-full flex items-center justify-center gap-2 bg-slate-50 hover:bg-slate-100 text-slate-700 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all mt-6"
                        >
                            Export Retention Report
                            <MdNavigateNext size={16} />
                        </button>
                    </div>

                    {/* Service & CSAT */}
                    <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm space-y-6 flex flex-col justify-between">
                        <div>
                            <span className="text-[10px] font-black text-rose-600 bg-rose-50 px-3 py-1 rounded-full uppercase tracking-wider">Relationship</span>
                            <h3 className="font-black text-slate-800 text-base mt-4">CSAT & Service Tickets Log</h3>
                            <p className="text-slate-400 text-xs mt-2 leading-relaxed">
                                Customer support statistics, open/resolved ticket logs, SLA compliance breach tracking, and survey feedback ratings.
                            </p>
                        </div>
                        <button
                            onClick={() => handleExport('excel')}
                            className="w-full flex items-center justify-center gap-2 bg-slate-50 hover:bg-slate-100 text-slate-700 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all mt-6"
                        >
                            Export Satisfaction Logs
                            <MdNavigateNext size={16} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CustomerAnalytics;
