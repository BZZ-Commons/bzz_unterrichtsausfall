'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { AlertCircle, Loader2, CalendarDays } from 'lucide-react';
import ClassSelector from '@/components/ClassSelector';
import SchoolYearCalendar from '@/components/SchoolYearCalendar';
import SchoolYearSelector from '@/components/SchoolYearSelector';
import CalendarLegend from '@/components/CalendarLegend';
import IAVariantDialog from '@/components/IAVariantDialog';
import { isIAClass, getIAVariants } from '@/src/lib/classGroups';
import type { CalendarData, SchoolYearSummary, UntisClass } from '@/src/types';

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

  // First entry = primary class; second = picked / auto-resolved companion (if any)
  const [selectedFetchIds, setSelectedFetchIds] = useState<number[] | null>(null);
  const [calendarData, setCalendarData] = useState<CalendarData | null>(null);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [calendarError, setCalendarError] = useState<string | null>(null);

  const [iaDialogClass, setIaDialogClass] = useState<UntisClass | null>(null);

  // Single in-flight controller per concern — switching mid-fetch aborts the previous request.
  const classesAbortRef = useRef<AbortController | null>(null);
  const calendarAbortRef = useRef<AbortController | null>(null);

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

  // StrictMode-safe bootstrap: sequential because /api/classes needs the resolved year ID.
  useEffect(() => {
    const controller = new AbortController();
    classesAbortRef.current = controller;
    void (async () => {
      try {
        const years = await fetchJson<SchoolYearSummary[]>('/api/schoolyears', controller.signal);
        if (controller.signal.aborted) return;
        setSchoolYears(years);
        const defaultId = pickDefaultSchoolYearId(years);
        if (defaultId == null) {
          setClassesLoading(false);
          return;
        }
        setSelectedSchoolYearId(defaultId);
        await loadClassesForYear(defaultId, controller.signal);
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

  const handleSchoolYearChange = useCallback(async (id: number) => {
    if (id === selectedSchoolYearId) return;
    classesAbortRef.current?.abort();
    calendarAbortRef.current?.abort();
    const controller = new AbortController();
    classesAbortRef.current = controller;
    setSelectedSchoolYearId(id);
    setSelectedFetchIds(null);
    setCalendarData(null);
    setCalendarError(null);
    setIaDialogClass(null);
    await loadClassesForYear(id, controller.signal);
  }, [selectedSchoolYearId, loadClassesForYear]);

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

  const selectedClassId = selectedFetchIds?.[0] ?? null;
  const selectedClass = selectedClassId != null
    ? classes.find((c) => c.id === selectedClassId)
    : undefined;
  // Only surface a companion in the header for single-companion merges (length 2).
  // Multi-companion classes (e.g. AB c → IA a+b) fall back to longName.
  const selectedCompanion = selectedFetchIds?.length === 2
    ? classes.find((c) => c.id === selectedFetchIds[1])
    : null;
  const subtitle = selectedCompanion ? `+ ${selectedCompanion.name}` : selectedClass?.longName;

  const iaVariants = useMemo(
    () => (iaDialogClass ? getIAVariants(iaDialogClass.name, classes) : null),
    [iaDialogClass, classes],
  );

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
                Schulausfälle
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
            {classesError ? (
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
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {!selectedClassId && !calendarLoading && (
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

        {calendarLoading && (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
            <p className="text-sm text-slate-500">
              Lade Stundenplan für das gesamte Schuljahr …
            </p>
          </div>
        )}

        {calendarError && !calendarLoading && (
          <div className="max-w-lg mx-auto mt-8 p-5 bg-red-50 border border-red-200 rounded-xl flex gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-800">Fehler beim Laden</p>
              <p className="text-sm text-red-600 mt-0.5">{calendarError}</p>
            </div>
          </div>
        )}

        {calendarData && !calendarLoading && selectedClassId != null && (
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
              <div className="sm:ml-auto">
                <CalendarLegend />
              </div>
            </div>

            <SchoolYearCalendar
              days={calendarData.days}
              schoolYearName={calendarData.schoolYear.name}
              classId={selectedClassId}
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
    </div>
  );
}
