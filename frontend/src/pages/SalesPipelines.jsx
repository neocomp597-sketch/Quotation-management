import React, { useState, useEffect } from 'react';
import { salesService } from '../services/api';
import { toast } from 'react-toastify';
import { MdAdd, MdEdit, MdDelete, MdClose, MdSave, MdStar, MdBuildCircle } from 'react-icons/md';
import Modal from '../components/Modal';

const DEFAULT_COLORS = ['#94a3b8', '#3b82f6', '#8b5cf6', '#f59e0b', '#f97316', '#10b981', '#22c55e', '#ec4899', '#ef4444'];

const SalesPipelines = () => {
    const [pipelines, setPipelines] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editId, setEditId] = useState(null);
    const [form, setForm] = useState({ name: '', description: '', isDefault: false, stages: [] });

    useEffect(() => { loadPipelines(); }, []);

    const loadPipelines = async () => {
        try {
            setLoading(true);
            const res = await salesService.getPipelines();
            setPipelines(res.data);
        } catch (err) {
            toast.error('Failed to load pipelines');
        } finally {
            setLoading(false);
        }
    };

    const openCreate = () => {
        setEditId(null);
        setForm({
            name: '', description: '', isDefault: false,
            stages: [
                { name: 'Lead', probability: 10, color: '#94a3b8', sortOrder: 1 },
                { name: 'Qualified', probability: 25, color: '#3b82f6', sortOrder: 2 },
                { name: 'Proposal Sent', probability: 60, color: '#f59e0b', sortOrder: 3 },
                { name: 'Negotiation', probability: 80, color: '#f97316', sortOrder: 4 },
                { name: 'Won', probability: 100, color: '#22c55e', sortOrder: 5 }
            ]
        });
        setShowForm(true);
    };

    const openEdit = (pipeline) => {
        setEditId(pipeline._id);
        setForm({
            name: pipeline.name,
            description: pipeline.description || '',
            isDefault: pipeline.isDefault,
            stages: pipeline.stages.map(s => ({ ...s }))
        });
        setShowForm(true);
    };

    const handleSave = async () => {
        if (!form.name.trim()) return toast.error('Name is required');
        if (form.stages.length === 0) return toast.error('At least one stage is required');

        try {
            if (editId) {
                await salesService.updatePipeline(editId, form);
                toast.success('Pipeline updated');
            } else {
                await salesService.createPipeline(form);
                toast.success('Pipeline created');
            }
            setShowForm(false);
            loadPipelines();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to save');
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Delete this pipeline?')) return;
        try {
            await salesService.deletePipeline(id);
            toast.success('Deleted');
            loadPipelines();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to delete');
        }
    };

    const addStage = () => {
        setForm({
            ...form,
            stages: [...form.stages, {
                name: '', probability: 50,
                color: DEFAULT_COLORS[form.stages.length % DEFAULT_COLORS.length],
                sortOrder: form.stages.length + 1
            }]
        });
    };

    const removeStage = (index) => {
        setForm({ ...form, stages: form.stages.filter((_, i) => i !== index).map((s, i) => ({ ...s, sortOrder: i + 1 })) });
    };

    const updateStage = (index, field, value) => {
        const updated = [...form.stages];
        updated[index] = { ...updated[index], [field]: value };
        setForm({ ...form, stages: updated });
    };

    if (loading) {
        return <div className="flex items-center justify-center h-96"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div></div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white shadow-lg">
                        <MdBuildCircle size={22} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-slate-900">Sales Pipelines</h1>
                        <p className="text-xs text-slate-500">Configure your deal stages</p>
                    </div>
                </div>
                <button onClick={openCreate} className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/25 flex items-center gap-1.5">
                    <MdAdd size={18} /> New Pipeline
                </button>
            </div>

            {/* Pipeline Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {pipelines.map(pipeline => (
                    <div key={pipeline._id} className="bg-white rounded-2xl border border-slate-100 p-6 hover:shadow-lg transition-all">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <h3 className="text-lg font-black text-slate-900">{pipeline.name}</h3>
                                {pipeline.isDefault && (
                                    <span className="px-2 py-0.5 rounded-lg bg-amber-50 text-amber-700 text-xs font-bold flex items-center gap-1">
                                        <MdStar size={12} /> Default
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-1">
                                <button onClick={() => openEdit(pipeline)} className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-indigo-600"><MdEdit size={18} /></button>
                                <button onClick={() => handleDelete(pipeline._id)} className="p-2 rounded-xl hover:bg-red-50 text-slate-400 hover:text-red-600"><MdDelete size={18} /></button>
                            </div>
                        </div>
                        {pipeline.description && <p className="text-sm text-slate-500 mb-4">{pipeline.description}</p>}

                        {/* Stage Flow */}
                        <div className="flex items-center gap-1 flex-wrap">
                            {pipeline.stages.sort((a, b) => a.sortOrder - b.sortOrder).map((stage, i) => (
                                <React.Fragment key={i}>
                                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold" style={{ backgroundColor: `${stage.color}15`, color: stage.color }}>
                                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: stage.color }} />
                                        {stage.name}
                                        <span className="opacity-60">{stage.probability}%</span>
                                    </div>
                                    {i < pipeline.stages.length - 1 && <span className="text-slate-300 text-xs">→</span>}
                                </React.Fragment>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            {pipelines.length === 0 && (
                <div className="text-center py-20 text-slate-400">
                    <p className="text-lg font-bold mb-2">No pipelines yet</p>
                    <button onClick={openCreate} className="text-indigo-600 font-bold hover:underline">Create your first pipeline</button>
                </div>
            )}

            {/* Create/Edit Modal */}
            <Modal
                isOpen={showForm}
                onClose={() => setShowForm(false)}
                title={editId ? 'Edit Pipeline' : 'New Pipeline'}
                maxWidth="max-w-2xl"
                footer={
                    <>
                        <button onClick={() => setShowForm(false)} className="w-full sm:w-auto px-6 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50">Cancel</button>
                        <button onClick={handleSave} className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-600/25 flex items-center justify-center gap-1.5">
                            <MdSave size={16} /> Save Pipeline
                        </button>
                    </>
                }
            >
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Name *</label>
                            <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
                        </div>
                        <div className="flex items-end">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" checked={form.isDefault} onChange={e => setForm({ ...form, isDefault: e.target.checked })}
                                    className="rounded border-slate-300 text-indigo-600" />
                                <span className="text-sm font-bold text-slate-700">Set as default</span>
                            </label>
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Description</label>
                        <input type="text" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
                    </div>

                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <label className="text-xs font-bold text-slate-500 uppercase">Stages</label>
                            <button onClick={addStage} className="text-xs font-bold text-indigo-600 hover:underline flex items-center gap-1"><MdAdd size={14} /> Add Stage</button>
                        </div>
                        <div className="space-y-2">
                            {form.stages.map((stage, i) => (
                                <div key={i} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                                    <span className="text-xs font-bold text-slate-400 w-5">{i + 1}</span>
                                    <input type="color" value={stage.color} onChange={e => updateStage(i, 'color', e.target.value)}
                                        className="w-8 h-8 rounded-lg cursor-pointer border-0" />
                                    <input type="text" value={stage.name} onChange={e => updateStage(i, 'name', e.target.value)}
                                        placeholder="Stage name" className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-sm" />
                                    <div className="flex items-center gap-1">
                                        <input type="number" value={stage.probability} onChange={e => updateStage(i, 'probability', parseInt(e.target.value) || 0)}
                                            min={0} max={100} className="w-16 px-2 py-2 rounded-lg border border-slate-200 text-sm text-center" />
                                        <span className="text-xs text-slate-400">%</span>
                                    </div>
                                    <button onClick={() => removeStage(i)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600">
                                        <MdClose size={16} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default SalesPipelines;
