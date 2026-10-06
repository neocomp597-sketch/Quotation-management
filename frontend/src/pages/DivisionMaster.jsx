import { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { MdAdd, MdEdit, MdDelete } from 'react-icons/md';
import Modal from '../components/Modal';
import { divisionService } from '../services/api';

const EMPTY_FORM = { code: '', description: '', status: 'Active' };

const inputClass = 'w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all outline-none font-semibold text-slate-900 text-sm';
const labelClass = 'block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5';

// Division Master: Division Code + Description + Status. Segments and Invoice Bulk Upload
// records reference a division; the code is what Excel files carry.
const DivisionMaster = () => {
    const [divisions, setDivisions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState(EMPTY_FORM);
    const [saving, setSaving] = useState(false);

    const fetchDivisions = async () => {
        setLoading(true);
        try {
            const res = await divisionService.getAll();
            setDivisions(res.data || []);
        } catch (err) {
            console.error('Error fetching divisions:', err);
            toast.error('Failed to load divisions');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchDivisions(); }, []);

    const openModal = (division = null) => {
        setEditing(division);
        setForm(division ? { code: division.code, description: division.description, status: division.status } : EMPTY_FORM);
        setIsModalOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.code.trim() || !form.description.trim()) {
            return toast.error('Division Code and Description are required');
        }
        setSaving(true);
        try {
            if (editing) {
                await divisionService.update(editing._id, form);
                toast.success('Division updated');
            } else {
                await divisionService.create(form);
                toast.success('Division created');
            }
            setIsModalOpen(false);
            fetchDivisions();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to save division');
        } finally {
            setSaving(false);
        }
    };

    const toggleStatus = async (division) => {
        try {
            await divisionService.update(division._id, { ...division, status: division.status === 'Active' ? 'Inactive' : 'Active' });
            fetchDivisions();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to update status');
        }
    };

    const handleDelete = async (division) => {
        if (!window.confirm(`Delete Division "${division.code}"?`)) return;
        try {
            await divisionService.delete(division._id);
            toast.success('Division deleted');
            fetchDivisions();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to delete division');
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">Division Master</h1>
                    <p className="text-slate-500 font-medium">Division codes used by the Segment Master and Invoice Bulk Upload.</p>
                </div>
                <button
                    onClick={() => openModal()}
                    className="flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-2xl font-bold transition-all shadow-xl shadow-primary-600/20 uppercase text-xs tracking-widest active:scale-95"
                >
                    <MdAdd size={20} />
                    <span>Add Division</span>
                </button>
            </div>

            <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
                <div className="p-6">
                    {loading ? (
                        <div className="py-20 text-center text-slate-400 font-medium">
                            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-primary-500 border-t-transparent mb-4"></div>
                            <p className="text-xs uppercase font-black tracking-widest">Loading...</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 rounded-xl">
                                        <th className="p-4 text-xs font-black text-slate-400 uppercase tracking-widest first:rounded-l-xl">Division Code</th>
                                        <th className="p-4 text-xs font-black text-slate-400 uppercase tracking-widest">Division Description</th>
                                        <th className="p-4 text-xs font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
                                        <th className="p-4 text-xs font-black text-slate-400 uppercase tracking-widest text-right last:rounded-r-xl">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {divisions.map(division => (
                                        <tr key={division._id} className="border-b last:border-0 border-slate-50 hover:bg-slate-50/50 transition-colors">
                                            <td className="p-4 text-sm font-bold text-slate-800">{division.code}</td>
                                            <td className="p-4 text-sm font-medium text-slate-600">{division.description}</td>
                                            <td className="p-4 text-center">
                                                <button
                                                    onClick={() => toggleStatus(division)}
                                                    className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm border ${division.status === 'Active'
                                                        ? 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100'
                                                        : 'bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100'}`}
                                                >
                                                    {division.status}
                                                </button>
                                            </td>
                                            <td className="p-4 text-right">
                                                <div className="flex justify-end gap-2">
                                                    <button onClick={() => openModal(division)} className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg transition-all" title="Edit">
                                                        <MdEdit size={18} />
                                                    </button>
                                                    <button onClick={() => handleDelete(division)} className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-all" title="Delete">
                                                        <MdDelete size={18} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {divisions.length === 0 && (
                                        <tr>
                                            <td colSpan={4} className="p-8 text-center text-slate-400 text-sm font-medium">No divisions found.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={editing ? 'Edit Division' : 'Add Division'}
                maxWidth="max-w-lg"
            >
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className={labelClass}>Division Code *</label>
                        <input
                            type="text"
                            required
                            maxLength={20}
                            placeholder="e.g. IND"
                            value={form.code}
                            onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '') })}
                            className={inputClass}
                        />
                        <p className="mt-1 text-[10px] text-slate-400 font-semibold">Letters, digits and "_" only.</p>
                    </div>
                    <div>
                        <label className={labelClass}>Division Description *</label>
                        <input
                            type="text"
                            required
                            placeholder="e.g. Industrial"
                            value={form.description}
                            onChange={(e) => setForm({ ...form, description: e.target.value })}
                            className={inputClass}
                        />
                    </div>
                    <div>
                        <label className={labelClass}>Status *</label>
                        <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className={inputClass}>
                            <option value="Active">Active</option>
                            <option value="Inactive">Inactive</option>
                        </select>
                    </div>
                    <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                        <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-bold uppercase text-xs">
                            Cancel
                        </button>
                        <button type="submit" disabled={saving} className="px-8 py-3 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white rounded-2xl font-black uppercase text-xs tracking-wider shadow-lg shadow-primary-600/20 active:scale-95">
                            {saving ? 'Saving...' : 'Save Division'}
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default DivisionMaster;
