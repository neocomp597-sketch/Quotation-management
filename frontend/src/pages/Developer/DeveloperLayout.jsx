import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { 
    MdCode, MdVpnKey, MdBook, MdWebhook, MdWarning, 
    MdSpeed, MdListAlt, MdRocketLaunch, MdShield, MdArrowBack,
    MdSearch, MdChevronRight, MdFolder
} from 'react-icons/md';

const navGroups = [
    {
        title: 'GET STARTED',
        items: [
            { path: '/developer/overview', label: 'Overview', icon: MdRocketLaunch },
            { path: '/developer/quick-start', label: 'Quick Start Guide', icon: MdCode },
            { path: '/developer/authentication', label: 'Authentication & Scopes', icon: MdShield },
            { path: '/developer/api-keys', label: 'API Access Keys', icon: MdVpnKey },
        ]
    },
    {
        title: 'SYSTEM API REFERENCE',
        items: [
            { path: '/developer/api-reference', label: 'API Explorer & Sandbox', icon: MdBook },
        ]
    },
    {
        title: 'DEVELOPER GUIDES',
        items: [
            { path: '/developer/webhooks', label: 'Webhooks & Events', icon: MdWebhook },
            { path: '/developer/errors', label: 'Errors & Status Codes', icon: MdWarning },
            { path: '/developer/rate-limits', label: 'Rate Limits & Quotas', icon: MdSpeed },
            { path: '/developer/logs', label: 'API Audit Logs', icon: MdListAlt },
        ]
    }
];

const DeveloperLayout = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [searchQuery, setSearchQuery] = useState('');
    const [env, setEnv] = useState('production');

    return (
        <div className="min-h-screen bg-[#f8fafc] text-slate-900 flex flex-col font-sans">
            {/* Top Bar Header */}
            <header className="bg-white border-b border-slate-200 sticky top-0 z-50 px-6 py-3.5 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-4">
                    <button 
                        onClick={() => navigate('/settings')}
                        className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-all border border-slate-200"
                        title="Back to Settings"
                    >
                        <MdArrowBack size={18} />
                    </button>

                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#006c49] to-[#10b981] flex items-center justify-center text-white shadow-md font-black">
                            <MdCode size={22} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="font-black tracking-tight text-lg text-slate-900">ARCRM</span>
                                <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-md bg-[#006c49]/10 text-[#006c49] border border-[#006c49]/20">
                                    API Portal
                                </span>
                            </div>
                            <p className="text-[11px] text-slate-500 font-semibold">Enterprise REST API Platform</p>
                        </div>
                    </div>
                </div>

                {/* Center Quick Search */}
                <div className="hidden lg:flex items-center w-80 bg-slate-100 px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium">
                    <MdSearch size={18} className="text-slate-400 mr-2 shrink-0" />
                    <input
                        type="text"
                        placeholder="Search APIs, endpoints, parameters..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="bg-transparent w-full outline-none text-slate-800 placeholder-slate-400"
                    />
                </div>

                {/* Right Environment & Actions */}
                <div className="flex items-center gap-3">
                    <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-mono font-bold">
                        <button
                            onClick={() => setEnv('production')}
                            className={`px-3 py-1 rounded-lg transition-all ${env === 'production' ? 'bg-[#006c49] text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                        >
                            Live (v1)
                        </button>
                        <button
                            onClick={() => setEnv('sandbox')}
                            className={`px-3 py-1 rounded-lg transition-all ${env === 'sandbox' ? 'bg-amber-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                        >
                            Sandbox
                        </button>
                    </div>

                    <button 
                        onClick={() => navigate('/developer/api-keys')}
                        className="px-4 py-2 rounded-xl bg-[#006c49] hover:bg-[#005237] text-white font-black text-xs uppercase tracking-wider transition-all shadow-md shadow-[#006c49]/20 flex items-center gap-1.5 active:scale-95"
                    >
                        <MdVpnKey size={16} />
                        <span>API Access Keys</span>
                    </button>
                </div>
            </header>

            {/* Main Content Layout */}
            <div className="flex-1 flex max-w-7xl w-full mx-auto">
                {/* Sidebar Navigation */}
                <aside className="w-64 bg-white border-r border-slate-200 p-5 hidden md:block shrink-0 space-y-6 shadow-sm">
                    {navGroups.map(group => (
                        <div key={group.title} className="space-y-1">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-3 mb-2 flex items-center gap-1">
                                <MdFolder size={12} className="text-slate-400" />
                                <span>{group.title}</span>
                            </p>
                            {group.items.map(item => {
                                const Icon = item.icon;
                                const isActive = location.pathname === item.path;
                                return (
                                    <NavLink
                                        key={item.path}
                                        to={item.path}
                                        className={({ isActive }) => 
                                            `flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                                                isActive 
                                                    ? 'bg-[#006c49]/10 text-[#006c49] border border-[#006c49]/20 shadow-sm font-black' 
                                                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                                            }`
                                        }
                                    >
                                        <div className="flex items-center gap-3">
                                            <Icon size={18} />
                                            <span>{item.label}</span>
                                        </div>
                                        {isActive && <MdChevronRight size={16} className="text-[#006c49]" />}
                                    </NavLink>
                                );
                            })}
                        </div>
                    ))}
                </aside>

                {/* Viewport View */}
                <main className="flex-1 p-6 md:p-8 overflow-y-auto">
                    <Outlet />
                </main>
            </div>
        </div>
    );
};

export default DeveloperLayout;
