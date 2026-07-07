import React, { useState, useEffect } from 'react';
import { productService, cpqService, importService } from '../services/api';
import { toast } from 'react-toastify';
import * as XLSX from 'xlsx';
import { MdAdd, MdSearch, MdEdit, MdDelete, MdInventory, MdCategory, MdPayments, MdFolderOpen, MdStar, MdFileDownload, MdFileUpload } from 'react-icons/md';
import Modal from '../components/Modal';
import ImportModal from '../components/ImportModal';

const CatalogSubmodule = ({ mode = 'products' }) => {
    const [activeTab, setActiveTab] = useState(mode);
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [bundlesList, setBundlesList] = useState([]);

    const exportToExcel = async () => {
        setLoading(true);
        try {
            const catalogTypeMap = {
                products: 'Product',
                services: 'Service',
                bundles: 'Bundle',
                subscriptions: 'Subscription'
            };
            const typeParam = catalogTypeMap[activeTab] || 'Product';

            const res = await productService.getAll({
                limit: 10000,
                search: searchTerm || undefined,
            });
            const list = Array.isArray(res.data) ? res.data : res.data?.data || [];
            const exportItems = list.filter(item => (item.catalogType || 'Product') === typeParam);

            if (!exportItems.length) {
                toast.info(`No ${activeTab} found to export`);
                return;
            }

            const exportData = exportItems.map((p) => {
                const standardAttributes = (p.attributes || []).map(a => `${a.code}:${a.description}`).join(', ');
                return {
                    'Product Name': p.productName || '',
                    'Product Code': p.productCode || '',
                    'Category': p.categoryId?.name || '',
                    'HSN Code': p.hsnCode || '',
                    'GST (%)': p.gstPercentage || 0,
                    'Base Price': p.basePrice || 0,
                    'MRP': p.mrp || 0,
                    'UOM': p.uom || '',
                    'Status': p.status || '',
                    'MGR 1': p.mgr1?.code || '',
                    'MGR 2': p.mgr2?.code || '',
                    'MGR 3': p.mgr3?.code || '',
                    'MGR 4': p.mgr4?.code || '',
                    'MGR 5': p.mgr5?.code || '',
                    'Standard Attributes': standardAttributes
                };
            });

            const ws = XLSX.utils.json_to_sheet(exportData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Catalog');
            XLSX.writeFile(wb, `${typeParam}_Catalog_${new Date().toISOString().slice(0, 10)}.xlsx`);
            toast.success('Export completed successfully');
        } catch (err) {
            console.error('Export error:', err);
            toast.error('Failed to export catalog');
        } finally {
            setLoading(false);
        }
    };

    // Form fields matching catalogTypes
    const [formData, setFormData] = useState({
        productName: '',
        productCode: '',
        hsnCode: '998311',
        gstPercentage: 18,
        basePrice: 0,
        mrp: 0,
        uom: 'Nos',
        status: 'Active',
        catalogType: 'Product',
        subscriptionDetails: { billingCycle: 'Monthly', setupFee: 0, renewalPrice: 0 },
        rentalDetails: { minLeaseTerm: 1, securityDeposit: 0, baseRatePerDay: 0, baseRatePerMonth: 0 },
        pricing: { baseCost: 0, minPrice: 0, maxPrice: 0, marginPercent: 0, currency: 'INR' }
    });

    useEffect(() => {
        setActiveTab(mode);
    }, [mode]);

    useEffect(() => {
        fetchCatalogItems();
    }, [activeTab, searchTerm]);

    const fetchCatalogItems = async () => {
        setLoading(true);
        try {
            const catalogTypeMap = {
                products: 'Product',
                services: 'Service',
                bundles: 'Bundle',
                subscriptions: 'Subscription'
            };
            const typeParam = catalogTypeMap[activeTab] || 'Product';
            const res = await productService.getAll({ search: searchTerm || undefined });
            const list = Array.isArray(res.data) ? res.data : res.data?.data || [];
            
            // Filter by catalogType
            const filtered = list.filter(item => (item.catalogType || 'Product') === typeParam);
            setItems(filtered);
            setBundlesList(list.filter(item => (item.catalogType || 'Product') !== 'Bundle'));
        } catch (err) {
            console.error("Error fetching catalog items:", err);
            toast.error("Failed to load catalog items");
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (item = null) => {
        const catalogTypeMap = {
            products: 'Product',
            services: 'Service',
            bundles: 'Bundle',
            subscriptions: 'Subscription'
        };
        const currentType = catalogTypeMap[activeTab];

        if (item) {
            setEditingItem(item);
            setFormData({
                ...item,
                subscriptionDetails: item.subscriptionDetails || { billingCycle: 'Monthly', setupFee: 0, renewalPrice: 0 },
                rentalDetails: item.rentalDetails || { minLeaseTerm: 1, securityDeposit: 0, baseRatePerDay: 0, baseRatePerMonth: 0 },
                pricing: item.pricing || { baseCost: 0, minPrice: 0, maxPrice: 0, marginPercent: 0, currency: 'INR' }
            });
        } else {
            setEditingItem(null);
            setFormData({
                productName: '',
                productCode: '',
                hsnCode: activeTab === 'services' ? '998244' : '998311',
                gstPercentage: 18,
                basePrice: 0,
                mrp: 0,
                uom: activeTab === 'services' ? 'Hours' : 'Nos',
                status: 'Active',
                catalogType: currentType,
                subscriptionDetails: { billingCycle: 'Monthly', setupFee: 0, renewalPrice: 0 },
                rentalDetails: { minLeaseTerm: 1, securityDeposit: 0, baseRatePerDay: 0, baseRatePerMonth: 0 },
                pricing: { baseCost: 0, minPrice: 0, maxPrice: 0, marginPercent: 0, currency: 'INR' }
            });
        }
        setIsModalOpen(true);
    };

    const handleFormChange = (e) => {
        const { name, value } = e.target;
        if (name.startsWith('sub.')) {
            const field = name.split('.')[1];
            setFormData(prev => ({
                ...prev,
                subscriptionDetails: { ...prev.subscriptionDetails, [field]: value }
            }));
        } else if (name.startsWith('pricing.')) {
            const field = name.split('.')[1];
            setFormData(prev => ({
                ...prev,
                pricing: { ...prev.pricing, [field]: value }
            }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            // Compute margin percent automatically
            const baseCost = Number(formData.pricing.baseCost || 0);
            const basePrice = Number(formData.basePrice || 0);
            let marginPercent = 0;
            if (basePrice > 0) {
                marginPercent = ((basePrice - baseCost) / basePrice) * 100;
            }

            const payload = {
                ...formData,
                pricing: {
                    ...formData.pricing,
                    marginPercent: Math.round(marginPercent * 100) / 100
                }
            };

            if (editingItem) {
                await productService.update(editingItem._id, payload);
                toast.success("Item updated successfully!");
            } else {
                await productService.create(payload);
                toast.success("Item created successfully!");
            }
            setIsModalOpen(false);
            fetchCatalogItems();
        } catch (err) {
            console.error("Save error:", err);
            toast.error(err.response?.data?.message || "Failed to save item");
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm("Are you sure you want to delete this catalog item?")) {
            try {
                await productService.delete(id);
                toast.success("Item deleted");
                fetchCatalogItems();
            } catch (err) {
                toast.error("Failed to delete item");
            }
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 capitalize tracking-tight">{activeTab} Register</h1>
                    <p className="text-slate-500 font-medium">Manage and customize your {activeTab} offerings.</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={exportToExcel}
                        className="flex items-center justify-center gap-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-5 py-3 rounded-2xl font-bold transition-all shadow-sm uppercase text-xs tracking-widest active:scale-95"
                    >
                        <MdFileDownload size={20} />
                        <span>Export</span>
                    </button>
                    <button
                        onClick={() => setIsImportModalOpen(true)}
                        className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-3 rounded-2xl font-bold transition-all shadow-xl shadow-emerald-600/20 uppercase text-xs tracking-widest active:scale-95"
                    >
                        <MdFileUpload size={20} />
                        <span>Import</span>
                    </button>
                    <button
                        onClick={() => handleOpenModal()}
                        className="flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-2xl font-bold transition-all shadow-xl shadow-primary-600/20 uppercase text-xs tracking-widest active:scale-95"
                    >
                        <MdAdd size={20} />
                        <span>Add {activeTab.slice(0, -1)}</span>
                    </button>
                </div>
            </div>

            {/* Catalog tab header */}
            <div className="flex gap-2 border-b border-slate-100 pb-px">
                {['products', 'services', 'bundles', 'subscriptions'].map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-6 py-3 text-sm font-bold capitalize transition-all border-b-2 ${activeTab === tab ? 'border-primary-600 text-primary-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                    >
                        {tab}
                    </button>
                ))}
            </div>

            {/* Catalog List */}
            <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-50 flex gap-4 bg-slate-50/20">
                    <div className="relative flex-1 text-slate-400 focus-within:text-primary-600 transition-colors">
                        <MdSearch className="absolute left-4 top-1/2 -translate-y-1/2" size={20} />
                        <input
                            type="text"
                            placeholder={`Search ${activeTab}...`}
                            className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 outline-none text-sm text-slate-900 transition-all font-medium"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                {loading ? (
                    <div className="p-12 text-center text-slate-400 font-bold">Loading catalog items...</div>
                ) : items.length === 0 ? (
                    <div className="p-12 text-center text-slate-400 font-bold">No catalog items found.</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-slate-100 text-slate-400 text-[10px] font-black uppercase tracking-widest bg-slate-50/50">
                                    <th className="px-6 py-4">Name / Code</th>
                                    <th className="px-6 py-4">Selling Rate</th>
                                    <th className="px-6 py-4">Standard Cost</th>
                                    <th className="px-6 py-4">UOM</th>
                                    {activeTab === 'subscriptions' && <th className="px-6 py-4">Billing Cycle</th>}
                                    <th className="px-6 py-4">Status</th>
                                    <th className="px-6 py-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {items.map(item => (
                                    <tr key={item._id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="font-bold text-slate-900">{item.productName}</div>
                                            <div className="text-xs text-slate-400">{item.productCode}</div>
                                        </td>
                                        <td className="px-6 py-4 font-extrabold text-slate-900">
                                            {item.pricing?.currency || 'INR'} {Number(item.basePrice).toLocaleString()}
                                        </td>
                                        <td className="px-6 py-4 font-bold text-slate-500">
                                            {item.pricing?.currency || 'INR'} {Number(item.pricing?.baseCost || 0).toLocaleString()}
                                        </td>
                                        <td className="px-6 py-4 text-xs font-semibold text-slate-600">{item.uom}</td>
                                        {activeTab === 'subscriptions' && (
                                            <td className="px-6 py-4">
                                                <span className="px-2.5 py-1 text-[10px] font-black uppercase bg-indigo-50 text-indigo-600 rounded-lg">
                                                    {item.subscriptionDetails?.billingCycle || 'Monthly'}
                                                </span>
                                            </td>
                                        )}
                                        <td className="px-6 py-4">
                                            <span className={`px-2.5 py-1 text-[10px] font-black uppercase rounded-lg ${item.status === 'Active' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-400'}`}>
                                                {item.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end gap-2">
                                                <button
                                                    onClick={() => handleOpenModal(item)}
                                                    className="p-2 text-slate-400 hover:text-primary-600 hover:bg-slate-50 rounded-lg transition-all"
                                                >
                                                    <MdEdit size={18} />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(item._id)}
                                                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50/50 rounded-lg transition-all"
                                                >
                                                    <MdDelete size={18} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Create / Edit Modal */}
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={`${editingItem ? 'Edit' : 'Create'} ${activeTab.slice(0, -1)}`}>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Item Name</label>
                            <input
                                type="text"
                                name="productName"
                                value={formData.productName}
                                onChange={handleFormChange}
                                required
                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-semibold"
                            />
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Item Code / SKU</label>
                            <input
                                type="text"
                                name="productCode"
                                value={formData.productCode}
                                onChange={handleFormChange}
                                required
                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-semibold"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Selling Rate</label>
                            <input
                                type="number"
                                name="basePrice"
                                value={formData.basePrice}
                                onChange={handleFormChange}
                                required
                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-semibold"
                            />
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Standard Cost (COGS)</label>
                            <input
                                type="number"
                                name="pricing.baseCost"
                                value={formData.pricing?.baseCost}
                                onChange={handleFormChange}
                                required
                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-semibold"
                            />
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">UOM / Unit</label>
                            <input
                                type="text"
                                name="uom"
                                value={formData.uom}
                                onChange={handleFormChange}
                                required
                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-semibold"
                            />
                        </div>
                    </div>

                    {activeTab === 'subscriptions' && (
                        <div className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100 space-y-4">
                            <h3 className="text-xs font-black text-indigo-900 uppercase tracking-wider">Subscription Specifications</h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="text-[10px] font-black text-indigo-700 uppercase tracking-widest block mb-2">Billing Cycle</label>
                                    <select
                                        name="sub.billingCycle"
                                        value={formData.subscriptionDetails?.billingCycle}
                                        onChange={handleFormChange}
                                        className="w-full px-4 py-2.5 bg-white border border-indigo-200 rounded-xl outline-none text-sm font-semibold"
                                    >
                                        <option value="Monthly">Monthly</option>
                                        <option value="Quarterly">Quarterly</option>
                                        <option value="Yearly">Yearly</option>
                                        <option value="UsageBased">Usage Based</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-indigo-700 uppercase tracking-widest block mb-2">Setup Fee</label>
                                    <input
                                        type="number"
                                        name="sub.setupFee"
                                        value={formData.subscriptionDetails?.setupFee}
                                        onChange={handleFormChange}
                                        className="w-full px-4 py-2.5 bg-white border border-indigo-200 rounded-xl outline-none text-sm font-semibold"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-indigo-700 uppercase tracking-widest block mb-2">Renewal Rate</label>
                                    <input
                                        type="number"
                                        name="sub.renewalPrice"
                                        value={formData.subscriptionDetails?.renewalPrice}
                                        onChange={handleFormChange}
                                        className="w-full px-4 py-2.5 bg-white border border-indigo-200 rounded-xl outline-none text-sm font-semibold"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                        <button
                            type="button"
                            onClick={() => setIsModalOpen(false)}
                            className="px-5 py-2.5 text-xs font-bold text-slate-500 uppercase tracking-widest hover:bg-slate-50 rounded-xl"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="px-6 py-2.5 text-xs font-bold text-white bg-primary-600 hover:bg-primary-700 rounded-xl uppercase tracking-widest shadow-lg shadow-primary-600/20"
                        >
                            Save Offer
                        </button>
                    </div>
                </form>
            </Modal>

            {/* Import Modal */}
            <ImportModal
                isOpen={isImportModalOpen}
                onClose={() => setIsImportModalOpen(false)}
                title="Import Products/Catalog"
                onImport={async (file) => {
                    const result = await importService.importProducts(file);
                    fetchCatalogItems();
                    return result;
                }}
                onDownloadTemplate={importService.getProductTemplate}
            />
        </div>
    );
};

export default CatalogSubmodule;
