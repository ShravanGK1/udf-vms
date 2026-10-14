# packaging/scripts/stop_services.ps1
<#
.SYNOPSIS
    Gracefully stops the VMS services in reverse dependency order.
#>

$ErrorActionPreference = "Stop"

Write-Host "Stopping VMS Services Gracefully..." -ForegroundColor Cyan

# 1. Stop Proxy first (halts incoming traffic)
Write-Host "[1/3] Stopping VMS-Proxy..." -ForegroundColor Yellow
Stop-Service -Name "VMS-Proxy" -ErrorAction SilentlyContinue

# 2. Stop Backend WSGI
Write-Host "[2/3] Stopping VMS-Backend..." -ForegroundColor Yellow
Stop-Service -Name "VMS-Backend" -ErrorAction SilentlyContinue

# 3. Stop Database
Write-Host "[3/3] Stopping VMS-Database..." -ForegroundColor Yellow
Stop-Service -Name "VMS-Database" -ErrorAction SilentlyContinue

Write-Host "All VMS Services Stopped." -ForegroundColor Green
Get-Service -Name "VMS-*" | Select-Object Name, Status, StartType | Format-Table -AutoSize
