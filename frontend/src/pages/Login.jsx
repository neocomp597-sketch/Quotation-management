import React, { useState } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import { useAuth } from "../context/AuthContext";
import { authService } from "../services/api";
import { Eye, EyeOff, CheckCircle } from "lucide-react";
import { getFallbackRoute } from "../constants/menuPermissions";
import "./Auth.css";

const Login = () => {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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

      toast.success(
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <span style={{ fontSize: "1.1rem", fontWeight: "bold" }}>
            Welcome Back!
          </span>
          <div style={{ fontSize: "0.85rem", opacity: 0.8 }}>
            Login successful
          </div>
        </div>,
        {
          icon: <CheckCircle size={24} color="#0d9488" />,
          style: {
            background: "#fff",
            color: "#1e293b",
            borderRadius: "16px",
            boxShadow: "0 10px 30px -5px rgba(0, 0, 0, 0.1)",
            border: "1px solid #ccfbf1",
            padding: "16px",
          },
        },
      );

      const assigned = session.user?.assignedBranches || [];

      setTimeout(() => {
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

        if (assigned.length > 1) {
          navigate("/select-branch", { state: { returnTo: target }, replace: true });
        } else {
          if (assigned.length === 1) {
            const b = assigned[0];
            const bId = b._id || b.id || b;
            localStorage.setItem("activeBranchId", bId);
            if (typeof b === "object") {
              localStorage.setItem("activeBranch", JSON.stringify(b));
            }
          }
          navigate(target, { replace: true });
        }
      }, 800);
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
