import React, { useState, useEffect } from "react";
import { X, Building, MapPin, Plus, Check, ChevronDown, ChevronRight, ToggleLeft, ToggleRight } from "lucide-react";
import apiClient from "../../../app/apiClient";
import "./SuperAdminModals.css";

export default function CompanySiteModal({ onClose }) {
  const [companies, setCompanies] = useState([]);
  const [expandedCompany, setExpandedCompany] = useState(null);
  const [selectedSite, setSelectedSite] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // New Company Form
  const [showAddCompany, setShowAddCompany] = useState(false);
  const [newCompany, setNewCompany] = useState({ name: "", code: "" });

  // New Site Form
  const [showAddSite, setShowAddSite] = useState(null); // stores company ID
  const [newSite, setNewSite] = useState({ name: "", address: "", lat: "", lng: "" });

  useEffect(() => {
    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get("/admin/companies-sites");
      setCompanies(res.data);
      if (res.data.length > 0) {
        setExpandedCompany(res.data[0].id);
        if (res.data[0].sites.length > 0) {
          setSelectedSite(res.data[0].sites[0]);
        }
      }
      setLoading(false);
    } catch (err) {
      setError("Failed to load companies and sites hierarchy.");
      setLoading(false);
    }
  };

  const handleSave = async (updatedData) => {
    try {
      const res = await apiClient.post("/admin/companies-sites", updatedData);
      setCompanies(res.data);
      setSuccess("Changes saved successfully!");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError("Failed to save changes to server.");
      setTimeout(() => setError(""), 3000);
    }
  };

  const handleAddCompany = async (e) => {
    e.preventDefault();
    if (!newCompany.name || !newCompany.code) return;

    const updated = [
      ...companies,
      {
        id: Date.now(),
        name: newCompany.name,
        code: newCompany.code.toUpperCase(),
        sites: []
      }
    ];

    await handleSave(updated);
    setNewCompany({ name: "", code: "" });
    setShowAddCompany(false);
  };

  const handleAddSite = async (e, companyId) => {
    e.preventDefault();
    if (!newSite.name || !newSite.address) return;

    const lat = parseFloat(newSite.lat) || 18.5204;
    const lng = parseFloat(newSite.lng) || 73.8567;

    const updated = companies.map((c) => {
      if (c.id === companyId) {
        return {
          ...c,
          sites: [
            ...c.sites,
            {
              id: Date.now(),
              name: newSite.name,
              address: newSite.address,
              lat,
              lng,
              status: "Active"
            }
          ]
        };
      }
      return c;
    });

    await handleSave(updated);
    // Auto select the newly added site
    const updatedCompany = updated.find(c => c.id === companyId);
    if (updatedCompany && updatedCompany.sites.length > 0) {
      setSelectedSite(updatedCompany.sites[updatedCompany.sites.length - 1]);
    }
    setNewSite({ name: "", address: "", lat: "", lng: "" });
    setShowAddSite(null);
  };

  const toggleSiteStatus = async (companyId, siteId) => {
    const updated = companies.map((c) => {
      if (c.id === companyId) {
        return {
          ...c,
          sites: c.sites.map((s) => {
            if (s.id === siteId) {
              const nextStatus = s.status === "Active" ? "Inactive" : "Active";
              const updatedSite = { ...s, status: nextStatus };
              if (selectedSite && selectedSite.id === siteId) {
                setSelectedSite(updatedSite);
              }
              return updatedSite;
            }
            return s;
          })
        };
      }
      return c;
    });
    await handleSave(updated);
  };

  return (
    <div className="sa-modal-overlay">
      <div className="sa-modal-container" style={{ maxWidth: "900px" }}>
        <div className="sa-modal-header">
          <h3 className="sa-modal-title">
            <Building size={22} />
            Company & Site Master
          </h3>
          <button className="sa-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="sa-modal-content">
          {error && <div className="sa-alert sa-alert-error">{error}</div>}
          {success && <div className="sa-alert sa-alert-success">{success}</div>}

          {loading ? (
            <div style={{ textAlign: "center", padding: "3rem", color: "#627d98" }}>
              Loading company hierarchy...
            </div>
          ) : (
            <div className="sa-grid-2" style={{ gridTemplateColumns: "1.2fr 0.8fr" }}>
              {/* Left Column: Hierarchy list */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                  <h4 style={{ margin: 0, fontWeight: 700, fontSize: "0.95rem" }}>Corporate Entities</h4>
                </div>

                {showAddCompany && (
                  <form onSubmit={handleAddCompany} style={{ background: "rgba(0,0,0,0.02)", padding: "1rem", borderRadius: "0.75rem", marginBottom: "1rem", border: "1px dashed rgba(0,0,0,0.1)" }}>
                    <div className="sa-grid-2">
                      <div className="sa-form-group">
                        <label className="sa-form-label">Code (e.g. TATA)</label>
                        <input className="sa-input" type="text" placeholder="TATA" value={newCompany.code} onChange={(e) => setNewCompany({ ...newCompany, code: e.target.value })} required />
                      </div>
                      <div className="sa-form-group">
                        <label className="sa-form-label">Company Name</label>
                        <input className="sa-input" type="text" placeholder="Tata Motors Ltd" value={newCompany.name} onChange={(e) => setNewCompany({ ...newCompany, name: e.target.value })} required />
                      </div>
                    </div>
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "0.5rem" }}>
                      <button type="button" className="sa-btn sa-btn-secondary" style={{ padding: "0.35rem 0.75rem", fontSize: "0.8rem" }} onClick={() => setShowAddCompany(false)}>Cancel</button>
                      <button type="submit" className="sa-btn sa-btn-primary" style={{ padding: "0.35rem 0.75rem", fontSize: "0.8rem" }}>Save</button>
                    </div>
                  </form>
                )}

                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  {companies.map((company) => (
                    <div key={company.id} className="sa-company-item">
                      <div className="sa-company-header" onClick={() => setExpandedCompany(expandedCompany === company.id ? null : company.id)}>
                        <div className="sa-company-title">
                          <Building size={16} />
                          <span>{company.name}</span>
                          <span className="sa-company-code">{company.code}</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          {expandedCompany === company.id ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </div>
                      </div>

                      {expandedCompany === company.id && (
                        <div className="sa-sites-list">
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(0,0,0,0.03)", paddingBottom: "0.5rem" }}>
                            <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "#627d98" }}>Operational Sites</span>
                            <button className="sa-btn sa-btn-secondary" style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem" }} onClick={(e) => { e.stopPropagation(); setShowAddSite(company.id); }}>
                              <Plus size={12} /> Add Site
                            </button>
                          </div>

                          {showAddSite === company.id && (
                            <form onSubmit={(e) => handleAddSite(e, company.id)} style={{ background: "rgba(0,0,0,0.02)", padding: "0.85rem", borderRadius: "0.5rem", border: "1px dashed rgba(0,0,0,0.08)" }}>
                              <div className="sa-form-group">
                                <label className="sa-form-label">Site Name</label>
                                <input className="sa-input" type="text" placeholder="Chakan Plant II" value={newSite.name} onChange={(e) => setNewSite({ ...newSite, name: e.target.value })} required />
                              </div>
                              <div className="sa-form-group">
                                <label className="sa-form-label">Address</label>
                                <input className="sa-input" type="text" placeholder="MIDC Phase 3, Chakan, Pune" value={newSite.address} onChange={(e) => setNewSite({ ...newSite, address: e.target.value })} required />
                              </div>
                              <div className="sa-grid-2">
                                <div className="sa-form-group">
                                  <label className="sa-form-label">Latitude</label>
                                  <input className="sa-input" type="text" placeholder="18.5204" value={newSite.lat} onChange={(e) => setNewSite({ ...newSite, lat: e.target.value })} />
                                </div>
                                <div className="sa-form-group">
                                  <label className="sa-form-label">Longitude</label>
                                  <input className="sa-input" type="text" placeholder="73.8567" value={newSite.lng} onChange={(e) => setNewSite({ ...newSite, lng: e.target.value })} />
                                </div>
                              </div>
                              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "0.5rem" }}>
                                <button type="button" className="sa-btn sa-btn-secondary" style={{ padding: "0.3rem 0.6rem", fontSize: "0.75rem" }} onClick={() => setShowAddSite(null)}>Cancel</button>
                                <button type="submit" className="sa-btn sa-btn-primary" style={{ padding: "0.3rem 0.6rem", fontSize: "0.75rem" }}>Save Site</button>
                              </div>
                            </form>
                          )}

                          {company.sites.length === 0 ? (
                            <div style={{ fontSize: "0.8rem", color: "#829ab1", padding: "0.5rem 0", textAlign: "center" }}>No sites registered for this company.</div>
                          ) : (
                            company.sites.map((site) => (
                              <div key={site.id} className={`sa-site-item ${selectedSite?.id === site.id ? "selected" : ""}`} onClick={() => setSelectedSite(site)} style={{ cursor: "pointer", borderLeft: selectedSite?.id === site.id ? "3px solid #2563eb" : "1px solid rgba(0,0,0,0.03)" }}>
                                <div className="sa-site-info">
                                  <h5>{site.name}</h5>
                                  <p>{site.address}</p>
                                </div>
                                <div className="sa-site-actions" onClick={(e) => e.stopPropagation()}>
                                  <span style={{ fontSize: "0.75rem", fontWeight: 700, color: site.status === "Active" ? "#059669" : "#dc2626", marginRight: "0.25rem" }}>
                                    {site.status}
                                  </span>
                                  <button className={`sa-badge-toggle ${site.status === "Active" ? "active" : ""}`} onClick={() => toggleSiteStatus(company.id, site.id)} title="Toggle Site Status">
                                    {site.status === "Active" ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
                                  </button>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Right Column: Site Details & Map coordinates */}
              <div>
                <h4 style={{ margin: "0 0 1rem 0", fontWeight: 700, fontSize: "0.95rem" }}>Geographical Mapping</h4>
                {selectedSite ? (
                  <div style={{ background: "#ffffff", border: "1px solid rgba(0,0,0,0.05)", borderRadius: "1rem", padding: "1.25rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
                    <div>
                      <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#627d98", textTransform: "uppercase" }}>Selected Site</span>
                      <h3 style={{ margin: "0.25rem 0 0", color: "#102a43", fontWeight: 700, fontSize: "1.1rem" }}>{selectedSite.name}</h3>
                      <p style={{ margin: "0.5rem 0 0", fontSize: "0.85rem", color: "#334e68", display: "flex", alignItems: "flex-start", gap: "0.25rem" }}>
                        <MapPin size={16} style={{ flexShrink: 0, color: "#2563eb", marginTop: "0.1rem" }} />
                        {selectedSite.address}
                      </p>
                    </div>

                    <div className="sa-grid-2" style={{ background: "rgba(0,0,0,0.02)", padding: "0.75rem", borderRadius: "0.75rem" }}>
                      <div>
                        <span style={{ fontSize: "0.7rem", color: "#627d98", fontWeight: 700 }}>Latitude</span>
                        <div style={{ fontSize: "0.85rem", fontWeight: 700 }}>{selectedSite.lat.toFixed(5)}</div>
                      </div>
                      <div>
                        <span style={{ fontSize: "0.7rem", color: "#627d98", fontWeight: 700 }}>Longitude</span>
                        <div style={{ fontSize: "0.85rem", fontWeight: 700 }}>{selectedSite.lng.toFixed(5)}</div>
                      </div>
                    </div>

                    <div className="sa-map-card">
                      <div className="sa-map-gridlines" />
                      <MapPin className="sa-map-pin" size={32} />
                      <div className="sa-map-label">
                        {selectedSite.lat.toFixed(4)}, {selectedSite.lng.toFixed(4)}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "200px", color: "#829ab1", fontSize: "0.85rem", background: "rgba(255,255,255,0.4)", borderRadius: "1rem", border: "1px dashed rgba(0,0,0,0.1)" }}>
                    Select a site to view coordinates.
                  </div>
                )}
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
