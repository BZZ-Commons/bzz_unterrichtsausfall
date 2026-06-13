import { format, addDays, getISODay, getISOWeek, getISOWeekYear } from 'date-fns';

/** Unique numeric key for an ISO week: YYYY * 100 + WW */
function getWeekKey(date: Date): number {
  return getISOWeekYear(date) * 100 + getISOWeek(date);
}
import type {
  CalendarDay,
  DayHalf,
  DayType,
  HalfDayInfo,
  HalfStatus,
  UntisHoliday,
  UntisLesson,
  UntisSchoolYear,
} from '@/src/types';

/** Lessons starting before this HHMM time count as Vormittag (morning, left half). */
const NOON = 1200;

/**
 * Days with at least this many held lessons render as a full (green) day —
 * cancellations and empty halves are suppressed. See computeDaySplit.
 */
const FULL_DAY_MIN_LESSONS = 6;

const isMorning = (l: UntisLesson): boolean =>
  typeof l.startTime === 'number' && l.startTime < NOON;
const isAfternoon = (l: UntisLesson): boolean =>
  typeof l.startTime === 'number' && l.startTime >= NOON;

/** Convert 'YYYY-MM-DD' string to YYYYMMDD number */
export function isoToUntisDate(iso: string): number {
  return parseInt(iso.replace(/-/g, ''), 10);
}

export function parseUntisDate(date: number): Date {
  const s = date.toString();
  return new Date(
    parseInt(s.slice(0, 4), 10),
    parseInt(s.slice(4, 6), 10) - 1,
    parseInt(s.slice(6, 8), 10),
  );
}

/**
 * Build a map of YYYYMMDD → holiday name from WebUntis holidays.
 * The name comes from `longName` when available, otherwise the short `name`.
 * Whether a day actually renders as ferien (violet) or no-lessons (gray) is
 * decided downstream in `classifyDays`, based on the class's school days.
 */
function buildHolidayMapWith<K>(
  holidays: UntisHoliday[],
  keyFn: (date: Date) => K,
): Map<K, string> {
  const map = new Map<K, string>();
  for (const holiday of holidays) {
    const displayName = holiday.longName || holiday.name;
    let current = parseUntisDate(holiday.startDate);
    const end = parseUntisDate(holiday.endDate);
    while (current <= end) {
      map.set(keyFn(current), displayName);
      current = addDays(current, 1);
    }
  }
  return map;
}

function buildHolidayMap(holidays: UntisHoliday[]): Map<number, string> {
  return buildHolidayMapWith(holidays, (d) => parseInt(format(d, 'yyyyMMdd'), 10));
}

/** Build a 'YYYY-MM-DD' → holiday name map for use in aggregate classification. */
export function buildHolidayDateMap(holidays: UntisHoliday[]): Map<string, string> {
  return buildHolidayMapWith(holidays, (d) => format(d, 'yyyy-MM-dd'));
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

/** Schulausfall reason from an event period, with any "Unterrichtsausfall:" prefix stripped. */
function eventReason(event: UntisLesson): string | undefined {
  return (
    getEventText(event)
      ?.replace(/^Unterrichtsausfall:\s*/i, '')
      .trim() || undefined
  );
}

/** German label for the status of one half of a split day cell. */
export function halfStatusLabel(status: HalfStatus): string {
  return status === 'lessons' ? 'Unterricht' : status === 'cancelled' ? 'fällt aus' : 'frei';
}

/**
 * Build a human-readable tooltip for a calendar day. Covers the un-split case
 * (lesson/cancel counts, holiday, event). Split cells build their per-half
 * tooltips in the component, where class names are available.
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
  return schoolDaysFromRealLessons(lessons.filter((l) => !isEventPeriod(l)));
}

/** Core of {@link determineSchoolDays}, operating on already-filtered real lessons. */
function schoolDaysFromRealLessons(realLessons: UntisLesson[]): Set<number> {
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
 * Dominant source class among a set of lessons: the class contributing the most
 * lessons. Ties resolve to the first-seen class — and since lessons are merged
 * primary-class-first, that means the selected (primary) class wins a tie.
 */
function dominantClassId(lessons: UntisLesson[]): number | undefined {
  const counts = new Map<number, number>();
  const order: number[] = [];
  for (const l of lessons) {
    if (typeof l.sourceClassId !== 'number') continue;
    if (!counts.has(l.sourceClassId)) order.push(l.sourceClassId);
    counts.set(l.sourceClassId, (counts.get(l.sourceClassId) ?? 0) + 1);
  }
  let best: number | undefined;
  let bestCount = 0;
  for (const id of order) {
    const c = counts.get(id) ?? 0;
    if (c > bestCount) {
      best = id;
      bestCount = c;
    }
  }
  return best;
}

/**
 * Decide how a day with lessons renders: as one cell (→ linkClassId) or split into
 * Vormittag | Nachmittag (→ halfDay), with each half carrying its owning class.
 *
 * Rules:
 *  - ≥6 held lessons ⇒ full green day. Cancellations/empty halves are suppressed
 *    (no orange/gray). Only a class boundary between the held halves still splits it
 *    (green | green) so each half can link to its own class.
 *  - <6 held lessons ⇒ per-half status: 'lessons' (green) / 'cancelled' (orange) /
 *    'none' (gray), each with its owning class. Split when the halves differ in
 *    status OR class; otherwise one cell.
 *
 * Lessons whose start time is missing can't be placed; if nothing lands in either
 * half the day stays a single cell (link only).
 */
function computeDaySplit(dayLessons: UntisLesson[]): {
  halfDay?: HalfDayInfo;
  linkClassId?: number;
} {
  const real = dayLessons.filter((l) => !isEventPeriod(l));
  const held = real.filter((l) => l.code !== 'cancelled');
  const cancelled = real.filter((l) => l.code === 'cancelled');

  const heldAM = held.filter(isMorning);
  const heldPM = held.filter(isAfternoon);
  const cancelledAM = cancelled.filter(isMorning);
  const cancelledPM = cancelled.filter(isAfternoon);

  // ≥6 held lessons → full green day; only a class boundary between the held halves splits it.
  if (held.length >= FULL_DAY_MIN_LESSONS) {
    const amClass = dominantClassId(heldAM);
    const pmClass = dominantClassId(heldPM);
    if (amClass !== undefined && pmClass !== undefined && amClass !== pmClass) {
      return {
        halfDay: {
          morning: { status: 'lessons', classId: amClass },
          afternoon: { status: 'lessons', classId: pmClass },
        },
      };
    }
    return { linkClassId: dominantClassId(held) };
  }

  // Symmetric to the green full-day rule above: if the SAME full teaching load (≥6)
  // is entirely cancelled, the whole day reads as one orange Unterrichtsausfall — not
  // an afternoon-only half. Without this, an afternoon-heavy class (e.g. 6 cancelled
  // afternoon lessons, no morning) would show a lone orange afternoon beside a grey
  // "free" morning, even though those same 6 lessons HELD render as a full green day.
  // Only collapse when the cancellations all sit in one half (the empty half has
  // nothing of its own to show); genuine two-class days fall through to the per-half
  // logic below and still split orange | orange.
  if (
    held.length === 0 &&
    cancelled.length >= FULL_DAY_MIN_LESSONS &&
    (cancelledAM.length === 0 || cancelledPM.length === 0)
  ) {
    return { linkClassId: dominantClassId(cancelled) };
  }

  // A Schulausfall reason ("QV BM & KV", …) comes from an event period; attach it to
  // the cancelled half it falls in, so a split day still shows why lessons are out.
  const events = dayLessons.filter(isEventPeriod);
  const dayReason = events.map(eventReason).find(Boolean);
  // When several Unterrichtsausfall events from different class-groups overlap on one
  // day (e.g. an IA "QV der Abschlussklassen" event merged alongside an AB "QV
  // Allgemeinbildender Unterricht" event in the ABU view), pick the reason from the
  // event that belongs to the class actually owning this half's cancelled lessons —
  // matched via sourceClassId. Fall back to a time-half event, then any event.
  const reasonFor = (
    classId: number | undefined,
    pred: (l: UntisLesson) => boolean,
  ): string | undefined =>
    (classId !== undefined
      ? events
          .filter((e) => e.sourceClassId === classId)
          .map(eventReason)
          .find(Boolean)
      : undefined) ??
    events.filter(pred).map(eventReason).find(Boolean) ??
    dayReason;

  // <6 held → status per half, with the class owning that half's lessons.
  const halfOf = (
    heldH: UntisLesson[],
    cancelledH: UntisLesson[],
    pred: (l: UntisLesson) => boolean,
  ): DayHalf => {
    if (heldH.length > 0) return { status: 'lessons', classId: dominantClassId(heldH) };
    if (cancelledH.length > 0) {
      const classId = dominantClassId(cancelledH);
      const h: DayHalf = { status: 'cancelled', classId };
      const reason = reasonFor(classId, pred);
      if (reason) h.reason = reason;
      return h;
    }
    return { status: 'none' };
  };
  const morning = halfOf(heldAM, cancelledAM, isMorning);
  const afternoon = halfOf(heldPM, cancelledPM, isAfternoon);

  // Nothing could be placed (e.g. lessons without start times) → single cell.
  if (morning.status === 'none' && afternoon.status === 'none') {
    return { linkClassId: dominantClassId(real) };
  }

  // Identical halves (same status AND same class) → one cell.
  if (morning.status === afternoon.status && morning.classId === afternoon.classId) {
    return { linkClassId: morning.classId ?? afternoon.classId };
  }
  return { halfDay: { morning, afternoon } };
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
  lessons: UntisLesson[],
): CalendarDay[] {
  const holidayMap = buildHolidayMap(holidays);
  const lessonMap = buildLessonMap(lessons);

  // Real lessons (held or cancelled, excluding special events) drive both the
  // school-day set and the last lesson date — filter once, reuse twice.
  const realLessons = lessons.filter((l) => !isEventPeriod(l));
  const schoolDays = schoolDaysFromRealLessons(realLessons);

  // Last date the class has any scheduled lesson. Empty school days after this
  // date mean the class has finished for the year (Abschlussklasse) — flagged
  // below via `ended`.
  const lastLessonDate = realLessons.length
    ? Math.max(...realLessons.map((l) => l.date)) // YYYYMMDD numbers compare chronologically
    : null;

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
    let ended = false;
    let halfDay: HalfDayInfo | undefined;
    let linkClassId: number | undefined;

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
        lessonCount = dayLessons.filter((l) => l.code !== 'cancelled' && !isEventPeriod(l)).length;

        if (lessonCount > 0) {
          type = 'normal';
          ({ halfDay, linkClassId } = computeDaySplit(dayLessons));
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
            linkClassId = dominantClassId(dayLessons);
          } else {
            // Only cancelled lessons (possibly with an "Unterrichtsausfall" event):
            // split orange|orange when the cancellations span two classes, else one cell.
            type = 'unterrichtsausfall';
            if (event) eventName = eventReason(event);
            ({ halfDay, linkClassId } = computeDaySplit(dayLessons));
          }
        } else if (schoolDays.has(isoDay)) {
          // No lessons at all on a school day → Unterrichtsausfall.
          type = 'unterrichtsausfall';
          // After the class's last scheduled lesson, an empty school day means the
          // class has finished the year (Abschlussklasse). Flag it so the all-classes
          // overview can surface it; the single-class view ignores the flag.
          if (lastLessonDate != null && untisDate > lastLessonDate) ended = true;
        } else {
          // Weekday the class never meets → stays gray.
          type = 'no-lessons';
        }
      }
    }

    const day: CalendarDay = { date: isoDate, type };
    if (holidayName !== undefined) day.holidayName = holidayName;
    if (eventName !== undefined) day.eventName = eventName;
    if (lessonCount !== undefined) day.lessonCount = lessonCount;
    if (cancelledCount !== undefined && cancelledCount > 0) day.cancelledCount = cancelledCount;
    if (ended) day.ended = true;
    if (halfDay !== undefined) day.halfDay = halfDay;
    if (linkClassId !== undefined) day.linkClassId = linkClassId;

    result.push(day);
    current = addDays(current, 1);
  }

  return result;
}
