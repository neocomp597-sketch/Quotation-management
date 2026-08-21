import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import {
    MdStorefront,
    MdAdd,
    MdSearch,
    MdEdit,
    MdDelete,
    MdCheckCircle,
    MdCancel,
    MdStar,
    MdLayers
} from 'react-icons/md';

const API_BASE = '/inventory/warehouses';

const WarehouseMaster = () => {
    const navigate = useNavigate();
    const [warehouses, setWarehouses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [typeFilter, setTypeFilter] = useState('');

    const fetchWarehouses = async () => {
        setLoading(true);
        try {
            const res = await api.get(API_BASE, {
                params: { search, type: typeFilter }
            });
            setWarehouses(res.data?.warehouses || []);
        } catch (error) {
            console.error('Error fetching warehouses:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchWarehouses();
    }, [search, typeFilter]);

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete or deactivate this warehouse?')) return;
        try {
            const res = await api.delete(`${API_BASE}/${id}`);
            alert(res.data?.message || 'Warehouse updated');
            fetchWarehouses();
        } catch (error) {
            alert(error.response?.data?.message || 'Error deleting warehouse');
        }
    };

    return (
        <div className="p-6 space-y-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <MdStorefront className="text-teal-600 dark:text-teal-400" /> Warehouse Master
                    </h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        Configure storage locations, regional depots, retail stores, and bin/rack layouts.
                    </p>
                </div>
                <button
                    onClick={() => navigate('/inventory/warehouses/new')}
                    className="flex items-center gap-2 px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-medium rounded-xl transition-all shadow-md shadow-teal-600/20 text-sm"
                >
                    <MdAdd className="text-lg" /> Add Warehouse
                </button>
            </div>

            {/* Filter Bar */}
            <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                    <MdSearch className="absolute left-3.5 top-3 text-slate-400 text-lg" />
                    <input
                        type="text"
                        placeholder="Search by warehouse code or name..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-teal-500"
                    />
                </div>
                <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    className="px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-teal-500"
                >
                    <option value="">All Warehouse Types</option>
                    <option value="Main Warehouse">Main Warehouse</option>
                    <option value="Regional Depot">Regional Depot</option>
                    <option value="Retail Store">Retail Store</option>
                    <option value="Transit Location">Transit Location</option>
                </select>
            </div>

            {/* Warehouse Directory Table */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
                {loading ? (
                    <div className="p-12 text-center text-slate-400">Loading warehouses...</div>
                ) : warehouses.length === 0 ? (
                    <div className="p-12 text-center text-slate-400">No warehouses configured yet.</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 uppercase text-xs">
                                <tr>
                                    <th className="px-5 py-3.5 font-semibold">Code</th>
                                    <th className="px-5 py-3.5 font-semibold">Warehouse Name</th>
                                    <th className="px-5 py-3.5 font-semibold">Type</th>
                                    <th className="px-5 py-3.5 font-semibold">Bins / Racks</th>
                                    <th className="px-5 py-3.5 font-semibold">City</th>
                                    <th className="px-5 py-3.5 font-semibold">Status</th>
                                    <th className="px-5 py-3.5 font-semibold text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                {warehouses.map(wh => (
                                    <tr key={wh._id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                                        <td className="px-5 py-4 font-mono font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                                            {wh.isDefault && <MdStar className="text-amber-500" title="Default Warehouse" />}
                                            {wh.warehouseCode}
                                        </td>
                                        <td className="px-5 py-4 font-medium text-slate-900 dark:text-white">
                                            {wh.warehouseName}
                                        </td>
                                        <td className="px-5 py-4 text-slate-600 dark:text-slate-300">
                                            <span className="px-2.5 py-1 bg-slate-100 dark:bg-slate-700 text-xs font-medium rounded-full">
                                                {wh.warehouseType || wh.type || 'Main Warehouse'}
                                            </span>
                                        </td>
                                        <td className="px-5 py-4 text-slate-600 dark:text-slate-300">
                                            <span className="flex items-center gap-1 text-xs font-semibold text-teal-600 dark:text-teal-400">
                                                <MdLayers /> {wh.bins?.length || 0} Bins
                                            </span>
                                        </td>
                                        <td className="px-5 py-4 text-slate-600 dark:text-slate-300">
                                            {wh.address?.city || 'Default Location'}
                                        </td>
                                        <td className="px-5 py-4">
                                            {wh.isActive ? (
                                                <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 flex items-center gap-1 w-fit">
                                                    <MdCheckCircle /> Active
                                                </span>
                                            ) : (
                                                <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400 flex items-center gap-1 w-fit">
                                                    <MdCancel /> Inactive
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-5 py-4 text-right space-x-2">
                                            <button
                                                onClick={() => navigate(`/inventory/warehouses/edit/${wh._id}`)}
                                                className="p-2 text-slate-600 hover:text-teal-600 dark:text-slate-400 dark:hover:text-teal-400 transition-colors"
                                                title="Edit Warehouse Page"
                                            >
                                                <MdEdit className="text-lg" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(wh._id)}
                                                className="p-2 text-slate-600 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 transition-colors"
                                                title="Delete / Deactivate"
                                            >
                                                <MdDelete className="text-lg" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default WarehouseMaster;
