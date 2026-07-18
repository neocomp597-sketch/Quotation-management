import React, { useState, useEffect } from 'react';
import { cpqService, productService, customerService } from '../services/api';
import { toast } from 'react-toastify';
import { MdPlayArrow, MdAdd, MdDelete, MdWarning, MdVerifiedUser } from 'react-icons/md';

const QuoteSimulator = () => {
    const [customers, setCustomers] = useState([]);
    const [products, setProducts] = useState([]);
    const [selectedCustomerId, setSelectedCustomerId] = useState('');
    const [selectedCurrency, setSelectedCurrency] = useState('INR');
    const [promoCode, setPromoCode] = useState('');
    
    // Line items inside simulation
    const [simItems, setSimItems] = useState([]);
    const [simulationResult, setSimulationResult] = useState(null);
    const [simulating, setSimulating] = useState(false);

    // Option configurations cache
    const [optionsCache, setOptionsCache] = useState({});

    useEffect(() => {
        fetchMetadata();
    }, []);

    const fetchMetadata = async () => {
        try {
            const [custRes, prodRes] = await Promise.all([
                customerService.getAll({}),
                productService.getAll({})
            ]);
            setCustomers(Array.isArray(custRes.data) ? custRes.data : custRes.data?.data || []);
            setProducts(Array.isArray(prodRes.data) ? prodRes.data : prodRes.data?.data || []);
        } catch (err) {
            console.error("Load simulator meta error:", err);
        }
    };

    const handleAddItem = async () => {
        setSimItems(prev => [
            ...prev,
            { productId: '', quantity: 1, selectedOptions: {}, customOptionsList: [] }
        ]);
    };

    const handleRemoveItem = (index) => {
        setSimItems(prev => prev.filter((_, i) => i !== index));
    };

    const handleItemProductChange = async (index, pId) => {
        if (!pId) return;

        // Fetch option configurations for product
        let optGroups = optionsCache[pId];
        if (!optGroups) {
            try {
                const res = await cpqService.getConfigTemplate(pId);
                optGroups = res.data?.optionGroups || [];
                setOptionsCache(prev => ({ ...prev, [pId]: optGroups }));
            } catch (err) {
                optGroups = [];
            }
        }

        setSimItems(prev => {
            const list = [...prev];
            list[index].productId = pId;
            list[index].customOptionsList = optGroups;
            list[index].selectedOptions = {};
            // Set defaults for options
            optGroups.forEach(g => {
                if (g.options && g.options.length) {
                    list[index].selectedOptions[g.groupName] = g.options[0].label;
                }
            });
            return list;
        });
    };

    const handleItemQtyChange = (index, qty) => {
        setSimItems(prev => {
            const list = [...prev];
            list[index].quantity = Number(qty);
            return list;
        });
    };

    const handleOptionSelect = (itemIdx, groupName, optionLabel) => {
        setSimItems(prev => {
            const list = [...prev];
            list[itemIdx].selectedOptions = {
                ...list[itemIdx].selectedOptions,
                [groupName]: optionLabel
            };
            return list;
        });
    };

    const handleRunSimulation = async () => {
        if (simItems.length === 0) {
            toast.warning("Please add at least one item to simulate");
            return;
        }
        if (simItems.some(i => !i.productId)) {
            toast.warning("Please choose products for all rows");
            return;
        }

        setSimulating(true);
        try {
            const payload = {
                items: simItems.map(item => ({
                    productId: item.productId,
                    quantity: item.quantity,
                    selectedOptions: item.selectedOptions
                })),
                customerId: selectedCustomerId || null,
                targetCurrency: selectedCurrency,
                promoCode: promoCode || null
            };

            const res = await cpqService.simulateQuote(payload);
            setSimulationResult(res.data);
            toast.success("Simulation complete!");
        } catch (err) {
            console.error("Simulation failed:", err);
            toast.error("Failed to run pricing simulation");
        } finally {
            setSimulating(false);
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-black text-slate-900 tracking-tight">CPQ Pricing & Quote Simulator</h1>
                <p className="text-slate-500 font-medium">Sandbox evaluation suite. Run conversions and check margins before locking deals.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Inputs Pane */}
                <div className="lg:col-span-2 space-y-6 bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider mb-2">Simulate Configuration</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Select Customer</label>
                            <select
                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-xs font-semibold cursor-pointer"
                                value={selectedCustomerId}
                                onChange={e => setSelectedCustomerId(e.target.value)}
                            >
                                <option value="">Choose customer...</option>
                                {customers.map(c => (
                                    <option key={c._id} value={c._id}>{c.companyName || c.customerName}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Billing Currency</label>
                            <select
                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-xs font-semibold cursor-pointer"
                                value={selectedCurrency}
                                onChange={e => setSelectedCurrency(e.target.value)}
                            >
                                <option value="INR">INR (₹)</option>
                                <option value="USD">USD ($)</option>
                                <option value="AED">AED (Dh)</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Coupon Promo Code</label>
                            <input
                                type="text"
                                placeholder="e.g. MONSOON50"
                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-xs font-semibold uppercase tracking-wider"
                                value={promoCode}
                                onChange={e => setPromoCode(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Simulation Line Items */}
                    <div className="space-y-4 pt-4 border-t border-slate-50">
                        <div className="flex justify-between items-center">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Simulator Products</span>
                            <button
                                onClick={handleAddItem}
                                className="flex items-center gap-0.5 text-xs font-black text-primary-600 uppercase tracking-wider hover:underline"
                            >
                                <MdAdd size={16} /> Add Product
                            </button>
                        </div>

                        {simItems.length === 0 ? (
                            <div className="text-center py-12 text-slate-400 text-xs font-bold bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                                Click "Add Product" to compile simulation rows.
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {simItems.map((item, index) => (
                                    <div key={index} className="p-5 bg-slate-50 rounded-3xl border border-slate-100 space-y-4">
                                        <div className="flex gap-4 items-center justify-between">
                                            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <select
                                                    required
                                                    className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl outline-none text-xs font-bold"
                                                    value={item.productId}
                                                    onChange={e => handleItemProductChange(index, e.target.value)}
                                                >
                                                    <option value="">Choose product...</option>
                                                    {products.map(p => (
                                                        <option key={p._id} value={p._id}>{p.productName} ({p.productCode})</option>
                                                    ))}
                                                </select>
                                                <input
                                                    type="number"
                                                    required
                                                    placeholder="Qty"
                                                    min="1"
                                                    className="px-4 py-2 bg-white border border-slate-200 rounded-xl outline-none text-xs font-semibold"
                                                    value={item.quantity}
                                                    onChange={e => handleItemQtyChange(index, e.target.value)}
                                                />
                                            </div>
                                            <button onClick={() => handleRemoveItem(index)} className="text-slate-400 hover:text-rose-600">
                                                <MdDelete size={18} />
                                            </button>
                                        </div>

                                        {/* Render Options Selectors */}
                                        {item.customOptionsList && item.customOptionsList.length > 0 && (
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-white p-3.5 rounded-2xl border border-slate-100">
                                                {item.customOptionsList.map(group => (
                                                    <div key={group.groupName}>
                                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">{group.groupName}</span>
                                                        <select
                                                            value={item.selectedOptions[group.groupName] || ''}
                                                            onChange={e => handleOptionSelect(index, group.groupName, e.target.value)}
                                                            className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold outline-none cursor-pointer"
                                                        >
                                                            {group.options.map(o => (
                                                                <option key={o.label} value={o.label}>{o.label} (+{o.priceModifier})</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="flex justify-end pt-4 border-t border-slate-50">
                        <button
                            onClick={handleRunSimulation}
                            disabled={simulating}
                            className="flex items-center gap-1.5 bg-primary-600 hover:bg-primary-700 text-white font-bold text-xs uppercase tracking-widest px-6 py-3 rounded-xl shadow-lg shadow-primary-600/20 active:scale-95 transition-all"
                        >
                            <MdPlayArrow size={18} /> Run Simulator
                        </button>
                    </div>
                </div>

                {/* Outputs Panel */}
                <div className="space-y-6">
                    <div className="bg-slate-900 rounded-[2rem] p-6 text-white space-y-6 shadow-2xl relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-tr from-primary-600/20 to-accent/20 opacity-40 pointer-events-none" />
                        
                        <h3 className="text-sm font-black uppercase tracking-wider relative z-10">Simulation Results</h3>

                        {simulationResult ? (
                            <div className="space-y-6 relative z-10">
                                <div className="space-y-1">
                                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Simulated Grand Total</span>
                                    <h2 className="text-3xl font-black">{simulationResult.currency} {Number(simulationResult.grandTotal).toLocaleString()}</h2>
                                </div>

                                {/* Margin Indicator Ring / HUD */}
                                <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
                                    <div className="flex justify-between text-xs font-bold text-slate-400">
                                        <span>Margin Enforcements Status</span>
                                        <span className={`font-black uppercase tracking-widest ${simulationResult.marginRisk === 'Blocked' ? 'text-rose-500' : simulationResult.marginRisk === 'High' ? 'text-amber-500' : 'text-emerald-500'}`}>
                                            {simulationResult.marginRisk}
                                        </span>
                                    </div>

                                    {/* Simulated Risk Warners */}
                                    {simulationResult.isBlocked ? (
                                        <div className="p-3 bg-rose-600/20 border border-rose-500/30 rounded-xl flex items-start gap-2 text-xs font-bold text-rose-400">
                                            <MdWarning size={18} className="shrink-0" />
                                            <span>Negative margins detected. Quotation locks save operations.</span>
                                        </div>
                                    ) : simulationResult.requiresApproval ? (
                                        <div className="p-3 bg-amber-600/20 border border-amber-500/30 rounded-xl flex items-start gap-2 text-xs font-bold text-amber-400">
                                            <MdWarning size={18} className="shrink-0" />
                                            <span>Low margins detected. Requires Sales Manager approval logs before finalization.</span>
                                        </div>
                                    ) : (
                                        <div className="p-3 bg-emerald-600/20 border border-emerald-500/30 rounded-xl flex items-start gap-2 text-xs font-bold text-emerald-400">
                                            <MdVerifiedUser size={18} className="shrink-0" />
                                            <span>Margin satisfies platform compliance bounds. Clean pass.</span>
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-3">
                                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Calculated Items breakdown</span>
                                    <div className="space-y-2 max-h-[200px] overflow-y-auto custom-scrollbar">
                                        {simulationResult.items.map((item, idx) => (
                                            <div key={idx} className="p-3 bg-white/5 rounded-xl border border-white/5 flex justify-between items-center text-xs">
                                                <div>
                                                    <div className="font-extrabold text-white">{item.productName}</div>
                                                    <div className="text-[10px] text-slate-400 mt-0.5">Source: {item.priceSource}</div>
                                                </div>
                                                <div className="text-right font-black text-white">
                                                    {item.currency} {Number(item.taxableAmount).toLocaleString()}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-12 text-slate-400 text-xs font-bold relative z-10">
                                Set configuration parameters on the left and run simulation.
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default QuoteSimulator;
