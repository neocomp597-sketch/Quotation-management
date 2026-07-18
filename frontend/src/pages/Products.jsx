import React, { useState, useEffect } from 'react';
import { MdAdd, MdSearch, MdEdit, MdDelete, MdInventory, MdCategory, MdQrCode, MdPayments, MdProductionQuantityLimits, MdCloudUpload, MdVisibility, MdFileUpload, MdCheckBox, MdCheckBoxOutlineBlank, MdDeleteSweep, MdSync, MdImage, MdFileDownload } from 'react-icons/md';
import { toast } from 'react-toastify';
import * as XLSX from 'xlsx';
import { productService, uploadService, importService, mgrService, attributeService, productAttributeService, vendorService, categoryService } from '../services/api';

import Modal from '../components/Modal';
import ImportModal from '../components/ImportModal';
import PaginationControls from '../components/PaginationControls';
import { resolveImageUrl, getPlaceholderImage } from '../utils/helpers';
import { useSubmitGuard } from '../hooks/useSubmitGuard';

const LIST_PAGE_SIZE = 20;

const emptyVendorRow = () => ({
    vendorId: '',
    price: '',
    stock: 0,
    isPrimary: false
});

const Products = ({ initialTab = 'products' }) => {
    const [activeTab, setActiveTab] = useState(initialTab);
    const [products, setProducts] = useState([]);
    const [vendors, setVendors] = useState([]);
    const [categories, setCategories] = useState([]);
    const [mgrsData, setMgrsData] = useState({ mgr1: [], mgr2: [], mgr3: [], mgr4: [], mgr5: [] });
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [page, setPage] = useState(1);
    const [pagination, setPagination] = useState({ page: 1, limit: LIST_PAGE_SIZE, total: 0, pages: 1 });
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState(null);
    const [isUploading, setIsUploading] = useState(false);
    const [viewImage, setViewImage] = useState(null);
    const [viewMode, setViewMode] = useState('list'); // 'list' or 'grid'
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [isAttrImportModalOpen, setIsAttrImportModalOpen] = useState(false);

    // Inline Mini Masters states
    const [isCatModalOpen, setIsCatModalOpen] = useState(false);
    const [newCatData, setNewCatData] = useState({ name: '', description: '' });

    const [isVenModalOpen, setIsVenModalOpen] = useState(false);
    const [newVenData, setNewVenData] = useState({ name: '', active: true });

    const [isMgrModalOpen, setIsMgrModalOpen] = useState(false);
    const [newMgrData, setNewMgrData] = useState({ type: 'MGR1', code: '', description: '', status: 'Active' });

    const [isAttrModalOpen, setIsAttrModalOpen] = useState(false);
    const [newAttrData, setNewAttrData] = useState({ code: '', description: '', status: 'Active' });

    // MGR Filters
    const [mgrFilters, setMgrFilters] = useState({
        mgr1: '',
        mgr2: '',
        mgr3: '',
        mgr4: '',
        mgr5: ''
    });

    const [availableAttributes, setAvailableAttributes] = useState([]);
    const [allFilterAttributes, setAllFilterAttributes] = useState([]);
    const [attributeFilters, setAttributeFilters] = useState({});

    // Bulk selection state
    const [selectedIds, setSelectedIds] = useState([]);
    const [isBulkActionLoading, setIsBulkActionLoading] = useState(false);
    const [customAttributes, setCustomAttributes] = useState([]);
    const [allProductAttributes, setAllProductAttributes] = useState({});

    const [formData, setFormData] = useState({
        productName: '',
        productCode: '',
        categoryId: '',
        hsnCode: '',
        gstPercentage: 18,
        basePrice: 0,
        mrp: 0,
        uom: 'Nos',
        productImageUrl: '',
        status: 'Active',
        mgr1: '',
        mgr2: '',
        mgr3: '',
        mgr4: '',
        mgr5: '',
        attributes: [],
        vendors: [emptyVendorRow()],
        catalogType: 'Product',
        subscriptionDetails: { billingCycle: 'Monthly', setupFee: 0, renewalPrice: 0 },
        rentalDetails: { minLeaseTerm: 1, securityDeposit: 0, baseRatePerDay: 0, baseRatePerMonth: 0 },
        pricing: { baseCost: 0, minPrice: 0, maxPrice: 0, marginPercent: 0, currency: 'INR' }
    });

    useEffect(() => {
        fetchMGRs();
        fetchVendors();
        fetchCategories();
        fetchAllAttributes();
    }, []);

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchTerm.trim());
            setPage(1);
        }, 300);

        return () => clearTimeout(timer);
    }, [searchTerm]);

    useEffect(() => {
        setPage(1);
    }, [activeTab, mgrFilters.mgr1, mgrFilters.mgr2, mgrFilters.mgr3, mgrFilters.mgr4, mgrFilters.mgr5]);

    useEffect(() => {
        fetchProducts();
    }, [activeTab, page, debouncedSearch, mgrFilters.mgr1, mgrFilters.mgr2, mgrFilters.mgr3, mgrFilters.mgr4, mgrFilters.mgr5]);

    useEffect(() => {
        if (mgrFilters.mgr3) {
            fetchFilterAttributes(mgrFilters.mgr3);
        } else {
            setAllFilterAttributes([]);
            setAttributeFilters({});
        }
    }, [mgrFilters.mgr3]);

    const fetchCategories = async () => {
        try {
            const res = await categoryService.getAll();
            setCategories(res.data || []);
        } catch (err) {
            console.error("Error fetching categories:", err);
        }
    };

    const fetchMGRs = async () => {
        try {
            const promises = ['MGR1', 'MGR2', 'MGR3', 'MGR4', 'MGR5'].map(type => mgrService.getAll(type));
            const [m1, m2, m3, m4, m5] = await Promise.all(promises);
            setMgrsData({
                mgr1: m1.data.filter(m => m.status === 'Active'),
                mgr2: m2.data.filter(m => m.status === 'Active'),
                mgr3: m3.data.filter(m => m.status === 'Active'),
                mgr4: m4.data.filter(m => m.status === 'Active'),
                mgr5: m5.data.filter(m => m.status === 'Active'),
            });
        } catch (err) {
            console.error("Error fetching MGRs", err);
        }
    };

    const fetchVendors = async () => {
        try {
            const res = await vendorService.getAll();
            setVendors(res.data);
        } catch (err) {
            console.error("Error fetching vendors:", err);
        }
    };

    const fetchAvailableAttributes = async (mgr3Id) => {
        if (!mgr3Id) {
            setAvailableAttributes([]);
            return;
        }
        try {
            const res = await attributeService.getByMGR3(mgr3Id);
            setAvailableAttributes(res.data.filter(a => a.status === 'Active'));
        } catch (err) {
            console.error("Error fetching attributes:", err);
        }
    };

    const fetchFilterAttributes = async (mgr3Id) => {
        try {
            const res = await attributeService.getByMGR3(mgr3Id);
            setAllFilterAttributes(res.data.filter(a => a.status === 'Active'));
        } catch (err) {
            console.error("Error fetching filter attributes:", err);
        }
    };

    const fetchAllAttributes = async () => {
        try {
            const res = await productAttributeService.getAll();
            // Group by productCode for easy lookup
            const grouped = res.data.reduce((acc, curr) => {
                if (!acc[curr.productCode]) acc[curr.productCode] = [];
                acc[curr.productCode].push(curr);
                return acc;
            }, {});
            setAllProductAttributes(grouped);
        } catch (err) {
            console.error("Error fetching all product attributes:", err);
        }
    };

    const fetchCustomAttributes = async (productCode) => {
        if (!productCode) {
            setCustomAttributes([]);
            return;
        }
        try {
            const res = await productAttributeService.getByProductCode(productCode);
            setCustomAttributes(res.data);
        } catch (err) {
            console.error("Error fetching custom attributes:", err);
        }
    };

    const fetchProducts = async () => {
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
                page,
                limit: LIST_PAGE_SIZE,
                search: debouncedSearch || undefined,
                catalogType: typeParam,
                ...Object.fromEntries(Object.entries(mgrFilters).filter(([, value]) => value)),
            });
            const payload = res.data;
            setProducts(Array.isArray(payload) ? payload : payload.data || []);
            setPagination(payload.pagination || {
                page: 1,
                limit: LIST_PAGE_SIZE,
                total: Array.isArray(payload) ? payload.length : 0,
                pages: 1,
            });
        } catch (err) {
            console.error("Error fetching products:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleFormChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));

        if (name === 'mgr3') {
            fetchAvailableAttributes(value);
            setFormData(prev => ({ ...prev, attributes: [] }));
        }
    };

    const addVendorRow = () => {
        setFormData(prev => ({
            ...prev,
            vendors: [...(prev.vendors || []), emptyVendorRow()]
        }));
    };

    const removeVendorRow = (index) => {
        setFormData(prev => {
            const nextVendors = (prev.vendors || []).filter((_, i) => i !== index);
            if (!nextVendors.length) {
                return { ...prev, vendors: [emptyVendorRow()] };
            }
            if (!nextVendors.some(v => v.isPrimary)) {
                nextVendors[0].isPrimary = true;
            }
            return { ...prev, vendors: nextVendors };
        });
    };

    const updateVendorRow = (index, field, value) => {
        setFormData(prev => {
            const nextVendors = [...(prev.vendors || [])];
            const current = { ...(nextVendors[index] || emptyVendorRow()) };
            current[field] = value;
            nextVendors[index] = current;

            if (field === 'isPrimary' && value) {
                nextVendors.forEach((vendor, idx) => {
                    if (idx !== index) vendor.isPrimary = false;
                });
            }

            return { ...prev, vendors: nextVendors };
        });
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setIsUploading(true);
        try {
            const res = await uploadService.uploadImage(file);
            setFormData(prev => ({ ...prev, productImageUrl: res.data.imageUrl }));
            toast.success('Image uploaded successfully!');
        } catch (err) {
            console.error("Upload error:", err);
            toast.error('Failed to upload image');
        } finally {
            setIsUploading(false);
        }
    };

    const { isSubmitting: isSaving, execute: handleSubmit } = useSubmitGuard(async (e) => {
        e.preventDefault();

        // Validate required fields
        if (!formData.productName?.trim()) {
            toast.error('Product Name is required');
            return;
        }
        if (!formData.productCode?.trim()) {
            toast.error('Product Code is required');
            return;
        }
        if (!formData.hsnCode?.trim()) {
            toast.error('HSN Code is required');
            return;
        }

        const normalizedVendors = (formData.vendors || [])
            .filter(v => v.vendorId)
            .map(v => ({
                vendorId: v.vendorId?._id || v.vendorId,
                price: Number(v.price),
                stock: Number(v.stock),
                isPrimary: Boolean(v.isPrimary)
            }));

        if (!normalizedVendors.length && !editingProduct) {
            toast.error('At least one vendor is required');
            return;
        }

        const vendorIdSet = new Set(normalizedVendors.map(v => String(v.vendorId)));
        if (vendorIdSet.size !== normalizedVendors.length) {
            toast.error('Same vendor cannot be added twice');
            return;
        }

        if (normalizedVendors.some(v => !(v.price > 0))) {
            toast.error('Vendor price must be greater than 0');
            return;
        }

        if (normalizedVendors.some(v => v.stock < 0)) {
            toast.error('Vendor stock cannot be negative');
            return;
        }

        let primaryCount = normalizedVendors.filter(v => v.isPrimary).length;
        if (primaryCount > 1) {
            toast.error('Only one primary vendor is allowed');
            return;
        }
        if (normalizedVendors.length && primaryCount === 0) {
            normalizedVendors[0].isPrimary = true;
        }

        if (normalizedVendors.length && normalizedVendors.every(v => v.stock <= 0)) {
            toast.warning('All mapped vendors are out of stock');
        }

        const sortedVendors = [...normalizedVendors].sort((a, b) => {
            if (a.stock > 0 && b.stock === 0) return -1;
            if (a.stock === 0 && b.stock > 0) return 1;
            if (a.isPrimary && !b.isPrimary) return -1;
            if (!a.isPrimary && b.isPrimary) return 1;
            return a.price - b.price;
        });

        const derivedBasePrice = sortedVendors.length
            ? Number(sortedVendors[0].price || 0)
            : Number(formData.basePrice || 0);

        if (!(derivedBasePrice > 0)) {
            toast.error('Base price must be greater than 0');
            return;
        }

        try {
            // Ensure MGR and Category fields are sent as IDs, not objects
            const payload = {
                ...formData,
                categoryId: formData.categoryId?._id || formData.categoryId,
                mgr1: formData.mgr1?._id || formData.mgr1,
                mgr2: formData.mgr2?._id || formData.mgr2,
                mgr3: formData.mgr3?._id || formData.mgr3,
                mgr4: formData.mgr4?._id || formData.mgr4,
                mgr5: formData.mgr5?._id || formData.mgr5,
                attributes: formData.attributes || [],
                vendors: normalizedVendors,
                basePrice: derivedBasePrice
            };

            if (editingProduct) {
                await productService.update(editingProduct._id, payload);
                toast.success('Product updated successfully!');
            } else {
                await productService.create(payload);
                toast.success('Product created successfully!');
            }
            fetchProducts();
            fetchAllAttributes();
            setIsModalOpen(false);
        } catch (err) {
            console.error("Error saving product:", err);
            toast.error(err.response?.data?.message || 'Error saving product data');
        }
    });

    const handleDelete = async (id) => {
        if (window.confirm("Are you sure you want to delete this product?")) {
            try {
                await productService.delete(id);
                toast.success('Product deleted successfully!');
                fetchProducts();
            } catch (err) {
                console.error("Error deleting product:", err);
                toast.error('Failed to delete product');
            }
        }
    };

    // Bulk selection handlers
    const toggleSelectAll = () => {
        if (selectedIds.length === filteredProducts.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(filteredProducts.map(p => p._id));
        }
    };

    const toggleSelectOne = (id) => {
        setSelectedIds(prev =>
            prev.includes(id)
                ? prev.filter(i => i !== id)
                : [...prev, id]
        );
    };

    const handleBulkDelete = async () => {
        if (selectedIds.length === 0) return;

        if (window.confirm(`Are you sure you want to delete ${selectedIds.length} products? This cannot be undone.`)) {
            setIsBulkActionLoading(true);
            try {
                await productService.bulkDelete(selectedIds);
                setSelectedIds([]);
                fetchProducts();
                toast.success(`${selectedIds.length} products deleted successfully`);
            } catch (err) {
                console.error("Error bulk deleting:", err);
                toast.error('Failed to delete products');
            } finally {
                setIsBulkActionLoading(false);
            }
        }
    };

    const handleBulkStatusUpdate = async (status) => {
        if (selectedIds.length === 0) return;

        setIsBulkActionLoading(true);
        try {
            await productService.bulkUpdate(selectedIds, { status });
            setSelectedIds([]);
            fetchProducts();
            toast.success(`${selectedIds.length} products updated to ${status}`);
        } catch (err) {
            console.error("Error bulk updating:", err);
            toast.error('Failed to update products');
        } finally {
            setIsBulkActionLoading(false);
        }
    };

    const filteredProducts = products.filter(p => {
        const searchLower = searchTerm.toLowerCase();

        // Search in basic info
        const matchesBasic = p.productName?.toLowerCase().includes(searchLower) ||
            p.productCode?.toLowerCase().includes(searchLower) ||
            p.hsnCode?.toLowerCase().includes(searchLower) ||
            p.uom?.toLowerCase().includes(searchLower);

        // Search in MGRs
        const matchesMGRNames =
            p.mgr1?.code?.toLowerCase().includes(searchLower) || p.mgr1?.description?.toLowerCase().includes(searchLower) ||
            p.mgr2?.code?.toLowerCase().includes(searchLower) || p.mgr2?.description?.toLowerCase().includes(searchLower) ||
            p.mgr3?.code?.toLowerCase().includes(searchLower) || p.mgr3?.description?.toLowerCase().includes(searchLower) ||
            p.mgr4?.code?.toLowerCase().includes(searchLower) || p.mgr4?.description?.toLowerCase().includes(searchLower) ||
            p.mgr5?.code?.toLowerCase().includes(searchLower) || p.mgr5?.description?.toLowerCase().includes(searchLower);

        // Search in Attributes
        const matchesAttributeSearch = (p.attributes || []).some(attr =>
            attr.code?.toLowerCase().includes(searchLower) ||
            attr.description?.toLowerCase().includes(searchLower)
        );

        // Search in Custom Attributes
        const productCustomAttrs = allProductAttributes[p.productCode] || [];
        const matchesCustomAttributeSearch = productCustomAttrs.some(attr =>
            attr.attributeCode?.toLowerCase().includes(searchLower) ||
            attr.attributeValue?.toLowerCase().includes(searchLower)
        );

        const matchesSearch = matchesBasic || matchesMGRNames || matchesAttributeSearch || matchesCustomAttributeSearch;

        const matchesMGR1 = !mgrFilters.mgr1 || p.mgr1?._id === mgrFilters.mgr1 || p.mgr1 === mgrFilters.mgr1;
        const matchesMGR2 = !mgrFilters.mgr2 || p.mgr2?._id === mgrFilters.mgr2 || p.mgr2 === mgrFilters.mgr2;
        const matchesMGR3 = !mgrFilters.mgr3 || p.mgr3?._id === mgrFilters.mgr3 || p.mgr3 === mgrFilters.mgr3;
        const matchesMGR4 = !mgrFilters.mgr4 || p.mgr4?._id === mgrFilters.mgr4 || p.mgr4 === mgrFilters.mgr4;
        const matchesMGR5 = !mgrFilters.mgr5 || p.mgr5?._id === mgrFilters.mgr5 || p.mgr5 === mgrFilters.mgr5;

        // Attribute filtering: if any attribute filter is selected, product MUST have all of them
        const selectedAttrIds = Object.keys(attributeFilters);
        const matchesAttributes = selectedAttrIds.length === 0 ||
            selectedAttrIds.every(id => {
                const attrObj = allFilterAttributes.find(a => a._id === id);
                if (!attrObj) return false;

                const filterCode = attrObj.code?.toString().toLowerCase().trim();
                const filterDesc = attrObj.description?.toString().toLowerCase().trim();

                // Check in standard attributes (by ID OR by Code+Description case-insensitive)
                const hasStandard = (p.attributes || []).some(attr => {
                    if (!attr) return false;
                    const attrId = attr._id || attr;
                    if (attrId === id) return true;

                    if (typeof attr === 'object') {
                        const code = attr.code?.toString().toLowerCase().trim();
                        const desc = attr.description?.toString().toLowerCase().trim();
                        return code === filterCode && desc === filterDesc;
                    }
                    return false;
                });
                if (hasStandard) return true;

                // If not found in standard, check in custom attributes
                const productCustomAttrs = allProductAttributes[p.productCode] || [];
                return productCustomAttrs.some(ca => {
                    const caCode = ca.attributeCode?.toString().toLowerCase().trim();
                    const caValue = ca.attributeValue?.toString().toLowerCase().trim();
                    return caCode === filterCode && caValue === filterDesc;
                });
            });

        return matchesSearch && matchesMGR1 && matchesMGR2 && matchesMGR3 && matchesMGR4 && matchesMGR5 && matchesAttributes;
    });

    // Extract unique MGRs maintained in Product Master for filters
    const getUsedMGRs = (mgrKey) => {
        const usedMap = new Map();
        products.forEach(p => {
            const mgr = p[mgrKey];
            if (mgr && mgr._id) {
                usedMap.set(mgr._id, mgr);
            }
        });
        return Array.from(usedMap.values()).sort((a, b) => a.code?.localeCompare(b.code));
    };

    const handleAttributeFilterChange = (attrId) => {
        setAttributeFilters(prev => {
            const next = { ...prev };
            if (next[attrId]) {
                delete next[attrId];
            } else {
                next[attrId] = true;
            }
            return next;
        });
    };

    const handleMgrFilterChange = (e) => {
        const { name, value } = e.target;
        setMgrFilters(prev => ({ ...prev, [name]: value }));
        if (name === 'mgr3') {
            setAttributeFilters({}); // Reset attribute filters when MGR3 changes
        }
    };

    const clearFilters = () => {
        setMgrFilters({
            mgr1: '',
            mgr2: '',
            mgr3: '',
            mgr4: '',
            mgr5: ''
        });
        setAttributeFilters({});
        setSearchTerm('');
    };

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
                search: debouncedSearch || undefined,
                catalogType: typeParam,
                ...Object.fromEntries(Object.entries(mgrFilters).filter(([, value]) => value)),
            });
            
            const exportProducts = Array.isArray(res.data) ? res.data : res.data?.data || [];
            if (!exportProducts.length) {
                toast.info('No products found to export');
                return;
            }

            const exportData = exportProducts.map((p) => {
                const standardAttributes = (p.attributes || []).map(a => `${a.code}:${a.description}`).join(', ');
                const customAttrs = allProductAttributes[p.productCode] || [];
                const customAttributesStr = customAttrs.map(ca => `${ca.attributeCode}:${ca.attributeValue}`).join(', ');
                
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
                    'Standard Attributes': standardAttributes,
                    'Custom Attributes': customAttributesStr
                };
            });

            const ws = XLSX.utils.json_to_sheet(exportData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Products');
            XLSX.writeFile(wb, `${typeParam}_Catalog_${new Date().toISOString().slice(0, 10)}.xlsx`);
            toast.success('Export completed successfully');
        } catch (err) {
            console.error('Export products error:', err);
            toast.error('Failed to export products');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight font-outfit uppercase">Product Catalog</h1>
                    <p className="text-slate-500 font-medium">All products at one place.</p>
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
                        onClick={() => setIsAttrImportModalOpen(true)}
                        className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-3 rounded-2xl font-bold transition-all shadow-xl shadow-indigo-600/20 uppercase text-xs tracking-widest active:scale-95"
                    >
                        <MdFileUpload size={20} />
                        <span>Import Attributes</span>
                    </button>
                    <button

                        onClick={() => handleOpenModal()}
                        className="flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-2xl font-bold transition-all shadow-xl shadow-primary-600/20 uppercase text-xs tracking-widest active:scale-95"
                    >
                        <MdAdd size={20} />
                        <span>Add New Product</span>
                    </button>
                </div>
            </div>

            {/* Bulk Action Toolbar */}
            {selectedIds.length > 0 && (
                <div className="bg-slate-900 rounded-2xl p-4 flex items-center justify-between gap-4 shadow-xl animate-in slide-in-from-top-2">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center">
                            <MdCheckBox size={24} className="text-primary-400" />
                        </div>
                        <div>
                            <div className="text-white font-black text-sm">{selectedIds.length} Selected</div>
                            <div className="text-slate-400 text-xs">Choose an action below</div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => handleBulkStatusUpdate('Active')}
                            disabled={isBulkActionLoading}
                            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs uppercase tracking-widest transition-all disabled:opacity-50"
                        >
                            <MdSync size={16} />
                            Set Active
                        </button>
                        <button
                            onClick={() => handleBulkStatusUpdate('Inactive')}
                            disabled={isBulkActionLoading}
                            className="flex items-center gap-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold text-xs uppercase tracking-widest transition-all disabled:opacity-50"
                        >
                            <MdSync size={16} />
                            Set Inactive
                        </button>
                        <button
                            onClick={handleBulkDelete}
                            disabled={isBulkActionLoading}
                            className="flex items-center gap-2 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-xs uppercase tracking-widest transition-all disabled:opacity-50"
                        >
                            <MdDeleteSweep size={16} />
                            Delete All
                        </button>
                        <button
                            onClick={() => setSelectedIds([])}
                            className="px-4 py-2.5 text-slate-400 hover:text-white transition-colors font-bold text-xs uppercase tracking-widest"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            <div className="mobile-master-shell bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
                {/* MGR Filters Section */}
                <div className="mobile-master-toolbar px-6 py-6 border-b border-slate-50 bg-white">
                    <div className="space-y-6">
                        <div className="flex flex-wrap gap-4">
                            {[1, 2, 3, 4, 5].map(num => {
                                const mgrKey = `mgr${num}`;
                                const usedOptions = getUsedMGRs(mgrKey);
                                return (
                                    <div key={mgrKey} className="flex-1 min-w-[140px]">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Filter MGR {num}</label>
                                        <select
                                            name={mgrKey}
                                            value={mgrFilters[mgrKey]}
                                            onChange={handleMgrFilterChange}
                                            className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none text-[11px] font-bold appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2210%22%20height%3D%226%22%20viewBox%3D%220%200%2010%206%22%20fill%3D%22none%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%3Cpath%20d%3D%22M1%201L5%205L9%201%22%20stroke%3D%22%2394A3B8%22%20stroke-width%3D%221.5%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22/%3E%3C/svg%3E')] bg-[length:12px_8px] bg-[right_1rem_center] bg-no-repeat focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all cursor-pointer"
                                        >
                                            <option value="">All MGR {num}</option>
                                            {usedOptions.map(m => (
                                                <option key={m._id} value={m._id}>{m.code}</option>
                                            ))}
                                        </select>
                                    </div>
                                );
                            })}
                            <div className="flex items-end flex-shrink-0">
                                <button
                                    onClick={clearFilters}
                                    className="px-4 py-2 text-[10px] font-black text-rose-600 uppercase tracking-widest hover:bg-rose-50 rounded-xl transition-all"
                                >
                                    Clear All
                                </button>
                            </div>
                        </div>

                        {/* Attribute Filters */}
                        {mgrFilters.mgr3 && allFilterAttributes.length > 0 && (
                            <div className="pt-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-4 block">Filter by Attributes</label>
                                <div className="space-y-4">
                                    {Object.entries(
                                        allFilterAttributes.reduce((acc, attr) => {
                                            if (!acc[attr.code]) acc[attr.code] = [];
                                            acc[attr.code].push(attr);
                                            return acc;
                                        }, {})
                                    ).map(([code, attrs]) => (
                                        <div key={code} className="flex flex-col gap-2">
                                            <span className="text-[9px] font-black text-primary-600/60 uppercase tracking-widest ml-1">{code}</span>
                                            <div className="flex flex-wrap gap-2">
                                                {attrs.map(attr => (
                                                    <button
                                                        key={attr._id}
                                                        onClick={() => handleAttributeFilterChange(attr._id)}
                                                        className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all border ${attributeFilters[attr._id]
                                                                ? 'bg-primary-600 text-white border-primary-600 shadow-sm'
                                                                : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                                                            }`}
                                                    >
                                                        {attr.description}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="p-6 border-b border-slate-50 flex flex-col md:flex-row gap-4 items-center bg-slate-50/30">
                    <div className="relative flex-1 w-full text-slate-400 focus-within:text-primary-600 transition-colors">
                        <MdSearch className="absolute left-4 top-1/2 -translate-y-1/2" size={20} />
                        <input
                            type="text"
                            placeholder="Search by Product Name, Code or HSN..."
                            className="w-full pl-12 pr-4 py-3.5 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 outline-none text-sm text-slate-900 transition-all font-medium"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="hidden md:flex gap-2">
                        <button
                            onClick={() => setViewMode('list')}
                            className={`p-3 rounded-xl transition-all ${viewMode === 'list' ? 'bg-primary-50 text-primary-600' : 'bg-white text-slate-400 border border-slate-200 hover:bg-slate-50'}`}
                            title="List View"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                            </svg>
                        </button>
                        <button
                            onClick={() => setViewMode('grid')}
                            className={`p-3 rounded-xl transition-all ${viewMode === 'grid' ? 'bg-primary-50 text-primary-600' : 'bg-white text-slate-400 border border-slate-200 hover:bg-slate-50'}`}
                            title="Grid View"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                            </svg>
                        </button>
                    </div>
                </div>

                <div>
                    {loading ? (
                        <div className="p-20 text-center text-slate-400 font-medium">
                            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-primary-500 border-t-transparent mb-4"></div>
                            <p className="text-xs uppercase font-black tracking-widest">Loading Catalog...</p>
                        </div>
                    ) : (
                        <>
                            {/* Mobile Card View */}
                            <div className="md:hidden p-4 space-y-4 bg-slate-50/50">
                                {filteredProducts.map((p) => (
                                    <div key={p._id} className={`mobile-master-card bg-white rounded-2xl border shadow-sm overflow-hidden ${selectedIds.includes(p._id) ? 'border-primary-500 ring-1 ring-primary-500' : 'border-slate-100'}`}>
                                        <div className="p-4 flex gap-4">
                                            <div
                                                className="h-20 w-20 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-center flex-shrink-0 cursor-pointer overflow-hidden"
                                                onClick={() => handleOpenModal(p)}
                                            >
                                                {p.productImageUrl ? (
                                                    <img src={resolveImageUrl(p.productImageUrl)} alt={p.productName} className="h-full w-full object-contain" />
                                                ) : (
                                                    <MdImage className="text-slate-300" size={32} />
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <h3 className="font-bold text-slate-900 truncate pr-2 text-sm">{p.productName}</h3>
                                                        <div className="flex flex-wrap items-center gap-2 mt-0.5">
                                                            <p className="text-xs text-slate-500 font-mono">{p.productCode}</p>
                                                            {p.attributes && p.attributes.length > 0 && (
                                                                <div className="flex flex-wrap gap-1">
                                                                    {p.attributes.map(attr => (
                                                                        <span key={attr._id || attr} className="px-1 py-0.5 bg-primary-50 text-primary-600 text-[8px] font-black uppercase tracking-widest rounded">
                                                                            {attr.code || attr}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={() => toggleSelectOne(p._id)}
                                                        className="p-1 -mt-1 -mr-1"
                                                    >
                                                        {selectedIds.includes(p._id) ? (
                                                            <MdCheckBox size={24} className="text-primary-600" />
                                                        ) : (
                                                            <MdCheckBoxOutlineBlank size={24} className="text-slate-300" />
                                                        )}
                                                    </button>
                                                </div>
                                                <div className="mt-2 flex items-center justify-between">
                                                    <div>
                                                        <span className="font-black text-slate-900">₹{p.basePrice?.toLocaleString()}</span>
                                                        <p className="text-[10px] font-bold text-slate-400">{p.vendors?.length || 0} vendors</p>
                                                    </div>
                                                    <span className={`px-2 py-0.5 text-[10px] font-black uppercase tracking-widest rounded-md border ${p.status === 'Active'
                                                        ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                                                        : 'bg-rose-50 text-rose-600 border-rose-100'
                                                        }`}>
                                                        {p.status}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="bg-slate-50 px-4 py-3 flex justify-between items-center border-t border-slate-100">
                                            <div className="text-xs text-slate-500 font-medium">
                                                HSN: {p.hsnCode || 'N/A'}
                                            </div>
                                            <div className="flex gap-1">
                                                <button
                                                    onClick={() => handleOpenModal(p)}
                                                    className="p-2 text-slate-400 hover:text-primary-600 hover:bg-white rounded-lg transition-all"
                                                >
                                                    <MdEdit size={18} />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(p._id)}
                                                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-white rounded-lg transition-all"
                                                >
                                                    <MdDelete size={18} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {filteredProducts.length === 0 && (
                                    <div className="text-center p-8 text-slate-400 text-sm">No products found</div>
                                )}
                            </div>

                            {/* Desktop Views */}
                            <div className="hidden md:block">
                                {viewMode === 'list' ? (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left">
                                            <thead className="bg-slate-50 text-slate-400 text-[10px] uppercase font-black tracking-widest border-b border-slate-100">
                                                <tr>
                                                    <th className="px-4 py-5 w-12">
                                                        <button
                                                            onClick={toggleSelectAll}
                                                            className="p-1 hover:bg-slate-200 rounded-lg transition-colors"
                                                        >
                                                            {selectedIds.length === filteredProducts.length && filteredProducts.length > 0 ? (
                                                                <MdCheckBox size={20} className="text-primary-600" />
                                                            ) : (
                                                                <MdCheckBoxOutlineBlank size={20} />
                                                            )}
                                                        </button>
                                                    </th>
                                                    <th className="px-4 py-5">Product Info</th>
                                                    <th className="px-8 py-5">Code & HSN</th>
                                                    <th className="px-8 py-5 text-right">Pricing (Base / MRP)</th>
                                                    <th className="px-8 py-5 text-center">Status</th>
                                                    <th className="px-8 py-5 text-right">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {filteredProducts.map((p) => (
                                                    <tr key={p._id} className={`hover:bg-slate-50 transition-colors group ${selectedIds.includes(p._id) ? 'bg-primary-50/50' : ''}`}>
                                                        <td className="px-4 py-5">
                                                            <button
                                                                onClick={() => toggleSelectOne(p._id)}
                                                                className="p-1 hover:bg-slate-200 rounded-lg transition-colors"
                                                            >
                                                                {selectedIds.includes(p._id) ? (
                                                                    <MdCheckBox size={20} className="text-primary-600" />
                                                                ) : (
                                                                    <MdCheckBoxOutlineBlank size={20} className="text-slate-300" />
                                                                )}
                                                            </button>
                                                        </td>
                                                        <td className="px-4 py-5">
                                                            <div className="flex items-center gap-4">
                                                                <div
                                                                    className="h-12 w-12 rounded-xl bg-white border border-slate-100 overflow-hidden flex-shrink-0 cursor-pointer hover:border-primary-500 transition-all"
                                                                    onClick={() => setViewImage(p.productImageUrl || getPlaceholderImage(p.productCode))}
                                                                >
                                                                    <img
                                                                        src={p.productImageUrl ? resolveImageUrl(p.productImageUrl) : getPlaceholderImage(p.productCode)}
                                                                        alt={p.productName}
                                                                        className="h-full w-full object-cover"
                                                                        onError={(e) => {
                                                                            e.target.onerror = null;
                                                                            e.target.src = getPlaceholderImage(p.productCode);
                                                                        }}
                                                                    />
                                                                </div>
                                                                <div>
                                                                    <div className="font-bold text-slate-900">{p.productName}</div>
                                                                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                                                        <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{p.uom}</span>
                                                                        {p.attributes && p.attributes.length > 0 && (
                                                                            <div className="flex flex-wrap gap-1">
                                                                                {p.attributes.map(attr => (
                                                                                    <span key={attr._id || attr} className="px-1.5 py-0.5 bg-primary-50 text-primary-600 text-[8px] font-black uppercase tracking-widest rounded border border-primary-100">
                                                                                        {attr.code || attr}
                                                                                    </span>
                                                                                ))}
                                                                            </div>
                                                                        )}
                                                                        {allProductAttributes[p.productCode] && (
                                                                            <div className="flex flex-wrap gap-1">
                                                                                {allProductAttributes[p.productCode].map(attr => (
                                                                                    <span key={attr._id} className="px-1.5 py-0.5 bg-indigo-50 text-indigo-600 text-[8px] font-black uppercase tracking-widest rounded border border-indigo-100" title={`${attr.attributeCode}: ${attr.attributeValue}`}>
                                                                                        {attr.attributeCode}
                                                                                    </span>
                                                                                ))}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-8 py-5">
                                                            <div className="text-sm font-mono font-bold text-primary-700 tracking-tight">{p.productCode}</div>
                                                            <div className="text-[10px] text-slate-400 uppercase font-bold mt-1">HSN: {p.hsnCode}</div>
                                                        </td>
                                                        <td className="px-8 py-5 text-right">
                                                            <div className="text-sm font-black text-slate-900">₹{p.basePrice?.toLocaleString()}</div>
                                                            <div className="text-[10px] text-slate-400">{p.vendors?.length || 0} vendors mapped</div>
                                                            <div className="text-[10px] text-slate-400 line-through">MRP: ₹{p.mrp?.toLocaleString()}</div>
                                                        </td>
                                                        <td className="px-8 py-5 text-center">
                                                            <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-[0.1em] ${p.status === 'Active' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-slate-100 text-slate-400 border border-slate-200'
                                                                }`}>
                                                                {p.status}
                                                            </span>
                                                        </td>
                                                        <td className="px-8 py-5 text-right">
                                                            <div className="flex items-center justify-end gap-2">
                                                                {p.productImageUrl && (
                                                                    <button
                                                                        onClick={() => setViewImage(p.productImageUrl)}
                                                                        className="p-2.5 text-slate-500 hover:bg-slate-50 rounded-xl transition-all shadow-sm bg-white border border-slate-100"
                                                                        title="View Image"
                                                                    >
                                                                        <MdVisibility size={18} />
                                                                    </button>
                                                                )}
                                                                <button
                                                                    onClick={() => handleOpenModal(p)}
                                                                    className="p-2.5 text-primary-600 hover:bg-primary-50 rounded-xl transition-all shadow-sm bg-white border border-slate-100"
                                                                    title="Edit Product"
                                                                >
                                                                    <MdEdit size={18} />
                                                                </button>
                                                                <button
                                                                    onClick={() => handleDelete(p._id)}
                                                                    className="p-2.5 text-rose-500 hover:bg-rose-50 rounded-xl transition-all shadow-sm bg-white border border-slate-100"
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
                                ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 p-6">
                                        {filteredProducts.map((p) => (
                                            <div key={p._id} className={`mobile-master-card bg-white rounded-2xl border hover:shadow-xl transition-all group flex flex-col overflow-hidden ${selectedIds.includes(p._id) ? 'border-primary-400 ring-2 ring-primary-200' : 'border-slate-100 hover:border-primary-100'}`}>
                                                <div className="aspect-square bg-slate-50 relative overflow-hidden group-hover:bg-slate-100 transition-colors">
                                                    {/* Checkbox */}
                                                    <button
                                                        onClick={() => toggleSelectOne(p._id)}
                                                        className="absolute top-4 left-4 z-10 p-1.5 bg-white/90 backdrop-blur-sm rounded-lg shadow-sm border border-slate-200 hover:bg-white transition-all"
                                                    >
                                                        {selectedIds.includes(p._id) ? (
                                                            <MdCheckBox size={20} className="text-primary-600" />
                                                        ) : (
                                                            <MdCheckBoxOutlineBlank size={20} className="text-slate-400" />
                                                        )}
                                                    </button>
                                                    <img
                                                        src={p.productImageUrl ? resolveImageUrl(p.productImageUrl) : getPlaceholderImage(p.productCode)}
                                                        alt={p.productName}
                                                        className="w-full h-full object-cover"
                                                        onError={(e) => {
                                                            e.target.onerror = null;
                                                            e.target.src = getPlaceholderImage(p.productCode);
                                                        }}
                                                    />
                                                    <div className="absolute top-4 right-4 flex gap-2">
                                                        <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-[0.1em] backdrop-blur-md ${p.status === 'Active' ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' : 'bg-slate-500/10 text-slate-600 border border-slate-500/20'
                                                            }`}>
                                                            {p.status}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="p-6 flex-1 flex flex-col">
                                                    <div className="mb-4 flex-1">
                                                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{p.productCode}</div>
                                                        <h3 className="font-bold text-slate-900 leading-tight mb-2 line-clamp-2">{p.productName}</h3>
                                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">HSN: {p.hsnCode}</p>
                                                    </div>
                                                    <div className="flex items-end justify-between border-t border-slate-50 pt-4 mt-auto">
                                                        <div>
                                                            <div className="text-lg font-black text-slate-900">₹{p.basePrice?.toLocaleString()}</div>
                                                            <div className="text-[10px] text-slate-400">{p.vendors?.length || 0} vendors</div>
                                                            <div className="text-[10px] text-slate-400 line-through">MRP: ₹{p.mrp?.toLocaleString()}</div>
                                                        </div>
                                                        <div className="flex gap-2">
                                                            <button
                                                                onClick={() => handleOpenModal(p)}
                                                                className="p-2 text-primary-600 hover:bg-primary-50 rounded-xl transition-all shadow-sm bg-white border border-slate-100"
                                                            >
                                                                <MdEdit size={18} />
                                                            </button>
                                                            <button
                                                                onClick={() => handleDelete(p._id)}
                                                                className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-all shadow-sm bg-white border border-slate-100"
                                                            >
                                                                <MdDelete size={18} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <PaginationControls pagination={pagination} onPageChange={setPage} />
                        </>
                    )}
                </div>
            </div>

            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={editingProduct ? "Maintain Product" : "Expand Catalog"}
                maxWidth="max-w-4xl"
                footer={
                    <>
                        <button
                            onClick={() => setIsModalOpen(false)}
                            className="px-6 py-2.5 text-slate-500 font-black hover:text-slate-900 transition-all uppercase text-[10px] tracking-widest"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={isSaving}
                            className="bg-primary-600 hover:bg-primary-700 text-white px-10 py-3.5 rounded-2xl font-black transition-all shadow-xl shadow-primary-600/20 uppercase text-[10px] tracking-widest active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100"
                        >
                            {isSaving ? "Saving..." : editingProduct ? "Update Product" : "Enlist Product"}
                        </button>
                    </>
                }
            >
                <form className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8 py-2">
                    <div className="space-y-8">
                        <div>
                            <h4 className="text-[10px] font-black text-primary-600 uppercase tracking-[0.2em] mb-6 flex items-center gap-3">
                                <span className="h-px flex-1 bg-primary-100"></span>
                                Specifications
                                <span className="h-px flex-1 bg-primary-100"></span>
                            </h4>
                            <div className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Comprehensive Product Name <span className="text-rose-500">*</span></label>
                                    <div className="relative">
                                        <MdInventory className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                                        <input
                                            type="text"
                                            name="productName"
                                            value={formData.productName}
                                            onChange={handleFormChange}
                                            className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all outline-none text-sm font-bold"
                                            placeholder="Brand + Model + Specification"
                                            required
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Serial/Product Code <span className="text-rose-500">*</span></label>
                                        <div className="relative">
                                            <MdQrCode className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                                            <input
                                                type="text"
                                                name="productCode"
                                                value={formData.productCode}
                                                onChange={handleFormChange}
                                                className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 outline-none text-sm font-mono font-bold uppercase"
                                                placeholder="UID001"
                                                required
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">HSN Code (8-Digit) <span className="text-rose-500">*</span></label>
                                        <div className="relative">
                                            <MdCategory className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                                            <input
                                                type="text"
                                                name="hsnCode"
                                                value={formData.hsnCode}
                                                onChange={handleFormChange}
                                                className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none text-sm font-bold"
                                                placeholder="84818020"
                                                required
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Product Visual (Upload or URL)</label>
                                    <div className="flex flex-col gap-4">
                                        <div className="flex gap-4">
                                            <label className="flex-1 flex items-center justify-center gap-2 px-4 py-3.5 bg-primary-50 border-2 border-dashed border-primary-200 rounded-2xl cursor-pointer hover:bg-primary-100 transition-all group">
                                                <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} disabled={isUploading} />
                                                <MdCloudUpload className={`text-primary-600 ${isUploading ? 'animate-bounce' : 'group-hover:scale-110 transition-transform'}`} size={20} />
                                                <span className="text-xs font-black text-primary-700 uppercase tracking-widest">
                                                    {isUploading ? 'Uploading...' : 'Upload Image'}
                                                </span>
                                            </label>

                                            {formData.productImageUrl && (
                                                <div className="relative group/img h-[52px] w-[52px]">
                                                    <div className="h-full w-full rounded-2xl bg-white border border-slate-200 p-1.5 shadow-sm overflow-hidden">
                                                        <img src={resolveImageUrl(formData.productImageUrl)} alt="" className="h-full w-full object-contain" />
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => setViewImage(formData.productImageUrl)}
                                                        className="absolute inset-0 bg-primary-600/60 rounded-2xl flex items-center justify-center text-white opacity-0 group-hover/img:opacity-100 transition-opacity"
                                                    >
                                                        <MdVisibility size={20} />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                        <input
                                            type="text"
                                            name="productImageUrl"
                                            value={formData.productImageUrl || ''}
                                            onChange={handleFormChange}
                                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium focus:ring-2 focus:ring-primary-500/10 outline-none"
                                            placeholder="Or paste external image URL..."
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div>
                            <h4 className="text-[10px] font-black text-primary-600 uppercase tracking-[0.2em] mb-6 flex items-center gap-3">
                                <span className="h-px flex-1 bg-primary-100"></span>
                                Product Grouping
                                <span className="h-px flex-1 bg-primary-100"></span>
                            </h4>
                            <div className="grid grid-cols-2 gap-6">
                                {[1, 2, 3, 4, 5].map(num => (
                                    <div key={`mgr${num}`} className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">MGR {num}</label>
                                        <select
                                            name={`mgr${num}`}
                                            value={formData[`mgr${num}`]?._id || formData[`mgr${num}`] || ''}
                                            onChange={handleFormChange}
                                            className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none text-sm font-bold appearance-none bg-white"
                                        >
                                            <option value="">Select MGR {num}</option>
                                            {mgrsData[`mgr${num}`].map(m => (
                                                <option key={m._id} value={m._id}>{m.code} - {m.description}</option>
                                            ))}
                                        </select>
                                    </div>
                                ))}
                            </div>

                            {/* Attributes Selection */}
                            {formData.mgr3 && availableAttributes.length > 0 && (
                                <div className="mt-8">
                                    <div className="flex items-center justify-between mb-4">
                                        <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Attributes for MGR3</h5>
                                        <button
                                            type="button"
                                            onClick={() => setIsAttrImportModalOpen(true)}
                                            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border border-indigo-100"
                                        >
                                            <MdFileUpload size={14} />
                                            Import Attributes
                                        </button>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {availableAttributes.map(attr => (
                                            <button
                                                key={attr._id}
                                                type="button"
                                                onClick={() => {
                                                    const current = formData.attributes || [];
                                                    const exists = current.includes(attr._id);
                                                    setFormData(prev => ({
                                                        ...prev,
                                                        attributes: exists
                                                            ? current.filter(id => id !== attr._id)
                                                            : [...current, attr._id]
                                                    }));
                                                }}
                                                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${(formData.attributes || []).includes(attr._id)
                                                        ? 'bg-primary-600 text-white border-primary-600 shadow-lg shadow-primary-600/20'
                                                        : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                                                    }`}
                                            >
                                                {attr.description} ({attr.code})
                                            </button>
                                        ))}
                                    </div>

                                    {/* Custom Imported Attributes */}
                                    {customAttributes.length > 0 && (
                                        <div className="mt-4 pt-4 border-t border-slate-100">
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">Imported Key-Value Attributes</p>
                                            <div className="flex flex-wrap gap-2">
                                                {customAttributes.map(attr => (
                                                    <div key={attr._id} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-600 rounded-xl text-[10px] font-bold border border-slate-200">
                                                        <span className="text-slate-400 uppercase tracking-tighter">{attr.attributeCode}:</span>
                                                        <span>{attr.attributeValue}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}


                        </div>
                    </div>

                    <div className="space-y-8">
                        <div>
                            <h4 className="text-[10px] font-black text-primary-600 uppercase tracking-[0.2em] mb-6 flex items-center gap-3">
                                <span className="h-px flex-1 bg-primary-100"></span>
                                Commercials
                                <span className="h-px flex-1 bg-primary-100"></span>
                            </h4>
                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">GST Slabs</label>
                                    <select
                                        name="gstPercentage"
                                        value={formData.gstPercentage}
                                        onChange={handleFormChange}
                                        className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none text-sm font-bold appearance-none bg-white"
                                    >
                                        <option value={0}>0% Slab (Zero)</option>
                                        <option value={5}>5% Slab (Low)</option>
                                        <option value={12}>12% Slab (Mid)</option>
                                        <option value={18}>18% Slab (Std)</option>
                                        <option value={28}>28% Slab (High)</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Measurement (UOM)</label>
                                    <select
                                        name="uom"
                                        value={formData.uom}
                                        onChange={handleFormChange}
                                        className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none text-sm font-bold appearance-none bg-white"
                                    >
                                        <option value="Nos">Numbers (Nos)</option>
                                        <option value="Set">Set</option>
                                        <option value="Box">Box</option>
                                        <option value="Rft">Running Feet (Rft)</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Excl. Tax (Base) <span className="text-rose-500">*</span></label>
                                    <div className="relative">
                                        <MdPayments className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                                        <input
                                            type="number"
                                            name="basePrice"
                                            value={formData.basePrice}
                                            onChange={handleFormChange}
                                            className="w-full pl-12 pr-4 py-3.5 bg-primary-50/50 border border-primary-100 rounded-2xl focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 outline-none text-sm font-black text-primary-700"
                                            placeholder="0"
                                            required
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Incl. Tax (MRP) <span className="text-rose-500">*</span></label>
                                    <input
                                        type="number"
                                        name="mrp"
                                        value={formData.mrp}
                                        onChange={handleFormChange}
                                        className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold"
                                        placeholder="0"
                                        required
                                    />
                                </div>
                            </div>
                        </div>

                        <div>
                            <h4 className="text-[10px] font-black text-primary-600 uppercase tracking-[0.2em] mb-6 flex items-center gap-3">
                                <span className="h-px flex-1 bg-primary-100"></span>
                                Vendor Mapping
                                <span className="h-px flex-1 bg-primary-100"></span>
                            </h4>
                            <div className="space-y-3">
                                {(formData.vendors || []).map((vendorRow, index) => (
                                    <div key={`vendor-row-${index}`} className="grid grid-cols-12 gap-3 items-end p-3 rounded-2xl border border-slate-200 bg-slate-50/60">
                                        <div className="col-span-12 md:col-span-5 space-y-1">
                                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Vendor</label>
                                            <select
                                                value={vendorRow.vendorId || ''}
                                                onChange={(e) => updateVendorRow(index, 'vendorId', e.target.value)}
                                                className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl outline-none text-xs font-bold"
                                            >
                                                <option value="">Select Vendor</option>
                                                {vendors
                                                    .filter(v => v.isActive || String(v._id) === String(vendorRow.vendorId))
                                                    .map(v => (
                                                        <option key={v._id} value={v._id}>{v.name}{!v.isActive ? ' (Inactive)' : ''}</option>
                                                    ))}
                                            </select>
                                        </div>
                                        <div className="col-span-6 md:col-span-2 space-y-1">
                                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Price</label>
                                            <input
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                value={vendorRow.price}
                                                onChange={(e) => updateVendorRow(index, 'price', e.target.value)}
                                                className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold"
                                                placeholder="0"
                                            />
                                        </div>
                                        <div className="col-span-6 md:col-span-2 space-y-1">
                                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Stock</label>
                                            <input
                                                type="number"
                                                min="0"
                                                value={vendorRow.stock}
                                                onChange={(e) => updateVendorRow(index, 'stock', e.target.value)}
                                                className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold"
                                                placeholder="0"
                                            />
                                        </div>
                                        <div className="col-span-6 md:col-span-2 flex flex-col gap-2">
                                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Primary</label>
                                            <button
                                                type="button"
                                                onClick={() => updateVendorRow(index, 'isPrimary', !vendorRow.isPrimary)}
                                                className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${vendorRow.isPrimary ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-100'}`}
                                            >
                                                {vendorRow.isPrimary ? 'Primary' : 'Set Primary'}
                                            </button>
                                        </div>
                                        <div className="col-span-6 md:col-span-1 flex justify-end">
                                            <button
                                                type="button"
                                                onClick={() => removeVendorRow(index)}
                                                className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl border border-rose-100"
                                                title="Remove Vendor Row"
                                            >
                                                <MdDelete size={16} />
                                            </button>
                                        </div>
                                    </div>
                                ))}

                                <div className="flex items-center justify-between">
                                    <button
                                        type="button"
                                        onClick={addVendorRow}
                                        className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary-50 text-primary-700 border border-primary-100 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-primary-100"
                                    >
                                        <MdAdd size={16} />
                                        Add Vendor
                                    </button>
                                    {(formData.vendors || []).filter(v => v.vendorId).length > 0 &&
                                        (formData.vendors || []).filter(v => v.vendorId).every(v => Number(v.stock) <= 0) && (
                                            <span className="text-[10px] font-black uppercase tracking-widest text-amber-600">
                                                All mapped vendors are out of stock
                                            </span>
                                        )}
                                </div>
                            </div>
                        </div>

                        <div>
                            <h4 className="text-[10px] font-black text-primary-600 uppercase tracking-[0.2em] mb-6 flex items-center gap-3">
                                <span className="h-px flex-1 bg-primary-100"></span>
                                Availability Status
                                <span className="h-px flex-1 bg-primary-100"></span>
                            </h4>
                            <div className="flex gap-6 p-1">
                                {['Active', 'Inactive'].map((st) => (
                                    <label key={st} className="flex-1 flex items-center justify-center gap-2 cursor-pointer group bg-slate-50 py-3.5 rounded-2xl border border-slate-200 transition-all has-[:checked]:bg-primary-50 has-[:checked]:border-primary-200">
                                        <input
                                            type="radio"
                                            name="status"
                                            value={st}
                                            checked={formData.status === st}
                                            onChange={handleFormChange}
                                            className="sr-only"
                                        />
                                        <span className={`text-[10px] font-black uppercase tracking-widest ${formData.status === st ? 'text-primary-600' : 'text-slate-400'}`}>{st}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    </div>
                </form>
            </Modal>

            {/* View Image Modal */}
            <Modal
                isOpen={!!viewImage}
                onClose={() => setViewImage(null)}
                title="Resource Preview"
                maxWidth="max-w-2xl"
            >
                <div className="flex items-center justify-center p-4">
                    <img src={resolveImageUrl(viewImage)} alt="Full view" className="max-w-full max-h-[70vh] rounded-2xl shadow-2xl border-4 border-white" />
                </div>
            </Modal>

            {/* Import Modal */}
            <ImportModal
                isOpen={isImportModalOpen}
                onClose={() => setIsImportModalOpen(false)}
                title="Import Products"
                type="products"
                onImport={async (file) => {
                    const result = await importService.importProducts(file);
                    fetchProducts(); // Refresh products after import
                    return result;
                }}
                onDownloadTemplate={importService.getProductTemplate}
            />

            {/* Import Attributes Modal */}
            <ImportModal
                isOpen={isAttrImportModalOpen}
                onClose={() => setIsAttrImportModalOpen(false)}
                title="Import Product Attributes"
                type="attributes"
                onImport={async (file) => {
                    const result = await importService.importAttributes(file);
                    if (editingProduct && editingProduct.productCode) {
                        fetchCustomAttributes(editingProduct.productCode);
                    }
                    fetchAllAttributes(); // Refresh the list view attributes too
                    if (formData.mgr3) {

                        fetchAvailableAttributes(formData.mgr3._id || formData.mgr3);
                    }
                    return result;
                }}

                onDownloadTemplate={importService.getAttributeTemplate}
            />

        </div >
    );
};

export default Products;
