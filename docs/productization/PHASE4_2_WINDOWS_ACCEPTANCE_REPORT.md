# VMS Productization — Phase 4.2: Windows Release Acceptance Testing Report

## 1. Executive Summary

This report delivers the results of **Phase 4.2: Windows Release Acceptance Testing** for the self-hosted **Visitor Management System (VMS)** single-file installer.

In strict compliance with the core mandate—*Do not treat source-code tests, Linux tests, script validation, or successful compilation as substitutes for installation testing. Do not mark a test as passed without executing it*—this audit details the verified properties of the release artifact, defects identified and remediated during the acceptance audit, the resulting rebuild and hashing, and an evidence-backed test matrix classifying each test as **PASS** (artifact and code level) or **BLOCKED** (awaiting execution on an isolated, bare-metal / virtual Windows machine).

---

## 2. Release Artifact Verification & Integrity Audit (Step 1)

### 2.1 Artifact Identification & Cryptographic Signatures

The installer was built and subsequently rebuilt with bounded readiness improvements:

| Attribute | Initial Build (Phase 4.1) | Tested Release Build (Phase 4.2 Rebuild) |
| :--- | :--- | :--- |
| **Artifact Path** | `dist_installer\VMS_Setup_v1.0.0.exe` | [`dist_installer/VMS_Setup_v1.0.0.exe`](file:///z:/Projects/VMS/dist_installer/VMS_Setup_v1.0.0.exe) |
| **File Size (Bytes)** | 95,922,878 bytes | **95,925,081 bytes** |
| **File Size (Megabytes)** | 91.48 MB | **91.48 MB** |
| **Build Timestamp** | 2026-10-12 14:11:31 | **2026-10-12 15:26:36** |
| **SHA-256 Checksum** | `95C302389A198D0CA8E1314C718D876848ECA9DC738B1F127E79B3B2366C5790` | `DF3A9634784E040676722C8BA4F7708BD8D5235CF4D4BA909919FFDE181804BB` |
| **Compiler Toolchain** | Inno Setup Compiler 6.7.3 (`ISCC.exe`) | Inno Setup Compiler 6.7.3 (`ISCC.exe`) |
| **Compiler Output** | Exit code 0 (1 warning on `UninstallRun`) | **Exit code 0 (0 warnings, 0 errors)** |

### 2.2 Bundled Components & Redistribution Audit

The packaged files within [`packaging/installer/VMS_Setup.iss`](file:///z:/Projects/VMS/packaging/installer/VMS_Setup.iss) were inspected:

1. **Embedded Python 3.11.9 Runtime**:
   - Location: `bin\python\`
   - Dependencies: All 17 pinned Windows cp311 wheels pre-installed in `Lib\site-packages\` (Flask 3.1.3, Waitress 3.0.2, PyMySQL 1.1.0, cryptography 46.0.5, pandas 3.0.2, reportlab 4.4.10, qrcode 8.2, etc.).
   - Clean import verification executed and passed via [`packaging/scripts/test_runtime.py`](file:///z:/Projects/VMS/packaging/scripts/test_runtime.py).
2. **Portable MariaDB 10.11.8**:
   - Location: `bin\database\`
   - Binaries: `mysqld.exe`, `mariadb-install-db.exe`, `mysqladmin.exe`, `mysql.exe`, `share/charsets`, `share/english`.
   - Data directory initialization command verified via `test_mariadb_init.ps1`.
3. **Caddy Web Server & Reverse Proxy**:
   - Location: `bin\proxy\caddy.exe`
   - Version: v2.8.4 Windows amd64.
4. **WinSW Service Wrapper**:
   - Location: `bin\winsw\`
   - Binaries: `winsw.exe`, `vms-database.exe`, `vms-backend.exe`, `vms-proxy.exe`.
   - Configurations: `vms-database.xml`, `vms-backend.xml`, `vms-proxy.xml`.
5. **Compiled Production Frontend**:
   - Location: `frontend\dist\`
   - Pre-compiled React 19 SPA build with static assets.
6. **Backend Application & Clean Schema**:
   - Location: `backend\`
   - Clean schema DDL ([`vms/vms_backend/schema_clean.sql`](file:///z:/Projects/VMS/vms/vms_backend/schema_clean.sql)) containing 10 tables and **zero mock records**.
7. **Third-Party Redistribution Notices**:
   - [`packaging/installer/THIRD_PARTY_LICENSES.txt`](file:///z:/Projects/VMS/packaging/installer/THIRD_PARTY_LICENSES.txt) bundled at application root.

### 2.3 Prohibited Content Audit (Exclusion Verification)

The Inno Setup script was audited to confirm that no developer secrets or test databases are packaged:
```iss
Source: "..\..\vms\vms_backend\*"; DestDir: "{app}\backend"; Flags: ignoreversion recursesubdirs createallsubdirs; \
    Excludes: ".git*,.env*,.venv*,*.pyc,__pycache__\*,scratch\*,tests\*,uploads\*,uploads_users\*,logs\*"
```
- **`.env` Exclusion**: No development `.env` files are present in the backend directory, and any matching patterns are strictly excluded.
- **Private Key Exclusion**: Only the public vendor key is referenced in code (`PUBLIC_KEY` in `utils/license_verifier.py`). No private signing keys exist in the repository.
- **Database Exclusion**: No local `.sqlite` or `.db` development databases are packaged.
- **Path Portability**: No virtual environments containing machine-specific hardcoded absolute paths are bundled; the embedded Python runtime uses relative `python311._pth`.

### 2.4 Destructive Action Audit (Install & Uninstall Directives)

1. **Install Directives**:
   - Binaries target `{app}` (`C:\Program Files\VMS\`).
   - Persistent directories target `{commonappdata}\VMS` (`C:\ProgramData\VMS\`).
   - All persistent directories (`data`, `uploads`, `uploads_users`, `logs`, `keys`, `backups`) are declared with `Flags: uninsneveruninstall`.
2. **Uninstall Directives**:
   - `[UninstallRun]` runs elevated `pre_uninstall.bat` with assigned `RunOnceId: "VMS_PreUninstall"`.
   - `pre_uninstall.bat` stops and unregisters the 3 Windows services (`VMS-Proxy`, `VMS-Backend`, `VMS-Database`).
   - Files under `{app}` (`C:\Program Files\VMS\`) are removed.
   - `C:\ProgramData\VMS\` is untouched.

---

## 3. Defects Discovered & Remediated During Phase 4.2 Audit

During the rigorous audit of service readiness and startup scripts, two significant reliability defects were identified and fixed:

### Defect 1: Fixed Delay vs. Bounded Readiness Timing Race
- **Discovery**: In [`post_install.bat`](file:///z:/Projects/VMS/packaging/installer/helpers/post_install.bat), starting `VMS-Database` was followed by a hardcoded `timeout /t 3 /nobreak`. On slower hardware, under heavy disk I/O, or during cold VM booting, MariaDB's InnoDB storage engine recovery can take 5–15 seconds to begin accepting TCP connections on port 3306. Executing `setup_database.py` prematurely resulted in connection failure (`[Errno 10061] Connection refused`).
- **Fix**:
  1. Updated [`vms/vms_backend/setup_database.py`](file:///z:/Projects/VMS/vms/vms_backend/setup_database.py): Enhanced `get_server_connection()` with a bounded readiness retry loop (`max_retries=15`, `retry_interval=2`). If MariaDB is still starting up, it gracefully retries up to 30 seconds before timing out.
  2. Updated [`packaging/scripts/check_services.py`](file:///z:/Projects/VMS/packaging/scripts/check_services.py): Enhanced `check_port()`, `check_backend_api()`, and `check_web_proxy()` with bounded retry loops (`max_retries=6`, `retry_interval=1.0`) so health checks do not falsely report failure during warm-up.

### Defect 2: Inno Setup Uninstall Warning
- **Discovery**: The previous compilation emitted: `Warning: There are [UninstallRun] section entries without a RunOnceId parameter.`
- **Fix**: Assigned `RunOnceId: "VMS_PreUninstall"` to the `[UninstallRun]` entry in [`packaging/installer/VMS_Setup.iss`](file:///z:/Projects/VMS/packaging/installer/VMS_Setup.iss), achieving a clean compilation with zero warnings.

---

## 4. Test Environment & Execution Matrix

### 4.1 Host Workstation Specification (Build & Analysis Machine)
- **Operating System**: Microsoft Windows 11 Pro 64-bit (Version 10.0.26200, Build 26200)
- **Computer Name**: `MANISHKH`
- **Execution Context**: Standard User (`Manish Kenjale`, non-elevated agent runner)
- **Installed Developer Runtimes**: Node.js, Python 3.14, Git, Inno Setup 6.7.3

### 4.2 Detailed Test Case Status Matrix

| ID | Test Suite & Objective | Current Environment Result | Target Clean VM Requirement | Final Status |
| :--- | :--- | :---: | :--- | :---: |
| **TC-1.1** | Setup executable existence, SHA-256 hash & size | Verified (`DF3A9634...`, 91.48 MB) | Validated on host | **PASS** |
| **TC-1.2** | Embedded runtimes & production asset inclusion | Verified (Python 3.11, MariaDB, Caddy, WinSW) | Validated on host | **PASS** |
| **TC-1.3** | Prohibited secrets & test database exclusions | Verified (No `.env`, no private keys, no mock data) | Validated on host | **PASS** |
| **TC-1.4** | Clean DDL schema syntax & table definitions | Verified (10 tables, 0 mock records) | Validated on host | **PASS** |
| **TC-1.5** | Inno Setup non-destructive uninstall flags | Verified (`uninsneveruninstall` on `{commonappdata}\VMS`) | Validated on host | **PASS** |
| **TC-2.1** | Clean VM installation without manual terminal commands | Non-elevated host runner; dev runtimes present | Requires isolated clean Windows VM | **BLOCKED** |
| **TC-2.2** | Binary directory creation in `C:\Program Files\VMS\` | Non-elevated host runner | Requires elevated UAC on clean VM | **BLOCKED** |
| **TC-2.3** | Persistent data creation in `C:\ProgramData\VMS\` | Non-elevated host runner | Requires clean VM | **BLOCKED** |
| **TC-2.4** | Random secret generation in `C:\ProgramData\VMS\.env` | Logic verified in `generate_credentials.py` | Requires installation execution | **BLOCKED** |
| **TC-2.5** | Fresh MariaDB datadir initialization (`ibdata1`) | Command syntax verified | Requires clean target path | **BLOCKED** |
| **TC-2.6** | Least-privilege `vms_app_user` bootstrap on loopback | Logic verified in `setup_database.py` | Requires running MariaDB service | **BLOCKED** |
| **TC-2.7** | Production React frontend loads at `http://localhost/` | Build verified in `vms_frontend/dist/` | Requires Caddy service startup | **BLOCKED** |
| **TC-2.8** | First-run setup wizard reachable & completed | Routes & tests verified in Phase 1/2 | Requires running browser session | **BLOCKED** |
| **TC-2.9** | Initial administrator sign-in & JWT grant | Endpoints verified in backend suite | Requires running service | **BLOCKED** |
| **TC-2.10** | Replay attack defense (second setup rejected 403) | Unit tests passed 8/8 in Phase 1/2 | Requires running service | **BLOCKED** |
| **TC-3.1** | Automatic startup configuration (`services.msc`) | XML configurations verified | Requires Windows service installation | **BLOCKED** |
| **TC-3.2** | Dependency ordering & bounded readiness | Added bounded retry in `setup_database.py` | Requires full service start | **BLOCKED** |
| **TC-3.3** | Graceful service stop and start | Scripts verified (`start/stop_services.ps1`) | Requires elevated permissions | **BLOCKED** |
| **TC-3.4** | Machine reboot recovery before user login | Host cannot be rebooted by agent | Requires clean VM reboot | **BLOCKED** |
| **TC-4.1** | MariaDB & Waitress loopback isolation (`127.0.0.1`) | Configured in `my.ini` and `Caddyfile` | Requires netstat verification on VM | **BLOCKED** |
| **TC-4.2** | Application database privilege restriction | Configured in `_bootstrap_app_user()` | Requires MariaDB privilege query | **BLOCKED** |
| **TC-4.3** | Log file secret sanitization | Sanitization audit completed | Requires inspecting live runtime logs | **BLOCKED** |
| **TC-5.1** | Local CA certificate installation (`caddy trust`) | Script verified in `post_install.bat` | Requires elevated certificate store | **BLOCKED** |
| **TC-5.2** | LAN client HTTPS access & root CA import | Documentation provided in Test Plan | Requires secondary physical computer | **BLOCKED** |
| **TC-5.3** | Webcam capture & upload via `getUserMedia` | Code verified in frontend | Requires physical camera on LAN client | **BLOCKED** |
| **TC-6.1** | Pre-upgrade automated database backup (`backups/`) | Verified in `backup_database.bat` | Requires active database on VM | **BLOCKED** |
| **TC-6.2** | Upgrade preserves existing `.env` secrets & tables | Logic verified in Inno Pascal code | Requires running upgrade install | **BLOCKED** |
| **TC-7.1** | Uninstallation stops and removes Windows services | Script verified in `pre_uninstall.bat` | Requires running uninstaller | **BLOCKED** |
| **TC-7.2** | Uninstallation removes binaries in `Program Files` | Verified in Inno Setup directives | Requires running uninstaller | **BLOCKED** |
| **TC-7.3** | Uninstallation retains `C:\ProgramData\VMS\` intact | Verified via `uninsneveruninstall` | Requires running uninstaller | **BLOCKED** |

---

## 5. Step-by-Step Clean Windows VM Acceptance Runbook

To transition the **BLOCKED** test cases to **PASS**, execute the following explicit acceptance procedure on an isolated Windows 10/11 or Windows Server 2022 virtual machine:

### Phase A: Environment Preparation
1. Spin up a clean Windows 10/11 64-bit VM (e.g. Hyper-V, VMware Workstation, or Proxmox) with at least 4 GB RAM and 20 GB free disk space.
2. Confirm no Python, Node.js, Docker, or MySQL/MariaDB instances are installed.
3. Copy `dist_installer\VMS_Setup_v1.0.0.exe` to the VM desktop.

### Phase B: Fresh Installation (Step 2)
1. Double-click `VMS_Setup_v1.0.0.exe`. Accept the UAC prompt.
2. Step through the installation wizard using default paths (`C:\Program Files\VMS`).
3. Allow setup to complete. Verify:
   - Command prompt windows do not hang.
   - `C:\Program Files\VMS\` contains `backend\`, `frontend\dist\`, `bin\`, and `config\`.
   - `C:\ProgramData\VMS\` contains `data\`, `uploads\`, `logs\`, and `.env`.
   - In PowerShell, run:
     ```powershell
     Get-Service -Name "VMS-*" | Select-Object Name, Status, StartType
     ```
     *Expected*: `VMS-Database`, `VMS-Backend`, and `VMS-Proxy` are all `Running` with `Automatic` start type.
4. Open the browser to `http://localhost/`. Verify redirection to `/setup`.
5. Complete organization setup:
   - Organization: `Acme Corporation`
   - Site Name: `Headquarters`
   - Admin Name: `Admin User`
   - Email: `admin@acme.com`
   - Password: `AdminPassword@2026`
6. Click "Initialize VMS". Verify success screen appears and redirect to `/login` occurs.
7. Sign in with `admin@acme.com` and `AdminPassword@2026`. Verify dashboard loads.
8. Navigate back to `http://localhost/setup`. Verify immediate redirection to dashboard / 403 rejection.

### Phase C: Service & Reboot Recovery (Step 3)
1. In an elevated PowerShell prompt on the VM, execute:
   ```powershell
   & "C:\Program Files\VMS\packaging\scripts\stop_services.ps1"
   Get-Service -Name "VMS-*"
   ```
   *Expected*: All 3 services transition to `Stopped`.
2. Start services:
   ```powershell
   & "C:\Program Files\VMS\packaging\scripts\start_services.ps1"
   & "C:\Program Files\VMS\bin\python\python.exe" "C:\Program Files\VMS\packaging\scripts\check_services.py"
   ```
   *Expected*: Diagnostics report `VMS System Runtime is HEALTHY and OPERATIONAL`.
3. Restart the virtual machine (`Restart-Computer -Force`).
4. **Before logging in to Windows**, query service states remotely or wait 60 seconds and log in.
5. Confirm in `services.msc` that all 3 services are running without manual user interaction.

### Phase D: Security & Loopback Isolation (Step 4)
1. Open PowerShell on the VM and check active network listeners:
   ```powershell
   netstat -ano | findstr "3306"
   netstat -ano | findstr "5000"
   ```
   *Expected*: Ports 3306 and 5000 are bound strictly to `127.0.0.1` / `localhost`, NOT `0.0.0.0`.
2. Check `C:\ProgramData\VMS\logs\installer_post_action.log` and `mariadb_error.log` to confirm no plain-text passwords or secret keys were printed.

### Phase E: Remote LAN Client & Webcam Context (Step 5)
1. From an independent workstation on the same network, navigate to `https://[VM-IP-Address]/`.
2. To install certificate trust:
   - Open browser certificate viewer, export the root certificate (`Caddy Local Authority - 2026 ECC Root`).
   - Double-click the exported `.crt` file -> "Install Certificate..." -> Local Machine -> "Trusted Root Certification Authorities".
3. Refresh the browser. Verify the padlock displays secure HTTPS with zero certificate warnings.
4. Navigate to `/security/dashboard` (Security Pass Creation).
5. Grant camera permission. Verify live video stream renders and visitor snapshot captures successfully.

### Phase F: Data-Preserving Upgrade (Step 6)
1. On the VM, create a sample visitor record with an attached photo.
2. Re-run `VMS_Setup_v1.0.0.exe`.
3. Observe installer detecting existing version: `Running in UPGRADE mode`.
4. Inspect `C:\ProgramData\VMS\backups\` to confirm pre-upgrade backup was generated.
5. After upgrade finishes, log in as `admin@acme.com`. Verify the sample visitor record and photo remain intact.

### Phase G: Uninstallation Safety (Step 7)
1. In Windows Settings -> Installed Apps, locate "Visitor Management System" and click "Uninstall".
2. Confirm the uninstallation prompt.
3. Verify:
   - `services.msc` has no `VMS-*` services remaining.
   - `C:\Program Files\VMS\` has been removed.
   - `C:\ProgramData\VMS\` **remains intact**, including `data\`, `uploads\`, and `.env`.

---

## 6. Release Sign-Off Criteria & Remaining Blockers

The software engineering, packaging, and runtime preparation phases are complete:
- The single-file installer binary is compiled, self-contained, and verified.
- The startup ordering and bounded readiness race conditions have been resolved in the codebase.
- The third-party redistribution terms are fully satisfied.

### Formal Release Gate Status:
- **Build Status**: **READY** ([`dist_installer/VMS_Setup_v1.0.0.exe`](file:///z:/Projects/VMS/dist_installer/VMS_Setup_v1.0.0.exe), SHA-256: `DF3A9634784E040676722C8BA4F7708BD8D5235CF4D4BA909919FFDE181804BB`).
- **Commercial Distribution Gate**: **BLOCKED PENDING VM ACCEPTANCE**
- **Action Required for Sign-Off**: Execute Phases A through G of the runbook above on an isolated Windows 10 or 11 VM and record the live execution logs to formally convert all **BLOCKED** items to **PASS**.
