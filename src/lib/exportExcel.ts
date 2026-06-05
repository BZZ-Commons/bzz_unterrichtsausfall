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
): void {
  const rows = days
    .filter((d) => d.type !== 'weekend' && d.type !== 'out-of-year' && d.type !== 'no-lessons')
    .map((d) => {
      const date = parseISO(d.date);
      return {
        Datum: format(date, 'dd.MM.yyyy'),
        Wochentag: DOW_LABELS[getISODay(date) - 1] ?? '',
        Typ: TYPE_LABELS[d.type] ?? d.type,
        Bezeichnung: d.holidayName ?? d.eventName ?? '',
        Lektionen: d.lessonCount ?? '',
        Abgesagt: d.cancelledCount ?? '',
      };
    });

  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [
    { wch: 12 },
    { wch: 10 },
    { wch: 22 },
    { wch: 45 },
    { wch: 10 },
    { wch: 10 },
  ];

  const wb = XLSX.utils.book_new();
  const sheetName = className.replace(/[/\\?*[\]]/g, '').slice(0, 31) || 'Export';
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  const safeName = schoolYearName.replace('/', '-');
  XLSX.writeFile(wb, `Unterrichtsausfaelle_${className}_${safeName}.xlsx`);
}
