import React from 'react';
import { MdSearch, MdNotifications, MdAccountCircle } from 'react-icons/md';

const Header = ({ sidebarOpen }) => {
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

                    <div className="flex items-center gap-3 pl-2">
                        <div className="text-right">
                            <p className="text-sm font-semibold text-slate-900 leading-tight">Admin User</p>
                            <p className="text-xs text-slate-500">Super Admin</p>
                        </div>
                        <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center text-primary-700">
                            <MdAccountCircle size={28} />
                        </div>
                    </div>
                </div>
            </div>
        </header>
    );
};

export default Header;
