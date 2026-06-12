import { addDays, format, getISOWeek, getMonth, parseISO, startOfISOWeek } from 'date-fns';
import { de } from 'date-fns/locale';

export interface WeekRow<TDay> {
  isoWeek: number;
  monday: string; // 'YYYY-MM-DD' — Monday of this ISO week
  days: (TDay | null)[]; // 7 slots: Mon(0)…Sun(6); null = outside school year
}

export interface MonthGroup<TDay> {
  month: number; // 0-based
  year: number;
  label: string; // e.g. "August 2025"
  weeks: WeekRow<TDay>[];
}

/**
 * Group a flat list of dated entries into ISO-week rows, organised by month.
 * Month boundaries use the Thursday rule (week belongs to the month containing its Thursday).
 *
 * Generic over any entry shape that has a `date: 'YYYY-MM-DD'` field.
 */
export function buildMonthGroups<TDay extends { date: string }>(
  days: ReadonlyArray<TDay>,
): MonthGroup<TDay>[] {
  if (days.length === 0) return [];

  const dayMap = new Map<string, TDay>();
  for (const d of days) dayMap.set(d.date, d);

  const first = parseISO(days[0].date);
  const last = parseISO(days[days.length - 1].date);

  const weekStart = startOfISOWeek(first);
  const weekEnd = addDays(startOfISOWeek(last), 6);

  const groups = new Map<string, MonthGroup<TDay>>();
  const orderedKeys: string[] = [];

  let cursor = new Date(weekStart);
  while (cursor <= weekEnd) {
    const thursday = addDays(cursor, 3);
    const monthKey = format(thursday, 'yyyy-MM');

    if (!groups.has(monthKey)) {
      groups.set(monthKey, {
        month: getMonth(thursday),
        year: thursday.getFullYear(),
        label: format(thursday, 'MMMM yyyy', { locale: de }),
        weeks: [],
      });
      orderedKeys.push(monthKey);
    }

    const week: WeekRow<TDay> = {
      isoWeek: getISOWeek(cursor),
      monday: format(cursor, 'yyyy-MM-dd'),
      days: Array(7).fill(null) as null[],
    };

    for (let i = 0; i < 7; i++) {
      const d = addDays(cursor, i);
      const iso = format(d, 'yyyy-MM-dd');
      week.days[i] = dayMap.get(iso) ?? null;
    }

    groups.get(monthKey)!.weeks.push(week);
    cursor = addDays(cursor, 7);
  }

  return orderedKeys.map((k) => groups.get(k)!);
}

export const DOW_LABELS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
