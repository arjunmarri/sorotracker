import fs from 'fs';
import path from 'path';
import { XHistoryRecord, UserProfile, SiteSettings } from '../src/types';
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

// In-memory cache synced with GCP Firestore
let recordsMap = new Map<string, XHistoryRecord>();
// Users map for admin panel
let usersMap = new Map<string, UserProfile>();
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
      const diskRecords: XHistoryRecord[] = JSON.parse(raw);
      if (Array.isArray(diskRecords) && diskRecords.length > 0) {
        let prunedInvalidCount = 0;
        diskRecords.forEach(item => {
          if (item && item.id) {
            if (isAllowedSourcePage(item.sourcePage)) {
              if (!item.syncedAt) {
                item.syncedAt = item.scannedAt || item.createdAt || new Date().toISOString();
              }
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
        cloudRecords.forEach(item => {
          if (item && item.id && isAllowedSourcePage(item.sourcePage)) {
            if (!item.syncedAt) {
              item.syncedAt = item.scannedAt || item.createdAt || new Date().toISOString();
            }
            recordsMap.set(item.id, item);
            syncedToFirestoreIds.add(item.id);
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
}): XHistoryRecord[] {
  let list = Array.from(recordsMap.values());

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
export async function saveRecords(incoming: XHistoryRecord[]): Promise<{ 
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
    if (!item.id && item.tweetUrl) {
      const m = item.tweetUrl.match(/status\/(\d+)/);
      item.id = m ? m[1] : 'rec_' + Math.random().toString(36).slice(2, 9);
    }

    if (item.id) {
      const isNew = !recordsMap.has(item.id);
      const isNotYetInFirestore = !syncedToFirestoreIds.has(item.id);
      const syncTime = item.syncedAt || nowIso;

      if (isNew) {
        added++;
        const record: XHistoryRecord = {
          ...item,
          isBookmarked: item.isBookmarked ?? (item.tags?.includes('bookmark') || false),
          bookmarkedAt: item.bookmarkedAt || (item.isBookmarked ? (item.scannedAt || nowIso) : undefined),
          scannedAt: item.scannedAt || nowIso,
          syncedAt: syncTime
        };
        recordsMap.set(item.id, record);
        itemsToPersist.push(record);
      } else {
        const existing = recordsMap.get(item.id)!;
        let modified = false;
        // Ensure syncedAt timestamp is updated when snippet is synced or if missing
        if (item.syncedAt || !existing.syncedAt) {
          existing.syncedAt = item.syncedAt || nowIso;
          modified = true;
        }
        // If existing record was bookmarked now, update bookmark fields
        if (item.isBookmarked && !existing.isBookmarked) {
          existing.isBookmarked = true;
          existing.bookmarkedAt = item.bookmarkedAt || nowIso;
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

export async function deleteRecord(id: string): Promise<boolean> {
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

export async function clearAllRecords(): Promise<void> {
  recordsMap.clear();
  syncedToFirestoreIds.clear();
  persistToDisk();
  await clearFirestoreCollection().catch(err => {
    console.warn('[Storage] Error clearing GCP collection:', err);
  });
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
