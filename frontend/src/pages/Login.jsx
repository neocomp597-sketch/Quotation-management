import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';
import { Eye, EyeOff, CheckCircle } from 'lucide-react';
import './Auth.css'; // We will create this

const Login = () => {
    const [formData, setFormData] = useState({
        email: '',
        password: ''
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const navigate = useNavigate();

    const { login } = useAuth(); // Use Auth Context

    const { email, password } = formData;

    const onChange = e => setFormData({ ...formData, [e.target.name]: e.target.value });

    const togglePasswordVisibility = () => {
        setShowPassword(!showPassword);
    };

    const onSubmit = async e => {
        e.preventDefault();

        // Validate required fields
        if (!email?.trim()) {
            toast.error('Email Address is required');
            return;
        }
        if (!password?.trim()) {
            toast.error('Password is required');
            return;
        }

        setLoading(true);
        try {
            // Adjust API URL as needed
            const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
            const res = await axios.post(`${baseUrl}/auth/login`, formData);

            // Use context login method
            login(res.data.token, res.data.user);

            // Beautiful Toast
            toast.success(
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ padding: '4px' }}>
                        <span style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>Welcome Back!</span>
                        <div style={{ fontSize: '0.9rem', opacity: 0.8 }}>Login successful</div>
                    </div>
                </div>,
                {
                    icon: <CheckCircle size={24} color="#10B981" />, // Emerald-500
                    style: {
                        background: '#fff',
                        color: '#1e293b',
                        borderRadius: '16px',
                        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                        border: '1px solid #e2e8f0',
                        padding: '16px',
                    },
                    progressStyle: {
                        background: 'linear-gradient(to right, #3b82f6, #8b5cf6)',
                    }
                }
            );

            // Redirect based on role or to dashboard
            setTimeout(() => {
                navigate('/dashboard');
            }, 1000); // Slight delay to show the nice toast
        } catch (err) {
            const errorMessage = err.response?.data?.message || 'Login failed';
            setError(errorMessage);
            toast.error(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-container">
            <div className="auth-card">
                <h2>Login</h2>
                {error && <p className="error-msg">{error}</p>}
                <form onSubmit={onSubmit}>
                    <div className="form-group">
                        <label>Email Address <span className="required">*</span></label>
                        <input type="email" name="email" value={email} onChange={onChange} required />
                    </div>
                    <div className="form-group">
                        <label>Password <span className="required">*</span></label>
                        <div className="password-input-wrapper">
                            <input
                                type={showPassword ? "text" : "password"}
                                name="password"
                                value={password}
                                onChange={onChange}
                                required
                            />
                            <button
                                type="button"
                                className="password-toggle-btn"
                                onClick={togglePasswordVisibility}
                                aria-label={showPassword ? "Hide password" : "Show password"}
                            >
                                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                            </button>
                        </div>
                    </div>
                    <button type="submit" className="btn-primary" disabled={loading}>
                        {loading ? 'Signing in...' : 'Login'}
                    </button>
                </form>
                <p className="auth-footer">
                    Don't have an account? <Link to="/register">Register</Link>
                </p>
            </div>
        </div>
    );
};

export default Login;

