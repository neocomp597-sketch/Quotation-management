import React from 'react';
import { NavLink } from 'react-router-dom';
import {
    MdDashboard,
    MdPeople,
    MdInventory,
    MdDescription,
    MdSettings,
    MdChevronLeft,
    MdAssignment,
    MdCategory,
    MdAutoGraph,
    MdAnalytics,
    MdStorefront,
    MdReceipt
} from 'react-icons/md';

const Sidebar = ({ isOpen, toggleSidebar }) => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const isAdmin = user.role === 'admin';

    const menuItems = [
        { name: 'Dashboard', icon: <MdDashboard size={22} />, path: '/dashboard' },
        ...(isAdmin ? [{ name: 'Salespersons', icon: <MdPeople size={22} />, path: '/salespersons' }] : []),
        { name: 'Customers', icon: <MdPeople size={22} />, path: '/customers' },
        { name: 'Vendors', icon: <MdStorefront size={22} />, path: '/vendors' },
        { name: 'Products', icon: <MdInventory size={22} />, path: '/products' },
        { name: 'Vouchers', icon: <MdReceipt size={22} />, path: '/vouchers' },
        { name: 'MGR Master', icon: <MdCategory size={22} />, path: '/mgrs' },
        { name: 'Simulations', icon: <MdAutoGraph size={22} />, path: '/simulations' },
        { name: 'Reports', icon: <MdAnalytics size={22} />, path: '/reports' },
        { name: 'Quotations', icon: <MdDescription size={22} />, path: '/quotations' },
        { name: 'Terms & Conditions', icon: <MdAssignment size={22} />, path: '/terms' },
    ];

    // Handle closing sidebar on mobile when a link is clicked
    const handleNavClick = () => {
        if (window.innerWidth < 768) {
            toggleSidebar();
        }
    };

    return (
        <>
            {/* Mobile Backdrop */}
            <div
                className={`fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 transition-opacity duration-300 md:hidden ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                onClick={toggleSidebar}
            />

        <div
            className={`fixed top-0 left-0 h-full bg-white transition-all duration-300 z-50 shadow-2xl 
            border-r border-slate-100 transform flex flex-col ${isOpen ? 'translate-x-0 w-64' : '-translate-x-full md:translate-x-0 md:w-20 w-64'}`}
        >
            <div className="flex items-center justify-between h-20 px-6 border-b border-slate-50 shrink-0">
                <div className={`flex items-center gap-3 overflow-hidden transition-all duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 w-0 md:opacity-0 md:w-0'}`}>
                    <div className="w-10 h-10 bg-gradient-to-br from-primary-600 to-accent rounded-xl flex items-center justify-center shadow-lg shadow-primary-600/30 shrink-0">
                        <span className="text-white font-black text-xl">Q</span>
                    </div>
                    <span className="text-xl font-black tracking-tighter whitespace-nowrap text-slate-900 font-outfit uppercase">JAG ERP</span>
                </div>
                <button
                    onClick={toggleSidebar}
                    className="p-2 rounded-xl hover:bg-slate-50 text-slate-400 hover:text-primary-600 transition-all ml-auto md:ml-0"
                >
                    <MdChevronLeft size={24} className={`transition-transform duration-300 ${!isOpen ? 'rotate-180' : ''}`} />
                </button>
            </div>

            <nav className="flex-1 overflow-y-auto overflow-x-hidden py-8 px-4 space-y-2 custom-scrollbar">
                {menuItems.map((item) => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        onClick={handleNavClick}
                        className={({ isActive }) =>
                            `flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all duration-200 group relative ${isActive
                                ? 'bg-primary-600 text-white shadow-xl shadow-primary-600/25 ring-1 ring-white/10'
                                : 'text-slate-500 hover:bg-slate-50 hover:text-primary-600 font-semibold'
                            }`
                        }
                    >
                        <div className={`transition-transform duration-300 group-hover:scale-110 shrink-0`}>
                            {item.icon}
                        </div>
                        <span className={`font-bold transition-all duration-300 whitespace-nowrap ${!isOpen ? 'md:opacity-0 md:w-0' : 'opacity-100'}`}>
                            {item.name}
                        </span>
                        {!isOpen && (
                            <div className="absolute left-full ml-6 px-3 py-2 bg-slate-900 text-white text-xs font-bold rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-200 translate-x-3 group-hover:translate-x-0 whitespace-nowrap hidden md:block z-50 shadow-xl">
                                {item.name}
                            </div>
                        )}
                    </NavLink>
                ))}
            </nav>

            <div className="p-4 border-t border-slate-50 shrink-0 bg-white">
                <NavLink
                    to="/settings"
                    onClick={handleNavClick}
                    className={({ isActive }) =>
                        `flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all duration-200 ${isActive
                            ? 'bg-slate-900 text-white shadow-xl shadow-slate-900/20'
                            : 'text-slate-500 hover:bg-slate-50 hover:text-primary-600 font-semibold'
                        }`
                    }
                >
                    <MdSettings size={22} className="shrink-0" />
                    <span className={`font-bold transition-all duration-300 whitespace-nowrap ${!isOpen ? 'md:opacity-0 md:w-0' : 'opacity-100'}`}>
                        Settings
                    </span>
                </NavLink>
            </div>
        </div>

        </>
    );
};

export default Sidebar;
