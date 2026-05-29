import { NextResponse } from 'next/server';
import { withUntisClient, resolveSchoolyearId } from '@/src/lib/webuntis';
import {
  getCompanionNames,
  getCompanionClassIds,
  buildClassMap,
  isIAClass,
  getIAYearsWithC,
  iaNeedsDialog,
} from '@/src/lib/classGroups';
import type { UntisClass } from '@/src/types';

export const dynamic = 'force-dynamic';

const PREFIX_ORDER = ['IA', 'IM', 'KV', 'ME', 'FB', 'AB', 'BM'];

function prefixRank(name: string): number {
  const prefix = name.match(/^[A-Za-z]+/)?.[0]?.toUpperCase() ?? '';
  const idx = PREFIX_ORDER.findIndex((p) => prefix.startsWith(p));
  return idx === -1 ? PREFIX_ORDER.length : idx;
}

export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const yearIdParam = searchParams.get('schoolyearId');
  const yearId = yearIdParam ? parseInt(yearIdParam, 10) : null;

  try {
    const classes = await withUntisClient(async (untis) => {
      const schoolYearId = await resolveSchoolyearId(untis, yearId);
      const raw = await untis.getClasses(true, schoolYearId) as UntisClass[];
      const active = raw.filter((c) => c.active);

      const classMap = buildClassMap(active);
      const iaYearsWithC = getIAYearsWithC(active);

      return active
        .sort((a, b) => {
          const rankDiff = prefixRank(a.name) - prefixRank(b.name);
          return rankDiff !== 0 ? rankDiff : a.name.localeCompare(b.name);
        })
        .map((c): UntisClass => {
          if (isIAClass(c.name) && iaNeedsDialog(c.name, iaYearsWithC)) {
            return { ...c, companionNames: [], fetchIds: [c.id] };
          }
          const companionIds = getCompanionClassIds(c.name, classMap);
          return {
            ...c,
            companionNames: getCompanionNames(c.name),
            fetchIds: [c.id, ...companionIds],
          };
        });
    });

    return NextResponse.json(classes);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch classes';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
