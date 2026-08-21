import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import {
    MdFactCheck,
    MdArrowBack,
    MdSave,
    MdStorefront
} from 'react-icons/md';

const API_BASE = '/inventory';

const CreateAudit = () => {
    const navigate = useNavigate();
    const [warehouses, setWarehouses] = useState([]);
    const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        api.get(`${API_BASE}/warehouses?isActive=true`)
            .then(res => {
                setWarehouses(res.data?.warehouses || []);
            })
            .catch(err => {
                console.error('Error fetching warehouses:', err);
                setError('Failed to load active warehouses.');
            })
            .finally(() => setLoading(false));
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!selectedWarehouseId) {
            setError('Please select a target warehouse for audit.');
            return;
        }

        setError('');
        setSubmitting(true);

        try {
            await api.post(`${API_BASE}/counts`, { warehouseId: selectedWarehouseId });
            alert('Physical audit session initiated successfully!');
            navigate('/inventory/counts');
        } catch (err) {
            console.error('Error starting audit session:', err);
            setError(err.response?.data?.message || 'Error starting physical audit session');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return <div className="p-12 text-center text-slate-400">Loading warehouses...</div>;
    }

    return (
        <div className="p-6 max-w-4xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/inventory/counts')}
                        className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-all"
                    >
                        <MdArrowBack className="text-xl" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <MdFactCheck className="text-teal-600 dark:text-teal-400" /> Start Physical Audit Session
                        </h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                            Initiate a physical stock count session to verify physical inventory balances
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={() => navigate('/inventory/counts')}
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
                        <MdSave className="text-lg" /> {submitting ? 'Starting...' : 'Start Audit Session'}
                    </button>
                </div>
            </div>

            {error && (
                <div className="p-4 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 rounded-xl text-sm font-medium">
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
                    <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2 border-b border-slate-100 dark:border-slate-700 pb-3">
                        <MdStorefront className="text-teal-600" /> Audit Location Selection
                    </h2>

                    <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                            Select Warehouse for Physical Audit *
                        </label>
                        <select
                            required
                            value={selectedWarehouseId}
                            onChange={(e) => setSelectedWarehouseId(e.target.value)}
                            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium focus:outline-none focus:border-teal-500"
                        >
                            <option value="">-- Choose Warehouse Facility --</option>
                            {warehouses.map(w => (
                                <option key={w._id} value={w._id}>
                                    {w.warehouseName} ({w.warehouseCode}) - Bins: {w.bins?.length || 0}
                                </option>
                            ))}
                        </select>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                            Starting a physical audit will create a snapshot of expected stock levels for all products in this warehouse.
                        </p>
                    </div>
                </div>
            </form>
        </div>
    );
};

export default CreateAudit;
