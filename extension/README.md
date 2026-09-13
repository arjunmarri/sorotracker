# SoroTrack Browser Extension

Cross-browser extension compatible with **Mozilla Firefox** (Gecko) and **Google Chrome / Chromium** (Brave, Edge, Opera).

Extracts tweet text, author info, engagement metrics, media, and reference links from `https://x.com/i/history` and bookmarks, then automatically syncs them directly into your personal SoroTrack archive dashboard.

---

## 🚀 High-Performance, Non-Blocking Engine

- **Isolated Shadow DOM**: The extension HUD lives inside an isolated Shadow Root (`attachShadow({ mode: 'open' })`). It does not pollute X.com's styles or conflict with X's React hydration root.
- **Zero Reflow Extraction**: Uses `textContent` instead of synchronous `innerText` and skips node cloning, eliminating forced synchronous layout calculations in Gecko / Firefox.
- **Single-Pass Parsing**: Tags parsed DOM nodes (`data-soro-scanned`) to ensure each post is inspected exactly once.
- **Cooperative Idle Scheduling**: Postpones initial execution until X.com's React app completes initial hydration, and uses `requestIdleCallback` with trailing debounce during scrolling.
- **Smart Local JSON Storage & Manual Sync**: Scanned posts and bookmarks are safely preserved in browser local storage (`chrome.storage.local` under `soro_history_json`). Syncing to the database is an explicit, manual action to conserve Firestore daily quota limits.
- **Direct JSON Import & Export**:
  - **Export JSON**: Download your entire bookmark & post archive as a `.json` file at any time from the extension popup, options page, or on-page HUD.
  - **Import JSON**: Upload any previously exported or backup `.json` file directly via the extension popup, options page, or on-page HUD. Imported items are deduplicated and merged into your local JSON buffer, ready to browse, audit, or manually sync.
- **Persistent JSON Safety & Offline Resilience**: If the Firestore daily quota limit is encountered or the network fails, records remain preserved safely in local JSON storage. The HUD and popup display an "Offline" badge, and manual sync can be executed whenever you wish. The extension never stops scanning or buffering!

---

## 🦊 How to Install in Mozilla Firefox

1. Open Firefox and navigate to:
   ```text
   about:debugging#/runtime/this-firefox
   ```
2. In the "Temporary Extensions" section, click **"Load Temporary Add-on..."**.
3. Select the `manifest.json` file inside your unzipped folder.
4. The extension is active!
5. Navigate to [https://x.com/i/history](https://x.com/i/history) or [https://x.com/i/bookmarks](https://x.com/i/bookmarks).
6. The floating **SoroTrack** HUD appears gracefully on the bottom-right corner. Click **"Sync to SoroTrack"** to transmit captured posts and links into your database.

---

## 🌐 How to Install in Google Chrome, Brave, or Edge

1. Open your browser and navigate to:
   ```text
   chrome://extensions
   ```
2. Enable the **"Developer mode"** toggle in the top-right corner.
3. Click the **"Load unpacked"** button on the top-left.
4. Select your unzipped extension directory containing `manifest.json`.
5. Navigate to [https://x.com/i/history](https://x.com/i/history). Click **"Sync to SoroTrack"** in the floating HUD.

---

## ⚙️ Configuration & Remote Authentication

The SoroTrack middleware protects `/api/sync` with token authentication.

- When you download the extension package from the SoroTrack web dashboard, your current live endpoint and authentication token are pre-bundled automatically.
- To configure or update manually:
  - Open Extension Options or the extension popup.
  - Set **SoroTrack Service URL** (e.g. `http://localhost:3000` or your remote domain).
  - Set **Sync Authentication Token** (`sh_live_...`).
  - Use the **Test Connection** button to verify connectivity and credentials.
