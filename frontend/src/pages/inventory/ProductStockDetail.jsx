import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../services/api';
import {
    MdAccountTree,
    MdArrowBack,
    MdStorefront,
    MdLayers
} from 'react-icons/md';

const API_BASE = '/inventory';

const ProductStockDetail = () => {
    const navigate = useNavigate();
    const { id } = useParams();

    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        api.get(`${API_BASE}/stock/product/${id}`)
            .then(res => {
                setData(res.data);
            })
            .catch(err => {
                console.error('Error fetching stock breakdown:', err);
                setError('Failed to load product stock breakdown.');
            })
            .finally(() => setLoading(false));
    }, [id]);

    if (loading) {
        return <div className="p-12 text-center text-slate-400">Loading stock breakdown...</div>;
    }

    if (error || !data) {
        return (
            <div className="p-6 max-w-4xl mx-auto space-y-4">
                <button onClick={() => navigate('/inventory/stock')} className="flex items-center gap-2 text-sm text-teal-600 font-semibold">
                    <MdArrowBack /> Back to Stock Matrix
                </button>
                <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl">{error || 'Product not found.'}</div>
            </div>
        );
    }

    return (
        <div className="p-6 max-w-5xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/inventory/stock')}
                        className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-all"
                    >
                        <MdArrowBack className="text-xl" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <MdAccountTree className="text-teal-600 dark:text-teal-400" /> Stock Breakdown — {data.product?.productName}
                        </h1>
                        <p className="text-sm font-mono text-slate-500 dark:text-slate-400 mt-0.5">
                            SKU: {data.product?.productCode} | Unit: {data.product?.unit || 'Pcs'}
                        </p>
                    </div>
                </div>
            </div>

            {/* Total Summary */}
            <div className="bg-teal-600 dark:bg-teal-700 text-white p-6 rounded-2xl shadow-sm flex flex-col sm:flex-row justify-between items-center gap-4">
                <div>
                    <span className="text-xs uppercase font-semibold tracking-wider text-teal-100 block">Total System Inventory</span>
                    <span className="text-3xl font-black">{data.totalStock} {data.product?.unit || 'units'}</span>
                </div>
                <div className="flex items-center gap-6">
                    <div className="text-right">
                        <span className="text-xs text-teal-100 block">Warehouses Configured</span>
                        <span className="text-xl font-bold">{data.warehouses?.length || 0} Facilities</span>
                    </div>
                </div>
            </div>

            {/* Warehouse Wise Breakdown */}
            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
                <h2 className="text-base font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-700 pb-3 flex items-center gap-2">
                    <MdStorefront className="text-teal-600" /> Warehouse & Bin Locations
                </h2>

                <div className="space-y-4">
                    {data.warehouses?.map(wh => (
                        <div key={wh.warehouseId} className="p-5 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
                            <div className="flex items-center justify-between font-bold text-slate-900 dark:text-white">
                                <span className="flex items-center gap-2 text-base">
                                    <MdLayers className="text-teal-600" /> {wh.warehouseName} ({wh.warehouseCode})
                                </span>
                                <span className="text-lg font-bold text-teal-600 dark:text-teal-400">
                                    {wh.currentStock} {data.product?.unit || 'units'}
                                </span>
                            </div>
                            {wh.bins && wh.bins.length > 0 && (
                                <div className="pl-6 space-y-2 pt-2 border-t border-slate-200/60 dark:border-slate-800">
                                    {wh.bins.map((bin, idx) => (
                                        <div key={idx} className="flex justify-between text-xs text-slate-600 dark:text-slate-400 py-1.5 px-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-700">
                                            <span className="font-mono">Rack {bin.rack} — Bin {bin.binCode}</span>
                                            <span className="font-bold text-slate-800 dark:text-slate-200">{bin.allocatedStock} units</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default ProductStockDetail;
