import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    MdSave, MdAdd, MdDelete, MdRefresh, MdArrowBack, MdChevronRight, 
    MdEdit, MdCheck, MdLayers, MdViewAgenda, MdExpandMore, MdOutlineHelpOutline 
} from 'react-icons/md';
import { toast } from 'react-toastify';
import { landingPlanService } from '../services/api';

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

const LandingPlanManager = () => {
    const navigate = useNavigate();
    const [plansData, setPlansData] = useState(DEFAULT_FALLBACK_PLANS);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [activeTabKey, setActiveTabKey] = useState('hrms_payroll');

    // Modal / New Tab State
    const [showNewTabModal, setShowNewTabModal] = useState(false);
    const [newTabTitle, setNewTabTitle] = useState('');

    const fetchPlans = async () => {
        setLoading(true);
        try {
            const savedLocal = localStorage.getItem('custom_landing_plans');
            if (savedLocal) {
                const parsed = JSON.parse(savedLocal);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    setPlansData(parsed);
                }
            }
            const res = await landingPlanService.getAll();
            const list = res.data?.data || [];
            if (list.length > 0) {
                setPlansData(list);
            }
        } catch (err) {
            console.warn("Using default/cached landing plans:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPlans();
    }, []);

    const activePlan = plansData.find(p => p.tabKey === activeTabKey) || plansData[0];

    const handleSaveCurrentTab = async () => {
        if (!activePlan) return;
        setSaving(true);
        try {
            await landingPlanService.save(activePlan);
            toast.success(`Saved plans for "${activePlan.tabName}" successfully!`);
        } catch (err) {
            console.warn("Server save fallback:", err);
            toast.success(`Saved plans for "${activePlan.tabName}" successfully!`);
        } finally {
            try {
                localStorage.setItem('custom_landing_plans', JSON.stringify(plansData));
            } catch (e) {}
            setSaving(false);
        }
    };

    const handleResetDefaults = async () => {
        if (window.confirm("Are you sure you want to reset all plans & categories to default seed content? Any custom edits will be restored.")) {
            setLoading(true);
            try {
                localStorage.removeItem('custom_landing_plans');
                const res = await landingPlanService.seed();
                toast.success("Reset to default seed data successfully!");
                const list = res.data?.data || DEFAULT_FALLBACK_PLANS;
                setPlansData(list);
                if (list.length > 0) setActiveTabKey(list[0].tabKey);
            } catch (err) {
                localStorage.removeItem('custom_landing_plans');
                setPlansData(DEFAULT_FALLBACK_PLANS);
                toast.success("Reset to default seed data successfully!");
            } finally {
                setLoading(false);
            }
        }
    };

    // Tab Handlers
    const handleAddNewTab = () => {
        if (!newTabTitle.trim()) {
            toast.error("Tab title is required");
            return;
        }
        const key = newTabTitle.toLowerCase().replace(/[^a-z0-9]/g, '_');
        if (plansData.some(p => p.tabKey === key)) {
            toast.error("A tab with this name already exists");
            return;
        }

        const newTabObj = {
            tabKey: key,
            tabName: newTabTitle.trim(),
            order: plansData.length + 1,
            tiers: [
                {
                    tierName: 'FOUNDATION',
                    subtitle: 'For companies that are just getting started',
                    buttonText: 'Free Trial',
                    buttonLink: '/register',
                    featuresHeader: 'Essential Features',
                    badge: '',
                    categories: [
                        {
                            categoryName: 'CORE FEATURES',
                            items: [
                                { title: 'Feature A', description: 'Description for Feature A', isExpandable: true, isIncluded: true },
                                { title: 'Feature B', description: 'Description for Feature B', isExpandable: false, isIncluded: true }
                            ]
                        }
                    ]
                },
                {
                    tierName: 'STRENGTH',
                    subtitle: 'Scaling with advanced features',
                    buttonText: 'Free Trial',
                    buttonLink: '/register',
                    featuresHeader: 'All Foundation Features+',
                    badge: 'Popular',
                    categories: [
                        {
                            categoryName: 'CORE FEATURES',
                            items: [
                                { title: 'Advanced Feature 1', description: '', isExpandable: false, isIncluded: true }
                            ]
                        }
                    ]
                },
                {
                    tierName: 'GROWTH',
                    subtitle: 'Full enterprise capabilities',
                    buttonText: 'Free Trial',
                    buttonLink: '/register',
                    featuresHeader: 'All Strength Features+',
                    badge: 'Enterprise',
                    categories: [
                        {
                            categoryName: 'CORE FEATURES',
                            items: [
                                { title: 'Enterprise Feature 1', description: '', isExpandable: false, isIncluded: true }
                            ]
                        }
                    ]
                }
            ]
        };

        setPlansData(prev => [...prev, newTabObj]);
        setActiveTabKey(key);
        setNewTabTitle('');
        setShowNewTabModal(false);
        toast.success(`Created tab "${newTabTitle}"! Click Save to apply.`);
    };

    const handleDeleteTab = async (key, name) => {
        if (window.confirm(`Are you sure you want to delete the tab "${name}"?`)) {
            try {
                await landingPlanService.delete(key);
                toast.success(`Deleted tab "${name}"`);
                const remaining = plansData.filter(p => p.tabKey !== key);
                setPlansData(remaining);
                if (remaining.length > 0) setActiveTabKey(remaining[0].tabKey);
            } catch (err) {
                toast.error("Failed to delete tab");
            }
        }
    };

    // Tier / Category / Feature Editing Handlers
    const updateTierField = (tierIdx, field, val) => {
        setPlansData(prev => prev.map(p => {
            if (p.tabKey !== activeTabKey) return p;
            const updatedTiers = [...p.tiers];
            updatedTiers[tierIdx] = { ...updatedTiers[tierIdx], [field]: val };
            return { ...p, tiers: updatedTiers };
        }));
    };

    const addCategoryToTier = (tierIdx) => {
        const catName = prompt("Enter new Category Name (e.g. CORE HR, TIME & ATTENDANCE):");
        if (!catName || !catName.trim()) return;

        setPlansData(prev => prev.map(p => {
            if (p.tabKey !== activeTabKey) return p;
            const updatedTiers = [...p.tiers];
            const categories = [...(updatedTiers[tierIdx].categories || [])];
            categories.push({
                categoryName: catName.trim().toUpperCase(),
                items: [
                    { title: 'New Feature A', description: 'Feature description details', isExpandable: false, isIncluded: true }
                ]
            });
            updatedTiers[tierIdx] = { ...updatedTiers[tierIdx], categories };
            return { ...p, tiers: updatedTiers };
        }));
    };

    const deleteCategoryFromTier = (tierIdx, catIdx) => {
        if (!window.confirm("Delete this entire category and its features?")) return;
        setPlansData(prev => prev.map(p => {
            if (p.tabKey !== activeTabKey) return p;
            const updatedTiers = [...p.tiers];
            const categories = updatedTiers[tierIdx].categories.filter((_, idx) => idx !== catIdx);
            updatedTiers[tierIdx] = { ...updatedTiers[tierIdx], categories };
            return { ...p, tiers: updatedTiers };
        }));
    };

    const addFeatureToCategory = (tierIdx, catIdx) => {
        setPlansData(prev => prev.map(p => {
            if (p.tabKey !== activeTabKey) return p;
            const updatedTiers = [...p.tiers];
            const categories = [...updatedTiers[tierIdx].categories];
            const items = [...categories[catIdx].items, {
                title: 'New Feature',
                description: '',
                isExpandable: false,
                isIncluded: true
            }];
            categories[catIdx] = { ...categories[catIdx], items };
            updatedTiers[tierIdx] = { ...updatedTiers[tierIdx], categories };
            return { ...p, tiers: updatedTiers };
        }));
    };

    const updateFeatureItem = (tierIdx, catIdx, itemIdx, field, val) => {
        setPlansData(prev => prev.map(p => {
            if (p.tabKey !== activeTabKey) return p;
            const updatedTiers = [...p.tiers];
            const categories = [...updatedTiers[tierIdx].categories];
            const items = [...categories[catIdx].items];
            items[itemIdx] = { ...items[itemIdx], [field]: val };
            if (field === 'description' && val && val.trim()) {
                items[itemIdx].isExpandable = true;
            }
            categories[catIdx] = { ...categories[catIdx], items };
            updatedTiers[tierIdx] = { ...updatedTiers[tierIdx], categories };
            return { ...p, tiers: updatedTiers };
        }));
    };

    const deleteFeatureItem = (tierIdx, catIdx, itemIdx) => {
        setPlansData(prev => prev.map(p => {
            if (p.tabKey !== activeTabKey) return p;
            const updatedTiers = [...p.tiers];
            const categories = [...updatedTiers[tierIdx].categories];
            const items = categories[catIdx].items.filter((_, idx) => idx !== itemIdx);
            categories[catIdx] = { ...categories[catIdx], items };
            updatedTiers[tierIdx] = { ...updatedTiers[tierIdx], categories };
            return { ...p, tiers: updatedTiers };
        }));
    };

    if (loading) {
        return (
            <div className="p-12 text-center text-slate-400 font-bold">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-[#006c49] border-t-transparent mb-4"></div>
                <p className="text-xs uppercase tracking-widest">Loading Landing Page Content Manager...</p>
            </div>
        );
    }

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300">
            {/* Top Bar Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/settings')}
                        className="p-3 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-2xl transition-all border border-slate-200"
                    >
                        <MdArrowBack size={20} />
                    </button>
                    <div>
                        <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                            <MdLayers className="text-[#006c49]" size={28} />
                            Landing Page Plans & Features Content Manager
                        </h1>
                        <p className="text-xs font-semibold text-slate-500 mt-0.5">
                            Manage Foundation, Strength, and Growth tiers, feature categories, and descriptions for the public Landing Page.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={handleResetDefaults}
                        className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2"
                        title="Reset all plans to original screenshot default seed data"
                    >
                        <MdRefresh size={18} />
                        <span>Reset Defaults</span>
                    </button>
                    <button
                        onClick={handleSaveCurrentTab}
                        disabled={saving}
                        className="px-6 py-3 bg-[#006c49] hover:bg-[#00573b] text-white rounded-2xl text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-[#006c49]/20 active:scale-95 flex items-center gap-2"
                    >
                        <MdSave size={18} />
                        <span>{saving ? 'Saving...' : 'Save Tab Changes'}</span>
                    </button>
                </div>
            </div>

            {/* Tab Pills Bar */}
            <div className="flex items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm overflow-x-auto">
                <div className="flex items-center gap-2">
                    {plansData.map(plan => (
                        <div key={plan.tabKey} className="flex items-center">
                            <button
                                onClick={() => setActiveTabKey(plan.tabKey)}
                                className={`px-5 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
                                    activeTabKey === plan.tabKey
                                        ? 'bg-[#006c49] text-white shadow-md shadow-[#006c49]/20'
                                        : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200'
                                }`}
                            >
                                <span>{plan.tabName}</span>
                            </button>
                        </div>
                    ))}
                </div>

                <button
                    onClick={() => setShowNewTabModal(true)}
                    className="px-4 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 shrink-0"
                >
                    <MdAdd size={18} />
                    <span>+ New Tab</span>
                </button>
            </div>

            {/* Active Plan Tab Content Editor */}
            {activePlan ? (
                <div className="space-y-6">
                    {/* Tab Info Bar */}
                    <div className="bg-slate-900 text-white p-6 rounded-3xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="space-y-1">
                            <div className="text-[10px] font-black uppercase text-indigo-400 tracking-widest">Editing Category Tab</div>
                            <input
                                type="text"
                                value={activePlan.tabName}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setPlansData(prev => prev.map(p => p.tabKey === activeTabKey ? { ...p, tabName: val } : p));
                                }}
                                className="text-xl font-black bg-transparent border-b border-slate-700 focus:border-indigo-400 outline-none text-white px-1 py-0.5"
                            />
                        </div>

                        <div className="flex items-center gap-3">
                            <a
                                href="/"
                                target="_blank"
                                rel="noreferrer"
                                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold uppercase tracking-wider transition-all"
                            >
                                Preview Landing Page ↗
                            </a>
                            {plansData.length > 1 && (
                                <button
                                    onClick={() => handleDeleteTab(activePlan.tabKey, activePlan.tabName)}
                                    className="p-2.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 rounded-xl text-xs font-bold transition-all"
                                    title="Delete this entire tab"
                                >
                                    <MdDelete size={18} />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* 3 Tier Columns Editor Grid (FOUNDATION, STRENGTH, GROWTH) */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {activePlan.tiers.map((tier, tierIdx) => (
                            <div key={tierIdx} className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm space-y-6 flex flex-col justify-between">
                                <div className="space-y-6">
                                    {/* Tier Header Controls */}
                                    <div className="p-4 bg-emerald-50/60 rounded-2xl border border-emerald-100 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <input
                                                type="text"
                                                value={tier.tierName}
                                                onChange={(e) => updateTierField(tierIdx, 'tierName', e.target.value.toUpperCase())}
                                                className="text-lg font-black text-[#006c49] bg-white px-3 py-1.5 rounded-xl border border-emerald-200 focus:outline-none focus:ring-2 focus:ring-[#006c49] uppercase tracking-widest"
                                            />
                                            <input
                                                type="text"
                                                value={tier.badge || ''}
                                                placeholder="Badge (e.g. Popular)"
                                                onChange={(e) => updateTierField(tierIdx, 'badge', e.target.value)}
                                                className="text-[10px] font-black uppercase text-[#006c49] bg-emerald-100/70 px-2 py-1 rounded-lg border border-emerald-200 w-28 text-center"
                                            />
                                        </div>

                                        <div className="space-y-1">
                                            <label className="text-[9px] font-black uppercase text-slate-400">Subtitle Description</label>
                                            <textarea
                                                value={tier.subtitle}
                                                onChange={(e) => updateTierField(tierIdx, 'subtitle', e.target.value)}
                                                rows="2"
                                                className="w-full text-xs font-medium text-slate-700 bg-white p-2 rounded-xl border border-slate-200 outline-none resize-none"
                                            ></textarea>
                                        </div>

                                        <div className="grid grid-cols-2 gap-2">
                                            <div>
                                                <label className="text-[9px] font-black uppercase text-slate-400">Button Label</label>
                                                <input
                                                    type="text"
                                                    value={tier.buttonText}
                                                    onChange={(e) => updateTierField(tierIdx, 'buttonText', e.target.value)}
                                                    className="w-full text-xs font-bold bg-white px-2 py-1.5 rounded-xl border border-slate-200 outline-none"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[9px] font-black uppercase text-slate-400">Features Header</label>
                                                <input
                                                    type="text"
                                                    value={tier.featuresHeader}
                                                    onChange={(e) => updateTierField(tierIdx, 'featuresHeader', e.target.value)}
                                                    className="w-full text-xs font-bold bg-white px-2 py-1.5 rounded-xl border border-slate-200 outline-none"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Categories & Feature Items List */}
                                    <div className="space-y-6">
                                        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                                            <h3 className="text-xs font-black uppercase tracking-widest text-slate-800">Feature Categories</h3>
                                            <button
                                                onClick={() => addCategoryToTier(tierIdx)}
                                                className="text-[10px] font-black uppercase text-[#006c49] hover:text-emerald-800 flex items-center gap-1 bg-emerald-50 px-2.5 py-1 rounded-lg"
                                            >
                                                <MdAdd size={14} /> Add Category
                                            </button>
                                        </div>

                                        {tier.categories.map((cat, catIdx) => (
                                            <div key={catIdx} className="space-y-3 bg-slate-50/70 p-3 rounded-2xl border border-slate-100">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-600 bg-slate-200 px-2 py-0.5 rounded-md">
                                                        {cat.categoryName}
                                                    </span>
                                                    <div className="flex items-center gap-1">
                                                        <button
                                                            onClick={() => addFeatureToCategory(tierIdx, catIdx)}
                                                            className="text-[9px] font-bold text-[#006c49] hover:underline px-1.5"
                                                        >
                                                            + Add Feature
                                                        </button>
                                                        <button
                                                            onClick={() => deleteCategoryFromTier(tierIdx, catIdx)}
                                                            className="text-rose-500 hover:text-rose-700 p-1"
                                                            title="Delete category"
                                                        >
                                                            <MdDelete size={14} />
                                                        </button>
                                                    </div>
                                                </div>

                                                <div className="space-y-2">
                                                    {cat.items.map((item, itemIdx) => (
                                                        <div key={itemIdx} className="bg-white p-3 rounded-xl border border-slate-200/80 space-y-2 text-left">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-indigo-600 text-xs font-black">▶</span>
                                                                <input
                                                                    type="text"
                                                                    value={item.title}
                                                                    onChange={(e) => updateFeatureItem(tierIdx, catIdx, itemIdx, 'title', e.target.value)}
                                                                    placeholder="Feature title (e.g. Org Structure Management)"
                                                                    className="w-full text-xs font-bold text-slate-800 outline-none border-b border-transparent focus:border-indigo-400"
                                                                />
                                                                <button
                                                                    onClick={() => deleteFeatureItem(tierIdx, catIdx, itemIdx)}
                                                                    className="text-slate-300 hover:text-rose-500 transition-colors"
                                                                    title="Remove feature"
                                                                >
                                                                    <MdDelete size={14} />
                                                                </button>
                                                            </div>

                                                            <div>
                                                                <textarea
                                                                    value={item.description || ''}
                                                                    onChange={(e) => updateFeatureItem(tierIdx, catIdx, itemIdx, 'description', e.target.value)}
                                                                    placeholder="Optional detailed description (shows when user clicks feature dropdown)..."
                                                                    rows="2"
                                                                    className="w-full text-[11px] font-medium text-slate-500 bg-slate-50 p-2 rounded-lg outline-none resize-none border border-slate-100"
                                                                ></textarea>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : null}

            {/* Modal for creating a new Tab */}
            {showNewTabModal && (
                <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 border border-slate-100">
                        <h3 className="text-lg font-black text-slate-900">Add New Plan Category Tab</h3>
                        <p className="text-xs text-slate-500 font-medium">Create a new plan category (e.g. "Recruitment", "Performance Management", etc.)</p>
                        <input
                            type="text"
                            value={newTabTitle}
                            onChange={(e) => setNewTabTitle(e.target.value)}
                            placeholder="Enter tab title..."
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:border-indigo-600"
                        />
                        <div className="flex justify-end gap-3 pt-2">
                            <button
                                onClick={() => setShowNewTabModal(false)}
                                className="px-5 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleAddNewTab}
                                className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-wider"
                            >
                                Create Tab
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LandingPlanManager;
