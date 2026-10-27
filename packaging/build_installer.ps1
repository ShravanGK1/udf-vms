# packaging/build_installer.ps1
<#
.SYNOPSIS
    Automated Master Build Script for the VMS Single-File Windows Installer.
.DESCRIPTION
    1. Validates presence of frontend production assets (vms/vms_frontend/dist).
    2. Validates backend code and clean schema scripts.
    3. Verifies or prepares the bundled runtime directory (dist_runtime).
    4. Locates Inno Setup Compiler (ISCC.exe).
    5. Compiles packaging/installer/VMS_Setup.iss into dist_installer/VMS_Setup_v1.0.0.exe.
#>

param(
    [switch]$SkipFrontendBuild,
    [switch]$ValidateOnly,
    [switch]$AutoStageRuntimes,
    [string]$InnoCompilerPath = ""
)

$ErrorActionPreference = "Stop"
$ScriptDir = $PSScriptRoot
$ProjectRoot = (Resolve-Path "$ScriptDir\..").Path

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "  Visitor Management System (VMS) - Installer Build" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

# 1. Check Frontend Production Bundle
$FrontendDist = Join-Path $ProjectRoot "vms\vms_frontend\dist"
if (-not (Test-Path $FrontendDist) -or (Get-ChildItem $FrontendDist).Count -eq 0) {
    if (-not $SkipFrontendBuild) {
        Write-Host "[1/5] Frontend build missing. Building React SPA..." -ForegroundColor Yellow
        Push-Location (Join-Path $ProjectRoot "vms\vms_frontend")
        try {
            npm run build
        } finally {
            Pop-Location
        }
        Write-Host "[OK] Frontend compiled successfully." -ForegroundColor Green
    } else {
        throw "Frontend production bundle missing at $FrontendDist and -SkipFrontendBuild was specified."
    }
} else {
    Write-Host "[1/5] Found verified frontend production build at: $FrontendDist" -ForegroundColor Green
}

# 2. Check Backend & Schema Prerequisites
Write-Host "[2/5] Verifying backend and clean schema..." -ForegroundColor Yellow
$BackendDir = Join-Path $ProjectRoot "vms\vms_backend"
$CleanSchema = Join-Path $BackendDir "schema_clean.sql"
$SetupScript = Join-Path $BackendDir "setup_database.py"

if (-not (Test-Path $CleanSchema)) {
    throw "Critical file missing: $CleanSchema"
}
if (-not (Test-Path $SetupScript)) {
    throw "Critical file missing: $SetupScript"
}
Write-Host "[OK] Backend code and clean schema verified." -ForegroundColor Green

# 3. Check / Prepare Runtime Layout (dist_runtime)
Write-Host "[3/5] Checking bundled runtime staging directory..." -ForegroundColor Yellow
$RuntimeDir = Join-Path $ProjectRoot "dist_runtime"
$RuntimePython = Join-Path $RuntimeDir "bin\python\python.exe"
$RuntimeDb = Join-Path $RuntimeDir "bin\database\bin\mysqld.exe"
$RuntimeProxy = Join-Path $RuntimeDir "bin\proxy\caddy.exe"
$WinSWDir = Join-Path $RuntimeDir "bin\winsw"
$RuntimeWinSW = Join-Path $WinSWDir "winsw.exe"
if (-not (Test-Path $RuntimeWinSW)) {
    # Check if a staged service runner exists and can restore winsw.exe
    $AltWinSW = Get-ChildItem -Path $WinSWDir -Filter "*.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($AltWinSW) {
        Copy-Item -Path $AltWinSW.FullName -Destination $RuntimeWinSW -Force
    }
}
# Ensure all service runner binaries exist alongside winsw.exe
if (Test-Path $RuntimeWinSW) {
    foreach ($svcRunner in @("vms-database.exe", "vms-backend.exe", "vms-proxy.exe")) {
        $svcRunnerPath = Join-Path $WinSWDir $svcRunner
        if (-not (Test-Path $svcRunnerPath)) {
            Copy-Item -Path $RuntimeWinSW -Destination $svcRunnerPath -Force
        }
    }
}

$MissingRuntimes = @()
if (-not (Test-Path $RuntimePython)) { $MissingRuntimes += "Python 3.11 Embed" }
if (-not (Test-Path $RuntimeDb))     { $MissingRuntimes += "MariaDB Portable" }
if (-not (Test-Path $RuntimeProxy))  { $MissingRuntimes += "Caddy Proxy" }
if (-not (Test-Path $RuntimeWinSW))  { $MissingRuntimes += "WinSW Runner" }

if ($MissingRuntimes.Count -gt 0) {
    if ($AutoStageRuntimes) {
        Write-Host "Missing runtimes ($($MissingRuntimes -join ', ')). Triggering auto-staging..." -ForegroundColor Yellow
        if (-not (Test-Path $RuntimePython)) {
            & "$ScriptDir\scripts\build_python_runtime.ps1"
        }
        if (-not (Test-Path $RuntimeProxy) -or -not (Test-Path $RuntimeWinSW)) {
            & "$ScriptDir\scripts\stage_binaries.ps1"
        }
        if (-not (Test-Path $RuntimeDb)) {
            & "$ScriptDir\scripts\stage_mariadb.ps1"
        }
    } else {
        $msg = "Required runtimes missing in dist_runtime: $($MissingRuntimes -join ', '). Run with -AutoStageRuntimes or execute staging scripts."
        if ($ValidateOnly) {
            Write-Warning $msg
        } else {
            throw $msg
        }
    }
}

if ((Test-Path $RuntimePython) -and (Test-Path $RuntimeDb) -and (Test-Path $RuntimeProxy) -and (Test-Path $RuntimeWinSW)) {
    Write-Host "[OK] All required offline runtimes staged in dist_runtime." -ForegroundColor Green
}

if ($ValidateOnly) {
    Write-Host "==================================================" -ForegroundColor Green
    Write-Host "  VALIDATION COMPLETE (-ValidateOnly)" -ForegroundColor Green
    Write-Host "==================================================" -ForegroundColor Green
    exit 0
}

# 4. Locate Inno Setup Compiler (ISCC.exe)
Write-Host "[4/5] Locating Inno Setup Compiler (ISCC.exe)..." -ForegroundColor Yellow

$CandidatePaths = @(
    $InnoCompilerPath,
    (Get-Command iscc.exe -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source),
    (Join-Path $env:LOCALAPPDATA "Programs\Inno Setup 6\ISCC.exe"),
    "C:\Program Files (x86)\Inno Setup 6\ISCC.exe",
    "C:\Program Files\Inno Setup 6\ISCC.exe",
    (Join-Path $env:LOCALAPPDATA "Programs\Inno Setup 5\ISCC.exe"),
    "C:\Program Files (x86)\Inno Setup 5\ISCC.exe",
    "C:\Program Files\Inno Setup 5\ISCC.exe"
)

$ISCC = $null
foreach ($path in $CandidatePaths) {
    if ($path -and (Test-Path $path)) {
        $ISCC = $path
        break
    }
}

if (-not $ISCC) {
    Write-Host "--------------------------------------------------" -ForegroundColor Red
    Write-Host "[ERROR] Inno Setup Compiler (ISCC.exe) was not found." -ForegroundColor Red
    Write-Host "Inno Setup is required to compile VMS_Setup_v1.0.0.exe." -ForegroundColor Red
    Write-Host "Install Inno Setup 6 via:" -ForegroundColor Yellow
    Write-Host "   winget install --id JRSoftware.InnoSetup -e" -ForegroundColor White
    Write-Host "Or download from: https://jrsoftware.org/isdl.php" -ForegroundColor White
    Write-Host "--------------------------------------------------" -ForegroundColor Red
    throw "Inno Setup Compiler (ISCC.exe) not found. Compilation cannot proceed."
}

Write-Host "[OK] Found Inno Setup Compiler at: $ISCC" -ForegroundColor Green

# 5. Compile Installer
Write-Host "[5/5] Compiling VMS Inno Setup Package..." -ForegroundColor Cyan
$IssFile = Join-Path $ProjectRoot "packaging\installer\VMS_Setup.iss"
$OutputDir = Join-Path $ProjectRoot "dist_installer"
if (-not (Test-Path $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
}

$SetupExe = Join-Path $OutputDir "VMS_Setup_v1.0.0.exe"
if (Test-Path $SetupExe) {
    Remove-Item -Path $SetupExe -Force -ErrorAction SilentlyContinue
}

# Compile to local TEMP directory to prevent SMB network share resource locking
$LocalBuildDir = Join-Path $env:TEMP "vms_installer_build"
if (Test-Path $LocalBuildDir) {
    Remove-Item -Path $LocalBuildDir -Recurse -Force -ErrorAction SilentlyContinue
}
New-Item -ItemType Directory -Path $LocalBuildDir -Force | Out-Null

# Check if project root is on a network drive (SMB)
$DriveLetter = $ProjectRoot.Substring(0, 1)
$DriveObj = Get-PSDrive -Name $DriveLetter -ErrorAction SilentlyContinue
$IsNetworkDrive = [bool]($DriveObj -and $DriveObj.DisplayRoot)
$LocalStageDir = Join-Path $env:TEMP "vms_repo_stage"

if ($IsNetworkDrive) {
    Write-Host "Detected network drive deployment ($DriveLetter`: -> $($DriveObj.DisplayRoot))." -ForegroundColor Yellow
    Write-Host "Staging build assets locally to prevent SMB latency and network disconnects..." -ForegroundColor Yellow
    if (Test-Path $LocalStageDir) {
        Remove-Item -Path $LocalStageDir -Recurse -Force -ErrorAction SilentlyContinue
    }
    New-Item -ItemType Directory -Path $LocalStageDir -Force | Out-Null

    # Mirror required directories using robocopy for fast, resilient multi-threaded transfer
    $FoldersToStage = @(
        @{ Src = (Join-Path $ProjectRoot "packaging"); Dst = (Join-Path $LocalStageDir "packaging") },
        @{ Src = (Join-Path $ProjectRoot "dist_runtime"); Dst = (Join-Path $LocalStageDir "dist_runtime") },
        @{ Src = (Join-Path $ProjectRoot "vms\vms_backend"); Dst = (Join-Path $LocalStageDir "vms\vms_backend") },
        @{ Src = (Join-Path $ProjectRoot "vms\vms_frontend\dist"); Dst = (Join-Path $LocalStageDir "vms\vms_frontend\dist") }
    )

    foreach ($f in $FoldersToStage) {
        New-Item -ItemType Directory -Path $f.Dst -Force | Out-Null
        robocopy $f.Src $f.Dst /E /MT:8 /R:3 /W:2 /NP /NFL /NDL /NJH /NJS | Out-Null
    }

    # Verify and ensure critical binaries were staged
    $CriticalBinaries = @(
        "dist_runtime\bin\proxy\caddy.exe",
        "dist_runtime\bin\winsw\winsw.exe",
        "dist_runtime\bin\winsw\vms-database.exe",
        "dist_runtime\bin\winsw\vms-backend.exe",
        "dist_runtime\bin\winsw\vms-proxy.exe",
        "dist_runtime\bin\python\python.exe",
        "dist_runtime\bin\database\bin\mysqld.exe",
        "dist_runtime\bin\database\bin\mysqladmin.exe"
    )
    foreach ($bin in $CriticalBinaries) {
        $srcBin = Join-Path $ProjectRoot $bin
        $dstBin = Join-Path $LocalStageDir $bin
        if ((Test-Path $srcBin) -and (-not (Test-Path $dstBin))) {
            Write-Host "Ensuring critical binary staged: $bin" -ForegroundColor Yellow
            $dstParent = Split-Path $dstBin -Parent
            if (-not (Test-Path $dstParent)) { New-Item -ItemType Directory -Path $dstParent -Force | Out-Null }
            Copy-Item -Path $srcBin -Destination $dstBin -Force
        }
    }

    $IssFileToCompile = Join-Path $LocalStageDir "packaging\installer\VMS_Setup.iss"
} else {
    $IssFileToCompile = $IssFile
}

Write-Host "Compiling setup package via local staging at: $LocalBuildDir" -ForegroundColor Yellow
& "$ISCC" "/O$LocalBuildDir" "$IssFileToCompile"

if ($LASTEXITCODE -ne 0) {
    throw "Inno Setup compilation failed with exit code $LASTEXITCODE."
}

$LocalSetupExe = Join-Path $LocalBuildDir "VMS_Setup_v1.0.0.exe"
if (-not (Test-Path $LocalSetupExe)) {
    throw "Inno Setup exited cleanly but expected setup executable was not found at $LocalSetupExe."
}

Write-Host "Copying completed installer to output directory: $SetupExe..." -ForegroundColor Yellow
Copy-Item -Path $LocalSetupExe -Destination $SetupExe -Force
Remove-Item -Path $LocalBuildDir -Recurse -Force -ErrorAction SilentlyContinue
if ($IsNetworkDrive -and (Test-Path $LocalStageDir)) {
    Remove-Item -Path $LocalStageDir -Recurse -Force -ErrorAction SilentlyContinue
}

$SizeMB = [math]::Round((Get-Item $SetupExe).Length / 1MB, 2)
Write-Host "==================================================" -ForegroundColor Green
Write-Host "  RELEASE BUILD SUCCESSFUL!" -ForegroundColor Green
Write-Host "  Output Executable: $SetupExe" -ForegroundColor Green
Write-Host "  File Size:         $SizeMB MB" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Green
exit 0
