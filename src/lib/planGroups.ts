import { compareClassPriority } from '@/src/lib/classPrefixes';
import type { UntisClass } from '@/src/types';

/** One "plan" — a set of classes that share a timetable, shown once in the overview. */
export interface PlanGroup {
  /** Highest-priority class in the group — used as the display name and link. */
  representative: UntisClass;
  /**
   * Class ids whose own timetables make up this group's combined plan.
   * NOTE: member self-ids, NOT the union of `fetchIds` — using fetchIds would
   * drag a foreign section's timetable into the group via a shared companion
   * (e.g. an ABU class that combines two IA sections).
   */
  memberIds: number[];
}

function highestPriority(classes: ReadonlyArray<UntisClass>): UntisClass {
  return classes.reduce((best, cur) => (compareClassPriority(cur, best) < 0 ? cur : best));
}

/**
 * Collapse companion classes that share a timetable into one "plan" group, so
 * the all-classes overview counts each timetable once instead of listing every
 * partner class (e.g. `ME24 a` + `AB24 a`, or `IA24 a` + `BM24 a` + `AB24 c`).
 *
 * Each class is grouped under its *lead* — the highest-priority class among
 * itself and its companions (companion ids ride along in `fetchIds` next to the
 * self id). One pass suffices because every lead is its own lead: under
 * COMPANION_RULES a lead's companions never outrank it, so there are no chains
 * to resolve transitively. An ABU class that combines two IA sections lands in
 * one section's group (its highest-priority lead), never merging both.
 *
 * Every representative is itself one of the input classes, so the overview only
 * ever shows classes that are also in the dropdown.
 */
export function groupClassesByPlan(classes: ReadonlyArray<UntisClass>): PlanGroup[] {
  const byId = new Map<number, UntisClass>();
  for (const c of classes) byId.set(c.id, c);

  const leadOf = (c: UntisClass): UntisClass => {
    const ids = c.fetchIds?.length ? c.fetchIds : [c.id];
    const candidates = ids.map((id) => byId.get(id)).filter((x): x is UntisClass => x != null);
    return highestPriority(candidates.length ? candidates : [c]);
  };

  const membersByLead = new Map<number, UntisClass[]>();
  for (const c of classes) {
    const leadId = leadOf(c).id;
    const members = membersByLead.get(leadId);
    if (members) members.push(c);
    else membersByLead.set(leadId, [c]);
  }

  return Array.from(membersByLead.values())
    .map(
      (members): PlanGroup => ({
        representative: highestPriority(members),
        memberIds: members.map((m) => m.id),
      }),
    )
    .sort((a, b) => compareClassPriority(a.representative, b.representative));
}
