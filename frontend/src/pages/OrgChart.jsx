import React, { useState, useEffect, useRef, useMemo } from 'react';
import { payrollService, branchService } from '../services/api';
import { toast } from 'react-toastify';
import Modal from '../components/Modal';
import { 
    MdAccountTree, MdGridView, MdFormatListBulleted, MdSearch,
    MdAdd, MdDownload, MdZoomIn, MdZoomOut, MdCenterFocusStrong,
    MdEmail, MdPhone, MdShare, MdPersonAdd, MdWork,
    MdCheckCircle, MdWarning, MdStar, MdEdit, MdDelete, MdChevronRight,
    MdExpandMore, MdExpandLess, MdAssignment, MdSpeed, MdCorporateFare,
    MdOutlineSwapVert, MdAutoFixHigh
} from 'react-icons/md';
import { FaWhatsapp } from 'react-icons/fa';

const OrgChart = () => {
    const [employees, setEmployees] = useState([]);
    const [branches, setBranches] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [loading, setLoading] = useState(true);

    // View state: 'tree' | 'department' | 'flat'
    const [viewMode, setViewMode] = useState('tree');

    // Filters
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedDepartment, setSelectedDepartment] = useState('');
    const [selectedBranch, setSelectedBranch] = useState('');

    // Zoom & Pan state for Tree View
    const [zoomLevel, setZoomLevel] = useState(1);
    const [collapsedNodes, setCollapsedNodes] = useState({});

    // Drag & drop state
    const [draggedEmpId, setDraggedEmpId] = useState(null);
    const [dragOverEmpId, setDragOverEmpId] = useState(null);

    // Card Click Drawer / Detail Modal
    const [selectedEmp, setSelectedEmp] = useState(null);
    const [drawerTab, setDrawerTab] = useState('profile'); // 'profile' | 'reports' | 'contact' | 'kra'

    // Vacant Position Modal
    const [isVacantModalOpen, setIsVacantModalOpen] = useState(false);
    const [vacantForm, setVacantForm] = useState({
        name: '',
        designation: '',
        department: '',
        branchId: '',
        reportingTo: ''
    });

    // Batch Branch & Employee ID Modal
    const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
    const [batchItems, setBatchItems] = useState([]);
    const [batchDefaultBranch, setBatchDefaultBranch] = useState('');

    // Quick Hierarchy Setup Modal
    const [isHierarchyModalOpen, setIsHierarchyModalOpen] = useState(false);
    const [hierarchyList, setHierarchyList] = useState([]);

    // KRA Edit state
    const [kraFormList, setKraFormList] = useState([]);
    const [isSavingKra, setIsSavingKra] = useState(false);

    const chartContainerRef = useRef(null);

    // Load initial data
    const fetchData = async () => {
        try {
            setLoading(true);
            const [empRes, branchRes, deptRes] = await Promise.all([
                payrollService.getEmployees(),
                branchService.getAll(),
                payrollService.getDepartments()
            ]);
            setEmployees(empRes.data || []);
            setBranches(branchRes.data || []);
            setDepartments(deptRes.data || []);
        } catch (err) {
            console.error('Failed to load Org Chart data:', err);
            toast.error('Failed to load Org Chart data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    // Filter employees
    const filteredEmployees = useMemo(() => {
        return employees.filter(emp => {
            if (searchQuery) {
                const q = searchQuery.toLowerCase();
                const nameMatch = emp.name?.toLowerCase().includes(q);
                const desigMatch = emp.designation?.toLowerCase().includes(q);
                const deptMatch = emp.department?.toLowerCase().includes(q);
                const empIdMatch = emp.employeeId?.toLowerCase().includes(q);
                if (!nameMatch && !desigMatch && !deptMatch && !empIdMatch) return false;
            }
            if (selectedDepartment && emp.department !== selectedDepartment) return false;
            if (selectedBranch) {
                const bId = emp.branchId?._id || emp.branchId;
                if (bId !== selectedBranch) return false;
            }
            return true;
        });
    }, [employees, searchQuery, selectedDepartment, selectedBranch]);

    // Build hierarchy tree map
    const treeData = useMemo(() => {
        const empMap = new Map();
        employees.forEach(emp => {
            empMap.set(String(emp._id), { ...emp, children: [] });
        });

        const roots = [];
        employees.forEach(emp => {
            const current = empMap.get(String(emp._id));
            const parentId = emp.reportingTo?._id || emp.reportingTo;
            if (parentId && empMap.has(String(parentId))) {
                empMap.get(String(parentId)).children.push(current);
            } else {
                roots.push(current);
            }
        });

        return { roots, empMap };
    }, [employees]);

    // Level styling helper matching reference image
    const getLevelMeta = (emp, depth = 0) => {
        const desig = (emp.designation || '').toLowerCase();
        const isTopLeadership = desig.includes('ceo') || desig.includes('managing director') || desig.includes('cfo') || desig.includes('coo') || desig.includes('cpo') || depth === 0;

        if (isTopLeadership) {
            return {
                isTopTier: true,
                pillClass: 'bg-[#4cd3c0] dark:bg-teal-600 text-slate-900 dark:text-white border-2 border-teal-400 shadow-lg shadow-teal-500/20',
                diamondClass: 'bg-slate-900 border-4 border-slate-950 text-white shadow-xl'
            };
        } else if (depth === 1) {
            return {
                isTopTier: false,
                pillClass: 'bg-slate-700 text-white border border-slate-600 shadow-md',
                badgeClass: 'border-teal-400 bg-slate-900 text-white'
            };
        } else {
            return {
                isTopTier: false,
                pillClass: 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 shadow-sm',
                badgeClass: 'border-teal-500 bg-slate-800 text-white'
            };
        }
    };

    // Toggle node collapse
    const toggleCollapse = (nodeId) => {
        setCollapsedNodes(prev => ({ ...prev, [nodeId]: !prev[nodeId] }));
    };

    // Handle Drag and Drop Reporting Manager Reassignment
    const handleDragStart = (e, empId) => {
        e.stopPropagation();
        setDraggedEmpId(empId);
        e.dataTransfer.setData('text/plain', empId);
    };

    const handleDragOver = (e, empId) => {
        e.preventDefault();
        e.stopPropagation();
        if (draggedEmpId && draggedEmpId !== empId) {
            setDragOverEmpId(empId);
        }
    };

    const handleDragLeave = (e) => {
        e.stopPropagation();
        setDragOverEmpId(null);
    };

    const handleDrop = async (e, targetEmpId) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOverEmpId(null);

        if (!draggedEmpId || draggedEmpId === targetEmpId) return;

        const draggedEmp = employees.find(x => String(x._id) === String(draggedEmpId));
        const targetEmp = employees.find(x => String(x._id) === String(targetEmpId));

        if (!draggedEmp || !targetEmp) return;

        if (window.confirm(`Reassign ${draggedEmp.name} to report under ${targetEmp.name}?`)) {
            try {
                await payrollService.updateReportingManager(draggedEmp._id, targetEmp._id);
                toast.success(`Reporting manager updated! ${draggedEmp.name} now reports to ${targetEmp.name}`);
                fetchData();
            } catch (err) {
                console.error('Failed to reassign reporting manager', err);
                toast.error(err.response?.data?.message || 'Failed to update reporting manager');
            }
        }
        setDraggedEmpId(null);
    };

    // Open employee card click drawer
    const handleCardClick = (emp) => {
        setSelectedEmp(emp);
        setDrawerTab('profile');
        setKraFormList(emp.kraList || []);
    };

    // Save updated KRA list
    const handleSaveKra = async () => {
        if (!selectedEmp) return;
        try {
            setIsSavingKra(true);
            const res = await payrollService.updateKra(selectedEmp._id, kraFormList);
            toast.success('KRA metrics updated successfully');
            setSelectedEmp(prev => ({ ...prev, kraList: res.data.kraList }));
            fetchData();
        } catch (err) {
            console.error('Failed to update KRA', err);
            toast.error('Failed to update KRA');
        } finally {
            setIsSavingKra(false);
        }
    };

    const handleAddKraItem = () => {
        setKraFormList(prev => [
            ...prev,
            { title: '', weightage: 20, target: '', achievement: '', status: 'On Track' }
        ]);
    };

    const handleRemoveKraItem = (index) => {
        setKraFormList(prev => prev.filter((_, i) => i !== index));
    };

    // Vacant position creation
    const handleCreateVacant = async (e) => {
        e.preventDefault();
        try {
            await payrollService.createVacantPosition(vacantForm);
            toast.success('Vacant position created successfully!');
            setIsVacantModalOpen(false);
            setVacantForm({ name: '', designation: '', department: '', branchId: '', reportingTo: '' });
            fetchData();
        } catch (err) {
            console.error('Failed to create vacant position', err);
            toast.error('Failed to create vacant position');
        }
    };

    // Open Batch Branch & ID modal
    const handleOpenBatchModal = () => {
        const unassigned = employees.filter(emp => !emp.branchId || !emp.employeeId);
        if (unassigned.length === 0) {
            toast.info('All employees already have a Branch and Employee ID assigned!');
        }
        setBatchItems(unassigned.map(emp => ({
            employeeId_db: emp._id,
            name: emp.name,
            currentEmployeeId: emp.employeeId || '',
            currentBranchName: emp.branchId?.name || 'Unassigned',
            branchId: emp.branchId?._id || emp.branchId || '',
            customEmployeeId: ''
        })));
        setIsBatchModalOpen(true);
    };

    const handleApplyBatchDefaultBranch = (branchId) => {
        setBatchDefaultBranch(branchId);
        if (!branchId) return;
        setBatchItems(prev => prev.map(item => ({
            ...item,
            branchId: item.branchId || branchId
        })));
    };

    const handleExecuteBatchAssign = async () => {
        const validAssignments = batchItems.filter(item => item.branchId);
        if (validAssignments.length === 0) {
            toast.error('Please select a branch for at least one employee');
            return;
        }

        try {
            const payload = validAssignments.map(item => ({
                employeeId_db: item.employeeId_db,
                branchId: item.branchId,
                customEmployeeId: item.customEmployeeId || undefined
            }));
            const res = await payrollService.batchAssignBranchAndId(payload);
            toast.success(res.data?.message || 'Branch & Employee IDs updated successfully');
            setIsBatchModalOpen(false);
            fetchData();
        } catch (err) {
            console.error('Failed to batch assign branch & ID', err);
            toast.error('Failed to batch assign branch & ID');
        }
    };

    // Open Quick Hierarchy Setup Modal
    const handleOpenHierarchyModal = () => {
        setHierarchyList(employees.map(emp => ({
            _id: emp._id,
            name: emp.name,
            designation: emp.designation || '',
            reportingTo: emp.reportingTo?._id || emp.reportingTo || ''
        })));
        setIsHierarchyModalOpen(true);
    };

    const handleSaveHierarchy = async () => {
        try {
            for (const item of hierarchyList) {
                await payrollService.updateReportingManager(item._id, item.reportingTo || null);
            }
            toast.success('Hierarchy updated successfully!');
            setIsHierarchyModalOpen(false);
            fetchData();
        } catch (err) {
            console.error('Failed to update hierarchy', err);
            toast.error('Failed to update hierarchy');
        }
    };

    // Auto-organize default CEO hierarchy structure
    const handleAutoOrganizeHierarchy = async () => {
        if (employees.length === 0) return;
        const ceoCandidate = employees.find(e => (e.designation || '').toLowerCase().includes('ceo') || (e.designation || '').toLowerCase().includes('managing')) || employees[0];
        
        try {
            // Set CEO to root
            await payrollService.updateReportingManager(ceoCandidate._id, null);
            // Set all other root employees to report to CEO
            for (const emp of employees) {
                if (emp._id !== ceoCandidate._id && (!emp.reportingTo || !emp.reportingTo._id)) {
                    await payrollService.updateReportingManager(emp._id, ceoCandidate._id);
                }
            }
            toast.success(`Hierarchy structured under ${ceoCandidate.name} (CEO)!`);
            fetchData();
        } catch (err) {
            console.error('Auto organize failed', err);
            toast.error('Auto organize failed');
        }
    };

    // Export PDF/PNG Print
    const handleExportChart = () => {
        window.print();
    };

    // Recursive Tree Node Renderer matching Reference Image Layout & Card Badges Exactly
    const renderTreeNode = (node, depth = 0) => {
        const isCollapsed = collapsedNodes[node._id];
        const hasChildren = node.children && node.children.length > 0;
        const isSingleChild = node.children && node.children.length === 1;
        const meta = getLevelMeta(node, depth);
        const isDraggedOver = dragOverEmpId === node._id;

        return (
            <div key={node._id} className="flex flex-col items-center relative transition-all duration-300 my-2.5">
                {/* Node Card */}
                {meta.isTopTier ? (
                    /* Tier 0 / Leadership Style: Diamond Frame on Left + Teal Pill Container */
                    <div
                        draggable
                        onDragStart={(e) => handleDragStart(e, node._id)}
                        onDragOver={(e) => handleDragOver(e, node._id)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, node._id)}
                        onClick={() => handleCardClick(node)}
                        className={`group relative flex items-center cursor-pointer select-none transition-all duration-300 transform hover:-translate-y-1 hover:shadow-2xl ${
                            isDraggedOver ? 'scale-105 ring-4 ring-teal-400' : ''
                        }`}
                    >
                        {/* Diamond Avatar Container on Left */}
                        <div className="relative z-10 -mr-4 shrink-0">
                            <div className={`w-14 h-14 rounded-2xl rotate-45 flex items-center justify-center overflow-hidden ${meta.diamondClass}`}>
                                <div className="-rotate-45 w-full h-full flex items-center justify-center font-black text-lg">
                                    {node.isVacant ? (
                                        <MdPersonAdd className="text-amber-400 text-xl" />
                                    ) : (
                                        <span>{node.name ? node.name.charAt(0).toUpperCase() : 'E'}</span>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Oval Pill Container */}
                        <div className={`pl-7 pr-6 py-2.5 rounded-full min-w-[210px] max-w-[280px] flex items-center justify-between transition-all ${meta.pillClass}`}>
                            <div className="flex flex-col min-w-0 pr-2">
                                <h4 className="text-sm font-black tracking-tight truncate leading-tight">
                                    {node.name}
                                </h4>
                                <p className="text-[11px] font-semibold opacity-90 truncate mt-0.5">
                                    {node.designation || 'CEO'}
                                </p>
                            </div>

                            {hasChildren && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        toggleCollapse(node._id);
                                    }}
                                    className="ml-1 p-1 bg-slate-900/20 hover:bg-slate-900/40 rounded-full text-slate-900 dark:text-white transition-colors shrink-0"
                                >
                                    {isCollapsed ? <MdExpandMore size={16} /> : <MdExpandLess size={16} />}
                                </button>
                            )}
                        </div>
                    </div>
                ) : (
                    /* Tier 1+ Style matching Reference Image: Oval Pill + Small Floating Circular Avatar Photo on Top-Right */
                    <div
                        draggable
                        onDragStart={(e) => handleDragStart(e, node._id)}
                        onDragOver={(e) => handleDragOver(e, node._id)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, node._id)}
                        onClick={() => handleCardClick(node)}
                        className={`group relative flex items-center cursor-pointer select-none transition-all duration-300 transform hover:-translate-y-1 hover:shadow-xl rounded-full px-5 py-2 min-w-[200px] max-w-[260px] ${meta.pillClass} ${
                            isDraggedOver ? 'ring-4 ring-teal-400 scale-105' : ''
                        }`}
                    >
                        {/* Floating Small Circular Photo Badge on Top-Right Edge */}
                        <div className={`absolute -top-1 -right-1 z-20 w-8 h-8 rounded-full border-2 flex items-center justify-center font-extrabold text-xs shadow-md ${meta.badgeClass}`}>
                            {node.isVacant ? (
                                <MdPersonAdd className="text-amber-400 text-xs" />
                            ) : (
                                <span>{node.name ? node.name.charAt(0).toUpperCase() : 'E'}</span>
                            )}
                        </div>

                        {/* Card Content Text inside Pill */}
                        <div className="flex-1 text-center pr-3 min-w-0">
                            <h4 className="text-xs font-black truncate leading-tight">
                                {node.name}
                            </h4>
                            <p className="text-[11px] font-medium opacity-85 truncate mt-0.5">
                                {node.designation || 'Executive'}
                            </p>
                        </div>

                        {hasChildren && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    toggleCollapse(node._id);
                                }}
                                className="p-0.5 hover:bg-slate-400/30 rounded-full transition-colors shrink-0"
                            >
                                {isCollapsed ? <MdExpandMore size={14} /> : <MdExpandLess size={14} />}
                            </button>
                        )}
                    </div>
                )}

                {/* Vertical Line Connector Down */}
                {hasChildren && !isCollapsed && (
                    <div className="w-0.5 h-6 bg-slate-400 dark:bg-slate-600 my-0.5" />
                )}

                {/* Sub-Children Hierarchy Rendering: Vertical Stack for 1 child vs Horizontal Spanner for >1 children */}
                {hasChildren && !isCollapsed && (
                    <div className="relative flex justify-center pt-1">
                        {/* If more than 1 child: Horizontal Connector Spanner Bar */}
                        {!isSingleChild && (
                            <div className="absolute top-0 left-12 right-12 h-0.5 bg-slate-400 dark:bg-slate-600" />
                        )}

                        {/* If single child: Direct Vertical Stack Chain (1-to-1 down) */}
                        {isSingleChild ? (
                            <div className="flex flex-col items-center">
                                {renderTreeNode(node.children[0], depth + 1)}
                            </div>
                        ) : (
                            /* Multiple children: Side-by-Side Horizontal Tree Branches */
                            <div className="flex space-x-8">
                                {node.children.map(child => (
                                    <div key={child._id} className="relative flex flex-col items-center">
                                        <div className="w-0.5 h-3.5 bg-slate-400 dark:bg-slate-600" />
                                        {renderTreeNode(child, depth + 1)}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="p-4 md:p-8 max-w-[1700px] mx-auto space-y-6">
            {/* Top Title & Header Actions Bar */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-xl border border-slate-100 dark:border-slate-800 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center space-x-3">
                        <div className="p-3 bg-gradient-to-tr from-teal-500 to-emerald-500 rounded-2xl text-white shadow-lg shadow-teal-500/30">
                            <MdAccountTree size={28} />
                        </div>
                        <div>
                            <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                                ARCRM Org Chart Module
                            </h1>
                            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
                                Visual Employee Hierarchy, Drag & Drop Reporting, KRA & Branch Management
                            </p>
                        </div>
                    </div>
                </div>

                {/* Action Controls */}
                <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto justify-end">
                    {treeData.roots.length > 1 && (
                        <button
                            onClick={handleAutoOrganizeHierarchy}
                            className="flex items-center space-x-2 px-4 py-2.5 bg-gradient-to-r from-teal-600 to-emerald-600 text-white rounded-xl font-bold text-sm transition-all shadow-md"
                            title="Auto-organize unassigned employees under CEO"
                        >
                            <MdAutoFixHigh size={20} />
                            <span>Auto-Build Tree</span>
                        </button>
                    )}

                    <button
                        onClick={handleOpenHierarchyModal}
                        className="flex items-center space-x-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold text-sm transition-all shadow-md"
                        title="Set Reporting Hierarchy"
                    >
                        <MdOutlineSwapVert size={20} className="text-teal-400" />
                        <span>Organize Hierarchy</span>
                    </button>

                    <button
                        onClick={() => setIsVacantModalOpen(true)}
                        className="flex items-center space-x-2 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl font-bold text-sm transition-all shadow-sm"
                    >
                        <MdAdd size={20} className="text-teal-500" />
                        <span>Add Vacant Position</span>
                    </button>

                    <button
                        onClick={handleOpenBatchModal}
                        className="flex items-center space-x-2 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl font-bold text-sm transition-all shadow-md shadow-amber-500/20"
                    >
                        <MdCorporateFare size={20} />
                        <span>Batch Assign Branch & ID</span>
                    </button>

                    <button
                        onClick={handleExportChart}
                        className="flex items-center space-x-2 px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold text-sm transition-all shadow-md shadow-teal-600/20"
                    >
                        <MdDownload size={20} />
                        <span>Export Chart</span>
                    </button>
                </div>
            </div>

            {/* Filter & View Switcher Bar */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-lg border border-slate-100 dark:border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
                {/* Search Bar */}
                <div className="relative w-full md:w-80">
                    <MdSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xl" />
                    <input
                        type="text"
                        placeholder="Search by name, role, dept..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium focus:ring-2 focus:ring-teal-500 outline-none text-slate-800 dark:text-white"
                    />
                </div>

                {/* Dropdown Filters */}
                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                    <select
                        value={selectedDepartment}
                        onChange={(e) => setSelectedDepartment(e.target.value)}
                        className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold outline-none text-slate-800 dark:text-white"
                    >
                        <option value="">All Departments</option>
                        {departments.map(d => (
                            <option key={d._id || d.name} value={d.name}>{d.name}</option>
                        ))}
                    </select>

                    <select
                        value={selectedBranch}
                        onChange={(e) => setSelectedBranch(e.target.value)}
                        className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold outline-none text-slate-800 dark:text-white"
                    >
                        <option value="">All Branches</option>
                        {branches.map(b => (
                            <option key={b._id} value={b._id}>{b.name} ({b.branchPrefix || b.code})</option>
                        ))}
                    </select>
                </div>

                {/* View Switcher Segmented Button */}
                <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                    <button
                        onClick={() => setViewMode('tree')}
                        className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-bold text-xs transition-all ${
                            viewMode === 'tree' ? 'bg-white dark:bg-slate-700 text-teal-600 dark:text-teal-400 shadow-sm' : 'text-slate-500 dark:text-slate-400'
                        }`}
                    >
                        <MdAccountTree size={16} />
                        <span>Tree View</span>
                    </button>

                    <button
                        onClick={() => setViewMode('department')}
                        className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-bold text-xs transition-all ${
                            viewMode === 'department' ? 'bg-white dark:bg-slate-700 text-teal-600 dark:text-teal-400 shadow-sm' : 'text-slate-500 dark:text-slate-400'
                        }`}
                    >
                        <MdGridView size={16} />
                        <span>Dept View</span>
                    </button>

                    <button
                        onClick={() => setViewMode('flat')}
                        className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-bold text-xs transition-all ${
                            viewMode === 'flat' ? 'bg-white dark:bg-slate-700 text-teal-600 dark:text-teal-400 shadow-sm' : 'text-slate-500 dark:text-slate-400'
                        }`}
                    >
                        <MdFormatListBulleted size={16} />
                        <span>Flat View</span>
                    </button>
                </div>
            </div>

            {/* Main Content Area */}
            {loading ? (
                <div className="flex flex-col items-center justify-center py-24 space-y-4">
                    <div className="w-12 h-12 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-slate-500 font-semibold">Building Org Hierarchy Chart...</p>
                </div>
            ) : (
                <>
                    {/* VIEW 1: TREE VIEW */}
                    {viewMode === 'tree' && (
                        <div className="bg-slate-50 dark:bg-slate-900 rounded-3xl p-8 shadow-xl border border-slate-200 dark:border-slate-800 overflow-x-auto min-h-[600px] relative">
                            {/* Floating Zoom Controls */}
                            <div className="absolute top-4 right-4 z-10 flex items-center space-x-2 bg-slate-900/80 backdrop-blur-md text-white p-1.5 rounded-2xl shadow-xl border border-slate-700">
                                <button
                                    onClick={() => setZoomLevel(prev => Math.min(prev + 0.15, 1.8))}
                                    className="p-2 hover:bg-slate-700 rounded-xl transition-colors"
                                    title="Zoom In"
                                >
                                    <MdZoomIn size={20} />
                                </button>
                                <span className="text-xs font-mono font-bold px-2">{Math.round(zoomLevel * 100)}%</span>
                                <button
                                    onClick={() => setZoomLevel(prev => Math.max(prev - 0.15, 0.4))}
                                    className="p-2 hover:bg-slate-700 rounded-xl transition-colors"
                                    title="Zoom Out"
                                >
                                    <MdZoomOut size={20} />
                                </button>
                                <button
                                    onClick={() => setZoomLevel(1)}
                                    className="p-2 hover:bg-slate-700 rounded-xl transition-colors"
                                    title="Reset Fit"
                                >
                                    <MdCenterFocusStrong size={20} />
                                </button>
                            </div>

                            {/* Unassigned Helper Banner */}
                            {treeData.roots.length > 1 && (
                                <div className="mb-6 p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-2xl text-amber-800 dark:text-amber-300 text-xs font-medium flex items-center justify-between">
                                    <span>
                                        💡 <b>Multiple Unassigned Employees Found ({treeData.roots.length}):</b> Drag any card onto its manager's card, or click <b>"Auto-Build Tree"</b> to attach them into a multi-tier hierarchy structure automatically.
                                    </span>
                                    <button
                                        onClick={handleAutoOrganizeHierarchy}
                                        className="px-3 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-bold text-xs transition-all shadow-sm"
                                    >
                                        Auto-Build Tree
                                    </button>
                                </div>
                            )}

                            {/* Hierarchy Tree Container */}
                            <div
                                ref={chartContainerRef}
                                style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'top center' }}
                                className="flex justify-center pt-6 transition-transform duration-200"
                            >
                                {treeData.roots.length === 0 ? (
                                    <div className="text-center py-20">
                                        <p className="text-slate-400 font-medium">No employees found matching the current filters.</p>
                                    </div>
                                ) : (
                                    <div className="flex space-x-12">
                                        {treeData.roots.map(root => renderTreeNode(root, 0))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* VIEW 2: DEPARTMENT VIEW */}
                    {viewMode === 'department' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {Array.from(new Set(filteredEmployees.map(e => e.department || 'General'))).map(deptName => {
                                const deptEmps = filteredEmployees.filter(e => (e.department || 'General') === deptName);
                                return (
                                    <div key={deptName} className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-xl border border-slate-100 dark:border-slate-800 space-y-4">
                                        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                                            <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center">
                                                <MdWork className="text-teal-500 mr-2" />
                                                {deptName}
                                            </h3>
                                            <span className="px-2.5 py-1 bg-teal-100 text-teal-800 dark:bg-teal-900/50 dark:text-teal-300 rounded-full text-xs font-bold">
                                                {deptEmps.length} Members
                                            </span>
                                        </div>

                                        <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                                            {deptEmps.map(emp => (
                                                <div
                                                    key={emp._id}
                                                    onClick={() => handleCardClick(emp)}
                                                    className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/50 dark:border-slate-700/50 flex items-center justify-between cursor-pointer hover:border-teal-500 transition-all"
                                                >
                                                    <div className="flex items-center space-x-3">
                                                        <div className="w-10 h-10 rounded-xl bg-teal-600 text-white font-bold flex items-center justify-center text-sm shadow-md">
                                                            {emp.name ? emp.name.charAt(0).toUpperCase() : 'E'}
                                                        </div>
                                                        <div>
                                                            <h5 className="text-sm font-bold text-slate-900 dark:text-white">{emp.name}</h5>
                                                            <p className="text-xs text-slate-500">{emp.designation || 'Executive'}</p>
                                                        </div>
                                                    </div>
                                                    <MdChevronRight className="text-slate-400 text-xl" />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* VIEW 3: FLAT VIEW */}
                    {viewMode === 'flat' && (
                        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-xl border border-slate-100 dark:border-slate-800 overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-extrabold uppercase text-slate-400">
                                        <th className="py-3 px-4">Employee ID</th>
                                        <th className="py-3 px-4">Employee Name</th>
                                        <th className="py-3 px-4">Designation</th>
                                        <th className="py-3 px-4">Department</th>
                                        <th className="py-3 px-4">Branch</th>
                                        <th className="py-3 px-4">Reporting Manager</th>
                                        <th className="py-3 px-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm font-medium">
                                    {filteredEmployees.map(emp => (
                                        <tr key={emp._id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                            <td className="py-3.5 px-4 font-mono font-bold text-teal-600 dark:text-teal-400">
                                                {emp.employeeId || 'N/A'}
                                            </td>
                                            <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                                                <div className="w-7 h-7 rounded-full bg-slate-700 text-white font-bold flex items-center justify-center text-xs">
                                                    {emp.name ? emp.name.charAt(0) : 'E'}
                                                </div>
                                                <span>{emp.name}</span>
                                            </td>
                                            <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">{emp.designation || '-'}</td>
                                            <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">{emp.department || '-'}</td>
                                            <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">
                                                {emp.branchId?.name || emp.branchId?.code || 'Unassigned'}
                                            </td>
                                            <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">
                                                {emp.reportingTo?.name || 'Top Manager / CEO'}
                                            </td>
                                            <td className="py-3.5 px-4 text-right">
                                                <button
                                                    onClick={() => handleCardClick(emp)}
                                                    className="px-3 py-1.5 bg-teal-100 text-teal-800 dark:bg-teal-900/50 dark:text-teal-300 rounded-lg text-xs font-bold hover:bg-teal-200 transition-all"
                                                >
                                                    View Details
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </>
            )}

            {/* QUICK HIERARCHY SETUP MODAL */}
            {isHierarchyModalOpen && (
                <Modal
                    isOpen={isHierarchyModalOpen}
                    onClose={() => setIsHierarchyModalOpen(false)}
                    title="Organize Employee Hierarchy & Reporting Managers"
                    maxWidth="max-w-3xl"
                >
                    <div className="space-y-4">
                        <p className="text-xs text-slate-500 font-medium">
                            Select who each employee reports to. Set CEO/Top Leader's reporting manager to "Top Leader (CEO)".
                        </p>

                        <div className="max-h-[450px] overflow-y-auto space-y-3 pr-1">
                            {hierarchyList.map((item, idx) => (
                                <div key={item._id} className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl flex items-center justify-between border border-slate-200 dark:border-slate-700">
                                    <div>
                                        <h5 className="font-bold text-slate-900 dark:text-white text-sm">{item.name}</h5>
                                        <p className="text-xs text-slate-500">{item.designation || 'Employee'}</p>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <span className="text-xs font-semibold text-slate-400">Reports To:</span>
                                        <select
                                            value={item.reportingTo}
                                            onChange={(e) => {
                                                const newArr = [...hierarchyList];
                                                newArr[idx].reportingTo = e.target.value;
                                                setHierarchyList(newArr);
                                            }}
                                            className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-bold outline-none"
                                        >
                                            <option value="">Top Leader (CEO / Root)</option>
                                            {employees.filter(x => x._id !== item._id).map(mgr => (
                                                <option key={mgr._id} value={mgr._id}>{mgr.name} ({mgr.designation || 'Manager'})</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="flex justify-end space-x-3 pt-2">
                            <button
                                onClick={() => setIsHierarchyModalOpen(false)}
                                className="px-4 py-2 bg-slate-200 dark:bg-slate-700 rounded-xl text-xs font-bold"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveHierarchy}
                                className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow-md"
                            >
                                Save Hierarchy Tree
                            </button>
                        </div>
                    </div>
                </Modal>
            )}

            {/* EMPLOYEE CLICK DRAWER / MODAL */}
            {selectedEmp && (
                <Modal
                    isOpen={!!selectedEmp}
                    onClose={() => setSelectedEmp(null)}
                    title={`${selectedEmp.name} - Profile & Actions`}
                    maxWidth="max-w-3xl"
                >
                    <div className="space-y-6">
                        {/* Header Banner */}
                        <div className="bg-gradient-to-r from-slate-900 via-teal-950 to-slate-900 rounded-2xl p-6 text-white flex items-center justify-between">
                            <div className="flex items-center space-x-4">
                                <div className="w-16 h-16 rounded-2xl bg-teal-500 text-slate-950 font-black text-2xl flex items-center justify-center shadow-lg">
                                    {selectedEmp.name ? selectedEmp.name.charAt(0) : 'E'}
                                </div>
                                <div>
                                    <h3 className="text-xl font-extrabold">{selectedEmp.name}</h3>
                                    <p className="text-teal-300 font-medium text-sm">{selectedEmp.designation || 'Employee'}</p>
                                    <p className="text-xs opacity-75">{selectedEmp.department} • ID: {selectedEmp.employeeId || 'Pending'}</p>
                                </div>
                            </div>
                        </div>

                        {/* Modal Navigation Tabs */}
                        <div className="flex border-b border-slate-200 dark:border-slate-700">
                            {[
                                { key: 'profile', label: '1. Profile Details', icon: <MdAssignment /> },
                                { key: 'reports', label: '2. Direct Reports', icon: <MdAccountTree /> },
                                { key: 'contact', label: '3. Email / WhatsApp', icon: <FaWhatsapp /> },
                                { key: 'kra', label: '4. KRA & Performance', icon: <MdSpeed /> }
                            ].map(tab => (
                                <button
                                    key={tab.key}
                                    onClick={() => setDrawerTab(tab.key)}
                                    className={`flex items-center space-x-2 px-4 py-3 font-bold text-sm border-b-2 transition-all ${
                                        drawerTab === tab.key
                                            ? 'border-teal-500 text-teal-600 dark:text-teal-400'
                                            : 'border-transparent text-slate-500 hover:text-slate-700'
                                    }`}
                                >
                                    <span>{tab.icon}</span>
                                    <span>{tab.label}</span>
                                </button>
                            ))}
                        </div>

                        {/* TAB 1: PROFILE DETAILS */}
                        {drawerTab === 'profile' && (
                            <div className="grid grid-cols-2 gap-4 text-sm font-medium">
                                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                                    <span className="text-xs text-slate-400 block font-bold">Email</span>
                                    <span className="text-slate-900 dark:text-white">{selectedEmp.email || 'N/A'}</span>
                                </div>
                                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                                    <span className="text-xs text-slate-400 block font-bold">Mobile</span>
                                    <span className="text-slate-900 dark:text-white">{selectedEmp.mobile || 'N/A'}</span>
                                </div>
                                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                                    <span className="text-xs text-slate-400 block font-bold">Branch</span>
                                    <span className="text-slate-900 dark:text-white">{selectedEmp.branchId?.name || 'Unassigned'}</span>
                                </div>
                                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                                    <span className="text-xs text-slate-400 block font-bold">Reporting Manager</span>
                                    <span className="text-slate-900 dark:text-white">{selectedEmp.reportingTo?.name || 'None (Top Leader)'}</span>
                                </div>
                                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                                    <span className="text-xs text-slate-400 block font-bold">Joining Date</span>
                                    <span className="text-slate-900 dark:text-white">
                                        {selectedEmp.joiningDate ? new Date(selectedEmp.joiningDate).toLocaleDateString() : 'N/A'}
                                    </span>
                                </div>
                                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                                    <span className="text-xs text-slate-400 block font-bold">Status</span>
                                    <span className="text-emerald-600 font-bold">{selectedEmp.status || 'Active'}</span>
                                </div>
                            </div>
                        )}

                        {/* TAB 2: DIRECT REPORTS */}
                        {drawerTab === 'reports' && (
                            <div className="space-y-3">
                                {employees.filter(e => (e.reportingTo?._id || e.reportingTo) === selectedEmp._id).length === 0 ? (
                                    <p className="text-center py-8 text-slate-400 font-medium">No direct reports assigned to {selectedEmp.name}.</p>
                                ) : (
                                    employees.filter(e => (e.reportingTo?._id || e.reportingTo) === selectedEmp._id).map(report => (
                                        <div key={report._id} className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl flex items-center justify-between">
                                            <div>
                                                <h5 className="font-bold text-slate-900 dark:text-white">{report.name}</h5>
                                                <p className="text-xs text-slate-500">{report.designation || 'Team Member'}</p>
                                            </div>
                                            <span className="text-xs font-mono text-teal-600 font-bold">{report.employeeId || 'ID Pending'}</span>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}

                        {/* TAB 3: EMAIL / WHATSAPP */}
                        {drawerTab === 'contact' && (
                            <div className="grid grid-cols-2 gap-4 py-4">
                                <a
                                    href={`mailto:${selectedEmp.email || ''}?subject=ARCRM%20Official%20Communication`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="p-6 bg-gradient-to-br from-blue-600 to-indigo-700 text-white rounded-2xl flex flex-col items-center justify-center space-y-2 font-bold shadow-lg hover:scale-105 transition-all"
                                >
                                    <MdEmail size={32} />
                                    <span>Send Email</span>
                                    <span className="text-xs opacity-80 font-normal">{selectedEmp.email || 'No email registered'}</span>
                                </a>

                                <a
                                    href={`https://wa.me/${(selectedEmp.mobile || '').replace(/[^0-9]/g, '')}?text=Hello%20${encodeURIComponent(selectedEmp.name)},%20reaching%20out%20from%20ARCRM.`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="p-6 bg-gradient-to-br from-emerald-500 to-green-600 text-white rounded-2xl flex flex-col items-center justify-center space-y-2 font-bold shadow-lg hover:scale-105 transition-all"
                                >
                                    <FaWhatsapp size={32} />
                                    <span>Send WhatsApp</span>
                                    <span className="text-xs opacity-80 font-normal">{selectedEmp.mobile || 'No mobile number'}</span>
                                </a>
                            </div>
                        )}

                        {/* TAB 4: KRA & PERFORMANCE */}
                        {drawerTab === 'kra' && (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h4 className="font-extrabold text-slate-900 dark:text-white text-base">Key Result Areas (KRAs)</h4>
                                    <button
                                        onClick={handleAddKraItem}
                                        className="px-3 py-1.5 bg-teal-500 hover:bg-teal-600 text-white rounded-xl font-bold text-xs flex items-center space-x-1"
                                    >
                                        <MdAdd size={16} />
                                        <span>Add KRA Metric</span>
                                    </button>
                                </div>

                                {kraFormList.length === 0 ? (
                                    <p className="text-center py-6 text-slate-400 font-medium">No KRAs defined yet. Click "Add KRA Metric" above.</p>
                                ) : (
                                    <div className="space-y-3">
                                        {kraFormList.map((kra, index) => (
                                            <div key={index} className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                                                <div className="flex items-center space-x-2">
                                                    <input
                                                        type="text"
                                                        placeholder="KRA Goal / Title"
                                                        value={kra.title}
                                                        onChange={(e) => {
                                                            const newArr = [...kraFormList];
                                                            newArr[index].title = e.target.value;
                                                            setKraFormList(newArr);
                                                        }}
                                                        className="flex-1 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-bold outline-none"
                                                    />
                                                    <select
                                                        value={kra.status}
                                                        onChange={(e) => {
                                                            const newArr = [...kraFormList];
                                                            newArr[index].status = e.target.value;
                                                            setKraFormList(newArr);
                                                        }}
                                                        className="px-2 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-bold"
                                                    >
                                                        <option value="On Track">On Track</option>
                                                        <option value="Needs Attention">Needs Attention</option>
                                                        <option value="Exceeded">Exceeded</option>
                                                        <option value="Behind">Behind</option>
                                                    </select>
                                                    <button
                                                        onClick={() => handleRemoveKraItem(index)}
                                                        className="text-red-500 hover:text-red-700 p-1"
                                                    >
                                                        <MdDelete size={18} />
                                                    </button>
                                                </div>

                                                <div className="grid grid-cols-3 gap-2">
                                                    <input
                                                        type="number"
                                                        placeholder="Weightage %"
                                                        value={kra.weightage}
                                                        onChange={(e) => {
                                                            const newArr = [...kraFormList];
                                                            newArr[index].weightage = Number(e.target.value);
                                                            setKraFormList(newArr);
                                                        }}
                                                        className="px-2 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-xs"
                                                    />
                                                    <input
                                                        type="text"
                                                        placeholder="Target"
                                                        value={kra.target}
                                                        onChange={(e) => {
                                                            const newArr = [...kraFormList];
                                                            newArr[index].target = e.target.value;
                                                            setKraFormList(newArr);
                                                        }}
                                                        className="px-2 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-xs"
                                                    />
                                                    <input
                                                        type="text"
                                                        placeholder="Achievement"
                                                        value={kra.achievement}
                                                        onChange={(e) => {
                                                            const newArr = [...kraFormList];
                                                            newArr[index].achievement = e.target.value;
                                                            setKraFormList(newArr);
                                                        }}
                                                        className="px-2 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-xs"
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <div className="flex justify-end pt-2">
                                    <button
                                        onClick={handleSaveKra}
                                        disabled={isSavingKra}
                                        className="px-5 py-2 bg-gradient-to-r from-teal-500 to-emerald-500 text-white rounded-xl font-bold text-xs shadow-md hover:shadow-lg transition-all"
                                    >
                                        {isSavingKra ? 'Saving...' : 'Save KRA Metrics'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </Modal>
            )}

            {/* VACANT POSITION MODAL */}
            {isVacantModalOpen && (
                <Modal
                    isOpen={isVacantModalOpen}
                    onClose={() => setIsVacantModalOpen(false)}
                    title="Add Vacant Position Node"
                >
                    <form onSubmit={handleCreateVacant} className="space-y-4">
                        <div>
                            <label className="block text-xs font-extrabold uppercase text-slate-500 mb-1">Position / Role Name</label>
                            <input
                                type="text"
                                required
                                placeholder="e.g. Senior Frontend Engineer"
                                value={vacantForm.name}
                                onChange={(e) => setVacantForm({ ...vacantForm, name: e.target.value })}
                                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-semibold outline-none"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-extrabold uppercase text-slate-500 mb-1">Designation</label>
                                <input
                                    type="text"
                                    placeholder="e.g. Senior Executive"
                                    value={vacantForm.designation}
                                    onChange={(e) => setVacantForm({ ...vacantForm, designation: e.target.value })}
                                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-extrabold uppercase text-slate-500 mb-1">Department</label>
                                <input
                                    type="text"
                                    placeholder="e.g. Technology"
                                    value={vacantForm.department}
                                    onChange={(e) => setVacantForm({ ...vacantForm, department: e.target.value })}
                                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm outline-none"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-extrabold uppercase text-slate-500 mb-1">Reporting Manager</label>
                            <select
                                value={vacantForm.reportingTo}
                                onChange={(e) => setVacantForm({ ...vacantForm, reportingTo: e.target.value })}
                                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-semibold outline-none"
                            >
                                <option value="">Top Level (No Manager)</option>
                                {employees.map(emp => (
                                    <option key={emp._id} value={emp._id}>{emp.name} ({emp.designation || 'Manager'})</option>
                                ))}
                            </select>
                        </div>

                        <div className="flex justify-end space-x-3 pt-4">
                            <button
                                type="button"
                                onClick={() => setIsVacantModalOpen(false)}
                                className="px-4 py-2 bg-slate-200 dark:bg-slate-700 rounded-xl text-xs font-bold"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow-md"
                            >
                                Create Vacant Node
                            </button>
                        </div>
                    </form>
                </Modal>
            )}

            {/* BATCH ASSIGN BRANCH & EMPLOYEE ID MODAL */}
            {isBatchModalOpen && (
                <Modal
                    isOpen={isBatchModalOpen}
                    onClose={() => setIsBatchModalOpen(false)}
                    title="Batch Assign Branch & Employee ID"
                    maxWidth="max-w-4xl"
                >
                    <div className="space-y-6">
                        <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-2xl text-amber-800 dark:text-amber-300 text-xs font-medium">
                            <p className="font-bold text-sm mb-1">Assign Branch & Generate Employee IDs in Bulk</p>
                            Select a target branch for previous/imported employees. The system will automatically generate sequential Employee IDs (e.g. MUM1001, DEL1002) for each employee based on the selected branch prefix.
                        </div>

                        {/* Apply Default Branch Controls */}
                        <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl">
                            <span className="text-xs font-extrabold uppercase text-slate-600 dark:text-slate-300">Set Default Branch for All:</span>
                            <div className="flex items-center space-x-3">
                                <select
                                    value={batchDefaultBranch}
                                    onChange={(e) => handleApplyBatchDefaultBranch(e.target.value)}
                                    className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold"
                                >
                                    <option value="">Select Branch...</option>
                                    {branches.map(b => (
                                        <option key={b._id} value={b._id}>{b.name} ({b.branchPrefix || b.code})</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Batch Employees Table */}
                        <div className="max-h-[400px] overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-2xl">
                            <table className="w-full text-left border-collapse text-xs">
                                <thead className="bg-slate-100 dark:bg-slate-800 text-slate-500 font-extrabold uppercase sticky top-0">
                                    <tr>
                                        <th className="py-2.5 px-3">Employee Name</th>
                                        <th className="py-2.5 px-3">Current Branch</th>
                                        <th className="py-2.5 px-3">Assign Target Branch</th>
                                        <th className="py-2.5 px-3">Custom ID (Optional)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-semibold">
                                    {batchItems.map((item, index) => (
                                        <tr key={item.employeeId_db} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                                            <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white">{item.name}</td>
                                            <td className="py-2.5 px-3 text-slate-500">{item.currentBranchName}</td>
                                            <td className="py-2.5 px-3">
                                                <select
                                                    value={item.branchId}
                                                    onChange={(e) => {
                                                        const newItems = [...batchItems];
                                                        newItems[index].branchId = e.target.value;
                                                        setBatchItems(newItems);
                                                    }}
                                                    className="w-full px-2 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg"
                                                >
                                                    <option value="">Select Branch...</option>
                                                    {branches.map(b => (
                                                        <option key={b._id} value={b._id}>{b.name} ({b.branchPrefix || b.code})</option>
                                                    ))}
                                                </select>
                                            </td>
                                            <td className="py-2.5 px-3">
                                                <input
                                                    type="text"
                                                    placeholder="Auto-generate"
                                                    value={item.customEmployeeId}
                                                    onChange={(e) => {
                                                        const newItems = [...batchItems];
                                                        newItems[index].customEmployeeId = e.target.value;
                                                        setBatchItems(newItems);
                                                    }}
                                                    className="w-full px-2 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg font-mono text-xs"
                                                />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="flex justify-end space-x-3">
                            <button
                                onClick={() => setIsBatchModalOpen(false)}
                                className="px-4 py-2 bg-slate-200 dark:bg-slate-700 rounded-xl text-xs font-bold"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleExecuteBatchAssign}
                                className="px-5 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl text-xs font-extrabold shadow-md"
                            >
                                Save & Generate IDs
                            </button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default OrgChart;
