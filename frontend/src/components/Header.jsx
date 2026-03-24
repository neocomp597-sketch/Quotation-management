import React, { useState, useRef, useEffect } from 'react';
import { MdSearch, MdNotifications, MdAccountCircle, MdSettings, MdLogout, MdMenu } from 'react-icons/md';
import { useNavigate, Link } from 'react-router-dom';

const Header = ({ sidebarOpen, toggleSidebar }) => {
    const navigate = useNavigate();
    const user = JSON.parse(localStorage.getItem('user') || '{"name": "User", "email": "user@example.com"}');
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const dropdownRef = useRef(null);

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/');
    };

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsProfileOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <header className={`fixed top-0 right-0 h-20 bg-white/80 backdrop-blur-xl border-b border-slate-100 z-40 transition-all duration-300 left-0 ${sidebarOpen ? 'md:left-64' : 'md:left-20'}`}>
            <div className="h-full px-6 flex items-center justify-between gap-4">
                <div className="flex items-center gap-4 flex-1">
                    <button
                        onClick={toggleSidebar}
                        className="p-2 -ml-2 text-slate-500 hover:bg-slate-50 rounded-xl md:hidden transition-colors"
                    >
                        <MdMenu size={24} />
                    </button>

                    <div className="relative w-full max-w-lg hidden sm:block group">
                        <MdSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary-600 transition-colors" size={20} />
                        <input
                            type="text"
                            placeholder="Find quotes, customers, products..."
                            className="w-full pl-12 pr-4 py-2.5 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-primary-600/20 focus:bg-white transition-all outline-none text-sm font-semibold text-slate-900 placeholder:text-slate-400"
                        />
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button className="relative p-2.5 rounded-2xl bg-slate-50 text-slate-500 hover:text-primary-600 hover:bg-white hover:ring-1 hover:ring-slate-100 transition-all hidden sm:flex">
                        <MdNotifications size={22} />
                        <span className="absolute top-2.5 right-2.5 w-2.5 h-2.5 bg-rose-500 border-2 border-white rounded-full"></span>
                    </button>

                    <div className="h-10 w-px bg-slate-100 mx-2 hidden sm:block"></div>

                    <div className="relative" ref={dropdownRef}>
                        <button
                            onClick={() => setIsProfileOpen(!isProfileOpen)}
                            className="flex items-center gap-3 pl-2 pr-1 py-1 rounded-2xl hover:bg-slate-50 transition-all border border-transparent hover:border-slate-100 outline-none"
                        >
                            <div className="text-right hidden md:block">
                                <p className="text-sm font-black text-slate-900 leading-none">{user?.name || 'User'}</p>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Sales Specialist</p>
                            </div>
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center shadow-sm overflow-hidden ring-1 ring-slate-200 ring-offset-2 hover:ring-primary-600 transition-all">
                                {user?.avatar ? (
                                    <img src={user.avatar} alt="Avatar" className="w-full h-full object-cover" />
                                ) : (
                                    <span className="text-slate-600 font-bold text-sm">{user?.name?.charAt(0) || 'U'}</span>
                                )}
                            </div>
                        </button>

                        {isProfileOpen && (
                            <div className="absolute top-full right-0 mt-3 w-64 bg-white rounded-2xl shadow-2xl border border-slate-100 py-2 animate-in fade-in slide-in-from-top-2 duration-200">
                                <div className="px-4 py-3 border-b border-slate-50 mb-2">
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Signed in as</p>
                                    <p className="text-sm font-bold text-slate-900 truncate mt-1">{user?.email}</p>
                                </div>
                                <div className="p-1">
                                    <Link
                                        to="/settings"
                                        onClick={() => setIsProfileOpen(false)}
                                        className="flex items-center gap-3 px-3 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50 hover:text-primary-600 rounded-xl transition-all"
                                    >
                                        <MdSettings size={18} /> Settings
                                    </Link>
                                    <button
                                        onClick={handleLogout}
                                        className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-bold text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                                    >
                                        <MdLogout size={18} /> Sign Out
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
