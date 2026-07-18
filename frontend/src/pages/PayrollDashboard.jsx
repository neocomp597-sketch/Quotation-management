import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
    MdPeople, MdReceipt, MdSettings, MdTrendingUp, 
    MdAssignmentTurnedIn, MdLock, MdHistory, MdPayment
} from 'react-icons/md';
import { payrollService } from '../services/api';
import { toast } from 'react-toastify';
import { formatDate } from '../utils/helpers';

const PayrollDashboard = () => {
    const [stats, setStats] = useState({
        activeEmployees: 0,
        currentMonth: '',
        runStatus: 'Not Started',
        totalNetPayout: 0,
        totalDeductions: 0,
        totalGross: 0,
    });
    const [recentRuns, setRecentRuns] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchDashboardData = async () => {
            try {
                setLoading(true);
                // Get Settings
                const settingsRes = await payrollService.getSettings();
                const settings = settingsRes.data;
                
                // Get all employees (to count active)
                const empRes = await payrollService.getEmployees({ status: 'Active' });
                const activeEmpCount = empRes.data.length;

                // Get all runs (for recent runs history)
                const runsRes = await payrollService.getRuns();
                const runs = runsRes.data || [];
                setRecentRuns(runs.slice(0, 5));

                // Find active run for settings.currentMonth
                let activeRunDetails = { status: 'Not Started', net: 0, ded: 0, gross: 0 };
                const currentRun = runs.find(r => r.month === settings.currentMonth);
                
                if (currentRun) {
                    const detailsRes = await payrollService.getRunDetails(currentRun._id);
                    const summaries = detailsRes.data.summaries || [];
                    const totals = summaries.reduce((acc, curr) => {
                        const val = curr.calculatedValues || {};
                        acc.net += val.netSalary || 0;
                        acc.ded += val.totalDeduction || 0;
                        acc.gross += val.grossSalary || 0;
                        return acc;
                    }, { net: 0, ded: 0, gross: 0 });

                    activeRunDetails = {
                        status: currentRun.status,
                        net: totals.net,
                        ded: totals.ded,
                        gross: totals.gross
                    };
                }

                setStats({
                    activeEmployees: activeEmpCount,
                    currentMonth: settings.currentMonth || 'N/A',
                    runStatus: activeRunDetails.status,
                    totalNetPayout: activeRunDetails.net,
                    totalDeductions: activeRunDetails.ded,
                    totalGross: activeRunDetails.gross
                });

            } catch (error) {
                console.error('Failed to load payroll dashboard', error);
                toast.error('Failed to load dashboard metrics');
            } finally {
                setLoading(false);
            }
        };

        fetchDashboardData();
    }, []);

    const getStatusBadgeClass = (status) => {
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

    const formatMonthName = (monthStr) => {
        if (!monthStr || monthStr === 'N/A') return 'N/A';
        const [year, month] = monthStr.split('-');
        const date = new Date(year, parseInt(month) - 1, 1);
        return date.toLocaleString('en-US', { month: 'long', year: 'numeric' });
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-10 w-10 border-4 border-primary-500 border-t-transparent"></div>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-black text-slate-900 tracking-tight">Payroll Dashboard</h1>
                <p className="text-slate-500 font-medium">Overview of monthly salary registers, approvals, and employee payouts.</p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Active Employees */}
                <motion.div 
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between"
                >
                    <div className="space-y-1">
                        <p className="text-sm font-bold text-slate-400 uppercase tracking-wide">Active Employees</p>
                        <h3 className="text-3xl font-black text-slate-900">{stats.activeEmployees}</h3>
                    </div>
                    <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center">
                        <MdPeople size={24} />
                    </div>
                </motion.div>

                {/* Net Payout */}
                <motion.div 
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.1 }}
                    className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between"
                >
                    <div className="space-y-1">
                        <p className="text-sm font-bold text-slate-400 uppercase tracking-wide">Net Payout ({stats.currentMonth})</p>
                        <h3 className="text-2xl font-black text-slate-900">
                            ₹{stats.totalNetPayout.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </h3>
                    </div>
                    <div className="w-12 h-12 rounded-2xl bg-primary-50 text-primary-600 flex items-center justify-center">
                        <MdTrendingUp size={24} />
                    </div>
                </motion.div>

                {/* Deductions */}
                <motion.div 
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.2 }}
                    className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between"
                >
                    <div className="space-y-1">
                        <p className="text-sm font-bold text-slate-400 uppercase tracking-wide">Deductions ({stats.currentMonth})</p>
                        <h3 className="text-2xl font-black text-slate-900">
                            ₹{stats.totalDeductions.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </h3>
                    </div>
                    <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center">
                        <MdPayment size={24} />
                    </div>
                </motion.div>

                {/* Active Month Lock Status */}
                <motion.div 
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.3 }}
                    className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between"
                >
                    <div className="space-y-1">
                        <p className="text-sm font-bold text-slate-400 uppercase tracking-wide">Active Month Status</p>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="text-sm font-black text-slate-800">{formatMonthName(stats.currentMonth)}</span>
                            <span className={`px-2.5 py-0.5 border rounded-full text-[10px] font-black uppercase tracking-wider ${getStatusBadgeClass(stats.runStatus)}`}>
                                {stats.runStatus}
                            </span>
                        </div>
                    </div>
                    <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
                        <MdLock size={24} />
                    </div>
                </motion.div>
            </div>

            {/* Quick Actions & Recent Runs */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Quick Actions */}
                <div className="lg:col-span-1 space-y-6">
                    <h2 className="text-lg font-black text-slate-800">Quick Shortcuts</h2>
                    <div className="grid grid-cols-2 gap-4">
                        <NavLink 
                            to="/payroll/runs" 
                            className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all flex flex-col items-center justify-center text-center gap-3 hover:-translate-y-0.5 duration-200"
                        >
                            <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
                                <MdReceipt size={20} />
                            </div>
                            <span className="text-sm font-bold text-slate-700">Run Payroll</span>
                        </NavLink>
                        
                        <NavLink 
                            to="/payroll/payments" 
                            className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all flex flex-col items-center justify-center text-center gap-3 hover:-translate-y-0.5 duration-200"
                        >
                            <div className="w-10 h-10 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center">
                                <MdAssignmentTurnedIn size={20} />
                            </div>
                            <span className="text-sm font-bold text-slate-700">Record Payments</span>
                        </NavLink>

                        <NavLink 
                            to="/payroll/employees" 
                            className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all flex flex-col items-center justify-center text-center gap-3 hover:-translate-y-0.5 duration-200"
                        >
                            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                                <MdPeople size={20} />
                            </div>
                            <span className="text-sm font-bold text-slate-700">Salary Profiles</span>
                        </NavLink>

                        <NavLink 
                            to="/payroll/settings" 
                            className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all flex flex-col items-center justify-center text-center gap-3 hover:-translate-y-0.5 duration-200"
                        >
                            <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center">
                                <MdSettings size={20} />
                            </div>
                            <span className="text-sm font-bold text-slate-700">Configuration</span>
                        </NavLink>
                    </div>
                </div>

                {/* Recent Runs History */}
                <div className="lg:col-span-2 space-y-6">
                    <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
                        <MdHistory className="text-slate-400" />
                        Recent Payroll Months
                    </h2>
                    <div className="bg-white border border-slate-100 shadow-sm rounded-3xl overflow-hidden">
                        {recentRuns.length === 0 ? (
                            <div className="p-8 text-center text-slate-400 font-bold">
                                No payroll month run initialized yet.
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-100">
                                {recentRuns.map((run) => (
                                    <div key={run._id} className="p-5 flex items-center justify-between hover:bg-slate-50 transition-colors">
                                        <div>
                                            <p className="font-black text-slate-900 text-base">{formatMonthName(run.month)}</p>
                                            <p className="text-xs text-slate-400 font-medium">Initialized on {formatDate(run.createdAt)}</p>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className={`px-2.5 py-0.5 border rounded-full text-[10px] font-black uppercase tracking-wider ${getStatusBadgeClass(run.status)}`}>
                                                {run.status}
                                            </span>
                                            <NavLink 
                                                to="/payroll/runs" 
                                                className="px-4 py-1.5 bg-slate-100 hover:bg-primary-600 hover:text-white transition-colors text-slate-700 font-bold text-xs rounded-xl"
                                            >
                                                View details
                                            </NavLink>
                                        </div>
                                    </div>
                                ))}
							</div>
						)}
					</div>
				</div>
			</div>
		</div>
	);
};

export default PayrollDashboard;
