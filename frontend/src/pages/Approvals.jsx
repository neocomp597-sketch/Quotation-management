import React, { useState, useEffect } from 'react';
import { quotationService } from '../services/api';
import { toast } from 'react-toastify';
import { MdCheck, MdClose, MdLockOpen, MdLock } from 'react-icons/md';
import { useSubmitGuard } from '../hooks/useSubmitGuard';

const Approvals = () => {
    const [pendingQuotes, setPendingQuotes] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchPendingQuotes();
    }, []);

    const fetchPendingQuotes = async () => {
        setLoading(true);
        try {
            const res = await quotationService.getAll({ status: 'pending_approval' });
            setPendingQuotes(Array.isArray(res.data) ? res.data : res.data?.data || []);
        } catch (err) {
            console.error("Load pending quotes error:", err);
            toast.error("Failed to load pending approvals list");
        } finally {
            setLoading(false);
        }
    };

    const { isSubmitting: isApproving, execute: handleApprove } = useSubmitGuard(async (id, quotationNo) => {
        try {
            await quotationService.updateStatus(id, 'final');
            toast.success(`Quotation ${quotationNo} has been approved and finalized!`);
            fetchPendingQuotes();
        } catch (err) {
            toast.error("Failed to approve quotation");
        }
    });

    const { isSubmitting: isRejecting, execute: handleReject } = useSubmitGuard(async (id, quotationNo) => {
        try {
            await quotationService.updateStatus(id, 'draft');
            toast.info(`Quotation ${quotationNo} rejected and returned to draft.`);
            fetchPendingQuotes();
        } catch (err) {
            toast.error("Failed to reject quotation");
        }
    });

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-black text-slate-900 tracking-tight">Price & Discount Approvals</h1>
                <p className="text-slate-500 font-medium">Review overrides and quotes requiring margin clearance.</p>
            </div>

            <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden p-6">
                {loading ? (
                    <div className="text-center p-12 text-slate-400 font-bold">Loading pending approvals...</div>
                ) : pendingQuotes.length === 0 ? (
                    <div className="text-center p-12 text-slate-400 font-bold flex flex-col items-center gap-2">
                        <MdLockOpen size={48} className="text-emerald-500" />
                        <span>All clear! No pending quotes require approvals.</span>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {pendingQuotes.map(quote => (
                            <div key={quote._id} className="p-6 bg-slate-50 border border-slate-100 rounded-3xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:shadow-md transition-all">
                                <div className="space-y-2">
                                    <div className="flex gap-2 items-center">
                                        <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                                        <h3 className="font-extrabold text-slate-900 text-base">{quote.quotationNo}</h3>
                                        <span className="text-xs text-slate-400 font-bold">({quote.customerName})</span>
                                    </div>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-bold text-slate-500 pt-1">
                                        <div>
                                            <span className="block text-[9px] uppercase tracking-widest text-slate-400">Total Rate</span>
                                            <span className="text-slate-900 font-black text-sm">₹ {Number(quote.grandTotal).toLocaleString()}</span>
                                        </div>
                                        <div>
                                            <span className="block text-[9px] uppercase tracking-widest text-slate-400">Date Logged</span>
                                            <span className="text-slate-600 font-semibold">{new Date(quote.quotationDate).toLocaleDateString()}</span>
                                        </div>
                                        <div>
                                            <span className="block text-[9px] uppercase tracking-widest text-slate-400">Representative</span>
                                            <span className="text-slate-600 font-semibold">{quote.salespersonName || 'System'}</span>
                                        </div>
                                        <div>
                                            <span className="block text-[9px] uppercase tracking-widest text-slate-400">Security Clearance</span>
                                            <span className="text-amber-600 font-black uppercase text-[10px] tracking-wider bg-amber-50 px-2 py-0.5 rounded-md">Pending Manager</span>
                                        </div>
                                    </div>
                                </div>

                                 <div className="flex gap-2 w-full md:w-auto border-t md:border-none pt-4 md:pt-0">
                                    <button
                                        onClick={() => handleReject(quote._id, quote.quotationNo)}
                                        disabled={isApproving || isRejecting}
                                        className="flex-1 md:flex-none flex items-center justify-center gap-1 border border-slate-200 hover:bg-slate-50 text-slate-500 font-bold text-xs uppercase tracking-wider px-5 py-2.5 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <MdClose size={18} />
                                        {isRejecting ? 'Rejecting...' : 'Reject'}
                                    </button>
                                    <button
                                        onClick={() => handleApprove(quote._id, quote.quotationNo)}
                                        disabled={isApproving || isRejecting}
                                        className="flex-1 md:flex-none flex items-center justify-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase tracking-wider px-5 py-2.5 rounded-xl transition-all shadow-lg shadow-emerald-600/10 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <MdCheck size={18} />
                                        {isApproving ? 'Approving...' : 'Approve Override'}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Approvals;
