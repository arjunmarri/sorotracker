/**
 * Popup Script for X History Scanner
 * Compatible with Firefox & Chrome
 */

const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

document.addEventListener('DOMContentLoaded', () => {
  const tabStatusEl = document.getElementById('tab-status');
  const scannedCountEl = document.getElementById('scanned-count');
  const scanBtn = document.getElementById('scan-btn');
  const syncBtn = document.getElementById('sync-btn');
  const openXBtn = document.getElementById('open-x-btn');
  const dashUrlInput = document.getElementById('dash-url');
  const authTokenInput = document.getElementById('auth-token');
  const openDashLink = document.getElementById('open-dash-link');

  let activeTabId = null;

  // Load saved dashboard URL and auth token
  browserAPI.storage.local.get(['dashboardUrl', 'authToken'], (res) => {
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

    if (url.includes('x.com/i/history') || url.includes('twitter.com/i/history')) {
      tabStatusEl.textContent = 'History Page (Active)';
      tabStatusEl.style.color = '#10b981';
      fetchTabStatus();
    } else if (url.includes('x.com/i/bookmarks') || url.includes('twitter.com/i/bookmarks')) {
      tabStatusEl.textContent = 'Bookmarks Page (Active)';
      tabStatusEl.style.color = '#10b981';
      fetchTabStatus();
    } else if (url.includes('x.com') || url.includes('twitter.com')) {
      tabStatusEl.textContent = 'X.com Feed';
      fetchTabStatus();
    } else {
      tabStatusEl.textContent = 'Not on X.com';
      tabStatusEl.style.color = '#f59e0b';
      scanBtn.disabled = true;
      syncBtn.disabled = true;
    }
  });

  function fetchTabStatus() {
    if (!activeTabId) return;
    browserAPI.tabs.sendMessage(activeTabId, { type: 'GET_STATUS' }, (res) => {
      if (browserAPI.runtime.lastError) {
        // Content script might not be injected yet
        return;
      }
      if (res) {
        scannedCountEl.textContent = res.count || 0;
      }
    });
  }

  scanBtn.addEventListener('click', () => {
    if (!activeTabId) return;
    scanBtn.textContent = 'Scanning...';
    browserAPI.tabs.sendMessage(activeTabId, { type: 'SCAN_PAGE' }, (res) => {
      scanBtn.textContent = 'Scan Current Viewport';
      if (res && typeof res.count === 'number') {
        scannedCountEl.textContent = res.count;
      }
    });
  });

  syncBtn.addEventListener('click', () => {
    if (!activeTabId) return;
    syncBtn.textContent = 'Syncing to SoroTracker...';
    browserAPI.tabs.sendMessage(activeTabId, { type: 'SYNC_NOW' }, (res) => {
      syncBtn.textContent = 'Sync to SoroTracker';
      if (res && res.count) {
        scannedCountEl.textContent = res.count;
      }
    });
  });

  const exportJsonBtn = document.getElementById('export-json-btn');
  exportJsonBtn?.addEventListener('click', () => {
    if (!activeTabId) return;
    exportJsonBtn.textContent = 'Exporting...';
    browserAPI.tabs.sendMessage(activeTabId, { type: 'EXPORT_JSON' }, () => {
      exportJsonBtn.textContent = 'Export JSON Archive';
    });
  });

  openXBtn.addEventListener('click', () => {
    browserAPI.tabs.create({ url: 'https://x.com/i/history' });
  });

  openDashLink.addEventListener('click', (e) => {
    e.preventDefault();
    browserAPI.tabs.create({ url: dashUrlInput.value || 'http://localhost:3000' });
  });
});
