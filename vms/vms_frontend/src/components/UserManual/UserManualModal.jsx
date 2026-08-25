import React, { useState } from "react";
import { X, BookOpen, Compass, Key, UserCheck, ShieldAlert, Settings, Info, Download, Printer } from "lucide-react";
import "./UserManualModal.css";

// Import screenshots
import loginPageImg from "../../assets/screenshots/login_page_final_1782914391570.png";
import dashboardViewImg from "../../assets/screenshots/dashboard_view_1782915121062.png";
import modalViewImg from "../../assets/screenshots/modal_view_1782915207680.png";
import remoteSessionsImg from "../../assets/screenshots/remote_sessions_populated_1782917434033.png";
import registerPageImg from "../../assets/screenshots/media__1782651508413.png";
import initialPageImg from "../../assets/screenshots/initial_page_load_1782914251314.png";
import logoVerificationImg from "../../assets/screenshots/vms_dashboard_logo_verification_1782915063737.webp";

export default function UserManualModal({ onClose }) {
  const [activeSection, setActiveSection] = useState("getting-started");

  const sections = [
    { id: "getting-started", label: "Getting Started & Login", icon: <Compass size={16} /> },
    { id: "admin", label: "Admin Dashboard", icon: <Key size={16} /> },
    { id: "host", label: "Host Dashboard", icon: <UserCheck size={16} /> },
    { id: "security", label: "Security Dashboard", icon: <ShieldAlert size={16} /> },
    { id: "superadmin", label: "Super Admin Console", icon: <Settings size={16} /> }
  ];

  const handleDownloadPDF = () => {
    const printWindow = window.open("", "_blank");
    printWindow.document.write(`
      <html>
        <head>
          <title>Visitor Management System (VMS) User Manual</title>
          <style>
            body {
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              padding: 40px;
              color: #1e293b;
              max-width: 900px;
              margin: 0 auto;
              line-height: 1.6;
            }
            .header-container {
              border-bottom: 3px solid #2563eb;
              padding-bottom: 15px;
              margin-bottom: 40px;
              display: flex;
              justify-content: space-between;
              align-items: center;
            }
            h1 {
              font-size: 2.2rem;
              font-weight: 800;
              color: #0f172a;
              margin: 0;
            }
            .subtitle {
              color: #64748b;
              font-size: 0.95rem;
              margin-top: 5px;
            }
            h2 {
              font-size: 1.5rem;
              font-weight: 700;
              margin-top: 40px;
              color: #1e3a8a;
              border-bottom: 1px solid #cbd5e1;
              padding-bottom: 8px;
              page-break-after: avoid;
            }
            h3 {
              font-size: 1.15rem;
              font-weight: 600;
              margin-top: 25px;
              color: #0f172a;
              page-break-after: avoid;
            }
            p {
              margin: 0 0 15px 0;
              font-size: 0.95rem;
              color: #334155;
            }
            ul, ol {
              margin: 0 0 20px 0;
              padding-left: 25px;
              font-size: 0.95rem;
              color: #334155;
            }
            li {
              margin-bottom: 8px;
            }
            .screenshot-container {
              margin: 30px 0;
              text-align: center;
              background: #f8fafc;
              border: 1px solid #e2e8f0;
              padding: 15px;
              border-radius: 12px;
              page-break-inside: avoid;
            }
            .screenshot {
              max-width: 100%;
              max-height: 350px;
              border-radius: 8px;
              border: 1px solid #e2e8f0;
              box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.05);
            }
            .caption {
              font-size: 0.8rem;
              color: #64748b;
              font-style: italic;
              margin-top: 8px;
              display: block;
            }
            .page-break {
              page-break-before: always;
            }
            @media print {
              body {
                padding: 20px;
              }
              .no-print {
                display: none;
              }
            }
          </style>
        </head>
        <body>
          <div class="header-container">
            <div>
              <h1>Visitor Management System (VMS) User Manual</h1>
              <div class="subtitle">Complete Operational Manual for Dashboard Access Controls & Settings</div>
            </div>
            <button class="no-print" onclick="window.print()" style="padding: 10px 20px; background: #2563eb; color: white; border: none; border-radius: 6px; font-weight: 600; cursor: pointer;">
              Print / Save PDF
            </button>
          </div>

          <!-- Section 1 -->
          <h2>1. Getting Started & Authentication</h2>
          <p>The platform uses role-based access to route users to their respective dashboards. If your dashboard access is invalidated, the system handles logins using an automated remote re-login approval workflow.</p>
          
          <div class="screenshot-container">
            <img src="${loginPageImg}" class="screenshot" />
            <span class="caption">Figure 1.1: Authentication view featuring customizable branding name and corporate logo assets</span>
          </div>

          <h3>1.1 Steps to Authenticate</h3>
          <ul>
            <li>Enter your registered **Email Address** and **Password** credentials.</li>
            <li>Click **Sign In** to navigate to your dashboard panel.</li>
            <li>In the event of password resets or session invalidations by the Super Admin, the client dashboard will log out and immediately display a "Remote Re-authenticating" wait screen.</li>
          </ul>

          <div class="screenshot-container">
            <img src="${initialPageImg}" class="screenshot" />
            <span class="caption">Figure 1.2: System Initialization and licensing state signature verification page</span>
          </div>

          <!-- Section 2 -->
          <div class="page-break"></div>
          <h2>2. Admin Dashboard Operations</h2>
          <p>The Admin Dashboard allows complete operational control over user credentials, site parameters, and remote authentication triggers.</p>
          
          <div class="screenshot-container">
            <img src="${dashboardViewImg}" class="screenshot" />
            <span class="caption">Figure 2.1: Admin Dashboard overview displaying total user count, active visitors, pending entries, and active alerts</span>
          </div>

          <h3>2.1 User Management</h3>
          <ul>
            <li>Add, list, or suspend accounts for Host and Security roles.</li>
            <li>Click "Add User" in the header to create credentials and assign departments.</li>
            <li>Change user profile photos directly from the avatar controls in the grid list.</li>
          </ul>

          <h3>2.2 Remote Session Auto-Login</h3>
          <p>Allows admins to authorize logins remotely on target machines (e.g. reception lobby screens or security guard tablets) without physically typing passwords on those systems.</p>
          
          <div class="screenshot-container">
            <img src="${remoteSessionsImg}" class="screenshot" />
            <span class="caption">Figure 2.2: Remote Session Manager panel listing Host and Security user roles and Auto-Login controls</span>
          </div>

          <!-- Section 3 -->
          <div class="page-break"></div>
          <h2>3. Security & Reception Desk Dashboard</h2>
          <p>Security guard staff use this dashboard to log, verify, and track incoming visitors, vehicles, and accompanying devices.</p>

          <div class="screenshot-container">
            <img src="${registerPageImg}" class="screenshot" />
            <span class="caption">Figure 3.1: Detailed walk-in visitor entry registration page</span>
          </div>

          <h3>3.1 Check-in Workflow</h3>
          <ul>
            <li>Scan and enter visitor ID details and select their target Host.</li>
            <li>Take visitor webcam photos and upload front/side photographs of vehicles when necessary.</li>
            <li>Manage accompanying devices (laptops, cameras, storage drives) by logging make and serial numbers.</li>
          </ul>

          <div class="screenshot-container">
            <img src="${logoVerificationImg}" class="screenshot" />
            <span class="caption">Figure 3.2: Navbar view displaying real-time operational status, system clock, and current date alerts</span>
          </div>

          <!-- Section 4 -->
          <div class="page-break"></div>
          <h2>4. Super Admin Global Settings</h2>
          <p>Super Admins configure system settings, upload client assets, verify software license bounds, and control role-based credentials.</p>

          <div class="screenshot-container">
            <img src="${modalViewImg}" class="screenshot" />
            <span class="caption">Figure 4.1: System configuration settings console</span>
          </div>

          <h3>4.1 Global Features</h3>
          <ul>
            <li><strong>Branding Settings:</strong> Upload PNG logo assets and brand titles which immediately apply to all dashboards.</li>
            <li><strong>Database Purging:</strong> Clear visitor log history older than a specified duration to optimize disk usage.</li>
            <li><strong>Role Password Controls:</strong> Reset role passwords and automatically log out active sessions.</li>
          </ul>

          <script>
            window.onload = function() {
              window.print();
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="um-modal-overlay">
      <div className="um-modal-container">
        <div className="um-modal-header">
          <div className="um-modal-title">
            <BookOpen size={22} className="um-title-icon" />
            <h3>Visitor Management System (VMS) User Manual</h3>
          </div>
          <button className="um-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="um-modal-body">
          {/* Sidebar */}
          <div className="um-sidebar">
            {sections.map((sec) => (
              <button
                key={sec.id}
                className={`um-sidebar-item ${activeSection === sec.id ? "active" : ""}`}
                onClick={() => setActiveSection(sec.id)}
              >
                {sec.icon}
                <span>{sec.label}</span>
              </button>
            ))}
          </div>

          {/* Content Area */}
          <div className="um-content">
            {activeSection === "getting-started" && (
              <div className="um-section fade-in">
                <h2>🔑 Getting Started & Authentication</h2>
                <p>
                  Welcome to the Visitor Management System. The platform is accessible via role-based credentials.
                  To access your specific interface, open the landing portal, choose your action, or proceed to the login page.
                </p>
                <div className="um-screenshot-container">
                  <img src={loginPageImg} alt="VMS Login Page" className="um-screenshot" />
                  <span className="um-screenshot-caption">Figure 1.1: Unified Login interface with Custom Branding & Logo support</span>
                </div>
                <h3>Steps to Authenticate:</h3>
                <ul>
                  <li>Enter your registered <strong>Email Address</strong> and <strong>Password</strong>.</li>
                  <li>Click <strong>Sign In</strong> to navigate to your authorized dashboard.</li>
                  <li>If the Super Admin has modified user credentials or forced a session reset, active systems will be safely logged out and will display a <strong>Remote Re-authenticating</strong> poll screen.</li>
                  <li>Simply wait on the polling screen while the administrator authorizes the re-login from the Admin console.</li>
                </ul>
                <div className="um-screenshot-container">
                  <img src={initialPageImg} alt="Licensing Verification Screen" className="um-screenshot" />
                  <span className="um-screenshot-caption">Figure 1.2: System Initialization and licensing state signature verification page</span>
                </div>
              </div>
            )}

            {activeSection === "admin" && (
              <div className="um-section fade-in">
                <h2>📈 Admin Dashboard Functionalities</h2>
                <p>
                  The Admin Dashboard is the central operational hub for tenant administrators. It allows management of sites, users, and remote session parameters.
                </p>
                <div className="um-screenshot-container">
                  <img src={dashboardViewImg} alt="Admin Dashboard Layout" className="um-screenshot" />
                  <span className="um-screenshot-caption">Figure 2.1: Admin Dashboard overview showing user counts, active visitors, and site status</span>
                </div>
                <h3>Key Features:</h3>
                <ol>
                  <li>
                    <strong>User Management:</strong> View and manage hosts, security guards, and other admins. Use the <em>Add User</em> button to register new entries.
                  </li>
                  <li>
                    <strong>Sites Management:</strong> Monitor operational units, check-in records, and site status.
                  </li>
                  <li>
                    <strong>Emergency Muster Roll:</strong> View live visitors currently on the premises and click <em>Export Report</em> to download emergency attendance logs.
                  </li>
                  <li>
                    <strong>Remote Sessions Auto-Re-login:</strong>
                    <p style={{ margin: "5px 0 0 0", color: "#627d98" }}>
                      Navigate to the <em>Remote Sessions</em> tab, select a Host or Security user who has been logged out, enter their credentials, and authorize their remote re-login directly.
                    </p>
                    <div className="um-screenshot-container" style={{ marginTop: "1rem" }}>
                      <img src={remoteSessionsImg} alt="Remote Sessions Management" className="um-screenshot" />
                      <span className="um-screenshot-caption">Figure 2.2: Remote Sessions panel listing Host & Security accounts with Auto-Login action controls</span>
                    </div>
                  </li>
                </ol>
              </div>
            )}

            {activeSection === "host" && (
              <div className="um-section fade-in">
                <h2>🏠 Host Dashboard Functionalities</h2>
                <p>
                  Hosts can invite, approve, and track visitors scheduled to meet them.
                </p>
                <h3>Primary Capabilities:</h3>
                <ul>
                  <li><strong>Pre-Register Visitors:</strong> Fill out visit details, name, company name, scheduled date, and purpose of visit to send invitations.</li>
                  <li><strong>Request Authorization:</strong> Accept or decline visit requests initiated by visitors from the reception terminal.</li>
                  <li><strong>Check-in History:</strong> View logs of past checked-in visitors who met with you.</li>
                </ul>
              </div>
            )}

            {activeSection === "security" && (
              <div className="um-section fade-in">
                <h2>🛡️ Security Dashboard Functionalities</h2>
                <p>
                  The Security Dashboard is tailored for reception desks and gate security guards. It governs the physical entry/exit of guests and vehicles.
                </p>
                <div className="um-screenshot-container">
                  <img src={registerPageImg} alt="Visitor Registration" className="um-screenshot" />
                  <span className="um-screenshot-caption">Figure 3.1: Detailed walk-in visitor entry registration page</span>
                </div>
                <h3>Core Workflows:</h3>
                <ul>
                  <li><strong>Verify and Check-in Visitors:</strong> Scan visitor ID proofs, verify scheduled hosts, capture vehicle numbers, register accompanying devices, and check them in.</li>
                  <li><strong>Temporary Check-out/Check-in:</strong> Manage visitors who temporarily leave the premises (e.g., lunch breaks) and log their duration correctly.</li>
                  <li><strong>Physical Checkout:</strong> Log checkout times upon visitor departure to maintain correct muster tallies.</li>
                </ul>
                <div className="um-screenshot-container">
                  <img src={logoVerificationImg} alt="Navbar Status Bar" className="um-screenshot" />
                  <span className="um-screenshot-caption">Figure 3.2: Navbar view displaying real-time operational status, system clock, and current date alerts</span>
                </div>
              </div>
            )}

            {activeSection === "superadmin" && (
              <div className="um-section fade-in">
                <h2>⚙️ Super Admin Console Settings</h2>
                <p>
                  The Super Admin Console governs global licensing parameters, database purges, role default passwords, and company styling assets.
                </p>
                <div className="um-screenshot-container">
                  <img src={modalViewImg} alt="System Configuration" className="um-screenshot" />
                  <span className="um-screenshot-caption">Figure 4.1: Global configuration modal for purging durations, license keys, and branding logos</span>
                </div>
                <h3>Administrative Options:</h3>
                <ul>
                  <li><strong>Company Custom Branding:</strong> Upload corporate logos (PNG formats) and brand titles to personalize the portal headers.</li>
                  <li><strong>License Management:</strong> Set license bounds, extend activation keys, or review system health.</li>
                  <li><strong>Role Passwords & Defaults:</strong> Change passwords for all users of a dashboard role (Admin, Host, Security) and force log out active sessions. Setup role-based default passwords for initial creation.</li>
                </ul>
              </div>
            )}
          </div>
        </div>

        <div className="um-modal-footer">
          <div className="um-info-badge">
            <Info size={14} />
            <span>VMS v1.2.0 • Secure Corporate Environment</span>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button className="sa-btn sa-btn-secondary" onClick={handleDownloadPDF} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Download size={16} /> Download Manual (PDF)
            </button>
            <button className="sa-btn sa-btn-primary" onClick={onClose}>
              Got It
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
