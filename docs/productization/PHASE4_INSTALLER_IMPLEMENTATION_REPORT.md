# VMS Productization — Phase 4: Inno Setup Single-File Installer Implementation Report

## 1. Executive Summary

This report documents the implementation and completion of **Phase 4 (Inno Setup Single-File Windows Installer)** for the commercial distribution of the **Visitor Management System (VMS)** as an on-premise, turnkey software product.

### Core Achievements
1. **Single-File Inno Setup Script**: Authored [`packaging/installer/VMS_Setup.iss`](file:///z:/Projects/VMS/packaging/installer/VMS_Setup.iss), a production-grade Inno Setup 6 configuration that packages the entire application into a single setup executable ([`dist_installer/VMS_Setup_v1.0.0.exe`](file:///z:/Projects/VMS/dist_installer/VMS_Setup_v1.0.0.exe)).
2. **Elevated Guided Installation Flow**:
   - Performs automated pre-installation checks: 64-bit architecture, Windows 10+ build 17763+, disk space, and Port 80/443 conflict detection.
   - Installs replaceable application binaries to `C:\Program Files\VMS\`.
   - Initializes persistent data to `C:\ProgramData\VMS\`.
3. **Automated Post-Installation Orchestration**:
   - Created [`packaging/installer/helpers/post_install.bat`](file:///z:/Projects/VMS/packaging/installer/helpers/post_install.bat), which silently generates unique installation secrets (`.env`), initializes the MariaDB portable data directory, starts the database engine, deploys the clean database schema (`schema_clean.sql`), installs Windows services via WinSW, installs local CA certificate trust for LAN webcam access, and verifies health.
4. **Upgrade & Data Protection**:
   - Registry-based upgrade detection (`AppId={{A65F3294-712F-4A9B-983C-B6D743D2F710}}`).
   - Automatically pauses running services and executes a pre-upgrade database backup ([`packaging/installer/helpers/backup_database.bat`](file:///z:/Projects/VMS/packaging/installer/helpers/backup_database.bat)).
   - **Zero Data Loss**: Upgrades strictly preserve existing customer secrets, databases, visitor photos, and license tokens.
5. **Customer Data Retention on Uninstall**:
   - Created [`packaging/installer/helpers/pre_uninstall.bat`](file:///z:/Projects/VMS/packaging/installer/helpers/pre_uninstall.bat) to stop and unregister services.
   - Uninstallation removes binary files but **preserves all customer databases, visitor photos, and configuration in `C:\ProgramData\VMS` by default**.
6. **Third-Party Redistribution Compliance**:
   - Verified and documented all redistributable components in [`packaging/installer/THIRD_PARTY_LICENSES.txt`](file:///z:/Projects/VMS/packaging/installer/THIRD_PARTY_LICENSES.txt) (MariaDB GPLv2, Python PSF, Caddy Apache 2.0, WinSW MIT, Waitress ZPL).
7. **Master Build Script & Compilation**:
   - Authored and updated [`packaging/build_installer.ps1`](file:///z:/Projects/VMS/packaging/build_installer.ps1), which verifies frontend production bundles, backend scripts, runtime staging directories, and compiles the final setup executable via Inno Setup Compiler (`ISCC.exe`).
   - **Compilation Verified**: `dist_installer\VMS_Setup_v1.0.0.exe` generated cleanly (Size: **91.48 MB**, 95,922,878 bytes).

---

## 2. Audit & Verification of Existing Codebase

The implementation builds upon the verified foundations of Phases 1, 2, and 3:

| Component | Verified Implementation Path | Role in Phase 4 Installer |
| :--- | :--- | :--- |
| **Clean Schema DDL** | [`vms/vms_backend/schema_clean.sql`](file:///z:/Projects/VMS/vms/vms_backend/schema_clean.sql) | Deployed by installer; contains all 10 tables with **0 mock users/records**. |
| **Database Setup** | [`vms/vms_backend/setup_database.py`](file:///z:/Projects/VMS/vms/vms_backend/setup_database.py) | Executed by `post_install.bat` during setup; idempotent and non-destructive. Features least-privilege bootstrap for `vms_app_user`. |
| **Setup API** | [`vms/vms_backend/routes/setup_routes.py`](file:///z:/Projects/VMS/vms/vms_backend/routes/setup_routes.py) | Powers `/api/setup/status` and `/api/setup/initialize` on initial launch. |
| **Setup Wizard UI** | [`vms/vms_frontend/src/pages/Setup/SetupWizard.jsx`](file:///z:/Projects/VMS/vms/vms_frontend/src/pages/Setup/SetupWizard.jsx) | Pre-compiled in `dist/`; guides administrator through initial provisioning. |
| **Windows Entry Point** | [`vms/vms_backend/run_windows.py`](file:///z:/Projects/VMS/vms/vms_backend/run_windows.py) | Runs Waitress WSGI server bound strictly to loopback (`127.0.0.1:5000`). |
| **Windows Dependencies** | [`vms/vms_backend/requirements-windows.txt`](file:///z:/Projects/VMS/vms/vms_backend/requirements-windows.txt) | Pinned Python packages for offline embedding in `dist_runtime/bin/python`. |
| **Reverse Proxy** | [`packaging/proxy/Caddyfile`](file:///z:/Projects/VMS/packaging/proxy/Caddyfile) | Reverse-proxies port 80/443 to Waitress, serving static SPA and providing TLS. |
| **Service Definitions** | [`packaging/services/vms-*.xml`](file:///z:/Projects/VMS/packaging/services/) | WinSW service configurations for Database, Backend, and Proxy. Staged to both `{app}\config` and `{app}\bin\winsw`. |
| **Credential Generator** | [`packaging/scripts/generate_credentials.py`](file:///z:/Projects/VMS/packaging/scripts/generate_credentials.py) | Generates random 64-char `SECRET_KEY` and DB password during setup. |

---

## 3. Installer Architecture & Specifications

### 3.1 Inno Setup Directives ([`packaging/installer/VMS_Setup.iss`](file:///z:/Projects/VMS/packaging/installer/VMS_Setup.iss))
- **Application GUID**: `{{A65F3294-712F-4A9B-983C-B6D743D2F710}}`
- **Output Filename**: `dist_installer\VMS_Setup_v1.0.0.exe`
- **Privileges Required**: `admin` (Enforces standard Windows UAC elevation)
- **Architectures**: `x64compatible` only (32-bit systems blocked)
- **Minimum OS**: Windows 10 Version 1809 / Server 2019 (Build 17763+)
- **Compression**: `lzma2/ultra64` with solid compression

### 3.2 Directory Separation Architecture
- **Application Binaries (`C:\Program Files\VMS\`)**:
  - `backend\`: Flask application code, routes, utility scripts (excludes `.env`, `.git`, `.venv`, test databases).
  - `frontend\dist\`: Pre-compiled React 19 production bundle.
  - `bin\python\`: Bundled Python 3.11.9 embedded runtime with all 17 production dependencies pre-installed.
  - `bin\database\`: Portable MariaDB 10.11.8 binaries (`mysqld.exe`, `mariadb-install-db.exe`, `mysqladmin.exe`, `share/`).
  - `bin\proxy\`: Caddy v2.8.4 reverse proxy binary (`caddy.exe`).
  - `bin\winsw\`: WinSW v2.12.0 service wrapper executables (`vms-database.exe`, `vms-backend.exe`, `vms-proxy.exe`).
  - `config\`: `my.ini`, `Caddyfile`, service XML definitions.
- **Persistent Customer Data (`C:\ProgramData\VMS\`)**:
  - `data\`: MariaDB database files and transaction logs (`ibdata1`).
  - `uploads\`: Visitor photographs and digital signatures.
  - `uploads_users\`: Staff and security guard profile photographs.
  - `logs\`: Service, database, proxy, and backend logs.
  - `keys\`: Vendor RSA public key (`public_key.pem`).
  - `backups\`: Timestamped pre-upgrade backups (`backup_YYYYMMDD_HHMMSS`).
  - `.env`: Generated installation secrets (restricted Windows ACLs).

---

## 4. Third-Party Software Redistribution Inventory

All bundled runtime components were audited for commercial redistribution compliance:

| Component | Bundled Version | License Type | Commercial Redistribution Permissions | Source Link |
| :--- | :--- | :--- | :--- | :--- |
| **MariaDB Community Server** | 10.11.8 Portable | GNU GPL v2 | Allowed with GPL notice & source reference | [MariaDB Archive](https://archive.mariadb.org/mariadb-10.11.8/winx64-packages/) |
| **Python Embeddable** | 3.11.9 (x86_64) | PSF License | 100% Permissive for commercial bundling | [Python.org](https://www.python.org/ftp/python/3.11.9/) |
| **Caddy Web Server** | 2.8.4 (x86_64) | Apache 2.0 | Permissive with copyright attribution | [GitHub](https://github.com/caddyserver/caddy/releases/tag/v2.8.4) |
| **WinSW Service Wrapper** | 2.12.0 (x64) | MIT License | Permissive for commercial bundling | [GitHub](https://github.com/winsw/winsw/releases/tag/v2.12.0) |
| **Waitress WSGI** | 3.0.2 | ZPL 2.1 | Permissive for commercial distribution | [Pylons](https://github.com/Pylons/waitress) |
| **React, Vite, Tailwind** | React 19, Vite 7 | MIT License | Permissive for commercial distribution | [GitHub](https://github.com/facebook/react) |

Full license texts are compiled in [`packaging/installer/THIRD_PARTY_LICENSES.txt`](file:///z:/Projects/VMS/packaging/installer/THIRD_PARTY_LICENSES.txt).

---

## 5. Master Build Procedure & Output

The master build script compiles the release package:

```powershell
powershell -ExecutionPolicy Bypass -File packaging/build_installer.ps1
```

### Build Steps Executed:
1. **Frontend Validation**: Verified pre-compiled React 19 bundle at `vms/vms_frontend/dist/`.
2. **Backend & Schema Validation**: Verified `schema_clean.sql`, `setup_database.py`, and `run_windows.py`.
3. **Runtime Staging Check**: Verified `dist_runtime/` containing Python 3.11 embed, MariaDB 10.11 portable, Caddy 2.8.4, and WinSW 2.12.0.
4. **Compiler Location**: Detected Inno Setup 6.7.3 (`ISCC.exe`) in standard user programs directory.
5. **Inno Setup Compilation**: Compiled `packaging/installer/VMS_Setup.iss` into `dist_installer/VMS_Setup_v1.0.0.exe`.

### Compilation Result:
- **Output Executable**: [`dist_installer/VMS_Setup_v1.0.0.exe`](file:///z:/Projects/VMS/dist_installer/VMS_Setup_v1.0.0.exe)
- **Output Size**: **91.48 MB** (95,922,878 bytes)
- **Exit Status**: Clean exit (Exit Code 0)

---

## 6. Verification & Test Execution Status

### 6.1 Tests Executed in Current Environment
- **Standalone Python Import Test**: Verified all 17 production dependencies (`flask`, `waitress`, `flask_cors`, `flask_limiter`, `pymysql`, `dbutils`, `cryptography`, `jwt`, `dotenv`, `pandas`, `numpy`, `xlsxwriter`, `reportlab`, `qrcode`, `requests`) in embedded Python 3.11.9 runtime ([`packaging/scripts/test_runtime.py`](file:///z:/Projects/VMS/packaging/scripts/test_runtime.py)).
- **MariaDB Portable Initialization Test**: Verified `mariadb-install-db.exe --datadir="..." -s` successfully creates data directory and system tables ([`packaging/scripts/test_mariadb_init.ps1`](file:///z:/Projects/VMS/packaging/scripts/test_mariadb_init.ps1)).
- **Caddy Binary Verification**: Tested `caddy.exe version` returning `v2.8.4`.
- **WinSW Service Wrapper Verification**: Tested `winsw.exe` binary execution and XML lookup.
- **Backend Clean Schema Syntax**: Tested `setup_database.py` compiling cleanly with py_compile.
- **Frontend Production Build**: Pre-compiled React 19 bundle verified in `dist/`.
- **Automated Regression Suite**: `test_phase1_2_initialization.py` passed 8/8 tests.
- **Secret Generator**: `generate_credentials.py` verified to generate high-entropy 64-char `SECRET_KEY` and DB passwords.
- **Health Check Diagnostics**: `check_services.py` verified socket and permission auditing.
- **Full Inno Setup Compilation**: Verified single-file compilation producing `dist_installer/VMS_Setup_v1.0.0.exe`.

### 6.2 Tests Requiring a Dedicated Clean Windows Machine
The following tests are explicitly documented in [`docs/productization/PHASE4_INSTALLER_TEST_PLAN.md`](file:///z:/Projects/VMS/docs/productization/PHASE4_INSTALLER_TEST_PLAN.md) and must be performed on a clean Windows VM prior to general commercial release:
1. **Bare-Metal VM Clean Install**: Installing `VMS_Setup_v1.0.0.exe` on a fresh Windows 11 / Windows 10 VM without Python, Node.js, or MariaDB installed.
2. **Reboot Survival Test**: Rebooting the Windows VM and verifying that `VMS-Database`, `VMS-Backend`, and `VMS-Proxy` start automatically before user login.
3. **Multi-Workstation LAN Camera Test**: Connecting to `https://[Server-IP]/` from a secondary physical laptop on the office network to confirm that `navigator.mediaDevices.getUserMedia` operates without browser security blocks (verifying root CA installation on client workstation).
4. **Add/Remove Programs Uninstall**: Verifying that normal uninstallation removes binaries from `C:\Program Files\VMS\` while leaving `C:\ProgramData\VMS\` (visitor history and database) completely intact.

---

## 7. Deliverables Summary

| Deliverable | Path | Status |
| :--- | :--- | :---: |
| **Release Setup Executable** | [`dist_installer/VMS_Setup_v1.0.0.exe`](file:///z:/Projects/VMS/dist_installer/VMS_Setup_v1.0.0.exe) | **Built (91.48 MB)** |
| **Inno Setup Script** | [`packaging/installer/VMS_Setup.iss`](file:///z:/Projects/VMS/packaging/installer/VMS_Setup.iss) | **Complete** |
| **Master Build Script** | [`packaging/build_installer.ps1`](file:///z:/Projects/VMS/packaging/build_installer.ps1) | **Complete** |
| **Post-Install Orchestration** | [`packaging/installer/helpers/post_install.bat`](file:///z:/Projects/VMS/packaging/installer/helpers/post_install.bat) | **Complete** |
| **Pre-Uninstall Teardown** | [`packaging/installer/helpers/pre_uninstall.bat`](file:///z:/Projects/VMS/packaging/installer/helpers/pre_uninstall.bat) | **Complete** |
| **Pre-Upgrade Backup** | [`packaging/installer/helpers/backup_database.bat`](file:///z:/Projects/VMS/packaging/installer/helpers/backup_database.bat) | **Complete** |
| **Shortcut Launcher** | [`packaging/installer/helpers/open_vms.bat`](file:///z:/Projects/VMS/packaging/installer/helpers/open_vms.bat) | **Complete** |
| **Application Icon** | [`packaging/installer/assets/app_icon.ico`](file:///z:/Projects/VMS/packaging/installer/assets/app_icon.ico) | **Complete** |
| **Third-Party Licenses** | [`packaging/installer/THIRD_PARTY_LICENSES.txt`](file:///z:/Projects/VMS/packaging/installer/THIRD_PARTY_LICENSES.txt) | **Complete** |
| **Installer Test Plan** | [`docs/productization/PHASE4_INSTALLER_TEST_PLAN.md`](file:///z:/Projects/VMS/docs/productization/PHASE4_INSTALLER_TEST_PLAN.md) | **Complete** |
| **Phase 4 Implementation Report** | [`docs/productization/PHASE4_INSTALLER_IMPLEMENTATION_REPORT.md`](file:///z:/Projects/VMS/docs/productization/PHASE4_INSTALLER_IMPLEMENTATION_REPORT.md) | **Complete** |
| **Phase 4.1 Release Build Report** | [`docs/productization/PHASE4_1_RELEASE_BUILD_REPORT.md`](file:///z:/Projects/VMS/docs/productization/PHASE4_1_RELEASE_BUILD_REPORT.md) | **Complete** |
