/**
 * Pure helpers for the inline day-timetable preview (see DayTimetablePreview).
 *
 * WebUntis returns one record per 45-minute period, so a double lesson of the
 * same subject arrives as two adjacent records. `buildDayTimetable` projects the
 * raw lessons onto the slim {@link DayLessonEntry} shape, sorts them by start
 * time and merges contiguous same-subject blocks into a single row — the form
 * the preview renders.
 */

import { isEventPeriod, isUnterrichtsausfallEvent } from '@/src/lib/calendar';
import type { DayLessonEntry, UntisLesson } from '@/src/types';

/**
 * The lesson fields the preview consumes — the subset of `UntisLesson` that
 * `buildDayTimetable` reads. Picked (not redeclared) so it stays in lockstep
 * with the canonical type and its boundary validation (`parseUntisLessons`).
 */
export type DayTimetableLesson = Pick<
  UntisLesson,
  'startTime' | 'endTime' | 'code' | 'su' | 'te' | 'ro' | 'lstext' | 'substText' | 'sourceClassId'
>;

/**
 * Resolve a cancelled lesson's reason from its teacher's cancellation event.
 * The day is fixed by the caller, so only the lesson's teachers are needed.
 */
export type LessonReasonResolver = (l: DayTimetableLesson) => string | undefined;

function toEntry(l: DayTimetableLesson, reasonOf?: LessonReasonResolver): DayLessonEntry {
  const event = isEventPeriod(l);
  const cancelled = l.code === 'cancelled';
  return {
    startTime: l.startTime as number,
    endTime: l.endTime ?? (l.startTime as number),
    subject: l.su?.[0]?.name ?? '',
    room: l.ro?.[0]?.name || undefined,
    teacher: l.te?.[0]?.name || undefined,
    cancelled,
    isEvent: event,
    text: event ? l.lstext || l.substText || undefined : undefined,
    reason: cancelled ? reasonOf?.(l) : undefined,
    sourceClassId: l.sourceClassId,
  };
}

/** Two entries that should collapse into one row (same lesson, adjacent periods). */
function sameBlock(a: DayLessonEntry, b: DayLessonEntry): boolean {
  return (
    a.subject === b.subject &&
    a.room === b.room &&
    a.teacher === b.teacher &&
    a.cancelled === b.cancelled &&
    a.isEvent === b.isEvent &&
    a.text === b.text &&
    a.reason === b.reason
  );
}

/**
 * Build a day's preview entries: drop lessons without a start time (can't be
 * placed), sort chronologically and merge contiguous same-subject blocks so a
 * double period reads as one row spanning both slots.
 */
export function buildDayTimetable(
  lessons: DayTimetableLesson[],
  reasonOf?: LessonReasonResolver,
): DayLessonEntry[] {
  const entries = lessons
    // Keep only placeable lessons, dropping "Unterrichtsausfall: …" blanket event
    // periods: they aren't lessons and aren't real Veranstaltungen — just markers
    // whose (often borrowed) reason should not surface here. The real per-lesson
    // reason comes via `reasonOf`.
    .filter(
      (l) => typeof l.startTime === 'number' && !(isEventPeriod(l) && isUnterrichtsausfallEvent(l)),
    )
    .map((l) => toEntry(l, reasonOf))
    .sort((a, b) => a.startTime - b.startTime || a.subject.localeCompare(b.subject));

  const merged: DayLessonEntry[] = [];
  for (const entry of entries) {
    const last = merged[merged.length - 1];
    if (last && sameBlock(last, entry)) {
      last.endTime = Math.max(last.endTime, entry.endTime);
    } else {
      merged.push({ ...entry });
    }
  }
  return merged;
}

/** Format an HHMM WebUntis time (e.g. 800, 1150) as "08:00" / "11:50". */
export function formatUntisTime(hhmm: number): string {
  const h = Math.floor(hhmm / 100);
  const m = hhmm % 100;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
