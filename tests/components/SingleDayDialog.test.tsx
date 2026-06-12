import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SingleDayDialog from '@/components/SingleDayDialog';
import type { CalendarDay } from '@/src/types';

const CLASS_A_ID = 101;
const CLASS_B_ID = 202;
const FALLBACK_ID = 999;
const MONDAY = '2025-09-08';

const classNamesById = new Map<number, string>([
  [CLASS_A_ID, 'IA25a'],
  [CLASS_B_ID, 'BM25a'],
]);

const renderDialog = (day: CalendarDay, onClose = vi.fn()) => {
  render(
    <SingleDayDialog
      day={day}
      monday={MONDAY}
      fallbackClassId={FALLBACK_ID}
      classNamesById={classNamesById}
      onClose={onClose}
    />,
  );
  return onClose;
};

describe('SingleDayDialog — un-split day', () => {
  const normalDay: CalendarDay = {
    date: '2025-09-08',
    type: 'normal',
    lessonCount: 5,
    cancelledCount: 1,
    linkClassId: CLASS_A_ID,
  };

  it('renders the long German date and the day type with details', () => {
    renderDialog(normalDay);
    expect(screen.getByText('Montag, 8. September 2025')).toBeInTheDocument();
    expect(screen.getByText(/Normaler Schultag/)).toBeInTheDocument();
    // buildDayTooltip detail: "5 Lektionen, 1 abgesagt"
    expect(screen.getByText(/5 Lektionen, 1 abgesagt/)).toBeInTheDocument();
  });

  it('renders ONE WebUntis link to the linkClassId week', () => {
    renderDialog(normalDay);
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute('href', expect.stringContaining(String(CLASS_A_ID)));
    expect(links[0]).toHaveAttribute('href', expect.stringContaining(MONDAY));
    expect(links[0]).toHaveTextContent('Stundenplan IA25a in WebUntis öffnen');
  });

  it('falls back to fallbackClassId when the day has no linkClassId', () => {
    renderDialog({ date: '2025-09-08', type: 'weekend' });
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute('href', expect.stringContaining(String(FALLBACK_ID)));
    // No class name known for the fallback id
    expect(links[0]).toHaveTextContent('Stundenplan in WebUntis öffnen');
  });

  it('shows the holiday name for a ferien day', () => {
    renderDialog({
      date: '2025-09-08',
      type: 'ferien',
      holidayName: 'Herbstferien',
      linkClassId: CLASS_A_ID,
    });
    expect(screen.getByText(/Schulferien — Herbstferien/)).toBeInTheDocument();
  });
});

describe('SingleDayDialog — split day', () => {
  const splitDay: CalendarDay = {
    date: '2025-09-08',
    type: 'unterrichtsausfall',
    halfDay: {
      morning: { status: 'lessons', classId: CLASS_A_ID },
      afternoon: { status: 'cancelled', classId: CLASS_B_ID, reason: 'QV BM & KV' },
    },
  };

  it('renders one row per half with status, reason and class name', () => {
    renderDialog(splitDay);
    expect(screen.getByText('Vormittag')).toBeInTheDocument();
    expect(screen.getByText('Nachmittag')).toBeInTheDocument();
    expect(screen.getByText(/Unterricht/)).toBeInTheDocument();
    expect(screen.getByText(/fällt aus/)).toBeInTheDocument();
    expect(screen.getByText(/QV BM & KV/)).toBeInTheDocument();
  });

  it('renders one WebUntis link per distinct class', () => {
    renderDialog(splitDay);
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(2);
    const hrefs = links.map((l) => l.getAttribute('href') ?? '');
    expect(hrefs.some((h) => h.includes(String(CLASS_A_ID)))).toBe(true);
    expect(hrefs.some((h) => h.includes(String(CLASS_B_ID)))).toBe(true);
  });

  it('dedupes the links when both halves belong to the same class', () => {
    renderDialog({
      date: '2025-09-08',
      type: 'normal',
      halfDay: {
        morning: { status: 'lessons', classId: CLASS_A_ID },
        afternoon: { status: 'none' },
      },
    });
    // The empty half inherits the morning's class → a single link.
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute('href', expect.stringContaining(String(CLASS_A_ID)));
  });
});

describe('SingleDayDialog — closing', () => {
  const day: CalendarDay = { date: '2025-09-08', type: 'normal', linkClassId: CLASS_A_ID };

  it('calls onClose on the close button', () => {
    const onClose = renderDialog(day);
    fireEvent.click(screen.getByRole('button', { name: 'Schliessen' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls onClose on Escape', () => {
    const onClose = renderDialog(day);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls onClose on backdrop click but not on dialog-content click', () => {
    const onClose = renderDialog(day);
    fireEvent.click(screen.getByText('Montag, 8. September 2025'));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('dialog'));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
