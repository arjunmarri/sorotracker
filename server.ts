import express from 'express';
import path from 'path';
import fs from 'fs';
import JSZip from 'jszip';
import { createServer as createViteServer } from 'vite';
import { SortOption, XHistoryRecord } from './src/types';
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
  getUserByEmail,
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
  updateAgentStatus,
  getInstalledExtensionVersion,
  setInstalledExtensionVersion,
  getLatestExtensionVersion
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
import { 
  buildInstallerZip, 
  generateWindowsBatchLauncher, 
  generateWindowsPowerShellInstaller, 
  generateMacCommandInstaller,
  generateHomebrewFormula,
  generateBrewInstallScript,
  getMacInstallerSha256
} from './server/installer';

// Suppress harmless Firestore idle stream timeout logs in Node console
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;

const isIgnorableStreamMessage = (...args: any[]): boolean => {
  const str = args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
  return (
    str.includes("Disconnecting idle stream") ||
    str.includes("Timed out waiting for new targets") ||
    (str.includes("GrpcConnection RPC 'Listen' stream") && str.includes("CANCELLED"))
  );
};

console.warn = (...args: any[]) => {
  if (isIgnorableStreamMessage(...args)) return;
  originalConsoleWarn.apply(console, args);
};

console.error = (...args: any[]) => {
  if (isIgnorableStreamMessage(...args)) return;
  originalConsoleError.apply(console, args);
};

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

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

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

// User Login (Web dashboard & Extension)
app.post('/api/auth/login', (req, res) => {
  try {
    const { email, password, displayName } = req.body || {};
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'Valid email address is required.' });
    }
    const cleanEmail = email.trim().toLowerCase();
    const existing = getUserByEmail(cleanEmail);

    if (existing) {
      if (existing.status === 'suspended') {
        return res.status(403).json({ error: 'Account suspended. Please contact administrator.' });
      }
      existing.lastLoginAt = new Date().toISOString();
      updateUser(existing.id, { lastLoginAt: existing.lastLoginAt });
      return res.json({
        success: true,
        user: existing,
        token: getSyncAuthToken(),
        message: `Welcome back, ${existing.displayName || existing.email}!`
      });
    }

    // Auto-register new user if not yet existing
    const newUser = syncAuthUser({
      email: cleanEmail,
      displayName: displayName || cleanEmail.split('@')[0]
    });
    res.json({
      success: true,
      user: newUser,
      token: getSyncAuthToken(),
      message: `Account created! Welcome, ${newUser.displayName || newUser.email}!`
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Login failed.' });
  }
});

// User Registration
app.post('/api/auth/register', (req, res) => {
  try {
    const { email, password, displayName } = req.body || {};
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'Valid email address is required.' });
    }
    const cleanEmail = email.trim().toLowerCase();
    const existing = getUserByEmail(cleanEmail);
    if (existing) {
      return res.status(400).json({ error: 'An account with this email address already exists. Please sign in.' });
    }

    const newUser = syncAuthUser({
      email: cleanEmail,
      displayName: displayName || cleanEmail.split('@')[0]
    });
    res.status(201).json({
      success: true,
      user: newUser,
      token: getSyncAuthToken(),
      message: `Registration successful! Welcome, ${newUser.displayName}!`
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Registration failed.' });
  }
});

// Dedicated Browser Extension Login & Session Verification
app.post('/api/auth/extension-login', (req, res) => {
  try {
    const { email, password, displayName, token } = req.body || {};
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'Email is required for extension login.' });
    }
    const cleanEmail = email.trim().toLowerCase();
    let user = getUserByEmail(cleanEmail);

    if (user) {
      if (user.status === 'suspended') {
        return res.status(403).json({ error: 'Account suspended. Please contact administrator.' });
      }
      user.lastLoginAt = new Date().toISOString();
      updateUser(user.id, { lastLoginAt: user.lastLoginAt });
    } else {
      user = syncAuthUser({
        email: cleanEmail,
        displayName: displayName || cleanEmail.split('@')[0]
      });
    }

    // Retrieve count of user's personal bookmarks
    const userRecords = getAllRecords({ userId: user.id, userEmail: user.email, scope: 'my' });
    const userBookmarks = userRecords.filter(r => r.isBookmarked || r.tags?.includes('bookmark'));

    res.json({
      success: true,
      user,
      token: getSyncAuthToken(),
      bookmarksCount: userBookmarks.length,
      recordsCount: userRecords.length,
      message: `Successfully connected extension to ${user.email}!`
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Extension login failed.' });
  }
});

// Verify & Refresh Browser Extension Session
app.get('/api/auth/extension-session', (req, res) => {
  try {
    const { userId, userEmail, isAdmin } = extractRequestUser(req);
    if (!userId && !userEmail) {
      return res.status(401).json({ connected: false, error: 'No user session provided' });
    }

    let user: any = userId ? getUserById(userId) : undefined;
    if (!user && userEmail) {
      user = getUserByEmail(userEmail);
    }

    if (!user) {
      return res.status(404).json({ connected: false, error: 'User account not found' });
    }

    const userRecords = getAllRecords({ userId: user.id, userEmail: user.email, isAdmin, scope: 'my' });
    const userBookmarks = userRecords.filter(r => r.isBookmarked || r.tags?.includes('bookmark'));

    res.json({
      connected: true,
      user,
      bookmarksCount: userBookmarks.length,
      recordsCount: userRecords.length
    });
  } catch (err: any) {
    res.status(500).json({ connected: false, error: err.message });
  }
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

// Helper to extract authenticated user credentials from request headers, query, or body
function extractRequestUser(req: express.Request): { 
  userId?: string; 
  userEmail?: string; 
  isAdmin: boolean; 
  scope?: 'my' | 'all' 
} {
  const userId = (req.headers['x-user-id'] as string) || (req.query.userId as string) || req.body?.userId;
  const userEmail = (req.headers['x-user-email'] as string) || (req.query.userEmail as string) || req.body?.userEmail;
  const scope = (req.query.scope as 'my' | 'all') || req.body?.scope;
  const cleanEmail = typeof userEmail === 'string' ? userEmail.trim().toLowerCase() : undefined;
  const cleanId = typeof userId === 'string' ? userId.trim() : undefined;
  const isAdmin = cleanEmail === 'arjun.marri@gmail.com' || cleanId === 'user_admin_arjun';
  return {
    userId: cleanId,
    userEmail: cleanEmail,
    isAdmin,
    scope
  };
}

// Sync records from browser extension middleware with remote authentication (2-Step Protocol)
// Step 1: Receives whichever new local JSON data is available on the browser and merges it safely (never overriding/truncating server data).
// Step 2: Checks server data vs. local data. If they don't have the same snippets, pushes server data back to the browser to update local JSON.
app.post('/api/sync', requireSyncAuth, async (req, res) => {
  try {
    const clientExtVersion = (req.headers['x-extension-version'] || req.body?.extensionVersion) as string;
    if (clientExtVersion && typeof clientExtVersion === 'string') {
      setInstalledExtensionVersion(clientExtVersion);
    }

    const { userId, userEmail, isAdmin, scope } = extractRequestUser(req);
    const { records, clientSnippetIds } = req.body;
    if (!records || !Array.isArray(records)) {
      return res.status(400).json({ error: 'Payload must include an array of records.' });
    }

    if (serverAnonMode || req.headers['x-anon-mode'] === 'true') {
      const userRecords = getAllRecords({ userId, userEmail, isAdmin, scope });
      return res.json({
        success: true,
        step1: { added: 0, total: userRecords.length },
        step2: { hasSameSnippets: true, serverRecordsToPush: [] },
        added: 0,
        total: userRecords.length,
        hasSameSnippets: true,
        serverRecordsToPush: [],
        anonMode: true,
        message: 'Anon Mode is active: incoming snippets were not saved or stored.'
      });
    }

    // Step 1: Whichever new local JSON data is available on the browser is merged additively.
    // Stamped with the user account if authenticated
    const result = await saveRecords(records, userId, userEmail);
    invalidateSummaryCache();

    // Step 2: Compare server data and local data for this user account
    const allServerRecords = getAllRecords({ userId, userEmail, isAdmin, scope: scope || 'my' });
    const clientIdsSet = new Set<string>();

    if (Array.isArray(clientSnippetIds)) {
      clientSnippetIds.forEach((id: string) => {
        if (id) clientIdsSet.add(String(id));
      });
    }
    // Also include records from this incoming batch
    records.forEach((r: any) => {
      if (r && r.id) clientIdsSet.add(String(r.id));
    });

    // Check which server snippets are missing from the browser's local JSON
    const missingFromServerOnClient: XHistoryRecord[] = [];
    allServerRecords.forEach(serverRec => {
      if (!clientIdsSet.has(serverRec.id)) {
        missingFromServerOnClient.push(serverRec);
      }
    });

    const hasSameSnippets = missingFromServerOnClient.length === 0 && (clientIdsSet.size >= allServerRecords.length);

    res.json({
      success: true,
      // Step 1 Report: Ingestion of new local JSON snippets
      step1: {
        sentCount: records.length,
        added: result.added,
        total: result.total,
        gcpSaved: result.gcpSaved,
        isQuotaExhausted: result.isQuotaExhausted,
        quotaNotice: result.quotaNotice
      },
      // Step 2 Report: Consistency verification and server push
      step2: {
        hasSameSnippets,
        serverTotal: allServerRecords.length,
        clientTotal: clientIdsSet.size,
        missingOnClientCount: missingFromServerOnClient.length,
        serverRecordsToPush: missingFromServerOnClient
      },
      // Top-level fields for full backward and direct compatibility
      hasSameSnippets,
      serverRecordsToPush: missingFromServerOnClient,
      serverTotal: allServerRecords.length,
      pushedToClientCount: missingFromServerOnClient.length,
      added: result.added,
      total: result.total,
      gcpSaved: result.gcpSaved,
      isQuotaExhausted: result.isQuotaExhausted,
      quotaNotice: result.quotaNotice,
      collection: 'history_records',
      message: hasSameSnippets
        ? `Sync Step 1: Processed ${records.length} incoming local snippets. Sync Step 2: Server and local JSON are in sync (${allServerRecords.length} snippets).`
        : `Sync Step 1: Processed ${records.length} incoming local snippets. Sync Step 2: Pushed ${missingFromServerOnClient.length} already synced snippets to update browser local JSON.`
    });
  } catch (err: any) {
    console.warn('[API /api/sync notice]', err?.message || err);
    res.status(500).json({ error: err.message || 'Failed to save records' });
  }
});

// Step 2 Dedicated Endpoint: Check consistency between browser local JSON and server data
app.post('/api/sync/step2', requireSyncAuth, (req, res) => {
  try {
    const { userId, userEmail, isAdmin, scope } = extractRequestUser(req);
    const { clientSnippetIds } = req.body;
    const allServerRecords = getAllRecords({ userId, userEmail, isAdmin, scope: scope || 'my' });
    const clientIdsSet = new Set<string>(Array.isArray(clientSnippetIds) ? clientSnippetIds.map(String) : []);

    const missingFromServerOnClient = allServerRecords.filter(r => !clientIdsSet.has(r.id));
    const hasSameSnippets = missingFromServerOnClient.length === 0 && (clientIdsSet.size >= allServerRecords.length);

    res.json({
      success: true,
      hasSameSnippets,
      serverTotal: allServerRecords.length,
      clientTotal: clientIdsSet.size,
      missingCount: missingFromServerOnClient.length,
      serverRecordsToPush: missingFromServerOnClient
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to execute Step 2 sync check' });
  }
});

// GET /api/sync: Retrieve full set of already synced server records for authenticated user
app.get('/api/sync', requireSyncAuth, (req, res) => {
  try {
    const { userId, userEmail, isAdmin, scope } = extractRequestUser(req);
    const allServerRecords = getAllRecords({ userId, userEmail, isAdmin, scope });
    res.json({
      success: true,
      total: allServerRecords.length,
      records: allServerRecords
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch synced records' });
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

// Full JSON export of archived records (strictly isolated to authenticated user)
app.get('/api/export/json', (req, res) => {
  try {
    const { userId, userEmail, isAdmin, scope } = extractRequestUser(req);
    const records = getAllRecords({ userId, userEmail, isAdmin, scope: scope || 'my' });
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
    const { userId, userEmail } = extractRequestUser(req);
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
      saveResult = await saveRecords(uniqueRecords, userId, userEmail);
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
    console.log('[Autonomous Agent] Notice in /api/agent/run:', err?.message || 'Recovering with existing top content');
    const existing = getTopContent();
    const items = existing.length > 0 ? existing : saveTopContent(generateFallbackTopContent());
    const recoveredStatus = updateAgentStatus({
      isRunning: false,
      lastRunAt: new Date().toISOString(),
      lastRunStatus: 'success',
      totalItemsFound: items.length,
      mode: req.body?.mode === 'extension' ? 'extension' : 'cloud',
      message: `Autonomous agent active: displaying ${items.length} current trending discussions from 𝕏`
    });
    res.json({
      success: true,
      items,
      status: recoveredStatus,
      source: 'agent-recovery',
      message: recoveredStatus.message
    });
  }
});

// Ingest trending items pushed by Chrome Extension Autonomous Agent
app.post('/api/agent/top-content', (req, res) => {
  try {
    const clientExtVersion = (req.headers['x-extension-version'] || req.body?.extensionVersion) as string;
    if (clientExtVersion && typeof clientExtVersion === 'string') {
      setInstalledExtensionVersion(clientExtVersion);
    }

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
    const { userId, userEmail, isAdmin, scope } = extractRequestUser(req);
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
      hasMedia,
      userId,
      userEmail,
      isAdmin,
      scope
    });

    // Compute meta stats for records visible to this user
    const allRecords = getAllRecords({ userId, userEmail, isAdmin, scope });
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
      user: {
        userId: userId || null,
        userEmail: userEmail || null,
        isAdmin,
        scope: scope || (userId || userEmail ? 'my' : 'public')
      },
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

// Delete a single record (strictly validates ownership)
app.delete('/api/records/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const { userId, userEmail, isAdmin } = extractRequestUser(req);
    const ok = await deleteRecord(id, userId, userEmail, isAdmin);
    invalidateSummaryCache();
    res.json({ success: ok, id });
  } catch (err: any) {
    res.status(err.message?.includes('Unauthorized') ? 403 : 500).json({ error: err.message || 'Failed to delete record' });
  }
});

// Clear records for current user
app.delete('/api/records', async (req, res) => {
  try {
    const { userId, userEmail, isAdmin } = extractRequestUser(req);
    const result = await clearAllRecords(userId, userEmail, isAdmin);
    invalidateSummaryCache();
    res.json({ success: true, count: result.deleted, message: `Cleared ${result.deleted} archive record(s).` });
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
    const { userId, userEmail, isAdmin, scope } = extractRequestUser(req);
    const force = req.query.force === 'true' || req.body?.force === true;
    const records = getAllRecords({ userId, userEmail, isAdmin, scope });
    const summary = await getOrGenerateSummary(records, force);
    res.json(summary);
  } catch (err: any) {
    console.warn('[API /api/summarize notice]', err?.message || err);
    const { userId, userEmail, isAdmin, scope } = extractRequestUser(req);
    const records = getAllRecords({ userId, userEmail, isAdmin, scope });
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
    const { userId, userEmail, isAdmin, scope } = extractRequestUser(req);
    const records = getAllRecords({ userId, userEmail, isAdmin, scope });
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
      'dashboard-bridge.js',
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
      'dashboard-bridge.js',
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

      zip.file(name, content, {
        date: new Date(),
        dosPermissions: 0x20
      });
    }

    // Add icon binary assets
    const icons = ['icon16.png', 'icon48.png', 'icon128.png'];
    for (const iconName of icons) {
      const iconPath = path.join(extensionDir, iconName);
      if (fs.existsSync(iconPath)) {
        zip.file(iconName, fs.readFileSync(iconPath), {
          date: new Date(),
          dosPermissions: 0x20
        });
      }
    }

    const zipBuffer = await zip.generateAsync({
      type: 'nodebuffer',
      mimeType: 'application/zip',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
      platform: 'DOS'
    });

    const latestVersion = getLatestExtensionVersion();
    const versionTag = `v${latestVersion}`;
    const filename = targetBrowser === 'edge' 
      ? `sorotrack-${versionTag}-edge.zip` 
      : targetBrowser === 'firefox' 
      ? `sorotrack-${versionTag}-firefox.zip` 
      : `sorotrack-${versionTag}-chrome.zip`;

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', zipBuffer.length.toString());
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.send(zipBuffer);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to generate extension zip' });
  }
});

// 1-Click OS Automated Installer Bundle Route (supports ?os=windows and ?os=mac)
app.get('/api/extension/installer', async (req, res) => {
  try {
    const userAgent = req.get('user-agent') || '';
    let targetOS: 'windows' | 'mac' = 'windows';
    const reqOs = (req.query.os as string)?.toLowerCase();
    if (reqOs === 'mac' || reqOs === 'macos' || reqOs === 'darwin') {
      targetOS = 'mac';
    } else if (reqOs === 'windows' || reqOs === 'win') {
      targetOS = 'windows';
    } else if (/Macintosh|Mac OS X/i.test(userAgent)) {
      targetOS = 'mac';
    }

    const extensionDir = path.join(process.cwd(), 'extension');
    const authToken = getSyncAuthToken();
    const appOrigin = `${req.protocol}://${req.get('host')}`;
    const latestVersion = getLatestExtensionVersion();

    const zipBuffer = await buildInstallerZip(targetOS, appOrigin, authToken, latestVersion, extensionDir);
    const filename = `sorotrack-installer-${targetOS}-v${latestVersion}.zip`;

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', zipBuffer.length.toString());
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.send(zipBuffer);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to generate extension installer package' });
  }
});

// Direct Raw Installer Script (e.g. for curl | bash or direct .bat / .command / .ps1 download)
app.get('/api/extension/installer/script', (req, res) => {
  try {
    const userAgent = req.get('user-agent') || '';
    let targetOS: 'windows' | 'mac' = 'windows';
    const reqOs = (req.query.os as string)?.toLowerCase();
    if (reqOs === 'mac' || reqOs === 'macos' || reqOs === 'darwin') {
      targetOS = 'mac';
    } else if (reqOs === 'windows' || reqOs === 'win') {
      targetOS = 'windows';
    } else if (/Macintosh|Mac OS X/i.test(userAgent)) {
      targetOS = 'mac';
    }

    const authToken = getSyncAuthToken();
    const appOrigin = `${req.protocol}://${req.get('host')}`;
    const latestVersion = getLatestExtensionVersion();
    const format = (req.query.format as string)?.toLowerCase();

    if (targetOS === 'windows') {
      if (format === 'ps1') {
        const ps1 = generateWindowsPowerShellInstaller(appOrigin, authToken, latestVersion);
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="install.ps1"');
        return res.send(ps1);
      }
      const bat = generateWindowsBatchLauncher();
      res.setHeader('Content-Type', 'application/x-bat; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="Install-SoroTrack.bat"');
      return res.send(bat);
    } else {
      const sh = generateMacCommandInstaller(appOrigin, authToken, latestVersion);
      res.setHeader('Content-Type', 'text/x-shellscript; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="Install-SoroTrack.command"');
      return res.send(sh);
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to generate installer script' });
  }
});

// Homebrew (brew) Formula Route (serves sorotrack.rb)
app.get(['/api/extension/brew/sorotrack.rb', '/api/extension/brew/formula'], async (req, res) => {
  try {
    const extensionDir = path.join(process.cwd(), 'extension');
    const authToken = getSyncAuthToken();
    const appOrigin = `${req.protocol}://${req.get('host')}`;
    const latestVersion = getLatestExtensionVersion();

    let sha256Hex = '';
    try {
      const { sha256 } = await getMacInstallerSha256(appOrigin, authToken, latestVersion, extensionDir);
      sha256Hex = sha256;
    } catch (hashErr) {
      console.warn('Could not compute pre-hash for brew formula:', hashErr);
    }

    const formula = generateHomebrewFormula(appOrigin, latestVersion, sha256Hex);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', 'inline; filename="sorotrack.rb"');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.send(formula);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to generate Homebrew formula' });
  }
});

// Homebrew Direct Install Script (curl | bash)
app.get('/api/extension/brew/install.sh', (req, res) => {
  try {
    const appOrigin = `${req.protocol}://${req.get('host')}`;
    const latestVersion = getLatestExtensionVersion();
    const script = generateBrewInstallScript(appOrigin, latestVersion);

    res.setHeader('Content-Type', 'text/x-shellscript; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="brew-install-sorotrack.sh"');
    res.send(script);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to generate Homebrew install script' });
  }
});

// Homebrew Metadata / Tap Integration Info API
app.get('/api/extension/brew/info', async (req, res) => {
  try {
    const extensionDir = path.join(process.cwd(), 'extension');
    const authToken = getSyncAuthToken();
    const appOrigin = `${req.protocol}://${req.get('host')}`;
    const latestVersion = getLatestExtensionVersion();

    let sha256Hex = '';
    try {
      const { sha256 } = await getMacInstallerSha256(appOrigin, authToken, latestVersion, extensionDir);
      sha256Hex = sha256;
    } catch {}

    const formula = generateHomebrewFormula(appOrigin, latestVersion, sha256Hex);
    res.json({
      formulaUrl: `${appOrigin}/api/extension/brew/sorotrack.rb`,
      quickInstallCmd: `brew install --formula ${appOrigin}/api/extension/brew/sorotrack.rb`,
      tapRepoName: 'homebrew-sorotrack',
      tapFilePath: 'Formula/sorotrack.rb',
      version: latestVersion,
      sha256: sha256Hex,
      formulaCode: formula
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to get brew info' });
  }
});

// Helper for semantic version comparison
function compareSemVerServer(v1: string, v2: string): number {
  const p1 = (v1 || '0').replace(/^[^\d]*/, '').split('.').map(n => parseInt(n, 10) || 0);
  const p2 = (v2 || '0').replace(/^[^\d]*/, '').split('.').map(n => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
    const num1 = p1[i] || 0;
    const num2 = p2[i] || 0;
    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }
  return 0;
}

// Check Extension Version & Upgrades
app.get('/api/extension/version', (req, res) => {
  try {
    const clientHeaderVer = (req.headers['x-extension-version'] as string) || (req.query.version as string);
    if (clientHeaderVer && typeof clientHeaderVer === 'string') {
      setInstalledExtensionVersion(clientHeaderVer.trim());
    }

    const latestVersion = getLatestExtensionVersion();
    const installedVersion = clientHeaderVer ? clientHeaderVer.trim() : (getInstalledExtensionVersion() || null);
    const isOutdated = Boolean(installedVersion && compareSemVerServer(installedVersion, latestVersion) < 0);

    res.json({
      latestVersion,
      installedVersion: installedVersion || null,
      isOutdated,
      releaseDate: '2026-09-23',
      releaseNotes: 'Autonomous Top Content scanning agent, improved Firestore quota protection, and dark/light theme support.',
      downloadUrl: '/api/extension/download'
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch extension version' });
  }
});

// Update or Report Installed Extension Version from client
app.post('/api/extension/version', (req, res) => {
  try {
    const version = req.body?.version || req.headers['x-extension-version'];
    if (version && typeof version === 'string') {
      setInstalledExtensionVersion(version.trim());
    }
    const latestVersion = getLatestExtensionVersion();
    const installedVersion = getInstalledExtensionVersion();
    const isOutdated = Boolean(installedVersion && compareSemVerServer(installedVersion, latestVersion) < 0);

    res.json({
      success: true,
      installedVersion,
      latestVersion,
      isOutdated
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to update extension version' });
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
