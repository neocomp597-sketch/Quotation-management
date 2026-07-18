import React, { useState, useEffect } from 'react';
import { payrollService } from '../services/api';
import { toast } from 'react-toastify';
import Modal from '../components/Modal';
import { 
    MdPayment, MdCheckCircle, MdEdit, 
    MdSave, MdHourglassEmpty, MdVisibility
} from 'react-icons/md';

const PayrollPayments = () => {
    const [runs, setRuns] = useState([]);
    const [selectedMonth, setSelectedMonth] = useState('');
    const [selectedRunId, setSelectedRunId] = useState('');
    const [summaries, setSummaries] = useState([]);
    const [loading, setLoading] = useState(false);

    // Modal state for recording payment
    const [isPayModalOpen, setIsPayModalOpen] = useState(false);
    const [selectedSummary, setSelectedSummary] = useState(null);
    const [payForm, setPayForm] = useState({
        status: 'paid',
        paymentMode: 'bank',
        paymentDate: '',
        transactionRef: '',
        receivedConfirmation: false
    });

    const fetchRuns = async () => {
        try {
            setLoading(true);
            const res = await payrollService.getRuns();
            const completedRuns = (res.data || []).filter(r => ['approved', 'locked'].includes(r.status));
            setRuns(completedRuns);
            if (completedRuns.length > 0) {
                setSelectedMonth(completedRuns[0].month);
                setSelectedRunId(completedRuns[0]._id);
            }
        } catch (error) {
            console.error('Failed to fetch runs', error);
            toast.error('Failed to load payroll months');
        } finally {
            setLoading(false);
        }
    };

    const fetchPayments = async (runId) => {
        if (!runId) return;
        try {
            setLoading(true);
            const res = await payrollService.getRunDetails(runId);
            setSummaries(res.data.summaries || []);
        } catch (error) {
            console.error('Failed to load payments details', error);
            toast.error('Failed to load employee payout lists');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRuns();
    }, []);

    useEffect(() => {
        if (selectedRunId) {
            fetchPayments(selectedRunId);
        }
    }, [selectedRunId]);

    const handleMonthChange = (e) => {
        const monthVal = e.target.value;
        setSelectedMonth(monthVal);
        const matchedRun = runs.find(r => r.month === monthVal);
        if (matchedRun) {
            setSelectedRunId(matchedRun._id);
        }
    };

    const handleOpenPay = (sum) => {
        setSelectedSummary(sum);
        const pay = sum.paymentDetails || {};
        setPayForm({
            status: pay.status || 'paid',
            paymentMode: pay.paymentMode || 'bank',
            paymentDate: pay.paymentDate ? new Date(pay.paymentDate).toISOString().substring(0, 10) : new Date().toISOString().substring(0, 10),
            transactionRef: pay.transactionRef || '',
            receivedConfirmation: pay.receivedConfirmation !== undefined ? Boolean(pay.receivedConfirmation) : false
        });
        setIsPayModalOpen(true);
    };

    const handleSavePay = async (e) => {
        e.preventDefault();
        try {
            await payrollService.updatePaymentDetails(selectedRunId, selectedSummary._id, { paymentDetails: payForm });
            toast.success(`Payment details recorded for ${selectedSummary.basicDetails?.name}!`);
            setIsPayModalOpen(false);
            fetchPayments(selectedRunId);
        } catch (error) {
            console.error('Save payments details error', error);
            toast.error(error.response?.data?.message || 'Failed to save payment details');
        }
    };

    const formatMonthName = (monthStr) => {
        if (!monthStr) return '';
        const [year, month] = monthStr.split('-');
        const date = new Date(year, parseInt(month) - 1, 1);
        return date.toLocaleString('en-US', { month: 'long', year: 'numeric' });
    };

    const getPaymentBadge = (status) => {
        switch (status) {
            case 'paid':
                return 'bg-emerald-50 text-emerald-700 border-emerald-100';
            default:
                return 'bg-amber-50 text-amber-700 border-amber-100';
        }
    };

    const inputClass = "w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all";
    const labelClass = "block text-xs font-bold text-slate-400 uppercase mb-1.5";

    // Dashboard count
    const totals = summaries.reduce((acc, curr) => {
        const net = curr.calculatedValues?.netSalary || 0;
        const isPaid = curr.paymentDetails?.status === 'paid';
        if (isPaid) {
            acc.paid += net;
            acc.paidCount += 1;
        } else {
            acc.pending += net;
            acc.pendingCount += 1;
        }
        return acc;
    }, { paid: 0, paidCount: 0, pending: 0, pendingCount: 0 });

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">Payments Manager</h1>
                    <p className="text-slate-500 font-medium">Record salary payouts, specify bank/UPI references, and trace payment confirmations.</p>
                </div>

                {runs.length > 0 && (
                    <div className="w-full md:w-56">
                        <select
                            value={selectedMonth}
                            onChange={handleMonthChange}
                            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary-500 transition-all font-bold text-slate-700"
                        >
                            {runs.map(r => (
                                <option key={r._id} value={r.month}>
                                    {formatMonthName(r.month)} ({r.status})
                                </option>
                            ))}
                        </select>
                    </div>
                )}
            </div>

            {runs.length === 0 ? (
                <div className="bg-white p-16 text-center border border-slate-100 shadow-sm rounded-3xl font-bold text-slate-400">
                    No approved or locked payroll months found. Run and approve a payroll month run first!
                </div>
            ) : (
                <>
                    {/* Totals Summary */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 p-6 rounded-3xl border border-slate-100">
                        <div>
                            <p className="text-xs font-bold text-emerald-600 uppercase tracking-wide">Paid Salary ({totals.paidCount} Employees)</p>
                            <h3 className="text-2xl font-black text-emerald-600">₹{totals.paid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</h3>
                        </div>
                        <div className="border-t md:border-t-0 md:border-l border-slate-200 pt-4 md:pt-0 md:pl-6">
                            <p className="text-xs font-bold text-amber-600 uppercase tracking-wide">Pending Payout ({totals.pendingCount} Employees)</p>
                            <h3 className="text-2xl font-black text-amber-600">₹{totals.pending.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</h3>
                        </div>
                    </div>

                    {/* Payments Slips Table */}
                    <div className="bg-white border border-slate-100 shadow-sm rounded-3xl overflow-hidden">
                        {loading ? (
                            <div className="flex items-center justify-center py-20">
                                <div className="animate-spin rounded-full h-8 w-8 border-4 border-primary-500 border-t-transparent"></div>
                            </div>
                        ) : summaries.length === 0 ? (
                            <div className="p-16 text-center text-slate-400 font-bold">
                                No employees found.
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50/70 text-slate-400 font-bold text-xs uppercase tracking-wider border-b border-slate-100">
                                            <th className="px-6 py-4">Employee Details</th>
                                            <th className="px-6 py-4">Net Salary</th>
                                            <th className="px-6 py-4">Status</th>
                                            <th className="px-6 py-4">Payment Mode</th>
                                            <th className="px-6 py-4">Transaction / Ref</th>
                                            <th className="px-6 py-4 text-center">Confirm</th>
                                            <th className="px-6 py-4 text-center">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                                        {summaries.map((sum) => {
                                            const pay = sum.paymentDetails || {};
                                            return (
                                                <tr key={sum._id} className="hover:bg-slate-50/50 transition-colors">
                                                    <td className="px-6 py-4">
                                                        <p className="text-slate-900 font-bold">{sum.basicDetails?.name}</p>
                                                        <p className="text-xs text-slate-400">
                                                            {sum.basicDetails?.bankName} ({sum.basicDetails?.accountNumber})
                                                        </p>
                                                    </td>
                                                    <td className="px-6 py-4 text-sm text-slate-900">
                                                        ₹{(sum.calculatedValues?.netSalary || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className={`px-2.5 py-0.5 border rounded-full text-[10px] font-black uppercase tracking-wider ${getPaymentBadge(pay.status)}`}>
                                                            {pay.status || 'pending'}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-sm text-slate-500 uppercase">
                                                        {pay.paymentMode || '-'}
                                                    </td>
                                                    <td className="px-6 py-4 text-sm text-slate-500">
                                                        {pay.transactionRef || '-'}
                                                    </td>
                                                    <td className="px-6 py-4 text-center">
                                                        {pay.receivedConfirmation ? (
                                                            <span className="text-xs text-emerald-600 font-black flex items-center justify-center gap-1">
                                                                <MdCheckCircle size={14} /> Confirmed
                                                            </span>
                                                        ) : (
                                                            <span className="text-xs text-slate-400 font-black flex items-center justify-center gap-1">
                                                                <MdHourglassEmpty size={14} /> Unconfirmed
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4 text-center">
                                                        <button
                                                            onClick={() => handleOpenPay(sum)}
                                                            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-primary-600 hover:text-white transition-all text-xs font-bold rounded-xl mx-auto"
                                                        >
                                                            <MdEdit size={14} />
                                                            Record Payout
                                                        </button>
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
            )}

            {/* Record Payout Modal */}
            <Modal
                isOpen={isPayModalOpen}
                onClose={() => setIsPayModalOpen(false)}
                title={`Record Salary Payment${selectedSummary?.basicDetails?.name ? `: ${selectedSummary.basicDetails.name}` : ''}`}
                maxWidth="max-w-md"
            >
                            <form onSubmit={handleSavePay} className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className={labelClass}>Payment Status</label>
                                        <select
                                            value={payForm.status}
                                            onChange={(e) => setPayForm({ ...payForm, status: e.target.value })}
                                            className={inputClass}
                                        >
                                            <option value="pending">Pending</option>
                                            <option value="paid">Paid</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className={labelClass}>Payment Mode</label>
                                        <select
                                            value={payForm.paymentMode}
                                            onChange={(e) => setPayForm({ ...payForm, paymentMode: e.target.value })}
                                            className={inputClass}
                                        >
                                            <option value="bank">Bank Transfer</option>
                                            <option value="upi">UPI / Net Banking</option>
                                            <option value="cash">Cash Payment</option>
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className={labelClass}>Payment Date</label>
                                    <input
                                        type="date"
                                        required
                                        value={payForm.paymentDate}
                                        onChange={(e) => setPayForm({ ...payForm, paymentDate: e.target.value })}
                                        className={inputClass}
                                    />
                                </div>

                                <div>
                                    <label className={labelClass}>Transaction / Reference ID</label>
                                    <input
                                        type="text"
                                        value={payForm.transactionRef}
                                        onChange={(e) => setPayForm({ ...payForm, transactionRef: e.target.value })}
                                        className={inputClass}
                                        placeholder="e.g. TXN123456789"
                                    />
                                </div>

                                <div className="flex items-center gap-2.5 py-2">
                                    <input
                                        type="checkbox"
                                        id="receivedConfirmation"
                                        checked={payForm.receivedConfirmation}
                                        onChange={(e) => setPayForm({ ...payForm, receivedConfirmation: e.target.checked })}
                                        className="w-5 h-5 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                                    />
                                    <label htmlFor="receivedConfirmation" className="text-sm font-bold text-slate-600 select-none">
                                        Received Employee Confirmation
                                    </label>
                                </div>

                                <div className="pt-4 flex justify-end gap-3 border-t border-slate-50">
                                    <button
                                        type="button"
                                        onClick={() => setIsPayModalOpen(false)}
                                        className="px-5 py-2.5 border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 text-sm"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-6 py-2.5 bg-primary-600 text-white font-bold rounded-xl hover:bg-primary-700 text-sm shadow-lg shadow-primary-600/20"
                                    >
                                        <MdSave size={18} />
                                        Save Payout
                                    </button>
                                </div>
                            </form>
            </Modal>
        </div>
    );
};

export default PayrollPayments;
