import { ExtensionVersionInfo } from '../types';

const STORAGE_KEY = 'soro_installed_extension_version';
const DISMISSED_VERSION_KEY = 'soro_dismissed_upgrade_version';

/**
 * Compares two semantic version strings (e.g. "1.0.0" and "1.1.0")
 * Returns:
 *  -1 if v1 < v2 (outdated)
 *   0 if v1 === v2 (current)
 *   1 if v1 > v2 (newer)
 */
export function compareVersions(v1: string, v2: string): number {
  if (!v1 && !v2) return 0;
  if (!v1) return -1;
  if (!v2) return 1;

  const parseParts = (v: string) => 
    v.replace(/^[^\d]*/, '')
     .split('.')
     .map(p => parseInt(p, 10) || 0);

  const p1 = parseParts(v1);
  const p2 = parseParts(v2);
  const len = Math.max(p1.length, p2.length);

  for (let i = 0; i < len; i++) {
    const num1 = p1[i] || 0;
    const num2 = p2[i] || 0;
    if (num1 < num2) return -1;
    if (num1 > num2) return 1;
  }
  return 0;
}

export function isVersionOutdated(installed: string | null | undefined, latest: string): boolean {
  if (!installed || !latest) return false;
  return compareVersions(installed, latest) < 0;
}

/**
 * Proactively queries the browser environment to detect the installed SoroTrack extension
 * via:
 * 1. Synchronous DOM attribute stamp (set by dashboard-bridge.js)
 * 2. Asynchronous window postMessage handshake
 * 3. Local browser cache fallback
 */
export async function detectBrowserInstalledVersion(): Promise<{
  version: string | null;
  source: 'dom-bridge' | 'message-ping' | 'local-storage' | null;
}> {
  if (typeof window === 'undefined') {
    return { version: null, source: null };
  }

  // 1. Direct DOM check (set by content script at document_start)
  const domAttr = document.documentElement.getAttribute('data-sorotrack-extension-version');
  if (domAttr && domAttr.trim()) {
    const ver = domAttr.trim();
    try {
      localStorage.setItem(STORAGE_KEY, ver);
    } catch {}
    return { version: ver, source: 'dom-bridge' };
  }

  // 2. Active Message Handshake ping
  const pingPromise = new Promise<{ version: string | null; source: 'message-ping' | null }>((resolve) => {
    let resolved = false;

    const messageHandler = (e: MessageEvent) => {
      if (e.data && e.data.type === 'SOROTRACK_PONG_EXTENSION' && e.data.version) {
        resolved = true;
        window.removeEventListener('message', messageHandler);
        const ver = String(e.data.version).trim();
        try {
          localStorage.setItem(STORAGE_KEY, ver);
        } catch {}
        resolve({ version: ver, source: 'message-ping' });
      }
    };

    window.addEventListener('message', messageHandler);

    try {
      window.postMessage({ type: 'SOROTRACK_PING_EXTENSION' }, '*');
      window.dispatchEvent(new CustomEvent('SOROTRACK_CHECK_EXTENSION'));
    } catch {}

    // Short timeout to avoid blocking
    setTimeout(() => {
      if (!resolved) {
        window.removeEventListener('message', messageHandler);
        resolve({ version: null, source: null });
      }
    }, 450);
  });

  const pingResult = await pingPromise;
  if (pingResult.version) {
    return pingResult;
  }

  // 3. Fallback to localStorage previous detection
  try {
    const cached = localStorage.getItem(STORAGE_KEY);
    if (cached && cached.trim()) {
      return { version: cached.trim(), source: 'local-storage' };
    }
  } catch {}

  return { version: null, source: null };
}

/**
 * Checks the full extension version status:
 * Combines server manifest latest version with browser-detected installed version.
 */
export async function checkExtensionVersion(simulatedVersion?: string | null): Promise<ExtensionVersionInfo> {
  let serverLatest = '1.1.0';
  let serverInstalled: string | null = null;
  let releaseDate = '2026-09-23';
  let releaseNotes = 'Autonomous Top Content scanning agent, improved Firestore quota protection, and dark/light theme support.';
  let downloadUrl = '/api/extension/download';

  // 1. Fetch server latest version
  try {
    const res = await fetch('/api/extension/version');
    if (res.ok) {
      const data = await res.json();
      if (data.latestVersion) serverLatest = data.latestVersion;
      if (data.installedVersion) serverInstalled = data.installedVersion;
      if (data.releaseDate) releaseDate = data.releaseDate;
      if (data.releaseNotes) releaseNotes = data.releaseNotes;
      if (data.downloadUrl) downloadUrl = data.downloadUrl;
    }
  } catch (err) {
    console.warn('[Version Checker] Notice querying /api/extension/version:', err);
  }

  // 2. Proactively probe browser for installed version
  let detected = await detectBrowserInstalledVersion();
  let effectiveInstalled = simulatedVersion !== undefined 
    ? simulatedVersion 
    : (detected.version || serverInstalled);

  // If detected version in browser differs from server's record, inform backend
  if (detected.version && detected.version !== serverInstalled) {
    try {
      fetch('/api/extension/version', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version: detected.version })
      }).catch(() => {});
    } catch {}
  }

  const isOutdated = Boolean(
    effectiveInstalled && 
    isVersionOutdated(effectiveInstalled, serverLatest)
  );

  return {
    latestVersion: serverLatest,
    installedVersion: effectiveInstalled,
    isOutdated,
    releaseDate,
    releaseNotes,
    downloadUrl,
    detectionSource: detected.source || (serverInstalled ? 'server-sync' : undefined)
  };
}

/**
 * Check if the upgrade banner was dismissed for this target version
 */
export function isUpgradeAlertDismissed(latestVersion: string): boolean {
  try {
    const dismissed = localStorage.getItem(DISMISSED_VERSION_KEY);
    return dismissed === latestVersion;
  } catch {
    return false;
  }
}

/**
 * Dismiss the upgrade banner for a specific version
 */
export function dismissUpgradeAlert(latestVersion: string): void {
  try {
    localStorage.setItem(DISMISSED_VERSION_KEY, latestVersion);
  } catch {}
}

/**
 * Reset dismissal state
 */
export function resetDismissedUpgradeAlert(): void {
  try {
    localStorage.removeItem(DISMISSED_VERSION_KEY);
  } catch {}
}
