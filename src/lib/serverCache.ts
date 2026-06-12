/**
 * Tiny in-process, module-level cache with TTL and in-flight dedup.
 *
 * The aggregated calendar fetch (`/api/calendar-data-all`) walks every class
 * timetable and takes 30–60s. Without server caching, every fresh visitor
 * re-pays that cost. Deployment is a SINGLE-PROCESS Docker standalone build
 * (next.config.ts `output: 'standalone'`), so a module-level cache is shared by
 * all requests of the running server — no external cache store needed.
 *
 * Guarantees:
 *  - cached values are served until their TTL elapses;
 *  - concurrent callers for the same key share ONE underlying fetch (dedup);
 *  - a rejected fetch is NOT cached — the next caller retries.
 *
 * Dependency-free; an injectable `now` clock keeps it unit-testable.
 */

interface CacheEntry<T> {
  /** Resolved value + the time it was stored — only set once the fetch succeeds. */
  value?: { data: T; storedAt: number };
  /** In-flight fetch promise, present while a fetch is running. */
  inFlight?: Promise<T>;
}

const cache = new Map<string, CacheEntry<unknown>>();

/**
 * Return the cached value for `key` if it is still within `ttlMs`; otherwise run
 * `fn`, cache its resolved value, and return it. Concurrent calls for the same
 * key during an in-flight fetch share that single promise.
 *
 * @param now Injectable clock (defaults to `Date.now`) — for deterministic tests.
 */
export async function getCached<T>(
  key: string,
  ttlMs: number,
  fn: () => Promise<T>,
  now: () => number = Date.now,
): Promise<T> {
  const entry = (cache.get(key) as CacheEntry<T> | undefined) ?? {};

  // Fresh cached value → serve it.
  if (entry.value && now() - entry.value.storedAt < ttlMs) {
    return entry.value.data;
  }

  // A fetch is already running for this key → join it.
  if (entry.inFlight) {
    return entry.inFlight;
  }

  const promise = fn()
    .then((data) => {
      // Store the value and clear the in-flight marker on success.
      cache.set(key, { value: { data, storedAt: now() } });
      return data;
    })
    .catch((err) => {
      // Do NOT cache failures — drop the in-flight entry so the next call retries.
      const current = cache.get(key) as CacheEntry<T> | undefined;
      if (current?.inFlight === promise) {
        cache.delete(key);
      }
      throw err;
    });

  // Keep any still-valid stale value around while the refresh runs; record the
  // in-flight promise so concurrent callers dedup onto it.
  cache.set(key, { value: entry.value, inFlight: promise });
  return promise;
}

/** Clear the entire cache. Intended for tests. */
export function clearCache(): void {
  cache.clear();
}
