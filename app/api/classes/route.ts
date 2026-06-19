import { NextResponse } from 'next/server';
import { withUntisClient, resolveSchoolyearId } from '@/src/lib/webuntis';
import { listActiveClassesEnriched } from '@/src/lib/classes-server';
import { withRateLimit } from '@/src/lib/apiRateLimit';
import { errorResponse } from '@/src/lib/apiError';

export const dynamic = 'force-dynamic';

export const GET = withRateLimit(async (request: Request): Promise<NextResponse> => {
  const { searchParams } = new URL(request.url);
  const yearIdParam = searchParams.get('schoolyearId');
  const yearId = yearIdParam ? parseInt(yearIdParam, 10) : null;

  try {
    const classes = await withUntisClient(async (untis) => {
      const schoolYearId = await resolveSchoolyearId(untis, yearId);
      return listActiveClassesEnriched(untis, schoolYearId);
    });

    return NextResponse.json(classes);
  } catch (error: unknown) {
    return errorResponse('Fehler beim Laden der Klassen.', error);
  }
});
