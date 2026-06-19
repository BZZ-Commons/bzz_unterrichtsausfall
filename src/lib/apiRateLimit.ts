import { createRateLimiter, getClientIp, rateLimitResponse } from '@/src/lib/mcp/rateLimiter';

/**
 * Per-IP Rate-Limit für die öffentlichen REST-Routes. Schützt v.a. den
 * geteilten WebUntis-Service-Account: ein Loop-Skript darf den Account nicht
 * in dessen eigenes 429/ECONNRESET-Limit treiben und so die App für alle
 * lahmlegen. 60/min ist großzügig genug für normales Durchklicken der UI
 * (Klassenwahl + Tages-Dialoge), bremst aber Missbrauch hart aus.
 *
 * Ein einziger, geteilter Limiter über alle Routes deckelt das Gesamt-Budget
 * pro IP, egal über welchen Endpoint gefeuert wird.
 *
 * In-Memory / Single-Process — passt zum Docker-Standalone-Deployment
 * (gleiche Annahme wie der MCP-Limiter und serverCache).
 */
const apiLimiter = createRateLimiter({ limit: 60, windowMs: 60_000 });

/**
 * Wrap a route handler so it's rate-limited per IP: an over-budget caller gets a
 * 429 before the handler runs. Keeps the guard in one place instead of repeating
 * it at the top of every route.
 */
export function withRateLimit(
  handler: (req: Request) => Promise<Response>,
): (req: Request) => Promise<Response> {
  return async (req) => {
    const { allowed, retryAfterSec } = apiLimiter.check(getClientIp(req));
    if (!allowed) return rateLimitResponse(retryAfterSec);
    return handler(req);
  };
}
