import { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { MdAdd, MdEdit, MdDelete, MdFileUpload, MdFileDownload } from 'react-icons/md';
import Modal from '../components/Modal';
import ImportModal from '../components/ImportModal';
import { divisionService, segmentService } from '../services/api';

const EMPTY_FORM = { divisionId: '', code: '', description: '', status: 'Active' };

const inputClass = 'w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all outline-none font-semibold text-slate-900 text-sm';
const labelClass = 'block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5';

const codeLabel = (doc) => (doc ? `${doc.code} - ${doc.description}` : '');

// Segment Master: every segment belongs to one Division. The import template carries codes
// only (Division_Code, Segment_Code); the export adds both descriptions.
const SegmentMaster = () => {
    const [divisions, setDivisions] = useState([]);
    const [segments, setSegments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterDivision, setFilterDivision] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isImportOpen, setIsImportOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState(EMPTY_FORM);
    const [saving, setSaving] = useState(false);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [divRes, segRes] = await Promise.all([divisionService.getAll(), segmentService.getAll()]);
            setDivisions(divRes.data || []);
            setSegments(segRes.data || []);
        } catch (err) {
            console.error('Error fetching segments:', err);
            toast.error('Failed to load segments');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    const visibleSegments = useMemo(
        () => segments.filter(s => !filterDivision || String(s.divisionId?._id || s.divisionId) === filterDivision),
        [segments, filterDivision]
    );

    const openModal = (segment = null) => {
        setEditing(segment);
        setForm(segment
            ? { divisionId: segment.divisionId?._id || segment.divisionId || '', code: segment.code, description: segment.description, status: segment.status }
            : { ...EMPTY_FORM, divisionId: filterDivision });
        setIsModalOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.divisionId) return toast.error('Select a Division');
        if (!form.code.trim() || !form.description.trim()) return toast.error('Segment Code and Description are required');
        setSaving(true);
        try {
            if (editing) {
                await segmentService.update(editing._id, form);
                toast.success('Segment updated');
            } else {
                await segmentService.create(form);
                toast.success('Segment created');
            }
            setIsModalOpen(false);
            fetchData();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to save segment');
        } finally {
            setSaving(false);
        }
    };

    const toggleStatus = async (segment) => {
        try {
            await segmentService.update(segment._id, {
                divisionId: segment.divisionId?._id || segment.divisionId,
                code: segment.code,
                description: segment.description,
                status: segment.status === 'Active' ? 'Inactive' : 'Active'
            });
            fetchData();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to update status');
        }
    };

    const handleDelete = async (segment) => {
        if (!window.confirm(`Delete Segment "${segment.code}"?`)) return;
        try {
            await segmentService.delete(segment._id);
            toast.success('Segment deleted');
            fetchData();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to delete segment');
        }
    };

    const handleExport = async () => {
        try {
            const res = await segmentService.exportAll();
            const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
            const link = document.createElement('a');
            link.href = url;
            link.download = `Segment_Master_${new Date().toISOString().slice(0, 10)}.xlsx`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Segment export error:', err);
            toast.error('Failed to export segments');
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">Segment Master</h1>
                    <p className="text-slate-500 font-medium">Segments grouped under their Division.</p>
                </div>
                <div className="flex flex-wrap gap-3">
                    <button
                        onClick={() => setIsImportOpen(true)}
                        className="flex items-center justify-center gap-2 bg-slate-900 hover:bg-black text-white px-5 py-3 rounded-2xl font-bold transition-all uppercase text-xs tracking-widest active:scale-95"
                    >
                        <MdFileUpload size={18} />
                        <span>Import</span>
                    </button>
                    <button
                        onClick={handleExport}
                        className="flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-5 py-3 rounded-2xl font-bold transition-all uppercase text-xs tracking-widest active:scale-95"
                    >
                        <MdFileDownload size={18} />
                        <span>Export</span>
                    </button>
                    <button
                        onClick={() => openModal()}
                        className="flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-2xl font-bold transition-all shadow-xl shadow-primary-600/20 uppercase text-xs tracking-widest active:scale-95"
                    >
                        <MdAdd size={20} />
                        <span>Add Segment</span>
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
                <div className="p-4 border-b border-slate-100 bg-slate-50 flex flex-wrap items-center gap-3">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Division</span>
                    <select
                        value={filterDivision}
                        onChange={(e) => setFilterDivision(e.target.value)}
                        className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl outline-none text-xs font-bold text-slate-700"
                    >
                        <option value="">All Divisions</option>
                        {divisions.map(d => <option key={d._id} value={d._id}>{codeLabel(d)}</option>)}
                    </select>
                </div>
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
                                        <th className="p-4 text-xs font-black text-slate-400 uppercase tracking-widest first:rounded-l-xl">Division</th>
                                        <th className="p-4 text-xs font-black text-slate-400 uppercase tracking-widest">Segment Code</th>
                                        <th className="p-4 text-xs font-black text-slate-400 uppercase tracking-widest">Segment Description</th>
                                        <th className="p-4 text-xs font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
                                        <th className="p-4 text-xs font-black text-slate-400 uppercase tracking-widest text-right last:rounded-r-xl">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {visibleSegments.map(segment => (
                                        <tr key={segment._id} className="border-b last:border-0 border-slate-50 hover:bg-slate-50/50 transition-colors">
                                            <td className="p-4 text-sm font-semibold text-slate-600">{codeLabel(segment.divisionId) || '-'}</td>
                                            <td className="p-4 text-sm font-bold text-slate-800">{segment.code}</td>
                                            <td className="p-4 text-sm font-medium text-slate-600">{segment.description}</td>
                                            <td className="p-4 text-center">
                                                <button
                                                    onClick={() => toggleStatus(segment)}
                                                    className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm border ${segment.status === 'Active'
                                                        ? 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100'
                                                        : 'bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100'}`}
                                                >
                                                    {segment.status}
                                                </button>
                                            </td>
                                            <td className="p-4 text-right">
                                                <div className="flex justify-end gap-2">
                                                    <button onClick={() => openModal(segment)} className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg transition-all" title="Edit">
                                                        <MdEdit size={18} />
                                                    </button>
                                                    <button onClick={() => handleDelete(segment)} className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-all" title="Delete">
                                                        <MdDelete size={18} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {visibleSegments.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="p-8 text-center text-slate-400 text-sm font-medium">No segments found.</td>
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
                title={editing ? 'Edit Segment' : 'Add Segment'}
                maxWidth="max-w-lg"
            >
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className={labelClass}>Division *</label>
                        <select
                            required
                            value={form.divisionId}
                            onChange={(e) => setForm({ ...form, divisionId: e.target.value })}
                            className={inputClass}
                        >
                            <option value="">Select Division</option>
                            {divisions
                                .filter(d => d.status === 'Active' || d._id === form.divisionId)
                                .map(d => <option key={d._id} value={d._id}>{codeLabel(d)}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className={labelClass}>Segment Code *</label>
                        <input
                            type="text"
                            required
                            maxLength={30}
                            placeholder="e.g. UTIL"
                            value={form.code}
                            onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, '') })}
                            className={inputClass}
                        />
                    </div>
                    <div>
                        <label className={labelClass}>Segment Description *</label>
                        <input
                            type="text"
                            required
                            placeholder="e.g. Energy & Power Utilities"
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
                            {saving ? 'Saving...' : 'Save Segment'}
                        </button>
                    </div>
                </form>
            </Modal>

            <ImportModal
                isOpen={isImportOpen}
                onClose={() => { setIsImportOpen(false); fetchData(); }}
                title="Import Segment Master"
                type="segments"
                onImport={segmentService.import}
                onDownloadTemplate={segmentService.getTemplate}
            />
        </div>
    );
};

export default SegmentMaster;
