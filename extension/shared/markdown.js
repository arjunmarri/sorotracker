// Small, safe Markdown renderer for model output. Everything is HTML-escaped first;
// only a fixed set of tags is produced and links must be http(s).
(function (root) {
  'use strict';

  const SoroTrack = (root.SoroTrack = root.SoroTrack || {});

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Removes model reasoning: <think>…</think> blocks, an unfinished block at the end of a stream,
  // and reasoning that ends in a lone </think> (some chat templates put the opening tag in the prompt).
  function stripThinking(text) {
    let out = String(text);
    const close = out.toLowerCase().lastIndexOf('</think>');
    if (close >= 0 && out.toLowerCase().lastIndexOf('<think>', close) < 0) out = out.slice(close + '</think>'.length);
    return out.replace(/<think>[\s\S]*?(<\/think>|$)/gi, '').replace(/^\s+/, '');
  }

  function renderInline(escaped) {
    const codeSpans = [];
    let html = escaped.replace(/`([^`\n]+)`/g, (_, code) => {
      codeSpans.push(`<code>${code}</code>`);
      return `\u0000${codeSpans.length - 1}\u0000`;
    });
    html = html
      .replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
      .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
      .replace(/__([^_\n]+)__/g, '<strong>$1</strong>')
      .replace(/(^|[^*\w])\*([^*\n]+)\*(?!\w)/g, '$1<em>$2</em>')
      .replace(/(^|[^_\w])_([^_\n]+)_(?!\w)/g, '$1<em>$2</em>');
    return html.replace(/\u0000(\d+)\u0000/g, (_, i) => codeSpans[Number(i)]);
  }

  function renderMarkdown(text) {
    const lines = escapeHtml(String(text || '').replace(/\r\n?/g, '\n')).split('\n');
    const out = [];
    let paragraph = [];
    let list = null; // { tag: 'ul' | 'ol', items: [] }
    let code = null;

    const flushParagraph = () => {
      if (paragraph.length) out.push(`<p>${renderInline(paragraph.join('<br>'))}</p>`);
      paragraph = [];
    };
    const flushList = () => {
      if (list) out.push(`<${list.tag}>${list.items.map((item) => `<li>${renderInline(item)}</li>`).join('')}</${list.tag}>`);
      list = null;
    };

    for (const line of lines) {
      if (code) {
        if (/^\s*```/.test(line)) {
          out.push(`<pre><code>${code.join('\n')}</code></pre>`);
          code = null;
        } else code.push(line);
        continue;
      }
      if (/^\s*```/.test(line)) {
        flushParagraph();
        flushList();
        code = [];
        continue;
      }

      const heading = line.match(/^\s*(#{1,6})\s+(.*)$/);
      const bullet = line.match(/^\s*[-*•]\s+(.*)$/);
      const numbered = line.match(/^\s*\d+[.)]\s+(.*)$/);

      if (heading) {
        flushParagraph();
        flushList();
        const level = Math.min(6, heading[1].length + 2); // keep headings small inside the panel
        out.push(`<h${level}>${renderInline(heading[2])}</h${level}>`);
      } else if (bullet || numbered) {
        flushParagraph();
        const tag = bullet ? 'ul' : 'ol';
        if (list && list.tag !== tag) flushList();
        list = list || { tag, items: [] };
        list.items.push((bullet || numbered)[1]);
      } else if (!line.trim()) {
        flushParagraph();
        flushList();
      } else if (list && /^\s{2,}\S/.test(line)) {
        list.items[list.items.length - 1] += ' ' + line.trim(); // wrapped list item
      } else {
        flushList();
        paragraph.push(line.trim());
      }
    }
    if (code) out.push(`<pre><code>${code.join('\n')}</code></pre>`);
    flushParagraph();
    flushList();
    return out.join('');
  }

  Object.assign(SoroTrack, { escapeHtml, renderMarkdown, stripThinking });
})(globalThis);
