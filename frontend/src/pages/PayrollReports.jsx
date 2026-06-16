import React, { useState, useEffect } from 'react';
import { payrollService } from '../services/api';
import { toast } from 'react-toastify';
import * as XLSX from 'xlsx';
import { formatDate } from '../utils/helpers';
import { 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, 
    ResponsiveContainer, PieChart, Pie, Cell 
} from 'recharts';
import { 
    MdBarChart, MdDownload, MdCalendarMonth, 
    MdPeople, MdShowChart, MdAttachMoney,
    MdTrendingUp, MdPayment, MdCategory, MdInfo 
} from 'react-icons/md';

const COLORS = ['#0f766e', '#14b8a6', '#0d9488', '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899'];

const PayrollReports = () => {
    const [reportType, setReportType] = useState('monthly-register');
    const [runs, setRuns] = useState([]);
    const [selectedMonth, setSelectedMonth] = useState('');
    const [employees, setEmployees] = useState([]);
    const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
    const [reportData, setReportData] = useState(null);
    const [loading, setLoading] = useState(false);

    const fetchDropdowns = async () => {
        try {
            const [runsRes, empRes] = await Promise.all([
                payrollService.getRuns(),
                payrollService.getEmployees()
            ]);
            
            const completedRuns = (runsRes.data || []).filter(r => ['approved', 'locked'].includes(r.status));
            setRuns(completedRuns);
            if (completedRuns.length > 0) {
                setSelectedMonth(completedRuns[0].month);
            }

            setEmployees(empRes.data || []);
            if (empRes.data?.length > 0) {
                setSelectedEmployeeId(empRes.data[0]._id);
            }
        } catch (error) {
            console.error('Failed to load initial dropdowns', error);
        }
    };

    useEffect(() => {
        fetchDropdowns();
    }, []);

    const fetchReportData = async () => {
        const queryParams = { type: reportType };
        if (reportType === 'employee-history') {
            if (!selectedEmployeeId) return;
            queryParams.employeeId = selectedEmployeeId;
        } else {
            if (!selectedMonth) return;
            queryParams.month = selectedMonth;
        }

        try {
            setLoading(true);
            const res = await payrollService.getReports(queryParams);
            setReportData(res.data);
        } catch (error) {
            console.error('Failed to load report', error);
            toast.error('Failed to load report data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (selectedMonth || selectedEmployeeId) {
            fetchReportData();
        }
    }, [reportType, selectedMonth, selectedEmployeeId]);

    const handleExportExcel = () => {
        if (!reportData) return;
        let exportData = [];
        let fileName = `${reportType}-${selectedMonth || selectedEmployeeId}`;

        if (reportType === 'monthly-register') {
            exportData = reportData.map(item => ({
                'Employee Name': item.basicDetails?.name,
                'Email': item.basicDetails?.email,
                'Department': item.basicDetails?.department,
                'Designation': item.basicDetails?.designation,
                'Gross Salary (INR)': item.calculatedValues?.grossSalary,
                'Total Deductions (INR)': item.calculatedValues?.totalDeduction,
                'Net Salary Payout (INR)': item.calculatedValues?.netSalary,
                'Payment Status': item.paymentDetails?.status
            }));
        } else if (reportType === 'employee-history') {
            exportData = reportData.map(item => ({
                'Payroll Month': item.month,
                'Gross Salary (INR)': item.calculatedValues?.grossSalary,
                'Total Deductions (INR)': item.calculatedValues?.totalDeduction,
                'Net Salary Payout (INR)': item.calculatedValues?.netSalary,
                'Payment Mode': item.paymentDetails?.paymentMode,
                'Transaction ID': item.paymentDetails?.transactionRef,
                'Payment Date': item.paymentDetails?.paymentDate ? formatDate(item.paymentDetails.paymentDate) : '-'
            }));
        } else if (['deductions', 'adjustments', 'loans-advances'].includes(reportType)) {
            const list = reportData.register || [];
            exportData = list.map(item => {
                const row = {
                    'Employee Name': item.basicDetails?.name,
                    'Department': item.basicDetails?.department
                };
                if (reportType === 'deductions') {
                    row['Provident Fund (PF)'] = item.calculatedValues?.pf;
                    row['Employee State Insurance (ESI)'] = item.calculatedValues?.esi;
                    row['Professional Tax (PT)'] = item.calculatedValues?.pt;
                    row['Income Tax (TDS)'] = item.calculatedValues?.tds;
                    row['Total Deductions'] = item.calculatedValues?.totalDeduction;
                } else if (reportType === 'adjustments') {
                    row['Manual Bonus'] = item.adjustments?.bonus;
                    row['Incentives'] = item.adjustments?.incentive;
                    row['Arrears'] = item.adjustments?.arrears;
                    row['Reimbursements'] = item.adjustments?.reimbursement;
                    row['Total Allowances'] = (item.adjustments?.bonus || 0) + (item.adjustments?.incentive || 0) + (item.adjustments?.arrears || 0) + (item.adjustments?.reimbursement || 0);
                } else if (reportType === 'loans-advances') {
                    row['Loan Deduction'] = item.adjustments?.loanDeduction;
                    row['Advance Deduct'] = item.adjustments?.advanceDeduction;
                    row['Unpaid Leaves'] = item.adjustments?.unpaidLeaveDeduction;
                    row['Total Payout Deductions'] = (item.adjustments?.loanDeduction || 0) + (item.adjustments?.advanceDeduction || 0) + (item.adjustments?.unpaidLeaveDeduction || 0);
                }
                return row;
            });
        } else if (reportType === 'department-wise') {
            exportData = reportData.map(item => ({
                'Department': item.department,
                'Employee Count': item.count,
                'Total Gross (INR)': item.gross,
                'Total Deductions (INR)': item.deduction,
                'Total Net Payout (INR)': item.net
            }));
        } else if (reportType === 'payments') {
            const list = reportData.payments || [];
            exportData = list.map(item => ({
                'Employee Name': item.basicDetails?.name,
                'Net Salary (INR)': item.calculatedValues?.netSalary,
                'Status': item.paymentDetails?.status,
                'Payment Mode': item.paymentDetails?.paymentMode,
                'Transaction Reference': item.paymentDetails?.transactionRef,
                'Date of Payout': item.paymentDetails?.paymentDate ? formatDate(item.paymentDetails.paymentDate) : '-'
            }));
        }

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
        XLSX.writeFile(wb, `${fileName}.xlsx`);
        toast.success('Excel spreadsheet generated and downloaded!');
    };

    const formatMonthName = (monthStr) => {
        if (!monthStr) return '';
        const [year, month] = monthStr.split('-');
        const date = new Date(year, parseInt(month) - 1, 1);
        return date.toLocaleString('en-US', { month: 'long', year: 'numeric' });
    };

    const inputClass = "w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-bold focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all";
    const labelClass = "block text-xs font-bold text-slate-400 uppercase mb-1.5";

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">Payroll Reports</h1>
                    <p className="text-slate-500 font-medium">Trace organizational salary payouts, trace deductions, and export Excel ledgers.</p>
                </div>

                {reportData && (
                    <button
                        onClick={handleExportExcel}
                        className="flex items-center justify-center gap-1.5 px-5 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-primary-600/20 text-sm"
                    >
                        <MdDownload size={18} />
                        Export to Excel
                    </button>
                )}
            </div>

            {/* Filter Bar */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                <div>
                    <label className={labelClass}>Report Type</label>
                    <select
                        value={reportType}
                        onChange={(e) => setReportType(e.target.value)}
                        className={inputClass}
                    >
                        <option value="monthly-register">Monthly Salary Register</option>
                        <option value="employee-history">Employee Salary Payout History</option>
                        <option value="deductions">Deduction Details (PF/ESI/PT/TDS)</option>
                        <option value="adjustments">Bonus & Incentives Ledger</option>
                        <option value="loans-advances">Loans & Advances Paybacks</option>
                        <option value="department-wise">Department Salary Allocation</option>
                        <option value="payments">Paid vs Pending Status</option>
                    </select>
                </div>

                {reportType === 'employee-history' ? (
                    <div>
                        <label className={labelClass}>Select Employee</label>
                        <select
                            value={selectedEmployeeId}
                            onChange={(e) => setSelectedEmployeeId(e.target.value)}
                            className={inputClass}
                        >
                            {employees.map(e => (
                                <option key={e._id} value={e._id}>{e.name} ({e.designation})</option>
                            ))}
                        </select>
                    </div>
                ) : (
                    <div>
                        <label className={labelClass}>Select Month</label>
                        {runs.length === 0 ? (
                            <select disabled className={`${inputClass} text-slate-400 font-bold`}>
                                <option>No locked payroll runs found</option>
                            </select>
                        ) : (
                            <select
                                value={selectedMonth}
                                onChange={(e) => setSelectedMonth(e.target.value)}
                                className={inputClass}
                            >
                                {runs.map(r => (
                                    <option key={r._id} value={r.month}>{formatMonthName(r.month)}</option>
                                ))}
                            </select>
                        )}
                    </div>
                )}
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-20 bg-white border border-slate-100 rounded-3xl">
                    <div className="animate-spin rounded-full h-8 w-8 border-4 border-primary-500 border-t-transparent"></div>
                </div>
            ) : !reportData ? (
                <div className="bg-white p-16 text-center border border-slate-100 shadow-sm rounded-3xl font-bold text-slate-400">
                    {runs.length === 0 && reportType !== 'employee-history'
                        ? 'Generate, approve, and lock monthly runs first to access these reports.'
                        : 'No report data loaded.'}
                </div>
            ) : (
                <div className="space-y-6">
                    {/* Visual Charts */}
                    {reportType === 'employee-history' && reportData.length > 0 && (
                        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                            <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
                                <MdTrendingUp size={20} className="text-teal-600" />
                                Salary Trend Over Time (Net Payout)
                            </h3>
                            <div className="h-72">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={reportData.map(d => ({ month: formatMonthName(d.month), NetSalary: d.calculatedValues?.netSalary || 0 }))}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                        <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 10, fontWeight: 'bold' }} />
                                        <YAxis tick={{ fill: '#64748b', fontSize: 10, fontWeight: 'bold' }} />
                                        <Tooltip />
                                        <Legend />
                                        <Bar dataKey="NetSalary" fill="#0f766e" radius={[4, 4, 0, 0]} name="Net Salary (INR)" />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    )}

                    {reportType === 'department-wise' && reportData.length > 0 && (
                        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="md:col-span-2">
                                <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
                                    <MdCategory size={20} className="text-teal-600" />
                                    Department-wise Salary Allocation
                                </h3>
                                <div className="h-72">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={reportData}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                            <XAxis dataKey="department" tick={{ fill: '#64748b', fontSize: 10, fontWeight: 'bold' }} />
                                            <YAxis tick={{ fill: '#64748b', fontSize: 10, fontWeight: 'bold' }} />
                                            <Tooltip />
                                            <Legend />
                                            <Bar dataKey="net" fill="#14b8a6" radius={[4, 4, 0, 0]} name="Net Salary Payout (INR)" />
                                            <Bar dataKey="gross" fill="#0f766e" radius={[4, 4, 0, 0]} name="Gross Salary (INR)" />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            <div className="md:col-span-1 flex flex-col items-center justify-center">
                                <h4 className="text-sm font-bold text-slate-500 mb-4">Allocation Percentage</h4>
                                <div className="h-48 w-full flex items-center justify-center">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={reportData}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={60}
                                                outerRadius={80}
                                                paddingAngle={5}
                                                dataKey="net"
                                                nameKey="department"
                                            >
                                                {reportData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <Tooltip formatter={(value) => `₹${value.toLocaleString()}`} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                                <div className="flex flex-wrap gap-x-4 gap-y-2 justify-center mt-2">
                                    {reportData.map((d, i) => (
                                        <div key={i} className="flex items-center gap-1.5 text-xs font-bold text-slate-500">
                                            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                                            <span>{d.department}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Data Registers / Tables */}
                    <div className="bg-white border border-slate-100 shadow-sm rounded-3xl overflow-hidden">
                        {reportType === 'monthly-register' && (
                            <table className="w-full text-left border-collapse font-semibold text-slate-700">
                                <thead className="bg-slate-50/70 text-slate-400 font-bold text-xs uppercase border-b border-slate-100">
                                    <tr>
                                        <th className="px-6 py-4">Employee Details</th>
                                        <th className="px-6 py-4">Department / Designation</th>
                                        <th className="px-6 py-4">Gross Salary</th>
                                        <th className="px-6 py-4">Total Deductions</th>
                                        <th className="px-6 py-4">Net Payout</th>
                                        <th className="px-6 py-4">Payout Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {reportData.map((item, idx) => (
                                        <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="px-6 py-4">
                                                <p className="text-slate-900 font-bold">{item.basicDetails?.name}</p>
                                                <p className="text-xs text-slate-400">{item.basicDetails?.email || '-'}</p>
                                            </td>
                                            <td className="px-6 py-4">
                                                <p className="text-slate-800">{item.basicDetails?.designation || 'N/A'}</p>
                                                <p className="text-xs text-slate-400">{item.basicDetails?.department || 'N/A'}</p>
                                            </td>
                                            <td className="px-6 py-4 text-sm">₹{(item.calculatedValues?.grossSalary || 0).toLocaleString('en-IN')}</td>
                                            <td className="px-6 py-4 text-sm text-rose-600">₹{(item.calculatedValues?.totalDeduction || 0).toLocaleString('en-IN')}</td>
                                            <td className="px-6 py-4 text-sm text-teal-600 font-bold">₹{(item.calculatedValues?.netSalary || 0).toLocaleString('en-IN')}</td>
                                            <td className="px-6 py-4 text-xs font-bold uppercase tracking-wider">
                                                <span className={`px-2.5 py-0.5 rounded-full ${item.paymentDetails?.status === 'paid' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                                                    {item.paymentDetails?.status || 'pending'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}

                        {reportType === 'employee-history' && (
                            <table className="w-full text-left border-collapse font-semibold text-slate-700">
                                <thead className="bg-slate-50/70 text-slate-400 font-bold text-xs uppercase border-b border-slate-100">
                                    <tr>
                                        <th className="px-6 py-4">Month</th>
                                        <th className="px-6 py-4">Gross Salary</th>
                                        <th className="px-6 py-4">Deductions</th>
                                        <th className="px-6 py-4">Net Payout</th>
                                        <th className="px-6 py-4">Payment Method</th>
                                        <th className="px-6 py-4">Ref Number</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {reportData.map((item, idx) => (
                                        <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="px-6 py-4 font-bold text-slate-900">{formatMonthName(item.month)}</td>
                                            <td className="px-6 py-4 text-sm">₹{(item.calculatedValues?.grossSalary || 0).toLocaleString('en-IN')}</td>
                                            <td className="px-6 py-4 text-sm text-rose-600">₹{(item.calculatedValues?.totalDeduction || 0).toLocaleString('en-IN')}</td>
                                            <td className="px-6 py-4 text-sm text-teal-600 font-bold">₹{(item.calculatedValues?.netSalary || 0).toLocaleString('en-IN')}</td>
                                            <td className="px-6 py-4 text-sm text-slate-500 uppercase">{item.paymentDetails?.paymentMode || '-'}</td>
                                            <td className="px-6 py-4 text-sm text-slate-500">{item.paymentDetails?.transactionRef || '-'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}

                        {['deductions', 'adjustments', 'loans-advances'].includes(reportType) && (
                            <table className="w-full text-left border-collapse font-semibold text-slate-700">
                                <thead className="bg-slate-50/70 text-slate-400 font-bold text-xs uppercase border-b border-slate-100">
                                    <tr>
                                        <th className="px-6 py-4">Employee Details</th>
                                        {reportType === 'deductions' && (
                                            <>
                                                <th className="px-6 py-4">PF</th>
                                                <th className="px-6 py-4">ESI</th>
                                                <th className="px-6 py-4">PT</th>
                                                <th className="px-6 py-4">TDS (IT)</th>
                                                <th className="px-6 py-4 font-bold">Total Deduct</th>
                                            </>
                                        )}
                                        {reportType === 'adjustments' && (
                                            <>
                                                <th className="px-6 py-4">Manual Bonus</th>
                                                <th className="px-6 py-4">Incentives</th>
                                                <th className="px-6 py-4">Arrears</th>
                                                <th className="px-6 py-4">Reimbursements</th>
                                                <th className="px-6 py-4 font-bold">Total Allow</th>
                                            </>
                                        )}
                                        {reportType === 'loans-advances' && (
                                            <>
                                                <th className="px-6 py-4">Loan Payback</th>
                                                <th className="px-6 py-4">Advance Payback</th>
                                                <th className="px-6 py-4">Unpaid Leaves</th>
                                                <th className="px-6 py-4 font-bold">Total Deduct</th>
                                            </>
                                        )}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {(reportData.register || []).map((item, idx) => (
                                        <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="px-6 py-4 font-bold text-slate-900">
                                                <p>{item.basicDetails?.name}</p>
                                                <p className="text-xs text-slate-400">{item.basicDetails?.department}</p>
                                            </td>
                                            {reportType === 'deductions' && (
                                                <>
                                                    <td className="px-6 py-4 text-sm text-slate-500">₹{(item.calculatedValues?.pf || 0).toLocaleString('en-IN')}</td>
                                                    <td className="px-6 py-4 text-sm text-slate-500">₹{(item.calculatedValues?.esi || 0).toLocaleString('en-IN')}</td>
                                                    <td className="px-6 py-4 text-sm text-slate-500">₹{(item.calculatedValues?.pt || 0).toLocaleString('en-IN')}</td>
                                                    <td className="px-6 py-4 text-sm text-slate-500">₹{(item.calculatedValues?.tds || 0).toLocaleString('en-IN')}</td>
                                                    <td className="px-6 py-4 text-sm text-rose-600 font-bold">₹{(item.calculatedValues?.totalDeduction || 0).toLocaleString('en-IN')}</td>
                                                </>
                                            )}
                                            {reportType === 'adjustments' && (
                                                <>
                                                    <td className="px-6 py-4 text-sm text-slate-500">₹{(item.adjustments?.bonus || 0).toLocaleString('en-IN')}</td>
                                                    <td className="px-6 py-4 text-sm text-slate-500">₹{(item.adjustments?.incentive || 0).toLocaleString('en-IN')}</td>
                                                    <td className="px-6 py-4 text-sm text-slate-500">₹{(item.adjustments?.arrears || 0).toLocaleString('en-IN')}</td>
                                                    <td className="px-6 py-4 text-sm text-slate-500">₹{(item.adjustments?.reimbursement || 0).toLocaleString('en-IN')}</td>
                                                    <td className="px-6 py-4 text-sm text-teal-600 font-bold">
                                                        ₹{((item.adjustments?.bonus || 0) + (item.adjustments?.incentive || 0) + (item.adjustments?.arrears || 0) + (item.adjustments?.reimbursement || 0)).toLocaleString('en-IN')}
                                                    </td>
                                                </>
                                            )}
                                            {reportType === 'loans-advances' && (
                                                <>
                                                    <td className="px-6 py-4 text-sm text-slate-500">₹{(item.adjustments?.loanDeduction || 0).toLocaleString('en-IN')}</td>
                                                    <td className="px-6 py-4 text-sm text-slate-500">₹{(item.adjustments?.advanceDeduction || 0).toLocaleString('en-IN')}</td>
                                                    <td className="px-6 py-4 text-sm text-slate-500">₹{(item.adjustments?.unpaidLeaveDeduction || 0).toLocaleString('en-IN')}</td>
                                                    <td className="px-6 py-4 text-sm text-rose-600 font-bold">
                                                        ₹{((item.adjustments?.loanDeduction || 0) + (item.adjustments?.advanceDeduction || 0) + (item.adjustments?.unpaidLeaveDeduction || 0)).toLocaleString('en-IN')}
                                                    </td>
                                                </>
                                            )}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}

                        {reportType === 'department-wise' && (
                            <table className="w-full text-left border-collapse font-semibold text-slate-700">
                                <thead className="bg-slate-50/70 text-slate-400 font-bold text-xs uppercase border-b border-slate-100">
                                    <tr>
                                        <th className="px-6 py-4">Department</th>
                                        <th className="px-6 py-4 text-center">Employees</th>
                                        <th className="px-6 py-4">Total Gross</th>
                                        <th className="px-6 py-4">Total Deductions</th>
                                        <th className="px-6 py-4">Net Payout</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {reportData.map((item, idx) => (
                                        <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="px-6 py-4 font-bold text-slate-900">{item.department}</td>
                                            <td className="px-6 py-4 text-center text-sm text-slate-650">{item.count}</td>
                                            <td className="px-6 py-4 text-sm">₹{(item.gross || 0).toLocaleString('en-IN')}</td>
                                            <td className="px-6 py-4 text-sm text-rose-600">₹{(item.deduction || 0).toLocaleString('en-IN')}</td>
                                            <td className="px-6 py-4 text-sm text-teal-600 font-bold">₹{(item.net || 0).toLocaleString('en-IN')}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}

                        {reportType === 'payments' && (
                            <table className="w-full text-left border-collapse font-semibold text-slate-700">
                                <thead className="bg-slate-50/70 text-slate-400 font-bold text-xs uppercase border-b border-slate-100">
                                    <tr>
                                        <th className="px-6 py-4">Employee</th>
                                        <th className="px-6 py-4">Net Salary</th>
                                        <th className="px-6 py-4">Payment Status</th>
                                        <th className="px-6 py-4">Payment Mode</th>
                                        <th className="px-6 py-4">Transaction / Ref</th>
                                        <th className="px-6 py-4">Payment Date</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {(reportData.payments || []).map((item, idx) => (
                                        <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="px-6 py-4 font-bold text-slate-900">
                                                <p>{item.basicDetails?.name}</p>
                                                <p className="text-xs text-slate-400">{item.basicDetails?.department}</p>
                                            </td>
                                            <td className="px-6 py-4 text-sm">₹{(item.calculatedValues?.netSalary || 0).toLocaleString('en-IN')}</td>
                                            <td className="px-6 py-4 text-xs font-bold uppercase tracking-wider">
                                                <span className={`px-2.5 py-0.5 rounded-full ${item.paymentDetails?.status === 'paid' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-amber-50 text-amber-700 border border-amber-100'}`}>
                                                    {item.paymentDetails?.status || 'pending'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-sm uppercase text-slate-500">{item.paymentDetails?.paymentMode || '-'}</td>
                                            <td className="px-6 py-4 text-sm text-slate-500">{item.paymentDetails?.transactionRef || '-'}</td>
                                            <td className="px-6 py-4 text-sm text-slate-500">{item.paymentDetails?.paymentDate ? formatDate(item.paymentDetails.paymentDate) : '-'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default PayrollReports;
