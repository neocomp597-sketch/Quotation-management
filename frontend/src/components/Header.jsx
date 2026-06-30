import React, { useState, useRef, useEffect, useMemo } from 'react';
import { MdSearch, MdNotifications, MdLogout, MdMenu, MdSettings, MdCheck } from 'react-icons/md';
import { useNavigate, Link } from 'react-router-dom';
import { notificationService, systemUpdateService } from '../services/api';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';

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

const Header = ({ sidebarOpen, toggleSidebar }) => {
    const navigate = useNavigate();
    const { user, logout, isAdmin, isSuperAdmin, hasAccess } = useAuth();
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [isNotifOpen, setIsNotifOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearchOpen, setIsSearchOpen] = useState(false);
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
            
            // Trigger popup toast for overdue & today on mount
            const overdue = notificationRes.data.filter(n => n.type === 'Overdue');
            const reminder = notificationRes.data.filter(n => n.type === 'Reminder');
            
            if (overdue.length > 0) {
                toast.error(`You have ${overdue.length} overdue follow-ups!`, { position: 'top-right', autoClose: false });
            }
            if (reminder.length > 0) {
                toast.info(`You have ${reminder.length} follow-ups scheduled for today.`, { position: 'top-right' });
            }
        } catch (err) {
            console.error("Failed to fetch notifications", err);
        }
    };

    // Auto-fetch on mount and then every few minutes
    useEffect(() => {
        const initialFetchTimer = setTimeout(() => {
            void fetchNotifications();
        }, 0);
        const interval = setInterval(() => {
            void fetchNotifications();
        }, 5 * 60 * 1000); // 5 mins

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

    useEffect(() => {
        if (
            isNotifOpen &&
            systemUpdateNotification &&
            localStorage.getItem('lastSeenSystemVersion') === systemUpdateNotification.version
        ) {
            setSystemUpdateNotification(null);
        }
    }, [isNotifOpen, systemUpdateNotification]);

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
                if (n.relatedId) {
                    navigate(`/quotations/${n.relatedId}`);
                } else {
                    navigate('/quotations');
                }
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
            .slice(0, 6);
    }, [allowedSearchPages, searchQuery]);

    const goToSearchMatch = (page) => {
        if (!page) return;
        navigate(page.path);
        setSearchQuery('');
        setIsSearchOpen(false);
    };

    const handleSearchSubmit = (event) => {
        event.preventDefault();
        const query = normalizeSearchText(searchQuery);
        if (!query) return;

        const match = searchMatches[0];
        if (match) {
            goToSearchMatch(match);
        } else {
            toast.info('No matching page found');
        }
    };

    return (
        <header className={`fixed top-0 right-0 h-20 bg-white/80 backdrop-blur-xl border-b border-slate-100 z-40 transition-all duration-300 left-0 ${sidebarOpen ? 'md:left-64' : 'md:left-20'}`}>
            <div className="h-full px-6 flex items-center justify-between gap-4">
                <div className="flex items-center gap-4 flex-1">
                    <button onClick={toggleSidebar} className="p-2 -ml-2 text-slate-500 hover:bg-slate-50 rounded-xl md:hidden transition-colors">
                        <MdMenu size={24} />
                    </button>

                    <form ref={searchRef} onSubmit={handleSearchSubmit} className="relative w-full max-w-lg hidden sm:block group">
                        <MdSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary-600 transition-colors" size={20} />
                        <input
                            type="text"
                            placeholder="Find quotes, customers, products..."
                            value={searchQuery}
                            onChange={(event) => {
                                setSearchQuery(event.target.value);
                                setIsSearchOpen(true);
                            }}
                            onFocus={() => setIsSearchOpen(true)}
                            className="w-full pl-12 pr-4 py-2.5 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-primary-600/20 focus:bg-white transition-all outline-none text-sm font-semibold text-slate-900 placeholder:text-slate-400"
                        />
                        {isSearchOpen && searchQuery.trim() && (
                            <div className="absolute left-0 right-0 top-full mt-3 bg-white border border-slate-100 shadow-2xl rounded-2xl overflow-hidden py-2 animate-in fade-in slide-in-from-top-2 duration-150">
                                {searchMatches.length > 0 ? (
                                    searchMatches.map((page) => (
                                        <button
                                            key={page.path}
                                            type="button"
                                            onMouseDown={(event) => event.preventDefault()}
                                            onClick={() => goToSearchMatch(page)}
                                            className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors"
                                        >
                                            <span className="text-sm font-black text-slate-800">{page.label}</span>
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{page.path}</span>
                                        </button>
                                    ))
                                ) : (
                                    <div className="px-4 py-3 text-sm font-bold text-slate-400">No matching page found</div>
                                )}
                            </div>
                        )}
                    </form>
                </div>

                <div className="flex items-center gap-3">
                    <div className="relative" ref={notifRef}>
                        <button 
                            onClick={() => {
                                const nextState = !isNotifOpen;
                                setIsNotifOpen(nextState);
                                if (nextState) {
                                    void fetchNotifications();
                                }
                            }}
                            className="relative p-2.5 rounded-2xl bg-slate-50 text-slate-500 hover:text-primary-600 hover:bg-white hover:ring-1 hover:ring-slate-100 transition-all flex"
                        >
                            <MdNotifications size={22} />
                            {displayNotifications.length > 0 && (
                                <span className="absolute top-1.5 right-1.5 w-3 h-3 bg-rose-500 border-2 border-white rounded-full"></span>
                            )}
                        </button>
                        
                        {isNotifOpen && (
                            <div className="absolute top-full right-0 mt-3 w-80 max-h-96 overflow-y-auto bg-white rounded-2xl shadow-2xl border border-slate-100 py-3 animate-in fade-in slide-in-from-top-2 duration-200">
                                <div className="px-4 pb-2 border-b border-slate-50 mb-2 flex justify-between items-center">
                                    <h4 className="font-black text-slate-900">Notifications</h4>
                                    <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{displayNotifications.length} Unread</span>
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
                                            <div key={n._id} onClick={() => handleNotifClick(n)} className={`p-3 mx-2 mb-1 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors border-l-4 ${borderClass}`}>
                                                <div className="flex justify-between items-start mb-1">
                                                    <span className={`text-[10px] font-black uppercase tracking-widest ${textClass}`}>{formatNotificationType(n.type)}</span>
                                                    <button onClick={(e) => dismissNotification(n._id, e)} className="text-slate-400 hover:text-slate-600">
                                                        <MdCheck size={14} />
                                                    </button>
                                                </div>
                                                <p className="text-xs font-bold text-slate-800">{n.title}</p>
                                                <p className="text-[10px] font-medium text-slate-600 mt-0.5 leading-snug">{n.message}</p>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        )}
                    </div>

                    <div className="h-10 w-px bg-slate-100 mx-2 hidden sm:block"></div>

                    <div className="relative" ref={dropdownRef}>
                        <button onClick={() => setIsProfileOpen(!isProfileOpen)} className="flex items-center gap-3 pl-2 pr-1 py-1 rounded-2xl hover:bg-slate-50 transition-all border border-transparent hover:border-slate-100 outline-none">
                            <div className="text-right hidden md:block">
                                <p className="text-sm font-black text-slate-900 leading-none">{user?.name || 'User'}</p>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{user?.role || 'User'}</p>
                            </div>
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center shadow-sm overflow-hidden ring-1 ring-slate-200 ring-offset-2 hover:ring-primary-600 transition-all">
                                {user?.avatar ? (
                                    <img src={user.avatar} alt="Avatar" className="w-full h-full object-cover" />
                                ) : (
                                    <span className="text-slate-600 font-bold text-sm">{user?.name?.charAt(0) || 'U'}</span>
                                )}
                            </div>
                        </button>

                        {isProfileOpen && (
                            <div className="absolute top-full right-0 mt-3 w-64 bg-white rounded-2xl shadow-2xl border border-slate-100 py-2 animate-in fade-in slide-in-from-top-2 duration-200">
                                <div className="px-4 py-3 border-b border-slate-50 mb-2">
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Signed in as</p>
                                    <p className="text-sm font-bold text-slate-900 truncate mt-1">{user?.email}</p>
                                </div>
                                <div className="p-1">
                                    <Link to="/settings" onClick={() => setIsProfileOpen(false)} className="flex items-center gap-3 px-3 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50 hover:text-primary-600 rounded-xl transition-all">
                                        <MdSettings size={18} /> Settings
                                    </Link>
                                    <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-bold text-rose-600 hover:bg-rose-50 rounded-xl transition-all">
                                        <MdLogout size={18} /> Sign Out
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </header>
    );
};

export default Header;
