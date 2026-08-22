import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { landingPlanService } from '../services/api';
import './LandingPage.css';

const CounterItem = ({ 
    targetValue, 
    prefix = '', 
    suffix = '', 
    decimals = 0, 
    duration = 2000,
    intervalMs = 1500,
    stepAmount = 1,
    continuous = true,
    className = "text-4xl text-white font-extrabold mb-1 tracking-tight font-outfit"
}) => {
    const [count, setCount] = useState(0);
    const containerRef = useRef(null);
    const [hasAnimated, setHasAnimated] = useState(false);

    useEffect(() => {
        let timer = null;

        const observer = new IntersectionObserver((entries) => {
            if (entries[0] && entries[0].isIntersecting && !hasAnimated) {
                setHasAnimated(true);
                let startTimestamp = null;

                const step = (timestamp) => {
                    if (!startTimestamp) startTimestamp = timestamp;
                    const progress = Math.min((timestamp - startTimestamp) / duration, 1);
                    const easeProgress = 1 - (1 - progress) * (1 - progress);
                    const currentCount = easeProgress * targetValue;
                    setCount(currentCount);

                    if (progress < 1) {
                        window.requestAnimationFrame(step);
                    } else if (continuous) {
                        // Start continuous live increasing counter only if enabled
                        timer = setInterval(() => {
                            setCount(prev => prev + (decimals > 0 ? 0.01 : stepAmount));
                        }, intervalMs);
                    }
                };
                window.requestAnimationFrame(step);
            }
        }, { threshold: 0.2 });

        if (containerRef.current) {
            observer.observe(containerRef.current);
        }

        return () => {
            if (timer) clearInterval(timer);
            if (containerRef.current && containerRef.current instanceof Element) {
                observer.unobserve(containerRef.current);
            }
        };
    }, [targetValue, duration, hasAnimated, intervalMs, stepAmount, decimals, continuous]);

    const formattedValue = decimals > 0 
        ? count.toFixed(decimals) 
        : Math.floor(count).toLocaleString('en-IN');

    return (
        <span ref={containerRef} className={className}>
            {prefix}{formattedValue}{suffix}
        </span>
    );
};

const DEFAULT_FALLBACK_PLANS = [
    {
        tabKey: 'hrms_payroll',
        tabName: 'HRMS & Payroll',
        order: 1,
        tiers: [
            {
                tierName: 'FOUNDATION',
                subtitle: 'For companies that are just getting started with automation',
                buttonText: 'Free Trial',
                buttonLink: '/register',
                featuresHeader: 'Essential Automation Features',
                badge: '',
                categories: [
                    {
                        categoryName: 'CORE HR',
                        items: [
                            {
                                title: 'Org Structure Management',
                                description: 'Effortlessly define and manage complex hierarchical organizational structures that clearly define roles and responsibilities.',
                                isExpandable: true,
                                isIncluded: true
                            },
                            { title: 'Documents & Letters', description: 'Generate standard HR letters and manage documents centrally.', isExpandable: false, isIncluded: true },
                            { title: 'Employee Onboarding - Basic', description: 'Streamlined basic digital onboarding workflows for new hires.', isExpandable: false, isIncluded: true },
                            { title: 'Dynamic Employee Profiles', description: 'Comprehensive 360-degree employee profiles with custom fields.', isExpandable: false, isIncluded: true },
                            { title: 'Standard Access Roles', description: 'Pre-defined role permissions for admins, managers, and employees.', isExpandable: false, isIncluded: true },
                            { title: 'Employee Exit', description: 'Standard exit workflows and offboarding checklists.', isExpandable: false, isIncluded: true },
                            { title: 'Notification Engine - Basic', description: 'Automated email alerts for key HR milestones and reminders.', isExpandable: false, isIncluded: true },
                            { title: 'Reports - Basic', description: 'Standard employee directory and statutory compliance reports.', isExpandable: false, isIncluded: true }
                        ]
                    },
                    {
                        categoryName: 'TIME & ATTENDANCE',
                        items: [
                            { title: 'Attendance Tracking - Basic', description: 'Daily clock-in/clock-out tracking and monthly attendance sheets.', isExpandable: false, isIncluded: true },
                            { title: 'Shift & Leave Management', description: 'Configure custom leave policies, holidays, and shift schedules.', isExpandable: false, isIncluded: true }
                        ]
                    }
                ]
            },
            {
                tierName: 'STRENGTH',
                subtitle: 'Scaling with advanced automation & employee engagement',
                buttonText: 'Free Trial',
                buttonLink: '/register',
                featuresHeader: 'All Foundation Features+',
                badge: 'Popular',
                categories: [
                    {
                        categoryName: 'CORE HR',
                        items: [
                            { title: 'Employee Onboarding - Advanced', description: 'Multi-stage automated onboarding workflows with task assignments.', isExpandable: false, isIncluded: true },
                            { title: 'Keka Sign (e-signature)', description: 'Legally binding e-signatures for contracts and policy acknowledgments.', isExpandable: false, isIncluded: true },
                            { title: 'Travel Desk', description: 'End-to-end business travel requests, ticketing, and expense approvals.', isExpandable: false, isIncluded: true },
                            { title: 'Asset Tracking', description: 'Track company hardware, software licenses, and asset allocation.', isExpandable: false, isIncluded: true },
                            { title: 'People Analytics', description: 'Deep visual workforce trends, turnover rates, and demographic insights.', isExpandable: false, isIncluded: true },
                            { title: 'Employee Timeline', description: 'Complete history of promotions, transfers, performance reviews, and salary changes.', isExpandable: false, isIncluded: true },
                            { title: 'Custom Roles & Privileges', description: 'Granular access permission matrix customized to organizational needs.', isExpandable: false, isIncluded: true },
                            { title: 'Employee Exit Survey', description: 'Automated exit interview surveys and attrition cause analytics.', isExpandable: false, isIncluded: true },
                            { title: 'Notification Engine - Advanced', description: 'Multi-channel notifications via WhatsApp, Email, and Push notifications.', isExpandable: false, isIncluded: true },
                            { title: 'Reports - Advanced', description: 'Customizable report builder with scheduled automated export.', isExpandable: false, isIncluded: true }
                        ]
                    },
                    {
                        categoryName: 'TIME & ATTENDANCE',
                        items: [
                            { title: 'Selfie clock-in', description: 'Facial recognition & photo validation for mobile attendance.', isExpandable: false, isIncluded: true },
                            { title: 'Geo-fencing & GPS Attendance', description: 'Restrict punch-ins to designated office geofences or field sites.', isExpandable: false, isIncluded: true }
                        ]
                    }
                ]
            },
            {
                tierName: 'GROWTH',
                subtitle: 'With in-built performance management capabilities and business reviews',
                buttonText: 'Free Trial',
                buttonLink: '/register',
                featuresHeader: 'All Strength Features+',
                badge: 'Enterprise',
                categories: [
                    {
                        categoryName: 'CORE HR',
                        items: [
                            { title: 'Workflow Automation', description: 'Custom multi-step approval workflows across all HR operations.', isExpandable: false, isIncluded: true },
                            { title: 'Custom Reports Builder', description: 'Drag-and-drop report creator with SQL export and API hooks.', isExpandable: false, isIncluded: true },
                            { title: 'Headcount Planning', description: 'Budget forecasting and recruitment pipeline headcount projections.', isExpandable: false, isIncluded: true },
                            { title: 'Pre-boarding', description: 'Engage candidates post-offer before day one with digital portals.', isExpandable: false, isIncluded: true }
                        ]
                    },
                    {
                        categoryName: 'BUSINESS PERFORMANCE',
                        items: [
                            { title: 'Company Goals/OKRs', description: 'Cascading company objectives and key results tracking.', isExpandable: false, isIncluded: true },
                            { title: 'Department and Individual Goals', description: 'Align team goals directly with corporate strategy.', isExpandable: false, isIncluded: true },
                            { title: 'Goals Alignment', description: 'Visual goal dependency map and progress tracking.', isExpandable: false, isIncluded: true },
                            { title: 'Goal Insights', description: 'Real-time AI-powered quarterly goal completion forecasts.', isExpandable: false, isIncluded: true },
                            { title: 'Core Values', description: 'Peer recognition aligned with company core values.', isExpandable: false, isIncluded: true }
                        ]
                    },
                    {
                        categoryName: 'EMPLOYEE PERFORMANCE',
                        items: [
                            { title: 'Performance Appraisals & 360 Feedback', description: 'Annual/quarterly appraisal cycles with 360-degree reviews.', isExpandable: false, isIncluded: true },
                            { title: 'Continuous Feedback & One-on-Ones', description: 'Structured 1:1 meeting templates and continuous feedback logs.', isExpandable: false, isIncluded: true }
                        ]
                    }
                ]
            }
        ]
    },
    {
        tabKey: 'hiring',
        tabName: 'Hiring',
        order: 2,
        tiers: [
            {
                tierName: 'FOUNDATION',
                subtitle: 'Essential Applicant Tracking System for growing teams',
                buttonText: 'Free Trial',
                buttonLink: '/register',
                featuresHeader: 'Essential Hiring Features',
                badge: '',
                categories: [
                    {
                        categoryName: 'RECRUITMENT & ATS',
                        items: [
                            { title: 'Job Requisition Posting', description: 'Create and publish job openings on career pages.', isExpandable: false, isIncluded: true },
                            { title: 'Candidate Resume Database', description: 'Centralized database with automated candidate profile parsing.', isExpandable: false, isIncluded: true },
                            { title: 'Basic Interview Scheduling', description: 'Calendar integration for interview scheduling.', isExpandable: false, isIncluded: true }
                        ]
                    }
                ]
            },
            {
                tierName: 'STRENGTH',
                subtitle: 'Full-suite recruitment automation & candidate experience',
                buttonText: 'Free Trial',
                buttonLink: '/register',
                featuresHeader: 'All Foundation Features+',
                badge: 'Popular',
                categories: [
                    {
                        categoryName: 'RECRUITMENT & ATS',
                        items: [
                            { title: 'Multi-Job Board Distribution', description: '1-click job distribution to LinkedIn, Indeed, and Naukri.', isExpandable: false, isIncluded: true },
                            { title: 'Automated Candidate Screening', description: 'AI resume scoring and keyword match ranking.', isExpandable: false, isIncluded: true },
                            { title: 'Offer Letter Generator', description: 'E-sign offer letter dispatch with candidate portal.', isExpandable: false, isIncluded: true }
                        ]
                    }
                ]
            },
            {
                tierName: 'GROWTH',
                subtitle: 'High-volume hiring & AI talent acquisition suite',
                buttonText: 'Free Trial',
                buttonLink: '/register',
                featuresHeader: 'All Strength Features+',
                badge: 'Enterprise',
                categories: [
                    {
                        categoryName: 'ADVANCED ATS & TALENT',
                        items: [
                            { title: 'Recruitment Agency Portal', description: 'Manage third-party staffing agency submissions & commissions.', isExpandable: false, isIncluded: true },
                            { title: 'Talent Pool CRM', description: 'Nurture passive talent pipelines for future requisitions.', isExpandable: false, isIncluded: true },
                            { title: 'AI Video Interviewing', description: 'Asynchronous video assessment interviews.', isExpandable: false, isIncluded: true }
                        ]
                    }
                ]
            }
        ]
    },
    {
        tabKey: 'psa',
        tabName: 'Projects & TimeSheets (PSA)',
        order: 3,
        tiers: [
            {
                tierName: 'FOUNDATION',
                subtitle: 'Track project hours and employee time allocation',
                buttonText: 'Free Trial',
                buttonLink: '/register',
                featuresHeader: 'Essential PSA Features',
                badge: '',
                categories: [
                    {
                        categoryName: 'TIMESHEETS & PROJECTS',
                        items: [
                            { title: 'Weekly Timesheet Entry', description: 'Log project and task hours with manager sign-off.', isExpandable: false, isIncluded: true },
                            { title: 'Project Task Breakdown', description: 'Define milestones, deliverables, and task estimates.', isExpandable: false, isIncluded: true }
                        ]
                    }
                ]
            },
            {
                tierName: 'STRENGTH',
                subtitle: 'Resource utilization and project profitability management',
                buttonText: 'Free Trial',
                buttonLink: '/register',
                featuresHeader: 'All Foundation Features+',
                badge: 'Popular',
                categories: [
                    {
                        categoryName: 'TIMESHEETS & PROJECTS',
                        items: [
                            { title: 'Resource Capacity Planning', description: 'Visual heatmaps of team billable availability.', isExpandable: false, isIncluded: true },
                            { title: 'Client Billing & Invoicing', description: 'Convert billable hours directly into tax invoices.', isExpandable: false, isIncluded: true }
                        ]
                    }
                ]
            },
            {
                tierName: 'GROWTH',
                subtitle: 'Enterprise PSA with real-time financial margin tracking',
                buttonText: 'Free Trial',
                buttonLink: '/register',
                featuresHeader: 'All Strength Features+',
                badge: 'Enterprise',
                categories: [
                    {
                        categoryName: 'ENTERPRISE PSA',
                        items: [
                            { title: 'Project Profitability Analytics', description: 'Real-time revenue, cost, and gross margin per project.', isExpandable: false, isIncluded: true },
                            { title: 'Custom Billing Rates & Currencies', description: 'Multi-rate cards by seniority, role, and jurisdiction.', isExpandable: false, isIncluded: true }
                        ]
                    }
                ]
            }
        ]
    }
];

const PlanTierMatrix = () => {
    const [plans, setPlans] = useState(DEFAULT_FALLBACK_PLANS);
    const [activeTabKey, setActiveTabKey] = useState('hrms_payroll');
    const [expandedItems, setExpandedItems] = useState({});

    useEffect(() => {
        const fetchPlans = async () => {
            try {
                const savedLocal = localStorage.getItem('custom_landing_plans');
                if (savedLocal) {
                    const parsed = JSON.parse(savedLocal);
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        setPlans(parsed);
                    }
                }
                const res = await landingPlanService.getAll();
                const data = res.data?.data || [];
                if (data.length > 0) {
                    setPlans(data);
                }
            } catch (err) {
                console.warn("Using fallback default landing plans:", err);
            }
        };
        fetchPlans();
    }, []);

    const activePlan = plans.find(p => p.tabKey === activeTabKey) || plans[0];

    const toggleExpand = (itemKey) => {
        setExpandedItems(prev => ({ ...prev, [itemKey]: !prev[itemKey] }));
    };

    if (!activePlan) return null;

    return (
        <section className="py-24 px-6 bg-[#f7f9fb] border-y border-[#bbcabf]/30" id="pricing">
            <div className="max-w-[1280px] mx-auto space-y-12">
                {/* Header & Tabs */}
                <div className="text-center space-y-6 max-w-3xl mx-auto">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#006c49]/10 text-[#006c49] font-extrabold text-[11px] tracking-widest uppercase border border-[#006c49]/20 shadow-sm">
                        <span>Plans & Features Matrix</span>
                    </div>
                    <h2 className="text-3xl md:text-5xl font-black text-[#191c1e] tracking-tight leading-tight">
                        Built for companies at <span className="emerald-gradient-text">every scale</span>
                    </h2>
                    <p className="text-[#3c4a42] text-sm md:text-base font-semibold">
                        Explore module features across Foundation, Strength, and Growth tier plans.
                    </p>

                    {/* Navigation Tabs */}
                    <div className="flex justify-center border-b border-[#bbcabf]/40 gap-6 md:gap-12 max-w-3xl mx-auto pt-6 overflow-x-auto">
                        {plans.map(plan => {
                            const isActive = activeTabKey === plan.tabKey;
                            return (
                                <button
                                    key={plan.tabKey}
                                    onClick={() => setActiveTabKey(plan.tabKey)}
                                    className={`pb-4 px-3 font-black text-sm md:text-base transition-all whitespace-nowrap relative ${
                                        isActive 
                                            ? 'text-[#006c49] border-b-2 border-[#006c49]' 
                                            : 'text-[#3c4a42] hover:text-[#006c49]'
                                    }`}
                                >
                                    {plan.tabName}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* 3 Tier Grid (FOUNDATION, STRENGTH, GROWTH) */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch text-left">
                    {activePlan.tiers.map((tier, tierIdx) => (
                        <div 
                            key={tierIdx} 
                            className={`rounded-[2rem] p-8 border transition-all duration-300 relative flex flex-col justify-between h-full bg-white ${
                                tier.badge ? 'border-[#006c49]/40 shadow-2xl ring-4 ring-[#006c49]/10' : 'border-[#bbcabf]/30 shadow-sm hover:shadow-xl'
                            }`}
                        >
                            {tier.badge && (
                                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-[#006c49] text-white font-black text-[10px] tracking-widest uppercase shadow-lg">
                                    {tier.badge}
                                </div>
                            )}

                            <div className="space-y-6 flex-1 flex flex-col">
                                {/* Top Box */}
                                <div className="text-center space-y-3 pb-6 border-b border-slate-100">
                                    <h3 className="text-2xl font-black text-[#191c1e] tracking-wider uppercase">
                                        {tier.tierName}
                                    </h3>
                                    <p className="text-xs font-semibold text-[#3c4a42] min-h-[40px] flex items-center justify-center max-w-xs mx-auto leading-relaxed">
                                        {tier.subtitle}
                                    </p>
                                    <div className="pt-2">
                                        <Link 
                                            to={tier.buttonLink || '/register'}
                                            className="w-full inline-block py-3.5 px-6 rounded-2xl font-black text-white text-xs uppercase tracking-widest primary-gradient-btn transition-all shadow-xl hover:scale-105 active:scale-95 text-center"
                                        >
                                            {tier.buttonText || 'Free Trial'}
                                        </Link>
                                    </div>
                                </div>

                                {/* Features List Header */}
                                <div className="font-black text-xs text-[#191c1e] tracking-wider uppercase pt-2">
                                    {tier.featuresHeader}
                                </div>

                                {/* Categories */}
                                <div className="space-y-6 pt-2 flex-1">
                                    {tier.categories.map((cat, catIdx) => (
                                        <div key={catIdx} className="space-y-3">
                                            <div className="text-[10px] font-black uppercase tracking-widest text-[#3c4a42]/70">
                                                {cat.categoryName}
                                            </div>

                                            <ul className="space-y-3">
                                                {cat.items.map((item, itemIdx) => {
                                                    const itemKey = `${tierIdx}-${catIdx}-${itemIdx}`;
                                                    const isExpanded = !!expandedItems[itemKey];
                                                    const hasDesc = Boolean(item.description && item.description.trim());

                                                    return (
                                                        <li key={itemIdx} className="text-xs text-[#191c1e] font-semibold">
                                                            <div 
                                                                onClick={() => hasDesc && toggleExpand(itemKey)}
                                                                className={`flex items-start gap-2.5 ${hasDesc ? 'cursor-pointer group select-none' : ''}`}
                                                            >
                                                                <span className={`text-[10px] text-[#006c49] shrink-0 mt-0.5 transition-transform duration-200 ${isExpanded ? 'rotate-90 text-[#006c49] font-black' : 'group-hover:text-[#006c49]'}`}>
                                                                    ▶
                                                                </span>
                                                                <span className={`flex-1 ${isExpanded ? 'text-[#006c49] font-bold' : 'group-hover:text-[#006c49]'}`}>
                                                                    {item.title}
                                                                </span>
                                                            </div>

                                                            {/* Expandable description accordion */}
                                                            {hasDesc && isExpanded && (
                                                                <div className="mt-2.5 ml-4 p-3 bg-[#006c49]/5 border border-[#006c49]/20 rounded-2xl text-[11px] text-[#004d34] font-medium leading-relaxed animate-in fade-in duration-200">
                                                                    {item.description}
                                                                </div>
                                                            )}
                                                        </li>
                                                    );
                                                })}
                                            </ul>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
};

const LandingPage = () => {
    useEffect(() => {
        // Load Material Symbols stylesheet dynamically
        const link = document.createElement('link');
        link.href = "https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap";
        link.rel = "stylesheet";
        document.head.appendChild(link);

        // Simple scroll interaction for navbar
        const handleScroll = () => {
            const nav = document.querySelector('header');
            if (nav) {
                if (window.scrollY > 20) {
                    nav.classList.add('shadow-md');
                } else {
                    nav.classList.remove('shadow-md');
                }
            }
        };
        window.addEventListener('scroll', handleScroll);

        return () => {
            if (document.head.contains(link)) {
                document.head.removeChild(link);
            }
            window.removeEventListener('scroll', handleScroll);
        };
    }, []);

    return (
        <div className="bg-[#f7f9fb] text-[#191c1e] min-h-screen font-sans">
            {/* TopNavBar */}
            <header className="fixed top-0 w-full z-50 bg-[#f7f9fb]/80 backdrop-blur-md border-b border-[#bbcabf]/30 shadow-sm transition-all duration-300">
                <nav className="max-w-[1280px] mx-auto flex items-center justify-between px-6 h-20">
                    <div className="flex items-center gap-10">
                        <Link to="/" className="text-xl font-extrabold text-[#006c49] tracking-tight flex items-center gap-2">
                            <span className="material-symbols-outlined text-[#10b981]" style={{ fontVariationSettings: "'FILL' 1" }}>dataset</span>
                            ARCRM
                        </Link>
                        <div className="hidden md:flex gap-6">
                            <a className="font-semibold text-xs text-[#006c49] border-b-2 border-[#006c49] pb-1" href="#features">Features</a>
                            <a className="font-semibold text-xs text-[#3c4a42] hover:text-[#006c49] transition-colors" href="#solutions">Solutions</a>
                            <a className="font-semibold text-xs text-[#3c4a42] hover:text-[#006c49] transition-colors" href="#industries">Industries</a>
                            <a className="font-semibold text-xs text-[#3c4a42] hover:text-[#006c49] transition-colors" href="#pricing">Pricing</a>
                            <a className="font-semibold text-xs text-[#3c4a42] hover:text-[#006c49] transition-colors" href="#resources">Resources</a>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <Link to="/login" className="px-4 py-2 font-semibold text-xs text-[#3c4a42] hover:text-[#006c49] transition-all">Login</Link>
                        <Link to="/register" className="primary-gradient-btn text-white px-6 py-2 rounded-lg font-semibold text-xs shadow-md hover:scale-105 transition-transform active:scale-95">Book a Demo</Link>
                    </div>
                </nav>
            </header>

            <main className="pt-20 overflow-x-hidden">
                {/* Hero Section */}
                <section className="relative pt-8 pb-24 px-6">
                    <div className="max-w-[1280px] mx-auto grid lg:grid-cols-2 gap-16 items-center">
                        <div className="z-10 text-left">
                            <div className="inline-flex items-center gap-2 px-4 py-1 bg-[#006c49]/10 text-[#006c49] rounded-full mb-4 animate-pulse">
                                <span className="material-symbols-outlined text-[16px]">spark</span>
                                <span className="text-[11px] font-semibold uppercase tracking-wider">New: AI-Powered Product Categorization</span>
                            </div>
                            <h1 className="text-4xl lg:text-5xl font-extrabold text-[#191c1e] mb-4 leading-tight">
                                Win More Deals with <span className="emerald-gradient-text">Better Quotes.</span>
                            </h1>
                            <p className="text-[#3c4a42] text-base mb-8 max-w-lg leading-relaxed">
                                ARCRM is the all-in-one enterprise quotation and CRM platform to create quotations, manage customers, automate approvals, track sales, and grow revenue.
                            </p>
                            <div className="flex flex-wrap gap-4 mb-8">
                                <Link to="/register" className="primary-gradient-btn text-white px-8 py-3 rounded-xl font-semibold text-base shadow-lg hover:shadow-[#006c49]/20 transition-all">Get Started Free</Link>
                                <Link to="/login" className="bg-[#f7f9fb] border border-[#6c7a71] px-8 py-3 rounded-xl font-semibold text-base text-[#006c49] hover:bg-[#f2f4f6] transition-all">Book a Demo</Link>
                            </div>
                            <div className="flex gap-6 text-[#3c4a42]">
                                <div className="flex items-center gap-2"><span class="material-symbols-outlined text-[#006c49] text-[18px]">verified_user</span> <span className="text-xs font-medium">No credit card</span></div>
                                <div className="flex items-center gap-2"><span class="material-symbols-outlined text-[#006c49] text-[18px]">group</span> <span className="text-xs font-medium">Unlimited users</span></div>
                                <div className="flex items-center gap-2"><span class="material-symbols-outlined text-[#006c49] text-[18px]">speed</span> <span className="text-xs font-medium">Setup in minutes</span></div>
                            </div>
                        </div>

                        {/* Right Side Mockup + Live Floating Glass Cards */}
                        <div className="relative lg:h-[600px] flex items-center justify-center">
                            {/* Main Dashboard Mockup */}
                            <div className="relative z-0 w-full max-w-2xl rounded-2xl overflow-hidden shadow-2xl border border-[#bbcabf]/30 bg-white">
                                <img 
                                    className="w-full h-auto" 
                                    alt="ARCRM Dashboard Screenshot" 
                                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuBr4V-tWhu-wSs9ieDUYP8Z1Pp9f7WLvhDIg7oUV8v3Q0NuyYyLgUI2ILSkZ--U0jsYv5yxoKjrmGnSDQVAjDMYSMyxVelYVM1DDtCwecYON2LD0gVBFwyJ3p645coylw5VZ1owgIv30xmftbxveJSq8pt_qE4I4yyx8auuNWfPPNOXG22okN3-MmdRidh7AgOcfes4Hm9tYvgJBybG9t9zoCFabJLA6dSrbvqV4ZhnFsMGNAT1MPsOdUTHpVtN3HsE9-lDR0Grdzg" 
                                />
                            </div>

                            {/* Floating Glassmorphic Cards */}
                            <div className="absolute -top-4 -right-4 z-20 glass-card p-4 rounded-xl w-48 floating" style={{ animationDelay: '0s' }}>
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-[11px] font-semibold text-[#64748B] uppercase">Revenue</span>
                                    <span className="material-symbols-outlined text-[#006c49]">trending_up</span>
                                </div>
                                <div className="text-xl font-bold text-[#191c1e]">
                                    <CounterItem targetValue={8450000} prefix="₹" intervalMs={1500} stepAmount={2500} className="font-bold" />
                                </div>
                            </div>

                            <div className="absolute top-1/2 -left-12 z-20 glass-card p-4 rounded-xl w-44 floating" style={{ animationDelay: '0.5s' }}>
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-[11px] font-semibold text-[#64748B] uppercase">Conversion</span>
                                    <span className="material-symbols-outlined text-[#006c49]">percent</span>
                                </div>
                                <div className="text-xl font-bold text-[#191c1e]">
                                    <CounterItem targetValue={12.5} suffix="%" decimals={1} intervalMs={3000} stepAmount={0.1} className="font-bold" />
                                </div>
                            </div>

                            <div className="absolute bottom-12 -right-8 z-20 glass-card p-4 rounded-xl w-44 floating" style={{ animationDelay: '1s' }}>
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-[11px] font-semibold text-[#64748B] uppercase">New Clients</span>
                                    <span className="material-symbols-outlined text-[#006c49]">person_add</span>
                                </div>
                                <div className="text-xl font-bold text-[#191c1e]">
                                    <CounterItem targetValue={1420} intervalMs={2000} stepAmount={1} className="font-bold" />
                                </div>
                            </div>

                            <div className="absolute -bottom-6 left-1/4 z-20 glass-card p-4 rounded-xl w-52 floating" style={{ animationDelay: '1.5s' }}>
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-[11px] font-semibold text-[#64748B] uppercase">Unpaid Quotes</span>
                                    <span className="material-symbols-outlined text-[#ba1a1a]">warning</span>
                                </div>
                                <div className="text-xl font-bold text-[#191c1e]">
                                    <CounterItem targetValue={320000} prefix="₹" intervalMs={2500} stepAmount={500} className="font-bold" />
                                </div>
                            </div>

                            {/* Decorative Blur Background */}
                            <div className="absolute -z-10 w-[120%] h-[120%] bg-[#006c49]/5 blur-3xl rounded-full"></div>
                        </div>
                    </div>
                </section>

                {/* Social Proof */}
                <section className="py-6 bg-[#ffffff]">
                    <div className="max-w-[1280px] mx-auto px-6">
                        <p className="text-center text-xs font-semibold text-[#3c4a42] uppercase tracking-widest mb-6">Trusted by growing businesses</p>
                        <div className="flex flex-wrap justify-center gap-10 opacity-60 grayscale hover:grayscale-0 transition-all duration-500">
                            <div className="flex items-center gap-2"><span className="material-symbols-outlined text-[#006c49]">corporate_fare</span><span className="font-bold text-xl">Acme Corp</span></div>
                            <div className="flex items-center gap-2"><span className="material-symbols-outlined text-[#006c49]">memory</span><span className="font-bold text-xl">Tech Solutions</span></div>
                            <div className="flex items-center gap-2"><span className="material-symbols-outlined text-[#006c49]">language</span><span className="font-bold text-xl">Global Industries</span></div>
                            <div className="flex items-center gap-2"><span className="material-symbols-outlined text-[#006c49]">brush</span><span className="font-bold text-xl">Design Studio</span></div>
                            <div className="flex items-center gap-2"><span className="material-symbols-outlined text-[#006c49]">architecture</span><span className="font-bold text-xl">BuildCo</span></div>
                        </div>
                    </div>
                </section>

                {/* Stats Strip */}
                <section className="bg-[#059669] py-16">
                    <div className="max-w-[1280px] mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-10 text-center">
                        <div>
                            <CounterItem targetValue={10480} suffix="+" intervalMs={1200} stepAmount={1} className="text-4xl text-white font-extrabold mb-1 tracking-tight font-outfit block" />
                            <div className="text-white/80 font-semibold text-xs uppercase tracking-wider">Quotations Created</div>
                        </div>
                        <div>
                            <CounterItem targetValue={500} suffix="+" intervalMs={2000} stepAmount={1} className="text-4xl text-white font-extrabold mb-1 tracking-tight font-outfit block" />
                            <div className="text-white/80 font-semibold text-xs uppercase tracking-wider">Enterprises</div>
                        </div>
                        <div>
                            <CounterItem targetValue={500} prefix="₹" suffix="Cr+" intervalMs={2500} stepAmount={1} className="text-4xl text-white font-extrabold mb-1 tracking-tight font-outfit block" />
                            <div className="text-white/80 font-semibold text-xs uppercase tracking-wider">Deals Managed</div>
                        </div>
                        <div>
                            <CounterItem targetValue={99.9} suffix="%" decimals={1} continuous={false} className="text-4xl text-white font-extrabold mb-1 tracking-tight font-outfit block" />
                            <div className="text-white/80 font-semibold text-xs uppercase tracking-wider">Uptime SLA</div>
                        </div>
                    </div>
                </section>

                {/* Foundation, Strength, Growth Plan Tier Matrix */}
                <PlanTierMatrix />

                {/* Why ARCRM Table */}
                <section className="py-24 px-6 bg-[#f2f4f6]" id="solutions">
                    <div className="max-w-[1280px] mx-auto">
                        <h2 className="text-3xl font-semibold text-center mb-16">The modern choice for <span className="emerald-gradient-text">Sales Teams</span></h2>
                        <div className="overflow-x-auto rounded-2xl border border-[#bbcabf]/30 shadow-lg bg-white">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="bg-[#e0e3e5] border-b border-[#bbcabf]/30">
                                        <th className="p-6 font-semibold text-lg">Feature</th>
                                        <th className="p-6 font-semibold text-lg text-[#006c49]">ARCRM</th>
                                        <th className="p-6 font-semibold text-lg opacity-50">Legacy ERP</th>
                                        <th className="p-6 font-semibold text-lg opacity-50">Manual Excel</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[#bbcabf]/20">
                                    <tr>
                                        <td className="p-6 font-semibold text-base text-[#191c1e]">Quote Gen Time</td>
                                        <td className="p-6 text-[#006c49] font-bold"><div className="flex items-center gap-2"><span className="material-symbols-outlined">check_circle</span> &lt; 2 mins</div></td>
                                        <td className="p-6 text-[#3c4a42]">15-30 mins</td>
                                        <td className="p-6 text-[#3c4a42]">1+ Hour</td>
                                    </tr>
                                    <tr>
                                        <td className="p-6 font-semibold text-base text-[#191c1e]">Mobile Approval</td>
                                        <td className="p-6 text-[#006c49] font-bold"><div className="flex items-center gap-2"><span className="material-symbols-outlined">check_circle</span> Instant</div></td>
                                        <td className="p-6 text-[#3c4a42]">VPN Required</td>
                                        <td className="p-6 text-[#3c4a42]">Email Chain</td>
                                    </tr>
                                    <tr>
                                        <td className="p-6 font-semibold text-base text-[#191c1e]">AI Forecasting</td>
                                        <td className="p-6 text-[#006c49] font-bold"><div className="flex items-center gap-2"><span className="material-symbols-outlined">check_circle</span> Advanced</div></td>
                                        <td className="p-6 text-[#3c4a42]">Limited</td>
                                        <td className="p-6 text-[#3c4a42]">None</td>
                                    </tr>
                                    <tr>
                                        <td className="p-6 font-semibold text-base text-[#191c1e]">Deployment</td>
                                        <td className="p-6 text-[#006c49] font-bold"><div className="flex items-center gap-2"><span className="material-symbols-outlined">check_circle</span> Cloud Native</div></td>
                                        <td className="p-6 text-[#3c4a42]">On-Premise</td>
                                        <td className="p-6 text-[#3c4a42]">Local File</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </section>

                {/* Testimonials */}
                <section className="py-24 px-6">
                    <div className="max-w-[1280px] mx-auto">
                        <div className="glass-card p-12 rounded-2xl relative overflow-hidden flex flex-col md:flex-row items-center gap-12">
                            <div className="w-32 h-32 md:w-48 md:h-48 rounded-full overflow-hidden flex-shrink-0 border-4 border-[#006c49]/20">
                                <img className="w-full h-full object-cover" alt="Rahul Mehta, CEO of Tech Solutions" src="https://lh3.googleusercontent.com/aida-public/AB6AXuC1SBIw5Wz7jqGIOLazkOGXc24yoWw2KU-Q-6tcUhdPg-_TPD4AbhTdHSKSXJZ0RSXjTfFlSPbeGUGFNqLcO6utSSGG4nGa65zVNpZ8lSjBOQLSVB4G7mgLAC57PUuORQsgNbbqU06QxTO92ostxm0eaRV6SPT_AtWsvGmmHBc6i3KiQ4Jpw2mX0AnutIRoGILiIplzZlEhlyVKaZo8Ca5drR12nm2BKFs7E4DyJ5oLLju99YkR1F2QYDrHPmgZUJmzP_W2K2GSCks" />
                            </div>
                            <div className="text-left">
                                <span className="material-symbols-outlined text-[#006c49] text-[64px] opacity-20 mb-4">format_quote</span>
                                <p className="text-xl md:text-2xl font-semibold text-[#191c1e] mb-6 italic leading-tight">
                                    "ARCRM has completely transformed our quotation process. We close deals 34% faster now with the automated approval workflows and AI-driven insights."
                                </p>
                                <div>
                                    <div className="font-bold text-lg text-[#006c49]">Rahul Mehta</div>
                                    <div className="text-[#3c4a42] text-xs font-semibold">CEO, Tech Solutions</div>
                                    <div className="flex text-[#006c49] mt-2">
                                        <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                                        <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                                        <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                                        <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                                        <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Final CTA */}
                <section className="py-24 bg-[#ffffff]">
                    <div className="max-w-4xl mx-auto px-6 text-center">
                        <h2 className="text-4xl lg:text-5xl font-bold mb-6 leading-tight">Ready to transform your <br /><span className="emerald-gradient-text">sales cycle?</span></h2>
                        <p className="text-[#3c4a42] text-base mb-10">Join over 500+ global enterprises winning more deals every day with ARCRM.</p>
                        <div className="flex flex-col sm:flex-row justify-center gap-4">
                            <Link to="/register" className="primary-gradient-btn text-white px-8 py-3 rounded-xl font-semibold text-base shadow-xl hover:scale-105 transition-all text-center">Get Started For Free</Link>
                            <Link to="/login" className="bg-[#f7f9fb] border border-[#6c7a71] px-8 py-3 rounded-xl font-semibold text-base text-[#006c49] hover:bg-[#f2f4f6] transition-all text-center">Schedule Demo</Link>
                        </div>
                    </div>
                </section>
            </main>

            {/* Footer */}
            <footer className="bg-[#ffffff] border-t border-[#bbcabf]/30 w-full py-16">
                <div className="max-w-[1280px] mx-auto px-6 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
                    <div className="col-span-2 text-left">
                        <span className="text-xl font-bold text-[#006c49] mb-4 block">ARCRM</span>
                        <p className="text-[#3c4a42] text-xs mb-6 max-w-xs leading-relaxed">The enterprise standard for quotation management and sales automation. Built for speed, scale, and accuracy.</p>
                        <div className="flex gap-4">
                            <a className="w-10 h-10 rounded-full bg-[#e6e8ea] flex items-center justify-center text-[#006c49] hover:bg-[#006c49] hover:text-white transition-all" href="#"><span className="material-symbols-outlined text-[20px]">public</span></a>
                            <a className="w-10 h-10 rounded-full bg-[#e6e8ea] flex items-center justify-center text-[#006c49] hover:bg-[#006c49] hover:text-white transition-all" href="#"><span className="material-symbols-outlined text-[20px]">alternate_email</span></a>
                        </div>
                    </div>
                    <div className="text-left">
                        <h4 className="font-bold mb-4 text-[#191c1e] text-sm">Product</h4>
                        <ul className="space-y-2 text-xs">
                            <li><a className="text-[#3c4a42] hover:text-[#006c49] transition-all" href="#features">Features</a></li>
                            <li><a className="text-[#3c4a42] hover:text-[#006c49] transition-all" href="#solutions">Solutions</a></li>
                            <li><a className="text-[#3c4a42] hover:text-[#006c49] transition-all" href="#">Integrations</a></li>
                            <li><a className="text-[#3c4a42] hover:text-[#006c49] transition-all" href="#pricing">Pricing</a></li>
                        </ul>
                    </div>
                    <div className="text-left">
                        <h4 className="font-bold mb-4 text-[#191c1e] text-sm">Resources</h4>
                        <ul className="space-y-2 text-xs">
                            <li><a className="text-[#3c4a42] hover:text-[#006c49] transition-all" href="#">Documentation</a></li>
                            <li><a className="text-[#3c4a42] hover:text-[#006c49] transition-all" href="#">API Reference</a></li>
                            <li><a className="text-[#3c4a42] hover:text-[#006c49] transition-all" href="#">Case Studies</a></li>
                            <li><a className="text-[#3c4a42] hover:text-[#006c49] transition-all" href="#">Blog</a></li>
                        </ul>
                    </div>
                    <div className="text-left">
                        <h4 className="font-bold mb-4 text-[#191c1e] text-sm">Company</h4>
                        <ul className="space-y-2 text-xs">
                            <li><a className="text-[#3c4a42] hover:text-[#006c49] transition-all" href="#">About Us</a></li>
                            <li><a className="text-[#3c4a42] hover:text-[#006c49] transition-all" href="#">Careers</a></li>
                            <li><a className="text-[#3c4a42] hover:text-[#006c49] transition-all" href="#">Security</a></li>
                            <li><a className="text-[#3c4a42] hover:text-[#006c49] transition-all" href="#">Contact</a></li>
                        </ul>
                    </div>
                    <div className="text-left">
                        <h4 className="font-bold mb-4 text-[#191c1e] text-sm">Legal</h4>
                        <ul className="space-y-2 text-xs">
                            <li><a className="text-[#3c4a42] hover:text-[#006c49] transition-all" href="#">Privacy Policy</a></li>
                            <li><a className="text-[#3c4a42] hover:text-[#006c49] transition-all" href="#">Terms of Service</a></li>
                            <li><a className="text-[#3c4a42] hover:text-[#006c49] transition-all" href="#">Compliance</a></li>
                        </ul>
                    </div>
                </div>
                <div className="max-w-[1280px] mx-auto px-6 mt-10 pt-6 border-t border-[#bbcabf]/30 flex flex-col md:flex-row justify-between items-center gap-4">
                    <p className="text-[#3c4a42] text-xs font-semibold">© 2024 ARCRM Enterprise Systems. All rights reserved.</p>
                    <div className="flex gap-6 text-xs font-semibold">
                        <a className="text-[#3c4a42] hover:text-[#006c49] transition-colors" href="#">Privacy</a>
                        <a className="text-[#3c4a42] hover:text-[#006c49] transition-colors" href="#">Terms</a>
                        <a className="text-[#3c4a42] hover:text-[#006c49] transition-colors" href="#">Cookies</a>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default LandingPage;

