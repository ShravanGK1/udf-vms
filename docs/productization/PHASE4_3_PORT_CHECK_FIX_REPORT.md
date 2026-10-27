# Phase 4.3 Implementation Report: Installer Port Conflict Detection Fix

## Executive Summary

During Phase 4.3 validation of the Visitor Management System (VMS) single-file Windows installer (`VMS_Setup_v1.0.0.exe`), an installation failure was observed on a target Windows machine:
- The installer aborted at startup claiming: `Setup cannot continue because HTTP Port 8089 is currently in use by another application on this machine.`
- However, active system diagnostics proved that port `8089` was completely free:
  - `Get-NetTCPConnection -LocalPort 8089 -State Listen` returned no matching objects.
  - `netstat -ano | findstr ":8089"` returned no output.
  - `netstat -ano | findstr ":8009"` returned no output.
  - Windows excluded port ranges (`netsh int ipv4 show excludedportrange tcp`) showed only port `27339` reserved.

This report documents the exhaustive root cause investigation, the replacement of the flawed detection mechanism with an authoritative dual-stack port probe (`packaging/scripts/check_port.ps1`), the updated Pascal Script integration in `packaging/installer/VMS_Setup.iss`, and the validation results across free ports, occupied ports, simulated query failures, and the compiled Windows installer.

---

## 1. Root Cause Analysis

### The Flawed Detection Mechanism
The initial port detection in `packaging/installer/VMS_Setup.iss` relied on the following Pascal script:

```pascal
function IsPortActive(Port: Integer): Boolean;
var
  ResultCode: Integer;
  Command: String;
begin
  Command := Format('/c netstat -ano | findstr /R ":%d .*LISTENING"', [Port]);
  Result := Exec(ExpandConstant('{cmd}'), Command, '', SW_HIDE, ewWaitUntilTerminated, ResultCode) and (ResultCode = 0);
end;
```

### Why It Falsely Reported Conflict on Every Windows Host
1. **Windows `findstr` Multiple Pattern Parsing**:
   In Windows `findstr`, arguments not explicitly wrapped in `/C:"pattern"` treat unquoted whitespace as a delimiter separating **independent search strings** (equivalent to logical OR).
   Therefore, `findstr /R ":8089 .*LISTENING"` searched for:
   - Pattern 1: `:8089` **OR**
   - Pattern 2: `.*LISTENING`

2. **Regex Greediness of `.*LISTENING`**:
   In `findstr /R`, the regex `.*LISTENING` matches zero or more characters followed by the literal string `LISTENING`.
   Every standard Windows workstation and server has system sockets in `LISTENING` state (such as RPC on port `135`, SMB on port `445`, and system background services).
   Consequently, `findstr` matched **every single active listening socket on the host**, exited with code `0`, and caused `IsPortActive(8089)` to return `True` on **100% of Windows computers**, regardless of whether port 8089 was free!

3. **Silent Process Resolution Failure & Fallback Dialog**:
   When `IsPortActive(8089)` returned `True`, the installer called `GetPortConflictingProcess(8089)`:
   ```powershell
   Get-NetTCPConnection -LocalPort 8089 -State Listen
   ```
   Because port 8089 was not actually occupied, `Get-NetTCPConnection` returned nothing. The installer received an empty string for the conflicting process name and triggered the fallback branch:
   ```pascal
   if ConflictProc <> '' then
     ProcMsg := 'is currently occupied by process: ' + ConflictProc
   else
     ProcMsg := 'is currently in use by another application on this machine';
   ```
   The user was shown a false-positive conflict dialog and setup aborted.

---

## 2. Architectural Corrections Implemented

To ensure robust, fail-safe port auditing, the detection logic was redesigned according to the following principles:

### A. Authoritative Diagnostic Script (`packaging/scripts/check_port.ps1`)
A single, authoritative diagnostic probe was implemented at `packaging/scripts/check_port.ps1` with strict classification:

1. **Distinguishable Listener Inspection**:
   - Executes `Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction Stop`.
   - Distinguishes `ObjectNotFound` (meaning the query succeeded and confirmed 0 listeners) from true query/WMI/permission errors.
   - If `Get-NetTCPConnection` encounters an actual query failure, falls back to tokenized `netstat.exe -ano -p tcp` parsing (checking if the local address ends with `:$Port`).
   - If both methods fail, it **never** silently converts the error to "no listener found"—it records status `ERROR` with `REASON=LISTENER_QUERY_FAILED`.

2. **Dual-Stack Socket Bind Verification**:
   - Tests IPv4 socket bindability (`0.0.0.0:$Port`) with `ExclusiveAddressUse = $true`.
   - Tests IPv6 socket bindability (`[::]:$Port`) if IPv6 is supported on the operating system.

3. **Strict Error vs Occupation Classification**:
   - **`AddressAlreadyInUse` (`WSAEADDRINUSE 10048`)**: Classified as **`OCCUPIED`**. If a process cannot be identified via PID lookup, `PROCESS` is left empty and diagnostic notes an existing socket.
   - **`AccessDenied` (`WSAEACCES 10013`)**: Classified as **`ERROR`** (`REASON=ACCESS_DENIED_IPV4`), representing OS port exclusions, Hyper-V dynamic ranges, or security restrictions. It is **never** falsely blamed on an application.
   - **Other Socket Exceptions**: Classified as **`ERROR`** with full `SocketErrorCode` and `NativeErrorCode` details.

4. **Structured Key-Value Output**:
   The script writes a structured result to an output file for reliable parsing by Inno Setup:
   ```ini
   STATUS=FREE|OCCUPIED|ERROR
   PORT=<Port>
   REASON=AVAILABLE|LISTENER_ACTIVE|BIND_ADDRINUSE_IPV4|ACCESS_DENIED_IPV4|...
   PROCESS=<ProcessName> (PID <PID>)  [empty if unidentifiable or free]
   DIAGNOSTIC=<Full technical diagnostic message>
   EXITCODE=0|1|2
   ```

### B. Inno Setup Pascal Script Integration (`packaging/installer/VMS_Setup.iss`)
1. **Packaged Helper Extraction**:
   - Declared in `[Files]` with `Flags: dontcopy`:
     ```iss
     Source: "..\scripts\check_port.ps1"; Flags: dontcopy
     ```
   - In `InitializeSetup`, extracted cleanly to `{tmp}\check_port.ps1` using `ExtractTemporaryFile`.
2. **Direct Execution Without Shell Escaping**:
   - Invokes `powershell.exe -NoProfile -ExecutionPolicy Bypass -File <script> -Port <port> -OutputFile <tempfile>` directly via `Exec`, completely bypassing `cmd.exe` string mangling and redirection pipes.
3. **Distinct Status Handling**:
   - **`STATUS=FREE`**: Setup continues smoothly.
   - **`STATUS=OCCUPIED`**: Shows confirmed conflict dialog with process name, PID, and technical diagnostic. Setup aborts without terminating any process.
   - **`STATUS=ERROR` / `FAILED`**: Shows distinct diagnostic error dialog:
     `Setup could not verify the availability of HTTP Port <Port>. Diagnostic Details: <Diagnostic>`
     The installer explicitly alerts the administrator to inspect permissions and configuration, without falsely claiming a port conflict.

---

## 3. Test & Verification Matrix

| Test Case | Port Tested | Scenario / Injection | Exit Code | Reported Status | Diagnostic Output | Result |
| :--- | :---: | :--- | :---: | :---: | :--- | :---: |
| **TC-1** | `8089` | Normal state (no listeners) | `0` | `FREE` | `Port 8089 is free and verified bindable on IPv4 and IPv6.` | **PASS** |
| **TC-2** | `8009` | Normal state (no listeners) | `0` | `FREE` | `Port 8009 is free and verified bindable on IPv4 and IPv6.` | **PASS** |
| **TC-3** | `8089` | Deliberate listener active | `1` | `OCCUPIED` | `Active TCP listener detected on port 8089 (powershell (PID 20792)).` | **PASS** |
| **TC-4** | `8009` | Deliberate listener active | `1` | `OCCUPIED` | `Active TCP listener detected on port 8009 (powershell (PID 13540)).` | **PASS** |
| **TC-5** | `135` | Active Windows RPC Service | `1` | `OCCUPIED` | `Active TCP listener detected on port 135 (svchost (PID 1564)).` | **PASS** |
| **TC-6** | `3306` | Active MariaDB Engine | `1` | `OCCUPIED` | `Active TCP listener detected on port 3306 (mysqld (PID 5768)).` | **PASS** |
| **TC-7** | `999999` | Invalid port number (simulated probe exception) | `2` | `ERROR` | `Unexpected IPv4 bind probe error on port 999999: Specified argument was out of the range of valid values.` | **PASS** |
| **TC-8** | `8089` | Simulated query failure (`Get-NetTCPConnection` & `netstat` error) | `2` | `ERROR` | `Unable to inspect TCP listeners (Get-NetTCPConnection failed: Access is denied; netstat fallback failed: command not found).` | **PASS** |

---

## 4. Release Build Artifacts

The installer was recompiled using [`packaging/build_installer.ps1`](file:///z:/Projects/VMS/packaging/build_installer.ps1) with local staging to prevent Win32 `EndUpdateResource` Error 110:

- **Installer Path**: `dist_installer/VMS_Setup_v1.0.0.exe`
- **Compiler**: Inno Setup 6.7.3 (`ISCC.exe`)
- **Staging Mode**: Local `%TEMP%` staging with direct copy to `dist_installer`
- **File Size**: `102,373,444` bytes (`97.63 MB`)
- **SHA-256 Hash**: `9E35A0D8AF49F6C4A60EE4109F72982821CC2D33ACBEA71998FF1DDB0F898F05`

