/**
 * SoroTrack Content Script
 * High-Performance, Non-Blocking Extractor for X (x.com/i/history and bookmarks)
 * Optimized for Firefox (Gecko) & Chromium (V8)
 */

(function () {
  'use strict';

  // Prevent multiple injections
  if (window.__SORO_HISTORY_LOADED__) return;
  window.__SORO_HISTORY_LOADED__ = true;

  const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

  // Configuration
  let config = {
    dashboardUrl: 'http://localhost:3000',
    authToken: '',
    soro_user: null,
    autoSync: false, // Auto-sync permanently disabled for bookmarks to preserve database daily quota
    syncIntervalSec: 5
  };

  // State & Quota Management
  const SYNC_THRESHOLD = 1000;
  const scannedRecords = new Map();
  const syncedRecordIds = new Set();
  let syncStatus = 'online'; // 'online' | 'offline' | 'syncing'
  let isQuotaExhausted = false;
  let isAnonMode = false;
  let lastSyncError = '';
  let isAutoScrolling = false;
  let autoScrollTimer = null;
  let autoScrollSpeed = 'turbo'; // 'fast' | 'turbo' | 'ultra'
  const AUTO_SCROLL_SETTINGS = {
    fast: { step: 1000, interval: 700, label: 'Fast (1x)' },
    turbo: { step: 1600, interval: 450, label: 'Turbo (2x)' },
    ultra: { step: 2500, interval: 300, label: 'Ultra (3x)' }
  };
  let isSyncing = false;
  let hudShadowRoot = null;
  let debounceScanTimer = null;
  let observer = null;
  let isScanning = false;

  /**
   * Strict URL validator:
   * Only scans https://x.com/i/history and https://x.com/i/history/likes
   * Explicitly disallows https://x.com/home, /bookmarks, /notifications, /status/*, etc.
   */
  function isAllowedHistoryPage(urlStr) {
    try {
      const url = new URL(urlStr || window.location.href);
      const host = url.hostname.toLowerCase().replace(/^www\./, '');
      if (host !== 'x.com' && host !== 'twitter.com') {
        return false;
      }
      const pathname = url.pathname.replace(/\/+$/, '').toLowerCase();
      return pathname === '/i/history' || pathname === '/i/history/likes';
    } catch (e) {
      return false;
    }
  }

  // Load config and existing JSON storage safely
  function loadConfig() {
    try {
      if (browserAPI?.storage?.local?.get) {
        browserAPI.storage.local.get([
          'dashboardUrl',
          'authToken',
          'soro_user',
          'autoScrollSpeed',
          'autoSync',
          'syncIntervalSec',
          'soro_history_json',
          'soro_synced_ids',
          'soro_sync_status',
          'soro_quota_exhausted',
          'soro_anon_mode'
        ], (res) => {
          if (res && res.dashboardUrl) {
            config.dashboardUrl = res.dashboardUrl.replace(/\/+$/, '');
          }
          if (res && typeof res.authToken === 'string') {
            config.authToken = res.authToken.trim();
          }
          if (res && res.soro_user) {
            config.soro_user = res.soro_user;
          }
          if (res && res.autoScrollSpeed && AUTO_SCROLL_SETTINGS[res.autoScrollSpeed]) {
            autoScrollSpeed = res.autoScrollSpeed;
          }
          if (res && typeof res.soro_anon_mode === 'boolean') {
            isAnonMode = res.soro_anon_mode;
          }
          // Enforce manual sync mode to protect collection write limits
          config.autoSync = false;
          if (res && res.soro_sync_status) {
            syncStatus = res.soro_sync_status;
          }
          if (res && typeof res.soro_quota_exhausted === 'boolean') {
            isQuotaExhausted = res.soro_quota_exhausted;
          }

          // Restore list of IDs already synced to avoid duplicate repeated queries
          if (res && Array.isArray(res.soro_synced_ids)) {
            res.soro_synced_ids.forEach(id => {
              if (id) syncedRecordIds.add(id);
            });
          }

          // Restore local JSON records
          if (res && Array.isArray(res.soro_history_json)) {
            res.soro_history_json.forEach(item => {
              if (item && item.id && !scannedRecords.has(item.id)) {
                scannedRecords.set(item.id, item);
              }
            });
          }
          updateHud();

          // If first install or local history is empty, request background bootstrap sync
          if (!res?.soro_history_json || res.soro_history_json.length === 0) {
            if (browserAPI?.runtime?.sendMessage) {
              browserAPI.runtime.sendMessage({ type: 'BOOTSTRAP_SYNC' }, (bgRes) => {
                if (bgRes && bgRes.success && (bgRes.totalDownloaded > 0 || bgRes.localTotal > 0)) {
                  setTimeout(loadConfig, 600);
                }
              });
            }
          }

          // Check if there are pending unsynced records in JSON and notify user
          notifyPendingJsonRecordsOnLoad();
        });
      }
    } catch (e) {
      // Storage access may be restricted in sandboxed iframes; gracefully ignore
    }
  }

  // Notify user on load if unsynced records exist in local JSON storage without making DB calls
  function notifyPendingJsonRecordsOnLoad() {
    setTimeout(() => {
      const allItems = Array.from(scannedRecords.values());
      const unsyncedCount = allItems.filter(item => !syncedRecordIds.has(item.id)).length;
      if (unsyncedCount > 0) {
        updateHud();
      }
    }, 1500);
  }

  // Persist current records to extension local JSON storage
  function persistRecordsToJsonStorage() {
    try {
      const items = Array.from(scannedRecords.values());
      const syncedIds = Array.from(syncedRecordIds);
      if (browserAPI?.storage?.local?.set) {
        browserAPI.storage.local.set({
          soro_history_json: items,
          soro_synced_ids: syncedIds,
          soro_history_count: items.length,
          soro_unsynced_count: items.length - syncedIds.length,
          soro_sync_status: syncStatus,
          soro_quota_exhausted: isQuotaExhausted,
          soro_history_last_saved: new Date().toISOString()
        });
      }
    } catch (e) {
      // Ignore storage errors
    }
  }

  // Download all scanned records as a JSON file directly from the browser
  function exportJsonArchive() {
    const items = Array.from(scannedRecords.values());
    if (items.length === 0) {
      showToast('No records scanned yet to export.');
      return;
    }

    try {
      const jsonStr = JSON.stringify(items, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sorotrack_archive_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast(`Exported ${items.length} records to JSON file!`);
    } catch (err) {
      showToast('Error generating JSON download.');
    }
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

  // Process and merge imported records into content script memory & JSON storage
  function importJsonRecords(rawItems) {
    const normalized = normalizeImportedRecords(rawItems);
    if (normalized.length === 0) {
      showToast('No valid records found in JSON file.');
      return { importedCount: 0, totalCount: scannedRecords.size, duplicates: 0 };
    }

    const existingIds = new Set(scannedRecords.keys());
    const existingUrls = new Set();
    scannedRecords.forEach(r => {
      if (r.tweetUrl) {
        existingUrls.add(r.tweetUrl.toLowerCase().replace(/\/photo\/\d+/, '').replace(/\/analytics/, ''));
      }
    });

    let newlyAdded = 0;
    let duplicates = 0;

    normalized.forEach(item => {
      const normUrl = item.tweetUrl ? item.tweetUrl.toLowerCase().replace(/\/photo\/\d+/, '').replace(/\/analytics/, '') : '';
      const exists = (item.id && existingIds.has(item.id)) || (normUrl && existingUrls.has(normUrl));

      if (!exists) {
        scannedRecords.set(item.id, item);
        existingIds.add(item.id);
        if (normUrl) existingUrls.add(normUrl);
        newlyAdded++;
      } else {
        duplicates++;
      }
    });

    if (newlyAdded > 0) {
      persistRecordsToJsonStorage();
      updateHud();
      promptUserToManualSync(newlyAdded, 'imported records');
    }

    showToast(`✓ Imported ${newlyAdded} new records (${duplicates} skipped duplicates). Total: ${scannedRecords.size}`, 4500);
    return { importedCount: newlyAdded, totalCount: scannedRecords.size, duplicates };
  }

  // Fast string hash
  function fastHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
    }
    return Math.abs(hash).toString(36);
  }

  // Safe domain extraction
  function extractDomain(url, fallback) {
    try {
      const u = new URL(url);
      if (u.hostname === 't.co' && fallback && fallback.includes('.')) {
        return fallback.replace(/^https?:\/\//, '').split('/')[0];
      }
      return u.hostname.replace(/^www\./, '');
    } catch (e) {
      return fallback || 'external';
    }
  }

  // Fast metric parser (uses textContent, zero reflow)
  function parseMetricText(str) {
    if (!str) return 0;
    const clean = str.trim().toUpperCase();
    if (clean.endsWith('K')) return Math.round(parseFloat(clean) * 1000);
    if (clean.endsWith('M')) return Math.round(parseFloat(clean) * 1000000);
    return parseInt(clean.replace(/[^\d]/g, ''), 10) || 0;
  }

  /**
   * Parse a single tweet article
   * CRITICAL PERFORMANCE FIX:
   * 1. Uses textContent instead of innerText to eliminate forced synchronous reflows in Firefox
   * 2. Eliminates article.cloneNode() and DOM cloning overhead
   * 3. Marks article element so it is never re-parsed during passive timeline scans
   * 4. Supports isBookmarkAction to immediately capture snippets when bookmark is clicked on any page
   */
  function parseTweetArticle(article, isBookmarkAction = false) {
    // In Anon Mode, no snippets are extracted or stored
    if (isAnonMode) {
      return null;
    }

    // For general timeline scanning, strictly verify allowed history page
    if (!isBookmarkAction && !isAllowedHistoryPage(window.location.href)) {
      return null;
    }

    // Avoid double processing during passive timeline scanning
    if (!isBookmarkAction && article.dataset.soroScanned === 'true') {
      return null;
    }
    article.dataset.soroScanned = 'true';

    try {
      // 1. Tweet permalink & ID
      let tweetUrl = '';
      let tweetId = '';
      let createdAt = new Date().toISOString();

      const timeEl = article.querySelector('time');
      if (timeEl) {
        createdAt = timeEl.getAttribute('datetime') || createdAt;
        const parentLink = timeEl.closest('a');
        if (parentLink && parentLink.href) {
          tweetUrl = parentLink.href;
          const match = tweetUrl.match(/status\/(\d+)/);
          if (match) tweetId = match[1];
        }
      }

      if (!tweetId) {
        const anyStatusLink = article.querySelector('a[href*="/status/"]');
        if (anyStatusLink && anyStatusLink.href) {
          tweetUrl = anyStatusLink.href;
          const match = tweetUrl.match(/status\/(\d+)/);
          if (match) tweetId = match[1];
        }
      }

      // 2. Tweet text
      let text = '';
      const textEl = article.querySelector('[data-testid="tweetText"]');
      if (textEl) {
        text = textEl.textContent.trim();
      } else {
        // Safe fallback without cloneNode
        text = (article.textContent || '').slice(0, 280).trim();
      }

      // If no ID found, derive synthetic ID from content
      if (!tweetId) {
        if (!text) return null;
        tweetId = 'syn_' + fastHash(text.slice(0, 60));
        tweetUrl = window.location.href;
      }

      // 3. Author details
      let authorName = 'Unknown User';
      let authorHandle = '@unknown';
      let authorAvatarUrl = '';
      let isVerified = false;

      const userNameContainer = article.querySelector('[data-testid="User-Name"]');
      if (userNameContainer) {
        const rawUserText = userNameContainer.textContent || '';
        const lines = rawUserText.split('\n').map(s => s.trim()).filter(Boolean);
        if (lines[0]) authorName = lines[0];

        const handleMatch = rawUserText.match(/@[\w_]+/);
        if (handleMatch) authorHandle = handleMatch[0];

        if (
          userNameContainer.querySelector('svg[data-testid*="verified"]') ||
          userNameContainer.querySelector('svg[aria-label*="Verified"]') ||
          userNameContainer.querySelector('svg[aria-label*="verified"]') ||
          userNameContainer.querySelector('[data-testid="icon-verified"]') ||
          userNameContainer.querySelector('svg path[d*="20.396 11"]')
        ) {
          isVerified = true;
        }
      }

      const avatarImg = article.querySelector('[data-testid="Tweet-User-Avatar"] img, img[src*="profile_images"]');
      if (avatarImg && avatarImg.src) {
        authorAvatarUrl = avatarImg.src;
      }

      // 4. External links & link cards
      const links = [];
      const linkUrlsSeen = new Set();

      if (textEl) {
        const anchors = textEl.querySelectorAll('a[href]');
        for (let i = 0; i < anchors.length; i++) {
          const a = anchors[i];
          const href = a.href;
          const displayText = a.textContent.trim();

          if (href && !href.startsWith('javascript:')) {
            const isInternal = href.includes('x.com/') || href.includes('twitter.com/');
            const isHashtag = displayText.startsWith('#');
            const isMention = displayText.startsWith('@');

            if (!isHashtag && !isMention) {
              const domain = extractDomain(href, displayText);
              if (!linkUrlsSeen.has(href)) {
                linkUrlsSeen.add(href);
                links.push({
                  url: href,
                  displayUrl: displayText || href,
                  domain: domain,
                  title: displayText
                });
              }
            }
          }
        }
      }

      // Link preview cards (external articles, news, videos)
      const cardWrapper = article.querySelector('[data-testid="card.wrapper"], [data-testid="card.layoutLarge.detail"]');
      if (cardWrapper) {
        const cardLink = cardWrapper.closest('a') || cardWrapper.querySelector('a[href]');
        if (cardLink && cardLink.href) {
          const href = cardLink.href;
          if (!linkUrlsSeen.has(href)) {
            linkUrlsSeen.add(href);
            const cardLines = (cardWrapper.textContent || '').split('\n').map(s => s.trim()).filter(Boolean);
            const domain = extractDomain(href, cardLines[0] || '');
            links.push({
              url: href,
              displayUrl: cardLines[0] || href,
              domain: domain,
              title: cardLines[1] || cardLines[0] || 'External Link',
              description: cardLines[2] || ''
            });
          }
        }
      }

      // 5. Media (images)
      const media = [];
      const images = article.querySelectorAll('[data-testid="tweetPhoto"] img');
      for (let i = 0; i < images.length; i++) {
        const img = images[i];
        if (img.src && !img.src.includes('profile_images')) {
          media.push({
            type: 'image',
            url: img.src,
            previewUrl: img.src
          });
        }
      }

      // 6. Metrics (using textContent for speed)
      const metrics = {};
      const replyEl = article.querySelector('[data-testid="reply"]');
      if (replyEl) metrics.replies = parseMetricText(replyEl.textContent);

      const retweetEl = article.querySelector('[data-testid="retweet"]');
      if (retweetEl) metrics.retweets = parseMetricText(retweetEl.textContent);

      const likeEl = article.querySelector('[data-testid="like"]');
      if (likeEl) metrics.likes = parseMetricText(likeEl.textContent);

      const bookmarkEl = article.querySelector('[data-testid="bookmark"]');
      if (bookmarkEl) metrics.bookmarks = parseMetricText(bookmarkEl.textContent);

      const viewsLink = article.querySelector('a[href*="/analytics"]');
      if (viewsLink) metrics.views = viewsLink.textContent.trim();

      // 7. Tags
      const tags = [];
      const hashtagMatches = text.match(/#[\w\u0080-\uFFFF]+/g);
      if (hashtagMatches) {
        for (let i = 0; i < hashtagMatches.length; i++) {
          tags.push(hashtagMatches[i].replace(/^#/, ''));
        }
      }

      if (!isBookmarkAction && !isAllowedHistoryPage(window.location.href)) {
        return null;
      }

      let canonicalSourcePage = window.location.href;
      if (isAllowedHistoryPage(window.location.href)) {
        canonicalSourcePage = window.location.href.includes('/i/history/likes')
          ? 'https://x.com/i/history/likes'
          : 'https://x.com/i/history';
      }

      return {
        id: tweetId,
        tweetUrl: tweetUrl || `https://x.com/i/web/status/${tweetId}`,
        authorName,
        authorHandle,
        authorAvatarUrl,
        isVerified,
        text,
        createdAt,
        scannedAt: new Date().toISOString(),
        links,
        media,
        metrics,
        tags: isBookmarkAction && !tags.includes('bookmark') ? [...tags, 'bookmark'] : tags,
        isBookmarked: isBookmarkAction ? true : Boolean(metrics.bookmarks && metrics.bookmarks > 0),
        bookmarkedAt: isBookmarkAction ? new Date().toISOString() : undefined,
        sourcePage: canonicalSourcePage,
        userId: config.soro_user?.id || undefined,
        userEmail: config.soro_user?.email || undefined
      };
    } catch (err) {
      return null;
    }
  }

  /**
   * Scan articles currently in the DOM
   * Batched and cooperative so it never freezes Firefox
   */
  function scanPage() {
    if (isAnonMode) {
      if (isAutoScrolling) stopAutoScroll(false);
      showToast('🕶️ Anon Mode: Active (No snippets stored)', 2200);
      return { total: scannedRecords.size, newlyFound: 0, anonMode: true };
    }
    if (!isAllowedHistoryPage(window.location.href)) {
      if (isAutoScrolling) stopAutoScroll(false);
      return { total: scannedRecords.size, newlyFound: 0 };
    }
    if (isScanning) return { total: scannedRecords.size, newlyFound: 0 };
    isScanning = true;

    let newlyFound = 0;

    try {
      if (!isAllowedHistoryPage(window.location.href)) {
        return { total: scannedRecords.size, newlyFound: 0 };
      }

      const articles = document.querySelectorAll('article[data-testid="tweet"]');
      for (let i = 0; i < articles.length; i++) {
        // Continuous guard: stop immediately if SPA route changed while iterating
        if (!isAllowedHistoryPage(window.location.href)) {
          break;
        }

        const article = articles[i];
        // Fast skip if already scanned
        if (article.dataset.soroScanned === 'true') continue;

        const record = parseTweetArticle(article);
        if (record && !scannedRecords.has(record.id)) {
          scannedRecords.set(record.id, record);
          newlyFound++;
        }
      }
    } finally {
      isScanning = false;
    }

    if (newlyFound > 0) {
      persistRecordsToJsonStorage();
      updateHud();
      if (!isAutoScrolling) {
        promptUserToManualSync(newlyFound, 'posts');
      }
    }

    return { total: scannedRecords.size, newlyFound };
  }

  /**
   * Specifically audit bookmarks when user visits x.com/i/bookmarks:
   * 1. Checks if bookmarks are already present in local JSON (by tweetId or canonical URL).
   * 2. If already present: marks as cached in local JSON, preventing duplicate loading.
   * 3. If NOT present: extracts full data, loads into local JSON storage, and updates buffer.
   * 4. Reports statistics to the user in HUD and toast.
   * 5. Prompts user to manually sync to Firestore (no automatic calls to protect daily quota).
   */
  function auditAndScanBookmarks(isManual = false) {
    if (!isAllowedHistoryPage()) {
      if (isManual) showToast('Audit is only available on x.com/i/history and x.com/i/history/likes.');
      return { total: scannedRecords.size, newlyLoaded: 0, alreadyPresentInJson: 0 };
    }

    const articles = document.querySelectorAll('article[data-testid="tweet"]');
    if (articles.length === 0) {
      if (isManual) showToast('No history articles found in current view.');
      return { total: scannedRecords.size, newlyLoaded: 0, alreadyPresentInJson: 0 };
    }

    let alreadyPresentInJson = 0;
    let newlyLoaded = 0;

    // Quick lookup for canonical URLs and status IDs already in local JSON
    const knownIds = new Set(scannedRecords.keys());
    const knownUrls = new Set();
    scannedRecords.forEach(r => {
      if (r.tweetUrl) {
        knownUrls.add(r.tweetUrl.toLowerCase().replace(/\/photo\/\d+/, '').replace(/\/analytics/, ''));
      }
    });

    for (let i = 0; i < articles.length; i++) {
      const article = articles[i];

      // Quick probe of the article's tweet ID or permalink
      let candidateId = '';
      let candidateUrl = '';
      const timeLink = article.querySelector('time')?.closest('a') || article.querySelector('a[href*="/status/"]');
      if (timeLink && timeLink.href) {
        candidateUrl = timeLink.href;
        const match = candidateUrl.match(/status\/(\d+)/);
        if (match) candidateId = match[1];
      }

      const normalizedUrl = candidateUrl.toLowerCase().replace(/\/photo\/\d+/, '').replace(/\/analytics/, '');

      // Check if already present in local JSON storage
      const isAlreadyInJson = (candidateId && knownIds.has(candidateId)) || 
                              (candidateUrl && knownUrls.has(normalizedUrl));

      if (isAlreadyInJson) {
        // Already exists in local JSON - mark as processed and skip duplicate creation
        article.dataset.soroScanned = 'true';
        article.dataset.soroInJson = 'true';
        alreadyPresentInJson++;
      } else {
        // NOT present in local JSON - extract and load into local JSON storage!
        delete article.dataset.soroScanned;
        const record = parseTweetArticle(article);
        if (record && !scannedRecords.has(record.id)) {
          scannedRecords.set(record.id, record);
          knownIds.add(record.id);
          if (record.tweetUrl) {
            knownUrls.add(record.tweetUrl.toLowerCase().replace(/\/photo\/\d+/, '').replace(/\/analytics/, ''));
          }
          article.dataset.soroInJson = 'true';
          newlyLoaded++;
        }
      }
    }

    if (newlyLoaded > 0) {
      persistRecordsToJsonStorage();
      updateHud();
      promptUserToManualSync(newlyLoaded, 'posts');
    }

    const message = `History audit: ${alreadyPresentInJson} already in local JSON, ${newlyLoaded} new loaded.`;
    if (isManual || (newlyLoaded > 0 || alreadyPresentInJson > 0)) {
      showToast(message, 3500);
    }

    return { total: scannedRecords.size, newlyLoaded, alreadyPresentInJson };
  }

  // SPA Route Change Listener for X.com
  let lastCheckedHref = window.location.href;

  function handleRouteChange() {
    const currentHref = window.location.href;
    const isAllowed = isAllowedHistoryPage(currentHref);

    // Toggle HUD visibility: strictly hide HUD when on non-history pages (such as /home)
    const hudHost = document.getElementById('soro-history-hud-host');
    if (hudHost) {
      hudHost.style.display = isAllowed ? 'block' : 'none';
    }

    if (!isAllowed) {
      // Immediately cancel any active background actions when leaving history
      if (isAutoScrolling) {
        stopAutoScroll(false);
      }
      if (debounceScanTimer) {
        clearTimeout(debounceScanTimer);
        debounceScanTimer = null;
      }
      isScanning = false;
    }

    if (currentHref !== lastCheckedHref) {
      const wasAllowed = isAllowedHistoryPage(lastCheckedHref);
      lastCheckedHref = currentHref;

      if (!isAllowed) {
        // Navigated away to a non-history page (e.g. /home or tweet modal)
        if (isAutoScrolling) {
          stopAutoScroll(false);
        }
        if (debounceScanTimer) {
          clearTimeout(debounceScanTimer);
          debounceScanTimer = null;
        }
        isScanning = false;
      } else if (!wasAllowed) {
        // Navigated into an allowed history page (/i/history or /i/history/likes)
        updateHud();
        setTimeout(() => {
          if (isAllowedHistoryPage()) {
            scanPage();
          }
        }, 800);
      }
    }
  }

  // Intercept navigation on X.com
  // 1. Observe <title> mutations: In X.com's SPA, the document title updates synchronously on route transitions
  try {
    const titleEl = document.querySelector('title');
    if (titleEl) {
      const titleObserver = new MutationObserver(() => {
        handleRouteChange();
      });
      titleObserver.observe(titleEl, { childList: true, characterData: true, subtree: true });
    }
  } catch (e) {}

  // 2. Intercept history push/replace and browser popstate/hashchange
  try {
    const originalPushState = history.pushState;
    history.pushState = function(...args) {
      originalPushState.apply(this, args);
      handleRouteChange();
    };
    const originalReplaceState = history.replaceState;
    history.replaceState = function(...args) {
      originalReplaceState.apply(this, args);
      handleRouteChange();
    };
    window.addEventListener('popstate', handleRouteChange);
    window.addEventListener('hashchange', handleRouteChange);
    // Fast 100ms polling guarantees zero-lag transition handling across React Router updates
    setInterval(handleRouteChange, 100);
  } catch (e) {
    // fallback to interval
    setInterval(handleRouteChange, 150);
  }

  // Debounced scan trigger via requestIdleCallback or setTimeout
  function triggerDebouncedScan(delayMs = 1200) {
    if (!isAllowedHistoryPage(window.location.href)) {
      if (debounceScanTimer) {
        clearTimeout(debounceScanTimer);
        debounceScanTimer = null;
      }
      return;
    }
    if (debounceScanTimer) clearTimeout(debounceScanTimer);
    debounceScanTimer = setTimeout(() => {
      if (!isAllowedHistoryPage(window.location.href)) {
        debounceScanTimer = null;
        return;
      }
      if (typeof window.requestIdleCallback === 'function') {
        window.requestIdleCallback(() => {
          if (isAllowedHistoryPage(window.location.href)) scanPage();
        }, { timeout: 2000 });
      } else {
        if (isAllowedHistoryPage(window.location.href)) scanPage();
      }
      debounceScanTimer = null;
    }, delayMs);
  }

  // Prompt user to manually sync after new bookmarks/records are saved into local JSON
  function promptUserToManualSync(newCount, itemType = 'bookmarks') {
    const allItems = Array.from(scannedRecords.values());
    const unsyncedCount = allItems.filter(item => !syncedRecordIds.has(item.id)).length;
    
    // Auto-sync is explicitly disabled to protect Firestore daily quota limits
    showToast(`📁 Saved ${newCount} new ${itemType} to local JSON (${unsyncedCount} unsynced). Click 'Sync Now' to manually push to database.`, 4200);
    updateHud();
  }

  // Send records to the dashboard endpoint in ONE batch query exclusively upon manual user request
  async function syncToDashboard(forceAll = false) {
    if (isSyncing) return;

    // Differential sync: only send unsynced records to conserve Firestore daily quota
    const allItems = Array.from(scannedRecords.values());
    const unsyncedItems = allItems.filter(item => !syncedRecordIds.has(item.id));
    const items = forceAll ? allItems : unsyncedItems;
    const allLocalSnippetIds = Array.from(scannedRecords.keys());

    isSyncing = true;
    syncStatus = 'syncing';
    updateHud();

    const endpoint = `${config.dashboardUrl}/api/sync`;
    const syncTimestamp = new Date().toISOString();
    items.forEach(it => {
      it.syncedAt = it.syncedAt || syncTimestamp;
    });

    try {
      if (items.length > 0) {
        showToast(`Step 1: Sending ${items.length} local records to server...`);
      } else if (allLocalSnippetIds.length === 0) {
        showToast(`Initial Sync: Connecting to SoroTrack to download all snippets locally...`);
      } else {
        showToast(`Checking server for any missing snippet data...`);
      }

      let syncResult = null;
      let usedBackgroundRelay = false;

      // 1. Delegate network call to background script (avoids webpage CSP restrictions on x.com)
      if (browserAPI?.runtime?.sendMessage) {
        try {
          const bgResponse = await new Promise((resolve) => {
            browserAPI.runtime.sendMessage({
              type: 'SYNC_RECORDS',
              payload: {
                endpoint,
                authToken: config.authToken,
                records: items,
                clientSnippetIds: allLocalSnippetIds,
                source: window.location.href,
                timestamp: new Date().toISOString()
              }
            }, (res) => {
              if (browserAPI.runtime.lastError) {
                resolve({ success: false, runtimeError: browserAPI.runtime.lastError.message });
              } else {
                resolve(res);
              }
            });
          });

          if (bgResponse && bgResponse.success) {
            syncResult = bgResponse.result || bgResponse;
            usedBackgroundRelay = true;
          } else if (bgResponse && bgResponse.authError) {
            throw new Error('Authentication failed (401). Please check the Sync Auth Token in extension settings.');
          } else if (bgResponse && bgResponse.unreachable) {
            throw new Error(`Middleware service at ${config.dashboardUrl} is not reachable. Ensure the service is running and accessible.`);
          } else if (bgResponse && bgResponse.error) {
            throw new Error(bgResponse.error);
          }
        } catch (relayErr) {
          // If explicitly an auth or reachability error, throw immediately
          if (relayErr.message.includes('Authentication failed') || relayErr.message.includes('not reachable')) {
            throw relayErr;
          }
        }
      }

      // 2. Fallback to direct fetch if background relay wasn't active
      if (!usedBackgroundRelay) {
        const extVersion = (browserAPI?.runtime?.getManifest && browserAPI.runtime.getManifest().version) || '1.1.0';
        const headers = {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'x-extension-version': extVersion
        };
        if (config.authToken) {
          headers['Authorization'] = `Bearer ${config.authToken}`;
          headers['x-api-key'] = config.authToken;
        }
        if (config.soro_user) {
          if (config.soro_user.id) headers['x-user-id'] = config.soro_user.id;
          if (config.soro_user.email) headers['x-user-email'] = config.soro_user.email;
        }

        const response = await fetch(endpoint, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            records: items.map(r => ({
              ...r,
              userId: r.userId || config.soro_user?.id,
              userEmail: r.userEmail || config.soro_user?.email
            })),
            clientSnippetIds: allLocalSnippetIds,
            userId: config.soro_user?.id,
            userEmail: config.soro_user?.email,
            source: window.location.href,
            timestamp: new Date().toISOString()
          })
        });

        if (response.status === 401) {
          throw new Error('Authentication failed (401). Valid Sync Auth Token required.');
        }

        if (!response.ok) {
          throw new Error(`Server returned HTTP ${response.status}`);
        }

        syncResult = await response.json();
      }

      // Step 2: Ingest any already synced server snippets pushed to update local JSON
      const pushedServerRecords = Array.isArray(syncResult?.serverRecordsToPush)
        ? syncResult.serverRecordsToPush
        : (Array.isArray(syncResult?.step2?.serverRecordsToPush) ? syncResult.step2.serverRecordsToPush : []);

      let newlyAddedFromServer = 0;
      if (pushedServerRecords.length > 0) {
        pushedServerRecords.forEach(srvItem => {
          if (!srvItem || !srvItem.id) return;
          syncedRecordIds.add(srvItem.id);
          if (scannedRecords.has(srvItem.id)) {
            const existing = scannedRecords.get(srvItem.id);
            existing.syncedAt = srvItem.syncedAt || existing.syncedAt || syncTimestamp;
            if (srvItem.isBookmarked && !existing.isBookmarked) {
              existing.isBookmarked = true;
              existing.bookmarkedAt = srvItem.bookmarkedAt || syncTimestamp;
            }
          } else {
            scannedRecords.set(srvItem.id, {
              ...srvItem,
              syncedAt: srvItem.syncedAt || syncTimestamp
            });
            newlyAddedFromServer++;
          }
        });
      }

      // Check if Firestore daily write quota limit was encountered
      if (syncResult?.isQuotaExhausted) {
        isQuotaExhausted = true;
        syncStatus = 'offline';
        lastSyncError = 'Daily Firestore write quota reached (20k free tier). Data safely preserved in JSON.';
        showToast(`Offline: Daily Firestore write quota reached. ${items.length} records safely kept in local JSON.`, 5500);
      } else {
        // Success! Mark confirmed items as synced
        isQuotaExhausted = false;
        syncStatus = 'online';
        lastSyncError = '';
        items.forEach(it => {
          syncedRecordIds.add(it.id);
          const mem = scannedRecords.get(it.id);
          if (mem) mem.syncedAt = syncTimestamp;
        });

        if (newlyAddedFromServer > 0) {
          showToast(`✓ Sync Complete! Sent ${items.length} local snippets & updated local JSON with ${newlyAddedFromServer} server snippets.`, 4500);
        } else {
          showToast(`✓ Sync Complete! Server and local JSON are in sync (${scannedRecords.size} snippets).`, 4000);
        }
      }

      persistRecordsToJsonStorage();
    } catch (err) {
      syncStatus = 'offline';
      lastSyncError = err.message || 'Sync network unreachable';
      showToast(`Offline: Sync failed (${err.message || 'connection failed'}). Data safely kept in JSON.`, 5000);
      persistRecordsToJsonStorage();
    } finally {
      isSyncing = false;
      updateHud();
    }
  }

  // =========================================================================
  // AUTOMATIC BOOKMARK SNIPPET CAPTURE & DOM EVENT DETECTION (ON ANY X PAGE)
  // =========================================================================

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Floating notification toast visible on ANY page of X/Twitter
  function showBookmarkToast(message, type = 'success') {
    let toastEl = document.getElementById('soro-bookmark-notification');
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.id = 'soro-bookmark-notification';
      toastEl.setAttribute('data-soro-ignore', 'true');
      toastEl.style.cssText = [
        'position: fixed',
        'bottom: 24px',
        'left: 50%',
        'transform: translateX(-50%) translateY(100px)',
        'background: #0f172a',
        'color: #f8fafc',
        'border: 1px solid #334155',
        'border-radius: 9999px',
        'padding: 10px 20px',
        'font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        'font-size: 13px',
        'font-weight: 600',
        'box-shadow: 0 12px 28px rgba(0, 0, 0, 0.45), 0 4px 12px rgba(0, 0, 0, 0.3)',
        'z-index: 2147483647',
        'display: flex',
        'align-items: center',
        'gap: 10px',
        'opacity: 0',
        'transition: transform 0.28s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.25s ease',
        'pointer-events: none',
        'white-space: nowrap',
        'max-width: 90vw',
        'text-overflow: ellipsis',
        'overflow: hidden'
      ].join(';');
      document.body.appendChild(toastEl);
    }

    const icon = type === 'success' ? '🔖' : (type === 'warning' ? '🕶️' : '⏳');
    const borderColor = type === 'success' ? '#10b981' : (type === 'warning' ? '#f59e0b' : '#38bdf8');
    toastEl.style.borderColor = borderColor;
    toastEl.innerHTML = `<span style="font-size: 15px; line-height: 1;">${icon}</span> <span>${escapeHtml(message)}</span>`;

    requestAnimationFrame(() => {
      toastEl.style.opacity = '1';
      toastEl.style.transform = 'translateX(-50%) translateY(0)';
    });

    clearTimeout(toastEl._timer);
    toastEl._timer = setTimeout(() => {
      toastEl.style.opacity = '0';
      toastEl.style.transform = 'translateX(-50%) translateY(100px)';
    }, 3400);
  }

  // Detect whether a clicked DOM element corresponds to a bookmark action on X
  function detectBookmarkAction(target) {
    if (!target || !(target instanceof Element)) return null;

    // 1. Direct data-testid match
    const testIdEl = target.closest('[data-testid="bookmark"], [data-testid="removeBookmark"], [data-testid="bookmarkMenuItem"]');
    if (testIdEl) {
      return {
        element: testIdEl,
        isRemove: testIdEl.getAttribute('data-testid') === 'removeBookmark'
      };
    }

    // 2. Interactive elements (button, menuitem, a) with aria-label or text content containing Bookmark
    const interactiveEl = target.closest('button, [role="button"], [role="menuitem"], a');
    if (interactiveEl) {
      const aria = (interactiveEl.getAttribute('aria-label') || '').toLowerCase();
      const testId = (interactiveEl.getAttribute('data-testid') || '').toLowerCase();
      const text = (interactiveEl.textContent || '').trim().toLowerCase();

      if (
        testId.includes('bookmark') || 
        aria.includes('bookmark') || 
        text.includes('bookmark') || 
        text.includes('add tweet to bookmarks') || 
        text.includes('add post to bookmarks')
      ) {
        const isRemove = aria.includes('remove') || text.includes('remove');
        return {
          element: interactiveEl,
          isRemove
        };
      }
    }

    // 3. SVG icon check (in case target is a path/svg without aria attributes on button)
    const svg = target.closest('svg');
    if (svg) {
      const svgTestId = (svg.getAttribute('data-testid') || '').toLowerCase();
      const svgAria = (svg.getAttribute('aria-label') || '').toLowerCase();
      if (svgTestId.includes('bookmark') || svgAria.includes('bookmark')) {
        return {
          element: target.closest('button, [role="button"], [role="menuitem"]') || svg,
          isRemove: svgAria.includes('remove')
        };
      }
      const path = svg.querySelector('path');
      const pathD = path ? (path.getAttribute('d') || '') : '';
      // Twitter/X standard bookmark ribbon SVG paths
      if (pathD.includes('M19.498') || pathD.includes('M6.75 3h10.5') || pathD.includes('M17.5 3H6.5') || pathD.includes('20.498 3H3.5')) {
        return {
          element: target.closest('button, [role="button"], [role="menuitem"]') || svg,
          isRemove: false
        };
      }
    }

    return null;
  }

  // Track the most recently clicked/hovered tweet container (helps resolve caret dropdown menu portals)
  let lastInteractedTweetArticle = null;

  function handleTrackInteractedArticle(e) {
    if (e.target && e.target.nodeType === 1) {
      const article = e.target.closest('article[data-testid="tweet"]') || e.target.closest('article[role="article"]') || e.target.closest('article');
      if (article) {
        lastInteractedTweetArticle = article;
      }
    }
  }

  // Find the tweet article element corresponding to the bookmark action
  function findAssociatedTweetArticle(bookmarkBtn) {
    if (!bookmarkBtn) return null;

    // 1. Direct closest article container (normal tweet timelines, feeds, and threads)
    let article = bookmarkBtn.closest('article[data-testid="tweet"]') || 
                  bookmarkBtn.closest('article[role="article"]') || 
                  bookmarkBtn.closest('article');
    if (article) return article;

    // 2. If clicked from a dropdown menu portal, check the last interacted tweet
    if (lastInteractedTweetArticle && document.body.contains(lastInteractedTweetArticle)) {
      return lastInteractedTweetArticle;
    }

    // 3. Fallback: check closest cell container
    const cell = bookmarkBtn.closest('[data-testid="cellInnerDiv"]');
    if (cell) {
      const insideCell = cell.querySelector('article[data-testid="tweet"]') || cell.querySelector('article');
      if (insideCell) return insideCell;
    }

    // 4. On tweet status permalink page (/status/\d+), check primary tweet
    const isStatusPage = window.location.pathname.includes('/status/');
    if (isStatusPage) {
      const primary = document.querySelector('article[data-testid="tweet"]') || document.querySelector('article');
      if (primary) return primary;
    }

    return null;
  }

  // Prevent multiple executions on the same tweet in quick succession
  const recentBookmarkClicks = new Map();

  // Automatically sync a single bookmarked snippet to SoroTrack backend
  async function autoSyncBookmarkToSoroTrack(record) {
    const handle = record.authorHandle || record.authorName || 'Post';
    showBookmarkToast(`Saving bookmark snippet to SoroTrack...`, 'info');

    const endpoint = `${config.dashboardUrl}/api/sync`;
    const syncTimestamp = new Date().toISOString();
    record.syncedAt = syncTimestamp;
    let syncSuccess = false;
    let syncErrorMsg = '';

    // 1. Delegate network call to background script (avoids webpage CSP restrictions on x.com)
    if (browserAPI?.runtime?.sendMessage) {
      try {
        const bgResponse = await new Promise((resolve) => {
          browserAPI.runtime.sendMessage({
            type: 'SYNC_RECORDS',
            payload: {
              endpoint,
              authToken: config.authToken,
              records: [record],
              source: window.location.href,
              timestamp: new Date().toISOString()
            }
          }, (res) => {
            if (browserAPI.runtime.lastError) {
              resolve({ success: false, error: browserAPI.runtime.lastError.message });
            } else {
              resolve(res);
            }
          });
        });

        if (bgResponse && bgResponse.success) {
          syncSuccess = true;
        } else if (bgResponse && bgResponse.error) {
          syncErrorMsg = bgResponse.error;
        }
      } catch (e) {
        syncErrorMsg = e.message;
      }
    }

    // 2. Direct fetch fallback if background script didn't respond
    if (!syncSuccess) {
      try {
        const headers = {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        };
        if (config.authToken) {
          headers['Authorization'] = `Bearer ${config.authToken}`;
          headers['x-api-key'] = config.authToken;
        }

        const response = await fetch(endpoint, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            records: [record],
            source: window.location.href,
            timestamp: new Date().toISOString()
          })
        });

        if (response.ok) {
          syncSuccess = true;
        } else {
          syncErrorMsg = `HTTP ${response.status}`;
        }
      } catch (fetchErr) {
        syncErrorMsg = fetchErr.message;
      }
    }

    if (syncSuccess) {
      record.syncedAt = syncTimestamp;
      const mem = scannedRecords.get(record.id);
      if (mem) mem.syncedAt = syncTimestamp;
      syncedRecordIds.add(record.id);
      persistRecordsToJsonStorage();
      updateHud();
      showBookmarkToast(`✓ Added snippet to SoroTrack! (${handle})`, 'success');
    } else {
      persistRecordsToJsonStorage();
      updateHud();
      showBookmarkToast(`📁 Bookmark saved to local JSON (${handle}) [push offline]`, 'info');
    }
  }

  // Handle global bookmark click DOM event
  async function handleBookmarkClick(event) {
    try {
      const action = detectBookmarkAction(event.target);
      if (!action) return;

      // In Anon Mode, no snippets are extracted or stored
      if (isAnonMode) {
        showBookmarkToast('🕶️ Anon Mode: Active (Bookmark not stored)', 'warning');
        return;
      }

      const bookmarkBtn = action.element;
      const article = findAssociatedTweetArticle(bookmarkBtn);
      if (!article) {
        console.warn('[SoroTrack] Bookmark clicked but could not locate tweet article element.');
        return;
      }

      // Parse the tweet article immediately into a structured snippet record
      const record = parseTweetArticle(article, true);
      if (!record || !record.id) {
        return;
      }

      // Debounce rapid repeated clicks within 1.5 seconds for same tweet ID
      const now = Date.now();
      const lastClickTime = recentBookmarkClicks.get(record.id) || 0;
      if (now - lastClickTime < 1500) {
        return;
      }
      recentBookmarkClicks.set(record.id, now);

      // Save record to local JSON buffer
      scannedRecords.set(record.id, record);
      persistRecordsToJsonStorage();

      // Automatically sync snippet to SoroTrack
      await autoSyncBookmarkToSoroTrack(record);
    } catch (err) {
      console.error('[SoroTrack] Error handling bookmark click event:', err);
    }
  }

  // Register bookmark DOM event listeners immediately
  function initBookmarkEventListener() {
    document.addEventListener('pointerdown', handleTrackInteractedArticle, true);
    document.addEventListener('mouseenter', handleTrackInteractedArticle, true);
    document.addEventListener('click', handleBookmarkClick, true);
  }

  // High-performance Auto-Scroll configuration & execution
  function setAutoScrollSpeed(speed) {
    if (AUTO_SCROLL_SETTINGS[speed]) {
      autoScrollSpeed = speed;
      try {
        if (browserAPI?.storage?.local?.set) {
          browserAPI.storage.local.set({ autoScrollSpeed: speed });
        }
        localStorage.setItem('soro_auto_scroll_speed', speed);
      } catch {}
      if (isAutoScrolling) {
        stopAutoScroll(false);
        startAutoScroll();
      } else {
        updateHud();
      }
    }
  }

  function cycleAutoScrollSpeed() {
    const speeds = ['turbo', 'ultra', 'fast'];
    const nextIdx = (speeds.indexOf(autoScrollSpeed) + 1) % speeds.length;
    setAutoScrollSpeed(speeds[nextIdx]);
    const cfg = AUTO_SCROLL_SETTINGS[speeds[nextIdx]];
    showToast(`⚡ Auto-Scroll speed: ${cfg.label} (${cfg.step}px / ${cfg.interval}ms)`);
  }

  function toggleAutoScroll() {
    if (isAutoScrolling) {
      stopAutoScroll();
    } else {
      startAutoScroll();
    }
  }

  function startAutoScroll() {
    if (!isAllowedHistoryPage()) {
      showToast('Auto-scroll is only active on x.com/i/history and x.com/i/history/likes.');
      return;
    }
    isAutoScrolling = true;
    const cfg = AUTO_SCROLL_SETTINGS[autoScrollSpeed] || AUTO_SCROLL_SETTINGS.turbo;
    showToast(`⚡ High-Speed Auto-Scroll started [${cfg.label}]. Loading content rapidly...`);
    updateHud();

    let unchangedCount = 0;
    let prevHeight = document.documentElement.scrollHeight;
    let tickCount = 0;

    autoScrollTimer = setInterval(() => {
      if (!isAutoScrolling) return;
      if (!isAllowedHistoryPage()) {
        stopAutoScroll(false);
        return;
      }

      tickCount++;
      const curHeight = document.documentElement.scrollHeight;

      if (curHeight === prevHeight) {
        unchangedCount++;
        // Nudge X's infinite scroll / lazy-loader if network fetch stalled
        if (unchangedCount % 3 === 0) {
          window.scrollBy(0, -40);
          setTimeout(() => {
            window.scrollBy(0, cfg.step + 60);
            window.dispatchEvent(new Event('scroll'));
          }, 60);
        }

        if (unchangedCount > 20) { // ~9-10 seconds of stagnant height
          stopAutoScroll();
          showToast('Reached end of timeline or page idle.');
          return;
        }
      } else {
        unchangedCount = 0;
        prevHeight = curHeight;
      }

      // Fast, non-blocking scroll step
      window.scrollBy({ top: cfg.step, behavior: 'auto' });
      window.dispatchEvent(new Event('scroll'));

      // Continuous extraction: scan on every tick so newly virtualized DOM elements are immediately captured
      scanPage();
    }, cfg.interval);
  }

  function stopAutoScroll(notify = true) {
    isAutoScrolling = false;
    if (autoScrollTimer) {
      clearInterval(autoScrollTimer);
      autoScrollTimer = null;
    }
    updateHud();
    if (notify) {
      const allItems = Array.from(scannedRecords.values());
      const unsyncedCount = allItems.filter(item => !syncedRecordIds.has(item.id)).length;
      showToast(`Auto-scroll paused. Total: ${scannedRecords.size} items (${unsyncedCount} in JSON).`);
    }
  }

  /**
   * Injected HUD with Shadow DOM encapsulation
   * CRITICAL PERFORMANCE FIX:
   * Using Shadow DOM prevents any CSS leak or React hydration interference on X.com
   * Elements inside the shadow root are NEVER observed by our MutationObserver
   */
  function createHud() {
    if (document.getElementById('soro-history-hud-host')) return;

    const host = document.createElement('div');
    host.id = 'soro-history-hud-host';
    host.setAttribute('data-soro-ignore', 'true');
    host.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:2147483647;pointer-events:auto;';
    host.style.display = isAllowedHistoryPage() ? 'block' : 'none';

    const shadow = host.attachShadow({ mode: 'open' });
    hudShadowRoot = shadow;

    shadow.innerHTML = `
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .hud {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, sans-serif;
          font-size: 12px;
          line-height: 1.4;
          background: #111418;
          color: #E2DDD5;
          border: 1px solid #2D333B;
          border-radius: 12px;
          width: 256px;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
          overflow: hidden;
          transition: all 0.2s ease;
        }
        .hud-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 12px;
          background: #181C22;
          border-bottom: 1px solid #2D333B;
        }
        .title {
          display: flex;
          align-items: center;
          gap: 6px;
          font-weight: 600;
          font-size: 12px;
          color: #FFFFFF;
        }
        .dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          transition: all 0.2s ease;
        }
        .dot.online {
          background: #10B981;
          box-shadow: 0 0 6px #10B981;
        }
        .dot.offline {
          background: #F59E0B;
          box-shadow: 0 0 6px #F59E0B;
        }
        .dot.syncing {
          background: #38BDF8;
          box-shadow: 0 0 6px #38BDF8;
        }
        .dot.anon {
          background: #F59E0B;
          box-shadow: 0 0 6px #F59E0B;
        }
        .badge {
          font-size: 9px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          padding: 1px 5px;
          border-radius: 4px;
          margin-left: 2px;
        }
        .badge.online {
          background: #064E3B;
          color: #A7F3D0;
          border: 1px solid #059669;
        }
        .badge.offline {
          background: #78350F;
          color: #FDE68A;
          border: 1px solid #B45309;
        }
        .badge.syncing {
          background: #0C4A6E;
          color: #BAE6FD;
          border: 1px solid #0284C7;
        }
        .badge.anon {
          background: #78350F;
          color: #FDE68A;
          border: 1px solid #D97706;
        }
        .btn-min {
          background: transparent;
          border: none;
          color: #8B949E;
          cursor: pointer;
          font-size: 13px;
          padding: 2px 6px;
          border-radius: 4px;
        }
        .btn-min:hover { background: #2D333B; color: #FFF; }
        .hud-body { padding: 12px; }
        .status-banner {
          margin-bottom: 10px;
          padding: 6px 8px;
          border-radius: 6px;
          font-size: 10px;
          line-height: 1.35;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .status-banner.online {
          background: #0D241C;
          border: 1px solid #134E39;
          color: #6EE7B7;
        }
        .status-banner.offline {
          background: #271C10;
          border: 1px solid #78350F;
          color: #FCD34D;
        }
        .status-banner.syncing {
          background: #0E2838;
          border: 1px solid #0369A1;
          color: #7DD3FC;
        }
        .status-banner.anon {
          background: #271C10;
          border: 1px solid #B45309;
          color: #FDE68A;
        }
        .stats {
          display: flex;
          gap: 6px;
          margin-bottom: 10px;
        }
        .stat-box {
          flex: 1;
          background: #1A1F26;
          border: 1px solid #2D333B;
          border-radius: 6px;
          padding: 6px 4px;
          text-align: center;
        }
        .stat-val {
          display: block;
          font-size: 14px;
          font-weight: 700;
          color: #38BDF8;
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        }
        .stat-lbl {
          display: block;
          font-size: 9px;
          color: #8B949E;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-top: 2px;
        }
        .actions {
          display: flex;
          flex-direction: column;
          gap: 6px;
          margin-bottom: 10px;
        }
        .btn {
          width: 100%;
          padding: 7px 10px;
          border-radius: 6px;
          font-weight: 600;
          font-size: 11px;
          cursor: pointer;
          border: 1px solid transparent;
          transition: all 0.15s ease;
          text-align: center;
          font-family: inherit;
        }
        .btn-primary { background: #2563EB; color: #FFFFFF; }
        .btn-primary:hover { background: #1D4ED8; }
        .btn-secondary { background: #21262D; color: #C9D1D9; border-color: #30363D; }
        .btn-secondary:hover { background: #30363D; color: #FFFFFF; }
        .btn-secondary.active { background: #D97706; color: #FFFFFF; border-color: #B45309; }
        .btn-accent { background: #059669; color: #FFFFFF; }
        .btn-accent:hover { background: #047857; }
        .btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .sync-prompt-card {
          background: #182234;
          border: 1px solid #2563eb;
          border-radius: 8px;
          padding: 8px;
          margin-bottom: 10px;
          display: none;
        }
        .sync-prompt-card.show {
          display: block;
        }
        .sync-prompt-title {
          font-size: 11px;
          font-weight: 700;
          color: #38bdf8;
          display: flex;
          align-items: center;
          gap: 4px;
          margin-bottom: 4px;
        }
        .sync-prompt-text {
          font-size: 10.5px;
          color: #cbd5e1;
          line-height: 1.35;
          margin: 0 0 6px 0;
        }
        .sync-prompt-actions {
          display: flex;
          gap: 6px;
        }
        .btn-sm {
          padding: 5px 8px;
          font-size: 10.5px;
          flex: 1;
        }
        .footer {
          text-align: center;
          border-top: 1px solid #2D333B;
          padding-top: 8px;
        }
        .link {
          color: #38BDF8;
          text-decoration: none;
          font-size: 11px;
          font-weight: 500;
        }
        .link:hover { text-decoration: underline; }
        .toast {
          position: fixed;
          bottom: 20px;
          left: 50%;
          transform: translateX(-50%) translateY(80px);
          background: #0284C7;
          color: white;
          padding: 6px 14px;
          border-radius: 16px;
          font-size: 11px;
          font-weight: 500;
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
          transition: transform 0.2s ease, opacity 0.2s ease;
          opacity: 0;
          pointer-events: none;
          white-space: nowrap;
          z-index: 1000000;
        }
        .toast.show {
          transform: translateX(-50%) translateY(0);
          opacity: 1;
        }
      </style>
      <div class="hud">
        <div class="hud-header">
          <div class="title">
            <span id="status-dot" class="dot online"></span>
            <span>SoroTrack</span>
            <span id="status-badge" class="badge online">Online</span>
          </div>
          <button id="min-btn" class="btn-min" title="Minimize/Maximize">_</button>
        </div>
        <div id="body" class="hud-body">
          <!-- Proactive Upgrade Alert inside HUD -->
          <div id="hud-upgrade-card" style="display: none; background: #2a1b08; border: 1px solid #d97706; border-radius: 8px; padding: 8px; margin-bottom: 10px; font-size: 11px;">
            <div style="font-weight: 700; color: #fbbf24; display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
              <span style="display: flex; align-items: center; gap: 4px;">
                <span>🚀</span>
                <span>Upgrade: <strong id="hud-upgrade-tag">v1.2.0</strong></span>
              </span>
              <button id="hud-upgrade-close" style="background: transparent; border: none; color: #fbbf24; cursor: pointer; font-size: 12px; padding: 0 4px;" title="Dismiss">✕</button>
            </div>
            <div id="hud-upgrade-msg" style="color: #fde68a; font-size: 10px; margin-bottom: 6px; line-height: 1.3;">
              New version ready on SoroTrack. Upgrade for new features &amp; fixes.
            </div>
            <button id="hud-upgrade-btn" style="background: #f59e0b; color: #1c1917; font-weight: 700; border: none; border-radius: 4px; padding: 5px 8px; cursor: pointer; width: 100%; font-size: 10.5px;">
              ⬇ Download Upgrade (.zip)
            </button>
          </div>

          <div id="status-banner" class="status-banner online">
            <span>📁</span>
            <span>Manual Sync Mode · All saved to JSON</span>
          </div>

          <!-- Prompt Card shown when new bookmarks are buffered locally -->
          <div id="sync-prompt-card" class="sync-prompt-card">
            <div class="sync-prompt-title">
              <span>📁</span>
              <span>Manual Sync Prompt</span>
            </div>
            <p id="sync-prompt-desc" class="sync-prompt-text">
              New bookmarks saved locally to JSON. Auto-sync is disabled to protect database quota.
            </p>
            <div class="sync-prompt-actions">
              <button id="prompt-sync-btn" class="btn btn-accent btn-sm">Sync to DB</button>
              <button id="prompt-download-btn" class="btn btn-secondary btn-sm">Save JSON</button>
            </div>
          </div>

          <div class="stats">
            <div class="stat-box">
              <span id="stat-posts" class="stat-val">0</span>
              <span class="stat-lbl">Total</span>
            </div>
            <div class="stat-box">
              <span id="stat-buffered" class="stat-val">0</span>
              <span class="stat-lbl">In JSON</span>
            </div>
            <div class="stat-box">
              <span id="stat-links" class="stat-val">0</span>
              <span class="stat-lbl">Links</span>
            </div>
          </div>
          <div class="actions">
            <button id="scan-btn" class="btn btn-primary">Scan Visible</button>
            <button id="audit-history-btn" class="btn btn-secondary">Audit History (JSON)</button>
            <div style="display: flex; gap: 4px;">
              <button id="scroll-btn" class="btn btn-secondary" style="flex: 2.2;">⚡ Auto-Scroll</button>
              <button id="scroll-speed-btn" class="btn btn-secondary" style="flex: 1.8; font-size: 11px; padding: 6px 2px; font-weight: 600;" title="Click to cycle speed: Fast (1x) -> Turbo (2x) -> Ultra (3x)">Turbo (2x)</button>
            </div>
            <button id="sync-btn" class="btn btn-accent">Sync to SoroTrack</button>
            <button id="hud-open-local-viewer-btn" class="btn btn-secondary" style="border-color: #059669; color: #a7f3d0; background: #064e3b; font-weight: 700;" title="Open standalone local offline viewer in a new window">🪟 View Synced Data (New Window)</button>
            <div style="display: flex; gap: 4px;">
              <button id="import-json-btn" class="btn btn-secondary" style="flex: 1; border-color: #6366f1; color: #a5b4fc;">Import JSON</button>
              <button id="export-json-btn" class="btn btn-secondary" style="flex: 1; border-color: #0f766e; color: #5eead4;">Export JSON</button>
            </div>
            <div style="display: flex; gap: 4px;">
              <button id="hud-anon-btn" class="btn btn-secondary" style="flex: 1.1; font-size: 11px; padding: 6px 2px;" title="Anon Mode: When active, no snippets are stored">🕶️ Anon: <span id="hud-anon-val">OFF</span></button>
              <button id="hud-clear-session-btn" class="btn btn-secondary" style="flex: 1.1; font-size: 11px; padding: 6px 2px; border-color: #991b1b; color: #fca5a5; background: #261114;" title="Clear all snippets stored in current session">🗑️ Clear Session</button>
            </div>
            <input type="file" id="hud-import-json-input" accept=".json,application/json" style="display: none;">
          </div>
          <div class="footer">
            <a id="dash-link" href="${config.dashboardUrl}" target="_blank" class="link">
              Open SoroTrack &rarr;
            </a>
          </div>
        </div>
      </div>
      <div id="toast" class="toast"></div>
    `;

    document.documentElement.appendChild(host);

    // Event handlers inside Shadow DOM
    shadow.getElementById('scan-btn')?.addEventListener('click', () => {
      const res = scanPage();
      showToast(`Scanned ${res.total} posts (+${res.newlyFound} new)`);
    });

    shadow.getElementById('audit-history-btn')?.addEventListener('click', () => {
      auditAndScanBookmarks(true);
    });

    shadow.getElementById('scroll-btn')?.addEventListener('click', () => {
      toggleAutoScroll();
    });

    shadow.getElementById('scroll-speed-btn')?.addEventListener('click', () => {
      cycleAutoScrollSpeed();
    });

    shadow.getElementById('sync-btn')?.addEventListener('click', () => {
      confirmAndManualSync();
    });

    shadow.getElementById('hud-open-local-viewer-btn')?.addEventListener('click', () => {
      try {
        if (browserAPI?.runtime?.getURL) {
          const viewerUrl = browserAPI.runtime.getURL('viewer.html');
          window.open(viewerUrl, '_blank', 'width=1320,height=880,resizable=yes,scrollbars=yes');
        } else {
          window.open(`${config.dashboardUrl}/viewer.html`, '_blank', 'width=1320,height=880,resizable=yes,scrollbars=yes');
        }
      } catch (err) {
        window.open(`${config.dashboardUrl}/viewer.html`, '_blank', 'width=1320,height=880,resizable=yes,scrollbars=yes');
      }
    });

    shadow.getElementById('prompt-sync-btn')?.addEventListener('click', () => {
      confirmAndManualSync();
    });

    shadow.getElementById('prompt-download-btn')?.addEventListener('click', () => {
      exportJsonArchive();
    });

    shadow.getElementById('export-json-btn')?.addEventListener('click', () => {
      exportJsonArchive();
    });

    const importBtn = shadow.getElementById('import-json-btn');
    const importInput = shadow.getElementById('hud-import-json-input');

    importBtn?.addEventListener('click', () => {
      if (importInput) {
        importInput.value = '';
        importInput.click();
      }
    });

    importInput?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const parsed = JSON.parse(event.target.result);
          importJsonRecords(parsed);
        } catch (err) {
          showToast(`JSON Parse Error: ${err.message}`);
        }
      };
      reader.readAsText(file);
    });

    // Anon Mode HUD toggle
    shadow.getElementById('hud-anon-btn')?.addEventListener('click', () => {
      toggleAnonMode();
    });

    // Clear Session HUD button
    shadow.getElementById('hud-clear-session-btn')?.addEventListener('click', () => {
      const count = scannedRecords.size;
      const confirmed = window.confirm(
        `Clear Session Snippets?\n\n` +
        `This will clear all ${count} snippet(s) currently stored in this session's buffer and reset session history.`
      );
      if (confirmed) {
        clearSession();
      }
    });

    const minBtn = shadow.getElementById('min-btn');
    const bodyEl = shadow.getElementById('body');
    minBtn?.addEventListener('click', () => {
      if (bodyEl) {
        const isHidden = bodyEl.style.display === 'none';
        bodyEl.style.display = isHidden ? 'block' : 'none';
        minBtn.textContent = isHidden ? '_' : '+';
      }
    });

    // Upgrade Alert Listeners
    const hudUpgradeCard = shadow.getElementById('hud-upgrade-card');
    const hudUpgradeClose = shadow.getElementById('hud-upgrade-close');
    const hudUpgradeBtn = shadow.getElementById('hud-upgrade-btn');
    const hudUpgradeTag = shadow.getElementById('hud-upgrade-tag');
    const hudUpgradeMsg = shadow.getElementById('hud-upgrade-msg');

    hudUpgradeClose?.addEventListener('click', () => {
      if (hudUpgradeCard) hudUpgradeCard.style.display = 'none';
    });

    hudUpgradeBtn?.addEventListener('click', () => {
      if (browserAPI?.runtime?.sendMessage) {
        browserAPI.runtime.sendMessage({ type: 'DOWNLOAD_UPGRADE' });
        showToast('Initiating upgrade download from SoroTrack...');
      }
    });

    // Proactively check version on HUD creation
    if (browserAPI?.runtime?.sendMessage) {
      browserAPI.runtime.sendMessage({ type: 'CHECK_VERSION' }, (res) => {
        if (res && res.success && res.isOutdated) {
          if (hudUpgradeCard) hudUpgradeCard.style.display = 'block';
          if (hudUpgradeTag) hudUpgradeTag.textContent = `v${res.latestVersion}`;
          if (hudUpgradeMsg && res.releaseNotes) hudUpgradeMsg.textContent = res.releaseNotes;
        }
      });
    }

    updateHud();
  }

  // Anon mode controller
  function setAnonMode(enabled) {
    isAnonMode = Boolean(enabled);
    try {
      if (browserAPI?.storage?.local?.set) {
        browserAPI.storage.local.set({ soro_anon_mode: isAnonMode });
      }
    } catch (e) {}
    updateHud();
    showToast(isAnonMode ? '🕶️ Anon Mode: Active (No snippets stored)' : 'Anon Mode: Disabled (Snippets saved normally)');
  }

  function toggleAnonMode() {
    setAnonMode(!isAnonMode);
  }

  // Clear Session controller
  function clearSession() {
    const priorCount = scannedRecords.size;
    scannedRecords.clear();
    syncedRecordIds.clear();

    // Remove data-soro-scanned attribute from all tweet elements so they can be re-scanned later if desired
    try {
      const articles = document.querySelectorAll('article[data-testid="tweet"]');
      articles.forEach(article => {
        delete article.dataset.soroScanned;
        article.removeAttribute('data-soro-scanned');
      });
    } catch (e) {}

    // Reset local JSON storage
    try {
      if (browserAPI?.storage?.local?.set) {
        browserAPI.storage.local.set({
          soro_history_json: [],
          soro_synced_ids: [],
          soro_history_count: 0,
          soro_unsynced_count: 0,
          soro_history_last_saved: new Date().toISOString()
        });
      }
    } catch (e) {}

    updateHud();
    showToast(`✓ Session Cleared: Removed ${priorCount} snippet(s)`, 3000);
  }

  // Confirm and trigger manual sync
  function confirmAndManualSync() {
    const allItems = Array.from(scannedRecords.values());
    const unsyncedItems = allItems.filter(item => !syncedRecordIds.has(item.id));
    if (unsyncedItems.length === 0) {
      showToast('All scanned bookmarks and posts are already synced.');
      return;
    }
    const confirmed = window.confirm(
      `SoroTrack Manual Sync:\n\n` +
      `Push ${unsyncedItems.length} records from local JSON buffer to Google Cloud Firestore?\n\n` +
      `This will execute 1 single batch query to preserve your collection daily write limit.`
    );
    if (confirmed) {
      syncToDashboard(true);
    }
  }

  function updateHud() {
    if (!hudShadowRoot) return;

    const dotEl = hudShadowRoot.getElementById('status-dot');
    const badgeEl = hudShadowRoot.getElementById('status-badge');
    const bannerEl = hudShadowRoot.getElementById('status-banner');
    const promptCardEl = hudShadowRoot.getElementById('sync-prompt-card');
    const promptDescEl = hudShadowRoot.getElementById('sync-prompt-desc');
    const postsEl = hudShadowRoot.getElementById('stat-posts');
    const bufferedEl = hudShadowRoot.getElementById('stat-buffered');
    const linksEl = hudShadowRoot.getElementById('stat-links');
    const scrollBtn = hudShadowRoot.getElementById('scroll-btn');
    const syncBtn = hudShadowRoot.getElementById('sync-btn');
    const dashLink = hudShadowRoot.getElementById('dash-link');

    const allItems = Array.from(scannedRecords.values());
    const unsyncedCount = allItems.filter(item => !syncedRecordIds.has(item.id)).length;

    let totalLinks = 0;
    scannedRecords.forEach(r => {
      totalLinks += (r.links ? r.links.length : 0);
    });

    if (postsEl) postsEl.textContent = scannedRecords.size.toString();
    if (bufferedEl) bufferedEl.textContent = `${unsyncedCount}`;
    if (linksEl) linksEl.textContent = totalLinks.toString();

    // Update Anon mode button and badge
    const hudAnonVal = hudShadowRoot.getElementById('hud-anon-val');
    const hudAnonBtn = hudShadowRoot.getElementById('hud-anon-btn');
    if (hudAnonVal) {
      hudAnonVal.textContent = isAnonMode ? 'ON' : 'OFF';
    }
    if (hudAnonBtn) {
      hudAnonBtn.style.background = isAnonMode ? '#78350F' : '';
      hudAnonBtn.style.color = isAnonMode ? '#FDE68A' : '';
      hudAnonBtn.style.borderColor = isAnonMode ? '#D97706' : '';
    }

    // Update status dot and badge
    if (dotEl && badgeEl) {
      if (isAnonMode) {
        dotEl.className = 'dot anon';
        badgeEl.className = 'badge anon';
        badgeEl.textContent = 'Anon';
      } else {
        dotEl.className = `dot ${syncStatus}`;
        badgeEl.className = `badge ${syncStatus}`;
        badgeEl.textContent = syncStatus === 'syncing' ? 'Syncing' : (syncStatus === 'offline' ? 'Offline' : 'Online');
      }
    }

    if (bannerEl) {
      if (isAnonMode) {
        bannerEl.className = 'status-banner anon';
        bannerEl.innerHTML = `<span>🕶️</span><span>Anon Mode: Active · No snippets stored</span>`;
      } else {
        bannerEl.className = `status-banner ${syncStatus}`;
        if (syncStatus === 'offline') {
          bannerEl.innerHTML = `<span>▲</span><span>Offline: saved safely in JSON. Manual sync required.</span>`;
        } else if (syncStatus === 'syncing') {
          bannerEl.innerHTML = `<span>⟳</span><span>Sending 1 manual batch query (${unsyncedCount} items)...</span>`;
        } else if (unsyncedCount > 0) {
          bannerEl.innerHTML = `<span>📁</span><span>JSON file: ${unsyncedCount} unsynced (Manual sync ready)</span>`;
        } else {
          bannerEl.innerHTML = `<span>●</span><span>Manual Sync Mode · All saved to JSON</span>`;
        }
      }
    }

    if (promptCardEl) {
      if (unsyncedCount > 0) {
        promptCardEl.classList.add('show');
        if (promptDescEl) {
          promptDescEl.textContent = `${unsyncedCount} bookmarks saved in local JSON. Auto-sync is disabled to protect database quota.`;
        }
      } else {
        promptCardEl.classList.remove('show');
      }
    }

    const scrollSpeedBtn = hudShadowRoot.getElementById('scroll-speed-btn');
    const cfg = AUTO_SCROLL_SETTINGS[autoScrollSpeed] || AUTO_SCROLL_SETTINGS.turbo;

    if (scrollBtn) {
      scrollBtn.textContent = isAutoScrolling ? 'Stop Auto-Scroll' : '⚡ Auto-Scroll';
      scrollBtn.classList.toggle('active', isAutoScrolling);
    }

    if (scrollSpeedBtn) {
      scrollSpeedBtn.textContent = cfg.label.split(' ')[0] + ' ' + cfg.label.split(' ')[1];
      scrollSpeedBtn.title = `Current speed: ${cfg.label} (${cfg.step}px / ${cfg.interval}ms). Click to cycle speed.`;
    }

    if (syncBtn) {
      if (isSyncing) {
        syncBtn.textContent = 'Syncing 1 Batch Query...';
        syncBtn.disabled = true;
      } else {
        syncBtn.textContent = unsyncedCount > 0 ? `Sync Now (${unsyncedCount} in JSON)` : 'All Synced';
        syncBtn.disabled = false;
      }
    }

    if (dashLink) {
      dashLink.href = config.dashboardUrl;
    }
  }

  function showToast(msg, duration = 2600) {
    if (!hudShadowRoot) return;
    const toast = hudShadowRoot.getElementById('toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => {
      toast.classList.remove('show');
    }, duration);
  }

  // Cross-extension message relay
  if (browserAPI?.runtime?.onMessage) {
    browserAPI.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.type === 'SCAN_PAGE') {
        if (!isAllowedHistoryPage()) {
          sendResponse({ success: false, error: 'Scanning is only allowed on x.com/i/history and x.com/i/history/likes', count: scannedRecords.size, newlyFound: 0 });
          return;
        }
        const res = scanPage();
        sendResponse({ success: true, count: res.total, newlyFound: res.newlyFound });
      } else if (request.type === 'AUDIT_BOOKMARKS') {
        if (!isAllowedHistoryPage()) {
          sendResponse({ success: false, error: 'Audit is only allowed on x.com/i/history and x.com/i/history/likes', count: scannedRecords.size, newlyLoaded: 0, alreadyPresentInJson: 0 });
          return;
        }
        const res = auditAndScanBookmarks(true);
        sendResponse({ 
          success: true, 
          count: res.total, 
          newlyLoaded: res.newlyLoaded, 
          alreadyPresentInJson: res.alreadyPresentInJson 
        });
      } else if (request.type === 'GET_STATUS') {
        const allItems = Array.from(scannedRecords.values());
        const unsyncedCount = allItems.filter(item => !syncedRecordIds.has(item.id)).length;
        sendResponse({
          count: scannedRecords.size,
          unsyncedCount,
          syncStatus,
          isQuotaExhausted,
          isAutoScrolling,
          isAnonMode,
          isAllowedPage: isAllowedHistoryPage(),
          currentUrl: window.location.href,
          dashboardUrl: config.dashboardUrl
        });
      } else if (request.type === 'CLEAR_SESSION') {
        clearSession();
        sendResponse({ success: true, count: 0 });
      } else if (request.type === 'SET_ANON_MODE') {
        setAnonMode(Boolean(request.enabled));
        sendResponse({ success: true, isAnonMode });
      } else if (request.type === 'TOGGLE_ANON_MODE') {
        toggleAnonMode();
        sendResponse({ success: true, isAnonMode });
      } else if (request.type === 'SYNC_NOW') {
        syncToDashboard(true).then(() => {
          sendResponse({ success: true, count: scannedRecords.size });
        });
        return true;
      } else if (request.type === 'EXPORT_JSON') {
        exportJsonArchive();
        sendResponse({ success: true, count: scannedRecords.size });
      } else if (request.type === 'IMPORT_JSON') {
        const res = importJsonRecords(request.records);
        sendResponse({ success: true, count: scannedRecords.size, ...res });
      } else if (request.type === 'TOGGLE_AUTO_SCROLL') {
        if (!isAllowedHistoryPage()) {
          sendResponse({ success: false, error: 'Auto-scroll is only allowed on x.com/i/history and x.com/i/history/likes', isAutoScrolling: false });
          return;
        }
        if (request.speed && AUTO_SCROLL_SETTINGS[request.speed]) {
          setAutoScrollSpeed(request.speed);
        }
        toggleAutoScroll();
        sendResponse({ success: true, isAutoScrolling, speed: autoScrollSpeed });
      } else if (request.type === 'SET_AUTO_SCROLL_SPEED') {
        if (request.speed && AUTO_SCROLL_SETTINGS[request.speed]) {
          setAutoScrollSpeed(request.speed);
        }
        sendResponse({ success: true, speed: autoScrollSpeed });
      }
    });
  }

  /**
   * Cooperative Initialization
   * Ensures X's initial React bundle, hydration, and routing complete unhindered
   */
  function startObserver() {
    if (observer) return;

    // Observe timeline container if present, or fallback to document.body
    const targetNode = document.querySelector('main[role="main"]') || document.body;
    if (!targetNode) return;

    observer = new MutationObserver((mutations) => {
      // Immediate bail if not on an allowed history page
      if (!isAllowedHistoryPage(window.location.href)) {
        if (isAutoScrolling) stopAutoScroll(false);
        if (debounceScanTimer) {
          clearTimeout(debounceScanTimer);
          debounceScanTimer = null;
        }
        const hudHost = document.getElementById('soro-history-hud-host');
        if (hudHost) hudHost.style.display = 'none';
        return;
      }

      let relevantAddition = false;

      for (let i = 0; i < mutations.length; i++) {
        const m = mutations[i];
        // Ignore mutations within our own host
        if (m.target && m.target.nodeType === 1) {
          const el = m.target;
          if (el.id === 'soro-history-hud-host' || el.hasAttribute('data-soro-ignore')) {
            continue;
          }
        }

        if (m.addedNodes.length > 0) {
          for (let j = 0; j < m.addedNodes.length; j++) {
            const node = m.addedNodes[j];
            if (node.nodeType === 1) {
              // Check if an article or timeline item was added
              if (node.tagName === 'ARTICLE' || node.querySelector?.('article[data-testid="tweet"]')) {
                relevantAddition = true;
                break;
              }
            }
          }
        }
        if (relevantAddition) break;
      }

      if (relevantAddition && isAllowedHistoryPage(window.location.href)) {
        triggerDebouncedScan(1000);
      }
    });

    observer.observe(targetNode, {
      childList: true,
      subtree: true
    });
  }

  // =========================================================================
  // SOROTRACK PERSONAL AI ASSISTANT (ON EVERY PAGE)
  // Powered by Local LLM Inferencing (Ollama, LM Studio, LocalAI)
  // =========================================================================

  let assistantHost = null;
  let assistantShadow = null;
  let isAssistantOpen = false;
  let isMinimalistActive = false;
  let isTechFilterActive = false;
  let hiddenNonTechElements = [];
  let highlightedStartupSpans = [];

  const DEFAULT_LLM_SETTINGS = {
    url: 'http://127.0.0.1:11434',
    model: 'llama3.2',
    temperature: 0.3,
    autoOpenOnLoad: false,
    orbStyle: 'icon'
  };

  let assistantConfig = { ...DEFAULT_LLM_SETTINGS };
  let detectedLocalModels = [];
  let isLocalLLMOnline = false;
  let assistantMessages = [
    {
      role: 'assistant',
      content: 'Hello! I am your **SoroTrack Personal AI Assistant** running directly on this page.\n\nI am powered by your **local Ollama LLM** for private, non-cloud inferencing. Click one of the quick actions below or give me any command!'
    }
  ];

  /**
   * Loads user settings for Local Ollama from chrome.storage.local
   */
  function loadAssistantSettings(callback) {
    if (!browserAPI?.storage?.local?.get) {
      if (callback) callback();
      return;
    }
    browserAPI.storage.local.get([
      'soro_local_llm_url',
      'soro_local_llm_ollama_url',
      'soro_local_llm_model',
      'soro_local_llm_temperature',
      'soro_assistant_auto_open',
      'soro_assistant_orb_style'
    ], (res) => {
      if (res?.soro_local_llm_url) assistantConfig.url = res.soro_local_llm_url;
      else if (res?.soro_local_llm_ollama_url) assistantConfig.url = res.soro_local_llm_ollama_url;
      if (res?.soro_local_llm_model) assistantConfig.model = res.soro_local_llm_model;
      if (res?.soro_local_llm_temperature) assistantConfig.temperature = res.soro_local_llm_temperature;
      if (typeof res?.soro_assistant_auto_open === 'boolean') assistantConfig.autoOpenOnLoad = res.soro_assistant_auto_open;
      if (res?.soro_assistant_orb_style) assistantConfig.orbStyle = res.soro_assistant_orb_style;
      if (callback) callback();
    });
  }

  /**
   * Saves updated settings into storage
   */
  function saveAssistantSettings() {
    if (!browserAPI?.storage?.local?.set) return;
    browserAPI.storage.local.set({
      soro_local_llm_url: assistantConfig.url,
      soro_local_llm_model: assistantConfig.model,
      soro_local_llm_temperature: assistantConfig.temperature,
      soro_assistant_auto_open: assistantConfig.autoOpenOnLoad,
      soro_assistant_orb_style: assistantConfig.orbStyle
    });
  }

  /**
   * Probes the local Ollama endpoint (via background script to avoid CSP issues)
   */
  function checkLocalLLMStatus(onDone) {
    const targetUrl = (assistantConfig.url || 'http://127.0.0.1:11434').trim();

    browserAPI.runtime.sendMessage({
      type: 'LOCAL_LLM_CHECK',
      payload: {
        provider: 'ollama',
        url: targetUrl,
        model: assistantConfig.model
      }
    }, (res) => {
      if (browserAPI.runtime.lastError || !res) {
        isLocalLLMOnline = false;
        updateAssistantStatusBadge();
        if (onDone) onDone(false, { error: browserAPI.runtime.lastError?.message || 'Background service worker unavailable' });
        return;
      }

      isLocalLLMOnline = Boolean(res.online);
      if (Array.isArray(res.models) && res.models.length > 0) {
        detectedLocalModels = res.models;
        if (res.matchedModel) {
          assistantConfig.model = res.matchedModel;
        } else if (!assistantConfig.model) {
          assistantConfig.model = res.defaultModel || res.models[0];
          saveAssistantSettings();
        }
      }
      updateAssistantStatusBadge();
      if (onDone) onDone(isLocalLLMOnline, res);
    });
  }

  /**
   * Initializes the persistent Personal Assistant on every webpage
   */
  function initPersonalAssistant() {
    if (document.getElementById('sorotrack-personal-assistant-host')) return;

    loadAssistantSettings(() => {
      const host = document.createElement('div');
      host.id = 'sorotrack-personal-assistant-host';
      host.setAttribute('data-soro-ignore', 'true');
      
      // Default bottom-right positioning, with saved position restoration
      let initialBottom = 24;
      let initialRight = 24;
      try {
        const savedPos = JSON.parse(localStorage.getItem('sorotrack_assistant_pos') || 'null');
        if (savedPos && typeof savedPos.bottom === 'number' && typeof savedPos.right === 'number') {
          initialBottom = Math.max(12, Math.min(window.innerHeight - 70, savedPos.bottom));
          initialRight = Math.max(12, Math.min(window.innerWidth - 70, savedPos.right));
        }
      } catch {}

      host.style.cssText = `position:fixed;bottom:${initialBottom}px;right:${initialRight}px;z-index:2147483647;pointer-events:auto;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;`;

      const shadow = host.attachShadow({ mode: 'open' });
      assistantHost = host;
      assistantShadow = shadow;

      renderAssistantDOM(shadow);
      bindAssistantEvents(shadow, host);

      // Append host to DOM
      (document.body || document.documentElement).appendChild(host);

      // Check local LLM status
      checkLocalLLMStatus((online) => {
        if (!online) {
          console.log('[SoroTrack Assistant] Local LLM standby. Ollama (Metal on Mac Studio) or LM Studio can be started anytime.');
        }
      });

      // Keyboard shortcut: Option+S on Mac Studio, Alt+S on Windows
      window.addEventListener('keydown', (e) => {
        if (e.altKey && (e.key === 's' || e.key === 'S')) {
          e.preventDefault();
          toggleAssistantPanel();
        }
      });

      if (assistantConfig.autoOpenOnLoad) {
        toggleAssistantPanel(true);
      }
    });
  }

  /**
   * Renders the complete Assistant Shadow DOM
   */
  function renderAssistantDOM(shadow) {
    const isMacPlatform = /Mac|iPhone|iPad/i.test(navigator.platform || '') || /Macintosh/i.test(navigator.userAgent || '');
    const shortcutLabel = isMacPlatform ? '⌥S' : 'Alt+S';

    shadow.innerHTML = `
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        
        /* Floating Little Icon Trigger (Appears on every webpage) */
        .assistant-orb {
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background: linear-gradient(135deg, #090d16 0%, #1e293b 100%);
          color: #f8fafc;
          border: 1.5px solid rgba(56, 189, 248, 0.45);
          box-shadow: 0 8px 24px -4px rgba(0, 0, 0, 0.6), 0 0 14px rgba(2, 132, 199, 0.3);
          cursor: grab;
          user-select: none;
          transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .assistant-orb:active {
          cursor: grabbing;
        }
        .assistant-orb.pill-mode {
          width: auto;
          height: auto;
          border-radius: 9999px;
          padding: 8px 14px;
          gap: 8px;
        }
        .assistant-orb:hover {
          background: linear-gradient(135deg, #0f172a 0%, #293548 100%);
          border-color: #38bdf8;
          transform: translateY(-2px) scale(1.08);
          box-shadow: 0 12px 28px -4px rgba(2, 132, 199, 0.5), 0 0 20px rgba(56, 189, 248, 0.45);
        }
        .assistant-orb-icon {
          width: 28px;
          height: 28px;
          background: linear-gradient(135deg, #0284c7, #2563eb);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 15px;
          color: #fff;
          font-weight: bold;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.35);
        }
        .assistant-orb-text {
          font-size: 12px;
          font-weight: 700;
          letter-spacing: -0.2px;
          display: none;
        }
        .assistant-orb.pill-mode .assistant-orb-text {
          display: inline-block;
        }
        .assistant-status-dot {
          position: absolute;
          top: -2px;
          right: -2px;
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: #f59e0b;
          border: 2px solid #090d16;
          box-shadow: 0 0 8px #f59e0b;
          transition: all 0.25s;
        }
        .assistant-status-dot.online {
          background: #10b981;
          box-shadow: 0 0 12px #10b981;
        }

        /* Floating Tooltip */
        .assistant-orb-tooltip {
          position: absolute;
          right: 52px;
          top: 50%;
          transform: translateY(-50%) translateX(6px);
          background: rgba(15, 23, 42, 0.96);
          color: #f1f5f9;
          border: 1px solid #334155;
          padding: 5px 11px;
          border-radius: 8px;
          font-size: 11px;
          font-weight: 600;
          white-space: nowrap;
          pointer-events: none;
          opacity: 0;
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
          box-shadow: 0 8px 20px rgba(0, 0, 0, 0.45);
        }
        .assistant-orb:hover .assistant-orb-tooltip {
          opacity: 1;
          transform: translateY(-50%) translateX(0);
        }
        
        /* Main Assistant Floating Panel */
        .assistant-panel {
          display: none;
          flex-direction: column;
          width: 420px;
          height: 600px;
          max-height: calc(100vh - 100px);
          background: #090d14;
          border: 1px solid #1e293b;
          border-radius: 16px;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);
          overflow: hidden;
          margin-bottom: 12px;
          animation: panelIn 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .assistant-panel.open {
          display: flex;
        }
        @keyframes panelIn {
          from { opacity: 0; transform: translateY(15px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        /* Header */
        .panel-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px;
          background: #0f172a;
          border-bottom: 1px solid #1e293b;
        }
        .header-left {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .header-title {
          font-size: 13px;
          font-weight: 700;
          color: #f8fafc;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .header-badge {
          font-size: 10px;
          font-weight: 600;
          padding: 2px 7px;
          border-radius: 12px;
          background: #1e293b;
          color: #94a3b8;
          border: 1px solid #334155;
          max-width: 130px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .header-badge.online {
          background: rgba(16, 185, 129, 0.15);
          color: #34d399;
          border-color: rgba(16, 185, 129, 0.3);
        }
        .header-actions {
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .btn-icon {
          background: transparent;
          border: none;
          color: #94a3b8;
          width: 26px;
          height: 26px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          font-size: 13px;
          transition: all 0.15s;
        }
        .btn-icon:hover {
          background: #1e293b;
          color: #f8fafc;
        }

        /* Settings Drawer */
        .settings-drawer {
          display: none;
          padding: 14px 16px;
          background: #0c121e;
          border-bottom: 1px solid #1e293b;
          font-size: 12px;
          color: #cbd5e1;
        }
        .settings-drawer.open {
          display: block;
        }
        .setting-row {
          margin-bottom: 10px;
        }
        .setting-label {
          display: block;
          font-size: 11px;
          font-weight: 600;
          color: #94a3b8;
          margin-bottom: 4px;
          text-transform: uppercase;
        }
        .setting-input, .setting-select {
          width: 100%;
          padding: 7px 10px;
          background: #151d2a;
          border: 1px solid #233044;
          border-radius: 6px;
          color: #f8fafc;
          font-size: 12px;
        }
        .setting-actions {
          display: flex;
          gap: 8px;
          margin-top: 10px;
        }
        .btn-sm {
          padding: 5px 12px;
          background: #2563eb;
          color: white;
          border: none;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
        }
        .btn-sm.secondary {
          background: #1e293b;
          color: #cbd5e1;
          border: 1px solid #334155;
        }
        .btn-sm:hover {
          opacity: 0.9;
        }

        /* Quick Action Chips */
        .quick-actions {
          display: flex;
          gap: 6px;
          padding: 10px 14px;
          background: #0c1320;
          border-bottom: 1px solid #1a2333;
          overflow-x: auto;
          white-space: nowrap;
          scrollbar-width: none;
        }
        .quick-actions::-webkit-scrollbar {
          display: none;
        }
        .chip {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 5px 11px;
          border-radius: 14px;
          background: #151f30;
          color: #e2e8f0;
          border: 1px solid #233044;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s;
        }
        .chip:hover {
          background: #1e2d44;
          border-color: #0284c7;
          color: #38bdf8;
        }
        .chip.active {
          background: rgba(2, 132, 199, 0.2);
          border-color: #0284c7;
          color: #38bdf8;
        }

        /* Chat / Activity Feed */
        .chat-feed {
          flex: 1;
          overflow-y: auto;
          padding: 14px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          scroll-behavior: smooth;
        }
        .message {
          display: flex;
          flex-direction: column;
          gap: 4px;
          max-width: 92%;
          font-size: 12px;
          line-height: 1.55;
        }
        .message.user {
          align-self: flex-end;
          background: #1d4ed8;
          color: #ffffff;
          padding: 9px 13px;
          border-radius: 14px 14px 2px 14px;
        }
        .message.assistant {
          align-self: flex-start;
          background: #131b28;
          color: #e2e8f0;
          padding: 11px 14px;
          border-radius: 14px 14px 14px 2px;
          border: 1px solid #1e293b;
        }
        .message-content h1, .message-content h2, .message-content h3 {
          color: #38bdf8;
          margin: 6px 0 4px 0;
          font-size: 13px;
        }
        .message-content p {
          margin-bottom: 6px;
        }
        .message-content ul, .message-content ol {
          margin-left: 18px;
          margin-bottom: 6px;
        }
        .message-content code {
          background: #090d14;
          color: #f43f5e;
          padding: 1px 4px;
          border-radius: 4px;
          font-family: monospace;
          font-size: 11px;
        }
        .message-content pre {
          background: #090d14;
          padding: 8px;
          border-radius: 6px;
          overflow-x: auto;
          margin: 6px 0;
        }
        .message-content pre code {
          color: #38bdf8;
          padding: 0;
          background: transparent;
        }

        /* Action Outcome Card */
        .action-card {
          margin-top: 8px;
          padding: 9px 12px;
          border-radius: 8px;
          background: #162234;
          border: 1px solid #23354c;
          font-size: 11px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }
        .action-card-text {
          color: #94a3b8;
        }
        .action-card-btn {
          background: #2563eb;
          color: white;
          border: none;
          padding: 4px 10px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 11px;
          font-weight: 600;
          white-space: nowrap;
        }
        .action-card-btn.undo {
          background: #475569;
        }

        /* Input Area */
        .input-bar {
          padding: 12px 14px;
          background: #0c121e;
          border-top: 1px solid #1e293b;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .input-row {
          display: flex;
          gap: 8px;
          align-items: flex-end;
        }
        .prompt-input {
          flex: 1;
          background: #151d2a;
          border: 1px solid #233044;
          border-radius: 10px;
          padding: 9px 12px;
          color: #f8fafc;
          font-size: 12px;
          font-family: inherit;
          resize: none;
          max-height: 80px;
          outline: none;
          transition: border-color 0.15s;
        }
        .prompt-input:focus {
          border-color: #0284c7;
        }
        .btn-send {
          background: linear-gradient(135deg, #0284c7, #2563eb);
          color: white;
          border: none;
          width: 36px;
          height: 36px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          font-size: 14px;
          transition: all 0.15s;
        }
        .btn-send:hover {
          opacity: 0.9;
          transform: scale(1.05);
        }
        .input-hints {
          display: flex;
          justify-content: space-between;
          font-size: 10px;
          color: #64748b;
          padding: 0 4px;
        }
        .shortcut-tag {
          background: #1e293b;
          color: #94a3b8;
          padding: 1px 4px;
          border-radius: 3px;
          font-family: monospace;
        }

        /* Loading Spinner */
        .typing-indicator {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 8px 12px;
        }
        .typing-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #38bdf8;
          animation: typingPulse 1.2s infinite ease-in-out;
        }
        .typing-dot:nth-child(2) { animation-delay: 0.2s; }
        .typing-dot:nth-child(3) { animation-delay: 0.4s; }
        @keyframes typingPulse {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
          40% { transform: scale(1); opacity: 1; }
        }
      </style>

      <!-- Floating Assistant Panel -->
      <div id="assistant-panel" class="assistant-panel">
        <div class="panel-header">
          <div class="header-left">
            <span class="header-title">⚡ SoroTrack AI</span>
            <span id="header-model-badge" class="header-badge">Checking LLM...</span>
          </div>
          <div class="header-actions">
            <button id="btn-toggle-settings" class="btn-icon" title="Local LLM Settings">⚙️</button>
            <button id="btn-minimize-panel" class="btn-icon" title="Minimize">_</button>
            <button id="btn-close-panel" class="btn-icon" title="Close">✕</button>
          </div>
        </div>

        <!-- Settings Drawer -->
        <div id="settings-drawer" class="settings-drawer">
          <div class="setting-row">
            <label class="setting-label">Local Ollama URL</label>
            <input type="text" id="setting-url" class="setting-input" value="${assistantConfig.url || 'http://127.0.0.1:11434'}" placeholder="http://127.0.0.1:11434">
          </div>
          <div class="setting-row">
            <label class="setting-label">Model Name</label>
            <div style="display:flex;gap:6px;">
              <input type="text" id="setting-model" class="setting-input" value="${assistantConfig.model || 'llama3.2'}" placeholder="e.g. llama3.2">
              <button id="btn-fetch-models" class="btn-sm secondary" title="Fetch installed models from Ollama">Refresh</button>
            </div>
          </div>
          <div class="setting-row">
            <label class="setting-label">On-Page Trigger Style</label>
            <select id="setting-orb-style" class="setting-select">
              <option value="icon" ${assistantConfig.orbStyle !== 'pill' ? 'selected' : ''}>Little Icon (Compact 44px) - Default</option>
              <option value="pill" ${assistantConfig.orbStyle === 'pill' ? 'selected' : ''}>Floating Pill (Icon + Label)</option>
            </select>
          </div>
          <div style="font-size:10px;color:#94a3b8;margin:6px 0;line-height:1.4;background:#141c2a;padding:8px 10px;border-radius:6px;border:1px solid #1e293b;">
            <div>🍎 <strong>Apple Mac Studio & macOS</strong>: Metal GPU inference supported. Toggle: <span class="shortcut-tag">⌥S</span></div>
            <div style="margin-top:4px;">🪟 <strong>Windows PC</strong>: Local engine supported. Toggle: <span class="shortcut-tag">Alt+S</span></div>
          </div>
          <div class="setting-actions">
            <button id="btn-test-connection" class="btn-sm">Test Connection</button>
            <button id="btn-save-settings" class="btn-sm secondary">Save Settings</button>
            <span id="setting-test-result" style="margin-left:auto;font-size:11px;align-self:center;"></span>
          </div>
        </div>

        <!-- Quick Actions (Only actual features, example pins removed) -->
        <div class="quick-actions">
          <button id="chip-startups" class="chip">🚀 Research Startups</button>
          <button id="chip-summarize" class="chip">⚡ Summarize Page</button>
          <button id="chip-clean-ads" class="chip">🧹 Clean Popups</button>
        </div>

        <!-- Chat / Message Activity Feed -->
        <div id="chat-feed" class="chat-feed">
          <!-- Populated dynamically -->
        </div>

        <!-- Input Bar -->
        <div class="input-bar">
          <div class="input-row">
            <textarea id="prompt-input" class="prompt-input" rows="1" placeholder="Ask: research startups, clean page, or anything..."></textarea>
            <button id="btn-send" class="btn-send" title="Send (Enter)">➤</button>
          </div>
          <div class="input-hints">
            <span>Press <span class="shortcut-tag">Enter</span> to send • <span class="shortcut-tag">${shortcutLabel}</span> toggles assistant</span>
            <span id="llm-status-text" style="color:#10b981;">Local LLM Ready</span>
          </div>
        </div>
      </div>

      <!-- Floating Little Icon Trigger (Appears on every page of confirmed browsers) -->
      <div id="assistant-orb" class="assistant-orb ${assistantConfig.orbStyle === 'pill' ? 'pill-mode' : ''}" title="SoroTrack Personal AI Assistant (Click to open, drag to move)">
        <div class="assistant-orb-icon">⚡</div>
        <span class="assistant-orb-text">SoroTrack AI</span>
        <div id="assistant-status-dot" class="assistant-status-dot" title="Checking local LLM..."></div>
        <div class="assistant-orb-tooltip">
          <span>⚡ SoroTrack AI (${shortcutLabel}) • Click to open</span>
        </div>
      </div>
    `;

    renderMessages(shadow);
  }

  /**
   * Updates status badge in header and orb
   */
  function updateAssistantStatusBadge() {
    if (!assistantShadow) return;
    const dot = assistantShadow.getElementById('assistant-status-dot');
    const badge = assistantShadow.getElementById('header-model-badge');
    const statusText = assistantShadow.getElementById('llm-status-text');

    if (isLocalLLMOnline) {
      if (dot) {
        dot.className = 'assistant-status-dot online';
        dot.title = `Connected to Local Ollama: ${assistantConfig.model || 'active'}`;
      }
      if (badge) {
        badge.className = 'header-badge online';
        badge.textContent = `● Ollama: ${assistantConfig.model || 'model'}`;
      }
      if (statusText) {
        statusText.style.color = '#10b981';
        statusText.textContent = `Ollama Online (${assistantConfig.model || 'active'})`;
      }
    } else {
      if (dot) {
        dot.className = 'assistant-status-dot';
        dot.title = 'Local Ollama offline. Ensure `ollama serve` is running.';
      }
      if (badge) {
        badge.className = 'header-badge';
        badge.textContent = '○ Ollama Offline';
      }
      if (statusText) {
        statusText.style.color = '#f59e0b';
        statusText.textContent = 'Ollama Offline';
      }
    }
  }

  /**
   * Toggles the assistant panel visibility
   */
  function toggleAssistantPanel(forceState) {
    if (!assistantShadow) return;
    const panel = assistantShadow.getElementById('assistant-panel');
    if (!panel) return;

    isAssistantOpen = typeof forceState === 'boolean' ? forceState : !isAssistantOpen;
    if (isAssistantOpen) {
      panel.classList.add('open');
      const input = assistantShadow.getElementById('prompt-input');
      if (input) setTimeout(() => input.focus(), 100);
      checkLocalLLMStatus();
    } else {
      panel.classList.remove('open');
    }
  }

  /**
   * Renders messages in the chat feed
   */
  function renderMessages(shadow) {
    const feed = shadow.getElementById('chat-feed');
    if (!feed) return;

    feed.innerHTML = assistantMessages.map((msg, idx) => {
      const isUser = msg.role === 'user';
      let contentHtml = escapeHtml(msg.content)
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\n\n/g, '</p><p>')
        .replace(/\n/g, '<br/>');

      let actionCardHtml = '';
      if (msg.actionResult) {
        const ar = msg.actionResult;
        actionCardHtml = `
          <div class="action-card">
            <span class="action-card-text">${escapeHtml(ar.label || 'Action executed')}</span>
            <button class="action-card-btn ${ar.canUndo ? 'undo' : ''}" data-action-id="${idx}">
              ${ar.buttonLabel || (ar.canUndo ? 'Undo / Restore' : 'View')}
            </button>
          </div>
        `;
      }

      return `
        <div class="message ${isUser ? 'user' : 'assistant'}">
          <div class="message-content"><p>${contentHtml}</p></div>
          ${actionCardHtml}
        </div>
      `;
    }).join('');

    // Attach click listener for action buttons
    feed.querySelectorAll('.action-card-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(btn.getAttribute('data-action-id') || '0', 10);
        const msg = assistantMessages[idx];
        if (msg?.actionResult?.onAction) {
          msg.actionResult.onAction();
        } else if (msg?.actionResult?.type === 'minimalist') {
          toggleMinimalistMode(false);
        } else if (msg?.actionResult?.type === 'non-tech') {
          restoreNonTechContent();
        }
      });
    });

    feed.scrollTop = feed.scrollHeight;
  }

  function escapeHtml(str) {
    return (str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  /**
   * Binds user event interactions with drag-and-drop position support
   */
  function bindAssistantEvents(shadow, host) {
    const orb = shadow.getElementById('assistant-orb');
    const btnClose = shadow.getElementById('btn-close-panel');
    const btnMinimize = shadow.getElementById('btn-minimize-panel');
    const btnToggleSettings = shadow.getElementById('btn-toggle-settings');
    const settingsDrawer = shadow.getElementById('settings-drawer');
    const btnSaveSettings = shadow.getElementById('btn-save-settings');
    const btnTestConn = shadow.getElementById('btn-test-connection');
    const btnFetchModels = shadow.getElementById('btn-fetch-models');
    const promptInput = shadow.getElementById('prompt-input');
    const btnSend = shadow.getElementById('btn-send');

    // Quick action chips
    const chipStartups = shadow.getElementById('chip-startups');
    const chipSummarize = shadow.getElementById('chip-summarize');
    const chipCleanAds = shadow.getElementById('chip-clean-ads');

    // Drag-and-drop support for the Little Icon
    let isDragging = false;
    let startX = 0, startY = 0;
    let initialRight = 24, initialBottom = 24;
    let hasDragged = false;

    if (orb && host) {
      orb.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        isDragging = true;
        hasDragged = false;
        startX = e.clientX;
        startY = e.clientY;
        const rect = host.getBoundingClientRect();
        initialRight = window.innerWidth - rect.right;
        initialBottom = window.innerHeight - rect.bottom;

        const onMouseMove = (moveEvt) => {
          const deltaX = moveEvt.clientX - startX;
          const deltaY = moveEvt.clientY - startY;
          if (Math.hypot(deltaX, deltaY) > 5) {
            hasDragged = true;
            const newRight = Math.max(10, Math.min(window.innerWidth - 60, initialRight - deltaX));
            const newBottom = Math.max(10, Math.min(window.innerHeight - 60, initialBottom - deltaY));
            host.style.right = `${newRight}px`;
            host.style.bottom = `${newBottom}px`;
          }
        };

        const onMouseUp = () => {
          isDragging = false;
          window.removeEventListener('mousemove', onMouseMove);
          window.removeEventListener('mouseup', onMouseUp);
          if (hasDragged) {
            try {
              const rect = host.getBoundingClientRect();
              localStorage.setItem('sorotrack_assistant_pos', JSON.stringify({
                right: Math.round(window.innerWidth - rect.right),
                bottom: Math.round(window.innerHeight - rect.bottom)
              }));
            } catch {}
          }
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
      });
    }

    orb.addEventListener('click', (e) => {
      if (hasDragged) {
        hasDragged = false;
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      toggleAssistantPanel();
    });

    btnClose.addEventListener('click', () => toggleAssistantPanel(false));
    btnMinimize.addEventListener('click', () => toggleAssistantPanel(false));

    btnToggleSettings.addEventListener('click', () => {
      settingsDrawer.classList.toggle('open');
    });

    btnSaveSettings.addEventListener('click', () => {
      const url = shadow.getElementById('setting-url').value.trim();
      const model = shadow.getElementById('setting-model').value.trim();
      const orbStyleSel = shadow.getElementById('setting-orb-style');
      const orbStyle = orbStyleSel ? orbStyleSel.value : 'icon';

      if (url) assistantConfig.url = url;
      if (model) assistantConfig.model = model;
      assistantConfig.orbStyle = orbStyle;

      if (orbStyle === 'pill') {
        orb.classList.add('pill-mode');
      } else {
        orb.classList.remove('pill-mode');
      }

      saveAssistantSettings();
      checkLocalLLMStatus();
      settingsDrawer.classList.remove('open');
    });

    btnTestConn.addEventListener('click', () => {
      const testRes = shadow.getElementById('setting-test-result');
      testRes.textContent = 'Testing Ollama...';
      testRes.style.color = '#38bdf8';

      const url = shadow.getElementById('setting-url').value.trim();
      const model = shadow.getElementById('setting-model').value.trim();
      if (url) assistantConfig.url = url;
      if (model) assistantConfig.model = model;
      saveAssistantSettings();

      checkLocalLLMStatus((online, data) => {
        if (online) {
          testRes.textContent = data?.matchedModel ? `Connected ✓ (${data.matchedModel})` : (data?.message || 'Connected ✓');
          testRes.style.color = '#10b981';
        } else {
          testRes.textContent = data?.error || 'Offline ✗';
          testRes.style.color = '#ef4444';
        }
      });
    });

    btnFetchModels.addEventListener('click', () => {
      const url = shadow.getElementById('setting-url').value.trim();
      const modelInput = shadow.getElementById('setting-model');

      browserAPI.runtime.sendMessage({
        type: 'LOCAL_LLM_GET_MODELS',
        payload: { provider: 'ollama', url }
      }, (res) => {
        if (res?.success && Array.isArray(res.models) && res.models.length > 0) {
          modelInput.value = res.models[0];
          assistantConfig.model = res.models[0];
          detectedLocalModels = res.models;
          saveAssistantSettings();
          alert(`Ollama is active! Detected ${res.models.length} model(s):\n${res.models.join(', ')}`);
        } else {
          alert('Could not fetch models from Ollama. Make sure `ollama serve` is running at ' + (url || 'http://127.0.0.1:11434'));
        }
      });
    });

    // Prompt submit
    const submitPrompt = () => {
      const text = promptInput.value.trim();
      if (!text) return;
      promptInput.value = '';
      handleUserPrompt(text);
    };

    btnSend.addEventListener('click', submitPrompt);
    promptInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        submitPrompt();
      }
    });

    // Quick Actions (Only active buttons, example pins removed)
    if (chipStartups) {
      chipStartups.addEventListener('click', () => {
        handleUserPrompt('research all the startups listed here and summarize');
      });
    }

    if (chipSummarize) {
      chipSummarize.addEventListener('click', () => {
        handleUserPrompt('provide an executive summary of this webpage');
      });
    }

    if (chipCleanAds) {
      chipCleanAds.addEventListener('click', () => {
        handleUserPrompt('remove all ads, popups, and sticky banners');
      });
    }
  }

  /**
   * Handles user requests via local LLM or direct DOM action
   */
  function handleUserPrompt(userPrompt) {
    if (!assistantShadow) return;

    // Add user message to feed
    assistantMessages.push({ role: 'user', content: userPrompt });
    renderMessages(assistantShadow);

    const lower = userPrompt.toLowerCase();

    // Check for "startups" research request
    if (lower.includes('startup') && (lower.includes('research') || lower.includes('summar') || lower.includes('list') || lower.includes('all'))) {
      executeStartupResearch(userPrompt);
      return;
    }

    // Check for "non-tech" content removal
    if ((lower.includes('non-tech') || lower.includes('non tech')) && (lower.includes('remove') || lower.includes('filter') || lower.includes('clean') || lower.includes('hide'))) {
      executeRemoveNonTechContent();
      return;
    }

    // Check for "minimalist" mode / remove graphics
    if ((lower.includes('minimalist') || lower.includes('zen') || lower.includes('reader')) || (lower.includes('remove') && (lower.includes('graphic') || lower.includes('image')))) {
      executeMinimalistMode();
      return;
    }

    // Check for ads / popups removal
    if (lower.includes('ad') || lower.includes('popup') || lower.includes('cookie') || lower.includes('banner')) {
      executeCleanDistractions();
      return;
    }

    // Check for restore / reset / undo
    if (lower.includes('restore') || lower.includes('undo') || lower.includes('reset page')) {
      restoreAllPageModifications();
      return;
    }

    // General purpose query to Local LLM
    executeGeneralLLMQuery(userPrompt);
  }

  /**
   * Action 1: Research all startups on this page using Local LLM
   */
  function executeStartupResearch(userPrompt) {
    showTypingIndicator();
    const pageText = extractPageTextForLLM();
    const targetUrl = (assistantConfig.url || 'http://127.0.0.1:11434').trim();

    const systemPrompt = `You are an expert Silicon Valley tech investor and startup researcher. 
The user is viewing a webpage and wants you to research and summarize all startups, companies, or tech products listed.
Page Title: ${document.title}
Page URL: ${window.location.href}

Extracted Webpage Content:
${pageText.slice(0, 10000)}

Instructions:
1. Identify all startups, companies, tech products, or founders mentioned on the page.
2. For each startup, summarize:
   - **Name**: Company name and link (if present)
   - **Description**: What does the product do?
   - **Value Proposition**: Problem solved and target audience
   - **Tech Category**: (e.g. Generative AI, DevTools, SaaS, Fintech, Robotics)
   - **Key Highlights**: Metrics, traction, investors, or unique angle
3. Conclude with a brief 2-sentence synthesis of startup trends observed on this page.
Keep the formatting crisp, structured, and easy to read.`;

    browserAPI.runtime.sendMessage({
      type: 'LOCAL_LLM_CHAT',
      payload: {
        provider: 'ollama',
        url: targetUrl,
        model: assistantConfig.model || 'llama3.2',
        prompt: userPrompt || 'Research all the startups listed here and summarize.',
        systemPrompt,
        temperature: 0.2
      }
    }, (res) => {
      hideTypingIndicator();
      if (res?.success && res.content) {
        highlightStartupEntitiesOnPage();
        assistantMessages.push({
          role: 'assistant',
          content: res.content,
          actionResult: {
            label: 'Startup Intelligence Dossier Complete • Entities highlighted on page',
            buttonLabel: 'Highlight Entities on Page',
            canUndo: false,
            onAction: () => highlightStartupEntitiesOnPage()
          }
        });
      } else {
        // Local Ollama fallback: parse directly from DOM with clear diagnostic
        const fallbackAnalysis = generateFallbackStartupSummary();
        const errDetail = res?.error ? ` (${res.error})` : '';
        assistantMessages.push({
          role: 'assistant',
          content: `⚠️ **Local Ollama Notice**: Could not complete inferencing at \`${targetUrl}\`${errDetail}.\n\n* **Check**: Ensure \`ollama serve\` is running and model \`${assistantConfig.model || 'llama3.2'}\` is installed (\`ollama run ${assistantConfig.model || 'llama3.2'}\`).\n* You can verify or update the URL and model name anytime in **Settings** (⚙️).\n\n---\n**Synthesized On-Page DOM Analysis**:\n\n${fallbackAnalysis}`,
          actionResult: {
            label: 'Extracted via DOM Entity Parser',
            buttonLabel: 'Highlight on Page',
            onAction: () => highlightStartupEntitiesOnPage()
          }
        });
      }
      renderMessages(assistantShadow);
    });
  }

  /**
   * Action 2: Remove all non-tech content from the page
   */
  function executeRemoveNonTechContent() {
    const techKeywords = [
      'code', 'software', 'programming', 'python', 'javascript', 'typescript', 'rust', 'c++', 
      'golang', 'java', 'sql', 'database', 'query', 'api', 'graphql', 'cloud', 'aws', 'gcp', 
      'azure', 'docker', 'kubernetes', 'linux', 'devops', 'git', 'github', 'ai', 'ml', 
      'machine learning', 'llm', 'neural', 'deep learning', 'model', 'algorithm', 'engineering', 
      'framework', 'react', 'node', 'backend', 'frontend', 'latency', 'cache', 'cpu', 'gpu', 
      'semiconductor', 'startup', 'saas', 'devtools', 'tech', 'computing', 'compiler', 'server',
      'vector', 'transformer', 'agent', 'rag', 'open source', 'huggingface', 'vulnerability'
    ];

    const nonTechKeywords = [
      'celebrity', 'horoscope', 'astrology', 'red carpet', 'royal family', 'gossip', 
      'relationship advice', 'dating tips', 'recipe', 'diet plan', 'fashion week', 
      'beauty routine', 'shopping deal', 'coupon code', 'sports score', 'football league', 
      'basketball match', 'celebrity net worth', 'murder case', 'tabloid', 'clickbait'
    ];

    let removedCount = 0;
    hiddenNonTechElements = [];

    // Target major text/card containers
    const candidates = document.querySelectorAll('article, section, div[class*="card"], div[class*="post"], div[class*="item"], li, p');
    
    candidates.forEach((el) => {
      // Never touch our assistant or essential layout headers/navs
      if (el.closest('#sorotrack-personal-assistant-host') || el.closest('#soro-history-hud-host')) return;
      if (el.tagName === 'NAV' || el.tagName === 'HEADER' || el.tagName === 'FOOTER') return;
      if (el.querySelector('pre, code')) return; // Always keep code snippets

      const text = (el.innerText || '').toLowerCase();
      if (text.length < 30) return;

      const techScore = techKeywords.filter(k => text.includes(k)).length;
      const nonTechScore = nonTechKeywords.filter(k => text.includes(k)).length;

      // Filter element if high non-tech signal and zero tech signal
      if (nonTechScore > 0 && techScore === 0) {
        el.classList.add('sorotrack-hidden-non-tech');
        hiddenNonTechElements.push(el);
        removedCount++;
      } else if (techScore === 0 && text.length > 100 && (text.includes('lifestyle') || text.includes('entertainment') || text.includes('gossip') || text.includes('shop'))) {
        el.classList.add('sorotrack-hidden-non-tech');
        hiddenNonTechElements.push(el);
        removedCount++;
      }
    });

    isTechFilterActive = true;
    showPageBanner(`💻 Tech-Only Mode: Filtered ${removedCount} non-tech sections`, () => restoreNonTechContent());

    assistantMessages.push({
      role: 'assistant',
      content: `I have filtered the webpage to **tech content only**.\n\n* **Filtered sections**: ${removedCount} non-tech blocks removed\n* **Preserved content**: All programming, software engineering, architecture, code snippets, and tech startup content remain intact.`,
      actionResult: {
        type: 'non-tech',
        label: `Filtered ${removedCount} non-tech sections`,
        buttonLabel: 'Undo / Restore Page',
        canUndo: true,
        onAction: () => restoreNonTechContent()
      }
    });
    renderMessages(assistantShadow);
  }

  /**
   * Action 3: Turn webpage into minimalist mode (remove graphics, heavy images)
   */
  function executeMinimalistMode() {
    toggleMinimalistMode(true);

    assistantMessages.push({
      role: 'assistant',
      content: `Turned webpage into **Minimalist Zen Mode**.\n\n* **Removed**: All heavy graphics, \`<img>\`, \`<video>\`, \`<canvas>\`, \`<svg>\`, and banners.\n* **Applied**: High-contrast, distraction-free reader typography centered in an optimal reading column.`,
      actionResult: {
        type: 'minimalist',
        label: 'Minimalist Zen Mode is Active',
        buttonLabel: 'Restore Original Page',
        canUndo: true,
        onAction: () => toggleMinimalistMode(false)
      }
    });
    renderMessages(assistantShadow);
  }

  function toggleMinimalistMode(enable) {
    isMinimalistActive = enable;
    if (enable) {
      document.documentElement.classList.add('sorotrack-minimalist-mode');
      showPageBanner('📖 Minimalist Mode Active (Graphics & Heavy Images Stripped)', () => toggleMinimalistMode(false));
    } else {
      document.documentElement.classList.remove('sorotrack-minimalist-mode');
      hidePageBanner();
    }
  }

  function restoreNonTechContent() {
    hiddenNonTechElements.forEach(el => {
      if (el) el.classList.remove('sorotrack-hidden-non-tech');
    });
    hiddenNonTechElements = [];
    isTechFilterActive = false;
    hidePageBanner();
    assistantMessages.push({
      role: 'assistant',
      content: 'Restored all original non-tech content on this page.'
    });
    renderMessages(assistantShadow);
  }

  /**
   * Action 4: Clean ads and popups
   */
  function executeCleanDistractions() {
    const selectors = [
      '[class*="cookie"]', '[id*="cookie"]',
      '[class*="consent"]', '[id*="consent"]',
      '[class*="newsletter-modal"]', '[id*="newsletter-modal"]',
      '[class*="subscribe-popup"]', '[id*="subscribe-popup"]',
      '[class*="ad-banner"]', '[id*="ad-banner"]',
      '[class*="advertisement"]', '[id*="advertisement"]',
      '.overlay-backdrop', '.modal-backdrop'
    ];

    let removed = 0;
    selectors.forEach(sel => {
      document.querySelectorAll(sel).forEach(el => {
        if (!el.closest('#sorotrack-personal-assistant-host')) {
          el.style.setProperty('display', 'none', 'important');
          removed++;
        }
      });
    });

    assistantMessages.push({
      role: 'assistant',
      content: `Cleaned **${removed} popup / ad / cookie banner elements** from the webpage.`
    });
    renderMessages(assistantShadow);
  }

  /**
   * Action 5: General LLM query
   */
  function executeGeneralLLMQuery(prompt) {
    showTypingIndicator();
    const pageContext = extractPageTextForLLM();
    const targetUrl = (assistantConfig.url || 'http://127.0.0.1:11434').trim();

    const systemPrompt = `You are SoroTrack Personal Assistant. The user is browsing the webpage "${document.title}" (${window.location.href}).
Extracted page context:
${pageContext.slice(0, 8000)}

Answer the user request accurately, concisely, and helpfully using information from this webpage and your general knowledge. Use markdown formatting.`;

    browserAPI.runtime.sendMessage({
      type: 'LOCAL_LLM_CHAT',
      payload: {
        provider: 'ollama',
        url: targetUrl,
        model: assistantConfig.model || 'llama3.2',
        prompt,
        systemPrompt,
        temperature: assistantConfig.temperature
      }
    }, (res) => {
      hideTypingIndicator();
      if (res?.success && res.content) {
        assistantMessages.push({
          role: 'assistant',
          content: res.content
        });
      } else {
        assistantMessages.push({
          role: 'assistant',
          content: `⚠️ Could not query your local Ollama endpoint at \`${targetUrl}\`.\n\n* **Error**: ${res?.error || 'Connection refused'}\n* **Troubleshooting**: Verify Ollama is running (\`ollama serve\`) and model \`${assistantConfig.model || 'llama3.2'}\` is installed (\`ollama run ${assistantConfig.model || 'llama3.2'}\`). Check or change the endpoint URL in Settings (⚙️).`
        });
      }
      renderMessages(assistantShadow);
    });
  }

  function restoreAllPageModifications() {
    toggleMinimalistMode(false);
    restoreNonTechContent();
    highlightedStartupSpans.forEach(span => {
      const parent = span.parentNode;
      if (parent) {
        parent.replaceChild(document.createTextNode(span.textContent || ''), span);
        parent.normalize();
      }
    });
    highlightedStartupSpans = [];
    hidePageBanner();
    assistantMessages.push({
      role: 'assistant',
      content: 'Restored the page back to its original unmodified state.'
    });
    renderMessages(assistantShadow);
  }

  /**
   * Shows floating top banner on page
   */
  function showPageBanner(text, onRestore) {
    let banner = document.getElementById('sorotrack-page-banner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'sorotrack-page-banner';
      banner.setAttribute('data-soro-ignore', 'true');
      document.body.appendChild(banner);
    }
    banner.innerHTML = `
      <span>${escapeHtml(text)}</span>
      <button id="btn-banner-restore">Restore Page</button>
    `;
    const btn = banner.querySelector('#btn-banner-restore');
    if (btn) btn.onclick = onRestore;
  }

  function hidePageBanner() {
    const banner = document.getElementById('sorotrack-page-banner');
    if (banner) banner.remove();
  }

  /**
   * Extracts clean page text for LLM
   */
  function extractPageTextForLLM() {
    const clone = document.body.cloneNode(true);
    // Remove scripts, styles, host elements
    clone.querySelectorAll('script, style, noscript, svg, iframe, #sorotrack-personal-assistant-host, #soro-history-hud-host').forEach(el => el.remove());
    return (clone.innerText || '')
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean)
      .join('\n');
  }

  /**
   * Highlights startup entities directly on page
   */
  function highlightStartupEntitiesOnPage() {
    const headings = document.querySelectorAll('h1, h2, h3, h4, strong, b, a');
    let count = 0;
    headings.forEach(el => {
      if (el.closest('#sorotrack-personal-assistant-host') || el.closest('#soro-history-hud-host')) return;
      const text = (el.innerText || '').trim();
      if (text.length >= 3 && text.length <= 35 && !text.includes(' ') && /^[A-Z][A-Za-z0-9]/.test(text)) {
        if (!el.classList.contains('sorotrack-startup-highlight')) {
          el.classList.add('sorotrack-startup-highlight');
          el.title = `SoroTrack Identified Entity: ${text}`;
          highlightedStartupSpans.push(el);
          count++;
        }
      }
    });
  }

  /**
   * Fallback heuristic startup summary generator
   */
  function generateFallbackStartupSummary() {
    const links = Array.from(document.querySelectorAll('a[href^="http"]'));
    const externalLinks = links.filter(a => {
      try {
        const url = new URL(a.href);
        return url.hostname !== window.location.hostname && !url.hostname.includes('twitter.com') && !url.hostname.includes('google.com');
      } catch (e) { return false; }
    });

    const uniqueDomains = Array.from(new Set(externalLinks.map(a => {
      try { return new URL(a.href).hostname.replace(/^www\./, ''); } catch (e) { return ''; }
    }))).filter(Boolean).slice(0, 10);

    return `### 🚀 Startups & Companies Detected on this Page:\n\n` + 
      uniqueDomains.map((dom, i) => `${i + 1}. **${dom.split('.')[0].toUpperCase()}** (\`${dom}\`)\n   * Tech Domain: Technology / Software Platform\n   * Reference: [Visit Website](https://${dom})\n`).join('\n') +
      `\n*Run \`ollama run llama3.2\` in your terminal for deeper autonomous inferencing.*`;
  }

  function showTypingIndicator() {
    if (!assistantShadow) return;
    const feed = assistantShadow.getElementById('chat-feed');
    if (!feed) return;
    const typing = document.createElement('div');
    typing.id = 'typing-indicator';
    typing.className = 'typing-indicator';
    typing.innerHTML = '<div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>';
    feed.appendChild(typing);
    feed.scrollTop = feed.scrollHeight;
  }

  function hideTypingIndicator() {
    if (!assistantShadow) return;
    const typing = assistantShadow.getElementById('typing-indicator');
    if (typing) typing.remove();
  }

  function init() {
    loadConfig();

    // 1. Initialize Personal Assistant on EVERY page immediately
    initPersonalAssistant();

    // 2. Specialized X history scan if allowed
    setTimeout(() => {
      createHud();
      handleRouteChange();
      if (isAllowedHistoryPage()) {
        scanPage();
      }
      startObserver();
    }, 2500);
  }

  // Initialize config and register bookmark click listener immediately across all of X
  loadConfig();
  initBookmarkEventListener();

  // Graceful boot for Personal Assistant and timeline observer on every webpage
  let hasInited = false;
  function safeInit() {
    if (hasInited) return;
    hasInited = true;
    init();
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    safeInit();
  } else {
    document.addEventListener('DOMContentLoaded', safeInit, { once: true });
    window.addEventListener('load', safeInit, { once: true });
  }
})();

