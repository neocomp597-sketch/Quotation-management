import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import {
    MdAssessment,
    MdReceiptLong,
    MdAttachMoney,
    MdTrendingUp,
    MdDownload,
    MdSearch,
    MdFilterList
} from 'react-icons/md';

const API_BASE = '/inventory/reports';

const InventoryReports = () => {
    const [activeTab, setActiveTab] = useState('ledger');
    const [loading, setLoading] = useState(false);

    // Ledger state
    const [ledgerData, setLedgerData] = useState([]);
    const [ledgerFilter, setLedgerFilter] = useState({ transactionType: '', startDate: '', endDate: '' });

    // Valuation state
    const [valuationData, setValuationData] = useState({ grandTotalItems: 0, grandTotalValuation: 0, items: [] });

    // Movement state
    const [movementData, setMovementData] = useState({ report: [] });

    const fetchLedgerReport = async () => {
        setLoading(true);
        try {
            const res = await api.get(`${API_BASE}/ledger`, { params: ledgerFilter });
            setLedgerData(res.data?.transactions || []);
        } catch (error) {
            console.error('Error fetching ledger report:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchValuationReport = async () => {
        setLoading(true);
        try {
            const res = await api.get(`${API_BASE}/valuation`);
            setValuationData(res.data || { grandTotalItems: 0, grandTotalValuation: 0, items: [] });
        } catch (error) {
            console.error('Error fetching valuation report:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchMovementReport = async () => {
        setLoading(true);
        try {
            const res = await api.get(`${API_BASE}/movement?days=90`);
            setMovementData(res.data || { report: [] });
        } catch (error) {
            console.error('Error fetching movement report:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (activeTab === 'ledger') fetchLedgerReport();
        if (activeTab === 'valuation') fetchValuationReport();
        if (activeTab === 'movement') fetchMovementReport();
    }, [activeTab]);

    const formatCurrency = (val) => {
        return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val || 0);
    };

    return (
        <div className="p-6 space-y-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <MdAssessment className="text-teal-600 dark:text-teal-400" /> Inventory Reports & Analytics
                    </h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        Stock ledger register, valuation audit summary, and dead-stock velocity analytics.
                    </p>
                </div>
            </div>

            {/* Report Navigation Tabs */}
            <div className="flex border-b border-slate-200 dark:border-slate-700 gap-2">
                <button
                    onClick={() => setActiveTab('ledger')}
                    className={`px-5 py-3 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 ${
                        activeTab === 'ledger'
                            ? 'border-teal-600 text-teal-600 dark:text-teal-400'
                            : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                >
                    <MdReceiptLong /> Stock Ledger Register
                </button>
                <button
                    onClick={() => setActiveTab('valuation')}
                    className={`px-5 py-3 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 ${
                        activeTab === 'valuation'
                            ? 'border-teal-600 text-teal-600 dark:text-teal-400'
                            : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                >
                    <MdAttachMoney /> Valuation Summary
                </button>
                <button
                    onClick={() => setActiveTab('movement')}
                    className={`px-5 py-3 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 ${
                        activeTab === 'movement'
                            ? 'border-teal-600 text-teal-600 dark:text-teal-400'
                            : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                >
                    <MdTrendingUp /> Stock Movement & Velocity
                </button>
            </div>

            {/* TAB 1: Stock Ledger Register */}
            {activeTab === 'ledger' && (
                <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row gap-4 bg-white dark:bg-slate-800 p-4 rounded-xl border">
                        <select
                            value={ledgerFilter.transactionType}
                            onChange={(e) => setLedgerFilter({ ...ledgerFilter, transactionType: e.target.value })}
                            className="px-3 py-2 border rounded-xl text-sm"
                        >
                            <option value="">All Transaction Types</option>
                            <option value="STOCK_IN">Stock In</option>
                            <option value="STOCK_OUT">Stock Out</option>
                            <option value="TRANSFER_IN">Transfer In</option>
                            <option value="TRANSFER_OUT">Transfer Out</option>
                            <option value="ADJUSTMENT_ADD">Adjustment Add</option>
                            <option value="ADJUSTMENT_SUB">Adjustment Sub</option>
                        </select>

                        <button
                            onClick={fetchLedgerReport}
                            className="px-4 py-2 bg-teal-600 text-white rounded-xl text-sm font-medium hover:bg-teal-700"
                        >
                            Apply Filters
                        </button>
                    </div>

                    <div className="bg-white dark:bg-slate-800 rounded-2xl border overflow-hidden shadow-sm">
                        {loading ? (
                            <div className="p-8 text-center text-slate-400">Loading ledger register...</div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 uppercase text-xs">
                                        <tr>
                                            <th className="px-4 py-3">Txn #</th>
                                            <th className="px-4 py-3">Type</th>
                                            <th className="px-4 py-3">Product</th>
                                            <th className="px-4 py-3">Warehouse</th>
                                            <th className="px-4 py-3 text-right">Qty Delta</th>
                                            <th className="px-4 py-3 text-right">Unit Cost</th>
                                            <th className="px-4 py-3">Date</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {ledgerData.map(txn => (
                                            <tr key={txn._id} className="hover:bg-slate-50">
                                                <td className="px-4 py-3 font-mono text-xs font-semibold">{txn.transactionNumber}</td>
                                                <td className="px-4 py-3 text-xs font-semibold">{txn.transactionType}</td>
                                                <td className="px-4 py-3 font-medium">{txn.productId?.productName}</td>
                                                <td className="px-4 py-3">{txn.warehouseId?.warehouseName || 'Main'}</td>
                                                <td className={`px-4 py-3 font-bold text-right ${txn.quantityDelta > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                    {txn.quantityDelta > 0 ? `+${txn.quantityDelta}` : txn.quantityDelta}
                                                </td>
                                                <td className="px-4 py-3 text-right">{formatCurrency(txn.unitCost)}</td>
                                                <td className="px-4 py-3 text-xs text-slate-400">{new Date(txn.createdAt).toLocaleDateString('en-IN')}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* TAB 2: Valuation Summary */}
            {activeTab === 'valuation' && (
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-5 bg-teal-600 text-white rounded-2xl">
                            <p className="text-xs uppercase font-semibold text-teal-100">Grand Total Valuation</p>
                            <h3 className="text-2xl font-bold mt-1">{formatCurrency(valuationData.grandTotalValuation)}</h3>
                        </div>
                        <div className="p-5 bg-slate-800 text-white rounded-2xl">
                            <p className="text-xs uppercase font-semibold text-slate-400">Total Items Stocked</p>
                            <h3 className="text-2xl font-bold mt-1">{valuationData.grandTotalItems} units</h3>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-slate-800 rounded-2xl border overflow-hidden shadow-sm">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 uppercase text-xs">
                                    <tr>
                                        <th className="px-4 py-3">SKU</th>
                                        <th className="px-4 py-3">Product Name</th>
                                        <th className="px-4 py-3">Category</th>
                                        <th className="px-4 py-3 text-right">Current Stock</th>
                                        <th className="px-4 py-3 text-right">Unit Cost</th>
                                        <th className="px-4 py-3 text-right">Total Valuation</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {valuationData.items.map(item => (
                                        <tr key={item.productId} className="hover:bg-slate-50">
                                            <td className="px-4 py-3 font-mono text-xs font-semibold">{item.productCode}</td>
                                            <td className="px-4 py-3 font-medium">{item.productName}</td>
                                            <td className="px-4 py-3 text-xs text-slate-500">{item.categoryName}</td>
                                            <td className="px-4 py-3 font-bold text-right">{item.currentStock}</td>
                                            <td className="px-4 py-3 text-right">{formatCurrency(item.unitCost)}</td>
                                            <td className="px-4 py-3 font-bold text-teal-600 text-right">{formatCurrency(item.totalValuation)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 3: Movement Velocity */}
            {activeTab === 'movement' && (
                <div className="bg-white dark:bg-slate-800 rounded-2xl border overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 uppercase text-xs">
                                <tr>
                                    <th className="px-4 py-3">Product</th>
                                    <th className="px-4 py-3">Category</th>
                                    <th className="px-4 py-3 text-right">Current Stock</th>
                                    <th className="px-4 py-3 text-right">90-Day Outward Qty</th>
                                    <th className="px-4 py-3">Velocity Category</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {movementData.report.map(item => (
                                    <tr key={item.productId} className="hover:bg-slate-50">
                                        <td className="px-4 py-3 font-medium">{item.productName}</td>
                                        <td className="px-4 py-3 text-xs text-slate-500">{item.categoryName}</td>
                                        <td className="px-4 py-3 text-right font-bold">{item.currentStock}</td>
                                        <td className="px-4 py-3 text-right font-bold text-indigo-600">{item.outwardQtyInPeriod}</td>
                                        <td className="px-4 py-3">
                                            <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${
                                                item.velocityCategory === 'Fast Moving'
                                                    ? 'bg-emerald-100 text-emerald-800'
                                                    : item.velocityCategory === 'Slow Moving'
                                                    ? 'bg-amber-100 text-amber-800'
                                                    : 'bg-rose-100 text-rose-800'
                                            }`}>
                                                {item.velocityCategory}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default InventoryReports;
