import { describe, it, expect } from 'vitest';
import { parseUntisLessons, parseUntisClasses, parseUntisHolidays } from '@/src/lib/untisBoundary';

// ─── parseUntisLessons ───────────────────────────────────────────────────────

describe('parseUntisLessons', () => {
  it('passes valid lessons through (same reference, typed)', () => {
    const raw = [
      { id: 1, date: 20250818 },
      {
        id: 2,
        date: 20250819,
        startTime: 800,
        code: 'cancelled',
        su: [{ name: 'Eng' }],
        lstext: 'x',
        substText: 'y',
      },
    ];
    const result = parseUntisLessons(raw, 'ctx');
    expect(result).toBe(raw); // returns the same array reference
    expect(result).toHaveLength(2);
  });

  it('accepts an empty array', () => {
    expect(parseUntisLessons([], 'lessons-ctx')).toEqual([]);
  });

  it('accepts lessons with all optional fields absent', () => {
    const raw = [{ id: 7, date: 20250820 }];
    expect(parseUntisLessons(raw, 'ctx')).toBe(raw);
  });

  it('throws with context + index when a required field is missing', () => {
    const raw = [{ id: 1, date: 20250818 }, { id: 2 /* date missing */ }];
    expect(() => parseUntisLessons(raw, 'timetable for class 42')).toThrow(
      /timetable for class 42/,
    );
    expect(() => parseUntisLessons(raw, 'timetable for class 42')).toThrow(/index 1/);
    expect(() => parseUntisLessons(raw, 'timetable for class 42')).toThrow(/date/);
  });

  it('throws when a required field has the wrong type', () => {
    const raw = [{ id: '1', date: 20250818 }];
    expect(() => parseUntisLessons(raw, 'ctx')).toThrow(/"id"/);
  });

  it('throws when an optional field is present with the wrong type (startTime)', () => {
    const raw = [{ id: 1, date: 20250818, startTime: '800' }];
    expect(() => parseUntisLessons(raw, 'ctx')).toThrow(/startTime/);
  });

  it('throws when an optional field is present with the wrong type (code)', () => {
    const raw = [{ id: 1, date: 20250818, code: 5 }];
    expect(() => parseUntisLessons(raw, 'ctx')).toThrow(/code/);
  });

  it('throws when su is not an array', () => {
    const raw = [{ id: 1, date: 20250818, su: { name: 'Eng' } }];
    expect(() => parseUntisLessons(raw, 'ctx')).toThrow(/su/);
  });

  it('throws when an su entry has a non-string name', () => {
    const raw = [{ id: 1, date: 20250818, su: [{ name: 42 }] }];
    expect(() => parseUntisLessons(raw, 'ctx')).toThrow(/su/);
  });

  it('accepts an empty su array', () => {
    const raw = [{ id: 1, date: 20250818, su: [] }];
    expect(parseUntisLessons(raw, 'ctx')).toBe(raw);
  });

  it('throws when raw is not an array', () => {
    expect(() => parseUntisLessons({ id: 1 }, 'ctx')).toThrow(/expected an array/);
    expect(() => parseUntisLessons(null, 'ctx')).toThrow(/expected an array/);
  });

  it('truncates the offending element preview to ~200 chars', () => {
    const raw = [
      { id: 1, date: 20250818 },
      { id: 'bad', filler: 'x'.repeat(500) },
    ];
    let message = '';
    try {
      parseUntisLessons(raw, 'ctx');
    } catch (e) {
      message = (e as Error).message;
    }
    expect(message).toContain('…');
    // message stays bounded even though the element JSON is huge
    expect(message.length).toBeLessThan(400);
  });
});

// ─── parseUntisClasses ───────────────────────────────────────────────────────

describe('parseUntisClasses', () => {
  it('passes valid classes through', () => {
    const raw = [
      { id: 1, name: 'IA26 a', longName: 'Informatik', active: true },
      { id: 2, name: 'BM26 a', longName: 'Berufsmatura', active: false },
    ];
    expect(parseUntisClasses(raw, 'ctx')).toBe(raw);
  });

  it('accepts an empty array', () => {
    expect(parseUntisClasses([], 'ctx')).toEqual([]);
  });

  it('throws with context + index when a required field is missing', () => {
    const raw = [
      { id: 1, name: 'IA26 a', longName: 'x', active: true },
      { id: 2, name: 'BM', active: true },
    ];
    expect(() => parseUntisClasses(raw, 'classes for school year 99')).toThrow(
      /classes for school year 99/,
    );
    expect(() => parseUntisClasses(raw, 'ctx')).toThrow(/index 1/);
    expect(() => parseUntisClasses(raw, 'ctx')).toThrow(/longName/);
  });

  it('throws when active is not a boolean', () => {
    const raw = [{ id: 1, name: 'IA26 a', longName: 'x', active: 'yes' }];
    expect(() => parseUntisClasses(raw, 'ctx')).toThrow(/active/);
  });

  it('throws when name is not a string', () => {
    const raw = [{ id: 1, name: 42, longName: 'x', active: true }];
    expect(() => parseUntisClasses(raw, 'ctx')).toThrow(/name/);
  });

  it('throws when raw is not an array', () => {
    expect(() => parseUntisClasses('nope', 'ctx')).toThrow(/expected an array/);
  });
});

// ─── parseUntisHolidays ──────────────────────────────────────────────────────

describe('parseUntisHolidays', () => {
  it('passes valid holidays through', () => {
    const raw = [
      {
        id: 1,
        name: 'Herbstferien',
        longName: 'Herbstferien',
        startDate: 20250818,
        endDate: 20250822,
      },
    ];
    expect(parseUntisHolidays(raw, 'holidays')).toBe(raw);
  });

  it('accepts an empty array', () => {
    expect(parseUntisHolidays([], 'holidays')).toEqual([]);
  });

  it('throws with context + index when startDate is missing', () => {
    const raw = [
      { id: 1, name: 'A', longName: 'A', startDate: 20250818, endDate: 20250822 },
      { id: 2, name: 'B', longName: 'B', endDate: 20250822 },
    ];
    expect(() => parseUntisHolidays(raw, 'holidays')).toThrow(/holidays/);
    expect(() => parseUntisHolidays(raw, 'holidays')).toThrow(/index 1/);
    expect(() => parseUntisHolidays(raw, 'holidays')).toThrow(/startDate/);
  });

  it('throws when endDate has the wrong type', () => {
    const raw = [{ id: 1, name: 'A', longName: 'A', startDate: 20250818, endDate: '20250822' }];
    expect(() => parseUntisHolidays(raw, 'holidays')).toThrow(/endDate/);
  });

  it('throws when raw is not an array', () => {
    expect(() => parseUntisHolidays(undefined, 'holidays')).toThrow(/expected an array/);
  });
});
