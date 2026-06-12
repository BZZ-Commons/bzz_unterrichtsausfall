import type { WebUntis } from 'webuntis';
import {
  getCompanionNames,
  getCompanionClassIds,
  buildClassMap,
  isIAClass,
  getIAYearsWithC,
  iaNeedsDialog,
} from '@/src/lib/classGroups';
import { matchesAllowedPrefix, compareClassPriority } from '@/src/lib/classPrefixes';
import { parseUntisClasses } from '@/src/lib/untisBoundary';
import type { UntisClass } from '@/src/types';

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
  const raw = parseUntisClasses(
    await untis.getClasses(true, schoolYearId),
    `classes for school year ${schoolYearId}`,
  );
  const active = raw.filter((c) => c.active && matchesAllowedPrefix(c.name));

  const classMap = buildClassMap(active);
  const iaYearsWithC = getIAYearsWithC(active);

  return active.sort(compareClassPriority).map((c): UntisClass => {
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
