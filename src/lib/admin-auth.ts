/**
 * Server-side admin authentication
 * HMAC-signed cookie sessions — no external dependencies
 */

import crypto from 'crypto';

const COOKIE_NAME = 'admin_session';
const SESSION_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

function getSecret(): string {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) throw new Error('ADMIN_SESSION_SECRET not configured');
  return secret;
}

interface SessionPayload {
  authenticated: boolean;
  expiresAt: number;
}

function sign(payload: SessionPayload): string {
  const data = JSON.stringify(payload);
  const hmac = crypto.createHmac('sha256', getSecret()).update(data).digest('hex');
  return Buffer.from(JSON.stringify({ data, hmac })).toString('base64');
}

function verify(token: string): SessionPayload | null {
  try {
    const { data, hmac } = JSON.parse(Buffer.from(token, 'base64').toString());
    const expectedHmac = crypto.createHmac('sha256', getSecret()).update(data).digest('hex');

    if (!crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(expectedHmac))) {
      return null;
    }

    const payload: SessionPayload = JSON.parse(data);
    if (Date.now() > payload.expiresAt) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export function verifyAdminPassword(password: string): boolean {
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) return false;

  const a = Buffer.from(password);
  const b = Buffer.from(adminPassword);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function createSessionCookie(): { name: string; value: string; options: Record<string, unknown> } {
  const payload: SessionPayload = {
    authenticated: true,
    expiresAt: Date.now() + SESSION_DURATION_MS,
  };

  return {
    name: COOKIE_NAME,
    value: sign(payload),
    options: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      path: '/',
      maxAge: SESSION_DURATION_MS / 1000,
    },
  };
}

export function verifySessionFromCookie(cookieValue: string | undefined): boolean {
  if (!cookieValue) return false;
  const payload = verify(cookieValue);
  return payload?.authenticated === true;
}

export function getAdminCookieName(): string {
  return COOKIE_NAME;
}
