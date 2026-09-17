import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { cityMasterService, stateMasterService } from '../services/api';
import { toast } from 'react-toastify';
import { 
    MdAdd, 
    MdSearch, 
    MdEdit, 
    MdDelete, 
    MdArrowBack, 
    MdPublic, 
    MdLocationCity, 
    MdFileUpload, 
    MdCloudUpload, 
    MdChevronLeft, 
    MdChevronRight,
    MdClose,
    MdCheckCircle
} from 'react-icons/md';
import { DEFAULT_COUNTRIES, DEFAULT_STATES, getCitiesForState, getStatesForCountry } from '../constants/locationData';

const CityMaster = ({ isCreatePage, isEditPage }) => {
    const navigate = useNavigate();
    const { id: routeId } = useParams();

    const [cities, setCities] = useState([]);
    const [states, setStates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    
    // Pagination state
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(50);
    const [total, setTotal] = useState(0);
    const [totalPages, setTotalPages] = useState(1);

    // Modal & Form state
    const [showModal, setShowModal] = useState(false);
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [selectedFile, setSelectedFile] = useState(null);

    const [editingCity, setEditingCity] = useState(null);
    const [formData, setFormData] = useState({
        country: 'India',
        state: '',
        stateCode: '',
        district: '',
        area: '',
        city: '',
        pincode: '',
        status: 'Active'
    });

    const [isCustomDistrict, setIsCustomDistrict] = useState(false);

    // Debounce search input
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(search);
            setPage(1);
        }, 300);
        return () => clearTimeout(timer);
    }, [search]);

    const fetchCities = useCallback(async () => {
        try {
            setLoading(true);
            const params = {
                page,
                limit,
                ...(debouncedSearch && { search: debouncedSearch })
            };
            const res = await cityMasterService.getAll(params);
            const data = res.data;
            if (data.success) {
                setCities(data.data || []);
                setTotal(data.total || data.count || 0);
                setTotalPages(data.totalPages || 1);
            }
        } catch (error) {
            console.error('Failed to load City Master list:', error);
            toast.error('Failed to load City Master data');
        } finally {
            setLoading(false);
        }
    }, [page, limit, debouncedSearch]);

    const fetchStates = useCallback(async () => {
        try {
            const stateRes = await stateMasterService.getAll();
            const stateList = stateRes.data?.data || stateRes.data || [];
            setStates(stateList);
        } catch (error) {
            console.error('Failed to load State Master list:', error);
        }
    }, []);

    useEffect(() => {
        fetchStates();
    }, [fetchStates]);

    useEffect(() => {
        fetchCities();
    }, [fetchCities]);

    const populateForm = (item) => {
        if (!item) {
            setEditingCity(null);
            setFormData({
                country: 'India',
                state: '',
                stateCode: '',
                district: '',
                area: '',
                city: '',
                pincode: '',
                status: 'Active'
            });
            return;
        }

        setEditingCity(item);
        setFormData({
            country: item.country || 'India',
            state: item.state || '',
            stateCode: item.stateCode || '',
            district: item.district || '',
            area: item.area || '',
            city: item.city || '',
            pincode: item.pincode || '',
            status: item.status || 'Active'
        });
    };

    useEffect(() => {
        if (isCreatePage) {
            populateForm(null);
            setShowModal(true);
        } else if (isEditPage && routeId) {
            setShowModal(true);
            const found = cities.find(c => c._id === routeId);
            if (found) {
                populateForm(found);
            } else {
                cityMasterService.getById(routeId).then(res => {
                    if (res.data?.data) populateForm(res.data.data);
                }).catch(err => console.error(err));
            }
        }
    }, [isCreatePage, isEditPage, routeId, cities]);

    const availableStates = useMemo(() => {
        return getStatesForCountry(formData.country, states);
    }, [formData.country, states]);

    const availableDistricts = useMemo(() => {
        if (!formData.state) return [];
        return getCitiesForState(formData.state);
    }, [formData.state]);

    const handleCountryChange = (e) => {
        const val = e.target.value;
        setIsCustomDistrict(false);
        setFormData(prev => ({
            ...prev,
            country: val,
            state: '',
            stateCode: '',
            district: '',
            city: ''
        }));
    };

    const handleStateChange = (e) => {
        const selectedStateName = e.target.value;
        setIsCustomDistrict(false);

        // Find short code from State Master
        let code = '';
        const matchedDbState = states.find(s => (s.state || '').toLowerCase() === selectedStateName.toLowerCase());
        if (matchedDbState && matchedDbState.shortCode) {
            code = matchedDbState.shortCode;
        } else if (selectedStateName.toLowerCase() === 'maharashtra') {
            code = 'MH';
        } else {
            code = selectedStateName.substring(0, 2).toUpperCase();
        }

        setFormData(prev => ({
            ...prev,
            state: selectedStateName,
            stateCode: code,
            district: '',
            city: ''
        }));
    };

    const handleDistrictChange = (e) => {
        const val = e.target.value;
        if (val === '__custom__') {
            setIsCustomDistrict(true);
            setFormData(prev => ({ ...prev, district: '' }));
        } else {
            setIsCustomDistrict(false);
            setFormData(prev => ({
                ...prev,
                district: val,
                city: prev.city ? prev.city : val
            }));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.country.trim() || !formData.state.trim() || !formData.district.trim() || !formData.city.trim() || !formData.pincode.trim()) {
            toast.error('Country, State, District, City name, and Pincode are required');
            return;
        }

        const cleanPincode = formData.pincode.trim().replace(/\D/g, '');
        if (cleanPincode.length !== 6) {
            toast.error('Pincode must be exactly 6 numeric digits');
            return;
        }

        const normDistrict = formData.district.trim().replace(/\s+/g, ' ').toLowerCase();
        const normCity = formData.city.trim().replace(/\s+/g, ' ').toLowerCase();

        const duplicate = cities.find(c => 
            (!editingCity || c._id !== editingCity._id) &&
            (c.district || '').trim().replace(/\s+/g, ' ').toLowerCase() === normDistrict &&
            (c.city || '').trim().replace(/\s+/g, ' ').toLowerCase() === normCity
        );

        if (duplicate) {
            toast.error(`City '${formData.city.trim()}' already exists under District '${formData.district.trim()}'. Duplicates are prohibited under the same district.`);
            return;
        }

        const payload = {
            country: formData.country.trim(),
            state: formData.state.trim(),
            stateCode: formData.stateCode.trim().toUpperCase() || (formData.state.toLowerCase() === 'maharashtra' ? 'MH' : formData.state.substring(0, 2).toUpperCase()),
            district: formData.district.trim(),
            area: formData.area.trim(),
            city: formData.city.trim(),
            pincode: cleanPincode,
            status: formData.status
        };

        try {
            if (editingCity) {
                await cityMasterService.update(editingCity._id, payload);
                toast.success('City entry updated successfully');
            } else {
                await cityMasterService.create(payload);
                toast.success('City entry created successfully');
            }
            setShowModal(false);
            fetchCities();
            navigate('/city-master');
        } catch (error) {
            toast.error(error.response?.data?.message || 'Save failed');
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this City entry?')) return;
        try {
            await cityMasterService.delete(id);
            toast.success('City entry deleted successfully');
            fetchCities();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Deletion failed');
        }
    };

    // Excel Upload Handler
    const handleFileUpload = async (e) => {
        e.preventDefault();
        if (!selectedFile) {
            toast.error('Please select an Excel file (.xlsx, .xls) to upload');
            return;
        }

        try {
            setUploading(true);
            const res = await cityMasterService.upload(selectedFile);
            if (res.data?.success) {
                toast.success(res.data.message || 'City Master Excel imported successfully!');
                setShowUploadModal(false);
                setSelectedFile(null);
                fetchCities();
            }
        } catch (error) {
            console.error('Excel Upload error:', error);
            toast.error(error.response?.data?.message || 'Failed to upload City Master Excel');
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto">
            {!(showModal || isCreatePage || isEditPage) ? (
                <>
                    {/* Header */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <h1 className="text-3xl font-black text-slate-900 tracking-tight font-outfit uppercase flex items-center gap-3">
                                <span>City Master</span>
                                <span className="bg-primary-100 text-primary-800 text-xs px-3 py-1 rounded-xl font-bold tracking-normal normal-case">
                                    {total.toLocaleString()} Total Records
                                </span>
                            </h1>
                            <p className="text-slate-500 font-semibold text-sm">
                                Maintain Cities mapped with State (Short Code e.g. MH), District, Area & Pincode.
                            </p>
                        </div>
                        <div className="flex items-center gap-3 flex-wrap">
                            <button
                                onClick={() => setShowUploadModal(true)}
                                className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-3 rounded-2xl font-black transition-all shadow-lg shadow-emerald-600/20 uppercase text-xs tracking-widest active:scale-95"
                            >
                                <MdFileUpload size={18} />
                                <span>Upload Excel</span>
                            </button>
                            <button
                                onClick={() => navigate('/city-master/new')}
                                className="flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-2xl font-black transition-all shadow-xl shadow-primary-600/20 uppercase text-xs tracking-widest active:scale-95"
                            >
                                <MdAdd size={18} />
                                <span>Create City</span>
                            </button>
                        </div>
                    </div>

                    {/* Search and Table */}
                    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden p-6 space-y-6">
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                            <div className="relative w-full sm:w-96">
                                <MdSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                                <input
                                    type="text"
                                    placeholder="Search by state, shortcode (e.g. MH), district, city or pincode..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                                />
                            </div>

                            <div className="flex items-center gap-2 text-xs font-bold text-slate-600 self-end sm:self-auto">
                                <span>Items per page:</span>
                                <select
                                    value={limit}
                                    onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}
                                    className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 font-bold outline-none cursor-pointer"
                                >
                                    <option value={25}>25</option>
                                    <option value={50}>50</option>
                                    <option value={100}>100</option>
                                    <option value={250}>250</option>
                                </select>
                            </div>
                        </div>

                        {loading ? (
                            <div className="p-20 text-center text-slate-400 font-medium">
                                <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-primary-500 border-t-transparent mb-4"></div>
                                <p className="text-xs uppercase font-black tracking-widest">Loading Cities...</p>
                            </div>
                        ) : cities.length === 0 ? (
                            <div className="p-16 text-center text-slate-400 space-y-3">
                                <p className="font-bold text-sm">No City entries found.</p>
                                <button
                                    onClick={() => setShowUploadModal(true)}
                                    className="text-xs text-primary-600 font-bold hover:underline"
                                >
                                    Click here to upload City Master.xlsx
                                </button>
                            </div>
                        ) : (
                            <>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="border-b border-slate-100 bg-slate-50/50 text-[10px] font-black uppercase text-slate-400 tracking-widest">
                                                <th className="py-4 px-6">Country</th>
                                                <th className="py-4 px-6">State Code</th>
                                                <th className="py-4 px-6">State</th>
                                                <th className="py-4 px-6">District</th>
                                                <th className="py-4 px-6">City / Office</th>
                                                <th className="py-4 px-6">Pincode</th>
                                                <th className="py-4 px-6">Status</th>
                                                <th className="py-4 px-6 text-center">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 text-sm font-semibold">
                                            {cities.map((item) => (
                                                <tr key={item._id} className="hover:bg-slate-50/60 transition-all">
                                                    <td className="py-4 px-6 font-bold text-slate-700">
                                                        <span className="inline-flex items-center gap-1.5 bg-slate-100 px-3 py-1 rounded-xl text-xs font-bold text-slate-800">
                                                            <MdPublic className="text-primary-600" size={14} />
                                                            {item.country || 'India'}
                                                        </span>
                                                    </td>
                                                    <td className="py-4 px-6 font-bold">
                                                        <span className="inline-block px-2.5 py-1 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 font-mono font-black text-xs uppercase tracking-wider">
                                                            {item.stateCode || (item.state === 'Maharashtra' ? 'MH' : (item.state || 'IN').substring(0, 2).toUpperCase())}
                                                        </span>
                                                    </td>
                                                    <td className="py-4 px-6 font-bold text-slate-900">{item.state}</td>
                                                    <td className="py-4 px-6 text-slate-700">{item.district}</td>
                                                    <td className="py-4 px-6 font-bold text-teal-700">
                                                        <span className="inline-flex items-center gap-1.5">
                                                            <MdLocationCity size={16} />
                                                            {item.city}
                                                        </span>
                                                    </td>
                                                    <td className="py-4 px-6 font-mono text-xs font-bold text-slate-800">
                                                        {item.pincode}
                                                    </td>
                                                    <td className="py-4 px-6">
                                                        <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg ${
                                                            item.status === 'Active' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                                                        }`}>
                                                            {item.status || 'Active'}
                                                        </span>
                                                    </td>
                                                    <td className="py-4 px-6 text-center">
                                                        <div className="flex items-center justify-center gap-2">
                                                            <button
                                                                onClick={() => navigate(`/city-master/edit/${item._id}`)}
                                                                className="p-2 text-slate-400 hover:text-primary-600 hover:bg-slate-100 rounded-xl transition-all"
                                                                title="Edit City"
                                                            >
                                                                <MdEdit size={18} />
                                                            </button>
                                                            <button
                                                                onClick={() => handleDelete(item._id)}
                                                                className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                                                                title="Delete City"
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

                                {/* Pagination Controls */}
                                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-100">
                                    <p className="text-xs text-slate-500 font-medium">
                                        Showing <span className="font-bold text-slate-900">{((page - 1) * limit) + 1}</span> to{' '}
                                        <span className="font-bold text-slate-900">{Math.min(page * limit, total)}</span> of{' '}
                                        <span className="font-bold text-slate-900">{total.toLocaleString()}</span> entries
                                    </p>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => setPage(p => Math.max(1, p - 1))}
                                            disabled={page === 1}
                                            className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                                            title="Previous Page"
                                        >
                                            <MdChevronLeft size={20} />
                                        </button>
                                        <span className="text-xs font-bold text-slate-700 px-3 py-1 bg-slate-100 rounded-xl">
                                            Page {page} of {totalPages}
                                        </span>
                                        <button
                                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                            disabled={page >= totalPages}
                                            className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                                            title="Next Page"
                                        >
                                            <MdChevronRight size={20} />
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Upload Modal */}
                    {showUploadModal && (
                        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
                            <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-6 relative">
                                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-2xl">
                                            <MdCloudUpload size={24} />
                                        </div>
                                        <div>
                                            <h3 className="font-black text-slate-900 text-lg">Upload City Master Excel</h3>
                                            <p className="text-slate-400 text-xs font-medium">Bulk import state, city, and pincode mapping</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setShowUploadModal(false)}
                                        className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100"
                                    >
                                        <MdClose size={20} />
                                    </button>
                                </div>

                                <form onSubmit={handleFileUpload} className="space-y-6">
                                    <div className="border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center bg-slate-50/50 hover:border-emerald-500 transition-all cursor-pointer relative">
                                        <input
                                            type="file"
                                            accept=".xlsx, .xls, .csv"
                                            onChange={(e) => setSelectedFile(e.target.files[0])}
                                            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                                        />
                                        <div className="space-y-2">
                                            <MdFileUpload className="mx-auto text-slate-400" size={40} />
                                            {selectedFile ? (
                                                <div className="flex items-center justify-center gap-2 text-emerald-600 font-bold text-sm">
                                                    <MdCheckCircle size={18} />
                                                    <span>{selectedFile.name}</span>
                                                </div>
                                            ) : (
                                                <>
                                                    <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                                                        Drop your City Master.xlsx file here
                                                    </p>
                                                    <p className="text-[11px] text-slate-400">
                                                        Supports Excel spreadsheets (.xlsx, .xls, .csv)
                                                    </p>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-2xl text-xs space-y-1">
                                        <p className="font-bold text-indigo-900 uppercase tracking-wide text-[10px]">
                                            State Short Code Mapping Info:
                                        </p>
                                        <p className="text-indigo-700">
                                            States like <span className="font-bold">MAHARASHTRA</span> will automatically map to 2-digit code <span className="font-bold">MH</span> during import.
                                        </p>
                                    </div>

                                    <div className="flex justify-end gap-3 pt-2">
                                        <button
                                            type="button"
                                            onClick={() => setShowUploadModal(false)}
                                            className="px-5 py-2.5 rounded-2xl border border-slate-200 text-slate-600 font-bold text-xs uppercase tracking-wider hover:bg-slate-50 transition-all"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={uploading || !selectedFile}
                                            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-6 py-2.5 rounded-2xl font-black transition-all shadow-lg shadow-emerald-600/20 uppercase text-xs tracking-wider active:scale-95"
                                        >
                                            {uploading ? 'Processing & Importing...' : 'Import Excel'}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    )}
                </>
            ) : (
                <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in duration-200">
                    {/* Header bar */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                        <div className="flex items-center gap-4">
                            <button
                                type="button"
                                onClick={() => { setShowModal(false); navigate('/city-master'); }}
                                className="p-3 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-2xl transition-all border border-slate-200"
                            >
                                <MdArrowBack size={20} />
                            </button>
                            <div>
                                <h1 className="text-xl font-black text-slate-900">
                                    {editingCity ? 'Edit City Entry' : 'Create City Entry'}
                                </h1>
                                <p className="text-xs text-slate-500 font-medium mt-0.5">
                                    {editingCity ? `Update city entry for ${editingCity.city}` : 'Map new City with Country, State, District, Area & Pincode'}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                onClick={() => { setShowModal(false); navigate('/city-master'); }}
                                className="px-6 py-3 rounded-2xl border border-slate-200 text-slate-600 font-black uppercase text-xs tracking-widest hover:bg-slate-50 transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                form="city-master-form"
                                className="bg-primary-600 hover:bg-primary-700 text-white px-8 py-3 rounded-2xl font-black transition-all shadow-xl shadow-primary-600/20 uppercase text-xs tracking-widest active:scale-95"
                            >
                                {editingCity ? 'Save Changes' : 'Create City'}
                            </button>
                        </div>
                    </div>

                    {/* Form Card Body */}
                    <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
                        <form id="city-master-form" onSubmit={handleSubmit} className="space-y-6">
                            {/* Row 1: Country & State */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Country *</label>
                                    <select
                                        value={formData.country}
                                        onChange={handleCountryChange}
                                        className="w-full px-4 py-3.5 rounded-2xl border border-slate-200 bg-slate-50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm font-semibold cursor-pointer"
                                    >
                                        {DEFAULT_COUNTRIES.map(c => (
                                            <option key={c.country} value={c.country}>{c.country}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">State *</label>
                                    <select
                                        value={formData.state}
                                        onChange={handleStateChange}
                                        required
                                        className="w-full px-4 py-3.5 rounded-2xl border border-slate-200 bg-slate-50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm font-semibold cursor-pointer"
                                    >
                                        <option value="">-- Select State --</option>
                                        {availableStates.map(st => (
                                            <option key={st.state} value={st.state}>{st.state}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* State Short Code Preview */}
                            {formData.state && (
                                <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-2xl flex items-center justify-between">
                                    <span className="text-xs font-bold text-indigo-900 uppercase tracking-wider">
                                        State Short Code (2 DIGIT Mapping):
                                    </span>
                                    <span className="px-3 py-1 bg-indigo-600 text-white rounded-xl font-mono font-black text-sm uppercase tracking-widest">
                                        {formData.stateCode || (formData.state.toLowerCase() === 'maharashtra' ? 'MH' : formData.state.substring(0, 2).toUpperCase())}
                                    </span>
                                </div>
                            )}

                            {/* Row 2: District & Area */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">District *</label>
                                    {!formData.state ? (
                                        <select
                                            disabled
                                            className="w-full px-4 py-3.5 rounded-2xl border border-slate-200 bg-slate-100 text-slate-400 text-sm font-semibold cursor-not-allowed"
                                        >
                                            <option>-- Select State First --</option>
                                        </select>
                                    ) : !isCustomDistrict && (availableDistricts.length > 0 || (formData.district && availableDistricts.includes(formData.district))) ? (
                                        <div className="space-y-1.5">
                                            <select
                                                value={formData.district}
                                                onChange={handleDistrictChange}
                                                required
                                                className="w-full px-4 py-3.5 rounded-2xl border border-slate-200 bg-slate-50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm font-semibold cursor-pointer"
                                            >
                                                <option value="">-- Select District ({availableDistricts.length} available) --</option>
                                                {formData.district && !availableDistricts.includes(formData.district) && (
                                                    <option value={formData.district}>{formData.district}</option>
                                                )}
                                                {availableDistricts.map(dist => (
                                                    <option key={dist} value={dist}>{dist}</option>
                                                ))}
                                                <option value="__custom__">+ Enter Custom District...</option>
                                            </select>
                                        </div>
                                    ) : (
                                        <div className="space-y-1.5">
                                            <input
                                                type="text"
                                                required
                                                placeholder="Enter District Name"
                                                value={formData.district}
                                                onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                                                className="w-full px-4 py-3.5 rounded-2xl border border-slate-200 bg-slate-50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm font-semibold"
                                            />
                                            {availableDistricts.length > 0 && (
                                                <button
                                                    type="button"
                                                    onClick={() => setIsCustomDistrict(false)}
                                                    className="text-xs text-primary-600 font-bold hover:underline"
                                                >
                                                    ← Select from list of districts
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Area</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. Kothrud, Bandra, Viman Nagar"
                                        value={formData.area}
                                        onChange={(e) => setFormData({ ...formData, area: e.target.value })}
                                        className="w-full px-4 py-3.5 rounded-2xl border border-slate-200 bg-slate-50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm font-semibold"
                                    />
                                </div>
                            </div>

                            {/* Row 3: City & Pincode */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">City Name *</label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="e.g. Pune, Mumbai, Surat"
                                        value={formData.city}
                                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                                        className="w-full px-4 py-3.5 rounded-2xl border border-slate-200 bg-slate-50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm font-semibold"
                                    />
                                </div>

                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Pincode (6-digit numeric) *</label>
                                    <input
                                        type="text"
                                        required
                                        maxLength={6}
                                        placeholder="e.g. 411038"
                                        value={formData.pincode}
                                        onChange={(e) => setFormData({ ...formData, pincode: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                                        className="w-full px-4 py-3.5 rounded-2xl border border-slate-200 bg-slate-50 text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm font-bold"
                                    />
                                </div>
                            </div>

                            {/* Row 4: Status */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Status</label>
                                    <select
                                        value={formData.status}
                                        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                        className="w-full px-4 py-3.5 rounded-2xl border border-slate-200 bg-slate-50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm font-semibold cursor-pointer"
                                    >
                                        <option value="Active">Active</option>
                                        <option value="Inactive">Inactive</option>
                                    </select>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CityMaster;
