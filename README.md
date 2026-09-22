# SoroTrack

**SoroTrack** is an intelligent personal browsing archive and reading list dashboard designed to capture, organize, analyze, and synthesize content from your web reading and social feeds (such as 𝕏 / Twitter history and bookmarks). 

Equipped with cross-browser extensions (Microsoft Edge, Google Chrome, Mozilla Firefox), local and cloud-backed persistence via Google Cloud Firestore, automatic domain and link extraction, customizable content labels, and server-side Gemini AI intelligence, SoroTrack transforms ephemeral browsing into a structured, searchable, high-signal knowledge base.

---

## 🌟 Key Features

### 1. Cross-Browser Ingestion & Extension
- **Multi-Browser Support**: Dedicated builds for **Microsoft Edge**, **Google Chrome**, and **Mozilla Firefox**.
- **Pre-Configured Packages**: Downloadable 1-click `.zip` packages automatically bundled with your live backend URL and authentication token.
- **Floating In-Page HUD**: On-page controls for automatic scrolling, audit history, anonymous mode, and local JSON inspection.
- **Authenticated Sync Pipeline**: Direct ingestion through `/api/sync` secured via token authentication (`Bearer` or `x-api-key`).

### 2. High-Signal Content Filtering & Labels
- **Noise Suppression**: Filter out noise (memes, ragebait, pitches, polemics) to focus on high-signal technical and educational content.
- **Dynamic Category Management**: Admin-configurable taxonomy with full CRUD capabilities (create, rename, recolor, delete) for content labels.
- **Extracted Reference Domains**: Automatically parses and groups linked sources (e.g., `github.com`, `arxiv.org`, `youtube.com`, `substack.com`).

### 3. Topic Clustering & AI Synthesis
- **Intelligent Clustering**: Automatically groups related snippets into semantic topics and thematic clusters.
- **AI Executive Briefing**: Powered by Google Gemini (`@google/genai`) on the server side to produce contextual briefings, trends analysis, and key takeaways on demand.
- **Dedicated Category Hubs**: Deep-dive views with sub-topic exploration, read/caught-up tracking, and classification guidelines.

### 4. Feed, Reading List & Analytics
- **Read Later List**: Save snippets with a single click to a persistent 'to-read' list (persisted in `localStorage`), with dedicated filtered views and quick count indicators.
- **Weekly Ingestion Activity**: Interactive Recharts visualization depicting snippet collection volume per day over the last 7 days, located directly in the Summary & Trends section.
- **Clean Dashboard & Recycle Bin**: Quickly tidy your feed when filtering by authors, domains, or labels. Select all or pick individual snippets to send to the Recycled Bin, with options to restore or permanently purge.
- **Streamlined Sorting**: Defaulted to "Newest scanned" for chronological ingestion order, with curated options: *Latest by Date*, *Oldest by Date*, *Newest scanned*, *Most likes*, and *Most reposts*.
- **Quick Toggles**: Filter instantly by media presence (images/video), external reference links, or Read Later items.
- **Keyboard Shortcuts**: Press `/` to focus instant full-text search across tweet content, author handles, and link titles.
- **Reading Comfort**: Multiple reader font size presets (`sm`, `md`, `lg`) and responsive view modes (compact vs. card grid).

### 5. Resilient Cloud & Offline Architecture
- **Dual-Layer Persistence**: Real-time cloud sync with Google Cloud Firestore, backed by local disk safeguarding if cloud quotas are reached.
- **Data Portability**: Full JSON export (`/api/export/json`) and drag-and-drop JSON import for offline backups and migration.
- **Role-Based Admin Panel**: Manage user accounts, customize site branding, configure ingestion webhooks, and inspect extension source code directly in the browser.

---

## 🏗️ Technology Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 19, TypeScript, Tailwind CSS v4, Motion, Lucide Icons |
| **Backend / Server** | Node.js, Express, tsx, esbuild |
| **Database & Cloud** | Google Cloud Firestore, Firebase Authentication |
| **AI & LLM** | Google Gemini API via `@google/genai` (Server-Side Proxy) |
| **Extensions** | WebExtensions API (Manifest V3 for Edge & Chrome, Manifest V2/V3 for Firefox) |

---

## 🚀 Getting Started

### Prerequisites
- Node.js 20+ installed
- npm or yarn

### Installation
1. Clone the repository or open the project directory:
   ```bash
   cd sorotrack
   ```
2. Install dependencies:
   ```bash
   npm install
   ```

### Environment Variables
Configure your environment variables in `.env` (refer to `.env.example`):
```env
# Google Gemini AI Key for server-side summarization
GEMINI_API_KEY=your_gemini_api_key_here

# Optional: Custom Sync Secret Token (generated automatically if omitted)
SORO_SYNC_TOKEN=your_secure_sync_token
```

### Running Locally
Start the unified full-stack development server (Express backend + Vite frontend):
```bash
npm run dev
```
The application will be accessible at: `http://localhost:3000`.

### Production Build
Compile both the client-side SPA bundle and the bundled Node CommonJS server:
```bash
npm run build
npm run start
```

---

## 🧩 Installing the Browser Extension

1. Open SoroTrack at `http://localhost:3000` (or your deployed URL).
2. Click the **Extension** button in the header (or navigate to **Admin Panel > Cloud Pipeline**).
3. Select your browser:
   - **Microsoft Edge**: Download `sorotrack-edge.zip` → Open `edge://extensions` → Enable **Developer mode** → Click **Load unpacked**.
   - **Google Chrome / Brave**: Download `sorotrack-chrome.zip` → Open `chrome://extensions` → Enable **Developer mode** → Click **Load unpacked**.
   - **Mozilla Firefox**: Download `sorotrack-firefox.zip` → Open `about:debugging#/runtime/this-firefox` → Click **Load Temporary Add-on...** and select `manifest.json`.
4. Navigate to `https://x.com/i/history` or your bookmarks. The floating SoroTrack HUD will appear to sync your reading history directly to your archive.

---

## 🔒 Security & Privacy

- **Server-Side API Keys**: The Gemini API key is never exposed to the client or browser. All LLM operations run via authenticated `/api/ai/*` server endpoints.
- **Protected Remote Ingestion**: The `/api/sync` webhook strictly verifies tokens via `Authorization: Bearer <token>` or `x-api-key` headers.
- **Private Archiving**: SoroTrack stores your history exclusively in your provisioned Firestore database or secure local cache without third-party tracking.
