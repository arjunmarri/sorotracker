import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { getAllRecords, saveRecords, deleteRecord, clearAllRecords, initStorage, getStorageStatus } from './server/storage';
import { summarizeArchive, askArchiveQuestion, generateFallbackSummary } from './server/ai';
import { getSyncAuthToken, requireSyncAuth, validateSyncAuthToken } from './server/auth';

const app = express();
const PORT = 3000;

// Initialize storage & GCP Firestore connection
initStorage().catch(err => console.warn('[Storage] Init warning:', err));

// Enable CORS for browser extension and local tools
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, x-api-key, x-sync-token');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json({ limit: '10mb' }));

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'SoroTracker Middleware', time: new Date().toISOString() });
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

// Sync records from browser extension middleware with remote authentication
app.post('/api/sync', requireSyncAuth, async (req, res) => {
  try {
    const { records } = req.body;
    if (!records || !Array.isArray(records)) {
      return res.status(400).json({ error: 'Payload must include an array of records.' });
    }

    const result = await saveRecords(records);
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
    console.error('[API /api/sync error]', err);
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
    res.setHeader('Content-Disposition', 'attachment; filename="sorotracker_archive.json"');
    res.send(JSON.stringify(records, null, 2));
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to export records' });
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
    const sort = req.query.sort as 'latest_date' | 'oldest_date' | 'newest' | 'oldest' | 'likes' | 'retweets' | undefined;
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
    res.json({ success: ok, id });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to delete record' });
  }
});

// Clear all records
app.delete('/api/records', async (req, res) => {
  try {
    await clearAllRecords();
    res.json({ success: true, message: 'All archive records cleared from memory and GCP collection.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to clear records' });
  }
});

// AI Summarization
app.post('/api/summarize', async (req, res) => {
  try {
    const records = getAllRecords();
    const summary = await summarizeArchive(records);
    res.json(summary);
  } catch (err: any) {
    console.warn('[API /api/summarize notice]', err?.message || err);
    const records = getAllRecords();
    res.json(generateFallbackSummary(records));
  }
});

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
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
