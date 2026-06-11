import { describe, it, expect } from 'vitest';
import { schoolYearShort, findSchoolYearByShort, isDraftSchoolYear } from '@/src/lib/schoolYear';
import type { SchoolYearSummary } from '@/src/types';

const YEAR_2526: SchoolYearSummary = {
  id: 1,
  name: '2025/2026',
  startDate: '2025-08-17T22:00:00.000Z',
  endDate: '2026-07-15T22:00:00.000Z',
};
const YEAR_2627: SchoolYearSummary = {
  id: 2,
  name: '2026/2027',
  startDate: '2026-08-16T22:00:00.000Z',
  endDate: '2027-07-14T22:00:00.000Z',
};
const YEARS = [YEAR_2526, YEAR_2627];

const at = (iso: string) => new Date(iso).getTime();

describe('schoolYearShort', () => {
  it('returns the 2-digit start year', () => {
    expect(schoolYearShort(YEAR_2526)).toBe('25');
    expect(schoolYearShort(YEAR_2627)).toBe('26');
  });
});

describe('findSchoolYearByShort', () => {
  it('resolves a short form to its year', () => {
    expect(findSchoolYearByShort('26', YEARS)).toBe(YEAR_2627);
    expect(findSchoolYearByShort('25', YEARS)).toBe(YEAR_2526);
  });
  it('returns null for unknown or invalid input', () => {
    expect(findSchoolYearByShort('99', YEARS)).toBeNull();
    expect(findSchoolYearByShort('abc', YEARS)).toBeNull();
  });
});

describe('isDraftSchoolYear', () => {
  it('shows the notice for a future year before the current year ends', () => {
    expect(isDraftSchoolYear(YEAR_2627, YEARS, at('2026-06-11T00:00:00.000Z'))).toBe(true);
  });

  it('hides the notice once the previous year has ended (summer break)', () => {
    expect(isDraftSchoolYear(YEAR_2627, YEARS, at('2026-07-20T00:00:00.000Z'))).toBe(false);
  });

  it('hides the notice once the year itself has started', () => {
    expect(isDraftSchoolYear(YEAR_2627, YEARS, at('2026-09-01T00:00:00.000Z'))).toBe(false);
  });

  it('never shows the notice for the current (already started) year', () => {
    expect(isDraftSchoolYear(YEAR_2526, YEARS, at('2026-06-11T00:00:00.000Z'))).toBe(false);
  });

  it('shows the notice for a future year when no previous year is known', () => {
    expect(isDraftSchoolYear(YEAR_2627, [YEAR_2627], at('2026-06-11T00:00:00.000Z'))).toBe(true);
  });

  it('returns false for an undefined year', () => {
    expect(isDraftSchoolYear(undefined, YEARS, at('2026-06-11T00:00:00.000Z'))).toBe(false);
  });
});
