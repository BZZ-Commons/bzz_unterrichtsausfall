'use client';

import { useEffect, useState } from 'react';
import { CalendarClock, RotateCw } from 'lucide-react';
import { fetchJson, isAbortError } from '@/src/lib/fetchJson';
import { formatUntisTime } from '@/src/lib/dayTimetable';
import type { DayLessonEntry, DayTimetable } from '@/src/types';

interface DayTimetablePreviewProps {
  /** Merged class IDs (self + companions) whose day is shown. */
  classIds: number[];
  /** 'YYYY-MM-DD' of the day to preview. */
  date: string;
}

type LoadState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; lessons: DayLessonEntry[] };

/** Accent bar colour per lesson state — mirrors the calendar's palette. */
function accentColor(l: DayLessonEntry): string {
  if (l.cancelled) return '#fb923c'; // orange-400 — fällt aus
  if (l.isEvent) return '#38bdf8'; // sky-400 — Veranstaltung
  return '#34d399'; // emerald-400 — Unterricht
}

/** Small status pill (e.g. "fällt aus" / "Veranstaltung") shown next to a lesson. */
function StatusBadge({ label, tone }: { label: string; tone: 'orange' | 'sky' }) {
  const toneClass = tone === 'orange' ? 'bg-orange-100 text-orange-700' : 'bg-sky-100 text-sky-700';
  return (
    <span
      className={`mt-0.5 shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${toneClass}`}
    >
      {label}
    </span>
  );
}

function LessonRow({ lesson }: { lesson: DayLessonEntry }) {
  const meta = [lesson.room, lesson.teacher].filter(Boolean).join(' · ');
  const title = lesson.subject || lesson.text || 'Lektion';
  const spansSlot = lesson.endTime > lesson.startTime;
  // Reason line for a teacher-caused cancellation. The teacher's name already shows
  // in the meta line, so this reads literally "Ausfall Lehrperson wegen <Grund>".
  const reasonLine =
    lesson.cancelled && lesson.reason ? `Ausfall Lehrperson wegen ${lesson.reason}` : undefined;

  return (
    <li className="flex gap-3">
      <div className="w-11 shrink-0 text-right tabular-nums leading-tight pt-0.5">
        <div className="text-xs font-semibold text-slate-700">
          {formatUntisTime(lesson.startTime)}
        </div>
        {spansSlot && (
          <div className="text-[11px] text-slate-400">{formatUntisTime(lesson.endTime)}</div>
        )}
      </div>
      <div
        className="w-1 shrink-0 rounded-full"
        style={{ background: accentColor(lesson) }}
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1 pb-0.5">
        <div className="flex items-start gap-2">
          <p
            className={`min-w-0 flex-1 text-sm font-medium break-words ${
              lesson.cancelled ? 'text-slate-400 line-through' : 'text-slate-900'
            }`}
          >
            {title}
          </p>
          {lesson.cancelled && <StatusBadge label="fällt aus" tone="orange" />}
          {lesson.isEvent && !lesson.cancelled && <StatusBadge label="Veranstaltung" tone="sky" />}
        </div>
        {meta && <p className="mt-0.5 text-xs text-slate-500 break-words">{meta}</p>}
        {reasonLine && (
          <p className="mt-0.5 text-xs font-medium text-orange-600 break-words">{reasonLine}</p>
        )}
      </div>
    </li>
  );
}

function SkeletonRows() {
  return (
    <ul className="space-y-3" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <li key={i} className="flex gap-3">
          <div className="w-11 shrink-0 pt-0.5">
            <div className="h-3 w-9 ml-auto rounded bg-slate-200 animate-pulse" />
          </div>
          <div className="w-1 shrink-0 rounded-full bg-slate-200" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="h-3.5 w-1/2 rounded bg-slate-200 animate-pulse" />
            <div className="h-3 w-1/3 rounded bg-slate-100 animate-pulse" />
          </div>
        </li>
      ))}
    </ul>
  );
}

/**
 * Inline preview of a single day's lessons, loaded on demand from
 * /api/day-timetable. A glance at the day's plan before deciding to open the
 * full WebUntis week — held lessons green, cancelled orange (struck through),
 * special events sky-blue. Vertical list → works on mobile inside the day dialog.
 */
export default function DayTimetablePreview({ classIds, date }: DayTimetablePreviewProps) {
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  // Bumped by the retry button to re-run the effect.
  const [attempt, setAttempt] = useState(0);

  // Depend on the joined ids, not the array — a fresh `classIds` identity from a
  // parent re-render shouldn't refetch when the actual ids are unchanged.
  const classKey = classIds.join(',');

  useEffect(() => {
    if (!classKey) return;
    const controller = new AbortController();
    setState({ status: 'loading' });

    const params = new URLSearchParams({ classIds: classKey, date });
    fetchJson<DayTimetable>(`/api/day-timetable?${params.toString()}`, controller.signal)
      .then((data) => setState({ status: 'ready', lessons: data.lessons }))
      .catch((err: unknown) => {
        if (isAbortError(err)) return;
        setState({ status: 'error' });
      });

    return () => controller.abort();
    // `attempt` is a manual retry trigger.
  }, [classKey, date, attempt]);

  return (
    <section className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5">
      <div className="mb-3 flex items-center gap-2">
        <CalendarClock className="h-4 w-4 text-slate-400" aria-hidden="true" />
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Tagesstundenplan
        </h3>
        <span className="ml-auto rounded-full bg-slate-200/70 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
          Vorschau
        </span>
      </div>

      {state.status === 'loading' && <SkeletonRows />}

      {state.status === 'error' && (
        <div className="flex items-center justify-between gap-3 text-sm">
          <p className="text-slate-500">Vorschau nicht verfügbar.</p>
          <button
            type="button"
            onClick={() => setAttempt((a) => a + 1)}
            className="inline-flex items-center gap-1 font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
          >
            <RotateCw className="h-3.5 w-3.5" aria-hidden="true" />
            Erneut
          </button>
        </div>
      )}

      {state.status === 'ready' &&
        (state.lessons.length === 0 ? (
          <p className="text-sm text-slate-500 italic">Keine Lektionen an diesem Tag.</p>
        ) : (
          <ul className="space-y-3">
            {state.lessons.map((lesson, i) => (
              <LessonRow key={`${lesson.startTime}-${lesson.subject}-${i}`} lesson={lesson} />
            ))}
          </ul>
        ))}
    </section>
  );
}
