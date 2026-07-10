/**
 * Shared server-side WebUntis queries for the school-year calendar, used by
 * both the API routes and the MCP data layer (same pattern as
 * classes-server.ts). Callers run these inside `withUntisClient` and decide
 * about caching themselves.
 */

import type { WebUntis } from 'webuntis';
import {
  resolveSchoolyear,
  toUntisSchoolYear,
  fetchClassTimetable,
  fetchClassTimetableWeek,
  fetchTeacherTimetableDay,
  mapWithConcurrency,
} from '@/src/lib/webuntis';
import { fetchSchoolPeriods } from '@/src/lib/schoolPeriods';
import { parseUntisHolidays } from '@/src/lib/untisBoundary';
import {
  classifyDays,
  deduplicateLessons,
  findSuspiciousLessons,
  removeNonSchoolDayBookings,
  parseUntisDate,
  getWeekKey,
  isoToUntisDate,
  extractAusfallReason,
  teacherReasonKey,
  type TeacherReasonMap,
} from '@/src/lib/calendar';
import type {
  CalendarData,
  CalendarDay,
  SchoolPeriod,
  SchoolYearSummary,
  UntisLesson,
} from '@/src/types';

/** A WebUntis booking ("Zusätzlicher Unterricht") is flagged by this lessonCode. */
const WEBUNTIS_ACTIVITY_CODE = 'WEBUNTIS_ACTIVITY';

/**
 * Strip manually-created WebUntis bookings that land on a non-school day from a
 * full-year merged lesson set.
 *
 * The classic range API can't distinguish a booking from a real lesson, so we
 * (1) flag suspects cheaply via {@link findSuspiciousLessons} (outlier lsnumber),
 * (2) confirm them authoritatively via the weekly REST API's `lessonCode`
 * (`WEBUNTIS_ACTIVITY`), then (3) drop only those confirmed bookings that fall on
 * a weekday the class never has school ({@link removeNonSchoolDayBookings}).
 *
 * Cost: zero extra API calls in the common case (no suspect ⇒ early return); a
 * handful of week fetches only for the rare class that actually has a booking.
 * `classIds` is the merged class set — the booking's period id surfaces under the
 * class it belongs to, so we probe each member's week and union the hits.
 *
 * Requires a full-year `lessons` set: school-day detection needs the first weeks.
 * Do NOT call on a single-day range.
 */
export async function stripWebUntisBookings(
  untis: WebUntis,
  classIds: number[],
  lessons: UntisLesson[],
): Promise<UntisLesson[]> {
  const suspects = findSuspiciousLessons(lessons);
  if (suspects.length === 0) return lessons;

  // One representative date per distinct ISO week containing a suspect.
  const weekDates = new Map<number, Date>();
  for (const s of suspects) {
    const d = parseUntisDate(s.date);
    weekDates.set(getWeekKey(d), d);
  }

  // Probe each (week × class); the booking's period id appears under its own class.
  const tasks = [...weekDates.values()].flatMap((date) =>
    classIds.map((classId) => ({ date, classId })),
  );
  const bookingIds = new Set<number>();
  await mapWithConcurrency(tasks, 4, async ({ date, classId }) => {
    const week = await fetchClassTimetableWeek(untis, date, classId);
    for (const e of week) {
      if (e.lessonCode === WEBUNTIS_ACTIVITY_CODE) bookingIds.add(e.id);
    }
  });

  return removeNonSchoolDayBookings(lessons, bookingIds);
}

/**
 * Fetch the merged, de-duplicated lessons for a set of classes over a date range.
 * Each lesson is tagged with the class it was fetched under (`sourceClassId`) so a
 * merged day can attribute it to the right class; duplicates shared across
 * companion classes are removed by id. Shared by the year calendar
 * ({@link buildClassCalendar}) and the single-day timetable preview route.
 */
export async function fetchMergedClassLessons(
  untis: WebUntis,
  range: { startDate: Date; endDate: Date },
  classIds: number[],
): Promise<UntisLesson[]> {
  // Companion sets are small, so fetch all timetables in parallel.
  // fetchClassTimetable handles WebUntis rate-limit retries + boundary validation.
  const lessonArrays = await Promise.all(
    classIds.map((id) => fetchClassTimetable(untis, range, id)),
  );
  // Dedup keeps first-seen → primary class wins ties.
  const tagged = lessonArrays.map((arr, i) =>
    arr.map((l) => ({ ...l, sourceClassId: classIds[i] })),
  );
  return deduplicateLessons(tagged);
}

/** All school years, newest first. */
export async function fetchSchoolYearSummaries(untis: WebUntis): Promise<SchoolYearSummary[]> {
  const raw = await untis.getSchoolyears(true);
  return raw
    .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())
    .map(
      (y): SchoolYearSummary => ({
        id: y.id,
        name: y.name,
        startDate: new Date(y.startDate).toISOString(),
        endDate: new Date(y.endDate).toISOString(),
      }),
    );
}

/** Quarter/semester boundaries for a school year (null → current year). */
export async function fetchSchoolPeriodsForYear(
  untis: WebUntis,
  yearId: number | null,
): Promise<SchoolPeriod[]> {
  const schoolYear = toUntisSchoolYear(await resolveSchoolyear(untis, yearId));
  return fetchSchoolPeriods(untis, schoolYear);
}

/**
 * Build the (teacher, day) → real-reason map for Unterrichtsausfall days.
 *
 * A cancelled lesson carries no reason of its own; the teacher who would hold it
 * has an all-day "Unterrichtsausfall: …" event naming the true cause (e.g. "QV BM &
 * KV"). We fetch that event only for the teachers of lessons cancelled on days
 * already classified as Unterrichtsausfall — so cost scales with the (few) ausfall
 * days, not the whole year. Best-effort: any failure (e.g. no read access to
 * teacher timetables) degrades to an empty map, keeping the class-level reason.
 */
async function fetchTeacherAusfallReasons(
  untis: WebUntis,
  lessons: UntisLesson[],
  ausfallDates: ReadonlySet<number>,
): Promise<TeacherReasonMap> {
  // Distinct (teacher, day) pairs among lessons cancelled on an Unterrichtsausfall day.
  const pairs = new Map<string, { name: string; date: number }>();
  for (const l of lessons) {
    if (l.code !== 'cancelled' || !ausfallDates.has(l.date)) continue;
    for (const t of l.te ?? []) {
      pairs.set(teacherReasonKey(t.name, l.date), { name: t.name, date: l.date });
    }
  }
  if (pairs.size === 0) return new Map();

  try {
    const teachers = await untis.getTeachers();
    const idByName = new Map<string, number>();
    for (const t of teachers) idByName.set(t.name, t.id);

    const tasks = [...pairs.values()].filter((p) => idByName.has(p.name));
    const reasons = new Map<string, string>();
    await mapWithConcurrency(tasks, 4, async (p) => {
      const periods = await fetchTeacherTimetableDay(
        untis,
        parseUntisDate(p.date),
        idByName.get(p.name)!,
      );
      const reason = periods.map(extractAusfallReason).find(Boolean);
      if (reason) reasons.set(teacherReasonKey(p.name, p.date), reason);
    });
    return reasons;
  } catch {
    // Teacher-timetable access may be denied for the service account — fall back
    // silently to the class-level reason rather than failing the whole calendar.
    return new Map();
  }
}

/**
 * Classified school-year calendar for a set of merged class timetables
 * (a class plus its companions). Fetches holidays + all timetables, tags and
 * dedups the lessons, and classifies every day of the year.
 */
export async function buildClassCalendar(
  untis: WebUntis,
  yearId: number | null,
  classIds: number[],
): Promise<CalendarData> {
  const schoolYear = toUntisSchoolYear(await resolveSchoolyear(untis, yearId));

  // Holidays fetch runs in parallel with the (already-parallel) class timetables.
  const [rawHolidays, rawLessons] = await Promise.all([
    untis.getHolidays(true),
    fetchMergedClassLessons(untis, schoolYear, classIds),
  ]);
  const holidays = parseUntisHolidays(rawHolidays, 'holidays');
  // Drop manually-created WebUntis bookings on non-school days so they don't paint
  // phantom lessons onto free days (or invent school days).
  const lessons = await stripWebUntisBookings(untis, classIds, rawLessons);

  // First pass finds which days are Unterrichtsausfall; the second pass enriches
  // their cancelled lessons with the real reason pulled from the teacher timetables.
  const firstPass = classifyDays(schoolYear, holidays, lessons);
  const ausfallDates = new Set(
    firstPass
      .filter((d: CalendarDay) => d.type === 'unterrichtsausfall')
      .map((d) => isoToUntisDate(d.date)),
  );
  const teacherReasons = await fetchTeacherAusfallReasons(untis, lessons, ausfallDates);
  const days = teacherReasons.size
    ? classifyDays(schoolYear, holidays, lessons, teacherReasons)
    : firstPass;

  return {
    schoolYear: {
      id: schoolYear.id,
      name: schoolYear.name,
      startDate: schoolYear.startDate.toISOString(),
      endDate: schoolYear.endDate.toISOString(),
    },
    days,
  } satisfies CalendarData;
}
