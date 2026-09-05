/**
 * SoroTracker Content Script
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
    autoSync: true,
    syncIntervalSec: 5
  };

  // State
  const scannedRecords = new Map();
  const syncedRecordIds = new Set();
  let isAutoScrolling = false;
  let autoScrollTimer = null;
  let syncTimer = null;
  let isSyncing = false;
  let hudShadowRoot = null;
  let debounceScanTimer = null;
  let observer = null;
  let isScanning = false;

  // Load config and existing JSON storage safely
  function loadConfig() {
    try {
      if (browserAPI?.storage?.local?.get) {
        browserAPI.storage.local.get(['dashboardUrl', 'authToken', 'autoSync', 'syncIntervalSec', 'soro_history_json'], (res) => {
          if (res && res.dashboardUrl) {
            config.dashboardUrl = res.dashboardUrl.replace(/\/+$/, '');
          }
          if (res && typeof res.authToken === 'string') {
            config.authToken = res.authToken.trim();
          }
          if (res && typeof res.autoSync === 'boolean') {
            config.autoSync = res.autoSync;
          }
          if (res && Array.isArray(res.soro_history_json)) {
            res.soro_history_json.forEach(item => {
              if (item && item.id && !scannedRecords.has(item.id)) {
                scannedRecords.set(item.id, item);
              }
            });
          }
          updateHud();
        });
      }
    } catch (e) {
      // Storage access may be restricted in sandboxed iframes; gracefully ignore
    }
  }

  // Persist current records to extension local JSON storage
  function persistRecordsToJsonStorage() {
    try {
      const items = Array.from(scannedRecords.values());
      if (browserAPI?.storage?.local?.set) {
        browserAPI.storage.local.set({
          soro_history_json: items,
          soro_history_count: items.length,
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
      a.download = `sorotracker_archive_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast(`Exported ${items.length} records to JSON file!`);
    } catch (err) {
      showToast('Error generating JSON download.');
    }
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
   * 3. Marks article element so it is never re-parsed
   */
  function parseTweetArticle(article) {
    // Avoid double processing
    if (article.dataset.soroScanned === 'true') {
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

        if (userNameContainer.querySelector('svg[data-testid="icon-verified"]') ||
            userNameContainer.querySelector('svg[aria-label*="Verified"]')) {
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
        tags,
        sourcePage: window.location.href
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
    if (isScanning) return { total: scannedRecords.size, newlyFound: 0 };
    isScanning = true;

    let newlyFound = 0;

    try {
      const articles = document.querySelectorAll('article[data-testid="tweet"]');
      for (let i = 0; i < articles.length; i++) {
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
      if (config.autoSync) {
        scheduleSync();
      }
    }

    return { total: scannedRecords.size, newlyFound };
  }

  // Debounced scan trigger via requestIdleCallback or setTimeout
  function triggerDebouncedScan(delayMs = 1200) {
    if (debounceScanTimer) clearTimeout(debounceScanTimer);
    debounceScanTimer = setTimeout(() => {
      if (typeof window.requestIdleCallback === 'function') {
        window.requestIdleCallback(() => {
          scanPage();
        }, { timeout: 2000 });
      } else {
        scanPage();
      }
    }, delayMs);
  }

  // Schedule a debounced sync to the dashboard
  function scheduleSync() {
    if (syncTimer) clearTimeout(syncTimer);
    syncTimer = setTimeout(() => {
      syncToDashboard(false);
    }, 3000);
  }

  // Send records to the dashboard endpoint
  async function syncToDashboard(forceAll = false) {
    if (isSyncing || scannedRecords.size === 0) return;

    // Differential sync: only send unsynced records during auto-sync to conserve Firestore quota
    const allItems = Array.from(scannedRecords.values());
    const items = forceAll ? allItems : allItems.filter(item => !syncedRecordIds.has(item.id));

    if (items.length === 0) {
      if (forceAll) {
        showToast(`All ${scannedRecords.size} scanned posts are already synced to SoroTracker.`);
      }
      return;
    }

    isSyncing = true;
    updateHud();

    const endpoint = `${config.dashboardUrl}/api/sync`;

    try {
      showToast(`Pushing ${items.length} records to SoroTracker...`);

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
            syncResult = bgResponse.result;
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
            records: items,
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

      // Mark confirmed items as synced
      items.forEach(it => syncedRecordIds.add(it.id));

      if (syncResult?.isQuotaExhausted) {
        showToast(`Synced ${items.length} records! Saved to local cache (Cloud write limit reached for today).`, 5000);
      } else {
        const gcpNotice = syncResult?.collection ? ` -> GCP [${syncResult.collection}]` : '';
        showToast(`Synced! ${syncResult?.total || scannedRecords.size} records stored${gcpNotice}`);
      }
      persistRecordsToJsonStorage();
    } catch (err) {
      showToast(`Notice: ${err.message || 'Middleware unreachable'}`, 5000);
    } finally {
      isSyncing = false;
      updateHud();
    }
  }

  // Smooth, cooperative auto-scroll
  function toggleAutoScroll() {
    if (isAutoScrolling) {
      stopAutoScroll();
    } else {
      startAutoScroll();
    }
  }

  function startAutoScroll() {
    isAutoScrolling = true;
    showToast('Auto-scroll started. Scrolling gently through history...');
    updateHud();

    let unchangedCount = 0;
    let prevHeight = document.documentElement.scrollHeight;

    autoScrollTimer = setInterval(() => {
      // Gentle scroll of 500px so X's virtual scroll can render smoothly
      window.scrollBy({ top: 500, behavior: 'smooth' });
      triggerDebouncedScan(800);

      const curHeight = document.documentElement.scrollHeight;
      if (curHeight === prevHeight) {
        unchangedCount++;
        if (unchangedCount > 10) {
          stopAutoScroll();
          showToast('End of history or page idle.');
        }
      } else {
        unchangedCount = 0;
        prevHeight = curHeight;
      }
    }, 2400); // Friendly 2.4s interval prevents high CPU in Firefox
  }

  function stopAutoScroll() {
    isAutoScrolling = false;
    if (autoScrollTimer) {
      clearInterval(autoScrollTimer);
      autoScrollTimer = null;
    }
    updateHud();
    showToast('Auto-scroll paused.');
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
          width: 250px;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
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
          background: #10B981;
          border-radius: 50%;
          box-shadow: 0 0 6px #10B981;
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
        .stats {
          display: flex;
          gap: 8px;
          margin-bottom: 10px;
        }
        .stat-box {
          flex: 1;
          background: #1A1F26;
          border: 1px solid #2D333B;
          border-radius: 6px;
          padding: 6px;
          text-align: center;
        }
        .stat-val {
          display: block;
          font-size: 16px;
          font-weight: 700;
          color: #38BDF8;
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        }
        .stat-lbl {
          display: block;
          font-size: 10px;
          color: #8B949E;
          text-transform: uppercase;
          letter-spacing: 0.5px;
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
        }
        .toast.show {
          transform: translateX(-50%) translateY(0);
          opacity: 1;
        }
      </style>
      <div class="hud">
        <div class="hud-header">
          <div class="title">
            <span class="dot"></span>
            <span>SoroTracker</span>
          </div>
          <button id="min-btn" class="btn-min" title="Minimize/Maximize">_</button>
        </div>
        <div id="body" class="hud-body">
          <div class="stats">
            <div class="stat-box">
              <span id="stat-posts" class="stat-val">0</span>
              <span class="stat-lbl">Posts</span>
            </div>
            <div class="stat-box">
              <span id="stat-links" class="stat-val">0</span>
              <span class="stat-lbl">Links</span>
            </div>
          </div>
          <div class="actions">
            <button id="scan-btn" class="btn btn-primary">Scan Visible</button>
            <button id="scroll-btn" class="btn btn-secondary">Auto-Scroll</button>
            <button id="sync-btn" class="btn btn-accent">Sync to SoroTracker</button>
            <button id="export-json-btn" class="btn btn-secondary">Export JSON File</button>
          </div>
          <div class="footer">
            <a id="dash-link" href="${config.dashboardUrl}" target="_blank" class="link">
              Open SoroTracker &rarr;
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

    shadow.getElementById('scroll-btn')?.addEventListener('click', () => {
      toggleAutoScroll();
    });

    shadow.getElementById('sync-btn')?.addEventListener('click', () => {
      syncToDashboard(true);
    });

    shadow.getElementById('export-json-btn')?.addEventListener('click', () => {
      exportJsonArchive();
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

    updateHud();
  }

  function updateHud() {
    if (!hudShadowRoot) return;

    const postsEl = hudShadowRoot.getElementById('stat-posts');
    const linksEl = hudShadowRoot.getElementById('stat-links');
    const scrollBtn = hudShadowRoot.getElementById('scroll-btn');
    const syncBtn = hudShadowRoot.getElementById('sync-btn');
    const dashLink = hudShadowRoot.getElementById('dash-link');

    let totalLinks = 0;
    scannedRecords.forEach(r => {
      totalLinks += (r.links ? r.links.length : 0);
    });

    if (postsEl) postsEl.textContent = scannedRecords.size.toString();
    if (linksEl) linksEl.textContent = totalLinks.toString();

    if (scrollBtn) {
      scrollBtn.textContent = isAutoScrolling ? 'Stop Auto-Scroll' : 'Auto-Scroll';
      scrollBtn.classList.toggle('active', isAutoScrolling);
    }

    if (syncBtn) {
      syncBtn.textContent = isSyncing ? 'Syncing to SoroTracker...' : 'Sync to SoroTracker';
      syncBtn.disabled = isSyncing;
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
        const res = scanPage();
        sendResponse({ success: true, count: res.total, newlyFound: res.newlyFound });
      } else if (request.type === 'GET_STATUS') {
        sendResponse({
          count: scannedRecords.size,
          isAutoScrolling,
          dashboardUrl: config.dashboardUrl
        });
      } else if (request.type === 'SYNC_NOW') {
        syncToDashboard(true).then(() => {
          sendResponse({ success: true, count: scannedRecords.size });
        });
        return true;
      } else if (request.type === 'EXPORT_JSON') {
        exportJsonArchive();
        sendResponse({ success: true, count: scannedRecords.size });
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

      if (relevantAddition) {
        triggerDebouncedScan(1000);
      }
    });

    observer.observe(targetNode, {
      childList: true,
      subtree: true
    });
  }

  function init() {
    loadConfig();

    // Do not inject HUD or scan during critical initial load.
    // Allow X's React hydration 2.5 seconds to settle completely.
    setTimeout(() => {
      createHud();
      scanPage();
      startObserver();
    }, 2500);
  }

  // Graceful boot
  if (document.readyState === 'complete') {
    init();
  } else {
    window.addEventListener('load', init, { once: true });
  }
})();
