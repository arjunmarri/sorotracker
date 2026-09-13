import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeFirestore, getFirestore, collection, Firestore } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase client
export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Auth
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// Lazy-loaded Firestore client instance to prevent eager connection timeouts in browser iframes
let _db: Firestore | null = null;

export function getDb(): Firestore {
  if (!_db) {
    try {
      _db = initializeFirestore(app, {
        experimentalForceLongPolling: true,
      }, firebaseConfig.firestoreDatabaseId || undefined);
    } catch {
      _db = getFirestore(app, firebaseConfig.firestoreDatabaseId || undefined);
    }
  }
  return _db;
}

// Lazy proxy for db to prevent instantiating Firestore connection on module import
export const db: Firestore = new Proxy({} as Firestore, {
  get(_, prop: string | symbol) {
    const realDb = getDb();
    const val = (realDb as any)[prop];
    if (typeof val === 'function') {
      return val.bind(realDb);
    }
    return val;
  }
});

// Collection reference
export const HISTORY_COLLECTION_NAME = 'history_records';
export const historyCollection = new Proxy({} as any, {
  get(_, prop: string | symbol) {
    const realCollection = collection(getDb(), HISTORY_COLLECTION_NAME);
    const val = (realCollection as any)[prop];
    if (typeof val === 'function') {
      return val.bind(realCollection);
    }
    return val;
  }
});

// Validate connection via backend storage endpoint to prevent browser-side WebChannel timeouts
export async function testConnection(): Promise<boolean> {
  try {
    const res = await fetch('/api/storage/status');
    if (res.ok) {
      const data = await res.json();
      return !!data.isCloudReady;
    }
  } catch (error: any) {
    console.warn('[Firestore] Could not verify storage readiness with backend:', error);
  }
  return false;
}

