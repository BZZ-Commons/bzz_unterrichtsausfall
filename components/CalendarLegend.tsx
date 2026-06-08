import { AGGREGATED_DAY_STYLES, DAY_STYLES, PARTIAL_CANCEL_STYLE } from '@/src/lib/calendar-styles';

type LegendVariant = 'single' | 'aggregated';

interface LegendItem {
  cellClass: string;
  label: string;
}

const SINGLE_ITEMS: LegendItem[] = [
  { cellClass: DAY_STYLES.normal.cell,        label: 'Normaler Schultag' },
  { cellClass: DAY_STYLES.veranstaltung.cell, label: 'Veranstaltung' },
  { cellClass: DAY_STYLES.unterrichtsausfall.cell, label: 'Unterrichtsausfall' },
  { cellClass: DAY_STYLES.ferien.cell,        label: 'Schulferien' },
];

const SINGLE_ITEMS_DETAILS: LegendItem[] = [
  SINGLE_ITEMS[0],
  { cellClass: PARTIAL_CANCEL_STYLE.cell, label: 'Einzelne Lektionen abgesagt' },
  ...SINGLE_ITEMS.slice(1),
];

const AGGREGATED_ITEMS: LegendItem[] = [
  { cellClass: AGGREGATED_DAY_STYLES.normal.cell,    label: 'Alle Klassen normal' },
  { cellClass: AGGREGATED_DAY_STYLES.irregular.cell, label: 'Unregelmässigkeit (Klick für Details)' },
  { cellClass: AGGREGATED_DAY_STYLES.ferien.cell,    label: 'Schulferien' },
];

interface CalendarLegendProps {
  variant?: LegendVariant;
  detailsMode?: boolean;
}

export default function CalendarLegend({ variant = 'single', detailsMode }: CalendarLegendProps) {
  const items = variant === 'aggregated'
    ? AGGREGATED_ITEMS
    : detailsMode ? SINGLE_ITEMS_DETAILS : SINGLE_ITEMS;
  return (
    <div className="flex flex-wrap gap-3 text-xs">
      {items.map(({ cellClass, label }) => (
        <div key={label} className="flex items-center gap-1.5">
          <span className={`inline-block w-4 h-4 rounded ${cellClass}`} />
          <span className="text-slate-600">{label}</span>
        </div>
      ))}
    </div>
  );
}
