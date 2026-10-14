# packaging/scripts/configure_services.ps1
<#
.SYNOPSIS
    Generates absolute path configurations for WinSW services and Caddyfile,
    and validates every referenced file before Windows Services registration.
.DESCRIPTION
    Resolves the WinSW %BASE% resolution issue by generating explicit, absolute
    installation paths for executables, working directories, configuration files,
    and stop executables.
#>

param(
    [Parameter(Mandatory = $false)]
    [string]$InstallDir = "C:\Program Files\VMS",
    [Parameter(Mandatory = $false)]
    [string]$DataDir = "C:\ProgramData\VMS",
    [Parameter(Mandatory = $false)]
    [int]$Port = 3307
)

$ErrorActionPreference = "Stop"

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "  Configuring VMS Windows Services & Base Paths" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

# 1. Normalize Directories
if (-not (Test-Path $InstallDir)) {
    Write-Error "Install directory does not exist: $InstallDir"
    exit 1
}
$InstallDirResolved = (Resolve-Path $InstallDir).Path.TrimEnd('\')

if (-not (Test-Path $DataDir)) {
    New-Item -ItemType Directory -Path $DataDir -Force | Out-Null
}
$DataDirResolved = [System.IO.Path]::GetFullPath($DataDir).TrimEnd('\')

$LogsDir = Join-Path $DataDirResolved "logs"
if (-not (Test-Path $LogsDir)) {
    New-Item -ItemType Directory -Path $LogsDir -Force | Out-Null
}

$InstallDirForward = $InstallDirResolved.Replace('\', '/')
$DataDirForward = $DataDirResolved.Replace('\', '/')

Write-Host "[INFO] Target Install Root : $InstallDirResolved" -ForegroundColor Gray
Write-Host "[INFO] Persistent Data Root: $DataDirResolved" -ForegroundColor Gray
Write-Host "[INFO] MariaDB TCP Port    : $Port" -ForegroundColor Gray

# Set Machine-level Environment Variable for system service inheritance
try {
    [System.Environment]::SetEnvironmentVariable("VMS_INSTALL_DIR", $InstallDirResolved, [System.EnvironmentVariableTarget]::Machine)
    Write-Host "[OK] Set System Environment Variable: VMS_INSTALL_DIR=$InstallDirResolved" -ForegroundColor Green
} catch {
    Write-Warning "Could not set machine-level VMS_INSTALL_DIR: $_"
}

# 2. Generate vms-database.xml with Absolute Paths
$DatabaseXmlContent = @"
<service>
  <id>VMS-Database</id>
  <name>VMS Database Service</name>
  <description>Provides the local, secure database engine for the Visitor Management System (VMS).</description>
  <executable>$InstallDirResolved\bin\database\bin\mysqld.exe</executable>
  <arguments>--defaults-file="$InstallDirResolved\config\my.ini" --standalone</arguments>
  <workingdirectory>$InstallDirResolved\bin\database</workingdirectory>
  <logpath>$LogsDir</logpath>
  <log mode="roll-by-size">
    <sizeThreshold>10240</sizeThreshold>
    <keepFiles>5</keepFiles>
  </log>
  <stopargument>--defaults-file="$InstallDirResolved\config\my.ini" -u root shutdown</stopargument>
  <stopexecutable>$InstallDirResolved\bin\database\bin\mysqladmin.exe</stopexecutable>
  <env name="VMS_INSTALL_DIR" value="$InstallDirResolved"/>
  <onfailure action="restart" delay="5 sec"/>
  <onfailure action="restart" delay="15 sec"/>
  <resetfailure>1 hour</resetfailure>
  <startmode>Automatic</startmode>
</service>
"@

# 3. Generate vms-backend.xml with Absolute Paths
$BackendXmlContent = @"
<service>
  <id>VMS-Backend</id>
  <name>VMS Backend Application Service</name>
  <description>Executes the multithreaded Waitress WSGI application server for the Visitor Management System.</description>
  <executable>$InstallDirResolved\bin\python\python.exe</executable>
  <arguments>$InstallDirResolved\backend\run_windows.py</arguments>
  <workingdirectory>$InstallDirResolved\backend</workingdirectory>
  <env name="VMS_INSTALL_DIR" value="$InstallDirResolved"/>
  <env name="VMS_DATA_DIR" value="$DataDirResolved"/>
  <env name="VMS_LOG_DIR" value="$LogsDir"/>
  <env name="VMS_BACKEND_HOST" value="127.0.0.1"/>
  <env name="VMS_BACKEND_PORT" value="5000"/>
  <env name="DB_HOST" value="127.0.0.1"/>
  <env name="DB_PORT" value="$Port"/>
  <logpath>$LogsDir</logpath>
  <log mode="roll-by-size">
    <sizeThreshold>10240</sizeThreshold>
    <keepFiles>5</keepFiles>
  </log>
  <onfailure action="restart" delay="5 sec"/>
  <onfailure action="restart" delay="15 sec"/>
  <resetfailure>1 hour</resetfailure>
  <startmode>Automatic</startmode>
  <depend>VMS-Database</depend>
</service>
"@

# 4. Generate vms-proxy.xml with Absolute Paths
$ProxyXmlContent = @"
<service>
  <id>VMS-Proxy</id>
  <name>VMS Web &amp; Reverse Proxy Service</name>
  <description>Provides secure HTTPS web serving, LAN camera context, and unified API routing for VMS.</description>
  <executable>$InstallDirResolved\bin\proxy\caddy.exe</executable>
  <arguments>run --config "$InstallDirResolved\config\Caddyfile"</arguments>
  <workingdirectory>$InstallDirResolved\config</workingdirectory>
  <env name="VMS_INSTALL_DIR" value="$InstallDirResolved"/>
  <logpath>$LogsDir</logpath>
  <log mode="roll-by-size">
    <sizeThreshold>10240</sizeThreshold>
    <keepFiles>5</keepFiles>
  </log>
  <onfailure action="restart" delay="5 sec"/>
  <onfailure action="restart" delay="15 sec"/>
  <resetfailure>1 hour</resetfailure>
  <startmode>Automatic</startmode>
  <depend>VMS-Backend</depend>
</service>
"@

# Write XMLs to both config/ and bin/winsw/ directories
$ConfigsDir = Join-Path $InstallDirResolved "config"
$WinswDir = Join-Path $InstallDirResolved "bin\winsw"

if (-not (Test-Path $ConfigsDir)) { New-Item -ItemType Directory -Path $ConfigsDir -Force | Out-Null }
if (-not (Test-Path $WinswDir)) { New-Item -ItemType Directory -Path $WinswDir -Force | Out-Null }

Set-Content -Path (Join-Path $ConfigsDir "vms-database.xml") -Value $DatabaseXmlContent -Encoding UTF8
Set-Content -Path (Join-Path $WinswDir "vms-database.xml") -Value $DatabaseXmlContent -Encoding UTF8

Set-Content -Path (Join-Path $ConfigsDir "vms-backend.xml") -Value $BackendXmlContent -Encoding UTF8
Set-Content -Path (Join-Path $WinswDir "vms-backend.xml") -Value $BackendXmlContent -Encoding UTF8

Set-Content -Path (Join-Path $ConfigsDir "vms-proxy.xml") -Value $ProxyXmlContent -Encoding UTF8
Set-Content -Path (Join-Path $WinswDir "vms-proxy.xml") -Value $ProxyXmlContent -Encoding UTF8

Write-Host "[OK] Generated absolute path service XMLs in $ConfigsDir and $WinswDir" -ForegroundColor Green

# 5. Update Caddyfile with Absolute Frontend & Log Paths
$CaddyfilePath = Join-Path $ConfigsDir "Caddyfile"
if (Test-Path $CaddyfilePath) {
    $CaddyContent = Get-Content $CaddyfilePath -Raw
    # Update frontend static root path
    $CaddyContent = [regex]::Replace($CaddyContent, 'root\s+\*\s+"[^"]+"', "root * `"$InstallDirForward/frontend/dist`"")
    # Update caddy log path
    $CaddyContent = [regex]::Replace($CaddyContent, 'output\s+file\s+"[^"]+"', "output file `"$DataDirForward/logs/caddy.log`"")
    Set-Content -Path $CaddyfilePath -Value $CaddyContent -Encoding UTF8
    Write-Host "[OK] Updated Caddyfile static root to $InstallDirForward/frontend/dist" -ForegroundColor Green
} else {
    Write-Warning "Caddyfile not found at $CaddyfilePath"
}

# 6. Update/Verify my.ini in config
$MyIniPath = Join-Path $ConfigsDir "my.ini"
if (Test-Path $MyIniPath) {
    $IniContent = Get-Content $MyIniPath -Raw
    if ($IniContent -notmatch "basedir\s*=") {
        $IniContent = $IniContent -replace '\[mysqld\]', "[mysqld]`r`nbasedir = `"$InstallDirForward/bin/database`""
    } else {
        $IniContent = [regex]::Replace($IniContent, 'basedir\s*=\s*"?[^"\r\n]+"?', "basedir = `"$InstallDirForward/bin/database`"")
    }
    $IniContent = [regex]::Replace($IniContent, 'datadir\s*=\s*"?[^"\r\n]+"?', "datadir = `"$DataDirForward/data`"")
    $IniContent = [regex]::Replace($IniContent, 'log-error\s*=\s*"?[^"\r\n]+"?', "log-error = `"$DataDirForward/logs/mariadb_error.log`"")
    $IniContent = [regex]::Replace($IniContent, 'port\s*=\s*\d+', "port = $Port")
    Set-Content -Path $MyIniPath -Value $IniContent -Encoding Ascii
    Write-Host "[OK] Verified my.ini configuration with basedir $InstallDirForward/bin/database and port $Port" -ForegroundColor Green
}

# 7. Comprehensive File Validation
Write-Host "Validating all referenced executables and configuration files..." -ForegroundColor Cyan

$RequiredFiles = @(
    @{ Name = "MariaDB Executable"; Path = "$InstallDirResolved\bin\database\bin\mysqld.exe" },
    @{ Name = "MariaDB Admin CLI";  Path = "$InstallDirResolved\bin\database\bin\mysqladmin.exe" },
    @{ Name = "MariaDB Config";     Path = "$InstallDirResolved\config\my.ini" },
    @{ Name = "Python Runtime";     Path = "$InstallDirResolved\bin\python\python.exe" },
    @{ Name = "Backend Entrypoint"; Path = "$InstallDirResolved\backend\run_windows.py" },
    @{ Name = "Proxy Executable";   Path = "$InstallDirResolved\bin\proxy\caddy.exe" },
    @{ Name = "Proxy Config";       Path = "$InstallDirResolved\config\Caddyfile" },
    @{ Name = "Frontend SPA Index"; Path = "$InstallDirResolved\frontend\dist\index.html" },
    @{ Name = "WinSW Database";     Path = "$InstallDirResolved\bin\winsw\vms-database.exe" },
    @{ Name = "WinSW Backend";      Path = "$InstallDirResolved\bin\winsw\vms-backend.exe" },
    @{ Name = "WinSW Proxy";        Path = "$InstallDirResolved\bin\winsw\vms-proxy.exe" },
    @{ Name = "WinSW DB XML";       Path = "$InstallDirResolved\bin\winsw\vms-database.xml" },
    @{ Name = "WinSW Backend XML";  Path = "$InstallDirResolved\bin\winsw\vms-backend.xml" },
    @{ Name = "WinSW Proxy XML";    Path = "$InstallDirResolved\bin\winsw\vms-proxy.xml" }
)

$AllValid = $true
foreach ($item in $RequiredFiles) {
    if (Test-Path $item.Path) {
        Write-Host "  [PASS] $($item.Name): $($item.Path)" -ForegroundColor Green
    } else {
        Write-Host "  [FAIL] $($item.Name) NOT FOUND: $($item.Path)" -ForegroundColor Red
        $AllValid = $false
    }
}

if (-not $AllValid) {
    Write-Error "Service configuration validation failed. One or more required files do not exist."
    exit 1
}

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "[SUCCESS] All service binaries and configuration files validated!" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Cyan
exit 0
