import React, { useState, useEffect } from 'react';
import { orderService } from '../services/api';
import { toast } from 'react-toastify';
import { MdReceipt, MdAssignment, MdShoppingCart, MdOutlineLocalAtm } from 'react-icons/md';

const Orders = () => {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchOrders();
    }, []);

    const fetchOrders = async () => {
        setLoading(true);
        try {
            const res = await orderService.getAll();
            setOrders(res.data);
        } catch (err) {
            toast.error("Failed to load sales orders");
        } finally {
            setLoading(false);
        }
    };

    const handleConvertToInvoice = async (id, orderNo) => {
        try {
            await orderService.convertToInvoice(id);
            toast.success(`Sales Order ${orderNo} successfully converted to Invoice!`);
            fetchOrders();
        } catch (err) {
            toast.error("Invoice conversion failed");
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-black text-slate-900 tracking-tight">Sales Orders Register</h1>
                <p className="text-slate-500 font-medium font-outfit uppercase text-[10px] tracking-widest">Enterprise Lifecycle Fulfillment</p>
            </div>

            <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
                {loading ? (
                    <div className="text-center p-12 text-slate-400 font-bold">Loading orders...</div>
                ) : orders.length === 0 ? (
                    <div className="text-center p-12 text-slate-400 font-bold flex flex-col items-center gap-2">
                        <MdShoppingCart size={40} className="text-slate-300" />
                        <span>No orders logged in system. Convert an approved quotation to a sales order.</span>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-slate-100 text-slate-400 text-[10px] font-black uppercase tracking-widest bg-slate-50/50">
                                    <th className="px-6 py-4">Order Number</th>
                                    <th className="px-6 py-4">Customer</th>
                                    <th className="px-6 py-4">Value</th>
                                    <th className="px-6 py-4">Order Date</th>
                                    <th className="px-6 py-4">Status</th>
                                    <th className="px-6 py-4 text-right">Outward Invoicing</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 text-sm font-semibold">
                                {orders.map(o => (
                                    <tr key={o._id} className="hover:bg-slate-50/50 transition-all">
                                        <td className="px-6 py-4 font-black text-slate-900">{o.orderNumber}</td>
                                        <td className="px-6 py-4 text-slate-700">{o.customerName}</td>
                                        <td className="px-6 py-4 font-extrabold text-slate-900">₹ {Number(o.grandTotal).toLocaleString()}</td>
                                        <td className="px-6 py-4 text-slate-500">{new Date(o.orderDate).toLocaleDateString()}</td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2.5 py-1 text-[10px] font-black rounded-lg uppercase ${o.status === 'Completed' ? 'bg-emerald-50 text-emerald-600' : 'bg-indigo-50 text-indigo-600'}`}>
                                                {o.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            {o.status !== 'Completed' ? (
                                                <button
                                                    onClick={() => handleConvertToInvoice(o._id, o.orderNumber)}
                                                    className="flex items-center gap-1 text-xs font-black text-primary-600 hover:text-primary-700 uppercase tracking-wider ml-auto"
                                                >
                                                    <MdOutlineLocalAtm size={18} /> Convert to Invoice
                                                </button>
                                            ) : (
                                                <span className="text-xs font-extrabold text-slate-400">Invoiced</span>
                                            )}
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

export default Orders;
