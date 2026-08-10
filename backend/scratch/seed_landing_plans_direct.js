require('dotenv').config({ path: '../.env' });
const mongoose = require('mongoose');
const LandingPlan = require('../models/LandingPlan');

const DEFAULT_SEED_PLANS = [
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

async function seed() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected!');

        console.log('Clearing existing landing plans...');
        await LandingPlan.deleteMany({});

        console.log('Inserting seed landing plans...');
        const res = await LandingPlan.insertMany(DEFAULT_SEED_PLANS);
        console.log(`Successfully seeded ${res.length} plan tabs!`);
    } catch (err) {
        console.error('Seed error:', err);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB.');
        process.exit(0);
    }
}

seed();
