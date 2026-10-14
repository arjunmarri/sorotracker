; SoroTrack Inno Setup Installer Script
; Compiles into SoroTrack-Setup-v1.1.0.exe using Inno Setup 6 (https://jrsoftware.org/isdl.php)

#define MyAppName "SoroTrack"
#define MyAppVersion "1.1.0"
#define MyAppPublisher "SoroTrack Team"
#define MyAppURL "https://ais-dev-f2e37stwdlnm6j6goghk7i-17336764235.asia-east1.run.app"
#define MyAppExeName "SoroTrackInstaller.exe"

[Setup]
AppId={{9B7F164C-4D2A-4F35-86A9-E342B28965BF}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}
DefaultDirName={localappdata}\{#MyAppName}
DisableProgramGroupPage=yes
OutputBaseFilename=SoroTrack-Setup-v{#MyAppVersion}
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=lowest
OutputDir=..\dist

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"

[Files]
; Copy all browser extension files into extension/ directory
Source: "..\extension\*"; DestDir: "{app}\extension"; Flags: ignoreversion recursesubdirs createallsubdirs
; Copy the native installer / launcher
Source: "..\scripts\SoroTrackInstaller.exe"; DestDir: "{app}"; Flags: ignoreversion skipifsourcedoesntexist
; Copy batch launcher
Source: "..\server\installer.ts"; DestDir: "{app}\docs"; Flags: ignoreversion skipifsourcedoesntexist

[Icons]
Name: "{autoprograms}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{autodesktop}\Launch SoroTrack Browser"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "Launch SoroTrack Browser Setup"; Flags: postinstall nowait skipifsourcedoesntexist
