import fs from 'fs';
import path from 'path';
import { XHistoryRecord } from '../src/types';
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

// In-memory cache synced with GCP Firestore
let recordsMap = new Map<string, XHistoryRecord>();
// Track IDs already persisted in Firestore to avoid duplicate writes
const syncedToFirestoreIds = new Set<string>();
let isInitialized = false;
let lastGcpSyncTime: string | null = null;
let gcpCollectionRecordCount = 0;

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

/**
 * Initializes storage strictly from real GCP Firestore collection
 * Falls back to local disk storage if cloud quota is exhausted or offline
 */
export async function initStorage() {
  if (isInitialized) return;
  ensureDataDir();

  try {
    const cloudRecords = await fetchRecordsFromFirestore();
    recordsMap.clear();

    if (cloudRecords && cloudRecords.length > 0) {
      cloudRecords.forEach(item => {
        if (item && item.id) {
          recordsMap.set(item.id, item);
          syncedToFirestoreIds.add(item.id);
        }
      });
      gcpCollectionRecordCount = cloudRecords.length;
      lastGcpSyncTime = new Date().toISOString();
      console.log(`[Storage] Loaded ${recordsMap.size} real records from GCP collection "${COLLECTION_NAME}".`);
      persistToDisk();
    } else {
      // If Firestore returned 0 (or was held by quota / network), load from disk file if available
      if (fs.existsSync(DATA_FILE)) {
        try {
          const raw = fs.readFileSync(DATA_FILE, 'utf-8');
          const diskRecords: XHistoryRecord[] = JSON.parse(raw);
          if (Array.isArray(diskRecords) && diskRecords.length > 0) {
            diskRecords.forEach(item => {
              if (item && item.id) {
                recordsMap.set(item.id, item);
              }
            });
            console.log(`[Storage] Preserved ${recordsMap.size} records from local disk backup.`);
          }
        } catch (readErr) {
          console.warn('[Storage] Could not parse local backup file:', readErr);
        }
      } else {
        console.log(`[Storage] GCP collection "${COLLECTION_NAME}" is currently empty. Awaiting real extension sync.`);
      }
    }
  } catch (err) {
    console.error('[Storage] Error loading from GCP collection:', err);
    // Load local disk if Firestore throw
    if (fs.existsSync(DATA_FILE)) {
      try {
        const raw = fs.readFileSync(DATA_FILE, 'utf-8');
        const diskRecords = JSON.parse(raw);
        if (Array.isArray(diskRecords)) {
          diskRecords.forEach((item: XHistoryRecord) => {
            if (item && item.id) recordsMap.set(item.id, item);
          });
        }
      } catch {}
    }
  }

  isInitialized = true;
}

function persistToDisk() {
  try {
    ensureDataDir();
    const array = Array.from(recordsMap.values());
    fs.writeFileSync(DATA_FILE, JSON.stringify(array, null, 2), 'utf-8');
  } catch (e) {
    console.error('[Storage] Error writing to disk:', e);
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
  sort?: 'latest_date' | 'oldest_date' | 'newest' | 'oldest' | 'likes' | 'retweets';
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

  incoming.forEach(item => {
    if (!item.id && item.tweetUrl) {
      const m = item.tweetUrl.match(/status\/(\d+)/);
      item.id = m ? m[1] : 'rec_' + Math.random().toString(36).slice(2, 9);
    }

    if (item.id) {
      const isNew = !recordsMap.has(item.id);
      const isNotYetInFirestore = !syncedToFirestoreIds.has(item.id);

      if (isNew) {
        added++;
        const record: XHistoryRecord = {
          ...item,
          scannedAt: item.scannedAt || new Date().toISOString()
        };
        recordsMap.set(item.id, record);
        itemsToPersist.push(record);
      } else if (isNotYetInFirestore) {
        // Record was saved locally but not yet in Firestore
        const existing = recordsMap.get(item.id)!;
        itemsToPersist.push(existing);
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
    } catch (err) {
      console.error('[Storage] Error pushing records to GCP Firestore:', err);
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
