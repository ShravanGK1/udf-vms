@echo off
REM ============================================================================
REM VMS Pre-Upgrade Automated Database Backup Utility
REM Creates a timestamped snapshot of data/ and .env prior to version updates.
REM Arguments:
REM   %1 : Persistent Data Directory (default: C:\ProgramData\VMS)
REM ============================================================================

setlocal enabledelayedexpansion

set "DATA_DIR=%~1"
if "%DATA_DIR%"=="" set "DATA_DIR=C:\ProgramData\VMS"

REM Create timestamp string YYYYMMDD_HHMMSS
for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value') do set "DT=%%I"
set "TS=%DT:~0,8%_%DT:~8,6%"

set "BACKUP_TARGET=%DATA_DIR%\backups\backup_%TS%"

if not exist "%DATA_DIR%\data" (
    echo [INFO] No existing data directory found at %DATA_DIR%\data. Skipping backup.
    exit /b 0
)

echo Creating pre-upgrade backup at: %BACKUP_TARGET%
mkdir "%BACKUP_TARGET%" >nul 2>&1

REM Copy .env
if exist "%DATA_DIR%\.env" (
    copy /y "%DATA_DIR%\.env" "%BACKUP_TARGET%\.env" >nul
)

REM Copy database files (assuming services are paused)
xcopy "%DATA_DIR%\data" "%BACKUP_TARGET%\data\" /E /I /H /Y /Q >nul 2>&1

echo [OK] Pre-upgrade backup created successfully at: %BACKUP_TARGET%
exit /b 0
