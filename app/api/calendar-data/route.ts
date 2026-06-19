import { NextResponse } from 'next/server';
import { withUntisClient } from '@/src/lib/webuntis';
import { buildClassCalendar } from '@/src/lib/calendar-server';
import { withRateLimit } from '@/src/lib/apiRateLimit';
import { errorResponse } from '@/src/lib/apiError';

export const dynamic = 'force-dynamic';

export const GET = withRateLimit(async (request: Request): Promise<NextResponse> => {
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
    return NextResponse.json(
      { error: 'Invalid classIds: must be comma-separated numbers' },
      { status: 400 },
    );
  }

  const yearId = yearIdParam ? parseInt(yearIdParam, 10) : null;

  try {
    const result = await withUntisClient((untis) => buildClassCalendar(untis, yearId, allClassIds));

    // Single-class data is deliberately uncached at every layer (no server cache,
    // no client cache) — each request hits WebUntis live. Only the slow
    // "Alle Klassen" aggregate (calendar-data-all) is cached. `no-store` makes
    // that guarantee explicit to browsers/proxies too.
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error: unknown) {
    return errorResponse('Fehler beim Laden der Kalenderdaten.', error);
  }
});
