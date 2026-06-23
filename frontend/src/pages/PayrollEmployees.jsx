import React, { useState, useEffect } from 'react';
import { payrollService } from '../services/api';
import { toast } from 'react-toastify';
import Modal from '../components/Modal';
import SearchableSelect from '../components/SearchableSelect';
import { formatDate } from '../utils/helpers';
import { 
    MdPeople, MdAdd, MdSearch, MdEdit, MdDelete, 
    MdSave, MdAccountBalance, MdAssignment
} from 'react-icons/md';

const PayrollEmployees = () => {
    const [employees, setEmployees] = useState([]);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [loading, setLoading] = useState(true);
    const [departments, setDepartments] = useState([]);
    const [designations, setDesignations] = useState([]);

    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState('add'); // 'add' | 'edit' | 'structure'
    const [selectedEmp, setSelectedEmp] = useState(null);

    // Form states
    const [basicForm, setBasicForm] = useState({
        name: '', email: '', dob: '', joiningDate: '', department: '', designation: '', status: 'Active',
        pan: '', aadhaar: '', uan: '', pfNumber: '', esiNumber: '',
        bankName: '', accountNumber: '', ifscCode: ''
    });

    const [structureForm, setStructureForm] = useState({
        basic: 0, hra: 0, da: 0, specialAllowance: 0, bonus: 0, incentive: 0, reimbursement: 0,
        pf: 0, esi: 0, pt: 0, tds: 0, loan: 0, advance: 0, otherDeduction: 0
    });

    const fetchEmployees = async () => {
        try {
            setLoading(true);
            const params = {};
            if (statusFilter) params.status = statusFilter;
            if (search) params.search = search;
            
            const res = await payrollService.getEmployees(params);
            setEmployees(res.data || []);
        } catch (error) {
            console.error('Failed to load employee list', error);
            toast.error('Failed to load employee list');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchEmployees();
    }, [statusFilter, search]);

    const fetchMasters = async () => {
        try {
            const [deptRes, desRes] = await Promise.all([
                payrollService.getDepartments(),
                payrollService.getDesignations()
            ]);
            setDepartments(deptRes.data || []);
            setDesignations(desRes.data || []);
        } catch (error) {
            console.error('Failed to load department or designation masters', error);
        }
    };

    useEffect(() => {
        fetchMasters();
    }, []);

    const handleOpenAdd = () => {
        setBasicForm({
            name: '', email: '', dob: '', joiningDate: new Date().toISOString().substring(0, 10), 
            department: '', designation: '', status: 'Active',
            pan: '', aadhaar: '', uan: '', pfNumber: '', esiNumber: '',
            bankName: '', accountNumber: '', ifscCode: ''
        });
        setModalMode('add');
        setIsModalOpen(true);
    };

    const handleOpenEdit = (emp) => {
        setSelectedEmp(emp);
        setBasicForm({
            name: emp.name || '',
            email: emp.email || '',
            dob: emp.dob ? new Date(emp.dob).toISOString().substring(0, 10) : '',
            joiningDate: emp.joiningDate ? new Date(emp.joiningDate).toISOString().substring(0, 10) : '',
            department: emp.department || '',
            designation: emp.designation || '',
            status: emp.status || 'Active',
            pan: emp.pan || '',
            aadhaar: emp.aadhaar || '',
            uan: emp.uan || '',
            pfNumber: emp.pfNumber || '',
            esiNumber: emp.esiNumber || '',
            bankName: emp.bankName || '',
            accountNumber: emp.accountNumber || '',
            ifscCode: emp.ifscCode || ''
        });
        setModalMode('edit');
        setIsModalOpen(true);
    };

    const handleOpenStructure = (emp) => {
        setSelectedEmp(emp);
        const struct = emp.salaryStructure || {};
        setStructureForm({
            basic: struct.basic || 0,
            hra: struct.hra || 0,
            da: struct.da || 0,
            specialAllowance: struct.specialAllowance || 0,
            bonus: struct.bonus || 0,
            incentive: struct.incentive || 0,
            reimbursement: struct.reimbursement || 0,
            pf: struct.pf || 0,
            esi: struct.esi || 0,
            pt: struct.pt || 0,
            tds: struct.tds || 0,
            loan: struct.loan || 0,
            advance: struct.advance || 0,
            otherDeduction: struct.otherDeduction || 0
        });
        setModalMode('structure');
        setIsModalOpen(true);
    };

    const handleBasicSubmit = async (e) => {
        e.preventDefault();
        try {
            if (modalMode === 'add') {
                await payrollService.createEmployee(basicForm);
                toast.success('Employee salary profile created!');
            } else {
                await payrollService.updateEmployee(selectedEmp._id, basicForm);
                toast.success('Employee profile details updated!');
            }
            setIsModalOpen(false);
            fetchEmployees();
        } catch (error) {
            console.error('Save employee error', error);
            toast.error(error.response?.data?.message || 'Failed to save employee profile');
        }
    };

    const handleStructureSubmit = async (e) => {
        e.preventDefault();
        try {
            // Convert strings to floats
            const structPayload = Object.keys(structureForm).reduce((acc, curr) => {
                acc[curr] = parseFloat(structureForm[curr]) || 0;
                return acc;
            }, {});

            await payrollService.updateEmployeeStructure(selectedEmp._id, structPayload);
            toast.success('Base salary structure updated successfully!');
            setIsModalOpen(false);
            fetchEmployees();
        } catch (error) {
            console.error('Save structure error', error);
            toast.error('Failed to update salary structure');
        }
    };

    const handleDeleteEmployee = async (id) => {
        if (!window.confirm('Are you sure you want to delete this employee profile? This will clean up their current draft runs as well.')) return;
        try {
            await payrollService.deleteEmployee(id);
            toast.success('Employee profile deleted.');
            fetchEmployees();
        } catch (error) {
            console.error('Delete employee error', error);
            toast.error(error.response?.data?.message || 'Failed to delete employee profile');
        }
    };

    const inputClass = "w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all";
    const labelClass = "block text-xs font-bold text-slate-400 uppercase mb-1.5";

    const getStatusClass = (status) => {
        switch (status) {
            case 'Active':
                return 'bg-emerald-50 text-emerald-700 border-emerald-100';
            case 'Hold':
                return 'bg-amber-50 text-amber-700 border-amber-100';
            case 'Resigned':
                return 'bg-slate-100 text-slate-700 border-slate-200';
            default:
                return 'bg-slate-50 text-slate-500 border-slate-100';
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">Employee Profiles</h1>
                    <p className="text-slate-500 font-medium">Register basic details and configure monthly base salary structures.</p>
                </div>
                <button
                    onClick={handleOpenAdd}
                    className="flex items-center justify-center gap-2 px-5 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-primary-600/20"
                >
                    <MdAdd size={20} />
                    Add Employee Profile
                </button>
            </div>

            {/* Filter Bar */}
            <div className="flex flex-col md:flex-row gap-4 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                <div className="flex-1 relative">
                    <MdSearch className="absolute left-3.5 top-3.5 text-slate-400" size={20} />
                    <input
                        type="text"
                        placeholder="Search employee by name..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-primary-500 transition-all font-medium text-slate-700 text-sm"
                    />
                </div>
                <div className="w-full md:w-48">
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-primary-500 transition-all font-bold text-slate-500 text-sm"
                    >
                        <option value="">All Statuses</option>
                        <option value="Active">Active</option>
                        <option value="Hold">On Hold</option>
                        <option value="Resigned">Resigned</option>
                    </select>
                </div>
            </div>

            {/* Employee Register Table */}
            <div className="bg-white border border-slate-100 shadow-sm rounded-3xl overflow-hidden">
                {loading && employees.length === 0 ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="animate-spin rounded-full h-8 w-8 border-4 border-primary-500 border-t-transparent"></div>
                    </div>
                ) : employees.length === 0 ? (
                    <div className="p-16 text-center text-slate-400 font-bold">
                        No employee salary profiles found matching filter query.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50/70 text-slate-400 font-bold text-xs uppercase tracking-wider border-b border-slate-100">
                                    <th className="px-6 py-4">Employee Details</th>
                                    <th className="px-6 py-4">Department / Role</th>
                                    <th className="px-6 py-4">Joining Date</th>
                                    <th className="px-6 py-4">Structure Base</th>
                                    <th className="px-6 py-4">Status</th>
                                    <th className="px-6 py-4 text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                                {employees.map((emp) => {
                                    const grossBase = Object.keys(emp.salaryStructure || {}).reduce((acc, curr) => {
                                        const earnings = ['basic', 'hra', 'da', 'specialAllowance', 'bonus', 'incentive', 'reimbursement'];
                                        if (earnings.includes(curr)) {
                                            return acc + (emp.salaryStructure[curr] || 0);
                                        }
                                        return acc;
                                    }, 0);

                                    return (
                                        <tr key={emp._id} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="px-6 py-4">
                                                <p className="text-slate-900 font-bold">{emp.name}</p>
                                                <p className="text-xs text-slate-400">{emp.email || 'No email registered'}</p>
                                            </td>
                                            <td className="px-6 py-4">
                                                <p className="text-slate-800">{emp.designation || 'N/A'}</p>
                                                <p className="text-xs text-slate-400">{emp.department || 'N/A'}</p>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-slate-500">
                                                {emp.joiningDate ? formatDate(emp.joiningDate) : 'N/A'}
                                            </td>
                                            <td className="px-6 py-4">
                                                <p className="text-slate-900">₹{grossBase.toLocaleString('en-IN')}</p>
                                                <p className="text-xs text-slate-400">Monthly Gross</p>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2.5 py-0.5 border rounded-full text-[10px] font-black uppercase tracking-wider ${getStatusClass(emp.status)}`}>
                                                    {emp.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center justify-center gap-2">
                                                    <button
                                                        onClick={() => handleOpenStructure(emp)}
                                                        title="Configure Base Structure"
                                                        className="p-2 bg-teal-50 hover:bg-teal-600 text-teal-600 hover:text-white rounded-xl transition-all"
                                                    >
                                                        <MdAssignment size={16} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleOpenEdit(emp)}
                                                        title="Edit Basic details"
                                                        className="p-2 bg-primary-50 hover:bg-primary-600 text-primary-600 hover:text-white rounded-xl transition-all"
                                                    >
                                                        <MdEdit size={16} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteEmployee(emp._id)}
                                                        title="Delete Profile"
                                                        className="p-2 bg-rose-50 hover:bg-rose-600 text-rose-600 hover:text-white rounded-xl transition-all"
                                                    >
                                                        <MdDelete size={16} />
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

            {/* Modal Add/Edit Profile */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={
                    (modalMode === 'add' && 'Create Employee Salary Profile') ||
                    (modalMode === 'edit' && 'Edit Employee Details') ||
                    (modalMode === 'structure' && `Base Structure: ${selectedEmp?.name}`) ||
                    ''
                }
                maxWidth="max-w-4xl"
            >
                            {/* Forms */}
                            {modalMode !== 'structure' ? (
                                <form onSubmit={handleBasicSubmit} className="space-y-6">
                                    {/* Section 1: Basic Details */}
                                    <div>
                                        <h4 className="text-xs font-black text-teal-600 uppercase tracking-widest mb-4 border-b border-slate-50 pb-1.5">1. Basic Info</h4>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div>
                                                <label className={labelClass}>Employee Name *</label>
                                                <input
                                                    type="text"
                                                    required
                                                    value={basicForm.name}
                                                    onChange={(e) => setBasicForm({ ...basicForm, name: e.target.value })}
                                                    className={inputClass}
                                                    placeholder="Rajesh Kumar"
                                                />
                                            </div>
                                            <div>
                                                <label className={labelClass}>Email Address</label>
                                                <input
                                                    type="email"
                                                    value={basicForm.email}
                                                    onChange={(e) => setBasicForm({ ...basicForm, email: e.target.value })}
                                                    className={inputClass}
                                                    placeholder="rajesh@company.com"
                                                />
                                            </div>
                                            <div>
                                                <label className={labelClass}>Date of Birth</label>
                                                <input
                                                    type="date"
                                                    value={basicForm.dob}
                                                    onChange={(e) => setBasicForm({ ...basicForm, dob: e.target.value })}
                                                    className={inputClass}
                                                />
                                            </div>
                                            <div>
                                                <label className={labelClass}>Joining Date *</label>
                                                <input
                                                    type="date"
                                                    required
                                                    value={basicForm.joiningDate}
                                                    onChange={(e) => setBasicForm({ ...basicForm, joiningDate: e.target.value })}
                                                    className={inputClass}
                                                />
                                            </div>
                                            <div>
                                                <label className={labelClass}>Department</label>
                                                <SearchableSelect
                                                    options={departments.map((d) => d.name)}
                                                    value={basicForm.department}
                                                    onChange={(val) => setBasicForm({ ...basicForm, department: val })}
                                                    placeholder="Select Department"
                                                />
                                            </div>
                                            <div>
                                                <label className={labelClass}>Designation</label>
                                                <SearchableSelect
                                                    options={designations.map((d) => d.name)}
                                                    value={basicForm.designation}
                                                    onChange={(val) => setBasicForm({ ...basicForm, designation: val })}
                                                    placeholder="Select Designation"
                                                />
                                            </div>
                                            <div>
                                                <label className={labelClass}>Profile Status</label>
                                                <select
                                                    value={basicForm.status}
                                                    onChange={(e) => setBasicForm({ ...basicForm, status: e.target.value })}
                                                    className={inputClass}
                                                >
                                                    <option value="Active">Active</option>
                                                    <option value="Hold">On Hold</option>
                                                    <option value="Resigned">Resigned</option>
                                                </select>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Section 2: Identification Details */}
                                    <div>
                                        <h4 className="text-xs font-black text-teal-600 uppercase tracking-widest mb-4 border-b border-slate-50 pb-1.5">2. PAN, Aadhaar, UAN & Registration</h4>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div>
                                                <label className={labelClass}>PAN (Income Tax)</label>
                                                <input
                                                    type="text"
                                                    value={basicForm.pan}
                                                    onChange={(e) => setBasicForm({ ...basicForm, pan: e.target.value })}
                                                    className={inputClass}
                                                    placeholder="ABCDE1234F"
                                                />
                                            </div>
                                            <div>
                                                <label className={labelClass}>Aadhaar Number</label>
                                                <input
                                                    type="text"
                                                    value={basicForm.aadhaar}
                                                    onChange={(e) => setBasicForm({ ...basicForm, aadhaar: e.target.value })}
                                                    className={inputClass}
                                                    placeholder="1234 5678 9012"
                                                />
                                            </div>
                                            <div>
                                                <label className={labelClass}>UAN (EPFO)</label>
                                                <input
                                                    type="text"
                                                    value={basicForm.uan}
                                                    onChange={(e) => setBasicForm({ ...basicForm, uan: e.target.value })}
                                                    className={inputClass}
                                                    placeholder="100XXXXXXXXX"
                                                />
                                            </div>
                                            <div>
                                                <label className={labelClass}>Provident Fund (PF) No.</label>
                                                <input
                                                    type="text"
                                                    value={basicForm.pfNumber}
                                                    onChange={(e) => setBasicForm({ ...basicForm, pfNumber: e.target.value })}
                                                    className={inputClass}
                                                    placeholder="MH/NGP/12345/PF"
                                                />
                                            </div>
                                            <div>
                                                <label className={labelClass}>ESI Number</label>
                                                <input
                                                    type="text"
                                                    value={basicForm.esiNumber}
                                                    onChange={(e) => setBasicForm({ ...basicForm, esiNumber: e.target.value })}
                                                    className={inputClass}
                                                    placeholder="31XXXXXXXXXXXXXX"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Section 3: Bank Details */}
                                    <div>
                                        <h4 className="text-xs font-black text-teal-600 uppercase tracking-widest mb-4 border-b border-slate-50 pb-1.5">3. Banking & Payment Details</h4>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div>
                                                <label className={labelClass}>Bank Name</label>
                                                <input
                                                    type="text"
                                                    value={basicForm.bankName}
                                                    onChange={(e) => setBasicForm({ ...basicForm, bankName: e.target.value })}
                                                    className={inputClass}
                                                    placeholder="e.g. HDFC Bank"
                                                />
                                            </div>
                                            <div>
                                                <label className={labelClass}>Account Number</label>
                                                <input
                                                    type="text"
                                                    value={basicForm.accountNumber}
                                                    onChange={(e) => setBasicForm({ ...basicForm, accountNumber: e.target.value })}
                                                    className={inputClass}
                                                    placeholder="1234567890"
                                                />
                                            </div>
                                            <div>
                                                <label className={labelClass}>IFSC Code</label>
                                                <input
                                                    type="text"
                                                    value={basicForm.ifscCode}
                                                    onChange={(e) => setBasicForm({ ...basicForm, ifscCode: e.target.value })}
                                                    className={inputClass}
                                                    placeholder="HDFC0001234"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="pt-5 border-t border-slate-100 flex justify-end gap-3">
                                        <button
                                            type="button"
                                            onClick={() => setIsModalOpen(false)}
                                            className="px-6 py-2.5 border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            className="flex items-center gap-2 px-6 py-2.5 bg-primary-600 text-white font-bold rounded-xl hover:bg-primary-700 transition-colors shadow-lg shadow-primary-600/20"
                                        >
                                            <MdSave size={18} />
                                            Save Profile
                                        </button>
                                    </div>
                                </form>
                            ) : (
                                <form onSubmit={handleStructureSubmit} className="p-6 space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        {/* Earnings Allowances */}
                                        <div className="space-y-4">
                                            <h4 className="text-xs font-black text-emerald-600 uppercase tracking-widest mb-2 border-b border-slate-50 pb-1.5">Earnings Allowances</h4>
                                            
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className={labelClass}>Basic Salary *</label>
                                                    <input
                                                        type="number"
                                                        value={structureForm.basic}
                                                        onChange={(e) => setStructureForm({ ...structureForm, basic: e.target.value })}
                                                        className={inputClass}
                                                    />
                                                </div>
                                                <div>
                                                    <label className={labelClass}>HRA Allowances</label>
                                                    <input
                                                        type="number"
                                                        value={structureForm.hra}
                                                        onChange={(e) => setStructureForm({ ...structureForm, hra: e.target.value })}
                                                        className={inputClass}
                                                    />
                                                </div>
                                                <div>
                                                    <label className={labelClass}>DA Allowances</label>
                                                    <input
                                                        type="number"
                                                        value={structureForm.da}
                                                        onChange={(e) => setStructureForm({ ...structureForm, da: e.target.value })}
                                                        className={inputClass}
                                                    />
                                                </div>
                                                <div>
                                                    <label className={labelClass}>Special Allowance</label>
                                                    <input
                                                        type="number"
                                                        value={structureForm.specialAllowance}
                                                        onChange={(e) => setStructureForm({ ...structureForm, specialAllowance: e.target.value })}
                                                        className={inputClass}
                                                    />
                                                </div>
                                                <div>
                                                    <label className={labelClass}>Base Bonus</label>
                                                    <input
                                                        type="number"
                                                        value={structureForm.bonus}
                                                        onChange={(e) => setStructureForm({ ...structureForm, bonus: e.target.value })}
                                                        className={inputClass}
                                                    />
                                                </div>
                                                <div>
                                                    <label className={labelClass}>Base Incentive</label>
                                                    <input
                                                        type="number"
                                                        value={structureForm.incentive}
                                                        onChange={(e) => setStructureForm({ ...structureForm, incentive: e.target.value })}
                                                        className={inputClass}
                                                    />
                                                </div>
                                                <div>
                                                    <label className={labelClass}>Reimbursement</label>
                                                    <input
                                                        type="number"
                                                        value={structureForm.reimbursement}
                                                        onChange={(e) => setStructureForm({ ...structureForm, reimbursement: e.target.value })}
                                                        className={inputClass}
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Standard Deductions */}
                                        <div className="space-y-4">
                                            <h4 className="text-xs font-black text-rose-600 uppercase tracking-widest mb-2 border-b border-slate-50 pb-1.5">Monthly Deductions</h4>
                                            
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className={labelClass}>Provident Fund (PF)</label>
                                                    <input
                                                        type="number"
                                                        value={structureForm.pf}
                                                        onChange={(e) => setStructureForm({ ...structureForm, pf: e.target.value })}
                                                        className={inputClass}
                                                    />
                                                </div>
                                                <div>
                                                    <label className={labelClass}>ESI Deduction</label>
                                                    <input
                                                        type="number"
                                                        value={structureForm.esi}
                                                        onChange={(e) => setStructureForm({ ...structureForm, esi: e.target.value })}
                                                        className={inputClass}
                                                    />
                                                </div>
                                                <div>
                                                    <label className={labelClass}>Professional Tax (PT)</label>
                                                    <input
                                                        type="number"
                                                        value={structureForm.pt}
                                                        onChange={(e) => setStructureForm({ ...structureForm, pt: e.target.value })}
                                                        className={inputClass}
                                                    />
                                                </div>
                                                <div>
                                                    <label className={labelClass}>Income Tax (TDS)</label>
                                                    <input
                                                        type="number"
                                                        value={structureForm.tds}
                                                        onChange={(e) => setStructureForm({ ...structureForm, tds: e.target.value })}
                                                        className={inputClass}
                                                    />
                                                </div>
                                                <div>
                                                    <label className={labelClass}>Active Loan Payback</label>
                                                    <input
                                                        type="number"
                                                        value={structureForm.loan}
                                                        onChange={(e) => setStructureForm({ ...structureForm, loan: e.target.value })}
                                                        className={inputClass}
                                                    />
                                                </div>
                                                <div>
                                                    <label className={labelClass}>Advance Deduct</label>
                                                    <input
                                                        type="number"
                                                        value={structureForm.advance}
                                                        onChange={(e) => setStructureForm({ ...structureForm, advance: e.target.value })}
                                                        className={inputClass}
                                                    />
                                                </div>
                                                <div>
                                                    <label className={labelClass}>Other Deduct</label>
                                                    <input
                                                        type="number"
                                                        value={structureForm.otherDeduction}
                                                        onChange={(e) => setStructureForm({ ...structureForm, otherDeduction: e.target.value })}
                                                        className={inputClass}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="pt-5 border-t border-slate-100 flex justify-end gap-3">
                                        <button
                                            type="button"
                                            onClick={() => setIsModalOpen(false)}
                                            className="px-6 py-2.5 border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            className="flex items-center gap-2 px-6 py-2.5 bg-primary-600 text-white font-bold rounded-xl hover:bg-primary-700 transition-colors shadow-lg shadow-primary-600/20"
                                        >
                                            <MdSave size={18} />
                                            Update Base Structure
                                        </button>
                                    </div>
                                </form>
                            )}
            </Modal>
        </div>
    );
};

export default PayrollEmployees;
