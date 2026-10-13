import fs from 'fs';
import path from 'path';
import { XHistoryRecord, UserProfile, SiteSettings, TopContentItem, AgentRunStatus } from '../src/types';
import { 
  fetchRecordsFromFirestore, 
  saveRecordsToFirestore, 
  deleteRecordFromFirestore, 
  clearFirestoreCollection,
  getFirestoreQuotaStatus,
  COLLECTION_NAME 
} from './firestore';

const DATA_DIR = path.join(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'history_records.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const TOP_CONTENT_FILE = path.join(DATA_DIR, 'top_content.json');
const AGENT_STATUS_FILE = path.join(DATA_DIR, 'agent_status.json');
const EXTENSION_STATUS_FILE = path.join(DATA_DIR, 'extension_status.json');

// In-memory cache synced with GCP Firestore
let recordsMap = new Map<string, XHistoryRecord>();
// Users map for admin panel
let usersMap = new Map<string, UserProfile>();
// Top content trending items cache
let topContentMap = new Map<string, TopContentItem>();
// Agent status cache
let agentStatus: AgentRunStatus = {
  isRunning: false,
  lastRunStatus: 'idle',
  totalItemsFound: 0,
  mode: 'cloud',
  autoScanIntervalMin: 60
};
// Extension version status
let extensionStatus = {
  latestVersion: '1.1.0',
  installedVersion: '1.0.0' as string | null,
  lastCheckedAt: new Date().toISOString()
};
// Site settings cache
let currentSettings: SiteSettings = {
  id: 'site',
  siteName: 'SoroTrack',
  tagline: 'Preserve and analyze your 𝕏 bookmarks, history & references',
  theme: 'warm-neutral',
  footerContent: 'Automated 𝕏 bookmarks & reading history archive with zero-reflow extraction, AI semantic discovery, and 1,000-item batch sync.',
  footerCopyright: '© 2026 SoroTrack. All rights reserved.',
  updatedAt: new Date().toISOString()
};

// Track IDs already persisted in Firestore to avoid duplicate writes
const syncedToFirestoreIds = new Set<string>();
let isInitialized = false;
let lastGcpSyncTime: string | null = null;
let gcpCollectionRecordCount = 0;

/**
 * Validator for record source:
 * Allows records from https://x.com/i/history and https://x.com/i/history/likes,
 * as well as any bookmark snippets created when a user clicks bookmark on X on any page.
 */
export function isAllowedSourcePage(sourcePage?: string, isBookmark = false): boolean {
  if (!sourcePage) return true; // legacy records
  try {
    const url = new URL(sourcePage);
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    if (host !== 'x.com' && host !== 'twitter.com') return false;
    if (isBookmark) return true;
    const pathname = url.pathname.replace(/\/+$/, '').toLowerCase();
    return pathname === '/i/history' || pathname === '/i/history/likes' || pathname === '/i/bookmarks';
  } catch {
    return isBookmark;
  }
}

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function initUsersAndSettings() {
  ensureDataDir();

  // 1. Load or initialize users
  if (fs.existsSync(USERS_FILE)) {
    try {
      const raw = fs.readFileSync(USERS_FILE, 'utf-8');
      const loaded: UserProfile[] = JSON.parse(raw);
      if (Array.isArray(loaded)) {
        usersMap.clear();
        loaded.forEach(u => {
          if (u && u.id) usersMap.set(u.id, u);
        });
      }
    } catch (e) {
      console.warn('[Storage] Error loading users.json:', e);
    }
  }

  // Ensure default administrator account exists (arjun.marri@gmail.com)
  const defaultAdminId = 'user_admin_arjun';
  let hasArjun = false;
  usersMap.forEach(u => {
    if (u.email?.toLowerCase() === 'arjun.marri@gmail.com') {
      u.role = 'admin'; // Always grant admin
      hasArjun = true;
    }
  });

  if (!hasArjun) {
    const adminUser: UserProfile = {
      id: defaultAdminId,
      email: 'arjun.marri@gmail.com',
      displayName: 'Arjun Marri',
      role: 'admin',
      status: 'active',
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString()
    };
    usersMap.set(defaultAdminId, adminUser);
    persistUsersToDisk();
  }

  // 2. Load or initialize site settings
  if (fs.existsSync(SETTINGS_FILE)) {
    try {
      const raw = fs.readFileSync(SETTINGS_FILE, 'utf-8');
      const loaded = JSON.parse(raw);
      if (loaded && loaded.siteName) {
        currentSettings = { ...currentSettings, ...loaded };
      }
    } catch (e) {
      console.warn('[Storage] Error loading settings.json:', e);
    }
  } else {
    persistSettingsToDisk();
  }

  // 3. Load or initialize top content items
  if (fs.existsSync(TOP_CONTENT_FILE)) {
    try {
      const raw = fs.readFileSync(TOP_CONTENT_FILE, 'utf-8');
      const loaded: TopContentItem[] = JSON.parse(raw);
      if (Array.isArray(loaded)) {
        topContentMap.clear();
        loaded.forEach(item => {
          if (item && item.id) topContentMap.set(item.id, item);
        });
      }
    } catch (e) {
      console.warn('[Storage] Error loading top_content.json:', e);
    }
  }

  // 4. Load agent status
  if (fs.existsSync(AGENT_STATUS_FILE)) {
    try {
      const raw = fs.readFileSync(AGENT_STATUS_FILE, 'utf-8');
      const loaded = JSON.parse(raw);
      if (loaded && typeof loaded === 'object') {
        agentStatus = { ...agentStatus, ...loaded, isRunning: false };
      }
    } catch (e) {
      console.warn('[Storage] Error loading agent_status.json:', e);
    }
  }

  // 5. Load extension version status
  if (fs.existsSync(EXTENSION_STATUS_FILE)) {
    try {
      const raw = fs.readFileSync(EXTENSION_STATUS_FILE, 'utf-8');
      const loaded = JSON.parse(raw);
      if (loaded && typeof loaded === 'object') {
        extensionStatus = { ...extensionStatus, ...loaded };
      }
    } catch (e) {
      console.warn('[Storage] Error loading extension_status.json:', e);
    }
  }
}

function persistExtensionStatusToDisk() {
  try {
    ensureDataDir();
    fs.writeFileSync(EXTENSION_STATUS_FILE, JSON.stringify(extensionStatus, null, 2), 'utf-8');
  } catch (e: any) {
    console.warn('[Storage] Notice writing extension status to disk:', e?.message || e);
  }
}

function persistTopContentToDisk() {
  try {
    ensureDataDir();
    const array = Array.from(topContentMap.values());
    fs.writeFileSync(TOP_CONTENT_FILE, JSON.stringify(array, null, 2), 'utf-8');
  } catch (e: any) {
    console.warn('[Storage] Notice writing top content to disk:', e?.message || e);
  }
}

function persistAgentStatusToDisk() {
  try {
    ensureDataDir();
    fs.writeFileSync(AGENT_STATUS_FILE, JSON.stringify(agentStatus, null, 2), 'utf-8');
  } catch (e: any) {
    console.warn('[Storage] Notice writing agent status to disk:', e?.message || e);
  }
}

function persistUsersToDisk() {
  try {
    ensureDataDir();
    const array = Array.from(usersMap.values());
    fs.writeFileSync(USERS_FILE, JSON.stringify(array, null, 2), 'utf-8');
  } catch (e: any) {
    console.warn('[Storage] Notice writing users to disk:', e?.message || e);
  }
}

function persistSettingsToDisk() {
  try {
    ensureDataDir();
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(currentSettings, null, 2), 'utf-8');
  } catch (e: any) {
    console.warn('[Storage] Notice writing settings to disk:', e?.message || e);
  }
}

export function sanitizeAndNormalizeRecord(item: any): XHistoryRecord {
  const authorName = item.authorName || item.author || item.name || item.authorHandle || 'User';
  const authorHandle = item.authorHandle || item.handle || (item.author ? item.author.replace(/^@/, '') : 'user');
  const tweetText = item.text || item.tweetText || '';
  const tweetUrl = item.tweetUrl || item.url || (item.id ? `https://x.com/${authorHandle}/status/${item.id}` : '');
  
  return {
    ...item,
    id: String(item.id || item.tweetId || 'rec_' + Math.random().toString(36).slice(2, 9)),
    userId: item.userId ? String(item.userId) : undefined,
    userEmail: item.userEmail ? String(item.userEmail) : undefined,
    authorName: String(authorName),
    authorHandle: String(authorHandle).replace(/^@/, ''),
    text: String(tweetText),
    tweetUrl: String(tweetUrl),
    createdAt: item.createdAt || item.timestamp || item.scannedAt || new Date().toISOString(),
    scannedAt: item.scannedAt || item.timestamp || new Date().toISOString(),
    syncedAt: item.syncedAt || item.scannedAt || new Date().toISOString(),
    links: Array.isArray(item.links) ? item.links : [],
    media: Array.isArray(item.media) ? item.media : [],
    tags: Array.isArray(item.tags) ? item.tags : [],
    labels: Array.isArray(item.labels) ? item.labels : []
  };
}

/**
 * Initializes storage instantly from local disk, then initiates background GCP Firestore sync.
 * Guarantees zero-delay dev server startup and continuous availability.
 */
export async function initStorage() {
  if (isInitialized) return;
  ensureDataDir();
  initUsersAndSettings();

  // 1. Instant synchronous load from local disk backup
  if (fs.existsSync(DATA_FILE)) {
    try {
      const raw = fs.readFileSync(DATA_FILE, 'utf-8');
      const diskRecords: any[] = JSON.parse(raw);
      if (Array.isArray(diskRecords) && diskRecords.length > 0) {
        let prunedInvalidCount = 0;
        diskRecords.forEach(rawItem => {
          if (rawItem && (rawItem.id || rawItem.url || rawItem.tweetUrl)) {
            const item = sanitizeAndNormalizeRecord(rawItem);
            if (isAllowedSourcePage(item.sourcePage)) {
              recordsMap.set(item.id, item);
            } else {
              prunedInvalidCount++;
            }
          }
        });
        if (prunedInvalidCount > 0) {
          console.log(`[Storage] Pruned ${prunedInvalidCount} non-history records (e.g. /home or modals) from local backup.`);
          persistToDisk();
        }
        console.log(`[Storage] Preserved ${recordsMap.size} verified history records from local disk backup.`);
      }
    } catch (readErr: any) {
      console.warn('[Storage] Notice reading local backup file:', readErr?.message || readErr);
    }
  }

  isInitialized = true;

  // 2. Background asynchronous sync with real GCP Firestore collection
  (async () => {
    try {
      const cloudRecords = await fetchRecordsFromFirestore();
      if (cloudRecords && cloudRecords.length > 0) {
        cloudRecords.forEach((rawItem: any) => {
          if (rawItem && (rawItem.id || rawItem.url || rawItem.tweetUrl)) {
            const item = sanitizeAndNormalizeRecord(rawItem);
            if (isAllowedSourcePage(item.sourcePage)) {
              recordsMap.set(item.id, item);
              syncedToFirestoreIds.add(item.id);
            }
          }
        });
        gcpCollectionRecordCount = cloudRecords.length;
        lastGcpSyncTime = new Date().toISOString();
        console.log(`[Storage] Synced ${recordsMap.size} records from GCP collection "${COLLECTION_NAME}".`);
        persistToDisk();
      } else if (recordsMap.size === 0) {
        console.log(`[Storage] GCP collection "${COLLECTION_NAME}" is currently empty. Awaiting real extension sync.`);
      }
    } catch (err: any) {
      console.warn('[Storage] Notice during GCP collection sync:', err?.message || err);
    }
  })();
}

function persistToDisk() {
  try {
    ensureDataDir();
    const array = Array.from(recordsMap.values());
    fs.writeFileSync(DATA_FILE, JSON.stringify(array, null, 2), 'utf-8');
  } catch (e: any) {
    console.warn('[Storage] Notice writing to disk:', e?.message || e);
  }
}

export function getAllRecords(options?: {
  query?: string;
  domain?: string;
  author?: string;
  hasLinks?: boolean;
  hasMedia?: boolean;
  tag?: string;
  topic?: string;
  keywords?: string[];
  sort?: 'latest_date' | 'oldest_date' | 'latest_synced' | 'oldest_synced' | 'newest' | 'oldest' | 'likes' | 'retweets';
  includeRecycled?: boolean;
  onlyRecycled?: boolean;
  userId?: string;
  userEmail?: string;
  isAdmin?: boolean;
  scope?: 'my' | 'all';
}): XHistoryRecord[] {
  let list = Array.from(recordsMap.values()).map(sanitizeAndNormalizeRecord);

  // Filter out recycled records unless explicitly requested
  if (options?.onlyRecycled) {
    list = list.filter(r => r.isRecycled === true);
  } else if (!options?.includeRecycled) {
    list = list.filter(r => !r.isRecycled);
  }

  // User account privacy isolation:
  // "Only users who connect their account should see their own bookmarks and not others"
  if (options) {
    const { userId, userEmail, isAdmin, scope } = options;
    const reqEmail = userEmail ? userEmail.toLowerCase().trim() : null;

    if (isAdmin && scope === 'all') {
      // Admin specifically viewing full global archive
    } else if (userId || reqEmail) {
      // Connected user: strictly show their own bookmarks and records
      list = list.filter(r => {
        const matchesId = Boolean(userId && r.userId === userId);
        const matchesEmail = Boolean(reqEmail && r.userEmail && r.userEmail.toLowerCase().trim() === reqEmail);
        return matchesId || matchesEmail;
      });
    } else {
      // Unauthenticated visitor / guest: only show unassigned public records, NEVER other users' private bookmarks
      list = list.filter(r => !r.userId && !r.userEmail);
    }
  }

  if (options) {
    const { query, domain, author, hasLinks, hasMedia, tag, topic, keywords, sort } = options;

    if (query) {
      const q = query.toLowerCase();
      list = list.filter(r => 
        (r.text && r.text.toLowerCase().includes(q)) ||
        (r.authorName && r.authorName.toLowerCase().includes(q)) ||
        (r.authorHandle && r.authorHandle.toLowerCase().includes(q)) ||
        (r.links && r.links.some(l => (l.title || l.domain || l.url || '').toLowerCase().includes(q)))
      );
    }

    if (domain) {
      const d = domain.toLowerCase();
      list = list.filter(r => 
        r.links && r.links.some(l => (l.domain || '').toLowerCase().includes(d))
      );
    }

    if (author) {
      const a = author.toLowerCase();
      list = list.filter(r => 
        (r.authorHandle && r.authorHandle.toLowerCase().includes(a)) || 
        (r.authorName && r.authorName.toLowerCase().includes(a))
      );
    }

    if (hasLinks === true) {
      list = list.filter(r => r.links && r.links.length > 0);
    }

    if (hasMedia === true) {
      list = list.filter(r => r.media && r.media.length > 0);
    }

    if (tag) {
      const t = tag.toLowerCase();
      list = list.filter(r => r.tags && r.tags.some(item => item.toLowerCase() === t));
    }

    if (topic || (keywords && keywords.length > 0)) {
      const wordsToMatch: string[] = [];
      if (keywords && keywords.length > 0) {
        keywords.forEach(k => {
          const trimmed = k.toLowerCase().trim();
          if (trimmed) wordsToMatch.push(trimmed);
        });
      }
      if (topic) {
        const stopWords = new Set(['and', 'the', 'for', 'with', 'from', 'about', 'into', 'over', 'after', 'that', 'this', 'theme', 'topic', '&']);
        const tokens = topic
          .toLowerCase()
          .replace(/[^a-z0-9\s]/g, ' ')
          .split(/\s+/)
          .filter(t => t.length > 2 && !stopWords.has(t));
        wordsToMatch.push(...tokens);
      }

      const uniqueWords = Array.from(new Set(wordsToMatch)).filter(w => w.length > 1);

      if (uniqueWords.length > 0) {
        list = list.filter(r => {
          const text = (r.text || '').toLowerCase();
          const author = `${r.authorName || ''} ${r.authorHandle || ''}`.toLowerCase();
          const links = (r.links || []).map(l => `${l.title || ''} ${l.domain || ''} ${l.url || ''}`.toLowerCase()).join(' ');
          const combined = `${text} ${author} ${links}`;

          return uniqueWords.some(w => {
            if (w.length <= 2) {
              const regex = new RegExp(`\\b${w}\\b`, 'i');
              return regex.test(text);
            }
            return combined.includes(w);
          });
        });
      }
    }

    // Sort
    list.sort((a, b) => {
      if (sort === 'latest_synced') {
        const timeB = new Date(b.syncedAt || b.scannedAt || b.createdAt || 0).getTime();
        const timeA = new Date(a.syncedAt || a.scannedAt || a.createdAt || 0).getTime();
        return timeB - timeA;
      }
      if (sort === 'oldest_synced') {
        const timeA = new Date(a.syncedAt || a.scannedAt || a.createdAt || 0).getTime();
        const timeB = new Date(b.syncedAt || b.scannedAt || b.createdAt || 0).getTime();
        return timeA - timeB;
      }
      if (sort === 'latest_date') {
        const timeB = new Date(b.createdAt || b.scannedAt || 0).getTime();
        const timeA = new Date(a.createdAt || a.scannedAt || 0).getTime();
        return timeB - timeA;
      }
      if (sort === 'oldest_date') {
        const timeA = new Date(a.createdAt || a.scannedAt || 0).getTime();
        const timeB = new Date(b.createdAt || b.scannedAt || 0).getTime();
        return timeA - timeB;
      }
      if (sort === 'oldest') {
        const timeA = new Date(a.scannedAt || a.createdAt || 0).getTime();
        const timeB = new Date(b.scannedAt || b.createdAt || 0).getTime();
        return timeA - timeB;
      }
      if (sort === 'likes') {
        return (b.metrics?.likes || 0) - (a.metrics?.likes || 0);
      }
      if (sort === 'retweets') {
        return (b.metrics?.retweets || 0) - (a.metrics?.retweets || 0);
      }
      // default / 'newest': newest scanned or created
      return new Date(b.scannedAt || b.createdAt || 0).getTime() - new Date(a.scannedAt || a.createdAt || 0).getTime();
    });
  } else {
    list.sort((a, b) => new Date(b.scannedAt || b.createdAt || 0).getTime() - new Date(a.scannedAt || a.createdAt || 0).getTime());
  }

  return list;
}

/**
 * Save incoming real records pushed by browser extension through middleware
 */
export async function saveRecords(
  incoming: XHistoryRecord[],
  defaultUserId?: string,
  defaultUserEmail?: string
): Promise<{ 
  added: number; 
  total: number; 
  gcpSaved: number;
  isQuotaExhausted: boolean;
  quotaNotice: string | null;
}> {
  let added = 0;
  const itemsToPersist: XHistoryRecord[] = [];
  const nowIso = new Date().toISOString();

  // Filter incoming records: allow history pages as well as bookmark snippets from any page on X
  const validIncoming = incoming.filter(item => {
    const isBookmark = Boolean(item.isBookmarked || item.tags?.includes('bookmark'));
    return isAllowedSourcePage(item.sourcePage, isBookmark);
  });

  validIncoming.forEach(item => {
    const normalizedItem = sanitizeAndNormalizeRecord(item);
    if (!normalizedItem.id && normalizedItem.tweetUrl) {
      const m = normalizedItem.tweetUrl.match(/status\/(\d+)/);
      normalizedItem.id = m ? m[1] : 'rec_' + Math.random().toString(36).slice(2, 9);
    }

    if (!normalizedItem.userId && defaultUserId) {
      normalizedItem.userId = defaultUserId;
    }
    if (!normalizedItem.userEmail && defaultUserEmail) {
      normalizedItem.userEmail = defaultUserEmail;
    }

    if (normalizedItem.id) {
      const isNew = !recordsMap.has(normalizedItem.id);
      const isNotYetInFirestore = !syncedToFirestoreIds.has(normalizedItem.id);
      const syncTime = normalizedItem.syncedAt || nowIso;

      if (isNew) {
        added++;
        const record: XHistoryRecord = {
          ...normalizedItem,
          isBookmarked: normalizedItem.isBookmarked ?? (normalizedItem.tags?.includes('bookmark') || false),
          bookmarkedAt: normalizedItem.bookmarkedAt || (normalizedItem.isBookmarked ? (normalizedItem.scannedAt || nowIso) : undefined),
          scannedAt: normalizedItem.scannedAt || nowIso,
          syncedAt: syncTime
        };
        recordsMap.set(normalizedItem.id, record);
        itemsToPersist.push(record);
      } else {
        const existing = recordsMap.get(normalizedItem.id)!;
        let modified = false;
        // Merge any richer data
        if (!existing.authorName && normalizedItem.authorName) {
          existing.authorName = normalizedItem.authorName;
          modified = true;
        }
        if (!existing.text && normalizedItem.text) {
          existing.text = normalizedItem.text;
          modified = true;
        }
        // Ensure syncedAt timestamp is updated when snippet is synced or if missing
        if (normalizedItem.syncedAt || !existing.syncedAt) {
          existing.syncedAt = normalizedItem.syncedAt || nowIso;
          modified = true;
        }
        // If existing record was bookmarked now, update bookmark fields
        if (normalizedItem.isBookmarked && !existing.isBookmarked) {
          existing.isBookmarked = true;
          existing.bookmarkedAt = normalizedItem.bookmarkedAt || nowIso;
          if (!existing.tags) existing.tags = [];
          if (!existing.tags.includes('bookmark')) existing.tags.push('bookmark');
          modified = true;
        }
        if (isNotYetInFirestore || modified) {
          itemsToPersist.push(existing);
        }
      }
    }
  });

  // Persist locally
  persistToDisk();

  let gcpSaved = 0;
  const quota = getFirestoreQuotaStatus();

  if (itemsToPersist.length > 0 && !quota.isQuotaExhausted) {
    try {
      gcpSaved = await saveRecordsToFirestore(itemsToPersist);
      if (gcpSaved > 0) {
        itemsToPersist.slice(0, gcpSaved).forEach(r => syncedToFirestoreIds.add(r.id));
        lastGcpSyncTime = new Date().toISOString();
        gcpCollectionRecordCount = syncedToFirestoreIds.size;
      }
    } catch (err: any) {
      console.warn('[Storage] Notice pushing records to GCP Firestore:', err?.message || err);
    }
  }

  const currentQuota = getFirestoreQuotaStatus();

  return { 
    added, 
    total: recordsMap.size, 
    gcpSaved,
    isQuotaExhausted: currentQuota.isQuotaExhausted,
    quotaNotice: currentQuota.quotaResetNotice
  };
}

export async function deleteRecord(id: string, userId?: string, userEmail?: string, isAdmin?: boolean): Promise<boolean> {
  const existing = recordsMap.get(id);
  if (!existing) return false;

  // Enforce account ownership: non-admin can only delete their own records
  if (!isAdmin && (userId || userEmail)) {
    const reqEmail = userEmail ? userEmail.toLowerCase().trim() : null;
    const matchesId = Boolean(userId && existing.userId === userId);
    const matchesEmail = Boolean(reqEmail && existing.userEmail && existing.userEmail.toLowerCase().trim() === reqEmail);
    if (!matchesId && !matchesEmail) {
      throw new Error('Unauthorized: You can only delete your own bookmarks and records.');
    }
  }

  const deleted = recordsMap.delete(id);
  syncedToFirestoreIds.delete(id);
  if (deleted) {
    persistToDisk();
    deleteRecordFromFirestore(id).catch(err => {
      console.warn(`[Storage] Error deleting doc ${id} from GCP collection:`, err);
    });
  }
  return deleted;
}

export async function deleteMultipleRecords(ids: string[]): Promise<number> {
  let count = 0;
  for (const id of ids) {
    if (recordsMap.has(id)) {
      recordsMap.delete(id);
      syncedToFirestoreIds.delete(id);
      deleteRecordFromFirestore(id).catch(err => {
        console.warn(`[Storage] Error deleting doc ${id} from GCP collection:`, err);
      });
      count++;
    }
  }
  if (count > 0) {
    persistToDisk();
  }
  return count;
}

export async function recycleRecords(ids: string[]): Promise<number> {
  const updatedRecords: XHistoryRecord[] = [];
  const now = new Date().toISOString();

  for (const id of ids) {
    const rec = recordsMap.get(id);
    if (rec) {
      rec.isRecycled = true;
      rec.recycledAt = now;
      recordsMap.set(id, rec);
      updatedRecords.push(rec);
    }
  }

  if (updatedRecords.length > 0) {
    persistToDisk();
    saveRecordsToFirestore(updatedRecords).catch(err => {
      console.warn('[Storage] Error updating recycled state in GCP collection:', err);
    });
  }

  return updatedRecords.length;
}

export async function restoreRecords(ids: string[]): Promise<number> {
  const updatedRecords: XHistoryRecord[] = [];

  for (const id of ids) {
    const rec = recordsMap.get(id);
    if (rec) {
      rec.isRecycled = false;
      delete rec.recycledAt;
      recordsMap.set(id, rec);
      updatedRecords.push(rec);
    }
  }

  if (updatedRecords.length > 0) {
    persistToDisk();
    saveRecordsToFirestore(updatedRecords).catch(err => {
      console.warn('[Storage] Error updating restored state in GCP collection:', err);
    });
  }

  return updatedRecords.length;
}

export function getRecycledRecords(): XHistoryRecord[] {
  return Array.from(recordsMap.values())
    .filter(r => r.isRecycled === true)
    .sort((a, b) => new Date(b.recycledAt || 0).getTime() - new Date(a.recycledAt || 0).getTime());
}

export async function emptyRecycleBin(): Promise<number> {
  const recycledIds = Array.from(recordsMap.values())
    .filter(r => r.isRecycled === true)
    .map(r => r.id);

  if (recycledIds.length === 0) return 0;
  return await deleteMultipleRecords(recycledIds);
}

export async function clearAllRecords(userId?: string, userEmail?: string, isAdmin?: boolean): Promise<{ deleted: number }> {
  // If administrator without specific user filter, clear global collection
  if (isAdmin && !userId && !userEmail) {
    const count = recordsMap.size;
    recordsMap.clear();
    syncedToFirestoreIds.clear();
    persistToDisk();
    await clearFirestoreCollection().catch(err => {
      console.warn('[Storage] Error clearing GCP collection:', err);
    });
    return { deleted: count };
  }

  // Otherwise, clear ONLY this specific user's bookmarks and records
  const reqEmail = userEmail ? userEmail.toLowerCase().trim() : null;
  const toDelete: string[] = [];

  for (const [id, r] of recordsMap.entries()) {
    const matchesId = Boolean(userId && r.userId === userId);
    const matchesEmail = Boolean(reqEmail && r.userEmail && r.userEmail.toLowerCase().trim() === reqEmail);
    if (matchesId || matchesEmail) {
      toDelete.push(id);
    }
  }

  for (const id of toDelete) {
    recordsMap.delete(id);
    syncedToFirestoreIds.delete(id);
    deleteRecordFromFirestore(id).catch(() => {});
  }

  if (toDelete.length > 0) {
    persistToDisk();
  }

  return { deleted: toDelete.length };
}

export function getStorageStatus() {
  const quota = getFirestoreQuotaStatus();
  return {
    totalRecords: recordsMap.size,
    gcpCollection: COLLECTION_NAME,
    lastGcpSyncTime,
    isCloudReady: quota.isCloudReady,
    isQuotaExhausted: quota.isQuotaExhausted,
    quotaNotice: quota.quotaResetNotice,
    upgradeUrl: quota.upgradeUrl,
    pricingUrl: quota.pricingUrl
  };
}

// User Management API
export function getAllUsers(): UserProfile[] {
  return Array.from(usersMap.values()).sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function getUserById(id: string): UserProfile | undefined {
  return usersMap.get(id);
}

export function getUserByEmail(email: string): UserProfile | undefined {
  const clean = (email || '').trim().toLowerCase();
  for (const u of usersMap.values()) {
    if (u.email.toLowerCase() === clean) return u;
  }
  return undefined;
}

export function createUser(payload: Partial<UserProfile>): UserProfile {
  const email = (payload.email || '').trim().toLowerCase();
  if (!email) {
    throw new Error('Email address is required.');
  }

  // Check if user already exists
  for (const u of usersMap.values()) {
    if (u.email.toLowerCase() === email) {
      throw new Error(`User with email "${email}" already exists.`);
    }
  }

  const id = payload.id || `user_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const newUser: UserProfile = {
    id,
    email,
    displayName: payload.displayName || email.split('@')[0],
    photoURL: payload.photoURL || '',
    role: payload.role || (email === 'arjun.marri@gmail.com' ? 'admin' : 'editor'),
    status: payload.status || 'active',
    createdAt: new Date().toISOString(),
    lastLoginAt: new Date().toISOString()
  };

  usersMap.set(id, newUser);
  persistUsersToDisk();
  return newUser;
}

export function updateUser(id: string, updates: Partial<UserProfile>): UserProfile {
  const existing = usersMap.get(id);
  if (!existing) {
    throw new Error(`User not found with id: ${id}`);
  }

  // Protect admin Arjun
  if (existing.email.toLowerCase() === 'arjun.marri@gmail.com' && updates.role && updates.role !== 'admin') {
    updates.role = 'admin'; // Always preserve admin privilege for main owner
  }

  const updated: UserProfile = {
    ...existing,
    ...updates,
    id: existing.id,
    email: updates.email ? updates.email.trim().toLowerCase() : existing.email
  };

  usersMap.set(id, updated);
  persistUsersToDisk();
  return updated;
}

export function deleteUser(id: string): boolean {
  const existing = usersMap.get(id);
  if (!existing) return false;

  // Prevent deleting primary owner
  if (existing.email.toLowerCase() === 'arjun.marri@gmail.com') {
    throw new Error('Cannot delete the primary system administrator account (arjun.marri@gmail.com).');
  }

  const result = usersMap.delete(id);
  if (result) {
    persistUsersToDisk();
  }
  return result;
}

export function syncAuthUser(profile: { id?: string; email?: string; displayName?: string; photoURL?: string }): UserProfile {
  const email = (profile.email || '').trim().toLowerCase();
  if (!email) {
    throw new Error('Authenticated user must have an email.');
  }

  // Find existing by email or id
  let matched: UserProfile | undefined;
  for (const u of usersMap.values()) {
    if (u.email.toLowerCase() === email || (profile.id && u.id === profile.id)) {
      matched = u;
      break;
    }
  }

  const now = new Date().toISOString();

  if (matched) {
    matched.lastLoginAt = now;
    if (profile.displayName && !matched.displayName) matched.displayName = profile.displayName;
    if (profile.photoURL) matched.photoURL = profile.photoURL;
    if (email === 'arjun.marri@gmail.com') matched.role = 'admin';
    usersMap.set(matched.id, matched);
    persistUsersToDisk();
    return matched;
  }

  // New user registering
  const id = profile.id || `user_${Date.now()}`;
  const isFirstUser = usersMap.size === 0 || email === 'arjun.marri@gmail.com';
  const role: 'admin' | 'editor' | 'viewer' = isFirstUser ? 'admin' : 'viewer';

  const newUser: UserProfile = {
    id,
    email,
    displayName: profile.displayName || email.split('@')[0],
    photoURL: profile.photoURL || '',
    role,
    status: 'active',
    createdAt: now,
    lastLoginAt: now
  };

  usersMap.set(id, newUser);
  persistUsersToDisk();
  return newUser;
}

// Site Settings API
export function getSiteSettings(): SiteSettings {
  return { ...currentSettings };
}

export function updateSiteSettings(updates: Partial<SiteSettings>, updatedBy?: string): SiteSettings {
  currentSettings = {
    ...currentSettings,
    ...updates,
    updatedAt: new Date().toISOString(),
    updatedBy: updatedBy || currentSettings.updatedBy || 'admin'
  };
  persistSettingsToDisk();
  return { ...currentSettings };
}

// Top Content & Autonomous Agent API
export function getTopContent(): TopContentItem[] {
  const items = Array.from(topContentMap.values());
  return items.sort((a, b) => (a.rank || 999) - (b.rank || 999));
}

export function saveTopContent(items: TopContentItem[]): TopContentItem[] {
  topContentMap.clear();
  items.forEach(item => {
    if (item && item.id) {
      topContentMap.set(item.id, item);
    }
  });
  persistTopContentToDisk();
  return getTopContent();
}

export function addTopContentItems(items: TopContentItem[]): TopContentItem[] {
  items.forEach(item => {
    if (item && item.id) {
      topContentMap.set(item.id, item);
    }
  });
  persistTopContentToDisk();
  return getTopContent();
}

export function clearTopContent(): void {
  topContentMap.clear();
  persistTopContentToDisk();
}

export function getAgentStatus(): AgentRunStatus {
  return { ...agentStatus, totalItemsFound: topContentMap.size };
}

export function updateAgentStatus(updates: Partial<AgentRunStatus>): AgentRunStatus {
  agentStatus = {
    ...agentStatus,
    ...updates,
    totalItemsFound: topContentMap.size
  };
  persistAgentStatusToDisk();
  return { ...agentStatus };
}

export function getInstalledExtensionVersion(): string | null {
  return extensionStatus.installedVersion;
}

export function setInstalledExtensionVersion(version: string): void {
  if (!version || typeof version !== 'string') return;
  extensionStatus.installedVersion = version.trim();
  extensionStatus.lastCheckedAt = new Date().toISOString();
  persistExtensionStatusToDisk();
}

export function getLatestExtensionVersion(): string {
  const manifestPath = path.join(process.cwd(), 'extension', 'manifest.json');
  if (fs.existsSync(manifestPath)) {
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
      if (manifest.version) return manifest.version;
    } catch {}
  }
  return extensionStatus.latestVersion || '1.1.0';
}


