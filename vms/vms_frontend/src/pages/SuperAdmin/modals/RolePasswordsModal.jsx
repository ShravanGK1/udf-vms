import React, { useState, useEffect } from "react";
import { X, Key, Shield, Check, RefreshCw, AlertTriangle } from "lucide-react";
import apiClient from "../../../app/apiClient";
import "./SuperAdminModals.css";

export default function RolePasswordsModal({ onClose }) {
  const [defaults, setDefaults] = useState({
    default_password_admin: "Admin@123",
    default_password_host: "Host@123",
    default_password_security: "Security@123",
    default_password_superadmin: "Superadmin@123"
  });

  const [loading, setLoading] = useState(true);
  const [savingDefaults, setSavingDefaults] = useState(false);
  const [updatingUsers, setUpdatingUsers] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [userChange, setUserChange] = useState({
    role: "host",
    password: "",
    resetToDefault: false
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get("/admin/system-settings");
      setDefaults({
        default_password_admin: res.data.default_password_admin || "Admin@123",
        default_password_host: res.data.default_password_host || "Host@123",
        default_password_security: res.data.default_password_security || "Security@123",
        default_password_superadmin: res.data.default_password_superadmin || "Superadmin@123"
      });
      setLoading(false);
    } catch (err) {
      setError("Failed to load default dashboard passwords.");
      setLoading(false);
    }
  };

  const handleSaveDefaults = async (e) => {
    e.preventDefault();
    try {
      setSavingDefaults(true);
      setError("");
      setSuccess("");

      // Update default passwords for roles
      await apiClient.post("/admin/change-role-passwords", {
        role: "admin",
        default_password: defaults.default_password_admin
      });
      await apiClient.post("/admin/change-role-passwords", {
        role: "host",
        default_password: defaults.default_password_host
      });
      await apiClient.post("/admin/change-role-passwords", {
        role: "security",
        default_password: defaults.default_password_security
      });
      await apiClient.post("/admin/change-role-passwords", {
        role: "superadmin",
        default_password: defaults.default_password_superadmin
      });

      setSuccess("Default role passwords updated successfully!");
      setSavingDefaults(false);
      setTimeout(() => setSuccess(""), 4000);
    } catch (err) {
      setError("Failed to update default passwords.");
      setSavingDefaults(false);
    }
  };

  const handleUpdateUserPasswords = async (e) => {
    e.preventDefault();
    try {
      setUpdatingUsers(true);
      setError("");
      setSuccess("");

      let payload = { role: userChange.role };
      if (userChange.resetToDefault) {
        payload.default_password = defaults[`default_password_${userChange.role}`];
      } else {
        if (!userChange.password || userChange.password.length < 8) {
          setError("Password must be at least 8 characters long.");
          setUpdatingUsers(false);
          return;
        }
        payload.password = userChange.password;
      }

      const res = await apiClient.post("/admin/change-role-passwords", payload);
      setSuccess(res.data.message || `Successfully updated password for role ${userChange.role}.`);
      setUpdatingUsers(false);
      setUserChange(prev => ({ ...prev, password: "", resetToDefault: false }));
      setTimeout(() => setSuccess(""), 4000);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to update dashboard passwords.");
      setUpdatingUsers(false);
    }
  };

  return (
    <div className="sa-modal-overlay">
      <div className="sa-modal-container" style={{ maxWidth: "800px" }}>
        <div className="sa-modal-header">
          <h3 className="sa-modal-title">
            <Key size={22} />
            Role Passwords & Dashboard Access Manager
          </h3>
          <button className="sa-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="sa-modal-content">
          {error && <div className="sa-alert sa-alert-error"><AlertTriangle size={16} /> {error}</div>}
          {success && <div className="sa-alert sa-alert-success"><Check size={16} /> {success}</div>}

          {loading ? (
            <div style={{ color: "#627d98", fontSize: "0.85rem", padding: "2rem", textAlign: "center" }}>
              Loading configuration credentials...
            </div>
          ) : (
            <div className="sa-grid-2" style={{ gap: "2rem" }}>
              {/* Left Column: Set Default Passwords */}
              <div>
                <h4 style={{ margin: "0 0 1rem 0", fontWeight: 700, fontSize: "0.95rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <Shield size={18} style={{ color: "#2563eb" }} /> Default Dashboard Passwords
                </h4>
                <p style={{ margin: "0 0 1.25rem 0", fontSize: "0.8rem", color: "#627d98", lineHeight: 1.4 }}>
                  Configure the default password for new users or when resetting dashboard access.
                </p>

                <form onSubmit={handleSaveDefaults}>
                  <div className="sa-form-group">
                    <label className="sa-form-label">Default Admin Password</label>
                    <input
                      className="sa-input"
                      type="text"
                      value={defaults.default_password_admin}
                      onChange={(e) => setDefaults({ ...defaults, default_password_admin: e.target.value })}
                      required
                    />
                  </div>
                  <div className="sa-form-group">
                    <label className="sa-form-label">Default Host Password</label>
                    <input
                      className="sa-input"
                      type="text"
                      value={defaults.default_password_host}
                      onChange={(e) => setDefaults({ ...defaults, default_password_host: e.target.value })}
                      required
                    />
                  </div>
                  <div className="sa-form-group">
                    <label className="sa-form-label">Default Security Password</label>
                    <input
                      className="sa-input"
                      type="text"
                      value={defaults.default_password_security}
                      onChange={(e) => setDefaults({ ...defaults, default_password_security: e.target.value })}
                      required
                    />
                  </div>
                  <button type="submit" className="sa-btn sa-btn-primary" style={{ marginTop: "0.5rem", width: "100%", justifyContent: "center" }} disabled={savingDefaults}>
                    <Check size={16} /> {savingDefaults ? "Saving..." : "Save Default Passwords"}
                  </button>
                </form>
              </div>

              {/* Right Column: Update Passwords & Force Logout */}
              <div>
                <h4 style={{ margin: "0 0 1rem 0", fontWeight: 700, fontSize: "0.95rem", display: "flex", alignItems: "center", gap: "0.5rem", color: "#dc2626" }}>
                  <Key size={18} /> Update Current Dashboard Passwords
                </h4>
                <p style={{ margin: "0 0 1.25rem 0", fontSize: "0.8rem", color: "#627d98", lineHeight: 1.4 }}>
                  Changing a dashboard password will <strong>immediately log out</strong> all active users on that role's dashboard.
                </p>

                <form onSubmit={handleUpdateUserPasswords}>
                  <div className="sa-form-group">
                    <label className="sa-form-label">Select Dashboard Role</label>
                    <select
                      className="sa-select"
                      value={userChange.role}
                      onChange={(e) => setUserChange({ ...userChange, role: e.target.value })}
                    >
                      <option value="admin">Admin Dashboard</option>
                      <option value="host">Host Dashboard</option>
                      <option value="security">Security Dashboard</option>
                    </select>
                  </div>

                  <div className="sa-form-group">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <label className="sa-form-label">New Password</label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', cursor: 'pointer', margin: 0, fontWeight: 600, color: '#2563eb' }}>
                        <input
                          type="checkbox"
                          checked={userChange.resetToDefault}
                          onChange={(e) => setUserChange({ ...userChange, resetToDefault: e.target.checked })}
                        />
                        Reset to default password
                      </label>
                    </div>
                    <input
                      className="sa-input"
                      type="password"
                      placeholder={userChange.resetToDefault ? "Will reset to role default password..." : "Enter new dashboard password..."}
                      value={userChange.password}
                      onChange={(e) => setUserChange({ ...userChange, password: e.target.value })}
                      disabled={userChange.resetToDefault}
                      required={!userChange.resetToDefault}
                    />
                  </div>

                  <button
                    type="submit"
                    className="sa-btn sa-btn-danger"
                    style={{ marginTop: "1rem", width: "100%", justifyContent: "center" }}
                    disabled={updatingUsers}
                  >
                    <RefreshCw className={updatingUsers ? "animate-spin" : ""} size={16} />
                    {updatingUsers ? "Updating Passwords..." : "Apply & Force Logout"}
                  </button>
                </form>
              </div>
            </div>
          )}
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
