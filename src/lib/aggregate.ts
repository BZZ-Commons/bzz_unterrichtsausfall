import type {
  AggregatedDay,
  AggregatedDayType,
  CalendarDay,
  ClassDayStatus,
} from '@/src/types';

/** Per-class classification input for aggregation. */
export interface PerClassClassification {
  className: string;
  classId: number;
  days: CalendarDay[];
}

/**
 * Pure function: aggregate per-class classifications into a single
 * day-by-day overview across all classes.
 *
 * Aggregation rules (in order, first match wins per date):
 *  1. Any class marks the day as `ferien` → `ferien` (with holidayName)
 *  2. All classes mark the day as `weekend` → `weekend`
 *  3. Any class has Schulausfall with `cancelledCount > 0` → `irregular`,
 *     `affectedClasses` lists those classes. Classes with `unterrichtsausfall` but
 *     zero recorded cancellations are ignored — that pattern usually means the
 *     class just doesn't meet on that weekday rather than a real cancellation.
 *  4. Any class marks the day as `normal` → `normal`
 *  5. Date is in `holidayMap` (institution-level holiday) → `ferien`.
 *     Handles the case where no class meets on a holiday weekday, so every
 *     class would produce `no-lessons` instead of `ferien`.
 *  6. Otherwise (every class `no-lessons`/`out-of-year`) → `no-school`
 *
 * `holidayMap` is an optional 'YYYY-MM-DD' → holiday-name map built from the
 * WebUntis holidays API.  Pass it from the aggregate API route so that
 * rule 5 fires correctly; omit it when running unit tests that don't need it.
 *
 * Requires all inputs to share the same day order/dates. Missing classes
 * for a date are ignored.
 */
export function aggregateClassDays(
  perClass: ReadonlyArray<PerClassClassification>,
  holidayMap?: ReadonlyMap<string, string>,
): AggregatedDay[] {
  if (perClass.length === 0) return [];

  const dateOrder = perClass[0].days.map((d) => d.date);

  // date → list of (class, day) entries
  const byDate = new Map<string, Array<{ source: PerClassClassification; day: CalendarDay }>>();
  for (const date of dateOrder) byDate.set(date, []);

  for (const source of perClass) {
    for (const day of source.days) {
      const bucket = byDate.get(day.date);
      if (bucket) bucket.push({ source, day });
    }
  }

  return dateOrder.map((date): AggregatedDay => {
    const entries = byDate.get(date) ?? [];
    return classifyAggregatedDay(date, entries, holidayMap);
  });
}

function asHolidayDay(date: string, holidayMap?: ReadonlyMap<string, string>): AggregatedDay | undefined {
  const holidayName = holidayMap?.get(date);
  return holidayName !== undefined ? { date, type: 'ferien', holidayName } : undefined;
}

function classifyAggregatedDay(
  date: string,
  entries: ReadonlyArray<{ source: PerClassClassification; day: CalendarDay }>,
  holidayMap?: ReadonlyMap<string, string>,
): AggregatedDay {
  if (entries.length === 0) {
    return asHolidayDay(date, holidayMap) ?? { date, type: 'no-school' };
  }

  // 1. Ferien — shared across all classes; prefer the first entry with a holidayName
  const ferien = entries.find((e) => e.day.type === 'ferien');
  if (ferien) {
    const named = entries.find((e) => e.day.type === 'ferien' && e.day.holidayName);
    const result: AggregatedDay = { date, type: 'ferien' };
    if (named?.day.holidayName) result.holidayName = named.day.holidayName;
    return result;
  }

  // 2. Weekend — all classes agree
  if (entries.every((e) => e.day.type === 'weekend')) {
    return { date, type: 'weekend' };
  }

  // 3. Irregular — any class has Schulausfall WITH at least one recorded cancellation.
  // Classes that simply have no lessons scheduled for the day (cancelledCount=0)
  // are not real "irregularities" — they usually just don't meet that weekday.
  const affected = entries.filter(
    (e) => e.day.type === 'unterrichtsausfall' && (e.day.cancelledCount ?? 0) > 0,
  );
  if (affected.length > 0) {
    const affectedClasses: ClassDayStatus[] = affected.map(({ source, day }) => ({
      className: source.className,
      classId: source.classId,
      type: day.type,
      lessonCount: day.lessonCount ?? 0,
      cancelledCount: day.cancelledCount ?? 0,
    }));
    const result: AggregatedDay = { date, type: 'irregular', affectedClasses };
    const named = affected.find((e) => e.day.holidayName);
    if (named?.day.holidayName) result.holidayName = named.day.holidayName;
    return result;
  }

  // 4. Normal — at least one class has normal lessons or a Veranstaltung
  if (entries.some((e) => e.day.type === 'normal' || e.day.type === 'veranstaltung')) {
    return { date, type: 'normal' };
  }

  // 5. Holiday map — date is a known institution holiday even though no class
  //    was scheduled on this weekday (Berufsschule partial-week schedules mean
  //    every class produced `no-lessons` instead of `ferien`).
  // 6. Fallthrough — only no-lessons / out-of-year for everyone
  return asHolidayDay(date, holidayMap) ?? { date, type: classifyFallthrough(entries) };
}

function classifyFallthrough(
  entries: ReadonlyArray<{ source: PerClassClassification; day: CalendarDay }>,
): AggregatedDayType {
  if (entries.every((e) => e.day.type === 'out-of-year')) return 'out-of-year';
  return 'no-school';
}
