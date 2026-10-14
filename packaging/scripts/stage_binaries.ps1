# packaging/scripts/stage_binaries.ps1
param(
    [string]$DistRuntime = "$PSScriptRoot\..\..\dist_runtime"
)

$ErrorActionPreference = "Stop"

$ProxyDir = Join-Path $DistRuntime "bin\proxy"
$WinSWDir = Join-Path $DistRuntime "bin\winsw"

if (-not (Test-Path $ProxyDir)) { New-Item -ItemType Directory -Path $ProxyDir -Force | Out-Null }
if (-not (Test-Path $WinSWDir)) { New-Item -ItemType Directory -Path $WinSWDir -Force | Out-Null }

# 1. Stage Caddy v2.8.4
$CaddyExe = Join-Path $ProxyDir "caddy.exe"
if (-not (Test-Path $CaddyExe)) {
    Write-Host "[1/2] Downloading official Caddy 2.8.4 Windows x64..." -ForegroundColor Yellow
    $CaddyZip = "$env:TEMP\caddy_2.8.4_windows_amd64.zip"
    $CaddyExtract = "$env:TEMP\caddy_extract"
    $CaddyUrl = "https://github.com/caddyserver/caddy/releases/download/v2.8.4/caddy_2.8.4_windows_amd64.zip"
    if (-not (Test-Path $CaddyZip)) {
        Invoke-WebRequest -Uri $CaddyUrl -OutFile $CaddyZip -UseBasicParsing
    }
    Expand-Archive -Path $CaddyZip -DestinationPath $CaddyExtract -Force
    Copy-Item "$CaddyExtract\caddy.exe" -Destination $CaddyExe -Force
    Write-Host "[OK] Staged Caddy to $CaddyExe" -ForegroundColor Green
} else {
    Write-Host "[OK] Caddy already staged at $CaddyExe" -ForegroundColor Green
}

# 2. Stage WinSW v2.12.0
$WinSWExe = Join-Path $WinSWDir "winsw.exe"
if (-not (Test-Path $WinSWExe)) {
    Write-Host "[2/2] Downloading official WinSW v2.12.0 x64..." -ForegroundColor Yellow
    $WinSWUrl = "https://github.com/winsw/winsw/releases/download/v2.12.0/WinSW-x64.exe"
    Invoke-WebRequest -Uri $WinSWUrl -OutFile $WinSWExe -UseBasicParsing
    Copy-Item $WinSWExe (Join-Path $WinSWDir "vms-database.exe") -Force
    Copy-Item $WinSWExe (Join-Path $WinSWDir "vms-backend.exe") -Force
    Copy-Item $WinSWExe (Join-Path $WinSWDir "vms-proxy.exe") -Force
    Write-Host "[OK] Staged WinSW to $WinSWDir (with service-specific runners)" -ForegroundColor Green
} else {
    Write-Host "[OK] WinSW already staged at $WinSWExe" -ForegroundColor Green
}
