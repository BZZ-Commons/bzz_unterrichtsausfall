import { NextResponse } from 'next/server';
import {
  withUntisClient,
  resolveSchoolyear,
  mapWithConcurrency,
  fetchClassTimetable,
} from '@/src/lib/webuntis';
import { parseUntisHolidays } from '@/src/lib/untisBoundary';
import { getCached } from '@/src/lib/serverCache';
import { classifyDays, deduplicateLessons, buildHolidayDateMap } from '@/src/lib/calendar';
import { aggregateClassDays, type PerClassClassification } from '@/src/lib/aggregate';
import { stripWebUntisBookings } from '@/src/lib/calendar-server';
import { listActiveClassesEnriched } from '@/src/lib/classes-server';
import { groupClassesByPlan } from '@/src/lib/planGroups';
import { withRateLimit } from '@/src/lib/apiRateLimit';
import { errorResponse } from '@/src/lib/apiError';
import type { AggregatedCalendarData, UntisLesson, UntisSchoolYear } from '@/src/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 120; // seconds — allow up to 2 min for full-school fetch

/**
 * Server-side cache TTL for the aggregated fetch. The full-school fetch takes
 * 30–60s, so caching it in-process spares every fresh visitor that cost. 15 min
 * is short enough that same-day cancellation edits surface quickly.
 */
const AGGREGATE_CACHE_TTL_MS = 15 * 60 * 1000;

export const GET = withRateLimit(async (request: Request): Promise<NextResponse> => {
  const { searchParams } = new URL(request.url);
  const yearIdParam = searchParams.get('schoolyearId');
  const yearId = yearIdParam ? parseInt(yearIdParam, 10) : null;

  try {
    // Cache the whole aggregated result in-process (single-process standalone
    // deployment). The 'current' year resolves server-side, so the cache key
    // uses the literal param ('current' when unset — it only rolls over yearly).
    const cacheKey = `calendar-data-all:${yearIdParam ?? 'current'}`;
    const result = await getCached(cacheKey, AGGREGATE_CACHE_TTL_MS, () =>
      withUntisClient(async (untis) => {
        const rawSchoolYear = await resolveSchoolyear(untis, yearId);
        const schoolYear: UntisSchoolYear = {
          id: rawSchoolYear.id,
          name: rawSchoolYear.name,
          startDate: new Date(rawSchoolYear.startDate),
          endDate: new Date(rawSchoolYear.endDate),
        };

        // Classes and holidays are independent — fetch in parallel.
        const [classes, rawHolidays] = await Promise.all([
          listActiveClassesEnriched(untis, schoolYear.id),
          untis.getHolidays(true),
        ]);
        const holidays = parseUntisHolidays(rawHolidays, 'holidays');

        // Collect every unique class ID we need a timetable for (a class may appear
        // as a companion of another, so dedupe across all fetchIds).
        const uniqueClassIds = new Set<number>();
        for (const c of classes) {
          for (const id of c.fetchIds ?? [c.id]) uniqueClassIds.add(id);
        }
        const uniqueIds = Array.from(uniqueClassIds);

        // WebUntis rate-limits aggressive concurrency (ECONNRESET / 429).
        // 4 concurrent fetches, each with its own retry-on-429 (in fetchClassTimetable),
        // keeps us safely under the limit.
        const lessonsPerId = await mapWithConcurrency(
          uniqueIds,
          4,
          (id): Promise<UntisLesson[]> => fetchClassTimetable(untis, schoolYear, id),
        );

        // Map: classId → lessons[]
        const lessonsById = new Map<number, UntisLesson[]>();
        uniqueIds.forEach((id, idx) => lessonsById.set(id, lessonsPerId[idx] ?? []));

        // Collapse classes that share a timetable into one "plan" group so the
        // overview counts each timetable once instead of listing every companion
        // (e.g. ME24 a + AB24 a, or IA24 a + BM24 a + AB24 c). A group's plan is
        // the union of its member classes' OWN timetables.
        const groups = groupClassesByPlan(classes);

        // For each group: merge its members' lessons and classify.
        // Skip groups with zero lessons across the entire year — these are inactive
        // (often electives or placeholder classes) and would otherwise pollute the
        // aggregate, since `determineSchoolDays` falls back to "all weekdays" when
        // no lessons exist, turning every weekday into `schulausfall`.
        const groupsWithLessons = groups
          .map((g) => ({
            group: g,
            merged: deduplicateLessons(g.memberIds.map((id) => lessonsById.get(id) ?? [])),
          }))
          .filter(({ merged }) => merged.length > 0);

        // Strip non-school-day WebUntis bookings per group before classifying. Bounded
        // concurrency mirrors the timetable fetch; groups without a suspect booking
        // early-return inside stripWebUntisBookings (no extra WebUntis call).
        const perClass: PerClassClassification[] = await mapWithConcurrency(
          groupsWithLessons,
          4,
          async ({ group: g, merged }): Promise<PerClassClassification> => ({
            className: g.representative.name,
            classId: g.representative.id,
            days: classifyDays(
              schoolYear,
              holidays,
              await stripWebUntisBookings(untis, g.memberIds, merged),
            ),
          }),
        );

        const days = aggregateClassDays(perClass, buildHolidayDateMap(holidays));

        return {
          schoolYear: {
            id: schoolYear.id,
            name: schoolYear.name,
            startDate: schoolYear.startDate.toISOString(),
            endDate: schoolYear.endDate.toISOString(),
          },
          days,
        } satisfies AggregatedCalendarData;
      }),
    );

    return NextResponse.json(result);
  } catch (error: unknown) {
    return errorResponse('Fehler beim Laden des Kalenders.', error);
  }
});
