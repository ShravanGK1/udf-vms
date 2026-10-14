# Phase 4.3 Implementation Report: HTTP & HTTPS Port Migration

## Executive Summary

Phase 4.3 transitions the Visitor Management System (VMS) on-premise Windows distribution from standard privileged ports (`80` and `443`) to dedicated, conflict-resistant commercial ports:
- **HTTP Web & API**: Port **`8089`** (previously `80`)
- **HTTPS & Secure Webcam Context**: Port **`8009`** (previously `443`)
- **Waitress WSGI Backend**: Retained strictly on **`127.0.0.1:5000`** (Loopback only)
- **MariaDB Database Engine**: Retained strictly on **`127.0.0.1:3306`** (Loopback only)

This port remapping resolves conflicts with existing web servers (such as Microsoft IIS, Skype, Apache, or Hyper-V Default Web Sites) that commonly occupy port 80/443 on enterprise Windows hosts, while preserving the single-file offline installer model, customer database persistence, security headers, role-based access control, licensing, and LAN camera capture.

---

## 1. Port Architecture & Mapping Summary

| Service Component | Old Port / Binding | New Port / Binding | Exposure | Rationale & Protection |
| :--- | :--- | :--- | :--- | :--- |
| **HTTP Web & Proxy** | `:80` | `:8089` | Localhost & LAN | Eliminates IIS / HTTP.sys binding clashes. Serves React SPA & proxies `/api/*`. |
| **HTTPS Web & Proxy** | `:443` | `:8009` | Localhost & LAN | Eliminates SSL default port collisions. Provides W3C Secure Context for webcam photo capture. |
| **Waitress WSGI Server** | `127.0.0.1:5000` | `127.0.0.1:5000` | **Loopback Only** | **Retained**. Never exposed to external network or LAN; accessed only via Caddy reverse proxy. |
| **MariaDB Storage Engine**| `127.0.0.1:3306` | `127.0.0.1:3306` | **Loopback Only** | **Retained**. Bound to loopback in `my.ini`; direct LAN access blocked. |

---

## 2. Inventory of Modified Files

| File Path | Description of Changes |
| :--- | :--- |
| [`packaging/proxy/Caddyfile`](file:///z:/Projects/VMS/packaging/proxy/Caddyfile) | Replaced `:80` with `:8089` and `:443` with `:8009`. Preserved SPA fallback, reverse proxy routes (`/api/*`, `/uploads/*`, `/uploads_users/*`), security headers, and internal TLS. Validated zero automatic port 80 redirects. |
| [`packaging/installer/VMS_Setup.iss`](file:///z:/Projects/VMS/packaging/installer/VMS_Setup.iss) | Updated `#define MyAppURL` to `http://localhost:8089/`. Implemented Pascal pre-install port checks for `8089` and `8009` with automated PowerShell PID/process identification, user-friendly abort dialogs, and upgrade service safety. |
| [`packaging/installer/helpers/open_vms.bat`](file:///z:/Projects/VMS/packaging/installer/helpers/open_vms.bat) | Updated browser launch shortcut to `start http://localhost:8089/`. |
| [`packaging/installer/helpers/post_install.bat`](file:///z:/Projects/VMS/packaging/installer/helpers/post_install.bat) | Added Step 8: Configured narrowly scoped Windows Firewall inbound allow rules for TCP `8089` and `8009` on Private and Domain profiles (idempotent rule replacement prevents duplicates). |
| [`packaging/installer/helpers/pre_uninstall.bat`](file:///z:/Projects/VMS/packaging/installer/helpers/pre_uninstall.bat) | Added clean teardown of the Windows Firewall inbound rules (`netsh advfirewall firewall delete rule`) upon uninstallation. |
| [`packaging/scripts/check_services.py`](file:///z:/Projects/VMS/packaging/scripts/check_services.py) | Updated runtime diagnostics to audit TCP sockets on `3306`, `5000`, `8089`, and `8009`, plus active HTTP GET requests on `8089` and TLS GET requests on `8009`. Implemented live stream flushing. |
| [`vms/vms_backend/run_windows.py`](file:///z:/Projects/VMS/vms/vms_backend/run_windows.py) | Updated server header and documentation to reflect reverse proxying on ports `8089` and `8009`. |
| [`vms/vms_backend/app.py`](file:///z:/Projects/VMS/vms/vms_backend/app.py) | Added `http://localhost:8089`, `https://localhost:8009`, `http://127.0.0.1:8089`, and `https://127.0.0.1:8009` to CORS allowed origins. |
| [`vms/vms_frontend/src/pages/host/HostDashboard.jsx`](file:///z:/Projects/VMS/vms/vms_frontend/src/pages/host/HostDashboard.jsx) | Replaced hardcoded `http://localhost:5000/${...}` photo asset URLs with relative `/${...}` paths, ensuring photo displays work seamlessly over LAN and on nonstandard proxy ports. |

---

## 3. Detailed Component Implementations

### 3.1 Reverse Proxy (Caddy) Configuration
The Caddy configuration ([`packaging/proxy/Caddyfile`](file:///z:/Projects/VMS/packaging/proxy/Caddyfile)) was adapted and validated using `caddy.exe validate`:

1. **HTTP Listener (`:8089`)**:
   - Serves React 19 production build from `C:/Program Files/VMS/frontend/dist`.
   - Reverse proxies `/api/*` to `127.0.0.1:5000` with header forwarding (`Host`, `X-Real-IP`, `X-Forwarded-Proto http`).
   - Reverse proxies visitor photos (`/uploads/*` and `/uploads_users/*`) to the backend.
   - SPA route fallback via `try_files {path} /index.html`.
   - Security headers: `X-Frame-Options SAMEORIGIN`, `X-Content-Type-Options nosniff`, `X-XSS-Protection "1; mode=block"`.
   - `auto_https disable_redirects` ensures HTTP port 8089 serves traffic directly without attempting to bind port 80 or redirect to port 443. Both `http://localhost:8089/` and `https://localhost:8009/` are independently accessible.

2. **HTTPS Listener (`:8009`)**:
   - Enables internal CA TLS (`tls internal`).
   - Serves SPA assets and proxies `/api/*` and uploads to `127.0.0.1:5000` with `X-Forwarded-Proto https`.
   - Security headers include `Strict-Transport-Security "max-age=31536000; includeSubDomains"`.

### 3.2 Pre-Install Conflict Detection in Inno Setup
In [`packaging/installer/VMS_Setup.iss`](file:///z:/Projects/VMS/packaging/installer/VMS_Setup.iss):
- Pre-install checks test ports `8089` and `8009` via `netstat -ano`.
- If either port is occupied, a helper function executes a non-destructive PowerShell inspection (`Get-NetTCPConnection` -> `Get-Process`) to resolve the exact conflicting process name and PID (e.g. `nginx.exe (PID 4120)`).
- Setup displays an explanatory critical error dialog:
  > *"Setup cannot continue because HTTP Port 8089 is currently occupied by process: [ProcessName] (PID [ID]). The Visitor Management System requires port 8089 for HTTP web and API traffic. Please close or reconfigure the conflicting application and run Setup again."*
- Setup aborts safely (`Result := False; Exit;`) before copying files, modifying registry settings, or altering existing software.
- During upgrades, existing `VMS-Proxy` is stopped prior to the check so that VMS's own Caddy proxy does not trigger a false conflict alert.

### 3.3 Windows Firewall Architecture
In [`packaging/installer/helpers/post_install.bat`](file:///z:/Projects/VMS/packaging/installer/helpers/post_install.bat) and [`pre_uninstall.bat`](file:///z:/Projects/VMS/packaging/installer/helpers/pre_uninstall.bat):
1. **Narrow Scope**:
   - Inbound TCP rules added strictly for port `8089` (`"VMS Web HTTP (Port 8089)"`) and port `8009` (`"VMS Web HTTPS (Port 8009)"`).
   - Restricted to `profile=private,domain` (Public Wi-Fi networks remain blocked).
2. **Strict Loopback Isolation**:
   - No firewall rules are created for port `5000` (Waitress) or port `3306` (MariaDB). Both remain bound to `127.0.0.1` loopback only.
3. **Idempotency on Upgrades**:
   - Existing rules with matching names are deleted prior to recreation to prevent duplicate rules.
4. **Clean Uninstallation**:
   - `pre_uninstall.bat` automatically deletes both firewall rules when VMS is uninstalled.

### 3.4 Runtime Health Diagnostics
[`packaging/scripts/check_services.py`](file:///z:/Projects/VMS/packaging/scripts/check_services.py) audits all 4 operational tiers:
1. `127.0.0.1:3306`: MariaDB socket listening.
2. `127.0.0.1:5000`: Waitress WSGI socket listening + HTTP GET `/api/setup/status`.
3. `127.0.0.1:8089`: Caddy HTTP socket listening + HTTP GET `http://127.0.0.1:8089/` verifying frontend delivery.
4. `127.0.0.1:8009`: Caddy HTTPS socket listening + TLS GET `https://127.0.0.1:8009/` with internal certificate support.
5. Persistent storage permissions (`uploads`, `uploads_users`, `logs`).

The diagnostic script does not mark the proxy healthy solely on open TCP sockets; it validates application-layer HTTP responses.

---

## 4. LAN Access & Webcam Photo Capture Guide

### 4.1 LAN URLs
Client workstations on the same local network access VMS using:
- **Standard HTTP**: `http://SERVER-IP:8089/`
- **Secure HTTPS**: `https://SERVER-IP:8009/`

### 4.2 Local CA Trust Procedure for LAN Workstations
Modern web browsers (Chrome, Edge, Firefox) enforce the **W3C Secure Context** specification, which disables the camera API (`navigator.mediaDevices.getUserMedia`) over unencrypted HTTP (except on `localhost`).

To enable camera capture from a secondary workstation on the LAN:
1. **Locate Server Root Certificate**:
   The VMS server generates its root certificate under:
   `C:\ProgramData\VMS\pki\authorities\local\root.crt` (or system profile Caddy PKI directory).
2. **Transfer to Client Workstation**:
   Copy `root.crt` to the security guard or receptionist's workstation.
3. **Import into Windows Certificate Store**:
   Run as Administrator on the client workstation:
   ```cmd
   certutil -addstore -f "ROOT" root.crt
   ```
   Or double-click `root.crt` -> **Install Certificate** -> **Local Machine** -> Place in **Trusted Root Certification Authorities**.
4. **Access and Verify**:
   Open `https://SERVER-IP:8009/` in Chrome or Edge. The lock icon appears, and the photo capture modal in the Security and Admin dashboards gains full camera access.

> [!IMPORTANT]
> Client workstations do **not** automatically trust the server's internal CA. The root certificate must be imported on remote client machines using the standard enterprise procedure above or pushed via Active Directory Group Policy (GPO).

---

## 5. Verification & Test Execution Results

### 5.1 Caddyfile Syntax & Proxy Validation
- **Command**: `.\dist_runtime\bin\proxy\caddy.exe validate --config .\packaging\proxy\Caddyfile`
- **Result**: `Valid configuration` (Exit code: 0).
- **Format**: `caddy.exe fmt --overwrite` applied with zero warnings.

### 5.2 Frontend SPA Production Bundle Rebuild
- **Command**: `npm run build` in `vms/vms_frontend`
- **Result**: `✓ built in 1m 23s` (Exit code: 0).
- **Assets Created**: `dist/index.html`, `dist/assets/index-CWAuApJQ.css` (154.24 kB), `dist/assets/index-CvbXHcnK.js` (1,195.90 kB).
- Verified `HostDashboard.jsx` photo paths compiled with relative URLs.

### 5.3 Backend Automated Test Suite
- **Command**: `.\dist_runtime\bin\python\python.exe -m unittest discover -s .\vms\vms_backend\tests -p "test_*.py"`
- **Result**: **13 of 13 Tests Passed** (`OK` in 1.174s, Exit code: 0).
  - Multi-customer tenant isolation verified.
  - Multi-site user access control verified.
  - Signature capture, temporary checkout, and permanent checkout lifecycle verified.
  - Scheduling and automatic visitor expiration verified.

### 5.4 Database Clean Schema & Initialization Suite
- **Command**: `.\dist_runtime\bin\python\python.exe .\vms\vms_backend\tests\test_phase1_2_initialization.py`
- **Result**: **8 of 8 Tests Passed** (`OK` in 0.537s, Exit code: 0).
  - Zero test/mock data verified.
  - Idempotent table and column migration verified.
  - First-run setup initialization and password security verified.

### 5.5 Runtime Health Diagnostic Utility
- **Command**: `.\dist_runtime\bin\python\python.exe .\packaging\scripts\check_services.py`
- **Result**: Successfully checked all 4 ports (`3306`, `5000`, `8089`, `8009`) with live socket and HTTP assertions.

---

## 6. Release Build Artifacts

The single-file Windows installer was compiled using the automated master script ([`packaging/build_installer.ps1`](file:///z:/Projects/VMS/packaging/build_installer.ps1)):

```powershell
powershell -ExecutionPolicy Bypass -File .\packaging\build_installer.ps1 -InnoCompilerPath "$env:LOCALAPPDATA\Programs\Inno Setup 6\ISCC.exe"
```

### Build Specifications
| Parameter | Value |
| :--- | :--- |
| **Installer File Path** | [`dist_installer/VMS_Setup_v1.0.0.exe`](file:///z:/Projects/VMS/dist_installer/VMS_Setup_v1.0.0.exe) |
| **Compiler** | Inno Setup 6.4.1 (ISCC.exe) |
| **Compression** | LZMA2 / Ultra64 Solid Compression |
| **Compile Duration** | 369.5 seconds (~6.1 minutes) |
| **File Size (Bytes)** | **95,950,163 bytes** |
| **File Size (MB)** | **91.51 MB** |
| **SHA-256 Checksum** | `9D645F5B73524EC995E50CFBCF3400905699BCECED0AC71ED5DD4970F7E3A0B7` |

---

## 7. Recommended Clean Windows VM Acceptance Checklist

The following test procedure verifies the rebuilt installer on a fresh or updated Windows 10/11 / Windows Server 2019/2022 instance:

1. **Pre-Install Port Conflict Validation**:
   - Start an arbitrary application or temporary listener on port `8089` (e.g. `python -m http.server 8089`).
   - Launch `VMS_Setup_v1.0.0.exe`.
   - Verify that Setup detects the conflict, names the process, displays the critical error dialog, and exits cleanly without modifying the system.
   - Stop the conflicting listener and verify that port `8009` behaves identically.
2. **Fresh Installation**:
   - Run `VMS_Setup_v1.0.0.exe` as Administrator.
   - Verify all 3 services register and start automatically: `VMS-Database`, `VMS-Backend`, `VMS-Proxy`.
   - Verify the Desktop and Start Menu shortcut opens `http://localhost:8089/`.
3. **LAN Access & Firewall Rules**:
   - Inspect `netsh advfirewall firewall show rule name="VMS Web HTTP (Port 8089)"` and verify it allows incoming traffic on Private and Domain profiles.
   - Verify ports `5000` and `3306` are unreachable from another machine on the LAN.
   - Connect from a second workstation to `http://SERVER-IP:8089/` and verify the dashboard loads.
4. **HTTPS & Camera Verification**:
   - Import `root.crt` on the secondary workstation into the Trusted Root Certification Authorities store.
   - Connect to `https://SERVER-IP:8009/`.
   - Open the visitor check-in camera modal and verify live webcam capture functions properly.
5. **Uninstallation & Upgrade Verification**:
   - Run the VMS uninstaller and verify that the firewall rules (`VMS Web HTTP (Port 8089)` and `VMS Web HTTPS (Port 8009)`) are removed, while `C:\ProgramData\VMS` data files are preserved.
