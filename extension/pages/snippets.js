(function () {
  'use strict';

  const { ext, listSnippets, deleteSnippets, importSnippets, isSnippetChange } = globalThis.SoroTrack;
  const $ = (id) => document.getElementById(id);
  const el = (tag, props = {}, children = []) => {
    const node = Object.assign(document.createElement(tag), props);
    node.append(...children);
    return node;
  };

  let snippets = [];
  let tagFilter = '';

  function matches(snippet, query) {
    if (tagFilter && !snippet.tags.includes(tagFilter)) return false;
    if (!query) return true;
    const haystack = [snippet.title, snippet.summary, snippet.text, snippet.pageTitle, snippet.url, ...snippet.tags]
      .join(' ')
      .toLowerCase();
    return query.split(/\s+/).every((word) => haystack.includes(word));
  }

  function formatDate(iso) {
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? '' : date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  }

  function renderItem(snippet) {
    const text = el('div', { className: 'text', textContent: snippet.text });
    const toggle = el('button', { className: 'btn small', type: 'button', textContent: 'Show full text' });
    toggle.addEventListener('click', () => {
      const open = text.classList.toggle('open');
      toggle.textContent = open ? 'Show less' : 'Show full text';
    });
    const copy = el('button', { className: 'btn small', type: 'button', textContent: 'Copy' });
    copy.addEventListener('click', async () => {
      await navigator.clipboard.writeText(`${snippet.title}\n${snippet.url}\n\n${snippet.text}`);
      copy.textContent = 'Copied';
      setTimeout(() => (copy.textContent = 'Copy'), 1500);
    });
    const remove = el('button', { className: 'btn small danger', type: 'button', textContent: 'Delete' });
    remove.addEventListener('click', () => deleteSnippets([snippet.id]));

    let host = '';
    try {
      host = new URL(snippet.url).hostname;
    } catch {
      // keep empty
    }
    const meta = el('div', { className: 'meta' }, [
      el('span', { textContent: formatDate(snippet.createdAt) }),
      el('span', { textContent: snippet.source === 'selection' ? 'Selection' : 'Whole page' }),
    ]);
    if (/^https?:/.test(snippet.url)) {
      meta.append(el('a', { href: snippet.url, target: '_blank', rel: 'noopener', textContent: host || snippet.url, title: snippet.pageTitle || snippet.url }));
    }

    const item = el('article', { className: 'item' }, [el('h2', { textContent: snippet.title }), meta]);
    if (snippet.summary) item.append(el('p', { className: 'summary', textContent: snippet.summary }));
    if (snippet.tags.length) {
      item.append(
        el('div', { className: 'tags' }, snippet.tags.map((tag) => {
          const chip = el('button', { className: 'tag', type: 'button', textContent: `#${tag}` });
          chip.addEventListener('click', () => {
            tagFilter = tag;
            render();
          });
          return chip;
        }))
      );
    }
    item.append(text, el('div', { className: 'actions' }, [toggle, copy, remove]));
    return item;
  }

  function render() {
    const query = $('search').value.trim().toLowerCase();
    const visible = snippets.filter((s) => matches(s, query));
    $('count').textContent = snippets.length ? `(${snippets.length})` : '';
    $('filter').hidden = !tagFilter;
    $('filterTag').textContent = `#${tagFilter}`;
    $('list').replaceChildren(
      ...(visible.length
        ? visible.map(renderItem)
        : [el('div', {
            className: 'empty',
            textContent: snippets.length
              ? 'No snippets match your search.'
              : 'No snippets yet. Open the assistant on any page and click “Save snippet”, or right-click selected text.',
          })])
    );
  }

  async function load() {
    snippets = (await listSnippets()).map((s) => ({ ...s, tags: Array.isArray(s.tags) ? s.tags : [] }));
    render();
  }

  function download(name, type, content) {
    const url = URL.createObjectURL(new Blob([content], { type }));
    el('a', { href: url, download: name }).click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const stamp = () => new Date().toISOString().slice(0, 10);

  $('exportJson').addEventListener('click', () => {
    download(`sorotrack-snippets-${stamp()}.json`, 'application/json', JSON.stringify(snippets, null, 2));
  });

  $('exportMd').addEventListener('click', () => {
    const md = snippets
      .map((s) => {
        const tags = s.tags.length ? `\n${s.tags.map((t) => `#${t}`).join(' ')}` : '';
        const quoted = s.text.split('\n').map((line) => `> ${line}`).join('\n');
        return `## ${s.title}\n\n${s.url}  \n_${formatDate(s.createdAt)}_${tags}\n\n${s.summary}\n\n${quoted}\n`;
      })
      .join('\n---\n\n');
    download(`sorotrack-snippets-${stamp()}.md`, 'text/markdown', `# SoroTrack snippets\n\n${md}`);
  });

  $('import').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      const items = JSON.parse(await file.text());
      const added = await importSnippets(Array.isArray(items) ? items : []);
      alert(`Imported ${added} snippet${added === 1 ? '' : 's'}.`);
    } catch (err) {
      alert(`Couldn't import that file: ${err.message}`);
    }
  });

  $('clear').addEventListener('click', async () => {
    if (!snippets.length) return;
    if (confirm(`Delete all ${snippets.length} snippets? Export them first if you want a backup.`)) {
      await deleteSnippets(snippets.map((s) => s.id));
    }
  });

  $('search').addEventListener('input', render);
  $('clearFilter').addEventListener('click', () => {
    tagFilter = '';
    render();
  });

  ext.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && isSnippetChange(changes)) load();
  });

  load();
})();
