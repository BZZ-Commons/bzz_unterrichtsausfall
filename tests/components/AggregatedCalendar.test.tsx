import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AggregatedCalendar from '@/components/AggregatedCalendar';
import type { AggregatedDay, ClassDayStatus } from '@/src/types';

// ─── Fixture helpers ──────────────────────────────────────────────────────────

/** ISO week 37/2025: Mon 2025-09-08 → Sun 2025-09-14 */
const mkAggDay = (date: string, overrides: Partial<AggregatedDay> = {}): AggregatedDay => ({
  date,
  type: 'normal',
  ...overrides,
});

const mkClassStatus = (
  className: string,
  classId: number,
  overrides: Partial<ClassDayStatus> = {},
): ClassDayStatus => ({
  className,
  classId,
  type: 'unterrichtsausfall',
  lessonCount: 0,
  cancelledCount: 3,
  ...overrides,
});

// Full week Mon-Sun 2025-09-08..14
const WEEK37_DAYS: AggregatedDay[] = [
  mkAggDay('2025-09-08'),
  mkAggDay('2025-09-09'),
  mkAggDay('2025-09-10'),
  mkAggDay('2025-09-11'),
  mkAggDay('2025-09-12'),
  mkAggDay('2025-09-13', { type: 'weekend' }),
  mkAggDay('2025-09-14', { type: 'weekend' }),
];

// Second week 2025-09-15..21 (ISO week 38)
const WEEK38_DAYS: AggregatedDay[] = [
  mkAggDay('2025-09-15'),
  mkAggDay('2025-09-16'),
  mkAggDay('2025-09-17'),
  mkAggDay('2025-09-18'),
  mkAggDay('2025-09-19'),
  mkAggDay('2025-09-20', { type: 'weekend' }),
  mkAggDay('2025-09-21', { type: 'weekend' }),
];

const ALL_DAYS = [...WEEK37_DAYS, ...WEEK38_DAYS];

const noop = () => {};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('AggregatedCalendar — structure', () => {
  it('renders month label, weekday header, ISO week numbers, and footer', () => {
    render(<AggregatedCalendar days={ALL_DAYS} schoolYearName="2025/26" onDaySelect={noop} />);

    expect(screen.getByText('September 2025')).toBeInTheDocument();
    for (const label of ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
    expect(screen.getByText('37')).toBeInTheDocument();
    expect(screen.getByText('38')).toBeInTheDocument();
    expect(screen.getByText('Schuljahr 2025/26')).toBeInTheDocument();
  });

  it('shows empty-state message when no days provided', () => {
    render(<AggregatedCalendar days={[]} schoolYearName="2025/26" onDaySelect={noop} />);
    expect(screen.getByText('Keine Kalenderdaten verfügbar.')).toBeInTheDocument();
  });
});

describe('AggregatedCalendar — day type rendering', () => {
  it('renders a normal day as a div (non-interactive)', () => {
    const days: AggregatedDay[] = [
      mkAggDay('2025-09-08', { type: 'normal' }),
      ...WEEK37_DAYS.slice(1),
    ];

    render(<AggregatedCalendar days={days} schoolYearName="2025/26" onDaySelect={noop} />);

    // Normal days render as div, not button — so no role="button"
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('renders a ferien day with holidayName', () => {
    const days: AggregatedDay[] = [
      mkAggDay('2025-09-08', { type: 'ferien', holidayName: 'Herbstferien' }),
      ...WEEK37_DAYS.slice(1),
    ];

    render(<AggregatedCalendar days={days} schoolYearName="2025/26" onDaySelect={noop} />);

    expect(screen.getByText('Herbstferien')).toBeInTheDocument();
    // Ferien day title attribute on its container
    const cells = document.querySelectorAll('[title="Herbstferien"]');
    expect(cells.length).toBeGreaterThan(0);
  });

  it('renders a ferien day without holidayName — no label text but day number shows', () => {
    const days: AggregatedDay[] = [
      mkAggDay('2025-09-08', { type: 'ferien' }),
      ...WEEK37_DAYS.slice(1),
    ];

    render(<AggregatedCalendar days={days} schoolYearName="2025/26" onDaySelect={noop} />);

    // Day number "08" visible
    expect(screen.getByText('08')).toBeInTheDocument();
  });

  it('renders a no-school day (non-interactive)', () => {
    const days: AggregatedDay[] = [
      mkAggDay('2025-09-08', { type: 'no-school' }),
      ...WEEK37_DAYS.slice(1),
    ];

    render(<AggregatedCalendar days={days} schoolYearName="2025/26" onDaySelect={noop} />);

    // No interactive button for no-school days
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('renders an out-of-year day — just a blank div', () => {
    const days: AggregatedDay[] = [
      mkAggDay('2025-09-08', { type: 'out-of-year' }),
      ...WEEK37_DAYS.slice(1),
    ];

    render(<AggregatedCalendar days={days} schoolYearName="2025/26" onDaySelect={noop} />);

    // out-of-year renders as a blank styled div — no button, no link
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByRole('link')).toBeNull();
  });
});

describe('AggregatedCalendar — irregular day', () => {
  it('renders as an interactive button with class/Klassen count', () => {
    const affectedClasses = [mkClassStatus('IA25a', 101), mkClassStatus('BM25a', 202)];
    const days: AggregatedDay[] = [
      mkAggDay('2025-09-08', { type: 'irregular', affectedClasses }),
      ...WEEK37_DAYS.slice(1),
    ];

    render(<AggregatedCalendar days={days} schoolYearName="2025/26" onDaySelect={noop} />);

    const btn = screen.getByRole('button');
    expect(btn).toBeInTheDocument();
    // Shows "2 Klassen" for two affected classes
    expect(screen.getByText('2 Klassen')).toBeInTheDocument();
  });

  it('shows "1 Klasse" (singular) when exactly one class is affected', () => {
    const days: AggregatedDay[] = [
      mkAggDay('2025-09-08', {
        type: 'irregular',
        affectedClasses: [mkClassStatus('IA25a', 101)],
      }),
      ...WEEK37_DAYS.slice(1),
    ];

    render(<AggregatedCalendar days={days} schoolYearName="2025/26" onDaySelect={noop} />);

    expect(screen.getByText('1 Klasse')).toBeInTheDocument();
  });

  it('button title contains class count and "Klick für Details"', () => {
    const affectedClasses = [
      mkClassStatus('IA25a', 101),
      mkClassStatus('BM25a', 202),
      mkClassStatus('KV25a', 303),
    ];
    const days: AggregatedDay[] = [
      mkAggDay('2025-09-08', { type: 'irregular', affectedClasses }),
      ...WEEK37_DAYS.slice(1),
    ];

    render(<AggregatedCalendar days={days} schoolYearName="2025/26" onDaySelect={noop} />);

    const btn = screen.getByRole('button');
    const title = btn.getAttribute('title') ?? '';
    expect(title).toContain('3');
    expect(title).toContain('Klassen betroffen');
    expect(title).toContain('Klick für Details');
  });

  it('clicking an irregular day calls onDaySelect with the day object', async () => {
    const user = userEvent.setup();
    const onDaySelect = vi.fn();
    const irregularDay: AggregatedDay = mkAggDay('2025-09-08', {
      type: 'irregular',
      affectedClasses: [mkClassStatus('IA25a', 101)],
    });
    const days: AggregatedDay[] = [irregularDay, ...WEEK37_DAYS.slice(1)];

    render(<AggregatedCalendar days={days} schoolYearName="2025/26" onDaySelect={onDaySelect} />);

    const btn = screen.getByRole('button');
    await user.click(btn);

    expect(onDaySelect).toHaveBeenCalledOnce();
    expect(onDaySelect).toHaveBeenCalledWith(irregularDay);
  });

  it('clicking a non-irregular day does NOT call onDaySelect', async () => {
    const onDaySelect = vi.fn();
    const days: AggregatedDay[] = [
      mkAggDay('2025-09-08', { type: 'normal' }),
      ...WEEK37_DAYS.slice(1),
    ];

    render(<AggregatedCalendar days={days} schoolYearName="2025/26" onDaySelect={onDaySelect} />);

    // Normal day is a div — not clickable as a button
    expect(screen.queryByRole('button')).toBeNull();
    expect(onDaySelect).not.toHaveBeenCalled();
  });

  it('multiple irregular days on separate dates: clicking the second calls onDaySelect with its object', async () => {
    const user = userEvent.setup();
    const onDaySelect = vi.fn();

    const day1: AggregatedDay = mkAggDay('2025-09-08', {
      type: 'irregular',
      affectedClasses: [mkClassStatus('IA25a', 101)],
    });
    const day2: AggregatedDay = mkAggDay('2025-09-09', {
      type: 'irregular',
      affectedClasses: [mkClassStatus('BM25a', 202), mkClassStatus('KV25a', 303)],
    });
    const days: AggregatedDay[] = [day1, day2, ...WEEK37_DAYS.slice(2)];

    render(<AggregatedCalendar days={days} schoolYearName="2025/26" onDaySelect={onDaySelect} />);

    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(2);

    // Click the second button (day2)
    await user.click(buttons[1]);
    expect(onDaySelect).toHaveBeenCalledWith(day2);
  });

  it('irregular day with zero affectedClasses shows "0 Klassen"', () => {
    const days: AggregatedDay[] = [
      mkAggDay('2025-09-08', { type: 'irregular', affectedClasses: [] }),
      ...WEEK37_DAYS.slice(1),
    ];

    render(<AggregatedCalendar days={days} schoolYearName="2025/26" onDaySelect={noop} />);

    expect(screen.getByText('0 Klassen')).toBeInTheDocument();
  });
});
