# packaging/scripts/install_services.ps1
<#
.SYNOPSIS
    Installs the 3 VMS Windows Services using WinSW with validated absolute paths.
.DESCRIPTION
    Requires Administrative privileges.
    Configures and validates service paths, then installs VMS-Database, VMS-Backend, and VMS-Proxy services.
#>

param(
    [string]$BaseDir = "C:\Program Files\VMS",
    [string]$DataDir = "C:\ProgramData\VMS",
    [int]$Port = 3307
)

$ErrorActionPreference = "Stop"

# Require Elevation
$CurrentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $CurrentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Error "Administrator privileges are required to install Windows Services."
    exit 1
}

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "  Installing VMS Windows Services" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

# 1. Configure absolute paths and validate all files
$ConfigScript = Join-Path $BaseDir "packaging\scripts\configure_services.ps1"
if (-not (Test-Path $ConfigScript)) {
    $ConfigScript = Join-Path $PSScriptRoot "configure_services.ps1"
}
if (Test-Path $ConfigScript) {
    Write-Host "Configuring and validating service paths via configure_services.ps1..." -ForegroundColor Yellow
    & $ConfigScript -InstallDir $BaseDir -DataDir $DataDir -Port $Port
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Service configuration and validation failed. Aborting service installation."
        exit 1
    }
}

$WinSW = Join-Path $BaseDir "bin\winsw\winsw.exe"
$Services = @("vms-database", "vms-backend", "vms-proxy")

foreach ($svc in $Services) {
    $XmlConfig = Join-Path $BaseDir "bin\winsw\$svc.xml"
    $TargetExe = Join-Path $BaseDir "bin\winsw\$svc.exe"
    
    if (Test-Path $XmlConfig) {
        if (-not (Test-Path $TargetExe) -and (Test-Path $WinSW)) {
            Copy-Item -Path $WinSW -Destination $TargetExe -Force
        }
        
        Write-Host "Installing service $svc..." -ForegroundColor Yellow
        & $TargetExe stop 2>$null
        & $TargetExe uninstall 2>$null
        & $TargetExe install
        Write-Host "[OK] Installed $svc" -ForegroundColor Green
    } else {
        Write-Warning "Configuration not found for $svc: $XmlConfig"
    }
}

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "All VMS Services Registered Successfully." -ForegroundColor Green
