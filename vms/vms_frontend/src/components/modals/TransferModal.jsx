import React, { useState, useEffect } from 'react';
import { X, Send } from "lucide-react";
import API from "../../app/apiClient";
import "./TransferModal.css";

const TransferModal = ({ isOpen, onClose, visit, onSuccess }) => {
  const [hosts, setHosts] = useState([]);
  const [selectedHostId, setSelectedHostId] = useState("");
  const [purpose, setPurpose] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen) {
      fetchHosts();
      setSelectedHostId("");
      setPurpose("");
      setError("");
    }
  }, [isOpen]);

  const fetchHosts = async () => {
    try {
      const res = await API.get("/admin/users");
      const currentHost = JSON.parse(sessionStorage.getItem("user") || "{}");
      // Filter hosts: only users with role === 'host' who are Active and not the current host
      const filtered = res.data.filter(u => 
        u.role === "host" && 
        u.status === "Active" && 
        parseInt(u.id) !== parseInt(currentHost.user_id)
      );
      setHosts(filtered);
    } catch (err) {
      console.error("Error fetching hosts:", err);
      setError("Failed to load hosts list.");
    }
  };

  if (!isOpen || !visit) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedHostId) {
      setError("Please select a host.");
      return;
    }
    if (!purpose.trim()) {
      setError("Please enter a reason/purpose for the transfer.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await API.post(`/visitor-requests/${visit.request_id}/transfer`, {
        to_host_id: parseInt(selectedHostId),
        purpose: purpose.trim()
      });
      alert("Transfer request submitted successfully!");
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      console.error("Transfer error:", err);
      const errMsg = err.response?.data?.error || "Failed to submit transfer request.";
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content-wrapper transfer-modal-custom">
        <div className="transfer-modal-header">
          <h3>Transfer Visitor</h3>
          <button className="close-modal-btn" onClick={onClose} disabled={loading} style={{ position: 'relative', top: 'auto', right: 'auto', width: '2rem', height: '2rem' }}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="transfer-modal-body">
          {error && <div className="error-banner">{error}</div>}
          
          <div className="visitor-summary-card">
            <div className="summary-label">Visitor to Transfer:</div>
            <div className="summary-value">{visit.visitor_name || visit.name}</div>
            <div className="summary-subtext">{visit.company_name || visit.company}</div>
          </div>

          <div className="form-group-transfer">
            <label htmlFor="target-host">Select Destination Host *</label>
            <select
              id="target-host"
              value={selectedHostId}
              onChange={(e) => {
                setSelectedHostId(e.target.value);
                setError("");
              }}
              required
            >
              <option value="">-- Select Host --</option>
              {hosts.map(h => (
                <option key={h.id} value={h.id}>
                  {h.name} {h.department ? `(${h.department})` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group-transfer">
            <label htmlFor="transfer-purpose">Reason of Transfer *</label>
            <textarea
              id="transfer-purpose"
              placeholder="Provide a reason for transferring the visitor to this host..."
              value={purpose}
              onChange={(e) => {
                setPurpose(e.target.value);
                setError("");
              }}
              required
              rows={4}
            />
          </div>

          <div className="transfer-modal-footer">
            <button type="button" className="btn-cancel" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn-submit-transfer" disabled={loading}>
              <Send size={16} /> {loading ? "Transferring..." : "Send Request"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TransferModal;
