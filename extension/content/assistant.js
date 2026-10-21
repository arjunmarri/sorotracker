// The on-page assistant: a floating button that opens a panel connected to the local LLM.
// Loaded last; depends on shared/*.js, content/extract.js and content/styles.js.
(function () {
  'use strict';

  if (!(document.documentElement instanceof HTMLElement) || !document.body) return; // XML, SVG, PDF viewers

  const S = globalThis.SoroTrack;
  const { ext } = S;

  // ---------------------------------------------------------------------------
  // Icons (24px grid, stroke-based)
  // ---------------------------------------------------------------------------

  const svg = (body, fill = 'none') =>
    `<svg viewBox="0 0 24 24" fill="${fill}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
  const ICONS = {
    sparkle: svg('<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 15l.7 1.6 1.6.7-1.6.7L19 20l-.7-1.6-1.6-.7 1.6-.7z"/>', 'currentColor'),
    close: svg('<path d="M18 6 6 18M6 6l12 12"/>'),
    more: svg('<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>'),
    summarize: svg('<path d="M4 6h16M4 12h16M4 18h10"/>'),
    snippet: svg('<path d="M6 3h12v18l-6-4-6 4z"/>'),
    slop: svg('<path d="m7 21-4.3-4.3a1 1 0 0 1 0-1.4l9.6-9.6a1 1 0 0 1 1.4 0l5.6 5.6a1 1 0 0 1 0 1.4L11 21z"/><path d="M22 21H7M5 11l9 9"/>'),
    restore: svg('<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-15-6.7L3 13"/>'),
    send: svg('<path d="M12 19V5M5 12l7-7 7 7"/>'),
    stop: svg('<rect x="7" y="7" width="10" height="10" rx="1.5"/>', 'currentColor'),
    check: svg('<path d="M20 6 9 17l-5-5"/>'),
    alert: svg('<circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>'),
  };

  // All markup is either static or already escaped by renderMarkdown; parsing it with
  // DOMParser keeps it inert (no script execution) and in one auditable place.
  function setHtml(el, html) {
    const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
    el.replaceChildren(...doc.body.childNodes);
  }

  // ---------------------------------------------------------------------------
  // DOM setup
  // ---------------------------------------------------------------------------

  // A reloaded extension re-injects into open tabs; drop the stale copy first.
  document.querySelectorAll('sorotrack-assistant').forEach((el) => el.remove());

  const host = document.createElement('sorotrack-assistant');
  const shadow = host.attachShadow({ mode: 'closed' });
  adoptStyles(shadow, S.ASSISTANT_CSS);

  const ui = document.createElement('div');
  setHtml(ui, `
    <button class="launcher" type="button" hidden aria-label="Open SoroTrack assistant" title="SoroTrack assistant (Alt+Shift+K)">${ICONS.sparkle}</button>
    <section class="panel" role="dialog" aria-label="SoroTrack assistant" hidden>
      <header>
        <div class="brand"><span class="brand-mark">${ICONS.sparkle}</span>SoroTrack</div>
        <div class="status">
          <span class="dot" aria-hidden="true"></span>
          <span class="status-text">Not connected</span>
          <span class="where" hidden></span>
          <select class="model" aria-label="Model" hidden></select>
        </div>
        <button class="icon-btn menu-btn" type="button" aria-label="More options" aria-haspopup="menu">${ICONS.more}</button>
        <button class="icon-btn close-btn" type="button" aria-label="Close assistant">${ICONS.close}</button>
        <div class="menu" role="menu" hidden>
          <button type="button" role="menuitem" data-cmd="snippets">Open saved snippets</button>
          <button type="button" role="menuitem" data-cmd="clear">Clear conversation</button>
          <button type="button" role="menuitem" data-cmd="hide-site">Hide button on this site</button>
          <button type="button" role="menuitem" data-cmd="settings">Settings</button>
        </div>
      </header>
      <div class="actions">
        <button class="chip" type="button" data-action="summarize">${ICONS.summarize}<span>Summarize</span></button>
        <button class="chip" type="button" data-action="snippet">${ICONS.snippet}<span>Save snippet</span></button>
        <button class="chip" type="button" data-action="slop">${ICONS.slop}<span>Remove AI slop</span></button>
      </div>
      <div class="thread" aria-live="polite">
        <div class="empty">
          <strong>Your private page assistant</strong>
          <span class="empty-note">Runs on the model served at your local URL. Nothing leaves your machine.</span>
          <ul>
            <li><b>Summarize</b> the page</li>
            <li><b>Save snippet</b> — your selection, or the whole page</li>
            <li><b>Remove AI slop</b> — hide filler and engagement bait</li>
            <li>Or ask anything about the page below</li>
          </ul>
        </div>
      </div>
      <form class="composer">
        <textarea rows="1" placeholder="Ask about this page…" aria-label="Ask about this page"></textarea>
        <button class="send" type="submit" aria-label="Send">${ICONS.send}</button>
      </form>
    </section>`);
  shadow.append(...ui.childNodes);
  document.documentElement.append(host);

  const $ = (selector) => shadow.querySelector(selector);
  const els = {
    launcher: $('.launcher'),
    panel: $('.panel'),
    dot: $('.dot'),
    statusText: $('.status-text'),
    where: $('.where'),
    emptyNote: $('.empty-note'),
    model: $('.model'),
    menuBtn: $('.menu-btn'),
    menu: $('.menu'),
    close: $('.close-btn'),
    actions: $('.actions'),
    slopChip: $('[data-action="slop"]'),
    thread: $('.thread'),
    empty: $('.empty'),
    form: $('.composer'),
    input: $('.composer textarea'),
    send: $('.send'),
  };

  // Keep the page's own keyboard shortcuts (j/k, /, space…) from firing while typing here.
  for (const type of ['keydown', 'keyup', 'keypress']) host.addEventListener(type, (e) => e.stopPropagation());

  function adoptStyles(target, css) {
    // Constructable sheets are not subject to the page's style-src CSP; fall back to <style>.
    try {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(css);
      target.adoptedStyleSheets = [...target.adoptedStyleSheets, sheet];
      return;
    } catch {
      const style = document.createElement('style');
      style.textContent = css;
      (target === document ? document.documentElement : target).append(style);
    }
  }

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------

  const state = {
    settings: { ...S.DEFAULT_SETTINGS },
    status: 'idle', // idle | connecting | ready | offline
    cloud: false, // true when a hosted API is in use
    busy: null, // AbortController of the running task
    history: [], // chat turns (without the page context)
    pageContext: null, // { url, page } used for questions
    lastSelection: { text: '', at: 0 },
    slop: { hidden: 0, checked: 0, mode: 'hide' },
    pageStylesAdded: false,
  };

  // ---------------------------------------------------------------------------
  // Talking to the background worker
  // ---------------------------------------------------------------------------

  function toError(payload) {
    const err = new Error(payload.error || 'Something went wrong.');
    err.code = payload.code;
    err.hint = payload.hint || '';
    return err;
  }

  async function sendMessage(message) {
    const res = await ext.runtime.sendMessage(message);
    if (res && res.ok === false) throw toError(res);
    return res;
  }

  /** Streams a completion from the local model. Resolves with the full text. */
  function runChat({ messages, json = false, onToken, onThinking, signal }) {
    return new Promise((resolve, reject) => {
      const port = ext.runtime.connect({ name: 'llm' });
      let settled = false;
      const ping = setInterval(() => {
        try {
          port.postMessage({ type: 'ping' });
        } catch {
          // port already closed
        }
      }, 15000);
      const finish = (fn, value) => {
        if (settled) return;
        settled = true;
        clearInterval(ping);
        try {
          port.disconnect();
        } catch {
          // already disconnected
        }
        fn(value);
      };

      port.onMessage.addListener((msg) => {
        if (msg.type === 'token' && onToken) onToken(msg.text);
        else if (msg.type === 'thinking' && onThinking) onThinking();
        else if (msg.type === 'done') finish(resolve, msg.text);
        else if (msg.type === 'error') finish(reject, toError(msg));
      });
      port.onDisconnect.addListener(() =>
        finish(reject, toError({ error: 'Lost the connection to the extension.', hint: 'Reload the page and try again.' }))
      );
      if (signal) {
        signal.addEventListener('abort', () => finish(reject, Object.assign(new Error('Stopped.'), { name: 'AbortError' })), {
          once: true,
        });
      }
      port.postMessage({ type: 'chat', messages, json, model: els.model.value || state.settings.model });
    });
  }

  // ---------------------------------------------------------------------------
  // Connection status
  // ---------------------------------------------------------------------------

  function setStatus(status, text) {
    state.status = status;
    els.dot.className = `dot ${status}`;
    els.statusText.textContent = text;
    els.statusText.hidden = status === 'ready';
    els.model.hidden = status !== 'ready';
    els.where.hidden = status !== 'ready' || !state.cloud;
    updateControls();
  }

  async function connect() {
    setStatus('connecting', 'Connecting…');
    try {
      const status = await sendMessage({ type: 'llm:status' });
      state.cloud = status.cloud;
      els.where.textContent = status.providerLabel;
      els.emptyNote.textContent = status.cloud
        ? `Runs on ${status.providerLabel} with your API key. Page text you act on is sent to ${status.providerLabel}.`
        : 'Runs on the model served at your local URL. Nothing leaves your machine.';
      els.model.replaceChildren(
        ...status.models.map((m) => {
          const option = document.createElement('option');
          option.value = m.id;
          option.textContent = m.size ? `${m.id} · ${m.size}` : m.id;
          return option;
        })
      );
      if (!status.models.length) {
        setStatus('offline', 'No models');
        showError(
          new Error(`Connected to ${status.cloud ? status.providerLabel : status.baseUrl}, but it has no chat models.`),
          status.cloud ? 'Choose a model in settings.' : 'Download one first, for example: ollama pull llama3.2',
          true
        );
        return;
      }
      els.model.value = status.model;
      const via = status.cloud ? status.providerLabel : status.api === 'ollama' ? 'Ollama' : 'OpenAI-compatible API';
      els.model.title = `${status.model} via ${via} at ${status.baseUrl}`;
      setStatus('ready', status.model);
    } catch (err) {
      setStatus('offline', 'Offline');
      showError(err, err.hint, true);
    }
  }

  // ---------------------------------------------------------------------------
  // Thread rendering
  // ---------------------------------------------------------------------------

  function scrollToEnd(force) {
    const t = els.thread;
    if (force || t.scrollHeight - t.scrollTop - t.clientHeight < 80) t.scrollTop = t.scrollHeight;
  }

  function append(node) {
    els.empty.hidden = true;
    els.thread.append(node);
    scrollToEnd(true);
    return node;
  }

  function addUserMessage(text) {
    const node = document.createElement('div');
    node.className = 'msg user';
    node.textContent = text;
    return append(node);
  }

  // Assistant message that renders streamed Markdown at most once per frame.
  function addAssistantMessage() {
    const node = append(document.createElement('div'));
    node.className = 'msg assistant';
    setHtml(node, '<span class="typing">Reading the page…</span>');
    let raw = '';
    let frame = 0;
    const render = () => {
      frame = 0;
      const visible = S.stripThinking(raw);
      if (visible) setHtml(node, S.renderMarkdown(visible));
      scrollToEnd(false);
    };
    return {
      node,
      thinking() {
        if (!S.stripThinking(raw)) setHtml(node, '<span class="typing">Thinking…</span>');
      },
      push(token) {
        raw += token;
        if (!frame) frame = requestAnimationFrame(render);
      },
      finish(text) {
        if (frame) cancelAnimationFrame(frame);
        raw = text !== undefined ? text : raw;
        setHtml(node, S.renderMarkdown(S.stripThinking(raw)) || '<p><em>(no response)</em></p>');
        scrollToEnd(false);
      },
    };
  }

  function card({ kind = '', icon, title, body = '', pre = '', actions = [] }) {
    const node = document.createElement('div');
    node.className = `card ${kind}`;
    const heading = document.createElement('div');
    heading.className = 'card-title';
    setHtml(heading, icon ? ICONS[icon] : '');
    heading.append(title);
    node.append(heading);
    if (body) {
      const p = document.createElement('p');
      p.textContent = body;
      node.append(p);
    }
    if (pre) {
      const block = document.createElement('pre');
      block.textContent = pre;
      node.append(block);
    }
    if (actions.length) {
      const row = document.createElement('div');
      row.className = 'card-actions';
      for (const action of actions) {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = action.label;
        button.addEventListener('click', action.onClick);
        row.append(button);
      }
      node.append(row);
    }
    return node;
  }

  function showError(err, hint, offerRetry) {
    const actions = [];
    if (offerRetry) actions.push({ label: 'Retry', onClick: () => connect() });
    actions.push({ label: 'Open settings', onClick: () => sendMessage({ type: 'open:options' }) });
    return append(card({ kind: 'error', icon: 'alert', title: err.message, pre: hint || '', actions }));
  }

  // ---------------------------------------------------------------------------
  // Tasks
  // ---------------------------------------------------------------------------

  function getPage() {
    return S.extractPage(document, { maxChars: Number(state.settings.maxPageChars) || 12000 });
  }

  function updateControls() {
    const busy = Boolean(state.busy);
    const ready = state.status === 'ready';
    for (const chip of els.actions.querySelectorAll('.chip')) {
      chip.disabled = busy || (!ready && !(chip === els.slopChip && state.slop.hidden));
    }
    els.input.disabled = !ready;
    els.send.disabled = !busy && !ready;
    els.send.classList.toggle('stop', busy);
    setHtml(els.send, busy ? ICONS.stop : ICONS.send);
    els.send.setAttribute('aria-label', busy ? 'Stop' : 'Send');
    els.launcher.classList.toggle('busy', busy);

    const restoring = state.slop.hidden > 0;
    els.slopChip.classList.toggle('active', restoring);
    setHtml(els.slopChip, restoring
      ? `${ICONS.restore}<span>Restore page (${state.slop.hidden} hidden)</span>`
      : `${ICONS.slop}<span>Remove AI slop</span>`);
  }

  async function runTask(task) {
    if (state.busy) return;
    if (state.status !== 'ready') await connect();
    if (state.status !== 'ready') return;
    state.busy = new AbortController();
    updateControls();
    try {
      await task(state.busy.signal);
    } catch (err) {
      if (err.name === 'AbortError') append(card({ title: 'Stopped.' }));
      else showError(err, err.hint, false);
    } finally {
      state.busy = null;
      updateControls();
    }
  }

  // Streams a reply into a new assistant message and records the turn in the conversation.
  async function streamReply(messages, userTurn, signal) {
    const reply = addAssistantMessage();
    try {
      const text = await runChat({ messages, signal, onToken: reply.push, onThinking: reply.thinking });
      reply.finish(text);
      state.history.push({ role: 'user', content: userTurn }, { role: 'assistant', content: text });
      state.history = state.history.slice(-12);
    } catch (err) {
      reply.finish();
      if (!reply.node.textContent.trim() || reply.node.textContent === '(no response)') reply.node.remove();
      throw err;
    }
  }

  function summarize() {
    return runTask(async (signal) => {
      const page = getPage();
      if (!page.text) throw new Error('This page has no readable text to summarize.');
      state.pageContext = { url: location.href, page };
      addUserMessage('Summarize this page');
      await streamReply(S.prompts.summarizeMessages(page), 'Summarize this page.', signal);
    });
  }

  function ask(question) {
    return runTask(async (signal) => {
      if (!state.pageContext || state.pageContext.url !== location.href) {
        state.pageContext = { url: location.href, page: getPage() };
        state.history = [];
      }
      addUserMessage(question);
      const messages = [
        S.prompts.askSystemMessage(state.pageContext.page),
        ...state.history,
        { role: 'user', content: question },
      ];
      await streamReply(messages, question, signal);
    });
  }

  function saveSnippet(selectionText) {
    const recent = Date.now() - state.lastSelection.at < 2 * 60 * 1000 ? state.lastSelection.text : '';
    const selection = (selectionText || S.currentSelection() || recent).trim();

    return runTask(async (signal) => {
      const page = getPage();
      const source = selection ? 'selection' : 'page';
      const text = selection || page.text;
      if (!text) throw new Error('Nothing to save: select some text or open a page with readable content.');

      const progress = append(card({ icon: 'snippet', title: `Saving ${source === 'selection' ? 'selection' : 'page'} as a snippet…` }));
      let meta;
      let warning = '';
      try {
        const reply = await runChat({ messages: S.prompts.snippetMessages(text.slice(0, 6000), page), json: true, signal });
        meta = S.parseSnippetMeta(reply, page.title);
      } catch (err) {
        if (err.name === 'AbortError') {
          progress.remove();
          throw err;
        }
        meta = S.parseSnippetMeta('', page.title);
        warning = `Saved without an AI summary: ${err.message}`;
      }

      const snippet = await S.addSnippet({
        ...meta,
        text,
        source,
        url: location.href,
        pageTitle: page.title,
        model: els.model.value,
      });
      state.lastSelection = { text: '', at: 0 };

      const done = card({
        kind: 'ok',
        icon: 'check',
        title: snippet.title,
        body: warning || snippet.summary,
        actions: [{ label: 'Open snippets', onClick: () => sendMessage({ type: 'open:snippets' }) }],
      });
      if (snippet.tags.length) {
        const tags = document.createElement('div');
        tags.className = 'tags';
        for (const tag of snippet.tags) {
          const chip = document.createElement('span');
          chip.className = 'tag';
          chip.textContent = `#${tag}`;
          tags.append(chip);
        }
        done.insertBefore(tags, done.querySelector('.card-actions'));
      }
      progress.replaceWith(done);
    });
  }

  function addPageStyles() {
    if (state.pageStylesAdded) return;
    adoptStyles(document, S.PAGE_CSS);
    state.pageStylesAdded = true;
  }

  function restorePage() {
    for (const el of document.querySelectorAll('[data-sorotrack-slop], [data-sorotrack-checked]')) {
      el.removeAttribute('data-sorotrack-slop');
      el.removeAttribute('data-sorotrack-checked');
    }
    const restored = state.slop.hidden;
    state.slop = { hidden: 0, checked: 0, mode: state.settings.slopMode };
    updateControls();
    append(card({ icon: 'restore', title: `Restored ${restored} block${restored === 1 ? '' : 's'}.` }));
  }

  function setSlopMode(mode) {
    state.slop.mode = mode;
    for (const el of document.querySelectorAll('[data-sorotrack-slop]')) el.setAttribute('data-sorotrack-slop', mode);
  }

  // The chip toggles: remove slop, or restore the page once something is hidden.
  function toggleSlop() {
    if (state.slop.hidden > 0 && !state.busy) restorePage();
    else scanForSlop();
  }

  function scanForSlop() {
    return runTask(async (signal) => {
      // Skip blocks already judged, so running it again on an infinite feed only checks new posts.
      const blocks = S.collectContentBlocks(document).filter((b) => !b.el.hasAttribute('data-sorotrack-checked'));
      if (!blocks.length) {
        append(card({ title: state.slop.checked ? 'No new content to check.' : 'No text blocks found on this page.' }));
        return;
      }
      addPageStyles();
      state.slop.mode = state.slop.hidden ? state.slop.mode : state.settings.slopMode;

      const status = append(card({ icon: 'slop', title: `Checking ${blocks.length} blocks for AI slop…` }));
      const bar = document.createElement('div');
      bar.className = 'progress';
      setHtml(bar, '<div></div>');
      status.append(bar);

      const batches = [];
      for (let i = 0, chars = 0, batch = []; i < blocks.length; i++) {
        batch.push(blocks[i]);
        chars += blocks[i].text.length;
        if (batch.length === 20 || chars > 6000 || i === blocks.length - 1) {
          batches.push(batch);
          batch = [];
          chars = 0;
        }
      }

      let checked = 0;
      let hidden = 0;
      for (const batch of batches) {
        const reply = await runChat({ messages: S.prompts.slopMessages(batch), json: true, signal });
        const flagged = new Set(S.parseSlopIds(reply, batch.map((b) => b.id)));
        for (const block of batch) {
          block.el.setAttribute('data-sorotrack-checked', '1');
          if (flagged.has(block.id)) {
            block.el.setAttribute('data-sorotrack-slop', state.slop.mode);
            hidden++;
          }
        }
        checked += batch.length;
        state.slop.hidden += flagged.size;
        state.slop.checked += batch.length;
        bar.firstChild.style.width = `${Math.round((checked / blocks.length) * 100)}%`;
        status.querySelector('.card-title').lastChild.textContent = `Checked ${checked} of ${blocks.length} · ${hidden} hidden`;
        updateControls();
      }

      const actions = [{ label: 'Check new content', onClick: () => scanForSlop() }];
      if (state.slop.hidden) {
        actions.unshift({ label: 'Restore page', onClick: () => !state.busy && state.slop.hidden && restorePage() });
        actions.push({
          label: 'Show hidden (dimmed)',
          onClick: (e) => {
            const dim = state.slop.mode !== 'dim';
            setSlopMode(dim ? 'dim' : 'hide');
            e.target.textContent = dim ? 'Hide them again' : 'Show hidden (dimmed)';
          },
        });
      }
      status.replaceWith(
        card({
          kind: 'ok',
          icon: 'check',
          title: hidden ? `Removed ${hidden} of ${blocks.length} blocks as AI slop.` : `Checked ${blocks.length} blocks — no slop found.`,
          body: 'On feeds, scroll to load more posts, then use “Check new content”.',
          actions,
        })
      );
    });
  }

  // ---------------------------------------------------------------------------
  // Panel open / close and events
  // ---------------------------------------------------------------------------

  function isOpen() {
    return !els.panel.hidden;
  }

  function openPanel() {
    if (!isOpen()) {
      els.panel.hidden = false;
      if (state.status !== 'ready') connect();
    }
    els.input.focus({ preventScroll: true });
  }

  function closePanel() {
    els.panel.hidden = true;
    els.menu.hidden = true;
  }

  function applySettings() {
    const hiddenHere = (state.settings.hiddenSites || []).includes(location.hostname);
    els.launcher.hidden = !state.settings.showLauncher || hiddenHere;
    els.panel.classList.toggle('no-launcher', els.launcher.hidden);
  }

  els.launcher.addEventListener('click', () => (isOpen() ? closePanel() : openPanel()));
  els.close.addEventListener('click', closePanel);
  els.panel.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closePanel();
  });

  els.actions.addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    const action = chip.dataset.action;
    if (action === 'summarize') summarize();
    else if (action === 'snippet') saveSnippet();
    else if (action === 'slop') toggleSlop();
  });

  // Clicking a chip would otherwise clear the user's text selection on the page.
  els.actions.addEventListener('mousedown', (e) => e.preventDefault());

  els.form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (state.busy) {
      state.busy.abort();
      return;
    }
    const question = els.input.value.trim();
    if (!question) return;
    els.input.value = '';
    els.input.style.height = '';
    ask(question);
  });

  els.input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      els.form.requestSubmit();
    }
  });
  els.input.addEventListener('input', () => {
    els.input.style.height = 'auto';
    els.input.style.height = `${Math.min(els.input.scrollHeight, 140)}px`;
  });

  els.model.addEventListener('change', () => {
    S.saveSettings(S.modelPatch(state.settings, els.model.value));
    els.statusText.textContent = els.model.value;
  });

  els.menuBtn.addEventListener('click', () => {
    els.menu.hidden = !els.menu.hidden;
  });
  els.menu.addEventListener('click', async (e) => {
    const cmd = e.target.closest('[data-cmd]')?.dataset.cmd;
    els.menu.hidden = true;
    if (cmd === 'snippets') sendMessage({ type: 'open:snippets' });
    else if (cmd === 'settings') sendMessage({ type: 'open:options' });
    else if (cmd === 'clear') {
      state.history = [];
      state.pageContext = null;
      els.thread.querySelectorAll('.msg, .card').forEach((n) => n.remove());
      els.empty.hidden = false;
    } else if (cmd === 'hide-site') {
      const sites = new Set(state.settings.hiddenSites || []);
      sites.add(location.hostname);
      await S.saveSettings({ hiddenSites: [...sites] });
      closePanel();
    }
  });
  shadow.addEventListener('click', (e) => {
    if (!els.menu.hidden && !e.target.closest('.menu, .menu-btn')) els.menu.hidden = true;
  });

  // Remember the last selection: some sites clear it when focus moves into the panel.
  document.addEventListener('selectionchange', () => {
    const text = S.currentSelection();
    if (text) state.lastSelection = { text, at: Date.now() };
  });

  ext.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (!msg || typeof msg.type !== 'string' || !msg.type.startsWith('assistant:')) return false;
    if (msg.type === 'assistant:toggle') {
      if (isOpen()) closePanel();
      else openPanel();
    } else if (msg.type === 'assistant:run') {
      openPanel();
      if (msg.action === 'summarize') summarize();
      else if (msg.action === 'snippet') saveSnippet(msg.selectionText);
      else if (msg.action === 'slop') scanForSlop();
    }
    sendResponse({ ok: true });
    return false;
  });

  ext.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes.keysVersion) {
      if (isOpen()) connect();
      return;
    }
    if (!changes.settings) return;
    const before = state.settings;
    state.settings = { ...S.DEFAULT_SETTINGS, ...(changes.settings.newValue || {}) };
    applySettings();
    const keys = ['source', 'baseUrl', 'provider', 'apiKey', 'cloudProvider', 'customBaseUrl'];
    if (keys.some((k) => before[k] !== state.settings[k]) && isOpen()) connect();
  });

  S.getSettings().then((settings) => {
    state.settings = settings;
    state.slop.mode = settings.slopMode;
    applySettings();
  });
  updateControls();
})();
