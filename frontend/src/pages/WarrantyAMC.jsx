import React, { useEffect, useState } from 'react';
import { csmService, customerService, productService } from '../services/api';
import { toast } from 'react-toastify';
import { 
    MdSecurity, MdAssignmentTurnedIn, MdCheckCircle, 
    MdAdd, MdSearch, MdInfoOutline, MdWarning 
} from 'react-icons/md';

const WarrantyAMC = () => {
    const [activeSection, setActiveSection] = useState('warranties');
    const [loading, setLoading] = useState(false);
    const [warranties, setWarranties] = useState([]);
    const [amcs, setAmcs] = useState([]);
    
    // Entitlements Verification Checker state
    const [verifyCust, setVerifyCust] = useState('');
    const [verifyProd, setVerifyProd] = useState('');
    const [entitlementRes, setEntitlementRes] = useState(null);
    const [verifying, setVerifying] = useState(false);

    // List dependencies for forms
    const [customers, setCustomers] = useState([]);
    const [products, setProducts] = useState([]);

    // Modal state
    const [showModal, setShowModal] = useState(false);
    const [formData, setFormData] = useState({
        customerId: '',
        productId: '',
        purchaseDate: '',
        expiryDate: '',
        serialNumber: '',
        contractNo: '',
        startDate: '',
        endDate: '',
        visitsAllowed: 4,
        amount: ''
    });

    const fetchLists = async () => {
        setLoading(true);
        try {
            if (activeSection === 'warranties') {
                const res = await csmService.getWarranties();
                setWarranties(res.data || []);
            } else {
                const res = await csmService.getAmcs();
                setAmcs(res.data || []);
            }
        } catch (error) {
            toast.error('Failed to load listings');
        } finally {
            setLoading(false);
        }
    };

    const loadFormDependencies = async () => {
        try {
            const [custRes, prodRes] = await Promise.all([
                customerService.getAll({ limit: 500 }),
                productService.getAll({ limit: 500 })
            ]);
            setCustomers(custRes.data?.data || custRes.data || []);
            setProducts(prodRes.data?.data || prodRes.data || []);
        } catch (error) {
            console.error('Error preloading entities:', error);
        }
    };

    useEffect(() => {
        fetchLists();
    }, [activeSection]);

    useEffect(() => {
        loadFormDependencies();
    }, []);

    const handleVerify = async (e) => {
        e.preventDefault();
        if (!verifyCust || !verifyProd) return;
        setVerifying(true);
        try {
            const res = await csmService.verifyEntitlements({
                customerId: verifyCust,
                productId: verifyProd
            });
            setEntitlementRes(res.data);
        } catch (error) {
            toast.error('Entitlements validation failed');
        } finally {
            setVerifying(false);
        }
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        try {
            if (activeSection === 'warranties') {
                await csmService.createWarranty({
                    customerId: formData.customerId,
                    productId: formData.productId,
                    purchaseDate: formData.purchaseDate,
                    expiryDate: formData.expiryDate,
                    serialNumber: formData.serialNumber
                });
                toast.success('Warranty registered successfully');
            } else {
                await csmService.createAmc({
                    customerId: formData.customerId,
                    contractNo: formData.contractNo,
                    startDate: formData.startDate,
                    endDate: formData.endDate,
                    visitsAllowed: formData.visitsAllowed,
                    amount: formData.amount
                });
                toast.success('AMC contract registered successfully');
            }
            setShowModal(false);
            fetchLists();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Registration failed');
        }
    };

    return (
        <div className="p-6 space-y-6 max-w-7xl mx-auto animate-fade-in-up">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-slate-900 font-outfit uppercase">
                        Entitlements & Contracts
                    </h1>
                    <p className="text-slate-500 font-semibold text-sm">
                        Manage customer warranties, product serial numbers, and annual maintenance contracts.
                    </p>
                </div>
                <button
                    onClick={() => {
                        setFormData({
                            customerId: '',
                            productId: '',
                            purchaseDate: '',
                            expiryDate: '',
                            serialNumber: '',
                            contractNo: '',
                            startDate: '',
                            endDate: '',
                            visitsAllowed: 4,
                            amount: ''
                        });
                        setShowModal(true);
                    }}
                    className="flex items-center gap-2 px-6 py-4 bg-primary-600 hover:bg-primary-700 text-white font-black uppercase text-[10px] tracking-widest rounded-2xl transition-all shadow-lg active:scale-95 self-start md:self-auto"
                >
                    <MdAdd size={18} />
                    {activeSection === 'warranties' ? 'Add Warranty' : 'Add AMC Contract'}
                </button>
            </div>

            {/* Verification Tool */}
            <div className="glass shadow-premium rounded-[2rem] p-6 bg-white border border-slate-100 grid grid-cols-1 lg:grid-cols-3 gap-6 items-center">
                <div className="lg:col-span-2 space-y-3">
                    <span className="text-[10px] font-black uppercase tracking-widest text-teal-600">Entitlements Sandbox</span>
                    <h3 className="text-lg font-black text-slate-900 font-outfit uppercase -mt-1">Verify Service Eligibility</h3>
                    <form onSubmit={handleVerify} className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                        <div>
                            <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Customer</label>
                            <select
                                required
                                value={verifyCust}
                                onChange={e => setVerifyCust(e.target.value)}
                                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold"
                            >
                                <option value="">Select Customer</option>
                                {customers.map(c => <option key={c._id} value={c._id}>{c.customerName}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Product</label>
                            <select
                                required
                                value={verifyProd}
                                onChange={e => setVerifyProd(e.target.value)}
                                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold"
                            >
                                <option value="">Select Product</option>
                                {products.map(p => <option key={p._id} value={p._id}>{p.productName}</option>)}
                            </select>
                        </div>
                        <button
                            type="submit"
                            disabled={verifying}
                            className="py-3 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-md"
                        >
                            {verifying ? 'Checking...' : 'Check Coverage'}
                        </button>
                    </form>
                </div>
                <div className="lg:col-span-1 border-t lg:border-t-0 lg:border-l border-slate-100 pt-4 lg:pt-0 lg:pl-6">
                    {entitlementRes ? (
                        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 text-xs font-bold">
                            <div className="flex items-center gap-1.5">
                                {entitlementRes.recommendedBillingType === 'Paid' ? (
                                    <MdWarning className="text-red-500" size={18} />
                                ) : (
                                    <MdCheckCircle className="text-teal-600" size={18} />
                                )}
                                <span className="text-slate-900">Billing recommendation: </span>
                            </div>
                            <div className="px-3 py-1.5 text-center text-white bg-slate-900 rounded-lg text-[10px] font-black uppercase tracking-widest">
                                {entitlementRes.recommendedBillingType}
                            </div>
                            {entitlementRes.warranty.isActive && (
                                <p className="text-[10px] text-teal-600">Active Warranty expires: {new Date(entitlementRes.warranty.expiryDate).toLocaleDateString()}</p>
                            )}
                            {entitlementRes.amc.isActive && (
                                <p className="text-[10px] text-primary-600">Active AMC contract: {entitlementRes.amc.contractNo} ({entitlementRes.amc.remainingVisits} remaining visits)</p>
                            )}
                        </div>
                    ) : (
                        <div className="text-center py-6 text-slate-400 text-xs font-semibold flex flex-col items-center justify-center">
                            <MdInfoOutline size={24} className="mb-1 text-slate-300" />
                            Run coverage checks in sandbox to review invoice validity.
                        </div>
                    )}
                </div>
            </div>

            {/* Toggle Sections */}
            <div className="flex border-b border-slate-200 gap-2">
                <button
                    onClick={() => setActiveSection('warranties')}
                    className={`flex items-center gap-2 px-6 py-4 border-b-2 font-bold text-sm transition-all ${
                        activeSection === 'warranties'
                            ? 'border-primary-600 text-primary-600 font-black'
                            : 'border-transparent text-slate-500 hover:text-slate-700'
                    }`}
                >
                    <MdSecurity size={18} />
                    Product Warranties
                </button>
                <button
                    onClick={() => setActiveSection('amc')}
                    className={`flex items-center gap-2 px-6 py-4 border-b-2 font-bold text-sm transition-all ${
                        activeSection === 'amc'
                            ? 'border-primary-600 text-primary-600 font-black'
                            : 'border-transparent text-slate-500 hover:text-slate-700'
                    }`}
                >
                    <MdAssignmentTurnedIn size={18} />
                    AMC Contracts
                </button>
            </div>

            {/* Table Listings */}
            <div className="glass shadow-premium rounded-[2rem] p-6 bg-white border border-slate-100">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 space-y-3">
                        <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin"></div>
                        <p className="text-slate-400 font-bold uppercase text-xs tracking-widest">Loading Records...</p>
                    </div>
                ) : activeSection === 'warranties' ? (
                    warranties.length === 0 ? (
                        <div className="text-center py-20 text-slate-400">
                            <p className="font-bold">No product warranties registered.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse text-sm">
                                <thead>
                                    <tr className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100">
                                        <th className="px-6 py-4">Serial Number</th>
                                        <th className="px-6 py-4">Customer</th>
                                        <th className="px-6 py-4">Product</th>
                                        <th className="px-6 py-4">Purchase Date</th>
                                        <th className="px-6 py-4">Expiry Date</th>
                                        <th className="px-6 py-4 text-center">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50 font-semibold text-slate-700">
                                    {warranties.map((w) => (
                                        <tr key={w._id} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="px-6 py-4 font-black text-slate-900">{w.serialNumber || 'N/A'}</td>
                                            <td className="px-6 py-4 text-slate-900">{w.customerId?.customerName}</td>
                                            <td className="px-6 py-4 text-slate-500">{w.productId?.productName}</td>
                                            <td className="px-6 py-4 text-slate-400">{new Date(w.purchaseDate).toLocaleDateString()}</td>
                                            <td className="px-6 py-4 text-slate-400">{new Date(w.expiryDate).toLocaleDateString()}</td>
                                            <td className="px-6 py-4 text-center">
                                                <span className={`px-3 py-1 rounded-full text-[10px] font-black border uppercase tracking-wider ${w.status === 'Active' ? 'bg-teal-50 text-teal-600 border-teal-200' : 'bg-rose-50 text-rose-500 border-rose-200'}`}>
                                                    {w.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )
                ) : (
                    amcs.length === 0 ? (
                        <div className="text-center py-20 text-slate-400">
                            <p className="font-bold">No AMC contracts registered.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse text-sm">
                                <thead>
                                    <tr className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100">
                                        <th className="px-6 py-4">Contract No</th>
                                        <th className="px-6 py-4">Customer</th>
                                        <th className="px-6 py-4">Duration</th>
                                        <th className="px-6 py-4">Visits (Allowed / Used)</th>
                                        <th className="px-6 py-4">Price</th>
                                        <th className="px-6 py-4 text-center">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50 font-semibold text-slate-700">
                                    {amcs.map((a) => (
                                        <tr key={a._id} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="px-6 py-4 font-black text-slate-900">{a.contractNo}</td>
                                            <td className="px-6 py-4 text-slate-900">{a.customerId?.customerName}</td>
                                            <td className="px-6 py-4 text-slate-400">{new Date(a.startDate).toLocaleDateString()} - {new Date(a.endDate).toLocaleDateString()}</td>
                                            <td className="px-6 py-4 text-slate-500">{a.visitsAllowed} Allowed / {a.visitsUsed} Used</td>
                                            <td className="px-6 py-4 font-black text-teal-600">₹{a.amount || 0}</td>
                                            <td className="px-6 py-4 text-center">
                                                <span className={`px-3 py-1 rounded-full text-[10px] font-black border uppercase tracking-wider ${a.status === 'Active' ? 'bg-teal-50 text-teal-600 border-teal-200' : 'bg-rose-50 text-rose-500 border-rose-200'}`}>
                                                    {a.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )
                )}
            </div>

            {/* Modal Add */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-[2rem] shadow-2xl border border-slate-100 max-w-md w-full overflow-hidden animate-scale-in">
                        <div className="px-6 py-5 border-b border-slate-50 bg-slate-50 flex items-center justify-between">
                            <h3 className="font-outfit font-black text-lg text-slate-900 uppercase">
                                {activeSection === 'warranties' ? 'Register Product Warranty' : 'Create AMC Contract'}
                            </h3>
                            <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
                        </div>
                        <form onSubmit={handleCreate} className="p-6 space-y-4">
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Customer *</label>
                                <select
                                    required
                                    value={formData.customerId}
                                    onChange={e => setFormData({ ...formData, customerId: e.target.value })}
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold"
                                >
                                    <option value="">Select Customer</option>
                                    {customers.map(c => <option key={c._id} value={c._id}>{c.customerName}</option>)}
                                </select>
                            </div>

                            {activeSection === 'warranties' ? (
                                <>
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Product *</label>
                                        <select
                                            required
                                            value={formData.productId}
                                            onChange={e => setFormData({ ...formData, productId: e.target.value })}
                                            className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold"
                                        >
                                            <option value="">Select Product</option>
                                            {products.map(p => <option key={p._id} value={p._id}>{p.productName}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Serial Number *</label>
                                        <input
                                            type="text"
                                            required
                                            value={formData.serialNumber}
                                            onChange={e => setFormData({ ...formData, serialNumber: e.target.value })}
                                            className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Purchase Date *</label>
                                            <input
                                                type="date"
                                                required
                                                value={formData.purchaseDate}
                                                onChange={e => setFormData({ ...formData, purchaseDate: e.target.value })}
                                                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Expiry Date *</label>
                                            <input
                                                type="date"
                                                required
                                                value={formData.expiryDate}
                                                onChange={e => setFormData({ ...formData, expiryDate: e.target.value })}
                                                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold"
                                            />
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Contract Number *</label>
                                        <input
                                            type="text"
                                            required
                                            value={formData.contractNo}
                                            onChange={e => setFormData({ ...formData, contractNo: e.target.value })}
                                            className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Start Date *</label>
                                            <input
                                                type="date"
                                                required
                                                value={formData.startDate}
                                                onChange={e => setFormData({ ...formData, startDate: e.target.value })}
                                                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">End Date *</label>
                                            <input
                                                type="date"
                                                required
                                                value={formData.endDate}
                                                onChange={e => setFormData({ ...formData, endDate: e.target.value })}
                                                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold"
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Allowed Visits *</label>
                                            <input
                                                type="number"
                                                required
                                                min="1"
                                                value={formData.visitsAllowed}
                                                onChange={e => setFormData({ ...formData, visitsAllowed: e.target.value })}
                                                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Contract Price *</label>
                                            <input
                                                type="number"
                                                required
                                                min="0"
                                                value={formData.amount}
                                                onChange={e => setFormData({ ...formData, amount: e.target.value })}
                                                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold"
                                            />
                                        </div>
                                    </div>
                                </>
                            )}
                            <div className="flex gap-3 pt-4 border-t border-slate-50">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 py-3.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg"
                                >
                                    Register
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default WarrantyAMC;
