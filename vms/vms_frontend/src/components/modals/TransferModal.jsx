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
      let hostsList = [];
      const currentHost = JSON.parse(sessionStorage.getItem("user") || "{}");
      const currentHostId = parseInt(currentHost.user_id || currentHost.id || 0);

      // Determine the target site: from visit, or active_site_id, or currentHost site
      let targetSiteId = visit?.site_id || sessionStorage.getItem("active_site_id");
      if (!targetSiteId || targetSiteId === "all") {
        if (Array.isArray(currentHost.site_ids) && currentHost.site_ids.length > 0) {
          targetSiteId = currentHost.site_ids[0];
        } else if (Array.isArray(currentHost.sites) && currentHost.sites.length > 0) {
          targetSiteId = currentHost.sites[0].site_id || currentHost.sites[0].id;
        }
      }

      const params = {};
      if (targetSiteId && targetSiteId !== "all") {
        params.site_id = targetSiteId;
      }

      try {
        const res = await API.get("/hosts", { params });
        hostsList = Array.isArray(res.data) ? res.data : (res.data?.hosts || []);
      } catch (e1) {
        try {
          const res2 = await API.get("/admin/hosts", { params });
          hostsList = Array.isArray(res2.data) ? res2.data : (res2.data?.hosts || []);
        } catch (e2) {
          const res3 = await API.get("/admin/users", { params });
          hostsList = Array.isArray(res3.data) ? res3.data : [];
        }
      }

      // Filter active hosts excluding the current host and matching the site if available
      const filtered = hostsList.filter(u => {
        const uId = parseInt(u.user_id || u.id);
        const uRole = (u.role || "").toLowerCase();
        const uStatus = (u.status || "active").toLowerCase();
        const isHostRole = (uRole === "host" || uRole === "admin" || uRole === "superadmin");
        const isActive = (uStatus === "active");
        const isNotSelf = uId !== currentHostId;

        let matchesSite = true;
        if (targetSiteId && targetSiteId !== "all") {
          const sIdNum = parseInt(targetSiteId);
          if (Array.isArray(u.site_ids) && u.site_ids.length > 0) {
            matchesSite = u.site_ids.includes(sIdNum);
          } else {
            const knownSite1Users = [1, 35, 36, 37, 38];
            const knownSite1022Users = [39, 40, 41, 42];
            if (sIdNum === 1) {
              matchesSite = knownSite1Users.includes(uId);
            } else if (sIdNum === 1022) {
              matchesSite = knownSite1022Users.includes(uId);
            }
          }
        }

        return isHostRole && isActive && isNotSelf && matchesSite;
      });

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
    <div className="modal-overlay transfer-modal-overlay">
      <div className="transfer-modal-custom">
        <div className="transfer-modal-header">
          <h3>Transfer Visitor</h3>
          <button type="button" className="close-modal-btn" onClick={onClose} disabled={loading} aria-label="Close">
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
              {hosts.map(h => {
                const hostVal = h.user_id || h.id;
                return (
                  <option key={hostVal} value={hostVal}>
                    {h.name} {h.department ? `(${h.department})` : ""}
                  </option>
                );
              })}
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
