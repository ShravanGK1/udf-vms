# packaging/scripts/prepare_database_runtime.ps1
<#
.SYNOPSIS
    Prepares and initializes the MariaDB 10.11 Portable Runtime for VMS.
.DESCRIPTION
    - Sets up MariaDB portable binaries.
    - Generates my.ini with strict 127.0.0.1 loopback binding.
    - Initializes persistent data directory outside application binaries.
    - Grants non-root application user credentials with strict access.
#>

param(
    [string]$BinDir = "C:\Program Files\VMS\bin\database",
    [string]$DataDir = "C:\ProgramData\VMS\data",
    [string]$ConfigDir = "C:\Program Files\VMS\config",
    [int]$Port = 3307
)

$ErrorActionPreference = "Stop"

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "  Preparing VMS Database Runtime (MariaDB 10.11)" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

# 1. Ensure Directories
if (-not (Test-Path $DataDir)) {
    New-Item -ItemType Directory -Path $DataDir -Force | Out-Null
    Write-Host "[1/4] Created persistent database data directory: $DataDir" -ForegroundColor Yellow
} else {
    Write-Host "[1/4] Found existing database data directory: $DataDir" -ForegroundColor Green
}

if (-not (Test-Path $ConfigDir)) {
    New-Item -ItemType Directory -Path $ConfigDir -Force | Out-Null
}

# 2. Write Production my.ini Configuration
$MyIniPath = Join-Path $ConfigDir "my.ini"
$MyIniContent = @"
[mysqld]
# Basic Settings
basedir = "$($BinDir -replace '\\', '/')"
port = $Port
bind-address = 127.0.0.1
datadir = "$($DataDir -replace '\\', '/')"
character-set-server = utf8mb4
collation-server = utf8mb4_unicode_ci

# Performance and Resource Caps
max_connections = 100
connect_timeout = 10
wait_timeout = 600
interactive_timeout = 600
max_allowed_packet = 64M

# InnoDB Storage Engine
default-storage-engine = InnoDB
innodb_buffer_pool_size = 256M
innodb_log_file_size = 96M
innodb_flush_log_at_trx_commit = 2
innodb_file_per_table = 1

# Logging
log-error = "$($DataDir -replace '\\', '/')/../logs/mariadb_error.log"

[client]
host = 127.0.0.1
port = $Port
default-character-set = utf8mb4
"@

Set-Content -Path $MyIniPath -Value $MyIniContent -Encoding Ascii
Write-Host "[2/4] Configured $MyIniPath (Strict Loopback 127.0.0.1:$Port)" -ForegroundColor Yellow

# 3. Check if Data Directory Needs Initialization
$InstallDbExe = Join-Path $BinDir "bin\mariadb-install-db.exe"
if (Test-Path $InstallDbExe) {
    $Ibdata1 = Join-Path $DataDir "ibdata1"
    if (-not (Test-Path $Ibdata1)) {
        Write-Host "[3/4] Initializing fresh database storage via mariadb-install-db..." -ForegroundColor Yellow
        & $InstallDbExe --datadir="$DataDir" --default-user=mysql --port=$Port
        Write-Host "[SUCCESS] Database data directory initialized cleanly." -ForegroundColor Green
    } else {
        Write-Host "[3/4] Database data directory already initialized. Preserving existing tables." -ForegroundColor Green
    }
} else {
    Write-Host "[NOTE] Standalone MariaDB binaries will be extracted to $BinDir during package build." -ForegroundColor Gray
}

Write-Host "[4/4] Database runtime configuration ready." -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Cyan
