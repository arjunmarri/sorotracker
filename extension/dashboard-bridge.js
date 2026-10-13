/**
 * SoroTrack Dashboard Extension Bridge
 * Injected into SoroTrack portal to communicate extension version, installation status,
 * and telemetry seamlessly without requiring user interaction.
 */
(function () {
  'use strict';

  const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

  function getVersion() {
    try {
      const manifest = browserAPI.runtime.getManifest();
      return manifest.version || '1.0.0';
    } catch {
      return '1.0.0';
    }
  }

  const version = getVersion();

  // 1. Immediately stamp on root element for fast synchronous query
  if (document.documentElement) {
    document.documentElement.setAttribute('data-sorotrack-extension-installed', 'true');
    document.documentElement.setAttribute('data-sorotrack-extension-version', version);
  }

  // Sync user session from dashboard to extension storage
  function syncUserFromDashboard() {
    try {
      const rawUser = localStorage.getItem('soro_auth_user');
      if (rawUser) {
        const user = JSON.parse(rawUser);
        if (user && (user.id || user.email)) {
          browserAPI.storage.local.set({ soro_user: user }, () => {
            console.log('[SoroTrack Bridge] Synced user session to extension:', user.email);
          });
          if (browserAPI.runtime?.sendMessage) {
            browserAPI.runtime.sendMessage({ type: 'SYNC_USER_SESSION', user });
          }
          return;
        }
      }
      // If no user in localStorage, check if previously set and clear
      browserAPI.storage.local.get(['soro_user'], (res) => {
        if (res?.soro_user) {
          browserAPI.storage.local.remove(['soro_user']);
          if (browserAPI.runtime?.sendMessage) {
            browserAPI.runtime.sendMessage({ type: 'USER_LOGOUT' });
          }
        }
      });
    } catch {}
  }

  syncUserFromDashboard();

  // 2. Broadcast presence via CustomEvent & postMessage
  function broadcastPresence() {
    try {
      window.dispatchEvent(
        new CustomEvent('SOROTRACK_EXTENSION_DETECTED', {
          detail: {
            installed: true,
            version: version,
            timestamp: Date.now(),
            source: 'sorotrack-extension-bridge'
          }
        })
      );

      window.postMessage(
        {
          type: 'SOROTRACK_PONG_EXTENSION',
          installed: true,
          version: version,
          timestamp: Date.now()
        },
        '*'
      );
    } catch {}
  }

  // Broadcast on initial load and when document is ready
  broadcastPresence();
  if (document.readyState !== 'complete') {
    window.addEventListener('load', broadcastPresence);
  }

  // 3. Listen for query pings from SoroTrack frontend
  window.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SOROTRACK_PING_EXTENSION') {
      broadcastPresence();
      syncUserFromDashboard();
    }
    if (event.data && event.data.type === 'SOROTRACK_USER_LOGIN' && event.data.user) {
      browserAPI.storage.local.set({ soro_user: event.data.user }, () => {
        console.log('[SoroTrack Bridge] Live user login detected:', event.data.user.email);
      });
      if (browserAPI.runtime?.sendMessage) {
        browserAPI.runtime.sendMessage({ type: 'SYNC_USER_SESSION', user: event.data.user });
      }
    }
    if (event.data && event.data.type === 'SOROTRACK_USER_LOGOUT') {
      browserAPI.storage.local.remove(['soro_user'], () => {
        console.log('[SoroTrack Bridge] Live user logout detected');
      });
      if (browserAPI.runtime?.sendMessage) {
        browserAPI.runtime.sendMessage({ type: 'USER_LOGOUT' });
      }
    }
  });

  window.addEventListener('SOROTRACK_CHECK_EXTENSION', () => {
    broadcastPresence();
  });
})();
