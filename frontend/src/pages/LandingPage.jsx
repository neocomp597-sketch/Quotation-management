import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
    MdRocketLaunch, 
    MdSecurity, 
    MdSpeed, 
    MdInsertDriveFile, 
    MdPeople, 
    MdAnalytics, 
    MdChevronRight,
    MdAttachMoney
} from 'react-icons/md';
import './LandingPage.css';

const LandingPage = () => {
    useEffect(() => {
        // Add reveal animation on scroll would be nice
    }, []);

    const features = [
        {
            title: "Lightning Fast",
            desc: "Generate professional quotations in seconds with our optimized workflow.",
            icon: <MdSpeed size={24} />,
            color: "bg-amber-100 text-amber-600"
        },
        {
            title: "Secure & Reliable",
            desc: "Your data is encrypted and backed up, ensuring peace of mind.",
            icon: <MdSecurity size={24} />,
            color: "bg-emerald-100 text-emerald-600"
        },
        {
            title: "Smart Analytics",
            desc: "Track your sales pipeline and closure rates with intuitive charts.",
            icon: <MdAnalytics size={24} />,
            color: "bg-blue-100 text-blue-600"
        }
    ];

    return (
        <div className="landing-page">
            <header className="landing-header glass">
                <div className="logo-container">
                    <div className="landing-logo animate-float">Q</div>
                    <span className="logo-text font-outfit">Quotations</span>
                </div>
                <nav className="landing-nav">
                    <Link to="/login" className="nav-link">Features</Link>
                    <Link to="/login" className="nav-link">Pricing</Link>
                    <Link to="/login" className="nav-link px-6 py-2 bg-slate-100 rounded-full hover:bg-slate-200 transition-all">Login</Link>
                    <Link to="/register" className="nav-link px-6 py-2 bg-primary-600 text-white rounded-full hover:bg-primary-700 shadow-lg shadow-primary-600/20 transition-all">Free Trial</Link>
                </nav>
            </header>

            <section className="hero-section">
                <div className="hero-bg-shapes">
                    <div className="shape shape-1"></div>
                    <div className="shape shape-2"></div>
                </div>
                
                <div className="hero-content grid lg:grid-cols-2 gap-12 items-center">
                    <div className="hero-text text-left animate-fade-in-up">
                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 backdrop-blur-md border border-white/20 rounded-full text-white text-xs font-bold mb-6">
                            <span className="flex h-2 w-2 rounded-full bg-emerald-400"></span>
                            NEW: AI-POWERED PRODUCT CATEGORIZATION
                        </div>
                        <h1 className="text-5xl lg:text-7xl font-black text-white leading-tight mb-6">
                            Win More Deals with <br />
                            <span className="bg-gradient-to-r from-teal-200 to-emerald-200 bg-clip-text text-transparent">Better Quotes.</span>
                        </h1>
                        <p className="text-xl text-teal-100/90 mb-10 max-w-xl">
                            The ultimate quotation tool for ARCRM. Create, manage, and track professional proposals that turn prospects into loyal customers.
                        </p>
                        <div className="cta-buttons !justify-start">
                            <Link to="/register" className="btn-landing-premium primary">
                                Get Started Free <MdRocketLaunch className="ml-2" />
                            </Link>
                            <Link to="/login" className="btn-landing-premium secondary">
                                Book a Demo
                            </Link>
                        </div>
                        <div className="mt-8 flex items-center gap-4 text-teal-100/60 text-sm italic">
                            No credit card required • Unlimited users • 14-day trial
                        </div>
                    </div>

                    <div className="hero-visual animate-fade-in-up md:block hidden" style={{ animationDelay: '0.2s' }}>
                        <div className="mockup-window glass shadow-2xl relative">
                            <div className="window-header px-4 py-3 border-b border-white/10 flex gap-1.5 align-middle">
                                <div className="w-2.5 h-2.5 rounded-full bg-rose-400"></div>
                                <div className="w-2.5 h-2.5 rounded-full bg-amber-400"></div>
                                <div className="w-2.5 h-2.5 rounded-full bg-emerald-400"></div>
                            </div>
                            <div className="window-body p-4 bg-slate-900/50 backdrop-blur-sm">
                                <div className="dashboard-preview p-6 rounded-xl border border-white/5 bg-slate-800/40">
                                    <div className="flex justify-between mb-8">
                                        <div className="h-6 w-32 bg-slate-700/50 rounded-lg"></div>
                                        <div className="h-6 w-24 bg-primary-600/30 rounded-lg"></div>
                                    </div>
                                    <div className="space-y-4">
                                        <div className="h-32 w-full bg-slate-700/20 rounded-xl border border-white/5"></div>
                                        <div className="grid grid-cols-3 gap-4">
                                            <div className="h-20 flip-card-container">
                                                <div className="flip-card-inner">
                                                    <div className="flip-card-front bg-emerald-500/10 border border-emerald-500/10 mix-blend-overlay"></div>
                                                    <div className="flip-card-back bg-emerald-500/30 border border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.3)]"></div>
                                                </div>
                                            </div>
                                            <div className="h-20 flip-card-container">
                                                <div className="flip-card-inner delay-1">
                                                    <div className="flip-card-front bg-blue-500/10 border border-blue-500/10 mix-blend-overlay"></div>
                                                    <div className="flip-card-back bg-blue-500/30 border border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.3)]"></div>
                                                </div>
                                            </div>
                                            <div className="h-20 flip-card-container">
                                                <div className="flip-card-inner delay-2">
                                                    <div className="flip-card-front bg-amber-500/10 border border-amber-500/10 mix-blend-overlay"></div>
                                                    <div className="flip-card-back bg-amber-500/30 border border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.3)]"></div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            {/* Floating elements */}
                            <div className="absolute -bottom-6 -left-6 glass-dark p-4 rounded-2xl shadow-xl border border-white/10 animate-float">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-emerald-500 rounded-lg text-white">
                                        <MdAttachMoney size={20} />
                                    </div>
                                    <div>
                                        <div className="text-[10px] text-slate-400 font-bold uppercase">Total Value</div>
                                        <div className="text-white font-black">₹ 14,50,000</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="custom-shape-divider-bottom">
                    <svg data-name="Layer 1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 120" preserveAspectRatio="none">
                        <path d="M321.39,56.44c58-10.79,114.16-30.13,172-41.86,82.39-16.72,168.19-17.73,250.45-.39C823.78,31,906.67,72,985.66,92.83c70.05,18.48,146.53,26.09,214.34,3V0H0V27.35A600.21,600.21,0,0,0,321.39,56.44Z" className="shape-fill"></path>
                    </svg>
                </div>
            </section>

            <section className="features-section py-24 px-6 max-w-7xl mx-auto text-center">
                <h2 className="text-4xl font-black mb-16 gradient-text">Everything you need to grow.</h2>
                <div className="grid md:grid-cols-3 gap-8">
                    {features.map((f, i) => (
                        <div key={i} className="feature-card p-10 rounded-3xl border border-slate-100 hover-lift bg-white text-left">
                            <div className={`w-14 h-14 rounded-2xl ${f.color} flex items-center justify-center mb-8 shadow-sm`}>
                                {f.icon}
                            </div>
                            <h3 className="text-xl font-bold mb-4">{f.title}</h3>
                            <p className="text-slate-500 leading-relaxed mb-6">{f.desc}</p>
                            <Link to="/register" className="text-primary-600 font-bold inline-flex items-center hover:gap-2 transition-all">
                                Learn more <MdChevronRight className="ml-1" />
                            </Link>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
};

export default LandingPage;
