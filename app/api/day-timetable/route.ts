import { NextResponse } from 'next/server';
import { withUntisClient } from '@/src/lib/webuntis';
import { buildDayTimetable } from '@/src/lib/dayTimetable';
import { fetchMergedClassLessons, fetchSchoolYearSummaries } from '@/src/lib/calendar-server';
import { findSchoolYearForDate, isPreviewGateOpen } from '@/src/lib/schoolYear';
import type { DayTimetable } from '@/src/types';

export const dynamic = 'force-dynamic';

/**
 * Lightweight single-day timetable for the inline preview (DayTimetablePreview).
 * Unlike /api/calendar-data (whole school year), this fetches just the one day
 * for the merged class set — cheap enough to load on demand when a day dialog
 * opens. Companion duplicates are removed by lesson id.
 *
 * Mirrors the UI gate (see `previewAllowed` in app/page.tsx): the preview is only
 * served once the requested day's school year has begun — a not-yet-started year's
 * plan is still a draft. The dev server bypasses the gate (always available for
 * testing). This is the server-side half of that gate (defense in depth).
 *
 * Query: ?classIds=123,456&date=YYYY-MM-DD
 */
export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const classIdsParam = searchParams.get('classIds');
  const dateParam = searchParams.get('date');

  if (!classIdsParam || !dateParam) {
    return NextResponse.json(
      { error: 'Missing required parameters: classIds, date' },
      { status: 400 },
    );
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    return NextResponse.json({ error: 'Invalid date: expected YYYY-MM-DD' }, { status: 400 });
  }

  const classIds = classIdsParam
    .split(',')
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !isNaN(n));

  if (classIds.length === 0) {
    return NextResponse.json(
      { error: 'Invalid classIds: must be comma-separated numbers' },
      { status: 400 },
    );
  }

  const day = new Date(`${dateParam}T00:00:00`);
  // Dev server is exempt from the school-year gate (always available for testing).
  const enforceGate = process.env.NODE_ENV === 'production';

  try {
    const result = await withUntisClient(async (untis) => {
      // Gate check and the day's lessons fetch run together so the happy path
      // (a started year) pays no extra round-trip latency.
      const range = { startDate: day, endDate: day };
      const [years, lessons] = await Promise.all([
        enforceGate ? fetchSchoolYearSummaries(untis) : Promise.resolve(null),
        fetchMergedClassLessons(untis, range, classIds),
      ]);

      // `years` is non-null only in production (the dev server skips the fetch and
      // the gate). Unknown/not-yet-started year → gated (isPreviewGateOpen is false).
      if (years && !isPreviewGateOpen(findSchoolYearForDate(years, day.getTime()), Date.now())) {
        return null;
      }

      return { date: dateParam, lessons: buildDayTimetable(lessons) } satisfies DayTimetable;
    });

    if (result === null) {
      return NextResponse.json(
        { error: 'Preview is only available once the school year has started' },
        { status: 403 },
      );
    }

    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch day timetable';
    console.error('Error fetching day timetable:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
