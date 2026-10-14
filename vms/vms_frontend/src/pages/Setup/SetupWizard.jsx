import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Building2,
  MapPin,
  User,
  Mail,
  Lock,
  Key,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Check
} from "lucide-react";
import apiClient from "../../app/apiClient";
import "./SetupWizard.css";

export default function SetupWizard({ onSetupComplete }) {
  const navigate = useNavigate();

  // Step state: 1 = Org/Site, 2 = Admin, 3 = Review & License, 4 = Success
  const [currentStep, setCurrentStep] = useState(1);
  const [verifyingStatus, setVerifyingStatus] = useState(true);
  const [isSetupAllowed, setIsSetupAllowed] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    organization_name: "",
    site_name: "",
    site_code: "HQ",
    admin_name: "",
    admin_email: "",
    admin_password: "",
    confirm_password: "",
    license_key: ""
  });

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successInfo, setSuccessInfo] = useState(null);

  // Check setup status on load to prevent unauthorized reopening
  useEffect(() => {
    let isMounted = true;
    const verifyStatus = async () => {
      try {
        const res = await apiClient.get("/setup/status");
        if (isMounted) {
          if (res.data?.setup_required) {
            setIsSetupAllowed(true);
          } else {
            setIsSetupAllowed(false);
            navigate("/", { replace: true });
          }
          setVerifyingStatus(false);
        }
      } catch (err) {
        if (isMounted) {
          setErrorMsg("Could not verify setup status. Please ensure database service is running.");
          setVerifyingStatus(false);
        }
      }
    };

    verifyStatus();
    return () => {
      isMounted = false;
    };
  }, [navigate]);

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setErrorMsg("");
  };

  // Password validation rules matching backend is_valid_password
  const pwd = formData.admin_password;
  const isLenValid = pwd.length >= 8;
  const hasUpper = /[A-Z]/.test(pwd);
  const hasNumber = /[0-9]/.test(pwd);
  const hasSpecial = /[^A-Za-z0-9]/.test(pwd);
  const isPasswordValid = isLenValid && hasUpper && hasNumber && hasSpecial;
  const doPasswordsMatch = pwd && pwd === formData.confirm_password;

  const validateStep1 = () => {
    if (!formData.organization_name.trim()) {
      setErrorMsg("Please enter your organization name.");
      return false;
    }
    if (!formData.site_name.trim()) {
      setErrorMsg("Please enter the primary site name.");
      return false;
    }
    if (!formData.site_code.trim()) {
      setErrorMsg("Please enter a short code for this site.");
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    if (!formData.admin_name.trim()) {
      setErrorMsg("Please enter the administrator's full name.");
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.admin_email.trim())) {
      setErrorMsg("Please enter a valid administrator email address.");
      return false;
    }
    if (!isPasswordValid) {
      setErrorMsg("Password does not meet the security criteria.");
      return false;
    }
    if (!doPasswordsMatch) {
      setErrorMsg("Passwords do not match.");
      return false;
    }
    return true;
  };

  const handleNext = () => {
    setErrorMsg("");
    if (currentStep === 1 && validateStep1()) {
      setCurrentStep(2);
    } else if (currentStep === 2 && validateStep2()) {
      setCurrentStep(3);
    }
  };

  const handleBack = () => {
    setErrorMsg("");
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleInitialize = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    setLoading(true);

    try {
      const payload = {
        organization_name: formData.organization_name.trim(),
        site_name: formData.site_name.trim(),
        site_code: formData.site_code.trim().toUpperCase(),
        admin_name: formData.admin_name.trim(),
        admin_email: formData.admin_email.trim().toLowerCase(),
        admin_password: formData.admin_password,
        license_key: formData.license_key.trim()
      };

      const res = await apiClient.post("/setup/initialize", payload);

      setSuccessInfo(res.data);
      setCurrentStep(4);
      if (onSetupComplete) {
        onSetupComplete();
      }
    } catch (err) {
      const resp = err.response?.data;
      if (resp?.error === "SETUP_ALREADY_COMPLETED") {
        setErrorMsg("System setup has already been completed. Redirecting...");
        setTimeout(() => navigate("/", { replace: true }), 2500);
      } else if (resp?.details && Array.isArray(resp.details)) {
        setErrorMsg(resp.details.join(" "));
      } else {
        setErrorMsg(resp?.message || "Failed to initialize system. Please check your inputs.");
      }
    } finally {
      setLoading(false);
    }
  };

  if (verifyingStatus) {
    return (
      <div className="setup-wizard-container">
        <div style={{ textAlign: "center" }}>
          <Loader2 size={36} className="animate-spin" style={{ color: "#3b82f6", margin: "0 auto 16px auto" }} />
          <h2 style={{ fontSize: 20, color: "#f8fafc" }}>Verifying System Setup State...</h2>
          <p style={{ color: "#94a3b8" }}>Connecting to persistent database</p>
        </div>
      </div>
    );
  }

  if (!isSetupAllowed) {
    return null;
  }

  return (
    <div className="setup-wizard-container">
      <div className="setup-wizard-card">
        {/* Header */}
        <div className="setup-header">
          <div className="setup-badge">
            <ShieldCheck size={16} /> First-Run System Configuration
          </div>
          <h1>Visitor Management System</h1>
          <p>Complete the initial setup to configure your organization and master administrator account.</p>
        </div>

        {/* Stepper */}
        {currentStep < 4 && (
          <div className="setup-stepper">
            <div className={`setup-step ${currentStep === 1 ? "active" : currentStep > 1 ? "completed" : ""}`}>
              <div className="setup-step-number">{currentStep > 1 ? <Check size={16} /> : "1"}</div>
              <span className="setup-step-label">Organization</span>
            </div>
            <div className={`setup-step ${currentStep === 2 ? "active" : currentStep > 2 ? "completed" : ""}`}>
              <div className="setup-step-number">{currentStep > 2 ? <Check size={16} /> : "2"}</div>
              <span className="setup-step-label">Administrator</span>
            </div>
            <div className={`setup-step ${currentStep === 3 ? "active" : ""}`}>
              <div className="setup-step-number">3</div>
              <span className="setup-step-label">Review & Finish</span>
            </div>
          </div>
        )}

        {/* Error Box */}
        {errorMsg && (
          <div className="setup-error-box">
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Step 1: Organization & Primary Site */}
        {currentStep === 1 && (
          <div className="setup-form-section">
            <div className="setup-field">
              <label>Organization / Company Name</label>
              <div className="setup-input-wrapper">
                <Building2 size={18} className="setup-input-icon" />
                <input
                  type="text"
                  className="setup-input"
                  placeholder="e.g., Acme Corporation"
                  value={formData.organization_name}
                  onChange={(e) => handleChange("organization_name", e.target.value)}
                  autoFocus
                />
              </div>
              <p className="setup-input-help">The primary tenant name for your commercial license.</p>
            </div>

            <div className="setup-row">
              <div className="setup-field">
                <label>Primary Site Name</label>
                <div className="setup-input-wrapper">
                  <MapPin size={18} className="setup-input-icon" />
                  <input
                    type="text"
                    className="setup-input"
                    placeholder="e.g., Corporate Headquarters"
                    value={formData.site_name}
                    onChange={(e) => handleChange("site_name", e.target.value)}
                  />
                </div>
                <p className="setup-input-help">Initial physical facility for visitor check-in.</p>
              </div>

              <div className="setup-field">
                <label>Site Code</label>
                <input
                  type="text"
                  className="setup-input"
                  style={{ paddingLeft: 16 }}
                  placeholder="e.g., HQ"
                  maxLength={10}
                  value={formData.site_code}
                  onChange={(e) => handleChange("site_code", e.target.value)}
                />
                <p className="setup-input-help">Badge prefix code.</p>
              </div>
            </div>

            <div className="setup-actions" style={{ justifyContent: "flex-end" }}>
              <button type="button" className="btn-primary" onClick={handleNext}>
                Continue to Administrator <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Administrator Credentials */}
        {currentStep === 2 && (
          <div className="setup-form-section">
            <div className="setup-field">
              <label>Administrator Full Name</label>
              <div className="setup-input-wrapper">
                <User size={18} className="setup-input-icon" />
                <input
                  type="text"
                  className="setup-input"
                  placeholder="e.g., System Administrator"
                  value={formData.admin_name}
                  onChange={(e) => handleChange("admin_name", e.target.value)}
                  autoFocus
                />
              </div>
            </div>

            <div className="setup-field">
              <label>Administrator Email</label>
              <div className="setup-input-wrapper">
                <Mail size={18} className="setup-input-icon" />
                <input
                  type="email"
                  className="setup-input"
                  placeholder="admin@company.com"
                  value={formData.admin_email}
                  onChange={(e) => handleChange("admin_email", e.target.value)}
                />
              </div>
              <p className="setup-input-help">Used as the master login username.</p>
            </div>

            <div className="setup-field">
              <label>Master Password</label>
              <div className="setup-input-wrapper">
                <Lock size={18} className="setup-input-icon" />
                <input
                  type="password"
                  className="setup-input"
                  placeholder="Create a strong password"
                  value={formData.admin_password}
                  onChange={(e) => handleChange("admin_password", e.target.value)}
                />
              </div>
            </div>

            <div className="setup-field">
              <label>Confirm Password</label>
              <div className="setup-input-wrapper">
                <Lock size={18} className="setup-input-icon" />
                <input
                  type="password"
                  className="setup-input"
                  placeholder="Re-enter password"
                  value={formData.confirm_password}
                  onChange={(e) => handleChange("confirm_password", e.target.value)}
                />
              </div>
            </div>

            {/* Password Policy Tracker */}
            <div className="password-requirements">
              <div className={`pwd-rule ${isLenValid ? "valid" : ""}`}>
                {isLenValid ? <Check size={14} /> : "•"} Minimum 8 characters
              </div>
              <div className={`pwd-rule ${hasUpper ? "valid" : ""}`}>
                {hasUpper ? <Check size={14} /> : "•"} At least one uppercase letter (A-Z)
              </div>
              <div className={`pwd-rule ${hasNumber ? "valid" : ""}`}>
                {hasNumber ? <Check size={14} /> : "•"} At least one numeric number (0-9)
              </div>
              <div className={`pwd-rule ${hasSpecial ? "valid" : ""}`}>
                {hasSpecial ? <Check size={14} /> : "•"} At least one special symbol (@, #, $, etc.)
              </div>
            </div>

            <div className="setup-actions">
              <button type="button" className="btn-secondary" onClick={handleBack}>
                <ArrowLeft size={16} /> Back
              </button>
              <button type="button" className="btn-primary" onClick={handleNext}>
                Continue to Review <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Review & License */}
        {currentStep === 3 && (
          <form onSubmit={handleInitialize} className="setup-form-section">
            <div className="setup-summary-table">
              <div className="summary-row">
                <span className="summary-label">Organization:</span>
                <span className="summary-value">{formData.organization_name}</span>
              </div>
              <div className="summary-row">
                <span className="summary-label">Primary Site:</span>
                <span className="summary-value">
                  {formData.site_name} ({formData.site_code})
                </span>
              </div>
              <div className="summary-row">
                <span className="summary-label">Admin Name:</span>
                <span className="summary-value">{formData.admin_name}</span>
              </div>
              <div className="summary-row">
                <span className="summary-label">Admin Email:</span>
                <span className="summary-value">{formData.admin_email}</span>
              </div>
              <div className="summary-row">
                <span className="summary-label">Assigned Role:</span>
                <span className="summary-value" style={{ color: "#60a5fa" }}>
                  Super Admin (Master Privileges)
                </span>
              </div>
            </div>

            <div className="setup-field">
              <label>License Key Token (Optional)</label>
              <div className="setup-input-wrapper">
                <Key size={18} className="setup-input-icon" />
                <input
                  type="text"
                  className="setup-input"
                  placeholder="Paste RS256 token or leave blank for default license"
                  value={formData.license_key}
                  onChange={(e) => handleChange("license_key", e.target.value)}
                />
              </div>
              <p className="setup-input-help">If omitted, the system initializes in standard evaluation mode.</p>
            </div>

            <div className="setup-actions">
              <button type="button" className="btn-secondary" onClick={handleBack} disabled={loading}>
                <ArrowLeft size={16} /> Back
              </button>
              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> Provisioning System...
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={16} /> Complete Initialization
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* Step 4: Success Confirmation */}
        {currentStep === 4 && (
          <div className="setup-success-card">
            <div className="success-icon-wrapper">
              <CheckCircle2 size={44} />
            </div>
            <h2 style={{ fontSize: 24, fontWeight: 700, margin: "0 0 10px 0", color: "#f8fafc" }}>
              System Provisioning Complete!
            </h2>
            <p style={{ color: "#94a3b8", fontSize: 15, marginBottom: 24 }}>
              Your organization and master administrator account have been securely configured. Setup is now permanently locked against replay attacks.
            </p>

            <button
              type="button"
              className="btn-primary"
              style={{ margin: "0 auto" }}
              onClick={() => {
                navigate("/", { replace: true });
                window.location.reload();
              }}
            >
              Sign In to VMS <ArrowRight size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
