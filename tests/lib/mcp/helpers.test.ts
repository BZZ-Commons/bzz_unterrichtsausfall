import { describe, it, expect } from 'vitest';
import {
  resolveClass,
  compactDays,
  filterUpcoming,
  todayInZurich,
  weekdayOf,
} from '@/src/lib/mcp/helpers';
import type { CalendarDay, DayType, UntisClass } from '@/src/types';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const makeClass = (id: number, name: string, fetchIds?: number[]): UntisClass => ({
  id,
  name,
  longName: '',
  active: true,
  ...(fetchIds ? { fetchIds } : {}),
});

// Year 24 has NO 'IA24 c' → IA24 a/b need the BM/ABU variant.
// Year 23 HAS 'IA23 c' → IA23 a resolves directly via its fetchIds.
const classes: UntisClass[] = [
  makeClass(1, 'IA24 a'),
  makeClass(2, 'IA24 b'),
  makeClass(3, 'BM24 a'),
  makeClass(4, 'BM24 b'),
  makeClass(5, 'AB24 c'),
  makeClass(6, 'ME24 a', [6, 7]),
  makeClass(7, 'AB24 a'),
  makeClass(10, 'IA23 a', [10, 30]),
  makeClass(11, 'IA23 c'),
  makeClass(12, 'BM23 a'),
];

const day = (date: string, type: DayType, extra: Partial<CalendarDay> = {}): CalendarDay => ({
  date,
  type,
  ...extra,
});

// ─── resolveClass ─────────────────────────────────────────────────────────────

describe('resolveClass', () => {
  it('resolves by classId, using the pre-resolved fetchIds when present', () => {
    const result = resolveClass(classes, { classId: 6 });
    expect(result).toEqual({ kind: 'resolved', cls: classes[5], fetchIds: [6, 7] });
  });

  it('falls back to [cls.id] when the class has no fetchIds', () => {
    const result = resolveClass(classes, { classId: 4 });
    expect(result).toEqual({ kind: 'resolved', cls: classes[3], fetchIds: [4] });
  });

  it('returns not-found with empty suggestions for an unknown classId', () => {
    expect(resolveClass(classes, { classId: 999 })).toEqual({
      kind: 'not-found',
      query: '999',
      suggestions: [],
    });
  });

  it('resolves by name, whitespace- and case-insensitive', () => {
    expect(resolveClass(classes, { className: 'bm24a' })).toMatchObject({
      kind: 'resolved',
      cls: { id: 3, name: 'BM24 a' },
    });
    expect(resolveClass(classes, { className: 'BM24 A' })).toMatchObject({
      kind: 'resolved',
      cls: { id: 3, name: 'BM24 a' },
    });
    // IA lookup is equally lenient (resolution kind aside).
    expect(resolveClass(classes, { className: 'ia24a' })).toMatchObject({
      cls: { id: 1, name: 'IA24 a' },
    });
    expect(resolveClass(classes, { className: 'IA24 A' })).toMatchObject({
      cls: { id: 1, name: 'IA24 a' },
    });
  });

  it('returns not-found with prefix suggestions first for an unknown name', () => {
    const result = resolveClass(classes, { className: 'IA24' });
    expect(result.kind).toBe('not-found');
    if (result.kind !== 'not-found') return;
    expect(result.query).toBe('IA24');
    expect(result.suggestions).toEqual(['IA24 a', 'IA24 b']);
  });

  it('includes contains-matches in suggestions, capped at 5', () => {
    const result = resolveClass(classes, { className: '24 a' });
    expect(result.kind).toBe('not-found');
    if (result.kind !== 'not-found') return;
    expect(result.suggestions.length).toBeLessThanOrEqual(5);
    expect(result.suggestions).toContain('IA24 a');
    expect(result.suggestions).toContain('BM24 a');
  });

  it('returns not-found with no suggestions for a completely unknown name', () => {
    expect(resolveClass(classes, { className: 'XY99 z' })).toEqual({
      kind: 'not-found',
      query: 'XY99 z',
      suggestions: [],
    });
  });

  it("returns not-found with query '' when neither className nor classId is given", () => {
    expect(resolveClass(classes, {})).toEqual({ kind: 'not-found', query: '', suggestions: [] });
  });

  it('IA a in a year WITHOUT IA c needs a variant; options and German hint name the classes', () => {
    const result = resolveClass(classes, { className: 'IA24 a' });
    expect(result.kind).toBe('needs-variant');
    if (result.kind !== 'needs-variant') return;
    expect(result.cls.name).toBe('IA24 a');
    expect(result.options.bm).toMatchObject({ id: 3, name: 'BM24 a' });
    expect(result.options.abu).toMatchObject({ id: 5, name: 'AB24 c' });
    expect(result.hint).toContain('IA24 a');
    expect(result.hint).toContain('"bm"');
    expect(result.hint).toContain('"abu"');
    expect(result.hint).toContain('BM24 a');
    expect(result.hint).toContain('AB24 c');
  });

  it("variant 'bm' resolves to [ia.id, bm.id]", () => {
    const result = resolveClass(classes, { className: 'IA24 a', variant: 'bm' });
    expect(result).toMatchObject({ kind: 'resolved', fetchIds: [1, 3] });
  });

  it("variant 'abu' resolves to [ia.id, abu.id]", () => {
    const result = resolveClass(classes, { className: 'IA24 a', variant: 'abu' });
    expect(result).toMatchObject({ kind: 'resolved', fetchIds: [1, 5] });
  });

  it('a requested but missing variant yields needs-variant naming the available one', () => {
    // IA25 a has a BM25 a but no AB25 c → variant 'abu' is unavailable.
    const sparse = [makeClass(20, 'IA25 a'), makeClass(21, 'BM25 a')];
    const result = resolveClass(sparse, { className: 'IA25 a', variant: 'abu' });
    expect(result.kind).toBe('needs-variant');
    if (result.kind !== 'needs-variant') return;
    expect(result.options).toEqual({ bm: sparse[1], abu: null });
    expect(result.hint).toContain('"abu"');
    expect(result.hint).toContain('BM25 a');
  });

  it('IA a in a year WITH IA c resolves directly via its fetchIds, no dialog', () => {
    const result = resolveClass(classes, { className: 'IA23 a' });
    expect(result).toEqual({
      kind: 'resolved',
      cls: classes.find((c) => c.name === 'IA23 a'),
      fetchIds: [10, 30],
    });
  });
});

// ─── compactDays ──────────────────────────────────────────────────────────────

describe('compactDays', () => {
  it('drops weekend/no-lessons/out-of-year/plain-normal days from `days` but counts them in stats', () => {
    const result = compactDays([
      day('2025-08-16', 'weekend'),
      day('2025-08-18', 'normal', { lessonCount: 8, cancelledCount: 0 }),
      day('2025-08-19', 'no-lessons'),
      day('2025-08-20', 'out-of-year'),
      day('2025-08-21', 'unterrichtsausfall', { cancelledCount: 9 }),
    ]);

    expect(result.days.map((d) => d.date)).toEqual(['2025-08-21']);
    expect(result.stats).toEqual({
      weekend: 1,
      normal: 1,
      'no-lessons': 1,
      'out-of-year': 1,
      unterrichtsausfall: 1,
    });
  });

  it('keeps unterrichtsausfall, veranstaltung and normal-with-cancellations days', () => {
    const result = compactDays([
      day('2025-09-01', 'unterrichtsausfall', { cancelledCount: 4 }),
      day('2025-09-02', 'veranstaltung', { eventName: 'Sporttag' }),
      day('2025-09-03', 'normal', { lessonCount: 6, cancelledCount: 2 }),
      day('2025-09-04', 'normal', { lessonCount: 8, cancelledCount: 0 }),
    ]);

    expect(result.days.map((d) => d.date)).toEqual(['2025-09-01', '2025-09-02', '2025-09-03']);
    expect(result.days[1]).toMatchObject({ eventName: 'Sporttag', reason: 'Sporttag' });
  });

  it('omits undefined fields entirely (small JSON output)', () => {
    const result = compactDays([day('2025-09-01', 'unterrichtsausfall', { cancelledCount: 4 })]);
    expect(result.days[0]).toStrictEqual({
      date: '2025-09-01',
      weekday: 'Montag',
      type: 'unterrichtsausfall',
      cancelledCount: 4,
    });
  });

  it('collapses consecutive ferien days into one named range', () => {
    const result = compactDays([
      day('2025-10-06', 'ferien', { holidayName: 'Herbstferien' }),
      day('2025-10-07', 'ferien', { holidayName: 'Herbstferien' }),
      day('2025-10-08', 'ferien', { holidayName: 'Herbstferien' }),
    ]);
    expect(result.ferien).toEqual([{ from: '2025-10-06', to: '2025-10-08', name: 'Herbstferien' }]);
  });

  it('separate ferien blocks and holidayName changes start new ranges', () => {
    const result = compactDays([
      day('2025-10-06', 'ferien', { holidayName: 'Herbstferien' }),
      day('2025-10-07', 'ferien', { holidayName: 'Herbstferien' }),
      day('2025-10-08', 'normal', { lessonCount: 6 }),
      day('2025-12-22', 'ferien', { holidayName: 'Weihnachtsferien' }),
      // adjacent ferien day with a different name → its own range
      day('2025-12-23', 'ferien', { holidayName: 'Neujahr' }),
    ]);
    expect(result.ferien).toEqual([
      { from: '2025-10-06', to: '2025-10-07', name: 'Herbstferien' },
      { from: '2025-12-22', to: '2025-12-22', name: 'Weihnachtsferien' },
      { from: '2025-12-23', to: '2025-12-23', name: 'Neujahr' },
    ]);
  });

  it('from/to filters days and overlapping ferien ranges, but stats stay unfiltered', () => {
    const input = [
      day('2025-09-01', 'unterrichtsausfall', { cancelledCount: 4 }),
      day('2025-10-06', 'ferien', { holidayName: 'Herbstferien' }),
      day('2025-10-07', 'ferien', { holidayName: 'Herbstferien' }),
      day('2025-11-10', 'unterrichtsausfall', { cancelledCount: 2 }),
      day('2025-12-22', 'ferien', { holidayName: 'Weihnachtsferien' }),
    ];

    const result = compactDays(input, { from: '2025-10-01', to: '2025-11-30' });

    expect(result.days.map((d) => d.date)).toEqual(['2025-11-10']);
    // Herbstferien overlaps the window, Weihnachtsferien does not.
    expect(result.ferien).toEqual([{ from: '2025-10-06', to: '2025-10-07', name: 'Herbstferien' }]);
    expect(result.stats).toEqual({ unterrichtsausfall: 2, ferien: 3 });
  });

  it('builds `reason` from deduped halfDay reasons joined with " / "', () => {
    const result = compactDays([
      day('2025-11-05', 'unterrichtsausfall', {
        cancelledCount: 8,
        halfDay: {
          morning: { status: 'cancelled', reason: 'QV BM & KV' },
          afternoon: { status: 'cancelled', reason: 'QV BM & KV' },
        },
      }),
      day('2025-11-06', 'unterrichtsausfall', {
        cancelledCount: 8,
        halfDay: {
          morning: { status: 'cancelled', reason: 'Weiterbildung' },
          afternoon: { status: 'cancelled', reason: 'Konvent' },
        },
      }),
    ]);

    expect(result.days[0].reason).toBe('QV BM & KV'); // deduped
    expect(result.days[1].reason).toBe('Weiterbildung / Konvent');
  });

  it('prefers eventName over halfDay reasons', () => {
    const result = compactDays([
      day('2025-11-07', 'unterrichtsausfall', {
        eventName: 'Lehrpersonenweiterbildung',
        halfDay: {
          morning: { status: 'cancelled', reason: 'anders' },
          afternoon: { status: 'none' },
        },
      }),
    ]);
    expect(result.days[0].reason).toBe('Lehrpersonenweiterbildung');
  });
});

// ─── filterUpcoming ───────────────────────────────────────────────────────────

describe('filterUpcoming', () => {
  const days: CalendarDay[] = [
    day('2026-06-10', 'unterrichtsausfall', { cancelledCount: 4 }), // past
    day('2026-06-12', 'unterrichtsausfall', { cancelledCount: 4 }), // today
    day('2026-06-15', 'unterrichtsausfall', { cancelledCount: 9, ended: true }),
    day('2026-06-16', 'veranstaltung', { eventName: 'Sporttag' }),
    day('2026-06-17', 'normal', { lessonCount: 8, cancelledCount: 1 }),
  ];

  it('splits cancellations and veranstaltungen; excludes past and ended days by default', () => {
    const result = filterUpcoming(days, '2026-06-12');
    expect(result.cancellations.map((d) => d.date)).toEqual(['2026-06-12']);
    expect(result.veranstaltungen.map((d) => d.date)).toEqual(['2026-06-16']);
    expect(result.veranstaltungen[0].reason).toBe('Sporttag');
  });

  it('includes ended cancellation days with includeEnded', () => {
    const result = filterUpcoming(days, '2026-06-12', { includeEnded: true });
    expect(result.cancellations.map((d) => d.date)).toEqual(['2026-06-12', '2026-06-15']);
  });

  it('keeps veranstaltungen on weekdays without regular lessons (e.g. Sprachaufenthalt)', () => {
    // A Sprachaufenthalt week may cover weekdays the class never meets — those
    // days are still 'veranstaltung' and must show up, unlike cancellations
    // which by definition only exist on school days.
    const trip = [
      day('2027-02-08', 'veranstaltung', { eventName: 'Sprachaufenthalt Französisch' }),
      day('2027-02-09', 'veranstaltung', { eventName: 'Sprachaufenthalt Französisch' }),
    ];
    const result = filterUpcoming(trip, '2026-06-12');
    expect(result.cancellations).toEqual([]);
    expect(result.veranstaltungen.map((d) => d.date)).toEqual(['2027-02-08', '2027-02-09']);
  });
});

// ─── todayInZurich ────────────────────────────────────────────────────────────

describe('todayInZurich', () => {
  it('returns YYYY-MM-DD for a fixed date', () => {
    const result = todayInZurich(new Date('2026-01-15T12:00:00Z'));
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result).toBe('2026-01-15');
  });

  it('uses the Zurich calendar day, not UTC (CEST is UTC+2)', () => {
    expect(todayInZurich(new Date('2026-06-11T23:30:00Z'))).toBe('2026-06-12');
  });
});

describe('weekdayOf', () => {
  it('returns German weekday names for ISO dates', () => {
    // The dates a consuming LLM once mislabeled as Sundays — all Mondays.
    expect(weekdayOf('2027-05-31')).toBe('Montag');
    expect(weekdayOf('2027-06-07')).toBe('Montag');
    expect(weekdayOf('2027-06-14')).toBe('Montag');
    expect(weekdayOf('2027-07-06')).toBe('Dienstag');
    expect(weekdayOf('2027-06-06')).toBe('Sonntag');
  });
});
