import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    MdArrowBack,
    MdStorefront,
    MdEmail,
    MdPhone,
    MdLocationOn,
    MdRequestQuote,
    MdShoppingCart,
    MdReceipt,
    MdTimeline,
    MdInventory,
    MdPeople,
    MdBadge
} from 'react-icons/md';
import { toast } from 'react-toastify';
import { vendorService } from '../services/api';

const TABS = [
    { id: 'overview', label: 'Overview', icon: <MdStorefront size={18} /> },
    { id: 'products', label: 'Supplied Products', icon: <MdInventory size={18} /> },
    { id: 'purchases', label: 'Invoice Vouchers', icon: <MdShoppingCart size={18} /> },
    { id: 'quotations', label: 'Quotations Linked', icon: <MdRequestQuote size={18} /> },
    { id: 'contacts', label: 'Vendor Contacts', icon: <MdPeople size={18} /> },
    { id: 'timeline', label: 'Interaction Timeline', icon: <MdTimeline size={18} /> }
];

const Vendor360Workspace = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('overview');
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState(null);

    useEffect(() => {
        const fetchVendor360 = async () => {
            setLoading(true);
            try {
                const res = await vendorService.get360Data(id);
                setData(res.data);
            } catch (err) {
                console.error('Error fetching Vendor 360 data:', err);
                toast.error('Failed to load Vendor 360 profile');
                navigate('/vendors');
            } finally {
                setLoading(false);
            }
        };
        fetchVendor360();
    }, [id, navigate]);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] py-20">
                <div className="w-12 h-12 rounded-full border-4 border-primary-600 border-t-transparent animate-spin mb-4"></div>
                <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Assembling Vendor 360 Profile...</p>
            </div>
        );
    }

    if (!data) return null;

    const { vendor, products = [], purchases = [], quotations = [], contacts = [], timeline = [], stats = {} } = data;

    return (
        <div className="space-y-8 font-outfit pb-12">
            {/* Back Button */}
            <button
                onClick={() => navigate('/vendors')}
                className="flex items-center gap-2 text-slate-500 hover:text-primary-600 font-bold text-xs uppercase tracking-widest transition-colors"
            >
                <MdArrowBack size={18} />
                Back to Vendors List
            </button>

            {/* Profile Overview Header Block */}
            <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm relative overflow-hidden flex flex-col lg:flex-row lg:items-center justify-between gap-8">
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary-100/30 rounded-full blur-2xl pointer-events-none"></div>
                <div className="flex items-start md:items-center gap-6">
                    <div className="h-20 w-20 bg-primary-50 text-primary-600 rounded-2xl p-2 shadow-sm shrink-0 flex items-center justify-center font-black text-3xl">
                        {vendor.name ? vendor.name.substring(0, 1).toUpperCase() : 'V'}
                    </div>
                    <div>
                        <div className="flex items-center gap-3 flex-wrap">
                            <h1 className="text-2xl font-black text-slate-900 leading-tight">{vendor.name}</h1>
                            <span className={`text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full border ${
                                vendor.isActive ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-slate-50 border-slate-100 text-slate-600'
                            }`}>
                                {vendor.isActive ? 'Active Supplier' : 'Inactive'}
                            </span>
                        </div>
                        <p className="text-slate-500 font-semibold mt-2 text-sm flex items-center gap-2">
                            <MdBadge className="text-primary-500" /> Contact Person: <span className="text-slate-800 font-bold">{vendor.contactPerson || 'N/A'}</span>
                        </p>
                        <div className="mt-3 flex items-center gap-4 text-xs font-bold text-slate-400 flex-wrap">
                            <span className="flex items-center gap-1"><MdPhone /> {vendor.phone || 'No Phone'}</span>
                            <span className="flex items-center gap-1"><MdEmail /> {vendor.email || 'No Email'}</span>
                            <span className="flex items-center gap-1"><MdLocationOn /> {vendor.address || 'No Address'}</span>
                        </div>
                    </div>
                </div>

                {/* Quick Stats Widget */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100 shrink-0">
                    <div className="text-center px-3">
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Purchases</div>
                        <div className="text-lg font-black text-primary-600">₹{(stats.totalPurchases || 0).toLocaleString()}</div>
                    </div>
                    <div className="text-center px-3 border-l border-slate-200">
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Orders</div>
                        <div className="text-lg font-black text-slate-800">{stats.purchaseCount || 0}</div>
                    </div>
                    <div className="text-center px-3 border-l border-slate-200">
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Products</div>
                        <div className="text-lg font-black text-slate-800">{stats.productCount || 0}</div>
                    </div>
                    <div className="text-center px-3 border-l border-slate-200">
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Quotes</div>
                        <div className="text-lg font-black text-slate-800">{stats.quotationCount || 0}</div>
                    </div>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center gap-2 border-b border-slate-200 overflow-x-auto pb-2 scrollbar-none">
                {TABS.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all shrink-0 ${
                            activeTab === tab.id
                                ? 'bg-primary-600 text-white shadow-lg shadow-primary-600/20'
                                : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
                        }`}
                    >
                        {tab.icon}
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab Content Areas */}
            <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm min-h-[400px]">
                {/* OVERVIEW TAB */}
                {activeTab === 'overview' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <div className="space-y-6">
                            <h3 className="font-black text-slate-800 text-sm uppercase tracking-wider border-b border-slate-100 pb-3">Vendor Master Information</h3>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <span className="text-slate-400 text-xs font-bold uppercase block">Vendor Name</span>
                                    <span className="font-bold text-slate-800">{vendor.name}</span>
                                </div>
                                <div>
                                    <span className="text-slate-400 text-xs font-bold uppercase block">GSTIN</span>
                                    <span className="font-mono font-bold text-slate-800">{vendor.gstin || '-'}</span>
                                </div>
                                <div>
                                    <span className="text-slate-400 text-xs font-bold uppercase block">Contact Person</span>
                                    <span className="font-bold text-slate-800">{vendor.contactPerson || '-'}</span>
                                </div>
                                <div>
                                    <span className="text-slate-400 text-xs font-bold uppercase block">Phone Number</span>
                                    <span className="font-bold text-slate-800">{vendor.phone || '-'}</span>
                                </div>
                                <div>
                                    <span className="text-slate-400 text-xs font-bold uppercase block">Email Address</span>
                                    <span className="font-bold text-slate-800">{vendor.email || '-'}</span>
                                </div>
                                <div>
                                    <span className="text-slate-400 text-xs font-bold uppercase block">Status</span>
                                    <span className={`inline-block px-2.5 py-0.5 rounded text-[10px] font-black uppercase ${vendor.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                                        {vendor.isActive ? 'Active' : 'Inactive'}
                                    </span>
                                </div>
                                <div className="col-span-2">
                                    <span className="text-slate-400 text-xs font-bold uppercase block">Address</span>
                                    <span className="font-medium text-slate-700">{vendor.address || 'No address provided'}</span>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-6">
                            <h3 className="font-black text-slate-800 text-sm uppercase tracking-wider border-b border-slate-100 pb-3">Supply Summary</h3>
                            <div className="p-6 bg-slate-50 rounded-2xl space-y-4">
                                <div className="flex justify-between items-center text-xs font-bold">
                                    <span className="text-slate-500 uppercase">Total Billed Purchase Value</span>
                                    <span className="text-emerald-600 text-base font-black">₹{(stats.totalPurchases || 0).toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between items-center text-xs font-bold">
                                    <span className="text-slate-500 uppercase">Total Items Supplied</span>
                                    <span className="text-slate-800 text-sm font-black">{stats.totalItemsPurchased || 0}</span>
                                </div>
                                <div className="flex justify-between items-center text-xs font-bold">
                                    <span className="text-slate-500 uppercase">Registered Catalog Products</span>
                                    <span className="text-slate-800 text-sm font-black">{stats.productCount || 0}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* SUPPLIED PRODUCTS TAB */}
                {activeTab === 'products' && (
                    <div className="space-y-6">
                        <h3 className="font-black text-slate-800 text-sm uppercase tracking-wider">Catalog Products Supplied</h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50 text-[10px] uppercase font-black tracking-widest border-b border-slate-100 text-slate-400">
                                    <tr>
                                        <th className="px-6 py-4">Product Name</th>
                                        <th className="px-6 py-4">Product Code</th>
                                        <th className="px-6 py-4">Category</th>
                                        <th className="px-6 py-4 text-right">Base Price</th>
                                        <th className="px-6 py-4 text-right">Stock</th>
                                    </tr>
                                </thead>
                                <tbody className="text-xs font-bold text-slate-700 divide-y divide-slate-50">
                                    {products.map(p => (
                                        <tr key={p._id} className="hover:bg-slate-50/50">
                                            <td className="px-6 py-4 font-black text-slate-900">{p.productName}</td>
                                            <td className="px-6 py-4 font-mono">{p.productCode || '-'}</td>
                                            <td className="px-6 py-4 text-slate-500">{p.catalogType || 'Product'}</td>
                                            <td className="px-6 py-4 text-right font-mono">₹{(p.basePrice || 0).toLocaleString()}</td>
                                            <td className="px-6 py-4 text-right font-mono">{p.inventory?.currentStock || 0}</td>
                                        </tr>
                                    ))}
                                    {products.length === 0 && (
                                        <tr>
                                            <td colSpan="5" className="p-8 text-center text-slate-400 font-bold uppercase tracking-widest text-xs">No products linked to this vendor.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* PURCHASES TAB */}
                {activeTab === 'purchases' && (
                    <div className="space-y-6">
                        <h3 className="font-black text-slate-800 text-sm uppercase tracking-wider">Invoice Vouchers</h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50 text-[10px] uppercase font-black tracking-widest border-b border-slate-100 text-slate-400">
                                    <tr>
                                        <th className="px-6 py-4">Voucher Number</th>
                                        <th className="px-6 py-4">Total Qty</th>
                                        <th className="px-6 py-4 text-right">Tax Amount</th>
                                        <th className="px-6 py-4 text-right">Grand Total</th>
                                        <th className="px-6 py-4 text-right">Date</th>
                                    </tr>
                                </thead>
                                <tbody className="text-xs font-bold text-slate-700 divide-y divide-slate-50">
                                    {purchases.map(p => (
                                        <tr key={p._id} className="hover:bg-slate-50/50">
                                            <td className="px-6 py-4 font-mono font-black text-slate-900">{p.voucherNumber}</td>
                                            <td className="px-6 py-4 font-mono">{p.totalQty || 0}</td>
                                            <td className="px-6 py-4 text-right font-mono">₹{(p.totalTax || 0).toLocaleString()}</td>
                                            <td className="px-6 py-4 text-right font-mono text-primary-600 font-black">₹{(p.grandTotal || 0).toLocaleString()}</td>
                                            <td className="px-6 py-4 text-right text-slate-400">{new Date(p.date || p.createdAt).toLocaleDateString()}</td>
                                        </tr>
                                    ))}
                                    {purchases.length === 0 && (
                                        <tr>
                                            <td colSpan="5" className="p-8 text-center text-slate-400 font-bold uppercase tracking-widest text-xs">No invoice vouchers found for this vendor.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* QUOTATIONS TAB */}
                {activeTab === 'quotations' && (
                    <div className="space-y-6">
                        <h3 className="font-black text-slate-800 text-sm uppercase tracking-wider">Quotations Using Vendor Products</h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50 text-[10px] uppercase font-black tracking-widest border-b border-slate-100 text-slate-400">
                                    <tr>
                                        <th className="px-6 py-4">Quotation No</th>
                                        <th className="px-6 py-4">Customer</th>
                                        <th className="px-6 py-4 text-right">Grand Total</th>
                                        <th className="px-6 py-4">Status</th>
                                        <th className="px-6 py-4 text-right">Date</th>
                                    </tr>
                                </thead>
                                <tbody className="text-xs font-bold text-slate-700 divide-y divide-slate-50">
                                    {quotations.map(q => (
                                        <tr key={q._id} className="hover:bg-slate-50/50">
                                            <td className="px-6 py-4 font-mono font-black text-slate-900">{q.quotationNumber || q.quotationNo}</td>
                                            <td className="px-6 py-4">{q.customerName || '-'}</td>
                                            <td className="px-6 py-4 text-right font-mono text-slate-900">₹{(q.grandTotal || 0).toLocaleString()}</td>
                                            <td className="px-6 py-4">
                                                <span className="text-[10px] font-black uppercase bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">
                                                    {q.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right text-slate-400">{new Date(q.createdAt).toLocaleDateString()}</td>
                                        </tr>
                                    ))}
                                    {quotations.length === 0 && (
                                        <tr>
                                            <td colSpan="5" className="p-8 text-center text-slate-400 font-bold uppercase tracking-widest text-xs">No linked quotations found.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* VENDOR CONTACTS TAB */}
                {activeTab === 'contacts' && (
                    <div className="space-y-6">
                        <h3 className="font-black text-slate-800 text-sm uppercase tracking-wider">Associated Contact Persons</h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50 text-[10px] uppercase font-black tracking-widest border-b border-slate-100 text-slate-400">
                                    <tr>
                                        <th className="px-6 py-4">Contact Name</th>
                                        <th className="px-6 py-4">Designation</th>
                                        <th className="px-6 py-4">Email</th>
                                        <th className="px-6 py-4">Phone</th>
                                    </tr>
                                </thead>
                                <tbody className="text-xs font-bold text-slate-700 divide-y divide-slate-50">
                                    {contacts.map(c => (
                                        <tr key={c._id} className="hover:bg-slate-50/50">
                                            <td className="px-6 py-4 font-black text-slate-900">{c.contactName}</td>
                                            <td className="px-6 py-4 text-slate-500">{c.designation || '-'}</td>
                                            <td className="px-6 py-4">{c.email || '-'}</td>
                                            <td className="px-6 py-4">{c.phone || '-'}</td>
                                        </tr>
                                    ))}
                                    {contacts.length === 0 && (
                                        <tr>
                                            <td colSpan="4" className="p-8 text-center text-slate-400 font-bold uppercase tracking-widest text-xs">No associated contacts found.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* TIMELINE TAB */}
                {activeTab === 'timeline' && (
                    <div className="space-y-6">
                        <h3 className="font-black text-slate-800 text-sm uppercase tracking-wider">Vendor Activity & Transaction History</h3>
                        <div className="relative border-l-2 border-slate-100 pl-6 ml-3 space-y-6">
                            {timeline.map((item, idx) => (
                                <div key={item.id || idx} className="relative">
                                    <div className="absolute -left-[31px] top-0 h-8 w-8 rounded-full bg-primary-50 border-2 border-white flex items-center justify-center text-primary-600 shadow-sm">
                                        <MdReceipt size={16} />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-black text-slate-900 text-sm">{item.title}</span>
                                            <span className="text-[10px] font-bold text-slate-400">
                                                {item.date ? new Date(item.date).toLocaleString() : ''}
                                            </span>
                                        </div>
                                        <p className="text-xs font-medium text-slate-600 mt-1">{item.description}</p>
                                    </div>
                                </div>
                            ))}
                            {timeline.length === 0 && (
                                <p className="text-slate-400 font-bold text-xs uppercase">No timeline events recorded.</p>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Vendor360Workspace;
