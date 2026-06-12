import { describe, it, expect, afterEach, vi } from 'vitest';
import { createRateLimiter, getClientIp, isAdminKey } from '@/src/lib/mcp/rateLimiter';

// ─── createRateLimiter ────────────────────────────────────────────────────────

describe('createRateLimiter', () => {
  it('allows exactly `limit` requests within one window', () => {
    const limiter = createRateLimiter({ limit: 3, windowMs: 60_000 });
    const t0 = 1_000_000;

    expect(limiter.check('a', t0)).toEqual({ allowed: true, retryAfterSec: 0 });
    expect(limiter.check('a', t0 + 100)).toEqual({ allowed: true, retryAfterSec: 0 });
    expect(limiter.check('a', t0 + 200)).toEqual({ allowed: true, retryAfterSec: 0 });
  });

  it('rejects request limit+1 with retryAfterSec within (0, windowMs/1000]', () => {
    const limiter = createRateLimiter({ limit: 2, windowMs: 60_000 });
    const t0 = 1_000_000;
    limiter.check('a', t0);
    limiter.check('a', t0 + 1_000);

    const result = limiter.check('a', t0 + 2_000);

    expect(result.allowed).toBe(false);
    expect(result.retryAfterSec).toBeGreaterThan(0);
    expect(result.retryAfterSec).toBeLessThanOrEqual(60);
  });

  it('resets after the window elapses (request allowed again)', () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 60_000 });
    const t0 = 1_000_000;

    expect(limiter.check('a', t0).allowed).toBe(true);
    expect(limiter.check('a', t0 + 30_000).allowed).toBe(false);
    // Exactly windowMs later → new window starts.
    expect(limiter.check('a', t0 + 60_000).allowed).toBe(true);
  });

  it('isolates keys: exhausting A leaves B unaffected', () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 60_000 });
    const t0 = 1_000_000;

    expect(limiter.check('a', t0).allowed).toBe(true);
    expect(limiter.check('a', t0 + 1).allowed).toBe(false); // A exhausted
    expect(limiter.check('b', t0 + 2).allowed).toBe(true); // B still allowed
  });
});

// ─── getClientIp ──────────────────────────────────────────────────────────────

describe('getClientIp', () => {
  it('returns the first comma-separated x-forwarded-for entry, trimmed', () => {
    const req = new Request('http://x/', {
      headers: { 'x-forwarded-for': '1.2.3.4, 10.0.0.1' },
    });
    expect(getClientIp(req)).toBe('1.2.3.4');
  });

  it("falls back to 'unknown' when the header is missing", () => {
    expect(getClientIp(new Request('http://x/'))).toBe('unknown');
  });

  it("falls back to 'unknown' when the header is empty", () => {
    const req = new Request('http://x/', { headers: { 'x-forwarded-for': '' } });
    expect(getClientIp(req)).toBe('unknown');
  });
});

// ─── isAdminKey ───────────────────────────────────────────────────────────────

describe('isAdminKey', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns false when the env var is unset/empty, even when provided matches the empty string', () => {
    vi.stubEnv('MCP_ADMIN_KEY', '');
    expect(isAdminKey('')).toBe(false);
    expect(isAdminKey('anything')).toBe(false);
  });

  it('returns false for a wrong key', () => {
    vi.stubEnv('MCP_ADMIN_KEY', 'super-secret');
    expect(isAdminKey('wrong')).toBe(false);
    expect(isAdminKey('super-secret-but-longer')).toBe(false);
  });

  it('returns true for the exact key', () => {
    vi.stubEnv('MCP_ADMIN_KEY', 'super-secret');
    expect(isAdminKey('super-secret')).toBe(true);
  });

  it('returns false when provided is null', () => {
    vi.stubEnv('MCP_ADMIN_KEY', 'super-secret');
    expect(isAdminKey(null)).toBe(false);
  });
});
