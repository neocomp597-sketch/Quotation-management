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
    MdMap,
    MdAdminPanelSettings,
    MdNewReleases,
    MdContactPhone,
    MdViewKanban,
    MdTrendingUp,
    MdFlag,
    MdTimeline,
    MdBuildCircle,
    MdSpeed,
    MdPayments,
    MdTag,
    MdList,
    MdSecurity,
    MdCheckCircle,
    MdAssessment,
    MdClose
} from 'react-icons/md';
import { useAuth } from '../context/AuthContext';

const Sidebar = ({ isOpen, toggleSidebar }) => {
    const location = useLocation();
    const { isAdmin, isSuperAdmin, hasAccess } = useAuth();

    const [expanded, setExpanded] = useState({});

    const toggleMenu = (key) => {
        setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
    };

    const isPathActive = (childPath) => {
        try {
            const childUrl = new URL(childPath, window.location.origin);
            if (location.pathname !== childUrl.pathname) return false;
            if (childUrl.search) {
                return location.search === childUrl.search;
            }
            return !location.search;
        } catch {
            return false;
        }
    };

    const isChildActive = (children) => {
        return children.some((child) => {
            try {
                const childUrl = new URL(child.path, window.location.origin);
                if (location.pathname === childUrl.pathname) {
                    if (childUrl.search) {
                        return location.search === childUrl.search;
                    }
                    return !location.search;
                }
                if (childUrl.pathname !== '/dashboard' && location.pathname.startsWith(childUrl.pathname + '/')) {
                    return true;
                }
                return false;
            } catch {
                return false;
            }
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
                { key: 'payroll_employees', name: 'Employees', icon: <MdPeople size={18} />, path: '/payroll/employees' },
                { key: 'payroll_employees', name: 'Payroll Masters', icon: <MdCategory size={18} />, path: '/payroll/masters' },
                { key: 'master_vendors', name: 'Vendors', icon: <MdStorefront size={18} />, path: '/vendors' },
                { key: 'master_contacts', name: 'Contacts', icon: <MdContactPhone size={18} />, path: '/contacts' },
                { key: 'sales_deals', name: 'Deals', icon: <MdViewKanban size={18} />, path: '/sales/deals' },
                { key: 'master_products', name: 'Products', icon: <MdInventory size={18} />, path: '/products' },
                { key: 'master_territories', name: 'Territory Master', icon: <MdMap size={18} />, path: '/territory-master' },
                { key: 'csm_masters', name: 'Engineers Master', icon: <MdBuildCircle size={18} />, path: '/csm/masters?tab=engineers' },
                { key: 'master_mgrs', name: 'MGR Master', icon: <MdCategory size={18} />, path: '/mgrs' },
                { key: 'master_attributes', name: 'Attributes', icon: <MdAssignment size={18} />, path: '/attributes' },
                { key: 'master_terms', name: 'Terms & Conditions', icon: <MdDescription size={18} />, path: '/terms' },
                { key: 'master_statuses', name: 'Status Master', icon: <MdBarChart size={18} />, path: '/status-master', adminOnly: true },
                { key: 'master_serials', name: 'Serial No. Master', icon: <MdTag size={18} />, path: '/serial-no-master' },
            ]
        },
        {
            type: 'group',
            name: 'Payroll',
            key: 'payroll',
            icon: <MdCalendarMonth size={22} />,
            children: [
                { key: 'payroll_runs', name: 'Overview', icon: <MdDashboard size={18} />, path: '/payroll/dashboard' },
                { key: 'payroll_runs', name: 'Run Payroll', icon: <MdReceipt size={18} />, path: '/payroll/runs' },
                { key: 'payroll_payments', name: 'Payments', icon: <MdReceipt size={18} />, path: '/payroll/payments' },
                { key: 'payroll_runs', name: 'Payslips', icon: <MdReceipt size={18} />, path: '/payroll/payslips' },
                { key: 'payroll_letters', name: 'Letters', icon: <MdDescription size={18} />, path: '/payroll/letters' },
                { key: 'payroll_settings', name: 'Settings', icon: <MdSettings size={18} />, path: '/payroll/settings' }
            ]
        },
        {
            type: 'group',
            name: 'Enquiry',
            key: 'enquiry',
            icon: <MdAssignment size={22} />,
            children: [
                { key: 'enquiry_leads', name: 'Enquiry Register', icon: <MdAssignment size={18} />, path: '/enquiries' },
                { key: 'enquiry_analytics', name: 'Analytics', icon: <MdAnalytics size={18} />, path: '/enquiries/analytics' },
            ]
        },
        {
            type: 'group',
            name: 'Sales Pipeline',
            key: 'sales_pipeline',
            icon: <MdViewKanban size={22} />,
            children: [
                { key: 'sales_dashboard', name: 'Overview', icon: <MdDashboard size={18} />, path: '/sales/dashboard' },
                { key: 'sales_pipelines', name: 'Pipelines', icon: <MdBuildCircle size={18} />, path: '/sales/pipelines', adminOnly: true },
                { key: 'sales_forecasting', name: 'Forecasting', icon: <MdTrendingUp size={18} />, path: '/sales/forecasting' },
                { key: 'sales_activities', name: 'Activities', icon: <MdTimeline size={18} />, path: '/sales/activities' },
                { key: 'sales_targets', name: 'Targets', icon: <MdFlag size={18} />, path: '/sales/targets' },
            ]
        },
        {
            type: 'group',
            name: 'Appointments',
            key: 'meetings',
            icon: <MdCalendarMonth size={22} />,
            children: [
                { key: 'meetings_list', name: 'Appointments Register', icon: <MdCalendarMonth size={18} />, path: '/meetings' },
            ]
        },
        {
            type: 'group',
            name: 'Catalog & Price Masters',
            key: 'cpq_masters',
            icon: <MdFolderOpen size={22} />,
            children: [
                { key: 'sales_price_management', name: 'Price Books', icon: <MdDescription size={18} />, path: '/sales/price-management/price-books' },
                { key: 'sales_price_management', name: 'Pricing Rules', icon: <MdAssignment size={18} />, path: '/sales/price-management/pricing-rules' },
                { key: 'sales_price_management', name: 'Discount Policies', icon: <MdReceipt size={18} />, path: '/sales/price-management/discounts' },
                { key: 'sales_price_management', name: 'Promotions', icon: <MdNewReleases size={18} />, path: '/sales/price-management/promotions' },
                { key: 'sales_price_management', name: 'Currency Rates', icon: <MdTrendingUp size={18} />, path: '/sales/price-management/currencies' },
            ]
        },
        {
            type: 'group',
            name: 'Quotation Management',
            key: 'quotation',
            icon: <MdRequestQuote size={22} />,
            children: [
                { key: 'quotation_list', name: 'Quotation Register', icon: <MdDescription size={18} />, path: '/quotations' },
                { key: 'quotation_list', name: 'Pending Quotations', icon: <MdLock size={18} />, path: '/quotations?status=pending_approval' },
                { key: 'quotation_list', name: 'Approved Quotations', icon: <MdCheckCircle size={18} />, path: '/quotations?status=final' },
                { key: 'quotation_list', name: 'Rejected Quotations', icon: <MdClose size={18} />, path: '/quotations?status=rejected' },
                { key: 'reports_main', name: 'Quote Conversion Report', icon: <MdAssessment size={18} />, path: '/quotations/conversion-report' },
                { key: 'sales_cpq', name: 'Guided Selling', icon: <MdPeople size={18} />, path: '/sales/cpq/guided-selling' },
                { key: 'sales_cpq', name: 'Configurator', icon: <MdBuildCircle size={18} />, path: '/sales/cpq/configurator' },
                { key: 'sales_cpq', name: 'Quote Simulator', icon: <MdSpeed size={18} />, path: '/sales/cpq/simulator' },
                { key: 'sale_invoices', name: 'Invoices', icon: <MdReceipt size={18} />, path: '/invoices' },
                { key: 'sales_approvals', name: 'Approvals', icon: <MdLock size={18} />, path: '/sales/approvals' },
                { key: 'sales_orders', name: 'Orders', icon: <MdShoppingCart size={18} />, path: '/sales/orders' },
            ]
        },
        {
            type: 'group',
            name: 'Contract Management',
            key: 'clm',
            icon: <MdAssignment size={22} />,
            children: [
                { key: 'sales_contracts', name: 'Dashboard', icon: <MdDashboard size={18} />, path: '/sales/contracts/dashboard' },
                { key: 'sales_contracts', name: 'Contracts', icon: <MdList size={18} />, path: '/sales/contracts/list' },
                { key: 'sales_contracts', name: 'Templates', icon: <MdFolderOpen size={18} />, path: '/sales/contracts/templates' },
                { key: 'sales_contracts', name: 'Clauses Library', icon: <MdSecurity size={18} />, path: '/sales/contracts/clauses' },
                { key: 'sales_contracts', name: 'Approvals Queue', icon: <MdCheckCircle size={18} />, path: '/sales/contracts/approvals' },
                { key: 'sales_contracts', name: 'Renewals Kanban', icon: <MdViewKanban size={18} />, path: '/sales/contracts/renewals' },
                { key: 'sales_contracts', name: 'Reports', icon: <MdAssessment size={18} />, path: '/sales/contracts/reports' },
                { key: 'sales_contracts', name: 'Settings', icon: <MdSettings size={18} />, path: '/sales/contracts/settings' },
            ]
        },

        {
            type: 'group',
            name: 'Material Received',
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
            name: 'Customer Service',
            key: 'csm',
            icon: <MdBuildCircle size={22} />,
            children: [
                { key: 'csm_dashboard', name: 'CSM Dashboard', icon: <MdDashboard size={18} />, path: '/csm/dashboard' },
                { key: 'csm_tickets', name: 'Tickets Register', icon: <MdAssignment size={18} />, path: '/csm/tickets' },
                { key: 'csm_visits', name: 'Service Visits', icon: <MdLocalShipping size={18} />, path: '/csm/visits' },
                { key: 'csm_warranties_amc', name: 'Warranty & AMC', icon: <MdStorefront size={18} />, path: '/csm/warranties-amc' },
                { key: 'csm_kb', name: 'Knowledge Base', icon: <MdDescription size={18} />, path: '/csm/kb' },
                { key: 'csm_masters', name: 'CSM Config', icon: <MdSettings size={18} />, path: '/csm/masters' },
                { key: 'csm_reports', name: 'Service Reports', icon: <MdAnalytics size={18} />, path: '/csm/reports' },
            ]
        },
        {
            type: 'group',
            name: 'Reports',
            key: 'reports',
            icon: <MdBarChart size={22} />,
            children: [
                { key: 'reports_main', name: 'Reports', icon: <MdBarChart size={18} />, path: '/reports' },
                { key: 'payroll_reports', name: 'Payroll Reports', icon: <MdBarChart size={18} />, path: '/payroll/reports' },
                { key: 'sales_reports', name: 'Sales Reports', icon: <MdBarChart size={18} />, path: '/sales/reports' },
                { key: 'sales_analytics', name: 'Sales Analytics', icon: <MdSpeed size={18} />, path: '/sales/analytics' },
                { key: 'sales_revenue_analytics', name: 'Revenue Analytics', icon: <MdAnalytics size={18} />, path: '/sales/revenue-analytics' },
                { key: 'sales_competitors', name: 'Competitor Intel', icon: <MdFlag size={18} />, path: '/sales/competitors' },
                { key: 'sales_ai_pricing', name: 'AI Pricing Insights', icon: <MdAutoGraph size={18} />, path: '/sales/ai-pricing' },
            ]
        },
        {
            type: 'group',
            name: 'Admin',
            key: 'admin',
            icon: <MdLock size={22} />,
            children: [
                { key: 'admin_authorization', name: 'Authorization', icon: <MdLock size={18} />, path: '/admin/authorization' },
                ...(isAdmin || isSuperAdmin ? [
                    { key: 'admin_salespersons', name: 'Salespersons', icon: <MdPeople size={18} />, path: '/salespersons', adminOnly: true }
                ] : []),
            ]
        },
        ...(isSuperAdmin ? [{
            type: 'group',
            name: 'Platform',
            key: 'platform',
            icon: <MdAdminPanelSettings size={22} />,
            children: [
                { key: 'super_admin_console', name: 'Super Admin', icon: <MdAdminPanelSettings size={18} />, path: '/super-admin', superAdminOnly: true },
            ],
        }] : []),
    ].map((item) => {
        if (item.type !== 'group') return item;

        return {
            ...item,
            children: item.children.filter((child) => {
                if (child.superAdminOnly) return isSuperAdmin;
                return child.adminOnly ? (isAdmin || isSuperAdmin) : hasAccess(child.key);
            }),
        };
    }).filter((item) => {
        if (item.type === 'link') {
            if (item.superAdminOnly) return isSuperAdmin;
            return item.adminOnly ? (isAdmin || isSuperAdmin) : hasAccess(item.key);
        }
        return item.children.length > 0 || hasAccess(item.key);
    });

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
                                    className={() => {
                                        const active = isPathActive(item.path);
                                        return `flex items-center gap-4 px-4 py-3 rounded-2xl transition-all duration-200 group relative ${active
                                            ? 'bg-primary-600 text-white shadow-xl shadow-primary-600/25 ring-1 ring-white/10'
                                            : 'text-slate-500 hover:bg-slate-50 hover:text-primary-600 font-semibold'
                                        }`;
                                    }}
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
                                    className={`w-full flex items-center gap-4 px-4 py-3 rounded-2xl transition-all duration-200 group relative ${hasActiveChild
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
                                                className={() => {
                                                    const active = isPathActive(child.path);
                                                    return `flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group ${active
                                                        ? 'bg-primary-600 text-white shadow-lg shadow-primary-600/20'
                                                        : 'text-slate-500 hover:bg-slate-50 hover:text-primary-600'
                                                    }`;
                                                }}
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

                <div className="p-3 border-t border-slate-50 shrink-0 bg-white space-y-1">
                    {isSuperAdmin && (
                        <NavLink
                            to="/system-updates"
                            onClick={handleNavClick}
                            className={({ isActive }) =>
                                `flex items-center gap-4 px-4 py-3 rounded-2xl transition-all duration-200 ${isActive
                                    ? 'bg-primary-600 text-white shadow-xl shadow-primary-600/25 ring-1 ring-white/10'
                                    : 'text-slate-500 hover:bg-slate-50 hover:text-primary-600 font-semibold'
                                }`
                            }
                        >
                            <MdNewReleases size={22} className="shrink-0" />
                            <span className={`font-bold transition-all duration-300 whitespace-nowrap ${!isOpen ? 'md:opacity-0 md:w-0' : 'opacity-100'}`}>
                                Updates
                            </span>
                        </NavLink>
                    )}

                    {hasAccess('settings_profile') && (
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
                    )}
                </div>
            </div>
        </>
    );
};

export default Sidebar;
