import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import os from 'os';
import { execSync } from 'child_process';
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
    # Desktop Shortcut
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

    # Launch process
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
# SoroTrack Personal AI Assistant - Automated Installer for Apple Mac Studio & macOS
# Version: v${latestVersion}

set -e
clear

echo "\\033[1;36m============================================================\\033[0m"
echo "\\033[1;36m   SoroTrack Personal AI Assistant - Mac Studio & macOS    \\033[0m"
echo "\\033[1;36m============================================================\\033[0m"

# Hardware & System Detection (Optimized for Apple Mac Studio M1/M2/M3/M4 Max/Ultra)
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

# Clear macOS Gatekeeper quarantine attribute if downloaded via browser
xattr -d com.apple.quarantine "$0" 2>/dev/null || true
xattr -cr "$SCRIPT_DIR" 2>/dev/null || true

# Copy extension bundle
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

xattr -cr "$TARGET_DIR" 2>/dev/null || true

if [ ! -f "$TARGET_DIR/manifest.json" ]; then
    echo "\\033[1;31m[ERROR] manifest.json could not be found in $TARGET_DIR\\033[0m"
    exit 1
fi

echo "\\033[1;32m[OK] Extension installed to permanent folder:\\033[0m"
echo "     $TARGET_DIR"

# Copy path to macOS clipboard
printf "%s" "$TARGET_DIR" | pbcopy
echo "\\033[1;32m[OK] Extension path copied to macOS clipboard (Cmd+V ready)!\\033[0m"
echo ""

# Scan for installed web browsers in Applications
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

# Also check user ~/Applications directory
check_mac_browser "Google Chrome (User)" "$HOME/Applications/Google Chrome.app" "chrome://extensions" "1" "$HOME/Library/Application Support/Google/Chrome/External Extensions"
check_mac_browser "Microsoft Edge (User)" "$HOME/Applications/Microsoft Edge.app" "edge://extensions" "1" "$HOME/Library/Application Support/Microsoft Edge/External Extensions"
check_mac_browser "Brave Browser (User)" "$HOME/Applications/Brave Browser.app" "brave://extensions" "1" "$HOME/Library/Application Support/BraveSoftware/Brave-Browser/External Extensions"

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

# Configure each selected browser
DESKTOP_DIR="$HOME/Desktop"
mkdir -p "$DESKTOP_DIR"

for idx in "\${SELECTED_INDICES[@]}"; do
    BNAME="\${FOUND_NAMES[$idx]}"
    BAPP="\${FOUND_APPS[$idx]}"
    BURL="\${FOUND_URLS[$idx]}"
    BCHROMIUM="\${FOUND_CHROMIUM[$idx]}"
    BEXTDIR="\${FOUND_EXT_DIRS[$idx]}"

    # External extensions setup for Chromium browsers
    if [ "$BCHROMIUM" = "1" ] && [ -n "$BEXTDIR" ]; then
        mkdir -p "$BEXTDIR"
        EXT_JSON="$BEXTDIR/sorotrack.json"
        cat << EOF > "$EXT_JSON"
{
  "external_path": "$TARGET_DIR"
}
EOF
    fi

    # Create convenient launcher script on Desktop
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

# Create master launcher for all confirmed browsers
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

# Check for Local LLM on Apple Mac Studio (Ollama / LM Studio)
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

# Launch confirmed browsers
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

# Native macOS desktop notification
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

WHAT THIS INSTALLER DOES:
1. Detects all web browsers installed on your Windows PC:
   - Microsoft Edge
   - Google Chrome
   - Brave Browser
   - Arc Browser
   - Mozilla Firefox
   - Opera & Opera GX
   - Vivaldi
2. Prompts you to confirm which browsers you want to configure.
3. Automatically identifies whether any of your browsers are currently
   running in the background (e.g. Edge Startup Boost).
4. Copies extension files into your permanent LocalAppData folder:
   %LOCALAPPDATA%\\SoroTrack\\extension
5. Copies the extension directory to your Windows clipboard (Ctrl+V ready).
6. Creates a dedicated Desktop launcher shortcut for each selected browser.
7. Launches your chosen browsers directly to their Extension Management page!

============================================================
WHY WAS THE EXTENSION NOT VISIBLE PREVIOUSLY?
============================================================
Modern Chromium browsers (Edge, Chrome, Brave) have two strict rules:
A) Running in Background: Windows enables "Startup boost" / "Background apps"
   by default for Edge and Chrome. When a browser process is already running,
   passing --load-extension is SILENTLY IGNORED by Chromium.
   -> The installer now detects running browsers and asks for your confirmation
      to close background processes before launching fresh!
B) Developer Mode: Modern browsers require a 1-time approval for unpacked extensions:
   1. On the extension tab that opens (edge://extensions or chrome://extensions),
      turn ON the "Developer mode" toggle.
   2. Click the "Load unpacked" button.
   3. Press Ctrl+V in the folder dialog (path is already in your clipboard!)
      and click "Select Folder".
   That's it! SoroTrack is permanently active.

DISTRIBUTION & STANDALONE BINARIES:
- Double-click "Install-SoroTrack.bat" or run "install.ps1".
- To build a native standalone SoroTrackInstaller.exe:
  Run "scripts\\build-windows-exe.bat" locally on any Windows 10/11 machine.

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
        manifest.version = latestVersion;
        manifest.background = { service_worker: 'background.js' };
        if (Array.isArray(manifest.content_scripts) && manifest.content_scripts[0]) {
          manifest.content_scripts[0].matches = ['<all_urls>'];
        }
        if (!manifest.host_permissions) manifest.host_permissions = [];
        const needed = ['*://*/*', 'http://*/*', 'https://*/*', 'http://localhost:*/*', 'http://127.0.0.1:*/*'];
        if (appOrigin) needed.push(`${appOrigin}/*`);
        needed.forEach(p => {
          if (!manifest.host_permissions.includes(p)) manifest.host_permissions.push(p);
        });
        content = JSON.stringify(manifest, null, 2);
      } catch {}
    }

    // Put extension files into extension/ subfolder in zip
    if (targetOS === 'mac') {
      zip.file(`extension/${name}`, content, {
        date: new Date(),
        unixPermissions: 0o100644
      });
    } else {
      zip.file(`extension/${name}`, content, {
        date: new Date(),
        dosPermissions: 0x20
      });
    }
  }

  // Add binary icons
  const icons = ['icon16.png', 'icon48.png', 'icon128.png'];
  for (const iconName of icons) {
    const iconPath = path.join(extensionDir, iconName);
    if (fs.existsSync(iconPath)) {
      if (targetOS === 'mac') {
        zip.file(`extension/${iconName}`, fs.readFileSync(iconPath), {
          date: new Date(),
          unixPermissions: 0o100644
        });
      } else {
        zip.file(`extension/${iconName}`, fs.readFileSync(iconPath), {
          date: new Date(),
          dosPermissions: 0x20
        });
      }
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
    // Mac / macOS - use exact POSIX octal file modes (0o100755 for executable scripts, 0o100644 for regular files)
    // to ensure Apple's native Archive Utility on macOS unpacks without "unsupported format" errors
    zip.file('Install-SoroTrack.command', generateMacCommandInstaller(appOrigin, authToken, latestVersion), {
      date: new Date(),
      unixPermissions: 0o100755
    });
    zip.file('Uninstall-SoroTrack.command', generateMacUninstallCommand(), {
      date: new Date(),
      unixPermissions: 0o100755
    });
    zip.file('README_MAC.txt', generateMacReadme(latestVersion, appOrigin), {
      date: new Date(),
      unixPermissions: 0o100644
    });
    // Include Homebrew Formula file inside the bundle
    zip.file('sorotrack.rb', generateHomebrewFormula(appOrigin, latestVersion), {
      date: new Date(),
      unixPermissions: 0o100644
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

/**
 * Builds a native macOS .tar.gz archive which strictly preserves POSIX +x execution permissions
 * and unpacks cleanly in macOS Archive Utility without quarantine/unsupported format conflicts.
 */
export async function buildInstallerTarGz(
  appOrigin: string,
  authToken: string,
  latestVersion: string,
  extensionDir: string
): Promise<Buffer> {
  const osTmp = os.tmpdir();
  const bundleDir = fs.mkdtempSync(path.join(osTmp, 'sorotrack-mac-tar-'));
  const extDestDir = path.join(bundleDir, 'extension');
  fs.mkdirSync(extDestDir, { recursive: true });

  // Extension files
  const fileNames = [
    'manifest.json', 'content.js', 'content.css', 'dashboard-bridge.js',
    'background.js', 'popup.html', 'popup.js', 'options.html', 'options.js',
    'viewer.html', 'viewer.js', 'viewer.css', 'README.md'
  ];

  for (const name of fileNames) {
    const filePath = path.join(extensionDir, name);
    if (!fs.existsSync(filePath)) continue;
    let content = fs.readFileSync(filePath, 'utf-8');

    if (appOrigin && !appOrigin.includes('localhost:3000')) {
      content = content.replace(/http:\/\/localhost:3000/g, appOrigin);
    }
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
    if (name === 'manifest.json') {
      try {
        const manifest = JSON.parse(content);
        manifest.version = latestVersion;
        manifest.background = { service_worker: 'background.js' };
        if (Array.isArray(manifest.content_scripts) && manifest.content_scripts[0]) {
          manifest.content_scripts[0].matches = ['<all_urls>'];
        }
        if (!manifest.host_permissions) manifest.host_permissions = [];
        const needed = ['*://*/*', 'http://*/*', 'https://*/*', 'http://localhost:*/*', 'http://127.0.0.1:*/*'];
        if (appOrigin) needed.push(`${appOrigin}/*`);
        needed.forEach(p => {
          if (!manifest.host_permissions.includes(p)) manifest.host_permissions.push(p);
        });
        content = JSON.stringify(manifest, null, 2);
      } catch {}
    }

    fs.writeFileSync(path.join(extDestDir, name), content, { mode: 0o644 });
  }

  // Icons
  const icons = ['icon16.png', 'icon48.png', 'icon128.png'];
  for (const icon of icons) {
    const src = path.join(extensionDir, icon);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(extDestDir, icon));
      fs.chmodSync(path.join(extDestDir, icon), 0o644);
    }
  }

  // Scripts with 0755 executable permissions
  fs.writeFileSync(
    path.join(bundleDir, 'Install-SoroTrack.command'),
    generateMacCommandInstaller(appOrigin, authToken, latestVersion),
    { mode: 0o755 }
  );
  fs.writeFileSync(
    path.join(bundleDir, 'Uninstall-SoroTrack.command'),
    generateMacUninstallCommand(),
    { mode: 0o755 }
  );
  fs.writeFileSync(
    path.join(bundleDir, 'README_MAC.txt'),
    generateMacReadme(latestVersion, appOrigin),
    { mode: 0o644 }
  );
  fs.writeFileSync(
    path.join(bundleDir, 'sorotrack.rb'),
    generateHomebrewFormula(appOrigin, latestVersion),
    { mode: 0o644 }
  );

  const outTarPath = path.join(osTmp, `sorotrack-mac-${Date.now()}.tar.gz`);
  execSync(`tar -czf "${outTarPath}" *`, { cwd: bundleDir });
  const buffer = fs.readFileSync(outTarPath);

  // Clean up temporary files
  try {
    fs.rmSync(bundleDir, { recursive: true, force: true });
    fs.unlinkSync(outTarPath);
  } catch {}

  return buffer;
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
