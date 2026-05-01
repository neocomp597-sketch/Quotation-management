import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";
import { toast } from "react-toastify";
import { useAuth } from "../context/AuthContext";
import { Eye, EyeOff, CheckCircle } from "lucide-react";
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
      const baseUrl =
        import.meta.env.VITE_API_URL || "http://localhost:4003/api";
      const res = await axios.post(`${baseUrl}/auth/login`, formData);

      await login(res.data.token, res.data.user);

      toast.success(
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ padding: "4px" }}>
            <span style={{ fontSize: "1.2rem", fontWeight: "bold" }}>
              Welcome Back!
            </span>
            <div style={{ fontSize: "0.9rem", opacity: 0.8 }}>
              Login successful
            </div>
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

      setTimeout(() => {
        navigate("/dashboard");
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
            <label>Password</label>
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
