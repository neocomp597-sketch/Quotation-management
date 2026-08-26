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
    MdBadge,
    MdAdd,
    MdEdit,
    MdDelete,
    MdFileUpload
} from 'react-icons/md';
import { toast } from 'react-toastify';
import { vendorService, vendorCatalogService } from '../services/api';
import Modal from '../components/Modal';
import ImportModal from '../components/ImportModal';

const TABS = [
    { id: 'overview', label: 'Overview', icon: <MdStorefront size={18} /> },
    { id: 'supplied', label: 'Supplied Products', icon: <MdInventory size={18} /> },
    { id: 'purchases', label: 'Invoice Vouchers', icon: <MdShoppingCart size={18} /> },
    { id: 'quotations', label: 'Quotations Linked', icon: <MdRequestQuote size={18} /> },
    { id: 'contacts', label: 'Vendor Contacts', icon: <MdPeople size={18} /> },
    { id: 'timeline', label: 'Interaction Timeline', icon: <MdTimeline size={18} /> },
    { id: 'catalog', label: 'Product Catalog', icon: <MdInventory size={18} /> }
];

const defaultCatalogForm = {
    productName: '',
    brand: '',
    category: '',
    hsnCode: '',
    price: '',
    MOQ: 1,
    UOM: 'Nos',
    description: '',
    specification: '',
    status: 'Active'
};

const Vendor360Workspace = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('overview');
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState(null);

    // Vendor Product Catalog State
    const [catalogProducts, setCatalogProducts] = useState([]);
    const [catalogLoading, setCatalogLoading] = useState(false);
    const [catalogSearch, setCatalogSearch] = useState('');
    const [isCatalogModalOpen, setIsCatalogModalOpen] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [editingCatalogProduct, setEditingCatalogProduct] = useState(null);
    const [catalogFormData, setCatalogFormData] = useState(defaultCatalogForm);

    const fetchVendorCatalog = async () => {
        setCatalogLoading(true);
        try {
            const res = await vendorCatalogService.getAll({ vendorId: id, search: catalogSearch || undefined, limit: 500 });
            setCatalogProducts(res.data?.data || res.data || []);
        } catch (err) {
            console.error('Error fetching vendor catalog:', err);
            toast.error('Failed to load vendor product catalog');
        } finally {
            setCatalogLoading(false);
        }
    };

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
        fetchVendorCatalog();
    }, [id, navigate]);

    useEffect(() => {
        if (activeTab === 'catalog') {
            fetchVendorCatalog();
        }
    }, [activeTab, catalogSearch]);

    const handleOpenCatalogModal = (prod = null) => {
        if (prod) {
            setEditingCatalogProduct(prod);
            setCatalogFormData({
                productName: prod.productName || '',
                brand: prod.brand || '',
                category: prod.category || '',
                hsnCode: prod.hsnCode || '',
                price: prod.price ?? '',
                MOQ: prod.MOQ ?? 1,
                UOM: prod.UOM || 'Nos',
                description: prod.description || '',
                specification: prod.specification || '',
                status: prod.status || 'Active'
            });
        } else {
            setEditingCatalogProduct(null);
            setCatalogFormData(defaultCatalogForm);
        }
        setIsCatalogModalOpen(true);
    };

    const handleSaveCatalogProduct = async (e) => {
        e.preventDefault();
        if (!catalogFormData.productName.trim()) {
            toast.error('Product Name is required');
            return;
        }

        try {
            const payload = {
                ...catalogFormData,
                vendorId: id,
                price: Number(catalogFormData.price) || 0,
                MOQ: Number(catalogFormData.MOQ) || 1
            };

            if (editingCatalogProduct) {
                await vendorCatalogService.update(editingCatalogProduct._id, payload);
                toast.success('Product updated in Vendor Catalog');
            } else {
                await vendorCatalogService.create(payload);
                toast.success('Product added to Vendor Catalog');
            }

            setIsCatalogModalOpen(false);
            fetchVendorCatalog();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to save product in catalog');
        }
    };

    const handleDeleteCatalogProduct = async (prodId) => {
        if (!window.confirm('Are you sure you want to remove this product from the vendor catalog?')) return;
        try {
            await vendorCatalogService.delete(prodId);
            toast.success('Product removed from catalog');
            fetchVendorCatalog();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to delete product');
        }
    };

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
                {activeTab === 'supplied' && (
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

                {/* VENDOR PRODUCT CATALOG TAB */}
                {activeTab === 'catalog' && (
                    <div className="space-y-6">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                            <div>
                                <h3 className="font-black text-slate-800 text-base uppercase tracking-wider">{vendor.name}'s Product Catalog</h3>
                                <p className="text-xs text-slate-500 font-medium mt-1">Vendor-specific products available for reference and future purchase orders.</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => setIsImportModalOpen(true)}
                                    className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs uppercase tracking-wider transition-all"
                                >
                                    <MdFileUpload size={18} />
                                    Import Excel Catalog
                                </button>
                                <button
                                    onClick={() => handleOpenCatalogModal()}
                                    className="flex items-center gap-2 px-4 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-all shadow-md shadow-primary-600/20"
                                >
                                    <MdAdd size={18} />
                                    Add Product to Catalog
                                </button>
                            </div>
                        </div>

                        {/* Search Input */}
                        <div className="max-w-md">
                            <input
                                type="text"
                                value={catalogSearch}
                                onChange={(e) => setCatalogSearch(e.target.value)}
                                placeholder="Search by product name, brand, category..."
                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                            />
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50 text-[10px] uppercase font-black tracking-widest border-b border-slate-100 text-slate-400">
                                    <tr>
                                        <th className="px-6 py-4">Product Name</th>
                                        <th className="px-6 py-4">Brand</th>
                                        <th className="px-6 py-4">Category / HSN</th>
                                        <th className="px-6 py-4 text-right">Price</th>
                                        <th className="px-6 py-4 text-center">MOQ / UOM</th>
                                        <th className="px-6 py-4 text-center">Status</th>
                                        <th className="px-6 py-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="text-xs font-bold text-slate-700 divide-y divide-slate-50">
                                    {catalogProducts.map(p => (
                                        <tr key={p._id} className="hover:bg-slate-50/50">
                                            <td className="px-6 py-4 font-black text-slate-900">
                                                <div>{p.productName}</div>
                                                {p.description && <div className="text-[10px] text-slate-400 font-medium truncate max-w-xs">{p.description}</div>}
                                            </td>
                                            <td className="px-6 py-4 text-slate-600">{p.brand || '-'}</td>
                                            <td className="px-6 py-4 text-slate-500">
                                                <div>{p.category || '-'}</div>
                                                {p.hsnCode && <div className="text-[10px] font-mono text-slate-400 font-bold">HSN: {p.hsnCode}</div>}
                                            </td>
                                            <td className="px-6 py-4 text-right font-mono font-black text-slate-900">₹{(p.price || 0).toLocaleString()}</td>
                                            <td className="px-6 py-4 text-center font-mono text-slate-600">{p.MOQ || 1} {p.UOM || 'Nos'}</td>
                                            <td className="px-6 py-4 text-center">
                                                <span className={`px-2.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                                                    p.status === 'Active' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'
                                                }`}>
                                                    {p.status || 'Active'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        onClick={() => handleOpenCatalogModal(p)}
                                                        className="p-1.5 text-slate-400 hover:text-primary-600 hover:bg-slate-100 rounded-lg transition-colors"
                                                        title="Edit Product"
                                                    >
                                                        <MdEdit size={16} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteCatalogProduct(p._id)}
                                                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                                        title="Delete Product"
                                                    >
                                                        <MdDelete size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {catalogProducts.length === 0 && !catalogLoading && (
                                        <tr>
                                            <td colSpan="7" className="p-12 text-center text-slate-400 font-bold uppercase tracking-widest text-xs">
                                                No products found in {vendor.name}'s catalog.
                                            </td>
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

            {/* ADD / EDIT CATALOG PRODUCT MODAL */}
            <Modal
                isOpen={isCatalogModalOpen}
                onClose={() => setIsCatalogModalOpen(false)}
                title={editingCatalogProduct ? `Edit ${editingCatalogProduct.productName}` : `Add Product to ${vendor.name}'s Catalog`}
                maxWidth="max-w-2xl"
            >
                <form onSubmit={handleSaveCatalogProduct} className="space-y-4 text-left">
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Product Name *</label>
                        <input
                            type="text"
                            value={catalogFormData.productName}
                            onChange={(e) => setCatalogFormData({ ...catalogFormData, productName: e.target.value })}
                            placeholder="Product title / model name"
                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                            required
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Brand / Manufacturer</label>
                            <input
                                type="text"
                                value={catalogFormData.brand}
                                onChange={(e) => setCatalogFormData({ ...catalogFormData, brand: e.target.value })}
                                placeholder="e.g. Siemens, ABB"
                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Category</label>
                            <input
                                type="text"
                                value={catalogFormData.category}
                                onChange={(e) => setCatalogFormData({ ...catalogFormData, category: e.target.value })}
                                placeholder="e.g. Switchgear"
                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">HSN Code</label>
                            <input
                                type="text"
                                value={catalogFormData.hsnCode}
                                onChange={(e) => setCatalogFormData({ ...catalogFormData, hsnCode: e.target.value })}
                                placeholder="e.g. 84818020"
                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Price (₹)</label>
                            <input
                                type="number"
                                step="any"
                                value={catalogFormData.price}
                                onChange={(e) => setCatalogFormData({ ...catalogFormData, price: e.target.value })}
                                placeholder="0.00"
                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">MOQ</label>
                            <input
                                type="number"
                                min="1"
                                value={catalogFormData.MOQ}
                                onChange={(e) => setCatalogFormData({ ...catalogFormData, MOQ: e.target.value })}
                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">UOM</label>
                            <select
                                value={catalogFormData.UOM}
                                onChange={(e) => setCatalogFormData({ ...catalogFormData, UOM: e.target.value })}
                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none"
                            >
                                <option value="Nos">Nos</option>
                                <option value="Pcs">Pcs</option>
                                <option value="Kg">Kg</option>
                                <option value="Mtr">Mtr</option>
                                <option value="Set">Set</option>
                                <option value="Box">Box</option>
                            </select>
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Description</label>
                        <textarea
                            value={catalogFormData.description}
                            onChange={(e) => setCatalogFormData({ ...catalogFormData, description: e.target.value })}
                            rows={2}
                            placeholder="Brief product description..."
                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium outline-none"
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Technical Specifications</label>
                        <textarea
                            value={catalogFormData.specification}
                            onChange={(e) => setCatalogFormData({ ...catalogFormData, specification: e.target.value })}
                            rows={2}
                            placeholder="Key technical specs, ratings, dimensions..."
                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium outline-none"
                        />
                    </div>

                    <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                        <button
                            type="button"
                            onClick={() => setIsCatalogModalOpen(false)}
                            className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-xs font-black shadow-md shadow-primary-600/20 transition-all"
                        >
                            {editingCatalogProduct ? 'Update Product' : 'Save Product'}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* IMPORT CATALOG EXCEL MODAL */}
            <ImportModal
                isOpen={isImportModalOpen}
                onClose={() => setIsImportModalOpen(false)}
                title={`Import Product Catalog for ${vendor.name}`}
                onImport={async (file) => {
                    const res = await vendorCatalogService.importCatalog(id, file);
                    toast.success(res.data?.message || 'Catalog imported successfully');
                    fetchVendorCatalog();
                }}
            />
        </div>
    );
};

export default Vendor360Workspace;
