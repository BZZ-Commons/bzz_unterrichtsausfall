import { useCallback, useRef, useState } from 'react';
import type { AggregatedCalendarData } from '@/src/types';
import { fetchJson, isAbortError } from '@/src/lib/fetchJson';

/**
 * Owns the all-classes aggregated calendar fetch.
 *
 * State owned: the loaded `AggregatedCalendarData` and its loading/error flags.
 *
 * Invariants:
 *  - Serves from `sessionStorage` first under `calendar-data-all-v2-{yearId}`.
 *    The all-classes fetch is slow (30–60 s), so a cache hit short-circuits and
 *    NEVER starts a request. The `-v2` suffix invalidates pre-dedup caches.
 *  - One in-flight controller (`abortRef`): each fetch aborts the previous.
 *  - Aborted requests never write state or clear loading; AbortError is swallowed.
 *  - `loadAggregated(yearId?)` defaults to `selectedSchoolYearId`; callers pass
 *    an explicit id during a year switch where the prop hasn't re-rendered yet.
 *  - `reset()` clears data/error only (used on year switch); it does not abort.
 */
export function useAggregatedData(selectedSchoolYearId: number | null) {
  const [data, setData] = useState<AggregatedCalendarData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  const loadAggregated = useCallback(
    async (yearId?: number) => {
      const yId = yearId ?? selectedSchoolYearId;
      if (yId == null) return;

      // Serve from cache first — the all-classes fetch is slow (30–60 s).
      // The `-v2` suffix invalidates caches from before plan-group deduplication.
      const cacheKey = `calendar-data-all-v2-${yId}`;
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        try {
          setData(JSON.parse(cached) as AggregatedCalendarData);
          return;
        } catch {
          /* corrupted cache — fall through to fetch */
        }
      }

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setError(null);
      setLoading(true);
      try {
        const url = `/api/calendar-data-all?schoolyearId=${yId}`;
        const result = await fetchJson<AggregatedCalendarData>(url, controller.signal);
        if (controller.signal.aborted) return;
        try {
          sessionStorage.setItem(cacheKey, JSON.stringify(result));
        } catch {
          /* storage full — ignore */
        }
        setData(result);
      } catch (err) {
        if (isAbortError(err)) return;
        setError(err instanceof Error ? err.message : 'Fehler beim Laden der Gesamtübersicht');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    },
    [selectedSchoolYearId],
  );

  const abort = useCallback(() => abortRef.current?.abort(), []);

  const reset = useCallback(() => {
    setData(null);
    setError(null);
  }, []);

  return {
    aggregatedData: data,
    aggregatedLoading: loading,
    aggregatedError: error,
    loadAggregated,
    abort,
    reset,
  };
}
