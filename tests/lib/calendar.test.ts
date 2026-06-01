import { describe, it, expect } from 'vitest';
import { classifyDays, isoToUntisDate, determineSchoolDays, deduplicateLessons, buildDayTooltip } from '@/src/lib/calendar';
import type { CalendarDay, UntisHoliday, UntisLesson, UntisSchoolYear } from '@/src/types';

// School year: Mon 2025-08-18 → Fri 2025-08-22 (one week, for testing)
const SCHOOL_YEAR: UntisSchoolYear = {
  id: 1,
  name: '2025/2026',
  startDate: new Date(2025, 7, 18), // Aug 18 (Mon)
  endDate: new Date(2025, 7, 22),   // Aug 22 (Fri)
};

let lessonIdCounter = 1;
const makeLesson = (date: number, code?: string, id?: number): UntisLesson => ({
  id: id ?? lessonIdCounter++,
  date,
  code,
});

describe('isoToUntisDate', () => {
  it('converts ISO string to YYYYMMDD number', () => {
    expect(isoToUntisDate('2025-08-18')).toBe(20250818);
    expect(isoToUntisDate('2025-12-31')).toBe(20251231);
  });
});

describe('classifyDays', () => {
  it('returns one entry per day of school year', () => {
    const days = classifyDays(SCHOOL_YEAR, [], []);
    expect(days).toHaveLength(5); // Mon–Fri
    expect(days[0].date).toBe('2025-08-18');
    expect(days[4].date).toBe('2025-08-22');
  });

  it('marks days with normal lessons as "normal"', () => {
    const lessons = [makeLesson(20250818), makeLesson(20250819)];
    const days = classifyDays(SCHOOL_YEAR, [], lessons);
    expect(days[0].type).toBe('normal');
    expect(days[0].lessonCount).toBe(1);
  });

  it('marks weekdays with no lessons as "schulausfall" when no timetable data (fallback: all weekdays are school days)', () => {
    // Empty lessons → determineSchoolDays fallback treats every weekday as a school day
    const days = classifyDays(SCHOOL_YEAR, [], []);
    for (const day of days) {
      expect(day.type).toBe('schulausfall');
    }
  });

  it('marks days where all lessons are cancelled as "schulausfall" (0 effective, N cancelled)', () => {
    const lessons = [
      makeLesson(20250818, 'cancelled'),
      makeLesson(20250818, 'cancelled'),
    ];
    const days = classifyDays(SCHOOL_YEAR, [], lessons);
    const mon = days.find((d) => d.date === '2025-08-18');
    expect(mon?.type).toBe('schulausfall');
    expect(mon?.lessonCount).toBe(0);
    expect(mon?.cancelledCount).toBe(2);
  });

  it('marks a day with mixed cancelled/normal lessons as "normal"', () => {
    const lessons = [
      makeLesson(20250818, 'cancelled'),
      makeLesson(20250818), // not cancelled
    ];
    const days = classifyDays(SCHOOL_YEAR, [], lessons);
    expect(days[0].type).toBe('normal');
  });

  it('marks days in a Ferien holiday as "ferien"', () => {
    const holidays: UntisHoliday[] = [{
      id: 1,
      name: 'Herbstferien',
      longName: '',
      startDate: 20250818,
      endDate: 20250822,
    }];
    const days = classifyDays(SCHOOL_YEAR, holidays, []);
    for (const day of days) {
      expect(day.type).toBe('ferien');
      expect(day.holidayName).toBe('Herbstferien');
    }
  });

  it('marks short single-day holidays (Feiertag) as "ferien" with the holiday name', () => {
    const holidays: UntisHoliday[] = [{
      id: 2,
      name: 'Bundesfeiertag',
      longName: '',
      startDate: 20250818,
      endDate: 20250818,
    }];
    const days = classifyDays(SCHOOL_YEAR, holidays, []);
    const aug18 = days.find((d) => d.date === '2025-08-18');
    expect(aug18?.type).toBe('ferien');
    expect(aug18?.holidayName).toBe('Bundesfeiertag');
  });

  it('renders a holiday on a non-school weekday as "no-lessons" (gray, no label)', () => {
    // 5-week year so determineSchoolDays gets real data instead of the fallback.
    const longYear: UntisSchoolYear = {
      id: 1,
      name: '2025/2026',
      startDate: new Date(2025, 7, 18), // Mon Aug 18
      endDate: new Date(2025, 8, 19),   // Fri Sep 19 (5 weeks)
    };
    // Lessons only on Mon–Thu in first 4 weeks → Friday is not a school day for this class.
    const lessons: UntisLesson[] = [
      20250818, 20250819, 20250820, 20250821,
      20250825, 20250826, 20250827, 20250828,
      20250901, 20250902, 20250903, 20250904,
      20250908, 20250909, 20250910, 20250911,
    ].map((d) => makeLesson(d));
    // Holiday on Fri Sep 12 — class does NOT have Fridays.
    const holidays: UntisHoliday[] = [
      { id: 99, name: 'Karfreitag', longName: '', startDate: 20250912, endDate: 20250912 },
    ];
    const days = classifyDays(longYear, holidays, lessons);
    const fri = days.find((d) => d.date === '2025-09-12');
    expect(fri?.type).toBe('no-lessons');
    expect(fri?.holidayName).toBeUndefined();
  });

  it('prefers longName over short name when available', () => {
    const holidays: UntisHoliday[] = [{
      id: 5,
      name: 'kf',
      longName: 'Karfreitag',
      startDate: 20250818,
      endDate: 20250818,
    }];
    const days = classifyDays(SCHOOL_YEAR, holidays, []);
    expect(days[0].holidayName).toBe('Karfreitag');
  });

  it('classifies multi-day non-ferien holiday (>3 days) as "ferien"', () => {
    const holidays: UntisHoliday[] = [{
      id: 3,
      name: 'Weihnachten',
      longName: '',
      startDate: 20250818,
      endDate: 20250822, // 5 days → ferien by duration
    }];
    const days = classifyDays(SCHOOL_YEAR, holidays, []);
    for (const day of days) {
      expect(day.type).toBe('ferien');
    }
  });

  it('holidays take precedence over lessons on same day', () => {
    const holidays: UntisHoliday[] = [{
      id: 4,
      name: 'Feiertag',
      longName: '',
      startDate: 20250818,
      endDate: 20250818,
    }];
    const lessons = [makeLesson(20250818)];
    const days = classifyDays(SCHOOL_YEAR, holidays, lessons);
    expect(days[0].type).toBe('ferien'); // holiday wins, shown as ferien (violet)
    expect(days[0].holidayName).toBe('Feiertag');
  });
});

describe('classifyDays with extended school year (includes weekend)', () => {
  const WEEK_WITH_WEEKEND: UntisSchoolYear = {
    id: 1,
    name: '2025/2026',
    startDate: new Date(2025, 7, 18), // Mon
    endDate: new Date(2025, 7, 24),   // Sun (includes Sat + Sun)
  };

  it('includes weekend days but marks them as "weekend"', () => {
    const days = classifyDays(WEEK_WITH_WEEKEND, [], []);
    expect(days).toHaveLength(7);
    const sat = days.find((d) => d.date === '2025-08-23');
    const sun = days.find((d) => d.date === '2025-08-24');
    expect(sat?.type).toBe('weekend');
    expect(sun?.type).toBe('weekend');
  });
});

// ─── determineSchoolDays ──────────────────────────────────────────────────────

describe('determineSchoolDays', () => {
  it('returns all weekdays as fallback when no lessons given', () => {
    const result = determineSchoolDays([]);
    expect(result).toEqual(new Set([1, 2, 3, 4, 5]));
  });

  it('detects Mon–Fri when lessons exist on all weekdays in first 4 weeks', () => {
    // 4 weeks: Aug 18–22, Aug 25–29, Sep 1–5, Sep 8–12 (all Mon–Fri)
    const lessons: UntisLesson[] = [
      20250818, 20250819, 20250820, 20250821, 20250822,
      20250825, 20250826, 20250827, 20250828, 20250829,
      20250901, 20250902, 20250903, 20250904, 20250905,
      20250908, 20250909, 20250910, 20250911, 20250912,
    ].map((d) => makeLesson(d));
    const result = determineSchoolDays(lessons);
    expect(result).toEqual(new Set([1, 2, 3, 4, 5]));
  });

  it('detects only Mon–Thu when class never has Friday lessons in first 4 weeks', () => {
    // First 4 weeks with only Mon–Thu lessons
    const lessons: UntisLesson[] = [
      20250818, 20250819, 20250820, 20250821, // week 1, no Fri
      20250825, 20250826, 20250827, 20250828, // week 2, no Fri
      20250901, 20250902, 20250903, 20250904, // week 3, no Fri
      20250908, 20250909, 20250910, 20250911, // week 4, no Fri
    ].map((d) => makeLesson(d));
    const result = determineSchoolDays(lessons);
    expect(result).toEqual(new Set([1, 2, 3, 4])); // no Friday (5)
  });

  it('only uses first 4 weeks, ignores later data for school day detection', () => {
    // First 4 weeks: only Mon–Thu; week 5+: Fri also appears
    const lessons: UntisLesson[] = [
      20250818, 20250819, 20250820, 20250821,
      20250825, 20250826, 20250827, 20250828,
      20250901, 20250902, 20250903, 20250904,
      20250908, 20250909, 20250910, 20250911,
      20250915, 20250916, 20250917, 20250918, 20250919, // week 5 has Fri — should be ignored
    ].map((d) => makeLesson(d));
    const result = determineSchoolDays(lessons);
    expect(result).toEqual(new Set([1, 2, 3, 4])); // Fri still not a school day
  });
});

// ─── schulausfall classification ──────────────────────────────────────────────

describe('schulausfall classification', () => {
  // 5-week school year to have enough data for school day detection
  const LONG_SCHOOL_YEAR: UntisSchoolYear = {
    id: 1,
    name: '2025/2026',
    startDate: new Date(2025, 7, 18), // Mon Aug 18
    endDate: new Date(2025, 8, 19),   // Fri Sep 19 (5 weeks)
  };

  it('marks a defined school day with no lessons as "schulausfall"', () => {
    // Lessons on Mon–Thu in first 4 weeks, then week 5 Mon is empty
    const lessons: UntisLesson[] = [
      20250818, 20250819, 20250820, 20250821,
      20250825, 20250826, 20250827, 20250828,
      20250901, 20250902, 20250903, 20250904,
      20250908, 20250909, 20250910, 20250911,
      // week 5: Tue–Thu only, Mon (20250915) has no lessons
      20250916, 20250917, 20250918,
    ].map((d) => makeLesson(d));

    const days = classifyDays(LONG_SCHOOL_YEAR, [], lessons);
    const mon5 = days.find((d) => d.date === '2025-09-15'); // Mon week 5
    expect(mon5?.type).toBe('schulausfall');
  });

  it('marks a non-school weekday (no lessons in first 4 weeks) as "no-lessons"', () => {
    // Lessons only Mon–Thu in first 4 weeks; Fri never has lessons
    const lessons: UntisLesson[] = [
      20250818, 20250819, 20250820, 20250821,
      20250825, 20250826, 20250827, 20250828,
      20250901, 20250902, 20250903, 20250904,
      20250908, 20250909, 20250910, 20250911,
    ].map((d) => makeLesson(d));

    const days = classifyDays(LONG_SCHOOL_YEAR, [], lessons);
    // Every Friday should be 'no-lessons', not 'schulausfall'
    const fridays = days.filter((d) => {
      const dow = new Date(d.date).getDay();
      return dow === 5; // JS getDay: 5 = Friday
    });
    for (const fri of fridays) {
      expect(fri.type).toBe('no-lessons');
    }
  });
});

// ─── Veranstaltung (event) → Schulausfall ─────────────────────────────────────

describe('classifyDays — Veranstaltung (irregular event with no subject)', () => {
  const makeEvent = (date: number, lstext?: string, substText?: string): UntisLesson => ({
    id: lessonIdCounter++,
    date,
    code: 'irregular',
    su: [], // no subject → not a real lesson
    lstext,
    substText,
  });

  it('treats a day of cancelled lessons + 1 empty-subject irregular event as schulausfall with the event name', () => {
    // Mirrors AB24 a on 2027-07-13: 9 cancelled lessons + 1 irregular event period.
    const lessons: UntisLesson[] = [
      ...Array.from({ length: 9 }, () => makeLesson(20250818, 'cancelled')),
      makeEvent(20250818, 'Lehrpersonenweiterbildung Abteilung Wirtschaft'),
    ];
    const days = classifyDays(SCHOOL_YEAR, [], lessons);
    const mon = days.find((d) => d.date === '2025-08-18');
    expect(mon?.type).toBe('schulausfall');
    expect(mon?.eventName).toBe('Lehrpersonenweiterbildung Abteilung Wirtschaft');
    expect(mon?.lessonCount).toBe(0);
    expect(mon?.cancelledCount).toBe(9);
  });

  it('falls back to substText for the event name when lstext is absent', () => {
    const lessons: UntisLesson[] = [
      makeLesson(20250818, 'cancelled'),
      makeEvent(20250818, undefined, 'Sporttag'),
    ];
    const days = classifyDays(SCHOOL_YEAR, [], lessons);
    expect(days[0].type).toBe('schulausfall');
    expect(days[0].eventName).toBe('Sporttag');
  });

  it('does NOT treat an irregular period that still has a subject as an event (substitution still teaches → normal)', () => {
    const substitution: UntisLesson = {
      id: lessonIdCounter++,
      date: 20250818,
      code: 'irregular',
      su: [{ name: 'Eng' }], // subject present → real teaching
    };
    const lessons: UntisLesson[] = [makeLesson(20250818, 'cancelled'), substitution];
    const days = classifyDays(SCHOOL_YEAR, [], lessons);
    expect(days[0].type).toBe('normal');
    expect(days[0].lessonCount).toBe(1);
    expect(days[0].eventName).toBeUndefined();
  });

  it('does not set eventName on an ordinary all-cancelled day (regression)', () => {
    const lessons = Array.from({ length: 5 }, () => makeLesson(20250818, 'cancelled'));
    const days = classifyDays(SCHOOL_YEAR, [], lessons);
    expect(days[0].type).toBe('schulausfall');
    expect(days[0].eventName).toBeUndefined();
  });
});

// ─── deduplicateLessons ───────────────────────────────────────────────────────

describe('deduplicateLessons', () => {
  it('returns empty array for empty input', () => {
    expect(deduplicateLessons([])).toEqual([]);
    expect(deduplicateLessons([[], []])).toEqual([]);
  });

  it('flattens multiple class lesson arrays into one', () => {
    const a = [makeLesson(20250818, undefined, 100), makeLesson(20250818, undefined, 101)];
    const b = [makeLesson(20250818, undefined, 200)];
    expect(deduplicateLessons([a, b])).toHaveLength(3);
  });

  it('removes lessons sharing the same id across class arrays', () => {
    // Same lesson id appearing in two parallel classes (e.g. shared lesson)
    const sharedId = 999;
    const a = [makeLesson(20250818, undefined, sharedId), makeLesson(20250818, undefined, 100)];
    const b = [makeLesson(20250818, undefined, sharedId), makeLesson(20250818, undefined, 200)];
    const result = deduplicateLessons([a, b]);
    expect(result).toHaveLength(3); // shared + a-only + b-only
    expect(result.map((l) => l.id)).toEqual([sharedId, 100, 200]);
  });

  it('removes duplicates within a single array too', () => {
    const dup = makeLesson(20250818, undefined, 42);
    const result = deduplicateLessons([[dup, dup, dup]]);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(42);
  });

  it('preserves the first-seen order', () => {
    const a = [makeLesson(20250818, undefined, 1), makeLesson(20250818, undefined, 2)];
    const b = [makeLesson(20250818, undefined, 3), makeLesson(20250818, undefined, 1)];
    const result = deduplicateLessons([a, b]);
    expect(result.map((l) => l.id)).toEqual([1, 2, 3]);
  });
});

// ─── lesson count behaviour ────────────────────────────────────────────────────

describe('classifyDays — lessonCount', () => {
  it('lessonCount counts effective lessons; cancelledCount counts cancelled separately', () => {
    // Realistic IA22a Monday: 4 normal lessons + 1 cancelled
    const lessons = [
      makeLesson(20250818),
      makeLesson(20250818),
      makeLesson(20250818),
      makeLesson(20250818),
      makeLesson(20250818, 'cancelled'),
    ];
    const days = classifyDays(SCHOOL_YEAR, [], lessons);
    expect(days[0].lessonCount).toBe(4);
    expect(days[0].cancelledCount).toBe(1);
    expect(days[0].type).toBe('normal');
  });

  it('all-cancelled day: lessonCount = 0, cancelledCount = N, type → schulausfall', () => {
    const lessons = Array.from({ length: 5 }, () => makeLesson(20250818, 'cancelled'));
    const days = classifyDays(SCHOOL_YEAR, [], lessons);
    expect(days[0].lessonCount).toBe(0);
    expect(days[0].cancelledCount).toBe(5);
    expect(days[0].type).toBe('schulausfall');
  });

  it('lessonCount is 0 and cancelledCount undefined on a Schulausfall day with no lessons at all', () => {
    const days = classifyDays(SCHOOL_YEAR, [], []);
    expect(days[0].lessonCount).toBe(0);
    expect(days[0].cancelledCount).toBeUndefined();
    expect(days[0].type).toBe('schulausfall'); // empty lessons → fallback school days
  });

  it('lessonCount is undefined for weekend days', () => {
    const weekendYear: UntisSchoolYear = {
      ...SCHOOL_YEAR,
      endDate: new Date(2025, 7, 24), // include Sat + Sun
    };
    const days = classifyDays(weekendYear, [], []);
    const sat = days.find((d) => d.date === '2025-08-23');
    const sun = days.find((d) => d.date === '2025-08-24');
    expect(sat?.lessonCount).toBeUndefined();
    expect(sun?.lessonCount).toBeUndefined();
  });

  it('lessonCount is undefined on Ferien days', () => {
    const holidays: UntisHoliday[] = [
      { id: 1, name: 'Herbstferien', longName: '', startDate: 20250818, endDate: 20250822 },
    ];
    const days = classifyDays(SCHOOL_YEAR, holidays, []);
    for (const day of days) {
      expect(day.type).toBe('ferien');
      expect(day.lessonCount).toBeUndefined();
    }
  });

  it('lessonCount is undefined on Feiertag days (holiday wins over lessons, shown as ferien)', () => {
    const holidays: UntisHoliday[] = [
      { id: 1, name: 'Bundesfeiertag', longName: '', startDate: 20250818, endDate: 20250818 },
    ];
    // Even if WebUntis returns lessons on a holiday, the holiday takes priority
    const lessons = [makeLesson(20250818), makeLesson(20250818)];
    const days = classifyDays(SCHOOL_YEAR, holidays, lessons);
    const aug18 = days.find((d) => d.date === '2025-08-18');
    expect(aug18?.type).toBe('ferien');
    expect(aug18?.holidayName).toBe('Bundesfeiertag');
    expect(aug18?.lessonCount).toBeUndefined();
  });

  it('lessonCount matches the daily entry count after API-side dedup (realistic IA22 a + BM22 a)', () => {
    // IA22a Monday has 4 entries, BM22a Monday has 5 entries, no shared ids.
    // After dedup: 9 total on Monday.
    const ia22aMon = Array.from({ length: 4 }, (_, i) => makeLesson(20250818, undefined, 1000 + i));
    const bm22aMon = Array.from({ length: 5 }, (_, i) => makeLesson(20250818, undefined, 2000 + i));
    const merged = deduplicateLessons([ia22aMon, bm22aMon]);
    expect(merged).toHaveLength(9);

    const days = classifyDays(SCHOOL_YEAR, [], merged);
    const mon = days.find((d) => d.date === '2025-08-18');
    expect(mon?.lessonCount).toBe(9);
  });

  it('lessonCount stays correct even when companion classes accidentally share lesson ids', () => {
    // Hypothetical: same lesson appears in both class timetables with same id → dedup must kick in.
    const shared = makeLesson(20250818, undefined, 50);
    const ia = [shared, makeLesson(20250818, undefined, 51)];
    const bm = [shared, makeLesson(20250818, undefined, 52)];
    const merged = deduplicateLessons([ia, bm]);

    const days = classifyDays(SCHOOL_YEAR, [], merged);
    expect(days[0].lessonCount).toBe(3); // not 4 — the shared lesson is deduplicated
  });

  it('lessonCount per day matches IA22a real-world pattern: 4 on Monday, 0 on Tue–Fri (no-lessons)', () => {
    // Mirrors actual probed data for IA22a: ~4 lessons on Mondays only, never mid-week.
    // → determineSchoolDays detects Monday as the only school day; Tue–Fri become 'no-lessons'.
    const lessons = Array.from({ length: 4 }, (_, i) =>
      makeLesson(20250818, undefined, 100 + i),
    );
    const days = classifyDays(SCHOOL_YEAR, [], lessons);
    const mon = days.find((d) => d.date === '2025-08-18');
    const tue = days.find((d) => d.date === '2025-08-19');
    const fri = days.find((d) => d.date === '2025-08-22');

    expect(mon?.lessonCount).toBe(4);
    expect(mon?.type).toBe('normal');
    expect(tue?.lessonCount).toBe(0);
    expect(tue?.type).toBe('no-lessons'); // Tuesday is not a school day for this class
    expect(fri?.lessonCount).toBe(0);
    expect(fri?.type).toBe('no-lessons');
  });
});

// ─── buildDayTooltip ──────────────────────────────────────────────────────────

describe('buildDayTooltip', () => {
  const baseDay: CalendarDay = { date: '2025-08-18', type: 'normal' };

  it('returns holiday name when present (wins over everything)', () => {
    const day: CalendarDay = { ...baseDay, holidayName: 'Bundesfeiertag', lessonCount: 4, cancelledCount: 1 };
    expect(buildDayTooltip(day)).toBe('Bundesfeiertag');
  });

  it('uses singular for 1 lesson', () => {
    expect(buildDayTooltip({ ...baseDay, lessonCount: 1 })).toBe('1 Lektion');
  });

  it('uses plural for >1 lessons', () => {
    expect(buildDayTooltip({ ...baseDay, lessonCount: 5 })).toBe('5 Lektionen');
  });

  it('combines effective + cancelled lessons', () => {
    expect(buildDayTooltip({ ...baseDay, lessonCount: 5, cancelledCount: 2 })).toBe('5 Lektionen, 2 abgesagt');
  });

  it('shows only cancelled when no effective lessons (Schulausfall mit Lektionen)', () => {
    expect(buildDayTooltip({ ...baseDay, type: 'schulausfall', lessonCount: 0, cancelledCount: 9 })).toBe('9 abgesagt');
  });

  it('shows the event name then cancelled count for a Veranstaltung day', () => {
    expect(
      buildDayTooltip({ ...baseDay, type: 'schulausfall', eventName: 'Lehrpersonenweiterbildung Abteilung Wirtschaft', lessonCount: 0, cancelledCount: 9 }),
    ).toBe('Lehrpersonenweiterbildung Abteilung Wirtschaft, 9 abgesagt');
  });

  it('returns undefined when there is nothing to show (e.g. empty Schulausfall)', () => {
    expect(buildDayTooltip({ ...baseDay, type: 'schulausfall', lessonCount: 0 })).toBeUndefined();
  });

  it('returns undefined for a bare weekend/no-lessons day with no counts', () => {
    expect(buildDayTooltip({ date: '2025-08-23', type: 'weekend' })).toBeUndefined();
  });
});
