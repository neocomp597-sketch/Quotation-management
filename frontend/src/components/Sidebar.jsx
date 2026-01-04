import React from 'react';
import { NavLink } from 'react-router-dom';
import {
    MdDashboard,
    MdPeople,
    MdInventory,
    MdDescription,
    MdSettings,
    MdChevronLeft,
    MdAssignment
} from 'react-icons/md';

const Sidebar = ({ isOpen, toggleSidebar }) => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const isAdmin = user.role === 'admin';

    const menuItems = [
        { name: 'Dashboard', icon: <MdDashboard size={22} />, path: '/dashboard' },
        ...(isAdmin ? [{ name: 'Salespersons', icon: <MdPeople size={22} />, path: '/salespersons' }] : []),
        { name: 'Customers', icon: <MdPeople size={22} />, path: '/customers' },
        { name: 'Products', icon: <MdInventory size={22} />, path: '/products' },
        { name: 'Quotations', icon: <MdDescription size={22} />, path: '/quotations' },
        { name: 'Terms & Conditions', icon: <MdAssignment size={22} />, path: '/terms' },
    ];

    return (
        <div
            className={`fixed top-0 left-0 h-full bg-slate-900 text-white transition-all duration-300 z-50 ${isOpen ? 'w-64' : 'w-20'
                } shadow-2xl`}
        >
            <div className="flex items-center justify-between h-20 px-4 border-b border-slate-800">
                <div className={`flex items-center gap-3 overflow-hidden transition-all duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 w-0'}`}>
                    <div className="p-2 bg-primary-600 rounded-lg">
                        <MdInventory size={24} className="text-white" />
                    </div>
                    <span className="text-xl font-bold tracking-tight whitespace-nowrap">JAG ERP</span>
                </div>
                <button
                    onClick={toggleSidebar}
                    className="p-2 rounded-lg hover:bg-slate-800 transition-colors"
                >
                    <MdChevronLeft size={24} className={`transition-transform duration-300 ${!isOpen ? 'rotate-180' : ''}`} />
                </button>
            </div>

            <nav className="mt-6 px-3 space-y-2">
                {menuItems.map((item) => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        className={({ isActive }) =>
                            `flex items-center gap-4 px-3 py-3 rounded-xl transition-all duration-200 group ${isActive
                                ? 'bg-primary-600 text-white shadow-lg shadow-primary-900/20'
                                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                            }`
                        }
                    >
                        <div className={`transition-transform duration-200 group-hover:scale-110`}>
                            {item.icon}
                        </div>
                        <span className={`font-medium transition-all duration-300 ${!isOpen ? 'opacity-0 w-0' : 'opacity-100'}`}>
                            {item.name}
                        </span>
                        {!isOpen && (
                            <div className="absolute left-full ml-6 px-2 py-1 bg-slate-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap">
                                {item.name}
                            </div>
                        )}
                    </NavLink>
                ))}
            </nav>

            <div className="absolute bottom-0 w-full p-4 border-t border-slate-800">
                <NavLink
                    to="/settings"
                    className={({ isActive }) =>
                        `flex items-center gap-4 px-3 py-3 rounded-xl transition-all duration-200 ${isActive
                            ? 'bg-primary-600 text-white'
                            : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                        }`
                    }
                >
                    <MdSettings size={22} />
                    <span className={`font-medium transition-all duration-300 ${!isOpen ? 'opacity-0 w-0' : 'opacity-100'}`}>
                        Settings
                    </span>
                </NavLink>
            </div>
        </div>
    );
};

export default Sidebar;
