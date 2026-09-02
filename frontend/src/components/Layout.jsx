import React, { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import { Link, useNavigate } from 'react-router-dom';
import { footerPageService, systemUpdateService, csmService } from '../services/api';
import Modal from './Modal';
import { MdCheckCircle, MdNewReleases } from 'react-icons/md';
import { toast } from 'react-toastify';
import FloatingNotepad from './FloatingNotepad';

const Layout = ({ children }) => {
    const navigate = useNavigate();
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [footerPages, setFooterPages] = useState([
        { slug: 'privacy-policy', label: 'Privacy Policy' },
        { slug: 'terms-of-service', label: 'Terms of Service' },
        { slug: 'help-center', label: 'Help Center' }
    ]);
    
    // System Updates check states
    const [latestUpdate, setLatestUpdate] = useState(null);
    const [showUpdateModal, setShowUpdateModal] = useState(false);

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
        const checkSystemUpdates = async () => {
            try {
                const res = await systemUpdateService.getLatest();
                if (res.data) {
                    const lastSeenVersion = localStorage.getItem('lastSeenSystemVersion');
                    if (lastSeenVersion !== res.data.version) {
                        setLatestUpdate(res.data);
                        setShowUpdateModal(true);
                    }
                }
            } catch (error) {
                console.error("Failed to check for system updates", error);
            }
        };
        
        fetchFooterPages();
        checkSystemUpdates();
    }, []);

    const handleDismissUpdate = () => {
        if (latestUpdate) {
            localStorage.setItem('lastSeenSystemVersion', latestUpdate.version);
        }
        setShowUpdateModal(false);
    };

    const handleViewAllUpdates = () => {
        handleDismissUpdate();
        navigate('/system-updates');
    };

    const [seedingMh, setSeedingMh] = useState(false);
    const [seedingKb, setSeedingKb] = useState(false);

    const handleSeedMh = async () => {
        setSeedingMh(true);
        const toastId = toast.loading("Seeding Maharashtra electrical utility installations...");
        try {
            await csmService.seedMhData();
            toast.update(toastId, { render: "Maharashtra utility data seeded successfully!", type: "success", isLoading: false, autoClose: 3000 });
            window.dispatchEvent(new Event('onCsmDataSeeded'));
        } catch (err) {
            toast.update(toastId, { render: err.response?.data?.message || "Error seeding utility data", type: "error", isLoading: false, autoClose: 3000 });
        } finally {
            setSeedingMh(false);
        }
    };

    const handleSeedKb = async () => {
        setSeedingKb(true);
        const toastId = toast.loading("Seeding Knowledge Base troubleshooting guides...");
        try {
            await csmService.seedKbData();
            toast.update(toastId, { render: "Knowledge Base FAQs seeded successfully!", type: "success", isLoading: false, autoClose: 3000 });
            window.dispatchEvent(new Event('onCsmKbSeeded'));
        } catch (err) {
            toast.update(toastId, { render: err.response?.data?.message || "Error seeding KB guides", type: "error", isLoading: false, autoClose: 3000 });
        } finally {
            setSeedingKb(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 relative transition-colors duration-300 overflow-x-hidden">
            {/* Elegant Background Pattern */}
            <div className="fixed inset-0 z-0 pointer-events-none opacity-20"
                style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, #cbd5e1 1px, transparent 0)', backgroundSize: '32px 32px' }}>
            </div>

            <Sidebar isOpen={sidebarOpen} toggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
            <Header sidebarOpen={sidebarOpen} toggleSidebar={() => setSidebarOpen(!sidebarOpen)} />

            <main className={`relative z-10 pt-28 pb-12 transition-all duration-300 min-h-[calc(100vh-8rem)] ${sidebarOpen ? 'md:ml-64' : 'md:ml-20'}`}>
                <div className="px-4 md:px-8 w-full max-w-none">
                    {children}
                </div>
            </main>

            <footer className={`relative z-10 py-10 transition-all duration-300 no-print ${sidebarOpen ? 'md:ml-64' : 'md:ml-20'}`}>
                <div className="px-4 md:px-8 w-full max-w-none border-t border-slate-100 dark:border-slate-800 pt-8 flex flex-col md:flex-row items-center justify-between text-slate-400 text-xs font-bold uppercase tracking-widest gap-6">
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

            {/* What's New System Update Modal */}
            <Modal
                isOpen={showUpdateModal}
                onClose={handleDismissUpdate}
                title="🚀 System Updated!"
                maxWidth="max-w-xl"
                footer={(
                    <>
                        <button
                            type="button"
                            onClick={handleViewAllUpdates}
                            className="w-full md:w-auto px-5 py-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-black uppercase text-[10px] tracking-widest hover:bg-slate-50 dark:hover:bg-slate-700 transition-all"
                        >
                            View All Releases
                        </button>
                        <button
                            type="button"
                            onClick={handleDismissUpdate}
                            className="w-full md:w-auto px-5 py-3 rounded-xl bg-primary-600 text-white font-black uppercase text-[10px] tracking-widest hover:bg-primary-700 transition-all shadow-lg shadow-primary-600/20"
                        >
                            Got it, thanks!
                        </button>
                    </>
                )}
            >
                {latestUpdate && (
                    <div className="space-y-6">
                        <div className="flex items-center gap-4 bg-slate-100 dark:bg-slate-800/90 p-4 rounded-2xl border border-slate-200 dark:border-slate-700/80">
                            <div className="w-12 h-12 bg-primary-600 dark:bg-primary-500 rounded-xl flex items-center justify-center text-white shadow-md shrink-0">
                                <MdNewReleases size={24} />
                            </div>
                            <div>
                                <h4 className="font-black text-slate-900 dark:text-slate-100 text-lg leading-tight">{latestUpdate.title}</h4>
                                <p className="text-[10px] font-bold text-primary-600 dark:text-primary-400 mt-1 uppercase tracking-widest">Version {latestUpdate.version}</p>
                            </div>
                        </div>

                        <div>
                            <p className="text-slate-600 dark:text-slate-300 text-sm font-medium leading-relaxed">
                                {latestUpdate.message}
                            </p>
                        </div>

                        {latestUpdate.releaseNotes && latestUpdate.releaseNotes.length > 0 && (
                            <div className="space-y-3">
                                <h5 className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-400">Release Notes</h5>
                                <ul className="space-y-2">
                                    {latestUpdate.releaseNotes.map((note, idx) => (
                                        <li key={idx} className="flex items-start gap-2.5 text-sm font-bold text-slate-800 dark:text-slate-200">
                                            <MdCheckCircle className="text-emerald-500 dark:text-emerald-400 mt-0.5 shrink-0" size={16} />
                                            <span>{note}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {/* Seeding & Demo Setup */}
                        <div className="border-t border-slate-100 dark:border-slate-800 pt-5 mt-5 space-y-3">
                            <h5 className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-400">System Seeding Shortcuts</h5>
                            <div className="grid grid-cols-2 gap-4">
                                <button
                                    onClick={handleSeedMh}
                                    disabled={seedingMh}
                                    className="px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-left hover:bg-slate-100 dark:hover:bg-slate-700/80 transition-all flex flex-col gap-0.5 disabled:opacity-50"
                                >
                                    <span className="text-xs font-black text-slate-900 dark:text-slate-100">⚡ Seed MH Utility</span>
                                    <span className="text-[9px] text-slate-400 dark:text-slate-400 font-medium">Assets, tickets, & AMCs</span>
                                </button>
                                <button
                                    onClick={handleSeedKb}
                                    disabled={seedingKb}
                                    className="px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-left hover:bg-slate-100 dark:hover:bg-slate-700/80 transition-all flex flex-col gap-0.5 disabled:opacity-50"
                                >
                                    <span className="text-xs font-black text-slate-900 dark:text-slate-100">📚 Seed KB FAQs</span>
                                    <span className="text-[9px] text-slate-400 dark:text-slate-400 font-medium">Substation troubleshooting manuals</span>
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </Modal>

            {/* Draggable Floating Personal Notepad Button & Widget */}
            <FloatingNotepad />
        </div>
    );
};

export default Layout;
