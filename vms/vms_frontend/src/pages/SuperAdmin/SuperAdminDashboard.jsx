import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../../components/Navbar/Navbar";
import StatCard from "../../components/StatCard/StatCard";
import apiClient from "../../app/apiClient";
import { Building, Users, Shield, Settings, Server, Globe, Key, Activity, ChevronRight, Search, Eye, Edit, ToggleLeft, BarChart3, FileText, AlertTriangle, X, MapPin, Plus, CheckCircle, RefreshCw } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import { useTheme } from "../../context/ThemeContext";
import "./SuperAdminDashboard.css";
import CompanySiteModal from "./modals/CompanySiteModal";
import RolesPermissionsModal from "./modals/RolesPermissionsModal";
import LicenseModal from "./modals/LicenseModal";
import SystemSettingsModal from "./modals/SystemSettingsModal";
import RolePasswordsModal from "./modals/RolePasswordsModal";
import {
  ViewUserModal,
  EditUserModal,
  TransferSiteModal,
  StatusConfirmModal,
  ResetPasswordModal,
  ViewLicenseModal
} from "./modals/UserModals";

const licenses = [
  { company: "Enterprise Customer", sites: 1, users: 1, status: "Active", expiry: "2027-05-26" }
];

const SuperAdminDashboard = () => {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const chartGridStroke = isDark ? "rgba(255, 255, 255, 0.1)" : "hsl(214, 32%, 91%)";
  const chartTickFill = isDark ? "#94a3b8" : "hsl(215, 16%, 47%)";
  const chartTooltipStyle = isDark ? {
    backgroundColor: "#1e293b",
    borderColor: "rgba(255, 255, 255, 0.15)",
    color: "#f8fafc",
    borderRadius: "0.5rem"
  } : {
    borderRadius: "0.5rem",
    border: "1px solid hsl(214, 32%, 91%)"
  };

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

  const [siteStatusFilter, setSiteStatusFilter] = useState("all");
  const [showCreateSiteModal, setShowCreateSiteModal] = useState(false);
  const [showEditSiteModal, setShowEditSiteModal] = useState(false);
  const [showViewSiteModal, setShowViewSiteModal] = useState(false);
  const [selectedSiteForEdit, setSelectedSiteForEdit] = useState(null);
  const [selectedSiteForView, setSelectedSiteForView] = useState(null);
  const [siteFormData, setSiteFormData] = useState({
    name: "",
    code: "",
    address: "",
    lat: "18.5204",
    lng: "73.8567",
    status: "Active"
  });
  const [siteFormError, setSiteFormError] = useState("");
  const [siteFormSubmitting, setSiteFormSubmitting] = useState(false);
  const [siteActionFeedback, setSiteActionFeedback] = useState("");

  // Super Admin User Management States
  const [usersList, setUsersList] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userRoleFilter, setUserRoleFilter] = useState("all");
  const [userStatusFilter, setUserStatusFilter] = useState("all");
  const [selectedUserForView, setSelectedUserForView] = useState(null);
  const [selectedUserForEdit, setSelectedUserForEdit] = useState(null);
  const [selectedUserForTransfer, setSelectedUserForTransfer] = useState(null);
  const [selectedUserForStatus, setSelectedUserForStatus] = useState(null);
  const [statusTarget, setStatusTarget] = useState("");
  const [selectedUserForReset, setSelectedUserForReset] = useState(null);
  const [actionFeedbackToast, setActionFeedbackToast] = useState("");

  // License Management States
  const [showViewLicenseModal, setShowViewLicenseModal] = useState(false);
  const [isTogglingLicense, setIsTogglingLicense] = useState(false);

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
    trafficData: []
  });
  const [loading, setLoading] = useState(true);
  const [sites, setSites] = useState([]);

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
      setSites(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Error fetching sites list:", err);
      setSites([]);
    }
  };

  const fetchUsers = async () => {
    try {
      setLoadingUsers(true);
      const res = await apiClient.get("/admin/users");
      setUsersList(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Error fetching users list:", err);
      setUsersList([]);
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleToggleLicense = async () => {
    if (!window.confirm("Are you sure you want to toggle the system license status?")) return;
    try {
      setIsTogglingLicense(true);
      const res = await apiClient.post("/admin/toggle-license");
      setActionFeedbackToast(res.data?.message || "License status toggled successfully.");
      setTimeout(() => setActionFeedbackToast(""), 4000);
      fetchStats();
    } catch (err) {
      const errMsg = err.response?.data?.error || "Failed to toggle license.";
      alert(errMsg);
    } finally {
      setIsTogglingLicense(false);
    }
  };

  useEffect(() => {
    fetchStats();
    fetchSitesList();
    fetchUsers();
  }, []);

  useEffect(() => {
    if (activeTab === "users") {
      fetchUsers();
    }
  }, [activeTab]);

  const handleOpenCreateSite = () => {
    setSiteFormData({
      name: "",
      code: "",
      address: "",
      lat: "18.5204",
      lng: "73.8567",
      status: "Active"
    });
    setSiteFormError("");
    setShowCreateSiteModal(true);
  };

  const handleOpenEditSite = (site) => {
    setSelectedSiteForEdit(site);
    setSiteFormData({
      name: site.name || "",
      code: site.code || "",
      address: site.address || "",
      lat: site.lat !== undefined ? String(site.lat) : "18.5204",
      lng: site.lng !== undefined ? String(site.lng) : "73.8567",
      status: site.status || "Active"
    });
    setSiteFormError("");
    setShowEditSiteModal(true);
  };

  const handleOpenViewSite = (site) => {
    setSelectedSiteForView(site);
    setShowViewSiteModal(true);
  };

  const handleCreateSite = async (e) => {
    e.preventDefault();
    if (!siteFormData.name.trim() || !siteFormData.address.trim()) {
      setSiteFormError("Site Name and Location/Address are required.");
      return;
    }
    setSiteFormSubmitting(true);
    setSiteFormError("");
    try {
      await apiClient.post("/admin/sites-list", siteFormData);
      setShowCreateSiteModal(false);
      setSiteActionFeedback("✅ Site created successfully!");
      setTimeout(() => setSiteActionFeedback(""), 4000);
      fetchSitesList();
      fetchStats();
    } catch (err) {
      setSiteFormError(err.response?.data?.error || "Failed to create site.");
    } finally {
      setSiteFormSubmitting(false);
    }
  };

  const handleUpdateSite = async (e) => {
    e.preventDefault();
    if (!selectedSiteForEdit) return;
    if (!siteFormData.name.trim() || !siteFormData.address.trim()) {
      setSiteFormError("Site Name and Location/Address are required.");
      return;
    }
    setSiteFormSubmitting(true);
    setSiteFormError("");
    try {
      await apiClient.put(`/admin/sites-list/${selectedSiteForEdit.site_id || selectedSiteForEdit.id}`, siteFormData);
      setShowEditSiteModal(false);
      setSiteActionFeedback("✅ Site details updated successfully!");
      setTimeout(() => setSiteActionFeedback(""), 4000);
      fetchSitesList();
      fetchStats();
    } catch (err) {
      setSiteFormError(err.response?.data?.error || "Failed to update site.");
    } finally {
      setSiteFormSubmitting(false);
    }
  };

  const handleToggleSiteStatus = async (site) => {
    try {
      const siteId = site.site_id || site.id;
      const res = await apiClient.patch(`/admin/sites-list/${siteId}/status`);
      const newStatus = res.data.status;
      setSiteActionFeedback(`Site status updated to ${newStatus}`);
      setTimeout(() => setSiteActionFeedback(""), 3000);
      fetchSitesList();
      fetchStats();
    } catch (err) {
      alert(err.response?.data?.error || "Failed to update site status");
    }
  };

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
  const currentTrafficData = dashboardData.trafficData && dashboardData.trafficData.length > 0 ? dashboardData.trafficData : [];
  const totalCompanies = dashboardData.totalCompanies !== undefined ? dashboardData.totalCompanies : licenses.length;
  const totalSites = dashboardData.totalSites !== undefined ? dashboardData.totalSites : (sites ? sites.length : 0);
  const totalUsers = dashboardData.totalUsers !== undefined ? dashboardData.totalUsers : 0;
  const activeCompanyName = currentLicenses && currentLicenses.length > 0 ? currentLicenses[0].company.split(" (")[0] : "Enterprise";

  const filteredSites = sites.filter(s => {
    const matchesSearch = (s.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (s.code || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (s.address || "").toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = siteStatusFilter === "all" || (s.status || "Active").toLowerCase() === siteStatusFilter.toLowerCase();
    return matchesSearch && matchesStatus;
  });

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

        {/* Global Action Feedback Toast */}
        {actionFeedbackToast && (
          <div style={{
            background: "rgba(16, 185, 129, 0.95)",
            color: "#ffffff",
            padding: "0.85rem 1.25rem",
            borderRadius: "0.75rem",
            marginBottom: "1.5rem",
            boxShadow: "0 8px 24px rgba(16, 185, 129, 0.25)",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            fontWeight: 600,
            fontSize: "0.95rem"
          }}>
            <CheckCircle size={18} /> {actionFeedbackToast}
          </div>
        )}

        <div className="superadmin-stats-grid">
          <StatCard label="Active Company" value={activeCompanyName} icon={<Building size={22} />} iconBg="hsl(217, 91%, 60%, 0.1)" iconColor="hsl(217, 91%, 60%)" />
          <StatCard label="Active Sites" value={totalSites} icon={<Globe size={22} />} iconBg="hsl(152, 81%, 90%)" iconColor="hsl(164, 86%, 20%)" />
          <StatCard label="Total Users" value={totalUsers} icon={<Users size={22} />} iconBg="hsl(270, 60%, 90%)" iconColor="hsl(270, 60%, 40%)" />
        </div>

        {/* Config Cards */}
        <div className="superadmin-config-grid">
          {[
            { icon: <Building size={20} />, title: "Company & Site Master", desc: "Manage hierarchy, geo-coordinates" },
            { icon: <Shield size={20} />, title: "Roles & Permissions", desc: "Configure access control matrix" },
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
                  <button className={`superadmin-tab ${activeTab === "sites" ? "active" : ""}`} onClick={() => setActiveTab("sites")}>
                    <MapPin size={16} /> Site Management
                  </button>
                  <button className={`superadmin-tab ${activeTab === "visitors" ? "active" : ""}`} onClick={() => setActiveTab("visitors")}>
                    <Users size={16} /> Visitor Data
                  </button>
                  <button className={`superadmin-tab ${activeTab === "users" ? "active" : ""}`} onClick={() => setActiveTab("users")}>
                    <Shield size={16} /> User Management
                  </button>
                </div>
                <div className="superadmin-search-box">
                  <Search size={16} />
                  <input type="text" placeholder="Search visitors, sites, users..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
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
                              <button
                                className="superadmin-icon-btn"
                                title="View License & Subscription Details"
                                onClick={() => setShowViewLicenseModal(true)}
                              >
                                <Eye size={15} />
                              </button>
                              <button
                                className="superadmin-icon-btn"
                                title="Edit License & Feature Config"
                                onClick={() => setActiveModal("license_manager")}
                              >
                                <Edit size={15} />
                              </button>
                              <button
                                className="superadmin-icon-btn"
                                title={lic.status === "Active" ? "Suspend License" : "Reactivate License"}
                                onClick={handleToggleLicense}
                                disabled={isTogglingLicense}
                              >
                                {lic.status === "Active" ? (
                                  <ToggleLeft size={16} color="#16a34a" />
                                ) : (
                                  <ToggleLeft size={16} color="#ea580c" style={{ transform: "rotate(180deg)" }} />
                                )}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* SITE MANAGEMENT TAB CONTENT */}
              {activeTab === "sites" && (
                <div className="superadmin-sites-section" style={{ padding: "1.25rem 1.5rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem", flexWrap: "wrap", gap: "1rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      {["all", "Active", "Inactive"].map(st => (
                        <button
                          key={st}
                          className={`superadmin-status-filter-btn ${siteStatusFilter === st ? "active" : ""}`}
                          onClick={() => setSiteStatusFilter(st)}
                        >
                          {st === "all" ? "All Sites" : st === "Active" ? "🟢 Active" : "⚪ Inactive"}
                        </button>
                      ))}
                    </div>
                    <button
                      className="superadmin-btn-primary"
                      onClick={handleOpenCreateSite}
                      style={{ display: "flex", alignItems: "center", gap: "6px", padding: "0.6rem 1.2rem", fontSize: "0.85rem" }}
                    >
                      <Plus size={16} /> Add New Site
                    </button>
                  </div>

                  {siteActionFeedback && (
                    <div style={{ padding: "10px 14px", borderRadius: "8px", background: "#dcfce7", color: "#15803d", fontWeight: 600, fontSize: "0.875rem", marginBottom: "1.25rem", border: "1px solid #bbf7d0" }}>
                      {siteActionFeedback}
                    </div>
                  )}

                  {filteredSites.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "3.5rem 2rem", background: "var(--card-bg, rgba(255, 255, 255, 0.7))", borderRadius: "1rem", border: "1px dashed var(--border-color, #cbd5e1)" }}>
                      <div style={{ width: "50px", height: "50px", borderRadius: "50%", background: "rgba(37, 99, 235, 0.15)", color: "#2563eb", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: "1rem" }}>
                        <MapPin size={26} />
                      </div>
                      <h3 style={{ margin: "0 0 0.5rem", color: "var(--foreground, #0f172a)", fontSize: "1.1rem", fontWeight: 700 }}>
                        {searchQuery || siteStatusFilter !== "all" ? "No Matching Sites Found" : "No Sites Configured Yet"}
                      </h3>
                      <p style={{ margin: "0 0 1.25rem", color: "var(--muted-foreground, #64748b)", fontSize: "0.875rem", maxWidth: "420px", marginLeft: "auto", marginRight: "auto" }}>
                        {searchQuery || siteStatusFilter !== "all"
                          ? "Try adjusting your search query or filter options."
                          : "No dynamic sites exist. Create your primary or branch site below to enable visitor flows."}
                      </p>
                      <button className="superadmin-btn-primary" style={{ margin: "0 auto" }} onClick={handleOpenCreateSite}>
                        <Plus size={16} /> Create Your First Site
                      </button>
                    </div>
                  ) : (
                    <div className="superadmin-table-container">
                      <table className="superadmin-table">
                        <thead>
                          <tr>
                            <th>Site Name</th>
                            <th>Site Code</th>
                            <th>Location / Address</th>
                            <th>Coordinates</th>
                            <th>Live Visitors</th>
                            <th>Status</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredSites.map(s => (
                            <tr key={s.site_id || s.id}>
                              <td>
                                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                  <div style={{ padding: "6px 8px", background: "rgba(37, 99, 235, 0.15)", color: "#2563eb", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                    <MapPin size={16} />
                                  </div>
                                  <span style={{ fontWeight: 700, color: "var(--foreground, #0f172a)" }}>{s.name}</span>
                                </div>
                              </td>
                              <td>
                                <span style={{ padding: "3px 8px", background: "var(--muted, #f1f5f9)", borderRadius: "6px", fontFamily: "monospace", fontWeight: 700, fontSize: "0.8rem", color: "var(--muted-foreground, #334e68)", border: "1px solid var(--border-color, #e2e8f0)" }}>
                                  {s.code || "—"}
                                </span>
                              </td>
                              <td style={{ maxWidth: "240px", color: "var(--foreground, #475569)" }}>{s.address || "—"}</td>
                              <td style={{ fontSize: "0.8rem", color: "var(--muted-foreground, #64748b)" }}>
                                {s.lat && s.lng ? `${Number(s.lat).toFixed(4)}, ${Number(s.lng).toFixed(4)}` : "18.5204, 73.8567"}
                              </td>
                              <td>
                                <span style={{ fontWeight: 600, color: s.visitors > 0 ? "#2563eb" : "#64748b" }}>
                                  {s.visitors || 0} active
                                </span>
                              </td>
                              <td>
                                <span className={`superadmin-status ${s.status?.toLowerCase() === "active" ? "active" : "inactive"}`}>
                                  <span className="superadmin-status-dot" /> {s.status || "Active"}
                                </span>
                              </td>
                              <td>
                                <div className="superadmin-action-btns">
                                  <button className="superadmin-icon-btn" title="View Site Details" onClick={() => handleOpenViewSite(s)}>
                                    <Eye size={15} />
                                  </button>
                                  <button className="superadmin-icon-btn" title="Edit Site" onClick={() => handleOpenEditSite(s)}>
                                    <Edit size={15} />
                                  </button>
                                  <button
                                    className="superadmin-icon-btn"
                                    title={s.status?.toLowerCase() === "active" ? "Deactivate Site" : "Activate Site"}
                                    onClick={() => handleToggleSiteStatus(s)}
                                  >
                                    <ToggleLeft size={15} style={{ color: s.status?.toLowerCase() === "active" ? "#10b981" : "#94a3b8" }} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
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
                                  <div style={{ fontWeight: 600, color: "var(--foreground, #102a43)" }}>{v.purpose || v.reason_of_visit || "General Visit"}</div>
                                  <div style={{ fontSize: "0.78rem", color: "var(--muted-foreground, #627d98)" }}>{v.company_name || "Self / N/A"}</div>
                                </td>
                                <td>
                                  <div style={{ fontWeight: 600, color: "var(--foreground, #102a43)" }}>{v.person_to_visit || v.host_name || "N/A"}</div>
                                  <div style={{ fontSize: "0.78rem", color: "var(--muted-foreground, #627d98)" }}>{v.host_department || v.department || ""}</div>
                                </td>
                                <td>
                                  <span className={`superadmin-visitor-status-pill ${getVisitorStatusClass(v.status, v.check_in_time, v.check_out_time)}`}>
                                    {getVisitorStatusLabel(v.status, v.check_in_time, v.check_out_time)}
                                  </span>
                                </td>
                                <td>
                                  <div style={{ fontSize: "0.82rem", color: "var(--foreground, #102a43)" }}>
                                    In: {v.check_in_time ? new Date(v.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Not Checked In"}
                                  </div>
                                  <div style={{ fontSize: "0.78rem", color: "var(--muted-foreground, #627d98)" }}>
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

              {/* USER MANAGEMENT TAB CONTENT */}
              {activeTab === "users" && (
                <div style={{ padding: "1.25rem 1.5rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem", flexWrap: "wrap", gap: "1rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                      <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "#64748b", marginRight: "4px" }}>Role:</span>
                      {["all", "admin", "host", "security"].map(r => (
                        <button
                          key={r}
                          className={`superadmin-status-filter-btn ${userRoleFilter === r ? "active" : ""}`}
                          onClick={() => setUserRoleFilter(r)}
                        >
                          {r === "all" ? "All Roles" : r.charAt(0).toUpperCase() + r.slice(1)}
                        </button>
                      ))}
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "#64748b", marginRight: "4px" }}>Status:</span>
                      {["all", "Active", "Inactive"].map(st => (
                        <button
                          key={st}
                          className={`superadmin-status-filter-btn ${userStatusFilter === st ? "active" : ""}`}
                          onClick={() => setUserStatusFilter(st)}
                        >
                          {st === "all" ? "All Status" : st === "Active" ? "🟢 Active" : "⚪ Inactive"}
                        </button>
                      ))}
                      <button
                        className="superadmin-icon-btn"
                        title="Refresh Users"
                        onClick={fetchUsers}
                        style={{ marginLeft: "8px" }}
                      >
                        <RefreshCw size={15} className={loadingUsers ? "spin" : ""} />
                      </button>
                    </div>
                  </div>

                  {loadingUsers ? (
                    <div style={{ textAlign: "center", padding: "3rem", color: "#64748b" }}>
                      <RefreshCw size={24} className="spin" style={{ margin: "0 auto 0.5rem" }} />
                      <p style={{ margin: 0 }}>Loading user accounts...</p>
                    </div>
                  ) : (
                    <div className="superadmin-table-container">
                      <table className="superadmin-table">
                        <thead>
                          <tr>
                            <th>User</th>
                            <th>Role</th>
                            <th>Department</th>
                            <th>Assigned Site(s)</th>
                            <th>Status</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {usersList
                            .filter(u => {
                              const q = searchQuery.toLowerCase();
                              const name = (u.name || "").toLowerCase();
                              const email = (u.email || "").toLowerCase();
                              const dept = (u.department || "").toLowerCase();
                              const role = (u.role || "").toLowerCase();
                              const sitesStr = Array.isArray(u.sites) ? u.sites.map(s => s.name).join(" ").toLowerCase() : (u.site_name || "").toLowerCase();
                              
                              const matchesSearch = !q || name.includes(q) || email.includes(q) || dept.includes(q) || role.includes(q) || sitesStr.includes(q);
                              const matchesRole = userRoleFilter === "all" || role === userRoleFilter.toLowerCase();
                              const matchesStatus = userStatusFilter === "all" || (u.status || "Active").toLowerCase() === userStatusFilter.toLowerCase();
                              
                              return matchesSearch && matchesRole && matchesStatus;
                            })
                            .map((u, i) => {
                              const sitesLabel = Array.isArray(u.sites) && u.sites.length > 0
                                ? u.sites.map(s => s.name).join(", ")
                                : (u.site_ids === "ALL" ? "All Sites" : (u.site_name || "Unassigned"));

                              return (
                                <tr key={u.id || u.user_id || i}>
                                  <td>
                                    <div className="superadmin-company-cell">
                                      <div className="superadmin-company-icon" style={{ background: "rgba(37, 99, 235, 0.1)", color: "#2563eb", fontWeight: 700 }}>
                                        {(u.name || "U").substring(0, 2).toUpperCase()}
                                      </div>
                                      <div>
                                        <span className="superadmin-company-name">{u.name}</span>
                                        <div style={{ fontSize: "0.78rem", color: "#627d98" }}>{u.email}</div>
                                      </div>
                                    </div>
                                  </td>
                                  <td>
                                    <span style={{
                                      fontSize: "0.78rem",
                                      fontWeight: 600,
                                      padding: "3px 8px",
                                      borderRadius: "4px",
                                      textTransform: "uppercase",
                                      background: u.role === "admin" ? "rgba(124, 58, 237, 0.1)" : (u.role === "superadmin" ? "rgba(220, 38, 38, 0.1)" : "rgba(37, 99, 235, 0.1)"),
                                      color: u.role === "admin" ? "#7c3aed" : (u.role === "superadmin" ? "#dc2626" : "#2563eb")
                                    }}>
                                      {u.role}
                                    </span>
                                  </td>
                                  <td>{u.department || "-"}</td>
                                  <td>
                                    <span className="superadmin-site-badge">
                                      📍 {sitesLabel}
                                    </span>
                                  </td>
                                  <td>
                                    <span className={`superadmin-status ${u.status === "Active" ? "active" : "expired"}`}>
                                      <span className="superadmin-status-dot" /> {u.status || "Active"}
                                    </span>
                                  </td>
                                  <td>
                                    <div className="superadmin-action-btns">
                                      <button
                                        className="superadmin-icon-btn"
                                        title="View User Details"
                                        onClick={() => setSelectedUserForView(u)}
                                      >
                                        <Eye size={15} />
                                      </button>
                                      <button
                                        className="superadmin-icon-btn"
                                        title="Edit User Details"
                                        onClick={() => setSelectedUserForEdit(u)}
                                      >
                                        <Edit size={15} />
                                      </button>
                                      <button
                                        className="superadmin-icon-btn"
                                        title="Change Assigned Site"
                                        onClick={() => setSelectedUserForTransfer(u)}
                                      >
                                        <MapPin size={15} />
                                      </button>
                                      <button
                                        className="superadmin-icon-btn"
                                        title={u.status === "Active" ? "Deactivate User" : "Activate User"}
                                        onClick={() => {
                                          setSelectedUserForStatus(u);
                                          setStatusTarget(u.status === "Active" ? "Inactive" : "Active");
                                        }}
                                      >
                                        {u.status === "Active" ? (
                                          <ToggleLeft size={16} color="#16a34a" />
                                        ) : (
                                          <ToggleLeft size={16} color="#ea580c" style={{ transform: "rotate(180deg)" }} />
                                        )}
                                      </button>
                                      <button
                                        className="superadmin-icon-btn"
                                        title="Reset Password"
                                        onClick={() => setSelectedUserForReset(u)}
                                      >
                                        <Key size={15} color="#7c3aed" />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="superadmin-right-column">
            {/* Traffic Trend */}
            <div className="superadmin-card">
              <div className="superadmin-card-header">
                <div>
                  <h3 className="superadmin-card-title"><BarChart3 size={18} /> Visitor Trends</h3>
                  <div style={{ fontSize: "0.78rem", color: "#64748b", marginTop: "2px" }}>
                    Monthly visitor registrations (Rolling 6 Months)
                  </div>
                </div>
              </div>
              <div className="superadmin-chart-container">
                {currentTrafficData && currentTrafficData.length > 0 && currentTrafficData.some(d => d.visitors > 0) ? (
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart data={currentTrafficData}>
                      <CartesianGrid strokeDasharray="3 3" stroke={chartGridStroke} />
                      <XAxis dataKey="month" tick={{ fontSize: 12, fill: chartTickFill }} />
                      <YAxis tick={{ fontSize: 12, fill: chartTickFill }} allowDecimals={false} />
                      <Tooltip contentStyle={chartTooltipStyle} />
                      <Line type="monotone" dataKey="visitors" stroke="hsl(217, 91%, 60%)" strokeWidth={2.5} dot={{ fill: "hsl(217, 91%, 60%)", r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{ padding: "3rem 1rem", textAlign: "center", color: "#64748b" }}>
                    <BarChart3 size={36} style={{ margin: "0 auto 0.75rem", opacity: 0.4 }} />
                    <p style={{ margin: 0, fontWeight: 500, fontSize: "0.9rem" }}>No visitor activity recorded in the past 6 months.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* MODALS */}
      {activeModal === "company_site" && (
        <CompanySiteModal
          onClose={() => {
            setActiveModal(null);
            fetchSitesList();
            fetchStats();
          }}
        />
      )}
      {activeModal === "roles_permissions" && <RolesPermissionsModal onClose={() => setActiveModal(null)} />}
      {activeModal === "license_manager" && <LicenseModal onClose={() => { setActiveModal(null); fetchStats(); }} />}
      {activeModal === "system_settings" && <SystemSettingsModal onClose={() => setActiveModal(null)} />}
      {activeModal === "role_passwords" && <RolePasswordsModal onClose={() => setActiveModal(null)} />}

      {/* USER MANAGEMENT MODALS */}
      {selectedUserForView && (
        <ViewUserModal user={selectedUserForView} onClose={() => setSelectedUserForView(null)} />
      )}
      {selectedUserForEdit && (
        <EditUserModal
          user={selectedUserForEdit}
          onClose={() => setSelectedUserForEdit(null)}
          onUpdated={(msg) => {
            setActionFeedbackToast(msg);
            setTimeout(() => setActionFeedbackToast(""), 4000);
            fetchUsers();
          }}
        />
      )}
      {selectedUserForTransfer && (
        <TransferSiteModal
          user={selectedUserForTransfer}
          sites={sites}
          onClose={() => setSelectedUserForTransfer(null)}
          onUpdated={(msg) => {
            setActionFeedbackToast(msg);
            setTimeout(() => setActionFeedbackToast(""), 4000);
            fetchUsers();
          }}
        />
      )}
      {selectedUserForStatus && (
        <StatusConfirmModal
          user={selectedUserForStatus}
          targetStatus={statusTarget}
          onClose={() => setSelectedUserForStatus(null)}
          onUpdated={(msg) => {
            setActionFeedbackToast(msg);
            setTimeout(() => setActionFeedbackToast(""), 4000);
            fetchUsers();
          }}
        />
      )}
      {selectedUserForReset && (
        <ResetPasswordModal
          user={selectedUserForReset}
          onClose={() => setSelectedUserForReset(null)}
          onUpdated={(msg) => {
            setActionFeedbackToast(msg);
            setTimeout(() => setActionFeedbackToast(""), 4000);
            fetchUsers();
          }}
        />
      )}

      {/* LICENSE DETAILS MODAL */}
      {showViewLicenseModal && (
        <ViewLicenseModal
          license={currentLicenses[0]}
          licenseDetails={dashboardData.licenseDetails}
          onClose={() => setShowViewLicenseModal(false)}
          onOpenEdit={() => setActiveModal("license_manager")}
        />
      )}

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
      {/* CREATE SITE MODAL */}
      {showCreateSiteModal && (
        <div className="superadmin-modal-overlay" onClick={() => setShowCreateSiteModal(false)}>
          <div className="superadmin-site-modal" onClick={(e) => e.stopPropagation()}>
            <div className="superadmin-visitor-modal-header">
              <h3><MapPin size={20} /> Create New Site</h3>
              <button className="superadmin-close-btn" onClick={() => setShowCreateSiteModal(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateSite} className="superadmin-modal-form">
              {siteFormError && (
                <div style={{ padding: "10px 14px", borderRadius: "8px", background: "#fee2e2", color: "#b91c1c", fontSize: "0.875rem", marginBottom: "1rem", border: "1px solid #fca5a5" }}>
                  ⚠️ {siteFormError}
                </div>
              )}
              <div className="superadmin-form-grid">
                <div className="superadmin-form-group full-width">
                  <label>Site Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Pune Central Office, Mumbai Campus"
                    value={siteFormData.name}
                    onChange={(e) => setSiteFormData({ ...siteFormData, name: e.target.value })}
                  />
                </div>
                <div className="superadmin-form-group">
                  <label>Site Code (Unique)</label>
                  <input
                    type="text"
                    placeholder="e.g. PUNE-01 (Auto-generated if empty)"
                    value={siteFormData.code}
                    onChange={(e) => setSiteFormData({ ...siteFormData, code: e.target.value.toUpperCase() })}
                  />
                </div>
                <div className="superadmin-form-group">
                  <label>Status</label>
                  <select
                    value={siteFormData.status}
                    onChange={(e) => setSiteFormData({ ...siteFormData, status: e.target.value })}
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
                <div className="superadmin-form-group full-width">
                  <label>Location / Address *</label>
                  <textarea
                    required
                    placeholder="Physical street address or premises description"
                    value={siteFormData.address}
                    onChange={(e) => setSiteFormData({ ...siteFormData, address: e.target.value })}
                  />
                </div>
                <div className="superadmin-form-group">
                  <label>Latitude</label>
                  <input
                    type="text"
                    placeholder="e.g. 18.5204"
                    value={siteFormData.lat}
                    onChange={(e) => setSiteFormData({ ...siteFormData, lat: e.target.value })}
                  />
                </div>
                <div className="superadmin-form-group">
                  <label>Longitude</label>
                  <input
                    type="text"
                    placeholder="e.g. 73.8567"
                    value={siteFormData.lng}
                    onChange={(e) => setSiteFormData({ ...siteFormData, lng: e.target.value })}
                  />
                </div>
              </div>
              <div className="superadmin-modal-footer-btns">
                <button type="button" className="superadmin-btn-secondary" onClick={() => setShowCreateSiteModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="superadmin-btn-primary" disabled={siteFormSubmitting}>
                  {siteFormSubmitting ? "Creating Site..." : "Create Site"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT SITE MODAL */}
      {showEditSiteModal && selectedSiteForEdit && (
        <div className="superadmin-modal-overlay" onClick={() => setShowEditSiteModal(false)}>
          <div className="superadmin-site-modal" onClick={(e) => e.stopPropagation()}>
            <div className="superadmin-visitor-modal-header">
              <h3><Edit size={20} /> Edit Site: {selectedSiteForEdit.name}</h3>
              <button className="superadmin-close-btn" onClick={() => setShowEditSiteModal(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleUpdateSite} className="superadmin-modal-form">
              {siteFormError && (
                <div style={{ padding: "10px 14px", borderRadius: "8px", background: "#fee2e2", color: "#b91c1c", fontSize: "0.875rem", marginBottom: "1rem", border: "1px solid #fca5a5" }}>
                  ⚠️ {siteFormError}
                </div>
              )}
              <div className="superadmin-form-grid">
                <div className="superadmin-form-group full-width">
                  <label>Site Name *</label>
                  <input
                    type="text"
                    required
                    value={siteFormData.name}
                    onChange={(e) => setSiteFormData({ ...siteFormData, name: e.target.value })}
                  />
                </div>
                <div className="superadmin-form-group">
                  <label>Site Code (Unique)</label>
                  <input
                    type="text"
                    value={siteFormData.code}
                    onChange={(e) => setSiteFormData({ ...siteFormData, code: e.target.value.toUpperCase() })}
                  />
                </div>
                <div className="superadmin-form-group">
                  <label>Status</label>
                  <select
                    value={siteFormData.status}
                    onChange={(e) => setSiteFormData({ ...siteFormData, status: e.target.value })}
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
                <div className="superadmin-form-group full-width">
                  <label>Location / Address *</label>
                  <textarea
                    required
                    value={siteFormData.address}
                    onChange={(e) => setSiteFormData({ ...siteFormData, address: e.target.value })}
                  />
                </div>
                <div className="superadmin-form-group">
                  <label>Latitude</label>
                  <input
                    type="text"
                    value={siteFormData.lat}
                    onChange={(e) => setSiteFormData({ ...siteFormData, lat: e.target.value })}
                  />
                </div>
                <div className="superadmin-form-group">
                  <label>Longitude</label>
                  <input
                    type="text"
                    value={siteFormData.lng}
                    onChange={(e) => setSiteFormData({ ...siteFormData, lng: e.target.value })}
                  />
                </div>
              </div>
              <div className="superadmin-modal-footer-btns">
                <button type="button" className="superadmin-btn-secondary" onClick={() => setShowEditSiteModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="superadmin-btn-primary" disabled={siteFormSubmitting}>
                  {siteFormSubmitting ? "Saving Changes..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW SITE DETAILS MODAL */}
      {showViewSiteModal && selectedSiteForView && (
        <div className="superadmin-modal-overlay" onClick={() => setShowViewSiteModal(false)}>
          <div className="superadmin-site-modal" onClick={(e) => e.stopPropagation()}>
            <div className="superadmin-visitor-modal-header">
              <h3><MapPin size={20} /> Site Details</h3>
              <button className="superadmin-close-btn" onClick={() => setShowViewSiteModal(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="superadmin-modal-form">
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "1.25rem", paddingBottom: "1rem", borderBottom: "1px solid var(--border-color, #f1f5f9)" }}>
                <div style={{ padding: "10px", background: "rgba(37, 99, 235, 0.15)", color: "#2563eb", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Building size={24} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 700, color: "var(--foreground, #0f172a)" }}>{selectedSiteForView.name}</h3>
                  <span style={{ fontSize: "0.85rem", color: "var(--muted-foreground, #64748b)" }}>Code: {selectedSiteForView.code || "N/A"}</span>
                </div>
              </div>
              <div className="superadmin-modal-info-grid">
                <div className="superadmin-info-item">
                  <span className="superadmin-info-label">Site ID</span>
                  <span className="superadmin-info-val">#{selectedSiteForView.site_id || selectedSiteForView.id}</span>
                </div>
                <div className="superadmin-info-item">
                  <span className="superadmin-info-label">Operational Status</span>
                  <span className="superadmin-info-val">
                    <span className={`superadmin-status ${selectedSiteForView.status?.toLowerCase() === "active" ? "active" : "inactive"}`} style={{ display: "inline-flex" }}>
                      <span className="superadmin-status-dot" /> {selectedSiteForView.status || "Active"}
                    </span>
                  </span>
                </div>
                <div className="superadmin-info-item" style={{ gridColumn: "1 / -1" }}>
                  <span className="superadmin-info-label">Location / Address</span>
                  <span className="superadmin-info-val">📍 {selectedSiteForView.address || "N/A"}</span>
                </div>
                <div className="superadmin-info-item">
                  <span className="superadmin-info-label">Coordinates</span>
                  <span className="superadmin-info-val">
                    {selectedSiteForView.lat && selectedSiteForView.lng 
                      ? `${selectedSiteForView.lat}, ${selectedSiteForView.lng}` 
                      : "18.5204, 73.8567"}
                  </span>
                </div>
                <div className="superadmin-info-item">
                  <span className="superadmin-info-label">Current Live Visitors</span>
                  <span className="superadmin-info-val">{selectedSiteForView.visitors || 0} active</span>
                </div>
              </div>
              <div className="superadmin-modal-footer-btns">
                <button
                  type="button"
                  className="superadmin-btn-secondary"
                  onClick={() => setShowViewSiteModal(false)}
                >
                  Close
                </button>
                <button
                  type="button"
                  className="superadmin-btn-primary"
                  onClick={() => {
                    setShowViewSiteModal(false);
                    handleOpenEditSite(selectedSiteForView);
                  }}
                >
                  <Edit size={15} /> Edit Site
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuperAdminDashboard;