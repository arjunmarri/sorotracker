// Reads the useful text out of a live page: the main readable content for summaries and
// questions, and individual content blocks for the AI slop filter.
(function (root) {
  'use strict';

  const SoroTrack = (root.SoroTrack = root.SoroTrack || {});

  const SKIP =
    'script, style, noscript, template, svg, canvas, iframe, nav, footer, aside, button, select, textarea, ' +
    '[aria-hidden="true"], [hidden], [role="navigation"], [role="banner"], [role="contentinfo"], [role="complementary"]';
  const BLOCKS = 'h1, h2, h3, h4, h5, h6, p, li, blockquote, pre, figcaption, dt, dd, td, th';
  const FEED_UNITS = 'article, [role="article"]';
  const PARAGRAPH_UNITS = 'p, li, blockquote, dd';

  const squash = (text) => String(text || '').replace(/[ \t ]+/g, ' ').replace(/\s*\n\s*/g, '\n').trim();

  function isVisible(el) {
    if (!el.getClientRects().length) return false;
    const style = getComputedStyle(el);
    return style.visibility !== 'hidden' && style.opacity !== '0';
  }

  // True if any ancestor between el and container (exclusive) matches the selector or is in the set.
  function hasAncestor(el, container, { selector, set }) {
    for (let node = el.parentElement; node && node !== container; node = node.parentElement) {
      if (selector && node.matches(selector)) return true;
      if (set && set.has(node)) return true;
    }
    return false;
  }

  function pickContentRoot(doc) {
    let best = null;
    let bestLength = 0;
    for (const el of doc.querySelectorAll('article, main, [role="main"]')) {
      const length = (el.innerText || '').length;
      if (length > bestLength) {
        best = el;
        bestLength = length;
      }
    }
    return best && bestLength > 500 ? best : doc.body;
  }

  function formatBlock(el, text) {
    const tag = el.tagName.toLowerCase();
    if (/^h[1-6]$/.test(tag)) return `${'#'.repeat(Number(tag[1]))} ${text.replace(/\n/g, ' ')}`;
    if (tag === 'li') return `- ${text}`;
    if (tag === 'blockquote') return text.split('\n').map((line) => `> ${line}`).join('\n');
    if (tag === 'pre') return '```\n' + text + '\n```';
    return text;
  }

  function truncate(text, maxChars) {
    if (text.length <= maxChars) return { text, truncated: false };
    const cut = text.lastIndexOf('\n', maxChars);
    return { text: text.slice(0, cut > maxChars * 0.8 ? cut : maxChars), truncated: true };
  }

  /** Returns { title, url, text, truncated } with the page's main readable text as light Markdown. */
  function extractPage(doc = document, { maxChars = 12000 } = {}) {
    const container = pickContentRoot(doc);
    const parts = [];
    const taken = new Set();

    for (const el of container.querySelectorAll(BLOCKS)) {
      if (hasAncestor(el, container, { selector: SKIP, set: taken })) continue;
      if (el.matches(SKIP) || !isVisible(el)) continue;
      const raw = el.tagName === 'PRE' ? el.innerText.trim() : squash(el.innerText);
      if (!raw) continue;
      taken.add(el);
      const block = formatBlock(el, raw);
      if (parts[parts.length - 1] !== block) parts.push(block);
    }

    let text = parts.join('\n\n');
    // Sites built from <div>s (social feeds, web apps) have few semantic blocks; use rendered text then.
    const fullText = squash(container.innerText);
    if (text.length < fullText.length * 0.4) text = fullText;

    return { title: doc.title, url: doc.location ? doc.location.href : '', ...truncate(text, maxChars) };
  }

  /**
   * Splits the page into blocks the slop filter can judge and hide one by one.
   * Feeds (X, Reddit, forums) are judged per post; articles per paragraph.
   */
  function collectContentBlocks(doc = document, { limit = 150, maxBlockChars = 500 } = {}) {
    const usable = (el, min, max) => {
      if (el.hasAttribute('data-sorotrack-slop') || el.closest(SKIP) || !isVisible(el)) return null;
      const text = squash(el.innerText);
      return text.length >= min && text.length <= max ? text : null;
    };

    let blocks = [];
    for (const el of doc.querySelectorAll(FEED_UNITS)) {
      if (el.querySelector(FEED_UNITS)) continue; // only the innermost posts
      const text = usable(el, 40, 4000);
      if (text) blocks.push({ el, text });
    }

    if (blocks.length < 3) {
      blocks = [];
      for (const el of doc.body.querySelectorAll(PARAGRAPH_UNITS)) {
        if (hasAncestor(el, doc.body, { selector: PARAGRAPH_UNITS })) continue;
        const text = usable(el, 80, 6000);
        if (text) blocks.push({ el, text });
      }
    }

    return blocks.slice(0, limit).map((block, index) => ({
      id: index + 1,
      el: block.el,
      text: block.text.length > maxBlockChars ? block.text.slice(0, maxBlockChars) + '…' : block.text,
    }));
  }

  function currentSelection(doc = document) {
    const selection = doc.getSelection();
    return selection ? squash(selection.toString()) : '';
  }

  Object.assign(SoroTrack, { extractPage, collectContentBlocks, currentSelection });
})(globalThis);
