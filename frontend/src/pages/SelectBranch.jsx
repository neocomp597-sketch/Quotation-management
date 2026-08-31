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
            const current = assignedBranches.find(b => (b._id || b.id) === activeBranchId) || assignedBranches[0];
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
        toast.success(`Active branch set to ${selectedBranch.name || 'Selected Branch'}`);
        navigate(target, { replace: true });
    };

    return (
        <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center px-4 sm:px-6 lg:px-8 relative overflow-hidden font-sans">
            {/* Background Decorative Gradient Orbs */}
            <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary-600/20 rounded-full blur-3xl pointer-events-none animate-pulse"></div>
            <div className="absolute bottom-10 right-10 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none"></div>

            <div className="w-full max-w-2xl relative z-10">
                {/* Header Branding */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-primary-600 to-indigo-500 text-white shadow-xl shadow-primary-500/25 mb-4">
                        <MdStorefront size={36} />
                    </div>
                    <h1 className="text-3xl font-black text-white tracking-tight">
                        Select Active Branch
                    </h1>
                    <p className="text-sm font-semibold text-slate-400 mt-2 max-w-md mx-auto">
                        Welcome back, <span className="text-white font-bold">{user?.name}</span>! You have access to multiple branches. Choose one to scope your dashboard session.
                    </p>
                </div>

                {/* Branch Selection Grid */}
                <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl">
                    <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-800">
                        <span className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                            <MdDomain size={16} className="text-primary-400" /> Assigned Branches ({assignedBranches?.length || 0})
                        </span>
                        <span className="text-xs font-bold text-slate-400 bg-slate-800 px-3 py-1 rounded-full border border-slate-700">
                            Required Selection
                        </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                        {assignedBranches && assignedBranches.length > 0 ? (
                            assignedBranches.map((branch, idx) => {
                                const branchId = branch._id || branch.id;
                                const isSelected = (selectedBranch?._id || selectedBranch?.id) === branchId;
                                const isPrimary = idx === 0;

                                return (
                                    <div
                                        key={branchId || idx}
                                        onClick={() => setSelectedBranch(branch)}
                                        className={`group relative p-5 rounded-2xl border cursor-pointer transition-all duration-200 ${
                                            isSelected
                                                ? 'bg-primary-950/40 border-primary-500 ring-2 ring-primary-500/50 shadow-lg shadow-primary-500/10'
                                                : 'bg-slate-800/40 border-slate-800 hover:border-slate-700 hover:bg-slate-800/80'
                                        }`}
                                    >
                                        <div className="flex items-start justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm transition-colors ${
                                                    isSelected
                                                        ? 'bg-primary-600 text-white shadow-md'
                                                        : 'bg-slate-800 text-slate-300 group-hover:bg-slate-700'
                                                }`}>
                                                    {branch.branchPrefix || branch.code || branch.name?.substring(0, 3)?.toUpperCase() || 'BR'}
                                                </div>
                                                <div>
                                                    <h3 className="text-base font-black text-white group-hover:text-primary-300 transition-colors">
                                                        {branch.name}
                                                    </h3>
                                                    {branch.code && (
                                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                                            Code: {branch.code}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                                                isSelected ? 'bg-primary-500 text-white' : 'border border-slate-700 text-transparent'
                                            }`}>
                                                <MdCheckCircle size={18} />
                                            </div>
                                        </div>

                                        {(branch.address || branch.city || branch.state) && (
                                            <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center gap-1.5 text-xs font-medium text-slate-400">
                                                <MdLocationOn size={14} className="text-slate-500 shrink-0" />
                                                <span className="truncate">
                                                    {[branch.address, branch.city, branch.state].filter(Boolean).join(', ')}
                                                </span>
                                            </div>
                                        )}

                                        <div className="mt-3 flex items-center justify-between">
                                            {isPrimary ? (
                                                <span className="text-[10px] font-black uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-md">
                                                    Primary Branch
                                                </span>
                                            ) : (
                                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                                    Assigned Branch
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            <div className="col-span-2 text-center py-8 text-slate-400 font-semibold">
                                No specific branch assigned. You will operate under default company scope.
                            </div>
                        )}
                    </div>

                    {/* Action Button */}
                    <button
                        type="button"
                        onClick={handleContinue}
                        className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-primary-600 via-indigo-600 to-primary-600 hover:from-primary-500 hover:to-indigo-500 text-white font-black text-base shadow-xl shadow-primary-600/25 transition-all flex items-center justify-center gap-3 group active:scale-[0.99]"
                    >
                        <span>Continue to Dashboard</span>
                        <MdArrowForward size={20} className="group-hover:translate-x-1 transition-transform" />
                    </button>
                </div>

                {/* Footer Security Note */}
                <div className="text-center mt-6 flex items-center justify-center gap-2 text-xs font-semibold text-slate-500">
                    <MdShield size={14} className="text-emerald-500" />
                    <span>Your active branch choice filters all real-time CRM metrics & records. You can switch anytime in the header.</span>
                </div>
            </div>
        </div>
    );
};

export default SelectBranch;
