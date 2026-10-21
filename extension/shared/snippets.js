// Snippets live in extension storage, one key per snippet ("snippet:<id>") so that
// saves from several tabs at once never overwrite each other.
(function (root) {
  'use strict';

  const SoroTrack = (root.SoroTrack = root.SoroTrack || {});
  const PREFIX = 'snippet:';

  function newId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  async function addSnippet(fields) {
    const snippet = {
      id: newId(),
      createdAt: new Date().toISOString(),
      title: '',
      summary: '',
      tags: [],
      text: '',
      url: '',
      pageTitle: '',
      source: 'page', // 'page' | 'selection'
      model: '',
      ...fields,
    };
    await SoroTrack.ext.storage.local.set({ [PREFIX + snippet.id]: snippet });
    return snippet;
  }

  async function listSnippets() {
    const all = await SoroTrack.ext.storage.local.get(null);
    return Object.keys(all)
      .filter((key) => key.startsWith(PREFIX))
      .map((key) => all[key])
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  }

  async function deleteSnippets(ids) {
    await SoroTrack.ext.storage.local.remove(ids.map((id) => PREFIX + id));
  }

  // Merges snippets from an export file; existing ids are kept as they are.
  async function importSnippets(items) {
    const existing = new Set((await listSnippets()).map((s) => s.id));
    const toSave = {};
    for (const item of items) {
      if (!item || typeof item !== 'object' || typeof item.text !== 'string') continue;
      const id = typeof item.id === 'string' && item.id ? item.id : newId();
      if (existing.has(id)) continue;
      toSave[PREFIX + id] = { ...item, id, tags: Array.isArray(item.tags) ? item.tags : [] };
    }
    await SoroTrack.ext.storage.local.set(toSave);
    return Object.keys(toSave).length;
  }

  function isSnippetChange(changes) {
    return Object.keys(changes).some((key) => key.startsWith(PREFIX));
  }

  Object.assign(SoroTrack, { addSnippet, listSnippets, deleteSnippets, importSnippets, isSnippetChange });
})(globalThis);
