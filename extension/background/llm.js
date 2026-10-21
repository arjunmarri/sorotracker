// Client for local LLM servers: Ollama's native API and any OpenAI-compatible server
// (LM Studio, llama.cpp, Jan, LocalAI, vLLM, ...). No browser APIs, so it runs under Node tests.
(function (root) {
  'use strict';

  const SoroTrack = (root.SoroTrack = root.SoroTrack || {});

  class LLMError extends Error {
    constructor(code, message, hint) {
      super(message);
      this.name = 'LLMError';
      this.code = code;
      this.hint = hint || '';
    }
  }

  const ORIGINS_HINT =
    'The server rejected the browser extension. Allow extension origins and restart it.\n' +
    'macOS: launchctl setenv OLLAMA_ORIGINS "chrome-extension://*,moz-extension://*" then quit and reopen Ollama.\n' +
    'Windows: setx OLLAMA_ORIGINS "chrome-extension://*,moz-extension://*" then quit Ollama from the tray and start it again.';

  function normalizeBaseUrl(raw) {
    let value = String(raw || '').trim() || 'http://127.0.0.1:11434';
    if (!/^https?:\/\//i.test(value)) value = 'http://' + value;
    let url;
    try {
      url = new URL(value);
    } catch {
      throw new LLMError('bad_url', `"${raw}" is not a valid URL.`, 'Use something like http://127.0.0.1:11434');
    }
    let path = url.pathname.replace(/\/+$/, '');
    // People often paste a full endpoint; trim it back to the server root.
    path = path.replace(/\/api(\/(tags|chat|generate|version))?$/i, '');
    path = path.replace(/\/v1\/(models|chat\/completions|completions)$/i, '/v1');
    return url.origin + path;
  }

  function ollamaRoot(baseUrl) {
    return baseUrl.replace(/\/v1$/i, '');
  }

  function openaiRoot(baseUrl) {
    return /\/v1$/i.test(baseUrl) ? baseUrl : baseUrl + '/v1';
  }

  function authHeaders(settings) {
    return settings.apiKey ? { Authorization: `Bearer ${settings.apiKey}` } : {};
  }

  async function request(fetchImpl, url, init, baseUrl) {
    let res;
    try {
      res = await fetchImpl(url, init);
    } catch (err) {
      if (err && err.name === 'AbortError') throw err;
      throw new LLMError(
        'unreachable',
        `Can't reach ${baseUrl}.`,
        'Make sure your local model server is running (for Ollama: open the app or run "ollama serve") and the URL in settings is right.'
      );
    }
    if (res.ok) return res;

    let detail = '';
    try {
      const body = await res.text();
      try {
        const json = JSON.parse(body);
        detail = (json.error && (json.error.message || json.error)) || json.message || body;
      } catch {
        detail = body;
      }
    } catch {
      // ignore unreadable bodies
    }
    detail = String(detail || res.statusText || '').slice(0, 300);

    if (res.status === 403) throw new LLMError('forbidden', `${baseUrl} returned 403 Forbidden.`, ORIGINS_HINT);
    if (res.status === 401) {
      throw new LLMError('unauthorized', 'The server needs an API key.', 'Add the key in SoroTrack settings.');
    }
    if (res.status === 404 && /model/i.test(detail)) {
      throw new LLMError('model_missing', detail, 'Pick another model, or pull it first (for example "ollama pull llama3.2").');
    }
    throw new LLMError('http', `Server error ${res.status}${detail ? `: ${detail}` : ''}`);
  }

  function isChatModel(model) {
    const caps = model.capabilities;
    if (Array.isArray(caps) && caps.length) return caps.includes('completion');
    return !/embed/i.test(model.id);
  }

  async function listOllamaModels(baseUrl, settings, fetchImpl) {
    const res = await request(fetchImpl, `${ollamaRoot(baseUrl)}/api/tags`, { headers: authHeaders(settings) }, baseUrl);
    const json = await res.json();
    if (!json || !Array.isArray(json.models)) throw new LLMError('not_ollama', 'Not an Ollama server.');
    return json.models.map((m) => ({
      id: m.name || m.model,
      size: (m.details && m.details.parameter_size) || '',
      capabilities: m.capabilities || [],
    }));
  }

  async function listOpenAIModels(baseUrl, settings, fetchImpl) {
    const res = await request(fetchImpl, `${openaiRoot(baseUrl)}/models`, { headers: authHeaders(settings) }, baseUrl);
    const json = await res.json();
    if (!json || !Array.isArray(json.data)) throw new LLMError('not_openai', 'Not an OpenAI-compatible server.');
    return json.data.map((m) => ({ id: m.id, size: '', capabilities: [] }));
  }

  // Returns { provider, baseUrl, models }. With provider "auto", tries Ollama first, then OpenAI-style.
  async function listModels(settings, fetchImpl = root.fetch.bind(root)) {
    const baseUrl = normalizeBaseUrl(settings.baseUrl);
    const order =
      settings.provider === 'ollama' ? ['ollama']
      : settings.provider === 'openai' ? ['openai']
      : /\/v1$/i.test(baseUrl) ? ['openai', 'ollama']
      : ['ollama', 'openai'];

    let firstError;
    for (const provider of order) {
      try {
        const lister = provider === 'ollama' ? listOllamaModels : listOpenAIModels;
        const models = (await lister(baseUrl, settings, fetchImpl)).filter(isChatModel);
        return { provider, baseUrl, models };
      } catch (err) {
        // A transport-level failure won't be fixed by trying the other API shape.
        if (err && (err.name === 'AbortError' || ['unreachable', 'forbidden', 'unauthorized'].includes(err.code))) throw err;
        firstError = firstError || err;
      }
    }
    throw firstError || new LLMError('unknown', 'No compatible model server found.');
  }

  // Splits a byte stream into lines, calling onLine for each complete one.
  async function readLines(body, onLine) {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let newline;
        while ((newline = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, newline).trim();
          buffer = buffer.slice(newline + 1);
          if (line && onLine(line) === false) return;
        }
      }
      const rest = (buffer + decoder.decode()).trim();
      if (rest) onLine(rest);
    } finally {
      reader.cancel().catch(() => {});
    }
  }

  function parseOllamaLine(line) {
    const obj = JSON.parse(line);
    if (obj.error) throw new LLMError('http', String(obj.error));
    return {
      content: (obj.message && obj.message.content) || '',
      thinking: (obj.message && obj.message.thinking) || '',
      done: Boolean(obj.done),
    };
  }

  function parseOpenAILine(line) {
    if (!line.startsWith('data:')) return null;
    const data = line.slice(5).trim();
    if (data === '[DONE]') return { content: '', thinking: '', done: true };
    const obj = JSON.parse(data);
    if (obj.error) throw new LLMError('http', String(obj.error.message || obj.error));
    const delta = (obj.choices && obj.choices[0] && obj.choices[0].delta) || {};
    return {
      content: delta.content || '',
      thinking: delta.reasoning_content || delta.reasoning || '',
      done: false,
    };
  }

  /**
   * Streams a chat completion. Resolves with the full reply text.
   * opts: { settings, provider, messages, json, signal, onToken(text), onThinking() }
   */
  async function chat(opts, fetchImpl = root.fetch.bind(root)) {
    const { settings, messages, json, signal, onToken, onThinking } = opts;
    const baseUrl = normalizeBaseUrl(settings.baseUrl);
    const provider = opts.provider || (settings.provider === 'openai' ? 'openai' : 'ollama');
    if (!settings.model) throw new LLMError('no_model', 'No model selected.', 'Pick a model in the assistant or in settings.');

    let url;
    let body;
    if (provider === 'ollama') {
      url = `${ollamaRoot(baseUrl)}/api/chat`;
      body = {
        model: settings.model,
        messages,
        stream: true,
        options: { temperature: Number(settings.temperature), num_ctx: Number(settings.contextWindow) || 8192 },
      };
      if (!settings.allowThinking) body.think = false;
      if (json) body.format = 'json';
    } else {
      url = `${openaiRoot(baseUrl)}/chat/completions`;
      body = { model: settings.model, messages, stream: true, temperature: Number(settings.temperature) };
    }

    const res = await request(
      fetchImpl,
      url,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(settings) },
        body: JSON.stringify(body),
        signal,
      },
      baseUrl
    );

    const parse = provider === 'ollama' ? parseOllamaLine : parseOpenAILine;
    let text = '';
    await readLines(res.body, (line) => {
      let chunk;
      try {
        chunk = parse(line);
      } catch (err) {
        if (err instanceof LLMError) throw err;
        return true; // skip keep-alive comments and malformed lines
      }
      if (!chunk) return true;
      if (chunk.thinking && onThinking) onThinking();
      if (chunk.content) {
        text += chunk.content;
        if (onToken) onToken(chunk.content);
      }
      return !chunk.done;
    });
    return SoroTrack.stripThinking(text);
  }

  Object.assign(SoroTrack, {
    LLMError,
    normalizeBaseUrl,
    listModels,
    chat,
    parseOllamaLine,
    parseOpenAILine,
  });
})(globalThis);
