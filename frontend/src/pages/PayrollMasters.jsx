import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { payrollService } from '../services/api';
import { toast } from 'react-toastify';
import { 
    MdCategory as IconCategory, 
    MdAssignment as IconAssignment, 
    MdAdd as IconAdd, 
    MdDelete as IconDelete, 
    MdEdit as IconEdit, 
    MdCloudDownload as IconCloudDownload,
    MdPeople as IconPeople
} from 'react-icons/md';

const PayrollMasters = () => {
    const location = useLocation();
    const queryParams = new URLSearchParams(location.search);
    const initialTab = queryParams.get('tab') || 'departments';

    const [activeTab, setActiveTab] = useState(initialTab);
    const [loading, setLoading] = useState(false);
    const [items, setItems] = useState([]);
    const [employees, setEmployees] = useState([]);

    useEffect(() => {
        const tab = new URLSearchParams(location.search).get('tab');
        if (tab && (tab === 'departments' || tab === 'designations')) {
            setActiveTab(tab);
        }
    }, [location.search]);
    
    // Form states
    const [showModal, setShowModal] = useState(false);
    const [editId, setEditId] = useState(null);
    const [formData, setFormData] = useState({ name: '', description: '' });
    
    const tabs = [
        { id: 'departments', label: 'Departments', icon: <IconCategory size={20} /> },
        { id: 'designations', label: 'Designations', icon: <IconAssignment size={20} /> }
    ];

    const fetchItems = async () => {
        setLoading(true);
        try {
            const [itemsRes, empRes] = await Promise.all([
                activeTab === 'departments' 
                    ? payrollService.getDepartments() 
                    : payrollService.getDesignations(),
                payrollService.getEmployees()
            ]);
            
            setItems(itemsRes.data || []);
            setEmployees(empRes.data || []);
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

    const getEmployeeCount = (itemName) => {
        return employees.filter(emp => 
            activeTab === 'departments' 
                ? emp.department === itemName 
                : emp.designation === itemName
        ).length;
    };

    return (
        <div className="space-y-6 max-w-7xl mx-auto animate-fade-in-up">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-slate-900 font-outfit uppercase">
                        Payroll Master Configurations
                    </h1>
                    <p className="text-slate-500 font-semibold text-sm">
                        Manage company departments and job designations for employee profile assignment.
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

            {/* List View */}
            <div className="glass shadow-premium rounded-[2rem] p-6 bg-white border border-slate-100">
                {loading && items.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 space-y-3">
                        <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin"></div>
                        <p className="text-slate-400 font-bold uppercase text-xs tracking-widest">Loading Master Lists...</p>
                    </div>
                ) : items.length === 0 ? (
                    <div className="text-center py-16">
                        <p className="text-slate-400 font-bold text-lg mb-2">No master records found.</p>
                        <p className="text-slate-400 text-sm mb-4">Click "Add New" to populate your organizational structure.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100">
                                    <th className="px-6 py-4">Name</th>
                                    <th className="px-6 py-4">Description</th>
                                    <th className="px-6 py-4 text-center">Active Employees</th>
                                    <th className="px-6 py-4 text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 text-sm font-semibold text-slate-700">
                                {items.map((item) => {
                                    const employeeCount = getEmployeeCount(item.name);
                                    return (
                                        <tr key={item._id} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="px-6 py-4 font-black text-slate-900">{item.name}</td>
                                            <td className="px-6 py-4 text-slate-500 max-w-sm truncate">{item.description || '-'}</td>
                                            <td className="px-6 py-4 text-center">
                                                <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                                                    employeeCount > 0 
                                                        ? 'bg-teal-50 text-teal-800 border border-teal-100'
                                                        : 'bg-slate-100 text-slate-400'
                                                }`}>
                                                    <IconPeople size={14} />
                                                    {employeeCount} assigned
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

            {/* Modal Form */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-[2rem] shadow-2xl border border-slate-100 max-w-md w-full overflow-hidden animate-scale-in">
                        <div className="px-6 py-5 border-b border-slate-50 bg-slate-50 flex items-center justify-between">
                            <h3 className="font-outfit font-black text-lg text-slate-900 uppercase">
                                {editId ? 'Edit Master Record' : 'Create Master Record'}
                            </h3>
                            <button 
                                onClick={() => setShowModal(false)}
                                className="text-slate-400 hover:text-slate-600 font-bold"
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
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm font-semibold"
                                    placeholder={activeTab === 'departments' ? 'e.g. Sales' : 'e.g. Sales Executive'}
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Description</label>
                                <textarea
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm font-semibold h-24"
                                    placeholder="Optional description of roles and responsibilities"
                                />
                            </div>
                            <div className="flex gap-3 pt-4 border-t border-slate-50">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 py-3.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-primary-600/10"
                                >
                                    Save Record
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
