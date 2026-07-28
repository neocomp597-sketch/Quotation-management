import React, { useEffect, useState, useRef } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { payrollService, salespersonService } from '../services/api';
import Modal from '../components/Modal';
import { toast } from 'react-toastify';
import { 
    MdCategory as IconCategory, 
    MdAssignment as IconAssignment, 
    MdAdd as IconAdd, 
    MdDelete as IconDelete, 
    MdEdit as IconEdit, 
    MdPeople as IconPeople,
    MdViewColumn as IconViewColumn,
    MdList as IconList,
    MdPersonAdd as IconPersonAdd,
    MdClose as IconClose,
    MdFilterList as IconFilterList,
    MdSearch as IconSearch,
    MdExpandMore,
    MdCheckCircle,
    MdGridOn as IconGridOn,
    MdBusiness,
    MdRefresh,
    MdCheck,
    MdArrowBack
} from 'react-icons/md';

const DEFAULT_SAMPLE_PERSONNEL = {
    'Sales Department': ['Rahul', 'Priya', 'Om'],
    'Sales': ['Rahul', 'Priya', 'Om'],
    'Support Department': ['Amit', 'Suman'],
    'Support': ['Amit', 'Suman'],
    'Marketing Department': ['Neha', 'Karan'],
    'Marketing': ['Neha', 'Karan']
};

const SearchableSelect = ({ label, options, value, onChange, placeholder = "Search module name..." }) => {
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

const PayrollMasters = ({ isCreatePage, isEditPage }) => {
    const navigate = useNavigate();
    const { id: routeId } = useParams();
    const location = useLocation();
    const queryParams = new URLSearchParams(location.search);
    const initialTab = queryParams.get('tab') || 'departments';

    const [activeTab, setActiveTab] = useState(initialTab);
    const [deptSubTab, setDeptSubTab] = useState('overview'); // 'overview', 'master', 'column', 'list'

    const [loading, setLoading] = useState(false);
    const [items, setItems] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [salespersons, setSalespersons] = useState([]);

    // Overview Tab state
    const [selectedOverviewDeptId, setSelectedOverviewDeptId] = useState(null);

    // Master Form state
    const [editingMasterDeptId, setEditingMasterDeptId] = useState(null);
    const [assignEmpSearch, setAssignEmpSearch] = useState('');
    const [masterForm, setMasterForm] = useState({
        code: '',
        name: '',
        head: '',
        status: 'Active',
        description: '',
        assignedEmpIds: []
    });

    // Filter states
    const [selectedModule, setSelectedModule] = useState('All');
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        const tab = new URLSearchParams(location.search).get('tab');
        if (tab && (tab === 'departments' || tab === 'designations')) {
            setActiveTab(tab);
        }
    }, [location.search]);
    
    // Department / Designation modal
    const [showModal, setShowModal] = useState(false);
    const [editId, setEditId] = useState(null);
    const [formData, setFormData] = useState({ name: '', description: '' });

    // Assign Person modal
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [assignDeptName, setAssignDeptName] = useState('');
    const [assignPersonType, setAssignPersonType] = useState('new');
    const [selectedPersonId, setSelectedPersonId] = useState('');
    const [newPersonName, setNewPersonName] = useState('');
    const [savingAssign, setSavingAssign] = useState(false);

    const tabs = [
        { id: 'departments', label: 'Departments', icon: <IconCategory size={20} /> },
        { id: 'designations', label: 'Designations', icon: <IconAssignment size={20} /> }
    ];

    const fetchItems = async () => {
        setLoading(true);
        try {
            const [itemsRes, empRes, salesRes] = await Promise.all([
                activeTab === 'departments' 
                    ? payrollService.getDepartments() 
                    : payrollService.getDesignations(),
                payrollService.getEmployees().catch(() => ({ data: [] })),
                salespersonService.getAll().catch(() => ({ data: [] }))
            ]);
            
            const fetchedDepts = itemsRes.data || [];
            setItems(fetchedDepts);
            setEmployees(empRes.data || []);
            
            const salesData = salesRes.data;
            setSalespersons(Array.isArray(salesData) ? salesData : salesData?.data || []);

            // Default selected overview department if not set
            if (fetchedDepts.length > 0 && !selectedOverviewDeptId) {
                setSelectedOverviewDeptId(fetchedDepts[0]._id);
            }
        } catch (error) {
            console.error('Fetch masters error:', error);
            toast.error('Failed to load payroll configuration masters');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchItems();
    }, [activeTab]);

    useEffect(() => {
        const handleRealtimeUpdate = (e) => {
            const entity = e.detail?.entity;
            if (!entity || ['DEPARTMENT', 'DESIGNATION', 'EMPLOYEE', 'SYSTEM'].includes(entity)) {
                fetchItems();
            }
        };
        window.addEventListener('onCrmSocketUpdate', handleRealtimeUpdate);
        return () => window.removeEventListener('onCrmSocketUpdate', handleRealtimeUpdate);
    }, [activeTab, selectedOverviewDeptId]);

    useEffect(() => {
        if (isCreatePage) {
            setEditId(null);
            setFormData({ name: '', description: '' });
            setShowModal(true);
        } else if (isEditPage && routeId) {
            setShowModal(true);
            const found = items.find(i => i._id === routeId);
            if (found) {
                setEditId(found._id);
                setFormData({
                    name: found.name,
                    description: found.description || ''
                });
            }
        }
    }, [isCreatePage, isEditPage, routeId, items]);

    const handleOpenModal = (item = null) => {
        if (item) {
            setEditId(item._id);
            setFormData({
                name: item.name,
                description: item.description || ''
            });
            setShowModal(true);
        } else {
            navigate('/payroll/masters/new');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.name.trim()) {
            toast.error('Name is required');
            return;
        }

        try {
            if (activeTab === 'departments') {
                if (editId) {
                    await payrollService.updateDepartment(editId, formData);
                    toast.success('Department updated successfully');
                } else {
                    await payrollService.createDepartment(formData);
                    toast.success('Department created successfully');
                }
            } else {
                if (editId) {
                    await payrollService.updateDesignation(editId, formData);
                    toast.success('Designation updated successfully');
                } else {
                    await payrollService.createDesignation(formData);
                    toast.success('Designation created successfully');
                }
            }
            setShowModal(false);
            fetchItems();
            navigate('/payroll/masters');
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to save configuration');
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this master record?')) return;
        try {
            if (activeTab === 'departments') {
                await payrollService.deleteDepartment(id);
            } else {
                await payrollService.deleteDesignation(id);
            }
            toast.success('Record deleted successfully');
            fetchItems();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to delete record');
        }
    };

    // Normalize department strings for flexible matching
    const normalizeDept = (deptStr) => {
        if (!deptStr) return '';
        return deptStr.toLowerCase().replace(/department/gi, '').trim();
    };

    // Get personnel assigned to a department
    const getDepartmentPersonnel = (deptName) => {
        const normTarget = normalizeDept(deptName);
        
        // 1. Employees matched
        const matchedEmps = employees.filter(e => normalizeDept(e.department) === normTarget);
        
        // 2. Salespersons matched
        const matchedSales = salespersons.filter(s => normalizeDept(s.department) === normTarget);

        const combinedMap = new Map();

        matchedEmps.forEach(emp => {
            combinedMap.set(emp.name?.toLowerCase().trim(), {
                id: emp._id,
                code: emp.employeeId || emp._id?.slice(-6)?.toUpperCase() || 'EMP',
                name: emp.name,
                department: emp.department || deptName,
                designation: emp.designation || 'Staff',
                manager: emp.reportingManager || 'Manager',
                type: 'Employee',
                source: 'employee',
                original: emp
            });
        });

        matchedSales.forEach(sp => {
            const key = sp.name?.toLowerCase().trim();
            if (!combinedMap.has(key)) {
                combinedMap.set(key, {
                    id: sp._id,
                    code: sp._id?.slice(-6)?.toUpperCase() || 'SP',
                    name: sp.name,
                    department: sp.department || deptName,
                    designation: 'Salesperson',
                    manager: 'Sales Head',
                    type: 'Salesperson',
                    source: 'salesperson',
                    original: sp
                });
            }
        });

        const list = Array.from(combinedMap.values());

        if (list.length === 0) {
            const samples = DEFAULT_SAMPLE_PERSONNEL[deptName] || DEFAULT_SAMPLE_PERSONNEL[normTarget] || [];
            return samples.map((name, idx) => ({
                id: `sample_${deptName}_${idx}`,
                code: `EMP00${idx + 1}`,
                name,
                department: deptName,
                designation: 'Executive',
                manager: 'Department Head',
                type: 'Staff',
                isSample: true
            }));
        }

        return list;
    };

    // --- DEPARTMENT MASTER FORM HANDLERS ---
    const handleSaveMasterDept = async () => {
        if (!masterForm.name.trim()) {
            toast.error('Department Name is required');
            return;
        }

        try {
            let deptName = masterForm.name.trim();
            const payload = {
                code: masterForm.code.trim() || undefined,
                name: deptName,
                head: masterForm.head.trim() || undefined,
                isActive: masterForm.status === 'Active',
                description: masterForm.description.trim() || undefined
            };

            if (editingMasterDeptId) {
                await payrollService.updateDepartment(editingMasterDeptId, payload);
                toast.success('Department updated successfully');
            } else {
                await payrollService.createDepartment(payload);
                toast.success('Department created successfully');
            }

            // Sync employee assignments
            const prevAssignedEmps = employees.filter(e => normalizeDept(e.department) === normalizeDept(deptName));
            
            // Unassign unchecked employees
            for (const emp of prevAssignedEmps) {
                if (!masterForm.assignedEmpIds.includes(emp._id)) {
                    await payrollService.updateEmployee(emp._id, { ...emp, department: '' });
                }
            }

            // Assign checked employees
            for (const empId of masterForm.assignedEmpIds) {
                const emp = employees.find(e => e._id === empId);
                if (emp && normalizeDept(emp.department) !== normalizeDept(deptName)) {
                    await payrollService.updateEmployee(empId, { ...emp, department: deptName });
                }
            }

            handleResetMasterForm();
            fetchItems();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to save department');
        }
    };

    const handleEditMasterDept = (dept) => {
        setEditingMasterDeptId(dept._id);
        const assigned = employees
            .filter(e => normalizeDept(e.department) === normalizeDept(dept.name))
            .map(e => e._id);

        setMasterForm({
            code: dept.code || dept._id?.slice(-6)?.toUpperCase() || 'DEP',
            name: dept.name,
            head: dept.head || '',
            status: dept.isActive === false ? 'Inactive' : 'Active',
            description: dept.description || '',
            assignedEmpIds: assigned
        });
    };

    const handleResetMasterForm = () => {
        setEditingMasterDeptId(null);
        setAssignEmpSearch('');
        setMasterForm({
            code: '',
            name: '',
            head: '',
            status: 'Active',
            description: '',
            assignedEmpIds: []
        });
    };

    const toggleEmpAssignment = (empId) => {
        setMasterForm(prev => {
            const exists = prev.assignedEmpIds.includes(empId);
            return {
                ...prev,
                assignedEmpIds: exists 
                    ? prev.assignedEmpIds.filter(id => id !== empId)
                    : [...prev.assignedEmpIds, empId]
            };
        });
    };

    const handleOpenAssignModal = (deptName) => {
        setAssignDeptName(deptName);
        setAssignPersonType('new');
        setNewPersonName('');
        setSelectedPersonId('');
        setShowAssignModal(true);
    };

    const handleSaveAssignment = async (e) => {
        e.preventDefault();
        setSavingAssign(true);
        try {
            if (assignPersonType === 'new') {
                if (!newPersonName.trim()) {
                    toast.error('Person name is required');
                    setSavingAssign(false);
                    return;
                }
                await payrollService.createEmployee({
                    name: newPersonName.trim(),
                    department: assignDeptName,
                    joiningDate: new Date().toISOString().split('T')[0],
                    status: 'Active'
                });
                toast.success(`Assigned ${newPersonName} to ${assignDeptName}`);
            } else {
                if (!selectedPersonId) {
                    toast.error('Please select a person');
                    setSavingAssign(false);
                    return;
                }
                const emp = employees.find(e => e._id === selectedPersonId);
                if (emp) {
                    await payrollService.updateEmployee(emp._id, { ...emp, department: assignDeptName });
                } else {
                    const sp = salespersons.find(s => s._id === selectedPersonId);
                    if (sp) {
                        await salespersonService.update(sp._id, { ...sp, department: assignDeptName });
                    }
                }
                toast.success(`Department updated to ${assignDeptName}`);
            }
            setShowAssignModal(false);
            fetchItems();
        } catch (err) {
            console.error('Assign person error:', err);
            toast.error(err.response?.data?.message || 'Failed to assign person');
        } finally {
            setSavingAssign(false);
        }
    };

    const handleUnassignPerson = async (person, deptName) => {
        if (person.isSample) {
            toast.info('Sample person entry preview. Add real personnel using the "+ Add Person" button.');
            return;
        }
        if (!window.confirm(`Remove ${person.name} from ${deptName}?`)) return;

        try {
            if (person.source === 'employee') {
                await payrollService.updateEmployee(person.id, { ...person.original, department: '' });
            } else if (person.source === 'salesperson') {
                await salespersonService.update(person.id, { ...person.original, department: '' });
            }
            toast.success(`Unassigned ${person.name}`);
            fetchItems();
        } catch (err) {
            toast.error('Failed to unassign person');
        }
    };

    // Filter items based on search
    const filteredItems = items.filter(item => {
        const query = searchQuery.trim().toLowerCase();
        if (!query) return true;

        const matchesName = item.name?.toLowerCase().includes(query);
        const matchesDesc = item.description?.toLowerCase().includes(query);
        const matchesPerson = activeTab === 'departments' && getDepartmentPersonnel(item.name).some(p => p.name?.toLowerCase().includes(query));

        return matchesName || matchesDesc || matchesPerson;
    });

    const calculateMaxRows = () => {
        if (filteredItems.length === 0) return 3;
        const rowCounts = filteredItems.map(dept => getDepartmentPersonnel(dept.name).length);
        return Math.max(3, ...rowCounts);
    };

    const moduleOptions = ['All', 'CRM Core', 'Reports', 'Dashboard', 'System', 'Payroll'];

    // Selected overview department object & personnel
    const activeOverviewDept = filteredItems.find(d => d._id === selectedOverviewDeptId) || filteredItems[0];
    const overviewPersonnel = activeOverviewDept ? getDepartmentPersonnel(activeOverviewDept.name) : [];

    return (
        <div className="space-y-6 max-w-7xl mx-auto animate-fade-in-up">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-slate-900 font-outfit uppercase">
                        Department Management
                    </h1>
                    <p className="text-slate-500 font-semibold text-sm">
                        Manage company departments, employee assignments, and organizational structure.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => handleOpenModal()}
                        className="flex items-center gap-2 px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white font-black uppercase text-[10px] tracking-widest rounded-2xl transition-all shadow-lg shadow-primary-600/20 active:scale-95"
                    >
                        <IconAdd size={18} />
                        Add New {activeTab === 'departments' ? 'Department' : 'Designation'}
                    </button>
                </div>
            </div>

            {/* Tab Controls */}
            <div className="flex border-b border-slate-200 gap-2 overflow-x-auto pb-1">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-6 py-4 border-b-2 font-bold text-sm transition-all whitespace-nowrap ${
                            activeTab === tab.id
                                ? 'border-primary-600 text-primary-600 font-black'
                                : 'border-transparent text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        {tab.icon}
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Department Sub-Navigation (Matching depart2 HTML layout format) */}
            {activeTab === 'departments' && (
                <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200/80 w-fit">
                    <button
                        onClick={() => setDeptSubTab('overview')}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs transition-all ${
                            deptSubTab === 'overview'
                                ? 'bg-primary-600 text-white shadow-md font-black'
                                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                        }`}
                    >
                        <IconGridOn size={16} />
                        Department Overview
                    </button>
                    <button
                        onClick={() => setDeptSubTab('master')}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs transition-all ${
                            deptSubTab === 'master'
                                ? 'bg-primary-600 text-white shadow-md font-black'
                                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                        }`}
                    >
                        <MdBusiness size={16} />
                        Department Master
                    </button>
                    <button
                        onClick={() => setDeptSubTab('column')}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs transition-all ${
                            deptSubTab === 'column'
                                ? 'bg-primary-600 text-white shadow-md font-black'
                                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                        }`}
                    >
                        <IconViewColumn size={16} />
                        Column-Wise Structure
                    </button>
                    <button
                        onClick={() => setDeptSubTab('list')}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs transition-all ${
                            deptSubTab === 'list'
                                ? 'bg-primary-600 text-white shadow-md font-black'
                                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                        }`}
                    >
                        <IconList size={16} />
                        List View
                    </button>
                </div>
            )}

            {/* Filters Section */}
            <div className="bg-white p-5 rounded-[2rem] shadow-sm border border-slate-100 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
                <div className="flex items-center gap-2 text-slate-800 font-black text-xs uppercase tracking-wider shrink-0">
                    <IconFilterList size={18} className="text-primary-600" />
                    <span>FILTERS</span>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 flex-1 max-w-3xl">
                    <div className="min-w-[200px]">
                        <SearchableSelect
                            label="MODULE"
                            options={moduleOptions}
                            value={selectedModule}
                            onChange={(mod) => setSelectedModule(mod)}
                            placeholder="Type module name..."
                        />
                    </div>

                    <div className="flex-1 min-w-[220px]">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                            SEARCH
                        </label>
                        <div className="relative">
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search department or personnel..."
                                className="w-full pl-9 pr-8 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all"
                            />
                            <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery('')}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                                >
                                    ✕
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            {loading && items.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 space-y-3 glass rounded-[2rem] bg-white border border-slate-100">
                    <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin"></div>
                    <p className="text-slate-400 font-bold uppercase text-xs tracking-widest">Loading Department Data...</p>
                </div>
            ) : activeTab === 'departments' && deptSubTab === 'overview' ? (
                /* TAB 1: DEPARTMENT OVERVIEW (Side-by-side Layout from depart2.html) */
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* Left Column: Department Cards */}
                    <div className="lg:col-span-4 space-y-4">
                        <div className="flex items-center justify-between px-1">
                            <h2 className="text-sm font-black text-slate-700 uppercase tracking-wider">Departments</h2>
                            <span className="text-xs font-bold bg-primary-50 text-primary-700 px-3 py-1 rounded-full border border-primary-200">
                                {filteredItems.length} Departments
                            </span>
                        </div>

                        <div className="space-y-3">
                            {filteredItems.map(dept => {
                                const personnelCount = getDepartmentPersonnel(dept.name).length;
                                const isSelected = activeOverviewDept?._id === dept._id;

                                return (
                                    <div
                                        key={dept._id}
                                        onClick={() => setSelectedOverviewDeptId(dept._id)}
                                        className={`p-4 rounded-2xl border transition-all cursor-pointer shadow-sm ${
                                            isSelected
                                                ? 'bg-primary-50/80 border-primary-500 shadow-md ring-2 ring-primary-500/20'
                                                : 'bg-white border-slate-200 hover:border-slate-300 hover:-translate-y-0.5'
                                        }`}
                                    >
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <h3 className="text-base font-black text-slate-900 font-outfit uppercase">
                                                    {dept.name}
                                                </h3>
                                                <p className="text-xs font-semibold text-slate-500 mt-1">
                                                    Head: <span className="text-slate-800 font-bold">{dept.head || 'Rohit Dixit'}</span>
                                                </p>
                                            </div>
                                            <span className="bg-primary-600 text-white font-black text-xs px-3 py-1 rounded-full shadow-sm">
                                                {personnelCount} Employees
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Right Column: Employees in Selected Department */}
                    <div className="lg:col-span-8">
                        <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden h-full">
                            <div className="bg-primary-600 text-white px-6 py-4 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <IconPeople size={20} />
                                    <h3 className="text-base font-black uppercase font-outfit">
                                        Employees in {activeOverviewDept?.name || 'Department'}
                                    </h3>
                                </div>
                                <span className="bg-white text-primary-700 font-black text-xs px-3 py-1 rounded-full shadow">
                                    {overviewPersonnel.length} Employees
                                </span>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100">
                                            <th className="px-6 py-3.5">Employee ID</th>
                                            <th className="px-6 py-3.5">Name</th>
                                            <th className="px-6 py-3.5">Department</th>
                                            <th className="px-6 py-3.5">Designation</th>
                                            <th className="px-6 py-3.5">Reporting Manager</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 text-sm font-semibold text-slate-700">
                                        {overviewPersonnel.length === 0 ? (
                                            <tr>
                                                <td colSpan="5" className="px-6 py-12 text-center text-slate-400 font-medium">
                                                    No employees currently assigned to this department.
                                                </td>
                                            </tr>
                                        ) : (
                                            overviewPersonnel.map((emp) => (
                                                <tr key={emp.id} className="hover:bg-slate-50/60 transition-colors">
                                                    <td className="px-6 py-4 font-mono font-bold text-primary-700">{emp.code}</td>
                                                    <td className="px-6 py-4 font-bold text-slate-900">{emp.name}</td>
                                                    <td className="px-6 py-4">
                                                        <span className="bg-primary-50 text-primary-700 text-xs font-bold px-2.5 py-1 rounded-lg border border-primary-100">
                                                            {emp.department}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-slate-600">{emp.designation}</td>
                                                    <td className="px-6 py-4 text-slate-500">{emp.manager}</td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            ) : activeTab === 'departments' && deptSubTab === 'master' ? (
                /* TAB 2: DEPARTMENT MASTER (Form + Department List from depart2.html) */
                <div className="space-y-6">
                    {/* Add / Edit Department Card Form */}
                    <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
                        <div className="bg-emerald-600 text-white px-6 py-4 flex items-center justify-between">
                            <h3 className="text-base font-black uppercase font-outfit flex items-center gap-2">
                                <IconAdd size={20} />
                                {editingMasterDeptId ? 'Edit Department' : 'Department Master'}
                            </h3>
                        </div>

                        <div className="p-6 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Department Code</label>
                                    <input
                                        type="text"
                                        value={masterForm.code}
                                        onChange={(e) => setMasterForm({ ...masterForm, code: e.target.value })}
                                        placeholder="e.g. DEP005"
                                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Department Name *</label>
                                    <input
                                        type="text"
                                        value={masterForm.name}
                                        onChange={(e) => setMasterForm({ ...masterForm, name: e.target.value })}
                                        placeholder="e.g. Human Resource"
                                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Department Head</label>
                                    <select
                                        value={masterForm.head}
                                        onChange={(e) => setMasterForm({ ...masterForm, head: e.target.value })}
                                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                                    >
                                        <option value="">Select Head...</option>
                                        {employees.map(emp => (
                                            <option key={emp._id} value={emp.name}>{emp.name} ({emp.designation || 'Staff'})</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Status</label>
                                    <select
                                        value={masterForm.status}
                                        onChange={(e) => setMasterForm({ ...masterForm, status: e.target.value })}
                                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                                    >
                                        <option value="Active">Active</option>
                                        <option value="Inactive">Inactive</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1.5">Description</label>
                                <textarea
                                    value={masterForm.description}
                                    onChange={(e) => setMasterForm({ ...masterForm, description: e.target.value })}
                                    placeholder="Brief description of department scope and responsibilities..."
                                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white h-20"
                                />
                            </div>

                            {/* Assign Employees Checkbox Box */}
                            <div>
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                                    <label className="block text-xs font-bold text-slate-700">
                                        Assign Employees to Department
                                        {masterForm.assignedEmpIds.length > 0 && (
                                            <span className="ml-2 text-[10px] font-black text-emerald-700 bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded-full">
                                                {masterForm.assignedEmpIds.length} Selected
                                            </span>
                                        )}
                                    </label>

                                    {/* Search Bar for Assigning Employees */}
                                    <div className="relative w-full sm:w-64">
                                        <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                        <input
                                            type="text"
                                            value={assignEmpSearch}
                                            onChange={(e) => setAssignEmpSearch(e.target.value)}
                                            placeholder="Search employee, designation..."
                                            className="w-full pl-8 pr-7 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all shadow-sm"
                                        />
                                        {assignEmpSearch && (
                                            <button
                                                type="button"
                                                onClick={() => setAssignEmpSearch('')}
                                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                            >
                                                <IconClose size={13} />
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-xl p-3 bg-slate-50 space-y-1.5 custom-scrollbar">
                                    {employees.length === 0 ? (
                                        <p className="text-xs text-slate-400 font-medium">No employees found. Add employees in Payroll &gt; Employees tab.</p>
                                    ) : (
                                        (() => {
                                            const filtered = employees.filter(emp => {
                                                if (!assignEmpSearch.trim()) return true;
                                                const q = assignEmpSearch.trim().toLowerCase();
                                                const name = (emp.name || '').toLowerCase();
                                                const desig = (emp.designation || '').toLowerCase();
                                                const dept = (emp.department || '').toLowerCase();
                                                const code = (emp.employeeId || emp.code || '').toLowerCase();
                                                return name.includes(q) || desig.includes(q) || dept.includes(q) || code.includes(q);
                                            });

                                            if (filtered.length === 0) {
                                                return (
                                                    <p className="text-xs text-slate-400 font-medium text-center py-3">
                                                        No employees match "{assignEmpSearch}"
                                                    </p>
                                                );
                                            }

                                            return (
                                                <>
                                                    {assignEmpSearch.trim() && (
                                                        <div className="flex items-center justify-between pb-1 mb-1 border-b border-slate-200/60 text-[11px] font-bold text-slate-500">
                                                            <span>Showing {filtered.length} of {employees.length} employees</span>
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    const visibleIds = filtered.map(e => e._id);
                                                                    const allSelected = visibleIds.every(id => masterForm.assignedEmpIds.includes(id));
                                                                    setMasterForm(prev => ({
                                                                        ...prev,
                                                                        assignedEmpIds: allSelected
                                                                            ? prev.assignedEmpIds.filter(id => !visibleIds.includes(id))
                                                                            : Array.from(new Set([...prev.assignedEmpIds, ...visibleIds]))
                                                                    }));
                                                                }}
                                                                className="text-emerald-700 hover:text-emerald-800 hover:underline font-black"
                                                            >
                                                                {filtered.every(e => masterForm.assignedEmpIds.includes(e._id)) ? 'Deselect Matches' : 'Select Matches'}
                                                            </button>
                                                        </div>
                                                    )}
                                                    {filtered.map(emp => (
                                                        <label key={emp._id} className="flex items-center gap-2 text-xs font-semibold text-slate-800 cursor-pointer hover:bg-slate-100 p-1.5 rounded-lg transition-colors">
                                                            <input
                                                                type="checkbox"
                                                                checked={masterForm.assignedEmpIds.includes(emp._id)}
                                                                onChange={() => toggleEmpAssignment(emp._id)}
                                                                className="rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                                                            />
                                                            <span>{emp.name} ({emp.designation || 'Staff'})</span>
                                                            {emp.department && (
                                                                <span className="text-[10px] text-slate-400 bg-slate-200 px-2 py-0.5 rounded-full ml-auto">
                                                                    {emp.department}
                                                                </span>
                                                            )}
                                                        </label>
                                                    ))}
                                                </>
                                            );
                                        })()
                                    )}
                                </div>
                            </div>

                            {/* Form Action Buttons */}
                            <div className="flex items-center gap-3 pt-2">
                                {!editingMasterDeptId ? (
                                    <button
                                        onClick={handleSaveMasterDept}
                                        className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow transition-all"
                                    >
                                        <MdCheck size={16} /> Save
                                    </button>
                                ) : (
                                    <>
                                        <button
                                            onClick={handleSaveMasterDept}
                                            className="flex items-center gap-2 px-6 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow transition-all"
                                        >
                                            <IconEdit size={16} /> Update
                                        </button>
                                        <button
                                            onClick={() => handleDelete(editingMasterDeptId)}
                                            className="flex items-center gap-2 px-6 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow transition-all"
                                        >
                                            <IconDelete size={16} /> Delete
                                        </button>
                                    </>
                                )}
                                <button
                                    onClick={handleResetMasterForm}
                                    className="flex items-center gap-2 px-6 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs uppercase tracking-wider rounded-xl transition-all"
                                >
                                    <MdRefresh size={16} /> Reset
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Department List Table */}
                    <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
                        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
                            <h3 className="text-base font-black uppercase font-outfit flex items-center gap-2">
                                <IconList size={20} /> Department List
                            </h3>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100">
                                        <th className="px-6 py-4">ID</th>
                                        <th className="px-6 py-4">Department</th>
                                        <th className="px-6 py-4">Head</th>
                                        <th className="px-6 py-4 text-center">Employees</th>
                                        <th className="px-6 py-4 text-center">Status</th>
                                        <th className="px-6 py-4 text-center">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-sm font-semibold text-slate-700">
                                    {filteredItems.map((dept, index) => {
                                        const count = getDepartmentPersonnel(dept.name).length;
                                        const deptCode = dept.code || `DEP00${index + 1}`;

                                        return (
                                            <tr key={dept._id} className="hover:bg-slate-50/60 transition-colors">
                                                <td className="px-6 py-4 font-mono font-bold text-slate-500">{deptCode}</td>
                                                <td className="px-6 py-4 font-bold text-slate-900">{dept.name}</td>
                                                <td className="px-6 py-4 text-slate-600">{dept.head || 'Rohit Dixit'}</td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className="bg-slate-100 text-slate-800 text-xs font-bold px-3 py-1 rounded-full border border-slate-200">
                                                        {count} Employees
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                                                        dept.isActive !== false 
                                                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                                                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                                                    }`}>
                                                        {dept.isActive !== false ? 'Active' : 'Inactive'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <div className="flex items-center justify-center gap-2">
                                                        <button
                                                            onClick={() => handleEditMasterDept(dept)}
                                                            className="px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm"
                                                        >
                                                            Edit
                                                        </button>
                                                        <button
                                                            onClick={() => handleDelete(dept._id)}
                                                            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm"
                                                        >
                                                            Delete
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            ) : activeTab === 'departments' && deptSubTab === 'column' ? (
                /* COLUMN-WISE STRUCTURE VIEW */
                <div className="glass shadow-premium rounded-[2rem] p-6 bg-white border border-slate-100">
                    <div className="space-y-4">
                        <div className="flex items-center justify-between px-2">
                            <h2 className="text-xl font-black tracking-tight text-slate-900 font-outfit uppercase">
                                Department Structure
                            </h2>
                            <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full border border-slate-200">
                                {filteredItems.length} Department Column{filteredItems.length > 1 ? 's' : ''}
                            </span>
                        </div>

                        <div className="overflow-x-auto rounded-2xl border border-slate-200/80 bg-white shadow-sm">
                            <table className="w-full text-left border-collapse min-w-[700px]">
                                <thead>
                                    <tr className="bg-slate-50/90 border-b border-slate-200">
                                        {filteredItems.map((dept) => {
                                            const personnelList = getDepartmentPersonnel(dept.name);
                                            return (
                                                <th 
                                                    key={dept._id} 
                                                    className="px-6 py-5 border-r border-slate-200/80 last:border-r-0 align-top w-1/3 min-w-[220px]"
                                                >
                                                    <div className="flex flex-col gap-3">
                                                        <div className="flex items-start justify-between">
                                                            <div>
                                                                <h3 className="text-base font-black text-slate-900 tracking-wide font-outfit uppercase">
                                                                    {dept.name}
                                                                </h3>
                                                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200/80 rounded-full px-2.5 py-0.5 mt-1">
                                                                    <IconPeople size={13} />
                                                                    {personnelList.length} person{personnelList.length !== 1 ? 's' : ''}
                                                                </span>
                                                            </div>
                                                        </div>

                                                        <button
                                                            onClick={() => handleOpenAssignModal(dept.name)}
                                                            className="flex items-center justify-center gap-1.5 w-full py-2 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95"
                                                        >
                                                            <IconPersonAdd size={15} />
                                                            + Add Person
                                                        </button>
                                                    </div>
                                                </th>
                                            );
                                        })}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-sm font-semibold">
                                    {Array.from({ length: calculateMaxRows() }).map((_, rowIndex) => (
                                        <tr key={rowIndex} className="hover:bg-slate-50/70 transition-colors">
                                            {filteredItems.map((dept) => {
                                                const personnel = getDepartmentPersonnel(dept.name);
                                                const person = personnel[rowIndex];
                                                return (
                                                    <td 
                                                        key={dept._id} 
                                                        className="px-6 py-4 border-r border-slate-100 last:border-r-0 bg-white"
                                                    >
                                                        {person ? (
                                                            <div className="flex items-center justify-between group py-1">
                                                                <div className="flex items-center gap-2.5 min-w-0">
                                                                    <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center justify-center shrink-0 border border-emerald-200/60">
                                                                        {person.name ? person.name.charAt(0).toUpperCase() : 'P'}
                                                                    </div>
                                                                    <span className="font-bold text-slate-900 text-sm truncate">
                                                                        {person.name}
                                                                    </span>
                                                                </div>
                                                                {!person.isSample && (
                                                                    <button
                                                                        onClick={() => handleUnassignPerson(person, dept.name)}
                                                                        className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                                                                        title="Remove from Department"
                                                                    >
                                                                        <IconClose size={15} />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <span className="text-slate-300 font-medium text-sm opacity-50 block py-1">-</span>
                                                        )}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            ) : (
                /* LIST VIEW LIGHT MODE FORMAT / DESIGNATIONS */
                <div className="glass shadow-premium rounded-[2rem] p-6 bg-white border border-slate-100">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100">
                                    <th className="px-6 py-4">Name</th>
                                    <th className="px-6 py-4">Description</th>
                                    <th className="px-6 py-4 text-center">Assigned Personnel</th>
                                    <th className="px-6 py-4 text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-sm font-semibold text-slate-700">
                                {filteredItems.map((item) => {
                                    const personnelCount = activeTab === 'departments' 
                                        ? getDepartmentPersonnel(item.name).length 
                                        : employees.filter(emp => emp.designation === item.name).length;

                                    return (
                                        <tr key={item._id} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="px-6 py-4 font-black text-slate-900">{item.name}</td>
                                            <td className="px-6 py-4 text-slate-500 max-w-sm truncate">{item.description || '-'}</td>
                                            <td className="px-6 py-4 text-center">
                                                <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                                                    personnelCount > 0 
                                                        ? 'bg-teal-50 text-teal-800 border border-teal-100'
                                                        : 'bg-slate-100 text-slate-400'
                                                }`}>
                                                    <IconPeople size={14} />
                                                    {personnelCount} assigned
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center justify-center gap-3">
                                                    <button
                                                        onClick={() => handleOpenModal(item)}
                                                        className="p-2 rounded-xl text-slate-400 hover:text-primary-600 hover:bg-slate-50 transition-all"
                                                        title="Edit Details"
                                                    >
                                                        <IconEdit size={18} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(item._id)}
                                                        className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50/50 transition-all"
                                                        title="Delete Master Item"
                                                    >
                                                        <IconDelete size={18} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Department / Designation Form Page View */}
            {(showModal || isCreatePage || isEditPage) && (
                <div className="fixed inset-0 z-[100] bg-slate-50 overflow-y-auto p-6 md:p-10 flex flex-col items-center">
                    <div className="max-w-3xl w-full my-2 space-y-6">
                        {/* Header bar */}
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                            <div className="flex items-center gap-4">
                                <button
                                    type="button"
                                    onClick={() => { setShowModal(false); navigate('/payroll/masters'); }}
                                    className="p-3 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-2xl transition-all border border-slate-200"
                                >
                                    <MdArrowBack size={20} />
                                </button>
                                <div>
                                    <h1 className="text-xl font-black text-slate-900">
                                        {editId ? 'EDIT MASTER RECORD' : 'CREATE MASTER RECORD'}
                                    </h1>
                                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                                        {editId ? `Update parameters for ${formData.name}` : `Add a new ${activeTab === 'departments' ? 'department' : 'designation'} entry`}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    type="button"
                                    onClick={() => { setShowModal(false); navigate('/payroll/masters'); }}
                                    className="px-6 py-3 rounded-2xl border border-slate-200 text-slate-600 font-black uppercase text-xs tracking-widest hover:bg-slate-50 transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    form="master-record-form"
                                    className="bg-primary-600 hover:bg-primary-700 text-white px-8 py-3 rounded-2xl font-black transition-all shadow-xl shadow-primary-600/20 uppercase text-xs tracking-widest active:scale-95"
                                >
                                    Save Record
                                </button>
                            </div>
                        </div>

                        {/* Form Card Body */}
                        <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
                            <form id="master-record-form" onSubmit={handleSubmit} className="space-y-6">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                                        {activeTab === 'departments' ? 'Department Name' : 'Designation Name'} *
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full px-4 py-3.5 rounded-2xl border border-slate-200 bg-slate-50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white text-sm font-semibold"
                                        placeholder={activeTab === 'departments' ? 'e.g. Sales Department' : 'e.g. Sales Executive'}
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Description</label>
                                    <textarea
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                        className="w-full px-4 py-3.5 rounded-2xl border border-slate-200 bg-slate-50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white text-sm font-semibold h-32"
                                        placeholder="Optional description of roles and responsibilities"
                                    />
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Assign Person Modal */}
            <Modal
                isOpen={showAssignModal}
                onClose={() => setShowAssignModal(false)}
                title={`ASSIGN PERSON TO ${assignDeptName.toUpperCase()}`}
                maxWidth="max-w-md"
                footer={
                    <>
                        <button
                            type="button"
                            onClick={() => setShowAssignModal(false)}
                            className="w-full md:w-auto px-6 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            form="assign-person-form"
                            disabled={savingAssign}
                            className="w-full md:w-auto px-6 py-3.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-primary-600/20 disabled:opacity-50"
                        >
                            {savingAssign ? 'Saving...' : 'Assign Person'}
                        </button>
                    </>
                }
            >
                <form id="assign-person-form" onSubmit={handleSaveAssignment} className="space-y-4">
                    <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
                            Assignment Type
                        </label>
                        <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl border border-slate-200">
                            <button
                                type="button"
                                onClick={() => setAssignPersonType('new')}
                                className={`py-2 px-3 rounded-lg text-xs font-bold transition-all ${
                                    assignPersonType === 'new'
                                        ? 'bg-primary-600 text-white shadow'
                                        : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                + Add New Person
                            </button>
                            <button
                                type="button"
                                onClick={() => setAssignPersonType('existing')}
                                className={`py-2 px-3 rounded-lg text-xs font-bold transition-all ${
                                    assignPersonType === 'existing'
                                        ? 'bg-primary-600 text-white shadow'
                                        : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                Select Existing
                            </button>
                        </div>
                    </div>

                    {assignPersonType === 'new' ? (
                        <div>
                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                                Person Name *
                            </label>
                            <input
                                type="text"
                                required
                                value={newPersonName}
                                onChange={(e) => setNewPersonName(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white text-sm font-semibold"
                                placeholder="e.g. Rahul, Priya, Om"
                            />
                        </div>
                    ) : (
                        <div>
                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                                Select Personnel *
                            </label>
                            <select
                                required
                                value={selectedPersonId}
                                onChange={(e) => setSelectedPersonId(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white text-sm font-semibold"
                            >
                                <option value="">-- Choose Employee / Salesperson --</option>
                                <optgroup label="Employees">
                                    {employees.map(emp => (
                                        <option key={emp._id} value={emp._id}>
                                            {emp.name} ({emp.department || 'Unassigned'})
                                        </option>
                                    ))}
                                </optgroup>
                                <optgroup label="Salespersons">
                                    {salespersons.map(sp => (
                                        <option key={sp._id} value={sp._id}>
                                            {sp.name} ({sp.department || 'Unassigned'})
                                        </option>
                                    ))}
                                </optgroup>
                            </select>
                        </div>
                    )}
                </form>
            </Modal>
        </div>
    );
};

export default PayrollMasters;
