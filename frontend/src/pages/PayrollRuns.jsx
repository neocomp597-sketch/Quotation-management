import React, { useState, useEffect } from 'react';
import { payrollService } from '../services/api';
import { toast } from 'react-toastify';
import Modal from '../components/Modal';
import { formatDate } from '../utils/helpers';
import { 
    MdReceipt, MdAdd, MdSave, MdRefresh, 
    MdCheckCircle, MdLock, MdEdit, MdChevronLeft, MdVisibility
} from 'react-icons/md';

const PayrollRuns = () => {
    const [runs, setRuns] = useState([]);
    const [activeRunId, setActiveRunId] = useState(null);
    const [runDetails, setRunDetails] = useState(null);
    const [loading, setLoading] = useState(true);

    // Modal state for adjustments
    const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
    const [selectedSummary, setSelectedSummary] = useState(null);
    const [adjustForm, setAdjustForm] = useState({
        bonus: 0, incentive: 0, arrears: 0, reimbursement: 0,
        loanDeduction: 0, advanceDeduction: 0, unpaidLeaveDeduction: 0, otherDeduction: 0
    });

    // Create Month Run form state
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [newMonth, setNewMonth] = useState('');
    const [createRunError, setCreateRunError] = useState('');

    // Custom Confirm Modal state
    const [confirmModal, setConfirmModal] = useState({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: null
    });

    const fetchRuns = async () => {
        try {
            setLoading(true);
            const res = await payrollService.getRuns();
            setRuns(res.data || []);
        } catch (error) {
            console.error('Failed to load runs', error);
            toast.error('Failed to load payroll runs');
        } finally {
            setLoading(false);
        }
    };

    const fetchRunDetails = async (id) => {
        try {
            setLoading(true);
            const res = await payrollService.getRunDetails(id);
            setRunDetails(res.data || null);
            setActiveRunId(id);
        } catch (error) {
            console.error('Failed to load run details', error);
            toast.error('Failed to load run details');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRuns();
    }, []);

    const handleCreateRun = async (e) => {
        e.preventDefault();
        setCreateRunError('');
        if (!newMonth) return;
        const existingRun = runs.find((run) => run.month === newMonth);
        if (existingRun) {
            setCreateRunError(`Payroll run for ${formatMonthName(newMonth)} already exists.`);
            return;
        }
        try {
            const res = await payrollService.createRun({ month: newMonth });
            toast.success(`Payroll run for ${newMonth} initialized!`);
            setIsCreateModalOpen(false);
            fetchRunDetails(res.data._id);
        } catch (error) {
            console.error('Create run error', error);
            const message = error.response?.data?.message || 'Failed to initialize payroll run';
            setCreateRunError(message);
            toast.error(message);
        }
    };

    const handleOpenAdjust = (summary) => {
        setSelectedSummary(summary);
        const adj = summary.adjustments || {};
        setAdjustForm({
            bonus: adj.bonus || 0,
            incentive: adj.incentive || 0,
            arrears: adj.arrears || 0,
            reimbursement: adj.reimbursement || 0,
            loanDeduction: adj.loanDeduction || 0,
            advanceDeduction: adj.advanceDeduction || 0,
            unpaidLeaveDeduction: adj.unpaidLeaveDeduction || 0,
            otherDeduction: adj.otherDeduction || 0
        });
        setIsAdjustModalOpen(true);
    };

    const handleSaveAdjust = async (e) => {
        e.preventDefault();
        try {
            const payload = Object.keys(adjustForm).reduce((acc, curr) => {
                acc[curr] = parseFloat(adjustForm[curr]) || 0;
                return acc;
            }, {});

            await payrollService.updateEmployeeSummary(activeRunId, selectedSummary._id, { adjustments: payload });
            toast.success('Adjustments updated and salary calculated!');
            setIsAdjustModalOpen(false);
            fetchRunDetails(activeRunId);
        } catch (error) {
            console.error('Save adjustments error', error);
            toast.error(error.response?.data?.message || 'Failed to save adjustments');
        }
    };

    const handleRecalculate = async () => {
        try {
            setLoading(true);
            await payrollService.calculateRun(activeRunId);
            toast.success('Recalculated gross, deductions, and net payouts!');
            fetchRunDetails(activeRunId);
        } catch (error) {
            console.error('Recalculate error', error);
            toast.error('Failed to recalculate salaries');
            setLoading(false);
        }
    };

    const handleApprove = () => {
        setConfirmModal({
            isOpen: true,
            title: 'Approve Payroll Register',
            message: 'Are you sure you want to approve this monthly payroll run? This will freeze basic edits and mark it ready for locking.',
            onConfirm: async () => {
                try {
                    setLoading(true);
                    await payrollService.approveRun(activeRunId);
                    toast.success('Monthly payroll approved!');
                    fetchRunDetails(activeRunId);
                } catch (error) {
                    console.error('Approve error', error);
                    toast.error('Failed to approve payroll run');
                    setLoading(false);
                }
            }
        });
    };

    const handleLock = () => {
        setConfirmModal({
            isOpen: true,
            title: 'Lock Monthly Payroll',
            message: 'CAUTION: Are you sure you want to LOCK this monthly payroll? Once locked, salary figures CANNOT be edited ever. Only payment slip recording will be allowed.',
            onConfirm: async () => {
                try {
                    setLoading(true);
                    await payrollService.lockRun(activeRunId);
                    toast.success('Monthly payroll locked successfully!');
                    fetchRunDetails(activeRunId);
                } catch (error) {
                    console.error('Lock error', error);
                    toast.error('Failed to lock payroll run');
                    setLoading(false);
                }
            }
        });
    };

    const formatMonthName = (monthStr) => {
        if (!monthStr) return '';
        const [year, month] = monthStr.split('-');
        const date = new Date(year, parseInt(month) - 1, 1);
        return date.toLocaleString('en-US', { month: 'long', year: 'numeric' });
    };

    const getStatusBadge = (status) => {
        switch (status?.toLowerCase()) {
            case 'locked':
                return 'bg-slate-100 text-slate-800 border-slate-200';
            case 'approved':
                return 'bg-emerald-50 text-emerald-700 border-emerald-100';
            case 'draft':
                return 'bg-amber-50 text-amber-700 border-amber-100';
            default:
                return 'bg-rose-50 text-rose-700 border-rose-100';
        }
    };

    const inputClass = "w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all";
    const labelClass = "block text-xs font-bold text-slate-400 uppercase mb-1.5";

    if (!activeRunId) {
        // Render List of Runs
        return (
            <div className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Run Payroll</h1>
                        <p className="text-slate-500 font-medium">Create monthly payroll runs, input allowances/deductions, and verify nets.</p>
                    </div>
                    <button
                        onClick={() => {
                            setNewMonth(new Date().toISOString().substring(0, 7));
                            setCreateRunError('');
                            setIsCreateModalOpen(true);
                        }}
                        className="flex items-center justify-center gap-2 px-5 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-primary-600/20"
                    >
                        <MdAdd size={20} />
                        Create Payroll Month
                    </button>
                </div>

                <div className="bg-white border border-slate-100 shadow-sm rounded-3xl overflow-hidden">
                    {loading && runs.length === 0 ? (
                        <div className="flex items-center justify-center py-20">
                            <div className="animate-spin rounded-full h-8 w-8 border-4 border-primary-500 border-t-transparent"></div>
                        </div>
                    ) : runs.length === 0 ? (
                        <div className="p-16 text-center text-slate-400 font-bold">
                            No monthly payroll runs found. Click "Create Payroll Month" to start one.
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50/70 text-slate-400 font-bold text-xs uppercase tracking-wider border-b border-slate-100">
                                        <th className="px-6 py-4">Payroll Month</th>
                                        <th className="px-6 py-4">Status</th>
                                        <th className="px-6 py-4">Initialized On</th>
                                        <th className="px-6 py-4 text-center">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                                    {runs.map((run) => (
                                        <tr key={run._id} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="px-6 py-4 text-slate-950 font-bold text-base">
                                                {formatMonthName(run.month)}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2.5 py-0.5 border rounded-full text-[10px] font-black uppercase tracking-wider ${getStatusBadge(run.status)}`}>
                                                    {run.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-slate-500">
                                                {formatDate(run.createdAt)}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center justify-center">
                                                    <button
                                                        onClick={() => fetchRunDetails(run._id)}
                                                        className="flex items-center gap-1.5 px-4 py-2 bg-primary-50 text-primary-700 hover:bg-primary-600 hover:text-white transition-all text-xs font-black rounded-xl"
                                                    >
                                                        <MdVisibility size={14} />
                                                        Manage
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Create Run Modal */}
                <Modal
                    isOpen={isCreateModalOpen}
                    onClose={() => setIsCreateModalOpen(false)}
                    title="Initialize Payroll Month"
                    maxWidth="max-w-md"
                >
                                <form onSubmit={handleCreateRun} className="space-y-4">
                                    <div>
                                        <label className={labelClass}>Select Payroll Month *</label>
                                        <input
                                            type="month"
                                            required
                                            value={newMonth}
                                            onChange={(e) => setNewMonth(e.target.value)}
                                            className={inputClass}
                                        />
                                        {createRunError && (
                                            <p className="mt-2 text-xs font-bold text-rose-600">
                                                {createRunError}
                                            </p>
                                        )}
                                    </div>
                                    <div className="pt-4 flex justify-end gap-3 border-t border-slate-50">
                                        <button
                                            type="button"
                                            onClick={() => setIsCreateModalOpen(false)}
                                            className="px-5 py-2 border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 text-sm"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            className="px-5 py-2 bg-primary-600 text-white font-bold rounded-xl hover:bg-primary-700 text-sm shadow-lg shadow-primary-600/20"
                                        >
                                            Create Batch
                                        </button>
                                    </div>
                                </form>
                </Modal>
            </div>
        );
    }

    // Calculations of Payout Summary
    const summaries = runDetails?.summaries || [];
    const run = runDetails?.run || {};

    const totals = summaries.reduce((acc, curr) => {
        const val = curr.calculatedValues || {};
        acc.gross += val.grossSalary || 0;
        acc.deduction += val.totalDeduction || 0;
        acc.net += val.netSalary || 0;
        return acc;
    }, { gross: 0, deduction: 0, net: 0 });

    const isLocked = run.status === 'locked';
    const isApproved = run.status === 'approved';

    return (
        <div className="space-y-6">
            {/* Header Details */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => {
                            setActiveRunId(null);
                            setRunDetails(null);
                            fetchRuns();
                        }}
                        className="p-2.5 border border-slate-200 text-slate-500 hover:bg-slate-50 transition-all rounded-xl"
                    >
                        <MdChevronLeft size={20} />
                    </button>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                                Payroll Month: {formatMonthName(run.month)}
                            </h1>
                            <span className={`px-2.5 py-0.5 border rounded-full text-[10px] font-black uppercase tracking-wider ${getStatusBadge(run.status)}`}>
                                {run.status}
                            </span>
                        </div>
                        <p className="text-slate-500 font-medium">Manage adjustments, run system calculations and issue payout locks.</p>
                    </div>
                </div>

                <div className="flex flex-wrap gap-2.5">
                    {!isLocked && (
                        <button
                            onClick={handleRecalculate}
                            disabled={loading}
                            className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-all text-sm"
                        >
                            <MdRefresh size={18} />
                            Recalculate
                        </button>
                    )}
                    {run.status === 'draft' && (
                        <button
                            onClick={handleApprove}
                            disabled={loading}
                            className="flex items-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition-all text-sm shadow-lg shadow-emerald-600/20"
                        >
                            <MdCheckCircle size={18} />
                            Approve Register
                        </button>
                    )}
                    {isApproved && (
                        <button
                            onClick={handleLock}
                            disabled={loading}
                            className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold transition-all text-sm shadow-lg shadow-slate-900/20"
                        >
                            <MdLock size={18} />
                            Lock Month Run
                        </button>
                    )}
                </div>
            </div>

            {/* Run Totals Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-slate-50 border border-slate-100 p-6 rounded-3xl">
                <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Total Gross Salary</p>
                    <h3 className="text-2xl font-black text-slate-900">₹{totals.gross.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</h3>
                </div>
                <div className="border-t md:border-t-0 md:border-l border-slate-200/60 pt-4 md:pt-0 md:pl-6">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Total Deductions</p>
                    <h3 className="text-2xl font-black text-slate-900">₹{totals.deduction.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</h3>
                </div>
                <div className="border-t md:border-t-0 md:border-l border-slate-200/60 pt-4 md:pt-0 md:pl-6">
                    <p className="text-xs font-bold text-teal-600 uppercase tracking-wide">Net Salary Payout</p>
                    <h3 className="text-2xl font-black text-teal-600">₹{totals.net.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</h3>
                </div>
            </div>

            {/* Employee Summary Register */}
            <div className="bg-white border border-slate-100 shadow-sm rounded-3xl overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="animate-spin rounded-full h-8 w-8 border-4 border-primary-500 border-t-transparent"></div>
                    </div>
                ) : summaries.length === 0 ? (
                    <div className="p-16 text-center text-slate-400 font-bold">
                        No employee summaries populated for this run.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50/70 text-slate-400 font-bold text-xs uppercase tracking-wider border-b border-slate-100">
                                    <th className="px-6 py-4">Employee</th>
                                    <th className="px-6 py-4">Designation</th>
                                    <th className="px-6 py-4">Gross Salary</th>
                                    <th className="px-6 py-4">Deductions</th>
                                    <th className="px-6 py-4">Net Salary</th>
                                    {!isLocked && <th className="px-6 py-4 text-center">Adjustments</th>}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                                {summaries.map((sum) => (
                                    <tr key={sum._id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-6 py-4">
                                            <p className="text-slate-950 font-bold">{sum.basicDetails?.name}</p>
                                            <p className="text-xs text-slate-400">{sum.basicDetails?.department}</p>
                                        </td>
                                        <td className="px-6 py-4 text-slate-700 text-sm">
                                            {sum.basicDetails?.designation || 'N/A'}
                                        </td>
                                        <td className="px-6 py-4 text-sm">
                                            ₹{(sum.calculatedValues?.grossSalary || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-rose-600">
                                            ₹{(sum.calculatedValues?.totalDeduction || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-teal-600 font-bold">
                                            ₹{(sum.calculatedValues?.netSalary || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                        </td>
                                        {!isLocked && (
                                            <td className="px-6 py-4 text-center">
                                                <button
                                                    onClick={() => handleOpenAdjust(sum)}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-primary-600 hover:text-white transition-all text-xs font-bold rounded-xl mx-auto"
                                                >
                                                    <MdEdit size={14} />
                                                    Adjust
                                                </button>
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Adjustments Modal */}
            <Modal
                isOpen={isAdjustModalOpen}
                onClose={() => setIsAdjustModalOpen(false)}
                title={`Add Manual Adjustments${selectedSummary?.basicDetails?.name ? `: ${selectedSummary.basicDetails.name}` : ''}`}
                maxWidth="max-w-2xl"
            >
                            <form onSubmit={handleSaveAdjust} className="space-y-6">
                                {/* Earnings Adjustments */}
                                <div>
                                    <h4 className="text-xs font-black text-emerald-600 uppercase tracking-widest mb-4 border-b border-slate-50 pb-1.5">Earnings Allowances</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                        <div>
                                            <label className={labelClass}>Manual Bonus</label>
                                            <input
                                                type="number"
                                                value={adjustForm.bonus}
                                                onChange={(e) => setAdjustForm({ ...adjustForm, bonus: e.target.value })}
                                                className={inputClass}
                                            />
                                        </div>
                                        <div>
                                            <label className={labelClass}>Incentives</label>
                                            <input
                                                type="number"
                                                value={adjustForm.incentive}
                                                onChange={(e) => setAdjustForm({ ...adjustForm, incentive: e.target.value })}
                                                className={inputClass}
                                            />
                                        </div>
                                        <div>
                                            <label className={labelClass}>Arrears</label>
                                            <input
                                                type="number"
                                                value={adjustForm.arrears}
                                                onChange={(e) => setAdjustForm({ ...adjustForm, arrears: e.target.value })}
                                                className={inputClass}
                                            />
                                        </div>
                                        <div>
                                            <label className={labelClass}>Reimbursement</label>
                                            <input
                                                type="number"
                                                value={adjustForm.reimbursement}
                                                onChange={(e) => setAdjustForm({ ...adjustForm, reimbursement: e.target.value })}
                                                className={inputClass}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Deductions Adjustments */}
                                <div>
                                    <h4 className="text-xs font-black text-rose-600 uppercase tracking-widest mb-4 border-b border-slate-50 pb-1.5">Manual Deductions</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                        <div>
                                            <label className={labelClass}>Loan Deduct</label>
                                            <input
                                                type="number"
                                                value={adjustForm.loanDeduction}
                                                onChange={(e) => setAdjustForm({ ...adjustForm, loanDeduction: e.target.value })}
                                                className={inputClass}
                                            />
                                        </div>
                                        <div>
                                            <label className={labelClass}>Advance Deduct</label>
                                            <input
                                                type="number"
                                                value={adjustForm.advanceDeduction}
                                                onChange={(e) => setAdjustForm({ ...adjustForm, advanceDeduction: e.target.value })}
                                                className={inputClass}
                                            />
                                        </div>
                                        <div>
                                            <label className={labelClass}>Unpaid Leaves</label>
                                            <input
                                                type="number"
                                                value={adjustForm.unpaidLeaveDeduction}
                                                onChange={(e) => setAdjustForm({ ...adjustForm, unpaidLeaveDeduction: e.target.value })}
                                                className={inputClass}
                                            />
                                        </div>
                                        <div>
                                            <label className={labelClass}>Other Deduct</label>
                                            <input
                                                type="number"
                                                value={adjustForm.otherDeduction}
                                                onChange={(e) => setAdjustForm({ ...adjustForm, otherDeduction: e.target.value })}
                                                className={inputClass}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-4 flex justify-end gap-3 border-t border-slate-50">
                                    <button
                                        type="button"
                                        onClick={() => setIsAdjustModalOpen(false)}
                                        className="px-5 py-2.5 border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 text-sm"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-6 py-2.5 bg-primary-600 text-white font-bold rounded-xl hover:bg-primary-700 text-sm shadow-lg shadow-primary-600/20"
                                    >
                                        Apply Adjustments
                                    </button>
                                </div>
                            </form>
            </Modal>

            {/* Confirm Modal */}
            <Modal
                isOpen={confirmModal.isOpen}
                onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
                title={confirmModal.title}
                maxWidth="max-w-md"
            >
                <div className="space-y-6">
                    <p className="text-slate-650 font-medium leading-relaxed">
                        {confirmModal.message}
                    </p>
                    <div className="flex justify-end gap-3 pt-4 border-t border-slate-50">
                        <button
                            type="button"
                            onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })}
                            className="px-5 py-2.5 border border-slate-200 text-slate-650 font-bold rounded-xl hover:bg-slate-50 text-sm"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                if (confirmModal.onConfirm) confirmModal.onConfirm();
                                setConfirmModal({ ...confirmModal, isOpen: false });
                            }}
                            className="px-5 py-2.5 bg-primary-600 text-white font-bold rounded-xl hover:bg-primary-700 text-sm shadow-lg shadow-primary-600/20"
                        >
                            Confirm
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default PayrollRuns;
