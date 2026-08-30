import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { authService } from '../services/api';
import { KeyRound, Mail, ArrowLeft, CheckCircle2, ShieldCheck } from 'lucide-react';
import './Auth.css';

const ForgotPassword = () => {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!email?.trim()) {
            toast.error('Please enter a valid email address');
            return;
        }

        setLoading(true);
        try {
            const res = await authService.forgotPassword({ email: email.trim() });
            toast.success(res.data?.message || 'Password reset link sent to your email!');
            setSubmitted(true);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to request password reset');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-container">
            <div className="auth-card" style={{ maxWidth: '460px' }}>
                <div style={{ textAlignment: 'center', marginBottom: '24px', textAlign: 'center' }}>
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
                        <KeyRound size={28} color="#ffffff" />
                    </div>
                    <h2 style={{ fontSize: '1.75rem', fontWeight: '800', color: '#0f172a', margin: 0 }}>
                        Forgot Password?
                    </h2>
                    <p className="subtitle" style={{ marginTop: '8px', fontSize: '0.9rem' }}>
                        No worries! Enter your registered email address below and we'll send you a password reset link.
                    </p>
                </div>

                        {submitted ? (
                            <div style={{ textAlign: 'center', padding: '16px 0' }}>
                                <div style={{
                                    backgroundColor: '#f0fdf4',
                                    border: '1px solid #bbf7d0',
                                    borderRadius: '16px',
                                    padding: '24px',
                                    marginBottom: '24px'
                                }}>
                                    <CheckCircle2 size={48} color="#16a34a" style={{ margin: '0 auto 12px auto' }} />
                                    <h3 style={{ fontSize: '1.15rem', fontWeight: '700', color: '#14532d', marginBottom: '8px' }}>
                                        Reset Link Sent!
                                    </h3>
                                    <p style={{ fontSize: '0.875rem', color: '#15803d', margin: 0, lineHeight: '1.5' }}>
                                        We've sent password reset instructions to <strong>{email}</strong>. Please check your inbox and follow the link.
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
                            <ArrowLeft size={18} /> Back to Sign In
                        </Link>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit}>
                        <div className="form-group" style={{ marginBottom: '24px' }}>
                            <label>Registered Email Address</label>
                            <div className="password-input-wrapper">
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="name@company.com"
                                    required
                                    autoFocus
                                />
                                <div style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}>
                                    <Mail size={18} />
                                </div>
                            </div>
                        </div>

                        <button type="submit" className="btn-primary" disabled={loading} style={{ width: '100%', marginBottom: '20px' }}>
                            {loading ? 'Sending Request...' : 'Send Reset Link'}
                        </button>

                        <div style={{ textAlign: 'center' }}>
                            <Link
                                to="/login"
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    fontSize: '0.875rem',
                                    fontWeight: '700',
                                    color: '#64748b',
                                    textDecoration: 'none'
                                }}
                            >
                                <ArrowLeft size={16} /> Return to Login
                            </Link>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
};

export default ForgotPassword;
