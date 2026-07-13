import { describe, it, expect } from 'vitest';
import {
  classifyDays,
  isoToUntisDate,
  determineSchoolDays,
  deduplicateLessons,
  buildDayTooltip,
  halfStatusLabel,
  findSuspiciousLessons,
  removeNonSchoolDayBookings,
  SUSPICIOUS_LSNUMBER_THRESHOLD,
  extractAusfallReason,
} from '@/src/lib/calendar';
import type { CalendarDay, UntisHoliday, UntisLesson, UntisSchoolYear } from '@/src/types';

// School year: Mon 2025-08-18 → Fri 2025-08-22 (one week, for testing)
const SCHOOL_YEAR: UntisSchoolYear = {
  id: 1,
  name: '2025/2026',
  startDate: new Date(2025, 7, 18), // Aug 18 (Mon)
  endDate: new Date(2025, 7, 22), // Aug 22 (Fri)
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

  it('marks weekdays with no lessons as "unterrichtsausfall" when no timetable data (fallback: all weekdays are school days)', () => {
    // Empty lessons → determineSchoolDays fallback treats every weekday as a school day
    const days = classifyDays(SCHOOL_YEAR, [], []);
    for (const day of days) {
      expect(day.type).toBe('unterrichtsausfall');
    }
  });

  it('marks days where all lessons are cancelled as "unterrichtsausfall" (0 effective, N cancelled)', () => {
    const lessons = [makeLesson(20250818, 'cancelled'), makeLesson(20250818, 'cancelled')];
    const days = classifyDays(SCHOOL_YEAR, [], lessons);
    const mon = days.find((d) => d.date === '2025-08-18');
    expect(mon?.type).toBe('unterrichtsausfall');
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
    const holidays: UntisHoliday[] = [
      {
        id: 1,
        name: 'Herbstferien',
        longName: '',
        startDate: 20250818,
        endDate: 20250822,
      },
    ];
    const days = classifyDays(SCHOOL_YEAR, holidays, []);
    for (const day of days) {
      expect(day.type).toBe('ferien');
      expect(day.holidayName).toBe('Herbstferien');
    }
  });

  it('marks short single-day holidays (Feiertag) as "ferien" with the holiday name', () => {
    const holidays: UntisHoliday[] = [
      {
        id: 2,
        name: 'Bundesfeiertag',
        longName: '',
        startDate: 20250818,
        endDate: 20250818,
      },
    ];
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
      endDate: new Date(2025, 8, 19), // Fri Sep 19 (5 weeks)
    };
    // Lessons only on Mon–Thu in first 4 weeks → Friday is not a school day for this class.
    const lessons: UntisLesson[] = [
      20250818, 20250819, 20250820, 20250821, 20250825, 20250826, 20250827, 20250828, 20250901,
      20250902, 20250903, 20250904, 20250908, 20250909, 20250910, 20250911,
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
    const holidays: UntisHoliday[] = [
      {
        id: 5,
        name: 'kf',
        longName: 'Karfreitag',
        startDate: 20250818,
        endDate: 20250818,
      },
    ];
    const days = classifyDays(SCHOOL_YEAR, holidays, []);
    expect(days[0].holidayName).toBe('Karfreitag');
  });

  it('classifies multi-day non-ferien holiday (>3 days) as "ferien"', () => {
    const holidays: UntisHoliday[] = [
      {
        id: 3,
        name: 'Weihnachten',
        longName: '',
        startDate: 20250818,
        endDate: 20250822, // 5 days → ferien by duration
      },
    ];
    const days = classifyDays(SCHOOL_YEAR, holidays, []);
    for (const day of days) {
      expect(day.type).toBe('ferien');
    }
  });

  it('holidays take precedence over lessons on same day', () => {
    const holidays: UntisHoliday[] = [
      {
        id: 4,
        name: 'Feiertag',
        longName: '',
        startDate: 20250818,
        endDate: 20250818,
      },
    ];
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
    endDate: new Date(2025, 7, 24), // Sun (includes Sat + Sun)
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
      20250818, 20250819, 20250820, 20250821, 20250822, 20250825, 20250826, 20250827, 20250828,
      20250829, 20250901, 20250902, 20250903, 20250904, 20250905, 20250908, 20250909, 20250910,
      20250911, 20250912,
    ].map((d) => makeLesson(d));
    const result = determineSchoolDays(lessons);
    expect(result).toEqual(new Set([1, 2, 3, 4, 5]));
  });

  it('detects only Mon–Thu when class never has Friday lessons in first 4 weeks', () => {
    // First 4 weeks with only Mon–Thu lessons
    const lessons: UntisLesson[] = [
      20250818,
      20250819,
      20250820,
      20250821, // week 1, no Fri
      20250825,
      20250826,
      20250827,
      20250828, // week 2, no Fri
      20250901,
      20250902,
      20250903,
      20250904, // week 3, no Fri
      20250908,
      20250909,
      20250910,
      20250911, // week 4, no Fri
    ].map((d) => makeLesson(d));
    const result = determineSchoolDays(lessons);
    expect(result).toEqual(new Set([1, 2, 3, 4])); // no Friday (5)
  });

  it('ignores weekend lessons when determining school days (isoDay > 5 branch)', () => {
    // Aug 23 2025 = Saturday (ISO day 6) — must not add 6 to the schoolDays set
    const lessons: UntisLesson[] = [
      makeLesson(20250818), // Monday → ISO day 1
      makeLesson(20250823), // Saturday → ISO day 6, filtered by isoDay <= 5 check
    ];
    const result = determineSchoolDays(lessons);
    expect(result.has(6)).toBe(false);
    expect(result.has(1)).toBe(true);
  });

  it('only uses first 4 weeks, ignores later data for school day detection', () => {
    // First 4 weeks: only Mon–Thu; week 5+: Fri also appears
    const lessons: UntisLesson[] = [
      20250818,
      20250819,
      20250820,
      20250821,
      20250825,
      20250826,
      20250827,
      20250828,
      20250901,
      20250902,
      20250903,
      20250904,
      20250908,
      20250909,
      20250910,
      20250911,
      20250915,
      20250916,
      20250917,
      20250918,
      20250919, // week 5 has Fri — should be ignored
    ].map((d) => makeLesson(d));
    const result = determineSchoolDays(lessons);
    expect(result).toEqual(new Set([1, 2, 3, 4])); // Fri still not a school day
  });
});

// ─── unterrichtsausfall classification ──────────────────────────────────────────────

describe('unterrichtsausfall classification', () => {
  // 5-week school year to have enough data for school day detection
  const LONG_SCHOOL_YEAR: UntisSchoolYear = {
    id: 1,
    name: '2025/2026',
    startDate: new Date(2025, 7, 18), // Mon Aug 18
    endDate: new Date(2025, 8, 19), // Fri Sep 19 (5 weeks)
  };

  it('marks a defined school day with no lessons as "unterrichtsausfall"', () => {
    // Lessons on Mon–Thu in first 4 weeks, then week 5 Mon is empty
    const lessons: UntisLesson[] = [
      20250818, 20250819, 20250820, 20250821, 20250825, 20250826, 20250827, 20250828, 20250901,
      20250902, 20250903, 20250904, 20250908, 20250909, 20250910, 20250911,
      // week 5: Tue–Thu only, Mon (20250915) has no lessons
      20250916, 20250917, 20250918,
    ].map((d) => makeLesson(d));

    const days = classifyDays(LONG_SCHOOL_YEAR, [], lessons);
    const mon5 = days.find((d) => d.date === '2025-09-15'); // Mon week 5
    expect(mon5?.type).toBe('unterrichtsausfall');
  });

  it('marks a non-school weekday (no lessons in first 4 weeks) as "no-lessons"', () => {
    // Lessons only Mon–Thu in first 4 weeks; Fri never has lessons
    const lessons: UntisLesson[] = [
      20250818, 20250819, 20250820, 20250821, 20250825, 20250826, 20250827, 20250828, 20250901,
      20250902, 20250903, 20250904, 20250908, 20250909, 20250910, 20250911,
    ].map((d) => makeLesson(d));

    const days = classifyDays(LONG_SCHOOL_YEAR, [], lessons);
    // Every Friday should be 'no-lessons', not 'unterrichtsausfall'
    const fridays = days.filter((d) => {
      const dow = new Date(d.date).getDay();
      return dow === 5; // JS getDay: 5 = Friday
    });
    for (const fri of fridays) {
      expect(fri.type).toBe('no-lessons');
    }
  });
});

// ─── ended flag (Abschlussklasse — finished the year) ────────────────────────

describe('classifyDays — ended flag (class finished for the year)', () => {
  // 5-week year (Mon Aug 18 → Fri Sep 19). School days are Mon–Thu.
  const LONG_SCHOOL_YEAR: UntisSchoolYear = {
    id: 1,
    name: '2025/2026',
    startDate: new Date(2025, 7, 18), // Mon Aug 18
    endDate: new Date(2025, 8, 19), // Fri Sep 19
  };

  // Lessons Mon–Thu in weeks 1,2,4; week 3 Monday (20250901) intentionally empty
  // (a mid-year gap); last lesson = week 4 Thursday (20250911); week 5 fully empty.
  const lessons: UntisLesson[] = [
    20250818,
    20250819,
    20250820,
    20250821, // week 1 Mon–Thu
    20250825,
    20250826,
    20250827,
    20250828, // week 2 Mon–Thu
    /* 20250901 gap */ 20250902,
    20250903,
    20250904, // week 3 Tue–Thu
    20250908,
    20250909,
    20250910,
    20250911, // week 4 Mon–Thu (last = 20250911)
  ].map((d) => makeLesson(d));

  it('flags empty school days AFTER the last lesson as ended (still unterrichtsausfall)', () => {
    const days = classifyDays(LONG_SCHOOL_YEAR, [], lessons);
    const mon5 = days.find((d) => d.date === '2025-09-15'); // week 5 Mon, after last lesson
    expect(mon5?.type).toBe('unterrichtsausfall');
    expect(mon5?.ended).toBe(true);
    const thu5 = days.find((d) => d.date === '2025-09-18'); // week 5 Thu
    expect(thu5?.ended).toBe(true);
  });

  it('does NOT flag an empty school day BEFORE the last lesson (intermittent gap)', () => {
    const days = classifyDays(LONG_SCHOOL_YEAR, [], lessons);
    const gapMon = days.find((d) => d.date === '2025-09-01'); // week 3 Mon, before last lesson
    expect(gapMon?.type).toBe('unterrichtsausfall');
    expect(gapMon?.ended).toBeUndefined();
  });

  it('does NOT flag non-school weekdays after the last lesson (stays no-lessons)', () => {
    const days = classifyDays(LONG_SCHOOL_YEAR, [], lessons);
    const fri5 = days.find((d) => d.date === '2025-09-19'); // week 5 Fri — never a school day
    expect(fri5?.type).toBe('no-lessons');
    expect(fri5?.ended).toBeUndefined();
  });

  it('does NOT flag ended when the class has no lessons at all (lastLessonDate null)', () => {
    const days = classifyDays(LONG_SCHOOL_YEAR, [], []);
    for (const day of days) expect(day.ended).toBeUndefined();
  });

  it('treats a cancelled lesson as the last lesson — empty days after it are ended', () => {
    // Last entry is a cancelled lesson (still a scheduled-lesson entry).
    const withCancelledTail: UntisLesson[] = [
      ...lessons,
      makeLesson(20250915, 'cancelled'), // week 5 Mon: all cancelled
    ];
    const days = classifyDays(LONG_SCHOOL_YEAR, [], withCancelledTail);
    const mon5 = days.find((d) => d.date === '2025-09-15'); // has cancelled lessons → not empty
    expect(mon5?.type).toBe('unterrichtsausfall');
    expect(mon5?.cancelledCount).toBe(1);
    expect(mon5?.ended).toBeUndefined(); // not an empty day → not flagged here
    const tue5 = days.find((d) => d.date === '2025-09-16'); // empty school day after 20250915
    expect(tue5?.ended).toBe(true);
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

  it('treats a day of cancelled lessons + 1 empty-subject irregular event as veranstaltung with the event name', () => {
    // Mirrors AB24 a on 2027-07-13: 9 cancelled lessons + 1 irregular event period.
    const lessons: UntisLesson[] = [
      ...Array.from({ length: 9 }, () => makeLesson(20250818, 'cancelled')),
      makeEvent(20250818, 'Lehrpersonenweiterbildung Abteilung Wirtschaft'),
    ];
    const days = classifyDays(SCHOOL_YEAR, [], lessons);
    const mon = days.find((d) => d.date === '2025-08-18');
    expect(mon?.type).toBe('veranstaltung');
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
    expect(days[0].type).toBe('veranstaltung');
    expect(days[0].eventName).toBe('Sporttag');
  });

  it('treats irregular lesson with su undefined (absent) as event period (covers ?? 0 fallback)', () => {
    // su is omitted → su?.length is undefined → ?? 0 fires → isEventPeriod returns true
    const eventNoSu: UntisLesson = {
      id: lessonIdCounter++,
      date: 20250818,
      code: 'irregular',
      lstext: 'Studientag',
      // su intentionally absent
    };
    const days = classifyDays(SCHOOL_YEAR, [], [makeLesson(20250818, 'cancelled'), eventNoSu]);
    expect(days[0].type).toBe('veranstaltung');
    expect(days[0].eventName).toBe('Studientag');
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
    expect(days[0].type).toBe('unterrichtsausfall');
    expect(days[0].eventName).toBeUndefined();
  });

  it('classifies "Unterrichtsausfall" Veranstaltung on a non-school day as no-lessons', () => {
    // Monday has real lessons → school day. Tuesday–Friday have only an
    // "Unterrichtsausfall" event → not a school day for this class, so no color.
    const lessons: UntisLesson[] = [
      makeLesson(20250818), // Monday: real lesson → school day
      makeEvent(20250819, 'Unterrichtsausfall BM2'), // Tuesday: not a school day
      makeEvent(20250822, 'Unterrichtsausfall Abt. W'), // Friday: not a school day
    ];
    const days = classifyDays(SCHOOL_YEAR, [], lessons);
    const tue = days.find((d) => d.date === '2025-08-19');
    const fri = days.find((d) => d.date === '2025-08-22');
    expect(tue?.type).toBe('no-lessons');
    expect(fri?.type).toBe('no-lessons');
  });

  it('classifies "Unterrichtsausfall" Veranstaltung on a school day as unterrichtsausfall', () => {
    // Both Monday and Tuesday are school days (each has a real lesson in week 1).
    // On a later Monday there's only an "Unterrichtsausfall" event → unterrichtsausfall.
    const multiWeekYear: UntisSchoolYear = {
      id: 1,
      name: '2025/2026',
      startDate: new Date(2025, 7, 18), // Aug 18 (Mon)
      endDate: new Date(2025, 7, 25), // Aug 25 (Mon, second week)
    };
    const lessons: UntisLesson[] = [
      makeLesson(20250818), // Mon wk1 → school day
      makeLesson(20250819), // Tue wk1 → school day
      makeEvent(20250825, 'Unterrichtsausfall Weiterbildung'), // Mon wk2 → unterrichtsausfall
    ];
    const days = classifyDays(multiWeekYear, [], lessons);
    const mon2 = days.find((d) => d.date === '2025-08-25');
    expect(mon2?.type).toBe('unterrichtsausfall');
    expect(mon2?.eventName).toBe('Unterrichtsausfall Weiterbildung');
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

  it('all-cancelled day: lessonCount = 0, cancelledCount = N, type → unterrichtsausfall', () => {
    const lessons = Array.from({ length: 5 }, () => makeLesson(20250818, 'cancelled'));
    const days = classifyDays(SCHOOL_YEAR, [], lessons);
    expect(days[0].lessonCount).toBe(0);
    expect(days[0].cancelledCount).toBe(5);
    expect(days[0].type).toBe('unterrichtsausfall');
  });

  it('lessonCount is 0 and cancelledCount undefined on a Schulausfall day with no lessons at all', () => {
    const days = classifyDays(SCHOOL_YEAR, [], []);
    expect(days[0].lessonCount).toBe(0);
    expect(days[0].cancelledCount).toBeUndefined();
    expect(days[0].type).toBe('unterrichtsausfall'); // empty lessons → fallback school days
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
    const lessons = Array.from({ length: 4 }, (_, i) => makeLesson(20250818, undefined, 100 + i));
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

// ─── day split (Vormittag/Nachmittag: status + linked class) ─────────────────────

describe('classifyDays — halfDay split (status + class per half)', () => {
  // startTime is an HHMM number; <1200 = Vormittag, >=1200 = Nachmittag.
  // cls → sourceClassId, the class a lesson was fetched under.
  const IA = 4098,
    BM = 3855;
  const at = (startTime: number, code?: string, cls?: number): UntisLesson => ({
    id: lessonIdCounter++,
    date: 20250818, // Monday
    startTime,
    code,
    sourceClassId: cls,
  });
  const mondayOf = (lessons: UntisLesson[]): CalendarDay =>
    classifyDays(SCHOOL_YEAR, [], lessons).find((d) => d.date === '2025-08-18')!;

  it('splits a morning-only half day into lessons | none, carrying the owning class', () => {
    const mon = mondayOf([at(800, undefined, IA), at(950, undefined, IA), at(1140, undefined, IA)]);
    expect(mon.type).toBe('normal');
    expect(mon.lessonCount).toBe(3);
    expect(mon.halfDay).toEqual({
      morning: { status: 'lessons', classId: IA },
      afternoon: { status: 'none' },
    });
    expect(mon.linkClassId).toBeUndefined(); // split days link per half, not per day
  });

  it('marks a cancelled afternoon as the orange half (lessons | cancelled)', () => {
    const mon = mondayOf([
      at(800, undefined, IA),
      at(900, undefined, IA),
      at(1300, 'cancelled', IA),
      at(1400, 'cancelled', IA),
    ]);
    expect(mon.lessonCount).toBe(2);
    expect(mon.cancelledCount).toBe(2);
    expect(mon.halfDay).toEqual({
      morning: { status: 'lessons', classId: IA },
      afternoon: { status: 'cancelled', classId: IA },
    });
  });

  it('handles an afternoon class whose morning was cancelled (cancelled | lessons)', () => {
    const mon = mondayOf([
      at(800, 'cancelled', IA),
      at(1300, undefined, IA),
      at(1400, undefined, IA),
    ]);
    expect(mon.halfDay).toEqual({
      morning: { status: 'cancelled', classId: IA },
      afternoon: { status: 'lessons', classId: IA },
    });
  });

  it('splits an afternoon-only half day into none | lessons', () => {
    const mon = mondayOf([at(1300, undefined, IA), at(1400, undefined, IA)]);
    expect(mon.halfDay).toEqual({
      morning: { status: 'none' },
      afternoon: { status: 'lessons', classId: IA },
    });
  });

  it('splits a full day taught by two classes into green|green, each half linking its class', () => {
    // 4 IA in the morning + 3 BM in the afternoon = 7 held → full day, but a class boundary.
    const mon = mondayOf([
      at(800, undefined, IA),
      at(900, undefined, IA),
      at(1000, undefined, IA),
      at(1100, undefined, IA),
      at(1300, undefined, BM),
      at(1400, undefined, BM),
      at(1500, undefined, BM),
    ]);
    expect(mon.type).toBe('normal');
    expect(mon.halfDay).toEqual({
      morning: { status: 'lessons', classId: IA },
      afternoon: { status: 'lessons', classId: BM },
    });
  });

  it('keeps a >=6 day green even when afternoon lessons are cancelled (6-rule overrides orange)', () => {
    const mon = mondayOf([
      at(745, undefined, IA),
      at(830, undefined, IA),
      at(915, undefined, IA),
      at(1000, undefined, IA),
      at(1045, undefined, IA),
      at(1130, undefined, IA), // 6 held, all AM
      at(1300, 'cancelled', IA),
      at(1400, 'cancelled', IA), // PM cancelled
    ]);
    expect(mon.type).toBe('normal');
    expect(mon.lessonCount).toBe(6);
    expect(mon.halfDay).toBeUndefined();
    expect(mon.linkClassId).toBe(IA);
  });

  it('does NOT split a full single-class day (>=6, both halves taught)', () => {
    const mon = mondayOf([
      at(800, undefined, IA),
      at(900, undefined, IA),
      at(1000, undefined, IA),
      at(1300, undefined, IA),
      at(1400, undefined, IA),
      at(1500, undefined, IA),
    ]);
    expect(mon.halfDay).toBeUndefined();
    expect(mon.linkClassId).toBe(IA);
  });

  it('does NOT split a short single-class day that still teaches in both halves', () => {
    const mon = mondayOf([
      at(800, undefined, IA),
      at(900, undefined, IA),
      at(1000, undefined, IA),
      at(1300, undefined, IA),
      at(1400, undefined, IA),
    ]); // 3 + 2 = 5
    expect(mon.lessonCount).toBe(5);
    expect(mon.halfDay).toBeUndefined();
    expect(mon.linkClassId).toBe(IA);
  });

  it('attaches the Schulausfall reason (event period) to the cancelled half', () => {
    // IA morning cancelled with a "QV BM & KV" event; BM teaches in the afternoon.
    const ev = (startTime: number, lstext: string): UntisLesson => ({
      id: lessonIdCounter++,
      date: 20250818,
      startTime,
      code: 'irregular',
      su: [],
      lstext,
      sourceClassId: IA,
    });
    const mon = mondayOf([
      at(800, 'cancelled', IA),
      at(900, 'cancelled', IA),
      ev(800, 'QV BM & KV'),
      at(1300, undefined, BM),
      at(1400, undefined, BM),
    ]);
    expect(mon.type).toBe('normal');
    expect(mon.halfDay).toEqual({
      morning: { status: 'cancelled', classId: IA, reason: 'QV BM & KV' },
      afternoon: { status: 'lessons', classId: BM },
    });
  });

  it('leaves a cancelled half without an event period reasonless', () => {
    const mon = mondayOf([
      at(800, 'cancelled', IA),
      at(900, 'cancelled', IA),
      at(1300, undefined, BM),
    ]);
    expect(mon.halfDay?.morning).toEqual({ status: 'cancelled', classId: IA }); // no reason key
  });

  it('splits an all-cancelled day from two classes into orange | orange (Ausfalltag)', () => {
    const mon = mondayOf([
      at(800, 'cancelled', IA),
      at(900, 'cancelled', IA),
      at(1300, 'cancelled', BM),
      at(1400, 'cancelled', BM),
    ]);
    expect(mon.type).toBe('unterrichtsausfall');
    expect(mon.halfDay).toEqual({
      morning: { status: 'cancelled', classId: IA },
      afternoon: { status: 'cancelled', classId: BM },
    });
  });

  it('keeps a single-class all-cancelled day as one cell, linking that class', () => {
    const mon = mondayOf([at(800, 'cancelled', IA), at(1300, 'cancelled', IA)]);
    expect(mon.type).toBe('unterrichtsausfall');
    expect(mon.halfDay).toBeUndefined();
    expect(mon.linkClassId).toBe(IA);
  });

  // Symmetry with the green ≥6 full-day rule: a full teaching load (≥6) that is
  // entirely cancelled reads as a full orange day, not a lone orange half.
  it('collapses a ≥6 afternoon-only cancelled day into a full orange day (FBA26 f case)', () => {
    // The same 6 afternoon lessons HELD would be a full green day, so cancelled they
    // form a full orange day — no grey "free" morning beside a lone orange afternoon.
    const mon = mondayOf([
      at(1300, 'cancelled', IA),
      at(1350, 'cancelled', IA),
      at(1450, 'cancelled', IA),
      at(1540, 'cancelled', IA),
      at(1540, 'cancelled', IA),
      at(1630, 'cancelled', IA),
    ]);
    expect(mon.type).toBe('unterrichtsausfall');
    expect(mon.cancelledCount).toBe(6);
    expect(mon.halfDay).toBeUndefined();
    expect(mon.linkClassId).toBe(IA);
  });

  it('collapses a ≥6 morning-only cancelled day into a full orange day too', () => {
    const mon = mondayOf([
      at(745, 'cancelled', IA),
      at(835, 'cancelled', IA),
      at(925, 'cancelled', IA),
      at(1015, 'cancelled', IA),
      at(1105, 'cancelled', IA),
      at(1150, 'cancelled', IA),
    ]);
    expect(mon.halfDay).toBeUndefined();
    expect(mon.linkClassId).toBe(IA);
  });

  it('keeps a <6 afternoon-only cancelled day as a half (none | cancelled)', () => {
    const mon = mondayOf([
      at(1300, 'cancelled', IA),
      at(1400, 'cancelled', IA),
      at(1500, 'cancelled', IA),
      at(1600, 'cancelled', IA),
      at(1650, 'cancelled', IA),
    ]); // 5 < 6 → unchanged
    expect(mon.halfDay).toEqual({
      morning: { status: 'none' },
      afternoon: { status: 'cancelled', classId: IA },
    });
  });

  it('still splits a ≥6 cancelled day spanning both halves across two classes (orange | orange)', () => {
    // Both halves occupied → the empty-half collapse does not apply; the two-class
    // boundary is preserved exactly as before.
    const mon = mondayOf([
      at(800, 'cancelled', IA),
      at(900, 'cancelled', IA),
      at(1000, 'cancelled', IA),
      at(1300, 'cancelled', BM),
      at(1400, 'cancelled', BM),
      at(1500, 'cancelled', BM),
    ]);
    expect(mon.halfDay).toEqual({
      morning: { status: 'cancelled', classId: IA },
      afternoon: { status: 'cancelled', classId: BM },
    });
  });

  it('does NOT split when lessons carry no start time (cannot place them)', () => {
    const mon = mondayOf([makeLesson(20250818), makeLesson(20250818)]);
    expect(mon.type).toBe('normal');
    expect(mon.halfDay).toBeUndefined();
  });

  it('treats 12:00 as afternoon and 11:59 as morning (noon boundary)', () => {
    expect(mondayOf([at(1200, undefined, IA)]).halfDay).toEqual({
      morning: { status: 'none' },
      afternoon: { status: 'lessons', classId: IA },
    });
    expect(mondayOf([at(1159, undefined, IA)]).halfDay).toEqual({
      morning: { status: 'lessons', classId: IA },
      afternoon: { status: 'none' },
    });
  });
});

describe('classifyDays — reason picks the event of the half’s own class (overlapping events)', () => {
  // Real-world ABU case: viewing IA23 a (ABU) merges the IA class first — so its
  // "QV der Abschlussklassen" event leads the array — alongside the AB class, which
  // owns the actually-cancelled lessons and carries "QV Allgemeinbildender Unterricht".
  // The reason on a cancelled half must come from the event of THAT half's class,
  // not whichever event happens to be first in the merged array.
  const IA = 4632,
    AB = 4323;
  const at = (startTime: number, code: string | undefined, cls: number): UntisLesson => ({
    id: lessonIdCounter++,
    date: 20250818, // Monday
    startTime,
    code,
    sourceClassId: cls,
  });
  const allDayEvent = (lstext: string, cls: number): UntisLesson => ({
    id: lessonIdCounter++,
    date: 20250818,
    startTime: 0, // all-day blanket Unterrichtsausfall event
    code: 'irregular',
    su: [],
    lstext,
    sourceClassId: cls,
  });
  const mondayOf = (lessons: UntisLesson[]): CalendarDay =>
    classifyDays(SCHOOL_YEAR, [], lessons).find((d) => d.date === '2025-08-18')!;

  it('uses the AB event for AB’s cancelled morning even when the IA event is merged first', () => {
    const mon = mondayOf([
      allDayEvent('Unterrichtsausfall: QV der Abschlussklassen', IA), // IA event first…
      allDayEvent('Unterrichtsausfall: QV Allgemeinbildender Unterricht', AB),
      at(745, 'cancelled', AB),
      at(835, 'cancelled', AB),
      at(1120, 'cancelled', AB), // …but the cancelled lessons are AB's
    ]);
    expect(mon.type).toBe('unterrichtsausfall');
    expect(mon.halfDay).toEqual({
      morning: { status: 'cancelled', classId: AB, reason: 'QV Allgemeinbildender Unterricht' },
      afternoon: { status: 'none' },
    });
  });

  it('gives each cancelled half the reason of its own class’s event', () => {
    const mon = mondayOf([
      allDayEvent('Unterrichtsausfall: QV der Abschlussklassen', IA),
      allDayEvent('Unterrichtsausfall: QV Allgemeinbildender Unterricht', AB),
      at(800, 'cancelled', IA), // morning belongs to IA
      at(1300, 'cancelled', AB), // afternoon belongs to AB
    ]);
    expect(mon.halfDay).toEqual({
      morning: { status: 'cancelled', classId: IA, reason: 'QV der Abschlussklassen' },
      afternoon: { status: 'cancelled', classId: AB, reason: 'QV Allgemeinbildender Unterricht' },
    });
  });

  it('suppresses a borrowed event reason when no event owns the cancelled half’s class', () => {
    // Cancelled lessons are AB's, but the only event present is tagged to IA — it does
    // not explain AB's cancellation, so it stays borrowed and no reason is shown; the
    // real, teacher-specific reason surfaces per lesson in the day-timetable preview.
    const mon = mondayOf([
      allDayEvent('Unterrichtsausfall: QV der Abschlussklassen', IA),
      at(800, 'cancelled', AB),
      at(900, 'cancelled', AB),
    ]);
    expect(mon.halfDay?.morning).toEqual({
      status: 'cancelled',
      classId: AB,
    });
  });
});

describe('classifyDays — Veranstaltung beats overlapping Unterrichtsausfall event', () => {
  // Real-world IA+BM case: an IA class merged with its BM companion. During the BM
  // "Sprachaufenthalt" week the IA class has a "QV"-style "Unterrichtsausfall" blanket
  // event. The companion's Sprachaufenthalt (a real Veranstaltung) must win over the IA
  // cancellation, regardless of which class is the primary (merge order). Viewed with an
  // AB companion instead — no Sprachaufenthalt in the set — the IA Unterrichtsausfall stays.
  const IA = 4632,
    BM = 3855,
    AB = 4323;
  const event = (lstext: string, cls: number): UntisLesson => ({
    id: lessonIdCounter++,
    date: 20250818, // Monday
    startTime: 0, // all-day blanket event
    code: 'irregular',
    su: [],
    lstext,
    sourceClassId: cls,
  });
  const cancelled = (cls: number): UntisLesson => ({
    id: lessonIdCounter++,
    date: 20250818,
    startTime: 800,
    code: 'cancelled',
    sourceClassId: cls,
  });
  const ausfall = (cls: number) => event('Unterrichtsausfall: QV der Abschlussklassen', cls);
  const sprachaufenthalt = (cls: number) => event('Sprachaufenthalt', cls);
  const mondayOf = (lessons: UntisLesson[]): CalendarDay =>
    classifyDays(SCHOOL_YEAR, [], lessons).find((d) => d.date === '2025-08-18')!;

  it('renders veranstaltung when an IA Unterrichtsausfall event is merged BEFORE the BM Sprachaufenthalt', () => {
    const mon = mondayOf([ausfall(IA), sprachaufenthalt(BM), cancelled(IA)]);
    expect(mon.type).toBe('veranstaltung');
    expect(mon.eventName).toBe('Sprachaufenthalt');
  });

  it('renders veranstaltung regardless of merge order (BM Sprachaufenthalt first)', () => {
    const mon = mondayOf([sprachaufenthalt(BM), ausfall(IA), cancelled(IA)]);
    expect(mon.type).toBe('veranstaltung');
    expect(mon.eventName).toBe('Sprachaufenthalt');
  });

  it('keeps unterrichtsausfall when only an Unterrichtsausfall event is present (AB companion, no Sprachaufenthalt)', () => {
    const mon = mondayOf([ausfall(IA), cancelled(IA), cancelled(AB)]);
    expect(mon.type).toBe('unterrichtsausfall');
  });

  it('shows the Sprachaufenthalt even on a non-school day, where the IA Unterrichtsausfall alone would be grey', () => {
    // Tuesday is not a school day (the only real lesson — a Monday cancellation — makes
    // Monday the sole school day). A lone "Unterrichtsausfall" event there → no-lessons;
    // the overlapping Sprachaufenthalt promotes it to a visible veranstaltung instead.
    const days = classifyDays(
      SCHOOL_YEAR,
      [],
      [
        cancelled(IA), // Monday → establishes Monday as the only school day
        { ...ausfall(IA), date: 20250819 }, // Tuesday: IA blanket Unterrichtsausfall
        { ...sprachaufenthalt(BM), date: 20250819 }, // Tuesday: BM Sprachaufenthalt
      ],
    );
    const tue = days.find((d) => d.date === '2025-08-19');
    expect(tue?.type).toBe('veranstaltung');
    expect(tue?.eventName).toBe('Sprachaufenthalt');
  });
});

describe('halfStatusLabel', () => {
  it('maps each half status to its German label', () => {
    expect(halfStatusLabel('lessons')).toBe('Unterricht');
    expect(halfStatusLabel('cancelled')).toBe('fällt aus');
    expect(halfStatusLabel('none')).toBe('frei');
  });
});

// ─── buildDayTooltip ──────────────────────────────────────────────────────────

describe('buildDayTooltip', () => {
  const baseDay: CalendarDay = { date: '2025-08-18', type: 'normal' };

  it('returns holiday name when present (wins over everything)', () => {
    const day: CalendarDay = {
      ...baseDay,
      holidayName: 'Bundesfeiertag',
      lessonCount: 4,
      cancelledCount: 1,
    };
    expect(buildDayTooltip(day)).toBe('Bundesfeiertag');
  });

  it('uses singular for 1 lesson', () => {
    expect(buildDayTooltip({ ...baseDay, lessonCount: 1 })).toBe('1 Lektion');
  });

  it('uses plural for >1 lessons', () => {
    expect(buildDayTooltip({ ...baseDay, lessonCount: 5 })).toBe('5 Lektionen');
  });

  it('combines effective + cancelled lessons', () => {
    expect(buildDayTooltip({ ...baseDay, lessonCount: 5, cancelledCount: 2 })).toBe(
      '5 Lektionen, 2 abgesagt',
    );
  });

  it('shows only cancelled when no effective lessons (Schulausfall mit Lektionen)', () => {
    expect(
      buildDayTooltip({
        ...baseDay,
        type: 'unterrichtsausfall',
        lessonCount: 0,
        cancelledCount: 9,
      }),
    ).toBe('9 abgesagt');
  });

  it('shows the event name then cancelled count for a Veranstaltung day', () => {
    expect(
      buildDayTooltip({
        ...baseDay,
        type: 'unterrichtsausfall',
        eventName: 'Lehrpersonenweiterbildung Abteilung Wirtschaft',
        lessonCount: 0,
        cancelledCount: 9,
      }),
    ).toBe('Lehrpersonenweiterbildung Abteilung Wirtschaft, 9 abgesagt');
  });

  it('returns undefined when there is nothing to show (e.g. empty Schulausfall)', () => {
    expect(
      buildDayTooltip({ ...baseDay, type: 'unterrichtsausfall', lessonCount: 0 }),
    ).toBeUndefined();
  });

  it('returns undefined for a bare weekend/no-lessons day with no counts', () => {
    expect(buildDayTooltip({ date: '2025-08-23', type: 'weekend' })).toBeUndefined();
  });
});

describe('findSuspiciousLessons', () => {
  const withLs = (lsnumber: number | undefined): UntisLesson => ({
    id: lessonIdCounter++,
    date: 20250818,
    lsnumber,
  });

  it('flags lessons with an outlier lsnumber (>= threshold)', () => {
    const booking = withLs(3039194);
    const result = findSuspiciousLessons([withLs(385300), booking, withLs(144600)]);
    expect(result).toEqual([booking]);
  });

  it('treats the threshold as inclusive', () => {
    expect(findSuspiciousLessons([withLs(SUSPICIOUS_LSNUMBER_THRESHOLD)])).toHaveLength(1);
    expect(findSuspiciousLessons([withLs(SUSPICIOUS_LSNUMBER_THRESHOLD - 1)])).toHaveLength(0);
  });

  it('ignores lessons without an lsnumber', () => {
    expect(findSuspiciousLessons([withLs(undefined)])).toHaveLength(0);
  });
});

describe('removeNonSchoolDayBookings', () => {
  // Regular lessons only on Mondays across 4 weeks → school day = {Mon}.
  const mondays = [20250818, 20250825, 20250901, 20250908].map((d) => makeLesson(d));
  const bookingOnMonday = makeLesson(20250818); // 2025-08-18 is a Monday → school day
  const bookingOnWednesday = makeLesson(20250820); // 2025-08-20 is a Wednesday → no school

  it('drops a confirmed booking on a non-school weekday', () => {
    const lessons = [...mondays, bookingOnWednesday];
    const result = removeNonSchoolDayBookings(lessons, new Set([bookingOnWednesday.id]));
    expect(result).not.toContain(bookingOnWednesday);
    expect(result).toHaveLength(mondays.length);
  });

  it('keeps a confirmed booking that falls on an actual school weekday', () => {
    const lessons = [...mondays, bookingOnMonday];
    const result = removeNonSchoolDayBookings(lessons, new Set([bookingOnMonday.id]));
    expect(result).toContain(bookingOnMonday);
  });

  it('excludes bookings from the school-day calculation itself', () => {
    // The ONLY Wednesday "lesson" is a booking → Wednesday must not become a school
    // day, so the booking is dropped rather than legitimising its own weekday.
    const lessons = [...mondays, bookingOnWednesday];
    const result = removeNonSchoolDayBookings(lessons, new Set([bookingOnWednesday.id]));
    expect(result).not.toContain(bookingOnWednesday);
  });

  it('returns the input untouched when there are no bookings', () => {
    const lessons = [...mondays];
    expect(removeNonSchoolDayBookings(lessons, new Set())).toBe(lessons);
  });

  it('leaves non-booking lessons alone even on non-school weekdays', () => {
    const wednesdayLesson = makeLesson(20250820);
    const lessons = [...mondays, wednesdayLesson];
    const result = removeNonSchoolDayBookings(lessons, new Set([bookingOnWednesday.id]));
    expect(result).toContain(wednesdayLesson);
  });
});

// ─── teacher reason enrichment ───────────────────────────────────────────────
// A cancelled lesson carries no reason; the real cause lives on the teacher's own
// all-day "Unterrichtsausfall: …" event (mirrors the 7.6.2027 ME25a case where the
// companion AB event "QV Allgemeinbildender Unterricht" was borrowed onto a
// Berufskunde cancellation whose true reason is "QV BM & KV").

describe('extractAusfallReason', () => {
  it('returns the stripped reason for an Unterrichtsausfall teacher event', () => {
    expect(
      extractAusfallReason({
        id: 1,
        date: 20250915,
        code: 'irregular',
        su: [],
        lstext: 'Unterrichtsausfall: QV BM & KV',
      }),
    ).toBe('QV BM & KV');
  });

  it('returns undefined for a normal cancelled lesson (has a subject)', () => {
    expect(
      extractAusfallReason({ id: 1, date: 20250915, code: 'cancelled', su: [{ name: '279' }] }),
    ).toBeUndefined();
  });

  it('returns undefined for a Veranstaltung event without the Unterrichtsausfall prefix', () => {
    expect(
      extractAusfallReason({
        id: 1,
        date: 20250915,
        code: 'irregular',
        su: [],
        lstext: 'Sprachaufenthalt',
      }),
    ).toBeUndefined();
  });
});

describe('classifyDays — Unterrichtsausfall day reason (own vs borrowed event)', () => {
  const LONG_SCHOOL_YEAR: UntisSchoolYear = {
    id: 1,
    name: '2025/2026',
    startDate: new Date(2025, 7, 18), // Mon Aug 18
    endDate: new Date(2025, 8, 19), // Fri Sep 19 (5 weeks)
  };
  const PRIMARY = 100; // selected class
  const COMPANION = 200;
  // Weeks 1–4 Mondays establish Monday as the class's school day.
  const priorMondays = [20250818, 20250825, 20250901, 20250908].map((d) => makeLesson(d));
  // Week 5 Monday (20250915): a lesson of the primary class cancelled.
  const cancelledPrimary = (): UntisLesson => ({
    id: lessonIdCounter++,
    date: 20250915,
    code: 'cancelled',
    startTime: 900,
    te: [{ name: 'ÖzBe' }],
    sourceClassId: PRIMARY,
  });
  // A blanket Unterrichtsausfall event, tagged with whichever class it was merged under.
  const ausfallEvent = (sourceClassId: number, text: string): UntisLesson => ({
    id: lessonIdCounter++,
    date: 20250915,
    code: 'irregular',
    su: [],
    startTime: 745,
    lstext: `Unterrichtsausfall: ${text}`,
    sourceClassId,
  });

  it('suppresses a companion-only (borrowed) event reason — plain orange', () => {
    const lessons = [
      ...priorMondays,
      cancelledPrimary(),
      ausfallEvent(COMPANION, 'QV Allgemeinbildender Unterricht'),
    ];
    const mon = classifyDays(LONG_SCHOOL_YEAR, [], lessons, PRIMARY).find(
      (d) => d.date === '2025-09-15',
    );
    expect(mon?.type).toBe('unterrichtsausfall');
    // Borrowed reason doesn't explain this class's cancellation → no reason on the cell.
    expect(mon?.eventName).toBeUndefined();
    expect(mon?.halfDay?.morning.reason).toBeUndefined();
  });

  it('shows the reason of an event on the selected class’s own plan (e.g. Weiterbildungstag)', () => {
    const lessons = [
      ...priorMondays,
      cancelledPrimary(),
      ausfallEvent(PRIMARY, 'Weiterbildungstag Abt. Wirtschaft'),
    ];
    const mon = classifyDays(LONG_SCHOOL_YEAR, [], lessons, PRIMARY).find(
      (d) => d.date === '2025-09-15',
    );
    expect(mon?.eventName).toBe('Weiterbildungstag Abt. Wirtschaft');
  });

  it('counts every Unterrichtsausfall event when no primary class is given', () => {
    const lessons = [
      ...priorMondays,
      cancelledPrimary(),
      ausfallEvent(COMPANION, 'QV Allgemeinbildender Unterricht'),
    ];
    const mon = classifyDays(LONG_SCHOOL_YEAR, [], lessons).find((d) => d.date === '2025-09-15');
    expect(mon?.eventName).toBe('QV Allgemeinbildender Unterricht');
  });

  // The half-day mirror of the "own vs borrowed" rule: an ABU-only day whose only
  // (cancelled) lessons belong to the companion AB class. The AB event OWNS those
  // lessons, so its reason is shown on the companion's half even though the selected
  // class is ME (mirrors the 9./16.6.2027 ME23a case).
  const cancelledCompanion = (startTime: number): UntisLesson => ({
    id: lessonIdCounter++,
    date: 20250915,
    code: 'cancelled',
    startTime,
    te: [{ name: 'ReNi' }],
    sourceClassId: COMPANION,
  });

  it('shows the companion event reason on a companion-owned cancelled half', () => {
    const lessons = [
      ...priorMondays,
      cancelledCompanion(800), // morning only, all the companion's
      ausfallEvent(COMPANION, 'QV Allgemeinbildender Unterricht'),
    ];
    const mon = classifyDays(LONG_SCHOOL_YEAR, [], lessons, PRIMARY).find(
      (d) => d.date === '2025-09-15',
    );
    expect(mon?.type).toBe('unterrichtsausfall');
    expect(mon?.halfDay?.morning).toMatchObject({
      status: 'cancelled',
      classId: COMPANION,
      reason: 'QV Allgemeinbildender Unterricht',
    });
    expect(mon?.halfDay?.afternoon.status).toBe('none');
  });

  it('labels a companion-owned all-cancelled day (single cell) with the companion event reason', () => {
    const lessons = [
      ...priorMondays,
      cancelledCompanion(800), // morning + afternoon → collapses to one orange cell
      cancelledCompanion(1300),
      ausfallEvent(COMPANION, 'QV Allgemeinbildender Unterricht'),
    ];
    const mon = classifyDays(LONG_SCHOOL_YEAR, [], lessons, PRIMARY).find(
      (d) => d.date === '2025-09-15',
    );
    expect(mon?.halfDay).toBeUndefined();
    expect(mon?.eventName).toBe('QV Allgemeinbildender Unterricht');
  });
});
