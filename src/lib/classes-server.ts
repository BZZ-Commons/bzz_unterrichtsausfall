import type { WebUntis } from 'webuntis';
import {
  getCompanionNames,
  getCompanionClassIds,
  buildClassMap,
  isIAClass,
  getIAYearsWithC,
  iaNeedsDialog,
} from '@/src/lib/classGroups';
import type { UntisClass } from '@/src/types';

const PREFIX_ORDER = ['IA', 'IM', 'KV', 'ME', 'FB', 'AB', 'BM'];

function prefixRank(name: string): number {
  const prefix = name.match(/^[A-Za-z]+/)?.[0]?.toUpperCase() ?? '';
  const idx = PREFIX_ORDER.findIndex((p) => prefix.startsWith(p));
  return idx === -1 ? PREFIX_ORDER.length : idx;
}

/**
 * Fetch the active classes for a school year and enrich each with
 * `companionNames` and pre-resolved `fetchIds` (self + companion IDs).
 *
 * Pure server-side helper — must be called from within `withUntisClient()`.
 * IA a/b classes whose year has no IA c keep `fetchIds = [self]` so the
 * client can show the BM/ABU dialog.
 */
export async function listActiveClassesEnriched(
  untis: WebUntis,
  schoolYearId: number,
): Promise<UntisClass[]> {
  const raw = (await untis.getClasses(true, schoolYearId)) as UntisClass[];
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
}
