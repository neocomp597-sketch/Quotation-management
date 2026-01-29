import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';
import './Auth.css';

const Register = () => {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        confirmPassword: '' // Added confirm password
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const { login } = useAuth(); // Use Auth Context

    const { name, email, password, confirmPassword } = formData;

    const onChange = e => setFormData({ ...formData, [e.target.name]: e.target.value });

    const onSubmit = async e => {
        e.preventDefault();

        // Validate required fields
        if (!name?.trim()) {
            toast.error('Name is required');
            return;
        }
        if (!email?.trim()) {
            toast.error('Email Address is required');
            return;
        }
        if (!password?.trim()) {
            toast.error('Password is required');
            return;
        }
        if (!confirmPassword?.trim()) {
            toast.error('Confirm Password is required');
            return;
        }

        if (password !== confirmPassword) {
            toast.error('Passwords do not match');
            setError('Passwords do not match');
            return;
        }

        setLoading(true);
        try {
            const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
            const res = await axios.post(`${baseUrl}/auth/register`, { name, email, password });

            login(res.data.token, res.data.user);
            toast.success('Registration successful! Welcome aboard.');

            navigate('/dashboard');
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
                <h2>Register</h2>
                {error && <p className="error-msg">{error}</p>}
                <form onSubmit={onSubmit}>
                    <div className="form-group">
                        <label>Name <span className="required">*</span></label>
                        <input type="text" name="name" value={name} onChange={onChange} required />
                    </div>
                    <div className="form-group">
                        <label>Email Address <span className="required">*</span></label>
                        <input type="email" name="email" value={email} onChange={onChange} required />
                    </div>
                    <div className="form-group">
                        <label>Password <span className="required">*</span></label>
                        <input type="password" name="password" value={password} onChange={onChange} required />
                    </div>
                    <div className="form-group">
                        <label>Confirm Password <span className="required">*</span></label>
                        <input type="password" name="confirmPassword" value={confirmPassword} onChange={onChange} required />
                    </div>
                    <button type="submit" className="btn-primary" disabled={loading}>
                        {loading ? 'Creating Account...' : 'Register'}
                    </button>
                </form>
                <p className="auth-footer">
                    Already have an account? <Link to="/login">Login</Link>
                </p>
            </div>
        </div>
    );
};

export default Register;

