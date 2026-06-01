import { AGGREGATED_DAY_STYLES, DAY_STYLES } from '@/src/lib/calendar-styles';

type LegendVariant = 'single' | 'aggregated';

interface LegendItem {
  cellClass: string;
  label: string;
}

const SINGLE_ITEMS: LegendItem[] = [
  { cellClass: DAY_STYLES.normal.cell,       label: 'Normaler Schultag' },
  { cellClass: DAY_STYLES.schulausfall.cell, label: 'Schulausfall / Alle Lektionen abgesagt' },
  { cellClass: DAY_STYLES.ferien.cell,       label: 'Schulferien' },
];

const AGGREGATED_ITEMS: LegendItem[] = [
  { cellClass: AGGREGATED_DAY_STYLES.normal.cell,    label: 'Alle Klassen normal' },
  { cellClass: AGGREGATED_DAY_STYLES.irregular.cell, label: 'Unregelmässigkeit (Klick für Details)' },
  { cellClass: AGGREGATED_DAY_STYLES.ferien.cell,    label: 'Schulferien' },
];

interface CalendarLegendProps {
  variant?: LegendVariant;
}

export default function CalendarLegend({ variant = 'single' }: CalendarLegendProps) {
  const items = variant === 'aggregated' ? AGGREGATED_ITEMS : SINGLE_ITEMS;
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
