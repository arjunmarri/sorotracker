// Background worker: talks to the local LLM on behalf of pages, and wires up menus and shortcuts.
// Loaded after shared/config.js and background/llm.js (see sw.js for Chrome, manifest scripts for Firefox).
(function () {
  'use strict';

  const { ext, getSettings, resolveConnection, listModels, chat, normalizeBaseUrl, createSecretStore } = globalThis.SoroTrack;

  const secrets = createSecretStore();
  // Keys saved in plain text by 2.1.0 are encrypted and removed from chrome.storage on first run.
  const migrated = secrets.migrateFrom(ext.storage.local).catch((err) => console.warn('[SoroTrack] Key migration failed:', err));

  // ---------------------------------------------------------------------------
  // Origin rewriting
  //
  // Ollama answers 403 to requests whose Origin is chrome-extension:// or moz-extension://
  // unless OLLAMA_ORIGINS is configured. We rewrite the Origin of *our own* background
  // requests to the server's own origin, which it always accepts. Web pages are never affected.
  // ---------------------------------------------------------------------------

  const ORIGIN_RULE_ID = 1;
  const extensionBase = ext.runtime.getURL('');
  const manifestPermissions = ext.runtime.getManifest().permissions || [];
  const useWebRequest = manifestPermissions.includes('webRequestBlocking') && Boolean(ext.webRequest);
  let llmOrigin = '';
  let ruleOrigin = '';

  if (useWebRequest) {
    // Firefox: rewrite with blocking webRequest. Registered synchronously so it survives event-page restarts.
    ext.webRequest.onBeforeSendHeaders.addListener(
      (details) => {
        const fromUs = details.tabId === -1 && (details.originUrl || '').startsWith(extensionBase);
        if (!fromUs || !llmOrigin || !details.url.startsWith(llmOrigin + '/')) return {};
        const requestHeaders = details.requestHeaders.filter((h) => h.name.toLowerCase() !== 'origin');
        requestHeaders.push({ name: 'Origin', value: llmOrigin });
        return { requestHeaders };
      },
      { urls: ['http://*/*', 'https://*/*'], types: ['xmlhttprequest'] },
      ['blocking', 'requestHeaders']
    );
  }

  async function ensureOriginRewrite(baseUrl) {
    llmOrigin = new URL(baseUrl).origin;
    if (useWebRequest || !ext.declarativeNetRequest || ruleOrigin === llmOrigin) return;
    try {
      // Chrome: a session rule limited to requests made by this extension outside any tab.
      await ext.declarativeNetRequest.updateSessionRules({
        removeRuleIds: [ORIGIN_RULE_ID],
        addRules: [
          {
            id: ORIGIN_RULE_ID,
            priority: 1,
            action: {
              type: 'modifyHeaders',
              requestHeaders: [{ header: 'origin', operation: 'set', value: llmOrigin }],
            },
            condition: {
              urlFilter: `|${llmOrigin}/`,
              tabIds: [-1],
              initiatorDomains: [ext.runtime.id],
              resourceTypes: ['xmlhttprequest', 'other'],
            },
          },
        ],
      });
      ruleOrigin = llmOrigin;
    } catch (err) {
      console.warn('[SoroTrack] Could not install origin rule:', err);
    }
  }

  // ---------------------------------------------------------------------------
  // LLM access
  // ---------------------------------------------------------------------------

  const apiCache = new Map(); // local baseUrl -> 'ollama' | 'openai' (for "auto" detection)

  // overrides: { settings, apiKeys } — lets the settings page test values before saving them.
  // Callers must only pass overrides that came from an extension page (see fromExtensionPage).
  async function getConnection(overrides = {}) {
    await migrated;
    const settings = { ...(await getSettings()), ...(overrides.settings || {}) };
    const apiKeys = { ...(await secrets.getAll()), ...(overrides.apiKeys || {}) };
    const connection = resolveConnection(settings, apiKeys);
    // Only local servers need the Origin rewrite; hosted APIs accept extension requests.
    if (!connection.cloud) await ensureOriginRewrite(normalizeBaseUrl(connection.baseUrl));
    return connection;
  }

  async function getStatus(overrides) {
    const connection = await getConnection(overrides);
    const result = await listModels(connection);
    if (!connection.cloud) apiCache.set(result.baseUrl, result.api);
    const ids = result.models.map((m) => m.id);
    let model = connection.model;
    if (!model || (!connection.cloud && !ids.includes(model))) model = result.suggested;
    // Hosted APIs accept models that aren't listed (aliases, new releases): keep the user's choice.
    if (model && !ids.includes(model)) result.models.unshift({ id: model, size: '', capabilities: [] });
    return {
      ok: true,
      api: result.api,
      baseUrl: result.baseUrl,
      models: result.models,
      model,
      cloud: connection.cloud,
      providerLabel: connection.label,
    };
  }

  async function resolveChat(modelOverride) {
    const connection = await getConnection();
    if (modelOverride) connection.model = modelOverride;
    let api = connection.api === 'auto' ? apiCache.get(normalizeBaseUrl(connection.baseUrl)) : connection.api;
    if (!api || !connection.model) {
      const status = await getStatus();
      api = status.api;
      connection.model = connection.model || status.model;
    }
    return { connection, api };
  }

  function errorPayload(err) {
    return { ok: false, code: err.code || 'error', error: err.message || String(err), hint: err.hint || '' };
  }

  // Long-lived port per request. The content script pings it while waiting, which also keeps
  // Chrome's service worker alive during slow model loads.
  ext.runtime.onConnect.addListener((port) => {
    if (port.name !== 'llm') return;
    const controller = new AbortController();
    let open = true;
    port.onDisconnect.addListener(() => {
      open = false;
      controller.abort();
    });
    const post = (msg) => {
      if (!open) return;
      try {
        port.postMessage(msg);
      } catch {
        open = false;
      }
    };

    port.onMessage.addListener(async (msg) => {
      if (!msg || msg.type !== 'chat') return;
      let sentThinking = false;
      try {
        const { connection, api } = await resolveChat(msg.model);
        const text = await chat({
          connection,
          api,
          messages: msg.messages,
          json: Boolean(msg.json),
          signal: controller.signal,
          onToken: (token) => post({ type: 'token', text: token }),
          onThinking: () => {
            if (!sentThinking) post({ type: 'thinking' });
            sentThinking = true;
          },
        });
        post({ type: 'done', text, model: connection.model });
      } catch (err) {
        if (err && err.name === 'AbortError') return;
        post({ type: 'error', ...errorPayload(err) });
      }
    });
  });

  // ---------------------------------------------------------------------------
  // One-shot messages from content scripts and extension pages
  // ---------------------------------------------------------------------------

  // True for SoroTrack's own pages (settings, popup, snippets); false for content scripts in web pages.
  function fromExtensionPage(sender) {
    return Boolean(sender && sender.id === ext.runtime.id && (sender.url || '').startsWith(extensionBase));
  }

  function requireExtensionPage(sender) {
    if (!fromExtensionPage(sender)) throw new Error('Not allowed from a web page.');
  }

  // Bumped whenever keys change, so open pages can reconnect without ever seeing a key.
  const announceKeysChanged = () => ext.storage.local.set({ keysVersion: Date.now() });

  const handlers = {
    // Only extension pages may test unsaved values: overrides can redirect a key to another URL.
    'llm:status': (msg, sender) => getStatus(fromExtensionPage(sender) ? msg.overrides || {} : {}),
    'keys:describe': async (msg, sender) => {
      requireExtensionPage(sender);
      await migrated;
      return { ok: true, keys: await secrets.describe() };
    },
    'keys:set': async (msg, sender) => {
      requireExtensionPage(sender);
      await migrated;
      for (const [provider, key] of Object.entries(msg.keys || {})) {
        if (typeof key === 'string' && key.trim()) await secrets.set(provider, key);
      }
      await announceKeysChanged();
      return { ok: true, keys: await secrets.describe() };
    },
    'keys:remove': async (msg, sender) => {
      requireExtensionPage(sender);
      await migrated;
      await secrets.remove(String(msg.provider || ''));
      await announceKeysChanged();
      return { ok: true, keys: await secrets.describe() };
    },
    'open:snippets': () => ext.tabs.create({ url: ext.runtime.getURL('pages/snippets.html') }),
    'open:options': () => ext.runtime.openOptionsPage(),
  };

  ext.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    const handler = msg && handlers[msg.type];
    if (!handler) return false;
    Promise.resolve()
      .then(() => handler(msg, sender))
      .then((result) => sendResponse(result === undefined ? { ok: true } : result))
      .catch((err) => sendResponse(errorPayload(err)));
    return true; // respond asynchronously
  });

  // ---------------------------------------------------------------------------
  // Talking to the assistant in a tab
  // ---------------------------------------------------------------------------

  async function sendToTab(tabId, message) {
    try {
      return await ext.tabs.sendMessage(tabId, message);
    } catch {
      // Tab was open before the extension was installed or reloaded: inject and retry.
      const files = ext.runtime.getManifest().content_scripts[0].js;
      await ext.scripting.executeScript({ target: { tabId }, files });
      return ext.tabs.sendMessage(tabId, message);
    }
  }

  async function sendToActiveTab(message) {
    const [tab] = await ext.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.id !== undefined) return sendToTab(tab.id, message);
  }

  handlers['assistant:open-in-active-tab'] = (msg) => sendToActiveTab({ type: 'assistant:run', action: msg.action || 'open' });

  const MENU_ITEMS = [
    { id: 'sorotrack-save-selection', title: 'Save selection as snippet', contexts: ['selection'], action: 'snippet' },
    { id: 'sorotrack-summarize', title: 'Summarize this page', contexts: ['page'], action: 'summarize' },
    { id: 'sorotrack-slop', title: 'Remove AI slop from this page', contexts: ['page'], action: 'slop' },
  ];

  async function createMenus() {
    await ext.contextMenus.removeAll();
    for (const item of MENU_ITEMS) {
      ext.contextMenus.create({ id: item.id, title: item.title, contexts: item.contexts });
    }
  }

  ext.contextMenus.onClicked.addListener((info, tab) => {
    const item = MENU_ITEMS.find((m) => m.id === info.menuItemId);
    if (!item || !tab || tab.id === undefined) return;
    sendToTab(tab.id, { type: 'assistant:run', action: item.action, selectionText: info.selectionText || '' }).catch(
      (err) => console.warn('[SoroTrack] Could not reach the page:', err)
    );
  });

  ext.commands.onCommand.addListener((command) => {
    if (command === 'toggle-assistant') {
      sendToActiveTab({ type: 'assistant:toggle' }).catch((err) => console.warn('[SoroTrack]', err));
    }
  });

  ext.runtime.onInstalled.addListener((details) => {
    createMenus();
    if (details.reason === 'install') ext.runtime.openOptionsPage();
  });
  ext.runtime.onStartup.addListener(createMenus);

  // Keep the Firefox rewrite target current even before the first request after a restart.
  getConnection().catch(() => {});
  ext.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && (changes.settings || changes.keysVersion)) {
      apiCache.clear();
      getConnection().catch(() => {});
    }
  });
})();
