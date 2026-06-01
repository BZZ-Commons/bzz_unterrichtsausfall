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
