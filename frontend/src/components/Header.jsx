import React, { useState, useRef, useEffect, useMemo } from 'react';
import { MdSearch, MdNotifications, MdLogout, MdMenu, MdSettings, MdCheck, MdInfoOutline, MdWbSunny, MdNightsStay, MdSync, MdExpandMore, MdExpandLess } from 'react-icons/md';
import { useNavigate, Link } from 'react-router-dom';
import { notificationService, systemUpdateService, enquiryService } from '../services/api';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useSocket } from '../context/SocketContext';
import SystemUpdatesModal from './SystemUpdatesModal';
import ChangePasswordModal from './ChangePasswordModal';

const formatNotificationType = (type) => {
    switch (type) {
        case 'MEETING_CREATED':
            return 'Meeting Scheduled';
        case 'MEETING_REMINDER_1_DAY':
            return 'Meeting in 1 Day';
        case 'MEETING_REMINDER_30_MIN':
            return 'Meeting in 30 Mins';
        case 'MEETING_UPDATED':
            return 'Meeting Updated';
        case 'MEETING_CANCELLED':
            return 'Meeting Cancelled';
        case 'MEETING_RESCHEDULED':
            return 'Meeting Rescheduled';
        default:
            return type;
    }
};

const searchablePages = [
    { label: 'Dashboard', path: '/dashboard', permissionKey: 'dashboard_overview', keywords: ['home', 'overview'] },
    { label: 'Customers', path: '/customers', permissionKey: 'master_customers', keywords: ['customer master'] },
    { label: 'Vendors', path: '/vendors', permissionKey: 'master_vendors', keywords: ['vendor master'] },
    { label: 'Contacts', path: '/contacts', permissionKey: 'master_contacts', keywords: ['contact master'] },
    { label: 'Enquiries', path: '/enquiries', permissionKey: 'enquiry_leads', keywords: ['leads', 'enquiry register'] },
    { label: 'Meetings', path: '/meetings', permissionKey: 'meetings_list', keywords: ['appointments', 'appointment register'] },
    { label: 'Products', path: '/products', permissionKey: 'master_products', keywords: ['items', 'catalog'] },
    { label: 'Invoices', path: '/invoices', permissionKey: 'sale_invoices', keywords: ['invoice', 'sales invoice', 'billing', 'bills'] },
    { label: 'GRN', path: '/grn', permissionKey: 'purchase_grn', keywords: ['material received', 'purchase', 'goods received'] },
    { label: 'MGR Master', path: '/mgrs', permissionKey: 'master_mgrs', keywords: ['mgr'] },
    { label: 'Attributes', path: '/attributes', permissionKey: 'master_attributes', keywords: ['product attributes'] },
    { label: 'Planning', path: '/planning', permissionKey: 'planning_screen', keywords: ['planning screen'] },
    { label: 'Simulations', path: '/simulations', permissionKey: 'planning_simulations', keywords: ['simulation'] },
    { label: 'Reports', path: '/reports', permissionKey: 'reports_main', keywords: ['report'] },
    { label: 'Quotations', path: '/quotations', permissionKey: 'quotation_list', keywords: ['quotes', 'quote'] },
    { label: 'Terms & Conditions', path: '/terms', permissionKey: 'master_terms', keywords: ['terms', 'conditions'] },
    { label: 'Territory Master', path: '/territory-master', permissionKey: 'master_territories', keywords: ['territory'] },
    { label: 'Serial No. Master', path: '/serial-no-master', permissionKey: 'master_serials', keywords: ['serial number', 'assets', 'stock serials'] },
    { label: 'Settings', path: '/settings', permissionKey: 'settings_profile', keywords: ['profile'] },
    { label: 'Authorization', path: '/admin/authorization', permissionKey: 'admin_authorization', keywords: ['permissions', 'roles'] },
    { label: 'Salespersons', path: '/salespersons', permissionKey: 'admin_salespersons', adminOnly: true, keywords: ['sales person'] },
    { label: 'Sales Dashboard', path: '/sales/dashboard', permissionKey: 'sales_dashboard', keywords: ['sales overview'] },
    { label: 'Deals', path: '/sales/deals', permissionKey: 'sales_deals', keywords: ['deal board', 'pipeline deals'] },
    { label: 'Sales Pipelines', path: '/sales/pipelines', permissionKey: 'sales_pipelines', adminOnly: true, keywords: ['pipeline'] },
    { label: 'Forecasting', path: '/sales/forecasting', permissionKey: 'sales_forecasting', keywords: ['forecast'] },
    { label: 'Sales Activities', path: '/sales/activities', permissionKey: 'sales_activities', keywords: ['activities'] },
    { label: 'Sales Targets', path: '/sales/targets', permissionKey: 'sales_targets', keywords: ['targets'] },
    { label: 'Price Books', path: '/sales/price-management/price-books', permissionKey: 'sales_price_management', keywords: ['price book'] },
    { label: 'Pricing Rules', path: '/sales/price-management/pricing-rules', permissionKey: 'sales_price_management', keywords: ['pricing rule'] },
    { label: 'Discount Policies', path: '/sales/price-management/discounts', permissionKey: 'sales_price_management', keywords: ['discounts'] },
    { label: 'Promotions', path: '/sales/price-management/promotions', permissionKey: 'sales_price_management', keywords: ['promotion'] },
    { label: 'Currency Rates', path: '/sales/price-management/currencies', permissionKey: 'sales_price_management', keywords: ['currency'] },
    { label: 'Guided Selling', path: '/sales/cpq/guided-selling', permissionKey: 'sales_cpq', keywords: ['cpq guided'] },
    { label: 'Configurator', path: '/sales/cpq/configurator', permissionKey: 'sales_cpq', keywords: ['cpq configurator'] },
    { label: 'Quote Simulator', path: '/sales/cpq/simulator', permissionKey: 'sales_cpq', keywords: ['quote simulator'] },
    { label: 'Approvals', path: '/sales/approvals', permissionKey: 'sales_approvals', keywords: ['approval'] },
    { label: 'Contracts', path: '/sales/contracts', permissionKey: 'sales_contracts', keywords: ['contract'] },
    { label: 'Orders', path: '/sales/orders', permissionKey: 'sales_orders', keywords: ['sales orders'] },
    { label: 'Revenue Analytics', path: '/sales/revenue-analytics', permissionKey: 'sales_revenue_analytics', keywords: ['revenue'] },
    { label: 'Competitor Intel', path: '/sales/competitors', permissionKey: 'sales_competitors', keywords: ['competitors'] },
    { label: 'AI Pricing Insights', path: '/sales/ai-pricing', permissionKey: 'sales_ai_pricing', keywords: ['ai pricing'] },
    { label: 'Payroll Dashboard', path: '/payroll/dashboard', permissionKey: 'payroll_runs', keywords: ['payroll overview'] },
    { label: 'Employees', path: '/payroll/employees', permissionKey: 'payroll_employees', keywords: ['payroll employees'] },
    { label: 'Run Payroll', path: '/payroll/runs', permissionKey: 'payroll_runs', keywords: ['payroll run'] },
    { label: 'Payroll Payments', path: '/payroll/payments', permissionKey: 'payroll_payments', keywords: ['salary payments'] },
    { label: 'Payslips', path: '/payroll/payslips', permissionKey: 'payroll_runs', keywords: ['pay slips'] },
    { label: 'Payroll Letters', path: '/payroll/letters', permissionKey: 'payroll_letters', keywords: ['offer letters'] },
    { label: 'Payroll Reports', path: '/payroll/reports', permissionKey: 'payroll_reports', keywords: ['salary reports'] },
    { label: 'Payroll Settings', path: '/payroll/settings', permissionKey: 'payroll_settings', keywords: ['payroll config'] },
    { label: 'CSM Dashboard', path: '/csm/dashboard', permissionKey: 'csm_dashboard', keywords: ['service dashboard'] },
    { label: 'Tickets', path: '/csm/tickets', permissionKey: 'csm_tickets', keywords: ['tickets register', 'service tickets'] },
    { label: 'Service Visits', path: '/csm/visits', permissionKey: 'csm_visits', keywords: ['visits'] },
    { label: 'Warranty & AMC', path: '/csm/warranties-amc', permissionKey: 'csm_warranties_amc', keywords: ['warranty', 'amc'] },
    { label: 'Knowledge Base', path: '/csm/kb', permissionKey: 'csm_kb', keywords: ['kb'] },
    { label: 'CSM Config', path: '/csm/masters', permissionKey: 'csm_masters', keywords: ['csm masters'] },
    { label: 'Service Reports', path: '/csm/reports', permissionKey: 'csm_dashboard', keywords: ['csm reports'] },
    { label: 'Super Admin', path: '/super-admin', superAdminOnly: true, keywords: ['platform admin'] },
    { label: 'System Updates', path: '/system-updates', superAdminOnly: true, keywords: ['updates', 'release notes'] },
];

const normalizeSearchText = (value) => value.trim().toLowerCase();

const HighlightText = ({ text, query }) => {
    if (!query || !text) return <span>{text}</span>;
    const parts = String(text).split(new RegExp(`(${query})`, 'gi'));
    return (
        <span>
            {parts.map((part, i) =>
                part.toLowerCase() === query.toLowerCase() ? (
                    <mark key={i} className="bg-amber-200 text-slate-900 px-0.5 rounded font-black">{part}</mark>
                ) : (
                    part
                )
            )}
        </span>
    );
};

const moduleSubmodulesMap = {
    '/dashboard': [
        { label: 'Executive Summary', path: '/dashboard' },
        { label: 'Quick Metrics & KPIs', path: '/dashboard' },
        { label: 'Recent Deals & Enquiries', path: '/enquiries' },
        { label: 'Pending Approvals Queue', path: '/sales/approvals' }
    ],
    '/customers': [
        { label: 'Customer Directory', path: '/customers' },
        { label: 'Customer 360 Workspace', path: '/customers' },
        { label: 'Customer Analytics', path: '/customers/analytics' },
        { label: 'Quotations & Invoices', path: '/quotations' }
    ],
    '/vendors': [
        { label: 'Vendor Directory', path: '/vendors' },
        { label: 'Material Received GRN', path: '/grn' },
        { label: 'Supplies & Catalog', path: '/products' }
    ],
    '/contacts': [
        { label: 'Contact Directory', path: '/contacts' },
        { label: 'Customer & Vendor Contacts', path: '/customers' }
    ],
    '/products': [
        { label: 'Products & Items Master', path: '/products' },
        { label: 'Services Catalog', path: '/products' },
        { label: 'Product Bundles', path: '/products' },
        { label: 'Subscription Plans', path: '/products' }
    ],
    '/invoices': [
        { label: 'Sales Invoices Register', path: '/invoices' },
        { label: 'Create New Invoice', path: '/invoices/new' },
        { label: 'Sales Orders', path: '/sales/orders' }
    ],
    '/grn': [
        { label: 'Goods Received Note (GRN)', path: '/grn' },
        { label: 'Create New GRN Receipt', path: '/grn/new' },
        { label: 'Vendor Material Delivery', path: '/vendors' }
    ],
    '/mgrs': [
        { label: 'MGR Category Master', path: '/mgrs' },
        { label: 'Product Grouping', path: '/products' }
    ],
    '/attributes': [
        { label: 'Product Attributes', path: '/attributes' },
        { label: 'Specifications & Variants', path: '/products' }
    ],
    '/enquiries': [
        { label: 'Enquiry Register', path: '/enquiries' },
        { label: 'Customer Details', path: '/customers' },
        { label: 'Follow-ups & Log', path: '/enquiries' },
        { label: 'Tasks & Reminders', path: '/planning' },
        { label: 'Quotations', path: '/quotations' },
        { label: 'Deals & Pipeline', path: '/sales/deals' }
    ],
    '/enquiries/analytics': [
        { label: 'Enquiry Lead Analytics', path: '/enquiries/analytics' },
        { label: 'Conversion Funnel', path: '/quotations/conversion-report' }
    ],
    '/meetings': [
        { label: 'Appointments Register', path: '/meetings' },
        { label: 'Schedule New Appointment', path: '/meetings/new' },
        { label: 'Follow-up Tasks', path: '/planning' }
    ],
    '/sales/dashboard': [
        { label: 'Sales Dashboard', path: '/sales/dashboard' },
        { label: 'Deals Board', path: '/sales/deals' },
        { label: 'Pipelines Config', path: '/sales/pipelines' },
        { label: 'Sales Targets', path: '/sales/targets' },
        { label: 'Revenue Analytics', path: '/sales/revenue-analytics' }
    ],
    '/sales/deals': [
        { label: 'Kanban Deal Board', path: '/sales/deals' },
        { label: 'Create New Deal', path: '/sales/deals/new' },
        { label: 'Sales Pipeline Stages', path: '/sales/pipelines' }
    ],
    '/sales/pipelines': [
        { label: 'Pipeline Manager', path: '/sales/pipelines' },
        { label: 'Custom Sales Stages', path: '/sales/pipelines' }
    ],
    '/sales/forecasting': [
        { label: 'Weighted Revenue Forecast', path: '/sales/forecasting' },
        { label: 'Quota Achievements', path: '/sales/targets' }
    ],
    '/sales/activities': [
        { label: 'Sales Rep Activities', path: '/sales/activities' },
        { label: 'Calls & Meeting Logs', path: '/meetings' }
    ],
    '/sales/targets': [
        { label: 'Sales Target Quotas', path: '/sales/targets' },
        { label: 'Performance Progress', path: '/sales/analytics' }
    ],
    '/sales/price-management/price-books': [
        { label: 'Price Books List', path: '/sales/price-management/price-books' },
        { label: 'Pricing Rules', path: '/sales/price-management/pricing-rules' },
        { label: 'Discount Policies', path: '/sales/price-management/discounts' }
    ],
    '/sales/price-management/pricing-rules': [
        { label: 'Pricing Rules Config', path: '/sales/price-management/pricing-rules' },
        { label: 'Price Books', path: '/sales/price-management/price-books' },
        { label: 'Discount Policies', path: '/sales/price-management/discounts' }
    ],
    '/sales/price-management/discounts': [
        { label: 'Discount Policies', path: '/sales/price-management/discounts' },
        { label: 'Promotions & Off-Season', path: '/sales/price-management/promotions' },
        { label: 'Currency Rates', path: '/sales/price-management/currencies' }
    ],
    '/sales/price-management/promotions': [
        { label: 'Promotions & Special Offers', path: '/sales/price-management/promotions' },
        { label: 'Discount Policies', path: '/sales/price-management/discounts' }
    ],
    '/sales/price-management/currencies': [
        { label: 'Currency Conversion Rates', path: '/sales/price-management/currencies' },
        { label: 'Price Books', path: '/sales/price-management/price-books' }
    ],
    '/sales/cpq/guided-selling': [
        { label: 'Guided Selling Flow', path: '/sales/cpq/guided-selling' },
        { label: 'CPQ Product Configurator', path: '/sales/cpq/configurator' },
        { label: 'Quote Simulator', path: '/sales/cpq/simulator' }
    ],
    '/sales/cpq/configurator': [
        { label: 'Custom Product Configurator', path: '/sales/cpq/configurator' },
        { label: 'Guided Selling', path: '/sales/cpq/guided-selling' },
        { label: 'Dynamic BOM Pricing', path: '/products' }
    ],
    '/sales/cpq/simulator': [
        { label: 'Quote Profitability Simulator', path: '/sales/cpq/simulator' },
        { label: 'Margin & Discount Calculator', path: '/sales/price-management/discounts' }
    ],
    '/quotations': [
        { label: 'Quotations Register', path: '/quotations' },
        { label: 'Create New Quotation', path: '/quotations/new' },
        { label: 'Quote Conversion Report', path: '/quotations/conversion-report' },
        { label: 'Approvals Queue', path: '/sales/approvals' }
    ],
    '/sales/approvals': [
        { label: 'Pending Approvals Queue', path: '/sales/approvals' },
        { label: 'Quotations List', path: '/quotations' }
    ],
    '/sales/contracts': [
        { label: 'Contracts Dashboard', path: '/sales/contracts/dashboard' },
        { label: 'Contracts List', path: '/sales/contracts/list' },
        { label: 'Templates & Clauses', path: '/sales/contracts/templates' },
        { label: 'Renewals Kanban', path: '/sales/contracts/renewals' }
    ],
    '/sales/orders': [
        { label: 'Sales Orders List', path: '/sales/orders' },
        { label: 'Invoices', path: '/invoices' }
    ],
    '/sales/revenue-analytics': [
        { label: 'Revenue & Margin Breakdown', path: '/sales/revenue-analytics' },
        { label: 'Sales Reports', path: '/sales/reports' }
    ],
    '/sales/competitors': [
        { label: 'Competitor Intelligence', path: '/sales/competitors' },
        { label: 'Battle Cards & Counter Tactics', path: '/sales/competitors' }
    ],
    '/sales/ai-pricing': [
        { label: 'AI Dynamic Pricing Engine', path: '/sales/ai-pricing' },
        { label: 'Win Probability Calculator', path: '/sales/ai-pricing' }
    ],
    '/payroll/dashboard': [
        { label: 'Payroll Summary', path: '/payroll/dashboard' },
        { label: 'Active Employees', path: '/payroll/employees' },
        { label: 'Run Payroll Process', path: '/payroll/runs' },
        { label: 'Salary Payments', path: '/payroll/payments' },
        { label: 'Department Master', path: '/payroll/masters?tab=departments' }
    ],
    '/payroll/employees': [
        { label: 'Employee Directory', path: '/payroll/employees' },
        { label: 'Department Master', path: '/payroll/masters?tab=departments' },
        { label: 'Designation Master', path: '/payroll/masters?tab=designations' }
    ],
    '/payroll/runs': [
        { label: 'Payroll Execution Runs', path: '/payroll/runs' },
        { label: 'Payslips Register', path: '/payroll/payslips' },
        { label: 'Salary Payments', path: '/payroll/payments' }
    ],
    '/payroll/payments': [
        { label: 'Payment Disbursement', path: '/payroll/payments' },
        { label: 'Payslips', path: '/payroll/payslips' }
    ],
    '/payroll/payslips': [
        { label: 'Salary Payslips Directory', path: '/payroll/payslips' },
        { label: 'Employee Payroll Runs', path: '/payroll/runs' }
    ],
    '/payroll/letters': [
        { label: 'Offer & Appointment Letters', path: '/payroll/letters' },
        { label: 'Letter Templates', path: '/payroll/letters' }
    ],
    '/payroll/reports': [
        { label: 'Payroll Reports & Analytics', path: '/payroll/reports' },
        { label: 'Tax & PF Breakdown', path: '/payroll/reports' }
    ],
    '/payroll/settings': [
        { label: 'Payroll Rules & Configuration', path: '/payroll/settings' },
        { label: 'Salary Components', path: '/payroll/settings' }
    ],
    '/payroll/masters': [
        { label: 'Department Structure', path: '/payroll/masters?tab=departments' },
        { label: 'Designation Master', path: '/payroll/masters?tab=designations' },
        { label: 'Personnel Assignment', path: '/payroll/masters' }
    ],
    '/csm/dashboard': [
        { label: 'Customer Service Dashboard', path: '/csm/dashboard' },
        { label: 'Service Tickets Register', path: '/csm/tickets' },
        { label: 'Service Visits', path: '/csm/visits' },
        { label: 'Warranty & AMC', path: '/csm/warranties-amc' },
        { label: 'Knowledge Base FAQs', path: '/csm/kb' },
        { label: 'CSM Masters Config', path: '/csm/masters' }
    ],
    '/csm/tickets': [
        { label: 'Tickets Register', path: '/csm/tickets' },
        { label: 'Ticket Resolution SLA', path: '/csm/tickets' },
        { label: 'Engineers Master', path: '/csm/masters?tab=engineers' }
    ],
    '/csm/visits': [
        { label: 'Field Service Visits', path: '/csm/visits' },
        { label: 'Service Engineers Log', path: '/csm/visits' }
    ],
    '/csm/warranties-amc': [
        { label: 'Warranty & AMC Contracts', path: '/csm/warranties-amc' },
        { label: 'Contract Renewals', path: '/csm/warranties-amc' }
    ],
    '/csm/kb': [
        { label: 'Knowledge Base Articles', path: '/csm/kb' },
        { label: 'Technical Solutions', path: '/csm/kb' }
    ],
    '/csm/masters': [
        { label: 'Engineers Master', path: '/csm/masters?tab=engineers' },
        { label: 'CSM Configuration', path: '/csm/masters' }
    ],
    '/csm/reports': [
        { label: 'Service Performance Reports', path: '/csm/reports' },
        { label: 'CSAT & Resolution Time', path: '/csm/reports' }
    ],
    '/tender/dashboard': [
        { label: 'Tender Dashboard', path: '/tender/dashboard' },
        { label: 'Tenders Register', path: '/tender/register' },
        { label: 'Tender Analytics', path: '/tender/reports' }
    ],
    '/tender/register': [
        { label: 'Tenders Register', path: '/tender/register' },
        { label: 'EMD & Bid Submissions', path: '/tender/register' }
    ],
    '/tender/reports': [
        { label: 'Tender Win Rate Reports', path: '/tender/reports' },
        { label: 'Financial EMD Summary', path: '/tender/reports' }
    ],
    '/planning': [
        { label: 'Planning & Scheduling Screen', path: '/planning' },
        { label: 'Simulations & Scenarios', path: '/simulations' }
    ],
    '/simulations': [
        { label: 'Simulation Scenarios', path: '/simulations' },
        { label: 'What-If Price Analysis', path: '/simulations' }
    ],
    '/reports': [
        { label: 'Reports Hub', path: '/reports' },
        { label: 'Sales Reports', path: '/sales/reports' },
        { label: 'Payroll Reports', path: '/payroll/reports' }
    ],
    '/terms': [
        { label: 'Terms & Conditions Master', path: '/terms' },
        { label: 'Legal Clauses', path: '/terms' }
    ],
    '/territory-master': [
        { label: 'Territory Master', path: '/territory-master' },
        { label: 'Geographical Regions', path: '/territory-master' }
    ],
    '/serial-no-master': [
        { label: 'Serial No. Master', path: '/serial-no-master' },
        { label: 'Barcode & Asset Tracker', path: '/serial-no-master' }
    ],
    '/settings': [
        { label: 'Profile & Preferences', path: '/settings' },
        { label: 'System Configuration', path: '/settings' }
    ],
    '/status-master': [
        { label: 'System Status Master', path: '/status-master' },
        { label: 'Custom Workflow States', path: '/status-master' }
    ],
    '/admin/authorization': [
        { label: 'Authorization Matrix', path: '/admin/authorization' },
        { label: 'Roles & Module Access', path: '/admin/authorization' }
    ],
    '/salespersons': [
        { label: 'Salespersons List', path: '/salespersons' },
        { label: 'Commission & Quotas', path: '/salespersons' }
    ],
    '/super-admin': [
        { label: 'Super Admin Console', path: '/super-admin' },
        { label: 'Platform Tenants & Logs', path: '/super-admin' }
    ],
    '/system-updates': [
        { label: 'Daily CRM Changes Update', path: '/system-updates' },
        { label: 'Release Logs & Notes', path: '/system-updates' }
    ]
};

const Header = ({ sidebarOpen, toggleSidebar }) => {
    const navigate = useNavigate();
    const { user, logout, isAdmin, isSuperAdmin, hasAccess } = useAuth();
    const { isDarkMode, toggleTheme } = useTheme();
    const { isReconnecting } = useSocket();

    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [isNotifOpen, setIsNotifOpen] = useState(false);
    const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
    const [mustChangePasswordModal, setMustChangePasswordModal] = useState(false);

    useEffect(() => {
        if (user?.mustChangePassword) {
            setMustChangePasswordModal(true);
        }
    }, [user]);

    const [searchQuery, setSearchQuery] = useState('');
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [enquirySearchHits, setEnquirySearchHits] = useState([]);
    const [searchingEnquiries, setSearchingEnquiries] = useState(false);
    const [expandedPagePath, setExpandedPagePath] = useState(null);

    const [notifications, setNotifications] = useState([]);
    const [systemUpdateNotification, setSystemUpdateNotification] = useState(null);

    const dropdownRef = useRef(null);
    const notifRef = useRef(null);
    const searchRef = useRef(null);

    const handleLogout = () => {
        logout();
        navigate('/');
    };

    const fetchNotifications = async () => {
        try {
            const [notificationRes, updateRes] = await Promise.all([
                notificationService.getUnread(),
                systemUpdateService.getLatest().catch(() => ({ data: null }))
            ]);
            setNotifications(notificationRes.data);

            if (updateRes.data) {
                const lastSeenVersion = localStorage.getItem('lastSeenSystemVersion');
                if (lastSeenVersion !== updateRes.data.version) {
                    setSystemUpdateNotification({
                        _id: `system-update-${updateRes.data.version}`,
                        type: 'Release',
                        title: updateRes.data.title,
                        message: updateRes.data.message,
                        version: updateRes.data.version
                    });
                } else {
                    setSystemUpdateNotification(null);
                }
            } else {
                setSystemUpdateNotification(null);
            }
        } catch (err) {
            console.error("Failed to fetch notifications", err);
        }
    };

    useEffect(() => {
        const initialFetchTimer = setTimeout(() => {
            void fetchNotifications();
        }, 0);
        const interval = setInterval(() => {
            void fetchNotifications();
        }, 5 * 60 * 1000);

        const handleNotificationUpdate = () => {
            void fetchNotifications();
        };
        window.addEventListener('onNotificationUpdate', handleNotificationUpdate);

        return () => {
            clearTimeout(initialFetchTimer);
            clearInterval(interval);
            window.removeEventListener('onNotificationUpdate', handleNotificationUpdate);
        };
    }, []);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsProfileOpen(false);
            }
            if (notifRef.current && !notifRef.current.contains(event.target)) {
                setIsNotifOpen(false);
            }
            if (searchRef.current && !searchRef.current.contains(event.target)) {
                setIsSearchOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Hierarchical Enquiry Search API query
    useEffect(() => {
        const query = searchQuery.trim();
        if (!query || query.length < 2) {
            setEnquirySearchHits([]);
            return;
        }

        const timer = setTimeout(async () => {
            setSearchingEnquiries(true);
            try {
                const res = await enquiryService.searchHierarchical(query);
                setEnquirySearchHits(res.data || []);
            } catch (err) {
                console.error("Enquiry hierarchical search failed", err);
            } finally {
                setSearchingEnquiries(false);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [searchQuery]);

    const dismissNotification = async (id, e) => {
        e.stopPropagation();
        if (systemUpdateNotification && id === systemUpdateNotification._id) {
            localStorage.setItem('lastSeenSystemVersion', systemUpdateNotification.version);
            setSystemUpdateNotification(null);
            return;
        }

        try {
            await notificationService.dismiss(id);
            setNotifications(prev => prev.filter(n => n._id !== id));
        } catch (error) {
            console.error('Failed to dismiss notification', error);
        }
    };

    const handleNotifClick = async (n) => {
        if (n.type === 'Release') {
            localStorage.setItem('lastSeenSystemVersion', n.version);
            setSystemUpdateNotification(null);
            setIsNotifOpen(false);
            navigate('/system-updates');
            return;
        }

        try {
            await notificationService.markAsRead(n._id);
            if (n.type === 'Quotation') {
                if (n.relatedId) navigate(`/quotations/${n.relatedId}`);
                else navigate('/quotations');
            } else if (n.type === 'Planning') {
                navigate('/planning');
            } else if (n.type.startsWith('MEETING_')) {
                navigate('/meetings');
            } else {
                if (n.relatedId) navigate(`/enquiries/edit/${n.relatedId}`);
            }
            setIsNotifOpen(false);
        } catch (error) {
            console.error('Failed to mark notification as read', error);
        }
    };

    const displayNotifications = systemUpdateNotification
        ? [systemUpdateNotification, ...notifications]
        : notifications;

    const allowedSearchPages = useMemo(() => (
        searchablePages.filter((page) => {
            if (page.superAdminOnly) return isSuperAdmin;
            if (page.adminOnly && !(isAdmin || isSuperAdmin)) return false;
            return page.permissionKey ? hasAccess(page.permissionKey) : true;
        })
    ), [hasAccess, isAdmin, isSuperAdmin]);

    const searchMatches = useMemo(() => {
        const query = normalizeSearchText(searchQuery);
        if (!query) return [];

        return allowedSearchPages
            .map((page) => {
                const terms = [page.label, page.path, ...(page.keywords || [])].map(normalizeSearchText);
                const exactMatch = terms.some((term) => term === query || term === `${query}s` || `${term}s` === query);
                const startsWithMatch = terms.some((term) => term.startsWith(query));
                const includesMatch = terms.some((term) => term.includes(query));

                if (exactMatch) return { ...page, score: 3 };
                if (startsWithMatch) return { ...page, score: 2 };
                if (includesMatch) return { ...page, score: 1 };
                return null;
            })
            .filter(Boolean)
            .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label))
            .slice(0, 5);
    }, [allowedSearchPages, searchQuery]);

    const goToSearchMatch = (path) => {
        if (!path) return;
        navigate(path);
        setSearchQuery('');
        setIsSearchOpen(false);
    };

    return (
        <>
            <header className={`fixed top-0 right-0 h-20 bg-white/80 dark:bg-slate-900/90 backdrop-blur-xl border-b border-slate-100 dark:border-slate-800 z-40 transition-all duration-300 left-0 ${sidebarOpen ? 'md:left-64' : 'md:left-20'}`}>
                <div className="h-full px-6 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4 flex-1">
                        <button onClick={toggleSidebar} className="p-2 -ml-2 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl md:hidden transition-colors">
                            <MdMenu size={24} />
                        </button>

                        <form ref={searchRef} onSubmit={(e) => e.preventDefault()} className="relative w-full max-w-lg hidden sm:block group">
                            <MdSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary-600 transition-colors" size={20} />
                            <input
                                type="text"
                                placeholder="Find enquiries, quotes, customers, submodules..."
                                value={searchQuery}
                                onChange={(event) => {
                                    setSearchQuery(event.target.value);
                                    setIsSearchOpen(true);
                                }}
                                onFocus={() => setIsSearchOpen(true)}
                                className="w-full pl-12 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl focus:ring-2 focus:ring-primary-600/20 focus:bg-white dark:focus:bg-slate-900 transition-all outline-none text-sm font-semibold text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
                            />

                            {/* Global Search Results Dropdown */}
                            {isSearchOpen && searchQuery.trim() && (
                                <div className="absolute left-0 right-0 top-full mt-3 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-2xl rounded-2xl overflow-hidden py-2 animate-in fade-in slide-in-from-top-2 duration-150 max-h-[28rem] overflow-y-auto">
                                    {/* Enquiry Hierarchical Results */}
                                    {enquirySearchHits.length > 0 && (
                                        <div className="border-b border-slate-100 dark:border-slate-800 pb-2 mb-2">
                                            <div className="px-4 py-1.5 text-[10px] font-black uppercase tracking-widest text-primary-600 dark:text-primary-400 bg-primary-50/50 dark:bg-primary-950/30">
                                                Enquiries & Linked Submodules
                                            </div>
                                            {enquirySearchHits.map(enq => (
                                                <div key={enq.id} className="px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/50 border-b border-slate-50 dark:border-slate-800/40 last:border-0">
                                                    <div
                                                        onClick={() => goToSearchMatch(`/enquiries/edit/${enq.id}`)}
                                                        className="flex items-center justify-between cursor-pointer font-black text-slate-900 dark:text-slate-100 text-sm hover:text-primary-600"
                                                    >
                                                        <span>
                                                            <HighlightText text={enq.enquiryNo} query={searchQuery} /> - <HighlightText text={enq.customerName} query={searchQuery} />
                                                        </span>
                                                        <span className="text-[10px] bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300 font-bold px-2 py-0.5 rounded-full">
                                                            Primary Enquiry
                                                        </span>
                                                    </div>

                                                    {/* Submodules Nested Tree */}
                                                    <div className="mt-2 pl-3 border-l-2 border-primary-200 dark:border-primary-800 space-y-1">
                                                        {enq.submodules.map(sub => (
                                                            <button
                                                                key={sub.key}
                                                                type="button"
                                                                onMouseDown={(e) => e.preventDefault()}
                                                                onClick={() => goToSearchMatch(sub.path)}
                                                                className="w-full flex items-center justify-between text-left text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-50/40 dark:hover:bg-primary-900/30 px-2 py-1 rounded-lg transition-colors"
                                                            >
                                                                <span className="flex items-center gap-2">
                                                                    <span>{sub.icon}</span>
                                                                    <span>{sub.label}</span>
                                                                </span>
                                                                {sub.count !== undefined && (
                                                                    <span className="text-[10px] font-bold bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-500">
                                                                        {sub.count}
                                                                    </span>
                                                                )}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                     {/* General Page Matches */}
                                     <div className="px-4 py-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400">
                                         Module Pages & Submodules
                                     </div>
                                     {searchMatches.length > 0 ? (
                                         searchMatches.map((page) => {
                                             const submodules = moduleSubmodulesMap[page.path] || [];
                                             const isExpanded = expandedPagePath === page.path || searchMatches.length === 1;

                                             return (
                                                 <div key={page.path} className="border-b border-slate-50 dark:border-slate-800/60 last:border-0 py-1">
                                                     <div className="flex items-center justify-between px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-xl transition-colors">
                                                         <button
                                                             type="button"
                                                             onMouseDown={(event) => event.preventDefault()}
                                                             onClick={() => goToSearchMatch(page.path)}
                                                             className="flex-1 flex items-center justify-between text-left group"
                                                         >
                                                             <span className="text-xs font-black text-slate-900 dark:text-slate-100 group-hover:text-primary-600 transition-colors">
                                                                 <HighlightText text={page.label} query={searchQuery} />
                                                             </span>
                                                             <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{page.path}</span>
                                                         </button>

                                                         {submodules.length > 0 && (
                                                             <button
                                                                 type="button"
                                                                 onMouseDown={(e) => e.preventDefault()}
                                                                 onClick={() => setExpandedPagePath(prev => (prev === page.path ? null : page.path))}
                                                                 className="ml-2 p-1 text-slate-400 hover:text-primary-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                                                                 title="Toggle Submodules Tree"
                                                             >
                                                                 {isExpanded ? <MdExpandLess size={18} /> : <MdExpandMore size={18} />}
                                                             </button>
                                                         )}
                                                     </div>

                                                     {/* Submodules Nested Tree */}
                                                     {submodules.length > 0 && isExpanded && (
                                                         <div className="mt-1 ml-6 mr-4 pl-3 border-l-2 border-primary-300 dark:border-primary-700 space-y-1 py-1">
                                                             <div className="text-[9px] font-black uppercase text-slate-400 tracking-wider mb-1">
                                                                 Linked Submodules
                                                             </div>
                                                             {submodules.map((sub, sIdx) => (
                                                                 <button
                                                                     key={sIdx}
                                                                     type="button"
                                                                     onMouseDown={(e) => e.preventDefault()}
                                                                     onClick={() => goToSearchMatch(sub.path)}
                                                                     className="w-full flex items-center justify-between text-left text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-50/50 dark:hover:bg-primary-950/40 px-2 py-1.5 rounded-lg transition-colors"
                                                                 >
                                                                     <span className="flex items-center gap-2">
                                                                         <span className="w-1.5 h-1.5 rounded-full bg-primary-500"></span>
                                                                         <span><HighlightText text={sub.label} query={searchQuery} /></span>
                                                                     </span>
                                                                     <span className="text-[9px] font-bold text-slate-400">{sub.path}</span>
                                                                 </button>
                                                             ))}
                                                         </div>
                                                     )}
                                                 </div>
                                             );
                                         })
                                     ) : enquirySearchHits.length === 0 ? (
                                         <div className="px-4 py-4 text-center text-xs font-bold text-slate-400">
                                             {searchingEnquiries ? 'Searching CRM records...' : 'No related records found'}
                                         </div>
                                     ) : null}
                                </div>
                            )}
                        </form>
                    </div>

                    <div className="flex items-center gap-2 sm:gap-3">
                        {/* Socket Reconnecting Badge */}
                        {isReconnecting && (
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs font-bold rounded-full animate-pulse">
                                <MdSync className="animate-spin" size={14} />
                                <span>Reconnecting...</span>
                            </div>
                        )}

                        {/* Theme Toggle Button (Dark / Light Mode) */}
                        <button
                            type="button"
                            onClick={toggleTheme}
                            title={isDarkMode ? 'Dark Mode Active (Click for Light Mode)' : 'Light Mode Active (Click for Dark Mode)'}
                            className="p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 transition-all flex items-center gap-1.5 border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
                        >
                            {isDarkMode ? (
                                <MdNightsStay size={20} className="text-indigo-400" />
                            ) : (
                                <MdWbSunny size={20} className="text-amber-500" />
                            )}
                        </button>

                        {/* Information (i) Button */}
                        <button
                            type="button"
                            onClick={() => navigate('/system-updates')}
                            title="Daily CRM Changes Update"
                            className="p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-300 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-white dark:hover:bg-slate-700 transition-all flex items-center justify-center border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
                        >
                            <MdInfoOutline size={22} />
                        </button>

                        {/* Notifications Bell */}
                        <div className="relative" ref={notifRef}>
                            <button 
                                onClick={() => {
                                    const nextState = !isNotifOpen;
                                    setIsNotifOpen(nextState);
                                    if (nextState) {
                                        void fetchNotifications();
                                    }
                                }}
                                className="relative p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-300 hover:text-primary-600 hover:bg-white dark:hover:bg-slate-700 transition-all flex"
                            >
                                <MdNotifications size={22} />
                                {displayNotifications.length > 0 && (
                                    <span className="absolute top-1.5 right-1.5 w-3 h-3 bg-rose-500 border-2 border-white dark:border-slate-900 rounded-full"></span>
                                )}
                            </button>
                            
                            {isNotifOpen && (
                                <div className="absolute top-full right-0 mt-3 w-80 max-h-96 overflow-y-auto bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-800 py-3 animate-in fade-in slide-in-from-top-2 duration-200">
                                    <div className="px-4 pb-2 border-b border-slate-50 dark:border-slate-800 mb-2 flex justify-between items-center">
                                        <h4 className="font-black text-slate-900 dark:text-slate-100">Notifications</h4>
                                        <span className="text-[10px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">{displayNotifications.length} Unread</span>
                                    </div>
                                    {displayNotifications.length === 0 ? (
                                        <div className="p-4 text-center text-sm font-bold text-slate-400">You're all caught up!</div>
                                    ) : (
                                        displayNotifications.map(n => {
                                            let borderClass = 'border-primary-500 bg-primary-50/30';
                                            let textClass = 'text-primary-600';
                                            if (n.type === 'Overdue') {
                                                borderClass = 'border-rose-500 bg-rose-50/30';
                                                textClass = 'text-rose-600';
                                            } else if (n.type === 'Quotation') {
                                                borderClass = 'border-emerald-500 bg-emerald-50/30';
                                                textClass = 'text-emerald-600';
                                            } else if (n.type === 'Planning') {
                                                borderClass = 'border-amber-500 bg-amber-50/30';
                                                textClass = 'text-amber-600';
                                            } else if (n.type === 'Release') {
                                                borderClass = 'border-indigo-500 bg-indigo-50/30';
                                                textClass = 'text-indigo-600';
                                            } else if (n.type.startsWith('MEETING_')) {
                                                borderClass = 'border-teal-500 bg-teal-50/30';
                                                textClass = 'text-teal-600';
                                            }
                                            return (
                                                <div key={n._id} onClick={() => handleNotifClick(n)} className={`p-3 mx-2 mb-1 rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors border-l-4 ${borderClass}`}>
                                                    <div className="flex justify-between items-start mb-1">
                                                        <span className={`text-[10px] font-black uppercase tracking-widest ${textClass}`}>{formatNotificationType(n.type)}</span>
                                                        <button onClick={(e) => dismissNotification(n._id, e)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                                                            <MdCheck size={14} />
                                                        </button>
                                                    </div>
                                                    <p className="text-xs font-bold text-slate-800 dark:text-slate-100">{n.title}</p>
                                                    <p className="text-[10px] font-medium text-slate-600 dark:text-slate-400 mt-0.5 leading-snug">{n.message}</p>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="h-10 w-px bg-slate-100 dark:bg-slate-800 mx-1 hidden sm:block"></div>

                        {/* Profile Dropdown */}
                        <div className="relative" ref={dropdownRef}>
                            <button onClick={() => setIsProfileOpen(!isProfileOpen)} className="flex items-center gap-3 pl-2 pr-1 py-1 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all border border-transparent hover:border-slate-100 dark:hover:border-slate-800 outline-none">
                                <div className="text-right hidden md:block">
                                    <p className="text-sm font-black text-slate-900 dark:text-slate-100 leading-none">{user?.name || 'User'}</p>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{user?.role || 'User'}</p>
                                </div>
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-800 flex items-center justify-center shadow-sm overflow-hidden ring-1 ring-slate-200 dark:ring-slate-700 ring-offset-2 hover:ring-primary-600 transition-all">
                                    {user?.avatar ? (
                                        <img src={user.avatar} alt="Avatar" className="w-full h-full object-cover" />
                                    ) : (
                                        <span className="text-slate-600 dark:text-slate-200 font-bold text-sm">{user?.name?.charAt(0) || 'U'}</span>
                                    )}
                                </div>
                            </button>

                            {isProfileOpen && (
                                <div className="absolute top-full right-0 mt-3 w-64 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-800 py-2 animate-in fade-in slide-in-from-top-2 duration-200">
                                    <div className="px-4 py-3 border-b border-slate-50 dark:border-slate-800 mb-2">
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Signed in as</p>
                                        <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate mt-1">{user?.email}</p>
                                    </div>
                                    <div className="p-1">
                                        <Link to="/settings" onClick={() => setIsProfileOpen(false)} className="flex items-center gap-3 px-3 py-2.5 text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-primary-600 dark:hover:text-primary-400 rounded-xl transition-all">
                                            <MdSettings size={18} /> Settings
                                        </Link>
                                        <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-all">
                                            <MdLogout size={18} /> Sign Out
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </header>

            <ChangePasswordModal 
                isOpen={mustChangePasswordModal} 
                user={user} 
                onPasswordChanged={() => setMustChangePasswordModal(false)} 
            />
        </>
    );
};

export default Header;
