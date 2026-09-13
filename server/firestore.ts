import fs from 'fs';
import path from 'path';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  initializeFirestore,
  getFirestore, 
  collection, 
  doc, 
  getDocs, 
  deleteDoc, 
  writeBatch,
  terminate,
  Firestore
} from 'firebase/firestore';
import { XHistoryRecord } from '../src/types';

export const COLLECTION_NAME = 'history_records';

const DATA_DIR = path.join(process.cwd(), 'data');
const QUOTA_FILE = path.join(DATA_DIR, 'quota_state.json');

let firestoreInstance: Firestore | null = null;
let isFirestoreAvailable = false;

// Quota exhaustion circuit breaker
let isQuotaExhausted = false;
let quotaExhaustedTimestamp: number = 0;
let quotaErrorMessage: string = '';
const QUOTA_COOLDOWN_MS = 24 * 60 * 60 * 1000; // Reset next day (24h cooldown)

function loadQuotaState() {
  try {
    if (fs.existsSync(QUOTA_FILE)) {
      const data = JSON.parse(fs.readFileSync(QUOTA_FILE, 'utf-8'));
      const age = Date.now() - (data.quotaExhaustedTimestamp || 0);
      if (data.isQuotaExhausted && age < QUOTA_COOLDOWN_MS) {
        isQuotaExhausted = true;
        quotaExhaustedTimestamp = data.quotaExhaustedTimestamp;
        quotaErrorMessage = data.quotaErrorMessage || 'Quota limit exceeded';
        console.log('[Firestore Quota Guard] Active daily quota exhaustion detected. Cloud writes paused; local storage safeguarding records.');
      } else {
        isQuotaExhausted = false;
      }
    }
  } catch (e) {
    console.warn('[Firestore] Notice checking quota file:', e);
  }
}

function persistQuotaState(exhausted: boolean, message: string = '') {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(QUOTA_FILE, JSON.stringify({
      isQuotaExhausted: exhausted,
      quotaExhaustedTimestamp: exhausted ? Date.now() : 0,
      quotaErrorMessage: message,
      metric: "Free daily write units per project (free tier database)",
      quotaResetNotice: exhausted
        ? "Firestore daily write quota reached (free tier limit: 20,000 writes/day). Quota will automatically reset tomorrow. All browsing history and timeline records are safely preserved in local disk storage without data loss."
        : null
    }, null, 2), 'utf-8');
  } catch (e) {
    console.warn('[Firestore] Notice saving quota state:', e);
  }
}

// Initialize quota state on load
loadQuotaState();

async function handleQuotaExhausted(err: any, context: string) {
  isQuotaExhausted = true;
  quotaExhaustedTimestamp = Date.now();
  quotaErrorMessage = err?.message || 'Quota limit exceeded';
  persistQuotaState(true, quotaErrorMessage);

  console.warn(`[Firestore Quota Guard] ${context}: Daily write quota reached (free tier: 20,000 writes/day). Pausing Cloud writes; local storage safeguarding records.`);

  // Cleanly terminate Firestore client instance to abort background gRPC streams and stop retries
  if (firestoreInstance) {
    const inst = firestoreInstance;
    firestoreInstance = null;
    try {
      await terminate(inst);
    } catch {
      // ignore
    }
  }
}

function isResourceExhaustedError(err: any): boolean {
  if (!err) return false;
  const code = err.code || err.status;
  const msg = (err.message || String(err)).toLowerCase();
  return (
    code === 'resource-exhausted' ||
    code === 8 ||
    msg.includes('resource_exhausted') ||
    msg.includes('quota limit exceeded') ||
    msg.includes('free daily write units') ||
    msg.includes('quota exceeded') ||
    msg.includes('firestore timeout')
  );
}

export function getFirestoreQuotaStatus() {
  if (isQuotaExhausted && Date.now() - quotaExhaustedTimestamp > QUOTA_COOLDOWN_MS) {
    isQuotaExhausted = false;
    quotaErrorMessage = '';
    persistQuotaState(false);
  }

  return {
    isCloudReady: isFirestoreAvailable,
    isQuotaExhausted,
    quotaExhaustedTimestamp,
    quotaResetNotice: isQuotaExhausted
      ? 'Firestore daily write quota reached (free tier limit: 20,000 writes/day). Quota will automatically reset tomorrow. SoroTrack local storage is safely safeguarding all records without data loss.'
      : null,
    upgradeUrl: 'https://console.firebase.google.com/project/backend-prowater/firestore/databases/ai-studio-sorohistory-65bf2fc3-f6f5-41f4-8a17-64f5ce5608ca/data?openUpgradeDialog=true',
    pricingUrl: 'https://firebase.google.com/pricing#cloud-firestore',
    databaseId: 'ai-studio-sorohistory-65bf2fc3-f6f5-41f4-8a17-64f5ce5608ca'
  };
}

export function getFirestoreDB(): Firestore | null {
  if (isQuotaExhausted) {
    // When quota is exhausted, avoid creating write stream instances
    return null;
  }

  if (firestoreInstance) return firestoreInstance;

  try {
    const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
    if (!fs.existsSync(configPath)) {
      console.warn('[Firestore] firebase-applet-config.json not found. Falling back to local storage.');
      return null;
    }

    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    const app = getApps().length === 0 ? initializeApp(config) : getApp();
    try {
      firestoreInstance = initializeFirestore(app, {
        experimentalForceLongPolling: true,
      }, config.firestoreDatabaseId || undefined);
    } catch {
      firestoreInstance = getFirestore(app, config.firestoreDatabaseId || undefined);
    }
    isFirestoreAvailable = true;
    console.log(`[Firestore] Connected to GCP collection "${COLLECTION_NAME}" on database: ${config.firestoreDatabaseId || 'default'}`);
    return firestoreInstance;
  } catch (err: any) {
    console.warn('[Firestore] Initialization notice:', err?.message || err);
    return null;
  }
}

/**
 * Fetch all records from GCP Firestore collection
 */
export async function fetchRecordsFromFirestore(): Promise<XHistoryRecord[]> {
  const db = getFirestoreDB();
  if (!db) return [];

  try {
    const colRef = collection(db, COLLECTION_NAME);
    const snapshot = await getDocs(colRef);
    const records: XHistoryRecord[] = [];

    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      if (data && data.id) {
        records.push(data as XHistoryRecord);
      }
    });

    console.log(`[Firestore] Loaded ${records.length} records from GCP Firestore collection "${COLLECTION_NAME}".`);
    return records;
  } catch (err: any) {
    if (isResourceExhaustedError(err)) {
      await handleQuotaExhausted(err, 'fetchRecords');
    } else {
      console.warn('[Firestore] Notice fetching documents from GCP collection:', err?.message || err);
    }
    return [];
  }
}

/**
 * Save records to GCP Firestore collection using batched writes
 */
export async function saveRecordsToFirestore(records: XHistoryRecord[]): Promise<number> {
  // Circuit breaker: skip writes immediately if quota is currently exhausted
  const quota = getFirestoreQuotaStatus();
  if (quota.isQuotaExhausted) {
    console.log(`[Firestore Quota Guard] Holding ${records.length} records in local storage. Cloud write quota currently exhausted.`);
    return 0;
  }

  const db = getFirestoreDB();
  if (!db || records.length === 0) return 0;

  try {
    let savedCount = 0;
    // Firestore batch limit is 500 operations
    const BATCH_SIZE = 400;

    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const chunk = records.slice(i, i + BATCH_SIZE);
      const batch = writeBatch(db);

      chunk.forEach(record => {
        if (record && record.id) {
          const docRef = doc(db, COLLECTION_NAME, record.id);
          // Sanitize record for Firestore (remove undefined values)
          const cleanRecord = JSON.parse(JSON.stringify(record));
          batch.set(docRef, cleanRecord, { merge: true });
          savedCount++;
        }
      });

      await batch.commit();
    }

    console.log(`[Firestore] Successfully persisted ${savedCount} records to GCP collection "${COLLECTION_NAME}".`);
    return savedCount;
  } catch (err: any) {
    if (isResourceExhaustedError(err)) {
      await handleQuotaExhausted(err, 'saveRecords');
    } else {
      console.warn('[Firestore] Notice persisting records to GCP collection:', err?.message || err);
    }
    return 0;
  }
}

/**
 * Delete a single record from GCP Firestore collection
 */
export async function deleteRecordFromFirestore(id: string): Promise<boolean> {
  const quota = getFirestoreQuotaStatus();
  if (quota.isQuotaExhausted) return false;

  const db = getFirestoreDB();
  if (!db || !id) return false;

  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    await deleteDoc(docRef);
    console.log(`[Firestore] Deleted record ${id} from GCP collection "${COLLECTION_NAME}".`);
    return true;
  } catch (err: any) {
    if (isResourceExhaustedError(err)) {
      await handleQuotaExhausted(err, `deleteRecord(${id})`);
    } else {
      console.warn(`[Firestore] Notice deleting record ${id}:`, err?.message || err);
    }
    return false;
  }
}

/**
 * Clear all records from GCP Firestore collection
 */
export async function clearFirestoreCollection(): Promise<boolean> {
  const quota = getFirestoreQuotaStatus();
  if (quota.isQuotaExhausted) return false;

  const db = getFirestoreDB();
  if (!db) return false;

  try {
    const colRef = collection(db, COLLECTION_NAME);
    const snapshot = await getDocs(colRef);
    const batch = writeBatch(db);

    snapshot.forEach(docSnap => {
      batch.delete(docSnap.ref);
    });

    await batch.commit();
    console.log(`[Firestore] Cleared all documents from GCP collection "${COLLECTION_NAME}".`);
    return true;
  } catch (err: any) {
    if (isResourceExhaustedError(err)) {
      await handleQuotaExhausted(err, 'clearCollection');
    } else {
      console.warn('[Firestore] Notice clearing collection:', err?.message || err);
    }
    return false;
  }
}

