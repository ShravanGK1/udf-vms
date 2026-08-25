import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from "react-redux";
import apiClient from "../app/apiClient";
import { loginSuccess } from "./authSlice";
import logo from "../assets/logo.png";
import {
  Mail, Lock, User, ArrowRight, ShieldCheck, Eye, EyeOff, Loader2
} from 'lucide-react';
import './Auth.css';

// FIXED: Added the component wrapper function
export default function Auth() {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [visitorCount, setVisitorCount] = useState(0);
  const [isRemotePending, setIsRemotePending] = useState(false);
  const [remoteEmail, setRemoteEmail] = useState("");

  const [branding, setBranding] = useState({
    name: "Unique Delta Force Security Pvt. Ltd.",
    logo: null
  });

  useEffect(() => {
    const fetchVisitorCount = async () => {
      try {
        const res = await apiClient.get("/active-visitors-count");
        setVisitorCount(res.data.count);
      } catch (err) {
        console.error("Error fetching visitor count:", err);
      }
    };

    const fetchBranding = async () => {
      try {
        const res = await apiClient.get("/company-branding");
        setBranding({
          name: res.data.company_name || "Unique Delta Force Security Pvt. Ltd.",
          logo: res.data.company_logo || null
        });
      } catch (err) {
        console.error("Error loading company branding:", err);
      }
    };

    fetchVisitorCount();
    fetchBranding();
  }, []);

  useEffect(() => {
    const pending = localStorage.getItem("remote_login_pending") === "true";
    const email = localStorage.getItem("last_logged_out_email") || "";
    if (pending && email) {
      setIsRemotePending(true);
      setRemoteEmail(email);
      
      const interval = setInterval(async () => {
        try {
          const res = await apiClient.post("/auth/poll-remote-login", { email });
          if (res.data.authorized && res.data.token) {
            clearInterval(interval);
            localStorage.removeItem("remote_login_pending");
            localStorage.removeItem("last_logged_out_email");
            
            dispatch(loginSuccess({ token: res.data.token, user: res.data.user }));
            sessionStorage.setItem("token", res.data.token);
            sessionStorage.setItem("role", res.data.user.role);
            sessionStorage.setItem("user", JSON.stringify(res.data.user));
            
            const role = res.data.user.role;
            if (role === 'host') {
              navigate('/host/dashboard');
            } else {
              navigate(`/${role}/dashboard`);
            }
          }
        } catch (err) {
          console.error("Remote login polling error:", err);
        }
      }, 3000);
      
      return () => clearInterval(interval);
    }
  }, [dispatch, navigate]);

  const handleCancelRemote = () => {
    localStorage.removeItem("remote_login_pending");
    localStorage.removeItem("last_logged_out_email");
    setIsRemotePending(false);
    setRemoteEmail("");
    window.location.reload();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const email = e.target.email.value;
    const password = e.target.password.value;

    const hasUppercase = /[A-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[^A-Za-z0-9]/.test(password);

    if (!password || password.length < 8 || !hasUppercase || !hasNumber || !hasSpecial) {
      setError("Password must be at least 8 characters, contain at least one uppercase letter, one special character, and one number.");
      setIsLoading(false);
      return;
    }

    const formData = {
      email,
      password,
      ...(!isLogin && { name: e.target.name.value })
    };

    try {
      const endpoint = isLogin ? "/auth/login" : "/auth/register";

      // 1. Call API
      const res = await apiClient.post(endpoint, formData);

      // 2. Dispatch to Redux
      dispatch(loginSuccess(res.data));
      sessionStorage.setItem("token", res.data.token);
      sessionStorage.setItem("role", res.data.user.role);
      sessionStorage.setItem("user", JSON.stringify(res.data.user));


      const role = res.data.user.role;
      if (role === 'host') {
        navigate('/host/dashboard');
      } else {
        navigate(`/${role}/dashboard`);
      }

    } catch (err) {
      console.error("Auth Error:", err);

      setError(err.response?.data?.message || "Authentication failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <div className="auth-container">
      <div className="auth-card">

        {/* Left Side: Visuals */}
        <div className="auth-visual">
          <div className="visual-content">
            <div className="brand-section">
              <img
                src={branding.logo || logo}
                onError={(e) => {
                  e.target.src = logo;
                }}
                alt="Company Logo"
                className="auth-logo"
              />
              <div className="company-name">
                {branding.name}
              </div>
            </div>

            <h1>{isLogin ? "Welcome Back!" : "Join Us Today"}</h1>
            <p>
              {isLogin
                ? "Streamline your visitor management workflow with our secure, automated entry system."
                : "Create an account to start managing visitors, generating passes, and tracking security in real-time."
              }
            </p>

            <div className="glass-badge">
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <div style={{ width: '12px', height: '12px', background: '#4ade80', borderRadius: '50%' }}></div>
                <span style={{ fontSize: '0.9rem', fontWeight: '500' }}>System Operational</span>
              </div>
              <div style={{ marginTop: '0.5rem', fontSize: '2rem', fontWeight: 'bold' }}>{visitorCount} </div>
              <div style={{ fontSize: '0.8rem', opacity: 0.8 }}>Active Visitors on Premises</div>
            </div>
          </div>

          <div style={{ fontSize: '0.8rem', opacity: 0.6 }}>
            © 2026 {branding.name}
          </div>
        </div>

        {/* Right Side: Interactive Form */}
        <div className="auth-form-side">
          {isRemotePending ? (
            <div className="fade-in" style={{ textAlign: 'center', padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem', justifyContent: 'center', height: '100%' }}>
              <div style={{ padding: '1.25rem', background: 'rgba(37, 99, 235, 0.1)', borderRadius: '50%', color: '#2563eb' }}>
                <Loader2 className="animate-spin" size={48} />
              </div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#1e293b', margin: 0 }}>Remote Re-authenticating</h2>
              <p style={{ color: '#64748b', fontSize: '0.95rem', lineHeight: '1.6', maxWidth: '320px', margin: 0 }}>
                This dashboard session was reset by the Super Admin. Re-login is being approved remotely by the Admin console for user <strong>{remoteEmail}</strong>.
              </p>
              <div style={{ fontSize: '0.8rem', color: '#0f766e', background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '8px 16px', borderRadius: '6px', fontWeight: 600 }}>
                Waiting for Admin remote re-login...
              </div>
              <button 
                onClick={handleCancelRemote} 
                style={{ marginTop: '1rem', padding: '10px 20px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, color: '#334155', transition: 'all 0.2s' }}
              >
                Log In Manually
              </button>
            </div>
          ) : (
            <>
              <div className="form-header fade-in" key={isLogin ? 'login-header' : 'signup-header'}>
                <h2>{isLogin ? "Sign In" : "Create Account"}</h2>
              </div>

          <form onSubmit={handleSubmit} className="fade-in" key={isLogin ? 'login-form' : 'signup-form'}>

            {!isLogin && (
              <div className="input-wrapper">
                <User size={20} className="input-icon" />
                <input
                  name="name"
                  type="text"
                  className="auth-input"
                  placeholder="Full Name"
                  required
                />
              </div>
            )}

            <div className="input-wrapper">
              <Mail size={20} className="input-icon" />
              <input
                name="email"
                type="email"
                className="auth-input"
                placeholder="Email Address"
                required
              />
            </div>

            <div className="input-wrapper">
              <Lock size={20} className="input-icon" />
              <input
                name="password"
                type={showPassword ? "text" : "password"}
                className="auth-input"
                placeholder="Password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', color: '#64748b'
                }}
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>

            {error && (
              <div style={{ color: '#ef4444', fontSize: '0.9rem', marginBottom: '1rem', textAlign: 'center' }}>
                {error}
              </div>
            )}

            <button type="submit" className="submit-btn" disabled={isLoading}>
              {isLoading ? (
                <Loader2 className="animate-spin" size={20} />
              ) : (
                <>
                  {isLogin ? "Sign In" : "Sign Up"}
                  <ArrowRight size={18} />
                </>
              )}
            </button>

          </form>

          {/* <div className="toggle-text">
            {isLogin ? "Don't have an account?" : "Already have an account?"}
            <span
              className="toggle-link"
              onClick={() => {
                setIsLogin(!isLogin);
                setError('');
              }}
            >
              {isLogin ? "Sign Up" : "Log In"}
            </span>
          </div> */}

            </>
          )}
        </div>
      </div>
    </div>
  );
}
