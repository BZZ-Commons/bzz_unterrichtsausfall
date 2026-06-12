import { NextResponse } from 'next/server';
import { withUntisClient } from '@/src/lib/webuntis';
import { fetchSchoolYearSummaries } from '@/src/lib/calendar-server';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  try {
    const years = await withUntisClient(fetchSchoolYearSummaries);
    return NextResponse.json(years);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch school years';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
