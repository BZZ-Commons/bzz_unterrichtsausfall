import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import SchoolYearCalendar from '@/components/SchoolYearCalendar';
import type { CalendarDay } from '@/src/types';

// ─── Fixture helpers ──────────────────────────────────────────────────────────

/** ISO week 37-2025 starts Monday 2025-09-08. Use that as a stable anchor. */
const mkDay = (date: string, overrides: Partial<CalendarDay> = {}): CalendarDay => ({
  date,
  type: 'normal',
  lessonCount: 5,
  ...overrides,
});

/** A minimal school-year's worth of calendar days for September 2025.
 *  Mon 2025-09-08 … Fri 2025-09-12 = ISO week 37.
 *  Mon 2025-09-15 … Fri 2025-09-19 = ISO week 38.
 */
const CLASS_A_ID = 101;
const CLASS_B_ID = 202;

const classNamesById = new Map<number, string>([
  [CLASS_A_ID, 'IA25a'],
  [CLASS_B_ID, 'BM25a'],
]);

// Proper dated fixture for Sept 2025 week 37 (Mon 08 → Sun 14)
const WEEK37_MON = '2025-09-08';
const WEEK37_DAYS: CalendarDay[] = [
  mkDay('2025-09-08', { lessonCount: 5, linkClassId: CLASS_A_ID }),
  mkDay('2025-09-09', { lessonCount: 4, linkClassId: CLASS_A_ID }),
  mkDay('2025-09-10', { lessonCount: 3, linkClassId: CLASS_A_ID }),
  mkDay('2025-09-11', { lessonCount: 6, linkClassId: CLASS_A_ID }),
  mkDay('2025-09-12', { lessonCount: 5, linkClassId: CLASS_A_ID }),
  mkDay('2025-09-13', { type: 'weekend' }),
  mkDay('2025-09-14', { type: 'weekend' }),
];

const WEEK38_MON = '2025-09-15';
const WEEK38_DAYS: CalendarDay[] = [
  mkDay('2025-09-15', { lessonCount: 5, linkClassId: CLASS_A_ID }),
  mkDay('2025-09-16', { lessonCount: 4, linkClassId: CLASS_A_ID }),
  mkDay('2025-09-17', { lessonCount: 3, linkClassId: CLASS_A_ID }),
  mkDay('2025-09-18', { lessonCount: 6, linkClassId: CLASS_A_ID }),
  mkDay('2025-09-19', { lessonCount: 5, linkClassId: CLASS_A_ID }),
  mkDay('2025-09-20', { type: 'weekend' }),
  mkDay('2025-09-21', { type: 'weekend' }),
];

const ALL_DAYS = [...WEEK37_DAYS, ...WEEK38_DAYS];

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('SchoolYearCalendar — structure and headers', () => {
  it('renders the month label, weekday header (Mo–So), and ISO week number links', () => {
    render(
      <SchoolYearCalendar
        days={ALL_DAYS}
        schoolYearName="2025/26"
        classId={CLASS_A_ID}
        classNamesById={classNamesById}
      />,
    );

    // Month label (German via date-fns/de locale)
    expect(screen.getByText('September 2025')).toBeInTheDocument();

    // Weekday header
    for (const label of ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }

    // ISO week links — week 37 and week 38 for our two weeks
    const weekLinks = screen
      .getAllByRole('link')
      .filter((a) => a.textContent === '37' || a.textContent === '38');
    expect(weekLinks.length).toBeGreaterThanOrEqual(2);

    // Each week link href contains the classId and the Monday date
    const week37Link = weekLinks.find((a) => a.textContent === '37');
    expect(week37Link).toHaveAttribute('href', expect.stringContaining(String(CLASS_A_ID)));
    expect(week37Link).toHaveAttribute('href', expect.stringContaining(WEEK37_MON));

    const week38Link = weekLinks.find((a) => a.textContent === '38');
    expect(week38Link).toHaveAttribute('href', expect.stringContaining(String(CLASS_A_ID)));
    expect(week38Link).toHaveAttribute('href', expect.stringContaining(WEEK38_MON));
  });

  it('renders the school year footer text', () => {
    render(<SchoolYearCalendar days={ALL_DAYS} schoolYearName="2025/26" classId={CLASS_A_ID} />);
    expect(screen.getByText('Schuljahr 2025/26')).toBeInTheDocument();
  });

  it('shows empty-state message when no days provided', () => {
    render(<SchoolYearCalendar days={[]} schoolYearName="2025/26" classId={CLASS_A_ID} />);
    expect(screen.getByText('Keine Kalenderdaten verfügbar.')).toBeInTheDocument();
  });
});

describe('SchoolYearCalendar — normal day cell', () => {
  it('renders a link with href pointing to linkClassId and title with class name + tooltip', () => {
    const days: CalendarDay[] = [
      mkDay('2025-09-08', {
        type: 'normal',
        lessonCount: 5,
        cancelledCount: 1,
        linkClassId: CLASS_A_ID,
      }),
      // Fill the rest of the week to avoid buildMonthGroups issues
      ...WEEK37_DAYS.slice(1),
    ];

    render(
      <SchoolYearCalendar
        days={days}
        schoolYearName="2025/26"
        classId={CLASS_A_ID}
        classNamesById={classNamesById}
      />,
    );

    const links = screen.getAllByRole('link');
    // The day-cell link for 2025-09-08 should carry the class name and lesson info
    const dayLink = links.find(
      (a) =>
        a.getAttribute('href')?.includes(String(CLASS_A_ID)) &&
        a.getAttribute('title')?.includes('IA25a'),
    );
    expect(dayLink).toBeDefined();
    const title = dayLink!.getAttribute('title') ?? '';
    expect(title).toContain('IA25a');
    // buildDayTooltip: "5 Lektionen, 1 abgesagt"
    expect(title).toContain('Lektionen');
    expect(title).toContain('abgesagt');

    // href uses linkClassId (CLASS_A_ID)
    expect(dayLink).toHaveAttribute('href', expect.stringContaining(String(CLASS_A_ID)));
  });

  it('falls back to classId when linkClassId is absent', () => {
    const FALLBACK_ID = 999;
    const days: CalendarDay[] = [
      mkDay('2025-09-08', { type: 'normal', lessonCount: 3 }), // no linkClassId
      ...WEEK37_DAYS.slice(1),
    ];

    render(
      <SchoolYearCalendar
        days={days}
        schoolYearName="2025/26"
        classId={FALLBACK_ID}
        classNamesById={classNamesById}
      />,
    );

    // The day link should point to the fallback classId
    const links = screen.getAllByRole('link');
    const dayLink = links.find(
      (a) =>
        a.getAttribute('href')?.includes(String(FALLBACK_ID)) && a.textContent?.trim() === '08',
    );
    expect(dayLink).toBeDefined();
    expect(dayLink).toHaveAttribute('href', expect.stringContaining(String(FALLBACK_ID)));
  });
});

describe('SchoolYearCalendar — split day (halfDay)', () => {
  it('renders two links for a split day, each pointing to its own classId', () => {
    const days: CalendarDay[] = [
      {
        date: '2025-09-08',
        type: 'normal',
        halfDay: {
          morning: { status: 'lessons', classId: CLASS_A_ID },
          afternoon: { status: 'lessons', classId: CLASS_B_ID },
        },
      },
      ...WEEK37_DAYS.slice(1),
    ];

    render(
      <SchoolYearCalendar
        days={days}
        schoolYearName="2025/26"
        classId={CLASS_A_ID}
        classNamesById={classNamesById}
      />,
    );

    const links = screen.getAllByRole('link');
    // Find the two half-day links (both within the split cell for that day)
    const halfLinks = links.filter(
      (a) =>
        a.getAttribute('href')?.includes(String(CLASS_A_ID)) ||
        a.getAttribute('href')?.includes(String(CLASS_B_ID)),
    );
    // At minimum two links pointing at A and B
    const aLink = halfLinks.find((a) => a.getAttribute('title')?.includes('Vormittag'));
    const bLink = halfLinks.find((a) => a.getAttribute('title')?.includes('Nachmittag'));

    expect(aLink).toBeDefined();
    expect(bLink).toBeDefined();

    // Morning → CLASS_A_ID
    expect(aLink).toHaveAttribute('href', expect.stringContaining(String(CLASS_A_ID)));
    // Afternoon → CLASS_B_ID
    expect(bLink).toHaveAttribute('href', expect.stringContaining(String(CLASS_B_ID)));

    // tooltips contain "Unterricht"
    expect(aLink!.getAttribute('title')).toContain('Unterricht');
    expect(bLink!.getAttribute('title')).toContain('Unterricht');
  });

  it('split day with "none" afternoon: afternoon link has no title, morning keeps its tooltip', () => {
    const days: CalendarDay[] = [
      {
        date: '2025-09-08',
        type: 'normal',
        halfDay: {
          morning: { status: 'lessons', classId: CLASS_A_ID },
          afternoon: { status: 'none' },
        },
      },
      ...WEEK37_DAYS.slice(1),
    ];

    render(
      <SchoolYearCalendar
        days={days}
        schoolYearName="2025/26"
        classId={CLASS_A_ID}
        classNamesById={classNamesById}
      />,
    );

    // Morning link has a Vormittag tooltip
    const links = screen.getAllByRole('link');
    const morningLink = links.find((a) => a.getAttribute('title')?.includes('Vormittag'));
    expect(morningLink).toBeDefined();
    expect(morningLink!.getAttribute('title')).toContain('Unterricht');

    // Afternoon link (none status) has no title attribute.
    // none half: background should be HALF_DAY_COLORS.none = '#f8fafc'
    // Find all links that are flex-1 halves (they don't have text content)
    const halfLinks = links.filter((a) => a.getAttribute('class')?.includes('flex-1'));
    expect(halfLinks).toHaveLength(2);

    // One half has a title, the other does not
    const titledHalf = halfLinks.find((a) => !!a.getAttribute('title'));
    const untitledHalf = halfLinks.find((a) => !a.getAttribute('title'));
    expect(titledHalf).toBeDefined();
    expect(untitledHalf).toBeDefined();

    // The untitled half (none) should have the slate-50 background
    expect(untitledHalf).toHaveStyle({ background: '#f8fafc' });
    // The titled half (lessons) should have emerald-100 background
    expect(titledHalf).toHaveStyle({ background: '#d1fae5' });
  });

  it('cancelled half with reason: reason text renders on the cell, tooltip contains "fällt aus" and the reason', () => {
    const reason = 'QV BM & KV';
    const days: CalendarDay[] = [
      {
        date: '2025-09-08',
        type: 'unterrichtsausfall',
        halfDay: {
          morning: { status: 'lessons', classId: CLASS_A_ID },
          afternoon: { status: 'cancelled', classId: CLASS_B_ID, reason },
        },
      },
      ...WEEK37_DAYS.slice(1),
    ];

    render(
      <SchoolYearCalendar
        days={days}
        schoolYearName="2025/26"
        classId={CLASS_A_ID}
        classNamesById={classNamesById}
      />,
    );

    // The reason text should appear somewhere in the cell (onlyOneCancelled path)
    expect(screen.getByText(reason)).toBeInTheDocument();

    // Afternoon link tooltip contains "fällt aus" and the reason
    const links = screen.getAllByRole('link');
    const cancelledLink = links.find((a) => a.getAttribute('title')?.includes('fällt aus'));
    expect(cancelledLink).toBeDefined();
    expect(cancelledLink!.getAttribute('title')).toContain('fällt aus');
    expect(cancelledLink!.getAttribute('title')).toContain(reason);
  });

  it('both halves cancelled with different reasons: combined reason "A / B" is rendered', () => {
    const morningReason = 'Lehrpersonentag';
    const afternoonReason = 'QV BM';
    const days: CalendarDay[] = [
      {
        date: '2025-09-08',
        type: 'unterrichtsausfall',
        halfDay: {
          morning: { status: 'cancelled', classId: CLASS_A_ID, reason: morningReason },
          afternoon: { status: 'cancelled', classId: CLASS_B_ID, reason: afternoonReason },
        },
      },
      ...WEEK37_DAYS.slice(1),
    ];

    render(
      <SchoolYearCalendar
        days={days}
        schoolYearName="2025/26"
        classId={CLASS_A_ID}
        classNamesById={classNamesById}
      />,
    );

    // Combined reason text "Lehrpersonentag / QV BM"
    expect(screen.getByText(`${morningReason} / ${afternoonReason}`)).toBeInTheDocument();
  });

  it('both halves cancelled with same reason: just the single reason is rendered', () => {
    const sharedReason = 'Schulausflug';
    const days: CalendarDay[] = [
      {
        date: '2025-09-08',
        type: 'unterrichtsausfall',
        halfDay: {
          morning: { status: 'cancelled', classId: CLASS_A_ID, reason: sharedReason },
          afternoon: { status: 'cancelled', classId: CLASS_B_ID, reason: sharedReason },
        },
      },
      ...WEEK37_DAYS.slice(1),
    ];

    render(
      <SchoolYearCalendar
        days={days}
        schoolYearName="2025/26"
        classId={CLASS_A_ID}
        classNamesById={classNamesById}
      />,
    );

    // Only the single reason, not "Schulausflug / Schulausflug"
    const occurrences = screen.getAllByText(sharedReason);
    // The reason appears once (in the combined-reason overlay span)
    expect(occurrences.length).toBeGreaterThanOrEqual(1);
    // Must NOT render the "A / A" pattern
    expect(screen.queryByText(`${sharedReason} / ${sharedReason}`)).toBeNull();
  });
});

describe('SchoolYearCalendar — detailsMode partial cancellations', () => {
  it('applies bg-pink-200 to a normal day with cancelledCount > 0 only in detailsMode', () => {
    const partialDay: CalendarDay = mkDay('2025-09-08', {
      type: 'normal',
      lessonCount: 4,
      cancelledCount: 2,
      linkClassId: CLASS_A_ID,
    });
    const days = [partialDay, ...WEEK37_DAYS.slice(1)];

    const { rerender } = render(
      <SchoolYearCalendar
        days={days}
        schoolYearName="2025/26"
        classId={CLASS_A_ID}
        classNamesById={classNamesById}
        detailsMode={false}
      />,
    );

    // Without detailsMode: day-cell link should NOT have bg-pink-200
    const links = screen.getAllByRole('link');
    const dayLink = links.find((a) => a.getAttribute('title')?.includes('IA25a'));
    expect(dayLink).toBeDefined();
    expect(dayLink!.className).not.toContain('bg-pink-200');

    // With detailsMode: should now have bg-pink-200
    rerender(
      <SchoolYearCalendar
        days={days}
        schoolYearName="2025/26"
        classId={CLASS_A_ID}
        classNamesById={classNamesById}
        detailsMode={true}
      />,
    );

    const linksAfter = screen.getAllByRole('link');
    const dayLinkAfter = linksAfter.find((a) => a.getAttribute('title')?.includes('IA25a'));
    expect(dayLinkAfter).toBeDefined();
    expect(dayLinkAfter!.className).toContain('bg-pink-200');
  });
});

describe('SchoolYearCalendar — special day types', () => {
  it('unterrichtsausfall day shows eventName when present', () => {
    const days: CalendarDay[] = [
      mkDay('2025-09-08', {
        type: 'unterrichtsausfall',
        eventName: 'Lehrpersonenweiterbildung',
        linkClassId: CLASS_A_ID,
      }),
      ...WEEK37_DAYS.slice(1),
    ];

    render(
      <SchoolYearCalendar
        days={days}
        schoolYearName="2025/26"
        classId={CLASS_A_ID}
        classNamesById={classNamesById}
      />,
    );

    expect(screen.getByText('Lehrpersonenweiterbildung')).toBeInTheDocument();
  });

  it('unterrichtsausfall day without eventName shows "kein Unterricht"', () => {
    const days: CalendarDay[] = [
      mkDay('2025-09-08', {
        type: 'unterrichtsausfall',
        linkClassId: CLASS_A_ID,
      }),
      ...WEEK37_DAYS.slice(1),
    ];

    render(
      <SchoolYearCalendar
        days={days}
        schoolYearName="2025/26"
        classId={CLASS_A_ID}
        classNamesById={classNamesById}
      />,
    );

    expect(screen.getByText('kein Unterricht')).toBeInTheDocument();
  });

  it('ferien day shows holidayName', () => {
    const days: CalendarDay[] = [
      mkDay('2025-09-08', {
        type: 'ferien',
        holidayName: 'Herbstferien',
        linkClassId: CLASS_A_ID,
      }),
      ...WEEK37_DAYS.slice(1),
    ];

    render(
      <SchoolYearCalendar
        days={days}
        schoolYearName="2025/26"
        classId={CLASS_A_ID}
        classNamesById={classNamesById}
      />,
    );

    expect(screen.getByText('Herbstferien')).toBeInTheDocument();
  });

  it('ferien day link title contains the holiday name', () => {
    const days: CalendarDay[] = [
      mkDay('2025-09-08', {
        type: 'ferien',
        holidayName: 'Herbstferien',
        linkClassId: CLASS_A_ID,
      }),
      ...WEEK37_DAYS.slice(1),
    ];

    render(
      <SchoolYearCalendar
        days={days}
        schoolYearName="2025/26"
        classId={CLASS_A_ID}
        classNamesById={classNamesById}
      />,
    );

    // Title is "[className] · [holidayName]" when classNamesById is provided.
    const links = screen.getAllByRole('link');
    const holidayLink = links.find((a) => a.getAttribute('title')?.includes('Herbstferien'));
    expect(holidayLink).toBeDefined();
    expect(holidayLink!.getAttribute('title')).toContain('Herbstferien');
  });
});
