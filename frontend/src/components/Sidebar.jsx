import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
    MdDashboard,
    MdPeople,
    MdInventory,
    MdDescription,
    MdSettings,
    MdChevronLeft,
    MdExpandMore,
    MdExpandLess,
    MdFolderOpen,
    MdPointOfSale,
    MdRequestQuote,
    MdBarChart,
    MdAssignment,
    MdCategory,
    MdAutoGraph,
    MdAnalytics,
    MdStorefront,
    MdReceipt,
    MdShoppingCart,
    MdLocalShipping,
    MdCalendarMonth,
    MdLock,
    MdMap
} from 'react-icons/md';
import { useAuth } from '../context/AuthContext';

const Sidebar = ({ isOpen, toggleSidebar }) => {
    const location = useLocation();
    const { isAdmin, hasAccess } = useAuth();

    const [expanded, setExpanded] = useState({});

    const toggleMenu = (key) => {
        setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
    };

    const isChildActive = (children) => {
        return children.some((child) => {
            if (location.pathname === child.path) return true;
            if (child.path !== '/dashboard' && location.pathname.startsWith(child.path + '/')) return true;
            return false;
        });
    };

    const menuStructure = [
        {
            type: 'link',
            key: 'dashboard_overview',
            name: 'Dashboard',
            icon: <MdDashboard size={22} />,
            path: '/dashboard'
        },
        {
            type: 'group',
            name: 'Master',
            key: 'master',
            icon: <MdFolderOpen size={22} />,
            children: [
                { key: 'master_customers', name: 'Customers', icon: <MdPeople size={18} />, path: '/customers' },
                { key: 'master_vendors', name: 'Vendors', icon: <MdStorefront size={18} />, path: '/vendors' },
                { key: 'master_products', name: 'Products', icon: <MdInventory size={18} />, path: '/products' },
                { key: 'master_territories', name: 'Territory Master', icon: <MdMap size={18} />, path: '/territory-master' },
                { key: 'master_mgrs', name: 'MGR Master', icon: <MdCategory size={18} />, path: '/mgrs' },
                { key: 'master_attributes', name: 'Attributes', icon: <MdAssignment size={18} />, path: '/attributes' },
                { key: 'master_terms', name: 'Terms & Conditions', icon: <MdDescription size={18} />, path: '/terms' },
                { key: 'master_statuses', name: 'Status Master', icon: <MdBarChart size={18} />, path: '/status-master', adminOnly: true },
            ]
        },
        {
            type: 'group',
            name: 'Enquiry',
            key: 'enquiry',
            icon: <MdAssignment size={22} />,
            children: [
                { key: 'enquiry_leads', name: 'Leads & Enquiries', icon: <MdAssignment size={18} />, path: '/enquiries' },
                { key: 'enquiry_analytics', name: 'Analytics', icon: <MdAnalytics size={18} />, path: '/enquiries/analytics' },
            ]
        },
        {
            type: 'group',
            name: 'Sales',
            key: 'quotation',
            icon: <MdRequestQuote size={22} />,
            children: [
                { key: 'quotation_list', name: 'Quotations', icon: <MdDescription size={18} />, path: '/quotations' },
                { key: 'sale_invoices', name: 'Create Invoice', icon: <MdReceipt size={18} />, path: '/invoices' },
            ]
        },
        {
            type: 'group',
            name: 'Material Received',
            key: 'sale',
            icon: <MdPointOfSale size={22} />,
            children: []
        },
        {
            type: 'group',
            name: 'Purchase',
            key: 'purchase',
            icon: <MdShoppingCart size={22} />,
            children: [
                { key: 'purchase_grn', name: 'GRN', icon: <MdLocalShipping size={18} />, path: '/grn' },
            ]
        },
        {
            type: 'group',
            name: 'Planning',
            key: 'planning',
            icon: <MdCalendarMonth size={22} />,
            children: [
                { key: 'planning_screen', name: 'Planning Screen', icon: <MdCalendarMonth size={18} />, path: '/planning' },
                { key: 'planning_simulations', name: 'Simulations', icon: <MdAutoGraph size={18} />, path: '/simulations' },
            ]
        },
        {
            type: 'group',
            name: 'Reports',
            key: 'reports',
            icon: <MdBarChart size={22} />,
            children: [
                { key: 'reports_main', name: 'Reports', icon: <MdBarChart size={18} />, path: '/reports' },
            ]
        },
        {
            type: 'group',
            name: 'Admin',
            key: 'admin',
            icon: <MdLock size={22} />,
            children: [
                { key: 'admin_authorization', name: 'Authorization', icon: <MdLock size={18} />, path: '/admin/authorization' },
                ...(isAdmin ? [
                    { key: 'admin_salespersons', name: 'Salespersons', icon: <MdPeople size={18} />, path: '/salespersons', adminOnly: true }
                ] : []),
            ]
        },
    ].map((item) => {
        if (item.type !== 'group') return item;

        return {
            ...item,
            children: item.children.filter((child) => child.adminOnly ? isAdmin : hasAccess(child.key)),
        };
    }).filter((item) => item.type === 'link' ? (item.adminOnly ? isAdmin : hasAccess(item.key)) : item.children.length > 0 || hasAccess(item.key));

    const getAutoExpanded = (key, children) => {
        if (expanded[key] !== undefined) return expanded[key];
        return isChildActive(children);
    };

    const handleNavClick = () => {
        if (window.innerWidth < 768) {
            toggleSidebar();
        }
    };

    return (
        <>
            <div
                className={`fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 transition-opacity duration-300 md:hidden ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                onClick={toggleSidebar}
            />

            <div
                className={`fixed top-0 left-0 h-full bg-white transition-all duration-300 z-50 shadow-2xl border-r border-slate-100 transform flex flex-col ${isOpen ? 'translate-x-0 w-64' : '-translate-x-full md:translate-x-0 md:w-20 w-64'}`}
            >
                <div className="flex items-center justify-between h-20 px-6 border-b border-slate-50 shrink-0">
                    <div className={`flex items-center gap-3 overflow-hidden transition-all duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 w-0 md:opacity-0 md:w-0'}`}>
                        <div className="w-10 h-10 bg-gradient-to-br from-primary-600 to-accent rounded-xl flex items-center justify-center shadow-lg shadow-primary-600/30 shrink-0">
                            <span className="text-white font-black text-xl">A</span>
                        </div>
                        <div className="whitespace-nowrap text-slate-900 font-outfit uppercase">
                            <p className="text-lg font-black tracking-tighter">ARCRM</p>
                            <p className="text-[10px] font-bold text-slate-500 -mt-1">Always Ready CRM</p>
                        </div>
                    </div>
                    <button
                        onClick={toggleSidebar}
                        className="p-2 rounded-xl hover:bg-slate-50 text-slate-400 hover:text-primary-600 transition-all ml-auto md:ml-0"
                    >
                        <MdChevronLeft size={24} className={`transition-transform duration-300 ${!isOpen ? 'rotate-180' : ''}`} />
                    </button>
                </div>

                <nav className="flex-1 overflow-y-auto overflow-x-hidden py-4 px-3 space-y-1 custom-scrollbar">
                    {menuStructure.map((item) => {
                        if (item.type === 'link') {
                            return (
                                <NavLink
                                    key={item.path}
                                    to={item.path}
                                    onClick={handleNavClick}
                                    className={({ isActive }) =>
                                        `flex items-center gap-4 px-4 py-3 rounded-2xl transition-all duration-200 group relative ${isActive
                                            ? 'bg-primary-600 text-white shadow-xl shadow-primary-600/25 ring-1 ring-white/10'
                                            : 'text-slate-500 hover:bg-slate-50 hover:text-primary-600 font-semibold'
                                        }`
                                    }
                                >
                                    <div className="transition-transform duration-300 group-hover:scale-110 shrink-0">
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
                            );
                        }

                        const isExpanded = getAutoExpanded(item.key, item.children);
                        const hasActiveChild = isChildActive(item.children);

                        return (
                            <div key={item.key}>
                                <button
                                    onClick={() => {
                                        if (isOpen) {
                                            toggleMenu(item.key);
                                        }
                                    }}
                                    className={`w-full flex items-center gap-4 px-4 py-3 rounded-2xl transition-all duration-200 group relative ${
                                        hasActiveChild
                                            ? 'text-primary-600 bg-primary-50'
                                            : 'text-slate-500 hover:bg-slate-50 hover:text-primary-600'
                                    }`}
                                >
                                    <div className="transition-transform duration-300 group-hover:scale-110 shrink-0">
                                        {item.icon}
                                    </div>
                                    <span className={`font-bold transition-all duration-300 whitespace-nowrap flex-1 text-left ${!isOpen ? 'md:opacity-0 md:w-0' : 'opacity-100'}`}>
                                        {item.name}
                                    </span>
                                    {isOpen && (
                                        <span className="text-slate-400 shrink-0">
                                            {isExpanded ? <MdExpandLess size={18} /> : <MdExpandMore size={18} />}
                                        </span>
                                    )}
                                    {!isOpen && (
                                        <div className="absolute left-full ml-6 px-3 py-2 bg-slate-900 text-white text-xs font-bold rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-200 translate-x-3 group-hover:translate-x-0 whitespace-nowrap hidden md:block z-50 shadow-xl">
                                            {item.name}
                                        </div>
                                    )}
                                </button>

                                {isOpen && isExpanded && (
                                    <div className="ml-4 mt-1 space-y-0.5 border-l-2 border-slate-100 pl-3">
                                        {item.children.map((child) => (
                                            <NavLink
                                                key={child.path}
                                                to={child.path}
                                                onClick={handleNavClick}
                                                className={({ isActive }) =>
                                                    `flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group ${isActive
                                                        ? 'bg-primary-600 text-white shadow-lg shadow-primary-600/20'
                                                        : 'text-slate-500 hover:bg-slate-50 hover:text-primary-600'
                                                    }`
                                                }
                                            >
                                                <div className="shrink-0">{child.icon}</div>
                                                <span className="text-sm font-semibold whitespace-nowrap">{child.name}</span>
                                            </NavLink>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </nav>

                {hasAccess('settings_profile') && (
                    <div className="p-3 border-t border-slate-50 shrink-0 bg-white">
                        <NavLink
                            to="/settings"
                            onClick={handleNavClick}
                            className={({ isActive }) =>
                                `flex items-center gap-4 px-4 py-3 rounded-2xl transition-all duration-200 ${isActive
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
                )}
            </div>
        </>
    );
};

export default Sidebar;
