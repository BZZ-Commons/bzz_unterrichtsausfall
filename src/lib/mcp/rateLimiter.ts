/**
 * Fixed-window rate limiting + request-auth helpers for the MCP endpoint.
 *
 * Deployment is a SINGLE-PROCESS Docker standalone build (see serverCache.ts),
 * so a module-level limiter is shared by all requests of the running server —
 * no external store needed.
 *
 * Dependency-free; an injectable `now` parameter keeps it unit-testable.
 */

import { createHash, timingSafeEqual } from 'node:crypto';

export interface RateLimitResult {
  allowed: boolean;
  /** Seconds until the current window ends — 0 when the request is allowed. */
  retryAfterSec: number;
}

export interface RateLimiter {
  /** Count one request for `key`. @param now Injectable clock (ms) — for deterministic tests. */
  check(key: string, now?: number): RateLimitResult;
}

/** Above this many tracked keys, expired windows are pruned opportunistically. */
const PRUNE_THRESHOLD = 1000;

/**
 * Create a fixed-window rate limiter: at most `limit` requests per `windowMs`
 * per key. The first request of a key (or the first after its window elapsed)
 * starts a fresh window.
 */
export function createRateLimiter(opts: { limit: number; windowMs: number }): RateLimiter {
  const { limit, windowMs } = opts;
  const buckets = new Map<string, { windowStart: number; count: number }>();

  /** Drop expired windows once the map grows large — prevents unbounded growth from IP churn. */
  const prune = (now: number): void => {
    if (buckets.size <= PRUNE_THRESHOLD) return;
    for (const [key, bucket] of buckets) {
      if (now - bucket.windowStart >= windowMs) buckets.delete(key);
    }
  };

  return {
    check(key: string, now: number = Date.now()): RateLimitResult {
      prune(now);

      const bucket = buckets.get(key);

      // No bucket yet, or its window elapsed → start a fresh window.
      if (!bucket || now - bucket.windowStart >= windowMs) {
        buckets.set(key, { windowStart: now, count: 1 });
        return { allowed: true, retryAfterSec: 0 };
      }

      bucket.count += 1;
      if (bucket.count <= limit) {
        return { allowed: true, retryAfterSec: 0 };
      }
      return {
        allowed: false,
        retryAfterSec: Math.max(0, Math.ceil((bucket.windowStart + windowMs - now) / 1000)),
      };
    },
  };
}

/** Shared limiter for the MCP endpoint: 20 requests per client per minute. */
export const mcpRateLimiter: RateLimiter = createRateLimiter({ limit: 20, windowMs: 60_000 });

/** Standard 429 response for a rate-limited caller (shared by MCP + REST routes). */
export function rateLimitResponse(retryAfterSec: number): Response {
  return new Response(
    JSON.stringify({ error: 'Zu viele Anfragen. Bitte warte eine Minute und versuche es erneut.' }),
    {
      status: 429,
      headers: { 'Content-Type': 'application/json', 'Retry-After': String(retryAfterSec) },
    },
  );
}

/**
 * Client IP from the `x-forwarded-for` header (first comma-separated entry).
 * Falls back to 'unknown' when missing/empty — local dev then shares a single
 * bucket, which is acceptable.
 */
export function getClientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  const first = forwarded?.split(',')[0]?.trim();
  return first || 'unknown';
}

/**
 * Constant-time comparison of `provided` against `process.env.MCP_ADMIN_KEY`.
 * Returns false when the env var is unset/empty or `provided` is null/empty.
 * Both sides are SHA-256-hashed first, which equalizes lengths so
 * `timingSafeEqual` never throws.
 */
export function isAdminKey(provided: string | null): boolean {
  const expected = process.env.MCP_ADMIN_KEY;
  if (!expected || !provided) return false;
  return timingSafeEqual(
    createHash('sha256').update(provided).digest(),
    createHash('sha256').update(expected).digest(),
  );
}
