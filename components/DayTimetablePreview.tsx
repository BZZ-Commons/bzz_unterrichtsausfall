'use client';

import { useEffect, useState } from 'react';
import { RotateCw } from 'lucide-react';
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
  { status: 'loading' } | { status: 'error' } | { status: 'ready'; lessons: DayLessonEntry[] };

/** Accent bar colour per lesson state — BZZ base tones (lines only, no text on them). */
function accentColor(l: DayLessonEntry): string {
  if (l.cancelled) return 'var(--bzz-fabe)'; // fällt aus
  if (l.isEvent) return 'var(--bzz-blau)'; // Veranstaltung
  return 'var(--bzz-mediamatik)'; // Unterricht
}

/** BZZ tag next to a lesson ("fällt aus" / "Veranstaltung"): colour in the dot, black text. */
function StatusTag({ label, dot }: { label: string; dot: string }) {
  return (
    <span className="bzz-tag shrink-0" style={{ '--tag': dot } as React.CSSProperties}>
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
      <div className="w-11 shrink-0 pt-0.5 text-right leading-tight tabular-nums">
        <div className="text-[13px] font-bold">{formatUntisTime(lesson.startTime)}</div>
        {spansSlot && (
          <div className="text-xs text-bzz-muted">{formatUntisTime(lesson.endTime)}</div>
        )}
      </div>
      <div
        className="w-1 shrink-0 rounded-bzz"
        style={{ background: accentColor(lesson) }}
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1 pb-0.5">
        <div className="flex items-start gap-2">
          <p
            className={`m-0 min-w-0 flex-1 text-[15px] leading-snug font-bold break-words ${
              lesson.cancelled ? 'text-bzz-muted line-through' : ''
            }`}
          >
            {title}
          </p>
          {lesson.cancelled && <StatusTag label="fällt aus" dot="var(--bzz-fabe)" />}
          {lesson.isEvent && !lesson.cancelled && (
            <StatusTag label="Veranstaltung" dot="var(--bzz-blau)" />
          )}
        </div>
        {meta && <p className="mt-0.5 mb-0 text-[13px] break-words text-bzz-muted">{meta}</p>}
        {reasonLine && (
          <p className="mt-0.5 mb-0 text-[13px] font-bold break-words text-bzz-fabe-ink">
            {reasonLine}
          </p>
        )}
      </div>
    </li>
  );
}

function SkeletonRows() {
  return (
    <ul className="m-0 list-none space-y-3 p-0" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <li key={i} className="flex gap-3">
          <div className="w-11 shrink-0 pt-0.5">
            <div className="ml-auto h-3 w-9 animate-pulse rounded-bzz bg-bzz-nebel" />
          </div>
          <div className="w-1 shrink-0 rounded-bzz bg-bzz-nebel" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="h-3.5 w-1/2 animate-pulse rounded-bzz bg-bzz-nebel" />
            <div className="h-3 w-1/3 animate-pulse rounded-bzz bg-bzz-nebel" />
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
 * special events blue. Vertical list → works on mobile inside the day dialog.
 */
export default function DayTimetablePreview({ classIds, date }: DayTimetablePreviewProps) {
  // Bumped by the retry button to re-run the effect.
  const [attempt, setAttempt] = useState(0);
  // Result of the last finished request, tagged with its request key. Anything
  // else (new day, new classes, retry) reads as "loading" — no synchronous
  // reset inside the effect needed.
  const [result, setResult] = useState<{ key: string; state: LoadState } | null>(null);

  // Depend on the joined ids, not the array — a fresh `classIds` identity from a
  // parent re-render shouldn't refetch when the actual ids are unchanged.
  const classKey = classIds.join(',');
  const requestKey = `${classKey}|${date}|${attempt}`;
  const state: LoadState = result?.key === requestKey ? result.state : { status: 'loading' };

  useEffect(() => {
    if (!classKey) return;
    const controller = new AbortController();

    const params = new URLSearchParams({ classIds: classKey, date });
    fetchJson<DayTimetable>(`/api/day-timetable?${params.toString()}`, controller.signal)
      .then((data) =>
        setResult({ key: requestKey, state: { status: 'ready', lessons: data.lessons } }),
      )
      .catch((err: unknown) => {
        if (isAbortError(err)) return;
        setResult({ key: requestKey, state: { status: 'error' } });
      });

    return () => controller.abort();
  }, [classKey, date, requestKey]);

  return (
    <section className="bzz-panel">
      <div className="mb-3 flex items-center gap-2">
        <h3 className="bzz-label m-0">Tagesstundenplan</h3>
        <span className="bzz-tag bzz-tag--plain ml-auto">Vorschau</span>
      </div>

      {state.status === 'loading' && <SkeletonRows />}

      {state.status === 'error' && (
        <div className="flex items-center justify-between gap-3">
          <p className="bzz-muted m-0">Vorschau nicht verfügbar.</p>
          <button
            type="button"
            onClick={() => setAttempt((a) => a + 1)}
            className="bzz-btn bzz-btn--klein"
          >
            <RotateCw className="h-4 w-4" aria-hidden="true" />
            Erneut
          </button>
        </div>
      )}

      {state.status === 'ready' &&
        (state.lessons.length === 0 ? (
          <p className="bzz-muted m-0">Keine Lektionen an diesem Tag.</p>
        ) : (
          <ul className="m-0 list-none space-y-3 p-0">
            {state.lessons.map((lesson, i) => (
              <LessonRow key={`${lesson.startTime}-${lesson.subject}-${i}`} lesson={lesson} />
            ))}
          </ul>
        ))}
    </section>
  );
}
