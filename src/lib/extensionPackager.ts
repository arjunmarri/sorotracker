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
      }

      // Ensure live app origin is explicitly allowed in host permissions
      if (originToInject) {
        if (!manifest.host_permissions) {
          manifest.host_permissions = [];
        }
        const permPattern = `${originToInject}/*`;
        if (!manifest.host_permissions.includes(permPattern)) {
          manifest.host_permissions.push(permPattern);
        }
      }

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

    zip.file(`extension/${filename}`, modified, {
      date: new Date(),
      dosPermissions: 0x20
    });
  }

  // Add binary icons into extension/ directory
  for (const [filename, base64Content] of Object.entries(binaryFiles)) {
    zip.file(`extension/${filename}`, base64Content, {
      base64: true,
      date: new Date(),
      dosPermissions: 0x20
    });
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

if ($foundBrowsers.Count -gt 0) {
    Write-Host ""
    Write-Host "[OK] Desktop shortcuts created for all detected browsers!" -ForegroundColor Green
    $primary = $foundBrowsers[0]
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
Write-Host ""
Write-Host "Press Enter to exit installer." -ForegroundColor DarkGray
Read-Host
`;

    zip.file('Install-SoroTrack.bat', batScript, { date: new Date(), dosPermissions: 0x20 });
    zip.file('install.ps1', psScript, { date: new Date(), dosPermissions: 0x20 });
    zip.file('Uninstall-SoroTrack.bat', `@echo off\nrmdir /S /Q "%LOCALAPPDATA%\\SoroTrack" 2>nul\necho SoroTrack uninstalled.\npause\n`, { date: new Date(), dosPermissions: 0x20 });
    zip.file('README_WINDOWS.txt', `SoroTrack Windows 1-Click Setup v${latestVersion}\n\nDouble-click "Install-SoroTrack.bat" to automatically detect and install on your browsers.\n`, { date: new Date(), dosPermissions: 0x20 });
  } else {
    // Mac / macOS
    const macCommand = `#!/usr/bin/env bash
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

if [ ! -f "$TARGET_DIR/manifest.json" ]; then
    echo "\\033[1;31m[ERROR] manifest.json could not be found in $TARGET_DIR\\033[0m"
    exit 1
fi

echo "\\033[1;32m[OK] Extension installed to permanent location:\\033[0m"
echo "     $TARGET_DIR"

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

echo ""

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

osascript -e 'display notification "SoroTrack Extension installed for all detected browsers!" with title "SoroTrack Setup" subtitle "Ready to use"' 2>/dev/null || true

echo ""
echo "\\033[1;36m============================================================\\033[0m"
echo "\\033[1;32m                 INSTALLATION COMPLETE!                     \\033[0m"
echo "\\033[1;36m============================================================\\033[0m"
echo "Quick Tips:"
echo " 1. Turn on 'Developer mode' in your browser extensions tab."
echo " 2. Click 'Load unpacked' and press Cmd+V (path is already in clipboard!)."
echo " 3. Visit https://x.com/i/history to start syncing reading history."
echo ""
echo "Press any key to close this terminal."
read -n 1 -s
`;

    zip.file('Install-SoroTrack.command', macCommand, { date: new Date(), unixPermissions: '755' });
    zip.file('Uninstall-SoroTrack.command', `#!/usr/bin/env bash\nrm -rf "$HOME/Library/Application Support/SoroTrack"\nrm -f "$HOME/Desktop/Launch Browser with SoroTrack.command"\necho "SoroTrack uninstalled."\n`, { date: new Date(), unixPermissions: '755' });
    
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
    zip.file('README_MAC.txt', macReadme, { date: new Date(), unixPermissions: '644' });

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
    zip.file('sorotrack.rb', clientFormula, { date: new Date(), unixPermissions: '644' });
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
