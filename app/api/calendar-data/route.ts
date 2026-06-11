import { NextResponse } from 'next/server';
import { withUntisClient, resolveSchoolyear } from '@/src/lib/webuntis';
import { classifyDays, deduplicateLessons } from '@/src/lib/calendar';
import type { CalendarData, UntisHoliday, UntisLesson, UntisSchoolYear } from '@/src/types';

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const classIdsParam = searchParams.get('classIds');
  const yearIdParam = searchParams.get('schoolyearId');

  if (!classIdsParam) {
    return NextResponse.json({ error: 'Missing required parameter: classIds' }, { status: 400 });
  }

  const allClassIds = classIdsParam
    .split(',')
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !isNaN(n));

  if (allClassIds.length === 0) {
    return NextResponse.json({ error: 'Invalid classIds: must be comma-separated numbers' }, { status: 400 });
  }

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

      const [holidays, ...lessonArrays] = await Promise.all([
        untis.getHolidays(true) as Promise<UntisHoliday[]>,
        ...allClassIds.map(
          (id) => untis.getTimetableForRange(
            schoolYear.startDate,
            schoolYear.endDate,
            id,
            1 // WebUntis.TYPES.CLASS
          ) as Promise<UntisLesson[]>
        ),
      ]);

      // Tag each lesson with the class it was fetched under so a merged day can link
      // each half to the right class. Dedup keeps first-seen → primary class wins ties.
      const taggedArrays = lessonArrays.map((arr, i) =>
        arr.map((l) => ({ ...l, sourceClassId: allClassIds[i] })),
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
    });

    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch calendar data';
    console.error('Error fetching calendar data:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
