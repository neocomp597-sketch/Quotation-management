import React, { useState, useEffect } from 'react';
import { cpqService, productService, customerService, importService } from '../services/api';
import { toast } from 'react-toastify';
import * as XLSX from 'xlsx';
import { 
    MdAdd, 
    MdDelete, 
    MdEdit, 
    MdFileDownload, 
    MdFileUpload, 
    MdSearch, 
    MdCheck, 
    MdRefresh,
    MdCategory,
    MdReceiptLong
} from 'react-icons/md';
import Modal from '../components/Modal';
import ImportModal from '../components/ImportModal';

// Sample fallback items matching "price book.html"
const SAMPLE_PRICE_BOOK_ITEMS = [
    {
        _id: 'sample_tx_100',
        productCode: 'TX-100KVA',
        productName: '100 KVA Transformer',
        basePrice: 250000,
        discountPercent: 5,
        price: 237500,
        currency: 'INR'
    },
    {
        _id: 'sample_tx_250',
        productCode: 'TX-250KVA',
        productName: '250 KVA Transformer',
        basePrice: 480000,
        discountPercent: 8,
        price: 441600,
        currency: 'INR'
    },
    {
        _id: 'sample_tx_500',
        productCode: 'TX-500KVA',
        productName: '500 KVA Transformer',
        basePrice: 890000,
        discountPercent: 10,
        price: 801000,
        currency: 'INR'
    }
];

const DEFAULT_SAMPLE_CATALOGS = [
    { _id: 'sample_cat_1', name: 'Power Transformers', type: 'Standard', description: 'High-voltage power transformers' },
    { _id: 'sample_cat_2', name: 'Distribution Panels', type: 'Standard', description: 'Electrical distribution panels' },
    { _id: 'sample_cat_3', name: 'Control Panels', type: 'Standard', description: 'PLC & motor control panels' },
    { _id: 'sample_cat_4', name: 'Switchgear', type: 'Standard', description: 'Medium & high voltage switchgear' }
];

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

    // Price Book split view selection (Matching price book.html layout)
    const [selectedBook, setSelectedBook] = useState(null);
    const [bookItems, setBookItems] = useState([]);
    const [loadingBookItems, setLoadingBookItems] = useState(false);

    // Modals
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isAddProductModalOpen, setIsAddProductModalOpen] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [isItemsImportModalOpen, setIsItemsImportModalOpen] = useState(false);

    const [formData, setFormData] = useState({});

    // Product Mapping Form (with Base Price, Discount %, and auto-calculated Final Price)
    const [editingItemId, setEditingItemId] = useState(null);
    const [itemFormData, setItemFormData] = useState({
        productId: '',
        basePrice: '',
        discountPercent: 0,
        finalPrice: 0,
        currency: 'INR'
    });

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
            const loadedProducts = Array.isArray(prodsRes.data) ? prodsRes.data : prodsRes.data?.data || [];
            setProducts(loadedProducts);
            setCustomers(Array.isArray(custRes.data) ? custRes.data : custRes.data?.data || []);

            if (activeTab === 'price-books') {
                const res = await cpqService.getPriceBooks();
                const booksList = res.data || [];
                setPriceBooks(booksList);

                // Auto-select first book or fallback to sample
                if (booksList.length > 0) {
                    const targetBook = selectedBook ? (booksList.find(b => b._id === selectedBook._id) || booksList[0]) : booksList[0];
                    setSelectedBook(targetBook);
                    fetchPriceBookItems(targetBook._id);
                } else {
                    // Fallback preview matching price book.html
                    setSelectedBook(DEFAULT_SAMPLE_CATALOGS[0]);
                    setBookItems(SAMPLE_PRICE_BOOK_ITEMS);
                }
            } else if (activeTab === 'pricing-rules') {
                const res = await cpqService.getPricingRules();
                setRules(res.data || []);
            } else if (activeTab === 'discounts') {
                const res = await cpqService.getDiscountPolicies();
                setPolicies(res.data || []);
            } else if (activeTab === 'promotions') {
                const res = await cpqService.getPromotions();
                setPromotions(res.data || []);
            } else if (activeTab === 'currencies') {
                const res = await cpqService.getCurrencies();
                setCurrencies(res.data || []);
            }
        } catch (err) {
            console.error("Load price management error:", err);
            toast.error("Failed to load records");
        } finally {
            setLoading(false);
        }
    };

    const fetchPriceBookItems = async (bookId) => {
        if (!bookId || String(bookId).startsWith('sample_')) {
            setBookItems(SAMPLE_PRICE_BOOK_ITEMS);
            return;
        }
        setLoadingBookItems(true);
        try {
            const res = await cpqService.getItemsInPriceBook(bookId);
            const items = res.data || [];
            setBookItems(items);
        } catch (err) {
            console.error("Fetch price book items error:", err);
            toast.error("Failed to load price book items");
        } finally {
            setLoadingBookItems(false);
        }
    };

    const handleSelectBook = (book) => {
        setSelectedBook(book);
        fetchPriceBookItems(book._id);
    };

    // Calculate Final Price when Base Price or Discount % changes
    const handleBasePriceOrDiscountChange = (basePriceVal, discountVal) => {
        const bp = parseFloat(basePriceVal) || 0;
        const disc = parseFloat(discountVal) || 0;
        const finalP = Math.max(0, bp - (bp * (disc / 100)));
        setItemFormData(prev => ({
            ...prev,
            basePrice: basePriceVal,
            discountPercent: discountVal,
            finalPrice: Math.round(finalP)
        }));
    };

    const handleProductSelectChange = (productId) => {
        const prod = products.find(p => p._id === productId);
        const baseP = prod ? (prod.basePrice || prod.price || 0) : '';
        const disc = itemFormData.discountPercent || 0;
        const finalP = Math.max(0, (parseFloat(baseP) || 0) * (1 - disc / 100));

        setItemFormData(prev => ({
            ...prev,
            productId,
            basePrice: baseP,
            finalPrice: Math.round(finalP)
        }));
    };

    const handleOpenAddProductModal = (itemToEdit = null) => {
        if (!selectedBook) {
            toast.error("Please select a catalog first");
            return;
        }

        if (itemToEdit) {
            setEditingItemId(itemToEdit._id);
            const bp = itemToEdit.basePrice || itemToEdit.price || 0;
            const disc = itemToEdit.discountPercent || 0;
            setItemFormData({
                productId: itemToEdit.productId?._id || itemToEdit.productId || '',
                basePrice: bp,
                discountPercent: disc,
                finalPrice: itemToEdit.price || Math.round(bp * (1 - disc / 100)),
                currency: itemToEdit.currency || 'INR'
            });
        } else {
            setEditingItemId(null);
            setItemFormData({
                productId: '',
                basePrice: '',
                discountPercent: 0,
                finalPrice: 0,
                currency: 'INR'
            });
        }
        setIsAddProductModalOpen(true);
    };

    const handleSaveBookItem = async (e) => {
        e.preventDefault();
        if (!itemFormData.productId) {
            toast.error("Please select a product");
            return;
        }

        const bp = parseFloat(itemFormData.basePrice) || 0;
        const disc = parseFloat(itemFormData.discountPercent) || 0;
        const finalPrice = Math.max(0, bp - (bp * (disc / 100)));

        try {
            if (selectedBook._id && !String(selectedBook._id).startsWith('sample_')) {
                await cpqService.addItemToPriceBook({
                    priceBookId: selectedBook._id,
                    productId: itemFormData.productId,
                    basePrice: bp,
                    discountPercent: disc,
                    price: Math.round(finalPrice),
                    currency: itemFormData.currency || 'INR'
                });
                toast.success(editingItemId ? "Product rate updated" : "Product added to price book");
                fetchPriceBookItems(selectedBook._id);
            } else {
                // Local state update for sample preview
                const prod = products.find(p => p._id === itemFormData.productId);
                const newSample = {
                    _id: editingItemId || `sample_item_${Date.now()}`,
                    productCode: prod?.productCode || 'TX-CUSTOM',
                    productName: prod?.productName || 'Custom Product',
                    basePrice: bp,
                    discountPercent: disc,
                    price: Math.round(finalPrice),
                    currency: itemFormData.currency || 'INR'
                };

                setBookItems(prev => {
                    if (editingItemId) {
                        return prev.map(i => i._id === editingItemId ? newSample : i);
                    }
                    return [...prev, newSample];
                });
                toast.success("Product rate added to preview");
            }
            setIsAddProductModalOpen(false);
        } catch (err) {
            console.error("Save book item error:", err);
            toast.error(err.response?.data?.message || "Failed to save rate");
        }
    };

    const handleRemoveBookItem = async (itemId) => {
        if (!window.confirm("Are you sure you want to remove this product rate?")) return;
        try {
            if (!String(itemId).startsWith('sample_')) {
                await cpqService.removeItemFromPriceBook(itemId);
                toast.success("Rate item removed");
                if (selectedBook?._id) fetchPriceBookItems(selectedBook._id);
            } else {
                setBookItems(prev => prev.filter(i => i._id !== itemId));
                toast.success("Rate item removed from preview");
            }
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
                const nameTrimmed = formData.name?.trim();
                const typeSelected = formData.type || 'Standard';
                if (!nameTrimmed) {
                    toast.error("Catalog Name is required");
                    return;
                }
                const isDuplicate = priceBooks.some(pb => pb.name?.trim().toLowerCase() === nameTrimmed.toLowerCase() && pb.type === typeSelected);
                if (isDuplicate) {
                    toast.error(`A Price Book with the name "${nameTrimmed}" already exists.`);
                    return;
                }
                const res = await cpqService.createPriceBook(formData);
                toast.success("Catalog created successfully");
                setIsCreateModalOpen(false);
                fetchTabContent();
                if (res.data) setSelectedBook(res.data);
            } else if (activeTab === 'pricing-rules') {
                await cpqService.createPricingRule(formData);
                toast.success("Pricing Rule added");
                setIsCreateModalOpen(false);
                fetchTabContent();
            } else if (activeTab === 'discounts') {
                await cpqService.createDiscountPolicy(formData);
                toast.success("Discount Policy active");
                setIsCreateModalOpen(false);
                fetchTabContent();
            } else if (activeTab === 'promotions') {
                await cpqService.createPromotion(formData);
                toast.success("Promotion active");
                setIsCreateModalOpen(false);
                fetchTabContent();
            } else if (activeTab === 'currencies') {
                await cpqService.createCurrency(formData);
                toast.success("Currency rate locked");
                setIsCreateModalOpen(false);
                fetchTabContent();
            }
        } catch (err) {
            toast.error(err.response?.data?.message || "Failed to save configuration");
        }
    };

    const handleDeleteBook = async (bookId) => {
        if (!window.confirm("Are you sure you want to delete this catalog price book?")) return;
        try {
            if (!String(bookId).startsWith('sample_')) {
                await cpqService.deletePriceBook(bookId);
                toast.success("Catalog deleted successfully");
                fetchTabContent();
            } else {
                setPriceBooks(prev => prev.filter(b => b._id !== bookId));
                toast.success("Catalog removed from preview");
            }
        } catch (err) {
            toast.error("Failed to delete catalog");
        }
    };

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
            const exportItems = bookItems.length > 0 ? bookItems : [];
            if (!exportItems.length) {
                toast.info('No custom rates found in this price book to export');
                return;
            }

            const exportData = exportItems.map((item) => ({
                'Product Code': item.productCode || item.productId?.productCode || '',
                'Product Name': item.productName || item.productId?.productName || '',
                'Base Price': item.basePrice || item.price || 0,
                'Discount Percent': item.discountPercent || 0,
                'Final Price': item.price || 0,
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

    const displayedCatalogs = priceBooks.length > 0 ? priceBooks : DEFAULT_SAMPLE_CATALOGS;

    return (
        <div className="space-y-6 max-w-7xl mx-auto animate-fade-in-up">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 font-outfit uppercase tracking-tight">
                        CRM - Catalog & Price Book
                    </h1>
                    <p className="text-slate-500 font-semibold text-sm">
                        Manage product catalogs, base prices, discounts, and custom pricing books.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {activeTab === 'price-books' && (
                        <>
                            <button
                                onClick={exportPriceBooksToExcel}
                                className="flex items-center gap-2 px-5 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl font-bold text-xs uppercase tracking-wider transition-all shadow-sm active:scale-95"
                            >
                                <MdFileDownload size={18} />
                                Export
                            </button>
                            <button
                                onClick={() => setIsImportModalOpen(true)}
                                className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-all shadow-md active:scale-95"
                            >
                                <MdFileUpload size={18} />
                                Import
                            </button>
                        </>
                    )}
                    <button
                        onClick={handleOpenCreateModal}
                        className="flex items-center gap-2 px-6 py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md active:scale-95"
                    >
                        <MdAdd size={18} />
                        Add {activeTab === 'price-books' ? 'Catalog' : 'Config'}
                    </button>
                </div>
            </div>

            {/* Sub-tabs mapping */}
            <div className="flex gap-2 border-b border-slate-200 overflow-x-auto pb-1">
                {[
                    { key: 'price-books', name: 'Price Books & Catalog' },
                    { key: 'pricing-rules', name: 'Pricing Rules' },
                    { key: 'discounts', name: 'Discount Policies' },
                    { key: 'promotions', name: 'Promotions / Coupons' },
                    { key: 'currencies', name: 'Currency Sheets' }
                ].map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`px-6 py-3.5 text-sm font-bold transition-all border-b-2 whitespace-nowrap ${
                            activeTab === tab.key 
                                ? 'border-primary-600 text-primary-600 font-black' 
                                : 'border-transparent text-slate-500 hover:text-slate-800'
                        }`}
                    >
                        {tab.name}
                    </button>
                ))}
            </div>

            {/* TAB CONTENT: PRICE BOOKS & CATALOG (SPLIT SCREEN MATCHING price book.html) */}
            {activeTab === 'price-books' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* LEFT COLUMN: PRODUCT CATALOG MASTER (width 30% / lg:col-span-4) */}
                    <div className="lg:col-span-4">
                        <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden p-6 space-y-4">
                            <div className="flex items-center justify-between border-b-2 border-sky-500 pb-3">
                                <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                                    <MdCategory className="text-sky-600" size={22} />
                                    Product Catalog
                                </h3>
                                <span className="text-xs font-bold bg-sky-50 text-sky-700 px-2.5 py-1 rounded-full border border-sky-200">
                                    {displayedCatalogs.length} Catalogs
                                </span>
                            </div>

                            <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
                                {displayedCatalogs.map((catalog, index) => {
                                    const isSelected = selectedBook?._id === catalog._id;

                                    return (
                                        <div
                                            key={catalog._id}
                                            onClick={() => handleSelectBook(catalog)}
                                            className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between group ${
                                                isSelected
                                                    ? 'bg-sky-500 text-white border-sky-500 shadow-md font-bold'
                                                    : 'bg-white text-slate-800 border-slate-200 hover:bg-sky-50 hover:border-sky-300'
                                            }`}
                                        >
                                            <div className="flex items-center gap-2.5 min-w-0">
                                                <span className={`text-xs font-mono font-black ${isSelected ? 'text-sky-100' : 'text-slate-400'}`}>
                                                    {index + 1}.
                                                </span>
                                                <span className="text-sm font-bold truncate">
                                                    {catalog.name}
                                                </span>
                                            </div>
                                            
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDeleteBook(catalog._id);
                                                }}
                                                className={`p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity ${
                                                    isSelected 
                                                        ? 'text-sky-100 hover:text-white hover:bg-sky-600' 
                                                        : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                                                }`}
                                                title="Delete Catalog"
                                            >
                                                <MdDelete size={16} />
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>

                            <button
                                onClick={handleOpenCreateModal}
                                className="w-full mt-4 flex items-center justify-center gap-2 py-3 px-4 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-md transition-all active:scale-95"
                            >
                                <MdAdd size={18} />
                                + Add Catalog
                            </button>
                        </div>
                    </div>

                    {/* RIGHT COLUMN: PRICE BOOK TABLE (width 70% / lg:col-span-8) */}
                    <div className="lg:col-span-8">
                        <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden p-6 space-y-4">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b-2 border-emerald-500 pb-3 gap-3">
                                <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                                    <MdReceiptLong className="text-emerald-600" size={22} />
                                    Price Book - {selectedBook?.name || 'Select Catalog'}
                                </h3>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={exportPriceBookItemsToExcel}
                                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-all flex items-center gap-1"
                                    >
                                        <MdFileDownload size={14} /> Export
                                    </button>
                                    <button
                                        onClick={() => setIsItemsImportModalOpen(true)}
                                        className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-xs font-bold transition-all flex items-center gap-1"
                                    >
                                        <MdFileUpload size={14} /> Import
                                    </button>
                                </div>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-emerald-600 text-white text-xs font-bold uppercase tracking-wider">
                                            <th className="px-4 py-3 rounded-l-lg">Product Code</th>
                                            <th className="px-4 py-3">Product Name</th>
                                            <th className="px-4 py-3 text-right">Base Price (₹)</th>
                                            <th className="px-4 py-3 text-center">Discount %</th>
                                            <th className="px-4 py-3 text-right">Final Price (₹)</th>
                                            <th className="px-4 py-3 text-center rounded-r-lg">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 text-sm font-semibold text-slate-700">
                                        {loadingBookItems ? (
                                            <tr>
                                                <td colSpan="6" className="px-6 py-12 text-center text-slate-400 font-bold">
                                                    Loading price book rates...
                                                </td>
                                            </tr>
                                        ) : bookItems.length === 0 ? (
                                            <tr>
                                                <td colSpan="6" className="px-6 py-12 text-center text-slate-400 font-medium">
                                                    No products mapped in this Price Book catalog yet.
                                                </td>
                                            </tr>
                                        ) : (
                                            bookItems.map((item) => {
                                                const pCode = item.productCode || item.productId?.productCode || 'PROD';
                                                const pName = item.productName || item.productId?.productName || 'Product Item';
                                                const baseP = item.basePrice !== undefined ? item.basePrice : (item.productId?.basePrice || item.price || 0);
                                                const discP = item.discountPercent !== undefined ? item.discountPercent : 0;
                                                const finalP = item.price !== undefined ? item.price : Math.round(baseP * (1 - discP / 100));

                                                return (
                                                    <tr key={item._id} className="hover:bg-slate-50/80 transition-colors">
                                                        <td className="px-4 py-3.5 font-mono font-bold text-slate-900">{pCode}</td>
                                                        <td className="px-4 py-3.5 font-bold text-slate-800">{pName}</td>
                                                        <td className="px-4 py-3.5 text-right font-medium text-slate-600">
                                                            {Number(baseP).toLocaleString('en-IN')}
                                                        </td>
                                                        <td className="px-4 py-3.5 text-center">
                                                            <span className="text-rose-600 font-black text-xs bg-rose-50 px-2.5 py-1 rounded-md border border-rose-100">
                                                                {discP}%
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3.5 text-right font-black text-emerald-700">
                                                            {Number(finalP).toLocaleString('en-IN')}
                                                        </td>
                                                        <td className="px-4 py-3.5 text-center">
                                                            <div className="flex items-center justify-center gap-2">
                                                                <button
                                                                    onClick={() => handleOpenAddProductModal(item)}
                                                                    className="px-3 py-1 bg-sky-500 hover:bg-sky-600 text-white rounded-md text-xs font-bold transition-all shadow-sm"
                                                                >
                                                                    Edit
                                                                </button>
                                                                <button
                                                                    onClick={() => handleRemoveBookItem(item._id)}
                                                                    className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-all"
                                                                >
                                                                    <MdDelete size={16} />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            <button
                                onClick={() => handleOpenAddProductModal()}
                                className="mt-4 flex items-center justify-center gap-2 py-3 px-5 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-md transition-all active:scale-95"
                            >
                                <MdAdd size={18} />
                                + Add Product to Price Book
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB CONTENT: OTHER TABS (Pricing Rules, Discounts, Promotions, Currencies) */}
            {activeTab !== 'price-books' && (
                <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden p-6">
                    {loading ? (
                        <div className="text-center p-12 text-slate-400 font-bold">Loading records...</div>
                    ) : (
                        <div>
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
                                    <tbody className="divide-y divide-slate-100 text-sm font-semibold text-slate-700">
                                        {rules.map(rule => (
                                            <tr key={rule._id} className="hover:bg-slate-50/50 transition-colors">
                                                <td className="py-3.5 font-bold text-slate-900">{rule.name}</td>
                                                <td className="py-3.5 text-xs text-indigo-600 uppercase font-black">{rule.ruleType}</td>
                                                <td className="py-3.5 text-slate-500">{rule.productId?.productName || 'Global Rule'}</td>
                                                <td className="py-3.5">
                                                    <span className={`px-2.5 py-1 text-[10px] font-black uppercase rounded-lg ${rule.isActive ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-slate-50 text-slate-400'}`}>
                                                        {rule.isActive ? 'Active' : 'Inactive'}
                                                    </span>
                                                </td>
                                                <td className="py-3.5 text-right">
                                                    <button onClick={() => cpqService.deletePricingRule(rule._id).then(() => fetchTabContent())} className="p-1.5 text-slate-400 hover:text-rose-600 transition-colors">
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
                                    <tbody className="divide-y divide-slate-100 text-sm font-semibold text-slate-700">
                                        {policies.map(policy => (
                                            <tr key={policy._id} className="hover:bg-slate-50/50 transition-colors">
                                                <td className="py-3.5 font-bold text-slate-900">{policy.name}</td>
                                                <td className="py-3.5 text-xs uppercase font-black">{policy.type}</td>
                                                <td className="py-3.5 text-slate-900 font-extrabold">{policy.discountType === 'Percentage' ? `${policy.value}%` : `₹${policy.value}`}</td>
                                                <td className="py-3.5">
                                                    <span className={`px-2.5 py-1 text-[9px] font-black uppercase rounded-lg ${policy.stackable ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-slate-50 text-slate-400'}`}>
                                                        {policy.stackable ? 'Yes' : 'No'}
                                                    </span>
                                                </td>
                                                <td className="py-3.5 text-right">
                                                    <button onClick={() => cpqService.deleteDiscountPolicy(policy._id).then(() => fetchTabContent())} className="p-1.5 text-slate-400 hover:text-rose-600 transition-colors">
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
                                    <tbody className="divide-y divide-slate-100 text-sm font-semibold text-slate-700">
                                        {promotions.map(promo => (
                                            <tr key={promo._id} className="hover:bg-slate-50/50 transition-colors">
                                                <td className="py-3.5 font-bold text-slate-900">{promo.name}</td>
                                                <td className="py-3.5 font-black text-primary-600 tracking-wider">{promo.code || 'BOGO'}</td>
                                                <td className="py-3.5 font-extrabold text-slate-900">
                                                    {promo.discountPercent > 0 ? `${promo.discountPercent}%` : `₹${promo.discountAmount}`}
                                                </td>
                                                <td className="py-3.5 text-slate-500 font-bold">{promo.usageCount} / {promo.usageLimit || '∞'}</td>
                                                <td className="py-3.5 text-right">
                                                    <button onClick={() => cpqService.deletePromotion(promo._id).then(() => fetchTabContent())} className="p-1.5 text-slate-400 hover:text-rose-600 transition-colors">
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
                                    <tbody className="divide-y divide-slate-100 text-sm font-semibold text-slate-700">
                                        {currencies.map(curr => (
                                            <tr key={curr._id} className="hover:bg-slate-50/50 transition-colors">
                                                <td className="py-3.5 font-bold text-slate-900">{curr.fromCurrency} ➔ {curr.toCurrency}</td>
                                                <td className="py-3.5 font-extrabold text-emerald-600">{curr.rate}</td>
                                                <td className="py-3.5 text-slate-500">{new Date(curr.effectiveDate).toLocaleDateString()}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Create Catalog Modal */}
            <Modal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} title={`Create New ${activeTab === 'price-books' ? 'Catalog' : activeTab.replace('-', ' ')}`}>
                <form onSubmit={handleFormSubmit} className="space-y-4">
                    {activeTab === 'price-books' && (
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-slate-700 block mb-1">Catalog Name *</label>
                                <input type="text" required placeholder="e.g. Power Transformers" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-semibold focus:bg-white focus:ring-2 focus:ring-sky-500" value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-700 block mb-1">Description</label>
                                <input type="text" placeholder="Description of products in this catalog" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-semibold focus:bg-white focus:ring-2 focus:ring-sky-500" value={formData.description || ''} onChange={e => setFormData({ ...formData, description: e.target.value })} />
                            </div>
                        </div>
                    )}

                    {activeTab === 'pricing-rules' && (
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-slate-700 block mb-1">Rule Name *</label>
                                <input type="text" required className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-semibold" value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-slate-700 block mb-1">Rule Type</label>
                                    <select className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-semibold" value={formData.ruleType || 'Quantity'} onChange={e => setFormData({ ...formData, ruleType: e.target.value })}>
                                        <option value="Quantity">Quantity/Slab Pricing</option>
                                        <option value="CustomerGroup">Customer Group Margin</option>
                                        <option value="Industry">Industry Margin</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-700 block mb-1">Catalog Item</label>
                                    <select className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-semibold" value={formData.productId || ''} onChange={e => setFormData({ ...formData, productId: e.target.value })}>
                                        <option value="">Choose item...</option>
                                        {products.map(p => <option key={p._id} value={p._id}>{p.productName}</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                        <button type="button" onClick={() => setIsCreateModalOpen(false)} className="px-5 py-2.5 text-xs font-bold text-slate-500 uppercase tracking-widest hover:bg-slate-50 rounded-xl">Cancel</button>
                        <button type="submit" className="px-6 py-2.5 text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 rounded-xl uppercase tracking-widest shadow-md">Save</button>
                    </div>
                </form>
            </Modal>

            {/* Add / Edit Product in Price Book Modal */}
            <Modal isOpen={isAddProductModalOpen} onClose={() => setIsAddProductModalOpen(false)} title={`${editingItemId ? 'Edit' : '+ Add'} Product in Price Book: ${selectedBook?.name}`}>
                <form onSubmit={handleSaveBookItem} className="space-y-4">
                    <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1">Select Product *</label>
                        <select
                            required
                            disabled={!!editingItemId}
                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-semibold focus:bg-white focus:ring-2 focus:ring-sky-500"
                            value={itemFormData.productId}
                            onChange={(e) => handleProductSelectChange(e.target.value)}
                        >
                            <option value="">-- Choose Product --</option>
                            {products.map(p => (
                                <option key={p._id} value={p._id}>
                                    {p.productName} ({p.productCode || 'CODE'})
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-bold text-slate-700 block mb-1">Base Price (₹) *</label>
                            <input
                                type="number"
                                required
                                min="0"
                                placeholder="e.g. 250000"
                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-semibold focus:bg-white focus:ring-2 focus:ring-sky-500"
                                value={itemFormData.basePrice}
                                onChange={(e) => handleBasePriceOrDiscountChange(e.target.value, itemFormData.discountPercent)}
                            />
                        </div>

                        <div>
                            <label className="text-xs font-bold text-slate-700 block mb-1">Discount %</label>
                            <input
                                type="number"
                                min="0"
                                max="100"
                                step="0.5"
                                placeholder="e.g. 5"
                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-semibold focus:bg-white focus:ring-2 focus:ring-sky-500"
                                value={itemFormData.discountPercent}
                                onChange={(e) => handleBasePriceOrDiscountChange(itemFormData.basePrice, e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 flex items-center justify-between">
                        <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Calculated Final Price:</span>
                        <span className="text-lg font-black text-emerald-700">₹{Number(itemFormData.finalPrice || 0).toLocaleString('en-IN')}</span>
                    </div>

                    <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                        <button type="button" onClick={() => setIsAddProductModalOpen(false)} className="px-5 py-2.5 text-xs font-bold text-slate-500 uppercase tracking-widest hover:bg-slate-50 rounded-xl">
                            Cancel
                        </button>
                        <button type="submit" className="px-6 py-2.5 text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 rounded-xl uppercase tracking-widest shadow-md">
                            {editingItemId ? 'Update Rate' : 'Add Product'}
                        </button>
                    </div>
                </form>
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
                        fetchPriceBookItems(selectedBook._id);
                    }
                    return result;
                }}
                onDownloadTemplate={importService.getPriceBookItemTemplate}
            />
        </div>
    );
};

export default PriceManagement;
