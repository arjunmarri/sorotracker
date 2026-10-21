import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load } from './helpers.mjs';

const S = await load('shared/markdown.js', 'shared/prompts.js');

test('parseJsonLoose handles fences, chatter and think blocks', () => {
  assert.deepEqual(S.parseJsonLoose('{"a":1}'), { a: 1 });
  assert.deepEqual(S.parseJsonLoose('```json\n{"a": [1, 2]}\n```'), { a: [1, 2] });
  assert.deepEqual(S.parseJsonLoose('<think>{no}</think>Sure! {"slop": [3], "note": "a } b"} done'), { slop: [3], note: 'a } b' });
  assert.equal(S.parseJsonLoose('no json here'), null);
  assert.deepEqual(S.parseJsonLoose('I should return {"labels"} for each…\n</think>\n{"labels": {"1": "keep"}}'), { labels: { 1: 'keep' } });
});

test('parseSlopIds reads per-block labels and ignores unknown ids', () => {
  assert.deepEqual(S.parseSlopIds('{"labels": {"1": "slop", "2": "keep", "3": " Slop ", "99": "slop"}}', [1, 2, 3]), [1, 3]);
  assert.deepEqual(S.parseSlopIds('{"slop": [1, "2", 2, 99, {"id": 3}]}', [1, 2, 3]), [1, 2, 3]);
  assert.deepEqual(S.parseSlopIds('garbage', [1]), []);
});

test('parseSnippetMeta cleans fields and falls back to the page title', () => {
  const meta = S.parseSnippetMeta('{"title": "  Rust  async\\n", "summary": "Short.", "tags": ["#Rust", "rust", "Async", "", "a", "b"]}', 'Page');
  assert.deepEqual(meta, { title: 'Rust async', summary: 'Short.', tags: ['rust', 'async', 'a', 'b'] });
  assert.equal(S.parseSnippetMeta('oops', 'Page title').title, 'Page title');
});

test('prompts embed the page and number the slop blocks', () => {
  const page = { title: 'T', url: 'https://x.test', text: 'Body', truncated: true };
  const [, user] = S.prompts.summarizeMessages(page);
  assert.match(user.content, /<page>\nBody\n<\/page>/);
  assert.match(user.content, /truncated/);
  const slop = S.prompts.slopMessages([{ id: 4, text: 'Agree? 👇' }]);
  assert.match(slop[1].content, /\[4\] Agree\? 👇/);
});
