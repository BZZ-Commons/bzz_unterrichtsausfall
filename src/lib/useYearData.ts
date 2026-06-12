import { useCallback, useEffect, useRef, useState } from 'react';
import type { ViewMode } from '@/components/ViewToggle';
import type { SchoolPeriod, SchoolYearSummary, UntisClass } from '@/src/types';
import { fetchJson, isAbortError } from '@/src/lib/fetchJson';
import { findSchoolYearByShort, findDefaultSchoolYear } from '@/src/lib/schoolYear';

interface YearDataArgs {
  /** Captures the deep-link URL params (class/companion/view) into refs and
   *  returns the `schoolyear` short form + whether `?details` was present.
   *  Called once from the bootstrap, BEFORE any fetch. */
  captureUrlParams: () => { urlYearShort: string | null; detailsRequested: boolean };
  /** Turns on details mode when the bootstrap sees `?details`. */
  setDetailsMode: (on: boolean) => void;
  /** Aborts + resets the calendar and aggregated concerns on a year switch. */
  onYearSwitch: () => void;
  /** Re-fetches the aggregated view for the new year (only when viewMode==='all'). */
  loadAggregated: (yearId: number) => void;
  /** Current view mode — decides whether a year switch refetches aggregated. */
  viewMode: ViewMode;
}

/**
 * Owns the school-year axis: the year list, the selected year, the classes and
 * school periods for that year, and the StrictMode-safe bootstrap.
 *
 * State owned: `schoolYears`, `selectedSchoolYearId`, `classes` (+loading/error),
 * `periods`.
 *
 * Invariants:
 *  - Bootstrap creates ONE AbortController (`classesAbortRef`) shared by the
 *    schoolyears fetch and the initial year-data load, aborted on cleanup —
 *    StrictMode double-mount safe. URL params are captured into the deep-link
 *    refs (via `captureUrlParams`) before any fetch starts.
 *  - The URL `?schoolyear=` wins if it resolves to a known year; else the
 *    current/first year is the default.
 *  - `loadPeriods` serves from `sessionStorage` under `school-periods-{yearId}`
 *    and caches the response there.
 *  - `loadClassesForYear` uses the bootstrap controller; aborted requests never
 *    write state or clear loading (`if (signal.aborted)` guards), AbortError is
 *    swallowed.
 *  - `handleSchoolYearChange` aborts all three concerns (its own classes
 *    controller plus calendar+aggregated via `onYearSwitch`), clears single +
 *    aggregated state, reloads year data, and refetches aggregated only when
 *    `viewMode==='all'`.
 */
export function useYearData({
  captureUrlParams,
  setDetailsMode,
  onYearSwitch,
  loadAggregated,
  viewMode,
}: YearDataArgs) {
  const [schoolYears, setSchoolYears] = useState<SchoolYearSummary[]>([]);
  const [selectedSchoolYearId, setSelectedSchoolYearId] = useState<number | null>(null);

  const [classes, setClasses] = useState<UntisClass[]>([]);
  const [classesLoading, setClassesLoading] = useState(true);
  const [classesError, setClassesError] = useState<string | null>(null);

  // School periods (Q1–Q4, Semester 1/2) — fetched once per school year, cached in sessionStorage.
  const [periods, setPeriods] = useState<SchoolPeriod[]>([]);

  // Single in-flight controller — switching year mid-fetch aborts the previous request.
  const classesAbortRef = useRef<AbortController | null>(null);

  const loadClassesForYear = useCallback(async (id: number, signal: AbortSignal) => {
    setClassesLoading(true);
    setClassesError(null);
    try {
      const cls = await fetchJson<UntisClass[]>(`/api/classes?schoolyearId=${id}`, signal);
      if (signal.aborted) return;
      setClasses(cls);
    } catch (err) {
      if (isAbortError(err)) return;
      setClassesError(err instanceof Error ? err.message : 'Fehler beim Laden der Klassen');
    } finally {
      if (!signal.aborted) setClassesLoading(false);
    }
  }, []);

  const loadPeriods = useCallback(async (yearId: number, signal?: AbortSignal) => {
    const cacheKey = `school-periods-${yearId}`;
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      try {
        setPeriods(JSON.parse(cached) as SchoolPeriod[]);
        return;
      } catch {
        /* ignore */
      }
    }
    try {
      const data = await fetchJson<SchoolPeriod[]>(
        `/api/school-periods?schoolyearId=${yearId}`,
        signal,
      );
      if (signal?.aborted) return;
      sessionStorage.setItem(cacheKey, JSON.stringify(data));
      setPeriods(data);
    } catch (err) {
      if (!isAbortError(err)) setPeriods([]);
    }
  }, []);

  const loadYearData = useCallback(
    (yearId: number, signal: AbortSignal) =>
      Promise.all([loadClassesForYear(yearId, signal), loadPeriods(yearId, signal)]),
    [loadClassesForYear, loadPeriods],
  );

  // StrictMode-safe bootstrap (single AbortController shared with deep-link).
  useEffect(() => {
    const { urlYearShort, detailsRequested } = captureUrlParams();
    if (detailsRequested) setDetailsMode(true);
    const controller = new AbortController();
    classesAbortRef.current = controller;
    void (async () => {
      try {
        const years = await fetchJson<SchoolYearSummary[]>('/api/schoolyears', controller.signal);
        if (controller.signal.aborted) return;
        setSchoolYears(years);
        // Honour the URL year if it resolves to a known year; otherwise fall back to the default.
        const fromUrl = urlYearShort
          ? (findSchoolYearByShort(urlYearShort, years)?.id ?? null)
          : null;
        const yearId = fromUrl ?? findDefaultSchoolYear(years, Date.now())?.id ?? null;
        if (yearId == null) {
          setClassesLoading(false);
          return;
        }
        setSelectedSchoolYearId(yearId);
        await loadYearData(yearId, controller.signal);
      } catch (err) {
        if (isAbortError(err)) return;
        setClassesError(err instanceof Error ? err.message : 'Fehler beim Initialisieren');
        setClassesLoading(false);
      }
    })();
    return () => controller.abort();
    // Bootstrap runs once; its deps are all stable callbacks (match the
    // original effect that depended only on the equally-stable loader).
  }, [captureUrlParams, setDetailsMode, loadYearData]);

  const handleSchoolYearChange = useCallback(
    async (id: number) => {
      if (id === selectedSchoolYearId) return;
      classesAbortRef.current?.abort();
      onYearSwitch();
      const controller = new AbortController();
      classesAbortRef.current = controller;
      setSelectedSchoolYearId(id);
      await loadYearData(id, controller.signal);
      if (viewMode === 'all') void loadAggregated(id);
    },
    [selectedSchoolYearId, onYearSwitch, loadYearData, viewMode, loadAggregated],
  );

  return {
    schoolYears,
    selectedSchoolYearId,
    classes,
    classesLoading,
    classesError,
    periods,
    handleSchoolYearChange,
  };
}
