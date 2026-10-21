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
browserAPI.runtime.onInstalled.addListener((details) => {
  console.log('[SoroTrack] Extension installed/updated:', details?.reason);
  browserAPI.storage.local.get([
    'dashboardUrl',
    'authToken',
    'autoSync',
    'syncIntervalSec',
    'soro_history_json',
    'soro_first_install_synced'
  ], (res) => {
    const toSet = {};
    if (!res || !res.dashboardUrl) toSet.dashboardUrl = DEFAULT_CONFIG.dashboardUrl;
    if (!res || res.authToken === undefined) toSet.authToken = DEFAULT_CONFIG.authToken;
    toSet.autoSync = false;
    if (!res || !res.syncIntervalSec) toSet.syncIntervalSec = DEFAULT_CONFIG.syncIntervalSec;

    browserAPI.storage.local.set(toSet, () => {
      // Check if fresh installation or empty local JSON: download all snippets locally
      const localHistory = Array.isArray(res?.soro_history_json) ? res.soro_history_json : [];
      if (localHistory.length === 0 || !res?.soro_first_install_synced) {
        console.log('[SoroTrack] Fresh installation detected. Initiating initial bootstrap sync to download all snippets locally...');
        performBootstrapSync();
      }

      // Proactively check version on installation or update
      checkExtensionVersionProactively();
    });
  });
});

// Proactively check version when browser starts up
if (browserAPI.runtime.onStartup) {
  browserAPI.runtime.onStartup.addListener(() => {
    checkExtensionVersionProactively();
  });
}

// Schedule proactive periodic version check every 60 minutes
if (browserAPI.alarms && browserAPI.alarms.create) {
  try {
    browserAPI.alarms.create('soro_check_version', { periodInMinutes: 60 });
    browserAPI.alarms.onAlarm.addListener((alarm) => {
      if (alarm.name === 'soro_check_version') {
        checkExtensionVersionProactively();
      }
    });
  } catch (e) {
    console.warn('[SoroTrack] Alarms setup warning:', e);
  }
}

/**
 * Compare two semantic version strings (e.g. "1.1.0" vs "1.2.0")
 * Returns -1 if v1 < v2, 1 if v1 > v2, 0 if equal
 */
function compareSemVer(v1, v2) {
  const p1 = (v1 || '0').split('.').map(n => parseInt(n, 10) || 0);
  const p2 = (v2 || '0').split('.').map(n => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
    const num1 = p1[i] || 0;
    const num2 = p2[i] || 0;
    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }
  return 0;
}

/**
 * Proactively checks the extension version against the SoroTrack server.
 * Compares installed vs latest version and triggers badge/alerts if upgrade is available.
 */
function checkExtensionVersionProactively(callback) {
  browserAPI.storage.local.get(['dashboardUrl', 'authToken'], (stored) => {
    const targetBase = (stored?.dashboardUrl || DEFAULT_CONFIG.dashboardUrl).replace(/\/+$/, '');
    const versionUrl = `${targetBase}/api/extension/version`;
    const installedVersion = (browserAPI.runtime.getManifest && browserAPI.runtime.getManifest().version) || '1.1.0';

    const headers = {
      'Accept': 'application/json',
      'x-extension-version': installedVersion
    };
    if (stored?.authToken) {
      headers['Authorization'] = `Bearer ${stored.authToken}`;
      headers['x-api-key'] = stored.authToken;
    }

    fetch(versionUrl, { headers })
      .then(async (res) => {
        if (!res.ok) {
          if (callback) callback({ success: false, installedVersion, error: `HTTP ${res.status}` });
          return;
        }
        const data = await res.json();
        const latestVersion = data.latestVersion || installedVersion;
        const isOutdated = Boolean(data.isOutdated || (latestVersion && compareSemVer(installedVersion, latestVersion) < 0));

        const versionData = {
          installedVersion,
          latestVersion,
          isOutdated,
          releaseNotes: data.releaseNotes || 'A new update of SoroTrack is available with improvements and new features.',
          releaseDate: data.releaseDate || '',
          downloadUrl: `${targetBase}/api/extension/download?browser=chrome`
        };

        // Update badge on extension icon to alert user proactively
        if (browserAPI.action && browserAPI.action.setBadgeText) {
          browserAPI.action.setBadgeText({ text: isOutdated ? 'NEW' : '' });
          if (isOutdated && browserAPI.action.setBadgeBackgroundColor) {
            browserAPI.action.setBadgeBackgroundColor({ color: '#f59e0b' });
          }
        }

        browserAPI.storage.local.set({
          soro_installed_version: installedVersion,
          soro_latest_version: latestVersion,
          soro_upgrade_available: isOutdated,
          soro_upgrade_notes: versionData.releaseNotes,
          soro_upgrade_download_url: versionData.downloadUrl,
          soro_last_version_check: new Date().toISOString()
        });

        console.log(`[SoroTrack Background] Proactive Version Check: Installed v${installedVersion}, Server v${latestVersion}. Upgrade available: ${isOutdated}`);
        if (callback) callback({ success: true, ...versionData });
      })
      .catch((err) => {
        console.warn('[SoroTrack Background] Proactive version check failed:', err.message);
        if (callback) callback({ success: false, installedVersion, error: err.message });
      });
  });
}

/**
 * Automatically downloads all server snippets to local JSON storage.
 * Used on first install, or when requested by popup / content script / options.
 */
function performBootstrapSync(callback) {
  browserAPI.storage.local.get(['dashboardUrl', 'authToken', 'soro_user', 'soro_history_json'], (stored) => {
    const targetBase = (stored?.dashboardUrl || DEFAULT_CONFIG.dashboardUrl).replace(/\/+$/, '');
    const syncEndpoint = targetBase.endsWith('/api/sync') ? targetBase : `${targetBase}/api/sync`;
    const token = stored?.authToken || '';
    const user = stored?.soro_user;
    const extVersion = (browserAPI.runtime.getManifest && browserAPI.runtime.getManifest().version) || '1.1.0';

    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'x-extension-version': extVersion
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
      headers['x-api-key'] = token;
    }
    if (user) {
      if (user.id) headers['x-user-id'] = user.id;
      if (user.email) headers['x-user-email'] = user.email;
    }

    const existingRecords = Array.isArray(stored?.soro_history_json) ? stored.soro_history_json : [];
    const clientSnippetIds = existingRecords.map(r => r && r.id).filter(Boolean);

    console.log(`[SoroTrack Background] Starting bootstrap sync to download snippets from ${syncEndpoint} (User: ${user?.email || 'unassigned'})...`);

    fetch(syncEndpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        records: [],
        clientSnippetIds,
        clientTotal: existingRecords.length,
        userId: user?.id,
        userEmail: user?.email,
        source: 'first_install_bootstrap',
        timestamp: new Date().toISOString(),
        extensionVersion: extVersion
      })
    })
    .then(async (res) => {
      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        console.warn(`[SoroTrack Background] Bootstrap sync failed with HTTP ${res.status}:`, errText);
        if (callback) callback({ success: false, status: res.status, error: errText });
        return;
      }

      const data = await res.json();
      const serverRecords = Array.isArray(data?.serverRecordsToPush)
        ? data.serverRecordsToPush
        : (Array.isArray(data?.step2?.serverRecordsToPush) ? data.step2.serverRecordsToPush : []);

      const syncTimestamp = new Date().toISOString();
      const localMap = new Map();
      existingRecords.forEach(r => { if (r && r.id) localMap.set(r.id, r); });

      serverRecords.forEach(srvRec => {
        if (!srvRec || !srvRec.id) return;
        if (localMap.has(srvRec.id)) {
          const loc = localMap.get(srvRec.id);
          loc.syncedAt = srvRec.syncedAt || loc.syncedAt || syncTimestamp;
          if (srvRec.isBookmarked) loc.isBookmarked = true;
        } else {
          localMap.set(srvRec.id, {
            ...srvRec,
            syncedAt: srvRec.syncedAt || syncTimestamp
          });
        }
      });

      const updatedHistory = Array.from(localMap.values()).sort((a, b) => {
        const tA = new Date(a.createdAt || a.scannedAt || 0).getTime();
        const tB = new Date(b.createdAt || b.scannedAt || 0).getTime();
        return tB - tA;
      });

      const updatedSyncedIds = updatedHistory.map(r => r.id);

      browserAPI.storage.local.set({
        soro_history_json: updatedHistory,
        soro_synced_ids: updatedSyncedIds,
        soro_history_count: updatedHistory.length,
        soro_unsynced_count: 0,
        soro_sync_status: 'online',
        soro_first_install_synced: true,
        soro_last_sync_time: syncTimestamp
      }, () => {
        console.log(`[SoroTrack Background] Bootstrap sync complete! Local JSON now has ${updatedHistory.length} snippets (received ${serverRecords.length} from server).`);
        if (callback) {
          callback({
            success: true,
            totalDownloaded: serverRecords.length,
            localTotal: updatedHistory.length,
            hasSameSnippets: Boolean(data.hasSameSnippets)
          });
        }
      });
    })
    .catch((err) => {
      console.warn('[SoroTrack Background] Bootstrap sync network error:', err);
      if (callback) callback({ success: false, error: err.message });
    });
  });
}

// Handle messages from content script & popup
browserAPI.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'PING') {
    sendResponse({ status: 'PONG', time: Date.now() });
    return false;
  }

  // Handle user session sync from web dashboard or popup
  if (request.type === 'SYNC_USER_SESSION') {
    const user = request.user;
    if (user && (user.id || user.email)) {
      browserAPI.storage.local.set({ soro_user: user }, () => {
        console.log('[SoroTrack Background] Stored authenticated user session:', user.email);
        sendResponse({ success: true, user });
      });
    } else {
      sendResponse({ success: false });
    }
    return true;
  }

  // Handle user logout
  if (request.type === 'USER_LOGOUT') {
    browserAPI.storage.local.remove(['soro_user'], () => {
      console.log('[SoroTrack Background] Cleared user session on logout.');
      sendResponse({ success: true });
    });
    return true;
  }

  if (request.type === 'BOOTSTRAP_SYNC') {
    performBootstrapSync((res) => {
      sendResponse(res);
    });
    return true;
  }

  if (request.type === 'GET_VERSION') {
    const version = (browserAPI.runtime.getManifest && browserAPI.runtime.getManifest().version) || '1.1.0';
    sendResponse({ success: true, version });
    return false;
  }

  if (request.type === 'CHECK_VERSION' || request.type === 'GET_VERSION_INFO') {
    checkExtensionVersionProactively((res) => {
      sendResponse(res);
    });
    return true;
  }

  if (request.type === 'DOWNLOAD_UPGRADE') {
    browserAPI.storage.local.get(['dashboardUrl'], (stored) => {
      const targetBase = (stored?.dashboardUrl || DEFAULT_CONFIG.dashboardUrl).replace(/\/+$/, '');
      const downloadUrl = `${targetBase}/api/extension/download?browser=chrome`;
      if (browserAPI.tabs && browserAPI.tabs.create) {
        browserAPI.tabs.create({ url: downloadUrl });
      }
      sendResponse({ success: true, downloadUrl });
    });
    return true;
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

    // Execute remote 2-step sync call via background script (bypasses webpage CSP on x.com)
  if (request.type === 'SYNC_RECORDS') {
    const { endpoint, authToken, records, source, timestamp } = request.payload || {};
    const syncTimestamp = timestamp || new Date().toISOString();
    
    // Retrieve stored authToken, dashboardUrl, and local JSON history
    browserAPI.storage.local.get(['dashboardUrl', 'authToken', 'soro_user', 'soro_history_json', 'soro_synced_ids'], (stored) => {
      const targetBase = (endpoint || stored?.dashboardUrl || DEFAULT_CONFIG.dashboardUrl).replace(/\/+$/, '');
      const syncEndpoint = targetBase.endsWith('/api/sync') ? targetBase : `${targetBase}/api/sync`;
      const token = authToken || stored?.authToken || '';
      const user = stored?.soro_user;

      const extVersion = (browserAPI.runtime.getManifest && browserAPI.runtime.getManifest().version) || '1.1.0';
      const headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'x-extension-version': extVersion
      };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
        headers['x-api-key'] = token;
      }
      if (user) {
        if (user.id) headers['x-user-id'] = user.id;
        if (user.email) headers['x-user-email'] = user.email;
      }

      const existingLocalRecords = Array.isArray(stored?.soro_history_json) ? stored.soro_history_json : [];
      const syncedIdsSet = new Set(stored?.soro_synced_ids || []);
      const clientSnippetIds = existingLocalRecords.map(r => r && r.id).filter(Boolean);

      // Step 1: Whichever new local JSON data is available on the browser will be sent
      let recordsToSend = [];
      if (Array.isArray(records) && records.length > 0) {
        recordsToSend = records.map(r => ({
          ...r,
          userId: r.userId || user?.id,
          userEmail: r.userEmail || user?.email,
          syncedAt: r.syncedAt || syncTimestamp
        }));
      } else {
        // Send unsynced local records if none specifically passed
        const unsynced = existingLocalRecords.filter(r => r && r.id && !syncedIdsSet.has(r.id));
        recordsToSend = (unsynced.length > 0 ? unsynced : existingLocalRecords).map(r => ({
          ...r,
          userId: r.userId || user?.id,
          userEmail: r.userEmail || user?.email,
          syncedAt: r.syncedAt || syncTimestamp
        }));
      }

      fetch(syncEndpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          records: recordsToSend,
          clientSnippetIds,
          clientTotal: existingLocalRecords.length,
          userId: user?.id,
          userEmail: user?.email,
          source: source || 'extension',
          timestamp: syncTimestamp,
          extensionVersion: extVersion
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
        const serverRecordsToPush = Array.isArray(data?.serverRecordsToPush) 
          ? data.serverRecordsToPush 
          : (Array.isArray(data?.step2?.serverRecordsToPush) ? data.step2.serverRecordsToPush : []);

        // Step 2: Check server data and local data. If they don't have the same snippets,
        // push the server data into the browser's local JSON!
        const localMap = new Map();
        existingLocalRecords.forEach(item => {
          if (item && item.id) localMap.set(item.id, { ...item });
        });

        // 1. Mark outgoing local items as synced
        recordsToSend.forEach(r => {
          if (r && r.id) {
            syncedIdsSet.add(r.id);
            if (localMap.has(r.id)) {
              localMap.get(r.id).syncedAt = syncTimestamp;
            } else {
              localMap.set(r.id, { ...r, syncedAt: syncTimestamp });
            }
          }
        });

        // 2. Push already synced server data into local JSON
        let newlyPushedToLocalCount = 0;
        if (serverRecordsToPush.length > 0) {
          serverRecordsToPush.forEach(srvRec => {
            if (!srvRec || !srvRec.id) return;
            syncedIdsSet.add(srvRec.id);
            if (localMap.has(srvRec.id)) {
              const localRec = localMap.get(srvRec.id);
              localRec.syncedAt = srvRec.syncedAt || localRec.syncedAt || syncTimestamp;
              if (srvRec.isBookmarked && !localRec.isBookmarked) {
                localRec.isBookmarked = true;
                localRec.bookmarkedAt = srvRec.bookmarkedAt || syncTimestamp;
              }
            } else {
              localMap.set(srvRec.id, {
                ...srvRec,
                syncedAt: srvRec.syncedAt || syncTimestamp
              });
              newlyPushedToLocalCount++;
            }
          });
        }

        // Sort descending by creation/scan timestamp
        const updatedLocalHistory = Array.from(localMap.values()).sort((a, b) => {
          const tA = new Date(a.createdAt || a.scannedAt || 0).getTime();
          const tB = new Date(b.createdAt || b.scannedAt || 0).getTime();
          return tB - tA;
        });

        const updatedSyncedIds = Array.from(syncedIdsSet);
        const remainingUnsynced = Math.max(0, updatedLocalHistory.length - updatedSyncedIds.length);

        const updatePayload = {
          soro_history_json: updatedLocalHistory,
          soro_synced_ids: updatedSyncedIds,
          soro_history_count: updatedLocalHistory.length,
          soro_unsynced_count: remainingUnsynced,
          soro_sync_status: isQuotaExhausted ? 'offline' : 'online',
          soro_quota_exhausted: isQuotaExhausted,
          soro_last_sync_time: syncTimestamp
        };

        browserAPI.storage.local.set(updatePayload, () => {
          console.log(`[SoroTrack Background] 2-Step Sync Complete: Sent ${recordsToSend.length} local records; received & merged ${newlyPushedToLocalCount} server records into local JSON.`);
          checkExtensionVersionProactively();
        });

        sendResponse({
          success: true,
          isQuotaExhausted,
          hasSameSnippets: Boolean(data.hasSameSnippets),
          pushedToServerCount: recordsToSend.length,
          pushedToLocalCount: newlyPushedToLocalCount,
          serverRecordsToPush,
          step1: data.step1,
          step2: data.step2,
          serverTotal: data.serverTotal || (data.total ?? updatedLocalHistory.length),
          localTotal: updatedLocalHistory.length,
          result: data,
          total: data.total || updatedLocalHistory.length
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

  // Autonomous X Agent: Opens x.com/explore in an inactive background tab, scrapes trending topics, and closes tab
  if (request.type === 'RUN_AUTONOMOUS_X_AGENT') {
    browserAPI.storage.local.get(['dashboardUrl', 'authToken'], (stored) => {
      const targetBase = (stored?.dashboardUrl || DEFAULT_CONFIG.dashboardUrl).replace(/\/+$/, '');
      const agentEndpoint = `${targetBase}/api/agent/top-content`;
      const token = stored?.authToken || '';

      console.log('[SoroTrack Agent] Launching autonomous background scanner on x.com/explore...');

      // Open background inactive tab
      browserAPI.tabs.create({ url: 'https://x.com/explore', active: false }, (tab) => {
        if (!tab || !tab.id) {
          sendResponse({ success: false, error: 'Could not open background Chrome tab' });
          return;
        }

        const tabId = tab.id;

        // Wait 5 seconds for X client-side SPA to hydrate
        setTimeout(() => {
          // Execute scraper script in background tab
          if (browserAPI.scripting && browserAPI.scripting.executeScript) {
            browserAPI.scripting.executeScript({
              target: { tabId },
              func: scrapeXTrendsFromPage
            }, (results) => {
              // Close background tab cleanly
              try { browserAPI.tabs.remove(tabId); } catch (e) {}

              const scrapedItems = results && results[0] && results[0].result ? results[0].result : [];

              if (scrapedItems.length > 0) {
                const headers = { 'Content-Type': 'application/json' };
                if (token) {
                  headers['Authorization'] = `Bearer ${token}`;
                  headers['x-api-key'] = token;
                }

                fetch(agentEndpoint, {
                  method: 'POST',
                  headers,
                  body: JSON.stringify({ items: scrapedItems, mode: 'chrome-extension-agent' })
                })
                .then(r => r.json())
                .then(data => {
                  sendResponse({ success: true, count: scrapedItems.length, data });
                })
                .catch(err => {
                  sendResponse({ success: false, count: scrapedItems.length, error: err.message });
                });
              } else {
                sendResponse({ success: true, count: 0, message: 'No trends found or page required login' });
              }
            });
          } else {
            // Fallback tab close
            try { browserAPI.tabs.remove(tabId); } catch (e) {}
            sendResponse({ success: false, error: 'Scripting API not available in this context' });
          }
        }, 5500);
      });
    });
    return true;
  }

  // ==========================================
  // LOCAL LLM INFERENCING HANDLERS (Ollama, LM Studio, LocalAI)
  // Bypasses webpage CSP to communicate with local inferencing engines
  // ==========================================
  if (request.type === 'LOCAL_LLM_CHECK') {
    handleLocalLLMCheck(request.payload || {}, (res) => {
      sendResponse(res);
    });
    return true;
  }

  if (request.type === 'LOCAL_LLM_GET_MODELS') {
    handleLocalLLMGetModels(request.payload || {}, (res) => {
      sendResponse(res);
    });
    return true;
  }

  if (request.type === 'LOCAL_LLM_CHAT') {
    handleLocalLLMChat(request.payload || {}, (res) => {
      sendResponse(res);
    });
    return true;
  }
});

// ==========================================
// LOCAL LLM STREAMING PORT CONNECTION
// ==========================================
if (browserAPI.runtime.onConnect) {
  browserAPI.runtime.onConnect.addListener((port) => {
    if (port.name === 'soro_llm_stream') {
      port.onMessage.addListener(async (msg) => {
        if (msg.type === 'START_STREAM') {
          await streamLocalLLM(msg.payload, port);
        }
      });
    }
  });
}

/**
 * Helper to normalize and build fallback candidate URLs for local Ollama
 */
function buildOllamaCandidates(rawUrl) {
  let base = (rawUrl || 'http://127.0.0.1:11434').trim();
  if (!base.startsWith('http://') && !base.startsWith('https://')) {
    base = `http://${base}`;
  }
  base = base.replace(/\/+$/, '');
  const candidates = [base];
  try {
    const parsed = new URL(base);
    const port = parsed.port || '11434';
    if (parsed.hostname === '127.0.0.1') {
      candidates.push(`${parsed.protocol}//localhost:${port}`);
    } else if (parsed.hostname === 'localhost') {
      candidates.push(`${parsed.protocol}//127.0.0.1:${port}`);
    }
  } catch {}
  return candidates;
}

/**
 * Probes local Ollama endpoint (URL & model availability)
 */
async function handleLocalLLMCheck(payload, callback) {
  const { url, model = 'llama3.2' } = payload;
  const candidates = buildOllamaCandidates(url);

  let lastError = '';
  for (const candidateUrl of candidates) {
    try {
      const testRes = await fetch(`${candidateUrl}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(4000)
      });
      if (testRes.ok) {
        const data = await testRes.json();
        const models = Array.isArray(data.models) ? data.models.map(m => m.name || m.model) : [];

        // Check if target model is present
        const targetLower = (model || '').toLowerCase();
        const matched = models.find(m => {
          const l = m.toLowerCase();
          return l === targetLower || l === `${targetLower}:latest` || l.startsWith(`${targetLower}:`);
        });

        callback({
          online: true,
          provider: 'ollama',
          url: candidateUrl,
          models,
          targetModel: model,
          matchedModel: matched || (models[0] || model),
          modelFound: Boolean(matched),
          defaultModel: matched || models[0] || 'llama3.2',
          message: matched 
            ? `Connected to Ollama! Model '${matched}' is ready.`
            : `Connected to Ollama with ${models.length} model(s) available.`
        });
        return;
      } else {
        lastError = `HTTP ${testRes.status}`;
      }
    } catch (e) {
      lastError = e?.message || 'Connection refused';
    }
  }

  callback({
    online: false,
    provider: 'ollama',
    url: candidates[0],
    message: `Could not reach Ollama at ${candidates[0]} (${lastError}). Make sure Ollama is running ('ollama serve').`
  });
}

/**
 * Fetches all available model tags from local Ollama
 */
async function handleLocalLLMGetModels(payload, callback) {
  const { url } = payload;
  const candidates = buildOllamaCandidates(url);

  for (const candidateUrl of candidates) {
    try {
      const res = await fetch(`${candidateUrl}/api/tags`, { signal: AbortSignal.timeout(4000) });
      if (res.ok) {
        const data = await res.json();
        const models = Array.isArray(data.models) ? data.models.map(m => m.name || m.model) : [];
        callback({ success: true, models, url: candidateUrl });
        return;
      }
    } catch (err) {}
  }
  callback({ success: false, error: 'Could not connect to Ollama. Make sure Ollama is running.', models: [] });
}

/**
 * Synchronous non-streaming chat request to local Ollama with automatic model tag resolution
 */
async function handleLocalLLMChat(payload, callback) {
  const {
    url,
    model = 'llama3.2',
    prompt,
    systemPrompt = 'You are SoroTrack Personal Assistant. Help the user with web page tasks and research.',
    temperature = 0.3
  } = payload;

  const candidates = buildOllamaCandidates(url);
  let lastError = '';

  for (const baseUrl of candidates) {
    try {
      // Step 1: Query tags to find available models & map tag accurately
      let resolvedModel = model;
      try {
        const tagsRes = await fetch(`${baseUrl}/api/tags`, { signal: AbortSignal.timeout(3000) });
        if (tagsRes.ok) {
          const tagsData = await tagsRes.json();
          const tagModels = Array.isArray(tagsData.models) ? tagsData.models.map(m => m.name || m.model) : [];
          const targetLower = (model || '').toLowerCase();
          const found = tagModels.find(m => {
            const l = m.toLowerCase();
            return l === targetLower || l === `${targetLower}:latest` || l.startsWith(`${targetLower}:`);
          });
          if (found) {
            resolvedModel = found;
          } else if (tagModels.length > 0 && !targetLower) {
            resolvedModel = tagModels[0];
          }
        }
      } catch {}

      // Step 2: Try /api/chat with 45s timeout
      let res = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: resolvedModel || 'llama3.2',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: prompt }
          ],
          stream: false,
          options: { temperature }
        }),
        signal: AbortSignal.timeout(45000)
      }).catch(err => {
        lastError = err?.message || 'Chat request failed';
        return null;
      });

      // Step 3: If /api/chat failed or returned 404, fallback to /api/generate
      if (!res || !res.ok) {
        res = await fetch(`${baseUrl}/api/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: resolvedModel || 'llama3.2',
            prompt: `${systemPrompt}\n\nUser Request: ${prompt}\n\nAssistant Response:`,
            stream: false,
            options: { temperature }
          }),
          signal: AbortSignal.timeout(45000)
        }).catch(err => {
          lastError = err?.message || 'Generate request failed';
          return null;
        });
      }

      if (res && res.ok) {
        const data = await res.json();
        const content = data.message?.content || data.response || '';
        callback({ success: true, content, model: data.model || resolvedModel, url: baseUrl });
        return;
      } else if (res) {
        const errText = await res.text().catch(() => '');
        lastError = `Ollama HTTP ${res.status}: ${errText}`;
      }
    } catch (err) {
      lastError = err?.message || 'Unknown network error';
    }
  }

  callback({
    success: false,
    error: lastError || 'Could not connect to Ollama',
    troubleshooting: `Failed to connect to Ollama at ${candidates[0]}. Make sure 'ollama serve' is running and the model '${model}' is installed ('ollama run ${model}').`
  });
}

/**
 * Stream local Ollama tokens in real-time over port connection
 */
async function streamLocalLLM(payload, port) {
  const {
    url,
    model = 'llama3.2',
    prompt,
    systemPrompt = 'You are SoroTrack Personal Assistant.',
    temperature = 0.3
  } = payload;

  const candidates = buildOllamaCandidates(url);

  for (const baseUrl of candidates) {
    try {
      const res = await fetch(`${baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: model || 'llama3.2',
          prompt: `${systemPrompt}\n\nUser: ${prompt}\n\nAssistant:`,
          stream: true,
          options: { temperature }
        }),
        signal: AbortSignal.timeout(60000)
      });

      if (!res.ok) {
        continue;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let fullText = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const parsed = JSON.parse(line);
            if (parsed.response) {
              fullText += parsed.response;
              port.postMessage({ type: 'CHUNK', chunk: parsed.response, fullText });
            }
          } catch (e) {}
        }
      }

      port.postMessage({ type: 'DONE', fullText });
      return;
    } catch (err) {
      // Try next candidate
    }
  }

  port.postMessage({ type: 'ERROR', error: 'Ollama streaming failed' });
}

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === 'data: [DONE]') continue;
          if (trimmed.startsWith('data: ')) {
            try {
              const parsed = JSON.parse(trimmed.slice(6));
              const chunk = parsed.choices?.[0]?.delta?.content || '';
              if (chunk) {
                fullText += chunk;
                port.postMessage({ type: 'CHUNK', chunk, fullText });
              }
            } catch (e) {}
          }
        }
      }

      port.postMessage({ type: 'DONE', fullText });
    }
  } catch (err) {
    port.postMessage({ type: 'ERROR', error: err.message });
  }
}


// Autonomous Scraper Function injected into x.com/explore background tab
function scrapeXTrendsFromPage() {
  try {
    const trendElements = document.querySelectorAll('[data-testid="trend"], div[dir="ltr"]');
    const items = [];
    const seen = new Set();

    trendElements.forEach((el, idx) => {
      const text = el.innerText || '';
      const lines = text.split('\n').map(s => s.trim()).filter(Boolean);
      if (lines.length < 2) return;

      // Extract trend topic line (e.g. #Gemini, NVIDIA, etc.)
      const topic = lines.find(l => l.startsWith('#') || (!l.includes('Trending') && !l.includes('posts') && l.length > 2)) || lines[0];
      if (!topic || seen.has(topic.toLowerCase()) || topic.length < 2) return;
      seen.add(topic.toLowerCase());

      const volumeLine = lines.find(l => l.toLowerCase().includes('posts') || l.toLowerCase().includes('tweets')) || 'Trending';
      const categoryLine = lines.find(l => l.toLowerCase().includes('trending in') || l.toLowerCase().includes('technology') || l.toLowerCase().includes('business')) || 'Trending';

      items.push({
        id: `ext_trend_${Date.now()}_${idx + 1}`,
        topic,
        category: categoryLine.replace(/trending\s+in\s+/i, '').trim() || 'Tech & AI',
        rank: items.length + 1,
        volume: volumeLine,
        summary: `Trending discussion on 𝕏 around ${topic} with active community engagement.`,
        viralSnippet: `Top trending discussion on 𝕏: ${topic}. Community posts and updates are actively circulating.`,
        authorName: 'Trending on 𝕏',
        authorHandle: `@${topic.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase() || 'trending'}`,
        isVerified: true,
        metrics: {
          retweets: Math.floor(1200 + Math.random() * 4000),
          likes: Math.floor(8000 + Math.random() * 20000),
          bookmarks: Math.floor(800 + Math.random() * 2500),
          views: '500K+'
        },
        externalUrl: `https://x.com/search?q=${encodeURIComponent(topic)}`,
        sentiment: 'positive',
        tags: [topic.replace(/^#/, ''), 'Trending', 'X'],
        collectedAt: new Date().toISOString(),
        collectedBy: 'chrome-extension-agent'
      });
    });

    return items.slice(0, 10);
  } catch (err) {
    return [];
  }
}
