import { describe, it, expect } from 'vitest';
import { aggregateClassDays, type PerClassClassification } from '@/src/lib/aggregate';
import type { CalendarDay } from '@/src/types';

function makeClass(
  className: string,
  classId: number,
  days: CalendarDay[],
): PerClassClassification {
  return { className, classId, days };
}

const D1 = '2025-08-18';
const D2 = '2025-08-19';
const D3 = '2025-08-20';

describe('aggregateClassDays', () => {
  it('returns [] for no input', () => {
    expect(aggregateClassDays([])).toEqual([]);
  });

  it('marks day as normal when every class is normal', () => {
    const result = aggregateClassDays([
      makeClass('A', 1, [{ date: D1, type: 'normal', lessonCount: 4 }]),
      makeClass('B', 2, [{ date: D1, type: 'normal', lessonCount: 6 }]),
    ]);
    expect(result).toEqual([{ date: D1, type: 'normal' }]);
  });

  it('marks day as irregular when a class has real cancellations (cancelledCount > 0)', () => {
    const result = aggregateClassDays([
      makeClass('A', 1, [{ date: D1, type: 'normal', lessonCount: 4 }]),
      makeClass('B', 2, [{ date: D1, type: 'unterrichtsausfall', lessonCount: 0, cancelledCount: 3 }]),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('irregular');
    expect(result[0].affectedClasses).toEqual([
      { className: 'B', classId: 2, type: 'unterrichtsausfall', lessonCount: 0, cancelledCount: 3 },
    ]);
  });

  it('ignores unterrichtsausfall entries with zero cancellations (class just does not meet that day)', () => {
    const result = aggregateClassDays([
      makeClass('A', 1, [{ date: D1, type: 'normal', lessonCount: 4 }]),
      makeClass('B', 2, [{ date: D1, type: 'unterrichtsausfall', lessonCount: 0, cancelledCount: 0 }]),
    ]);
    // B contributes no real irregularity → day is just "normal"
    expect(result[0].type).toBe('normal');
    expect(result[0].affectedClasses).toBeUndefined();
  });

  it('marks day as ferien when any class is in ferien (with holidayName)', () => {
    const result = aggregateClassDays([
      makeClass('A', 1, [{ date: D1, type: 'ferien', holidayName: 'Herbstferien' }]),
      makeClass('B', 2, [{ date: D1, type: 'ferien', holidayName: 'Herbstferien' }]),
    ]);
    expect(result).toEqual([{ date: D1, type: 'ferien', holidayName: 'Herbstferien' }]);
  });

  it('marks weekend when all classes agree it is weekend', () => {
    const result = aggregateClassDays([
      makeClass('A', 1, [{ date: D1, type: 'weekend' }]),
      makeClass('B', 2, [{ date: D1, type: 'weekend' }]),
    ]);
    expect(result).toEqual([{ date: D1, type: 'weekend' }]);
  });

  it('treats mixed normal + no-lessons as normal (school happens somewhere)', () => {
    const result = aggregateClassDays([
      makeClass('A', 1, [{ date: D1, type: 'normal', lessonCount: 4 }]),
      makeClass('B', 2, [{ date: D1, type: 'no-lessons' }]),
    ]);
    expect(result).toEqual([{ date: D1, type: 'normal' }]);
  });

  it('treats day as no-school when all classes only have no-lessons', () => {
    const result = aggregateClassDays([
      makeClass('A', 1, [{ date: D1, type: 'no-lessons' }]),
      makeClass('B', 2, [{ date: D1, type: 'no-lessons' }]),
    ]);
    expect(result).toEqual([{ date: D1, type: 'no-school' }]);
  });

  it('does not include normal-day classes in affectedClasses', () => {
    const result = aggregateClassDays([
      makeClass('A', 1, [{ date: D1, type: 'normal', lessonCount: 4 }]),
      makeClass('B', 2, [{ date: D1, type: 'unterrichtsausfall', lessonCount: 0, cancelledCount: 2 }]),
    ]);
    const affected = result[0].affectedClasses ?? [];
    expect(affected.map((c) => c.className)).toEqual(['B']);
  });

  it('lists multiple real cancellations in affectedClasses', () => {
    const result = aggregateClassDays([
      makeClass('A', 1, [{ date: D1, type: 'normal', lessonCount: 4 }]),
      makeClass('B', 2, [{ date: D1, type: 'unterrichtsausfall', lessonCount: 0, cancelledCount: 3 }]),
      makeClass('C', 3, [{ date: D1, type: 'unterrichtsausfall', lessonCount: 0, cancelledCount: 1 }]),
    ]);
    expect(result[0].type).toBe('irregular');
    expect((result[0].affectedClasses ?? []).map((c) => c.className)).toEqual(['B', 'C']);
  });

  it('processes multiple days in input order', () => {
    const result = aggregateClassDays([
      makeClass('A', 1, [
        { date: D1, type: 'normal', lessonCount: 4 },
        { date: D2, type: 'unterrichtsausfall', lessonCount: 0, cancelledCount: 4 },
        { date: D3, type: 'ferien', holidayName: 'Herbstferien' },
      ]),
      makeClass('B', 2, [
        { date: D1, type: 'normal', lessonCount: 6 },
        { date: D2, type: 'normal', lessonCount: 6 },
        { date: D3, type: 'ferien', holidayName: 'Herbstferien' },
      ]),
    ]);
    expect(result.map((d) => `${d.date}:${d.type}`)).toEqual([
      `${D1}:normal`,
      `${D2}:irregular`,
      `${D3}:ferien`,
    ]);
    expect(result[1].affectedClasses?.[0].className).toBe('A');
    expect(result[1].affectedClasses?.[0].cancelledCount).toBe(4);
  });

  it('preserves holidayName from the first ferien entry that has one', () => {
    const result = aggregateClassDays([
      makeClass('A', 1, [{ date: D1, type: 'ferien' }]),
      makeClass('B', 2, [{ date: D1, type: 'ferien', holidayName: 'Sportferien' }]),
    ]);
    expect(result[0].holidayName).toBe('Sportferien');
  });

  it('marks ferien without holidayName when no entry has one', () => {
    const result = aggregateClassDays([
      makeClass('A', 1, [{ date: D1, type: 'ferien' }]),
      makeClass('B', 2, [{ date: D1, type: 'ferien' }]),
    ]);
    expect(result[0].type).toBe('ferien');
    expect(result[0].holidayName).toBeUndefined();
  });

  // ─── holidayMap parameter (ferien-bug fix) ──────────────────────────────────

  it('marks vacation weekday as ferien when ALL classes have no-lessons (no class meets that day)', () => {
    // BZZ Berufsschule: all classes only meet Mon/Wed. A Tuesday holiday would
    // produce no-lessons for every class → must still be ferien, not no-school.
    const holidayMap = new Map([['2025-08-19', 'Herbstferien']]); // D2 = Tuesday
    const result = aggregateClassDays(
      [
        makeClass('A', 1, [{ date: D1, type: 'normal', lessonCount: 4 }, { date: D2, type: 'no-lessons' }]),
        makeClass('B', 2, [{ date: D1, type: 'normal', lessonCount: 6 }, { date: D2, type: 'no-lessons' }]),
      ],
      holidayMap,
    );
    const tue = result.find((d) => d.date === D2);
    expect(tue?.type).toBe('ferien');
    expect(tue?.holidayName).toBe('Herbstferien');
  });

  it('prefers per-class ferien over holidayMap (no regression on existing ferien flow)', () => {
    const holidayMap = new Map([['2025-08-18', 'Herbstferien']]);
    const result = aggregateClassDays(
      [makeClass('A', 1, [{ date: D1, type: 'ferien', holidayName: 'Herbstferien' }])],
      holidayMap,
    );
    expect(result[0].type).toBe('ferien');
    expect(result[0].holidayName).toBe('Herbstferien');
  });

  it('does NOT mark no-school as ferien when date is not in holidayMap', () => {
    const holidayMap = new Map([['2025-08-19', 'Herbstferien']]); // D2 only, not D1
    const result = aggregateClassDays(
      [makeClass('A', 1, [{ date: D1, type: 'no-lessons' }, { date: D2, type: 'no-lessons' }])],
      holidayMap,
    );
    const mon = result.find((d) => d.date === D1);
    expect(mon?.type).toBe('no-school'); // not a holiday → stays gray
  });

  it('does NOT recolor weekend inside holiday range to ferien', () => {
    // Saturday 2025-08-23 happens to fall in a holiday window — must stay weekend.
    const sat = '2025-08-23';
    const holidayMap = new Map([[sat, 'Herbstferien']]);
    const result = aggregateClassDays(
      [makeClass('A', 1, [{ date: sat, type: 'weekend' }])],
      holidayMap,
    );
    expect(result[0].type).toBe('weekend');
  });

  it('works with no holidayMap passed (undefined) — existing behaviour unchanged', () => {
    const result = aggregateClassDays([
      makeClass('A', 1, [{ date: D1, type: 'no-lessons' }]),
    ]);
    expect(result[0].type).toBe('no-school');
  });

  it('marks day as out-of-year when all classes are out-of-year', () => {
    const result = aggregateClassDays([
      makeClass('A', 1, [{ date: D1, type: 'out-of-year' }]),
      makeClass('B', 2, [{ date: D1, type: 'out-of-year' }]),
    ]);
    expect(result).toEqual([{ date: D1, type: 'out-of-year' }]);
  });

  it('marks day as no-school (not out-of-year) when classes are mixed out-of-year and no-lessons', () => {
    const result = aggregateClassDays([
      makeClass('A', 1, [{ date: D1, type: 'out-of-year' }]),
      makeClass('B', 2, [{ date: D1, type: 'no-lessons' }]),
    ]);
    expect(result).toEqual([{ date: D1, type: 'no-school' }]);
  });

  it('marks day as normal when any class has veranstaltung', () => {
    const result = aggregateClassDays([
      makeClass('A', 1, [{ date: D1, type: 'veranstaltung' }]),
      makeClass('B', 2, [{ date: D1, type: 'no-lessons' }]),
    ]);
    expect(result).toEqual([{ date: D1, type: 'normal' }]);
  });

  // ─── ended classes (Abschlussklasse finished the year) ──────────────────────

  it('marks day irregular when a finished (ended) class meets an actively-teaching class', () => {
    const result = aggregateClassDays([
      makeClass('A', 1, [{ date: D1, type: 'normal', lessonCount: 4 }]),
      makeClass('B', 2, [{ date: D1, type: 'unterrichtsausfall', lessonCount: 0, ended: true }]),
    ]);
    expect(result[0].type).toBe('irregular');
    expect(result[0].affectedClasses).toEqual([
      { className: 'B', classId: 2, type: 'unterrichtsausfall', lessonCount: 0, cancelledCount: 0 },
    ]);
  });

  it('counts ended as active via a veranstaltung class too', () => {
    const result = aggregateClassDays([
      makeClass('A', 1, [{ date: D1, type: 'veranstaltung' }]),
      makeClass('B', 2, [{ date: D1, type: 'unterrichtsausfall', lessonCount: 0, ended: true }]),
    ]);
    expect(result[0].type).toBe('irregular');
    expect((result[0].affectedClasses ?? []).map((c) => c.className)).toEqual(['B']);
  });

  it('ignores ended classes when NO class is still actively teaching (year just ends for all)', () => {
    const result = aggregateClassDays([
      makeClass('A', 1, [{ date: D1, type: 'unterrichtsausfall', lessonCount: 0, ended: true }]),
      makeClass('B', 2, [{ date: D1, type: 'no-lessons' }]),
    ]);
    expect(result[0].type).toBe('no-school');
    expect(result[0].affectedClasses).toBeUndefined();
  });

  it('lists both cancelled and ended classes in affectedClasses (cancelled first)', () => {
    const result = aggregateClassDays([
      makeClass('A', 1, [{ date: D1, type: 'normal', lessonCount: 4 }]),
      makeClass('B', 2, [{ date: D1, type: 'unterrichtsausfall', lessonCount: 0, cancelledCount: 3 }]),
      makeClass('C', 3, [{ date: D1, type: 'unterrichtsausfall', lessonCount: 0, ended: true }]),
    ]);
    expect(result[0].type).toBe('irregular');
    expect((result[0].affectedClasses ?? []).map((c) => c.className)).toEqual(['B', 'C']);
    const ended = result[0].affectedClasses?.find((c) => c.className === 'C');
    expect(ended).toMatchObject({ lessonCount: 0, cancelledCount: 0 });
  });
});
