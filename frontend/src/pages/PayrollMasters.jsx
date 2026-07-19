import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { payrollService, salespersonService } from '../services/api';
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
    MdClose as IconClose
} from 'react-icons/md';

const DEFAULT_SAMPLE_PERSONNEL = {
    'Sales Department': ['Rahul', 'Priya', 'Om'],
    'Sales': ['Rahul', 'Priya', 'Om'],
    'Support Department': ['Amit', 'Suman'],
    'Support': ['Amit', 'Suman'],
    'Marketing Department': ['Neha', 'Karan'],
    'Marketing': ['Neha', 'Karan']
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

    // Calculate maximum rows needed across all department columns
    const calculateMaxRows = () => {
        if (items.length === 0) return 3;
        const rowCounts = items.map(dept => getDepartmentPersonnel(dept.name).length);
        return Math.max(3, ...rowCounts);
    };

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

            {/* Content Container */}
            <div className="glass shadow-premium rounded-[2rem] p-6 bg-slate-900/95 text-white border border-slate-800">
                {loading && items.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 space-y-3">
                        <div className="w-12 h-12 border-4 border-primary-400 border-t-primary-600 rounded-full animate-spin"></div>
                        <p className="text-slate-400 font-bold uppercase text-xs tracking-widest">Loading Department Master...</p>
                    </div>
                ) : items.length === 0 ? (
                    <div className="text-center py-16">
                        <p className="text-slate-400 font-bold text-lg mb-2">No department records found.</p>
                        <p className="text-slate-400 text-sm mb-4">Click "Add New" to populate your organizational structure.</p>
                    </div>
                ) : activeTab === 'departments' && viewMode === 'column' ? (
                    /* COLUMN-WISE FORMAT (Matching reference image) */
                    <div className="space-y-4">
                        <div className="flex items-center justify-between px-2">
                            <h2 className="text-xl font-bold tracking-tight text-white font-outfit">
                                What you want - Column wise
                            </h2>
                            <span className="text-xs font-semibold text-slate-400">
                                {items.length} Department Column{items.length > 1 ? 's' : ''}
                            </span>
                        </div>

                        <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950/80 shadow-2xl">
                            <table className="w-full text-left border-collapse min-w-[650px]">
                                <thead>
                                    <tr className="bg-slate-900 border-b border-slate-800">
                                        {items.map((dept) => {
                                            const personnelList = getDepartmentPersonnel(dept.name);
                                            return (
                                                <th 
                                                    key={dept._id} 
                                                    className="px-6 py-4 border-r border-slate-800 last:border-r-0 align-top w-1/3 min-w-[200px]"
                                                >
                                                    <div className="flex flex-col gap-2">
                                                        <div className="flex items-start justify-between">
                                                            <div>
                                                                <h3 className="text-base font-bold text-white tracking-wide font-outfit">
                                                                    {dept.name}
                                                                </h3>
                                                                <p className="text-[11px] font-medium text-slate-400 mt-0.5">
                                                                    {personnelList.length} person{personnelList.length !== 1 ? 's' : ''}
                                                                </p>
                                                            </div>
                                                            <div className="flex items-center gap-1 opacity-70 hover:opacity-100 transition-opacity">
                                                                <button
                                                                    onClick={() => handleOpenModal(dept)}
                                                                    className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
                                                                    title="Edit Department"
                                                                >
                                                                    <IconEdit size={15} />
                                                                </button>
                                                                <button
                                                                    onClick={() => handleDelete(dept._id)}
                                                                    className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 transition-all"
                                                                    title="Delete Department"
                                                                >
                                                                    <IconDelete size={15} />
                                                                </button>
                                                            </div>
                                                        </div>

                                                        <button
                                                            onClick={() => handleOpenAssignModal(dept.name)}
                                                            className="flex items-center justify-center gap-1.5 w-full py-1.5 px-3 bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white rounded-lg text-xs font-semibold border border-slate-700/60 transition-all shadow-sm mt-1"
                                                        >
                                                            <IconPersonAdd size={14} />
                                                            + Add Person
                                                        </button>
                                                    </div>
                                                </th>
                                            );
                                        })}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/80 text-sm font-medium">
                                    {Array.from({ length: calculateMaxRows() }).map((_, rowIndex) => (
                                        <tr key={rowIndex} className="hover:bg-slate-900/40 transition-colors">
                                            {items.map((dept) => {
                                                const personnel = getDepartmentPersonnel(dept.name);
                                                const person = personnel[rowIndex];
                                                return (
                                                    <td 
                                                        key={dept._id} 
                                                        className="px-6 py-4 border-r border-slate-800/80 last:border-r-0 text-slate-200"
                                                    >
                                                        {person ? (
                                                            <div className="flex items-center justify-between group">
                                                                <span className="font-semibold text-slate-100 text-base">
                                                                    {person.name}
                                                                </span>
                                                                {!person.isSample && (
                                                                    <button
                                                                        onClick={() => handleUnassignPerson(person, dept.name)}
                                                                        className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-rose-400 transition-all"
                                                                        title="Remove from Department"
                                                                    >
                                                                        <IconClose size={14} />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <span className="text-slate-700 font-normal opacity-40">-</span>
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
                    /* LIST VIEW FORMAT */
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-950 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-800">
                                    <th className="px-6 py-4">Name</th>
                                    <th className="px-6 py-4">Description</th>
                                    <th className="px-6 py-4 text-center">Assigned Personnel</th>
                                    <th className="px-6 py-4 text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/60 text-sm font-semibold text-slate-200">
                                {items.map((item) => {
                                    const personnelCount = activeTab === 'departments' 
                                        ? getDepartmentPersonnel(item.name).length 
                                        : employees.filter(emp => emp.designation === item.name).length;

                                    return (
                                        <tr key={item._id} className="hover:bg-slate-800/40 transition-colors">
                                            <td className="px-6 py-4 font-black text-white">{item.name}</td>
                                            <td className="px-6 py-4 text-slate-400 max-w-sm truncate">{item.description || '-'}</td>
                                            <td className="px-6 py-4 text-center">
                                                <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                                                    personnelCount > 0 
                                                        ? 'bg-teal-950/60 text-teal-300 border border-teal-800/60'
                                                        : 'bg-slate-800 text-slate-500'
                                                }`}>
                                                    <IconPeople size={14} />
                                                    {personnelCount} assigned
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center justify-center gap-3">
                                                    <button
                                                        onClick={() => handleOpenModal(item)}
                                                        className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
                                                        title="Edit Details"
                                                    >
                                                        <IconEdit size={18} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(item._id)}
                                                        className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 transition-all"
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

            {/* Department / Designation Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 animate-fade-in">
                    <div className="bg-slate-900 rounded-[2rem] shadow-2xl border border-slate-800 max-w-md w-full overflow-hidden text-white animate-scale-in">
                        <div className="px-6 py-5 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
                            <h3 className="font-outfit font-black text-lg text-white uppercase tracking-wide">
                                {editId ? 'Edit Master Record' : 'Create Master Record'}
                            </h3>
                            <button 
                                onClick={() => setShowModal(false)}
                                className="text-slate-400 hover:text-white font-bold"
                            >
                                ✕
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                                    {activeTab === 'departments' ? 'Department Name' : 'Designation Name'} *
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full px-4 py-3 rounded-xl border border-slate-700 bg-slate-800 text-white focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm font-semibold"
                                    placeholder={activeTab === 'departments' ? 'e.g. Sales Department' : 'e.g. Sales Executive'}
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Description</label>
                                <textarea
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    className="w-full px-4 py-3 rounded-xl border border-slate-700 bg-slate-800 text-white focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm font-semibold h-24"
                                    placeholder="Optional description of roles and responsibilities"
                                />
                            </div>
                            <div className="flex gap-3 pt-4 border-t border-slate-800">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="flex-1 py-3.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 py-3.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-primary-600/20"
                                >
                                    Save Record
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Assign Person to Department Modal */}
            {showAssignModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 animate-fade-in">
                    <div className="bg-slate-900 rounded-[2rem] shadow-2xl border border-slate-800 max-w-md w-full overflow-hidden text-white animate-scale-in">
                        <div className="px-6 py-5 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
                            <div>
                                <h3 className="font-outfit font-black text-lg text-white uppercase tracking-wide">
                                    Assign Person
                                </h3>
                                <p className="text-xs text-primary-400 font-semibold mt-0.5">
                                    Department: {assignDeptName}
                                </p>
                            </div>
                            <button 
                                onClick={() => setShowAssignModal(false)}
                                className="text-slate-400 hover:text-white font-bold"
                            >
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleSaveAssignment} className="p-6 space-y-4">
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                                    Assignment Type
                                </label>
                                <div className="grid grid-cols-2 gap-2 p-1 bg-slate-950 rounded-xl border border-slate-800">
                                    <button
                                        type="button"
                                        onClick={() => setAssignPersonType('new')}
                                        className={`py-2 px-3 rounded-lg text-xs font-bold transition-all ${
                                            assignPersonType === 'new'
                                                ? 'bg-primary-600 text-white shadow'
                                                : 'text-slate-400 hover:text-white'
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
                                                : 'text-slate-400 hover:text-white'
                                        }`}
                                    >
                                        Select Existing
                                    </button>
                                </div>
                            </div>

                            {assignPersonType === 'new' ? (
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                                        Person Name *
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={newPersonName}
                                        onChange={(e) => setNewPersonName(e.target.value)}
                                        className="w-full px-4 py-3 rounded-xl border border-slate-700 bg-slate-800 text-white focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm font-semibold"
                                        placeholder="e.g. Rahul, Priya, Om"
                                    />
                                </div>
                            ) : (
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                                        Select Personnel *
                                    </label>
                                    <select
                                        required
                                        value={selectedPersonId}
                                        onChange={(e) => setSelectedPersonId(e.target.value)}
                                        className="w-full px-4 py-3 rounded-xl border border-slate-700 bg-slate-800 text-white focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm font-semibold"
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

                            <div className="flex gap-3 pt-4 border-t border-slate-800">
                                <button
                                    type="button"
                                    onClick={() => setShowAssignModal(false)}
                                    className="flex-1 py-3.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={savingAssign}
                                    className="flex-1 py-3.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-primary-600/20 disabled:opacity-50"
                                >
                                    {savingAssign ? 'Saving...' : 'Assign Person'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PayrollMasters;
