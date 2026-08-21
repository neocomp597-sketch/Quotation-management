import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import {
    MdInventory,
    MdSearch,
    MdAccountTree
} from 'react-icons/md';

const API_BASE = '/inventory';

const StockMatrix = () => {
    const navigate = useNavigate();
    const [stockItems, setStockItems] = useState([]);
    const [warehouses, setWarehouses] = useState([]);
    const [loading, setLoading] = useState(true);

    const [search, setSearch] = useState('');
    const [selectedWarehouse, setSelectedWarehouse] = useState('');
    const [selectedStatus, setSelectedStatus] = useState('');

    const fetchStockMatrix = async () => {
        setLoading(true);
        try {
            const res = await api.get(`${API_BASE}/stock`, {
                params: {
                    search,
                    warehouseId: selectedWarehouse,
                    stockStatus: selectedStatus,
                    limit: 100
                }
            });
            setStockItems(res.data?.stock || []);
        } catch (error) {
            console.error('Error fetching stock matrix:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchWarehouses = async () => {
        try {
            const res = await api.get(`${API_BASE}/warehouses?isActive=true`);
            setWarehouses(res.data?.warehouses || []);
        } catch (error) {
            console.error('Error fetching warehouses:', error);
        }
    };

    useEffect(() => {
        fetchWarehouses();
    }, []);

    useEffect(() => {
        fetchStockMatrix();
    }, [search, selectedWarehouse, selectedStatus]);

    const getStatusBadge = (status) => {
        switch (status) {
            case 'NORMAL':
                return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">In Stock</span>;
            case 'LOW_STOCK':
                return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">Low Stock</span>;
            case 'OUT_OF_STOCK':
                return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">Out of Stock</span>;
            case 'OVERSTOCK':
                return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">Overstock</span>;
            default:
                return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300">{status}</span>;
        }
    };

    const formatCurrency = (val) => {
        return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val || 0);
    };

    return (
        <div className="p-6 space-y-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <MdInventory className="text-teal-600 dark:text-teal-400" /> Items & Stock Matrix
                    </h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        Operational inventory matrix, warehouse balances, reserved stock, and location breakdowns.
                    </p>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="relative">
                    <MdSearch className="absolute left-3.5 top-3 text-slate-400 text-lg" />
                    <input
                        type="text"
                        placeholder="Search product code, SKU, or name..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-teal-500"
                    />
                </div>

                <select
                    value={selectedWarehouse}
                    onChange={(e) => setSelectedWarehouse(e.target.value)}
                    className="px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-teal-500"
                >
                    <option value="">All Warehouses</option>
                    {warehouses.map(wh => (
                        <option key={wh._id} value={wh._id}>{wh.warehouseName} ({wh.warehouseCode})</option>
                    ))}
                </select>

                <select
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value)}
                    className="px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-teal-500"
                >
                    <option value="">All Stock Statuses</option>
                    <option value="NORMAL">In Stock</option>
                    <option value="LOW_STOCK">Low Stock</option>
                    <option value="OUT_OF_STOCK">Out of Stock</option>
                    <option value="OVERSTOCK">Overstock</option>
                </select>
            </div>

            {/* Operational Stock Matrix Table */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
                {loading ? (
                    <div className="p-12 text-center text-slate-400">Loading stock matrix...</div>
                ) : stockItems.length === 0 ? (
                    <div className="p-12 text-center text-slate-400">No inventory products found matching filters.</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 uppercase text-xs">
                                <tr>
                                    <th className="px-5 py-3.5 font-semibold">Product Code / SKU</th>
                                    <th className="px-5 py-3.5 font-semibold">Product Name</th>
                                    <th className="px-5 py-3.5 font-semibold">Warehouse</th>
                                    <th className="px-5 py-3.5 font-semibold text-right">Current Stock</th>
                                    <th className="px-5 py-3.5 font-semibold text-right">Available</th>
                                    <th className="px-5 py-3.5 font-semibold text-right">Valuation</th>
                                    <th className="px-5 py-3.5 font-semibold">Status</th>
                                    <th className="px-5 py-3.5 font-semibold text-right">Breakdown Page</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                {stockItems.map(item => (
                                    <tr key={item.productId} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                                        <td className="px-5 py-4 font-mono font-semibold text-slate-800 dark:text-slate-200">
                                            {item.productCode}
                                        </td>
                                        <td className="px-5 py-4 font-medium text-slate-900 dark:text-white">
                                            {item.productName}
                                            <span className="block text-xs text-slate-400 font-normal">{item.categoryName}</span>
                                        </td>
                                        <td className="px-5 py-4 text-slate-600 dark:text-slate-300 text-xs">
                                            {item.warehouseName}
                                        </td>
                                        <td className="px-5 py-4 font-bold text-right text-slate-900 dark:text-white">
                                            {item.currentStock}
                                        </td>
                                        <td className="px-5 py-4 font-bold text-right text-teal-600 dark:text-teal-400">
                                            {item.availableStock}
                                        </td>
                                        <td className="px-5 py-4 text-right font-medium text-slate-800 dark:text-slate-200">
                                            {formatCurrency(item.stockValue)}
                                        </td>
                                        <td className="px-5 py-4">
                                            {getStatusBadge(item.stockStatus)}
                                        </td>
                                        <td className="px-5 py-4 text-right">
                                            <button
                                                onClick={() => navigate(`/inventory/stock/${item.productId}`)}
                                                className="px-3 py-1.5 text-xs font-semibold bg-teal-50 dark:bg-teal-950 text-teal-700 dark:text-teal-300 rounded-lg hover:bg-teal-100 dark:hover:bg-teal-900 transition-colors inline-flex items-center gap-1"
                                            >
                                                <MdAccountTree /> View Breakdown
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default StockMatrix;
