/**
 * In-memory counter for MCP requests over a rolling window.
 *
 * Counts every request hitting the `/api/mcp` endpoint (including rate-limited
 * ones) in per-minute buckets, so the footer badge can show "MCP-Anfragen der
 * letzten 15 Minuten". Single-process Docker deployment — see serverCache.ts
 * for why module-level state is safe here.
 *
 * The bucket map lives on `globalThis` (unlike serverCache, this state is
 * shared across TWO route bundles — `/api/mcp` writes, `/api/mcp-stats` reads —
 * and must also survive dev-mode HMR re-instantiation).
 *
 * Dependency-free; an injectable `now` keeps it unit-testable.
 */

const WINDOW_MINUTES = 15;

const globalState = globalThis as unknown as { __mcpRequestBuckets?: Map<number, number> };
const buckets = (globalState.__mcpRequestBuckets ??= new Map<number, number>());

/** Record one MCP request at time `now` (ms epoch). Prunes expired buckets. */
export function recordMcpRequest(now: number = Date.now()): void {
  const minute = Math.floor(now / 60_000);
  buckets.set(minute, (buckets.get(minute) ?? 0) + 1);
  for (const key of buckets.keys()) {
    if (key < minute - WINDOW_MINUTES) buckets.delete(key);
  }
}

/** Number of MCP requests recorded within the last 15 minutes (minute granularity). */
export function getMcpRequestCount(now: number = Date.now()): number {
  const cutoffMinute = Math.floor(now / 60_000) - WINDOW_MINUTES;
  let total = 0;
  for (const [minute, count] of buckets) {
    if (minute > cutoffMinute) total += count;
  }
  return total;
}

/** Clear all recorded requests. Intended for tests. */
export function resetMcpRequestStats(): void {
  buckets.clear();
}
