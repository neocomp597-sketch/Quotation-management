import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import {
    MdCompareArrows,
    MdArrowBack,
    MdSave,
    MdAdd,
    MdDelete
} from 'react-icons/md';

const API_BASE = '/inventory';

const CreateTransfer = () => {
    const navigate = useNavigate();
    const [warehouses, setWarehouses] = useState([]);
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    const [form, setForm] = useState({
        fromWarehouseId: '',
        toWarehouseId: '',
        notes: '',
        items: [{ productId: '', qtyRequested: 1 }]
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
        setForm(prev => ({
            ...prev,
            items: [...prev.items, { productId: '', qtyRequested: 1 }]
        }));
    };

    const handleRemoveItem = (index) => {
        setForm(prev => ({
            ...prev,
            items: prev.items.filter((_, i) => i !== index)
        }));
    };

    const handleItemChange = (index, field, value) => {
        setForm(prev => {
            const updated = [...prev.items];
            updated[index] = { ...updated[index], [field]: value };
            return { ...prev, items: updated };
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        if (form.fromWarehouseId === form.toWarehouseId) {
            setError('Source and Destination Warehouses cannot be the same!');
            return;
        }

        setSubmitting(true);
        try {
            await api.post(`${API_BASE}/transfers`, form);
            alert('Stock transfer request created successfully!');
            navigate('/inventory/transfers');
        } catch (err) {
            console.error('Error creating transfer:', err);
            setError(err.response?.data?.message || 'Error creating transfer request');
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
                        onClick={() => navigate('/inventory/transfers')}
                        className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-all"
                    >
                        <MdArrowBack className="text-xl" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <MdCompareArrows className="text-teal-600 dark:text-teal-400" /> New Stock Transfer Request
                        </h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                            Request material movement between warehouses with multi-item line validation
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={() => navigate('/inventory/transfers')}
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
                {/* Route Card */}
                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
                    <h2 className="text-base font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-700 pb-3">
                        Transfer Route & Notes
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                        <div>
                            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Source Warehouse *</label>
                            <select
                                required
                                value={form.fromWarehouseId}
                                onChange={(e) => setForm({ ...form, fromWarehouseId: e.target.value })}
                                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-teal-500 font-medium"
                            >
                                <option value="">Select Source Warehouse</option>
                                {warehouses.map(w => <option key={w._id} value={w._id}>{w.warehouseName} ({w.warehouseCode})</option>)}
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Destination Warehouse *</label>
                            <select
                                required
                                value={form.toWarehouseId}
                                onChange={(e) => setForm({ ...form, toWarehouseId: e.target.value })}
                                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-teal-500 font-medium"
                            >
                                <option value="">Select Destination Warehouse</option>
                                {warehouses.map(w => <option key={w._id} value={w._id}>{w.warehouseName} ({w.warehouseCode})</option>)}
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Notes / Reason for Transfer</label>
                        <input
                            type="text"
                            value={form.notes}
                            onChange={(e) => setForm({ ...form, notes: e.target.value })}
                            placeholder="e.g. Urgent stock replenishment for sales order"
                            className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-teal-500"
                        />
                    </div>
                </div>

                {/* Items Card */}
                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3">
                        <h2 className="text-base font-bold text-slate-900 dark:text-white">
                            Items to Transfer
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
                        {form.items.map((item, idx) => (
                            <div key={idx} className="flex flex-col sm:flex-row items-center gap-3 p-3.5 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">
                                <div className="w-full sm:w-2/3">
                                    <label className="text-[10px] uppercase font-bold text-slate-400">Select Product *</label>
                                    <select
                                        required
                                        value={item.productId}
                                        onChange={(e) => handleItemChange(idx, 'productId', e.target.value)}
                                        className="w-full px-3 py-2 bg-white dark:bg-slate-800 border rounded-lg text-sm"
                                    >
                                        <option value="">Select Product</option>
                                        {products.map(p => <option key={p._id} value={p._id}>{p.productName} ({p.productCode}) - Available: {p.inventory?.availableStock || 0}</option>)}
                                    </select>
                                </div>
                                <div className="w-full sm:w-1/3">
                                    <label className="text-[10px] uppercase font-bold text-slate-400">Requested Qty *</label>
                                    <input
                                        type="number"
                                        min="1"
                                        required
                                        value={item.qtyRequested}
                                        onChange={(e) => handleItemChange(idx, 'qtyRequested', Number(e.target.value))}
                                        className="w-full px-3 py-2 bg-white dark:bg-slate-800 border rounded-lg text-sm font-bold"
                                    />
                                </div>
                                {form.items.length > 1 && (
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveItem(idx)}
                                        className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950 rounded-lg shrink-0 mt-4 sm:mt-0"
                                    >
                                        <MdDelete className="text-lg" />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </form>
        </div>
    );
};

export default CreateTransfer;
