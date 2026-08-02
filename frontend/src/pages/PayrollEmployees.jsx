import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { payrollService, importService, branchService } from '../services/api';
import { toast } from 'react-toastify';
import Modal from '../components/Modal';
import ImportModal from '../components/ImportModal';
import SearchableSelect from '../components/SearchableSelect';
import { formatDate } from '../utils/helpers';
import * as XLSX from 'xlsx';
import { 
    MdPeople, MdAdd, MdSearch, MdEdit, MdDelete, 
    MdSave, MdAccountBalance, MdAssignment, MdUploadFile, MdDownload, MdBusiness, MdAccountTree, MdArrowBack, MdSettings,
    MdPhotoCamera, MdContactPhone 
} from 'react-icons/md';

const PayrollEmployees = ({ isCreatePage, isEditPage }) => {
    const navigate = useNavigate();
    const { id: routeId } = useParams();
    const [employees, setEmployees] = useState([]);
    const [branches, setBranches] = useState([]);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [branchFilter, setBranchFilter] = useState('');
    const [loading, setLoading] = useState(true);
    const [departments, setDepartments] = useState([]);
    const [designations, setDesignations] = useState([]);

    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState('add'); // 'add' | 'edit' | 'structure'
    const [selectedEmp, setSelectedEmp] = useState(null);

    // Form states
    const [basicForm, setBasicForm] = useState({
        branchId: '', employeeId: '', externalEmployeeCode: '', gender: 'Male', name: '', email: '', mobile: '', reportingTo: '', dob: '', joiningDate: '', lastWorkingDate: '', department: '', designation: '', status: 'Active',
        photo: '', familyDetails: [],
        pan: '', aadhaar: '', uan: '', pfNumber: '', esiNumber: '',
        bankName: '', accountNumber: '', ifscCode: ''
    });

    const handlePhotoUpload = (e) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 5 * 1024 * 1024) {
                toast.error('Image size should be less than 5MB');
                return;
            }
            const reader = new FileReader();
            reader.onloadend = () => {
                setBasicForm(prev => ({ ...prev, photo: reader.result }));
            };
            reader.readAsDataURL(file);
        }
    };

    const handleRemovePhoto = () => {
        setBasicForm(prev => ({ ...prev, photo: '' }));
    };

    // Collapsible states for Family Information section & cards
    const [isFamilySectionOpen, setIsFamilySectionOpen] = useState(true);
    const [openFamilyCards, setOpenFamilyCards] = useState({});

    const toggleFamilyCard = (index) => {
        setOpenFamilyCards(prev => ({
            ...prev,
            [index]: prev[index] === undefined ? false : !prev[index]
        }));
    };

    const handleAddFamilyMember = () => {
        setBasicForm(prev => {
            const newDetails = [
                ...(prev.familyDetails || []),
                { relation: 'Father', name: '', contactNumber: '', aadhaarNumber: '', isEmergencyContact: false }
            ];
            const newIdx = newDetails.length - 1;
            setOpenFamilyCards(cardPrev => ({ ...cardPrev, [newIdx]: true }));
            return { ...prev, familyDetails: newDetails };
        });
    };

    const handleUpdateFamilyMember = (index, field, value) => {
        setBasicForm(prev => {
            const updated = [...(prev.familyDetails || [])];
            let val = value;
            if (field === 'contactNumber') {
                val = value.replace(/\D/g, '').slice(0, 10);
            } else if (field === 'aadhaarNumber') {
                val = value.replace(/\D/g, '').slice(0, 12);
            }
            updated[index] = { ...updated[index], [field]: val };
            return { ...prev, familyDetails: updated };
        });
    };

    const handleRemoveFamilyMember = (index) => {
        setBasicForm(prev => ({
            ...prev,
            familyDetails: (prev.familyDetails || []).filter((_, i) => i !== index)
        }));
    };

    const [structureForm, setStructureForm] = useState({
        basic: 0, hra: 0, da: 0, specialAllowance: 0, bonus: 0, incentive: 0, reimbursement: 0,
        pf: 0, esi: 0, pt: 0, tds: 0, loan: 0, advance: 0, otherDeduction: 0
    });

    const [seqModalOpen, setSeqModalOpen] = useState(false);
    const [customSeqValue, setCustomSeqValue] = useState(5001);
    const [savingSeq, setSavingSeq] = useState(false);

    const fetchEmployees = async () => {
        try {
            setLoading(true);
            const params = {};
            if (statusFilter) params.status = statusFilter;
            if (branchFilter) params.branchId = branchFilter;
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
    }, [statusFilter, branchFilter, search]);

    const fetchMasters = async () => {
        try {
            const [deptRes, desRes, branchRes] = await Promise.all([
                payrollService.getDepartments(),
                payrollService.getDesignations(),
                branchService.getAll()
            ]);
            setDepartments(deptRes.data || []);
            setDesignations(desRes.data || []);
            setBranches(branchRes.data || []);
        } catch (error) {
            console.error('Failed to load department, designation, or branch masters', error);
        }
    };

    useEffect(() => {
        fetchMasters();
    }, []);

    const handleBranchSelect = async (branchId) => {
        setBasicForm(prev => ({ ...prev, branchId }));
        if (modalMode === 'add' && branchId) {
            try {
                const res = await branchService.getNextEmployeeId(branchId);
                setBasicForm(prev => ({ ...prev, branchId, employeeId: res.data?.employeeId || '' }));
            } catch (err) {
                console.error('Failed to fetch next Employee ID', err);
            }
        }
    };

    const handleOpenSeqModal = () => {
        if (!basicForm.branchId) {
            toast.warn('Please select a branch first');
            return;
        }
        const selectedBranch = branches.find(b => b._id === basicForm.branchId);
        setCustomSeqValue(selectedBranch?.startEmployeeSeq || 5001);
        setSeqModalOpen(true);
    };

    const handleSaveSeq = async (e) => {
        if (e) e.preventDefault();
        const parsed = parseInt(customSeqValue, 10);
        if (isNaN(parsed) || parsed < 1) {
            toast.error('Please enter a valid positive sequence number');
            return;
        }
        try {
            setSavingSeq(true);
            await branchService.update(basicForm.branchId, { startEmployeeSeq: parsed });
            toast.success(`Sequence number for branch updated to start at ${parsed}!`);
            const res = await branchService.getNextEmployeeId(basicForm.branchId);
            setBasicForm(prev => ({ ...prev, employeeId: res.data?.employeeId || '' }));
            setSeqModalOpen(false);
            fetchMasters();
        } catch (err) {
            console.error('Failed to update sequence', err);
            toast.error(err.response?.data?.message || 'Failed to update starting sequence');
        } finally {
            setSavingSeq(false);
        }
    };

    useEffect(() => {
        if (isCreatePage) {
            setSelectedEmp(null);
            setBasicForm({
                branchId: '', employeeId: '', externalEmployeeCode: '', gender: 'Male', name: '', email: '', mobile: '', reportingTo: '', dob: '', joiningDate: new Date().toISOString().substring(0, 10), lastWorkingDate: '',
                department: '', designation: '', status: 'Active',
                photo: '', familyDetails: [],
                pan: '', aadhaar: '', uan: '', pfNumber: '', esiNumber: '',
                bankName: '', accountNumber: '', ifscCode: ''
            });
            setModalMode('add');
            setIsModalOpen(true);
        } else if (isEditPage && routeId) {
            setIsModalOpen(true);
            setModalMode('edit');
            const populateForm = (emp) => {
                setSelectedEmp(emp);
                setBasicForm({
                    branchId: emp.branchId?._id || emp.branchId || '',
                    employeeId: emp.employeeId || '',
                    externalEmployeeCode: emp.externalEmployeeCode || '',
                    gender: emp.gender || 'Male',
                    name: emp.name || '',
                    email: emp.email || '',
                    mobile: emp.mobile || '',
                    reportingTo: emp.reportingTo?._id || emp.reportingTo || '',
                    dob: emp.dob ? new Date(emp.dob).toISOString().substring(0, 10) : '',
                    joiningDate: emp.joiningDate ? new Date(emp.joiningDate).toISOString().substring(0, 10) : '',
                    lastWorkingDate: emp.lastWorkingDate ? new Date(emp.lastWorkingDate).toISOString().substring(0, 10) : '',
                    department: emp.department || '',
                    designation: emp.designation || '',
                    status: emp.status || 'Active',
                    photo: emp.photo || '',
                    familyDetails: Array.isArray(emp.familyDetails) ? emp.familyDetails : [],
                    pan: emp.pan || '',
                    aadhaar: emp.aadhaar || '',
                    uan: emp.uan || '',
                    pfNumber: emp.pfNumber || '',
                    esiNumber: emp.esiNumber || '',
                    bankName: emp.bankName || '',
                    accountNumber: emp.accountNumber || '',
                    ifscCode: emp.ifscCode || ''
                });
            };
            const found = employees.find(e => e._id === routeId);
            if (found) {
                populateForm(found);
            } else {
                payrollService.getEmployees({ limit: 1000 }).then(res => {
                    const list = res.data || [];
                    const item = list.find(e => e._id === routeId);
                    if (item) populateForm(item);
                }).catch(err => console.error("Failed to load employee", err));
            }
        }
    }, [isCreatePage, isEditPage, routeId, employees]);

    const handleOpenAdd = () => {
        navigate('/payroll/employees/new');
    };

    const handleOpenEdit = (emp) => {
        navigate(`/payroll/employees/edit/${emp._id}`);
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

    // Form error state for validations
    const [formErrors, setFormErrors] = useState({});

    const validateEmployeeProfile = (form) => {
        const errors = {};

        // 1. Mobile Number validation
        if (form.mobile && form.mobile.trim()) {
            const cleanMobile = form.mobile.trim().replace(/\D/g, '');
            const mobileRegex = /^[6-9]\d{9}$/;
            if (!mobileRegex.test(cleanMobile)) {
                errors.mobile = 'Mobile Number must be a valid 10-digit number starting with 6-9 (e.g. 9876543210)';
            }
        }

        // 2. PAN validation
        if (form.pan && form.pan.trim()) {
            const cleanPan = form.pan.trim().toUpperCase();
            const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
            if (!panRegex.test(cleanPan)) {
                errors.pan = 'Invalid PAN format. Must be 5 letters, 4 digits, 1 letter (e.g. ABCDE1234F)';
            }
        }

        // 3. Aadhaar Number validation
        if (form.aadhaar && form.aadhaar.trim()) {
            const cleanAadhaar = form.aadhaar.trim().replace(/\D/g, '');
            const aadhaarRegex = /^\d{12}$/;
            if (!aadhaarRegex.test(cleanAadhaar)) {
                errors.aadhaar = 'Invalid Aadhaar number. Must be a 12-digit numeric code.';
            }
        }

        // 4. UAN Number validation
        if (form.uan && form.uan.trim()) {
            const cleanUan = form.uan.trim().replace(/\D/g, '');
            const uanRegex = /^\d{12}$/;
            if (!uanRegex.test(cleanUan)) {
                errors.uan = 'Invalid UAN number. Must be a 12-digit numeric code.';
            }
        }

        // 5. PF Number validation
        if (form.pfNumber && form.pfNumber.trim()) {
            const cleanPf = form.pfNumber.trim().toUpperCase();
            const pfRegex = /^([A-Z]{2}\/?[A-Z]{3}\/?[0-9]{7}\/?[0-9]{3}\/?[0-9]{7}|[A-Z0-9\/]{10,25})$/i;
            if (!pfRegex.test(cleanPf)) {
                errors.pfNumber = 'Invalid PF Account No format (e.g. MH/BAN/0012345/000/0000123)';
            }
        }

        // 6. ESI Number validation
        if (form.esiNumber && form.esiNumber.trim()) {
            const cleanEsi = form.esiNumber.trim().replace(/\D/g, '');
            const esiRegex = /^\d{17}$/;
            if (!esiRegex.test(cleanEsi)) {
                errors.esiNumber = 'Invalid ESI Number. Must be a 17-digit numeric code.';
            }
        }

        // 7. IFSC Code validation
        if (form.ifscCode && form.ifscCode.trim()) {
            const cleanIfsc = form.ifscCode.trim().toUpperCase();
            const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
            if (!ifscRegex.test(cleanIfsc)) {
                errors.ifscCode = 'Invalid IFSC Code format (e.g. SBIN0001234 - 4 letters, 0, 6 characters)';
            }
        }

        // 8. Family Member Aadhaar validation
        if (Array.isArray(form.familyDetails)) {
            form.familyDetails.forEach((fam, idx) => {
                if (fam.aadhaarNumber && fam.aadhaarNumber.trim()) {
                    const cleanFamAadhaar = fam.aadhaarNumber.trim().replace(/\D/g, '');
                    if (cleanFamAadhaar.length !== 12) {
                        errors[`family_aadhaar_${idx}`] = `Aadhaar number for ${fam.name || fam.relation || 'Family Member ' + (idx + 1)} must be exactly 12 digits.`;
                    }
                }
            });
        }

        return errors;
    };

    const handleBasicSubmit = async (e) => {
        e.preventDefault();

        // Perform validations
        const errors = validateEmployeeProfile(basicForm);
        setFormErrors(errors);

        if (Object.keys(errors).length > 0) {
            const firstErr = Object.values(errors)[0];
            toast.error(firstErr);
            return;
        }

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
            navigate('/payroll/employees');
        } catch (error) {
            console.error('Save employee error', error);
            toast.error(error.response?.data?.message || 'Failed to save employee profile');
        }
    };

    const handleStructureSubmit = async (e) => {
        e.preventDefault();
        try {
            const structPayload = Object.keys(structureForm).reduce((acc, curr) => {
                acc[curr] = parseFloat(structureForm[curr]) || 0;
                return acc;
            }, {});

            await payrollService.updateEmployeeStructure(selectedEmp._id, structPayload);
            toast.success('Base salary structure updated successfully!');
            setIsModalOpen(false);
            fetchEmployees();
            navigate('/payroll/employees');
        } catch (error) {
            console.error('Save salary structure error', error);
            toast.error(error.response?.data?.message || 'Failed to save base salary structure');
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

    const handleExport = () => {
        if (!employees || employees.length === 0) {
            toast.warn("No employees available to export.");
            return;
        }
        const exportData = employees.map(emp => ({
            'Employee Name': emp.name,
            'Email': emp.email || '',
            'PAN': emp.pan || '',
            'Aadhaar': emp.aadhaar || '',
            'UAN': emp.uan || '',
            'PF Number': emp.pfNumber || '',
            'ESI Number': emp.esiNumber || '',
            'Bank Name': emp.bankName || '',
            'Account Number': emp.accountNumber || '',
            'IFSC Code': emp.ifscCode || '',
            'Joining Date': emp.joiningDate ? new Date(emp.joiningDate).toISOString().substring(0, 10) : '',
            'DOB': emp.dob ? new Date(emp.dob).toISOString().substring(0, 10) : '',
            'Department': emp.department || '',
            'Designation': emp.designation || '',
            'Status': emp.status || 'Active',
            'Basic Salary': emp.salaryStructure?.basic || 0,
            'HRA': emp.salaryStructure?.hra || 0,
            'DA': emp.salaryStructure?.da || 0,
            'Special Allowance': emp.salaryStructure?.specialAllowance || 0
        }));

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Employees');
        XLSX.writeFile(wb, `Employees_List_${new Date().toISOString().slice(0, 10)}.xlsx`);
        toast.success("Employees list exported successfully!");
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
            {!(isModalOpen || isCreatePage || isEditPage) ? (
                <>
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">Employee Profiles</h1>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate('/payroll/org-chart')}
                        className="flex items-center justify-center gap-2 px-5 py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold transition-all shadow-md shadow-teal-600/20"
                        title="View Org Chart Module"
                    >
                        <MdAccountTree size={20} />
                        Org Chart
                    </button>
                    <button
                        onClick={handleExport}
                        className="flex items-center justify-center gap-2 px-5 py-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl font-bold transition-all shadow-sm"
                        title="Export Employees to Excel"
                    >
                        <MdDownload size={20} />
                        Export
                    </button>
                    <button
                        onClick={() => setIsImportModalOpen(true)}
                        className="flex items-center justify-center gap-2 px-5 py-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl font-bold transition-all shadow-sm"
                        title="Import Employees from Excel"
                    >
                        <MdUploadFile size={20} />
                        Import
                    </button>
                    <button
                        onClick={handleOpenAdd}
                        className="flex items-center justify-center gap-2 px-5 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-primary-600/20"
                    >
                        <MdAdd size={20} />
                        Add Employee Profile
                    </button>
                </div>
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
                                                <div className="flex items-center gap-3">
                                                    {emp.photo ? (
                                                        <img src={emp.photo} alt={emp.name} className="w-10 h-10 rounded-full object-cover border-2 border-teal-500 shadow-sm shrink-0" />
                                                    ) : (
                                                        <div className="w-10 h-10 rounded-full bg-teal-100 text-teal-700 font-black text-sm flex items-center justify-center shrink-0 border border-teal-200">
                                                            {emp.name ? emp.name.charAt(0).toUpperCase() : 'E'}
                                                        </div>
                                                    )}
                                                    <div>
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <p className="text-slate-900 font-bold">{emp.name}</p>
                                                            {emp.employeeId && (
                                                                <span className="px-2 py-0.5 bg-primary-100 dark:bg-primary-950 text-primary-700 dark:text-primary-300 font-black text-[10px] rounded-lg">
                                                                    {emp.employeeId}
                                                                </span>
                                                            )}
                                                            {emp.externalEmployeeCode && (
                                                                <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 font-mono font-bold text-[10px] rounded-lg border border-indigo-100">
                                                                    Ext: {emp.externalEmployeeCode}
                                                                </span>
                                                            )}
                                                            {emp.gender && (
                                                                <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 font-bold text-[10px] rounded-lg">
                                                                    {emp.gender}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="text-xs text-slate-400">{emp.email || 'No email registered'}</p>
                                                        {emp.reportingTo?.name && (
                                                            <p className="text-[11px] text-teal-600 font-medium mt-0.5">
                                                                Supervisor: {emp.reportingTo.name}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <p className="text-slate-800">{emp.designation || 'N/A'}</p>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <span className="text-xs text-slate-400">{emp.department || 'N/A'}</span>
                                                    {emp.branchId?.name && (
                                                        <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold text-[10px] rounded">
                                                            📍 {emp.branchId.name}
                                                        </span>
                                                    )}
                                                </div>
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
            </>
            ) : (
                <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-200">
                    {/* Header bar */}
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                            <div className="flex items-center gap-4">
                                <button
                                    type="button"
                                    onClick={() => { setIsModalOpen(false); navigate('/payroll/employees'); }}
                                    className="p-3 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-2xl transition-all border border-slate-200"
                                >
                                    <MdArrowBack size={20} />
                                </button>
                                <div>
                                    <h1 className="text-xl font-black text-slate-900">
                                        {(modalMode === 'add' && 'Employee Profile') ||
                                        (modalMode === 'edit' && 'Edit Employee Details') ||
                                        (modalMode === 'structure' && `Base Structure: ${selectedEmp?.name}`) ||
                                        ''}
                                    </h1>
                                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                                        {modalMode === 'structure' ? 'Manage base salary components & statutory setup' : 'Enter personal, statutory, and bank details for payroll'}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    type="button"
                                    onClick={() => { setIsModalOpen(false); navigate('/payroll/employees'); }}
                                    className="px-6 py-3 rounded-2xl border border-slate-200 text-slate-600 font-black uppercase text-xs tracking-widest hover:bg-slate-50 transition-all"
                                >
                                    Cancel
                                </button>
                                {modalMode !== 'structure' && (
                                    <button
                                        type="submit"
                                        form="employee-profile-form"
                                        className="bg-primary-600 hover:bg-primary-700 text-white px-8 py-3 rounded-2xl font-black transition-all shadow-xl shadow-primary-600/20 uppercase text-xs tracking-widest active:scale-95"
                                    >
                                        {modalMode === 'add' ? 'Save Profile' : 'Update Profile'}
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Form Card Body */}
                        <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
                            {/* Forms */}
                            {modalMode !== 'structure' ? (
                                <form id="employee-profile-form" onSubmit={handleBasicSubmit} className="space-y-6">
                                    {/* Section 1: Basic Details */}
                                    <div>
                                        <h4 className="text-xs font-black text-teal-600 uppercase tracking-widest mb-4 border-b border-slate-50 pb-1.5">1. Basic Info</h4>

                                        {/* Employee Photo Upload Widget */}
                                        <div className="flex items-center gap-6 p-4 bg-slate-50 border border-slate-200 rounded-2xl mb-6">
                                            <div className="relative shrink-0">
                                                {basicForm.photo ? (
                                                    <img
                                                        src={basicForm.photo}
                                                        alt="Employee Photo"
                                                        className="w-20 h-20 rounded-2xl object-cover border-2 border-teal-500 shadow-md"
                                                    />
                                                ) : (
                                                    <div className="w-20 h-20 rounded-2xl bg-teal-50 border-2 border-dashed border-teal-300 flex flex-col items-center justify-center text-teal-600">
                                                        <MdPhotoCamera size={28} />
                                                        <span className="text-[10px] font-bold mt-1">Photo</span>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="space-y-2">
                                                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                                                    Employee Profile Photo
                                                </label>
                                                <div className="flex items-center gap-3">
                                                    <label className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold text-xs cursor-pointer transition-all shadow-sm flex items-center gap-1.5">
                                                        <MdUploadFile size={16} />
                                                        <span>{basicForm.photo ? 'Change Photo' : 'Upload Photo'}</span>
                                                        <input
                                                            type="file"
                                                            accept="image/*"
                                                            onChange={handlePhotoUpload}
                                                            className="hidden"
                                                        />
                                                    </label>
                                                    {basicForm.photo && (
                                                        <button
                                                            type="button"
                                                            onClick={handleRemovePhoto}
                                                            className="px-4 py-2 border border-rose-200 text-rose-600 hover:bg-rose-50 rounded-xl font-bold text-xs transition-all"
                                                        >
                                                            Remove Photo
                                                        </button>
                                                    )}
                                                </div>
                                                <p className="text-[11px] text-slate-400 font-medium">Supports JPG, PNG or WEBP (Max size 5MB)</p>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div>
                                                <label className={labelClass}>Branch *</label>
                                                <select
                                                    required
                                                    value={basicForm.branchId || ''}
                                                    onChange={(e) => handleBranchSelect(e.target.value)}
                                                    className={inputClass}
                                                >
                                                    <option value="">-- Select Branch First --</option>
                                                    {branches.map(b => (
                                                        <option key={b._id} value={b._id}>
                                                            {b.name} ({b.branchPrefix || b.code})
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div>
                                                <div className="flex items-center justify-between gap-2 mb-1.5">
                                                    <label className={labelClass} style={{ marginBottom: 0 }}>Employee ID (Auto Generated)</label>
                                                    {modalMode === 'add' && basicForm.branchId && (
                                                        <button
                                                            type="button"
                                                            onClick={handleOpenSeqModal}
                                                            className="inline-flex items-center gap-1.5 text-[11px] font-bold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200/80 px-2.5 py-1 rounded-lg transition-all whitespace-nowrap active:scale-95 shadow-xs"
                                                            title="Set starting sequence number (e.g. 5001, 6001)"
                                                        >
                                                            <MdSettings size={13} className="text-teal-600" />
                                                            <span>Set Start Code</span>
                                                        </button>
                                                    )}
                                                </div>
                                                <input
                                                    type="text"
                                                    readOnly
                                                    value={basicForm.employeeId || ''}
                                                    className={`${inputClass} bg-slate-100 text-primary-600 font-black cursor-not-allowed`}
                                                    placeholder="Select Branch First"
                                                />
                                            </div>
                                            <div>
                                                <label className={labelClass}>* External Employee Code</label>
                                                <input
                                                    type="text"
                                                    value={basicForm.externalEmployeeCode || ''}
                                                    onChange={(e) => setBasicForm({ ...basicForm, externalEmployeeCode: e.target.value })}
                                                    className={inputClass}
                                                    placeholder="e.g. EXT-102"
                                                />
                                            </div>
                                            <div>
                                                <label className={labelClass}>Gender</label>
                                                <select
                                                    value={basicForm.gender || 'Male'}
                                                    onChange={(e) => setBasicForm({ ...basicForm, gender: e.target.value })}
                                                    className={inputClass}
                                                >
                                                    <option value="Male">Male</option>
                                                    <option value="Female">Female</option>
                                                    <option value="Other">Other</option>
                                                </select>
                                            </div>
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
                                                <label className={labelClass}>Reporting To</label>
                                                <SearchableSelect
                                                    options={employees
                                                        .filter(emp => (emp.status === 'Active' || !emp.status) && String(emp._id) !== String(selectedEmp?._id))
                                                        .map(emp => ({
                                                            value: emp._id,
                                                            label: `${emp.name}${emp.designation ? ` (${emp.designation})` : ''}${emp.employeeId ? ` - ID: ${emp.employeeId}` : ''}`
                                                        }))
                                                    }
                                                    value={basicForm.reportingTo || ''}
                                                    onChange={(val) => setBasicForm({ ...basicForm, reportingTo: val })}
                                                    placeholder="-- None (No Supervisor) --"
                                                    noResultsText="No active employee found"
                                                    inputClass="w-full px-3.5 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none transition-all cursor-pointer"
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
                                                <label className={labelClass}>Mobile Number</label>
                                                <input
                                                    type="text"
                                                    maxLength={10}
                                                    value={basicForm.mobile}
                                                    onChange={(e) => {
                                                        const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                                                        setBasicForm({ ...basicForm, mobile: val });
                                                        if (formErrors.mobile) setFormErrors({ ...formErrors, mobile: null });
                                                    }}
                                                    className={`${inputClass} ${formErrors.mobile ? 'border-rose-500 ring-2 ring-rose-500/20 bg-rose-50/20' : ''}`}
                                                    placeholder="9876543210"
                                                />
                                                {formErrors.mobile && (
                                                    <p className="text-[11px] font-semibold text-rose-500 mt-1">{formErrors.mobile}</p>
                                                )}
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
                                                <label className={labelClass}>Last Working Date</label>
                                                <input
                                                    type="date"
                                                    value={basicForm.lastWorkingDate || ''}
                                                    onChange={(e) => setBasicForm({ ...basicForm, lastWorkingDate: e.target.value })}
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
                                                    maxLength={10}
                                                    value={basicForm.pan}
                                                    onChange={(e) => {
                                                        const val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
                                                        setBasicForm({ ...basicForm, pan: val });
                                                        if (formErrors.pan) setFormErrors({ ...formErrors, pan: null });
                                                    }}
                                                    className={`${inputClass} uppercase ${formErrors.pan ? 'border-rose-500 ring-2 ring-rose-500/20 bg-rose-50/20' : ''}`}
                                                    placeholder="ABCDE1234F"
                                                />
                                                {formErrors.pan && (
                                                    <p className="text-[11px] font-semibold text-rose-500 mt-1">{formErrors.pan}</p>
                                                )}
                                            </div>
                                            <div>
                                                <label className={labelClass}>Aadhaar Number</label>
                                                <input
                                                    type="text"
                                                    maxLength={12}
                                                    value={basicForm.aadhaar}
                                                    onChange={(e) => {
                                                        const val = e.target.value.replace(/\D/g, '').slice(0, 12);
                                                        setBasicForm({ ...basicForm, aadhaar: val });
                                                        if (formErrors.aadhaar) setFormErrors({ ...formErrors, aadhaar: null });
                                                    }}
                                                    className={`${inputClass} ${formErrors.aadhaar ? 'border-rose-500 ring-2 ring-rose-500/20 bg-rose-50/20' : ''}`}
                                                    placeholder="123456789012"
                                                />
                                                {formErrors.aadhaar && (
                                                    <p className="text-[11px] font-semibold text-rose-500 mt-1">{formErrors.aadhaar}</p>
                                                )}
                                            </div>
                                            <div>
                                                <label className={labelClass}>UAN Number (PF)</label>
                                                <input
                                                    type="text"
                                                    maxLength={12}
                                                    value={basicForm.uan}
                                                    onChange={(e) => {
                                                        const val = e.target.value.replace(/\D/g, '').slice(0, 12);
                                                        setBasicForm({ ...basicForm, uan: val });
                                                        if (formErrors.uan) setFormErrors({ ...formErrors, uan: null });
                                                    }}
                                                    className={`${inputClass} ${formErrors.uan ? 'border-rose-500 ring-2 ring-rose-500/20 bg-rose-50/20' : ''}`}
                                                    placeholder="100123456789"
                                                />
                                                {formErrors.uan && (
                                                    <p className="text-[11px] font-semibold text-rose-500 mt-1">{formErrors.uan}</p>
                                                )}
                                            </div>
                                            <div>
                                                <label className={labelClass}>PF Account No</label>
                                                <input
                                                    type="text"
                                                    maxLength={25}
                                                    value={basicForm.pfNumber}
                                                    onChange={(e) => {
                                                        const val = e.target.value.toUpperCase().replace(/[^A-Z0-9\/]/g, '').slice(0, 25);
                                                        setBasicForm({ ...basicForm, pfNumber: val });
                                                        if (formErrors.pfNumber) setFormErrors({ ...formErrors, pfNumber: null });
                                                    }}
                                                    className={`${inputClass} uppercase ${formErrors.pfNumber ? 'border-rose-500 ring-2 ring-rose-500/20 bg-rose-50/20' : ''}`}
                                                    placeholder="MH/BAN/0012345/000/0001234"
                                                />
                                                {formErrors.pfNumber && (
                                                    <p className="text-[11px] font-semibold text-rose-500 mt-1">{formErrors.pfNumber}</p>
                                                )}
                                            </div>
                                            <div>
                                                <label className={labelClass}>ESI Insurance IP</label>
                                                <input
                                                    type="text"
                                                    maxLength={17}
                                                    value={basicForm.esiNumber}
                                                    onChange={(e) => {
                                                        const val = e.target.value.replace(/\D/g, '').slice(0, 17);
                                                        setBasicForm({ ...basicForm, esiNumber: val });
                                                        if (formErrors.esiNumber) setFormErrors({ ...formErrors, esiNumber: null });
                                                    }}
                                                    className={`${inputClass} ${formErrors.esiNumber ? 'border-rose-500 ring-2 ring-rose-500/20 bg-rose-50/20' : ''}`}
                                                    placeholder="3100123456789001"
                                                />
                                                {formErrors.esiNumber && (
                                                    <p className="text-[11px] font-semibold text-rose-500 mt-1">{formErrors.esiNumber}</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Section 3: Banking Info */}
                                    <div>
                                        <h4 className="text-xs font-black text-teal-600 uppercase tracking-widest mb-4 border-b border-slate-50 pb-1.5">3. Bank Account Setup</h4>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div>
                                                <label className={labelClass}>Bank Name</label>
                                                <input
                                                    type="text"
                                                    value={basicForm.bankName}
                                                    onChange={(e) => setBasicForm({ ...basicForm, bankName: e.target.value })}
                                                    className={inputClass}
                                                    placeholder="HDFC Bank"
                                                />
                                            </div>
                                            <div>
                                                <label className={labelClass}>Account Number</label>
                                                <input
                                                    type="text"
                                                    value={basicForm.accountNumber}
                                                    onChange={(e) => setBasicForm({ ...basicForm, accountNumber: e.target.value })}
                                                    className={inputClass}
                                                    placeholder="50100012345678"
                                                />
                                            </div>
                                            <div>
                                                <label className={labelClass}>IFSC Code</label>
                                                <input
                                                    type="text"
                                                    maxLength={11}
                                                    value={basicForm.ifscCode}
                                                    onChange={(e) => {
                                                        const val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 11);
                                                        setBasicForm({ ...basicForm, ifscCode: val });
                                                        if (formErrors.ifscCode) setFormErrors({ ...formErrors, ifscCode: null });
                                                    }}
                                                    className={`${inputClass} uppercase ${formErrors.ifscCode ? 'border-rose-500 ring-2 ring-rose-500/20 bg-rose-50/20' : ''}`}
                                                    placeholder="HDFC0001234"
                                                />
                                                {formErrors.ifscCode && (
                                                    <p className="text-[11px] font-semibold text-rose-500 mt-1">{formErrors.ifscCode}</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Section 4: Family Information (Collapsible Panel) */}
                                    <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-xs">
                                        <div 
                                            onClick={() => setIsFamilySectionOpen(!isFamilySectionOpen)}
                                            className="flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100/80 cursor-pointer transition-all border-b border-slate-200/60 select-none"
                                        >
                                            <div className="flex items-center gap-3">
                                                <span className="text-slate-600 font-bold text-base">
                                                    {isFamilySectionOpen ? '▼' : '▶'}
                                                </span>
                                                <h4 className="text-xs font-black text-teal-600 uppercase tracking-widest flex items-center gap-2">
                                                    <MdContactPhone size={16} />
                                                    <span>4. Family Information</span>
                                                </h4>
                                                {basicForm.familyDetails?.length > 0 && (
                                                    <span className="bg-teal-100 text-teal-800 text-[11px] font-bold px-2.5 py-0.5 rounded-full">
                                                        {basicForm.familyDetails.length} {basicForm.familyDetails.length === 1 ? 'member' : 'members'}
                                                    </span>
                                                )}
                                            </div>

                                            <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                                                <button
                                                    type="button"
                                                    onClick={handleAddFamilyMember}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs"
                                                >
                                                    <MdAdd size={16} />
                                                    <span>Add Family Member</span>
                                                </button>
                                            </div>
                                        </div>

                                        {isFamilySectionOpen && (
                                            <div className="p-5 space-y-4 bg-white">
                                                {(!basicForm.familyDetails || basicForm.familyDetails.length === 0) ? (
                                                    <div className="p-6 bg-slate-50 border border-dashed border-slate-200 rounded-2xl text-center">
                                                        <p className="text-xs font-semibold text-slate-500">No family details added yet.</p>
                                                        <button
                                                            type="button"
                                                            onClick={handleAddFamilyMember}
                                                            className="mt-2 text-xs font-black text-teal-600 hover:underline"
                                                        >
                                                            + Click to add a family member
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="space-y-3">
                                                        {basicForm.familyDetails.map((fam, idx) => {
                                                            const isCardOpen = openFamilyCards[idx] !== false;
                                                            return (
                                                                <div key={idx} className="border border-slate-200 rounded-2xl overflow-hidden bg-slate-50/50">
                                                                    {/* Per-Entry Accordion Header */}
                                                                    <div 
                                                                        onClick={() => toggleFamilyCard(idx)}
                                                                        className="flex items-center justify-between px-4 py-3 bg-slate-100/70 hover:bg-slate-100 cursor-pointer select-none border-b border-slate-200/50"
                                                                    >
                                                                        <div className="flex items-center gap-2.5">
                                                                            <span className="text-slate-500 font-bold text-xs">
                                                                                {isCardOpen ? '▼' : '▶'}
                                                                            </span>
                                                                            <span className="font-bold text-xs text-slate-800">
                                                                                {fam.relation || 'Member'} {fam.name ? `- ${fam.name}` : ''}
                                                                            </span>
                                                                            {fam.isEmergencyContact && (
                                                                                <span className="bg-rose-100 text-rose-700 text-[10px] font-black uppercase px-2 py-0.5 rounded-md">
                                                                                    Emergency Contact
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => handleRemoveFamilyMember(idx)}
                                                                                className="p-1.5 text-rose-500 hover:bg-rose-100 rounded-lg transition-all"
                                                                                title="Remove family member"
                                                                            >
                                                                                <MdDelete size={16} />
                                                                            </button>
                                                                        </div>
                                                                    </div>

                                                                    {/* Per-Entry Form Card Content */}
                                                                    {isCardOpen && (
                                                                        <div className="p-4 space-y-4 bg-white">
                                                                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                                                                <div>
                                                                                    <label className={labelClass}>Relation *</label>
                                                                                    <select
                                                                                        value={fam.relation || 'Father'}
                                                                                        onChange={(e) => handleUpdateFamilyMember(idx, 'relation', e.target.value)}
                                                                                        className={inputClass}
                                                                                    >
                                                                                        <option value="Father">Father</option>
                                                                                        <option value="Mother">Mother</option>
                                                                                        <option value="Spouse">Spouse</option>
                                                                                        <option value="Child">Child</option>
                                                                                        <option value="Sibling">Sibling</option>
                                                                                        <option value="Other">Other</option>
                                                                                    </select>
                                                                                </div>

                                                                                <div>
                                                                                    <label className={labelClass}>Name *</label>
                                                                                    <input
                                                                                        type="text"
                                                                                        placeholder="Family member full name"
                                                                                        value={fam.name || ''}
                                                                                        onChange={(e) => handleUpdateFamilyMember(idx, 'name', e.target.value)}
                                                                                        className={inputClass}
                                                                                    />
                                                                                </div>

                                                                                <div>
                                                                                    <label className={labelClass}>Contact Number</label>
                                                                                    <input
                                                                                        type="text"
                                                                                        maxLength={10}
                                                                                        placeholder="e.g. 9876543210"
                                                                                        value={fam.contactNumber || ''}
                                                                                        onChange={(e) => handleUpdateFamilyMember(idx, 'contactNumber', e.target.value)}
                                                                                        className={inputClass}
                                                                                    />
                                                                                </div>

                                                                                <div>
                                                                                    <label className={labelClass}>Aadhaar Number</label>
                                                                                    <input
                                                                                        type="text"
                                                                                        maxLength={12}
                                                                                        placeholder="e.g. 123456789012"
                                                                                        value={fam.aadhaarNumber || ''}
                                                                                        onChange={(e) => handleUpdateFamilyMember(idx, 'aadhaarNumber', e.target.value)}
                                                                                        className={`${inputClass} ${formErrors[`family_aadhaar_${idx}`] ? 'border-rose-500 ring-2 ring-rose-500/20 bg-rose-50/20' : ''}`}
                                                                                    />
                                                                                    {formErrors[`family_aadhaar_${idx}`] && (
                                                                                        <p className="text-[11px] font-semibold text-rose-500 mt-1">
                                                                                            {formErrors[`family_aadhaar_${idx}`]}
                                                                                        </p>
                                                                                    )}
                                                                                </div>
                                                                            </div>

                                                                            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                                                                                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700 select-none">
                                                                                    <input
                                                                                        type="checkbox"
                                                                                        checked={fam.isEmergencyContact || false}
                                                                                        onChange={(e) => handleUpdateFamilyMember(idx, 'isEmergencyContact', e.target.checked)}
                                                                                        className="w-4 h-4 text-teal-600 rounded focus:ring-teal-500"
                                                                                    />
                                                                                    <span>Emergency Contact</span>
                                                                                </label>

                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => handleRemoveFamilyMember(idx)}
                                                                                    className="text-xs font-bold text-rose-500 hover:underline flex items-center gap-1"
                                                                                >
                                                                                    <MdDelete size={14} />
                                                                                    <span>Remove Member</span>
                                                                                </button>
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    <div className="pt-5 border-t border-slate-100 flex justify-end gap-3">
                                        <button
                                            type="button"
                                            onClick={() => { setIsModalOpen(false); navigate('/payroll/employees'); }}
                                            className="px-6 py-2.5 border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            className="flex items-center gap-2 px-6 py-2.5 bg-primary-600 text-white font-bold rounded-xl hover:bg-primary-700 transition-colors shadow-lg shadow-primary-600/20"
                                        >
                                            <MdSave size={18} />
                                            {modalMode === 'add' ? 'Save Profile Details' : 'Update Basic Info'}
                                        </button>
                                    </div>
                                </form>
                            ) : (
                                <form onSubmit={handleStructureSubmit} className="space-y-6">
                                    {/* Component Section: Earnings */}
                                    <div>
                                        <h4 className="text-xs font-black text-emerald-600 uppercase tracking-widest mb-4 border-b border-slate-50 pb-1.5 flex items-center justify-between">
                                            <span>1. Fixed Gross Earnings (Monthly)</span>
                                            <span className="text-[10px] text-slate-400 font-medium lowercase">calculated automatically into payslip</span>
                                        </h4>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                            <div>
                                                <label className={labelClass}>Basic Pay *</label>
                                                <input
                                                    type="number"
                                                    required
                                                    value={structureForm.basic}
                                                    onChange={(e) => setStructureForm({ ...structureForm, basic: e.target.value })}
                                                    className={inputClass}
                                                />
                                            </div>
                                            <div>
                                                <label className={labelClass}>HRA (House Rent)</label>
                                                <input
                                                    type="number"
                                                    value={structureForm.hra}
                                                    onChange={(e) => setStructureForm({ ...structureForm, hra: e.target.value })}
                                                    className={inputClass}
                                                />
                                            </div>
                                            <div>
                                                <label className={labelClass}>Dearness Allowance (DA)</label>
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
                                                <label className={labelClass}>Statutory Bonus Component</label>
                                                <input
                                                    type="number"
                                                    value={structureForm.bonus}
                                                    onChange={(e) => setStructureForm({ ...structureForm, bonus: e.target.value })}
                                                    className={inputClass}
                                                />
                                            </div>
                                            <div>
                                                <label className={labelClass}>Sales Incentive Base</label>
                                                <input
                                                    type="number"
                                                    value={structureForm.incentive}
                                                    onChange={(e) => setStructureForm({ ...structureForm, incentive: e.target.value })}
                                                    className={inputClass}
                                                />
                                            </div>
                                            <div>
                                                <label className={labelClass}>Fixed Reimbursements</label>
                                                <input
                                                    type="number"
                                                    value={structureForm.reimbursement}
                                                    onChange={(e) => setStructureForm({ ...structureForm, reimbursement: e.target.value })}
                                                    className={inputClass}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Component Section: Deductions */}
                                    <div>
                                        <h4 className="text-xs font-black text-rose-600 uppercase tracking-widest mb-4 border-b border-slate-50 pb-1.5 flex items-center justify-between">
                                            <span>2. Standard Deductions (Monthly)</span>
                                            <span className="text-[10px] text-slate-400 font-medium lowercase">statutory and operational deductions</span>
                                        </h4>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                            <div>
                                                <label className={labelClass}>PF Deduction (Employee)</label>
                                                <input
                                                    type="number"
                                                    value={structureForm.pf}
                                                    onChange={(e) => setStructureForm({ ...structureForm, pf: e.target.value })}
                                                    className={inputClass}
                                                />
                                            </div>
                                            <div>
                                                <label className={labelClass}>ESI Contribution</label>
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
                                                <label className={labelClass}>TDS / Income Tax</label>
                                                <input
                                                    type="number"
                                                    value={structureForm.tds}
                                                    onChange={(e) => setStructureForm({ ...structureForm, tds: e.target.value })}
                                                    className={inputClass}
                                                />
                                            </div>
                                            <div>
                                                <label className={labelClass}>Loan EMI Repayment</label>
                                                <input
                                                    type="number"
                                                    value={structureForm.loan}
                                                    onChange={(e) => setStructureForm({ ...structureForm, loan: e.target.value })}
                                                    className={inputClass}
                                                />
                                            </div>
                                            <div>
                                                <label className={labelClass}>Salary Advance Dues</label>
                                                <input
                                                    type="number"
                                                    value={structureForm.advance}
                                                    onChange={(e) => setStructureForm({ ...structureForm, advance: e.target.value })}
                                                    className={inputClass}
                                                />
                                            </div>
                                            <div>
                                                <label className={labelClass}>Other Recurring Deduction</label>
                                                <input
                                                    type="number"
                                                    value={structureForm.otherDeduction}
                                                    onChange={(e) => setStructureForm({ ...structureForm, otherDeduction: e.target.value })}
                                                    className={inputClass}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="pt-5 border-t border-slate-100 flex justify-end gap-3">
                                        <button
                                            type="button"
                                            onClick={() => { setIsModalOpen(false); navigate('/payroll/employees'); }}
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
                        </div>
                </div>
            )}

            {/* Import Modal */}
            <ImportModal
                isOpen={isImportModalOpen}
                onClose={() => setIsImportModalOpen(false)}
                title="Import Employees"
                type="employees"
                onImport={async (file) => {
                    const result = await importService.importEmployees(file);
                    fetchEmployees(); // Refresh employees after import
                    return result;
                }}
                onDownloadTemplate={importService.getEmployeeTemplate}
            />

            {/* Custom Sequence Setup Modal using Modal.jsx Portal */}
            <Modal
                isOpen={seqModalOpen}
                onClose={() => setSeqModalOpen(false)}
                title="Configure Starting Sequence"
                maxWidth="max-w-md"
                footer={
                    <>
                        <button
                            type="button"
                            onClick={() => setSeqModalOpen(false)}
                            className="px-6 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs uppercase tracking-wider hover:bg-slate-50 transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleSaveSeq}
                            disabled={savingSeq}
                            className="px-6 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-teal-600/20 active:scale-95"
                        >
                            {savingSeq ? 'Saving...' : 'Save & Update Sequence'}
                        </button>
                    </>
                }
            >
                {(() => {
                    const selBranch = branches.find(b => b._id === basicForm.branchId);
                    const prefix = selBranch?.branchPrefix || selBranch?.code || 'EMP';
                    const seqNum = parseInt(customSeqValue, 10) || 1;
                    const previewId = `${prefix}${seqNum}`;
                    return (
                        <form onSubmit={handleSaveSeq} className="space-y-5">
                            <div className="p-4 bg-teal-50 border border-teal-100 rounded-2xl flex items-center justify-between">
                                <div>
                                    <span className="text-[10px] font-bold text-teal-600 uppercase tracking-wider block">Branch Selected</span>
                                    <span className="text-sm font-black text-teal-950">{selBranch?.name || 'Branch'} ({prefix})</span>
                                </div>
                                <div className="text-right">
                                    <span className="text-[10px] font-bold text-teal-600 uppercase tracking-wider block">Next Auto ID Preview</span>
                                    <span className="text-base font-black text-teal-700 font-mono">{previewId}</span>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-2">
                                    Starting Sequence Number *
                                </label>
                                <input
                                    type="number"
                                    required
                                    min="1"
                                    value={customSeqValue}
                                    onChange={(e) => setCustomSeqValue(e.target.value)}
                                    placeholder="e.g. 5001, 6001, 10001, 101"
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 font-black text-lg focus:ring-2 focus:ring-teal-500 focus:bg-white outline-none transition-all"
                                />
                                <p className="text-[11px] font-semibold text-slate-500 mt-2">
                                    Tip: You can set <strong>any</strong> starting sequence number (e.g. 5001 ➔ {prefix}5001, 6001 ➔ {prefix}6001, 10001 ➔ {prefix}10001, 101 ➔ {prefix}101).
                                </p>
                            </div>
                        </form>
                    );
                })()}
            </Modal>
        </div>
    );
};

export default PayrollEmployees;
