@echo off
REM ============================================================================
REM VMS Silent Post-Installation Orchestration Script
REM Executes elevated during Inno Setup ssPostInstall step.
REM Arguments:
REM   %1 : Install Directory (e.g. "C:\Program Files\VMS")
REM   %2 : Persistent Data Directory (e.g. "C:\ProgramData\VMS")
REM ============================================================================

setlocal enabledelayedexpansion

set "INSTALL_DIR=%~1"
set "DATA_DIR=%~2"

if "%INSTALL_DIR%"=="" set "INSTALL_DIR=C:\Program Files\VMS"
if "%DATA_DIR%"=="" set "DATA_DIR=C:\ProgramData\VMS"

set "LOG_FILE=%DATA_DIR%\logs\installer_post_action.log"

echo [%DATE% %TIME%] Starting VMS Post-Installation Setup... >> "%LOG_FILE%"

REM 1. Ensure Persistent Directories Exist
if not exist "%DATA_DIR%\data" mkdir "%DATA_DIR%\data"
if not exist "%DATA_DIR%\uploads" mkdir "%DATA_DIR%\uploads"
if not exist "%DATA_DIR%\uploads_users" mkdir "%DATA_DIR%\uploads_users"
if not exist "%DATA_DIR%\logs" mkdir "%DATA_DIR%\logs"
if not exist "%DATA_DIR%\keys" mkdir "%DATA_DIR%\keys"
if not exist "%DATA_DIR%\backups" mkdir "%DATA_DIR%\backups"

REM 2. Generate Unique Installation Secrets if Fresh Install
echo [%DATE% %TIME%] Generating or verifying installation credentials on port 3307... >> "%LOG_FILE%"
"%INSTALL_DIR%\bin\python\python.exe" "%INSTALL_DIR%\packaging\scripts\generate_credentials.py" --output "%DATA_DIR%\.env" --port 3307 >> "%LOG_FILE%" 2>&1

REM 3. Prepare MariaDB Runtime & my.ini Configuration (Port 3307, DataDir: %DATA_DIR%\data)
echo [%DATE% %TIME%] Preparing MariaDB runtime configuration (my.ini) on port 3307... >> "%LOG_FILE%"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%INSTALL_DIR%\packaging\scripts\prepare_database_runtime.ps1" -BinDir "%INSTALL_DIR%\bin\database" -DataDir "%DATA_DIR%\data" -ConfigDir "%INSTALL_DIR%\config" -Port 3307 >> "%LOG_FILE%" 2>&1

REM 4. Configure Absolute Service Paths, Caddyfile, and Validate File Existence
echo [%DATE% %TIME%] Generating absolute path service configurations and validating binaries... >> "%LOG_FILE%"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%INSTALL_DIR%\packaging\scripts\configure_services.ps1" -InstallDir "%INSTALL_DIR%" -DataDir "%DATA_DIR%" -Port 3307 >> "%LOG_FILE%" 2>&1
if !ERRORLEVEL! neq 0 (
    echo [%DATE% %TIME%] CRITICAL ERROR: configure_services.ps1 validation failed! Aborting service registration. >> "%LOG_FILE%"
    exit /b 1
)

REM 5. Grant Local Users Modify Permissions on Data Directory
icacls "%DATA_DIR%" /grant *S-1-5-32-545:(OI)(CI)M /T >> "%LOG_FILE%" 2>&1

REM 6. Register Windows Services via WinSW with Validated Absolute Paths
echo [%DATE% %TIME%] Registering Windows Services... >> "%LOG_FILE%"
cd /d "%INSTALL_DIR%\bin\winsw"

if exist "vms-database.exe" (
    vms-database.exe stop >> "%LOG_FILE%" 2>&1
    vms-database.exe uninstall >> "%LOG_FILE%" 2>&1
    vms-database.exe install >> "%LOG_FILE%" 2>&1
)

if exist "vms-backend.exe" (
    vms-backend.exe stop >> "%LOG_FILE%" 2>&1
    vms-backend.exe uninstall >> "%LOG_FILE%" 2>&1
    vms-backend.exe install >> "%LOG_FILE%" 2>&1
)

if exist "vms-proxy.exe" (
    vms-proxy.exe stop >> "%LOG_FILE%" 2>&1
    vms-proxy.exe uninstall >> "%LOG_FILE%" 2>&1
    vms-proxy.exe install >> "%LOG_FILE%" 2>&1
)

REM 5. Start Database Engine & Wait For Readiness
echo [%DATE% %TIME%] Starting VMS-Database engine... >> "%LOG_FILE%"
net start VMS-Database >> "%LOG_FILE%" 2>&1

echo [%DATE% %TIME%] Waiting for MariaDB 10.11 on port 3307 to accept connections... >> "%LOG_FILE%"
set /a DB_RETRIES=0
:WAIT_MARIADB_READY
"%INSTALL_DIR%\bin\database\bin\mysqladmin.exe" --defaults-file="%INSTALL_DIR%\config\my.ini" -u root ping >> "%LOG_FILE%" 2>&1
if !ERRORLEVEL! equ 0 (
    echo [%DATE% %TIME%] MariaDB engine reported ready and listening on port 3307. >> "%LOG_FILE%"
    goto MARIADB_READY
)
set /a DB_RETRIES+=1
if !DB_RETRIES! geq 30 (
    echo [%DATE% %TIME%] WARNING: MariaDB did not report ready within 30 seconds. Checking error log... >> "%LOG_FILE%"
    if exist "%DATA_DIR%\logs\mariadb_error.log" type "%DATA_DIR%\logs\mariadb_error.log" >> "%LOG_FILE%" 2>&1
    goto MARIADB_READY
)
timeout /t 1 /nobreak >nul
goto WAIT_MARIADB_READY
:MARIADB_READY

echo [%DATE% %TIME%] Running database schema verification (setup_database.py)... >> "%LOG_FILE%"
set "VMS_DATA_DIR=%DATA_DIR%"
set "VMS_LOG_DIR=%DATA_DIR%\logs"
cd /d "%INSTALL_DIR%\backend"
"%INSTALL_DIR%\bin\python\python.exe" "%INSTALL_DIR%\backend\setup_database.py" >> "%LOG_FILE%" 2>&1

REM 6. Start Application Backend and Proxy Services
echo [%DATE% %TIME%] Starting application backend and proxy... >> "%LOG_FILE%"
net start VMS-Backend >> "%LOG_FILE%" 2>&1
timeout /t 2 /nobreak >nul

net start VMS-Proxy >> "%LOG_FILE%" 2>&1

REM 7. Install Local Caddy CA Trust for Webcam Access
if exist "%INSTALL_DIR%\bin\proxy\caddy.exe" (
    echo [%DATE% %TIME%] Installing local root CA trust for LAN webcam access... >> "%LOG_FILE%"
    "%INSTALL_DIR%\bin\proxy\caddy.exe" trust >> "%LOG_FILE%" 2>&1
)

REM 8. Configure Narrowly Scoped Windows Firewall Inbound Rules for Ports 8089 & 8009
echo [%DATE% %TIME%] Configuring Windows Firewall rules for HTTP 8089 and HTTPS 8009... >> "%LOG_FILE%"
netsh advfirewall firewall delete rule name="VMS Web HTTP (Port 8089)" >> "%LOG_FILE%" 2>&1
netsh advfirewall firewall add rule name="VMS Web HTTP (Port 8089)" dir=in action=allow protocol=TCP localport=8089 profile=private,domain >> "%LOG_FILE%" 2>&1
netsh advfirewall firewall delete rule name="VMS Web HTTPS (Port 8009)" >> "%LOG_FILE%" 2>&1
netsh advfirewall firewall add rule name="VMS Web HTTPS (Port 8009)" dir=in action=allow protocol=TCP localport=8009 profile=private,domain >> "%LOG_FILE%" 2>&1

REM 9. Run Runtime Health Diagnostic Check
echo [%DATE% %TIME%] Running final health diagnostics... >> "%LOG_FILE%"
"%INSTALL_DIR%\bin\python\python.exe" "%INSTALL_DIR%\packaging\scripts\check_services.py" >> "%LOG_FILE%" 2>&1

echo [%DATE% %TIME%] Post-Installation Finished Successfully. >> "%LOG_FILE%"
exit /b 0
