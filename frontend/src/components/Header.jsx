import React, { useState, useRef, useEffect } from 'react';
import { MdSearch, MdNotifications, MdLogout, MdMenu, MdSettings, MdCheck } from 'react-icons/md';
import { useNavigate, Link } from 'react-router-dom';
import { notificationService } from '../services/api';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';

const Header = ({ sidebarOpen, toggleSidebar }) => {
    const navigate = useNavigate();
    const { user, logout } = useAuth();
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [isNotifOpen, setIsNotifOpen] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const dropdownRef = useRef(null);
    const notifRef = useRef(null);

    const handleLogout = () => {
        logout();
        navigate('/');
    };

    const fetchNotifications = async () => {
        try {
            const res = await notificationService.getUnread();
            setNotifications(res.data);
            
            // Trigger popup toast for overdue & today on mount
            const overdue = res.data.filter(n => n.type === 'Overdue');
            const reminder = res.data.filter(n => n.type === 'Reminder');
            
            if (overdue.length > 0) {
                toast.error(`You have ${overdue.length} overdue follow-ups!`, { position: 'top-right', autoClose: false });
            }
            if (reminder.length > 0) {
                toast.info(`You have ${reminder.length} follow-ups scheduled for today.`, { position: 'top-right' });
            }
        } catch (err) {
            console.error("Failed to fetch notifications", err);
        }
    };

    // Auto-fetch on mount and then every few minutes
    useEffect(() => {
        const initialFetchTimer = setTimeout(() => {
            void fetchNotifications();
        }, 0);
        const interval = setInterval(() => {
            void fetchNotifications();
        }, 5 * 60 * 1000); // 5 mins
        return () => {
            clearTimeout(initialFetchTimer);
            clearInterval(interval);
        };
    }, []);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsProfileOpen(false);
            }
            if (notifRef.current && !notifRef.current.contains(event.target)) {
                setIsNotifOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const dismissNotification = async (id, e) => {
        e.stopPropagation();
        try {
            await notificationService.dismiss(id);
            setNotifications(prev => prev.filter(n => n._id !== id));
        } catch (error) {
            console.error('Failed to dismiss notification', error);
        }
    };

    const handleNotifClick = async (n) => {
        try {
            await notificationService.markAsRead(n._id);
            if (n.relatedId) navigate(`/enquiries/edit/${n.relatedId}`);
            setIsNotifOpen(false);
        } catch (error) {
            console.error('Failed to mark notification as read', error);
        }
    };

    return (
        <header className={`fixed top-0 right-0 h-20 bg-white/80 backdrop-blur-xl border-b border-slate-100 z-40 transition-all duration-300 left-0 ${sidebarOpen ? 'md:left-64' : 'md:left-20'}`}>
            <div className="h-full px-6 flex items-center justify-between gap-4">
                <div className="flex items-center gap-4 flex-1">
                    <button onClick={toggleSidebar} className="p-2 -ml-2 text-slate-500 hover:bg-slate-50 rounded-xl md:hidden transition-colors">
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
                    <div className="relative" ref={notifRef}>
                        <button 
                            onClick={() => setIsNotifOpen(!isNotifOpen)}
                            className="relative p-2.5 rounded-2xl bg-slate-50 text-slate-500 hover:text-primary-600 hover:bg-white hover:ring-1 hover:ring-slate-100 transition-all flex"
                        >
                            <MdNotifications size={22} />
                            {notifications.length > 0 && (
                                <span className="absolute top-1.5 right-1.5 w-3 h-3 bg-rose-500 border-2 border-white rounded-full"></span>
                            )}
                        </button>
                        
                        {isNotifOpen && (
                            <div className="absolute top-full right-0 mt-3 w-80 max-h-96 overflow-y-auto bg-white rounded-2xl shadow-2xl border border-slate-100 py-3 animate-in fade-in slide-in-from-top-2 duration-200">
                                <div className="px-4 pb-2 border-b border-slate-50 mb-2 flex justify-between items-center">
                                    <h4 className="font-black text-slate-900">Notifications</h4>
                                    <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{notifications.length} Unread</span>
                                </div>
                                {notifications.length === 0 ? (
                                    <div className="p-4 text-center text-sm font-bold text-slate-400">You're all caught up!</div>
                                ) : (
                                    notifications.map(n => (
                                        <div key={n._id} onClick={() => handleNotifClick(n)} className={`p-3 mx-2 mb-1 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors border-l-4 ${n.type === 'Overdue' ? 'border-rose-500 bg-rose-50/30' : 'border-primary-500 bg-primary-50/30'}`}>
                                            <div className="flex justify-between items-start mb-1">
                                                <span className={`text-[10px] font-black uppercase tracking-widest ${n.type === 'Overdue' ? 'text-rose-600' : 'text-primary-600'}`}>{n.type}</span>
                                                <button onClick={(e) => dismissNotification(n._id, e)} className="text-slate-400 hover:text-slate-600">
                                                    <MdCheck size={14} />
                                                </button>
                                            </div>
                                            <p className="text-xs font-bold text-slate-800">{n.title}</p>
                                            <p className="text-[10px] font-medium text-slate-600 mt-0.5 leading-snug">{n.message}</p>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}
                    </div>

                    <div className="h-10 w-px bg-slate-100 mx-2 hidden sm:block"></div>

                    <div className="relative" ref={dropdownRef}>
                        <button onClick={() => setIsProfileOpen(!isProfileOpen)} className="flex items-center gap-3 pl-2 pr-1 py-1 rounded-2xl hover:bg-slate-50 transition-all border border-transparent hover:border-slate-100 outline-none">
                            <div className="text-right hidden md:block">
                                <p className="text-sm font-black text-slate-900 leading-none">{user?.name || 'User'}</p>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{user?.role || 'User'}</p>
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
                                    <Link to="/settings" onClick={() => setIsProfileOpen(false)} className="flex items-center gap-3 px-3 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50 hover:text-primary-600 rounded-xl transition-all">
                                        <MdSettings size={18} /> Settings
                                    </Link>
                                    <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-bold text-rose-600 hover:bg-rose-50 rounded-xl transition-all">
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
