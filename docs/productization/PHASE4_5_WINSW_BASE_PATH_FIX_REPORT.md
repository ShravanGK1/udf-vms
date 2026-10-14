# Phase 4.5 Implementation Report: WinSW Base-Path Resolution Fix

## Executive Summary

This report documents the resolution of the WinSW base-path resolution bug in the Visitor Management System (VMS) Windows deployment package.

On the installed PC, WinSW wrapper executables (`vms-database.exe`, `vms-backend.exe`, `vms-proxy.exe`) reside in `{app}\bin\winsw`. By default, WinSW defines `%BASE%` as the directory containing the wrapper executable (`{app}\bin\winsw`). The original service XML files referenced `%BASE%\bin\database\bin\mysqld.exe`, which resolved to the non-existent path `{app}\bin\winsw\bin\database\bin\mysqld.exe`, causing the Windows Service to fail immediately at startup with Win32Exception error 2 (`The system cannot find the file specified`).

To resolve this permanently and across any arbitrary installation root (e.g. `D:\VMS`, `C:\Program Files\VMS`), the deployment architecture now implements an explicit **installation-root generation and validation strategy**:
1. An automated pre-registration configuration script ([`packaging/scripts/configure_services.ps1`](file:///y:/Manish%20K/Projects/VMS/packaging/scripts/configure_services.ps1)) generates XML files containing explicit, absolute paths for all executables, configurations, working directories, stop commands, and log folders.
2. Every referenced file is strictly validated for on-disk existence before Windows Services registration.
3. The offline single-file installer has been rebuilt at [`dist_installer/VMS_Setup_v1.0.0.exe`](file:///y:/Manish%20K/Projects/VMS/dist_installer/VMS_Setup_v1.0.0.exe).

---

## 1. Root Cause Analysis & Architecture Fix

### The Problem
- **Binary Location**: `{app}\bin\database\bin\mysqld.exe`
- **WinSW Executable**: `{app}\bin\winsw\vms-database.exe`
- **WinSW `%BASE%`**: Evaluates to `{app}\bin\winsw`
- **Prior Resolution**: `%BASE%\bin\database\...` -> `{app}\bin\winsw\bin\database\bin\mysqld.exe` (Does not exist)

### The Solution: Two-Tier Strategy
1. **Static Fallback (Defense-in-Depth)**:
   All repository service XML templates now reference `%BASE%\..\..`, pointing to the true installation root above `bin\winsw`.
2. **Dynamic Generation & Hardening**:
   During installation, `configure_services.ps1` runs prior to service registration, replacing all relative paths with verified absolute paths (e.g. `D:\VMS\bin\database\bin\mysqld.exe`), updating `Caddyfile` with the actual frontend asset directory, ensuring `my.ini` specifies the MariaDB `basedir`, and asserting that all 14 required files exist before registering the services.

---

## 2. Inventory of Modified & Created Files

| File | Status | Description |
| :--- | :--- | :--- |
| [`packaging/scripts/configure_services.ps1`](file:///y:/Manish%20K/Projects/VMS/packaging/scripts/configure_services.ps1) | **Created** | Generates explicit absolute path XMLs in `{app}\config` and `{app}\bin\winsw`, configures `Caddyfile` and `my.ini`, and validates every referenced executable and config file. |
| [`packaging/services/vms-database.xml`](file:///y:/Manish%20K/Projects/VMS/packaging/services/vms-database.xml) | **Modified** | Updated template paths from `%BASE%\bin\...` to `%BASE%\..\..\bin\...`, added explicit working directory and `VMS_INSTALL_DIR` env variable. |
| [`packaging/services/vms-backend.xml`](file:///y:/Manish%20K/Projects/VMS/packaging/services/vms-backend.xml) | **Modified** | Updated template paths to `%BASE%\..\..\bin\python\python.exe` and `%BASE%\..\..\backend\run_windows.py`, added working directory. |
| [`packaging/services/vms-proxy.xml`](file:///y:/Manish%20K/Projects/VMS/packaging/services/vms-proxy.xml) | **Modified** | Updated template paths to `%BASE%\..\..\bin\proxy\caddy.exe` and `%BASE%\..\..\config\Caddyfile`, added working directory. |
| [`packaging/proxy/Caddyfile`](file:///y:/Manish%20K/Projects/VMS/packaging/proxy/Caddyfile) | **Modified** | Restructured routing into mutually exclusive `handle` blocks (`/api/*`, `/uploads/*`, and SPA static fallback), and bound port 8009 with explicit hostnames (`:8009, localhost:8009, 127.0.0.1:8009`) for internal TLS. |
| [`packaging/services/my.ini`](file:///y:/Manish%20K/Projects/VMS/packaging/services/my.ini) | **Modified** | Adjusted `innodb_log_file_size = 96M` to align with the initialized InnoDB redo log size, preventing runtime redo log resize errors. |
| [`packaging/scripts/prepare_database_runtime.ps1`](file:///y:/Manish%20K/Projects/VMS/packaging/scripts/prepare_database_runtime.ps1) | **Modified** | Included `basedir` configuration and adjusted redo log size to 96M. |
| [`packaging/scripts/install_services.ps1`](file:///y:/Manish%20K/Projects/VMS/packaging/scripts/install_services.ps1) | **Modified** | Added invocation of `configure_services.ps1` before service registration. |
| [`packaging/installer/helpers/post_install.bat`](file:///y:/Manish%20K/Projects/VMS/packaging/installer/helpers/post_install.bat) | **Modified** | Integrated `configure_services.ps1` with strict return code validation and local ACL permissions on `%DATA_DIR%`. |
| [`packaging/scripts/check_services.py`](file:///y:/Manish%20K/Projects/VMS/packaging/scripts/check_services.py) | **Modified** | Updated HTTPS check to use `localhost` SNI matching Caddy internal TLS. |
| [`vms/vms_backend/routes/test_runner_routes.py`](file:///y:/Manish%20K/Projects/VMS/vms/vms_backend/routes/test_runner_routes.py) | **Modified** | Wrapped development test runner import in `try...except ImportError` so production builds run without `tests/` folder. |
| [`packaging/build_installer.ps1`](file:///y:/Manish%20K/Projects/VMS/packaging/build_installer.ps1) | **Modified** | Added post-robocopy verification for critical binaries (`caddy.exe`, `python.exe`, `mysqld.exe`, `winsw.exe`) to prevent SMB staging dropouts. |

---

## 3. Verification & Test Results

### 3.1 Static Checks
- **XML Syntax**: Validated `vms-database.xml`, `vms-backend.xml`, and `vms-proxy.xml`.
- **Caddyfile Syntax**: Validated with `caddy.exe validate --config packaging/proxy/Caddyfile` -> `Valid configuration`.
- **Preflight File Existence Probe**: Executed `configure_services.ps1` on `D:\VMS` -> All 14 service binaries and configurations passed validation.

### 3.2 Live Runtime Tests on Test Installation (`D:\VMS`)

| Component | Target Port / Binding | Test Command / Probe | Result | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Client MySQL 8.0** | `0.0.0.0:3306` | `Get-Service MySQL80` & `check_port.ps1 -Port 3306` | Service running; TCP listener active (PID 6008). | **PASSED** (Untouched) |
| **Bundled MariaDB 10.11** | `127.0.0.1:3307` | `mysqldadmin.exe ping` & `check_port.ps1 -Port 3307` | `mysqld is alive`; TCP listener active on 3307. | **PASSED** |
| **Persistent Data Storage** | `C:\ProgramData\VMS\data` | `setup_database.py` schema verification | Schema verified; 10 tables present; existing data intact. | **PASSED** |
| **Backend WSGI Server** | `127.0.0.1:5000` | `Invoke-RestMethod http://127.0.0.1:5000/api/setup/status` | HTTP 200; `{"initialized": false, "setup_required": true, "version": "1.0.0"}` | **PASSED** |
| **Caddy Web Reverse Proxy** | `:8089` | `Invoke-WebRequest http://localhost:8089/` | HTTP 200; React SPA HTML payload served. | **PASSED** |
| **Proxied API Gateway** | `:8089` -> `:5000` | `Invoke-RestMethod http://localhost:8089/api/setup/status` | HTTP 200; JSON payload successfully routed through proxy. | **PASSED** |
| **HTTPS Webcam Context** | `:8009` | `check_services.py` HTTPS check | HTTP 200 on port 8009 via internal TLS. | **PASSED** |
| **Runtime Diagnostics** | All 4 Ports + Storage | `python packaging/scripts/check_services.py` | `VMS System Runtime is HEALTHY and OPERATIONAL` (All 8 checks passed). | **PASSED** |

---

## 4. Rebuilt Offline Installer Deliverable

The installer has been successfully recompiled:

- **Path**: `Y:\Manish K\Projects\VMS\dist_installer\VMS_Setup_v1.0.0.exe`
- **File Size**: `95,952,262` bytes (~91.51 MB)
- **SHA-256 Checksum**:
  ```text
  68DB6C31C2982F3BC563CB97747F69DF15B34C4FC41871D10A43AAEE90903E78
  ```
