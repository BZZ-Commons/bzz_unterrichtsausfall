import { useCallback, useRef, useState } from 'react';
import type { CalendarData } from '@/src/types';
import { fetchJson, isAbortError } from '@/src/lib/fetchJson';

/**
 * Owns the single-class calendar fetch for the selected school year.
 *
 * State owned: the loaded `CalendarData`, its loading/error flags, and the
 * `selectedFetchIds` (self + companion class IDs) of the class currently shown.
 *
 * Invariants:
 *  - One in-flight controller (`abortRef`): each `loadCalendar` aborts the
 *    previous request before starting a new one.
 *  - Aborted requests never write state or clear the loading flag — the
 *    `if (signal.aborted)` / `if (!signal.aborted)` guards enforce this, and an
 *    AbortError is swallowed silently.
 *  - `reset()` clears data/error and selection (used on year switch); it does
 *    NOT abort — callers that need to cancel in-flight work do so explicitly.
 */
export function useCalendarData(selectedSchoolYearId: number | null) {
  const [selectedFetchIds, setSelectedFetchIds] = useState<number[] | null>(null);
  const [data, setData] = useState<CalendarData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  const loadCalendar = useCallback(
    async (fetchIds: number[]) => {
      if (selectedSchoolYearId == null) return;
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setError(null);
      setLoading(true);
      try {
        const url = `/api/calendar-data?classIds=${fetchIds.join(',')}&schoolyearId=${selectedSchoolYearId}`;
        const result = await fetchJson<CalendarData>(url, controller.signal);
        if (controller.signal.aborted) return;
        setData(result);
      } catch (err) {
        if (isAbortError(err)) return;
        setError(err instanceof Error ? err.message : 'Fehler beim Laden des Kalenders');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    },
    [selectedSchoolYearId],
  );

  const abort = useCallback(() => abortRef.current?.abort(), []);

  const reset = useCallback(() => {
    setSelectedFetchIds(null);
    setData(null);
    setError(null);
  }, []);

  return {
    selectedFetchIds,
    setSelectedFetchIds,
    calendarData: data,
    calendarLoading: loading,
    calendarError: error,
    loadCalendar,
    abort,
    reset,
  };
}
