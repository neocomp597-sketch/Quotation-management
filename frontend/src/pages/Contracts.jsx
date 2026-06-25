import React, { useState, useEffect } from 'react';
import { cpqService, customerService } from '../services/api';
import { toast } from 'react-toastify';
import { MdAdd, MdDelete, MdAssignment, MdDateRange } from 'react-icons/md';
import Modal from '../components/Modal';

const Contracts = () => {
    const [contracts, setContracts] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [priceBooks, setPriceBooks] = useState([]);
    const [loading, setLoading] = useState(true);

    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [formData, setFormData] = useState({
        contractNumber: '',
        title: '',
        customerId: '',
        priceBookId: '',
        startDate: '',
        endDate: '',
        renewalRules: 'Auto-Renew annually'
    });

    useEffect(() => {
        fetchMetadata();
        fetchContracts();
    }, []);

    const fetchMetadata = async () => {
        try {
            const [custRes, pbRes] = await Promise.all([
                customerService.getAll({}),
                cpqService.getPriceBooks()
            ]);
            setCustomers(Array.isArray(custRes.data) ? custRes.data : custRes.data?.data || []);
            setPriceBooks(pbRes.data.filter(pb => pb.type === 'Contract'));
        } catch (err) {
            console.error("Load contracts metadata error:", err);
        }
    };

    const fetchContracts = async () => {
        setLoading(true);
        try {
            const res = await cpqService.getContracts();
            setContracts(res.data);
        } catch (err) {
            toast.error("Failed to load contracts");
        } finally {
            setLoading(false);
        }
    };

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        try {
            await cpqService.createContract({
                ...formData,
                status: 'Active'
            });
            toast.success("Locked Pricing Agreement active!");
            setIsCreateModalOpen(false);
            fetchContracts();
        } catch (err) {
            toast.error("Failed to register contract");
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm("Are you sure you want to delete this contract?")) {
            try {
                await cpqService.deleteContract(id);
                toast.success("Contract deleted");
                fetchContracts();
            } catch (err) {
                toast.error("Failed to delete contract");
            }
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">Customer Contracts</h1>
                    <p className="text-slate-500 font-medium">Manage locked rate agreements and terms locks.</p>
                </div>
                <div>
                    <button
                        onClick={() => setIsCreateModalOpen(true)}
                        className="flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-2xl font-bold transition-all shadow-xl shadow-primary-600/20 uppercase text-xs tracking-widest active:scale-95"
                    >
                        <MdAdd size={20} />
                        <span>Add Contract</span>
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
                {loading ? (
                    <div className="text-center p-12 text-slate-400 font-bold">Loading agreements...</div>
                ) : contracts.length === 0 ? (
                    <div className="text-center p-12 text-slate-400 font-bold">No rate contracts locked.</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-slate-100 text-slate-400 text-[10px] font-black uppercase tracking-widest bg-slate-50/50">
                                    <th className="px-6 py-4">Contract Number</th>
                                    <th className="px-6 py-4">Title</th>
                                    <th className="px-6 py-4">Customer</th>
                                    <th className="px-6 py-4">Validity</th>
                                    <th className="px-6 py-4">Price Book Mapped</th>
                                    <th className="px-6 py-4">Status</th>
                                    <th className="px-6 py-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 text-sm font-semibold">
                                {contracts.map(c => (
                                    <tr key={c._id} className="hover:bg-slate-50/50 transition-all">
                                        <td className="px-6 py-4 font-black text-slate-900">{c.contractNumber}</td>
                                        <td className="px-6 py-4 text-slate-700">{c.title}</td>
                                        <td className="px-6 py-4 text-slate-500">{c.customerId?.companyName || c.customerId?.customerName}</td>
                                        <td className="px-6 py-4 text-xs font-bold text-slate-500">
                                            {new Date(c.startDate).toLocaleDateString()} - {new Date(c.endDate).toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-4 text-xs font-black text-primary-600 uppercase">{c.priceBookId?.name || 'N/A'}</td>
                                        <td className="px-6 py-4">
                                            <span className="px-2.5 py-1 text-[10px] font-black bg-emerald-50 text-emerald-600 rounded-lg uppercase">
                                                {c.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button
                                                onClick={() => handleDelete(c._id)}
                                                className="p-1.5 text-slate-400 hover:text-rose-600 transition-colors"
                                            >
                                                <MdDelete size={18} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Create Drawer */}
            <Modal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} title="Lock Negotiated Customer Contract">
                <form onSubmit={handleFormSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Contract Number</label>
                            <input
                                type="text"
                                required
                                placeholder="ARM/CON/2026/001"
                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-semibold"
                                value={formData.contractNumber}
                                onChange={e => setFormData({ ...formData, contractNumber: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Agreement Title</label>
                            <input
                                type="text"
                                required
                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-semibold"
                                value={formData.title}
                                onChange={e => setFormData({ ...formData, title: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Customer Account</label>
                            <select
                                required
                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-semibold cursor-pointer"
                                value={formData.customerId}
                                onChange={e => setFormData({ ...formData, customerId: e.target.value })}
                            >
                                <option value="">Select account...</option>
                                {customers.map(c => (
                                    <option key={c._id} value={c._id}>{c.companyName || c.customerName}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Contract Price Book</label>
                            <select
                                required
                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-semibold cursor-pointer"
                                value={formData.priceBookId}
                                onChange={e => setFormData({ ...formData, priceBookId: e.target.value })}
                            >
                                <option value="">Select custom book...</option>
                                {priceBooks.map(pb => (
                                    <option key={pb._id} value={pb._id}>{pb.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Start Date</label>
                            <input
                                type="date"
                                required
                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-semibold"
                                value={formData.startDate}
                                onChange={e => setFormData({ ...formData, startDate: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">End Date</label>
                            <input
                                type="date"
                                required
                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-semibold"
                                value={formData.endDate}
                                onChange={e => setFormData({ ...formData, endDate: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                        <button
                            type="button"
                            onClick={() => setIsCreateModalOpen(false)}
                            className="px-5 py-2.5 text-xs font-bold text-slate-500 uppercase tracking-widest hover:bg-slate-50 rounded-xl"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="px-6 py-2.5 text-xs font-bold text-white bg-primary-600 hover:bg-primary-700 rounded-xl uppercase tracking-widest shadow-lg shadow-primary-600/20"
                        >
                            Lock Rates
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default Contracts;
