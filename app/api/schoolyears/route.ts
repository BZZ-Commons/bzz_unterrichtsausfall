import { NextResponse } from 'next/server';
import { withUntisClient } from '@/src/lib/webuntis';
import { getCached, setCached, clearAllCaches } from '@/src/lib/cache';
import type { SchoolYearSummary } from '@/src/types';

export const dynamic = 'force-dynamic';

const CACHE_KEY = 'schoolyears';
const TTL = 60 * 60 * 1000;

export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);

  if (searchParams.get('clearCache') === 'true') clearAllCaches();

  const cached = getCached<SchoolYearSummary[]>(CACHE_KEY);
  if (cached) return NextResponse.json(cached);

  try {
    const years = await withUntisClient(async (untis) => {
      const raw = await untis.getSchoolyears(true);
      return raw
        .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())
        .map((y): SchoolYearSummary => ({
          id: y.id,
          name: y.name,
          startDate: new Date(y.startDate).toISOString(),
          endDate: new Date(y.endDate).toISOString(),
        }));
    });
    setCached(CACHE_KEY, years, TTL);
    return NextResponse.json(years);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch school years';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
