import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import {
    MdCompareArrows,
    MdAdd,
    MdSearch,
    MdCheckCircle,
    MdLocalShipping,
    MdMoveToInbox,
    MdCancel,
    MdClose,
    MdArrowForward,
    MdErrorOutline
} from 'react-icons/md';

const API_BASE = '/inventory';

const StockTransfers = () => {
    const navigate = useNavigate();
    const [transfers, setTransfers] = useState([]);
    const [warehouses, setWarehouses] = useState([]);
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);

    const [statusFilter, setStatusFilter] = useState('');
    const [search, setSearch] = useState('');

    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showDispatchModal, setShowDispatchModal] = useState(null);
    const [showReceiveModal, setShowReceiveModal] = useState(null);

    const [transferForm, setTransferForm] = useState({
        fromWarehouseId: '',
        toWarehouseId: '',
        notes: '',
        items: [{ productId: '', qtyRequested: 10 }]
    });

    const [dispatchItems, setDispatchItems] = useState([]);
    const [receiveItems, setReceiveItems] = useState([]);

    const fetchTransfers = async () => {
        setLoading(true);
        try {
            const res = await api.get(`${API_BASE}/transfers`, {
                params: { status: statusFilter, search }
            });
            setTransfers(res.data?.transfers || []);
        } catch (error) {
            console.error('Error fetching transfers:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchInitialData = async () => {
        try {
            const [whRes, prodRes] = await Promise.all([
                api.get(`${API_BASE}/warehouses?isActive=true`),
                api.get('/products')
            ]);
            setWarehouses(whRes.data?.warehouses || []);
            setProducts(prodRes.data?.products || prodRes.data || []);
        } catch (error) {
            console.error('Error loading master data:', error);
        }
    };

    useEffect(() => {
        fetchInitialData();
    }, []);

    useEffect(() => {
        fetchTransfers();
    }, [statusFilter, search]);

    const handleCreateTransfer = async (e) => {
        e.preventDefault();
        if (transferForm.fromWarehouseId === transferForm.toWarehouseId) {
            alert('Source and Destination Warehouses cannot be the same!');
            return;
        }

        try {
            await api.post(`${API_BASE}/transfers`, transferForm);
            setShowCreateModal(false);
            fetchTransfers();
            alert('Stock transfer request created successfully!');
        } catch (error) {
            alert(error.response?.data?.message || 'Error creating transfer request');
        }
    };

    const handleApprove = async (id) => {
        if (!window.confirm('Approve this stock transfer request?')) return;
        try {
            await api.post(`${API_BASE}/transfers/${id}/approve`);
            fetchTransfers();
            alert('Transfer approved!');
        } catch (error) {
            alert(error.response?.data?.message || 'Error approving transfer');
        }
    };

    const handleOpenDispatch = (transfer) => {
        setShowDispatchModal(transfer);
        setDispatchItems(transfer.items.map(item => ({
            productId: item.productId._id || item.productId,
            productName: item.productId.productName,
            qtyRequested: item.qtyRequested,
            qtyDispatched: item.qtyRequested - (item.qtyDispatched || 0)
        })));
    };

    const handleDispatchSubmit = async (e) => {
        e.preventDefault();
        try {
            await api.post(`${API_BASE}/transfers/${showDispatchModal._id}/dispatch`, {
                items: dispatchItems
            });
            setShowDispatchModal(null);
            fetchTransfers();
            alert('Transfer dispatched successfully and Stock Ledger updated!');
        } catch (error) {
            alert(error.response?.data?.message || 'Error dispatching transfer');
        }
    };

    const handleOpenReceive = (transfer) => {
        setShowReceiveModal(transfer);
        setReceiveItems(transfer.items.map(item => ({
            productId: item.productId._id || item.productId,
            productName: item.productId.productName,
            qtyDispatched: item.qtyDispatched,
            qtyReceived: item.qtyDispatched - (item.qtyReceived || 0)
        })));
    };

    const handleReceiveSubmit = async (e) => {
        e.preventDefault();
        try {
            await api.post(`${API_BASE}/transfers/${showReceiveModal._id}/receive`, {
                items: receiveItems
            });
            setShowReceiveModal(null);
            fetchTransfers();
            alert('Transfer received successfully and Destination Stock updated!');
        } catch (error) {
            alert(error.response?.data?.message || 'Error receiving transfer');
        }
    };

    const handleReject = async (id) => {
        const reason = window.prompt('Enter rejection reason:');
        if (!reason) return;
        try {
            await api.post(`${API_BASE}/transfers/${id}/reject`, { rejectionReason: reason });
            fetchTransfers();
            alert('Transfer rejected!');
        } catch (error) {
            alert(error.response?.data?.message || 'Error rejecting transfer');
        }
    };

    const getStatusBadge = (status) => {
        switch (status) {
            case 'PENDING_APPROVAL':
                return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">Pending Approval</span>;
            case 'APPROVED':
                return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300">Approved</span>;
            case 'DISPATCHED':
                return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">Dispatched</span>;
            case 'PARTIALLY_RECEIVED':
                return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300">Partially Received</span>;
            case 'COMPLETED':
                return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">Completed</span>;
            case 'REJECTED':
                return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">Rejected</span>;
            default:
                return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-slate-100 text-slate-800">{status}</span>;
        }
    };

    return (
        <div className="p-6 space-y-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <MdCompareArrows className="text-teal-600 dark:text-teal-400" /> Stock Transfer Workflow
                    </h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        Request, approve, dispatch, and receive stock between warehouses with full ledger verification.
                    </p>
                </div>
                <button
                    onClick={() => navigate('/inventory/transfers/new')}
                    className="flex items-center gap-2 px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-medium rounded-xl transition-all shadow-md text-sm"
                >
                    <MdAdd className="text-lg" /> New Transfer Request
                </button>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                    <MdSearch className="absolute left-3.5 top-3 text-slate-400 text-lg" />
                    <input
                        type="text"
                        placeholder="Search transfer number..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-teal-500"
                    />
                </div>

                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-teal-500"
                >
                    <option value="">All Transfer Statuses</option>
                    <option value="PENDING_APPROVAL">Pending Approval</option>
                    <option value="APPROVED">Approved</option>
                    <option value="DISPATCHED">Dispatched</option>
                    <option value="PARTIALLY_RECEIVED">Partially Received</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="REJECTED">Rejected</option>
                </select>
            </div>

            {/* Transfer Directory Table */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
                {loading ? (
                    <div className="p-12 text-center text-slate-400">Loading transfer register...</div>
                ) : transfers.length === 0 ? (
                    <div className="p-12 text-center text-slate-400">No stock transfers found.</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 uppercase text-xs">
                                <tr>
                                    <th className="px-5 py-3.5 font-semibold">Transfer #</th>
                                    <th className="px-5 py-3.5 font-semibold">Route</th>
                                    <th className="px-5 py-3.5 font-semibold">Items</th>
                                    <th className="px-5 py-3.5 font-semibold">Status</th>
                                    <th className="px-5 py-3.5 font-semibold">Requested By</th>
                                    <th className="px-5 py-3.5 font-semibold text-right">Workflow Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                {transfers.map(tr => (
                                    <tr key={tr._id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                                        <td className="px-5 py-4 font-mono font-semibold text-slate-800 dark:text-slate-200">
                                            {tr.transferNumber}
                                        </td>
                                        <td className="px-5 py-4 text-xs font-medium text-slate-700 dark:text-slate-300">
                                            <span className="flex items-center gap-1.5">
                                                {tr.fromWarehouseId?.warehouseCode || 'WH-SRC'}
                                                <MdArrowForward className="text-teal-600" />
                                                {tr.toWarehouseId?.warehouseCode || 'WH-DEST'}
                                            </span>
                                        </td>
                                        <td className="px-5 py-4 text-xs text-slate-600 dark:text-slate-300">
                                            {tr.items?.length || 0} product line(s)
                                        </td>
                                        <td className="px-5 py-4">
                                            {getStatusBadge(tr.status)}
                                        </td>
                                        <td className="px-5 py-4 text-xs text-slate-500">
                                            {tr.requestedBy?.name || 'Manager'}
                                        </td>
                                        <td className="px-5 py-4 text-right space-x-2">
                                            {tr.status === 'PENDING_APPROVAL' && (
                                                <>
                                                    <button
                                                        onClick={() => handleApprove(tr._id)}
                                                        className="px-3 py-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 text-xs font-semibold rounded-lg"
                                                    >
                                                        Approve
                                                    </button>
                                                    <button
                                                        onClick={() => handleReject(tr._id)}
                                                        className="px-3 py-1 bg-rose-100 hover:bg-rose-200 text-rose-800 text-xs font-semibold rounded-lg"
                                                    >
                                                        Reject
                                                    </button>
                                                </>
                                            )}

                                            {tr.status === 'APPROVED' && (
                                                <button
                                                    onClick={() => handleOpenDispatch(tr)}
                                                    className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1 ml-auto"
                                                >
                                                    <MdLocalShipping /> Dispatch Material
                                                </button>
                                            )}

                                            {['DISPATCHED', 'PARTIALLY_RECEIVED'].includes(tr.status) && (
                                                <button
                                                    onClick={() => handleOpenReceive(tr)}
                                                    className="px-3 py-1 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1 ml-auto"
                                                >
                                                    <MdMoveToInbox /> Receive Stock
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Create Transfer Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-800 w-full max-w-2xl rounded-2xl p-6 shadow-2xl border border-slate-200 dark:border-slate-700 space-y-5">
                        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-700">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Create Stock Transfer Request</h3>
                            <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-600"><MdClose className="text-xl" /></button>
                        </div>

                        <form onSubmit={handleCreateTransfer} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Source Warehouse *</label>
                                    <select
                                        required
                                        value={transferForm.fromWarehouseId}
                                        onChange={(e) => setTransferForm({ ...transferForm, fromWarehouseId: e.target.value })}
                                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border rounded-xl text-sm"
                                    >
                                        <option value="">Select Source</option>
                                        {warehouses.map(w => <option key={w._id} value={w._id}>{w.warehouseName}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Destination Warehouse *</label>
                                    <select
                                        required
                                        value={transferForm.toWarehouseId}
                                        onChange={(e) => setTransferForm({ ...transferForm, toWarehouseId: e.target.value })}
                                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border rounded-xl text-sm"
                                    >
                                        <option value="">Select Destination</option>
                                        {warehouses.map(w => <option key={w._id} value={w._id}>{w.warehouseName}</option>)}
                                    </select>
                                </div>
                            </div>

                            {/* Item Row */}
                            <div className="space-y-2 pt-2">
                                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Items to Transfer</label>
                                {transferForm.items.map((item, idx) => (
                                    <div key={idx} className="flex gap-2 items-center text-xs">
                                        <select
                                            required
                                            value={item.productId}
                                            onChange={(e) => {
                                                const newItems = [...transferForm.items];
                                                newItems[idx].productId = e.target.value;
                                                setTransferForm({ ...transferForm, items: newItems });
                                            }}
                                            className="w-2/3 px-3 py-2 bg-slate-50 dark:bg-slate-900 border rounded-xl text-sm"
                                        >
                                            <option value="">Select Product</option>
                                            {products.map(p => <option key={p._id} value={p._id}>{p.productName} ({p.productCode})</option>)}
                                        </select>
                                        <input
                                            type="number"
                                            min="1"
                                            required
                                            value={item.qtyRequested}
                                            onChange={(e) => {
                                                const newItems = [...transferForm.items];
                                                newItems[idx].qtyRequested = Number(e.target.value);
                                                setTransferForm({ ...transferForm, items: newItems });
                                            }}
                                            className="w-1/3 px-3 py-2 bg-slate-50 dark:bg-slate-900 border rounded-xl text-sm"
                                            placeholder="Qty"
                                        />
                                    </div>
                                ))}
                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-700">
                                <button type="button" onClick={() => setShowCreateModal(false)} className="px-4 py-2 text-sm text-slate-600">Cancel</button>
                                <button type="submit" className="px-5 py-2 text-sm bg-teal-600 text-white rounded-xl">Submit Request</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Dispatch Modal */}
            {showDispatchModal && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-800 w-full max-w-xl rounded-2xl p-6 shadow-2xl border border-slate-200 dark:border-slate-700 space-y-5">
                        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-700">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Dispatch Material ({showDispatchModal.transferNumber})</h3>
                            <button onClick={() => setShowDispatchModal(null)} className="text-slate-400 hover:text-slate-600"><MdClose className="text-xl" /></button>
                        </div>
                        <form onSubmit={handleDispatchSubmit} className="space-y-4">
                            {dispatchItems.map((item, idx) => (
                                <div key={idx} className="flex justify-between items-center text-sm p-3 bg-slate-50 dark:bg-slate-900 rounded-xl">
                                    <div>
                                        <p className="font-semibold text-slate-900 dark:text-white">{item.productName}</p>
                                        <p className="text-xs text-slate-500">Requested: {item.qtyRequested}</p>
                                    </div>
                                    <input
                                        type="number"
                                        max={item.qtyRequested}
                                        min="1"
                                        value={item.qtyDispatched}
                                        onChange={(e) => {
                                            const updated = [...dispatchItems];
                                            updated[idx].qtyDispatched = Number(e.target.value);
                                            setDispatchItems(updated);
                                        }}
                                        className="w-24 px-3 py-1.5 border rounded-lg text-right font-bold"
                                    />
                                </div>
                            ))}
                            <div className="flex justify-end gap-3 pt-4 border-t">
                                <button type="button" onClick={() => setShowDispatchModal(null)} className="px-4 py-2 text-sm text-slate-600">Cancel</button>
                                <button type="submit" className="px-5 py-2 text-sm bg-indigo-600 text-white rounded-xl">Confirm Dispatch</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Receive Modal */}
            {showReceiveModal && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-800 w-full max-w-xl rounded-2xl p-6 shadow-2xl border border-slate-200 dark:border-slate-700 space-y-5">
                        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-700">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Receive Material ({showReceiveModal.transferNumber})</h3>
                            <button onClick={() => setShowReceiveModal(null)} className="text-slate-400 hover:text-slate-600"><MdClose className="text-xl" /></button>
                        </div>
                        <form onSubmit={handleReceiveSubmit} className="space-y-4">
                            {receiveItems.map((item, idx) => (
                                <div key={idx} className="flex justify-between items-center text-sm p-3 bg-slate-50 dark:bg-slate-900 rounded-xl">
                                    <div>
                                        <p className="font-semibold text-slate-900 dark:text-white">{item.productName}</p>
                                        <p className="text-xs text-slate-500">Dispatched: {item.qtyDispatched}</p>
                                    </div>
                                    <input
                                        type="number"
                                        max={item.qtyDispatched}
                                        min="1"
                                        value={item.qtyReceived}
                                        onChange={(e) => {
                                            const updated = [...receiveItems];
                                            updated[idx].qtyReceived = Number(e.target.value);
                                            setReceiveItems(updated);
                                        }}
                                        className="w-24 px-3 py-1.5 border rounded-lg text-right font-bold"
                                    />
                                </div>
                            ))}
                            <div className="flex justify-end gap-3 pt-4 border-t">
                                <button type="button" onClick={() => setShowReceiveModal(null)} className="px-4 py-2 text-sm text-slate-600">Cancel</button>
                                <button type="submit" className="px-5 py-2 text-sm bg-teal-600 text-white rounded-xl">Confirm Receipt</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StockTransfers;
