/**
 * Shared server-side WebUntis queries for the school-year calendar, used by
 * both the API routes and the MCP data layer (same pattern as
 * classes-server.ts). Callers run these inside `withUntisClient` and decide
 * about caching themselves.
 */

import type { WebUntis } from 'webuntis';
import { resolveSchoolyear, toUntisSchoolYear, fetchClassTimetable } from '@/src/lib/webuntis';
import { fetchSchoolPeriods } from '@/src/lib/schoolPeriods';
import { parseUntisHolidays } from '@/src/lib/untisBoundary';
import { classifyDays, deduplicateLessons } from '@/src/lib/calendar';
import type { CalendarData, SchoolPeriod, SchoolYearSummary, UntisLesson } from '@/src/types';

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
  const [rawHolidays, lessons] = await Promise.all([
    untis.getHolidays(true),
    fetchMergedClassLessons(untis, schoolYear, classIds),
  ]);
  const holidays = parseUntisHolidays(rawHolidays, 'holidays');
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
