import React, { useState, useEffect } from 'react';
import { clmService, customerService, cpqService, productService, importService } from '../services/api';
import { toast } from 'react-toastify';
import { 
    MdAdd, MdDelete, MdAssignment, MdDateRange, MdDashboard, MdList, 
    MdViewKanban, MdAttachMoney, MdSecurity, MdAlarm, MdClose, MdLayers,
    MdPeople, MdDescription, MdPlayArrow, MdCheckCircle, MdWarning, MdArrowForward,
    MdSettings, MdAssessment, MdFolderOpen, MdStar, MdEdit, MdAddCircle, MdCheck, MdEmail, MdHistory, MdFileOpen,
    MdFileDownload, MdFileUpload
} from 'react-icons/md';
import Modal from '../components/Modal';
import ImportModal from '../components/ImportModal';
import * as XLSX from 'xlsx';

const Contracts = ({ mode = 'dashboard' }) => {
    // Current CLM view selection: 'dashboard' | 'contracts' | 'templates' | 'clauses' | 'approvals' | 'renewals' | 'reports' | 'settings'
    const [currentTab, setCurrentTab] = useState(mode);

    useEffect(() => {
        setCurrentTab(mode);
        setActiveWorkspaceContract(null);
        setSelectedReport(null);
    }, [mode]);

    useEffect(() => {
        setSelectedReport(null);
    }, [currentTab]);
    
    // In-place Contract Workspace focus
    const [activeWorkspaceContract, setActiveWorkspaceContract] = useState(null);
    const [workspaceTab, setWorkspaceTab] = useState('overview');

    // Core Data State
    const [contracts, setContracts] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [products, setProducts] = useState([]);
    const [dashboardData, setDashboardData] = useState(null);
    const [loading, setLoading] = useState(true);

    // Sub-data states
    const [templates, setTemplates] = useState([]);
    const [clauses, setClauses] = useState([]);
    const [themes, setThemes] = useState([]);
    const [contractCategories, setContractCategories] = useState([]);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [showCategoryInput, setShowCategoryInput] = useState(false);
    
    // Selected template for compilation
    const [selectedTemplateId, setSelectedTemplateId] = useState('');
    const [selectedReport, setSelectedReport] = useState(null);
    const [contractVersions, setContractVersions] = useState([]);
    const [activeVersionHtml, setActiveVersionHtml] = useState('');

    // Editor content states
    const [editorHtml, setEditorHtml] = useState('');
    const [editorStyles, setEditorStyles] = useState('');

    // Modals
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [isClauseModalOpen, setIsClauseModalOpen] = useState(false);
    const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);

    // Workspace comment feed
    const [workspaceComments, setWorkspaceComments] = useState([
        { user: 'Sales Exec', text: 'Contract created from standard SLA template.', date: 'Today, 10:15 AM' },
        { user: 'System Bot', text: 'Locked pricing rates mapped and validated.', date: 'Today, 10:17 AM' }
    ]);
    const [newCommentText, setNewCommentText] = useState('');

    // Workspace attachment uploads
    const [workspaceAttachments, setWorkspaceAttachments] = useState([
        { name: 'SLA_Scope_Specs.pdf', size: '2.4 MB', type: 'Agreement' },
        { name: 'Pricing_Agreement_Locks.xlsx', size: '1.1 MB', type: 'Rate Sheet' }
    ]);

    // Creation Form States
    const [contractForm, setContractForm] = useState({
        contractNumber: '',
        title: '',
        customerId: '',
        startDate: '',
        endDate: '',
        value: 0,
        category: 'Sales Agreement',
        renewalRules: 'Auto-Renew annually'
    });

    const [clauseForm, setClauseForm] = useState({
        title: '',
        category: 'Payment',
        content: '',
        tags: ''
    });

    const [templateForm, setTemplateForm] = useState({
        name: '',
        category: 'Sales Agreement',
        htmlContent: '<h1>Agreement</h1><p>Insert terms here...</p>',
        cssContent: ''
    });

    // Filters
    const [contractsFilter, setContractsFilter] = useState('All');
    const [searchTerm, setSearchTerm] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('');
    const [valueFilter, setValueFilter] = useState('');

    // Settings States
    const [reminderDays, setReminderDays] = useState(30);
    const [renewalRuleDefault, setRenewalRuleDefault] = useState('Auto-Renew');

    useEffect(() => {
        fetchMetadata();
        fetchContracts();
        fetchDashboard();
    }, []);

    const fetchMetadata = async () => {
        try {
            const [custRes, prodRes, templatesRes, clausesRes, themesRes, catRes] = await Promise.all([
                customerService.getAll({}),
                productService.getAll({ limit: 1000 }),
                clmService.getTemplates(),
                clmService.getClauses(),
                clmService.getThemes(),
                clmService.getCategories()
            ]);
            setCustomers(Array.isArray(custRes.data) ? custRes.data : custRes.data?.data || []);
            setProducts(Array.isArray(prodRes.data) ? prodRes.data : prodRes.data?.data || []);
            setTemplates(templatesRes.data || []);
            setClauses(clausesRes.data || []);
            setThemes(themesRes.data || []);
            setContractCategories(catRes.data || []);
        } catch (err) {
            console.error("Load CLM metadata error:", err);
        }
    };

    const fetchContracts = async () => {
        setLoading(true);
        try {
            const res = await clmService.getContracts({});
            setContracts(res.data || []);
        } catch (err) {
            toast.error("Failed to load contracts");
        } finally {
            setLoading(false);
        }
    };

    const fetchDashboard = async () => {
        try {
            const res = await clmService.getDashboard();
            setDashboardData(res.data);
        } catch (err) {
            console.error("Load CLM Dashboard error:", err);
        }
    };

    const handleAddCategory = async (e) => {
        e.preventDefault();
        if (!newCategoryName.trim()) return;
        try {
            const res = await clmService.createCategory({ name: newCategoryName.trim() });
            setContractCategories(prev => [...prev, res.data]);
            setContractForm(prev => ({ ...prev, category: res.data.name }));
            setNewCategoryName('');
            setShowCategoryInput(false);
            toast.success("Category added to master!");
        } catch (err) {
            toast.error("Failed to add category");
        }
    };

    const handleExportContracts = () => {
        if (!contracts || contracts.length === 0) {
            toast.warn("No contracts available to export.");
            return;
        }
        const exportData = contracts.map(c => ({
            'Contract Number': c.contractNumber,
            'Title': c.title,
            'Customer Partner': c.customerId?.companyName || c.customerId?.customerName || '-',
            'Start Date': c.startDate ? new Date(c.startDate).toISOString().substring(0, 10) : '',
            'End Date': c.endDate ? new Date(c.endDate).toISOString().substring(0, 10) : '',
            'Remaining Days': c.remainingDays || 0,
            'Category': c.category || 'Sales Agreement',
            'Value (INR)': c.value || 0,
            'Status': c.status || 'Draft',
            'Approval Status': c.approvalStatus || 'Draft',
            'Renewal Rules': c.renewalRules || 'Auto-Renew annually'
        }));

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Contracts Register');
        XLSX.writeFile(wb, `Contracts_Register_${new Date().toISOString().slice(0, 10)}.xlsx`);
        toast.success("Contracts register exported successfully!");
    };

    const getReportData = (reportKey) => {
        switch (reportKey) {
            case 'active_contracts': {
                const list = contracts.filter(c => c.status === 'Active');
                const totalVal = list.reduce((acc, c) => acc + (c.value || 0), 0);
                return {
                    title: 'Active Contracts Report',
                    desc: 'Lists all currently active agreements, their values, and owners.',
                    kpis: [
                        { label: 'Active Contracts', value: list.length },
                        { label: 'Total Active Value', value: `₹${totalVal.toLocaleString()}` }
                    ],
                    headers: ['Contract No', 'Title', 'Customer', 'Value', 'End Date', 'Owner'],
                    rows: list.map(c => [
                        c.contractNumber,
                        c.title,
                        c.customerId?.companyName || c.customerId?.customerName || '-',
                        `₹${(c.value || 0).toLocaleString()}`,
                        c.endDate ? new Date(c.endDate).toLocaleDateString() : '-',
                        c.owner?.name || 'Sales Rep'
                    ]),
                    exportData: list.map(c => ({
                        'Contract Number': c.contractNumber,
                        'Title': c.title,
                        'Customer': c.customerId?.companyName || c.customerId?.customerName || '-',
                        'Value (INR)': c.value || 0,
                        'End Date': c.endDate ? new Date(c.endDate).toISOString().substring(0, 10) : '',
                        'Owner': c.owner?.name || 'Sales Rep'
                    })),
                    fileName: 'Active_Contracts_Report'
                };
            }
            case 'expired_contracts': {
                const list = contracts.filter(c => c.status === 'Expired');
                const totalVal = list.reduce((acc, c) => acc + (c.value || 0), 0);
                return {
                    title: 'Expired Contracts Report',
                    desc: 'Agreements that have passed their end dates and are no longer active.',
                    kpis: [
                        { label: 'Expired Contracts', value: list.length },
                        { label: 'Expired Value', value: `₹${totalVal.toLocaleString()}` }
                    ],
                    headers: ['Contract No', 'Title', 'Customer', 'Value', 'Expired Date', 'Owner'],
                    rows: list.map(c => [
                        c.contractNumber,
                        c.title,
                        c.customerId?.companyName || c.customerId?.customerName || '-',
                        `₹${(c.value || 0).toLocaleString()}`,
                        c.endDate ? new Date(c.endDate).toLocaleDateString() : '-',
                        c.owner?.name || 'Sales Rep'
                    ]),
                    exportData: list.map(c => ({
                        'Contract Number': c.contractNumber,
                        'Title': c.title,
                        'Customer': c.customerId?.companyName || c.customerId?.customerName || '-',
                        'Value (INR)': c.value || 0,
                        'Expired Date': c.endDate ? new Date(c.endDate).toISOString().substring(0, 10) : '',
                        'Owner': c.owner?.name || 'Sales Rep'
                    })),
                    fileName: 'Expired_Contracts_Report'
                };
            }
            case 'expiring_contracts': {
                const list = contracts.filter(c => {
                    if (c.status !== 'Active') return false;
                    const days = c.remainingDays;
                    return days >= 0 && days <= 90;
                });
                return {
                    title: 'Expiring Contracts Report',
                    desc: 'Active agreements scheduled to expire within the next 90 days.',
                    kpis: [
                        { label: 'Expiring (90 Days)', value: list.length },
                        { label: 'Due in 30 Days', value: list.filter(c => c.remainingDays <= 30).length }
                    ],
                    headers: ['Contract No', 'Title', 'Customer', 'Value', 'Remaining Days', 'End Date'],
                    rows: list.map(c => [
                        c.contractNumber,
                        c.title,
                        c.customerId?.companyName || c.customerId?.customerName || '-',
                        `₹${(c.value || 0).toLocaleString()}`,
                        `${c.remainingDays} Days`,
                        c.endDate ? new Date(c.endDate).toLocaleDateString() : '-'
                    ]),
                    exportData: list.map(c => ({
                        'Contract Number': c.contractNumber,
                        'Title': c.title,
                        'Customer': c.customerId?.companyName || c.customerId?.customerName || '-',
                        'Value (INR)': c.value || 0,
                        'Remaining Days': c.remainingDays || 0,
                        'End Date': c.endDate ? new Date(c.endDate).toISOString().substring(0, 10) : ''
                    })),
                    fileName: 'Expiring_Contracts_Report'
                };
            }
            case 'draft_contracts': {
                const list = contracts.filter(c => c.status === 'Draft');
                return {
                    title: 'Draft Contracts Report',
                    desc: 'Work-in-progress agreements currently being authored.',
                    kpis: [
                        { label: 'Draft Agreements', value: list.length },
                        { label: 'Draft Value', value: `₹${list.reduce((acc, c) => acc + (c.value || 0), 0).toLocaleString()}` }
                    ],
                    headers: ['Contract No', 'Title', 'Customer', 'Value', 'Owner'],
                    rows: list.map(c => [
                        c.contractNumber,
                        c.title,
                        c.customerId?.companyName || c.customerId?.customerName || '-',
                        `₹${(c.value || 0).toLocaleString()}`,
                        c.owner?.name || 'Sales Rep'
                    ]),
                    exportData: list.map(c => ({
                        'Contract Number': c.contractNumber,
                        'Title': c.title,
                        'Customer': c.customerId?.companyName || c.customerId?.customerName || '-',
                        'Value (INR)': c.value || 0,
                        'Owner': c.owner?.name || 'Sales Rep'
                    })),
                    fileName: 'Draft_Contracts_Report'
                };
            }
            case 'pending_approval': {
                const list = contracts.filter(c => c.status === 'Pending Approval');
                return {
                    title: 'Pending Approval Report',
                    desc: 'Contracts completed and awaiting stakeholder signature/verifications.',
                    kpis: [
                        { label: 'Pending Approvals', value: list.length },
                        { label: 'Pending Value', value: `₹${list.reduce((acc, c) => acc + (c.value || 0), 0).toLocaleString()}` }
                    ],
                    headers: ['Contract No', 'Title', 'Customer', 'Value', 'Approval Status'],
                    rows: list.map(c => [
                        c.contractNumber,
                        c.title,
                        c.customerId?.companyName || c.customerId?.customerName || '-',
                        `₹${(c.value || 0).toLocaleString()}`,
                        c.approvalStatus || 'Pending Approval'
                    ]),
                    exportData: list.map(c => ({
                        'Contract Number': c.contractNumber,
                        'Title': c.title,
                        'Customer': c.customerId?.companyName || c.customerId?.customerName || '-',
                        'Value (INR)': c.value || 0,
                        'Approval Status': c.approvalStatus || 'Pending Approval'
                    })),
                    fileName: 'Pending_Approval_Report'
                };
            }
            case 'value_analysis': {
                const total = contracts.reduce((acc, c) => acc + (c.value || 0), 0);
                const avg = contracts.length ? total / contracts.length : 0;
                const sorted = [...contracts].sort((a,b) => (b.value || 0) - (a.value || 0));
                const highest = sorted[0]?.value || 0;
                return {
                    title: 'Contract Value Analysis',
                    desc: 'Aggregate value insights and top-tier highest value contract rankings.',
                    kpis: [
                        { label: 'Total Value', value: `₹${total.toLocaleString()}` },
                        { label: 'Average Value', value: `₹${Math.round(avg).toLocaleString()}` },
                        { label: 'Highest Value', value: `₹${highest.toLocaleString()}` }
                    ],
                    headers: ['Contract No', 'Title', 'Customer', 'Value', 'Category'],
                    rows: sorted.slice(0, 10).map(c => [
                        c.contractNumber,
                        c.title,
                        c.customerId?.companyName || c.customerId?.customerName || '-',
                        `₹${(c.value || 0).toLocaleString()}`,
                        c.category
                    ]),
                    exportData: sorted.map(c => ({
                        'Contract Number': c.contractNumber,
                        'Title': c.title,
                        'Customer': c.customerId?.companyName || c.customerId?.customerName || '-',
                        'Value (INR)': c.value || 0,
                        'Category': c.category
                    })),
                    fileName: 'Contract_Value_Analysis_Report'
                };
            }
            case 'revenue_customer': {
                const custMap = {};
                contracts.forEach(c => {
                    const name = c.customerId?.companyName || c.customerId?.customerName || 'Other';
                    if (!custMap[name]) custMap[name] = { count: 0, val: 0 };
                    custMap[name].count++;
                    custMap[name].val += (c.value || 0);
                });
                const sortedCusts = Object.keys(custMap).map(k => ({
                    customer: k,
                    count: custMap[k].count,
                    val: custMap[k].val
                })).sort((a,b) => b.val - a.val);

                return {
                    title: 'Revenue by Customer',
                    desc: 'Revenue concentration breakdown across customer partners.',
                    kpis: [
                        { label: 'Unique Customers', value: sortedCusts.length },
                        { label: 'Top Customer Share', value: `₹${(sortedCusts[0]?.val || 0).toLocaleString()}` }
                    ],
                    headers: ['Customer Name', 'Agreements Count', 'Total Active Revenue'],
                    rows: sortedCusts.map(c => [
                        c.customer,
                        c.count,
                        `₹${c.val.toLocaleString()}`
                    ]),
                    exportData: sortedCusts.map(c => ({
                        'Customer Name': c.customer,
                        'Agreements Count': c.count,
                        'Total Revenue (INR)': c.val
                    })),
                    fileName: 'Revenue_by_Customer_Report'
                };
            }
            case 'revenue_category': {
                const catMap = {};
                contracts.forEach(c => {
                    const cat = c.category || 'Uncategorized';
                    if (!catMap[cat]) catMap[cat] = { count: 0, val: 0 };
                    catMap[cat].count++;
                    catMap[cat].val += (c.value || 0);
                });
                const sortedCats = Object.keys(catMap).map(k => ({
                    category: k,
                    count: catMap[k].count,
                    val: catMap[k].val
                })).sort((a,b) => b.val - a.val);

                return {
                    title: 'Revenue by Category',
                    desc: 'Revenue mapping by legal category templates.',
                    kpis: [
                        { label: 'Categories Count', value: sortedCats.length },
                        { label: 'Top Category Value', value: `₹${(sortedCats[0]?.val || 0).toLocaleString()}` }
                    ],
                    headers: ['Category', 'Contracts Count', 'Total Locked Revenue'],
                    rows: sortedCats.map(c => [
                        c.category,
                        c.count,
                        `₹${c.val.toLocaleString()}`
                    ]),
                    exportData: sortedCats.map(c => ({
                        'Category': c.category,
                        'Contracts Count': c.count,
                        'Total Revenue (INR)': c.val
                    })),
                    fileName: 'Revenue_by_Category_Report'
                };
            }
            case 'renewal_tracker': {
                const list = contracts.map(c => ({
                    contractNumber: c.contractNumber,
                    title: c.title,
                    customer: c.customerId?.companyName || c.customerId?.customerName || '-',
                    status: c.renewalStatus || 'Pending',
                    days: c.remainingDays || 0,
                    rules: c.renewalRules || 'Auto-Renew'
                })).sort((a,b) => a.days - b.days);

                return {
                    title: 'Renewal Tracker',
                    desc: 'Lifecycle trackers of contracts status and their upcoming renewals due.',
                    kpis: [
                        { label: 'Total Tracked', value: list.length },
                        { label: 'Auto-Renew Set', value: list.filter(l => l.rules.toLowerCase().includes('auto')).length }
                    ],
                    headers: ['Contract No', 'Title', 'Customer', 'Renewal Status', 'Days Remaining', 'Renewal Policy'],
                    rows: list.map(c => [
                        c.contractNumber,
                        c.title,
                        c.customer,
                        c.status,
                        `${c.days} Days`,
                        c.rules
                    ]),
                    exportData: list.map(c => ({
                        'Contract Number': c.contractNumber,
                        'Title': c.title,
                        'Customer': c.customer,
                        'Renewal Status': c.status,
                        'Days Remaining': c.days,
                        'Renewal Policy': c.rules
                    })),
                    fileName: 'Renewal_Tracker_Report'
                };
            }
            case 'renewal_success_rate': {
                const renewed = contracts.filter(c => c.renewalStatus === 'Renewed').length;
                const lost = contracts.filter(c => c.renewalStatus === 'Lost').length;
                const rate = renewed + lost > 0 ? (renewed / (renewed + lost)) * 100 : 100;
                return {
                    title: 'Renewal Success Rate',
                    desc: 'Conversion efficiency calculations of renewed vs lost/terminated accounts.',
                    kpis: [
                        { label: 'Success Rate', value: `${rate.toFixed(1)}%` },
                        { label: 'Renewed Deals', value: renewed },
                        { label: 'Lost Deals', value: lost }
                    ],
                    headers: ['Metric', 'Count', 'Percentage Share'],
                    rows: [
                        ['Renewed Contracts', renewed, `${(renewed + lost > 0 ? (renewed / (renewed + lost)) * 100 : 100).toFixed(1)}%`],
                        ['Lost Contracts', lost, `${(renewed + lost > 0 ? (lost / (renewed + lost)) * 100 : 0).toFixed(1)}%`]
                    ],
                    exportData: [
                        { 'Metric': 'Renewed Contracts', 'Count': renewed, 'Percentage': `${(renewed + lost > 0 ? (renewed / (renewed + lost)) * 100 : 100).toFixed(1)}%` },
                        { 'Metric': 'Lost Contracts', 'Count': lost, 'Percentage': `${(renewed + lost > 0 ? (lost / (renewed + lost)) * 100 : 0).toFixed(1)}%` }
                    ],
                    fileName: 'Renewal_Success_Rate_Report'
                };
            }
            case 'upcoming_renewals': {
                const list = contracts.filter(c => c.remainingDays >= 0 && c.remainingDays <= 30);
                return {
                    title: 'Upcoming Renewals',
                    desc: 'High-alert contracts due for renewal review within 30 days.',
                    kpis: [
                        { label: 'Due in 30 Days', value: list.length },
                        { label: 'Value at Risk', value: `₹${list.reduce((acc, c) => acc + (c.value || 0), 0).toLocaleString()}` }
                    ],
                    headers: ['Contract No', 'Title', 'Customer', 'Value', 'Days Remaining', 'End Date'],
                    rows: list.map(c => [
                        c.contractNumber,
                        c.title,
                        c.customerId?.companyName || c.customerId?.customerName || '-',
                        `₹${(c.value || 0).toLocaleString()}`,
                        `${c.remainingDays} Days`,
                        c.endDate ? new Date(c.endDate).toLocaleDateString() : '-'
                    ]),
                    exportData: list.map(c => ({
                        'Contract Number': c.contractNumber,
                        'Title': c.title,
                        'Customer': c.customerId?.companyName || c.customerId?.customerName || '-',
                        'Value (INR)': c.value || 0,
                        'Days Remaining': c.remainingDays,
                        'End Date': c.endDate ? new Date(c.endDate).toISOString().substring(0, 10) : ''
                    })),
                    fileName: 'Upcoming_Renewals_Report'
                };
            }
            case 'status_dashboard': {
                const statuses = {};
                contracts.forEach(c => {
                    const st = c.status || 'Draft';
                    if (!statuses[st]) statuses[st] = 0;
                    statuses[st]++;
                });
                return {
                    title: 'Contract Status Dashboard',
                    desc: 'Operational summary counts across all status stages.',
                    kpis: [
                        { label: 'Total Agreements', value: contracts.length },
                        { label: 'Active Share', value: `${((statuses['Active'] || 0) / (contracts.length || 1) * 100).toFixed(1)}%` }
                    ],
                    headers: ['Status', 'Contracts Count', 'Percentage Distribution'],
                    rows: Object.keys(statuses).map(k => [
                        k,
                        statuses[k],
                        `${((statuses[k] / contracts.length) * 100).toFixed(1)}%`
                    ]),
                    exportData: Object.keys(statuses).map(k => ({
                        'Status': k,
                        'Contracts Count': statuses[k],
                        'Percentage': `${((statuses[k] / contracts.length) * 100).toFixed(1)}%`
                    })),
                    fileName: 'Status_Distribution_Report'
                };
            }
            case 'risk_analysis': {
                const list = [...contracts].sort((a,b) => {
                    const order = { High: 3, Medium: 2, Low: 1 };
                    return (order[b.riskScore || 'Low'] || 1) - (order[a.riskScore || 'Low'] || 1);
                });
                return {
                    title: 'Risk Analysis Report',
                    desc: 'Overview of risk levels and compliance indicators across agreements.',
                    kpis: [
                        { label: 'High Risk Deals', value: contracts.filter(c => c.riskScore === 'High').length },
                        { label: 'Average Compliance', value: '88%' }
                    ],
                    headers: ['Contract No', 'Title', 'Customer', 'Value', 'Risk level', 'Owner'],
                    rows: list.map(c => [
                        c.contractNumber,
                        c.title,
                        c.customerId?.companyName || c.customerId?.customerName || '-',
                        `₹${(c.value || 0).toLocaleString()}`,
                        c.riskScore || 'Low',
                        c.owner?.name || 'Sales Rep'
                    ]),
                    exportData: list.map(c => ({
                        'Contract Number': c.contractNumber,
                        'Title': c.title,
                        'Customer': c.customerId?.companyName || c.customerId?.customerName || '-',
                        'Value (INR)': c.value || 0,
                        'Risk Score': c.riskScore || 'Low',
                        'Owner': c.owner?.name || 'Sales Rep'
                    })),
                    fileName: 'Contracts_Risk_Analysis'
                };
            }
            case 'approval_performance': {
                const list = contracts.filter(c => c.status === 'Pending Approval' || c.status === 'Approved');
                return {
                    title: 'Approval Performance',
                    desc: 'Tracking of approval flows and stages for pending or cleared agreements.',
                    kpis: [
                        { label: 'In Queue', value: list.filter(c => c.status === 'Pending Approval').length },
                        { label: 'Approved', value: list.filter(c => c.status === 'Approved').length }
                    ],
                    headers: ['Contract No', 'Title', 'Customer', 'Status', 'Owner'],
                    rows: list.map(c => [
                        c.contractNumber,
                        c.title,
                        c.customerId?.companyName || c.customerId?.customerName || '-',
                        c.status,
                        c.owner?.name || 'Sales Rep'
                    ]),
                    exportData: list.map(c => ({
                        'Contract Number': c.contractNumber,
                        'Title': c.title,
                        'Customer': c.customerId?.companyName || c.customerId?.customerName || '-',
                        'Status': c.status,
                        'Owner': c.owner?.name || 'Sales Rep'
                    })),
                    fileName: 'Approval_Performance_Report'
                };
            }
            default:
                return null;
        }
    };

    const handleExportReport = (reportKey) => {
        const rep = getReportData(reportKey);
        if (!rep || !rep.exportData.length) {
            toast.warn("No data available to export.");
            return;
        }
        const ws = XLSX.utils.json_to_sheet(rep.exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Report Data');
        XLSX.writeFile(wb, `${rep.fileName}_${new Date().toISOString().slice(0, 10)}.xlsx`);
        toast.success("Report data exported successfully!");
    };

    const reportCategories = [
        {
            title: 'Operational Reports',
            desc: 'Daily agreement lifecycle indicators.',
            reports: [
                { key: 'active_contracts', name: 'Active Contracts', desc: 'Lists active agreements, values and reps' },
                { key: 'expired_contracts', name: 'Expired Contracts', desc: 'Agreements past their end date' },
                { key: 'expiring_contracts', name: 'Expiring Contracts', desc: 'Agreements expiring within 90 days' },
                { key: 'draft_contracts', name: 'Draft Contracts', desc: 'In-draft agreements currently being authored' },
                { key: 'pending_approval', name: 'Pending Approval', desc: 'Contracts waiting for review and signatures' }
            ]
        },
        {
            title: 'Financial Reports',
            desc: 'Financial insights, averages and revenue concentration.',
            reports: [
                { key: 'value_analysis', name: 'Contract Value Analysis', desc: 'Total/Average values and top 10 list' },
                { key: 'revenue_customer', name: 'Revenue by Customer', desc: 'Total contract values grouped by customer' },
                { key: 'revenue_category', name: 'Revenue by Category', desc: 'Contract revenue breakdown by category' }
            ]
        },
        {
            title: 'Renewal Reports',
            desc: 'Tracking parameters for upcoming renewals.',
            reports: [
                { key: 'renewal_tracker', name: 'Renewal Tracker', desc: 'Upcoming renewal dates and rules policy' },
                { key: 'renewal_success_rate', name: 'Renewal Success Rate', desc: 'Success vs lost contract rates' },
                { key: 'upcoming_renewals', name: 'Upcoming Renewals', desc: 'Contracts expiring in the next 30 days' }
            ]
        },
        {
            title: 'Management Reports',
            desc: 'Executive compliance, risk metrics and summaries.',
            reports: [
                { key: 'status_dashboard', name: 'Contract Status Dashboard', desc: 'Status stage aggregation numbers' },
                { key: 'risk_analysis', name: 'Risk Analysis', desc: 'Contracts grouped by risk index and compliance' },
                { key: 'approval_performance', name: 'Approval Performance', desc: 'Duration statistics and approval flow status' }
            ]
        }
    ];

    const handleCreateContract = async (e) => {
        e.preventDefault();
        try {
            await clmService.createContract(contractForm);
            toast.success("New locked agreement created!");
            setIsCreateModalOpen(false);
            fetchContracts();
            fetchDashboard();
        } catch (err) {
            toast.error("Failed to create contract");
        }
    };

    const formatToHtml = (text) => {
        if (!text) return '';
        // If it already looks like HTML (contains tags), return as is
        if (/<[a-z][\s\S]*>/i.test(text)) {
            return text;
        }
        // Auto convert double newlines to paragraphs and single newlines to line breaks
        return text
            .trim()
            .split('\n\n')
            .map(para => `<p>${para.replace(/\n/g, '<br />')}</p>`)
            .join('\n');
    };

    const handleCreateClause = async (e) => {
        e.preventDefault();
        try {
            await clmService.createClause({
                ...clauseForm,
                content: formatToHtml(clauseForm.content),
                tags: clauseForm.tags.split(',').map(t => t.trim()).filter(Boolean)
            });
            toast.success("Clause added to library");
            setIsClauseModalOpen(false);
            fetchMetadata();
        } catch (err) {
            toast.error("Failed to save clause");
        }
    };

    const handleCreateTemplate = async (e) => {
        e.preventDefault();
        try {
            await clmService.createTemplate({
                ...templateForm,
                htmlContent: formatToHtml(templateForm.htmlContent)
            });
            toast.success("Template created");
            setIsTemplateModalOpen(false);
            fetchMetadata();
        } catch (err) {
            toast.error("Failed to save template");
        }
    };

    const openWorkspace = async (contract) => {
        setActiveWorkspaceContract(contract);
        setWorkspaceTab('overview');
        try {
            const versionsRes = await clmService.getVersions(contract._id);
            setContractVersions(versionsRes.data || []);
            if (versionsRes.data?.length > 0) {
                loadVersionHtml(versionsRes.data[0]._id);
            } else {
                if (templates.length > 0) {
                    setEditorHtml(templates[0].htmlContent);
                    setEditorStyles(templates[0].cssContent || '');
                    setSelectedTemplateId(templates[0]._id);
                }
            }
        } catch (err) {
            console.error("Load versions error:", err);
        }
    };

    const loadVersionHtml = async (versionId) => {
        try {
            const url = clmService.getVersionHtmlUrl(versionId);
            setActiveVersionHtml(url);
        } catch (err) {
            console.error("Load version html error:", err);
        }
    };

    const handleCompileDocument = async () => {
        if (!selectedTemplateId) {
            toast.warn("Please select a template first");
            return;
        }
        setLoading(true);
        try {
            await clmService.generateDocument({
                contractId: activeWorkspaceContract._id,
                templateId: selectedTemplateId
            });
            toast.success("Contract snapshot compiled successfully!");
            
            // Reload versions
            const versionsRes = await clmService.getVersions(activeWorkspaceContract._id);
            setContractVersions(versionsRes.data || []);
            if (versionsRes.data?.length > 0) {
                loadVersionHtml(versionsRes.data[0]._id);
            }
            fetchContracts();
            fetchDashboard();
        } catch (err) {
            toast.error("Compilation error: " + (err.response?.data?.message || err.message));
        } finally {
            setLoading(false);
        }
    };

    const handlePostComment = (e) => {
        e.preventDefault();
        if (!newCommentText.trim()) return;
        setWorkspaceComments(prev => [
            ...prev,
            { user: 'Current User', text: newCommentText.trim(), date: 'Just now' }
        ]);
        setNewCommentText('');
        toast.info("Comment posted to timeline");
    };

    const handleTriggerApproval = async (statusVal) => {
        try {
            await clmService.updateContract(activeWorkspaceContract._id, {
                approvalStatus: statusVal,
                status: statusVal === 'Approved' ? 'Active' : 'Pending Approval'
            });
            toast.success(`Approval status updated to ${statusVal}`);
            fetchContracts();
            fetchDashboard();
            setActiveWorkspaceContract(prev => ({ ...prev, approvalStatus: statusVal }));
        } catch (err) {
            toast.error("Failed to update approval stage");
        }
    };

    // Filter Logic
    const filteredContracts = contracts.filter(c => {
        // Status filter
        if (contractsFilter !== 'All') {
            if (contractsFilter === 'Pending') {
                if (c.status !== 'Pending Approval' && c.approvalStatus !== 'Pending Approval') return false;
            } else if (c.status !== contractsFilter) {
                return false;
            }
        }
        // Text Search
        if (searchTerm) {
            const numMatch = (c.contractNumber || '').toLowerCase().includes(searchTerm.toLowerCase());
            const titleMatch = (c.title || '').toLowerCase().includes(searchTerm.toLowerCase());
            if (!numMatch && !titleMatch) return false;
        }
        // Category
        if (categoryFilter && c.category !== categoryFilter) return false;
        // Value
        if (valueFilter) {
            if (valueFilter === 'high' && (c.value || 0) < 500000) return false;
            if (valueFilter === 'low' && (c.value || 0) >= 500000) return false;
        }
        return true;
    });

    return (
        <div className="space-y-6">
                
                {/* WORKSPACE DETAIL TAKE-OVER */}
                {activeWorkspaceContract ? (
                    <div className="bg-white border border-slate-100 rounded-[2rem] p-8 shadow-sm space-y-6 animate-in zoom-in-95 duration-200">
                        {/* Workspace header */}
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 pb-6">
                            <div>
                                <span className="px-3 py-1 rounded-xl text-[9px] font-black uppercase bg-indigo-50 text-indigo-600 border border-indigo-100">
                                    Contract Workspace
                                </span>
                                <h2 className="text-2xl font-black text-slate-900 mt-2">{activeWorkspaceContract.title}</h2>
                                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-1">
                                    {activeWorkspaceContract.contractNumber} • Category: {activeWorkspaceContract.category}
                                </p>
                            </div>
                            <button 
                                onClick={() => setActiveWorkspaceContract(null)}
                                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold transition-all text-slate-600"
                            >
                                Back to Contracts
                            </button>
                        </div>

                        {/* Workspace tabs */}
                        <div className="flex gap-2 border-b border-slate-100 pb-px overflow-x-auto">
                            {[
                                { key: 'overview', name: 'Overview' },
                                { key: 'document', name: 'Document Builder' },
                                { key: 'pricing', name: 'Pricing Locks' },
                                { key: 'attachments', name: 'Attachments' },
                                { key: 'approval', name: 'Approvals Flow' },
                                { key: 'versions', name: 'Version History' },
                                { key: 'activities', name: 'Activities & Discussions' }
                            ].map(tab => (
                                <button
                                    key={tab.key}
                                    onClick={() => setWorkspaceTab(tab.key)}
                                    className={`px-5 py-3 text-xs font-black uppercase tracking-widest border-b-2 transition-all whitespace-nowrap ${
                                        workspaceTab === tab.key ? 'border-primary-600 text-primary-600' : 'border-transparent text-slate-400 hover:text-slate-600'
                                    }`}
                                >
                                    {tab.name}
                                </button>
                            ))}
                        </div>

                        {/* Tab Content: OVERVIEW */}
                        {workspaceTab === 'overview' && (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in-30">
                                <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 md:col-span-2 space-y-6">
                                    <h3 className="text-lg font-black text-slate-900">Basic Information</h3>
                                    <div className="grid grid-cols-2 gap-6 text-sm font-semibold">
                                        <div>
                                            <div className="text-[10px] text-slate-400 uppercase font-black tracking-wider">Partner Name</div>
                                            <div className="text-slate-800 mt-1">{activeWorkspaceContract.customerId?.companyName || activeWorkspaceContract.customerId?.customerName || '-'}</div>
                                        </div>
                                        <div>
                                            <div className="text-[10px] text-slate-400 uppercase font-black tracking-wider">Total Value</div>
                                            <div className="text-slate-800 mt-1">₹{(activeWorkspaceContract.value || 0).toLocaleString()}</div>
                                        </div>
                                        <div>
                                            <div className="text-[10px] text-slate-400 uppercase font-black tracking-wider">Duration</div>
                                            <div className="text-slate-800 mt-1">
                                                {new Date(activeWorkspaceContract.startDate).toLocaleDateString()} - {new Date(activeWorkspaceContract.endDate).toLocaleDateString()}
                                            </div>
                                        </div>
                                        <div>
                                            <div className="text-[10px] text-slate-400 uppercase font-black tracking-wider">Lifecycle Status</div>
                                            <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-600 border border-emerald-100 mt-1 inline-block">
                                                {activeWorkspaceContract.status}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div className="p-6 bg-white border border-slate-200 rounded-[2rem] text-center">
                                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Risk Index</div>
                                        <div className="text-2xl font-black text-indigo-600 mt-2">{activeWorkspaceContract.riskScore || 'Low'}</div>
                                    </div>
                                    <div className="p-6 bg-white border border-slate-200 rounded-[2rem] text-center">
                                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Signature Progress</div>
                                        <div className="text-lg font-black text-slate-800 mt-2">{activeWorkspaceContract.signatureStatus || 'Not Sent'}</div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Tab Content: DOCUMENT BUILDER */}
                        {workspaceTab === 'document' && (
                            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 animate-in fade-in-30">
                                <div className="lg:col-span-1 p-4 bg-slate-50 border border-slate-100 rounded-3xl space-y-6 max-h-[500px] overflow-y-auto">
                                    <div>
                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-2">SLA Templates</label>
                                        <select 
                                            value={selectedTemplateId}
                                            onChange={(e) => {
                                                setSelectedTemplateId(e.target.value);
                                                const tpl = templates.find(t => t._id === e.target.value);
                                                if (tpl) {
                                                    setEditorHtml(tpl.htmlContent);
                                                }
                                            }}
                                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none"
                                        >
                                            <option value="">Select template...</option>
                                            {templates.map(t => <option key={t._id} value={t._id}>{t.name}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-2">Clauses Quick Parts</label>
                                        <div className="space-y-2">
                                            {clauses.map(cl => (
                                                <button 
                                                    key={cl._id}
                                                    onClick={() => setEditorHtml(prev => prev + '\n' + cl.content)}
                                                    className="w-full text-left p-2.5 bg-white border border-slate-200 rounded-xl text-[10px] font-bold text-slate-700 hover:bg-slate-100 transition-colors"
                                                >
                                                    {cl.title}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-3">
                                        <div className="flex justify-between items-center">
                                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Document Editor HTML</h4>
                                            <button 
                                                onClick={handleCompileDocument}
                                                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-95"
                                            >
                                                Generate PDF Snapshot
                                            </button>
                                        </div>
                                        <textarea 
                                            value={editorHtml}
                                            onChange={(e) => setEditorHtml(e.target.value)}
                                            className="w-full h-[400px] p-4 bg-slate-900 text-indigo-300 font-mono text-xs rounded-3xl outline-none focus:ring-2 focus:ring-primary-500 border-none"
                                        />
                                    </div>

                                    <div className="space-y-3">
                                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Live Rendering View</h4>
                                        <div className="border border-slate-100 rounded-3xl h-[400px] bg-slate-50 p-4">
                                            {activeVersionHtml ? (
                                                <iframe src={activeVersionHtml} className="w-full h-full border-none bg-white rounded-2xl shadow-sm" />
                                            ) : (
                                                <div className="flex items-center justify-center h-full text-slate-400 text-xs font-bold uppercase tracking-widest">No Snapshot compiled</div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Tab Content: PRICING */}
                        {workspaceTab === 'pricing' && (
                            <div className="space-y-4 animate-in fade-in-30">
                                <h3 className="text-lg font-black text-slate-900">Custom Mapped Rates Agreement</h3>
                                <div className="bg-slate-50 border border-slate-100 rounded-3xl p-6">
                                    {Object.keys(activeWorkspaceContract.lockedPrices || {}).length === 0 ? (
                                        <div className="text-center p-12 text-slate-400 font-bold text-xs uppercase tracking-widest">
                                            No customized rates mapped. Product prices fall back to Standard Price Book.
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {Object.entries(activeWorkspaceContract.lockedPrices).map(([prodId, price]) => {
                                                const p = products.find(prod => prod._id === prodId);
                                                return (
                                                    <div key={prodId} className="flex justify-between items-center p-4 bg-white border border-slate-150 rounded-2xl shadow-sm">
                                                        <div>
                                                            <div className="font-bold text-slate-800 text-sm">{p?.productName || 'Unknown Product'}</div>
                                                            <div className="text-xs text-slate-400">{p?.productCode || '-'}</div>
                                                        </div>
                                                        <span className="font-black text-slate-900 text-sm">₹{price.toLocaleString()}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Tab Content: ATTACHMENTS */}
                        {workspaceTab === 'attachments' && (
                            <div className="space-y-6 animate-in fade-in-30">
                                <h3 className="text-lg font-black text-slate-900">Contract Supporting Attachments</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    {workspaceAttachments.map((att, idx) => (
                                        <div key={idx} className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex justify-between items-center">
                                            <div>
                                                <div className="text-xs font-black text-slate-900">{att.name}</div>
                                                <div className="text-[10px] text-slate-400 mt-1">{att.size} • {att.type}</div>
                                            </div>
                                            <span className="text-[10px] font-bold text-indigo-600 uppercase">View File</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Tab Content: APPROVAL */}
                        {workspaceTab === 'approval' && (
                            <div className="space-y-8 animate-in fade-in-30">
                                <div className="flex justify-between items-center">
                                    <h3 className="text-lg font-black text-slate-900">Multi-Stage Approval Pipeline</h3>
                                    <div className="flex gap-2">
                                        <button 
                                            onClick={() => handleTriggerApproval('Approved')}
                                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md"
                                        >
                                            Approve Agreement
                                        </button>
                                        <button 
                                            onClick={() => handleTriggerApproval('Rejected')}
                                            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-md"
                                        >
                                            Reject
                                        </button>
                                    </div>
                                </div>
                                
                                <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                                    {[
                                        { name: 'Sales Executive', status: 'Approved' },
                                        { name: 'Sales Manager', status: 'Approved' },
                                        { name: 'Finance Review', status: activeWorkspaceContract.approvalStatus === 'Approved' ? 'Approved' : 'Current' },
                                        { name: 'Legal Verification', status: activeWorkspaceContract.approvalStatus === 'Approved' ? 'Approved' : 'Pending' },
                                        { name: 'Executive Director', status: activeWorkspaceContract.approvalStatus === 'Approved' ? 'Approved' : 'Pending' }
                                    ].map((step, idx) => (
                                        <React.Fragment key={idx}>
                                            <div className="flex-1 w-full p-5 bg-slate-50 border border-slate-100 rounded-3xl flex items-center gap-3 relative">
                                                <div className={`h-8 w-8 rounded-xl flex items-center justify-center font-bold text-xs ${
                                                    step.status === 'Approved' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                                                    step.status === 'Current' ? 'bg-indigo-50 text-indigo-600 border border-indigo-100 shadow-sm animate-pulse' :
                                                    'bg-slate-100 text-slate-400 border border-slate-200'
                                                }`}>
                                                    {idx + 1}
                                                </div>
                                                <div>
                                                    <div className="text-xs font-black text-slate-900">{step.name}</div>
                                                    <div className="text-[10px] text-slate-400 mt-0.5">{step.status}</div>
                                                </div>
                                            </div>
                                            {idx < 4 && <MdPlayArrow className="text-slate-300 hidden md:block" size={24} />}
                                        </React.Fragment>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Tab Content: VERSION HISTORY */}
                        {workspaceTab === 'versions' && (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in-30">
                                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Compiled Versions</h4>
                                    {contractVersions.length === 0 ? (
                                        <div className="text-center p-6 text-slate-400 font-bold text-xs uppercase tracking-widest">No historical versions.</div>
                                    ) : (
                                        contractVersions.map(v => (
                                            <button 
                                                key={v._id}
                                                onClick={() => loadVersionHtml(v._id)}
                                                className="w-full text-left p-4 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-2xl flex justify-between items-center transition-colors"
                                            >
                                                <div>
                                                    <div className="text-xs font-black text-slate-900">Version {v.version}</div>
                                                    <div className="text-[10px] text-slate-400 mt-1">Compiled: {new Date(v.createdAt).toLocaleString()}</div>
                                                </div>
                                                <span className="text-[10px] font-bold text-indigo-600 uppercase">View Snapshot</span>
                                            </button>
                                        ))
                                    )}
                                </div>

                                <div className="md:col-span-2 space-y-3">
                                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Historical Snapshot Preview</h4>
                                    <div className="border border-slate-100 rounded-3xl h-[350px] overflow-hidden bg-slate-50 p-4">
                                        {activeVersionHtml ? (
                                            <iframe src={activeVersionHtml} className="w-full h-full border-none bg-white rounded-2xl shadow-sm" />
                                        ) : (
                                            <div className="flex items-center justify-center h-full text-slate-400 text-xs font-bold uppercase tracking-widest">No version selected</div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Tab Content: ACTIVITIES & TIMELINE */}
                        {workspaceTab === 'activities' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in-30">
                                <div className="space-y-4">
                                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Internal Discussion Thread</h4>
                                    <form onSubmit={handlePostComment} className="flex gap-2">
                                        <input 
                                            type="text" 
                                            value={newCommentText}
                                            onChange={e => setNewCommentText(e.target.value)}
                                            placeholder="Write internal note..."
                                            className="flex-1 px-4 py-2 border border-slate-250 rounded-xl outline-none text-xs font-semibold"
                                        />
                                        <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold uppercase">Post</button>
                                    </form>
                                    <div className="space-y-3">
                                        {workspaceComments.map((com, idx) => (
                                            <div key={idx} className="p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                                                <div className="flex justify-between items-center text-[10px] font-black text-slate-400">
                                                    <span>{com.user}</span>
                                                    <span>{com.date}</span>
                                                </div>
                                                <p className="text-xs font-semibold text-slate-700 mt-1">{com.text}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-outfit">Audit Event Logs</h4>
                                    <div className="relative border-l-2 border-slate-150 pl-6 space-y-6">
                                        {[
                                            { event: 'Contract Mapped to standard A4 paper size', user: 'System Bot', time: '10:15 AM' },
                                            { event: 'Pricing locked for 5 items', user: 'Sales Exec', time: '10:16 AM' }
                                        ].map((log, idx) => (
                                            <div key={idx} className="relative">
                                                <div className="absolute -left-[30px] top-1.5 h-3 w-3 bg-indigo-500 rounded-full border border-white" />
                                                <div className="text-xs font-bold text-slate-800">{log.event}</div>
                                                <div className="text-[9px] text-slate-400 mt-0.5">{log.time} by {log.user}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    /* NORMAL VIEW MODE CHANGER */
                    <div>
                        {/* 1. DASHBOARD TAB */}
                        {currentTab === 'dashboard' && dashboardData && (
                            <div className="space-y-8 animate-in fade-in-50 duration-300">
                                {/* Header */}
                                <div>
                                    <h1 className="text-3xl font-black text-slate-900 tracking-tight font-outfit uppercase">CLM Executive Dashboard</h1>
                                    <p className="text-slate-500 font-medium">Monthly revenues, renewal cycles, and risk scores</p>
                                </div>

                                {/* Metrics */}
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                                    <div className="p-6 bg-white border border-slate-100 rounded-[2rem] shadow-sm flex items-center gap-4">
                                        <div className="h-12 w-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                                            <MdAttachMoney size={24} />
                                        </div>
                                        <div>
                                            <div className="text-[10px] uppercase font-black tracking-widest text-slate-400">Total Contract Value</div>
                                            <div className="text-xl font-black text-slate-900">₹{(dashboardData.metrics.totalValue || 0).toLocaleString()}</div>
                                        </div>
                                    </div>
                                    <div className="p-6 bg-white border border-slate-100 rounded-[2rem] shadow-sm flex items-center gap-4">
                                        <div className="h-12 w-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                                            <MdCheckCircle size={24} />
                                        </div>
                                        <div>
                                            <div className="text-[10px] uppercase font-black tracking-widest text-slate-400">Active Contracts</div>
                                            <div className="text-xl font-black text-slate-900">{dashboardData.metrics.active} / {dashboardData.metrics.total}</div>
                                        </div>
                                    </div>
                                    <div className="p-6 bg-white border border-slate-100 rounded-[2rem] shadow-sm flex items-center gap-4">
                                        <div className="h-12 w-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
                                            <MdWarning size={24} />
                                        </div>
                                        <div>
                                            <div className="text-[10px] uppercase font-black tracking-widest text-slate-400">Pending Approval</div>
                                            <div className="text-xl font-black text-slate-900">{dashboardData.metrics.pending}</div>
                                        </div>
                                    </div>
                                    <div className="p-6 bg-white border border-slate-100 rounded-[2rem] shadow-sm flex items-center gap-4">
                                        <div className="h-12 w-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center">
                                            <MdAlarm size={24} />
                                        </div>
                                        <div>
                                            <div className="text-[10px] uppercase font-black tracking-widest text-slate-400">Expiring (30 Days)</div>
                                            <div className="text-xl font-black text-slate-900">{dashboardData.metrics.expiring30Days}</div>
                                        </div>
                                    </div>
                                </div>

                                {/* Charts & Progress visualization */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="p-6 bg-white border border-slate-100 rounded-[2rem] shadow-sm space-y-4">
                                        <h3 className="text-lg font-black text-slate-900 tracking-tight">Estimated Monthly Contract Revenue</h3>
                                        <div className="h-60 flex items-end gap-3 pt-6 border-b border-slate-100 pb-2">
                                            {dashboardData.charts.revenueTrend.map((bar, idx) => (
                                                <div key={idx} className="flex-1 flex flex-col items-center gap-2 group cursor-pointer h-full justify-end">
                                                    <div className="text-[9px] font-black text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        ₹{bar.revenue.toLocaleString()}
                                                    </div>
                                                    <div 
                                                        style={{ height: `${Math.min(90, Math.max(5, (bar.revenue / (Math.max(...dashboardData.charts.revenueTrend.map(b => b.revenue)) || 1)) * 100))}%` }} 
                                                        className="w-full bg-primary-600 hover:bg-primary-700 rounded-t-lg transition-all shadow-lg shadow-primary-600/20"
                                                    />
                                                    <div className="text-[10px] font-black uppercase text-slate-400 mt-2">{bar.month}</div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="p-6 bg-white border border-slate-100 rounded-[2rem] shadow-sm space-y-6">
                                        <h3 className="text-lg font-black text-slate-900 tracking-tight">Top Accounts Value</h3>
                                        <div className="space-y-4">
                                            {dashboardData.charts.topCustomers.length === 0 ? (
                                                <div className="text-center p-12 text-slate-400 font-bold">No values calculated.</div>
                                            ) : (
                                                dashboardData.charts.topCustomers.map((cust, idx) => (
                                                    <div key={idx} className="space-y-1.5">
                                                        <div className="flex justify-between items-center text-xs font-black">
                                                            <span className="text-slate-700">{cust.name}</span>
                                                            <span className="text-slate-900">₹{cust.value.toLocaleString()}</span>
                                                        </div>
                                                        <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
                                                            <div 
                                                                style={{ width: `${Math.min(100, Math.max(5, (cust.value / (dashboardData.charts.topCustomers[0]?.value || 1)) * 100))}%` }} 
                                                                className="h-full bg-gradient-to-r from-indigo-500 to-primary-600 rounded-full"
                                                            />
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* 2. CONTRACTS LIST VIEW */}
                        {currentTab === 'contracts' && (
                            <div className="space-y-6 animate-in fade-in-50 duration-300">
                                {/* Header */}
                                <div className="flex justify-between items-center">
                                    <div>
                                        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Contracts Register</h1>
                                        <p className="text-slate-500 font-medium">List of all active, draft, and expired agreements</p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={handleExportContracts}
                                            className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs uppercase px-5 py-3 rounded-2xl tracking-widest active:scale-95 transition-all shadow-sm flex items-center gap-2"
                                            title="Export to Excel"
                                        >
                                            <MdFileDownload size={18} />
                                            Export
                                        </button>
                                        <button
                                            onClick={() => setIsImportModalOpen(true)}
                                            className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs uppercase px-5 py-3 rounded-2xl tracking-widest active:scale-95 transition-all shadow-sm flex items-center gap-2"
                                            title="Import from Excel"
                                        >
                                            <MdFileUpload size={18} />
                                            Import
                                        </button>
                                        <button 
                                            onClick={() => setIsCreateModalOpen(true)}
                                            className="bg-primary-600 hover:bg-primary-700 text-white font-bold text-xs uppercase px-5 py-3 rounded-2xl tracking-widest active:scale-95 transition-all shadow-md shadow-primary-600/20"
                                        >
                                            Add Agreement
                                        </button>
                                    </div>
                                </div>

                                {/* Filters Row */}
                                <div className="flex flex-wrap items-center gap-4 bg-white p-5 border border-slate-100 rounded-[2rem] shadow-sm">
                                    <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200">
                                        {['All', 'Draft', 'Pending', 'Active', 'Expired', 'Renewed'].map(st => (
                                            <button 
                                                key={st}
                                                onClick={() => setContractsFilter(st)}
                                                className={`px-4 py-2 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all ${
                                                    contractsFilter === st ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
                                                }`}
                                            >
                                                {st}
                                            </button>
                                        ))}
                                    </div>

                                    <input 
                                        type="text" 
                                        value={searchTerm}
                                        onChange={e => setSearchTerm(e.target.value)}
                                        placeholder="Search contract no / title..."
                                        className="px-4 py-2 border border-slate-200 rounded-xl outline-none text-xs font-semibold w-64"
                                    />

                                    <select 
                                        value={categoryFilter}
                                        onChange={e => setCategoryFilter(e.target.value)}
                                        className="px-4 py-2 border border-slate-200 rounded-xl outline-none text-xs font-semibold bg-white"
                                    >
                                        <option value="">Category (All)</option>
                                        {contractCategories.map(cat => (
                                            <option key={cat._id} value={cat.name}>{cat.name}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Contracts table */}
                                <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
                                    {filteredContracts.length === 0 ? (
                                        <div className="p-20 text-center text-slate-400 font-bold text-xs uppercase tracking-widest">No contracts match the criteria</div>
                                    ) : (
                                        <table className="w-full text-left">
                                            <thead className="bg-slate-50 text-slate-400 text-[10px] uppercase font-black tracking-widest border-b border-slate-100">
                                                <tr>
                                                    <th className="px-8 py-5">Agreement / Code</th>
                                                    <th className="px-8 py-5">Customer Partner</th>
                                                    <th className="px-8 py-5">Value</th>
                                                    <th className="px-8 py-5">Category</th>
                                                    <th className="px-8 py-5 text-center">Status</th>
                                                    <th className="px-8 py-5 text-right">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-50 font-semibold text-sm">
                                                {filteredContracts.map(c => (
                                                    <tr key={c._id} className="hover:bg-slate-50/50 transition-colors">
                                                        <td className="px-8 py-5">
                                                            <div className="font-black text-slate-900">{c.title}</div>
                                                            <div className="text-[10px] text-slate-400 uppercase tracking-wider font-black mt-1">{c.contractNumber}</div>
                                                        </td>
                                                        <td className="px-8 py-5">
                                                            <div className="text-slate-800">{c.customerId?.companyName || c.customerId?.customerName || '-'}</div>
                                                        </td>
                                                        <td className="px-8 py-5">
                                                            <div className="text-slate-900 font-bold">₹{(c.value || 0).toLocaleString()}</div>
                                                        </td>
                                                        <td className="px-8 py-5">
                                                            <span className="px-2.5 py-1 rounded-lg text-[9px] font-black uppercase bg-indigo-50 text-indigo-600 border border-indigo-100">
                                                                {c.category}
                                                            </span>
                                                        </td>
                                                        <td className="px-8 py-5 text-center">
                                                            <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase ${
                                                                c.status === 'Active' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                                                                c.status === 'Draft' ? 'bg-slate-50 text-slate-400 border border-slate-200' :
                                                                'bg-amber-50 text-amber-600 border border-amber-100'
                                                            }`}>
                                                                {c.status}
                                                            </span>
                                                        </td>
                                                        <td className="px-8 py-5 text-right">
                                                            <button 
                                                                onClick={() => openWorkspace(c)}
                                                                className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-xl text-xs font-black transition-all active:scale-95"
                                                            >
                                                                Workspace
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* 3. TEMPLATES TAB */}
                        {currentTab === 'templates' && (
                            <div className="space-y-6 animate-in fade-in-50 duration-300">
                                <div className="flex justify-between items-center">
                                    <div>
                                        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Document Templates</h1>
                                        <p className="text-slate-500 font-medium">Create and customize A4 layouts, styles, and headers</p>
                                    </div>
                                    <button 
                                        onClick={() => setIsTemplateModalOpen(true)}
                                        className="bg-primary-600 hover:bg-primary-700 text-white font-bold text-xs uppercase px-5 py-3 rounded-2xl tracking-widest active:scale-95 transition-all shadow-md shadow-primary-600/20"
                                    >
                                        New Template
                                    </button>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    {templates.map(t => (
                                        <div key={t._id} className="p-6 bg-white border border-slate-100 rounded-[2rem] shadow-sm space-y-4 flex flex-col justify-between">
                                            <div>
                                                <h4 className="font-black text-slate-900 text-base">{t.name}</h4>
                                                <p className="text-[10px] text-slate-400 uppercase tracking-widest font-black mt-1">Category: {t.category}</p>
                                                <p className="text-xs text-slate-500 mt-3 font-medium line-clamp-3">Paper: {t.paperSize} ({t.orientation})</p>
                                            </div>
                                            <div className="pt-4 border-t border-slate-50 flex justify-between items-center">
                                                <span className="text-[9px] font-black uppercase text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                                                    Active
                                                </span>
                                                <button 
                                                    onClick={() => {
                                                        setTemplateForm({ name: t.name, category: t.category, htmlContent: t.htmlContent, cssContent: t.cssContent || '' });
                                                        setIsTemplateModalOpen(true);
                                                    }}
                                                    className="text-xs font-black text-indigo-600 hover:underline"
                                                >
                                                    Edit Layout
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* 4. CLAUSES LIBRARY TAB */}
                        {currentTab === 'clauses' && (
                            <div className="space-y-6 animate-in fade-in-50 duration-300">
                                <div className="flex justify-between items-center">
                                    <div>
                                        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Clauses Library</h1>
                                        <p className="text-slate-500 font-medium">Standard legal clause snippets ready to drag/insert</p>
                                    </div>
                                    <button 
                                        onClick={() => setIsClauseModalOpen(true)}
                                        className="bg-primary-600 hover:bg-primary-700 text-white font-bold text-xs uppercase px-5 py-3 rounded-2xl tracking-widest active:scale-95 transition-all shadow-md"
                                    >
                                        Create Clause
                                    </button>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    {clauses.map(cl => (
                                        <div key={cl._id} className="p-6 bg-white border border-slate-100 rounded-[2rem] shadow-sm space-y-4">
                                            <div className="flex justify-between items-start">
                                                <h4 className="font-black text-slate-900 text-sm leading-snug">{cl.title}</h4>
                                                <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase bg-indigo-50 text-indigo-600 border border-indigo-100">
                                                    {cl.category}
                                                </span>
                                            </div>
                                            <div 
                                                className="text-xs text-slate-500 line-clamp-4 bg-slate-50 p-3 rounded-xl font-medium"
                                                dangerouslySetInnerHTML={{ __html: cl.content }}
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* 5. APPROVALS QUEUE TAB */}
                        {currentTab === 'approvals' && (
                            <div className="space-y-6 animate-in fade-in-50 duration-300">
                                <div>
                                    <h1 className="text-3xl font-black text-slate-900 tracking-tight font-outfit uppercase">Approvals Queue</h1>
                                    <p className="text-slate-500 font-medium">Contracts waiting for verification and legal approvals</p>
                                </div>

                                <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
                                    {contracts.filter(c => c.status === 'Pending Approval' || c.approvalStatus === 'Pending Approval').length === 0 ? (
                                        <div className="p-20 text-center text-slate-400 font-bold text-xs uppercase tracking-widest">No pending approvals found</div>
                                    ) : (
                                        <table className="w-full text-left">
                                            <thead className="bg-slate-50 text-slate-400 text-[10px] uppercase font-black tracking-widest border-b border-slate-100">
                                                <tr>
                                                    <th className="px-8 py-5">Agreement / Title</th>
                                                    <th className="px-8 py-5">Category</th>
                                                    <th className="px-8 py-5">Value</th>
                                                    <th className="px-8 py-5">Requester</th>
                                                    <th className="px-8 py-5 text-right">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-50 font-semibold text-sm">
                                                {contracts.filter(c => c.status === 'Pending Approval' || c.approvalStatus === 'Pending Approval').map(c => (
                                                    <tr key={c._id} className="hover:bg-slate-50/50 transition-colors">
                                                        <td className="px-8 py-5">
                                                            <div className="font-black text-slate-900">{c.title}</div>
                                                            <div className="text-[10px] text-slate-400 mt-1 uppercase font-black tracking-wider">{c.contractNumber}</div>
                                                        </td>
                                                        <td className="px-8 py-5">
                                                            <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-indigo-50 text-indigo-600 border border-indigo-100">
                                                                {c.category}
                                                            </span>
                                                        </td>
                                                        <td className="px-8 py-5">
                                                            <div className="text-slate-900 font-bold">₹{(c.value || 0).toLocaleString()}</div>
                                                        </td>
                                                        <td className="px-8 py-5">
                                                            <div className="text-slate-700">{c.owner?.name || 'Sales Rep'}</div>
                                                        </td>
                                                        <td className="px-8 py-5 text-right">
                                                            <button 
                                                                onClick={() => openWorkspace(c)}
                                                                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all"
                                                            >
                                                                Review & Sign
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* 6. RENEWALS KANBAN TAB */}
                        {currentTab === 'renewals' && (
                            <div className="space-y-6 animate-in fade-in-50 duration-300">
                                <div>
                                    <h1 className="text-3xl font-black text-slate-900 tracking-tight font-outfit uppercase">Renewal Kanban Center</h1>
                                    <p className="text-slate-500 font-medium">Drag-and-drop or select lane stages for customer renewals</p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                                    {[
                                        { key: 'Due in 90 Days', title: '90 Days Due', bg: 'bg-indigo-50 border-indigo-100 text-indigo-800' },
                                        { key: 'Due in 60 Days', title: '60 Days Due', bg: 'bg-blue-50 border-blue-100 text-blue-800' },
                                        { key: 'Due in 30 Days', title: '30 Days Due', bg: 'bg-amber-50 border-amber-100 text-amber-800' },
                                        { key: 'Today', title: 'Due Today', bg: 'bg-rose-50 border-rose-100 text-rose-800' },
                                        { key: 'Renewed', title: 'Renewed', bg: 'bg-emerald-50 border-emerald-100 text-emerald-800' },
                                        { key: 'Lost', title: 'Lost/Archived', bg: 'bg-slate-50 border-slate-200 text-slate-800' }
                                    ].map(col => {
                                        const colContracts = contracts.filter(c => c.renewalStatus === col.key);
                                        return (
                                            <div key={col.key} className="p-4 bg-slate-100 border border-slate-200 rounded-3xl min-h-[400px] flex flex-col gap-4">
                                                <div className={`px-4 py-2 rounded-2xl border text-xs font-black uppercase tracking-wider text-center ${col.bg}`}>
                                                    {col.title} ({colContracts.length})
                                                </div>

                                                <div className="flex-1 space-y-3 overflow-y-auto max-h-[500px]">
                                                    {colContracts.map(c => (
                                                        <div key={c._id} className="p-4 bg-white border border-slate-150 rounded-2xl space-y-2 shadow-sm">
                                                            <h4 className="text-xs font-black text-slate-900 leading-snug">{c.title}</h4>
                                                            <div className="flex justify-between items-center pt-2 border-t border-slate-50 text-[10px] font-black">
                                                                <span className="text-slate-900">₹{(c.value || 0).toLocaleString()}</span>
                                                                <button 
                                                                    onClick={() => openWorkspace(c)}
                                                                    className="text-primary-600 hover:underline uppercase"
                                                                >
                                                                    View
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* 7. REPORTS TAB */}
                        {currentTab === 'reports' && (
                            <div className="space-y-6 animate-in fade-in-50 duration-300">
                                {selectedReport === null ? (
                                    <>
                                        <div>
                                            <h1 className="text-3xl font-black text-slate-900 tracking-tight font-outfit uppercase">CLM Reports Center</h1>
                                            <p className="text-slate-500 font-medium">Access lifecycle trackers, financial compliance, and operational reports</p>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                            {reportCategories.map(cat => (
                                                <div key={cat.title} className="p-6 bg-white border border-slate-100 rounded-[2rem] shadow-sm space-y-4">
                                                    <div className="flex items-center justify-between pb-3 border-b border-slate-50">
                                                        <div>
                                                            <h3 className="text-base font-black text-slate-950 uppercase tracking-wider">{cat.title}</h3>
                                                            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-1">{cat.desc}</p>
                                                        </div>
                                                    </div>

                                                    <div className="divide-y divide-slate-50">
                                                        {cat.reports.map(rep => (
                                                            <button
                                                                key={rep.key}
                                                                onClick={() => setSelectedReport(rep.key)}
                                                                className="w-full py-4 text-left hover:bg-slate-50/50 px-3 rounded-2xl transition-all flex items-center justify-between group"
                                                            >
                                                                <div>
                                                                    <h4 className="text-sm font-black text-slate-900 group-hover:text-primary-600 transition-colors">{rep.name}</h4>
                                                                    <p className="text-xs text-slate-500 font-semibold mt-1">{rep.desc}</p>
                                                                </div>
                                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest group-hover:text-primary-600 group-hover:translate-x-1 transition-all">
                                                                    View &rarr;
                                                                </span>
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                ) : (
                                    (() => {
                                        const rep = getReportData(selectedReport);
                                        if (!rep) return null;
                                        return (
                                            <div className="space-y-6">
                                                {/* Header */}
                                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                                    <div>
                                                        <button 
                                                            onClick={() => setSelectedReport(null)}
                                                            className="text-xs font-bold text-slate-400 hover:text-slate-600 uppercase tracking-wider mb-2 flex items-center gap-1.5"
                                                        >
                                                            &larr; Back to Reports List
                                                        </button>
                                                        <h1 className="text-3xl font-black text-slate-900 tracking-tight font-outfit uppercase">{rep.title}</h1>
                                                        <p className="text-slate-500 font-medium">{rep.desc}</p>
                                                    </div>

                                                    <button
                                                        onClick={() => handleExportReport(selectedReport)}
                                                        className="flex items-center justify-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-5 py-3 rounded-2xl font-bold transition-all shadow-sm uppercase text-xs tracking-widest active:scale-95"
                                                    >
                                                        <MdFileDownload size={18} />
                                                        <span>Export Excel</span>
                                                    </button>
                                                </div>

                                                {/* KPI Summary Cards */}
                                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                                    {rep.kpis.map((k, idx) => (
                                                        <div key={idx} className="p-5 bg-white border border-slate-100 rounded-3xl shadow-sm space-y-1">
                                                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{k.label}</div>
                                                            <div className="text-xl font-black text-slate-950">{k.value}</div>
                                                        </div>
                                                    ))}
                                                </div>

                                                {/* Grid Data */}
                                                <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
                                                    {rep.rows.length === 0 ? (
                                                        <div className="p-20 text-center text-slate-400 font-bold text-xs uppercase tracking-widest">
                                                            No records found for this report criteria
                                                        </div>
                                                    ) : (
                                                        <table className="w-full text-left">
                                                            <thead className="bg-slate-50 text-slate-400 text-[10px] uppercase font-black tracking-widest border-b border-slate-100">
                                                                <tr>
                                                                    {rep.headers.map((h, i) => (
                                                                        <th key={i} className="px-8 py-5">{h}</th>
                                                                    ))}
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-slate-50 font-semibold text-sm text-slate-800">
                                                                {rep.rows.map((row, rIdx) => (
                                                                    <tr key={rIdx} className="hover:bg-slate-50/50 transition-colors">
                                                                        {row.map((cell, cIdx) => (
                                                                            <td key={cIdx} className="px-8 py-5">
                                                                                {cIdx === 0 ? (
                                                                                    <span className="font-black text-slate-950">{cell}</span>
                                                                                ) : (
                                                                                    cell
                                                                                )}
                                                                            </td>
                                                                        ))}
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })()
                                )}
                            </div>
                        )}

                        {/* 8. SETTINGS TAB */}
                        {currentTab === 'settings' && (
                            <div className="space-y-6 animate-in fade-in-50 duration-300">
                                <div>
                                    <h1 className="text-3xl font-black text-slate-900 tracking-tight font-outfit uppercase">CLM Module Settings</h1>
                                    <p className="text-slate-500 font-medium">Reminder intervals, workflows, and default document options</p>
                                </div>

                                <div className="bg-white border border-slate-100 rounded-[2rem] p-6 shadow-sm space-y-6">
                                    <div>
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Reminder days before expiration</label>
                                        <input 
                                            type="number" 
                                            value={reminderDays}
                                            onChange={e => setReminderDays(Number(e.target.value))}
                                            className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-xs font-bold w-40"
                                        />
                                    </div>

                                    <div>
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Default renewal rule</label>
                                        <select 
                                            value={renewalRuleDefault} 
                                            onChange={e => setRenewalRuleDefault(e.target.value)}
                                            className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-xs font-bold w-60 bg-white"
                                        >
                                            <option value="Auto-Renew">Auto-Renew Annually</option>
                                            <option value="Manual-Review">Manual Review & Quote</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

            {/* CREATE CONTRACT MODAL */}
            <Modal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} title="Create Agreement">
                <form onSubmit={handleCreateContract} className="space-y-4">
                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Contract / Document Number</label>
                        <input 
                            type="text" 
                            required 
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-semibold"
                            value={contractForm.contractNumber}
                            onChange={e => setContractForm({ ...contractForm, contractNumber: e.target.value })}
                            placeholder="e.g. CON-2026-101"
                        />
                    </div>
                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Contract Title</label>
                        <input 
                            type="text" 
                            required 
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-semibold"
                            value={contractForm.title}
                            onChange={e => setContractForm({ ...contractForm, title: e.target.value })}
                            placeholder="e.g. Acme Corp annual maintenance support"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Customer Partner</label>
                            <select 
                                required
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-semibold"
                                value={contractForm.customerId}
                                onChange={e => setContractForm({ ...contractForm, customerId: e.target.value })}
                            >
                                <option value="">Choose partner...</option>
                                {customers.map(c => <option key={c._id} value={c._id}>{c.companyName || c.customerName}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Category</label>
                            {showCategoryInput ? (
                                <div className="flex gap-2">
                                    <input 
                                        type="text" 
                                        value={newCategoryName}
                                        onChange={e => setNewCategoryName(e.target.value)}
                                        placeholder="New Category Name"
                                        className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-semibold animate-none"
                                    />
                                    <button 
                                        type="button"
                                        onClick={handleAddCategory}
                                        className="px-4 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-xs font-bold uppercase transition-all"
                                    >
                                        Add
                                    </button>
                                    <button 
                                        type="button"
                                        onClick={() => setShowCategoryInput(false)}
                                        className="px-3 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-xl text-xs font-bold transition-all"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            ) : (
                                <div className="flex gap-2">
                                    <select 
                                        className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-semibold animate-none"
                                        value={contractForm.category}
                                        onChange={e => setContractForm({ ...contractForm, category: e.target.value })}
                                    >
                                        <option value="">Select category...</option>
                                        {contractCategories.map(cat => (
                                            <option key={cat._id} value={cat.name}>{cat.name}</option>
                                        ))}
                                    </select>
                                    <button 
                                        type="button"
                                        onClick={() => setShowCategoryInput(true)}
                                        className="p-3 bg-slate-100 hover:bg-slate-200 text-primary-600 rounded-xl font-bold flex items-center justify-center transition-all"
                                        title="Add New Category"
                                    >
                                        <MdAdd size={20} />
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Start Date</label>
                            <input 
                                type="date" 
                                required
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-semibold"
                                value={contractForm.startDate}
                                onChange={e => setContractForm({ ...contractForm, startDate: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">End Date</label>
                            <input 
                                type="date" 
                                required
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-semibold"
                                value={contractForm.endDate}
                                onChange={e => setContractForm({ ...contractForm, endDate: e.target.value })}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Agreement Total Value (INR)</label>
                        <input 
                            type="number" 
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-semibold"
                            value={contractForm.value}
                            onChange={e => setContractForm({ ...contractForm, value: Number(e.target.value) })}
                        />
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                        <button type="button" onClick={() => setIsCreateModalOpen(false)} className="px-5 py-2.5 text-xs font-bold text-slate-500 uppercase tracking-widest hover:bg-slate-50 rounded-xl">Cancel</button>
                        <button type="submit" className="px-6 py-2.5 text-xs font-bold text-white bg-primary-600 hover:bg-primary-700 rounded-xl uppercase tracking-widest shadow-lg shadow-primary-600/20">Save</button>
                    </div>
                </form>
            </Modal>

            {/* CREATE CLAUSE MODAL */}
            <Modal isOpen={isClauseModalOpen} onClose={() => setIsClauseModalOpen(false)} title="Add Reusable Legal Clause">
                <form onSubmit={handleCreateClause} className="space-y-4">
                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Clause Title / Name</label>
                        <input 
                            type="text" 
                            required 
                            value={clauseForm.title}
                            onChange={e => setClauseForm({ ...clauseForm, title: e.target.value })}
                            placeholder="e.g. Standard Payment Terms"
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-semibold"
                        />
                    </div>

                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Category</label>
                        <select 
                            value={clauseForm.category}
                            onChange={e => setClauseForm({ ...clauseForm, category: e.target.value })}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-semibold"
                        >
                            <option value="Payment">Payment</option>
                            <option value="Warranty">Warranty</option>
                            <option value="Confidentiality">Confidentiality</option>
                            <option value="GST">GST</option>
                            <option value="Termination">Termination</option>
                            <option value="Support">Support</option>
                            <option value="Penalty">Penalty</option>
                            <option value="Arbitration">Arbitration</option>
                        </select>
                    </div>

                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Clause Content (Plain text is auto-formatted)</label>
                        <div className="flex gap-2 mb-2">
                            <button
                                type="button"
                                onClick={() => setClauseForm(prev => ({ ...prev, content: prev.content + '<strong>bold text</strong>' }))}
                                className="px-3 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg text-[10px] font-bold text-slate-700"
                            >
                                Bold
                            </button>
                            <button
                                type="button"
                                onClick={() => setClauseForm(prev => ({ ...prev, content: prev.content + '<em>italic text</em>' }))}
                                className="px-3 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg text-[10px] font-bold text-slate-700"
                            >
                                Italic
                            </button>
                            <button
                                type="button"
                                onClick={() => setClauseForm(prev => ({ ...prev, content: prev.content + '<br />' }))}
                                className="px-3 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg text-[10px] font-bold text-slate-700"
                            >
                                Line Break
                            </button>
                        </div>
                        <textarea 
                            required 
                            value={clauseForm.content}
                            onChange={e => setClauseForm({ ...clauseForm, content: e.target.value })}
                            placeholder="Type standard text here. No HTML is required. For example:&#10;&#10;Payment should be made within 30 days. Late payments are subject to a fee."
                            className="w-full h-32 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-semibold"
                        />
                    </div>

                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Tags (Comma-separated)</label>
                        <input 
                            type="text" 
                            value={clauseForm.tags}
                            onChange={e => setClauseForm({ ...clauseForm, tags: e.target.value })}
                            placeholder="legal, standard, nda"
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-semibold"
                        />
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                        <button type="button" onClick={() => setIsClauseModalOpen(false)} className="px-5 py-2.5 text-xs font-bold text-slate-500 uppercase tracking-widest hover:bg-slate-50 rounded-xl">Cancel</button>
                        <button type="submit" className="px-6 py-2.5 text-xs font-bold text-white bg-primary-600 hover:bg-primary-700 rounded-xl uppercase tracking-widest">Save</button>
                    </div>
                </form>
            </Modal>

            {/* CREATE TEMPLATE MODAL */}
            <Modal isOpen={isTemplateModalOpen} onClose={() => setIsTemplateModalOpen(false)} title="Create HTML Document Template">
                <form onSubmit={handleCreateTemplate} className="space-y-4">
                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Template Name</label>
                        <input 
                            type="text" 
                            required 
                            value={templateForm.name}
                            onChange={e => setTemplateForm({ ...templateForm, name: e.target.value })}
                            placeholder="e.g. Yearly NDA Template"
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-semibold"
                        />
                    </div>

                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Category</label>
                        <select 
                            value={templateForm.category}
                            onChange={e => setTemplateForm({ ...templateForm, category: e.target.value })}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-semibold"
                        >
                            <option value="">Select category...</option>
                            {contractCategories.map(cat => (
                                <option key={cat._id} value={cat.name}>{cat.name}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Template Body Content (HTML or Plain Text)</label>
                        <div className="flex gap-2 mb-2">
                            <button
                                type="button"
                                onClick={() => setTemplateForm(prev => ({ ...prev, htmlContent: prev.htmlContent + '<strong>bold text</strong>' }))}
                                className="px-3 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg text-[10px] font-bold text-slate-700"
                            >
                                Bold
                            </button>
                            <button
                                type="button"
                                onClick={() => setTemplateForm(prev => ({ ...prev, htmlContent: prev.htmlContent + '<em>italic text</em>' }))}
                                className="px-3 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg text-[10px] font-bold text-slate-700"
                            >
                                Italic
                            </button>
                            <button
                                type="button"
                                onClick={() => setTemplateForm(prev => ({ ...prev, htmlContent: prev.htmlContent + '<br />' }))}
                                className="px-3 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg text-[10px] font-bold text-slate-700"
                            >
                                Line Break
                            </button>
                        </div>
                        <textarea 
                            required 
                            value={templateForm.htmlContent}
                            onChange={e => setTemplateForm({ ...templateForm, htmlContent: e.target.value })}
                            placeholder="Type standard text or HTML template content. Regular text will be automatically formatted to paragraphs on save."
                            className="w-full h-40 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-xs font-semibold"
                        />
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                        <button type="button" onClick={() => setIsTemplateModalOpen(false)} className="px-5 py-2.5 text-xs font-bold text-slate-500 uppercase tracking-widest hover:bg-slate-50 rounded-xl">Cancel</button>
                        <button type="submit" className="px-6 py-2.5 text-xs font-bold text-white bg-primary-600 hover:bg-primary-700 rounded-xl uppercase tracking-widest">Save</button>
                    </div>
                </form>
            </Modal>

            {/* Import Modal */}
            <ImportModal
                isOpen={isImportModalOpen}
                onClose={() => setIsImportModalOpen(false)}
                title="Import Contracts"
                type="contracts"
                onImport={async (file) => {
                    const result = await importService.importContracts(file);
                    fetchContracts(); // Refresh contracts after import
                    fetchDashboard(); // Refresh dashboard counts
                    return result;
                }}
                onDownloadTemplate={importService.getContractTemplate}
            />
        </div>
    );
};

export default Contracts;
