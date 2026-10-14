<#
.SYNOPSIS
    Authoritative TCP port conflict and bindability diagnostic probe for VMS installer.
.DESCRIPTION
    Checks whether a specific TCP port is available for VMS services.
    - Inspects active IPv4 and IPv6 TCP listeners using Get-NetTCPConnection (with netstat fallback).
    - Distinguishes listener query errors from empty listener results (never converts query errors into "no listener found").
    - Classifies AddressAlreadyInUse (WSAEADDRINUSE 10048) as OCCUPIED.
    - Classifies AccessDenied (WSAEACCES 10013) and other unexpected socket errors as ERROR.
    - Records native error codes, socket error codes, process name, and PID where available.
    - Does not claim an application owns a port when the process cannot be identified.
.PARAMETER Port
    The TCP port to check (e.g. 8089 or 8009).
.PARAMETER OutputFile
    Optional file path to write structured diagnostic result.
.OUTPUTS
    Exit Code 0 (STATUS=FREE): Port is free and verified bindable on IPv4 and IPv6.
    Exit Code 1 (STATUS=OCCUPIED): Confirmed port conflict (listener active or WSAEADDRINUSE).
    Exit Code 2 (STATUS=ERROR): Inspection failure, access denied, or execution error.
#>
param(
    [Parameter(Mandatory = $true)]
    [int]$Port,

    [Parameter(Mandatory = $false)]
    [string]$OutputFile = ""
)

$status = "FREE"
$reason = "AVAILABLE"
$processDesc = ""
$diagnostic = ""
$exitCode = 0

try {
    # --------------------------------------------------------------------------
    # 1. Active TCP Listener Check (IPv4 and IPv6)
    # --------------------------------------------------------------------------
    $conflictingProcesses = @()
    $listenerFound = $false
    $querySuccess = $false
    $queryErrorDetails = ""

    # Try Get-NetTCPConnection first
    try {
        $conns = @(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction Stop)
        $querySuccess = $true
        if ($conns.Count -gt 0) {
            $listenerFound = $true
            $pids = $conns | ForEach-Object { $_.OwningProcess } | Select-Object -Unique
            foreach ($p in $pids) {
                if ($p -gt 0) {
                    $proc = Get-Process -Id $p -ErrorAction SilentlyContinue
                    if ($proc) {
                        $conflictingProcesses += "$($proc.ProcessName) (PID $p)"
                    } else {
                        $conflictingProcesses += "PID $p"
                    }
                } else {
                    $conflictingProcesses += "System / Kernel (PID 4)"
                }
            }
        }
    } catch {
        # Check if the error is simply "no objects found"
        if ($_.CategoryInfo.Category -eq 'ObjectNotFound' -or $_.FullyQualifiedErrorId -like "*NotFound*") {
            # ObjectNotFound means the query executed successfully and found 0 matching listeners
            $querySuccess = $true
        } else {
            # Actual CIM/WMI or permission error
            $queryErrorDetails = "Get-NetTCPConnection failed: $($_.Exception.Message)"
        }
    }

    # If Get-NetTCPConnection encountered an actual query error, fall back to netstat
    if (-not $querySuccess) {
        try {
            $netstatOutput = & netstat.exe -ano -p tcp 2>&1
            if ($LASTEXITCODE -ne 0) {
                throw "netstat exited with code $($LASTEXITCODE): $netstatOutput"
            }
            $querySuccess = $true
            foreach ($line in $netstatOutput) {
                $trimmed = $line.Trim()
                if ($trimmed -match '^TCP\s+') {
                    $tokens = $trimmed -split '\s+'
                    if ($tokens.Count -ge 5 -and $tokens[3] -eq 'LISTENING') {
                        $localAddr = $tokens[1]
                        if ($localAddr -match ":$Port$") {
                            $listenerFound = $true
                            $pidVal = $tokens[4]
                            if ($pidVal -gt 0) {
                                $proc = Get-Process -Id $pidVal -ErrorAction SilentlyContinue
                                if ($proc) {
                                    $conflictingProcesses += "$($proc.ProcessName) (PID $pidVal)"
                                } else {
                                    $conflictingProcesses += "PID $pidVal"
                                }
                            } else {
                                $conflictingProcesses += "System / Kernel"
                            }
                        }
                    }
                }
            }
        } catch {
            # Both Get-NetTCPConnection and netstat failed
            # Do NOT silently convert inspection error to "no listener found"
            $status = "ERROR"
            $reason = "LISTENER_QUERY_FAILED"
            $diagnostic = "Unable to inspect TCP listeners ($queryErrorDetails; netstat fallback failed: $($_.Exception.Message))."
            $exitCode = 2
        }
    }

    # If listener inspection failed with an error, exit immediately as ERROR
    if ($status -eq "ERROR") {
        # Skip socket binding and report error
    } elseif ($listenerFound) {
        $status = "OCCUPIED"
        $reason = "LISTENER_ACTIVE"
        $procSummary = ($conflictingProcesses | Select-Object -Unique) -join ", "
        if ([string]::IsNullOrWhiteSpace($procSummary)) {
            $processDesc = ""
            $diagnostic = "Active TCP listener detected on port $Port (Process could not be identified)."
        } else {
            $processDesc = $procSummary
            $diagnostic = "Active TCP listener detected on port $Port ($procSummary)."
        }
        $exitCode = 1
    } else {
        # ----------------------------------------------------------------------
        # 2. Socket Bindability Probe on IPv4 (0.0.0.0)
        # ----------------------------------------------------------------------
        try {
            $v4Listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Any, $Port)
            $v4Listener.ExclusiveAddressUse = $true
            $v4Listener.Start()
            $v4Listener.Stop()
        } catch [System.Net.Sockets.SocketException] {
            $sockEx = $_.Exception
            if ($sockEx.SocketErrorCode -eq [System.Net.Sockets.SocketError]::AddressAlreadyInUse) {
                # WSAEADDRINUSE 10048 - Confirmed port occupation
                $status = "OCCUPIED"
                $reason = "BIND_ADDRINUSE_IPV4"
                $processDesc = ""
                $diagnostic = "IPv4 socket bind failed on port $($Port): Address already in use (WSAEADDRINUSE 10048)."
                $exitCode = 1
            } elseif ($sockEx.SocketErrorCode -eq [System.Net.Sockets.SocketError]::AccessDenied) {
                # WSAEACCES 10013 - Access denied / OS port exclusion or permission restriction
                $status = "ERROR"
                $reason = "ACCESS_DENIED_IPV4"
                $processDesc = ""
                $diagnostic = "IPv4 socket bind failed on port $($Port): Access denied (WSAEACCES 10013; OS exclusion or socket permissions)."
                $exitCode = 2
            } else {
                # Other socket error
                $status = "ERROR"
                $reason = "SOCKET_ERROR_IPV4"
                $processDesc = ""
                $diagnostic = "IPv4 socket bind failed on port $($Port): $($sockEx.Message) (SocketErrorCode: $($sockEx.SocketErrorCode), NativeErrorCode: $($sockEx.NativeErrorCode))."
                $exitCode = 2
            }
        } catch {
            $status = "ERROR"
            $reason = "PROBE_EXCEPTION_IPV4"
            $processDesc = ""
            $diagnostic = "Unexpected IPv4 bind probe error on port $($Port): $($_.Exception.Message)"
            $exitCode = 2
        }

        # ----------------------------------------------------------------------
        # 3. Socket Bindability Probe on IPv6 ([::]) if IPv4 succeeded & OS supports IPv6
        # ----------------------------------------------------------------------
        if ($status -eq "FREE" -and [System.Net.Sockets.Socket]::OSSupportsIPv6) {
            try {
                $v6Listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::IPv6Any, $Port)
                $v6Listener.ExclusiveAddressUse = $true
                $v6Listener.Start()
                $v6Listener.Stop()
            } catch [System.Net.Sockets.SocketException] {
                $sockEx = $_.Exception
                if ($sockEx.SocketErrorCode -eq [System.Net.Sockets.SocketError]::AddressAlreadyInUse) {
                    # WSAEADDRINUSE 10048 - Confirmed port occupation
                    $status = "OCCUPIED"
                    $reason = "BIND_ADDRINUSE_IPV6"
                    $processDesc = ""
                    $diagnostic = "IPv6 socket bind failed on port $($Port): Address already in use (WSAEADDRINUSE 10048)."
                    $exitCode = 1
                } elseif ($sockEx.SocketErrorCode -eq [System.Net.Sockets.SocketError]::AccessDenied) {
                    $status = "ERROR"
                    $reason = "ACCESS_DENIED_IPV6"
                    $processDesc = ""
                    $diagnostic = "IPv6 socket bind failed on port $($Port): Access denied (WSAEACCES 10013; OS exclusion or socket permissions)."
                    $exitCode = 2
                } else {
                    $status = "ERROR"
                    $reason = "SOCKET_ERROR_IPV6"
                    $processDesc = ""
                    $diagnostic = "IPv6 socket bind failed on port $($Port): $($sockEx.Message) (SocketErrorCode: $($sockEx.SocketErrorCode), NativeErrorCode: $($sockEx.NativeErrorCode))."
                    $exitCode = 2
                }
            } catch {
                $status = "ERROR"
                $reason = "PROBE_EXCEPTION_IPV6"
                $processDesc = ""
                $diagnostic = "Unexpected IPv6 bind probe error on port $($Port): $($_.Exception.Message)"
                $exitCode = 2
            }
        }

        if ($status -eq "FREE") {
            $reason = "AVAILABLE"
            $diagnostic = "Port $Port is free and verified bindable on IPv4 and IPv6."
            $exitCode = 0
        }
    }

} catch {
    $status = "ERROR"
    $reason = "INSPECTION_FAILED"
    $processDesc = ""
    $diagnostic = "Port inspection probe execution error: $($_.Exception.Message)"
    $exitCode = 2
}

# ------------------------------------------------------------------------------
# Output Structured Result
# ------------------------------------------------------------------------------
$resultLines = @(
    "STATUS=$status",
    "PORT=$Port",
    "REASON=$reason",
    "PROCESS=$processDesc",
    "DIAGNOSTIC=$diagnostic",
    "EXITCODE=$exitCode"
)

if (![string]::IsNullOrWhiteSpace($OutputFile)) {
    try {
        $outputDir = Split-Path -Parent $OutputFile
        if (![string]::IsNullOrWhiteSpace($outputDir) -and !(Test-Path -Path $outputDir)) {
            New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
        }
        $resultLines | Out-File -FilePath $OutputFile -Encoding UTF8 -Force
    } catch {
        [Console]::Error.WriteLine("Failed to write output file: $($_.Exception.Message)")
    }
}

# Always output human-readable summary to console
Write-Host "[$status] Port $Port - $diagnostic"

exit $exitCode
