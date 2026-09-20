SoroTrack is an intelligent personal browsing archive and reading list dashboard designed to capture, organize, analyze, and synthesize content from your web reading and social feeds (such as 𝕏 / Twitter history and bookmarks).
Equipped with cross-browser extensions (Microsoft Edge, Google Chrome, Mozilla Firefox), local and cloud-backed persistence via Google Cloud Firestore, automatic domain and link extraction, customizable content labels, and server-side Gemini AI intelligence, SoroTrack transforms ephemeral browsing into a structured, searchable, high-signal knowledge base.

🌟 Key Features

1. Cross-Browser Ingestion & Extension
Multi-Browser Support: Dedicated builds for Microsoft Edge, Google Chrome, and Mozilla Firefox.
Pre-Configured Packages: Downloadable 1-click .zip packages automatically bundled with your live backend URL and authentication token.
Floating In-Page HUD: On-page controls for automatic scrolling, audit history, anonymous mode, and local JSON inspection.
Authenticated Sync Pipeline: Direct ingestion through /api/sync secured via token authentication (Bearer or x-api-key).

2. High-Signal Content Filtering & Labels
Noise Suppression: Filter out noise (memes, ragebait, pitches, polemics) to focus on high-signal technical and educational content.
Dynamic Category Management: Admin-configurable taxonomy with full CRUD capabilities (create, rename, recolor, delete) for content labels.
Extracted Reference Domains: Automatically parses and groups linked sources (e.g., github.com, arxiv.org, youtube.com, substack.com).

3. Topic Clustering & AI Synthesis
Intelligent Clustering: Automatically groups related snippets into semantic topics and thematic clusters.
AI Executive Briefing: Powered by Google Gemini (@google/genai) on the server side to produce contextual briefings, trends analysis, and key takeaways on demand.
Dedicated Category Hubs: Deep-dive views with sub-topic exploration, read/caught-up tracking, and classification guidelines.

4. Feed & Discovery Experience
Granular Sorting: Sort by publication date, synchronization date, scan sequence, likes, or repost counts.
Quick Toggles: Filter instantly by media presence (images/video) or external reference links.
Keyboard Shortcuts: Press / to focus instant full-text search across tweet content, author handles, and link titles.
Reading Comfort: Multiple reader font size presets (sm, md, lg) and responsive view modes (compact vs. card grid).

5. Resilient Cloud & Offline Architecture
Dual-Layer Persistence: Real-time cloud sync with Google Cloud Firestore, backed by local disk safeguarding if cloud quotas are reached.
Data Portability: Full JSON export (/api/export/json) and drag-and-drop JSON import for offline backups and migration.
Role-Based Admin Panel: Manage user accounts, customize site branding, configure ingestion webhooks, and inspect extension source code directly in the browser.
