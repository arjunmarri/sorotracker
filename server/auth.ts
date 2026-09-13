import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';

const DATA_DIR = path.join(process.cwd(), 'data');
const AUTH_FILE = path.join(DATA_DIR, 'auth_config.json');

interface AuthConfig {
  token: string;
  createdAt: string;
}

let cachedToken: string | null = null;

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

/**
 * Returns or initializes a secure persistent authentication token for remote extension sync
 */
export function getSyncAuthToken(): string {
  if (cachedToken) {
    return cachedToken;
  }

  // Check environment variable first if provided
  if (process.env.SYNC_AUTH_TOKEN && process.env.SYNC_AUTH_TOKEN.trim().length >= 8) {
    cachedToken = process.env.SYNC_AUTH_TOKEN.trim();
    return cachedToken;
  }

  ensureDataDir();

  if (fs.existsSync(AUTH_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(AUTH_FILE, 'utf-8')) as AuthConfig;
      if (data && data.token && typeof data.token === 'string') {
        cachedToken = data.token;
        return cachedToken;
      }
    } catch (e) {
      console.warn('[Auth] Could not read existing auth_config.json, generating new token');
    }
  }

  // Generate a cryptographically secure 256-bit token
  const randomHex = crypto.randomBytes(24).toString('hex');
  const token = `sh_live_${randomHex}`;
  
  const config: AuthConfig = {
    token,
    createdAt: new Date().toISOString()
  };

  try {
    fs.writeFileSync(AUTH_FILE, JSON.stringify(config, null, 2), 'utf-8');
  } catch (e: any) {
    console.warn('[Auth] Notice writing auth config to disk:', e?.message || e);
  }

  cachedToken = token;
  console.log('[Auth] Generated new SoroTrack remote sync token.');
  return cachedToken;
}

/**
 * Validates a user-supplied token against the active sync token
 */
export function validateSyncAuthToken(providedToken?: string | null): boolean {
  if (!providedToken || typeof providedToken !== 'string') {
    return false;
  }

  const activeToken = getSyncAuthToken();
  const trimmed = providedToken.trim();

  // Normalize bearer prefixes if included
  const cleaned = trimmed.replace(/^Bearer\s+/i, '').trim();

  if (cleaned.length !== activeToken.length) {
    return false;
  }

  try {
    return crypto.timingSafeEqual(Buffer.from(cleaned), Buffer.from(activeToken));
  } catch {
    return cleaned === activeToken;
  }
}

/**
 * Express middleware to authenticate remote sync calls
 */
export function requireSyncAuth(req: Request, res: Response, next: NextFunction) {
  // Extract token from standard headers or query parameters
  const authHeader = req.headers.authorization;
  const apiKeyHeader = req.headers['x-api-key'] as string | undefined;
  const syncTokenHeader = req.headers['x-sync-token'] as string | undefined;
  const queryToken = req.query.token as string | undefined;

  let candidate: string | undefined = undefined;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    candidate = authHeader.substring(7).trim();
  } else if (authHeader) {
    candidate = authHeader.trim();
  } else if (apiKeyHeader) {
    candidate = apiKeyHeader.trim();
  } else if (syncTokenHeader) {
    candidate = syncTokenHeader.trim();
  } else if (queryToken) {
    candidate = queryToken.trim();
  }

  if (validateSyncAuthToken(candidate)) {
    return next();
  }

  return res.status(401).json({
    error: 'Unauthorized: Valid SoroTrack remote sync authentication token is required.',
    code: 'AUTH_REQUIRED',
    hint: 'Provide Authorization: Bearer <token> or x-api-key header.'
  });
}
