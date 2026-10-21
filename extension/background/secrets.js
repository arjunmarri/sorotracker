// Encrypted storage for cloud API keys. Loaded only by the background worker.
//
// - Keys are encrypted with AES-256-GCM. The encryption key is a non-extractable WebCrypto key:
//   script can use it to encrypt/decrypt but can never read its raw bytes.
// - Both the encryption key and the ciphertext live in this extension's own IndexedDB, which
//   content scripts (they run with the web page's origin) and other extensions cannot open.
// - Nothing secret goes into chrome.storage, whose change events reach content scripts.
(function (root) {
  'use strict';

  const SoroTrack = (root.SoroTrack = root.SoroTrack || {});

  const DB_NAME = 'sorotrack-secrets';
  const STORE = 'kv';
  const CRYPTO_KEY_ID = 'aes-gcm-key';
  const SECRETS_ID = 'api-keys';

  // Minimal promise wrapper around IndexedDB; replaceable in tests.
  function indexedDbStore(idb = root.indexedDB) {
    let dbPromise;
    const open = () =>
      (dbPromise ||= new Promise((resolve, reject) => {
        const req = idb.open(DB_NAME, 1);
        req.onupgradeneeded = () => req.result.createObjectStore(STORE);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }));
    const run = async (mode, fn) => {
      const db = await open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const req = fn(tx.objectStore(STORE));
        tx.oncomplete = () => resolve(req && req.result);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
    };
    return {
      get: (key) => run('readonly', (s) => s.get(key)),
      set: (key, value) => run('readwrite', (s) => s.put(value, key)),
    };
  }

  function createSecretStore({ store = indexedDbStore(), subtle = root.crypto.subtle } = {}) {
    let cryptoKeyPromise;
    let cache = null; // decrypted keys, kept in memory while the worker is alive
    let queue = Promise.resolve(); // serializes writes

    function cryptoKey() {
      return (cryptoKeyPromise ||= (async () => {
        const existing = await store.get(CRYPTO_KEY_ID);
        if (existing) return existing;
        const key = await subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
        await store.set(CRYPTO_KEY_ID, key);
        return key;
      })());
    }

    async function readAll() {
      if (cache) return cache;
      const record = await store.get(SECRETS_ID);
      if (!record) return (cache = {});
      try {
        const plain = await subtle.decrypt({ name: 'AES-GCM', iv: record.iv }, await cryptoKey(), record.data);
        cache = JSON.parse(new TextDecoder().decode(plain));
      } catch {
        cache = {}; // unreadable (e.g. the encryption key was lost): treat as no saved keys
      }
      return cache;
    }

    async function writeAll(keys) {
      const iv = root.crypto.getRandomValues(new Uint8Array(12));
      const data = await subtle.encrypt({ name: 'AES-GCM', iv }, await cryptoKey(), new TextEncoder().encode(JSON.stringify(keys)));
      await store.set(SECRETS_ID, { iv, data, updatedAt: Date.now() });
      cache = keys;
    }

    function update(fn) {
      // Chain on a settled queue so one failed write doesn't block later ones.
      queue = queue.catch(() => {}).then(async () => writeAll(fn({ ...(await readAll()) })));
      return queue;
    }

    return {
      /** All saved keys as { providerId: key }. Background use only. */
      getAll: async () => ({ ...(await readAll()) }),
      /** { providerId: "…last4" } — safe to show in the UI. */
      async describe() {
        const out = {};
        for (const [id, key] of Object.entries(await readAll())) out[id] = key.slice(-4);
        return out;
      },
      set: (provider, key) =>
        update((keys) => {
          const value = String(key || '').trim();
          if (value) keys[provider] = value;
          else delete keys[provider];
          return keys;
        }),
      remove: (provider) =>
        update((keys) => {
          delete keys[provider];
          return keys;
        }),
      /** Moves keys saved in plain text by 2.1.0 (chrome.storage "apiKeys") into encrypted storage. */
      async migrateFrom(storageArea) {
        const { apiKeys } = await storageArea.get('apiKeys');
        if (!apiKeys || typeof apiKeys !== 'object') return 0;
        const entries = Object.entries(apiKeys).filter(([, v]) => typeof v === 'string' && v.trim());
        if (entries.length) await update((keys) => Object.assign(keys, Object.fromEntries(entries)));
        await storageArea.remove('apiKeys');
        return entries.length;
      },
    };
  }

  SoroTrack.createSecretStore = createSecretStore;
})(globalThis);
