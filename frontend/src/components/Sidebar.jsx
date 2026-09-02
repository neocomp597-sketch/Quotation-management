import React, { useState, useEffect, useMemo } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
    MdDashboard,
    MdPeople,
    MdInventory,
    MdDescription,
    MdSettings,
    MdAccountTree,
    MdChevronLeft,
    MdChevronRight,
    MdMenu,
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
    MdLocationCity,
    MdBusiness,
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
    MdCompareArrows,
    MdTune,
    MdFactCheck,
    MdNotificationsActive,
    MdList,
    MdSecurity,
    MdCheckCircle,
    MdAssessment,
    MdClose
} from 'react-icons/md';
import { useAuth } from '../context/AuthContext';
import { companySettingsService } from '../services/api';
import { resolveImageUrl } from '../utils/helpers';

const Sidebar = ({ isOpen, toggleSidebar }) => {
    const location = useLocation();
    const { user, isAdmin, isSuperAdmin, hasAccess } = useAuth();

    const [expanded, setExpanded] = useState({});
    const [brandSettings, setBrandSettings] = useState(null);

    useEffect(() => {
        const fetchBranding = async () => {
            try {
                const res = await companySettingsService.get();
                if (res.data) setBrandSettings(res.data);
            } catch (e) { /* ignore */ }
        };
        fetchBranding();

        window.addEventListener('brandingUpdated', fetchBranding);
        return () => window.removeEventListener('brandingUpdated', fetchBranding);
    }, []);

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

    const menuStructure = useMemo(() => [
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
                { key: 'payroll_org_chart', name: 'Org Chart', icon: <MdAccountTree size={18} />, path: '/payroll/org-chart' },
                { key: 'payroll_employees', name: 'Department Master', icon: <MdCategory size={18} />, path: '/payroll/masters?tab=departments' },
                { key: 'payroll_employees', name: 'Designation Master', icon: <MdAssignment size={18} />, path: '/payroll/masters?tab=designations' },
                { key: 'master_vendors', name: 'Vendors', icon: <MdStorefront size={18} />, path: '/vendors' },
                { key: 'master_contacts', name: 'Contacts', icon: <MdContactPhone size={18} />, path: '/contacts' },
                { key: 'sales_deals', name: 'Deals', icon: <MdViewKanban size={18} />, path: '/sales/deals' },
                { key: 'master_products', name: 'Products', icon: <MdInventory size={18} />, path: '/products' },
                { key: 'master_territories', name: 'Territory Master', icon: <MdMap size={18} />, path: '/territory-master' },
                { key: 'master_branches', name: 'Branch Master', icon: <MdBusiness size={18} />, path: '/branches' },
                { key: 'master_branches', name: 'State Master', icon: <MdMap size={18} />, path: '/state-master' },
                { key: 'master_branches', name: 'City Master', icon: <MdLocationCity size={18} />, path: '/city-master' },
                { key: 'csm_masters', name: 'Engineers Master', icon: <MdBuildCircle size={18} />, path: '/csm/masters?tab=engineers' },
                { key: 'master_mgrs', name: 'MGR Master', icon: <MdCategory size={18} />, path: '/mgrs' },
                { key: 'master_attributes', name: 'Attributes', icon: <MdAssignment size={18} />, path: '/attributes' },
                { key: 'master_terms', name: 'Terms & Conditions', icon: <MdDescription size={18} />, path: '/terms' },
                { key: 'master_statuses', name: 'Status Master', icon: <MdBarChart size={18} />, path: '/status-master', adminOnly: true },
                { key: 'master_serials', name: 'Serial No. Master', icon: <MdTag size={18} />, path: '/serial-no-master' },
                { key: 'flowchart_view', name: 'Flowchart Builder', icon: <MdAccountTree size={18} />, path: '/flowcharts' },
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
            name: 'Catalog',
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
            name: 'Quotations',
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
            name: 'Contracts',
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
            name: 'Material',
            key: 'purchase',
            icon: <MdShoppingCart size={22} />,
            children: [
                { key: 'purchase_grn', name: 'GRN', icon: <MdLocalShipping size={18} />, path: '/grn' },
            ]
        },
        {
            type: 'group',
            name: 'Inventory',
            key: 'inventory',
            icon: <MdInventory size={22} />,
            children: [
                { key: 'inventory_dashboard', name: 'Dashboard', icon: <MdDashboard size={18} />, path: '/inventory/dashboard' },
                { key: 'inventory_items', name: 'Items & Matrix', icon: <MdInventory size={18} />, path: '/inventory/stock' },
                { key: 'inventory_warehouses', name: 'Warehouses', icon: <MdStorefront size={18} />, path: '/inventory/warehouses' },
                { key: 'inventory_transfers', name: 'Stock Transfers', icon: <MdCompareArrows size={18} />, path: '/inventory/transfers' },
                { key: 'inventory_adjustments', name: 'Adjustments', icon: <MdTune size={18} />, path: '/inventory/adjustments' },
                { key: 'inventory_stock_counts', name: 'Physical Audit', icon: <MdFactCheck size={18} />, path: '/inventory/counts' },
                { key: 'inventory_alerts', name: 'Stock Alerts', icon: <MdNotificationsActive size={18} />, path: '/inventory/alerts' },
                { key: 'inventory_reports', name: 'Valuation & Reports', icon: <MdAssessment size={18} />, path: '/inventory/reports' },
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
                { key: 'csm_tickets', name: 'My Tickets', icon: <MdPeople size={18} />, path: '/csm/tickets?tab=my' },
                { key: 'csm_tickets', name: 'My Team Tickets', icon: <MdAccountTree size={18} />, path: '/csm/tickets?tab=team' },
                { key: 'csm_visits', name: 'Service Visits', icon: <MdLocalShipping size={18} />, path: '/csm/visits' },
                { key: 'csm_visits', name: 'Visit Planner', icon: <MdCalendarMonth size={18} />, path: '/csm/visit-planner' },
                { key: 'csm_warranties_amc', name: 'Warranty & AMC', icon: <MdStorefront size={18} />, path: '/csm/warranties-amc' },
                { key: 'csm_kb', name: 'Knowledge Base', icon: <MdDescription size={18} />, path: '/csm/kb' },
                { key: 'csm_masters', name: 'CSM Config', icon: <MdSettings size={18} />, path: '/csm/masters' },
                { key: 'csm_reports', name: 'Service Reports', icon: <MdAnalytics size={18} />, path: '/csm/reports' },
                { key: 'csm_rca', name: 'RCA Report', icon: <MdAssessment size={18} />, path: '/csm/rca' },
            ]
        },
        {
            type: 'group',
            name: 'Tenders',
            key: 'tender',
            icon: <MdAssignment size={22} />,
            children: [
                { key: 'tender_dashboard', name: 'Tender Dashboard', icon: <MdDashboard size={18} />, path: '/tender/dashboard' },
                { key: 'tender_register', name: 'Tenders Register', icon: <MdAssignment size={18} />, path: '/tender/register' },
                { key: 'tender_reports', name: 'Tender Reports', icon: <MdBarChart size={18} />, path: '/tender/reports' }
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
                { key: 'master_customers', name: 'Customer Analytics', icon: <MdAnalytics size={18} />, path: '/customers/analytics' },
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
    ], [isAdmin, isSuperAdmin]);

    const filteredMenuStructure = useMemo(() => {
        if (user?.role === 'vendor' || String(user?.role || '').toLowerCase() === 'vendor') {
            return [
                { type: 'link', key: 'master_products', name: 'Product Catalog', icon: <MdInventory size={20} />, path: '/products' },
                { type: 'link', key: 'purchase_grn', name: 'Invoice Vouchers', icon: <MdReceipt size={20} />, path: '/grn' }
            ];
        }

        return menuStructure.map((item) => {
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
    }, [user, menuStructure, isSuperAdmin, isAdmin, hasAccess]);

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
                className={`fixed top-0 left-0 h-full bg-white dark:bg-slate-900 transition-all duration-300 z-50 shadow-2xl border-r border-slate-100 dark:border-slate-800 transform flex flex-col no-print ${isOpen ? 'translate-x-0 w-64' : '-translate-x-full md:translate-x-0 md:w-20 w-64'}`}
            >
                <div className={`border-b border-slate-50 dark:border-slate-800 shrink-0 ${isOpen ? (brandSettings?.showDualBranding !== false && brandSettings?.logoUrl ? 'p-4' : 'h-24 px-4 flex items-center') : 'py-4 px-2 flex flex-col items-center justify-center'}`}>
                    {!isOpen ? (
                        <div className="flex flex-col items-center justify-center gap-2">
                            <button
                                onClick={toggleSidebar}
                                title="Open / Expand Sidebar"
                                className="w-10 h-10 rounded-2xl flex items-center justify-center shadow-md shadow-primary-600/20 hover:scale-105 transition-all group cursor-pointer"
                                style={{ background: brandSettings?.primaryBrandColor ? `linear-gradient(135deg, ${brandSettings.primaryBrandColor}, ${brandSettings.primaryBrandColor}cc)` : 'linear-gradient(135deg, var(--color-primary-600), var(--color-accent))' }}
                            >
                                <span className="text-white font-black text-xl group-hover:hidden">A</span>
                                <MdChevronRight size={22} className="text-white hidden group-hover:block transition-transform" />
                            </button>
                            <button
                                onClick={toggleSidebar}
                                title="Open / Expand Sidebar"
                                className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all border border-slate-200/60 dark:border-slate-700/60 shadow-xs cursor-pointer"
                            >
                                <MdChevronRight size={20} />
                            </button>
                        </div>
                    ) : (
                        <div className="w-full transition-all duration-300">
                            {/* Top row: ARCRM badge + App title + collapse button */}
                            <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2.5 min-w-0">
                                    <div className="w-10 h-10 rounded-2xl flex items-center justify-center shadow-md shadow-primary-600/20 shrink-0" style={{ background: brandSettings?.primaryBrandColor ? `linear-gradient(135deg, ${brandSettings.primaryBrandColor}, ${brandSettings.primaryBrandColor}cc)` : 'linear-gradient(135deg, var(--color-primary-600), var(--color-accent))' }}>
                                        <span className="text-white font-black text-xl">A</span>
                                    </div>
                                    <div className="min-w-0 text-slate-900 dark:text-slate-100 font-outfit uppercase">
                                        <p className="text-lg font-black tracking-tight leading-none truncate">{brandSettings?.whitelabelAppTitle || 'ARCRM'}</p>
                                        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 mt-0.5 truncate tracking-wide">Always Ready CRM</p>
                                    </div>
                                </div>
                                <button
                                    onClick={toggleSidebar}
                                    className="p-1.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 transition-all shrink-0 cursor-pointer"
                                    title="Collapse Sidebar"
                                >
                                    <MdChevronLeft size={22} />
                                </button>
                            </div>
                            {/* Bottom row: Client company logo & tagline */}
                            {brandSettings?.showDualBranding !== false && brandSettings?.logoUrl && (
                                <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col items-center justify-center">
                                    <div className="w-full bg-white dark:bg-slate-800 p-3 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col items-center justify-center gap-2 overflow-visible">
                                        <img
                                            src={resolveImageUrl(brandSettings.logoUrl)}
                                            alt={brandSettings.companyName || 'Company Logo'}
                                            className="h-14 md:h-16 max-w-full object-contain mx-auto transition-all"
                                        />
                                        {brandSettings?.tagline && (
                                            <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 tracking-wider uppercase leading-tight text-center break-words px-1">
                                                {brandSettings.tagline}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <nav className="flex-1 overflow-y-auto overflow-x-hidden py-4 px-3 space-y-1 custom-scrollbar">
                    {filteredMenuStructure.map((item) => {
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
