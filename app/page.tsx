'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { AlertCircle, Loader2, CalendarDays } from 'lucide-react';
import ClassSelector from '@/components/ClassSelector';
import SchoolYearCalendar from '@/components/SchoolYearCalendar';
import SchoolYearSelector from '@/components/SchoolYearSelector';
import CalendarLegend from '@/components/CalendarLegend';
import IAVariantDialog from '@/components/IAVariantDialog';
import ViewToggle, { type ViewMode } from '@/components/ViewToggle';
import AggregatedCalendar from '@/components/AggregatedCalendar';
import DayDetailsDialog from '@/components/DayDetailsDialog';
import ExportButton from '@/components/ExportButton';
import DetailsToggle from '@/components/DetailsToggle';
import { isIAClass, isMEClass, isIMClass, getIAVariants, normalize } from '@/src/lib/classGroups';
import { findSchoolYearByShort, schoolYearShort } from '@/src/lib/schoolYear';
import type {
  AggregatedCalendarData,
  AggregatedDay,
  CalendarData,
  SchoolPeriod,
  SchoolYearSummary,
  UntisClass,
} from '@/src/types';

async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal });
  if (!res.ok) {
    const body = await res.json() as { error?: string };
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

const isAbortError = (err: unknown): boolean =>
  err instanceof DOMException && err.name === 'AbortError';

function pickDefaultSchoolYearId(years: SchoolYearSummary[]): number | null {
  const today = Date.now();
  const current = years.find(
    (y) => new Date(y.startDate).getTime() <= today && today <= new Date(y.endDate).getTime(),
  );
  return current?.id ?? years[0]?.id ?? null;
}


export default function HomePage() {
  const [schoolYears, setSchoolYears] = useState<SchoolYearSummary[]>([]);
  const [selectedSchoolYearId, setSelectedSchoolYearId] = useState<number | null>(null);

  const [classes, setClasses] = useState<UntisClass[]>([]);
  const [classesLoading, setClassesLoading] = useState(true);
  const [classesError, setClassesError] = useState<string | null>(null);

  const [viewMode, setViewMode] = useState<ViewMode>('single');
  const [detailsMode, setDetailsMode] = useState(false);

  // School periods (Q1–Q4, Semester 1/2) — fetched once per school year, cached in sessionStorage
  const [periods, setPeriods] = useState<SchoolPeriod[]>([]);

  // ─── Single-class state ─────────────────────────────────────────────────────
  const [selectedFetchIds, setSelectedFetchIds] = useState<number[] | null>(null);
  const [calendarData, setCalendarData] = useState<CalendarData | null>(null);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [calendarError, setCalendarError] = useState<string | null>(null);
  const [iaDialogClass, setIaDialogClass] = useState<UntisClass | null>(null);

  // ─── Aggregated state ───────────────────────────────────────────────────────
  const [aggregatedData, setAggregatedData] = useState<AggregatedCalendarData | null>(null);
  const [aggregatedLoading, setAggregatedLoading] = useState(false);
  const [aggregatedError, setAggregatedError] = useState<string | null>(null);
  const [selectedAggregatedDay, setSelectedAggregatedDay] = useState<AggregatedDay | null>(null);

  // Deep-link from popup → preselect class on next single-mode load
  const pendingClassNameRef = useRef<string | null>(null);
  const pendingCompanionNameRef = useRef<string | null>(null);
  const pendingViewModeRef = useRef<string | null>(null);

  // Single in-flight controller per concern — switching mid-fetch aborts the previous request.
  const classesAbortRef = useRef<AbortController | null>(null);
  const calendarAbortRef = useRef<AbortController | null>(null);
  const aggregatedAbortRef = useRef<AbortController | null>(null);

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
      try { setPeriods(JSON.parse(cached) as SchoolPeriod[]); return; } catch { /* ignore */ }
    }
    try {
      const data = await fetchJson<SchoolPeriod[]>(`/api/school-periods?schoolyearId=${yearId}`, signal);
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
    const urlParams = new URLSearchParams(window.location.search);
    const getP = (k: string) => { const v = urlParams.get(k)?.trim(); return v?.length ? v : null; };
    pendingClassNameRef.current = getP('class');
    pendingCompanionNameRef.current = getP('companion');
    pendingViewModeRef.current = getP('view');
    if (getP('details') != null) setDetailsMode(true);
    const urlYearShort = getP('schoolyear');
    const controller = new AbortController();
    classesAbortRef.current = controller;
    void (async () => {
      try {
        const years = await fetchJson<SchoolYearSummary[]>('/api/schoolyears', controller.signal);
        if (controller.signal.aborted) return;
        setSchoolYears(years);
        // Honour the URL year if it resolves to a known year; otherwise fall back to the default.
        const fromUrl = urlYearShort ? findSchoolYearByShort(urlYearShort, years)?.id ?? null : null;
        const yearId = fromUrl ?? pickDefaultSchoolYearId(years);
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
  }, [loadClassesForYear]);

  const loadCalendar = useCallback(async (fetchIds: number[]) => {
    if (selectedSchoolYearId == null) return;
    calendarAbortRef.current?.abort();
    const controller = new AbortController();
    calendarAbortRef.current = controller;
    setCalendarError(null);
    setCalendarLoading(true);
    try {
      const url = `/api/calendar-data?classIds=${fetchIds.join(',')}&schoolyearId=${selectedSchoolYearId}`;
      const data = await fetchJson<CalendarData>(url, controller.signal);
      if (controller.signal.aborted) return;
      setCalendarData(data);
    } catch (err) {
      if (isAbortError(err)) return;
      setCalendarError(err instanceof Error ? err.message : 'Fehler beim Laden des Kalenders');
    } finally {
      if (!controller.signal.aborted) setCalendarLoading(false);
    }
  }, [selectedSchoolYearId]);

  const loadAggregated = useCallback(async (yearId?: number) => {
    const yId = yearId ?? selectedSchoolYearId;
    if (yId == null) return;

    // Serve from cache first — the all-classes fetch is slow (30–60 s).
    const cacheKey = `calendar-data-all-${yId}`;
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      try {
        setAggregatedData(JSON.parse(cached) as AggregatedCalendarData);
        return;
      } catch { /* corrupted cache — fall through to fetch */ }
    }

    aggregatedAbortRef.current?.abort();
    const controller = new AbortController();
    aggregatedAbortRef.current = controller;
    setAggregatedError(null);
    setAggregatedLoading(true);
    try {
      const url = `/api/calendar-data-all?schoolyearId=${yId}`;
      const data = await fetchJson<AggregatedCalendarData>(url, controller.signal);
      if (controller.signal.aborted) return;
      try { sessionStorage.setItem(cacheKey, JSON.stringify(data)); } catch { /* storage full — ignore */ }
      setAggregatedData(data);
    } catch (err) {
      if (isAbortError(err)) return;
      setAggregatedError(err instanceof Error ? err.message : 'Fehler beim Laden der Gesamtübersicht');
    } finally {
      if (!controller.signal.aborted) setAggregatedLoading(false);
    }
  }, [selectedSchoolYearId]);

  const handleSchoolYearChange = useCallback(async (id: number) => {
    if (id === selectedSchoolYearId) return;
    classesAbortRef.current?.abort();
    calendarAbortRef.current?.abort();
    aggregatedAbortRef.current?.abort();
    const controller = new AbortController();
    classesAbortRef.current = controller;
    setSelectedSchoolYearId(id);
    setSelectedFetchIds(null);
    setCalendarData(null);
    setCalendarError(null);
    setAggregatedData(null);
    setAggregatedError(null);
    setIaDialogClass(null);
    setSelectedAggregatedDay(null);
    await loadYearData(id, controller.signal);
    if (viewMode === 'all') void loadAggregated(id);
  }, [selectedSchoolYearId, loadYearData, viewMode, loadAggregated]);

  const handleClassChange = useCallback((id: number) => {
    const cls = classes.find((c) => c.id === id);
    if (!cls) return;

    // IA classes whose companion was NOT auto-resolved server-side need the dialog.
    // (Years where IA a/b/c all exist resolve unambiguously and skip it.)
    const unresolvedIA = isIAClass(cls.name) && (cls.fetchIds?.length ?? 0) < 2;
    if (unresolvedIA) {
      setIaDialogClass(cls);
      return;
    }

    const fetchIds = cls.fetchIds ?? [id];
    setSelectedFetchIds(fetchIds);
    void loadCalendar(fetchIds);
  }, [classes, loadCalendar]);

  const handleIAVariantPick = useCallback((companion: UntisClass) => {
    const cls = iaDialogClass;
    if (!cls) return;
    setIaDialogClass(null);
    const fetchIds = [cls.id, companion.id];
    setSelectedFetchIds(fetchIds);
    void loadCalendar(fetchIds);
  }, [iaDialogClass, loadCalendar]);

  const handleViewModeChange = useCallback((mode: ViewMode) => {
    if (mode === viewMode) return;
    setViewMode(mode);
    if (mode === 'all' && aggregatedData == null && !aggregatedLoading) {
      void loadAggregated();
    }
  }, [viewMode, aggregatedData, aggregatedLoading, loadAggregated]);

  // Once classes are loaded, consume any pending deep-link exactly once.
  useEffect(() => {
    if (classes.length === 0) return;

    // ?view=all takes precedence over ?class=
    if (pendingViewModeRef.current === 'all') {
      pendingViewModeRef.current = null;
      pendingClassNameRef.current = null;
      pendingCompanionNameRef.current = null;
      setViewMode('all');
      void loadAggregated();
      return;
    }

    const name = pendingClassNameRef.current;
    if (!name) return;
    const target = normalize(name);
    const match = classes.find((c) => normalize(c.name) === target);
    pendingClassNameRef.current = null;
    if (!match) {
      pendingCompanionNameRef.current = null;
      return;
    }
    setViewMode('single');
    // If the URL also carried a companion, resolve it directly (skipping the IA dialog).
    const unresolvedIA = isIAClass(match.name) && (match.fetchIds?.length ?? 0) < 2;
    const companionName = pendingCompanionNameRef.current;
    pendingCompanionNameRef.current = null;
    if (unresolvedIA && companionName) {
      const companionTarget = normalize(companionName);
      const companion = classes.find((c) => normalize(c.name) === companionTarget);
      if (companion) {
        const fetchIds = [match.id, companion.id];
        setSelectedFetchIds(fetchIds);
        void loadCalendar(fetchIds);
        return;
      }
    }
    handleClassChange(match.id);
  }, [classes, handleClassChange, loadCalendar, loadAggregated]);

  const selectedClassId = selectedFetchIds?.[0] ?? null;
  const selectedClass = selectedClassId != null
    ? classes.find((c) => c.id === selectedClassId)
    : undefined;

  const selectedSchoolYearShort = useMemo(() => {
    if (selectedSchoolYearId == null) return null;
    const year = schoolYears.find((y) => y.id === selectedSchoolYearId);
    return year ? schoolYearShort(year) : null;
  }, [schoolYears, selectedSchoolYearId]);

  // Only surface a companion in the header for single-companion merges (length 2).
  // Multi-companion classes (e.g. AB c → IA a+b) fall back to longName.
  const selectedCompanion = selectedFetchIds?.length === 2
    ? classes.find((c) => c.id === selectedFetchIds[1])
    : null;

  // Sync URL with current state so it stays shareable / copy-pasteable.
  // Skip while a deep-link is still pending to avoid briefly dropping `?class=`.
  const selectedClassName = selectedClass?.name ?? null;
  useEffect(() => {
    if (typeof window === 'undefined' || selectedSchoolYearShort == null) return;
    if (pendingClassNameRef.current != null) return;
    const params = new URLSearchParams();
    params.set('schoolyear', selectedSchoolYearShort);
    if (detailsMode) params.set('details', 'true');
    if (viewMode === 'all') {
      params.set('view', 'all');
    } else if (selectedClassName) {
      params.set('class', selectedClassName);
      if (selectedCompanion?.name) {
        params.set('companion', selectedCompanion.name);
      }
    }
    const next = `${window.location.pathname}?${params.toString()}`;
    if (next !== window.location.pathname + window.location.search) {
      window.history.replaceState(null, '', next);
    }
  }, [selectedSchoolYearShort, selectedClassName, selectedCompanion?.name, viewMode, detailsMode]);
  const subtitle = selectedCompanion ? `+ ${selectedCompanion.name}` : selectedClass?.longName;

  const iaVariants = useMemo(
    () => (iaDialogClass ? getIAVariants(iaDialogClass.name, classes) : null),
    [iaDialogClass, classes],
  );

  const showSingleEmptyState =
    viewMode === 'single' && !selectedClassId && !calendarLoading;
  const showSingleCalendar =
    viewMode === 'single' && calendarData && !calendarLoading && selectedClassId != null;
  const showAggregatedCalendar =
    viewMode === 'all' && aggregatedData && !aggregatedLoading;
  const showAggregatedLoading = viewMode === 'all' && aggregatedLoading;
  const showSingleLoading = viewMode === 'single' && calendarLoading;
  const showSingleError = viewMode === 'single' && calendarError && !calendarLoading;
  const showAggregatedError = viewMode === 'all' && aggregatedError && !aggregatedLoading;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/40 to-slate-100">
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-5 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
              <CalendarDays className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 leading-tight">
                Unterrichtsausfälle
              </h1>
              <p className="text-xs text-slate-500">BZZ Bildungszentrum Zürichsee</p>
            </div>
          </div>

          <div className="sm:ml-auto flex flex-col sm:flex-row sm:items-center gap-3">
            {schoolYears.length >= 2 && (
              <SchoolYearSelector
                schoolYears={schoolYears}
                selectedId={selectedSchoolYearId}
                onChange={handleSchoolYearChange}
              />
            )}
            {viewMode === 'single' && (
              classesError ? (
                <p className="text-sm text-red-600 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" />
                  {classesError}
                </p>
              ) : (
                <ClassSelector
                  classes={classes}
                  selectedId={selectedClassId}
                  onChange={handleClassChange}
                  loading={classesLoading}
                />
              )
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-6 flex justify-center sm:justify-start">
          <ViewToggle value={viewMode} onChange={handleViewModeChange} />
        </div>

        {showSingleEmptyState && (
          <div className="text-center py-24">
            <div className="w-16 h-16 rounded-2xl bg-indigo-100 flex items-center justify-center mx-auto mb-4">
              <CalendarDays className="w-8 h-8 text-indigo-400" />
            </div>
            <h2 className="text-lg font-semibold text-slate-700 mb-1">
              Klasse auswählen
            </h2>
            <p className="text-sm text-slate-500 max-w-sm mx-auto">
              Wählen Sie oben eine Klasse aus, um den Schuljahreskalender mit allen Ausfällen anzuzeigen.
            </p>
          </div>
        )}

        {(showSingleLoading || showAggregatedLoading) && (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
            <p className="text-sm text-slate-500">
              {viewMode === 'all'
                ? 'Lade Stundenpläne aller Klassen — das kann einen Moment dauern …'
                : 'Lade Stundenplan für das gesamte Schuljahr …'}
            </p>
          </div>
        )}

        {showSingleError && (
          <div className="max-w-lg mx-auto mt-8 p-5 bg-red-50 border border-red-200 rounded-xl flex gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-800">Fehler beim Laden</p>
              <p className="text-sm text-red-600 mt-0.5">{calendarError}</p>
            </div>
          </div>
        )}

        {showAggregatedError && (
          <div className="max-w-lg mx-auto mt-8 p-5 bg-red-50 border border-red-200 rounded-xl flex gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-800">Fehler beim Laden</p>
              <p className="text-sm text-red-600 mt-0.5">{aggregatedError}</p>
            </div>
          </div>
        )}

        {showSingleCalendar && calendarData && selectedClassId != null && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6 pb-4 border-b border-slate-100">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  {selectedClass?.name}
                  {subtitle && (
                    <span className="ml-2 text-sm font-normal text-slate-500">{subtitle}</span>
                  )}
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Schuljahr {calendarData.schoolYear.name}
                </p>
              </div>
              <div className="sm:ml-auto flex flex-wrap items-center gap-3">
                <DetailsToggle checked={detailsMode} onChange={setDetailsMode} />
                <ExportButton
                  days={calendarData.days}
                  className={selectedClass?.name ?? ''}
                  schoolYearName={calendarData.schoolYear.name}
                  detailsMode={detailsMode}
                />
                <CalendarLegend variant="single" detailsMode={detailsMode} />
              </div>
            </div>

            <SchoolYearCalendar
              days={calendarData.days}
              schoolYearName={calendarData.schoolYear.name}
              classId={selectedClassId}
              detailsMode={detailsMode}
              periods={periods}
              showQuarterDividers={
                isIAClass(selectedClass?.name ?? '') ||
                isMEClass(selectedClass?.name ?? '') ||
                isIMClass(selectedClass?.name ?? '')
              }
            />
          </div>
        )}

        {showAggregatedCalendar && aggregatedData && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6 pb-4 border-b border-slate-100">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Alle Klassen — Gesamtübersicht
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Schuljahr {aggregatedData.schoolYear.name}
                </p>
              </div>
              <div className="sm:ml-auto">
                <CalendarLegend variant="aggregated" />
              </div>
            </div>

            <AggregatedCalendar
              days={aggregatedData.days}
              schoolYearName={aggregatedData.schoolYear.name}
              onDaySelect={setSelectedAggregatedDay}
              periods={periods}
            />
          </div>
        )}
      </main>

      {iaDialogClass && iaVariants && (
        <IAVariantDialog
          iaClass={iaDialogClass}
          bm={iaVariants.bm}
          abu={iaVariants.abu}
          onPick={handleIAVariantPick}
          onCancel={() => setIaDialogClass(null)}
        />
      )}

      {selectedAggregatedDay && aggregatedData && (
        <DayDetailsDialog
          day={selectedAggregatedDay}
          schoolYearShort={schoolYearShort(aggregatedData.schoolYear)}
          onClose={() => setSelectedAggregatedDay(null)}
        />
      )}
    </div>
  );
}
