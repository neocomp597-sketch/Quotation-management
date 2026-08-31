import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import { MdStorefront, MdCheckCircle, MdArrowForward, MdLocationOn, MdDomain, MdShield } from 'react-icons/md';

const SelectBranch = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, assignedBranches, setActiveBranch, activeBranchId } = useAuth();

    const [selectedBranch, setSelectedBranch] = useState(null);

    useEffect(() => {
        if (!user) {
            navigate('/login', { replace: true });
            return;
        }

        // Pre-select currently active branch or first assigned branch
        if (assignedBranches && assignedBranches.length > 0) {
            const current = assignedBranches.find(b => (typeof b === 'object' ? (b._id || b.id) : b) === activeBranchId) || assignedBranches[0];
            setSelectedBranch(current);
        }
    }, [user, assignedBranches, activeBranchId, navigate]);

    const handleContinue = () => {
        if (!selectedBranch) {
            toast.error('Please select a branch to proceed.');
            return;
        }

        setActiveBranch(selectedBranch);

        const target = location.state?.returnTo || '/dashboard';
        const name = typeof selectedBranch === 'object' ? selectedBranch.name : 'Selected Branch';
        toast.success(`Active branch set to ${name || 'Selected Branch'}`);
        navigate(target, { replace: true });
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col justify-center items-center px-4 sm:px-6 lg:px-8 relative overflow-hidden font-sans transition-colors duration-300">
            {/* Background Decorative Teal & Emerald Gradient Orbs */}
            <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-teal-500/10 dark:bg-teal-500/20 rounded-full blur-3xl pointer-events-none animate-pulse"></div>
            <div className="absolute bottom-10 right-10 w-96 h-96 bg-emerald-500/10 dark:bg-emerald-500/15 rounded-full blur-3xl pointer-events-none"></div>
            <div className="absolute top-10 left-10 w-80 h-80 bg-teal-600/10 dark:bg-teal-600/10 rounded-full blur-3xl pointer-events-none"></div>

            <div className="w-full max-w-2xl relative z-10">
                {/* Header Branding */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-teal-600 via-teal-500 to-emerald-500 text-white shadow-xl shadow-teal-500/25 mb-4 border border-teal-400/30">
                        <MdStorefront size={36} />
                    </div>
                    <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                        Select Active Branch
                    </h1>
                    <p className="text-sm font-semibold text-slate-600 dark:text-slate-400 mt-2 max-w-md mx-auto">
                        Welcome back, <span className="text-teal-700 dark:text-teal-300 font-bold">{user?.name}</span>! You have access to multiple branches. Choose one to scope your session.
                    </p>
                </div>

                {/* Branch Selection Grid */}
                <div className="bg-white/90 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-teal-500/20 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-slate-200/60 dark:shadow-teal-950/50 transition-colors duration-300">
                    <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100 dark:border-slate-800">
                        <span className="text-xs font-black uppercase tracking-widest text-teal-700 dark:text-teal-400 flex items-center gap-2">
                            <MdDomain size={18} className="text-teal-600 dark:text-teal-400" /> Assigned Branches ({assignedBranches?.length || 0})
                        </span>
                        <span className="text-xs font-bold text-teal-800 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/60 px-3 py-1 rounded-full border border-teal-200 dark:border-teal-800/80">
                            Required Selection
                        </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                        {assignedBranches && assignedBranches.length > 0 ? (
                            assignedBranches.map((branch, idx) => {
                                const branchId = typeof branch === 'object' ? (branch._id || branch.id) : branch;
                                const branchName = typeof branch === 'object' ? (branch.name || 'Branch') : `Branch (${branch})`;
                                const branchCode = typeof branch === 'object' ? branch.code : '';
                                const branchPrefix = typeof branch === 'object' ? branch.branchPrefix : '';
                                const selectedId = typeof selectedBranch === 'object' ? (selectedBranch?._id || selectedBranch?.id) : selectedBranch;
                                const isSelected = selectedId === branchId;
                                const isPrimary = idx === 0;

                                return (
                                    <div
                                        key={branchId || idx}
                                        onClick={() => setSelectedBranch(branch)}
                                        className={`group relative p-5 rounded-2xl border cursor-pointer transition-all duration-200 ${
                                            isSelected
                                                ? 'bg-teal-50/80 dark:bg-teal-950/50 border-teal-500 dark:border-teal-500 ring-2 ring-teal-500/30 dark:ring-teal-500/50 shadow-md shadow-teal-500/10 dark:shadow-teal-500/15'
                                                : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200/70 dark:border-slate-800 hover:border-teal-400 dark:hover:border-teal-500/40 hover:bg-teal-50/30 dark:hover:bg-slate-800/80'
                                        }`}
                                    >
                                        <div className="flex items-start justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm transition-colors ${
                                                    isSelected
                                                        ? 'bg-teal-600 text-white shadow-md shadow-teal-600/30'
                                                        : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 group-hover:bg-teal-100 dark:group-hover:bg-slate-700'
                                                }`}>
                                                    {branchPrefix || branchCode || branchName?.substring(0, 3)?.toUpperCase() || 'BR'}
                                                </div>
                                                <div>
                                                    <h3 className="text-base font-black text-slate-900 dark:text-white group-hover:text-teal-700 dark:group-hover:text-teal-300 transition-colors">
                                                        {branchName}
                                                    </h3>
                                                    {branchCode && (
                                                        <span className="text-[10px] font-bold text-slate-500 dark:text-teal-400/80 uppercase tracking-wider">
                                                            Code: {branchCode}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                                                isSelected ? 'bg-teal-600 text-white shadow-sm shadow-teal-600/40' : 'border border-slate-300 dark:border-slate-700 text-transparent'
                                            }`}>
                                                <MdCheckCircle size={18} />
                                            </div>
                                        </div>

                                        {typeof branch === 'object' && (branch.address || branch.city || branch.state) && (
                                            <div className="mt-4 pt-3 border-t border-slate-200/60 dark:border-slate-800/60 flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                                                <MdLocationOn size={14} className="text-teal-600 dark:text-teal-500/70 shrink-0" />
                                                <span className="truncate">
                                                    {[branch.address, branch.city, branch.state].filter(Boolean).join(', ')}
                                                </span>
                                            </div>
                                        )}

                                        <div className="mt-3 flex items-center justify-between">
                                            {isPrimary ? (
                                                <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-100 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-500/30 px-2 py-0.5 rounded-md">
                                                    Primary Branch
                                                </span>
                                            ) : (
                                                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                                                    Assigned Branch
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            <div className="col-span-2 text-center py-8 text-slate-500 dark:text-slate-400 font-semibold">
                                No specific branch assigned. You will operate under default company scope.
                            </div>
                        )}
                    </div>

                    {/* Action Button */}
                    <button
                        type="button"
                        onClick={handleContinue}
                        className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-teal-600 via-emerald-600 to-teal-600 hover:from-teal-500 hover:to-emerald-500 text-white font-black text-base shadow-xl shadow-teal-600/25 hover:shadow-teal-500/40 transition-all flex items-center justify-center gap-3 group active:scale-[0.99]"
                    >
                        <span>Continue to Dashboard</span>
                        <MdArrowForward size={20} className="group-hover:translate-x-1 transition-transform" />
                    </button>
                </div>

                {/* Footer Security Note */}
                <div className="text-center mt-6 flex items-center justify-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
                    <MdShield size={16} className="text-teal-600 dark:text-teal-400" />
                    <span>Your active branch choice filters all real-time CRM metrics & records. You can switch anytime in the header.</span>
                </div>
            </div>
        </div>
    );
};

export default SelectBranch;
