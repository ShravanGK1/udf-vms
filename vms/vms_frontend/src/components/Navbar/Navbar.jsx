import { useState, useRef, useEffect } from "react";
import companyLogo from "../../assets/logo.png";
import { useNavigate, useLocation } from "react-router-dom";
import { useDispatch } from "react-redux";
import { logout } from "../../auth/authSlice";
import { Shield, User, Settings, LogOut, ChevronDown, Bell, CalendarClock, X, Sun, Moon, BookOpen, ShieldAlert, RefreshCw } from "lucide-react";
import apiClient from "../../app/apiClient";
import UserManualModal from "../UserManual/UserManualModal";
import "./Navbar.css";

const roleLabels = {
  admin: "Admin",
  security: "Security",
  superadmin: "Super Admin",
};

const Navbar = ({ role, userName }) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const location = useLocation();
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem("vms-theme") || "white";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("vms-theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === "white" ? "dark" : "white");
  };

  // Profile & Settings Modals visibility
  const [profileOpen, setProfileOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [userManualOpen, setUserManualOpen] = useState(false);
  const [showClockTamperAlert, setShowClockTamperAlert] = useState(false);
  const [tamperMessage, setTamperMessage] = useState("");

  const [branding, setBranding] = useState({
    name: "Unique Delta Force Security Pvt. Ltd.",
    logo: null
  });

  useEffect(() => {
    apiClient.get("/company-branding")
      .then(res => {
        setBranding({
          name: res.data.company_name || "Unique Delta Force Security Pvt. Ltd.",
          logo: res.data.company_logo || null
        });
      })
      .catch(err => console.error("Error loading company branding:", err));
  }, []);

  useEffect(() => {
    const performTamperCheck = async () => {
      try {
        const res = await apiClient.get("/license-status");
        if (res.data.status === "CLOCK_TAMPERED") {
          setTamperMessage(res.data.error || "System clock tampering detected.");
          setShowClockTamperAlert(true);
        } else {
          setShowClockTamperAlert(false);
        }
      } catch (err) {
        console.error("Error checking clock health:", err);
      }
    };

    performTamperCheck();
  }, []);

  // Interactive Settings State
  const [hostStatus, setHostStatus] = useState("In Office");

  // Security role specific settings
  const [soundAlerts, setSoundAlerts] = useState(true);
  const [selectedCamera, setSelectedCamera] = useState("Default System Webcam");
  const [autoPrint, setAutoPrint] = useState(false);
  const [offlineSync, setOfflineSync] = useState(false);

  // Host role specific settings
  const [channels, setChannels] = useState({ email: true, sms: true, whatsapp: false });
  const [autoSyncCalendar, setAutoSyncCalendar] = useState(true);
  const [delegateHost, setDelegateHost] = useState("None");
  const [defaultAccess, setDefaultAccess] = useState("Visitor (Level 1)");

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatDate = (date) => {
    const options = { weekday: 'short', month: 'short', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
  };

  const formatTime = (date) => {
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const initials = userName.split(" ").map(n => n[0]).join("").toUpperCase();

  // Handle Save alert
  const handleSaveSettings = () => {
    alert("✅ Settings saved successfully!");
    setSettingsOpen(false);
  };

  return (
    <nav className="vms-navbar">
      <div className="vms-nav-content">
        <div
          className="vms-logo-section"
          onClick={() => navigate("/")}
          style={{ cursor: "pointer" }}
        >

          {/* Your Logo */}
          <img
            src={branding.logo || companyLogo}
            onError={(e) => {
              e.target.src = companyLogo;
            }}
            alt="company logo"
            className="vms-navbar-logo"
          />

          {/* Company Name */}
          <span className="vms-brand-name">
            {branding.name}
          </span>

          {/* Keep role badge (same UI) */}
          <span className="vms-role-badge">
            {roleLabels[role] || "User"}
          </span>

        </div>

        <div className="vms-nav-datetime">
          <CalendarClock size={16} />
          <span>{formatDate(currentTime)} • {formatTime(currentTime)}</span>
        </div>

        <div className="vms-nav-actions">
          <button className="vms-notification-btn" title="Notifications">
            <Bell size={20} />
            <span className="vms-notification-dot" />
          </button>

          <button
            className="vms-notification-btn"
            onClick={() => setUserManualOpen(true)}
            title="User Manual"
          >
            <BookOpen size={20} />
          </button>

          <button
            className="vms-theme-toggle-btn"
            onClick={toggleTheme}
            title={theme === "white" ? "Switch to Dark Theme" : "Switch to Light Theme"}
          >
            {theme === "white" ? <Moon size={20} /> : <Sun size={20} />}
          </button>

          <div className="vms-user-profile-wrapper" ref={dropdownRef}>
            <div className="vms-user-profile" onClick={() => setDropdownOpen(!dropdownOpen)}>
              <div className="vms-avatar">{initials}</div>
              <div className="vms-user-info-text">
                <span className="vms-user-name">{userName}</span>
                <span className="vms-user-role">{roleLabels[role] || "User"}</span>
              </div>
              <span className={`vms-chevron ${dropdownOpen ? "open" : ""}`}>
                <ChevronDown size={16} />
              </span>
            </div>

            {dropdownOpen && (
              <div className="vms-profile-dropdown">
                <div className="vms-dropdown-header">{userName}</div>
                <button className="vms-dropdown-item" onClick={() => { setDropdownOpen(false); setProfileOpen(true); }}>
                  <User size={16} /> Profile
                </button>
                <button className="vms-dropdown-item" onClick={() => { setDropdownOpen(false); setSettingsOpen(true); }}>
                  <Settings size={16} /> Settings
                </button>
                <div className="vms-dropdown-divider" />
                {role === "admin" && (
                  <>
                    <div className="vms-dropdown-label">Switch Dashboard</div>
                    {location.pathname !== "/host" && (
                      <button className="vms-dropdown-item" onClick={() => { navigate("/host/dashboard/"); setDropdownOpen(false); }}>
                        <Shield size={16} /> Host Dashboard
                      </button>
                    )}
                    {location.pathname !== "/security" && (
                      <button className="vms-dropdown-item" onClick={() => { navigate("/security/dashboard/"); setDropdownOpen(false); }}>
                        <Shield size={16} /> Security Dashboard
                      </button>
                    )}
                    <div className="vms-dropdown-divider" />
                  </>
                )}
                {role === "superadmin" && (
                  <>
                    <div className="vms-dropdown-label">Switch Dashboard</div>
                    {location.pathname !== "/superadmin/dashboard" && (
                      <button className="vms-dropdown-item" onClick={() => { navigate("/superadmin/dashboard"); setDropdownOpen(false); }}>
                        <Shield size={16} /> Super Admin Dashboard
                      </button>
                    )}
                    <div className="vms-dropdown-divider" />
                  </>
                )}
                <button
                  className="vms-dropdown-item vms-logout-item"
                  onClick={() => {
                    dispatch(logout());
                    navigate("/");
                    setDropdownOpen(false);
                  }}
                >
                  <LogOut size={16} /> Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* --- Profile Modal --- */}
      {profileOpen && (
        <div className="vms-modal-overlay" onClick={() => setProfileOpen(false)}>
          <div className="vms-modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="vms-modal-header">
              <h3 className="vms-modal-title">
                <User size={20} /> User Profile
              </h3>
              <button className="vms-modal-close" onClick={() => setProfileOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="vms-modal-body">
              <div className="vms-modal-avatar-section">
                <div className="vms-modal-avatar">{initials}</div>
                <h3 style={{ margin: '0.5rem 0 0 0', fontSize: '1.25rem', color: '#0f172a' }}>{userName}</h3>
                <span className="vms-role-badge">{roleLabels[role] || "User"}</span>
              </div>

              {/* Security Specific Profile */}
              {role === "security" && (
                <div className="vms-modal-section">
                  <h4 className="vms-modal-section-title">Security Officer Details</h4>
                  <div className="vms-modal-field">
                    <span className="vms-modal-label">Duty Station:</span>
                    <span className="vms-modal-value">Gate 1, Kasarwadi Entrance</span>
                  </div>
                  <div className="vms-modal-field">
                    <span className="vms-modal-label">Emergency Protocol clearances:</span>
                    <span className="vms-modal-value" style={{ fontSize: '0.8rem', color: '#059669' }}>Fire Safety, Evacuation Lead</span>
                  </div>
                </div>
              )}

              {/* Host Specific Profile */}
              {(role === "host" || role === "admin" || role === "superadmin") && (
                <div className="vms-modal-section">
                  <h4 className="vms-modal-section-title">Host / Employee Details</h4>
                  <div className="vms-modal-field">
                    <span className="vms-modal-label">Office Location:</span>
                    <span className="vms-modal-value">Building B, 3rd Floor, Desk B-304</span>
                  </div>
                  <div className="vms-modal-field">
                    <span className="vms-modal-label">Department:</span>
                    <span className="vms-modal-value">Operations</span>
                  </div>
                  {/* <div className="vms-modal-form-group" style={{ marginTop: '0.75rem' }}>
                    <label>Work Presence Status:</label>
                    <select 
                      className="vms-modal-select" 
                      value={hostStatus} 
                      onChange={(e) => setHostStatus(e.target.value)}
                    >
                      <option value="In Office">🟢 In Office</option>
                      <option value="Working Remotely">🔵 Working Remotely</option>
                      <option value="On Leave">🔴 On Leave (Auto-decline invites)</option>
                    </select>
                  </div> */}
                </div>
              )}

              {role !== "security" && (
                <div className="vms-modal-section">
                  <h4 className="vms-modal-section-title">Account Information</h4>
                  <div className="vms-modal-field">
                    <span className="vms-modal-label">Email Address:</span>
                    <span className="vms-modal-value">{userName.toLowerCase().replace(/\s/g, "")}@sumeetgroup.com</span>
                  </div>
                  <div className="vms-modal-field">
                    <span className="vms-modal-label">System Account:</span>
                    <span className="vms-modal-value" style={{ textTransform: 'capitalize' }}>{role}</span>
                  </div>
                </div>
              )}
            </div>
            <div className="vms-modal-footer">
              <button className="vms-modal-btn-primary" onClick={() => setProfileOpen(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* --- Settings Modal --- */}
      {settingsOpen && (
        <div className="vms-modal-overlay" onClick={() => setSettingsOpen(false)}>
          <div className="vms-modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="vms-modal-header">
              <h3 className="vms-modal-title">
                <Settings size={20} /> Dashboard Settings
              </h3>
              <button className="vms-modal-close" onClick={() => setSettingsOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="vms-modal-body">

              {/* Security Specific Settings */}
              {role === "security" && (
                <div className="vms-modal-section">
                  <h4 className="vms-modal-section-title">Security Guard Console Configurations</h4>

                  <label className="vms-modal-checkbox-row">
                    <input
                      type="checkbox"
                      checked={soundAlerts}
                      onChange={(e) => setSoundAlerts(e.target.checked)}
                    />
                    <span className="vms-modal-checkbox-label">Sound alerts on new spot requests & overstay</span>
                  </label>

                  <div className="vms-modal-form-group" style={{ marginTop: '0.75rem' }}>
                    <label>Visitor Snapshot Camera Source:</label>
                    <select
                      className="vms-modal-select"
                      value={selectedCamera}
                      onChange={(e) => setSelectedCamera(e.target.value)}
                    >
                      <option value="Default System Webcam">Default System Webcam</option>
                      <option value="External USB Gate-Camera">External USB Gate-Camera</option>
                      <option value="IP Camera Feed (Entrance 1)">IP Camera Feed (Entrance 1)</option>
                    </select>
                  </div>

                  <label className="vms-modal-checkbox-row" style={{ marginTop: '0.5rem' }}>
                    <input
                      type="checkbox"
                      checked={autoPrint}
                      onChange={(e) => setAutoPrint(e.target.checked)}
                    />
                    <span className="vms-modal-checkbox-label">Auto-print gate pass labels instantly upon check-in</span>
                  </label>

                  <label className="vms-modal-checkbox-row">
                    <input
                      type="checkbox"
                      checked={offlineSync}
                      onChange={(e) => setOfflineSync(e.target.checked)}
                    />
                    <span className="vms-modal-checkbox-label">Allow Offline local backup cache for pre-approved list</span>
                  </label>
                </div>
              )}

              {/* Host Specific Settings */}
              {(role === "host" || role === "admin" || role === "superadmin") && (
                <div className="vms-modal-section">
                  <h4 className="vms-modal-section-title">Host Invitation & Notification Rules</h4>

                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '0.25rem' }}>
                      Notify me on visitor arrival via:
                    </label>
                    <label className="vms-modal-checkbox-row">
                      <input
                        type="checkbox"
                        checked={channels.email}
                        onChange={(e) => setChannels({ ...channels, email: e.target.checked })}
                      />
                      <span className="vms-modal-checkbox-label">Email Notification</span>
                    </label>
                    <label className="vms-modal-checkbox-row">
                      <input
                        type="checkbox"
                        checked={channels.sms}
                        onChange={(e) => setChannels({ ...channels, sms: e.target.checked })}
                      />
                      <span className="vms-modal-checkbox-label">SMS Alert (Mobile)</span>
                    </label>
                    <label className="vms-modal-checkbox-row">
                      <input
                        type="checkbox"
                        checked={channels.whatsapp}
                        onChange={(e) => setChannels({ ...channels, whatsapp: e.target.checked })}
                      />
                      <span className="vms-modal-checkbox-label">WhatsApp Message notification</span>
                    </label>
                  </div>

                  <label className="vms-modal-checkbox-row">
                    <input
                      type="checkbox"
                      checked={autoSyncCalendar}
                      onChange={(e) => setAutoSyncCalendar(e.target.checked)}
                    />
                    <span className="vms-modal-checkbox-label">Auto-sync approved schedules to Google/Outlook Calendar</span>
                  </label>

                  <div className="vms-modal-form-group" style={{ marginTop: '0.75rem' }}>
                    <label>Delegate Auto-Approvals to Backup Host:</label>
                    <select
                      className="vms-modal-select"
                      value={delegateHost}
                      onChange={(e) => setDelegateHost(e.target.value)}
                    >
                      <option value="None">None</option>
                      <option value="Kunal Malekar">Kunal Malekar (Operations)</option>
                      <option value="Manish Kenjale">Manish Kenjale (Management)</option>
                    </select>
                  </div>

                  <div className="vms-modal-form-group" style={{ marginTop: '0.5rem' }}>
                    <label>Default Invited Visitor Access Level:</label>
                    <select
                      className="vms-modal-select"
                      value={defaultAccess}
                      onChange={(e) => setDefaultAccess(e.target.value)}
                    >
                      <option value="Visitor (Level 1)">Visitor (Level 1)</option>
                      <option value="Vendor (Level 10)">Vendor (Level 10)</option>
                      <option value="Security (Level 50)">Security (Level 50)</option>
                    </select>
                  </div>
                </div>
              )}

              <div className="vms-modal-section">
                <h4 className="vms-modal-section-title">General Preferences</h4>
                <div className="vms-modal-form-group">
                  <label>Preferred Language:</label>
                  <select className="vms-modal-select">
                    <option value="en">English</option>
                    <option value="hi">Hindi (हिंदी)</option>
                    <option value="mr">Marathi (मराठी)</option>
                  </select>
                </div>
              </div>

            </div>
            <div className="vms-modal-footer">
              <button className="vms-modal-btn-secondary" onClick={() => setSettingsOpen(false)}>Cancel</button>
              <button className="vms-modal-btn-primary" onClick={handleSaveSettings}>Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {userManualOpen && (
        <UserManualModal onClose={() => setUserManualOpen(false)} />
      )}

      {showClockTamperAlert && (
        <div className="um-modal-overlay" style={{ zIndex: 10000, backgroundColor: 'rgba(15, 23, 42, 0.9)' }}>
          <div className="um-modal-container" style={{ maxWidth: '500px', border: '2px solid #ef4444', height: 'auto', padding: '2.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
              <div style={{ padding: '1.25rem', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '50%', color: '#ef4444' }}>
                <ShieldAlert size={48} />
              </div>
            </div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#ef4444', margin: '0 0 10px 0' }}>CRITICAL SYSTEM WARNING</h2>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#f1f5f9', margin: '0 0 15px 0' }}>Clock Tampering Detected</h3>
            <p style={{ color: '#94a3b8', fontSize: '0.9rem', lineHeight: '1.6', margin: '0 0 20px 0' }}>
              {tamperMessage}
            </p>
            <div style={{ background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '12px', borderRadius: '6px', fontSize: '0.8rem', color: '#fca5a5', fontWeight: 600, marginBottom: '20px', width: '100%', boxSizing: 'border-box' }}>
              VMS Security Services are suspended. Please restore the system time immediately.
            </div>
            <button 
              onClick={async () => {
                try {
                  const res = await apiClient.get("/license-status");
                  if (res.data.status === "ACTIVE") {
                    setShowClockTamperAlert(false);
                    window.location.reload();
                  } else {
                    alert("❌ Clock is still tampered. Please correct the system date and time settings first.");
                  }
                } catch (e) {
                  alert("❌ Failed to verify system status.");
                }
              }}
              style={{ width: '100%', padding: '10px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
            >
              <RefreshCw size={16} /> Re-Verify System Time
            </button>
          </div>
        </div>
      )}

    </nav>
  );
};

export default Navbar;