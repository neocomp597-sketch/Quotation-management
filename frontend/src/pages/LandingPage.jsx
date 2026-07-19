import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import './LandingPage.css';

const CounterItem = ({ 
    targetValue, 
    prefix = '', 
    suffix = '', 
    decimals = 0, 
    duration = 2000,
    intervalMs = 1500,
    stepAmount = 1
}) => {
    const [count, setCount] = useState(0);
    const containerRef = useRef(null);
    const [hasAnimated, setHasAnimated] = useState(false);

    useEffect(() => {
        let timer = null;

        const observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting && !hasAnimated) {
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
                    } else {
                        // Start continuous live increasing counter
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
            if (containerRef.current) {
                observer.unobserve(containerRef.current);
            }
        };
    }, [targetValue, duration, hasAnimated, intervalMs, stepAmount, decimals]);

    const formattedValue = decimals > 0 ? count.toFixed(decimals) : Math.floor(count).toLocaleString();

    return (
        <div ref={containerRef} className="text-4xl text-white font-extrabold mb-1 tracking-tight font-outfit">
            {prefix}{formattedValue}{suffix}
        </div>
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
            document.head.removeChild(link);
            window.removeEventListener('scroll', handleScroll);
        };
    }, []);

    return (
        <div className="bg-[#f7f9fb] text-[#191c1e] min-h-screen">
            {/* TopNavBar */}
            <header className="fixed top-0 w-full z-50 bg-[#f7f9fb]/80 backdrop-blur-md border-b border-[#bbcabf]/30 shadow-sm transition-all duration-300 animate-fade-in">
                <nav className="max-w-[1280px] mx-auto flex items-center justify-between px-6 h-20">
                    <div className="flex items-center gap-10">
                        <Link to="/" className="text-xl font-extrabold text-[#006c49] tracking-tight flex items-center gap-2">
                            <span className="material-symbols-outlined text-[#10b981]" style={{ fontVariationSettings: "'FILL' 1" }}>dataset</span>
                            ARCRM
                        </Link>
                        <div className="hidden md:flex gap-6">
                            <a className="font-semibold text-xs text-[#006c49] border-b-2 border-[#006c49] pb-1" href="#">Features</a>
                            <a className="font-semibold text-xs text-[#3c4a42] hover:text-[#006c49] transition-colors" href="#">Solutions</a>
                            <a className="font-semibold text-xs text-[#3c4a42] hover:text-[#006c49] transition-colors" href="#">Industries</a>
                            <a className="font-semibold text-xs text-[#3c4a42] hover:text-[#006c49] transition-colors" href="#">Pricing</a>
                            <a className="font-semibold text-xs text-[#3c4a42] hover:text-[#006c49] transition-colors" href="#">Resources</a>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <Link to="/login" className="px-5 py-2.5 rounded-full font-bold text-xs text-[#006c49] hover:bg-[#006c49]/10 transition-all">Sign In</Link>
                        <Link to="/register" className="px-6 py-2.5 rounded-full font-bold text-xs text-white bg-[#006c49] hover:bg-[#005237] shadow-md shadow-[#006c49]/20 transition-all">Get Started</Link>
                    </div>
                </nav>
            </header>

            <main className="pt-32 overflow-x-hidden">
                {/* Hero Section */}
                <section className="px-6 pb-24 max-w-[1280px] mx-auto">
                    <div className="grid lg:grid-cols-2 gap-16 items-center">
                        <div className="space-y-6 text-left">
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#006c49]/10 text-[#006c49] font-bold text-xs">
                                <span className="material-symbols-outlined text-sm">auto_awesome</span> Next-Gen CRM Platform
                            </div>
                            <h1 className="text-4xl md:text-6xl font-extrabold text-[#191c1e] leading-tight tracking-tight">
                                Streamline your sales from <span className="emerald-gradient-text">Enquiry to Invoice</span>
                            </h1>
                            <p className="text-[#3c4a42] text-lg font-medium leading-relaxed">
                                Accelerate your business with an integrated suite for quotations, CPQ, CSM ticketing, and automated payroll management.
                            </p>
                            <div className="flex flex-wrap gap-4 pt-2">
                                <Link to="/register" className="px-8 py-4 rounded-full font-bold text-sm text-white bg-[#006c49] hover:bg-[#005237] shadow-lg shadow-[#006c49]/30 transition-all">
                                    Start Free Trial
                                </Link>
                                <a href="#features" className="px-8 py-4 rounded-full font-bold text-sm text-[#006c49] bg-[#ffffff] border border-[#bbcabf]/50 hover:bg-[#f2f4f6] transition-all">
                                    Book a Demo
                                </a>
                            </div>
                        </div>

                        {/* Interactive Preview Box */}
                        <div className="relative">
                            <div className="bg-[#ffffff] rounded-3xl p-6 shadow-2xl border border-[#bbcabf]/30 space-y-4">
                                <div className="flex items-center justify-between border-b border-[#bbcabf]/20 pb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-3 h-3 rounded-full bg-[#ff5f56]"></div>
                                        <div className="w-3 h-3 rounded-full bg-[#ffbd2e]"></div>
                                        <div className="w-3 h-3 rounded-full bg-[#27c93f]"></div>
                                    </div>
                                    <div className="text-xs font-bold text-[#64748B] uppercase tracking-wider">Live Quotation Dashboard</div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-[#f2f4f6] p-4 rounded-2xl">
                                        <span className="text-[11px] font-bold text-[#64748B] uppercase">Total Revenue</span>
                                        <div className="text-2xl font-extrabold text-[#006c49] mt-1">₹24,50,000</div>
                                    </div>
                                    <div className="bg-[#f2f4f6] p-4 rounded-2xl">
                                        <span className="text-[11px] font-bold text-[#64748B] uppercase">Win Rate</span>
                                        <div className="text-2xl font-extrabold text-[#006c49] mt-1">78.4%</div>
                                    </div>
                                </div>
                                <div className="bg-[#f2f4f6] p-4 rounded-2xl flex items-center justify-between">
                                    <div>
                                        <span className="text-[11px] font-bold text-[#64748B] uppercase">Active Deals</span>
                                        <div className="text-xl font-extrabold text-[#191c1e]">142 Proposals</div>
                                    </div>
                                    <span className="material-symbols-outlined text-[#006c49] text-3xl">trending_up</span>
                                </div>
                                <div className="bg-[#ba1a1a]/10 border border-[#ba1a1a]/20 p-4 rounded-2xl flex items-center justify-between">
                                    <div>
                                        <span className="text-[11px] font-bold text-[#64748B] uppercase">Unpaid Quotes</span>
                                        <span className="material-symbols-outlined text-[#ba1a1a]">warning</span>
                                    </div>
                                    <div className="text-xl font-extrabold text-[#191c1e]">₹3,20,000</div>
                                </div>
                                {/* Decorative Element */}
                                <div className="absolute -z-10 w-[120%] h-[120%] bg-[#006c49]/5 blur-3xl rounded-full"></div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Social Proof */}
                <section className="py-10 bg-[#ffffff]">
                    <div className="max-w-[1280px] mx-auto px-6">
                        <p className="text-center text-xs font-bold text-[#3c4a42] uppercase tracking-widest mb-6">Trusted by growing businesses</p>
                        <div className="flex flex-wrap justify-center gap-10 opacity-60 grayscale hover:grayscale-0 transition-all duration-500">
                            <div className="flex items-center gap-2"><span className="material-symbols-outlined text-[#006c49]">corporate_fare</span><span className="font-bold text-lg">Acme Corp</span></div>
                            <div className="flex items-center gap-2"><span className="material-symbols-outlined text-[#006c49]">memory</span><span className="font-bold text-lg">Tech Solutions</span></div>
                            <div className="flex items-center gap-2"><span className="material-symbols-outlined text-[#006c49]">language</span><span className="font-bold text-lg">Global Industries</span></div>
                            <div className="flex items-center gap-2"><span className="material-symbols-outlined text-[#006c49]">brush</span><span className="font-bold text-lg">Design Studio</span></div>
                            <div className="flex items-center gap-2"><span className="material-symbols-outlined text-[#006c49]">architecture</span><span className="font-bold text-lg">BuildCo</span></div>
                        </div>
                    </div>
                </section>

                {/* Stats Strip */}
                <section className="bg-[#059669] py-16">
                    <div className="max-w-[1280px] mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-10 text-center">
                        <div>
                            <CounterItem targetValue={10480} suffix="+" intervalMs={1200} stepAmount={1} />
                            <div className="text-white/80 font-semibold text-[11px] uppercase tracking-wider">Quotations Created</div>
                        </div>
                        <div>
                            <CounterItem targetValue={500} suffix="+" intervalMs={2000} stepAmount={1} />
                            <div className="text-white/80 font-semibold text-[11px] uppercase tracking-wider">Enterprises</div>
                        </div>
                        <div>
                            <CounterItem targetValue={500} prefix="₹" suffix="Cr+" intervalMs={2500} stepAmount={1} />
                            <div className="text-white/80 font-semibold text-[11px] uppercase tracking-wider">Deals Managed</div>
                        </div>
                        <div>
                            <CounterItem targetValue={99.94} suffix="%" decimals={2} intervalMs={3000} />
                            <div className="text-white/80 font-semibold text-[11px] uppercase tracking-wider">Uptime SLA</div>
                        </div>
                    </div>
                </section>

                {/* Feature Grid */}
                <section className="py-24 px-6 bg-[#f7f9fb]">
                    <div className="max-w-[1280px] mx-auto">
                        <div className="text-center mb-16">
                            <h2 className="text-3xl font-extrabold text-[#191c1e] mb-4">Everything you need to create <span className="emerald-gradient-text">winning quotes</span></h2>
                            <p className="text-[#3c4a42] text-lg max-w-2xl mx-auto">Unified CRM tools designed for speed, accuracy, and conversion across your entire sales organization.</p>
                        </div>
                        <div className="grid md:grid-cols-3 gap-6">
                            {/* Card 1 */}
                            <div className="bg-[#ffffff] p-8 rounded-2xl border border-[#bbcabf]/30 hover:border-[#006c49]/40 hover:shadow-xl transition-all duration-300 text-left">
                                <div className="w-12 h-12 bg-[#006c49]/10 text-[#006c49] rounded-xl flex items-center justify-center mb-6">
                                    <span className="material-symbols-outlined">description</span>
                                </div>
                                <h3 className="text-lg font-bold text-[#191c1e] mb-2">Professional Quotes</h3>
                                <p className="text-[#3c4a42] text-xs leading-relaxed">Create beautiful, branded proposals in minutes with dynamic pricing and custom templates.</p>
                            </div>
                            {/* Card 2 */}
                            <div className="bg-[#ffffff] p-8 rounded-2xl border border-[#bbcabf]/30 hover:border-[#006c49]/40 hover:shadow-xl transition-all duration-300 text-left">
                                <div className="w-12 h-12 bg-[#006c49]/10 text-[#006c49] rounded-xl flex items-center justify-center mb-6">
                                    <span className="material-symbols-outlined">visibility</span>
                                </div>
                                <h3 className="text-lg font-bold text-[#191c1e] mb-2">Track & Monitor</h3>
                                <p className="text-[#3c4a42] text-xs leading-relaxed">Get real-time alerts when prospects open, view, or comment on your sales proposals.</p>
                            </div>
                            {/* Card 3 */}
                            <div className="bg-[#ffffff] p-8 rounded-2xl border border-[#bbcabf]/30 hover:border-[#006c49]/40 hover:shadow-xl transition-all duration-300 text-left">
                                <div className="w-12 h-12 bg-[#006c49]/10 text-[#006c49] rounded-xl flex items-center justify-center mb-6">
                                    <span className="material-symbols-outlined">auto_awesome</span>
                                </div>
                                <h3 className="text-lg font-bold text-[#191c1e] mb-2">AI-Powered Insights</h3>
                                <p className="text-[#3c4a42] text-xs leading-relaxed">Smart product suggestions and predictive pricing to maximize deal value and success rate.</p>
                            </div>
                            {/* Card 4 */}
                            <div className="bg-[#ffffff] p-8 rounded-2xl border border-[#bbcabf]/30 hover:border-[#006c49]/40 hover:shadow-xl transition-all duration-300 text-left">
                                <div className="w-12 h-12 bg-[#006c49]/10 text-[#006c49] rounded-xl flex items-center justify-center mb-6">
                                    <span className="material-symbols-outlined">draw</span>
                                </div>
                                <h3 className="text-lg font-bold text-[#191c1e] mb-2">E-Sign & Approvals</h3>
                                <p className="text-[#3c4a42] text-xs leading-relaxed">Close deals faster with integrated legally binding digital signatures and multi-level approval workflows.</p>
                            </div>
                            {/* Card 5 */}
                            <div className="bg-[#ffffff] p-8 rounded-2xl border border-[#bbcabf]/30 hover:border-[#006c49]/40 hover:shadow-xl transition-all duration-300 text-left">
                                <div className="w-12 h-12 bg-[#006c49]/10 text-[#006c49] rounded-xl flex items-center justify-center mb-6">
                                    <span className="material-symbols-outlined">leaderboard</span>
                                </div>
                                <h3 className="text-lg font-bold text-[#191c1e] mb-2">Analytics Dashboard</h3>
                                <p className="text-[#3c4a42] text-xs leading-relaxed">Advanced data visualization for pipeline health, sales velocity, and team performance tracking.</p>
                            </div>
                            {/* Card 6 */}
                            <div className="bg-[#ffffff] p-8 rounded-2xl border border-[#bbcabf]/30 hover:border-[#006c49]/40 hover:shadow-xl transition-all duration-300 text-left">
                                <div className="w-12 h-12 bg-[#006c49]/10 text-[#006c49] rounded-xl flex items-center justify-center mb-6">
                                    <span className="material-symbols-outlined">inventory_2</span>
                                </div>
                                <h3 className="text-lg font-bold text-[#191c1e] mb-2">Inventory Integration</h3>
                                <p className="text-[#3c4a42] text-xs leading-relaxed">Seamlessly sync with your ERP to ensure accurate stock levels and pricing in every quotation.</p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Why ARCRM Table */}
                <section className="py-24 px-6 bg-[#f2f4f6]">
                    <div className="max-w-[1280px] mx-auto">
                        <h2 className="text-3xl font-extrabold text-center mb-16">The modern choice for <span className="emerald-gradient-text">Sales Teams</span></h2>
                        <div className="overflow-x-auto rounded-2xl border border-[#bbcabf]/30 shadow-lg bg-white">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="bg-[#e0e3e5] border-b border-[#bbcabf]/30">
                                        <th className="p-6 font-semibold text-sm">Feature</th>
                                        <th className="p-6 font-semibold text-sm text-[#006c49]">ARCRM</th>
                                        <th className="p-6 font-semibold text-sm opacity-50">Legacy ERP</th>
                                        <th className="p-6 font-semibold text-sm opacity-50">Manual Excel</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[#bbcabf]/20">
                                    <tr className="text-xs font-semibold">
                                        <td className="p-6 font-bold text-sm text-[#191c1e]">Quote Gen Time</td>
                                        <td className="p-6 text-[#006c49] font-bold"><div className="flex items-center gap-2"><span className="material-symbols-outlined">check_circle</span> &lt; 2 mins</div></td>
                                        <td className="p-6 text-[#3c4a42]">15-30 mins</td>
                                        <td className="p-6 text-[#3c4a42]">1+ Hour</td>
                                    </tr>
                                    <tr className="text-xs font-semibold">
                                        <td className="p-6 font-bold text-sm text-[#191c1e]">Mobile Approval</td>
                                        <td className="p-6 text-[#006c49] font-bold"><div className="flex items-center gap-2"><span className="material-symbols-outlined">check_circle</span> Instant</div></td>
                                        <td className="p-6 text-[#3c4a42]">VPN Required</td>
                                        <td className="p-6 text-[#3c4a42]">Email Chain</td>
                                    </tr>
                                    <tr className="text-xs font-semibold">
                                        <td className="p-6 font-bold text-sm text-[#191c1e]">AI Forecasting</td>
                                        <td className="p-6 text-[#006c49] font-bold"><div className="flex items-center gap-2"><span className="material-symbols-outlined">check_circle</span> Advanced</div></td>
                                        <td className="p-6 text-[#3c4a42]">Limited</td>
                                        <td className="p-6 text-[#3c4a42]">None</td>
                                    </tr>
                                    <tr className="text-xs font-semibold">
                                        <td className="p-6 font-bold text-sm text-[#191c1e]">Deployment</td>
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
                                <p className="text-xl md:text-2xl font-bold text-[#191c1e] mb-6 italic leading-snug">
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
                        <h2 className="text-4xl font-extrabold mb-6 leading-tight">Ready to transform your <br /><span className="emerald-gradient-text">sales cycle?</span></h2>
                        <p className="text-[#3c4a42] text-lg mb-10">Join over 500+ global enterprises winning more deals every day with ARCRM.</p>
                        <div className="flex flex-col sm:flex-row justify-center gap-4">
                            <Link to="/register" className="primary-gradient-btn text-white px-8 py-4 rounded-xl font-bold text-md shadow-xl hover:scale-105 transition-all text-center">Get Started For Free</Link>
                            <Link to="/login" className="bg-[#f7f9fb] border border-[#6c7a71] px-8 py-4 rounded-xl font-bold text-md text-[#006c49] hover:bg-[#f2f4f6] transition-all text-center">Schedule Demo</Link>
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
                            <li><a className="text-[#3c4a42] hover:text-[#006c49] transition-all" href="#">Features</a></li>
                            <li><a className="text-[#3c4a42] hover:text-[#006c49] transition-all" href="#">Solutions</a></li>
                            <li><a className="text-[#3c4a42] hover:text-[#006c49] transition-all" href="#">Integrations</a></li>
                            <li><a className="text-[#3c4a42] hover:text-[#006c49] transition-all" href="#">Pricing</a></li>
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
