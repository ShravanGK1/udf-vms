# VMS Productization — Phase 3 Windows Test Plan

## 1. Overview & Objectives

This test plan defines the verification strategy for the Windows runtime bundling, service automation, and LAN HTTPS access layers of the **Visitor Management System (VMS)**.

The goal is to validate that the application functions reliably on a self-hosted Windows machine (Windows 10, Windows 11, and Windows Server 2019/2022) without requiring client-installed dependencies (Python, Node.js, Docker) or terminal operations.

---

## 2. Test Environment Matrix

| Parameter | Specification |
| :--- | :--- |
| **Target OS Platforms** | Windows 10 Pro (22H2+), Windows 11 Pro (23H2+), Windows Server 2022 Standard |
| **Architecture** | 64-bit (x86_64) |
| **Execution User** | Standard Local Administrator (during install), Service Account (runtime) |
| **Network Contexts** | 1. Localhost (`127.0.0.1`)<br>2. Local Area Network (`192.168.x.x` / `10.x.x.x`) |
| **Client Browsers** | Google Chrome (Latest), Microsoft Edge (Latest), Mozilla Firefox (Latest) |

---

## 3. Comprehensive Verification Matrix

### Category A: Frontend Production Build & Static Serving
- **Test A-1: Production Bundle Compilation**
  - *Method*: Execute `npm run build` in `vms/vms_frontend`.
  - *Pass Criteria*: Generates optimized `dist/` with `index.html`, CSS, and JS chunks with zero syntax errors.
- **Test A-2: Client-Side SPA Route Refresh**
  - *Method*: Navigate to `/admin/dashboard` or `/setup`, then trigger a hard browser refresh (F5).
  - *Pass Criteria*: Reverse proxy serves `index.html` via `try_files`, React Router re-hydrates the page, no HTTP 404 occurs.
- **Test A-3: Hardcoded Development Host Absence**
  - *Method*: Search compiled `dist/*.js` files for `localhost:5173` or developer IP addresses.
  - *Pass Criteria*: API requests strictly use relative `/api` base.

---

### Category B: Backend Windows WSGI (Waitress) Runtime
- **Test B-1: Waitress Module & Startup**
  - *Method*: Execute `python run_windows.py`.
  - *Pass Criteria*: Starts multithreaded Waitress server without POSIX `gunicorn` crashes.
- **Test B-2: Internal Loopback Binding**
  - *Method*: Inspect active socket listeners via `netstat -ano | findstr :5000`.
  - *Pass Criteria*: Port 5000 binds strictly to `127.0.0.1`, not `0.0.0.0` or public interface.
- **Test B-3: Multithreaded Request Concurrency**
  - *Method*: Dispatch 20 concurrent HTTP requests to `/api/setup/status`.
  - *Pass Criteria*: All requests respond with HTTP 200 within 500ms without thread starvation.

---

### Category C: Database Engine & Runtime
- **Test C-1: MariaDB 10.11 Portable Initialization**
  - *Method*: Run `mariadb-install-db.exe --datadir="C:\ProgramData\VMS\data"`.
  - *Pass Criteria*: Creates system tables and `ibdata1` cleanly in persistent directory.
- **Test C-2: Loopback Network Isolation**
  - *Method*: Attempt TCP connection from a remote LAN computer to `[Server-IP]:3306`.
  - *Pass Criteria*: Connection refused; database is accessible strictly on `127.0.0.1`.
- **Test C-3: Idempotent Clean Schema Deployment**
  - *Method*: Execute `python setup_database.py`.
  - *Pass Criteria*: Creates all 10 tables with zero mock records. Re-running completes with 0 errors.

---

### Category D: HTTPS & LAN Camera Security Context
- **Test D-1: Local CA Certificate Generation**
  - *Method*: Start Caddy reverse proxy on port 443 with `tls internal`.
  - *Pass Criteria*: Generates root CA certificate and serves valid TLS on port 443.
- **Test D-2: Remote Workstation Webcam Permission**
  - *Method*: Open `https://[Server-IP]/` from a receptionist laptop on the same office LAN.
  - *Pass Criteria*: Browser grants `navigator.mediaDevices.getUserMedia` access; live camera feed captures visitor photo.
- **Test D-3: Plain HTTP Camera Failure Verification**
  - *Method*: Access `http://[Server-IP]/` without HTTPS.
  - *Pass Criteria*: Browser blocks camera API per W3C Secure Context rules; proves necessity of bundled HTTPS.

---

### Category E: Windows Service Lifecycle (WinSW)
- **Test E-1: Service Registration**
  - *Method*: Run `install_services.ps1`.
  - *Pass Criteria*: `VMS-Database`, `VMS-Backend`, and `VMS-Proxy` appear in `services.msc`.
- **Test E-2: Startup Sequence & Health**
  - *Method*: Run `start_services.ps1`.
  - *Pass Criteria*: Database starts, then backend, then proxy. `check_services.py` reports HEALTHY.
- **Test E-3: Machine Reboot Recovery**
  - *Method*: Restart Windows host machine.
  - *Pass Criteria*: All 3 services automatically start upon system boot before any user logs in.
- **Test E-4: Crash / Failure Recovery**
  - *Method*: Terminate `python.exe` process via Task Manager.
  - *Pass Criteria*: WinSW detects process exit and restarts the backend within 5 seconds.

---

### Category F: Security & Data Isolation
- **Test F-1: Multi-Customer Data Isolation**
  - *Method*: Run `test_multi_customer_isolation.py`.
  - *Pass Criteria*: 100% pass; cross-customer access strictly blocked with 403 Forbidden.
- **Test F-2: First-Run Setup Replay Lock**
  - *Method*: Run `test_phase1_2_initialization.py`.
  - *Pass Criteria*: Setup endpoint locks permanently after initial administrator creation.
