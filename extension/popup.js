/**
 * Popup Script for X History Scanner
 * Compatible with Firefox & Chrome
 */

const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

document.addEventListener('DOMContentLoaded', () => {
  const tabStatusEl = document.getElementById('tab-status');
  const scannedCountEl = document.getElementById('scanned-count');
  const syncStatusEl = document.getElementById('sync-status');
  const bufferedCountEl = document.getElementById('buffered-count');
  const offlineBanner = document.getElementById('offline-banner');
  const scanBtn = document.getElementById('scan-btn');
  const auditHistoryBtn = document.getElementById('audit-history-btn');
  const autoScrollBtn = document.getElementById('auto-scroll-btn');
  const scrollSpeedSelect = document.getElementById('scroll-speed-select');
  const syncBtn = document.getElementById('sync-btn');
  const manualSyncPromptCard = document.getElementById('manual-sync-prompt-card');
  const manualPromptText = document.getElementById('manual-prompt-text');
  const promptSyncBtn = document.getElementById('prompt-sync-btn');
  const promptDownloadBtn = document.getElementById('prompt-download-btn');
  const openHistoryLikesBtn = document.getElementById('open-history-likes-btn');
  const openXBtn = document.getElementById('open-x-btn');
  const dashUrlInput = document.getElementById('dash-url');
  const authTokenInput = document.getElementById('auth-token');
  const openDashLink = document.getElementById('open-dash-link');

  let activeTabId = null;
  let isXComTab = false;
  let isAnonMode = false;

  const anonModeBtn = document.getElementById('anon-mode-btn');
  const anonModeSubtext = document.getElementById('anon-mode-subtext');
  const clearSessionBtn = document.getElementById('clear-session-btn');
  const importFeedbackBanner = document.getElementById('import-feedback-banner');
  const importJsonBtn = document.getElementById('import-json-btn');
  const popupImportJsonInput = document.getElementById('popup-import-json-input');

  function showImportFeedback(msg, type = 'info') {
    if (!importFeedbackBanner) return;
    importFeedbackBanner.style.display = 'block';
    if (type === 'success') {
      importFeedbackBanner.style.background = '#064e3b';
      importFeedbackBanner.style.borderColor = '#059669';
      importFeedbackBanner.style.color = '#a7f3d0';
    } else if (type === 'error') {
      importFeedbackBanner.style.background = '#450a0a';
      importFeedbackBanner.style.borderColor = '#dc2626';
      importFeedbackBanner.style.color = '#fecaca';
    } else {
      importFeedbackBanner.style.background = '#1e1e38';
      importFeedbackBanner.style.borderColor = '#6366f1';
      importFeedbackBanner.style.color = '#c7d2fe';
    }
    importFeedbackBanner.innerHTML = msg;
    setTimeout(() => {
      if (importFeedbackBanner) importFeedbackBanner.style.display = 'none';
    }, 6000);
  }

  function updateStatusDisplay(status, unsyncedCount, totalCount) {
    const isOffline = status === 'offline';
    if (syncStatusEl) {
      syncStatusEl.textContent = isOffline ? 'Offline' : (status === 'syncing' ? 'Syncing...' : 'Manual Sync');
      syncStatusEl.style.color = isOffline ? '#f59e0b' : (status === 'syncing' ? '#38bdf8' : '#10b981');
    }
    if (bufferedCountEl) {
      bufferedCountEl.textContent = unsyncedCount > 0 ? `${unsyncedCount} unsynced in JSON` : 'All synced in DB';
    }
    if (scannedCountEl && typeof totalCount === 'number') {
      scannedCountEl.textContent = totalCount;
    }
    if (offlineBanner) {
      offlineBanner.style.display = isOffline ? 'block' : 'none';
    }
    if (manualSyncPromptCard) {
      if (unsyncedCount > 0) {
        manualSyncPromptCard.style.display = 'block';
        if (manualPromptText) {
          manualPromptText.textContent = `${unsyncedCount} bookmarks saved in your local JSON file. Auto-sync is disabled to protect database quota.`;
        }
      } else {
        manualSyncPromptCard.style.display = 'none';
      }
    }

    // Always allow sync if there are records in local storage waiting to sync
    if (syncBtn && unsyncedCount > 0) {
      syncBtn.disabled = false;
    }
  }

  // Load saved dashboard URL, auth token, and storage state
  browserAPI.storage.local.get([
    'dashboardUrl',
    'authToken',
    'soro_sync_status',
    'soro_history_count',
    'soro_unsynced_count',
    'soro_quota_exhausted',
    'soro_anon_mode'
  ], (res) => {
    if (res && res.dashboardUrl) {
      dashUrlInput.value = res.dashboardUrl;
      openDashLink.href = res.dashboardUrl;
    } else {
      dashUrlInput.value = 'http://localhost:3000';
      openDashLink.href = 'http://localhost:3000';
    }

    if (res && res.authToken) {
      authTokenInput.value = res.authToken;
    }

    renderAnonModeUI(Boolean(res?.soro_anon_mode));

    const currentStatus = res?.soro_sync_status || (res?.soro_quota_exhausted ? 'offline' : 'online');
    updateStatusDisplay(currentStatus, res?.soro_unsynced_count || 0, res?.soro_history_count || 0);
  });

  function renderAnonModeUI(enabled) {
    isAnonMode = enabled;
    if (anonModeBtn) {
      if (enabled) {
        anonModeBtn.textContent = 'ON';
        anonModeBtn.style.background = '#d97706';
        anonModeBtn.style.color = '#ffffff';
        anonModeBtn.style.borderColor = '#b45309';
      } else {
        anonModeBtn.textContent = 'OFF';
        anonModeBtn.style.background = '#334155';
        anonModeBtn.style.color = '#cbd5e1';
        anonModeBtn.style.borderColor = '#475569';
      }
    }
    if (anonModeSubtext) {
      anonModeSubtext.textContent = enabled ? 'Active: No snippets are saved' : 'No snippets are stored';
      anonModeSubtext.style.color = enabled ? '#fcd34d' : '#94a3b8';
    }
  }

  // Toggle Anon Mode
  anonModeBtn?.addEventListener('click', () => {
    const nextState = !isAnonMode;
    browserAPI.storage.local.set({ soro_anon_mode: nextState }, () => {
      renderAnonModeUI(nextState);
      if (activeTabId && isXComTab) {
        browserAPI.tabs.sendMessage(activeTabId, { type: 'SET_ANON_MODE', enabled: nextState });
      }
      showImportFeedback(
        nextState 
          ? '<strong>🕶️ Anon Mode Enabled</strong><br>Extraction & storage paused. Zero snippets will be saved.'
          : '<strong>Anon Mode Disabled</strong><br>Snippets will be stored normally.',
        nextState ? 'info' : 'success'
      );
    });
  });

  // Clear Session
  clearSessionBtn?.addEventListener('click', () => {
    if (!confirm('Clear all snippets stored in the current session?')) return;

    browserAPI.storage.local.set({
      soro_history_json: [],
      soro_history_count: 0,
      soro_unsynced_count: 0,
      soro_synced_ids: []
    }, () => {
      if (activeTabId && isXComTab) {
        browserAPI.tabs.sendMessage(activeTabId, { type: 'CLEAR_SESSION' });
      }
      updateStatusDisplay('online', 0, 0);
      showImportFeedback('<strong>✓ Session Cleared</strong><br>All snippets stored in current session have been cleared.', 'success');
    });
  });

  // Save changes to URL
  dashUrlInput.addEventListener('change', () => {
    const val = dashUrlInput.value.trim().replace(/\/+$/, '');
    browserAPI.storage.local.set({ dashboardUrl: val });
    openDashLink.href = val;
  });

  // Save changes to Auth Token
  authTokenInput.addEventListener('change', () => {
    const val = authTokenInput.value.trim();
    browserAPI.storage.local.set({ authToken: val });
  });

  // Check active tab
  browserAPI.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs || !tabs[0]) return;
    const tab = tabs[0];
    activeTabId = tab.id;
    const url = tab.url || '';

    function isAllowedHistoryUrl(urlStr) {
      try {
        const parsed = new URL(urlStr);
        const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
        if (host !== 'x.com' && host !== 'twitter.com') return false;
        const path = parsed.pathname.replace(/\/+$/, '').toLowerCase();
        return path === '/i/history' || path === '/i/history/likes';
      } catch {
        return false;
      }
    }

    if (isAllowedHistoryUrl(url)) {
      const isLikes = url.includes('/likes');
      tabStatusEl.textContent = isLikes ? 'History / Likes (Active)' : 'History Page (Active)';
      tabStatusEl.style.color = '#10b981';
      isXComTab = true;
      scanBtn.disabled = false;
      if (auditHistoryBtn) auditHistoryBtn.disabled = false;
      if (autoScrollBtn) autoScrollBtn.disabled = false;
      fetchTabStatus();
    } else if (url.includes('x.com') || url.includes('twitter.com')) {
      tabStatusEl.textContent = 'Standby (Active only on /i/history & /i/history/likes)';
      tabStatusEl.style.color = '#f59e0b';
      scanBtn.disabled = true;
      if (auditHistoryBtn) auditHistoryBtn.disabled = true;
      if (autoScrollBtn) autoScrollBtn.disabled = true;
      isXComTab = false;
    } else {
      tabStatusEl.textContent = 'Local JSON Mode (Not on History)';
      tabStatusEl.style.color = '#94a3b8';
      scanBtn.disabled = true;
      if (auditHistoryBtn) auditHistoryBtn.disabled = true;
      if (autoScrollBtn) autoScrollBtn.disabled = true;
      isXComTab = false;
    }
  });

  function fetchTabStatus() {
    if (!activeTabId || !isXComTab) return;
    browserAPI.tabs.sendMessage(activeTabId, { type: 'GET_STATUS' }, (res) => {
      if (browserAPI.runtime.lastError) {
        // Content script might not be injected yet
        return;
      }
      if (res) {
        updateStatusDisplay(res.syncStatus || 'online', res.unsyncedCount || 0, res.count || 0);
        if (autoScrollBtn) {
          autoScrollBtn.textContent = res.isAutoScrolling ? '⏹ Stop Scroll' : '⚡ Auto-Scroll';
          autoScrollBtn.style.background = res.isAutoScrolling ? '#78350f' : '';
        }
      }
    });
  }

  scanBtn.addEventListener('click', () => {
    if (!activeTabId || !isXComTab) return;
    scanBtn.textContent = 'Scanning...';
    browserAPI.tabs.sendMessage(activeTabId, { type: 'SCAN_PAGE' }, (res) => {
      scanBtn.textContent = 'Scan Current Viewport';
      fetchTabStatus();
    });
  });

  auditHistoryBtn?.addEventListener('click', () => {
    if (!activeTabId || !isXComTab) {
      showImportFeedback('Audit is available on x.com/i/history and x.com/i/history/likes. You can import JSON files anytime using "Import JSON".', 'info');
      return;
    }
    auditHistoryBtn.textContent = 'Auditing JSON...';
    browserAPI.tabs.sendMessage(activeTabId, { type: 'AUDIT_BOOKMARKS' }, (res) => {
      auditHistoryBtn.textContent = res ? `Checked (${res.alreadyPresentInJson || 0} in JSON)` : 'Audit History (JSON Check)';
      setTimeout(() => {
        if (auditHistoryBtn) auditHistoryBtn.textContent = 'Audit History (JSON Check)';
      }, 3000);
      fetchTabStatus();
    });
  });

  // Auto-scroll speed configuration
  browserAPI.storage.local.get(['autoScrollSpeed'], (res) => {
    if (res && res.autoScrollSpeed && scrollSpeedSelect) {
      scrollSpeedSelect.value = res.autoScrollSpeed;
    }
  });

  scrollSpeedSelect?.addEventListener('change', () => {
    const speed = scrollSpeedSelect.value;
    browserAPI.storage.local.set({ autoScrollSpeed: speed });
    if (activeTabId && isXComTab) {
      browserAPI.tabs.sendMessage(activeTabId, { type: 'SET_AUTO_SCROLL_SPEED', speed });
    }
  });

  autoScrollBtn?.addEventListener('click', () => {
    if (!activeTabId || !isXComTab) {
      showImportFeedback('Auto-Scroll is available when viewing X bookmarks or history (x.com).', 'info');
      return;
    }
    const speed = scrollSpeedSelect?.value || 'turbo';
    browserAPI.tabs.sendMessage(activeTabId, { type: 'TOGGLE_AUTO_SCROLL', speed }, (res) => {
      if (res && autoScrollBtn) {
        autoScrollBtn.textContent = res.isAutoScrolling ? '⏹ Stop Scroll' : '⚡ Auto-Scroll';
        autoScrollBtn.style.background = res.isAutoScrolling ? '#78350f' : '';
      }
    });
  });

  function resetSyncButtons() {
    if (syncBtn) {
      syncBtn.textContent = 'Manually Sync to SoroTrack';
      syncBtn.disabled = false;
    }
    if (promptSyncBtn) {
      promptSyncBtn.textContent = 'Manually Sync to Database';
      promptSyncBtn.disabled = false;
    }
  }

  function triggerManualSync() {
    if (syncBtn) {
      syncBtn.textContent = 'Syncing 1 Batch Query...';
      syncBtn.disabled = true;
    }
    if (promptSyncBtn) {
      promptSyncBtn.textContent = 'Syncing...';
      promptSyncBtn.disabled = true;
    }

    // 1. If currently on X.com active tab, use content script to sync
    if (activeTabId && isXComTab) {
      browserAPI.tabs.sendMessage(activeTabId, { type: 'SYNC_NOW' }, (res) => {
        resetSyncButtons();
        fetchTabStatus();
      });
      return;
    }

    // 2. Otherwise (e.g. user imported JSON while not on X.com), sync directly via background relay!
    browserAPI.storage.local.get([
      'soro_history_json',
      'soro_synced_ids',
      'dashboardUrl',
      'authToken'
    ], (res) => {
      const allRecords = Array.isArray(res?.soro_history_json) ? res.soro_history_json : [];
      const syncedIds = new Set(Array.isArray(res?.soro_synced_ids) ? res.soro_synced_ids : []);
      const unsyncedRecords = allRecords.filter(r => !syncedIds.has(r.id));
      const itemsToSync = unsyncedRecords.length > 0 ? unsyncedRecords : allRecords;

      if (itemsToSync.length === 0) {
        showImportFeedback('No records in local JSON storage to sync.', 'info');
        resetSyncButtons();
        return;
      }

      const targetEndpoint = (res?.dashboardUrl || dashUrlInput.value || 'http://localhost:3000').replace(/\/+$/, '') + '/api/sync';
      const token = res?.authToken || authTokenInput.value || '';

      browserAPI.runtime.sendMessage({
        type: 'SYNC_RECORDS',
        payload: {
          endpoint: targetEndpoint,
          authToken: token,
          records: itemsToSync,
          source: 'extension_popup_direct_sync',
          timestamp: new Date().toISOString()
        }
      }, (bgRes) => {
        resetSyncButtons();
        if (bgRes && bgRes.success) {
          const syncTimestamp = new Date().toISOString();
          itemsToSync.forEach(r => {
            syncedIds.add(r.id);
            r.syncedAt = syncTimestamp;
          });
          allRecords.forEach(r => {
            if (syncedIds.has(r.id)) {
              r.syncedAt = r.syncedAt || syncTimestamp;
            }
          });
          const updatedSyncedIds = Array.from(syncedIds);
          const remainingUnsynced = allRecords.length - updatedSyncedIds.length;
          browserAPI.storage.local.set({
            soro_history_json: allRecords,
            soro_synced_ids: updatedSyncedIds,
            soro_unsynced_count: remainingUnsynced,
            soro_sync_status: 'online',
            soro_last_sync_time: syncTimestamp
          }, () => {
            updateStatusDisplay('online', remainingUnsynced, allRecords.length);
            showImportFeedback(`✓ Successfully synced ${itemsToSync.length} records to SoroTrack database!`, 'success');
          });
        } else {
          const errMsg = bgRes?.error || 'Failed to connect to SoroTrack service. Please verify URL and Auth Token.';
          showImportFeedback(`⚠ Sync failed: ${errMsg}`, 'error');
        }
      });
    });
  }

  // Robust normalizer for imported JSON formats
  function normalizeImportedRecords(inputData) {
    let list = [];
    if (Array.isArray(inputData)) {
      list = inputData;
    } else if (inputData && typeof inputData === 'object') {
      if (Array.isArray(inputData.records)) list = inputData.records;
      else if (Array.isArray(inputData.bookmarks)) list = inputData.bookmarks;
      else if (Array.isArray(inputData.tweets)) list = inputData.tweets;
      else if (Array.isArray(inputData.data)) list = inputData.data;
      else if (Array.isArray(inputData.items)) list = inputData.items;
      else if (inputData.id || inputData.text || inputData.tweetUrl) list = [inputData];
    }

    const validRecords = [];
    const nowIso = new Date().toISOString();

    for (let i = 0; i < list.length; i++) {
      const raw = list[i];
      if (!raw || typeof raw !== 'object') continue;

      const item = raw.tweet ? raw.tweet : raw;

      let id = item.id || item.id_str || item.tweetId || item.tweet_id;
      if (!id && typeof item.tweetUrl === 'string') {
        const match = item.tweetUrl.match(/status\/(\d+)/);
        if (match) id = match[1];
      }
      if (!id && typeof item.url === 'string') {
        const match = item.url.match(/status\/(\d+)/);
        if (match) id = match[1];
      }
      if (!id) {
        const textSeed = (item.text || item.full_text || item.title || '') + (item.createdAt || item.created_at || '');
        if (!textSeed.trim()) continue;
        let hash = 0;
        for (let c = 0; c < textSeed.length; c++) {
          hash = (hash << 5) - hash + textSeed.charCodeAt(c);
          hash |= 0;
        }
        id = 'imp_' + Math.abs(hash).toString(36);
      }
      id = String(id);

      const text = (item.text || item.full_text || item.body || item.title || '').trim();
      if (!text && !item.tweetUrl && !item.url) continue;

      let tweetUrl = item.tweetUrl || item.url || '';
      if (!tweetUrl && /^\d+$/.test(id)) {
        const cleanHandle = item.authorHandle ? item.authorHandle.replace(/^@/, '') : 'i';
        tweetUrl = `https://x.com/${cleanHandle}/status/${id}`;
      }

      let authorName = item.authorName || item.author || item.user?.name || 'X User';
      let authorHandle = item.authorHandle || (item.user?.screen_name ? `@${item.user.screen_name}` : '@x_user');
      if (!authorHandle.startsWith('@')) authorHandle = `@${authorHandle}`;
      let authorAvatarUrl = item.authorAvatarUrl || item.authorAvatar || item.user?.profile_image_url_https || '';

      let createdAt = item.createdAt || item.created_at || nowIso;
      try {
        const d = new Date(createdAt);
        if (!isNaN(d.getTime())) createdAt = d.toISOString();
      } catch {
        createdAt = nowIso;
      }

      let links = [];
      if (Array.isArray(item.links)) {
        links = item.links.map(l => {
          if (typeof l === 'string') {
            try {
              const parsed = new URL(l);
              return { url: l, displayUrl: parsed.hostname, domain: parsed.hostname.replace(/^www\./, '') };
            } catch {
              return { url: l, displayUrl: l, domain: 'external' };
            }
          }
          return {
            url: l.url || '',
            displayUrl: l.displayUrl || l.url || '',
            domain: l.domain || (l.url ? new URL(l.url).hostname.replace(/^www\./, '') : ''),
            title: l.title,
            description: l.description
          };
        }).filter(l => l.url);
      } else if (item.entities?.urls && Array.isArray(item.entities.urls)) {
        links = item.entities.urls.map(u => {
          const expanded = u.expanded_url || u.url;
          try {
            const parsed = new URL(expanded);
            return { url: expanded, displayUrl: u.display_url || parsed.hostname, domain: parsed.hostname.replace(/^www\./, '') };
          } catch {
            return { url: expanded, displayUrl: expanded, domain: 'external' };
          }
        });
      }

      let media = [];
      if (Array.isArray(item.media)) {
        media = item.media;
      } else if (item.extended_entities?.media && Array.isArray(item.extended_entities.media)) {
        media = item.extended_entities.media.map(m => ({
          type: m.type === 'video' ? 'video' : 'image',
          url: m.media_url_https || m.media_url || m.url
        }));
      }

      let metrics = item.metrics || {};
      if (item.favorite_count !== undefined) metrics.likes = item.favorite_count;
      if (item.retweet_count !== undefined) metrics.retweets = item.retweet_count;
      if (item.reply_count !== undefined) metrics.replies = item.reply_count;

      let tags = Array.isArray(item.tags) ? [...item.tags] : [];
      if (tags.length === 0 && text) {
        const hashtagMatches = text.match(/#[\w\u0080-\uFFFF]+/g);
        if (hashtagMatches) {
          tags = hashtagMatches.map(h => h.replace(/^#/, ''));
        }
      }

      validRecords.push({
        id,
        tweetUrl,
        authorName,
        authorHandle,
        authorAvatarUrl,
        isVerified: Boolean(item.isVerified || item.user?.verified),
        text,
        createdAt,
        scannedAt: item.scannedAt || nowIso,
        syncedAt: item.syncedAt || item.scannedAt || nowIso,
        isBookmarked: Boolean(item.isBookmarked || item.tags?.includes('bookmark')),
        bookmarkedAt: item.bookmarkedAt,
        links,
        media,
        metrics,
        tags,
        labels: item.labels,
        sourcePage: item.sourcePage || 'extension_imported_json'
      });
    }

    return validRecords;
  }

  // Handle direct JSON import
  function handleImportJsonFile(file) {
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.json') && file.type !== 'application/json') {
      showImportFeedback('Please select a valid .json file.', 'error');
      return;
    }

    if (importJsonBtn) {
      importJsonBtn.textContent = 'Parsing JSON...';
      importJsonBtn.disabled = true;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const textContent = e.target.result;
        const parsed = JSON.parse(textContent);
        const normalizedItems = normalizeImportedRecords(parsed);

        if (normalizedItems.length === 0) {
          showImportFeedback('No valid tweet or bookmark records found in this JSON file.', 'error');
          if (importJsonBtn) {
            importJsonBtn.textContent = '📤 Import JSON';
            importJsonBtn.disabled = false;
          }
          return;
        }

        // Retrieve existing storage and merge
        browserAPI.storage.local.get([
          'soro_history_json',
          'soro_synced_ids'
        ], (stored) => {
          const existingList = Array.isArray(stored?.soro_history_json) ? stored.soro_history_json : [];
          const syncedIds = new Set(Array.isArray(stored?.soro_synced_ids) ? stored.soro_synced_ids : []);

          const knownIds = new Set(existingList.map(item => item.id));
          const knownUrls = new Set();
          existingList.forEach(item => {
            if (item.tweetUrl) {
              knownUrls.add(item.tweetUrl.toLowerCase().replace(/\/photo\/\d+/, '').replace(/\/analytics/, ''));
            }
          });

          let newlyAdded = 0;
          let alreadyExisting = 0;
          const mergedList = [...existingList];

          normalizedItems.forEach(item => {
            const normalizedUrl = item.tweetUrl ? item.tweetUrl.toLowerCase().replace(/\/photo\/\d+/, '').replace(/\/analytics/, '') : '';
            const exists = (item.id && knownIds.has(item.id)) || (normalizedUrl && knownUrls.has(normalizedUrl));

            if (!exists) {
              mergedList.push(item);
              knownIds.add(item.id);
              if (normalizedUrl) knownUrls.add(normalizedUrl);
              newlyAdded++;
            } else {
              alreadyExisting++;
            }
          });

          const unsyncedCount = mergedList.filter(item => !syncedIds.has(item.id)).length;

          // Save merged records into chrome.storage.local
          browserAPI.storage.local.set({
            soro_history_json: mergedList,
            soro_history_count: mergedList.length,
            soro_unsynced_count: unsyncedCount,
            soro_history_last_saved: new Date().toISOString()
          }, () => {
            if (importJsonBtn) {
              importJsonBtn.textContent = `✓ Imported (${newlyAdded})`;
              setTimeout(() => {
                if (importJsonBtn) {
                  importJsonBtn.textContent = '📤 Import JSON';
                  importJsonBtn.disabled = false;
                }
              }, 2500);
            }

            updateStatusDisplay('online', unsyncedCount, mergedList.length);

            // Forward to active tab content script if user is currently on X
            if (activeTabId && isXComTab) {
              browserAPI.tabs.sendMessage(activeTabId, {
                type: 'IMPORT_JSON',
                records: normalizedItems
              }, () => {
                fetchTabStatus();
              });
            }

            const feedbackMsg = `<strong>✓ Successfully imported ${newlyAdded} new records!</strong><br>` +
              `Total in local JSON: ${mergedList.length} (${alreadyExisting} duplicates skipped).<br>` +
              `<span style="color: #67e8f9;">Ready to audit or manually sync to SoroTrack.</span>`;
            showImportFeedback(feedbackMsg, 'success');
          });
        });
      } catch (parseErr) {
        showImportFeedback(`Failed to parse JSON file: ${parseErr.message || 'Syntax error'}`, 'error');
        if (importJsonBtn) {
          importJsonBtn.textContent = '📤 Import JSON';
          importJsonBtn.disabled = false;
        }
      }
    };

    reader.onerror = () => {
      showImportFeedback('Failed to read file from disk.', 'error');
      if (importJsonBtn) {
        importJsonBtn.textContent = '📤 Import JSON';
        importJsonBtn.disabled = false;
      }
    };

    reader.readAsText(file);
  }

  // File input trigger
  importJsonBtn?.addEventListener('click', () => {
    if (popupImportJsonInput) {
      popupImportJsonInput.value = '';
      popupImportJsonInput.click();
    }
  });

  popupImportJsonInput?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (file) {
      handleImportJsonFile(file);
    }
  });

  // Open Local Standalone Viewer in New Window
  const openLocalViewerBtn = document.getElementById('open-local-viewer-btn');
  openLocalViewerBtn?.addEventListener('click', () => {
    const viewerUrl = browserAPI.runtime.getURL('viewer.html');
    if (browserAPI.windows && browserAPI.windows.create) {
      browserAPI.windows.create({
        url: viewerUrl,
        type: 'normal',
        width: 1320,
        height: 880
      });
    } else if (browserAPI.tabs && browserAPI.tabs.create) {
      browserAPI.tabs.create({ url: viewerUrl });
    } else {
      window.open(viewerUrl, '_blank', 'width=1320,height=880,resizable=yes,scrollbars=yes');
    }
  });

  // Sync from DB to Local JSON
  const syncFromDbBtn = document.getElementById('sync-from-db-btn');
  syncFromDbBtn?.addEventListener('click', () => {
    if (syncFromDbBtn) {
      syncFromDbBtn.innerHTML = '<span>⏳</span><span>Fetching from DB...</span>';
      syncFromDbBtn.disabled = true;
    }

    browserAPI.storage.local.get(['dashboardUrl', 'authToken', 'soro_history_json', 'soro_synced_ids'], (res) => {
      const baseUrl = (res?.dashboardUrl || dashUrlInput?.value || 'http://localhost:3000').replace(/\/+$/, '');
      const token = res?.authToken || authTokenInput?.value || '';

      const targetEndpoint = `${baseUrl}/api/export/json`;

      fetch(targetEndpoint, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      })
        .then(response => {
          if (!response.ok) {
            throw new Error(`Server returned HTTP ${response.status}`);
          }
          return response.json();
        })
        .then(incoming => {
          const rawList = Array.isArray(incoming) ? incoming : (incoming.records || incoming.items || []);
          if (!Array.isArray(rawList) || rawList.length === 0) {
            showImportFeedback('Cloud DB currently has 0 archived records.', 'info');
            if (syncFromDbBtn) {
              syncFromDbBtn.innerHTML = '<span>☁️</span><span>Sync from DB (Update Local JSON)</span>';
              syncFromDbBtn.disabled = false;
            }
            return;
          }

          const existingRecords = res?.soro_history_json || [];
          const syncedSet = new Set(res?.soro_synced_ids || []);
          const map = new Map();
          existingRecords.forEach(r => map.set(r.id, r));

          let newCount = 0;
          const syncTimestamp = new Date().toISOString();

          rawList.forEach(item => {
            const normList = normalizeImportedRecords([item]);
            const norm = normList[0];
            if (norm) {
              norm.isSynced = true;
              if (!norm.syncedAt) norm.syncedAt = norm.scannedAt || norm.createdAt || syncTimestamp;
              if (!map.has(norm.id)) newCount++;
              map.set(norm.id, norm);
              syncedSet.add(norm.id);
            }
          });

          const mergedList = Array.from(map.values());
          const updatedSyncedIds = Array.from(syncedSet);
          const remainingUnsynced = Math.max(0, mergedList.length - updatedSyncedIds.length);

          browserAPI.storage.local.set({
            soro_history_json: mergedList,
            soro_synced_ids: updatedSyncedIds,
            soro_history_count: mergedList.length,
            soro_unsynced_count: remainingUnsynced,
            soro_sync_status: 'online',
            soro_last_sync_time: syncTimestamp
          }, () => {
            updateStatusDisplay('online', remainingUnsynced, mergedList.length);
            showImportFeedback(`✓ Synced from Cloud DB! Pulled ${rawList.length} records (${newCount} new, ${mergedList.length} total local JSON).`, 'success');
            if (syncFromDbBtn) {
              syncFromDbBtn.innerHTML = '<span>✓</span><span>Synced from DB</span>';
              setTimeout(() => {
                if (syncFromDbBtn) {
                  syncFromDbBtn.innerHTML = '<span>☁️</span><span>Sync from DB (Update Local JSON)</span>';
                  syncFromDbBtn.disabled = false;
                }
              }, 3000);
            }
          });
        })
        .catch(err => {
          showImportFeedback(`⚠ Failed to sync from DB: ${err.message || 'Check server URL'}`, 'error');
          if (syncFromDbBtn) {
            syncFromDbBtn.innerHTML = '<span>☁️</span><span>Sync from DB (Update Local JSON)</span>';
            syncFromDbBtn.disabled = false;
          }
        });
    });
  });

  function downloadJsonBlob(data, filename) {
    try {
      const jsonStr = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      return true;
    } catch (e) {
      console.error('Blob download failed', e);
      return false;
    }
  }

  function triggerDownloadJson() {
    const exportJsonBtn = document.getElementById('export-json-btn');
    const promptDownloadBtn = document.getElementById('prompt-download-btn');
    if (exportJsonBtn) exportJsonBtn.textContent = 'Generating JSON...';
    if (promptDownloadBtn) promptDownloadBtn.textContent = 'Generating...';

    // 1. First, check extension local storage for saved records
    browserAPI.storage.local.get(['soro_history_json'], (res) => {
      const records = res?.soro_history_json;
      const today = new Date().toISOString().slice(0, 10);

      if (Array.isArray(records) && records.length > 0) {
        downloadJsonBlob(records, `sorotrack_bookmarks_archive_${today}.json`);
        if (exportJsonBtn) exportJsonBtn.textContent = `✓ Exported (${records.length} items)`;
        if (promptDownloadBtn) promptDownloadBtn.textContent = `✓ Exported (${records.length})`;
        setTimeout(() => {
          if (exportJsonBtn) exportJsonBtn.textContent = '📥 Export JSON Archive';
          if (promptDownloadBtn) promptDownloadBtn.textContent = 'Export JSON Archive';
        }, 3000);
        return;
      }

      // 2. If storage in popup context returned empty or not yet loaded, try active tab
      if (activeTabId) {
        browserAPI.tabs.sendMessage(activeTabId, { type: 'EXPORT_JSON' }, (tabRes) => {
          if (exportJsonBtn) exportJsonBtn.textContent = '📥 Export JSON Archive';
          if (promptDownloadBtn) promptDownloadBtn.textContent = 'Export JSON Archive';
        });
        return;
      }

      // 3. Fallback: trigger download from SoroTrack dashboard export route
      const dashUrl = (dashUrlInput.value || 'http://localhost:3000').replace(/\/+$/, '');
      browserAPI.tabs.create({ url: `${dashUrl}/api/export/json` });
      if (exportJsonBtn) exportJsonBtn.textContent = '📥 Export JSON Archive';
      if (promptDownloadBtn) promptDownloadBtn.textContent = 'Export JSON Archive';
    });
  }

  syncBtn?.addEventListener('click', triggerManualSync);
  promptSyncBtn?.addEventListener('click', triggerManualSync);

  const exportJsonBtn = document.getElementById('export-json-btn');
  exportJsonBtn?.addEventListener('click', triggerDownloadJson);
  promptDownloadBtn?.addEventListener('click', triggerDownloadJson);

  openHistoryLikesBtn?.addEventListener('click', () => {
    browserAPI.tabs.create({ url: 'https://x.com/i/history/likes' });
  });

  openXBtn?.addEventListener('click', () => {
    browserAPI.tabs.create({ url: 'https://x.com/i/history' });
  });

  openDashLink.addEventListener('click', (e) => {
    e.preventDefault();
    browserAPI.tabs.create({ url: dashUrlInput.value || 'http://localhost:3000' });
  });
});
