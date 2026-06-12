import type { AggregatedDayType, DayType, HalfStatus } from '@/src/types';

interface DayStyle {
  cell: string;
  text: string;
}

export const PARTIAL_CANCEL_STYLE: DayStyle = {
  cell: 'bg-pink-200',
  text: 'text-pink-800',
};

/**
 * Fill colors for one half of a split day cell. The hex values mirror the Tailwind
 * palette used elsewhere: emerald-100 (Unterricht), orange-200 (fällt aus),
 * slate-50 (kein Unterricht — identical to a non-school day, see DAY_STYLES['no-lessons']).
 * Used as inline backgrounds because the two halves are independent, side-by-side
 * elements (each its own link).
 */
export const HALF_DAY_COLORS: Record<HalfStatus, string> = {
  lessons: '#d1fae5', // emerald-100
  cancelled: '#fed7aa', // orange-200
  none: '#f8fafc', // slate-50 — same gray as a non-school day
};

/** CSS gradient for a split-day swatch (left | right halves) — used for the legend. */
export function halfDayBackground(left: HalfStatus, right: HalfStatus): string {
  return `linear-gradient(to right, ${HALF_DAY_COLORS[left]} 0 50%, ${HALF_DAY_COLORS[right]} 50% 100%)`;
}

export const DAY_STYLES: Record<DayType, DayStyle> = {
  normal: { cell: 'bg-emerald-100', text: 'text-emerald-800' },
  unterrichtsausfall: { cell: 'bg-orange-200', text: 'text-orange-800' },
  veranstaltung: { cell: 'bg-emerald-200', text: 'text-emerald-800' },
  'no-lessons': { cell: 'bg-slate-50', text: 'text-slate-300' },
  ferien: { cell: 'bg-violet-200', text: 'text-violet-800' },
  weekend: { cell: 'bg-slate-50', text: 'text-slate-300' },
  'out-of-year': { cell: 'bg-white', text: 'text-transparent' },
};

export const AGGREGATED_DAY_STYLES: Record<AggregatedDayType, DayStyle> = {
  normal: { cell: 'bg-emerald-100', text: 'text-emerald-800' },
  irregular: { cell: 'bg-orange-200', text: 'text-orange-800' },
  ferien: { cell: 'bg-violet-200', text: 'text-violet-800' },
  weekend: { cell: 'bg-slate-50', text: 'text-slate-300' },
  'no-school': { cell: 'bg-slate-50', text: 'text-slate-300' },
  'out-of-year': { cell: 'bg-white', text: 'text-transparent' },
};
