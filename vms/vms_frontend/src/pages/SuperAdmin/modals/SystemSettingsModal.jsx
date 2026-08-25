import React, { useState, useEffect } from "react";
import { X, Settings, Server, Trash2, Check, RefreshCw, AlertTriangle } from "lucide-react";
import apiClient from "../../../app/apiClient";
import "./SuperAdminModals.css";

export default function SystemSettingsModal({ onClose }) {
  const [settings, setSettings] = useState({
    max_visitors: 500,
    session_timeout: 60,
    support_email: "support@sumeetgroup.com",
    enable_sms: true,
    enable_face_recognition: false,
    auto_purge_days: 90
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [purging, setPurging] = useState(false);
  const [purgeDays, setPurgeDays] = useState(30);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [hasChanges, setHasChanges] = useState(false);

  // Mock docker instances status
  const [dockerContainers] = useState([
    { name: "vms-frontend", status: "running", cpu: "1.2%", memory: "82 MB", uptime: "14 days" },
    { name: "vms-backend", status: "running", cpu: "2.8%", memory: "140 MB", uptime: "14 days" },
    { name: "mysql-database", status: "running", cpu: "0.5%", memory: "310 MB", uptime: "14 days" }
  ]);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get("/admin/system-settings");
      setSettings(res.data);
      setLoading(false);
    } catch (err) {
      setError("Failed to load global system configurations.");
      setLoading(false);
    }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      setError("");
      setSuccess("");
      const res = await apiClient.post("/admin/system-settings", settings);
      setSettings(res.data.settings);
      setSuccess("Global parameters updated successfully!");
      setHasChanges(true);
      setSaving(false);
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError("Failed to update global configurations.");
      setSaving(false);
      setTimeout(() => setError(""), 3000);
    }
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("logo", file);

    try {
      setError("");
      setSuccess("");
      const res = await apiClient.post("/admin/upload-logo", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      setSettings(prev => ({ ...prev, company_logo: res.data.company_logo }));
      setSuccess("Logo uploaded successfully!");
      setHasChanges(true);
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to upload logo.");
      setTimeout(() => setError(""), 3000);
    }
  };

  const handlePurgeLogs = async () => {
    if (!window.confirm(`Are you sure you want to permanently purge visitor requests older than ${purgeDays} days? This action is irreversible.`)) {
      return;
    }

    try {
      setPurging(true);
      setError("");
      setSuccess("");
      const res = await apiClient.post("/admin/purge-data", { days: parseInt(purgeDays) });
      setSuccess(res.data.message || `Purge successful. Deleted ${res.data.count} records.`);
      setPurging(false);
      setTimeout(() => setSuccess(""), 4000);
    } catch (err) {
      setError("An error occurred executing database purging utility.");
      setPurging(false);
      setTimeout(() => setError(""), 4000);
    }
  };

  const handleClose = () => {
    if (hasChanges) {
      window.location.reload();
    } else {
      onClose();
    }
  };

  return (
    <div className="sa-modal-overlay">
      <div className="sa-modal-container" style={{ maxWidth: "850px" }}>
        <div className="sa-modal-header">
          <h3 className="sa-modal-title">
            <Settings size={22} />
            System Configurations & Settings
          </h3>
          <button className="sa-close-btn" onClick={handleClose}>
            <X size={18} />
          </button>
        </div>

        <div className="sa-modal-content">
          {error && <div className="sa-alert sa-alert-error"><AlertTriangle size={16} /> {error}</div>}
          {success && <div className="sa-alert sa-alert-success"><Check size={16} /> {success}</div>}

          {/* Docker Status Monitors */}
          <h4 style={{ margin: "0 0 1rem 0", fontWeight: 700, fontSize: "0.95rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Server size={18} style={{ color: "#2563eb" }} /> Virtual Containers Status
          </h4>
          <div className="sa-docker-grid">
            {dockerContainers.map((container, idx) => (
              <div key={idx} className="sa-docker-card">
                <div className="sa-docker-header">
                  <span className="sa-docker-name">{container.name}</span>
                  <span className={`sa-docker-badge ${container.status}`}>{container.status}</span>
                </div>
                <div className="sa-docker-stat">CPU Usage: <span>{container.cpu}</span></div>
                <div className="sa-docker-stat">Memory: <span>{container.memory}</span></div>
                <div className="sa-docker-stat">Uptime: <span>{container.uptime}</span></div>
              </div>
            ))}
          </div>

          <hr style={{ border: "none", borderTop: "1px solid rgba(0,0,0,0.06)", margin: "1.5rem 0" }} />

          <div className="sa-grid-2">
            {/* Global Parameters form */}
            <div>
              <h4 style={{ margin: "0 0 1rem 0", fontWeight: 700, fontSize: "0.95rem" }}>Global Parameters</h4>
              {loading ? (
                <div style={{ color: "#627d98", fontSize: "0.85rem" }}>Loading configuration values...</div>
              ) : (
                <form onSubmit={handleSaveSettings}>
                  <div className="sa-form-group">
                    <label className="sa-form-label">Company Display Name</label>
                    <input className="sa-input" type="text" value={settings.company_name || ""} onChange={(e) => setSettings({ ...settings, company_name: e.target.value })} required />
                  </div>
                  <div className="sa-form-group">
                    <label className="sa-form-label">Company Logo Image</label>
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                      <input type="file" accept="image/*" onChange={handleLogoUpload} style={{ display: 'none' }} id="company-logo-upload" />
                      <label htmlFor="company-logo-upload" className="sa-btn sa-btn-secondary" style={{ cursor: 'pointer', margin: 0 }}>
                        Choose Image
                      </label>
                      {settings.company_logo && (
                        <img src={settings.company_logo} alt="Preview" style={{ height: '32px', maxHeight: '32px', borderRadius: '4px', border: '1px solid rgba(0,0,0,0.1)' }} />
                      )}
                    </div>
                  </div>
                  <div className="sa-form-group">
                    <label className="sa-form-label">Max Allowed Visitors Per Site</label>
                    <input className="sa-input" type="number" value={settings.max_visitors} onChange={(e) => setSettings({ ...settings, max_visitors: parseInt(e.target.value) || 0 })} required />
                  </div>
                  <div className="sa-form-group">
                    <label className="sa-form-label">Default Session Expiry (minutes)</label>
                    <input className="sa-input" type="number" value={settings.session_timeout} onChange={(e) => setSettings({ ...settings, session_timeout: parseInt(e.target.value) || 0 })} required />
                  </div>
                  <div className="sa-form-group">
                    <label className="sa-form-label">System Support Contact Email</label>
                    <input className="sa-input" type="email" value={settings.support_email} onChange={(e) => setSettings({ ...settings, support_email: e.target.value })} required />
                  </div>
                  <button type="submit" className="sa-btn sa-btn-primary" style={{ marginTop: "0.5rem" }} disabled={saving}>
                    <Check size={16} /> {saving ? "Saving..." : "Save Parameters"}
                  </button>
                </form>
              )}
            </div>

            {/* Log Purging utility */}
            <div>
              <h4 style={{ margin: "0 0 1rem 0", fontWeight: 700, fontSize: "0.95rem", display: "flex", alignItems: "center", gap: "0.5rem", color: "#dc2626" }}>
                <Trash2 size={16} /> Data Purging Utility
              </h4>
              <div style={{ background: "rgba(239, 68, 68, 0.03)", border: "1px solid rgba(239, 68, 68, 0.1)", borderRadius: "1rem", padding: "1.25rem" }}>
                <p style={{ margin: "0 0 1rem 0", fontSize: "0.82rem", color: "#627d98", lineHeight: 1.5 }}>
                  Perform manual purging of historical logs. This will permanently clear all visitor logs, device registries, and check-in history matching the date limit.
                </p>
                <div className="sa-form-group">
                  <label className="sa-form-label">Purge Logs Older Than</label>
                  <select className="sa-select" value={purgeDays} onChange={(e) => setPurgeDays(e.target.value)}>
                    <option value={30}>30 Days (Recommended)</option>
                    <option value={90}>90 Days</option>
                    <option value={180}>180 Days</option>
                    <option value={365}>365 Days</option>
                  </select>
                </div>
                <button type="button" className="sa-btn sa-btn-danger" style={{ width: "100%", justifyContent: "center" }} onClick={handlePurgeLogs} disabled={purging}>
                  <Trash2 size={16} /> {purging ? "Purging Records..." : "Execute Purging Utility"}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="sa-modal-footer">
          <button className="sa-btn sa-btn-primary" onClick={handleClose}>
            <Check size={16} /> Close Console
          </button>
        </div>
      </div>
    </div>
  );
}
