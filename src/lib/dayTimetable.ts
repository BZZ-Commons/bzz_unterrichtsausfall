/**
 * Pure helpers for the inline day-timetable preview (see DayTimetablePreview).
 *
 * WebUntis returns one record per 45-minute period, so a double lesson of the
 * same subject arrives as two adjacent records. `buildDayTimetable` projects the
 * raw lessons onto the slim {@link DayLessonEntry} shape, sorts them by start
 * time and merges contiguous same-subject blocks into a single row — the form
 * the preview renders.
 */

import { isEventPeriod } from '@/src/lib/calendar';
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

function toEntry(l: DayTimetableLesson): DayLessonEntry {
  const event = isEventPeriod(l);
  return {
    startTime: l.startTime as number,
    endTime: l.endTime ?? (l.startTime as number),
    subject: l.su?.[0]?.name ?? '',
    room: l.ro?.[0]?.name || undefined,
    teacher: l.te?.[0]?.name || undefined,
    cancelled: l.code === 'cancelled',
    isEvent: event,
    text: event ? l.lstext || l.substText || undefined : undefined,
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
    a.text === b.text
  );
}

/**
 * Build a day's preview entries: drop lessons without a start time (can't be
 * placed), sort chronologically and merge contiguous same-subject blocks so a
 * double period reads as one row spanning both slots.
 */
export function buildDayTimetable(lessons: DayTimetableLesson[]): DayLessonEntry[] {
  const entries = lessons
    .filter((l) => typeof l.startTime === 'number')
    .map(toEntry)
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
