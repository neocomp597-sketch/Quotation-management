import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { stateMasterService } from '../services/api';
import { toast } from 'react-toastify';
import { MdAdd, MdSearch, MdEdit, MdDelete, MdArrowBack, MdPublic, MdLocationCity, MdPhoneInTalk } from 'react-icons/md';
import { DEFAULT_COUNTRIES, DEFAULT_STATES, getCitiesForState, getDialCodeForCountry } from '../constants/locationData';
import { formatGstPrefix } from '../utils/helpers';

const StateMaster = ({ isCreatePage, isEditPage }) => {
    const navigate = useNavigate();
    const { id: routeId } = useParams();

    const [states, setStates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    const [showModal, setShowModal] = useState(false);
    const [editingState, setEditingState] = useState(null);

    const [countryList, setCountryList] = useState(DEFAULT_COUNTRIES.map(c => c.country));
    const [isCustomCountry, setIsCustomCountry] = useState(false);
    const [isCustomState, setIsCustomState] = useState(false);
    const [isCustomCity, setIsCustomCity] = useState(false);

    const [formData, setFormData] = useState({
        country: 'India',
        customCountry: '',
        dialCode: '+91',
        state: '',
        shortCode: '',
        gstCode: '',
        city: '',
        status: 'Active'
    });

    useEffect(() => {
        fetchStates();
    }, []);

    const fetchStates = async () => {
        try {
            setLoading(true);
            const res = await stateMasterService.getAll();
            const list = Array.isArray(res.data) ? res.data : (res.data?.data || []);
            setStates(list);

            // Extract unique countries from backend state entries
            const existingCountries = list.map(s => s.country).filter(Boolean);
            const mergedCountries = Array.from(new Set([...DEFAULT_COUNTRIES.map(c => c.country), ...existingCountries]));
            setCountryList(mergedCountries);
        } catch (error) {
            console.error('Failed to fetch states:', error);
            toast.error('Failed to load State Master data');
        } finally {
            setLoading(false);
        }
    };

    const populateForm = (item) => {
        if (!item) {
            setEditingState(null);
            setFormData({
                country: 'India',
                customCountry: '',
                dialCode: '+91',
                state: '',
                shortCode: '',
                gstCode: '',
                city: '',
                status: 'Active'
            });
            setIsCustomCountry(false);
            setIsCustomState(false);
            setIsCustomCity(false);
            return;
        }

        setEditingState(item);
        const ctry = item.country || 'India';
        const isInd = ctry.toLowerCase() === 'india';
        
        setFormData({
            country: ctry,
            customCountry: '',
            dialCode: item.dialCode || getDialCodeForCountry(ctry),
            state: item.state || '',
            shortCode: item.shortCode || '',
            gstCode: item.gstCode || '',
            city: item.city || '',
            status: item.status || 'Active'
        });
        setIsCustomCountry(false);

        if (isInd && item.state) {
            const inList = (DEFAULT_STATES['India'] || []).some(s => s.state.toLowerCase() === item.state.toLowerCase());
            setIsCustomState(!inList);
        } else {
            setIsCustomState(true);
        }

        if (item.state && item.city) {
            const knownCities = getCitiesForState(item.state);
            const inCityList = knownCities.some(c => c.toLowerCase() === item.city.toLowerCase());
            setIsCustomCity(!inCityList);
        } else {
            setIsCustomCity(false);
        }
    };

    useEffect(() => {
        if (isCreatePage) {
            populateForm(null);
            setShowModal(true);
        } else if (isEditPage && routeId) {
            setShowModal(true);
            const found = states.find(s => s._id === routeId);
            if (found) {
                populateForm(found);
            } else {
                stateMasterService.getAll().then(res => {
                    const list = Array.isArray(res.data) ? res.data : (res.data?.data || []);
                    const item = list.find(s => s._id === routeId);
                    if (item) {
                        populateForm(item);
                    }
                }).catch(err => console.error(err));
            }
        }
    }, [isCreatePage, isEditPage, routeId, states]);

    const handleCountryChange = (e) => {
        const val = e.target.value;
        if (val === '__ADD_NEW__') {
            setIsCustomCountry(true);
            setIsCustomState(true);
            setIsCustomCity(false);
            setFormData(prev => ({
                ...prev,
                country: '',
                customCountry: '',
                dialCode: '+91',
                state: '',
                shortCode: '',
                gstCode: '',
                city: ''
            }));
        } else {
            setIsCustomCountry(false);
            const dial = getDialCodeForCountry(val);
            setIsCustomState(val !== 'India');
            setIsCustomCity(false);
            setFormData(prev => ({
                ...prev,
                country: val,
                customCountry: '',
                dialCode: dial,
                state: '',
                shortCode: '',
                gstCode: '',
                city: ''
            }));
        }
    };

    const handleStateInputChange = (val) => {
        const activeCtry = isCustomCountry ? formData.customCountry : formData.country;
        const countryStates = DEFAULT_STATES[activeCtry] || DEFAULT_STATES['India'] || [];
        const match = countryStates.find(s => s.state.toLowerCase() === val.trim().toLowerCase());
        setFormData(prev => ({
            ...prev,
            state: val,
            dialCode: prev.dialCode || '+91',
            shortCode: match ? match.shortCode : prev.shortCode,
            gstCode: match ? formatGstPrefix(match.gstCode) : prev.gstCode,
            city: ''
        }));
    };

    const handleIndianStateSelect = (e) => {
        const val = e.target.value;
        if (val === '__CUSTOM__') {
            setIsCustomState(true);
            setIsCustomCity(false);
            setFormData(prev => ({
                ...prev,
                state: '',
                dialCode: '+91',
                shortCode: '',
                gstCode: '',
                city: ''
            }));
        } else {
            setIsCustomState(false);
            setIsCustomCity(false);
            const indianStates = DEFAULT_STATES['India'] || [];
            const match = indianStates.find(s => s.state === val);
            setFormData(prev => ({
                ...prev,
                state: val,
                dialCode: prev.dialCode || '+91',
                shortCode: match ? match.shortCode : '',
                gstCode: match ? formatGstPrefix(match.gstCode) : '',
                city: ''
            }));
        }
    };

    const handleCitySelect = (e) => {
        const val = e.target.value;
        if (val === '__CUSTOM_CITY__') {
            setIsCustomCity(true);
            setFormData(prev => ({ ...prev, city: '' }));
        } else {
            setIsCustomCity(false);
            setFormData(prev => ({ ...prev, city: val }));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const selectedCountry = isCustomCountry ? formData.customCountry.trim() : formData.country.trim();

        if (!selectedCountry) {
            toast.error('Country name is required');
            return;
        }
        if (!formData.state.trim() || !formData.shortCode.trim()) {
            toast.error('State name and Short Code are required');
            return;
        }

        // Space & Case Normalized Duplicate Check
        const normalizeState = (name) => name ? name.trim().replace(/\s+/g, ' ').toLowerCase() : '';
        const normalizedInput = normalizeState(formData.state);
        const duplicate = states.find(s => 
            (!editingState || s._id !== editingState._id) && 
            normalizeState(s.state) === normalizedInput
        );

        if (duplicate) {
            toast.error(`State '${formData.state.trim()}' already exists (matches '${duplicate.state}'). Duplicates are prohibited.`);
            return;
        }

        const payload = {
            country: selectedCountry,
            dialCode: formData.dialCode.trim(),
            state: formData.state.trim().replace(/\s+/g, ' '),
            shortCode: formData.shortCode.trim().toUpperCase(),
            gstCode: formData.gstCode.trim(),
            city: formData.city.trim(),
            status: formData.status
        };

        try {
            if (editingState) {
                await stateMasterService.update(editingState._id, payload);
                toast.success('State updated successfully');
            } else {
                await stateMasterService.create(payload);
                toast.success('State created successfully');
            }
            setShowModal(false);
            fetchStates();
            navigate('/state-master');
        } catch (error) {
            toast.error(error.response?.data?.message || 'Save failed');
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this State entry?')) return;
        try {
            await stateMasterService.delete(id);
            toast.success('State deleted successfully');
            fetchStates();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Deletion failed');
        }
    };

    const filteredStates = states.filter(s =>
        (s.country || 'India').toLowerCase().includes(search.toLowerCase()) ||
        (s.dialCode || '').toLowerCase().includes(search.toLowerCase()) ||
        (s.state || '').toLowerCase().includes(search.toLowerCase()) ||
        (s.city || '').toLowerCase().includes(search.toLowerCase()) ||
        (s.shortCode || '').toLowerCase().includes(search.toLowerCase()) ||
        (s.gstCode || '').toLowerCase().includes(search.toLowerCase())
    );

    const activeCountry = isCustomCountry ? formData.customCountry : formData.country;
    const isIndiaSelected = activeCountry === 'India';
    const knownCitiesForState = getCitiesForState(formData.state);

    return (
        <div className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto">
            {!(showModal || isCreatePage || isEditPage) ? (
                <>
                    {/* Header */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight font-outfit uppercase">
                        State Master
                    </h1>
                    <p className="text-slate-500 font-semibold text-sm">
                        Manage Country, Dial Codes, State & Short Codes, GST Codes & Cities.
                    </p>
                </div>
                <button
                    onClick={() => navigate('/state-master/new')}
                    className="flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-6 py-3.5 rounded-2xl font-black transition-all shadow-xl shadow-primary-600/20 uppercase text-xs tracking-widest active:scale-95 self-start md:self-auto"
                >
                    <MdAdd size={18} />
                    <span>New State Entry</span>
                </button>
            </div>

            {/* Search and Table */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden p-6 space-y-6">
                <div className="relative max-w-md">
                    <MdSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                    <input
                        type="text"
                        placeholder="Search country, dial code, state, city, short code or GST code..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                    />
                </div>

                {loading ? (
                    <div className="p-20 text-center text-slate-400 font-medium">
                        <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-primary-500 border-t-transparent mb-4"></div>
                        <p className="text-xs uppercase font-black tracking-widest">Loading States...</p>
                    </div>
                ) : filteredStates.length === 0 ? (
                    <div className="p-16 text-center text-slate-400">
                        <p className="font-bold text-sm">No State entries found.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            {/* Table headers removed as requested */}
                            <tbody className="divide-y divide-slate-100 text-sm font-semibold">
                                {filteredStates.map((item) => (
                                    <tr key={item._id} className="hover:bg-slate-50/60 transition-all">
                                        <td className="py-4 px-6 font-bold text-slate-700">
                                            <span className="inline-flex items-center gap-1.5 bg-slate-100 px-3 py-1 rounded-xl text-xs font-bold text-slate-800">
                                                <MdPublic className="text-primary-600" size={14} />
                                                {item.country || 'India'}
                                            </span>
                                        </td>
                                        <td className="py-4 px-6">
                                            <span className="font-mono bg-blue-50 text-blue-700 px-2.5 py-1 rounded-xl text-xs font-bold border border-blue-100">
                                                {item.dialCode || '+91'}
                                            </span>
                                        </td>
                                        <td className="py-4 px-6 font-bold text-slate-900">{item.state}</td>
                                        <td className="py-4 px-6 font-bold text-slate-700">{item.city || '-'}</td>
                                        <td className="py-4 px-6">
                                            <span className="font-mono bg-primary-50 text-primary-700 px-3 py-1 rounded-xl text-xs font-black border border-primary-100">
                                                {item.shortCode}
                                            </span>
                                        </td>
                                        <td className="py-4 px-6">
                                            <span className="font-mono bg-slate-50 text-slate-700 px-3 py-1 rounded-xl text-xs font-black border border-slate-200">
                                                {formatGstPrefix(item.gstCode) || '-'}
                                            </span>
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
                                                    onClick={() => navigate(`/state-master/edit/${item._id}`)}
                                                    className="p-2 text-slate-400 hover:text-primary-600 hover:bg-slate-100 rounded-xl transition-all"
                                                    title="Edit State"
                                                >
                                                    <MdEdit size={18} />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(item._id)}
                                                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                                                    title="Delete State"
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
                                    onClick={() => { setShowModal(false); navigate('/state-master'); }}
                                    className="p-3 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-2xl transition-all border border-slate-200"
                                >
                                    <MdArrowBack size={20} />
                                </button>
                                <div>
                                    <h1 className="text-xl font-black text-slate-900">
                                        {editingState ? 'Edit State Entry' : 'Create State Entry'}
                                    </h1>
                                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                                        {editingState ? `Update mapping for ${editingState.state}` : 'Add a new Country, State, Short Code & GST Code pair'}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    type="button"
                                    onClick={() => { setShowModal(false); navigate('/state-master'); }}
                                    className="px-6 py-3 rounded-2xl border border-slate-200 text-slate-600 font-black uppercase text-xs tracking-widest hover:bg-slate-50 transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    form="state-master-form"
                                    className="bg-primary-600 hover:bg-primary-700 text-white px-8 py-3 rounded-2xl font-black transition-all shadow-xl shadow-primary-600/20 uppercase text-xs tracking-widest active:scale-95"
                                >
                                    {editingState ? 'Save Changes' : 'Create Entry'}
                                </button>
                            </div>
                        </div>

                        {/* Form Card Body */}
                        <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
                            <form id="state-master-form" onSubmit={handleSubmit} className="space-y-6">
                                {/* Row 1: Country & Country Dial Code */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Field 1: Country */}
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Country *</label>
                                        {!isCustomCountry ? (
                                            <select
                                                value={formData.country}
                                                onChange={handleCountryChange}
                                                className="w-full px-4 py-3.5 rounded-2xl border border-slate-200 bg-slate-50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm font-semibold cursor-pointer"
                                            >
                                                {countryList.map(c => (
                                                    <option key={c} value={c}>{c}</option>
                                                ))}
                                                <option value="__ADD_NEW__" className="font-bold text-primary-600">
                                                    + Add New Country...
                                                </option>
                                            </select>
                                        ) : (
                                            <div className="space-y-2">
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="text"
                                                        required
                                                        autoFocus
                                                        placeholder="Enter New Country Name (e.g. Canada, Germany, UAE)"
                                                        value={formData.customCountry}
                                                        onChange={(e) => setFormData({ ...formData, customCountry: e.target.value })}
                                                        className="w-full px-4 py-3.5 rounded-2xl border border-primary-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm font-semibold"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => { setIsCustomCountry(false); setFormData({ ...formData, country: countryList[0] || 'India' }); }}
                                                        className="px-4 py-3.5 bg-slate-100 text-slate-600 rounded-2xl text-xs font-bold whitespace-nowrap hover:bg-slate-200 transition-all"
                                                    >
                                                        Select Existing
                                                    </button>
                                                </div>
                                                <p className="text-[11px] text-primary-600 font-medium">Entering new country name inline</p>
                                            </div>
                                        )}
                                    </div>

                                    {/* Field 2: Country Dial Code */}
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Country Dial Code</label>
                                        <input
                                            type="text"
                                            placeholder="e.g. +91"
                                            value={formData.dialCode}
                                            onChange={(e) => setFormData({ ...formData, dialCode: e.target.value })}
                                            className="w-full px-4 py-3.5 rounded-2xl border border-slate-200 bg-slate-50 text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm font-bold"
                                        />
                                    </div>
                                </div>

                                {/* Row 2: State / UT & Short Code */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Field 3: State / Union Territory */}
                                    <div>
                                        <div className="flex items-center justify-between mb-1.5">
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">State / Union Territory *</label>
                                            {isIndiaSelected && (
                                                <button
                                                    type="button"
                                                    onClick={() => setIsCustomState(!isCustomState)}
                                                    className="text-[11px] text-primary-600 font-bold hover:underline"
                                                >
                                                    {isCustomState ? 'Select from List' : '+ Enter Custom State Name'}
                                                </button>
                                            )}
                                        </div>

                                        {isIndiaSelected && !isCustomState ? (
                                            <select
                                                value={formData.state}
                                                onChange={handleIndianStateSelect}
                                                required
                                                className="w-full px-4 py-3.5 rounded-2xl border border-slate-200 bg-slate-50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm font-semibold cursor-pointer"
                                            >
                                                <option value="">-- Select State / UT --</option>
                                                {(DEFAULT_STATES['India'] || []).map(st => (
                                                    <option key={st.state} value={st.state}>
                                                        {st.state} ({st.shortCode}) {st.gstCode ? `- GST: ${st.gstCode}` : ''}
                                                    </option>
                                                ))}
                                                <option value="__CUSTOM__" className="font-bold text-primary-600">
                                                    + Custom State / UT Name...
                                                </option>
                                            </select>
                                        ) : (
                                            <input
                                                type="text"
                                                required
                                                placeholder="e.g. Maharashtra, Gujarat, California, Ontario"
                                                value={formData.state}
                                                onChange={(e) => handleStateInputChange(e.target.value)}
                                                className="w-full px-4 py-3.5 rounded-2xl border border-slate-200 bg-slate-50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm font-semibold"
                                            />
                                        )}
                                    </div>

                                    {/* Field 4: Short Code (2-letter) */}
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Short Code (2-letter) *</label>
                                        <input
                                            type="text"
                                            required
                                            maxLength={5}
                                            placeholder="e.g. MH, GJ, CA, ON"
                                            value={formData.shortCode}
                                            onChange={(e) => setFormData({ ...formData, shortCode: e.target.value.toUpperCase() })}
                                            className="w-full px-4 py-3.5 rounded-2xl border border-slate-200 bg-slate-50 text-slate-900 uppercase font-mono focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm font-bold"
                                        />
                                    </div>
                                </div>

                                {/* Row 3: GST Code & City Name */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Field 5: GST Code / Number Prefix */}
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">GST Code / Number Prefix</label>
                                        <input
                                            type="text"
                                            maxLength={2}
                                            placeholder="e.g. 04, 27"
                                            value={formData.gstCode}
                                            onChange={(e) => setFormData({ ...formData, gstCode: e.target.value.replace(/\D/g, '') })}
                                            onBlur={(e) => setFormData(prev => ({ ...prev, gstCode: formatGstPrefix(e.target.value) }))}
                                            className="w-full px-4 py-3.5 rounded-2xl border border-slate-200 bg-slate-50 text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm font-bold"
                                        />
                                    </div>

                                    {/* Field 6: City Name */}
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">City Name</label>
                                        {!isCustomCity ? (
                                            <select
                                                disabled={!formData.state.trim()}
                                                value={formData.city}
                                                onChange={handleCitySelect}
                                                className="w-full px-4 py-3.5 rounded-2xl border border-slate-200 bg-slate-50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-100"
                                            >
                                                <option value="">
                                                    {!formData.state.trim() ? '-- Select State First --' : '-- Select City Name --'}
                                                </option>
                                                {knownCitiesForState.map(ct => (
                                                    <option key={ct} value={ct}>{ct}</option>
                                                ))}
                                                {formData.state.trim() && (
                                                    <option value="__CUSTOM_CITY__" className="font-bold text-primary-600">+ Enter Custom City...</option>
                                                )}
                                            </select>
                                        ) : (
                                            <div className="space-y-1">
                                                <input
                                                    type="text"
                                                    placeholder="e.g. Mumbai, Pune, Ahmedabad"
                                                    value={formData.city}
                                                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                                                    className="w-full px-4 py-3.5 rounded-2xl border border-slate-200 bg-slate-50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm font-semibold"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setIsCustomCity(false)}
                                                    className="text-[11px] text-primary-600 font-bold hover:underline"
                                                >
                                                    Select from list
                                                </button>
                                            </div>
                                        )}
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

export default StateMaster;
