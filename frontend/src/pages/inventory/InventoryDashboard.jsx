import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import {
    MdInventory,
    MdStorefront,
    MdCompareArrows,
    MdWarning,
    MdCheckCircle,
    MdTrendingUp,
    MdRefresh,
    MdArrowForward,
    MdTune,
    MdFactCheck
} from 'react-icons/md';
import { Link } from 'react-router-dom';

const API_BASE = '/inventory';

const InventoryDashboard = () => {
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        totalStockValue: 0,
        totalProducts: 0,
        lowStockCount: 0,
        outOfStockCount: 0,
        pendingTransfersCount: 0,
        activeWarehousesCount: 0
    });
    const [recentMovements, setRecentMovements] = useState([]);
    const [activeAlerts, setActiveAlerts] = useState([]);

    const fetchDashboardData = async () => {
        setLoading(true);
        try {
            const [stockRes, transferRes, alertRes, whRes, ledgerRes] = await Promise.all([
                api.get(`${API_BASE}/stock?limit=200`),
                api.get(`${API_BASE}/transfers?status=PENDING_APPROVAL`),
                api.get(`${API_BASE}/alerts?isResolved=false&limit=5`),
                api.get(`${API_BASE}/warehouses?isActive=true`),
                api.get(`${API_BASE}/reports/ledger?limit=10`)
            ]);

            const stockItems = stockRes.data?.stock || [];
            let totalValue = 0;
            let lowCount = 0;
            let outCount = 0;

            stockItems.forEach(item => {
                totalValue += item.stockValue || 0;
                if (item.stockStatus === 'LOW_STOCK') lowCount++;
                if (item.stockStatus === 'OUT_OF_STOCK') outCount++;
            });

            setStats({
                totalStockValue: totalValue,
                totalProducts: stockRes.data?.total || stockItems.length,
                lowStockCount: lowCount,
                outOfStockCount: outCount,
                pendingTransfersCount: transferRes.data?.total || 0,
                activeWarehousesCount: whRes.data?.total || 0
            });

            setRecentMovements(ledgerRes.data?.transactions || []);
            setActiveAlerts(alertRes.data?.alerts || []);
        } catch (error) {
            console.error('Error loading inventory dashboard:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0
        }).format(amount || 0);
    };

    const getTransactionTypeBadge = (type) => {
        switch (type) {
            case 'STOCK_IN':
                return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">Stock In</span>;
            case 'STOCK_OUT':
                return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">Stock Out</span>;
            case 'TRANSFER_IN':
            case 'TRANSFER_OUT':
                return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">Transfer</span>;
            case 'ADJUSTMENT_ADD':
            case 'ADJUSTMENT_SUB':
                return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">Adjustment</span>;
            default:
                return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300">{type}</span>;
        }
    };

    return (
        <div className="p-6 space-y-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <MdInventory className="text-teal-600 dark:text-teal-400" /> Inventory Dashboard
                    </h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        Real-time stock ledger valuation, warehouse distribution, and movement tracking.
                    </p>
                </div>
                <button
                    onClick={fetchDashboardData}
                    className="flex items-center gap-2 px-4 py-2 bg-teal-50 dark:bg-teal-950 text-teal-700 dark:text-teal-300 rounded-xl hover:bg-teal-100 dark:hover:bg-teal-900 transition-colors font-medium text-sm self-start md:self-auto"
                >
                    <MdRefresh className={`text-lg ${loading ? 'animate-spin' : ''}`} /> Refresh Data
                </button>
            </div>

            {/* KPI Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {/* Total Valuation */}
                <div className="bg-gradient-to-br from-teal-600 to-teal-800 text-white p-6 rounded-2xl shadow-lg relative overflow-hidden">
                    <div className="absolute top-0 right-0 -mr-4 -mt-4 w-24 h-24 bg-white/10 rounded-full blur-xl pointer-events-none"></div>
                    <p className="text-xs uppercase font-semibold text-teal-100 tracking-wider">Total Stock Value</p>
                    <h3 className="text-2xl font-bold mt-2">{formatCurrency(stats.totalStockValue)}</h3>
                    <p className="text-xs text-teal-200 mt-3 flex items-center gap-1">
                        <MdTrendingUp /> Across {stats.totalProducts} mastered products
                    </p>
                </div>

                {/* Low & Out of Stock Alerts */}
                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                    <div className="flex items-center justify-between">
                        <p className="text-xs uppercase font-semibold text-slate-500 dark:text-slate-400">Stock Alerts</p>
                        <MdWarning className="text-amber-500 text-xl" />
                    </div>
                    <div className="flex items-baseline gap-3 mt-2">
                        <h3 className="text-2xl font-bold text-slate-900 dark:text-white">{stats.lowStockCount + stats.outOfStockCount}</h3>
                        <span className="text-xs font-medium text-amber-600 dark:text-amber-400">Low / Out of Stock</span>
                    </div>
                    <div className="flex gap-4 mt-3 text-xs text-slate-500 dark:text-slate-400">
                        <span className="text-amber-600 font-semibold">{stats.lowStockCount} Low</span>
                        <span className="text-rose-600 font-semibold">{stats.outOfStockCount} Out of Stock</span>
                    </div>
                </div>

                {/* Pending Transfers */}
                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                    <div className="flex items-center justify-between">
                        <p className="text-xs uppercase font-semibold text-slate-500 dark:text-slate-400">Pending Transfers</p>
                        <MdCompareArrows className="text-indigo-500 text-xl" />
                    </div>
                    <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-2">{stats.pendingTransfersCount}</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-3">Awaiting manager approval</p>
                </div>

                {/* Active Warehouses */}
                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                    <div className="flex items-center justify-between">
                        <p className="text-xs uppercase font-semibold text-slate-500 dark:text-slate-400">Active Warehouses</p>
                        <MdStorefront className="text-teal-500 text-xl" />
                    </div>
                    <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-2">{stats.activeWarehousesCount}</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-3">Active storage locations</p>
                </div>
            </div>

            {/* Quick Action Navigation Buttons */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Link to="/inventory/stock" className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-teal-500 dark:hover:border-teal-500 transition-all flex items-center justify-between group shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-teal-50 dark:bg-teal-950 text-teal-600 dark:text-teal-300 rounded-lg">
                            <MdInventory className="text-xl" />
                        </div>
                        <span className="font-semibold text-sm text-slate-900 dark:text-white">Items Matrix</span>
                    </div>
                    <MdArrowForward className="text-slate-400 group-hover:translate-x-1 transition-transform" />
                </Link>

                <Link to="/inventory/transfers" className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-indigo-500 dark:hover:border-indigo-500 transition-all flex items-center justify-between group shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-300 rounded-lg">
                            <MdCompareArrows className="text-xl" />
                        </div>
                        <span className="font-semibold text-sm text-slate-900 dark:text-white">Stock Transfers</span>
                    </div>
                    <MdArrowForward className="text-slate-400 group-hover:translate-x-1 transition-transform" />
                </Link>

                <Link to="/inventory/adjustments" className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-amber-500 dark:hover:border-amber-500 transition-all flex items-center justify-between group shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-300 rounded-lg">
                            <MdTune className="text-xl" />
                        </div>
                        <span className="font-semibold text-sm text-slate-900 dark:text-white">Adjustments</span>
                    </div>
                    <MdArrowForward className="text-slate-400 group-hover:translate-x-1 transition-transform" />
                </Link>

                <Link to="/inventory/counts" className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-emerald-500 dark:hover:border-emerald-500 transition-all flex items-center justify-between group shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-300 rounded-lg">
                            <MdFactCheck className="text-xl" />
                        </div>
                        <span className="font-semibold text-sm text-slate-900 dark:text-white">Physical Audit</span>
                    </div>
                    <MdArrowForward className="text-slate-400 group-hover:translate-x-1 transition-transform" />
                </Link>
            </div>

            {/* Recent Movements Feed */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <MdTrendingUp className="text-teal-600" /> Recent Stock Movements
                    </h2>
                    <Link to="/inventory/reports" className="text-xs font-semibold text-teal-600 hover:underline">
                        View Full Ledger
                    </Link>
                </div>

                {loading ? (
                    <div className="p-8 text-center text-slate-400">Loading stock movements...</div>
                ) : recentMovements.length === 0 ? (
                    <div className="p-8 text-center text-slate-400">No recent transactions logged in Stock Ledger.</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 uppercase text-xs">
                                <tr>
                                    <th className="px-4 py-3 font-semibold">Txn #</th>
                                    <th className="px-4 py-3 font-semibold">Type</th>
                                    <th className="px-4 py-3 font-semibold">Product</th>
                                    <th className="px-4 py-3 font-semibold">Warehouse</th>
                                    <th className="px-4 py-3 font-semibold text-right">Quantity</th>
                                    <th className="px-4 py-3 font-semibold">Date</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                {recentMovements.map(txn => (
                                    <tr key={txn._id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                                        <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-700 dark:text-slate-300">
                                            {txn.transactionNumber}
                                        </td>
                                        <td className="px-4 py-3">
                                            {getTransactionTypeBadge(txn.transactionType)}
                                        </td>
                                        <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">
                                            {txn.productId?.productName || 'N/A'}
                                            <span className="block text-xs text-slate-400 font-mono">{txn.productId?.productCode}</span>
                                        </td>
                                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                                            {txn.warehouseId?.warehouseName || 'Main Warehouse'}
                                        </td>
                                        <td className={`px-4 py-3 font-bold text-right ${txn.quantityDelta > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                            {txn.quantityDelta > 0 ? `+${txn.quantityDelta}` : txn.quantityDelta}
                                        </td>
                                        <td className="px-4 py-3 text-xs text-slate-400">
                                            {new Date(txn.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
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

export default InventoryDashboard;
