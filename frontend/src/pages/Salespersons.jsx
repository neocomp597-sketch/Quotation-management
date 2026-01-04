import React, { useState, useEffect } from 'react';
import { MdDelete, MdPerson, MdEmail, MdAdminPanelSettings } from 'react-icons/md';
import { salespersonService } from '../services/api';

const Salespersons = () => {
    const [salespersons, setSalespersons] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchSalespersons();
    }, []);

    const fetchSalespersons = async () => {
        try {
            const res = await salespersonService.getAll();
            setSalespersons(res.data);
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

            <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden p-6">
                {loading ? (
                    <div className="p-10 text-center text-slate-400">Loading...</div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {salespersons.map(user => (
                            <div key={user._id} className="p-6 border border-slate-100 rounded-2xl flex items-center gap-4 hover:shadow-md transition-shadow">
                                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-xl ${user.role === 'admin' ? 'bg-purple-600' : 'bg-primary-600'}`}>
                                    {user.name.charAt(0)}
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-bold text-slate-900">{user.name}</h3>
                                    <div className="text-xs text-slate-500 flex items-center gap-1">
                                        <MdEmail size={12} /> {user.email}
                                    </div>
                                    <span className={`text-[10px] font-black uppercase tracking-widest mt-2 inline-block px-2 py-0.5 rounded ${user.role === 'admin' ? 'bg-purple-50 text-purple-600' : 'bg-primary-50 text-primary-600'}`}>
                                        {user.role}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Salespersons;
