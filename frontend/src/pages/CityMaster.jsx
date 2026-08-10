import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { cityMasterService, stateMasterService } from '../services/api';
import { toast } from 'react-toastify';
import { MdAdd, MdSearch, MdEdit, MdDelete, MdArrowBack, MdPublic, MdLocationCity } from 'react-icons/md';
import { DEFAULT_COUNTRIES, DEFAULT_STATES, getCitiesForState, getStatesForCountry } from '../constants/locationData';

const CityMaster = ({ isCreatePage, isEditPage }) => {
    const navigate = useNavigate();
    const { id: routeId } = useParams();

    const [cities, setCities] = useState([]);
    const [states, setStates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    const [showModal, setShowModal] = useState(false);
    const [editingCity, setEditingCity] = useState(null);

    const [formData, setFormData] = useState({
        country: 'India',
        state: '',
        district: '',
        area: '',
        city: '',
        pincode: '',
        status: 'Active'
    });

    const [isCustomDistrict, setIsCustomDistrict] = useState(false);

    useEffect(() => {
        fetchInitialData();
    }, []);

    const fetchInitialData = async () => {
        try {
            setLoading(true);
            const [cityRes, stateRes] = await Promise.allSettled([
                cityMasterService.getAll(),
                stateMasterService.getAll()
            ]);
            
            const cityList = cityRes.status === 'fulfilled' ? (cityRes.value.data?.data || cityRes.value.data || []) : [];
            const stateList = stateRes.status === 'fulfilled' ? (stateRes.value.data?.data || stateRes.value.data || []) : [];

            setCities(cityList);
            setStates(stateList);
        } catch (error) {
            console.error('Failed to load City Master data:', error);
            toast.error('Failed to load City Master data');
        } finally {
            setLoading(false);
        }
    };

    const populateForm = (item) => {
        if (!item) {
            setEditingCity(null);
            setFormData({
                country: 'India',
                state: '',
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

    // Dependent list of states for selected country
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
            district: '',
            city: ''
        }));
    };

    const handleStateChange = (e) => {
        const val = e.target.value;
        setIsCustomDistrict(false);
        setFormData(prev => ({
            ...prev,
            state: val,
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

        // Duplicate check under same district
        const normDistrict = formData.district.trim().replace(/\s+/g, ' ').toLowerCase();
        const normCity = formData.city.trim().replace(/\s+/g, ' ').toLowerCase();

        const duplicate = cities.find(c => 
            (!editingCity || c._id !== editingCity._id) &&
            c.district.trim().replace(/\s+/g, ' ').toLowerCase() === normDistrict &&
            c.city.trim().replace(/\s+/g, ' ').toLowerCase() === normCity
        );

        if (duplicate) {
            toast.error(`City '${formData.city.trim()}' already exists under District '${formData.district.trim()}'. Duplicates are prohibited under the same district.`);
            return;
        }

        const payload = {
            country: formData.country.trim(),
            state: formData.state.trim(),
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
            fetchInitialData();
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
            fetchInitialData();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Deletion failed');
        }
    };

    const filteredCities = cities.filter(c =>
        (c.country || '').toLowerCase().includes(search.toLowerCase()) ||
        (c.state || '').toLowerCase().includes(search.toLowerCase()) ||
        (c.district || '').toLowerCase().includes(search.toLowerCase()) ||
        (c.area || '').toLowerCase().includes(search.toLowerCase()) ||
        (c.city || '').toLowerCase().includes(search.toLowerCase()) ||
        (c.pincode || '').toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto">
            {!(showModal || isCreatePage || isEditPage) ? (
                <>
                    {/* Header */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <h1 className="text-3xl font-black text-slate-900 tracking-tight font-outfit uppercase">
                                City Master
                            </h1>
                            <p className="text-slate-500 font-semibold text-sm">
                                Maintain Cities mapped with Country, State, District, Area & Pincode.
                            </p>
                        </div>
                        <button
                            onClick={() => navigate('/city-master/new')}
                            className="flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-6 py-3.5 rounded-2xl font-black transition-all shadow-xl shadow-primary-600/20 uppercase text-xs tracking-widest active:scale-95 self-start md:self-auto"
                        >
                            <MdAdd size={18} />
                            <span>Create City</span>
                        </button>
                    </div>

                    {/* Search and Table */}
                    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden p-6 space-y-6">
                        <div className="relative max-w-md">
                            <MdSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                            <input
                                type="text"
                                placeholder="Search by country, state, district, area, city or pincode..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                            />
                        </div>

                        {loading ? (
                            <div className="p-20 text-center text-slate-400 font-medium">
                                <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-primary-500 border-t-transparent mb-4"></div>
                                <p className="text-xs uppercase font-black tracking-widest">Loading Cities...</p>
                            </div>
                        ) : filteredCities.length === 0 ? (
                            <div className="p-16 text-center text-slate-400">
                                <p className="font-bold text-sm">No City entries found.</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="border-b border-slate-100 bg-slate-50/50 text-[10px] font-black uppercase text-slate-400 tracking-widest">
                                            <th className="py-4 px-6">Country</th>
                                            <th className="py-4 px-6">State</th>
                                            <th className="py-4 px-6">District</th>
                                            <th className="py-4 px-6">Area</th>
                                            <th className="py-4 px-6">City</th>
                                            <th className="py-4 px-6">Pincode</th>
                                            <th className="py-4 px-6">Status</th>
                                            <th className="py-4 px-6 text-center">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 text-sm font-semibold">
                                        {filteredCities.map((item) => (
                                            <tr key={item._id} className="hover:bg-slate-50/60 transition-all">
                                                <td className="py-4 px-6 font-bold text-slate-700">
                                                    <span className="inline-flex items-center gap-1.5 bg-slate-100 px-3 py-1 rounded-xl text-xs font-bold text-slate-800">
                                                        <MdPublic className="text-primary-600" size={14} />
                                                        {item.country || 'India'}
                                                    </span>
                                                </td>
                                                <td className="py-4 px-6 font-bold text-slate-900">{item.state}</td>
                                                <td className="py-4 px-6 text-slate-700">{item.district}</td>
                                                <td className="py-4 px-6 text-slate-600">{item.area || '-'}</td>
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
                        )}
                    </div>
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
