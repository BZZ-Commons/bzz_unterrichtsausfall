import type { UntisClass } from '@/src/types';

// ─── Business rules ────────────────────────────────────────────────────────────
//
// Each rule defines which companion classes share the timetable of a given class.
//
// match      – regex tested against the class name with spaces stripped (e.g. "IA23a")
//              Capture group $1 = year digits, $2 = suffix letter(s)
// companions – name templates for companion classes
//              $1 and $2 are replaced with the captures from `match`
//
// To add or change a pairing: edit COMPANION_RULES only — no logic code changes needed.

export interface CompanionRule {
  match: RegExp;
  companions: string[];
}

export const COMPANION_RULES: CompanionRule[] = [
  // ME (Mediamatiker) ↔ AB / BM je nach Suffix
  { match: /^ME(\d+)([ab])$/i, companions: ['AB$1 $2'] },
  { match: /^ME(\d+)([cd])$/i, companions: ['BM$1 $2'] },
  { match: /^ME(\d+)([ef])$/i, companions: ['AB$1 $2'] },

  // IA (Informatik Applikationsentwicklung) ↔ BM (per Suffix); IA c ↔ AB c
  // The combined IA a/b + AB c view is a synthetic dropdown entry — see /api/classes.
  { match: /^IA(\d+)([ab])$/i, companions: ['BM$1 $2'] },
  { match: /^IA(\d+)c$/i,      companions: ['AB$1 c'] },

  // AB (Allgemeinbildung) ↔ ME oder IA
  { match: /^AB(\d+)([ab])$/i, companions: ['ME$1 $2'] },
  { match: /^AB(\d+)c$/i,      companions: ['IA$1 a', 'IA$1 b'] },
  { match: /^AB(\d+)([ef])$/i, companions: ['ME$1 $2'] },

  // BM (Berufsmaturität) ↔ IA oder ME
  { match: /^BM(\d+)([ab])$/i, companions: ['IA$1 $2'] },
  { match: /^BM(\d+)([cd])$/i, companions: ['ME$1 $2'] },
  { match: /^BM(\d+)([ef])$/i, companions: ['ME$1 $2'] },
];

// ─── Helpers ───────────────────────────────────────────────────────────────────

/** Strip whitespace and lowercase — used for both matching and lookup */
function normalize(name: string): string {
  return name.replace(/\s+/g, '').toLowerCase();
}

/** Detect whether a class name belongs to the IA (Informatik Applikationsentwicklung) track. */
export const isIAClass = (name: string): boolean => /^IA\d+/i.test(name);

/** Parse an IA class name into its year and single-letter suffix, or null. */
function parseIAName(name: string): { year: string; suffix: string } | null {
  const m = name.match(/^IA(\d+)\s*([a-z])$/i);
  return m ? { year: m[1], suffix: m[2].toLowerCase() } : null;
}

/** Year-suffixes of IA classes where an `IA xx c` exists in the given list. */
export function getIAYearsWithC(classes: UntisClass[]): Set<string> {
  const years = new Set<string>();
  for (const c of classes) {
    const parsed = parseIAName(c.name);
    if (parsed?.suffix === 'c') years.add(parsed.year);
  }
  return years;
}

/**
 * An `IA xx a/b` class needs the BM/ABU variant dialog only when its year
 * has NO `IA xx c` — without `c`, the AB c pairing is ambiguous between a/b.
 */
export function iaNeedsDialog(name: string, yearsWithC: Set<string>): boolean {
  const parsed = parseIAName(name);
  return parsed != null
    && (parsed.suffix === 'a' || parsed.suffix === 'b')
    && !yearsWithC.has(parsed.year);
}

/** Build a normalized-name → class lookup map. O(n) once, O(1) lookups thereafter. */
export function buildClassMap(classes: UntisClass[]): Map<string, UntisClass> {
  const map = new Map<string, UntisClass>();
  for (const c of classes) map.set(normalize(c.name), c);
  return map;
}

/** Find a class by name (whitespace-insensitive, case-insensitive). */
function findClassByName(
  classes: UntisClass[] | Map<string, UntisClass>,
  name: string,
): UntisClass | undefined {
  const target = normalize(name);
  return classes instanceof Map
    ? classes.get(target)
    : classes.find((c) => normalize(c.name) === target);
}

/**
 * Resolve the BM and ABU companion classes that an IA student would attend.
 * Returns null for either side if the expected companion class doesn't exist.
 */
export function getIAVariants(
  iaName: string,
  classes: UntisClass[] | Map<string, UntisClass>,
): { bm: UntisClass | null; abu: UntisClass | null } {
  const parsed = parseIAName(iaName);
  if (!parsed) return { bm: null, abu: null };
  return {
    bm: findClassByName(classes, `BM${parsed.year} ${parsed.suffix}`) ?? null,
    abu: findClassByName(classes, `AB${parsed.year} c`) ?? null,
  };
}

/**
 * Expand a companion template string using regex captures.
 * Template syntax: $1 = first capture, $2 = second capture.
 * Example: template 'BM$1 $2', captures ['23', 'a'] → 'BM23 a'
 */
function expandTemplate(template: string, captures: string[]): string {
  return template.replace(/\$(\d)/g, (_, i) => captures[parseInt(i, 10) - 1] ?? '');
}

/**
 * Resolve companion class names for a given class name using COMPANION_RULES.
 * Returns display names (as expanded from the templates), not necessarily matching
 * the exact WebUntis name — use getCompanionClassIds() to look up real IDs.
 */
export function getCompanionNames(className: string): string[] {
  const normalized = normalize(className);

  for (const rule of COMPANION_RULES) {
    const m = normalized.match(rule.match);
    if (m) {
      const captures = m.slice(1); // $1, $2, …
      return rule.companions.map((tpl) => expandTemplate(tpl, captures));
    }
  }

  return [];
}

/**
 * Returns the IDs of all companion classes for `className` found in `classes`.
 * Accepts either an array (one-off lookups) or a pre-built normalized map
 * (when called many times in a row — avoids quadratic re-normalization).
 */
export function getCompanionClassIds(
  className: string,
  classes: UntisClass[] | Map<string, UntisClass>,
): number[] {
  const names = getCompanionNames(className);
  if (names.length === 0) return [];
  const ids: number[] = [];
  for (const target of names) {
    const found = findClassByName(classes, target);
    if (found) ids.push(found.id);
  }
  return ids;
}
