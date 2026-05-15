import React, { useState, useEffect } from 'react';
import { MdEmail } from 'react-icons/md';
import PaginationControls from '../components/PaginationControls';
import { salespersonService } from '../services/api';

const LIST_PAGE_SIZE = 20;

const Salespersons = () => {
    const [salespersons, setSalespersons] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [pagination, setPagination] = useState({ page: 1, limit: LIST_PAGE_SIZE, total: 0, pages: 1 });

    const pagedSalespersons = salespersons;

    useEffect(() => {
        fetchSalespersons();
    }, [page]);

    const fetchSalespersons = async () => {
        try {
            const res = await salespersonService.getAll({ page, limit: LIST_PAGE_SIZE });
            const payload = res.data;
            setSalespersons(Array.isArray(payload) ? payload : payload.data || []);
            setPagination(payload.pagination || {
                page: 1,
                limit: LIST_PAGE_SIZE,
                total: Array.isArray(payload) ? payload.length : 0,
                pages: 1
            });
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-black text-slate-900 tracking-tight">System Users</h1>
                <p className="text-slate-500 font-medium">Manage sales staff and administrators.</p>
            </div>

            <div className="mobile-master-shell bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden p-6">
                {loading ? (
                    <div className="p-10 text-center text-slate-400">Loading...</div>
                ) : (
                    <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {pagedSalespersons.map(user => (
                            <div key={user._id} className="mobile-master-card p-6 border border-slate-100 rounded-2xl flex items-center gap-4 hover:shadow-md transition-shadow">
                                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-xl ${user.role === 'admin' ? 'bg-primary-700' : 'bg-primary-600'}`}>
                                    {user.name.charAt(0)}
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-bold text-slate-900">{user.name}</h3>
                                    <div className="text-xs text-slate-500 flex items-center gap-1">
                                        <MdEmail size={12} /> {user.email}
                                    </div>
                                    <span className={`text-[10px] font-black uppercase tracking-widest mt-2 inline-block px-2 py-0.5 rounded ${user.role === 'admin' ? 'bg-primary-100 text-primary-800' : 'bg-primary-50 text-primary-600'}`}>
                                        {user.role}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                    <PaginationControls pagination={pagination} onPageChange={setPage} className="-mx-6 mt-6 mb-[-1.5rem]" />
                    </>
                )}
            </div>
        </div>
    );
};

export default Salespersons;
