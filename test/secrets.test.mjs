import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load } from './helpers.mjs';

const S = await load('background/secrets.js');

// In-memory stand-in for IndexedDB that, like IndexedDB, stores structured clones.
function memoryStore() {
  const map = new Map();
  return { map, get: async (k) => map.get(k), set: async (k, v) => void map.set(k, structuredClone(v)) };
}

// In-memory stand-in for chrome.storage.local.
function memoryArea(initial = {}) {
  const data = { ...initial };
  return { data, get: async (key) => (key in data ? { [key]: data[key] } : {}), remove: async (key) => void delete data[key] };
}

test('keys round-trip through encrypted storage and are never stored in plain text', async () => {
  const store = memoryStore();
  const secrets = S.createSecretStore({ store });
  await secrets.set('anthropic', '  sk-ant-secret-1234  ');
  await secrets.set('openai', 'sk-openai-abcd');
  assert.deepEqual(await secrets.getAll(), { anthropic: 'sk-ant-secret-1234', openai: 'sk-openai-abcd' });
  assert.deepEqual(await secrets.describe(), { anthropic: '1234', openai: 'abcd' });

  const record = store.map.get('api-keys');
  const stored = Buffer.from(record.data).toString('latin1');
  assert.ok(!stored.includes('sk-ant-secret') && !stored.includes('sk-openai'), 'ciphertext must not contain the key');
  assert.equal(record.iv.length, 12);

  // A fresh instance (e.g. after the service worker restarts) decrypts with the stored key.
  assert.deepEqual(await S.createSecretStore({ store }).getAll(), { anthropic: 'sk-ant-secret-1234', openai: 'sk-openai-abcd' });
});

test('the encryption key cannot be exported', async () => {
  const store = memoryStore();
  await S.createSecretStore({ store }).set('groq', 'gsk_x');
  const key = store.map.get('aes-gcm-key');
  assert.equal(key.extractable, false);
  await assert.rejects(crypto.subtle.exportKey('raw', key));
});

test('each save uses a fresh IV, and removing or blanking a key deletes it', async () => {
  const store = memoryStore();
  const secrets = S.createSecretStore({ store });
  await secrets.set('openai', 'sk-1');
  const firstIv = Buffer.from(store.map.get('api-keys').iv).toString('hex');
  await secrets.set('gemini', 'AIza-2');
  assert.notEqual(Buffer.from(store.map.get('api-keys').iv).toString('hex'), firstIv);
  await secrets.remove('openai');
  await secrets.set('gemini', '   ');
  assert.deepEqual(await secrets.getAll(), {});
});

test('concurrent saves are not lost', async () => {
  const secrets = S.createSecretStore({ store: memoryStore() });
  await Promise.all(['a', 'b', 'c', 'd'].map((id) => secrets.set(id, `key-${id}`)));
  assert.deepEqual(Object.keys(await secrets.getAll()).sort(), ['a', 'b', 'c', 'd']);
});

test('plain-text keys from 2.1.0 are migrated and removed from chrome.storage', async () => {
  const area = memoryArea({ apiKeys: { anthropic: 'sk-ant-old', openai: '' }, settings: { source: 'cloud' } });
  const secrets = S.createSecretStore({ store: memoryStore() });
  assert.equal(await secrets.migrateFrom(area), 1);
  assert.deepEqual(await secrets.getAll(), { anthropic: 'sk-ant-old' });
  assert.equal('apiKeys' in area.data, false);
  assert.deepEqual(area.data.settings, { source: 'cloud' });
  assert.equal(await secrets.migrateFrom(area), 0);
});
