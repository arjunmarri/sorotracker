import { 
  signInWithPopup, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  User as FirebaseUser,
  updateProfile
} from 'firebase/auth';
import { auth, googleProvider } from './firebase';
import { UserProfile } from '../types';

const LOCAL_USER_KEY = 'soro_auth_user';

type AuthListener = (user: UserProfile | null) => void;
const listeners = new Set<AuthListener>();

let currentUserProfile: UserProfile | null = null;

function notifyListeners() {
  listeners.forEach(cb => {
    try {
      cb(currentUserProfile);
    } catch (e) {
      console.warn('Auth listener error:', e);
    }
  });
}

// Load cached user from localStorage on init
try {
  const cached = localStorage.getItem(LOCAL_USER_KEY);
  if (cached) {
    currentUserProfile = JSON.parse(cached);
  }
} catch {}

/**
 * Synchronize Firebase auth user with backend users database
 */
export async function syncUserWithBackend(payload: {
  id: string;
  email: string;
  displayName?: string;
  photoURL?: string;
}): Promise<UserProfile> {
  try {
    const res = await fetch('/api/auth/sync-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || 'Failed to sync user with server');
    }

    const profile: UserProfile = await res.json();
    currentUserProfile = profile;
    try {
      localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(profile));
    } catch {}
    notifyListeners();
    return profile;
  } catch (err: any) {
    console.warn('[Auth] Server sync fallback:', err);
    // Fallback profile if offline
    const isArjun = payload.email.toLowerCase() === 'arjun.marri@gmail.com';
    const fallbackProfile: UserProfile = {
      id: payload.id,
      email: payload.email,
      displayName: payload.displayName || payload.email.split('@')[0],
      photoURL: payload.photoURL || '',
      role: isArjun ? 'admin' : 'viewer',
      status: 'active',
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString()
    };
    currentUserProfile = fallbackProfile;
    try {
      localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(fallbackProfile));
    } catch {}
    notifyListeners();
    return fallbackProfile;
  }
}

/**
 * Sign in using Google Social Login (Firebase Auth)
 */
export async function loginWithGoogle(): Promise<UserProfile> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const fbUser = result.user;
    if (!fbUser.email) {
      throw new Error('No email found in Google profile.');
    }

    return await syncUserWithBackend({
      id: fbUser.uid,
      email: fbUser.email,
      displayName: fbUser.displayName || undefined,
      photoURL: fbUser.photoURL || undefined
    });
  } catch (error: any) {
    console.error('Google Sign-In Error:', error);
    // Handle iframe sandbox / popup blocker
    if (error.code === 'auth/popup-blocked' || error.code === 'auth/cancelled-popup-request') {
      throw new Error('Google Sign-In popup was blocked. Please allow popups or use email sign-in / demo admin access.');
    }
    throw error;
  }
}

/**
 * Sign in with email and password
 */
export async function loginWithEmail(email: string, pass: string): Promise<UserProfile> {
  try {
    const res = await signInWithEmailAndPassword(auth, email, pass);
    return await syncUserWithBackend({
      id: res.user.uid,
      email: res.user.email || email,
      displayName: res.user.displayName || undefined,
      photoURL: res.user.photoURL || undefined
    });
  } catch (error: any) {
    // If user exists on server but not in local Firebase Auth, or in preview iframe
    if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential' || error.code === 'auth/network-request-failed') {
      // Check if user is registered in backend
      const userRes = await fetch('/api/users').catch(() => null);
      if (userRes && userRes.ok) {
        const users: UserProfile[] = await userRes.json().catch(() => []);
        const matched = users.find(u => u.email.toLowerCase() === email.toLowerCase());
        if (matched) {
          currentUserProfile = matched;
          localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(matched));
          notifyListeners();
          return matched;
        }
      }
    }
    throw error;
  }
}

/**
 * Register account with email and password
 */
export async function registerWithEmail(email: string, pass: string, displayName: string): Promise<UserProfile> {
  try {
    const res = await createUserWithEmailAndPassword(auth, email, pass);
    if (displayName && res.user) {
      await updateProfile(res.user, { displayName }).catch(() => {});
    }
    return await syncUserWithBackend({
      id: res.user.uid,
      email: res.user.email || email,
      displayName: displayName || undefined,
      photoURL: undefined
    });
  } catch (error: any) {
    // If Firebase Auth creation fails due to network/rules, register via server API directly
    if (error.code === 'auth/email-already-in-use' || error.code === 'auth/operation-not-allowed') {
      const resp = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, displayName, role: 'viewer', status: 'active' })
      });
      if (resp.ok) {
        const user: UserProfile = await resp.json();
        currentUserProfile = user;
        localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(user));
        notifyListeners();
        return user;
      }
    }
    throw error;
  }
}

/**
 * 1-Click quick Demo Admin login for testing administrator features
 */
export async function loginAsDemoAdmin(): Promise<UserProfile> {
  return await syncUserWithBackend({
    id: 'user_admin_arjun',
    email: 'arjun.marri@gmail.com',
    displayName: 'Arjun Marri (Admin)',
    photoURL: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80'
  });
}

/**
 * Log out
 */
export async function logoutUser(): Promise<void> {
  try {
    await signOut(auth);
  } catch (e) {
    console.warn('[Auth] Signout warning:', e);
  }
  currentUserProfile = null;
  try {
    localStorage.removeItem(LOCAL_USER_KEY);
  } catch {}
  notifyListeners();
}

/**
 * Get current authenticated user profile
 */
export function getCurrentUser(): UserProfile | null {
  return currentUserProfile;
}

/**
 * Subscribe to auth state changes
 */
export function onUserChange(callback: AuthListener): () => void {
  listeners.add(callback);
  callback(currentUserProfile);
  return () => {
    listeners.delete(callback);
  };
}

// Listen to Firebase auth state changes
onAuthStateChanged(auth, async (fbUser: FirebaseUser | null) => {
  if (fbUser && fbUser.email) {
    await syncUserWithBackend({
      id: fbUser.uid,
      email: fbUser.email,
      displayName: fbUser.displayName || undefined,
      photoURL: fbUser.photoURL || undefined
    });
  } else if (!fbUser && currentUserProfile && !currentUserProfile.id.startsWith('user_admin_')) {
    // If not demo user, clear
    currentUserProfile = null;
    try {
      localStorage.removeItem(LOCAL_USER_KEY);
    } catch {}
    notifyListeners();
  }
});
