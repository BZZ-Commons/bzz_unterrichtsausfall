/**
 * Pure helpers for the MCP tool layer: class-name resolution (incl. the IA
 * BM/ABU variant special case) and compaction of calendar days into small,
 * LLM-friendly JSON shapes. NO I/O — everything here is unit-testable.
 */

import type { CalendarDay, DayType, UntisClass } from '@/src/types';
import {
  buildClassMap,
  getIAVariants,
  getIAYearsWithC,
  iaNeedsDialog,
  normalize,
} from '@/src/lib/classGroups';

// ─── Shapes ────────────────────────────────────────────────────────────────────

/** A single noteworthy day, with all undefined fields omitted to keep JSON small. */
export interface CompactDay {
  date: string; // 'YYYY-MM-DD'
  type: DayType;
  holidayName?: string;
  eventName?: string;
  lessonCount?: number;
  cancelledCount?: number;
  /** eventName, or the deduped halfDay morning/afternoon reasons joined with ' / '. */
  reason?: string;
  ended?: boolean;
}

export interface FerienRange {
  from: string;
  to: string;
  name?: string;
}

export interface CompactCalendar {
  /** Counts of ALL input days by type (full year picture, before any filtering). */
  stats: Partial<Record<DayType, number>>;
  /** Consecutive 'ferien' days collapsed into ranges. */
  ferien: FerienRange[];
  days: CompactDay[];
}

export type ClassResolution =
  | { kind: 'resolved'; cls: UntisClass; fetchIds: number[] }
  | {
      kind: 'needs-variant';
      cls: UntisClass;
      options: { bm: UntisClass | null; abu: UntisClass | null };
      hint: string;
    }
  | { kind: 'not-found'; query: string; suggestions: string[] };

// ─── resolveClass ──────────────────────────────────────────────────────────────

/** Up to 5 class-name suggestions for a failed lookup: prefix matches first, then contains. */
function buildSuggestions(classes: UntisClass[], query: string): string[] {
  const q = normalize(query);
  if (!q) return [];
  const prefixMatches: string[] = [];
  const containsMatches: string[] = [];
  for (const c of classes) {
    const name = normalize(c.name);
    if (name.startsWith(q)) prefixMatches.push(c.name);
    else if (name.includes(q)) containsMatches.push(c.name);
  }
  return [...prefixMatches, ...containsMatches].slice(0, 5);
}

function variantHint(
  cls: UntisClass,
  options: { bm: UntisClass | null; abu: UntisClass | null },
): string {
  const bmPart = options.bm ? `Berufsmaturität, Klasse ${options.bm.name}` : 'Berufsmaturität';
  const abuPart = options.abu ? `Allgemeinbildung, Klasse ${options.abu.name}` : 'Allgemeinbildung';
  return (
    `Die Klasse ${cls.name} hat zwei Stundenplan-Varianten. Bitte den Aufruf mit ` +
    `variant: "bm" (${bmPart}) oder variant: "abu" (${abuPart}) wiederholen.`
  );
}

function unavailableVariantHint(
  cls: UntisClass,
  variant: 'bm' | 'abu',
  options: { bm: UntisClass | null; abu: UntisClass | null },
): string {
  const available: string[] = [];
  if (options.bm) available.push(`variant: "bm" (Klasse ${options.bm.name})`);
  if (options.abu) available.push(`variant: "abu" (Klasse ${options.abu.name})`);
  const availableText =
    available.length > 0
      ? `Verfügbar: ${available.join(' oder ')}.`
      : 'Es ist keine Variante verfügbar.';
  return `Die Variante "${variant}" ist für die Klasse ${cls.name} nicht verfügbar. ${availableText}`;
}

/** Resolution for a class that was found — handles the IA BM/ABU variant special case. */
function finalizeResolution(
  cls: UntisClass,
  classes: UntisClass[],
  variant: 'bm' | 'abu' | undefined,
): ClassResolution {
  if (iaNeedsDialog(cls.name, getIAYearsWithC(classes))) {
    const options = getIAVariants(cls.name, classes);
    if (!variant) {
      return { kind: 'needs-variant', cls, options, hint: variantHint(cls, options) };
    }
    const variantCls = options[variant];
    if (variantCls) {
      return { kind: 'resolved', cls, fetchIds: [cls.id, variantCls.id] };
    }
    return {
      kind: 'needs-variant',
      cls,
      options,
      hint: unavailableVariantHint(cls, variant, options),
    };
  }

  const fetchIds = cls.fetchIds && cls.fetchIds.length > 0 ? cls.fetchIds : [cls.id];
  return { kind: 'resolved', cls, fetchIds };
}

/**
 * Resolve a class query (by id or by name, whitespace/case-insensitive) to the
 * class and the fetchIds of all timetables to merge. IA a/b classes in a year
 * without an IA c class need a `variant` ('bm' | 'abu') — without one, a
 * `needs-variant` result with a German hint is returned.
 */
export function resolveClass(
  classes: UntisClass[],
  query: { className?: string; classId?: number; variant?: 'bm' | 'abu' },
): ClassResolution {
  if (query.classId !== undefined) {
    const cls = classes.find((c) => c.id === query.classId);
    if (!cls) return { kind: 'not-found', query: String(query.classId), suggestions: [] };
    return finalizeResolution(cls, classes, query.variant);
  }

  if (typeof query.className === 'string' && query.className.trim() !== '') {
    const cls = buildClassMap(classes).get(normalize(query.className));
    if (!cls) {
      return {
        kind: 'not-found',
        query: query.className,
        suggestions: buildSuggestions(classes, query.className),
      };
    }
    return finalizeResolution(cls, classes, query.variant);
  }

  // The tool layer validates input earlier, but be safe.
  return { kind: 'not-found', query: '', suggestions: [] };
}

// ─── Day compaction ────────────────────────────────────────────────────────────

/** eventName, or the deduped halfDay reasons joined with ' / '; undefined when empty. */
function buildReason(day: CalendarDay): string | undefined {
  if (day.eventName) return day.eventName;
  const reasons: string[] = [];
  for (const half of [day.halfDay?.morning, day.halfDay?.afternoon]) {
    const reason = half?.reason;
    if (reason && !reasons.includes(reason)) reasons.push(reason);
  }
  return reasons.length > 0 ? reasons.join(' / ') : undefined;
}

/** Map a CalendarDay to a CompactDay, building the object conditionally so no undefined keys are emitted. */
function toCompactDay(day: CalendarDay): CompactDay {
  const compact: CompactDay = { date: day.date, type: day.type };
  if (day.holidayName !== undefined) compact.holidayName = day.holidayName;
  if (day.eventName !== undefined) compact.eventName = day.eventName;
  if (day.lessonCount !== undefined) compact.lessonCount = day.lessonCount;
  if (day.cancelledCount !== undefined) compact.cancelledCount = day.cancelledCount;
  const reason = buildReason(day);
  if (reason !== undefined) compact.reason = reason;
  if (day.ended !== undefined) compact.ended = day.ended;
  return compact;
}

/** Days worth listing individually: cancellations, events, normal days with some cancelled lessons. */
function isNoteworthy(day: CalendarDay): boolean {
  return (
    day.type === 'unterrichtsausfall' ||
    day.type === 'veranstaltung' ||
    (day.type === 'normal' && (day.cancelledCount ?? 0) > 0)
  );
}

/**
 * Compact a full school year of classified days into a small JSON shape:
 * per-type counts, collapsed Ferien ranges, and only the noteworthy days.
 *
 * `opts.from`/`opts.to` (ISO dates, inclusive) filter `days` and `ferien`
 * (ranges are kept when they overlap the window, not clipped); `stats` always
 * reflects ALL input days.
 */
export function compactDays(
  days: CalendarDay[],
  opts?: { from?: string; to?: string },
): CompactCalendar {
  const stats: Partial<Record<DayType, number>> = {};
  const ferien: FerienRange[] = [];
  const compact: CompactDay[] = [];

  const inWindow = (date: string): boolean =>
    (!opts?.from || date >= opts.from) && (!opts?.to || date <= opts.to);

  let currentRange: FerienRange | null = null;

  for (const day of days) {
    stats[day.type] = (stats[day.type] ?? 0) + 1;

    // Collapse consecutive ferien days (the input is day-by-day, so adjacency
    // in the array means consecutive dates); a holidayName change starts a new range.
    if (day.type === 'ferien') {
      if (currentRange && currentRange.name === day.holidayName) {
        currentRange.to = day.date;
      } else {
        currentRange = { from: day.date, to: day.date };
        if (day.holidayName !== undefined) currentRange.name = day.holidayName;
        ferien.push(currentRange);
      }
    } else {
      currentRange = null;
    }

    if (isNoteworthy(day) && inWindow(day.date)) {
      compact.push(toCompactDay(day));
    }
  }

  return {
    stats,
    ferien: ferien.filter(
      (range) => (!opts?.from || range.to >= opts.from) && (!opts?.to || range.from <= opts.to),
    ),
    days: compact,
  };
}

/**
 * Upcoming cancellation days (date >= todayIso). 'veranstaltung' days are
 * included only with `includeVeranstaltung`; days after a class's school year
 * end (`ended`) only with `includeEnded`.
 */
export function filterUpcomingCancellations(
  days: CalendarDay[],
  todayIso: string,
  opts?: { includeVeranstaltung?: boolean; includeEnded?: boolean },
): CompactDay[] {
  const result: CompactDay[] = [];
  for (const day of days) {
    if (day.date < todayIso) continue;
    const typeMatches =
      day.type === 'unterrichtsausfall' ||
      (opts?.includeVeranstaltung === true && day.type === 'veranstaltung');
    if (!typeMatches) continue;
    if (day.ended === true && opts?.includeEnded !== true) continue;
    result.push(toCompactDay(day));
  }
  return result;
}

/** Today's date as 'YYYY-MM-DD' in the Europe/Zurich timezone. */
export function todayInZurich(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Zurich' }).format(now);
}
