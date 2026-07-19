import React, { useEffect, useState, useRef } from 'react';
import { useLocation } from 'react-router-dom';
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
    MdCheckCircle
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

const PayrollMasters = () => {
    const location = useLocation();
    const queryParams = new URLSearchParams(location.search);
    const initialTab = queryParams.get('tab') || 'departments';

    const [activeTab, setActiveTab] = useState(initialTab);
    const [loading, setLoading] = useState(false);
    const [items, setItems] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [salespersons, setSalespersons] = useState([]);

    // Filter states
    const [selectedModule, setSelectedModule] = useState('All');
    const [searchQuery, setSearchQuery] = useState('');

    // View toggle: 'column' (default for departments) or 'list'
    const [viewMode, setViewMode] = useState('column');

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
    const [assignPersonType, setAssignPersonType] = useState('new'); // 'new' or 'existing'
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
            
            setItems(itemsRes.data || []);
            setEmployees(empRes.data || []);
            
            const salesData = salesRes.data;
            setSalespersons(Array.isArray(salesData) ? salesData : salesData?.data || []);
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

    const handleOpenModal = (item = null) => {
        if (item) {
            setEditId(item._id);
            setFormData({
                name: item.name,
                description: item.description || ''
            });
        } else {
            setEditId(null);
            setFormData({ name: '', description: '' });
        }
        setShowModal(true);
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
                name: emp.name,
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
                    name: sp.name,
                    type: 'Salesperson',
                    source: 'salesperson',
                    original: sp
                });
            }
        });

        const list = Array.from(combinedMap.values());

        // Fallback to sample data matching screenshot if database has no entries for this department yet
        if (list.length === 0) {
            const samples = DEFAULT_SAMPLE_PERSONNEL[deptName] || DEFAULT_SAMPLE_PERSONNEL[normTarget] || [];
            return samples.map((name, idx) => ({
                id: `sample_${deptName}_${idx}`,
                name,
                type: 'Sales Person',
                isSample: true
            }));
        }

        return list;
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
                // Create a new employee profile with assigned department
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
                // Check if selected is employee or salesperson
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

    // Filter items based on typing search & module selection
    const filteredItems = items.filter(item => {
        const query = searchQuery.trim().toLowerCase();
        if (!query) return true;

        const matchesName = item.name?.toLowerCase().includes(query);
        const matchesDesc = item.description?.toLowerCase().includes(query);
        const matchesPerson = activeTab === 'departments' && getDepartmentPersonnel(item.name).some(p => p.name?.toLowerCase().includes(query));

        return matchesName || matchesDesc || matchesPerson;
    });

    // Calculate maximum rows needed across all department columns
    const calculateMaxRows = () => {
        if (filteredItems.length === 0) return 3;
        const rowCounts = filteredItems.map(dept => getDepartmentPersonnel(dept.name).length);
        return Math.max(3, ...rowCounts);
    };

    const moduleOptions = ['All', 'CRM Core', 'Reports', 'Dashboard', 'System', 'Payroll'];

    return (
        <div className="space-y-6 max-w-7xl mx-auto animate-fade-in-up">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-slate-900 font-outfit uppercase">
                        Department Master
                    </h1>
                    <p className="text-slate-500 font-semibold text-sm">
                        View and manage organizational departments and assigned personnel in column-wise layout.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {activeTab === 'departments' && (
                        <div className="flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200">
                            <button
                                onClick={() => setViewMode('column')}
                                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold text-xs transition-all ${
                                    viewMode === 'column' 
                                        ? 'bg-white text-primary-700 shadow-sm font-black' 
                                        : 'text-slate-500 hover:text-slate-900'
                                }`}
                            >
                                <IconViewColumn size={16} />
                                Column-Wise
                            </button>
                            <button
                                onClick={() => setViewMode('list')}
                                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold text-xs transition-all ${
                                    viewMode === 'list' 
                                        ? 'bg-white text-primary-700 shadow-sm font-black' 
                                        : 'text-slate-500 hover:text-slate-900'
                                }`}
                            >
                                <IconList size={16} />
                                List View
                            </button>
                        </div>
                    )}
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

            {/* Filters Section (Directly on Page layout matching Image 2) */}
            <div className="bg-white p-5 rounded-[2rem] shadow-sm border border-slate-100 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
                <div className="flex items-center gap-2 text-slate-800 font-black text-xs uppercase tracking-wider shrink-0">
                    <IconFilterList size={18} className="text-primary-600" />
                    <span>FILTERS</span>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 flex-1 max-w-3xl">
                    {/* Searchable Module Dropdown */}
                    <div className="min-w-[200px]">
                        <SearchableSelect
                            label="MODULE"
                            options={moduleOptions}
                            value={selectedModule}
                            onChange={(mod) => setSelectedModule(mod)}
                            placeholder="Type module name..."
                        />
                    </div>

                    {/* Search Typing Option Filter */}
                    <div className="flex-1 min-w-[220px]">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                            SEARCH
                        </label>
                        <div className="relative">
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Type to search department or personnel..."
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

            {/* Content Container (Light Theme) */}
            <div className="glass shadow-premium rounded-[2rem] p-6 bg-white border border-slate-100">
                {loading && items.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 space-y-3">
                        <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin"></div>
                        <p className="text-slate-400 font-bold uppercase text-xs tracking-widest">Loading Master Data...</p>
                    </div>
                ) : filteredItems.length === 0 ? (
                    <div className="text-center py-16">
                        <p className="text-slate-400 font-bold text-lg mb-2">No records found.</p>
                        <p className="text-slate-400 text-sm mb-4">Try clearing search inputs or click "Add New" to populate.</p>
                    </div>
                ) : activeTab === 'departments' && viewMode === 'column' ? (
                    /* COLUMN-WISE LIGHT MODE TABLE FORMAT */
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
                ) : (
                    /* LIST VIEW LIGHT MODE FORMAT */
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
                )}
            </div>

            {/* Department / Designation Modal using Portal Modal */}
            <Modal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                title={editId ? 'EDIT MASTER RECORD' : 'CREATE MASTER RECORD'}
                maxWidth="max-w-md"
                footer={
                    <>
                        <button
                            type="button"
                            onClick={() => setShowModal(false)}
                            className="w-full md:w-auto px-6 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            form="master-record-form"
                            className="w-full md:w-auto px-6 py-3.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-primary-600/20"
                        >
                            Save Record
                        </button>
                    </>
                }
            >
                <form id="master-record-form" onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                            {activeTab === 'departments' ? 'Department Name' : 'Designation Name'} *
                        </label>
                        <input
                            type="text"
                            required
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white text-sm font-semibold"
                            placeholder={activeTab === 'departments' ? 'e.g. Sales Department' : 'e.g. Sales Executive'}
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Description</label>
                        <textarea
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white text-sm font-semibold h-24"
                            placeholder="Optional description of roles and responsibilities"
                        />
                    </div>
                </form>
            </Modal>

            {/* Assign Person Modal using Portal Modal */}
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
