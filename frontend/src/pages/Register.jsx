import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';
import { User, Mail, Lock, CheckCircle } from 'lucide-react';
import './Auth.css';

const Register = () => {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        confirmPassword: ''
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const { login } = useAuth();

    const { name, email, password, confirmPassword } = formData;

    const onChange = e => setFormData({ ...formData, [e.target.name]: e.target.value });

    const onSubmit = async e => {
        e.preventDefault();
        setError('');

        if (password !== confirmPassword) {
            const msg = 'Passwords do not match';
            setError(msg);
            toast.error(msg);
            return;
        }

        setLoading(true);
        try {
            const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
            const res = await axios.post(`${baseUrl}/auth/register`, { name, email, password });

            await login(res.data.token, res.data.user);
            
            toast.success(
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ padding: '4px' }}>
                        <span style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>Welcome Aboard!</span>
                        <div style={{ fontSize: '0.9rem', opacity: 0.8 }}>Account created successfully</div>
                    </div>
                </div>,
                {
                    icon: <CheckCircle size={24} color="#0d9488" />,
                    style: {
                        background: '#fff',
                        color: '#1e293b',
                        borderRadius: '16px',
                        boxShadow: '0 10px 30px -5px rgba(0, 0, 0, 0.1)',
                        border: '1px solid #ccfbf1',
                        padding: '16px',
                    }
                }
            );

            setTimeout(() => {
                navigate('/dashboard');
            }, 800);
        } catch (err) {
            const errorMessage = err.response?.data?.message || 'Registration failed';
            setError(errorMessage);
            toast.error(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-container">
            <div className="auth-card">
                <h2>Create Account</h2>
                <p className="subtitle">Start generating professional quotes today</p>
                {error && <div className="error-msg">{error}</div>}
                <form onSubmit={onSubmit}>
                    <div className="form-group">
                        <label>Full Name</label>
                        <input 
                            type="text" 
                            name="name" 
                            value={name} 
                            onChange={onChange} 
                            placeholder="John Doe"
                            required 
                        />
                    </div>
                    <div className="form-group">
                        <label>Email Address</label>
                        <input 
                            type="email" 
                            name="email" 
                            value={email} 
                            onChange={onChange} 
                            placeholder="john@example.com"
                            required 
                        />
                    </div>
                    <div className="form-group">
                        <label>Password</label>
                        <input 
                            type="password" 
                            name="password" 
                            value={password} 
                            onChange={onChange} 
                            placeholder="••••••••"
                            required 
                            autoComplete="new-password"
                        />
                    </div>
                    <div className="form-group">
                        <label>Confirm Password</label>
                        <input 
                            type="password" 
                            name="confirmPassword" 
                            value={confirmPassword} 
                            onChange={onChange} 
                            placeholder="••••••••"
                            required 
                            autoComplete="new-password"
                        />
                    </div>
                    <button type="submit" className="btn-primary" disabled={loading}>
                        {loading ? 'Creating account...' : 'Create Account'}
                    </button>
                </form>
                <p className="auth-footer">
                    Already have an account? <Link to="/login">Sign in</Link>
                </p>
            </div>
        </div>
    );
};

export default Register;
