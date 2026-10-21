# SoroTrack

An AI assistant on every web page. SoroTrack is a browser extension for Chrome (and Chromium browsers such as Edge and Brave) and Firefox, on macOS and Windows. It runs on either:

- **A local model on your computer:** [Ollama](https://ollama.com), LM Studio, llama.cpp, Jan, or any OpenAI-compatible server. This is private and free.
- **A cloud API with your own key:** Anthropic (Claude), OpenAI, Google Gemini, OpenRouter, Groq, Mistral, DeepSeek, xAI, or any OpenAI-compatible API. Use this if you don't have a local model.

Click the ✦ button in the corner of any page to:

- **Summarize** the page: a one-line TL;DR, key points, and anything worth noting.
- **Ask** follow-up questions about the page in a chat.
- **Save snippet**: saves your selection (or the whole page) to a local library. The model writes a title, a summary and tags.
- **Remove AI slop**: hides filler, machine-sounding padding and engagement bait, so the real content stays. You can restore the page or show the hidden parts dimmed. On feeds (X, Reddit, forums) it judges each post. On articles it judges each paragraph.

With a local model, page text never leaves your computer. With a cloud API, the text you act on goes only to the provider you choose, and is billed to your key. There are no SoroTrack accounts, servers or analytics.

## Install

### 1. Choose a model

**No local model? Use a cloud API.** Skip to step 2. After installing, open SoroTrack's settings, choose **Cloud API**, pick a provider and paste your API key. Each provider has a **Get a key** link. Then click **Test connection** and choose a model.

| Provider | Where to get a key | Notes |
|---|---|---|
| Anthropic (Claude) | [console.anthropic.com](https://console.anthropic.com/settings/keys) | Native Messages API; recommends Claude Opus 5.5 |
| OpenAI | [platform.openai.com](https://platform.openai.com/api-keys) | |
| Google Gemini | [aistudio.google.com](https://aistudio.google.com/apikey) | Gemini's OpenAI-compatible endpoint |
| OpenRouter | [openrouter.ai/keys](https://openrouter.ai/keys) | One key for hundreds of models |
| Groq, Mistral, DeepSeek, xAI | each provider's console | |
| Other | — | Any OpenAI-compatible base URL (Together, Fireworks, Azure-style proxies…) |

**Or run a local model:**

**Ollama (recommended):** install it from [ollama.com](https://ollama.com) (macOS or Windows), then pull a model:

```bash
ollama pull llama3.2
```

Small models (3–8B) are fast. Larger ones (14B and up) summarize and filter noticeably better.

**Other servers:** start the server and use its `/v1` URL in SoroTrack's settings. For example, LM Studio is `http://127.0.0.1:1234/v1`, the llama.cpp server is `http://127.0.0.1:8080/v1` and Jan is `http://127.0.0.1:1337/v1`.

### 2. Get the extension

**Download a ready-made build** from the [`downloads/`](downloads) folder:

- Chrome, Edge, Brave, Arc: [sorotrack-chrome.zip](https://github.com/arjunmarri/sorotracker/raw/2.0/downloads/sorotrack-chrome.zip)
- Firefox: [sorotrack-firefox.zip](https://github.com/arjunmarri/sorotracker/raw/2.0/downloads/sorotrack-firefox.zip)

Unzip the Chrome build into a folder you'll keep: Chrome loads the extension from that folder. Firefox can load the zip directly.

**Or build it yourself.** You need [Node.js](https://nodejs.org) 20 or later. The build has no dependencies and works the same on macOS and Windows.

```bash
npm run build
```

This creates `dist/chrome` and `dist/firefox`. Run `npm run package` to also get zip files in `dist/`.

### 3. Load it in your browser

**Chrome, Edge, Brave, Arc:** open `chrome://extensions` (or `edge://extensions`), turn on **Developer mode**, click **Load unpacked** and choose the unzipped folder (or `dist/chrome` if you built it).

**Firefox (128+):** open `about:debugging#/runtime/this-firefox`, click **Load Temporary Add-on…** and choose `sorotrack-firefox.zip` (or `dist/firefox/manifest.json` if you built it). Temporary add-ons are removed when Firefox restarts. To install it permanently, sign the zip through [addons.mozilla.org](https://addons.mozilla.org/developers/) (it can be unlisted).

On first install the settings page opens and tests the connection to `http://127.0.0.1:11434`.

## Using it

| Where | How |
|---|---|
| Any page | The ✦ button in the bottom-right corner |
| Keyboard | <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>K</kbd> opens or closes the assistant (Option on a Mac). You can change it at `chrome://extensions/shortcuts`. |
| Right-click menu | *Save selection as snippet*, *Summarize this page*, *Remove AI slop from this page* |
| Toolbar icon | Connection status, quick actions, snippets and settings |

Saved snippets are listed on the **Snippets** page, where you can search, filter by tag, copy, delete, and export to JSON or Markdown (and import JSON).

You can hide the button on a site from the assistant's **⋯** menu. Settings let you change the server URL, model, temperature, context window, how much page text to send, and whether removed slop is hidden or dimmed.

## How it works

```
 web page ──► content scripts (assistant UI in a closed shadow root, page text extraction)
                 │  long-lived port: chat request ▸ streamed tokens
                 ▼
          background worker ──► http://127.0.0.1:11434  (Ollama /api/chat, or /v1/chat/completions)
```

- All model requests come from the background worker, so page Content Security Policies and mixed-content rules don't block them.
- Three wire formats cover every provider: Ollama's native API, OpenAI chat completions (local servers and most cloud APIs), and Anthropic's Messages API. Claude requests send the system prompt as `system`, skip `temperature` (current Claude models don't accept it) and use `effort: low` for speed. Current models also opt in to server-side refusal fallbacks. If an OpenAI reasoning model rejects a custom temperature, the request is retried without it.
- **API keys** are encrypted at rest with AES-256-GCM. The encryption key is a non-extractable WebCrypto key: the browser can use it, but no script can read its bytes. Both the key and the ciphertext live in the extension's own IndexedDB, which websites, SoroTrack's page-side scripts and other extensions can't open. Only the background worker decrypts keys, and it sends each key only to its own provider. The settings page never receives a saved key back; it shows only the last four characters. Key changes are announced with a version number, never the key itself. Messages that read or change keys, or test unsaved settings, are accepted only from SoroTrack's own pages. Keys saved in plain text by 2.1.0 are migrated automatically on first run.
  - *Limits:* this protects against websites, other extensions, and copies or backups of extension storage. It can't stop malware running as your user account, which could control the browser itself. Treat API keys like passwords: give them a spending limit and revoke them if a device is lost.
- **Ollama and 403 errors:** Ollama rejects requests from `chrome-extension://` and `moz-extension://` origins by default. SoroTrack rewrites the `Origin` header to the server's own origin, which Ollama always accepts. This applies only to the extension's own background requests: Chrome uses a session `declarativeNetRequest` rule and Firefox uses `webRequest`. Requests from web pages are never changed, so you don't need to set `OLLAMA_ORIGINS`.
- Reasoning models (Qwen3, DeepSeek-R1, Gemma 4…) run with thinking turned off for speed, and any `<think>` output is removed. You can turn thinking on in settings.
- Settings, keys and snippets are stored in `chrome.storage.local` on your machine (one key per snippet, so saves from several tabs can't overwrite each other).

## Development

```
extension/
  manifest.json        base manifest; the build writes per-browser variants
  background/          sw.js (Chrome entry) · background.js (routing, menus, Origin rewrite) · llm.js (Ollama, OpenAI-compatible and Anthropic client) · secrets.js (encrypted API keys)
  content/             assistant.js (panel UI and tasks) · extract.js (readable text, content blocks) · styles.js
  shared/              config.js (settings) · prompts.js · markdown.js (safe renderer) · snippets.js
  pages/               popup, options and snippets pages
  icons/               generated by scripts/make-icons.mjs
scripts/build.mjs      copies extension/ to dist/<browser>/ with the right manifest; --zip packs it
test/                  node:test unit tests (LLM client, prompts and parsers, Markdown, manifest wiring)
```

```bash
npm test          # unit tests
npm run build     # dist/chrome and dist/firefox
npm run package   # build plus zips
npm run downloads # refresh the committed zips in downloads/
npm run icons     # regenerate the PNG icons
```

After editing, run `npm run build` and click **Reload** on the extension card (or reload the temporary add-on in Firefox).

## Troubleshooting

- **"Can't reach http://127.0.0.1:11434"**: Ollama isn't running. Open the app (macOS menu bar or Windows tray), or run `ollama serve`.
- **No models**: run `ollama pull llama3.2` (or any chat model).
- **Still getting 403 Forbidden** (for example from a proxy in front of Ollama): allow extension origins, then quit and restart Ollama.
  - macOS: `launchctl setenv OLLAMA_ORIGINS "chrome-extension://*,moz-extension://*"`
  - Windows: `setx OLLAMA_ORIGINS "chrome-extension://*,moz-extension://*"`
- **The button doesn't appear**: browser pages (`chrome://`, the extension stores, PDFs) can't run extensions. On a normal site, reload the tab after installing.
- **Cloud API errors:** *rejected the API key* means a wrong or expired key, or no billing set up. *Rate limiting* means wait a minute or check your account limits. *Model not found* means pick another model in settings.
- **Slow first answer**: the model is loading into memory. Later requests are much faster.

## Earlier versions

SoroTrack 1.x was an 𝕏-history archive with a React dashboard, an Express server, Firestore and Gemini. It is still on the `main` branch. Version 2.0 replaces all of that with this standalone, fully local extension.
