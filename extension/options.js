/**
 * SoroTracker Options page script
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
      if (typeof res.autoSync === 'boolean') autoSyncInput.checked = res.autoSync;
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
});
