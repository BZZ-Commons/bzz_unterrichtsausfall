import { NextResponse } from 'next/server';
import { withUntisClient } from '@/src/lib/webuntis';
import { fetchSchoolPeriodsForYear } from '@/src/lib/calendar-server';
import { withRateLimit } from '@/src/lib/apiRateLimit';
import { errorResponse } from '@/src/lib/apiError';

export const dynamic = 'force-dynamic';

export const GET = withRateLimit(async (request: Request): Promise<NextResponse> => {
  const { searchParams } = new URL(request.url);
  const yearIdParam = searchParams.get('schoolyearId');
  const yearId = yearIdParam ? parseInt(yearIdParam, 10) : null;

  try {
    const periods = await withUntisClient((untis) => fetchSchoolPeriodsForYear(untis, yearId));
    return NextResponse.json(periods);
  } catch (error: unknown) {
    return errorResponse('Fehler beim Laden der Schulperioden.', error);
  }
});
