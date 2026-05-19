import React, { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import { Link } from 'react-router-dom';
import { footerPageService } from '../services/api';

const Layout = ({ children }) => {
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [footerPages, setFooterPages] = useState([
        { slug: 'privacy-policy', label: 'Privacy Policy' },
        { slug: 'terms-of-service', label: 'Terms of Service' },
        { slug: 'help-center', label: 'Help Center' }
    ]);

    useEffect(() => {
        const fetchFooterPages = async () => {
            try {
                const res = await footerPageService.getAll();
                if (res.data && Array.isArray(res.data)) {
                    setFooterPages(res.data);
                }
            } catch (err) {
                console.error("Failed to load footer pages", err);
            }
        };
        fetchFooterPages();
    }, []);

    return (
        <div className="min-h-screen bg-slate-50/50 relative overflow-hidden">
            {/* Elegant Background Pattern */}
            <div className="fixed inset-0 z-0 pointer-events-none opacity-20"
                style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, #cbd5e1 1px, transparent 0)', backgroundSize: '32px 32px' }}>
            </div>

            <Sidebar isOpen={sidebarOpen} toggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
            <Header sidebarOpen={sidebarOpen} toggleSidebar={() => setSidebarOpen(!sidebarOpen)} />

            <main className={`relative z-10 pt-28 pb-12 transition-all duration-300 ${sidebarOpen ? 'md:ml-64' : 'md:ml-20'}`}>
                <div className="px-6 md:px-10 max-w-full mx-auto">
                    {children}
                </div>
            </main>

            <footer className={`relative z-10 py-10 transition-all duration-300 ${sidebarOpen ? 'md:ml-64' : 'md:ml-20'}`}>
                <div className="px-6 md:px-10 max-w-full mx-auto border-t border-slate-100 pt-8 flex flex-col md:flex-row items-center justify-between text-slate-400 text-xs font-bold uppercase tracking-widest gap-6">
                    <p>&copy; {new Date().getFullYear()} ARCRM. Always Ready CRM.</p>
                    <div className="flex flex-wrap justify-center items-center gap-6 md:gap-10">
                        {footerPages.map(page => (
                            <Link 
                                key={page.slug} 
                                to={`/info/${page.slug}`} 
                                className="hover:text-primary-600 transition-colors"
                            >
                                {page.label}
                            </Link>
                        ))}
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default Layout;
