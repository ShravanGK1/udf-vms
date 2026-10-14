; ==============================================================================
; Visitor Management System (VMS) - Inno Setup 6 Production Installer Script
; Self-Hosted Commercial Windows Deployment
; Target: 64-bit Windows 10, Windows 11, and Windows Server 2019/2022
; ==============================================================================

#define MyAppName "Visitor Management System"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "VMS Software Solutions"
#define MyAppURL "http://localhost:8089/"
#define MyAppExeName "open_vms.bat"
#define AppGuid "{{A65F3294-712F-4A9B-983C-B6D743D2F710}}"

[Setup]
; Unique application identification for upgrade tracking
AppId={#AppGuid}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}

; Destination Directories
DefaultDirName={autopf}\VMS
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes

; Output Configuration
OutputDir=..\..\dist_installer
OutputBaseFilename=VMS_Setup_v1.0.0
SetupIconFile=assets\app_icon.ico
UninstallDisplayIcon={app}\packaging\installer\assets\app_icon.ico

; Administrative & System Requirements
PrivilegesRequired=admin
PrivilegesRequiredOverridesAllowed=commandline
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
MinVersion=10.0.17763

; Compression Settings (Ultra solid compression for packaging runtimes)
Compression=lzma2/ultra64
SolidCompression=yes

; Wizard Aesthetics & Behavior
WizardStyle=modern
DisableDirPage=no
DisableWelcomePage=no
CloseApplications=no
RestartApplications=no

; License & Notice Presentation
LicenseFile=THIRD_PARTY_LICENSES.txt

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"

[Dirs]
; Binary installation directories
Name: "{app}\backend"
Name: "{app}\frontend\dist"
Name: "{app}\bin\python"
Name: "{app}\bin\database"
Name: "{app}\bin\proxy"
Name: "{app}\bin\winsw"
Name: "{app}\config"
Name: "{app}\packaging\scripts"
Name: "{app}\packaging\installer\helpers"
Name: "{app}\packaging\installer\assets"

; Persistent data directories (C:\ProgramData\VMS)
Name: "{commonappdata}\VMS\data"; Flags: uninsneveruninstall
Name: "{commonappdata}\VMS\uploads"; Flags: uninsneveruninstall
Name: "{commonappdata}\VMS\uploads_users"; Flags: uninsneveruninstall
Name: "{commonappdata}\VMS\logs"; Flags: uninsneveruninstall
Name: "{commonappdata}\VMS\keys"; Flags: uninsneveruninstall
Name: "{commonappdata}\VMS\backups"; Flags: uninsneveruninstall

[Files]
; 1. Backend Application Code (Flask API)
; Exclude git artifacts, local dev .env, cached pyc, and test databases
Source: "..\..\vms\vms_backend\*"; DestDir: "{app}\backend"; Flags: ignoreversion recursesubdirs createallsubdirs; \
    Excludes: ".git*,.env*,.venv*,*.pyc,__pycache__\*,scratch\*,tests\*,uploads\*,uploads_users\*,logs\*"

; 2. Frontend Compiled Static Assets (React 19 SPA Build)
Source: "..\..\vms\vms_frontend\dist\*"; DestDir: "{app}\frontend\dist"; Flags: ignoreversion recursesubdirs createallsubdirs

; 3. Bundled Runtimes (Extracted or pre-assembled in dist_runtime)
; Embedded Python 3.11 Runtime
Source: "..\..\dist_runtime\bin\python\*"; DestDir: "{app}\bin\python"; Flags: ignoreversion recursesubdirs createallsubdirs

; Portable MariaDB 10.11 Binaries
Source: "..\..\dist_runtime\bin\database\*"; DestDir: "{app}\bin\database"; Flags: ignoreversion recursesubdirs createallsubdirs

; Caddy Web Server / Reverse Proxy Binary
Source: "..\..\dist_runtime\bin\proxy\*"; DestDir: "{app}\bin\proxy"; Flags: ignoreversion recursesubdirs createallsubdirs

; WinSW Executables & Configs
Source: "..\..\dist_runtime\bin\winsw\*"; DestDir: "{app}\bin\winsw"; Flags: ignoreversion recursesubdirs createallsubdirs

; 4. Service XML Definitions & Reverse Proxy Configurations
Source: "..\services\*.xml"; DestDir: "{app}\config"; Flags: ignoreversion
Source: "..\services\*.xml"; DestDir: "{app}\bin\winsw"; Flags: ignoreversion
Source: "..\proxy\Caddyfile"; DestDir: "{app}\config"; Flags: ignoreversion
Source: "..\services\my.ini"; DestDir: "{app}\config"; Flags: ignoreversion

; 5. Orchestration & Helper Scripts
Source: "..\scripts\*"; DestDir: "{app}\packaging\scripts"; Flags: ignoreversion
Source: "..\scripts\check_port.ps1"; Flags: dontcopy
Source: "helpers\*"; DestDir: "{app}\packaging\installer\helpers"; Flags: ignoreversion
Source: "assets\*"; DestDir: "{app}\packaging\installer\assets"; Flags: ignoreversion
Source: "THIRD_PARTY_LICENSES.txt"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
; Start Menu Shortcuts
Name: "{group}\{#MyAppName}"; Filename: "{app}\packaging\installer\helpers\{#MyAppExeName}"; IconFilename: "{app}\packaging\installer\assets\app_icon.ico"
Name: "{group}\VMS Diagnostics"; Filename: "{app}\bin\python\python.exe"; Parameters: """{app}\packaging\scripts\check_services.py"""; IconFilename: "{app}\packaging\installer\assets\app_icon.ico"
Name: "{group}\Third-Party Licenses"; Filename: "{app}\THIRD_PARTY_LICENSES.txt"
Name: "{group}\{cm:UninstallProgram,{#MyAppName}}"; Filename: "{uninstallexe}"

; Desktop Shortcut (Optional)
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\packaging\installer\helpers\{#MyAppExeName}"; IconFilename: "{app}\packaging\installer\assets\app_icon.ico"; Tasks: desktopicon

[Run]
; Run silent elevated post-installation script to initialize database, credentials, and services
Filename: "{cmd}"; Parameters: "/c """"{app}\packaging\installer\helpers\post_install.bat"" ""{app}"" ""{commonappdata}\VMS"""""; \
    StatusMsg: "Configuring services and initializing secure database..."; Flags: runhidden waituntilterminated

; Launch application in browser on successful installation
Filename: "{app}\packaging\installer\helpers\{#MyAppExeName}"; Description: "{cm:LaunchProgram,{#StringChange(MyAppName, '&', '&&')}}"; Flags: postinstall shellexec skipifsilent nowait

[UninstallRun]
; Gracefully stop and unregister services before removing files
Filename: "{cmd}"; Parameters: "/c """"{app}\packaging\installer\helpers\pre_uninstall.bat"" ""{app}"""""; \
    RunOnceId: "VMS_PreUninstall"; Flags: runhidden waituntilterminated

; ==============================================================================
; Pascal Scripting: Validation, Port Checks, Upgrade Protection, and Lifecycle
; ==============================================================================
[Code]
var
  IsUpgradeMode: Boolean;

// Helper: Perform comprehensive IPv4 and IPv6 TCP port conflict and bindability diagnostic
function ProbePort(Port: Integer; var Status, ProcessDesc, Reason, Diagnostic: String; var ExitCode: Integer): Boolean;
var
  ScriptPath, OutputPath, PowerShellExe, Params: String;
  Lines: TArrayOfString;
  ResultCode, I: Integer;
  Line, Key, Val: String;
  EqPos: Integer;
begin
  Status := 'FAILED';
  ProcessDesc := '';
  Reason := 'UNKNOWN';
  Diagnostic := 'Port probe could not be executed.';
  ExitCode := -1;

  ScriptPath := ExpandConstant('{tmp}\check_port.ps1');
  if not FileExists(ScriptPath) then
  begin
    try
      ExtractTemporaryFile('check_port.ps1');
    except
      Log('ExtractTemporaryFile failed for check_port.ps1: ' + GetExceptionMessage);
    end;
  end;

  if not FileExists(ScriptPath) then
  begin
    Status := 'FAILED';
    Diagnostic := 'Failed to extract check_port.ps1 to temporary directory.';
    Result := False;
    Exit;
  end;

  OutputPath := ExpandConstant('{tmp}\port_probe_' + IntToStr(Port) + '.txt');
  DeleteFile(OutputPath);

  PowerShellExe := ExpandConstant('{sys}\WindowsPowerShell\v1.0\powershell.exe');
  if not FileExists(PowerShellExe) then
    PowerShellExe := 'powershell.exe';

  Params := Format('-NoProfile -ExecutionPolicy Bypass -File "%s" -Port %d -OutputFile "%s"', [ScriptPath, Port, OutputPath]);
  Log(Format('Executing port probe for port %d: %s %s', [Port, PowerShellExe, Params]));

  if Exec(PowerShellExe, Params, '', SW_HIDE, ewWaitUntilTerminated, ResultCode) then
  begin
    ExitCode := ResultCode;
    if FileExists(OutputPath) and LoadStringsFromFile(OutputPath, Lines) then
    begin
      for I := 0 to GetArrayLength(Lines) - 1 do
      begin
        Line := Trim(Lines[I]);
        EqPos := Pos('=', Line);
        if EqPos > 1 then
        begin
          Key := Copy(Line, 1, EqPos - 1);
          Val := Copy(Line, EqPos + 1, Length(Line) - EqPos);
          if Key = 'STATUS' then Status := Val
          else if Key = 'PROCESS' then ProcessDesc := Val
          else if Key = 'REASON' then Reason := Val
          else if Key = 'DIAGNOSTIC' then Diagnostic := Val
          else if Key = 'EXITCODE' then ExitCode := StrToIntDef(Val, ResultCode);
        end;
      end;
      DeleteFile(OutputPath);
      Result := (Status = 'FREE');
    end
    else
    begin
      Status := 'FAILED';
      Diagnostic := Format('Port probe did not generate diagnostic output file (PowerShell process exit code: %d).', [ResultCode]);
      Result := False;
    end;
  end
  else
  begin
    Status := 'FAILED';
    Diagnostic := Format('Failed to launch PowerShell executable (System error code: %d).', [ResultCode]);
    Result := False;
  end;
end;

// Pre-Installation System & Environment Checks
function InitializeSetup: Boolean;
var
  PrevVersion: String;
  ConflictProc: String;
  ProcMsg: String;
  PortStatus: String;
  ConflictReason: String;
  DiagnosticMsg: String;
  ProbeExitCode: Integer;
  ResultCode: Integer;
begin
  Result := True;

  // 1. Architecture Check
  if not Is64BitInstallMode then
  begin
    MsgBox('Visitor Management System requires a 64-bit (x64) Windows operating system.', mbCriticalError, MB_OK);
    Result := False;
    Exit;
  end;

  // 2. Detect Existing Installation (Upgrade vs Fresh Install)
  IsUpgradeMode := False;
  if RegQueryStringValue(HKLM, 'SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\{#AppGuid}_is1', 'DisplayVersion', PrevVersion) then
  begin
    IsUpgradeMode := True;
    Log('Existing VMS version detected: ' + PrevVersion + '. Running in UPGRADE mode.');
    // Stop VMS services if running to avoid self-conflict during upgrade port verification
    Exec(ExpandConstant('{cmd}'), '/c net stop VMS-Proxy >nul 2>&1 & net stop VMS-Database >nul 2>&1', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  end;

  // 3. Port Conflict Checks (Database Port 3307, HTTP Port 8089, and HTTPS Port 8009)
  // Check MariaDB Database Port 3307
  if not ProbePort(3307, PortStatus, ConflictProc, ConflictReason, DiagnosticMsg, ProbeExitCode) then
  begin
    if PortStatus = 'OCCUPIED' then
    begin
      if ConflictProc <> '' then
        ProcMsg := 'is currently occupied by process: ' + ConflictProc
      else
        ProcMsg := 'is currently occupied by an existing socket (WSAEADDRINUSE 10048)';

      MsgBox('Setup cannot continue because Database Port 3307 ' + ProcMsg + '.' + #13#10#13#10 +
             'Diagnostic Details:' + #13#10 +
             DiagnosticMsg + #13#10#13#10 +
             'The Visitor Management System requires TCP port 3307 for its bundled MariaDB database engine.' + #13#10#13#10 +
             'Please close or reconfigure the conflicting application and run Setup again.',
             mbCriticalError, MB_OK);
    end
    else
    begin
      // Inspection probe failed or unexpected error - distinct diagnostic message
      MsgBox('Setup could not verify the availability of Database Port 3307.' + #13#10#13#10 +
             'Diagnostic Details:' + #13#10 +
             DiagnosticMsg + #13#10#13#10 +
             'Setup encountered an error while inspecting port 3307 and cannot confirm whether the port is available.' + #13#10#13#10 +
             'Please verify administrative privileges, security policy, or network configuration and run Setup again.',
             mbCriticalError, MB_OK);
    end;
    Result := False;
    Exit;
  end;

  // Check HTTP Port 8089
  if not ProbePort(8089, PortStatus, ConflictProc, ConflictReason, DiagnosticMsg, ProbeExitCode) then
  begin
    if PortStatus = 'OCCUPIED' then
    begin
      if ConflictProc <> '' then
        ProcMsg := 'is currently occupied by process: ' + ConflictProc
      else
        ProcMsg := 'is currently occupied by an existing socket (WSAEADDRINUSE 10048)';

      MsgBox('Setup cannot continue because HTTP Port 8089 ' + ProcMsg + '.' + #13#10#13#10 +
             'Diagnostic Details:' + #13#10 +
             DiagnosticMsg + #13#10#13#10 +
             'The Visitor Management System requires port 8089 for HTTP web and API traffic.' + #13#10#13#10 +
             'Please close or reconfigure the conflicting application and run Setup again.',
             mbCriticalError, MB_OK);
    end
    else
    begin
      // Inspection probe failed or unexpected error - distinct diagnostic message
      MsgBox('Setup could not verify the availability of HTTP Port 8089.' + #13#10#13#10 +
             'Diagnostic Details:' + #13#10 +
             DiagnosticMsg + #13#10#13#10 +
             'Setup encountered an error while inspecting port 8089 and cannot confirm whether the port is available.' + #13#10#13#10 +
             'Please verify administrative privileges, security policy, or network configuration and run Setup again.',
             mbCriticalError, MB_OK);
    end;
    Result := False;
    Exit;
  end;

  // Check HTTPS Port 8009
  if not ProbePort(8009, PortStatus, ConflictProc, ConflictReason, DiagnosticMsg, ProbeExitCode) then
  begin
    if PortStatus = 'OCCUPIED' then
    begin
      if ConflictProc <> '' then
        ProcMsg := 'is currently occupied by process: ' + ConflictProc
      else
        ProcMsg := 'is currently occupied by an existing socket (WSAEADDRINUSE 10048)';

      MsgBox('Setup cannot continue because HTTPS Port 8009 ' + ProcMsg + '.' + #13#10#13#10 +
             'Diagnostic Details:' + #13#10 +
             DiagnosticMsg + #13#10#13#10 +
             'The Visitor Management System requires port 8009 for secure HTTPS web and webcam traffic.' + #13#10#13#10 +
             'Please close or reconfigure the conflicting application and run Setup again.',
             mbCriticalError, MB_OK);
    end
    else
    begin
      // Inspection probe failed or unexpected error - distinct diagnostic message
      MsgBox('Setup could not verify the availability of HTTPS Port 8009.' + #13#10#13#10 +
             'Diagnostic Details:' + #13#10 +
             DiagnosticMsg + #13#10#13#10 +
             'Setup encountered an error while inspecting port 8009 and cannot confirm whether the port is available.' + #13#10#13#10 +
             'Please verify administrative privileges, security policy, or network configuration and run Setup again.',
             mbCriticalError, MB_OK);
    end;
    Result := False;
    Exit;
  end;
end;

// Installation Steps Lifecycle
procedure CurStepChanged(CurStep: TSetupStep);
var
  ResultCode: Integer;
  BackupScript: String;
  StopCommand: String;
begin
  if CurStep = ssInstall then
  begin
    if IsUpgradeMode then
    begin
      // 1. Stop existing services prior to file extraction to prevent locked file errors
      Log('Upgrading existing VMS: Stopping services...');
      StopCommand := '/c net stop VMS-Proxy >nul 2>&1 & net stop VMS-Backend >nul 2>&1 & net stop VMS-Database >nul 2>&1';
      Exec(ExpandConstant('{cmd}'), StopCommand, '', SW_HIDE, ewWaitUntilTerminated, ResultCode);

      // 2. Automated pre-upgrade database backup
      BackupScript := ExpandConstant('{tmp}\backup_database.bat');
      if FileExists(ExpandConstant('{app}\packaging\installer\helpers\backup_database.bat')) then
      begin
        Log('Executing automated pre-upgrade backup...');
        Exec(ExpandConstant('{cmd}'), Format('/c """%s\packaging\installer\helpers\backup_database.bat"" ""%s"""', [ExpandConstant('{app}'), ExpandConstant('{commonappdata}\VMS')]), '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
      end;
    end;
  end;
end;

// Uninstallation Confirmation & Persistent Data Policy Notice
function InitializeUninstall: Boolean;
begin
  Result := True;
  if MsgBox('Are you sure you want to completely uninstall the Visitor Management System?' + #13#10#13#10 +
            'Note: Your visitor history, photographs, database files, and configuration under C:\ProgramData\VMS will be preserved safely.',
            mbConfirmation, MB_YESNO) = IDNO then
  begin
    Result := False;
  end;
end;
