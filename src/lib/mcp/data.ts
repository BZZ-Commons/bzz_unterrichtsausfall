import { getCached } from '@/src/lib/serverCache';
import { withUntisClient, resolveSchoolyearId } from '@/src/lib/webuntis';
import { listActiveClassesEnriched } from '@/src/lib/classes-server';
import {
  buildClassCalendar,
  fetchSchoolPeriodsForYear,
  fetchSchoolYearSummaries,
} from '@/src/lib/calendar-server';
import type { CalendarData, SchoolPeriod, SchoolYearSummary, UntisClass } from '@/src/types';

/**
 * Cached WebUntis accessors for the MCP server.
 *
 * Each function wraps a shared server-side fetcher (calendar-server.ts /
 * classes-server.ts — the same code the API routes call) in the in-process
 * server cache so repeated MCP tool calls don't hammer WebUntis. MCP data may
 * be up to TTL_MS stale, which is fine for a calendar.
 */

const TTL_MS = 15 * 60_000;

const yearKey = (id: number | null) => id ?? 'current';

/** School years, newest first. */
export function getSchoolYearsCached(): Promise<SchoolYearSummary[]> {
  return getCached('mcp:schoolyears', TTL_MS, () => withUntisClient(fetchSchoolYearSummaries));
}

/** Active classes incl. companions + fetchIds. */
export function getClassesCached(yearId: number | null): Promise<UntisClass[]> {
  return getCached(`mcp:classes:${yearKey(yearId)}`, TTL_MS, () =>
    withUntisClient(async (untis) => {
      const schoolYearId = await resolveSchoolyearId(untis, yearId);
      return listActiveClassesEnriched(untis, schoolYearId);
    }),
  );
}

/** Quarter/semester boundaries. */
export function getSchoolPeriodsCached(yearId: number | null): Promise<SchoolPeriod[]> {
  return getCached(`mcp:periods:${yearKey(yearId)}`, TTL_MS, () =>
    withUntisClient((untis) => fetchSchoolPeriodsForYear(untis, yearId)),
  );
}

/** Classified school-year calendar for a class (self + companion fetch IDs). */
export function getClassCalendarCached(
  fetchIds: number[],
  yearId: number | null,
): Promise<CalendarData> {
  const idsKey = [...fetchIds].sort((a, b) => a - b).join(',');
  return getCached(`mcp:calendar:${yearKey(yearId)}:${idsKey}`, TTL_MS, () =>
    withUntisClient((untis) => buildClassCalendar(untis, yearId, fetchIds)),
  );
}
