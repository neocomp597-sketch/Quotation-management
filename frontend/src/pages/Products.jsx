import React, { useState, useEffect } from 'react';
import { MdAdd, MdSearch, MdEdit, MdDelete, MdInventory, MdCategory, MdQrCode, MdPayments, MdProductionQuantityLimits, MdCloudUpload, MdVisibility } from 'react-icons/md';
import { productService, uploadService } from '../services/api';
import Modal from '../components/Modal';
import { resolveImageUrl } from '../utils/helpers';

const Products = () => {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState(null);
    const [isUploading, setIsUploading] = useState(false);
    const [viewImage, setViewImage] = useState(null);
    const [viewMode, setViewMode] = useState('list'); // 'list' or 'grid'

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
        status: 'Active'
    });

    useEffect(() => {
        fetchProducts();
    }, []);

    const fetchProducts = async () => {
        try {
            const res = await productService.getAll();
            setProducts(res.data);
        } catch (err) {
            console.error("Error fetching products:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (product = null) => {
        if (product) {
            setEditingProduct(product);
            setFormData({ ...product });
        } else {
            setEditingProduct(null);
            setFormData({
                productName: '',
                productCode: '',
                categoryId: '',
                hsnCode: '',
                gstPercentage: 18,
                basePrice: 0,
                mrp: 0,
                uom: 'Nos',
                productImageUrl: '',
                status: 'Active'
            });
        }
        setIsModalOpen(true);
    };

    const handleFormChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setIsUploading(true);
        try {
            const res = await uploadService.uploadImage(file);
            setFormData(prev => ({ ...prev, productImageUrl: res.data.imageUrl }));
        } catch (err) {
            console.error("Upload error:", err);
            alert("Failed to upload image");
        } finally {
            setIsUploading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingProduct) {
                await productService.update(editingProduct._id, formData);
            } else {
                await productService.create(formData);
            }
            fetchProducts();
            setIsModalOpen(false);
        } catch (err) {
            console.error("Error saving product:", err);
            alert("Error saving product data");
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm("Are you sure you want to delete this product?")) {
            try {
                await productService.delete(id);
                fetchProducts();
            } catch (err) {
                console.error("Error deleting product:", err);
            }
        }
    };

    const filteredProducts = products.filter(p =>
        p.productName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.productCode?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.hsnCode?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">Product Catalog</h1>
                    <p className="text-slate-500 font-medium">Central database for sanitaryware & CP fittings.</p>
                </div>
                <button
                    onClick={() => handleOpenModal()}
                    className="flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-2xl font-bold transition-all shadow-xl shadow-primary-600/20 uppercase text-xs tracking-widest active:scale-95"
                >
                    <MdAdd size={20} />
                    <span>Add New Product</span>
                </button>
            </div>

            <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
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
                    <div className="flex gap-2">
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

                <div className="overflow-x-auto">
                    {loading ? (
                        <div className="p-20 text-center text-slate-400 font-medium">
                            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-primary-500 border-t-transparent mb-4"></div>
                            <p className="text-xs uppercase font-black tracking-widest">Loading Catalog...</p>
                        </div>
                    ) : viewMode === 'list' ? (
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 text-slate-400 text-[10px] uppercase font-black tracking-widest border-b border-slate-100">
                                <tr>
                                    <th className="px-8 py-5">Product Info</th>
                                    <th className="px-8 py-5">Code & HSN</th>
                                    <th className="px-8 py-5 text-right">Pricing (Base / MRP)</th>
                                    <th className="px-8 py-5 text-center">Status</th>
                                    <th className="px-8 py-5 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredProducts.map((p) => (
                                    <tr key={p._id} className="hover:bg-slate-50 transition-colors group">
                                        <td className="px-8 py-5">
                                            <div className="flex items-center gap-4">
                                                <div
                                                    className="h-12 w-12 rounded-xl bg-white border border-slate-100 overflow-hidden p-1.5 flex-shrink-0 cursor-pointer hover:border-primary-500 transition-all"
                                                    onClick={() => p.productImageUrl && setViewImage(p.productImageUrl)}
                                                >
                                                    {p.productImageUrl ? (
                                                        <img
                                                            src={resolveImageUrl(p.productImageUrl)}
                                                            alt=""
                                                            className="h-full w-full object-contain"
                                                            onError={(e) => {
                                                                e.target.onerror = null;
                                                                e.target.style.display = 'none';
                                                                e.target.nextSibling.style.display = 'flex';
                                                            }}
                                                        />
                                                    ) : null}
                                                    <div
                                                        className="h-full w-full flex items-center justify-center bg-slate-50 text-slate-300"
                                                        style={{ display: p.productImageUrl ? 'none' : 'flex' }}
                                                    >
                                                        <MdInventory size={20} />
                                                    </div>
                                                </div>
                                                <div>
                                                    <div className="font-bold text-slate-900">{p.productName}</div>
                                                    <div className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{p.uom}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-8 py-5">
                                            <div className="text-sm font-mono font-bold text-primary-700 tracking-tight">{p.productCode}</div>
                                            <div className="text-[10px] text-slate-400 uppercase font-bold mt-1">HSN: {p.hsnCode}</div>
                                        </td>
                                        <td className="px-8 py-5 text-right">
                                            <div className="text-sm font-black text-slate-900">₹{p.basePrice?.toLocaleString()}</div>
                                            <div className="text-[10px] text-slate-400 line-through">MRP: ₹{p.mrp?.toLocaleString()}</div>
                                        </td>
                                        <td className="px-8 py-5 text-center">
                                            <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-[0.1em] ${p.status === 'Active' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-slate-100 text-slate-400 border border-slate-200'
                                                }`}>
                                                {p.status}
                                            </span>
                                        </td>
                                        <td className="px-8 py-5 text-right">
                                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
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
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 p-6">
                            {filteredProducts.map((p) => (
                                <div key={p._id} className="bg-white rounded-2xl border border-slate-100 hover:shadow-xl transition-all hover:border-primary-100 group flex flex-col overflow-hidden">
                                    <div className="aspect-square bg-slate-50 relative overflow-hidden group-hover:bg-slate-100 transition-colors">
                                        {p.productImageUrl ? (
                                            <img
                                                src={resolveImageUrl(p.productImageUrl)}
                                                alt={p.productName}
                                                className="w-full h-full object-contain p-4 mix-blend-multiply"
                                                onError={(e) => {
                                                    e.target.onerror = null;
                                                    e.target.style.display = 'none';
                                                    e.target.nextSibling.style.display = 'flex';
                                                }}
                                            />
                                        ) : null}
                                        <div
                                            className="absolute inset-0 flex items-center justify-center text-slate-300"
                                            style={{ display: p.productImageUrl ? 'none' : 'flex' }}
                                        >
                                            <MdInventory size={48} />
                                        </div>
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
                            className="bg-primary-600 hover:bg-primary-700 text-white px-10 py-3.5 rounded-2xl font-black transition-all shadow-xl shadow-primary-600/20 uppercase text-[10px] tracking-widest active:scale-95"
                        >
                            {editingProduct ? "Update Product" : "Enlist Product"}
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
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Comprehensive Product Name</label>
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
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Serial/Product Code</label>
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
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">HSN Code (8-Digit)</label>
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
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Excl. Tax (Base)</label>
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
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Incl. Tax (MRP)</label>
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
        </div >
    );
};

export default Products;
