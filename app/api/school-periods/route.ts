import { NextResponse } from 'next/server';
import { withUntisClient, resolveSchoolyear } from '@/src/lib/webuntis';
import { fetchSchoolPeriods } from '@/src/lib/schoolPeriods';
import type { UntisSchoolYear } from '@/src/types';

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const yearIdParam = searchParams.get('schoolyearId');
  const yearId = yearIdParam ? parseInt(yearIdParam, 10) : null;

  try {
    const periods = await withUntisClient(async (untis) => {
      const raw = await resolveSchoolyear(untis, yearId);
      const schoolYear: UntisSchoolYear = {
        id: raw.id,
        name: raw.name,
        startDate: new Date(raw.startDate),
        endDate: new Date(raw.endDate),
      };
      return fetchSchoolPeriods(untis, schoolYear);
    });

    return NextResponse.json(periods);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch school periods';
    console.error('Error fetching school periods:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
