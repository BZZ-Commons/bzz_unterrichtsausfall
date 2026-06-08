import * as XLSX from 'xlsx';
import { parseISO, format, getISODay } from 'date-fns';
import { DOW_LABELS } from '@/src/lib/calendar-layout';
import type { CalendarDay, DayType } from '@/src/types';

const TYPE_LABELS: Record<DayType, string> = {
  normal: 'Normal',
  unterrichtsausfall: 'Unterrichtsausfall',
  ferien: 'Ferien',
  veranstaltung: 'Veranstaltung',
  'no-lessons': 'Kein Unterricht',
  weekend: '',
  'out-of-year': '',
};

export function exportCalendarToExcel(
  days: CalendarDay[],
  className: string,
  schoolYearName: string,
  detailsMode = false,
): void {
  const COLUMNS = [
    { key: 'Datum',       wch: 12, detailsOnly: false },
    { key: 'Wochentag',   wch: 10, detailsOnly: false },
    { key: 'Typ',         wch: 22, detailsOnly: false },
    { key: 'Bezeichnung', wch: 45, detailsOnly: false },
    { key: 'Lektionen',   wch: 10, detailsOnly: true  },
    { key: 'Abgesagt',    wch: 10, detailsOnly: true  },
  ] as const;

  const activeCols = COLUMNS.filter((c) => !c.detailsOnly || detailsMode);

  const rows = days
    .filter((d) => d.type !== 'weekend' && d.type !== 'out-of-year' && d.type !== 'no-lessons')
    .map((d) => {
      const date = parseISO(d.date);
      const full = {
        Datum:       format(date, 'dd.MM.yyyy'),
        Wochentag:   DOW_LABELS[getISODay(date) - 1] ?? '',
        Typ:         TYPE_LABELS[d.type] ?? d.type,
        Bezeichnung: d.holidayName ?? d.eventName ?? '',
        Lektionen:   d.lessonCount ?? '',
        Abgesagt:    d.cancelledCount ?? '',
      };
      return Object.fromEntries(activeCols.map((c) => [c.key, full[c.key]]));
    });

  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = activeCols.map(({ wch }) => ({ wch }));

  const wb = XLSX.utils.book_new();
  const sheetName = className.replace(/[/\\?*[\]]/g, '').slice(0, 31) || 'Export';
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  const safeName = schoolYearName.replace('/', '-');
  XLSX.writeFile(wb, `Unterrichtsausfaelle_${className}_${safeName}.xlsx`);
}
