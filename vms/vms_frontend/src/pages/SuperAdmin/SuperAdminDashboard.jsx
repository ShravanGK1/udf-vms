import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../../components/Navbar/Navbar";
import StatCard from "../../components/StatCard/StatCard";
import apiClient from "../../app/apiClient";
import { Building, Users, Shield, Settings, Server, Globe, Key, Activity, ChevronRight, Search, Eye, Edit, ToggleLeft, BarChart3, FileText, AlertTriangle } from "lucide-react";
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

  const handleCardClick = (title) => {
    if (title === "Company & Site Master") {
      setActiveModal("company_site");
    } else if (title === "Roles & Permissions") {
      setActiveModal("roles_permissions");
    } else if (title === "License Manager") {
      setActiveModal("license_manager");
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
                  <button className={`superadmin-tab ${activeTab === "audit" ? "active" : ""}`} onClick={() => setActiveTab("audit")}>
                    <FileText size={16} /> Audit Logs
                  </button>
                </div>
                <div className="superadmin-search-box">
                  <Search size={16} />
                  <input type="text" placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
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
    </div>
  );
};

export default SuperAdminDashboard;