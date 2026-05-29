import { DAY_STYLES } from '@/components/SchoolYearCalendar';

const LEGEND_ITEMS = [
  { type: 'normal',       label: 'Normaler Schultag' },
  { type: 'schulausfall', label: 'Schulausfall / Alle Lektionen abgesagt' },
  { type: 'ferien', label: 'Schulferien' },
] as const;

export default function CalendarLegend() {
  return (
    <div className="flex flex-wrap gap-3 text-xs">
      {LEGEND_ITEMS.map(({ type, label }) => (
        <div key={type} className="flex items-center gap-1.5">
          <span className={`inline-block w-4 h-4 rounded ${DAY_STYLES[type].cell}`} />
          <span className="text-slate-600">{label}</span>
        </div>
      ))}
    </div>
  );
}
