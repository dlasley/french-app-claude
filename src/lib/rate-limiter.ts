/**
 * In-memory sliding window rate limiter
 * Sufficient for classroom-scale apps on Vercel (per-instance limiting)
 */

const store = new Map<string, number[]>();

const CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes
let lastCleanup = Date.now();

function cleanup(windowMs: number) {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;

  for (const [key, timestamps] of store) {
    const filtered = timestamps.filter(t => now - t < windowMs);
    if (filtered.length === 0) {
      store.delete(key);
    } else {
      store.set(key, filtered);
    }
  }
}

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

export function checkRateLimit(key: string, config: RateLimitConfig): RateLimitResult {
  const now = Date.now();
  cleanup(config.windowMs);

  let timestamps = store.get(key);
  if (!timestamps) {
    timestamps = [];
    store.set(key, timestamps);
  }

  // Remove timestamps outside the window
  const filtered = timestamps.filter(t => now - t < config.windowMs);
  store.set(key, filtered);

  if (filtered.length >= config.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: filtered[0] + config.windowMs,
    };
  }

  filtered.push(now);
  return {
    allowed: true,
    remaining: config.maxRequests - filtered.length,
    resetAt: now + config.windowMs,
  };
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return '127.0.0.1';
}
