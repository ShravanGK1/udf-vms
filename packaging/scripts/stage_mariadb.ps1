# packaging/scripts/stage_mariadb.ps1
param(
    [string]$TargetDir = "$PSScriptRoot\..\..\dist_runtime\bin\database",
    [string]$Version = "10.11.8"
)

$ErrorActionPreference = "Stop"

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "  Staging MariaDB $Version Portable Runtime" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

$DownloadUrl = "https://archive.mariadb.org/mariadb-$Version/winx64-packages/mariadb-$Version-winx64.zip"
$TempZip = "$env:TEMP\mariadb-$Version-winx64.zip"
$ExtractTemp = "$env:TEMP\mariadb-$Version-extract"

if (-not (Test-Path $TargetDir)) {
    New-Item -ItemType Directory -Path $TargetDir -Force | Out-Null
}

$MysqldExe = Join-Path $TargetDir "bin\mysqld.exe"
if (Test-Path $MysqldExe) {
    Write-Host "[OK] MariaDB binaries already staged at $TargetDir" -ForegroundColor Green
    return
}

# 1. Download MariaDB 10.11
Write-Host "[1/3] Downloading official MariaDB $Version portable zip..." -ForegroundColor Yellow
if (-not (Test-Path $TempZip)) {
    Invoke-WebRequest -Uri $DownloadUrl -OutFile $TempZip -UseBasicParsing
}
Write-Host "[OK] Download complete." -ForegroundColor Green

# 2. Extract Archive
Write-Host "[2/3] Extracting archive..." -ForegroundColor Yellow
if (Test-Path $ExtractTemp) {
    Remove-Item -Path $ExtractTemp -Recurse -Force -ErrorAction SilentlyContinue
}
Expand-Archive -Path $TempZip -DestinationPath $ExtractTemp -Force

# 3. Move contents to TargetDir
Write-Host "[3/3] Staging to $TargetDir..." -ForegroundColor Yellow
$SubFolder = Get-ChildItem -Path $ExtractTemp -Directory | Select-Object -First 1
if ($SubFolder) {
    Get-ChildItem -Path $SubFolder.FullName | ForEach-Object {
        Copy-Item -Path $_.FullName -Destination $TargetDir -Recurse -Force
    }
} else {
    Get-ChildItem -Path $ExtractTemp | ForEach-Object {
        Copy-Item -Path $_.FullName -Destination $TargetDir -Recurse -Force
    }
}

# Verify key binaries
if (Test-Path $MysqldExe) {
    Write-Host "[SUCCESS] MariaDB $Version portable staged successfully at $TargetDir" -ForegroundColor Green
} else {
    throw "MariaDB staging failed: mysqld.exe not found at $MysqldExe"
}

Write-Host "==================================================" -ForegroundColor Cyan
