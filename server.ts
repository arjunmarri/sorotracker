import express from 'express';
import path from 'path';
import fs from 'fs';
import JSZip from 'jszip';
import { createServer as createViteServer } from 'vite';
import { SortOption } from './src/types';
import { 
  getAllRecords, 
  saveRecords, 
  deleteRecord, 
  deleteMultipleRecords,
  recycleRecords,
  restoreRecords,
  getRecycledRecords,
  emptyRecycleBin,
  clearAllRecords, 
  initStorage, 
  getStorageStatus,
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  syncAuthUser,
  getSiteSettings,
  updateSiteSettings,
  getTopContent,
  saveTopContent,
  addTopContentItems,
  clearTopContent,
  getAgentStatus,
  updateAgentStatus
} from './server/storage';
import { 
  getOrGenerateSummary, 
  askArchiveQuestion, 
  generateFallbackSummary, 
  invalidateSummaryCache,
  runTrendingAgent,
  generateFallbackTopContent
} from './server/ai';
import { getSyncAuthToken, requireSyncAuth, validateSyncAuthToken } from './server/auth';

const app = express();
const PORT = 3000;

// Initialize storage & GCP Firestore connection
initStorage().catch(err => console.warn('[Storage] Init notice:', err?.message || err));

// Enable CORS for browser extension and local tools
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, x-api-key, x-sync-token, x-anon-mode');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json({ limit: '10mb' }));

// Anon-mode state: when enabled, no snippets are saved or stored
let serverAnonMode = false;

app.get('/api/anon-mode', (req, res) => {
  res.json({ anonMode: serverAnonMode });
});

app.post('/api/anon-mode', (req, res) => {
  serverAnonMode = Boolean(req.body?.enabled);
  res.json({ success: true, anonMode: serverAnonMode });
});

// Clear session snippets endpoint
app.post('/api/session/clear', async (req, res) => {
  try {
    const { recordIds } = req.body;
    let clearedCount = 0;
    if (Array.isArray(recordIds) && recordIds.length > 0) {
      clearedCount = await deleteMultipleRecords(recordIds);
    }
    invalidateSummaryCache();
    res.json({ success: true, clearedCount, totalRemaining: getAllRecords().length });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to clear session records' });
  }
});

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'SoroTrack Middleware', time: new Date().toISOString() });
});

// Authentication Token & Verification
app.get('/api/auth/token', (req, res) => {
  try {
    const token = getSyncAuthToken();
    res.json({ token, active: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/verify', (req, res) => {
  const token = req.body?.token || req.headers.authorization || req.headers['x-api-key'];
  const isValid = validateSyncAuthToken(typeof token === 'string' ? token : undefined);
  res.json({ valid: isValid, status: isValid ? 'authenticated' : 'unauthorized' });
});

// Sync authenticated user (Google Social Login or Email)
app.post('/api/auth/sync-user', (req, res) => {
  try {
    const user = syncAuthUser(req.body);
    res.json(user);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to sync user' });
  }
});

// User Management (Admin Panel)
app.get('/api/users', (req, res) => {
  try {
    const users = getAllUsers();
    res.json(users);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch users' });
  }
});

app.post('/api/users', (req, res) => {
  try {
    const newUser = createUser(req.body);
    res.status(201).json(newUser);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to create user' });
  }
});

app.put('/api/users/:id', (req, res) => {
  try {
    const updated = updateUser(req.params.id, req.body);
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to update user' });
  }
});

app.delete('/api/users/:id', (req, res) => {
  try {
    const deleted = deleteUser(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ success: true, message: 'User successfully deleted' });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to delete user' });
  }
});

// Website Settings & Theme Management
app.get('/api/settings', (req, res) => {
  try {
    const settings = getSiteSettings();
    res.json(settings);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch settings' });
  }
});

const handleUpdateSettings = (req: express.Request, res: express.Response) => {
  try {
    const updated = updateSiteSettings(req.body, req.body?.updatedBy);
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to update settings' });
  }
};

app.put('/api/settings', handleUpdateSettings);
app.post('/api/settings', handleUpdateSettings);

// Sync records from browser extension middleware with remote authentication
app.post('/api/sync', requireSyncAuth, async (req, res) => {
  try {
    const { records } = req.body;
    if (!records || !Array.isArray(records)) {
      return res.status(400).json({ error: 'Payload must include an array of records.' });
    }

    if (serverAnonMode || req.headers['x-anon-mode'] === 'true') {
      return res.json({
        success: true,
        added: 0,
        total: getAllRecords().length,
        anonMode: true,
        message: 'Anon Mode is active: incoming snippets were not saved or stored.'
      });
    }

    const result = await saveRecords(records);
    invalidateSummaryCache();
    res.json({
      success: true,
      added: result.added,
      total: result.total,
      gcpSaved: result.gcpSaved,
      isQuotaExhausted: result.isQuotaExhausted,
      quotaNotice: result.quotaNotice,
      collection: 'history_records',
      message: result.isQuotaExhausted
        ? `Successfully saved ${records.length} records to local cache (Cloud write quota reached).`
        : `Successfully processed ${records.length} incoming records into GCP collection.`
    });
  } catch (err: any) {
    console.warn('[API /api/sync notice]', err?.message || err);
    res.status(500).json({ error: err.message || 'Failed to save records' });
  }
});

// Storage and GCP Firestore connection status
app.get('/api/storage/status', (req, res) => {
  try {
    const status = getStorageStatus();
    res.json(status);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Full JSON export of archived records
app.get('/api/export/json', (req, res) => {
  try {
    const records = getAllRecords();
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="sorotrack_archive.json"');
    res.send(JSON.stringify(records, null, 2));
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to export records' });
  }
});

// Direct JSON import of records with duplicate checking & organizing
app.post('/api/import/json', async (req, res) => {
  try {
    let incoming = req.body.records || req.body;
    if (!Array.isArray(incoming)) {
      if (incoming && typeof incoming === 'object') {
        if (Array.isArray(incoming.records)) incoming = incoming.records;
        else if (Array.isArray(incoming.bookmarks)) incoming = incoming.bookmarks;
        else if (Array.isArray(incoming.tweets)) incoming = incoming.tweets;
        else if (Array.isArray(incoming.items)) incoming = incoming.items;
        else incoming = [incoming];
      } else {
        return res.status(400).json({ error: 'Payload must be a JSON array or an object containing records/bookmarks.' });
      }
    }

    if (serverAnonMode || req.headers['x-anon-mode'] === 'true') {
      return res.json({
        success: true,
        totalInFile: incoming.length,
        duplicateCount: 0,
        newCount: 0,
        added: 0,
        anonMode: true,
        message: 'Anon Mode is active: imported snippets were not saved or stored.'
      });
    }

    const existingRecords = getAllRecords();
    const existingIds = new Set(existingRecords.map(r => r.id));
    const existingUrls = new Set<string>();
    existingRecords.forEach(r => {
      if (r.tweetUrl) {
        const norm = r.tweetUrl.toLowerCase().replace(/\/photo\/\d+/, '').replace(/\/analytics/, '').replace(/\/+$/, '');
        existingUrls.add(norm);
      }
    });

    const duplicates: any[] = [];
    const uniqueRecords: any[] = [];

    incoming.forEach((item: any) => {
      if (!item || typeof item !== 'object') return;
      const raw = item.tweet ? item.tweet : item;
      let id = raw.id || raw.id_str || raw.tweetId || raw.tweet_id;
      let url = raw.tweetUrl || raw.url || '';
      if (!id && url) {
        const m = url.match(/status\/(\d+)/);
        if (m) id = m[1];
      }
      if (!id) {
        const seed = (raw.text || raw.full_text || raw.title || '') + (raw.createdAt || raw.created_at || '');
        if (!seed.trim()) return;
        let hash = 0;
        for (let i = 0; i < seed.length; i++) {
          hash = (hash << 5) - hash + seed.charCodeAt(i);
          hash |= 0;
        }
        id = 'imp_' + Math.abs(hash).toString(36);
      }
      id = String(id);

      const normUrl = url ? url.toLowerCase().replace(/\/photo\/\d+/, '').replace(/\/analytics/, '').replace(/\/+$/, '') : '';
      const isDuplicate = existingIds.has(id) || (normUrl && existingUrls.has(normUrl));

      if (isDuplicate) {
        duplicates.push({
          id,
          tweetUrl: url,
          authorHandle: raw.authorHandle || (raw.user?.screen_name ? `@${raw.user.screen_name}` : ''),
          text: (raw.text || raw.full_text || '').slice(0, 100)
        });
      } else {
        uniqueRecords.push(raw);
        existingIds.add(id);
        if (normUrl) existingUrls.add(normUrl);
      }
    });

    let saveResult = { added: 0, total: existingRecords.length, gcpSaved: 0, isQuotaExhausted: false, quotaNotice: null as string | null };
    if (uniqueRecords.length > 0) {
      saveResult = await saveRecords(uniqueRecords);
      invalidateSummaryCache();
    }

    res.json({
      success: true,
      totalInFile: incoming.length,
      duplicateCount: duplicates.length,
      newCount: uniqueRecords.length,
      added: saveResult.added,
      totalArchived: saveResult.total,
      duplicates: duplicates.slice(0, 20),
      isQuotaExhausted: saveResult.isQuotaExhausted,
      message: duplicates.length === 0
        ? `Successfully imported and organized ${uniqueRecords.length} records.`
        : uniqueRecords.length > 0
          ? `Imported and organized ${uniqueRecords.length} new records (${duplicates.length} duplicate records skipped).`
          : `All ${duplicates.length} records in file already exist in SoroTrack. 0 duplicates added.`
    });
  } catch (err: any) {
    console.warn('[API /api/import/json notice]', err?.message || err);
    res.status(500).json({ error: err.message || 'Failed to import records' });
  }
});

// ==========================================
// Autonomous SoroTrack Agent & Top Content API
// ==========================================

// Get Top Content and Agent status
app.get('/api/agent/top-content', async (req, res) => {
  try {
    let items = getTopContent();
    const status = getAgentStatus();

    // If no items exist, seed with high-signal real-time fallback top content
    if (items.length === 0) {
      const fallback = generateFallbackTopContent();
      items = saveTopContent(fallback);
      updateAgentStatus({
        lastRunAt: new Date().toISOString(),
        lastRunStatus: 'success',
        totalItemsFound: items.length,
        message: 'Initialized with live trending topics from X'
      });
    }

    res.json({ items, status: getAgentStatus() });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch top content' });
  }
});

// Get Agent Status
app.get('/api/agent/status', (req, res) => {
  try {
    res.json(getAgentStatus());
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch agent status' });
  }
});

// Run SoroTrack Autonomous Agent
app.post('/api/agent/run', async (req, res) => {
  try {
    updateAgentStatus({ isRunning: true, message: 'Autonomous agent scanning 𝕏 in background...' });
    
    const forceRefresh = Boolean(req.body?.forceRefresh);
    const mode = req.body?.mode === 'extension' ? 'extension' : 'cloud';

    const result = await runTrendingAgent(forceRefresh);
    const saved = saveTopContent(result.items);

    const updatedStatus = updateAgentStatus({
      isRunning: false,
      lastRunAt: new Date().toISOString(),
      lastRunStatus: 'success',
      totalItemsFound: saved.length,
      mode,
      message: `Autonomous agent successfully gathered ${saved.length} trending discussions from 𝕏`
    });

    res.json({
      success: true,
      items: saved,
      status: updatedStatus,
      source: result.source,
      message: updatedStatus.message
    });
  } catch (err: any) {
    updateAgentStatus({
      isRunning: false,
      lastRunStatus: 'failed',
      message: err.message || 'Agent encountered an error while scanning 𝕏'
    });
    res.status(500).json({ error: err.message || 'Failed to run autonomous agent' });
  }
});

// Ingest trending items pushed by Chrome Extension Autonomous Agent
app.post('/api/agent/top-content', (req, res) => {
  try {
    const { items, mode } = req.body;
    if (Array.isArray(items) && items.length > 0) {
      const updated = addTopContentItems(items);
      updateAgentStatus({
        isRunning: false,
        lastRunAt: new Date().toISOString(),
        lastRunStatus: 'success',
        totalItemsFound: updated.length,
        mode: mode || 'extension',
        message: `Chrome extension agent delivered ${items.length} trending items from 𝕏`
      });
      res.json({ success: true, count: updated.length, items: updated });
    } else {
      res.status(400).json({ error: 'No valid trending items provided' });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to ingest agent items' });
  }
});

// 1-Click Save Top Content item to user's personal SoroTrack Timeline
app.post('/api/agent/save-to-timeline', async (req, res) => {
  try {
    const item = req.body?.item;
    if (!item || !item.topic) {
      return res.status(400).json({ error: 'Invalid top content item' });
    }

    const now = new Date().toISOString();
    const record: any = {
      id: `agent_saved_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      tweetUrl: item.externalUrl || `https://x.com/search?q=${encodeURIComponent(item.topic)}`,
      authorName: item.authorName || 'Trending on 𝕏',
      authorHandle: item.authorHandle || `@${item.topic.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase()}`,
      authorAvatarUrl: item.authorAvatarUrl || '',
      isVerified: Boolean(item.isVerified),
      text: `${item.viralSnippet || item.summary}\n\n[Trending on 𝕏: ${item.topic} • ${item.volume || 'Viral'}]`,
      createdAt: item.collectedAt || now,
      scannedAt: now,
      syncedAt: now,
      links: [
        {
          url: item.externalUrl || `https://x.com/search?q=${encodeURIComponent(item.topic)}`,
          displayUrl: `x.com/search?q=${item.topic}`,
          domain: 'x.com',
          title: `${item.topic} - Trending on 𝕏`
        }
      ],
      media: [],
      metrics: item.metrics || {},
      tags: Array.isArray(item.tags) ? item.tags : [item.category, 'Trending'],
      labels: ['news_announcements'],
      sourcePage: 'https://x.com/i/history',
      isBookmarked: true,
      bookmarkedAt: now
    };

    const saveResult = await saveRecords([record]);
    invalidateSummaryCache();

    res.json({
      success: true,
      record,
      totalArchived: saveResult.total,
      message: `"${item.topic}" saved to your permanent SoroTrack archive!`
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to save trending item to timeline' });
  }
});

// Clear Top Content
app.delete('/api/agent/top-content', (req, res) => {
  try {
    clearTopContent();
    updateAgentStatus({ totalItemsFound: 0, message: 'Top content cleared' });
    res.json({ success: true, message: 'Cleared top content items' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to clear top content' });
  }
});

// Get archived records with search & filtering
app.get('/api/records', (req, res) => {
  try {
    const query = req.query.q as string | undefined;
    const domain = req.query.domain as string | undefined;
    const author = req.query.author as string | undefined;
    const tag = req.query.tag as string | undefined;
    const topic = req.query.topic as string | undefined;
    const keywords = req.query.keywords ? (req.query.keywords as string).split(',') : undefined;
    const sort = req.query.sort as SortOption | undefined;
    const hasLinks = req.query.hasLinks === 'true' ? true : undefined;
    const hasMedia = req.query.hasMedia === 'true' ? true : undefined;

    const records = getAllRecords({
      query,
      domain,
      author,
      tag,
      topic,
      keywords,
      sort,
      hasLinks,
      hasMedia
    });

    // Compute meta stats
    const allRecords = getAllRecords();
    const domainCounts: Record<string, number> = {};
    const authorCounts: Record<string, number> = {};
    let totalLinks = 0;

    allRecords.forEach(r => {
      if (r.authorHandle) {
        authorCounts[r.authorHandle] = (authorCounts[r.authorHandle] || 0) + 1;
      }
      (r.links || []).forEach(l => {
        totalLinks++;
        if (l.domain) {
          domainCounts[l.domain] = (domainCounts[l.domain] || 0) + 1;
        }
      });
    });

    res.json({
      records,
      stats: {
        totalArchived: allRecords.length,
        filteredCount: records.length,
        totalLinks,
        topDomains: Object.entries(domainCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10),
        topAuthors: Object.entries(authorCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to retrieve records' });
  }
});

// Delete a single record
app.delete('/api/records/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const ok = await deleteRecord(id);
    invalidateSummaryCache();
    res.json({ success: ok, id });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to delete record' });
  }
});

// Clear all records
app.delete('/api/records', async (req, res) => {
  try {
    await clearAllRecords();
    invalidateSummaryCache();
    res.json({ success: true, message: 'All archive records cleared from memory and GCP collection.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to clear records' });
  }
});

// Send records to recycled bin
app.post('/api/records/recycle', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Array of record IDs required' });
    }
    const count = await recycleRecords(ids);
    invalidateSummaryCache();
    res.json({ success: true, count, ids });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to send records to recycled bin' });
  }
});

// Restore records from recycled bin
app.post('/api/records/restore', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Array of record IDs required' });
    }
    const count = await restoreRecords(ids);
    invalidateSummaryCache();
    res.json({ success: true, count, ids });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to restore records' });
  }
});

// Get recycled records
app.get('/api/records/recycled', (req, res) => {
  try {
    const records = getRecycledRecords();
    res.json({ records, count: records.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to retrieve recycled records' });
  }
});

// Empty recycled bin (permanent delete)
app.delete('/api/records/recycled', async (req, res) => {
  try {
    const count = await emptyRecycleBin();
    invalidateSummaryCache();
    res.json({ success: true, count, message: `Permanently deleted ${count} recycled record(s)` });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to empty recycled bin' });
  }
});

// AI Summarization (supports both GET and POST with optional force refresh)
const handleSummarizeRequest = async (req: express.Request, res: express.Response) => {
  res.setHeader('Content-Type', 'application/json');
  try {
    const force = req.query.force === 'true' || req.body?.force === true;
    const records = getAllRecords();
    const summary = await getOrGenerateSummary(records, force);
    res.json(summary);
  } catch (err: any) {
    console.warn('[API /api/summarize notice]', err?.message || err);
    const records = getAllRecords();
    res.json(generateFallbackSummary(records));
  }
};

app.get('/api/summarize', handleSummarizeRequest);
app.post('/api/summarize', handleSummarizeRequest);
app.get('/api/summary', handleSummarizeRequest);
app.post('/api/summary', handleSummarizeRequest);

// AI Q&A over the archive
app.post('/api/ai/ask', async (req, res) => {
  try {
    const { question } = req.body;
    if (!question || typeof question !== 'string') {
      return res.status(400).json({ error: 'Question string is required' });
    }
    const records = getAllRecords();
    const answer = await askArchiveQuestion(question, records);
    res.json({ question, answer });
  } catch (err: any) {
    console.warn('[API /api/ai/ask notice]', err?.message || err);
    res.json({ 
      question: req.body?.question || '', 
      answer: 'Gemini service is currently under peak demand. Please try asking again in a few moments.' 
    });
  }
});

// Get Extension Files for code viewer & client-side packaging
app.get('/api/extension/files', (req, res) => {
  try {
    const extensionDir = path.join(process.cwd(), 'extension');
    const fileNames = [
      'manifest.json',
      'content.js',
      'content.css',
      'background.js',
      'popup.html',
      'popup.js',
      'options.html',
      'options.js',
      'viewer.html',
      'viewer.js',
      'viewer.css',
      'README.md'
    ];

    const files: Record<string, string> = {};
    fileNames.forEach(name => {
      const filePath = path.join(extensionDir, name);
      if (fs.existsSync(filePath)) {
        files[name] = fs.readFileSync(filePath, 'utf-8');
      }
    });

    // Base64 encode icons
    const icons = ['icon16.png', 'icon48.png', 'icon128.png'];
    const binaryFiles: Record<string, string> = {};
    icons.forEach(name => {
      const iconPath = path.join(extensionDir, name);
      if (fs.existsSync(iconPath)) {
        binaryFiles[name] = fs.readFileSync(iconPath).toString('base64');
      }
    });

    res.json({ files, binaryFiles, authToken: getSyncAuthToken() });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to read extension files' });
  }
});

// Direct Extension Zip Download Route (supports ?browser=edge, ?browser=chrome, ?browser=firefox)
app.get('/api/extension/download', async (req, res) => {
  try {
    const targetBrowser = (req.query.browser as string)?.toLowerCase() || 'edge';
    const extensionDir = path.join(process.cwd(), 'extension');
    const authToken = getSyncAuthToken();
    const appOrigin = `${req.protocol}://${req.get('host')}`;

    const fileNames = [
      'manifest.json',
      'content.js',
      'content.css',
      'background.js',
      'popup.html',
      'popup.js',
      'options.html',
      'options.js',
      'viewer.html',
      'viewer.js',
      'viewer.css',
      'README.md'
    ];

    const zip = new JSZip();

    for (const name of fileNames) {
      const filePath = path.join(extensionDir, name);
      if (!fs.existsSync(filePath)) continue;

      let content = fs.readFileSync(filePath, 'utf-8');

      // Inject app origin into extension configs
      if (appOrigin && !appOrigin.includes('localhost:3000')) {
        content = content.replace(/http:\/\/localhost:3000/g, appOrigin);
      }

      // Inject authentication token
      if (authToken) {
        if (name === 'content.js' || name === 'background.js') {
          content = content.replace(/authToken:\s*['"][^'"]*['"]/g, `authToken: '${authToken}'`);
        }
        if (name === 'popup.html') {
          content = content.replace(
            /id="auth-token"\s*placeholder="sh_live_\.\.\."/g,
            `id="auth-token" value="${authToken}" placeholder="sh_live_..."`
          );
        }
        if (name === 'options.html') {
          content = content.replace(
            /id="authToken"\s*placeholder="sh_live_\.\.\."/g,
            `id="authToken" value="${authToken}" placeholder="sh_live_..."`
          );
        }
        if (name === 'options.js' || name === 'popup.js') {
          content = content.replace(/stored\?\.authToken\s*\|\|\s*''/g, `stored?.authToken || '${authToken}'`);
        }
      }

      // Customize manifest for Edge, Chrome, or Firefox
      if (name === 'manifest.json') {
        try {
          const manifest = JSON.parse(content);
          if (targetBrowser === 'edge' || targetBrowser === 'chrome') {
            manifest.background = {
              service_worker: 'background.js'
            };
            delete manifest.browser_specific_settings;
            if (targetBrowser === 'edge') {
              manifest.name = 'SoroTrack Extension (Microsoft Edge)';
            }
          } else if (targetBrowser === 'firefox') {
            manifest.background = {
              scripts: ['background.js']
            };
            manifest.browser_specific_settings = {
              gecko: {
                id: 'sorotrack@dashboard.local',
                strict_min_version: '109.0'
              }
            };
          }

          if (appOrigin) {
            if (!manifest.host_permissions) manifest.host_permissions = [];
            const perm = `${appOrigin}/*`;
            if (!manifest.host_permissions.includes(perm)) manifest.host_permissions.push(perm);
          }

          content = JSON.stringify(manifest, null, 2);
        } catch {}
      }

      zip.file(name, content);
    }

    // Add icon binary assets
    const icons = ['icon16.png', 'icon48.png', 'icon128.png'];
    for (const iconName of icons) {
      const iconPath = path.join(extensionDir, iconName);
      if (fs.existsSync(iconPath)) {
        zip.file(iconName, fs.readFileSync(iconPath));
      }
    }

    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
    const filename = targetBrowser === 'edge' 
      ? 'sorotrack-edge.zip' 
      : targetBrowser === 'firefox' 
      ? 'sorotrack-firefox.zip' 
      : 'sorotrack-chrome.zip';

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(zipBuffer);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to generate extension zip' });
  }
});

// Mount Vite or static server
async function startServer() {
  try {
    if (process.env.NODE_ENV !== 'production') {
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    } else {
      const distPath = path.join(process.cwd(), 'dist');
      app.use(express.static(distPath));
      app.get('*', (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } catch (err: any) {
    console.warn('[Server Boot Notice]', err?.message || err);
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }
}

startServer().catch(err => {
  console.warn('[Server Startup Notice]', err?.message || err);
});
