// Allowed class-name prefixes, in dropdown display order.
//
// This is an ALLOWLIST: only classes whose name starts with one of these count
// as real classes. Everything else — Förderkurse ("FK…"), Freifächer ("FF…"),
// Lernfoyer ("LF…"), etc. — is filtered out of both the class dropdown and the
// all-classes overview.
export const PREFIX_ORDER = ['IA', 'IM', 'KV', 'ME', 'FB', 'AB', 'BM'] as const;

/** True when a class name starts with an allowed prefix (see PREFIX_ORDER). */
export function matchesAllowedPrefix(name: string): boolean {
  const upper = name.toUpperCase();
  return PREFIX_ORDER.some((p) => upper.startsWith(p));
}

/**
 * Sort rank of a class by its prefix — lower sorts first. Classes whose prefix
 * isn't in PREFIX_ORDER rank last. Used both for dropdown ordering and for
 * picking a plan group's representative (the highest-priority member).
 */
export function prefixRank(name: string): number {
  const prefix = name.match(/^[A-Za-z]+/)?.[0]?.toUpperCase() ?? '';
  const idx = PREFIX_ORDER.findIndex((p) => prefix.startsWith(p));
  return idx === -1 ? PREFIX_ORDER.length : idx;
}

/** Order two classes by prefix rank, then alphabetically by name. Lower sorts first. */
export function compareClassPriority(a: { name: string }, b: { name: string }): number {
  const byPrefix = prefixRank(a.name) - prefixRank(b.name);
  return byPrefix !== 0 ? byPrefix : a.name.localeCompare(b.name);
}
