import React, { useState, useMemo, useEffect } from 'react';
import { 
    MdAnalytics, 
    MdTrendingUp, 
    MdAttachMoney, 
    MdCalculate, 
    MdInfo, 
    MdRefresh,
    MdSettings,
    MdTableChart,
    MdAutoGraph,
    MdElectricBolt
} from 'react-icons/md';
import { 
    LineChart, 
    Line, 
    XAxis, 
    YAxis, 
    CartesianGrid, 
    Tooltip, 
    ResponsiveContainer,
    AreaChart,
    Area,
    PieChart,
    Pie,
    Cell
} from 'recharts';
import { motion, AnimatePresence, useSpring, useTransform } from 'framer-motion';

const AnimatedNumber = ({ value }) => {
    const spring = useSpring(value, { stiffness: 100, damping: 30 });
    const [display, setDisplay] = useState(value);

    useEffect(() => {
        spring.set(value);
    }, [value, spring]);

    useEffect(() => {
        return spring.on('change', (latest) => {
            setDisplay(Math.round(latest));
        });
    }, [spring]);

    return <span>{display.toLocaleString()}</span>;
};

const Simulations = () => {
    const [basePrice, setBasePrice] = useState(25000);
    const [discount, setDiscount] = useState(15);
    const [cost, setCost] = useState(12000);
    const [taxRate, setTaxRate] = useState(18);
    const [quantity, setQuantity] = useState(1);

    // Calculated Values
    const results = useMemo(() => {
        const discountAmount = (basePrice * discount) / 100;
        const netPrice = basePrice - discountAmount;
        const taxAmount = (netPrice * taxRate) / 100;
        const finalPrice = netPrice + taxAmount;
        const totalRevenue = finalPrice * quantity;
        const totalProfit = (netPrice - cost) * quantity;
        const margin = ((netPrice - cost) / netPrice) * 100;
        const winProb = Math.min(95, 20 + (discount * 1.8) - (discount * discount * 0.015));

        return {
            netPrice,
            finalPrice,
            totalRevenue,
            totalProfit,
            margin,
            winProb,
            taxAmount
        };
    }, [basePrice, discount, cost, taxRate, quantity]);

    const probabilityData = useMemo(() => {
        return Array.from({ length: 11 }, (_, i) => {
            const d = i * 5;
            const p = Math.min(95, 20 + (d * 1.8) - (d * d * 0.015));
            return { discount: `${d}%`, probability: Math.round(p) };
        });
    }, []);

    const pieData = [
        { name: 'Cost', value: cost, color: '#94a3b8' },
        { name: 'Profit', value: Math.max(0, results.netPrice - cost), color: '#10b981' },
        { name: 'Discount', value: (basePrice * discount) / 100, color: '#f59e0b' }
    ];

    return (
        <div className="min-h-screen pb-20 space-y-12">
            {/* Header with Glassmorphism */}
            <div className="relative p-10 rounded-[3rem] overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-r from-primary-600/10 via-accent/5 to-emerald-500/10 opacity-50 blur-3xl group-hover:opacity-100 transition-opacity duration-1000"></div>
                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-12 h-12 bg-white rounded-2xl shadow-premium flex items-center justify-center text-primary-600">
                                <MdAutoGraph size={28} />
                            </div>
                            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-primary-500/70">Intelligence Module</span>
                        </div>
                        <h1 className="text-5xl font-black text-slate-900 tracking-tight font-outfit uppercase">Optimization Sandbox</h1>
                        <p className="text-slate-500 font-bold text-lg mt-2">Simulate pricing strategies with JAG Strategic Engine V2</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <button onClick={() => { setBasePrice(25000); setDiscount(15); setCost(12000); }} 
                                className="group p-4 bg-white border border-slate-100 rounded-3xl text-slate-400 hover:text-primary-600 hover:shadow-xl transition-all active:scale-90">
                            <MdRefresh size={24} className="group-hover:rotate-180 transition-transform duration-500" />
                        </button>
                        <button className="flex items-center gap-3 bg-slate-900 text-white px-8 py-5 rounded-[2rem] font-black transition-all shadow-2xl shadow-slate-900/40 uppercase text-xs tracking-widest hover:-translate-y-1 active:scale-95">
                            <MdElectricBolt size={20} className="text-amber-400" />
                            Optimize Portfolio
                        </button>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 px-4">
                {/* Left Panel: Inputs */}
                <div className="lg:col-span-4 space-y-8">
                    <div className="p-1.5 bg-gradient-to-b from-white to-slate-100 border border-slate-200 rounded-[3.5rem] shadow-premium">
                        <div className="bg-white p-10 rounded-[3rem] space-y-10">
                            <div className="flex items-center gap-3">
                                <MdSettings className="text-primary-600" size={24} />
                                <h2 className="text-sm font-black uppercase tracking-[0.2em] text-slate-900">Variables</h2>
                            </div>

                            <div className="space-y-8">
                                <div className="space-y-4">
                                    <div className="flex justify-between items-end">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Base Price</label>
                                        <span className="text-2xl font-black text-slate-900">₹<AnimatedNumber value={basePrice} /></span>
                                    </div>
                                    <input type="range" min="1000" max="100000" step="500" value={basePrice} onChange={(e) => setBasePrice(Number(e.target.value))}
                                           className="w-full h-2 bg-slate-100 rounded-full appearance-none cursor-pointer accent-primary-600" />
                                </div>

                                <div className="space-y-4">
                                    <div className="flex justify-between items-end">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Discount</label>
                                        <span className="text-2xl font-black text-amber-500"><AnimatedNumber value={discount} />%</span>
                                    </div>
                                    <input type="range" min="0" max="50" step="1" value={discount} onChange={(e) => setDiscount(Number(e.target.value))}
                                           className="w-full h-2 bg-slate-100 rounded-full appearance-none cursor-pointer accent-amber-500" />
                                </div>

                                <div className="space-y-4">
                                    <div className="flex justify-between items-end">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Unit Cost</label>
                                        <span className="text-2xl font-black text-slate-400">₹<AnimatedNumber value={cost} /></span>
                                    </div>
                                    <input type="range" min="500" max="80000" step="100" value={cost} onChange={(e) => setCost(Number(e.target.value))}
                                           className="w-full h-2 bg-slate-100 rounded-full appearance-none cursor-pointer accent-slate-300" />
                                </div>

                                <div className="grid grid-cols-2 gap-6 pt-6 border-t border-slate-50">
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Quantity</label>
                                        <input type="number" value={quantity} onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
                                               className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-4 focus:ring-primary-500/10 font-black text-slate-900" />
                                    </div>
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tax (GST)</label>
                                        <input type="number" value={taxRate} onChange={(e) => setTaxRate(Number(e.target.value))}
                                               className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-4 focus:ring-primary-500/10 font-black text-slate-900" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Panel: Results & Analytics */}
                <div className="lg:col-span-8 space-y-10">
                    {/* Top Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <motion.div layout initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                                    className="p-8 bg-gradient-to-br from-primary-600 via-accent to-emerald-500 rounded-[3rem] text-white shadow-2xl shadow-primary-500/20 relative overflow-hidden h-48">
                            <MdAttachMoney className="absolute -bottom-4 -right-4 text-white/10" size={140} />
                            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80 mb-4">Total Revenue</h3>
                            <div className="text-4xl font-black font-outfit tracking-tighter">₹<AnimatedNumber value={Math.round(results.totalRevenue)} /></div>
                            <div className="mt-4 text-[10px] font-bold bg-white/15 px-3 py-1.5 rounded-full w-fit backdrop-blur-md border border-white/10">Incl. ₹{Math.round(results.taxAmount).toLocaleString()} tax</div>
                        </motion.div>

                        <motion.div layout initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                                    className="p-8 bg-white border border-slate-100 rounded-[3rem] shadow-premium h-48 relative overflow-hidden group">
                            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Net Profit Margin</h3>
                            <div className="text-4xl font-black text-emerald-600 font-outfit tracking-tighter">{results.margin.toFixed(1)}%</div>
                            <div className="absolute bottom-0 left-0 w-full h-2 bg-slate-50 overflow-hidden">
                                <motion.div className="h-full bg-emerald-500 shadow-[0_0_15px_#10b981]" initial={{ width: 0 }} animate={{ width: `${Math.min(100, Math.max(0, results.margin))}%` }} />
                            </div>
                        </motion.div>

                        <motion.div layout initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                                    className="p-8 bg-white border border-slate-100 rounded-[3rem] shadow-premium h-48 relative overflow-hidden">
                            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Win Probability</h3>
                            <div className="text-4xl font-black text-slate-900 font-outfit tracking-tighter">{Math.round(results.winProb)}%</div>
                            <div className="mt-4 flex items-center gap-2">
                                <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                                    <motion.div className="h-full bg-primary-500 shadow-[0_0_15px_#14b8a6]" initial={{ width: 0 }} animate={{ width: `${results.winProb}%` }} />
                                </div>
                            </div>
                        </motion.div>
                    </div>

                    {/* Performance Recommendation Card - THE BEAUTY PART */}
                    <div className="relative p-1 bg-gradient-to-br from-indigo-500 via-primary-500 to-emerald-400 rounded-[3.5rem] shadow-2xl shadow-primary-500/30 overflow-hidden">
                        <div className="bg-slate-950/95 backdrop-blur-2xl p-12 rounded-[3.4rem] text-white relative">
                            {/* Animated Ambient Light */}
                            <motion.div animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0.4, 0.2] }} transition={{ duration: 10, repeat: Infinity }}
                                        className="absolute top-0 right-0 w-80 h-80 bg-primary-600 rounded-full blur-[120px] -translate-x-12 -translate-y-24" />
                            <motion.div animate={{ scale: [1, 1.3, 1], opacity: [0.1, 0.3, 0.1] }} transition={{ duration: 15, repeat: Infinity }}
                                        className="absolute bottom-0 left-0 w-80 h-80 bg-emerald-500 rounded-full blur-[120px] translate-x-12 translate-y-24" />
                            
                            <div className="relative z-10 flex flex-col xl:flex-row items-center gap-14">
                                <div className="flex-1 space-y-6">
                                    <div className="flex items-center gap-4">
                                        <div className="w-16 h-1 bg-gradient-to-r from-primary-500 to-transparent rounded-full"></div>
                                        <span className="text-[11px] font-black uppercase tracking-[0.4em] text-primary-400">JAG Strategic Engine V2</span>
                                    </div>
                                    <h3 className="text-4xl font-black font-outfit leading-tight tracking-tight">Strategic Recommendation</h3>
                                    <p className="text-slate-400 font-medium text-xl leading-relaxed">
                                        {results.margin < 15 
                                            ? "Critical margin alert. Your current pricing strategy for these fittings risks capital erosion. Recommend reducing discount to 8-12% zone." 
                                            : results.discount > 25 
                                            ? "Hyper-aggressive positioning confirmed. Market capture probability is maxed out, but ensure unit velocity compensates for slim margins."
                                            : "Optimal conversion strategy detected. Balanced approach captures 88% of target market while maintaining premium inventory health."}
                                    </p>
                                </div>
                                <div className="shrink-0 group relative">
                                    {/* Score Ring with Glow */}
                                    <div className="absolute inset-0 bg-primary-500 rounded-full blur-[40px] opacity-20 group-hover:opacity-50 transition-all duration-700"></div>
                                    <div className="w-48 h-48 rounded-full border-[14px] border-white/5 flex items-center justify-center relative bg-slate-900/50 backdrop-blur-xl">
                                        <div className="text-center">
                                            <p className="text-[12px] font-black uppercase tracking-[0.2em] text-slate-500 mb-1">Score</p>
                                            <p className="text-6xl font-black text-white font-outfit"><AnimatedNumber value={Math.round((results.margin * 2 + results.winProb) / 3)} /></p>
                                        </div>
                                        <svg className="absolute inset-0 -rotate-90 w-full h-full p-1">
                                            <circle cx="92" cy="92" r="82" stroke="url(#scoreGradient)" strokeWidth="14" fill="transparent" strokeLinecap="round" strokeDasharray="515.2" 
                                                    strokeDashoffset={515.2 - (515.2 * Math.round((results.margin * 2 + results.winProb) / 3)) / 100} className="transition-all duration-1000 ease-out" />
                                            <defs>
                                                <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                                    <stop offset="0%" stopColor="#10b981" />
                                                    <stop offset="100%" stopColor="#6366f1" />
                                                </linearGradient>
                                            </defs>
                                        </svg>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Charts Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                        <div className="bg-white p-10 rounded-[3.5rem] border border-slate-100 shadow-premium">
                            <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest mb-10">Profit Ecosystem</h3>
                            <div className="h-64">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie data={pieData} innerRadius={70} outerRadius={100} paddingAngle={10} dataKey="value" stroke="none">
                                            {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                                        </Pie>
                                        <Tooltip contentStyle={{ borderRadius: '1.5rem', border: 'none', boxShadow: 'var(--shadow-lg)' }} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="flex justify-center gap-6 mt-6">
                                {pieData.map(d => (
                                    <div key={d.name} className="flex items-center gap-2">
                                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }}></div>
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{d.name}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="bg-white p-10 rounded-[3.5rem] border border-slate-100 shadow-premium">
                            <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest mb-10">Winning Curve</h3>
                            <div className="h-64">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={probabilityData}>
                                        <defs>
                                            <linearGradient id="probGrad" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.3}/>
                                                <stop offset="95%" stopColor="#14b8a6" stopOpacity={0}/>
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                        <XAxis dataKey="discount" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 800, fill: '#cbd5e1' }} />
                                        <Tooltip contentStyle={{ borderRadius: '1.5rem', border: 'none', boxShadow: 'var(--shadow-lg)' }} />
                                        <Area type="monotone" dataKey="probability" stroke="#14b8a6" strokeWidth={4} fill="url(#probGrad)" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Simulations;
