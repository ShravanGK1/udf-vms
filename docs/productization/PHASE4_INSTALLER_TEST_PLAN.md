# VMS Productization — Phase 4 Installer Test Plan

## 1. Overview & Verification Scope

This test plan defines the end-to-end quality assurance and verification procedure for the **Visitor Management System (VMS) Single-File Windows Installer (`VMS_Setup.exe`)**.

The test plan exercises every phase of the client lifecycle:
1. Pre-installation environment and conflict checks.
2. Fresh unattended installation and service startup.
3. First-run administrator provisioning through the browser.
4. Application upgrades over an active customer database.
5. Service recovery and machine reboot behavior.
6. Uninstallation with strict customer data retention.

---

## 2. Test Environment Matrix

| Parameter | Specification |
| :--- | :--- |
| **Clean Test Environments** | 1. Windows 11 Pro 64-bit (Clean VM, No Dev Tools, No Docker)<br>2. Windows 10 Pro 64-bit (Version 22H2)<br>3. Windows Server 2022 Datacenter |
| **Privileges** | Standard Local Administrator account (triggers standard UAC prompt) |
| **Network Contexts** | 1. Localhost standalone (`127.0.0.1`)<br>2. Local Area Network (`192.168.1.0/24`) with secondary laptop client |
| **Browsers** | Google Chrome 120+, Microsoft Edge 120+, Mozilla Firefox 120+ |

---

## 3. Test Cases Specification

### Suite 1: Pre-Installation & Platform Validation
- **Test 1.1: Operating System & Architecture Gate**
  - *Setup*: Run installer on a 32-bit Windows system (or simulated via compatibility mode).
  - *Expected*: Installer blocks execution immediately with message: *"Visitor Management System requires a 64-bit (x64) Windows operating system."*
- **Test 1.2: Administrator Privilege Gate**
  - *Setup*: Launch `VMS_Setup.exe` from a standard non-admin user prompt without elevation.
  - *Expected*: Windows UAC prompt is displayed. If denied, setup safely aborts with error code.
- **Test 1.3: Port 80 / 443 Conflict Detection**
  - *Setup*: Start a temporary listener on port 80 (e.g., IIS or Python HTTP server) prior to launching setup.
  - *Expected*: Pascal script detects port 80 in `LISTENING` state and displays diagnostic confirmation dialog: *"Warning: Port 80 appears to be in use by another application..."*

---

### Suite 2: Fresh Clean-Machine Installation
- **Test 2.1: Binary & Persistent Directory Creation**
  - *Action*: Execute `VMS_Setup.exe` to completion with default options.
  - *Verification*:
    - `C:\Program Files\VMS\` created containing `backend\`, `frontend\dist\`, `bin\`, `config\`.
    - `C:\ProgramData\VMS\` created containing `data\`, `uploads\`, `uploads_users\`, `logs\`, `keys\`, `backups\`.
- **Test 2.2: Secret & Credential Generation**
  - *Action*: Inspect `C:\ProgramData\VMS\.env`.
  - *Verification*:
    - `SECRET_KEY` is present and contains exactly 64 random hexadecimal characters.
    - `DB_PASSWORD` is present, at least 32 characters, and high-entropy.
    - File permissions are restricted to Administrators and SYSTEM.
- **Test 2.3: MariaDB Data Directory Initialization**
  - *Action*: Inspect `C:\ProgramData\VMS\data\`.
  - *Verification*:
    - `ibdata1`, transaction logs, and `vms` directory exist.
    - `my.ini` is configured with `bind-address = 127.0.0.1`.
- **Test 2.4: Clean Schema Execution**
  - *Action*: Query database using `mysql.exe -u vms_app_user -p vms`.
  - *Verification*:
    - All 10 tables present (`customers`, `sites`, `users`, `user_sites`, `visitors`, `visitor_requests`, `system_license`, `system_settings`, `superadmin_audit_logs`, `role_permissions`).
    - `SELECT COUNT(*) FROM users` equals `0` (Zero mock data).
- **Test 2.5: Service Registration & Dependency Startup**
  - *Action*: Inspect `services.msc`.
  - *Verification*:
    - `VMS-Database`, `VMS-Backend`, and `VMS-Proxy` are registered.
    - All three services are in `Running` state and configured for `Automatic` startup.

---

### Suite 3: First-Run Provisioning Flow
- **Test 3.1: Automatic Browser Launch & Route Guard**
  - *Action*: Installer finishes.
  - *Verification*: Default browser automatically launches `http://localhost/` and redirects to `/setup`.
- **Test 3.2: Complete Setup Wizard Submission**
  - *Action*: Enter Organization ("Acme Corp"), Primary Site ("Headquarters", "HQ"), Admin Name ("Admin User"), Email ("admin@acme.com"), and Password ("AdminPass@2026").
  - *Verification*:
    - Submits to `POST /api/setup/initialize`.
    - Success card appears. User clicks "Sign In".
    - Logging in with `admin@acme.com` and `AdminPass@2026` succeeds with 200 OK.
- **Test 3.3: Replay Attack Defense**
  - *Action*: Re-open `http://localhost/setup` in browser.
  - *Verification*: Application immediately redirects to `/` (login). Submitting `POST /api/setup/initialize` via curl returns `403 Forbidden` (`SETUP_ALREADY_COMPLETED`).

---

### Suite 4: Upgrade Safety & Data Retention
- **Test 4.1: Existing Version Detection**
  - *Action*: Run `VMS_Setup.exe` on a machine with VMS already installed.
  - *Verification*: Installer detects existing version in registry and enables UPGRADE mode.
- **Test 4.2: Automated Pre-Upgrade Backup**
  - *Action*: Verify `C:\ProgramData\VMS\backups\`.
  - *Verification*: Pre-upgrade backup directory created containing copy of `.env` and `data/`.
- **Test 4.3: Service Shutdown Before File Copy**
  - *Action*: Monitor Windows services during upgrade file copy.
  - *Verification*: Services are paused so binaries are unlocked. No file copy lock errors occur.
- **Test 4.4: Preservation of Customer Data & Secrets**
  - *Action*: Verify `C:\ProgramData\VMS\.env` and database tables after upgrade.
  - *Verification*:
    - `SECRET_KEY` and `DB_PASSWORD` are unchanged.
    - Previously created users, sites, and visitor photos remain 100% intact.
    - No mock data or reset occurs.

---

### Suite 5: Uninstallation Safety
- **Test 5.1: Service Teardown**
  - *Action*: Run uninstaller from Windows Settings / Add or Remove Programs.
  - *Verification*: `VMS-Proxy`, `VMS-Backend`, and `VMS-Database` are stopped and removed from `services.msc`.
- **Test 5.2: Binary Removal**
  - *Action*: Check `C:\Program Files\VMS\`.
  - *Verification*: All application binaries are deleted.
- **Test 5.3: Strict Customer Data Retention**
  - *Action*: Inspect `C:\ProgramData\VMS\`.
  - *Verification*:
    - `C:\ProgramData\VMS\data\` (Database) is **INTACT**.
    - `C:\ProgramData\VMS\uploads\` (Photos) is **INTACT**.
    - `C:\ProgramData\VMS\.env` (Secrets) is **INTACT**.

---

### Suite 6: HTTPS & LAN Camera Security Context
- **Test 6.1: Local Server CA Trust Installation**
  - *Action*: Installer executes `caddy.exe trust` in elevated post-installation action.
  - *Verification*: Caddy local root CA is installed in `Certificates (Local Computer) -> Trusted Root Certification Authorities` on the host server.
- **Test 6.2: Remote LAN Workstation Certificate Import & Camera Verification**
  - *Prerequisite Note*: `caddy.exe trust` on the server machine only installs the local root CA on the *server itself*. Workstations on the office LAN connecting to `https://[Server-IP]/` will not trust the server's certificate by default.
  - *Workstation Trust Step*:
    1. Export Caddy's root certificate from the server (`%ProgramData%\caddy\pki\authorities\local\root.crt` or download via browser).
    2. Import `root.crt` on the receptionist workstation into `Certificates (Local Computer) -> Trusted Root Certification Authorities`.
  - *Action*: On the receptionist computer on the LAN, navigate to `https://[Server-IP]/` in Chrome/Edge.
  - *Verification*:
    - Address bar shows secure padlock (HTTPS) with zero SSL/TLS warnings.
    - Receptionist opens "Create Security Pass" (`/security/dashboard`).
    - Browser camera prompt appears; receptionist grants camera permission.
    - Video preview renders live at 30fps without `getUserMedia` security block.
    - Photo snapshot captures cleanly and saves to `C:\ProgramData\VMS\uploads\`.
