import { NextResponse } from 'next/server';
import type { WebUntis } from 'webuntis';
import { withUntisClient, resolveSchoolyear, mapWithConcurrency } from '@/src/lib/webuntis';
import { classifyDays, deduplicateLessons, buildHolidayDateMap } from '@/src/lib/calendar';
import { aggregateClassDays, type PerClassClassification } from '@/src/lib/aggregate';
import { listActiveClassesEnriched } from '@/src/lib/classes-server';
import { groupClassesByPlan } from '@/src/lib/planGroups';
import type {
  AggregatedCalendarData,
  UntisHoliday,
  UntisLesson,
  UntisSchoolYear,
} from '@/src/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 120; // seconds — allow up to 2 min for full-school fetch

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** True when a thrown error looks like a WebUntis rate-limit (429 / ECONNRESET). */
function isRateLimitError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message;
  return /429|ECONNRESET|rate.?limit/i.test(msg);
}

/**
 * Fetch one class's timetable with a single retry on rate-limit errors.
 * Backs off for 1.5s before retrying — empirically enough to clear the limit.
 */
async function fetchTimetableWithRetry(
  untis: WebUntis,
  schoolYear: UntisSchoolYear,
  classId: number,
): Promise<UntisLesson[]> {
  try {
    return (await untis.getTimetableForRange(
      schoolYear.startDate,
      schoolYear.endDate,
      classId,
      1, // WebUntis.TYPES.CLASS
    )) as UntisLesson[];
  } catch (err) {
    if (!isRateLimitError(err)) throw err;
    await sleep(1500);
    return (await untis.getTimetableForRange(
      schoolYear.startDate,
      schoolYear.endDate,
      classId,
      1,
    )) as UntisLesson[];
  }
}

export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const yearIdParam = searchParams.get('schoolyearId');
  const yearId = yearIdParam ? parseInt(yearIdParam, 10) : null;

  try {
    const result = await withUntisClient(async (untis) => {
      const rawSchoolYear = await resolveSchoolyear(untis, yearId);
      const schoolYear: UntisSchoolYear = {
        id: rawSchoolYear.id,
        name: rawSchoolYear.name,
        startDate: new Date(rawSchoolYear.startDate),
        endDate: new Date(rawSchoolYear.endDate),
      };

      // Classes and holidays are independent — fetch in parallel.
      const [classes, holidays] = await Promise.all([
        listActiveClassesEnriched(untis, schoolYear.id),
        untis.getHolidays(true) as Promise<UntisHoliday[]>,
      ]);

      // Collect every unique class ID we need a timetable for (a class may appear
      // as a companion of another, so dedupe across all fetchIds).
      const uniqueClassIds = new Set<number>();
      for (const c of classes) {
        for (const id of c.fetchIds ?? [c.id]) uniqueClassIds.add(id);
      }
      const uniqueIds = Array.from(uniqueClassIds);

      // WebUntis rate-limits aggressive concurrency (ECONNRESET / 429).
      // 4 concurrent fetches with retry-on-429 keeps us safely under the limit.
      const lessonsPerId = await mapWithConcurrency(
        uniqueIds,
        4,
        async (id): Promise<UntisLesson[]> => {
          return fetchTimetableWithRetry(untis, schoolYear, id);
        },
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
      const perClass: PerClassClassification[] = groups
        .map((g) => {
          const merged = deduplicateLessons(g.memberIds.map((id) => lessonsById.get(id) ?? []));
          return { group: g, merged };
        })
        .filter(({ merged }) => merged.length > 0)
        .map(({ group: g, merged }) => ({
          className: g.representative.name,
          classId: g.representative.id,
          days: classifyDays(schoolYear, holidays, merged),
        }));

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
    });

    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch aggregated calendar';
    console.error('Error fetching aggregated calendar:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
