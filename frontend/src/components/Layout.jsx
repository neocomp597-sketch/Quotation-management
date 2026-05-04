import React, { useState } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import { Link } from 'react-router-dom';

const Layout = ({ children }) => {
    const [sidebarOpen, setSidebarOpen] = useState(true);

    return (
        <div className="min-h-screen bg-slate-50/50 relative overflow-hidden">
            {/* Elegant Background Pattern */}
            <div className="fixed inset-0 z-0 pointer-events-none opacity-20" 
                 style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, #cbd5e1 1px, transparent 0)', backgroundSize: '32px 32px' }}>
            </div>
            
            <Sidebar isOpen={sidebarOpen} toggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
            <Header sidebarOpen={sidebarOpen} toggleSidebar={() => setSidebarOpen(!sidebarOpen)} />

            <main className={`relative z-10 pt-28 pb-12 transition-all duration-300 ${sidebarOpen ? 'md:ml-64' : 'md:ml-20'}`}>
<<<<<<< HEAD
                <div className="px-6 md:px-10 max-w-full mx-auto">
=======
                <div className="px-4 md:px-6 lg:px-8 max-w-[1600px] mx-auto">
>>>>>>> babc1b5dca85e501b0e668d71fb9690cae2a04f5
                    {children}
                </div>
            </main>

            <footer className={`relative z-10 py-10 transition-all duration-300 ${sidebarOpen ? 'md:ml-64' : 'md:ml-20'}`}>
                <div className="px-6 md:px-10 max-w-full mx-auto border-t border-slate-100 pt-8 flex flex-col md:flex-row items-center justify-between text-slate-400 text-xs font-bold uppercase tracking-widest gap-6">
                    <p>&copy; {new Date().getFullYear()} ARCRM. Always Ready CRM.</p>
                    <div className="flex flex-wrap justify-center items-center gap-6 md:gap-10">
                        <Link to="#" className="hover:text-primary-600 transition-colors">Privacy Policy</Link>
                        <Link to="#" className="hover:text-primary-600 transition-colors">Terms of Service</Link>
                        <Link to="#" className="hover:text-primary-600 transition-colors">Help Center</Link>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default Layout;
