import { NextResponse } from 'next/server';
import { withUntisClient } from '@/src/lib/webuntis';
import { fetchSchoolYearSummaries } from '@/src/lib/calendar-server';
import { withRateLimit } from '@/src/lib/apiRateLimit';
import { errorResponse } from '@/src/lib/apiError';

export const dynamic = 'force-dynamic';

export const GET = withRateLimit(async (): Promise<NextResponse> => {
  try {
    const years = await withUntisClient(fetchSchoolYearSummaries);
    return NextResponse.json(years);
  } catch (error: unknown) {
    return errorResponse('Fehler beim Laden der Schuljahre.', error);
  }
});
