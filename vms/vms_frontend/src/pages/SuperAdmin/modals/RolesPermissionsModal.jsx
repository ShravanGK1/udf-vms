import React, { useState, useEffect } from "react";
import { X, Shield, Check, Save } from "lucide-react";
import apiClient from "../../../app/apiClient";
import "./SuperAdminModals.css";

const AVAILABLE_PERMISSIONS = [
  { id: "view_dashboard", label: "View Dashboard", desc: "Access the console dashboard" },
  { id: "manage_users", label: "Manage Users", desc: "Create, edit, and suspend user accounts" },
  { id: "approve_requests", label: "Approve Requests", desc: "Approve or decline visitor pre-registrations" },
  { id: "check_in_out", label: "Check-in/Check-out", desc: "Front desk visitor verification and check-in" },
  { id: "manage_licenses", label: "Manage Licenses", desc: "Change subscription key and client quotas" },
  { id: "system_settings", label: "System Settings", desc: "Configure global session and network variables" },
  { id: "data_purging", label: "Data Purging", desc: "Permanently delete historical visitor request records" }
];

export default function RolesPermissionsModal({ onClose }) {
  const [matrix, setMatrix] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    fetchPermissions();
  }, []);

  const fetchPermissions = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get("/admin/roles-permissions");
      setMatrix(res.data);
      setLoading(false);
    } catch (err) {
      setError("Failed to load access control matrix.");
      setLoading(false);
    }
  };

  const handleToggle = (role, permissionId) => {
    const rolePerms = matrix[role] || [];
    let updatedPerms;
    if (rolePerms.includes(permissionId)) {
      updatedPerms = rolePerms.filter(p => p !== permissionId);
    } else {
      updatedPerms = [...rolePerms, permissionId];
    }

    setMatrix({
      ...matrix,
      [role]: updatedPerms
    });
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError("");
      setSuccess("");
      await apiClient.post("/admin/roles-permissions", matrix);
      setSuccess("Permissions matrix updated successfully!");
      setSaving(false);
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError("Failed to save changes to server.");
      setSaving(false);
      setTimeout(() => setError(""), 3000);
    }
  };

  const roleLabels = {
    admin: "Tenant Admin",
    host: "Employee (Host)",
    security: "Security Guard"
  };

  return (
    <div className="sa-modal-overlay">
      <div className="sa-modal-container" style={{ maxWidth: "850px" }}>
        <div className="sa-modal-header">
          <h3 className="sa-modal-title">
            <Shield size={22} />
            Roles & Permissions Matrix
          </h3>
          <button className="sa-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="sa-modal-content">
          {error && <div className="sa-alert sa-alert-error">{error}</div>}
          {success && <div className="sa-alert sa-alert-success">{success}</div>}

          <p style={{ margin: "0 0 1.5rem 0", color: "#627d98", fontSize: "0.9rem" }}>
            Configure global access control mappings. These permissions govern which actions each user role can execute.
          </p>

          {loading ? (
            <div style={{ textAlign: "center", padding: "3rem", color: "#627d98" }}>
              Loading permissions matrix...
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {/* Table header style helper */}
              <div className="sa-permission-row" style={{ borderBottom: "2px solid rgba(0,0,0,0.1)", background: "rgba(240,244,248,0.5)", padding: "0.75rem 1rem", borderRadius: "0.5rem 0.5rem 0 0" }}>
                <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#627d98", textTransform: "uppercase" }}>System Role</span>
                <div className="sa-permission-grid" style={{ fontWeight: 700, fontSize: "0.75rem", color: "#627d98" }}>
                  <span>Permissions Matrix</span>
                </div>
              </div>

              {Object.keys(roleLabels).map((role) => (
                <div key={role} className="sa-permission-row" style={{ padding: "1.25rem 1rem" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                    <span className="sa-permission-role-name">{roleLabels[role]}</span>
                    <code style={{ fontSize: "0.7rem", color: "#627d98", background: "rgba(0,0,0,0.03)", padding: "0.1rem 0.35rem", width: "fit-content", borderRadius: "0.25rem" }}>
                      role: {role}
                    </code>
                  </div>
                  <div className="sa-permission-grid">
                    {AVAILABLE_PERMISSIONS.map((perm) => {
                      const isChecked = (matrix[role] || []).includes(perm.id);
                      // Superadmin inherits all permissions and cannot be downgraded to prevent lockout
                      const isDisabled = role === "superadmin";

                      return (
                        <label key={perm.id} className="sa-checkbox-label" title={perm.desc} style={{ opacity: isDisabled ? 0.65 : 1, cursor: isDisabled ? "not-allowed" : "pointer" }}>
                          <input type="checkbox" className="sa-checkbox" checked={isChecked} onChange={() => handleToggle(role, perm.id)} disabled={isDisabled} />
                          <span style={{ fontWeight: isChecked ? 600 : 400, color: isChecked ? "#2563eb" : "#334e68" }}>{perm.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="sa-modal-footer">
          <button className="sa-btn sa-btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="sa-btn sa-btn-primary" onClick={handleSave} disabled={saving || loading}>
            <Save size={16} /> {saving ? "Saving Matrix..." : "Save Matrix"}
          </button>
        </div>
      </div>
    </div>
  );
}
