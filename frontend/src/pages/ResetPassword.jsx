import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { authService } from '../services/api';
import { Lock, Eye, EyeOff, CheckCircle2, ShieldCheck, ArrowRight } from 'lucide-react';
import './Auth.css';

const ResetPassword = () => {
    const { token } = useParams();
    const navigate = useNavigate();

    const [formData, setFormData] = useState({
        password: '',
        confirmPassword: ''
    });
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    const { password, confirmPassword } = formData;

    const onChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!password || password.length < 6) {
            toast.error('Password must be at least 6 characters long');
            return;
        }

        if (password !== confirmPassword) {
            toast.error('Passwords do not match');
            return;
        }

        setLoading(true);
        try {
            const res = await authService.resetPassword(token, { newPassword: password });
            toast.success(res.data?.message || 'Password reset successfully!');
            setSuccess(true);
            setTimeout(() => {
                navigate('/login');
            }, 3000);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to reset password. Link may be invalid or expired.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-container">
            <div className="auth-card" style={{ maxWidth: '460px' }}>
                <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                    <div style={{
                        width: '56px',
                        height: '56px',
                        borderRadius: '16px',
                        background: 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 8px 20px -4px rgba(13, 148, 136, 0.4)',
                        marginBottom: '16px'
                    }}>
                        <ShieldCheck size={28} color="#ffffff" />
                    </div>
                    <h2 style={{ fontSize: '1.75rem', fontWeight: '800', color: '#0f172a', margin: 0 }}>
                        Set New Password
                    </h2>
                    <p className="subtitle" style={{ marginTop: '8px', fontSize: '0.9rem' }}>
                        Please enter your new password below to secure your account.
                    </p>
                </div>

                {success ? (
                    <div style={{ textAlign: 'center', padding: '16px 0' }}>
                        <div style={{
                            backgroundColor: '#f0fdf4',
                            border: '1px solid #bbf7d0',
                            borderRadius: '16px',
                            padding: '24px',
                            marginBottom: '24px'
                        }}>
                            <CheckCircle2 size={48} color="#16a34a" style={{ margin: '0 auto 12px auto' }} />
                            <h3 style={{ fontSize: '1.2rem', fontWeight: '800', color: '#14532d', marginBottom: '8px' }}>
                                Password Reset Complete!
                            </h3>
                            <p style={{ fontSize: '0.875rem', color: '#15803d', margin: 0, lineHeight: '1.5' }}>
                                Your password has been successfully updated. Redirecting you to sign in...
                            </p>
                        </div>

                        <Link
                            to="/login"
                            className="btn-primary"
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px',
                                textDecoration: 'none',
                                width: '100%'
                            }}
                        >
                            Sign In Now <ArrowRight size={18} />
                        </Link>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit}>
                        <div className="form-group" style={{ marginBottom: '18px' }}>
                            <label>New Password</label>
                            <div className="password-input-wrapper">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    name="password"
                                    value={password}
                                    onChange={onChange}
                                    placeholder="Minimum 6 characters"
                                    required
                                    autoFocus
                                />
                                <button
                                    type="button"
                                    className="password-toggle-btn"
                                    onClick={() => setShowPassword(!showPassword)}
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>

                        <div className="form-group" style={{ marginBottom: '24px' }}>
                            <label>Confirm New Password</label>
                            <div className="password-input-wrapper">
                                <input
                                    type={showConfirmPassword ? 'text' : 'password'}
                                    name="confirmPassword"
                                    value={confirmPassword}
                                    onChange={onChange}
                                    placeholder="Re-enter new password"
                                    required
                                />
                                <button
                                    type="button"
                                    className="password-toggle-btn"
                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                >
                                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>

                        <button type="submit" className="btn-primary" disabled={loading} style={{ width: '100%', marginBottom: '16px' }}>
                            {loading ? 'Resetting Password...' : 'Reset Password'}
                        </button>

                        <div style={{ textAlign: 'center' }}>
                            <Link
                                to="/login"
                                style={{
                                    fontSize: '0.875rem',
                                    fontWeight: '700',
                                    color: '#64748b',
                                    textDecoration: 'none'
                                }}
                            >
                                Back to Sign In
                            </Link>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
};

export default ResetPassword;
