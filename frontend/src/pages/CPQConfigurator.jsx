import React, { useState, useEffect } from 'react';
import { productService, cpqService } from '../services/api';
import { toast } from 'react-toastify';
import { MdSettings, MdAdd, MdDelete, MdCheck } from 'react-icons/md';

const CPQConfigurator = () => {
    const [products, setProducts] = useState([]);
    const [selectedProductId, setSelectedProductId] = useState('');
    const [template, setTemplate] = useState({ optionGroups: [] });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchProducts();
    }, []);

    const fetchProducts = async () => {
        try {
            const res = await productService.getAll({});
            setProducts(Array.isArray(res.data) ? res.data : res.data?.data || []);
        } catch (err) {
            console.error("Load products error:", err);
        }
    };

    const handleProductChange = async (e) => {
        const pId = e.target.value;
        setSelectedProductId(pId);
        if (!pId) {
            setTemplate({ optionGroups: [] });
            return;
        }
        setLoading(true);
        try {
            const res = await cpqService.getConfigTemplate(pId);
            setTemplate(res.data || { optionGroups: [] });
        } catch (err) {
            toast.error("Failed to load options template");
        } finally {
            setLoading(false);
        }
    };

    const handleAddGroup = () => {
        setTemplate(prev => ({
            ...prev,
            optionGroups: [
                ...(prev.optionGroups || []),
                { groupName: 'New Group Option', type: 'Select', options: [{ label: 'Standard Option', priceModifier: 0, costModifier: 0 }] }
            ]
        }));
    };

    const handleRemoveGroup = (groupIndex) => {
        setTemplate(prev => ({
            ...prev,
            optionGroups: prev.optionGroups.filter((_, i) => i !== groupIndex)
        }));
    };

    const handleAddOption = (groupIndex) => {
        setTemplate(prev => {
            const groups = [...prev.optionGroups];
            groups[groupIndex].options.push({ label: 'New Option Option', priceModifier: 0, costModifier: 0 });
            return { ...prev, optionGroups: groups };
        });
    };

    const handleRemoveOption = (groupIndex, optionIndex) => {
        setTemplate(prev => {
            const groups = [...prev.optionGroups];
            groups[groupIndex].options = groups[groupIndex].options.filter((_, i) => i !== optionIndex);
            return { ...prev, optionGroups: groups };
        });
    };

    const handleGroupFieldChange = (groupIndex, field, value) => {
        setTemplate(prev => {
            const groups = [...prev.optionGroups];
            groups[groupIndex][field] = value;
            return { ...prev, optionGroups: groups };
        });
    };

    const handleOptionFieldChange = (groupIndex, optionIndex, field, value) => {
        setTemplate(prev => {
            const groups = [...prev.optionGroups];
            groups[groupIndex].options[optionIndex][field] = value;
            return { ...prev, optionGroups: groups };
        });
    };

    const handleSaveTemplate = async () => {
        if (!selectedProductId) return;
        try {
            await cpqService.saveConfigTemplate({
                productId: selectedProductId,
                optionGroups: template.optionGroups
            });
            toast.success("Option configurations saved successfully!");
        } catch (err) {
            toast.error("Failed to save templates");
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-black text-slate-900 tracking-tight">CPQ Options Configurator</h1>
                <p className="text-slate-500 font-medium">Build customized configuration matrices for individual equipment and SaaS tools.</p>
            </div>

            <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-6 space-y-6">
                <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Choose Catalog Item to Configure</label>
                    <select
                        className="w-full md:w-[350px] px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-semibold cursor-pointer"
                        value={selectedProductId}
                        onChange={handleProductChange}
                    >
                        <option value="">Choose item...</option>
                        {products.map(p => (
                            <option key={p._id} value={p._id}>{p.productName} ({p.productCode})</option>
                        ))}
                    </select>
                </div>

                {selectedProductId && (
                    <div className="space-y-6 pt-4 border-t border-slate-50">
                        <div className="flex justify-between items-center">
                            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">Option Groups Definitions</h3>
                            <button
                                onClick={handleAddGroup}
                                className="flex items-center gap-1 text-xs font-black text-primary-600 uppercase tracking-wider hover:underline"
                            >
                                <MdAdd size={18} /> Add Group
                            </button>
                        </div>

                        {loading ? (
                            <div className="text-center py-8 text-slate-400 font-bold">Loading configurations...</div>
                        ) : template.optionGroups.length === 0 ? (
                            <div className="text-center py-12 bg-slate-50/50 rounded-2xl text-slate-400 text-xs font-bold border border-dashed border-slate-200">
                                No option groups configured. Click "Add Group" to get started.
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {template.optionGroups.map((group, gIdx) => (
                                    <div key={gIdx} className="p-6 bg-slate-50 rounded-3xl border border-slate-100 space-y-4">
                                        <div className="flex flex-wrap gap-4 items-center justify-between">
                                            <div className="flex gap-4 items-center">
                                                <input
                                                    type="text"
                                                    value={group.groupName}
                                                    onChange={e => handleGroupFieldChange(gIdx, 'groupName', e.target.value)}
                                                    className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm font-bold w-[250px]"
                                                />
                                                <select
                                                    value={group.type}
                                                    onChange={e => handleGroupFieldChange(gIdx, 'type', e.target.value)}
                                                    className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold cursor-pointer"
                                                >
                                                    <option value="Select">Select Dropdown</option>
                                                    <option value="Number">Number Input</option>
                                                    <option value="Boolean">Boolean Check</option>
                                                </select>
                                            </div>
                                            <button
                                                onClick={() => handleRemoveGroup(gIdx)}
                                                className="p-1 text-slate-400 hover:text-rose-600 rounded-lg transition-colors"
                                            >
                                                <MdDelete size={18} />
                                            </button>
                                        </div>

                                        <div className="space-y-2">
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Options Values & Price Overrides</span>
                                                <button
                                                    onClick={() => handleAddOption(gIdx)}
                                                    className="text-[10px] font-black text-primary-600 uppercase tracking-widest hover:underline flex items-center gap-0.5"
                                                >
                                                    <MdAdd size={14} /> Add Option
                                                </button>
                                            </div>

                                            {group.options.map((opt, oIdx) => (
                                                <div key={oIdx} className="flex gap-3 items-center bg-white p-3 border border-slate-100 rounded-xl">
                                                    <input
                                                        type="text"
                                                        placeholder="Option Label"
                                                        value={opt.label}
                                                        onChange={e => handleOptionFieldChange(gIdx, oIdx, 'label', e.target.value)}
                                                        className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-lg text-xs font-semibold"
                                                    />
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs text-slate-400 font-bold">Price +</span>
                                                        <input
                                                            type="number"
                                                            placeholder="Rate"
                                                            value={opt.priceModifier}
                                                            onChange={e => handleOptionFieldChange(gIdx, oIdx, 'priceModifier', Number(e.target.value))}
                                                            className="w-[100px] px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-lg text-xs font-semibold"
                                                        />
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs text-slate-400 font-bold">Cost +</span>
                                                        <input
                                                            type="number"
                                                            placeholder="Cost"
                                                            value={opt.costModifier}
                                                            onChange={e => handleOptionFieldChange(gIdx, oIdx, 'costModifier', Number(e.target.value))}
                                                            className="w-[100px] px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-lg text-xs font-semibold"
                                                        />
                                                    </div>
                                                    <button
                                                        onClick={() => handleRemoveOption(gIdx, oIdx)}
                                                        className="text-slate-400 hover:text-rose-600"
                                                    >
                                                        <MdDelete size={16} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="flex justify-end pt-4 border-t border-slate-50">
                            <button
                                onClick={handleSaveTemplate}
                                className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase tracking-widest px-6 py-3 rounded-xl shadow-lg shadow-emerald-600/20 active:scale-95 transition-all"
                            >
                                <MdCheck size={18} /> Save Options Config
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CPQConfigurator;
