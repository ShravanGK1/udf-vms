import React, { useState } from "react";
import { X, Eye, EyeOff, Shield, User, Building, MapPin, Key, AlertTriangle, CheckCircle, Mail, Briefcase, RefreshCw, Lock } from "lucide-react";
import apiClient from "../../../app/apiClient";
import "./SuperAdminModals.css";

// 1. VIEW USER DETAILS MODAL
export function ViewUserModal({ user, onClose }) {
  if (!user) return null;

  const sitesText = Array.isArray(user.sites) && user.sites.length > 0
    ? user.sites.map(s => s.name + (s.code ? ` (${s.code})` : "")).join(", ")
    : (user.site_ids === "ALL" ? "All Sites (Global Scope)" : (user.site_name || "Unassigned"));

  return (
    <div className="sa-modal-overlay" onClick={onClose}>
      <div className="sa-modal-container" style={{ maxWidth: "560px" }} onClick={e => e.stopPropagation()}>
        <div className="sa-modal-header">
          <h3 className="sa-modal-title">
            <User size={22} /> User Details
          </h3>
          <button className="sa-close-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="sa-modal-content">
          <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1.5rem" }}>
            <div style={{
              width: "56px",
              height: "56px",
              borderRadius: "50%",
              background: "linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)",
              color: "#2563eb",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "1.25rem",
              fontWeight: 700,
              border: "2px solid #bfdbfe"
            }}>
              {(user.name || "U").substring(0, 2).toUpperCase()}
            </div>
            <div>
              <h3 style={{ margin: "0 0 4px", fontSize: "1.2rem", fontWeight: 700, color: "#102a43" }}>{user.name}</h3>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span className={`superadmin-status ${user.status === "Active" ? "active" : "expired"}`} style={{ textTransform: "capitalize" }}>
                  <span className="superadmin-status-dot" /> {user.status || "Active"}
                </span>
                <span style={{ fontSize: "0.8rem", background: "rgba(37, 99, 235, 0.1)", color: "#2563eb", padding: "2px 8px", borderRadius: "4px", fontWeight: 600, textTransform: "uppercase" }}>
                  {user.role}
                </span>
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <div style={{ background: "#f8fafc", padding: "0.9rem", borderRadius: "0.75rem", border: "1px solid #e2e8f0" }}>
              <span style={{ fontSize: "0.75rem", color: "#64748b", textTransform: "uppercase", fontWeight: 600, display: "flex", alignItems: "center", gap: "4px" }}>
                <Mail size={13} /> Email Address
              </span>
              <div style={{ marginTop: "4px", fontWeight: 600, color: "#0f172a", fontSize: "0.9rem", wordBreak: "break-all" }}>
                {user.email || "N/A"}
              </div>
            </div>

            <div style={{ background: "#f8fafc", padding: "0.9rem", borderRadius: "0.75rem", border: "1px solid #e2e8f0" }}>
              <span style={{ fontSize: "0.75rem", color: "#64748b", textTransform: "uppercase", fontWeight: 600, display: "flex", alignItems: "center", gap: "4px" }}>
                <Briefcase size={13} /> Department
              </span>
              <div style={{ marginTop: "4px", fontWeight: 600, color: "#0f172a", fontSize: "0.9rem" }}>
                {user.department || "Not specified"}
              </div>
            </div>

            <div style={{ background: "#f8fafc", padding: "0.9rem", borderRadius: "0.75rem", border: "1px solid #e2e8f0", gridColumn: "1 / -1" }}>
              <span style={{ fontSize: "0.75rem", color: "#64748b", textTransform: "uppercase", fontWeight: 600, display: "flex", alignItems: "center", gap: "4px" }}>
                <MapPin size={13} /> Assigned Site(s)
              </span>
              <div style={{ marginTop: "4px", fontWeight: 600, color: "#2563eb", fontSize: "0.95rem" }}>
                📍 {sitesText}
              </div>
            </div>
          </div>
        </div>

        <div className="sa-modal-actions" style={{ justifyContent: "flex-end", padding: "1.25rem 2rem", borderTop: "1px solid rgba(0,0,0,0.06)" }}>
          <button type="button" className="superadmin-btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// 2. EDIT USER DETAILS MODAL
export function EditUserModal({ user, onClose, onUpdated }) {
  if (!user) return null;

  const [formData, setFormData] = useState({
    name: user.name || "",
    email: user.email || "",
    role: user.role || "host",
    department: user.department || "IT",
    status: user.status || "Active"
  });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!formData.name.trim() || !formData.email.trim()) {
      setError("Name and Email are required.");
      return;
    }

    setSubmitting(true);
    try {
      await apiClient.put(`/admin/users/${user.id || user.user_id}`, formData);
      onUpdated(`User details for ${formData.name} updated successfully.`);
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to update user details.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="sa-modal-overlay" onClick={onClose}>
      <div className="sa-modal-container" style={{ maxWidth: "540px" }} onClick={e => e.stopPropagation()}>
        <div className="sa-modal-header">
          <h3 className="sa-modal-title">
            <User size={22} /> Edit User Details
          </h3>
          <button className="sa-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="sa-modal-content">
            {error && <div className="sa-alert sa-alert-error"><AlertTriangle size={16} /> {error}</div>}

            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#334e68", marginBottom: "4px" }}>
                  Full Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  style={{ width: "100%", padding: "0.65rem 0.85rem", borderRadius: "0.5rem", border: "1px solid #cbd5e1" }}
                  required
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#334e68", marginBottom: "4px" }}>
                  Email Address *
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  style={{ width: "100%", padding: "0.65rem 0.85rem", borderRadius: "0.5rem", border: "1px solid #cbd5e1" }}
                  required
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#334e68", marginBottom: "4px" }}>
                    Role *
                  </label>
                  <select
                    value={formData.role}
                    onChange={e => setFormData({ ...formData, role: e.target.value })}
                    style={{ width: "100%", padding: "0.65rem 0.85rem", borderRadius: "0.5rem", border: "1px solid #cbd5e1", background: "#fff" }}
                  >
                    <option value="host">Host</option>
                    <option value="security">Security</option>
                    <option value="admin">Site Admin</option>
                    <option value="superadmin">Super Admin</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#334e68", marginBottom: "4px" }}>
                    Department *
                  </label>
                  <select
                    value={formData.department}
                    onChange={e => setFormData({ ...formData, department: e.target.value })}
                    style={{ width: "100%", padding: "0.65rem 0.85rem", borderRadius: "0.5rem", border: "1px solid #cbd5e1", background: "#fff" }}
                  >
                    {["IT", "HR", "Accounts", "Operations", "Sales & Marketing", "Legal", "Store"].map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#334e68", marginBottom: "4px" }}>
                  Status *
                </label>
                <select
                  value={formData.status}
                  onChange={e => setFormData({ ...formData, status: e.target.value })}
                  style={{ width: "100%", padding: "0.65rem 0.85rem", borderRadius: "0.5rem", border: "1px solid #cbd5e1", background: "#fff" }}
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
            </div>
          </div>

          <div className="sa-modal-actions" style={{ justifyContent: "flex-end", gap: "10px", padding: "1.25rem 2rem", borderTop: "1px solid rgba(0,0,0,0.06)" }}>
            <button type="button" className="superadmin-btn-secondary" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="superadmin-btn-primary" disabled={submitting}>
              {submitting ? "Saving Changes..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// 3. TRANSFER USER SITE MODAL
export function TransferSiteModal({ user, sites, onClose, onUpdated }) {
  if (!user) return null;

  const currentSiteName = Array.isArray(user.sites) && user.sites.length > 0
    ? user.sites.map(s => s.name + (s.code ? ` (${s.code})` : "")).join(", ")
    : (user.site_name || "Unassigned");

  const [selectedSiteId, setSelectedSiteId] = useState(
    Array.isArray(user.sites) && user.sites.length > 0 ? (user.sites[0].site_id || user.sites[0].id) : ""
  );
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedSiteId) {
      setError("Please select a target site.");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      await apiClient.patch(`/admin/users/${user.id || user.user_id}/site`, {
        site_id: selectedSiteId
      });
      onUpdated(`Site assignment updated successfully for ${user.name}.`);
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to transfer site.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="sa-modal-overlay" onClick={onClose}>
      <div className="sa-modal-container" style={{ maxWidth: "520px" }} onClick={e => e.stopPropagation()}>
        <div className="sa-modal-header">
          <h3 className="sa-modal-title">
            <MapPin size={22} /> Change Assigned Site
          </h3>
          <button className="sa-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="sa-modal-content">
            {error && <div className="sa-alert sa-alert-error"><AlertTriangle size={16} /> {error}</div>}

            <div style={{ background: "#f8fafc", padding: "1rem", borderRadius: "0.75rem", border: "1px solid #e2e8f0", marginBottom: "1.25rem" }}>
              <div style={{ fontSize: "0.75rem", color: "#64748b", textTransform: "uppercase", fontWeight: 600 }}>Selected User</div>
              <div style={{ fontSize: "1.05rem", fontWeight: 700, color: "#102a43", marginTop: "2px" }}>{user.name}</div>
              <div style={{ fontSize: "0.85rem", color: "#64748b" }}>{user.email}</div>
              <div style={{ marginTop: "10px", fontSize: "0.85rem" }}>
                <span style={{ color: "#64748b" }}>Current Site: </span>
                <strong style={{ color: "#2563eb" }}>📍 {currentSiteName}</strong>
              </div>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#334e68", marginBottom: "6px" }}>
                Select New Target Site *
              </label>
              <select
                value={selectedSiteId}
                onChange={e => { setSelectedSiteId(e.target.value); setError(""); }}
                style={{ width: "100%", padding: "0.75rem 0.85rem", borderRadius: "0.5rem", border: "1px solid #cbd5e1", background: "#fff", fontSize: "0.95rem" }}
                required
              >
                <option value="">Select Target Site</option>
                {sites.map(s => (
                  <option key={s.site_id || s.id} value={s.site_id || s.id}>
                    📍 {s.name} {s.code ? `(${s.code})` : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="sa-modal-actions" style={{ justifyContent: "flex-end", gap: "10px", padding: "1.25rem 2rem", borderTop: "1px solid rgba(0,0,0,0.06)" }}>
            <button type="button" className="superadmin-btn-secondary" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="superadmin-btn-primary" disabled={submitting || !selectedSiteId}>
              {submitting ? "Transferring Site..." : "Confirm Site Transfer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// 4. USER STATUS CONFIRMATION MODAL
export function StatusConfirmModal({ user, targetStatus, onClose, onUpdated }) {
  if (!user) return null;

  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleConfirm = async () => {
    setSubmitting(true);
    setError("");
    try {
      await apiClient.patch(`/admin/users/${user.id || user.user_id}/status`, {
        status: targetStatus
      });
      onUpdated(`User ${user.name} status updated to ${targetStatus}.`);
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to update user status.");
    } finally {
      setSubmitting(false);
    }
  };

  const isDeactivating = targetStatus === "Inactive";

  return (
    <div className="sa-modal-overlay" onClick={onClose}>
      <div className="sa-modal-container" style={{ maxWidth: "480px" }} onClick={e => e.stopPropagation()}>
        <div className="sa-modal-header">
          <h3 className="sa-modal-title">
            {isDeactivating ? <AlertTriangle size={22} color="#ea580c" /> : <CheckCircle size={22} color="#16a34a" />}
            {isDeactivating ? "Deactivate User Account" : "Activate User Account"}
          </h3>
          <button className="sa-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="sa-modal-content">
          {error && <div className="sa-alert sa-alert-error"><AlertTriangle size={16} /> {error}</div>}

          <p style={{ margin: "0 0 1rem", fontSize: "0.95rem", lineHeight: "1.5", color: "#102a43" }}>
            Are you sure you want to {isDeactivating ? "deactivate" : "activate"} user <strong>{user.name}</strong> ({user.email})?
          </p>
          {isDeactivating ? (
            <div style={{ fontSize: "0.85rem", color: "#b45309", background: "#fef3c7", padding: "10px 12px", borderRadius: "8px", border: "1px solid #fde68a" }}>
              ⚠️ Deactivating will immediately revoke login sessions and dashboard access. All audit logs and visit histories are preserved.
            </div>
          ) : (
            <div style={{ fontSize: "0.85rem", color: "#15803d", background: "#f0fdf4", padding: "10px 12px", borderRadius: "8px", border: "1px solid #bbf7d0" }}>
              ✓ Activating will restore login privileges and allow the user to access authorized sites.
            </div>
          )}
        </div>

        <div className="sa-modal-actions" style={{ justifyContent: "flex-end", gap: "10px", padding: "1.25rem 2rem", borderTop: "1px solid rgba(0,0,0,0.06)" }}>
          <button type="button" className="superadmin-btn-secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button
            type="button"
            className="superadmin-btn-primary"
            style={{
              background: isDeactivating ? "#dc2626" : "#16a34a",
              borderColor: isDeactivating ? "#dc2626" : "#16a34a"
            }}
            onClick={handleConfirm}
            disabled={submitting}
          >
            {submitting ? "Updating..." : (isDeactivating ? "Deactivate Account" : "Activate Account")}
          </button>
        </div>
      </div>
    </div>
  );
}

// 5. SECURE RESET PASSWORD MODAL
export function ResetPasswordModal({ user, onClose, onUpdated }) {
  if (!user) return null;

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!newPassword) {
      setError("Please enter a new password.");
      return;
    }
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }
    if (!/[A-Z]/.test(newPassword) || !/[0-9]/.test(newPassword) || !/[^A-Za-z0-9]/.test(newPassword)) {
      setError("Password must contain at least one uppercase letter, one number, and one special character.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiClient.post(`/admin/users/${user.id || user.user_id}/reset-password`, {
        password: newPassword,
        confirm_password: confirmPassword
      });
      onUpdated(res.data?.message || `Password for ${user.name} reset successfully.`);
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.message || "Failed to reset password.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="sa-modal-overlay" onClick={onClose}>
      <div className="sa-modal-container" style={{ maxWidth: "520px" }} onClick={e => e.stopPropagation()}>
        <div className="sa-modal-header">
          <h3 className="sa-modal-title">
            <Key size={22} color="#7c3aed" /> Reset User Password
          </h3>
          <button className="sa-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="sa-modal-content">
            {error && <div className="sa-alert sa-alert-error"><AlertTriangle size={16} /> {error}</div>}

            <div style={{ background: "#f8fafc", padding: "12px 14px", borderRadius: "8px", border: "1px solid #e2e8f0", marginBottom: "1.25rem" }}>
              <div style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 600, textTransform: "uppercase" }}>Target User Account</div>
              <div style={{ fontSize: "1rem", fontWeight: 700, color: "#102a43", marginTop: "2px" }}>{user.name}</div>
              <div style={{ fontSize: "0.85rem", color: "#64748b" }}>{user.email} · {user.role}</div>
            </div>

            <div style={{ marginBottom: "1rem" }}>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#334e68", marginBottom: "4px" }}>
                New Password *
              </label>
              <div style={{ position: "relative" }}>
                <input
                  type={showPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={e => { setNewPassword(e.target.value); setError(""); }}
                  placeholder="Enter new strong password"
                  style={{ width: "100%", padding: "0.65rem 2.5rem 0.65rem 0.85rem", borderRadius: "0.5rem", border: "1px solid #cbd5e1" }}
                  required
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#64748b" }}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div style={{ marginBottom: "1.25rem" }}>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#334e68", marginBottom: "4px" }}>
                Confirm New Password *
              </label>
              <div style={{ position: "relative" }}>
                <input
                  type={showConfirm ? "text" : "password"}
                  value={confirmPassword}
                  onChange={e => { setConfirmPassword(e.target.value); setError(""); }}
                  placeholder="Re-enter new password"
                  style={{ width: "100%", padding: "0.65rem 2.5rem 0.65rem 0.85rem", borderRadius: "0.5rem", border: "1px solid #cbd5e1" }}
                  required
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#64748b" }}
                  aria-label={showConfirm ? "Hide confirm password" : "Show confirm password"}
                >
                  {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Password Policy Requirements Box */}
            <div style={{
              fontSize: "0.8rem",
              lineHeight: "1.4",
              color: "#64748b",
              background: "rgba(99, 102, 241, 0.05)",
              padding: "10px 12px",
              borderRadius: "6px",
              border: "1px solid rgba(99, 102, 241, 0.15)"
            }}>
              <div style={{ fontWeight: 600, color: "#4f46e5", marginBottom: "4px" }}>Password Security Policy:</div>
              <ul style={{ margin: 0, paddingLeft: "1.2rem" }}>
                <li style={{ color: newPassword.length >= 8 ? "#16a34a" : "inherit" }}>
                  Minimum 8 characters
                </li>
                <li style={{ color: /[A-Z]/.test(newPassword) ? "#16a34a" : "inherit" }}>
                  At least one uppercase letter (A-Z)
                </li>
                <li style={{ color: /[0-9]/.test(newPassword) ? "#16a34a" : "inherit" }}>
                  At least one number (0-9)
                </li>
                <li style={{ color: /[^A-Za-z0-9]/.test(newPassword) ? "#16a34a" : "inherit" }}>
                  At least one special symbol (!@#$%^&* etc.)
                </li>
              </ul>
              {confirmPassword && (
                <div style={{ marginTop: "6px", fontWeight: 600, color: newPassword === confirmPassword ? "#16a34a" : "#dc2626" }}>
                  {newPassword === confirmPassword ? "✓ Passwords match" : "✕ Passwords do not match"}
                </div>
              )}
            </div>
          </div>

          <div className="sa-modal-actions" style={{ justifyContent: "flex-end", gap: "10px", padding: "1.25rem 2rem", borderTop: "1px solid rgba(0,0,0,0.06)" }}>
            <button type="button" className="superadmin-btn-secondary" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="superadmin-btn-primary" disabled={submitting}>
              {submitting ? "Resetting Password..." : "Confirm Password Reset"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// 6. VIEW LICENSE DETAILS MODAL
export function ViewLicenseModal({ license, licenseDetails, onClose, onOpenEdit }) {
  if (!license) return null;

  const data = licenseDetails?.data || {};

  return (
    <div className="sa-modal-overlay" onClick={onClose}>
      <div className="sa-modal-container" style={{ maxWidth: "680px" }} onClick={e => e.stopPropagation()}>
        <div className="sa-modal-header">
          <h3 className="sa-modal-title">
            <Key size={22} /> License & Subscription Details
          </h3>
          <button className="sa-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="sa-modal-content">
          <div style={{
            background: "linear-gradient(135deg, #eff6ff 0%, #dbfeea 100%)",
            border: "1px solid rgba(16, 185, 129, 0.2)",
            borderRadius: "1rem",
            padding: "1.25rem",
            marginBottom: "1.5rem"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
              <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "#102a43", textTransform: "uppercase" }}>
                Licensed Customer
              </span>
              <span className={`superadmin-status ${license.status === "Active" ? "active" : "expired"}`}>
                <span className="superadmin-status-dot" /> {license.status}
              </span>
            </div>
            <h2 style={{ margin: "0 0 0.5rem", fontSize: "1.5rem", fontWeight: 800, color: "#0f172a" }}>
              {license.company}
            </h2>
            <div style={{ display: "flex", gap: "1.5rem", fontSize: "0.85rem", color: "#475569" }}>
              <span>Registered Sites: <strong>{license.sites}</strong></span>
              <span>Total Active Users: <strong>{license.users}</strong></span>
              <span>Expiration Date: <strong>{license.expiry}</strong></span>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <div style={{ background: "#f8fafc", padding: "1rem", borderRadius: "0.75rem", border: "1px solid #e2e8f0" }}>
              <span style={{ fontSize: "0.75rem", color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>Signature Algorithm</span>
              <div style={{ fontSize: "0.95rem", fontWeight: 600, color: "#0f172a", marginTop: "4px" }}>
                RSA-256 (Tamper-Proof Asymmetric Key)
              </div>
            </div>

            <div style={{ background: "#f8fafc", padding: "1rem", borderRadius: "0.75rem", border: "1px solid #e2e8f0" }}>
              <span style={{ fontSize: "0.75rem", color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>Max Permitted Users</span>
              <div style={{ fontSize: "0.95rem", fontWeight: 600, color: "#0f172a", marginTop: "4px" }}>
                {data.max_users || 100} Concurrent Accounts
              </div>
            </div>

            <div style={{ background: "#f8fafc", padding: "1rem", borderRadius: "0.75rem", border: "1px solid #e2e8f0" }}>
              <span style={{ fontSize: "0.75rem", color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>Buffer Grace Period</span>
              <div style={{ fontSize: "0.95rem", fontWeight: 600, color: "#0f172a", marginTop: "4px" }}>
                {licenseDetails?.buffer_days || 90} Days Offline Protection
              </div>
            </div>

            <div style={{ background: "#f8fafc", padding: "1rem", borderRadius: "0.75rem", border: "1px solid #e2e8f0" }}>
              <span style={{ fontSize: "0.75rem", color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>Hardware Fingerprint</span>
              <div style={{ fontSize: "0.95rem", fontWeight: 600, color: "#0f172a", marginTop: "4px", wordBreak: "break-all" }}>
                {data.machine_uuid || "Enforced Container Binding"}
              </div>
            </div>
          </div>
        </div>

        <div className="sa-modal-actions" style={{ justifyContent: "space-between", padding: "1.25rem 2rem", borderTop: "1px solid rgba(0,0,0,0.06)" }}>
          <button type="button" className="superadmin-btn-secondary" onClick={onClose}>
            Close
          </button>
          <button
            type="button"
            className="superadmin-btn-primary"
            onClick={() => {
              onClose();
              if (onOpenEdit) onOpenEdit();
            }}
          >
            Manage Subscription Key
          </button>
        </div>
      </div>
    </div>
  );
}
