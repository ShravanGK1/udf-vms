import React, { useState, useEffect } from "react";
import { X, Key, Check, AlertTriangle, RefreshCw, Layers } from "lucide-react";
import apiClient from "../../../app/apiClient";
import "./SuperAdminModals.css";

export default function LicenseModal({ onClose }) {
  const [licenses, setLicenses] = useState([]);
  const [primaryLicense, setPrimaryLicense] = useState(null);
  const [licenseDetails, setLicenseDetails] = useState(null);
  const [licenseKeyInput, setLicenseKeyInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [notifying, setNotifying] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Mock Feature Toggles
  const [features, setFeatures] = useState({
    face_recognition: true,
    sms_notifications: true,
    vip_blacklist: false,
    multi_site_sync: true
  });

  useEffect(() => {
    fetchLicenses();
  }, []);

  const fetchLicenses = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get("/admin/superadmin-stats");
      setLicenses(res.data.licenses || []);
      setLicenseDetails(res.data.licenseDetails || null);
      
      // The first license represents the current server
      if (res.data.licenses && res.data.licenses.length > 0) {
        setPrimaryLicense(res.data.licenses[0]);
      }
      setLoading(false);
    } catch (err) {
      setError("Failed to load license manager data.");
      setLoading(false);
    }
  };

  const handleRequestExtension = async () => {
    try {
      setUpdating(true);
      setError("");
      setSuccess("");
      const res = await apiClient.post("/admin/request-extension");
      setSuccess(res.data.message);
      await fetchLicenses(); // Reload state to disable button instantly
      setUpdating(false);
    } catch (err) {
      const errMsg = err.response?.data?.error || "Failed to submit extension request.";
      setError(errMsg);
      setUpdating(false);
    }
  };

  const handleUpdateLicense = async (e) => {
    e.preventDefault();
    if (!licenseKeyInput.trim()) return;

    try {
      setUpdating(true);
      setError("");
      setSuccess("");

      const res = await apiClient.post("/admin/update-license", {
        license_key: licenseKeyInput.trim()
      });

      setSuccess("License verified and updated successfully!");
      setLicenseKeyInput("");
      await fetchLicenses(); // reload values
      setUpdating(false);
      setTimeout(() => setSuccess(""), 4000);
    } catch (err) {
      const errMsg = err.response?.data?.error || "Invalid license key verification signature.";
      setError(errMsg);
      setUpdating(false);
      setTimeout(() => setError(""), 4000);
    }
  };

  const handleNotifyTermination = async () => {
    if (!window.confirm("Are you sure you want to notify the provider that this client is not going to extend the contract? This will report the termination intent to the Provider.")) {
      return;
    }

    try {
      setNotifying(true);
      setError("");
      setSuccess("");

      await apiClient.post("/admin/notify-termination");
      
      setSuccess("Termination notice submitted successfully to the Provider.");
      await fetchLicenses(); // reload values
      setNotifying(false);
      setTimeout(() => setSuccess(""), 4000);
    } catch (err) {
      setError("Failed to submit termination notice.");
      setNotifying(false);
      setTimeout(() => setError(""), 4000);
    }
  };

  const getStatusClass = (status) => {
    switch (status) {
      case "Active": return "active";
      case "Expiring Soon": return "expiring";
      case "Expired": return "expired";
      default: return "";
    }
  };

  const handleToggleFeature = (feat) => {
    setFeatures({
      ...features,
      [feat]: !features[feat]
    });
    setSuccess("Feature toggled. Saving system state...");
    setTimeout(() => setSuccess(""), 1500);
  };

  return (
    <div className="sa-modal-overlay">
      <div className="sa-modal-container" style={{ maxWidth: "850px" }}>
        <div className="sa-modal-header">
          <h3 className="sa-modal-title">
            <Key size={22} />
            License & Subscription Manager
          </h3>
          <button className="sa-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="sa-modal-content">
          {error && <div className="sa-alert sa-alert-error"><AlertTriangle size={16} /> {error}</div>}
          {success && <div className="sa-alert sa-alert-success"><Check size={16} /> {success}</div>}

          {/* Top Section: Active Server License Info */}
          {licenseDetails && (
            <div style={{ background: "linear-gradient(135deg, #eff6ff 0%, #dbfeea 100%)", border: "1px solid rgba(16, 185, 129, 0.2)", borderRadius: "1rem", padding: "1.25rem", marginBottom: "1.5rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#627d98", textTransform: "uppercase" }}>Primary Node Subscription</span>
                  <h4 style={{ margin: "0.25rem 0", color: "#102a43", fontWeight: 800 }}>{licenseDetails.data?.client_name || "Sumeet Group (Current Server)"}</h4>
                </div>
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                  {licenseDetails.will_terminate && (
                    <span className="superadmin-status expired" style={{ padding: "0.4rem 0.8rem", fontSize: "0.75rem" }}>
                      Will Terminate
                    </span>
                  )}
                  {licenseDetails.is_in_buffer && (
                    <span className="superadmin-status expiring" style={{ padding: "0.4rem 0.8rem", fontSize: "0.75rem" }}>
                      Grace Period
                    </span>
                  )}
                  <span className={`superadmin-status ${getStatusClass(licenseDetails.is_in_buffer ? "Expiring Soon" : "Active")}`} style={{ padding: "0.4rem 1rem", fontSize: "0.85rem" }}>
                    <span className="superadmin-status-dot" /> {licenseDetails.is_in_buffer ? "In Buffer" : "Active"}
                  </span>
                </div>
              </div>

              {licenseDetails.is_in_buffer && (
                <div className="sa-alert sa-alert-error" style={{ margin: "1rem 0 0.5rem 0", padding: "0.75rem 1rem" }}>
                  <AlertTriangle size={16} />
                  <span>
                    {licenseDetails.is_test_license
                      ? `VMS is currently running in its 30-minute grace buffer period. (${licenseDetails.minutes_remaining_in_buffer} minutes remaining).`
                      : licenseDetails.is_one_day_license
                      ? `VMS is currently running in its 2-hour grace buffer period. (${licenseDetails.hours_remaining_in_buffer} hours remaining).`
                      : `VMS is currently running in its ${licenseDetails.buffer_days}-day grace buffer period. (${licenseDetails.days_remaining_in_buffer} days remaining).`
                    }
                  </span>
                </div>
              )}

              <div className="sa-grid-2" style={{ gridTemplateColumns: "repeat(3, 1fr)", marginTop: "1rem", borderTop: "1px solid rgba(0,0,0,0.05)", paddingTop: "0.75rem", gap: "1rem" }}>
                <div>
                  <span style={{ fontSize: "0.7rem", color: "#627d98" }}>Start Date (Activation)</span>
                  <div style={{ fontSize: "0.95rem", fontWeight: 800, color: "#102a43" }}>{licenseDetails.start_date}</div>
                </div>
                <div>
                  <span style={{ fontSize: "0.7rem", color: "#627d98" }}>End Date (Expiration)</span>
                  <div style={{ fontSize: "0.95rem", fontWeight: 800, color: "#102a43" }}>{licenseDetails.end_date}</div>
                </div>
                <div>
                  <span style={{ fontSize: "0.7rem", color: "#627d98" }}>Buffer Grace Period</span>
                  <div style={{ fontSize: "0.95rem", fontWeight: 800, color: "#102a43" }}>
                    {licenseDetails.is_test_license
                      ? `${licenseDetails.buffer_minutes} Minutes`
                      : licenseDetails.is_one_day_license
                      ? `${licenseDetails.buffer_hours} Hours`
                      : `${licenseDetails.buffer_days} Days`
                    }
                  </div>
                </div>
                <div>
                  <span style={{ fontSize: "0.7rem", color: "#627d98" }}>
                    {licenseDetails.is_test_license
                      ? "Standard Minutes Remaining"
                      : licenseDetails.is_one_day_license
                      ? "Standard Hours Remaining"
                      : "Standard Days Remaining"
                    }
                  </span>
                  <div style={{ fontSize: "0.95rem", fontWeight: 800, color: "#102a43" }}>
                    {licenseDetails.is_test_license
                      ? `${licenseDetails.minutes_remaining} Minutes`
                      : licenseDetails.is_one_day_license
                      ? `${licenseDetails.hours_remaining} Hours`
                      : `${licenseDetails.days_remaining} Days`
                    }
                  </div>
                </div>
                <div>
                  <span style={{ fontSize: "0.7rem", color: "#627d98" }}>
                    {licenseDetails.is_test_license
                      ? "Buffer Minutes Remaining"
                      : licenseDetails.is_one_day_license
                      ? "Buffer Hours Remaining"
                      : "Buffer Days Remaining"
                    }
                  </span>
                  <div style={{ fontSize: "0.95rem", fontWeight: 800, color: "#102a43" }}>
                    {licenseDetails.is_test_license
                      ? `${licenseDetails.is_in_buffer ? licenseDetails.minutes_remaining_in_buffer : licenseDetails.buffer_minutes} Minutes`
                      : licenseDetails.is_one_day_license
                      ? `${licenseDetails.is_in_buffer ? licenseDetails.hours_remaining_in_buffer : licenseDetails.buffer_hours} Hours`
                      : `${licenseDetails.is_in_buffer ? licenseDetails.days_remaining_in_buffer : licenseDetails.buffer_days} Days`
                    }
                  </div>
                </div>
                
                {/* Conditionally visible notification button during buffer period */}
                <div style={{ display: "flex", alignItems: "flex-end" }}>
                  {licenseDetails.is_in_buffer && (
                    <button 
                      type="button" 
                      className="sa-btn sa-btn-danger" 
                      style={{ padding: "0.4rem 0.8rem", fontSize: "0.75rem", width: "100%", justifyContent: "center" }}
                      onClick={handleNotifyTermination}
                      disabled={licenseDetails.will_terminate || notifying}
                    >
                      {licenseDetails.will_terminate ? "Notice Sent" : "End Contract"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Request Extension Form */}
          <div style={{ background: "rgba(0,0,0,0.02)", border: "1px dashed rgba(0,0,0,0.08)", borderRadius: "1rem", padding: "1.25rem", marginBottom: "1.5rem" }}>
            <h4 style={{ margin: "0 0 0.75rem 0", fontWeight: 700, fontSize: "0.95rem" }}>Extend Contract</h4>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <button 
                type="button" 
                className="sa-btn sa-btn-primary" 
                style={{ 
                  width: "100%", 
                  justifyContent: "center", 
                  background: licenseDetails?.extension_requested ? "#64748b" : (!licenseDetails?.extension_eligible ? "#94a3b8" : "#10b981"),
                  cursor: (updating || !licenseDetails?.extension_eligible || licenseDetails?.extension_requested) ? "not-allowed" : "pointer"
                }}
                onClick={handleRequestExtension}
                disabled={updating || !licenseDetails?.extension_eligible || licenseDetails?.extension_requested}
              >
                {licenseDetails?.extension_requested ? "License Extension Requested" : "Request License Extension"}
              </button>

              {/* Dynamic status/helper message */}
              <div style={{ fontSize: "0.8rem", color: "#64748b", marginTop: "0.25rem", fontStyle: "italic", textAlign: "center" }}>
                {licenseDetails?.extension_requested && (
                  <span style={{ color: "#2563eb", fontWeight: 600 }}>
                    ✓ Extension request has been submitted and is pending provider approval.
                  </span>
                )}
                {!licenseDetails?.extension_requested && !licenseDetails?.extension_eligible && (
                  <span>
                    ℹ Request extension is restricted. {licenseDetails?.extension_threshold_days > 0 
                      ? `Available starting ${licenseDetails?.extension_threshold_days} days before expiry (standard term: ${licenseDetails?.total_term_days} days).` 
                      : "Available starting only during the buffer grace period."
                    }
                  </span>
                )}
                {!licenseDetails?.extension_requested && licenseDetails?.extension_eligible && (
                  <span style={{ color: "#16a34a", fontWeight: 600 }}>
                    ● Eligible to request extension now!
                  </span>
                )}
              </div>
              
              <div style={{ borderTop: "1px solid rgba(0, 0, 0, 0.05)", paddingTop: "0.75rem", marginTop: "0.25rem" }}>
                <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#64748b" }}>Have a new Activation Key?</span>
                <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.5rem" }}>
                  <input className="sa-input" style={{ flex: 1, fontFamily: "monospace", fontSize: "0.8rem" }} type="text" placeholder="Paste new signed license JWT token to extend subscription..." value={licenseKeyInput} onChange={(e) => setLicenseKeyInput(e.target.value)} required />
                  <button type="button" className="sa-btn sa-btn-secondary" onClick={handleUpdateLicense} disabled={updating || !licenseKeyInput.trim()}>
                    Apply Key
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Feature Toggles */}
          <h4 style={{ margin: "0 0 1rem 0", fontWeight: 700, fontSize: "0.95rem" }}>Toggles for System Capabilities</h4>
          <div className="sa-features-grid">
            <div className="sa-feature-card">
              <div className="sa-feature-info">
                <h5>Face Recognition</h5>
                <p>Verify check-in visitors' faces via webcam comparison</p>
              </div>
              <button className={`sa-badge-toggle ${features.face_recognition ? "active" : ""}`} onClick={() => handleToggleFeature("face_recognition")}>
                <Layers size={18} style={{ color: features.face_recognition ? "#10b981" : "#829ab1" }} />
              </button>
            </div>
            <div className="sa-feature-card">
              <div className="sa-feature-info">
                <h5>SMS / Email Notifications</h5>
                <p>Notify hosts automatically when visitors check in</p>
              </div>
              <button className={`sa-badge-toggle ${features.sms_notifications ? "active" : ""}`} onClick={() => handleToggleFeature("sms_notifications")}>
                <Layers size={18} style={{ color: features.sms_notifications ? "#10b981" : "#829ab1" }} />
              </button>
            </div>
            <div className="sa-feature-card">
              <div className="sa-feature-info">
                <h5>VIP Watchlist Integration</h5>
                <p>Alert security of blacklisted profiles dynamically</p>
              </div>
              <button className={`sa-badge-toggle ${features.vip_blacklist ? "active" : ""}`} onClick={() => handleToggleFeature("vip_blacklist")}>
                <Layers size={18} style={{ color: features.vip_blacklist ? "#10b981" : "#829ab1" }} />
              </button>
            </div>
            <div className="sa-feature-card">
              <div className="sa-feature-info">
                <h5>Multi-Site Synchronization</h5>
                <p>Sync visitor lists globally across office clusters</p>
              </div>
              <button className={`sa-badge-toggle ${features.multi_site_sync ? "active" : ""}`} onClick={() => handleToggleFeature("multi_site_sync")}>
                <Layers size={18} style={{ color: features.multi_site_sync ? "#10b981" : "#829ab1" }} />
              </button>
            </div>
          </div>

          {/* Tenants Subscription Status list */}
          <h4 style={{ margin: "0 0 1rem 0", fontWeight: 700, fontSize: "0.95rem" }}>Client Node Subscriptions</h4>
          <div className="sa-table-container">
            <table className="sa-table">
              <thead>
                <tr>
                  <th>Client Company</th>
                  <th>Registered Sites</th>
                  <th>Total Active Users</th>
                  <th>Expiry Date</th>
                  <th>Subscription status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="5" style={{ textAlign: "center", padding: "2rem", color: "#627d98" }}>
                      Loading clients data...
                    </td>
                  </tr>
                ) : (
                  licenses.map((lic, idx) => (
                    <tr key={idx}>
                      <td style={{ fontWeight: 700, color: "#102a43" }}>{lic.company}</td>
                      <td>{lic.sites}</td>
                      <td>{lic.users}</td>
                      <td>{lic.expiry}</td>
                      <td>
                        <span className={`superadmin-status ${getStatusClass(lic.status)}`}>
                          <span className="superadmin-status-dot" /> {lic.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="sa-modal-footer">
          <button className="sa-btn sa-btn-primary" onClick={onClose}>
            <Check size={16} /> Close Console
          </button>
        </div>
      </div>
    </div>
  );
}
