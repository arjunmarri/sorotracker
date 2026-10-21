(function () {
  'use strict';

  const { ext, getSettings, saveSettings, PROVIDER_PRESETS, DEFAULT_SETTINGS } = globalThis.SoroTrack;
  const $ = (id) => document.getElementById(id);
  const TEXT_FIELDS = ['baseUrl', 'provider', 'apiKey', 'slopMode'];
  const NUMBER_FIELDS = ['temperature', 'contextWindow', 'maxPageChars'];
  const CHECK_FIELDS = ['allowThinking', 'showLauncher'];

  let hiddenSites = [];

  function readForm() {
    const values = { model: $('model').value, hiddenSites };
    for (const id of TEXT_FIELDS) values[id] = $(id).value.trim();
    for (const id of NUMBER_FIELDS) {
      const n = Number($(id).value);
      values[id] = Number.isFinite(n) && $(id).value !== '' ? n : DEFAULT_SETTINGS[id];
    }
    for (const id of CHECK_FIELDS) values[id] = $(id).checked;
    values.baseUrl = values.baseUrl || DEFAULT_SETTINGS.baseUrl;
    return values;
  }

  function fillForm(settings) {
    for (const id of [...TEXT_FIELDS, ...NUMBER_FIELDS]) $(id).value = settings[id];
    for (const id of CHECK_FIELDS) $(id).checked = Boolean(settings[id]);
    setModelOptions([], settings.model);
    hiddenSites = [...(settings.hiddenSites || [])];
    renderSites();
  }

  function setModelOptions(models, selected) {
    const select = $('model');
    const ids = models.map((m) => m.id);
    if (selected && !ids.includes(selected)) ids.unshift(selected);
    select.replaceChildren(new Option('First available model', ''));
    for (const id of ids) {
      const info = models.find((m) => m.id === id);
      select.append(new Option(info && info.size ? `${id} · ${info.size}` : id, id));
    }
    select.value = selected || '';
  }

  function renderSites() {
    const box = $('sites');
    box.replaceChildren();
    if (!hiddenSites.length) {
      box.append(Object.assign(document.createElement('span'), { className: 'muted', textContent: 'None' }));
      return;
    }
    for (const site of hiddenSites) {
      const chip = document.createElement('span');
      chip.className = 'site';
      chip.textContent = site;
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.textContent = '×';
      remove.setAttribute('aria-label', `Show the button on ${site} again`);
      remove.addEventListener('click', () => {
        hiddenSites = hiddenSites.filter((s) => s !== site);
        renderSites();
      });
      chip.append(remove);
      box.append(chip);
    }
  }

  function showResult(kind, title, detail) {
    $('result').hidden = false;
    $('resultDot').className = `dot ${kind}`;
    const text = $('resultText');
    text.replaceChildren(Object.assign(document.createElement('div'), { textContent: title }));
    if (detail) text.append(Object.assign(document.createElement('pre'), { textContent: detail }));
  }

  async function testConnection() {
    const form = readForm();
    showResult('connecting', `Connecting to ${form.baseUrl}…`);
    $('test').disabled = true;
    try {
      const res = await ext.runtime.sendMessage({
        type: 'llm:status',
        overrides: { baseUrl: form.baseUrl, provider: form.provider, apiKey: form.apiKey, model: form.model },
      });
      if (!res || res.ok === false) {
        showResult('offline', (res && res.error) || 'Connection failed.', res && res.hint);
        return;
      }
      const api = res.provider === 'ollama' ? 'Ollama' : 'OpenAI-compatible API';
      showResult(
        'ready',
        `Connected to ${api} at ${res.baseUrl} — ${res.models.length} chat model${res.models.length === 1 ? '' : 's'} available.`,
        res.models.length ? '' : 'Download a model first, for example: ollama pull llama3.2'
      );
      setModelOptions(res.models, form.model);
    } finally {
      $('test').disabled = false;
    }
  }

  for (const preset of PROVIDER_PRESETS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn small';
    button.textContent = preset.label;
    button.addEventListener('click', () => {
      $('baseUrl').value = preset.baseUrl;
      $('provider').value = preset.provider;
      testConnection();
    });
    $('presets').append(button);
  }

  $('test').addEventListener('click', testConnection);

  $('form').addEventListener('submit', async (e) => {
    e.preventDefault();
    await saveSettings(readForm());
    $('saved').textContent = 'Saved.';
    setTimeout(() => ($('saved').textContent = ''), 2500);
  });

  getSettings().then((settings) => {
    fillForm(settings);
    testConnection();
  });
})();
