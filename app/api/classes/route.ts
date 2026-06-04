import { NextResponse } from 'next/server';
import { withUntisClient, resolveSchoolyearId } from '@/src/lib/webuntis';
import { listActiveClassesEnriched } from '@/src/lib/classes-server';
import { getCached, setCached, clearAllCaches } from '@/src/lib/cache';

export const dynamic = 'force-dynamic';

const TTL = 60 * 60 * 1000;

export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const yearIdParam = searchParams.get('schoolyearId');
  const yearId = yearIdParam ? parseInt(yearIdParam, 10) : null;

  if (searchParams.get('clearCache') === 'true') clearAllCaches();

  const cacheKey = `classes:${yearId ?? 'current'}`;
  const cached = getCached(cacheKey);
  if (cached) return NextResponse.json(cached);

  try {
    const classes = await withUntisClient(async (untis) => {
      const schoolYearId = await resolveSchoolyearId(untis, yearId);
      return listActiveClassesEnriched(untis, schoolYearId);
    });

    setCached(cacheKey, classes, TTL);
    return NextResponse.json(classes);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch classes';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
