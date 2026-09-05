/**
 * SoroTracker Background Script / Service Worker
 * Compatible with Firefox & Chrome
 * Executes remote network sync bypassing webpage CSP
 */

const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

const DEFAULT_CONFIG = {
  dashboardUrl: 'http://localhost:3000',
  authToken: '',
  autoSync: true,
  syncIntervalSec: 5
};

// Listen for installation
browserAPI.runtime.onInstalled.addListener(() => {
  console.log('[SoroTracker] Extension successfully installed.');
  browserAPI.storage.local.get(['dashboardUrl', 'authToken', 'autoSync', 'syncIntervalSec'], (res) => {
    const toSet = {};
    if (!res || !res.dashboardUrl) toSet.dashboardUrl = DEFAULT_CONFIG.dashboardUrl;
    if (!res || res.authToken === undefined) toSet.authToken = DEFAULT_CONFIG.authToken;
    if (!res || typeof res.autoSync !== 'boolean') toSet.autoSync = DEFAULT_CONFIG.autoSync;
    if (!res || !res.syncIntervalSec) toSet.syncIntervalSec = DEFAULT_CONFIG.syncIntervalSec;

    if (Object.keys(toSet).length > 0) {
      browserAPI.storage.local.set(toSet);
    }
  });
});

// Handle messages from content script & popup
browserAPI.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'PING') {
    sendResponse({ status: 'PONG', time: Date.now() });
    return false;
  }

  // Relay to active tab
  if (request.type === 'FORWARD_TO_TAB') {
    browserAPI.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0] && tabs[0].id) {
        browserAPI.tabs.sendMessage(tabs[0].id, request.payload, (tabResponse) => {
          sendResponse(tabResponse);
        });
      } else {
        sendResponse({ error: 'No active tab found' });
      }
    });
    return true;
  }

  // Execute remote sync call via background script (bypasses webpage CSP on x.com)
  if (request.type === 'SYNC_RECORDS') {
    const { endpoint, authToken, records, source, timestamp } = request.payload || {};
    
    // Retrieve stored authToken and dashboardUrl if not passed directly
    browserAPI.storage.local.get(['dashboardUrl', 'authToken'], (stored) => {
      const targetBase = (endpoint || stored?.dashboardUrl || DEFAULT_CONFIG.dashboardUrl).replace(/\/+$/, '');
      const syncEndpoint = targetBase.endsWith('/api/sync') ? targetBase : `${targetBase}/api/sync`;
      const token = authToken || stored?.authToken || '';

      const headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
        headers['x-api-key'] = token;
      }

      fetch(syncEndpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          records: records || [],
          source: source || 'extension',
          timestamp: timestamp || new Date().toISOString()
        })
      })
      .then(async (res) => {
        if (res.status === 401) {
          sendResponse({
            success: false,
            authError: true,
            status: 401,
            error: 'Authentication failed: Invalid or missing sync auth token. Please check extension settings.'
          });
          return;
        }

        if (!res.ok) {
          const errText = await res.text().catch(() => '');
          sendResponse({
            success: false,
            status: res.status,
            error: `Middleware returned HTTP ${res.status}: ${errText}`
          });
          return;
        }

        const data = await res.json();
        sendResponse({
          success: true,
          result: data,
          total: data.total || (records ? records.length : 0)
        });
      })
      .catch((err) => {
        console.error('[SoroTracker Background] Sync network error:', err);
        sendResponse({
          success: false,
          unreachable: true,
          error: `Middleware service at ${targetBase} is not reachable (${err.message || 'Connection failed'}). Check service status and URL.`
        });
      });
    });

    return true; // Keep message channel open for asynchronous response
  }

  // Test remote connection & authentication
  if (request.type === 'TEST_CONNECTION') {
    const { endpoint, authToken } = request.payload || {};
    browserAPI.storage.local.get(['dashboardUrl', 'authToken'], (stored) => {
      const targetBase = (endpoint || stored?.dashboardUrl || DEFAULT_CONFIG.dashboardUrl).replace(/\/+$/, '');
      const healthUrl = `${targetBase}/api/health`;
      const token = authToken || stored?.authToken || '';

      const headers = { 'Accept': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
        headers['x-api-key'] = token;
      }

      fetch(healthUrl, { method: 'GET', headers })
        .then(async (res) => {
          if (res.ok) {
            const data = await res.json().catch(() => ({}));
            sendResponse({ success: true, reachable: true, data });
          } else {
            sendResponse({ success: false, reachable: false, status: res.status });
          }
        })
        .catch((err) => {
          sendResponse({ success: false, reachable: false, error: err.message });
        });
    });
    return true;
  }
});
