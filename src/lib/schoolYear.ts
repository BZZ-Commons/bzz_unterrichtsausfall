import type { SchoolYearSummary } from '@/src/types';

/**
 * The "short" form used in shareable URLs: the 2-digit start year of the school year.
 * Example: `{ startDate: '2025-08-17…', name: '2025/2026' }` → `'25'`.
 */
export function schoolYearShort(year: SchoolYearSummary): string {
  // startDate is an ISO string like '2025-08-17T22:00:00.000Z'
  return year.startDate.slice(2, 4);
}

/**
 * A school year is shown as a *draft* while it lies entirely in the future:
 * its plan is published early but the cancellations may still change. The notice
 * runs until the end of the school year immediately preceding it
 * (e.g. for 2026/27 the draft notice shows until the end of school year 2025/26).
 * Once the year has started — or once the previous year has ended — it is final.
 */
export function isDraftSchoolYear(
  year: SchoolYearSummary | undefined,
  years: ReadonlyArray<SchoolYearSummary>,
  now: number,
): boolean {
  if (!year) return false;
  const start = new Date(year.startDate).getTime();
  if (start <= now) return false; // already started → final
  // Cutoff: the end of the school year right before this one ("Ende Schuljahr …").
  const prev = years
    .filter((y) => new Date(y.startDate).getTime() < start)
    .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())[0];
  if (!prev) return true;
  return now <= new Date(prev.endDate).getTime();
}

/**
 * Resolve a short form (e.g. `'25'`) back to a school year from the list,
 * or `null` if no matching year is known.
 */
export function findSchoolYearByShort(
  short: string,
  years: ReadonlyArray<SchoolYearSummary>,
): SchoolYearSummary | null {
  const normalized = short.trim();
  if (!/^\d{1,2}$/.test(normalized)) return null;
  const padded = normalized.padStart(2, '0');
  return years.find((y) => schoolYearShort(y) === padded) ?? null;
}
