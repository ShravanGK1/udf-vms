@echo off
REM ============================================================================
REM VMS Pre-Uninstall Service Teardown Script
REM Stops and unregisters Windows Services before binary removal.
REM Preserves all persistent customer data in C:\ProgramData\VMS.
REM Arguments:
REM   %1 : Install Directory (e.g. "C:\Program Files\VMS")
REM ============================================================================

set "INSTALL_DIR=%~1"
if "%INSTALL_DIR%"=="" set "INSTALL_DIR=C:\Program Files\VMS"

echo Stopping VMS Services...
net stop VMS-Proxy >nul 2>&1
net stop VMS-Backend >nul 2>&1
net stop VMS-Database >nul 2>&1

echo Unregistering Windows Services...
cd /d "%INSTALL_DIR%\bin\winsw" >nul 2>&1
if exist "vms-proxy.exe" vms-proxy.exe uninstall >nul 2>&1
if exist "vms-backend.exe" vms-backend.exe uninstall >nul 2>&1
if exist "vms-database.exe" vms-database.exe uninstall >nul 2>&1

echo Removing VMS Firewall Rules...
netsh advfirewall firewall delete rule name="VMS Web HTTP (Port 8089)" >nul 2>&1
netsh advfirewall firewall delete rule name="VMS Web HTTPS (Port 8009)" >nul 2>&1

echo [OK] VMS Services stopped and unregistered. Persistent customer data preserved.
exit /b 0
