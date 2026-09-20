# SoroTrack Browser Extension

Cross-browser extension compatible with **Microsoft Edge**, **Google Chrome / Chromium** (Brave, Opera), and **Mozilla Firefox** (Gecko).

Extracts tweet text, author info, engagement metrics, media, and reference links from `https://x.com/i/history` and bookmarks, then automatically syncs them directly into your personal SoroTrack archive dashboard.

---

## 🌊 How to Install in Microsoft Edge

1. Download **`sorotrack-edge.zip`** from the SoroTrack web dashboard (or click **Download for Microsoft Edge** in the Extension menu).
2. Extract `sorotrack-edge.zip` to a local folder on your computer.
3. Open **Microsoft Edge** and navigate to:
   ```text
   edge://extensions
   ```
   *(Or click the `...` menu in the top-right corner > **Extensions** > **Manage extensions**)*.
4. In the left-hand navigation pane, toggle **Developer mode** to **ON**.
5. Click the **"Load unpacked"** button that appears at the top.
6. Select the folder where you unzipped the extension (containing `manifest.json`).
7. *(Recommended)* Click the puzzle piece icon on the Edge toolbar and click the **"Show in toolbar"** (eye icon) next to SoroTrack to pin it.
8. Navigate to [https://x.com/i/history](https://x.com/i/history) or your bookmarks on X.
9. The floating **SoroTrack HUD** appears in the bottom-right corner. All features—including Auto-scroll, Audit History, Anon Mode, Local JSON Viewer, and "Sync from DB"—work seamlessly!

---

## 🌐 How to Install in Google Chrome or Brave

1. Download `sorotrack-chrome.zip` from the SoroTrack web dashboard.
2. Extract `sorotrack-chrome.zip` to a folder.
3. Open Chrome or Brave and navigate to:
   ```text
   chrome://extensions
   ```
4. Enable the **"Developer mode"** toggle in the top-right corner.
5. Click the **"Load unpacked"** button in the top-left.
6. Select the folder containing `manifest.json`.
7. Navigate to [https://x.com/i/history](https://x.com/i/history). Click **"Sync to SoroTrack"** in the floating HUD.

---

## 🦊 How to Install in Mozilla Firefox

1. Download `sorotrack-firefox.zip` from the SoroTrack web dashboard.
2. Extract `sorotrack-firefox.zip` into a local directory.
3. Open Firefox and navigate to:
   ```text
   about:debugging#/runtime/this-firefox
   ```
4. In the "Temporary Extensions" section, click **"Load Temporary Add-on..."**.
5. Select the `manifest.json` file inside your unzipped folder.
6. Navigate to [https://x.com/i/history](https://x.com/i/history) or bookmarks on X. The HUD appears automatically.

---

## ⚙️ Configuration & Remote Authentication

The SoroTrack middleware protects `/api/sync` with token authentication.

- When you download the extension package from the SoroTrack web dashboard, your current live endpoint and authentication token are pre-bundled automatically.
- To configure or update manually:
  - Open Extension Options or the extension popup.
  - Set **SoroTrack Service URL** (e.g. `http://localhost:3000` or your remote domain).
  - Set **Sync Authentication Token** (`sh_live_...`).
  - Use the **Test Connection** button to verify connectivity and credentials.
