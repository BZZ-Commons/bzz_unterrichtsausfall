import { describe, it, expect } from 'vitest';
import { groupClassesByPlan } from '@/src/lib/planGroups';
import type { UntisClass } from '@/src/types';

function cls(name: string, id: number, fetchIds: number[]): UntisClass {
  return { id, name, longName: name, active: true, fetchIds };
}

// Mirrors the real WebUntis data shape (ids and companion pairings from BZZ).
const IA24a = cls('IA24 a', 4110, [4110]); // IA a/b are dialog classes → self only
const IA24b = cls('IA24 b', 4113, [4113]);
const BM24a = cls('BM24 a', 3861, [3861, 4110]); // BM a ↔ IA a
const BM24b = cls('BM24 b', 3864, [3864, 4113]); // BM b ↔ IA b
const AB24c = cls('AB24 c', 3813, [3813, 4110, 4113]); // ABU combines IA a + IA b
const ME24a = cls('ME24 a', 4263, [4263, 3807]); // ME a ↔ AB a
const AB24a = cls('AB24 a', 3807, [3807, 4263]);
const IM23a = cls('IM23 a', 4122, [4122]); // standalone
const AB25b = cls('AB25 b', 3825, [3825]); // companion ME25 b missing → unresolved, self only

const nameById = new Map(
  [IA24a, IA24b, BM24a, BM24b, AB24c, ME24a, AB24a, IM23a, AB25b].map((c) => [c.id, c.name]),
);
/** Member class names of a group, sorted — derived from memberIds. */
function memberNames(g: { memberIds: number[] }): string[] {
  return g.memberIds.map((id) => nameById.get(id)!).sort((a, b) => a.localeCompare(b));
}

function groupOf(name: string, groups: ReturnType<typeof groupClassesByPlan>) {
  return groups.find((g) => memberNames(g).includes(name));
}

describe('groupClassesByPlan', () => {
  it('merges a mutual companion pair into one group (ME + AB)', () => {
    const groups = groupClassesByPlan([ME24a, AB24a]);
    expect(groups).toHaveLength(1);
    expect(groups[0].representative.name).toBe('ME24 a'); // ME outranks AB
    expect(memberNames(groups[0])).toEqual(['AB24 a', 'ME24 a']);
    expect([...groups[0].memberIds].sort()).toEqual([3807, 4263]);
  });

  it('merges IA + BM + ABU under the IA section, without merging the two IA sections', () => {
    const groups = groupClassesByPlan([IA24a, IA24b, BM24a, BM24b, AB24c]);

    const ga = groupOf('IA24 a', groups)!;
    const gb = groupOf('IA24 b', groups)!;
    expect(ga).not.toBe(gb); // the two IA sections stay separate

    // ABU (AB24 c) lands with IA24 a (alphabetically-first IA), not IA24 b.
    expect(ga.representative.name).toBe('IA24 a');
    expect(memberNames(ga)).toEqual(['AB24 c', 'BM24 a', 'IA24 a']);
    expect(gb.representative.name).toBe('IA24 b');
    expect(memberNames(gb)).toEqual(['BM24 b', 'IA24 b']);

    // The plan is member SELF-ids only — IA24 a's group must NOT contain IA24 b's
    // timetable (4113), even though AB24 c references it.
    expect([...ga.memberIds].sort()).toEqual([3813, 3861, 4110]);
    expect(ga.memberIds).not.toContain(4113);
  });

  it('keeps a standalone class as its own group', () => {
    const groups = groupClassesByPlan([IM23a]);
    expect(groups).toHaveLength(1);
    expect(memberNames(groups[0])).toEqual(['IM23 a']);
  });

  it('keeps a class whose companion does not exist as its own group', () => {
    const groups = groupClassesByPlan([AB25b]);
    expect(groups).toHaveLength(1);
    expect(groups[0].representative.name).toBe('AB25 b');
  });

  it('produces one group per distinct plan over a mixed set', () => {
    const groups = groupClassesByPlan([IA24a, IA24b, BM24a, BM24b, AB24c, ME24a, AB24a, IM23a, AB25b]);
    // IA24 a, IA24 b, ME24 a, IM23 a, AB25 b
    expect(groups).toHaveLength(5);
    // Every representative is one of the input classes (→ also in the dropdown).
    const inputNames = new Set(['IA24 a', 'IA24 b', 'BM24 a', 'BM24 b', 'AB24 c', 'ME24 a', 'AB24 a', 'IM23 a', 'AB25 b']);
    for (const g of groups) expect(inputNames.has(g.representative.name)).toBe(true);
  });
});
