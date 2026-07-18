import React, { useState, useEffect } from 'react';
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from 'recharts';
import { MdAutoGraph, MdTrendingUp, MdInfo, MdCheckCircle, MdCancel, MdWarning, MdLightbulb, MdLocationOn, MdShowChart, MdAttachMoney, MdHelpOutline } from 'react-icons/md';
import { productService, customerService, cpqService } from '../services/api';
import { toast } from 'react-toastify';

const AIPricingInsights = () => {
    const [products, setProducts] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(true);

    // Form inputs for deal simulation
    const [selectedProduct, setSelectedProduct] = useState('');
    const [selectedCustomer, setSelectedCustomer] = useState('');
    const [proposedDiscount, setProposedDiscount] = useState(10);
    const [competitorPresence, setCompetitorPresence] = useState('none'); // 'none', 'higher', 'equal', 'lower'
    const [region, setRegion] = useState('Maharashtra'); // matches customer states
    const [quantity, setQuantity] = useState(1);

    // Simulation outputs
    const [winProbability, setWinProbability] = useState(65);
    const [marginRisk, setMarginRisk] = useState('Low');
    const [marginPercent, setMarginPercent] = useState(25);
    const [recommendedDiscount, setRecommendedDiscount] = useState({ min: 5, target: 8, max: 12 });
    const [aiTips, setAiTips] = useState([]);
    const [similarDeals, setSimilarDeals] = useState([]);
    
    // Chart data for regional benchmarks
    const [regionalData, setRegionalData] = useState([
        { name: 'Maharashtra', AvgDiscount: 8.5, WinRatio: 72 },
        { name: 'Gujarat', AvgDiscount: 9.2, WinRatio: 68 },
        { name: 'Karnataka', AvgDiscount: 7.8, WinRatio: 75 },
        { name: 'Delhi', AvgDiscount: 10.5, WinRatio: 60 },
        { name: 'Tamil Nadu', AvgDiscount: 8.0, WinRatio: 74 },
        { name: 'Telangana', AvgDiscount: 9.0, WinRatio: 70 },
    ]);

    // Radar chart data for deal score dimensions
    const [radarData, setRadarData] = useState([
        { subject: 'Margin Safety', A: 80, fullMark: 100 },
        { subject: 'Price Competitiveness', A: 70, fullMark: 100 },
        { subject: 'Customer History', A: 60, fullMark: 100 },
        { subject: 'Volume Advantage', A: 50, fullMark: 100 },
        { subject: 'Strategic Value', A: 75, fullMark: 100 },
    ]);

    useEffect(() => {
        const loadInitialData = async () => {
            setLoading(true);
            try {
                const [prodRes, custRes] = await Promise.all([
                    productService.getAll({ limit: 100 }),
                    customerService.getAll({ limit: 100 })
                ]);
                const prods = Array.isArray(prodRes.data) ? prodRes.data : prodRes.data?.data || [];
                const custs = Array.isArray(custRes.data) ? custRes.data : custRes.data?.data || [];
                setProducts(prods);
                setCustomers(custs);
                
                if (prods.length > 0) setSelectedProduct(prods[0]._id);
                if (custs.length > 0) {
                    setSelectedCustomer(custs[0]._id);
                    if (custs[0].billingAddress?.state) {
                        setRegion(custs[0].billingAddress.state);
                    }
                }
            } catch (err) {
                console.error('Error loading AI pricing dependencies:', err);
                toast.error('Failed to load products/customers for AI Simulator');
            } finally {
                setLoading(false);
            }
        };
        loadInitialData();
    }, []);

    // Perform analysis whenever inputs change
    useEffect(() => {
        if (!selectedProduct) return;

        const prod = products.find(p => p._id === selectedProduct);
        const cust = customers.find(c => c._id === selectedCustomer);
        if (!prod) return;

        // Base Calculations
        const baseCost = prod.pricing?.baseCost || (prod.basePrice * 0.7) || 1000;
        const sellingPrice = prod.basePrice || 1500;
        const discountedPrice = sellingPrice * (1 - proposedDiscount / 100);
        const marginVal = discountedPrice - baseCost;
        const marginPct = sellingPrice > 0 ? (marginVal / discountedPrice) * 100 : 0;
        setMarginPercent(Math.round(marginPct * 10) / 10);

        // Compute margin risk based on system policies
        let risk = 'Low';
        if (marginPct < 0) risk = 'Blocked';
        else if (marginPct < 5) risk = 'Critical (Director Auth)';
        else if (marginPct < 10) risk = 'High (Manager Auth)';
        else if (marginPct < 15) risk = 'Medium';
        setMarginRisk(risk);

        // Recommend discount range
        let targetDisc = 8;
        if (cust) {
            targetDisc = cust.defaultDiscount || 8;
        }
        setRecommendedDiscount({
            min: Math.max(0, targetDisc - 3),
            target: targetDisc,
            max: Math.min(25, targetDisc + 4)
        });

        // Compute AI Win Probability
        let prob = 70; // starting probability
        
        // Discount factor: higher discount increases probability up to a point, but negative margins flag as 0%
        if (marginPct < 0) {
            prob = 0;
        } else {
            prob += (proposedDiscount - targetDisc) * 2.5;
            
            // Competitor Presence influence
            if (competitorPresence === 'lower') {
                prob -= 25; // hard to win against lower competitor price without discount
            } else if (competitorPresence === 'equal') {
                prob -= 10;
            } else if (competitorPresence === 'higher') {
                prob += 15;
            }

            // Quantity volume bonus
            if (quantity > 10) prob += 5;
            if (quantity > 50) prob += 10;

            // Region average alignment
            const regAvg = regionalData.find(r => r.name === region)?.AvgDiscount || 8;
            if (proposedDiscount < regAvg - 2) {
                prob -= 8; // too high price for local standard
            } else if (proposedDiscount > regAvg + 2) {
                prob += 6; // competitive locally
            }
        }

        // Clamp prob between 0 and 99
        prob = Math.max(0, Math.min(99, Math.round(prob)));
        setWinProbability(prob);

        // Update Radar Metrics based on inputs
        setRadarData([
            { subject: 'Margin Safety', A: Math.max(0, Math.min(100, Math.round(marginPct * 2.5))), fullMark: 100 },
            { subject: 'Price Match', A: Math.max(0, Math.min(100, Math.round(proposedDiscount * 4 + (competitorPresence === 'lower' ? 20 : 50)))), fullMark: 100 },
            { subject: 'Customer History', A: cust ? 75 : 50, fullMark: 100 },
            { subject: 'Volume Factor', A: Math.min(100, 30 + quantity * 2), fullMark: 100 },
            { subject: 'Regional Fit', A: Math.max(0, Math.min(100, 90 - Math.abs(proposedDiscount - (regionalData.find(r => r.name === region)?.AvgDiscount || 8)) * 8)), fullMark: 100 },
        ]);

        // Generate AI Tips
        const tips = [];
        if (marginPct < 0) {
            tips.push({ type: 'error', text: 'Pricing blocks the transaction due to negative profit margins. Increase proposed unit price.' });
        } else if (marginPct < 10) {
            tips.push({ type: 'warn', text: `This margin (${Math.round(marginPct)}%) triggers approval routing. Target a discount below ${Math.round(proposedDiscount - (10 - marginPct))}% to bypass managers.` });
        } else {
            tips.push({ type: 'success', text: 'Profit margins are highly protected. The quote is cleared for automatic checkout without approvals.' });
        }

        if (competitorPresence === 'lower') {
            tips.push({ type: 'info', text: 'Competitor is pricing lower. Instead of giving deep discounts, pitch subscription bundling with 12-month AMC support.' });
        }
        if (quantity > 20) {
            tips.push({ type: 'success', text: 'Bulk order volume justifies the pricing tier. Excellent alignment with wholesale slab rules.' });
        }
        
        const regAvg = regionalData.find(r => r.name === region)?.AvgDiscount || 8;
        if (proposedDiscount > regAvg + 3) {
            tips.push({ type: 'info', text: `Proposed discount is higher than regional average (${regAvg}%). Consider lowering it slightly to protect margin.` });
        }

        setAiTips(tips);

        // Populate Mock similar deals
        setSimilarDeals([
            { client: 'Vasco Pipes Ltd', dealValue: sellingPrice * quantity * 0.9, discount: Math.round(proposedDiscount * 0.9), outcome: 'Won', date: '2 weeks ago' },
            { client: 'Techno Systems', dealValue: sellingPrice * quantity * 0.85, discount: Math.round(proposedDiscount * 1.1), outcome: 'Won', date: '1 month ago' },
            { client: 'Hindustan Heavy Tech', dealValue: sellingPrice * quantity, discount: Math.round(proposedDiscount * 0.5), outcome: 'Lost', date: '2 months ago' }
        ]);

    }, [selectedProduct, selectedCustomer, proposedDiscount, competitorPresence, region, quantity, products, customers]);

    const handleCustomerChange = (e) => {
        const id = e.target.value;
        setSelectedCustomer(id);
        const cust = customers.find(c => c._id === id);
        if (cust?.billingAddress?.state) {
            setRegion(cust.billingAddress.state);
        }
    };

    if (loading) {
        return (
            <div className="p-20 text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-indigo-600 border-t-transparent mb-4"></div>
                <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">AI Models Initializing...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-black text-slate-900 tracking-tight font-outfit uppercase flex items-center gap-3">
                    <MdAutoGraph className="text-indigo-600 animate-pulse" />
                    AI Pricing & Win Insights
                </h1>
                <p className="text-slate-500 font-medium">Predict deal closures, evaluate approval risks, and optimize discounting using predictive models.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Column 1: Configurator Inputs */}
                <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-6 lg:col-span-1">
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-indigo-600"></span>
                        Simulation Parameters
                    </h3>

                    <div className="space-y-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Target Customer</label>
                            <select 
                                value={selectedCustomer} 
                                onChange={handleCustomerChange}
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all"
                            >
                                <option value="">Select Customer...</option>
                                {customers.map(c => (
                                    <option key={c._id} value={c._id}>{c.companyName}</option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Select Product / Asset</label>
                            <select 
                                value={selectedProduct} 
                                onChange={(e) => setSelectedProduct(e.target.value)}
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all"
                            >
                                <option value="">Select Product...</option>
                                {products.map(p => (
                                    <option key={p._id} value={p._id}>{p.productName} (₹{(p.basePrice || 0).toLocaleString()})</option>
                                ))}
                            </select>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Order Quantity</label>
                                <input 
                                    type="number" 
                                    min="1"
                                    value={quantity}
                                    onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Proposed Discount</label>
                                <div className="relative">
                                    <input 
                                        type="number" 
                                        min="0"
                                        max="100"
                                        value={proposedDiscount}
                                        onChange={(e) => setProposedDiscount(Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)))}
                                        className="w-full pr-10 pl-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all"
                                    />
                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">%</span>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Competitor Match Status</label>
                            <select 
                                value={competitorPresence}
                                onChange={(e) => setCompetitorPresence(e.target.value)}
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all"
                            >
                                <option value="none">No Competitors Present</option>
                                <option value="higher">Competitor offers Higher price</option>
                                <option value="equal">Competitor matches our List Price</option>
                                <option value="lower">Competitor offers Lower Price</option>
                            </select>
                        </div>

                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Geographical Region</label>
                            <select 
                                value={region}
                                onChange={(e) => setRegion(e.target.value)}
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all"
                            >
                                <option value="Maharashtra">Maharashtra (West)</option>
                                <option value="Gujarat">Gujarat (West)</option>
                                <option value="Karnataka">Karnataka (South)</option>
                                <option value="Delhi">Delhi (North)</option>
                                <option value="Tamil Nadu">Tamil Nadu (South)</option>
                                <option value="Telangana">Telangana (South)</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Column 2: Dashboard Gauges & Radar */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Win Probability Circular Gauge */}
                        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col items-center justify-center text-center relative overflow-hidden">
                            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest absolute top-6 left-6">Win Probability</h3>
                            
                            <div className="relative flex items-center justify-center h-48 w-48 mt-4">
                                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                                    <circle cx="50" cy="50" r="40" stroke="#F1F5F9" strokeWidth="8" fill="transparent" />
                                    <circle 
                                        cx="50" 
                                        cy="50" 
                                        r="40" 
                                        stroke={winProbability > 70 ? '#10B981' : winProbability > 40 ? '#F59E0B' : '#EF4444'} 
                                        strokeWidth="8" 
                                        fill="transparent" 
                                        strokeDasharray="251.2" 
                                        strokeDashoffset={251.2 - (251.2 * winProbability) / 100}
                                        strokeLinecap="round"
                                        className="transition-all duration-700 ease-out"
                                    />
                                </svg>
                                <div className="absolute flex flex-col items-center justify-center">
                                    <span className="text-4xl font-black text-slate-900">{winProbability}%</span>
                                    <span className="text-[10px] font-black uppercase text-slate-400 mt-1 tracking-wider">Likelihood</span>
                                </div>
                            </div>

                            <div className="w-full grid grid-cols-2 gap-4 mt-6 pt-6 border-t border-slate-100 text-left">
                                <div>
                                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Margin Grade</div>
                                    <div className="text-sm font-black text-slate-900 mt-0.5">{marginPercent}% Profit</div>
                                </div>
                                <div>
                                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Approval Risk</div>
                                    <span className={`inline-block text-xs font-black px-2 py-0.5 rounded mt-0.5 ${
                                        marginRisk.includes('Low') ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                                        marginRisk.includes('Medium') ? 'bg-amber-50 text-amber-700 border border-amber-100' : 'bg-rose-50 text-rose-700 border border-rose-100'
                                    }`}>
                                        {marginRisk}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Radar Analysis */}
                        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col items-center justify-center">
                            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest self-start mb-2">Deal Balance Matrix</h3>
                            <div className="h-56 w-full flex items-center justify-center">
                                <ResponsiveContainer width="100%" height="100%">
                                    <RadarChart cx="50%" cy="50%" outerRadius="75%" data={radarData}>
                                        <PolarGrid stroke="#F1F5F9" />
                                        <PolarAngleAxis dataKey="subject" stroke="#64748B" fontSize={9} />
                                        <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} stroke="#E2E8F0" />
                                        <Radar name="Deal Score" dataKey="A" stroke="#6366F1" fill="#6366F1" fillOpacity={0.2} />
                                    </RadarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>

                    {/* AI Recommendation Engine HUD */}
                    <div className="bg-slate-900 text-white p-6 rounded-[2rem] shadow-xl space-y-4 relative overflow-hidden">
                        <div className="absolute top-0 right-0 h-40 w-40 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
                        <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                            <MdLightbulb className="text-yellow-400" size={18} />
                            AI Copilot Recommendations
                        </h3>

                        <div className="space-y-3">
                            {aiTips.map((tip, idx) => (
                                <div key={idx} className="flex gap-3 items-start text-xs leading-relaxed text-slate-300">
                                    <div className="mt-0.5 flex-shrink-0">
                                        {tip.type === 'error' && <MdCancel className="text-rose-500" size={16} />}
                                        {tip.type === 'warn' && <MdWarning className="text-amber-500" size={16} />}
                                        {tip.type === 'success' && <MdCheckCircle className="text-emerald-400" size={16} />}
                                        {tip.type === 'info' && <MdInfo className="text-indigo-400" size={16} />}
                                    </div>
                                    <p>{tip.text}</p>
                                </div>
                            ))}
                            {aiTips.length === 0 && (
                                <p className="text-xs text-slate-500">Configure parameters above to trigger recommendation algorithms.</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Bottom Row: Similar Historical Deals & Regional Benchmarks */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Similar Historical Deals */}
                <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-4">
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">Similar Historical Match List</h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50/80 text-slate-400 uppercase font-black tracking-widest border-b border-slate-100">
                                <tr>
                                    <th className="px-4 py-3">Client</th>
                                    <th className="px-4 py-3">Deal Value</th>
                                    <th className="px-4 py-3">Discount Applied</th>
                                    <th className="px-4 py-3">Outcome</th>
                                    <th className="px-4 py-3">Closed</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                                {similarDeals.map((deal, idx) => (
                                    <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-4 py-4 font-bold text-slate-900">{deal.client}</td>
                                        <td className="px-4 py-4">₹{(deal.dealValue).toLocaleString()}</td>
                                        <td className="px-4 py-4">{deal.discount}%</td>
                                        <td className="px-4 py-4">
                                            <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-black ${
                                                deal.outcome === 'Won' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-rose-50 text-rose-700 border border-rose-100'
                                            }`}>
                                                {deal.outcome}
                                            </span>
                                        </td>
                                        <td className="px-4 py-4 text-slate-400">{deal.date}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Regional Average Discount Benchmarks */}
                <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-4">
                    <div className="flex justify-between items-center">
                        <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">Regional Discount Benchmarks</h3>
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest flex items-center gap-1">
                            <MdLocationOn /> Average Discount Applied
                        </span>
                    </div>

                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={regionalData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                                <XAxis dataKey="name" stroke="#94A3B8" fontSize={11} tickLine={false} />
                                <YAxis stroke="#94A3B8" fontSize={11} tickLine={false} label={{ value: 'Discount %', angle: -90, position: 'insideLeft', style: { fontSize: 10, fill: '#64748B', fontWeight: 700 } }} />
                                <Tooltip cursor={{ fill: 'rgba(99, 102, 241, 0.03)' }} />
                                <Bar dataKey="AvgDiscount" fill="#818CF8" radius={[6, 6, 0, 0]}>
                                    {/* Highlight selected region */}
                                    {regionalData.map((entry, idx) => (
                                        <Cell 
                                            key={`cell-${idx}`} 
                                            fill={entry.name === region ? '#4F46E5' : '#818CF8'} 
                                        />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AIPricingInsights;
