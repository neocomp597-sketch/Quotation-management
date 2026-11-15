import React, { useEffect, useState } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import { useAuth } from "../context/AuthContext";
import { authService, readLoginNotice, clearLoginNotice } from "../services/api";
import { Eye, EyeOff } from "lucide-react";
import { getFallbackRoute } from "../constants/menuPermissions";
import SiteLogo from "../components/SiteLogo";
import "./Auth.css";

const Login = () => {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [error, setError] = useState(readLoginNotice);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => clearLoginNotice(), []);

  const navigate = useNavigate();
  const location = useLocation();

  const { login } = useAuth(); // Use Auth Context

  const { email, password } = formData;

  const onChange = (e) =>
    setFormData({ ...formData, [e.target.name]: e.target.value });

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!email?.trim()) {
      toast.error("Email Address is required");
      return;
    }
    if (!password?.trim()) {
      toast.error("Password is required");
      return;
    }

    setLoading(true);
    try {
      const res = await authService.login(formData);

      const session = await login(res.data);

      // No "Login successful" popup (client's request): opening the app is the confirmation.
      const storedReturnTo = sessionStorage.getItem("arcrm:returnTo");
      if (storedReturnTo) {
        sessionStorage.removeItem("arcrm:returnTo");
      }

      const role = session.user?.role;
      const isSuperAdmin = role === "SUPER_ADMIN" || role === "super_admin";
      const fallbackTarget = isSuperAdmin
        ? "/dashboard"
        : getFallbackRoute(session.permissions, session.user) || "/dashboard";
      const target = storedReturnTo && storedReturnTo !== "/login"
        ? storedReturnTo
        : location.state?.from?.pathname || fallbackTarget;

      // The session opens in the user's default branch (AuthContext); they switch from the header.
      navigate(target, { replace: true });
    } catch (err) {
      const errorMessage = err.response?.data?.message || "Login failed";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
          <SiteLogo className="w-14 h-14" />
        </div>
        <h2>Welcome Back</h2>
        <p className="subtitle">Sign in to manage your sales pipeline</p>
        {error && <div className="error-msg">{error}</div>}
        <form onSubmit={onSubmit}>
          <div className="form-group">
            <label>Email Address</label>
            <input
              type="email"
              name="email"
              value={email}
              onChange={onChange}
              placeholder="name@company.com"
              required
            />
          </div>
          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label style={{ marginBottom: 0 }}>Password</label>
              <Link
                to="/forgot-password"
                style={{
                  color: '#0d9488',
                  fontSize: '0.85rem',
                  fontWeight: '700',
                  textDecoration: 'none'
                }}
              >
                Forgot Password?
              </Link>
            </div>
            <div className="password-input-wrapper">
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                value={password}
                onChange={onChange}
                placeholder="••••••••"
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={togglePasswordVisibility}
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? "Please wait..." : "Sign In"}
          </button>
        </form>
        <p className="auth-footer">
          New here? <Link to="/register">Create an account</Link>
        </p>
      </div>
    </div>
  );
};

export default Login;
