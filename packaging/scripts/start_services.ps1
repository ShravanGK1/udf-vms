# packaging/scripts/start_services.ps1
<#
.SYNOPSIS
    Starts the VMS services in proper dependency order.
#>

param(
    [string]$BaseDir = "C:\Program Files\VMS"
)

$ErrorActionPreference = "Stop"

Write-Host "Starting VMS Services in Dependency Sequence..." -ForegroundColor Cyan

# 1. Start Database first
Write-Host "[1/3] Starting VMS-Database..." -ForegroundColor Yellow
Start-Service -Name "VMS-Database" -ErrorAction SilentlyContinue

# Wait for MariaDB to accept connections on port 3307
$DbPort = 3307
$MaxWaitSec = 20
$Sw = [System.Diagnostics.Stopwatch]::StartNew()
$DbReady = $false
while ($Sw.Elapsed.TotalSeconds -lt $MaxWaitSec) {
    try {
        $client = [System.Net.Sockets.TcpClient]::new()
        $iar = $client.BeginConnect("127.0.0.1", $DbPort, $null, $null)
        if ($iar.AsyncWaitHandle.WaitOne(500)) {
            $client.EndConnect($iar)
            $client.Close()
            $DbReady = $true
            break
        }
        $client.Close()
    } catch {}
    Start-Sleep -Milliseconds 500
}
if ($DbReady) {
    Write-Host "[OK] VMS-Database is ready and listening on 127.0.0.1:$DbPort" -ForegroundColor Green
} else {
    Write-Warning "VMS-Database did not open port $DbPort within $MaxWaitSec seconds; proceeding anyway."
}

# 2. Start Backend
Write-Host "[2/3] Starting VMS-Backend..." -ForegroundColor Yellow
Start-Service -Name "VMS-Backend" -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

# 3. Start Reverse Proxy / Web Server
Write-Host "[3/3] Starting VMS-Proxy..." -ForegroundColor Yellow
Start-Service -Name "VMS-Proxy" -ErrorAction SilentlyContinue

Write-Host "All VMS Services Started." -ForegroundColor Green
Get-Service -Name "VMS-*" | Select-Object Name, Status, StartType | Format-Table -AutoSize
