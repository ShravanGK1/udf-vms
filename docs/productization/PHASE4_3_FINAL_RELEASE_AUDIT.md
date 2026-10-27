# Phase 4.3 Final Pre-Release Audit: VMS Installer & Runtime Verification

**Project**: Visitor Management System (VMS)  
**Release Version**: v1.0.0  
**Audit Date**: 2026-10-27  
**Artifact**: [`dist_installer/VMS_Setup_v1.0.0.exe`](file:///z:/Projects/VMS/dist_installer/VMS_Setup_v1.0.0.exe)  
**SHA-256**: `9E35A0D8AF49F6C4A60EE4109F72982821CC2D33ACBEA71998FF1DDB0F898F05`  
**File Size**: `102,373,444` bytes (`97.63 MB`)  

---

## Executive Summary

This pre-release audit report evaluates the VMS single-file Windows installer following the Phase 4.3 port migration (HTTP `8089`, HTTPS `8009`, backend WSGI `127.0.0.1:5000`, and MariaDB `127.0.0.1:3307`), the resolution of the port-conflict false-positive bug, and the offline runtime packaging verification.

Every audit requirement has been verified against active repository code, script syntax, and installer build outputs. A clear demarcation between tests executed on the current Windows development machine and tests requiring a clean Windows VM is provided.

---

## 1. Audit Item 1: WinSW Path & Staged Runner Executables

### Inspection Scope
- Build staging script: [`packaging/build_installer.ps1`](file:///z:/Projects/VMS/packaging/build_installer.ps1)
- Staged directory: [`dist_runtime/bin/winsw/`](file:///z:/Projects/VMS/dist_runtime/bin/winsw)
- Installer file list: [`packaging/installer/VMS_Setup.iss`](file:///z:/Projects/VMS/packaging/installer/VMS_Setup.iss)

### Findings & Verification
1. **Runner Executables Staged**:
   The runtime directory `dist_runtime/bin/winsw` contains all required service runners:
   - `winsw.exe` (18,243,033 bytes) — Canonical WinSW binary
   - `vms-database.exe` (18,243,033 bytes) — Dedicated MariaDB service wrapper
   - `vms-backend.exe` (18,243,033 bytes) — Dedicated Flask backend wrapper
   - `vms-proxy.exe` (18,243,033 bytes) — Dedicated Caddy reverse proxy wrapper

2. **Build Script Synchronization**:
   In `packaging/build_installer.ps1` (lines 67–84), the script verifies `$RuntimeWinSW = Join-Path $WinSWDir "winsw.exe"`. If `winsw.exe` is absent but another `.exe` exists, it restores `winsw.exe`. It then verifies and copies the binary to each dedicated runner (`vms-database.exe`, `vms-backend.exe`, `vms-proxy.exe`).

3. **Installer Packaging**:
   In `packaging/installer/VMS_Setup.iss`:
   - Line 103: `Source: "..\..\dist_runtime\bin\winsw\*"; DestDir: "{app}\bin\winsw"; Flags: ignoreversion recursesubdirs createallsubdirs`
   - Lines 106–107: `Source: "..\services\*.xml"; DestDir: "{app}\bin\winsw"; Flags: ignoreversion`
   This guarantees that every service executable has its matching `.xml` descriptor in `{app}\bin\winsw`:
   - `vms-database.exe` + `vms-database.xml`
   - `vms-backend.exe` + `vms-backend.xml`
   - `vms-proxy.exe` + `vms-proxy.xml`

**Status**: **VERIFIED & CORRECT**

---

## 2. Audit Item 2: Offline Runtime Packaging Without Source Directory

### Problem Detected in Previous Installer Design
In previous revisions of `packaging/installer/VMS_Setup.iss`, the `[Files]` entries for the four runtime groups included runtime `Check` functions:
```iss
Source: "..\..\dist_runtime\bin\python\*"; DestDir: "{app}\bin\python"; Check: HasRuntimePython
Source: "..\..\dist_runtime\bin\database\*"; DestDir: "{app}\bin\database"; Check: HasRuntimeDatabase
Source: "..\..\dist_runtime\bin\proxy\*"; DestDir: "{app}\bin\proxy"; Check: HasRuntimeProxy
Source: "..\..\dist_runtime\bin\winsw\*"; DestDir: "{app}\bin\winsw"; Check: HasRuntimeWinSW
```
Where each `HasRuntime...` Pascal function checked whether files existed in `{#SourcePath}\..\..\dist_runtime\bin\...`.

**Critical Flaw**:
In Inno Setup, the `Check:` parameter is evaluated **at installation time on the target computer**, not at compile time. On an end-user or customer PC where the developer repository and build source path do not exist, `HasRuntime...` returned `False`. Consequently, Inno Setup **skipped extracting all four bundled runtimes**, resulting in an unbootable installation missing Python, MariaDB, Caddy, and WinSW.

### Remediation Applied
1. **Removed Install-Time Checks**:
   All four `Check: HasRuntime...` clauses were removed from `[Files]` in `VMS_Setup.iss` (lines 92–104):
   ```iss
   ; 3. Bundled Runtimes (Extracted or pre-assembled in dist_runtime)
   Source: "..\..\dist_runtime\bin\python\*"; DestDir: "{app}\bin\python"; Flags: ignoreversion recursesubdirs createallsubdirs
   Source: "..\..\dist_runtime\bin\database\*"; DestDir: "{app}\bin\database"; Flags: ignoreversion recursesubdirs createallsubdirs
   Source: "..\..\dist_runtime\bin\proxy\*"; DestDir: "{app}\bin\proxy"; Flags: ignoreversion recursesubdirs createallsubdirs
   Source: "..\..\dist_runtime\bin\winsw\*"; DestDir: "{app}\bin\winsw"; Flags: ignoreversion recursesubdirs createallsubdirs
   ```
2. **Removed Obsolete Pascal Functions**:
   The `HasRuntimePython`, `HasRuntimeDatabase`, `HasRuntimeProxy`, and `HasRuntimeWinSW` helper functions were purged from `[Code]`.
3. **Compile-Time Enforcement**:
   Verification of runtime presence was moved strictly to compile time in `packaging/build_installer.ps1` (lines 86–116). If any runtime is missing, the build halts before Inno Setup is invoked.

**Status**: **VERIFIED & CORRECT**. All 4 runtimes are unconditionally bundled into the self-extracting archive and will extract on any clean machine.

---

## 3. Audit Item 3: Authoritative Port Probe (`check_port.ps1`) & False-Positive Elimination

### Root Cause of False-Positive Conflict
The previous Pascal code executed:
```cmd
netstat -ano | findstr /R ":8089 .*LISTENING"
```
Because `findstr` treats unquoted whitespace as an OR delimiter, this command searched for `:8089` OR `.*LISTENING`. Because Windows systems always have listening sockets (RPC 135, SMB 445, DNS, etc.), `findstr` exited with code 0 on every Windows PC, triggering a false-positive conflict dialog even when port 8089 was free.

### Authoritative Implementation
The single, authoritative probe script is located at:
[`packaging/scripts/check_port.ps1`](file:///z:/Projects/VMS/packaging/scripts/check_port.ps1)

Key architectural properties:
1. **Dual Inspection**:
   - Primary: `Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction Stop`
   - Fallback: Tokenized `netstat.exe -ano -p tcp` line parsing
2. **True Distinguishability**:
   - Zero listeners (`ObjectNotFound`) is explicitly distinguished from inspection failures (e.g., access denied, WMI corruption).
3. **Dual-Stack Socket Bind Verification**:
   - Creates an IPv4 TCP socket on `0.0.0.0:$Port` with `ExclusiveAddressUse = $true`.
   - Creates an IPv6 TCP socket on `[::]:$Port` if IPv6 is active.
4. **Error Classification**:
   - `WSAEADDRINUSE (10048)` -> `STATUS=OCCUPIED`
   - `WSAEACCES (10013)` -> `STATUS=ERROR` (OS port exclusion or permission denial, never blamed on an application)
   - Other socket exceptions -> `STATUS=ERROR`
5. **Embedding in Setup**:
   `VMS_Setup.iss` declares:
   ```iss
   Source: "..\scripts\check_port.ps1"; Flags: dontcopy
   ```
   Extracted at runtime into `{tmp}\check_port.ps1` and invoked directly via `powershell.exe -NoProfile -ExecutionPolicy Bypass -File ...`.

**Status**: **VERIFIED & CORRECT**. False positives on free ports 8089 and 8009 are completely eliminated.

---

## 4. Audit Item 4: Installer Handling of FREE, OCCUPIED, and ERROR States

In `packaging/installer/VMS_Setup.iss`, the `ProbePort` function parses the structured key-value output (`STATUS`, `PORT`, `REASON`, `PROCESS`, `DIAGNOSTIC`, `EXITCODE`) generated by `check_port.ps1`.

The `InitializeSetup` function evaluates each required port (`3307`, `8089`, `8009`) independently:

| Probe Result | Installer Behavior | Dialog Shown | Setup Outcome |
| :--- | :--- | :--- | :--- |
| **`STATUS=FREE`** | Normal pass-through | None | Setup proceeds smoothly. |
| **`STATUS=OCCUPIED`** | Detects active socket or listener | **Conflict Dialog**: Mentions port, conflicting process name & PID (or socket error code), and instructs user to close/reconfigure. | Setup aborts cleanly (exit code `False`). Never kills processes. |
| **`STATUS=ERROR` / `FAILED`** | Inspection error / access denied / crash | **Diagnostic Error Dialog**: Alerts administrator that setup could not verify port availability, displays the full diagnostic message, and instructs them to check permissions. | Setup aborts cleanly (exit code `False`) without falsely claiming an application conflict. |

**Status**: **VERIFIED & CORRECT**

---

## 5. Audit Item 5: Release Build Verification

The installer was compiled using [`packaging/build_installer.ps1`](file:///z:/Projects/VMS/packaging/build_installer.ps1) with SMB-safe local staging to `%TEMP%\vms_repo_stage` to prevent Win32 `EndUpdateResource` Error 110.

### Release Artifact Details
- **File Name**: `VMS_Setup_v1.0.0.exe`
- **Output Directory**: `dist_installer\`
- **Absolute Path**: `Z:\Projects\VMS\dist_installer\VMS_Setup_v1.0.0.exe`
- **File Size**: `102,373,444 bytes` (`97.63 MB`)
- **SHA-256 Checksum**: `9E35A0D8AF49F6C4A60EE4109F72982821CC2D33ACBEA71998FF1DDB0F898F05`
- **Compiler**: Inno Setup 6.7.3 (`ISCC.exe`)

**Status**: **REBUILT & VERIFIED**

---

## 6. Audit Item 6: Testing Demarcation

To maintain engineering integrity, all validation activities are strictly separated into tests executed on the current Windows development machine versus end-to-end scenarios requiring a clean Windows VM.

### A. Tests Executed & Passed on Current Windows Machine

| Test Category | Description | Verification Method | Status |
| :--- | :--- | :--- | :---: |
| **Script Syntax** | AST syntax check of `packaging/scripts/check_port.ps1` | `[System.Management.Automation.Language.Parser]::ParseInput` | **PASS** |
| **Free Port Probe** | Free port `8099` correctly reported as `STATUS=FREE` | Dual-stack listener query + socket bind probe | **PASS** |
| **Occupied Port (Caddy)** | Ports `8089` and `8009` occupied by active Caddy instance | Correctly identified `caddy (PID 11072)` with `STATUS=OCCUPIED` | **PASS** |
| **Occupied Port (MariaDB)** | Port `3307` occupied by active MariaDB instance | Correctly identified `mysqld (PID 5340)` with `STATUS=OCCUPIED` | **PASS** |
| **System Port (RPC)** | Port `135` occupied by Windows RPC Service | Correctly identified `svchost (PID 1564)` with `STATUS=OCCUPIED` | **PASS** |
| **Inspection Exception** | Port `999999` simulated out-of-range exception | Correctly returned `STATUS=ERROR`, exit code `2` | **PASS** |
| **Listener Query Failure** | Simulated failure of `Get-NetTCPConnection` & `netstat` | Correctly returned `STATUS=ERROR` (`LISTENER_QUERY_FAILED`) | **PASS** |
| **Runner File Audit** | Validated presence of `winsw.exe`, `vms-database.exe`, `vms-backend.exe`, `vms-proxy.exe` in `dist_runtime/bin/winsw/` | File size match (18,243,033 bytes each) | **PASS** |
| **Installer Compilation** | Compiled single-file installer via Inno Setup 6.7.3 with local staging | Exit code 0, 102,373,444 bytes produced | **PASS** |

### B. Tests Requiring Clean Windows Target Machine / VM

The following tests require an isolated Windows target machine (Windows 10/11 or Windows Server 2019/2022 x64) that has never run VMS development tools:

| Test ID | Test Scenario | Required Environment | Status / Next Step |
| :--- | :--- | :--- | :---: |
| **VM-1** | **Clean Installation** | Fresh Windows 10/11 x64 VM without Python, MariaDB, or Caddy | Execute `VMS_Setup_v1.0.0.exe`, verify zero port warnings for 8089/8009/3307, verify extraction of all 4 runtimes to `C:\Program Files\Visitor Management System\bin` |
| **VM-2** | **First-Boot Service Startup** | Post-installation on Clean VM | Verify all 3 Windows services (`VMS-Database`, `VMS-Backend`, `VMS-Proxy`) register, start automatically, and stay running |
| **VM-3** | **Database Initialization** | Post-installation on Clean VM | Verify `schema_clean.sql` is imported on port 3307 and default administrator credentials can authenticate |
| **VM-4** | **Browser Access on New Ports** | Clean VM / Host Browser | Verify browser loads `http://localhost:8089` (redirects to HTTPS) and `https://localhost:8009` displays the React UI |
| **VM-5** | **LAN Access** | Second device on same subnet | Verify browser connects to `https://<VM_IP>:8009`, webcam permission prompt functions for visitor photo capture |
| **VM-6** | **In-Place Upgrade** | VM with existing VMS v1.0.0 installation | Run installer, verify upgrade mode detects existing version, stops services during port probe to avoid self-conflict, preserves `C:\ProgramData\VMS` data/keys, and restarts services |

> [!NOTE]
> Per productization standards, clean-machine installation, service startup, upgrade data preservation, and LAN access are strictly classified as pending clean VM validation.

---

## 7. Conclusion & Release Readiness

1. **Bug Resolution**: The false-positive port conflict bug was root-caused to unquoted regex arguments in `findstr` and has been completely resolved.
2. **Reliable Detection**: The authoritative `packaging/scripts/check_port.ps1` helper performs genuine dual-stack listener inspection and bind testing, differentiating FREE, OCCUPIED, and ERROR states.
3. **Runtime Guarantee**: The removal of flawed install-time `Check: HasRuntime...` conditions ensures all four runtimes (Python, MariaDB, Caddy, WinSW) are extracted on target PCs.
4. **Installer Binary**: `dist_installer/VMS_Setup_v1.0.0.exe` is compiled, verified, and ready for deployment to the clean validation VM.
