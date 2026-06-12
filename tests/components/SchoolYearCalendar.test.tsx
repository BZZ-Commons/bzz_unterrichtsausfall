import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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

/** The day-cell button whose title names the given class. */
const findDayButtonByTitle = (needle: string) =>
  screen.getAllByRole('button').find((b) => b.getAttribute('title')?.includes(needle));

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

  it('day cells are buttons, not external links', () => {
    render(
      <SchoolYearCalendar
        days={ALL_DAYS}
        schoolYearName="2025/26"
        classId={CLASS_A_ID}
        classNamesById={classNamesById}
      />,
    );
    // The only links left are the KW week links.
    for (const link of screen.getAllByRole('link')) {
      expect(['37', '38']).toContain(link.textContent?.trim());
    }
  });
});

describe('SchoolYearCalendar — normal day cell', () => {
  it('renders a button whose title carries the class name + tooltip', () => {
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

    const dayButton = findDayButtonByTitle('IA25a');
    expect(dayButton).toBeDefined();
    const title = dayButton!.getAttribute('title') ?? '';
    expect(title).toContain('IA25a');
    // buildDayTooltip: "5 Lektionen, 1 abgesagt"
    expect(title).toContain('Lektionen');
    expect(title).toContain('abgesagt');
  });

  it('clicking a day cell calls onDaySelect with the day and its week Monday', () => {
    const onDaySelect = vi.fn();
    render(
      <SchoolYearCalendar
        days={ALL_DAYS}
        schoolYearName="2025/26"
        classId={CLASS_A_ID}
        classNamesById={classNamesById}
        onDaySelect={onDaySelect}
      />,
    );

    const dayButton = screen.getAllByRole('button').find((b) => b.textContent?.trim() === '17');
    expect(dayButton).toBeDefined();
    fireEvent.click(dayButton!);

    expect(onDaySelect).toHaveBeenCalledOnce();
    expect(onDaySelect).toHaveBeenCalledWith(
      expect.objectContaining({ date: '2025-09-17' }),
      WEEK38_MON,
    );
  });
});

describe('SchoolYearCalendar — split day (halfDay)', () => {
  it('renders ONE button per split day with a combined Vormittag/Nachmittag tooltip', () => {
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

    const onDaySelect = vi.fn();
    render(
      <SchoolYearCalendar
        days={days}
        schoolYearName="2025/26"
        classId={CLASS_A_ID}
        classNamesById={classNamesById}
        onDaySelect={onDaySelect}
      />,
    );

    const splitButton = findDayButtonByTitle('Vormittag');
    expect(splitButton).toBeDefined();
    const title = splitButton!.getAttribute('title') ?? '';
    // Both halves with their class names and status in one tooltip
    expect(title).toContain('IA25a · Vormittag: Unterricht');
    expect(title).toContain('BM25a · Nachmittag: Unterricht');

    fireEvent.click(splitButton!);
    expect(onDaySelect).toHaveBeenCalledWith(
      expect.objectContaining({ date: '2025-09-08' }),
      WEEK37_MON,
    );
  });

  it('split day with "none" afternoon: tooltip names only the morning, halves keep their colors', () => {
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

    const splitButton = findDayButtonByTitle('Vormittag');
    expect(splitButton).toBeDefined();
    const title = splitButton!.getAttribute('title') ?? '';
    expect(title).toContain('Unterricht');
    // The empty half says nothing (kein "frei" in the tooltip)
    expect(title).not.toContain('Nachmittag');

    // The two half spans carry their status backgrounds (morning first).
    const halves = splitButton!.querySelectorAll('span[style]');
    expect(halves).toHaveLength(2);
    expect(halves[0]).toHaveStyle({ background: '#d1fae5' }); // lessons → emerald-100
    expect(halves[1]).toHaveStyle({ background: '#f8fafc' }); // none → slate-50
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

    // Tooltip contains "fällt aus" and the reason
    const splitButton = findDayButtonByTitle('fällt aus');
    expect(splitButton).toBeDefined();
    expect(splitButton!.getAttribute('title')).toContain('fällt aus');
    expect(splitButton!.getAttribute('title')).toContain(reason);
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

    // Without detailsMode: day-cell button should NOT have bg-pink-200
    const dayButton = findDayButtonByTitle('IA25a');
    expect(dayButton).toBeDefined();
    expect(dayButton!.className).not.toContain('bg-pink-200');

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

    const dayButtonAfter = findDayButtonByTitle('IA25a');
    expect(dayButtonAfter).toBeDefined();
    expect(dayButtonAfter!.className).toContain('bg-pink-200');
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

  it('ferien day button title contains the holiday name', () => {
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
    const holidayButton = findDayButtonByTitle('Herbstferien');
    expect(holidayButton).toBeDefined();
    expect(holidayButton!.getAttribute('title')).toContain('Herbstferien');
  });
});
