import React, { useState, useEffect } from 'react';
import { cpqService, productService } from '../services/api';
import { toast } from 'react-toastify';
import { MdAdd, MdFlag, MdShowChart } from 'react-icons/md';
import Modal from '../components/Modal';

const CompetitorIntel = () => {
    const [prices, setPrices] = useState([]);
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formData, setFormData] = useState({
        competitorName: '',
        productId: '',
        competitorPrice: 0,
        marketPrice: 0,
        notes: ''
    });

    useEffect(() => {
        fetchMetadata();
        fetchCompetitors();
    }, []);

    const fetchMetadata = async () => {
        try {
            const res = await productService.getAll({});
            setProducts(Array.isArray(res.data) ? res.data : res.data?.data || []);
        } catch (err) {
            console.error("Load products error:", err);
        }
    };

    const fetchCompetitors = async () => {
        setLoading(true);
        try {
            const res = await cpqService.getCompetitors();
            setPrices(res.data);
        } catch (err) {
            toast.error("Failed to load competitor data");
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await cpqService.createCompetitorPrice(formData);
            toast.success("Competitor rate log added!");
            setIsModalOpen(false);
            fetchCompetitors();
        } catch (err) {
            toast.error("Failed to save competitor log");
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">Competitor Intelligence</h1>
                    <p className="text-slate-500 font-medium">Track external competitor price points and market dynamics.</p>
                </div>
                <div>
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-2xl font-bold transition-all shadow-xl shadow-primary-600/20 uppercase text-xs tracking-widest active:scale-95"
                    >
                        <MdAdd size={20} />
                        <span>Log Competitor Rate</span>
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
                {loading ? (
                    <div className="text-center p-12 text-slate-400 font-bold">Loading records...</div>
                ) : prices.length === 0 ? (
                    <div className="text-center p-12 text-slate-400 font-bold">No competitor intelligence logged.</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-slate-100 text-slate-400 text-[10px] font-black uppercase tracking-widest bg-slate-50/50">
                                    <th className="px-6 py-4">Competitor</th>
                                    <th className="px-6 py-4">Our Product</th>
                                    <th className="px-6 py-4">Our Price</th>
                                    <th className="px-6 py-4">Competitor Price</th>
                                    <th className="px-6 py-4">Market Average</th>
                                    <th className="px-6 py-4">Difference</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 text-sm font-semibold">
                                {prices.map(p => {
                                    const diff = p.productId?.basePrice - p.competitorPrice;
                                    const diffPercent = p.competitorPrice > 0 ? (diff / p.competitorPrice) * 100 : 0;
                                    return (
                                        <tr key={p._id} className="hover:bg-slate-50/50 transition-all">
                                            <td className="px-6 py-4 font-black text-slate-900">{p.competitorName}</td>
                                            <td className="px-6 py-4 text-slate-700">
                                                <div>{p.productId?.productName}</div>
                                                <div className="text-xs text-slate-400">{p.productId?.productCode}</div>
                                            </td>
                                            <td className="px-6 py-4 font-extrabold text-slate-500">₹ {Number(p.productId?.basePrice || 0).toLocaleString()}</td>
                                            <td className="px-6 py-4 font-extrabold text-slate-900">₹ {Number(p.competitorPrice).toLocaleString()}</td>
                                            <td className="px-6 py-4 text-slate-500">₹ {Number(p.marketPrice || 0).toLocaleString()}</td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2.5 py-1 text-[10px] font-black rounded-lg ${diff < 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                                                    {diff < 0 ? 'We are cheaper' : `We are +${Math.round(diffPercent)}% higher`}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Create Modal */}
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Log Competitor Price Observation">
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Competitor Corporate Name</label>
                        <input
                            type="text"
                            required
                            placeholder="e.g. Caterpillar, Komatsu, Zoho CRM"
                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-semibold"
                            value={formData.competitorName}
                            onChange={e => setFormData({ ...formData, competitorName: e.target.value })}
                        />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="md:col-span-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Select Mapped Offer</label>
                            <select
                                required
                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-semibold cursor-pointer"
                                value={formData.productId}
                                onChange={e => setFormData({ ...formData, productId: e.target.value })}
                            >
                                <option value="">Choose item...</option>
                                {products.map(p => (
                                    <option key={p._id} value={p._id}>{p.productName} ({p.productCode})</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Competitor Rate</label>
                            <input
                                type="number"
                                required
                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-semibold"
                                value={formData.competitorPrice}
                                onChange={e => setFormData({ ...formData, competitorPrice: Number(e.target.value) })}
                            />
                        </div>
                    </div>
                    <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                        <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 text-xs font-bold text-slate-500 uppercase tracking-widest hover:bg-slate-50 rounded-xl">Cancel</button>
                        <button type="submit" className="px-6 py-2.5 text-xs font-bold text-white bg-primary-600 hover:bg-primary-700 rounded-xl uppercase tracking-widest shadow-lg shadow-primary-600/20">Log</button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default CompetitorIntel;
