import React, { useState } from 'react';
import { authService } from '../services/api';
import { toast } from 'react-toastify';
import { MdLock, MdVisibility, MdVisibilityOff } from 'react-icons/md';

const ChangePasswordModal = ({ isOpen, user, onPasswordChanged }) => {
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!newPassword || newPassword.length < 6) {
            toast.error('Password must be at least 6 characters long');
            return;
        }

        if (newPassword !== confirmPassword) {
            toast.error('Passwords do not match');
            return;
        }

        if (newPassword === '123456') {
            toast.error('Please choose a different password than the default password (123456)');
            return;
        }

        try {
            setLoading(true);
            const res = await authService.changePassword({ newPassword });
            toast.success('Password changed successfully!');
            
            // Update local user state
            const storedUserStr = localStorage.getItem('user');
            if (storedUserStr) {
                try {
                    const parsed = JSON.parse(storedUserStr);
                    parsed.mustChangePassword = false;
                    localStorage.setItem('user', JSON.stringify(parsed));
                } catch {
                    // ignore
                }
            }

            const updatedUser = res.data?.user || { ...user, mustChangePassword: false };
            if (onPasswordChanged) {
                onPasswordChanged(updatedUser);
            }
        } catch (error) {
            console.error('Password change error', error);
            toast.error(error.response?.data?.message || 'Failed to change password');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-fade-in">
            <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 border border-slate-100 relative overflow-hidden">
                <div className="absolute -top-10 -right-10 w-32 h-32 bg-primary-100/50 rounded-full blur-2xl pointer-events-none"></div>
                
                <div className="w-14 h-14 bg-primary-50 rounded-2xl flex items-center justify-center text-primary-600 mb-6 mx-auto shadow-inner">
                    <MdLock size={28} />
                </div>

                <div className="text-center mb-6">
                    <h3 className="text-xl font-black text-slate-900">Change Default Password</h3>
                    <p className="text-xs text-slate-500 font-medium mt-1">
                        Welcome, <span className="font-bold text-slate-700">{user?.name || user?.email}</span>! For account security, you must update your default password on first login.
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">New Password</label>
                        <div className="relative">
                            <input
                                type={showPassword ? 'text' : 'password'}
                                required
                                minLength={6}
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:bg-white focus:ring-2 focus:ring-primary-500 outline-none transition-all pr-10"
                                placeholder="Enter new secure password"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-3.5 text-slate-400 hover:text-slate-600"
                            >
                                {showPassword ? <MdVisibilityOff size={18} /> : <MdVisibility size={18} />}
                            </button>
                        </div>
                    </div>

                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Confirm New Password</label>
                        <input
                            type={showPassword ? 'text' : 'password'}
                            required
                            minLength={6}
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:bg-white focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                            placeholder="Re-enter new password"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-primary-600/20 mt-2 disabled:opacity-50"
                    >
                        {loading ? 'Updating Password...' : 'Update Password & Continue'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default ChangePasswordModal;
