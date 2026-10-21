(function () {
  'use strict';

  const S = globalThis.SoroTrack;
  const { ext, DEFAULT_SETTINGS, PROVIDER_PRESETS, CLOUD_PROVIDERS } = S;
  const $ = (id) => document.getElementById(id);
  const TEXT_FIELDS = ['baseUrl', 'provider', 'apiKey', 'slopMode', 'cloudProvider', 'customBaseUrl'];
  const NUMBER_FIELDS = ['temperature', 'contextWindow', 'maxPageChars'];
  const CHECK_FIELDS = ['allowThinking', 'showLauncher'];

  let saved = { ...DEFAULT_SETTINGS }; // last saved settings, for fields this page doesn't show
  let hiddenSites = [];
  let pendingKeys = {}; // keys typed on this page, not yet saved
  let savedKeys = {}; // provider -> last 4 characters of the saved key (the page never gets the key itself)
  let modelChoice = { local: '', cloud: {} }; // model picked per connection while editing
  let testRun = 0;

  const source = () => document.querySelector('input[name="source"]:checked')?.value || 'local';
  const currentModelKey = () => (source() === 'cloud' ? $('cloudProvider').value : 'local');

  function rememberModel() {
    const value = $('model').value;
    if (currentModelKey() === 'local') modelChoice.local = value;
    else modelChoice.cloud[currentModelKey()] = value;
  }

  function chosenModel() {
    return currentModelKey() === 'local' ? modelChoice.local : modelChoice.cloud[currentModelKey()] || '';
  }

  function readForm() {
    rememberModel();
    const values = { ...saved, source: source(), hiddenSites, model: modelChoice.local, cloudModels: { ...modelChoice.cloud } };
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
    saved = settings;
    for (const id of [...TEXT_FIELDS, ...NUMBER_FIELDS]) $(id).value = settings[id];
    for (const id of CHECK_FIELDS) $(id).checked = Boolean(settings[id]);
    document.querySelector(`input[name="source"][value="${settings.source === 'cloud' ? 'cloud' : 'local'}"]`).checked = true;
    modelChoice = { local: settings.model || '', cloud: { ...(settings.cloudModels || {}) } };
    hiddenSites = [...(settings.hiddenSites || [])];
    renderSites();
    showSource();
  }

  // Shows the fields for the selected source/provider and resets the model list.
  function showSource() {
    const cloud = source() === 'cloud';
    $('localFields').hidden = cloud;
    $('cloudFields').hidden = !cloud;
    const provider = S.cloudProvider($('cloudProvider').value);
    $('customBaseUrlField').hidden = provider.id !== 'custom';
    showKeyField();
    $('keyLink').hidden = !provider.keyUrl;
    if (provider.keyUrl) $('keyLink').href = provider.keyUrl;
    $('cloudName').textContent = provider.id === 'custom' ? 'that API' : provider.label;
    $('modelHint').textContent = cloud
      ? 'Larger models give better summaries and filtering; smaller ones are faster and cheaper.'
      : 'Smaller models (3–8B) answer faster; larger ones summarize and filter better.';
    setModelOptions([], chosenModel());
    $('result').hidden = true;
  }

  function showKeyField() {
    const id = $('cloudProvider').value;
    const provider = S.cloudProvider(id);
    $('cloudKey').value = pendingKeys[id] || '';
    $('cloudKey').placeholder = savedKeys[id]
      ? `Saved key ending in …${savedKeys[id]} — paste a new key to replace it`
      : provider.keyPlaceholder || 'API key';
    $('removeKey').hidden = !savedKeys[id];
  }

  const hasKey = (id) => Boolean(pendingKeys[id] || savedKeys[id]);

  function setModelOptions(models, selected, suggested = '') {
    const select = $('model');
    const ids = models.map((m) => m.id);
    if (selected && !ids.includes(selected)) ids.unshift(selected);
    select.replaceChildren(new Option(suggested ? `Recommended (${suggested})` : 'Recommended', ''));
    for (const id of ids) {
      const info = models.find((m) => m.id === id);
      const label = info && info.name && info.name !== id ? `${info.name} (${id})` : id;
      select.append(new Option(info && info.size ? `${label} · ${info.size}` : label, id));
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
    const run = ++testRun;
    const connection = S.resolveConnection(form);
    showResult('connecting', `Connecting to ${connection.cloud ? connection.label : form.baseUrl}…`);
    $('test').disabled = true;
    try {
      // Typed keys are tested before saving; otherwise the background uses the saved, encrypted key.
      const res = await ext.runtime.sendMessage({ type: 'llm:status', overrides: { settings: form, apiKeys: { ...pendingKeys } } });
      if (run !== testRun) return; // a newer test started (source or provider changed)
      if (!res || res.ok === false) {
        showResult('offline', (res && res.error) || 'Connection failed.', res && res.hint);
        return;
      }
      const where = res.cloud ? res.providerLabel : `${res.api === 'ollama' ? 'Ollama' : 'OpenAI-compatible API'} at ${res.baseUrl}`;
      const count = res.models.length;
      showResult(
        'ready',
        `Connected to ${where} — ${count} chat model${count === 1 ? '' : 's'} available.`,
        count ? '' : res.cloud ? 'This key has no chat models available.' : 'Download a model first, for example: ollama pull llama3.2'
      );
      setModelOptions(res.models, chosenModel(), res.model);
    } finally {
      if (run === testRun) $('test').disabled = false;
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

  for (const provider of CLOUD_PROVIDERS) $('cloudProvider').append(new Option(provider.label, provider.id));

  // Each source/provider keeps its own model choice; rememberModel records it as it changes.
  $('model').addEventListener('change', rememberModel);
  for (const radio of document.querySelectorAll('input[name="source"]')) {
    radio.addEventListener('change', () => {
      showSource();
      if (source() === 'local' || hasKey($('cloudProvider').value)) testConnection();
    });
  }
  $('cloudProvider').addEventListener('change', () => {
    showSource();
    if (hasKey($('cloudProvider').value)) testConnection();
  });

  $('cloudKey').addEventListener('input', () => {
    const value = $('cloudKey').value.trim();
    if (value) pendingKeys[$('cloudProvider').value] = value;
    else delete pendingKeys[$('cloudProvider').value];
  });
  $('cloudKey').addEventListener('change', () => {
    if ($('cloudKey').value.trim()) testConnection();
  });
  $('toggleKey').addEventListener('click', () => {
    const show = $('cloudKey').type === 'password';
    $('cloudKey').type = show ? 'text' : 'password';
    $('toggleKey').textContent = show ? 'Hide' : 'Show';
  });

  $('removeKey').addEventListener('click', async () => {
    const id = $('cloudProvider').value;
    if (!confirm(`Remove the saved ${S.cloudProvider(id).label} API key from this browser?`)) return;
    const res = await ext.runtime.sendMessage({ type: 'keys:remove', provider: id });
    if (res && res.ok) savedKeys = res.keys;
    delete pendingKeys[id];
    showKeyField();
    $('result').hidden = true;
  });

  $('test').addEventListener('click', testConnection);

  $('form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (Object.keys(pendingKeys).length) {
      const res = await ext.runtime.sendMessage({ type: 'keys:set', keys: pendingKeys });
      if (!res || !res.ok) {
        $('saved').textContent = `Couldn't save the API key: ${(res && res.error) || 'unknown error'}`;
        return;
      }
      savedKeys = res.keys;
      pendingKeys = {};
      showKeyField();
    }
    saved = await S.saveSettings(readForm());
    $('saved').textContent = 'Saved.';
    setTimeout(() => ($('saved').textContent = ''), 2500);
  });

  Promise.all([S.getSettings(), ext.runtime.sendMessage({ type: 'keys:describe' })]).then(([settings, res]) => {
    savedKeys = (res && res.keys) || {};
    const keys = savedKeys;
    fillForm(settings);
    if (settings.source !== 'cloud' || keys[settings.cloudProvider]) testConnection();
  });
})();
