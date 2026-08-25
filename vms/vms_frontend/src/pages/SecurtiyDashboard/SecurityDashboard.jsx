import { useState, useEffect, useRef } from "react";
import API from "../../app/apiClient";
import StatCard from "../../components/StatCard/StatCard";
import VisitorPassForm from "../../components/forms/forms/VisitorPassForm"
import { Users, UserCheck, Clock, AlertTriangle, Search, CheckCircle, Camera, QrCode, Shield, UserPlus, X, RefreshCw, Eye, Edit, Printer, Phone, Mail, Building, MapPin, Laptop, Car, FileText, Briefcase, Info } from "lucide-react";
import "./SecurityDashboard.css";
import QRRegistrationModal from "../../components/modals/QRRegistrationModal";
import BulkUploadModal from "../../components/modals/BulkUploadModal";
import CameraModal from "../../components/modals/CameraModal";

const SecurityDashboard = () => {
  const [liveSearchQuery, setLiveSearchQuery] = useState("");
  const [pendingSearchQuery, setPendingSearchQuery] = useState("");
  const [expectedSearchQuery, setExpectedSearchQuery] = useState("");
  const [expiredSearchQuery, setExpiredSearchQuery] = useState("");
  const [activeView, setActiveView] = useState("live");
  const [liveVisitors, setLiveVisitors] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [expectedVisitors, setExpectedVisitors] = useState([]);
  const [expiredVisits, setExpiredVisits] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [expiredFilter, setExpiredFilter] = useState("all");
  const [showCamera, setShowCamera] = useState(false);
  const [currentRequestId, setCurrentRequestId] = useState(null);
  const [showQRModal, setShowQRModal] = useState(false);
  const [recentSearchQuery, setRecentSearchQuery] = useState("");
  const [isSearchingRecent, setIsSearchingRecent] = useState(false);
  const [selectedRequestId, setSelectedRequestId] = useState(null);
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [showIDCardModal, setShowIDCardModal] = useState(false);
  const [idCardData, setIdCardData] = useState(null);
  const [isLoadingIDCard, setIsLoadingIDCard] = useState(false);

  const [showMusterModal, setShowMusterModal] = useState(false);
  const [musterEmployees, setMusterEmployees] = useState([]);
  const [isLoadingMuster, setIsLoadingMuster] = useState(false);

  const [manualCheckouts, setManualCheckouts] = useState({});

  // Hover card preview state
  const [hoveredVisitor, setHoveredVisitor] = useState(null);
  const [hoverCardPos, setHoverCardPos] = useState({ top: 0, left: 0 });
  const hoverTimeoutRef = useRef(null);

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
    link.setAttribute("download", `Emergency_Muster_${new Date().toISOString().slice(0, 10)}.csv`);
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

  // Prevent background scrolling when modals are open
  useEffect(() => {
    const isModalOpen = showForm || showCamera || showQRModal || showMusterModal || showBulkModal || showIDCardModal;
    if (isModalOpen) {
      document.body.style.overflow = "hidden";
      document.documentElement.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
      document.documentElement.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
      document.documentElement.style.overflow = "";
    };
  }, [showForm, showCamera, showQRModal, showMusterModal, showBulkModal, showIDCardModal]);

  const handleApprove = async (id) => {
    try {
      const user = JSON.parse(sessionStorage.getItem("user"));

      await API.post(`/security/approve-request/${id}`, {
        approved_by: user.user_id
      });

      fetchSecurityData();

    } catch (err) {
      console.error("Approve error:", err);
    }
  };

  const handleReject = async (id) => {
    try {
      const user = JSON.parse(sessionStorage.getItem("user"));

      await API.post(`/security/reject-request/${id}`, {
        approved_by: user.user_id
      });

      fetchSecurityData();

    } catch (err) {
      console.error("Reject error:", err);
    }
  };
  const handleCheckin = async (id) => {
    try {
      await API.post(`/security/checkin/${id}`);

      // 🔥 Move from Expected → Live
      const checkedInItem = expectedVisitors.find(
        req => (req.request_id) === id
      );

      if (checkedInItem) {
        // remove from expected
        setExpectedVisitors(prev =>
          prev.filter(req => (req.request_id) !== id)
        );

        // add to live
        setLiveVisitors(prev => [
          ...prev,
          {
            ...checkedInItem,
            status: "Inside",
            checkIn: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
          }
        ]);
      }
      fetchSecurityData();

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
        
        // Build combined YYYY-MM-DDTHH:MM local datetime string
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

      const checkedOutItem = liveVisitors.find(
        v => (v.id || v.request_id) === id
      );

      if (checkedOutItem) {
        // remove from live
        setLiveVisitors(prev =>
          prev.filter(v => (v.id || v.request_id) !== id)
        );
      }
      fetchSecurityData();

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
            @page {
              size: 85mm 140mm;
              margin: 0;
            }
            body {
              margin: 0;
              padding: 0;
              width: 85mm;
              height: 140mm;
              display: flex;
              justify-content: center;
              align-items: center;
              background-color: #ffffff;
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .card {
              width: 78mm;
              min-height: 130mm;
              height: auto;
              box-sizing: border-box;
              border: 1px solid #cbd5e1;
              border-radius: 8mm;
              background: #ffffff;
              display: flex;
              flex-direction: column;
              padding: 6mm 6mm 14mm 6mm;
              position: relative;
              overflow: hidden;
            }
            .top-row {
              width: 100%;
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: 4mm;
            }
            .left-col {
              display: flex;
              flex-direction: column;
            }
            .name {
              font-size: 5.5mm;
              font-weight: 800;
              color: #1e3a8a;
              margin: 0;
            }
            .role {
              font-size: 3.2mm;
              font-weight: 600;
              color: #64748b;
              margin-top: 1mm;
            }
            .avatar-box {
              width: 18mm;
              height: 18mm;
              border-radius: 4px;
              overflow: hidden;
              background: #dbeafe;
              display: flex;
              justify-content: center;
              align-items: center;
              border: 1px solid #bfdbfe;
            }
            .avatar-img {
              width: 100%;
              height: 100%;
              object-fit: cover;
            }
            .avatar-init {
              font-size: 8mm;
              font-weight: 700;
              color: #1e3a8a;
            }
            .divider {
              width: 100%;
              height: 1px;
              background-color: #cbd5e1;
              margin: 3mm 0;
            }
            .rows {
              width: 100%;
              display: flex;
              flex-direction: column;
              gap: 2mm;
            }
            .row {
              width: 100%;
              display: flex;
              justify-content: space-between;
              align-items: center;
            }
            .label {
              font-size: 2.8mm;
              font-weight: 700;
              color: #94a3b8;
              text-transform: uppercase;
              letter-spacing: 0.3px;
            }
            .val {
              font-size: 2.8mm;
              font-weight: 800;
              color: #1e293b;
            }
            .footer-tag {
              width: 100%;
              height: 8mm;
              color: #ffffff;
              font-size: 2.8mm;
              font-weight: 700;
              display: flex;
              justify-content: center;
              align-items: center;
              text-transform: uppercase;
              letter-spacing: 1px;
              position: absolute;
              bottom: 0;
              left: 0;
            }
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

  const handlePhotoUpload = async (e, request_id) => {
    const file = e.target.files[0];

    if (!file) return;

    try {
      const formData = new FormData();
      formData.append("photo", file);

      await API.post(
        `/security/upload-photo/${request_id}`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data"
          }
        }
      );

      alert("✅ Photo Uploaded!");

      fetchSecurityData(); // refresh UI

    } catch (err) {
      console.error("Upload error:", err);
      alert("❌ Upload failed");
    }
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

  const [stats, setStats] = useState({
    inside: 0,
    expected: 0,
    pending: 0,
    overstay: 0
  });
  const fetchSecurityData = async () => {
    try {
      // 🔥 CALL ALL APIs
      const [statsRes, liveRes, pendingRes, expectedRes, expiredRes, activityRes] = await Promise.all([
        API.get("/security/dashboard"),
        API.get("/security/live-visitors"),
        API.get("/security/pending-requests"),
        API.get("/security/expected-visitors"),
        API.get(`/security/expired-visits?filter=${expiredFilter}`),
        API.get(`/security/recent-activity?query=${recentSearchQuery}`)
      ]);

      // 🔥 SET DATA
      setStats({
        inside: statsRes.data.visitors_inside,
        expected: statsRes.data.expected_today,
        pending: statsRes.data.pending_approval,
        overstay: statsRes.data.overstay_alerts
      });

      setLiveVisitors(liveRes.data);
      setPendingRequests(pendingRes.data);
      setExpectedVisitors(expectedRes.data);
      setExpiredVisits(expiredRes.data);
      setRecentActivity(activityRes.data);

    } catch (err) {
      console.error("Security API error:", err);
    }
  };
  useEffect(() => {
    fetchSecurityData();
    // Only auto-refresh today's data if not actively searching historical data
    const interval = setInterval(() => {
      if (!recentSearchQuery) fetchSecurityData();
    }, 5000);
    return () => clearInterval(interval);
  }, [recentSearchQuery, expiredFilter]);


  const getStatusClass = (status) => {
    switch (status) {
      case "Inside": return "inside";
      case "Temp Out": return "temp-out";
      case "Overstay": return "overstay";
      case "Checked Out": return "checked-out";
      default: return "";
    }
  };

  return (
    <div className="security-dashboard">
      <div className="security-main-content">
        <div className="security-page-header">
          <div>
            <h1 className="security-title">Security Dashboard</h1>
            <p className="security-subtitle">
              Monitor visitors, manage check-ins, and handle spot requests
            </p>
          </div>

          <div className="security-header-actions">
            <button className="security-btn-primary" style={{ backgroundColor: '#ef4444' }} onClick={handleOpenMuster}>
              <Shield size={16} /> Emergency Muster
            </button>

            <button
              className="security-btn-primary"
              style={{ background: "linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)", borderColor: "#4f46e5" }}
              onClick={() => setShowBulkModal(true)}
            >
              <UserPlus size={16} /> Bulk Upload
            </button>

            <button
              className="security-btn-primary"
              onClick={() => setShowForm(true)}
            >
              <UserPlus size={16} /> Add Visitor
            </button>

            <button className="security-btn-primary" onClick={() => setShowQRModal(true)}>
              <QrCode size={16} /> Scan QR
            </button>
          </div>

        </div>
        {showForm && (
          <div className="modal-overlay">
            <div className="modal-content-wrapper">
              <VisitorPassForm
                requestId={selectedRequestId}
                readOnly={isReadOnly}
                onClose={() => {
                  setShowForm(false);
                  setSelectedRequestId(null);
                  setIsReadOnly(false);
                  fetchSecurityData();
                }}
              />
            </div>
          </div>
        )}
        <div className="security-stats-grid">
          <StatCard label="Visitors Inside" value={stats.inside} icon={<Users size={22} />} iconBg="hsl(217, 91%, 60%, 0.1)" iconColor="hsl(217, 91%, 60%)" />
          <StatCard label="Expected Today" value={stats.expected} icon={<UserCheck size={22} />} iconBg="hsl(152, 81%, 90%)" iconColor="hsl(164, 86%, 20%)" />
          <StatCard label="Pending Approval" value={stats.pending} icon={<Clock size={22} />} iconBg="hsl(48, 96%, 89%)" iconColor="hsl(26, 90%, 31%)" />
          <StatCard label="Overstay Alerts" value={stats.overstay} icon={<AlertTriangle size={22} />} iconBg="hsl(0, 93%, 94%)" iconColor="hsl(0, 72%, 51%)" />
        </div>
        <div className="security-dashboard-grid">
          <div className="security-left-column">
            {/* Live / Pending toggle */}
            <div className="security-card">
              <div className="security-card-header">
                <div className="security-tabs">
                  <button className={`security-tab ${activeView === "live" ? "active" : ""}`} onClick={() => setActiveView("live")}>
                    <Users size={16} /> Live Visitors ({liveVisitors.filter(v => v.status !== "Checked Out").length})
                  </button>
                  <button className={`security-tab ${activeView === "pending" ? "active" : ""}`} onClick={() => setActiveView("pending")}>
                    <Clock size={16} /> Spot Requests ({pendingRequests.length})
                  </button>
                  <button className={`security-tab ${activeView === "expected" ? "active" : ""}`} onClick={() => setActiveView("expected")}>
                    <UserCheck size={16} /> Expected Visitors({expectedVisitors.length})
                  </button>
                  <button className={`security-tab ${activeView === "expired" ? "active" : ""}`} onClick={() => setActiveView("expired")}>
                    <AlertTriangle size={16} /> Expired Visits ({expiredVisits.length})
                  </button>
                </div>
              </div>

              {activeView === "live" && (
                <div className="security-table-container">
                  <div className="security-search-bar" style={{ margin: '1.5rem 2rem 1rem 2rem' }}>
                    <Search size={18} />
                    <input
                      type="text"
                      placeholder="Search live visitors by Name, Mobile, Badge ID..."
                      value={liveSearchQuery}
                      onChange={(e) => setLiveSearchQuery(e.target.value)}
                    />
                  </div>
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
                        (v.name || "").toLowerCase().includes(liveSearchQuery.toLowerCase()) || 
                        String(v.request_id).toLowerCase().includes(liveSearchQuery.toLowerCase()) ||
                        (v.phone || v.mobile_number || "").toLowerCase().includes(liveSearchQuery.toLowerCase())
                      ).map(v => (
                        <tr key={v.request_id}>
                          <td>
                            <div 
                              className="security-visitor-cell"
                              style={{ cursor: "pointer" }}
                              onClick={() => {
                                setSelectedRequestId(v.request_id || v.id);
                                setIsReadOnly(true);
                                setShowForm(true);
                              }}
                              onMouseEnter={(e) => handleMouseEnterVisitor(v, e)}
                              onMouseLeave={handleMouseLeaveVisitor}
                            >
                              <div className="avatar-wrapper">

                                {/* Avatar */}
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

                                {/* Camera Icon */}
                                <div
                                  className="camera-icon"
                                  onClick={() => {
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
                                          style={{
                                            fontSize: '11px',
                                            padding: '2px 4px',
                                            border: '1px solid #cbd5e1',
                                            borderRadius: '4px',
                                            background: '#f8fafc',
                                            cursor: 'pointer',
                                            outline: 'none'
                                          }}
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
                                          style={{
                                            fontSize: '11px',
                                            padding: '2px 4px',
                                            border: '1px solid #cbd5e1',
                                            borderRadius: '4px',
                                            background: '#f8fafc',
                                            cursor: 'pointer',
                                            outline: 'none'
                                          }}
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
                                          style={{
                                            fontSize: '11px',
                                            padding: '2px 4px',
                                            border: '1px solid #cbd5e1',
                                            borderRadius: '4px',
                                            background: '#f8fafc',
                                            cursor: 'pointer',
                                            outline: 'none'
                                          }}
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

              {activeView === "pending" && (
                <div className="security-requests-list">
                  <div className="security-search-bar" style={{ margin: '1.5rem 2rem 1rem 2rem' }}>
                    <Search size={18} />
                    <input
                      type="text"
                      placeholder="Search spot requests by Name, Company, Host..."
                      value={pendingSearchQuery}
                      onChange={(e) => setPendingSearchQuery(e.target.value)}
                    />
                  </div>
                  {pendingRequests.filter(req => 
                    (req.name || "").toLowerCase().includes(pendingSearchQuery.toLowerCase()) ||
                    String(req.request_id || req.id).toLowerCase().includes(pendingSearchQuery.toLowerCase()) ||
                    (req.company_name || "").toLowerCase().includes(pendingSearchQuery.toLowerCase()) ||
                    (req.host || "").toLowerCase().includes(pendingSearchQuery.toLowerCase())
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
                              setShowForm(true);
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
                              setShowForm(true);
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
              {activeView === "expected" && (
                <div className="security-requests-list">
                  <div className="security-search-bar" style={{ margin: '1.5rem 2rem 1rem 2rem' }}>
                    <Search size={18} />
                    <input
                      type="text"
                      placeholder="Search expected visitors by Name, Company, Host..."
                      value={expectedSearchQuery}
                      onChange={(e) => setExpectedSearchQuery(e.target.value)}
                    />
                  </div>
                  {expectedVisitors.filter(req => 
                    (req.name || "").toLowerCase().includes(expectedSearchQuery.toLowerCase()) ||
                    String(req.request_id || req.id).toLowerCase().includes(expectedSearchQuery.toLowerCase()) ||
                    (req.company_name || "").toLowerCase().includes(expectedSearchQuery.toLowerCase()) ||
                    (req.host || "").toLowerCase().includes(expectedSearchQuery.toLowerCase())
                  ).map(req => {

                    return (
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
                          <button
                            onClick={() => handleCheckin(req.request_id || req.id)}
                            className="security-approve-btn"
                          >
                            <CheckCircle size={16} /> Check In
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {activeView === "expired" && (
                <div className="security-requests-list">
                  <div className="security-search-bar" style={{ margin: '1.5rem 2rem 1rem 2rem' }}>
                    <Search size={18} />
                    <input
                      type="text"
                      placeholder="Search expired visits by Name, Company, Host..."
                      value={expiredSearchQuery}
                      onChange={(e) => setExpiredSearchQuery(e.target.value)}
                    />
                  </div>
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
                    (req.name || "").toLowerCase().includes(expiredSearchQuery.toLowerCase()) ||
                    String(req.request_id || req.id).toLowerCase().includes(expiredSearchQuery.toLowerCase()) ||
                    (req.company || "").toLowerCase().includes(expiredSearchQuery.toLowerCase()) ||
                    (req.host || "").toLowerCase().includes(expiredSearchQuery.toLowerCase())
                  ).length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#829ab1' }}>
                      <CheckCircle size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
                      <p>No expired visits found</p>
                    </div>
                  ) : (
                    expiredVisits.filter(req => 
                      (req.name || "").toLowerCase().includes(expiredSearchQuery.toLowerCase()) ||
                      String(req.request_id || req.id).toLowerCase().includes(expiredSearchQuery.toLowerCase()) ||
                      (req.company || "").toLowerCase().includes(expiredSearchQuery.toLowerCase()) ||
                      (req.host || "").toLowerCase().includes(expiredSearchQuery.toLowerCase())
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
          </div>

          <div className="security-right-column">
            {/* Recent Visits */}
            <div className="security-card">
              <div className="security-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 className="security-card-title">Recent Visits</h3>
                <div className="recent-search-container" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {isSearchingRecent ? (
                    <div className="recent-search-input-wrapper" style={{ display: 'flex', alignItems: 'center', background: '#f1f5f9', borderRadius: '6px', padding: '2px 8px' }}>
                      <input
                        autoFocus
                        type="text"
                        placeholder="Search past visits..."
                        value={recentSearchQuery}
                        onChange={(e) => setRecentSearchQuery(e.target.value)}
                        style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '13px', width: '120px', padding: '4px 0' }}
                      />
                      <X size={14} style={{ cursor: 'pointer', color: '#64748b' }} onClick={() => {
                        setRecentSearchQuery("");
                        setIsSearchingRecent(false);
                      }} />
                    </div>
                  ) : (
                    <Search
                      size={18}
                      style={{ cursor: 'pointer', color: '#64748b' }}
                      onClick={() => setIsSearchingRecent(true)}
                    />
                  )}
                </div>
              </div>
              <div className="security-activity-list">
                {recentActivity.map((act, i) => (
                  <div key={i} className="security-activity-item">
                    <div className="security-activity-content">
                      <div className="security-activity-dot" />
                      <div>
                        <span className="security-activity-action">{act.action}</span>
                        <span className="security-activity-name"> — {act.name}</span>
                        <p className="security-activity-detail">{act.detail}</p>
                        <span className="security-activity-time">{act.time}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
      <CameraModal
        isOpen={showCamera}
        onClose={() => setShowCamera(false)}
        onCapture={uploadCapturedPhoto}
        title="Capture Visitor Photo"
      />
      <QRRegistrationModal
        isOpen={showQRModal}
        onClose={() => setShowQRModal(false)}
      />

      {showBulkModal && (
        <BulkUploadModal
          isOpen={showBulkModal}
          onClose={() => setShowBulkModal(false)}
          onSuccess={() => {
            setShowBulkModal(false);
            fetchSecurityData();
          }}
        />
      )}

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
                {/* Vertical ID Card Preview Container */}
                <div className="visitor-id-card-preview-container">
                  <div className="visitor-id-card-preview-card">
                    {/* Top Row: Name and Role on Left, Avatar on Right */}
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

                    {/* Passport ID / Host / Access Level Rows */}
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

                    {/* Time In / Time Out Rows */}
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

                    {/* Has Device / Has Material Rows */}
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

                {/* Print button & Close button */}
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

      {showMusterModal && (
        <div className="modal-overlay">
          <div className="modal-content-wrapper" style={{ maxWidth: '650px', padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid hsl(var(--border))', paddingBottom: '12px', width: '100%' }}>
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

                <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid hsl(var(--border))', borderRadius: '8px', marginBottom: '20px', background: 'hsl(var(--card))', width: '100%' }}>
                  <div style={{ padding: '10px 15px', background: 'hsl(var(--muted))', fontWeight: 700, fontSize: '0.85rem', color: 'hsl(var(--foreground))', borderBottom: '1px solid hsl(var(--border))' }}>
                    1. Visitors Currently on Premises ({liveVisitors.length})
                  </div>
                  {liveVisitors.length === 0 ? (
                    <div style={{ padding: '15px', fontStyle: 'italic', fontSize: '0.85rem', color: 'hsl(var(--muted-foreground))', textAlign: 'center' }}>No visitors checked in currently.</div>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                      <thead>
                        <tr style={{ textAlign: 'left', borderBottom: '1px solid hsl(var(--border))', background: 'hsl(var(--muted) / 0.3)' }}>
                          <th style={{ padding: '8px 12px' }}>Badge</th>
                          <th style={{ padding: '8px 12px' }}>Name</th>
                          <th style={{ padding: '8px 12px' }}>Company</th>
                          <th style={{ padding: '8px 12px' }}>Host</th>
                          <th style={{ padding: '8px 12px' }}>Check In</th>
                        </tr>
                      </thead>
                      <tbody>
                        {liveVisitors.map((v, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid hsl(var(--border) / 0.5)' }}>
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

                  <div style={{ padding: '10px 15px', background: 'hsl(var(--muted))', fontWeight: 700, fontSize: '0.85rem', color: 'hsl(var(--foreground))', borderTop: '1px solid hsl(var(--border))', borderBottom: '1px solid hsl(var(--border))' }}>
                    2. Active Employees on Premises ({musterEmployees.length})
                  </div>
                  {musterEmployees.length === 0 ? (
                    <div style={{ padding: '15px', fontStyle: 'italic', fontSize: '0.85rem', color: 'hsl(var(--muted-foreground))', textAlign: 'center' }}>No active employees found.</div>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                      <thead>
                        <tr style={{ textAlign: 'left', borderBottom: '1px solid hsl(var(--border))', background: 'hsl(var(--muted) / 0.3)' }}>
                          <th style={{ padding: '8px 12px' }}>ID</th>
                          <th style={{ padding: '8px 12px' }}>Name</th>
                          <th style={{ padding: '8px 12px' }}>Department</th>
                          <th style={{ padding: '8px 12px' }}>Role</th>
                        </tr>
                      </thead>
                      <tbody>
                        {musterEmployees.map((emp, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid hsl(var(--border) / 0.5)' }}>
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
                    style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#334155', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
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

      {/* Floating Hover Card for Visitor Form Details */}
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
          {/* Header */}
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

          {/* Details Grid */}
          <div className="vh-grid">
            {/* Contact */}
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
            
            {/* Company & Department */}
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

            {/* Host & Purpose */}
            <div className="vh-item">
              <span className="vh-label"><UserCheck size={12} /> Host / Approver</span>
              <span className="vh-value">{hoveredVisitor.host || hoveredVisitor.personToVisit || hoveredVisitor.approver || "-"}</span>
            </div>
            <div className="vh-item">
              <span className="vh-label"><FileText size={12} /> Reason of Visit</span>
              <span className="vh-value">{hoveredVisitor.reasonOfVisit || hoveredVisitor.purpose || "-"}</span>
            </div>

            {/* Check-In & Location */}
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

            {/* ID Proof */}
            {(hoveredVisitor.typeOfIDProof || hoveredVisitor.id_proof_type) && (
              <div className="vh-item">
                <span className="vh-label"><Shield size={12} /> ID Proof</span>
                <span className="vh-value">
                  {hoveredVisitor.typeOfIDProof || hoveredVisitor.id_proof_type}: {hoveredVisitor.idProofNumber || hoveredVisitor.id_proof_number || "Provided"}
                </span>
              </div>
            )}

            {/* Device Info */}
            {(hoveredVisitor.hasDevice === "Yes" || hoveredVisitor.has_device) && (
              <div className="vh-item full-width">
                <span className="vh-label"><Laptop size={12} /> Device Details</span>
                <span className="vh-value">
                  {[hoveredVisitor.deviceType, hoveredVisitor.deviceMake, hoveredVisitor.deviceSerialNumber ? `S/N: ${hoveredVisitor.deviceSerialNumber}` : null].filter(Boolean).join(" - ") || "Carrying Device"}
                </span>
              </div>
            )}

            {/* Vehicle Info */}
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
                setShowForm(true);
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
                setShowForm(true);
                setHoveredVisitor(null);
              }}
            >
              <Edit size={14} /> Edit Form
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

export default SecurityDashboard;