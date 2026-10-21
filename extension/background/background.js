// Background worker: talks to the local LLM on behalf of pages, and wires up menus and shortcuts.
// Loaded after shared/config.js and background/llm.js (see sw.js for Chrome, manifest scripts for Firefox).
(function () {
  'use strict';

  const { ext, getSettings, listModels, chat, normalizeBaseUrl } = globalThis.SoroTrack;

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

  const providerCache = new Map(); // baseUrl -> 'ollama' | 'openai'

  async function getStatus(overrides) {
    const settings = { ...(await getSettings()), ...overrides };
    const baseUrl = normalizeBaseUrl(settings.baseUrl);
    await ensureOriginRewrite(baseUrl);
    const result = await listModels(settings);
    providerCache.set(baseUrl, result.provider);
    const ids = result.models.map((m) => m.id);
    const model = ids.includes(settings.model) ? settings.model : ids[0] || '';
    return { ok: true, ...result, model };
  }

  async function resolveChatSettings(modelOverride) {
    const settings = await getSettings();
    if (modelOverride) settings.model = modelOverride;
    const baseUrl = normalizeBaseUrl(settings.baseUrl);
    await ensureOriginRewrite(baseUrl);

    let provider = settings.provider !== 'auto' ? settings.provider : providerCache.get(baseUrl);
    if (!provider || !settings.model) {
      const status = await getStatus({ model: settings.model });
      provider = status.provider;
      settings.model = settings.model || status.model;
    }
    return { settings, provider };
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
        const { settings, provider } = await resolveChatSettings(msg.model);
        const text = await chat({
          settings,
          provider,
          messages: msg.messages,
          json: Boolean(msg.json),
          signal: controller.signal,
          onToken: (token) => post({ type: 'token', text: token }),
          onThinking: () => {
            if (!sentThinking) post({ type: 'thinking' });
            sentThinking = true;
          },
        });
        post({ type: 'done', text, model: settings.model });
      } catch (err) {
        if (err && err.name === 'AbortError') return;
        post({ type: 'error', ...errorPayload(err) });
      }
    });
  });

  // ---------------------------------------------------------------------------
  // One-shot messages from content scripts and extension pages
  // ---------------------------------------------------------------------------

  const handlers = {
    'llm:status': (msg) => getStatus(msg.overrides || {}),
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
  getSettings()
    .then((s) => ensureOriginRewrite(normalizeBaseUrl(s.baseUrl)))
    .catch(() => {});
  ext.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.settings) {
      providerCache.clear();
      const next = changes.settings.newValue || {};
      if (next.baseUrl) ensureOriginRewrite(normalizeBaseUrl(next.baseUrl)).catch(() => {});
    }
  });
})();
