import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import API from "../../app/apiClient";
import Navbar from "../../components/Navbar/Navbar";
import StatCard from "../../components/StatCard/StatCard";
import VisitorPassForm from "../../components/forms/forms/VisitorPassForm";
import CameraModal from "../../components/modals/CameraModal";
import { 
  Users, UserCheck, Clock, AlertTriangle, Plus, Search, Building, 
  ChevronRight, ChevronDown, BarChart3, MapPin, Download, Camera, X, Shield, 
  RefreshCw, Eye, Edit, Printer, Phone, Mail, Laptop, Car, FileText, 
  Briefcase, CheckCircle 
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import "../SecurtiyDashboard/SecurityDashboard.css";
import "./AdminDashboard.css";


const AdminDashboard = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("users");
  const [visitorSubTab, setVisitorSubTab] = useState("live_visitors");
  const [showWeeklyChart, setShowWeeklyChart] = useState(false);
  const [showPurposeChart, setShowPurposeChart] = useState(false);
  const [users, setUsers] = useState([]);
  const [sites, setSites] = useState([]);
  const [visitData, setVisitData] = useState([]);
  const [purposeData, setPurposeData] = useState([]);
  const COLORS = ["#2563eb", "#7c3aed", "#0891b2", "#f59e0b"];
  const [stats, setStats] = useState({
    users: 0,
    visitors: 0,
    pending: 0,
    alerts: 0
  });
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [newUser, setNewUser] = useState({
    name: "",
    email: "",
    password: "",
    role: "host",
    department: "",
    photo: null
  });
  const navigate = useNavigate();

  const [showMusterModal, setShowMusterModal] = useState(false);
  const [musterEmployees, setMusterEmployees] = useState([]);
  const [isLoadingMuster, setIsLoadingMuster] = useState(false);
  const [liveVisitors, setLiveVisitors] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [expectedVisitors, setExpectedVisitors] = useState([]);
  const [expiredVisits, setExpiredVisits] = useState([]);
  const [expiredFilter, setExpiredFilter] = useState("all");
  const [showCamera, setShowCamera] = useState(false);
  const [currentRequestId, setCurrentRequestId] = useState(null);
  const [showVisitorForm, setShowVisitorForm] = useState(false);
  const [selectedRequestId, setSelectedRequestId] = useState(null);
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [showIDCardModal, setShowIDCardModal] = useState(false);
  const [idCardData, setIdCardData] = useState(null);
  const [isLoadingIDCard, setIsLoadingIDCard] = useState(false);
  const [manualCheckouts, setManualCheckouts] = useState({});

  // Hover card preview state
  const [hoveredVisitor, setHoveredVisitor] = useState(null);
  const [hoverCardPos, setHoverCardPos] = useState({ top: 0, left: 0 });
  const hoverTimeoutRef = useRef(null);
  const dropdownTimeoutRef = useRef(null);

  const handleDropdownMouseEnter = () => {
    if (dropdownTimeoutRef.current) clearTimeout(dropdownTimeoutRef.current);
    setShowVisitorDropdown(true);
  };

  const handleDropdownMouseLeave = () => {
    dropdownTimeoutRef.current = setTimeout(() => {
      setShowVisitorDropdown(false);
    }, 250);
  };

  const [remoteUsers, setRemoteUsers] = useState([]);
  const [selectedUserForRemote, setSelectedUserForRemote] = useState(null);
  const [remotePassword, setRemotePassword] = useState("");
  const [remoteSuccess, setRemoteSuccess] = useState("");
  const [remoteError, setRemoteError] = useState("");
  const [authorizingRemote, setAuthorizingRemote] = useState(false);

  const handleMouseEnterVisitor = (v, event) => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    const rect = event.currentTarget.getBoundingClientRect();
    const cardWidth = 380;
    const cardHeight = 360;
    
    let left = rect.left + window.scrollX;
    if (left + cardWidth > window.innerWidth - 20) {
      left = window.innerWidth - cardWidth - 20;
    }
    if (left < 20) left = 20;

    let top = rect.bottom + window.scrollY + 8;
    if (rect.bottom + cardHeight > window.innerHeight && rect.top - cardHeight > 0) {
      top = rect.top + window.scrollY - cardHeight - 8;
    }

    setHoverCardPos({ top, left });
    setHoveredVisitor(v);
  };

  const handleMouseLeaveVisitor = () => {
    hoverTimeoutRef.current = setTimeout(() => {
      setHoveredVisitor(null);
    }, 150);
  };

  const handleCardMouseEnter = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
  };

  const handleCardMouseLeave = () => {
    hoverTimeoutRef.current = setTimeout(() => {
      setHoveredVisitor(null);
    }, 150);
  };

  const fetchSecurityData = async () => {
    try {
      const [liveRes, pendingRes, expectedRes, expiredRes] = await Promise.all([
        API.get("/security/live-visitors"),
        API.get("/security/pending-requests"),
        API.get("/security/expected-visitors"),
        API.get(`/security/expired-visits?filter=${expiredFilter}`)
      ]);
      setLiveVisitors(liveRes.data);
      setPendingRequests(pendingRes.data);
      setExpectedVisitors(expectedRes.data);
      setExpiredVisits(expiredRes.data);
    } catch (err) {
      console.error("Visitor API error:", err);
    }
  };

  const handleApprove = async (id) => {
    try {
      const user = JSON.parse(sessionStorage.getItem("user") || "{}");
      await API.post(`/security/approve-request/${id}`, {
        approved_by: user.user_id
      });
      fetchSecurityData();
      fetchStats();
    } catch (err) {
      console.error("Approve error:", err);
    }
  };

  const handleReject = async (id) => {
    try {
      const user = JSON.parse(sessionStorage.getItem("user") || "{}");
      await API.post(`/security/reject-request/${id}`, {
        approved_by: user.user_id
      });
      fetchSecurityData();
      fetchStats();
    } catch (err) {
      console.error("Reject error:", err);
    }
  };

  const handleCheckin = async (id) => {
    try {
      await API.post(`/security/checkin/${id}`);
      fetchSecurityData();
      fetchStats();
    } catch (err) {
      console.error("Checkin error:", err);
    }
  };

  const handleCheckout = async (id) => {
    try {
      const payload = {};
      if (manualCheckouts[id] !== undefined) {
        const timeInput = manualCheckouts[id];
        if (!timeInput) {
          alert("Please enter a manual check-out time.");
          return;
        }

        const match = timeInput.match(/^(\d{2}):(\d{2})\s(AM|PM)$/);
        if (!match) {
          alert("Please enter a valid check-out time.");
          return;
        }

        let hours = Number(match[1]);
        const minutes = Number(match[2]);
        const ampm = match[3];

        if (ampm === "PM" && hours < 12) {
          hours += 12;
        } else if (ampm === "AM" && hours === 12) {
          hours = 0;
        }

        const today = new Date();
        const enteredDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), hours, minutes, 0, 0);
        
        if (enteredDate > today) {
          alert("Manual check-out time cannot be in the future!");
          return;
        }
        
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        const localDateStr = `${yyyy}-${mm}-${dd}`;
        const combinedDateTimeStr = `${localDateStr}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
        
        payload.manualCheckOutTime = combinedDateTimeStr;
      }

      await API.post(`/security/checkout/${id}`, payload);

      if (manualCheckouts[id] !== undefined) {
        setManualCheckouts(prev => {
          const updated = { ...prev };
          delete updated[id];
          return updated;
        });
      }

      fetchSecurityData();
      fetchStats();
    } catch (err) {
      console.error("Checkout error:", err);
    }
  };

  const handleTempCheckout = async (id) => {
    try {
      await API.post(`/security/temp-checkout/${id}`);
      fetchSecurityData();
    } catch (err) {
      console.error("Temp Checkout error:", err);
    }
  };

  const handleTempCheckin = async (id) => {
    try {
      await API.post(`/security/temp-checkin/${id}`);
      fetchSecurityData();
    } catch (err) {
      console.error("Temp Checkin error:", err);
    }
  };

  const handleOpenIDCard = async (requestId) => {
    setIsLoadingIDCard(true);
    setShowIDCardModal(true);
    setIdCardData(null);
    try {
      const res = await API.get(`/security/requests/${requestId}`);
      if (res.data) {
        setIdCardData(res.data);
      }
    } catch (err) {
      console.error("Error loading ID card data:", err);
      alert("Error loading visitor details.");
      setShowIDCardModal(false);
    } finally {
      setIsLoadingIDCard(false);
    }
  };

  const handlePrintIDCard = () => {
    if (!idCardData) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Please allow popups to print the visitor ID card.");
      return;
    }
    
    const initials = (idCardData.name || "V")
      .split(" ")
      .map(n => n[0])
      .join("")
      .substring(0, 2)
      .toUpperCase();

    const footerBg = idCardData.accessLevel === "5" ? "#ef4444" : (idCardData.accessLevel === "3" ? "#3b82f6" : "#10b981");
    const footerText = idCardData.accessLevel === "5" ? "ADMIN" : (idCardData.accessLevel === "3" ? "SECURITY" : "APPROVED VISITOR");

    printWindow.document.write(`
      <html>
        <head>
          <title>Visitor Pass - ${idCardData.name}</title>
          <style>
            @page { size: 85mm 140mm; margin: 0; }
            body { margin: 0; padding: 0; width: 85mm; height: 140mm; display: flex; justify-content: center; align-items: center; background-color: #ffffff; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .card { width: 78mm; min-height: 130mm; height: auto; box-sizing: border-box; border: 1px solid #cbd5e1; border-radius: 8mm; background: #ffffff; display: flex; flex-direction: column; padding: 6mm 6mm 14mm 6mm; position: relative; overflow: hidden; }
            .top-row { width: 100%; display: flex; justify-content: space-between; align-items: center; margin-bottom: 4mm; }
            .left-col { display: flex; flex-direction: column; }
            .name { font-size: 5.5mm; font-weight: 800; color: #1e3a8a; margin: 0; }
            .role { font-size: 3.2mm; font-weight: 600; color: #64748b; margin-top: 1mm; }
            .avatar-box { width: 18mm; height: 18mm; border-radius: 4px; overflow: hidden; background: #dbeafe; display: flex; justify-content: center; align-items: center; border: 1px solid #bfdbfe; }
            .avatar-img { width: 100%; height: 100%; object-fit: cover; }
            .avatar-init { font-size: 8mm; font-weight: 700; color: #1e3a8a; }
            .divider { width: 100%; height: 1px; background-color: #cbd5e1; margin: 3mm 0; }
            .rows { width: 100%; display: flex; flex-direction: column; gap: 2mm; }
            .row { width: 100%; display: flex; justify-content: space-between; align-items: center; }
            .label { font-size: 2.8mm; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.3px; }
            .val { font-size: 2.8mm; font-weight: 800; color: #1e293b; }
            .footer-tag { width: 100%; height: 8mm; color: #ffffff; font-size: 2.8mm; font-weight: 700; display: flex; justify-content: center; align-items: center; text-transform: uppercase; letter-spacing: 1px; position: absolute; bottom: 0; left: 0; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="top-row">
              <div class="left-col">
                <h2 class="name">${idCardData.name}</h2>
                <span class="role">Visitor</span>
              </div>
              <div class="avatar-box">
                ${idCardData.photo 
                  ? `<img src="/${idCardData.photo}" class="avatar-img" alt="Photo" />` 
                  : `<div class="avatar-init">${initials}</div>`
                }
              </div>
            </div>
            
            <div class="divider"></div>

            <div class="rows">
              <div class="row">
                <span class="label">PASS ID</span>
                <span class="val">V-${idCardData.request_id}</span>
              </div>
              <div class="row">
                <span class="label">HOST NAME</span>
                <span class="val">${idCardData.personToVisit || "-"}</span>
              </div>
              <div class="row">
                <span class="label">ACCESS LEVEL</span>
                <span class="val">${idCardData.accessLevel === "5" ? "Admin (Level 5)" : (idCardData.accessLevel === "3" ? "Security (Level 3)" : "Visitor (Level 1)")}</span>
              </div>
            </div>

            <div class="divider"></div>

            <div class="rows">
              <div class="row">
                <span class="label">TIME IN</span>
                <span class="val">${idCardData.checkInTime || "-"}</span>
              </div>
              <div class="row">
                <span class="label">TIME OUT</span>
                <span class="val">${idCardData.checkOutTime || "-"}</span>
              </div>
            </div>

            <div class="divider"></div>

            <div class="rows">
              <div class="row">
                <span class="label">HAS DEVICE</span>
                <span class="val">${idCardData.hasDevice || "No"}</span>
              </div>
              ${idCardData.hasDevice === "Yes" ? `
                <div class="row">
                  <span class="label">DEVICE TYPE</span>
                  <span class="val">${idCardData.deviceType || "-"}</span>
                </div>
                <div class="row">
                  <span class="label">DEVICE MAKE</span>
                  <span class="val">${idCardData.deviceMake || "-"}</span>
                </div>
                <div class="row">
                  <span class="label">SERIAL NO</span>
                  <span class="val">${idCardData.deviceSerialNumber || "-"}</span>
                </div>
              ` : ''}
              <div class="row">
                <span class="label">HAS MATERIAL</span>
                <span class="val">${idCardData.hasMaterial || "No"}</span>
              </div>
            </div>

            <div class="footer-tag" style="background: ${footerBg};">
              ${footerText}
            </div>
          </div>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const uploadCapturedPhoto = async (file) => {
    try {
      const formData = new FormData();
      formData.append("photo", file);

      await API.post(
        `/security/upload-photo/${currentRequestId}`,
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" }
        }
      );

      alert("✅ Photo Uploaded!");
      setShowCamera(false);
      fetchSecurityData();
    } catch (err) {
      console.error(err);
      alert("❌ Upload failed");
    }
  };

  const getStatusClass = (status) => {
    switch (status) {
      case "Inside": return "inside";
      case "Temp Out": return "temp-out";
      case "Overstay": return "overstay";
      case "Checked Out": return "checked-out";
      default: return "";
    }
  };

  const handleOpenMuster = async () => {
    setIsLoadingMuster(true);
    setShowMusterModal(true);
    try {
      const visitorsRes = await API.get("/security/live-visitors");
      setLiveVisitors(visitorsRes.data);
      
      const usersRes = await API.get("/admin/users");
      const activeEmployees = usersRes.data.filter(u => u.status.toLowerCase() === "active");
      setMusterEmployees(activeEmployees);
    } catch (err) {
      console.error("Error loading muster data:", err);
    } finally {
      setIsLoadingMuster(false);
    }
  };

  const handleExportCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "EMERGENCY MUSTER ROLL\n";
    csvContent += `Generated at: ${new Date().toLocaleString()}\n\n`;
    
    csvContent += "VISITORS ON PREMISES\n";
    csvContent += "Badge No,Visitor Name,Company,Host,Check-in Time,Access Level\n";
    liveVisitors.forEach(v => {
      csvContent += `"${v.badge || ''}","${v.name || ''}","${v.company || ''}","${v.host || ''}","${v.checkIn || ''}","${v.access_level || ''}"\n`;
    });
    
    csvContent += "\n";
    csvContent += "ACTIVE EMPLOYEES ON PREMISES\n";
    csvContent += "Employee ID,Name,Department,Role,Email\n";
    musterEmployees.forEach(emp => {
      csvContent += `"${emp.id || ''}","${emp.name || ''}","${emp.department || ''}","${emp.role || ''}","${emp.email || ''}"\n`;
    });
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Emergency_Muster_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const handleDownloadPDF = () => {
    const visitorRows = liveVisitors.map((v, i) => `
      <tr>
        <td>${v.badge || `V-${v.request_id}`}</td>
        <td>${v.name || "-"}</td>
        <td>${v.company || "-"}</td>
        <td>${v.host || "-"}</td>
        <td>${v.checkIn || "-"}</td>
        <td>${v.access_level || "-"}</td>
      </tr>
    `).join("");

    const employeeRows = musterEmployees.map((emp) => `
      <tr>
        <td>${emp.id || "-"}</td>
        <td>${emp.name || "-"}</td>
        <td>${emp.department || "-"}</td>
        <td>${emp.role || "-"}</td>
        <td>${emp.email || "-"}</td>
      </tr>
    `).join("");

    const html = `
    <html>
      <head>
        <title>Emergency Muster Roll - ${new Date().toLocaleDateString()}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; color: #1e293b; }
          .header { text-align: center; margin-bottom: 20px; border-bottom: 3px double #ef4444; padding-bottom: 15px; }
          .header h1 { color: #ef4444; font-size: 26px; margin: 0 0 5px 0; text-transform: uppercase; }
          .header p { margin: 0; color: #64748b; font-size: 14px; }
          .meta { display: flex; justify-content: space-between; margin-bottom: 20px; font-size: 12px; font-weight: bold; background: #f1f5f9; padding: 8px 12px; border-radius: 4px; }
          h2 { font-size: 16px; margin: 20px 0 10px 0; border-bottom: 2px solid #cbd5e1; padding-bottom: 5px; color: #0f172a; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: left; font-size: 11px; }
          th { background-color: #f8fafc; font-weight: bold; }
          tr:nth-child(even) { background-color: #f8fafc; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Emergency Muster Roll</h1>
          <p>Live Evacuation & Accountability List</p>
        </div>
        <div class="meta">
          <span>GENERATED: ${new Date().toLocaleString()}</span>
          <span>STATUS: ACTIVE EVACUATION</span>
        </div>
        
        <h2>1. Visitors on Premises (${liveVisitors.length})</h2>
        <table>
          <thead>
            <tr>
              <th>Badge No</th>
              <th>Visitor Name</th>
              <th>Company</th>
              <th>Host (Employee)</th>
              <th>Check-in Time</th>
              <th>Access Level</th>
            </tr>
          </thead>
          <tbody>
            ${visitorRows.length ? visitorRows : '<tr><td colspan="6" style="text-align:center;">No visitors currently checked in.</td></tr>'}
          </tbody>
        </table>

        <h2>2. Active Employees on Premises (${musterEmployees.length})</h2>
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Employee Name</th>
              <th>Department</th>
              <th>Role</th>
              <th>Email</th>
            </tr>
          </thead>
          <tbody>
            ${employeeRows.length ? employeeRows : '<tr><td colspan="5" style="text-align:center;">No active employees found.</td></tr>'}
          </tbody>
        </table>
      </body>
    </html>
  `;

    const newWindow = window.open("", "_blank");
    newWindow.document.write(html);
    newWindow.document.close();
    newWindow.print();
  };

  const fetchUsers = async () => {
    try {
      const res = await API.get("/admin/users");
      setUsers(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchSites = async () => {
    try {
      const res = await API.get("/admin/sites");
      setSites(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await API.get("/admin/stats");
      setStats(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchCharts = async () => {
    try {
      const res = await API.get("/admin/charts");
      setVisitData(res.data.visitData);
      setPurposeData(res.data.purposeData);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAdminPhoto = async (e, user_id) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const formData = new FormData();
      formData.append("photo", file);

      const res = await API.post("/upload-photo", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });

      const image_url = res.data.image_url;
      await API.put(`/update-user-photo/${user_id}`, {
        photo_url: image_url
      });

      alert("✅ Photo Updated");
      fetchUsers();
    } catch (err) {
      console.error(err);
      alert("❌ Upload failed");
    }
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append("name", newUser.name);
    formData.append("email", newUser.email);
    formData.append("password", newUser.password);
    formData.append("role", newUser.role);
    formData.append("department", newUser.department);
    if (newUser.photo) {
      formData.append("photo", newUser.photo);
    }

    try {
      await API.post("/admin/add-user", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      alert("✅ User Created Successfully");
      setShowAddUserModal(false);
      setNewUser({ name: "", email: "", password: "", role: "host", department: "", photo: null });
      fetchUsers();
      fetchStats();
    } catch (err) {
      console.error(err);
      alert("❌ Failed to create user");
    }
  };

  const fetchRemoteUsers = async () => {
    try {
      const res = await API.get("/admin/users-list");
      setRemoteUsers(res.data);
    } catch (err) {
      console.error("Error fetching remote users:", err);
    }
  };

  const handleRemoteLoginSubmit = async (e) => {
    e.preventDefault();
    if (!selectedUserForRemote || !remotePassword) return;
    try {
      setAuthorizingRemote(true);
      setRemoteError("");
      setRemoteSuccess("");
      await API.post("/admin/remote-login", {
        user_id: selectedUserForRemote.user_id,
        password: remotePassword
      });
      setRemoteSuccess(`✅ Remote session authorized for ${selectedUserForRemote.name}! Respective system will log in automatically.`);
      setRemotePassword("");
      setSelectedUserForRemote(null);
      setTimeout(() => setRemoteSuccess(""), 5000);
      fetchRemoteUsers();
    } catch (err) {
      setRemoteError(err.response?.data?.error || "❌ Failed to authorize remote login.");
    } finally {
      setAuthorizingRemote(false);
    }
  };

  useEffect(() => {
    fetchSites();
    fetchStats();
    fetchCharts();
    fetchUsers();
    fetchSecurityData();
    const interval = setInterval(() => {
      fetchSecurityData();
    }, 5000);
    return () => clearInterval(interval);
  }, [expiredFilter]);

  useEffect(() => {
    if (activeTab === "remote_sessions") {
      fetchRemoteUsers();
    }
  }, [activeTab]);

  const loggedInUser = JSON.parse(sessionStorage.getItem("user") || "{}");

  return (
    <div className="admin-dashboard">
      <Navbar role={loggedInUser.role || "admin"} userName={loggedInUser.name || "Admin User"} />
      <div className="admin-main-content">
        {/* HEADER */}
        <div className="admin-page-header">
          <div>
            <h1 className="admin-title">Admin Dashboard</h1>
            <p className="admin-subtitle">Manage users, sites, and monitor visitor activity</p>
          </div>
          <div className="admin-header-actions">
            <button className="admin-btn-secondary" onClick={() => navigate("/export")}>
              <Download size={16} /> Export Report
            </button>
            <button className="admin-btn-primary" style={{ backgroundColor: '#ef4444' }} onClick={handleOpenMuster}>
              <AlertTriangle size={16} /> Visitor Muster
            </button>
            <button className="admin-btn-primary" onClick={() => setShowAddUserModal(true)}>
              <Plus size={16} /> Add User
            </button>
          </div>
        </div>

        {/* STATS */}
        <div className="admin-stats-grid">
          <StatCard label="Total Users" value={stats.users} icon={<Users size={22} />} iconBg="hsl(217, 91%, 60%, 0.1)" iconColor="hsl(217, 91%, 60%)" trend={{ value: "12% this month", positive: true }} />
          <StatCard label="Active Visitors" value={stats.visitors} icon={<UserCheck size={22} />} iconBg="hsl(152, 81%, 90%)" iconColor="hsl(164, 86%, 20%)" trend={{ value: "8% today", positive: true }} />
          <StatCard label="Pending Approvals" value={stats.pending} icon={<Clock size={22} />} iconBg="hsl(48, 96%, 89%)" iconColor="hsl(26, 90%, 31%)" trend={{ value: "3 urgent", positive: false }} />
          <StatCard label="Security Alerts" value={stats.alerts} icon={<AlertTriangle size={22} />} iconBg="hsl(0, 93%, 94%)" iconColor="hsl(0, 72%, 51%)" trend={{ value: "2 resolved", positive: true }} />
        </div>

        {/* CHARTS TOGGLES */}
        <div className="admin-chart-toggles" style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
          <button
            className={`admin-btn-secondary ${showWeeklyChart ? 'active' : ''}`}
            onClick={() => setShowWeeklyChart(!showWeeklyChart)}
            style={{ flex: 1, justifyContent: 'center', background: showWeeklyChart ? 'rgba(37, 99, 235, 0.1)' : '', borderColor: showWeeklyChart ? '#2563eb' : '' }}
          >
            <BarChart3 size={18} /> {showWeeklyChart ? 'Hide Weekly Visitors' : 'Show Weekly Visitors'}
          </button>
          <button
            className={`admin-btn-secondary ${showPurposeChart ? 'active' : ''}`}
            onClick={() => setShowPurposeChart(!showPurposeChart)}
            style={{ flex: 1, justifyContent: 'center', background: showPurposeChart ? 'rgba(37, 99, 235, 0.1)' : '', borderColor: showPurposeChart ? '#2563eb' : '' }}
          >
            <PieChart size={18} /> {showPurposeChart ? 'Hide Visit Purpose' : 'Show Visit Purpose'}
          </button>
        </div>

        {/* EXPANDED CHARTS */}
        {(showWeeklyChart || showPurposeChart) && (
          <div className="admin-expanded-charts" style={{ display: 'grid', gridTemplateColumns: showWeeklyChart && showPurposeChart ? '1fr 1fr' : '1fr', gap: '2rem', marginBottom: '2rem' }}>
            {showWeeklyChart && (
              <div className="admin-card">
                <div className="admin-card-header">
                  <h3 className="admin-card-title"><BarChart3 size={18} /> Weekly Visitors</h3>
                </div>
                <div className="admin-chart-container">
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={visitData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 32%, 91%)" />
                      <XAxis dataKey="day" tick={{ fontSize: 12, fill: "hsl(215, 16%, 47%)" }} />
                      <YAxis tick={{ fontSize: 12, fill: "hsl(215, 16%, 47%)" }} allowDecimals={false} />
                      <Tooltip contentStyle={{ borderRadius: "0.5rem", border: "1px solid hsl(214, 32%, 91%)" }} />
                      <Bar dataKey="visitors" fill="hsl(217, 91%, 60%)" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
            {showPurposeChart && (
              <div className="admin-card">
                <div className="admin-card-header">
                  <h3 className="admin-card-title">Visit Purpose</h3>
                </div>
                <div className="admin-chart-container">
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={purposeData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={4} dataKey="value">
                        {purposeData.map((entry, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Legend iconType="circle" wrapperStyle={{ fontSize: "0.8rem" }} />
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>
        )}

        {/* DATA GRID */}
        <div className="admin-dashboard-grid">
          <div className="admin-left-column">
            <div className="admin-card">
              <div className="admin-card-header">
                <div className="admin-tabs" style={{ flexWrap: 'wrap', gap: '0.35rem' }}>
                  <button className={`admin-tab ${activeTab === "users" ? "active" : ""}`} onClick={() => setActiveTab("users")}>
                    <Users size={16} /> User Management
                  </button>
                  <button className={`admin-tab ${activeTab === "visitors" ? "active" : ""}`} onClick={() => setActiveTab("visitors")}>
                    <Users size={16} /> Visitors ({liveVisitors.filter(v => v.status !== "Checked Out").length + pendingRequests.length + expectedVisitors.length})
                  </button>
                  <button className={`admin-tab ${activeTab === "sites" ? "active" : ""}`} onClick={() => setActiveTab("sites")}>
                    <Building size={16} /> Sites
                  </button>
                  <button className={`admin-tab ${activeTab === "remote_sessions" ? "active" : ""}`} onClick={() => setActiveTab("remote_sessions")}>
                    <RefreshCw size={16} /> Remote Sessions
                  </button>
                </div>
                <div className="admin-search-box">
                  <Search size={16} />
                  <input type="text" placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                </div>
              </div>

              {/* USER TAB CONTENT */}
              {activeTab === "users" && (
                <div className="admin-table-container">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Role</th>
                        <th>Department</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.filter(u => (u.name || "").toLowerCase().includes(searchQuery.toLowerCase())).map(user => (
                        <tr key={user.id}>
                          <td>
                            <div className="admin-user-cell">
                              <div className="admin-avatar-wrapper">
                                <div className="admin-user-avatar">
                                  {user.profile_photo ? (
                                    <img src={user.profile_photo} alt="user" className="admin-avatar-img" />
                                  ) : (
                                    (user.name || "U").split(" ").map(n => n[0]).join("")
                                  )}
                                </div>
                                <div className="admin-camera-icon" onClick={() => document.getElementById(`admin-${user.id}`).click()}>
                                  <Camera size={12} color="white" />
                                </div>
                                <input id={`admin-${user.id}`} type="file" accept="image/*" className="hidden-input" onChange={(e) => handleAdminPhoto(e, user.id)} />
                              </div>
                              <div>
                                <div className="admin-user-cell-name">{user.name}</div>
                                <div className="admin-user-cell-email">{user.email}</div>
                              </div>
                            </div>
                          </td>
                          <td><span className="admin-role-tag">{user.role}</span></td>
                          <td>{user.department}</td>
                          <td>
                            <span className={`admin-status-badge ${user.status.toLowerCase() === "active" ? "active" : "inactive"}`}>
                              <span className="admin-status-dot" /> {user.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* VISITORS TAB CONTENT WITH 4 BLOCKS */}
              {activeTab === "visitors" && (
                <div className="admin-visitors-container">
                  {/* 4 VISITOR SECTION BLOCKS */}
                  <div className="visitor-blocks-grid">
                    <div 
                      className={`visitor-block-card ${visitorSubTab === "live_visitors" ? "active" : ""}`}
                      onClick={() => setVisitorSubTab("live_visitors")}
                    >
                      <div className="visitor-block-icon live">
                        <Users size={20} />
                      </div>
                      <div className="visitor-block-info">
                        <span className="visitor-block-label">Live Visitors</span>
                        <h4 className="visitor-block-count">{liveVisitors.filter(v => v.status !== "Checked Out").length}</h4>
                      </div>
                      {visitorSubTab === "live_visitors" && <span className="visitor-block-indicator" />}
                    </div>

                    <div 
                      className={`visitor-block-card ${visitorSubTab === "spot_requests" ? "active" : ""}`}
                      onClick={() => setVisitorSubTab("spot_requests")}
                    >
                      <div className="visitor-block-icon spot">
                        <Clock size={20} />
                      </div>
                      <div className="visitor-block-info">
                        <span className="visitor-block-label">Spot Requests</span>
                        <h4 className="visitor-block-count">{pendingRequests.length}</h4>
                      </div>
                      {visitorSubTab === "spot_requests" && <span className="visitor-block-indicator" />}
                    </div>

                    <div 
                      className={`visitor-block-card ${visitorSubTab === "expected_visitors" ? "active" : ""}`}
                      onClick={() => setVisitorSubTab("expected_visitors")}
                    >
                      <div className="visitor-block-icon expected">
                        <UserCheck size={20} />
                      </div>
                      <div className="visitor-block-info">
                        <span className="visitor-block-label">Expected Visitors</span>
                        <h4 className="visitor-block-count">{expectedVisitors.length}</h4>
                      </div>
                      {visitorSubTab === "expected_visitors" && <span className="visitor-block-indicator" />}
                    </div>

                    <div 
                      className={`visitor-block-card ${visitorSubTab === "expired_visits" ? "active" : ""}`}
                      onClick={() => setVisitorSubTab("expired_visits")}
                    >
                      <div className="visitor-block-icon expired">
                        <AlertTriangle size={20} />
                      </div>
                      <div className="visitor-block-info">
                        <span className="visitor-block-label">Expired Visits</span>
                        <h4 className="visitor-block-count">{expiredVisits.length}</h4>
                      </div>
                      {visitorSubTab === "expired_visits" && <span className="visitor-block-indicator" />}
                    </div>
                  </div>

                  {/* SUB-SECTION 1: LIVE VISITORS */}
                  {visitorSubTab === "live_visitors" && (
                <div className="security-table-container">
                  <table className="security-table">
                    <thead>
                      <tr>
                        <th>Visitor</th>
                        <th>Host (ID)</th>
                        <th>Badge</th>
                        <th>Check-In</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {liveVisitors.filter(v => 
                        (v.name || "").toLowerCase().includes(searchQuery.toLowerCase()) || 
                        String(v.request_id).toLowerCase().includes(searchQuery.toLowerCase()) ||
                        (v.phone || v.mobile_number || "").toLowerCase().includes(searchQuery.toLowerCase())
                      ).map(v => (
                        <tr key={v.request_id}>
                          <td>
                            <div 
                              className="security-visitor-cell"
                              style={{ cursor: "pointer" }}
                              onClick={() => {
                                setSelectedRequestId(v.request_id || v.id);
                                setIsReadOnly(true);
                                setShowVisitorForm(true);
                              }}
                              onMouseEnter={(e) => handleMouseEnterVisitor(v, e)}
                              onMouseLeave={handleMouseLeaveVisitor}
                            >
                              <div className="avatar-wrapper">
                                <div className="avatar-circle">
                                  {v.photo ? (
                                    <img
                                      src={`/${v.photo}`}
                                      alt="visitor"
                                      className="avatar-image"
                                    />
                                  ) : (
                                    (v.name || "user").split(" ").map(n => n[0]).join("")
                                  )}
                                </div>
                                <div
                                  className="camera-icon"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setCurrentRequestId(v.request_id);
                                    setShowCamera(true);
                                  }}
                                >
                                  <Camera size={12} color="white" />
                                </div>
                              </div>

                              <div>
                                <div className="security-visitor-name">{v.name}</div>
                                <div className="security-visitor-company">{v.company_name && v.purpose ? `${v.company_name} · ${v.purpose}` : ""}</div>
                              </div>
                            </div>
                          </td>
                          <td>
                            <div className="security-host-name">{v.approver || v.host || "Walk-in"}</div>
                            <div className="security-host-id" style={{ fontSize: '11px', color: '#64748b' }}>{v.employee_id ? `ID: ${v.employee_id}` : ""}</div>
                          </td>
                          <td><span className="security-badge-tag">{v.request_id}</span></td>
                          <td>{v.checkIn}</td>
                          <td>
                            <span className={`security-status ${getStatusClass(v.is_temp_out ? "Temp Out" : v.status)}`}>
                              <span className="security-status-dot" /> {v.is_temp_out ? "Temp Out" : v.status}
                            </span>
                          </td>
                          <td>
                            <div className="security-action-btns" style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: '4px' }}>
                              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', justifyContent: 'flex-end' }}>
                                {v.status !== "Checked Out" && (
                                  <>
                                    <button
                                      onClick={() => handleOpenIDCard(v.request_id || v.id)}
                                      className="security-icon-btn print"
                                      title="Print ID Card"
                                      style={{ marginRight: '4px' }}
                                    >
                                      <Printer size={18} />
                                    </button>
                                    {v.is_temp_out ? (
                                      <button
                                        onClick={() => handleTempCheckin(v.id || v.request_id)}
                                        className="security-checkout-btn"
                                        style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}>
                                        Temp Check In
                                      </button>
                                    ) : (
                                      <>
                                        <button
                                          onClick={() => handleTempCheckout(v.id || v.request_id)}
                                          className="security-checkout-btn"
                                          style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' }}>
                                          Temp Out
                                        </button>
                                        <button
                                          onClick={() => handleCheckout(v.id || v.request_id)}
                                          className="security-checkout-btn">
                                          Check Out
                                        </button>
                                      </>
                                    )}
                                  </>
                                )}
                              </div>
                              {v.status !== "Checked Out" && !v.is_temp_out && (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', marginTop: '2px' }}>
                                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#64748b', cursor: 'pointer', margin: 0, fontWeight: '500' }}>
                                    <input
                                      type="checkbox"
                                      checked={manualCheckouts[v.id || v.request_id] !== undefined}
                                      onChange={(e) => {
                                        const checked = e.target.checked;
                                        if (checked) {
                                          const now = new Date();
                                          let hours = now.getHours();
                                          const ampm = hours >= 12 ? 'PM' : 'AM';
                                          hours = hours % 12;
                                          hours = hours ? hours : 12;
                                          const defaultTimeStr = `${String(hours).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} ${ampm}`;
                                          setManualCheckouts(prev => ({
                                            ...prev,
                                            [v.id || v.request_id]: defaultTimeStr
                                          }));
                                        } else {
                                          setManualCheckouts(prev => {
                                            const updated = { ...prev };
                                            delete updated[v.id || v.request_id];
                                            return updated;
                                          });
                                        }
                                      }}
                                    />
                                    Already <span style={{ whiteSpace: 'nowrap' }}>checked out</span>
                                  </label>
                                  {manualCheckouts[v.id || v.request_id] !== undefined && (() => {
                                    const timeVal = manualCheckouts[v.id || v.request_id] || "";
                                    const match = timeVal.match(/^(\d{2}):(\d{2})\s(AM|PM)$/);
                                    const currentHour = match ? match[1] : "12";
                                    const currentMinute = match ? match[2] : "00";
                                    const currentAmpm = match ? match[3] : "PM";
                                    return (
                                      <div style={{ display: 'flex', gap: '2px', alignItems: 'center' }}>
                                        <select
                                          value={currentHour}
                                          onChange={(e) => {
                                            const val = e.target.value;
                                            setManualCheckouts(prev => ({
                                              ...prev,
                                              [v.id || v.request_id]: `${val}:${currentMinute} ${currentAmpm}`
                                            }));
                                          }}
                                          style={{ fontSize: '11px', padding: '2px 4px', border: '1px solid #cbd5e1', borderRadius: '4px', background: '#f8fafc', cursor: 'pointer', outline: 'none' }}
                                        >
                                          {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')).map(h => (
                                            <option key={h} value={h}>{h}</option>
                                          ))}
                                        </select>
                                        <span style={{ fontSize: '11px', color: '#64748b' }}>:</span>
                                        <select
                                          value={currentMinute}
                                          onChange={(e) => {
                                            const val = e.target.value;
                                            setManualCheckouts(prev => ({
                                              ...prev,
                                              [v.id || v.request_id]: `${currentHour}:${val} ${currentAmpm}`
                                            }));
                                          }}
                                          style={{ fontSize: '11px', padding: '2px 4px', border: '1px solid #cbd5e1', borderRadius: '4px', background: '#f8fafc', cursor: 'pointer', outline: 'none' }}
                                        >
                                          {Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0')).map(m => (
                                            <option key={m} value={m}>{m}</option>
                                          ))}
                                        </select>
                                        <select
                                          value={currentAmpm}
                                          onChange={(e) => {
                                            const val = e.target.value;
                                            setManualCheckouts(prev => ({
                                              ...prev,
                                              [v.id || v.request_id]: `${currentHour}:${currentMinute} ${val}`
                                            }));
                                          }}
                                          style={{ fontSize: '11px', padding: '2px 4px', border: '1px solid #cbd5e1', borderRadius: '4px', background: '#f8fafc', cursor: 'pointer', outline: 'none' }}
                                        >
                                          <option value="AM">AM</option>
                                          <option value="PM">PM</option>
                                        </select>
                                      </div>
                                    );
                                  })()}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* SPOT REQUESTS TAB CONTENT */}
              {visitorSubTab === "spot_requests" && (
                <div className="security-requests-list">
                  {pendingRequests.filter(req => 
                    (req.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
                    String(req.request_id || req.id).toLowerCase().includes(searchQuery.toLowerCase()) ||
                    (req.company_name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
                    (req.host || "").toLowerCase().includes(searchQuery.toLowerCase())
                  ).map(req => (
                    <div key={req.request_id} className="security-request-item">
                      <div className="security-request-info">
                        <div className="security-visitor-avatar">{(req.name || "user").split(" ").map(n => n[0]).join("")}</div>
                        <div>
                          <h4>{req.name}</h4>
                          <div className="security-request-meta">
                            <span>{req.company_name}</span> · <span>{req.purpose}</span> · <span>Host: {req.host || "Walk-in"}</span>
                          </div>
                          <span className="security-time-tag">{req.time}</span>
                        </div>
                      </div>
                      <div className="security-request-actions">
                        <div className="security-action-icons" style={{ display: 'flex', gap: '8px', marginRight: '10px' }}>
                          <button
                            onClick={() => {
                              setSelectedRequestId(req.request_id || req.id);
                              setIsReadOnly(true);
                              setShowVisitorForm(true);
                            }}
                            className="security-icon-btn view"
                            title="View Details"
                          >
                            <Eye size={18} />
                          </button>
                          <button
                            onClick={() => {
                              setSelectedRequestId(req.request_id || req.id);
                              setIsReadOnly(false);
                              setShowVisitorForm(true);
                            }}
                            className="security-icon-btn edit"
                            title="Edit Request"
                          >
                            <Edit size={18} />
                          </button>
                        </div>
                        <button onClick={() => handleReject(req.request_id || req.id)} className="security-reject-btn">
                          Reject
                        </button>
                        <button onClick={() => handleApprove(req.request_id || req.id)} className="security-approve-btn">
                          Approve
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* EXPECTED VISITORS TAB CONTENT */}
              {visitorSubTab === "expected_visitors" && (
                <div className="security-requests-list">
                  {expectedVisitors.filter(req => 
                    (req.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
                    String(req.request_id || req.id).toLowerCase().includes(searchQuery.toLowerCase()) ||
                    (req.company_name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
                    (req.host || "").toLowerCase().includes(searchQuery.toLowerCase())
                  ).map(req => (
                    <div key={req.request_id} className="security-request-item">
                      <div className="security-request-info">
                        <div className="security-visitor-avatar">
                          {(req.name || "User").split(" ").map(n => n[0]).join("")}
                        </div>
                        <div>
                          <h4>{req.name}</h4>
                          <div className="security-request-meta">
                            <span>{req.company_name}</span> · <span>{req.purpose}</span> · <span>Host: {req.host || "Walk-in"}</span>
                          </div>
                          <span className="security-time-tag">Expected at {req.time}</span>
                        </div>
                      </div>

                      <div className="security-request-actions" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div className="security-action-icons" style={{ display: 'flex', gap: '8px', marginRight: '10px' }}>
                          <button
                            onClick={() => {
                              setSelectedRequestId(req.request_id || req.id);
                              setIsReadOnly(true);
                              setShowVisitorForm(true);
                            }}
                            className="security-icon-btn view"
                            title="View Details"
                          >
                            <Eye size={18} />
                          </button>
                          <button
                            onClick={() => {
                              setSelectedRequestId(req.request_id || req.id);
                              setIsReadOnly(false);
                              setShowVisitorForm(true);
                            }}
                            className="security-icon-btn edit"
                            title="Edit Request"
                          >
                            <Edit size={18} />
                          </button>
                        </div>
                        <button
                          onClick={() => handleCheckin(req.request_id || req.id)}
                          className="security-approve-btn"
                        >
                          <CheckCircle size={16} /> Check In
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* EXPIRED VISITS TAB CONTENT */}
              {visitorSubTab === "expired_visits" && (
                <div className="security-requests-list">
                  <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '15px 2rem', gap: '10px', alignItems: 'center', background: 'rgba(255,255,255,0.4)', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#627d98' }}>Filter Expired:</span>
                    <select
                      value={expiredFilter}
                      onChange={(e) => setExpiredFilter(e.target.value)}
                      style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px', outline: 'none', backgroundColor: '#ffffff', color: '#102a43', fontWeight: 600, cursor: 'pointer' }}
                    >
                      <option value="all">All Expired</option>
                      <option value="week">This Week (Last 7 Days)</option>
                      <option value="month">This Month (Last 30 Days)</option>
                      <option value="quarter">This Quarter (Last 90 Days)</option>
                      <option value="year">This Year (Last 365 Days)</option>
                    </select>
                  </div>
                  {expiredVisits.filter(req => 
                    (req.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
                    String(req.request_id || req.id).toLowerCase().includes(searchQuery.toLowerCase()) ||
                    (req.company || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
                    (req.host || "").toLowerCase().includes(searchQuery.toLowerCase())
                  ).length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#829ab1' }}>
                      <CheckCircle size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
                      <p>No expired visits found</p>
                    </div>
                  ) : (
                    expiredVisits.filter(req => 
                      (req.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
                      String(req.request_id || req.id).toLowerCase().includes(searchQuery.toLowerCase()) ||
                      (req.company || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
                      (req.host || "").toLowerCase().includes(searchQuery.toLowerCase())
                    ).map(req => (
                      <div key={req.id || req.request_id} className="security-request-item expired">
                        <div className="security-request-info">
                          <div className="security-visitor-avatar" style={{ background: '#f1f5f9', color: '#64748b' }}>
                            {(req.name || "User").split(" ").map(n => n[0]).join("")}
                          </div>
                          <div>
                            <h4 style={{ color: '#64748b' }}>{req.name} <span style={{ fontSize: '11px', fontWeight: 'normal', color: '#ef4444', marginLeft: '8px' }}>Expired</span></h4>
                            <div className="security-request-meta">
                              <span>{req.company}</span> · <span>{req.purpose}</span> · <span>Host: {req.host}</span>
                            </div>
                            <span className="security-time-tag">Created on {new Date(req.created_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                        <div className="security-request-actions">
                          <div style={{ color: '#ef4444', fontSize: '12px', fontWeight: '500' }}>Exceeded 36h</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
                </div>
              )}

              {/* REMOTE SESSIONS TAB CONTENT */}
              {activeTab === "remote_sessions" && (
                <div className="admin-table-container">
                  {remoteSuccess && <div style={{ background: '#d1fae5', color: '#065f46', padding: '10px 15px', borderRadius: '6px', margin: '10px 15px', fontWeight: 500, fontSize: '0.85rem' }}>{remoteSuccess}</div>}
                  {remoteError && <div style={{ background: '#fee2e2', color: '#991b1b', padding: '10px 15px', borderRadius: '6px', margin: '10px 15px', fontWeight: 500, fontSize: '0.85rem' }}>{remoteError}</div>}
                  
                  {selectedUserForRemote ? (
                    <div style={{ padding: '20px', background: 'rgba(37, 99, 235, 0.03)', borderRadius: '8px', margin: '15px', border: '1px solid rgba(37, 99, 235, 0.1)' }}>
                      <h4 style={{ margin: '0 0 5px 0', fontSize: '1rem', fontWeight: 700 }}>Authorize Remote Re-login</h4>
                      <p style={{ margin: '0 0 15px 0', fontSize: '0.8rem', color: '#64748b' }}>
                        Enter the password for <strong>{selectedUserForRemote.name}</strong> ({selectedUserForRemote.role}) to re-login their dashboard automatically.
                      </p>
                      <form onSubmit={handleRemoteLoginSubmit} style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569' }}>User Password</label>
                          <input
                            type="password"
                            required
                            placeholder="Enter password..."
                            value={remotePassword}
                            onChange={(e) => setRemotePassword(e.target.value)}
                            style={{ padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.85rem', width: '250px' }}
                          />
                        </div>
                        <button type="submit" disabled={authorizingRemote} style={{ padding: '8px 16px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
                          {authorizingRemote ? 'Authorizing...' : 'Authorize Re-login'}
                        </button>
                        <button type="button" onClick={() => setSelectedUserForRemote(null)} style={{ padding: '8px 16px', background: '#e2e8f0', color: '#334155', border: 'none', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}>
                          Cancel
                        </button>
                      </form>
                    </div>
                  ) : null}

                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>User Name</th>
                        <th>Dashboard Role</th>
                        <th>Department</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {remoteUsers.filter(u => (u.name || "").toLowerCase().includes(searchQuery.toLowerCase())).map(user => (
                        <tr key={user.user_id}>
                          <td>
                            <div>
                              <div className="admin-user-cell-name" style={{ fontWeight: 600 }}>{user.name}</div>
                              <div className="admin-user-cell-email" style={{ fontSize: '0.75rem', color: '#64748b' }}>{user.email}</div>
                            </div>
                          </td>
                          <td><span className="admin-role-tag">{user.role}</span></td>
                          <td>{user.department}</td>
                          <td>
                            <button
                              onClick={() => { setSelectedUserForRemote(user); setRemoteError(""); }}
                              style={{ padding: '6px 12px', background: 'rgba(37, 99, 235, 0.1)', color: '#2563eb', border: '1px solid rgba(37, 99, 235, 0.2)', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                            >
                              <RefreshCw size={12} /> Auto-Login
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* SITES TAB CONTENT */}
              {activeTab === "sites" && (
                <div className="admin-sites-list">
                  {sites.map((site, i) => (
                    <div key={i} className="admin-site-item">
                      <div className="admin-site-info">
                        <div className="admin-site-icon"><MapPin size={18} /></div>
                        <div>
                          <h4>{site.name}</h4>
                          <p>{site.address}</p>
                        </div>
                      </div>
                      <div className="admin-site-meta">
                        <span className="admin-site-visitors">{site.visitors} visitors today</span>
                        <span className={`admin-status-badge ${site.status.toLowerCase() === "active" ? "active" : "maintenance"}`}>
                          <span className="admin-status-dot" /> {site.status}
                        </span>
                        <ChevronRight size={16} className="admin-site-arrow" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* MODAL Overlay */}
        {showAddUserModal && (
          <div className="admin-modal-overlay">
            <div className="admin-modal-content">
              <div className="admin-modal-header">
                <h3><Plus size={20} /> Add New User</h3>
                <button className="admin-close-modal" onClick={() => setShowAddUserModal(false)}>
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleAddUser} className="admin-modal-form">
                <div className="admin-form-grid">
                  <div className="admin-form-group">
                    <label>Full Name *</label>
                    <input type="text" required placeholder="Enter name" value={newUser.name} onChange={(e) => setNewUser({ ...newUser, name: e.target.value })} />
                  </div>
                  <div className="admin-form-group">
                    <label>Email Address *</label>
                    <input
                      type="email"
                      required
                      placeholder="name@company.com"
                      value={newUser.email}
                      onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                      autoComplete="off"
                    />
                  </div>
                  <div className="admin-form-group">
                    <label>Password *</label>
                    <input
                      type="password"
                      required
                      placeholder="Enter The Password"
                      value={newUser.password}
                      onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                      autoComplete="new-password"
                    />
                  </div>
                  <div className="admin-form-group">
                    <label>Role *</label>
                    <select value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}>
                      <option value="admin">Admin</option>
                      <option value="superadmin">Super Admin</option>
                      <option value="host">Host</option>
                      <option value="security">Security</option>
                    </select>
                  </div>
                  <div className="admin-form-group">
                    <label>Department *</label>
                    <select
                      value={newUser.department}
                      onChange={(e) => setNewUser({ ...newUser, department: e.target.value })}
                      required
                    >
                      <option value="">Select Department</option>
                      {["IT", "HR", "Accounts", "Operations", "Sales & Marketing", "Legal", "Store"].map(dept => (
                        <option key={dept} value={dept}>{dept}</option>
                      ))}
                    </select>
                  </div>
                  <div className="admin-form-group">
                    <label>Profile Photo</label>
                    <div className="admin-photo-upload-box">
                      <input type="file" accept="image/*" onChange={(e) => setNewUser({ ...newUser, photo: e.target.files[0] })} />
                      <Camera size={18} />
                      <span>{newUser.photo ? newUser.photo.name : "Choose Photo"}</span>
                    </div>
                  </div>
                </div>
                <div className="admin-modal-footer">
                  <button type="button" className="admin-btn-cancel" onClick={() => setShowAddUserModal(false)}>Cancel</button>
                  <button type="submit" className="admin-btn-submit">Create User</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {showMusterModal && (
          <div className="admin-modal-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="admin-modal-content" style={{ maxWidth: '650px', padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '12px', width: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Shield size={20} color="#ef4444" />
                  <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: 'hsl(var(--foreground))' }}>Emergency Muster Roll</h3>
                </div>
                <button 
                  onClick={() => setShowMusterModal(false)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'hsl(var(--muted-foreground))' }}
                >
                  <X size={20} />
                </button>
              </div>

              {isLoadingMuster ? (
                <div style={{ textAlign: 'center', padding: '40px 0', width: '100%' }}>
                  <RefreshCw size={24} className="spin" style={{ animation: 'spin 1s linear infinite' }} />
                  <p style={{ marginTop: '10px', color: 'hsl(var(--muted-foreground))' }}>Compiling live muster list...</p>
                </div>
              ) : (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px', width: '100%' }}>
                    <div style={{ background: 'rgba(37, 99, 235, 0.05)', border: '1px solid rgba(37, 99, 235, 0.15)', borderRadius: '8px', padding: '12px 15px' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'hsl(var(--muted-foreground))', textTransform: 'uppercase' }}>Active Visitors</span>
                      <h4 style={{ margin: '5px 0 0 0', fontSize: '1.75rem', fontWeight: 800, color: '#2563eb' }}>{liveVisitors.length}</h4>
                    </div>
                    <div style={{ background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.15)', borderRadius: '8px', padding: '12px 15px' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'hsl(var(--muted-foreground))', textTransform: 'uppercase' }}>Active Employees</span>
                      <h4 style={{ margin: '5px 0 0 0', fontSize: '1.75rem', fontWeight: 800, color: '#10b981' }}>{musterEmployees.length}</h4>
                    </div>
                  </div>

                  <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '8px', marginBottom: '20px', background: 'hsl(var(--card))', width: '100%' }}>
                    <div style={{ padding: '10px 15px', background: 'rgba(255, 255, 255, 0.05)', fontWeight: 700, fontSize: '0.85rem', color: 'hsl(var(--foreground))', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
                      1. Visitors Currently on Premises ({liveVisitors.length})
                    </div>
                    {liveVisitors.length === 0 ? (
                      <div style={{ padding: '15px', fontStyle: 'italic', fontSize: '0.85rem', color: 'hsl(var(--muted-foreground))', textAlign: 'center' }}>No visitors checked in currently.</div>
                    ) : (
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                        <thead>
                          <tr style={{ textAlign: 'left', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', background: 'rgba(255, 255, 255, 0.02)' }}>
                            <th style={{ padding: '8px 12px' }}>Badge</th>
                            <th style={{ padding: '8px 12px' }}>Name</th>
                            <th style={{ padding: '8px 12px' }}>Company</th>
                            <th style={{ padding: '8px 12px' }}>Host</th>
                            <th style={{ padding: '8px 12px' }}>Check In</th>
                          </tr>
                        </thead>
                        <tbody>
                          {liveVisitors.map((v, i) => (
                            <tr key={i} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                              <td style={{ padding: '8px 12px', fontWeight: 600 }}>{v.badge || `V-${v.request_id}`}</td>
                              <td style={{ padding: '8px 12px' }}>{v.name}</td>
                              <td style={{ padding: '8px 12px' }}>{v.company}</td>
                              <td style={{ padding: '8px 12px' }}>{v.host}</td>
                              <td style={{ padding: '8px 12px' }}>{v.checkIn}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}

                    <div style={{ padding: '10px 15px', background: 'rgba(255, 255, 255, 0.05)', fontWeight: 700, fontSize: '0.85rem', color: 'hsl(var(--foreground))', borderTop: '1px solid rgba(255, 255, 255, 0.08)', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
                      2. Active Employees on Premises ({musterEmployees.length})
                    </div>
                    {musterEmployees.length === 0 ? (
                      <div style={{ padding: '15px', fontStyle: 'italic', fontSize: '0.85rem', color: 'hsl(var(--muted-foreground))', textAlign: 'center' }}>No active employees found.</div>
                    ) : (
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                        <thead>
                          <tr style={{ textAlign: 'left', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', background: 'rgba(255, 255, 255, 0.02)' }}>
                            <th style={{ padding: '8px 12px' }}>ID</th>
                            <th style={{ padding: '8px 12px' }}>Name</th>
                            <th style={{ padding: '8px 12px' }}>Department</th>
                            <th style={{ padding: '8px 12px' }}>Role</th>
                          </tr>
                        </thead>
                        <tbody>
                          {musterEmployees.map((emp, i) => (
                            <tr key={i} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                              <td style={{ padding: '8px 12px', fontWeight: 600 }}>{emp.id}</td>
                              <td style={{ padding: '8px 12px' }}>{emp.name}</td>
                              <td style={{ padding: '8px 12px' }}>{emp.department}</td>
                              <td style={{ padding: '8px 12px', textTransform: 'capitalize' }}>{emp.role}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', width: '100%' }}>
                    <button 
                      onClick={handleExportCSV}
                      style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid rgba(255, 255, 255, 0.15)', background: 'transparent', color: 'hsl(var(--foreground))', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      CSV Export
                    </button>
                    <button 
                      onClick={handleDownloadPDF}
                      style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', background: '#ef4444', color: '#ffffff', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      Print Muster List (PDF)
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
        {/* VISITOR PASS FORM MODAL */}
        {showVisitorForm && (
          <div className="modal-overlay">
            <div className="modal-content-wrapper">
              <VisitorPassForm
                requestId={selectedRequestId}
                readOnly={isReadOnly}
                onClose={() => {
                  setShowVisitorForm(false);
                  setSelectedRequestId(null);
                  setIsReadOnly(false);
                  fetchSecurityData();
                }}
              />
            </div>
          </div>
        )}

        {/* CAMERA MODAL */}
        <CameraModal
          isOpen={showCamera}
          onClose={() => setShowCamera(false)}
          onCapture={uploadCapturedPhoto}
          title="Capture Visitor Photo"
        />

        {/* VISITOR ID PASS MODAL */}
        {showIDCardModal && (
          <div className="modal-overlay">
            <div className="modal-content-wrapper" style={{ maxWidth: '450px', padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #cbd5e1', paddingBottom: '12px', width: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Printer size={20} color="#3b82f6" />
                  <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#102a43' }}>Visitor ID Pass Preview</h3>
                </div>
                <button
                  onClick={() => setShowIDCardModal(false)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
                >
                  <X size={20} />
                </button>
              </div>

              {isLoadingIDCard ? (
                <div style={{ textAlign: 'center', padding: '40px 0', width: '100%' }}>
                  <RefreshCw size={24} className="spin" style={{ animation: 'spin 1s linear infinite' }} />
                  <p style={{ marginTop: '10px', color: '#64748b' }}>Loading ID card preview...</p>
                </div>
              ) : idCardData ? (
                <>
                  <div className="visitor-id-card-preview-container">
                    <div className="visitor-id-card-preview-card">
                      <div className="visitor-id-card-preview-top-row">
                        <div className="visitor-id-card-preview-left">
                          <h2 className="visitor-id-card-preview-name">{idCardData.name}</h2>
                          <span className="visitor-id-card-preview-role">Visitor</span>
                        </div>
                        <div className="visitor-id-card-preview-avatar-box">
                          {idCardData.photo ? (
                            <img src={`/${idCardData.photo}`} className="visitor-id-card-preview-avatar-img" alt="Visitor" />
                          ) : (
                            <div className="visitor-id-card-preview-avatar-init">
                              {(idCardData.name || "V").split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase()}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="visitor-id-card-preview-divider" />

                      <div className="visitor-id-card-preview-rows">
                        <div className="visitor-id-card-preview-row">
                          <span className="visitor-id-card-preview-label">PASS ID</span>
                          <span className="visitor-id-card-preview-value">V-{idCardData.request_id}</span>
                        </div>
                        <div className="visitor-id-card-preview-row">
                          <span className="visitor-id-card-preview-label">HOST NAME</span>
                          <span className="visitor-id-card-preview-value">{idCardData.personToVisit || "-"}</span>
                        </div>
                        <div className="visitor-id-card-preview-row">
                          <span className="visitor-id-card-preview-label">ACCESS LEVEL</span>
                          <span className="visitor-id-card-preview-value">
                            {idCardData.accessLevel === "5" ? "Admin (Level 5)" : (idCardData.accessLevel === "3" ? "Security (Level 3)" : "Visitor (Level 1)")}
                          </span>
                        </div>
                      </div>

                      <div className="visitor-id-card-preview-divider" />

                      <div className="visitor-id-card-preview-rows">
                        <div className="visitor-id-card-preview-row">
                          <span className="visitor-id-card-preview-label">TIME IN</span>
                          <span className="visitor-id-card-preview-value">{idCardData.checkInTime || "-"}</span>
                        </div>
                        <div className="visitor-id-card-preview-row">
                          <span className="visitor-id-card-preview-label">TIME OUT</span>
                          <span className="visitor-id-card-preview-value">{idCardData.checkOutTime || "-"}</span>
                        </div>
                      </div>

                      <div className="visitor-id-card-preview-divider" />

                      <div className="visitor-id-card-preview-rows">
                        <div className="visitor-id-card-preview-row">
                          <span className="visitor-id-card-preview-label">HAS DEVICE</span>
                          <span className="visitor-id-card-preview-value">{idCardData.hasDevice || "No"}</span>
                        </div>
                        {idCardData.hasDevice === "Yes" && (
                          <>
                            <div className="visitor-id-card-preview-row">
                              <span className="visitor-id-card-preview-label">DEVICE TYPE</span>
                              <span className="visitor-id-card-preview-value">{idCardData.deviceType || "-"}</span>
                            </div>
                            <div className="visitor-id-card-preview-row">
                              <span className="visitor-id-card-preview-label">DEVICE MAKE</span>
                              <span className="visitor-id-card-preview-value">{idCardData.deviceMake || "-"}</span>
                            </div>
                            <div className="visitor-id-card-preview-row">
                              <span className="visitor-id-card-preview-label">SERIAL NO</span>
                              <span className="visitor-id-card-preview-value">{idCardData.deviceSerialNumber || "-"}</span>
                            </div>
                          </>
                        )}
                        <div className="visitor-id-card-preview-row">
                          <span className="visitor-id-card-preview-label">HAS MATERIAL</span>
                          <span className="visitor-id-card-preview-value">{idCardData.hasMaterial || "No"}</span>
                        </div>
                      </div>

                      <div 
                        className="visitor-id-card-preview-footer-tag-new"
                        style={{
                          background: idCardData.accessLevel === "5" ? "#ef4444" : (idCardData.accessLevel === "3" ? "#3b82f6" : "#10b981")
                        }}
                      >
                        {idCardData.accessLevel === "5" ? "ADMIN" : (idCardData.accessLevel === "3" ? "SECURITY" : "APPROVED VISITOR")}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '20px', width: '100%' }}>
                    <button 
                      onClick={handlePrintIDCard}
                      className="modal-btn capture-btn" 
                      style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 24px' }}
                    >
                      <Printer size={18} /> Print Pass
                    </button>
                    <button 
                      onClick={() => setShowIDCardModal(false)}
                      className="modal-btn close-btn" 
                      style={{ margin: 0 }}
                    >
                      Close
                    </button>
                  </div>
                </>
              ) : (
                <div style={{ padding: '20px', textAlign: 'center', color: '#ef4444' }}>
                  Failed to load ID card preview.
                </div>
              )}
            </div>
          </div>
        )}

        {/* FLOATING HOVER CARD FOR VISITOR DETAILS */}
        {hoveredVisitor && (
          <div
            className="visitor-hover-card"
            style={{
              top: `${hoverCardPos.top}px`,
              left: `${hoverCardPos.left}px`,
            }}
            onMouseEnter={handleCardMouseEnter}
            onMouseLeave={handleCardMouseLeave}
          >
            <div className="vh-header">
              <div className="vh-avatar">
                {hoveredVisitor.photo ? (
                  <img src={`/${hoveredVisitor.photo}`} alt="visitor" />
                ) : (
                  <span>{(hoveredVisitor.name || "V").split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase()}</span>
                )}
              </div>
              <div className="vh-title-info">
                <div className="vh-name-row">
                  <h4 className="vh-name">{hoveredVisitor.name}</h4>
                  <span className="vh-badge">{hoveredVisitor.badge || `V-${hoveredVisitor.request_id}`}</span>
                </div>
                <div className="vh-status-row">
                  <span className={`security-status ${getStatusClass(hoveredVisitor.is_temp_out ? "Temp Out" : hoveredVisitor.status)}`}>
                    <span className="security-status-dot" /> {hoveredVisitor.is_temp_out ? "Temp Out" : hoveredVisitor.status}
                  </span>
                  {hoveredVisitor.access_level && (
                    <span className="vh-access-tag">Level {hoveredVisitor.access_level}</span>
                  )}
                </div>
              </div>
            </div>

            <div className="vh-divider" />

            <div className="vh-grid">
              <div className="vh-item">
                <span className="vh-label"><Phone size={12} /> Mobile</span>
                <span className="vh-value">{hoveredVisitor.phone || hoveredVisitor.mobile_number || "-"}</span>
              </div>
              {hoveredVisitor.email && (
                <div className="vh-item">
                  <span className="vh-label"><Mail size={12} /> Email</span>
                  <span className="vh-value">{hoveredVisitor.email}</span>
                </div>
              )}
              
              <div className="vh-item">
                <span className="vh-label"><Building size={12} /> Company</span>
                <span className="vh-value">{hoveredVisitor.company || hoveredVisitor.company_name || "-"}</span>
              </div>
              {(hoveredVisitor.department || hoveredVisitor.unit) && (
                <div className="vh-item">
                  <span className="vh-label"><Briefcase size={12} /> Dept / Unit</span>
                  <span className="vh-value">
                    {[hoveredVisitor.department, hoveredVisitor.unit].filter(Boolean).join(" · ")}
                  </span>
                </div>
              )}

              <div className="vh-item">
                <span className="vh-label"><UserCheck size={12} /> Host / Approver</span>
                <span className="vh-value">{hoveredVisitor.host || hoveredVisitor.personToVisit || hoveredVisitor.approver || "-"}</span>
              </div>
              <div className="vh-item">
                <span className="vh-label"><FileText size={12} /> Reason of Visit</span>
                <span className="vh-value">{hoveredVisitor.reasonOfVisit || hoveredVisitor.purpose || "-"}</span>
              </div>

              <div className="vh-item">
                <span className="vh-label"><Clock size={12} /> Check-In Time</span>
                <span className="vh-value">{hoveredVisitor.checkIn || hoveredVisitor.check_in_time || "-"}</span>
              </div>
              {hoveredVisitor.location && (
                <div className="vh-item">
                  <span className="vh-label"><MapPin size={12} /> Location</span>
                  <span className="vh-value">{hoveredVisitor.location}</span>
                </div>
              )}

              {(hoveredVisitor.typeOfIDProof || hoveredVisitor.id_proof_type) && (
                <div className="vh-item">
                  <span className="vh-label"><Shield size={12} /> ID Proof</span>
                  <span className="vh-value">
                    {hoveredVisitor.typeOfIDProof || hoveredVisitor.id_proof_type}: {hoveredVisitor.idProofNumber || hoveredVisitor.id_proof_number || "Provided"}
                  </span>
                </div>
              )}

              {(hoveredVisitor.hasDevice === "Yes" || hoveredVisitor.has_device) && (
                <div className="vh-item full-width">
                  <span className="vh-label"><Laptop size={12} /> Device Details</span>
                  <span className="vh-value">
                    {[hoveredVisitor.deviceType, hoveredVisitor.deviceMake, hoveredVisitor.deviceSerialNumber ? `S/N: ${hoveredVisitor.deviceSerialNumber}` : null].filter(Boolean).join(" - ") || "Carrying Device"}
                  </span>
                </div>
              )}

              {(hoveredVisitor.vehicleType || hoveredVisitor.vehicleNumber) && (
                <div className="vh-item full-width">
                  <span className="vh-label"><Car size={12} /> Vehicle</span>
                  <span className="vh-value">
                    {[hoveredVisitor.vehicleType, hoveredVisitor.vehicleNumber].filter(Boolean).join(" - ")}
                  </span>
                </div>
              )}
            </div>

            <div className="vh-footer-actions">
              <button
                className="vh-action-btn vh-action-view"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedRequestId(hoveredVisitor.request_id || hoveredVisitor.id);
                  setIsReadOnly(true);
                  setShowVisitorForm(true);
                  setHoveredVisitor(null);
                }}
              >
                <Eye size={14} /> View Form
              </button>
              <button
                className="vh-action-btn vh-action-edit"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedRequestId(hoveredVisitor.request_id || hoveredVisitor.id);
                  setIsReadOnly(false);
                  setShowVisitorForm(true);
                  setHoveredVisitor(null);
                }}
              >
                <Edit size={14} /> Edit Form
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;