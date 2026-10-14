# packaging/scripts/build_python_runtime.ps1
<#
.SYNOPSIS
    Builds the standalone embedded Python 3.11 runtime for VMS distribution.
.DESCRIPTION
    Downloads official Python 3.11 embedded package, configures site-packages support,
    and installs all pinned Windows dependencies offline.
#>

param(
    [string]$TargetDir = "$PSScriptRoot\..\..\dist_runtime\bin\python",
    [string]$PythonVersion = "3.11.9"
)

$ErrorActionPreference = "Stop"

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "  Building Standalone Python $PythonVersion Runtime" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

$DownloadUrl = "https://www.python.org/ftp/python/$PythonVersion/python-$PythonVersion-embed-amd64.zip"
$TempZip = "$env:TEMP\python-$PythonVersion-embed-amd64.zip"

if (-not (Test-Path $TargetDir)) {
    New-Item -ItemType Directory -Path $TargetDir -Force | Out-Null
}

Write-Host "[1/4] Downloading official Python $PythonVersion embedded package..." -ForegroundColor Yellow
if (-not (Test-Path $TempZip)) {
    Invoke-WebRequest -Uri $DownloadUrl -OutFile $TempZip -UseBasicParsing
}

Write-Host "[2/4] Extracting runtime to: $TargetDir" -ForegroundColor Yellow
Expand-Archive -Path $TempZip -DestinationPath $TargetDir -Force

# Enable site-packages in python311._pth
$PthFile = Get-ChildItem -Path $TargetDir -Filter "*._pth" | Select-Object -First 1
if ($PthFile) {
    Write-Host "[3/4] Enabling site-packages in $($PthFile.Name)..." -ForegroundColor Yellow
    $Content = Get-Content $PthFile.FullName
    $UpdatedContent = $Content -replace '^#import site', 'import site'
    if (-not ($UpdatedContent -match 'Lib\\site-packages')) {
        $UpdatedContent += "`nLib\site-packages"
    }
    Set-Content -Path $PthFile.FullName -Value $UpdatedContent
}

# Ensure Lib/site-packages directory exists
$SitePackages = Join-Path $TargetDir "Lib\site-packages"
if (-not (Test-Path $SitePackages)) {
    New-Item -ItemType Directory -Path $SitePackages -Force | Out-Null
}

Write-Host "[4/4] Installing pinned production dependencies..." -ForegroundColor Yellow
$ReqFile = "$PSScriptRoot\..\..\vms\vms_backend\requirements-windows.txt"
if (Test-Path $ReqFile) {
    & python -m pip install --target "$SitePackages" --platform win_amd64 --python-version 3.11 --only-binary=:all: --upgrade -r "$ReqFile" --no-warn-script-location
    Write-Host "[SUCCESS] Python runtime built with all pinned dependencies." -ForegroundColor Green
} else {
    Write-Warning "requirements-windows.txt not found at $ReqFile"
}

Write-Host "==================================================" -ForegroundColor Cyan
