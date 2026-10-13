import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeFirestore, getFirestore, collection, Firestore, setLogLevel, doc, getDocFromServer } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

// Silence internal Firestore SDK gRPC / WebChannel log output
try {
  setLogLevel('silent');
} catch {}

// Suppress harmless internal Firestore idle stream timeout notices in browser console
if (typeof window !== 'undefined') {
  const origWarn = window.console.warn;
  const origError = window.console.error;
  window.console.warn = (...args: any[]) => {
    const msg = args.map(a => String(a?.message || a)).join(' ');
    if (msg.includes('Disconnecting idle stream') || msg.includes('Timed out waiting for new targets') || msg.includes("RPC 'Listen' stream")) return;
    origWarn.apply(window.console, args);
  };
  window.console.error = (...args: any[]) => {
    const msg = args.map(a => String(a?.message || a)).join(' ');
    if (msg.includes('Disconnecting idle stream') || msg.includes('Timed out waiting for new targets') || msg.includes("RPC 'Listen' stream")) return;
    origError.apply(window.console, args);
  };
}

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

// Validate connection to Firestore as required by Firebase skill
export async function testConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(getDb(), 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Please check your Firebase configuration.');
    }
  }
  return false;
}

// Perform initial connection test in background
testConnection().catch(() => {});

