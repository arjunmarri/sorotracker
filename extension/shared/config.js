// Settings shared by the background worker, content scripts and extension pages.
(function (root) {
  'use strict';

  const SoroTrack = (root.SoroTrack = root.SoroTrack || {});

  // Firefox exposes promise-based APIs on `browser`; Chrome MV3 returns promises on `chrome`.
  // Check `runtime.id` because a page element with id="browser" also shows up as window.browser.
  const ext =
    root.browser && root.browser.runtime && root.browser.runtime.id ? root.browser : root.chrome;

  const DEFAULT_SETTINGS = Object.freeze({
    baseUrl: 'http://127.0.0.1:11434',
    provider: 'auto', // 'auto' | 'ollama' | 'openai'
    model: '',
    apiKey: '',
    temperature: 0.3,
    contextWindow: 8192, // Ollama num_ctx; its default is too small for whole pages
    maxPageChars: 12000,
    allowThinking: false,
    showLauncher: true,
    slopMode: 'hide', // 'hide' | 'dim'
    hiddenSites: [],
  });

  const PROVIDER_PRESETS = Object.freeze([
    { id: 'ollama', label: 'Ollama', baseUrl: 'http://127.0.0.1:11434', provider: 'ollama' },
    { id: 'lmstudio', label: 'LM Studio', baseUrl: 'http://127.0.0.1:1234/v1', provider: 'openai' },
    { id: 'llamacpp', label: 'llama.cpp server', baseUrl: 'http://127.0.0.1:8080/v1', provider: 'openai' },
    { id: 'jan', label: 'Jan', baseUrl: 'http://127.0.0.1:1337/v1', provider: 'openai' },
  ]);

  async function getSettings() {
    const stored = await ext.storage.local.get('settings');
    return { ...DEFAULT_SETTINGS, ...(stored.settings || {}) };
  }

  async function saveSettings(patch) {
    const next = { ...(await getSettings()), ...patch };
    await ext.storage.local.set({ settings: next });
    return next;
  }

  Object.assign(SoroTrack, { ext, DEFAULT_SETTINGS, PROVIDER_PRESETS, getSettings, saveSettings });
})(globalThis);
