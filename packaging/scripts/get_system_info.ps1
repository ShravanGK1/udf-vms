$os = Get-CimInstance Win32_OperatingSystem
$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($identity)
$isAdmin = $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

[PSCustomObject]@{
    OS = $os.Caption
    Version = $os.Version
    Build = $os.BuildNumber
    Architecture = $os.OSArchitecture
    ComputerName = $env:COMPUTERNAME
    UserName = $env:USERNAME
    IsAdmin = $isAdmin
} | Format-List
