import React, { useState, useEffect } from 'react';
import { userService } from '../services/api';

const Settings = () => {
    const [user, setUser] = useState({ name: '', email: '', role: '' });
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState(null);

    useEffect(() => {
        const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
        setUser(storedUser);
    }, []);

    const handleChange = (e) => {
        setUser({ ...user, [e.target.name]: e.target.value });
    };

    const handleUpdate = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage(null);
        try {
            const updateData = {
                name: user.name,
                email: user.email,
                ...(password && { password }) // Only send password if provided
            };

            const res = await userService.updateProfile(updateData);

            // Update local storage
            localStorage.setItem('user', JSON.stringify(res.data));
            setUser(res.data);
            setPassword(''); // Clear password field
            setMessage({ type: 'success', text: 'Profile updated successfully!' });
        } catch (error) {
            console.error("Update failed", error);
            setMessage({ type: 'error', text: 'Failed to update profile.' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-black text-slate-900 tracking-tight">Settings & Profile</h1>
                <p className="text-slate-500 font-medium">Manage your account preferences.</p>
            </div>

            <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden p-8 max-w-2xl">
                <h2 className="text-xl font-bold text-slate-800 mb-6">Profile Information</h2>

                {message && (
                    <div className={`mb-6 p-4 rounded-xl text-sm font-bold ${message.type === 'success' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                        {message.text}
                    </div>
                )}

                <form onSubmit={handleUpdate} className="space-y-6">
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-bold text-slate-500 mb-1">Full Name</label>
                            <input
                                type="text"
                                name="name"
                                value={user.name || ''}
                                onChange={handleChange}
                                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-700 font-bold focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-500 mb-1">Email Address</label>
                            <input
                                type="email"
                                name="email"
                                value={user.email || ''}
                                onChange={handleChange}
                                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-700 font-bold focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-500 mb-1">Role</label>
                            <div className="inline-block px-3 py-1 bg-slate-100 text-slate-500 rounded-lg text-sm font-black uppercase tracking-wide cursor-not-allowed">
                                {user.role || 'Sales'}
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-slate-500 mb-1">New Password (Optional)</label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Leave blank to keep current"
                                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-700 font-bold focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                            />
                        </div>
                    </div>

                    <div className="pt-4 border-t border-slate-100">
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-8 py-3 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default Settings;
