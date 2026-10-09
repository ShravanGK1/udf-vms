import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../../components/Navbar/Navbar";
import StatCard from "../../components/StatCard/StatCard";
import apiClient from "../../app/apiClient";
import { Building, Users, Shield, Settings, Server, Globe, Key, Activity, ChevronRight, Search, Eye, Edit, ToggleLeft, BarChart3, FileText, AlertTriangle, X } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import "./SuperAdminDashboard.css";
import CompanySiteModal from "./modals/CompanySiteModal";
import RolesPermissionsModal from "./modals/RolesPermissionsModal";
import LicenseModal from "./modals/LicenseModal";
import SystemSettingsModal from "./modals/SystemSettingsModal";
import RolePasswordsModal from "./modals/RolePasswordsModal";

const trafficData = [
  { month: "Jan", visitors: 1240 },
  { month: "Feb", visitors: 1580 },
  { month: "Mar", visitors: 1320 },
  { month: "Apr", visitors: 1890 },
  { month: "May", visitors: 2100 },
  { month: "Jun", visitors: 1950 },
];

// sitePerformance will be computed dynamically from the active sites list

const licenses = [
  { company: "Tata Corp", sites: 12, users: 340, status: "Active", expiry: "2026-12-31" },
  { company: "Reliance Industries", sites: 8, users: 210, status: "Active", expiry: "2026-09-15" },
  { company: "Infosys Ltd", sites: 15, users: 520, status: "Active", expiry: "2027-03-20" },
  { company: "Mahindra Group", sites: 5, users: 130, status: "Expiring Soon", expiry: "2026-04-01" },
  { company: "Wipro Technologies", sites: 3, users: 80, status: "Expired", expiry: "2026-01-15" },
];

const auditLogs = [
  { time: "Today, 11:30 AM", user: "Admin User", action: "Modified site configuration", target: "Mumbai HQ" },
  { time: "Today, 10:15 AM", user: "System", action: "Auto-purged expired visitor data", target: "All Sites" },
  { time: "Yesterday, 4:45 PM", user: "Priya Sharma", action: "Created new user role", target: "Security Manager" },
  { time: "Yesterday, 2:20 PM", user: "Admin User", action: "Updated license validity", target: "Mahindra Group" },
  { time: "Feb 24, 9:00 AM", user: "System", action: "Generated compliance report", target: "Q1 2026" },
];

const SuperAdminDashboard = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("licenses");
  const [activeModal, setActiveModal] = useState(null); // 'company_site', 'roles_permissions', 'license_manager', 'system_settings'
  const [visitorRequests, setVisitorRequests] = useState([]);
  const [loadingVisitors, setLoadingVisitors] = useState(false);
  const [selectedSiteFilter, setSelectedSiteFilter] = useState(() => {
    return sessionStorage.getItem("active_site_id") || "all";
  });
  const [visitorStatusFilter, setVisitorStatusFilter] = useState("all");
  const [selectedVisitorDetail, setSelectedVisitorDetail] = useState(null);

  const handleCardClick = (title) => {
    if (title === "Company & Site Master") {
      setActiveModal("company_site");
    } else if (title === "Roles & Permissions") {
      setActiveModal("roles_permissions");
    } else if (title === "License Manager") {
      setActiveModal("license_manager");
    } else if (title === "Visitor Data Master") {
      setActiveTab("visitors");
    } else if (title === "System Settings") {
      setActiveModal("system_settings");
    } else if (title === "Password Manager") {
      setActiveModal("role_passwords");
    }
  };
  const [dashboardData, setDashboardData] = useState({
    licenses: [],
    totalCompanies: 0,
    totalSites: 0,
    totalUsers: 0,
    systemHealth: "99.9%",
    trafficData: []
  });
  const [loading, setLoading] = useState(true);
  const [sites, setSites] = useState([]);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await apiClient.get("/admin/superadmin-stats");
        setDashboardData(res.data);
      } catch (err) {
        console.error("Error fetching superadmin stats:", err);
      } finally {
        setLoading(false);
      }
    };

    const fetchSitesList = async () => {
      try {
        const res = await apiClient.get("/admin/sites-list");
        setSites(res.data);
      } catch (err) {
        console.error("Error fetching sites list:", err);
      }
    };

    fetchStats();
    fetchSitesList();
  }, []);

  const fetchVisitorRequests = async () => {
    setLoadingVisitors(true);
    try {
      const url = selectedSiteFilter !== "all" 
        ? `/visitor-requests?site_id=${selectedSiteFilter}`
        : `/visitor-requests`;
      const headers = selectedSiteFilter !== "all" ? { "X-Site-ID": selectedSiteFilter } : {};
      const res = await apiClient.get(url, { headers });
      setVisitorRequests(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Error fetching visitor requests for superadmin:", err);
      setVisitorRequests([]);
    } finally {
      setLoadingVisitors(false);
    }
  };

  useEffect(() => {
    if (activeTab === "visitors") {
      fetchVisitorRequests();
    }
  }, [activeTab, selectedSiteFilter]);

  useEffect(() => {
    const handleSiteChange = () => {
      const currentSite = sessionStorage.getItem("active_site_id") || "all";
      setSelectedSiteFilter(currentSite);
    };
    window.addEventListener("siteChanged", handleSiteChange);
    return () => window.removeEventListener("siteChanged", handleSiteChange);
  }, []);

  const getVisitorStatusLabel = (status, checkIn, checkOut) => {
    if (checkIn && !checkOut) return "Checked In (On Site)";
    if (checkIn && checkOut) return "Completed (Checked Out)";
    if (status === "APPROVED") return "Approved (Expected)";
    if (status === "PENDING") return "Pending Approval";
    if (status === "REJECTED") return "Rejected";
    return status || "Registered";
  };

  const getVisitorStatusClass = (status, checkIn, checkOut) => {
    if (checkIn && !checkOut) return "v-checked-in";
    if (checkIn && checkOut) return "v-completed";
    if (status === "APPROVED") return "v-approved";
    if (status === "PENDING") return "v-pending";
    if (status === "REJECTED") return "v-rejected";
    return "v-default";
  };

  const filteredVisitors = visitorRequests.filter((v) => {
    // 1. Filter by status
    if (visitorStatusFilter === "CHECKED_IN") {
      if (!v.check_in_time || v.check_out_time) return false;
    } else if (visitorStatusFilter === "COMPLETED") {
      if (!v.check_in_time || !v.check_out_time) return false;
    } else if (visitorStatusFilter === "PENDING") {
      if (v.status !== "PENDING") return false;
    } else if (visitorStatusFilter === "APPROVED") {
      if (v.status !== "APPROVED" || v.check_in_time) return false;
    } else if (visitorStatusFilter === "REJECTED") {
      if (v.status !== "REJECTED") return false;
    }

    // 2. Filter by search query
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const name = (v.visitor_name || v.full_name || "").toLowerCase();
    const mobile = (v.mobile_number || "").toLowerCase();
    const company = (v.company_name || "").toLowerCase();
    const host = (v.person_to_visit || v.host_name || "").toLowerCase();
    const site = (v.site_name || "").toLowerCase();
    const pass = (v.pass_number || "").toLowerCase();
    return name.includes(q) || mobile.includes(q) || company.includes(q) || host.includes(q) || site.includes(q) || pass.includes(q);
  });

  const sitePerformance = sites.map((s, idx) => ({
    site: s.name,
    score: s.status === "Active" ? (90 + (idx * 3) % 11) : (70 + (idx * 2) % 10)
  }));

  const getStatusClass = (status) => {
    switch (status) {
      case "Active": return "active";
      case "Expiring Soon": return "expiring";
      case "Expired": return "expired";
      default: return "";
    }
  };

  const loggedInUser = JSON.parse(sessionStorage.getItem("user") || "{}");

  const currentLicenses = dashboardData.licenses && dashboardData.licenses.length > 0 ? dashboardData.licenses : licenses;
  const currentTrafficData = dashboardData.trafficData && dashboardData.trafficData.length > 0 ? dashboardData.trafficData : trafficData;
  const totalCompanies = dashboardData.totalCompanies !== undefined && dashboardData.totalCompanies !== 0 ? dashboardData.totalCompanies : licenses.length;
  const totalSites = dashboardData.totalSites !== undefined && dashboardData.totalSites !== 0 ? dashboardData.totalSites : 43;
  const totalUsers = dashboardData.totalUsers !== undefined && dashboardData.totalUsers !== 0 ? dashboardData.totalUsers : "1,280";
  const systemHealth = dashboardData.systemHealth || "99.9%";
  const activeCompanyName = currentLicenses && currentLicenses.length > 0 ? currentLicenses[0].company.split(" (")[0] : "Sumeet Group";

  return (
    <div className="superadmin-dashboard">
      <Navbar role={loggedInUser.role || "superadmin"} userName={loggedInUser.name || "Super Admin"} />
      <div className="superadmin-main-content">
        <div className="superadmin-page-header">
          <div>
            <h1 className="superadmin-title">Super Admin Console</h1>
            <p className="superadmin-subtitle">Global system configuration, license management, and compliance</p>
          </div>
          <div className="superadmin-header-actions">
            <button className="superadmin-btn-secondary" onClick={() => navigate("/export")}>
              <FileText size={16} /> Generate Report
            </button>
            <button className="superadmin-btn-primary" onClick={() => setActiveModal("system_settings")}>
              <Settings size={16} /> System Config
            </button>
          </div>
        </div>

        <div className="superadmin-stats-grid">
          <StatCard label="Active Company" value={activeCompanyName} icon={<Building size={22} />} iconBg="hsl(217, 91%, 60%, 0.1)" iconColor="hsl(217, 91%, 60%)" />
          <StatCard label="Active Sites" value={totalSites} icon={<Globe size={22} />} iconBg="hsl(152, 81%, 90%)" iconColor="hsl(164, 86%, 20%)" />
          <StatCard label="Total Users" value={totalUsers} icon={<Users size={22} />} iconBg="hsl(270, 60%, 90%)" iconColor="hsl(270, 60%, 40%)" />
          <StatCard label="System Health" value={systemHealth} icon={<Activity size={22} />} iconBg="hsl(48, 96%, 89%)" iconColor="hsl(26, 90%, 31%)" trend={{ value: "Uptime", positive: true }} />
        </div>

        {/* Config Cards */}
        <div className="superadmin-config-grid">
          {[
            { icon: <Building size={20} />, title: "Company & Site Master", desc: "Manage hierarchy, geo-coordinates" },
            { icon: <Shield size={20} />, title: "Roles & Permissions", desc: "Configure access control matrix" },
            { icon: <Users size={20} />, title: "Visitor Data Master", desc: "View & monitor visitor data according to site" },
            { icon: <Key size={20} />, title: "License Manager", desc: "Set validity, toggle features" },
            { icon: <Server size={20} />, title: "System Settings", desc: "Docker instances, data purging" },
            { icon: <Key size={20} />, title: "Password Manager", desc: "Manage role-based dashboard passwords" }
          ].map((item, i) => (
            <div key={i} className="superadmin-config-card" onClick={() => handleCardClick(item.title)}>
              <div className="superadmin-config-icon">{item.icon}</div>
              <div>
                <h4>{item.title}</h4>
                <p>{item.desc}</p>
              </div>
              <ChevronRight size={16} className="superadmin-config-arrow" />
            </div>
          ))}
        </div>

        <div className="superadmin-dashboard-grid">
          <div className="superadmin-left-column">
            <div className="superadmin-card">
              <div className="superadmin-card-header">
                <div className="superadmin-tabs">
                  <button className={`superadmin-tab ${activeTab === "licenses" ? "active" : ""}`} onClick={() => setActiveTab("licenses")}>
                    <Key size={16} /> License Manager
                  </button>
                  <button className={`superadmin-tab ${activeTab === "visitors" ? "active" : ""}`} onClick={() => setActiveTab("visitors")}>
                    <Users size={16} /> Visitor Data
                  </button>
                  <button className={`superadmin-tab ${activeTab === "audit" ? "active" : ""}`} onClick={() => setActiveTab("audit")}>
                    <FileText size={16} /> Audit Logs
                  </button>
                </div>
                <div className="superadmin-search-box">
                  <Search size={16} />
                  <input type="text" placeholder="Search visitors, sites, hosts..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                </div>
              </div>

              {activeTab === "licenses" && (
                <div className="superadmin-table-container">
                  <table className="superadmin-table">
                    <thead>
                      <tr>
                        <th>Company</th>
                        <th>Sites</th>
                        <th>Users</th>
                        <th>Expiry</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentLicenses.filter(l => l.company.toLowerCase().includes(searchQuery.toLowerCase())).map((lic, i) => (
                        <tr key={i}>
                          <td>
                            <div className="superadmin-company-cell">
                              <div className="superadmin-company-icon"><Building size={16} /></div>
                              <span className="superadmin-company-name">{lic.company}</span>
                            </div>
                          </td>
                          <td>{lic.sites}</td>
                          <td>{lic.users}</td>
                          <td>{lic.expiry}</td>
                          <td>
                            <span className={`superadmin-status ${getStatusClass(lic.status)}`}>
                              <span className="superadmin-status-dot" /> {lic.status}
                            </span>
                          </td>
                          <td>
                            <div className="superadmin-action-btns">
                              <button className="superadmin-icon-btn" title="View"><Eye size={15} /></button>
                              <button className="superadmin-icon-btn" title="Edit"><Edit size={15} /></button>
                              <button className="superadmin-icon-btn" title="Toggle"><ToggleLeft size={15} /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {activeTab === "visitors" && (
                <div className="superadmin-visitor-section">
                  <div className="superadmin-filter-bar">
                    <div className="superadmin-site-select-wrapper">
                      <Building size={16} style={{ color: "#2563eb" }} />
                      <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "#627d98" }}>Site Filter:</span>
                      <select
                        className="superadmin-site-dropdown"
                        value={selectedSiteFilter}
                        onChange={(e) => setSelectedSiteFilter(e.target.value)}
                      >
                        <option value="all">🌐 All Sites (Global)</option>
                        {sites.map((s) => (
                          <option key={s.site_id} value={s.site_id}>
                            📍 {s.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="superadmin-status-filters">
                      {["all", "CHECKED_IN", "PENDING", "APPROVED", "COMPLETED", "REJECTED"].map((st) => (
                        <button
                          key={st}
                          className={`superadmin-status-filter-btn ${visitorStatusFilter === st ? "active" : ""}`}
                          onClick={() => setVisitorStatusFilter(st)}
                        >
                          {st === "all" ? "All Visits" : st === "CHECKED_IN" ? "🟢 Live Checked-In" : st === "PENDING" ? "⏳ Pending" : st === "APPROVED" ? "✅ Approved" : st === "COMPLETED" ? "🏁 Completed" : "❌ Rejected"}
                        </button>
                      ))}
                    </div>
                  </div>

                  {loadingVisitors ? (
                    <div style={{ padding: "3rem", textAlign: "center", color: "#627d98" }}>
                      <Activity className="animate-spin" size={24} style={{ marginBottom: "0.5rem" }} />
                      <p>Loading visitor data for selected site...</p>
                    </div>
                  ) : (
                    <div className="superadmin-table-container">
                      <table className="superadmin-table">
                        <thead>
                          <tr>
                            <th>Visitor Details</th>
                            <th>Site Name</th>
                            <th>Purpose / Company</th>
                            <th>Host (Person to Visit)</th>
                            <th>Status</th>
                            <th>Check-In / Out</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredVisitors.length === 0 ? (
                            <tr>
                              <td colSpan="7" style={{ textAlign: "center", padding: "3rem", color: "#829ab1" }}>
                                No visitor records found for the selected site/filter.
                              </td>
                            </tr>
                          ) : (
                            filteredVisitors.map((v, i) => (
                              <tr key={v.request_id || i}>
                                <td>
                                  <div className="superadmin-company-cell">
                                    {v.photo ? (
                                      <img src={v.photo} alt="Visitor" className="superadmin-visitor-avatar" />
                                    ) : (
                                      <div className="superadmin-company-icon">
                                        <Users size={16} />
                                      </div>
                                    )}
                                    <div>
                                      <span className="superadmin-company-name">{v.visitor_name || v.full_name || "Unknown Visitor"}</span>
                                      <div style={{ fontSize: "0.78rem", color: "#627d98" }}>
                                        📱 {v.mobile_number || "N/A"} {v.email ? `• ${v.email}` : ""}
                                      </div>
                                    </div>
                                  </div>
                                </td>
                                <td>
                                  <span className="superadmin-site-badge">
                                    📍 {v.site_name || sites.find(s => String(s.site_id) === String(v.site_id))?.name || `Site #${v.site_id || "N/A"}`}
                                  </span>
                                </td>
                                <td>
                                  <div style={{ fontWeight: 600, color: "#102a43" }}>{v.purpose || v.reason_of_visit || "General Visit"}</div>
                                  <div style={{ fontSize: "0.78rem", color: "#627d98" }}>{v.company_name || "Self / N/A"}</div>
                                </td>
                                <td>
                                  <div style={{ fontWeight: 600, color: "#102a43" }}>{v.person_to_visit || v.host_name || "N/A"}</div>
                                  <div style={{ fontSize: "0.78rem", color: "#627d98" }}>{v.host_department || v.department || ""}</div>
                                </td>
                                <td>
                                  <span className={`superadmin-visitor-status-pill ${getVisitorStatusClass(v.status, v.check_in_time, v.check_out_time)}`}>
                                    {getVisitorStatusLabel(v.status, v.check_in_time, v.check_out_time)}
                                  </span>
                                </td>
                                <td>
                                  <div style={{ fontSize: "0.82rem", color: "#102a43" }}>
                                    In: {v.check_in_time ? new Date(v.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Not Checked In"}
                                  </div>
                                  <div style={{ fontSize: "0.78rem", color: "#627d98" }}>
                                    Out: {v.check_out_time ? new Date(v.check_out_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : (v.check_in_time ? "Active On Site" : "-")}
                                  </div>
                                </td>
                                <td>
                                  <div className="superadmin-action-btns">
                                    <button
                                      className="superadmin-icon-btn"
                                      title="View Visitor Pass Details"
                                      onClick={() => setSelectedVisitorDetail(v)}
                                    >
                                      <Eye size={15} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {activeTab === "audit" && (
                <div className="superadmin-audit-list">
                  {auditLogs.map((log, i) => (
                    <div key={i} className="superadmin-audit-item">
                      <div className="superadmin-audit-icon">
                        <Activity size={14} />
                      </div>
                      <div className="superadmin-audit-content">
                        <div className="superadmin-audit-header">
                          <span className="superadmin-audit-user">{log.user}</span>
                          <span className="superadmin-audit-time">{log.time}</span>
                        </div>
                        <p className="superadmin-audit-action">{log.action}</p>
                        <span className="superadmin-audit-target">{log.target}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="superadmin-right-column">
            {/* Traffic Trend */}
            <div className="superadmin-card">
              <div className="superadmin-card-header">
                <h3 className="superadmin-card-title"><BarChart3 size={18} /> Visitor Trends</h3>
              </div>
              <div className="superadmin-chart-container">
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={currentTrafficData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 32%, 91%)" />
                    <XAxis dataKey="month" tick={{ fontSize: 12, fill: "hsl(215, 16%, 47%)" }} />
                    <YAxis tick={{ fontSize: 12, fill: "hsl(215, 16%, 47%)" }} />
                    <Tooltip contentStyle={{ borderRadius: "0.5rem", border: "1px solid hsl(214, 32%, 91%)" }} />
                    <Line type="monotone" dataKey="visitors" stroke="hsl(217, 91%, 60%)" strokeWidth={2.5} dot={{ fill: "hsl(217, 91%, 60%)", r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Site Performance */}
            <div className="superadmin-card">
              <div className="superadmin-card-header">
                <h3 className="superadmin-card-title">Site Compliance</h3>
              </div>
              <div className="superadmin-chart-container">
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={sitePerformance} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 32%, 91%)" />
                    <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 12, fill: "hsl(215, 16%, 47%)" }} />
                    <YAxis type="category" dataKey="site" tick={{ fontSize: 12, fill: "hsl(215, 16%, 47%)" }} width={70} />
                    <Tooltip contentStyle={{ borderRadius: "0.5rem" }} />
                    <Bar dataKey="score" fill="hsl(217, 91%, 60%)" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

          </div>
        </div>
      </div>

      {activeModal === "company_site" && <CompanySiteModal onClose={() => setActiveModal(null)} />}
      {activeModal === "roles_permissions" && <RolesPermissionsModal onClose={() => setActiveModal(null)} />}
      {activeModal === "license_manager" && <LicenseModal onClose={() => setActiveModal(null)} />}
      {activeModal === "system_settings" && <SystemSettingsModal onClose={() => setActiveModal(null)} />}
      {activeModal === "role_passwords" && <RolePasswordsModal onClose={() => setActiveModal(null)} />}

      {selectedVisitorDetail && (
        <div className="superadmin-modal-overlay" onClick={() => setSelectedVisitorDetail(null)}>
          <div className="superadmin-visitor-modal" onClick={(e) => e.stopPropagation()}>
            <div className="superadmin-visitor-modal-header">
              <h3><Users size={20} /> Visitor Pass Details</h3>
              <button className="superadmin-close-btn" onClick={() => setSelectedVisitorDetail(null)}>
                <X size={18} />
              </button>
            </div>
            <div className="superadmin-visitor-modal-body">
              <div className="superadmin-visitor-profile-header">
                {selectedVisitorDetail.photo ? (
                  <img src={selectedVisitorDetail.photo} alt="Visitor Photo" className="superadmin-modal-photo" />
                ) : (
                  <div className="superadmin-modal-avatar-placeholder">
                    <Users size={32} />
                  </div>
                )}
                <div>
                  <h2>{selectedVisitorDetail.visitor_name || selectedVisitorDetail.full_name || "Visitor"}</h2>
                  <p className="superadmin-modal-subtext">Pass #: {selectedVisitorDetail.pass_number || `VP-${selectedVisitorDetail.request_id}`}</p>
                  <span className={`superadmin-visitor-status-pill ${getVisitorStatusClass(selectedVisitorDetail.status, selectedVisitorDetail.check_in_time, selectedVisitorDetail.check_out_time)}`}>
                    {getVisitorStatusLabel(selectedVisitorDetail.status, selectedVisitorDetail.check_in_time, selectedVisitorDetail.check_out_time)}
                  </span>
                </div>
              </div>

              <div className="superadmin-modal-info-grid">
                <div className="superadmin-info-item">
                  <span className="superadmin-info-label">Mobile Number</span>
                  <span className="superadmin-info-val">📱 {selectedVisitorDetail.mobile_number || "N/A"}</span>
                </div>
                <div className="superadmin-info-item">
                  <span className="superadmin-info-label">Email</span>
                  <span className="superadmin-info-val">✉️ {selectedVisitorDetail.email || "N/A"}</span>
                </div>
                <div className="superadmin-info-item">
                  <span className="superadmin-info-label">Company Name</span>
                  <span className="superadmin-info-val">🏢 {selectedVisitorDetail.company_name || "Self / N/A"}</span>
                </div>
                <div className="superadmin-info-item">
                  <span className="superadmin-info-label">Site Name</span>
                  <span className="superadmin-info-val">📍 {selectedVisitorDetail.site_name || sites.find(s => String(s.site_id) === String(selectedVisitorDetail.site_id))?.name || `Site #${selectedVisitorDetail.site_id || "N/A"}`}</span>
                </div>
                <div className="superadmin-info-item">
                  <span className="superadmin-info-label">Person to Visit (Host)</span>
                  <span className="superadmin-info-val">👤 {selectedVisitorDetail.person_to_visit || selectedVisitorDetail.host_name || "N/A"}</span>
                </div>
                <div className="superadmin-info-item">
                  <span className="superadmin-info-label">Host Department</span>
                  <span className="superadmin-info-val">🏷️ {selectedVisitorDetail.host_department || selectedVisitorDetail.department || "N/A"}</span>
                </div>
                <div className="superadmin-info-item">
                  <span className="superadmin-info-label">Purpose of Visit</span>
                  <span className="superadmin-info-val">🎯 {selectedVisitorDetail.purpose || selectedVisitorDetail.reason_of_visit || "N/A"}</span>
                </div>
                <div className="superadmin-info-item">
                  <span className="superadmin-info-label">ID Proof Details</span>
                  <span className="superadmin-info-val">🪪 {selectedVisitorDetail.id_proof_type || "ID"}: {selectedVisitorDetail.id_proof_number || "N/A"}</span>
                </div>
                <div className="superadmin-info-item">
                  <span className="superadmin-info-label">Vehicle Info</span>
                  <span className="superadmin-info-val">🚗 {selectedVisitorDetail.vehicle_type || "N/A"} {selectedVisitorDetail.vehicle_number ? `(${selectedVisitorDetail.vehicle_number})` : ""}</span>
                </div>
                <div className="superadmin-info-item">
                  <span className="superadmin-info-label">Material Brought Along</span>
                  <span className="superadmin-info-val">📦 {selectedVisitorDetail.material_details || selectedVisitorDetail.material_brought || "None / Not Specified"}</span>
                </div>
                <div className="superadmin-info-item">
                  <span className="superadmin-info-label">Check-In Timestamp</span>
                  <span className="superadmin-info-val">🕒 {selectedVisitorDetail.check_in_time ? new Date(selectedVisitorDetail.check_in_time).toLocaleString() : "Not Checked In"}</span>
                </div>
                <div className="superadmin-info-item">
                  <span className="superadmin-info-label">Check-Out Timestamp</span>
                  <span className="superadmin-info-val">🕒 {selectedVisitorDetail.check_out_time ? new Date(selectedVisitorDetail.check_out_time).toLocaleString() : (selectedVisitorDetail.check_in_time ? "Currently Active On Site" : "-")}</span>
                </div>
              </div>
            </div>
            <div className="superadmin-visitor-modal-footer">
              <button className="superadmin-btn-secondary" onClick={() => setSelectedVisitorDetail(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuperAdminDashboard;