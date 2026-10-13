import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import JSZip from 'jszip';

export function generateWindowsBatchLauncher(): string {
  return `@echo off
setlocal enabledelayedexpansion
title SoroTrack Extension Installer for Windows
echo ============================================================
echo      SoroTrack Browser Extension - Windows 1-Click Setup
echo ============================================================
echo.

:: Check if PowerShell is available for full automated wizard
where powershell >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo [*] Starting automated installer wizard...
    powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1"
    goto :end
)

:: CMD Fallback if PowerShell is unavailable
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

:: Launch Microsoft Edge if available
if exist "%PROGRAMFILES(X86)%\\Microsoft\\Edge\\Application\\msedge.exe" (
    start "" "%PROGRAMFILES(X86)%\\Microsoft\\Edge\\Application\\msedge.exe" --load-extension="%DEST_DIR%" edge://extensions
    echo [OK] Launched Microsoft Edge with SoroTrack!
) else if exist "%PROGRAMFILES%\\Microsoft\\Edge\\Application\\msedge.exe" (
    start "" "%PROGRAMFILES%\\Microsoft\\Edge\\Application\\msedge.exe" --load-extension="%DEST_DIR%" edge://extensions
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
}

export function generateWindowsPowerShellInstaller(appOrigin: string, authToken: string, latestVersion: string): string {
  return `# SoroTrack Browser Extension Automated Installer for Windows
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

# Ensure destination directory exists
if (-not (Test-Path $targetDir)) {
    New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
}

# If manifest is not present locally, download directly from the server
if (-not (Test-Path "$sourceDir\\manifest.json")) {
    Write-Host "[*] Fetching latest extension files from SoroTrack..." -ForegroundColor Yellow
    $zipTemp = "$env:TEMP\\sorotrack-ext.zip"
    $appUrl = "${appOrigin}"
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

# Copy path to clipboard
try {
    Set-Clipboard -Value $targetDir
    Write-Host "[OK] Path automatically copied to Windows clipboard!" -ForegroundColor Green
} catch {
    try {
        Add-Type -AssemblyName System.Windows.Forms
        [System.Windows.Forms.Clipboard]::SetText($targetDir)
    } catch {}
}

# Scan for installed web browsers
Write-Host "[*] Scanning for installed web browsers on your PC..." -ForegroundColor Cyan

$browsers = @(
    @{
        Name = "Microsoft Edge"
        Icon = "🌊"
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
        Paths = @(
            "\${env:ProgramFiles}\\BraveSoftware\\Brave-Browser\\Application\\brave.exe",
            "\${env:ProgramFiles(x86)}\\BraveSoftware\\Brave-Browser\\Application\\brave.exe",
            "$env:LOCALAPPDATA\\BraveSoftware\\Brave-Browser\\Application\\brave.exe"
        )
        ExtPage = "brave://extensions"
        IsChromium = $true
    },
    @{
        Name = "Vivaldi"
        Icon = "🔴"
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
        Paths = @(
            "\${env:ProgramFiles}\\Mozilla Firefox\\firefox.exe",
            "\${env:ProgramFiles(x86)}\\Mozilla Firefox\\firefox.exe"
        )
        ExtPage = "about:debugging#/runtime/this-firefox"
        IsChromium = $false
    }
)

$foundBrowsers = @()
$desktopDir = [Environment]::GetFolderPath("Desktop")

try {
    $wscript = New-Object -ComObject WScript.Shell
} catch {
    $wscript = $null
}

foreach ($b in $browsers) {
    $foundPath = $null
    foreach ($p in $b.Paths) {
        $expanded = [System.Environment]::ExpandEnvironmentVariables($p)
        if (Test-Path $expanded) {
            $foundPath = $expanded
            break
        }
    }

    if ($foundPath) {
        $foundBrowsers += @{
            Name = $b.Name
            Exe = $foundPath
            Page = $b.ExtPage
            Icon = $b.Icon
            IsChromium = $b.IsChromium
        }
        Write-Host "  $($b.Icon) Found: $($b.Name) ($foundPath)" -ForegroundColor Green

        # Create Desktop Shortcut for easy launch with extension pre-loaded
        if ($wscript -and (Test-Path $desktopDir)) {
            try {
                $shortcutPath = "$desktopDir\\Launch $($b.Name) with SoroTrack.lnk"
                $shortcut = $wscript.CreateShortcut($shortcutPath)
                $shortcut.TargetPath = $foundPath
                if ($b.IsChromium) {
                    $shortcut.Arguments = '--load-extension="' + $targetDir + '"'
                }
                $shortcut.Description = "Launch $($b.Name) with SoroTrack Extension loaded"
                $shortcut.Save()
            } catch {}
        }
    }
}

if ($foundBrowsers.Count -eq 0) {
    Write-Host "  [-] Standard browser binaries not detected in default directories." -ForegroundColor Yellow
} else {
    Write-Host ""
    Write-Host "[OK] Desktop shortcuts created for all detected browsers!" -ForegroundColor Green
}

# Launch the primary detected browser with extension pre-loaded
if ($foundBrowsers.Count -gt 0) {
    $primary = $foundBrowsers[0]
    Write-Host ""
    Write-Host "[*] Launching $($primary.Name) with SoroTrack extension pre-loaded..." -ForegroundColor Cyan
    try {
        if ($primary.IsChromium) {
            Start-Process -FilePath $primary.Exe -ArgumentList ('--load-extension="' + $targetDir + '"'), $primary.Page
        } else {
            Start-Process -FilePath $primary.Exe -ArgumentList $primary.Page
        }
        Write-Host "[OK] $($primary.Name) launched successfully!" -ForegroundColor Green
    } catch {
        Write-Warning "Could not start browser process: $_"
    }
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "                INSTALLATION COMPLETE!                      " -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "Quick Tips:" -ForegroundColor White
Write-Host " 1. In your browser's extension tab, click 'Load unpacked'." -ForegroundColor White
Write-Host " 2. Press Ctrl+V and click Select Folder (the path was copied to clipboard)." -ForegroundColor DarkGray
Write-Host " 3. Visit https://x.com/i/history to start syncing your reading history!" -ForegroundColor White
Write-Host " 4. Launch your browser anytime using the new Desktop shortcut." -ForegroundColor DarkGray
Write-Host ""
Write-Host "Press Enter to exit installer." -ForegroundColor DarkGray
Read-Host
`;
}

export function generateWindowsUninstallBatch(): string {
  return `@echo off
echo [*] Uninstalling SoroTrack Extension from Windows...
set "TARGET_DIR=%LOCALAPPDATA%\\SoroTrack"
if exist "%TARGET_DIR%" (
    rmdir /S /Q "%TARGET_DIR%"
    echo [OK] Removed %TARGET_DIR%
)
del /Q "%USERPROFILE%\\Desktop\\*SoroTrack*.lnk" 2>nul
echo [OK] SoroTrack extension uninstalled successfully.
pause
`;
}

export function generateMacCommandInstaller(appOrigin: string, authToken: string, latestVersion: string): string {
  return `#!/usr/bin/env bash
# SoroTrack Browser Extension Automated Installer for macOS
# Version: v${latestVersion}

set -e
clear

echo "\\033[1;36m============================================================\\033[0m"
echo "\\033[1;36m       SoroTrack Browser Extension - macOS 1-Click Setup    \\033[0m"
echo "\\033[1;36m============================================================\\033[0m"
echo "  Target Version: v${latestVersion}"
echo ""

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TARGET_DIR="$HOME/Library/Application Support/SoroTrack/extension"
mkdir -p "$TARGET_DIR"

# Clear macOS Gatekeeper quarantine attribute if downloaded via browser
xattr -d com.apple.quarantine "$0" 2>/dev/null || true
xattr -cr "$SCRIPT_DIR" 2>/dev/null || true

# Check if local extension folder exists in script bundle
if [ -f "$SCRIPT_DIR/extension/manifest.json" ]; then
    echo "[*] Copying extension files from bundle..."
    cp -R "$SCRIPT_DIR/extension/"* "$TARGET_DIR/"
elif [ -f "$SCRIPT_DIR/manifest.json" ]; then
    echo "[*] Copying extension files from current directory..."
    cp -R "$SCRIPT_DIR/"* "$TARGET_DIR/"
else
    echo "[*] Downloading latest extension bundle from SoroTrack..."
    APP_URL="${appOrigin}"
    TEMP_ZIP="/tmp/sorotrack-ext.zip"
    curl -sSL "$APP_URL/api/extension/download?browser=chrome" -o "$TEMP_ZIP"
    unzip -q -o "$TEMP_ZIP" -d "$TARGET_DIR"
    rm -f "$TEMP_ZIP"
fi

# Ensure target folder has all quarantine attributes stripped
xattr -cr "$TARGET_DIR" 2>/dev/null || true

if [ ! -f "$TARGET_DIR/manifest.json" ]; then
    echo "\\033[1;31m[ERROR] manifest.json could not be found in $TARGET_DIR\\033[0m"
    exit 1
fi

echo "\\033[1;32m[OK] Extension installed to permanent location:\\033[0m"
echo "     $TARGET_DIR"

# Copy path to macOS clipboard
printf "%s" "$TARGET_DIR" | pbcopy
echo "\\033[1;32m[OK] Extension path copied to macOS clipboard (Cmd+V ready)!\\033[0m"
echo ""

echo "\\033[1;36m[*] Scanning for installed web browsers in Applications...\\033[0m"

FOUND_BROWSERS=()

check_mac_browser() {
    local name="$1"
    local app_path="$2"
    local ext_url="$3"
    local is_chromium="$4"

    if [ -d "$app_path" ]; then
        echo "  \\033[1;32m[✔]\\033[0m Found: $name"
        FOUND_BROWSERS+=("$name|$app_path|$ext_url|$is_chromium")
    fi
}

check_mac_browser "Microsoft Edge" "/Applications/Microsoft Edge.app" "edge://extensions" "1"
check_mac_browser "Google Chrome" "/Applications/Google Chrome.app" "chrome://extensions" "1"
check_mac_browser "Brave Browser" "/Applications/Brave Browser.app" "brave://extensions" "1"
check_mac_browser "Arc" "/Applications/Arc.app" "arc://extensions" "1"
check_mac_browser "Firefox" "/Applications/Firefox.app" "about:debugging#/runtime/this-firefox" "0"
check_mac_browser "Vivaldi" "/Applications/Vivaldi.app" "vivaldi://extensions" "1"
check_mac_browser "Opera" "/Applications/Opera.app" "opera://extensions" "1"

# Also check user ~/Applications directory
check_mac_browser "Microsoft Edge (User)" "$HOME/Applications/Microsoft Edge.app" "edge://extensions" "1"
check_mac_browser "Google Chrome (User)" "$HOME/Applications/Google Chrome.app" "chrome://extensions" "1"
check_mac_browser "Brave Browser (User)" "$HOME/Applications/Brave Browser.app" "brave://extensions" "1"

echo ""

# Create desktop launcher on macOS Desktop
DESKTOP_DIR="$HOME/Desktop"
if [ -d "$DESKTOP_DIR" ]; then
    LAUNCHER="$DESKTOP_DIR/Launch Browser with SoroTrack.command"
    cat << 'EOF' > "$LAUNCHER"
#!/usr/bin/env bash
TARGET_DIR="$HOME/Library/Application Support/SoroTrack/extension"
if [ -d "/Applications/Microsoft Edge.app" ]; then
    open -a "/Applications/Microsoft Edge.app" --args --load-extension="$TARGET_DIR"
elif [ -d "/Applications/Google Chrome.app" ]; then
    open -a "/Applications/Google Chrome.app" --args --load-extension="$TARGET_DIR"
elif [ -d "/Applications/Brave Browser.app" ]; then
    open -a "/Applications/Brave Browser.app" --args --load-extension="$TARGET_DIR"
elif [ -d "/Applications/Arc.app" ]; then
    open -a "/Applications/Arc.app" --args --load-extension="$TARGET_DIR"
fi
EOF
    chmod +x "$LAUNCHER"
    echo "\\033[1;32m[OK] Created desktop launcher: 'Launch Browser with SoroTrack.command'\\033[0m"
fi

# Launch the primary detected browser
if [ \${#FOUND_BROWSERS[@]} -gt 0 ]; then
    IFS='|' read -r FIRST_NAME FIRST_APP FIRST_URL FIRST_CHROMIUM <<< "\${FOUND_BROWSERS[0]}"
    echo "\\033[1;36m[*] Launching $FIRST_NAME with SoroTrack extension pre-loaded...\\033[0m"
    if [ "$FIRST_CHROMIUM" = "1" ]; then
        open -a "$FIRST_APP" --args --load-extension="$TARGET_DIR" "$FIRST_URL" || true
    else
        open -a "$FIRST_APP" "$FIRST_URL" || true
    fi
    echo "\\033[1;32m[OK] $FIRST_NAME opened!\\033[0m"
fi

# Native macOS notification
osascript -e 'display notification "SoroTrack Extension installed for all detected browsers!" with title "SoroTrack Setup" subtitle "Ready to use"' 2>/dev/null || true

echo ""
echo "\\033[1;36m============================================================\\033[0m"
echo "\\033[1;32m                 INSTALLATION COMPLETE!                     \\033[0m"
echo "\\033[1;36m============================================================\\033[0m"
echo "Quick Tips:"
echo " 1. Turn on 'Developer mode' in your browser extensions tab."
echo " 2. Click 'Load unpacked' and press Cmd+V (path is already in clipboard!)."
echo " 3. Visit https://x.com/i/history to start syncing reading history."
echo " 4. Launch anytime using 'Launch Browser with SoroTrack.command' on Desktop."
echo ""
echo "Press any key to close this terminal."
read -n 1 -s
`;
}

export function generateMacUninstallCommand(): string {
  return `#!/usr/bin/env bash
echo "[*] Uninstalling SoroTrack Extension from macOS..."
rm -rf "$HOME/Library/Application Support/SoroTrack"
rm -f "$HOME/Desktop/Launch Browser with SoroTrack.command"
echo "[OK] SoroTrack extension removed successfully."
read -n 1 -s -p "Press any key to exit..."
`;
}

export function generateWindowsReadme(latestVersion: string): string {
  return `============================================================
 SoroTrack Browser Extension - Windows 1-Click Setup v${latestVersion}
============================================================

INSTALLATION:
1. Double-click "Install-SoroTrack.bat".
2. The installer will:
   - Copy SoroTrack into your permanent LocalAppData directory.
   - Detect all installed browsers (Microsoft Edge, Google Chrome, Brave, Arc, Firefox, Vivaldi, Opera).
   - Copy the extension directory to your Windows clipboard.
   - Launch your browser with the SoroTrack extension pre-loaded!
   - Create a desktop shortcut for future 1-click launching.

MANUAL STEPS (if your browser asks to load unpacked):
1. In the browser extension tab (edge://extensions or chrome://extensions), enable "Developer mode".
2. Click "Load unpacked".
3. Press Ctrl+V in the folder selection dialog (the path is already on your clipboard!) and press Enter.

UNINSTALLATION:
- Double-click "Uninstall-SoroTrack.bat".
`;
}

export function generateMacReadme(latestVersion: string, appOrigin: string = ''): string {
  const originStr = appOrigin || 'https://ais-dev-f2e37stwdlnm6j6goghk7i-17336764235.asia-east1.run.app';
  return `============================================================
 SoroTrack Browser Extension - macOS 1-Click Setup v${latestVersion}
============================================================

INSTALLATION:
1. Double-click "Install-SoroTrack.command".
2. The installer will:
   - Copy SoroTrack into ~/Library/Application Support/SoroTrack/extension.
   - Detect all installed browsers (Edge, Chrome, Brave, Arc, Firefox, Vivaldi, Opera).
   - Copy the extension folder path to your macOS clipboard.
   - Launch your browser with the SoroTrack extension pre-loaded!
   - Create a desktop shortcut "Launch Browser with SoroTrack.command".

============================================================
WHY DID APPLE SAY: "Apple could not verify the downloadable file"?
============================================================
When you download files via web browsers on macOS, Apple Gatekeeper attaches
the "com.apple.quarantine" extended attribute. Because individual open-source
scripts are not notarized through Apple's $99/year developer program, macOS
prompts you with this security warning.

YOU HAVE 4 EASY WAYS TO RUN OR INSTALL IT:

METHOD 1: Right-Click "Open" (Fastest GUI Fix)
-----------------------------------------------
1. In Finder, Right-Click (or Control-click) "Install-SoroTrack.command".
2. Select "Open" from the context menu.
3. Click "Open" on the confirmation prompt.
macOS saves a permanent exception for this file.

METHOD 2: Terminal Unquarantine (1 Command)
--------------------------------------------
Open Terminal and run:
  xattr -cr ~/Downloads/sorotrack-installer-mac*
  chmod +x ~/Downloads/sorotrack-installer-mac*/Install-SoroTrack.command
Then double-click "Install-SoroTrack.command" normally.

METHOD 3: Install via Homebrew (brew) - Gatekeeper Exempt!
---------------------------------------------------------
Homebrew packages bypass browser quarantine completely! Run in Terminal:
  brew install --formula ${originStr}/api/extension/brew/sorotrack.rb

Once installed via brew, you have the "sorotrack" command available anywhere:
  sorotrack install    # auto-detects and configures all browsers
  sorotrack launch     # launches your browser with extension pre-loaded
  sorotrack path       # copies extension directory to clipboard
  sorotrack update     # updates extension to latest version
  sorotrack status     # checks installed browsers

Or install from the local file in this folder:
  brew install --formula ./sorotrack.rb

METHOD 4: Run via Terminal curl (No Browser Quarantine)
-------------------------------------------------------
Because curl runs directly in your terminal, macOS does not attach quarantine:
  curl -fsSL "${originStr}/api/extension/installer/script?os=mac" | bash

============================================================
HOW TO ADD TO YOUR OWN GITHUB HOMEBREW TAP (brew tap):
============================================================
1. Create a public GitHub repository named:
   homebrew-sorotrack (or homebrew-tap)
2. Create a folder named "Formula" and place "sorotrack.rb" inside it:
   Formula/sorotrack.rb
3. Commit and push to GitHub.
4. Users can now install with:
   brew tap <your-username>/sorotrack
   brew install sorotrack

MANUAL STEPS (if your browser asks to load unpacked):
1. In the browser extension tab (edge://extensions or chrome://extensions), enable "Developer mode".
2. Click "Load unpacked".
3. Press Cmd+V in the file picker (the path is already on your clipboard!) and press Enter.

UNINSTALLATION:
- Double-click "Uninstall-SoroTrack.command" or run "sorotrack uninstall".
`;
}

export function generateHomebrewFormula(appOrigin: string, latestVersion: string, sha256Hex?: string): string {
  const shaLine = sha256Hex ? `  sha256 "${sha256Hex}"\n` : '';
  return `class Sorotrack < Formula
  desc "SoroTrack browser extension & multi-browser history sync CLI"
  homepage "${appOrigin}"
  url "${appOrigin}/api/extension/installer?os=mac"
  version "${latestVersion}"
${shaLine}
  def install
    # Install extension files into pkgshare
    if (buildpath/"extension").exist?
      (pkgshare/"extension").install Dir["#{buildpath}/extension/*"]
    else
      (pkgshare/"extension").install Dir["#{buildpath}/*"]
    end

    # Install the 'sorotrack' CLI executable
    (bin/"sorotrack").write <<~EOS
      #!/usr/bin/env bash
      set -e

      APP_ORIGIN="${appOrigin}"
      VERSION="${latestVersion}"
      TARGET_DIR="$HOME/Library/Application Support/SoroTrack/extension"
      SHARE_EXT="#{pkgshare}/extension"

      show_help() {
        echo "============================================================"
        echo "  SoroTrack CLI (Homebrew) v$VERSION"
        echo "============================================================"
        echo ""
        echo "Usage: sorotrack [command]"
        echo ""
        echo "Commands:"
        echo "  install     Install & setup extension for all detected browsers"
        echo "  launch      Launch detected browser with extension pre-loaded"
        echo "  path        Print and copy extension storage path to clipboard"
        echo "  status      Check installed browsers and extension location"
        echo "  update      Download and sync latest extension files from server"
        echo "  uninstall   Remove SoroTrack extension files & desktop shortcut"
        echo "  help        Show this help message"
        echo ""
      }

      cmd_install() {
        echo "==> Setting up SoroTrack extension for macOS..."
        mkdir -p "$TARGET_DIR"

        if [ -d "$SHARE_EXT" ]; then
          cp -R "$SHARE_EXT/"* "$TARGET_DIR/"
        fi

        # Remove any quarantine attributes
        xattr -cr "$TARGET_DIR" 2>/dev/null || true

        printf "%s" "$TARGET_DIR" | pbcopy 2>/dev/null || true
        echo "==> [OK] Extension files installed to: $TARGET_DIR"
        echo "==> [OK] Path copied to macOS clipboard (Cmd+V ready)!"

        echo "==> Scanning installed browsers in /Applications..."
        FOUND_BROWSERS=()
        for browser in \\
          "/Applications/Microsoft Edge.app|edge://extensions|1|Edge" \\
          "/Applications/Google Chrome.app|chrome://extensions|1|Chrome" \\
          "/Applications/Brave Browser.app|brave://extensions|1|Brave" \\
          "/Applications/Arc.app|arc://extensions|1|Arc" \\
          "/Applications/Firefox.app|about:debugging#/runtime/this-firefox|0|Firefox" \\
          "/Applications/Vivaldi.app|vivaldi://extensions|1|Vivaldi" \\
          "/Applications/Opera.app|opera://extensions|1|Opera"
        do
          IFS='|' read -r app_path ext_url is_chromium bname <<< "$browser"
          if [ -d "$app_path" ]; then
            echo "    [✔] Found $bname"
            FOUND_BROWSERS+=("$app_path|$ext_url|$is_chromium")
          fi
        done

        # Create Desktop launcher
        DESKTOP="$HOME/Desktop"
        if [ -d "$DESKTOP" ]; then
          LAUNCHER="$DESKTOP/Launch Browser with SoroTrack.command"
          cat << 'LAUNCHER_EOF' > "$LAUNCHER"
#!/usr/bin/env bash
TARGET_DIR="$HOME/Library/Application Support/SoroTrack/extension"
if [ -d "/Applications/Microsoft Edge.app" ]; then
  open -a "/Applications/Microsoft Edge.app" --args --load-extension="$TARGET_DIR"
elif [ -d "/Applications/Google Chrome.app" ]; then
  open -a "/Applications/Google Chrome.app" --args --load-extension="$TARGET_DIR"
elif [ -d "/Applications/Brave Browser.app" ]; then
  open -a "/Applications/Brave Browser.app" --args --load-extension="$TARGET_DIR"
elif [ -d "/Applications/Arc.app" ]; then
  open -a "/Applications/Arc.app" --args --load-extension="$TARGET_DIR"
fi
LAUNCHER_EOF
          chmod +x "$LAUNCHER"
          echo "==> Created desktop shortcut: Launch Browser with SoroTrack.command"
        fi

        echo ""
        echo "==> Opening browser with SoroTrack loaded..."
        if [ -d "/Applications/Microsoft Edge.app" ]; then
          open -a "/Applications/Microsoft Edge.app" --args --load-extension="$TARGET_DIR" "edge://extensions" || true
        elif [ -d "/Applications/Google Chrome.app" ]; then
          open -a "/Applications/Google Chrome.app" --args --load-extension="$TARGET_DIR" "chrome://extensions" || true
        elif [ -d "/Applications/Brave Browser.app" ]; then
          open -a "/Applications/Brave Browser.app" --args --load-extension="$TARGET_DIR" "brave://extensions" || true
        elif [ -d "/Applications/Arc.app" ]; then
          open -a "/Applications/Arc.app" --args --load-extension="$TARGET_DIR" "arc://extensions" || true
        fi

        osascript -e 'display notification "SoroTrack Extension installed via Homebrew!" with title "SoroTrack" subtitle "Ready to sync"' 2>/dev/null || true
        echo "==> SoroTrack installation complete! Visit https://x.com/i/history to start syncing."
      }

      cmd_launch() {
        cmd_install
      }

      cmd_path() {
        echo "$TARGET_DIR"
        printf "%s" "$TARGET_DIR" | pbcopy 2>/dev/null || true
        echo "(Copied to clipboard)"
      }

      cmd_status() {
        echo "SoroTrack Status:"
        echo "  Version: $VERSION"
        echo "  Extension Dir: $TARGET_DIR"
        if [ -f "$TARGET_DIR/manifest.json" ]; then
          echo "  Extension files: Present [OK]"
        else
          echo "  Extension files: Not installed (run 'sorotrack install')"
        fi
      }

      cmd_update() {
        echo "==> Fetching latest extension from SoroTrack server ($APP_ORIGIN)..."
        TEMP_ZIP="/tmp/sorotrack-update.zip"
        curl -fsSL "$APP_ORIGIN/api/extension/download?browser=chrome" -o "$TEMP_ZIP"
        mkdir -p "$TARGET_DIR"
        unzip -q -o "$TEMP_ZIP" -d "$TARGET_DIR"
        rm -f "$TEMP_ZIP"
        echo "==> [OK] Extension updated to latest version!"
      }

      cmd_uninstall() {
        echo "==> Removing SoroTrack extension files..."
        rm -rf "$TARGET_DIR"
        rm -f "$HOME/Desktop/Launch Browser with SoroTrack.command"
        echo "==> [OK] SoroTrack uninstalled."
      }

      case "\${1:-install}" in
        install) cmd_install ;;
        launch)  cmd_launch ;;
        path)    cmd_path ;;
        status)  cmd_status ;;
        update)  cmd_update ;;
        uninstall) cmd_uninstall ;;
        help|--help|-h) show_help ;;
        version|--version|-v) echo "v$VERSION" ;;
        *) cmd_install ;;
      esac
    EOS

    chmod 0755, bin/"sorotrack"
  end

  def post_install
    system "#{bin}/sorotrack", "install"
  end

  test do
    assert_predicate bin/"sorotrack", :exist?
    assert_match "v#{version}", shell_output("#{bin}/sorotrack version")
  end
end
`;
}

export function generateBrewInstallScript(appOrigin: string, latestVersion: string): string {
  return `#!/usr/bin/env bash
# SoroTrack Automated Homebrew Formula Installer
set -e

echo "==> SoroTrack Homebrew Installer v${latestVersion}"

if ! command -v brew >/dev/null 2>&1; then
  echo "[!] Homebrew (brew) is not detected on your system."
  echo "    Falling back to direct Terminal installer..."
  curl -fsSL "${appOrigin}/api/extension/installer/script?os=mac" | bash
  exit 0
fi

echo "==> Installing SoroTrack via Homebrew formula..."
brew install --formula "${appOrigin}/api/extension/brew/sorotrack.rb"
echo "==> [OK] Installed! You can run 'sorotrack' anytime in your terminal."
`;
}


/**
 * Build the full OS-specific installer zip package
 */
export async function buildInstallerZip(
  targetOS: 'windows' | 'mac',
  appOrigin: string,
  authToken: string,
  latestVersion: string,
  extensionDir: string
): Promise<Buffer> {
  const zip = new JSZip();

  // Read all extension files
  const fileNames = [
    'manifest.json',
    'content.js',
    'content.css',
    'dashboard-bridge.js',
    'background.js',
    'popup.html',
    'popup.js',
    'options.html',
    'options.js',
    'viewer.html',
    'viewer.js',
    'viewer.css',
    'README.md'
  ];

  for (const name of fileNames) {
    const filePath = path.join(extensionDir, name);
    if (!fs.existsSync(filePath)) continue;

    let content = fs.readFileSync(filePath, 'utf-8');

    // Inject app origin into extension configs
    if (appOrigin && !appOrigin.includes('localhost:3000')) {
      content = content.replace(/http:\/\/localhost:3000/g, appOrigin);
    }

    // Inject authentication token
    if (authToken) {
      if (name === 'content.js' || name === 'background.js') {
        content = content.replace(/authToken:\s*['"][^'"]*['"]/g, `authToken: '${authToken}'`);
      }
      if (name === 'popup.html') {
        content = content.replace(
          /id="auth-token"\s*placeholder="sh_live_\.\.\."/g,
          `id="auth-token" value="${authToken}" placeholder="sh_live_..."`
        );
      }
      if (name === 'options.html') {
        content = content.replace(
          /id="authToken"\s*placeholder="sh_live_\.\.\."/g,
          `id="authToken" value="${authToken}" placeholder="sh_live_..."`
        );
      }
      if (name === 'options.js' || name === 'popup.js') {
        content = content.replace(/stored\?\.authToken\s*\|\|\s*''/g, `stored?.authToken || '${authToken}'`);
      }
    }

    // Configure manifest for universal Chromium + Firefox compatibility
    if (name === 'manifest.json') {
      try {
        const manifest = JSON.parse(content);
        manifest.background = { service_worker: 'background.js' };
        if (appOrigin) {
          if (!manifest.host_permissions) manifest.host_permissions = [];
          const perm = `${appOrigin}/*`;
          if (!manifest.host_permissions.includes(perm)) manifest.host_permissions.push(perm);
        }
        content = JSON.stringify(manifest, null, 2);
      } catch {}
    }

    // Put extension files into extension/ subfolder in zip
    zip.file(`extension/${name}`, content, {
      date: new Date(),
      dosPermissions: 0x20
    });
  }

  // Add binary icons
  const icons = ['icon16.png', 'icon48.png', 'icon128.png'];
  for (const iconName of icons) {
    const iconPath = path.join(extensionDir, iconName);
    if (fs.existsSync(iconPath)) {
      zip.file(`extension/${iconName}`, fs.readFileSync(iconPath), {
        date: new Date(),
        dosPermissions: 0x20
      });
    }
  }

  if (targetOS === 'windows') {
    zip.file('Install-SoroTrack.bat', generateWindowsBatchLauncher(), {
      date: new Date(),
      dosPermissions: 0x20
    });
    zip.file('install.ps1', generateWindowsPowerShellInstaller(appOrigin, authToken, latestVersion), {
      date: new Date(),
      dosPermissions: 0x20
    });
    zip.file('Uninstall-SoroTrack.bat', generateWindowsUninstallBatch(), {
      date: new Date(),
      dosPermissions: 0x20
    });
    zip.file('README_WINDOWS.txt', generateWindowsReadme(latestVersion), {
      date: new Date(),
      dosPermissions: 0x20
    });
  } else {
    // Mac / macOS
    zip.file('Install-SoroTrack.command', generateMacCommandInstaller(appOrigin, authToken, latestVersion), {
      date: new Date(),
      unixPermissions: '755'
    });
    zip.file('Uninstall-SoroTrack.command', generateMacUninstallCommand(), {
      date: new Date(),
      unixPermissions: '755'
    });
    zip.file('README_MAC.txt', generateMacReadme(latestVersion, appOrigin), {
      date: new Date(),
      unixPermissions: '644'
    });
    // Include Homebrew Formula file inside the bundle
    zip.file('sorotrack.rb', generateHomebrewFormula(appOrigin, latestVersion), {
      date: new Date(),
      unixPermissions: '644'
    });
  }

  return await zip.generateAsync({
    type: 'nodebuffer',
    mimeType: 'application/zip',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
    platform: targetOS === 'windows' ? 'DOS' : 'UNIX'
  });
}

export async function getMacInstallerSha256(
  appOrigin: string,
  authToken: string,
  latestVersion: string,
  extensionDir: string
): Promise<{ buffer: Buffer; sha256: string }> {
  const buffer = await buildInstallerZip('mac', appOrigin, authToken, latestVersion, extensionDir);
  const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
  return { buffer, sha256 };
}
