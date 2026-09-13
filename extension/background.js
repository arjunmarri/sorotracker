/**
 * SoroTrack Background Script / Service Worker
 * Compatible with Firefox & Chrome
 * Executes remote network sync bypassing webpage CSP
 */

const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

const DEFAULT_CONFIG = {
  dashboardUrl: 'http://localhost:3000',
  authToken: '',
  autoSync: false, // Auto-sync disabled to prevent exhausting Firestore daily collection write limits
  syncIntervalSec: 5
};

// Listen for installation
browserAPI.runtime.onInstalled.addListener(() => {
  console.log('[SoroTrack] Extension successfully installed.');
  browserAPI.storage.local.get(['dashboardUrl', 'authToken', 'autoSync', 'syncIntervalSec'], (res) => {
    const toSet = {};
    if (!res || !res.dashboardUrl) toSet.dashboardUrl = DEFAULT_CONFIG.dashboardUrl;
    if (!res || res.authToken === undefined) toSet.authToken = DEFAULT_CONFIG.authToken;
    toSet.autoSync = false;
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

  // Open Standalone Local Offline Viewer in new browser window
  if (request.type === 'OPEN_LOCAL_VIEWER') {
    const viewerUrl = browserAPI.runtime.getURL('viewer.html');
    if (browserAPI.windows && browserAPI.windows.create) {
      browserAPI.windows.create({
        url: viewerUrl,
        type: 'normal',
        width: 1320,
        height: 880
      }, (win) => {
        sendResponse({ success: true, windowId: win?.id });
      });
    } else if (browserAPI.tabs && browserAPI.tabs.create) {
      browserAPI.tabs.create({ url: viewerUrl }, (tab) => {
        sendResponse({ success: true, tabId: tab?.id });
      });
    } else {
      sendResponse({ success: false, url: viewerUrl });
    }
    return true;
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
    const syncTimestamp = timestamp || new Date().toISOString();
    
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

      const recordsToSend = (records || []).map(r => ({
        ...r,
        syncedAt: r.syncedAt || syncTimestamp
      }));

      fetch(syncEndpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          records: recordsToSend,
          source: source || 'extension',
          timestamp: syncTimestamp
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
          browserAPI.storage.local.set({
            soro_sync_status: 'offline',
            soro_last_sync_error: `HTTP ${res.status}: ${errText}`
          });
          sendResponse({
            success: false,
            status: res.status,
            error: `Middleware returned HTTP ${res.status}: ${errText}`
          });
          return;
        }

        const data = await res.json();
        const isQuotaExhausted = Boolean(data?.isQuotaExhausted);
        
        // Update syncedAt timestamp in extension local JSON storage
        browserAPI.storage.local.get(['soro_history_json', 'soro_synced_ids'], (storeRes) => {
          const updatePayload = {
            soro_sync_status: isQuotaExhausted ? 'offline' : 'online',
            soro_quota_exhausted: isQuotaExhausted,
            soro_last_sync_time: syncTimestamp
          };

          if (Array.isArray(recordsToSend) && recordsToSend.length > 0) {
            const syncedIdsSet = new Set(storeRes?.soro_synced_ids || []);
            recordsToSend.forEach(r => syncedIdsSet.add(r.id));
            updatePayload.soro_synced_ids = Array.from(syncedIdsSet);

            if (Array.isArray(storeRes?.soro_history_json)) {
              const recordIdMap = new Map(recordsToSend.map(r => [r.id, r]));
              storeRes.soro_history_json.forEach(item => {
                if (recordIdMap.has(item.id)) {
                  item.syncedAt = syncTimestamp;
                }
              });
              updatePayload.soro_history_json = storeRes.soro_history_json;
              updatePayload.soro_unsynced_count = Math.max(0, storeRes.soro_history_json.length - updatePayload.soro_synced_ids.length);
            }
          }

          browserAPI.storage.local.set(updatePayload);
        });

        sendResponse({
          success: true,
          isQuotaExhausted,
          result: data,
          total: data.total || (records ? records.length : 0)
        });
      })
      .catch((err) => {
        console.error('[SoroTrack Background] Sync network error:', err);
        browserAPI.storage.local.set({
          soro_sync_status: 'offline',
          soro_last_sync_error: err.message || 'Connection failed'
        });
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
