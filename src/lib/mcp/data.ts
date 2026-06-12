import { getCached } from '@/src/lib/serverCache';
import {
  withUntisClient,
  resolveSchoolyear,
  resolveSchoolyearId,
  fetchClassTimetable,
} from '@/src/lib/webuntis';
import { listActiveClassesEnriched } from '@/src/lib/classes-server';
import { fetchSchoolPeriods } from '@/src/lib/schoolPeriods';
import { parseUntisHolidays } from '@/src/lib/untisBoundary';
import { classifyDays, deduplicateLessons } from '@/src/lib/calendar';
import type {
  CalendarData,
  SchoolPeriod,
  SchoolYearSummary,
  UntisClass,
  UntisSchoolYear,
} from '@/src/types';

/**
 * Cached WebUntis accessors for the MCP server.
 *
 * Each function mirrors the corresponding API route's logic exactly (the
 * duplication is deliberate — the routes stay untouched), but wraps the fetch
 * in the in-process server cache so repeated MCP tool calls don't hammer
 * WebUntis. MCP data may be up to TTL_MS stale, which is fine for a calendar.
 */

const TTL_MS = 15 * 60_000;

const yearKey = (id: number | null) => id ?? 'current';

/** School years, newest first. Mirrors app/api/schoolyears/route.ts. */
export function getSchoolYearsCached(): Promise<SchoolYearSummary[]> {
  return getCached('mcp:schoolyears', TTL_MS, () =>
    withUntisClient(async (untis) => {
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
    }),
  );
}

/** Active classes incl. companions + fetchIds. Mirrors app/api/classes/route.ts. */
export function getClassesCached(yearId: number | null): Promise<UntisClass[]> {
  return getCached(`mcp:classes:${yearKey(yearId)}`, TTL_MS, () =>
    withUntisClient(async (untis) => {
      const schoolYearId = await resolveSchoolyearId(untis, yearId);
      return listActiveClassesEnriched(untis, schoolYearId);
    }),
  );
}

/** Quarter/semester boundaries. Mirrors app/api/school-periods/route.ts. */
export function getSchoolPeriodsCached(yearId: number | null): Promise<SchoolPeriod[]> {
  return getCached(`mcp:periods:${yearKey(yearId)}`, TTL_MS, () =>
    withUntisClient(async (untis) => {
      const raw = await resolveSchoolyear(untis, yearId);
      const schoolYear: UntisSchoolYear = {
        id: raw.id,
        name: raw.name,
        startDate: new Date(raw.startDate),
        endDate: new Date(raw.endDate),
      };
      return fetchSchoolPeriods(untis, schoolYear);
    }),
  );
}

/**
 * Classified school-year calendar for a class (self + companion fetch IDs).
 * Mirrors app/api/calendar-data/route.ts.
 */
export function getClassCalendarCached(
  fetchIds: number[],
  yearId: number | null,
): Promise<CalendarData> {
  const idsKey = [...fetchIds].sort((a, b) => a - b).join(',');
  return getCached(`mcp:calendar:${yearKey(yearId)}:${idsKey}`, TTL_MS, () =>
    withUntisClient(async (untis) => {
      const rawSchoolYear = await resolveSchoolyear(untis, yearId);
      const schoolYear: UntisSchoolYear = {
        id: rawSchoolYear.id,
        name: rawSchoolYear.name,
        startDate: new Date(rawSchoolYear.startDate),
        endDate: new Date(rawSchoolYear.endDate),
      };

      // Companion sets are small, so fetch all timetables in parallel.
      // fetchClassTimetable handles WebUntis rate-limit retries + boundary validation.
      const [rawHolidays, ...lessonArrays] = await Promise.all([
        untis.getHolidays(true),
        ...fetchIds.map((id) => fetchClassTimetable(untis, schoolYear, id)),
      ]);
      const holidays = parseUntisHolidays(rawHolidays, 'holidays');

      // Tag each lesson with the class it was fetched under so a merged day can link
      // each half to the right class. Dedup keeps first-seen → primary class wins ties.
      const taggedArrays = lessonArrays.map((arr, i) =>
        arr.map((l) => ({ ...l, sourceClassId: fetchIds[i] })),
      );
      const lessons = deduplicateLessons(taggedArrays);
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
    }),
  );
}
