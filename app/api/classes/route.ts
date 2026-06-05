import { NextResponse } from 'next/server';
import { withUntisClient, resolveSchoolyearId } from '@/src/lib/webuntis';
import { listActiveClassesEnriched } from '@/src/lib/classes-server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<NextResponse> {
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
    const message = error instanceof Error ? error.message : 'Failed to fetch classes';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
