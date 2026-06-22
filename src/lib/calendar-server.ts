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
} from '@/src/lib/calendar';
import type { CalendarData, SchoolPeriod, SchoolYearSummary, UntisLesson } from '@/src/types';

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
  const days = classifyDays(schoolYear, holidays, lessons);

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
