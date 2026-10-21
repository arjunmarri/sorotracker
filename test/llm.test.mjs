import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load, fakeFetch } from './helpers.mjs';

const S = await load('shared/markdown.js', 'background/llm.js');
const settings = (over = {}) => ({ baseUrl: 'http://127.0.0.1:11434', provider: 'auto', model: 'llama3.2', apiKey: '', temperature: 0.3, contextWindow: 8192, allowThinking: false, ...over });

test('normalizeBaseUrl trims pasted endpoints and adds a scheme', () => {
  assert.equal(S.normalizeBaseUrl('http://127.0.0.1:11434/'), 'http://127.0.0.1:11434');
  assert.equal(S.normalizeBaseUrl('127.0.0.1:11434'), 'http://127.0.0.1:11434');
  assert.equal(S.normalizeBaseUrl('http://localhost:11434/api/tags'), 'http://localhost:11434');
  assert.equal(S.normalizeBaseUrl('http://127.0.0.1:1234/v1/chat/completions'), 'http://127.0.0.1:1234/v1');
  assert.equal(S.normalizeBaseUrl(''), 'http://127.0.0.1:11434');
  assert.throws(() => S.normalizeBaseUrl('http://exa mple'), /not a valid URL/);
});

test('listModels detects Ollama and drops embedding-only models', async () => {
  const { fetch } = fakeFetch({
    'http://127.0.0.1:11434/api/tags': {
      json: {
        models: [
          { name: 'llama3.2:3b', details: { parameter_size: '3.2B' }, capabilities: ['completion', 'tools'] },
          { name: 'nomic-embed-text', capabilities: ['embedding'] },
        ],
      },
    },
  });
  const res = await S.listModels(settings(), fetch);
  assert.equal(res.provider, 'ollama');
  assert.deepEqual(res.models.map((m) => m.id), ['llama3.2:3b']);
});

test('listModels falls back to an OpenAI-compatible server', async () => {
  const { fetch } = fakeFetch({
    'http://127.0.0.1:1234/api/tags': { status: 404, text: 'Unexpected endpoint' },
    'http://127.0.0.1:1234/v1/models': { json: { data: [{ id: 'qwen2.5-7b-instruct' }, { id: 'text-embedding-nomic' }] } },
  });
  const res = await S.listModels(settings({ baseUrl: 'http://127.0.0.1:1234' }), fetch);
  assert.equal(res.provider, 'openai');
  assert.deepEqual(res.models.map((m) => m.id), ['qwen2.5-7b-instruct']);
});

test('connection errors carry a helpful hint', async () => {
  const down = fakeFetch({});
  await assert.rejects(S.listModels(settings(), down.fetch), (err) => err.code === 'unreachable' && /running/.test(err.hint));

  const forbidden = fakeFetch({ 'http://127.0.0.1:11434/api/tags': { status: 403, text: '' } });
  await assert.rejects(S.listModels(settings(), forbidden.fetch), (err) => err.code === 'forbidden' && /OLLAMA_ORIGINS/.test(err.hint));
});

test('chat streams Ollama NDJSON, disables thinking and strips <think> blocks', async () => {
  const { fetch, calls } = fakeFetch({
    'http://127.0.0.1:11434/api/chat': {
      lines: [
        JSON.stringify({ message: { content: '<think>hmm</think>' } }),
        JSON.stringify({ message: { content: 'Hello' } }),
        JSON.stringify({ message: { content: ' world' } }),
        JSON.stringify({ message: { content: '' }, done: true }),
      ],
    },
  });
  const tokens = [];
  const text = await S.chat({ settings: settings(), provider: 'ollama', messages: [{ role: 'user', content: 'hi' }], json: true, onToken: (t) => tokens.push(t) }, fetch);
  assert.equal(text, 'Hello world');
  assert.equal(tokens.length, 3);
  assert.equal(calls[0].body.think, false);
  assert.equal(calls[0].body.format, 'json');
  assert.equal(calls[0].body.options.num_ctx, 8192);
});

test('chat streams OpenAI-style server-sent events', async () => {
  const chunk = (content) => `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}`;
  const { fetch, calls } = fakeFetch({
    'http://127.0.0.1:1234/v1/chat/completions': { lines: [': keep-alive', chunk('Hi'), '', chunk(' there'), 'data: [DONE]'] },
  });
  const text = await S.chat({ settings: settings({ baseUrl: 'http://127.0.0.1:1234/v1', apiKey: 'k' }), provider: 'openai', messages: [] }, fetch);
  assert.equal(text, 'Hi there');
  assert.equal(calls[0].init.headers.Authorization, 'Bearer k');
});

test('chat reports a missing model', async () => {
  const { fetch } = fakeFetch({ 'http://127.0.0.1:11434/api/chat': { status: 404, json: { error: "model 'nope' not found" } } });
  await assert.rejects(S.chat({ settings: settings({ model: 'nope' }), provider: 'ollama', messages: [] }, fetch), (err) => err.code === 'model_missing');
});
