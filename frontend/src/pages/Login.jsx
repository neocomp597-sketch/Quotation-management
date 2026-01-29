import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';
import './Auth.css'; // We will create this

const Login = () => {
    const [formData, setFormData] = useState({
        email: '',
        password: ''
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const { login } = useAuth(); // Use Auth Context

    const { email, password } = formData;

    const onChange = e => setFormData({ ...formData, [e.target.name]: e.target.value });

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
            toast.success('Login successful! Welcome back.');

            // Redirect based on role or to dashboard
            navigate('/dashboard');
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
                        <input type="password" name="password" value={password} onChange={onChange} required />
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

