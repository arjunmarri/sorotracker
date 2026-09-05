import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, getDocFromServer, collection } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase client
export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Firestore with the dedicated database ID from config
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId || undefined);

// Collection reference
export const HISTORY_COLLECTION_NAME = 'history_records';
export const historyCollection = collection(db, HISTORY_COLLECTION_NAME);

// Validate connection on boot as recommended by Firebase guidelines
export async function testConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error: any) {
    return false;
  }
}

testConnection();
