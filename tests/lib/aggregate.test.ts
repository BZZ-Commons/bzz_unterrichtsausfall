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
});
