import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import {
    MdTune,
    MdArrowBack,
    MdSave,
    MdAdd,
    MdDelete
} from 'react-icons/md';

const API_BASE = '/inventory';

const CreateAdjustment = () => {
    const navigate = useNavigate();
    const [warehouses, setWarehouses] = useState([]);
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    const [adjForm, setAdjForm] = useState({
        warehouseId: '',
        adjustmentType: 'Damage',
        notes: '',
        items: [{ productId: '', systemQty: 0, actualQty: 0, reason: 'Damage' }]
    });

    useEffect(() => {
        Promise.all([
            api.get(`${API_BASE}/warehouses?isActive=true`),
            api.get('/products')
        ]).then(([whRes, prodRes]) => {
            setWarehouses(whRes.data?.warehouses || []);
            setProducts(prodRes.data?.products || prodRes.data || []);
        }).catch(err => {
            console.error('Error fetching master data:', err);
            setError('Failed to load master data.');
        }).finally(() => setLoading(false));
    }, []);

    const handleAddItem = () => {
        setAdjForm(prev => ({
            ...prev,
            items: [...prev.items, { productId: '', systemQty: 0, actualQty: 0, reason: 'Damage' }]
        }));
    };

    const handleRemoveItem = (index) => {
        setAdjForm(prev => ({
            ...prev,
            items: prev.items.filter((_, i) => i !== index)
        }));
    };

    const handleProductSelect = (index, productId) => {
        const prod = products.find(p => p._id === productId);
        setAdjForm(prev => {
            const updated = [...prev.items];
            updated[index].productId = productId;
            updated[index].systemQty = prod?.inventory?.currentStock || 0;
            updated[index].actualQty = prod?.inventory?.currentStock || 0;
            return { ...prev, items: updated };
        });
    };

    const handleActualQtyChange = (index, qty) => {
        setAdjForm(prev => {
            const updated = [...prev.items];
            updated[index].actualQty = Number(qty);
            return { ...prev, items: updated };
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSubmitting(true);

        try {
            await api.post(`${API_BASE}/adjustments`, adjForm);
            alert('Stock adjustment request submitted for manager approval!');
            navigate('/inventory/adjustments');
        } catch (err) {
            console.error('Error submitting adjustment:', err);
            setError(err.response?.data?.message || 'Error submitting adjustment request');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return <div className="p-12 text-center text-slate-400">Loading form...</div>;
    }

    return (
        <div className="p-6 max-w-5xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/inventory/adjustments')}
                        className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-all"
                    >
                        <MdArrowBack className="text-xl" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <MdTune className="text-teal-600 dark:text-teal-400" /> New Stock Adjustment Request
                        </h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                            Record inventory write-offs for damage, theft, loss, expiry, or audit physical variance
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={() => navigate('/inventory/adjustments')}
                        className="px-4 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-all"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={submitting}
                        className="flex items-center gap-2 px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-medium rounded-xl transition-all shadow-md text-sm disabled:opacity-50"
                    >
                        <MdSave className="text-lg" /> {submitting ? 'Submitting...' : 'Submit Request'}
                    </button>
                </div>
            </div>

            {error && (
                <div className="p-4 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 rounded-xl text-sm font-medium">
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* General Card */}
                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
                    <h2 className="text-base font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-700 pb-3">
                        Adjustment Details
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Target Warehouse *</label>
                            <select
                                required
                                value={adjForm.warehouseId}
                                onChange={(e) => setAdjForm({ ...adjForm, warehouseId: e.target.value })}
                                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-teal-500 font-medium"
                            >
                                <option value="">Select Warehouse</option>
                                {warehouses.map(w => <option key={w._id} value={w._id}>{w.warehouseName} ({w.warehouseCode})</option>)}
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Adjustment Type *</label>
                            <select
                                value={adjForm.adjustmentType}
                                onChange={(e) => setAdjForm({ ...adjForm, adjustmentType: e.target.value })}
                                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-teal-500 font-medium"
                            >
                                <option value="Damage">Damage / Spoilage</option>
                                <option value="Loss">Theft / Loss</option>
                                <option value="Expiry">Expired Goods Write-Off</option>
                                <option value="Physical_Variance">Physical Audit Variance</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Notes / Explanation</label>
                        <input
                            type="text"
                            value={adjForm.notes}
                            onChange={(e) => setAdjForm({ ...adjForm, notes: e.target.value })}
                            placeholder="Detailed explanation of the variance"
                            className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-teal-500"
                        />
                    </div>
                </div>

                {/* Items Entry Card */}
                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3">
                        <h2 className="text-base font-bold text-slate-900 dark:text-white">
                            Items to Adjust
                        </h2>
                        <button
                            type="button"
                            onClick={handleAddItem}
                            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-teal-50 dark:bg-teal-950 text-teal-700 dark:text-teal-300 text-xs font-bold rounded-lg hover:bg-teal-100"
                        >
                            <MdAdd /> Add Product Line
                        </button>
                    </div>

                    <div className="space-y-3">
                        {adjForm.items.map((item, idx) => (
                            <div key={idx} className="p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
                                <div className="flex items-center justify-between gap-4">
                                    <div className="flex-1">
                                        <label className="text-[10px] uppercase font-bold text-slate-400 mb-1 block">Select Product *</label>
                                        <select
                                            required
                                            value={item.productId}
                                            onChange={(e) => handleProductSelect(idx, e.target.value)}
                                            className="w-full px-3 py-2 bg-white dark:bg-slate-800 border rounded-lg text-sm"
                                        >
                                            <option value="">Select Product</option>
                                            {products.map(p => <option key={p._id} value={p._id}>{p.productName} ({p.productCode}) - Current Stock: {p.inventory?.currentStock || 0}</option>)}
                                        </select>
                                    </div>
                                    {adjForm.items.length > 1 && (
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveItem(idx)}
                                            className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950 rounded-lg shrink-0 mt-4"
                                        >
                                            <MdDelete className="text-lg" />
                                        </button>
                                    )}
                                </div>

                                <div className="grid grid-cols-3 gap-4">
                                    <div>
                                        <label className="text-[10px] uppercase font-bold text-slate-400">System Qty</label>
                                        <input
                                            type="number"
                                            disabled
                                            value={item.systemQty}
                                            className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-800 border rounded-lg text-sm font-medium text-slate-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] uppercase font-bold text-slate-400">Actual Qty *</label>
                                        <input
                                            type="number"
                                            required
                                            value={item.actualQty}
                                            onChange={(e) => handleActualQtyChange(idx, e.target.value)}
                                            className="w-full px-3 py-2 bg-white dark:bg-slate-800 border rounded-lg text-sm font-bold text-slate-900 dark:text-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] uppercase font-bold text-slate-400">Variance Delta</label>
                                        <div className={`px-3 py-2 rounded-lg text-sm font-bold border ${item.actualQty - item.systemQty >= 0 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
                                            {item.actualQty - item.systemQty > 0 ? `+${item.actualQty - item.systemQty}` : item.actualQty - item.systemQty}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </form>
        </div>
    );
};

export default CreateAdjustment;
