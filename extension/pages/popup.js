(function () {
  'use strict';

  const { ext, listSnippets } = globalThis.SoroTrack;
  const $ = (id) => document.getElementById(id);

  async function showStatus() {
    const res = await ext.runtime.sendMessage({ type: 'llm:status' });
    if (res && res.ok) {
      $('dot').className = 'dot ready';
      const where = res.cloud ? res.providerLabel : 'Local';
      $('status').textContent = res.model ? `${where} · ${res.model}` : 'Connected, but no models available';
      $('status').title = res.cloud ? `${res.providerLabel} API` : `${res.baseUrl} (${res.api === 'ollama' ? 'Ollama' : 'OpenAI-compatible'})`;
    } else {
      $('dot').className = 'dot offline';
      $('status').textContent = (res && res.error) || 'Not connected';
      $('status').title = (res && res.hint) || '';
    }
  }

  async function checkTab() {
    const [tab] = await ext.tabs.query({ active: true, currentWindow: true });
    const usable = tab && /^https?:/.test(tab.url || '');
    if (!usable) {
      for (const id of ['open', 'summarize', 'slop']) $(id).disabled = true;
      $('note').textContent = "The assistant can't run on this page (browser and store pages are off-limits).";
    }
  }

  async function runInTab(action) {
    const res = await ext.runtime.sendMessage({ type: 'assistant:open-in-active-tab', action });
    if (res && res.ok === false) {
      $('note').textContent = `Couldn't reach this page: ${res.error}`;
      return;
    }
    window.close();
  }

  $('open').addEventListener('click', () => runInTab('open'));
  $('summarize').addEventListener('click', () => runInTab('summarize'));
  $('slop').addEventListener('click', () => runInTab('slop'));
  $('snippets').addEventListener('click', () => ext.runtime.sendMessage({ type: 'open:snippets' }).then(() => window.close()));
  $('settings').addEventListener('click', () => ext.runtime.openOptionsPage().then(() => window.close()));

  listSnippets().then((items) => {
    if (items.length) $('snippets').textContent = `Snippets (${items.length})`;
  });
  checkTab();
  showStatus();
})();
