import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { SortOption } from './src/types';
import { 
  getAllRecords, 
  saveRecords, 
  deleteRecord, 
  deleteMultipleRecords,
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
  updateSiteSettings
} from './server/storage';
import { 
  getOrGenerateSummary, 
  askArchiveQuestion, 
  generateFallbackSummary, 
  invalidateSummaryCache 
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
