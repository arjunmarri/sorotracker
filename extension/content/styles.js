// Styles for the assistant. They live inside a shadow root, so pages can't restyle the
// assistant and the assistant can't leak styles into pages.
(function (root) {
  'use strict';

  const SoroTrack = (root.SoroTrack = root.SoroTrack || {});

  SoroTrack.ASSISTANT_CSS = `
:host {
  all: initial;
  --bg: #ffffff;
  --bg-soft: #f5f5f7;
  --bg-hover: #ececf1;
  --fg: #18181b;
  --fg-muted: #6b6b76;
  --border: #e4e4e9;
  --accent: #4f46e5;
  --accent-fg: #ffffff;
  --accent-soft: #eef0ff;
  --ok: #16a34a;
  --warn: #d97706;
  --err: #dc2626;
  --shadow: 0 18px 50px rgba(15, 15, 30, 0.22), 0 2px 8px rgba(15, 15, 30, 0.08);
  font: 14px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  color: var(--fg);
}
@media (prefers-color-scheme: dark) {
  :host {
    --bg: #1c1c21;
    --bg-soft: #26262d;
    --bg-hover: #303038;
    --fg: #f1f1f4;
    --fg-muted: #a1a1ad;
    --border: #34343c;
    --accent: #8b85ff;
    --accent-fg: #14142b;
    --accent-soft: #2a2950;
    --shadow: 0 18px 50px rgba(0, 0, 0, 0.55), 0 2px 8px rgba(0, 0, 0, 0.3);
  }
}
*, *::before, *::after { box-sizing: border-box; }
[hidden] { display: none !important; }
button, select, textarea { font: inherit; color: inherit; }
button { cursor: pointer; }
button:disabled { cursor: not-allowed; opacity: 0.5; }
:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
svg { width: 18px; height: 18px; flex: none; }

.launcher {
  position: fixed; right: 20px; bottom: 20px; z-index: 2147483647;
  width: 48px; height: 48px; border-radius: 50%; border: none;
  display: grid; place-items: center;
  background: linear-gradient(140deg, #6366f1, #8b5cf6);
  color: #fff; box-shadow: 0 8px 24px rgba(79, 70, 229, 0.45);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}
.launcher:hover { transform: translateY(-2px) scale(1.04); box-shadow: 0 12px 28px rgba(79, 70, 229, 0.55); }
.launcher svg { width: 24px; height: 24px; }
.launcher.busy::after {
  content: ""; position: absolute; inset: -4px; border-radius: 50%;
  border: 2px solid transparent; border-top-color: #8b5cf6; animation: spin 0.9s linear infinite;
}

.panel {
  position: fixed; right: 20px; bottom: 80px; z-index: 2147483647;
  width: min(400px, calc(100vw - 24px)); height: min(600px, calc(100vh - 100px));
  display: flex; flex-direction: column;
  background: var(--bg); border: 1px solid var(--border); border-radius: 16px;
  box-shadow: var(--shadow); overflow: hidden;
  animation: pop 0.16s ease-out;
}
.panel.no-launcher { bottom: 20px; }
@media (max-width: 480px) {
  .panel { right: 12px; left: 12px; width: auto; bottom: 76px; }
}

header {
  position: relative; display: flex; align-items: center; gap: 8px;
  padding: 10px 10px 10px 14px; border-bottom: 1px solid var(--border);
}
.brand { display: flex; align-items: center; gap: 7px; font-weight: 650; letter-spacing: -0.01em; }
.brand-mark {
  width: 22px; height: 22px; border-radius: 7px; display: grid; place-items: center;
  background: linear-gradient(140deg, #6366f1, #8b5cf6); color: #fff;
}
.brand-mark svg { width: 14px; height: 14px; }
.status {
  margin-left: auto; min-width: 0; display: flex; align-items: center; gap: 6px;
  padding: 3px 4px 3px 9px; border-radius: 999px; background: var(--bg-soft);
}
.dot { width: 8px; height: 8px; border-radius: 50%; background: var(--fg-muted); flex: none; }
.dot.ready { background: var(--ok); }
.dot.connecting { background: var(--warn); animation: pulse 1s ease-in-out infinite; }
.dot.offline { background: var(--err); }
.status-text { font-size: 12px; color: var(--fg-muted); white-space: nowrap; }
.model {
  max-width: 150px; min-width: 0; border: none; background: transparent; font-size: 12px;
  padding: 2px 2px; text-overflow: ellipsis; border-radius: 6px;
}
.model:hover { background: var(--bg-hover); }
.icon-btn {
  width: 30px; height: 30px; border-radius: 8px; border: none; background: transparent;
  display: grid; place-items: center; color: var(--fg-muted); flex: none;
}
.icon-btn:hover { background: var(--bg-hover); color: var(--fg); }

.menu {
  position: absolute; top: 44px; right: 10px; z-index: 2; min-width: 210px; padding: 5px;
  background: var(--bg); border: 1px solid var(--border); border-radius: 10px; box-shadow: var(--shadow);
}
.menu button {
  display: block; width: 100%; text-align: left; border: none; background: none;
  padding: 7px 10px; border-radius: 6px;
}
.menu button:hover { background: var(--bg-soft); }

.actions { display: flex; flex-wrap: wrap; gap: 6px; padding: 10px 12px; border-bottom: 1px solid var(--border); }
.chip {
  display: inline-flex; align-items: center; gap: 6px; padding: 6px 11px;
  border: 1px solid var(--border); border-radius: 999px; background: var(--bg); font-size: 13px; font-weight: 500;
}
.chip svg { width: 15px; height: 15px; color: var(--accent); }
.chip:hover:not(:disabled) { background: var(--accent-soft); border-color: var(--accent); }
.chip.active { background: var(--accent-soft); border-color: var(--accent); }

.thread { flex: 1; overflow-y: auto; padding: 14px; display: flex; flex-direction: column; gap: 12px; }
.empty { margin: auto 0; color: var(--fg-muted); font-size: 13px; text-align: center; padding: 0 12px; }
.empty strong { display: block; color: var(--fg); font-size: 15px; margin-bottom: 4px; }
.empty ul { text-align: left; margin: 12px auto 0; padding-left: 18px; max-width: 270px; }

.msg { max-width: 100%; overflow-wrap: anywhere; }
.msg.user {
  align-self: flex-end; max-width: 85%; padding: 8px 12px; border-radius: 14px 14px 4px 14px;
  background: var(--accent); color: var(--accent-fg); white-space: pre-wrap;
}
.msg.assistant { align-self: stretch; }
.msg.assistant > :first-child { margin-top: 0; }
.msg.assistant > :last-child { margin-bottom: 0; }
.msg p, .msg ul, .msg ol, .msg pre { margin: 0 0 8px; }
.msg ul, .msg ol { padding-left: 20px; }
.msg li { margin: 2px 0; }
.msg h3, .msg h4, .msg h5, .msg h6 { margin: 12px 0 4px; font-size: 14px; }
.msg code { font: 12.5px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; background: var(--bg-soft); padding: 1px 4px; border-radius: 4px; }
.msg pre { background: var(--bg-soft); padding: 10px; border-radius: 8px; overflow-x: auto; }
.msg pre code { background: none; padding: 0; }
.msg a { color: var(--accent); }
.typing { color: var(--fg-muted); font-size: 13px; display: inline-flex; gap: 6px; align-items: center; }
.typing::before {
  content: ""; width: 12px; height: 12px; border-radius: 50%;
  border: 2px solid var(--border); border-top-color: var(--accent); animation: spin 0.8s linear infinite;
}

.card { border: 1px solid var(--border); border-radius: 12px; padding: 10px 12px; background: var(--bg-soft); font-size: 13px; }
.card.error { border-color: color-mix(in srgb, var(--err) 45%, var(--border)); }
.card-title { font-weight: 600; display: flex; align-items: center; gap: 6px; margin-bottom: 2px; }
.card-title svg { width: 16px; height: 16px; }
.card.error .card-title svg { color: var(--err); }
.card.ok .card-title svg { color: var(--ok); }
.card p { margin: 4px 0 0; color: var(--fg-muted); }
.card pre { margin: 8px 0 0; white-space: pre-wrap; font: 12px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; color: var(--fg); }
.card-actions { display: flex; gap: 6px; margin-top: 8px; flex-wrap: wrap; }
.card-actions button { border: 1px solid var(--border); background: var(--bg); border-radius: 8px; padding: 4px 10px; font-size: 12.5px; }
.card-actions button:hover { border-color: var(--accent); }
.tags { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px; }
.tag { font-size: 11.5px; padding: 1px 8px; border-radius: 999px; background: var(--accent-soft); color: var(--accent); }
.progress { height: 4px; border-radius: 4px; background: var(--border); margin-top: 8px; overflow: hidden; }
.progress > div { height: 100%; background: var(--accent); width: 0; transition: width 0.2s ease; }

.composer { display: flex; align-items: flex-end; gap: 8px; padding: 10px 12px 12px; border-top: 1px solid var(--border); }
.composer textarea {
  flex: 1; resize: none; min-height: 38px; max-height: 140px; padding: 8px 12px;
  border: 1px solid var(--border); border-radius: 12px; background: var(--bg-soft); outline: none;
}
.composer textarea:focus { border-color: var(--accent); background: var(--bg); }
.send {
  width: 38px; height: 38px; border-radius: 12px; border: none; display: grid; place-items: center;
  background: var(--accent); color: var(--accent-fg);
}
.send.stop { background: var(--fg); color: var(--bg); }

@keyframes spin { to { transform: rotate(360deg); } }
@keyframes pulse { 50% { opacity: 0.35; } }
@keyframes pop { from { opacity: 0; transform: translateY(8px) scale(0.98); } }
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation: none !important; transition: none !important; }
}
`;

  // Applied to the page itself (outside the shadow root) to hide or dim blocks flagged as slop.
  SoroTrack.PAGE_CSS = `
[data-sorotrack-slop="hide"] { display: none !important; }
[data-sorotrack-slop="dim"] { opacity: 0.25 !important; filter: grayscale(1) !important; outline: 1px dashed rgba(220, 38, 38, 0.6) !important; }
`;
})(globalThis);
