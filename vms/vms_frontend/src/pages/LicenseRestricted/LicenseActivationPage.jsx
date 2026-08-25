import React, { useState } from "react";
import { Key, ShieldAlert, Check, RefreshCw } from "lucide-react";
import apiClient from "../../app/apiClient";
import companyLogo from "../../assets/logo.png";
import "./LicenseActivationPage.css";

export default function LicenseActivationPage({ errorType, errorMessage, onActivated }) {
  const [keyInput, setKeyInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showResumeForm, setShowResumeForm] = useState(false);

  const handleActivate = async (e) => {
    e.preventDefault();
    if (!keyInput.trim()) return;

    try {
      setSubmitting(true);
      setError("");
      setSuccess("");

      const res = await apiClient.post("/activate-license", {
        license_key: keyInput.trim()
      });

      setSuccess("License activated successfully! Initializing system...");
      setSubmitting(false);
      
      // Delay to let user see success animation
      setTimeout(() => {
        onActivated();
      }, 2000);
    } catch (err) {
      const msg = err.response?.data?.error || "Key validation failed. Invalid signature or format.";
      setError(msg);
      setSubmitting(false);
    }
  };

  const getErrorHeader = () => {
    switch (errorType) {
      case "MISSING":
        return "Software Activation Required";
      case "EXPIRED":
        return "Subscription Has Expired";
      case "CLOCK_TAMPERED":
        return "Licensing Integrity Conflict";
      case "HW_MISMATCH":
        return "Hardware Signature Conflict";
      case "TERMINATED":
        return "Subscription Permanently Terminated";
      default:
        return "License Restriction Active";
    }
  };

  return (
    <div className="lap-container">
      <div className="lap-card">
        <div className="lap-logo" style={{ background: "transparent", border: "none" }}>
          <img src={companyLogo} alt="UDF Logo" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
        </div>
        <h1 className="lap-title">Visitor Management System</h1>
        
        <div className="lap-alert-box">
          <div className="lap-alert-header">
            <ShieldAlert size={18} />
            <span>{getErrorHeader()}</span>
          </div>
          <p className="lap-alert-desc">
            {errorMessage || "Please enter a valid subscription license key to access the application features."}
          </p>
        </div>

        {error && <div className="lap-message error">{error}</div>}
        {success && <div className="lap-message success">{success}</div>}

        {errorType === "TERMINATED" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginTop: "1rem" }}>
            <div className="lap-terminated-box" style={{ background: "rgba(239, 68, 68, 0.05)", border: "1px solid rgba(239, 68, 68, 0.2)", borderRadius: "0.75rem", padding: "1.5rem", textAlign: "center" }}>
              <h3 style={{ color: "#ef4444", fontWeight: 800, margin: "0 0 0.5rem 0", fontSize: "1.05rem" }}>ACCESS SUSPENDED</h3>
              <p style={{ color: "#475569", fontSize: "0.85rem", lineHeight: 1.5, margin: "0 0 1.25rem 0" }}>
                This system node instance licensing credentials have been revoked by the authority. 
                The software features have been locked. Please contact the licensing provider support desk to re-activate service.
              </p>
              <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#64748b", borderTop: "1px dashed rgba(0, 0, 0, 0.08)", paddingTop: "0.75rem" }}>
                SUPPORT CONTACT: support@sumeetgroup.com
              </div>
            </div>
            
            {!showResumeForm ? (
              <button 
                type="button" 
                className="lap-btn" 
                style={{ background: "#2563eb", border: "none" }}
                onClick={() => setShowResumeForm(true)}
              >
                Resume Services
              </button>
            ) : (
              <form onSubmit={handleActivate} className="lap-form">
                <div className="lap-form-group">
                  <label className="lap-label">Paste New Subscription License Key</label>
                  <textarea
                    className="lap-textarea"
                    placeholder="Paste base64 JWT license token here to resume..."
                    value={keyInput}
                    onChange={(e) => setKeyInput(e.target.value)}
                    required
                    disabled={submitting}
                  />
                </div>

                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button type="submit" className="lap-btn" style={{ flex: 1 }} disabled={submitting}>
                    {submitting ? (
                      <>
                        <RefreshCw className="animate-spin" size={16} />
                        Resuming Services...
                      </>
                    ) : (
                      <>
                        <Key size={16} />
                        Submit & Resume
                      </>
                    )}
                  </button>
                  <button 
                    type="button" 
                    className="lap-btn" 
                    style={{ background: "#64748b", width: "auto", border: "none" }} 
                    onClick={() => {
                      setShowResumeForm(false);
                      setError("");
                    }}
                    disabled={submitting}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        ) : (
          <form onSubmit={handleActivate} className="lap-form">
            <div className="lap-form-group">
              <label className="lap-label">Paste Subscription License Key</label>
              <textarea
                className="lap-textarea"
                placeholder="Paste base64 JWT license token here..."
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                required
                disabled={submitting}
              />
            </div>

            <button type="submit" className="lap-btn" disabled={submitting}>
              {submitting ? (
                <>
                  <RefreshCw className="animate-spin" size={16} />
                  Verifying Signature...
                </>
              ) : (
                <>
                  <Key size={16} />
                  Activate License Key
                </>
              )}
            </button>
          </form>
        )}

        <div className="lap-footer">
          VMS Licensing Authority • Secure Offline-Monotonic Verification Enabled
        </div>
      </div>
    </div>
  );
}
