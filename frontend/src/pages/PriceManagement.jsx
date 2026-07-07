import React, { useState, useEffect } from 'react';
import { cpqService, productService, customerService, importService } from '../services/api';
import { toast } from 'react-toastify';
import * as XLSX from 'xlsx';
import { MdAdd, MdDelete, MdEdit, MdSettings, MdLanguage, MdReceipt, MdAssignment, MdStars, MdDescription, MdFileDownload, MdFileUpload } from 'react-icons/md';
import Modal from '../components/Modal';
import ImportModal from '../components/ImportModal';

const PriceManagement = ({ mode = 'price-books' }) => {
    const [activeTab, setActiveTab] = useState(mode);
    const [loading, setLoading] = useState(true);
    const [priceBooks, setPriceBooks] = useState([]);
    const [rules, setRules] = useState([]);
    const [policies, setPolicies] = useState([]);
    const [promotions, setPromotions] = useState([]);
    const [currencies, setCurrencies] = useState([]);
    const [products, setProducts] = useState([]);
    const [customers, setCustomers] = useState([]);

    // Selection details
    const [selectedBook, setSelectedBook] = useState(null);
    const [bookItems, setBookItems] = useState([]);
    const [isBookItemsModalOpen, setIsBookItemsModalOpen] = useState(false);

    // Modals
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [isItemsImportModalOpen, setIsItemsImportModalOpen] = useState(false);
    const [formData, setFormData] = useState({});

    // Items mapped in price book form
    const [itemFormData, setItemFormData] = useState({ productId: '', price: 0, currency: 'INR' });

    const exportPriceBooksToExcel = async () => {
        setLoading(true);
        try {
            const res = await cpqService.getPriceBooks();
            const exportBooks = res.data || [];
            if (!exportBooks.length) {
                toast.info('No price books found to export');
                return;
            }

            const exportData = exportBooks.map((pb) => ({
                'Book Name': pb.name || '',
                'Description': pb.description || '',
                'Book Type': pb.type || '',
                'Target ID': pb.targetId || '',
                'Currency': pb.currency || 'INR',
                'Valid From': pb.validFrom ? new Date(pb.validFrom).toISOString().slice(0, 10) : '',
                'Valid To': pb.validTo ? new Date(pb.validTo).toISOString().slice(0, 10) : '',
                'Active': pb.isActive !== false ? 'TRUE' : 'FALSE'
            }));

            const ws = XLSX.utils.json_to_sheet(exportData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'PriceBooks');
            XLSX.writeFile(wb, `PriceBooks_Master_${new Date().toISOString().slice(0, 10)}.xlsx`);
            toast.success('Price books export completed successfully');
        } catch (err) {
            console.error('Export price books error:', err);
            toast.error('Failed to export price books');
        } finally {
            setLoading(false);
        }
    };

    const exportPriceBookItemsToExcel = async () => {
        if (!selectedBook) return;
        setLoading(true);
        try {
            const res = await cpqService.getItemsInPriceBook(selectedBook._id);
            const exportItems = res.data || [];
            if (!exportItems.length) {
                toast.info('No custom rates found in this price book to export');
                return;
            }

            const exportData = exportItems.map((item) => ({
                'Product Code': item.productId?.productCode || '',
                'Product Name': item.productId?.productName || '',
                'Price': item.price || 0,
                'Currency': item.currency || 'INR'
            }));

            const ws = XLSX.utils.json_to_sheet(exportData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Rates');
            XLSX.writeFile(wb, `Rates_${selectedBook.name.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`);
            toast.success('Rates export completed successfully');
        } catch (err) {
            console.error('Export price book items error:', err);
            toast.error('Failed to export custom rates');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        setActiveTab(mode);
    }, [mode]);

    useEffect(() => {
        fetchTabContent();
    }, [activeTab]);

    const fetchTabContent = async () => {
        setLoading(true);
        try {
            const [prodsRes, custRes] = await Promise.all([
                productService.getAll({}),
                customerService.getAll({})
            ]);
            setProducts(Array.isArray(prodsRes.data) ? prodsRes.data : prodsRes.data?.data || []);
            setCustomers(Array.isArray(custRes.data) ? custRes.data : custRes.data?.data || []);

            if (activeTab === 'price-books') {
                const res = await cpqService.getPriceBooks();
                setPriceBooks(res.data);
            } else if (activeTab === 'pricing-rules') {
                const res = await cpqService.getPricingRules();
                setRules(res.data);
            } else if (activeTab === 'discounts') {
                const res = await cpqService.getDiscountPolicies();
                setPolicies(res.data);
            } else if (activeTab === 'promotions') {
                const res = await cpqService.getPromotions();
                setPromotions(res.data);
            } else if (activeTab === 'currencies') {
                const res = await cpqService.getCurrencies();
                setCurrencies(res.data);
            }
        } catch (err) {
            console.error("Load price management error:", err);
            toast.error("Failed to load records");
        } finally {
            setLoading(false);
        }
    };

    const handleOpenBookItems = async (book) => {
        setSelectedBook(book);
        try {
            const res = await cpqService.getItemsInPriceBook(book._id);
            setBookItems(res.data);
            setIsBookItemsModalOpen(true);
        } catch (err) {
            toast.error("Failed to load price book items");
        }
    };

    const handleAddBookItem = async (e) => {
        e.preventDefault();
        try {
            await cpqService.addItemToPriceBook({
                priceBookId: selectedBook._id,
                ...itemFormData
            });
            toast.success("Item rate updated");
            // Refresh items
            const res = await cpqService.getItemsInPriceBook(selectedBook._id);
            setBookItems(res.data);
            setItemFormData({ productId: '', price: 0, currency: 'INR' });
        } catch (err) {
            toast.error("Failed to map rate");
        }
    };

    const handleRemoveBookItem = async (itemId) => {
        try {
            await cpqService.removeItemFromPriceBook(itemId);
            toast.success("Rate item removed");
            const res = await cpqService.getItemsInPriceBook(selectedBook._id);
            setBookItems(res.data);
        } catch (err) {
            toast.error("Failed to remove item");
        }
    };

    const handleOpenCreateModal = () => {
        if (activeTab === 'price-books') {
            setFormData({ name: '', description: '', type: 'Standard', isActive: true, validFrom: '', validTo: '', targetId: '', currency: 'INR' });
        } else if (activeTab === 'pricing-rules') {
            setFormData({ name: '', description: '', ruleType: 'Quantity', productId: '', conditions: [{ minQty: 1, maxQty: 9999, value: 0, type: 'price' }], isActive: true });
        } else if (activeTab === 'discounts') {
            setFormData({ name: '', type: 'FestiveOffer', discountType: 'Percentage', value: 0, validFrom: '', validTo: '', stackable: false, customerGroups: [], minimumOrderValue: 0 });
        } else if (activeTab === 'promotions') {
            setFormData({ name: '', code: '', promotionType: 'Coupon', startDate: '', endDate: '', discountPercent: 0, discountAmount: 0, usageLimit: 100, isActive: true });
        } else if (activeTab === 'currencies') {
            setFormData({ fromCurrency: 'INR', toCurrency: '', rate: 1, effectiveDate: new Date().toISOString().split('T')[0] });
        }
        setIsCreateModalOpen(true);
    };

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        try {
            if (activeTab === 'price-books') {
                const nameTrimmed = formData.name?.trim().toLowerCase();
                const typeSelected = formData.type || 'Standard';
                if (!nameTrimmed) {
                    toast.error("Price Book name is required");
                    return;
                }
                const isDuplicate = priceBooks.some(pb => pb.name?.trim().toLowerCase() === nameTrimmed && pb.type === typeSelected);
                if (isDuplicate) {
                    toast.error(`A Price Book with the name "${formData.name.trim()}" and type "${typeSelected}" already exists.`);
                    return;
                }
                await cpqService.createPriceBook(formData);
                toast.success("Price Book created successfully");
            } else if (activeTab === 'pricing-rules') {
                await cpqService.createPricingRule(formData);
                toast.success("Pricing Rule added");
            } else if (activeTab === 'discounts') {
                await cpqService.createDiscountPolicy(formData);
                toast.success("Discount Policy active");
            } else if (activeTab === 'promotions') {
                await cpqService.createPromotion(formData);
                toast.success("Promotion active");
            } else if (activeTab === 'currencies') {
                await cpqService.createCurrency(formData);
                toast.success("Currency rate locked");
            }
            setIsCreateModalOpen(false);
            fetchTabContent();
        } catch (err) {
            toast.error(err.response?.data?.message || "Failed to save configuration");
        }
    };

    const handleDeleteRecord = async (id) => {
        if (!window.confirm("Are you sure you want to delete this configuration?")) return;
        try {
            if (activeTab === 'price-books') {
                await cpqService.deletePriceBook(id);
            } else if (activeTab === 'pricing-rules') {
                await cpqService.deletePricingRule(id);
            } else if (activeTab === 'discounts') {
                await cpqService.deleteDiscountPolicy(id);
            } else if (activeTab === 'promotions') {
                await cpqService.deletePromotion(id);
            }
            toast.success("Configuration deleted");
            fetchTabContent();
        } catch (err) {
            toast.error("Failed to delete record");
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 capitalize tracking-tight">Price Management</h1>
                    <p className="text-slate-500 font-medium font-outfit uppercase text-[10px] tracking-widest">Acczite Pricing Hub</p>
                </div>
                <div className="flex gap-3">
                    {activeTab === 'price-books' && (
                        <>
                            <button
                                onClick={exportPriceBooksToExcel}
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
                        </>
                    )}
                    <button
                        onClick={handleOpenCreateModal}
                        className="flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-2xl font-bold transition-all shadow-xl shadow-primary-600/20 uppercase text-xs tracking-widest active:scale-95"
                    >
                        <MdAdd size={20} />
                        <span>Add Config</span>
                    </button>
                </div>
            </div>

            {/* Sub-tabs mapping */}
            <div className="flex gap-2 border-b border-slate-100 pb-px">
                {[
                    { key: 'price-books', name: 'Price Books' },
                    { key: 'pricing-rules', name: 'Pricing Rules' },
                    { key: 'discounts', name: 'Discount Policies' },
                    { key: 'promotions', name: 'Promotions / Coupons' },
                    { key: 'currencies', name: 'Currency Sheets' }
                ].map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`px-6 py-3 text-sm font-bold transition-all border-b-2 ${activeTab === tab.key ? 'border-primary-600 text-primary-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                    >
                        {tab.name}
                    </button>
                ))}
            </div>

            <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden p-6">
                {loading ? (
                    <div className="text-center p-12 text-slate-400 font-bold">Loading records...</div>
                ) : (
                    <div>
                        {activeTab === 'price-books' && (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {priceBooks.map(pb => (
                                    <div key={pb._id} className="p-6 bg-slate-50 rounded-2xl border border-slate-100 space-y-4 hover:shadow-lg transition-all relative group">
                                        <div>
                                            <div className="px-2.5 py-1 text-[9px] font-black uppercase tracking-widest bg-primary-50 text-primary-600 rounded-lg inline-block mb-2">
                                                {pb.type} Book
                                            </div>
                                            <h3 className="text-lg font-black text-slate-900 leading-tight">{pb.name}</h3>
                                            <p className="text-xs text-slate-500 mt-1">{pb.description || 'No description'}</p>
                                        </div>
                                        <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                                            <button
                                                onClick={() => handleOpenBookItems(pb)}
                                                className="text-xs font-black uppercase text-primary-600 tracking-wider hover:underline"
                                            >
                                                Manage Rates
                                            </button>
                                            <button
                                                onClick={() => handleDeleteRecord(pb._id)}
                                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                            >
                                                <MdDelete size={18} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {activeTab === 'pricing-rules' && (
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="border-b border-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-400">
                                        <th className="py-3">Rule Name</th>
                                        <th className="py-3">Type</th>
                                        <th className="py-3">Target Product</th>
                                        <th className="py-3">Status</th>
                                        <th className="py-3 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rules.map(rule => (
                                        <tr key={rule._id} className="border-b border-slate-50 text-sm font-semibold">
                                            <td className="py-3 font-bold text-slate-900">{rule.name}</td>
                                            <td className="py-3 text-xs text-indigo-600 uppercase font-black">{rule.ruleType}</td>
                                            <td className="py-3 text-slate-500">{rule.productId?.productName || 'Global Rule'}</td>
                                            <td className="py-3">
                                                <span className={`px-2 py-0.5 text-[10px] font-black uppercase rounded-lg ${rule.isActive ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-400'}`}>
                                                    {rule.isActive ? 'Active' : 'Inactive'}
                                                </span>
                                            </td>
                                            <td className="py-3 text-right">
                                                <button
                                                    onClick={() => handleDeleteRecord(rule._id)}
                                                    className="p-1 text-slate-400 hover:text-rose-600 transition-colors"
                                                >
                                                    <MdDelete size={18} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}

                        {activeTab === 'discounts' && (
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="border-b border-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-400">
                                        <th className="py-3">Policy Name</th>
                                        <th className="py-3">Discount Type</th>
                                        <th className="py-3">Value</th>
                                        <th className="py-3">Stackable</th>
                                        <th className="py-3 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {policies.map(policy => (
                                        <tr key={policy._id} className="border-b border-slate-50 text-sm font-semibold">
                                            <td className="py-3 font-bold text-slate-900">{policy.name}</td>
                                            <td className="py-3 text-xs uppercase font-black">{policy.type}</td>
                                            <td className="py-3 text-slate-900 font-extrabold">{policy.discountType === 'Percentage' ? `${policy.value}%` : `₹${policy.value}`}</td>
                                            <td className="py-3">
                                                <span className={`px-2.5 py-0.5 text-[9px] font-black uppercase rounded-lg ${policy.stackable ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-400'}`}>
                                                    {policy.stackable ? 'Yes' : 'No'}
                                                </span>
                                            </td>
                                            <td className="py-3 text-right">
                                                <button
                                                    onClick={() => handleDeleteRecord(policy._id)}
                                                    className="p-1 text-slate-400 hover:text-rose-600 transition-colors"
                                                >
                                                    <MdDelete size={18} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}

                        {activeTab === 'promotions' && (
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="border-b border-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-400">
                                        <th className="py-3">Promo Name</th>
                                        <th className="py-3">Promo Code</th>
                                        <th className="py-3">Discount Modifier</th>
                                        <th className="py-3">Usage Count</th>
                                        <th className="py-3 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {promotions.map(promo => (
                                        <tr key={promo._id} className="border-b border-slate-50 text-sm font-semibold">
                                            <td className="py-3 font-bold text-slate-900">{promo.name}</td>
                                            <td className="py-3 font-black text-primary-600 tracking-wider">{promo.code || 'BOGO'}</td>
                                            <td className="py-3 font-extrabold text-slate-900">
                                                {promo.discountPercent > 0 ? `${promo.discountPercent}%` : `₹${promo.discountAmount}`}
                                            </td>
                                            <td className="py-3 text-slate-500 font-bold">{promo.usageCount} / {promo.usageLimit || '∞'}</td>
                                            <td className="py-3 text-right">
                                                <button
                                                    onClick={() => handleDeleteRecord(promo._id)}
                                                    className="p-1 text-slate-400 hover:text-rose-600 transition-colors"
                                                >
                                                    <MdDelete size={18} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}

                        {activeTab === 'currencies' && (
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="border-b border-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-400">
                                        <th className="py-3">Conversion Pair</th>
                                        <th className="py-3">Conversion Rate</th>
                                        <th className="py-3">Effective Date</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {currencies.map(curr => (
                                        <tr key={curr._id} className="border-b border-slate-50 text-sm font-semibold">
                                            <td className="py-3 font-bold text-slate-900">{curr.fromCurrency} ➔ {curr.toCurrency}</td>
                                            <td className="py-3 font-extrabold text-emerald-600">{curr.rate}</td>
                                            <td className="py-3 text-slate-500">{new Date(curr.effectiveDate).toLocaleDateString()}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                )}
            </div>

            {/* Create Modal */}
            <Modal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} title={`Create New ${activeTab.replace('-', ' ')}`}>
                <form onSubmit={handleFormSubmit} className="space-y-4">
                    {activeTab === 'price-books' && (
                        <div className="space-y-4">
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Book Name</label>
                                <input type="text" required className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-semibold" value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Description</label>
                                <input type="text" className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-semibold" value={formData.description || ''} onChange={e => setFormData({ ...formData, description: e.target.value })} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Book Type</label>
                                    <select className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-semibold" value={formData.type || 'Standard'} onChange={e => setFormData({ ...formData, type: e.target.value })}>
                                        <option value="Standard">Standard</option>
                                        <option value="Customer">Customer Specific</option>
                                        <option value="Region">Region Specific</option>
                                        <option value="Dealer">Dealer Specific</option>
                                        <option value="Project">Project Specific</option>
                                        <option value="Contract">Contract Locked</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Target ID / Value</label>
                                    <input type="text" placeholder="State/Customer ID" className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-semibold" value={formData.targetId || ''} onChange={e => setFormData({ ...formData, targetId: e.target.value })} />
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'pricing-rules' && (
                        <div className="space-y-4">
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Rule Name</label>
                                <input type="text" required className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-semibold" value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Rule Type</label>
                                    <select className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-semibold" value={formData.ruleType || 'Quantity'} onChange={e => setFormData({ ...formData, ruleType: e.target.value })}>
                                        <option value="Quantity">Quantity/Slab Pricing</option>
                                        <option value="CustomerGroup">Customer Group Margin</option>
                                        <option value="Industry">Industry Margin</option>
                                        <option value="DynamicMargin">Dynamic Margin (Cost+%)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Catalog Item</label>
                                    <select className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-semibold" value={formData.productId || ''} onChange={e => setFormData({ ...formData, productId: e.target.value })}>
                                        <option value="">Choose item...</option>
                                        {products.map(p => <option key={p._id} value={p._id}>{p.productName}</option>)}
                                    </select>
                                </div>
                            </div>
                            {formData.ruleType === 'Quantity' && (
                                <div className="p-4 bg-slate-50 rounded-xl space-y-3">
                                    <h4 className="text-xs font-black text-slate-600 uppercase tracking-wider">Tier Condition</h4>
                                    <div className="grid grid-cols-3 gap-2">
                                        <input type="number" placeholder="Min Qty" className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold" onChange={e => {
                                            const conds = [...(formData.conditions || [])];
                                            conds[0] = { ...conds[0], minQty: Number(e.target.value) };
                                            setFormData({ ...formData, conditions: conds });
                                        }} />
                                        <input type="number" placeholder="Max Qty" className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold" onChange={e => {
                                            const conds = [...(formData.conditions || [])];
                                            conds[0] = { ...conds[0], maxQty: Number(e.target.value) };
                                            setFormData({ ...formData, conditions: conds });
                                        }} />
                                        <input type="number" placeholder="Rate/Value" className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold" onChange={e => {
                                            const conds = [...(formData.conditions || [])];
                                            conds[0] = { ...conds[0], value: Number(e.target.value) };
                                            setFormData({ ...formData, conditions: conds });
                                        }} />
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'discounts' && (
                        <div className="space-y-4">
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Policy Name</label>
                                <input type="text" required className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-semibold" value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Discount Type</label>
                                    <select className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-semibold" value={formData.discountType || 'Percentage'} onChange={e => setFormData({ ...formData, discountType: e.target.value })}>
                                        <option value="Percentage">Percentage (%)</option>
                                        <option value="Amount">Flat Amount (₹)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Discount Value</label>
                                    <input type="number" required className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-semibold" value={formData.value || 0} onChange={e => setFormData({ ...formData, value: Number(e.target.value) })} />
                                </div>
                            </div>
                            <div className="flex gap-4">
                                <label className="flex items-center gap-2 text-xs font-bold text-slate-600">
                                    <input type="checkbox" checked={formData.stackable || false} onChange={e => setFormData({ ...formData, stackable: e.target.checked })} />
                                    Is Stackable Discount
                                </label>
                            </div>
                        </div>
                    )}

                    {activeTab === 'currencies' && (
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">To Currency</label>
                                <input type="text" placeholder="USD, AED" required className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-semibold" value={formData.toCurrency || ''} onChange={e => setFormData({ ...formData, toCurrency: e.target.value.toUpperCase() })} />
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Conversion Rate</label>
                                <input type="number" step="0.0001" required className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-semibold" value={formData.rate || 1} onChange={e => setFormData({ ...formData, rate: Number(e.target.value) })} />
                            </div>
                        </div>
                    )}

                    <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                        <button type="button" onClick={() => setIsCreateModalOpen(false)} className="px-5 py-2.5 text-xs font-bold text-slate-500 uppercase tracking-widest hover:bg-slate-50 rounded-xl">Cancel</button>
                        <button type="submit" className="px-6 py-2.5 text-xs font-bold text-white bg-primary-600 hover:bg-primary-700 rounded-xl uppercase tracking-widest shadow-lg shadow-primary-600/20">Save</button>
                    </div>
                </form>
            </Modal>

            {/* Price Book Items Editor Drawer */}
            <Modal isOpen={isBookItemsModalOpen} onClose={() => setIsBookItemsModalOpen(false)} title={`Rates for: ${selectedBook?.name}`}>
                <div className="space-y-6">
                    <div className="flex justify-between items-center bg-slate-50 p-4 rounded-2xl border border-slate-100">
                        <span className="text-xs font-black text-slate-500 uppercase tracking-wider">Bulk Actions</span>
                        <div className="flex gap-2">
                            <button
                                onClick={exportPriceBookItemsToExcel}
                                className="flex items-center gap-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 px-3.5 py-2 rounded-xl text-xs font-bold transition-all active:scale-95"
                            >
                                <MdFileDownload size={16} />
                                Export Rates
                            </button>
                            <button
                                onClick={() => setIsItemsImportModalOpen(true)}
                                className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 shadow-sm"
                            >
                                <MdFileUpload size={16} />
                                Import Rates
                            </button>
                        </div>
                    </div>

                    <form onSubmit={handleAddBookItem} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex flex-wrap gap-4 items-end">
                        <div className="flex-1 min-w-[200px]">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Select Product</label>
                            <select required className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl outline-none text-xs font-semibold" value={itemFormData.productId} onChange={e => setItemFormData({ ...itemFormData, productId: e.target.value })}>
                                <option value="">Choose item...</option>
                                {products.map(p => <option key={p._id} value={p._id}>{p.productName} ({p.productCode})</option>)}
                            </select>
                        </div>
                        <div className="w-[140px]">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Custom Price</label>
                            <input type="number" required className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl outline-none text-xs font-semibold" value={itemFormData.price} onChange={e => setItemFormData({ ...itemFormData, price: Number(e.target.value) })} />
                        </div>
                        <button type="submit" className="bg-primary-600 hover:bg-primary-700 text-white font-bold text-xs uppercase tracking-widest px-6 py-2 rounded-xl">Map Rate</button>
                    </form>

                    <div className="max-h-[300px] overflow-y-auto space-y-2">
                        {bookItems.length === 0 ? (
                            <div className="text-center p-6 text-slate-400 text-xs font-bold">No custom item prices mapped to this book.</div>
                        ) : (
                            bookItems.map(item => (
                                <div key={item._id} className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-xl">
                                    <div>
                                        <div className="font-bold text-slate-900 text-sm">{item.productId?.productName}</div>
                                        <div className="text-xs text-slate-400">{item.productId?.productCode}</div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <span className="font-black text-slate-900 text-sm">{item.currency} {Number(item.price).toLocaleString()}</span>
                                        <button onClick={() => handleRemoveBookItem(item._id)} className="text-slate-400 hover:text-rose-600 transition-colors">
                                            <MdDelete size={18} />
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </Modal>

            {/* Import Price Books Modal */}
            <ImportModal
                isOpen={isImportModalOpen}
                onClose={() => setIsImportModalOpen(false)}
                title="Import Price Books"
                onImport={async (file) => {
                    const result = await importService.importPriceBooks(file);
                    fetchTabContent();
                    return result;
                }}
                onDownloadTemplate={importService.getPriceBookTemplate}
            />

            {/* Import Price Book Items Modal */}
            <ImportModal
                isOpen={isItemsImportModalOpen}
                onClose={() => setIsItemsImportModalOpen(false)}
                title={`Import Rates for: ${selectedBook?.name}`}
                onImport={async (file) => {
                    const result = await importService.importPriceBookItems(file, selectedBook?._id);
                    if (selectedBook) {
                        const res = await cpqService.getItemsInPriceBook(selectedBook._id);
                        setBookItems(res.data);
                    }
                    return result;
                }}
                onDownloadTemplate={importService.getPriceBookItemTemplate}
            />
        </div>
    );
};

export default PriceManagement;
