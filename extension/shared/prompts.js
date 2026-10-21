// Prompt builders and response parsers for the assistant's tasks. Pure functions, unit tested.
(function (root) {
  'use strict';

  const SoroTrack = (root.SoroTrack = root.SoroTrack || {});

  const PERSONA =
    'You are SoroTrack, a private assistant running on a local model inside the user\'s browser. ' +
    'Be accurate, concise and concrete. Use Markdown. Never invent facts that are not on the page.';

  function pageBlock(page) {
    const note = page.truncated ? '\n[Page text was truncated to fit the model context.]' : '';
    return `Title: ${page.title || '(untitled)'}\nURL: ${page.url}\n\n<page>\n${page.text}\n</page>${note}`;
  }

  function summarizeMessages(page) {
    return [
      { role: 'system', content: PERSONA },
      {
        role: 'user',
        content:
          `${pageBlock(page)}\n\nSummarize this web page.\n` +
          'Format:\n**TL;DR:** one sentence.\n\n**Key points**\n- 3 to 7 bullets with the concrete facts, numbers and claims.\n\n' +
          'If something is notably missing, one-sided or promotional, add a short **Worth noting** line.',
      },
    ];
  }

  function askSystemMessage(page) {
    return {
      role: 'system',
      content:
        `${PERSONA}\nAnswer questions about the page below. If the page does not contain the answer, say so ` +
        `and answer from general knowledge only if the user asks you to.\n\n${pageBlock(page)}`,
    };
  }

  function snippetMessages(text, page) {
    return [
      {
        role: 'system',
        content: 'You label saved web snippets. Reply with JSON only, no prose.',
      },
      {
        role: 'user',
        content:
          `Page title: ${page.title || '(untitled)'}\nURL: ${page.url}\n\n<snippet>\n${text}\n</snippet>\n\n` +
          'Return JSON: {"title": "a specific title, max 80 chars", "summary": "1-2 sentences with the key information", ' +
          '"tags": ["1 to 4 short lowercase topic tags"]}',
      },
    ];
  }

  const SLOP_DEFINITION =
    'Slop is low-value filler: generic or machine-sounding text ("In today\'s fast-paced world", ' +
    '"it\'s important to note", "game-changer", "unlock the power of"), padded intros and conclusions that say ' +
    'nothing, SEO fluff, engagement bait ("Agree? 👇", "Like and repost"), and vague motivational posts. ' +
    'Keep anything with concrete facts, numbers, code, commands, first-hand experience or a specific opinion, ' +
    'even if it is informal or short.';

  // Asking for a label per block (rather than a list of slop ids) makes small models judge every
  // block and gave far fewer false positives in testing.
  function slopMessages(blocks) {
    const list = blocks.map((b) => `[${b.id}] ${b.text}`).join('\n\n');
    return [
      {
        role: 'system',
        content:
          `You review blocks of a web page one by one and label each as "keep" or "slop". ${SLOP_DEFINITION} ` +
          'When unsure, label "keep". Reply with JSON only.',
      },
      {
        role: 'user',
        content: `${list}\n\nReturn JSON with one label per block: {"labels": {"<id>": "keep" | "slop"}}`,
      },
    ];
  }

  // Pulls the first JSON object out of a model reply, tolerating code fences and chatter.
  function parseJsonLoose(text) {
    const cleaned = SoroTrack.stripThinking(text || '')
      .replace(/```(?:json)?/gi, '')
      .trim();
    try {
      return JSON.parse(cleaned);
    } catch {
      // fall through to scanning for a balanced object
    }
    const start = cleaned.indexOf('{');
    if (start < 0) return null;
    let depth = 0;
    let inString = false;
    for (let i = start; i < cleaned.length; i++) {
      const ch = cleaned[i];
      if (inString) {
        if (ch === '\\') i++;
        else if (ch === '"') inString = false;
      } else if (ch === '"') inString = true;
      else if (ch === '{') depth++;
      else if (ch === '}' && --depth === 0) {
        try {
          return JSON.parse(cleaned.slice(start, i + 1));
        } catch {
          return null;
        }
      }
    }
    return null;
  }

  // Returns the ids (from validIds) labelled as slop. Also accepts {"slop": [ids]}.
  function parseSlopIds(text, validIds) {
    const json = parseJsonLoose(text) || {};
    if (json.labels && typeof json.labels === 'object') {
      return validIds.filter((id) => String(json.labels[id] || '').trim().toLowerCase() === 'slop');
    }
    const listed = new Set(
      (Array.isArray(json.slop) ? json.slop : []).map((item) => Number(item && typeof item === 'object' ? item.id : item))
    );
    return validIds.filter((id) => listed.has(id));
  }

  function parseSnippetMeta(text, fallbackTitle) {
    const json = parseJsonLoose(text) || {};
    const clean = (value, max) => String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
    const tags = Array.isArray(json.tags) ? json.tags : [];
    return {
      title: clean(json.title, 120) || clean(fallbackTitle, 120) || 'Untitled snippet',
      summary: clean(json.summary, 600),
      tags: [...new Set(tags.map((t) => clean(t, 30).toLowerCase().replace(/^#/, '')).filter(Boolean))].slice(0, 4),
    };
  }

  Object.assign(SoroTrack, {
    prompts: { summarizeMessages, askSystemMessage, snippetMessages, slopMessages },
    parseJsonLoose,
    parseSlopIds,
    parseSnippetMeta,
  });
})(globalThis);
