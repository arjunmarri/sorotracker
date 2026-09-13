/**
 * SoroTrack Options page script
 * Compatible with Firefox & Chrome
 */

const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

document.addEventListener('DOMContentLoaded', () => {
  const dashboardUrlInput = document.getElementById('dashboardUrl');
  const authTokenInput = document.getElementById('authToken');
  const autoSyncInput = document.getElementById('autoSync');
  const syncIntervalSecInput = document.getElementById('syncIntervalSec');
  const saveBtn = document.getElementById('save-btn');
  const testBtn = document.getElementById('test-btn');
  const statusMsg = document.getElementById('status-msg');

  // Load current values
  browserAPI.storage.local.get(['dashboardUrl', 'authToken', 'autoSync', 'syncIntervalSec'], (res) => {
    if (res) {
      if (res.dashboardUrl) dashboardUrlInput.value = res.dashboardUrl;
      if (res.authToken) authTokenInput.value = res.authToken;
      if (typeof res.autoSync === 'boolean') {
        autoSyncInput.checked = res.autoSync;
      } else {
        autoSyncInput.checked = false;
      }
      if (res.syncIntervalSec) syncIntervalSecInput.value = res.syncIntervalSec;
    }
  });

  saveBtn.addEventListener('click', () => {
    const dashboardUrl = dashboardUrlInput.value.trim().replace(/\/+$/, '') || 'http://localhost:3000';
    const authToken = authTokenInput.value.trim();
    const autoSync = autoSyncInput.checked;
    const syncIntervalSec = parseInt(syncIntervalSecInput.value, 10) || 5;

    browserAPI.storage.local.set({
      dashboardUrl,
      authToken,
      autoSync,
      syncIntervalSec
    }, () => {
      statusMsg.style.color = '#10b981';
      statusMsg.textContent = 'Settings saved!';
      setTimeout(() => {
        statusMsg.textContent = '';
      }, 3000);
    });
  });

  testBtn?.addEventListener('click', async () => {
    const dashboardUrl = dashboardUrlInput.value.trim().replace(/\/+$/, '') || 'http://localhost:3000';
    const authToken = authTokenInput.value.trim();

    statusMsg.style.color = '#94a3b8';
    statusMsg.textContent = 'Testing connection...';

    try {
      // Test health first
      const healthRes = await fetch(`${dashboardUrl}/api/health`).catch(() => null);
      if (!healthRes || !healthRes.ok) {
        statusMsg.style.color = '#ef4444';
        statusMsg.textContent = `Error: Service at ${dashboardUrl} is unreachable.`;
        return;
      }

      // Test auth if token provided
      const verifyRes = await fetch(`${dashboardUrl}/api/auth/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
          'x-api-key': authToken
        },
        body: JSON.stringify({ token: authToken })
      }).catch(() => null);

      if (verifyRes && verifyRes.ok) {
        const verifyData = await verifyRes.json();
        if (verifyData.valid) {
          statusMsg.style.color = '#10b981';
          statusMsg.textContent = '✓ Connected and Authenticated successfully!';
        } else {
          statusMsg.style.color = '#f59e0b';
          statusMsg.textContent = 'Connected, but Auth Token is invalid.';
        }
      } else {
        statusMsg.style.color = '#10b981';
        statusMsg.textContent = '✓ Service reachable.';
      }
    } catch (err) {
      statusMsg.style.color = '#ef4444';
      statusMsg.textContent = `Connection failed: ${err.message}`;
    }
  });

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

  // Import Local JSON button handler
  const importLocalJsonBtn = document.getElementById('import-local-json-btn');
  const optionsImportJsonInput = document.getElementById('options-import-json-input');

  importLocalJsonBtn?.addEventListener('click', () => {
    if (optionsImportJsonInput) {
      optionsImportJsonInput.value = '';
      optionsImportJsonInput.click();
    }
  });

  optionsImportJsonInput?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (exportStatusMsg) exportStatusMsg.textContent = 'Reading and importing JSON file...';

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target.result;
        const parsed = JSON.parse(text);
        const normalized = normalizeImportedRecords(parsed);

        if (normalized.length === 0) {
          if (exportStatusMsg) exportStatusMsg.textContent = 'No valid tweet or bookmark records found in this JSON.';
          return;
        }

        browserAPI.storage.local.get(['soro_history_json', 'soro_synced_ids'], (res) => {
          const existing = Array.isArray(res?.soro_history_json) ? res.soro_history_json : [];
          const syncedIds = new Set(Array.isArray(res?.soro_synced_ids) ? res.soro_synced_ids : []);

          const knownIds = new Set(existing.map(r => r.id));
          const knownUrls = new Set();
          existing.forEach(r => {
            if (r.tweetUrl) {
              knownUrls.add(r.tweetUrl.toLowerCase().replace(/\/photo\/\d+/, '').replace(/\/analytics/, ''));
            }
          });

          let newlyAdded = 0;
          let duplicates = 0;
          const merged = [...existing];

          normalized.forEach(item => {
            const normUrl = item.tweetUrl ? item.tweetUrl.toLowerCase().replace(/\/photo\/\d+/, '').replace(/\/analytics/, '') : '';
            const exists = (item.id && knownIds.has(item.id)) || (normUrl && knownUrls.has(normUrl));

            if (!exists) {
              merged.push(item);
              knownIds.add(item.id);
              if (normUrl) knownUrls.add(normUrl);
              newlyAdded++;
            } else {
              duplicates++;
            }
          });

          const unsyncedCount = merged.filter(r => !syncedIds.has(r.id)).length;

          browserAPI.storage.local.set({
            soro_history_json: merged,
            soro_history_count: merged.length,
            soro_unsynced_count: unsyncedCount,
            soro_history_last_saved: new Date().toISOString()
          }, () => {
            if (exportStatusMsg) {
              exportStatusMsg.style.color = '#38bdf8';
              exportStatusMsg.textContent = `✓ Imported ${newlyAdded} new records! Total saved: ${merged.length} (${duplicates} skipped duplicates).`;
              setTimeout(() => { exportStatusMsg.textContent = ''; }, 6000);
            }
          });
        });
      } catch (err) {
        if (exportStatusMsg) {
          exportStatusMsg.style.color = '#ef4444';
          exportStatusMsg.textContent = `Import failed: ${err.message || 'Syntax error'}`;
        }
      }
    };
    reader.readAsText(file);
  });

  // Export Local JSON button handler
  const exportLocalJsonBtn = document.getElementById('export-local-json-btn');
  const exportStatusMsg = document.getElementById('export-status-msg');

  exportLocalJsonBtn?.addEventListener('click', () => {
    if (exportStatusMsg) exportStatusMsg.textContent = 'Reading local JSON storage...';

    browserAPI.storage.local.get(['soro_history_json'], (res) => {
      const records = res?.soro_history_json;
      if (Array.isArray(records) && records.length > 0) {
        try {
          const jsonStr = JSON.stringify(records, null, 2);
          const blob = new Blob([jsonStr], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          const today = new Date().toISOString().slice(0, 10);
          a.href = url;
          a.download = `sorotrack_local_archive_${today}.json`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          setTimeout(() => URL.revokeObjectURL(url), 1000);

          if (exportStatusMsg) {
            exportStatusMsg.textContent = `✓ Successfully exported ${records.length} records to JSON!`;
            setTimeout(() => { exportStatusMsg.textContent = ''; }, 4000);
          }
        } catch (e) {
          if (exportStatusMsg) exportStatusMsg.textContent = `Export error: ${e.message}`;
        }
      } else {
        if (exportStatusMsg) {
          exportStatusMsg.textContent = 'No records in extension local storage yet. Scan bookmarks on x.com first.';
          setTimeout(() => { exportStatusMsg.textContent = ''; }, 4000);
        }
      }
    });
  });

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
});
