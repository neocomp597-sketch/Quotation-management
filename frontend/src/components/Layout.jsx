import React, { useState } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';

const Layout = ({ children }) => {
    const [sidebarOpen, setSidebarOpen] = useState(true);

    return (
        <div className="min-h-screen bg-slate-50">
            <Sidebar isOpen={sidebarOpen} toggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
            <Header sidebarOpen={sidebarOpen} />

            <main className={`pt-24 pb-12 px-8 transition-all duration-300 ${sidebarOpen ? 'ml-64' : 'ml-20'}`}>
                <div className="max-w-7xl mx-auto fade-in">
                    {children}
                </div>
            </main>

            <footer className={`py-6 px-8 border-t border-slate-200 transition-all duration-300 ${sidebarOpen ? 'ml-64' : 'ml-20'}`}>
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between text-slate-500 text-sm">
                    <p>© 2025 JAG Sanitaryware & Bathroom Fittings. All rights reserved.</p>
                    <div className="flex items-center gap-6 mt-4 md:mt-0">
                        <a href="#" className="hover:text-primary-600 transition-colors">Privacy Policy</a>
                        <a href="#" className="hover:text-primary-600 transition-colors">Terms of Service</a>
                        <a href="#" className="hover:text-primary-600 transition-colors">Help Center</a>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default Layout;
