import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as XLSX from 'xlsx';
import { exportCalendarToExcel } from '@/src/lib/exportExcel';
import type { CalendarDay } from '@/src/types';

// xlsx is dynamically imported inside exportCalendarToExcel (lazy-loaded so it
// stays out of the initial bundle). Vitest intercepts both static and dynamic
// imports of 'xlsx' with this mock.
vi.mock('xlsx', () => ({
  utils: {
    json_to_sheet: vi.fn(() => ({})),
    book_new: vi.fn(() => ({})),
    book_append_sheet: vi.fn(),
  },
  writeFile: vi.fn(),
}));

const days: CalendarDay[] = [
  { date: '2025-08-18', type: 'normal', lessonCount: 4 },                                   // Mon → included
  { date: '2025-08-19', type: 'unterrichtsausfall', lessonCount: 0, cancelledCount: 3 },    // included
  { date: '2025-08-20', type: 'no-lessons' },                                               // excluded
  { date: '2025-08-23', type: 'weekend' },                                                  // excluded
  { date: '2025-08-25', type: 'ferien', holidayName: 'Herbstferien' },                      // included
];

type SheetRow = Record<string, string | number>;

function lastSheetRows(): SheetRow[] {
  const calls = vi.mocked(XLSX.utils.json_to_sheet).mock.calls;
  return calls[calls.length - 1][0] as SheetRow[];
}

describe('exportCalendarToExcel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads xlsx lazily and writes a workbook with a class+year filename', async () => {
    await exportCalendarToExcel(days, 'IA23 a', '2026/2027');

    expect(XLSX.utils.book_new).toHaveBeenCalledOnce();
    expect(XLSX.writeFile).toHaveBeenCalledOnce();
    // Filename: slash in the school year is replaced with a dash.
    expect(vi.mocked(XLSX.writeFile).mock.calls[0][1]).toBe(
      'Unterrichtsausfaelle_IA23 a_2026-2027.xlsx',
    );
  });

  it('excludes weekend / no-lessons / out-of-year rows', async () => {
    await exportCalendarToExcel(days, 'IA23 a', '2026/2027');
    const rows = lastSheetRows();
    expect(rows).toHaveLength(3); // normal + unterrichtsausfall + ferien
    expect(rows.map((r) => r.Datum)).toEqual(['18.08.2025', '19.08.2025', '25.08.2025']);
  });

  it('maps day type to a German label and uses holidayName as Bezeichnung', async () => {
    await exportCalendarToExcel(days, 'IA23 a', '2026/2027');
    const rows = lastSheetRows();
    expect(rows[0].Typ).toBe('Normal');
    expect(rows[1].Typ).toBe('Unterrichtsausfall');
    expect(rows[2].Typ).toBe('Ferien');
    expect(rows[2].Bezeichnung).toBe('Herbstferien');
  });

  it('omits the detail columns unless detailsMode is set', async () => {
    await exportCalendarToExcel(days, 'IA23 a', '2026/2027', false);
    expect(Object.keys(lastSheetRows()[0])).not.toContain('Lektionen');

    vi.clearAllMocks();
    await exportCalendarToExcel(days, 'IA23 a', '2026/2027', true);
    const detailRow = lastSheetRows()[0];
    expect(Object.keys(detailRow)).toContain('Lektionen');
    expect(Object.keys(detailRow)).toContain('Abgesagt');
  });
});
