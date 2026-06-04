import { format, addDays, getISODay, getISOWeek, getISOWeekYear } from 'date-fns';

/** Unique numeric key for an ISO week: YYYY * 100 + WW */
function getWeekKey(date: Date): number {
  return getISOWeekYear(date) * 100 + getISOWeek(date);
}
import type { CalendarDay, DayType, UntisHoliday, UntisLesson, UntisSchoolYear } from '@/src/types';

/** Convert 'YYYY-MM-DD' string to YYYYMMDD number */
export function isoToUntisDate(iso: string): number {
  return parseInt(iso.replace(/-/g, ''), 10);
}

function parseUntisDate(date: number): Date {
  const s = date.toString();
  return new Date(
    parseInt(s.slice(0, 4), 10),
    parseInt(s.slice(4, 6), 10) - 1,
    parseInt(s.slice(6, 8), 10)
  );
}

/**
 * Build a map of YYYYMMDD → holiday name from WebUntis holidays.
 * The name comes from `longName` when available, otherwise the short `name`.
 * Whether a day actually renders as ferien (violet) or no-lessons (gray) is
 * decided downstream in `classifyDays`, based on the class's school days.
 */
function buildHolidayMap(holidays: UntisHoliday[]): Map<number, string> {
  const map = new Map<number, string>();

  for (const holiday of holidays) {
    const displayName = holiday.longName || holiday.name;
    let current = parseUntisDate(holiday.startDate);
    const end = parseUntisDate(holiday.endDate);

    while (current <= end) {
      const key = parseInt(format(current, 'yyyyMMdd'), 10);
      map.set(key, displayName);
      current = addDays(current, 1);
    }
  }

  return map;
}

/**
 * A "Veranstaltung" / special-event period: irregular (deviates from the standard
 * timetable) and carrying no subject — i.e. not a real lesson. Regular lessons are
 * `code === undefined`; substitutions that still teach keep a subject.
 */
function isEventPeriod(lesson: UntisLesson): boolean {
  return lesson.code === 'irregular' && (lesson.su?.length ?? 0) === 0;
}

function getEventText(event: UntisLesson): string | undefined {
  return event.lstext || event.substText;
}

/**
 * Build a human-readable tooltip for a calendar day.
 * Returns undefined when there's nothing meaningful to say (e.g. weekend, no-lessons).
 */
export function buildDayTooltip(day: CalendarDay): string | undefined {
  if (day.holidayName) return day.holidayName;
  const parts: string[] = [];
  if (day.eventName) parts.push(day.eventName);
  if (day.lessonCount !== undefined && day.lessonCount > 0) {
    const n = day.lessonCount;
    parts.push(`${n} ${n === 1 ? 'Lektion' : 'Lektionen'}`);
  }
  if (day.cancelledCount !== undefined && day.cancelledCount > 0) {
    parts.push(`${day.cancelledCount} abgesagt`);
  }
  return parts.length > 0 ? parts.join(', ') : undefined;
}

/**
 * Deduplicate lessons by `id`. Preserves first-seen order.
 * Used when merging timetables from multiple classes that may share lessons.
 */
export function deduplicateLessons(lessonArrays: UntisLesson[][]): UntisLesson[] {
  const seen = new Set<number>();
  const result: UntisLesson[] = [];
  for (const lesson of lessonArrays.flat()) {
    if (!seen.has(lesson.id)) {
      seen.add(lesson.id);
      result.push(lesson);
    }
  }
  return result;
}

/**
 * Build a map of YYYYMMDD → lessons[] from a flat lesson array.
 */
function buildLessonMap(lessons: UntisLesson[]): Map<number, UntisLesson[]> {
  const map = new Map<number, UntisLesson[]>();
  for (const lesson of lessons) {
    const bucket = map.get(lesson.date) ?? [];
    bucket.push(lesson);
    map.set(lesson.date, bucket);
  }
  return map;
}

/**
 * Determine which weekdays are "Schultage" for this class by examining the
 * first 4 school weeks (ISO weeks that contain at least one lesson).
 *
 * Returns a Set of ISO weekday numbers: 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri.
 * Fallback: if no lessons at all, treat all weekdays as school days.
 */
export function determineSchoolDays(lessons: UntisLesson[]): Set<number> {
  // Event periods ("Veranstaltung") don't represent regular scheduled school —
  // only real lessons (including cancelled ones) establish which days are school days.
  const realLessons = lessons.filter((l) => !isEventPeriod(l));
  if (realLessons.length === 0) return new Set([1, 2, 3, 4, 5]);

  // Group by unique ISO week key (YYYY_WW)
  const weekMap = new Map<number, UntisLesson[]>();
  for (const lesson of realLessons) {
    const date = parseUntisDate(lesson.date);
    const key = getWeekKey(date);
    const bucket = weekMap.get(key) ?? [];
    bucket.push(lesson);
    weekMap.set(key, bucket);
  }

  // Sort ascending, take first 4
  const first4Weeks = Array.from(weekMap.entries())
    .sort(([a], [b]) => a - b)
    .slice(0, 4);

  const schoolDays = new Set<number>();
  for (const [, weekLessons] of first4Weeks) {
    for (const lesson of weekLessons) {
      const isoDay = getISODay(parseUntisDate(lesson.date)); // 1=Mon…7=Sun
      if (isoDay <= 5) schoolDays.add(isoDay);
    }
  }

  return schoolDays;
}

/**
 * Pure function: classify every calendar day of the school year.
 *
 * Day types:
 *  - 'weekend'             Sat / Sun
 *  - 'ferien'              inside a school vacation period
 *  - 'normal'              lessons present, at least one not cancelled
 *  - 'unterrichtsausfall'  school day but no effective lessons (all cancelled or "Unterrichtsausfall" event)
 *  - 'veranstaltung'       Veranstaltung event without "Unterrichtsausfall" prefix
 *  - 'no-lessons'          weekday that is not a school day for this class
 *
 * @param schoolYear  School year with JS Date start/end
 * @param holidays    Raw WebUntis holidays array
 * @param lessons     Full timetable for the class over the school year
 */
export function classifyDays(
  schoolYear: UntisSchoolYear,
  holidays: UntisHoliday[],
  lessons: UntisLesson[]
): CalendarDay[] {
  const holidayMap = buildHolidayMap(holidays);
  const lessonMap = buildLessonMap(lessons);
  const schoolDays = determineSchoolDays(lessons);

  const result: CalendarDay[] = [];
  let current = new Date(schoolYear.startDate);
  current.setHours(0, 0, 0, 0);
  const end = new Date(schoolYear.endDate);
  end.setHours(0, 0, 0, 0);

  while (current <= end) {
    const isoDate = format(current, 'yyyy-MM-dd');
    const untisDate = isoToUntisDate(isoDate);
    const isoDay = getISODay(current); // 1=Mon…7=Sun; 6=Sat, 7=Sun

    let type: DayType;
    let holidayName: string | undefined;
    let eventName: string | undefined;
    let lessonCount: number | undefined;
    let cancelledCount: number | undefined;

    if (isoDay >= 6) {
      // Saturday or Sunday
      type = 'weekend';
    } else {
      const holidayDisplayName = holidayMap.get(untisDate);
      if (holidayDisplayName !== undefined) {
        if (schoolDays.has(isoDay)) {
          // Holiday (Schulferien or Feiertag) on one of the class's school days
          // → violet with the label from the WebUntis holidays endpoint.
          type = 'ferien';
          holidayName = holidayDisplayName;
        } else {
          // Holiday on a weekday the class never meets → stays gray, no label.
          type = 'no-lessons';
        }
      } else {
        const dayLessons = lessonMap.get(untisDate) ?? [];

        cancelledCount = dayLessons.filter((l) => l.code === 'cancelled').length;
        // Genuine teaching: normal lessons, plus irregular periods that still
        // have a subject (substitutions where teaching happens). Special events
        // ("Veranstaltung": irregular + no subject) do NOT count — see isEventPeriod.
        lessonCount = dayLessons.filter(
          (l) => l.code !== 'cancelled' && !isEventPeriod(l),
        ).length;

        if (lessonCount > 0) {
          type = 'normal';
        } else if (dayLessons.length > 0) {
          // Only cancelled lessons and/or special events remain.
          // If the only event is an "Unterrichtsausfall" Veranstaltung on a day the
          // class doesn't normally have school, don't color it — there's nothing to cancel.
          const event = dayLessons.find(isEventPeriod);
          const isUnterrichtsausfall =
            event != null &&
            ((event.lstext ?? '').startsWith('Unterrichtsausfall') ||
              (event.substText ?? '').startsWith('Unterrichtsausfall'));

          if (isUnterrichtsausfall && !schoolDays.has(isoDay)) {
            type = 'no-lessons';
          } else if (event && !isUnterrichtsausfall) {
            // Veranstaltung without "Unterrichtsausfall" prefix → green event day
            type = 'veranstaltung';
            eventName = getEventText(event);
          } else {
            type = 'unterrichtsausfall';
            if (event) eventName = getEventText(event)?.replace(/^Unterrichtsausfall:\s*/i, '').trim() || undefined;
          }
        } else {
          // No lessons at all — is this a defined school day for this class?
          type = schoolDays.has(isoDay) ? 'unterrichtsausfall' : 'no-lessons';
        }
      }
    }

    const day: CalendarDay = { date: isoDate, type };
    if (holidayName !== undefined) day.holidayName = holidayName;
    if (eventName !== undefined) day.eventName = eventName;
    if (lessonCount !== undefined) day.lessonCount = lessonCount;
    if (cancelledCount !== undefined && cancelledCount > 0) day.cancelledCount = cancelledCount;

    result.push(day);
    current = addDays(current, 1);
  }

  return result;
}
