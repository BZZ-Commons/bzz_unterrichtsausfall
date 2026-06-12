import { NextResponse } from 'next/server';
import { withUntisClient } from '@/src/lib/webuntis';
import { fetchSchoolPeriodsForYear } from '@/src/lib/calendar-server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const yearIdParam = searchParams.get('schoolyearId');
  const yearId = yearIdParam ? parseInt(yearIdParam, 10) : null;

  try {
    const periods = await withUntisClient((untis) => fetchSchoolPeriodsForYear(untis, yearId));
    return NextResponse.json(periods);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch school periods';
    console.error('Error fetching school periods:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
