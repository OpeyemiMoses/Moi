import { createHash, randomBytes } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { moiDb, SessionRecord, UserProfileRecord } from '@moi/database';

export const SESSION_COOKIE_NAME = 'moi_session';
export const SESSION_ABSOLUTE_LIFETIME_SEC = 7 * 24 * 60 * 60; // 7 days
export const SESSION_ABSOLUTE_LIFETIME_MS = SESSION_ABSOLUTE_LIFETIME_SEC * 1000;
export const SESSION_IDLE_TIMEOUT_SEC = 2 * 60 * 60; // 2 hours
export const SESSION_IDLE_TIMEOUT_MS = SESSION_IDLE_TIMEOUT_SEC * 1000;

export interface SessionAuthResult {
  authenticated: boolean;
  user?: UserProfileRecord | null;
  session?: SessionRecord | null;
  error?: string;
  statusCode?: number;
}

/**
 * Generates an unguessable, cryptographically secure 256-bit random session token
 */
export function generateSessionToken(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Computes the one-way SHA-256 hash of a session token for secure server-side storage
 */
export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token.trim()).digest('hex');
}

/**
 * Sets the secure, HttpOnly session cookie on a NextResponse
 */
export function setSessionCookie(
  res: NextResponse,
  token: string,
  maxAgeSec: number = SESSION_ABSOLUTE_LIFETIME_SEC
): void {
  const isProduction = process.env.NODE_ENV === 'production';
  res.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: maxAgeSec,
  });
}

/**
 * Clears the session cookie on a NextResponse
 */
export function clearSessionCookie(res: NextResponse): void {
  res.cookies.set(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
    expires: new Date(0),
  });
}

/**
 * Extracts the raw session token from a NextRequest or standard Request
 */
export function extractSessionToken(req: NextRequest | Request): string | null {
  if ('cookies' in req && typeof (req as any).cookies?.get === 'function') {
    const cookie = (req as NextRequest).cookies.get(SESSION_COOKIE_NAME);
    if (cookie?.value) return cookie.value;
  }

  // Fallback to manual parsing from Cookie header
  const cookieHeader = req.headers.get('cookie') || '';
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE_NAME}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Validates Origin / Referer for CSRF prevention on state-changing requests
 */
export function validateCsrfOrigin(req: NextRequest | Request): { valid: boolean; reason?: string } {
  // Safe methods do not require origin check
  const method = req.method.toUpperCase();
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    return { valid: true };
  }

  const origin = req.headers.get('origin');
  const referer = req.headers.get('referer');
  const host = req.headers.get('host');

  // If neither origin nor referer is provided, permit same-origin local/test scripts or reject in production
  if (!origin && !referer) {
    if (process.env.NODE_ENV === 'production') {
      return {
        valid: false,
        reason: 'Missing Origin and Referer headers on state-changing request in production.',
      };
    }
    return { valid: true };
  }

  const checkUrl = origin || referer;
  if (!checkUrl) return { valid: true };

  try {
    const parsed = new URL(checkUrl);
    const originHost = parsed.host;

    // Check host match
    if (host && (originHost === host || originHost.toLowerCase() === host.toLowerCase())) {
      return { valid: true };
    }

    // Check against configured APP_URL
    if (process.env.APP_URL) {
      const appUrlHost = new URL(process.env.APP_URL).host;
      if (originHost.toLowerCase() === appUrlHost.toLowerCase()) {
        return { valid: true };
      }
    }

    // Default localhost development hosts
    if (
      originHost.startsWith('localhost:') ||
      originHost.startsWith('127.0.0.1:') ||
      originHost.startsWith('0.0.0.0:')
    ) {
      return { valid: true };
    }

    return {
      valid: false,
      reason: `Untrusted request origin "${origin || referer}". Mutation rejected by CSRF protection.`,
    };
  } catch {
    return { valid: false, reason: 'Malformed Origin or Referer header.' };
  }
}

/**
 * Authenticates the current HTTP request by verifying the session cookie against the persistent store
 */
export async function authenticateRequest(
  req: NextRequest | Request
): Promise<SessionAuthResult> {
  // 1. Enforce CSRF check on mutating requests
  const csrfCheck = validateCsrfOrigin(req);
  if (!csrfCheck.valid) {
    return {
      authenticated: false,
      user: null,
      session: null,
      error: csrfCheck.reason || 'CSRF validation failed',
      statusCode: 403,
    };
  }

  // 2. Extract session token from cookie
  const rawToken = extractSessionToken(req);
  if (!rawToken) {
    return {
      authenticated: false,
      user: null,
      session: null,
      error: 'Authentication required. No session cookie provided.',
      statusCode: 401,
    };
  }

  // 3. Hash token and lookup persistent session record
  const tokenHash = hashSessionToken(rawToken);
  const result = moiDb.getSessionByTokenHash(tokenHash);
  if (!result || result.status !== 'valid' || !result.user || !result.session) {
    const errorMsg =
      result?.status === 'expired'
        ? 'Session expired due to inactivity or lifetime expiration.'
        : result?.status === 'revoked'
        ? 'Session has been revoked.'
        : 'Session not found or expired';
    return {
      authenticated: false,
      user: null,
      session: null,
      error: errorMsg,
      statusCode: 401,
    };
  }

  return {
    authenticated: true,
    user: result.user,
    session: result.session,
  };
}
