import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../services/api';
import {
    MdStorefront,
    MdArrowBack,
    MdSave,
    MdAdd,
    MdDelete,
    MdLocationOn,
    MdViewWeek
} from 'react-icons/md';

const API_BASE = '/inventory';

const WarehouseForm = () => {
    const navigate = useNavigate();
    const { id } = useParams();
    const isEdit = Boolean(id);

    const [loading, setLoading] = useState(isEdit);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    const [formData, setFormData] = useState({
        warehouseCode: '',
        warehouseName: '',
        warehouseType: 'Main Warehouse',
        address: { street: '', city: '', state: '', pincode: '', country: 'India' },
        isDefault: false,
        isActive: true,
        bins: [{ binCode: '', rackCode: '', aisleCode: '', maxWeightKg: 1000 }]
    });

    useEffect(() => {
        if (isEdit) {
            api.get(`${API_BASE}/warehouses/${id}`)
                .then(res => {
                    const wh = res.data?.warehouse || res.data;
                    setFormData({
                        warehouseCode: wh.warehouseCode || '',
                        warehouseName: wh.warehouseName || '',
                        warehouseType: wh.warehouseType || wh.type || 'Main Warehouse',
                        address: {
                            street: wh.address?.street || '',
                            city: wh.address?.city || '',
                            state: wh.address?.state || '',
                            pincode: wh.address?.pincode || '',
                            country: wh.address?.country || 'India'
                        },
                        isDefault: wh.isDefault || false,
                        isActive: wh.isActive !== undefined ? wh.isActive : true,
                        bins: wh.bins?.length ? wh.bins : [{ binCode: '', rackCode: '', aisleCode: '', maxWeightKg: 1000 }]
                    });
                })
                .catch(err => {
                    console.error('Error fetching warehouse:', err);
                    setError('Failed to load warehouse details.');
                })
                .finally(() => setLoading(false));
        }
    }, [id, isEdit]);

    const handleAddBinRow = () => {
        setFormData(prev => ({
            ...prev,
            bins: [...prev.bins, { binCode: '', rackCode: '', aisleCode: '', maxWeightKg: 1000 }]
        }));
    };

    const handleRemoveBinRow = (index) => {
        setFormData(prev => ({
            ...prev,
            bins: prev.bins.filter((_, i) => i !== index)
        }));
    };

    const handleBinChange = (index, field, value) => {
        setFormData(prev => {
            const updated = [...prev.bins];
            updated[index] = { ...updated[index], [field]: value };
            return { ...prev, bins: updated };
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSubmitting(true);

        const payload = {
            ...formData,
            type: formData.warehouseType
        };

        try {
            if (isEdit) {
                await api.put(`${API_BASE}/warehouses/${id}`, payload);
                alert('Warehouse updated successfully!');
            } else {
                await api.post(`${API_BASE}/warehouses`, payload);
                alert('Warehouse created successfully!');
            }
            navigate('/inventory/warehouses');
        } catch (err) {
            console.error('Error saving warehouse:', err);
            setError(err.response?.data?.message || 'Error saving warehouse');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return <div className="p-12 text-center text-slate-400">Loading warehouse details...</div>;
    }

    return (
        <div className="p-6 max-w-5xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/inventory/warehouses')}
                        className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-all"
                    >
                        <MdArrowBack className="text-xl" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <MdStorefront className="text-teal-600 dark:text-teal-400" />
                            {isEdit ? 'Edit Warehouse' : 'Add New Warehouse'}
                        </h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                            {isEdit ? `Updating warehouse ${formData.warehouseCode}` : 'Register a new warehouse facility and layout structure'}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={() => navigate('/inventory/warehouses')}
                        className="px-4 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-all"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={submitting}
                        className="flex items-center gap-2 px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-medium rounded-xl transition-all shadow-md text-sm disabled:opacity-50"
                    >
                        <MdSave className="text-lg" /> {submitting ? 'Saving...' : isEdit ? 'Update Warehouse' : 'Save Warehouse'}
                    </button>
                </div>
            </div>

            {error && (
                <div className="p-4 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 rounded-xl text-sm font-medium">
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* General Information Card */}
                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
                    <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2 border-b border-slate-100 dark:border-slate-700 pb-3">
                        <MdStorefront className="text-teal-600" /> Basic Details
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Warehouse Code *</label>
                            <input
                                type="text"
                                required
                                value={formData.warehouseCode}
                                onChange={(e) => setFormData({ ...formData, warehouseCode: e.target.value.toUpperCase() })}
                                placeholder="e.g. WH-MUM-01"
                                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-teal-500 font-mono"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Warehouse Name *</label>
                            <input
                                type="text"
                                required
                                value={formData.warehouseName}
                                onChange={(e) => setFormData({ ...formData, warehouseName: e.target.value })}
                                placeholder="e.g. Central Depot Mumbai"
                                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-teal-500"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Warehouse Type</label>
                            <select
                                value={formData.warehouseType}
                                onChange={(e) => setFormData({ ...formData, warehouseType: e.target.value })}
                                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-teal-500"
                            >
                                <option value="Main Warehouse">Main Warehouse</option>
                                <option value="Transit Warehouse">Transit Warehouse</option>
                                <option value="Factory Store">Factory Store</option>
                                <option value="Retail Outlet">Retail Outlet</option>
                            </select>
                        </div>
                    </div>

                    <div className="flex items-center gap-6 pt-2">
                        <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 cursor-pointer font-medium">
                            <input
                                type="checkbox"
                                checked={formData.isDefault}
                                onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                                className="w-4 h-4 text-teal-600 rounded focus:ring-teal-500"
                            />
                            Set as Default Warehouse
                        </label>
                        <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 cursor-pointer font-medium">
                            <input
                                type="checkbox"
                                checked={formData.isActive}
                                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                                className="w-4 h-4 text-teal-600 rounded focus:ring-teal-500"
                            />
                            Active Facility
                        </label>
                    </div>
                </div>

                {/* Location & Address Card */}
                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
                    <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2 border-b border-slate-100 dark:border-slate-700 pb-3">
                        <MdLocationOn className="text-teal-600" /> Location & Address
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-2">
                            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Street Address</label>
                            <input
                                type="text"
                                value={formData.address.street}
                                onChange={(e) => setFormData({ ...formData, address: { ...formData.address, street: e.target.value } })}
                                placeholder="Plot No. / Industrial Area"
                                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-teal-500"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">City</label>
                            <input
                                type="text"
                                value={formData.address.city}
                                onChange={(e) => setFormData({ ...formData, address: { ...formData.address, city: e.target.value } })}
                                placeholder="e.g. Mumbai"
                                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-teal-500"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">State</label>
                            <input
                                type="text"
                                value={formData.address.state}
                                onChange={(e) => setFormData({ ...formData, address: { ...formData.address, state: e.target.value } })}
                                placeholder="e.g. Maharashtra"
                                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-teal-500"
                            />
                        </div>
                    </div>
                </div>

                {/* Bin & Rack Layout Structure */}
                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3">
                        <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <MdViewWeek className="text-teal-600" /> Bin & Rack Layout
                        </h2>
                        <button
                            type="button"
                            onClick={handleAddBinRow}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-50 dark:bg-teal-950 text-teal-700 dark:text-teal-300 text-xs font-bold rounded-lg hover:bg-teal-100"
                        >
                            <MdAdd /> Add Bin Slot
                        </button>
                    </div>

                    <div className="space-y-3">
                        {formData.bins.map((bin, idx) => (
                            <div key={idx} className="flex flex-col sm:flex-row items-center gap-3 p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">
                                <div className="w-full sm:w-1/3">
                                    <label className="text-[10px] uppercase font-bold text-slate-400">Bin Code *</label>
                                    <input
                                        type="text"
                                        required
                                        value={bin.binCode}
                                        onChange={(e) => handleBinChange(idx, 'binCode', e.target.value.toUpperCase())}
                                        placeholder="BIN-A1"
                                        className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border rounded-lg text-xs font-mono font-bold"
                                    />
                                </div>
                                <div className="w-full sm:w-1/3">
                                    <label className="text-[10px] uppercase font-bold text-slate-400">Rack Code</label>
                                    <input
                                        type="text"
                                        value={bin.rackCode}
                                        onChange={(e) => handleBinChange(idx, 'rackCode', e.target.value.toUpperCase())}
                                        placeholder="RACK-01"
                                        className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border rounded-lg text-xs font-mono"
                                    />
                                </div>
                                <div className="w-full sm:w-1/3">
                                    <label className="text-[10px] uppercase font-bold text-slate-400">Aisle Code</label>
                                    <input
                                        type="text"
                                        value={bin.aisleCode}
                                        onChange={(e) => handleBinChange(idx, 'aisleCode', e.target.value.toUpperCase())}
                                        placeholder="AISLE-A"
                                        className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border rounded-lg text-xs font-mono"
                                    />
                                </div>
                                {formData.bins.length > 1 && (
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveBinRow(idx)}
                                        className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950 rounded-lg shrink-0 mt-4 sm:mt-0"
                                    >
                                        <MdDelete className="text-lg" />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </form>
        </div>
    );
};

export default WarehouseForm;
