# SoroTrack — System Context & Architecture Specification

> **Target Version**: v1.1.0  
> **Environment**: Full-Stack Web Application (Node.js/Express) + React 19 Frontend + Cross-Browser Manifest V3 Extension  
> **Purpose**: This document provides the complete system context, component diagrams, API specifications, data models, and step-by-step instructions to locally build and package native Windows binaries (`.exe`).

---

## Table of Contents
1. [Executive System Overview](#1-executive-system-overview)
2. [Component & Layer Architecture](#2-component--layer-architecture)
3. [File Tree & Module Responsibilities](#3-file-tree--module-responsibilities)
4. [Data Models & Storage Layers](#4-data-models--storage-layers)
5. [API Endpoint Specifications](#5-api-endpoint-specifications)
6. [Browser Extension Architecture (MV3)](#6-browser-extension-architecture-mv3)
7. [Authentication & Security Model](#7-authentication--security-model)
8. [Windows Binary Packaging Strategies](#8-windows-binary-packaging-strategies)
   - [Strategy 1: Native Windows C# / .NET Installer (Zero-Dependency)](#strategy-1-native-windows-c--net-installer-zero-dependency)
   - [Strategy 2: Standalone Full-Stack Executable via Node.js SEA](#strategy-2-standalone-full-stack-executable-via-nodejs-sea)
   - [Strategy 3: Inno Setup Professional Windows Installer](#strategy-3-inno-setup-professional-windows-installer)
   - [Strategy 4: Single Executable via `pkg`](#strategy-4-single-executable-via-pkg)
9. [Local Windows Build & Run Checklist](#9-local-windows-build--run-checklist)

---

## 1. Executive System Overview

**SoroTrack** is an intelligent personal web archiving and reading feed dashboard. It captures, enriches, categorizes, and synthesizes content from web browsing sessions and social feeds (specifically 𝕏 / Twitter history and bookmarks).

### High-Level Architecture Diagram

```
+---------------------------------------------------------------------------------------+
|                                    CLIENT BROWSERS                                     |
|  (Microsoft Edge / Google Chrome / Brave / Arc / Mozilla Firefox / Vivaldi / Opera)   |
|                                                                                       |
|  +-------------------------------------+     +-------------------------------------+  |
|  |     Target Website: x.com/*        |     |      SoroTrack Web Dashboard        |  |
|  |                                     |     |      (React 19 SPA / Vite)          |  |
|  |  +-------------------------------+  |     |                                     |  |
|  |  |  content.js (DOM Scraper)     |  |     |  - Feed & Reading List               |  |
|  |  |  - Tweet extraction           |  |     |  - AI Executive Briefing            |  |
|  |  |  - In-Page HUD Overlay        |  |     |  - Category & Label Taxonomy        |  |
|  |  |  - Auto-scroll ingestion      |  |     |  - Extension Installer Modal        |  |
|  |  +---------------+---------------+  |     |  - Offline Standalone Viewer        |  |
|  +------------------|------------------+     +------------------+------------------+  |
|                     | PostMessage / Runtime                     | Fetch REST API       |
|  +------------------v------------------+                        |                      |
|  | background.js (MV3 Service Worker)  |                        |                      |
|  | - WebExtension storage & queues     |                        |                      |
|  | - Sync dispatcher with auth headers |                        |                      |
+---------------------|-------------------------------------------|---------------------+
                      | HTTP POST /api/sync                       | HTTP GET /api/records
                      +-----------------------------+-------------+
                                                    |
                                                    v
+---------------------------------------------------------------------------------------+
|                             SOROTRACK SERVER (Node.js / Express)                       |
|                                                                                       |
|  +-----------------------+   +------------------------+   +------------------------+  |
|  |     server.ts         |   |    server/ai.ts        |   |  server/installer.ts   |  |
|  |  - Express REST API   |   |  - Gemini 2.5 Flash    |   |  - Win .bat / .ps1     |  |
|  |  - Token validation   |   |  - Executive briefs    |   |  - Mac .command        |  |
|  |  - Static / Vite dist |   |  - Topic clustering    |   |  - Homebrew formula    |  |
|  +-----------+-----------+   +------------------------+   +------------------------+  |
|              |                                                                        |
|              v                                                                        |
|  +---------------------------------------------------------------------------------+  |
|  | server/storage.ts (Dual-Layer Persistence)                                      |  |
|  |   1. In-memory cache for sub-millisecond retrieval                              |  |
|  |   2. Local disk backup (data/history_records.json)                              |  |
|  |   3. Google Cloud Firestore sync (collection: history_records)                   |  |
+---------------------------------------------------------------------------------------+
```

---

## 2. Component & Layer Architecture

### Layer 1: Client Browser Extension (`/extension`)
- **Manifest V3** compliant for Chromium browsers (Edge, Chrome, Brave, Arc, Vivaldi, Opera) and Firefox.
- **`content.js`**: Injected into `x.com/*` and `twitter.com/*`. Observes tweet articles via `MutationObserver`, extracts author handles, display names, tweet text, timestamps, media URLs, external links, bookmark states, and metrics (replies, retweets, likes).
- **In-Page Floating HUD**: Offers auto-scroll, scan audit logs, sync status indicators, and one-click manual sync.
- **`background.js`**: Central extension background worker. Batches outgoing records and transmits them via authenticated HTTP POST requests to `/api/sync`.
- **`popup.html` & `popup.js`**: Quick-action extension toolbar popup showing connection status, record counts, and shortcut to the web dashboard.
- **`options.html` & `options.js`**: User configuration screen for setting backend server URL and authentication sync token.
- **`viewer.html` & `viewer.js`**: Standalone offline viewer that reads directly from extension local storage without an internet connection.

### Layer 2: Web Dashboard (`/src`)
- **Framework**: React 19, TypeScript 5.8, Tailwind CSS v4, Motion (animations), Recharts (weekly analytics).
- **Dashboard Views**:
  - **Reading Feed**: Paginated & sorted view of captured snippets (newest scanned, date, likes, reposts).
  - **Category Hubs**: Dynamic taxonomy filtering (Engineering, Design, AI, News, Business, etc.).
  - **Read Later**: Client-persisted queue for articles to read with status badges.
  - **AI Executive Briefing**: Server-generated executive briefing and topic clusters powered by Gemini.
  - **Admin Panel**: Role-based access control, sync webhook secrets, branding, and extension code inspection.
  - **Extension Drawer (`ExtensionDrawer.tsx`)**: Automated 1-click OS installer downloads, terminal scripts, Homebrew formulas, and manual unpacked zip bundles.

### Layer 3: Backend Server (`server.ts` & `/server`)
- **Framework**: Express 4 running on Node.js 20+.
- **Development**: Runs via `tsx server.ts` with Vite development middleware mounted.
- **Production**: Bundled into `dist/server.cjs` via `esbuild server.ts --bundle --platform=node --format=cjs --packages=external`. Serves pre-built static assets from `dist/`.
- **Port**: Default `3000` (configurable via `PORT` environment variable).

### Layer 4: Intelligence & AI (`server/ai.ts`)
- **Model**: `gemini-2.5-flash` via modern `@google/genai` TypeScript SDK.
- **Features**:
  - **Contextual Briefings**: Summarizes key insights and takeaways from recent reading history.
  - **Topic Clustering**: Automatically tags and clusters snippets into semantic categories.
- **Security**: The Gemini API key remains server-side only; the browser client never accesses it.

### Layer 5: Dual-Layer Persistence (`server/storage.ts` & `server/firestore.ts`)
- **Layer 5A (In-Memory)**: Live memory cache of all history records for instant searching and sorting.
- **Layer 5B (Local JSON)**: Automatic persistence to `data/history_records.json` with transactional write-locking.
- **Layer 5C (Cloud Firestore)**: Cloud persistence in Google Cloud Firestore (`history_records` collection) with automatic failover to local JSON if cloud quotas or network disconnects occur.

---

## 3. File Tree & Module Responsibilities

```
/
├── .env.example                     # Sample environment variables
├── package.json                     # NPM dependencies, scripts, build definitions
├── tsconfig.json                    # TypeScript compiler configuration
├── vite.config.ts                   # Vite configuration with React & Tailwind plugins
├── index.html                       # SPA HTML entry point
├── metadata.json                    # App metadata and capability flags
├── firestore.rules                  # Security rules for Cloud Firestore
│
├── server.ts                        # Master Express server entry point & REST API routes
│
├── server/                          # Server-side business logic
│   ├── ai.ts                        # Google Gemini AI integration (@google/genai)
│   ├── auth.ts                      # Sync token verification & user session management
│   ├── firestore.ts                 # Firebase Firestore client & silent log configuration
│   ├── installer.ts                 # Dynamic Windows/Mac/Homebrew installer generator
│   └── storage.ts                   # In-memory + local JSON + Firestore dual storage engine
│
├── data/
│   └── history_records.json         # Local persistent records storage
│
├── extension/                       # Browser extension source files
│   ├── manifest.json                # WebExtension Manifest V3 specification
│   ├── background.js                # Extension service worker (batching, sync dispatcher)
│   ├── content.js                   # DOM scraper for x.com & floating HUD
│   ├── content.css                  # HUD styling
│   ├── dashboard-bridge.js          # Cross-origin bridge between dashboard and extension
│   ├── popup.html / popup.js        # Toolbar popup UI & controller
│   ├── options.html / options.js    # Settings page (URL, auth token)
│   ├── viewer.html / viewer.js      # Offline standalone reader client
│   └── icon16.png, icon48.png, etc. # Extension icons
│
├── src/                             # React 19 Frontend Dashboard
│   ├── main.tsx                     # React root mount
│   ├── App.tsx                      # Main app shell & router
│   ├── index.css                    # Tailwind CSS entry (@import "tailwindcss";)
│   ├── types.ts                     # TypeScript shared interfaces
│   ├── components/
│   │   ├── Header.tsx               # Top navigation & extension trigger
│   │   ├── FeedList.tsx             # Snippet reader feed & cards
│   │   ├── SummaryCards.tsx         # AI Executive Briefing & Recharts graph
│   │   ├── ExtensionDrawer.tsx      # Multi-OS installer drawer (Windows, Mac, Homebrew)
│   │   ├── AdminPanel.tsx           # Management console & settings
│   │   └── ...
│   └── lib/
│       ├── extensionPackager.ts     # Client-side JSZip bundler & OS detector
│       ├── contentFilter.ts         # High-signal categorization & heuristics
│       └── firebase.ts              # Client-side Firebase SDK configuration
│
└── scripts/                         # Local Windows binary build tools (Generated)
    ├── SoroTrackInstaller.cs        # Native C# Windows installer application
    ├── build-windows-exe.bat        # 1-click zero-dependency compiler using csc.exe
    ├── sea-config.json              # Node.js Single Executable Application config
    ├── build-windows-sea.bat        # Compiles standalone SoroTrack.exe via Node SEA
    └── installer.iss                # Inno Setup wizard compiler script
```

---

## 4. Data Models & Storage Layers

### `HistoryRecord` Schema
```typescript
interface HistoryRecord {
  id: string;               // Unique post identifier (e.g. tweet ID: "1894523...")
  url: string;              // Direct URL (e.g. "https://x.com/username/status/...")
  text: string;             // Cleaned plain text content of the post
  authorName: string;       // Display name of author
  authorHandle: string;     // Handle without '@' (e.g. "shadcn")
  authorAvatar?: string;    // URL to profile avatar image
  timestamp: string;        // ISO 8601 creation timestamp
  scannedAt: string;        // ISO 8601 ingestion timestamp
  isBookmark?: boolean;     // True if captured from bookmarks feed
  likes?: number;           // Numeric like count
  retweets?: number;        // Numeric retweet / repost count
  replies?: number;         // Numeric reply count
  mediaUrls?: string[];     // Array of extracted image/video URLs
  externalLinks?: {         // Array of parsed external URLs
    url: string;            // Destination URL
    domain: string;         // Root domain (e.g. "github.com", "arxiv.org")
    title?: string;         // Extracted link card title
  }[];
  labels?: string[];        // AI or rule-assigned taxonomy tags
  readLater?: boolean;      // User read-later flag
  recycled?: boolean;       // Soft-deleted flag
}
```

---

## 5. API Endpoint Specifications

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `POST` | `/api/sync` | Ingest records from extension. Accepts single record or `{ items: [] }` | `Bearer <token>` or `x-api-key` |
| `GET` | `/api/records` | Retrieve all active records with optional category & search filter | None (read-only) |
| `DELETE` | `/api/records/:id` | Permanently delete a record | Admin / Auth |
| `POST` | `/api/records/purge` | Purge recycled records | Admin / Auth |
| `GET` | `/api/auth/token` | Retrieve current sync token for extension auto-pairing | Session |
| `POST` | `/api/ai/briefing` | Generate AI executive summary of reading history | Session |
| `POST` | `/api/ai/cluster` | Run semantic topic clustering across records | Session |
| `GET` | `/api/extension/download` | Download browser unpacked zip (`?browser=edge\|chrome\|firefox`) | None |
| `GET` | `/api/extension/installer` | Download 1-click OS bundle (`?os=windows\|mac`) | None |
| `GET` | `/api/extension/installer/script` | Download standalone runner script (`?os=windows&format=bat\|ps1`) | None |
| `GET` | `/api/extension/brew/sorotrack.rb` | Live Homebrew Formula with verified SHA-256 | None |
| `GET` | `/api/export/json` | Download full database as JSON backup | None |
| `POST` | `/api/import/json` | Upload JSON backup with duplicate prevention | Admin |

---

## 6. Browser Extension Architecture (MV3)

### How Extension Auto-Configuration Works:
1. When downloading the extension installer from the SoroTrack web app, the backend generates an archive containing `extension/manifest.json`, `background.js`, `content.js`, etc.
2. The server dynamically injects:
   - The current **Host Origin** (e.g., `http://localhost:3000` or production domain) into `background.js` and `manifest.json host_permissions`.
   - The **Sync Auth Token** into `background.js` and `options.html`.
3. When the extension runs on `x.com`, `content.js` monitors tweets and sends them to `background.js`.
4. `background.js` dispatches an HTTP POST request to `/api/sync` with header:
   ```http
   Authorization: Bearer sh_live_xxxxxxxxxxxxxxxxxxxxxxxx
   Content-Type: application/json
   ```

---

## 7. Authentication & Security Model

- **Sync Webhook Protection**: All ingestion requests to `/api/sync` require token validation. Tokens are stored in server memory and backed by `data/auth_config.json`.
- **API Key Proxy**: All Google Gemini API calls are strictly handled server-side (`server/ai.ts`). The frontend never receives or leaks the `GEMINI_API_KEY`.
- **CORS & Host Whitelisting**: The server accepts requests from extension protocols (`chrome-extension://`, `moz-extension://`) and localhost.

---

## 8. Windows Binary Packaging Strategies

You can compile and distribute SoroTrack on Windows using **four distinct strategies** depending on whether you want an **extension installer binary** or a **full standalone desktop server binary**.

---

### Strategy 1: Native Windows C# / .NET Installer (Zero-Dependency)

> **Best For**: Creating a standalone `SoroTrackInstaller.exe` that users double-click to install the extension across Edge, Chrome, Brave, Arc, and Firefox.  
> **Advantage**: Requires **ZERO third-party downloads**! Every Windows 10/11 installation includes the Microsoft .NET C# compiler (`csc.exe`) out of the box.

#### How It Works:
1. `scripts/SoroTrackInstaller.cs` is written in standard C#.
2. The compiler script `scripts/build-windows-exe.bat` locates the pre-installed Windows `csc.exe` in:
   `C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe`
3. It compiles the source file into a native Windows executable: `SoroTrackInstaller.exe`.
4. When executed on any Windows machine:
   - Creates directory `%LOCALAPPDATA%\SoroTrack\extension`.
   - Copies or extracts all extension files.
   - Scans the Windows Registry and Program Files for:
     - Microsoft Edge (`msedge.exe`)
     - Google Chrome (`chrome.exe`)
     - Brave Browser (`brave.exe`)
     - Arc Browser (`Arc.exe`)
     - Mozilla Firefox (`firefox.exe`)
     - Vivaldi (`vivaldi.exe`)
     - Opera (`launcher.exe`)
   - Copies the permanent path to the Windows Clipboard (`Ctrl+V` ready).
   - Creates a Desktop shortcut `Launch SoroTrack Browser.lnk`.
   - Launches the primary browser with `--load-extension="%LOCALAPPDATA%\SoroTrack\extension"`.

#### Build Command (Run on Windows):
```cmd
cd scripts
build-windows-exe.bat
```
Output: `SoroTrackInstaller.exe` (~100 KB native Windows binary).

---

### Strategy 2: Standalone Full-Stack Executable via Node.js SEA

> **Best For**: Packaging the entire SoroTrack web server + React dashboard into a single `SoroTrack.exe` that runs without requiring Node.js to be installed on the user's PC.  
> **Advantage**: Uses Node.js 20+ built-in **Single Executable Applications (SEA)** technology.

#### How It Works:
1. Compile the web assets and server bundle:
   ```cmd
   npm run build
   ```
   (Generates `dist/index.html`, `dist/assets/`, and `dist/server.cjs`).
2. Generate the SEA preparation blob using `scripts/sea-config.json`:
   ```cmd
   node --experimental-sea-config scripts/sea-config.json
   ```
   (Produces `dist/sea-prep.blob`).
3. Copy the system `node.exe` to `SoroTrack.exe`:
   ```cmd
   copy "%ProgramFiles%\nodejs\node.exe" dist\SoroTrack.exe
   ```
4. Remove the default signature and inject the blob using `postject`:
   ```cmd
   npx postject dist\SoroTrack.exe NODE_SEA_BLOB dist\sea-prep.blob --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2
   ```
5. `dist\SoroTrack.exe` is now a self-contained executable. Double-clicking it boots the Express server and opens `http://localhost:3000` automatically.

---

### Strategy 3: Inno Setup Professional Windows Installer

> **Best For**: Distributing a polished setup wizard (`SoroTrack-Setup-v1.1.0.exe`) with License Agreement, Start Menu icons, Desktop shortcuts, and an uninstaller.

1. Download the free [Inno Setup 6](https://jrsoftware.org/isdl.php).
2. Open `scripts/installer.iss` in Inno Setup Compiler.
3. Click **Build > Compile**.
4. Result: `Output\SoroTrack-Setup-v1.1.0.exe`.

---

### Strategy 4: Single Executable via `pkg`

> **Best For**: Quick 1-step packaging of the bundled Node.js server.

1. Build the production server bundle:
   ```cmd
   npm run build
   ```
2. Run `@yao-pkg/pkg`:
   ```cmd
   npx @yao-pkg/pkg dist/server.cjs --target node20-win-x64 --output dist/SoroTrack-Server.exe
   ```
3. Run `dist\SoroTrack-Server.exe`.

---

## 9. Local Windows Build & Run Checklist

### Step 1: Clone & Setup
```cmd
git clone <your-repo-url>
cd sorotrack
npm install
```

### Step 2: Configure Environment
Copy `.env.example` to `.env`:
```cmd
copy .env.example .env
```
Add your optional `GEMINI_API_KEY`:
```env
GEMINI_API_KEY=AIzaSy...
PORT=3000
```

### Step 3: Run Full-Stack Development Mode
```cmd
npm run dev
```
Open `http://localhost:3000`.

### Step 4: Build Native Windows Binaries
To build the **Native Extension Installer Binary**:
```cmd
cd scripts
build-windows-exe.bat
```
To build the **Standalone Server Executable**:
```cmd
npm run build
scripts\build-windows-sea.bat
```
