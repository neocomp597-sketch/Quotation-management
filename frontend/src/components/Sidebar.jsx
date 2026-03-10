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
    MdCategory
} from 'react-icons/md';

const Sidebar = ({ isOpen, toggleSidebar }) => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const isAdmin = user.role === 'admin';

    const menuItems = [
        { name: 'Dashboard', icon: <MdDashboard size={22} />, path: '/dashboard' },
        ...(isAdmin ? [{ name: 'Salespersons', icon: <MdPeople size={22} />, path: '/salespersons' }] : []),
        { name: 'Customers', icon: <MdPeople size={22} />, path: '/customers' },
        { name: 'Products', icon: <MdInventory size={22} />, path: '/products' },
        { name: 'MGR Master', icon: <MdCategory size={22} />, path: '/mgrs' },
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
                className={`fixed top-0 left-0 h-full bg-[#f0fdfa] text-slate-900 transition-all duration-300 z-50 shadow-xl 
                border-r border-teal-100 transform ${isOpen ? 'translate-x-0 w-64' : '-translate-x-full md:translate-x-0 md:w-20 w-64'}`}
            >
                <div className="flex items-center justify-between h-20 px-4 border-b border-teal-50">
                    <div className={`flex items-center gap-3 overflow-hidden transition-all duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 w-0 md:opacity-0 md:w-0'}`}>
                        <div className="p-2 bg-primary-600 rounded-lg shrink-0">
                            <MdInventory size={24} className="text-white" />
                        </div>
                        <span className="text-xl font-bold tracking-tight whitespace-nowrap">JAG ERP</span>
                    </div>
                    <button
                        onClick={toggleSidebar}
                        className="p-2 rounded-lg hover:bg-teal-100 text-teal-600 transition-colors ml-auto md:ml-0"
                    >
                        <MdChevronLeft size={24} className={`transition-transform duration-300 ${!isOpen ? 'rotate-180' : ''}`} />
                    </button>
                </div>

                <nav className="mt-6 px-3 space-y-2">
                    {menuItems.map((item) => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            onClick={handleNavClick}
                            className={({ isActive }) =>
                                `flex items-center gap-4 px-3 py-3 rounded-xl transition-all duration-200 group ${isActive
                                    ? 'bg-primary-600 text-white shadow-lg shadow-primary-600/30 ring-1 ring-primary-600'
                                    : 'text-slate-600 hover:bg-teal-100/50 hover:text-primary-700 font-semibold'
                                }`
                            }
                        >
                            <div className={`transition-transform duration-200 group-hover:scale-110 shrink-0`}>
                                {item.icon}
                            </div>
                            <span className={`font-medium transition-all duration-300 whitespace-nowrap ${!isOpen ? 'md:opacity-0 md:w-0' : 'opacity-100'}`}>
                                {item.name}
                            </span>
                            {!isOpen && (
                                <div className="absolute left-full ml-6 px-2 py-1 bg-slate-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap hidden md:block z-50">
                                    {item.name}
                                </div>
                            )}
                        </NavLink>
                    ))}
                </nav>

                <div className="absolute bottom-0 w-full p-4 border-t border-teal-50">
                    <NavLink
                        to="/settings"
                        onClick={handleNavClick}
                        className={({ isActive }) =>
                            `flex items-center gap-4 px-3 py-3 rounded-xl transition-all duration-200 ${isActive
                                ? 'bg-primary-600 text-white shadow-lg shadow-primary-600/30'
                                : 'text-slate-600 hover:bg-teal-100/50 hover:text-primary-700 font-semibold'
                            }`
                        }
                    >
                        <MdSettings size={22} className="shrink-0" />
                        <span className={`font-medium transition-all duration-300 whitespace-nowrap ${!isOpen ? 'md:opacity-0 md:w-0' : 'opacity-100'}`}>
                            Settings
                        </span>
                    </NavLink>
                </div>
            </div>
        </>
    );
};

export default Sidebar;
