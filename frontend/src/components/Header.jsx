import React, { useState, useRef, useEffect } from 'react';
import { MdSearch, MdNotifications, MdAccountCircle, MdSettings, MdLogout } from 'react-icons/md';

import { useNavigate } from 'react-router-dom';

const Header = ({ sidebarOpen }) => {
    const navigate = useNavigate();
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const dropdownRef = useRef(null);

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/');
    };

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsProfileOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    return (
        <header className={`fixed top-0 right-0 h-20 bg-white/80 backdrop-blur-md border-b border-slate-200 z-40 transition-all duration-300 ${sidebarOpen ? 'left-64' : 'left-20'}`}>
            <div className="h-full px-8 flex items-center justify-between">
                <div className="relative w-96">
                    <MdSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                    <input
                        type="text"
                        placeholder="Search quotations, customers..."
                        className="w-full pl-10 pr-4 py-2 bg-slate-100 border-none rounded-xl focus:ring-2 focus:ring-primary-500 transition-all outline-none text-sm"
                    />
                </div>

                <div className="flex items-center gap-4">
                    <button className="p-2 text-slate-500 hover:bg-slate-100 rounded-full transition-colors relative">
                        <MdNotifications size={24} />
                        <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
                    </button>

                    <div className="h-8 w-[1px] bg-slate-200 mx-2"></div>

                    <div className="relative" ref={dropdownRef}>
                        <button
                            onClick={() => setIsProfileOpen(!isProfileOpen)}
                            className="flex items-center gap-3 pl-2 hover:bg-slate-50 p-2 rounded-xl transition-colors outline-none"
                        >
                            <div className="text-right hidden md:block">
                                <p className="text-sm font-semibold text-slate-900 leading-tight">{user.name || 'User'}</p>
                                <p className="text-xs text-slate-500 capitalize">{user.role || 'Sales'}</p>
                            </div>
                            <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 overflow-hidden ring-2 ring-transparent group-hover:ring-primary-100 transition-all">
                                <MdAccountCircle size={28} />
                            </div>
                        </button>

                        {/* Dropdown Menu */}
                        {isProfileOpen && (
                            <div className="absolute top-full right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-slate-100 py-2 animate-in fade-in zoom-in-95 duration-200 origin-top-right overflow-hidden">
                                <div className="px-4 py-3 border-b border-slate-50 md:hidden">
                                    <p className="text-sm font-bold text-slate-900 truncate">{user.name}</p>
                                    <p className="text-xs text-slate-500 capitalize">{user.role}</p>
                                </div>
                                <div className="p-1">
                                    <button
                                        onClick={() => {
                                            navigate('/settings');
                                            setIsProfileOpen(false);
                                        }}
                                        className="w-full text-left px-3 py-2.5 text-sm text-slate-600 hover:bg-slate-50 hover:text-primary-600 font-bold rounded-xl flex items-center gap-3 transition-colors"
                                    >
                                        <MdSettings size={18} className="text-slate-400" />
                                        Profile Settings
                                    </button>
                                    <button
                                        onClick={handleLogout}
                                        className="w-full text-left px-3 py-2.5 text-sm text-slate-600 hover:bg-rose-50 hover:text-rose-600 font-bold rounded-xl flex items-center gap-3 transition-colors"
                                    >
                                        <MdLogout size={18} className="text-slate-400 hover:text-rose-500" />
                                        Log Out
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
