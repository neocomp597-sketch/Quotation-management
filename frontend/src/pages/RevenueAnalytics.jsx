import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell } from 'recharts';
import { MdTrendingUp, MdTrendingDown, MdOutlinePriceCheck, MdAttachMoney } from 'react-icons/md';

const RevenueAnalytics = () => {
    const bookPerfData = [
        { name: 'Contract', Revenue: 1840000, Margin: 35 },
        { name: 'Customer', Revenue: 1450000, Margin: 28 },
        { name: 'Project', Revenue: 950000, Margin: 25 },
        { name: 'Region', Revenue: 620000, Margin: 22 },
        { name: 'Standard', Revenue: 410000, Margin: 18 }
    ];

    const discountTrendData = [
        { month: 'Jan', TotalDiscount: 45000, LostMargin: 12 },
        { month: 'Feb', TotalDiscount: 52000, LostMargin: 14 },
        { month: 'Mar', TotalDiscount: 38000, LostMargin: 10 },
        { month: 'Apr', TotalDiscount: 70000, LostMargin: 18 },
        { month: 'May', TotalDiscount: 62000, LostMargin: 15 },
        { month: 'Jun', TotalDiscount: 95000, LostMargin: 22 }
    ];

    const COLORS = ['#6366F1', '#10B981', '#F59E0B', '#3B82F6', '#EF4444'];

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-black text-slate-900 tracking-tight font-outfit uppercase">Revenue & Pricing Analytics</h1>
                <p className="text-slate-500 font-medium">Realtime dashboard monitoring margins, leakages, and discount policy aggregates.</p>
            </div>

            {/* Top Cards HUD */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {[
                    { title: "Price Book Performance", value: "₹ 52,70,000", icon: <MdAttachMoney size={24} />, trend: "+12.4% MoM", isUp: true },
                    { title: "Margin Leakages", value: "₹ 3,97,000", icon: <MdTrendingDown size={24} />, trend: "-3.2% MoM", isUp: false },
                    { title: "Average Quote Margin", value: "25.6 %", icon: <MdOutlinePriceCheck size={24} />, trend: "+1.8% MoM", isUp: true },
                    { title: "Approvals Locked Ratio", value: "14.2 %", icon: <MdTrendingUp size={24} />, trend: "Steady", isUp: true }
                ].map((hud, idx) => (
                    <div key={idx} className="p-6 bg-white rounded-3xl border border-slate-100 shadow-sm space-y-3">
                        <div className="flex justify-between items-center text-slate-400">
                            <span className="text-[10px] font-black uppercase tracking-widest">{hud.title}</span>
                            <div className="p-2 bg-slate-50 rounded-xl text-slate-600">{hud.icon}</div>
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-slate-900">{hud.value}</h2>
                            <p className={`text-[10px] font-bold mt-1 uppercase ${hud.isUp ? 'text-emerald-600' : 'text-rose-600'}`}>
                                {hud.trend}
                            </p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Graphs row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Book Performance chart */}
                <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-4">
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">Revenue by Price Book Type</h3>
                    <div className="h-[280px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={bookPerfData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="name" stroke="#94A3B8" fontSize={12} tickLine={false} />
                                <YAxis stroke="#94A3B8" fontSize={12} tickLine={false} />
                                <Tooltip cursor={{ fill: 'rgba(0,0,0,0.02)' }} />
                                <Bar dataKey="Revenue" fill="#6366F1" radius={[8, 8, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Leakage charts */}
                <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-4">
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">Discount Leakage & Margin Trends</h3>
                    <div className="h-[280px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={discountTrendData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="month" stroke="#94A3B8" fontSize={12} />
                                <YAxis stroke="#94A3B8" fontSize={12} />
                                <Tooltip />
                                <Area type="monotone" dataKey="TotalDiscount" stroke="#10B981" fill="rgba(16, 185, 129, 0.1)" strokeWidth={2} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RevenueAnalytics;
