import JSZip from 'jszip';

export type TargetBrowser = 'firefox' | 'chrome' | 'edge' | 'universal';

export async function packageExtensionZip(
  files: Record<string, string>, 
  binaryFiles: Record<string, string>,
  targetBrowser: TargetBrowser = 'firefox',
  appOrigin?: string,
  authToken?: string
): Promise<Blob> {
  const zip = new JSZip();

  // Clone files to allow browser-specific manifest customization and live URL injection
  const bundleFiles: Record<string, string> = {};
  const originToInject = appOrigin && appOrigin !== 'null' && !appOrigin.startsWith('file:') 
    ? appOrigin.replace(/\/+$/, '') 
    : 'http://localhost:3000';

  for (const [filename, content] of Object.entries(files)) {
    let modified = content;

    // Replace default localhost:3000 with actual live app origin so extension talks to this app directly
    if (originToInject && originToInject !== 'http://localhost:3000') {
      modified = modified.replace(/http:\/\/localhost:3000/g, originToInject);
    }

    // Inject authentication token into extension scripts and HTML defaults
    if (authToken && authToken.trim()) {
      const cleanToken = authToken.trim();
      if (filename === 'content.js' || filename === 'background.js') {
        modified = modified.replace(/authToken:\s*['"][^'"]*['"]/g, `authToken: '${cleanToken}'`);
      }
      if (filename === 'popup.html') {
        modified = modified.replace(
          /id="auth-token"\s*placeholder="sh_live_\.\.\."/g,
          `id="auth-token" value="${cleanToken}" placeholder="sh_live_..."`
        );
      }
      if (filename === 'options.html') {
        modified = modified.replace(
          /id="authToken"\s*placeholder="sh_live_\.\.\."/g,
          `id="authToken" value="${cleanToken}" placeholder="sh_live_..."`
        );
      }
      if (filename === 'options.js' || filename === 'popup.js') {
        modified = modified.replace(/stored\?\.authToken\s*\|\|\s*''/g, `stored?.authToken || '${cleanToken}'`);
      }
    }

    bundleFiles[filename] = modified;
  }

  if (bundleFiles['manifest.json']) {
    try {
      const manifest = JSON.parse(bundleFiles['manifest.json']);
      if (targetBrowser === 'chrome' || targetBrowser === 'edge') {
        manifest.background = {
          service_worker: 'background.js'
        };
        delete manifest.browser_specific_settings;
        if (targetBrowser === 'edge') {
          manifest.name = 'SoroTrack Extension (Microsoft Edge)';
        }
      } else if (targetBrowser === 'firefox') {
        manifest.background = {
          scripts: ['background.js']
        };
        manifest.browser_specific_settings = {
          gecko: {
            id: 'sorotrack@dashboard.local',
            strict_min_version: '109.0'
          }
        };
      }

      // Ensure unlimitedStorage and alarms are included for complete local snippet syncing and versioning
      if (!manifest.permissions) {
        manifest.permissions = ['storage', 'unlimitedStorage', 'activeTab', 'alarms'];
      } else {
        if (!manifest.permissions.includes('unlimitedStorage')) manifest.permissions.push('unlimitedStorage');
        if (!manifest.permissions.includes('alarms')) manifest.permissions.push('alarms');
        if (!manifest.permissions.includes('activeTab')) manifest.permissions.push('activeTab');
      }

      // Ensure content scripts run on every page for Personal AI Assistant
      if (Array.isArray(manifest.content_scripts) && manifest.content_scripts[0]) {
        manifest.content_scripts[0].matches = ['<all_urls>'];
      }

      // Ensure live app origin and local LLM ports are explicitly allowed in host permissions
      if (!manifest.host_permissions) {
        manifest.host_permissions = [];
      }
      const neededHostPerms = ['*://*/*', 'http://*/*', 'https://*/*', 'http://localhost:*/*', 'http://127.0.0.1:*/*'];
      if (originToInject) {
        neededHostPerms.push(`${originToInject}/*`);
      }
      neededHostPerms.forEach(perm => {
        if (!manifest.host_permissions.includes(perm)) {
          manifest.host_permissions.push(perm);
        }
      });

      bundleFiles['manifest.json'] = JSON.stringify(manifest, null, 2);
    } catch (err) {
      console.warn('Failed to customize manifest for target browser:', err);
    }
  }

  // Add text files with standard DOS file attributes
  for (const [filename, content] of Object.entries(bundleFiles)) {
    zip.file(filename, content, {
      date: new Date(),
      dosPermissions: 0x20
    });
  }

  // Add binary files (icons) with standard DOS file attributes
  for (const [filename, base64Content] of Object.entries(binaryFiles)) {
    zip.file(filename, base64Content, { 
      base64: true,
      date: new Date(),
      dosPermissions: 0x20
    });
  }

  return await zip.generateAsync({ 
    type: 'blob',
    mimeType: 'application/zip',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
    platform: 'DOS'
  });
}

export function detectUserOS(): 'windows' | 'mac' | 'linux' | 'other' {
  if (typeof window === 'undefined') return 'windows';
  const ua = window.navigator.userAgent;
  const platform = (window.navigator as any).userAgentData?.platform || window.navigator.platform || '';
  if (/Mac|iPhone|iPod|iPad/i.test(platform) || /Macintosh/i.test(ua)) {
    return 'mac';
  }
  if (/Win/i.test(platform) || /Windows/i.test(ua)) {
    return 'windows';
  }
  if (/Linux/i.test(platform) || /Linux/i.test(ua)) {
    return 'linux';
  }
  return 'other';
}

export async function packageInstallerZip(
  files: Record<string, string>,
  binaryFiles: Record<string, string>,
  os: 'windows' | 'mac' = 'windows',
  appOrigin?: string,
  authToken?: string,
  latestVersion: string = '1.1.0'
): Promise<Blob> {
  const zip = new JSZip();
  const originToInject = appOrigin && appOrigin !== 'null' && !appOrigin.startsWith('file:')
    ? appOrigin.replace(/\/+$/, '')
    : 'http://localhost:3000';

  // Add extension files into extension/ directory
  for (const [filename, content] of Object.entries(files)) {
    let modified = content;
    if (originToInject && originToInject !== 'http://localhost:3000') {
      modified = modified.replace(/http:\/\/localhost:3000/g, originToInject);
    }
    if (authToken && authToken.trim()) {
      const cleanToken = authToken.trim();
      if (filename === 'content.js' || filename === 'background.js') {
        modified = modified.replace(/authToken:\s*['"][^'"]*['"]/g, `authToken: '${cleanToken}'`);
      }
      if (filename === 'popup.html') {
        modified = modified.replace(/id="auth-token"\s*placeholder="sh_live_\.\.\."/g, `id="auth-token" value="${cleanToken}" placeholder="sh_live_..."`);
      }
      if (filename === 'options.html') {
        modified = modified.replace(/id="authToken"\s*placeholder="sh_live_\.\.\."/g, `id="authToken" value="${cleanToken}" placeholder="sh_live_..."`);
      }
      if (filename === 'options.js' || filename === 'popup.js') {
        modified = modified.replace(/stored\?\.authToken\s*\|\|\s*''/g, `stored?.authToken || '${cleanToken}'`);
      }
    }

    if (filename === 'manifest.json') {
      try {
        const manifest = JSON.parse(modified);
        manifest.background = { service_worker: 'background.js' };
        if (originToInject) {
          if (!manifest.host_permissions) manifest.host_permissions = [];
          const permPattern = `${originToInject}/*`;
          if (!manifest.host_permissions.includes(permPattern)) manifest.host_permissions.push(permPattern);
        }
        modified = JSON.stringify(manifest, null, 2);
      } catch {}
    }

    if (os === 'mac') {
      zip.file(`extension/${filename}`, modified, {
        date: new Date(),
        unixPermissions: 0o100644
      });
    } else {
      zip.file(`extension/${filename}`, modified, {
        date: new Date(),
        dosPermissions: 0x20
      });
    }
  }

  // Add binary icons into extension/ directory
  for (const [filename, base64Content] of Object.entries(binaryFiles)) {
    if (os === 'mac') {
      zip.file(`extension/${filename}`, base64Content, {
        base64: true,
        date: new Date(),
        unixPermissions: 0o100644
      });
    } else {
      zip.file(`extension/${filename}`, base64Content, {
        base64: true,
        date: new Date(),
        dosPermissions: 0x20
      });
    }
  }

  if (os === 'windows') {
    // Windows Batch Launcher
    const batScript = `@echo off
setlocal enabledelayedexpansion
title SoroTrack Extension Installer for Windows
echo ============================================================
echo      SoroTrack Browser Extension - Windows 1-Click Setup
echo ============================================================
echo.
where powershell >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo [*] Starting automated installer wizard...
    powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1"
    goto :end
)
echo [*] Installing via Windows Command Prompt...
set "DEST_DIR=%LOCALAPPDATA%\\SoroTrack\\extension"
if not exist "%DEST_DIR%" mkdir "%DEST_DIR%"
if exist "%~dp0extension" (
    xcopy /E /I /Y /Q "%~dp0extension\\*" "%DEST_DIR%\\"
) else (
    xcopy /E /I /Y /Q "%~dp0*" "%DEST_DIR%\\"
)
echo [OK] Extension files copied to %DEST_DIR%
echo %DEST_DIR%| clip
echo [OK] Extension path copied to Windows Clipboard!
if exist "%PROGRAMFILES(X86)%\\Microsoft\\Edge\\Application\\msedge.exe" (
    start "" "%PROGRAMFILES(X86)%\\Microsoft\\Edge\\Application\\msedge.exe" --load-extension="%DEST_DIR%" edge://extensions
    echo [OK] Launched Microsoft Edge with SoroTrack!
) else if exist "%PROGRAMFILES%\\Google\\Chrome\\Application\\chrome.exe" (
    start "" "%PROGRAMFILES%\\Google\\Chrome\\Application\\chrome.exe" --load-extension="%DEST_DIR%" chrome://extensions
    echo [OK] Launched Google Chrome with SoroTrack!
)
:end
echo.
echo ============================================================
echo  Setup complete! Press any key to exit.
echo ============================================================
pause >nul
`;

    // Windows PowerShell installer
    const psScript = `# SoroTrack Browser Extension Automated Installer for Windows
# Version: v${latestVersion}
[CmdletBinding()]
param()

$Host.UI.RawUI.WindowTitle = "SoroTrack Browser Extension Setup"
Clear-Host

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "     SoroTrack Browser Extension - Windows 1-Click Setup    " -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  Target Version: v${latestVersion}" -ForegroundColor DarkGray
Write-Host ""

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$sourceDir = if (Test-Path "$scriptDir\\extension\\manifest.json") { "$scriptDir\\extension" } else { $scriptDir }
$targetDir = "$env:LOCALAPPDATA\\SoroTrack\\extension"

if (-not (Test-Path $targetDir)) {
    New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
}

if (-not (Test-Path "$sourceDir\\manifest.json")) {
    Write-Host "[*] Fetching latest extension files from SoroTrack..." -ForegroundColor Yellow
    $zipTemp = "$env:TEMP\\sorotrack-ext.zip"
    $appUrl = "${originToInject}"
    try {
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        Invoke-WebRequest -Uri "$appUrl/api/extension/download?browser=edge" -OutFile $zipTemp -UseBasicParsing
        Expand-Archive -Path $zipTemp -DestinationPath $targetDir -Force
        Remove-Item -Path $zipTemp -Force -ErrorAction SilentlyContinue
    } catch {
        Write-Warning "Direct web download error: $_"
    }
} else {
    Write-Host "[*] Copying extension files to application storage..." -ForegroundColor White
    Copy-Item -Path "$sourceDir\\*" -Destination $targetDir -Recurse -Force
}

if (-not (Test-Path "$targetDir\\manifest.json")) {
    Write-Host "[ERROR] Could not find extension files in $targetDir" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host "[OK] Extension installed to permanent folder:" -ForegroundColor Green
Write-Host "     $targetDir" -ForegroundColor DarkGray
Write-Host ""

try {
    Set-Clipboard -Value $targetDir
    Write-Host "[OK] Path automatically copied to Windows clipboard!" -ForegroundColor Green
} catch {
    try {
        Add-Type -AssemblyName System.Windows.Forms
        [System.Windows.Forms.Clipboard]::SetText($targetDir)
    } catch {}
}

Write-Host "[*] Scanning for installed web browsers on your PC..." -ForegroundColor Cyan

$browserCatalog = @(
    @{
        Name = "Microsoft Edge"
        Icon = "🌊"
        Proc = "msedge"
        Paths = @(
            "\${env:ProgramFiles(x86)}\\Microsoft\\Edge\\Application\\msedge.exe",
            "\${env:ProgramFiles}\\Microsoft\\Edge\\Application\\msedge.exe",
            "$env:LOCALAPPDATA\\Microsoft\\Edge\\Application\\msedge.exe"
        )
        ExtPage = "edge://extensions"
        IsChromium = $true
    },
    @{
        Name = "Google Chrome"
        Icon = "🌐"
        Proc = "chrome"
        Paths = @(
            "\${env:ProgramFiles}\\Google\\Chrome\\Application\\chrome.exe",
            "\${env:ProgramFiles(x86)}\\Google\\Chrome\\Application\\chrome.exe",
            "$env:LOCALAPPDATA\\Google\\Chrome\\Application\\chrome.exe"
        )
        ExtPage = "chrome://extensions"
        IsChromium = $true
    },
    @{
        Name = "Brave Browser"
        Icon = "🦁"
        Proc = "brave"
        Paths = @(
            "\${env:ProgramFiles}\\BraveSoftware\\Brave-Browser\\Application\\brave.exe",
            "\${env:ProgramFiles(x86)}\\BraveSoftware\\Brave-Browser\\Application\\brave.exe",
            "$env:LOCALAPPDATA\\BraveSoftware\\Brave-Browser\\Application\\brave.exe"
        )
        ExtPage = "brave://extensions"
        IsChromium = $true
    },
    @{
        Name = "Arc Browser"
        Icon = "🌈"
        Proc = "Arc"
        Paths = @(
            "$env:LOCALAPPDATA\\Programs\\Arc\\Arc.exe",
            "\${env:ProgramFiles}\\Arc\\Arc.exe"
        )
        ExtPage = "arc://extensions"
        IsChromium = $true
    },
    @{
        Name = "Vivaldi"
        Icon = "🔴"
        Proc = "vivaldi"
        Paths = @(
            "$env:LOCALAPPDATA\\Vivaldi\\Application\\vivaldi.exe",
            "\${env:ProgramFiles}\\Vivaldi\\Application\\vivaldi.exe"
        )
        ExtPage = "vivaldi://extensions"
        IsChromium = $true
    },
    @{
        Name = "Opera"
        Icon = "⭕"
        Proc = "opera"
        Paths = @(
            "$env:LOCALAPPDATA\\Programs\\Opera\\launcher.exe",
            "$env:LOCALAPPDATA\\Programs\\Opera GX\\launcher.exe",
            "\${env:ProgramFiles}\\Opera\\launcher.exe"
        )
        ExtPage = "opera://extensions"
        IsChromium = $true
    },
    @{
        Name = "Mozilla Firefox"
        Icon = "🦊"
        Proc = "firefox"
        Paths = @(
            "\${env:ProgramFiles}\\Mozilla Firefox\\firefox.exe",
            "\${env:ProgramFiles(x86)}\\Mozilla Firefox\\firefox.exe"
        )
        ExtPage = "about:debugging#/runtime/this-firefox"
        IsChromium = $false
    }
)

$detected = @()
foreach ($b in $browserCatalog) {
    $foundPath = $null
    foreach ($p in $b.Paths) {
        $expanded = [System.Environment]::ExpandEnvironmentVariables($p)
        if (Test-Path $expanded) {
            $foundPath = $expanded
            break
        }
    }

    if ($foundPath) {
        $running = $false
        try {
            $runningProcs = Get-Process -Name $b.Proc -ErrorAction SilentlyContinue
            if ($runningProcs -and $runningProcs.Count -gt 0) { $running = $true }
        } catch {}

        $detected += [PSCustomObject]@{
            Index      = $detected.Count + 1
            Name       = $b.Name
            Exe        = $foundPath
            Proc       = $b.Proc
            ExtPage    = $b.ExtPage
            Icon       = $b.Icon
            IsChromium = $b.IsChromium
            IsRunning  = $running
        }
    }
}

if ($detected.Count -eq 0) {
    Write-Host "  [-] No standard browser executables found in default directories." -ForegroundColor Yellow
    Write-Host "      Defaulting to Microsoft Edge shortcut." -ForegroundColor DarkGray
    $selectedBrowsers = @([PSCustomObject]@{
        Name = "Microsoft Edge"
        Exe = "msedge.exe"
        Proc = "msedge"
        ExtPage = "edge://extensions"
        Icon = "🌊"
        IsChromium = $true
        IsRunning = $false
    })
} else {
    Write-Host ""
    Write-Host "============================================================" -ForegroundColor Cyan
    Write-Host "         DETECTED BROWSERS - CHOOSE WHERE TO INSTALL        " -ForegroundColor Yellow
    Write-Host "============================================================" -ForegroundColor Cyan
    foreach ($item in $detected) {
        $statusStr = if ($item.IsRunning) { "[RUNNING - restart recommended]" } else { "[IDLE]" }
        $color = if ($item.IsRunning) { "Yellow" } else { "Green" }
        Write-Host "  [$($item.Index)] $($item.Icon) $($item.Name) - $statusStr" -ForegroundColor $color
        Write-Host "      Path: $($item.Exe)" -ForegroundColor DarkGray
    }
    Write-Host ""
    Write-Host "Options:" -ForegroundColor White
    Write-Host "  * Press ENTER or type 'ALL' to install to ALL detected browsers" -ForegroundColor DarkGray
    Write-Host "  * Enter comma-separated numbers (e.g. '1, 2') for specific browsers" -ForegroundColor DarkGray
    Write-Host ""
    $selectionInput = Read-Host "Install SoroTrack to which browsers? [Default: ALL]"
    
    $selectedBrowsers = @()
    if ([string]::IsNullOrWhiteSpace($selectionInput) -or $selectionInput.Trim().ToUpper() -eq "ALL" -or $selectionInput.Trim().ToUpper() -eq "A") {
        $selectedBrowsers = $detected
    } else {
        $indices = $selectionInput -split "[,;\s]+" | ForEach-Object { $_.Trim() } | Where-Object { $_ -ne "" }
        foreach ($idxStr in $indices) {
            $num = 0
            if ([int]::TryParse($idxStr, [ref]$num)) {
                $match = $detected | Where-Object { $_.Index -eq $num }
                if ($match) { $selectedBrowsers += $match }
            }
        }
        if ($selectedBrowsers.Count -eq 0) {
            Write-Host "No valid selection made. Defaulting to ALL detected browsers." -ForegroundColor Yellow
            $selectedBrowsers = $detected
        }
    }
}

Write-Host ""
Write-Host "[*] Selected browsers for installation:" -ForegroundColor Cyan
foreach ($sb in $selectedBrowsers) {
    Write-Host "  ✔ $($sb.Icon) $($sb.Name)" -ForegroundColor Green
}

# Check if any selected browser is running
$anyRunning = ($selectedBrowsers | Where-Object { $_.IsRunning }).Count -gt 0
$restartConsent = $true
if ($anyRunning) {
    Write-Host ""
    Write-Host "[!] Note: Modern Chromium browsers (Edge, Chrome, Brave) silently" -ForegroundColor Yellow
    Write-Host "    ignore new extensions if an instance is running in background" -ForegroundColor Yellow
    Write-Host "    with Startup Boost. Closing running instances enables instant activation." -ForegroundColor Yellow
    $restartPrompt = Read-Host "Close running instances of selected browsers before launch? (Y/n) [Default: Y]"
    if ($restartPrompt.Trim().ToUpper() -eq "N") {
        $restartConsent = $false
    }
}

if ($restartConsent) {
    foreach ($sb in $selectedBrowsers) {
        if ($sb.IsRunning) {
            try {
                Write-Host "[*] Closing active instances of $($sb.Name)..." -ForegroundColor DarkGray
                Stop-Process -Name $sb.Proc -Force -ErrorAction SilentlyContinue
            } catch {}
        }
    }
    Start-Sleep -Milliseconds 600
}

# Create desktop shortcuts and launch confirmed browsers
$desktopDir = [Environment]::GetFolderPath("Desktop")
try { $wscript = New-Object -ComObject WScript.Shell } catch { $wscript = $null }

Write-Host ""
Write-Host "[*] Launching confirmed browsers with SoroTrack pre-loaded..." -ForegroundColor Cyan

foreach ($sb in $selectedBrowsers) {
    if ($wscript -and (Test-Path $desktopDir)) {
        try {
            $shortcutPath = "$desktopDir\\Launch $($sb.Name) with SoroTrack.lnk"
            $shortcut = $wscript.CreateShortcut($shortcutPath)
            $shortcut.TargetPath = $sb.Exe
            if ($sb.IsChromium) {
                $shortcut.Arguments = '--load-extension="' + $targetDir + '"'
            }
            $shortcut.Description = "Launch $($sb.Name) with SoroTrack Extension loaded"
            $shortcut.Save()
        } catch {}
    }

    try {
        if ($sb.IsChromium) {
            Start-Process -FilePath $sb.Exe -ArgumentList ('--load-extension="' + $targetDir + '"'), $sb.ExtPage
        } else {
            Start-Process -FilePath $sb.Exe -ArgumentList $sb.ExtPage
        }
        Write-Host "  ✔ $($sb.Name) launched with SoroTrack!" -ForegroundColor Green
    } catch {
        Write-Warning "Could not start $($sb.Name): $_"
    }
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "               SOROTRACK SETUP COMPLETE!                    " -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "Configured Browsers:" -ForegroundColor Yellow
foreach ($sb in $selectedBrowsers) {
    Write-Host "  - $($sb.Name)" -ForegroundColor White
}
Write-Host ""
Write-Host "FINAL 1-STEP ACTIVATION IN YOUR BROWSER:" -ForegroundColor Cyan
Write-Host " 1. Turn ON 'Developer mode' toggle (top-right or left sidebar of your browser)." -ForegroundColor White
Write-Host " 2. Click 'Load unpacked' button." -ForegroundColor White
Write-Host " 3. Press Ctrl+V in the folder dialog (path is already on your clipboard!)" -ForegroundColor White
Write-Host " 4. Click 'Select Folder'. SoroTrack is now active!" -ForegroundColor White
Write-Host ""
Write-Host "Extension Folder: $targetDir" -ForegroundColor DarkGray
Write-Host ""

$openExplorer = Read-Host "Open extension storage folder in Windows Explorer? (y/N) [Default: N]"
if ($openExplorer.Trim().ToUpper() -eq "Y") {
    Start-Process explorer.exe -ArgumentList $targetDir
}

Write-Host ""
Write-Host "Press Enter to exit installer." -ForegroundColor DarkGray
Read-Host
`;

    zip.file('Install-SoroTrack.bat', batScript, { date: new Date(), dosPermissions: 0x20 });
    zip.file('install.ps1', psScript, { date: new Date(), dosPermissions: 0x20 });
    zip.file('Uninstall-SoroTrack.bat', `@echo off\nrmdir /S /Q "%LOCALAPPDATA%\\SoroTrack" 2>nul\necho SoroTrack uninstalled.\npause\n`, { date: new Date(), dosPermissions: 0x20 });
    zip.file('README_WINDOWS.txt', `============================================================
 SoroTrack Browser Extension - Windows 1-Click Setup v${latestVersion}
============================================================

1. Double-click "Install-SoroTrack.bat".
2. The setup wizard will:
   - Scan and detect all installed web browsers on your PC.
   - Ask you to confirm which browsers you want to install SoroTrack into.
   - Detect running browser processes and offer to close them so Chromium
     will immediately recognize the new extension.
   - Copy SoroTrack into %LOCALAPPDATA%\\SoroTrack\\extension.
   - Copy the folder path to your Windows clipboard (Ctrl+V ready).
   - Launch your selected browsers to their extension settings.
   - Create Desktop shortcuts for future 1-click launching!

FINAL STEP IN YOUR BROWSER:
1. Turn ON "Developer mode" toggle.
2. Click "Load unpacked".
3. Press Ctrl+V (path is already copied) and click "Select Folder".
`, { date: new Date(), dosPermissions: 0x20 });
  } else {
    // Mac / macOS (Optimized for Apple Mac Studio M1/M2/M3/M4 Max/Ultra)
    const macCommand = `#!/usr/bin/env bash
# SoroTrack Personal AI Assistant - Automated Installer for Apple Mac Studio & macOS
# Version: v${latestVersion}

set -e
clear

echo "\\033[1;36m============================================================\\033[0m"
echo "\\033[1;36m   SoroTrack Personal AI Assistant - Mac Studio & macOS    \\033[0m"
echo "\\033[1;36m============================================================\\033[0m"

HW_MODEL=$(sysctl -n hw.model 2>/dev/null || echo "Mac")
CPU_BRAND=$(sysctl -n machdep.cpu.brand_string 2>/dev/null || echo "Apple Silicon")
RAM_BYTES=$(sysctl -n hw.memsize 2>/dev/null || echo "17179869184")
RAM_GB=$(( RAM_BYTES / 1073741824 ))
MACOS_VER=$(sw_vers -productVersion 2>/dev/null || echo "macOS")

echo "  \\033[1;32m[✔]\\033[0m System: $HW_MODEL ($CPU_BRAND)"
echo "  \\033[1;32m[✔]\\033[0m Memory: \${RAM_GB}GB Unified RAM (Metal GPU Acceleration Enabled)"
echo "  \\033[1;32m[✔]\\033[0m OS: macOS $MACOS_VER"
echo "  \\033[1;32m[✔]\\033[0m Target Extension: v${latestVersion}"
echo ""

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TARGET_DIR="$HOME/Library/Application Support/SoroTrack/extension"
mkdir -p "$TARGET_DIR"

xattr -d com.apple.quarantine "$0" 2>/dev/null || true
xattr -cr "$SCRIPT_DIR" 2>/dev/null || true

if [ -f "$SCRIPT_DIR/extension/manifest.json" ]; then
    echo "[*] Copying extension files from bundle..."
    cp -R "$SCRIPT_DIR/extension/"* "$TARGET_DIR/"
elif [ -f "$SCRIPT_DIR/manifest.json" ]; then
    echo "[*] Copying extension files from current directory..."
    cp -R "$SCRIPT_DIR/"* "$TARGET_DIR/"
else
    echo "[*] Downloading latest extension bundle from SoroTrack..."
    APP_URL="${originToInject}"
    TEMP_ZIP="/tmp/sorotrack-ext.zip"
    curl -sSL "$APP_URL/api/extension/download?browser=chrome" -o "$TEMP_ZIP"
    unzip -q -o "$TEMP_ZIP" -d "$TARGET_DIR"
    rm -f "$TEMP_ZIP"
fi

xattr -cr "$TARGET_DIR" 2>/dev/null || true

if [ ! -f "$TARGET_DIR/manifest.json" ]; then
    echo "\\033[1;31m[ERROR] manifest.json could not be found in $TARGET_DIR\\033[0m"
    exit 1
fi

echo "\\033[1;32m[OK] Extension installed to permanent folder:\\033[0m"
echo "     $TARGET_DIR"

printf "%s" "$TARGET_DIR" | pbcopy
echo "\\033[1;32m[OK] Extension path copied to macOS clipboard (Cmd+V ready)!\\033[0m"
echo ""

echo "\\033[1;36m[*] Scanning for installed web browsers on your Mac Studio...\\033[0m"

FOUND_NAMES=()
FOUND_APPS=()
FOUND_URLS=()
FOUND_CHROMIUM=()
FOUND_EXT_DIRS=()

check_mac_browser() {
    local name="$1"
    local app_path="$2"
    local ext_url="$3"
    local is_chromium="$4"
    local ext_reg_dir="$5"

    if [ -d "$app_path" ]; then
        FOUND_NAMES+=("$name")
        FOUND_APPS+=("$app_path")
        FOUND_URLS+=("$ext_url")
        FOUND_CHROMIUM+=("$is_chromium")
        FOUND_EXT_DIRS+=("$ext_reg_dir")
    fi
}

check_mac_browser "Google Chrome" "/Applications/Google Chrome.app" "chrome://extensions" "1" "$HOME/Library/Application Support/Google/Chrome/External Extensions"
check_mac_browser "Microsoft Edge" "/Applications/Microsoft Edge.app" "edge://extensions" "1" "$HOME/Library/Application Support/Microsoft Edge/External Extensions"
check_mac_browser "Brave Browser" "/Applications/Brave Browser.app" "brave://extensions" "1" "$HOME/Library/Application Support/BraveSoftware/Brave-Browser/External Extensions"
check_mac_browser "Arc" "/Applications/Arc.app" "arc://extensions" "1" "$HOME/Library/Application Support/Arc/User Data/Default/Extensions"
check_mac_browser "Mozilla Firefox" "/Applications/Firefox.app" "about:debugging#/runtime/this-firefox" "0" ""
check_mac_browser "Vivaldi" "/Applications/Vivaldi.app" "vivaldi://extensions" "1" "$HOME/Library/Application Support/Vivaldi/External Extensions"
check_mac_browser "Opera" "/Applications/Opera.app" "opera://extensions" "1" "$HOME/Library/Application Support/Opera Software/Opera Stable/External Extensions"

TOTAL_FOUND=\${#FOUND_NAMES[@]}

if [ "$TOTAL_FOUND" -eq 0 ]; then
    echo "  \\033[1;33m[-] No standard browser found in /Applications. Defaulting to Google Chrome / Edge launcher.\\033[0m"
    SELECTED_INDICES=(0)
else
    echo ""
    echo "\\033[1;33m============================================================\\033[0m"
    echo "\\033[1;33m       DETECTED BROWSERS - CONFIRM WHERE TO INSTALL         \\033[0m"
    echo "\\033[1;33m============================================================\\033[0m"
    for i in $(seq 0 $((TOTAL_FOUND - 1))); do
        NUM=$((i + 1))
        echo "  \\033[1;32m[$NUM]\\033[0m \${FOUND_NAMES[$i]} (Path: \${FOUND_APPS[$i]})"
    done
    echo ""
    echo "Options:"
    echo "  * Press ENTER to install and configure for ALL detected browsers"
    echo "  * Or enter comma-separated numbers (e.g. '1, 2') to select specific browsers"
    echo ""
    printf "\\033[1;36mInstall SoroTrack to which browsers? [Default: ALL]: \\033[0m"
    read -r USER_CHOICE || USER_CHOICE=""
    
    SELECTED_INDICES=()
    if [ -z "$USER_CHOICE" ] || [ "$USER_CHOICE" = "all" ] || [ "$USER_CHOICE" = "ALL" ] || [ "$USER_CHOICE" = "a" ]; then
        for i in $(seq 0 $((TOTAL_FOUND - 1))); do
            SELECTED_INDICES+=("$i")
        done
    else
        IFS=',' read -ra ADDR <<< "$USER_CHOICE"
        for sel in "\${ADDR[@]}"; do
            CLEAN_NUM=$(echo "$sel" | tr -d '[:space:]')
            if [ -n "$CLEAN_NUM" ] && [ "$CLEAN_NUM" -ge 1 ] && [ "$CLEAN_NUM" -le "$TOTAL_FOUND" ]; then
                IDX=$((CLEAN_NUM - 1))
                SELECTED_INDICES+=("$IDX")
            fi
        done
        if [ \${#SELECTED_INDICES[@]} -eq 0 ]; then
            echo "No valid selection entered. Defaulting to ALL detected browsers."
            for i in $(seq 0 $((TOTAL_FOUND - 1))); do
                SELECTED_INDICES+=("$i")
            done
        fi
    fi
fi

echo ""
echo "\\033[1;32m[*] Confirmed browsers for SoroTrack installation:\\033[0m"
for idx in "\${SELECTED_INDICES[@]}"; do
    echo "  ✔ \${FOUND_NAMES[$idx]}"
done
echo ""

DESKTOP_DIR="$HOME/Desktop"
mkdir -p "$DESKTOP_DIR"

for idx in "\${SELECTED_INDICES[@]}"; do
    BNAME="\${FOUND_NAMES[$idx]}"
    BAPP="\${FOUND_APPS[$idx]}"
    BURL="\${FOUND_URLS[$idx]}"
    BCHROMIUM="\${FOUND_CHROMIUM[$idx]}"
    BEXTDIR="\${FOUND_EXT_DIRS[$idx]}"

    if [ "$BCHROMIUM" = "1" ] && [ -n "$BEXTDIR" ]; then
        mkdir -p "$BEXTDIR"
        EXT_JSON="$BEXTDIR/sorotrack.json"
        cat << EOF > "$EXT_JSON"
{
  "external_path": "$TARGET_DIR"
}
EOF
    fi

    SAFE_NAME=$(echo "$BNAME" | tr -d ' ()')
    LAUNCHER="$DESKTOP_DIR/Launch $SAFE_NAME with SoroTrack AI.command"
    cat << EOF > "$LAUNCHER"
#!/usr/bin/env bash
TARGET_DIR="$HOME/Library/Application Support/SoroTrack/extension"
if [ "$BCHROMIUM" = "1" ]; then
    open -a "$BAPP" --args --load-extension="\$TARGET_DIR"
else
    open -a "$BAPP" "$BURL"
fi
EOF
    chmod +x "$LAUNCHER"
done

MASTER_LAUNCHER="$DESKTOP_DIR/Launch All Browsers with SoroTrack AI.command"
cat << EOF > "$MASTER_LAUNCHER"
#!/usr/bin/env bash
TARGET_DIR="$HOME/Library/Application Support/SoroTrack/extension"
EOF
for idx in "\${SELECTED_INDICES[@]}"; do
    BAPP="\${FOUND_APPS[$idx]}"
    BURL="\${FOUND_URLS[$idx]}"
    BCHROMIUM="\${FOUND_CHROMIUM[$idx]}"
    if [ "$BCHROMIUM" = "1" ]; then
        echo "open -a \"$BAPP\" --args --load-extension=\"\$TARGET_DIR\"" >> "$MASTER_LAUNCHER"
    else
        echo "open -a \"$BAPP\" \"$BURL\"" >> "$MASTER_LAUNCHER"
    fi
done
chmod +x "$MASTER_LAUNCHER"

echo "\\033[1;36m[*] Checking for Local LLM inferencing engine on Mac Studio...\\033[0m"
OLLAMA_CHECK=$(curl -s --connect-timeout 2 http://127.0.0.1:11434/api/tags 2>/dev/null || echo "")
LMSTUDIO_CHECK=$(curl -s --connect-timeout 2 http://127.0.0.1:1234/v1/models 2>/dev/null || echo "")

if [ -n "$OLLAMA_CHECK" ]; then
    echo "  \\033[1;32m[✔] Ollama is active with Apple Silicon Metal acceleration!\\033[0m"
    echo "      Endpoint: http://127.0.0.1:11434"
elif [ -n "$LMSTUDIO_CHECK" ]; then
    echo "  \\033[1;32m[✔] LM Studio is active on Mac Studio!\\033[0m"
    echo "      Endpoint: http://127.0.0.1:1234"
else
    echo "  \\033[1;33m[-] No running Local LLM detected on port 11434 or 1234.\\033[0m"
    echo "      To run models at full Metal GPU speed on your Mac Studio:"
    echo "      Run: brew install ollama && ollama run llama3.2"
fi

echo ""
echo "\\033[1;36m[*] Launching confirmed browsers with SoroTrack Personal AI Assistant...\\033[0m"
for idx in "\${SELECTED_INDICES[@]}"; do
    BNAME="\${FOUND_NAMES[$idx]}"
    BAPP="\${FOUND_APPS[$idx]}"
    BURL="\${FOUND_URLS[$idx]}"
    BCHROMIUM="\${FOUND_CHROMIUM[$idx]}"

    echo "  → Launching $BNAME..."
    if [ "$BCHROMIUM" = "1" ]; then
        open -a "$BAPP" --args --load-extension="$TARGET_DIR" "$BURL" || true
    else
        open -a "$BAPP" "$BURL" || true
    fi
done

osascript -e 'display notification "SoroTrack Little Icon is now active on all web pages in your confirmed browsers!" with title "SoroTrack on Mac Studio" subtitle "Ready to use"' 2>/dev/null || true

echo ""
echo "\\033[1;36m============================================================\\033[0m"
echo "\\033[1;32m       INSTALLATION COMPLETE ON APPLE MAC STUDIO!           \\033[0m"
echo "\\033[1;36m============================================================\\033[0m"
echo ""
echo "\\033[1;37mWHERE TO FIND THE ASSISTANT ON EVERY WEB PAGE:\\033[0m"
echo "  1. A little icon (⚡) will appear in the bottom-right corner of"
echo "     EVERY web page in all confirmed browsers."
echo "  2. Click the little icon anytime, or press Option+S (⌥S) on Mac Studio"
echo "     or Alt+S on Windows."
echo "  3. Ask it anything:"
echo "     • 'research all the startups listed here and summarize'"
echo "     • 'remove all the non-tech content from the page'"
echo "     • 'turn this webpage into minimalist - remove all the graphics, heavy images'"
echo "  4. Launch anytime via the shortcuts created on your Desktop."
echo ""
echo "Press any key to close this terminal."
read -n 1 -s
`;

    zip.file('Install-SoroTrack.command', macCommand, { date: new Date(), unixPermissions: 0o100755 });
    zip.file('Uninstall-SoroTrack.command', `#!/usr/bin/env bash\nrm -rf "$HOME/Library/Application Support/SoroTrack"\nrm -f "$HOME/Desktop/Launch Browser with SoroTrack.command"\necho "SoroTrack uninstalled."\n`, { date: new Date(), unixPermissions: 0o100755 });
    
    const macReadme = `============================================================
 SoroTrack Browser Extension - macOS 1-Click Setup v${latestVersion}
============================================================

INSTALLATION:
Double-click "Install-SoroTrack.command".

WHY DID APPLE SAY: "Apple could not verify the downloadable file"?
macOS Gatekeeper automatically places "com.apple.quarantine" on files
downloaded through web browsers.

EASY WAYS TO BYPASS OR INSTALL VIA HOMEBREW:
1. Right-Click "Install-SoroTrack.command" -> Click Open -> Click Open.
2. In Terminal: xattr -cr ~/Downloads/sorotrack-installer-mac*
3. Install with Homebrew (brew):
   brew install --formula ${originToInject}/api/extension/brew/sorotrack.rb
   (or brew install --formula ./sorotrack.rb)
4. Terminal 1-line curl:
   curl -fsSL "${originToInject}/api/extension/installer/script?os=mac" | bash
`;
    zip.file('README_MAC.txt', macReadme, { date: new Date(), unixPermissions: 0o100644 });

    // Client-side generated sorotrack.rb formula
    const clientFormula = `class Sorotrack < Formula
  desc "SoroTrack browser extension & multi-browser history sync CLI"
  homepage "${originToInject}"
  url "${originToInject}/api/extension/installer?os=mac"
  version "${latestVersion}"

  def install
    if (buildpath/"extension").exist?
      (pkgshare/"extension").install Dir["#{buildpath}/extension/*"]
    else
      (pkgshare/"extension").install Dir["#{buildpath}/*"]
    end

    (bin/"sorotrack").write <<~EOS
      #!/usr/bin/env bash
      set -e
      TARGET_DIR="$HOME/Library/Application Support/SoroTrack/extension"
      SHARE_EXT="#{pkgshare}/extension"
      mkdir -p "$TARGET_DIR"
      if [ -d "$SHARE_EXT" ]; then
        cp -R "$SHARE_EXT/"* "$TARGET_DIR/"
      fi
      xattr -cr "$TARGET_DIR" 2>/dev/null || true
      printf "%s" "$TARGET_DIR" | pbcopy 2>/dev/null || true
      echo "==> SoroTrack installed to $TARGET_DIR"
      echo "==> Path copied to clipboard!"
      if [ -d "/Applications/Microsoft Edge.app" ]; then
        open -a "/Applications/Microsoft Edge.app" --args --load-extension="$TARGET_DIR" "edge://extensions"
      elif [ -d "/Applications/Google Chrome.app" ]; then
        open -a "/Applications/Google Chrome.app" --args --load-extension="$TARGET_DIR" "chrome://extensions"
      elif [ -d "/Applications/Brave Browser.app" ]; then
        open -a "/Applications/Brave Browser.app" --args --load-extension="$TARGET_DIR" "brave://extensions"
      fi
    EOS
    chmod 0755, bin/"sorotrack"
  end

  def post_install
    system "#{bin}/sorotrack"
  end
end
`;
    zip.file('sorotrack.rb', clientFormula, { date: new Date(), unixPermissions: 0o100644 });
  }

  return await zip.generateAsync({
    type: 'blob',
    mimeType: 'application/zip',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
    platform: os === 'windows' ? 'DOS' : 'UNIX'
  });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  // Keep object URL alive for 60 seconds so Windows / Chromium download manager
  // has sufficient time to stream and write the zip file to disk completely.
  setTimeout(() => {
    try {
      URL.revokeObjectURL(url);
    } catch {}
  }, 60000);
}
