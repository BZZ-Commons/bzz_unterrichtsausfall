import { NextResponse } from 'next/server';
import { withUntisClient } from '@/src/lib/webuntis';
import type { SchoolYearSummary } from '@/src/types';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
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
    return NextResponse.json(years);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch school years';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
